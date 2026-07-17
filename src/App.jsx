import { Navigate, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
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
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import TrustCenter from "./pages/TrustCenter";
import VerifyEmail from "./pages/VerifyEmail";

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/product/:id"
        element={<Product />}
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
