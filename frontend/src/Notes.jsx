import { useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

function Notes() {
    const [file, setFile] = useState(null);
    const [notesText, setNotesText] = useState("");
    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState("");
    const [contentType, setContentType] = useState("");

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];

        setFile(selectedFile);
        setMessage("");
        setGeneratedContent("");
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage("Please select a PDF or Word document.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        try {
            setUploading(true);
            setMessage("Uploading and reading your notes...");

            const response = await axios.post(
                `${API}/upload-notes`,
                formData
            );

            setNotesText(response.data.notes_text);
            localStorage.setItem("uploadedNotes", response.data.notes_text);

            setMessage(
                "File uploaded successfully! Your notes have been read."
            );
        } catch (error) {
            console.error(error);

            setMessage(
                error.response?.data?.error ||
                "There was a problem uploading the file."
            );
        } finally {
            setUploading(false);
        }
    };

    const generateContent = async (type) => {
        if (!notesText) {
            setMessage("Please upload your notes first.");
            return;
        }

        try {
            setGenerating(true);
            setContentType(type);
            setGeneratedContent("");

            setMessage(`Generating ${type}...`);

            const response = await axios.post(
                `${API}/generate-study-content`,
                {
                    type: type,
                    notes_text: notesText
                }
            );

            setGeneratedContent(response.data.content);

            setMessage(
                `${type} generated successfully!`
            );
        } catch (error) {
            console.error(error);

            setMessage(
                error.response?.data?.error ||
                `Could not generate ${type}.`
            );
        } finally {
            setGenerating(false);
        }
    };
    return (
        <div className="notes-container">

            <h2>Upload Study Notes</h2>

            <p>
                Upload your lecture notes in PDF or Word format.
            </p>

            <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
            />

            {file && (
                <p>
                    Selected file: {file.name}
                </p>
            )}

            <button
                onClick={handleUpload}
                disabled={uploading}
            >
                {uploading ? "Reading Notes..." : "Upload Notes"}
            </button>

            {message && (
    <p className="notes-message">
        {message}
    </p>
)}

            

            {generating && (
                <p>
                    Generating {contentType}...
                </p>
            )}

            {generatedContent && (
                <div className="generated-content">

                    <h3>
                        {contentType}
                    </h3>

                    <pre>
                        {generatedContent}
                    </pre>

                </div>
            )}

        </div>
    );
}

export default Notes;