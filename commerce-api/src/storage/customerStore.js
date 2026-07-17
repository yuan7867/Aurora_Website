import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pg from "pg";

import { config } from "../config.js";
import { migrateCommerceStore } from "./commerceStore.js";

const { Pool } = pg;
const customersFile = join(config.dataDir, "customers.json");
let pool = null;

function getPool() {
    if (!pool) {
        if (!config.databaseUrl) {
            throw new Error("DATABASE_URL is required for customer identity storage.");
        }
        pool = new Pool({
            connectionString: config.databaseUrl
        });
    }
    return pool;
}

export async function closeCustomerStore() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function hashIdentityToken(token) {
    return createHash("sha256").update(String(token || "")).digest("hex");
}

function normalizeStatus(status) {
    const value = String(status || "").trim();
    if (["active", "verification_required", "activation_required", "disabled"].includes(value)) {
        return value;
    }
    return "activation_required";
}

function rowToCustomer(row, items = {}) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        passwordHash: row.password_hash,
        status: row.status,
        emailVerified: row.email_verified,
        disabledAt: row.disabled_at,
        passwordChangedAt: row.password_changed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        products: items.product || [],
        licenses: items.license || [],
        downloads: items.download || [],
        orders: items.order || []
    };
}

async function readItems(client, customerId) {
    const result = await client.query(
        `SELECT item_type, item_data
         FROM commerce_customer_items
         WHERE customer_id = $1
         ORDER BY created_at ASC`,
        [customerId]
    );
    return result.rows.reduce((items, row) => {
        items[row.item_type] = items[row.item_type] || [];
        items[row.item_type].push(row.item_data);
        return items;
    }, {});
}

async function getCustomerByEmail(client, email, lock = false) {
    const result = await client.query(
        `SELECT *
         FROM commerce_customers
         WHERE email = $1
         ${lock ? "FOR UPDATE" : ""}`,
        [normalizeEmail(email)]
    );
    const row = result.rows[0];
    if (!row) {
        return null;
    }
    return rowToCustomer(row, await readItems(client, row.id));
}

async function auditWithClient(client, customerId, action, metadata = {}) {
    await client.query(
        "INSERT INTO commerce_customer_audit_log (customer_id, action, metadata) VALUES ($1,$2,$3)",
        [customerId || null, action, JSON.stringify(metadata)]
    );
}

async function upsertCustomerWithClient(client, customer) {
    const email = normalizeEmail(customer.email);
    if (!email) {
        throw new Error("Customer email is required.");
    }

    const result = await client.query(
        `INSERT INTO commerce_customers (
            email, name, password_hash, status, email_verified, password_changed_at
        ) VALUES ($1,$2,$3,$4,$5,NOW())
        ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(NULLIF($2, ''), commerce_customers.name),
            password_hash = COALESCE($3, commerce_customers.password_hash),
            status = $4,
            email_verified = $5,
            password_changed_at = CASE
                WHEN $3 IS NOT NULL AND $3 IS DISTINCT FROM commerce_customers.password_hash THEN NOW()
                ELSE commerce_customers.password_changed_at
            END,
            updated_at = NOW()
        RETURNING *`,
        [
            email,
            customer.name || "Aurora Customer",
            customer.passwordHash || null,
            normalizeStatus(customer.status),
            Boolean(customer.emailVerified)
        ]
    );
    return result.rows[0];
}

async function upsertItemWithClient(client, customerId, itemType, itemKey, itemData) {
    if (!itemKey) {
        return;
    }

    await client.query(
        `INSERT INTO commerce_customer_items (customer_id, item_type, item_key, item_data)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (customer_id, item_type, item_key) DO UPDATE SET
             item_data = EXCLUDED.item_data,
             updated_at = NOW()`,
        [customerId, itemType, itemKey, JSON.stringify(itemData || {})]
    );
}

export async function getCustomer(email) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        return await getCustomerByEmail(client, email);
    } finally {
        client.release();
    }
}

export async function saveCustomer(customer) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const row = await upsertCustomerWithClient(client, customer);

        for (const product of customer.products || []) {
            await upsertItemWithClient(client, row.id, "product", product.id, product);
        }
        for (const license of customer.licenses || []) {
            await upsertItemWithClient(client, row.id, "license", license.id, license);
        }
        for (const download of customer.downloads || []) {
            await upsertItemWithClient(client, row.id, "download", download.id, download);
        }
        for (const order of customer.orders || []) {
            await upsertItemWithClient(client, row.id, "order", order.id, order);
        }

        await auditWithClient(client, row.id, "customer_saved", { status: row.status });
        await client.query("COMMIT");
        return rowToCustomer(row, await readItems(client, row.id));
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function createCustomerIfMissing(customer) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const email = normalizeEmail(customer.email);
        const result = await client.query(
            `INSERT INTO commerce_customers (
                email, name, password_hash, status, email_verified, password_changed_at
            ) VALUES ($1,$2,$3,$4,$5,NOW())
            ON CONFLICT (email) DO NOTHING
            RETURNING *`,
            [
                email,
                customer.name || "Aurora Customer",
                customer.passwordHash || null,
                normalizeStatus(customer.status),
                Boolean(customer.emailVerified)
            ]
        );

        if (result.rowCount !== 1) {
            const error = new Error("Customer already exists.");
            error.statusCode = 409;
            throw error;
        }

        await auditWithClient(client, result.rows[0].id, "customer_registered", {});
        await client.query("COMMIT");
        return rowToCustomer(result.rows[0], {});
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function createCustomerToken({ email, purpose, token, expiresAt }) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const customer = await getCustomerByEmail(client, email, true);
        if (!customer) {
            throw new Error("Customer not found for token creation.");
        }
        await client.query(
            `UPDATE commerce_customer_tokens
             SET used_at = COALESCE(used_at, NOW()), updated_at = NOW()
             WHERE customer_id = $1 AND purpose = $2 AND used_at IS NULL`,
            [customer.id, purpose]
        );
        await client.query(
            `INSERT INTO commerce_customer_tokens (customer_id, purpose, token_hash, expires_at)
             VALUES ($1,$2,$3,$4)`,
            [customer.id, purpose, hashIdentityToken(token), expiresAt]
        );
        await auditWithClient(client, customer.id, "customer_token_created", { purpose });
        await client.query("COMMIT");
        return customer;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function hasActiveCustomerToken({ email, purpose }) {
    await migrateCommerceStore();
    const result = await getPool().query(
        `SELECT 1
         FROM commerce_customer_tokens t
         JOIN commerce_customers c ON c.id = t.customer_id
         WHERE c.email = $1
           AND t.purpose = $2
           AND t.used_at IS NULL
           AND t.expires_at > NOW()
         LIMIT 1`,
        [normalizeEmail(email), purpose]
    );
    return result.rowCount > 0;
}

export async function consumeCustomerToken({ token, purposes }) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT t.*, c.email
             FROM commerce_customer_tokens t
             JOIN commerce_customers c ON c.id = t.customer_id
             WHERE t.token_hash = $1
               AND t.purpose = ANY($2)
             FOR UPDATE OF t, c`,
            [hashIdentityToken(token), purposes]
        );
        const tokenRow = result.rows[0];
        if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
            await client.query("ROLLBACK");
            return null;
        }
        await client.query(
            "UPDATE commerce_customer_tokens SET used_at = NOW(), updated_at = NOW() WHERE id = $1",
            [tokenRow.id]
        );
        await auditWithClient(client, tokenRow.customer_id, "customer_token_consumed", {
            purpose: tokenRow.purpose
        });
        const customer = await getCustomerByEmail(client, tokenRow.email, true);
        await client.query("COMMIT");
        return {
            customer,
            purpose: tokenRow.purpose
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function savePurchase({ customer, product, paypal, license, downloadLink, emailResult }) {
    await migrateCommerceStore();
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        const email = normalizeEmail(customer.email);
        const existing = await getCustomerByEmail(client, email, true);
        const row = await upsertCustomerWithClient(client, {
            ...(existing || {}),
            email,
            name: customer.name || existing?.name || "Aurora Customer",
            passwordHash: existing?.passwordHash || null,
            status: existing?.status || "activation_required",
            emailVerified: Boolean(existing?.emailVerified)
        });
        const now = new Date().toISOString();
        const productItem = {
            id: product.productId,
            name: product.name,
            status: "Purchased",
            purchasedAt: now
        };
        const licenseItem = {
            id: product.productId,
            productName: product.name,
            status: license?.status || "Issued",
            licenseKey: null,
            deliveryStatus: license?.deliveryStatus || "delivered",
            licenseProductId: product.licenseProductId,
            plan: product.plan,
            issuedAt: now
        };
        const downloadItem = {
            id: product.productId,
            productName: product.name,
            url: downloadLink,
            status: "Ready"
        };
        const orderItem = {
            id: paypal.paymentId,
            orderId: paypal.orderId,
            captureId: paypal.captureId || null,
            productId: product.productId,
            status: paypal.status,
            createdAt: now,
            email: {
                status: emailResult?.status || "unknown"
            }
        };

        await upsertItemWithClient(client, row.id, "product", productItem.id, productItem);
        await upsertItemWithClient(client, row.id, "license", licenseItem.id, licenseItem);
        await upsertItemWithClient(client, row.id, "download", downloadItem.id, downloadItem);
        await upsertItemWithClient(client, row.id, "order", orderItem.id, orderItem);
        await auditWithClient(client, row.id, "customer_purchase_saved", {
            productId: product.productId,
            orderId: paypal.orderId || ""
        });
        await client.query("COMMIT");
        return rowToCustomer(row, await readItems(client, row.id));
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function readLegacyCustomerStore() {
    try {
        const content = await readFile(customersFile, "utf8");
        return JSON.parse(content);
    } catch (error) {
        if (error.code === "ENOENT") {
            return {
                customers: {}
            };
        }
        throw error;
    }
}

export async function backupLegacyCustomerStore() {
    const store = await readLegacyCustomerStore();
    await mkdir(config.dataDir, { recursive: true });
    const backupPath = join(config.dataDir, `customers.backup.${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupPath, JSON.stringify(store, null, 2));
    return {
        backupPath,
        count: Object.keys(store.customers || {}).length
    };
}
