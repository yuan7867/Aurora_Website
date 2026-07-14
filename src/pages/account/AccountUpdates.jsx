import CustomerLayout from "../../components/layouts/CustomerLayout";

function AccountUpdates() {
    return (
        <CustomerLayout eyebrow="Updates" title="Update History">
            <section className="account-grid two">
                <article className="account-card">
                    <span>Future Cloud API</span>
                    <h2>Release Timeline</h2>
                    <p>Update history will be synchronized from Aurora Cloud release service.</p>
                </article>

                <article className="account-card">
                    <span>Customer Products</span>
                    <h2>Installed Versions</h2>
                    <p>Installed product version tracking will be matched to purchased products in the customer record.</p>
                </article>
            </section>
        </CustomerLayout>
    );
}

export default AccountUpdates;
