from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_database_connection
from Bursary_Service import analyse_transcript
from werkzeug.utils import secure_filename
from pypdf import PdfReader
from docx import Document
from pptx import Presentation
from dotenv import load_dotenv
from openai import OpenAI
from pathlib import Path
from datetime import date, datetime
from zipfile import is_zipfile

import requests
import json
import os
import shutil
import subprocess
import tempfile
import sqlite3
from pathlib import Path
from flask import request, jsonify


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)

CORS(app, origins=[
    "http://localhost:3000",
    "https://emmy-frontend.onrender.com"
])

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

DEEPSEEK_BASE_URL = os.getenv(
    "DEEPSEEK_BASE_URL",
    "https://api.deepseek.com"
)

DEEPSEEK_MODEL = os.getenv(
    "DEEPSEEK_MODEL",
    "deepseek-v4-flash"
)

client = None

if DEEPSEEK_API_KEY:
    client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL
    )
else:
    print("WARNING: DeepSeek API key is missing.")

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".pptx",
    ".ppt"
}


# ============================================================
# AI SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are emmy, an AI study buddy inside the Student Support Chatbot.

You help university students understand academic topics, prepare
for examinations, solve problems and develop study skills.

You can also answer general questions about everyday life,
technology, science, careers, hobbies and other subjects.

Explain difficult concepts clearly in simple language.

Use examples when helpful.

Encourage understanding instead of simply providing answers.

Support academic integrity. Help students understand assessments,
plan their answers and develop their own work.

Never invent institutional information such as examination dates,
deadlines, fees, grades or university rules.

If you are uncertain, explain that you are unsure.

Respond in the same language the student uses.

Use a warm, encouraging and professional tone.

Refer to yourself as emmy.

Use Markdown formatting.

Use headings, short paragraphs and bullet points where appropriate.

Use LaTeX for mathematical equations.

Keep explanations concise unless more detail is requested.

Support students kindly when they are struggling.

You are both a study assistant and general-purpose chatbot.
"""


def system_prompt_for(preferred_language):
    if not isinstance(preferred_language, str):
        return SYSTEM_PROMPT

    language = preferred_language.strip()[:40]

    if not language:
        return SYSTEM_PROMPT

    return (
        SYSTEM_PROMPT
        + f"\nThe student's preferred language is {language}. "
        + "Respond in the language of their latest message."
    )


def check_ai_client():
    return client is not None


def parse_ai_json(text):
    if not isinstance(text, str):
        raise ValueError("The AI returned an empty response.")

    text = text.strip()

    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


def parse_json_object(text):
    try:
        result = parse_ai_json(text)

        if isinstance(result, dict):
            return result

    except (ValueError, TypeError):
        pass

    if not isinstance(text, str):
        return None

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end < start:
        return None

    try:
        result = json.loads(text[start:end + 1])
        return result if isinstance(result, dict) else None
    except ValueError:
        return None


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():
    return "Student Support Chatbot Backend is Running!"


@app.route("/test-db")
def test_database():
    connection = get_database_connection()

    try:
        if connection.is_connected():
            return "Database connection successful!"

        return "Database connection failed!"
    finally:
        connection.close()


# ============================================================
# REGISTRATION AND LOGIN
# ============================================================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    required = [
        "FirstName",
        "LastName",
        "Email",
        "Password"
    ]

    if any(not data.get(field) for field in required):
        return jsonify({
            "error": "All registration fields are required."
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO Users
            (FirstName, LastName, Email, Password)
            VALUES (%s, %s, %s, %s)
            """,
            (
                data["FirstName"],
                data["LastName"],
                data["Email"],
                data["Password"]
            )
        )

        connection.commit()

        return jsonify({
            "message": "User registered successfully!"
        })

    except Exception as error:
        connection.rollback()

        return jsonify({
            "error": str(error)
        }), 500

    finally:
        cursor.close()
        connection.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("Email")
    password = data.get("Password")

    if not email or not password:
        return jsonify({
            "message": "Email and password are required."
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT *
            FROM Users
            WHERE Email = %s AND Password = %s
            """,
            (email, password)
        )

        user = cursor.fetchone()

        if user:
            return jsonify({
                "message": "Login successful!",
                "UserID": user["UserID"],
                "FirstName": user["FirstName"]
            })

        return jsonify({
            "message": "Invalid email or password"
        }), 401

    finally:
        cursor.close()
        connection.close()


# ============================================================
# CHAT HISTORY
# ============================================================

MAX_HISTORY_MESSAGES = 20


def build_history(raw):
    if not isinstance(raw, list):
        return []

    cleaned = []

    for item in raw:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role == "emmy":
            role = "assistant"

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        cleaned.append({
            "role": role,
            "content": content
        })

    return cleaned[-MAX_HISTORY_MESSAGES:]


def save_exchange(user_id, session_id, user_message, reply):
    if not user_id or not session_id:
        return False

    connection = None
    cursor = None

    try:
        connection = get_database_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO ChatHistory
            (UserID, SessionID, UserMessage, BotResponse)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, session_id, user_message, reply)
        )

        cursor.execute(
            """
            UPDATE ChatSessions
            SET UpdatedDate = CURRENT_TIMESTAMP
            WHERE SessionID = %s
            """,
            (session_id,)
        )

        connection.commit()
        return True

    except Exception as error:
        print("Save exchange error:", error)

        if connection:
            connection.rollback()

        return False

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


# ============================================================
# AI CHAT
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():
    if not check_ai_client():
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    data = request.get_json() or {}

    user_message = data.get("message", "")

    if not user_message:
        return jsonify({
            "error": "Message is required."
        }), 400

    history = build_history(data.get("history"))

    messages = [{
        "role": "system",
        "content": system_prompt_for(
            data.get("preferred_language")
        )
    }]

    messages.extend(history)

    messages.append({
        "role": "user",
        "content": user_message
    })

    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages
        )

        reply = response.choices[0].message.content

        saved = save_exchange(
            data.get("user_id"),
            data.get("session_id"),
            user_message,
            reply
        )

        return jsonify({
            "reply": reply,
            "saved": saved
        })

    except Exception as error:
        print("Chat error:", error)

        return jsonify({
            "error": "DeepSeek chat request failed",
            "details": str(error)
        }), 502


# ============================================================
# CHAT SESSIONS
# ============================================================

@app.route("/sessions", methods=["GET"])
def list_sessions():
    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT SessionID, Title, CreatedDate, UpdatedDate
            FROM ChatSessions
            WHERE UserID = %s
            ORDER BY UpdatedDate DESC, SessionID DESC
            """,
            (user_id,)
        )

        rows = cursor.fetchall()

        sessions = [{
            "id": row["SessionID"],
            "title": row["Title"]
        } for row in rows]

        return jsonify({
            "sessions": sessions
        })

    finally:
        cursor.close()
        connection.close()


@app.route("/sessions", methods=["POST"])
def create_session():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    title = (data.get("title") or "New chat").strip()[:120]

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO ChatSessions (UserID, Title)
            VALUES (%s, %s)
            """,
            (user_id, title)
        )

        connection.commit()

        return jsonify({
            "id": cursor.lastrowid,
            "title": title
        })

    finally:
        cursor.close()
        connection.close()


@app.route("/sessions/<int:session_id>", methods=["PATCH"])
def rename_session(session_id):
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()[:120]

    if not title:
        return jsonify({
            "error": "title is required"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE ChatSessions
            SET Title = %s
            WHERE SessionID = %s
            """,
            (title, session_id)
        )

        connection.commit()

        return jsonify({
            "ok": True,
            "title": title
        })

    finally:
        cursor.close()
        connection.close()


@app.route(
    "/sessions/<int:session_id>/messages",
    methods=["GET"]
)
def session_messages(session_id):
    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT UserMessage, BotResponse
            FROM ChatHistory
            WHERE SessionID = %s
            ORDER BY ChatID ASC
            """,
            (session_id,)
        )

        rows = cursor.fetchall()
        messages = []

        for row in rows:
            messages.append({
                "role": "user",
                "text": row["UserMessage"]
            })

            messages.append({
                "role": "emmy",
                "text": row["BotResponse"]
            })

        return jsonify({
            "messages": messages
        })

    finally:
        cursor.close()
        connection.close()


# ============================================================
# REMINDERS
# ============================================================

REMINDER_PENDING = "Pending"
REMINDER_DONE = "Done"

BROWSER_DATETIME = "%Y-%m-%dT%H:%M"


def parse_due(value):
    if not isinstance(value, str):
        return None

    try:
        due = datetime.strptime(
            value.strip(),
            BROWSER_DATETIME
        )

        return due.strftime("%Y-%m-%d %H:%M:%S")

    except ValueError:
        return None


def reminder_row(row):
    return {
        "id": row["ReminderID"],
        "title": row["ReminderTitle"],
        "description": row["ReminderDescription"] or "",
        "due": row["ReminderDate"].strftime(BROWSER_DATETIME),
        "status": row["Status"]
    }


@app.route("/reminders", methods=["GET"])
def list_reminders():
    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT ReminderID, ReminderTitle,
                   ReminderDescription, ReminderDate, Status
            FROM Reminders
            WHERE UserID = %s
            ORDER BY ReminderDate ASC, ReminderID ASC
            """,
            (user_id,)
        )

        rows = cursor.fetchall()

        return jsonify({
            "reminders": [
                reminder_row(row) for row in rows
            ]
        })

    finally:
        cursor.close()
        connection.close()


@app.route("/reminders", methods=["POST"])
def create_reminder():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    title = (data.get("title") or "").strip()[:100]
    description = (data.get("description") or "").strip() or None
    due = parse_due(data.get("due"))

    if not user_id or not title or not due:
        return jsonify({
            "error": "Valid user_id, title and due date are required."
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO Reminders
            (UserID, ReminderTitle, ReminderDescription,
             ReminderDate, Status)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user_id,
                title,
                description,
                due,
                REMINDER_PENDING
            )
        )

        connection.commit()

        return jsonify({
            "id": cursor.lastrowid,
            "title": title,
            "description": description or "",
            "due": data["due"],
            "status": REMINDER_PENDING
        })

    finally:
        cursor.close()
        connection.close()


@app.route(
    "/reminders/<int:reminder_id>",
    methods=["PATCH"]
)
def update_reminder(reminder_id):
    data = request.get_json() or {}

    user_id = data.get("user_id")
    status = data.get("status")

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    if status not in (REMINDER_PENDING, REMINDER_DONE):
        return jsonify({
            "error": "Invalid reminder status."
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE Reminders
            SET Status = %s
            WHERE ReminderID = %s AND UserID = %s
            """,
            (status, reminder_id, user_id)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "error": "Reminder not found"
            }), 404

        return jsonify({
            "ok": True,
            "status": status
        })

    finally:
        cursor.close()
        connection.close()


@app.route(
    "/reminders/<int:reminder_id>",
    methods=["DELETE"]
)
def delete_reminder(reminder_id):
    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM Reminders
            WHERE ReminderID = %s AND UserID = %s
            """,
            (reminder_id, user_id)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "error": "Reminder not found"
            }), 404

        return jsonify({
            "ok": True
        })

    finally:
        cursor.close()
        connection.close()


# ============================================================
# USER PROFILE
# ============================================================

@app.route("/profile", methods=["GET"])
def get_profile():
    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    connection = get_database_connection()

    cursor = connection.cursor(
        dictionary=True,
        buffered=True
    )

    try:
        cursor.execute(
            """
            SELECT
                u.FirstName,
                u.LastName,
                u.Email,
                p.Course,
                p.YearLevel,
                p.PreferredLanguage,
                p.Location,
                p.Latitude,
                p.Longitude
            FROM Users u
            LEFT JOIN UserProfiles p
                ON p.UserID = u.UserID
            WHERE u.UserID = %s
            LIMIT 1
            """,
            (user_id,)
        )

        row = cursor.fetchone()

        if not row:
            return jsonify({
                "error": "User not found"
            }), 404

        return jsonify({
            "first_name": row["FirstName"] or "",
            "last_name": row["LastName"] or "",
            "email": row["Email"] or "",
            "course": row["Course"] or "",
            "year_level": row["YearLevel"] or "",
            "preferred_language": row["PreferredLanguage"] or "",
            "location": row["Location"] or "",
            "latitude": row["Latitude"] if row["Latitude"] is not None else "",
            "longitude": row["Longitude"] if row["Longitude"] is not None else ""
        })

    finally:
        cursor.close()
        connection.close()


def parse_year_level(value):
    try:
        year = int(value)
    except (ValueError, TypeError):
        return None

    return year if 1 <= year <= 10 else None


@app.route("/profile", methods=["PUT"])
def save_profile():
    data = request.get_json() or {}

    user_id = data.get("user_id")

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    course = (data.get("course") or "").strip()[:100] or None
    year_level = parse_year_level(data.get("year_level"))
    language = (data.get("preferred_language") or "").strip()[:20] or None
    location = (data.get("location") or "").strip()[:100] or None
    latitude = data.get("latitude") or None
    longitude = data.get("longitude") or None

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO UserProfiles
            (
                UserID, Course, YearLevel, PreferredLanguage,
                Location, Latitude, Longitude
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)

            ON DUPLICATE KEY UPDATE
                Course = VALUES(Course),
                YearLevel = VALUES(YearLevel),
                PreferredLanguage = VALUES(PreferredLanguage),
                Location = VALUES(Location),
                Latitude = VALUES(Latitude),
                Longitude = VALUES(Longitude)
            """,
            (
                user_id,
                course,
                year_level,
                language,
                location,
                latitude,
                longitude
            )
        )

        connection.commit()

        return jsonify({
            "ok": True,
            "course": course or "",
            "year_level": year_level,
            "preferred_language": language or "",
            "location": location or "",
            "latitude": latitude or "",
            "longitude": longitude or ""
        })

    finally:
        cursor.close()
        connection.close()


# ============================================================
# WORD OF THE DAY
# ============================================================

WORD_PROMPT = """
You are emmy, a student study assistant.

Generate one academic word of the day useful for university students.

The term should be commonly used in academic reading or lectures.

The meaning must be one simple sentence under 20 words.

The example must use the word naturally in an academic context.

Return ONLY valid JSON:

{
    "term": "...",
    "meaning": "...",
    "example": "..."
}
"""

RECENT_TERMS = 30


def build_word_prompt(course, language, recent):
    prompt = WORD_PROMPT

    if course:
        prompt += f"\nThe student studies {course}."

    if language and language.lower() != "english":
        prompt += f"\nWrite the meaning in {language}."

    if recent:
        prompt += "\nDo not repeat these words: " + ", ".join(recent)

    return prompt


def generate_word(course, language, recent):
    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[{
            "role": "user",
            "content": build_word_prompt(
                course,
                language,
                recent
            )
        }]
    )

    word = parse_json_object(
        response.choices[0].message.content
    )

    if not word:
        return None

    term = str(word.get("term", "")).strip()[:60]
    meaning = str(word.get("meaning", "")).strip()[:255]
    example = str(word.get("example", "")).strip()[:255]

    if not term or not meaning or not example:
        return None

    return {
        "term": term,
        "meaning": meaning,
        "example": example
    }


@app.route("/motivation", methods=["GET"])
def motivation():
    user_id = request.args.get("user_id", type=int)

    if not user_id:
        return jsonify({
            "error": "user_id is required"
        }), 400

    today = date.today()

    connection = None
    cursor = None
    course = None
    language = None
    recent = []

    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT Term, Meaning, Example
            FROM DailyWords
            WHERE UserID = %s AND WordDate = %s
            """,
            (user_id, today)
        )

        cached = cursor.fetchone()

        if cached:
            return jsonify({
                "word": {
                    "term": cached["Term"],
                    "meaning": cached["Meaning"],
                    "example": cached["Example"]
                },
                "date": today.isoformat()
            })

        cursor.execute(
            """
            SELECT Course, PreferredLanguage
            FROM UserProfiles
            WHERE UserID = %s
            """,
            (user_id,)
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
            (user_id, RECENT_TERMS)
        )

        recent = [row["Term"] for row in cursor.fetchall()]

    except Exception as error:
        print("Motivation database error:", error)

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()

    if not check_ai_client():
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    try:
        word = generate_word(course, language, recent)

        if not word:
            return jsonify({
                "error": "Unable to generate today's word."
            }), 502

        try:
            connection = get_database_connection()
            cursor = connection.cursor()

            try:
                cursor.execute(
                    """
                    INSERT IGNORE INTO DailyWords
                    (UserID, WordDate, Term, Meaning, Example)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        today,
                        word["term"],
                        word["meaning"],
                        word["example"]
                    )
                )

                connection.commit()

            finally:
                cursor.close()
                connection.close()

        except Exception as error:
            print("Word caching error:", error)

        return jsonify({
            "word": word,
            "date": today.isoformat()
        })

    except Exception as error:
        print("Motivation error:", error)

        return jsonify({
            "error": "Unable to generate today's word.",
            "details": str(error)
        }), 502


# ============================================================
# POWERPOINT CONVERSION
# ============================================================

def find_libreoffice():
    paths = [
        r"C:\Program Files\LibreOffice\program\soffice.com",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.com",
        shutil.which("soffice.com"),
        shutil.which("soffice"),
        shutil.which("libreoffice")
    ]

    for path in paths:
        if path and os.path.isfile(path):
            return path

    return None


def validate_pptx(filepath):
    if not os.path.isfile(filepath):
        raise ValueError("Converted PowerPoint file was not created.")

    if os.path.getsize(filepath) == 0:
        raise ValueError("Converted PowerPoint file is empty.")

    if not is_zipfile(filepath):
        raise ValueError("Converted PowerPoint file is invalid.")

    presentation = Presentation(filepath)

    print(
        "PowerPoint validation successful.",
        "Slides:",
        len(presentation.slides)
    )

    return filepath


def convert_ppt_with_microsoft(ppt_path, converted_path):
    import pythoncom
    import win32com.client

    powerpoint = None
    presentation = None

    pythoncom.CoInitialize()

    try:
        print("Trying Microsoft PowerPoint conversion...")

        powerpoint = win32com.client.DispatchEx(
            "PowerPoint.Application"
        )

        powerpoint.DisplayAlerts = 1

        presentation = powerpoint.Presentations.Open(
            os.path.abspath(ppt_path),
            ReadOnly=True,
            Untitled=False,
            WithWindow=False
        )

        presentation.SaveAs(
            os.path.abspath(converted_path),
            24
        )

        presentation.Close()
        presentation = None

        result = validate_pptx(converted_path)

        print("Microsoft PowerPoint conversion successful.")

        return result

    finally:
        if presentation is not None:
            try:
                presentation.Close()
            except Exception:
                pass

        if powerpoint is not None:
            try:
                powerpoint.Quit()
            except Exception:
                pass

        pythoncom.CoUninitialize()


def convert_ppt_with_libreoffice(
    ppt_path,
    converted_path,
    profile_dir
):
    office = find_libreoffice()

    if not office:
        raise ValueError("LibreOffice could not be found.")

    output_dir = os.path.dirname(converted_path)

    profile_url = Path(profile_dir).resolve().as_uri()

    command = [
        office,
        f"-env:UserInstallation={profile_url}",
        "--headless",
        "--convert-to",
        "pptx:Impress MS PowerPoint 2007 XML",
        "--outdir",
        os.path.abspath(output_dir),
        os.path.abspath(ppt_path)
    ]

    clean_env = os.environ.copy()

    for variable in [
        "PYTHONHOME",
        "PYTHONPATH",
        "PYTHONSTARTUP",
        "PYTHONEXECUTABLE"
    ]:
        clean_env.pop(variable, None)

    print("Trying LibreOffice conversion...")

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=120,
        env=clean_env
    )

    print("LibreOffice return code:", result.returncode)
    print("LibreOffice stdout:", result.stdout)
    print("LibreOffice stderr:", result.stderr)

    return validate_pptx(converted_path)


def convert_ppt_to_pptx(ppt_path, output_dir, profile_dir):
    os.makedirs(output_dir, exist_ok=True)

    converted_path = os.path.abspath(
        os.path.join(
            output_dir,
            Path(ppt_path).stem + ".pptx"
        )
    )

    errors = []

    # Microsoft PowerPoint first because LibreOffice
    # has been crashing on this Windows installation.

    if os.name == "nt":
        try:
            return convert_ppt_with_microsoft(
                ppt_path,
                converted_path
            )

        except ImportError:
            errors.append(
                "Microsoft PowerPoint automation unavailable. "
                "Install pywin32."
            )

        except Exception as error:
            errors.append(
                "Microsoft PowerPoint: " + str(error)
            )

    # Try LibreOffice if Microsoft PowerPoint
    # is unavailable or conversion failed.

    try:
        return convert_ppt_with_libreoffice(
            ppt_path,
            converted_path,
            profile_dir
        )

    except Exception as error:
        errors.append(
            "LibreOffice: " + str(error)
        )

    print("All PowerPoint conversion attempts failed.")

    for error in errors:
        print(error)

    raise ValueError(
        "Automatic PPT conversion failed. "
        + " | ".join(errors)
    )


# ============================================================
# DOCUMENT TEXT EXTRACTION
# ============================================================

def extract_pdf_notes(filepath):
    reader = PdfReader(filepath)

    pages = []

    for page in reader.pages:
        pages.append(page.extract_text() or "")

    return "\n".join(pages)


def extract_word_notes(filepath):
    document = Document(filepath)

    parts = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if text:
            parts.append(text)

    for table in document.tables:
        for row in table.rows:
            row_text = " | ".join(
                cell.text.strip()
                for cell in row.cells
            )

            if row_text.strip():
                parts.append(row_text)

    return "\n".join(parts)


def extract_slide_shapes(shapes):
    parts = []

    for shape in shapes:
        if shape.has_text_frame:
            text = shape.text.strip()

            if text:
                parts.append(text)

        if shape.has_table:
            for row in shape.table.rows:
                row_text = " | ".join(
                    cell.text.strip()
                    for cell in row.cells
                )

                if row_text.strip():
                    parts.append(row_text)

        if shape.shape_type == 6:
            parts.extend(
                extract_slide_shapes(shape.shapes)
            )

    return parts


def extract_powerpoint_notes(filepath):
    presentation = Presentation(filepath)

    slides = []
    found_text = False

    for number, slide in enumerate(
        presentation.slides,
        start=1
    ):
        parts = extract_slide_shapes(slide.shapes)

        if parts:
            found_text = True

        slides.append(
            f"Slide {number}\n" + "\n".join(parts)
        )

    if not found_text:
        return ""

    return "\n\n".join(slides)


# ============================================================
# STUDY NOTES UPLOAD
# ============================================================

@app.route("/upload-notes", methods=["POST"])
def upload_notes():
    converted_dir = None

    try:
        if "file" not in request.files:
            return jsonify({
                "error": "No file was uploaded."
            }), 400

        file = request.files["file"]

        if not file.filename:
            return jsonify({
                "error": "No file was selected."
            }), 400

        extension = Path(file.filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            return jsonify({
                "error": "Only PDF, DOCX, PPTX and PPT are supported."
            }), 400

        safe_filename = secure_filename(file.filename)

        if not safe_filename:
            return jsonify({
                "error": "Invalid filename."
            }), 400

        filepath = os.path.join(
            app.config["UPLOAD_FOLDER"],
            safe_filename
        )

        if os.path.exists(filepath):
            name = Path(safe_filename).stem

            safe_filename = (
                f"{name}_"
                f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
                f"{extension}"
            )

            filepath = os.path.join(
                app.config["UPLOAD_FOLDER"],
                safe_filename
            )

        file.save(filepath)

        print("Uploaded file:", filepath)

        processing_path = filepath

        if extension == ".ppt":
            converted_dir = tempfile.mkdtemp(
                prefix="emmy_ppt_conversion_"
            )

            output_dir = os.path.join(
                converted_dir,
                "output"
            )

            profile_dir = os.path.join(
                converted_dir,
                "profile"
            )

            processing_path = convert_ppt_to_pptx(
                filepath,
                output_dir,
                profile_dir
            )

        if extension == ".pdf":
            notes_text = extract_pdf_notes(processing_path)

        elif extension == ".docx":
            notes_text = extract_word_notes(processing_path)

        elif extension in (".ppt", ".pptx"):
            notes_text = extract_powerpoint_notes(
                processing_path
            )

        else:
            notes_text = ""

        notes_text = notes_text.strip()

        if not notes_text:
            return jsonify({
                "error": (
                    "No readable text was found. "
                    "The document may contain images or scans."
                )
            }), 400

        print("Extracted characters:", len(notes_text))

        return jsonify({
            "message": "Notes uploaded successfully.",
            "filename": safe_filename,
            "file_type": extension,
            "text_length": len(notes_text),
            "notes_text": notes_text
        }), 200

    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "PowerPoint conversion timed out."
        }), 500

    except ValueError as error:
        print("Upload error:", error)

        return jsonify({
            "error": str(error)
        }), 400

    except Exception as error:
        print("UPLOAD ERROR:", repr(error))

        return jsonify({
            "error": "An error occurred while processing the document.",
            "details": str(error)
        }), 500

    finally:
        if converted_dir and os.path.isdir(converted_dir):
            shutil.rmtree(
                converted_dir,
                ignore_errors=True
            )


# ============================================================
# STUDY CONTENT GENERATION
# ============================================================

@app.route("/generate-study-content", methods=["POST"])
def generate_study_content():
    data = request.get_json() or {}

    study_type = data.get("type")
    notes_text = data.get("notes_text", "")

    if study_type not in ["summary", "flashcards", "quiz"]:
        return jsonify({
            "error": "Invalid study content type."
        }), 400

    if not isinstance(notes_text, str) or not notes_text.strip():
        return jsonify({
            "error": "No study notes were provided."
        }), 400

    if not check_ai_client():
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    notes_text = notes_text[:50000]

    if study_type == "summary":
        prompt = f"""
You are an AI study assistant.

Read the student's study notes and create a clear,
easy-to-understand summary.

Requirements:
- Keep important concepts.
- Use simple language.
- Organize with headings and bullet points.
- Do not invent information.
- Make it useful for examination revision.

STUDY NOTES:

{notes_text}
"""

    elif study_type == "flashcards":
        prompt = f"""
You are an AI study assistant.

Create 10 to 20 useful flashcards.

Requirements:
- Each flashcard must contain a question and answer.
- Cover important concepts and terminology.
- Use only information in the notes.
- Do not create a separate definitions section.

Format:

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
Create exactly 10 multiple-choice questions using
only the student's uploaded notes.

Each question must have four options.

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
- Exactly 10 questions.
- Exactly four options per question.
- One correct answer.
- No explanations.
- Use only information from the notes.

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
                        "Use only the uploaded notes."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        content = response.choices[0].message.content

        return jsonify({
            "success": True,
            "type": study_type,
            "content": content
        }), 200

    except Exception as error:
        print("Study content error:", error)

        return jsonify({
            "error": "Failed to generate study content.",
            "details": str(error)
        }), 500


# ============================================================
# LISTEN AND LEARN
# ============================================================

@app.route("/generate-listen-learn", methods=["POST"])
def generate_listen_learn():
    try:
        data = request.get_json() or {}
        notes_text = data.get("notes_text", "")

        if not isinstance(notes_text, str) or not notes_text.strip():
            return jsonify({
                "error": "Please upload study notes first."
            }), 400

        if not check_ai_client():
            return jsonify({
                "error": "DeepSeek API key is missing."
            }), 500

        prompt = f"""
You are EMMY, an intelligent university study tutor.

Create a natural educational conversation between
two female characters named Tutor and Student.

Use only the uploaded study notes.

PHASE 1: COMPLETE LESSON EXPLANATION

The Tutor must teach the entire topic first.

Explain all important concepts using clear, simple English.

Use examples where helpful.

The Student must not speak during this phase.

The Tutor may use several consecutive messages.

The final Tutor message must explain that
the lesson is complete.

PHASE 2: QUESTION AND ANSWER

Only after the lesson is complete may the
Student begin asking questions.

The Student asks exactly one question at a time.

The Tutor must answer each question completely.

Continue alternating between Student and Tutor.

The conversation must end with a Tutor answer.

Do not use Markdown inside the dialogue.

Do not include speaker names inside the text.

Return ONLY valid JSON:

{{
    "conversation": [
        {{
            "speaker": "Tutor",
            "text": "Today we are going to learn about..."
        }},
        {{
            "speaker": "Tutor",
            "text": "Another important concept is..."
        }},
        {{
            "speaker": "Tutor",
            "text": "That completes the lesson."
        }},
        {{
            "speaker": "Student",
            "text": "Can you explain this concept again?"
        }},
        {{
            "speaker": "Tutor",
            "text": "Of course. Let me explain..."
        }},
        {{
            "speaker": "Student",
            "text": "Why is this important?"
        }},
        {{
            "speaker": "Tutor",
            "text": "It is important because..."
        }}
    ]
}}

STUDY NOTES:

{notes_text}
"""

        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are EMMY, a university study tutor. "
                        "Follow the requested conversation order."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7
        )

        content = response.choices[0].message.content
        lesson_data = parse_ai_json(content)

        conversation = lesson_data.get("conversation", [])

        if not isinstance(conversation, list):
            return jsonify({
                "error": "The AI returned an invalid conversation."
            }), 500

        cleaned = []

        for item in conversation:
            if not isinstance(item, dict):
                continue

            speaker = str(item.get("speaker", "")).strip()
            line = str(item.get("text", "")).strip()

            if not line:
                continue

            speaker = (
                "Student"
                if "student" in speaker.lower()
                else "Tutor"
            )

            cleaned.append({
                "speaker": speaker,
                "text": line
            })

        if not cleaned:
            return jsonify({
                "error": "The AI did not create a lesson."
            }), 500

        first_student_index = None

        for i, item in enumerate(cleaned):
            if item["speaker"] == "Student":
                first_student_index = i
                break

        if first_student_index is None:
            return jsonify({
                "error": "The lesson did not contain student questions."
            }), 500

        for i in range(first_student_index):
            if cleaned[i]["speaker"] != "Tutor":
                return jsonify({
                    "error": "Invalid lesson order."
                }), 500

        expected = "Student"

        for i in range(first_student_index, len(cleaned)):
            if cleaned[i]["speaker"] != expected:
                return jsonify({
                    "error": f"Invalid conversation order at line {i + 1}."
                }), 500

            expected = "Tutor" if expected == "Student" else "Student"

        if cleaned[-1]["speaker"] != "Tutor":
            return jsonify({
                "error": "The final question was not answered."
            }), 500

        return jsonify({
            "conversation": cleaned
        })

    except (json.JSONDecodeError, ValueError) as error:
        print("Listen & Learn JSON error:", error)

        return jsonify({
            "error": "The AI returned invalid lesson data."
        }), 500

    except Exception as error:
        print("Listen & Learn error:", error)

        return jsonify({
            "error": "Failed to generate Listen & Learn lesson.",
            "details": str(error)
        }), 500


# ============================================================
# TIMED TEST GENERATION
# ============================================================

@app.route("/generate-timed-test", methods=["POST"])
def generate_timed_test():
    data = request.get_json() or {}

    notes_text = data.get("notes_text")
    num_questions = data.get("num_questions", 10)

    if not isinstance(notes_text, str) or not notes_text.strip():
        return jsonify({
            "error": "No study notes were provided."
        }), 400

    if not check_ai_client():
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    notes_text = notes_text[:50000]

    prompt = f"""
You are an AI university examination generator.

Create approximately {num_questions} questions
using ONLY the uploaded study notes.

Create a balanced mixture of:

1. MULTIPLE CHOICE QUESTIONS
- Exactly four options.
- One correct answer.
- Usually 1 or 2 marks.

2. SHORT ANSWER QUESTIONS
- No options.
- Usually 3 to 5 marks.

3. LONG ANSWER QUESTIONS
- No options.
- Usually 8 to 15 marks.

For every short and long answer question:

- Provide a complete correctAnswer.
- Provide a markingCriteria array.
- Make criteria specific and measurable.
- Criteria marks must add up to question marks.
- Use only the uploaded notes.

Return ONLY valid JSON.

Use exactly this format:

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
                "marks": 3
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
                "marks": 4
            }},
            {{
                "criterion": "Second important concept",
                "marks": 4
            }},
            {{
                "criterion": "Clear explanation",
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
                        "You are a university examination generator. "
                        "Return only valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        content = response.choices[0].message.content
        questions = parse_ai_json(content)

        if not isinstance(questions, list):
            return jsonify({
                "error": "The AI did not return a question list."
            }), 500

        return jsonify({
            "success": True,
            "questions": questions
        }), 200

    except (json.JSONDecodeError, ValueError) as error:
        print("Timed test JSON error:", error)

        return jsonify({
            "error": "The generated test could not be read correctly."
        }), 500

    except Exception as error:
        print("Timed test error:", error)

        return jsonify({
            "error": "Failed to generate timed test.",
            "details": str(error)
        }), 500


# ============================================================
# AI MARKING
# ============================================================

@app.route("/mark-written-answer", methods=["POST"])
def mark_written_answer():
    data = request.get_json() or {}

    question = data.get("question", "")
    student_answer = data.get("student_answer", "")
    correct_answer = data.get("correct_answer", "")
    marking_criteria = data.get("marking_criteria", [])
    total_marks = data.get("total_marks", 0)

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

    if not check_ai_client():
        return jsonify({
            "error": "DeepSeek API key is missing."
        }), 500

    prompt = f"""
You are a fair university examination marker.

Mark the student's answer using the question,
model answer and marking criteria.

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

Rules:
1. Award marks only for demonstrated knowledge.
2. Follow the marking criteria.
3. Accept equivalent wording.
4. Award partial marks where appropriate.
5. Never exceed the total marks.
6. Explain what the student got right.
7. Explain what was missing.
8. Provide constructive feedback.

Return ONLY valid JSON:

{{
    "awardedMarks": 0,
    "totalMarks": {total_marks},
    "feedback": "Explain why marks were awarded.",
    "missingPoints": [
        "An important missing point"
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
                        "Follow the criteria and return valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        content = response.choices[0].message.content
        result = parse_ai_json(content)

        awarded = result.get("awardedMarks", 0)

        awarded = min(
            max(float(awarded), 0),
            float(total_marks)
        )

        result["awardedMarks"] = awarded
        result["totalMarks"] = total_marks

        return jsonify({
            "success": True,
            "result": result
        }), 200

    except (json.JSONDecodeError, ValueError) as error:
        print("Marking JSON error:", error)

        return jsonify({
            "error": "The AI marking result could not be read correctly."
        }), 500

    except Exception as error:
        print("Marking error:", error)

        return jsonify({
            "error": "Failed to mark the written answer.",
            "details": str(error)
        }), 500


# ============================================================
# WEATHER
# ============================================================

@app.route("/weather", methods=["GET"])
def get_weather():
    try:
        url = "https://api.open-meteo.com/v1/forecast"

        params = {
            "latitude": -33.9249,
            "longitude": 18.4241,
            "current": "temperature_2m,weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min",
            "timezone": "Africa/Johannesburg",
            "forecast_days": 5
        }

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        response.raise_for_status()

        data = response.json()
        current = data.get("current", {})
        daily = data.get("daily", {})

        weather_codes = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Foggy",
            48: "Foggy",
            51: "Light drizzle",
            53: "Drizzle",
            55: "Heavy drizzle",
            61: "Light rain",
            63: "Rain",
            65: "Heavy rain",
            71: "Light snow",
            73: "Snow",
            75: "Heavy snow",
            80: "Rain showers",
            81: "Rain showers",
            82: "Heavy rain showers",
            95: "Thunderstorm"
        }

        weather_code = current.get("weather_code")

        return jsonify({
            "city": "Cape Town",
            "temperature": current.get("temperature_2m"),
            "wind_speed": current.get("wind_speed_10m"),
            "condition": weather_codes.get(
                weather_code,
                "Unknown weather"
            ),
            "forecast": {
                "dates": daily.get("time", []),
                "max": daily.get("temperature_2m_max", []),
                "min": daily.get("temperature_2m_min", [])
            }
        })

    except Exception as error:
        print("Weather error:", error)

        return jsonify({
            "error": "Unable to retrieve weather"
        }), 500


# ============================================================
# BURSARY TRANSCRIPT ANALYSIS
# ============================================================

@app.route("/api/bursaries/analyse", methods=["POST"])
def analyse_bursary_transcript():
    try:
        if "transcript" not in request.files:
            return jsonify({
                "success": False,
                "message": "Please upload a transcript."
            }), 400

        file = request.files["transcript"]

        if not file.filename:
            return jsonify({
                "success": False,
                "message": "No file was selected."
            }), 400

        extension = Path(file.filename).suffix.lower()

        if extension not in (".pdf", ".docx"):
            return jsonify({
                "success": False,
                "message": "Only PDF and Word (.docx) files are supported."
            }), 400

        result = analyse_transcript(
            file,
            file.filename
        )

        return jsonify({
            "success": True,
            "data": result
        })

    except Exception as error:
        print("Bursary analysis error:", error)

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500

# ============================================================
# STUDENT FEEDBACK - MULTIPLE FEATURE RATINGS
# ============================================================

FEEDBACK_DB = Path(__file__).resolve().parent / "emmy_feedback.db"

FEEDBACK_FEATURES = {
    "Overall Chatbot Experience",
    "Chat Responses",
    "Notes Upload",
    "Summary",
    "Flashcards",
    "Quiz",
    "Listen & Learn",
    "Timed Test",
    "Study Timer",
    "Coloring Game",
    "Bursary Finder",
    "Reminders",
    "Daily Motivation",
}


def init_feedback_database():
    with sqlite3.connect(FEEDBACK_DB) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS feedback_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                comment TEXT NOT NULL,
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS feedback_feature_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL,
                feature TEXT NOT NULL,
                rating INTEGER NOT NULL
                    CHECK (rating BETWEEN 1 AND 5),
                FOREIGN KEY (submission_id)
                    REFERENCES feedback_submissions(id)
                    ON DELETE CASCADE,
                UNIQUE (submission_id, feature)
            )
        """)

        connection.commit()


init_feedback_database()


@app.route("/feedback", methods=["POST"])
def submit_student_feedback():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Please provide valid feedback."
        }), 400

    feature_ratings = data.get("feature_ratings")
    comment = data.get("comment")
    user_id = data.get("user_id")

    if (
        not isinstance(feature_ratings, list)
        or len(feature_ratings) == 0
        or len(feature_ratings) > len(FEEDBACK_FEATURES)
    ):
        return jsonify({
            "error": "Please select at least one feature."
        }), 400

    validated_ratings = []
    selected_names = set()

    for item in feature_ratings:
        if not isinstance(item, dict):
            return jsonify({
                "error": "Invalid feature rating."
            }), 400

        feature = item.get("feature")
        rating = item.get("rating")

        if feature not in FEEDBACK_FEATURES:
            return jsonify({
                "error": "An invalid feature was selected."
            }), 400

        if feature in selected_names:
            return jsonify({
                "error": "Duplicate feature ratings are not allowed."
            }), 400

        if (
            isinstance(rating, bool)
            or not isinstance(rating, int)
            or not 1 <= rating <= 5
        ):
            return jsonify({
                "error": "Every feature must have a rating from 1 to 5."
            }), 400

        selected_names.add(feature)
        validated_ratings.append((feature, rating))

    if not isinstance(comment, str) or not comment.strip():
        return jsonify({
            "error": "Please write your feedback."
        }), 400

    comment = comment.strip()

    if len(comment) > 2000:
        return jsonify({
            "error": "Feedback must be under 2000 characters."
        }), 400

    if user_id is not None:
        user_id = str(user_id)

        if len(user_id) > 100:
            return jsonify({
                "error": "Invalid user identifier."
            }), 400

    try:
        with sqlite3.connect(FEEDBACK_DB) as connection:
            connection.execute("PRAGMA foreign_keys = ON")

            cursor = connection.execute("""
                INSERT INTO feedback_submissions
                    (user_id, comment)
                VALUES (?, ?)
            """, (user_id, comment))

            submission_id = cursor.lastrowid

            connection.executemany("""
                INSERT INTO feedback_feature_ratings
                    (submission_id, feature, rating)
                VALUES (?, ?, ?)
            """, [
                (submission_id, feature, rating)
                for feature, rating in validated_ratings
            ])

            connection.commit()

        return jsonify({
            "success": True,
            "message": "Feedback submitted successfully.",
            "submission_id": submission_id,
            "features_reviewed": len(validated_ratings)
        }), 201

    except sqlite3.Error:
        app.logger.exception("Failed to save feedback")

        return jsonify({
            "error": "Could not save your feedback."
        }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":
    app.run(debug=True)
