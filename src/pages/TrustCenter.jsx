import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

const values = [
    "Innovation",
    "Reliability",
    "Practical AI",
    "Transparency",
    "Long-Term Thinking"
];

function TrustCenter() {
    return (
        <>
            <Navbar />

            <main className="customer-page company-page">
                <section className="customer-hero">
                    <span className="customer-tag">Company</span>
                    <h1>Aurora Technologies builds practical AI software for the real world.</h1>
                    <p>
                        Aurora HY is the official website of Aurora Technologies, an AI software company focused on
                        intelligent products, automation and cloud-connected platforms.
                    </p>
                </section>

                <section className="customer-grid two company-section-grid" aria-label="Aurora company profile">
                    <article className="customer-card company-story">
                        <span>Our Story</span>
                        <h2>Why Aurora was founded.</h2>
                        <p>
                            Aurora was founded to build software that is useful in real working environments, not only
                            impressive in presentations. Practical AI matters because people need tools that improve
                            decisions, reduce repetitive work and keep complex operations understandable.
                        </p>
                        <p>
                            Aurora builds software instead of hype. Every product is designed around reliability,
                            commercial readiness and long-term value.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Mission</span>
                        <h2>Better decisions, less repetitive work.</h2>
                        <p>
                            Aurora builds intelligent software that helps people make better decisions, save time,
                            reduce repetitive work and solve real-world problems.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Vision</span>
                        <h2>One connected AI ecosystem.</h2>
                        <p>
                            Aurora is building one connected AI ecosystem serving traders, businesses, creative
                            professionals and future enterprise platforms.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Core Values</span>
                        <h2>How Aurora builds.</h2>
                        <div className="company-values">
                            {values.map((value) => (
                                <strong key={value}>{value}</strong>
                            ))}
                        </div>
                    </article>
                </section>

                <section className="customer-note company-contact" aria-label="Aurora contact information">
                    <span className="customer-tag">Contact</span>
                    <h2>Professional contact channels.</h2>
                    <div className="company-contact-grid">
                        <div>
                            <span>Business Email</span>
                            <strong>support@aurorahy.com</strong>
                        </div>
                        <div>
                            <span>WhatsApp</span>
                            <strong>Available by request</strong>
                        </div>
                        <div>
                            <span>Business Hours</span>
                            <strong>Monday to Friday, 9:00 AM - 6:00 PM</strong>
                        </div>
                        <div>
                            <span>Google Meet</span>
                            <strong>By appointment</strong>
                        </div>
                        <div>
                            <span>Future Office</span>
                            <strong>Aurora Technologies office location to be announced</strong>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default TrustCenter;
