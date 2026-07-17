BEGIN;

CREATE TABLE IF NOT EXISTS mt5_licenses (
  id BIGSERIAL PRIMARY KEY,
  license_key_hash TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL CHECK (product_id = 'AURORA-MT5-AI'),
  sku TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly','yearly','permanent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  customer_email TEXT,
  customer_name TEXT,
  issued_by TEXT NOT NULL CHECK (issued_by IN ('api','manual-cli')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  latest_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  paypal_subscription_id TEXT UNIQUE,
  paypal_plan_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE','PAYMENT_FAILED','CANCELLED','SUSPENDED','EXPIRED','REFUNDED','REVERSED')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  last_successful_sale_id TEXT,
  last_payment_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  latest_subscription_event_at TIMESTAMPTZ,
  manual_review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (plan = 'permanent' AND paypal_subscription_id IS NULL AND subscription_status IS NULL)
    OR
    (plan IN ('monthly','yearly') AND paypal_subscription_id IS NOT NULL AND subscription_status IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS mt5_license_bindings (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES mt5_licenses(id) ON DELETE RESTRICT,
  account_login BIGINT NOT NULL,
  account_server TEXT NOT NULL,
  machine_hint_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mt5_subscription_payments (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES mt5_licenses(id) ON DELETE RESTRICT,
  paypal_sale_id TEXT NOT NULL UNIQUE,
  paypal_subscription_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  payment_status TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end > period_start)
);

CREATE TABLE IF NOT EXISTS mt5_subscription_events (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES mt5_licenses(id) ON DELETE RESTRICT,
  paypal_subscription_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  event_status TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt5_pending_license_deliveries (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES mt5_licenses(id) ON DELETE RESTRICT,
  paypal_sale_id TEXT NOT NULL UNIQUE,
  paypal_subscription_id TEXT NOT NULL,
  encrypted_license_key TEXT,
  encryption_iv TEXT,
  encryption_auth_tag TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mt5_license_audit_log (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT REFERENCES mt5_licenses(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mt5_licenses_subscription_status ON mt5_licenses(subscription_status);
CREATE INDEX IF NOT EXISTS idx_mt5_licenses_current_period_end ON mt5_licenses(current_period_end);
CREATE INDEX IF NOT EXISTS idx_mt5_bindings_license_active ON mt5_license_bindings(license_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mt5_one_active_binding ON mt5_license_bindings(license_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mt5_payments_subscription ON mt5_subscription_payments(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_mt5_events_subscription ON mt5_subscription_events(paypal_subscription_id);

COMMIT;
