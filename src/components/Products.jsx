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
    ),
    orbit: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M3 12c3-6 15-6 18 0" />
            <path d="M3 12c3 6 15 6 18 0" />
        </svg>
    )
};

const products = [
    {
        title: "Aurora MT5 AI Trader",
        strategy: "Professional AI Gold Trading Platform",
        badge: "LIVE NOW",
        theme: "blue",
        subtitle: "Precision automation for professionals who value risk control, reliability and disciplined execution.",
        productId: "mt5",
        checkout: "/pricing?product=aurora-mt5",
        price: "USD 19.90",
        billing: "Monthly subscription available",
        features: [
            {
                icon: "shield",
                title: "Risk Control",
                description: "Built to support measured decisions and controlled exposure."
            },
            {
                icon: "brain",
                title: "AI Automation",
                description: "Applies intelligent automation to reduce manual workload."
            },
            {
                icon: "chart",
                title: "Reliable Execution",
                description: "Designed for consistent commercial operation over time."
            }
        ]
    },
    {
        title: "Aurora XAU Trader",
        strategy: "Advanced AI Gold Momentum Platform",
        badge: "LIVE NOW",
        theme: "gold",
        subtitle: "High-speed automation for professionals focused on momentum, opportunity and execution quality.",
        productId: "xau",
        checkout: "/pricing?product=aurora-xau",
        price: "USD 19.90",
        billing: "Monthly subscription available",
        features: [
            {
                icon: "zap",
                title: "Momentum Focus",
                description: "Designed for active markets where speed and timing matter."
            },
            {
                icon: "grid",
                title: "Execution Engine",
                description: "Supports structured automation for fast-moving conditions."
            },
            {
                icon: "rocket",
                title: "Opportunity Capture",
                description: "Built for professionals seeking responsive market participation."
            }
        ]
    },
    {
        title: "Aurora Luno",
        strategy: "Currently Under Development",
        badge: "COMING NEXT",
        theme: "purple",
        subtitle: "AI-powered cryptocurrency intelligence platform designed for the next generation of digital asset trading.",
        price: "In Development",
        billing: "Not available for purchase",
        comingSoon: true,
        features: [
            {
                icon: "orbit",
                title: "Digital Asset Intelligence",
                description: "Designed for traders who need clearer cryptocurrency market context."
            },
            {
                icon: "shield",
                title: "Commercial Foundation",
                description: "Planned under the same Aurora platform standards."
            },
            {
                icon: "brain",
                title: "AI Research Layer",
                description: "Prepared for future Aurora intelligence and cloud integration."
            }
        ]
    }
];

function Products() {
    return (
        <section className="products" id="products" aria-label="Aurora HY products">
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
                            <span>{product.comingSoon ? "In development. Commercial access is not open yet." : "Commercial access through Aurora checkout"}</span>
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
                            {product.comingSoon ? (
                                <span className="product-buy product-disabled" aria-disabled="true">In Development</span>
                            ) : (
                                <a href={product.checkout} className="product-buy">View Access</a>
                            )}
                        </div>

                        <div className="product-footer">
                            <span>License</span>
                            <span>Automatic Updates</span>
                            <span>Commercial Version</span>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default Products;
