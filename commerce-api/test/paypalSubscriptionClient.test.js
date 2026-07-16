import assert from "node:assert/strict";
import test from "node:test";

process.env.PAYPAL_CLIENT_ID = "client-id";
process.env.PAYPAL_CLIENT_SECRET = "client-secret";
process.env.PAYPAL_ENVIRONMENT = "sandbox";

const { createPayPalSubscription } = await import("../src/clients/paypalClient.js");

test("PayPal subscription creation uses server-side plan ID and idempotency header", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({
            url,
            headers: options.headers,
            body: options.body && String(options.body).startsWith("{") ? JSON.parse(options.body) : options.body || null
        });

        if (url.endsWith("/v1/oauth2/token")) {
            return {
                ok: true,
                json: async () => ({ access_token: "access-token", expires_in: 300 })
            };
        }

        return {
            ok: true,
            json: async () => ({
                id: "SUB-1",
                status: "APPROVAL_PENDING",
                links: [{ rel: "approve", href: "https://paypal.example/approve" }]
            })
        };
    };

    const subscription = await createPayPalSubscription({
        product: {
            productId: "aurora-xau-monthly",
            name: "Aurora XAU Trader Monthly"
        },
        customer: {
            email: "customer@example.com",
            name: "Customer"
        },
        planId: "P-XAU-MONTHLY"
    });

    const createRequest = requests[1];
    assert.equal(subscription.id, "SUB-1");
    assert.equal(createRequest.url, "https://api-m.sandbox.paypal.com/v1/billing/subscriptions");
    assert.equal(createRequest.headers["paypal-request-id"].startsWith("aurora-subscription-"), true);
    assert.equal(createRequest.body.plan_id, "P-XAU-MONTHLY");
    assert.equal(createRequest.body.custom_id, "aurora-xau-monthly");
    assert.equal(createRequest.body.application_context.user_action, "SUBSCRIBE_NOW");
});
