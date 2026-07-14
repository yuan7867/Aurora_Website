function ProductBattleTest({ battle }) {
    if (!battle) {
        return null;
    }

    const items = [
        ["Status", battle.status],
        ["Version", battle.version],
        ["Runtime", battle.runtime],
        ["AI Engine", battle.aiEngine]
    ].filter((item) => item[1]);

    return (
        <section className="product-section" id="battle">
            <h3>Battle Test</h3>

            <div className="battle-grid">
                {items.map(([label, value]) => (
                    <div className="battle-card" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default ProductBattleTest;
