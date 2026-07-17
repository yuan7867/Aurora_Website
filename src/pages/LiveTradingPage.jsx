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
                    <h1>Aurora MT5 live trading status.</h1>
                    <p>
                        Live values are requested from Aurora Cloud. If Aurora Cloud is offline, this page shows a
                        connecting state instead of fake trading data.
                    </p>
                </section>

                <LivePerformance />
            </main>

            <Footer />
        </>
    );
}

export default LiveTradingPage;
