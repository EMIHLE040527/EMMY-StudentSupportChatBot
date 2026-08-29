# ARCHITECTURE.md — System Architecture

> Technical map of EMMY Student Support Chatbot.  
> **Last updated:** 2026-07-16

---

## 1. High-level overview

```
┌─────────────────────┐         HTTP/JSON          ┌──────────────────────┐
│  React Frontend     │  ───────────────────────►  │  Flask Backend       │
│  (CRA, port 3000)   │  ◄───────────────────────  │  (port 5000)         │
│  Login + Chatbot    │         CORS enabled       │  app.py              │
└─────────────────────┘                            └──────────┬───────────┘
                                                              │
                                              ┌───────────────┼───────────────┐
                                              ▼               ▼               ▼
                                        ┌──────────┐   ┌────────────┐  ┌────────────┐
                                        │  MySQL   │   │  DeepSeek  │  │  .env      │
                                        │  local   │   │  API       │  │  API key   │
                                        └──────────┘   └────────────┘  └────────────┘
```

**Pattern:** Classic SPA + REST API + relational DB + external LLM API.

No auth tokens/JWT yet. “Session” is React state (`loggedIn` boolean) only.

---

## 2. Directory structure

```
EMMY_StudentSupportChatBot/                 # project root
├── AGENTS.md                  # thin pointer → docs/AGENTS.md
├── README.md                  # human entrypoint
├── docs/                      # all persistent project memory
│   ├── AGENTS.md
│   ├── PROJECT_SCOPE.md
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── DEVLOG.md
│   └── README.md
├── backend/
│   ├── app.py                 # Flask routes + DeepSeek chat
│   ├── database.py            # mysql.connector factory
│   ├── db.sql                 # full schema (all tables), fresh install
│   ├── seed.sql               # demo user
│   ├── setup_database.py      # build DB from db.sql + seed.sql (portable)
│   ├── setup_mysql.ps1        # Windows wrapper for setup_database.py
│   ├── migrate_chat_sessions.py # add chat-session tables to an existing DB
│   ├── migrate_profiles.py     # add the one-profile-per-student unique key
│   ├── migrate_daily_words.py  # add the word-of-the-day cache table
│   ├── requirements.txt       # pinned Python deps
│   ├── .env                   # DEEPSEEK_API_KEY + DB_* (local only, gitignored)
│   ├── .env.example           # template for .env
│   └── VirtualEnvironment/    # Python venv (gitignored; recreate locally)
└── frontend/
    ├── package.json
    ├── public/
    └── src/
        ├── index.js           # React entry
        ├── App.js             # Login vs Chatbot switch
        ├── Login.jsx          # POST /login, /register
        ├── Chatbot.jsx        # shell + chat thread; /chat + /sessions
        ├── Reminders.jsx      # /reminders; reminder list + add form
        ├── Motivation.jsx     # /motivation; word of the day
        ├── Profile.jsx        # /profile; course, year, preferred language
        ├── Markdown.jsx        # renders emmy's Markdown + KaTeX maths
        ├── App.css / index.css
        └── ... CRA defaults
```

---

## 3. Frontend architecture

| File | Role |
|------|------|
| `App.js` | Holds `loggedIn` state; renders `Login` or `Chatbot` |
| `Login.jsx` | Email/password form → `POST http://127.0.0.1:5000/login` |
| `Chatbot.jsx` | Owns the two-column shell and the `view` state (`chat` / `reminders` / `profile`); chat thread → `POST /chat` |
| `Reminders.jsx` | Study reminders pane → `/reminders` |
| `Motivation.jsx` | Word of the day pane → `/motivation` |
| `Profile.jsx` | Profile pane → `/profile`; hands the saved language back to `Chatbot` |

### State model (current)

```
App
└── loggedIn: boolean
    ├── false → Login(setLoggedIn)
    └── true  → Chatbot
                    ├── message: string (input)
                    └── reply: string (last bot response)
```

### Gaps (architectural debt)

- No global user object (`UserID`, `FirstName`) after login  
- No message array for conversation UI  
- No protected routes beyond boolean  
- No shared API base URL config (hardcoded `127.0.0.1:5000`)  
- Login success path does not inspect HTTP status carefully before `setLoggedIn(true)`  

---

## 4. Backend architecture

### Entry: `app.py`

| Route | Method | Handler | Behaviour |
|-------|--------|---------|-----------|
| `/` | GET | `home` | Plain text: backend running |
| `/test-db` | GET | `test_database` | Opens MySQL; returns success/fail string |
| `/register` | POST | `register` | Inserts into `Users` |
| `/login` | POST | `login` | SELECT by email + password |
| `/chat` | POST | `chat` | DeepSeek completion; returns reply, persists the exchange |
| `/sessions` | GET | `list_sessions` | This user's saved chats, newest first |
| `/sessions` | POST | `create_session` | Opens a new chat |
| `/sessions/<id>` | PATCH | `rename_session` | Retitles a chat |
| `/sessions/<id>/messages` | GET | `session_messages` | Replays one chat's exchanges |
| `/reminders` | GET | `list_reminders` | This user's reminders, soonest first |
| `/reminders` | POST | `create_reminder` | Adds one; validates title + due date |
| `/reminders/<id>` | PATCH | `update_reminder` | Pending ↔ Done, scoped to the owner |
| `/reminders/<id>` | DELETE | `delete_reminder` | Deletes one, scoped to the owner |
| `/motivation` | GET | `motivation` | Today's word, from `DailyWords` or newly generated |
| `/profile` | GET | `get_profile` | Name/email from `Users` + profile fields |
| `/profile` | PUT | `save_profile` | Upserts the one `UserProfiles` row |

### Dependencies

- `flask`, `flask_cors`  
- `mysql.connector` via `database.get_database_connection`  
- `openai.OpenAI` pointed at DeepSeek (`base_url` + `DEEPSEEK_API_KEY`)  
- `dotenv` loading `.env` from backend working directory  

### Chat pipeline

```
Client message
    → request.json["message"]
    → client.chat.completions.create(
          model="deepseek-v4-flash",   # DEEPSEEK_MODEL
          base_url="https://api.deepseek.com",
          messages=[system student-support prompt, user message]
      )
    → response.choices[0].message.content
    → jsonify({ "reply": ... })
```

**Not yet:** multi-turn messages array, temperature controls, user-specific context, persistence.

### Data access: `database.py`

```python
mysql.connector.connect(
    host="localhost",
    user="root",
    password=...,          # currently hardcoded — should be env
    database="EmmyStudentSupportChatBot"
)
```

Each route opens a connection, runs a cursor, commits if needed, closes. No connection pool, no ORM.

---

## 5. API contracts

### POST `/register`

**Request JSON:**

```json
{
  "FirstName": "string",
  "LastName": "string",
  "Email": "string",
  "Password": "string"
}
```

**Response 200:**

```json
{ "message": "User registered successfully!" }
```

**Notes:** No uniqueness error handling; no validation; password plain text.

---

### POST `/login`

**Request JSON:**

```json
{
  "Email": "string",
  "Password": "string"
}
```

**Response 200:**

```json
{
  "message": "Login successful!",
  "UserID": 1,
  "FirstName": "string"
}
```

**Response 401:**

```json
{ "message": "Invalid email or password" }
```

**Frontend note:** `Login.jsx` should only call `setLoggedIn(true)` on success (fix if needed).

---

### POST `/chat`

**Request JSON:** everything but `message` is optional, so an older client that
sends only the message still works.

```json
{
  "message": "string",
  "history": [{ "role": "user | assistant | emmy", "content": "string" }],
  "user_id": 1,
  "session_id": 7,
  "preferred_language": "isiXhosa"
}
```

**Response 200:**

```json
{ "reply": "string", "saved": true }
```

**Notes:** `history` is client-controlled, so `build_history` sanitises it and
keeps only the last 20 turns. `saved` reports whether the exchange reached
`ChatHistory`; persistence is best-effort and never costs the student a reply.
`preferred_language` only sets what emmy opens in, the prompt's Language rules
still switch her to whatever the student actually writes in.

---

### GET/POST `/reminders`, PATCH/DELETE `/reminders/<id>`

```json
// POST body                              // GET response item
{                                         {
  "user_id": 1,                             "id": 1,
  "title": "Revise chapter 4",              "title": "Revise chapter 4",
  "description": "Worked examples",         "description": "Worked examples",
  "due": "2026-08-02T14:30"                 "due": "2026-08-02T14:30",
}                                           "status": "Pending"
                                          }
```

**Notes:** `due` is the browser's `datetime-local` shape both ways, so the
frontend never converts. PATCH takes `{ "user_id", "status" }` where status is
`Pending` or `Done`; DELETE takes `?user_id=`. Both scope the SQL by `UserID`
as well as the row id and return 404 when nothing matched, so one student
cannot tick off or delete another's reminder by guessing an id.

---

### GET/PUT `/profile`

```json
// GET ?user_id=1                        // PUT body
{                                        {
  "first_name": "Demo",                    "user_id": 1,
  "last_name": "Student",                  "course": "BSc Computer Science",
  "email": "demo@example.com",             "year_level": "2",
  "course": "BSc Computer Science",        "preferred_language": "isiXhosa"
  "year_level": 2,                       }
  "preferred_language": "isiXhosa"
}
```

**Notes:** GET LEFT JOINs `UserProfiles`, so a student who has never saved one
still gets their name and email back with the profile fields empty. PUT is an
`INSERT ... ON DUPLICATE KEY UPDATE` against `uq_userprofiles_user`, so the
first save inserts and every later one updates. A `year_level` that is blank or
out of range is stored as NULL rather than failing the whole save.

---

### GET `/` / GET `/test-db`

Plain text responses for smoke tests.

---

## 6. Database model

**Database:** `EmmyStudentSupportChatBot`

### Entity relationship (intended)

```
Users 1──1 UserProfiles
Users 1──* DailyWords
Users 1──* ChatSessions
Users 1──* ChatHistory
ChatSessions 1──* ChatHistory
Users 1──* Reminders
Users 1──* UploadedNotes
Users 1──* Feedback
Users 1──* GeneratedQuizzes
UploadedNotes 1──* GeneratedQuizzes
```

### Tables (from `db.sql` intent)

#### `Users`

| Column | Type | Notes |
|--------|------|--------|
| UserID | INT PK AI | |
| FirstName | VARCHAR(50) NOT NULL | |
| LastName | VARCHAR(50) NOT NULL | |
| Email | VARCHAR(100) UNIQUE NOT NULL | |
| Password | VARCHAR(255) NOT NULL | plain text today; size OK for hashes later |
| DateCreated | DATETIME DEFAULT CURRENT_TIMESTAMP | |

#### `UserProfiles`

| Column | Type | Notes |
|--------|------|--------|
| ProfileID | INT PK AI | |
| UserID | INT FK → Users | CASCADE; UNIQUE (`uq_userprofiles_user`) so there is one profile per student and `/profile` can upsert |
| Course | VARCHAR(100) | |
| YearLevel | INT | |
| PreferredLanguage | VARCHAR(20) | |

#### `ChatSessions`

| Column | Type | Notes |
|--------|------|--------|
| SessionID | INT PK AI | one row per sidebar chat |
| UserID | INT FK → Users | CASCADE |
| Title | VARCHAR(120) NOT NULL | defaults `'New chat'`; set from first user message |
| CreatedDate | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| UpdatedDate | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | bumped on each new message so recent chats sort first |

#### `ChatHistory`

| Column | Type | Notes |
|--------|------|--------|
| ChatID | INT PK AI | |
| UserID | INT FK → Users | CASCADE |
| SessionID | INT FK → ChatSessions | CASCADE; NOT NULL on fresh installs (db.sql), NULL-able on databases upgraded via `migrate_chat_sessions.py` |
| UserMessage | TEXT NOT NULL | |
| BotResponse | TEXT NOT NULL | |
| ChatDate | DATETIME DEFAULT CURRENT_TIMESTAMP | |

#### `Reminders`

| Column | Type | Notes |
|--------|------|--------|
| ReminderID | INT PK AI | |
| UserID | INT FK → Users | CASCADE |
| ReminderTitle | VARCHAR(100) NOT NULL | |
| ReminderDescription | TEXT | |
| ReminderDate | DATETIME NOT NULL | |
| Status | VARCHAR(20) DEFAULT 'Pending' | |

#### `UploadedNotes`

| Column | Type | Notes |
|--------|------|--------|
| NoteID | INT PK AI | |
| UserID | INT FK → Users | CASCADE |
| FileName | VARCHAR(255) NOT NULL | |
| FilePath | VARCHAR(255) | |
| UploadDate | DATETIME DEFAULT CURRENT_TIMESTAMP | |

#### `Feedback`

| Column | Type | Notes |
|--------|------|--------|
| FeedbackID | INT PK AI | |
| UserID | INT FK → Users | CASCADE |
| Rating | INT | |
| Comment | TEXT | |
| FeedbackDate | DATETIME DEFAULT CURRENT_TIMESTAMP | |

#### `GeneratedQuizzes`

| Column | Type | Notes |
|--------|------|--------|
| QuizID | INT PK AI | |
| UserID | INT FK → Users | CASCADE |
| NoteID | INT FK → UploadedNotes | CASCADE, nullable in practice for free-form quizzes |
| Question | TEXT NOT NULL | |
| Answer | TEXT | |
| CreatedDate | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### Implemented vs schema-only

| Table | Used by code today? |
|-------|---------------------|
| Users | Yes (`/register`, `/login`) |
| UserProfiles | Yes (`/profile`) |
| ChatSessions | Yes (`/sessions` endpoints) |
| ChatHistory | Yes (persisted on `/chat`, read on `/sessions/<id>/messages`) |
| Reminders | Yes (`/reminders` endpoints) |
| DailyWords | Yes (`/motivation`) |
| UploadedNotes | No |
| Feedback | No |
| GeneratedQuizzes | No |

---

## 7. Configuration & secrets

| Secret / config | Current location | Target location |
|-----------------|------------------|-----------------|
| DeepSeek API key | `backend/.env` → `DEEPSEEK_API_KEY` | keep in env only |
| DeepSeek base URL / model | `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | defaults in app.py |
| MySQL password | `backend/.env` → `DB_PASSWORD` (with `DB_HOST`, `DB_USER`, `DB_NAME`) | keep in env only |
| Frontend API base | hardcoded in components | `REACT_APP_API_URL` |

**Never** put real keys into markdown docs or git history intentionally.

---

## 8. Runtime topology (local)

| Process | Command (typical) | URL |
|---------|-------------------|-----|
| MySQL | system service / MySQL Workbench | `localhost:3306` |
| Flask | activate venv → `python app.py` | `http://127.0.0.1:5000` |
| React | `npm start` in `frontend/` | `http://localhost:3000` |

Flask runs with `debug=True` (dev only).

---

## 9. Extension points (for future features)

| Feature | Suggested approach |
|---------|-------------------|
| Chat history UI | `messages[]` state in `Chatbot.jsx`; append user + bot turns |
| Persist chats | After DeepSeek reply, `INSERT INTO ChatHistory` with `UserID` |
| Auth session | Return token or use flask sessions/cookies; store `UserID` in React context |
| Profiles | CRUD routes + form; inject into system prompt |
| Reminders | CRUD API + simple list UI |
| Notes upload | `multipart/form-data` to Flask; save file under `uploads/`; row in `UploadedNotes` |
| Quizzes | Read note text → DeepSeek structured Q&A → `GeneratedQuizzes` |
| Password hashing | `werkzeug.security.generate_password_hash` / `check_password_hash` on register/login |

---

## 10. Design constraints for agents

1. Prefer extending existing Flask routes and React components over new frameworks.  
2. Keep API JSON field names consistent with current style (`FirstName`, `Email`, `message`, `reply`).  
3. When adding tables or columns, update this file and `db.sql` together.  
4. When adding routes, update the API table in this file and `docs/CURRENT_STATE.md`.  
5. Keep project-memory markdown under **`docs/`** only.  
