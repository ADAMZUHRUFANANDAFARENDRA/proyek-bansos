"""
=========================================================================
CONFIG.PY - KONFIGURASI BASIS DATA ADAPTIF & KEAMANAN SISTEM
Lokasi: backend/app/config.py
Pemerintah Kabupaten Sidoarjo - Dinas Sosial
=========================================================================
"""

import os
import socket
from datetime import timedelta
from dotenv import load_dotenv

base_dir = os.path.abspath(os.path.dirname(__file__))
parent_dir = os.path.abspath(os.path.join(base_dir, '..'))
load_dotenv(os.path.join(parent_dir, '.env'))


def cek_koneksi_mysql(host, port, timeout=1.5):
    """Memeriksa apakah port layanan MySQL XAMPP terbuka."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        res = sock.connect_ex((host, int(port)))
        sock.close()
        return res == 0
    except Exception:
        return False


def tentukan_database_uri():
    """Menentukan URI database dengan prioritas database riil 'bansos' di MySQL."""
    env_uri = os.getenv('DATABASE_URL') or os.getenv('SQLALCHEMY_DATABASE_URI')
    if env_uri and 'bansos' in env_uri:
        return env_uri

    mysql_user = os.getenv('DB_USER', 'root')
    mysql_pass = os.getenv('DB_PASSWORD') or os.getenv('DB_PASS', '')
    mysql_host = os.getenv('DB_HOST', '127.0.0.1')
    mysql_port = os.getenv('DB_PORT', '3306')

    # Prioritas database riil sesuai phpMyAdmin
    mysql_name = os.getenv('DB_NAME', 'bansos')

    sqlite_path = os.path.join(parent_dir, 'bansos.db')
    sqlite_uri = f"sqlite:///{sqlite_path}"

    if cek_koneksi_mysql(mysql_host, mysql_port):
        if mysql_pass:
            return f"mysql+pymysql://{mysql_user}:{mysql_pass}@{mysql_host}:{mysql_port}/{mysql_name}?charset=utf8mb4"
        return f"mysql+pymysql://{mysql_user}@{mysql_host}:{mysql_port}/{mysql_name}?charset=utf8mb4"

    return sqlite_uri


class Config:
    # 1. Kunci Enkripsi & Token JWT
    SECRET_KEY = os.getenv('SECRET_KEY', 'bansos_sidoarjo_secret_key_2026')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'bansos_sidoarjo_jwt_secret_key_2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # 2. Basis Data Utama (MySQL Database 'bansos')
    SQLALCHEMY_DATABASE_URI = tentukan_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 3. Connection Pooling Options
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 1800
    } if "mysql" in SQLALCHEMY_DATABASE_URI else {}

    # 4. Berkas Unggahan Statis
    BASE_DIR = parent_dir
    UPLOAD_FOLDER = os.path.join(parent_dir, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024