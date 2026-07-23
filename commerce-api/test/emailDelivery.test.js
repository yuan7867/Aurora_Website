import assert from "node:assert/strict";
import test from "node:test";

import { config } from "../src/config.js";
import {
    isRetryableEmailError,
    sanitizeEmailError,
    sendResendEmail
} from "../src/dispatchers/emailDispatcher.js";
import {
    buildLicenseEmail,
    deliverLicenseEmail
} from "../src/services/emailDeliveryService.js";
import { encryptLicenseKey } from "../src/utils/licenseCrypto.js";

config.emailApiUrl = "https://api.resend.com/emails";
config.emailApiToken = "test-email-token";
config.emailFrom = "Aurora HY <license@mail.aurorahy.com>";
config.websiteBaseUrl = "https://aurorahy.com";
config.downloadBaseUrl = "https://aurorahy.com/download";
config.licenseDeliveryEncryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

const rawLicenseKey = "AURORA-TEST-KEY1-KEY2-KEY3";
const encrypted = encryptLicenseKey(rawLicenseKey, config.licenseDeliveryEncryptionKey);

function claim(overrides = {}) {
    return {
        status: "claimed",
        delivery: {
            id: 42,
            customerEmail: "customer@example.com",
            licenseProductId: "AURORA-XAU-AI",
            plan: "monthly",
            downloadUrl: "https://aurorahy.com/download/aurora-xau-ai",
            emailStatus: "email_pending",
            ...encrypted,
            ...overrides.delivery
        },
        payment: {
            id: 7,
            sku: "aurora-xau-monthly",
            customerEmail: "customer@example.com",
            customerName: "Customer",
            paypalOrderId: "I-YJX6584RE20G",
            paymentStatus: "COMPLETED",
            deliveryStatus: "delivered",
            ...overrides.payment
        },
        subscription: {
            paypalSubscriptionId: "I-YJX6584RE20G",
            currentPeriodEnd: "2026-08-14T00:00:00Z",
            subscriptionStatus: "ACTIVE",
            ...overrides.subscription
        }
    };
}

function storageStub(claimResult = claim()) {
    const calls = [];
    return {
        calls,
        storage: {
            getEmailDeliveryAudit: async () => {
                calls.push("audit");
                return claimResult;
            },
            claimEmailDelivery: async () => {
                calls.push("claim");
                return claimResult;
            },
            markEmailDeliverySent: async ({ resendEmailId }) => {
                calls.push(`sent:${resendEmailId}`);
                return { id: 42, emailStatus: "sent", resendEmailId };
            },
            markEmailDeliveryFailed: async ({ status, errorSummary }) => {
                calls.push(`failed:${status}:${errorSummary}`);
                return { id: 42, emailStatus: status, emailError: errorSummary };
            }
        }
    };
}

test("Resend request uses required headers, body and no reply-to", async () => {
    let request = null;
    const result = await sendResendEmail({
        deliveryId: 42,
        to: "customer@example.com",
        subject: "License",
        html: "<p>html</p>",
        text: "text"
    }, async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ id: "email_123" })
        };
    });

    assert.equal(result.id, "email_123");
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.authorization, "Bearer test-email-token");
    assert.equal(request.options.headers["Idempotency-Key"], "license-delivery/42");
    assert.equal(Object.hasOwn(request.options.headers, "reply-to"), false);
    const body = JSON.parse(request.options.body);
    assert.equal(body.from, "Aurora HY <license@mail.aurorahy.com>");
    assert.equal(body.to, "customer@example.com");
    assert.ok(body.html);
    assert.ok(body.text);
});

test("support auto reply can reuse Resend dispatcher with support from and reply-to", async () => {
    let request = null;
    await sendResendEmail({
        idempotencyKey: "support-auto-reply/test",
        to: "customer@example.com",
        subject: "Support",
        html: "<p>html</p>",
        text: "text",
        from: "Aurora HY Support <support@mail.aurorahy.com>",
        replyTo: "support@aurorahy.com"
    }, async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ id: "email_support" })
        };
    });

    const body = JSON.parse(request.options.body);
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(body.from, "Aurora HY Support <support@mail.aurorahy.com>");
    assert.equal(body.reply_to, "support@aurorahy.com");
});

test("successful send marks delivery sent with Resend id", async () => {
    const stub = storageStub();
    const result = await deliverLicenseEmail({
        deliveryId: 42,
        storage: stub.storage,
        sendEmail: async ({ text, html }) => {
            assert.match(text, /License Key: AURORA-/);
            assert.match(html, /License Key/);
            return { id: "email_success" };
        }
    });

    assert.equal(result.status, "sent");
    assert.deepEqual(stub.calls, ["claim", "sent:email_success"]);
});

test("duplicate retry after sent does not send twice", async () => {
    let sendCount = 0;
    const result = await deliverLicenseEmail({
        deliveryId: 42,
        storage: storageStub({ status: "already_sent", delivery: { id: 42, emailStatus: "sent" } }).storage,
        sendEmail: async () => {
            sendCount += 1;
        }
    });

    assert.equal(result.status, "already_sent");
    assert.equal(sendCount, 0);
});

test("concurrent send claims only one delivery", async () => {
    let claimed = false;
    let sendCount = 0;
    const storage = {
        claimEmailDelivery: async () => {
            if (claimed) {
                return { status: "already_sent" };
            }
            claimed = true;
            return claim();
        },
        markEmailDeliverySent: async () => ({ id: 42, emailStatus: "sent" }),
        markEmailDeliveryFailed: async () => ({ id: 42 })
    };

    const [first, second] = await Promise.all([
        deliverLicenseEmail({ deliveryId: 42, storage, sendEmail: async () => { sendCount += 1; return { id: "email_1" }; } }),
        deliverLicenseEmail({ deliveryId: 42, storage, sendEmail: async () => { sendCount += 1; return { id: "email_2" }; } })
    ]);

    assert.equal([first.status, second.status].filter((status) => status === "sent").length, 1);
    assert.equal(sendCount, 1);
});

test("retryable and fail-closed errors update email status without changing payment", async () => {
    for (const [statusCode, expected] of [[429, "retry_pending"], [500, "retry_pending"], [401, "failed"], [400, "failed"]]) {
        const stub = storageStub();
        const result = await deliverLicenseEmail({
            deliveryId: 42,
            storage: stub.storage,
            sendEmail: async () => {
                const error = new Error(`Resend ${statusCode}`);
                error.statusCode = statusCode;
                throw error;
            }
        });

        assert.equal(result.status, expected);
        assert.equal(claim().payment.paymentStatus, "COMPLETED");
    }
});

test("network errors are retryable and plaintext license is never in error summary", async () => {
    const error = new Error(`network failed ${rawLicenseKey}`);
    const summary = sanitizeEmailError(error);

    assert.equal(isRetryableEmailError(error), true);
    assert.equal(summary.includes(rawLicenseKey), false);
    assert.match(summary, /\[license-redacted\]/);
});

test("dry-run performs zero writes and zero HTTP calls", async () => {
    let httpCalls = 0;
    const stub = storageStub();
    const result = await deliverLicenseEmail({
        deliveryId: 42,
        dryRun: true,
        storage: stub.storage,
        sendEmail: async () => {
            httpCalls += 1;
        }
    });

    assert.equal(result.status, "dry_run");
    assert.equal(result.writes, false);
    assert.equal(result.httpCalls, 0);
    assert.equal(httpCalls, 0);
    assert.deepEqual(stub.calls, ["audit"]);
});

test("email content includes required customer and subscription details only", () => {
    const email = buildLicenseEmail({
        ...claim(),
        licenseKey: rawLicenseKey
    });

    assert.match(email.text, /Customer/);
    assert.match(email.text, /XAU Martingale Monthly/);
    assert.match(email.text, /Monthly/);
    assert.match(email.text, /PayPal Subscription ID: I-YJX6584RE20G/);
    assert.match(email.text, /Valid Until: 2026-08-14/);
    assert.match(email.text, /This is an automated email\. Please do not reply\./);
    assert.doesNotMatch(email.text, /TOKEN|DATABASE_URL|SECRET|license_key_hash|encryptionIv|auth/i);
});
