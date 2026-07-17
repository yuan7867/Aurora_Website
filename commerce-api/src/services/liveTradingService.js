import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { config } from "../config.js";

const liveTradingFile = join(config.dataDir, "live-trading.json");
const defaultProduct = "mt5";

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
    const timestamp = payload.timestamp || payload.lastSync || payload.last_sync || new Date().toISOString();

    return {
        timestamp,
        heartbeat: {
            cloudVersion: readFirst(heartbeat, ["cloudVersion", "cloud_version", "version"]) || "Aurora Cloud API",
            apiStatus: readFirst(heartbeat, ["apiStatus", "api_status", "status"]) || "connected",
            lastSync: timestamp
        },
        status: {
            balance: readFirst(account, ["balance", "accountBalance", "account_balance"]),
            equity: readFirst(account, ["equity", "accountEquity", "account_equity"]),
            openPositions: readFirst(account, ["openPositions", "open_positions", "positions"]),
            floatingPL: readFirst(account, ["floatingPL", "floating_pl", "floatingPnl", "floating_pnl"]),
            currentSession: readFirst(account, ["currentSession", "current_session", "session"]),
            broker: readFirst(account, ["broker", "brokerName", "broker_name"]),
            server: readFirst(account, ["server", "serverName", "server_name"]),
            aiStatus: readFirst(account, ["aiStatus", "ai_status"])
        },
        performance: {
            todayProfit: readFirst(performance, ["todayProfit", "today_profit", "dailyProfit", "daily_profit"]),
            winRate: readFirst(performance, ["winRate", "win_rate"]),
            profitFactor: readFirst(performance, ["profitFactor", "profit_factor"]),
            runningDays: readFirst(performance, ["runningDays", "running_days"]),
            todaysTrades: readFirst(performance, ["todaysTrades", "todays_trades", "todayTrades", "today_trades"]),
            lastTrade: readFirst(performance, ["lastTrade", "last_trade"])
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

    return productData;
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
