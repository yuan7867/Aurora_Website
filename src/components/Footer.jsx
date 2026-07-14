import "../styles/footer.css";

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-top">
                <span>Aurora Symbol Placeholder</span>
                <p>Aurora HY</p>
            </div>

            <div className="footer-links" aria-label="Footer navigation">
                <a href="/#products">Products</a>
                <a href="/pricing">Pricing</a>
                <a href="/#faq">FAQ</a>
                <a href="/trust">Trust Center</a>
                <a href="/checkout?product=aurora-mt5-ai">Buy Now</a>
            </div>

            <div className="footer-bottom">
                Copyright 2026 Aurora Technologies. All Rights Reserved.
            </div>
        </footer>
    );
}

export default Footer;
