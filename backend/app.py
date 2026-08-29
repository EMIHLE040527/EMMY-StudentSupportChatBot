from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_database_connection

import json
import os
from datetime import date, datetime
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from flask import request
from werkzeug.utils import secure_filename
from pypdf import PdfReader
from docx import Document
from werkzeug.utils import secure_filename

from document_processor import extract_text


app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "http://localhost:3000"
    }
})
load_dotenv()


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

if not DEEPSEEK_API_KEY:
    print("WARNING: DEEPSEEK_API_KEY is not configured.")

deepseek_client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Maximum file size: 20 MB
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

CORS(app)

# Look for .env next to this file, not in the current working directory, so the
# app runs from anywhere (VS Code's Run button starts in the workspace root).
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

# DeepSeek is OpenAI-compatible: same SDK, different base URL + model.
# Get a key at https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
# DeepSeek retired the "deepseek-chat" name (K12): the API now answers only to
# deepseek-v4-flash and deepseek-v4-pro. Flash is the cheaper, faster of the
# two and is plenty for study help; override with DEEPSEEK_MODEL for pro.
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

# Only built when a key exists: OpenAI() raises on a missing key, which would
# kill the app at import and stop /chat ever returning its "key is missing"
# message (and stop /login working for a demo without a key).
client = None

if DEEPSEEK_API_KEY:
    client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
    )

# The frontend renders this Markdown (frontend/src/Markdown.jsx), so the format
# rules below are a contract: only ask for what that renderer can draw.
# emmy's role, scope and safety rules come from docs/PROJECT_SCOPE.md section 9;
# her voice comes from docs/FRONTEND_DESIGN.md section 4. Keep them in sync.
SYSTEM_PROMPT = """You are emmy, an AI study buddy inside the Student Support Chatbot, a web app \
where students sign in and chat with you about their studies. You are helping one student.

What you help with, and how:
- Your job is study and learning support: explaining academic topics, working through problems, \
study skills and planning, exam preparation, and motivation when a student feels stuck. Help with \
any subject a student brings.
- Teach, do not just answer. Give the reasoning or the steps so the student can do it alone next \
time, and build a hard idea up from what the student already knows.
- Protect academic integrity. If a student asks you to write graded or assessed work for them (an \
essay, an assignment, a take-home answer), do not hand over finished work to submit. Help them \
understand it, plan it and draft it in their own words instead.
- Your primary role is to support students with their studies, but you can also answer general questions.
- Students may ask about everyday life, technology, science, careers, hobbies, relationships, and other general topics.
- Do not restrict the conversation only to studying or education.
- If a question is unrelated to studying, answer it naturally and helpfully.
- You are both a study assistant and a general-purpose conversational assistant.

Honesty and care:
- Never invent facts about a student's institution: exam dates, deadlines, fees, grades, timetables \
or module rules. You do not have that information. Say you cannot see it and point them to their \
lecturer, department or student portal.
- If you are unsure, or a question is beyond you, say so plainly instead of guessing. An honest "I \
am not certain" beats a confident wrong answer.
- Work only from what is in this conversation. Do not claim to remember a student between separate \
chats, or to know things they have not told you.
- You are not a counsellor or a doctor. If a student sounds like they are in real distress or \
crisis, be kind, take them seriously, and encourage them to reach out to someone they trust or \
their campus support or a professional service. Do not try to be their mental health care.

Language:
- Reply in the same language the student writes in, and switch as soon as they switch. Do not \
announce the switch or ask permission, just answer in their language.
- If one message mixes languages, answer in the language most of it is written in. Keep course \
terms in the language the student used for them, since that is what their notes and exam will use.
- Everything else stays the same in every language: same voice, same Markdown format, same LaTeX \
for maths.
- If you cannot write a language well enough to teach in it, say that plainly in that language, \
then carry on in English.

Voice:
- Warm, encouraging and plain-spoken. Refer to yourself in the first person as emmy, lowercase.
- Plain language, active voice. Encourage the student without flattering them.
- Never use em-dashes. Use commas, full stops or brackets instead.

Format every reply as Markdown, structured so it can be skimmed. This is a contract with the app's \
renderer, so only use what it can draw:
- Start with one short sentence that answers the question directly. No heading above it.
- Use `- ` bullets for lists of facts, options or tips. Use `1.` numbered lists when order matters.
- Keep each bullet to one line, and use `**bold**` on the key term of a bullet, sparingly.
- Use `### ` headings only when the reply has two or more distinct sections. Keep maths out of \
headings, put it in the text below.
- Write every formula, equation and mathematical symbol as LaTeX: inline as $...$, and a worked or \
important equation on its own line as $$...$$. The chat renders it as real maths.
- Never write maths as plain text (x^2, sqrt(x), +/-, <=) and never put maths in a code block. \
Write $x^2$, $\\sqrt{x}$, $\\pm$, $\\le$.
- Put code and terminal commands, and only those, in fenced code blocks with a language tag.
- You may use `>` quotes and a `---` rule when they genuinely help. Do not use tables, images or \
emoji: the app cannot draw them.
- Aim for under 200 words unless the student asks for depth. End with one short question or next step.
"""


def system_prompt_for(preferred_language):
    """SYSTEM_PROMPT, plus the language the student saved on their profile.

    This only decides what emmy opens in. The Language rules in the prompt
    still win, so a student who writes in something else gets answered in that
    language regardless of what their profile says.
    """

    if not isinstance(preferred_language, str) or not preferred_language.strip():
        return SYSTEM_PROMPT

    language = preferred_language.strip()[:40]

    return (
        SYSTEM_PROMPT
        + f"\nThis student set their preferred language to {language}. Open in {language}, and "
        "keep following the Language rules above: if they write to you in another language, "
        "answer in that one instead.\n"
    )


@app.route("/")
def home():
    return "Student Support Chatbot Backend is Running!"


@app.route("/test-db")
def test_database():

    connection = get_database_connection()

    if connection.is_connected():
        return "Database connection successful!"

    return "Database connection failed!"

@app.route("/register", methods=["POST"])
def register():

    data = request.json

    first_name = data["FirstName"]
    last_name = data["LastName"]
    email = data["Email"]
    password = data["Password"]

    connection = get_database_connection()

    cursor = connection.cursor()

    sql = """
    INSERT INTO Users
    (FirstName, LastName, Email, Password)
    VALUES (%s, %s, %s, %s)
    """

    values = (
        first_name,
        last_name,
        email,
        password
    )

    cursor.execute(sql, values)

    connection.commit()

    cursor.close()
    connection.close()

    return jsonify({
        "message": "User registered successfully!"
    })

@app.route("/login", methods=["POST"])
def login():

    data = request.json

    email = data["Email"]
    password = data["Password"]

    connection = get_database_connection()

    cursor = connection.cursor(dictionary=True)

    sql = """
    SELECT * FROM Users
    WHERE Email = %s AND Password = %s
    """

    values = (
        email,
        password
    )

    cursor.execute(sql, values)

    user = cursor.fetchone()

    cursor.close()
    connection.close()


    if user:
        return jsonify({
            "message": "Login successful!",
            "UserID": user["UserID"],
            "FirstName": user["FirstName"]
        })

    else:
        return jsonify({
            "message": "Invalid email or password"
        }), 401

# How many prior turns to send DeepSeek with each message. Enough for real
# follow-ups ("explain that again", "solve one") to keep their context, but
# capped so a long chat can't grow the request, and its token cost, without
# bound. The newest turns are the ones that matter, so we keep the tail.
MAX_HISTORY_MESSAGES = 20


def build_history(raw):
    """Turn the frontend's prior turns into OpenAI-format chat messages.

    The client controls this field, so treat it as untrusted: keep only
    well-formed user/assistant turns with non-empty string content, map emmy's
    role name to "assistant", drop anything else, and return at most the last
    MAX_HISTORY_MESSAGES so the request stays bounded.
    """

    if not isinstance(raw, list):
        return []

    cleaned = []

    for item in raw:

        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        # The frontend labels emmy's turns "emmy"; DeepSeek expects "assistant".
        if role == "emmy":
            role = "assistant"

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        cleaned.append({"role": role, "content": content})

    return cleaned[-MAX_HISTORY_MESSAGES:]


def save_exchange(user_id, session_id, user_message, reply):
    """Store one user/emmy exchange against its session. Best-effort: returns
    True on success, False if anything (missing ids, DB error) stops it, and
    never raises, so /chat can still return the reply the model produced."""

    if not user_id or not session_id:
        return False

    try:
        connection = get_database_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO ChatHistory (UserID, SessionID, UserMessage, BotResponse)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, session_id, user_message, reply),
        )

        # Bump the session so it sorts to the top of the sidebar next load.
        cursor.execute(
            "UPDATE ChatSessions SET UpdatedDate = CURRENT_TIMESTAMP WHERE SessionID = %s",
            (session_id,),
        )

        connection.commit()
        cursor.close()
        connection.close()
        return True

    except Exception as error:
        print("save_exchange failed:", error)
        return False


@app.route("/sessions", methods=["GET"])
def list_sessions():

    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT SessionID, Title, CreatedDate, UpdatedDate
        FROM ChatSessions
        WHERE UserID = %s
        ORDER BY UpdatedDate DESC, SessionID DESC
        """,
        (user_id,),
    )

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    sessions = [
        {
            "id": row["SessionID"],
            "title": row["Title"],
        }
        for row in rows
    ]

    return jsonify({"sessions": sessions})


@app.route("/sessions", methods=["POST"])
def create_session():

    data = request.json or {}

    user_id = data.get("user_id")
    title = (data.get("title") or "New chat").strip()[:120] or "New chat"

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    cursor.execute(
        "INSERT INTO ChatSessions (UserID, Title) VALUES (%s, %s)",
        (user_id, title),
    )

    connection.commit()
    session_id = cursor.lastrowid

    cursor.close()
    connection.close()

    return jsonify({"id": session_id, "title": title})


@app.route("/sessions/<int:session_id>", methods=["PATCH"])
def rename_session(session_id):

    data = request.json or {}
    title = (data.get("title") or "").strip()[:120]

    if not title:
        return jsonify({"error": "title is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    cursor.execute(
        "UPDATE ChatSessions SET Title = %s WHERE SessionID = %s",
        (title, session_id),
    )

    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({"ok": True, "title": title})


@app.route("/sessions/<int:session_id>/messages", methods=["GET"])
def session_messages(session_id):

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT UserMessage, BotResponse
        FROM ChatHistory
        WHERE SessionID = %s
        ORDER BY ChatID ASC
        """,
        (session_id,),
    )

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    # Each stored row is one exchange; expand it back into the two chat bubbles
    # the frontend renders.
    messages = []
    for row in rows:
        messages.append({"role": "user", "text": row["UserMessage"]})
        messages.append({"role": "emmy", "text": row["BotResponse"]})

    return jsonify({"messages": messages})


@app.route("/chat", methods=["POST"])
def chat():

    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.strip() in ("", "paste_your_deepseek_api_key_here"):
        return jsonify({
            "error": "DeepSeek API key is missing. Set DEEPSEEK_API_KEY in backend/.env"
        }), 500

    data = request.json

    user_message = data["message"]

    # Prior turns from the frontend so emmy can follow the conversation instead
    # of seeing each message in isolation. Optional and sanitised, so an old
    # client that sends only "message" still works.
    history = build_history(data.get("history"))

    messages = [{"role": "system", "content": system_prompt_for(data.get("preferred_language"))}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages
        )

        reply = response.choices[0].message.content

        # Persist the exchange when the client is a signed-in user in a saved
        # session. Best-effort: a DB hiccup must not lose emmy's reply, so
        # save_exchange swallows its own errors and just reports success.
        saved = save_exchange(data.get("user_id"), data.get("session_id"), user_message, reply)

        return jsonify({
            "reply": reply,
            "saved": saved
        })

    except Exception as error:
        return jsonify({
            "error": "DeepSeek chat request failed",
            "details": str(error)
        }), 502


# The two values the app ever writes to Reminders.Status. The column is a plain
# VARCHAR, so every write goes through these instead of spelling them inline.
REMINDER_PENDING = "Pending"
REMINDER_DONE = "Done"

# The shape <input type="datetime-local"> reads and writes ("2026-07-30T14:30").
BROWSER_DATETIME = "%Y-%m-%dT%H:%M"


def parse_due(value):
    """Turn the browser's datetime-local value into something MySQL accepts.

    Returns None when it is missing or malformed, which the caller turns into a
    400 rather than letting a bad string reach the database.
    """

    if not isinstance(value, str):
        return None

    value = value.strip()

    try:
        due = datetime.strptime(value, BROWSER_DATETIME)
    except ValueError:
        return None

    return due.strftime("%Y-%m-%d %H:%M:%S")


def reminder_row(row):
    """One Reminders row as the JSON the frontend renders."""

    return {
        "id": row["ReminderID"],
        "title": row["ReminderTitle"],
        "description": row["ReminderDescription"] or "",
        "due": row["ReminderDate"].strftime(BROWSER_DATETIME),
        "status": row["Status"],
    }


@app.route("/reminders", methods=["GET"])
def list_reminders():

    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT ReminderID, ReminderTitle, ReminderDescription, ReminderDate, Status
        FROM Reminders
        WHERE UserID = %s
        ORDER BY ReminderDate ASC, ReminderID ASC
        """,
        (user_id,),
    )

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    return jsonify({"reminders": [reminder_row(row) for row in rows]})


@app.route("/reminders", methods=["POST"])
def create_reminder():

    data = request.json or {}

    user_id = data.get("user_id")
    title = (data.get("title") or "").strip()[:100]
    description = (data.get("description") or "").strip() or None
    due = parse_due(data.get("due"))

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if not title:
        return jsonify({"error": "title is required"}), 400

    if not due:
        return jsonify({"error": "due must look like 2026-07-30T14:30"}), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO Reminders
        (UserID, ReminderTitle, ReminderDescription, ReminderDate, Status)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, title, description, due, REMINDER_PENDING),
    )

    connection.commit()
    reminder_id = cursor.lastrowid

    cursor.close()
    connection.close()

    return jsonify({
        "id": reminder_id,
        "title": title,
        "description": description or "",
        "due": data["due"],
        "status": REMINDER_PENDING,
    })


@app.route("/reminders/<int:reminder_id>", methods=["PATCH"])
def update_reminder(reminder_id):

    data = request.json or {}

    user_id = data.get("user_id")
    status = data.get("status")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if status not in (REMINDER_PENDING, REMINDER_DONE):
        return jsonify({
            "error": f"status must be {REMINDER_PENDING} or {REMINDER_DONE}"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    # Scoped by UserID as well as ReminderID: the client supplies both, so one
    # student cannot tick off another student's reminder by guessing an id.
    cursor.execute(
        "UPDATE Reminders SET Status = %s WHERE ReminderID = %s AND UserID = %s",
        (status, reminder_id, user_id),
    )

    connection.commit()
    changed = cursor.rowcount

    cursor.close()
    connection.close()

    if not changed:
        return jsonify({"error": "Reminder not found"}), 404

    return jsonify({"ok": True, "status": status})


@app.route("/reminders/<int:reminder_id>", methods=["DELETE"])
def delete_reminder(reminder_id):

    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM Reminders WHERE ReminderID = %s AND UserID = %s",
        (reminder_id, user_id),
    )

    connection.commit()
    changed = cursor.rowcount

    cursor.close()
    connection.close()

    if not changed:
        return jsonify({"error": "Reminder not found"}), 404

    return jsonify({"ok": True})


@app.route("/profile", methods=["GET"])
def get_profile():

    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    # LEFT JOIN so a student who has never saved a profile still gets their
    # name and email back, with the profile fields empty.
    cursor.execute(
        """
        SELECT u.FirstName, u.LastName, u.Email,
               p.Course, p.YearLevel, p.PreferredLanguage
        FROM Users u
        LEFT JOIN UserProfiles p ON p.UserID = u.UserID
        WHERE u.UserID = %s
        """,
        (user_id,),
    )

    row = cursor.fetchone()

    cursor.close()
    connection.close()

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "first_name": row["FirstName"],
        "last_name": row["LastName"],
        "email": row["Email"],
        "course": row["Course"] or "",
        "year_level": row["YearLevel"],
        "preferred_language": row["PreferredLanguage"] or "",
    })


def parse_year_level(value):
    """A year of study, or None when it is blank or not a sensible number.
    Bad input clears the field rather than failing the whole save."""

    try:
        year = int(value)
    except (TypeError, ValueError):
        return None

    return year if 1 <= year <= 10 else None


@app.route("/profile", methods=["PUT"])
def save_profile():

    data = request.json or {}

    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    course = (data.get("course") or "").strip()[:100] or None
    year_level = parse_year_level(data.get("year_level"))
    language = (data.get("preferred_language") or "").strip()[:20] or None

    connection = get_database_connection()
    cursor = connection.cursor()

    # One row per student (uq_userprofiles_user in db.sql), so the first save
    # inserts and every later one updates, without a read-then-write race.
    cursor.execute(
        """
        INSERT INTO UserProfiles (UserID, Course, YearLevel, PreferredLanguage)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            Course = VALUES(Course),
            YearLevel = VALUES(YearLevel),
            PreferredLanguage = VALUES(PreferredLanguage)
        """,
        (user_id, course, year_level, language),
    )

    connection.commit()
    cursor.close()
    connection.close()

    return jsonify({
        "ok": True,
        "course": course or "",
        "year_level": year_level,
        "preferred_language": language or "",
    })


# ---------------------------------------------------------- Word of the day

# A separate, much smaller prompt than SYSTEM_PROMPT: this is a one-shot data
# request, not a conversation, so asking for the chat formatting rules here
# would only invite Markdown into a JSON field.
#
# Deliberately no quotation, no attribution and no pronunciation guide. A model
# asked for a famous quote will invent who said it, and asked for IPA will
# invent that too, which is exactly what SYSTEM_PROMPT's honesty rules forbid.
WORD_PROMPT = """You are emmy, a study buddy in a student support app. Pick one word of the day \
for a university student.

Rules:
- The term must be an English academic word the student will really meet in reading, lectures and \
exams. Not slang, not obscure trivia, not a word only one field uses.
- The meaning must be one plain-language sentence, under 20 words.
- The example must be one natural sentence using the term in a study or academic context.
- Never use em-dashes. Do not add a pronunciation guide, a quotation or an attribution.

Reply with only this JSON object, no code fence and no commentary:
{"term": "...", "meaning": "...", "example": "..."}"""

# How many recent terms to send back to the model so it does not repeat itself.
RECENT_TERMS = 30


def parse_json_object(text):
    """Pull the first JSON object out of a model reply.

    Models wrap JSON in a ```json fence or put a sentence in front of it often
    enough that trusting json.loads on the whole reply fails for no good
    reason. Returns None if there is nothing parseable, and the caller turns
    that into an error the student can read.
    """

    if not isinstance(text, str):
        return None

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end < start:
        return None

    try:
        parsed = json.loads(text[start:end + 1])
    except ValueError:
        return None

    return parsed if isinstance(parsed, dict) else None


def build_word_prompt(course, language, recent):
    """WORD_PROMPT plus what we know about this student."""

    prompt = WORD_PROMPT

    if course:
        prompt += (
            f"\n\nThe student studies {course}. Prefer a word that is useful in that field, "
            "without being jargon only that field uses."
        )

    if language and language.strip().lower() != "english":
        prompt += (
            f"\n\nWrite the meaning in {language}. Keep the term itself and the example sentence "
            "in English, because that is the language of the student's notes and exams."
        )

    if recent:
        prompt += "\n\nDo not pick any of these, the student has had them recently: " + ", ".join(recent) + "."

    return prompt


def generate_word(course, language, recent):
    """Ask DeepSeek for today's word. Returns the dict or None."""

    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[{"role": "user", "content": build_word_prompt(course, language, recent)}],
    )

    word = parse_json_object(response.choices[0].message.content)

    if not word:
        return None

    # Trim to the column widths rather than letting MySQL reject the row for a
    # model that ignored "one sentence".
    term = str(word.get("term", "")).strip()[:60]
    meaning = str(word.get("meaning", "")).strip()[:255]
    example = str(word.get("example", "")).strip()[:255]

    if not term or not meaning or not example:
        return None

    return {"term": term, "meaning": meaning, "example": example}


@app.route("/motivation", methods=["GET"])
def motivation():

    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    today = date.today()

    connection = None
    cursor = None
    course = language = None
    recent = []

    # The database only makes today's word stable and personal. If it is down,
    # a freshly generated word is still worth showing, so every query here is
    # best-effort and the route carries on without them.
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT Term, Meaning, Example FROM DailyWords WHERE UserID = %s AND WordDate = %s",
            (user_id, today),
        )
        cached = cursor.fetchone()

        if cached:
            cursor.close()
            connection.close()
            return jsonify({
                "word": {
                    "term": cached["Term"],
                    "meaning": cached["Meaning"],
                    "example": cached["Example"],
                },
                "date": today.isoformat(),
            })

        cursor.execute(
            "SELECT Course, PreferredLanguage FROM UserProfiles WHERE UserID = %s",
            (user_id,),
        )
        profile = cursor.fetchone()

        if profile:
            course = profile["Course"]
            language = profile["PreferredLanguage"]

        cursor.execute(
            """
            SELECT Term FROM DailyWords
            WHERE UserID = %s
            ORDER BY WordDate DESC
            LIMIT %s
            """,
            (user_id, RECENT_TERMS),
        )
        recent = [row["Term"] for row in cursor.fetchall()]

    except Exception as error:
        print("motivation: database unavailable, generating without cache:", error)

    if not DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.strip() in ("", "paste_your_deepseek_api_key_here"):
        if cursor:
            cursor.close()
            connection.close()
        return jsonify({
            "error": "DeepSeek API key is missing. Set DEEPSEEK_API_KEY in backend/.env"
        }), 500

    try:
        word = generate_word(course, language, recent)
    except Exception as error:
        if cursor:
            cursor.close()
            connection.close()
        return jsonify({
            "error": "I couldn't fetch today's word. Try again in a moment?",
            "details": str(error),
        }), 502

    if not word:
        if cursor:
            cursor.close()
            connection.close()
        return jsonify({
            "error": "I couldn't fetch today's word. Try again in a moment?"
        }), 502

    # Cache it so the rest of today is free and the word holds still. INSERT
    # IGNORE because two tabs opening at once would otherwise collide on
    # uq_dailywords_user_date; the loser keeps the word it generated for this
    # response, and tomorrow they agree again.
    if cursor:
        try:
            cursor.execute(
                """
                INSERT IGNORE INTO DailyWords (UserID, WordDate, Term, Meaning, Example)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, today, word["term"], word["meaning"], word["example"]),
            )
            connection.commit()
        except Exception as error:
            print("motivation: could not cache today's word:", error)

        cursor.close()
        connection.close()

    return jsonify({"word": word, "date": today.isoformat()})

@app.route("/upload-notes", methods=["POST"])
def upload_notes():

    try:

        # Check if a file was included
        if "file" not in request.files:
            return jsonify({
                "error": "No file was uploaded."
            }), 400

        file = request.files["file"]

        # Check filename
        if file.filename == "":
            return jsonify({
                "error": "No file was selected."
            }), 400

        # Get extension
        extension = os.path.splitext(
            file.filename
        )[1].lower()

        # Check file type
        if extension not in ALLOWED_EXTENSIONS:
            return jsonify({
                "error": "Only PDF and DOCX files are supported."
            }), 400

        # Make filename safe
        safe_filename = secure_filename(
            file.filename
        )

        if not safe_filename:
            return jsonify({
                "error": "Invalid filename."
            }), 400

        # Save the file
        filepath = os.path.join(
            app.config["UPLOAD_FOLDER"],
            safe_filename
        )

        file.save(filepath)

        # Extract text
        notes_text = extract_text(filepath)

        # Make sure text was extracted
        if not notes_text.strip():

            # Delete the file
            if os.path.exists(filepath):
                os.remove(filepath)

            return jsonify({
                "error": (
                    "No readable text was found in this "
                    "document. The PDF may contain scanned images."
                )
            }), 400

        return jsonify({
            "message": "Notes uploaded successfully.",
            "filename": safe_filename,
            "file_type": extension,
            "text_length": len(notes_text),
            "notes_text": notes_text
        }), 200

    except Exception as e:

        print("UPLOAD ERROR:", str(e))

        return jsonify({
            "error": "An error occurred while processing the document."
        }), 500

# ----------------------------------------------------------
# STUDY CONTENT GENERATION
# ----------------------------------------------------------

@app.route("/generate-study-content", methods=["POST"])
def generate_study_content():

    data = request.json or {}

    study_type = data.get("type")
    notes_text = data.get("notes_text")

    if not study_type:
        return jsonify({
            "error": "Study content type is required."
        }), 400

    if study_type not in ["summary", "flashcards", "quiz"]:
        return jsonify({
            "error": "Invalid study content type."
        }), 400

    if not notes_text or not notes_text.strip():
        return jsonify({
            "error": "No study notes were provided."
        }), 400

    if not DEEPSEEK_API_KEY:
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    # Prevent extremely large requests
    notes_text = notes_text[:50000]

    if study_type == "summary":

        prompt = f"""
You are an AI study assistant.

Read the following student's study notes and create a clear,
easy-to-understand summary.

Requirements:
- Keep the important concepts.
- Use simple language.
- Organize the information with headings and bullet points.
- Do not add information that is not in the notes.
- Make it useful for exam revision.

STUDY NOTES:

{notes_text}
"""

    elif study_type == "flashcards":

        prompt = f"""
You are an AI study assistant.
Create useful study flashcards from the following notes.

Requirements:
- Create 10 to 20 flashcards.
- Each flashcard must have a question and an answer.
- Focus on important concepts, terminology, facts and explanations.
- Answers must be based only on the notes.
- Do not create a separate definitions section.
- Make the questions useful for exam revision.

Return the result in this format:

Flashcard 1
Question: ...
Answer: ...

Flashcard 2
Question: ...
Answer: ...
STUDY NOTES:

{notes_text}
"""

    else:

        
     prompt = f"""
Create a multiple-choice quiz using only the uploaded study notes.

Return ONLY valid JSON in this format:

{{
    "questions": [
        {{
            "question": "Question text",
            "options": [
                "A. First option",
                "B. Second option",
                "C. Third option",
                "D. Fourth option"
            ],
            "correct_answer": "B. Second option"
        }}
    ]
}}

Rules:
- Create exactly 10 questions.
- Create questions based only on the uploaded notes.
- Include exactly 4 options for each question.
- Include only one correct answer.
- Do not explain the answer.
- Do not display the correct answer to the student until they select an option.

STUDY NOTES:

{notes_text}
"""

    try:

        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful university study assistant. "
                        "Only use information contained in the student's notes."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        generated_content = response.choices[0].message.content
        return jsonify({
            "success": True,
            "type": study_type,
            "content": generated_content
        }), 200

    except Exception as error:

        print("STUDY CONTENT ERROR:", str(error))

        return jsonify({
            "error": "Failed to generate study content.",
            "details": str(error)
        }), 500


@app.route("/generate-timed-test", methods=["POST"])
def generate_timed_test():

    data = request.json or {}

    notes_text = data.get("notes_text")
    num_questions = data.get("num_questions", 10)

    if not notes_text or not notes_text.strip():
        return jsonify({
            "error": "No study notes were provided."
        }), 400

    if not DEEPSEEK_API_KEY or client is None:
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    notes_text = notes_text[:50000]

    prompt = f"""
You are an AI university test creator.

Create a realistic examination using ONLY the student's study notes.

The student requested approximately {num_questions} questions.

Create a balanced mixture of:

1. MULTIPLE CHOICE QUESTIONS
   - The student must select one answer.
   - Provide exactly 4 options.
   - Only one option is correct.

2. SHORT ANSWER QUESTIONS
   - The student must type their answer.
   - Do NOT provide answer options.

3. LONG ANSWER QUESTIONS
   - The student must type a detailed answer.
   - Do NOT provide answer options.

IMPORTANT:
- Use ONLY information from the study notes.
- Do not add information not found in the notes.
MARKING RUBRIC REQUIREMENTS:

For EVERY short answer and long answer question:

- Provide a complete correctAnswer that represents a high-quality model answer.
- Create a clear markingCriteria array.
- Break the total marks into specific criteria.
- The marks in markingCriteria MUST add up exactly to the question's total marks.
- Each criterion must describe a specific piece of knowledge or explanation expected from the student.
- Make the marking criteria specific enough for another AI to use when marking the student's answer.
- Do not create vague criteria such as "good answer" or "well explained".
- Use measurable criteria based only on the study notes.
- Make the test feel like a real university examination.
- Give every question marks based on its difficulty.
- Multiple choice questions should usually be worth 1 or 2 marks.
- Short questions should usually be worth 3 to 5 marks.
- Long questions should usually be worth 8 to 15 marks.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not add explanations outside the JSON.

Use this exact format:

[
  {{
    "type": "multiple_choice",
    "question": "Question text",
    "marks": 2,
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswer": "Option A"
  }},
  {{
    "type": "short_answer",
    "question": "Question text",
    "marks": 5,
    "correctAnswer": "A complete model answer",
    "markingCriteria": [
      {{
        "criterion": "First key concept",
        "marks": 2
      }},
      {{
        "criterion": "Second key concept",
        "marks": 2
      }},
      {{
        "criterion": "Clear explanation",
        "marks": 1
      }}
    ]
  }},
  {{
    "type": "long_answer",
    "question": "Question text",
    "marks": 10,
    "correctAnswer": "A detailed model answer",
    "markingCriteria": [
      {{
        "criterion": "First important concept",
        "marks": 3
      }},
      {{
        "criterion": "Second important concept",
        "marks": 3
      }},
      {{
        "criterion": "Third important concept",
        "marks": 2
      }},
      {{
        "criterion": "Clear explanation and structure",
        "marks": 2
      }}
    ]
  }}
]

STUDY NOTES:

{notes_text}
"""

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a study examination generator. "
                        "Return only valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        generated_content = (
            response.choices[0].message.content.strip()
        )

        questions = json.loads(generated_content)

        return jsonify({
            "success": True,
            "questions": questions
        }), 200

    except json.JSONDecodeError as error:

        print("JSON ERROR:", str(error))

        return jsonify({
            "error": "The generated test could not be read correctly."
        }), 500

    except Exception as error:

        print("TIMED TEST ERROR:", str(error))

        return jsonify({
            "error": "Failed to generate timed test.",
            "details": str(error)
        }), 500

    # ==========================================
# AI MARKING FOR SHORT AND LONG ANSWERS
# ==========================================

@app.route("/mark-written-answer", methods=["POST"])
def mark_written_answer():

    data = request.json or {}

    question = data.get("question", "")
    student_answer = data.get("student_answer", "")
    correct_answer = data.get("correct_answer", "")
    marking_criteria = data.get("marking_criteria", [])
    total_marks = data.get("total_marks", 0)

    # Validate the information received
    if not question:
        return jsonify({
            "error": "Question is required."
        }), 400

    if not student_answer or not student_answer.strip():
        return jsonify({
            "error": "Student answer is required."
        }), 400

    if not correct_answer:
        return jsonify({
            "error": "Model answer is required."
        }), 400

    if not marking_criteria:
        return jsonify({
            "error": "Marking criteria is required."
        }), 400

    if not DEEPSEEK_API_KEY or client is None:
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    prompt = f"""
You are a fair and consistent university examination marker.

Mark the student's answer using the question, model answer,
and marking criteria below.

QUESTION:
{question}

STUDENT ANSWER:
{student_answer}

MODEL ANSWER:
{correct_answer}

MARKING CRITERIA:
{json.dumps(marking_criteria, indent=2)}

TOTAL AVAILABLE MARKS:
{total_marks}

MARKING INSTRUCTIONS:

1. Award marks based on the marking criteria.
2. Award marks ONLY for knowledge demonstrated in the student's answer.
3. Do not award marks for information the student did not provide.
4. The student does NOT need to use the exact same wording as the model answer.
5. Accept different wording when the meaning is correct.
6. Award partial marks when a criterion is partially satisfied.
7. Do not award more than the total available marks.
8. Give clear and constructive feedback.
9. Explain what the student did correctly.
10. Explain what important information was missing.

Return ONLY valid JSON.

Use exactly this format:

{{
    "awardedMarks": 0,
    "totalMarks": {total_marks},
    "feedback": "Explain why these marks were awarded.",
    "missingPoints": [
        "A missing important point"
    ]
}}
"""

    try:

        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a fair university examination marker. "
                        "Follow the provided marking criteria. "
                        "Return only valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        generated_content = (
            response.choices[0].message.content.strip()
        )

        result = json.loads(generated_content)

        awarded_marks = result.get("awardedMarks", 0)

        # Make sure marks stay within the allowed range
        awarded_marks = min(
            max(float(awarded_marks), 0),
            float(total_marks)
        )

        result["awardedMarks"] = awarded_marks
        result["totalMarks"] = total_marks

        return jsonify({
            "success": True,
            "result": result
        }), 200


    except json.JSONDecodeError as error:

        print("MARKING JSON ERROR:", str(error))

        return jsonify({
            "error": "The AI marking result could not be read correctly."
        }), 500


    except Exception as error:

        print("MARKING ERROR:", str(error))

        return jsonify({
            "error": "Failed to mark the written answer.",
            "details": str(error)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)

