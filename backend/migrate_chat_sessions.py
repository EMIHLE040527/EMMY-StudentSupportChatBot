"""One-off migration: add chat-session persistence to an existing database.

Fresh installs get this straight from db.sql. This script brings an already
created EmmyStudentSupportChatBot up to the same shape without dropping data:

  1. create the ChatSessions table (if missing)
  2. add ChatHistory.SessionID (if missing)
  3. add the SessionID -> ChatSessions foreign key (if missing)

It is idempotent: run it as many times as you like. From backend/ with the
venv active:  python migrate_chat_sessions.py
"""

from database import get_database_connection


def _scalar(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchone()[0]


def table_exists(cursor, name):
    return _scalar(
        cursor,
        """SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = %s""",
        (name,),
    )


def column_exists(cursor, table, column):
    return _scalar(
        cursor,
        """SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE()
             AND table_name = %s AND column_name = %s""",
        (table, column),
    )


def fk_exists(cursor, table, constraint):
    return _scalar(
        cursor,
        """SELECT COUNT(*) FROM information_schema.table_constraints
           WHERE table_schema = DATABASE()
             AND table_name = %s AND constraint_name = %s
             AND constraint_type = 'FOREIGN KEY'""",
        (table, constraint),
    )


def migrate():
    connection = get_database_connection()
    cursor = connection.cursor()

    if not table_exists(cursor, "ChatSessions"):
        cursor.execute(
            """
            CREATE TABLE ChatSessions (
                SessionID INT AUTO_INCREMENT PRIMARY KEY,
                UserID INT NOT NULL,
                Title VARCHAR(120) NOT NULL DEFAULT 'New chat',
                CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                UpdatedDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
            )
            """
        )
        print("created table ChatSessions")
    else:
        print("ChatSessions already exists, skipping")

    # NULL-able so the column can be added to a table that already has rows.
    # The app always supplies a SessionID; fresh installs (db.sql) make it
    # NOT NULL.
    if not column_exists(cursor, "ChatHistory", "SessionID"):
        cursor.execute("ALTER TABLE ChatHistory ADD COLUMN SessionID INT NULL AFTER UserID")
        print("added column ChatHistory.SessionID")
    else:
        print("ChatHistory.SessionID already exists, skipping")

    if not fk_exists(cursor, "ChatHistory", "fk_chathistory_session"):
        cursor.execute(
            """ALTER TABLE ChatHistory
               ADD CONSTRAINT fk_chathistory_session
               FOREIGN KEY (SessionID) REFERENCES ChatSessions(SessionID)
               ON DELETE CASCADE"""
        )
        print("added foreign key fk_chathistory_session")
    else:
        print("fk_chathistory_session already exists, skipping")

    connection.commit()
    cursor.close()
    connection.close()
    print("migration complete")


if __name__ == "__main__":
    migrate()
