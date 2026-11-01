import re
import os

from pypdf import PdfReader
from docx import Document

try:
    import pymupdf
except ImportError:
    pymupdf = None

try:
    import pytesseract
    from PIL import Image, ImageOps, ImageEnhance
except ImportError:
    pytesseract = None
    Image = None
    ImageOps = None
    ImageEnhance = None


# ============================================================
# TESSERACT OCR CONFIGURATION
# ============================================================

def configure_tesseract():

    if pytesseract is None:
        return False

    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for path in possible_paths:

        if os.path.exists(path):

            pytesseract.pytesseract.tesseract_cmd = path

            print("Tesseract found:", path)

            return True

    try:

        pytesseract.get_tesseract_version()

        print("Tesseract found in system PATH.")

        return True

    except Exception:

        print("WARNING: Tesseract OCR was not found.")

        return False


# ============================================================
# REAL BURSARIES / FUNDING OPPORTUNITIES
# ============================================================

BURSARIES = [

    {
        "id": 1,

        "name": "CSIR Bursary Programme",

        "provider": (
            "Council for Scientific and Industrial Research (CSIR)"
        ),

        "description": (
            "The CSIR Bursary Programme provides financial support "
            "for qualifying full-time students in priority science, "
            "engineering and technology fields. Honours-level "
            "study areas include selected engineering and technology "
            "fields."
        ),

        "courses": [
            "computer engineering",
            "electronic engineering",
            "electronics engineering",
            "computer science",
            "information systems",
            "data science",
            "civil engineering",
            "geoinformatics",
            "engineering",
            "technology"
        ],

        "minimum_average": 65,

        "study_levels": [
            "honours",
            "postgraduate"
        ],

        "url": (
            "https://www.csir.co.za/careers/"
            "students-graduates/bursaries/"
            "2026-bursary-programme"
        )
    },


    {
        "id": 2,

        "name": "DSTI-NRF Honours Student Funding",

        "provider": (
            "National Research Foundation (NRF)"
        ),

        "description": (
            "DSTI-NRF Honours funding supports eligible students "
            "undertaking Honours studies in Science, Engineering "
            "and Technology and other supported fields. The 2027 "
            "call lists a minimum academic requirement of 65% "
            "for major subjects in the final undergraduate year."
        ),

        "courses": [
            "computer engineering",
            "electronic engineering",
            "electrical engineering",
            "software engineering",
            "computer science",
            "information technology",
            "information systems",
            "engineering technology",
            "engineering",
            "technology",
            "science"
        ],

        "minimum_average": 65,

        "study_levels": [
            "honours",
            "postgraduate"
        ],

        "url": (
            "https://www.nrf.ac.za/"
            "announcement-of-call-dsti-nrf-honours-"
            "student-funding-for-the-academic-year-2027/"
        )
    },


    {
        "id": 3,

        "name": "CSIR-DSTI Inter-Programme Bursary Scheme",

        "provider": (
            "CSIR / Department of Science, "
            "Technology and Innovation"
        ),

        "description": (
            "The CSIR-DSTI Inter-Programme Bursary Scheme supports "
            "full-time Honours, fourth-year Engineering, "
            "Postgraduate Diploma, Masters and PhD studies at "
            "South African public universities in specified "
            "research areas."
        ),

        "courses": [
            "computer engineering",
            "electronic engineering",
            "electrical engineering",
            "engineering",
            "computer science",
            "information technology",
            "technology"
        ],

        "minimum_average": 65,

        "study_levels": [
            "honours",
            "postgraduate"
        ],

        "url": (
            "https://www.csir.co.za/careers/"
            "students-graduates/dsi-inter-programme-bursary"
        )
    }

]


# ============================================================
# PDF TEXT EXTRACTION
# ============================================================

def extract_pdf_text(file):

    try:

        file.seek(0)

        reader = PdfReader(file)

        pages = []

        print(
            "PDF pages detected by normal extractor:",
            len(reader.pages)
        )

        for page_number, page in enumerate(reader.pages):

            try:

                text = page.extract_text() or ""

                print(
                    f"Normal PDF extraction - page "
                    f"{page_number + 1}: {len(text)} characters"
                )

                if text.strip():

                    pages.append(text)

            except Exception as error:

                print(
                    f"Could not extract page "
                    f"{page_number + 1}:",
                    error
                )

        extracted_text = "\n".join(pages)

        print(
            "Total normal PDF text:",
            len(extracted_text)
        )

        return extracted_text

    except Exception as error:

        print(
            "Normal PDF extraction failed:",
            error
        )

        return ""


# ============================================================
# OCR PDF
# ============================================================

def ocr_pdf(file):

    if pymupdf is None:

        print(
            "PyMuPDF is not installed. "
            "Run: pip install pymupdf"
        )

        return ""

    if pytesseract is None or Image is None:

        print(
            "OCR libraries are not installed. "
            "Run: pip install pytesseract pillow"
        )

        return ""

    if not configure_tesseract():

        print(
            "Tesseract OCR is not installed or cannot be found."
        )

        return ""

    try:

        # ----------------------------------------------------
        # READ UPLOADED PDF
        # ----------------------------------------------------

        file.seek(0)

        pdf_data = file.read()

        print(
            "\n========================================"
        )

        print(
            "UPLOADED PDF INFORMATION"
        )

        print(
            "File size:",
            len(pdf_data),
            "bytes"
        )

        print(
            "========================================"
        )

        # ----------------------------------------------------
        # OPEN PDF
        # ----------------------------------------------------

        pdf = pymupdf.open(
            stream=pdf_data,
            filetype="pdf"
        )

        page_count = len(pdf)

        print(
            "PDF PAGE COUNT:",
            page_count
        )

        if page_count == 0:

            print(
                "ERROR: PDF contains no pages."
            )

            pdf.close()

            return ""

        all_pages = []

        print(
            "\n========================================"
        )

        print(
            "STARTING OCR"
        )

        print(
            "Processing ALL PDF pages..."
        )

        print(
            "========================================"
        )

        # ----------------------------------------------------
        # PROCESS EVERY PAGE
        # ----------------------------------------------------

        for page_number in range(page_count):

            page = pdf[page_number]

            print(
                f"\nOCR processing page "
                f"{page_number + 1} of {page_count}..."
            )

            print(
                "Page dimensions:",
                page.rect.width,
                "x",
                page.rect.height
            )

            # ------------------------------------------------
            # RENDER PAGE
            # ------------------------------------------------

            matrix = pymupdf.Matrix(
                3,
                3
            )

            pixmap = page.get_pixmap(
                matrix=matrix,
                alpha=False
            )

            image = Image.frombytes(
                "RGB",
                [
                    pixmap.width,
                    pixmap.height
                ],
                pixmap.samples
            )

            # ------------------------------------------------
            # IMAGE PRE-PROCESSING
            # ------------------------------------------------

            image = ImageOps.grayscale(
                image
            )

            image = ImageEnhance.Contrast(
                image
            ).enhance(2.0)

            image = ImageEnhance.Sharpness(
                image
            ).enhance(2.0)

            # ------------------------------------------------
            # OCR
            # ------------------------------------------------

            text = pytesseract.image_to_string(
                image,
                config="--oem 3 --psm 6",
                lang="eng"
            )

            print(
                f"OCR page {page_number + 1}: "
                f"{len(text)} characters"
            )

            print(
                "OCR preview:"
            )

            print(
                text[:1500]
            )

            # ------------------------------------------------
            # STORE PAGE TEXT
            # ------------------------------------------------

            if text.strip():

                all_pages.append(
                    text
                )

        # ----------------------------------------------------
        # CLOSE PDF
        # ----------------------------------------------------

        pdf.close()

        # ----------------------------------------------------
        # COMBINE ALL PAGES
        # ----------------------------------------------------

        full_text = "\n".join(
            all_pages
        )

        print(
            "\n========================================"
        )

        print(
            "OCR COMPLETE"
        )

        print(
            "Pages processed:",
            page_count
        )

        print(
            "Pages containing text:",
            len(all_pages)
        )

        print(
            "Total OCR text:",
            len(full_text)
        )

        print(
            "========================================"
        )

        return full_text

    except Exception as error:

        print(
            "OCR extraction failed:",
            error
        )

        return ""


# ============================================================
# DOCX EXTRACTION
# ============================================================

def extract_docx_text(file):

    try:

        file.seek(0)

        document = Document(file)

        parts = []

        for paragraph in document.paragraphs:

            if paragraph.text.strip():

                parts.append(
                    paragraph.text
                )

        for table in document.tables:

            for row in table.rows:

                row_text = []

                for cell in row.cells:

                    if cell.text.strip():

                        row_text.append(
                            cell.text.strip()
                        )

                if row_text:

                    parts.append(
                        " ".join(row_text)
                    )

        text = "\n".join(
            parts
        )

        print(
            "DOCX extracted text:",
            len(text),
            "characters"
        )

        return text

    except Exception as error:

        print(
            "DOCX extraction failed:",
            error
        )

        return ""


# ============================================================
# MAIN FILE EXTRACTION
# ============================================================

def extract_transcript_text(
    file,
    filename
):

    filename_lower = filename.lower()

    print(
        "\n========================================"
    )

    print(
        "STARTING TRANSCRIPT EXTRACTION"
    )

    print(
        "File:",
        filename
    )

    print(
        "========================================"
    )

    if filename_lower.endswith(".pdf"):

        text = extract_pdf_text(
            file
        )

        if text.strip():

            print(
                "Normal PDF text was found."
            )

            return text

        print(
            "No selectable PDF text found."
        )

        print(
            "This appears to be a scanned PDF."
        )

        print(
            "Starting OCR..."
        )

        return ocr_pdf(
            file
        )

    if filename_lower.endswith(".docx"):

        return extract_docx_text(
            file
        )

    print(
        "Unsupported file type."
    )

    return ""


# ============================================================
# TEXT CLEANING
# ============================================================

def normalise_text(text):

    if not text:

        return ""

    text = text.replace(
        "\r",
        "\n"
    )

    text = text.replace(
        "\xa0",
        " "
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    return text


# ============================================================
# COURSE DETECTION
# ============================================================

def detect_course(text):

    text_lower = text.lower()

    course_patterns = [

        (
            "Computer Engineering",
            [
                "computer engineering",
                "bachelor of engineering technology in computer engineering",
                "engineering technology in computer engineering"
            ]
        ),

        (
            "Electronic Engineering",
            [
                "electronic engineering",
                "electronics engineering"
            ]
        ),

        (
            "Electrical Engineering",
            [
                "electrical engineering"
            ]
        ),

        (
            "Software Engineering",
            [
                "software engineering"
            ]
        ),

        (
            "Computer Science",
            [
                "computer science"
            ]
        ),

        (
            "Information Technology",
            [
                "information technology"
            ]
        ),

        (
            "Information Systems",
            [
                "information systems"
            ]
        ),

        (
            "Engineering Technology",
            [
                "engineering technology"
            ]
        ),

        (
            "Engineering",
            [
                "engineering"
            ]
        ),

        (
            "Technology",
            [
                "technology"
            ]
        )
    ]

    for course_name, patterns in course_patterns:

        for pattern in patterns:

            if pattern in text_lower:

                print(
                    "Course detected:",
                    course_name
                )

                return course_name

    print(
        "Course could not be detected."
    )

    return "Unknown"


# ============================================================
# STUDY LEVEL DETECTION
# ============================================================

def detect_study_level(text):

    text_lower = text.lower()

    if (
        "honours" in text_lower
        or "honors" in text_lower
        or "beng tech hons" in text_lower
        or "bachelor honours" in text_lower
    ):

        print(
            "Current study level detected: Honours"
        )

        return "Honours"

    if (
        "postgraduate" in text_lower
        or "master" in text_lower
        or "doctoral" in text_lower
        or "phd" in text_lower
    ):

        print(
            "Current study level detected: Postgraduate"
        )

        return "Postgraduate"

    if (
        "bachelor" in text_lower
        or "undergraduate" in text_lower
        or "nqf exit level 7" in text_lower
    ):

        print(
            "Current study level detected: Undergraduate"
        )

        return "Undergraduate"

    print(
        "Study level could not be detected."
    )

    return "Unknown"


# ============================================================
# TARGET STUDY LEVEL
# ============================================================

def determine_target_study_level(
    study_level,
    nqf_level
):

    if study_level in [
        "Honours",
        "Postgraduate"
    ]:

        return study_level

    if (
        study_level == "Undergraduate"
        and str(nqf_level) == "7"
    ):

        print(
            "Target study level for funding: Honours"
        )

        return "Honours"

    return study_level


# ============================================================
# NQF LEVEL DETECTION
# ============================================================

def detect_nqf_level(text):

    match = re.search(
        r"NQF\s+(?:EXIT\s+)?LEVEL\s+(\d+)",
        text,
        re.IGNORECASE
    )

    if match:

        level = match.group(1)

        print(
            "NQF level detected:",
            level
        )

        return level

    return None


# ============================================================
# EXTRACT MARKS
# ============================================================

def extract_marks(text):

    marks = []

    lines = text.splitlines()

    for line in lines:

        original_line = line.strip()

        if not original_line:
            continue

        line_clean = re.sub(
            r"\s+",
            " ",
            original_line
        )

        match = re.search(
            r"\b(4[0-9]|[5-9][0-9]|100)\s+"
            r"PASS\b",
            line_clean,
            re.IGNORECASE
        )

        if match:

            mark = int(
                match.group(1)
            )

            # IMPORTANT:
            # Do not remove duplicate marks.
            # Two different subjects can have the same mark.

            marks.append(
                mark
            )

            print(
                "Mark detected:",
                mark,
                "|",
                line_clean
            )

    print(
        "PASS-based marks found:",
        marks
    )

    return marks


# ============================================================
# FALLBACK MARK EXTRACTION
# ============================================================

def extract_marks_fallback(text):

    marks = []

    lines = text.splitlines()

    for line in lines:

        clean_line = re.sub(
            r"\s+",
            " ",
            line.strip()
        )

        if not clean_line:
            continue

        lower = clean_line.lower()

        ignored_words = [
            "national level",
            "national credit",
            "student number",
            "identity number",
            "qualification id",
            "credit:",
            "nqf",
            "date of birth",
            "year:"
        ]

        if any(
            word in lower
            for word in ignored_words
        ):

            continue

        if "pass" in lower:

            possible_numbers = re.findall(
                r"\b(4[0-9]|[5-9][0-9]|100)\b",
                clean_line
            )

            for number in possible_numbers:

                mark = int(
                    number
                )

                marks.append(
                    mark
                )

                print(
                    "Fallback mark detected:",
                    mark,
                    "|",
                    clean_line
                )

    print(
        "Fallback marks found:",
        marks
    )

    return marks


# ============================================================
# CALCULATE AVERAGE
# ============================================================

def calculate_average(marks):

    if not marks:

        return None

    average = sum(marks) / len(marks)

    average = round(
        average,
        2
    )

    print(
        "Academic average:",
        average
    )

    return average


# ============================================================
# COURSE MATCHING
# ============================================================

def course_matches(
    course,
    bursary_courses
):

    course_lower = course.lower()

    for bursary_course in bursary_courses:

        bursary_course_lower = (
            bursary_course.lower()
        )

        if (
            bursary_course_lower in course_lower
            or course_lower in bursary_course_lower
        ):

            return True, bursary_course

    return False, None


# ============================================================
# STUDY LEVEL MATCHING
# ============================================================

def study_level_matches(
    study_level,
    bursary_levels
):

    level_lower = study_level.lower()

    for bursary_level in bursary_levels:

        bursary_level_lower = (
            bursary_level.lower()
        )

        if (
            bursary_level_lower in level_lower
            or level_lower in bursary_level_lower
        ):

            return True

    return False


# ============================================================
# BURSARY MATCHING
# ============================================================

def find_matching_bursaries(
    course,
    current_study_level,
    target_study_level,
    average
):

    results = []

    for bursary in BURSARIES:

        reasons = []

        # ----------------------------------------------------
        # COURSE
        # ----------------------------------------------------

        course_match, matched_course = course_matches(
            course,
            bursary["courses"]
        )

        if course_match:

            reasons.append(
                f"Your course is related to "
                f"{matched_course}."
            )

        else:

            reasons.append(
                "Your detected course does not "
                "match the listed study fields."
            )

        # ----------------------------------------------------
        # TARGET STUDY LEVEL
        # ----------------------------------------------------

        level_match = study_level_matches(
            target_study_level,
            bursary["study_levels"]
        )

        if level_match:

            reasons.append(
                f"The funding is available for "
                f"{target_study_level} study."
            )

        else:

            reasons.append(
                f"The detected target study level "
                f"({target_study_level}) does not "
                f"match the listed funding level."
            )

        # ----------------------------------------------------
        # AVERAGE
        # ----------------------------------------------------

        average_match = False

        if average is not None:

            if average >= bursary["minimum_average"]:

                average_match = True

                reasons.append(
                    f"Your average of {average}% "
                    f"meets the listed academic "
                    f"minimum of "
                    f"{bursary['minimum_average']}%."
                )

            else:

                reasons.append(
                    f"Your average of {average}% "
                    f"is below the listed academic "
                    f"minimum of "
                    f"{bursary['minimum_average']}%."
                )

        else:

            reasons.append(
                "An academic average could not "
                "be calculated."
            )

        # ----------------------------------------------------
        # POTENTIAL MATCH
        # ----------------------------------------------------

        potential_match = (
            course_match
            and level_match
            and average_match
        )

        # ----------------------------------------------------
        # STATUS
        # ----------------------------------------------------

        if (
            course_match
            and level_match
            and not average_match
        ):

            status = "Below Academic Minimum"

        elif potential_match:

            status = "Potential Match"

        elif course_match:

            status = "Check Eligibility"

        else:

            status = "Not Matched"

        # ----------------------------------------------------
        # RESULT
        # ----------------------------------------------------

        results.append(
            {
                "id": bursary["id"],

                "name": bursary["name"],

                "provider": bursary["provider"],

                "description": bursary["description"],

                "minimum_average": (
                    bursary["minimum_average"]
                ),

                "url": bursary["url"],

                "official_url": bursary["url"],

                "potential_match": potential_match,

                "status": status,

                "reasons": reasons
            }
        )

    return results


# ============================================================
# MAIN ANALYSIS FUNCTION
# ============================================================

def analyse_transcript(
    file,
    filename
):

    print("\n")

    print(
        "=============================================="
    )

    print(
        "EMMY BURSARY & FUNDING ANALYSIS"
    )

    print(
        "=============================================="
    )

    # --------------------------------------------------------
    # EXTRACT TEXT
    # --------------------------------------------------------

    text = extract_transcript_text(
        file,
        filename
    )

    if not text.strip():

        print(
            "ERROR: No text could be extracted."
        )

        return {
            "course": "Unknown",
            "study_level": "Unknown",
            "target_study_level": "Unknown",
            "nqf_level": None,
            "marks_found": 0,
            "average": None,
            "marks": [],
            "bursaries": []
        }

    # --------------------------------------------------------
    # NORMALISE TEXT
    # --------------------------------------------------------

    text = normalise_text(
        text
    )

    print("\n")

    print(
        "=============================================="
    )

    print(
        "EXTRACTED TRANSCRIPT TEXT"
    )

    print(
        "=============================================="
    )

    print(
        text[:6000]
    )

    print("\n")

    print(
        "=============================================="
    )

    print(
        "DETECTING ACADEMIC INFORMATION"
    )

    print(
        "=============================================="
    )

    # --------------------------------------------------------
    # COURSE
    # --------------------------------------------------------

    course = detect_course(
        text
    )

    # --------------------------------------------------------
    # CURRENT STUDY LEVEL
    # --------------------------------------------------------

    study_level = detect_study_level(
        text
    )

    # --------------------------------------------------------
    # NQF
    # --------------------------------------------------------

    nqf_level = detect_nqf_level(
        text
    )

    # --------------------------------------------------------
    # TARGET STUDY LEVEL
    # --------------------------------------------------------

    target_study_level = (
        determine_target_study_level(
            study_level,
            nqf_level
        )
    )

    # --------------------------------------------------------
    # MARKS
    # --------------------------------------------------------

    marks = extract_marks(
        text
    )

    if not marks:

        print(
            "PASS-based extraction found no marks."
        )

        print(
            "Trying fallback mark extraction..."
        )

        marks = extract_marks_fallback(
            text
        )

    # --------------------------------------------------------
    # AVERAGE
    # --------------------------------------------------------

    average = calculate_average(
        marks
    )

    # --------------------------------------------------------
    # BURSARIES
    # --------------------------------------------------------

    bursaries = find_matching_bursaries(
        course,
        study_level,
        target_study_level,
        average
    )

    # --------------------------------------------------------
    # FINAL DEBUG
    # --------------------------------------------------------

    print("\n")

    print(
        "=============================================="
    )

    print(
        "FINAL ANALYSIS"
    )

    print(
        "=============================================="
    )

    print(
        "Course:",
        course
    )

    print(
        "Current Study Level:",
        study_level
    )

    print(
        "Target Study Level:",
        target_study_level
    )

    print(
        "NQF Level:",
        nqf_level
    )

    print(
        "Marks:",
        marks
    )

    print(
        "Number of marks:",
        len(marks)
    )

    print(
        "Average:",
        average
    )

    print(
        "Bursaries returned:",
        len(bursaries)
    )

    print(
        "=============================================="
    )

    # --------------------------------------------------------
    # RETURN RESULT TO FLASK
    # --------------------------------------------------------

    return {
        "course": course,

        "study_level": study_level,

        "target_study_level": target_study_level,

        "nqf_level": nqf_level,

        "marks_found": len(marks),

        "marks": marks,

        "average": average,

        "bursaries": bursaries
    }