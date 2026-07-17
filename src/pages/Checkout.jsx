import { useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { createPayPalSubscription } from "../services/commerceApi.js";
import { buildPricingHref, canCreatePayPalSubscription, getCheckoutProduct, readSelection } from "../utils/productSelection.js";

import "../styles/customer.css";

function Checkout() {
    const params = new URLSearchParams(globalThis.location.search);
    const selection = readSelection(globalThis.location.search);
    const checkoutProductId = selection.sku;
    const product = getCheckoutProduct(checkoutProductId);
    const productSalesEnabled = canCreatePayPalSubscription(checkoutProductId);
    const paymentFailed = params.get("payment") === "failed";
    const [customer, setCustomer] = useState({
        name: globalThis.localStorage?.getItem("auroraCustomerName") || "",
        email: globalThis.localStorage?.getItem("auroraCustomerEmail") || ""
    });
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    async function handlePayPalCheckout(event) {
        event.preventDefault();
        setError("");

        if (!product) {
            setStatus("error");
            setError("Choose Product before checkout.");
            return;
        }

        if (!productSalesEnabled) {
            setStatus("unavailable");
            setError("Temporarily unavailable.");
            return;
        }

        setStatus("loading");

        try {
            const subscription = await createPayPalSubscription({
                productId: checkoutProductId,
                customer
            });

            globalThis.localStorage?.setItem("auroraCustomerName", customer.name);
            globalThis.localStorage?.setItem("auroraCustomerEmail", customer.email);

            if (!subscription.approveUrl) {
                throw new Error("PayPal subscription approval URL was not returned.");
            }

            globalThis.location.assign(subscription.approveUrl);
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
                    <h1>{product ? "Confirm your Aurora order." : "Choose Product"}</h1>
                    <p>
                        Review your selected product and recurring subscription before continuing to PayPal. Each
                        Aurora product is purchased separately and receives its own license.
                    </p>
                    {paymentFailed && <p className="product-state">Payment was cancelled or failed. Please review and try again.</p>}
                    <div className="customer-actions">
                        <a className="customer-button secondary" href={buildPricingHref(selection.productId, selection.planId)}>Change Plan</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <span className="customer-tag">Order Summary</span>
                        <h2>{product?.name || "Choose Product"}</h2>
                        <div className="price">
                            {product?.price || "Select product"}
                            <span>{product ? ` / ${product.license}` : ""}</span>
                        </div>
                        <div className="trust-row">
                            <span>Strategy</span>
                            <strong>{product?.strategy || "Choose MT5 or XAU"}</strong>
                        </div>
                        <div className="trust-row">
                            <span>Subscription</span>
                            <strong>{product?.subscription || "Choose Monthly or Yearly"}</strong>
                        </div>
                        <div className="trust-row">
                            <span>Renewal</span>
                            <strong>{product ? "Automatic renewal. Cancel anytime; access remains until end of paid period." : "Select a product before payment"}</strong>
                        </div>
                        <p>{product?.summary || "No payment can be started until a product is selected."}</p>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Next Steps</span>
                        <h2>{productSalesEnabled ? "PayPal Subscription" : "Temporarily unavailable"}</h2>
                        <form className="customer-form" onSubmit={handlePayPalCheckout}>
                            <label>
                                Customer Name
                                <input
                                    required
                                    value={customer.name}
                                    onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Aurora Customer"
                                    disabled={!product || !productSalesEnabled}
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
                                    disabled={!product || !productSalesEnabled}
                                />
                            </label>
                            <button className="customer-button" type="submit" disabled={status === "loading" || !productSalesEnabled}>
                                {status === "loading" ? "Opening PayPal..." : productSalesEnabled ? "Start Subscription" : "Temporarily unavailable"}
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
