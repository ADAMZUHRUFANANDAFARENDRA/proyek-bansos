import os
from datetime import datetime
from app import create_app
from app.extensions import db

# Inisialisasi aplikasi Flask melalui Application Factory
app = create_app()

def init_database():
    """Membuat tabel otomatis ke database jika belum ada."""
    with app.app_context():
        try:
            db.create_all()
            print("[✓] Sinkronisasi tabel database berhasil.")
        except Exception as err:
            print(f"[!] Catatan database: {err}")

if __name__ == "__main__":
    init_database()

    host = os.getenv("FLASK_RUN_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_RUN_PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1")

    print("=" * 65)
    print(" Peladen SPK Bansos Pemkab Sidoarjo Siap Berjalan")
    print(" Arsitektur : Modular Clean Architecture (Factory Pattern)")
    print(f" Waktu Mulai: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f" URL Peladen: http://{host}:{port}")
    print(f" Mode Debug : {'Aktif' if debug_mode else 'Nonaktif'}")
    print("=" * 65)

    app.run(host=host, port=port, debug=debug_mode)