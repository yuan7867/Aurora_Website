import "../styles/products.css";

function CTA() {
    return (
        <section className="why-cta" aria-label="Why Aurora and start options">
            <div className="why-panel">
                <div>
                    <p className="section-tag">Why Aurora</p>
                    <h2>Strategy-first trading systems, packaged like commercial software.</h2>
                </div>

                <div className="why-visual" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
            </div>

            <div className="final-cta">
                <p>Ready To Start?</p>
                <h2>Choose Your Trading Strategy Today.</h2>
                <div>
                    <a href="/checkout?product=aurora-mt5-ai">Aurora MT5</a>
                    <a href="/checkout?product=aurora-xau-trader">Aurora XAU</a>
                </div>
            </div>
        </section>
    );
}

export default CTA;
