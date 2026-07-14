import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getHeartbeat, getPerformance, getReleases, getStatus } from "../services/auroraApi.js";

import "../styles/customer.css";

function readValue(source, keys) {
    for (const key of keys) {
        const value = key.split(".").reduce((current, path) => current?.[path], source);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
}

function formatValue(value) {
    if (value === null) {
        return "Loading...";
    }

    return String(value);
}

function formatMoney(value) {
    if (value === null) {
        return "Loading...";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    return number.toFixed(2);
}

function formatPercent(value) {
    if (value === null) {
        return "Loading...";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    return `${number.toFixed(2)}%`;
}

function isLive(value) {
    return value === true || ["true", "running", "connected", "ok", "live"].includes(String(value).toLowerCase());
}

function statusTone(value) {
    const normalizedValue = String(value || "unknown").toLowerCase();

    if (["running", "live", "ok"].includes(normalizedValue)) {
        return "running";
    }

    if (["connected", "true"].includes(normalizedValue)) {
        return "connected";
    }

    if (["syncing", "loading"].includes(normalizedValue)) {
        return "syncing";
    }

    if (["offline", "false", "disconnected", "stopped"].includes(normalizedValue)) {
        return "offline";
    }

    return "unknown";
}

function StatusPill({ value, tone }) {
    return <span className={`status-pill ${tone || statusTone(value)}`}>{formatValue(value)}</span>;
}

function TrustRow({ label, children }) {
    return (
        <div className="trust-row">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}

function TrustCenter() {
    const [trust, setTrust] = useState(null);
    const [pageStatus, setPageStatus] = useState("loading");

    useEffect(() => {
        let mounted = true;

        Promise.allSettled([getHeartbeat(), getStatus(), getPerformance(), getReleases()])
            .then(([heartbeatResult, statusResult, performanceResult, releasesResult]) => {
                if (!mounted) {
                    return;
                }

                if (
                    heartbeatResult.status !== "fulfilled"
                    || statusResult.status !== "fulfilled"
                    || performanceResult.status !== "fulfilled"
                ) {
                    setTrust(null);
                    setPageStatus("offline");
                    return;
                }

                setTrust({
                    heartbeat: heartbeatResult.value,
                    status: statusResult.value,
                    performance: performanceResult.value,
                    releases: releasesResult.status === "fulfilled" ? releasesResult.value : []
                });
                setPageStatus("ready");
            });

        return () => {
            mounted = false;
        };
    }, []);

    const heartbeat = trust?.heartbeat || {};
    const cloudStatus = trust?.status || {};
    const performance = trust?.performance || {};
    const release = Array.isArray(trust?.releases) ? trust.releases[0] : null;
    const running = readValue(heartbeat, ["running", "status", "health"]);
    const connected = readValue(cloudStatus, ["connected"]);

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Trust Center</span>
                    <h1>Aurora live trading proof, directly from Aurora Cloud.</h1>
                    <p>
                        This page is built for buyer confidence. Current Aurora MT5 and Cloud signals come from live API
                        calls; if Aurora Cloud is offline, no fallback or mock data is displayed.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href="/pricing">Compare Plans</a>
                        <a className="customer-button secondary" href="/book-demo">Book Demo</a>
                    </div>
                </section>

                {pageStatus === "loading" && <p className="product-state">Loading...</p>}

                {pageStatus === "offline" && (
                    <p className="product-state">Cloud Offline. Waiting for Aurora Cloud...</p>
                )}

                {trust && (
                    <>
                    <section className="customer-note" aria-label="Trust assurance">
                        <h2>What is verified here</h2>
                        <p>
                            Broker, server, account status, AI status, Battle Test and Cloud connection are displayed
                            from Aurora Cloud API responses. The website does not invent live trading data.
                        </p>
                    </section>

                    <section className="customer-grid two">
                        <article className="customer-card">
                            <h2>Live Trading</h2>
                            <TrustRow label="Broker">{formatValue(readValue(heartbeat, ["broker"]))}</TrustRow>
                            <TrustRow label="Server">{formatValue(readValue(heartbeat, ["server"]))}</TrustRow>
                            <TrustRow label="Session">{formatValue(readValue(heartbeat, ["session"]))}</TrustRow>
                            <TrustRow label="Balance">{formatMoney(readValue(cloudStatus, ["balance"]))}</TrustRow>
                            <TrustRow label="Equity">{formatMoney(readValue(cloudStatus, ["equity"]))}</TrustRow>
                            <TrustRow label="Open Positions">{formatValue(readValue(cloudStatus, ["open_positions"]))}</TrustRow>
                        </article>

                        <article className="customer-card">
                            <h2>Battle Test</h2>
                            <TrustRow label="Battle Status"><StatusPill value={readValue(heartbeat, ["battle_test"])} /></TrustRow>
                            <TrustRow label="Runtime"><StatusPill value={running} /></TrustRow>
                            <TrustRow label="System Health"><StatusPill value={readValue(heartbeat, ["health"])} /></TrustRow>
                            <TrustRow label="Last Heartbeat">{formatValue(readValue(heartbeat, ["timestamp"]))}</TrustRow>
                        </article>

                        <article className="customer-card">
                            <h2>System Health</h2>
                            <TrustRow label="AI Status"><StatusPill value={readValue(cloudStatus, ["ai_status"])} /></TrustRow>
                            <TrustRow label="Cloud Status">
                                <StatusPill value={isLive(connected) ? "Connected" : "Offline"} tone={isLive(connected) ? "connected" : "offline"} />
                            </TrustRow>
                            <TrustRow label="Today P/L">
                                <StatusPill
                                    value={formatMoney(readValue(performance, ["net_profit", "profit"]))}
                                    tone={Number(readValue(performance, ["net_profit", "profit"])) < 0 ? "loss" : "profit"}
                                />
                            </TrustRow>
                            <TrustRow label="Win Rate">{formatPercent(readValue(performance, ["win_rate"]))}</TrustRow>
                        </article>

                        <article className="customer-card">
                            <h2>Release Notes</h2>
                            <TrustRow label="Release">
                                {release?.version || release?.release_version || readValue(heartbeat, ["product_id"]) || "Cloud release pending"}
                            </TrustRow>
                            <TrustRow label="Summary">
                                {release?.summary || "Release data is reserved for Aurora Cloud release service."}
                            </TrustRow>
                            <TrustRow label="Cloud API">Live</TrustRow>
                            <TrustRow label="Data Source">Aurora Cloud API</TrustRow>
                        </article>
                    </section>
                    </>
                )}
            </main>

            <Footer />
        </>
    );
}

export default TrustCenter;
