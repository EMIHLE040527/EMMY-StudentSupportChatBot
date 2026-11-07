

FROM python:3.11-slim

WORKDIR /app

# Install LibreOffice and Tesseract OCR
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-impress \
    libreoffice-common \
    tesseract-ocr \
    tesseract-ocr-eng \
    fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "gunicorn --capture-output --enable-stdio-inheritance --bind 0.0.0.0:${PORT:-10000} app:app"]
