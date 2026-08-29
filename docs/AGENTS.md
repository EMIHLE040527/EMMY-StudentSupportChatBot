# AGENTS.md — Instructions for AI Agents & Future Contributors

> **Read this file first** before changing any code in this repository.
> This is the persistent operating manual for AI agents, students, and developers.

---

## Project identity

| Field | Value |
|-------|--------|
| **Name** | EMMY Student Support Chatbot |
| **Also known as** | EmmyStudentSupportChatBot |
| **Type** | Full-stack student support web application (academic / class project) |
| **Primary goal** | Help students with studying, academic questions, motivation, and learning support via an AI chatbot |
| **Audience** | Students logging into a simple web UI to chat with an AI assistant |

This is **not** a production SaaS product yet. Treat it as a student project that should become demo-ready, understandable, and incrementally completable.

---

## Mandatory reading order

All project memory lives under **`docs/`** (this folder). Before implementing anything, open and internalize:

1. **`docs/AGENTS.md`** (this file) — how to work here  
2. **`docs/PROJECT_SCOPE.md`** — product vision, features, out-of-scope  
3. **`docs/CURRENT_STATE.md`** — what exists vs planned, known bugs  
4. **`docs/ARCHITECTURE.md`** — stack, folders, data model, API  
5. **`docs/FRONTEND_DESIGN.md`** — design system and copy voice (**mandatory before any `frontend/` change**)  
6. **`docs/DEVLOG.md`** — chronological history of decisions and changes  
7. **`README.md`** (project root) — human setup and run instructions  

After meaningful work, **update** `docs/DEVLOG.md` and, if status changed, `docs/CURRENT_STATE.md`.

There is a thin **`AGENTS.md`** at project root that only points here, so tools that auto-load root `AGENTS.md` still find the project.

---

## Repository layout (where the real project lives)

```
EMMY_StudentSupportChatBot/                 ← outer folder (workspace may open here)
└── EMMY_StudentSupportChatBot/             ← actual project root
    ├── AGENTS.md                           ← thin pointer → docs/AGENTS.md
    ├── README.md                           ← human entrypoint
    ├── docs/                               ← all persistent project memory
    │   ├── AGENTS.md
    │   ├── PROJECT_SCOPE.md
    │   ├── ARCHITECTURE.md
    │   ├── CURRENT_STATE.md
    │   ├── DEVLOG.md
    │   └── README.md                       ← docs index
    ├── .gitignore                          ← keeps .env + venv out of git
    ├── backend/                            ← Flask + MySQL + DeepSeek
    │   ├── app.py                          ← routes + SYSTEM_PROMPT (emmy's voice/format)
    │   ├── database.py
    │   ├── db.sql
    │   ├── requirements.txt                ← pinned deps; source of truth for the venv
    │   ├── .env                            ← secrets (do not commit / do not paste into docs)
    │   └── VirtualEnvironment/             ← local venv (do not edit, do not copy between machines)
    └── frontend/                           ← React (CRA)
        ├── src/
        │   ├── App.js
        │   ├── Login.jsx
        │   ├── Chatbot.jsx                 ← shell: sidebar + chat / reminders / profile
        │   ├── Reminders.jsx               ← study reminders pane
        │   ├── Profile.jsx                 ← course, year, preferred language
        │   └── Markdown.jsx                ← renders emmy's Markdown + KaTeX maths
        └── node_modules/                   ← do not edit
```

**Ignore** when searching or editing: `node_modules/`, `VirtualEnvironment/`, `__pycache__/`, build artifacts.

---

## Tech stack (do not casually replace)

| Layer | Choice | Notes |
|-------|--------|--------|
| Frontend | React 19 (Create React App) | `react-scripts`; Axios for HTTP |
| Backend | Flask 3 + flask-cors | Runs on `http://127.0.0.1:5000` |
| Database | MySQL | DB name: `EmmyStudentSupportChatBot` |
| AI | DeepSeek (via OpenAI-compatible SDK) | Model: `deepseek-v4-flash`; base URL `https://api.deepseek.com` |
| Config | python-dotenv | `DEEPSEEK_API_KEY` from `backend/.env` |

Prefer improving this stack over introducing new frameworks (Next.js, FastAPI, Prisma, etc.) unless the human explicitly requests a rewrite.

---

## How the app works today (happy path)

1. User opens React app → sees **Login**.  
2. `POST /login` with `{ Email, Password }` → Flask checks MySQL `Users`.  
3. On success, React sets `loggedIn = true` → shows **Chatbot**.  
4. User sends message → `POST /chat` with `{ message }`.  
5. Flask calls DeepSeek with a student-support system prompt → returns `{ reply }`.  
6. UI shows the latest bot reply only (no multi-turn history in the UI yet).

---

## Working rules for agents

### Do

- Prefer **small, reversible** changes that match existing style (simple Flask routes, functional React components).  
- Keep student-level code readable; this is a class project, not enterprise over-engineering.  
- Put secrets only in `.env` / local config — **never** hardcode new secrets into source or markdown.  
- When finishing a task: update **`docs/DEVLOG.md`** with date, what changed, why.  
- If you complete or start a feature: update **`docs/CURRENT_STATE.md`** feature table.  
- If you change API contracts or schema: update **`docs/ARCHITECTURE.md`**.  
- If product goals change: update **`docs/PROJECT_SCOPE.md`**.  
- Fix related bugs you touch (e.g. if editing login, fix obvious login error handling).  

### Do not

- Commit or document real API keys, DB passwords, or personal data.  
- Delete or rewrite large parts of the app without human confirmation.  
- Add heavy dependencies without a clear need.  
- Leave `db.sql` worse than you found it (duplicate `CREATE TABLE` blocks are a known issue).  
- Store passwords in plain text in **new** code — if you touch auth, move toward hashing (e.g. bcrypt/werkzeug) and document the migration in DEVLOG.  
- Break local demo paths without updating root `README.md`.  
- Scatter new project-memory docs outside **`docs/`** — keep the workspace root clean.  

### Security note (existing debt)

The codebase currently has:

- Plain-text password comparison / storage  
- DB credentials hardcoded in `database.py`  

Document and improve carefully; do not print secrets into chat or markdown when refactoring.

---

## Priority backlog (default order unless human says otherwise)

1. **Make the demo reliable** — env config, clean schema, login correctness, chat works.  
2. **Auth UX** — register UI, logout, persist user id for later features.  
3. **Chat quality** — message history in UI; optionally save to `ChatHistory`.  
4. **Schema-aligned features** — notes, quizzes, feedback (profiles and reminders shipped 2026-07-25; see PROJECT_SCOPE).  
5. **Hardening** — password hashing, env-based DB config, basic validation/errors.  
6. **Polish** — UI/UX appropriate for a student-support product (distinctive, not generic slop).  

---

## Coding conventions

### Backend (`backend/`)

- Flask routes in `app.py` (keep modularization light until file gets large).  
- DB access via `get_database_connection()` in `database.py`.  
- JSON request/response with `jsonify`.  
- CORS enabled for local React dev.  
- Route style today: simple functions, minimal middleware — match that until sessions/JWT are intentionally added.  

### Frontend (`frontend/src/`)

- **Follow `docs/FRONTEND_DESIGN.md`** — tokens, type roles, voice, and component classes are fixed there.  
- Functional components + `useState`.  
- Axios to `http://127.0.0.1:5000/...`.  
- `App.js` gates Login vs Chatbot via a `user` object (`{ userId, firstName }`, null when signed out).  
- Prefer clear component names and minimal prop drilling for now.  

### Database

- Source of truth for intended schema: `backend/db.sql` (needs cleanup).  
- Table names / columns are PascalCase in SQL as written (`UserID`, `FirstName`, …).  
- Match existing naming when writing queries.  

---

## API surface (current)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/` | Health string | Working |
| GET | `/test-db` | MySQL connectivity check | Working |
| POST | `/register` | Create user | API only (no UI) |
| POST | `/login` | Authenticate user | Working (UI + API; weak error handling) |
| POST | `/chat` | DeepSeek student support reply | Working (no history persistence) |

Details and payloads: see `docs/ARCHITECTURE.md`.

---

## Environment expectations

| Variable / config | Where | Purpose |
|-------------------|--------|---------|
| `DEEPSEEK_API_KEY` | `backend/.env` | DeepSeek client (required) |
| `DEEPSEEK_BASE_URL` | `backend/.env` | Default `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | `backend/.env` | Default `deepseek-v4-flash` |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `backend/.env` | MySQL connection; `database.py` falls back to `localhost` / `root` / empty / `EmmyStudentSupportChatBot` |

Frontend expects backend at **`http://127.0.0.1:5000`**.

**The venv is disposable, `requirements.txt` is not.** Recreate `backend/VirtualEnvironment/` with `python -m venv VirtualEnvironment` + `pip install -r requirements.txt`. Never copy a venv between machines: it hardcodes the absolute path of the Python that built it and its compiled packages are tied to that exact version. If you add a backend dependency, pin it in `requirements.txt` in the same change.

---

## Definition of done (for any task)

- [ ] Code runs for the happy path of the feature  
- [ ] No secrets introduced into tracked docs  
- [ ] `docs/DEVLOG.md` entry added  
- [ ] `docs/CURRENT_STATE.md` updated if feature status changed  
- [ ] `docs/ARCHITECTURE.md` / `docs/PROJECT_SCOPE.md` updated if contracts or goals changed  
- [ ] Root `README.md` run steps still accurate  

---

## Communication with humans

When reporting status, be explicit about:

- What is **implemented** vs **schema-only** vs **not started**  
- What blocks a classroom demo  
- Any security debt you touched or left alone  

This project is often assisted across sessions and tools (Grok, Claude, Cursor, classmates). **The files in `docs/` are the shared memory.** Keep them honest and current.
