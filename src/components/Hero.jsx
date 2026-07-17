import "../styles/hero.css";

function Hero() {
    return (
        <section className="hero">
            <div className="hero-stars" aria-hidden="true" />
            <div className="aurora-shader" aria-hidden="true" />
            <div className="hero-fog" aria-hidden="true" />
            <div className="hero-logo-symbol" aria-label="Aurora Symbol Placeholder">
                <img src="/brand/aurora-symbol.svg" alt="Aurora Symbol" />
            </div>

            <div className="hero-container">
                <div className="hero-copy">
                    <h1>
                        Build Wealth
                        <span>With Confidence.</span>
                    </h1>

                    <h2>
                        <span>Professional AI Trading Systems</span>
                        <span>Commercial Grade</span>
                        <span>Battle Tested</span>
                    </h2>

                    <div className="hero-actions">
                        <a
                            href="/checkout?product=aurora-mt5-ai"
                            className="hero-button hero-button-primary"
                        >
                            Buy Now
                        </a>

                        <a
                            href="/performance"
                            className="hero-button hero-button-secondary"
                        >
                            Watch Live Trading
                        </a>
                    </div>

                </div>
            </div>
        </section>
    );
}

export default Hero;
