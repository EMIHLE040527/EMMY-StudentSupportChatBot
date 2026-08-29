import os
import fitz
from docx import Document


ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def get_file_extension(filename):
    """
    Get the file extension in lowercase.
    """

    return os.path.splitext(filename)[1].lower()


def extract_pdf_text(filepath):
    """
    Extract text from a PDF document.
    """

    document = fitz.open(filepath)

    text = []

    for page in document:
        page_text = page.get_text()

        if page_text:
            text.append(page_text)

    document.close()

    return "\n".join(text)


def extract_docx_text(filepath):
    """
    Extract text from a Word DOCX document.
    """

    document = Document(filepath)

    text = []

    for paragraph in document.paragraphs:

        if paragraph.text.strip():
            text.append(paragraph.text)

    return "\n".join(text)


def extract_text(filepath):
    """
    Automatically determine whether the file
    is PDF or DOCX and extract the text.
    """

    extension = get_file_extension(filepath)

    if extension == ".pdf":
        return extract_pdf_text(filepath)

    elif extension == ".docx":
        return extract_docx_text(filepath)

    else:
        raise ValueError(
            "Unsupported file type. "
            "Only PDF and DOCX files are supported."
        )