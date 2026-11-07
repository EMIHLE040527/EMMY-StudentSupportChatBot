
FROM python:3.11-slim

WORKDIR /app

# Prevent Python output from being buffered
ENV PYTHONUNBUFFERED=1
ENV OMP_THREAD_LIMIT=1

# Install LibreOffice and Tesseract OCR
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-impress \
    libreoffice-common \
    tesseract-ocr \
    tesseract-ocr-eng \
    fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Copy existing Python requirements
COPY requirements.txt .

# Install required Python packages and OCR libraries
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
    pytesseract \
    Pillow \
    PyMuPDF \
    pypdf

# Verify OCR libraries are installed
RUN python -c "import pytesseract, PIL, pymupdf, pypdf; print('OCR Python libraries installed successfully')"

# Verify Tesseract is available
RUN tesseract --version

# Copy application files
COPY . .

# Start the Flask application using Gunicorn
CMD ["sh", "-c", "gunicorn --capture-output --enable-stdio-inheritance --timeout 120 --workers 1 --bind 0.0.0.0:${PORT:-10000} app:app"]
