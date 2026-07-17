import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../src/services/subscriptionService.js", import.meta.url), "utf8");
const store = readFileSync(new URL("../src/storage/commerceStore.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/clients/xauLicenseApiClient.js", import.meta.url), "utf8");
const cli = readFileSync(new URL("../src/cli/reconcileSubscriptionDelivery.js", import.meta.url), "utf8");

test("subscription sale records pending Commerce payment before XAU activation", () => {
    const claimIndex = service.indexOf("const paymentRecord = await claimPayment");
    const pendingIndex = service.indexOf("paymentStatus: \"pending_delivery\"");
    const activateIndex = service.indexOf("const license = await activateXauSubscription");
    const saveIndex = service.indexOf("const delivery = await saveInitialSubscriptionDelivery");

    assert.ok(claimIndex > 0);
    assert.ok(pendingIndex > claimIndex);
    assert.ok(activateIndex > pendingIndex);
    assert.ok(saveIndex > activateIndex);
});

test("Commerce saves encrypted delivery before acknowledging XAU raw key", () => {
    const saveIndex = service.indexOf("const delivery = await saveDelivery");
    const ackIndex = service.indexOf("await acknowledgeXauSubscriptionDelivery");
    const emailIndex = service.indexOf("const emailResult = await sendLicenseEmail");

    assert.ok(saveIndex > 0);
    assert.ok(ackIndex > saveIndex);
    assert.ok(emailIndex > ackIndex);
});

test("failed subscription webhook events can be retried but processed events stay idempotent", () => {
    assert.match(store, /processing_status = 'processing'/);
    assert.match(store, /processing_status = 'failed'/);
    assert.doesNotMatch(store, /processing_status = 'processed'\s+RETURNING/);
});

test("ACTIVATED status sync is deferred until a subscription payment exists", () => {
    const paymentCheck = service.indexOf("hasSubscriptionPaymentForSubscription(subscriptionId)");
    const statusSync = service.indexOf("await updateXauSubscriptionStatus");

    assert.ok(paymentCheck > 0);
    assert.ok(statusSync > paymentCheck);
});

test("XAU recovery and ack endpoints are internal client calls", () => {
    assert.match(client, /recover-key/);
    assert.match(client, /ack-delivery/);
    assert.match(client, /config\.xauLicenseApiToken/);
});

test("reconciliation CLI is dry-run unless --confirm is supplied", () => {
    assert.match(cli, /mode: "dry-run"/);
    assert.match(cli, /hasFlag\("--confirm"\)/);
    assert.match(cli, /processSubscriptionSale/);
});
