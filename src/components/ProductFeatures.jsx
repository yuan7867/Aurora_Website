function ProductFeatures({ items = [] }) {
    if (!items.length) {
        return null;
    }

    return (
        <section className="product-section" id="features">
            <h3>Core Features</h3>

            <div className="feature-grid">
                {items.map((feature) => (
                    <div
                        key={feature}
                        className="feature-card"
                    >
                        {feature}
                    </div>
                ))}
            </div>
        </section>
    );
}

export default ProductFeatures;
