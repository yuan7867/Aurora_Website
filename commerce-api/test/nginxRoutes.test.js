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
