import { config } from "../config.js";
import { postJson } from "../utils/http.js";

export async function sendLicenseEmail({ customer, productId, license, downloadLink }) {
    const payload = {
        to: customer.email,
        subject: `Aurora ${productId} License`,
        template: "license-delivery",
        data: {
            customer,
            productId,
            license,
            downloadLink,
            supportEmail: config.supportEmail
        }
    };

    if (!config.emailApiUrl) {
        return {
            status: "skipped",
            reason: "EMAIL_API_URL is not configured.",
            payload
        };
    }

    return postJson(config.emailApiUrl, payload, config.emailApiToken);
}

export async function sendIdentityEmail({ customer, type, token }) {
    const path = type === "password-reset" ? "reset-password" : "verify-email";
    const link = `${config.websiteBaseUrl}/${path}?token=${encodeURIComponent(token)}`;
    const subject = type === "password-reset"
        ? "Reset your Aurora password"
        : "Activate your Aurora account";
    const payload = {
        to: customer.email,
        subject,
        template: type,
        data: {
            customer,
            activationLink: link,
            resetLink: link,
            supportEmail: config.supportEmail
        }
    };

    if (!config.emailApiUrl) {
        return {
            status: "skipped",
            reason: "EMAIL_API_URL is not configured.",
            payload
        };
    }

    return postJson(config.emailApiUrl, payload, config.emailApiToken);
}
