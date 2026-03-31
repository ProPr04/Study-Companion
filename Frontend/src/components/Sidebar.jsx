import { useLocation, useNavigate } from "react-router-dom";

const features = [
  { name: "Chat", path: "/app/chat", description: "Ask questions and get answers grounded in your own documents." },
  { name: "Quiz", path: "/app/quiz", description: "Generate a 10-question quiz from a selected upload." },
  { name: "Notes Generator", path: "/app/notes", description: "Upload a PDF and generate new notes." },
  { name: "Analysis", path: "/app/analysis", description: "Track quiz marks and performance history over time." },
  { name: "Saved Notes", path: "/app/notes/list", description: "Browse everything already stored in the database." },
  { name: "Documents", path: "/app/documents", description: "Manage uploaded files and clean up stored content." },
];

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (feature) => {
    navigate(feature.path);
    onClose();
  };

  return (
    <aside className={`dashboard-sidebar${isOpen ? " is-open" : ""}`}>
      <div className="sidebar-header">
        <div>
          <p className="sidebar-kicker">Workspace</p>
          <h2 className="sidebar-title">Learning Space</h2>
        </div>

        <button
          className="sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          x
        </button>
      </div>

      <nav className="sidebar-nav">
        {features.map((feature) => {
          const isActive = location.pathname === feature.path;

          return (
            <button
              key={feature.path}
              type="button"
              className={`sidebar-link${isActive ? " is-active" : ""}`}
              onClick={() => handleClick(feature)}
            >
              <span className="sidebar-link-title">
                {feature.name}
                {feature.status === "soon" ? (
                  <span className="sidebar-pill">Soon</span>
                ) : null}
              </span>
              <span className="sidebar-link-copy">{feature.description}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
