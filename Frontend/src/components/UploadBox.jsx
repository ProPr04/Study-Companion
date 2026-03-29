import { useRef } from "react";

function UploadBox({ onFileSelect }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div
      style={styles.box}
      onClick={() => fileInputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <p style={styles.text}>Drag & drop your PDF here</p>
      <p style={styles.or}>OR</p>
      <button style={styles.button}>Upload PDF</button>
    </div>
  );
}

const styles = {
  box: {
    marginTop: "30px",
    padding: "40px",
    border: "2px dashed #475569",
    borderRadius: "12px",
    textAlign: "center",
    cursor: "pointer",
    width: "400px",
  },
  text: {
    marginBottom: "10px",
  },
  or: {
    margin: "10px 0",
    color: "#94a3b8",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#3b82f6",
    color: "white",
    cursor: "pointer",
  },
};

export default UploadBox;