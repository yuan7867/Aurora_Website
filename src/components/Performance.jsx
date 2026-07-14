import "../styles/products.css";

const metrics = [
    { label: "Live Balance", value: "$2,978.70", note: "Updated 1 min ago" },
    { label: "Today's Return", value: "+1.42%", note: "+$41.72" },
    { label: "Running Since", value: "127 Days", note: "24/7 Live Trading" },
    { label: "Version", value: "V2.4 RC", note: "MaxT Engine" },
    { label: "Last Update", value: "2 min ago", note: "All Systems Operational" }
];

function Performance() {
    return (
        <section className="performance" id="performance">
            <div className="performance-copy">
                <p>Live Performance</p>
                <h2>Real Results. Real Trading.</h2>
                <a href="/trust">View Live Dashboard</a>
            </div>

            <div className="performance-panel" aria-label="Aurora HY live performance dashboard">
                {metrics.map((metric) => (
                    <div className="performance-metric" key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>{metric.note}</small>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default Performance;
