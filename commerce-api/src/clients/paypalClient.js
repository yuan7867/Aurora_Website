import { config, getPayPalBaseUrl } from "../config.js";

let cachedToken = null;

function assertPayPalConfigured() {
    if (!config.paypalClientId || !config.paypalClientSecret) {
        throw new Error("PayPal client credentials are not configured.");
    }
}

async function getAccessToken() {
    assertPayPalConfigured();

    if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
        return cachedToken.accessToken;
    }

    const credentials = Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64");
    const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            authorization: `Basic ${credentials}`,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error_description || "PayPal authentication failed.");
    }

    cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + Number(data.expires_in || 300) * 1000
    };

    return cachedToken.accessToken;
}

function makeRequestId(prefix, value) {
    return `${prefix}-${String(value || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export async function createPayPalOrder({ product, customer }) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
                {
                    custom_id: product.productId,
                    invoice_id: `AURORA-${product.productId}-${Date.now()}`,
                    description: product.name,
                    amount: {
                        currency_code: product.currency,
                        value: product.price
                    }
                }
            ],
            payer: customer?.email
                ? {
                    email_address: customer.email
                }
                : undefined,
            application_context: {
                brand_name: "Aurora HY",
                landing_page: "LOGIN",
                user_action: "PAY_NOW",
                return_url: `${config.websiteBaseUrl}/paypal-success?product=${encodeURIComponent(product.productId)}`,
                cancel_url: `${config.websiteBaseUrl}/checkout?sku=${encodeURIComponent(product.productId)}&payment=failed`
            }
        })
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "PayPal order creation failed.");
    }

    return data;
}

export async function capturePayPalOrder(orderId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
        }
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "PayPal capture failed.");
    }

    return data;
}

export async function createPayPalSubscription({ product, customer, planId }) {
    const accessToken = await getAccessToken();
    const requestId = makeRequestId("aurora-subscription", `${product.productId}-${customer?.email || "customer"}`);
    const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/subscriptions`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
            "paypal-request-id": requestId
        },
        body: JSON.stringify({
            plan_id: planId,
            custom_id: product.productId,
            subscriber: customer?.email
                ? {
                    email_address: customer.email,
                    name: customer.name
                        ? {
                            given_name: customer.name
                        }
                        : undefined
                }
                : undefined,
            application_context: {
                brand_name: "Aurora HY",
                locale: "en-US",
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                return_url: `${config.websiteBaseUrl}/paypal-success?subscription=1&product=${encodeURIComponent(product.productId)}`,
                cancel_url: `${config.websiteBaseUrl}/checkout?sku=${encodeURIComponent(product.productId)}&payment=failed`
            }
        })
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "PayPal subscription creation failed.");
    }

    return data;
}

export async function getPayPalSubscription(subscriptionId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json"
        }
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "PayPal subscription lookup failed.");
    }

    return data;
}

export async function cancelPayPalSubscription(subscriptionId, reason = "Customer requested cancellation.") {
    const accessToken = await getAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ reason })
    });

    if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "PayPal subscription cancellation failed.");
    }

    return {
        status: "cancelled"
    };
}

export async function verifyPayPalWebhook({ headers, rawBody, event }) {
    if (!config.paypalWebhookId) {
        throw new Error("PayPal webhook id is not configured.");
    }

    const accessToken = await getAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            auth_algo: headers["paypal-auth-algo"],
            cert_url: headers["paypal-cert-url"],
            transmission_id: headers["paypal-transmission-id"],
            transmission_sig: headers["paypal-transmission-sig"],
            transmission_time: headers["paypal-transmission-time"],
            webhook_id: config.paypalWebhookId,
            webhook_event: event || JSON.parse(rawBody)
        })
    });
    const data = await response.json();

    if (!response.ok || data.verification_status !== "SUCCESS") {
        throw new Error("PayPal webhook signature verification failed.");
    }

    return data;
}
