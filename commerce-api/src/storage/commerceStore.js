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
        emailStatus: row.email_status,
        resendEmailId: row.resend_email_id,
        emailSentAt: row.email_sent_at,
        emailError: row.email_error,
        emailAttempts: row.email_attempts
    };
}

function rowToEmailDelivery(row) {
    if (!row) {
        return null;
    }

    return {
        delivery: rowToDelivery({
            id: row.delivery_id,
            payment_id: row.delivery_payment_id,
            customer_email: row.delivery_customer_email,
            license_product_id: row.license_product_id,
            plan: row.delivery_plan,
            encrypted_license_key: row.encrypted_license_key,
            encryption_iv: row.encryption_iv,
            encryption_auth_tag: row.encryption_auth_tag,
            download_url: row.download_url,
            email_status: row.email_status,
            resend_email_id: row.resend_email_id,
            email_sent_at: row.email_sent_at,
            email_error: row.email_error,
            email_attempts: row.email_attempts
        }),
        payment: rowToPayment({
            id: row.payment_id,
            paypal_capture_id: row.paypal_capture_id,
            paypal_order_id: row.paypal_order_id,
            paypal_event_id: row.paypal_event_id,
            sku: row.sku,
            amount: row.amount,
            currency: row.currency,
            payment_status: row.payment_status,
            delivery_status: row.delivery_status,
            customer_email: row.payment_customer_email,
            customer_name: row.customer_name
        }),
        subscription: row.paypal_subscription_id
            ? {
                paypalSubscriptionId: row.paypal_subscription_id,
                currentPeriodEnd: row.current_period_end,
                subscriptionStatus: row.subscription_status
            }
            : null
    };
}

const EMAIL_DELIVERY_SELECT = `
    SELECT
        d.id AS delivery_id,
        d.payment_id AS delivery_payment_id,
        d.customer_email AS delivery_customer_email,
        d.license_product_id,
        d.plan AS delivery_plan,
        d.encrypted_license_key,
        d.encryption_iv,
        d.encryption_auth_tag,
        d.download_url,
        d.email_status,
        d.resend_email_id,
        d.email_sent_at,
        d.email_error,
        d.email_attempts,
        p.id AS payment_id,
        p.paypal_capture_id,
        p.paypal_order_id,
        p.paypal_event_id,
        p.sku,
        p.amount,
        p.currency,
        p.payment_status,
        p.delivery_status,
        p.customer_email AS payment_customer_email,
        p.customer_name,
        s.paypal_subscription_id,
        s.current_period_end,
        s.subscription_status
    FROM commerce_deliveries d
    JOIN commerce_payments p ON p.id = d.payment_id
    LEFT JOIN commerce_subscriptions s ON s.paypal_subscription_id = p.paypal_order_id
`;

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
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
                paypal.deliveryStatus || "claimed",
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

export async function saveManualRecoveryDelivery({ paymentId, customerEmail, product, downloadUrl, reason }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const delivery = await client.query(
            `INSERT INTO commerce_deliveries (
                payment_id, customer_email, license_product_id, plan, encrypted_license_key,
                encryption_iv, encryption_auth_tag, download_url, email_status
            ) VALUES ($1,$2,$3,$4,NULL,NULL,NULL,$5,'manual_recovery')
            ON CONFLICT (payment_id) DO UPDATE SET
                email_status = 'manual_recovery',
                updated_at = NOW()
            RETURNING *`,
            [
                paymentId,
                String(customerEmail || "").toLowerCase(),
                product.licenseProductId,
                product.plan,
                downloadUrl || ""
            ]
        );
        await client.query(
            "UPDATE commerce_payments SET delivery_status = 'manual_recovery', updated_at = NOW() WHERE id = $1",
            [paymentId]
        );
        await auditWithClient(client, paymentId, "manual_recovery_delivery_placeholder", {
            reason,
            sku: product.productId,
            licenseProductId: product.licenseProductId
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

export async function getEmailDeliveryAudit(deliveryId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `${EMAIL_DELIVERY_SELECT}
         WHERE d.id = $1`,
        [deliveryId]
    );
    return rowToEmailDelivery(result.rows[0]);
}

export async function claimEmailDelivery(deliveryId) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `${EMAIL_DELIVERY_SELECT}
             WHERE d.id = $1
             FOR UPDATE OF d`,
            [deliveryId]
        );
        const row = result.rows[0];
        if (!row) {
            await client.query("COMMIT");
            return {
                status: "not_found"
            };
        }
        if (row.email_status === "sent") {
            await client.query("COMMIT");
            return {
                status: "already_sent",
                ...rowToEmailDelivery(row)
            };
        }
        if (!row.encrypted_license_key) {
            await client.query("COMMIT");
            return {
                status: "not_sendable",
                reason: "encrypted_license_missing",
                ...rowToEmailDelivery(row)
            };
        }
        const claimed = await client.query(
            `UPDATE commerce_deliveries
             SET email_status = 'sending',
                 email_attempts = email_attempts + 1,
                 email_last_attempt_at = NOW(),
                 email_error = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [deliveryId]
        );
        await client.query(
            "INSERT INTO commerce_audit_log (payment_id, action, metadata) VALUES ($1,$2,$3)",
            [row.payment_id, "email_delivery_claimed", JSON.stringify({ deliveryId })]
        );
        await client.query("COMMIT");
        return {
            status: "claimed",
            delivery: rowToDelivery(claimed.rows[0]),
            payment: rowToEmailDelivery(row).payment,
            subscription: row.paypal_subscription_id
                ? {
                    paypalSubscriptionId: row.paypal_subscription_id,
                    currentPeriodEnd: row.current_period_end,
                    subscriptionStatus: row.subscription_status
                }
                : null
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function markEmailDeliverySent({ deliveryId, resendEmailId }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `UPDATE commerce_deliveries
         SET email_status = 'sent',
             resend_email_id = $2,
             email_sent_at = NOW(),
             email_error = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [deliveryId, resendEmailId || ""]
    );
    return rowToDelivery(result.rows[0]);
}

export async function markEmailDeliveryFailed({ deliveryId, status, errorSummary }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `UPDATE commerce_deliveries
         SET email_status = $2,
             email_error = $3,
             updated_at = NOW()
         WHERE id = $1
           AND email_status <> 'sent'
         RETURNING *`,
        [deliveryId, status, String(errorSummary || "email_delivery_failed").slice(0, 500)]
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
            customer_email = COALESCE(NULLIF(commerce_subscriptions.customer_email, ''), EXCLUDED.customer_email),
            customer_name = COALESCE(NULLIF(commerce_subscriptions.customer_name, ''), EXCLUDED.customer_name),
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
            customer_email = COALESCE(NULLIF(commerce_subscriptions.customer_email, ''), EXCLUDED.customer_email),
            customer_name = COALESCE(NULLIF(commerce_subscriptions.customer_name, ''), EXCLUDED.customer_name),
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

export async function updateSubscriptionCustomerForRecovery({ subscriptionId, customer }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `UPDATE commerce_subscriptions
         SET customer_email = COALESCE(NULLIF($2, ''), customer_email),
             customer_name = COALESCE(NULLIF($3, ''), customer_name),
             updated_at = NOW()
         WHERE paypal_subscription_id = $1
         RETURNING *`,
        [
            subscriptionId,
            String(customer.email || "").toLowerCase(),
            customer.name || ""
        ]
    );
    return rowToSubscription(result.rows[0]);
}

export async function claimSubscriptionEvent({ eventId, subscriptionId, eventType, occurredAt }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const insert = await client.query(
            `INSERT INTO commerce_subscription_events (
                paypal_event_id, paypal_subscription_id, event_type, occurred_at, processing_status
            ) VALUES ($1,$2,$3,$4,'processing')
            ON CONFLICT (paypal_event_id) DO NOTHING
            RETURNING *`,
            [eventId, subscriptionId || "", eventType, occurredAt || null]
        );

        if (insert.rowCount === 1) {
            await client.query("COMMIT");
            return true;
        }

        const retry = await client.query(
            `UPDATE commerce_subscription_events
             SET processing_status = 'processing',
                 processed_at = NULL,
                 retry_count = retry_count + 1,
                 last_error = NULL
             WHERE paypal_event_id = $1
               AND processing_status = 'failed'
             RETURNING *`,
            [eventId]
        );
        await client.query("COMMIT");
        return retry.rowCount === 1;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function finishSubscriptionEvent({ eventId, status, error }) {
    await migrateCommerceStore();

    await getPool().query(
        "UPDATE commerce_subscription_events SET processing_status = $2, processed_at = NOW(), last_error = $3 WHERE paypal_event_id = $1",
        [eventId, status, error ? String(error.message || error).slice(0, 500) : null]
    );
}

export async function finalizeRecoveredSubscriptionEvent({ eventId, subscriptionId, saleId, classification }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const event = await client.query(
            "SELECT * FROM commerce_subscription_events WHERE paypal_event_id = $1 FOR UPDATE",
            [eventId]
        );

        if (event.rowCount === 0) {
            await client.query("COMMIT");
            return {
                finalized: false,
                reason: "event_not_found"
            };
        }

        if (event.rows[0].processing_status === "processed") {
            await client.query("COMMIT");
            return {
                finalized: true,
                alreadyProcessed: true
            };
        }

        const ready = await client.query(
            `SELECT p.id
             FROM commerce_payments p
             JOIN commerce_deliveries d ON d.payment_id = p.id
             JOIN xau_licenses xl ON xl.paypal_subscription_id = $2
             JOIN xau_subscription_payments xp ON xp.paypal_sale_id = $1
             WHERE p.paypal_capture_id = $1
               AND p.paypal_order_id = $2
               AND p.payment_status = 'COMPLETED'
               AND p.delivery_status = 'delivered'
               AND d.encrypted_license_key IS NOT NULL
               AND NOT EXISTS (
                   SELECT 1
                   FROM xau_pending_license_deliveries pending
                   WHERE pending.paypal_sale_id = $1
                     AND pending.paypal_subscription_id = $2
                     AND pending.acknowledged_at IS NULL
               )
             LIMIT 1`,
            [saleId, subscriptionId]
        );

        if (ready.rowCount === 0) {
            await client.query("COMMIT");
            return {
                finalized: false,
                reason: "recovery_not_complete"
            };
        }

        await client.query(
            `UPDATE commerce_subscription_events
             SET processing_status = 'processed',
                 processed_at = NOW(),
                 last_error = NULL
             WHERE paypal_event_id = $1`,
            [eventId]
        );
        await auditWithClient(client, ready.rows[0].id, "subscription_webhook_recovered", {
            eventId,
            subscriptionId,
            saleId,
            classification
        });
        await client.query("COMMIT");
        return {
            finalized: true,
            alreadyProcessed: false
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function recordSubscriptionPayment({ saleId, subscriptionId, eventId, amount, currency, paymentStatus, paidAt }) {
    await migrateCommerceStore();

    const result = await getPool().query(
        `INSERT INTO commerce_subscription_payments (
            paypal_sale_id, paypal_subscription_id, paypal_event_id, amount, currency, payment_status, paid_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (paypal_sale_id) DO UPDATE SET
            paypal_event_id = EXCLUDED.paypal_event_id,
            payment_status = EXCLUDED.payment_status,
            paid_at = COALESCE(EXCLUDED.paid_at, commerce_subscription_payments.paid_at)
        RETURNING *`,
        [saleId, subscriptionId, eventId, amount, currency, paymentStatus, paidAt || null]
    );

    return result.rowCount === 1;
}

export async function updatePaymentDeliveryStatus({ captureId, status }) {
    await migrateCommerceStore();

    await getPool().query(
        "UPDATE commerce_payments SET delivery_status = $2, updated_at = NOW() WHERE paypal_capture_id = $1",
        [captureId, status]
    );
}

export async function finalizePaymentDelivery({ captureId }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const existing = await client.query(
            `SELECT p.*
             FROM commerce_payments p
             JOIN commerce_deliveries d ON d.payment_id = p.id
             WHERE p.paypal_capture_id = $1
               AND d.encrypted_license_key IS NOT NULL
             FOR UPDATE`,
            [captureId]
        );

        if (existing.rowCount === 0) {
            await client.query("COMMIT");
            return {
                finalized: false,
                reason: "encrypted_delivery_missing"
            };
        }

        const payment = existing.rows[0];
        if (payment.payment_status === "COMPLETED" && payment.delivery_status === "delivered") {
            await client.query("COMMIT");
            return {
                finalized: true,
                alreadyFinalized: true,
                payment: rowToPayment(payment)
            };
        }

        const updated = await client.query(
            `UPDATE commerce_payments
             SET payment_status = 'COMPLETED',
                 delivery_status = 'delivered',
                 updated_at = NOW()
             WHERE id = $1
               AND payment_status = 'PENDING_DELIVERY'
             RETURNING *`,
            [payment.id]
        );

        if (updated.rowCount === 0) {
            await client.query("COMMIT");
            return {
                finalized: false,
                reason: "payment_not_pending_delivery",
                payment: rowToPayment(payment)
            };
        }

        await auditWithClient(client, payment.id, "payment_delivery_finalized", {
            paypalCaptureId: captureId
        });
        await client.query("COMMIT");
        return {
            finalized: true,
            alreadyFinalized: false,
            payment: rowToPayment(updated.rows[0])
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function hasSubscriptionPayment(saleId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT id FROM commerce_subscription_payments WHERE paypal_sale_id = $1",
        [saleId]
    );
    return result.rowCount > 0;
}

export async function getSubscriptionPayment(saleId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT * FROM commerce_subscription_payments WHERE paypal_sale_id = $1",
        [saleId]
    );
    return result.rows[0] || null;
}

export async function hasSubscriptionPaymentForSubscription(subscriptionId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT id FROM commerce_subscription_payments WHERE paypal_subscription_id = $1 LIMIT 1",
        [subscriptionId]
    );
    return result.rowCount > 0;
}

export async function hasCompletedSubscriptionPaymentForSubscription(subscriptionId) {
    await migrateCommerceStore();

    const result = await getPool().query(
        "SELECT id FROM commerce_subscription_payments WHERE paypal_subscription_id = $1 AND UPPER(payment_status) = 'COMPLETED' LIMIT 1",
        [subscriptionId]
    );
    return result.rowCount > 0;
}

export async function getSubscriptionReconciliationState({ subscriptionId, saleId, eventId }) {
    await migrateCommerceStore();

    const client = await getPool().connect();
    try {
        const subscription = await client.query("SELECT * FROM commerce_subscriptions WHERE paypal_subscription_id = $1", [subscriptionId]);
        const subscriptionPayment = await client.query("SELECT * FROM commerce_subscription_payments WHERE paypal_sale_id = $1", [saleId]);
        const payment = await client.query(
            `SELECT p.*, d.id AS delivery_id, d.encrypted_license_key, d.email_status, d.license_product_id, d.plan
             FROM commerce_payments p
             LEFT JOIN commerce_deliveries d ON d.payment_id = p.id
             WHERE p.paypal_capture_id = $1`,
            [saleId]
        );
        const event = await client.query("SELECT * FROM commerce_subscription_events WHERE paypal_event_id = $1", [eventId || ""]);
        const xauLicense = await client.query("SELECT * FROM xau_licenses WHERE paypal_subscription_id = $1", [subscriptionId]);
        const xauPayment = await client.query("SELECT * FROM xau_subscription_payments WHERE paypal_sale_id = $1", [saleId]);
        const xauPending = await client.query(
            "SELECT * FROM xau_pending_license_deliveries WHERE paypal_sale_id = $1 AND paypal_subscription_id = $2",
            [saleId, subscriptionId]
        );

        const paymentRow = payment.rows[0] || null;
        return {
            commerce: {
                subscription: rowToSubscription(subscription.rows[0]),
                subscriptionPayment: subscriptionPayment.rows[0] || null,
                payment: rowToPayment(paymentRow),
                delivery: paymentRow
                    ? rowToDelivery({
                        id: paymentRow.delivery_id,
                        payment_id: paymentRow.id,
                        customer_email: paymentRow.customer_email,
                        license_product_id: paymentRow.license_product_id,
                        plan: paymentRow.plan,
                        encrypted_license_key: paymentRow.encrypted_license_key,
                        encryption_iv: null,
                        encryption_auth_tag: null,
                        download_url: null,
                        email_status: paymentRow.email_status
                    })
                    : null,
                event: event.rows[0] || null
            },
            xau: {
                license: xauLicense.rows[0] || null,
                subscriptionPayment: xauPayment.rows[0] || null,
                pendingDelivery: xauPending.rows[0] || null
            }
        };
    } finally {
        client.release();
    }
}
