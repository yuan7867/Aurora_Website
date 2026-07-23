import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const { parseUpdateManifest } = await import("../src/services/updateService.js");

test("Update manifest parser returns the public client contract", () => {
    const manifest = parseUpdateManifest("mt5", {
        version: "2.4.1",
        minimum_version: "2.3.8",
        force_update: false,
        release_date: "2026-07-23",
        sha256: "abc123",
        object_key: "releases/aurora-mt5-ai-trader/2.4.1/Aurora_MT5_AI_Trader.exe",
        release_notes: ["Improved Exit Engine", "", "Performance Optimisation"]
    });

    assert.deepEqual(manifest, {
        product: "mt5",
        version: "2.4.1",
        minimum_version: "2.3.8",
        force_update: false,
        release_date: "2026-07-23",
        sha256: "ABC123",
        object_key: "releases/aurora-mt5-ai-trader/2.4.1/Aurora_MT5_AI_Trader.exe",
        filename: "Aurora_MT5_AI_Trader.exe",
        release_notes: ["Improved Exit Engine", "Performance Optimisation"]
    });
});

test("Update manifest parser rejects incomplete metadata", () => {
    assert.throws(
        () => parseUpdateManifest("xau", {
            version: "1.0.1",
            release_date: "2026-07-23",
            sha256: "ABC",
            object_key: "releases/aurora-xau-trader/1.0.1/Aurora_XAU_Trader.exe"
        }),
        /minimum_version/
    );
});

test("Commerce router exposes the Aurora Update API only for latest checks", async () => {
    const router = await readFile(new URL("../src/router.js", import.meta.url), "utf8");
    assert.match(router, /\/api\/update\/latest\//);
    assert.match(router, /getLatestUpdate/);
    assert.doesNotMatch(router, /POST" && url\.pathname\.startsWith\("\/api\/update/);
});

test("runtime wiring passes update manifest keys without secrets", async () => {
    const compose = await readFile(resolve("../docker-compose.yml"), "utf8");
    const envExample = await readFile(resolve("../.env.example"), "utf8");

    assert.match(compose, /MT5_UPDATE_MANIFEST_KEY: \$\{MT5_UPDATE_MANIFEST_KEY\}/);
    assert.match(compose, /XAU_UPDATE_MANIFEST_KEY: \$\{XAU_UPDATE_MANIFEST_KEY\}/);
    assert.match(envExample, /^MT5_UPDATE_MANIFEST_KEY=updates\/mt5\/version\.json$/m);
    assert.match(envExample, /^XAU_UPDATE_MANIFEST_KEY=updates\/xau\/version\.json$/m);
});

test("GitHub Actions release pipeline publishes EXE and version manifest through R2 secrets", () => {
    const workflow = fs.readFileSync(resolve("../.github/workflows/aurora-update-release.yml"), "utf8");
    const cli = fs.readFileSync(new URL("../src/cli/publishUpdateRelease.js", import.meta.url), "utf8");

    assert.match(workflow, /Aurora Update Release/);
    assert.match(workflow, /"Aurora_Releases\/\*\*"/);
    assert.match(workflow, /RELEASE_MANIFEST: Aurora_Releases\/release\.json/);
    assert.match(workflow, /R2_ACCESS_KEY_ID: \$\{\{ secrets\.R2_ACCESS_KEY_ID \}\}/);
    assert.match(workflow, /R2_SECRET_ACCESS_KEY: \$\{\{ secrets\.R2_SECRET_ACCESS_KEY \}\}/);
    assert.match(workflow, /npm run update:publish/);
    assert.doesNotMatch(workflow, /ab53|7882|CHANGE_ME_R2/);
    assert.match(cli, /updates\/mt5\/version\.json/);
    assert.match(cli, /updates\/xau\/version\.json/);
    assert.match(cli, /loadReleaseManifest/);
    assert.match(cli, /parseArgs/);
    assert.match(cli, /verifySignedUrl/);
    assert.match(cli, /verifyApi/);
    assert.match(cli, /sha256/);
});

test("publish shortcuts provide one-command MT5 and XAU releases", () => {
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

    assert.equal(pkg.scripts["publish:mt5"], "node src/cli/publishUpdateRelease.js --product mt5");
    assert.equal(pkg.scripts["publish:xau"], "node src/cli/publishUpdateRelease.js --product xau");
});
