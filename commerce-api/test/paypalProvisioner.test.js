import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
    buildPlanPayload,
    getProvisioningCatalog,
    parseArgs,
    provisionPayPalPlans
} from "../src/cli/provisionPayPalPlans.js";

const oldCloudflareHost = ["aurora-hub", "pages", "dev"].join(".");

test("PayPal provisioning defaults to Sandbox dry run", () => {
    assert.deepEqual(parseArgs([]), {
        environment: "sandbox",
        confirm: false,
        dryRun: true
    });
});

test("Production provisioning without --confirm is rejected", () => {
    assert.throws(() => parseArgs(["--production"]), /requires --production --confirm/);
});

test("four recurring plans have exact amount, currency and billing period", () => {
    const catalog = getProvisioningCatalog();
    const plans = catalog.flatMap((product) => product.plans.map((plan) => ({
        product,
        plan,
        payload: buildPlanPayload({ product, plan, paypalProductId: `${product.key}-PAYPAL-PRODUCT` })
    })));

    assert.equal(plans.length, 4);
    assert.equal(plans.find(({ plan }) => plan.envName === "PAYPAL_MT5_MONTHLY_PLAN_ID").payload.billing_cycles[0].pricing_scheme.fixed_price.value, "19.90");
    assert.equal(plans.find(({ plan }) => plan.envName === "PAYPAL_MT5_YEARLY_PLAN_ID").payload.billing_cycles[0].pricing_scheme.fixed_price.value, "199.00");
    assert.equal(plans.find(({ plan }) => plan.envName === "PAYPAL_XAU_MONTHLY_PLAN_ID").payload.billing_cycles[0].frequency.interval_unit, "MONTH");
    assert.equal(plans.find(({ plan }) => plan.envName === "PAYPAL_XAU_YEARLY_PLAN_ID").payload.billing_cycles[0].frequency.interval_unit, "YEAR");

    for (const { payload } of plans) {
        assert.equal(payload.billing_cycles[0].pricing_scheme.fixed_price.currency_code, "USD");
        assert.equal(payload.billing_cycles[0].total_cycles, 0);
        assert.equal(payload.payment_preferences.auto_bill_outstanding, true);
        assert.equal(payload.payment_preferences.payment_failure_threshold, 2);
        assert.equal(payload.payment_preferences.setup_fee.value, "0");
    }
});

test("MT5 and XAU Product and Plan mapping do not mix", () => {
    const catalog = getProvisioningCatalog();
    const mt5 = catalog.find((product) => product.key === "MT5");
    const xau = catalog.find((product) => product.key === "XAU");

    assert.equal(mt5.productId, "AURORA-MT5-AI");
    assert.equal(xau.productId, "AURORA-XAU-AI");
    assert.deepEqual(mt5.plans.map((plan) => plan.envName), ["PAYPAL_MT5_MONTHLY_PLAN_ID", "PAYPAL_MT5_YEARLY_PLAN_ID"]);
    assert.deepEqual(xau.plans.map((plan) => plan.envName), ["PAYPAL_XAU_MONTHLY_PLAN_ID", "PAYPAL_XAU_YEARLY_PLAN_ID"]);
});

test("Provisioning catalog does not create Bundle, permanent or lifetime plans", () => {
    const text = JSON.stringify(getProvisioningCatalog()).toLowerCase();
    assert.equal(text.includes("bundle"), false);
    assert.equal(text.includes("permanent"), false);
    assert.equal(text.includes("lifetime"), false);
});

test("CLI output does not contain Client Secret or access token", async () => {
    const lines = [];
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith("/v1/oauth2/token")) {
            return {
                ok: true,
                json: async () => ({ access_token: "ACCESS_TOKEN_SHOULD_NOT_PRINT", expires_in: 300 })
            };
        }
        if (url.endsWith("/v1/catalogs/products")) {
            return {
                ok: true,
                text: async () => JSON.stringify({ id: `PROD-${calls.length}` })
            };
        }
        return {
            ok: true,
            text: async () => JSON.stringify({ id: `PLAN-${calls.length}` })
        };
    };

    await provisionPayPalPlans({
        options: parseArgs(["--confirm"]),
        env: {
            PAYPAL_CLIENT_ID: "client-id",
            PAYPAL_CLIENT_SECRET: "CLIENT_SECRET_SHOULD_NOT_PRINT"
        },
        log: (line) => lines.push(String(line))
    });

    const output = lines.join("\n");
    assert.equal(output.includes("CLIENT_SECRET_SHOULD_NOT_PRINT"), false);
    assert.equal(output.includes("ACCESS_TOKEN_SHOULD_NOT_PRINT"), false);
    assert.equal(output.includes("Authorization"), false);
});

test("production SEO canonical and og:url use aurorahy.com", async () => {
    const html = await readFile(resolve("../index.html"), "utf8");
    assert.match(html, /<link rel="canonical" href="https:\/\/aurorahy\.com\/" \/>/);
    assert.match(html, /<meta property="og:url" content="https:\/\/aurorahy\.com\/" \/>/);
    assert.equal(html.includes(oldCloudflareHost), false);
});

test("production frontend SEO files do not contain old Cloudflare Pages URL", async () => {
    const files = [
        "../index.html",
        "../public/robots.txt",
        "../public/sitemap.xml"
    ];

    for (const file of files) {
        const content = await readFile(resolve(file), "utf8");
        assert.equal(content.includes(oldCloudflareHost), false);
    }
});
