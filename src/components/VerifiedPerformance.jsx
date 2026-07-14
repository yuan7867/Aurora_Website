import "../styles/v4.css";

const proofItems = [
    ["Commercial Verified", "Prepared for commercial purchase, license delivery and customer access."],
    ["Battle Tested", "Positioned around real trading validation rather than presentation-only claims."],
    ["Production Ready", "Frontend flow, customer path and release handoff are structured for launch."],
    ["Aurora Cloud Synced", "Live trading values are read through the Aurora Cloud API when the cloud is online."]
];

function VerifiedPerformance() {
    return (
        <section className="verified-performance" aria-label="Verified Aurora performance signals">
            <div className="v4-section-heading">
                <p>Verified Performance</p>
                <h2>Trust signals customers can understand before buying.</h2>
            </div>

            <div className="verified-grid">
                {proofItems.map(([title, text]) => (
                    <article key={title}>
                        <span>Verified</span>
                        <strong>{title}</strong>
                        <p>{text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default VerifiedPerformance;
