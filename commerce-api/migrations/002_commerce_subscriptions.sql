SELECT pg_advisory_lock(76020042);

CREATE TABLE IF NOT EXISTS commerce_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    paypal_subscription_id TEXT NOT NULL UNIQUE,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    sku TEXT NOT NULL,
    license_product_id TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    paypal_plan_id TEXT NOT NULL,
    subscription_status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    grace_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_subscription_payments (
    id BIGSERIAL PRIMARY KEY,
    paypal_sale_id TEXT NOT NULL UNIQUE,
    paypal_subscription_id TEXT NOT NULL,
    paypal_event_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_subscription_events (
    id BIGSERIAL PRIMARY KEY,
    paypal_event_id TEXT NOT NULL UNIQUE,
    paypal_subscription_id TEXT,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    processing_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commerce_subscriptions_customer_email_idx
    ON commerce_subscriptions (customer_email);

CREATE INDEX IF NOT EXISTS commerce_subscription_payments_subscription_idx
    ON commerce_subscription_payments (paypal_subscription_id);

SELECT pg_advisory_unlock(76020042);
