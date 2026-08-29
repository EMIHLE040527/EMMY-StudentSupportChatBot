# START HERE — running EMMY on your machine

Everything is included except the two folders that never travel between
computers: the Python virtual environment and `node_modules`. You rebuild those
locally in steps 1 and 4 below.

**You do not need a database file from me.** The whole database is defined in
`backend/db.sql`, and `backend/setup_database.py` builds it on your MySQL in one
command (step 3). Nothing to import, nothing to hand-copy.

You need: **MySQL** (you have it), **Python 3.9+**, **Node.js + npm**.

---

## 1. Backend environment

Open PowerShell in the project folder:

```powershell
cd backend
python -m venv VirtualEnvironment
.\VirtualEnvironment\Scripts\Activate.ps1
pip install -r requirements.txt
```

If `Activate.ps1` is blocked by an execution policy error, run this once and try again:

```powershell
Set-ExecutionPolicy -Scope Process -Bypass
```

## 2. Set your MySQL password

Open `backend/.env` in a text editor. The DeepSeek API key is already filled in.
Change **one line** — put your own MySQL root password after the `=`:

```
DB_PASSWORD=PUT_YOUR_MYSQL_ROOT_PASSWORD_HERE
```

(No quotes, no spaces around the `=`. If your root account has no password, just
leave it empty: `DB_PASSWORD=`)

## 3. Build the database

Make sure MySQL is running, then from `backend` with the environment still active:

```powershell
python setup_database.py
```

It creates the `EmmyStudentSupportChatBot` database, all the tables and a demo
login. It is safe to run more than once. You should see a line listing the
tables and `Database ready.` at the end.

Demo login for the app: **demo@example.com** / **changeme**
(or just register a new account on the login screen)

## 4. Run the backend

Same terminal, still in `backend` with the environment active:

```powershell
python app.py
```

Leave this window open. Check it works: open http://127.0.0.1:5000/test-db in a
browser — it should confirm MySQL is connected.

## 5. Run the frontend

Open a **second** PowerShell window in the project folder:

```powershell
cd frontend
npm install
npm start
```

Your browser opens http://localhost:3000. Log in and chat.

Both windows need to stay open while you use the app.

---

## If something goes wrong

| What you see | Fix |
|---|---|
| `Access denied for user 'root'@'localhost'` | The password in `backend/.env` doesn't match your MySQL. Redo step 2. |
| `Can't connect to MySQL server` | MySQL isn't running. Start the MySQL service (Windows: Services → MySQL → Start). |
| `ModuleNotFoundError: No module named 'flask'` | The virtual environment isn't active. Run `.\VirtualEnvironment\Scripts\Activate.ps1` from `backend` first — you should see `(VirtualEnvironment)` at the start of your prompt. |
| Chat says it can't reach the server | The backend window in step 4 isn't running, or it crashed. Check that window for errors. |
| VS Code underlines `import flask` in red | Editor-only, doesn't stop the app. `Ctrl+Shift+P` → *Python: Select Interpreter* → *Enter interpreter path* → `backend\VirtualEnvironment\Scripts\python.exe` |

The DeepSeek API key in `.env` is a shared key on my account — please don't
commit it anywhere public or share it further.

More detail on the project itself is in `README.md` and the `docs/` folder.
