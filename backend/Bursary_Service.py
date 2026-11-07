
import os
import re

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
    Image = ImageOps = ImageEnhance = None


# ============================================================
# TESSERACT OCR CONFIGURATION
# ============================================================

def configure_tesseract():
    if pytesseract is None:
        return False

    paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for path in paths:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            return True

    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        print("Tesseract OCR is unavailable")
        return False


# ============================================================
# EXISTING BURSARIES
# Application dates and eligibility must be verified.
# ============================================================

BURSARIES = [
    {
        "id": 1,
        "name": "CSIR Bursary Programme",
        "provider": "Council for Scientific and Industrial Research (CSIR)",
        "description": (
            "The CSIR Bursary Programme provides financial support "
            "for qualifying full-time students in priority science, "
            "engineering and technology fields. Honours-level "
            "study areas include selected engineering and technology fields."
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
            "technology",
        ],
        "minimum_average": 65,
        "study_levels": ["honours", "postgraduate"],
        "url": (
            "https://www.csir.co.za/careers/"
            "students-graduates/bursaries/2026-bursary-programme"
        ),
    },
    {
        "id": 2,
        "name": "DSTI-NRF Honours Student Funding",
        "provider": "National Research Foundation (NRF)",
        "description": (
            "DSTI-NRF Honours funding supports eligible students undertaking "
            "Honours studies in Science, Engineering and Technology and other "
            "supported fields. The 2027 call lists a minimum academic "
            "requirement of 65% for major subjects in the final undergraduate year."
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
            "science",
        ],
        "minimum_average": 65,
        "study_levels": ["honours", "postgraduate"],
        "url": (
            "https://www.nrf.ac.za/"
            "announcement-of-call-dsti-nrf-honours-"
            "student-funding-for-the-academic-year-2027/"
        ),
    },
    {
        "id": 3,
        "name": "CSIR-DSTI Inter-Programme Bursary Scheme",
        "provider": "CSIR / Department of Science, Technology and Innovation",
        "description": (
            "The CSIR-DSTI Inter-Programme Bursary Scheme supports "
            "full-time Honours, fourth-year Engineering, Postgraduate Diploma, "
            "Masters and PhD studies at South African public universities "
            "in specified research areas."
        ),
        "courses": [
            "computer engineering",
            "electronic engineering",
            "electrical engineering",
            "engineering",
            "computer science",
            "information technology",
            "technology",
        ],
        "minimum_average": 65,
        "study_levels": ["honours", "postgraduate"],
        "url": (
            "https://www.csir.co.za/careers/"
            "students-graduates/dsi-inter-programme-bursary"
        ),
    },
]


# ============================================================
# NORMAL PDF TEXT EXTRACTION
# ============================================================

def extract_pdf_text(file):
    try:
        file.seek(0)
        reader = PdfReader(file)
        pages = []

        print("PDF pages:", len(reader.pages))

        for number, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
                print(f"PDF page {number}: {len(text)} characters")

                if text.strip():
                    pages.append(text)

            except Exception as error:
                print(
                    "PDF page extraction failed:",
                    type(error).__name__
                )

        extracted = "\n".join(pages)
        print("Normal PDF text length:", len(extracted))
        return extracted

    except Exception as error:
        print(
            "Normal PDF extraction failed:",
            type(error).__name__
        )
        return ""


# ============================================================
# OCR PDF - UPDATED FOR RENDER
# ============================================================

def ocr_pdf(file):
    """
    Read scanned PDF pages using lower-memory OCR on Render.
    """
    if pymupdf is None or pytesseract is None or Image is None:
        print("OCR Python libraries are unavailable", flush=True)
        return ""

    if not configure_tesseract():
        return ""

    pdf = None

    try:
        file.seek(0)
        pdf = pymupdf.open(
            stream=file.read(),
            filetype="pdf"
        )

        pages = []
        print("OCR PDF page count:", len(pdf), flush=True)

        for number, page in enumerate(pdf, start=1):
            try:
                # Reduce image resolution to lower memory usage.
                longest_side = max(
                    page.rect.width,
                    page.rect.height
                )

                zoom = min(
                    1.0,
                    1200 / max(longest_side, 1)
                )

                # Use grayscale to reduce image memory.
                pix = page.get_pixmap(
                    matrix=pymupdf.Matrix(zoom, zoom),
                    colorspace=pymupdf.csGRAY,
                    alpha=False
                )

                img = Image.frombytes(
                    "L",
                    (pix.width, pix.height),
                    pix.samples
                )

                del pix

                # PSM 11 recognises sparse text.
                # Timeout prevents OCR running indefinitely.
                text = pytesseract.image_to_string(
                    img,
                    config="--oem 1 --psm 11",
                    lang="eng",
                    timeout=45
                )

                del img

                print(
                    f"OCR page {number}: {len(text)} characters",
                    flush=True
                )

                if text.strip():
                    pages.append(text)

            except RuntimeError as error:
                print(
                    f"OCR page {number} failed or timed out:",
                    type(error).__name__,
                    flush=True
                )

            except Exception as error:
                print(
                    f"OCR page {number} failed:",
                    type(error).__name__,
                    flush=True
                )

        result = "\n".join(pages)

        print(
            "Total OCR text length:",
            len(result),
            flush=True
        )
        return result

    except Exception as error:
        print(
            "OCR extraction failed:",
            type(error).__name__,
            flush=True
        )
        return ""

    finally:
        if pdf is not None:
            pdf.close()


# ============================================================
# WORD DOCUMENT EXTRACTION
# ============================================================

def extract_docx_text(file):
    try:
        file.seek(0)
        document = Document(file)

        parts = [
            p.text
            for p in document.paragraphs
            if p.text.strip()
        ]

        for table in document.tables:
            for row in table.rows:
                cells = [
                    c.text.strip()
                    for c in row.cells
                    if c.text.strip()
                ]

                if cells:
                    parts.append(" ".join(cells))

        text = "\n".join(parts)

        print("DOCX text length:", len(text))
        return text

    except Exception as error:
        print(
            "DOCX extraction failed:",
            type(error).__name__
        )
        return ""


# ============================================================
# TEXT CLEANING
# ============================================================

def normalise_text(text):
    text = (
        (text or "")
        .replace("\r", "\n")
        .replace("\xa0", " ")
    )
    return re.sub(r"[ \t]+", " ", text)


# ============================================================
# COURSE DETECTION
# ============================================================

def detect_course(text):
    lower = normalise_text(text).lower()

    patterns = [
        (
            "Computer Engineering",
            [
                "computer engineering",
                "bachelor of engineering technology in computer engineering",
                "engineering technology in computer engineering",
                "bengtech computer engineering",
                "beng tech computer engineering",
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
            ["electrical engineering"]
        ),
        (
            "Software Engineering",
            ["software engineering"]
        ),
        (
            "Computer Science",
            ["computer science"]
        ),
        (
            "Information Technology",
            ["information technology"]
        ),
        (
            "Information Systems",
            ["information systems"]
        ),
        (
            "Engineering Technology",
            ["engineering technology"]
        ),
        (
            "Engineering",
            ["engineering"]
        ),
        (
            "Technology",
            ["technology"]
        ),
    ]

    for course, alternatives in patterns:
        if any(pattern in lower for pattern in alternatives):
            return course

    return "Unknown"


# ============================================================
# STUDY LEVEL DETECTION
# ============================================================

def detect_study_level(text):
    lower = text.lower()

    if any(s in lower for s in (
        "honours",
        "honors",
        "beng tech hons",
        "bachelor honours"
    )):
        return "Honours"

    if any(s in lower for s in (
        "postgraduate",
        "master",
        "doctoral",
        "phd"
    )):
        return "Postgraduate"

    if any(s in lower for s in (
        "bachelor",
        "undergraduate",
        "nqf exit level 7",
        "bengtech",
        "beng tech"
    )):
        return "Undergraduate"

    return "Unknown"


# ============================================================
# NQF LEVEL DETECTION
# ============================================================

def detect_nqf_level(text):
    match = re.search(
        r"NQF\s*(?:EXIT\s*)?LEVEL\s*[:\-]?\s*(\d+)",
        text,
        re.I
    )

    return match.group(1) if match else None


# ============================================================
# TARGET STUDY LEVEL
# ============================================================

def determine_target_study_level(study_level, nqf_level):
    if study_level in ("Honours", "Postgraduate"):
        return study_level

    if study_level == "Undergraduate" and str(nqf_level) == "7":
        return "Honours"

    return study_level


# ============================================================
# MARK DETECTION
# ============================================================

def extract_marks(text):
    marks = []

    for line in text.splitlines():
        clean = re.sub(r"\s+", " ", line.strip())

        matches = re.findall(
            r"\b(100|[4-9]\d)\s*%?\s+"
            r"(?:PASS|PASSED)\b",
            clean,
            re.I
        )

        marks.extend(int(m) for m in matches)

    print("PASS-based marks found:", len(marks))
    return marks


# ============================================================
# FALLBACK MARK DETECTION
# ============================================================

def extract_marks_fallback(text):
    marks = []

    ignored_words = (
        "national level",
        "national credit",
        "student number",
        "identity number",
        "qualification id",
        "credit:",
        "nqf",
        "date of birth",
        "year:",
    )

    for line in text.splitlines():
        clean = re.sub(r"\s+", " ", line.strip())
        lower = clean.lower()

        if not clean:
            continue

        if any(word in lower for word in ignored_words):
            continue

        matched = re.findall(
            r"\b(100|[4-9]\d)\s*%?\s+"
            r"(?:PASS|PASSED)\b",
            clean,
            re.I
        )

        if matched:
            marks.extend(int(n) for n in matched)
            continue

        if re.search(
            r"\b(module|subject|result|mark|final)\b",
            lower
        ):
            grades = re.findall(
                r"\b(100|\d{1,2})\s*%",
                clean
            )
            marks.extend(int(n) for n in grades)

    print("Fallback marks found:", len(marks))
    return marks


# ============================================================
# CHECK EXTRACTION QUALITY
# ============================================================

def _academic_score(text):
    """
    Compare ordinary PDF extraction with OCR.
    Do not expose student information in the logs.
    """
    if not text.strip():
        return 0

    marks = extract_marks(text) or extract_marks_fallback(text)

    score = 10 * len(marks)

    if detect_course(text) != "Unknown":
        score += 5

    if detect_study_level(text) != "Unknown":
        score += 3

    if detect_nqf_level(text):
        score += 2

    return score


# ============================================================
# MAIN FILE EXTRACTION
# ============================================================

def extract_transcript_text(file, filename):
    lower = filename.lower().strip()

    print(
        "Starting transcript extraction, type:",
        lower.rsplit(".", 1)[-1]
    )

    if lower.endswith(".pdf"):
        file.seek(0)
        normal = extract_pdf_text(file)

        normal_score = _academic_score(normal)
        print("Normal extraction score:", normal_score)

        normal_marks = (
            extract_marks(normal)
            or extract_marks_fallback(normal)
        )

        # OCR is used when normal extraction misses marks.
        if len(normal.strip()) < 100 or not normal_marks:
            print("Trying OCR for academic marks")
            file.seek(0)

            scanned = ocr_pdf(file)
            scanned_score = _academic_score(scanned)

            print("OCR extraction score:", scanned_score)

            if scanned.strip() and (
                scanned_score > normal_score
                or not normal.strip()
            ):
                return scanned

        return normal

    if lower.endswith(".docx"):
        file.seek(0)
        return extract_docx_text(file)

    print("Unsupported transcript file type")
    return ""


# ============================================================
# CALCULATE AVERAGE
# ============================================================

def calculate_average(marks):
    if not marks:
        return None

    return round(sum(marks) / len(marks), 2)


# ============================================================
# COURSE MATCHING
# ============================================================

def course_matches(course, bursary_courses):
    lower = course.lower()

    for item in bursary_courses:
        item_lower = item.lower()

        if item_lower in lower or lower in item_lower:
            return True, item

    return False, None


# ============================================================
# STUDY LEVEL MATCHING
# ============================================================

def study_level_matches(study_level, bursary_levels):
    lower = study_level.lower()

    return any(
        item.lower() in lower or lower in item.lower()
        for item in bursary_levels
    )


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

        course_match, matched_course = course_matches(
            course,
            bursary["courses"]
        )

        if course_match:
            reasons.append(
                f"Your course is related to {matched_course}."
            )
        else:
            reasons.append(
                "Your detected course does not match "
                "the listed study fields."
            )

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
                f"({target_study_level}) does not match "
                f"the listed funding level."
            )

        average_match = False

        if average is not None:
            if average >= bursary["minimum_average"]:
                average_match = True

                reasons.append(
                    f"Your average of {average}% meets "
                    f"the listed academic minimum of "
                    f"{bursary['minimum_average']}%."
                )
            else:
                reasons.append(
                    f"Your average of {average}% is below "
                    f"the listed academic minimum of "
                    f"{bursary['minimum_average']}%."
                )
        else:
            reasons.append(
                "An academic average could not be calculated."
            )

        potential_match = (
            course_match
            and level_match
            and average_match
        )

        if course_match and level_match and not average_match:
            status = "Below Academic Minimum"
        elif potential_match:
            status = "Potential Match"
        elif course_match:
            status = "Check Eligibility"
        else:
            status = "Not Matched"

        results.append({
            "id": bursary["id"],
            "name": bursary["name"],
            "provider": bursary["provider"],
            "description": bursary["description"],
            "minimum_average": bursary["minimum_average"],
            "url": bursary["url"],
            "official_url": bursary["url"],
            "potential_match": potential_match,
            "status": status,
            "reasons": reasons,
        })

    return results


# ============================================================
# MAIN BURSARY ANALYSIS
# ============================================================

def analyse_transcript(file, filename):
    print("Starting EMMY bursary analysis")

    text = normalise_text(
        extract_transcript_text(file, filename)
    )

    if not text.strip():
        print("No readable transcript text")

        return {
            "course": "Unknown",
            "study_level": "Unknown",
            "target_study_level": "Unknown",
            "nqf_level": None,
            "marks_found": 0,
            "average": None,
            "marks": [],
            "bursaries": [],
        }

    course = detect_course(text)
    study_level = detect_study_level(text)
    nqf_level = detect_nqf_level(text)

    target = determine_target_study_level(
        study_level,
        nqf_level
    )

    marks = extract_marks(text)

    if not marks:
        marks = extract_marks_fallback(text)

    average = calculate_average(marks)

    bursaries = find_matching_bursaries(
        course,
        study_level,
        target,
        average
    )

    # Do not expose private academic data in Render logs.
    print("Course recognition:", course != "Unknown")
    print("Study level recognition:", study_level != "Unknown")
    print("Number of marks:", len(marks))
    print("Bursary entries considered:", len(bursaries))

    return {
        "course": course,
        "study_level": study_level,
        "target_study_level": target,
        "nqf_level": nqf_level,
        "marks_found": len(marks),
        "marks": marks,
        "average": average,
        "bursaries": bursaries,
    }
