SELECT pg_advisory_lock(76020043);

ALTER TABLE commerce_payments
    DROP CONSTRAINT IF EXISTS commerce_payments_delivery_status_check;

ALTER TABLE commerce_payments
    ADD CONSTRAINT commerce_payments_delivery_status_check
    CHECK (delivery_status IN ('claimed', 'pending_delivery', 'delivered', 'manual_recovery', 'failed'));

ALTER TABLE commerce_subscription_events
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

SELECT pg_advisory_unlock(76020043);
