import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="app-panel auth-card landing-card">
        <span className="app-eyebrow">Study Companion</span>
        <h1 className="auth-title">Learn from your own material, not generic summaries.</h1>
        <p className="app-subtitle">
          Upload documents, generate structured notes, create focused quizzes, and
          manage your learning flow from one workspace.
        </p>

        <div className="landing-actions">
          <button
            type="button"
            className="primary-cta"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
          <button
            type="button"
            className="secondary-cta"
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
