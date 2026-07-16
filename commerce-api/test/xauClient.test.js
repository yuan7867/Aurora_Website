import assert from "node:assert/strict";
import test from "node:test";

process.env.XAU_LICENSE_API_URL = "http://xau-license-api:8000/api/v1/licenses/issue";
process.env.XAU_LICENSE_API_TOKEN = "test-token";

const { activateXauSubscription, requestXauLicense } = await import("../src/clients/xauLicenseApiClient.js");

test("XAU license client sends server-derived product, sku, plan and capture idempotency", async () => {
    let request = null;
    globalThis.fetch = async (url, options) => {
        request = {
            url,
            headers: options.headers,
            body: JSON.parse(options.body)
        };
        return {
            ok: true,
            text: async () => JSON.stringify({ licenseKey: "AURORA-XAU-KEY" })
        };
    };

    await requestXauLicense({
        product: {
            productId: "aurora-xau-monthly",
            licenseProductId: "AURORA-XAU-AI",
            plan: "monthly"
        },
        customer: {
            email: "customer@example.com"
        },
        paypal: {
            orderId: "ORDER-1",
            captureId: "CAPTURE-1",
            eventId: "WH-1"
        }
    });

    assert.equal(request.url, "http://xau-license-api:8000/api/v1/licenses/issue");
    assert.equal(request.headers.authorization, "Bearer test-token");
    assert.equal(request.body.productId, "AURORA-XAU-AI");
    assert.equal(request.body.sku, "aurora-xau-monthly");
    assert.equal(request.body.plan, "monthly");
    assert.equal(request.body.idempotencyKey, "CAPTURE-1");
    assert.equal(request.body.paypal.captureId, "CAPTURE-1");
    assert.equal(request.body.paypal.status, "Completed");
});

test("XAU subscription activate client calls subscription lifecycle endpoint", async () => {
    let request = null;
    globalThis.fetch = async (url, options) => {
        request = {
            url,
            headers: options.headers,
            body: JSON.parse(options.body)
        };
        return {
            ok: true,
            text: async () => JSON.stringify({ licenseKey: "AURORA-XAU-SUB-KEY" })
        };
    };

    await activateXauSubscription({
        product: {
            productId: "aurora-xau-monthly",
            licenseProductId: "AURORA-XAU-AI",
            plan: "monthly"
        },
        customer: {
            email: "customer@example.com"
        },
        paypal: {
            subscriptionId: "SUB-1",
            planId: "P-XAU-M",
            saleId: "SALE-1",
            eventId: "WH-1",
            amount: "19.90",
            currency: "USD",
            periodStart: "2026-07-17T00:00:00.000Z",
            periodEnd: "2026-08-17T00:00:00.000Z"
        }
    });

    assert.equal(request.url, "http://xau-license-api:8000/api/v1/subscriptions/activate");
    assert.equal(request.body.idempotencyKey, "SALE-1");
    assert.equal(request.body.paypal.subscriptionId, "SUB-1");
});
