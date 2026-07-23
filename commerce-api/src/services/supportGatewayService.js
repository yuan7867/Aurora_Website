import { createHash } from "node:crypto";

import { config } from "../config.js";
import { sendResendEmail } from "../dispatchers/emailDispatcher.js";
import {
    claimSupportReplyEvent,
    markSupportReplyFailed,
    markSupportReplySent
} from "../storage/supportGatewayStore.js";

const subject = "[Aurora HY] Your Support Request Has Been Received";

function normalizeEmail(value = "") {
    const match = String(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
}

function displayNameFromAddress(value = "") {
    const trimmed = String(value).trim();
    const bracketIndex = trimmed.indexOf("<");

    if (bracketIndex > 0) {
        const name = trimmed.slice(0, bracketIndex).trim().replace(/^["']|["']$/g, "");
        return name.includes("@") ? "" : name;
    }

    return "";
}

function nameFromEmail(address = "") {
    const local = address.split("@")[0] || "";
    const words = local.split(/[\d_.-]+/).filter(Boolean);

    if (!words.length) {
        return "Customer";
    }

    return words.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ");
}

export function resolveSupportCustomerName({ from = "", replyTo = "", senderEmail = "" }) {
    return displayNameFromAddress(replyTo)
        || displayNameFromAddress(from)
        || nameFromEmail(senderEmail)
        || "Customer";
}

function buildSupportAutoReplyText(customerName) {
    return `Dear ${customerName},

Thank you for contacting Aurora HY.

We have successfully received your email.

Your request has been securely registered in the Aurora Support System and is now awaiting review by our team.

━━━━━━━━━━━━━━━━━━━━━━

Current Status

✔ Request Received
⏳ Awaiting Review

━━━━━━━━━━━━━━━━━━━━━━

To help us assist you faster, please include the following whenever applicable:

• Order Number
• Product Name
• Error Message
• Screenshot or Screen Recording

━━━━━━━━━━━━━━━━━━━━━━

Website

https://aurorahy.com

Thank you for choosing Aurora HY.

Kind regards,

Yuan

Founder

Aurora HY
Engineering Intelligent Software.

support@aurorahy.com
https://aurorahy.com
`;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildSupportAutoReplyHtml(customerName) {
    const safeName = escapeHtml(customerName);

    return [
        `<p>Dear ${safeName},</p>`,
        "<p>Thank you for contacting Aurora HY.</p>",
        "<p>We have successfully received your email.</p>",
        "<p>Your request has been securely registered in the Aurora Support System and is now awaiting review by our team.</p>",
        "<p>━━━━━━━━━━━━━━━━━━━━━━</p>",
        "<p><strong>Current Status</strong></p>",
        "<p>✔ Request Received<br>⏳ Awaiting Review</p>",
        "<p>━━━━━━━━━━━━━━━━━━━━━━</p>",
        "<p>To help us assist you faster, please include the following whenever applicable:</p>",
        "<p>• Order Number<br>• Product Name<br>• Error Message<br>• Screenshot or Screen Recording</p>",
        "<p>━━━━━━━━━━━━━━━━━━━━━━</p>",
        "<p><strong>Website</strong></p>",
        '<p><a href="https://aurorahy.com">https://aurorahy.com</a></p>',
        "<p>Thank you for choosing Aurora HY.</p>",
        "<p>Kind regards,</p>",
        "<p>Yuan</p>",
        "<p>Founder</p>",
        "<p>Aurora HY<br>Engineering Intelligent Software.</p>",
        '<p>support@aurorahy.com<br><a href="https://aurorahy.com">https://aurorahy.com</a></p>'
    ].join("");
}

function getHeader(payload, name) {
    const headers = payload.headers || {};
    const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];

    if (direct) {
        return String(direct);
    }

    if (Array.isArray(payload.rawHeaders)) {
        const entry = payload.rawHeaders.find((item) => String(item?.name || "").toLowerCase() === name.toLowerCase());
        return entry?.value ? String(entry.value) : "";
    }

    return "";
}

export function normalizeSupportInboundPayload(payload = {}) {
    const from = payload.from || getHeader(payload, "From");
    const replyTo = payload.replyTo || payload.reply_to || getHeader(payload, "Reply-To");
    const senderEmail = normalizeEmail(replyTo) || normalizeEmail(from);
    const messageId = payload.messageId || payload.message_id || getHeader(payload, "Message-ID");
    const uid = payload.uid || payload.UID || "";
    const recipient = payload.to || getHeader(payload, "To") || config.supportEmail;
    const inboundSubject = payload.subject || getHeader(payload, "Subject") || "";

    return {
        from,
        replyTo,
        senderEmail,
        customerName: resolveSupportCustomerName({ from, replyTo, senderEmail }),
        messageId: String(messageId || "").trim(),
        uid: String(uid || "").trim(),
        recipientEmail: normalizeEmail(recipient) || config.supportEmail,
        inboundSubject: String(inboundSubject || "").slice(0, 300)
    };
}

export async function processSupportInboundEmail({
    payload,
    storage = {
        claimSupportReplyEvent,
        markSupportReplySent,
        markSupportReplyFailed
    },
    sendEmail = sendResendEmail
}) {
    const inbound = normalizeSupportInboundPayload(payload);

    if (!inbound.senderEmail) {
        const error = new Error("Support inbound sender is missing.");
        error.statusCode = 400;
        throw error;
    }

    const uid = inbound.uid || createHash("sha256")
        .update(`${inbound.messageId}:${inbound.senderEmail}:${inbound.inboundSubject}`)
        .digest("hex");
    const claim = await storage.claimSupportReplyEvent({
        ...inbound,
        uid,
        senderName: inbound.customerName
    });

    if (claim.status !== "claimed") {
        return {
            status: claim.status,
            eventId: claim.event?.id || null
        };
    }

    try {
        const result = await sendEmail({
            idempotencyKey: `support-auto-reply/${claim.event.id}`,
            to: inbound.senderEmail,
            subject,
            text: buildSupportAutoReplyText(inbound.customerName),
            html: buildSupportAutoReplyHtml(inbound.customerName),
            from: config.supportAutoReplyFrom,
            replyTo: config.supportAutoReplyReplyTo
        });
        await storage.markSupportReplySent({
            eventId: claim.event.id,
            senderEmail: inbound.senderEmail,
            resendEmailId: result.id || ""
        });

        return {
            status: "sent",
            eventId: claim.event.id
        };
    } catch (error) {
        await storage.markSupportReplyFailed({
            eventId: claim.event.id,
            errorSummary: error.message
        });
        throw error;
    }
}
