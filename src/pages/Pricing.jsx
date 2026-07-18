import { useMemo, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import {
    buildCheckoutHref,
    buildPricingHref,
    commerceProducts,
    readSelection,
    subscriptions
} from "../utils/productSelection.js";

import "../styles/customer.css";

function Pricing() {
    const initialSelection = readSelection(globalThis.location.search);
    const [selectedProduct, setSelectedProduct] = useState(initialSelection.productId);
    const [selectedSubscription, setSelectedSubscription] = useState(initialSelection.planId);

    const checkoutHref = useMemo(
        () => buildCheckoutHref(selectedProduct, selectedSubscription),
        [selectedProduct, selectedSubscription]
    );

    function updateSelection(productId, planId = selectedSubscription) {
        const href = buildPricingHref(productId, planId);
        setSelectedProduct(productId);
        setSelectedSubscription(planId);
        globalThis.history?.replaceState(null, "", href);
    }

    function updateSubscription(planId) {
        setSelectedSubscription(planId);
        if (selectedProduct) {
            globalThis.history?.replaceState(null, "", buildPricingHref(selectedProduct, planId));
        }
    }

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Pricing</span>
                    <h1>Explore Aurora Products.</h1>
                    <p>
                        Every Aurora product is purpose-built to solve a different real-world challenge.
                    </p>
                    <p>
                        Whether your focus is disciplined execution, high-performance trading, or future AI platforms,
                        Aurora provides a professional solution designed for long-term growth.
                    </p>
                    <div className="customer-actions">
                        {checkoutHref ? (
                            <a className="customer-button" href={checkoutHref}>Continue to Checkout</a>
                        ) : (
                            <a className="customer-button" href="/products">Explore Products</a>
                        )}
                    </div>
                </section>

                <section className="customer-note" aria-label="Why Aurora Products">
                    <h2>Why Aurora Products?</h2>
                    <p>
                        Aurora products are designed to serve different goals, different trading styles, and different
                        stages of growth.
                    </p>
                    <p>
                        Instead of offering one generic solution, Aurora builds specialized AI platforms, allowing every
                        customer to choose the product that best fits their objectives.
                    </p>
                    <p>
                        Aurora Luno is currently under development as a next generation digital asset platform built to
                        bring intelligent cryptocurrency research and automation to digital asset investors.
                    </p>
                </section>

                <section className="customer-flow" aria-label="Aurora purchase flow">
                    {["Explore Products", "Select License", "Checkout", "PayPal", "Receipt", "License", "Download", "Customer Dashboard"].map((step) => (
                        <span key={step}>{step}</span>
                    ))}
                </section>

                <section className="pricing-step" aria-label="Explore Aurora products">
                    <div className="pricing-step-heading">
                        <span>Step 1</span>
                        <h2>Explore Products</h2>
                    </div>
                    <div className="customer-grid pricing-product-grid">
                        {commerceProducts.map((product) => (
                            <button
                                type="button"
                                className={`customer-card pricing-choice ${selectedProduct === product.id ? "is-selected" : ""}`}
                                key={product.id}
                                onClick={() => updateSelection(product.id)}
                            >
                                <span className="customer-tag">{product.profile}</span>
                                <h3>{product.name}</h3>
                                <p>{product.summary}</p>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="pricing-step" aria-label="Select Aurora license">
                    <div className="pricing-step-heading">
                        <span>Step 2</span>
                        <h2>Select Your License</h2>
                    </div>
                    <div className="customer-grid two">
                        {subscriptions.map((subscription) => (
                            <button
                                type="button"
                                className={`customer-card pricing-choice ${selectedSubscription === subscription.id ? "is-selected" : ""}`}
                                key={subscription.id}
                                onClick={() => updateSubscription(subscription.id)}
                                disabled={!selectedProduct}
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
                    <h2>Ready to Get Started?</h2>
                    <p>
                        Select the Aurora product that matches your goals, complete your secure checkout, and receive
                        instant access to your commercial license and customer dashboard.
                    </p>
                    {checkoutHref ? (
                        <a className="customer-button" href={checkoutHref}>
                            Continue to Checkout
                        </a>
                    ) : (
                        <a className="customer-button" href="/products">
                            View Products
                        </a>
                    )}
                </section>
            </main>

            <Footer />
        </>
    );
}

export default Pricing;
