import { useRef } from "react";

function UploadBox({ onFileSelect, loading }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div
      className={`upload-card${loading ? " is-busy" : ""}`}
      onClick={() => fileInputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div className="upload-dropzone">
        <div className="upload-icon">PDF</div>
        <p className="upload-title">Drag and drop your PDF here</p>
        <p className="upload-copy">or browse from your device to start note generation</p>
        <button className="upload-button" type="button" disabled={loading}>
          {loading ? "Processing..." : "Upload PDF"}
        </button>
      </div>
    </div>
  );
}

export default UploadBox;
