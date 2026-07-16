import { config } from "../config.js";
import { postJson } from "../utils/http.js";

function subscriptionUrl(path) {
    if (!config.xauLicenseApiUrl) {
        return "";
    }

    const url = new URL(config.xauLicenseApiUrl);
    url.pathname = `/api/v1/subscriptions/${path}`;
    return url.toString();
}

export async function requestXauLicense(payload) {
    const product = payload.product;
    const captureId = payload.paypal.captureId;

    return postJson(config.xauLicenseApiUrl, {
        productId: product.licenseProductId,
        sku: product.productId,
        plan: product.plan,
        customer: payload.customer,
        paypal: {
            orderId: payload.paypal.orderId || "",
            captureId,
            eventId: payload.paypal.eventId || "",
            status: "Completed"
        },
        idempotencyKey: captureId
    }, config.xauLicenseApiToken);
}

function buildSubscriptionPayload({ product, customer, paypal }) {
    return {
        productId: product.licenseProductId,
        sku: product.productId,
        plan: product.plan,
        customer,
        paypal,
        idempotencyKey: paypal.saleId || paypal.eventId || paypal.subscriptionId
    };
}

export async function activateXauSubscription(payload) {
    return postJson(subscriptionUrl("activate"), buildSubscriptionPayload(payload), config.xauLicenseApiToken);
}

export async function renewXauSubscription(payload) {
    return postJson(subscriptionUrl("renew"), buildSubscriptionPayload(payload), config.xauLicenseApiToken);
}

export async function updateXauSubscriptionStatus({ product, paypal }) {
    return postJson(subscriptionUrl("status"), {
        productId: product.licenseProductId,
        paypal
    }, config.xauLicenseApiToken);
}
