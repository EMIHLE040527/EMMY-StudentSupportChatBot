
import { useEffect, useRef, useState } from "react";
import "./StudyBreakManager.css";

const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remainingSeconds).padStart(2, "0")}`
  );
};

const formatStudyGoal = (hours, minutes) => {
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} hr`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  return parts.join(" ") || "0 min";
};

export default function StudyBreakManager({
  notesReady = false,
  isStudying = false,
  contentReady = false,
  onOpenGame,
  resumeSignal = 0,
  uploadSignal = 0,
  breakEndAt = null
}) {
  // Study goal settings
  const [studyHours, setStudyHours] = useState(1);
  const [studyMinutes, setStudyMinutes] = useState(30);

  // Break settings
  const [breakFrequency, setBreakFrequency] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);

  // Study session settings
  const [configured, setConfigured] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phase, setPhase] = useState("ready");
  const [manuallyPaused, setManuallyPaused] = useState(false);

  // Timer values
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [nextBreakAt, setNextBreakAt] = useState(25 * 60);

  // Coloring Game break timer
  const [breakEndsAt, setBreakEndsAt] = useState(null);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);

  // References
  const lastTickRef = useRef(null);
  const activeSecondsRef = useRef(0);

  // Remember the upload signal present when the
  // component first mounts.
  // This prevents the popup from opening on login.
  const lastUploadSignalRef = useRef(uploadSignal);
  const lastResumeSignalRef = useRef(resumeSignal);

  // Prevent a previous upload from being treated
  // as a new upload.
  const notesReadyRef = useRef(notesReady);

  const goalSeconds =
    studyHours * 3600 + studyMinutes * 60;

  const breakEverySeconds = breakFrequency * 60;

  const remainingGoalSeconds = Math.max(
    0,
    Math.ceil(goalSeconds - elapsedSeconds)
  );

  const remainingToBreak = Math.max(
    0,
    Math.ceil(
      Math.min(
        goalSeconds - elapsedSeconds,
        nextBreakAt - elapsedSeconds
      )
    )
  );

  const canCount =
    notesReady &&
    configured &&
    isStudying &&
    contentReady &&
    !manuallyPaused &&
    !settingsOpen &&
    phase === "studying";

  /*
   * ========================================
   * FIX 1:
   * DO NOT OPEN THE POPUP JUST BECAUSE
   * NOTES ALREADY EXIST
   * ========================================
   */

  useEffect(() => {
    if (!notesReady && notesReadyRef.current) {
      setSettingsOpen(false);
      setConfigured(false);
      setPhase("ready");
      setManuallyPaused(false);

      setElapsedSeconds(0);
      setNextBreakAt(breakFrequency * 60);

      setBreakEndsAt(null);
      setBreakSecondsLeft(0);

      activeSecondsRef.current = 0;
      lastTickRef.current = null;
    }

    notesReadyRef.current = notesReady;
  }, [notesReady, breakFrequency]);

  /*
   * ========================================
   * FIX 2:
   * SHOW THE POPUP ONLY AFTER A NEW
   * SUCCESSFUL NOTES UPLOAD
   * ========================================
   */

  useEffect(() => {
    // No new upload has happened.
    if (
      uploadSignal === lastUploadSignalRef.current
    ) {
      return;
    }

    // Record the new upload signal.
    lastUploadSignalRef.current = uploadSignal;

    // Do not open anything if there are no notes.
    if (!notesReady) {
      return;
    }

    // A new successful upload has happened.
    // Reset the previous study session.
    setConfigured(false);
    setPhase("ready");
    setManuallyPaused(false);

    setElapsedSeconds(0);
    activeSecondsRef.current = 0;

    setNextBreakAt(breakFrequency * 60);

    setBreakEndsAt(null);
    setBreakSecondsLeft(0);

    lastTickRef.current = null;

    // This is the only automatic trigger
    // for opening the study planner.
    setSettingsOpen(true);
  }, [
    uploadSignal,
    notesReady,
    breakFrequency
  ]);

  /*
   * ========================================
   * RETURNING FROM COLORING GAME
   * ========================================
   */

  useEffect(() => {
    if (
      resumeSignal === lastResumeSignalRef.current
    ) {
      return;
    }

    lastResumeSignalRef.current = resumeSignal;

    if (!notesReady || !configured) {
      return;
    }

    setNextBreakAt(
      activeSecondsRef.current +
      breakEverySeconds
    );

    setBreakEndsAt(null);
    setBreakSecondsLeft(0);
    setPhase("studying");
  }, [
    resumeSignal,
    notesReady,
    configured,
    breakEverySeconds
  ]);

  /*
   * ========================================
   * SYNCHRONISE ACTIVE BREAK DEADLINE
   * ========================================
   */

  useEffect(() => {
    if (
      phase === "onBreak" &&
      breakEndAt !== null
    ) {
      setBreakEndsAt(breakEndAt);
    }
  }, [phase, breakEndAt]);

  /*
   * ========================================
   * START STUDYING WHEN CONTENT IS READY
   * ========================================
   */

  useEffect(() => {
    if (
      notesReady &&
      configured &&
      isStudying &&
      contentReady &&
      phase === "ready" &&
      !settingsOpen
    ) {
      setPhase("studying");
    }
  }, [
    notesReady,
    configured,
    isStudying,
    contentReady,
    phase,
    settingsOpen
  ]);

  /*
   * ========================================
   * ACTIVE STUDY COUNTDOWN
   * ========================================
   */

  useEffect(() => {
    if (!canCount) {
      lastTickRef.current = null;
      return undefined;
    }

    lastTickRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();

      const elapsed = Math.max(
        0,
        (now - lastTickRef.current) / 1000
      );

      lastTickRef.current = now;

      const updated = Math.min(
        goalSeconds,
        activeSecondsRef.current + elapsed
      );

      activeSecondsRef.current = updated;
      setElapsedSeconds(Math.floor(updated));

      if (updated >= goalSeconds) {
        setPhase("completed");
      } else if (updated >= nextBreakAt) {
        setPhase("breakDue");
      }
    }, 250);

    return () => {
      clearInterval(timer);
      lastTickRef.current = null;
    };
  }, [
    canCount,
    goalSeconds,
    nextBreakAt
  ]);

  /*
   * ========================================
   * BREAK COUNTDOWN
   * ========================================
   */

  useEffect(() => {
    if (
      phase !== "onBreak" ||
      breakEndsAt === null
    ) {
      return undefined;
    }

    const updateBreakCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (breakEndsAt - Date.now()) / 1000
        )
      );

      setBreakSecondsLeft(remaining);
    };

    updateBreakCountdown();

    const timer = setInterval(
      updateBreakCountdown,
      1000
    );

    return () => clearInterval(timer);
  }, [
    phase,
    breakEndsAt
  ]);

  /*
   * ========================================
   * SAVE STUDY SESSION
   * ========================================
   */

  const saveSettings = (event) => {
    event.preventDefault();

    const validGoal =
      Number.isInteger(studyHours) &&
      Number.isInteger(studyMinutes) &&
      studyHours >= 0 &&
      studyHours <= 24 &&
      studyMinutes >= 0 &&
      studyMinutes <= 59 &&
      goalSeconds >= 60 &&
      goalSeconds <= 24 * 3600;

    const validBreak =
      Number.isInteger(breakFrequency) &&
      breakFrequency >= 1 &&
      breakFrequency <= 240 &&
      Number.isInteger(breakDuration) &&
      breakDuration >= 1 &&
      breakDuration <= 120;

    if (!validGoal || !validBreak) {
      alert(
        "Please enter a valid study goal and break settings."
      );
      return;
    }

    setNextBreakAt(
      activeSecondsRef.current +
      breakFrequency * 60
    );

    setConfigured(true);
    setSettingsOpen(false);
  };

  /*
   * ========================================
   * PAUSE AND RESUME
   * ========================================
   */

  const togglePause = () => {
    if (
      phase === "completed" ||
      phase === "onBreak" ||
      phase === "breakDue"
    ) {
      return;
    }

    setManuallyPaused((previous) => !previous);
  };

  /*
   * ========================================
   * SKIP BREAK
   * ========================================
   */

  const keepStudying = () => {
    setNextBreakAt(
      activeSecondsRef.current +
      breakEverySeconds
    );

    setPhase("studying");
  };

  /*
   * ========================================
   * OPEN COLORING GAME
   * ========================================
   */

  const goToGame = () => {
    setBreakEndsAt(null);
    setBreakSecondsLeft(breakDuration * 60);
    setPhase("onBreak");

    onOpenGame?.({
      durationMinutes: breakDuration
    });
  };

  /*
   * ========================================
   * START NEW STUDY SESSION MANUALLY
   * ========================================
   */

  const startNewSession = () => {
    setPhase("ready");
    setManuallyPaused(false);

    setElapsedSeconds(0);
    activeSecondsRef.current = 0;

    setNextBreakAt(breakEverySeconds);

    setBreakEndsAt(null);
    setBreakSecondsLeft(0);

    // The student explicitly requested a new session.
    setSettingsOpen(true);
  };

  /*
   * ========================================
   * TIMER STATUS
   * ========================================
   */

  const getTimerStatus = () => {
    if (phase === "completed") {
      return "Study goal completed";
    }

    if (phase === "onBreak") {
      return breakEndsAt === null
        ? "Coloring Game break"
        : `Break: ${formatClock(breakSecondsLeft)} left`;
    }

    if (phase === "breakDue") {
      return "Time for a break";
    }

    if (manuallyPaused) {
      return "Paused";
    }

    if (settingsOpen) {
      return "Settings open";
    }

    if (!isStudying) {
      return "Paused - outside study tools";
    }

    if (!contentReady) {
      return "Waiting for study content";
    }

    if (canCount) {
      return "Studying";
    }

    return "Ready to study";
  };

  /*
   * ========================================
   * HIDE MANAGER WHEN NO NOTES EXIST
   * ========================================
   */

  if (!notesReady) {
    return null;
  }

  return (
    <div className="emmy-study-manager-root">

      {/* STUDY TIMER */}
      {configured && (
        <div
          className="emmy-study-timer"
          role="timer"
          aria-label="Study timer"
        >
          <div className="emmy-timer-title">
            ⏱ Study Timer
          </div>

          <strong className="emmy-timer-clock">
            {formatClock(remainingGoalSeconds)}
          </strong>

          <div className="emmy-timer-details">
            <span>
              Goal:{" "}
              {formatStudyGoal(
                studyHours,
                studyMinutes
              )}
            </span>

            <span>
              Studied:{" "}
              {formatClock(elapsedSeconds)}
            </span>

            <span>
              Next break:{" "}
              {formatClock(remainingToBreak)}
            </span>
          </div>

          <span className="emmy-timer-status">
            {getTimerStatus()}
          </span>

          <div className="emmy-timer-controls">
            <button
              type="button"
              className="emmy-timer-pause"
              onClick={togglePause}
              disabled={
                phase === "completed" ||
                phase === "onBreak" ||
                phase === "breakDue"
              }
            >
              {manuallyPaused
                ? "▶ Resume"
                : "⏸ Pause"}
            </button>

            <button
              type="button"
              className="emmy-timer-settings"
              onClick={() => setSettingsOpen(true)}
              disabled={
                phase === "completed" ||
                phase === "onBreak"
              }
            >
              ⚙ Settings
            </button>
          </div>
        </div>
      )}

      {/* STUDY SESSION POPUP */}
      {settingsOpen && (
        <div className="emmy-study-overlay">
          <section
            className="emmy-study-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-settings-title"
          >
            <h2 id="study-settings-title">
              Plan your study session
            </h2>

            <p>
              Your timer will start automatically
              when your study content is ready.
            </p>

            <form
              onSubmit={saveSettings}
              className="emmy-study-form"
            >
              <div className="emmy-study-goal-section">
                <label>
                  Study goal
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "8px"
                  }}
                >
                  <label style={{ flex: 1 }}>
                    Hours

                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      required
                      value={studyHours}
                      onChange={(event) =>
                        setStudyHours(
                          Number(event.target.value)
                        )
                      }
                    />
                  </label>

                  <label style={{ flex: 1 }}>
                    Minutes

                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      required
                      value={studyMinutes}
                      onChange={(event) =>
                        setStudyMinutes(
                          Number(event.target.value)
                        )
                      }
                    />
                  </label>
                </div>

                <p
                  style={{
                    marginTop: "10px",
                    fontSize: "14px"
                  }}
                >
                  Your study goal:{" "}
                  <strong>
                    {formatStudyGoal(
                      studyHours,
                      studyMinutes
                    )}
                  </strong>
                </p>
              </div>

              <label>
                Break after every (minutes)

                <input
                  type="number"
                  min="1"
                  max="240"
                  step="1"
                  required
                  value={breakFrequency}
                  onChange={(event) =>
                    setBreakFrequency(
                      Number(event.target.value)
                    )
                  }
                />
              </label>

              <label>
                Break duration (minutes)

                <input
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  required
                  value={breakDuration}
                  onChange={(event) =>
                    setBreakDuration(
                      Number(event.target.value)
                    )
                  }
                />
              </label>

              <button type="submit">
                Save study session
              </button>

              {configured && (
                <button
                  type="button"
                  className="emmy-secondary-button"
                  onClick={() =>
                    setSettingsOpen(false)
                  }
                >
                  Cancel
                </button>
              )}
            </form>
          </section>
        </div>
      )}

      {/* BREAK REMINDER */}
      {configured &&
        phase === "breakDue" &&
        !settingsOpen && (
          <div className="emmy-study-overlay">
            <section
              className="emmy-study-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="break-title"
            >
              <h2 id="break-title">
                ☕ Time for a break!
              </h2>

              <p>
                You've reached your study interval.
                Take a {breakDuration}-minute break
                or continue studying.
              </p>

              <div className="emmy-study-actions">
                <button
                  type="button"
                  onClick={goToGame}
                >
                  Go to break game
                </button>

                <button
                  type="button"
                  className="emmy-secondary-button"
                  onClick={keepStudying}
                >
                  Continue studying
                </button>
              </div>
            </section>
          </div>
        )}

      {/* COMPLETED STUDY GOAL */}
      {configured &&
        phase === "completed" && (
          <div className="emmy-study-overlay">
            <section
              className="emmy-study-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="goal-title"
            >
              <h2 id="goal-title">
                🎉 Study goal completed!
              </h2>

              <p>
                You completed{" "}
                {formatStudyGoal(
                  studyHours,
                  studyMinutes
                )}{" "}
                of active studying.
              </p>

              <button
                type="button"
                onClick={startNewSession}
              >
                Start a new session
              </button>
            </section>
          </div>
        )}

    </div>
  );
}
