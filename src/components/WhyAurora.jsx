import "../styles/v4.css";

const reasons = [
    ["Real Trading Foundation", "Aurora is built around trading execution, customer confidence and live-status readiness."],
    ["Commercial License Path", "Customers see a clear route from purchase to license delivery and download access."],
    ["Professional Support", "Support, documentation and account access are structured for serious commercial buyers."]
];

function WhyAurora() {
    return (
        <section className="why-aurora" id="trust">
            <div className="v4-section-heading">
                <p>Why Aurora</p>
                <h2>Three reasons customers can trust Aurora.</h2>
            </div>

            <div className="why-aurora-grid">
                {reasons.map(([title, text]) => (
                    <article key={title}>
                        <strong>{title}</strong>
                        <p>{text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default WhyAurora;
