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
                    <h1>Choose product. Choose subscription. Start trading.</h1>
                    <p>
                        Choose one Aurora trading system, then select Monthly or Yearly access. Each product is
                        purchased separately with its own license and download delivery.
                    </p>
                    <div className="customer-actions">
                        {checkoutHref ? (
                            <a className="customer-button" href={checkoutHref}>Continue to Checkout</a>
                        ) : (
                            <span className="customer-button is-disabled" aria-disabled="true">Choose Product</span>
                        )}
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
                    <h2>{selectedProduct ? "Your Aurora order path is ready." : "Choose Product"}</h2>
                    <p>
                        Product and subscription are selected before checkout, so the commercial journey is clear:
                        product decision, PayPal payment, receipt, license, download and dashboard access.
                    </p>
                    {checkoutHref ? (
                        <a className="customer-button" href={checkoutHref}>
                            Continue to Checkout
                        </a>
                    ) : (
                        <span className="customer-button is-disabled" aria-disabled="true">
                            Choose Product
                        </span>
                    )}
                </section>
            </main>

            <Footer />
        </>
    );
}

export default Pricing;
