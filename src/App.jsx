import { Navigate, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import AuroraHome from "./pages/AuroraHome";
import AccountDashboard from "./pages/account/AccountDashboard";
import AccountDownloads from "./pages/account/AccountDownloads";
import AccountLicenses from "./pages/account/AccountLicenses";
import AccountProducts from "./pages/account/AccountProducts";
import AccountSupport from "./pages/account/AccountSupport";
import AccountUpdates from "./pages/account/AccountUpdates";
import Checkout from "./pages/Checkout";
import DownloadCenter from "./pages/DownloadCenter";
import ForgotPassword from "./pages/ForgotPassword";
import License from "./pages/License";
import Login from "./pages/Login";
import PayPalSuccess from "./pages/PayPalSuccess";
import Pricing from "./pages/Pricing";
import Product from "./pages/Product";
import ProductsPage from "./pages/ProductsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import TrustCenter from "./pages/TrustCenter";
import VerifyEmail from "./pages/VerifyEmail";
import LiveTradingPage from "./pages/LiveTradingPage";
import { applySeo, canonicalUrl } from "./utils/seo";

const pageSeo = {
  "/": {
    title: "Aurora HY | Intelligent AI Software Company",
    description: "Aurora develops intelligent AI software for traders, businesses and creative professionals."
  },
  "/products": {
    title: "Aurora Products | Intelligent AI Software by Aurora HY",
    description: "Explore Aurora intelligent software products for trading, business automation and future AI platforms."
  },
  "/performance": {
    title: "Live Trading | Aurora HY",
    description: "View Aurora live trading visibility from Aurora Cloud without fallback or mock trading data."
  },
  "/pricing": {
    title: "Pricing | Aurora HY",
    description: "Choose an Aurora product and subscription plan through the official Aurora HY commercial flow."
  },
  "/download": {
    title: "Download Center | Aurora HY",
    description: "Access Aurora product downloads connected to verified customer purchases and licenses."
  },
  "/checkout": {
    title: "Checkout | Aurora HY",
    description: "Complete your Aurora subscription checkout through the official Aurora HY commerce flow."
  },
  "/login": {
    title: "Customer Login | Aurora HY",
    description: "Log in to your Aurora customer account to view products, licenses and downloads."
  },
  "/register": {
    title: "Create Customer Account | Aurora HY",
    description: "Register for an Aurora customer account for product access, licenses and downloads."
  },
  "/forgot-password": {
    title: "Forgot Password | Aurora HY",
    description: "Request a secure Aurora customer account password reset."
  },
  "/verify-email": {
    title: "Verify Email | Aurora HY",
    description: "Verify your Aurora customer account email address."
  },
  "/reset-password": {
    title: "Reset Password | Aurora HY",
    description: "Set a new password for your Aurora customer account."
  },
  "/paypal-success": {
    title: "Payment Success | Aurora HY",
    description: "Aurora payment confirmation and license delivery status."
  },
  "/license": {
    title: "License Delivery | Aurora HY",
    description: "View Aurora license delivery details after a completed purchase."
  },
  "/trust": {
    title: "Company | Aurora HY",
    description: "Learn about Aurora Technologies, our mission, vision, values and professional contact channels."
  },
  "/account": {
    title: "Customer Dashboard | Aurora HY",
    description: "Manage Aurora products, subscriptions, licenses, downloads and support."
  },
  "/account/products": {
    title: "My Products | Aurora HY",
    description: "View your purchased Aurora products in the customer area."
  },
  "/account/downloads": {
    title: "My Downloads | Aurora HY",
    description: "Access Aurora customer product downloads."
  },
  "/account/licenses": {
    title: "My Licenses | Aurora HY",
    description: "View Aurora customer license information."
  },
  "/account/updates": {
    title: "Update History | Aurora HY",
    description: "View Aurora product update history in the customer area."
  },
  "/account/support": {
    title: "Customer Support | Aurora HY",
    description: "Access Aurora customer support resources."
  }
};

function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/product/")) {
      return;
    }

    const seo = pageSeo[location.pathname] || {
      title: "Aurora HY | Intelligent AI Software Company",
      description: "Aurora develops intelligent AI software for traders, businesses and creative professionals."
    };

    applySeo({
      ...seo,
      canonical: canonicalUrl(location.pathname)
    });
  }, [location.pathname]);

  return (
    <Routes>

      <Route
        path="/"
        element={<AuroraHome />}
      />

      <Route
        path="/product/:id"
        element={<Product />}
      />

      <Route
        path="/products"
        element={<ProductsPage />}
      />

      <Route
        path="/performance"
        element={<LiveTradingPage />}
      />

      <Route
        path="/pricing"
        element={<Pricing />}
      />

      <Route
        path="/download"
        element={<DownloadCenter />}
      />

      <Route
        path="/checkout"
        element={<Checkout />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/verify-email"
        element={<VerifyEmail />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/paypal-success"
        element={<PayPalSuccess />}
      />

      <Route
        path="/license"
        element={<License />}
      />

      <Route
        path="/portal"
        element={<Navigate to="/account" replace />}
      />

      <Route
        path="/account"
        element={<ProtectedRoute><AccountDashboard /></ProtectedRoute>}
      />

      <Route
        path="/account/products"
        element={<ProtectedRoute><AccountProducts /></ProtectedRoute>}
      />

      <Route
        path="/account/downloads"
        element={<ProtectedRoute><AccountDownloads /></ProtectedRoute>}
      />

      <Route
        path="/account/licenses"
        element={<ProtectedRoute><AccountLicenses /></ProtectedRoute>}
      />

      <Route
        path="/account/updates"
        element={<ProtectedRoute><AccountUpdates /></ProtectedRoute>}
      />

      <Route
        path="/account/support"
        element={<ProtectedRoute><AccountSupport /></ProtectedRoute>}
      />

      <Route
        path="/trust"
        element={<TrustCenter />}
      />

    </Routes>
  );
}

export default App;
