
import {
  useEffect,
  useRef,
  useState,
  useCallback
} from "react";
import axios from "axios";

import Reminders from "./Reminders";
import Motivation from "./Motivation";
import Profile from "./Profile";
import ReminderPopup from "./ReminderPopup";
import Notes from "./Notes";
import TimedTest from "./TimedTest";
import Summary from "./Summary";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";
import BursarySidebar from "./BursarySidebar";
import ListenAndLearn from "./ListenAndLearn";
import StudyBreakManager from "./StudyBreakManager";
import ColoringGame from "./ColoringGame";
import Feedback from "./Feedback";
const API = "https://emmy-backend-7i0m.onrender.com";

const SUGGESTIONS = [
  "Explain photosynthesis simply",
  "Help me plan exam week",
  "How do I structure an essay?"
];

const STUDY_TOOL_VIEWS = [
  "summary",
  "flashcards",
  "quiz",
  "listenLearn",
  "timedTest"
];

const EMPTY_CONTENT_READY = {
  summary: false,
  flashcards: false,
  quiz: false,
  listenLearn: false,
  timedTest: false
};

function welcomeMessage(firstName) {
  return {
    role: "emmy",
    text: `Hi ${firstName || "there"}! I'm emmy, your study buddy. You can ask me anything.`
  };
}

function localChat(firstName, id) {
  return {
    id,
    title: "New chat",
    messages: [welcomeMessage(firstName)],
    loaded: true,
    local: true
  };
}

const isServerChat = (id) =>
  typeof id === "number";

function getWeatherIcon(condition) {
  const text = (condition || "").toLowerCase();

  if (text.includes("clear") || text.includes("sunny"))
    return "☀️";

  if (text.includes("partly cloudy"))
    return "🌤️";

  if (text.includes("cloud") || text.includes("overcast"))
    return "☁️";

  if (text.includes("rain") || text.includes("drizzle"))
    return "🌧️";

  if (text.includes("thunder") || text.includes("storm"))
    return "⛈️";

  if (text.includes("snow"))
    return "❄️";

  if (text.includes("fog") || text.includes("mist"))
    return "🌫️";

  return "🌤️";
}

function formatEmmyText(text) {
  if (!text) return "";

  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export default function Chatbot({ user, onLogout }) {
  const [chats, setChats] = useState(() => [
    localChat(user.firstName, "local-0")
  ]);

  const [activeId, setActiveId] = useState("local-0");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [weather, setWeather] = useState(null);

  const [responseMode, setResponseMode] = useState("text");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingMessage, setSpeakingMessage] = useState(null);

  const [notesReady, setNotesReady] = useState(() =>
    Boolean(localStorage.getItem("uploadedNotes")?.trim())
  );

  const [uploadSignal, setUploadSignal] = useState(0);

  const [studyToolActivated, setStudyToolActivated] =
    useState(false);

  const [lastStudyView, setLastStudyView] =
    useState("summary");

  const [resumeStudySignal, setResumeStudySignal] =
    useState(0);

  const [breakDurationMinutes, setBreakDurationMinutes] =
    useState(5);

  const [breakEndAt, setBreakEndAt] = useState(null);

  const [gameReturnView, setGameReturnView] =
    useState("chat");

  const [
    gameStartedFromSidebar,
    setGameStartedFromSidebar
  ] = useState(false);

  const [studyContentReady, setStudyContentReady] =
    useState({
      ...EMPTY_CONTENT_READY
    });

  const [view, setView] = useState("chat");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [preferredLanguage, setPreferredLanguage] =
    useState("");

  const [dueReminder, setDueReminder] = useState(null);
  const [reminderDismissed, setReminderDismissed] =
    useState(false);

  const recognitionRef = useRef(null);
  const threadEndRef = useRef(null);
  const localIdRef = useRef(1);

  const speakingMessageRef = useRef(null);
  const reminderTimerRef = useRef(null);
  const lastDueReminderIdRef = useRef(null);

  const activeChat = chats.find(
    (chat) => chat.id === activeId
  );

  /*
   * ==============================
   * STUDY CONTENT READY HANDLERS
   * ==============================
   */

  const updateStudyContentReady = useCallback(
    (tool, ready) => {
      if (!STUDY_TOOL_VIEWS.includes(tool)) {
        return;
      }

      setStudyContentReady((previous) => ({
        ...previous,
        [tool]: ready === true
      }));
    },
    []
  );

  const handleSummaryReady = useCallback(
    (ready) => {
      updateStudyContentReady("summary", ready);
    },
    [updateStudyContentReady]
  );

  const handleFlashcardsReady = useCallback(
    (ready) => {
      updateStudyContentReady("flashcards", ready);
    },
    [updateStudyContentReady]
  );

  const handleQuizReady = useCallback(
    (ready) => {
      updateStudyContentReady("quiz", ready);
    },
    [updateStudyContentReady]
  );

  const handleListenLearnReady = useCallback(
    (ready) => {
      updateStudyContentReady("listenLearn", ready);
    },
    [updateStudyContentReady]
  );

  const handleTimedTestReady = useCallback(
    (ready) => {
      updateStudyContentReady("timedTest", ready);
    },
    [updateStudyContentReady]
  );

  /*
   * ==============================
   * OPEN STUDY TOOLS
   * ==============================
   */

  const openStudyTool = (tool) => {
    if (!STUDY_TOOL_VIEWS.includes(tool)) {
      return;
    }

    if (!notesReady) {
      setView("notes");
      return;
    }

    setStudyToolActivated(true);
    setLastStudyView(tool);
    setView(tool);
  };

  /*
   * ==============================
   * COLORING GAME
   * ==============================
   */

  const openBreakGame = ({ durationMinutes } = {}) => {
    const duration = Math.max(
      1,
      Number(durationMinutes) || 5
    );

    const returnView = STUDY_TOOL_VIEWS.includes(view)
      ? view
      : lastStudyView;

    setLastStudyView(returnView);
    setGameReturnView(returnView);

    setGameStartedFromSidebar(false);
    setBreakDurationMinutes(duration);

    setBreakEndAt(null);
    setView("breakGame");
  };

  const openColoringGameFromSidebar = () => {
    if (view === "breakGame") {
      return;
    }

    setGameReturnView(view);
    setGameStartedFromSidebar(true);

    setBreakEndAt(null);
    setView("breakGame");
  };

  const returnFromBreakGame = () => {
    const destination = gameStartedFromSidebar
      ? gameReturnView
      : lastStudyView;

    const returningToStudyTool =
      STUDY_TOOL_VIEWS.includes(destination);

    setBreakEndAt(null);

    setView(
      destination === "breakGame"
        ? "chat"
        : destination
    );

    if (returningToStudyTool) {
      setStudyToolActivated(true);
    }

    if (!gameStartedFromSidebar) {
      setResumeStudySignal(
        (previous) => previous + 1
      );
    }

    setGameStartedFromSidebar(false);
  };

  /*
   * ==============================
   * NOTES UPLOAD
   * ==============================
   */

  const handleNotesUploadSuccess = (success) => {
    if (success) {
      setStudyContentReady({
        ...EMPTY_CONTENT_READY
      });

      setNotesReady(true);
      setStudyToolActivated(false);

      // Trigger the Study Manager only
      // after a successful upload.
      setUploadSignal(
        (previous) => previous + 1
      );
    } else {
      setNotesReady(false);

      setStudyContentReady({
        ...EMPTY_CONTENT_READY
      });

      setStudyToolActivated(false);
    }
  };

  /*
   * ==============================
   * SPEECH RECOGNITION
   * ==============================
   */

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-ZA";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      setInput((previous) =>
        previous
          ? `${previous} ${transcript}`
          : transcript
      );
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  /*
   * ==============================
   * GLOBAL REMINDERS
   * ==============================
   */

  useEffect(() => {
    let cancelled = false;
    let reminders = [];

    function updateDueReminder() {
      if (cancelled) return;

      const now = Date.now();

      const due = reminders
        .filter((reminder) => {
          const dueTime =
            new Date(reminder.due).getTime();

          return (
            reminder.status === "Pending" &&
            Number.isFinite(dueTime) &&
            dueTime <= now
          );
        })
        .sort(
          (a, b) =>
            new Date(b.due).getTime() -
            new Date(a.due).getTime()
        )[0];

      const nextId = due ? due.id : null;

      if (
        nextId !== lastDueReminderIdRef.current
      ) {
        lastDueReminderIdRef.current = nextId;
        setReminderDismissed(false);
      }

      setDueReminder(due || null);
    }

    async function checkReminders() {
      try {
        const response = await axios.get(
          `${API}/reminders`,
          {
            params: {
              user_id: user.userId
            }
          }
        );

        if (cancelled) return;

        reminders =
          response.data.reminders || [];

        updateDueReminder();
      } catch (error) {
        console.error(
          "Failed to load reminders:",
          error
        );
      }
    }

    checkReminders();

    const timeInterval = setInterval(
      updateDueReminder,
      1000
    );

    const databaseInterval = setInterval(
      checkReminders,
      5000
    );

    return () => {
      cancelled = true;
      clearInterval(timeInterval);
      clearInterval(databaseInterval);
    };
  }, [user.userId]);

  /*
   * ==============================
   * WEATHER
   * ==============================
   */

  useEffect(() => {
    async function loadWeather() {
      try {
        const location =
          localStorage.getItem(
            "emmy_location"
          );

        const latitude =
          localStorage.getItem(
            "emmy_latitude"
          );

        const longitude =
          localStorage.getItem(
            "emmy_longitude"
          );

        if (!latitude || !longitude) {
          setWeather(null);
          return;
        }

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
        );

        if (!response.ok) {
          throw new Error(
            "Weather request failed"
          );
        }

        const data = await response.json();

        const weatherCode =
          data.current.weather_code;

        let condition = "Clear";

        if ([1, 2].includes(weatherCode)) {
          condition = "Partly cloudy";
        } else if (weatherCode === 3) {
          condition = "Overcast";
        } else if (
          [51, 53, 55, 56, 57].includes(
            weatherCode
          )
        ) {
          condition = "Drizzle";
        } else if (
          [
            61, 63, 65, 66, 67,
            80, 81, 82
          ].includes(weatherCode)
        ) {
          condition = "Rain";
        } else if (
          [95, 96, 99].includes(weatherCode)
        ) {
          condition = "Thunderstorm";
        } else if (
          [
            71, 73, 75, 77, 85, 86
          ].includes(weatherCode)
        ) {
          condition = "Snow";
        } else if (
          [45, 48].includes(weatherCode)
        ) {
          condition = "Fog";
        }

        setWeather({
          city: location || "Your location",
          condition,
          temperature:
            data.current.temperature_2m,
          wind_speed:
            data.current.wind_speed_10m,
          forecast: {
            max:
              data.daily.temperature_2m_max,
            min:
              data.daily.temperature_2m_min
          }
        });
      } catch (error) {
        console.error(
          "Failed to load weather:",
          error
        );

        setWeather(null);
      }
    }

    loadWeather();
  }, []);

  /*
   * ==============================
   * CHAT STATE HELPERS
   * ==============================
   */

  const patchChat = (chatId, updater) => {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? updater(chat)
          : chat
      )
    );
  };

  const appendMessage = (chatId, message) => {
    setChats((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [
                ...(chat.messages || []),
                message
              ]
            }
          : chat
      )
    );
  };

  async function loadMessages(chatId) {
    try {
      const response = await axios.get(
        `${API}/sessions/${chatId}/messages`
      );

      const stored =
        response.data.messages || [];

      patchChat(chatId, (chat) => ({
        ...chat,
        loaded: true,
        messages: [
          welcomeMessage(user.firstName),
          ...stored
        ]
      }));
    } catch (error) {
      console.error(
        "Failed to load conversation:",
        error
      );

      patchChat(chatId, (chat) => ({
        ...chat,
        loaded: false
      }));
    }
  }

  /*
   * ==============================
   * RESTORE SAVED CHATS
   * ==============================
   */

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await axios.get(
          `${API}/sessions`,
          {
            params: {
              user_id: user.userId
            }
          }
        );

        if (cancelled) return;

        const list =
          response.data.sessions || [];

        if (list.length === 0) {
          setChats([
            localChat(
              user.firstName,
              "local-0"
            )
          ]);

          setActiveId("local-0");
          return;
        }

        const restored = list.map(
          (session) => ({
            id: session.id,
            title: session.title,
            messages: [
              welcomeMessage(user.firstName)
            ],
            loaded: false,
            local: false
          })
        );

        setChats(restored);
        setActiveId(restored[0].id);

        loadMessages(restored[0].id);
      } catch (error) {
        console.error(
          "Failed to load sessions:",
          error
        );

        if (cancelled) return;

        setChats([
          localChat(
            user.firstName,
            "local-0"
          )
        ]);

        setActiveId("local-0");
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.userId]);

  /*
   * ==============================
   * PROFILE SETTINGS
   * ==============================
   */

  useEffect(() => {
    let cancelled = false;

    axios
      .get(`${API}/profile`, {
        params: {
          user_id: user.userId
        }
      })
      .then((response) => {
        if (!cancelled) {
          setPreferredLanguage(
            response.data.preferred_language || ""
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  useEffect(() => {
    return () => {
      if (reminderTimerRef.current) {
        clearTimeout(
          reminderTimerRef.current
        );
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /*
   * ==============================
   * CREATE A NEW CHAT
   * ==============================
   */

  async function createServerChat() {
    try {
      const response = await axios.post(
        `${API}/sessions`,
        {
          user_id: user.userId,
          title: "New chat"
        }
      );

      const chat = {
        id: response.data.id,
        title: response.data.title,
        messages: [
          welcomeMessage(user.firstName)
        ],
        loaded: true,
        local: false
      };

      setChats((previous) => [
        chat,
        ...previous.filter(
          (item) => !item.local
        )
      ]);

      setActiveId(chat.id);
      setInput("");
    } catch (error) {
      console.error(
        "Failed to create session:",
        error
      );

      const id =
        `local-${localIdRef.current++}`;

      const chat = localChat(
        user.firstName,
        id
      );

      setChats((previous) => [
        chat,
        ...previous
      ]);

      setActiveId(id);
      setInput("");
    }
  }

  const newChat = () => {
    setView("chat");
    createServerChat();
  };

  const selectChat = async (chatId) => {
    setView("chat");
    setActiveId(chatId);

    const chat = chats.find(
      (item) => item.id === chatId
    );

    if (
      chat &&
      !chat.loaded &&
      isServerChat(chatId)
    ) {
      await loadMessages(chatId);
    }
  };

  /*
   * ==============================
   * VOICE RESPONSES
   * ==============================
   */

  const speakMessage = (text, messageId) => {
    if (!("speechSynthesis" in window)) {
      alert(
        "Voice output is not supported in this browser."
      );
      return;
    }

    window.speechSynthesis.cancel();

    if (
      speakingMessageRef.current === messageId
    ) {
      speakingMessageRef.current = null;
      setSpeakingMessage(null);
      return;
    }

    const cleanText = text
      .replace(/[*_#`]/g, "")
      .replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      );

    const utterance =
      new SpeechSynthesisUtterance(
        cleanText
      );

    utterance.lang = "en-ZA";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
      speakingMessageRef.current =
        messageId;

      setSpeakingMessage(messageId);
    };

    utterance.onend = () => {
      speakingMessageRef.current = null;
      setSpeakingMessage(null);
    };

    utterance.onerror = () => {
      speakingMessageRef.current = null;
      setSpeakingMessage(null);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  /*
   * ==============================
   * SEND CHAT MESSAGE
   * ==============================
   */

  const send = async (text) => {
    const trimmed = text.trim();

    if (!trimmed || sending) return;

    const chat = chats.find(
      (item) => item.id === activeId
    );

    if (!chat) return;

    const chatId = activeId;

    const onServer =
      isServerChat(chatId);

    const selectedResponseMode =
      responseMode;

    const history =
      (chat.messages || [])
        .filter(
          (message) => !message.error
        )
        .map((message) => ({
          role:
            message.role === "user"
              ? "user"
              : "assistant",
          content: message.text
        }));

    const firstUserMessage =
      !chat.messages.some(
        (message) =>
          message.role === "user"
      );

    if (firstUserMessage) {
      const title =
        trimmed.length > 34
          ? trimmed.slice(0, 34) + "…"
          : trimmed;

      patchChat(
        chatId,
        (current) =>
          current.title === "New chat"
            ? {
                ...current,
                title
              }
            : current
      );

      if (onServer) {
        axios
          .patch(
            `${API}/sessions/${chatId}`,
            { title }
          )
          .catch(() => {});
      }
    }

    appendMessage(chatId, {
      role: "user",
      text: trimmed
    });

    setSending(true);

    try {
      const body = {
        message: trimmed,
        history
      };

      if (preferredLanguage) {
        body.preferred_language =
          preferredLanguage;
      }

      if (onServer) {
        body.user_id = user.userId;
        body.session_id = chatId;
      }

      const response = await axios.post(
        `${API}/chat`,
        body
      );

      const replyText =
        response.data.reply;

      const messageId =
        `${chatId}-${Date.now()}`;

      appendMessage(chatId, {
        role: "emmy",
        text: replyText,
        responseMode:
          selectedResponseMode,
        messageId
      });

      if (
        selectedResponseMode === "voice"
      ) {
        speakMessage(
          replyText,
          messageId
        );
      }
    } catch (error) {
      const details =
        error.response?.data?.details ||
        error.response?.data?.error ||
        "I couldn't reach the server. Check that the backend is running, then try again.";

      appendMessage(chatId, {
        role: "emmy",
        error: true,
        text: details
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const text = input;
    setInput("");

    send(text);
  };

  /*
   * ==============================
   * MICROPHONE INPUT
   * ==============================
   */

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error(
          "Could not start microphone:",
          error
        );
      }
    }
  };

  /*
   * ==============================
   * REMINDER ACTIONS
   * ==============================
   */

  const handleReminderOpen = () => {
    setView("reminders");
    setReminderDismissed(true);
  };

  const handleReminderLater = () => {
    setReminderDismissed(true);

    if (reminderTimerRef.current) {
      clearTimeout(
        reminderTimerRef.current
      );
    }

    reminderTimerRef.current = setTimeout(
      () => {
        setReminderDismissed(false);
      },
      30 * 60 * 1000
    );
  };

  const showChips =
    activeChat &&
    !sending &&
    !activeChat.messages.some(
      (message) =>
        message.role === "user"
    );

  const isStudyToolOpen =
    studyToolActivated &&
    STUDY_TOOL_VIEWS.includes(view);

  const isCurrentContentReady =
    Boolean(studyContentReady[view]);

  /*
   * ==============================
   * SIDEBAR BUTTON
   * ==============================
   */

  const sidebarButton = (
    target,
    label,
    icon,
    onClick,
    extraClass = ""
  ) => (
    <button
      key={target}
      className={
        "sb-item" +
        (extraClass
          ? ` ${extraClass}`
          : "") +
        (view === target
          ? " active"
          : "")
      }
      type="button"
      onClick={
        onClick ||
        (() => setView(target))
      }
    >
      {icon && (
        <span className="ic">
          {icon}
        </span>
      )}

      <span className="label">
        {label}
      </span>
    </button>
  );

  /*
   * ==============================
   * MAIN APPLICATION
   * ==============================
   */

  return (
    <div className="chat-app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="wordmark sb-logo">
          emmy
          <span className="dot">.</span>
        </div>

        <button
          className="btn-new"
          type="button"
          onClick={newChat}
        >
          <span className="plus">
            +
          </span>
          {" "}New chat
        </button>

        <div className="sb-scroll">

          {/* CHAT HISTORY */}
          <button
            className="history-btn"
            type="button"
            onClick={() =>
              setHistoryOpen(!historyOpen)
            }
          >
            <span>History</span>

            <span className="history-arrow">
              {historyOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {historyOpen && (
            <div className="history-list">
              {chats
                .filter(
                  (chat) =>
                    chat.title !== "New chat"
                )
                .map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    className={
                      "sb-item history-item" +
                      (
                        view === "chat" &&
                        chat.id === activeId
                          ? " active"
                          : ""
                      )
                    }
                    onClick={() =>
                      selectChat(chat.id)
                    }
                  >
                    <span className="ic">
                      ◇
                    </span>

                    <span className="label">
                      {chat.title}
                    </span>
                  </button>
                ))}
            </div>
          )}

          <div className="sb-label">
            Study tools
          </div>

          {sidebarButton(
            "reminders",
            "Reminders",
            "◷"
          )}

          {sidebarButton(
            "motivation",
            "Daily Motivation",
            "✦"
          )}

          {sidebarButton(
            "bursary",
            "Bursaries",
            "🎓"
          )}

          {sidebarButton(
            "notes",
            "My notes",
            "▤"
          )}

          {sidebarButton(
            "summary",
            "Summary",
            "",
            () => openStudyTool("summary"),
            "sub-item"
          )}

          {sidebarButton(
            "flashcards",
            "Flashcards",
            "",
            () => openStudyTool("flashcards"),
            "sub-item"
          )}

          {sidebarButton(
            "quiz",
            "Quiz",
            "",
            () => openStudyTool("quiz"),
            "sub-item"
          )}

          {sidebarButton(
            "listenLearn",
            "Listen & Learn",
            "",
            () => openStudyTool("listenLearn"),
            "sub-item"
          )}

          {sidebarButton(
            "timedTest",
            "Timed Test",
            "◷",
            () => openStudyTool("timedTest")
          )}

          {sidebarButton(
            "breakGame",
            "Coloring Game",
            "🎨",
            openColoringGameFromSidebar
          )}

          {/* STUDY SESSION */}
          <div className="sb-label">
            Study Session
          </div>

          <StudyBreakManager
            notesReady={notesReady}
            isStudying={isStudyToolOpen}
            contentReady={isCurrentContentReady}
            onOpenGame={openBreakGame}
            resumeSignal={resumeStudySignal}
            uploadSignal={uploadSignal}
            breakEndAt={breakEndAt}
          />

          <div className="sb-label">
            Account
          </div>

          {sidebarButton(
            "feedback",
            "Feedback",
            "♡"
          )}

          {sidebarButton(
            "profile",
            "Profile",
            "☺"
          )}
        </div>

        {/* USER ACCOUNT */}
        <div className="sb-user">
          <div className="avatar">
            {user.firstName?.[0]?.toUpperCase() || "?"}
          </div>

          <div className="who">
            {user.firstName}
          </div>

          <button
            className="out"
            type="button"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </aside>

      {/* GLOBAL REMINDER POPUP */}
      {dueReminder && !reminderDismissed && (
        <ReminderPopup
          reminder={dueReminder}
          onOpen={handleReminderOpen}
          onLater={handleReminderLater}
        />
      )}

      {/* REMINDERS */}
      {view === "reminders" && (
        <Reminders user={user} />
      )}

      {/* DAILY MOTIVATION */}
      {view === "motivation" && (
        <Motivation user={user} />
      )}

      {/* MY NOTES - DUPLICATE BUTTONS REMOVED */}
      {view === "notes" && (
        <div className="notes-study-layout">
          <Notes
            user={user}
            onUploadSuccess={handleNotesUploadSuccess}
          />
        </div>
      )}

      {/* COLORING GAME */}
      {view === "breakGame" && (
        <ColoringGame
          durationMinutes={breakDurationMinutes}
          onFinish={returnFromBreakGame}
        />
      )}

      {/* SUMMARY */}
      {view === "summary" && (
        <Summary
          onContentReady={handleSummaryReady}
        />
      )}

      {/* FLASHCARDS */}
      {view === "flashcards" && (
        <Flashcards
          onContentReady={handleFlashcardsReady}
        />
      )}

      {/* QUIZ */}
      {view === "quiz" && (
        <Quiz
          onContentReady={handleQuizReady}
        />
      )}

      {/* LISTEN AND LEARN */}
      {view === "listenLearn" && (
        <ListenAndLearn
          onContentReady={handleListenLearnReady}
        />
      )}

      {/* BURSARIES */}
      {view === "bursary" && (
        <BursarySidebar />
      )}

      {/* TIMED TEST */}
      {view === "timedTest" && (
        <TimedTest
          user={user}
          onContentReady={handleTimedTestReady}
        />
      )}
      {/* FEEDBACK */}
      {view === "feedback" && (
        <Feedback user={user} />
      )}
      {/* PROFILE */}
      {view === "profile" && (
        <Profile
          user={user}
          onSaved={setPreferredLanguage}
        />
      )}

      {/* MAIN CHAT SCREEN */}
      {view === "chat" && (
        <div className="chat-main">

          <div className="thread">

            {/* WEATHER */}
            {weather && (
              <div className="weather-card">

                <div className="weather-top">
                  <div>
                    <div className="weather-city">
                      {weather.city}
                    </div>

                    <div className="weather-condition">
                      <span className="weather-icon">
                        {getWeatherIcon(
                          weather.condition
                        )}
                      </span>

                      {weather.condition}
                    </div>
                  </div>

                  <div className="weather-temperature">
                    {Math.round(
                      weather.temperature
                    )}
                    °C
                  </div>
                </div>

                <div className="weather-details">
                  <span>
                    💨 Wind:{" "}
                    {Math.round(
                      weather.wind_speed
                    )}{" "}
                    km/h
                  </span>

                  <span>
                    Today:{" "}
                    {Math.round(
                      weather.forecast.max[0]
                    )}
                    °
                    {" / "}
                    {Math.round(
                      weather.forecast.min[0]
                    )}
                    °
                  </span>
                </div>
              </div>
            )}

            {/* CHAT MESSAGES */}
            {(activeChat?.messages || []).map(
              (message, index) => {
                const messageId =
                  message.messageId || index;

                return (
                  <div
                    key={messageId}
                    className={`msg ${
                      message.role === "user"
                        ? "user"
                        : "emmy"
                    }`}
                  >
                    <div className="bubble">
                      {message.role === "emmy" &&
                      !message.error ? (
                        message.responseMode === "voice" ? (
                          <div className="voice-response">

                            <button
                              type="button"
                              className="speak-button voice-response-button"
                              onClick={() =>
                                speakMessage(
                                  message.text,
                                  messageId
                                )
                              }
                              title={
                                speakingMessage === messageId
                                  ? "Stop speaking"
                                  : "Play emmy's response"
                              }
                            >
                              {speakingMessage === messageId
                                ? "⏹️"
                                : "🔊"}
                            </button>

                            <span>
                              {speakingMessage === messageId
                                ? "emmy is speaking..."
                                : "emmy replied using voice"}
                            </span>
                          </div>
                        ) : (
                          <div className="text-response">
                            {formatEmmyText(
                              message.text
                            )}
                          </div>
                        )
                      ) : (
                        message.text
                      )}
                    </div>
                  </div>
                );
              }
            )}

            {/* THINKING INDICATOR */}
            {sending && (
              <div className="msg emmy">
                <div className="bubble">
                  Thinking...
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* SUGGESTED QUESTIONS */}
          {showChips && (
            <div className="chips">
              {SUGGESTIONS.map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      send(suggestion)
                    }
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          )}

          {/* TEXT OR VOICE RESPONSE */}
          <div className="response-choice">

            <span className="response-choice-label">
              How should emmy reply?
            </span>

            <div className="response-choice-buttons">

              <button
                type="button"
                className={
                  responseMode === "text"
                    ? "response-mode-button active"
                    : "response-mode-button"
                }
                onClick={() =>
                  setResponseMode("text")
                }
                disabled={sending}
              >
                💬 Text
              </button>

              <button
                type="button"
                className={
                  responseMode === "voice"
                    ? "response-mode-button active"
                    : "response-mode-button"
                }
                onClick={() =>
                  setResponseMode("voice")
                }
                disabled={sending}
              >
                🔊 Voice
              </button>

            </div>
          </div>

          {/* MESSAGE INPUT */}
          <form
            className="composer"
            onSubmit={handleSubmit}
          >
            <button
              type="button"
              className={`voice-button ${
                isListening
                  ? "listening"
                  : ""
              }`}
              onClick={toggleVoiceInput}
              disabled={sending}
              title={
                isListening
                  ? "Stop listening"
                  : "Speak to emmy"
              }
            >
              {isListening
                ? "⏹️"
                : "🎤"}
            </button>

            <input
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              placeholder={
                isListening
                  ? "Listening..."
                  : "Ask emmy anything about your studies..."
              }
              disabled={sending}
            />

            <button
              type="submit"
              disabled={
                sending ||
                !input.trim()
              }
            >
              Send
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
