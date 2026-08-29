import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:5000";

const PENDING = "Pending";
const DONE = "Done";


// "Thu 30 Jul, 14:30". The stored value is the browser's own datetime-local
// shape, so new Date() reads it as local time, which is the time the student
// typed.
function formatDue(due) {
    const date = new Date(due);

    if (Number.isNaN(date.getTime())) return due;

    return date.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}


const isOverdue = (reminder) =>
    reminder.status === PENDING && new Date(reminder.due) < new Date();


// Default the new-reminder form to this time tomorrow, in the datetime-local
// shape. Most study reminders are for soon, and a prefilled field is one less
// thing to fill in.
function defaultDue() {
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setSeconds(0, 0);

    const pad = (n) => String(n).padStart(2, "0");

    return (
        `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
        `T${pad(when.getHours())}:${pad(when.getMinutes())}`
    );
}


function Reminders({ user }) {

    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [due, setDue] = useState(defaultDue);
    const [saving, setSaving] = useState(false);


    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await axios.get(`${API}/reminders`, {
                    params: { user_id: user.userId }
                });
                if (!cancelled) setReminders(res.data.reminders || []);
            } catch {
                if (!cancelled) {
                    setError("I couldn't load your reminders. Check that the backend is running, then try again.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [user.userId]);


    const add = async (e) => {
        e.preventDefault();

        const trimmed = title.trim();
        if (!trimmed || !due || saving) return;

        setSaving(true);
        setError("");

        try {
            const res = await axios.post(`${API}/reminders`, {
                user_id: user.userId,
                title: trimmed,
                description: description.trim(),
                due
            });

            setReminders((prev) =>
                [...prev, res.data].sort((a, b) => a.due.localeCompare(b.due))
            );

            setTitle("");
            setDescription("");
            setDue(defaultDue());

        } catch (err) {
            setError(err.response?.data?.error || "I couldn't save that reminder. Try again?");
        } finally {
            setSaving(false);
        }
    };


    const toggle = async (reminder) => {
        const status = reminder.status === DONE ? PENDING : DONE;

        // Tick it straight away: the student sees the change, and a failed
        // request puts it back rather than leaving the list out of step.
        setReminders((prev) =>
            prev.map((r) => (r.id === reminder.id ? { ...r, status } : r))
        );

        try {
            await axios.patch(`${API}/reminders/${reminder.id}`, {
                user_id: user.userId,
                status
            });
        } catch {
            setReminders((prev) =>
                prev.map((r) => (r.id === reminder.id ? { ...r, status: reminder.status } : r))
            );
            setError("I couldn't update that reminder. Try again?");
        }
    };


    const remove = async (reminder) => {
        const previous = reminders;

        setReminders((prev) => prev.filter((r) => r.id !== reminder.id));

        try {
            await axios.delete(`${API}/reminders/${reminder.id}`, {
                params: { user_id: user.userId }
            });
        } catch {
            setReminders(previous);
            setError("I couldn't delete that reminder. Try again?");
        }
    };


    const todo = reminders.filter((r) => r.status !== DONE);
    const done = reminders.filter((r) => r.status === DONE);


    const item = (reminder) => (
        <li
            key={reminder.id}
            className={
                "rem-item" +
                (reminder.status === DONE ? " done" : "") +
                (isOverdue(reminder) ? " overdue" : "")
            }
        >
            <button
                className="rem-tick"
                type="button"
                onClick={() => toggle(reminder)}
                aria-pressed={reminder.status === DONE}
                title={reminder.status === DONE ? "Mark as still to do" : "Mark as done"}
            >
                {reminder.status === DONE ? "✓" : ""}
            </button>

            <div className="rem-body">
                <div className="rem-title">{reminder.title}</div>
                {reminder.description && (
                    <div className="rem-desc">{reminder.description}</div>
                )}
                <div className="rem-when">
                    {formatDue(reminder.due)}
                    {isOverdue(reminder) && <span className="rem-late">Overdue</span>}
                </div>
            </div>

            <button
                className="rem-del"
                type="button"
                onClick={() => remove(reminder)}
                title="Delete this reminder"
            >
                Delete
            </button>
        </li>
    );


    return (
        <div className="tool-main">

            <div className="chat-head">
                <h1>Reminders</h1>
                <span className="status">
                    {todo.length} to do
                </span>
            </div>

            <div className="tool-scroll">

                <form className="tool-card rem-form" onSubmit={add}>

                    <div className="rem-row">
                        <div className="field">
                            <label htmlFor="rem-title">What do you need to do?</label>
                            <input
                                id="rem-title"
                                type="text"
                                placeholder="Revise chapter 4"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={100}
                                autoComplete="off"
                            />
                        </div>

                        <div className="field rem-when-field">
                            <label htmlFor="rem-due">When</label>
                            <input
                                id="rem-due"
                                type="datetime-local"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="rem-desc">Notes (optional)</label>
                        <input
                            id="rem-desc"
                            type="text"
                            placeholder="Focus on the worked examples"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    <button
                        className="btn-tool"
                        type="submit"
                        disabled={saving || !title.trim() || !due}
                    >
                        {saving ? "Adding…" : "Add reminder"}
                    </button>

                </form>

                {error && <p className="form-error tool-error">{error}</p>}

                {loading ? (
                    <p className="tool-empty">Loading your reminders…</p>
                ) : reminders.length === 0 ? (
                    <p className="tool-empty">
                        No reminders yet. Add the first one above and emmy will keep it here for you.
                    </p>
                ) : (
                    <>
                        <div className="tool-label">To do</div>
                        {todo.length === 0 ? (
                            <p className="tool-empty">All caught up. Nice work.</p>
                        ) : (
                            <ul className="rem-list">{todo.map(item)}</ul>
                        )}

                        {done.length > 0 && (
                            <>
                                <div className="tool-label">Done</div>
                                <ul className="rem-list">{done.map(item)}</ul>
                            </>
                        )}
                    </>
                )}

            </div>

        </div>
    );

}


export default Reminders;
