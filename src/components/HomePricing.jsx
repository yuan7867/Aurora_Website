import "../styles/v4.css";

const tiers = [
    {
        name: "Choose Product",
        price: "USD 19.90",
        summary: "Choose Aurora MT5 AI Trader or Aurora XAU Trader before selecting subscription.",
        href: "/pricing"
    },
    {
        name: "Choose Subscription",
        price: "USD 199",
        summary: "Monthly and Yearly options. Yearly Save 17%.",
        href: "/pricing"
    }
];

function HomePricing() {
    return (
        <section className="home-pricing" aria-label="Aurora pricing options">
            <div className="v4-section-heading">
                <p>Pricing</p>
                <h2>Product first. Subscription second.</h2>
            </div>

            <div className="home-pricing-grid">
                {tiers.map((tier) => (
                    <article key={tier.name}>
                        <span>{tier.name}</span>
                        <strong>{tier.price}</strong>
                        <p>{tier.summary}</p>
                        <a href={tier.href}>Choose Plan</a>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default HomePricing;
