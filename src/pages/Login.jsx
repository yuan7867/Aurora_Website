import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { loginCustomer } from "../services/commerceApi.js";

import "../styles/customer.css";

function Login() {
    const navigate = useNavigate();
    const params = new URLSearchParams(globalThis.location.search);
    const redirect = params.get("redirect") || "/account";
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");

    async function submit(event) {
        event.preventDefault();
        setError("");

        try {
            const result = await loginCustomer(form);
            globalThis.localStorage?.setItem("auroraJwt", result.token);
            navigate(redirect, { replace: true });
        } catch (loginError) {
            setError(loginError.message);
        }
    }

    return (
        <>
            <Navbar />
            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Login</span>
                    <h1>Access your Aurora account.</h1>
                    <p>Login with your verified customer account to view products, licenses and downloads.</p>
                </section>

                <section className="customer-grid two">
                    <form className="customer-card customer-form" onSubmit={submit}>
                        <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                        <label>Password<input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
                        <button className="customer-button" type="submit">Login</button>
                        {error && <p className="product-state">{error}</p>}
                        <Link to="/forgot-password">Forgot Password</Link>
                    </form>

                    <article className="customer-card">
                        <h2>New Customer?</h2>
                        <p>Create an Aurora account and verify your email before accessing the dashboard.</p>
                        <Link className="customer-button secondary" to="/register">Register</Link>
                    </article>
                </section>
            </main>
            <Footer />
        </>
    );
}

export default Login;
