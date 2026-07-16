import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

const productNames = {
    "aurora-mt5-monthly": "Aurora MT5 AI Trader Monthly",
    "aurora-mt5-yearly": "Aurora MT5 AI Trader Yearly",
    "aurora-xau-monthly": "Aurora XAU Trader Monthly",
    "aurora-xau-yearly": "Aurora XAU Trader Yearly"
};

function PayPalSuccess() {
    const params = new URLSearchParams(globalThis.location.search);
    const productId = params.get("product") || "";
    const subscriptionId = params.get("subscription_id") || params.get("ba_token") || params.get("token") || "";
    const productName = productNames[productId] || "Aurora Subscription";

    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">PayPal Subscription</span>
                    <h1>Subscription approval received.</h1>
                    <p>
                        Aurora waits for PayPal payment confirmation before license delivery. Your license is issued
                        only after PayPal sends a verified PAYMENT.SALE.COMPLETED webhook.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href="/account">Open Customer Portal</a>
                        <a className="customer-button secondary" href={`/checkout?sku=${productId}&payment=failed`}>Return to Checkout</a>
                    </div>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <span className="customer-tag">Selected Product</span>
                        <h2>{productName}</h2>
                        <div className="trust-row">
                            <span>Payment Provider</span>
                            <strong>PayPal Subscription</strong>
                        </div>
                        <div className="trust-row">
                            <span>Status</span>
                            <strong>Waiting for payment confirmation</strong>
                        </div>
                        <div className="trust-row">
                            <span>Subscription ID</span>
                            <strong>{subscriptionId || "Pending from PayPal"}</strong>
                        </div>
                    </article>

                    <article className="customer-card">
                        <span className="customer-tag">Next</span>
                        <h2>License Delivery</h2>
                        <p>
                            License activation, renewal and status changes are handled by verified PayPal webhooks and
                            Aurora License API. Approval alone does not issue a license.
                        </p>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default PayPalSuccess;
