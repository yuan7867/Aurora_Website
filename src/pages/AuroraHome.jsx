import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AuroraLogo from "../components/AuroraLogo";
import AuroraFilm from "../components/AuroraFilm";
import Footer from "../components/Footer";
import Journal from "../components/Journal";
import Products from "../components/Products";
import Roadmap from "../components/Roadmap";
import Vision from "../components/Vision";
import "../styles/aurora-home.css";

const navigation = [
  ["Home", "/"],
  ["Product", "/products"],
  ["Pricing", "/pricing"],
  ["Live Trading", "/performance"],
  ["Company", "/trust"],
];

export default function AuroraHome() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <main className="aurora-home">
      <AuroraFilm />

      <header className="aurora-nav">
        <Link to="/" className="aurora-nav__brand" aria-label="Aurora HY home">
          <AuroraLogo />
        </Link>

        <button
          type="button"
          className="aurora-nav__menu"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav className={`aurora-nav__links ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
          {navigation.map(([label, href], index) => (
            <Link key={href} to={href} className={index === 0 ? "is-active" : ""}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="aurora-nav__actions">
          <Link className="aurora-button aurora-button--quiet" to="/login">Login</Link>
          <Link className="aurora-button aurora-button--primary aurora-button--small" to="/pricing">Buy Now</Link>
        </div>
      </header>

      <section className="aurora-hero" aria-labelledby="aurora-title">
        <p className="aurora-hero__eyebrow">AI SOFTWARE ECOSYSTEM</p>

        <h1 id="aurora-title" className="aurora-hero__title">
          <span>AURORA</span> <span>HY</span>
        </h1>

        <p className="aurora-hero__statement">
          Building Intelligent Software <strong>For The Real World.</strong>
        </p>

        <p className="aurora-hero__description">
          Aurora develops intelligent software that empowers traders, businesses
          and creative professionals through practical artificial intelligence,
          automation and cloud technologies.
        </p>

        <div className="aurora-hero__actions">
          <Link className="aurora-button aurora-button--primary" to="/products">Explore Aurora</Link>
          <Link className="aurora-button aurora-button--outline" to="/performance">
            <span className="aurora-button__play" aria-hidden="true">&#9654;</span>
            Watch Live Trading
          </Link>
        </div>
      </section>

      <div className="aurora-home__sections">
        <Products />
        <Journal />
        <Roadmap />
        <Vision />
      </div>

      <Footer />
    </main>
  );
}
