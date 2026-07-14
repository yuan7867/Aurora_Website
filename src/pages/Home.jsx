import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Products from "../components/Products";
import LivePerformance from "../components/LivePerformance";
import CompareTradingSystems from "../components/CompareTradingSystems";
import CustomerJourney from "../components/CustomerJourney";
import WhyAurora from "../components/WhyAurora";
import VerifiedPerformance from "../components/VerifiedPerformance";
import HomePricing from "../components/HomePricing";
import FAQ from "../components/FAQ";
import RiskDisclaimer from "../components/RiskDisclaimer";
import Footer from "../components/Footer";

function Home() {
    return (
        <>
            <Navbar />
            <main id="top" className="homepage-v3">
                <Hero />
                <Products />
                <LivePerformance />
                <CompareTradingSystems />
                <CustomerJourney />
                <WhyAurora />
                <VerifiedPerformance />
                <HomePricing />
                <FAQ />
                <RiskDisclaimer />
            </main>
            <Footer />
        </>
    );
}

export default Home;
