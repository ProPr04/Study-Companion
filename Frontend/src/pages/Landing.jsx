import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const featureCards = [
  {
    title: "Document-to-Notes",
    description:
      "Upload dense PDFs and turn them into cleaner study notes that are easier to revise from.",
    tag: "Summarize",
  },
  {
    title: "Quiz Generation",
    description:
      "Create focused MCQ quizzes from one selected document with difficulty control and saved results.",
    tag: "Test",
  },
  {
    title: "Study Chat",
    description:
      "Ask questions against your uploaded material and get direct answers grounded in relevant excerpts.",
    tag: "Ask",
  },
];

const workflowSteps = [
  {
    label: "1. Upload",
    copy: "Add your class notes, PDFs, or subject material into one workspace.",
  },
  {
    label: "2. Generate",
    copy: "Turn those files into notes, quizzes, and searchable learning chunks.",
  },
  {
    label: "3. Revise",
    copy: "Chat with the material, review quiz trends, and keep improving over time.",
  },
];

const liveSignals = [
  "AI note generation from uploaded PDFs",
  "Document-grounded question answering",
  "Quiz history and marks analysis",
  "Profile-driven study workspace",
];

export default function Landing() {
  const navigate = useNavigate();
  const [pointer, setPointer] = useState({ x: 50, y: 50 });

  const heroStyle = useMemo(
    () => ({
      "--hero-glow-x": `${pointer.x}%`,
      "--hero-glow-y": `${pointer.y}%`,
    }),
    [pointer.x, pointer.y]
  );

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    setPointer({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  return (
    <div className="landing-page">
      <section
        className="landing-hero"
        style={heroStyle}
        onMouseMove={handlePointerMove}
      >
        <div className="landing-hero-nav">
          <div className="landing-brand-mark">
            <span className="landing-brand-orb" aria-hidden="true" />
            <div>
              <p className="landing-brand-name">Study Companion</p>
              <p className="landing-brand-copy">Your document-based study workspace</p>
            </div>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="secondary-cta"
              onClick={() => navigate("/login")}
            >
              Login
            </button>
            <button
              type="button"
              className="primary-cta"
              onClick={() => navigate("/signup")}
            >
              Start Free
            </button>
          </div>
        </div>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="app-eyebrow">AI Study Workspace</span>
            <h1 className="landing-hero-title">
              Turn your own study material into notes, quizzes, and live AI help.
            </h1>
            <p className="landing-hero-subtitle">
              Study Companion helps you upload PDFs, generate structured notes, create document-based quizzes,
              and ask focused questions from the same workspace, so revision feels active instead of scattered.
            </p>

            <div className="landing-hero-actions">
              <button
                type="button"
                className="primary-cta"
                onClick={() => navigate("/signup")}
              >
                Create Workspace
              </button>
              <button
                type="button"
                className="secondary-cta"
                onClick={() => navigate("/login")}
              >
                Explore App
              </button>
            </div>

            <div className="landing-stat-row">
              <article className="landing-stat-card">
                <p className="app-meta-label">Core Loop</p>
                <p className="landing-stat-value">Upload to Revision</p>
              </article>
              <article className="landing-stat-card">
                <p className="app-meta-label">AI Actions</p>
                <p className="landing-stat-value">Notes, Quiz, Chat</p>
              </article>
              <article className="landing-stat-card">
                <p className="app-meta-label">Built For</p>
                <p className="landing-stat-value">Self-study workflows</p>
              </article>
            </div>
          </div>

          <div className="landing-hero-stage">
            <div className="landing-stage-shell">
              <div className="landing-stage-column landing-stage-column-main">
                <div className="landing-stage-header">
                  <span className="landing-stage-pill">Live workspace</span>
                  <span className="landing-stage-pill is-muted">AI active</span>
                </div>

                <div className="landing-stage-transcript">
                  <div className="landing-stage-bubble is-user">
                    Explain stack memory from my uploaded recursion notes.
                  </div>
                  <div className="landing-stage-bubble is-ai">
                    <span className="landing-stage-bubble-label">Thinking</span>
                    <div className="landing-stage-loader">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="landing-stage-bubble is-ai is-final">
                    Stack memory stores each function call in its own frame. In recursion, every new call adds one more frame until the base case stops the chain.
                  </div>
                </div>
              </div>

              <div className="landing-stage-column landing-stage-column-side">
                <article className="landing-signal-card">
                  <p className="app-meta-label">Features</p>
                  <div className="landing-signal-list">
                    {liveSignals.map((signal) => (
                      <div key={signal} className="landing-signal-item">
                        <span className="landing-signal-dot" aria-hidden="true" />
                        <span>{signal}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="landing-mini-chart">
                  <p className="app-meta-label">Progress Pulse</p>
                  <div className="landing-mini-chart-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <span className="app-eyebrow">Key Features</span>
          <h2 className="landing-section-title">One workspace for the full study loop</h2>
          <p className="landing-section-copy">
            Instead of switching between note apps, quiz tools, and random AI tabs, the app keeps your material,
            generated outputs, and revision workflow connected.
          </p>
        </div>

        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <span className="landing-feature-tag">{feature.tag}</span>
              <h3 className="landing-feature-title">{feature.title}</h3>
              <p className="landing-feature-copy">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <span className="app-eyebrow">How It Works</span>
          <h2 className="landing-section-title">Designed around actual student flow</h2>
        </div>

        <div className="landing-workflow-grid">
          {workflowSteps.map((step) => (
            <article key={step.label} className="landing-workflow-card">
              <p className="landing-workflow-label">{step.label}</p>
              <p className="landing-workflow-copy">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-panel app-panel">
        <div className="landing-cta-copy">
          <span className="app-eyebrow">Get Started</span>
          <h2 className="landing-section-title">Bring your own material and let the app do the heavy lifting.</h2>
          <p className="landing-section-copy">
            Start with one PDF, generate notes, test yourself with a quiz, and use chat to clear doubts from the same content.
          </p>
        </div>

        <div className="landing-cta-actions">
          <button
            type="button"
            className="primary-cta"
            onClick={() => navigate("/signup")}
          >
            Create Account
          </button>
          <button
            type="button"
            className="secondary-cta"
            onClick={() => navigate("/login")}
          >
            I already have an account
          </button>
        </div>
      </section>
    </div>
  );
}
