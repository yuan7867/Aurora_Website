import "../styles/v4.css";

const rows = [
    ["Strategy", "Conservative AI execution", "Aggressive XAU opportunity"],
    ["Primary Goal", "Capital protection and disciplined growth", "Higher growth potential with higher intensity"],
    ["Risk Profile", "Lower intensity", "Higher intensity"],
    ["Best For", "Long-term disciplined traders", "Traders seeking maximum opportunity"],
    ["Trading Logic", "Adaptive risk control", "Advanced grid engine"],
    ["License", "Commercial license ready", "Commercial license ready"]
];

function CompareTradingSystems() {
    return (
        <section className="compare-systems" aria-label="Compare Aurora MT5 and Aurora XAU">
            <div className="v4-section-heading">
                <p>Compare MT5 vs XAU</p>
                <h2>Choose the system that matches your trading profile.</h2>
            </div>

            <div className="comparison-table" role="table" aria-label="Aurora MT5 vs Aurora XAU comparison">
                <div className="comparison-row comparison-head" role="row">
                    <span role="columnheader">Category</span>
                    <strong role="columnheader">Aurora MT5 AI Trader</strong>
                    <strong role="columnheader">Aurora XAU Trader</strong>
                </div>

                {rows.map(([category, mt5, xau]) => (
                    <div className="comparison-row" role="row" key={category}>
                        <span role="cell">{category}</span>
                        <p role="cell">{mt5}</p>
                        <p role="cell">{xau}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default CompareTradingSystems;
