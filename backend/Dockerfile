
FROM python:3.11-slim

WORKDIR /app

# Install LibreOffice for PowerPoint conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-impress \
    libreoffice-common \
    fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Install backend Python dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Start the Flask backend
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} app:app"]
