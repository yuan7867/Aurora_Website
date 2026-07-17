import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCheckoutHref,
    buildSku,
    canCreatePayPalSubscription,
    commerceProducts,
    getCheckoutProduct,
    getProductSalesEnabled,
    readSelection,
} from "./productSelection.js";

test("product selection exposes only MT5 and XAU products", () => {
    assert.equal(commerceProducts.length, 2);
    assert.deepEqual(commerceProducts.map((product) => product.id), ["aurora-mt5", "aurora-xau"]);
    assert.equal(commerceProducts.some((product) => /bundle/i.test(product.name)), false);
    assert.equal(commerceProducts.some((product) => /future/i.test(product.name)), false);
});

test("MT5 and XAU entry parameters preserve selected product", () => {
    assert.equal(readSelection("?product=aurora-mt5").productId, "aurora-mt5");
    assert.equal(readSelection("?product=aurora-xau").productId, "aurora-xau");
});

test("missing product parameter does not default to MT5", () => {
    assert.deepEqual(readSelection(""), {
        productId: "",
        planId: "yearly",
        sku: ""
    });
});

test("monthly and yearly SKUs are generated per selected product", () => {
    assert.equal(buildSku("aurora-mt5", "monthly"), "aurora-mt5-monthly");
    assert.equal(buildSku("aurora-mt5", "yearly"), "aurora-mt5-yearly");
    assert.equal(buildSku("aurora-xau", "monthly"), "aurora-xau-monthly");
    assert.equal(buildSku("aurora-xau", "yearly"), "aurora-xau-yearly");
});

test("switching product recalculates SKU without leaking previous product", () => {
    const mt5Href = buildCheckoutHref("aurora-mt5", "monthly");
    const xauHref = buildCheckoutHref("aurora-xau", "monthly");

    assert.match(mt5Href, /sku=aurora-mt5-monthly/);
    assert.doesNotMatch(mt5Href, /aurora-xau/);
    assert.match(xauHref, /sku=aurora-xau-monthly/);
    assert.doesNotMatch(xauHref, /aurora-mt5/);
});

test("checkout product is unavailable without an exact SKU", () => {
    assert.equal(getCheckoutProduct(""), null);
    assert.equal(getCheckoutProduct("aurora-mt5-yearly")?.productId, "aurora-mt5");
    assert.equal(getCheckoutProduct("aurora-xau-yearly")?.productId, "aurora-xau");
});

test("sales disabled by default prevents frontend checkout order creation", () => {
    assert.equal(canCreatePayPalSubscription("aurora-mt5-monthly"), false);
    assert.equal(canCreatePayPalSubscription("aurora-xau-yearly"), false);
});

test("MT5 false and XAU true only enables XAU subscriptions", () => {
    const env = {
        VITE_MT5_SALES_ENABLED: "false",
        VITE_XAU_SALES_ENABLED: "true"
    };

    assert.equal(canCreatePayPalSubscription("aurora-mt5-monthly", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-mt5-yearly", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-xau-monthly", env), true);
    assert.equal(canCreatePayPalSubscription("aurora-xau-yearly", env), true);
});

test("MT5 true and XAU false only enables MT5 subscriptions", () => {
    const env = {
        VITE_MT5_SALES_ENABLED: "TrUe",
        VITE_XAU_SALES_ENABLED: "false"
    };

    assert.equal(canCreatePayPalSubscription("aurora-mt5-monthly", env), true);
    assert.equal(canCreatePayPalSubscription("aurora-mt5-yearly", env), true);
    assert.equal(canCreatePayPalSubscription("aurora-xau-monthly", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-xau-yearly", env), false);
});

test("both product sales flags false keeps all subscriptions unavailable", () => {
    const env = {
        VITE_MT5_SALES_ENABLED: "false",
        VITE_XAU_SALES_ENABLED: "false"
    };

    assert.equal(canCreatePayPalSubscription("aurora-mt5-monthly", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-xau-monthly", env), false);
});

test("unknown SKU and invalid env values stay disabled", () => {
    const env = {
        VITE_MT5_SALES_ENABLED: "yes",
        VITE_XAU_SALES_ENABLED: "1"
    };

    assert.equal(canCreatePayPalSubscription("unknown-sku", env), false);
    assert.equal(getProductSalesEnabled("unknown-product", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-mt5-monthly", env), false);
    assert.equal(canCreatePayPalSubscription("aurora-xau-monthly", env), false);
});
