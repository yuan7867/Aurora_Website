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
    const emailIndex = service.indexOf("const emailResult = await deliverLicenseEmail");

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

test("first subscription sale activation is based on completed payment history not ACTIVE status", () => {
    const historyIndex = service.indexOf("hasCompletedSubscriptionPaymentForSubscription(subscriptionId)");
    const renewBranch = service.indexOf("if (hasCompletedPaymentHistory && existingDelivery?.encryptedLicenseKey)");
    const renewIndex = service.indexOf("const license = await renewXauSubscription", renewBranch);
    const activateIndex = service.indexOf("const license = await activateXauSubscription");

    assert.ok(historyIndex > 0);
    assert.ok(renewBranch > historyIndex);
    assert.ok(renewIndex > renewBranch);
    assert.ok(activateIndex > renewIndex);
    assert.doesNotMatch(service, /subscriptionStatus\s*===\s*["']ACTIVE["']/);
});

test("PayPal webhook customer details cannot overwrite checkout delivery email", () => {
    assert.match(store, /customer_email = COALESCE\(NULLIF\(commerce_subscriptions\.customer_email, ''\), EXCLUDED\.customer_email\)/);
    assert.match(store, /customer_name = COALESCE\(NULLIF\(commerce_subscriptions\.customer_name, ''\), EXCLUDED\.customer_name\)/);
    assert.match(service, /preserveStoredCustomer\(existingSubscription, extractCustomer\(details\)\)/);
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
    assert.match(cli, /confirmRetryableBeforeLicenseIssue/);
    assert.match(cli, /retryable_before_license_issue/);
    assert.match(cli, /--mark-manual-recovery/);
});

test("manual recovery storage is idempotent and does not require encrypted key material", () => {
    assert.match(store, /saveManualRecoveryDelivery/);
    assert.match(store, /ON CONFLICT \(payment_id\) DO UPDATE/);
    assert.match(store, /encrypted_license_key,\s*\n\s*encryption_iv,\s*encryption_auth_tag/);
    assert.match(store, /NULL,NULL,NULL/);
});

test("recovered webhook event is finalized only after durable delivery and XAU completion", () => {
    assert.match(store, /export async function finalizeRecoveredSubscriptionEvent/);
    assert.match(store, /SELECT \* FROM commerce_subscription_events WHERE paypal_event_id = \$1 FOR UPDATE/);
    assert.match(store, /event\.rows\[0\]\.processing_status !== "failed"/);
    assert.match(store, /p\.payment_status = 'COMPLETED'/);
    assert.match(store, /p\.delivery_status = 'delivered'/);
    assert.match(store, /d\.encrypted_license_key IS NOT NULL/);
    assert.match(store, /JOIN xau_licenses xl ON xl\.paypal_subscription_id = \$2/);
    assert.match(store, /JOIN xau_subscription_payments xp ON xp\.paypal_sale_id = \$1/);
    assert.match(store, /pending\.acknowledged_at IS NULL/);
});

test("recovered webhook event clears error while preserving retry count and writes safe audit metadata", () => {
    assert.match(store, /SET processing_status = 'processed',\s+processed_at = NOW\(\),\s+last_error = NULL/);
    assert.doesNotMatch(store, /retry_count\s*=\s*0/);
    assert.match(store, /subscription_webhook_recovered/);
    assert.match(store, /eventId,\s*\n\s*subscriptionId,\s*\n\s*saleId,\s*\n\s*classification/);
    assert.doesNotMatch(store, /licenseKey|Authorization|raw payload|access_token/);
});

test("reconciliation confirm marks event processed only after recovery finalizer succeeds", () => {
    const retryableBranch = cli.indexOf("audit.classification !== \"retryable_before_license_issue\"");
    const processIndex = cli.indexOf("dependencies.processSale || processSubscriptionSale", retryableBranch);
    const finalizeIndex = cli.indexOf("dependencies.finalizeRecoveredEvent || finalizeRecoveredSubscriptionEvent", processIndex);
    const rejectedIndex = cli.indexOf("reason: finalization.reason || \"recovery_not_complete\"", finalizeIndex);
    const successIndex = cli.indexOf("eventFinalization: finalization", rejectedIndex);

    assert.ok(retryableBranch > 0);
    assert.ok(processIndex > 0);
    assert.ok(finalizeIndex > processIndex);
    assert.ok(rejectedIndex > finalizeIndex);
    assert.ok(successIndex > rejectedIndex);
});

test("healthy complete reconciliation performs webhook-only finalization", () => {
    const branchIndex = cli.indexOf("audit.classification === \"healthy_complete\"");
    const finalizeIndex = cli.indexOf("dependencies.finalizeRecoveredEvent || finalizeRecoveredSubscriptionEvent", branchIndex);
    const retryableIndex = cli.indexOf("audit.classification !== \"retryable_before_license_issue\"", branchIndex);
    const processIndex = cli.indexOf("dependencies.processSale || processSubscriptionSale", branchIndex);

    assert.ok(branchIndex > 0);
    assert.ok(finalizeIndex > branchIndex);
    assert.ok(retryableIndex > finalizeIndex);
    assert.ok(processIndex > retryableIndex);
    assert.match(cli, /status: finalization\.alreadyProcessed \? "already_finalized" : "webhook_finalized"/);
});
