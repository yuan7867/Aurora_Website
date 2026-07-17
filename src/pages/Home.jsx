import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

function Home() {
    return (
        <>
            <Navbar />
            <main id="top" className="homepage-v3">
                <Hero />
            </main>
        </>
    );
}

export default Home;
