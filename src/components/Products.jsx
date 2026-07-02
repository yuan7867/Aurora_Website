import { Link } from "react-router-dom";

import "../styles/products.css";
import products from "../data/products";

function Products() {

    const getStatusClass = (status) => {

        switch (status) {

            case "Battle Test":
                return "status-battle";

            case "Development":
                return "status-development";

            case "Architecture":
                return "status-architecture";

            default:
                return "status-default";

        }

    };

    return (

        <section
            className="products"
            id="products"
        >

            <p className="section-tag">
                Aurora Suite
            </p>

            <h2>
                Six AI systems. One Aurora vision.
            </h2>

            <div className="product-grid">

                {products.map((product) => (

                    <Link

                        key={product.id}

                        to={`/product/${product.id}`}

                        className="product-card"

                    >

                        <div className="product-header">

                            <span className="product-category">

                                {product.category}

                            </span>

                            <span
                                className={`product-status ${getStatusClass(product.status)}`}
                            >

                                ● {product.status}

                            </span>

                        </div>

                        <h3>

                            {product.name}

                        </h3>

                        <p>

                            {product.description}

                        </p>

                        <div className="product-footer">

                            <span className="product-version">

                                {product.version}

                            </span>

                            <span className="product-button">

                                {product.button} →

                            </span>

                        </div>

                    </Link>

                ))}

            </div>

        </section>

    );

}

export default Products;