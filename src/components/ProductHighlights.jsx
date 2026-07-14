function ProductHighlights({ items = [] }) {
    if (!items.length) {
        return null;
    }

    return (
        <section className="product-section highlights">
            <h3>Why Aurora?</h3>

            <div className="highlight-grid">
                {items.map((item) => (
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
    );
}

export default ProductHighlights;
