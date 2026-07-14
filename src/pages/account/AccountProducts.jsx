import { useEffect, useState } from "react";

import CustomerLayout from "../../components/layouts/CustomerLayout";
import { getCustomer } from "../../services/commerceApi.js";

function AccountProducts() {
    const [products, setProducts] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let mounted = true;

        getCustomer()
            .then((payload) => {
                if (!mounted) {
                    return;
                }
                setProducts(payload.customer?.products || []);
                setStatus(payload.customer ? "ready" : "missing");
            })
            .catch(() => {
                if (mounted) {
                    setStatus("offline");
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <CustomerLayout eyebrow="My Products" title="Products">
            {status === "loading" && <p className="product-state">Loading...</p>}
            {status === "offline" && <p className="product-state">Commerce API Offline. Waiting for Aurora Commerce...</p>}
            {status === "missing" && <p className="product-state">No purchased products found.</p>}

            {status === "ready" && (
                <section className="account-list">
                    {products.map((product) => (
                        <article className="account-row" key={product.id}>
                            <strong>{product.name}</strong>
                            <span>{product.purchasedAt}</span>
                            <span className="account-status ready">{product.status}</span>
                        </article>
                    ))}
                </section>
            )}
        </CustomerLayout>
    );
}

export default AccountProducts;
