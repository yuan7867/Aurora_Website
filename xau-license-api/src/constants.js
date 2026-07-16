export const PRODUCT_ID = "AURORA-XAU-AI";

export const PLAN_RULES = {
  monthly: {
    sku: "aurora-xau-monthly",
    days: 30,
    amount: "19.90",
    currency: "USD"
  },
  yearly: {
    sku: "aurora-xau-yearly",
    days: 365,
    amount: "199.00",
    currency: "USD"
  }
};

export const MAX_BODY_BYTES = 32 * 1024;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 90;
export const SUBSCRIPTION_STATUSES = new Set([
  "ACTIVE",
  "CANCELLED",
  "SUSPENDED",
  "EXPIRED",
  "PAYMENT_FAILED",
  "REFUNDED",
  "REVERSED"
]);
