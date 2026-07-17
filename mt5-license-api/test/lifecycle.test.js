import assert from "node:assert/strict";
import test from "node:test";

import { PRODUCT_ID } from "../src/constants.js";
import { hmacLicenseKey } from "../src/security.js";
import { InMemoryStore } from "./helpers/inMemoryStore.js";

const key = "AURORA-MT5-LIFE-TEST-0001";
const hash = hmacLicenseKey(key, "pepper");

function request(overrides = {}) {
  return {
    productId: PRODUCT_ID,
    sku: "aurora-mt5-monthly",
    plan: "monthly",
    customerEmail: "customer@example.com",
    customerName: "Customer",
    paypalSubscriptionId: "SUB-LIFE",
    paypalPlanId: "PLAN-MONTHLY",
    paypalSaleId: "SALE-LIFE",
    paypalEventId: "EVENT-LIFE",
    amount: "19.90",
    currency: "USD",
    paidAt: "2026-07-17T00:00:00.000Z",
    periodStart: "2026-07-17T00:00:00.000Z",
    periodEnd: "2026-08-17T00:00:00.000Z",
    licenseKeyHash: hash,
    recovery: {},
    ...overrides
  };
}

async function seededStore({ now = "2026-07-20T00:00:00.000Z", periodEnd = "2026-08-17T00:00:00.000Z" } = {}) {
  const store = new InMemoryStore({ now });
  await store.activateSubscription(request({ periodEnd }));
  return store;
}

test("lifecycle direct PAYMENT_FAILED is valid inside grace and invalid after grace", async () => {
  const store = await seededStore({ now: "2026-08-20T01:00:00.000Z", periodEnd: "2026-08-17T00:00:00.000Z" });
  await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "PF-1", status: "PAYMENT_FAILED", eventTime: "2026-08-20T00:00:00.000Z" });
  assert.equal((await store.verifyLicense({ licenseKeyHash: hash, accountLogin: 1, accountServer: "srv" })).valid, true);
  store.now = "2026-08-23T01:00:00.000Z";
  const expired = await store.verifyLicense({ licenseKeyHash: hash, accountLogin: 1, accountServer: "srv" });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "subscription_payment_failed");
});

test("lifecycle direct CANCELLED remains valid through paid-through and invalid after paid-through", async () => {
  const store = await seededStore({ now: "2026-08-01T00:00:00.000Z", periodEnd: "2026-08-17T00:00:00.000Z" });
  await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "CANCEL-1", status: "CANCELLED", eventTime: "2026-08-01T00:00:00.000Z" });
  assert.equal((await store.verifyLicense({ licenseKeyHash: hash, accountLogin: 1, accountServer: "srv" })).valid, true);
  store.now = "2026-08-18T00:00:00.000Z";
  const expired = await store.verifyLicense({ licenseKeyHash: hash, accountLogin: 1, accountServer: "srv" });
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "subscription_cancelled");
});

test("lifecycle direct terminal statuses are invalid", async () => {
  for (const status of ["SUSPENDED", "EXPIRED", "REFUNDED", "REVERSED"]) {
    const store = await seededStore({ now: "2026-08-01T00:00:00.000Z" });
    await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: `TERM-${status}`, status, eventTime: "2026-08-01T00:00:00.000Z" });
    const result = await store.verifyLicense({ licenseKeyHash: hash, accountLogin: 1, accountServer: "srv" });
    assert.equal(result.valid, false);
  }
});

test("lifecycle stale events cannot overwrite newer ACTIVE renewal", async () => {
  for (const status of ["PAYMENT_FAILED", "CANCELLED", "EXPIRED"]) {
    const store = await seededStore();
    store.licenses[0].subscriptionStatus = "ACTIVE";
    store.licenses[0].latestSubscriptionEventAt = "2026-08-20T00:00:00.000Z";
    const result = await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: `STALE-${status}`, status, eventTime: "2026-08-19T00:00:00.000Z" });
    assert.equal(result.stale, true);
    assert.equal(store.licenses[0].subscriptionStatus, "ACTIVE");
    assert.equal(store.audit.at(-1).action, "subscription_status_event_ignored");
  }
});

test("lifecycle stale ACTIVE cannot restore newer suspended/refunded/reversed states", async () => {
  for (const status of ["SUSPENDED", "REFUNDED", "REVERSED"]) {
    const store = await seededStore();
    store.licenses[0].subscriptionStatus = status;
    store.licenses[0].latestSubscriptionEventAt = "2026-08-20T00:00:00.000Z";
    const result = await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: `STALE-ACTIVE-${status}`, status: "ACTIVE", eventTime: "2026-08-19T00:00:00.000Z" });
    assert.equal(result.stale, true);
    assert.equal(store.licenses[0].subscriptionStatus, status);
  }
});

test("lifecycle event replay and same timestamp tie-break do not duplicate mutation audit", async () => {
  const store = await seededStore();
  await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "STATUS-1", status: "SUSPENDED", eventTime: "2026-08-20T00:00:00.000Z" });
  const auditCount = store.audit.length;
  const replay = await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "STATUS-1", status: "SUSPENDED", eventTime: "2026-08-20T00:00:00.000Z" });
  assert.equal(replay.alreadyProcessed, true);
  assert.equal(store.audit.length, auditCount);
  const tie = await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "STATUS-2", status: "ACTIVE", eventTime: "2026-08-20T00:00:00.000Z" });
  assert.equal(tie.stale, true);
  assert.equal(store.licenses[0].subscriptionStatus, "SUSPENDED");
});

test("lifecycle ACTIVE newer event remains valid and records latest timestamp", async () => {
  const store = await seededStore();
  const result = await store.updateSubscriptionStatus({ paypalSubscriptionId: "SUB-LIFE", paypalEventId: "ACTIVE-NEW", status: "ACTIVE", eventTime: "2026-08-20T00:00:00.000Z" });
  assert.equal(result.ignored, false);
  assert.equal(store.licenses[0].subscriptionStatus, "ACTIVE");
  assert.equal(store.licenses[0].latestSubscriptionEventAt, "2026-08-20T00:00:00.000Z");
});
