ALTER TABLE xau_licenses
    ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT,
    ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_successful_sale_id TEXT,
    ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS manual_review_reason TEXT,
    ADD COLUMN IF NOT EXISTS latest_subscription_event_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS xau_licenses_paypal_subscription_id_unique
    ON xau_licenses (paypal_subscription_id)
    WHERE paypal_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS xau_subscription_payments (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT NOT NULL REFERENCES xau_licenses(id) ON DELETE CASCADE,
    paypal_sale_id TEXT NOT NULL UNIQUE,
    paypal_subscription_id TEXT NOT NULL,
    event_id TEXT,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xau_subscription_payments_license_id_idx
    ON xau_subscription_payments (license_id);

CREATE INDEX IF NOT EXISTS xau_subscription_payments_subscription_id_idx
    ON xau_subscription_payments (paypal_subscription_id);

CREATE TABLE IF NOT EXISTS xau_subscription_events (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT REFERENCES xau_licenses(id) ON DELETE SET NULL,
    paypal_subscription_id TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    event_status TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xau_subscription_events_subscription_id_idx
    ON xau_subscription_events (paypal_subscription_id);
