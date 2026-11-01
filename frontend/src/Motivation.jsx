
import { useEffect, useState } from "react";

// 30 motivational messages covering different student experiences.
const dailyMessages = [
  {
    affirmation: "I am capable of learning difficult things.",
    motivation:
      "Not understanding something immediately does not mean you cannot learn it. Give yourself time to explore and ask questions.",
    tip:
      "Explain a difficult concept in your own words after studying it."
  },
  {
    affirmation: "My journey does not need to look like anyone else's.",
    motivation:
      "Some people achieve their goals earlier than others. Your progress still matters, even when your journey takes a different path.",
    tip:
      "Set goals based on your own progress instead of comparing yourself with others."
  },
  {
    affirmation: "One bad result does not define my future.",
    motivation:
      "A disappointing test result is one moment in your academic journey. It does not determine everything you are capable of achieving.",
    tip:
      "Review the questions you got wrong and identify what you need to practise."
  },
  {
    affirmation: "I deserve to rest without feeling guilty.",
    motivation:
      "You are a person, not a machine. Taking time to rest can help you return to your responsibilities with a clearer mind.",
    tip:
      "Include short breaks in your study schedule."
  },
  {
    affirmation: "My ideas and opinions have value.",
    motivation:
      "Do not be afraid to contribute during discussions. Your perspective may help someone understand something differently.",
    tip:
      "Prepare one question or comment before your next class."
  },
  {
    affirmation: "I can begin again whenever I need to.",
    motivation:
      "A difficult yesterday does not mean today must be the same. You have another opportunity to make different choices.",
    tip:
      "Start your day by identifying your most important task."
  },
  {
    affirmation: "I am becoming more confident in myself.",
    motivation:
      "Confidence does not always appear before you try something. Sometimes it develops because you were brave enough to try.",
    tip:
      "Attempt one challenging question before checking the solution."
  },
  {
    affirmation: "I have already overcome difficult moments.",
    motivation:
      "Think about a challenge you once believed was impossible. You made it through, and that experience shows your ability to adapt.",
    tip:
      "Write down a challenge you overcame and what it taught you."
  },
  {
    affirmation: "I am allowed to ask for help.",
    motivation:
      "Asking questions does not make you less capable. It shows that you are willing to learn from others.",
    tip:
      "Ask a lecturer, tutor or classmate about one topic you find confusing."
  },
  {
    affirmation: "My future holds possibilities I have not discovered.",
    motivation:
      "The subjects you study today may lead to opportunities you have not even considered. Stay curious about what you can learn.",
    tip:
      "Explore one career or skill connected to your course."
  },
  {
    affirmation: "I do not need to know everything today.",
    motivation:
      "University is a place for learning, not a place where everyone is expected to have all the answers.",
    tip:
      "Separate topics you understand from those requiring more revision."
  },
  {
    affirmation: "I am proud of the person I am becoming.",
    motivation:
      "Your university journey is teaching you more than academic knowledge. You are also developing independence and problem-solving skills.",
    tip:
      "Reflect on one personal skill you have developed this semester."
  },
  {
    affirmation: "My voice deserves to be heard.",
    motivation:
      "You may sometimes doubt whether your contribution matters. Remember that different experiences and ideas make teamwork stronger.",
    tip:
      "Share at least one useful idea during your next group discussion."
  },
  {
    affirmation: "I can handle challenges one at a time.",
    motivation:
      "When everything feels overwhelming, you do not have to solve every problem at once. Decide what needs your attention first.",
    tip:
      "Break a large assignment into smaller tasks with separate deadlines."
  },
  {
    affirmation: "I am more than my academic results.",
    motivation:
      "Your grades are important, but they are not the only things that define you. Your character, kindness and creativity matter too.",
    tip:
      "Make time for an activity you enjoy outside your studies."
  },
  {
    affirmation: "I can learn from my mistakes.",
    motivation:
      "Making mistakes is not the opposite of learning. Understanding why something went wrong can help you make better decisions.",
    tip:
      "Create a list of common mistakes to review before your next assessment."
  },
  {
    affirmation: "I deserve opportunities to grow.",
    motivation:
      "Do not automatically reject an opportunity because you feel inexperienced. Every experienced person had to begin somewhere.",
    tip:
      "Look for one internship, bursary, workshop or career opportunity."
  },
  {
    affirmation: "I am allowed to change my approach.",
    motivation:
      "If a study method is not working, trying something different is a sensible decision. Improvement often requires experimenting.",
    tip:
      "Try active recall instead of only reading your notes."
  },
  {
    affirmation: "I can celebrate my achievements.",
    motivation:
      "You do not have to wait until graduation to acknowledge your accomplishments. Finishing a difficult task is also worth celebrating.",
    tip:
      "Record one thing you completed successfully today."
  },
  {
    affirmation: "My background does not limit my potential.",
    motivation:
      "Where you started does not have to determine where you finish. Your experiences can give you valuable strengths and perspectives.",
    tip:
      "Identify one personal strength that helps you overcome challenges."
  },
  {
    affirmation: "I have the courage to try new things.",
    motivation:
      "Trying something unfamiliar can feel uncomfortable. However, discovering new abilities often begins with taking that first step.",
    tip:
      "Explore a new skill or learning resource related to your interests."
  },
  {
    affirmation: "I can make thoughtful decisions about my future.",
    motivation:
      "It is normal not to have your entire career planned. You can discover your interests by learning, exploring and gaining experience.",
    tip:
      "Research two possible career paths related to your qualification."
  },
  {
    affirmation: "I deserve kindness from myself.",
    motivation:
      "Speak to yourself with the same understanding you would offer a friend who is having a difficult day.",
    tip:
      "Replace one negative thought about your studies with a realistic, helpful statement."
  },
  {
    affirmation: "I can find solutions to difficult problems.",
    motivation:
      "A complicated problem can seem impossible at first. Looking at its smaller parts often makes it easier to understand.",
    tip:
      "Divide a difficult problem into steps before attempting the full solution."
  },
  {
    affirmation: "I am building valuable connections.",
    motivation:
      "The people you meet during your studies can become friends, mentors and future colleagues. Meaningful relationships can support your growth.",
    tip:
      "Introduce yourself to a classmate or attend a student networking event."
  },
  {
    affirmation: "I can recover from setbacks.",
    motivation:
      "A rejected application or missed opportunity can be disappointing, but it does not mean every future opportunity will end the same way.",
    tip:
      "Review one unsuccessful application and identify a possible improvement."
  },
  {
    affirmation: "My curiosity is one of my strengths.",
    motivation:
      "Learning becomes more meaningful when you ask why things work instead of only memorising information.",
    tip:
      "Write three questions about a topic and try answering them from your notes."
  },
  {
    affirmation: "I can create a healthy balance.",
    motivation:
      "Your studies matter, but so do your relationships, interests and well-being. Making space for different parts of life is important.",
    tip:
      "Plan study sessions alongside meals, rest and personal activities."
  },
  {
    affirmation: "I can prepare for opportunities with confidence.",
    motivation:
      "You may not feel completely ready for every interview, presentation or opportunity. Preparation can help you take part despite feeling nervous.",
    tip:
      "Practise introducing yourself and describing your skills aloud."
  },
  {
    affirmation: "There is still so much I can discover.",
    motivation:
      "Your education is opening doors to new knowledge, experiences and possibilities. Stay open to discovering interests you never expected.",
    tip:
      "Learn one new fact or concept outside your usual study topics."
  }
];

// Additional motivations use different themes.
const extraMotivations = [
  "You are allowed to have dreams that seem bigger than your current circumstances.",
  "A difficult semester does not erase everything you have achieved.",
  "Your opinion matters, even when you are surrounded by confident people.",
  "You do not need to follow someone else's timeline to build a meaningful future.",
  "Being willing to learn is more important than pretending you already know everything.",
  "A rejected opportunity is disappointing, but it does not predict every future opportunity.",
  "Your creativity may become one of your greatest professional strengths.",
  "You deserve friendships and environments where you feel respected and supported.",
  "The fact that something challenges you does not mean you should give up on it.",
  "You can take your ambitions seriously without being unkind to yourself.",
  "Do not underestimate the value of the experiences that make your perspective unique.",
  "You are allowed to discover new interests and change your plans.",
  "Your contribution to a group can make a difference, even when it seems small.",
  "You can feel nervous about an opportunity and still choose to pursue it.",
  "You are becoming someone with knowledge and experiences your younger self did not have.",
  "Your university experience can teach you independence as well as academic knowledge.",
  "You do not have to turn every interest into an achievement. Some things are simply meant to be enjoyed.",
  "Having a difficult day does not take away your ability to have a better one.",
  "You are allowed to be proud of yourself without comparing your achievements with others.",
  "There are opportunities you have not discovered yet, and new people you have not met.",
  "You can learn to handle uncertainty without having all the answers.",
  "The skills you are developing may help solve problems in your community.",
  "One person's opinion does not determine what you are capable of becoming.",
  "You can build a meaningful career while still making time for the people and activities you love.",
  "Your future can be different from what you originally imagined, and still be fulfilling."
];

// Use the complete local date, not just the day of the month.
function getLocalDateKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Choose a daily message using the number of days since a fixed date.
function getDailyMessageIndex(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const days = Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );

  return ((days % dailyMessages.length) + dailyMessages.length)
    % dailyMessages.length;
}

function Motivation() {
  const [dateKey, setDateKey] = useState(getLocalDateKey);

  const dailyIndex = getDailyMessageIndex(dateKey);
  const dailyMessage = dailyMessages[dailyIndex];

  const [extraMessage, setExtraMessage] = useState("");
  const [usedExtraIndices, setUsedExtraIndices] = useState([]);

  // Update the daily motivation when the calendar date changes.
  useEffect(() => {
    const checkDate = () => {
      const currentDate = getLocalDateKey();

      if (currentDate !== dateKey) {
        setDateKey(currentDate);
        setExtraMessage("");
        setUsedExtraIndices([]);
      }
    };

    const interval = setInterval(checkDate, 30000);

    return () => clearInterval(interval);
  }, [dateKey]);

  const getNewMotivation = () => {
    let availableIndices = extraMotivations
      .map((_, index) => index)
      .filter((index) => !usedExtraIndices.includes(index));

    // Start another cycle only after all messages have been shown.
    if (availableIndices.length === 0) {
      availableIndices = extraMotivations.map((_, index) => index);
    }

    const randomIndex = availableIndices[
      Math.floor(Math.random() * availableIndices.length)
    ];

    setExtraMessage(extraMotivations[randomIndex]);

    setUsedExtraIndices((previous) =>
      availableIndices.length === extraMotivations.length
        ? [randomIndex]
        : [...previous, randomIndex]
    );
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
          “{dailyMessage.affirmation}”
        </p>
      </div>

      <div className="motivation-card">
        <h3>Daily Motivation</h3>

        <p>{dailyMessage.motivation}</p>
      </div>

      <div className="study-tip-card">
        <h3>Study Tip</h3>

        <p>{dailyMessage.tip}</p>
      </div>

      <button
        className="new-motivation-button"
        type="button"
        onClick={getNewMotivation}
      >
        Inspire Me Again ✨
      </button>

      {extraMessage && (
        <div
          className="motivation-card"
          style={{ marginTop: "20px" }}
        >
          <h3>A Little Extra Encouragement</h3>

          <p>{extraMessage}</p>
        </div>
      )}
    </div>
  );
}

export default Motivation;
