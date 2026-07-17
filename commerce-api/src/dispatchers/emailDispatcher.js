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

export async function sendResendEmail({ deliveryId, to, subject, html, text }, fetchImpl = globalThis.fetch) {
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
            "Idempotency-Key": `license-delivery/${deliveryId}`
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

export async function sendIdentityEmail() {
    return {
        status: "skipped",
        reason: "Identity email delivery is not part of this phase."
    };
}
