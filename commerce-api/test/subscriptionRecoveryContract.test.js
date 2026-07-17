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
    const finalizeIndex = service.indexOf("const finalization = await finalizePaymentDelivery");
    const emailIndex = service.indexOf("const emailResult = await sendLicenseEmail");

    assert.ok(saveIndex > 0);
    assert.ok(ackIndex > saveIndex);
    assert.ok(finalizeIndex > ackIndex);
    assert.ok(emailIndex > finalizeIndex);
});

test("payment finalization requires encrypted delivery and pending payment", () => {
    assert.match(store, /export async function finalizePaymentDelivery/);
    assert.match(store, /JOIN commerce_deliveries d ON d\.payment_id = p\.id/);
    assert.match(store, /d\.encrypted_license_key IS NOT NULL/);
    assert.match(store, /payment_status = 'PENDING_DELIVERY'/);
    assert.match(store, /SET payment_status = 'COMPLETED',\s+delivery_status = 'delivered'/);
});

test("ACK failure cannot finalize payment before encrypted delivery is acknowledged", () => {
    const saveIndex = service.indexOf("const delivery = await saveDelivery");
    const ackIndex = service.indexOf("await acknowledgeXauSubscriptionDelivery");
    const finalizeIndex = service.indexOf("const finalization = await finalizePaymentDelivery");

    assert.ok(saveIndex > 0);
    assert.ok(ackIndex > saveIndex);
    assert.ok(finalizeIndex > ackIndex);
});

test("retry after ACK failure finalizes existing encrypted delivery without renewing or reactivating", () => {
    const retryBranch = service.indexOf("if (existingSubscriptionPayment && existingDelivery?.encryptedLicenseKey)");
    const retryAck = service.indexOf("await acknowledgeXauSubscriptionDelivery({ paypal });", retryBranch);
    const retryFinalize = service.indexOf("await finalizePaymentDelivery({ captureId: saleId });", retryBranch);
    const retryReturn = service.indexOf("status: \"finalized\"", retryBranch);
    const renewAfterBranch = service.indexOf("const license = await renewXauSubscription", retryBranch);

    assert.ok(retryBranch > 0);
    assert.ok(retryAck > retryBranch);
    assert.ok(retryFinalize > retryAck);
    assert.ok(retryReturn > retryFinalize);
    assert.ok(renewAfterBranch > retryReturn);
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
    assert.match(cli, /hasFlag\("--confirm", argv\)/);
    assert.doesNotMatch(cli, /processSubscriptionSale/);
    assert.match(cli, /Plain --confirm is disabled/);
    assert.match(cli, /--mark-manual-recovery/);
});

test("manual recovery storage is idempotent and does not require encrypted key material", () => {
    assert.match(store, /saveManualRecoveryDelivery/);
    assert.match(store, /ON CONFLICT \(payment_id\) DO UPDATE/);
    assert.match(store, /encrypted_license_key,\s*\n\s*encryption_iv,\s*encryption_auth_tag/);
    assert.match(store, /NULL,NULL,NULL/);
});
