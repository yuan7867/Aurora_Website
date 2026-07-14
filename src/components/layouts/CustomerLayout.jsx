import { Link, useLocation, useNavigate } from "react-router-dom";

import Footer from "../Footer";
import Navbar from "../Navbar";

import "../../styles/account.css";

const accountLinks = [
    { label: "Dashboard", href: "/account" },
    { label: "My Products", href: "/account/products" },
    { label: "Downloads", href: "/account/downloads" },
    { label: "My Licenses", href: "/account/licenses" },
    { label: "Updates", href: "/account/updates" },
    { label: "Support", href: "/account/support" }
];

function CustomerLayout({ title, eyebrow, children }) {
    const location = useLocation();
    const navigate = useNavigate();

    function logout() {
        globalThis.localStorage?.removeItem("auroraJwt");
        navigate("/login", { replace: true });
    }

    return (
        <>
            <Navbar />

            <main className="account-shell">
                <aside className="account-sidebar" aria-label="Customer area navigation">
                    <div>
                        <span className="account-sidebar-label">Customer Area</span>
                        <strong>Aurora Account</strong>
                    </div>

                    <nav>
                        {accountLinks.map((link) => (
                            <Link
                                className={location.pathname === link.href ? "is-active" : ""}
                                key={link.href}
                                to={link.href}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <section className="account-content">
                    <header className="account-topbar">
                        <div>
                            <span>{eyebrow}</span>
                            <h1>{title}</h1>
                        </div>

                        <button className="account-logout" type="button" onClick={logout}>
                            Logout
                        </button>
                    </header>

                    {children}
                </section>
            </main>

            <Footer />
        </>
    );
}

export default CustomerLayout;
