import { useEffect, useState } from "react";

import CustomerLayout from "../../components/layouts/CustomerLayout";
import { getCustomer } from "../../services/commerceApi.js";

function AccountDashboard() {
    const [customer, setCustomer] = useState(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        getCustomer()
            .then((payload) => {
                setCustomer(payload.customer);
                setStatus(payload.customer ? "ready" : "missing");
            })
            .catch(() => setStatus("offline"));
    }, []);

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
        </CustomerLayout>
    );
}

export default AccountDashboard;
