import assert from "node:assert/strict";
import test from "node:test";

import { createPayPalWebhookHandler } from "../src/handlers/webhookHandler.js";

test("CHECKOUT.ORDER.APPROVED does not deliver license", async () => {
    let delivered = false;
    const handler = createPayPalWebhookHandler({
        verifyWebhook: async () => ({ ok: true }),
        complete: async () => {
            delivered = true;
        }
    });

    const result = await handler({
        headers: {},
        rawBody: "{}",
        event: {
            id: "WH-APPROVED",
            event_type: "CHECKOUT.ORDER.APPROVED",
            resource: {
                id: "ORDER-1",
                custom_id: "aurora-xau-monthly"
            }
        }
    });

    assert.equal(result.status, "approved_recorded");
    assert.equal(delivered, false);
});

test("PAYMENT.CAPTURE.COMPLETED delivers with captureId as canonical payment id", async () => {
    let purchase = null;
    const handler = createPayPalWebhookHandler({
        verifyWebhook: async () => ({ ok: true }),
        complete: async (payload) => {
            purchase = payload;
            return { status: "completed" };
        }
    });

    const result = await handler({
        headers: {},
        rawBody: "{}",
        event: {
            id: "WH-CAPTURE",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
            resource: {
                id: "CAPTURE-1",
                status: "COMPLETED",
                custom_id: "aurora-xau-yearly",
                amount: {
                    value: "199.00",
                    currency_code: "USD"
                },
                payer: {
                    email_address: "customer@example.com"
                },
                supplementary_data: {
                    related_ids: {
                        order_id: "ORDER-1"
                    }
                }
            }
        }
    });

    assert.equal(result.status, "completed");
    assert.equal(purchase.productId, "aurora-xau-yearly");
    assert.equal(purchase.paypal.captureId, "CAPTURE-1");
    assert.equal(purchase.paypal.orderId, "ORDER-1");
    assert.equal(purchase.paypal.amount, "199.00");
    assert.equal(purchase.paypal.currency, "USD");
});
