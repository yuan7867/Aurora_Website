function ProductFAQ({ items = [] }) {
    if (!items.length) {
        return null;
    }

    return (
        <section className="product-section">
            <h3>FAQ</h3>

            <div className="faq-list">
                {items.map((item) => (
                    <details className="faq-item" key={item.question}>
                        <summary>{item.question}</summary>
                        <p>{item.answer}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}

export default ProductFAQ;
