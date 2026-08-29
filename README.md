# EMMY Student Support Chatbot

AI-powered **student support** web app: students log in and chat with an assistant for studying, academic questions, motivation, and learning help.

| | |
|--|--|
| **Frontend** | React (Create React App) + Axios |
| **Backend** | Flask + flask-cors |
| **Database** | MySQL (`EmmyStudentSupportChatBot`) |
| **AI** | DeepSeek API (`deepseek-v4-flash`, OpenAI-compatible SDK) |

---

## Documentation (`docs/`)

Persistent project memory lives under **[docs/](./docs/)** so this root stays clean:

| Document | Purpose |
|----------|---------|
| **[docs/AGENTS.md](./docs/AGENTS.md)** | Rules for AI agents & contributors (read first if you are an agent) |
| **[docs/PROJECT_SCOPE.md](./docs/PROJECT_SCOPE.md)** | Full product scope, features, requirements, success criteria |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design, API contracts, database model |
| **[docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md)** | What is built vs planned; known bugs |
| **[docs/DEVLOG.md](./docs/DEVLOG.md)** | Chronological log of work — **append after every meaningful change** |
| **[docs/README.md](./docs/README.md)** | Docs folder index |

---

## Current capability (honest)

**Working:**

- Register + login (UI + API) → MySQL `Users`
- Chat UI → Flask `/chat` → DeepSeek student-support replies, with the conversation carried across turns
- **Chat history persists per user**: named chats saved to `ChatSessions` + `ChatHistory`, restored in the sidebar after refresh or re-login
- **Study reminders**: add, tick off and delete reminders, with overdue ones flagged (`Reminders`)
- **Word of the day**: one academic word a day with its meaning and an example, picked for the student's course and explained in their language, then held stable until tomorrow (`DailyWords`)
- **Student profile**: course, year of study and preferred language (`UserProfiles`). emmy opens new answers in the saved language, and still switches to whatever the student writes in

**Designed in SQL but not built in app yet:**

- Note uploads, quizzes, feedback

Details: [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md).

---

## Project structure

```
EMMY_StudentSupportChatBot/
├── AGENTS.md                          ← thin pointer → docs/AGENTS.md
├── README.md                          ← you are here
├── docs/                              ← all project memory
│   ├── AGENTS.md
│   ├── PROJECT_SCOPE.md
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── DEVLOG.md
│   └── README.md
├── backend/
│   ├── app.py                         ← Flask routes + DeepSeek chat
│   ├── database.py                    ← mysql.connector factory
│   ├── db.sql                         ← full schema (all tables)
│   ├── seed.sql                       ← demo user
│   ├── setup_database.py              ← one command: build DB from db.sql + seed.sql
│   ├── setup_mysql.ps1               ← Windows wrapper for setup_database.py
│   ├── migrate_chat_sessions.py       ← upgrade an existing DB in place
│   ├── migrate_profiles.py            ← same, for the one-profile-per-student key
│   ├── migrate_daily_words.py         ← same, for the word-of-the-day cache
│   ├── requirements.txt
│   ├── .env.example                   ← copy to .env
│   └── VirtualEnvironment/            ← Python venv (not committed; recreate locally)
└── frontend/
    └── src/
        ├── App.js
        ├── Login.jsx
        ├── Chatbot.jsx                ← shell: sidebar + chat / reminders / profile
        ├── Reminders.jsx              ← study reminders pane
        ├── Motivation.jsx             ← word of the day pane
        ├── Profile.jsx                ← course, year, preferred language
        └── Markdown.jsx               ← renders emmy's Markdown + KaTeX maths
```

---

## Prerequisites

- Python 3.x  
- Node.js + npm  
- MySQL Server  
- DeepSeek API key ([platform.deepseek.com](https://platform.deepseek.com/api_keys))  

---

## Setup

Moving to a new machine? You only need this repo, a running MySQL, Node, Python
and a DeepSeek key. The whole database is defined in files (`backend/db.sql` +
`backend/seed.sql`), so there is nothing to hand-copy from another computer's
database.

### 1. Backend environment

**First time on this machine** — create the virtual environment and install the dependencies (any Python 3.9+):

```bash
cd backend
python -m venv VirtualEnvironment

# Windows PowerShell:
.\VirtualEnvironment\Scripts\Activate.ps1
# macOS / Linux:
# source VirtualEnvironment/bin/activate

pip install -r requirements.txt
```

> Do **not** copy a `VirtualEnvironment/` folder from another computer or share it in a zip. A venv hardcodes the path of the Python that built it, and its compiled packages only load on that exact Python version, so a copied one fails with errors like `did not find executable at ...python.exe`. Always recreate it from `requirements.txt`.

Then create your `.env` from the template and fill in the values:

```bash
copy .env.example .env      # Windows  (macOS/Linux: cp .env.example .env)
```

`.env` holds your `DEEPSEEK_API_KEY` and the MySQL connection (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). `database.py` falls back to `localhost` / `root` / empty password / `EmmyStudentSupportChatBot` if a value is missing.

> **Using VS Code?** `.vscode/settings.json` points the editor at this venv. If you still see *"Import `flask` could not be resolved"* on `app.py`, VS Code has picked a different Python: press `Ctrl+Shift+P` → **Python: Select Interpreter** → **Enter interpreter path** → `backend\VirtualEnvironment\Scripts\python.exe`. Those errors are editor-only and don't stop the app from running.

### 2. Database (one command)

Start MySQL, then build the database, all tables and a demo user straight from the `.sql` files:

```bash
cd backend
python setup_database.py         # Windows shortcut: powershell -ExecutionPolicy Bypass -File setup_mysql.ps1
```

This reads `db.sql` (schema) and `seed.sql` (demo account) and applies them using your `.env` settings. It is **safe to re-run** — anything already there is left as-is. When it finishes you have a working login:

```
demo@example.com / changeme
```

> Passwords are stored in **plain text** (known tech debt). The demo account is for local use only — do not reuse a real password.
>
> **Already had an older copy of this database?** Instead of the above, run `python migrate_chat_sessions.py`, `python migrate_profiles.py` and `python migrate_daily_words.py` once each. They add the chat-session tables and the one-profile-per-student key to your existing data without dropping anything, and are safe to re-run.

### 3. Run the backend

```bash
cd backend
.\VirtualEnvironment\Scripts\Activate.ps1     # macOS/Linux: source VirtualEnvironment/bin/activate
python app.py
```

Backend: `http://127.0.0.1:5000`  
Smoke tests:

- `GET http://127.0.0.1:5000/`  
- `GET http://127.0.0.1:5000/test-db` (confirms MySQL is connected)

### 4. Frontend

```bash
cd frontend
npm install
npm start
```

App: `http://localhost:3000` (typical CRA default).

---

## API quick reference

| Method | Path | Body / params |
|--------|------|---------------|
| GET | `/` | — |
| GET | `/test-db` | — |
| POST | `/register` | `FirstName`, `LastName`, `Email`, `Password` |
| POST | `/login` | `Email`, `Password` |
| POST | `/chat` | `message`, optional `history`, `user_id`, `session_id` |
| GET | `/sessions` | `?user_id=` |
| POST | `/sessions` | `user_id`, optional `title` |
| PATCH | `/sessions/<id>` | `title` |
| GET | `/sessions/<id>/messages` | — |

Full contracts: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## For AI agents

1. Read **[docs/AGENTS.md](./docs/AGENTS.md)** first.  
2. Prefer small, reversible changes.  
3. After work: update **[docs/DEVLOG.md](./docs/DEVLOG.md)** and **[docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md)**.  
4. Never commit or paste real API keys / DB passwords into markdown.  
5. Keep new project-memory docs under **`docs/`**.

---

## For classmates helping each other

- This is a **student support chatbot** class-style project, not a finished product.  
- The SQL schema is a roadmap of features; only login + chat are substantially wired.  
- Use **`docs/`** as shared memory across sessions and tools.

---

## License / academic use

Treat this as an academic project. Follow your institution’s rules on collaboration and AI-assisted work.
