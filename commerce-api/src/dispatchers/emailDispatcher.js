import { createHash } from "node:crypto";

import { config } from "../config.js";

export function sanitizeEmailError(error) {
    const status = error?.statusCode ? `status_${error.statusCode}` : "network_error";
    const message = String(error?.message || "email_delivery_failed")
        .replace(/AURORA-[A-Z0-9-]+/g, "[license-redacted]")
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
        .slice(0, 300);

    return `${status}: ${message}`;
}

export function isRetryableEmailError(error) {
    if (!error?.statusCode) {
        return true;
    }
    return error.statusCode === 429 || error.statusCode >= 500;
}

export async function sendResendEmail({ deliveryId, idempotencyKey, to, subject, html, text }, fetchImpl = globalThis.fetch) {
    if (!config.emailApiUrl) {
        const error = new Error("EMAIL_API_URL is not configured.");
        error.statusCode = 503;
        throw error;
    }

    if (!config.emailApiToken) {
        const error = new Error("EMAIL_API_TOKEN is not configured.");
        error.statusCode = 503;
        throw error;
    }

    const response = await fetchImpl(config.emailApiUrl, {
        method: "POST",
        headers: {
            authorization: `Bearer ${config.emailApiToken}`,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey || `license-delivery/${deliveryId}`
        },
        body: JSON.stringify({
            from: config.emailFrom,
            to,
            subject,
            html,
            text
        })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data?.message || "Resend email delivery failed.");
        error.statusCode = response.status;
        throw error;
    }

    return {
        status: "sent",
        id: data.id || ""
    };
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function identityEmailConfig(type, token) {
    const baseUrl = config.websiteBaseUrl.replace(/\/+$/, "");

    if (type === "email-verification") {
        return {
            subject: "Verify your Aurora HY account",
            action: "Verify Email",
            link: `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`,
            intro: "Please verify your email address to activate your Aurora HY customer account."
        };
    }

    if (type === "password-reset") {
        return {
            subject: "Reset your Aurora HY password",
            action: "Reset Password",
            link: `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
            intro: "We received a request to reset your Aurora HY account password."
        };
    }

    if (type === "activation") {
        return {
            subject: "Activate your Aurora HY customer account",
            action: "Set Password",
            link: `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
            intro: "Your Aurora HY purchase is ready. Set your password to access your customer dashboard."
        };
    }

    const error = new Error("Unsupported identity email type.");
    error.statusCode = 400;
    throw error;
}

export function buildIdentityEmail({ customer, type, token }) {
    const email = identityEmailConfig(type, token);
    const customerName = customer?.name || "Aurora Customer";
    const safeName = escapeHtml(customerName);
    const safeLink = escapeHtml(email.link);
    const text = [
        `Hello ${customerName},`,
        "",
        email.intro,
        "",
        `${email.action}: ${email.link}`,
        "",
        "This link expires in 24 hours.",
        "This is an automated email. Please do not reply."
    ].join("\n");

    const html = [
        `<p>Hello ${safeName},</p>`,
        `<p>${escapeHtml(email.intro)}</p>`,
        `<p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#4CC9FF;color:#06101f;text-decoration:none;font-weight:700">${escapeHtml(email.action)}</a></p>`,
        `<p style="color:#64748b">This link expires in 24 hours.</p>`,
        `<p style="color:#64748b">This is an automated email. Please do not reply.</p>`
    ].join("");

    return {
        subject: email.subject,
        html,
        text
    };
}

export async function sendIdentityEmail({ customer, type, token }, fetchImpl = globalThis.fetch) {
    const email = buildIdentityEmail({ customer, type, token });
    const tokenHash = createHash("sha256").update(String(token || "")).digest("hex").slice(0, 32);

    return sendResendEmail({
        idempotencyKey: `identity/${type}/${tokenHash}`,
        to: customer.email,
        ...email
    }, fetchImpl);
}
