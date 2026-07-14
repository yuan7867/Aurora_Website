function ProductArchitecture({ items = [] }) {
    if (!items.length) {
        return null;
    }

    return (
        <section className="product-section">
            <h3>Architecture</h3>

            <div className="architecture-flow">
                {items.map((item, index) => (
                    <div
                        key={item}
                        className="architecture-node"
                    >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{item}</strong>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default ProductArchitecture;
