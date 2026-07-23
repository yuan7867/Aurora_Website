import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { createDownloadToken, getCustomerDownloads } from "../services/commerceApi.js";

import "../styles/customer.css";

function DownloadCenter() {
    const [downloads, setDownloads] = useState({ products: [], history: [] });
    const [status, setStatus] = useState("loading");
    const [action, setAction] = useState("");

    useEffect(() => {
        let mounted = true;

        getCustomerDownloads()
            .then((payload) => {
                if (!mounted) {
                    return;
                }

                setDownloads(payload.downloads || { products: [], history: [] });
                setStatus("ready");
            })
            .catch(() => {
                if (mounted) {
                    setStatus("offline");
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    async function startDownload(productId) {
        setAction(productId);
        try {
            const token = await createDownloadToken(productId);
            window.location.href = token.tokenUrl;
        } catch (error) {
            setAction("");
            window.alert(error.message);
        }
    }

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Download Center</span>
                    <h1>Aurora commercial downloads.</h1>
                    <p>
                        Download access is verified through your Aurora commercial license. Each download uses a
                        private one-time link that expires after 10 minutes.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href="/account/downloads">Open My Downloads</a>
                        <a className="customer-button secondary" href="/account">Customer Portal</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    {status === "loading" && (
                        <article className="customer-card">
                            <h2>Loading Downloads</h2>
                            <p>Checking Aurora Commerce customer record...</p>
                        </article>
                    )}

                    {status === "offline" && (
                        <article className="customer-card">
                            <h2>Commerce Offline</h2>
                            <p>Waiting for Aurora Commerce API...</p>
                        </article>
                    )}

                    {status === "missing" && (
                        <article className="customer-card">
                            <h2>Login Required</h2>
                            <p>Login with your verified Aurora customer account to access commercial downloads.</p>
                            <a className="customer-button" href="/login">Login</a>
                        </article>
                    )}

                    {status === "ready" && downloads.products.map((product) => (
                        <article className="customer-card" key={product.id}>
                            <h2>{product.name}</h2>
                            <div className="trust-row">
                                <span>Status</span>
                                <strong>{product.status}</strong>
                            </div>
                            <div className="trust-row">
                                <span>Subscription</span>
                                <strong>{product.subscription}</strong>
                            </div>
                            <div className="trust-row">
                                <span>Current Version</span>
                                <strong>{product.currentVersion}</strong>
                            </div>
                            <div className="trust-row">
                                <span>Released</span>
                                <strong>{product.released}</strong>
                            </div>
                            <div className="trust-row">
                                <span>License</span>
                                <strong>{product.license}</strong>
                            </div>
                            <div className="trust-row">
                                <span>Expires</span>
                                <strong>{product.expires || "Not Active"}</strong>
                            </div>
                            <div className="trust-row">
                                <span>SHA256</span>
                                <strong>{product.sha256}</strong>
                            </div>
                            <h3>Release Notes</h3>
                            <ul>
                                {product.releaseNotes.changes.map((item) => <li key={item}>{item}</li>)}
                                {product.releaseNotes.bugFixes.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                            <h3>Windows Installation Guide</h3>
                            <ul>
                                {product.installationGuide.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                            <button
                                className="customer-button"
                                disabled={!product.canDownload || action === product.id}
                                type="button"
                                onClick={() => startDownload(product.id)}
                            >
                                {action === product.id ? "Preparing..." : "Download Latest"}
                            </button>
                        </article>
                    ))}

                    <article className="customer-card">
                        <h2>System Requirements</h2>
                        <ul>
                            <li>Windows 11</li>
                            <li>MetaTrader 5 account and terminal</li>
                            <li>Aurora Cloud connectivity</li>
                            <li>Active Aurora license when licensing is enabled</li>
                        </ul>
                        <a className="customer-button" href="/account">Customer Area</a>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default DownloadCenter;
