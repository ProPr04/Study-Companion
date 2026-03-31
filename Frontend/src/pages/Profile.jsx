import { useEffect, useState } from "react";
import { fetchTutorProfile, updateTutorProfile } from "../api";
import { getSessionUser } from "../lib/apiClient";
import "../App.css";

const levelOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const parseCommaSeparated = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function Profile() {
  const user = getSessionUser();
  const emailName = user?.email ? user.email.split("@")[0] : "Learner";
  const [form, setForm] = useState({
    subject: "Data Structures and Algorithms",
    level: "beginner",
    weakAreas: "recursion, memory management",
    misconceptions: "recursion is faster than iteration",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetchTutorProfile();
        const profile = res?.profile;

        if (profile) {
          setForm({
            subject: profile.subject ?? "Data Structures and Algorithms",
            level: profile.level ?? "beginner",
            weakAreas: Array.isArray(profile.weakAreas) ? profile.weakAreas.join(", ") : "",
            misconceptions: Array.isArray(profile.misconceptions)
              ? profile.misconceptions.join(", ")
              : "",
          });
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load your tutor profile right now.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateTutorProfile({
        subject: form.subject,
        level: form.level,
        weakAreas: parseCommaSeparated(form.weakAreas),
        misconceptions: parseCommaSeparated(form.misconceptions),
      });

      setSuccess("Tutor profile updated. Future chat answers will use this context.");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.response?.data?.error || "Could not save your tutor profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Tutor Profile</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Edit the learning context your AI tutor remembers every turn.</h1>
            <p className="app-subtitle">
              This profile directly guides follow-up handling, misconception correction, and explanation depth
              in the study chat.
            </p>
          </div>
          <div className="profile-avatar-large" aria-hidden="true">
            {emailName.slice(0, 1).toUpperCase()}
          </div>
        </div>
      </section>

      {loading ? <div className="status-banner warning">Loading tutor profile...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
      {success ? <div className="status-banner success">{success}</div> : null}

      {!loading ? (
        <section className="profile-grid">
          <article className="app-panel profile-card">
            <p className="app-meta-label">Account</p>
            <h2 className="preview-title">{user?.email ?? "No email available"}</h2>
            <p className="preview-copy">
              This account owns the tutor memory, recent confusion state, and personalized chat context.
            </p>
          </article>

          <article className="app-panel profile-card">
            <form className="profile-form" onSubmit={handleSubmit}>
              <label className="profile-field">
                <span className="app-meta-label">Subject</span>
                <input
                  className="auth-input"
                  type="text"
                  value={form.subject}
                  onChange={(event) => handleChange("subject", event.target.value)}
                  placeholder="Data Structures and Algorithms"
                />
              </label>

              <label className="profile-field">
                <span className="app-meta-label">Level</span>
                <select
                  className="chat-select"
                  value={form.level}
                  onChange={(event) => handleChange("level", event.target.value)}
                >
                  {levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="profile-field">
                <span className="app-meta-label">Weak Areas</span>
                <textarea
                  className="chat-input profile-textarea"
                  value={form.weakAreas}
                  onChange={(event) => handleChange("weakAreas", event.target.value)}
                  rows={3}
                  placeholder="recursion, memory management"
                />
              </label>

              <label className="profile-field">
                <span className="app-meta-label">Misconceptions To Correct</span>
                <textarea
                  className="chat-input profile-textarea"
                  value={form.misconceptions}
                  onChange={(event) => handleChange("misconceptions", event.target.value)}
                  rows={3}
                  placeholder="recursion is faster than iteration"
                />
              </label>

              <button type="submit" className="primary-cta" disabled={saving}>
                {saving ? "Saving Profile..." : "Save Tutor Profile"}
              </button>
            </form>
          </article>
        </section>
      ) : null}
    </div>
  );
}
