import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { config } from "../config.js";

const liveTradingFile = join(config.dataDir, "live-trading.json");

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

async function readLiveTradingData() {
    try {
        const rawData = await readFile(liveTradingFile, "utf8");
        return JSON.parse(rawData);
    } catch {
        const error = new Error("Aurora Cloud is waiting for MT5 live trading data.");
        error.statusCode = 503;
        throw error;
    }
}

export async function saveLiveTradingData(payload) {
    const liveTradingData = normalizeLiveTradingPayload(payload);

    await mkdir(dirname(liveTradingFile), {
        recursive: true
    });
    await writeFile(liveTradingFile, JSON.stringify(liveTradingData, null, 2));

    return liveTradingData;
}

export async function getHeartbeatData() {
    const liveTradingData = await readLiveTradingData();
    return liveTradingData.heartbeat;
}

export async function getStatusData() {
    const liveTradingData = await readLiveTradingData();
    return {
        ...liveTradingData.status,
        lastSync: liveTradingData.timestamp
    };
}

export async function getPerformanceData() {
    const liveTradingData = await readLiveTradingData();
    return {
        ...liveTradingData.performance,
        lastSync: liveTradingData.timestamp
    };
}
