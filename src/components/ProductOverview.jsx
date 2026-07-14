function ProductOverview({ items = [] }) {
    if (!items.length) {
        return null;
    }

    return (
        <div className="overview-card">
            <h3>Product Overview</h3>

            <ul>
                {items.map((item) => (
                    <li key={item}>
                        <span aria-hidden="true">+</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ProductOverview;
