import { useMemo, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

const products = [
    {
        id: "aurora-mt5-ai",
        name: "Aurora MT5 AI Trader",
        profile: "Conservative Strategy",
        summary: "Built for disciplined traders who prioritize risk control, consistency and long-term execution.",
        future: false
    },
    {
        id: "aurora-xau-trader",
        name: "Aurora XAU AI Trader",
        profile: "Aggressive Strategy",
        summary: "Built for traders seeking higher opportunity with active XAU execution logic.",
        future: false
    },
    {
        id: "aurora-bundle",
        name: "Aurora Bundle",
        profile: "MT5 + XAU",
        summary: "A unified Aurora trading package for customers who want both strategy profiles.",
        future: false
    },
    {
        id: "future-products",
        name: "Future Products",
        profile: "Moomoo, Luno, Event Trader",
        summary: "The pricing structure is prepared for future Aurora products as they become commercial.",
        future: true
    }
];

const subscriptions = [
    {
        id: "monthly",
        name: "Monthly",
        price: "USD 19.90",
        note: "Best for getting started",
        billing: "Billed monthly"
    },
    {
        id: "yearly",
        name: "Yearly",
        price: "USD 199",
        note: "Most Popular",
        billing: "Yearly Save 17%"
    }
];

function Pricing() {
    const [selectedProduct, setSelectedProduct] = useState("aurora-mt5-ai");
    const [selectedSubscription, setSelectedSubscription] = useState("yearly");

    const checkoutHref = useMemo(
        () => `/checkout?product=${encodeURIComponent(selectedProduct)}&plan=${encodeURIComponent(selectedSubscription)}`,
        [selectedProduct, selectedSubscription]
    );

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Pricing</span>
                    <h1>Choose product. Choose subscription. Start trading.</h1>
                    <p>
                        Aurora pricing is structured around the product first, then the subscription. Checkout,
                        license delivery, downloads and customer access continue through the commercial flow.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href={checkoutHref}>Continue to Checkout</a>
                        <a className="customer-button secondary" href="/book-demo">Book Demo</a>
                    </div>
                </section>

                <section className="customer-flow" aria-label="Aurora purchase flow">
                    {["Choose Product", "Choose Subscription", "Checkout", "PayPal", "Receipt", "License", "Download", "Customer Dashboard"].map((step) => (
                        <span key={step}>{step}</span>
                    ))}
                </section>

                <section className="pricing-step" aria-label="Choose Aurora product">
                    <div className="pricing-step-heading">
                        <span>Step 1</span>
                        <h2>Choose Product</h2>
                    </div>
                    <div className="customer-grid pricing-product-grid">
                        {products.map((product) => (
                            <button
                                type="button"
                                className={`customer-card pricing-choice ${selectedProduct === product.id ? "is-selected" : ""}`}
                                key={product.id}
                                onClick={() => !product.future && setSelectedProduct(product.id)}
                                disabled={product.future}
                            >
                                <span className="customer-tag">{product.profile}</span>
                                <h3>{product.name}</h3>
                                <p>{product.summary}</p>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="pricing-step" aria-label="Choose Aurora subscription">
                    <div className="pricing-step-heading">
                        <span>Step 2</span>
                        <h2>Choose Subscription</h2>
                    </div>
                    <div className="customer-grid two">
                        {subscriptions.map((subscription) => (
                            <button
                                type="button"
                                className={`customer-card pricing-choice ${selectedSubscription === subscription.id ? "is-selected" : ""}`}
                                key={subscription.id}
                                onClick={() => setSelectedSubscription(subscription.id)}
                            >
                                <span className="customer-tag">{subscription.note}</span>
                                <h3>{subscription.name}</h3>
                                <div className="price">
                                    {subscription.price}
                                    <span> / {subscription.billing}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="customer-note" aria-label="Selected purchase path">
                    <h2>Your Aurora order path is ready.</h2>
                    <p>
                        Product and subscription are selected before checkout, so the commercial journey is clear:
                        product decision, PayPal payment, receipt, license, download and dashboard access.
                    </p>
                    <a className="customer-button" href={checkoutHref}>
                        Continue to Checkout
                    </a>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default Pricing;
