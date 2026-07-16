import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { capturePayPalOrder } from "../services/commerceApi.js";

import "../styles/customer.css";

const productNames = {
    "aurora-mt5-monthly": "Aurora MT5 AI Trader Monthly",
    "aurora-mt5-yearly": "Aurora MT5 AI Trader Yearly",
    "aurora-xau-monthly": "Aurora XAU Trader Monthly",
    "aurora-xau-yearly": "Aurora XAU Trader Yearly"
};

function PayPalSuccess() {
    const params = new URLSearchParams(globalThis.location.search);
    const productId = params.get("product") || "aurora-mt5-yearly";
    const orderId = params.get("token") || params.get("orderId");
    const productName = productNames[productId] || productNames["aurora-mt5-yearly"];
    const [state, setState] = useState({
        status: orderId ? "loading" : "error",
        message: orderId ? "Capturing PayPal payment..." : "PayPal order id was not returned.",
        customer: null
    });

    useEffect(() => {
        if (!orderId) {
            return;
        }

        let mounted = true;

        capturePayPalOrder(orderId)
            .then((payload) => {
                const email = payload?.result?.customer?.email;

                if (email) {
                    globalThis.localStorage?.setItem("auroraCustomerEmail", email);
                }

                if (mounted) {
                    setState({
                        status: "success",
                        message: "Payment captured. License request sent and customer record updated.",
                        customer: payload?.result?.customer || null
                    });
                }
            })
            .catch((error) => {
                if (mounted) {
                    setState({
                        status: "error",
                        message: error.message,
                        customer: null
                    });
                }
            });

        return () => {
            mounted = false;
        };
    }, [orderId]);

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">PayPal Success</span>
                    <h1>{state.status === "success" ? "Payment captured." : "Processing PayPal payment."}</h1>
                    <p>
                        {state.message}
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href={`/license?product=${productId}`}>Continue to License Delivery</a>
                        {state.status === "error" && <a className="customer-button secondary" href={`/checkout?sku=${productId}&payment=failed`}>Return to Checkout</a>}
                        <a className="customer-button secondary" href="/account">Open Customer Portal</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <span className="customer-tag">Purchased Product</span>
                        <h2>{productName}</h2>
                        <div className="trust-row">
                            <span>Payment Provider</span>
                            <strong>PayPal</strong>
                        </div>
                        <div className="trust-row">
                            <span>Status</span>
                            <strong>{state.status}</strong>
                        </div>
                        <div className="trust-row">
                            <span>Order ID</span>
                            <strong>{orderId || "Missing"}</strong>
                        </div>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Next</span>
                        <h2>License Delivery</h2>
                        <p>
                            License API, email delivery and customer records are completed by Aurora Commerce API after
                            PayPal capture succeeds.
                        </p>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default PayPalSuccess;
