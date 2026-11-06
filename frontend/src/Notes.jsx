
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./Notes.css";

const API = "https://emmy-backend-7i0m.onrender.com";

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".ppt"
];

function Notes({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const successTimerRef = useRef(null);

  const cancelSuccessTimer = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelSuccessTimer();
    };
  }, []);

  const validateAndSelectFile = (selectedFile) => {
    cancelSuccessTimer();

    setNotesText("");
    setMessage("");
    setMessageType("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const fileName = selectedFile.name.toLowerCase();

    const isAllowed = ALLOWED_EXTENSIONS.some(
      (extension) => fileName.endsWith(extension)
    );

    if (!isAllowed) {
      setFile(null);
      setMessage(
        "Unsupported file type. Please select a PDF, DOCX, PPTX or PPT file."
      );
      setMessageType("error");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    validateAndSelectFile(selectedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();

    if (!uploading) {
      setDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    if (uploading) return;

    const droppedFile = event.dataTransfer.files?.[0];

    validateAndSelectFile(droppedFile);
  };

  const openFilePicker = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const removeSelectedFile = () => {
    if (uploading) return;

    setFile(null);
    setMessage("");
    setMessageType("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileSize = (size) => {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName) => {
    const extension = fileName
      .split(".")
      .pop()
      .toLowerCase();

    if (extension === "pdf") return "📕";

    if (extension === "docx") return "📘";

    if (extension === "ppt" || extension === "pptx") {
      return "📙";
    }

    return "📄";
  };

  const handleUpload = async () => {
    if (!file || uploading) {
      if (!file) {
        setMessage(
          "Please choose a PDF, Word or PowerPoint file first."
        );
        setMessageType("error");
      }
      return;
    }

    cancelSuccessTimer();

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      setMessage("Uploading and reading your notes...");
      setMessageType("loading");

      const response = await axios.post(
        `${API}/upload-notes`,
        formData
      );

      const extractedNotes = response.data.notes_text || "";

      if (!extractedNotes.trim()) {
        setNotesText("");
        setMessage(
          "The file was uploaded, but no readable notes were found. Please check the document."
        );
        setMessageType("error");
        return;
      }

      setNotesText(extractedNotes);

      localStorage.setItem(
        "uploadedNotes",
        extractedNotes
      );

      localStorage.setItem(
        "uploadedNotesFileName",
        file.name
      );

      setMessage(
        "Your notes have been uploaded successfully! You can now plan your study session."
      );
      setMessageType("success");

      // Notify Chatbot only after a successful upload.
      // This triggers the Study Manager popup.
      onUploadSuccess?.(true);
    } catch (error) {
      console.error("Upload error:", error);

      setMessage(
        error.response?.data?.error ||
          "There was a problem uploading your file. Please try again."
      );
      setMessageType("error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="emmy-notes-page">
      <div className="emmy-notes-card">

        {/* HEADER */}
        <div className="emmy-notes-header">
          <div className="emmy-notes-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h8" />
            </svg>
          </div>

          <h2>Upload Study Notes</h2>

          <p>
            Upload your lecture notes and turn them
            into useful study materials.
          </p>
        </div>

        {/* HIDDEN NATIVE FILE INPUT */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.ppt"
          className="emmy-file-input"
          onChange={handleFileChange}
          disabled={uploading}
          aria-label="Choose study notes document"
        />

        {/* UPLOAD AREA */}
        <div
          className={
            "emmy-upload-zone" +
            (dragging ? " dragging" : "") +
            (file ? " has-file" : "")
          }
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="emmy-upload-cloud">
            <svg
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V7" />
              <path d="m8 11 4-4 4 4" />
              <path d="M20 16.6A5 5 0 0 0 18 7h-1.4A6 6 0 0 0 5.1 8.7 4 4 0 0 0 6 16.6" />
              <path d="M6 20h12" />
            </svg>
          </div>

          <h3>
            Drag and drop your notes here
          </h3>

          <p>
            or browse your computer to select a document
          </p>

          <button
            type="button"
            className="emmy-browse-button"
            onClick={openFilePicker}
            disabled={uploading}
          >
            <span>📁</span>
            Browse Files
          </button>

          <span className="emmy-supported-types">
            Supported formats: PDF, DOCX, PPTX, PPT
          </span>
        </div>

        {/* SELECTED FILE */}
        {file && (
          <div className="emmy-selected-file">
            <div className="emmy-selected-file-icon">
              {getFileIcon(file.name)}
            </div>

            <div className="emmy-selected-file-info">
              <strong title={file.name}>
                {file.name}
              </strong>

              <span>
                {getFileSize(file.size)}
              </span>
            </div>

            <button
              type="button"
              className="emmy-remove-file"
              onClick={removeSelectedFile}
              disabled={uploading}
              title="Remove selected file"
              aria-label="Remove selected file"
            >
              ×
            </button>
          </div>
        )}

        {/* UPLOAD BUTTON */}
        <button
          type="button"
          className="emmy-upload-button"
          onClick={handleUpload}
          disabled={uploading || !file}
        >
          {uploading ? (
            <>
              <span className="emmy-upload-spinner" />
              Reading Your Notes...
            </>
          ) : (
            <>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V3" />
                <path d="m7 8 5-5 5 5" />
                <path d="M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
              </svg>

              Upload Notes
            </>
          )}
        </button>

        {/* UPLOAD STATUS */}
        {message && (
          <div
            className={`emmy-notes-message ${messageType}`}
            role="status"
          >
            <span className="emmy-message-icon">
              {messageType === "success"
                ? "✓"
                : messageType === "error"
                  ? "!"
                  : "⏳"}
            </span>

            <span>{message}</span>
          </div>
        )}

        {/* FOOTER */}
        <div className="emmy-notes-footer">
          <span>🔒</span>
          Your uploaded notes are used to prepare
          your study activities.
        </div>
      </div>
    </div>
  );
}

export default Notes;
