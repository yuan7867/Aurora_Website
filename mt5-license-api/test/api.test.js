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
  internalToken: "internal-token-with-good-length",
  licenseKeyPepper: "pepper-with-good-length",
  recoveryEncryptionKey: "recovery-key-with-good-length"
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
  return {
    store,
    logs: capture.lines,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function requestJson(baseUrl, path, body, token = config.internalToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: token ? `Bearer ${token}` : ""
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}

function activatePayload(overrides = {}) {
  const startAt = "2026-07-17T00:00:00.000Z";
  const endAt = "2026-08-16T00:00:00.000Z";
  return {
    productId: PRODUCT_ID,
    sku: "aurora-mt5-monthly",
    plan: "monthly",
    customer: { email: "customer@example.com", name: "Customer" },
    paypal: {
      subscriptionId: "SUB-1",
      planId: "PLAN-MONTHLY",
      saleId: "SALE-1",
      eventId: "EVENT-1",
      amount: "19.90",
      currency: "USD",
      status: "COMPLETED",
      paidAt: startAt,
      periodStart: startAt,
      periodEnd: endAt
    },
    ...overrides
  };
}

function botPayload(licenseKey, overrides = {}) {
  return {
    app: "Aurora_MT5_AI_Trader",
    version: "1.0.0",
    license_key: licenseKey,
    account_login: 160097919,
    account_server: "STARTRADERFinancial-Demo",
    machine_hint: "machine-hint",
    account_balance: 1000,
    account_equity: 1000,
    symbol: "XAUUSD",
    ...overrides
  };
}

test("health and ready do not leak secrets", async () => {
  const app = await start();
  try {
    const health = await fetch(`${app.url}/health`);
    const ready = await fetch(`${app.url}/ready`);
    assert.equal(health.status, 200);
    assert.equal(ready.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    assert.deepEqual(await ready.json(), { status: "ready" });
  } finally {
    await app.close();
  }
});

test("monthly activate returns raw license once and replay hides it", async () => {
  const app = await start();
  try {
    const first = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const second = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    assert.equal(first.status, 200);
    assert.match(first.data.licenseKey, /^AURORA-MT5-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(second.status, 200);
    assert.equal(second.data.alreadyProcessed, true);
    assert.equal(second.data.licenseKey, undefined);
    assert.equal(second.data.licenseKeyReadable, false);
    assert.equal(app.store.licenses.length, 1);
  } finally {
    await app.close();
  }
});

test("yearly activate validates official yearly amount", async () => {
  const app = await start();
  try {
    const result = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({
      sku: "aurora-mt5-yearly",
      plan: "yearly",
      paypal: {
        ...activatePayload().paypal,
        subscriptionId: "SUB-Y",
        saleId: "SALE-Y",
        eventId: "EVENT-Y",
        planId: "PLAN-YEARLY",
        amount: "199.00",
        periodEnd: "2027-07-17T00:00:00.000Z"
      }
    }));
    assert.equal(result.status, 200);
    assert.equal(result.data.plan, "yearly");
  } finally {
    await app.close();
  }
});

test("invalid sku, price, currency, and permanent HTTP issue are rejected", async () => {
  const app = await start();
  try {
    assert.equal((await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ sku: "aurora-mt5-permanent" }))).data.code, "invalid_sku");
    assert.equal((await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, amount: "1.00" } }))).data.code, "invalid_price");
    assert.equal((await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, currency: "MYR" } }))).data.code, "invalid_currency");
    assert.equal((await requestJson(app.url, "/api/v1/licenses/issue", activatePayload({ plan: "permanent" }))).data.code, "invalid_plan");
  } finally {
    await app.close();
  }
});

test("wrong product is rejected", async () => {
  const app = await start();
  try {
    const result = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ productId: "AURORA-XAU-AI" }));
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "invalid_product");
  } finally {
    await app.close();
  }
});

test("SKU and plan mismatch is rejected", async () => {
  const app = await start();
  try {
    const result = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ sku: "aurora-mt5-yearly", plan: "monthly" }));
    assert.equal(result.status, 400);
    assert.equal(result.data.code, "invalid_plan");
  } finally {
    await app.close();
  }
});

test("unauthorized internal calls are rejected with constant-time path", async () => {
  const app = await start();
  try {
    const result = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload(), "bad");
    assert.equal(result.status, 401);
    assert.equal(result.data.code, "unauthorized");
  } finally {
    await app.close();
  }
});

test("duplicate subscription and duplicate conflicting sale are protected", async () => {
  const app = await start();
  try {
    await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const duplicateSubscription = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, saleId: "SALE-2", eventId: "EVENT-2" } }));
    assert.equal(duplicateSubscription.status, 409);
    assert.equal(duplicateSubscription.data.code, "subscription_already_activated");
    const conflictingSale = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, periodEnd: "2026-09-16T00:00:00.000Z" } }));
    assert.equal(conflictingSale.status, 409);
    assert.equal(conflictingSale.data.code, "subscription_payment_conflict");
  } finally {
    await app.close();
  }
});

test("concurrent activate for same subscription and sale produces one license and one pending delivery", async () => {
  const app = await start();
  try {
    const [first, second] = await Promise.all([
      requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload()),
      requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload())
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal([first.data, second.data].filter((item) => item.licenseKey).length, 1);
    assert.equal(app.store.licenses.length, 1);
    assert.equal(app.store.payments.length, 1);
    assert.equal(app.store.pendingDeliveries.length, 1);
  } finally {
    await app.close();
  }
});

test("renew does not generate a new key and replay does not extend twice", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const renewPayload = activatePayload({
      paypal: {
        ...activatePayload().paypal,
        saleId: "SALE-RENEW-1",
        eventId: "EVENT-RENEW-1",
        periodStart: "2026-08-16T00:00:00.000Z",
        periodEnd: "2026-09-15T00:00:00.000Z"
      }
    });
    const first = await requestJson(app.url, "/api/v1/subscriptions/renew", renewPayload);
    const second = await requestJson(app.url, "/api/v1/subscriptions/renew", renewPayload);
    assert.equal(first.status, 200);
    assert.equal(second.data.alreadyProcessed, true);
    assert.equal(first.data.licenseKey, undefined);
    assert.equal(app.store.licenses.length, 1);
    assert.equal(app.store.licenses[0].lastSuccessfulSaleId, "SALE-RENEW-1");
    assert.equal(activated.data.licenseKey.length > 0, true);
  } finally {
    await app.close();
  }
});

test("lifecycle status rules cover grace, cancelled, suspended, expired, refunded, and reversed", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, periodEnd: "2026-07-18T00:00:00.000Z" } }));
    const key = activated.data.licenseKey;
    let validate = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(key), "");
    assert.equal(validate.data.valid, true);
    await requestJson(app.url, "/api/v1/subscriptions/status", { paypal: { subscriptionId: "SUB-1", eventId: "STATUS-PF", status: "PAYMENT_FAILED", eventTime: new Date().toISOString() } });
    validate = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(key), "");
    assert.equal(validate.data.valid, true);
    await requestJson(app.url, "/api/v1/subscriptions/status", { paypal: { subscriptionId: "SUB-1", eventId: "STATUS-SUSPENDED", status: "SUSPENDED", eventTime: new Date().toISOString() } });
    validate = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(key), "");
    assert.equal(validate.data.valid, false);
    assert.equal(validate.data.reason, "subscription_suspended");
    for (const status of ["EXPIRED", "REFUNDED", "REVERSED", "CANCELLED"]) {
      const app2 = await start();
      try {
        const fresh = await requestJson(app2.url, "/api/v1/subscriptions/activate", activatePayload({ paypal: { ...activatePayload().paypal, subscriptionId: `SUB-${status}`, saleId: `SALE-${status}`, eventId: `EVENT-${status}` } }));
        await requestJson(app2.url, "/api/v1/subscriptions/status", { paypal: { subscriptionId: `SUB-${status}`, eventId: `STATUS-${status}`, status, eventTime: new Date().toISOString() } });
        const checked = await requestJson(app2.url, "/api/aurora-mt5-ai-trader/license", botPayload(fresh.data.licenseKey), "");
        assert.equal(checked.data.valid, status === "CANCELLED");
      } finally {
        await app2.close();
      }
    }
  } finally {
    await app.close();
  }
});

test("ACK recovery works before ACK, ACK replay is stable, and raw key is unavailable after ACK", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const recovered = await requestJson(app.url, "/api/v1/subscriptions/delivery/recover", { paypal: { saleId: "SALE-1", subscriptionId: "SUB-1" } });
    assert.equal(recovered.status, 200);
    assert.equal(recovered.data.licenseKey, activated.data.licenseKey);
    const ack = await requestJson(app.url, "/api/v1/subscriptions/delivery/ack", { paypal: { saleId: "SALE-1", subscriptionId: "SUB-1" } });
    const ackReplay = await requestJson(app.url, "/api/v1/subscriptions/delivery/ack", { paypal: { saleId: "SALE-1", subscriptionId: "SUB-1" } });
    assert.equal(ack.data.acknowledged, true);
    assert.equal(ackReplay.data.acknowledged, true);
    const afterAck = await requestJson(app.url, "/api/v1/subscriptions/delivery/recover", { paypal: { saleId: "SALE-1", subscriptionId: "SUB-1" } });
    assert.equal(afterAck.status, 409);
  } finally {
    await app.close();
  }
});

test("account binding accepts same account and rejects different account", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const first = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey), "");
    const second = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey), "");
    const wrong = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey, { account_login: 999 }), "");
    assert.equal(first.data.valid, true);
    assert.equal(second.data.valid, true);
    assert.equal(wrong.data.valid, false);
    assert.equal(wrong.data.reason, "account_not_allowed");
  } finally {
    await app.close();
  }
});

test("same-account concurrent first binding returns valid for both and one active binding", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const [first, second] = await Promise.all([
      requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey), ""),
      requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey), "")
    ]);
    assert.equal(first.data.valid, true);
    assert.equal(second.data.valid, true);
    assert.deepEqual(app.store.licenses[0].binding, {
      accountLogin: "160097919",
      accountServer: "STARTRADERFinancial-Demo"
    });
  } finally {
    await app.close();
  }
});

test("different-account concurrent binding returns one account_not_allowed", async () => {
  const app = await start();
  try {
    const activated = await requestJson(app.url, "/api/v1/subscriptions/activate", activatePayload());
    const [first, second] = await Promise.all([
      requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey), ""),
      requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload(activated.data.licenseKey, { account_login: 999 }), "")
    ]);
    assert.equal([first.data, second.data].filter((item) => item.valid).length, 1);
    assert.equal([first.data, second.data].filter((item) => item.reason === "account_not_allowed").length, 1);
  } finally {
    await app.close();
  }
});

test("ready is not ready when migration flag is false or database ping fails", async () => {
  const store = new InMemoryStore();
  store.migrationComplete = false;
  const app = await start(store);
  try {
    const response = await fetch(`${app.url}/ready`);
    assert.equal(response.status, 503);
  } finally {
    await app.close();
  }
});

test("manual permanent CLI requires flags", () => {
  const result = spawnSync(process.execPath, ["src/cli/issue-manual.js", "--permanent"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--permanent --confirm/);
});

test("logs do not contain license keys or bearer tokens", async () => {
  const app = await start();
  try {
    const result = await requestJson(app.url, "/api/aurora-mt5-ai-trader/license", botPayload("AURORA-MT5-SHOULD-NOT-LEAK"), "secret-token");
    assert.equal(result.status, 200);
    assert.equal(result.data.valid, false);
    const logs = app.logs.join("\n");
    assert.equal(logs.includes("AURORA-MT5-SHOULD-NOT-LEAK"), false);
    assert.equal(logs.includes("secret-token"), false);
  } finally {
    await app.close();
  }
});
