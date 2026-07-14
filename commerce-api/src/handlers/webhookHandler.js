import { verifyPayPalWebhook } from "../clients/paypalClient.js";
import { completePurchase } from "../services/purchaseService.js";

const supportedPayPalEvents = new Set([
    "CHECKOUT.ORDER.APPROVED",
    "PAYMENT.CAPTURE.COMPLETED"
]);

function readWebhookPurchase(resource) {
    const purchaseUnit = resource?.purchase_units?.[0] || {};
    const capture = purchaseUnit?.payments?.captures?.[0] || resource;

    return {
        productId: resource?.custom_id
            || purchaseUnit.custom_id
            || capture.custom_id
            || resource?.invoice_id
            || resource?.sku
            || "",
        orderId: resource?.id || resource?.parent_payment || capture?.supplementary_data?.related_ids?.order_id || "",
        captureId: capture?.id || resource?.id || "",
        payerEmail: resource?.payer?.email_address
            || resource?.payer?.payer_info?.email
            || resource?.payee?.email_address
            || "",
        payerName: resource?.payer?.name?.given_name
            ? `${resource.payer.name.given_name} ${resource.payer.name.surname || ""}`.trim()
            : "Aurora Customer"
    };
}

export async function handlePayPalWebhook({ headers, rawBody, event }) {
    if (!event?.id || !event?.event_type) {
        throw new Error("Invalid PayPal webhook payload.");
    }

    await verifyPayPalWebhook({ headers, rawBody, event });

    if (!supportedPayPalEvents.has(event.event_type)) {
        return {
            status: "ignored",
            eventType: event.event_type
        };
    }

    const purchase = readWebhookPurchase(event.resource || {});

    if (!purchase.payerEmail) {
        throw new Error("PayPal webhook does not include customer email.");
    }

    if (!purchase.productId) {
        throw new Error("PayPal webhook does not include product id.");
    }

    const result = await completePurchase({
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
            status: "Completed"
        }
    });

    return {
        status: "completed",
        productId: purchase.productId,
        paypalEventId: event.id,
        result
    };
}
