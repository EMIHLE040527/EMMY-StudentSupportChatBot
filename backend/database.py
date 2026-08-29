import os
from pathlib import Path
from dotenv import load_dotenv
import mysql.connector

# Next to this file, not the current working directory: see app.py.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))


def get_database_connection():

    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "EmmyStudentSupportChatBot"),
    )

    return connection
