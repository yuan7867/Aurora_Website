import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getCustomer } from "../services/commerceApi.js";

import "../styles/customer.css";

function DownloadCenter() {
    const [downloads, setDownloads] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let mounted = true;

        getCustomer()
            .then((payload) => {
                if (!mounted) {
                    return;
                }

                setDownloads(payload.customer?.downloads || []);
                setStatus(payload.customer ? "ready" : "missing");
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

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Download Center</span>
                    <h1>Aurora release downloads.</h1>
                    <p>
                        Download access is based on purchased products in the Aurora Commerce customer record.
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
                            <h2>No Purchased Downloads</h2>
                            <p>Complete checkout before downloads appear here.</p>
                            <a className="customer-button" href="/pricing">View Pricing</a>
                        </article>
                    )}

                    {status === "ready" && downloads.map((download) => (
                        <article className="customer-card" key={download.id}>
                            <h2>{download.productName}</h2>
                            <div className="trust-row">
                                <span>Status</span>
                                <strong>{download.status}</strong>
                            </div>
                            <a className="customer-button" href={download.url}>Download</a>
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
