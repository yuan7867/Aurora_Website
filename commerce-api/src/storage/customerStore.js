import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { config } from "../config.js";

const customersFile = join(config.dataDir, "customers.json");

async function readStore() {
    try {
        const content = await readFile(customersFile, "utf8");
        return JSON.parse(content);
    } catch (error) {
        if (error.code === "ENOENT") {
            return {
                customers: {},
                processedPayments: {}
            };
        }

        throw error;
    }
}

async function writeStore(store) {
    await mkdir(config.dataDir, { recursive: true });
    await writeFile(customersFile, JSON.stringify(store, null, 2));
}

export async function getCustomer(email) {
    const store = await readStore();
    return store.customers[String(email || "").toLowerCase()] || null;
}

export async function saveCustomer(customer) {
    const store = await readStore();
    const email = String(customer.email || "").toLowerCase();

    if (!email) {
        throw new Error("Customer email is required.");
    }

    store.customers[email] = {
        ...(store.customers[email] || {}),
        ...customer,
        email
    };

    await writeStore(store);
    return store.customers[email];
}

export async function hasProcessedPayment(paymentId) {
    const store = await readStore();
    return Boolean(store.processedPayments[paymentId]);
}

export async function savePurchase({ customer, product, paypal, license, downloadLink, emailResult }) {
    const store = await readStore();
    const email = String(customer.email || "").toLowerCase();

    if (!email) {
        throw new Error("Customer email is required.");
    }

    const existingCustomer = store.customers[email] || {
        email,
        name: customer.name || "Aurora Customer",
        status: "activation_required",
        emailVerified: false,
        passwordHash: null,
        activationToken: null,
        resetToken: null,
        products: [],
        licenses: [],
        downloads: [],
        orders: []
    };

    const now = new Date().toISOString();
    const licenseKey = license?.licenseKey || license?.license_key || license?.key || license?.data?.licenseKey || null;

    existingCustomer.name = customer.name || existingCustomer.name;
    existingCustomer.products = upsertById(existingCustomer.products, product.productId, {
        id: product.productId,
        name: product.name,
        status: "Purchased",
        purchasedAt: now
    });
    existingCustomer.licenses = upsertById(existingCustomer.licenses, product.productId, {
        id: product.productId,
        productName: product.name,
        status: licenseKey ? "Issued" : "Pending",
        licenseKey,
        raw: license,
        issuedAt: now
    });
    existingCustomer.downloads = upsertById(existingCustomer.downloads, product.productId, {
        id: product.productId,
        productName: product.name,
        url: downloadLink,
        status: "Ready"
    });
    existingCustomer.orders = upsertById(existingCustomer.orders, paypal.paymentId, {
        id: paypal.paymentId,
        orderId: paypal.orderId,
        captureId: paypal.captureId || null,
        productId: product.productId,
        status: paypal.status,
        createdAt: now,
        email: emailResult
    });

    store.customers[email] = existingCustomer;
    store.processedPayments[paypal.paymentId] = {
        email,
        productId: product.productId,
        processedAt: now
    };

    await writeStore(store);
    return existingCustomer;
}

function upsertById(items, id, nextItem) {
    const filtered = Array.isArray(items) ? items.filter((item) => item.id !== id) : [];
    return [...filtered, nextItem];
}
