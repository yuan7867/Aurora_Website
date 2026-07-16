import { useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { createPayPalOrder } from "../services/commerceApi.js";

import "../styles/customer.css";

const products = {
    "aurora-mt5-monthly": {
        name: "Aurora MT5 AI Trader",
        strategy: "Conservative Strategy",
        summary: "Disciplined MT5 execution for long-term traders.",
        subscription: "Monthly",
        price: "USD 19.90",
        license: "Monthly subscription"
    },
    "aurora-mt5-yearly": {
        name: "Aurora MT5 AI Trader",
        strategy: "Conservative Strategy",
        summary: "Disciplined MT5 execution for long-term traders.",
        subscription: "Yearly",
        price: "USD 199",
        license: "Yearly subscription. Save 17%"
    },
    "aurora-xau-monthly": {
        name: "Aurora XAU AI Trader",
        strategy: "Aggressive Strategy",
        summary: "Active XAU strategy for maximum opportunity.",
        subscription: "Monthly",
        price: "USD 19.90",
        license: "Monthly subscription"
    },
    "aurora-xau-yearly": {
        name: "Aurora XAU AI Trader",
        strategy: "Aggressive Strategy",
        summary: "Active XAU strategy for maximum opportunity.",
        subscription: "Yearly",
        price: "USD 199",
        license: "Yearly subscription. Save 17%"
    }
};

function Checkout() {
    const params = new URLSearchParams(globalThis.location.search);
    const checkoutProductId = params.get("sku") || "aurora-mt5-yearly";
    const product = products[checkoutProductId] || products["aurora-mt5-yearly"];
    const paymentFailed = params.get("payment") === "failed";
    const [customer, setCustomer] = useState({
        name: globalThis.localStorage?.getItem("auroraCustomerName") || "",
        email: globalThis.localStorage?.getItem("auroraCustomerEmail") || ""
    });
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    async function handlePayPalCheckout(event) {
        event.preventDefault();
        setStatus("loading");
        setError("");

        try {
            const order = await createPayPalOrder({
                productId: checkoutProductId,
                customer
            });

            globalThis.localStorage?.setItem("auroraCustomerName", customer.name);
            globalThis.localStorage?.setItem("auroraCustomerEmail", customer.email);

            if (!order.approveUrl) {
                throw new Error("PayPal approval URL was not returned.");
            }

            globalThis.location.assign(order.approveUrl);
        } catch (checkoutError) {
            setStatus("error");
            setError(checkoutError.message);
        }
    }

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Checkout</span>
                    <h1>Confirm your Aurora order.</h1>
                    <p>
                        Review your selected product and subscription before continuing to PayPal. Payment is created
                        by Aurora Commerce API and can run in sandbox or production mode.
                    </p>
                    {paymentFailed && <p className="product-state">Payment was cancelled or failed. Please review and try again.</p>}
                    <div className="customer-actions">
                        <a className="customer-button secondary" href="/pricing">Change Plan</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <span className="customer-tag">Order Summary</span>
                        <h2>{product.name}</h2>
                        <div className="price">
                            {product.price}
                            <span> / {product.license}</span>
                        </div>
                        <div className="trust-row">
                            <span>Strategy</span>
                            <strong>{product.strategy}</strong>
                        </div>
                        <div className="trust-row">
                            <span>Subscription</span>
                            <strong>{product.subscription}</strong>
                        </div>
                        <div className="trust-row">
                            <span>Delivery</span>
                            <strong>License and download after PayPal success</strong>
                        </div>
                        <p>{product.summary}</p>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Next Steps</span>
                        <h2>PayPal Checkout</h2>
                        <form className="customer-form" onSubmit={handlePayPalCheckout}>
                            <label>
                                Customer Name
                                <input
                                    required
                                    value={customer.name}
                                    onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Aurora Customer"
                                />
                            </label>
                            <label>
                                Email for License Delivery
                                <input
                                    required
                                    type="email"
                                    value={customer.email}
                                    onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="customer@example.com"
                                />
                            </label>
                            <button className="customer-button" type="submit" disabled={status === "loading"}>
                                {status === "loading" ? "Opening PayPal..." : "Continue to PayPal"}
                            </button>
                            {error && <p className="product-state">{error}</p>}
                        </form>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default Checkout;
