import { createHash } from "node:crypto";

import pg from "pg";

import { config } from "../config.js";
import { migrateCommerceStore } from "./commerceStore.js";

const { Pool } = pg;

let pool = null;

function getPool() {
    if (!pool) {
        if (!config.databaseUrl) {
            throw new Error("DATABASE_URL is required for Download Center storage.");
        }
        pool = new Pool({
            connectionString: config.databaseUrl
        });
    }
    return pool;
}

export function hashDownloadToken(token) {
    return createHash("sha256").update(String(token || "")).digest("hex");
}

function rowToEntitlement(row) {
    if (!row) {
        return null;
    }

    return {
        customerEmail: row.customer_email,
        productId: row.sku,
        licenseProductId: row.license_product_id,
        plan: row.plan,
        paymentStatus: row.payment_status,
        deliveryStatus: row.delivery_status,
        licenseStatus: row.license_status,
        subscriptionStatus: row.subscription_status,
        expiresAt: row.expires_at,
        deliveryId: row.delivery_id
    };
}

function rowToToken(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        tokenHash: row.token_hash,
        customerEmail: row.customer_email,
        productId: row.product_id,
        licenseProductId: row.license_product_id,
        version: row.version,
        r2ObjectKey: row.r2_object_key,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at
    };
}

export async function getDownloadEntitlements(email) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `SELECT DISTINCT ON (d.license_product_id)
            d.id AS delivery_id,
            d.customer_email,
            p.sku,
            d.license_product_id,
            d.plan,
            p.payment_status,
            p.delivery_status,
            CASE
                WHEN p.payment_status = 'COMPLETED'
                 AND p.delivery_status = 'delivered'
                 AND d.encrypted_license_key IS NOT NULL
                 AND (
                    s.paypal_subscription_id IS NULL
                    OR (
                        UPPER(s.subscription_status) IN ('ACTIVE', 'APPROVED')
                        AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
                    )
                 )
                THEN 'ACTIVE'
                ELSE 'INACTIVE'
            END AS license_status,
            s.subscription_status,
            s.current_period_end AS expires_at
         FROM commerce_deliveries d
         JOIN commerce_payments p ON p.id = d.payment_id
         LEFT JOIN commerce_subscriptions s ON s.paypal_subscription_id = p.paypal_order_id
         WHERE d.customer_email = $1
           AND d.license_product_id IN ('AURORA-MT5-AI', 'AURORA-XAU-AI')
         ORDER BY d.license_product_id, d.id DESC`,
        [String(email || "").toLowerCase()]
    );

    return result.rows.map(rowToEntitlement);
}

export async function saveDownloadToken({ token, customerEmail, product, expiresAt }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_download_tokens (
            token_hash, customer_email, product_id, license_product_id, version, r2_object_key, expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *`,
        [
            hashDownloadToken(token),
            String(customerEmail || "").toLowerCase(),
            product.id,
            product.licenseProductId,
            product.version,
            product.r2ObjectKey,
            expiresAt
        ]
    );

    return rowToToken(result.rows[0]);
}

export async function consumeDownloadToken({ token, ipAddress, userAgent }) {
    await migrateCommerceStore();

    const tokenHash = hashDownloadToken(token);
    const client = await getPool().connect();

    try {
        await client.query("BEGIN");
        const result = await client.query(
            "SELECT * FROM commerce_download_tokens WHERE token_hash = $1 FOR UPDATE",
            [tokenHash]
        );
        const row = result.rows[0];

        if (!row) {
            await client.query(
                `INSERT INTO commerce_download_history (
                    customer_email, product_id, license_product_id, version, token_hash, license_status, ip_address, user_agent, result
                ) VALUES ('unknown','unknown','AURORA-MT5-AI','unknown',$1,'UNKNOWN',$2,$3,'not_found')`,
                [tokenHash, ipAddress || "", userAgent || ""]
            );
            await client.query("COMMIT");
            return { status: "not_found" };
        }

        if (row.consumed_at) {
            await insertHistoryWithClient(client, row, {
                ipAddress,
                userAgent,
                result: "already_used",
                licenseStatus: "ACTIVE"
            });
            await client.query("COMMIT");
            return { status: "already_used", token: rowToToken(row) };
        }

        if (new Date(row.expires_at).getTime() <= Date.now()) {
            await insertHistoryWithClient(client, row, {
                ipAddress,
                userAgent,
                result: "expired",
                licenseStatus: "ACTIVE"
            });
            await client.query("COMMIT");
            return { status: "expired", token: rowToToken(row) };
        }

        const updated = await client.query(
            `UPDATE commerce_download_tokens
             SET consumed_at = NOW(),
                 consumed_ip = $2,
                 updated_at = NOW()
             WHERE token_hash = $1
             RETURNING *`,
            [tokenHash, ipAddress || ""]
        );
        await insertHistoryWithClient(client, updated.rows[0], {
            ipAddress,
            userAgent,
            result: "downloaded",
            licenseStatus: "ACTIVE"
        });
        await client.query("COMMIT");
        return { status: "downloaded", token: rowToToken(updated.rows[0]) };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function recordDownloadHistory({ customerEmail, product, tokenHash, licenseStatus, ipAddress, userAgent, result }) {
    await migrateCommerceStore();

    await getPool().query(
        `INSERT INTO commerce_download_history (
            customer_email, product_id, license_product_id, version, token_hash, license_status, ip_address, user_agent, result
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            String(customerEmail || "unknown").toLowerCase(),
            product?.id || "unknown",
            product?.licenseProductId || "AURORA-MT5-AI",
            product?.version || "unknown",
            tokenHash || null,
            licenseStatus || "UNKNOWN",
            ipAddress || "",
            userAgent || "",
            result
        ]
    );
}

export async function getDownloadHistory(email) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `SELECT product_id, license_product_id, version, license_status, ip_address, result, created_at
         FROM commerce_download_history
         WHERE customer_email = $1
         ORDER BY created_at DESC
         LIMIT 25`,
        [String(email || "").toLowerCase()]
    );

    return result.rows.map((row) => ({
        productId: row.product_id,
        licenseProductId: row.license_product_id,
        version: row.version,
        licenseStatus: row.license_status,
        ipAddress: row.ip_address,
        result: row.result,
        createdAt: row.created_at
    }));
}

async function insertHistoryWithClient(client, row, { ipAddress, userAgent, result, licenseStatus }) {
    await client.query(
        `INSERT INTO commerce_download_history (
            customer_email, product_id, license_product_id, version, token_hash, license_status, ip_address, user_agent, result
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            row.customer_email,
            row.product_id,
            row.license_product_id,
            row.version,
            row.token_hash,
            licenseStatus,
            ipAddress || "",
            userAgent || "",
            result
        ]
    );
}
