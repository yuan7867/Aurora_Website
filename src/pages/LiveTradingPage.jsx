import Footer from "../components/Footer";
import LivePerformance from "../components/LivePerformance";
import Navbar from "../components/Navbar";

import "../styles/customer.css";

function LiveTradingPage() {
    return (
        <>
            <Navbar />

            <main className="customer-page live-trading-page">
                <section className="customer-hero">
                    <span className="customer-tag">Live Trading</span>
                    <h1>Real Performance. Verified Live.</h1>
                    <p>
                        Monitor every Aurora trading platform through real-time cloud synchronization.
                    </p>
                    <p>
                        Performance, account status, open positions and trading activity are displayed directly from
                        Aurora Cloud, providing complete transparency without simulated performance or manually updated
                        results.
                    </p>
                    <p>
                        All performance information displayed on this page is synchronized directly from Aurora Cloud in
                        real time.
                    </p>
                </section>

                <LivePerformance />
            </main>

            <Footer />
        </>
    );
}

export default LiveTradingPage;
