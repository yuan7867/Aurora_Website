import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
    assertProductSubscriptionAvailable,
    getCommerceProduct,
    getPayPalPlanId
} from "../src/products.js";

const compose = await readFile(resolve("../docker-compose.yml"), "utf8");
const envExample = await readFile(resolve("../.env.example"), "utf8");

function restoreEnv(name, value) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}

test("docker-compose passes all PayPal Plan IDs to aurora-commerce-api", () => {
    for (const name of [
        "PAYPAL_MT5_MONTHLY_PLAN_ID",
        "PAYPAL_MT5_YEARLY_PLAN_ID",
        "PAYPAL_XAU_MONTHLY_PLAN_ID",
        "PAYPAL_XAU_YEARLY_PLAN_ID"
    ]) {
        assert.match(compose, new RegExp(`${name}: \\$\\{${name}\\}`));
    }
});

test("XAU License API uses internal Docker hostname in runtime examples", () => {
    assert.match(envExample, /XAU_LICENSE_API_URL=http:\/\/xau-license-api:8000\/api\/v1\/licenses\/issue/);
    assert.doesNotMatch(envExample, /https:\/\/xau-license\.aurorahy\.com/);
});

test("sales disabled with empty Plan IDs does not make startup configuration fail", async () => {
    const previous = {
        databaseUrl: process.env.DATABASE_URL,
        encryptionKey: process.env.LICENSE_DELIVERY_ENCRYPTION_KEY,
        mt5Monthly: process.env.PAYPAL_MT5_MONTHLY_PLAN_ID,
        xauMonthly: process.env.PAYPAL_XAU_MONTHLY_PLAN_ID
    };

    process.env.DATABASE_URL = "postgresql://user:pass@postgres:5432/db";
    process.env.LICENSE_DELIVERY_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
    process.env.PAYPAL_MT5_MONTHLY_PLAN_ID = "";
    process.env.PAYPAL_XAU_MONTHLY_PLAN_ID = "";
    const { assertCommerceRuntimeConfigured } = await import(`../src/config.js?runtime=${Date.now()}`);

    assert.doesNotThrow(() => assertCommerceRuntimeConfigured());

    restoreEnv("DATABASE_URL", previous.databaseUrl);
    restoreEnv("LICENSE_DELIVERY_ENCRYPTION_KEY", previous.encryptionKey);
    restoreEnv("PAYPAL_MT5_MONTHLY_PLAN_ID", previous.mt5Monthly);
    restoreEnv("PAYPAL_XAU_MONTHLY_PLAN_ID", previous.xauMonthly);
});

test("sales enabled with missing corresponding Plan ID safely rejects subscription", () => {
    assert.throws(
        () => assertProductSubscriptionAvailable(getCommerceProduct("aurora-xau-monthly"), {
            xauSalesEnabled: true,
            paypalPlanIds: {
                "aurora-xau-monthly": ""
            }
        }),
        /PayPal subscription plan is not configured/
    );
});

test("MT5 and XAU Plan IDs remain strictly isolated", () => {
    const config = {
        paypalPlanIds: {
            "aurora-mt5-monthly": "P-MT5-MONTH",
            "aurora-mt5-yearly": "P-MT5-YEAR",
            "aurora-xau-monthly": "P-XAU-MONTH",
            "aurora-xau-yearly": "P-XAU-YEAR"
        }
    };

    assert.equal(getPayPalPlanId(getCommerceProduct("aurora-mt5-monthly"), config), "P-MT5-MONTH");
    assert.equal(getPayPalPlanId(getCommerceProduct("aurora-xau-monthly"), config), "P-XAU-MONTH");
    assert.notEqual(getPayPalPlanId(getCommerceProduct("aurora-mt5-monthly"), config), getPayPalPlanId(getCommerceProduct("aurora-xau-monthly"), config));
});

test("sales switches remain false in .env.example", () => {
    assert.match(envExample, /^MT5_SALES_ENABLED=false$/m);
    assert.match(envExample, /^XAU_SALES_ENABLED=false$/m);
});
