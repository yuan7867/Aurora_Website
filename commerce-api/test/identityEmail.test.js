import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { config } from "../src/config.js";
import {
    buildIdentityEmail,
    sendIdentityEmail
} from "../src/dispatchers/emailDispatcher.js";

config.emailApiUrl = "https://api.resend.com/emails";
config.emailApiToken = "test-email-token";
config.emailFrom = "Aurora HY <license@mail.aurorahy.com>";
config.websiteBaseUrl = "https://aurorahy.com";

const customer = {
    email: "customer@example.com",
    name: "Customer"
};

test("identity verification email uses Aurora URL and safe content", () => {
    const email = buildIdentityEmail({
        customer,
        type: "email-verification",
        token: "verify-token"
    });

    assert.equal(email.subject, "Verify your Aurora HY account");
    assert.match(email.text, /https:\/\/aurorahy\.com\/verify-email\?token=verify-token/);
    assert.match(email.html, /Verify Email/);
    assert.match(email.text, /This is an automated email\. Please do not reply\./);
    assert.doesNotMatch(email.text, /EMAIL_API_TOKEN|DATABASE_URL|CLIENT_SECRET|JWT_SECRET/i);
});

test("activation email sends customer to set password", () => {
    const email = buildIdentityEmail({
        customer,
        type: "activation",
        token: "activation-token"
    });

    assert.equal(email.subject, "Activate your Aurora HY customer account");
    assert.match(email.text, /reset-password\?token=activation-token/);
    assert.match(email.text, /Set Password/);
});

test("password reset email uses reset-password link", () => {
    const email = buildIdentityEmail({
        customer,
        type: "password-reset",
        token: "reset-token"
    });

    assert.equal(email.subject, "Reset your Aurora HY password");
    assert.match(email.text, /reset-password\?token=reset-token/);
});

test("identity email sends through Resend without reply-to or secret body", async () => {
    let request = null;
    const result = await sendIdentityEmail({
        customer,
        type: "email-verification",
        token: "verify-token"
    }, async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ id: "identity_email_123" })
        };
    });

    assert.equal(result.id, "identity_email_123");
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.authorization, "Bearer test-email-token");
    assert.match(request.options.headers["Idempotency-Key"], /^identity\/email-verification\/[a-f0-9]{32}$/);
    assert.equal(Object.hasOwn(request.options.headers, "reply-to"), false);

    const body = JSON.parse(request.options.body);
    assert.equal(body.from, "Aurora HY <license@mail.aurorahy.com>");
    assert.equal(body.to, "customer@example.com");
    assert.doesNotMatch(request.options.body, /test-email-token|DATABASE_URL|CLIENT_SECRET|JWT_SECRET/i);
});

test("purchase activation stores reset token for first password setup", async () => {
    const source = await readFile(new URL("../src/services/identityService.js", import.meta.url), "utf8");

    assert.match(source, /resetToken:\s*activationToken/);
    assert.match(source, /resetExpiresAt:\s*expiresAt/);
});
