import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { config } from "../config.js";

const { Pool } = pg;

let pool = null;
let migrationComplete = false;

function getPool() {
    if (!pool) {
        if (!config.databaseUrl) {
            throw new Error("DATABASE_URL is required for Commerce delivery storage.");
        }
        pool = new Pool({
            connectionString: config.databaseUrl
        });
    }
    return pool;
}

function rowToPayment(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        paypalCaptureId: row.paypal_capture_id,
        paypalOrderId: row.paypal_order_id,
        paypalEventId: row.paypal_event_id,
        sku: row.sku,
        amount: row.amount,
        currency: row.currency,
        paymentStatus: row.payment_status,
        deliveryStatus: row.delivery_status,
        customerEmail: row.customer_email,
        customerName: row.customer_name
    };
}

function rowToDelivery(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        paymentId: row.payment_id,
        customerEmail: row.customer_email,
        licenseProductId: row.license_product_id,
        plan: row.plan,
        encryptedLicenseKey: row.encrypted_license_key,
        encryptionIv: row.encryption_iv,
        encryptionAuthTag: row.encryption_auth_tag,
        downloadUrl: row.download_url,
        emailStatus: row.email_status
    };
}

function rowToSubscription(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        paypalSubscriptionId: row.paypal_subscription_id,
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        sku: row.sku,
        licenseProductId: row.license_product_id,
        plan: row.plan,
        paypalPlanId: row.paypal_plan_id,
        subscriptionStatus: row.subscription_status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        graceUntil: row.grace_until
    };
}

export async function migrateCommerceStore() {
    if (migrationComplete) {
        return;
    }

    const baseDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
    const migrationsDir = join(baseDir, "migrations");
    const files = (await readdir(migrationsDir))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    for (const file of files) {
        const sql = await readFile(join(migrationsDir, file), "utf8");
        await getPool().query(sql);
    }
    migrationComplete = true;
}

export async function closeCommerceStore() {
    if (pool) {
        await pool.end();
        pool = null;
    }
    migrationComplete = false;
}

export async function claimPayment({ product, customer, paypal }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const insert = await client.query(
            `INSERT INTO commerce_payments (
                paypal_capture_id, paypal_order_id, paypal_event_id, sku, amount, currency,
                payment_status, delivery_status, customer_email, customer_name
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'claimed',$8,$9)
            ON CONFLICT (paypal_capture_id) DO NOTHING
            RETURNING *`,
            [
                paypal.captureId,
                paypal.orderId || "",
                paypal.eventId || "",
                product.productId,
                product.price,
                product.currency,
                paypal.status,
                String(customer.email || "").toLowerCase(),
                customer.name || "Aurora Customer"
            ]
        );

        if (insert.rowCount === 1) {
            const payment = rowToPayment(insert.rows[0]);
            await auditWithClient(client, payment.id, "payment_claimed", {
                sku: product.productId,
                paypalCaptureId: paypal.captureId,
                amount: product.price,
                currency: product.currency
            });
            await client.query("COMMIT");
            return {
                status: "claimed",
                payment
            };
        }

        const existing = await client.query(
            `SELECT p.*, d.id AS delivery_id, d.encrypted_license_key, d.encryption_iv, d.encryption_auth_tag,
                    d.download_url, d.email_status, d.license_product_id, d.plan
             FROM commerce_payments p
             LEFT JOIN commerce_deliveries d ON d.payment_id = p.id
             WHERE p.paypal_capture_id = $1
             FOR UPDATE`,
            [paypal.captureId]
        );
        const row = existing.rows[0];
        if (row && (row.sku !== product.productId || String(row.amount) !== String(product.price) || row.currency !== product.currency)) {
            const error = new Error("PayPal capture id conflicts with an existing Commerce payment.");
            error.code = "PAYMENT_CAPTURE_CONFLICT";
            error.statusCode = 409;
            throw error;
        }
        await client.query("COMMIT");

        return {
            status: row.delivery_status,
            payment: rowToPayment(row),
            delivery: rowToDelivery({
                id: row.delivery_id,
                payment_id: row.id,
                customer_email: row.customer_email,
                license_product_id: row.license_product_id,
                plan: row.plan,
                encrypted_license_key: row.encrypted_license_key,
                encryption_iv: row.encryption_iv,
                encryption_auth_tag: row.encryption_auth_tag,
                download_url: row.download_url,
                email_status: row.email_status
            })
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function saveDelivery({ paymentId, customerEmail, product, encryptedLicense, downloadUrl, emailResult }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const delivery = await client.query(
            `INSERT INTO commerce_deliveries (
                payment_id, customer_email, license_product_id, plan, encrypted_license_key,
                encryption_iv, encryption_auth_tag, download_url, email_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (payment_id) DO UPDATE SET
                email_status = EXCLUDED.email_status,
                updated_at = NOW()
            RETURNING *`,
            [
                paymentId,
                String(customerEmail || "").toLowerCase(),
                product.licenseProductId,
                product.plan,
                encryptedLicense.encryptedLicenseKey,
                encryptedLicense.encryptionIv,
                encryptedLicense.encryptionAuthTag,
                downloadUrl,
                emailResult?.status || "unknown"
            ]
        );
        await client.query(
            "UPDATE commerce_payments SET delivery_status = 'delivered', updated_at = NOW() WHERE id = $1",
            [paymentId]
        );
        await auditWithClient(client, paymentId, "delivery_saved", {
            sku: product.productId,
            licenseProductId: product.licenseProductId,
            plan: product.plan,
            emailStatus: emailResult?.status || "unknown"
        });
        await client.query("COMMIT");
        return rowToDelivery(delivery.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function markManualRecovery(paymentId, reason) {
    await migrateCommerceStore();

    await getPool().query(
        "UPDATE commerce_payments SET delivery_status = 'manual_recovery', updated_at = NOW() WHERE id = $1",
        [paymentId]
    );
    await getPool().query(
        "INSERT INTO commerce_audit_log (payment_id, action, metadata) VALUES ($1,$2,$3)",
        [paymentId, "manual_recovery", JSON.stringify({ reason })]
    );
}

export async function getDeliveryForCustomer({ email, productId }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `SELECT d.*
         FROM commerce_deliveries d
         JOIN commerce_payments p ON p.id = d.payment_id
         WHERE d.customer_email = $1 AND p.sku = $2
         ORDER BY d.created_at DESC
         LIMIT 1`,
        [String(email || "").toLowerCase(), productId]
    );
    return rowToDelivery(result.rows[0]);
}

async function auditWithClient(client, paymentId, action, metadata) {
    await client.query(
        "INSERT INTO commerce_audit_log (payment_id, action, metadata) VALUES ($1,$2,$3)",
        [paymentId, action, JSON.stringify(metadata || {})]
    );
}

export async function recordSubscriptionCreated({ product, customer, subscription, paypalPlanId }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_subscriptions (
            paypal_subscription_id, customer_email, customer_name, sku, license_product_id,
            plan, paypal_plan_id, subscription_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (paypal_subscription_id) DO UPDATE SET
            customer_email = EXCLUDED.customer_email,
            customer_name = EXCLUDED.customer_name,
            sku = EXCLUDED.sku,
            license_product_id = EXCLUDED.license_product_id,
            plan = EXCLUDED.plan,
            paypal_plan_id = EXCLUDED.paypal_plan_id,
            subscription_status = EXCLUDED.subscription_status,
            updated_at = NOW()
        RETURNING *`,
        [
            subscription.id,
            String(customer.email || "").toLowerCase(),
            customer.name || "Aurora Customer",
            product.productId,
            product.licenseProductId,
            product.plan,
            paypalPlanId,
            subscription.status || "APPROVAL_PENDING"
        ]
    );
    return rowToSubscription(result.rows[0]);
}

export async function getSubscriptionByPayPalId(subscriptionId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT * FROM commerce_subscriptions WHERE paypal_subscription_id = $1",
        [subscriptionId]
    );
    return rowToSubscription(result.rows[0]);
}

export async function getSubscriptionForCustomer({ subscriptionId, email }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT * FROM commerce_subscriptions WHERE paypal_subscription_id = $1 AND customer_email = $2",
        [subscriptionId, String(email || "").toLowerCase()]
    );
    return rowToSubscription(result.rows[0]);
}

export async function upsertSubscriptionFromPayPal({ product, customer, subscriptionId, paypalPlanId, status, periodStart, periodEnd, graceUntil }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_subscriptions (
            paypal_subscription_id, customer_email, customer_name, sku, license_product_id,
            plan, paypal_plan_id, subscription_status, current_period_start, current_period_end, grace_until
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (paypal_subscription_id) DO UPDATE SET
            customer_email = EXCLUDED.customer_email,
            customer_name = EXCLUDED.customer_name,
            sku = EXCLUDED.sku,
            license_product_id = EXCLUDED.license_product_id,
            plan = EXCLUDED.plan,
            paypal_plan_id = EXCLUDED.paypal_plan_id,
            subscription_status = EXCLUDED.subscription_status,
            current_period_start = COALESCE(EXCLUDED.current_period_start, commerce_subscriptions.current_period_start),
            current_period_end = COALESCE(EXCLUDED.current_period_end, commerce_subscriptions.current_period_end),
            grace_until = EXCLUDED.grace_until,
            updated_at = NOW()
        RETURNING *`,
        [
            subscriptionId,
            String(customer.email || "").toLowerCase(),
            customer.name || "Aurora Customer",
            product.productId,
            product.licenseProductId,
            product.plan,
            paypalPlanId,
            status,
            periodStart || null,
            periodEnd || null,
            graceUntil || null
        ]
    );
    return rowToSubscription(result.rows[0]);
}

export async function claimSubscriptionEvent({ eventId, subscriptionId, eventType, occurredAt }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_subscription_events (
            paypal_event_id, paypal_subscription_id, event_type, occurred_at, processing_status
        ) VALUES ($1,$2,$3,$4,'processing')
        ON CONFLICT (paypal_event_id) DO NOTHING
        RETURNING *`,
        [eventId, subscriptionId || "", eventType, occurredAt || null]
    );

    return result.rowCount === 1;
}

export async function finishSubscriptionEvent({ eventId, status }) {
    await migrateCommerceStore();

    await getPool().query(
        "UPDATE commerce_subscription_events SET processing_status = $2, processed_at = NOW() WHERE paypal_event_id = $1",
        [eventId, status]
    );
}

export async function recordSubscriptionPayment({ saleId, subscriptionId, eventId, amount, currency, paymentStatus, paidAt }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_subscription_payments (
            paypal_sale_id, paypal_subscription_id, paypal_event_id, amount, currency, payment_status, paid_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (paypal_sale_id) DO NOTHING
        RETURNING *`,
        [saleId, subscriptionId, eventId, amount, currency, paymentStatus, paidAt || null]
    );

    return result.rowCount === 1;
}

export async function hasSubscriptionPayment(saleId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT id FROM commerce_subscription_payments WHERE paypal_sale_id = $1",
        [saleId]
    );
    return result.rowCount > 0;
}
