import { ApiError, unauthorized } from "./errors.js";
import { MAX_BODY_BYTES } from "./constants.js";
import { RateLimiter } from "./rateLimit.js";
import {
  bearerToken,
  constantTimeEquals,
  decryptRecoveryLicenseKey,
  encryptRecoveryLicenseKey,
  generateLicenseKey,
  hmacLicenseKey,
  hmacMachineHint
} from "./security.js";
import {
  validateBotPayload,
  validateSubscriptionActivatePayload,
  validateSubscriptionRenewPayload,
  validateSubscriptionStatusPayload
} from "./validation.js";

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, "payload_too_large", "Request body is too large.");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function authorizeInternal(request, config) {
  if (!constantTimeEquals(bearerToken(request.headers), config.internalToken)) {
    throw unauthorized();
  }
}

function validationResponse(result) {
  if (!result.valid) {
    return {
      valid: false,
      reason: result.reason,
      code: result.reason
    };
  }
  return {
    valid: true,
    plan: result.license.plan,
    expires_at: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
    current_period_end: result.license.currentPeriodEnd ? new Date(result.license.currentPeriodEnd).toISOString() : "",
    subscription_status: result.license.subscriptionStatus || "",
    support: result.support || {}
  };
}

export function createApp({ config, store, logger }) {
  const limiter = new RateLimiter();

  async function activateSubscription(request, response) {
    authorizeInternal(request, config);
    const payload = validateSubscriptionActivatePayload(await readJson(request));
    const rawLicenseKey = generateLicenseKey();
    const result = await store.activateSubscription({
      ...payload,
      licenseKeyHash: hmacLicenseKey(rawLicenseKey, config.licenseKeyPepper),
      recovery: encryptRecoveryLicenseKey(rawLicenseKey, config)
    });
    if (result.alreadyProcessed) {
      sendJson(response, 200, {
        status: "activated",
        licenseId: String(result.license.id),
        subscriptionId: result.license.paypalSubscriptionId,
        plan: result.license.plan,
        expiresAt: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
        alreadyProcessed: true,
        licenseKeyReadable: false
      });
      return;
    }
    sendJson(response, 200, {
      status: "activated",
      licenseKey: rawLicenseKey,
      licenseId: String(result.license.id),
      subscriptionId: result.license.paypalSubscriptionId,
      productId: result.license.productId,
      sku: result.license.sku,
      plan: result.license.plan,
      expiresAt: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
      alreadyProcessed: false
    });
  }

  async function recoverSubscriptionLicenseKey(request, response) {
    authorizeInternal(request, config);
    const payload = await readJson(request);
    const paypal = payload.paypal || {};
    const record = await store.recoverSubscriptionLicenseKey({
      paypalSaleId: String(paypal.saleId || ""),
      paypalSubscriptionId: String(paypal.subscriptionId || "")
    });
    if (!record?.encryptedLicenseKey) {
      sendJson(response, 409, { status: "manual_recovery", code: "license_key_not_recoverable" });
      return;
    }
    sendJson(response, 200, {
      status: "recoverable",
      licenseKey: decryptRecoveryLicenseKey(record, config),
      licenseId: String(record.licenseId),
      subscriptionId: record.paypalSubscriptionId
    });
  }

  async function acknowledgeSubscriptionDelivery(request, response) {
    authorizeInternal(request, config);
    const payload = await readJson(request);
    const paypal = payload.paypal || {};
    const result = await store.acknowledgeSubscriptionDelivery({
      paypalSaleId: String(paypal.saleId || ""),
      paypalSubscriptionId: String(paypal.subscriptionId || "")
    });
    sendJson(response, 200, {
      status: result.acknowledged ? "acknowledged" : "manual_recovery",
      acknowledged: result.acknowledged
    });
  }

  async function renewSubscription(request, response) {
    authorizeInternal(request, config);
    const payload = validateSubscriptionRenewPayload(await readJson(request));
    const result = await store.renewSubscription(payload);
    sendJson(response, 200, {
      status: "renewed",
      licenseId: String(result.license.id),
      subscriptionId: result.license.paypalSubscriptionId,
      plan: result.license.plan,
      expiresAt: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
      alreadyProcessed: result.alreadyProcessed
    });
  }

  async function updateSubscriptionStatus(request, response) {
    authorizeInternal(request, config);
    const payload = validateSubscriptionStatusPayload(await readJson(request));
    const result = await store.updateSubscriptionStatus(payload);
    sendJson(response, 200, {
      status: result.ignored ? "ignored" : "updated",
      subscriptionId: payload.paypalSubscriptionId,
      alreadyProcessed: result.alreadyProcessed,
      subscriptionStatus: result.license?.subscriptionStatus
    });
  }

  async function verifyMt5Client(request, response) {
    const ip = request.socket?.remoteAddress || "unknown";
    if (!limiter.allow(ip)) {
      sendJson(response, 429, { valid: false, reason: "rate_limited", code: "rate_limited" });
      return;
    }
    const payload = validateBotPayload(await readJson(request));
    const result = await store.verifyLicense({
      licenseKeyHash: hmacLicenseKey(payload.licenseKey, config.licenseKeyPepper),
      accountLogin: payload.accountLogin,
      accountServer: payload.accountServer,
      machineHintHash: hmacMachineHint(payload.machineHint, config.licenseKeyPepper),
      snapshot: payload.snapshot
    });
    sendJson(response, 200, validationResponse(result));
  }

  return async function handler(request, response) {
    const url = new URL(request.url, "http://localhost");
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        if (!store.migrationComplete) {
          sendJson(response, 503, { status: "not_ready" });
          return;
        }
        await store.pingReadWrite();
        sendJson(response, 200, { status: "ready" });
        return;
      }
      if (request.method === "POST" && (url.pathname === "/api/v1/subscriptions/activate" || url.pathname === "/api/v1/licenses/issue")) {
        await activateSubscription(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/subscriptions/renew") {
        await renewSubscription(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/subscriptions/status") {
        await updateSubscriptionStatus(request, response);
        return;
      }
      if (request.method === "POST" && (url.pathname === "/api/v1/subscriptions/delivery/recover" || url.pathname === "/api/v1/subscriptions/recover-key")) {
        await recoverSubscriptionLicenseKey(request, response);
        return;
      }
      if (request.method === "POST" && (url.pathname === "/api/v1/subscriptions/delivery/ack" || url.pathname === "/api/v1/subscriptions/ack-delivery")) {
        await acknowledgeSubscriptionDelivery(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/aurora-mt5-ai-trader/license") {
        await verifyMt5Client(request, response);
        return;
      }
      sendJson(response, 404, { status: "not_found" });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        logger.error("request failed", { code: error.code || "internal_error", path: url.pathname });
      } else {
        logger.warn("request rejected", { code: error.code || "bad_request", path: url.pathname });
      }
      sendJson(response, statusCode, { status: "error", code: error.code || "internal_error" });
    }
  };
}
