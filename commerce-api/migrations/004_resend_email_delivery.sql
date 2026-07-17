SELECT pg_advisory_lock(76020044);

ALTER TABLE commerce_deliveries
    ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_error TEXT,
    ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS commerce_deliveries_email_status_idx
    ON commerce_deliveries (email_status);

SELECT pg_advisory_unlock(76020044);
