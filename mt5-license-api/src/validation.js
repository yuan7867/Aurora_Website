import { badRequest } from "./errors.js";
import { PLANS, PRODUCT_ID, PUBLIC_SUBSCRIPTION_SKUS, SUBSCRIPTION_STATUSES } from "./constants.js";

function text(value, field) {
  const result = String(value || "").trim();
  if (!result) {
    throw badRequest("missing_field", `${field} is required.`);
  }
  return result;
}

function optionalText(value) {
  return String(value || "").trim();
}

function isoDate(value, field) {
  const result = text(value, field);
  const time = new Date(result).getTime();
  if (!Number.isFinite(time)) {
    throw badRequest("invalid_date", `${field} must be an ISO timestamp.`);
  }
  return new Date(time).toISOString();
}

function assertOfficialSubscription({ productId, sku, plan, amount, currency, paymentStatus }) {
  if (productId !== PRODUCT_ID) {
    throw badRequest("invalid_product", "productId must be AURORA-MT5-AI.");
  }
  if (!PUBLIC_SUBSCRIPTION_SKUS.has(sku)) {
    throw badRequest("invalid_sku", "sku must be an official MT5 subscription SKU.");
  }
  const expected = PLANS[plan];
  if (!expected || expected.sku !== sku) {
    throw badRequest("invalid_plan", "plan must match the subscription SKU.");
  }
  if (String(amount) !== expected.amount) {
    throw badRequest("invalid_price", "amount does not match the official price.");
  }
  if (currency !== expected.currency) {
    throw badRequest("invalid_currency", "currency must be USD.");
  }
  if (String(paymentStatus).toUpperCase() !== "COMPLETED") {
    throw badRequest("invalid_payment_status", "payment status must be COMPLETED.");
  }
}

export function validateSubscriptionActivatePayload(payload) {
  const paypal = payload.paypal || {};
  const customer = payload.customer || {};
  const productId = text(payload.productId, "productId");
  const sku = text(payload.sku, "sku");
  const plan = text(payload.plan, "plan");
  const amount = text(paypal.amount, "paypal.amount");
  const currency = text(paypal.currency, "paypal.currency");
  const paymentStatus = text(paypal.status, "paypal.status");
  assertOfficialSubscription({ productId, sku, plan, amount, currency, paymentStatus });
  return {
    productId,
    sku,
    plan,
    customerEmail: optionalText(customer.email).toLowerCase(),
    customerName: optionalText(customer.name),
    paypalSubscriptionId: text(paypal.subscriptionId, "paypal.subscriptionId"),
    paypalPlanId: text(paypal.planId, "paypal.planId"),
    paypalSaleId: text(paypal.saleId, "paypal.saleId"),
    paypalEventId: text(paypal.eventId, "paypal.eventId"),
    amount,
    currency,
    paymentStatus: "COMPLETED",
    paidAt: isoDate(paypal.paidAt || paypal.eventTime || new Date().toISOString(), "paypal.paidAt"),
    periodStart: isoDate(paypal.periodStart, "paypal.periodStart"),
    periodEnd: isoDate(paypal.periodEnd, "paypal.periodEnd")
  };
}

export function validateSubscriptionRenewPayload(payload) {
  return validateSubscriptionActivatePayload(payload);
}

export function validateSubscriptionStatusPayload(payload) {
  const paypal = payload.paypal || payload;
  const productId = text(payload.productId || PRODUCT_ID, "productId");
  if (productId !== PRODUCT_ID) {
    throw badRequest("invalid_product", "productId must be AURORA-MT5-AI.");
  }
  const status = text(paypal.status, "paypal.status").toUpperCase();
  if (!SUBSCRIPTION_STATUSES.has(status)) {
    throw badRequest("invalid_subscription_status", "Unsupported subscription status.");
  }
  return {
    productId,
    paypalSubscriptionId: text(paypal.subscriptionId, "paypal.subscriptionId"),
    paypalEventId: text(paypal.eventId, "paypal.eventId"),
    status,
    eventTime: isoDate(paypal.eventTime || new Date().toISOString(), "paypal.eventTime"),
    reason: optionalText(paypal.reason)
  };
}

export function validateBotPayload(payload) {
  const licenseKey = text(payload.license_key || payload.licenseKey, "license_key");
  return {
    licenseKey,
    app: optionalText(payload.app || payload.product),
    accountLogin: text(payload.account_login || payload.accountLogin, "account_login"),
    accountServer: text(payload.account_server || payload.accountServer, "account_server"),
    machineHint: optionalText(payload.machine_hint || payload.machineHint),
    version: optionalText(payload.version),
    snapshot: {
      accountBalance: payload.account_balance,
      accountEquity: payload.account_equity,
      symbol: payload.symbol,
      version: payload.version
    }
  };
}
