# PROJECT_SCOPE.md — Full Project Scope

> Product definition for **EMMY Student Support Chatbot**.  
> Use this to decide what to build, what to defer, and what “done” means for the class project.

**Last updated:** 2026-07-16

---

## 1. Vision

Build a **Student Support Chatbot** web application that:

- Lets students create an account and sign in  
- Provides an AI assistant specialized in **study help, academic questions, motivation, and learning support**  
- (Planned) Remembers context, stores chat history, supports study tools (notes, quizzes, reminders)  
- Runs as a **local full-stack app**: React frontend + Flask API + MySQL + DeepSeek  

**Product name in UI today:** “Student Support Chatbot”  
**Database name:** `EmmyStudentSupportChatBot`  
**Project folder name:** `EMMY_StudentSupportChatBot`

---

## 2. Problem statement

Students often need:

- Quick academic clarification outside office hours  
- Study motivation and structured learning help  
- A place to return for notes, reminders, and practice questions  

This project solves that with a **simple login + chatbot**, expandable toward a fuller student-support platform as schema and time allow.

---

## 3. Target users

| User | Needs |
|------|--------|
| **Student** (primary) | Login, chat for help, eventually profile/notes/reminders |
| **Developer / classmate** | Clear docs, runnable demo, incremental features |
| **Marker / lecturer** | Understandable architecture, working demo of core path |

There is **no admin panel** in scope unless explicitly added later.

---

## 4. Core value proposition

> “Log in and get an AI tutor/support buddy that understands you are a student.”

Minimum lovable product (MLP) for a class demo:

1. Register or use a pre-seeded account  
2. Log in successfully  
3. Ask a study-related question  
4. Receive a coherent, student-support-oriented AI reply  

---

## 5. Feature inventory

### 5.1 Must-have (core demo)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F1 | User registration | Create account with name, email, password | P0 |
| F2 | User login | Authenticate with email + password | P0 |
| F3 | AI chat | Send message, get DeepSeek-backed reply as student support bot | P0 |
| F4 | Backend health | API runs and can prove DB connectivity | P0 |
| F5 | Local run docs | README allows another student to run the stack | P0 |

### 5.2 Should-have (near-term)

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F6 | Chat UI history | Multi-message conversation thread in the browser | P1 |
| F7 | Persist chat history | Save user/bot messages to `ChatHistory` | P1 |
| F8 | Logout | Clear session state on frontend | P1 |
| F9 | Register UI | Frontend form for `/register` | P1 |
| F10 | User session identity | Pass/store `UserID` after login for user-scoped features | P1 |
| F11 | Password hashing | Stop storing/comparing plain-text passwords | P1 |
| F12 | Env-based DB config | Remove hardcoded credentials from `database.py` | P1 |
| F13 | Clean SQL schema | Single valid `db.sql` (no duplicate tables) | P1 |

### 5.3 Nice-to-have (schema already anticipates these)

| ID | Feature | Description | Priority | Schema tables | Status |
|----|---------|-------------|----------|---------------|--------|
| F14 | User profiles | Course, year level, preferred language | P2 | `UserProfiles` | **Built 2026-07-25** |
| F15 | Study reminders | Create/list/update reminder status | P2 | `Reminders` | **Built 2026-07-25** |
| F16 | Upload notes | Upload study files / store metadata | P2 | `UploadedNotes` | Not started |
| F17 | Generated quizzes | Create Q&A from notes via AI | P2 | `GeneratedQuizzes` | Not started |
| F18 | Feedback | Rate chatbot / leave comments | P2 | `Feedback` | Not started |
| F19 | Personalized system prompt | Inject course/year/language into DeepSeek system message | P2 | uses `UserProfiles` | **Partly built 2026-07-25**: language is injected, course and year are not |
| F20 | Word of the day | One academic word a day, with its meaning and an example, generated for the student and held stable for the day | P2 | `DailyWords` | **Built 2026-07-25**. Added at owner's request after the original scope was written |

### 5.4 Out of scope (unless human expands scope)

- Mobile native apps  
- Production cloud deployment / multi-tenant SaaS  
- Payment, SSO, OAuth (Google/Microsoft login)  
- Real-time voice  
- Lecturer dashboard / LMS integration (Moodle, Canvas)  
- Fine-tuning custom models (use hosted DeepSeek / LLM API)  
- Offline-first PWA requirements  

---

## 6. User journeys

### Journey A — First-time student (target)

1. Open app → Register  
2. Enter FirstName, LastName, Email, Password  
3. Redirect or switch to Login  
4. Login → Chat  
5. Ask: “Explain photosynthesis simply”  
6. Read bot reply; continue conversation  

### Journey B — Returning student (current partial)

1. Open app → Login  
2. Chat with bot  
3. (Future) See past chats, reminders, notes  

### Journey C — Developer demo

1. Start MySQL, apply schema  
2. Start Flask backend  
3. Start React frontend  
4. Login with test user  
5. Prove `/test-db` and `/chat`  

---

## 7. Functional requirements

### Auth

- **FR-A1:** System shall allow creating a user with unique email.  
- **FR-A2:** System shall authenticate using email + password.  
- **FR-A3:** System shall reject invalid credentials with a clear error (HTTP 401).  
- **FR-A4 (target):** Passwords shall be stored hashed, not plain text.  

### Chat

- **FR-C1:** System shall accept a user message and return a bot reply.  
- **FR-C2:** Bot shall behave as a **Student Support Chatbot** (study, academics, motivation, learning).  
- **FR-C3 (target):** Conversations shall be displayable as a message list.  
- **FR-C4 (target):** Conversations shall be optional persisted per `UserID`.  

### Data

- **FR-D1:** MySQL database `EmmyStudentSupportChatBot` holds users and related entities.  
- **FR-D2:** Foreign keys cascade delete where defined in schema.  

---

## 8. Non-functional requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Local development | Runs on Windows (primary) with MySQL + Node + Python |
| NFR-2 | Simplicity | Suitable for student understanding and marking |
| NFR-3 | Latency | Chat reply depends on DeepSeek; UI should show loading/error states (target) |
| NFR-4 | Security | No secrets in git; hashed passwords (target); input validation (target) |
| NFR-5 | Documentation | AGENTS + scope + architecture + devlog kept current |
| NFR-6 | CORS | Backend allows local frontend origin during development |

---

## 9. AI behaviour guidelines

System role (current implementation intent):

> “You are a Student Support Chatbot. Help students with studying, academic questions, motivation, and learning support.”

The bot should:

- Be supportive, clear, and educational  
- Prefer explanations that help learning (not only final answers when teaching)  
- Stay appropriate for a school/university context  

The bot should not:

- Claim to replace professional mental health care for crises (redirect to human help if needed)  
- Invent institutional policies (exam dates, fees) as facts without data  

Future: personalize with course, year level, preferred language from `UserProfiles`.

---

## 10. Success criteria

### Demo success (minimum)

- [ ] Backend starts without crash  
- [ ] DB connection test succeeds  
- [ ] Login works with a known user  
- [ ] Chat returns a non-empty AI reply for a study question  
- [ ] Another developer can follow README to reproduce  

### Project success (fuller class submission)

- [ ] Register + Login + Chat end-to-end with UI  
- [ ] Chat history (UI + preferably DB)  
- [x] At least one extra schema-backed feature (reminders **or** notes **or** feedback) — reminders and profiles, 2026-07-25  
- [ ] Schema SQL is clean and runnable once  
- [ ] Basic security improvements (env config + password hashing)  
- [ ] Documentation suite complete and consistent  

---

## 11. Risks and assumptions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing/invalid DeepSeek API key | Chat fails | Document `.env`; clear frontend error |
| MySQL not installed / wrong password | Auth fails | `/test-db`; env-based config; README |
| Duplicate SQL definitions | Fresh setup fails | Clean `db.sql` |
| Plain-text passwords | Security / marking deductions | Hash passwords |
| No chat history | Weak demo UX | Implement F6/F7 |
| Nested folder confusion | Agents edit wrong root | AGENTS.md layout section |

**Assumptions:**

- Students have (or can obtain) a DeepSeek API key for development (cheaper than OpenAI)  
- MySQL runs on `localhost`  
- Frontend and backend run on the same machine during demo  

---

## 12. Deliverables checklist

| Deliverable | Location |
|-------------|----------|
| Working backend | `backend/app.py` |
| DB access | `backend/database.py` |
| Schema | `backend/db.sql` |
| React UI | `frontend/src/*` |
| Agent / developer memory | `docs/AGENTS.md`, this file, `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`, `docs/DEVLOG.md` |
| Human entrypoint | project root `README.md` |

---

## 13. Change control

When scope changes (new feature, dropped feature, tech change):

1. Update this file’s relevant section and **Last updated** date  
2. Reflect status in `docs/CURRENT_STATE.md`  
3. Log decision in `docs/DEVLOG.md`  
4. If structure/API changed, update `docs/ARCHITECTURE.md`  

Do not silently expand scope mid-implementation without updating these files — they are the project’s persistent memory.
