import { useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { createPayPalOrder } from "../services/commerceApi.js";
import { buildPricingHref, canCreatePayPalOrder, getCheckoutProduct, readSelection, salesEnabled } from "../utils/productSelection.js";

import "../styles/customer.css";

function Checkout() {
    const params = new URLSearchParams(globalThis.location.search);
    const selection = readSelection(globalThis.location.search);
    const checkoutProductId = selection.sku;
    const product = getCheckoutProduct(checkoutProductId);
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

        if (!canCreatePayPalOrder(checkoutProductId)) {
            setStatus("unavailable");
            setError("Temporarily unavailable.");
            return;
        }

        setStatus("loading");

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
                    <h1>{product ? "Confirm your Aurora order." : "Choose Product"}</h1>
                    <p>
                        Review your selected product and subscription before continuing to PayPal. Each Aurora product
                        is purchased separately and receives its own license.
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
                            <span>Delivery</span>
                            <strong>{product ? "License and download after PayPal success" : "Select a product before payment"}</strong>
                        </div>
                        <p>{product?.summary || "No payment can be started until a product is selected."}</p>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Next Steps</span>
                        <h2>{salesEnabled ? "PayPal Checkout" : "Temporarily unavailable"}</h2>
                        <form className="customer-form" onSubmit={handlePayPalCheckout}>
                            <label>
                                Customer Name
                                <input
                                    required
                                    value={customer.name}
                                    onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Aurora Customer"
                                    disabled={!product || !salesEnabled}
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
                                    disabled={!product || !salesEnabled}
                                />
                            </label>
                            <button className="customer-button" type="submit" disabled={status === "loading" || !canCreatePayPalOrder(checkoutProductId)}>
                                {status === "loading" ? "Opening PayPal..." : salesEnabled ? "Continue to PayPal" : "Temporarily unavailable"}
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
