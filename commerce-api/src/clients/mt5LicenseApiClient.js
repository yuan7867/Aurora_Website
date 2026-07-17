import { config } from "../config.js";

function mt5Url(path) {
    if (!config.mt5LicenseApiUrl) {
        return "";
    }

    const url = new URL(config.mt5LicenseApiUrl);
    url.pathname = path;
    return url.toString();
}

async function postMt5Json(path, payload) {
    const url = mt5Url(path);
    if (!url) {
        const error = new Error("MT5 License API URL is not configured.");
        error.code = "MT5_LICENSE_API_NOT_CONFIGURED";
        error.statusCode = 503;
        throw error;
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: `Bearer ${config.mt5LicenseApiToken || ""}`
        },
        body: JSON.stringify(payload)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        const error = new Error(data?.code || `MT5 License API request failed with status ${response.status}`);
        error.code = data?.code || "MT5_LICENSE_API_ERROR";
        error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        throw error;
    }

    return data;
}

function buildSubscriptionPayload({ product, customer, paypal }) {
    return {
        productId: product.licenseProductId,
        sku: product.productId,
        plan: product.plan,
        customer,
        paypal: {
            subscriptionId: paypal.subscriptionId,
            planId: paypal.planId,
            saleId: paypal.saleId,
            eventId: paypal.eventId || "",
            amount: paypal.amount,
            currency: paypal.currency,
            status: "COMPLETED",
            paidAt: paypal.paidAt,
            periodStart: paypal.periodStart,
            periodEnd: paypal.periodEnd
        }
    };
}

export async function requestMt5License(payload) {
    if (payload?.product?.paymentMode === "subscription") {
        const error = new Error("MT5 subscription SKUs must use the subscription lifecycle.");
        error.code = "SUBSCRIPTION_REQUIRED";
        error.statusCode = 410;
        throw error;
    }

    return postMt5Json("/api/v1/licenses/issue", payload);
}

export async function activateMt5Subscription(payload) {
    return postMt5Json("/api/v1/subscriptions/activate", buildSubscriptionPayload(payload));
}

export async function renewMt5Subscription(payload) {
    return postMt5Json("/api/v1/subscriptions/renew", buildSubscriptionPayload(payload));
}

export async function updateMt5SubscriptionStatus({ product, paypal }) {
    return postMt5Json("/api/v1/subscriptions/status", {
        productId: product.licenseProductId,
        paypal
    });
}

export async function recoverMt5SubscriptionDelivery({ paypal }) {
    return postMt5Json("/api/v1/subscriptions/delivery/recover", {
        paypal: {
            saleId: paypal.saleId,
            subscriptionId: paypal.subscriptionId
        }
    });
}

export async function acknowledgeMt5SubscriptionDelivery({ paypal }) {
    return postMt5Json("/api/v1/subscriptions/delivery/ack", {
        paypal: {
            saleId: paypal.saleId,
            subscriptionId: paypal.subscriptionId
        }
    });
}
