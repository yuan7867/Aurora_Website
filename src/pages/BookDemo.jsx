import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

function BookDemo() {
    return (
        <>
            <Navbar />

            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Book a Demo</span>
                    <h1>See Aurora MT5 AI live before you commit.</h1>
                    <p>
                        The demo flow is reserved for future Google Calendar and Google Meet integration. For now, this
                        page makes the customer intent clear without submitting or transmitting form data.
                    </p>
                </section>

                <section className="customer-grid two">
                    <article className="customer-card">
                        <h2>Demo Request</h2>
                        <form className="customer-form">
                            <label>
                                Name
                                <input type="text" placeholder="Your name" />
                            </label>
                            <label>
                                Email
                                <input type="email" placeholder="you@example.com" />
                            </label>
                            <label>
                                Product
                                <select defaultValue="Aurora MT5 AI">
                                    <option>Aurora MT5 AI</option>
                                </select>
                            </label>
                            <label>
                                Notes
                                <textarea placeholder="What would you like to review?" />
                            </label>
                            <button className="customer-button" type="button">
                                Prepare Demo Request
                            </button>
                        </form>
                    </article>

                    <article className="customer-card">
                        <h2>What the demo covers</h2>
                        <ul>
                            <li>Live MT5 status, broker, server and session proof</li>
                            <li>Battle Test visibility and AI running state</li>
                            <li>Cloud status, release readiness and customer area path</li>
                            <li>Plan selection and future checkout readiness</li>
                        </ul>
                        <a className="customer-button secondary" href="/trust">Check Trust Center</a>
                    </article>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default BookDemo;
