"""
=========================================================================
CONFIG.PY - KONFIGURASI BASIS DATA DAN SISTEM KEAMANAN
Lokasi: backend/app/config.py
=========================================================================
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

base_dir = os.path.abspath(os.path.dirname(__file__))
parent_dir = os.path.abspath(os.path.join(base_dir, '..'))
load_dotenv(os.path.join(parent_dir, '.env'))

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'bansos_sidoarjo_secret_key_2026')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'bansos_sidoarjo_jwt_secret_key_2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # 1. Konfigurasi MySQL XAMPP / MariaDB
    mysql_user = os.getenv('DB_USER', 'root')
    mysql_pass = os.getenv('DB_PASSWORD') or os.getenv('DB_PASS', '')
    mysql_host = os.getenv('DB_HOST', '127.0.0.1')
    mysql_port = os.getenv('DB_PORT', '3306')
    mysql_name = os.getenv('DB_NAME', 'bansos_spk')

    if mysql_pass:
        mysql_uri = f"mysql+pymysql://{mysql_user}:{mysql_pass}@{mysql_host}:{mysql_port}/{mysql_name}?charset=utf8mb4"
    else:
        mysql_uri = f"mysql+pymysql://{mysql_user}@{mysql_host}:{mysql_port}/{mysql_name}?charset=utf8mb4"

    # 2. Jalur SQLite Lokal Failover
    sqlite_uri = f"sqlite:///{os.path.join(parent_dir, 'bansos.db')}"

    # Prioritas Jalur Koneksi: ENV -> MySQL -> SQLite
    env_uri = os.getenv('DATABASE_URL') or os.getenv('SQLALCHEMY_DATABASE_URI')
    SQLALCHEMY_DATABASE_URI = env_uri or mysql_uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Direktori Unggahan Berkas
    BASE_DIR = parent_dir
    UPLOAD_FOLDER = os.path.join(parent_dir, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024