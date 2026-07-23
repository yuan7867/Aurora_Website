import pg from "pg";

import { config } from "../config.js";

const { Pool } = pg;

let pool = null;

function getPool() {
    if (!pool) {
        if (!config.databaseUrl) {
            throw new Error("DATABASE_URL is required for Support Gateway storage.");
        }
        pool = new Pool({
            connectionString: config.databaseUrl
        });
    }
    return pool;
}

function rowToEvent(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        messageId: row.message_id,
        uid: row.uid,
        senderEmail: row.sender_email,
        senderName: row.sender_name,
        processingStatus: row.processing_status
    };
}

export async function claimSupportReplyEvent({
    messageId = "",
    uid = "",
    senderEmail,
    senderName = "",
    recipientEmail = "",
    inboundSubject = ""
}) {
    const client = await getPool().connect();

    try {
        await client.query("BEGIN");

        if (messageId) {
            const existing = await client.query(
                "SELECT * FROM commerce_support_reply_events WHERE message_id = $1",
                [messageId]
            );

            if (existing.rows[0]) {
                await client.query("COMMIT");
                return {
                    status: "duplicate",
                    event: rowToEvent(existing.rows[0])
                };
            }
        }

        if (uid) {
            const existing = await client.query(
                "SELECT * FROM commerce_support_reply_events WHERE uid = $1",
                [uid]
            );

            if (existing.rows[0]) {
                await client.query("COMMIT");
                return {
                    status: "duplicate",
                    event: rowToEvent(existing.rows[0])
                };
            }
        }

        const senderState = await client.query(
            "SELECT * FROM commerce_support_sender_state WHERE sender_email = $1 FOR UPDATE",
            [senderEmail]
        );
        const lastRepliedAt = senderState.rows[0]?.last_replied_at ? new Date(senderState.rows[0].last_replied_at) : null;
        const within24Hours = lastRepliedAt && Date.now() - lastRepliedAt.getTime() < 24 * 60 * 60 * 1000;
        const status = within24Hours ? "suppressed_24h" : "processing";
        const insert = await client.query(
            `INSERT INTO commerce_support_reply_events (
                message_id,
                uid,
                sender_email,
                sender_name,
                recipient_email,
                inbound_subject,
                processing_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *`,
            [messageId || null, uid || null, senderEmail, senderName, recipientEmail, inboundSubject, status]
        );

        await client.query("COMMIT");

        return {
            status: status === "processing" ? "claimed" : status,
            event: rowToEvent(insert.rows[0])
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function markSupportReplySent({ eventId, senderEmail, resendEmailId = "" }) {
    const client = await getPool().connect();

    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE commerce_support_reply_events
             SET processing_status = 'sent',
                 resend_email_id = $2,
                 processed_at = NOW()
             WHERE id = $1`,
            [eventId, resendEmailId]
        );
        await client.query(
            `INSERT INTO commerce_support_sender_state (sender_email, last_replied_at, updated_at)
             VALUES ($1, NOW(), NOW())
             ON CONFLICT (sender_email)
             DO UPDATE SET last_replied_at = EXCLUDED.last_replied_at,
                           updated_at = NOW()`,
            [senderEmail]
        );
        await client.query("COMMIT");

        return {
            status: "sent"
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function markSupportReplyFailed({ eventId, errorSummary }) {
    await getPool().query(
        `UPDATE commerce_support_reply_events
         SET processing_status = 'failed',
             error_summary = $2,
             processed_at = NOW()
         WHERE id = $1`,
        [eventId, String(errorSummary || "support_reply_failed").slice(0, 300)]
    );
}
