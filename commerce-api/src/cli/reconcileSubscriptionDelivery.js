import { processSubscriptionSale } from "../services/subscriptionService.js";

function readArg(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] || "" : "";
}

function hasFlag(name) {
    return process.argv.includes(name);
}

function usage() {
    console.log([
        "Usage:",
        "  node src/cli/reconcileSubscriptionDelivery.js --subscription-id SUB --sale-id SALE --event-id EVENT",
        "  node src/cli/reconcileSubscriptionDelivery.js --subscription-id SUB --sale-id SALE --event-id EVENT --confirm",
        "",
        "Default mode is dry-run and does not call PayPal, XAU, or PostgreSQL writes.",
        "Use --confirm only after verifying the PayPal sale is PAYMENT.SALE.COMPLETED."
    ].join("\n"));
}

const subscriptionId = readArg("--subscription-id");
const saleId = readArg("--sale-id");
const eventId = readArg("--event-id") || `manual-reconcile-${saleId}`;
const confirm = hasFlag("--confirm");

if (!subscriptionId || !saleId) {
    usage();
    process.exitCode = 1;
} else if (!confirm) {
    console.log(JSON.stringify({
        mode: "dry-run",
        action: "would_reconcile_subscription_sale",
        subscriptionId,
        saleId,
        eventId,
        safety: [
            "No payment is created.",
            "No license is issued.",
            "No database rows are changed.",
            "Run again with --confirm only after PayPal sale verification."
        ]
    }, null, 2));
} else {
    const result = await processSubscriptionSale({
        event: {
            id: eventId,
            event_type: "PAYMENT.SALE.COMPLETED",
            create_time: new Date().toISOString(),
            resource: {
                id: saleId,
                billing_agreement_id: subscriptionId,
                state: "COMPLETED"
            }
        }
    });
    console.log(JSON.stringify({
        mode: "confirmed",
        status: result.status,
        subscriptionId,
        saleId
    }, null, 2));
}
