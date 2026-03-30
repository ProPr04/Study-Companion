import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchDocumentFile } from "../api";
import "../App.css";

export default function DocumentViewer() {
  const { id } = useParams();
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";

    const loadFile = async () => {
      setLoading(true);
      setError("");

      try {
        const blob = await fetchDocumentFile(id);
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError?.response?.data?.error || "Could not load this PDF.");
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);

  return (
    <div className="document-viewer-page">
      <section className="app-panel document-viewer-shell">
        <div className="document-viewer-header">
          <div>
            <span className="app-eyebrow">PDF Viewer</span>
            <h1 className="preview-title">Uploaded document preview</h1>
            <p className="preview-copy">
              This tab shows the original PDF exactly as it was uploaded so users can
              read it without leaving the app flow.
            </p>
          </div>
          <Link to="/app/documents" className="secondary-cta document-viewer-back">
            Back to documents
          </Link>
        </div>

        {loading ? <div className="status-banner warning">Loading PDF preview...</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}

        {!loading && !error && fileUrl ? (
          <div className="document-viewer-frame-shell">
            <iframe
              title={`Document ${id}`}
              src={fileUrl}
              className="document-viewer-frame"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
