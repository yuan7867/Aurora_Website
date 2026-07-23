import assert from "node:assert/strict";
import test from "node:test";

import { config } from "../src/config.js";
import {
    normalizeSupportInboundPayload,
    processSupportInboundEmail,
    resolveSupportCustomerName
} from "../src/services/supportGatewayService.js";

config.supportAutoReplyFrom = "Aurora HY Support <support@mail.aurorahy.com>";
config.supportAutoReplyReplyTo = "support@aurorahy.com";
config.supportEmail = "support@aurorahy.com";

test("support gateway resolves display name before email fallback", () => {
    assert.equal(resolveSupportCustomerName({
        from: "John Smith <john@gmail.com>",
        senderEmail: "john@gmail.com"
    }), "John Smith");
    assert.equal(resolveSupportCustomerName({
        from: "john_1988.smith-test@gmail.com",
        senderEmail: "john_1988.smith-test@gmail.com"
    }), "John Smith Test");
    assert.equal(resolveSupportCustomerName({
        senderEmail: "123_-.@gmail.com"
    }), "Customer");
});

test("support gateway normalizes Cloudflare worker payload", () => {
    const inbound = normalizeSupportInboundPayload({
        headers: {
            From: "Jane Client <jane.client@gmail.com>",
            To: "support@aurorahy.com",
            "Message-ID": "<msg-1@gmail.com>",
            Subject: "Need help"
        }
    });

    assert.equal(inbound.senderEmail, "jane.client@gmail.com");
    assert.equal(inbound.customerName, "Jane Client");
    assert.equal(inbound.messageId, "<msg-1@gmail.com>");
    assert.equal(inbound.recipientEmail, "support@aurorahy.com");
});

test("support gateway sends branded auto reply through website email service", async () => {
    const calls = [];
    const result = await processSupportInboundEmail({
        payload: {
            from: "John Smith <john@gmail.com>",
            to: "support@aurorahy.com",
            messageId: "<support-msg-1@gmail.com>",
            subject: "Support"
        },
        storage: {
            claimSupportReplyEvent: async (event) => {
                calls.push(["claim", event.messageId, event.uid, event.senderEmail]);
                return { status: "claimed", event: { id: 101 } };
            },
            markSupportReplySent: async ({ eventId, senderEmail }) => {
                calls.push(["sent", eventId, senderEmail]);
            },
            markSupportReplyFailed: async () => {
                throw new Error("should_not_fail");
            }
        },
        sendEmail: async (email) => {
            calls.push(["email", email.from, email.replyTo, email.to, email.subject]);
            assert.equal(email.from, "Aurora HY Support <support@mail.aurorahy.com>");
            assert.equal(email.replyTo, "support@aurorahy.com");
            assert.match(email.text, /Dear John Smith,/);
            assert.match(email.html, /Dear John Smith,/);
            assert.match(email.text, /Engineering Intelligent Software\./);
            assert.doesNotMatch(email.text, /Founder & CEO|Customer Service Team|Reference Number/);
            return { id: "email_support_101" };
        }
    });

    assert.equal(result.status, "sent");
    assert.equal(calls[0][0], "claim");
    assert.equal(calls[0][1], "<support-msg-1@gmail.com>");
    assert.match(calls[0][2], /^[a-f0-9]{64}$/);
    assert.equal(calls[0][3], "john@gmail.com");
    assert.deepEqual(calls[2], ["sent", 101, "john@gmail.com"]);
});

test("support gateway returns duplicate and 24h suppression without sending", async () => {
    let sendCount = 0;
    const duplicate = await processSupportInboundEmail({
        payload: {
            from: "john@gmail.com",
            messageId: "<same-message@gmail.com>"
        },
        storage: {
            claimSupportReplyEvent: async () => ({ status: "duplicate", event: { id: 1 } }),
            markSupportReplySent: async () => {},
            markSupportReplyFailed: async () => {}
        },
        sendEmail: async () => {
            sendCount += 1;
        }
    });
    const suppressed = await processSupportInboundEmail({
        payload: {
            from: "john@gmail.com",
            uid: "28391"
        },
        storage: {
            claimSupportReplyEvent: async () => ({ status: "suppressed_24h", event: { id: 2 } }),
            markSupportReplySent: async () => {},
            markSupportReplyFailed: async () => {}
        },
        sendEmail: async () => {
            sendCount += 1;
        }
    });

    assert.equal(duplicate.status, "duplicate");
    assert.equal(suppressed.status, "suppressed_24h");
    assert.equal(sendCount, 0);
});
