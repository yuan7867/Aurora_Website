import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const dockerfile = await readFile(resolve("Dockerfile"), "utf8");
const mt5Dockerfile = await readFile(resolve("../mt5-license-api/Dockerfile"), "utf8");

test("Commerce Dockerfile runs migrations before starting the server", () => {
    const migrateIndex = dockerfile.indexOf("npm run migrate");
    const startIndex = dockerfile.indexOf("npm start");

    assert.ok(migrateIndex > -1, "Dockerfile must run npm run migrate");
    assert.ok(startIndex > -1, "Dockerfile must run npm start");
    assert.ok(migrateIndex < startIndex, "migration must run before start");
    assert.match(dockerfile, /npm run migrate\s*&&\s*exec npm start/);
});

test("MT5 License API Dockerfile runs migrations before starting the server", () => {
    const migrateIndex = mt5Dockerfile.indexOf("npm run migrate");
    const startIndex = mt5Dockerfile.indexOf("npm start");

    assert.match(mt5Dockerfile, /FROM node:22-alpine/);
    assert.match(mt5Dockerfile, /ENV NODE_ENV=production/);
    assert.match(mt5Dockerfile, /RUN npm ci --omit=dev/);
    assert.match(mt5Dockerfile, /COPY mt5-license-api\/src \.\/src/);
    assert.match(mt5Dockerfile, /COPY mt5-license-api\/migrations \.\/migrations/);
    assert.match(mt5Dockerfile, /EXPOSE 8000/);
    assert.ok(migrateIndex > -1, "MT5 Dockerfile must run npm run migrate");
    assert.ok(startIndex > -1, "MT5 Dockerfile must run npm start");
    assert.ok(migrateIndex < startIndex, "MT5 migration must run before start");
    assert.match(mt5Dockerfile, /npm run migrate\s*&&\s*exec npm start/);
});
