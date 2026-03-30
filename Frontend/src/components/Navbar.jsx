import { useLocation } from "react-router-dom";

export default function Navbar({ onMenuClick, onLogout, user }) {
  const location = useLocation();

  const titles = {
    "/app/notes": "Notes Generator",
    "/app/notes/list": "Saved Notes",
    "/app/documents": "Documents",
    "/app/quiz": "Quiz",
  };

  const pageTitle = titles[location.pathname] ?? "Dashboard";

  return (
    <header className="dashboard-topbar">
      <div className="topbar-left">
        <button
          className="menu-button"
          type="button"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <span />
          <span />
          <span />
        </button>

        <div>
          <p className="topbar-eyebrow">Study Companion</p>
          <h3 className="topbar-title">{pageTitle}</h3>
        </div>
      </div>

      <div className="topbar-right">
        {user?.email ? <span className="topbar-user">{user.email}</span> : null}
        <button type="button" className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
