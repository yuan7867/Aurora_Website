import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ProductArchitecture from "../components/ProductArchitecture";
import ProductBattleTest from "../components/ProductBattleTest";
import ProductFeatures from "../components/ProductFeatures";
import ProductHighlights from "../components/ProductHighlights";
import ProductLayout from "../components/layouts/ProductLayout";
import ProductReleaseNotes from "../components/ProductReleaseNotes";

import { getProduct } from "../services/auroraApi.js";
import { applySeo, canonicalUrl, defaultSeo } from "../utils/seo";

import "../styles/product.css";

function Product() {
    const { id } = useParams();
    const [cloudProduct, setCloudProduct] = useState(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let mounted = true;

        getProduct(id)
            .then((product) => {
                if (!mounted) {
                    return;
                }
                setCloudProduct(product);
                setStatus("ready");
            })
            .catch(() => {
                if (!mounted) {
                    return;
                }
                setCloudProduct(null);
                setStatus("offline");
            });

        return () => {
            mounted = false;
        };
    }, [id]);

    const product = useMemo(() => {
        if (!cloudProduct) {
            return null;
        }

        return {
            title: cloudProduct.product_name,
            subtitle: `${cloudProduct.category} / ${cloudProduct.release_channel}`,
            description: cloudProduct.description,
            status: cloudProduct.status,
            overview: [
                `Product ID: ${cloudProduct.product_id}`,
                `Version: ${cloudProduct.version}`,
                `Build: ${cloudProduct.build}`,
                `Cloud Version: ${cloudProduct.cloud_version}`,
                `Minimum Cloud Version: ${cloudProduct.minimum_cloud_version}`
            ],
            highlights: [
                {
                    title: "Live Trading Visibility",
                    description: "Customers can verify Aurora MT5 AI status, broker, server, session and Cloud connection before purchase."
                },
                {
                    title: "Aurora Cloud Verified",
                    description: cloudProduct.website_publish ? "Product readiness is synchronized from Aurora Cloud, not hardcoded into the website." : "Cloud publishing is not enabled yet."
                },
                {
                    title: "Customer Area Ready",
                    description: cloudProduct.download_enable ? "Download delivery is prepared through Aurora Cloud." : "Downloads, licenses and updates are managed through Aurora Cloud customer delivery."
                }
            ],
            features: [
                `Live Status: ${cloudProduct.status}`,
                `Battle Test: ${cloudProduct.battle_test ? "Visible" : "Not visible"}`,
                `Customer Area: Ready for future login, licenses, downloads and updates`,
                `Support Path: ${cloudProduct.support_email || "Aurora customer support"}`
            ],
            architecture: [
                "product.yaml",
                "Aurora Product Registry Center",
                "Aurora Cloud Database",
                "Aurora Cloud REST API",
                "Aurora Website"
            ],
            battle: {
                status: cloudProduct.battle_test ? "Enabled" : "Not enabled",
                version: cloudProduct.version,
                runtime: cloudProduct.status,
                aiEngine: cloudProduct.cloud_version
            },
            actions: [
                {
                    label: "Compare Plans",
                    href: "/pricing",
                    variant: "secondary"
                },
                {
                    label: "Trust Center",
                    href: "/trust",
                    variant: "secondary"
                }
            ],
            releaseNotes: [
                {
                    version: cloudProduct.version,
                    date: cloudProduct.updated_time?.slice(0, 10) || "",
                    summary: `${cloudProduct.product_name} is synchronized from Aurora Cloud Product Registry Center.`
                }
            ]
        };
    }, [cloudProduct]);

    useEffect(() => {
        if (!product) {
            applySeo({
                title: status === "loading" ? "Loading Product | Aurora HY" : "Product Not Found | Aurora HY",
                description: "Aurora product information is provided by Aurora Cloud.",
                canonical: canonicalUrl(`/product/${id || ""}`)
            });
            return;
        }

        const title = `${product.title} | Aurora HY`;
        const description = product.description;

        applySeo({
            title,
            description,
            canonical: canonicalUrl(`/product/${id}`)
        });

        return () => {
            applySeo(defaultSeo);
        };
    }, [id, product, status]);

    if (status === "loading") {
        return (
            <>
                <Navbar />

                <main className="product-page product-shell">
                    <h1>Loading Product</h1>
                </main>

                <Footer />
            </>
        );
    }

    if (status === "offline") {
        return (
            <>
                <Navbar />

                <main className="product-page product-shell">
                    <h1>Aurora Cloud Offline</h1>

                    <p className="product-offline">
                        Product details are provided by Aurora Cloud. No fallback or mock product data is displayed while
                        Aurora Cloud is unavailable.
                    </p>

                    <Link
                        aria-label="Back to Aurora Hub home page"
                        className="back-home"
                        to="/"
                    >
                        &lt;- Back to Aurora Hub
                    </Link>
                </main>

                <Footer />
            </>
        );
    }

    if (!product) {
        return (
            <>
                <Navbar />

                <main className="product-page product-shell">
                    <h1>Product Not Found</h1>

                    <Link
                        aria-label="Back to Aurora Hub home page"
                        className="back-home"
                        to="/"
                    >
                        &lt;- Back to Aurora Hub
                    </Link>
                </main>

                <Footer />
            </>
        );
    }

    return (
        <ProductLayout product={product}>
            <ProductHighlights items={product.highlights} />
            <ProductFeatures items={product.features} />
            <ProductArchitecture items={product.architecture} />
            <ProductBattleTest battle={product.battle} />
            <ProductReleaseNotes notes={product.releaseNotes} />
        </ProductLayout>
    );
}

export default Product;
