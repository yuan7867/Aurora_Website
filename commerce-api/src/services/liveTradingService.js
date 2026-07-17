import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { config } from "../config.js";

const liveTradingFile = join(config.dataDir, "live-trading.json");
const defaultProduct = "mt5";
const liveWindowSeconds = 60;
const staleWindowSeconds = 180;
const maxFutureSkewMs = 2 * 60 * 1000;

function readFirst(source, keys) {
    for (const key of keys) {
        const value = source?.[key];

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
}

function normalizeLiveTradingPayload(payload) {
    const account = payload.account || payload.status || payload;
    const performance = payload.performance || payload;
    const heartbeat = payload.heartbeat || payload.cloud || payload;
    const timestamp = validateTimestamp(payload.timestamp || payload.lastSync || payload.last_sync || new Date().toISOString());
    const serverReceivedAt = new Date().toISOString();
    const currency = readFirst(account, ["currency", "accountCurrency", "account_currency"]) || "USD";
    const snapshot = {
        product: readFirst(payload, ["product", "productId", "product_id"]) || null,
        version: readFirst(payload, ["version"]) || readFirst(heartbeat, ["cloudVersion", "cloud_version", "version"]),
        timestamp,
        serverReceivedAt,
        accountCurrency: currency,
        balance: normalizeFinite(readFirst(account, ["balance", "accountBalance", "account_balance"]), "balance"),
        equity: normalizeFinite(readFirst(account, ["equity", "accountEquity", "account_equity"]), "equity"),
        todayProfit: normalizeFinite(readFirst(performance, ["todayProfit", "today_profit", "dailyProfit", "daily_profit"]), "todayProfit"),
        openPositions: normalizeFinite(readFirst(account, ["openPositions", "open_positions", "positions"]), "openPositions"),
        floatingPL: normalizeFinite(readFirst(account, ["floatingPL", "floating_pl", "floatingPnl", "floating_pnl"]), "floatingPL"),
        winRate: normalizeOptionalFinite(readFirst(performance, ["winRate", "win_rate"]), "winRate"),
        profitFactor: normalizeOptionalFinite(readFirst(performance, ["profitFactor", "profit_factor"]), "profitFactor"),
        runningDays: normalizeOptionalFinite(readFirst(performance, ["runningDays", "running_days"]), "runningDays"),
        currentSession: readFirst(account, ["currentSession", "current_session", "session"]) || "Live",
        aiStatus: readFirst(account, ["aiStatus", "ai_status"]) || readFirst(heartbeat, ["apiStatus", "api_status", "status"]) || "Running",
        cloudStatus: "LIVE"
    };

    return {
        timestamp,
        serverReceivedAt,
        product: snapshot.product,
        version: snapshot.version,
        accountCurrency: snapshot.accountCurrency,
        cloudStatus: snapshot.cloudStatus,
        heartbeat: {
            cloudVersion: snapshot.version || "Aurora Cloud API",
            apiStatus: readFirst(heartbeat, ["apiStatus", "api_status", "status"]) || "connected",
            lastSync: serverReceivedAt
        },
        status: {
            balance: snapshot.balance,
            equity: snapshot.equity,
            accountCurrency: snapshot.accountCurrency,
            openPositions: snapshot.openPositions,
            floatingPL: snapshot.floatingPL,
            currentSession: snapshot.currentSession,
            aiStatus: snapshot.aiStatus,
            lastSync: serverReceivedAt,
            cloudStatus: snapshot.cloudStatus
        },
        performance: {
            todayProfit: snapshot.todayProfit,
            winRate: snapshot.winRate,
            profitFactor: snapshot.profitFactor,
            runningDays: snapshot.runningDays,
            todaysTrades: readFirst(performance, ["todaysTrades", "todays_trades", "todayTrades", "today_trades"]),
            lastTrade: readFirst(performance, ["lastTrade", "last_trade"])
        }
    };
}

function normalizeFinite(value, name) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        const error = new Error(`Invalid live trading field: ${name}`);
        error.statusCode = 400;
        throw error;
    }
    return numberValue;
}

function normalizeOptionalFinite(value, name) {
    if (value === undefined || value === null || value === "" || value === "—") {
        return null;
    }
    return normalizeFinite(value, name);
}

function validateTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error("Invalid live trading timestamp.");
        error.statusCode = 400;
        throw error;
    }
    if (date.getTime() - Date.now() > maxFutureSkewMs) {
        const error = new Error("Live trading timestamp is too far in the future.");
        error.statusCode = 400;
        throw error;
    }
    return date.toISOString();
}

function ageStatus(serverReceivedAt) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(serverReceivedAt).getTime()) / 1000));
    if (ageSeconds <= liveWindowSeconds) {
        return "LIVE";
    }
    if (ageSeconds <= staleWindowSeconds) {
        return "STALE";
    }
    return "OFFLINE";
}

function withPublicStatus(productData) {
    const cloudStatus = ageStatus(productData.serverReceivedAt || productData.timestamp);
    return {
        product: productData.product,
        version: productData.version,
        timestamp: productData.timestamp,
        serverReceivedAt: productData.serverReceivedAt,
        accountCurrency: productData.accountCurrency,
        cloudStatus,
        heartbeat: {
            cloudVersion: productData.heartbeat?.cloudVersion,
            apiStatus: productData.heartbeat?.apiStatus,
            lastSync: productData.serverReceivedAt,
            cloudStatus
        },
        status: {
            balance: productData.status?.balance,
            equity: productData.status?.equity,
            accountCurrency: productData.status?.accountCurrency,
            openPositions: productData.status?.openPositions,
            floatingPL: productData.status?.floatingPL,
            currentSession: productData.status?.currentSession,
            aiStatus: productData.status?.aiStatus,
            cloudStatus,
            lastSync: productData.serverReceivedAt
        },
        performance: {
            todayProfit: productData.performance?.todayProfit,
            winRate: productData.performance?.winRate,
            profitFactor: productData.performance?.profitFactor,
            runningDays: productData.performance?.runningDays,
            todaysTrades: productData.performance?.todaysTrades,
            lastTrade: productData.performance?.lastTrade
        }
    };
}

function normalizeProduct(productId) {
    const normalized = String(productId || defaultProduct).trim().toLowerCase();

    if (["xau", "aurora-xau", "aurora-xau-ai", "xau-martingale"].includes(normalized)) {
        return "xau";
    }

    return "mt5";
}

async function readLiveTradingData() {
    try {
        const rawData = await readFile(liveTradingFile, "utf8");
        const parsed = JSON.parse(rawData);

        if (parsed?.products) {
            return parsed;
        }

        return {
            products: {
                [defaultProduct]: parsed
            }
        };
    } catch {
        const error = new Error("Aurora Cloud is waiting for MT5 live trading data.");
        error.statusCode = 503;
        throw error;
    }
}

export async function saveLiveTradingData(payload, productId = defaultProduct) {
    let existing = { products: {} };
    try {
        existing = await readLiveTradingData();
    } catch {
        existing = { products: {} };
    }

    const product = normalizeProduct(productId);
    const liveTradingData = normalizeLiveTradingPayload(payload);
    liveTradingData.product = product === "xau" ? "aurora-xau" : "aurora-mt5";
    const nextData = {
        products: {
            ...(existing.products || {}),
            [product]: liveTradingData
        }
    };

    await mkdir(dirname(liveTradingFile), {
        recursive: true
    });
    await writeFile(liveTradingFile, JSON.stringify(nextData, null, 2));

    return liveTradingData;
}

export async function getLiveTradingProductData(productId = defaultProduct) {
    const liveTradingData = await readLiveTradingData();
    const product = normalizeProduct(productId);
    const productData = liveTradingData.products?.[product];

    if (!productData) {
        const error = new Error(`Aurora Cloud is waiting for ${product.toUpperCase()} live trading data.`);
        error.statusCode = 503;
        throw error;
    }

    return withPublicStatus(productData);
}

export async function getHeartbeatData(productId = defaultProduct) {
    const liveTradingData = await getLiveTradingProductData(productId);
    return liveTradingData.heartbeat;
}

export async function getStatusData(productId = defaultProduct) {
    const liveTradingData = await getLiveTradingProductData(productId);
    return {
        ...liveTradingData.status,
        lastSync: liveTradingData.timestamp
    };
}

export async function getPerformanceData(productId = defaultProduct) {
    const liveTradingData = await getLiveTradingProductData(productId);
    return {
        ...liveTradingData.performance,
        lastSync: liveTradingData.timestamp
    };
}
