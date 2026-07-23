import { useEffect, useState } from "react";

import CustomerLayout from "../../components/layouts/CustomerLayout";
import { createDownloadToken, getCustomer, getCustomerDownloads } from "../../services/commerceApi.js";

function AccountDashboard() {
    const [customer, setCustomer] = useState(null);
    const [downloadCenter, setDownloadCenter] = useState({ products: [] });
    const [status, setStatus] = useState("loading");
    const [action, setAction] = useState("");

    useEffect(() => {
        Promise.all([getCustomer(), getCustomerDownloads()])
            .then(([payload, downloadPayload]) => {
                setCustomer(payload.customer);
                setDownloadCenter(downloadPayload.downloads || { products: [] });
                setStatus(payload.customer ? "ready" : "missing");
            })
            .catch(() => setStatus("offline"));
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

    const products = customer?.products || [];
    const licenses = customer?.licenses || [];
    const downloads = customer?.downloads || [];
    const receipts = customer?.receipts || customer?.orders || [];
    const invoices = customer?.invoices || receipts;
    const tickets = customer?.supportTickets || [];
    const subscription = customer?.subscription || customer?.plan || {};
    const subscriptionName = subscription.name || subscription.interval || "Monthly / Yearly";
    const renewDate = subscription.renewDate || subscription.renew_date || subscription.nextBillingDate || "After checkout";
    const activationStatus = licenses.some((license) => license.status === "Issued" || license.status === "Active")
        ? "Active"
        : "Pending";

    return (
        <CustomerLayout eyebrow="My Dashboard" title="Customer Dashboard">
            {status === "loading" && <p className="product-state">Loading customer record...</p>}
            {status === "offline" && <p className="product-state">Commerce API Offline. Please try again later.</p>}
            {status === "missing" && <p className="product-state">No customer record found for this session.</p>}

            <section className="account-grid">
                <article className="account-card">
                    <span>My Products</span>
                    <h2>{products.length}</h2>
                    <p>Purchased Aurora trading systems.</p>
                </article>
                <article className="account-card">
                    <span>Subscriptions</span>
                    <h2>{subscriptionName}</h2>
                    <p>Current customer subscription tier.</p>
                </article>
                <article className="account-card">
                    <span>Renew Date</span>
                    <h2>{renewDate}</h2>
                    <p>Next renewal or activation milestone.</p>
                </article>
            </section>

            <section className="account-grid account-commercial-grid">
                <article className="account-card">
                    <span>License</span>
                    <h2>{licenses.length}</h2>
                    <p>License records connected to purchased products.</p>
                </article>
                <article className="account-card">
                    <span>Receipt</span>
                    <h2>{receipts.length}</h2>
                    <p>PayPal receipts and purchase confirmations.</p>
                </article>
                <article className="account-card">
                    <span>Invoices</span>
                    <h2>{invoices.length}</h2>
                    <p>Commercial billing documents available for review.</p>
                </article>
                <article className="account-card">
                    <span>Downloads</span>
                    <h2>{downloads.length}</h2>
                    <p>Installer and release downloads assigned to this customer.</p>
                </article>
                <article className="account-card">
                    <span>Activation Status</span>
                    <h2>{activationStatus}</h2>
                    <p>Activation is shown from customer license records.</p>
                </article>
                <article className="account-card">
                    <span>Support Ticket</span>
                    <h2>{tickets.length}</h2>
                    <p>Support requests linked to this customer account.</p>
                </article>
            </section>

            {status === "ready" && (
                <section className="customer-grid two">
                    {downloadCenter.products.map((product) => (
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
                            <a className="customer-button secondary" href="/account/downloads">Release Notes</a>
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
            )}
        </CustomerLayout>
    );
}

export default AccountDashboard;
