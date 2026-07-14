import { Link } from "react-router-dom";

import Footer from "../Footer";
import Navbar from "../Navbar";
import ProductOverview from "../ProductOverview";

function ProductLayout({ product, children }) {
    return (
        <>
            <Navbar />

            <main className="product-shell">
                <section className="product-hero" aria-labelledby="product-title">
                    <div className="hero-glow"></div>

                    <div className="product-left">
                        <Link
                            aria-label="Back to Aurora Hub home page"
                            className="back-home"
                            to="/"
                        >
                            &lt;- Aurora Hub
                        </Link>

                        <div className="product-badge">
                            {product.status}
                        </div>

                        <h1 id="product-title">{product.title}</h1>
                        <h2>{product.subtitle}</h2>
                        <p>{product.description}</p>

                        {product.actions?.length > 0 && (
                            <nav className="product-actions" aria-label={`${product.title} navigation`}>
                                {product.actions.map((action) => (
                                    <a
                                        key={action.label}
                                        aria-label={`${action.label} for ${product.title}`}
                                        className={action.variant === "secondary" ? "secondary" : ""}
                                        href={action.href}
                                    >
                                        {action.label}
                                    </a>
                                ))}
                            </nav>
                        )}
                    </div>

                    <div className="product-right">
                        <ProductOverview items={product.overview} />
                    </div>
                </section>

                <section className="product-page">
                    {children}
                </section>
            </main>

            <Footer />
        </>
    );
}

export default ProductLayout;
