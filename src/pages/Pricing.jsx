import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

const plans = [
    {
        name: "Monthly",
        strategy: "Best for getting started",
        price: "USD 19.90",
        billing: "per month",
        summary: "Start with Aurora professional AI trading access on a monthly plan.",
        features: ["Commercial license access", "Aurora MT5 AI Trader", "Aurora XAU Trader", "Customer portal access"],
        action: "Start Monthly",
        plan: "monthly"
    },
    {
        name: "Yearly",
        strategy: "Most Popular",
        price: "USD 199",
        billing: "per year",
        summary: "Save 17% with annual Aurora commercial access.",
        features: ["Save 17%", "Commercial license access", "Aurora MT5 AI Trader", "Aurora XAU Trader", "Priority customer portal access"],
        action: "Start Yearly",
        plan: "yearly"
    }
];

function Pricing() {
    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Pricing</span>
                    <h1>Choose your Aurora trading system.</h1>
                    <p>
                        Select a product, continue to checkout, complete PayPal, receive license delivery and access
                        the download center through the customer portal.
                    </p>
                    <div className="customer-actions">
                        <a className="customer-button" href="#plans">Compare Plans</a>
                        <a className="customer-button secondary" href="/book-demo">Book Demo</a>
                    </div>
                </section>

                <section className="customer-flow" aria-label="Aurora purchase flow">
                    {["Pricing", "Checkout", "PayPal", "License", "Download", "Customer Portal"].map((step) => (
                        <span key={step}>{step}</span>
                    ))}
                </section>

                <section className="customer-grid" id="plans" aria-label="Aurora pricing plans">
                    {plans.map((plan) => (
                        <article className="customer-card" key={plan.name}>
                            <span className="customer-tag">{plan.strategy}</span>
                            <h2>{plan.name}</h2>
                            <div className="price">
                                {plan.price}
                                <span> / {plan.billing}</span>
                            </div>
                            <p>{plan.summary}</p>
                            <ul>
                                {plan.features.map((feature) => (
                                    <li key={feature}>{feature}</li>
                                ))}
                            </ul>
                            <a className="customer-button" href={`/checkout?plan=${plan.plan}`}>
                                {plan.action}
                            </a>
                        </article>
                    ))}
                </section>

                <section className="customer-note" aria-label="Purchase assurance">
                    <h2>Commercial purchase path is ready.</h2>
                    <p>
                        PayPal, license delivery and downloads are represented as frontend commercial steps only.
                        License generation, activation and validation remain outside the website.
                    </p>
                    <a className="customer-button secondary" href="/trust">Verify Live Status</a>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default Pricing;
