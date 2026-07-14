import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children }) {
    const location = useLocation();
    const token = globalThis.localStorage?.getItem("auroraJwt");

    if (!token) {
        return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    }

    return children;
}

export default ProtectedRoute;
