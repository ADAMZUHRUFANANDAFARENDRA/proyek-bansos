import os

class Config:
    # Kunci Enkripsi Sesi & JWT
    SECRET_KEY = os.getenv("SECRET_KEY", "kunci-rahasia-spk-bansos-sidoarjo-2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-super-secret-bansos-key-sidoarjo")

    # Kredensial Database MySQL (Standar Port 3306 XAMPP / MariaDB)
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASS = os.getenv("DB_PASS", "")
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "bansos_spk")

    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Connection Pooling: Mencegah Error 2003 (HY000) & Socket Timeout
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,   # Validasi keaktifan soket sebelum menjalankan query
        "pool_recycle": 1800,    # Refresh soket MySQL setiap 30 menit
        "pool_size": 15,
        "max_overflow": 25,
        "pool_timeout": 30
    }

    # Direktori dan Batasan Ukuran Upload Berkas (16 MB)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")