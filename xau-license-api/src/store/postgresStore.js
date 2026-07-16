import { readFile } from "node:fs/promises";
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
    const sql = await readFile(join(baseDir, "migrations", "001_init.sql"), "utf8");
    const client = await this.pool.connect();
    let locked = false;
    this.migrationComplete = false;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      locked = true;
      await client.query(sql);
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
      if (license.status !== "active") {
        await client.query("COMMIT");
        return { valid: false, reason: "license_disabled", license: rowToLicense(license) };
      }
      if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
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
