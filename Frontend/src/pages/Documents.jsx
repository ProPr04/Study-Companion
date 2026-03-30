import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDocumentById, fetchAllDocuments } from "../api";
import "../App.css";

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const res = await fetchAllDocuments();
        setDocuments(Array.isArray(res?.documents) ? res.documents : []);
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load uploads right now.");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const handleDelete = async (documentId) => {
    setDeletingId(documentId);
    setError("");

    try {
      await deleteDocumentById(documentId);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((document) => document.id !== documentId)
      );
    } catch (deleteError) {
      console.error(deleteError);
      setError("Could not delete that upload. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="notes-library">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Documents</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Manage uploads and their generated notes.</h1>
            <p className="app-subtitle">
              Removing a document here also removes the notes linked to that upload,
              keeping the database clean and the lists in sync.
            </p>
          </div>
          <div className="documents-hero-actions">
            <Link to="/onboarding" className="primary-cta documents-upload-link">
              Upload more documents
            </Link>
            <div className="library-count-card">
              <p className="app-meta-label">Uploads</p>
              <p className="library-count-value">{documents.length}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? <div className="status-banner warning">Loading uploaded documents...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {!loading && !error && documents.length === 0 ? (
        <div className="app-panel empty-library">
          <strong>No uploads available.</strong>
          Once you upload a PDF from the Notes Generator page, it will appear here.
        </div>
      ) : null}

      <div className="documents-grid">
        {documents.map((document) => (
          <article key={document.id} className="app-panel document-card">
            <div className="document-card-main">
              <div>
                <p className="app-meta-label">Document ID</p>
                <p className="app-meta-value">{document.id}</p>
              </div>
              <div>
                <p className="document-title">{document.file_name}</p>
                <p className="document-copy">
                  Uploaded {new Date(document.created_at).toLocaleString()}
                </p>
                {document.class_name || document.subject ? (
                  <div className="document-tags">
                    {document.class_name ? (
                      <span className="document-tag">Class: {document.class_name}</span>
                    ) : null}
                    {document.subject ? (
                      <span className="document-tag">Subject: {document.subject}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="document-card-meta">
              <div className="document-meta-pill">
                {document.notes_count} note{document.notes_count === 1 ? "" : "s"}
              </div>
              <div className="document-actions">
                <Link
                  to={`/app/documents/${document.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-cta document-view-link"
                >
                  View PDF
                </Link>
              </div>
              <button
                type="button"
                className="danger-button"
                onClick={() => handleDelete(document.id)}
                disabled={deletingId === document.id}
              >
                {deletingId === document.id ? "Deleting..." : "Delete upload"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
