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
                    <h1>Choose your Aurora trading system.</h1>
                    <p>
                        Select one commercial trading product. MT5 and XAU are available separately, while future
                        products will appear here only when they are ready.
                    </p>
                </section>

                <Products />
            </main>

            <Footer />
        </>
    );
}

export default ProductsPage;
