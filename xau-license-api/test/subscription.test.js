import assert from "node:assert/strict";
import http from "node:http";
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

async function start(store = new InMemoryStore()) {
  const logs = [];
  const logger = createLogger({
    log(line) {
      logs.push(line);
    },
    error(line) {
      logs.push(line);
    }
  });
  const server = http.createServer(createApp({ config, store, logger }));
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    store,
    logs,
    url: `http://127.0.0.1:${server.address().port}`,
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

function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function subPayload(overrides = {}) {
  return {
    productId: PRODUCT_ID,
    sku: "aurora-xau-monthly",
    plan: "monthly",
    customer: {
      email: "customer@example.com",
      name: "Customer"
    },
    paypal: {
      subscriptionId: "SUB-1",
      planId: "PLAN-MONTHLY",
      saleId: "SALE-1",
      eventId: "EVENT-1",
      status: "ACTIVE",
      amount: "19.90",
      currency: "USD",
      paidAt: iso(-1000),
      periodStart: iso(-1000),
      periodEnd: iso(30 * 24 * 60 * 60 * 1000)
    },
    idempotencyKey: "SALE-1",
    ...overrides
  };
}

function yearlyPayload(overrides = {}) {
  return subPayload({
    sku: "aurora-xau-yearly",
    plan: "yearly",
    paypal: {
      subscriptionId: "SUB-YEAR",
      planId: "PLAN-YEARLY",
      saleId: "SALE-YEAR-1",
      eventId: "EVENT-YEAR-1",
      status: "ACTIVE",
      amount: "199.00",
      currency: "USD",
      paidAt: iso(-1000),
      periodStart: iso(-1000),
      periodEnd: iso(365 * 24 * 60 * 60 * 1000)
    },
    idempotencyKey: "SALE-YEAR-1",
    ...overrides
  });
}

function renewPayload(overrides = {}) {
  return subPayload({
    paypal: {
      subscriptionId: "SUB-1",
      planId: "PLAN-MONTHLY",
      saleId: "SALE-2",
      eventId: "EVENT-2",
      status: "ACTIVE",
      amount: "19.90",
      currency: "USD",
      paidAt: iso(1000),
      periodStart: iso(30 * 24 * 60 * 60 * 1000),
      periodEnd: iso(60 * 24 * 60 * 60 * 1000)
    },
    idempotencyKey: "SALE-2",
    ...overrides
  });
}

function statusPayload(status, overrides = {}) {
  return {
    productId: PRODUCT_ID,
    paypal: {
      subscriptionId: "SUB-1",
      eventId: `STATUS-${status}-${Date.now()}-${Math.random()}`,
      status,
      eventTime: iso(0),
      reason: ""
    },
    ...overrides
  };
}

function botPayload(licenseKey) {
  return {
    license_key: licenseKey,
    account_login: 160092738,
    account_server: "Demo-Server"
  };
}

test("monthly subscription activation issues first key once", async () => {
  const app = await start();
  try {
    const body = subPayload();
    const first = await postJson(app.url, "/api/v1/subscriptions/activate", body);
    const replay = await postJson(app.url, "/api/v1/subscriptions/activate", body);
    assert.equal(first.status, 200);
    assert.match(first.data.licenseKey, /^AURORA-/);
    assert.equal(first.data.alreadyProcessed, false);
    assert.equal(replay.data.alreadyProcessed, true);
    assert.equal(replay.data.licenseKey, undefined);
    assert.equal(replay.data.licenseKeyReadable, false);
    assert.equal(app.store.licenses.length, 1);
  } finally {
    await app.close();
  }
});

test("raw subscription key is recoverable before ack and unavailable after ack", async () => {
  const app = await start();
  try {
    const body = subPayload();
    const first = await postJson(app.url, "/api/v1/subscriptions/activate", body);
    assert.equal(first.status, 200);

    const recovery = await postJson(app.url, "/api/v1/subscriptions/recover-key", {
      paypal: {
        saleId: body.paypal.saleId,
        subscriptionId: body.paypal.subscriptionId
      }
    });
    assert.equal(recovery.status, 200);
    assert.equal(recovery.data.licenseKey, first.data.licenseKey);

    const ack = await postJson(app.url, "/api/v1/subscriptions/ack-delivery", {
      paypal: {
        saleId: body.paypal.saleId,
        subscriptionId: body.paypal.subscriptionId
      }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.data.acknowledged, true);

    const afterAck = await postJson(app.url, "/api/v1/subscriptions/recover-key", {
      paypal: {
        saleId: body.paypal.saleId,
        subscriptionId: body.paypal.subscriptionId
      }
    });
    assert.equal(afterAck.status, 409);
    assert.equal(afterAck.data.code, "license_key_not_recoverable");
  } finally {
    await app.close();
  }
});

test("yearly subscription activation issues yearly license", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/subscriptions/activate", yearlyPayload());
    assert.equal(result.status, 200);
    assert.equal(result.data.plan, "yearly");
    assert.equal(result.data.subscriptionId, "SUB-YEAR");
  } finally {
    await app.close();
  }
});

test("subscriptionId is unique", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    const conflict = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload({
      paypal: { ...subPayload().paypal, saleId: "SALE-OTHER", eventId: "EVENT-OTHER" },
      idempotencyKey: "SALE-OTHER"
    }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.code, "subscription_already_activated");
  } finally {
    await app.close();
  }
});

test("monthly renew extends same license without new key", async () => {
  const app = await start();
  try {
    const first = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    const renew = await postJson(app.url, "/api/v1/subscriptions/renew", renewPayload());
    assert.equal(renew.status, 200);
    assert.equal(renew.data.status, "renewed");
    assert.equal(renew.data.licenseId, first.data.licenseId);
    assert.equal(renew.data.licenseKey, undefined);
    assert.equal(app.store.licenses.length, 1);
  } finally {
    await app.close();
  }
});

test("yearly renew extends same license", async () => {
  const app = await start();
  try {
    const first = await postJson(app.url, "/api/v1/subscriptions/activate", yearlyPayload());
    const renew = await postJson(app.url, "/api/v1/subscriptions/renew", yearlyPayload({
      paypal: {
        ...yearlyPayload().paypal,
        saleId: "SALE-YEAR-2",
        eventId: "EVENT-YEAR-2",
        periodStart: iso(365 * 24 * 60 * 60 * 1000),
        periodEnd: iso(730 * 24 * 60 * 60 * 1000)
      },
      idempotencyKey: "SALE-YEAR-2"
    }));
    assert.equal(renew.status, 200);
    assert.equal(renew.data.licenseId, first.data.licenseId);
    assert.equal(app.store.licenses.length, 1);
  } finally {
    await app.close();
  }
});

test("saleId replay and concurrent renew process only once", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    const body = renewPayload();
    const [first, second] = await Promise.all([
      postJson(app.url, "/api/v1/subscriptions/renew", body),
      postJson(app.url, "/api/v1/subscriptions/renew", body)
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal([first.data.alreadyProcessed, second.data.alreadyProcessed].filter(Boolean).length, 1);
    assert.equal(app.store.payments.length, 2);
  } finally {
    await app.close();
  }
});

test("periodEnd cannot move backwards", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    const result = await postJson(app.url, "/api/v1/subscriptions/renew", renewPayload({
      paypal: {
        ...renewPayload().paypal,
        periodStart: iso(5 * 24 * 60 * 60 * 1000),
        periodEnd: iso(10 * 24 * 60 * 60 * 1000)
      }
    }));
    assert.equal(result.status, 409);
    assert.equal(result.data.code, "period_not_forward");
  } finally {
    await app.close();
  }
});

test("SKU plan planId amount and currency conflicts are rejected", async () => {
  const app = await start();
  try {
    const badMoney = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload({
      paypal: { ...subPayload().paypal, amount: "18.00" }
    }));
    assert.equal(badMoney.status, 409);
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    const badPlan = await postJson(app.url, "/api/v1/subscriptions/renew", renewPayload({
      paypal: { ...renewPayload().paypal, planId: "OTHER-PLAN" }
    }));
    assert.equal(badPlan.status, 409);
  } finally {
    await app.close();
  }
});

test("cancelled remains valid until paid-through ends", async () => {
  const app = await start();
  try {
    const active = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("CANCELLED"));
    const bot = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(bot.data.valid, true);
    app.store.licenses[0].currentPeriodEnd = iso(-1000);
    const expired = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(expired.data.valid, false);
    assert.equal(expired.data.reason, "subscription_cancelled");
  } finally {
    await app.close();
  }
});

test("payment failed has 72 hour grace and fails after grace", async () => {
  const app = await start();
  try {
    const active = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload({
      paypal: { ...subPayload().paypal, periodStart: iso(-2 * 24 * 60 * 60 * 1000), periodEnd: iso(-24 * 60 * 60 * 1000) }
    }));
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("PAYMENT_FAILED"));
    const grace = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(grace.data.valid, true);
    app.store.licenses[0].graceUntil = iso(-1000);
    const failed = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(failed.data.valid, false);
    assert.equal(failed.data.reason, "subscription_payment_failed");
  } finally {
    await app.close();
  }
});

test("successful renew clears grace", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("PAYMENT_FAILED"));
    await postJson(app.url, "/api/v1/subscriptions/renew", renewPayload());
    assert.equal(app.store.licenses[0].subscriptionStatus, "ACTIVE");
    assert.equal(app.store.licenses[0].graceUntil, null);
  } finally {
    await app.close();
  }
});

test("expired refunded and reversed states invalidate license", async () => {
  const app = await start();
  try {
    const active = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("EXPIRED"));
    const expired = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(expired.data.valid, false);
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("REFUNDED", {
      paypal: { ...statusPayload("REFUNDED").paypal, eventTime: iso(1000), reason: "refund" }
    }));
    const refunded = await postJson(app.url, "/api/xau-bot/license", botPayload(active.data.licenseKey), "");
    assert.equal(refunded.data.reason, "subscription_suspended");
  } finally {
    await app.close();
  }
});

test("old out-of-order status events do not overwrite newer status", async () => {
  const app = await start();
  try {
    await postJson(app.url, "/api/v1/subscriptions/activate", subPayload());
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("REFUNDED", {
      paypal: { ...statusPayload("REFUNDED").paypal, eventId: "NEW", eventTime: iso(10000), reason: "refund" }
    }));
    await postJson(app.url, "/api/v1/subscriptions/status", statusPayload("CANCELLED", {
      paypal: { ...statusPayload("CANCELLED").paypal, eventId: "OLD", eventTime: iso(-10000) }
    }));
    assert.equal(app.store.licenses[0].subscriptionStatus, "SUSPENDED");
  } finally {
    await app.close();
  }
});

test("permanent CLI license is not affected by subscription rules", async () => {
  const store = new InMemoryStore();
  const key = "PERM-TEST-TEST-TEST-0001";
  await store.issueManual({
    productId: PRODUCT_ID,
    sku: null,
    plan: "permanent",
    days: 0,
    customerEmail: "owner@example.com",
    customerName: "Owner",
    licenseKeyHash: hmacLicenseKey(key, config.licenseKeyPepper)
  });
  const app = await start(store);
  try {
    const result = await postJson(app.url, "/api/xau-bot/license", botPayload(key), "");
    assert.equal(result.data.valid, true);
    assert.equal(result.data.plan, "permanent");
  } finally {
    await app.close();
  }
});

test("subscription logs do not contain key or token", async () => {
  const app = await start();
  try {
    const result = await postJson(app.url, "/api/v1/subscriptions/activate", subPayload(), "secret-token-value");
    assert.equal(result.status, 401);
    const logs = app.logs.join("\n");
    assert.equal(logs.includes("secret-token-value"), false);
  } finally {
    await app.close();
  }
});
