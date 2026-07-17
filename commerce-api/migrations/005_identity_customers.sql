SELECT pg_advisory_lock(76020045);

CREATE TABLE IF NOT EXISTS commerce_customers (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT 'Aurora Customer',
    password_hash TEXT,
    status TEXT NOT NULL DEFAULT 'activation_required'
        CHECK (status IN ('active', 'verification_required', 'activation_required', 'disabled')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    disabled_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT commerce_customers_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT commerce_customers_disabled_consistency CHECK (
        (status = 'disabled' AND disabled_at IS NOT NULL)
        OR (status <> 'disabled')
    )
);

CREATE TABLE IF NOT EXISTS commerce_customer_tokens (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES commerce_customers(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset', 'activation')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_customer_items (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES commerce_customers(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('product', 'license', 'download', 'order')),
    item_key TEXT NOT NULL,
    item_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (customer_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS commerce_customer_audit_log (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES commerce_customers(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commerce_customer_tokens_customer_idx
    ON commerce_customer_tokens (customer_id);

CREATE INDEX IF NOT EXISTS commerce_customer_tokens_unused_idx
    ON commerce_customer_tokens (purpose, expires_at)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS commerce_customer_items_customer_idx
    ON commerce_customer_items (customer_id, item_type);

CREATE INDEX IF NOT EXISTS commerce_customer_audit_customer_idx
    ON commerce_customer_audit_log (customer_id);

SELECT pg_advisory_unlock(76020045);
