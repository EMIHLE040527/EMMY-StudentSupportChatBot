
import { useEffect, useState } from "react";
import axios from "axios";
import Markdown from "./Markdown";

const API = "http://127.0.0.1:5000";

function Summary({ onContentReady }) {
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedSummary = localStorage.getItem("emmyGeneratedSummary");
    const savedNotes = localStorage.getItem("emmySummaryNotes");
    const currentNotes = localStorage.getItem("uploadedNotes");

    if (
      savedSummary &&
      savedNotes &&
      currentNotes &&
      savedNotes === currentNotes
    ) {
      setSummary(savedSummary);
      onContentReady?.(true);
    } else {
      setSummary("");
      onContentReady?.(false);
    }
  }, [onContentReady]);

  const generateSummary = async () => {
    const notesText = localStorage.getItem("uploadedNotes");

    if (!notesText) {
      setSummary("");
      setMessage("Please upload your study notes in My notes first.");
      onContentReady?.(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("Generating your study summary...");

      onContentReady?.(false);

      const response = await axios.post(
        `${API}/generate-study-content`,
        {
          type: "summary",
          notes_text: notesText
        }
      );

      const generatedSummary = response.data.content;

      if (
        typeof generatedSummary !== "string" ||
        !generatedSummary.trim()
      ) {
        throw new Error("No summary was generated.");
      }

      setSummary(generatedSummary);
      setMessage("");

      localStorage.setItem(
        "emmyGeneratedSummary",
        generatedSummary
      );

      localStorage.setItem(
        "emmySummaryNotes",
        notesText
      );

      onContentReady?.(true);

    } catch (error) {
      console.error(error);

      setSummary("");

      localStorage.removeItem("emmyGeneratedSummary");
      localStorage.removeItem("emmySummaryNotes");

      setMessage(
        error.response?.data?.error ||
        error.message ||
        "Could not generate the summary."
      );

      onContentReady?.(false);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summary-container">

      <div className="summary-header">
        <div>
          <p className="summary-label">
            STUDY TOOL
          </p>

          <h1>Study Summary</h1>

          <p className="summary-subtitle">
            Turn your study notes into a clear and
            easy-to-understand summary.
          </p>
        </div>

        <button
          className="generate-summary-button"
          onClick={generateSummary}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Summary"}
        </button>
      </div>

      {message && (
        <div className="summary-message">
          {message}
        </div>
      )}

      {summary && (
        <div className="summary-box">

          <div className="summary-box-header">
            <div>
              <p className="summary-box-label">
                YOUR STUDY NOTES
              </p>

              <h2>Generated Summary</h2>
            </div>
          </div>

          <div className="summary-content">
            <Markdown text={summary} />
          </div>

        </div>
      )}

    </div>
  );
}

export default Summary;
