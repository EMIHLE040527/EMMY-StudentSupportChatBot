import { useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

function Quiz() {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [checked, setChecked] = useState({});
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const generateQuiz = async () => {
        const notesText = localStorage.getItem("uploadedNotes");

        // Check if the student uploaded notes first
        if (!notesText) {
            setMessage(
                "Please upload your study notes in My notes first."
            );
            return;
        }

        try {
            setLoading(true);
            setMessage("Generating quiz...");

            const response = await axios.post(
                `${API}/generate-study-content`,
                {
                    type: "quiz",
                    notes_text: notesText
                }
            );

            console.log("Quiz response:", response.data);

            // The backend returns the generated quiz as text
            const quizData = JSON.parse(response.data.content);

            setQuestions(quizData.questions || []);
            setAnswers({});
            setChecked({});
            setMessage("");

        } catch (error) {
            console.error("Quiz generation error:", error);

            setMessage(
                error.response?.data?.error ||
                "Could not generate the quiz. Please try again."
            );

        } finally {
            setLoading(false);
        }
    };


    const chooseAnswer = (questionIndex, answer) => {
        setAnswers({
            ...answers,
            [questionIndex]: answer
        });
    };


    const checkAnswer = (questionIndex) => {
        setChecked({
            ...checked,
            [questionIndex]: true
        });
    };


    return (
        <div className="quiz-container">

            <h1>Quiz</h1>

            <p>
                Test your knowledge using questions from your uploaded notes.
            </p>

            <button
                onClick={generateQuiz}
                disabled={loading}
            >
                {loading
                    ? "Generating Quiz..."
                    : "Generate Quiz"}
            </button>


            {message && (
                <p className="quiz-message">
                    {message}
                </p>
            )}


            <div className="quiz-questions">

                {questions.map((question, index) => {

                    const selectedAnswer = answers[index];
                    const isChecked = checked[index];

                    return (
                        <div
                            className="quiz-question"
                            key={index}
                        >

                            <h3>
                                Question {index + 1}:{" "}
                                {question.question}
                            </h3>


                            {question.options.map(
                                (option, optionIndex) => {

                                    const isSelected =
                                        selectedAnswer === option;

                                    return (
                                        <button
                                            key={optionIndex}
                                            className={
                                                "quiz-option " +
                                                (
                                                    isSelected
                                                        ? "selected"
                                                        : ""
                                                )
                                            }
                                            onClick={() =>
                                                chooseAnswer(
                                                    index,
                                                    option
                                                )
                                            }
                                            disabled={isChecked}
                                        >
                                            {option}
                                        </button>
                                    );
                                }
                            )}


                            {!isChecked &&
                                selectedAnswer && (

                                    <button
                                        className="check-answer"
                                        onClick={() =>
                                            checkAnswer(index)
                                        }
                                    >
                                        Check Answer
                                    </button>

                                )}


                            {isChecked && (

                                <div className="answer-result">

                                    {selectedAnswer ===
                                    question.correct_answer ? (

                                        <p className="correct">
                                            ✓ Correct!
                                        </p>

                                    ) : (

                                        <div>

                                            <p className="incorrect">
                                                ✗ Incorrect
                                            </p>

                                            <p>
                                                Correct answer:{" "}

                                                <strong>
                                                    {
                                                        question.correct_answer
                                                    }
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

        </div>
    );
}

export default Quiz;