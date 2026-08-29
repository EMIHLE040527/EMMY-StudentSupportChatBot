import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

function TimedTest() {
  const [minutes, setMinutes] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30 * 60);

  const [numQuestions, setNumQuestions] = useState(10);

  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);

  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ==============================
  // TIMER
  // ==============================

  useEffect(() => {
    if (!isRunning || submitted) return;

    if (timeLeft <= 0) {
      submitTest();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) =>
        previousTime > 0
          ? previousTime - 1
          : 0
      );
    }, 1000);

    return () => clearInterval(timer);

  }, [isRunning, timeLeft, submitted]);


  // ==============================
  // START TEST
  // ==============================

  const startTest = async () => {
    const notesText = localStorage.getItem("uploadedNotes");

    if (!notesText) {
      setMessage(
        "Please upload your study notes in My notes first."
      );
      return;
    }

    try {
      setLoading(true);

      setMessage(
        "Creating your examination from the uploaded notes..."
      );

      const response = await axios.post(
        `${API}/generate-timed-test`,
        {
          notes_text: notesText,
          num_questions: numQuestions
        }
      );

      const generatedQuestions =
        response.data.questions || [];

      if (generatedQuestions.length === 0) {
        setMessage(
          "No questions were generated. Please try again."
        );
        return;
      }

      setQuestions(generatedQuestions);

      setCurrentQuestion(0);

      setAnswers({});

      setResults([]);

      setSubmitted(false);

      setTimeLeft(minutes * 60);

      setIsRunning(true);

      setMessage("");

    } catch (error) {
      console.error(
        "TEST GENERATION ERROR:",
        error
      );

      setMessage(
        error.response?.data?.error ||
        "Could not create the timed test."
      );

    } finally {
      setLoading(false);
    }
  };


  // ==============================
  // SAVE ANSWER
  // ==============================

  const selectAnswer = (answer) => {
    if (submitted) return;

    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion]: answer
    }));
  };


  // ==============================
  // FORMAT TIMER
  // ==============================

  const formatTime = () => {
    const mins = Math.floor(timeLeft / 60);

    const seconds = timeLeft % 60;

    return `${mins}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };


  // ==============================
  // QUESTION NAVIGATION
  // ==============================

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(
        currentQuestion + 1
      );
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(
        currentQuestion - 1
      );
    }
  };


  // ==============================
  // SUBMIT AND MARK TEST
  // ==============================

  const submitTest = async () => {
    if (submitting || submitted) return;

    setIsRunning(false);

    setSubmitting(true);

    setMessage(
      "Marking your test... Please wait."
    );

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


        // ==================================
        // MULTIPLE CHOICE QUESTIONS
        // ==================================

        if (
          question.type === "multiple_choice"
        ) {

          const isCorrect =
            studentAnswer ===
            question.correctAnswer;

          const marksAwarded =
            isCorrect
              ? questionMarks
              : 0;

          totalScore += marksAwarded;

          testResults.push({
            questionIndex: index,

            awardedMarks:
              marksAwarded,

            totalMarks:
              questionMarks,

            feedback: isCorrect
              ? "Correct answer. Well done!"
              : studentAnswer
                ? `Incorrect. The correct answer was: ${question.correctAnswer}`
                : "No answer was provided.",

            missingPoints:
              isCorrect
                ? []
                : [
                    `The correct answer was: ${question.correctAnswer}`
                  ]
          });

        }


        // ==================================
        // SHORT AND LONG ANSWERS
        // ==================================

        else if (
          question.type ===
            "short_answer" ||
          question.type ===
            "long_answer"
        ) {

          // Student did not answer
          if (
            !studentAnswer ||
            !studentAnswer.trim()
          ) {

            testResults.push({
              questionIndex: index,

              awardedMarks: 0,

              totalMarks:
                questionMarks,

              feedback:
                "No answer was provided.",

              missingPoints:
                question.markingCriteria
                  ?.map(
                    (criterion) =>
                      criterion.criterion
                  ) || []
            });

            continue;
          }


          // Send answer to Flask AI marker
          const response =
            await axios.post(
              `${API}/mark-written-answer`,
              {
                question:
                  question.question,

                student_answer:
                  studentAnswer,

                correct_answer:
                  question.correctAnswer,

                marking_criteria:
                  question.markingCriteria ||
                  [],

                total_marks:
                  questionMarks
              }
            );


          const markingResult =
            response.data.result;


          const marksAwarded =
            Number(
              markingResult.awardedMarks
            ) || 0;


          totalScore += marksAwarded;


          testResults.push({
            questionIndex: index,

            awardedMarks:
              marksAwarded,

            totalMarks:
              questionMarks,

            feedback:
              markingResult.feedback ||
              "No feedback was provided.",

            missingPoints:
              markingResult.missingPoints ||
              []
          });
        }
      }


      // Save all results
      setResults(testResults);

      setSubmitted(true);

      setMessage(
        `Test marked successfully! Final score: ${totalScore} / ${totalMarks}`
      );

    } catch (error) {

      console.error(
        "MARKING ERROR:",
        error
      );

      setMessage(
        error.response?.data?.error ||
        error.response?.data?.details ||
        "There was a problem marking your test."
      );

    } finally {

      setSubmitting(false);

    }
  };


  const question =
    questions[currentQuestion];

  const currentResult =
    results[currentQuestion];


  return (
    <div className="timed-test">

      <h1>Timed Test</h1>


      {/* MESSAGE */}

      {message && (
        <p className="test-message">
          {message}
        </p>
      )}


      {/* TEST SETTINGS */}

      {questions.length === 0 && (

        <div className="test-settings">

          <div>

            <label>
              Test duration:
            </label>

            <select
              value={minutes}

              onChange={(e) => {

                const newMinutes =
                  Number(
                    e.target.value
                  );

                setMinutes(
                  newMinutes
                );

                setTimeLeft(
                  newMinutes * 60
                );

              }}
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
                setNumQuestions(
                  Number(
                    e.target.value
                  )
                )
              }
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
            onClick={startTest}

            disabled={
              loading ||
              submitting
            }
          >

            {loading
              ? "Creating Test..."
              : "Start Test"}

          </button>

        </div>
      )}


      {/* TEST AREA */}

      {questions.length > 0 &&
        question && (

        <div className="test-area">


          {/* TIMER */}

          <div className="timer">

            ⏱ {formatTime()}

          </div>


          {/* PROGRESS */}

          <div className="question-progress">

            Question{" "}
            {currentQuestion + 1}{" "}
            of{" "}
            {questions.length}

          </div>


          {/* QUESTION */}

          <div className="question-box">

            <h2>

              Question{" "}
              {currentQuestion + 1}{" "}

              ({question.marks} Marks)

            </h2>


            <p className="question-text">

              {question.question}

            </p>


            {/* ==============================
                MULTIPLE CHOICE
            ============================== */}

            {question.type ===
              "multiple_choice" && (

              <div className="multiple-choice">

                {question.options?.map(
                  (
                    option,
                    index
                  ) => (

                    <label
                      key={index}

                      className={
                        "answer-option " +
                        (
                          answers[
                            currentQuestion
                          ] === option
                            ? "selected"
                            : ""
                        )
                      }
                    >

                      <input
                        type="radio"

                        name={
                          `question-${currentQuestion}`
                        }

                        checked={
                          answers[
                            currentQuestion
                          ] === option
                        }

                        onChange={() =>
                          selectAnswer(
                            option
                          )
                        }

                        disabled={
                          submitted
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


            {/* ==============================
                SHORT ANSWER
            ============================== */}

            {question.type ===
              "short_answer" && (

              <div className="written-answer">

                <label>
                  Your Answer:
                </label>


                <textarea

                  rows="4"

                  placeholder={
                    "Type your answer here..."
                  }

                  value={
                    answers[
                      currentQuestion
                    ] || ""
                  }

                  onChange={(e) =>
                    selectAnswer(
                      e.target.value
                    )
                  }

                  disabled={
                    submitted
                  }

                />

              </div>

            )}


            {/* ==============================
                LONG ANSWER
            ============================== */}

            {question.type ===
              "long_answer" && (

              <div className="written-answer">

                <label>
                  Your Answer:
                </label>


                <textarea

                  rows="10"

                  placeholder={
                    "Write your detailed answer here..."
                  }

                  value={
                    answers[
                      currentQuestion
                    ] || ""
                  }

                  onChange={(e) =>
                    selectAnswer(
                      e.target.value
                    )
                  }

                  disabled={
                    submitted
                  }

                />

              </div>

            )}


            {/* ==============================
                RESULT AND FEEDBACK
            ============================== */}

            {submitted &&
              currentResult && (

              <div className="question-result">

                <h3>

                  Result:{" "}

                  {currentResult.awardedMarks}

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


                {currentResult
                  .missingPoints
                  ?.length > 0 && (

                  <div className="missing-points">

                    <strong>
                      What was missing:
                    </strong>


                    <ul>

                      {currentResult
                        .missingPoints
                        .map(
                          (
                            point,
                            index
                          ) => (

                            <li
                              key={index}
                            >

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


          {/* NAVIGATION */}

          <div className="question-navigation">


            <button

              onClick={
                previousQuestion
              }

              disabled={
                currentQuestion === 0
              }

            >
              Previous
            </button>


            {currentQuestion <
            questions.length - 1 ? (

              <button
                onClick={
                  nextQuestion
                }
              >
                Next
              </button>

            ) : (

              <button

                onClick={
                  submitTest
                }

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

        </div>

      )}

    </div>
  );
}

export default TimedTest;