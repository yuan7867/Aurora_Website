SELECT pg_advisory_lock(76020046);

CREATE TABLE IF NOT EXISTS commerce_support_reply_events (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT,
    uid TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    recipient_email TEXT NOT NULL DEFAULT '',
    inbound_subject TEXT NOT NULL DEFAULT '',
    processing_status TEXT NOT NULL CHECK (processing_status IN ('processing', 'sent', 'suppressed_24h', 'duplicate', 'failed')),
    resend_email_id TEXT,
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commerce_support_sender_state (
    sender_email TEXT PRIMARY KEY,
    last_replied_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS commerce_support_reply_events_message_id_unique
    ON commerce_support_reply_events (message_id)
    WHERE message_id IS NOT NULL AND message_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS commerce_support_reply_events_uid_unique
    ON commerce_support_reply_events (uid)
    WHERE uid IS NOT NULL AND uid <> '';

CREATE INDEX IF NOT EXISTS commerce_support_reply_events_sender_idx
    ON commerce_support_reply_events (sender_email);

SELECT pg_advisory_unlock(76020046);
