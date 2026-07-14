import "../styles/products.css";

const trustItems = [
    { title: "Battle Tested", text: "Real market conditions" },
    { title: "Production Ready", text: "24/7 Stable & Reliable" },
    { title: "Commercial License", text: "Commercial Access" },
    { title: "Automatic Updates", text: "Always Stay Ahead" },
    { title: "Dedicated Support", text: "Real People, Real Help" }
];

function Trust() {
    return (
        <section className="trust" id="trust">
            <div className="trust-grid">
                {trustItems.map((item) => (
                    <article className="trust-card" key={item.title}>
                        <span />
                        <div>
                            <strong>{item.title}</strong>
                            <small>{item.text}</small>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default Trust;
