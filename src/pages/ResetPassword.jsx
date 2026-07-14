import { useState } from "react";
import { Link } from "react-router-dom";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { resetPassword } from "../services/commerceApi.js";

import "../styles/customer.css";

function ResetPassword() {
    const token = new URLSearchParams(globalThis.location.search).get("token");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    async function submit(event) {
        event.preventDefault();
        try {
            const result = await resetPassword({ token, password });
            globalThis.localStorage?.setItem("auroraJwt", result.token);
            setMessage("Password set. Your session is active.");
        } catch (error) {
            setMessage(error.message);
        }
    }

    return (
        <>
            <Navbar />
            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Reset Password</span>
                    <h1>Set your Aurora password.</h1>
                </section>
                <form className="customer-card customer-form" onSubmit={submit}>
                    <label>New Password<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                    <button className="customer-button" type="submit">Set Password</button>
                    {message && <p className="product-state">{message}</p>}
                    <Link to="/account">Open Dashboard</Link>
                </form>
            </main>
            <Footer />
        </>
    );
}

export default ResetPassword;
