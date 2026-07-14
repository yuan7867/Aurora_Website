import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { verifyEmail } from "../services/commerceApi.js";

import "../styles/customer.css";

function VerifyEmail() {
    const token = new URLSearchParams(globalThis.location.search).get("token");
    const [message, setMessage] = useState("Verifying email...");

    useEffect(() => {
        if (!token) {
            setMessage("Verification token is missing.");
            return;
        }

        verifyEmail(token)
            .then((result) => {
                globalThis.localStorage?.setItem("auroraJwt", result.token);
                setMessage("Email verified. Your session is active.");
            })
            .catch((error) => setMessage(error.message));
    }, [token]);

    return (
        <>
            <Navbar />
            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Email Verification</span>
                    <h1>{message}</h1>
                    <div className="customer-actions">
                        <Link className="customer-button" to="/account">Open Dashboard</Link>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}

export default VerifyEmail;
