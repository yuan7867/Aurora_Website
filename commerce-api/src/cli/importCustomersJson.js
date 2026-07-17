import { closeCommerceStore, migrateCommerceStore } from "../storage/commerceStore.js";
import { fileURLToPath } from "node:url";
import {
    backupLegacyCustomerStore,
    closeCustomerStore,
    getCustomer,
    normalizeEmail,
    readLegacyCustomerStore,
    saveCustomer
} from "../storage/customerStore.js";

function hasFlag(flag, argv = process.argv.slice(2)) {
    return argv.includes(flag);
}

function summarizeCustomer(customer) {
    return {
        email: normalizeEmail(customer.email),
        name: customer.name || "Aurora Customer",
        passwordHash: customer.passwordHash || null,
        status: customer.status || "activation_required",
        emailVerified: Boolean(customer.emailVerified),
        products: Array.isArray(customer.products) ? customer.products : [],
        licenses: Array.isArray(customer.licenses) ? customer.licenses : [],
        downloads: Array.isArray(customer.downloads) ? customer.downloads : [],
        orders: Array.isArray(customer.orders) ? customer.orders : []
    };
}

export async function auditCustomersJson({ confirm = false } = {}) {
    await migrateCommerceStore();
    const legacy = await readLegacyCustomerStore();
    const customers = Object.values(legacy.customers || {}).map(summarizeCustomer);
    const seenEmails = new Set();
    const duplicateEmails = new Set();
    const conflicts = [];
    let existingCount = 0;
    let importableCount = 0;

    for (const customer of customers) {
        if (!customer.email) {
            conflicts.push({ code: "missing_email" });
            continue;
        }
        if (seenEmails.has(customer.email)) {
            duplicateEmails.add(customer.email);
            continue;
        }
        seenEmails.add(customer.email);

        const existing = await getCustomer(customer.email);
        if (existing) {
            existingCount += 1;
            if (
                existing.passwordHash
                && customer.passwordHash
                && existing.passwordHash !== customer.passwordHash
            ) {
                conflicts.push({ code: "password_hash_conflict" });
                continue;
            }
        }
        importableCount += 1;
    }

    if (duplicateEmails.size > 0) {
        conflicts.push({ code: "duplicate_normalized_email", count: duplicateEmails.size });
    }

    const summary = {
        mode: confirm ? "confirm" : "dry_run",
        legacyCount: customers.length,
        uniqueEmails: seenEmails.size,
        existingCount,
        importableCount,
        conflictCount: conflicts.length,
        conflicts: conflicts.reduce((counts, conflict) => {
            counts[conflict.code] = (counts[conflict.code] || 0) + (conflict.count || 1);
            return counts;
        }, {})
    };

    if (conflicts.length > 0) {
        return {
            status: "conflict",
            summary
        };
    }

    if (!confirm) {
        return {
            status: "dry_run",
            summary
        };
    }

    const backup = await backupLegacyCustomerStore();
    let imported = 0;
    for (const customer of customers) {
        await saveCustomer(customer);
        imported += 1;
    }

    return {
        status: "imported",
        summary: {
            ...summary,
            imported,
            backupPath: backup.backupPath
        }
    };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    try {
        const result = await auditCustomersJson({ confirm: hasFlag("--confirm") });
        console.log(JSON.stringify(result, null, 2));
        if (result.status === "conflict") {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await closeCustomerStore().catch(() => {});
        await closeCommerceStore().catch(() => {});
    }
}
