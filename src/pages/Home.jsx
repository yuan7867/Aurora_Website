import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Products from "../components/Products";
import Journal from "../components/Journal";
import Roadmap from "../components/Roadmap";
import Vision from "../components/Vision";
import Footer from "../components/Footer";

function Home() {
    return (
        <>
            <Navbar />
            <Hero />
            <Products />
            <Journal />
            <Roadmap />
            <Vision />
            <Footer />
        </>
    );
}

export default Home;