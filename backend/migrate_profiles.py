"""One-off migration: make UserProfiles one row per student.

Fresh installs get this straight from db.sql. This script brings an already
created EmmyStudentSupportChatBot up to the same shape without dropping data:

  1. delete duplicate UserProfiles rows, keeping the newest per student
  2. add the UNIQUE key on UserProfiles.UserID

Step 2 is what lets /profile save with a single INSERT ... ON DUPLICATE KEY
UPDATE. Step 1 has to run first, because the unique key cannot be added while
duplicates exist.

It is idempotent: run it as many times as you like. From backend/ with the
venv active:  python migrate_profiles.py
"""

from database import get_database_connection


def _scalar(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchone()[0]


def index_exists(cursor, table, index):
    return _scalar(
        cursor,
        """SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema = DATABASE()
             AND table_name = %s AND index_name = %s""",
        (table, index),
    )


def migrate():
    connection = get_database_connection()
    cursor = connection.cursor()

    if index_exists(cursor, "UserProfiles", "uq_userprofiles_user"):
        print("uq_userprofiles_user already exists, nothing to do")
    else:
        # Keep the highest ProfileID per student: with no timestamp on this
        # table, the newest row is the best guess at the current profile.
        cursor.execute(
            """
            DELETE FROM UserProfiles
            WHERE ProfileID NOT IN (
                SELECT keep FROM (
                    SELECT MAX(ProfileID) AS keep FROM UserProfiles GROUP BY UserID
                ) AS newest
            )
            """
        )
        removed = cursor.rowcount
        print(f"removed {removed} duplicate profile row(s)")

        cursor.execute(
            "ALTER TABLE UserProfiles ADD UNIQUE KEY uq_userprofiles_user (UserID)"
        )
        print("added unique key uq_userprofiles_user")

    connection.commit()
    cursor.close()
    connection.close()
    print("migration complete")


if __name__ == "__main__":
    migrate()
