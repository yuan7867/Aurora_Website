import { useState } from "react";
import { Link } from "react-router-dom";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { registerCustomer } from "../services/commerceApi.js";

import "../styles/customer.css";

function Register() {
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [message, setMessage] = useState("");

    async function submit(event) {
        event.preventDefault();
        setMessage("");

        try {
            await registerCustomer(form);
            setMessage("Verification email sent. Please verify your email before login.");
        } catch (error) {
            setMessage(error.message);
        }
    }

    return (
        <>
            <Navbar />
            <main className="customer-page">
                <section className="customer-hero">
                    <span className="customer-tag">Register</span>
                    <h1>Create your Aurora account.</h1>
                    <p>Register, verify email, then login to access the customer dashboard.</p>
                </section>
                <form className="customer-card customer-form" onSubmit={submit}>
                    <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                    <label>Password<input type="password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
                    <button className="customer-button" type="submit">Register</button>
                    {message && <p className="product-state">{message}</p>}
                    <Link to="/login">Already have an account? Login</Link>
                </form>
            </main>
            <Footer />
        </>
    );
}

export default Register;
