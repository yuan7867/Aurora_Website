import { useEffect, useMemo, useState } from "react";

import { getHeartbeat, getPerformance, getStatus } from "../services/auroraApi.js";

import "../styles/v4.css";

const REFRESH_INTERVAL = 10000;

function firstValue(source, keys) {
    for (const key of keys) {
        const value = source?.[key];

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
}

function formatValue(value, suffix = "") {
    if (value === undefined || value === null || value === "") {
        return "Loading...";
    }

    return `${value}${suffix}`;
}

function formatMoney(value) {
    if (value === undefined || value === null || value === "") {
        return "Loading...";
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
        return String(value);
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(numberValue);
}

function relativeTime(timestamp) {
    if (!timestamp) {
        return "Loading...";
    }

    const date = new Date(timestamp);
    const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));

    if (Number.isNaN(seconds)) {
        return String(timestamp);
    }

    if (seconds < 60) {
        return `${seconds} sec ago`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours} hr ago`;
}

function LivePerformance() {
    const [state, setState] = useState({
        status: "loading",
        heartbeat: null,
        performance: null,
        tradingStatus: null,
        lastSync: null
    });

    useEffect(() => {
        let active = true;

        async function loadLiveTrading() {
            setState((current) => ({
                ...current,
                status: current.status === "ready" ? "syncing" : "loading"
            }));

            try {
                const [heartbeat, tradingStatus, performance] = await Promise.all([
                    getHeartbeat(),
                    getStatus(),
                    getPerformance()
                ]);

                if (!active) {
                    return;
                }

                setState({
                    status: "ready",
                    heartbeat,
                    tradingStatus,
                    performance,
                    lastSync: new Date().toISOString()
                });
            } catch {
                if (active) {
                    setState((current) => ({
                        ...current,
                        status: "offline"
                    }));
                }
            }
        }

        loadLiveTrading();
        const intervalId = globalThis.setInterval(loadLiveTrading, REFRESH_INTERVAL);

        return () => {
            active = false;
            globalThis.clearInterval(intervalId);
        };
    }, []);

    const metrics = useMemo(() => {
        const status = state.tradingStatus || {};
        const performance = state.performance || {};
        const heartbeat = state.heartbeat || {};

        return [
            ["Balance", formatMoney(firstValue(status, ["balance", "accountBalance", "account_balance"]))],
            ["Equity", formatMoney(firstValue(status, ["equity", "accountEquity", "account_equity"]))],
            ["Today's Profit", formatMoney(firstValue(performance, ["todayProfit", "today_profit", "dailyProfit", "daily_profit"]))],
            ["Open Positions", formatValue(firstValue(status, ["openPositions", "open_positions", "positions"]))],
            ["Floating P/L", formatMoney(firstValue(status, ["floatingPL", "floating_pl", "floatingPnl", "floating_pnl"]))],
            ["Win Rate", formatValue(firstValue(performance, ["winRate", "win_rate"]), "%")],
            ["Profit Factor", formatValue(firstValue(performance, ["profitFactor", "profit_factor"]))],
            ["Running Days", formatValue(firstValue(performance, ["runningDays", "running_days"]))],
            ["Current Session", formatValue(firstValue(status, ["currentSession", "current_session", "session"]))],
            ["Broker", formatValue(firstValue(status, ["broker", "brokerName", "broker_name"]))],
            ["Server", formatValue(firstValue(status, ["server", "serverName", "server_name"]))],
            ["Last Sync", relativeTime(firstValue(heartbeat, ["lastSync", "last_sync", "timestamp"]) || state.lastSync)],
            ["Cloud Status", state.status === "ready" || state.status === "syncing" ? "Connected" : "Connecting..."]
        ];
    }, [state]);

    const isOffline = state.status === "offline";

    return (
        <section className="live-performance-center" id="performance">
            <div className="v4-section-heading">
                <p>Live Trading</p>
                <h2>Aurora Cloud Dashboard.</h2>
            </div>

            {isOffline && (
                <div className="cloud-offline-state" role="status">
                    <strong>Connecting to Aurora Cloud...</strong>
                    <span>Waiting for live MT5 Battle Test data.</span>
                </div>
            )}

            <div className="live-performance-grid" aria-label="Aurora HY live trading center">
                {metrics.map(([label, value]) => (
                    <article key={label}>
                        <span>{label}</span>
                        <strong>{isOffline ? "Connecting..." : value}</strong>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default LivePerformance;
