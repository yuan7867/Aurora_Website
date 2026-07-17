import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AuroraLogo from "../components/AuroraLogo";
import AuroraFilm from "../components/AuroraFilm";
import "../styles/aurora-home.css";

const navigation = [
  ["Home", "/"],
  ["Products", "/products"],
  ["Live Trading", "/performance"],
  ["Pricing", "/pricing"],
  ["Download", "/download"],
  ["Support", "/account/support"],
  ["Trust", "/trust"],
];

const trustItems = [
  ["Commercial Grade", "Systems built for disciplined deployment"],
  ["Live Transparency", "Performance presented without invented claims"],
  ["License Protected", "Secure subscription and account validation"],
  ["Risk First", "Control before opportunity, always"],
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
        <p className="aurora-hero__eyebrow">CLARITY BEYOND THE HORIZON</p>

        <h1 id="aurora-title" className="aurora-hero__title">
          <span>AURORA</span> <span>HY</span>
        </h1>

        <p className="aurora-hero__statement">
          Intelligence in motion. <strong>Discipline by design.</strong>
        </p>

        <p className="aurora-hero__description">
          Professional MT5 and XAU automation engineered for transparent execution,
          controlled risk, and secure commercial deployment.
        </p>

        <div className="aurora-hero__actions">
          <Link className="aurora-button aurora-button--primary" to="/products">Explore Aurora</Link>
          <Link className="aurora-button aurora-button--outline" to="/performance">
            <span className="aurora-button__play" aria-hidden="true">&#9654;</span>
            Watch Live Trading
          </Link>
        </div>
      </section>

      <section className="aurora-trust" aria-label="Aurora HY principles">
        {trustItems.map(([title, description], index) => (
          <article className="aurora-trust__item" key={title} style={{ "--delay": `${index * 90}ms` }}>
            <span className="aurora-trust__number">0{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
