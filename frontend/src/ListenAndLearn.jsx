
import React, { useEffect, useRef, useState } from "react";
import "./ListenAndLearn.css";

const API = "http://127.0.0.1:5000";

const normaliseSpeaker = (speaker) => {
  const value = String(speaker || "").toLowerCase();

  if (
    value.includes("student") ||
    value.includes("learner") ||
    value.includes("sophia")
  ) {
    return "Student";
  }

  return "Tutor";
};

const getVoices = () => {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices() || [];
};

const getTutorVoice = () => {
  const voices = getVoices();

  const femaleVoices = voices.filter((voice) => {
    const name = voice.name.toLowerCase();

    return (
      voice.lang.toLowerCase().startsWith("en") &&
      (
        name.includes("jenny") ||
        name.includes("aria") ||
        name.includes("samantha") ||
        name.includes("ava") ||
        name.includes("female") ||
        name.includes("zira") ||
        name.includes("susan")
      )
    );
  });

  if (femaleVoices.length > 0) {
    return femaleVoices[0];
  }

  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en")
  );

  if (englishVoices.length > 0) {
    return englishVoices[0];
  }

  return voices.length > 0 ? voices[0] : null;
};

const getStudentVoice = () => {
  const voices = getVoices();

  const femaleVoices = voices.filter((voice) => {
    const name = voice.name.toLowerCase();

    return (
      voice.lang.toLowerCase().startsWith("en") &&
      (
        name.includes("samantha") ||
        name.includes("ava") ||
        name.includes("zira") ||
        name.includes("jenny") ||
        name.includes("aria") ||
        name.includes("female") ||
        name.includes("susan")
      )
    );
  });

  if (femaleVoices.length >= 2) {
    return femaleVoices[1];
  }

  if (femaleVoices.length === 1) {
    const otherEnglishVoice = voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith("en") &&
        voice.name !== femaleVoices[0].name
    );

    if (otherEnglishVoice) {
      return otherEnglishVoice;
    }
  }

  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en")
  );

  if (englishVoices.length > 1) {
    return englishVoices[1];
  }

  return englishVoices.length > 0
    ? englishVoices[0]
    : voices.length > 0
    ? voices[0]
    : null;
};

function ListenAndLearn({ onContentReady }) {
  const [conversation, setConversation] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");

  const speechRef = useRef(null);
  const timerRef = useRef(null);
  const startTimerRef = useRef(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const conversationRef = useRef([]);
  const playbackRef = useRef(0);

  const currentLine = conversation[currentIndex];

  const clearPlaybackTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  };

  const stopSpeech = () => {
    playbackRef.current += 1;
    clearPlaybackTimers();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    speechRef.current = null;
    setIsPlaying(false);
  };

  useEffect(() => {
    mountedRef.current = true;

    const loadVoices = () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
      }
    };

    loadVoices();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        loadVoices
      );
    }

    const currentNotes = localStorage.getItem("uploadedNotes");
    const savedNotes = localStorage.getItem("emmyListenLearnNotes");
    const savedLesson = localStorage.getItem("emmyListenLearnLesson");

    if (
      currentNotes &&
      savedNotes === currentNotes &&
      savedLesson
    ) {
      try {
        const restored = JSON.parse(savedLesson);

        if (
          Array.isArray(restored) &&
          restored.length > 0 &&
          restored.every(
            (line) =>
              line &&
              typeof line.text === "string" &&
              line.text.trim()
          )
        ) {
          conversationRef.current = restored;
          setConversation(restored);

          const savedIndex = Number(
            localStorage.getItem("emmyListenLearnIndex") || 0
          );

          const index = Number.isInteger(savedIndex)
            ? Math.max(0, Math.min(savedIndex, restored.length - 1))
            : 0;

          setCurrentIndex(index);
          onContentReady?.(true);
        } else {
          onContentReady?.(false);
        }
      } catch (err) {
        console.error("Could not restore lesson:", err);
        onContentReady?.(false);
      }
    } else {
      onContentReady?.(false);
    }

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      playbackRef.current += 1;

      clearPlaybackTimers();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          loadVoices
        );
      }
    };
  }, [onContentReady]);

  const createLesson = async () => {
    const notes = localStorage.getItem("uploadedNotes");

    if (!notes || notes.trim() === "") {
      setError("Please upload your study notes first.");
      onContentReady?.(false);
      return;
    }

    const requestId = ++requestRef.current;

    stopSpeech();
    setLoading(true);
    setError("");
    setConversation([]);
    conversationRef.current = [];
    setCurrentIndex(0);
    onContentReady?.(false);

    try {
      const response = await fetch(
        `${API}/generate-listen-learn`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            notes_text: notes
          })
        }
      );

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();

      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      if (localStorage.getItem("uploadedNotes") !== notes) {
        setError(
          "Your uploaded notes changed. Please create a new lesson."
        );
        onContentReady?.(false);
        return;
      }

      let generatedConversation = data.conversation || [];

      if (!Array.isArray(generatedConversation)) {
        generatedConversation = [];
      }

      generatedConversation = generatedConversation
        .map((line) => ({
          speaker: normaliseSpeaker(
            line.speaker || line.role || line.character || "Tutor"
          ),
          text: String(
            line.text || line.message || line.content || ""
          ).trim()
        }))
        .filter((line) => line.text !== "");

      if (generatedConversation.length === 0) {
        throw new Error(
          "The AI did not return a conversation. Please try again."
        );
      }

      conversationRef.current = generatedConversation;
      setConversation(generatedConversation);
      setCurrentIndex(0);

      localStorage.setItem(
        "emmyListenLearnLesson",
        JSON.stringify(generatedConversation)
      );

      localStorage.setItem(
        "emmyListenLearnNotes",
        notes
      );

      localStorage.setItem(
        "emmyListenLearnIndex",
        "0"
      );

      setError("");
      onContentReady?.(true);

    } catch (err) {
      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      console.error("Listen & Learn error:", err);

      setError(
        err.message === "The AI did not return a conversation. Please try again."
          ? err.message
          : "Something went wrong while creating the lesson. Please make sure your backend is running."
      );

      setConversation([]);
      conversationRef.current = [];

      localStorage.removeItem("emmyListenLearnLesson");
      localStorage.removeItem("emmyListenLearnNotes");
      localStorage.removeItem("emmyListenLearnIndex");

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

  const speakLine = (line, index, playbackId) => {
    if (
      !line ||
      !line.text ||
      !mountedRef.current ||
      playbackId !== playbackRef.current
    ) {
      return;
    }

    if (!("speechSynthesis" in window)) {
      setError("Speech playback is not supported in this browser.");
      return;
    }

    const speaker = normaliseSpeaker(line.speaker);
    const isTutor = speaker === "Tutor";

    const utterance = new SpeechSynthesisUtterance(line.text);

    const voice = isTutor
      ? getTutorVoice()
      : getStudentVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }

    if (isTutor) {
      utterance.rate = 0.91;
      utterance.pitch = 1.02;
      utterance.volume = 1;
    } else {
      utterance.rate = 0.98;
      utterance.pitch = 1.16;
      utterance.volume = 1;
    }

    utterance.onstart = () => {
      if (playbackId === playbackRef.current) {
        setIsPlaying(true);
      }
    };

    utterance.onend = () => {
      if (
        !mountedRef.current ||
        playbackId !== playbackRef.current
      ) {
        return;
      }

      setIsPlaying(false);

      const lines = conversationRef.current;

      if (index < lines.length - 1) {
        timerRef.current = setTimeout(() => {
          if (playbackId !== playbackRef.current) {
            return;
          }

          const nextIndex = index + 1;

          setCurrentIndex(nextIndex);

          localStorage.setItem(
            "emmyListenLearnIndex",
            String(nextIndex)
          );

          startTimerRef.current = setTimeout(() => {
            speakLine(
              lines[nextIndex],
              nextIndex,
              playbackId
            );
          }, 250);
        }, 900);
      } else {
        speechRef.current = null;
      }
    };

    utterance.onerror = () => {
      if (playbackId === playbackRef.current) {
        setIsPlaying(false);
        speechRef.current = null;
      }
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const playFromIndex = (index) => {
    const lines = conversationRef.current;

    if (
      lines.length === 0 ||
      index < 0 ||
      index >= lines.length
    ) {
      return;
    }

    stopSpeech();

    const playbackId = playbackRef.current;

    setCurrentIndex(index);

    localStorage.setItem(
      "emmyListenLearnIndex",
      String(index)
    );

    startTimerRef.current = setTimeout(() => {
      speakLine(lines[index], index, playbackId);
    }, 400);
  };

  const startLesson = () => {
    playFromIndex(0);
  };

  const pauseLesson = () => {
    if (
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    }
  };

  const resumeLesson = () => {
    if (
      "speechSynthesis" in window &&
      window.speechSynthesis.paused
    ) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    }
  };

  const stopLesson = () => {
    stopSpeech();
  };

  const restartLesson = () => {
    playFromIndex(0);
  };

  const nextLine = () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex < conversationRef.current.length) {
      playFromIndex(nextIndex);
    }
  };

  const speakerName = currentLine
    ? normaliseSpeaker(currentLine.speaker)
    : "";

  const isTutor = speakerName === "Tutor";
  const isStudent = speakerName === "Student";

  let phaseText = "";

  if (isTutor) {
    phaseText = "👩‍🏫 Tutor is explaining";
  } else if (isStudent) {
    phaseText = "👩‍🎓 Student is asking a question";
  }

  const studentCharacterClass =
    "character-zone student-zone" +
    (isStudent && isPlaying ? " active-character" : "");

  const tutorCharacterClass =
    "character-zone tutor-zone" +
    (isTutor && isPlaying ? " active-character" : "");

  const bubbleClass =
    "speech-bubble " +
    (isTutor ? "tutor-bubble" : "student-bubble");

  const progressWidth =
    conversation.length > 0
      ? ((currentIndex + 1) / conversation.length) * 100
      : 0;

  return (
    <div className="listen-learn-page">
      <div className="listen-header">
        <div>
          <h1>🎧 Listen & Learn</h1>

          <p>
            The tutor explains your notes, then the student
            asks one question at a time.
          </p>
        </div>

        <button
          type="button"
          className="create-lesson-button"
          onClick={createLesson}
          disabled={loading}
        >
          {loading ? "Creating Lesson..." : "Create Lesson"}
        </button>
      </div>

      {error && (
        <div className="listen-error">
          {error}
        </div>
      )}

      {phaseText && (
        <div className="lesson-phase">
          {phaseText}
        </div>
      )}

      <div className="lesson-scene-container">
        <div className="anime-scene">
          <img
            src="/images/listen-learn-scene.png"
            alt="Female tutor teaching female student"
            className="anime-scene-image"
          />

          <div className={studentCharacterClass}>
            <div className="character-label student-label">
              👩‍🎓 Student
            </div>
          </div>

          <div className={tutorCharacterClass}>
            <div className="character-label tutor-label">
              👩‍🏫 Tutor
            </div>
          </div>

          {currentLine && (
            <div className={bubbleClass}>
              <div className="bubble-speaker">
                {isTutor
                  ? "👩‍🏫 Tutor"
                  : "👩‍🎓 Student"}
              </div>

              <div className="bubble-text">
                {currentLine.text}
              </div>
            </div>
          )}
        </div>
      </div>

      {currentLine && (
        <div className="current-speaker">
          <span>
            {isTutor
              ? "👩‍🏫 Tutor is speaking"
              : "👩‍🎓 Student is speaking"}
          </span>

          {isPlaying && (
            <div className="sound-wave">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
      )}

      {conversation.length > 0 && (
        <div className="lesson-controls">
          <button type="button" onClick={startLesson}>
            ▶ Start
          </button>

          <button type="button" onClick={pauseLesson}>
            ⏸ Pause
          </button>

          <button type="button" onClick={resumeLesson}>
            ▶ Resume
          </button>

          <button type="button" onClick={restartLesson}>
            ↻ Restart
          </button>

          <button type="button" onClick={stopLesson}>
            ■ Stop
          </button>

          <button type="button" onClick={nextLine}>
            Next →
          </button>
        </div>
      )}

      {conversation.length > 0 && (
        <div className="lesson-progress">
          <div className="progress-text">
            {currentIndex + 1}
            {" / "}
            {conversation.length}
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: progressWidth + "%"
              }}
            ></div>
          </div>
        </div>
      )}

      {!loading &&
        conversation.length === 0 &&
        !error && (
          <div className="listen-empty">
            <div className="empty-icon">
              🎧
            </div>

            <h2>
              Your Listen & Learn lesson
              is ready to be created.
            </h2>

            <p>
              Upload your study notes and click{" "}
              <strong>Create Lesson</strong>{" "}
              to begin.
            </p>
          </div>
        )}
    </div>
  );
}

export default ListenAndLearn;
