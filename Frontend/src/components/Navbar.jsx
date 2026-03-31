import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const userMenuItems = [
  { label: "Profile", path: "/app/profile" },
  { label: "Analysis", path: "/app/analysis" },
];

export default function Navbar({ onMenuClick, onLogout, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  let pageTitle = "Dashboard";

  if (location.pathname === "/app/notes") {
    pageTitle = "Notes Generator";
  } else if (location.pathname === "/app/notes/list") {
    pageTitle = "Saved Notes";
  } else if (location.pathname === "/app/documents") {
    pageTitle = "Documents";
  } else if (location.pathname.startsWith("/app/documents/")) {
    pageTitle = "PDF Viewer";
  } else if (location.pathname === "/app/quiz") {
    pageTitle = "Quiz";
  } else if (location.pathname === "/app/chat") {
    pageTitle = "Study Chat";
  } else if (location.pathname === "/app/analysis") {
    pageTitle = "Analysis";
  } else if (location.pathname === "/app/profile") {
    pageTitle = "Profile";
  }

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    setIsUserMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setIsUserMenuOpen(false);
    onLogout();
  };

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
        <div className="user-menu-shell" ref={userMenuRef}>
          <button
            type="button"
            className="user-menu-trigger"
            onClick={() => setIsUserMenuOpen((current) => !current)}
            aria-label="Open user menu"
            aria-expanded={isUserMenuOpen}
          >
            <span className="user-menu-icon">
              <span className="user-menu-head" />
              <span className="user-menu-body" />
            </span>
          </button>

          {isUserMenuOpen ? (
            <div className="user-floating-menu">
              <div className="user-floating-header">
                <div className="user-floating-avatar">
                  {(user?.email ?? "u").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="app-meta-label">Signed in as</p>
                  <p className="user-floating-email">{user?.email ?? "Unknown user"}</p>
                </div>
              </div>

              <div className="user-floating-actions">
                {userMenuItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className={`user-floating-action${location.pathname === item.path ? " is-active" : ""}`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  type="button"
                  className="user-floating-action logout"
                  onClick={handleLogoutClick}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
