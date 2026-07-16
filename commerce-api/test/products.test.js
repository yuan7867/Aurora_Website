import assert from "node:assert/strict";
import test from "node:test";

import { commerceProducts, getCommerceProduct, isProductSalesEnabled } from "../src/products.js";

test("commerce catalog exposes exactly two products with four subscription SKUs", () => {
    assert.deepEqual(Object.keys(commerceProducts).sort(), [
        "aurora-mt5-monthly",
        "aurora-mt5-yearly",
        "aurora-xau-monthly",
        "aurora-xau-yearly"
    ]);

    assert.equal(commerceProducts["aurora-mt5-monthly"].price, "19.90");
    assert.equal(commerceProducts["aurora-mt5-monthly"].durationDays, 30);
    assert.equal(commerceProducts["aurora-mt5-yearly"].price, "199.00");
    assert.equal(commerceProducts["aurora-mt5-yearly"].durationDays, 365);
    assert.equal(commerceProducts["aurora-xau-monthly"].licenseProductId, "AURORA-XAU-AI");
    assert.equal(commerceProducts["aurora-xau-yearly"].plan, "yearly");
});

test("retired public SKUs are blocked instead of mapped", () => {
    for (const sku of ["aurora-monthly", "aurora-yearly", "aurora-mt5-ai", "aurora-xau-trader"]) {
        assert.throws(() => getCommerceProduct(sku), /Retired product is not available/);
    }
});

test("sales switches default to false per product family", () => {
    const mt5 = getCommerceProduct("aurora-mt5-monthly");
    const xau = getCommerceProduct("aurora-xau-yearly");

    assert.equal(isProductSalesEnabled(mt5, { mt5SalesEnabled: false, xauSalesEnabled: true }), false);
    assert.equal(isProductSalesEnabled(xau, { mt5SalesEnabled: true, xauSalesEnabled: false }), false);
    assert.equal(isProductSalesEnabled(mt5, { mt5SalesEnabled: true, xauSalesEnabled: false }), true);
    assert.equal(isProductSalesEnabled(xau, { mt5SalesEnabled: false, xauSalesEnabled: true }), true);
});
