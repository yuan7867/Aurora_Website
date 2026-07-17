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
                    <h1>Aurora live trading center.</h1>
                    <p>
                        Aurora MT5 and Aurora XAU are shown side by side from Aurora Cloud. If one system is offline,
                        the page shows a connecting state instead of fake trading data.
                    </p>
                </section>

                <LivePerformance />
            </main>

            <Footer />
        </>
    );
}

export default LiveTradingPage;
