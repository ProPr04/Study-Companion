import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken } from "../lib/apiClient";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const token = getAuthToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
