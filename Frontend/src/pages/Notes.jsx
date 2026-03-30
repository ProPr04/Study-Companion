import { useState } from "react";
import ReactMarkdown from "react-markdown";
import UploadBox from "../components/UploadBox";
import { fetchNotes, generateNotes, uploadPDF } from "../api";
import "../App.css";


function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setLoading(true);
    setError("");
    setNotes("");

    try {
      const uploadRes = await uploadPDF(selectedFile);
      const id = uploadRes.document?.id ?? uploadRes.docId;

      if (!id) {
        throw new Error("Upload succeeded but the document ID was missing.");
      }

      setDocumentId(id);

      await generateNotes(id);
      const notesRes = await fetchNotes(id);

      const extractedNotes = Array.isArray(notesRes?.notes)
        ? notesRes.notes[0]?.content
        : notesRes?.notes?.content;

      if (typeof extractedNotes !== "string" || !extractedNotes.trim()) {
        throw new Error("The app did not receive generated note content.");
      }

      setNotes(extractedNotes);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <section className="app-panel app-sidebar">
        <span className="app-eyebrow">AI Study Workspace</span>

        <div>
          <h1 className="app-title">Turn dense PDFs into cleaner study notes.</h1>
          <p className="app-subtitle">
            Upload a class handout, chapter, or research paper and get back a
            more readable summary with structure already in place.
          </p>
        </div>

        <div className="app-meta-grid">
          <div className="app-meta-card">
            <p className="app-meta-label">Input</p>
            <p className="app-meta-value">{file ? file.name : "No PDF selected yet"}</p>
          </div>
          <div className="app-meta-card">
            <p className="app-meta-label">Status</p>
            <p className="app-meta-value">{loading ? "Generating notes" : "Ready"}</p>
          </div>
          <div className="app-meta-card">
            <p className="app-meta-label">Document</p>
            <p className="app-meta-value">{documentId ?? "Will appear after upload"}</p>
          </div>
        </div>

        <UploadBox onFileSelect={handleFileSelect} loading={loading} />

        <div className="app-status">
          {loading ? (
            <div className="status-banner warning">
              Uploading your PDF, extracting text, and generating notes. Larger
              documents can take a little longer.
            </div>
          ) : null}

          {error ? <div className="status-banner error">{error}</div> : null}

          {file && !loading ? (
            <div className="status-banner info">Selected file: {file.name}</div>
          ) : null}

          {documentId && !loading && !error ? (
            <div className="status-banner success">Document ID: {documentId}</div>
          ) : null}
        </div>
      </section>

      <section className="app-panel app-preview">
        <div className="preview-header">
          <div>
            <h2 className="preview-title">Generated Notes</h2>
            <p className="preview-copy">
              Markdown formatting is rendered directly here so headings, bullet
              points, and emphasis remain readable instead of collapsing into plain
              text blocks.
            </p>
          </div>
          <div className="preview-chip">
            {notes ? "Markdown render enabled" : "Waiting for notes"}
          </div>
        </div>

        <div className="notes-card">
          {notes ? (
            <div className="markdown-notes">
              <ReactMarkdown>{notes}</ReactMarkdown>
            </div>
          ) : (
            <div className="notes-placeholder">
              <div>
                <strong>Your notes will appear here.</strong>
                Upload a PDF from the left panel to generate a cleaner study view
                with structure preserved.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
