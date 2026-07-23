import { useEffect, useState } from "react";

import CustomerLayout from "../../components/layouts/CustomerLayout";
import { createDownloadToken, getCustomerDownloads } from "../../services/commerceApi.js";

function AccountDownloads() {
    const [products, setProducts] = useState([]);
    const [history, setHistory] = useState([]);
    const [status, setStatus] = useState("loading");
    const [action, setAction] = useState("");

    useEffect(() => {
        let mounted = true;

        getCustomerDownloads()
            .then((payload) => {
                if (!mounted) {
                    return;
                }
                setProducts(payload.downloads?.products || []);
                setHistory(payload.downloads?.history || []);
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
        <CustomerLayout eyebrow="Downloads" title="Customer Downloads">
            {status === "loading" && <p className="product-state">Loading...</p>}
            {status === "offline" && <p className="product-state">Commerce API Offline. Waiting for Aurora Commerce...</p>}
            {status === "missing" && <p className="product-state">No purchased downloads found.</p>}

            {status === "ready" && (
                <>
                    <section className="customer-grid two">
                        {products.map((product) => (
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
                    </section>
                    <section className="account-list">
                        {history.map((item) => (
                            <article className="account-row" key={`${item.licenseProductId}-${item.createdAt}-${item.result}`}>
                                <strong>{item.productId}</strong>
                                <span>{item.version}</span>
                                <span>{item.result}</span>
                                <span>{item.createdAt}</span>
                            </article>
                        ))}
                    </section>
                </>
            )}
        </CustomerLayout>
    );
}

export default AccountDownloads;
