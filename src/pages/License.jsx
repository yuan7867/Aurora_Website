import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getCustomer } from "../services/commerceApi.js";

import "../styles/customer.css";
import { useEffect, useState } from "react";

const productNames = {
    "aurora-mt5-ai": "Aurora MT5 AI Trader",
    "aurora-xau-trader": "Aurora XAU Trader"
};

function License() {
    const params = new URLSearchParams(globalThis.location.search);
    const productId = params.get("product") || "aurora-mt5-ai";
    const productName = productNames[productId] || productNames["aurora-mt5-ai"];
    const [customer, setCustomer] = useState(null);

    useEffect(() => {
        getCustomer()
            .then((payload) => setCustomer(payload.customer))
            .catch(() => setCustomer(null));
    }, []);

    const license = customer?.licenses?.find((item) => item.id === productId);

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">License Delivery</span>
                    <h1>Your Aurora license delivery is prepared.</h1>
                    <p>
                        License generation, machine binding, activation and validation are handled by the product
                        license services. This page reads the customer license delivery record from Aurora Commerce.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href={`/download?product=${productId}`}>Go to Download Center</a>
                        <a className="customer-button secondary" href="/account/licenses">View My Licenses</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <span className="customer-tag">Product</span>
                        <h2>{productName}</h2>
                        <div className="trust-row">
                            <span>License Status</span>
                            <strong>{license?.status || "Waiting for Commerce Record"}</strong>
                        </div>
                        <div className="trust-row">
                            <span>License Key</span>
                            <strong>{license?.licenseKey || "Pending"}</strong>
                        </div>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Customer Access</span>
                        <h2>Portal Ready</h2>
                        <p>
                            Customers continue to downloads and customer portal after the license delivery step.
                        </p>
                        <a className="customer-button secondary" href="/account">Open Customer Portal</a>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default License;
