import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { conflict } from "../errors.js";
import { GRACE_HOURS, PRODUCT_ID } from "../constants.js";

const { Pool } = pg;
const MIGRATION_LOCK_KEY = 76020041;

function rowToLicense(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    plan: row.plan,
    status: row.status,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    paypalSubscriptionId: row.paypal_subscription_id,
    paypalPlanId: row.paypal_plan_id,
    subscriptionStatus: row.subscription_status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    graceUntil: row.grace_until,
    lastSuccessfulSaleId: row.last_successful_sale_id,
    manualReviewReason: row.manual_review_reason
  };
}

function sameSubscriptionPayment(existing, request) {
  return existing.paypal_subscription_id === request.paypalSubscriptionId
    && existing.amount === request.amount
    && existing.currency === request.currency
    && new Date(existing.period_start).toISOString() === new Date(request.periodStart).toISOString()
    && new Date(existing.period_end).toISOString() === new Date(request.periodEnd).toISOString();
}

export class PostgresStore {
  constructor({ databaseUrl, pool } = {}) {
    this.pool = pool || new Pool({ connectionString: databaseUrl });
    this.migrationComplete = false;
  }

  async close() {
    await this.pool.end();
  }

  async migrate() {
    const baseDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
    const files = (await readdir(join(baseDir, "migrations"))).filter((file) => file.endsWith(".sql")).sort();
    const client = await this.pool.connect();
    let locked = false;
    this.migrationComplete = false;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      locked = true;
      for (const file of files) {
        await client.query(await readFile(join(baseDir, "migrations", file), "utf8"));
      }
      this.migrationComplete = true;
    } finally {
      if (locked) {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
      }
      client.release();
    }
  }

  async pingReadWrite() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE TEMP TABLE IF NOT EXISTS mt5_ready_check (id INT)");
      await client.query("INSERT INTO mt5_ready_check (id) VALUES (1)");
      await client.query("ROLLBACK");
      return true;
    } finally {
      client.release();
    }
  }

  async activateSubscription(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await client.query(
        `SELECT l.*, p.paypal_subscription_id AS payment_subscription_id,
                p.amount AS payment_amount, p.currency AS payment_currency,
                p.period_start AS payment_period_start, p.period_end AS payment_period_end
         FROM mt5_subscription_payments p
         JOIN mt5_licenses l ON l.id = p.license_id
         WHERE p.paypal_sale_id = $1
         FOR UPDATE`,
        [request.paypalSaleId]
      );
      if (payment.rowCount > 0) {
        if (!sameSubscriptionPayment({
          paypal_subscription_id: payment.rows[0].payment_subscription_id,
          amount: payment.rows[0].payment_amount,
          currency: payment.rows[0].payment_currency,
          period_start: payment.rows[0].payment_period_start,
          period_end: payment.rows[0].payment_period_end
        }, request)) {
          throw conflict("subscription_payment_conflict", "saleId belongs to a different payload.");
        }
        await client.query("COMMIT");
        return { alreadyProcessed: true, license: rowToLicense(payment.rows[0]) };
      }
      const existingSubscription = await client.query(
        "SELECT * FROM mt5_licenses WHERE paypal_subscription_id = $1 FOR UPDATE",
        [request.paypalSubscriptionId]
      );
      if (existingSubscription.rowCount > 0) {
        throw conflict("subscription_already_activated", "subscriptionId already has a license.");
      }
      const inserted = await client.query(
        `INSERT INTO mt5_licenses (
          license_key_hash, product_id, sku, plan, status, customer_email, customer_name,
          issued_by, expires_at, paypal_subscription_id, paypal_plan_id, subscription_status,
          current_period_start, current_period_end, last_successful_sale_id, last_payment_at
        ) VALUES ($1,$2,$3,$4,'active',$5,$6,'api',$7,$8,$9,'ACTIVE',$10,$11,$12,$13)
        RETURNING *`,
        [
          request.licenseKeyHash,
          request.productId,
          request.sku,
          request.plan,
          request.customerEmail,
          request.customerName,
          request.periodEnd,
          request.paypalSubscriptionId,
          request.paypalPlanId,
          request.periodStart,
          request.periodEnd,
          request.paypalSaleId,
          request.paidAt
        ]
      );
      const row = inserted.rows[0];
      await this.insertSubscriptionPaymentWithClient(client, row.id, request, "COMPLETED");
      await client.query(
        `INSERT INTO mt5_pending_license_deliveries (
          license_id, paypal_sale_id, paypal_subscription_id,
          encrypted_license_key, encryption_iv, encryption_auth_tag
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (paypal_sale_id) DO NOTHING`,
        [
          row.id,
          request.paypalSaleId,
          request.paypalSubscriptionId,
          request.recovery?.encryptedLicenseKey || null,
          request.recovery?.encryptionIv || null,
          request.recovery?.encryptionAuthTag || null
        ]
      );
      await this.auditWithClient(client, row.id, "subscription_activate", "api", {
        subscriptionId: request.paypalSubscriptionId,
        saleId: request.paypalSaleId,
        plan: request.plan
      });
      await client.query("COMMIT");
      return { alreadyProcessed: false, license: rowToLicense(row) };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        throw conflict("subscription_unique_conflict", "Subscription or sale already exists.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async renewSubscription(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM mt5_licenses WHERE paypal_subscription_id = $1 FOR UPDATE", [request.paypalSubscriptionId]);
      if (found.rowCount === 0) {
        throw conflict("subscription_not_found", "subscriptionId does not exist.");
      }
      const license = found.rows[0];
      this.assertSubscriptionMatches(license, request);
      const existingPayment = await client.query("SELECT * FROM mt5_subscription_payments WHERE paypal_sale_id = $1 FOR UPDATE", [request.paypalSaleId]);
      if (existingPayment.rowCount > 0) {
        if (!sameSubscriptionPayment(existingPayment.rows[0], request)) {
          throw conflict("subscription_payment_conflict", "saleId belongs to a different payload.");
        }
        await client.query("COMMIT");
        return { alreadyProcessed: true, license: rowToLicense(license) };
      }
      if (license.current_period_end && new Date(request.periodEnd).getTime() <= new Date(license.current_period_end).getTime()) {
        throw conflict("period_not_forward", "periodEnd must move forward.");
      }
      await this.insertSubscriptionPaymentWithClient(client, license.id, request, "COMPLETED");
      const updated = await client.query(
        `UPDATE mt5_licenses
         SET subscription_status='ACTIVE', current_period_start=$2, current_period_end=$3,
             expires_at=$3, grace_until=NULL, last_successful_sale_id=$4,
             last_payment_at=$5, updated_at=NOW()
         WHERE id=$1
         RETURNING *`,
        [license.id, request.periodStart, request.periodEnd, request.paypalSaleId, request.paidAt]
      );
      await this.auditWithClient(client, license.id, "subscription_renew", "api", {
        subscriptionId: request.paypalSubscriptionId,
        saleId: request.paypalSaleId,
        plan: request.plan
      });
      await client.query("COMMIT");
      return { alreadyProcessed: false, license: rowToLicense(updated.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        throw conflict("subscription_payment_conflict", "Sale already exists.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSubscriptionStatus(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const event = await client.query("SELECT * FROM mt5_subscription_events WHERE event_id = $1", [request.paypalEventId]);
      if (event.rowCount > 0) {
        await client.query("COMMIT");
        return { alreadyProcessed: true, ignored: true };
      }
      const found = await client.query("SELECT * FROM mt5_licenses WHERE paypal_subscription_id = $1 FOR UPDATE", [request.paypalSubscriptionId]);
      if (found.rowCount === 0) {
        throw conflict("subscription_not_found", "subscriptionId does not exist.");
      }
      const license = found.rows[0];
      await client.query(
        "INSERT INTO mt5_subscription_events (license_id, paypal_subscription_id, event_id, event_status, event_time) VALUES ($1,$2,$3,$4,$5)",
        [license.id, request.paypalSubscriptionId, request.paypalEventId, request.status, request.eventTime]
      );
      const update = this.subscriptionStatusUpdate(request);
      const updated = await client.query(
        `UPDATE mt5_licenses
         SET subscription_status=$2, grace_until=$3, cancelled_at=COALESCE($4, cancelled_at),
             suspended_at=COALESCE($5, suspended_at), manual_review_reason=COALESCE($6, manual_review_reason),
             latest_subscription_event_at=$7, updated_at=NOW()
         WHERE id=$1
         RETURNING *`,
        [license.id, update.status, update.graceUntil, update.cancelledAt, update.suspendedAt, update.manualReviewReason, request.eventTime]
      );
      await this.auditWithClient(client, license.id, "subscription_status", "api", {
        subscriptionId: request.paypalSubscriptionId,
        eventId: request.paypalEventId,
        status: request.status
      });
      await client.query("COMMIT");
      return { alreadyProcessed: false, ignored: false, license: rowToLicense(updated.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return { alreadyProcessed: true, ignored: true };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async recoverSubscriptionLicenseKey({ paypalSaleId, paypalSubscriptionId }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT d.*, l.id AS license_id
         FROM mt5_pending_license_deliveries d
         JOIN mt5_licenses l ON l.id = d.license_id
         WHERE d.paypal_sale_id = $1 AND d.paypal_subscription_id = $2
         FOR UPDATE`,
        [paypalSaleId, paypalSubscriptionId]
      );
      if (result.rowCount === 0 || result.rows[0].acknowledged_at || !result.rows[0].encrypted_license_key) {
        await client.query("COMMIT");
        return null;
      }
      const row = result.rows[0];
      await this.auditWithClient(client, row.license_id, "subscription_delivery_recover", "api", { subscriptionId: paypalSubscriptionId, saleId: paypalSaleId });
      await client.query("COMMIT");
      return {
        licenseId: row.license_id,
        paypalSubscriptionId: row.paypal_subscription_id,
        encryptedLicenseKey: row.encrypted_license_key,
        encryptionIv: row.encryption_iv,
        encryptionAuthTag: row.encryption_auth_tag
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async acknowledgeSubscriptionDelivery({ paypalSaleId, paypalSubscriptionId }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE mt5_pending_license_deliveries
         SET acknowledged_at = COALESCE(acknowledged_at, NOW()),
             encrypted_license_key = NULL, encryption_iv = NULL, encryption_auth_tag = NULL, updated_at = NOW()
         WHERE paypal_sale_id = $1 AND paypal_subscription_id = $2
         RETURNING license_id, acknowledged_at`,
        [paypalSaleId, paypalSubscriptionId]
      );
      if (result.rowCount > 0) {
        await this.auditWithClient(client, result.rows[0].license_id, "subscription_delivery_ack", "api", { subscriptionId: paypalSubscriptionId, saleId: paypalSaleId });
      }
      await client.query("COMMIT");
      return { acknowledged: result.rowCount > 0 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyLicense({ licenseKeyHash, accountLogin, accountServer, machineHintHash, snapshot }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM mt5_licenses WHERE license_key_hash = $1 FOR UPDATE", [licenseKeyHash]);
      if (found.rowCount === 0) {
        await client.query("COMMIT");
        return { valid: false, reason: "license_not_found" };
      }
      const license = found.rows[0];
      const subscriptionCheck = this.subscriptionValidity(license, new Date());
      if (!subscriptionCheck.valid) {
        await client.query("COMMIT");
        return { valid: false, reason: subscriptionCheck.reason, license: rowToLicense(license) };
      }
      if (license.status !== "active") {
        await client.query("COMMIT");
        return { valid: false, reason: "license_disabled", license: rowToLicense(license) };
      }
      const binding = await client.query("SELECT * FROM mt5_license_bindings WHERE license_id = $1 AND active = TRUE FOR UPDATE", [license.id]);
      if (binding.rowCount === 0) {
        const bind = await this.tryFirstBindWithClient(client, license, accountLogin, accountServer, machineHintHash);
        if (!bind.valid) {
          await client.query("COMMIT");
          return { valid: false, reason: bind.reason, license: rowToLicense(license) };
        }
      } else {
        const active = binding.rows[0];
        if (Number(active.account_login) !== Number(accountLogin) || active.account_server !== accountServer) {
          await client.query("COMMIT");
          return { valid: false, reason: "account_not_allowed", license: rowToLicense(license) };
        }
      }
      const updated = await client.query("UPDATE mt5_licenses SET last_seen_at = NOW(), latest_snapshot = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [license.id, JSON.stringify(snapshot || {})]);
      await client.query("COMMIT");
      return { valid: true, reason: "ok", license: rowToLicense(updated.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async issueManualPermanent(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO mt5_licenses (
          license_key_hash, product_id, sku, plan, status, customer_email, customer_name, issued_by
        ) VALUES ($1,$2,'manual-permanent','permanent','active',$3,$4,'manual-cli')
        RETURNING *`,
        [request.licenseKeyHash, PRODUCT_ID, request.customerEmail, request.customerName]
      );
      await this.auditWithClient(client, inserted.rows[0].id, "manual_permanent_issue", "server_cli", { purpose: "owner_or_friend_only" });
      await client.query("COMMIT");
      return rowToLicense(inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async auditWithClient(client, licenseId, action, actor, detail) {
    await client.query("INSERT INTO mt5_license_audit_log (license_id, action, actor, detail) VALUES ($1,$2,$3,$4)", [licenseId, action, actor, JSON.stringify(detail || {})]);
  }

  assertSubscriptionMatches(license, request) {
    if (license.product_id !== request.productId || license.sku !== request.sku || license.plan !== request.plan || license.paypal_plan_id !== request.paypalPlanId) {
      throw conflict("subscription_payload_conflict", "subscription payload does not match original license.");
    }
  }

  async insertSubscriptionPaymentWithClient(client, licenseId, request, paymentStatus) {
    await client.query(
      `INSERT INTO mt5_subscription_payments (
        license_id, paypal_sale_id, paypal_subscription_id, event_id, amount, currency,
        payment_status, paid_at, period_start, period_end
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [licenseId, request.paypalSaleId, request.paypalSubscriptionId, request.paypalEventId, request.amount, request.currency, paymentStatus, request.paidAt, request.periodStart, request.periodEnd]
    );
  }

  subscriptionStatusUpdate(request) {
    if (request.status === "PAYMENT_FAILED") {
      return { status: "PAYMENT_FAILED", graceUntil: new Date(new Date(request.eventTime).getTime() + GRACE_HOURS * 60 * 60 * 1000).toISOString(), cancelledAt: null, suspendedAt: null, manualReviewReason: null };
    }
    if (request.status === "CANCELLED") {
      return { status: "CANCELLED", graceUntil: null, cancelledAt: request.eventTime, suspendedAt: null, manualReviewReason: null };
    }
    if (request.status === "REFUNDED" || request.status === "REVERSED") {
      return { status: request.status, graceUntil: null, cancelledAt: null, suspendedAt: request.eventTime, manualReviewReason: request.reason || request.status };
    }
    if (request.status === "SUSPENDED") {
      return { status: "SUSPENDED", graceUntil: null, cancelledAt: null, suspendedAt: request.eventTime, manualReviewReason: request.reason || "SUSPENDED" };
    }
    return { status: request.status, graceUntil: null, cancelledAt: null, suspendedAt: null, manualReviewReason: null };
  }

  subscriptionValidity(license, now) {
    if (license.plan === "permanent" && !license.paypal_subscription_id) {
      return { valid: true };
    }
    const status = license.subscription_status || "ACTIVE";
    const paidThrough = license.current_period_end ? new Date(license.current_period_end) : null;
    const graceUntil = license.grace_until ? new Date(license.grace_until) : null;
    const paidValid = paidThrough && paidThrough.getTime() > now.getTime();
    const graceValid = graceUntil && graceUntil.getTime() > now.getTime();
    if (status === "ACTIVE") return paidValid ? { valid: true } : { valid: false, reason: "license_expired" };
    if (status === "PAYMENT_FAILED") return (paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_payment_failed" };
    if (status === "CANCELLED") return paidValid ? { valid: true } : { valid: false, reason: "subscription_cancelled" };
    if (status === "EXPIRED") return { valid: false, reason: "license_expired" };
    return { valid: false, reason: "subscription_suspended" };
  }

  async tryFirstBindWithClient(client, license, accountLogin, accountServer, machineHintHash) {
    await client.query("SAVEPOINT mt5_first_bind");
    try {
      await client.query("INSERT INTO mt5_license_bindings (license_id, account_login, account_server, machine_hint_hash) VALUES ($1,$2,$3,$4)", [license.id, accountLogin, accountServer, machineHintHash || null]);
      await this.auditWithClient(client, license.id, "first_bind", "mt5_client", { accountLogin, accountServer });
      await client.query("RELEASE SAVEPOINT mt5_first_bind");
      return { valid: true };
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT mt5_first_bind");
      await client.query("RELEASE SAVEPOINT mt5_first_bind");
      if (error.code !== "23505") throw error;
      const existing = await client.query("SELECT * FROM mt5_license_bindings WHERE license_id = $1 AND active = TRUE FOR UPDATE", [license.id]);
      if (existing.rowCount === 0) throw error;
      const active = existing.rows[0];
      if (Number(active.account_login) === Number(accountLogin) && active.account_server === accountServer) {
        return { valid: true };
      }
      return { valid: false, reason: "account_not_allowed" };
    }
  }
}
