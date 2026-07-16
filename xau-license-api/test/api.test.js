import assert from "node:assert/strict";
import http from "node:http";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createApp } from "../src/app.js";
import { PRODUCT_ID } from "../src/constants.js";
import { createLogger } from "../src/logger.js";
import { hmacLicenseKey } from "../src/security.js";
import { InMemoryStore } from "./helpers/inMemoryStore.js";

const config = {
  internalToken: "internal-token",
  licenseKeyPepper: "pepper"
};

function loggerWithCapture() {
  const lines = [];
  return {
    lines,
    logger: createLogger({
      log(line) {
        lines.push(line);
      },
      error(line) {
        lines.push(line);
      }
    })
  };
}

async function start(store = new InMemoryStore()) {
  const capture = loggerWithCapture();
  const server = http.createServer(createApp({ config, store, logger: capture.logger }));
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return {
    store,
    logs: capture.lines,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function postJson(baseUrl, path, body, token = config.internalToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: token ? `Bearer ${token}` : ""
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    data: await response.json()
  };
}

function issuePayload(overrides = {}) {
  return {
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    customer: {
      email: "Customer@Example.COM",
      name: "Customer Name"
    },
    paypal: {
      orderId: "ORDER-1",
      captureId: "CAPTURE-1",
      eventId: "EVENT-1",
      status: "Completed"
    },
    idempotencyKey: "CAPTURE-1",
    ...overrides
  };
}

function botPayload(licenseKey, overrides = {}) {
  return {
    app: "Aurora_XAU_Trader",
    version: "1.0.0",
    license_key: licenseKey,
    account_login: 160092738,
    account_server: "Demo-Server",
    machine_hint: "machine",
    account_balance: 1000,
    account_equity: 1000,
    account_margin: 0,
    account_free_margin: 1000,
    account_currency: "USD",
    symbol: "XAUUSD",
    bot_open_positions: 0,
    bot_floating_pl: 0,
    trading_day: "2026-07-16",
    bot_today_pl: 0,
    daily_target_hit: false,
    ...overrides
  };
}

class ConcurrentBindingStore extends InMemoryStore {
  constructor() {
    super();
    this.waiting = [];
  }

  async verifyLicense({ licenseKeyHash, accountLogin, accountServer }) {
    const license = this.licenses.find((item) => item.licenseKeyHash === licenseKeyHash);
    if (!license || license.binding) {
      return super.verifyLicense({ licenseKeyHash, accountLogin, accountServer });
    }

    await new Promise((resolve) => {
      this.waiting.push(resolve);
      if (this.waiting.length === 2) {
        for (const waiter of this.waiting.splice(0)) {
          waiter();
        }
      }
    });

    if (!license.binding) {
      license.binding = { accountLogin, accountServer };
      this.audit.push({ licenseId: license.id, action: "first_bind" });
      return { valid: true, reason: "ok", license };
    }
    if (license.binding.accountLogin === accountLogin && license.binding.accountServer === accountServer) {
      return { valid: true, reason: "ok", license };
    }
    return { valid: false, reason: "account_not_allowed", license };
  }
}

test("monthly first issue returns raw license once", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/licenses/issue", issuePayload());
    assert.equal(result.status, 200);
    assert.equal(result.data.status, "issued");
    assert.match(result.data.licenseKey, /^AURORA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(result.data.productId, PRODUCT_ID);
    assert.equal(result.data.sku, "aurora-xau-monthly");
    assert.equal(result.data.plan, "monthly");
    assert.equal(result.data.alreadyIssued, false);
  } finally {
    await app.close();
  }
});

test("yearly first issue", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/licenses/issue", issuePayload({
      sku: "aurora-xau-yearly",
      plan: "yearly",
      paypal: { orderId: "ORDER-2", captureId: "CAPTURE-2", eventId: "", status: "Completed" },
      idempotencyKey: "CAPTURE-2"
    }));
    assert.equal(result.status, 200);
    assert.equal(result.data.plan, "yearly");
    assert.equal(result.data.sku, "aurora-xau-yearly");
  } finally {
    await app.close();
  }
});

test("rejects permanent API issue", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/licenses/issue", issuePayload({
      sku: "aurora-xau-permanent",
      plan: "permanent"
    }));
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "invalid_plan");
  } finally {
    await app.close();
  }
});

test("rejects invalid bearer token", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/licenses/issue", issuePayload(), "bad-token");
    assert.equal(result.status, 401);
    assert.equal(result.data.code, "unauthorized");
  } finally {
    await app.close();
  }
});

test("same captureId duplicate does not return raw key again", async () => {
  const app = await start();
  try {
    const first = await postJson(app.url, "/api/v1/licenses/issue", issuePayload());
    const second = await postJson(app.url, "/api/v1/licenses/issue", issuePayload());
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.data.alreadyIssued, true);
    assert.equal(second.data.licenseKey, undefined);
    assert.equal(second.data.licenseKeyReadable, false);
    assert.equal(app.store.licenses.length, 1);
  } finally {
    await app.close();
  }
});

test("conflicting duplicate captureId returns 409", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/licenses/issue", issuePayload());
    const conflict = await postJson(app.url, "/api/v1/licenses/issue", issuePayload({
      plan: "yearly",
      sku: "aurora-xau-yearly"
    }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.code, "payment_payload_conflict");
  } finally {
    await app.close();
  }
});

test("first bind succeeds", async () => {
  const store = new InMemoryStore();
  const key = "AURORA-TEST-TEST-TEST-0001";
  await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    assert.equal(result.status, 200);
    assert.equal(result.data.valid, true);
    assert.equal(result.data.plan, "monthly");
  } finally {
    await app.close();
  }
});

test("correct account validates again", async () => {
  const store = new InMemoryStore();
  const key = "AURORA-TEST-TEST-TEST-0002";
  await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    assert.equal(result.data.valid, true);
  } finally {
    await app.close();
  }
});

test("wrong account is rejected", async () => {
  const store = new InMemoryStore();
  const key = "AURORA-TEST-TEST-TEST-0003";
  await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key, { account_login: 999 }), "");
    assert.equal(result.data.valid, false);
    assert.equal(result.data.reason, "account_not_allowed");
  } finally {
    await app.close();
  }
});

test("same account concurrent first bind returns valid for both requests", async () => {
  const store = new ConcurrentBindingStore();
  const key = "AURORA-TEST-TEST-TEST-0006";
  const license = await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    const [first, second] = await Promise.all([
      postJson(app.url, "/api/xau-bot/license", botPayload(key), ""),
      postJson(app.url, "/api/xau-bot/license", botPayload(key), "")
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.data.valid, true);
    assert.equal(second.data.valid, true);
    assert.equal(store.activeBindingCount(license.licenseKeyHash), 1);
  } finally {
    await app.close();
  }
});

test("different account concurrent first bind returns one valid and one account_not_allowed", async () => {
  const store = new ConcurrentBindingStore();
  const key = "AURORA-TEST-TEST-TEST-0007";
  const license = await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    const [first, second] = await Promise.all([
      postJson(app.url, "/api/xau-bot/license", botPayload(key), ""),
      postJson(app.url, "/api/xau-bot/license", botPayload(key, { account_login: 999 }), "")
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const results = [first.data, second.data];
    assert.equal(results.filter((item) => item.valid === true).length, 1);
    assert.equal(results.filter((item) => item.reason === "account_not_allowed").length, 1);
    assert.equal(store.activeBindingCount(license.licenseKeyHash), 1);
  } finally {
    await app.close();
  }
});

test("expired license is rejected", async () => {
  const store = new InMemoryStore();
  const key = "AURORA-TEST-TEST-TEST-0004";
  const license = await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  license.expiresAt = new Date(Date.now() - 1000).toISOString();
  const app = await start(store);
  try {
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    assert.equal(result.data.valid, false);
    assert.equal(result.data.reason, "license_expired");
  } finally {
    await app.close();
  }
});

test("disabled license is rejected", async () => {
  const store = new InMemoryStore();
  const key = "AURORA-TEST-TEST-TEST-0005";
  const license = await store.issueManual({
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    days: 30,
    customerEmail: "customer@example.com",
    customerName: "Customer",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  license.status = "disabled";
  const app = await start(store);
  try {
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    assert.equal(result.data.valid, false);
    assert.equal(result.data.reason, "license_disabled");
  } finally {
    await app.close();
  }
});

test("manual permanent CLI validates required flags without issuing", () => {
  const result = spawnSync(process.execPath, ["src/cli/issue-manual.js", "--plan", "permanent"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Permanent licenses are server-owner manual licenses only/);
});

test("logs do not contain license key or token", async () => {
  const app = await start();
  const licenseKey = "AURORA-SHOULD-NOT-LEAK-0001";
  try {
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(licenseKey), "secret-token-value");
    assert.equal(result.status, 200);
    assert.equal(result.data.valid, false);
    const logs = app.logs.join("\n");
    assert.equal(logs.includes(licenseKey), false);
    assert.equal(logs.includes("secret-token-value"), false);
  } finally {
    await app.close();
  }
});
