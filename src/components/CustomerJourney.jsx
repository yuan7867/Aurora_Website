import "../styles/v4.css";

const steps = [
    [
        "Choose Product",
        "Select conservative MT5 or aggressive XAU.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16" />
            <path d="M4 12h16" />
            <path d="M4 19h16" />
            <path d="m8 9 3 3-3 3" />
        </svg>
    ],
    [
        "PayPal",
        "Complete secure checkout.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M3 10h18" />
            <path d="M7 15h4" />
        </svg>
    ],
    [
        "Receive License",
        "Get license and download access.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="8" cy="15" r="4" />
            <path d="m11 12 8-8" />
            <path d="m16 7 2 2 3-3-2-2" />
        </svg>
    ],
    [
        "Start Trading",
        "Install, activate, and begin.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19V5" />
            <path d="M4 19h16" />
            <path d="m7 15 4-4 3 3 5-7" />
        </svg>
    ]
];

function CustomerJourney() {
    return (
        <section className="customer-journey">
            <div className="v4-section-heading">
                <p>Customer Journey</p>
                <h2>From decision to trading in four steps.</h2>
            </div>

            <div className="journey-grid">
                {steps.map(([title, text, icon]) => (
                    <article key={title}>
                        <span>{icon}</span>
                        <strong>{title}</strong>
                        <p>{text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default CustomerJourney;
