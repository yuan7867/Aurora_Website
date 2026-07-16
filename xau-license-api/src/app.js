import { MAX_BODY_BYTES } from "./constants.js";
import { ApiError, badRequest } from "./errors.js";
import { RateLimiter } from "./rateLimit.js";
import { bearerToken, constantTimeEquals, generateLicenseKey, hmacLicenseKey } from "./security.js";
import {
  validateBotPayload,
  validateIssuePayload,
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
      const error = new ApiError(413, "payload_too_large", "Request body is too large.");
      throw error;
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
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function botLicenseResponse(result) {
  if (!result.valid) {
    return {
      valid: false,
      reason: result.reason
    };
  }

  const response = {
    valid: true,
    plan: result.license.plan,
    expires_at: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
    support: {}
  };
  if (result.license.subscriptionStatus) {
    response.subscription_status = result.license.subscriptionStatus;
    response.grace_until = result.license.graceUntil ? new Date(result.license.graceUntil).toISOString() : "";
  }
  return response;
}

export function createApp({ config, store, logger }) {
  const limiter = new RateLimiter();

  async function issueLicense(request, response) {
    const token = bearerToken(request.headers);
    if (!constantTimeEquals(token, config.internalToken)) {
      sendJson(response, 401, {
        status: "error",
        code: "unauthorized"
      });
      return;
    }

    const payload = await readJson(request);
    const issue = validateIssuePayload(payload);
    const rawLicenseKey = generateLicenseKey();
    const result = await store.issueLicense({
      ...issue,
      licenseKeyHash: hmacLicenseKey(rawLicenseKey, config.licenseKeyPepper)
    });

    if (result.alreadyIssued) {
      sendJson(response, 200, {
        status: "issued",
        productId: result.license.productId,
        sku: result.license.sku,
        plan: result.license.plan,
        expiresAt: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
        alreadyIssued: true,
        licenseKeyReadable: false
      });
      return;
    }

    sendJson(response, 200, {
      status: "issued",
      licenseKey: rawLicenseKey,
      productId: result.license.productId,
      sku: result.license.sku,
      plan: result.license.plan,
      expiresAt: result.license.expiresAt ? new Date(result.license.expiresAt).toISOString() : "",
      alreadyIssued: false
    });
  }

  async function verifyBotLicense(request, response) {
    const ip = request.socket?.remoteAddress || "unknown";
    if (!limiter.allow(ip)) {
      sendJson(response, 429, {
        valid: false,
        reason: "rate_limited"
      });
      return;
    }

    const payload = await readJson(request);
    const bot = validateBotPayload(payload);
    const result = await store.verifyLicense({
      licenseKeyHash: hmacLicenseKey(bot.licenseKey, config.licenseKeyPepper),
      accountLogin: bot.accountLogin,
      accountServer: bot.accountServer,
      snapshot: bot.snapshot
    });

    sendJson(response, 200, botLicenseResponse(result));
  }

  function authorizeInternal(request, response) {
    const token = bearerToken(request.headers);
    if (!constantTimeEquals(token, config.internalToken)) {
      sendJson(response, 401, {
        status: "error",
        code: "unauthorized"
      });
      return false;
    }
    return true;
  }

  async function activateSubscription(request, response) {
    if (!authorizeInternal(request, response)) {
      return;
    }
    const payload = await readJson(request);
    const subscription = validateSubscriptionActivatePayload(payload);
    const rawLicenseKey = generateLicenseKey();
    const result = await store.activateSubscription({
      ...subscription,
      licenseKeyHash: hmacLicenseKey(rawLicenseKey, config.licenseKeyPepper)
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

  async function renewSubscription(request, response) {
    if (!authorizeInternal(request, response)) {
      return;
    }
    const payload = await readJson(request);
    const subscription = validateSubscriptionRenewPayload(payload);
    const result = await store.renewSubscription(subscription);
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
    if (!authorizeInternal(request, response)) {
      return;
    }
    const payload = await readJson(request);
    const status = validateSubscriptionStatusPayload(payload);
    const result = await store.updateSubscriptionStatus(status);
    sendJson(response, 200, {
      status: result.ignored ? "ignored" : "updated",
      subscriptionId: status.paypalSubscriptionId,
      alreadyProcessed: result.alreadyProcessed,
      subscriptionStatus: result.license?.subscriptionStatus
    });
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

      if (request.method === "POST" && url.pathname === "/api/v1/licenses/issue") {
        await issueLicense(request, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/subscriptions/activate") {
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

      if (request.method === "POST" && url.pathname === "/api/xau-bot/license") {
        await verifyBotLicense(request, response);
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

      sendJson(response, statusCode, {
        status: "error",
        code: error.code || "internal_error"
      });
    }
  };
}
