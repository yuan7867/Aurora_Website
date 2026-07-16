import { useState } from "react";

import "../styles/products.css";

const icons = {
    shield: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
    ),
    brain: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v.2A3.8 3.8 0 0 0 4 9v1a4 4 0 0 0 2 3.5V18a3 3 0 0 0 3 3h1V2h-.5Z" />
            <path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v.2A3.8 3.8 0 0 1 20 9v1a4 4 0 0 1-2 3.5V18a3 3 0 0 1-3 3h-1V2h.5Z" />
        </svg>
    ),
    chart: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="m7 15 4-4 3 3 5-7" />
        </svg>
    ),
    zap: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
        </svg>
    ),
    grid: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    rocket: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5" />
            <path d="M9 15 6 18l-2-2 3-3" />
            <path d="M15 9 9 15l-2-2 6-6c2.5-2.5 5.5-3.5 8-3-.5 2.5-1.5 5.5-4 8Z" />
            <path d="M14 6h4v4" />
        </svg>
    )
};

const products = [
    {
        title: "Aurora MT5 AI Trader",
        strategy: "Conservative Strategy",
        badge: "MT5 Strategy",
        theme: "blue",
        subtitle: "Built for long-term disciplined traders.",
        productId: "mt5",
        checkout: "/pricing?product=aurora-mt5",
        price: "USD 19.90",
        billing: "Monthly subscription available",
        features: [
            {
                icon: "shield",
                title: "Capital Protection",
                description: "Designed to prioritize disciplined risk control."
            },
            {
                icon: "brain",
                title: "Adaptive AI",
                description: "Adjusts decision logic to changing conditions."
            },
            {
                icon: "chart",
                title: "Stable Performance",
                description: "Built for consistent long-term execution."
            }
        ]
    },
    {
        title: "Aurora XAU Trader",
        strategy: "Aggressive Strategy",
        badge: "XAU Strategy",
        theme: "gold",
        subtitle: "Built for traders seeking maximum opportunity.",
        productId: "xau",
        checkout: "/pricing?product=aurora-xau",
        price: "USD 19.90",
        billing: "Monthly subscription available",
        features: [
            {
                icon: "zap",
                title: "High Growth",
                description: "Targets high-opportunity market conditions."
            },
            {
                icon: "grid",
                title: "Advanced Grid Engine",
                description: "Structured for active XAU execution logic."
            },
            {
                icon: "rocket",
                title: "Maximum Opportunity",
                description: "Built for traders who accept higher intensity."
            }
        ]
    }
];

function Products() {
    const [compareOpen, setCompareOpen] = useState(false);

    return (
        <section className="products" id="products" aria-label="Aurora HY trading products">
            <div className="product-grid">
                {products.map((product) => (
                    <article className={`product-card product-card-${product.theme}`} key={product.title}>
                        <div className="product-header">
                            <span className="product-badge">{product.badge}</span>
                        </div>

                        <h3>{product.title}</h3>

                        <div className="product-subtitle">
                            <strong>{product.strategy}</strong>
                            <p>{product.subtitle}</p>
                        </div>

                        <div className="product-price">
                            <span>Starting From</span>
                            <strong>{product.price}</strong>
                            <small>{product.billing}</small>
                        </div>

                        <div className="product-live-slot" aria-label={`${product.title} commercial access`}>
                            <span>Commercial access through Aurora checkout</span>
                        </div>

                        <div className="product-features">
                            {product.features.map((feature) => (
                                <div className="product-feature" key={feature.title}>
                                    <span className="product-feature-icon">{icons[feature.icon]}</span>
                                    <div>
                                        <strong>{feature.title}</strong>
                                        <p>{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="product-actions">
                            <a href={product.checkout} className="product-buy">Buy Now</a>
                            <button
                                type="button"
                                className="product-learn"
                                onClick={() => setCompareOpen((current) => !current)}
                                aria-expanded={compareOpen}
                            >
                                Compare
                            </button>
                        </div>

                        <div className="product-footer">
                            <span>License</span>
                            <span>Automatic Updates</span>
                            <span>Commercial Version</span>
                        </div>
                    </article>
                ))}
            </div>

            {compareOpen && (
                <div className="product-compare" aria-label="Aurora product comparison">
                    <div>
                        <span>Best For</span>
                        <strong>MT5: disciplined traders</strong>
                        <strong>XAU: opportunity seekers</strong>
                    </div>
                    <div>
                        <span>Risk Profile</span>
                        <strong>MT5: conservative</strong>
                        <strong>XAU: aggressive</strong>
                    </div>
                    <div>
                        <span>License</span>
                        <strong>Commercial use</strong>
                        <strong>Automatic updates</strong>
                    </div>
                </div>
            )}
        </section>
    );
}

export default Products;
