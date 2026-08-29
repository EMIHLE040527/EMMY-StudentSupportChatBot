"""One-off migration: add the word-of-the-day cache to an existing database.

Fresh installs get this straight from db.sql. This script adds the DailyWords
table to an already created EmmyStudentSupportChatBot without touching any
existing data.

It is idempotent: run it as many times as you like. From backend/ with the
venv active:  python migrate_daily_words.py
"""

from database import get_database_connection


def table_exists(cursor, name):
    cursor.execute(
        """SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = %s""",
        (name,),
    )
    return cursor.fetchone()[0]


def migrate():
    connection = get_database_connection()
    cursor = connection.cursor()

    if table_exists(cursor, "DailyWords"):
        print("DailyWords already exists, nothing to do")
    else:
        cursor.execute(
            """
            CREATE TABLE DailyWords (
                WordID INT AUTO_INCREMENT PRIMARY KEY,
                UserID INT NOT NULL,
                WordDate DATE NOT NULL,
                Term VARCHAR(60) NOT NULL,
                Meaning VARCHAR(255) NOT NULL,
                Example VARCHAR(255) NOT NULL,
                CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_dailywords_user_date (UserID, WordDate),
                FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
            )
            """
        )
        print("created table DailyWords")

    connection.commit()
    cursor.close()
    connection.close()
    print("migration complete")


if __name__ == "__main__":
    migrate()
