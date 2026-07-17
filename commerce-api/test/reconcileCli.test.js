import assert from "node:assert/strict";
import test from "node:test";

import {
    auditSubscriptionDelivery,
    classifyAudit,
    confirmRetryableBeforeLicenseIssue,
    markManualRecovery
} from "../src/cli/reconcileSubscriptionDelivery.js";
import { config } from "../src/config.js";

config.paypalPlanIds["aurora-xau-monthly"] = "PLAN-XAU-MONTHLY";

const product = {
    productId: "aurora-xau-monthly",
    licenseProductId: "AURORA-XAU-AI",
    plan: "monthly"
};

function sale(overrides = {}) {
    return {
        id: "SALE-1",
        state: "COMPLETED",
        billing_agreement_id: "SUB-1",
        amount: {
            total: "19.90",
            currency: "USD"
        },
        create_time: "2026-07-14T13:00:00Z",
        ...overrides
    };
}

function subscription(overrides = {}) {
    return {
        id: "SUB-1",
        status: "ACTIVE",
        plan_id: "PLAN-XAU-MONTHLY",
        custom_id: "aurora-xau-monthly",
        subscriber: {
            email_address: "customer@example.com",
            name: {
                given_name: "Customer"
            }
        },
        ...overrides
    };
}

function state(overrides = {}) {
    return {
        commerce: {
            subscription: null,
            subscriptionPayment: null,
            payment: null,
            delivery: null,
            event: null,
            ...overrides.commerce
        },
        xau: {
            license: null,
            subscriptionPayment: null,
            pendingDelivery: null,
            ...overrides.xau
        }
    };
}

test("dry-run audit reads PayPal and database state without writes", async () => {
    const calls = [];
    const audit = await auditSubscriptionDelivery({
        subscriptionId: "SUB-1",
        saleId: "SALE-1",
        eventId: "EVENT-1",
        dependencies: {
            getSale: async () => {
                calls.push("paypal-sale");
                return sale();
            },
            getSubscription: async () => {
                calls.push("paypal-subscription");
                return subscription();
            },
            getState: async () => {
                calls.push("postgres-state");
                return state();
            }
        }
    });

    assert.deepEqual(calls, ["paypal-sale", "paypal-subscription", "postgres-state"]);
    assert.equal(audit.classification, "retryable_before_license_issue");
});

test("legacy existing license without pending recovery key is classified unrecoverable", () => {
    const result = classifyAudit({
        sale: sale(),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state({
            xau: {
                license: { id: 1 },
                subscriptionPayment: { id: 1 },
                pendingDelivery: null
            }
        })
    });

    assert.equal(result.classification, "legacy_key_unrecoverable");
});

test("invalid sale and subscription mismatch are rejected classifications", () => {
    assert.equal(classifyAudit({
        sale: sale({ state: "PENDING" }),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state()
    }).classification, "invalid_paypal_sale");

    assert.equal(classifyAudit({
        sale: sale({ billing_agreement_id: "OTHER-SUB" }),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state()
    }).classification, "subscription_mismatch");
});

test("healthy recoverable and retryable classifications are explicit", () => {
    assert.equal(classifyAudit({
        sale: sale(),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state({
            commerce: {
                subscriptionPayment: { payment_status: "COMPLETED" },
                delivery: { encryptedLicenseKey: "ciphertext" },
                payment: { deliveryStatus: "delivered" }
            },
            xau: {
                license: { id: 1 },
                subscriptionPayment: { id: 1 }
            }
        })
    }).classification, "healthy_complete");

    assert.equal(classifyAudit({
        sale: sale(),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state({
            xau: {
                license: { id: 1 },
                pendingDelivery: { encrypted_license_key: "ciphertext", acknowledged_at: null }
            }
        })
    }).classification, "recoverable_pending_key");

    assert.equal(classifyAudit({
        sale: sale(),
        subscription: subscription(),
        product,
        requestedSubscriptionId: "SUB-1",
        state: state()
    }).classification, "retryable_before_license_issue");
});

test("manual recovery writes only Commerce records and requires legacy classification", async () => {
    const writes = [];
    const audit = {
        classification: "legacy_key_unrecoverable",
        reason: "existing_license_without_recoverable_raw_key_or_commerce_delivery",
        subscriptionId: "SUB-1",
        saleId: "SALE-1",
        eventId: "EVENT-1"
    };
    const result = await markManualRecovery({
        audit,
        sale: sale(),
        subscription: subscription(),
        dependencies: {
            claimPayment: async () => {
                writes.push("claim-payment");
                return { payment: { id: 101 } };
            },
            upsertSubscription: async () => {
                writes.push("upsert-subscription");
            },
            recordSubscriptionPayment: async () => {
                writes.push("record-subscription-payment");
            },
            saveManualRecoveryDelivery: async ({ paymentId }) => {
                writes.push(`manual-delivery-${paymentId}`);
            }
        }
    });

    assert.equal(result.status, "manual_recovery_marked");
    assert.equal(result.customer_delivery_required, true);
    assert.deepEqual(writes, [
        "claim-payment",
        "upsert-subscription",
        "record-subscription-payment",
        "manual-delivery-101"
    ]);
});

test("manual recovery refuses non-legacy classifications", async () => {
    const result = await markManualRecovery({
        audit: {
            classification: "recoverable_pending_key"
        },
        sale: sale(),
        subscription: subscription(),
        dependencies: {
            claimPayment: async () => {
                throw new Error("should not write");
            }
        }
    });

    assert.equal(result.status, "rejected");
});

test("plain confirm reprocesses only retryable first sale from verified PayPal sale", async () => {
    const calls = [];
    const result = await confirmRetryableBeforeLicenseIssue({
        audit: {
            classification: "retryable_before_license_issue",
            subscriptionId: "SUB-1",
            saleId: "SALE-1",
            eventId: "EVENT-1"
        },
        sale: sale(),
        customerOverride: {
            email: "ceo@example.com",
            name: "CEO"
        },
        dependencies: {
            updateSubscriptionCustomer: async ({ subscriptionId, customer }) => {
                calls.push(["update-customer", subscriptionId, customer.email, customer.name]);
            },
            processSale: async ({ event }) => {
                calls.push(["process-sale", event.event_type, event.resource.id, event.resource.billing_agreement_id]);
                return { status: "activated" };
            }
        }
    });

    assert.equal(result.status, "reprocessed");
    assert.deepEqual(calls, [
        ["update-customer", "SUB-1", "ceo@example.com", "CEO"],
        ["process-sale", "PAYMENT.SALE.COMPLETED", "SALE-1", "SUB-1"]
    ]);
});

test("plain confirm rejects non-retryable state without writes", async () => {
    const result = await confirmRetryableBeforeLicenseIssue({
        audit: {
            classification: "legacy_key_unrecoverable",
            subscriptionId: "SUB-1",
            saleId: "SALE-1",
            eventId: "EVENT-1"
        },
        sale: sale(),
        dependencies: {
            updateSubscriptionCustomer: async () => {
                throw new Error("should not update");
            },
            processSale: async () => {
                throw new Error("should not process");
            }
        }
    });

    assert.equal(result.status, "rejected");
});
