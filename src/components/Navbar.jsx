import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import "../styles/navbar.css";

function Navbar() {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const isHome = location.pathname === "/";
    const isProductPage = location.pathname.startsWith("/product");
    const isPricing = location.pathname === "/pricing";
    const isTrust = location.pathname === "/trust";
    const isAccount = location.pathname.startsWith("/account");

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(globalThis.scrollY > 18);
        };

        handleScroll();
        globalThis.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            globalThis.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const publicLinks = [
        { label: "Home", href: isHome ? "#top" : "/", active: isHome },
        { label: "Products", href: isHome ? "#products" : "/#products", active: isProductPage },
        { label: "Live Trading", href: isHome ? "#performance" : "/#performance", active: false },
        { label: "Pricing", href: "/pricing", active: isPricing },
        { label: "Download", href: "/download", active: location.pathname === "/download" },
        { label: "Support", href: "/account/support", active: false },
        { label: "Trust", href: isHome ? "#trust" : "/trust", active: isTrust }
    ];
    const accountLinks = [
        { label: "Dashboard", href: "/account", active: location.pathname === "/account" },
        { label: "My Products", href: "/account/products", active: location.pathname === "/account/products" },
        { label: "Support", href: "/account/support", active: location.pathname === "/account/support" },
        { label: "Logout", href: "/", active: false }
    ];
    const links = isAccount ? accountLinks : publicLinks;

    return (
        <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`} aria-label="Primary navigation">

            <a href={isHome ? "#top" : "/"} className="navbar-brand" aria-label="Aurora HY home">
                <img className="navbar-symbol" src="/brand/aurora-symbol.svg" alt="Aurora Symbol" />
                <span className="navbar-wordmark">
                    <strong>Aurora HY</strong>
                    <small>Professional AI Trading Systems</small>
                </span>

            </a>

            <ul className="navbar-menu">
                {links.map((link) => (
                    <li key={link.label}>
                        <a className={link.active ? "is-active" : ""} href={link.href}>{link.label}</a>
                    </li>
                ))}

            </ul>

            <div className="navbar-actions">
                <a className="navbar-login" href="/login">Login</a>
                <a className="navbar-buy" href="/pricing">Buy Now</a>
            </div>

        </nav>
    )
}

export default Navbar
