"""
=========================================================================
RUN.PY - ENTRY POINT & ORCHESTRATOR PELADEN UTAMA SPK BANSOS SIDOARJO
Lokasi: backend/run.py
Pemerintah Kabupaten Sidoarjo - Dinas Sosial
Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (Metode BWM-SAW)
Arsitektur: Flask Application Factory + Adaptive Database Failover Engine
=========================================================================
"""

import os
import sys
import time
from datetime import datetime, date
from werkzeug.security import generate_password_hash
from sqlalchemy import create_engine, text
from app import create_app
from app.extensions import db

# Inisialisasi Instance Aplikasi Flask Terpusat
app = create_app()

# =========================================================================
# 1. MASTER 10 KRITERIA STANDAR PEMBOBOTAN BEST WORST METHOD (BWM)
# =========================================================================
DATA_KRITERIA_BWM = [
    ("C1", "Kondisi Ekonomi (Penghasilan)", 0.22, "cost"),
    ("C2", "Estimasi Nilai Aset", 0.16, "cost"),
    ("C3", "Usia Kepala Keluarga", 0.08, "benefit"),
    ("C4", "Jenis Kelamin", 0.05, "benefit"),
    ("C5", "Jumlah Tanggungan Keluarga", 0.14, "benefit"),
    ("C6", "Status Pernikahan", 0.07, "benefit"),
    ("C7", "Kepemilikan Anak Sekolah", 0.10, "benefit"),
    ("C8", "Status Kepemilikan Rumah", 0.08, "benefit"),
    ("C9", "Pendidikan Terakhir", 0.05, "cost"),
    ("C10", "Status Kesehatan / Disabilitas", 0.05, "benefit")
]

# =========================================================================
# 2. MASTER 12 DATA WARGA REPRESENTATIF RESMI KABUPATEN SIDOARJO
# Format: (NIK, Nama, Tempat Lahir, Tgl Lahir, Alamat, No HP, Email,
#          Lat, Lng, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10,
#          is_verified, status_validasi, status_salur, catatan)
# =========================================================================
DATA_AWAL_WARGA_SIDOARJO = [
    (
        "3515011002850001", "SUTRISNO HADI", "Sidoarjo", "1985-02-10",
        "Jl. Raya Waru No. 14, RT 02/RW 01, Kec. Waru", "081234567001", "sutrisno@mail.com",
        "-7.3524", "112.7245", 950000.0, 2500000.0, 54, 1, 4, 2, 2, 3, 1, 2, 1,
        True, "Disetujui", "Belum Salur", "Keluarga rentan prasejahtera"
    ),
    (
        "3515022507900002", "SITI AMINAH", "Sidoarjo", "1983-02-01",
        "Dusun Badas, RT 04/RW 02, Barengkrajan, Kec. Krian", "081234567002", "siti@mail.com",
        "-7.4082", "112.5831", 800000.0, 1500000.0, 48, 2, 3, 3, 2, 3, 1, 1, 1,
        True, "Disetujui", "Telah Menerima", "Lansia tunggal tanggungan anak"
    ),
    (
        "3515031505880003", "BAMBANG PAMUNGKAS", "Sidoarjo", "1988-05-15",
        "Desa Cemandi, RT 08/RW 03, Kec. Sedati", "081234567003", "bambang@mail.com",
        "-7.3821", "112.7756", 1100000.0, 3200000.0, 42, 1, 5, 2, 3, 2, 2, 1, 1,
        True, "Disetujui", "Belum Salur", "Pekerja serabutan pesisir"
    ),
    (
        "3515040909770004", "RUDI HERMAWAN", "Sidoarjo", "1977-09-09",
        "Jl. Gajah Mada No. 45, RT 01/RW 05, Kec. Sidoarjo", "081234567004", "rudi@mail.com",
        "-7.4478", "112.7183", 1300000.0, 4000000.0, 49, 1, 3, 2, 1, 2, 2, 1, 1,
        True, "Disetujui", "Telah Menerima", "Buruh pabrik harian lepas"
    ),
    (
        "3515051812830005", "KARTINI WULANDARI", "Sidoarjo", "1983-12-18",
        "Desa Kebonagung, RT 03/RW 01, Kec. Porong", "081234567005", "kartini@mail.com",
        "-7.5451", "112.6987", 700000.0, 1200000.0, 58, 2, 2, 3, 0, 3, 1, 2, 1,
        True, "Disetujui", "Telah Menerima", "Warga terdampak tanggul"
    ),
    (
        "3515060403920006", "ACHMAD FAUZI", "Sidoarjo", "1992-03-04",
        "Kelurahan Geluran, RT 05/RW 02, Kec. Taman", "081234567006", "fauzi@mail.com",
        "-7.3621", "112.6954", 1400000.0, 4500000.0, 39, 1, 4, 2, 2, 2, 3, 1, 0,
        False, "Menunggu", "Belum Salur", "Pekerja sektor informal"
    ),
    (
        "3515072010860007", "ENDANG SUNARMI", "Sidoarjo", "1986-10-20",
        "Desa Sepande, RT 02/RW 04, Kec. Candi", "081234567007", "endang@mail.com",
        "-7.4721", "112.7142", 850000.0, 2000000.0, 51, 2, 3, 3, 1, 3, 1, 1, 1,
        True, "Disetujui", "Belum Salur", "Pedagang keliling skala mikro"
    ),
    (
        "3515081111810008", "JOKO PRASETYO", "Sidoarjo", "1981-11-11",
        "Desa Pekarungan, RT 06/RW 02, Kec. Sukodono", "081234567008", "joko@mail.com",
        "-7.4112", "112.6789", 1250000.0, 3800000.0, 44, 1, 4, 2, 2, 2, 2, 1, 0,
        False, "Menunggu", "Belum Salur", "Keluarga anak usia sekolah"
    ),
    (
        "3515090101750009", "SUHARTONO", "Sidoarjo", "1975-01-01",
        "Desa Kalitengah, RT 03/RW 03, Kec. Tanggulangin", "081234567009", "suhartono@mail.com",
        "-7.5089", "112.7121", 900000.0, 2200000.0, 56, 1, 3, 2, 1, 3, 1, 2, 1,
        True, "Disetujui", "Telah Menerima", "Pengrajin rumahan musiman"
    ),
    (
        "3515101408890010", "NURUL HIDAYATI", "Sidoarjo", "1989-08-14",
        "Desa Kraton, RT 02/RW 01, Kec. Krian", "081234567010", "nurul@mail.com",
        "-7.3995", "112.5921", 750000.0, 1800000.0, 47, 2, 4, 3, 3, 3, 1, 1, 1,
        True, "Disetujui", "Laporan Sengketa", "Bansos sembako belum diterima padahal status layak."
    ),
    (
        "3515112204930011", "ARIF BUDIMAN", "Sidoarjo", "1993-04-22",
        "Desa Tambaksumur, RT 05/RW 02, Kec. Waru", "081234567011", "arif@mail.com",
        "-7.3456", "112.7612", 1500000.0, 5200000.0, 36, 1, 2, 2, 1, 2, 3, 1, 0,
        False, "Menunggu", "Belum Salur", "Verifikasi mandiri bansos"
    ),
    (
        "3515121606820012", "SRI WAHYUNI", "Sidoarjo", "1982-06-16",
        "Desa Urangagung, RT 04/RW 03, Kec. Sidoarjo", "081234567012", "sri@mail.com",
        "-7.4567", "112.6934", 820000.0, 1900000.0, 52, 2, 3, 2, 1, 3, 1, 2, 1,
        True, "Disetujui", "Telah Menerima", "Keluarga rentan penyakit kronis"
    )
]


# =========================================================================
# 3. MESIN INISIALISASI & FAILOVER BASIS DATA OTOMATIS
# =========================================================================
def inisialisasi_database_cerdas():
    """
    Melakukan verifikasi koneksi basis data utama (MySQL),
    membuat skema basis data jika belum tersedia, mengalihkan secara cerdas
    ke SQLite lokal jika MySQL padam, dan memastikan data master terisi penuh.
    """
    with app.app_context():
        # 1. Pastikan Skema Basis Data MySQL Ada (Jika URI Menggunakan MySQL)
        current_uri = str(app.config.get('SQLALCHEMY_DATABASE_URI', ''))
        if 'mysql' in current_uri:
            try:
                db_name = current_uri.split('/')[-1].split('?')[0]
                base_server_uri = current_uri.rsplit('/', 1)[0]
                temp_engine = create_engine(base_server_uri)
                with temp_engine.connect() as conn:
                    conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
                    conn.commit()
                temp_engine.dispose()
                print(f"[✓] Skema basis data MySQL '{db_name}' terverifikasi siap.")
            except Exception as err_mysql:
                print(f"[i] Info verifikasi database MySQL: {err_mysql}")

        # 2. Uji Eksekusi Koneksi & Failover ke SQLite Lokal Jika Terkendala
        try:
            db.create_all()
            db.session.execute(text("SELECT 1")).scalar()
            print("[✓] Struktur tabel basis data siap dan terhubung.")
        except Exception as err_conn:
            print(f"[!] Sambungan ke MySQL bermasalah ({err_conn}).")
            print("[i] Mengaktifkan failover: Beralih ke SQLite lokal (bansos.db)...")

            parent_dir = os.path.abspath(os.path.dirname(__file__))
            sqlite_path = os.path.join(parent_dir, 'bansos.db')
            app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{sqlite_path}"

            db.engine.dispose()
            db.create_all()
            print(f"[✓] Mesin failover aktif terhubung ke: {sqlite_path}")

        # 3. Inisialisasi Struktur Tabel 10 Kriteria BWM
        try:
            is_mysql = 'mysql' in str(app.config.get('SQLALCHEMY_DATABASE_URI', ''))
            if is_mysql:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS kriteria (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        kode VARCHAR(10) NOT NULL UNIQUE,
                        nama VARCHAR(150) NOT NULL,
                        bobot DOUBLE DEFAULT 0.1,
                        tipe VARCHAR(20) DEFAULT 'benefit'
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
            else:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS kriteria (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kode VARCHAR(10) NOT NULL UNIQUE,
                        nama VARCHAR(150) NOT NULL,
                        bobot DOUBLE DEFAULT 0.1,
                        tipe VARCHAR(20) DEFAULT 'benefit'
                    );
                """))
            db.session.commit()

            cek_k = db.session.execute(text("SELECT COUNT(*) FROM kriteria")).scalar()
            if cek_k == 0:
                for k in DATA_KRITERIA_BWM:
                    db.session.execute(text("""
                        INSERT INTO kriteria (kode, nama, bobot, tipe)
                        VALUES (:kode, :nama, :bobot, :tipe)
                    """), {"kode": k[0], "nama": k[1], "bobot": k[2], "tipe": k[3]})
                db.session.commit()
                print("[✓] Vektor bobot 10 kriteria BWM berhasil disinkronkan.")
        except Exception as err_k:
            db.session.rollback()
            print(f"[!] Catatan inisialisasi kriteria: {err_k}")

        # 4. Pastikan Akun Administrator & Petugas Tersedia
        try:
            from app.models.user import User

            if User.query.count() == 0:
                admin_user = User(
                    username="admin",
                    password_hash=generate_password_hash("admin"),
                    role="admin"
                )
                if hasattr(admin_user, 'nama_lengkap'):
                    admin_user.nama_lengkap = "Administrator Utama"
                if hasattr(admin_user, 'email'):
                    admin_user.email = "admin@sidoarjo.go.id"
                if hasattr(admin_user, 'is_active'):
                    admin_user.is_active = True

                petugas_user = User(
                    username="petugas",
                    password_hash=generate_password_hash("123"),
                    role="operator"
                )
                if hasattr(petugas_user, 'nama_lengkap'):
                    petugas_user.nama_lengkap = "Petugas Lapangan Dinsos"
                if hasattr(petugas_user, 'email'):
                    petugas_user.email = "petugas@sidoarjo.go.id"
                if hasattr(petugas_user, 'is_active'):
                    petugas_user.is_active = True

                db.session.add_all([admin_user, petugas_user])
                db.session.commit()
                print("[✓] Akun default (admin/admin & petugas/123) berhasil dibuat.")
        except Exception as err_u:
            db.session.rollback()
            print(f"[!] Catatan inisialisasi akun: {err_u}")

        # 5. Pastikan Data Master 12 Warga Sidoarjo Terisi & Terhitung SAW
        try:
            from app.models.warga import Warga
            from app.routes.warga_routes import hitung_dan_sinkronkan_saw_bwm

            if Warga.query.count() == 0:
                for r in DATA_AWAL_WARGA_SIDOARJO:
                    tgl = None
                    if r[3]:
                        try:
                            tgl = datetime.strptime(str(r[3])[:10], '%Y-%m-%d').date()
                        except ValueError:
                            tgl = None
                    w = Warga(
                        nik=r[0], nama=r[1], tempat_lahir=r[2], tanggal_lahir=tgl, alamat=r[4],
                        no_hp=r[5], email=r[6], lat=r[7], lng=r[8],
                        c1=r[9], c2=r[10], c3=r[11], c4=r[12], c5=r[13],
                        c6=r[14], c7=r[15], c8=r[16], c9=r[17], c10=r[18],
                        is_verified=r[19] if isinstance(r[19], bool) else (r[19] == "Disetujui"),
                        status_validasi=r[20], status_salur=r[21], catatan=r[22]
                    )
                    db.session.add(w)

                db.session.commit()
                hitung_dan_sinkronkan_saw_bwm()
                print(f"[✓] Data master {len(DATA_AWAL_WARGA_SIDOARJO)} warga Sidoarjo berhasil diisi.")
        except Exception as err_w:
            db.session.rollback()
            print(f"[!] Catatan inisialisasi data warga: {err_w}")

        # 6. Pastikan Tabel dan Data Laporan Pengaduan Sengketa Tersedia
        try:
            from app.models.pengaduan import Pengaduan

            is_mysql = 'mysql' in str(app.config.get('SQLALCHEMY_DATABASE_URI', ''))
            if is_mysql:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS pengaduan (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        warga_id INT NULL,
                        nik VARCHAR(20) NULL,
                        nama VARCHAR(150) NULL,
                        kategori VARCHAR(100) DEFAULT 'Sengketa Penyaluran Bansos',
                        deskripsi TEXT NULL,
                        status VARCHAR(50) DEFAULT 'Tahap Mediasi',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """))
            else:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS pengaduan (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        warga_id INTEGER NULL,
                        nik VARCHAR(20) NULL,
                        nama VARCHAR(150) NULL,
                        kategori VARCHAR(100) DEFAULT 'Sengketa Penyaluran Bansos',
                        deskripsi TEXT NULL,
                        status VARCHAR(50) DEFAULT 'Tahap Mediasi',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
            db.session.commit()

            if Pengaduan.query.count() == 0:
                p1 = Pengaduan(
                    warga_id=10,
                    kategori="Sengketa Penyaluran Bansos",
                    deskripsi="Bansos sembako belum diterima padahal status verifikasi dinyatakan layak pada desil 1.",
                    status="Tahap Mediasi"
                )
                if hasattr(p1, 'nik'):
                    p1.nik = "3515101408890010"
                if hasattr(p1, 'nama'):
                    p1.nama = "NURUL HIDAYATI"
                db.session.add(p1)
                db.session.commit()
                print("[✓] Data awal investigasi sengketa warga siap.")
        except Exception as err_p:
            db.session.rollback()
            print(f"[!] Catatan inisialisasi laporan sengketa: {err_p}")

        # 7. Pastikan Tabel Cadangan Master (warga_backup) Tersedia
        try:
            from app.routes.warga_routes import ensure_backup_table
            ensure_backup_table()
        except Exception:
            pass


def init_database():
    """Fungsi pembungkus resmi agar impor 'from run import init_database' berjalan lancar."""
    inisialisasi_database_cerdas()


# =========================================================================
# 4. TITIK JALAN SERVER (ENTRY POINT)
# =========================================================================
if __name__ == "__main__":
    init_database()

    host = os.getenv("FLASK_RUN_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_RUN_PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1")

    print("=" * 70)
    print(" SISTEM PENDUKUNG KEPUTUSAN PENERIMA BANTUAN SOSIAL PEMKAB SIDOARJO")
    print(" Status Server : Berjalan Aktif")
    print(f" URL Akses     : http://{host}:{port}")
    print(f" Basis Data    : {app.config.get('SQLALCHEMY_DATABASE_URI')}")
    print(f" Mode Debug    : {'Aktif' if debug_mode else 'Nonaktif'}")
    print("=" * 70)

    app.run(host=host, port=port, debug=debug_mode)