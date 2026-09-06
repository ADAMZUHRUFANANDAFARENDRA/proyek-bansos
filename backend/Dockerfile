# =========================================================================
# DOCKERFILE - BACKEND SPK BANSOS PEMKAB SIDOARJO
# Lokasi: backend/Dockerfile
# =========================================================================

FROM python:3.11-slim

LABEL maintainer="Dinas Sosial Kabupaten Sidoarjo"
LABEL description="Container Engine SPK Bansos BWM-SAW Flask & Gunicorn"

# 1. Konfigurasi Environment Variable Sistem & Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=UTF-8 \
    FLASK_APP=app.py \
    FLASK_ENV=production \
    TZ=Asia/Jakarta

WORKDIR /app

# 2. Instalasi Dependensi OS, Compiler, Driver MySQL, Curl, & Multimedia
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    curl \
    pkg-config \
    default-libmysqlclient-dev \
    libffi-dev \
    libssl-dev \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 3. Instalasi Dependensi Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# 4. Salin Seluruh Kode Sumber Aplikasi
COPY . .

# 5. Persiapan Direktori Media Unggahan & Izin Akses
RUN mkdir -p static/uploads && \
    chmod -R 775 static/uploads

# 6. Expose Port Servis Flask
EXPOSE 5000

# 7. Pemantauan Kesehatan Kontainer (Healthcheck)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5000/init-kriteria || curl -f http://localhost:5000/api/init-kriteria || exit 1

# 8. Eksekusi WSGI Server Gunicorn (Multi-Worker, Threading, & Long Timeout)
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]