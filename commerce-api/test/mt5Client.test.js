import assert from "node:assert/strict";
import test from "node:test";

process.env.MT5_LICENSE_API_URL = "http://mt5-license-api:8000";
process.env.MT5_LICENSE_API_TOKEN = "test-mt5-token";

const {
    acknowledgeMt5SubscriptionDelivery,
    activateMt5Subscription,
    recoverMt5SubscriptionDelivery,
    renewMt5Subscription,
    requestMt5License,
    updateMt5SubscriptionStatus
} = await import("../src/clients/mt5LicenseApiClient.js");

function product() {
    return {
        productId: "aurora-mt5-monthly",
        licenseProductId: "AURORA-MT5-AI",
        plan: "monthly",
        paymentMode: "subscription"
    };
}

function subscriptionPayload() {
    return {
        product: product(),
        customer: {
            email: "customer@example.com",
            name: "Customer"
        },
        paypal: {
            subscriptionId: "SUB-MT5-1",
            planId: "P-MT5-M",
            saleId: "SALE-MT5-1",
            eventId: "WH-MT5-1",
            amount: "19.90",
            currency: "USD",
            paidAt: "2026-07-17T00:00:00.000Z",
            periodStart: "2026-07-17T00:00:00.000Z",
            periodEnd: "2026-08-17T00:00:00.000Z"
        }
    };
}

test("MT5 subscription activate maps Commerce payload to M1.2 contract", async () => {
    let request = null;
    globalThis.fetch = async (url, options) => {
        request = {
            url,
            headers: options.headers,
            body: JSON.parse(options.body)
        };
        return {
            ok: true,
            text: async () => JSON.stringify({ licenseKey: "AURORA-MT5-KEY" })
        };
    };

    await activateMt5Subscription(subscriptionPayload());

    assert.equal(request.url, "http://mt5-license-api:8000/api/v1/subscriptions/activate");
    assert.equal(request.headers.authorization, "Bearer test-mt5-token");
    assert.equal(request.body.productId, "AURORA-MT5-AI");
    assert.equal(request.body.sku, "aurora-mt5-monthly");
    assert.equal(request.body.plan, "monthly");
    assert.equal(request.body.paypal.subscriptionId, "SUB-MT5-1");
    assert.equal(request.body.paypal.saleId, "SALE-MT5-1");
    assert.equal(request.body.paypal.status, "COMPLETED");
    assert.equal(request.body.paypal.periodEnd, "2026-08-17T00:00:00.000Z");
});

test("MT5 subscription lifecycle endpoints are independent from XAU paths", async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({
            url,
            body: JSON.parse(options.body)
        });
        return {
            ok: true,
            text: async () => JSON.stringify({ status: "ok" })
        };
    };

    await renewMt5Subscription(subscriptionPayload());
    await updateMt5SubscriptionStatus({
        product: product(),
        paypal: {
            subscriptionId: "SUB-MT5-1",
            eventId: "WH-STATUS",
            status: "CANCELLED",
            eventTime: "2026-08-01T00:00:00.000Z",
            reason: "customer_cancelled"
        }
    });
    await recoverMt5SubscriptionDelivery({ paypal: { saleId: "SALE-MT5-1", subscriptionId: "SUB-MT5-1" } });
    await acknowledgeMt5SubscriptionDelivery({ paypal: { saleId: "SALE-MT5-1", subscriptionId: "SUB-MT5-1" } });

    assert.deepEqual(calls.map((call) => call.url), [
        "http://mt5-license-api:8000/api/v1/subscriptions/renew",
        "http://mt5-license-api:8000/api/v1/subscriptions/status",
        "http://mt5-license-api:8000/api/v1/subscriptions/delivery/recover",
        "http://mt5-license-api:8000/api/v1/subscriptions/delivery/ack"
    ]);
    assert.equal(calls[1].body.productId, "AURORA-MT5-AI");
    assert.equal(calls[2].body.paypal.saleId, "SALE-MT5-1");
    assert.equal(calls[3].body.paypal.subscriptionId, "SUB-MT5-1");
});

test("MT5 client surfaces business conflicts and blocks legacy subscription issue", async () => {
    await assert.rejects(
        () => requestMt5License({
            product: product()
        }),
        /subscription lifecycle/
    );

    globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ code: "subscription_not_found" })
    });

    await assert.rejects(
        () => renewMt5Subscription(subscriptionPayload()),
        (error) => error.code === "subscription_not_found" && error.statusCode === 409
    );
});
