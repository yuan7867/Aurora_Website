import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

process.env.COMMERCE_DATA_DIR = await mkdtemp(join(tmpdir(), "aurora-live-sync-"));
process.env.AURORA_CLOUD_INGEST_TOKEN = "test-ingest-token";

const service = await import("../src/services/liveTradingService.js");
const { commerceRouter } = await import("../src/router.js");

async function startServer() {
    const server = http.createServer(commerceRouter);
    await new Promise((resolve) => server.listen(0, resolve));
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

async function postSnapshot(baseUrl, body, token) {
    const headers = { "content-type": "application/json" };
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${baseUrl}/api/v1/xau/battle-test`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });
    return {
        status: response.status,
        data: await response.json()
    };
}

function snapshot(overrides = {}) {
    return {
        product: "aurora-xau",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        account: {
            currency: "MYR",
            balance: 1000.5,
            equity: 990.25,
            openPositions: 2,
            floatingPL: -10.25,
            currentSession: "Live",
            aiStatus: "Running",
            broker: "SHOULD_NOT_LEAK",
            server: "SHOULD_NOT_LEAK"
        },
        performance: {
            todayProfit: 12.5,
            winRate: 75,
            profitFactor: 1.8,
            runningDays: 4
        },
        ...overrides
    };
}

test.after(async () => {
    await rm(process.env.COMMERCE_DATA_DIR, { recursive: true, force: true });
});

test("valid XAU snapshot uploads and public GET returns sanitized metrics", async () => {
    await service.saveLiveTradingData(snapshot(), "xau");
    const data = await service.getLiveTradingProductData("xau");

    assert.equal(data.product, "aurora-xau");
    assert.equal(data.version, "1.0.0");
    assert.equal(data.accountCurrency, "MYR");
    assert.equal(data.status.balance, 1000.5);
    assert.equal(data.status.equity, 990.25);
    assert.equal(data.performance.todayProfit, 12.5);
    assert.equal(data.status.openPositions, 2);
    assert.equal(data.status.floatingPL, -10.25);
    assert.equal(data.performance.winRate, 75);
    assert.equal(data.performance.profitFactor, 1.8);
    assert.equal(data.performance.runningDays, 4);
    assert.equal(data.status.cloudStatus, "LIVE");
    assert.equal(JSON.stringify(data).includes("SHOULD_NOT_LEAK"), false);
});

test("XAU ingest rejects missing and invalid tokens and accepts valid token", async () => {
    const server = await startServer();
    try {
        const missing = await postSnapshot(server.url, snapshot());
        const invalid = await postSnapshot(server.url, snapshot(), "wrong-token");
        const valid = await postSnapshot(server.url, snapshot(), "test-ingest-token");

        assert.equal(missing.status, 401);
        assert.equal(invalid.status, 401);
        assert.equal(valid.status, 200);
        assert.equal(valid.data.success, true);
    } finally {
        await server.close();
    }
});

test("invalid missing and non-finite fields are rejected", async () => {
    await assert.rejects(
        () => service.saveLiveTradingData(snapshot({ account: { ...snapshot().account, balance: "NaN" } }), "xau"),
        /Invalid live trading field: balance/
    );

    await assert.rejects(
        () => service.saveLiveTradingData(snapshot({ account: { ...snapshot().account, equity: Infinity } }), "xau"),
        /Invalid live trading field: equity/
    );
});

test("future timestamp is rejected", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await assert.rejects(
        () => service.saveLiveTradingData(snapshot({ timestamp: future }), "xau"),
        /too far in the future/
    );
});

test("old replay timestamp is rejected", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await assert.rejects(
        () => service.saveLiveTradingData(snapshot({ timestamp: old }), "xau"),
        /too old/
    );
});

test("out-of-order snapshot is ignored without replacing newer server data", async () => {
    const newer = snapshot({ timestamp: new Date(Date.now() - 1000).toISOString() });
    await service.saveLiveTradingData(newer, "xau");
    const before = await service.getLiveTradingProductData("xau");
    const older = snapshot({
        timestamp: new Date(Date.now() - 2000).toISOString(),
        account: {
            ...snapshot().account,
            balance: 999999
        }
    });
    const ignored = await service.saveLiveTradingData(older, "xau");
    const after = await service.getLiveTradingProductData("xau");

    assert.equal(ignored.status.balance, before.status.balance);
    assert.equal(after.status.balance, before.status.balance);
});

test("LIVE STALE OFFLINE status transitions use server time", async () => {
    await service.saveLiveTradingData(snapshot(), "xau");
    const live = await service.getLiveTradingProductData("xau");
    assert.equal(live.cloudStatus, "LIVE");

    await writeFile(join(process.env.COMMERCE_DATA_DIR, "live-trading.json"), JSON.stringify({
        products: {
            xau: {
                ...live,
                serverReceivedAt: new Date(Date.now() - 90 * 1000).toISOString()
            }
        }
    }));
    const stale = await service.getLiveTradingProductData("xau");
    assert.equal(stale.cloudStatus, "STALE");

    await writeFile(join(process.env.COMMERCE_DATA_DIR, "live-trading.json"), JSON.stringify({
        products: {
            xau: {
                ...live,
                serverReceivedAt: new Date(Date.now() - 240 * 1000).toISOString()
            }
        }
    }));
    const offline = await service.getLiveTradingProductData("xau");
    assert.equal(offline.cloudStatus, "OFFLINE");

    await service.saveLiveTradingData(snapshot(), "xau");
    const recovered = await service.getLiveTradingProductData("xau");
    assert.equal(recovered.cloudStatus, "LIVE");
});

test("MT5 live data remains product-isolated", async () => {
    await service.saveLiveTradingData(snapshot({ product: "aurora-mt5" }), "mt5");
    await service.saveLiveTradingData(snapshot({ product: "aurora-xau", account: { ...snapshot().account, balance: 2000 } }), "xau");

    const mt5 = await service.getLiveTradingProductData("mt5");
    const xau = await service.getLiveTradingProductData("xau");

    assert.equal(mt5.product, "aurora-mt5");
    assert.equal(xau.product, "aurora-xau");
    assert.notEqual(mt5.status.balance, xau.status.balance);
});

test("MT5 Today's P/L prefers closed P/L this trading day", async () => {
    await service.saveLiveTradingData(snapshot({
        product: "aurora-mt5",
        timestamp: new Date().toISOString(),
        performance: {
            closedPLThisTradingDay: 1.18,
            todayProfit: 18.55,
            winRate: 1,
            runningDays: 1
        }
    }), "mt5");

    const mt5 = await service.getLiveTradingProductData("mt5");
    assert.equal(mt5.performance.todayProfit, 1.18);
});

test("XAU payload cannot be saved through MT5 route", async () => {
    await assert.rejects(
        () => service.saveLiveTradingData(snapshot({ product: "aurora-xau" }), "mt5"),
        /payload xau cannot be saved to mt5/
    );
});

test("unknown live trading product is rejected instead of defaulting to MT5", async () => {
    await assert.rejects(
        () => service.getLiveTradingProductData("aurora-luno"),
        /Unsupported live trading product/
    );
});
