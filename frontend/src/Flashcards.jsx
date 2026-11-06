
import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API = "https://emmy-backend-7i0m.onrender.com";

function parseFlashcards(content) {
  if (!content) return [];

  const cards = [];

  const sections = content.split(/Flashcard\s+\d+\s*[:.)-]?/i);

  sections.forEach((section) => {
    const questionMatch = section.match(
      /Question:\s*([\s\S]*?)(?=\s*Answer:|$)/i
    );

    const answerMatch = section.match(
      /Answer:\s*([\s\S]*)/i
    );

    if (questionMatch && answerMatch) {
      const question = questionMatch[1].trim();
      const answer = answerMatch[1].trim();

      if (question && answer) {
        cards.push({
          question,
          answer
        });
      }
    }
  });

  return cards;
}

function Flashcards({ onContentReady }) {
  const [flashcards, setFlashcards] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [flippedCards, setFlippedCards] = useState([]);

  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const currentNotes = localStorage.getItem("uploadedNotes");
    const savedNotes = localStorage.getItem("emmyFlashcardsNotes");
    const savedFlashcards = localStorage.getItem("emmyGeneratedFlashcards");
    const savedFlipped = localStorage.getItem("emmyFlippedFlashcards");

    if (
      currentNotes &&
      savedNotes === currentNotes &&
      savedFlashcards
    ) {
      try {
        const cards = JSON.parse(savedFlashcards);

        if (
          Array.isArray(cards) &&
          cards.length > 0 &&
          cards.every(
            (card) =>
              card &&
              typeof card.question === "string" &&
              card.question.trim() &&
              typeof card.answer === "string" &&
              card.answer.trim()
          )
        ) {
          setFlashcards(cards);

          try {
            const flipped = JSON.parse(savedFlipped || "[]");

            setFlippedCards(
              Array.isArray(flipped)
                ? flipped.filter(
                    (index) =>
                      Number.isInteger(index) &&
                      index >= 0 &&
                      index < cards.length
                  )
                : []
            );
          } catch {
            setFlippedCards([]);
          }

          setMessage("");
          onContentReady?.(true);

          return () => {
            mountedRef.current = false;
            requestRef.current += 1;
          };
        }
      } catch (error) {
        console.error("Could not restore flashcards:", error);
      }
    }

    setFlashcards([]);
    setFlippedCards([]);
    onContentReady?.(false);

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [onContentReady]);

  const generateFlashcards = async () => {
    const notesText = localStorage.getItem("uploadedNotes");

    if (!notesText) {
      setMessage("Please upload your study notes in My notes first.");
      setFlashcards([]);
      setFlippedCards([]);

      onContentReady?.(false);
      return;
    }

    const requestId = ++requestRef.current;

    try {
      setLoading(true);
      setMessage("Generating flashcards...");

      onContentReady?.(false);

      const response = await axios.post(
        `${API}/generate-study-content`,
        {
          type: "flashcards",
          notes_text: notesText
        }
      );

      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      if (localStorage.getItem("uploadedNotes") !== notesText) {
        setFlashcards([]);
        setFlippedCards([]);
        setMessage("Your uploaded notes changed. Generate new flashcards.");
        onContentReady?.(false);
        return;
      }

      const content = response.data.content;

      let cards = [];

      if (typeof content === "string") {
        cards = parseFlashcards(content);
      } else if (Array.isArray(content)) {
        cards = content;
      } else if (Array.isArray(content?.flashcards)) {
        cards = content.flashcards;
      }

      cards = cards.filter(
        (card) =>
          card &&
          typeof card.question === "string" &&
          card.question.trim() &&
          typeof card.answer === "string" &&
          card.answer.trim()
      );

      if (cards.length === 0) {
        throw new Error(
          "No valid flashcards were generated. Please try again."
        );
      }

      setFlashcards(cards);
      setFlippedCards([]);
      setMessage("");

      localStorage.setItem(
        "emmyGeneratedFlashcards",
        JSON.stringify(cards)
      );

      localStorage.setItem(
        "emmyFlashcardsNotes",
        notesText
      );

      localStorage.setItem(
        "emmyFlippedFlashcards",
        JSON.stringify([])
      );

      onContentReady?.(true);

    } catch (error) {
      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      console.error("Flashcard generation error:", error);

      setFlashcards([]);
      setFlippedCards([]);

      localStorage.removeItem("emmyGeneratedFlashcards");
      localStorage.removeItem("emmyFlashcardsNotes");
      localStorage.removeItem("emmyFlippedFlashcards");

      setMessage(
        error.response?.data?.error ||
        error.message ||
        "Could not generate flashcards."
      );

      onContentReady?.(false);

    } finally {
      if (
        mountedRef.current &&
        requestId === requestRef.current
      ) {
        setLoading(false);
      }
    }
  };

  const toggleCard = (index) => {
    setFlippedCards((previous) => {
      const updated = previous.includes(index)
        ? previous.filter((card) => card !== index)
        : [...previous, index];

      localStorage.setItem(
        "emmyFlippedFlashcards",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  return (
    <div className="flashcards-container">
      <div className="flashcards-header">
        <h1>Flashcards</h1>

        <p>
          Test your knowledge with interactive flashcards.
        </p>

        <button
          type="button"
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

      {flashcards.length > 0 && !loading && (
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
                role="button"
                tabIndex={0}
                aria-label={`Flashcard ${index + 1}`}
                onClick={() => toggleCard(index)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    toggleCard(index);
                  }
                }}
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
