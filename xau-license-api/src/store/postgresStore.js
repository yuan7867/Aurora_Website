import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { conflict } from "../errors.js";

const { Pool } = pg;
const MIGRATION_LOCK_KEY = 76010041;

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
    paypalOrderId: row.paypal_order_id,
    paypalCaptureId: row.paypal_capture_id,
    paypalEventId: row.paypal_event_id,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at
    ,
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

function sameIssue(existing, request) {
  return existing.product_id === request.productId
    && existing.sku === request.sku
    && existing.plan === request.plan
    && existing.customer_email === request.customerEmail
    && (existing.paypal_order_id || "") === (request.paypalOrderId || "")
    && existing.paypal_capture_id === request.paypalCaptureId
    && (existing.paypal_event_id || "") === (request.paypalEventId || "");
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
    this.pool = pool || new Pool({
      connectionString: databaseUrl
    });
    this.migrationComplete = false;
  }

  async close() {
    await this.pool.end();
  }

  async migrate() {
    const baseDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
    const migrationsDir = join(baseDir, "migrations");
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    const client = await this.pool.connect();
    let locked = false;
    this.migrationComplete = false;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      locked = true;
      for (const file of files) {
        const sql = await readFile(join(migrationsDir, file), "utf8");
        await client.query(sql);
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
      await client.query("CREATE TEMP TABLE IF NOT EXISTS xau_ready_check (id INT)");
      await client.query("INSERT INTO xau_ready_check (id) VALUES (1)");
      await client.query("ROLLBACK");
      return true;
    } finally {
      client.release();
    }
  }

  async issueLicense(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT * FROM xau_licenses WHERE paypal_capture_id = $1 FOR UPDATE",
        [request.paypalCaptureId]
      );

      if (existing.rowCount > 0) {
        const row = existing.rows[0];
        if (!sameIssue(row, request)) {
          throw conflict("payment_payload_conflict", "Existing captureId belongs to a different payload.");
        }
        await client.query("COMMIT");
        return {
          alreadyIssued: true,
          license: rowToLicense(row)
        };
      }

      const expiresAt = new Date(Date.now() + request.days * 24 * 60 * 60 * 1000);
      const insert = await client.query(
        `INSERT INTO xau_licenses (
          license_key_hash, product_id, sku, plan, status, customer_email, customer_name,
          paypal_order_id, paypal_capture_id, paypal_event_id, issued_by, expires_at
        ) VALUES ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,'api',$10)
        RETURNING *`,
        [
          request.licenseKeyHash,
          request.productId,
          request.sku,
          request.plan,
          request.customerEmail,
          request.customerName,
          request.paypalOrderId,
          request.paypalCaptureId,
          request.paypalEventId,
          expiresAt.toISOString()
        ]
      );
      const row = insert.rows[0];
      await this.auditWithClient(client, row.id, "issue", "api", {
        productId: request.productId,
        sku: request.sku,
        plan: request.plan,
        paypalCaptureId: request.paypalCaptureId,
        customerEmail: request.customerEmail
      });
      await client.query("COMMIT");
      return {
        alreadyIssued: false,
        license: rowToLicense(row)
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        throw conflict("unique_constraint_conflict", "Unique constraint rejected this request.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async issueManual(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const expiresAt = request.days ? new Date(Date.now() + request.days * 24 * 60 * 60 * 1000).toISOString() : null;
      const insert = await client.query(
        `INSERT INTO xau_licenses (
          license_key_hash, product_id, sku, plan, status, customer_email, customer_name,
          issued_by, expires_at
        ) VALUES ($1,$2,$3,$4,'active',$5,$6,'manual',$7)
        RETURNING *`,
        [
          request.licenseKeyHash,
          request.productId,
          request.sku,
          request.plan,
          request.customerEmail,
          request.customerName,
          expiresAt
        ]
      );
      const row = insert.rows[0];
      await this.auditWithClient(client, row.id, "manual_issue", "server_cli", {
        plan: request.plan,
        customerEmail: request.customerEmail
      });
      await client.query("COMMIT");
      return rowToLicense(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async activateSubscription(request) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await client.query(
        "SELECT l.*, p.paypal_subscription_id AS payment_subscription_id, p.amount AS payment_amount, p.currency AS payment_currency, p.period_start AS payment_period_start, p.period_end AS payment_period_end FROM xau_subscription_payments p JOIN xau_licenses l ON l.id = p.license_id WHERE p.paypal_sale_id = $1 FOR UPDATE",
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
        "SELECT * FROM xau_licenses WHERE paypal_subscription_id = $1 FOR UPDATE",
        [request.paypalSubscriptionId]
      );
      if (existingSubscription.rowCount > 0) {
        throw conflict("subscription_already_activated", "subscriptionId already has a license.");
      }

      const insert = await client.query(
        `INSERT INTO xau_licenses (
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
      const row = insert.rows[0];
      await this.insertSubscriptionPaymentWithClient(client, row.id, request, "Completed");
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
      const licenseResult = await client.query(
        "SELECT * FROM xau_licenses WHERE paypal_subscription_id = $1 FOR UPDATE",
        [request.paypalSubscriptionId]
      );
      if (licenseResult.rowCount === 0) {
        throw conflict("subscription_not_found", "subscriptionId does not exist.");
      }
      const license = licenseResult.rows[0];
      this.assertSubscriptionMatches(license, request);

      const existingPayment = await client.query(
        "SELECT * FROM xau_subscription_payments WHERE paypal_sale_id = $1 FOR UPDATE",
        [request.paypalSaleId]
      );
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

      await this.insertSubscriptionPaymentWithClient(client, license.id, request, "Completed");
      const updated = await client.query(
        `UPDATE xau_licenses
         SET subscription_status='ACTIVE',
             current_period_start=$2,
             current_period_end=$3,
             expires_at=$3,
             grace_until=NULL,
             last_successful_sale_id=$4,
             last_payment_at=$5,
             updated_at=NOW()
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
      const event = await client.query(
        "SELECT * FROM xau_subscription_events WHERE event_id = $1",
        [request.paypalEventId]
      );
      if (event.rowCount > 0) {
        await client.query("COMMIT");
        return { alreadyProcessed: true, ignored: true };
      }
      const found = await client.query(
        "SELECT * FROM xau_licenses WHERE paypal_subscription_id = $1 FOR UPDATE",
        [request.paypalSubscriptionId]
      );
      if (found.rowCount === 0) {
        throw conflict("subscription_not_found", "subscriptionId does not exist.");
      }
      const license = found.rows[0];
      await client.query(
        "INSERT INTO xau_subscription_events (license_id, paypal_subscription_id, event_id, event_status, event_time) VALUES ($1,$2,$3,$4,$5)",
        [license.id, request.paypalSubscriptionId, request.paypalEventId, request.status, request.eventTime]
      );
      const latest = license.latest_subscription_event_at ? new Date(license.latest_subscription_event_at).getTime() : 0;
      if (new Date(request.eventTime).getTime() < latest) {
        await client.query("COMMIT");
        return { alreadyProcessed: false, ignored: true, license: rowToLicense(license) };
      }

      const update = this.subscriptionStatusUpdate(request);
      const updated = await client.query(
        `UPDATE xau_licenses
         SET subscription_status=$2,
             grace_until=$3,
             cancelled_at=COALESCE($4, cancelled_at),
             suspended_at=COALESCE($5, suspended_at),
             manual_review_reason=COALESCE($6, manual_review_reason),
             latest_subscription_event_at=$7,
             updated_at=NOW()
         WHERE id=$1
         RETURNING *`,
        [
          license.id,
          update.status,
          update.graceUntil,
          update.cancelledAt,
          update.suspendedAt,
          update.manualReviewReason,
          request.eventTime
        ]
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

  async verifyLicense({ licenseKeyHash, accountLogin, accountServer, snapshot }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM xau_licenses WHERE license_key_hash = $1 FOR UPDATE",
        [licenseKeyHash]
      );
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
      if (!license.paypal_subscription_id && license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
        await client.query("COMMIT");
        return { valid: false, reason: "license_expired", license: rowToLicense(license) };
      }

      const binding = await client.query(
        "SELECT * FROM xau_license_bindings WHERE license_id = $1 AND active = TRUE FOR UPDATE",
        [license.id]
      );

      if (binding.rowCount === 0) {
        const bindResult = await this.tryFirstBindWithClient(client, license, accountLogin, accountServer);
        if (!bindResult.valid) {
          await client.query("COMMIT");
          return { valid: false, reason: bindResult.reason, license: rowToLicense(license) };
        }
      } else {
        const active = binding.rows[0];
        if (Number(active.account_login) !== Number(accountLogin) || active.account_server !== accountServer) {
          await client.query("COMMIT");
          return { valid: false, reason: "account_not_allowed", license: rowToLicense(license) };
        }
      }

      const updated = await client.query(
        "UPDATE xau_licenses SET last_seen_at = NOW(), latest_snapshot = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        [license.id, JSON.stringify(snapshot || {})]
      );
      await client.query("COMMIT");
      return {
        valid: true,
        reason: "ok",
        license: rowToLicense(updated.rows[0])
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async auditWithClient(client, licenseId, action, actor, detail) {
    await client.query(
      "INSERT INTO xau_license_audit_log (license_id, action, actor, detail) VALUES ($1,$2,$3,$4)",
      [licenseId, action, actor, JSON.stringify(detail || {})]
    );
  }

  assertSubscriptionMatches(license, request) {
    if (
      license.product_id !== request.productId
      || license.sku !== request.sku
      || license.plan !== request.plan
      || license.paypal_plan_id !== request.paypalPlanId
    ) {
      throw conflict("subscription_payload_conflict", "subscription payload does not match original license.");
    }
  }

  async insertSubscriptionPaymentWithClient(client, licenseId, request, paymentStatus) {
    await client.query(
      `INSERT INTO xau_subscription_payments (
        license_id, paypal_sale_id, paypal_subscription_id, event_id, amount, currency,
        payment_status, paid_at, period_start, period_end
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        licenseId,
        request.paypalSaleId,
        request.paypalSubscriptionId,
        request.paypalEventId,
        request.amount,
        request.currency,
        paymentStatus,
        request.paidAt,
        request.periodStart,
        request.periodEnd
      ]
    );
  }

  subscriptionStatusUpdate(request) {
    if (request.status === "PAYMENT_FAILED") {
      return {
        status: "PAYMENT_FAILED",
        graceUntil: new Date(new Date(request.eventTime).getTime() + 72 * 60 * 60 * 1000).toISOString(),
        cancelledAt: null,
        suspendedAt: null,
        manualReviewReason: null
      };
    }
    if (request.status === "CANCELLED") {
      return {
        status: "CANCELLED",
        graceUntil: null,
        cancelledAt: request.eventTime,
        suspendedAt: null,
        manualReviewReason: null
      };
    }
    if (request.status === "REFUNDED" || request.status === "REVERSED") {
      return {
        status: "SUSPENDED",
        graceUntil: null,
        cancelledAt: null,
        suspendedAt: request.eventTime,
        manualReviewReason: request.reason || request.status
      };
    }
    if (request.status === "SUSPENDED") {
      return {
        status: "SUSPENDED",
        graceUntil: null,
        cancelledAt: null,
        suspendedAt: request.eventTime,
        manualReviewReason: request.reason || "SUSPENDED"
      };
    }
    return {
      status: request.status,
      graceUntil: null,
      cancelledAt: null,
      suspendedAt: null,
      manualReviewReason: null
    };
  }

  subscriptionValidity(license, now) {
    if (!license.paypal_subscription_id || license.plan === "permanent") {
      return { valid: true };
    }
    const status = license.subscription_status || "ACTIVE";
    const paidThrough = license.current_period_end ? new Date(license.current_period_end) : null;
    const graceUntil = license.grace_until ? new Date(license.grace_until) : null;
    const paidValid = paidThrough && paidThrough.getTime() > now.getTime();
    const graceValid = graceUntil && graceUntil.getTime() > now.getTime();

    if (status === "ACTIVE") {
      return paidValid ? { valid: true } : { valid: false, reason: "license_expired" };
    }
    if (status === "PAYMENT_FAILED") {
      return (paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_payment_failed" };
    }
    if (status === "CANCELLED") {
      return paidValid ? { valid: true } : { valid: false, reason: "subscription_cancelled" };
    }
    if (status === "EXPIRED") {
      return { valid: false, reason: "license_expired" };
    }
    if (status === "SUSPENDED") {
      return license.manual_review_reason
        ? { valid: false, reason: "subscription_suspended" }
        : ((paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_suspended" });
    }
    return { valid: false, reason: "subscription_suspended" };
  }

  async tryFirstBindWithClient(client, license, accountLogin, accountServer) {
    await client.query("SAVEPOINT xau_first_bind");
    try {
      await client.query(
        "INSERT INTO xau_license_bindings (license_id, account_login, account_server) VALUES ($1,$2,$3)",
        [license.id, accountLogin, accountServer]
      );
      await this.auditWithClient(client, license.id, "first_bind", "bot", {
        accountLogin,
        accountServer
      });
      await client.query("RELEASE SAVEPOINT xau_first_bind");
      return { valid: true };
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT xau_first_bind");
      await client.query("RELEASE SAVEPOINT xau_first_bind");
      if (error.code !== "23505") {
        throw error;
      }

      const existing = await client.query(
        "SELECT * FROM xau_license_bindings WHERE license_id = $1 AND active = TRUE FOR UPDATE",
        [license.id]
      );
      if (existing.rowCount === 0) {
        throw error;
      }
      const active = existing.rows[0];
      if (Number(active.account_login) === Number(accountLogin) && active.account_server === accountServer) {
        return { valid: true };
      }
      return { valid: false, reason: "account_not_allowed" };
    }
  }
}
