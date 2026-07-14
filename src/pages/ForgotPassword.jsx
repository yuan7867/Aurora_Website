import { useState } from "react";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { forgotPassword } from "../services/commerceApi.js";

import "../styles/customer.css";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    async function submit(event) {
        event.preventDefault();
        await forgotPassword(email);
        setMessage("If the account exists, reset instructions have been sent.");
    }

    return (
        <>
            <Navbar />
            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Forgot Password</span>
                    <h1>Reset access to your Aurora account.</h1>
                </section>
                <form className="customer-card customer-form" onSubmit={submit}>
                    <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                    <button className="customer-button" type="submit">Send Reset Email</button>
                    {message && <p className="product-state">{message}</p>}
                </form>
            </main>
            <Footer />
        </>
    );
}

export default ForgotPassword;
