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
        "Choose Subscription",
        "Pick Monthly or Yearly access.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M3 10h18" />
        </svg>
    ],
    [
        "Checkout",
        "Confirm customer and order details.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 2 3 6v16h18V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
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
        "Receipt",
        "Receive purchase confirmation.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2Z" />
            <path d="M8 7h8" />
            <path d="M8 12h8" />
            <path d="M8 17h5" />
        </svg>
    ],
    [
        "License",
        "License is delivered to your account.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="8" cy="15" r="4" />
            <path d="m11 12 8-8" />
            <path d="m16 7 2 2 3-3-2-2" />
        </svg>
    ],
    [
        "Download",
        "Open the download center.",
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
        </svg>
    ],
    [
        "Customer Dashboard",
        "Manage products, receipts and support.",
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
                <h2>From product choice to customer dashboard.</h2>
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
