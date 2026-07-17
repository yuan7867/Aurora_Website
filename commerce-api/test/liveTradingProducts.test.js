import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const router = await readFile(new URL("../src/router.js", import.meta.url), "utf8");
const service = await readFile(new URL("../src/services/liveTradingService.js", import.meta.url), "utf8");
const component = await readFile(new URL("../../src/components/LivePerformance.jsx", import.meta.url), "utf8");

test("live trading keeps MT5 ingest and adds XAU ingest without changing auth", () => {
    assert.match(router, /\/api\/v1\/mt5\/battle-test/);
    assert.match(router, /\/api\/v1\/xau\/battle-test/);
    assert.match(router, /\/api\/v1\/xau\/live-snapshot/);
    assert.match(router, /assertCloudIngestAuthorized\(request\)/);
});

test("live trading service stores product keyed MT5 and XAU data", () => {
    assert.match(service, /products:/);
    assert.match(service, /normalizeProduct/);
    assert.match(service, /getLiveTradingProductData/);
    assert.match(service, /xau/);
    assert.match(service, /mt5/);
});

test("Live Trading page reads MT5 and XAU and hides broker and server metrics", () => {
    assert.match(component, /id: "mt5"/);
    assert.match(component, /id: "xau"/);
    assert.match(component, /getLiveProduct\(productId\)/);
    assert.doesNotMatch(component, /\["Broker"/);
    assert.doesNotMatch(component, /\["Server"/);
    assert.match(component, /Market Open/);
    assert.match(component, /Close in/);
    assert.match(component, /Open in/);
});
