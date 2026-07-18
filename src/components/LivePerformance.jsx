import { useEffect, useMemo, useState } from "react";

import { getLiveProduct } from "../services/auroraApi.js";

import "../styles/v4.css";

const REFRESH_INTERVAL = 10000;

const products = [
    {
        id: "mt5",
        name: "Aurora MT5",
        profile: "Conservative AI Trader",
        accent: "blue"
    },
    {
        id: "xau",
        name: "Aurora XAU",
        profile: "Aggressive Gold Trader",
        accent: "gold"
    }
];

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
        return "—";
    }

    return `${value}${suffix}`;
}

function formatMoney(value, currency = "USD") {
    if (value === undefined || value === null || value === "") {
        return "—";
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
        return String(value);
    }

    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency
        }).format(numberValue);
    } catch {
        return `${currency} ${numberValue.toFixed(2)}`;
    }
}

function relativeTime(timestamp) {
    if (!timestamp) {
        return "—";
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

function getTimeZoneOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date).reduce((values, part) => {
        values[part.type] = part.value;
        return values;
    }, {});

    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );

    return asUtc - date.getTime();
}

function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offset);
}

function getZonedDateParts(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date).reduce((values, part) => {
        values[part.type] = part.value;
        return values;
    }, {});
}

function addDaysToDateParts(parts, days) {
    const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + days));
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
    };
}

function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function getMarketWindow(now = new Date()) {
    const marketTimeZone = "America/New_York";
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const nyParts = getZonedDateParts(now, marketTimeZone);
    const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nyParts.weekday);
    const hour = Number(nyParts.hour);
    const minute = Number(nyParts.minute);
    const minutesSinceMidnight = hour * 60 + minute;
    const isOpen = (weekdayIndex > 0 && weekdayIndex < 5)
        || (weekdayIndex === 0 && minutesSinceMidnight >= 17 * 60)
        || (weekdayIndex === 5 && minutesSinceMidnight < 17 * 60);
    const daysUntilClose = weekdayIndex <= 5 ? 5 - weekdayIndex : 6;
    const daysUntilOpen = weekdayIndex === 6 ? 1 : (7 - weekdayIndex) % 7;
    const closeDate = addDaysToDateParts(nyParts, daysUntilClose);
    const openDate = addDaysToDateParts(nyParts, daysUntilOpen);
    let nextClose = zonedTimeToUtc({ ...closeDate, hour: 17, minute: 0 }, marketTimeZone);
    let nextOpen = zonedTimeToUtc({ ...openDate, hour: 17, minute: 0 }, marketTimeZone);

    if (nextClose <= now) {
        nextClose = zonedTimeToUtc({ ...addDaysToDateParts(nyParts, 7), hour: 17, minute: 0 }, marketTimeZone);
    }

    if (nextOpen <= now) {
        nextOpen = zonedTimeToUtc({ ...addDaysToDateParts(nyParts, 7), hour: 17, minute: 0 }, marketTimeZone);
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
        timeZone: localTimeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
    });

    return {
        localTimeZone,
        isOpen,
        nextClose,
        nextOpen,
        closeText: `${formatDuration(nextClose - now)} (${formatter.format(nextClose)})`,
        openText: `${formatDuration(nextOpen - now)} (${formatter.format(nextOpen)})`
    };
}

function buildMetrics(data) {
    const status = data?.status || {};
    const performance = data?.performance || {};
    const heartbeat = data?.heartbeat || {};
    const currency = firstValue(status, ["accountCurrency", "account_currency"])
        || firstValue(data, ["accountCurrency", "account_currency"])
        || "USD";

    return [
        ["Currency", formatValue(currency)],
        ["Balance", formatMoney(firstValue(status, ["balance", "accountBalance", "account_balance"]), currency)],
        ["Equity", formatMoney(firstValue(status, ["equity", "accountEquity", "account_equity"]), currency)],
        ["Today's Profit", formatMoney(firstValue(performance, ["todayProfit", "today_profit", "dailyProfit", "daily_profit"]), currency)],
        ["Open Positions", formatValue(firstValue(status, ["openPositions", "open_positions", "positions"]))],
        ["Floating P/L", formatMoney(firstValue(status, ["floatingPL", "floating_pl", "floatingPnl", "floating_pnl"]), currency)],
        ["Win Rate", formatValue(firstValue(performance, ["winRate", "win_rate"]), "%")],
        ["Running Days", formatValue(firstValue(performance, ["runningDays", "running_days"]))],
        ["Last Sync", relativeTime(firstValue(status, ["lastSync", "last_sync"]) || firstValue(heartbeat, ["lastSync", "last_sync", "timestamp"]) || data?.timestamp)]
    ];
}

function LiveCard({ product, data, status }) {
    const cloudState = data?.cloudStatus || data?.status?.cloudStatus || data?.heartbeat?.cloudStatus || "";
    const isOffline = status === "offline" || cloudState === "OFFLINE";
    const isStale = cloudState === "STALE";
    const badgeText = isOffline ? "Offline" : isStale ? "Reconnecting" : "Live";
    const marketWindow = useMemo(() => getMarketWindow(), []);
    const metrics = useMemo(
        () => buildMetrics(data),
        [data]
    );

    return (
        <article className={`live-product-card live-product-${product.accent}`}>
            <div className="live-product-header">
                <div>
                    <span>{product.profile}</span>
                    <h2>{product.name}</h2>
                </div>
                <strong className={isOffline || isStale ? "is-offline" : "is-live"}>{badgeText}</strong>
            </div>

            {(isOffline || isStale) && (
                <div className="cloud-offline-state compact" role="status">
                    <strong>{isStale ? "Reconnecting to Aurora Cloud..." : "Connecting to Aurora Cloud..."}</strong>
                    <span>{isStale ? `${product.name} data is stale.` : `Waiting for ${product.name} live data.`}</span>
                </div>
            )}

            <div className="market-window-card">
                <span>{marketWindow.localTimeZone}</span>
                <strong>{marketWindow.isOpen ? "Market Open" : "Market Closed"}</strong>
                <p>
                    Close in {marketWindow.closeText}
                    <br />
                    Open in {marketWindow.openText}
                </p>
            </div>

            <div className="live-performance-grid" aria-label={`${product.name} live trading metrics`}>
                {metrics.map(([label, value]) => (
                    <div key={label}>
                        <span>{label}</span>
                        <strong>{isOffline && !data ? "Connecting..." : value}</strong>
                    </div>
                ))}
            </div>
        </article>
    );
}

function LivePerformance() {
    const [state, setState] = useState({
        mt5: { status: "loading", data: null },
        xau: { status: "loading", data: null }
    });

    useEffect(() => {
        let active = true;

        async function loadProduct(productId) {
            setState((current) => ({
                ...current,
                [productId]: {
                    ...current[productId],
                    status: current[productId]?.status === "ready" ? "syncing" : "loading"
                }
            }));

            try {
                const data = await getLiveProduct(productId);

                if (!active) {
                    return;
                }

                setState((current) => ({
                    ...current,
                    [productId]: {
                        status: data?.cloudStatus === "OFFLINE" ? "offline" : "ready",
                        data
                    }
                }));
            } catch {
                if (active) {
                    setState((current) => ({
                        ...current,
                        [productId]: {
                            ...current[productId],
                            status: "offline"
                        }
                    }));
                }
            }
        }

        function loadAll() {
            products.forEach((product) => {
                loadProduct(product.id);
            });
        }

        loadAll();
        const intervalId = globalThis.setInterval(loadAll, REFRESH_INTERVAL);

        return () => {
            active = false;
            globalThis.clearInterval(intervalId);
        };
    }, []);

    return (
        <section className="live-performance-center" id="performance">
            <div className="live-products-grid">
                {products.map((product) => (
                    <LiveCard
                        key={product.id}
                        product={product}
                        data={state[product.id]?.data}
                        status={state[product.id]?.status}
                    />
                ))}
            </div>
        </section>
    );
}

export default LivePerformance;
