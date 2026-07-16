import { PLAN_RULES, PRODUCT_ID, SUBSCRIPTION_STATUSES } from "./constants.js";
import { badRequest, conflict } from "./errors.js";
import { normalizeEmail } from "./security.js";

function assertString(value, name, required = true) {
  if (!required && (value === undefined || value === null || value === "")) {
    return "";
  }
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("invalid_request", `${name} is required.`);
  }
  return value.trim();
}

function assertIso(value, name) {
  const text = assertString(value, name);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("invalid_timestamp", `${name} must be a UTC ISO timestamp.`);
  }
  return date.toISOString();
}

function assertPlanMatch({ productId, sku, plan }) {
  const rule = PLAN_RULES[plan];
  if (productId !== PRODUCT_ID) {
    throw badRequest("invalid_product", "productId must be AURORA-XAU-AI.");
  }
  if (!rule) {
    throw badRequest("invalid_plan", "plan must be monthly or yearly.");
  }
  if (rule.sku !== sku) {
    throw conflict("sku_plan_mismatch", "sku does not match plan.");
  }
  return rule;
}

function validateSubscriptionMoney(rule, paypal) {
  const amount = assertString(paypal.amount, "paypal.amount");
  const currency = assertString(paypal.currency, "paypal.currency");
  if (amount !== rule.amount || currency !== rule.currency) {
    throw conflict("subscription_money_mismatch", "amount or currency does not match plan.");
  }
  return { amount, currency };
}

export function validateIssuePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("invalid_json", "Request body must be a JSON object.");
  }

  const productId = assertString(payload.productId, "productId");
  const sku = assertString(payload.sku, "sku");
  const plan = assertString(payload.plan, "plan");
  const rule = assertPlanMatch({ productId, sku, plan });

  const customer = payload.customer || {};
  const email = normalizeEmail(customer.email);
  if (!email || !email.includes("@")) {
    throw badRequest("invalid_customer_email", "customer.email is required.");
  }

  const paypal = payload.paypal || {};
  const captureId = assertString(paypal.captureId, "paypal.captureId");
  const status = assertString(paypal.status, "paypal.status");
  const idempotencyKey = assertString(payload.idempotencyKey, "idempotencyKey");

  if (status !== "Completed") {
    throw badRequest("invalid_payment_status", "paypal.status must be Completed.");
  }
  if (idempotencyKey !== captureId) {
    throw badRequest("invalid_idempotency_key", "idempotencyKey must equal paypal.captureId.");
  }

  return {
    productId,
    sku,
    plan,
    days: rule.days,
    customerEmail: email,
    customerName: typeof customer.name === "string" ? customer.name.trim() : "",
    paypalOrderId: assertString(paypal.orderId, "paypal.orderId", false),
    paypalCaptureId: captureId,
    paypalEventId: assertString(paypal.eventId, "paypal.eventId", false),
    paypalStatus: status,
    idempotencyKey
  };
}

export function validateSubscriptionActivatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("invalid_json", "Request body must be a JSON object.");
  }

  const productId = assertString(payload.productId, "productId");
  const sku = assertString(payload.sku, "sku");
  const plan = assertString(payload.plan, "plan");
  const rule = assertPlanMatch({ productId, sku, plan });
  const customer = payload.customer || {};
  const customerEmail = normalizeEmail(customer.email);
  if (!customerEmail || !customerEmail.includes("@")) {
    throw badRequest("invalid_customer_email", "customer.email is required.");
  }
  const paypal = payload.paypal || {};
  const subscriptionId = assertString(paypal.subscriptionId, "paypal.subscriptionId");
  const saleId = assertString(paypal.saleId, "paypal.saleId");
  const idempotencyKey = assertString(payload.idempotencyKey, "idempotencyKey");
  const status = assertString(paypal.status, "paypal.status");
  if (status !== "ACTIVE") {
    throw badRequest("invalid_subscription_status", "paypal.status must be ACTIVE.");
  }
  if (idempotencyKey !== saleId) {
    throw badRequest("invalid_idempotency_key", "idempotencyKey must equal paypal.saleId.");
  }
  const money = validateSubscriptionMoney(rule, paypal);
  const periodStart = assertIso(paypal.periodStart, "paypal.periodStart");
  const periodEnd = assertIso(paypal.periodEnd, "paypal.periodEnd");
  if (new Date(periodEnd).getTime() <= new Date(periodStart).getTime()) {
    throw badRequest("invalid_period", "periodEnd must be after periodStart.");
  }

  return {
    productId,
    sku,
    plan,
    days: rule.days,
    customerEmail,
    customerName: typeof customer.name === "string" ? customer.name.trim() : "",
    paypalSubscriptionId: subscriptionId,
    paypalPlanId: assertString(paypal.planId, "paypal.planId"),
    paypalSaleId: saleId,
    paypalEventId: assertString(paypal.eventId, "paypal.eventId", false),
    subscriptionStatus: status,
    amount: money.amount,
    currency: money.currency,
    paidAt: assertIso(paypal.paidAt, "paypal.paidAt"),
    periodStart,
    periodEnd,
    idempotencyKey
  };
}

export function validateSubscriptionRenewPayload(payload) {
  const renew = validateSubscriptionActivatePayload(payload);
  return renew;
}

export function validateSubscriptionStatusPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("invalid_json", "Request body must be a JSON object.");
  }
  const productId = assertString(payload.productId, "productId", false) || PRODUCT_ID;
  if (productId !== PRODUCT_ID) {
    throw badRequest("invalid_product", "productId must be AURORA-XAU-AI.");
  }
  const paypal = payload.paypal || {};
  const subscriptionId = assertString(paypal.subscriptionId, "paypal.subscriptionId");
  const eventId = assertString(paypal.eventId, "paypal.eventId");
  const status = assertString(paypal.status, "paypal.status");
  if (!SUBSCRIPTION_STATUSES.has(status)) {
    throw badRequest("invalid_subscription_status", "Unsupported subscription status.");
  }
  return {
    productId,
    paypalSubscriptionId: subscriptionId,
    paypalEventId: eventId,
    status,
    eventTime: assertIso(paypal.eventTime || payload.eventTime || new Date().toISOString(), "paypal.eventTime"),
    reason: assertString(paypal.reason || payload.reason, "reason", false)
  };
}

export function validateBotPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("invalid_json", "Request body must be a JSON object.");
  }

  const licenseKey = assertString(payload.license_key, "license_key");
  const accountLogin = Number(payload.account_login || 0);
  const accountServer = String(payload.account_server || "").trim();

  if (!Number.isInteger(accountLogin) || accountLogin <= 0) {
    throw badRequest("invalid_account_login", "account_login must be a positive integer.");
  }
  if (!accountServer) {
    throw badRequest("invalid_account_server", "account_server is required.");
  }

  return {
    licenseKey,
    accountLogin,
    accountServer,
    snapshot: {
      app: String(payload.app || ""),
      version: String(payload.version || ""),
      machine_hint: String(payload.machine_hint || ""),
      account_balance: Number(payload.account_balance || 0),
      account_equity: Number(payload.account_equity || 0),
      account_margin: Number(payload.account_margin || 0),
      account_free_margin: Number(payload.account_free_margin || 0),
      account_currency: String(payload.account_currency || ""),
      symbol: String(payload.symbol || ""),
      bot_open_positions: Number(payload.bot_open_positions || 0),
      bot_floating_pl: Number(payload.bot_floating_pl || 0),
      trading_day: String(payload.trading_day || ""),
      bot_today_pl: Number(payload.bot_today_pl || 0),
      daily_target_hit: Boolean(payload.daily_target_hit)
    }
  };
}
