import { Link, useParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import productDetails from "../data/productDetails";

import "../styles/product.css";

function Product() {

    const { id } = useParams();

    const product = productDetails[id];

    if (!product) {

        return (
            <>
                <Navbar />

                <section className="product-page">

                    <h1>Product Not Found</h1>

                    <Link className="back-home" to="/">
                        ← Back to Aurora Hub
                    </Link>

                </section>

                <Footer />
            </>
        );

    }

    return (
        <>
            <Navbar />

            <section className="product-hero">

                <div className="hero-glow"></div>

                <div className="product-left">

                    <Link className="back-home" to="/">
                        ← Aurora Hub
                    </Link>

                    <div className="product-badge">
                        {product.status}
                    </div>

                    <h1>{product.title}</h1>

                    <h2>{product.subtitle}</h2>

                    <p>{product.description}</p>

                    <div className="product-actions">

                        <button>
                            Explore Features
                        </button>

                        <button className="secondary">
                            Battle Test
                        </button>

                    </div>

                </div>

                <div className="product-right">

                    <div className="overview-card">

                        <h3>Product Overview</h3>

                        <ul>

                            {product.overview.map((item) => (

                                <li key={item}>
                                    ✓ {item}
                                </li>

                            ))}

                        </ul>

                    </div>

                </div>

            </section>

            <section className="product-page">

                <section className="highlights">

                    <h3>Why Aurora?</h3>

                    <div className="highlight-grid">

                        {product.highlights.map((item) => (

                            <div
                                key={item.title}
                                className="highlight-card"
                            >

                                <h4>{item.title}</h4>

                                <p>{item.description}</p>

                            </div>

                        ))}

                    </div>

                </section>

                <section>

                    <h3>Core Features</h3>

                    <div className="feature-grid">

                        {product.features.map((feature) => (

                            <div
                                key={feature}
                                className="feature-card"
                            >

                                {feature}

                            </div>

                        ))}

                    </div>

                </section>

            </section>

            <Footer />

        </>
    );

}

export default Product;