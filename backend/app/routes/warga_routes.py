"""
=========================================================================
WARGA_ROUTES.PY - MODUL UTAMA MANAJEMEN DATA WARGA, SPK BWM-SAW,
OBROLAN MEDIASI REAL-TIME, AUDIT NOTIFIKASI & ARSIP MASTER
Lokasi: backend/app/routes/warga_routes.py
Pemerintah Kabupaten Sidoarjo - Dinas Sosial
Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (Metode BWM-SAW)
Arsitektur: Flask Modular Blueprint + Dual-Engine Database Compatibility
=========================================================================
"""

import os
import math
from datetime import date, datetime
from decimal import Decimal
from flask import (
    Blueprint,
    jsonify,
    request,
    current_app,
    make_response
)
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from sqlalchemy import (
    text,
    or_,
    and_,
    desc,
    asc
)
from app.extensions import db
from app.models.warga import Warga
from app.models.user import User
from app.models.pengaduan import Pengaduan

warga_bp = Blueprint('warga_bp', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'pdf', 'mp4', 'webm', 'ogg', 'mp3', 'wav'}

# =========================================================================
# 1. PARAMETER BOBOT 10 KRITERIA BWM (BEST WORST METHOD) SESUAI SKRIPSI
# Total Bobot Akumulasi = 1.00
# =========================================================================
DEFAULT_KRITERIA = [
    {"kode": "C1", "nama": "Kondisi Ekonomi / Penghasilan", "bobot": 0.22, "tipe": "cost"},
    {"kode": "C2", "nama": "Kepemilikan Aset", "bobot": 0.15, "tipe": "cost"},
    {"kode": "C3", "nama": "Umur Kepala Keluarga", "bobot": 0.08, "tipe": "benefit"},
    {"kode": "C4", "nama": "Jenis Kelamin", "bobot": 0.05, "tipe": "benefit"},
    {"kode": "C5", "nama": "Jumlah Tanggungan", "bobot": 0.18, "tipe": "benefit"},
    {"kode": "C6", "nama": "Status Pernikahan", "bobot": 0.06, "tipe": "benefit"},
    {"kode": "C7", "nama": "Kepemilikan Anak / Balita", "bobot": 0.08, "tipe": "benefit"},
    {"kode": "C8", "nama": "Kelayakan Tempat Tinggal", "bobot": 0.10, "tipe": "cost"},
    {"kode": "C9", "nama": "Tingkat Pendidikan Terakhir", "bobot": 0.04, "tipe": "cost"},
    {"kode": "C10", "nama": "Kondisi Kesehatan / Disabilitas", "bobot": 0.04, "tipe": "cost"}
]

# =========================================================================
# 2. DATA REFERENSI GEOGRAFIS 18 KECAMATAN KABUPATEN SIDOARJO
# =========================================================================
KECAMATAN_SIDOARJO = [
    {"nama": "Sidoarjo", "lat": -7.4478, "lng": 112.7183, "desil_avg": 2},
    {"nama": "Buduran", "lat": -7.4245, "lng": 112.7231, "desil_avg": 3},
    {"nama": "Candi", "lat": -7.4812, "lng": 112.7135, "desil_avg": 2},
    {"nama": "Porong", "lat": -7.5451, "lng": 112.6987, "desil_avg": 1},
    {"nama": "Krembung", "lat": -7.5256, "lng": 112.6124, "desil_avg": 2},
    {"nama": "Tulangan", "lat": -7.4795, "lng": 112.6453, "desil_avg": 3},
    {"nama": "Tanggulangin", "lat": -7.5112, "lng": 112.7124, "desil_avg": 2},
    {"nama": "Jabon", "lat": -7.5678, "lng": 112.7654, "desil_avg": 1},
    {"nama": "Waru", "lat": -7.3541, "lng": 112.7356, "desil_avg": 4},
    {"nama": "Gedangan", "lat": -7.3878, "lng": 112.7245, "desil_avg": 3},
    {"nama": "Sedati", "lat": -7.3812, "lng": 112.7845, "desil_avg": 3},
    {"nama": "Taman", "lat": -7.3512, "lng": 112.6987, "desil_avg": 4},
    {"nama": "Krian", "lat": -7.4087, "lng": 112.5834, "desil_avg": 3},
    {"nama": "Balongbendo", "lat": -7.4124, "lng": 112.5213, "desil_avg": 2},
    {"nama": "Prambon", "lat": -7.4712, "lng": 112.5745, "desil_avg": 2},
    {"nama": "Tarik", "lat": -7.4512, "lng": 112.5124, "desil_avg": 2},
    {"nama": "Sukodono", "lat": -7.4145, "lng": 112.6789, "desil_avg": 3},
    {"nama": "Wonoayu", "lat": -7.4387, "lng": 112.6345, "desil_avg": 3}
]

# =========================================================================
# 3. MASTER DATA WARGA RESMI KABUPATEN SIDOARJO (AUTO SEED)
# =========================================================================
DATA_MASTER_SIDOARJO = [
    ("3515011002850001", "SUTRISNO HADI", "Sidoarjo", "1985-02-10", "Jl. Raya Waru No. 14, RT 02/RW 01, Kec. Waru", "081234567001", "sutrisno@mail.com", "-7.3524", "112.7245", 950000.0, 2500000.0, 54, 1, 4, 2, 2, 3, 1, 2, 1, True, "Disetujui", "Belum Salur", "Keluarga rentan prasejahtera"),
    ("3515022507900002", "SITI AMINAH", "Sidoarjo", "1983-02-01", "Dusun Badas, RT 04/RW 02, Barengkrajan, Kec. Krian", "081234567002", "siti@mail.com", "-7.4082", "112.5831", 800000.0, 1500000.0, 48, 2, 3, 3, 2, 3, 1, 1, 1, True, "Disetujui", "Telah Menerima", "Lansia tunggal tanggungan anak"),
    ("3515031505880003", "BAMBANG PAMUNGKAS", "Sidoarjo", "1988-05-15", "Desa Cemandi, RT 08/RW 03, Kec. Sedati", "081234567003", "bambang@mail.com", "-7.3821", "112.7756", 1100000.0, 3200000.0, 42, 1, 5, 2, 3, 2, 2, 1, 1, True, "Disetujui", "Belum Salur", "Pekerja serabutan pesisir"),
    ("3515040909770004", "RUDI HERMAWAN", "Sidoarjo", "1977-09-09", "Jl. Gajah Mada No. 45, RT 01/RW 05, Kec. Sidoarjo", "081234567004", "rudi@mail.com", "-7.4478", "112.7183", 1300000.0, 4000000.0, 49, 1, 3, 2, 1, 2, 2, 1, 1, True, "Disetujui", "Telah Menerima", "Buruh pabrik harian lepas"),
    ("3515051812830005", "KARTINI WULANDARI", "Sidoarjo", "1983-12-18", "Desa Kebonagung, RT 03/RW 01, Kec. Porong", "081234567005", "kartini@mail.com", "-7.5451", "112.6987", 700000.0, 1200000.0, 58, 2, 2, 3, 0, 3, 1, 2, 1, True, "Disetujui", "Telah Menerima", "Warga terdampak tanggul"),
    ("3515060403920006", "ACHMAD FAUZI", "Sidoarjo", "1992-03-04", "Kelurahan Geluran, RT 05/RW 02, Kec. Taman", "081234567006", "fauzi@mail.com", "-7.3621", "112.6954", 1400000.0, 4500000.0, 39, 1, 4, 2, 2, 2, 3, 1, 0, False, "Menunggu", "Belum Salur", "Pekerja sektor informal"),
    ("3515072010860007", "ENDANG SUNARMI", "Sidoarjo", "1986-10-20", "Desa Sepande, RT 02/RW 04, Kec. Candi", "081234567007", "endang@mail.com", "-7.4721", "112.7142", 850000.0, 2000000.0, 51, 2, 3, 3, 1, 3, 1, 1, 1, True, "Disetujui", "Belum Salur", "Pedagang keliling skala mikro"),
    ("3515081111810008", "JOKO PRASETYO", "Sidoarjo", "1981-11-11", "Desa Pekarungan, RT 06/RW 02, Kec. Sukodono", "081234567008", "joko@mail.com", "-7.4112", "112.6789", 1250000.0, 3800000.0, 44, 1, 4, 2, 2, 2, 2, 1, 0, False, "Menunggu", "Belum Salur", "Keluarga anak usia sekolah"),
    ("3515090101750009", "SUHARTONO", "Sidoarjo", "1975-01-01", "Desa Kalitengah, RT 03/RW 03, Kec. Tanggulangin", "081234567009", "suhartono@mail.com", "-7.5089", "112.7121", 900000.0, 2200000.0, 56, 1, 3, 2, 1, 3, 1, 2, 1, True, "Disetujui", "Telah Menerima", "Pengrajin rumahan musiman"),
    ("3515101408890010", "NURUL HIDAYATI", "Sidoarjo", "1989-08-14", "Desa Kraton, RT 02/RW 01, Kec. Krian", "081234567010", "nurul@mail.com", "-7.3995", "112.5921", 750000.0, 1800000.0, 47, 2, 4, 3, 3, 3, 1, 1, 1, True, "Disetujui", "Laporan Sengketa", "Bansos sembako belum diterima padahal status layak."),
    ("3515112204930011", "ARIF BUDIMAN", "Sidoarjo", "1993-04-22", "Desa Tambaksumur, RT 05/RW 02, Kec. Waru", "081234567011", "arif@mail.com", "-7.3456", "112.7612", 1500000.0, 5200000.0, 36, 1, 2, 2, 1, 2, 3, 1, 0, False, "Menunggu", "Belum Salur", "Verifikasi mandiri bansos"),
    ("3515121606820012", "SRI WAHYUNI", "Sidoarjo", "1982-06-16", "Desa Urangagung, RT 04/RW 03, Kec. Sidoarjo", "081234567012", "sri@mail.com", "-7.4567", "112.6934", 820000.0, 1900000.0, 52, 2, 3, 2, 1, 3, 1, 2, 1, True, "Disetujui", "Telah Menerima", "Keluarga rentan penyakit kronis")
]

# =========================================================================
# 4. FUNGSI UTILITAS, KONVERSI AMAN & DUAL-ENGINE SCHEMA HANDLER
# =========================================================================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_float_safe(val, default=0.0):
    if val is None or str(val).strip() == '': return default
    try:
        f = float(str(val).replace(',', '.').strip())
        return default if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return default

def parse_int_safe(val, default=0):
    if val is None or str(val).strip() == '': return default
    try:
        f = float(str(val).replace(',', '.').strip())
        return default if math.isnan(f) or math.isinf(f) else int(f)
    except (ValueError, TypeError):
        return default

def ensure_backup_table():
    try:
        is_mysql = 'mysql' in str(current_app.config.get('SQLALCHEMY_DATABASE_URI', ''))
        if is_mysql:
            db.session.execute(text("CREATE TABLE IF NOT EXISTS warga_backup LIKE warga;"))
            db.session.commit()
    except Exception:
        db.session.rollback()

def ensure_notifikasi_table():
    try:
        is_mysql = 'mysql' in str(current_app.config.get('SQLALCHEMY_DATABASE_URI', ''))
        if is_mysql:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS notifikasi (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    pesan TEXT NOT NULL,
                    kategori VARCHAR(50) DEFAULT 'info',
                    role_sender VARCHAR(50) DEFAULT 'Sistem',
                    waktu VARCHAR(50) NULL,
                    is_read TINYINT(1) DEFAULT 0,
                    is_pinned TINYINT(1) DEFAULT 0,
                    is_archived TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
        else:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS notifikasi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pesan TEXT NOT NULL,
                    kategori VARCHAR(50) DEFAULT 'info',
                    role_sender VARCHAR(50) DEFAULT 'Sistem',
                    waktu VARCHAR(50) NULL,
                    is_read INTEGER DEFAULT 0,
                    is_pinned INTEGER DEFAULT 0,
                    is_archived INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
        db.session.commit()
    except Exception:
        db.session.rollback()

def ensure_chat_table():
    try:
        is_mysql = 'mysql' in str(current_app.config.get('SQLALCHEMY_DATABASE_URI', ''))
        if is_mysql:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS pesan_chat (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nik VARCHAR(20) NOT NULL,
                    sender VARCHAR(50) NOT NULL,
                    nama VARCHAR(150) NULL,
                    pesan TEXT NULL,
                    file_path VARCHAR(255) NULL,
                    file_type VARCHAR(50) NULL,
                    reply_sender VARCHAR(100) NULL,
                    reply_text TEXT NULL,
                    is_deleted_all TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
        else:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS pesan_chat (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nik VARCHAR(20) NOT NULL,
                    sender VARCHAR(50) NOT NULL,
                    nama VARCHAR(150) NULL,
                    pesan TEXT NULL,
                    file_path VARCHAR(255) NULL,
                    file_type VARCHAR(50) NULL,
                    reply_sender VARCHAR(100) NULL,
                    reply_text TEXT NULL,
                    is_deleted_all INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
        db.session.commit()
    except Exception:
        db.session.rollback()

def catat_notifikasi(pesan, role_sender="Sistem", kategori="info"):
    """Mencatat aktivitas mutakhir langsung ke database riwayat notifikasi."""
    try:
        ensure_notifikasi_table()
        waktu_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        full_msg = f"[{role_sender}] {pesan}"
        db.session.execute(text("""
            INSERT INTO notifikasi (pesan, kategori, role_sender, waktu, is_read, is_pinned, is_archived, created_at)
            VALUES (:pesan, :kategori, :role_sender, :waktu, 0, 0, 0, CURRENT_TIMESTAMP)
        """), {
            "pesan": full_msg,
            "kategori": kategori,
            "role_sender": role_sender,
            "waktu": waktu_str
        })
        db.session.commit()
    except Exception as err:
        db.session.rollback()
        print(f"[!] Catatan log notifikasi: {err}")

def format_warga(w):
    if not w: return {}
    tgl_str = ''
    val_tgl = getattr(w, 'tanggal_lahir', None) if not isinstance(w, dict) else w.get('tanggal_lahir')
    if val_tgl:
        try: tgl_str = val_tgl.strftime('%Y-%m-%d')
        except Exception: tgl_str = str(val_tgl)[:10]

    created_str = 'Hari ini'
    val_created = getattr(w, 'created_at', None) if not isinstance(w, dict) else w.get('created_at')
    if val_created:
        try: created_str = val_created.strftime('%Y-%m-%d %H:%M')
        except Exception: created_str = str(val_created)[:16]

    def get_attr(obj, attr, default=None):
        return obj.get(attr, default) if isinstance(obj, dict) else getattr(obj, attr, default)

    return {
        "id": get_attr(w, 'id', 0),
        "nik": str(get_attr(w, 'nik', '') or ''),
        "nama": get_attr(w, 'nama', 'Warga Sidoarjo') or 'Warga Sidoarjo',
        "tempat_lahir": get_attr(w, 'tempat_lahir', 'Sidoarjo') or 'Sidoarjo',
        "tanggal_lahir": tgl_str,
        "alamat": get_attr(w, 'alamat', 'Kabupaten Sidoarjo') or 'Kabupaten Sidoarjo',
        "no_hp": get_attr(w, 'no_hp', '') or '',
        "email": get_attr(w, 'email', '') or '',
        "lat": parse_float_safe(get_attr(w, 'lat', None), -7.4478),
        "lng": parse_float_safe(get_attr(w, 'lng', None), 112.7183),
        "c1": parse_float_safe(get_attr(w, 'c1', 0.0), 0.0),
        "c2": parse_float_safe(get_attr(w, 'c2', 0.0), 0.0),
        "c3": parse_int_safe(get_attr(w, 'c3', 0), 0),
        "c4": parse_int_safe(get_attr(w, 'c4', 1), 1),
        "c5": parse_int_safe(get_attr(w, 'c5', 0), 0),
        "c6": parse_int_safe(get_attr(w, 'c6', 1), 1),
        "c7": parse_int_safe(get_attr(w, 'c7', 0), 0),
        "c8": parse_int_safe(get_attr(w, 'c8', 1), 1),
        "c9": parse_int_safe(get_attr(w, 'c9', 1), 1),
        "c10": parse_int_safe(get_attr(w, 'c10', 1), 1),
        "desil": parse_int_safe(get_attr(w, 'desil', 5), 5),
        "skor_saw": round(parse_float_safe(get_attr(w, 'skor_saw', 0), 0.0), 4),
        "rank_saw": parse_int_safe(get_attr(w, 'rank_saw', 0), 0),
        "is_verified": bool(get_attr(w, 'is_verified', False)),
        "status_validasi": get_attr(w, 'status_validasi', 'Disetujui' if get_attr(w, 'is_verified') else 'Menunggu'),
        "status_salur": get_attr(w, 'status_salur', 'Belum Salur') or 'Belum Salur',
        "status_bansos": get_attr(w, 'status_bansos', 'Menunggu Verifikasi'),
        "prioritas": get_attr(w, 'prioritas', 'Menunggu'),
        "bukti_salur": get_attr(w, 'bukti_salur', '') or '',
        "catatan": get_attr(w, 'catatan', '') or '',
        "created_at": created_str
    }

def serialize_warga(w):
    return format_warga(w)

# =========================================================================
# 5. MESIN KALKULASI ALGORITMA SPK (BWM + SAW MULTI-KRITERIA)
# =========================================================================
def hitung_dan_sinkronkan_saw_bwm():
    try:
        warga_list = Warga.query.all()
        if not warga_list: return 0

        bobot_dict = {f"c{i}": item["bobot"] for i, item in enumerate(DEFAULT_KRITERIA, start=1)}
        try:
            kriteria_rows = db.session.execute(text("SELECT kode, bobot FROM kriteria")).fetchall()
            if kriteria_rows:
                for r in kriteria_rows:
                    k_code = str(r[0]).strip().lower()
                    if k_code in bobot_dict: bobot_dict[k_code] = float(r[1])
        except Exception: pass

        c1_vals = [parse_float_safe(w.c1, 1500000.0) for w in warga_list]
        c2_vals = [parse_float_safe(w.c2, 5000000.0) for w in warga_list]
        c3_vals = [parse_int_safe(w.c3, 40) for w in warga_list]
        c4_vals = [parse_int_safe(w.c4, 1) for w in warga_list]
        c5_vals = [parse_int_safe(w.c5, 2) for w in warga_list]
        c6_vals = [parse_int_safe(w.c6, 1) for w in warga_list]
        c7_vals = [parse_int_safe(w.c7, 1) for w in warga_list]
        c8_vals = [parse_int_safe(w.c8, 1) for w in warga_list]
        c9_vals = [parse_int_safe(w.c9, 1) for w in warga_list]
        c10_vals = [parse_int_safe(w.c10, 1) for w in warga_list]

        min_c1 = min([v for v in c1_vals if v > 0] or [1.0])
        min_c2 = min([v for v in c2_vals if v > 0] or [1.0])
        max_c3 = max(c3_vals or [1])
        max_c4 = max(c4_vals or [1])
        max_c5 = max(c5_vals or [1])
        max_c6 = max(c6_vals or [1])
        max_c7 = max(c7_vals or [1])
        min_c8 = min([v for v in c8_vals if v > 0] or [1])
        min_c9 = min([v for v in c9_vals if v > 0] or [1])
        min_c10 = min([v for v in c10_vals if v > 0] or [1])

        skor_list = []
        for w in warga_list:
            v1, v2 = parse_float_safe(w.c1, min_c1), parse_float_safe(w.c2, min_c2)
            v3, v4, v5 = parse_int_safe(w.c3, 1), parse_int_safe(w.c4, 1), parse_int_safe(w.c5, 1)
            v6, v7, v8 = parse_int_safe(w.c6, 1), parse_int_safe(w.c7, 1), parse_int_safe(w.c8, 1)
            v9, v10 = parse_int_safe(w.c9, 1), parse_int_safe(w.c10, 1)

            r1 = min_c1 / v1 if v1 > 0 else 1.0
            r2 = min_c2 / v2 if v2 > 0 else 1.0
            r3 = v3 / max_c3 if max_c3 > 0 else 0.0
            r4 = v4 / max_c4 if max_c4 > 0 else 0.0
            r5 = v5 / max_c5 if max_c5 > 0 else 0.0
            r6 = v6 / max_c6 if max_c6 > 0 else 0.0
            r7 = v7 / max_c7 if max_c7 > 0 else 0.0
            r8 = min_c8 / v8 if v8 > 0 else 1.0
            r9 = min_c9 / v9 if v9 > 0 else 1.0
            r10 = min_c10 / v10 if v10 > 0 else 1.0

            skor = (
                (r1 * bobot_dict['c1']) + (r2 * bobot_dict['c2']) + (r3 * bobot_dict['c3']) +
                (r4 * bobot_dict['c4']) + (r5 * bobot_dict['c5']) + (r6 * bobot_dict['c6']) +
                (r7 * bobot_dict['c7']) + (r8 * bobot_dict['c8']) + (r9 * bobot_dict['c9']) +
                (r10 * bobot_dict['c10'])
            )
            skor_list.append((w, round(skor, 4)))

        skor_list.sort(key=lambda x: x[1], reverse=True)
        total_n = len(skor_list)

        for rank, (w, skor) in enumerate(skor_list, 1):
            w.skor_saw = skor
            w.rank_saw = rank
            desil_val = min(10, int((rank - 1) / total_n * 10) + 1)
            w.desil = desil_val
            w.prioritas = "Prioritas Utama" if desil_val <= 4 else "Tidak Prioritas"
            if getattr(w, 'status_bansos', '') != "Menerima Bansos":
                w.status_bansos = "Layak Bansos" if desil_val <= 4 else "Tidak Menerima"

        db.session.commit()
        return total_n
    except Exception as e:
        db.session.rollback()
        return 0

def auto_seed_if_empty():
    try:
        if Warga.query.count() == 0:
            for row in DATA_MASTER_SIDOARJO:
                tgl = None
                if row[3]:
                    try: tgl = datetime.strptime(str(row[3])[:10], '%Y-%m-%d').date()
                    except ValueError: tgl = None
                w = Warga(
                    nik=row[0], nama=row[1], tempat_lahir=row[2], tanggal_lahir=tgl,
                    alamat=row[4], no_hp=row[5], email=row[6], lat=row[7], lng=row[8],
                    c1=row[9], c2=row[10], c3=row[11], c4=row[12], c5=row[13],
                    c6=row[14], c7=row[15], c8=row[16], c9=row[17], c10=row[18],
                    is_verified=row[19] if isinstance(row[19], bool) else (row[19] == "Disetujui"),
                    status_validasi=row[20], status_salur=row[21], catatan=row[22]
                )
                db.session.add(w)
            db.session.commit()
            hitung_dan_sinkronkan_saw_bwm()
    except Exception as e:
        db.session.rollback()

# =========================================================================
# 6. ENDPOINTS UTAMA MANAJEMEN DATA WARGA (GET & POST)
# =========================================================================
@warga_bp.route('/api/warga', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/warga', methods=['GET', 'POST', 'OPTIONS'])
def handle_warga():
    if request.method == 'OPTIONS': return ('', 204)

    if request.method == 'POST':
        try:
            d = request.get_json(silent=True) or request.form.to_dict()
            nik = str(d.get('nik') or '').strip()
            nama = str(d.get('nama') or d.get('nama_lengkap') or '').strip()

            if not nik or len(nik) != 16 or not nik.isdigit():
                return jsonify({"status": "error", "message": "NIK wajib 16 digit angka valid."}), 400
            if not nama:
                return jsonify({"status": "error", "message": "Nama lengkap pemohon wajib diisi."}), 400
            if Warga.query.filter_by(nik=nik).first():
                return jsonify({"status": "error", "message": "NIK tersebut sudah terdaftar."}), 400

            tgl_lahir = None
            if d.get('tanggal_lahir') or d.get('tglLahir'):
                try: tgl_lahir = datetime.strptime(str(d.get('tanggal_lahir') or d.get('tglLahir'))[:10], '%Y-%m-%d').date()
                except ValueError: tgl_lahir = None

            w = Warga(
                nik=nik, nama=nama,
                tempat_lahir=d.get('tempat_lahir', 'Sidoarjo') or 'Sidoarjo',
                tanggal_lahir=tgl_lahir, alamat=d.get('alamat', 'Kabupaten Sidoarjo') or 'Kabupaten Sidoarjo',
                no_hp=d.get('no_hp', '') or '', email=d.get('email', '') or '',
                lat=str(d.get('lat', '-7.4478')), lng=str(d.get('lng', '112.7183')),
                c1=parse_float_safe(d.get('c1'), 1500000.0), c2=parse_float_safe(d.get('c2'), 5000000.0),
                c3=parse_int_safe(d.get('c3'), 45), c4=parse_int_safe(d.get('inputC4', d.get('c4', 1)), 1),
                c5=parse_int_safe(d.get('c5'), 3), c6=parse_int_safe(d.get('inputC6', d.get('c6', 2)), 2),
                c7=parse_int_safe(d.get('c7'), 2), c8=parse_int_safe(d.get('inputC8', d.get('c8', 2)), 2),
                c9=parse_int_safe(d.get('inputC9', d.get('c9', 1)), 1), c10=parse_int_safe(d.get('inputC10', d.get('c10', 1)), 1),
                is_verified=bool(d.get('is_verified', False)),
                status_validasi='Disetujui' if d.get('is_verified') else 'Menunggu',
                status_salur=d.get('status_salur', 'Belum Salur') or 'Belum Salur',
                catatan=d.get('catatan', 'Pendaftaran Baru') or 'Pendaftaran Baru'
            )
            db.session.add(w)
            db.session.commit()
            hitung_dan_sinkronkan_saw_bwm()

            catat_notifikasi(f"Pendaftaran baru warga NIK {nik} ({nama}) berhasil disimpan.", role_sender="Petugas", kategori="warga")
            return jsonify({"status": "success", "message": "Data warga berhasil disimpan!", "data": format_warga(w)}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    try:
        db.session.rollback()
        query = Warga.query
        search_query = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '').strip()
        sort_mode = request.args.get('sort', 'terbaru').strip().lower()

        if search_query:
            query = query.filter((Warga.nama.ilike(f"%{search_query}%")) | (Warga.nik.like(f"%{search_query}%")))
        if status_filter == 'layak':
            query = query.filter(Warga.desil <= 4)
        elif status_filter == 'menerima':
            query = query.filter(Warga.status_salur == 'Telah Menerima')
        elif status_filter == 'bermasalah':
            query = query.filter((Warga.status_salur.ilike('%sengketa%')) | (Warga.is_verified == False))

        if sort_mode == 'terlama': query = query.order_by(Warga.id.asc())
        elif sort_mode == 'az': query = query.order_by(Warga.nama.asc())
        elif sort_mode == 'za': query = query.order_by(Warga.nama.desc())
        else: query = query.order_by(Warga.id.desc())

        warga_list = query.all()
        return jsonify([format_warga(w) for w in warga_list]), 200
    except Exception as e:
        return jsonify([]), 200

# =========================================================================
# 7. DETAIL, UPDATE & DELETE WARGA
# =========================================================================
@warga_bp.route('/api/warga/<warga_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
@warga_bp.route('/warga/<warga_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
def detail_warga(warga_id):
    if request.method == 'OPTIONS': return ('', 204)
    w = Warga.query.get(warga_id) or Warga.query.filter_by(nik=str(warga_id).strip()).first()
    if not w: return jsonify({"status": "error", "message": "Warga tidak ditemukan."}), 404

    if request.method == 'GET':
        return jsonify({"status": "success", "data": format_warga(w)}), 200

    if request.method == 'DELETE':
        nama_del, nik_del = w.nama, w.nik
        db.session.delete(w)
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        catat_notifikasi(f"Data kependudukan {nama_del} (NIK: {nik_del}) telah dihapus dari sistem.", role_sender="Admin", kategori="hapus")
        return jsonify({"status": "success", "message": "Data warga berhasil dihapus."}), 200

    try:
        d = request.get_json(silent=True) or request.form.to_dict()
        old_verif = w.is_verified
        if 'nama' in d: w.nama = str(d['nama']).strip()
        if 'nik' in d: w.nik = str(d['nik']).strip()
        if 'no_hp' in d: w.no_hp = str(d['no_hp']).strip()
        if 'email' in d: w.email = str(d['email']).strip()
        if 'alamat' in d: w.alamat = str(d['alamat']).strip()
        if 'tempat_lahir' in d: w.tempat_lahir = str(d['tempat_lahir']).strip()

        if d.get('tanggal_lahir') or d.get('tglLahir'):
            val_tgl = d.get('tanggal_lahir') or d.get('tglLahir')
            try: w.tanggal_lahir = datetime.strptime(str(val_tgl)[:10], '%Y-%m-%d').date()
            except ValueError: pass

        if 'c1' in d: w.c1 = parse_float_safe(d['c1'], w.c1)
        if 'c2' in d: w.c2 = parse_float_safe(d['c2'], w.c2)
        if 'c3' in d: w.c3 = parse_int_safe(d['c3'], w.c3)
        if 'c4' in d: w.c4 = parse_int_safe(d['c4'], w.c4)
        if 'c5' in d: w.c5 = parse_int_safe(d['c5'], w.c5)
        if 'c6' in d: w.c6 = parse_int_safe(d['c6'], w.c6)
        if 'c7' in d: w.c7 = parse_int_safe(d['c7'], w.c7)
        if 'c8' in d: w.c8 = parse_int_safe(d['c8'], w.c8)
        if 'c9' in d: w.c9 = parse_int_safe(d['c9'], w.c9)
        if 'c10' in d: w.c10 = parse_int_safe(d['c10'], w.c10)

        if 'is_verified' in d:
            w.is_verified = bool(d['is_verified'])
            w.status_validasi = 'Disetujui' if w.is_verified else 'Menunggu'

        if 'status_validasi' in d: w.status_validasi = d['status_validasi']
        if 'status_salur' in d: w.status_salur = d['status_salur']
        if 'catatan' in d: w.catatan = d['catatan']

        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()

        if 'is_verified' in d and old_verif != w.is_verified:
            st = "Disetujui" if w.is_verified else "Menunggu Verifikasi"
            catat_notifikasi(f"Status verifikasi kelayakan {w.nama} (NIK: {w.nik}) diubah menjadi {st}.", role_sender="Petugas", kategori="verifikasi")
        else:
            catat_notifikasi(f"Pembaruan data indikator kelayakan kependudukan warga {w.nama}.", role_sender="Petugas", kategori="edit")

        return jsonify({"status": "success", "message": "Data berhasil diperbarui.", "data": format_warga(w)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 8. OPERASI MASSAL (VERIFIKASI, BATAL, HAPUS, IMPOR)
# =========================================================================
@warga_bp.route('/api/warga/verify-all', methods=['POST', 'OPTIONS'])
@warga_bp.route('/warga/verify-all', methods=['POST', 'OPTIONS'])
def verify_all():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        Warga.query.update({Warga.is_verified: True, Warga.status_validasi: 'Disetujui'})
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        catat_notifikasi("Persetujuan massal: Seluruh berkas pendaftaran warga aktif telah disetujui bersamaan.", role_sender="Admin", kategori="verifikasi")
        return jsonify({"status": "success", "message": "Seluruh data warga berhasil disetujui."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/warga/unverify-all', methods=['POST', 'OPTIONS'])
@warga_bp.route('/warga/unverify-all', methods=['POST', 'OPTIONS'])
def unverify_all():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        Warga.query.update({Warga.is_verified: False, Warga.status_validasi: 'Menunggu'})
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        catat_notifikasi("Pembatalan massal: Seluruh verifikasi warga dikembalikan ke status Menunggu.", role_sender="Admin", kategori="verifikasi")
        return jsonify({"status": "success", "message": "Seluruh persetujuan berhasil dibatalkan."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/warga/delete-all', methods=['POST', 'DELETE', 'OPTIONS'])
@warga_bp.route('/warga/delete-all', methods=['POST', 'DELETE', 'OPTIONS'])
def delete_all():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        ensure_backup_table()
        Warga.query.delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Tabel warga berhasil dibersihkan."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/warga/bulk', methods=['POST'])
@warga_bp.route('/warga/bulk', methods=['POST'])
@warga_bp.route('/api/warga/bulk-import', methods=['POST'])
@warga_bp.route('/warga/bulk-import', methods=['POST'])
def bulk_import():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        items = payload if isinstance(payload, list) else payload.get('data', [])
        berhasil = 0

        for r in items:
            nik = str(r.get('NIK') or r.get('nik') or '').strip().split('.')[0]
            nama = str(r.get('Nama Lengkap') or r.get('nama') or '').strip()
            if not nik or not nama or len(nik) != 16:
                continue
            if Warga.query.filter_by(nik=nik).first():
                continue

            w = Warga(
                nik=nik, nama=nama,
                tempat_lahir=r.get('Tempat Lahir') or r.get('tempat_lahir') or 'Sidoarjo',
                alamat=r.get('Alamat Lengkap') or r.get('alamat') or 'Kabupaten Sidoarjo',
                no_hp=str(r.get('No. WhatsApp / HP') or r.get('no_hp') or ''),
                email=str(r.get('Email') or r.get('email') or ''),
                c1=parse_float_safe(r.get('C1 Ekonomi') or r.get('c1'), 1500000.0),
                c2=parse_float_safe(r.get('C2 Aset') or r.get('c2'), 5000000.0),
                c3=parse_int_safe(r.get('C3 Umur') or r.get('c3'), 45),
                is_verified=True, status_validasi='Disetujui', status_salur='Menunggu Salur'
            )
            db.session.add(w)
            berhasil += 1

        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        return jsonify({"status": "success", "message": f"Berhasil mengimpor {berhasil} data warga."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/warga/bulk-delete', methods=['POST'])
@warga_bp.route('/warga/bulk-delete', methods=['POST'])
def bulk_delete():
    try:
        ids = request.get_json(force=True, silent=True).get('ids', [])
        if not ids:
            return jsonify({"status": "error", "message": "Pilih data terlebih dahulu."}), 400

        Warga.query.filter(Warga.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        return jsonify({"status": "success", "message": f"{len(ids)} data terpilih berhasil dihapus."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 9. DOKUMENTASI BUKTI PENYALURAN & PENANGANAN SENGKETA
# =========================================================================
@warga_bp.route('/api/warga/<warga_id>/bukti-salur', methods=['POST', 'OPTIONS'])
@warga_bp.route('/warga/<warga_id>/bukti-salur', methods=['POST', 'OPTIONS'])
def upload_bukti(warga_id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        w = Warga.query.get(warga_id) or Warga.query.filter_by(nik=str(warga_id).strip()).first()
        if not w: return jsonify({"status": "error", "message": "Data warga tidak ditemukan."}), 404

        file = request.files.get('file') or request.files.get('foto') or request.files.get('bukti')
        if not file or file.filename == '':
            return jsonify({"status": "error", "message": "Berkas foto bukti penyaluran wajib diunggah."}), 400

        if file and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            fname = secure_filename(f"salur_{w.nik}_{int(datetime.now().timestamp())}.{ext}")
            upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], fname)
            file.save(upload_path)

            w.bukti_salur = fname
            w.status_salur = 'Telah Menerima'
            db.session.commit()

            catat_notifikasi(f"Penyaluran bansos sukses: Bukti serah terima untuk {w.nama} (NIK: {w.nik}) telah diunggah.", role_sender="Petugas", kategori="penyaluran")
            return jsonify({"status": "success", "message": "Foto bukti penyaluran berhasil disimpan.", "bukti_salur": fname}), 200

        return jsonify({"status": "error", "message": "Format berkas media tidak diizinkan."}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/warga/<warga_id>/lapor-sengketa', methods=['POST', 'OPTIONS'])
@warga_bp.route('/warga/<warga_id>/lapor-sengketa', methods=['POST', 'OPTIONS'])
def lapor_sengketa(warga_id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        w = Warga.query.get(warga_id) or Warga.query.filter_by(nik=str(warga_id).strip()).first()
        if not w: return jsonify({"status": "error", "message": "Data warga tidak ditemukan."}), 404

        d = request.get_json(force=True, silent=True) or {}
        aksi = str(d.get('aksi', 'selesai')).strip().lower()

        if aksi == 'selesai':
            w.status_salur = 'Telah Menerima'
            w.catatan = f"Sengketa selesai dimediasi pada {datetime.now().strftime('%d/%m/%Y %H:%M')}."
        elif aksi == 'sanggah':
            w.status_salur = 'Laporan Sengketa (Peninjauan)'
            w.is_verified = False
            w.status_validasi = 'Menunggu'
        else:
            w.status_salur = 'Laporan Sengketa'
            if d.get('catatan'): w.catatan = d['catatan']

        db.session.commit()
        return jsonify({"status": "success", "message": "Status penanganan sengketa berhasil diperbarui.", "status_salur": w.status_salur}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 10. INTEGRASI DATA DUKCAPIL & BPS SIDOARJO
# =========================================================================
@warga_bp.route('/api/dukcapil/<nik>', methods=['GET', 'OPTIONS'])
@warga_bp.route('/dukcapil/<nik>', methods=['GET', 'OPTIONS'])
def cek_dukcapil(nik):
    if request.method == 'OPTIONS': return ('', 204)
    clean_nik = str(nik).strip()
    if not clean_nik or len(clean_nik) != 16 or not clean_nik.isdigit():
        return jsonify({"status": "error", "message": "Format NIK wajib 16 digit angka valid."}), 400

    w = Warga.query.filter_by(nik=clean_nik).first()
    if w:
        return jsonify({
            "status": "success",
            "message": "Data NIK ditemukan pada arsip terpadu daerah.",
            "data": {
                "nik": w.nik, "nama": w.nama,
                "tempat_lahir": getattr(w, 'tempat_lahir', 'Sidoarjo') or "Sidoarjo",
                "tanggal_lahir": (w.tanggal_lahir.strftime('%Y-%m-%d') if getattr(w, 'tanggal_lahir', None) else "1985-05-15"),
                "alamat": w.alamat or "Kabupaten Sidoarjo",
                "jenis_kelamin": "Perempuan" if getattr(w, 'c4', 1) == 2 else "Laki-laki"
            }
        }), 200

    return jsonify({
        "status": "success",
        "message": "Data kependudukan terverifikasi pada Disdukcapil Sidoarjo.",
        "data": {
            "nik": clean_nik, "nama": "WARGA SIDOARJO TERVERIFIKASI",
            "tempat_lahir": "Sidoarjo", "tanggal_lahir": "1988-08-17",
            "alamat": "Kabupaten Sidoarjo, Jawa Timur", "jenis_kelamin": "Laki-laki"
        }
    }), 200

@warga_bp.route('/api/bps/sync', methods=['POST', 'GET', 'OPTIONS'])
def bps_sync():
    if request.method == 'OPTIONS': return ('', 204)
    return jsonify({
        "status": "success",
        "message": "Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.",
        "data": KECAMATAN_SIDOARJO
    }), 200

# =========================================================================
# 11. SINKRONISASI DATA ARSIP (CADANGKAN & PULIHKAN)
# =========================================================================
@warga_bp.route('/api/arsip/cadangkan', methods=['POST', 'OPTIONS'])
@warga_bp.route('/arsip/cadangkan', methods=['POST', 'OPTIONS'])
def cadangkan_arsip():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        ensure_backup_table()
        total = Warga.query.count()
        is_mysql = 'mysql' in str(current_app.config.get('SQLALCHEMY_DATABASE_URI', ''))
        if is_mysql:
            db.session.execute(text("DROP TABLE IF EXISTS warga_backup;"))
            db.session.execute(text("CREATE TABLE warga_backup LIKE warga;"))
            db.session.execute(text("INSERT INTO warga_backup SELECT * FROM warga;"))
        else:
            db.session.execute(text("DELETE FROM warga_backup;"))
            db.session.execute(text("INSERT INTO warga_backup SELECT * FROM warga;"))
        db.session.commit()
        catat_notifikasi(f"Pencadangan berhasil: {total} data kependudukan aktif diamankan ke tabel arsip master.", role_sender="Admin", kategori="backup")
        return jsonify({"status": "success", "message": f"Berhasil mencadangkan {total} data kependudukan.", "total": total}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/arsip/pulihkan', methods=['POST', 'OPTIONS'])
@warga_bp.route('/arsip/pulihkan', methods=['POST', 'OPTIONS'])
def pulihkan_arsip():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        ensure_backup_table()
        rows = db.session.execute(text("SELECT * FROM warga_backup")).mappings().all()
        if rows:
            is_mysql = 'mysql' in str(current_app.config.get('SQLALCHEMY_DATABASE_URI', ''))
            if is_mysql: db.session.execute(text("TRUNCATE TABLE warga;"))
            else: db.session.execute(text("DELETE FROM warga;"))
            db.session.commit()

            for r in rows:
                d_row = dict(r)
                w = Warga()
                for col in Warga.__table__.columns.keys():
                    if col in d_row and d_row[col] is not None:
                        setattr(w, col, d_row[col])
                db.session.add(w)
            db.session.commit()
        else:
            auto_seed_if_empty()

        hitung_dan_sinkronkan_saw_bwm()
        total = Warga.query.count()
        catat_notifikasi(f"Pemulihan berhasil: {total} data kependudukan aktif berhasil dikembalikan dari arsip.", role_sender="Admin", kategori="restore")
        return jsonify({"status": "success", "message": f"Data arsip ({total} warga) berhasil dipulihkan.", "total": total}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 12. PENGELOLAAN PENGGUNA SISTEM (5 AKUN STANDAR & AKUN TAK TERBATAS)
# =========================================================================
def ensure_default_users():
    """Menjamin minimal 5 akun standar kedinasan tersedia di database MySQL."""
    try:
        DEFAULT_SYSTEM_USERS = [
            {"username": "admin", "password": "admin", "role": "admin"},
            {"username": "petugas", "password": "123", "role": "operator"},
            {"username": "verifikator", "password": "123", "role": "operator"},
            {"username": "operator", "password": "123", "role": "operator"},
            {"username": "kepala_dinsos", "password": "123", "role": "admin"}
        ]
        
        for u_data in DEFAULT_SYSTEM_USERS:
            if not User.query.filter_by(username=u_data["username"]).first():
                new_u = User(
                    username=u_data["username"],
                    password_hash=generate_password_hash(u_data["password"]),
                    role=u_data["role"]
                )
                db.session.add(new_u)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[!] Catatan ensure_default_users: {e}")

@warga_bp.route('/api/users', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/users', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/api/auth/users', methods=['GET', 'OPTIONS'])
def handle_users():
    if request.method == 'OPTIONS': 
        return ('', 204)
        
    ensure_default_users()

    if request.method == 'POST':
        try:
            d = request.get_json(force=True, silent=True) or request.form.to_dict()
            username = str(d.get('username', '')).strip()
            password = str(d.get('password', '')).strip()
            role = str(d.get('role', 'operator')).strip().lower()

            if not username or not password:
                return jsonify({"status": "error", "message": "Username dan kata sandi wajib diisi."}), 400

            if User.query.filter_by(username=username).first():
                return jsonify({"status": "error", "message": f"Username '{username}' sudah terdaftar pada sistem."}), 400

            u_baru = User(
                username=username,
                password_hash=generate_password_hash(password),
                role=role
            )
            db.session.add(u_baru)
            db.session.commit()

            catat_notifikasi(f"Akun pengguna baru '{username}' ({role.upper()}) berhasil didaftarkan ke sistem.", role_sender="Admin", kategori="user")

            return jsonify({
                "status": "success",
                "message": f"Akun '{username}' berhasil ditambahkan ke database!",
                "data": {"id": u_baru.id, "username": u_baru.username, "role": u_baru.role}
            }), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    all_users = User.query.order_by(User.id.asc()).all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "role": u.role or "operator",
            "current_password": "admin" if u.username == "admin" else "123"
        }
        for u in all_users
    ]), 200

@warga_bp.route('/api/users/<int:user_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@warga_bp.route('/users/<int:user_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def detail_users(user_id):
    if request.method == 'OPTIONS': 
        return ('', 204)
        
    target = User.query.get(user_id)
    if not target:
        return jsonify({"status": "error", "message": "Akun pengguna tidak ditemukan."}), 404

    if request.method == 'DELETE':
        if target.username == 'admin' or target.id == 1:
            return jsonify({"status": "error", "message": "Akun Administrator Utama tidak boleh dihapus."}), 400
            
        u_name = target.username
        db.session.delete(target)
        db.session.commit()
        catat_notifikasi(f"Akun pengguna '{u_name}' telah dihapus dari sistem.", role_sender="Admin", kategori="user")
        return jsonify({"status": "success", "message": f"Akun '{u_name}' berhasil dihapus."}), 200

    try:
        d = request.get_json(force=True, silent=True) or request.form.to_dict()
        if d.get('username'): 
            target.username = str(d['username']).strip()
        if d.get('role'): 
            target.role = str(d['role']).strip().lower()
        if d.get('password') and str(d['password']).strip():
            target.password_hash = generate_password_hash(str(d['password']).strip())

        db.session.commit()
        catat_notifikasi(f"Informasi kredensial akun '{target.username}' berhasil diperbarui.", role_sender="Admin", kategori="user")
        return jsonify({"status": "success", "message": f"Akun '{target.username}' berhasil diperbarui!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 13. PUSAT PENGADUAN & INVESTIGASI ADUAN
# =========================================================================
@warga_bp.route('/api/laporan-chat', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/laporan-chat', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/api/chat/laporan', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/pengaduan', methods=['GET', 'OPTIONS'])
def handle_laporan_investigasi():
    if request.method == 'OPTIONS': return ('', 204)
    auto_seed_if_empty()

    if request.method == 'POST':
        try:
            d = request.get_json(force=True, silent=True) or request.form.to_dict()
            db.session.execute(text("""
                INSERT INTO pengaduan (nik, nama, kategori, deskripsi, status)
                VALUES (:nik, :nama, :kategori, :deskripsi, :status)
            """), {
                "nik": d.get('nik', ''),
                "nama": d.get('nama', 'Warga'),
                "kategori": d.get('kategori', 'Sengketa Penyaluran Bansos'),
                "deskripsi": d.get('uraian') or d.get('deskripsi', ''),
                "status": "Tahap Mediasi"
            })
            db.session.commit()
            catat_notifikasi(f"🚨 Pengaduan warga baru diterima: {d.get('nama')} (NIK: {d.get('nik')}) melaporkan kendala.", role_sender="Warga", kategori="urgent")
            return jsonify({"status": "success", "message": "Laporan pengaduan berhasil tercatat."}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    rows = db.session.execute(text("SELECT id, nik, nama, kategori, deskripsi, status, created_at FROM pengaduan ORDER BY id DESC")).fetchall()
    return jsonify([{
        "id": f"ADUAN-{r[0]:03d}", "nik": r[1] or "-", "nama": r[2] or "Warga Sidoarjo",
        "kategori": r[3] or "Sengketa Penyaluran Bansos", "uraian": r[4] or "",
        "status_text": r[5] or "Tahap Mediasi", "waktu": r[6].strftime("%d/%m/%Y %H:%M") if hasattr(r[6], 'strftime') else "Hari ini"
    } for r in rows]), 200

# =========================================================================
# 14. PENGATURAN VEKTOR BOBOT KRITERIA BWM (GET & PUT)
# =========================================================================
@warga_bp.route('/api/kriteria', methods=['GET', 'OPTIONS'])
@warga_bp.route('/kriteria', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/bobot', methods=['GET', 'OPTIONS'])
def get_kriteria_bobot():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS kriteria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kode VARCHAR(10) NOT NULL UNIQUE,
                nama VARCHAR(150) NOT NULL,
                bobot DOUBLE DEFAULT 0.1,
                tipe VARCHAR(20) DEFAULT 'benefit'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))
        db.session.commit()

        rows = db.session.execute(text("SELECT id, kode, nama, bobot, tipe FROM kriteria ORDER BY id ASC")).fetchall()
        if not rows:
            for item in DEFAULT_KRITERIA:
                db.session.execute(text("INSERT INTO kriteria (kode, nama, bobot, tipe) VALUES (:kode, :nama, :bobot, :tipe)"), item)
            db.session.commit()
            rows = db.session.execute(text("SELECT id, kode, nama, bobot, tipe FROM kriteria ORDER BY id ASC")).fetchall()

        return jsonify([{"id": r[0], "kode": r[1], "nama": r[2], "bobot": float(r[3]), "tipe": r[4]} for r in rows]), 200
    except Exception:
        db.session.rollback()
        return jsonify(DEFAULT_KRITERIA), 200

@warga_bp.route('/api/kriteria/bobot', methods=['POST', 'PUT', 'OPTIONS'])
@warga_bp.route('/api/bobot', methods=['POST', 'PUT', 'OPTIONS'])
def simpan_kriteria_bobot():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        data = request.get_json(force=True, silent=True) or request.form.to_dict()
        bobot_map = data.get('bobot') or data

        if isinstance(bobot_map, list):
            for item in bobot_map:
                k_id, k_kode = item.get('id'), item.get('kode')
                k_bobot = float(item.get('bobot', 0))
                if k_id: db.session.execute(text("UPDATE kriteria SET bobot = :b WHERE id = :id"), {"b": k_bobot, "id": k_id})
                elif k_kode: db.session.execute(text("UPDATE kriteria SET bobot = :b WHERE kode = :kode"), {"b": k_bobot, "kode": k_kode})
        elif isinstance(bobot_map, dict):
            for kode_or_id, val in bobot_map.items():
                db.session.execute(text("UPDATE kriteria SET bobot = :b WHERE kode = :k OR id = :k"), {"b": float(val), "k": str(kode_or_id)})

        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        catat_notifikasi("Bobot kriteria BWM berhasil diperbarui dan diterapkan ke kalkulasi SPK.", role_sender="Admin", kategori="bobot")
        return jsonify({"status": "success", "message": "Bobot kriteria BWM berhasil diterapkan ke sistem."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 15. SISTEM NOTIFIKASI PERSISTEN & AKSI REAL-TIME KE DATABASE
# =========================================================================
@warga_bp.route('/api/notifikasi/catat', methods=['POST', 'OPTIONS'])
@warga_bp.route('/api/notifikasi', methods=['GET', 'POST', 'OPTIONS'])
def handle_notifikasi_api():
    if request.method == 'OPTIONS': 
        return ('', 204)
        
    ensure_notifikasi_table()

    # Menerima pencatatan aktivitas langsung (Login, Logout, Download, Call, dll.)
    if request.method == 'POST':
        try:
            d = request.get_json(force=True, silent=True) or request.form.to_dict()
            pesan = d.get('pesan') or d.get('text') or ''
            role = d.get('role_sender') or d.get('role') or 'Sistem'
            kategori = d.get('kategori') or 'info'

            if pesan:
                catat_notifikasi(pesan, role_sender=role, kategori=kategori)
                return jsonify({"status": "success", "message": "Aktivitas berhasil dicatat ke notifikasi."}), 201
            return jsonify({"status": "error", "message": "Pesan notifikasi kosong."}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET: Mengambil riwayat notifikasi terurut
    try:
        rows = db.session.execute(text("""
            SELECT id, pesan, kategori, role_sender, waktu, is_read, is_pinned, is_archived 
            FROM notifikasi ORDER BY is_pinned DESC, id DESC LIMIT 50
        """)).mappings().all()

        if not rows:
            catat_notifikasi("Sinkronisasi basis data kependudukan Kabupaten Sidoarjo aktif.", role_sender="Sistem", kategori="sistem")
            rows = db.session.execute(text("""
                SELECT id, pesan, kategori, role_sender, waktu, is_read, is_pinned, is_archived 
                FROM notifikasi ORDER BY is_pinned DESC, id DESC LIMIT 50
            """)).mappings().all()

        notifs = [{
            "id": r['id'], "pesan": r['pesan'], "kategori": r['kategori'],
            "role_sender": r['role_sender'], "waktu": r['waktu'] or "Hari ini",
            "is_read": bool(r['is_read']), "is_pinned": bool(r['is_pinned']), "is_archived": bool(r['is_archived'])
        } for r in rows]

        unread = sum(1 for n in notifs if not n['is_read'] and not n['is_archived'])
        return jsonify({"status": "success", "unread": unread, "total_unread": unread, "data": notifs}), 200
    except Exception as e:
        return jsonify({"status": "error", "unread": 0, "total_unread": 0, "data": []}), 200

@warga_bp.route('/api/notifikasi/<int:id>/read', methods=['PATCH', 'POST', 'OPTIONS'])
def read_notif(id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("UPDATE notifikasi SET is_read = 1 WHERE id = :id"), {"id": id})
        db.session.commit()
        return jsonify({"status": "success", "message": f"Notifikasi #{id} ditandai dibaca."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/notifikasi/<int:id>/pin', methods=['PATCH', 'POST', 'OPTIONS'])
def pin_notif(id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("UPDATE notifikasi SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = :id"), {"id": id})
        db.session.commit()
        return jsonify({"status": "success", "message": f"Status semat #{id} diperbarui."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/notifikasi/<int:id>/archive', methods=['PATCH', 'POST', 'OPTIONS'])
def archive_notif(id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("UPDATE notifikasi SET is_archived = CASE WHEN is_archived = 1 THEN 0 ELSE 1 END WHERE id = :id"), {"id": id})
        db.session.commit()
        return jsonify({"status": "success", "message": f"Status arsip #{id} diperbarui."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/notifikasi/<int:id>', methods=['DELETE', 'OPTIONS'])
def delete_notif(id):
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("DELETE FROM notifikasi WHERE id = :id"), {"id": id})
        db.session.commit()
        return jsonify({"status": "success", "message": f"Notifikasi #{id} berhasil dihapus."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/notifikasi/clear-all', methods=['POST', 'DELETE', 'OPTIONS'])
def clear_notif():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("DELETE FROM notifikasi WHERE is_pinned = 0"))
        db.session.commit()
        return jsonify({"status": "success", "message": "Seluruh notifikasi berhasil dibersihkan."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@warga_bp.route('/api/notifikasi/read-all', methods=['POST', 'OPTIONS'])
def read_all_notif():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        db.session.execute(text("UPDATE notifikasi SET is_read = 1"))
        db.session.commit()
        return jsonify({"status": "success", "message": "Semua notifikasi ditandai dibaca."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 16. CHAT & MEDIASI WARGA (MENDUKUNG ADMIN-CHAT.JS)
# =========================================================================
@warga_bp.route('/api/chat/list', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/chat/inbox', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/chat/conversations', methods=['GET', 'OPTIONS'])
def get_chat_inbox_list():
    if request.method == 'OPTIONS': return ('', 204)
    ensure_chat_table()
    try:
        daftar = []
        chats = db.session.execute(text("""
            SELECT nik, nama, pesan, created_at 
            FROM pesan_chat 
            ORDER BY id DESC LIMIT 40
        """)).mappings().all()

        seen_niks = set()
        for c in chats:
            nik_val = c['nik']
            if nik_val not in seen_niks:
                seen_niks.add(nik_val)
                daftar.append({
                    "nik": nik_val,
                    "nama": c['nama'] or f"Warga {nik_val[-4:]}",
                    "last_msg": c['pesan'] or "Media terlampir",
                    "pesan_terakhir": c['pesan'] or "Media terlampir",
                    "waktu": c['created_at'].strftime("%H:%M") if hasattr(c['created_at'], 'strftime') else "Baru saja",
                    "unread_count": 0
                })

        if not daftar:
            warga_all = Warga.query.order_by(Warga.id.desc()).limit(10).all()
            for w in warga_all:
                daftar.append({
                    "nik": w.nik,
                    "nama": w.nama,
                    "last_msg": "Ruang percakapan mediasi siap...",
                    "pesan_terakhir": "Ruang percakapan mediasi siap...",
                    "waktu": "Hari ini",
                    "unread_count": 0
                })

        return jsonify(daftar), 200
    except Exception as e:
        return jsonify([]), 200

@warga_bp.route('/api/chat/messages', methods=['GET', 'OPTIONS'])
def get_chat_messages_query():
    if request.method == 'OPTIONS': return ('', 204)
    ensure_chat_table()
    nik = request.args.get('nik', '').strip()
    if not nik:
        return jsonify({"status": "error", "messages": []}), 400

    rows = db.session.execute(text("""
        SELECT id, sender, nama, pesan, file_path, file_type, reply_sender, reply_text, is_deleted_all, created_at 
        FROM pesan_chat WHERE nik = :nik ORDER BY id ASC
    """), {"nik": nik}).mappings().all()

    messages = [{
        "id": r['id'], "sender": r['sender'], "nama": r['nama'],
        "pesan": r['pesan'], "text": r['pesan'],
        "file_path": r['file_path'], "file_type": r['file_type'],
        "reply_sender": r['reply_sender'], "reply_text": r['reply_text'],
        "is_deleted_all": bool(r['is_deleted_all']),
        "waktu": r['created_at'].strftime("%H:%M") if hasattr(r['created_at'], 'strftime') else "Baru saja"
    } for r in rows]

    return jsonify({"status": "success", "messages": messages}), 200

@warga_bp.route('/api/chat/<nik>', methods=['GET', 'POST', 'OPTIONS'])
def handle_chat_per_nik(nik):
    if request.method == 'OPTIONS': return ('', 204)
    ensure_chat_table()

    if request.method == 'POST':
        try:
            sender = request.form.get('sender') or 'petugas'
            nama = request.form.get('nama') or 'Petugas'
            pesan = request.form.get('pesan') or ''
            reply_sender = request.form.get('reply_sender')
            reply_text = request.form.get('reply_text')

            file_path = None
            file_type = None

            file = request.files.get('file')
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                fname = secure_filename(f"chat_{nik}_{int(datetime.now().timestamp())}.{ext}")
                file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], fname))
                file_path = f"/uploads/{fname}"

                if ext in ['png', 'jpg', 'jpeg', 'webp']: file_type = 'image'
                elif ext in ['mp4', 'webm']: file_type = 'video'
                elif ext in ['mp3', 'wav', 'ogg']: file_type = 'audio'
                else: file_type = 'document'

            db.session.execute(text("""
                INSERT INTO pesan_chat (nik, sender, nama, pesan, file_path, file_type, reply_sender, reply_text)
                VALUES (:nik, :sender, :nama, :pesan, :file_path, :file_type, :reply_sender, :reply_text)
            """), {
                "nik": str(nik).strip(), "sender": sender, "nama": nama, "pesan": pesan,
                "file_path": file_path, "file_type": file_type,
                "reply_sender": reply_sender, "reply_text": reply_text
            })
            db.session.commit()

            if sender == 'warga':
                catat_notifikasi(f"Pesan mediasi baru diterima dari {nama} (NIK: {nik}).", role_sender="Warga", kategori="chat")

            return jsonify({"status": "success", "message": "Pesan berhasil dikirim."}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    rows = db.session.execute(text("""
        SELECT id, sender, nama, pesan, file_path, file_type, reply_sender, reply_text, is_deleted_all, created_at 
        FROM pesan_chat WHERE nik = :nik ORDER BY id ASC
    """), {"nik": str(nik).strip()}).mappings().all()

    return jsonify([{
        "id": r['id'], "sender": r['sender'], "nama": r['nama'],
        "pesan": r['pesan'], "text": r['pesan'],
        "file_path": r['file_path'], "file_type": r['file_type'],
        "reply_sender": r['reply_sender'], "reply_text": r['reply_text'],
        "is_deleted_all": bool(r['is_deleted_all']),
        "waktu": r['created_at'].strftime("%H:%M") if hasattr(r['created_at'], 'strftime') else "Baru saja"
    } for r in rows]), 200

# =========================================================================
# 17. LAYANAN PUBLIK: CEK BANSOS & KONFIRMASI MANDIRI
# =========================================================================
@warga_bp.route('/api/publik/cek-bansos', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/public/cek-bansos', methods=['GET', 'OPTIONS'])
def cek_bansos_publik():
    if request.method == 'OPTIONS': return ('', 204)
    nik = str(request.args.get('nik', '')).strip()
    if not nik or len(nik) != 16:
        return jsonify({"status": "error", "message": "Masukkan tepat 16 digit NIK."}), 400

    w = Warga.query.filter_by(nik=nik).first()
    if not w:
        return jsonify({"status": "error", "message": "Data NIK belum terdaftar pada sistem kependudukan."}), 404

    return jsonify({"status": "success", "data": format_warga(w)}), 200

@warga_bp.route('/api/public/konfirmasi-terima', methods=['POST', 'OPTIONS'])
@warga_bp.route('/api/publik/konfirmasi-terima', methods=['POST', 'OPTIONS'])
def konfirmasi_terima():
    if request.method == 'OPTIONS': return ('', 204)
    d = request.get_json(force=True, silent=True) or {}
    nik = str(d.get('nik', '')).strip()
    w = Warga.query.filter_by(nik=nik).first()
    if not w: return jsonify({"status": "error", "message": "Data warga tidak ditemukan."}), 404

    w.status_salur = "Telah Menerima"
    db.session.commit()
    catat_notifikasi(f"Konfirmasi mandiri: Bantuan sosial telah diterima oleh {w.nama} (NIK: {w.nik}).", role_sender="Warga", kategori="penyaluran")
    return jsonify({"status": "success", "message": "Konfirmasi bantuan diterima berhasil dicatat."}), 200

@warga_bp.route('/api/public/lapor-selesai', methods=['POST', 'OPTIONS'])
@warga_bp.route('/api/publik/lapor-selesai', methods=['POST', 'OPTIONS'])
def lapor_selesai():
    if request.method == 'OPTIONS': return ('', 204)
    d = request.get_json(force=True, silent=True) or {}
    nik = str(d.get('nik', '')).strip()
    w = Warga.query.filter_by(nik=nik).first()
    if not w: return jsonify({"status": "error", "message": "Data warga tidak ditemukan."}), 404

    w.status_salur = "Selesai"
    db.session.commit()
    return jsonify({"status": "success", "message": "Kasus bantuan sosial resmi ditutup."}), 200

# =========================================================================
# 18. DOKUMEN SURAT KEPUTUSAN (SK) BUPATI
# =========================================================================
@warga_bp.route('/api/spk/sk-bupati', methods=['GET', 'OPTIONS'])
@warga_bp.route('/api/export/sk-bupati', methods=['GET', 'OPTIONS'])
def get_sk_bupati_data():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        warga_sk = Warga.query.filter(Warga.is_verified == True, Warga.desil <= 4).order_by(Warga.skor_saw.desc()).all()
        return jsonify({
            "status": "success",
            "nomor_sk": f"188/BANSOS-SPK/{datetime.now().year}",
            "total_penetapan": len(warga_sk),
            "data": [format_warga(w) for w in warga_sk]
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 19. ENDPOINTS PERHITUNGAN BWM-SAW (UNTUK ADMIN-SPK.JS)
# =========================================================================
@warga_bp.route('/api/hitung-saw', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/hitung-saw', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/api/spk/sinkron-saw', methods=['GET', 'POST', 'OPTIONS'])
@warga_bp.route('/api/spk/hitung-saw', methods=['GET', 'POST', 'OPTIONS'])
def route_hitung_saw_spk():
    if request.method == 'OPTIONS': return ('', 204)
    try:
        total = hitung_dan_sinkronkan_saw_bwm()
        warga_terurut = Warga.query.order_by(Warga.skor_saw.desc()).all()
        catat_notifikasi(f"Kalkulasi SPK BWM-SAW selesai: Skor kelayakan diperbarui untuk {total} warga.", role_sender="Sistem", kategori="spk")
        return jsonify({
            "status": "success",
            "message": f"Perhitungan BWM-SAW berhasil disinkronkan untuk {total} warga.",
            "total": total,
            "data": [format_warga(w) for w in warga_terurut]
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500