import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadPDF } from "../api";
import "../App.css";

const createUploadRow = () => ({
  id: crypto.randomUUID(),
  className: "",
  subject: "",
  file: null,
});

export default function OnboardingUpload() {
  const navigate = useNavigate();
  const [uploadRows, setUploadRows] = useState([createUploadRow()]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const updateRow = (rowId, field, value) => {
    setUploadRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setUploadRows((currentRows) => [...currentRows, createUploadRow()]);
  };

  const handleRemoveRow = (rowId) => {
    setUploadRows((currentRows) =>
      currentRows.length === 1 ? currentRows : currentRows.filter((row) => row.id !== rowId)
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const hasIncompleteRow = uploadRows.some(
      (row) => !row.className.trim() || !row.subject.trim() || !row.file
    );

    if (hasIncompleteRow) {
      setError("Please choose a class, subject, and PDF for each upload before continuing.");
      return;
    }

    setIsSubmitting(true);
    setUploadedCount(0);

    try {
      for (const row of uploadRows) {
        await uploadPDF(row.file, {
          className: row.className,
          subject: row.subject,
        });

        setUploadedCount((count) => count + 1);
      }

      navigate("/app/notes");
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.response?.data?.error || "Could not upload the selected documents.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page onboarding-page">
      <div className="app-panel onboarding-card">
        <span className="app-eyebrow">Setup your workspace</span>
        <h1 className="auth-title">Add your class subjects and starter PDFs.</h1>
        <p className="app-subtitle">
          Choose the class, subject, and document for each study area. You can add
          multiple subject uploads now, then move straight into the dashboard.
        </p>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="onboarding-list">
            {uploadRows.map((row, index) => (
              <section key={row.id} className="onboarding-upload-card">
                <div className="onboarding-upload-header">
                  <div>
                    <p className="app-meta-label">Upload {index + 1}</p>
                    <h2 className="onboarding-upload-title">
                      {row.subject.trim() || `Subject ${index + 1}`}
                    </h2>
                  </div>
                  {uploadRows.length > 1 ? (
                    <button
                      type="button"
                      className="secondary-cta"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="onboarding-grid">
                  <label className="onboarding-field">
                    <span className="app-meta-label">Class</span>
                    <input
                      className="auth-input"
                      type="text"
                      placeholder="Class 10"
                      value={row.className}
                      onChange={(event) => updateRow(row.id, "className", event.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="onboarding-field">
                    <span className="app-meta-label">Subject</span>
                    <input
                      className="auth-input"
                      type="text"
                      placeholder="Science"
                      value={row.subject}
                      onChange={(event) => updateRow(row.id, "subject", event.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <label className="onboarding-field">
                  <span className="app-meta-label">Document</span>
                  <input
                    className="auth-input file-input"
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => updateRow(row.id, "file", event.target.files?.[0] ?? null)}
                    disabled={isSubmitting}
                  />
                  <span className="onboarding-file-copy">
                    {row.file ? row.file.name : "Choose the PDF for this subject"}
                  </span>
                </label>
              </section>
            ))}
          </div>

          <div className="onboarding-actions">
            <button
              type="button"
              className="secondary-cta"
              onClick={handleAddRow}
              disabled={isSubmitting}
            >
              Add new subject
            </button>
            <button type="submit" className="primary-cta" disabled={isSubmitting}>
              {isSubmitting ? "Uploading..." : "Upload and continue"}
            </button>
          </div>
        </form>

        {isSubmitting ? (
          <div className="status-banner warning">
            Uploading {uploadedCount} of {uploadRows.length} document
            {uploadRows.length === 1 ? "" : "s"}.
          </div>
        ) : null}

        {error ? <div className="status-banner error">{error}</div> : null}
      </div>
    </div>
  );
}
