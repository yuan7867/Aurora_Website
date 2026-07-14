import "../styles/v4.css";

const liveMetrics = [
    "Balance",
    "Equity",
    "Today's Return",
    "Open Positions",
    "Win Rate",
    "Profit Factor",
    "Running Days",
    "Last Update"
];

function LivePerformance() {
    return (
        <section className="live-performance-center" id="performance">
            <div className="v4-section-heading">
                <p>Live Trading Section</p>
                <h2>Aurora Cloud live trading data reserved.</h2>
            </div>

            <div className="live-performance-grid" aria-label="Aurora HY live trading center">
                {liveMetrics.map((metric) => (
                    <article key={metric}>
                        <span>{metric}</span>
                        <strong>Cloud API Reserved</strong>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default LivePerformance;
