import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const nginxConfig = await readFile(resolve("../deploy/nginx/nginx.conf"), "utf8");

test("Nginx exposes only the XAU bot verification route to xau-license-api", () => {
    assert.match(nginxConfig, /location = \/api\/xau-bot\/license/);
    assert.match(nginxConfig, /proxy_pass http:\/\/xau_license_api\/api\/xau-bot\/license/);
    assert.doesNotMatch(nginxConfig, /location .*\/api\/v1\/licenses\/issue/);
    assert.match(nginxConfig, /location \/api\/ \{[\s\S]*proxy_pass http:\/\/aurora_commerce/);
});

test("Nginx maps exact XAU live sync routes to aurora-commerce-api", () => {
    assert.match(nginxConfig, /location = \/api\/v1\/xau\/live-snapshot \{[\s\S]*proxy_pass http:\/\/aurora_commerce\/api\/v1\/xau\/live-snapshot;/);
    assert.match(nginxConfig, /location = \/api\/v1\/xau\/battle-test \{[\s\S]*proxy_pass http:\/\/aurora_commerce\/api\/v1\/xau\/battle-test;/);
    assert.match(nginxConfig, /location = \/api\/v1\/live\/xau \{[\s\S]*proxy_pass http:\/\/aurora_commerce\/api\/v1\/live\/xau;/);
    assert.doesNotMatch(nginxConfig, /location \/api\/v1\//);
});

test("Nginx exposes only the MT5 client validation route to mt5-license-api", () => {
    assert.match(nginxConfig, /upstream mt5_license_api/);
    assert.match(nginxConfig, /location = \/api\/aurora-mt5-ai-trader\/license/);
    assert.match(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/aurora-mt5-ai-trader\/license/);
    assert.match(nginxConfig, /Access-Control-Allow-Methods "POST, OPTIONS"/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/subscriptions\/activate/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/subscriptions\/renew/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/subscriptions\/status/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/subscriptions\/delivery\/recover/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/subscriptions\/delivery\/ack/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/api\/v1\/licenses\/issue/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/health/);
    assert.doesNotMatch(nginxConfig, /proxy_pass http:\/\/mt5_license_api\/ready/);
});
