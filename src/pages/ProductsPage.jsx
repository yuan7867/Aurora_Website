import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Products from "../components/Products";

import "../styles/customer.css";

function ProductsPage() {
    return (
        <>
            <Navbar />

            <main className="customer-page products-page">
                <section className="customer-hero">
                    <span className="customer-tag">Products</span>
                    <h1>Discover the Aurora Ecosystem.</h1>
                    <p>
                        Explore Aurora's growing ecosystem of intelligent software built for traders, businesses and
                        creative professionals.
                    </p>
                    <p>
                        Each Aurora product is purpose-built to solve real-world problems while sharing the same Aurora
                        intelligence platform.
                    </p>
                </section>

                <Products />
            </main>

            <Footer />
        </>
    );
}

export default ProductsPage;
