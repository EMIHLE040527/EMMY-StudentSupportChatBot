import { useState } from "react";

const dailyMessages = [
    {
        affirmation: "I am capable of learning difficult things.",
        motivation:
            "You do not need to understand everything immediately. Keep learning, keep practicing, and give yourself time to grow.",
        tip:
            "Focus on one topic at a time and celebrate small progress."
    },
    {
        affirmation: "I am making progress every day.",
        motivation:
            "Small steps may feel slow, but they still move you forward. Every page you read and every question you practice matters.",
        tip:
            "Set one realistic study goal and complete it today."
    },
    {
        affirmation: "I believe in my ability to succeed.",
        motivation:
            "You have overcome difficult things before. Trust yourself and continue working toward your goals.",
        tip:
            "When studying feels difficult, take a short break and try again."
    },
    {
        affirmation: "I do not have to be perfect to improve.",
        motivation:
            "Mistakes are part of learning. Every mistake can teach you something important.",
        tip:
            "Review one mistake you made recently and understand how to improve it."
    },
    {
        affirmation: "I am stronger than my distractions.",
        motivation:
            "Your future is built by the small choices you make today. Give your attention to what matters most.",
        tip:
            "Put your phone away for 25 minutes and focus completely on your work."
    },
    {
        affirmation: "I can achieve my goals with consistency.",
        motivation:
            "Success does not always come from doing everything at once. Consistent effort creates real progress.",
        tip:
            "Study for a short focused session instead of waiting for motivation."
    },
    {
        affirmation: "I am proud of how far I have come.",
        motivation:
            "Take a moment to recognize your progress. You are still learning, growing, and becoming better.",
        tip:
            "Write down one thing you learned today."
    }
];

function Motivation() {
    const today = new Date().getDate();

    const [message, setMessage] = useState(
        dailyMessages[today % dailyMessages.length]
    );

    const getNewMotivation = () => {
        const randomMessage =
            dailyMessages[
                Math.floor(Math.random() * dailyMessages.length)
            ];

        setMessage(randomMessage);
    };

    return (
        <div className="motivation-container">

            <h1>Daily Motivation</h1>

            <p className="motivation-subtitle">
                A little encouragement for your study journey.
            </p>

            <div className="affirmation-card">

                <h3>Today's Affirmation</h3>

                <p className="affirmation-text">
                    “{message.affirmation}”
                </p>

            </div>

            <div className="motivation-card">

                <h3>Daily Motivation</h3>

                <p>
                    {message.motivation}
                </p>

            </div>

            <div className="study-tip-card">

                <h3>Study Tip</h3>

                <p>
                    {message.tip}
                </p>

            </div>

            <button
                className="new-motivation-button"
                onClick={getNewMotivation}
            >
                Give Me More Motivation
            </button>

        </div>
    );
}

export default Motivation;