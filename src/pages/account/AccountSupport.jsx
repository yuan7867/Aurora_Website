import CustomerLayout from "../../components/layouts/CustomerLayout";

function AccountSupport() {
    return (
        <CustomerLayout eyebrow="Support" title="Support Center">
            <section className="account-grid">
                <article className="account-card">
                    <span>FAQ</span>
                    <h2>Common Questions</h2>
                    <ul>
                        <li>How do I connect Aurora MT5 AI?</li>
                        <li>Where will licenses appear?</li>
                        <li>How will downloads be delivered?</li>
                    </ul>
                </article>

                <article className="account-card">
                    <span>Contact</span>
                    <h2>Customer Support</h2>
                    <p>Support requests will be connected through Aurora Cloud customer service tools.</p>
                </article>

                <article className="account-card">
                    <span>Documentation</span>
                    <h2>Docs</h2>
                    <p>Customer documentation entry is reserved for product guides and release notes.</p>
                </article>
            </section>
        </CustomerLayout>
    );
}

export default AccountSupport;
