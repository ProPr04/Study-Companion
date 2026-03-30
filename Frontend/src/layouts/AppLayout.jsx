import { Outlet } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import "../App.css";
import { clearSession, getSessionUser } from "../lib/apiClient";

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const user = getSessionUser();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="dashboard-shell">
      <div
        className={`sidebar-backdrop${isSidebarOpen ? " is-open" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="dashboard-main">
        <Navbar
          onMenuClick={() => setIsSidebarOpen(true)}
          onLogout={handleLogout}
          user={user}
        />

        <div className="dashboard-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
