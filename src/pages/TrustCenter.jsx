import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

const values = [
    {
        title: "Practical Innovation",
        body: "We pursue new ideas only when they create meaningful value."
    },
    {
        title: "Reliability",
        body: "Software must work consistently before it can earn trust."
    },
    {
        title: "Transparency",
        body: "Customers should understand what a product does, how it performs and what they are purchasing."
    },
    {
        title: "Human-Centered Intelligence",
        body: "AI should strengthen people, not remove clarity or responsibility."
    },
    {
        title: "Long-Term Thinking",
        body: "Aurora is built for sustainable products, lasting customer relationships and continuous improvement."
    },
    {
        title: "Disciplined Execution",
        body: "Good ideas only matter when they are delivered carefully, tested properly and maintained responsibly."
    }
];

function TrustCenter() {
    return (
        <>
            <Navbar />

            <main className="customer-page company-page">
                <section className="customer-hero">
                    <span className="customer-tag">Company</span>
                    <h1>Aurora is building intelligent software for a more capable world.</h1>
                    <p>
                        Aurora HY is the official home of Aurora Technologies, an independent software company building
                        practical AI products, automation platforms and cloud-connected systems for traders, businesses
                        and creative professionals.
                    </p>
                    <p>
                        Our purpose is simple: turn complex work into clearer decisions, stronger execution and better
                        everyday outcomes.
                    </p>
                </section>

                <section className="customer-grid two company-section-grid" aria-label="Aurora company profile">
                    <article className="customer-card company-story">
                        <span>The Meaning of Aurora</span>
                        <h2>A name inspired by light, intelligence and new beginnings.</h2>
                        <p>
                            Aurora means the first light that appears before a new day. It represents clarity emerging
                            from uncertainty, direction appearing where there was complexity, and the beginning of
                            something with greater potential.
                        </p>
                        <p>
                            That meaning reflects how Aurora builds software. Every Aurora product is created to bring
                            clearer insight, smarter automation and more confident execution into real working
                            environments.
                        </p>
                        <p>
                            Aurora is not only a company name. It is the idea that technology should illuminate the path
                            forward.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>The Meaning of HY</span>
                        <h2>Built from the founder's identity. Designed to grow beyond it.</h2>
                        <p>
                            HY represents Hong Yuen, the founder behind Aurora. It gives the company a personal
                            foundation and reminds Aurora that every product begins with responsibility, conviction and
                            real-world experience.
                        </p>
                        <p>
                            As Aurora grows, HY will continue to represent the human origin behind the technology: the
                            belief that intelligent software should remain practical, understandable and accountable to
                            the people who use it.
                        </p>
                        <p>
                            Aurora HY brings together two ideas: Aurora, the light of possibility, and HY, the human
                            vision that gives it direction.
                        </p>
                    </article>

                    <article className="customer-card company-story">
                        <span>Our Story</span>
                        <h2>Aurora began with real problems, not technology trends.</h2>
                        <p>
                            Aurora was founded from direct experience with repetitive work, fragmented tools, difficult
                            decisions and systems that were often more complicated than the problems they were meant to
                            solve.
                        </p>
                        <p>
                            The company began by building focused software for real working environments, starting with
                            intelligent trading platforms, then expanding into automation, business operations,
                            financial management, customer communication and creative production.
                        </p>
                        <p>
                            Aurora does not build software simply to follow AI trends. We build because real people need
                            tools that save time, reduce friction, improve decision-making and create measurable value.
                            Every Aurora product begins with one question: can this genuinely make the user's work
                            better?
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Mission</span>
                        <h2>Make intelligent software useful in the real world.</h2>
                        <p>
                            Aurora builds practical AI software that helps people make better decisions, automate
                            repetitive work, manage risk, improve execution and operate with greater confidence.
                        </p>
                        <p>
                            Our mission is not to replace human judgment. It is to strengthen it.
                        </p>
                        <p>
                            We believe the best technology works alongside people, simplifying complexity, revealing
                            useful information and helping users act with greater clarity.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Vision</span>
                        <h2>One connected intelligence ecosystem.</h2>
                        <p>
                            Aurora is building a connected ecosystem of intelligent products serving traders, businesses,
                            professionals and future enterprise platforms.
                        </p>
                        <p>
                            Over time, Aurora products will work together through Aurora Cloud, sharing trusted
                            infrastructure, secure data, intelligent services and a unified customer experience.
                        </p>
                        <p>
                            The long-term vision is larger than a collection of separate applications. Aurora is
                            creating a practical intelligence platform where every product contributes to one connected
                            system designed for real-world progress.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>What Aurora Is Building</span>
                        <h2>Focused products. Shared intelligence. One long-term direction.</h2>
                        <p>
                            Aurora's ecosystem includes intelligent trading platforms, business automation, financial
                            tools, customer communication systems, creative workflow software and cloud infrastructure.
                        </p>
                        <p>
                            Each product is purpose-built for a specific problem. Together, they form one growing Aurora
                            ecosystem.
                        </p>
                        <p>
                            Live products include Aurora MT5 AI Trader and Aurora XAU Trader. Aurora Luno is currently
                            under development. Future Aurora directions may include Aurora Moomoo AI Trader, Aurora
                            Event Trader, Aurora Wedding AI, Aurora Ledger AI, Aurora Omni AI and Aurora Cloud.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>Core Values</span>
                        <h2>How Aurora builds.</h2>
                        <div className="company-values">
                            {values.map((value) => (
                                <div key={value.title}>
                                    <strong>{value.title}</strong>
                                    <p>{value.body}</p>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className="customer-card">
                        <span>Why Trust Aurora</span>
                        <h2>Built openly. Tested seriously. Improved continuously.</h2>
                        <p>
                            Aurora earns trust through visible development, real product testing, transparent commercial
                            terms and cloud-connected performance data.
                        </p>
                        <p>
                            Where live data is shown, it comes from Aurora Cloud. Where products are still under
                            development, they are clearly identified.
                        </p>
                        <p>
                            Aurora does not rely on exaggerated claims, simulated results or hidden product status. We
                            believe long-term trust is built by showing the work, respecting the customer and improving
                            every product with discipline.
                        </p>
                    </article>

                    <article className="customer-card">
                        <span>The Future of Aurora</span>
                        <h2>From independent products to a connected global software company.</h2>
                        <p>
                            Aurora's future is to become a trusted international software company known for practical
                            intelligence, disciplined engineering and products that solve meaningful problems.
                        </p>
                        <p>
                            The company will continue expanding across trading technology, business automation, customer
                            operations, finance, creative production and cloud services.
                        </p>
                        <p>
                            The goal is not to build the most products. The goal is to build the right products and
                            connect them into one intelligent ecosystem that becomes more valuable as it grows.
                        </p>
                        <p>
                            Aurora is still at the beginning. But the direction is clear: build useful intelligence,
                            earn lasting trust and create software that works.
                        </p>
                    </article>
                </section>

                <section className="customer-note company-contact" aria-label="Aurora contact information">
                    <span className="customer-tag">Contact</span>
                    <h2>Connect with Aurora.</h2>
                    <p>
                        For product enquiries, commercial partnerships, customer assistance or scheduled demonstrations,
                        contact Aurora through the official channels below.
                    </p>
                    <div className="company-contact-grid">
                        <div>
                            <span>Business Email</span>
                            <strong>support@aurorahy.com</strong>
                            <p>For product, licensing and general enquiries.</p>
                        </div>
                        <div>
                            <span>WhatsApp</span>
                            <strong>Official channel to be announced</strong>
                            <p>For direct business and customer communication.</p>
                        </div>
                        <div>
                            <span>Business Hours</span>
                            <strong>Monday to Friday, 9:00 AM - 6:00 PM</strong>
                            <p>Malaysia Time (MYT)</p>
                        </div>
                        <div>
                            <span>Google Meet</span>
                            <strong>Available by Appointment</strong>
                            <p>Product demonstrations and business discussions.</p>
                        </div>
                        <div>
                            <span>Company Location</span>
                            <strong>Selangor, Malaysia</strong>
                            <p>
                                Aurora serves customers digitally while building toward future international operations.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="customer-note" aria-label="Aurora brand statement">
                    <h2>Aurora HY</h2>
                    <p>Building intelligent software for the real world.</p>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default TrustCenter;
