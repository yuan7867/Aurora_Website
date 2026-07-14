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

    return (
        <CustomerLayout eyebrow="My Dashboard" title="Customer Dashboard">
            {status === "loading" && <p className="product-state">Loading customer record...</p>}
            {status === "offline" && <p className="product-state">Commerce API Offline. Please try again later.</p>}
            {status === "missing" && <p className="product-state">No customer record found for this session.</p>}

            <section className="account-grid">
                <article className="account-card">
                    <span>Products</span>
                    <h2>{customer?.products?.length || 0}</h2>
                    <p>Purchased Aurora products.</p>
                </article>
                <article className="account-card">
                    <span>Licenses</span>
                    <h2>{customer?.licenses?.length || 0}</h2>
                    <p>Issued or pending license records.</p>
                </article>
                <article className="account-card">
                    <span>Downloads</span>
                    <h2>{customer?.downloads?.length || 0}</h2>
                    <p>Download links available for purchased products.</p>
                </article>
            </section>
        </CustomerLayout>
    );
}

export default AccountDashboard;
