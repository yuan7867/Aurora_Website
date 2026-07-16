import { verifyPayPalWebhook } from "../clients/paypalClient.js";
import { completePurchase } from "../services/purchaseService.js";
import {
    markSubscriptionEvent,
    processSubscriptionSale,
    processSubscriptionStatusEvent
} from "../services/subscriptionService.js";

const supportedPayPalEvents = new Set([
    "CHECKOUT.ORDER.APPROVED",
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.SALE.COMPLETED",
    "BILLING.SUBSCRIPTION.ACTIVATED",
    "BILLING.SUBSCRIPTION.UPDATED",
    "BILLING.SUBSCRIPTION.CANCELLED",
    "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.EXPIRED",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    "PAYMENT.SALE.REFUNDED",
    "PAYMENT.SALE.REVERSED"
]);

function readWebhookPurchase(resource) {
    const purchaseUnit = resource?.purchase_units?.[0] || {};
    const capture = purchaseUnit?.payments?.captures?.[0] || resource;
    const amount = capture?.amount || purchaseUnit?.amount || {};

    return {
        productId: resource?.custom_id
            || purchaseUnit.custom_id
            || capture.custom_id
            || resource?.invoice_id
            || resource?.sku
            || "",
        orderId: capture?.supplementary_data?.related_ids?.order_id
            || resource?.supplementary_data?.related_ids?.order_id
            || resource?.parent_payment
            || "",
        captureId: capture?.id || resource?.id || "",
        status: capture?.status || resource?.status || "",
        amount: amount.value || "",
        currency: amount.currency_code || "",
        customId: resource?.custom_id || purchaseUnit.custom_id || capture.custom_id || "",
        payerEmail: resource?.payer?.email_address
            || resource?.payer?.payer_info?.email
            || resource?.payee?.email_address
            || "",
        payerName: resource?.payer?.name?.given_name
            ? `${resource.payer.name.given_name} ${resource.payer.name.surname || ""}`.trim()
            : "Aurora Customer"
    };
}

export function createPayPalWebhookHandler({
    verifyWebhook,
    complete,
    processSale = processSubscriptionSale,
    processStatus = processSubscriptionStatusEvent,
    markEvent = markSubscriptionEvent
}) {
    return async function handleWebhook({ headers, rawBody, event }) {
        if (!event?.id || !event?.event_type) {
            throw new Error("Invalid PayPal webhook payload.");
        }

        await verifyWebhook({ headers, rawBody, event });

        if (!supportedPayPalEvents.has(event.event_type)) {
            return {
                status: "ignored",
                eventType: event.event_type
            };
        }

        if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
            return {
                status: "approved_recorded",
                eventType: event.event_type,
                paypalEventId: event.id
            };
        }

        if (event.event_type === "PAYMENT.SALE.COMPLETED") {
            return markEvent({
                event,
                handler: () => processSale({ event })
            });
        }

        if (event.event_type.startsWith("BILLING.SUBSCRIPTION.") || event.event_type.startsWith("PAYMENT.SALE.")) {
            const status = mapSubscriptionStatus(event.event_type);
            return markEvent({
                event,
                handler: () => processStatus({ event, status })
            });
        }

        const purchase = readWebhookPurchase(event.resource || {});

        if (!purchase.payerEmail) {
            throw new Error("PayPal webhook does not include customer email.");
        }

        if (!purchase.productId) {
            throw new Error("PayPal webhook does not include product id.");
        }

        const result = await complete({
            productId: purchase.productId,
            customer: {
                email: purchase.payerEmail,
                name: purchase.payerName
            },
            paypal: {
                eventId: event.id,
                eventType: event.event_type,
                orderId: purchase.orderId,
                captureId: purchase.captureId,
                status: purchase.status,
                amount: purchase.amount,
                currency: purchase.currency,
                customId: purchase.customId
            }
        });

        return {
            status: "completed",
            productId: purchase.productId,
            paypalEventId: event.id,
            result
        };
    };
}

function mapSubscriptionStatus(eventType) {
    const statusByEvent = {
        "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
        "BILLING.SUBSCRIPTION.UPDATED": "UPDATED",
        "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
        "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
        "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED",
        "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "PAYMENT_FAILED",
        "PAYMENT.SALE.REFUNDED": "REFUNDED",
        "PAYMENT.SALE.REVERSED": "REVERSED"
    };

    return statusByEvent[eventType] || "UPDATED";
}

export const handlePayPalWebhook = createPayPalWebhookHandler({
    verifyWebhook: verifyPayPalWebhook,
    complete: completePurchase
});
