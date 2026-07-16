import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const dockerfile = await readFile(resolve("Dockerfile"), "utf8");

test("Commerce Dockerfile runs migrations before starting the server", () => {
    const migrateIndex = dockerfile.indexOf("npm run migrate");
    const startIndex = dockerfile.indexOf("npm start");

    assert.ok(migrateIndex > -1, "Dockerfile must run npm run migrate");
    assert.ok(startIndex > -1, "Dockerfile must run npm start");
    assert.ok(migrateIndex < startIndex, "migration must run before start");
    assert.match(dockerfile, /npm run migrate\s*&&\s*exec npm start/);
});
