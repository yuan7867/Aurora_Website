import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const sitemap = await readFile(resolve("public/sitemap.xml"), "utf8");
const robots = await readFile(resolve("public/robots.txt"), "utf8");

const allowedUrls = [
    "https://aurorahy.com/",
    "https://aurorahy.com/product/mt5",
    "https://aurorahy.com/product/xau",
    "https://aurorahy.com/pricing",
    "https://aurorahy.com/book-demo",
    "https://aurorahy.com/download",
    "https://aurorahy.com/trust"
];

test("production sitemap contains only public Aurora routes", () => {
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(urls, allowedUrls);
});

test("production sitemap uses aurorahy.com only", () => {
    assert.equal(sitemap.includes("https://aurorahy.com/"), true);
    assert.equal(/https:\/\/(?!aurorahy\.com\/)/.test(sitemap), false);
});

test("production sitemap excludes hidden, account, checkout and internal routes", () => {
    assert.equal(/moomoo|event|wedding|ledger|omni|bundle|checkout|paypal|account|login/i.test(sitemap), false);
});

test("robots points to the production sitemap", () => {
    assert.match(robots, /^Sitemap: https:\/\/aurorahy\.com\/sitemap\.xml$/m);
});
