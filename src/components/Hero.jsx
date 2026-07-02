import "../styles/hero.css";
import Button from "./Button";

function Hero() {
    return (
        <section className="hero">

            <div className="hero-container">

                <div className="hero-badge">
                    Official AI Software Company
                </div>

                <h1>
                    Aurora
                </h1>

                <h2>
                    Build Intelligent Software
                    <br />
                    for Traders, Businesses,
                    <br />
                    and Creative Professionals.
                </h2>

                <p className="hero-description">
                    Aurora develops intelligent AI software designed to empower
                    financial traders, businesses, and creative professionals
                    through automation, data, and practical innovation.
                </p>

                <div className="hero-actions">

                    <Button
                        href="#products"
                        variant="primary"
                    >
                        Explore Aurora Suite →
                    </Button>

                    <Button
                        href="#development"
                        variant="secondary"
                    >
                        Development Center
                    </Button>

                </div>

            </div>

        </section>
    );
}

export default Hero;