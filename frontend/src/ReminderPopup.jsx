function ReminderPopup({ reminder, onOpen, onLater }) {
    if (!reminder) {
        return null;
    }

    const dueDate = new Date(reminder.due);

    const formattedDate = dueDate.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });

    return (
        <div className="reminder-popup">

            <div className="reminder-popup-header">
                <span className="reminder-bell">🔔</span>
                <strong>Reminder</strong>
            </div>

            <div className="reminder-popup-body">
                <h3>{reminder.title}</h3>

                {reminder.description && (
                    <p>{reminder.description}</p>
                )}

                <div className="reminder-popup-time">
                    Due: {formattedDate}
                </div>
            </div>

            <div className="reminder-popup-actions">

                <button
                    type="button"
                    className="reminder-open-btn"
                    onClick={onOpen}
                >
                    Open
                </button>

                <button
                    type="button"
                    className="reminder-later-btn"
                    onClick={onLater}
                >
                    Later
                </button>

            </div>

        </div>
    );
}

export default ReminderPopup;