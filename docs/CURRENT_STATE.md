# CURRENT_STATE.md — What Exists Right Now

> Snapshot of implementation status for agents and developers.  
> **Update this file whenever feature status changes.**  
> **Last audited:** 2026-07-25

---

## One-sentence status

**Register, login, multi-turn chat with saved history, study reminders, a word of the day and a student profile all work end-to-end; notes, quizzes and feedback are still schema-only.**

---

## Feature status matrix

| Feature | Backend | Frontend | Database | Overall |
|---------|---------|----------|----------|---------|
| Health check `/` | Done | N/A | N/A | **Done** |
| DB test `/test-db` | Done | N/A | Depends on MySQL setup | **Done** (env-dependent) |
| Register | API done | Done (flip on login card) | `Users` | **Done** (plain-text password debt remains) |
| Login | API done | Done (inline errors, no false success) | `Users` + demo seeds | **Done** |
| AI Chat | API done (formatting system prompt; replies in the student's language, opening in their saved one; sends prior turns; persists exchange) | Done (full thread, typing indicator, Markdown + KaTeX maths) | Persisted to `ChatHistory` per session | **Done** (context sent K13, exchanges saved K7) |
| Chat history | `GET/POST /sessions`, `GET /sessions/<id>/messages`, `PATCH /sessions/<id>`; insert on `/chat` | Sidebar restores saved sessions; a chat reloads its thread on click | `ChatSessions` + `ChatHistory.SessionID` (migration + db.sql) | **Done** (survives refresh, per user; K7 fixed) |
| Word of the day | `GET /motivation` (DeepSeek generated, cached per student per day) | Word of the day pane | `DailyWords` | **Done** |
| User profiles | `GET/PUT /profile` | Profile pane (course, year, preferred language) | `UserProfiles`, one row per student (`uq_userprofiles_user`) | **Done** |
| Reminders | `GET/POST /reminders`, `PATCH/DELETE /reminders/<id>` | Reminders pane (add, tick off, delete, overdue flag) | `Reminders` | **Done** |
| Upload notes | Missing | Missing | Table exists | **Not started** |
| Quizzes from notes | Missing | Missing | Table exists | **Not started** |
| Feedback | Missing | Missing | Table exists | **Not started** |
| Logout | N/A | Done (sidebar) | N/A | **Done** |
| Password hashing | Missing | N/A | Column ready (VARCHAR 255) | **Not started** |
| Env-based DB config | Missing | N/A | N/A | **Not started** |
| Project documentation | N/A | N/A | N/A | **Done** (2026-07-16 suite in `docs/`) |

Legend: **Done** · **Partial** · **Not started**

---

## What works (expected happy path)

1. Flask app starts (`python app.py` from `backend/` with venv + deps).  
2. React app starts (`npm start` from `frontend/`).  
3. If MySQL is up and `Users` has a matching row, login can succeed.  
4. If `DEEPSEEK_API_KEY` is valid, `/chat` returns a student-support style reply.  

---

## Known issues / tech debt

| ID | Issue | Severity | Notes |
|----|-------|----------|-------|
| K1 | Passwords stored and compared in **plain text** | High | Auth routes in `app.py` |
| K2 | MySQL credentials were hardcoded | Medium | Moved to `backend/.env` (`DB_*`); old hardcode removed |
| K3 | ~~`db.sql` creates `Reminders` three times~~ | — | **Fixed 2026-07-20**: deduped to a single `Reminders`, while adding `ChatSessions` + `ChatHistory.SessionID` |
| K4 | ~~`db.sql` has ad-hoc `SELECT`s / `DESCRIBE` at end~~ | — | **Fixed 2026-07-20**: removed the trailing junk; `db.sql` is now a clean schema script |
| K5 | ~~Login UI may treat failures poorly~~ | — | **Fixed 2026-07-16**: inline errors; login state only set on 200 |
| K6 | ~~Chat UI shows only last bot message~~ | — | **Fixed 2026-07-16**: full conversation thread |
| K7 | ~~Chat not linked to `UserID` / `ChatHistory`~~ | — | **Fixed 2026-07-20**: added `ChatSessions` (one row per sidebar chat) + `ChatHistory.SessionID`; `/chat` saves each exchange for a signed-in user, and the sidebar restores saved sessions on load. Persistence is best-effort so a DB hiccup never loses emmy's reply |
| K8 | ~~No register screen~~ | — | **Fixed 2026-07-16**: register mode on login card |
| K9 | ~~No loading/disabled state on Send~~ | — | **Fixed 2026-07-16**: typing indicator + disabled Send |
| K10 | Empty root `README.md` (before this doc pass) | Low | Being fixed |
| K11 | Nested project folder confuses tools | Low | Documented in AGENTS.md |
| K12 | ~~`deepseek-chat` no longer exists, so `/chat` returned a 400~~ | — | **Fixed 2026-07-25**: DeepSeek now answers only to `deepseek-v4-flash` and `deepseek-v4-pro`. Default is flash (cheaper, fast enough for study help); `DEEPSEEK_MODEL` still overrides. Model names can change again without notice, so check this first if `/chat` starts 400ing |
| K13 | ~~`/chat` sends only the newest message to DeepSeek~~ | — | **Fixed 2026-07-20**: `Chatbot.jsx` now sends the chat's prior turns as `history` (error bubbles dropped, emmy mapped to `assistant`); `app.py` sanitises it (user/assistant only, non-empty string, last 20 turns) and sends system + history + message. Follow-ups like "solve one" keep context now. DB persistence (K7) is still separate |
| K14 | ~~`backend/VirtualEnvironment/` broken (built on another machine)~~ | — | **Fixed 2026-07-16**: rebuilt locally on Python 3.12.10 from the new `backend/requirements.txt`; verified serving `/` and `/chat`. Never copy a venv between machines |
| K15 | No root `.gitignore` before 2026-07-16 | — | **Fixed 2026-07-16**: added one ignoring `backend/.env`, `VirtualEnvironment/`, `__pycache__`. Before this, `git init && git add .` would have committed the DeepSeek key |
| K17 | ~~Maths/code inside `**bold**` rendered as raw source~~ | — | **Fixed 2026-07-16**: `renderInline` now recurses into marks (via `matchAll`, so the shared `/g` regex's `lastIndex` survives). Found by driving the real app, not by tests |
| K16 | ~~Backend only ran when launched from `backend/`~~ | — | **Fixed 2026-07-16**: `.env` was loaded by relative path, so running `app.py` from anywhere else (e.g. VS Code's Run button) found no key and crashed. Both `app.py` and `database.py` now resolve `.env` next to themselves, and a missing key returns `/chat`'s friendly error instead of killing the app at import |

---

## Source of truth files (code)

| Concern | File |
|---------|------|
| API routes | `backend/app.py` |
| DB connection | `backend/database.py` |
| Schema | `backend/db.sql` |
| Backend deps | `backend/requirements.txt` |
| App shell | `frontend/src/App.js` |
| Login | `frontend/src/Login.jsx` |
| Chat | `frontend/src/Chatbot.jsx` |
| Reply rendering | `frontend/src/Markdown.jsx` |
| Reminders pane | `frontend/src/Reminders.jsx` |
| Word of the day pane | `frontend/src/Motivation.jsx` |
| Word of the day prompt | `WORD_PROMPT` in `backend/app.py` |
| Profile pane | `frontend/src/Profile.jsx` |
| emmy's voice + reply format + reply language | `SYSTEM_PROMPT` in `backend/app.py` |

---

## Dependencies (high level)

### Backend (installed in `VirtualEnvironment`)

Pinned in **`backend/requirements.txt`** (the source of truth): Flask 3.1.3, flask-cors 6.0.5, mysql-connector-python 9.7.0, openai 2.45.0 (SDK used for the DeepSeek-compatible API), python-dotenv 1.2.2, plus their transitive deps.

Recreate with `python -m venv VirtualEnvironment` + `pip install -r requirements.txt` from `backend/`. The venv is a local, disposable artifact — it is gitignored, and copying one between machines is what broke K14.

### Frontend (`package.json`)

- react, react-dom, react-scripts  
- axios  
- katex — typesets emmy's maths (owner-approved exception; see FRONTEND_DESIGN.md §5.2)  
- testing-library packages (CRA defaults)  

---

## Environment checklist (for a working demo)

- [ ] MySQL running locally  
- [ ] Database `EmmyStudentSupportChatBot` created (after fixing SQL)  
- [ ] At least one user in `Users`  
- [ ] `backend/.env` contains valid `DEEPSEEK_API_KEY`  
- [ ] Backend venv activated; deps available  
- [ ] Frontend `node_modules` installed  
- [ ] Ports 5000 and 3000 free  

---

## Recommended next implementation slice

If starting new work without further instructions, do this in order:

1. **Password hashing (K1).** The last high-severity item, and the only one a marker is likely to ask about. Needs a plan for the existing plain-text rows.
2. **Read-aloud, phase 1.** Spec and acceptance criteria are already written in `FEATURE_VOICE.md`; frontend only, no key, no cost.
3. **Upload notes + quizzes from notes.** The headline study feature in the proposal, and the last two empty tables worth filling.
4. **Feedback.** Small, and it closes the schema.
5. **Env-based frontend API base** (`REACT_APP_API_URL`) instead of the `API` const repeated per component.

Log each completed item in `docs/DEVLOG.md` and flip rows in this file’s matrix.
