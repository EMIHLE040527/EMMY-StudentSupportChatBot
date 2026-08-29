import { useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

function Flashcards() {
  const [flashcards, setFlashcards] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [flippedCards, setFlippedCards] = useState([]);

  const generateFlashcards = async () => {
    const notesText = localStorage.getItem("uploadedNotes");

    if (!notesText) {
      setMessage("Please upload your study notes in My notes first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Generating flashcards...");

      const response = await axios.post(
        `${API}/generate-study-content`,
        {
          type: "flashcards",
          notes_text: notesText
        }
      );

      const content = response.data.content;

      const cards = parseFlashcards(content);

      setFlashcards(cards);
      setFlippedCards([]);
      setMessage("");

    } catch (error) {
      console.error(error);

      setMessage(
        error.response?.data?.error ||
        "Could not generate flashcards."
      );
    } finally {
      setLoading(false);
    }
  };

  const parseFlashcards = (content) => {
    if (!content) return [];

    const cards = [];

    // Split the generated content using "Flashcard 1", "Flashcard 2", etc.
    const sections = content.split(/Flashcard\s+\d+/i);

    sections.forEach((section) => {
      const questionMatch = section.match(
        /Question:\s*([\s\S]*?)(?=\s*Answer:|$)/i
      );

      const answerMatch = section.match(
        /Answer:\s*([\s\S]*)/i
      );

      if (questionMatch && answerMatch) {
        cards.push({
          question: questionMatch[1].trim(),
          answer: answerMatch[1].trim()
        });
      }
    });

    return cards;
  };

  const toggleCard = (index) => {
    setFlippedCards((previous) =>
      previous.includes(index)
        ? previous.filter((card) => card !== index)
        : [...previous, index]
    );
  };

  return (
    <div className="flashcards-container">

      <div className="flashcards-header">
        <h1>Flashcards</h1>

        <p>
          Test your knowledge with interactive flashcards.
        </p>

        <button
          className="generate-flashcards-button"
          onClick={generateFlashcards}
          disabled={loading}
        >
          {loading
            ? "Generating Flashcards..."
            : "Generate Flashcards"}
        </button>
      </div>

      {message && (
        <div className="flashcards-message">
          {message}
        </div>
      )}

      {flashcards.length > 0 && (
        <>
          <h2 className="flashcards-title">
            Your Flashcards
          </h2>

          <p className="flip-instruction">
            Click a card to reveal the answer
          </p>

          <div className="flashcards-grid">

            {flashcards.map((card, index) => (

              <div
                className="flashcard-wrapper"
                key={index}
                onClick={() => toggleCard(index)}
              >

                <div
                  className={
                    "flashcard " +
                    (
                      flippedCards.includes(index)
                        ? "flipped"
                        : ""
                    )
                  }
                >

                  {/* FRONT */}

                  <div className="flashcard-face flashcard-front">

                    <div className="card-label">
                      QUESTION
                    </div>

                    <div className="card-number">
                      {index + 1}
                    </div>

                    <p className="flashcard-question">
                      {card.question}
                    </p>

                    <div className="flip-hint">
                      Click to reveal answer ↻
                    </div>

                  </div>


                  {/* BACK */}

                  <div className="flashcard-face flashcard-back">

                    <div className="card-label">
                      ANSWER
                    </div>

                    <div className="card-number">
                      {index + 1}
                    </div>

                    <p className="flashcard-answer">
                      {card.answer}
                    </p>

                    <div className="flip-hint">
                      Click to see question ↻
                    </div>

                  </div>

                </div>

              </div>

            ))}

          </div>
        </>
      )}

    </div>
  );
}

export default Flashcards;