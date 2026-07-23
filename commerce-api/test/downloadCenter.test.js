import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

process.env.R2_ACCOUNT_ID = "account123";
process.env.R2_ACCESS_KEY_ID = "AKIA_TEST_DOWNLOAD";
process.env.R2_SECRET_ACCESS_KEY = "secret-download-key";
process.env.R2_BUCKET = "aurora-downloads";
process.env.R2_PRESIGNED_URL_SECONDS = "600";

const { createR2PresignedGetUrl } = await import("../src/clients/r2Client.js");
const { getDownloadProducts } = await import("../src/services/downloadCenterService.js");
const { hashDownloadToken } = await import("../src/storage/downloadStore.js");

test("Download Center only exposes MT5 and XAU commercial products", () => {
    const products = getDownloadProducts();
    assert.equal(products.length, 2);
    assert.deepEqual(products.map((product) => product.id), ["AURORA-MT5-AI", "AURORA-XAU-AI"]);
    assert.equal(products[0].version, "2.4.0");
    assert.equal(products[1].version, "1.0.0");
});

test("download token hash is stable and does not store plaintext token", () => {
    const token = "8FD12A_DOWNLOAD_TOKEN";
    const hash = hashDownloadToken(token);
    assert.equal(hash, hashDownloadToken(token));
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
});

test("R2 presigned URL uses private Cloudflare R2 and ten minute expiry", () => {
    const url = createR2PresignedGetUrl({
        objectKey: "releases/aurora-mt5-ai-trader/Aurora_MT5_AI_Trader_2.4.0.exe",
        filename: "Aurora_MT5_AI_Trader_2.4.0.exe"
    });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "account123.r2.cloudflarestorage.com");
    assert.equal(parsed.searchParams.get("X-Amz-Expires"), "600");
    assert.match(parsed.pathname, /aurora-downloads\/releases\/aurora-mt5-ai-trader/);
    assert.equal(url.includes("secret-download-key"), false);
});

test("Download Center migration creates token and history tables", () => {
    const sql = fs.readFileSync(new URL("../migrations/007_download_center.sql", import.meta.url), "utf8");
    assert.match(sql, /commerce_download_tokens/);
    assert.match(sql, /commerce_download_history/);
    assert.match(sql, /expires_at TIMESTAMPTZ NOT NULL/);
    assert.match(sql, /consumed_at TIMESTAMPTZ/);
    assert.match(sql, /ip_address TEXT/);
    assert.match(sql, /result TEXT NOT NULL/);
});

test("Commerce router exposes customer downloads and one-time token routes", () => {
    const router = fs.readFileSync(new URL("../src/router.js", import.meta.url), "utf8");
    assert.match(router, /\/customer\/downloads/);
    assert.match(router, /\/downloads\/token\//);
    assert.match(router, /createCustomerDownloadToken/);
    assert.match(router, /consumeCustomerDownloadToken/);
});
