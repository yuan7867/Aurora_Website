import "../styles/v4.css";

const faqs = [
    ["Which product should I choose?", "Choose MT5 for conservative discipline and XAU for aggressive opportunity."],
    ["What pricing options are available?", "Monthly and Yearly options are available publicly. Yearly saves 17%."],
    ["Do I receive a license after purchase?", "The frontend flow routes customers from PayPal success to license delivery."],
    ["Is live trading data real on this page?", "Live values are reserved for Aurora Cloud API and do not display fake numbers."],
    ["Can I compare MT5 and XAU?", "Yes. The comparison table explains strategy, risk profile and ideal customer fit."],
    ["What does Verified Performance mean?", "It means the website separates commercial readiness and live-data reservation from fake claims."],
    ["Is support included?", "Professional support and customer portal access are part of the commercial experience."],
    ["Is trading risk-free?", "No. Trading includes financial risk and performance is never guaranteed."]
];

function FAQ() {
    return (
        <section className="faq-section" id="faq">
            <div className="v4-section-heading">
                <p>FAQ</p>
                <h2>Questions buyers ask before checkout.</h2>
            </div>

            <div className="faq-grid">
                {faqs.map(([question, answer]) => (
                    <article key={question}>
                        <strong>{question}</strong>
                        <p>{answer}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default FAQ;
