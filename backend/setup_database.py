"""Create the database, tables and demo user from the .sql files in this folder.

This is the portable way to stand the database up on a new machine: it needs
nothing but a running MySQL and the DB_* values in backend/.env, and it reads
the schema from db.sql and the demo account from seed.sql, so there is no
schema copy to drift. Run it once after cloning:

    cd backend
    python setup_database.py

It is safe to re-run: an already-created database, table or demo user is left
as-is rather than erroring.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
import mysql.connector
from mysql.connector import errorcode

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DB_NAME = os.getenv("DB_NAME", "EmmyStudentSupportChatBot")

# "Already exists" style errors we treat as success so re-runs are harmless.
IGNORABLE = {
    errorcode.ER_DB_CREATE_EXISTS,   # database exists
    errorcode.ER_TABLE_EXISTS_ERROR,  # table exists
    errorcode.ER_DUP_KEYNAME,         # index/constraint exists
    errorcode.ER_DUP_ENTRY,           # seed row exists
    errorcode.ER_FK_DUP_NAME,         # foreign key exists
}


def split_statements(sql):
    """Split a simple .sql file into statements. Our files have no procedures
    or semicolons inside string literals, so splitting on ';' is safe."""
    return [s.strip() for s in sql.split(";") if s.strip()]


def run_file(cursor, path):
    applied = skipped = 0
    for statement in split_statements(path.read_text(encoding="utf-8")):
        try:
            cursor.execute(statement)
            applied += 1
        except mysql.connector.Error as error:
            if error.errno in IGNORABLE:
                skipped += 1
            else:
                raise
    return applied, skipped


def main():
    # Connect WITHOUT selecting a database, since it may not exist yet.
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cursor = connection.cursor()

    for name in ("db.sql", "seed.sql"):
        path = HERE / name
        if not path.exists():
            print(f"skip: {name} not found")
            continue
        applied, skipped = run_file(cursor, path)
        connection.commit()
        print(f"{name}: {applied} statement(s) applied, {skipped} already in place")

    cursor.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = %s ORDER BY table_name",
        (DB_NAME,),
    )
    tables = [row[0] for row in cursor.fetchall()]
    print(f"\nDatabase '{DB_NAME}' has {len(tables)} tables: {', '.join(tables)}")

    cursor.execute(f"SELECT COUNT(*) FROM {DB_NAME}.Users")
    print(f"Users in database: {cursor.fetchone()[0]} (demo login: demo@example.com / changeme)")

    cursor.close()
    connection.close()
    print("\nDatabase ready.")


if __name__ == "__main__":
    main()
