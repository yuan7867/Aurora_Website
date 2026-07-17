import { getCommerceProduct } from "../products.js";
import {
    claimEmailDelivery,
    getEmailDeliveryAudit,
    markEmailDeliveryFailed,
    markEmailDeliverySent
} from "../storage/commerceStore.js";
import { decryptLicenseKey } from "../utils/licenseCrypto.js";
import {
    isRetryableEmailError,
    sanitizeEmailError,
    sendResendEmail
} from "../dispatchers/emailDispatcher.js";
import { config } from "../config.js";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatPlan(plan) {
    return plan === "yearly" ? "Yearly" : "Monthly";
}

function formatDate(value) {
    return value ? new Date(value).toISOString().slice(0, 10) : "Current billing period";
}

export function buildLicenseEmail({ delivery, payment, subscription, licenseKey }) {
    const product = getCommerceProduct(payment.sku);
    const customerName = payment.customerName || "Aurora Customer";
    const portalUrl = `${config.websiteBaseUrl}/account`;
    const downloadUrl = delivery.downloadUrl || config.downloadBaseUrl || `${config.websiteBaseUrl}/download`;
    const validUntil = formatDate(subscription?.currentPeriodEnd);
    const plan = formatPlan(product.plan);
    const subject = `${product.name} License`;
    const text = [
        `Hello ${customerName},`,
        "",
        `Your ${product.name} license is ready.`,
        `Plan: ${plan}`,
        `License Key: ${licenseKey}`,
        `PayPal Subscription ID: ${payment.paypalOrderId}`,
        `Valid Until: ${validUntil}`,
        `Download: ${downloadUrl}`,
        `Customer Portal: ${portalUrl}`,
        "",
        "Your subscription renews automatically unless cancelled before the next billing cycle.",
        "This is an automated email. Please do not reply."
    ].join("\n");
    const html = `
        <div style="font-family:Inter,Arial,sans-serif;color:#0b1325;line-height:1.6">
            <h1 style="margin:0 0 16px">Your Aurora license is ready</h1>
            <p>Hello ${escapeHtml(customerName)},</p>
            <p>Your <strong>${escapeHtml(product.name)}</strong> license is ready.</p>
            <table style="border-collapse:collapse;width:100%;max-width:640px">
                <tr><td><strong>Plan</strong></td><td>${escapeHtml(plan)}</td></tr>
                <tr><td><strong>License Key</strong></td><td><code>${escapeHtml(licenseKey)}</code></td></tr>
                <tr><td><strong>PayPal Subscription ID</strong></td><td>${escapeHtml(payment.paypalOrderId)}</td></tr>
                <tr><td><strong>Valid Until</strong></td><td>${escapeHtml(validUntil)}</td></tr>
            </table>
            <p><a href="${escapeHtml(downloadUrl)}">Download Aurora</a></p>
            <p><a href="${escapeHtml(portalUrl)}">Open Customer Portal</a></p>
            <p>Your subscription renews automatically unless cancelled before the next billing cycle.</p>
            <p style="color:#64748b">This is an automated email. Please do not reply.</p>
        </div>
    `;

    return {
        to: delivery.customerEmail,
        subject,
        html,
        text
    };
}

export async function deliverLicenseEmail({
    deliveryId,
    dryRun = false,
    sendEmail = sendResendEmail,
    storage = {
        claimEmailDelivery,
        getEmailDeliveryAudit,
        markEmailDeliverySent,
        markEmailDeliveryFailed
    }
} = {}) {
    if (!deliveryId) {
        const error = new Error("deliveryId is required.");
        error.statusCode = 400;
        throw error;
    }

    if (dryRun) {
        const audit = await storage.getEmailDeliveryAudit(deliveryId);
        return {
            status: audit?.delivery?.emailStatus === "sent" ? "already_sent" : "dry_run",
            writes: false,
            httpCalls: 0,
            delivery: audit
                ? {
                    id: audit.delivery.id,
                    emailStatus: audit.delivery.emailStatus,
                    hasEncryptedLicense: Boolean(audit.delivery.encryptedLicenseKey),
                    customerEmail: audit.delivery.customerEmail,
                    paymentStatus: audit.payment.paymentStatus,
                    deliveryStatus: audit.payment.deliveryStatus
                }
                : null
        };
    }

    const claim = await storage.claimEmailDelivery(deliveryId);

    if (claim.status !== "claimed") {
        return {
            status: claim.status,
            reason: claim.reason || "",
            deliveryId
        };
    }

    try {
        const licenseKey = decryptLicenseKey(claim.delivery);
        const email = buildLicenseEmail({
            delivery: claim.delivery,
            payment: claim.payment,
            subscription: claim.subscription,
            licenseKey
        });
        const result = await sendEmail({
            deliveryId,
            ...email
        });
        const delivery = await storage.markEmailDeliverySent({
            deliveryId,
            resendEmailId: result.id
        });
        return {
            status: "sent",
            resendEmailId: result.id,
            delivery
        };
    } catch (error) {
        const retryable = isRetryableEmailError(error);
        await storage.markEmailDeliveryFailed({
            deliveryId,
            status: retryable ? "retry_pending" : "failed",
            errorSummary: sanitizeEmailError(error)
        });
        return {
            status: retryable ? "retry_pending" : "failed",
            retryable,
            error: sanitizeEmailError(error)
        };
    }
}
