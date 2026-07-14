import "../styles/v4.css";

const tiers = [
    {
        name: "Monthly",
        price: "USD 19.90",
        summary: "Best for getting started with Aurora commercial access.",
        href: "/checkout?plan=monthly"
    },
    {
        name: "Yearly",
        price: "USD 199",
        summary: "Save 17%. Most popular for committed traders.",
        href: "/checkout?plan=yearly"
    }
];

function HomePricing() {
    return (
        <section className="home-pricing" aria-label="Aurora pricing options">
            <div className="v4-section-heading">
                <p>Pricing</p>
                <h2>Simple plans for commercial trading systems.</h2>
            </div>

            <div className="home-pricing-grid">
                {tiers.map((tier) => (
                    <article key={tier.name}>
                        <span>{tier.name}</span>
                        <strong>{tier.price}</strong>
                        <p>{tier.summary}</p>
                        <a href={tier.href}>Buy Now</a>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default HomePricing;
