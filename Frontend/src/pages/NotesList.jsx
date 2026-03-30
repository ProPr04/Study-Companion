import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { fetchAllNotes } from "../api";
import "../App.css";

export default function NotesList() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const res = await fetchAllNotes();
        setNotes(Array.isArray(res?.notes) ? res.notes : []);
      } catch (loadError) {
        console.error("Error fetching notes:", loadError);
        setError("Unable to load saved notes right now.");
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, []);

  return (
    <div className="notes-library">
      <section className="app-panel notes-library-hero">
        <span className="app-eyebrow">Saved Notes</span>
        <div className="notes-library-header">
          <div>
            <h1 className="app-title">Browse everything you have generated so far.</h1>
            <p className="app-subtitle">
              Revisit previous outputs, skim summaries, and reopen material without
              uploading the same document again.
            </p>
          </div>
          <div className="library-count-card">
            <p className="app-meta-label">Stored Notes</p>
            <p className="library-count-value">{notes.length}</p>
          </div>
        </div>
      </section>

      {loading ? <div className="status-banner warning">Loading saved notes...</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}

      {!loading && !error && notes.length === 0 ? (
        <div className="app-panel empty-library">
          <strong>No notes in the database yet.</strong>
          Generate a document summary from the Notes Generator page and it will appear here.
        </div>
      ) : null}

      <div className="notes-library-grid">
        {notes.map((note) => (
          <article key={note.id} className="app-panel library-note-card">
            <div className="library-note-sidebar">
              <div className="library-note-meta">
                <div>
                  <p className="app-meta-label">Document ID</p>
                  <p className="app-meta-value">{note.document_id}</p>
                </div>
                <div>
                  <p className="app-meta-label">Created</p>
                  <p className="app-meta-value">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="library-file-chip">{note.file_name ?? "Uploaded PDF"}</div>
            </div>

            <div className="library-note-body">
              <div className="library-note-preview markdown-notes">
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
