
import { useEffect, useState } from "react";
import axios from "axios";

const API = "https://emmy-backend-7i0m.onrender.com";

function Quiz({ onContentReady }) {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [checked, setChecked] = useState({});
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const currentNotes = localStorage.getItem("uploadedNotes");
        const savedNotes = localStorage.getItem("emmyQuizNotes");
        const savedQuiz = localStorage.getItem("emmyGeneratedQuiz");

        if (
            currentNotes &&
            savedNotes === currentNotes &&
            savedQuiz
        ) {
            try {
                const quizData = JSON.parse(savedQuiz);

                if (
                    Array.isArray(quizData.questions) &&
                    quizData.questions.length > 0
                ) {
                    setQuestions(quizData.questions);

                    const savedAnswers = JSON.parse(
                        localStorage.getItem("emmyQuizAnswers") || "{}"
                    );

                    const savedChecked = JSON.parse(
                        localStorage.getItem("emmyQuizChecked") || "{}"
                    );

                    setAnswers(savedAnswers);
                    setChecked(savedChecked);

                    onContentReady?.(true);
                    return;
                }
            } catch (error) {
                console.error("Could not restore quiz:", error);
            }
        }

        setQuestions([]);
        setAnswers({});
        setChecked({});
        onContentReady?.(false);
    }, [onContentReady]);

    const generateQuiz = async () => {
        const notesText = localStorage.getItem("uploadedNotes");

        if (!notesText) {
            setMessage(
                "Please upload your study notes in My notes first."
            );

            setQuestions([]);
            setAnswers({});
            setChecked({});
            onContentReady?.(false);
            return;
        }

        try {
            setLoading(true);
            setMessage("Generating quiz...");
            onContentReady?.(false);

            const response = await axios.post(
                `${API}/generate-study-content`,
                {
                    type: "quiz",
                    notes_text: notesText
                }
            );

            let quizData = response.data.content;

            if (typeof quizData === "string") {
                quizData = JSON.parse(quizData);
            }

            if (
                !quizData ||
                !Array.isArray(quizData.questions) ||
                quizData.questions.length === 0
            ) {
                throw new Error(
                    "No quiz questions were generated."
                );
            }

            const validQuestions = quizData.questions.filter(
                (question) =>
                    question &&
                    typeof question.question === "string" &&
                    Array.isArray(question.options) &&
                    question.options.length > 0 &&
                    typeof question.correct_answer === "string"
            );

            if (validQuestions.length === 0) {
                throw new Error(
                    "The generated quiz contains no valid questions."
                );
            }

            setQuestions(validQuestions);
            setAnswers({});
            setChecked({});
            setMessage("");

            localStorage.setItem(
                "emmyGeneratedQuiz",
                JSON.stringify({
                    questions: validQuestions
                })
            );

            localStorage.setItem(
                "emmyQuizNotes",
                notesText
            );

            localStorage.setItem(
                "emmyQuizAnswers",
                JSON.stringify({})
            );

            localStorage.setItem(
                "emmyQuizChecked",
                JSON.stringify({})
            );

            onContentReady?.(true);

        } catch (error) {
            console.error("Quiz generation error:", error);

            setQuestions([]);
            setAnswers({});
            setChecked({});

            localStorage.removeItem("emmyGeneratedQuiz");
            localStorage.removeItem("emmyQuizNotes");
            localStorage.removeItem("emmyQuizAnswers");
            localStorage.removeItem("emmyQuizChecked");

            setMessage(
                error.response?.data?.error ||
                error.message ||
                "Could not generate the quiz. Please try again."
            );

            onContentReady?.(false);
        } finally {
            setLoading(false);
        }
    };

    const chooseAnswer = (questionIndex, answer) => {
        if (checked[questionIndex]) {
            return;
        }

        const updatedAnswers = {
            ...answers,
            [questionIndex]: answer
        };

        setAnswers(updatedAnswers);

        localStorage.setItem(
            "emmyQuizAnswers",
            JSON.stringify(updatedAnswers)
        );
    };

    const checkAnswer = (questionIndex) => {
        if (!answers[questionIndex]) {
            return;
        }

        const updatedChecked = {
            ...checked,
            [questionIndex]: true
        };

        setChecked(updatedChecked);

        localStorage.setItem(
            "emmyQuizChecked",
            JSON.stringify(updatedChecked)
        );
    };

    const completedCount = questions.filter(
        (_, index) => checked[index]
    ).length;

    const correctCount = questions.filter(
        (question, index) =>
            checked[index] &&
            answers[index] === question.correct_answer
    ).length;

    return (
        <div className="quiz-container">

            <div className="quiz-header">
                <div>
                    <h1>Quiz</h1>

                    <p>
                        Test your knowledge using questions
                        from your uploaded notes.
                    </p>
                </div>

                <button
                    type="button"
                    className="quiz-generate-button"
                    onClick={generateQuiz}
                    disabled={loading}
                >
                    {loading
                        ? "Generating Quiz..."
                        : questions.length > 0
                            ? "Generate New Quiz"
                            : "Generate Quiz"}
                </button>
            </div>

            {message && (
                <p className="quiz-message">
                    {message}
                </p>
            )}

            {questions.length > 0 && (
                <div className="quiz-progress">
                    <div>
                        <span className="quiz-progress-label">
                            YOUR PROGRESS
                        </span>

                        <p>
                            {completedCount} of {questions.length}
                            {" "}questions checked
                        </p>
                    </div>

                    <div className="quiz-score">
                        Score: {correctCount}/{completedCount}
                    </div>
                </div>
            )}

            <div className="quiz-questions">
                {questions.map((question, index) => {
                    const selectedAnswer = answers[index];
                    const isChecked = checked[index];

                    const isCorrect =
                        selectedAnswer ===
                        question.correct_answer;

                    return (
                        <div
                            className="quiz-question"
                            key={index}
                        >
                            <div className="quiz-question-label">
                                QUESTION {index + 1} OF {questions.length}
                            </div>

                            <h3>
                                {question.question}
                            </h3>

                            <div className="quiz-options">
                                {question.options.map(
                                    (option, optionIndex) => {
                                        const isSelected =
                                            selectedAnswer === option;

                                        return (
                                            <button
                                                key={optionIndex}
                                                type="button"
                                                className={
                                                    "quiz-option" +
                                                    (isSelected
                                                        ? " selected"
                                                        : "")
                                                }
                                                onClick={() =>
                                                    chooseAnswer(
                                                        index,
                                                        option
                                                    )
                                                }
                                                disabled={isChecked}
                                            >
                                                <span className="quiz-option-text">
                                                    {option}
                                                </span>

                                                {isSelected && (
                                                    <span className="quiz-selected-icon">
                                                        ✓
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    }
                                )}
                            </div>

                            {!isChecked && selectedAnswer && (
                                <button
                                    type="button"
                                    className="check-answer"
                                    onClick={() =>
                                        checkAnswer(index)
                                    }
                                >
                                    Check Answer
                                </button>
                            )}

                            {isChecked && (
                                <div
                                    className={
                                        "answer-result " +
                                        (isCorrect
                                            ? "answer-correct"
                                            : "answer-incorrect")
                                    }
                                >
                                    {isCorrect ? (
                                        <p className="correct">
                                            ✓ Correct! Well done.
                                        </p>
                                    ) : (
                                        <div>
                                            <p className="incorrect">
                                                ✗ Incorrect
                                            </p>

                                            <p>
                                                Correct answer:{" "}
                                                <strong>
                                                    {question.correct_answer}
                                                </strong>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {questions.length > 0 &&
                completedCount === questions.length && (
                    <div className="quiz-final-result">
                        <h2>Quiz Completed!</h2>

                        <p>
                            You scored {correctCount} out of{" "}
                            {questions.length}.
                        </p>

                        <p>
                            {correctCount === questions.length
                                ? "Excellent work! You answered every question correctly."
                                : "Good effort! Review the questions you missed and keep practising."}
                        </p>
                    </div>
                )}
        </div>
    );
}

export default Quiz;
