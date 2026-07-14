import { useEffect, useState } from "react";

import CustomerLayout from "../../components/layouts/CustomerLayout";
import { getCustomer } from "../../services/commerceApi.js";

function AccountLicenses() {
    const [licenses, setLicenses] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        getCustomer()
            .then((payload) => {
                setLicenses(payload.customer?.licenses || []);
                setStatus(payload.customer ? "ready" : "missing");
            })
            .catch(() => setStatus("offline"));
    }, []);

    return (
        <CustomerLayout eyebrow="My Licenses" title="Licenses">
            {status === "loading" && <p className="product-state">Loading licenses...</p>}
            {status === "offline" && <p className="product-state">Commerce API Offline. Waiting for Aurora Commerce...</p>}
            {status === "missing" && <p className="product-state">No licenses found.</p>}

            {status === "ready" && (
                <section className="account-list">
                    {licenses.map((license) => (
                        <article className="account-row" key={license.id}>
                            <strong>{license.productName}</strong>
                            <span>{license.licenseKey || "Pending"}</span>
                            <span className={`account-status ${license.status === "Issued" ? "ready" : "reserved"}`}>{license.status}</span>
                        </article>
                    ))}
                </section>
            )}
        </CustomerLayout>
    );
}

export default AccountLicenses;
