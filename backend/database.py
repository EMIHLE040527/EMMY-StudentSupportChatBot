import os
from pathlib import Path
from dotenv import load_dotenv
import mysql.connector

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

def get_database_connection():
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "13331")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "defaultdb")
    )

    return connection