import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Markdown from "./Markdown";
import Reminders from "./Reminders";
import Motivation from "./Motivation";
import Profile from "./Profile";
import ReminderPopup from "./ReminderPopup";
import Notes from "./Notes";
import TimedTest from "./TimedTest";
import Summary from "./Summary";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";

const API = "http://127.0.0.1:5000";

const SUGGESTIONS = [
    "Explain photosynthesis simply",
    "Help me plan exam week",
    "How do I structure an essay?"
];


function welcomeMessage(firstName) {
    return {
        role: "emmy",
        text: `Hi ${firstName}! I'm emmy, your study buddy. You can ask me anything .`
    };
}


// A chat that only lives in the browser: used before the sessions API answers,
// and as a fallback when the backend or database is unreachable so the app
// still works. Its id is a string, which is how send() knows not to persist it.
function localChat(firstName, id) {
    return {
        id,
        title: "New chat",
        messages: [welcomeMessage(firstName)],
        loaded: true,
        local: true
    };
}


const isServerChat = (id) => typeof id === "number";


function Chatbot({ user, onLogout }) {

    // Start with one local chat so the shell is never empty while the sessions
    // list loads. bootstrap() below replaces it with the saved sessions.
    const [chats, setChats] = useState(() => [localChat(user.firstName, "local-0")]);
    const [activeId, setActiveId] = useState("local-0");
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);

    const [dueReminder, setDueReminder] = useState(null);
    const [reminderDismissed, setReminderDismissed] = useState(false);

    // Which pane fills the shell next to the sidebar: "chat", "reminders",
    // "motivation" or "profile". The sidebar stays put; only this side swaps.
    const [view, setView] = useState("chat");
    const [historyOpen, setHistoryOpen] = useState(false);

    // The language saved on the student's profile, sent with each message so
    // emmy opens in it. "" means no preference, and she just follows whatever
    // language they write in.
    const [preferredLanguage, setPreferredLanguage] = useState("");

    const threadEndRef = useRef(null);
    const localIdRef = useRef(1);

    const activeChat = chats.find((c) => c.id === activeId);


    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ block: "end" });
    }, [chats, activeId, sending]);

    useEffect(() => {
        let cancelled = false;

        async function checkReminders() {
            try {
                const res = await axios.get(`${API}/reminders`, {
                    params: { user_id: user.userId }
                });

                if (cancelled) return;

                const reminders = res.data.reminders || [];
                const now = new Date();

                // Find the first reminder that is due and not completed.
                const due = reminders
                    .filter((reminder) => {
                        if (reminder.status === "Done") return false;

                        const dueDate = new Date(reminder.due);
                        return dueDate <= now;
                    })
                    .sort((a, b) => new Date(a.due) - new Date(b.due))[0];

                setDueReminder(due || null);
            } catch {
                // Do not interrupt the chatbot if reminders cannot be loaded.
            }
        }

        checkReminders();

        // Check again every 30 seconds.
        const interval = setInterval(checkReminders, 30000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user.userId]);



    // On sign-in, load this user's saved sessions. Empty -> open a fresh one.
    // Any failure (backend down, no DB) leaves the local chat in place.
    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            try {
                const res = await axios.get(`${API}/sessions`, {
                    params: { user_id: user.userId }
                });

                if (cancelled) return;

                const list = res.data.sessions || [];

                if (list.length === 0) {
                    createServerChat();
                    return;
                }

                const restored = list.map((s) => ({
                    id: s.id,
                    title: s.title,
                    messages: [welcomeMessage(user.firstName)],
                    loaded: false
                }));

                setChats(restored);
                setActiveId(restored[0].id);
                loadMessages(restored[0].id);

            } catch {
                // Stay on the local chat already in state.
            }
        }

        bootstrap();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // The saved language preference, so the very first message of the session
    // already goes out with it. A failure here just leaves emmy following the
    // language the student writes in, which is the normal behaviour anyway.
    useEffect(() => {
        let cancelled = false;

        axios
            .get(`${API}/profile`, { params: { user_id: user.userId } })
            .then((res) => {
                if (!cancelled) setPreferredLanguage(res.data.preferred_language || "");
            })
            .catch(() => { });

        return () => { cancelled = true; };
    }, [user.userId]);


    const patchChat = (chatId, updater) => {
        setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));
    };


    const appendMessage = (chatId, message) => {
    setChats((prev) =>
        prev.map((chat) =>
            chat.id === chatId
                ? {
                    ...chat,
                    messages: [...(chat.messages || []), message]
                }
                : chat
        )
    );
};


    // Pull a saved session's messages the first time it's opened, and prepend
    // the (unsaved) welcome line so every thread reads the same way.
    async function loadMessages(chatId) {
    try {
        console.log("Loading conversation:", chatId);

        const res = await axios.get(
            `${API}/sessions/${chatId}/messages`
        );

        console.log("Conversation response:", res.data);

        const stored = res.data.messages || [];

        patchChat(chatId, (c) => ({
            ...c,
            loaded: true,
            messages: [
                welcomeMessage(user.firstName),
                ...stored
            ]
        }));

    } catch (error) {
        console.error(
            "Failed to load conversation:",
            error.response?.data || error.message
        );

        patchChat(chatId, (c) => ({
            ...c,
            loaded: false
        }));
    }
}


    async function createServerChat() {
        try {
            const res = await axios.post(`${API}/sessions`, {
                user_id: user.userId,
                title: "New chat"
            });
            const chat = {
                id: res.data.id,
                title: res.data.title,
                messages: [welcomeMessage(user.firstName)],
                loaded: true
            };
            setChats((prev) => [chat, ...prev.filter((c) => !c.local)]);
            setActiveId(chat.id);
            setInput("");
        } catch {
            // Couldn't reach the sessions API: open a browser-only chat instead.
            const id = `local-${localIdRef.current++}`;
            const chat = localChat(user.firstName, id);
            setChats((prev) => [chat, ...prev]);
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

    const chat = chats.find((c) => c.id === chatId);

    if (chat && !chat.loaded && isServerChat(chatId)) {
        await loadMessages(chatId);
    }
};


    const send = async (text) => {

        const trimmed = text.trim();
        if (!trimmed || sending) return;

        const chat = chats.find((c) => c.id === activeId);
        if (!chat) return;

        const chatId = activeId;
        const onServer = isServerChat(chatId);

        // The turns already in this chat, so emmy can follow the conversation.
        // Captured before we append the new message (which goes as `message`),
        // and error bubbles are dropped: they are client-side notices, not
        // things emmy said. emmy's turns map to the "assistant" role.
        const history = (chat.messages ?? [])
            .filter((m) => !m.error)
            .map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text
            }));

        // First user message names the chat, in the sidebar and, for a saved
        // session, in the database.
        const firstUserMessage = !chat.messages.some((m) => m.role === "user");

        if (firstUserMessage) {
            const title = trimmed.length > 34 ? trimmed.slice(0, 34) + "…" : trimmed;
            patchChat(chatId, (c) =>
                c.title === "New chat" ? { ...c, title } : c
            );
            if (onServer) {
                axios.patch(`${API}/sessions/${chatId}`, { title }).catch(() => { });
            }
        }

        appendMessage(chatId, { role: "user", text: trimmed });
        setSending(true);

        try {

            const body = { message: trimmed, history };
            if (preferredLanguage) {
                body.preferred_language = preferredLanguage;
            }
            if (onServer) {
                body.user_id = user.userId;
                body.session_id = chatId;
            }

            const response = await axios.post(`${API}/chat`, body);

            appendMessage(chatId, { role: "emmy", text: response.data.reply });

        } catch (error) {

            const details =
                error.response?.data?.details ||
                error.response?.data?.error ||
                "I couldn't reach the server. Check that the backend is running, then try again.";

            appendMessage(chatId, { role: "emmy", error: true, text: details });

        } finally {
            setSending(false);
        }

    };


    const handleSubmit = (e) => {
        e.preventDefault();
        const text = input;
        setInput("");
        send(text);
    };

    const handleReminderOpen = () => {
        setView("reminders");
        setReminderDismissed(true);
    };

    const handleReminderLater = () => {
        setReminderDismissed(true);

        // Show the reminder again after 30 minutes.
        setTimeout(() => {
            setReminderDismissed(false);
        }, 30 * 60 * 1000);
    };
    const showChips =
        activeChat &&
        !sending &&
        !activeChat.messages.some((m) => m.role === "user");


    return (
        <div className="chat-app">

            <aside className="sidebar">

                <div className="wordmark sb-logo">
                    emmy<span className="dot">.</span>
                </div>

                <button className="btn-new" type="button" onClick={newChat}>
                    <span className="plus">+</span> New chat
                </button>

                <div className="sb-scroll">

                    <button
    className="history-button"
    type="button"
    onClick={() => setHistoryOpen(!historyOpen)}
>
    <span>History</span>

    <span className="history-arrow">
        {historyOpen ? "⌃" : "⌄"}
    </span>
</button>

{historyOpen && (
    <div className="history-list">

        {chats
            .filter((chat) => {
                return chat.title !== "New chat";
            })
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
                    onClick={() => selectChat(chat.id)}
                >
                    <span className="ic">◇</span>

                    <span className="label">
                        {chat.title}
                    </span>
                </button>
            ))}

    </div>
)}
                    <div className="sb-label">Study tools</div>

                    {/* Sidebar icons are monochrome text glyphs, never emoji: a
                        colour emoji next to the mint active row breaks the one
                        accent rule (FRONTEND_DESIGN.md section 2). */}
                    <button
                        className={"sb-item" + (view === "reminders" ? " active" : "")}
                        type="button"
                        onClick={() => setView("reminders")}
                    >
                        <span className="ic">◷</span>
                        <span className="label">Reminders</span>
                    </button>
                    <button
                        className={"sb-item" + (view === "motivation" ? " active" : "")}
                        type="button"
                        onClick={() => setView("motivation")}
                    >
                        <span className="ic">✦</span>
                        <span className="label">Daily Motivation</span>
                    </button>
                    <button
                        className={"sb-item" + (view === "notes" ? " active" : "")}
                        type="button"
                        onClick={() => setView("notes")}
                    >
                        <span className="ic">▤</span>
                        <span className="label">My notes</span>
                    </button>
                    <button
                        className={"sb-item sub-item" + (view === "summary" ? " active" : "")}
                        type="button"
                        onClick={() => setView("summary")}
                    >
                        <span className="label">Summary</span>
                    </button>

                    <button
                        className={"sb-item sub-item" + (view === "flashcards" ? " active" : "")}
                        type="button"
                        onClick={() => setView("flashcards")}
                    >
                        <span className="label">Flashcards</span>
                    </button>

                    <button
                        className={"sb-item sub-item" + (view === "quiz" ? " active" : "")}
                        type="button"
                        onClick={() => setView("quiz")}
                    >
                        <span className="label">Quiz</span>
                    </button>
                    <button
                        className={"sb-item" + (view === "timedTest" ? " active" : "")}
                        type="button"
                        onClick={() => setView("timedTest")}
                    >
                        <span className="ic">◷</span>
                        <span className="label">Timed Test</span>
                    </button>
                    

                    <div className="sb-label">Account</div>

                    <button
                        className={"sb-item" + (view === "profile" ? " active" : "")}
                        type="button"
                        onClick={() => setView("profile")}
                    >
                        <span className="ic">☺</span>
                        <span className="label">Profile</span>
                    </button>

                </div>

                <div className="sb-user">
                    <div className="avatar">
                        {user.firstName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="who">{user.firstName}</div>
                    <button className="out" type="button" onClick={onLogout}>
                        Log out
                    </button>
                </div>

            </aside>

            {view === "reminders" && <Reminders user={user} />}

            {view === "motivation" && <Motivation user={user} />}
            {view === "notes" && <Notes user={user} />}
            {view === "summary" && <Summary />}

            {view === "flashcards" && <Flashcards />}

            {view === "quiz" && <Quiz />}


            {view === "timedTest" && <TimedTest user={user} />}

            {view === "profile" && (
                <Profile user={user} onSaved={setPreferredLanguage} />
            )}

            {view === "chat" && (
                <div className="chat-main">
                    {dueReminder && !reminderDismissed && (
                        <ReminderPopup
                            reminder={dueReminder}
                            onOpen={handleReminderOpen}
                            onLater={handleReminderLater}
                        />
                    )}

                    

                    <div className="thread">

                        {activeChat?.messages.map((msg, i) => (
                            <div
                                key={i}
                                className={
                                    "msg" +
                                    (msg.role === "user" ? " user" : "") +
                                    (msg.error ? " error" : "")
                                }
                            >
                                {msg.role === "emmy" && (
                                    <div className="em-av">e</div>
                                )}
                                <div className="bubble">
                                    {msg.role === "emmy" && !msg.error ? (
                                        <Markdown text={msg.text} />
                                    ) : (
                                        msg.text
                                    )}
                                </div>
                            </div>
                        ))}

                        {sending && (
                            <div className="msg">
                                <div className="em-av">e</div>
                                <div className="typing-bubble">
                                    <i></i><i></i><i></i>
                                </div>
                            </div>
                        )}

                        <div ref={threadEndRef} />

                    </div>

                    {showChips && (
                        <div className="chips">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    className="chip"
                                    onClick={() => send(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <form className="composer" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder="Ask emmy anything about your studies…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            autoComplete="off"
                        />
                        <button
                            className="btn-send"
                            type="submit"
                            disabled={sending || !input.trim()}
                        >
                            Send
                        </button>
                    </form>

                </div>
            )}

        </div>
    );

}


export default Chatbot;
