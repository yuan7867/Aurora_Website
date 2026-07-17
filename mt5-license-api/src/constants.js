export const PRODUCT_ID = "AURORA-MT5-AI";
export const PRODUCT_APP = "aurora_mt5_ai_trader";
export const LICENSE_PREFIX = "AURORA-MT5";
export const MAX_BODY_BYTES = 64 * 1024;
export const GRACE_HOURS = 72;

export const PLANS = Object.freeze({
  monthly: {
    sku: "aurora-mt5-monthly",
    plan: "monthly",
    amount: "19.90",
    currency: "USD"
  },
  yearly: {
    sku: "aurora-mt5-yearly",
    plan: "yearly",
    amount: "199.00",
    currency: "USD"
  }
});

export const PUBLIC_SUBSCRIPTION_SKUS = new Set(Object.values(PLANS).map((item) => item.sku));
export const PUBLIC_SUBSCRIPTION_PLANS = new Set(Object.keys(PLANS));
export const SUBSCRIPTION_STATUSES = new Set([
  "ACTIVE",
  "PAYMENT_FAILED",
  "CANCELLED",
  "SUSPENDED",
  "EXPIRED",
  "REFUNDED",
  "REVERSED"
]);
