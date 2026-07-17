import { fileURLToPath } from "node:url";

import { getPayPalSale, getPayPalSubscription } from "../clients/paypalClient.js";
import { getDownloadLink } from "../dispatchers/downloadDispatcher.js";
import { getProductByPayPalPlanId } from "../products.js";
import {
    claimPayment,
    getSubscriptionReconciliationState,
    recordSubscriptionPayment,
    saveManualRecoveryDelivery,
    updateSubscriptionCustomerForRecovery,
    upsertSubscriptionFromPayPal
} from "../storage/commerceStore.js";
import { config } from "../config.js";
import { processSubscriptionSale } from "../services/subscriptionService.js";

function readArg(name, argv = process.argv) {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] || "" : "";
}

function hasFlag(name, argv = process.argv) {
    return argv.includes(name);
}

function usage() {
    console.log([
        "Usage:",
        "  npm run subscription:reconcile -- --subscription-id SUB --sale-id SALE --event-id EVENT",
        "  npm run subscription:reconcile -- --subscription-id SUB --sale-id SALE --event-id EVENT --customer-email CUSTOMER@EXAMPLE.COM --confirm",
        "  npm run subscription:reconcile -- --subscription-id SUB --sale-id SALE --event-id EVENT --mark-manual-recovery --confirm",
        "",
        "Default mode performs a read-only audit against PayPal, Commerce PostgreSQL, and XAU PostgreSQL.",
        "Plain --confirm is only allowed for retryable_before_license_issue after PayPal sale verification.",
        "Manual recovery does not call XAU activate/renew and does not create a new license."
    ].join("\n"));
}

function saleStatus(sale) {
    return String(sale?.state || sale?.status || "").toUpperCase();
}

function saleSubscriptionId(sale) {
    return sale?.billing_agreement_id || sale?.subscription_id || sale?.billing_agreement?.id || "";
}

function saleAmount(sale) {
    const amount = sale?.amount || {};
    return {
        value: amount.total || amount.value || "",
        currency: amount.currency || amount.currency_code || ""
    };
}

function salePaidAt(sale) {
    return sale?.create_time || sale?.update_time || new Date().toISOString();
}

function subscriptionCustomer(subscription) {
    return {
        email: subscription?.subscriber?.email_address || "",
        name: subscription?.subscriber?.name?.given_name || "Aurora Customer"
    };
}

function summarizeState(state) {
    return {
        commerce: {
            subscription: Boolean(state.commerce.subscription),
            subscriptionPayment: Boolean(state.commerce.subscriptionPayment),
            payment: Boolean(state.commerce.payment),
            paymentStatus: state.commerce.payment?.paymentStatus || "",
            deliveryStatus: state.commerce.payment?.deliveryStatus || "",
            delivery: Boolean(state.commerce.delivery),
            deliveryHasEncryptedKey: Boolean(state.commerce.delivery?.encryptedLicenseKey),
            webhookEvent: Boolean(state.commerce.event),
            webhookStatus: state.commerce.event?.processing_status || ""
        },
        xau: {
            existingLicense: Boolean(state.xau.license),
            subscriptionPayment: Boolean(state.xau.subscriptionPayment),
            pendingRecoverableDelivery: Boolean(
                state.xau.pendingDelivery?.encrypted_license_key
                && !state.xau.pendingDelivery?.acknowledged_at
            ),
            acknowledged: Boolean(state.xau.pendingDelivery?.acknowledged_at)
        }
    };
}

export function classifyAudit({ sale, subscription, product, state, requestedSubscriptionId }) {
    if (saleStatus(sale) !== "COMPLETED") {
        return {
            classification: "invalid_paypal_sale",
            reason: "sale_not_completed"
        };
    }

    if (
        saleSubscriptionId(sale) !== requestedSubscriptionId
        || subscription?.id !== requestedSubscriptionId
        || !product
        || (subscription?.custom_id && subscription.custom_id !== product.productId)
    ) {
        return {
            classification: "subscription_mismatch",
            reason: "sale_or_subscription_does_not_match_product"
        };
    }

    const summary = summarizeState(state);
    const hasCommerceDelivery = summary.commerce.deliveryHasEncryptedKey;
    const hasCompletedCommercePayment = summary.commerce.subscriptionPayment
        && String(state.commerce.subscriptionPayment.payment_status || "").toUpperCase() === "COMPLETED";
    const hasXauLicense = summary.xau.existingLicense;
    const hasXauPayment = summary.xau.subscriptionPayment;
    const hasPendingRecoveryKey = summary.xau.pendingRecoverableDelivery;

    if (hasCommerceDelivery && hasCompletedCommercePayment && hasXauLicense && hasXauPayment) {
        return {
            classification: "healthy_complete",
            reason: "commerce_and_xau_are_complete"
        };
    }

    if (hasXauLicense && hasPendingRecoveryKey && !hasCommerceDelivery) {
        return {
            classification: "recoverable_pending_key",
            reason: "xau_has_ack_pending_recovery_key"
        };
    }

    if (!hasXauLicense && !hasCommerceDelivery) {
        return {
            classification: "retryable_before_license_issue",
            reason: "license_has_not_been_issued"
        };
    }

    if (hasXauLicense && !hasPendingRecoveryKey && !hasCommerceDelivery) {
        return {
            classification: "legacy_key_unrecoverable",
            reason: "existing_license_without_recoverable_raw_key_or_commerce_delivery"
        };
    }

    return {
        classification: "inconsistent_manual_review",
        reason: "state_requires_manual_review"
    };
}

export async function auditSubscriptionDelivery({ subscriptionId, saleId, eventId, dependencies = {} }) {
    const sale = await (dependencies.getSale || getPayPalSale)(saleId);
    const subscription = await (dependencies.getSubscription || getPayPalSubscription)(subscriptionId);
    const product = getProductByPayPalPlanId(subscription?.plan_id, config);
    const state = await (dependencies.getState || getSubscriptionReconciliationState)({
        subscriptionId,
        saleId,
        eventId
    });
    const classification = classifyAudit({
        sale,
        subscription,
        product,
        state,
        requestedSubscriptionId: subscriptionId
    });

    return {
        subscriptionId,
        saleId,
        eventId,
        paypal: {
            saleId: sale?.id || saleId,
            saleStatus: saleStatus(sale),
            saleSubscriptionId: saleSubscriptionId(sale),
            amount: saleAmount(sale).value,
            currency: saleAmount(sale).currency,
            paidAt: salePaidAt(sale),
            subscriptionId: subscription?.id || "",
            subscriptionStatus: subscription?.status || "",
            planId: subscription?.plan_id || "",
            customId: subscription?.custom_id || ""
        },
        product: product
            ? {
                sku: product.productId,
                licenseProductId: product.licenseProductId,
                plan: product.plan
            }
            : null,
        state: summarizeState(state),
        ...classification
    };
}

export async function markManualRecovery({ audit, sale, subscription, dependencies = {} }) {
    if (audit.classification !== "legacy_key_unrecoverable") {
        return {
            status: "rejected",
            classification: audit.classification,
            reason: "manual_recovery_only_allowed_for_legacy_key_unrecoverable"
        };
    }

    const product = getProductByPayPalPlanId(subscription.plan_id, config);
    const customer = subscriptionCustomer(subscription);
    const amount = saleAmount(sale);
    const paypal = {
        captureId: audit.saleId,
        orderId: audit.subscriptionId,
        eventId: audit.eventId,
        status: "COMPLETED",
        deliveryStatus: "manual_recovery"
    };
    const claim = await (dependencies.claimPayment || claimPayment)({
        product,
        customer,
        paypal
    });
    await (dependencies.upsertSubscription || upsertSubscriptionFromPayPal)({
        product,
        customer,
        subscriptionId: audit.subscriptionId,
        paypalPlanId: subscription.plan_id,
        status: subscription.status || "ACTIVE",
        periodStart: salePaidAt(sale),
        periodEnd: subscription?.billing_info?.next_billing_time || null
    });
    await (dependencies.recordSubscriptionPayment || recordSubscriptionPayment)({
        saleId: audit.saleId,
        subscriptionId: audit.subscriptionId,
        eventId: audit.eventId,
        amount: amount.value,
        currency: amount.currency,
        paymentStatus: "manual_recovery",
        paidAt: salePaidAt(sale)
    });
    await (dependencies.saveManualRecoveryDelivery || saveManualRecoveryDelivery)({
        paymentId: claim.payment.id,
        customerEmail: customer.email,
        product,
        downloadUrl: getDownloadLink(product.licenseProductId),
        reason: audit.reason
    });

    return {
        status: "manual_recovery_marked",
        classification: audit.classification,
        customer_delivery_required: true,
        subscriptionId: audit.subscriptionId,
        saleId: audit.saleId
    };
}

function buildVerifiedSaleEvent({ audit, sale }) {
    return {
        id: audit.eventId,
        event_type: "PAYMENT.SALE.COMPLETED",
        create_time: salePaidAt(sale),
        resource: {
            ...sale,
            id: audit.saleId,
            billing_agreement_id: audit.subscriptionId,
            state: sale.state || sale.status || "COMPLETED"
        }
    };
}

export async function confirmRetryableBeforeLicenseIssue({
    audit,
    sale,
    customerOverride = {},
    dependencies = {}
}) {
    if (audit.classification !== "retryable_before_license_issue") {
        return {
            status: "rejected",
            classification: audit.classification,
            reason: "confirm_only_allowed_for_retryable_before_license_issue"
        };
    }

    if (customerOverride.email || customerOverride.name) {
        await (dependencies.updateSubscriptionCustomer || updateSubscriptionCustomerForRecovery)({
            subscriptionId: audit.subscriptionId,
            customer: customerOverride
        });
    }

    const result = await (dependencies.processSale || processSubscriptionSale)({
        event: buildVerifiedSaleEvent({ audit, sale })
    });

    return {
        status: "reprocessed",
        classification: audit.classification,
        subscriptionId: audit.subscriptionId,
        saleId: audit.saleId,
        result
    };
}

export async function run(argv = process.argv) {
    const subscriptionId = readArg("--subscription-id", argv);
    const saleId = readArg("--sale-id", argv);
    const eventId = readArg("--event-id", argv) || `manual-reconcile-${saleId}`;
    const customerEmail = readArg("--customer-email", argv);
    const customerName = readArg("--customer-name", argv);
    const confirm = hasFlag("--confirm", argv);
    const manualRecovery = hasFlag("--mark-manual-recovery", argv);

    if (!subscriptionId || !saleId) {
        usage();
        return 1;
    }

    const sale = await getPayPalSale(saleId);
    const subscription = await getPayPalSubscription(subscriptionId);
    const audit = await auditSubscriptionDelivery({
        subscriptionId,
        saleId,
        eventId,
        dependencies: {
            getSale: async () => sale,
            getSubscription: async () => subscription
        }
    });

    if (!confirm) {
        console.log(JSON.stringify({
            mode: "dry-run",
            writes: false,
            ...audit
        }, null, 2));
        return 0;
    }

    if (!manualRecovery) {
        const result = await confirmRetryableBeforeLicenseIssue({
            audit,
            sale,
            customerOverride: {
                email: customerEmail,
                name: customerName
            }
        });
        console.log(JSON.stringify({
            mode: "confirm",
            ...audit,
            recovery: result
        }, null, 2));
        return result.status === "reprocessed" ? 0 : 2;
    }

    const result = await markManualRecovery({ audit, sale, subscription });
    console.log(JSON.stringify({
        mode: "manual-recovery",
        ...result
    }, null, 2));
    return result.status === "manual_recovery_marked" ? 0 : 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await run();
}
