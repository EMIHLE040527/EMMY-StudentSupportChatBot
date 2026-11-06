
import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "https://emmy-backend-7i0m.onrender.com";
const STORAGE_KEY = "emmyTimedTestSession";

function getSavedSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const currentNotes = localStorage.getItem("uploadedNotes");

    if (!saved || !currentNotes) {
      return null;
    }

    const session = JSON.parse(saved);

    if (
      session.notesText !== currentNotes ||
      !Array.isArray(session.questions) ||
      session.questions.length === 0
    ) {
      return null;
    }

    return session;
  } catch (error) {
    console.error("Could not restore timed test:", error);
    return null;
  }
}

function TimedTest({ onContentReady }) {
  const [savedSession] = useState(getSavedSession);

  const [minutes, setMinutes] = useState(
    savedSession?.minutes || 30
  );

  const [timeLeft, setTimeLeft] = useState(
    savedSession?.timeLeft ?? 30 * 60
  );

  const [numQuestions, setNumQuestions] = useState(
    savedSession?.numQuestions || 10
  );

  const [isRunning, setIsRunning] = useState(
    Boolean(savedSession?.isRunning && !savedSession?.submitted)
  );

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [questions, setQuestions] = useState(
    savedSession?.questions || []
  );

  const [currentQuestion, setCurrentQuestion] = useState(
    savedSession?.currentQuestion || 0
  );

  const [answers, setAnswers] = useState(
    savedSession?.answers || {}
  );

  const [results, setResults] = useState(
    savedSession?.results || []
  );

  const [message, setMessage] = useState(
    savedSession?.message || ""
  );

  const [submitted, setSubmitted] = useState(
    Boolean(savedSession?.submitted)
  );

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const autoSubmitRef = useRef(false);

  const notesText = localStorage.getItem("uploadedNotes");

  const hasQuestions = questions.length > 0;

  const contentIsReady =
    hasQuestions &&
    !loading &&
    !submitting &&
    (
      isRunning ||
      (submitted && results.length > 0)
    );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    onContentReady?.(contentIsReady);
  }, [contentIsReady, onContentReady]);

  useEffect(() => {
    if (!hasQuestions) {
      return;
    }

    const session = {
      notesText,
      minutes,
      timeLeft,
      numQuestions,
      isRunning,
      questions,
      currentQuestion,
      answers,
      results,
      message,
      submitted
    };

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error("Could not save timed test:", error);
    }
  }, [
    notesText,
    minutes,
    timeLeft,
    numQuestions,
    isRunning,
    questions,
    currentQuestion,
    answers,
    results,
    message,
    submitted,
    hasQuestions
  ]);

  useEffect(() => {
    if (
      !isRunning ||
      submitted ||
      submitting ||
      !hasQuestions
    ) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) =>
        previousTime > 0
          ? previousTime - 1
          : 0
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isRunning,
    submitted,
    submitting,
    hasQuestions
  ]);

  useEffect(() => {
    if (
      isRunning &&
      timeLeft <= 0 &&
      !submitted &&
      !submitting &&
      !autoSubmitRef.current
    ) {
      autoSubmitRef.current = true;
      submitTest();
    }
  }, [
    timeLeft,
    isRunning,
    submitted,
    submitting
  ]);

  const startTest = async () => {
    const currentNotes = localStorage.getItem("uploadedNotes");

    if (!currentNotes) {
      setMessage(
        "Please upload your study notes in My notes first."
      );

      onContentReady?.(false);
      return;
    }

    const requestId = ++requestRef.current;

    setIsRunning(false);
    setLoading(true);
    setSubmitted(false);
    setQuestions([]);
    setAnswers({});
    setResults([]);
    setCurrentQuestion(0);

    setMessage(
      "Creating your examination from the uploaded notes..."
    );

    onContentReady?.(false);

    try {
      localStorage.removeItem(STORAGE_KEY);

      const response = await axios.post(
        `${API}/generate-timed-test`,
        {
          notes_text: currentNotes,
          num_questions: numQuestions
        }
      );

      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      if (
        localStorage.getItem("uploadedNotes") !== currentNotes
      ) {
        setMessage(
          "Your uploaded notes changed. Please create a new test."
        );
        onContentReady?.(false);
        return;
      }

      const generatedQuestions =
        response.data.questions || [];

      if (
        !Array.isArray(generatedQuestions) ||
        generatedQuestions.length === 0
      ) {
        throw new Error(
          "No questions were generated. Please try again."
        );
      }

      setQuestions(generatedQuestions);
      setCurrentQuestion(0);
      setAnswers({});
      setResults([]);
      setSubmitted(false);
      setTimeLeft(minutes * 60);
      setMessage("");
      setIsRunning(true);

      autoSubmitRef.current = false;

      onContentReady?.(true);

    } catch (error) {
      if (
        !mountedRef.current ||
        requestId !== requestRef.current
      ) {
        return;
      }

      console.error("TEST GENERATION ERROR:", error);

      setQuestions([]);
      setIsRunning(false);

      setMessage(
        error.response?.data?.error ||
        error.message ||
        "Could not create the timed test."
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

  const selectAnswer = (answer) => {
    if (
      submitted ||
      submitting ||
      !isRunning
    ) {
      return;
    }

    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion]: answer
    }));
  };

  const formatTime = () => {
    const mins = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return `${mins}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((previous) => previous + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((previous) => previous - 1);
    }
  };

  const submitTest = async () => {
    if (
      submittingRef.current ||
      submitted ||
      questions.length === 0
    ) {
      return;
    }

    submittingRef.current = true;

    setIsRunning(false);
    setSubmitting(true);

    setMessage(
      "Marking your test... Please wait."
    );

    onContentReady?.(false);

    let totalScore = 0;
    let totalMarks = 0;

    const testResults = [];

    try {
      for (
        let index = 0;
        index < questions.length;
        index++
      ) {
        const question = questions[index];

        const studentAnswer =
          answers[index] || "";

        const questionMarks =
          Number(question.marks) || 0;

        totalMarks += questionMarks;

        if (question.type === "multiple_choice") {
          const isCorrect =
            studentAnswer === question.correctAnswer;

          const marksAwarded =
            isCorrect ? questionMarks : 0;

          totalScore += marksAwarded;

          testResults.push({
            questionIndex: index,
            awardedMarks: marksAwarded,
            totalMarks: questionMarks,

            feedback: isCorrect
              ? "Correct answer. Well done!"
              : studentAnswer
              ? `Incorrect. The correct answer was: ${question.correctAnswer}`
              : "No answer was provided.",

            missingPoints: isCorrect
              ? []
              : [
                  `The correct answer was: ${question.correctAnswer}`
                ]
          });
        } else if (
          question.type === "short_answer" ||
          question.type === "long_answer"
        ) {
          if (
            !studentAnswer ||
            !studentAnswer.trim()
          ) {
            testResults.push({
              questionIndex: index,
              awardedMarks: 0,
              totalMarks: questionMarks,
              feedback: "No answer was provided.",

              missingPoints:
                question.markingCriteria?.map(
                  (criterion) => criterion.criterion
                ) || []
            });

            continue;
          }

          const response = await axios.post(
            `${API}/mark-written-answer`,
            {
              question: question.question,
              student_answer: studentAnswer,
              correct_answer: question.correctAnswer,

              marking_criteria:
                question.markingCriteria || [],

              total_marks: questionMarks
            }
          );

          const markingResult =
            response.data.result;

          const marksAwarded =
            Number(markingResult.awardedMarks) || 0;

          totalScore += marksAwarded;

          testResults.push({
            questionIndex: index,
            awardedMarks: marksAwarded,
            totalMarks: questionMarks,

            feedback:
              markingResult.feedback ||
              "No feedback was provided.",

            missingPoints:
              markingResult.missingPoints || []
          });
        }
      }

      if (!mountedRef.current) {
        return;
      }

      setResults(testResults);
      setSubmitted(true);

      setMessage(
        `Test marked successfully! Final score: ${totalScore} / ${totalMarks}`
      );

      onContentReady?.(true);

    } catch (error) {
      console.error("MARKING ERROR:", error);

      if (!mountedRef.current) {
        return;
      }

      setMessage(
        error.response?.data?.error ||
        error.response?.data?.details ||
        "There was a problem marking your test. Please try submitting again."
      );

      setSubmitted(false);
      onContentReady?.(false);

    } finally {
      submittingRef.current = false;

      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const question = questions[currentQuestion];
  const currentResult = results[currentQuestion];

  return (
    <div className="timed-test">
      <h1>Timed Test</h1>

      {message && (
        <p className="test-message">
          {message}
        </p>
      )}

      {questions.length === 0 && (
        <div className="test-settings">
          <div>
            <label>
              Test duration:
            </label>

            <select
              value={minutes}
              onChange={(e) => {
                const newMinutes = Number(e.target.value);

                setMinutes(newMinutes);
                setTimeLeft(newMinutes * 60);
              }}
              disabled={loading}
            >
              <option value="15">
                15 minutes
              </option>

              <option value="30">
                30 minutes
              </option>

              <option value="45">
                45 minutes
              </option>

              <option value="60">
                60 minutes
              </option>

              <option value="90">
                90 minutes
              </option>
            </select>
          </div>

          <br />

          <div>
            <label>
              Number of questions:
            </label>

            <select
              value={numQuestions}
              onChange={(e) =>
                setNumQuestions(Number(e.target.value))
              }
              disabled={loading}
            >
              <option value="5">
                5 questions
              </option>

              <option value="10">
                10 questions
              </option>

              <option value="15">
                15 questions
              </option>

              <option value="20">
                20 questions
              </option>
            </select>
          </div>

          <br />

          <button
            type="button"
            onClick={startTest}
            disabled={loading || submitting}
          >
            {loading
              ? "Creating Test..."
              : "Start Test"}
          </button>
        </div>
      )}

      {questions.length > 0 && question && (
        <div className="test-area">
          <div className="timer">
            ⏱ {formatTime()}
          </div>

          <div className="question-progress">
            Question {currentQuestion + 1} of {questions.length}
          </div>

          <div className="question-box">
            <h2>
              Question {currentQuestion + 1}{" "}
              ({question.marks} Marks)
            </h2>

            <p className="question-text">
              {question.question}
            </p>

            {question.type === "multiple_choice" && (
              <div className="multiple-choice">
                {question.options?.map(
                  (option, index) => (
                    <label
                      key={index}
                      className={
                        "answer-option " +
                        (
                          answers[currentQuestion] === option
                            ? "selected"
                            : ""
                        )
                      }
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion}`}
                        checked={
                          answers[currentQuestion] === option
                        }
                        onChange={() =>
                          selectAnswer(option)
                        }
                        disabled={
                          submitted ||
                          submitting ||
                          !isRunning
                        }
                      />

                      <span>
                        {option}
                      </span>
                    </label>
                  )
                )}
              </div>
            )}

            {question.type === "short_answer" && (
              <div className="written-answer">
                <label>
                  Your Answer:
                </label>

                <textarea
                  rows="4"
                  placeholder="Type your answer here..."
                  value={
                    answers[currentQuestion] || ""
                  }
                  onChange={(e) =>
                    selectAnswer(e.target.value)
                  }
                  disabled={
                    submitted ||
                    submitting ||
                    !isRunning
                  }
                />
              </div>
            )}

            {question.type === "long_answer" && (
              <div className="written-answer">
                <label>
                  Your Answer:
                </label>

                <textarea
                  rows="10"
                  placeholder="Write your detailed answer here..."
                  value={
                    answers[currentQuestion] || ""
                  }
                  onChange={(e) =>
                    selectAnswer(e.target.value)
                  }
                  disabled={
                    submitted ||
                    submitting ||
                    !isRunning
                  }
                />
              </div>
            )}

            {submitted && currentResult && (
              <div className="question-result">
                <h3>
                  Result: {currentResult.awardedMarks}
                  {" / "}
                  {currentResult.totalMarks}
                  {" Marks"}
                </h3>

                <p>
                  <strong>
                    Feedback:
                  </strong>
                  {" "}
                  {currentResult.feedback}
                </p>

                {currentResult.missingPoints?.length > 0 && (
                  <div className="missing-points">
                    <strong>
                      What was missing:
                    </strong>

                    <ul>
                      {currentResult.missingPoints.map(
                        (point, index) => (
                          <li key={index}>
                            {point}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="question-navigation">
            <button
              type="button"
              onClick={previousQuestion}
              disabled={
                currentQuestion === 0 ||
                submitting
              }
            >
              Previous
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                type="button"
                onClick={nextQuestion}
                disabled={submitting}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submitTest}
                disabled={
                  submitting ||
                  submitted
                }
              >
                {submitting
                  ? "Marking Test..."
                  : submitted
                  ? "Test Submitted"
                  : "Submit Test"}
              </button>
            )}
          </div>

          {!submitted && !submitting && timeLeft === 0 && (
            <p className="test-message">
              Test time has ended.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default TimedTest;
