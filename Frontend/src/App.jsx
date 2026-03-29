import { useState } from "react";
import UploadBox from "./components/UploadBox";
import { uploadPDF } from "./api";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docId, setDocId] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const response = await uploadPDF(selectedFile);

      // Expecting backend to return something like:
      // { docId: "123" }
      setDocId(response.docId);

      console.log("Upload successful:", response);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Study Companion</h1>
      <p style={styles.subtitle}>
        Upload your PDF to generate structured notes
      </p>

      <UploadBox onFileSelect={handleFileSelect} />

      {file && (
        <p style={styles.info}>Selected: {file.name}</p>
      )}

      {loading && (
        <p style={styles.loading}>Uploading PDF...</p>
      )}

      {error && (
        <p style={styles.error}>{error}</p>
      )}

      {docId && (
        <p style={styles.success}>
          Upload complete. Document ID: {docId}
        </p>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#0f172a",
    color: "white",
  },
  title: {
    fontSize: "2.5rem",
    marginBottom: "10px",
  },
  subtitle: {
    fontSize: "1.2rem",
    color: "#94a3b8",
  },
  info: {
    marginTop: "20px",
    color: "#94a3b8",
  },
  loading: {
    marginTop: "20px",
    color: "#facc15",
  },
  error: {
    marginTop: "20px",
    color: "#ef4444",
  },
  success: {
    marginTop: "20px",
    color: "#22c55e",
  },
};

export default App;
