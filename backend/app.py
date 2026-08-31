"""
=============================================================================
SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANTUAN SOSIAL TERPADU
KABUPATEN SIDOARJO - JAWA TIMUR
-----------------------------------------------------------------------------
METODE PEMBOBOTAN : BEST-WORST METHOD (BWM)
METODE PERANGKINGAN: SIMPLE ADDITIVE WEIGHTING (SAW)
METODE VERIFIKASI  : WEIGHTED PRODUCT (WP)
AUTENTIKASI        : JSON WEB TOKEN (JWT) DENGAN BRUTE-FORCE PROTECTION
BASIS DATA         : MYSQL / MARIADB (PORT 3306 / 127.0.0.1)
=============================================================================
"""

import os
import sys
import math
import time
import uuid
import json
import logging
import smtplib
from datetime import datetime, timedelta, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, abort, make_response
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import jwt
from werkzeug.exceptions import (
    HTTPException,
    NotFound,
    Unauthorized,
    Forbidden,
    BadRequest,
    InternalServerError
)
from werkzeug.utils import secure_filename

# ===========================================================================
# 1. KONFIGURASI ENVIRONMENT & APLIKASI UTAMA
# ===========================================================================
load_dotenv()

app = Flask(__name__)

# Kunci Rahasia JWT & Enkripsi
app.config['SECRET_KEY'] = os.getenv(
    'SECRET_KEY', 
    'kunci_rahasia_pemkab_sidoarjo_2026_super_aman_terenkripsi'
)

# Konfigurasi Koneksi Basis Data MySQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 
    'mysql+mysqlconnector://root:@127.0.0.1:3306/bansos'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_POOL_RECYCLE'] = 280
app.config['SQLALCHEMY_POOL_TIMEOUT'] = 20

# Batas Maksimum Berkas Upload (100 MB)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# Direktori Penyimpanan Berkas Multimedia
UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 
    'static/uploads'
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Format Ekstensi Berkas yang Diizinkan
ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg', 'png', 'webp', 'gif',
    'mp4', 'mov', 'avi', 'mkv', 'webm',
    'pdf', 'xlsx', 'xls', 'wav', 'mp3', 'ogg'
}

# Inisialisasi Database & Enkripsi Kata Sandi
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Konfigurasi Cross-Origin Resource Sharing (CORS) Lengkap
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)

# Konfigurasi Notifikasi Surat Elektronik (SMTP)
EMAIL_SENDER = os.getenv('EMAIL_SENDER', '')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', '')

# Pelacak Upaya Login (Pencegahan Brute-Force: Maksimal 5 Kali Gagal -> Kunci 15 Menit)
LOGIN_ATTEMPTS = {}

# ===========================================================================
# 2. FUNGSI BANTUAN (HELPER FUNCTIONS) & PENANGAN KESALAHAN
# ===========================================================================
def allowed_file(filename):
    """Memeriksa apakah ekstensi berkas diizinkan sesuai whitelist."""
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1).lower()
    return ext in ALLOWED_EXTENSIONS


def safe_float(val, default=0.0):
    """Konversi nilai menjadi float dengan penanganan nilai kosong/null."""
    if val is None or val == '':
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    """Konversi nilai menjadi integer dengan penanganan nilai kosong/null."""
    if val is None or val == '':
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def format_rupiah(val):
    """Format angka nominal ke dalam format mata uang Rupiah."""
    try:
        return f"Rp {int(val):,}".replace(',', '.')
    except:
        return "Rp 0"


def send_email_notification(to_email, subject, body_html):
    """Mengirimkan email notifikasi otomatis via Google SMTP."""
    if not EMAIL_SENDER or not EMAIL_PASSWORD or not to_email or "@" not in to_email:
        return False
    try:
        msg = MIMEMultipart()
        msg['From'] = f"Pusat Layanan Bansos Sidoarjo <{EMAIL_SENDER}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))
        
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as err:
        print(f"[SMTP Error] Gagal mengirim email ke {to_email}: {err}")
        return False


# Global HTTP Exception Handlers
@app.errorhandler(HTTPException)
def handle_http_exception(e):
    return jsonify({
        "status": "error",
        "code": e.code,
        "message": e.description
    }), e.code


@app.errorhandler(404)
def handle_not_found(e):
    return jsonify({
        "status": "error",
        "code": 404,
        "message": "Endpoint URL yang diminta tidak ditemukan pada peladen."
    }), 404


@app.errorhandler(401)
def handle_unauthorized(e):
    return jsonify({
        "status": "error",
        "code": 401,
        "message": "Otorisasi ditolak. Token tidak valid atau sesi telah berakhir."
    }), 401


@app.errorhandler(403)
def handle_forbidden(e):
    return jsonify({
        "status": "error",
        "code": 403,
        "message": "Akses dilarang. Tingkat wewenang akun Anda tidak mencukupi."
    }), 403


@app.errorhandler(500)
def handle_internal_error(e):
    return jsonify({
        "status": "error",
        "code": 500,
        "message": "Terjadi gangguan komputasi internal pada peladen."
    }), 500


@app.errorhandler(Exception)
def handle_generic_exception(e):
    return jsonify({
        "status": "error",
        "code": 500,
        "message": f"Terjadi kesalahan peladen: {str(e)}"
    }), 500

# ===========================================================================
# 3. STRUKTUR TABEL BASIS DATA (SQLALCHEMY MODELS)
# ===========================================================================
class Warga(db.Model):
    __tablename__ = 'warga'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama = db.Column(db.String(100), nullable=False)
    nik = db.Column(db.String(20), unique=True, nullable=False, index=True)
    no_hp = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    tempat_lahir = db.Column(db.String(50), nullable=True, default='Sidoarjo')
    tanggal_lahir = db.Column(db.Date, nullable=True)
    alamat = db.Column(db.String(255), nullable=True, default='Kabupaten Sidoarjo')

    # 10 Kriteria Penilaian Berdasarkan Proposal Tugas Akhir BWM-SAW
    c1_ekonomi = db.Column(db.Float, nullable=False, default=0.0)          # Cost: Penghasilan Bulanan (Rp)
    c2_aset = db.Column(db.Integer, nullable=False, default=0)             # Cost: Nilai Kepemilikan Aset (Rp)
    c3_umur = db.Column(db.Integer, nullable=False, default=0)             # Benefit: Usia Kepala Keluarga (Tahun)
    c4_jenis_kelamin = db.Column(db.Integer, nullable=False, default=1)    # Benefit: 1=Laki-laki, 2=Perempuan
    c5_tanggungan = db.Column(db.Integer, nullable=False, default=0)       # Benefit: Jumlah Tanggungan Jiwa
    c6_status_pernikahan = db.Column(db.Integer, nullable=False, default=1)# Benefit: 1=Belum, 2=Nikah, 3=Cerai
    c7_kepemilikan_anak = db.Column(db.Integer, nullable=False, default=0) # Benefit: Jumlah Anak Sekolah
    c8_tempat_tinggal = db.Column(db.Integer, nullable=False, default=1)   # Benefit: 1=Milik, 2=Sewa, 3=Numpang
    c9_pendidikan = db.Column(db.Integer, nullable=False, default=1)       # Cost: 1=SD, 2=SMP, 3=SMA, 4=PT
    c10_kesehatan = db.Column(db.Integer, nullable=False, default=1)       # Benefit: 1=Sehat, 2=Sakit/Disabilitas

    # Status Validasi, Bukti Penyaluran, & Koordinat Geospasial
    is_verified = db.Column(db.Boolean, default=False)
    tanggal_verifikasi = db.Column(db.Date, nullable=True)
    foto_rumah = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)
    catatan = db.Column(db.Text, nullable=True)
    status_salur = db.Column(db.String(50), default='Pending')             # 'Pending', 'Telah Menerima', 'Sengketa'
    bukti_salur = db.Column(db.String(255), nullable=True)                 # Nama berkas foto bukti penyerahan
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nama': self.nama,
            'nik': self.nik,
            'no_hp': self.no_hp or '',
            'email': self.email or '',
            'tempat_lahir': self.tempat_lahir or 'Sidoarjo',
            'tanggal_lahir': str(self.tanggal_lahir) if self.tanggal_lahir else '',
            'alamat': self.alamat or 'Sidoarjo',
            'c1_ekonomi': self.c1_ekonomi,
            'c2_aset': self.c2_aset,
            'c3_umur': self.c3_umur,
            'c4_jenis_kelamin': self.c4_jenis_kelamin,
            'c5_tanggungan': self.c5_tanggungan,
            'c6_status_pernikahan': self.c6_status_pernikahan,
            'c7_kepemilikan_anak': self.c7_kepemilikan_anak,
            'c8_tempat_tinggal': self.c8_tempat_tinggal,
            'c9_pendidikan': self.c9_pendidikan,
            'c10_kesehatan': self.c10_kesehatan,
            'is_verified': self.is_verified,
            'tanggal_verifikasi': str(self.tanggal_verifikasi) if self.tanggal_verifikasi else '',
            'foto_rumah': self.foto_rumah or '',
            'lat': self.latitude or '',
            'lng': self.longitude or '',
            'catatan': self.catatan or '',
            'status_salur': self.status_salur or 'Pending',
            'bukti_salur': self.bukti_salur or '',
            'created_at': self.created_at.strftime("%d/%m/%Y %H:%M") if self.created_at else ''
        }


class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator')  # 'admin' (Super Admin) atau 'operator' (Petugas)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email or f"{self.username}@sidoarjo.go.id",
            'role': self.role,
            'created_at': self.created_at.strftime("%d/%m/%Y") if self.created_at else '-'
        }


class Kriteria(db.Model):
    __tablename__ = 'kriteria'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    kode = db.Column(db.String(5), unique=True, nullable=False, index=True)
    nama = db.Column(db.String(100), nullable=False)
    bobot = db.Column(db.Float, nullable=False, default=0.1)
    jenis = db.Column(db.String(10), nullable=False, default='benefit')  # 'benefit' atau 'cost'

    def to_dict(self):
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'bobot': self.bobot,
            'jenis': self.jenis
        }


class Notifikasi(db.Model):
    __tablename__ = 'notifikasi'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pesan = db.Column(db.Text, nullable=False)
    role_target = db.Column(db.String(20), nullable=False, default='all')
    waktu = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'pesan': self.pesan,
            'role_target': self.role_target,
            'waktu': self.waktu.strftime("%H:%M | %d/%m/%Y") if self.waktu else '',
            'is_read': self.is_read,
            'is_pinned': self.is_pinned,
            'is_archived': self.is_archived
        }


class ChatKeluhan(db.Model):
    __tablename__ = 'chat_keluhan'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nik_warga = db.Column(db.String(20), nullable=False, index=True)
    nama_warga = db.Column(db.String(100), nullable=False)
    sender = db.Column(db.String(20), nullable=False)  # 'warga' atau 'admin'
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)  # 'image', 'video', 'audio', 'document'
    is_pinned = db.Column(db.Boolean, default=False)
    reaction = db.Column(db.String(10), nullable=True)
    waktu = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'nik': self.nik_warga,
            'nama': self.nama_warga,
            'sender': self.sender,
            'pesan': self.pesan or '',
            'file_path': f"/uploads/{self.file_path}" if self.file_path else None,
            'file_type': self.file_type,
            'is_pinned': self.is_pinned,
            'reaction': self.reaction,
            'waktu': self.waktu.strftime("%H:%M | %d/%m/%Y") if self.waktu else ''
        }

# ===========================================================================
# 4. SKRIP AUTO-MIGRATION STRUKTUR BASIS DATA MYSQL (ANTI-ERROR 1054)
# ===========================================================================
def auto_migrate_database():
    """
    Secara otomatis memeriksa dan menambahkan kolom-kolom baru pada tabel MySQL
    jika tabel sudah ada dari versi sebelumnya sehingga mencegah Error 1054.
    """
    try:
        with app.app_context():
            db.create_all()
            with db.engine.connect() as conn:
                # 1. Pengecekan Kolom Tabel 'warga'
                cols_warga = [r[0] for r in conn.execute(db.text("SHOW COLUMNS FROM warga"))]
                if 'status_salur' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN status_salur VARCHAR(50) DEFAULT 'Pending'"))
                if 'bukti_salur' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN bukti_salur VARCHAR(255) NULL"))
                if 'tempat_lahir' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN tempat_lahir VARCHAR(50) NULL DEFAULT 'Sidoarjo'"))
                if 'tanggal_lahir' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN tanggal_lahir DATE NULL"))
                if 'latitude' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN latitude VARCHAR(50) NULL"))
                if 'longitude' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN longitude VARCHAR(50) NULL"))
                if 'c1_ekonomi' not in cols_warga:
                    conn.execute(db.text("ALTER TABLE warga ADD COLUMN c1_ekonomi FLOAT DEFAULT 0.0"))

                # 2. Pengecekan Kolom Tabel 'user'
                cols_user = [r[0] for r in conn.execute(db.text("SHOW COLUMNS FROM user"))]
                if 'email' not in cols_user:
                    conn.execute(db.text("ALTER TABLE user ADD COLUMN email VARCHAR(100) NULL"))
                if 'created_at' not in cols_user:
                    conn.execute(db.text("ALTER TABLE user ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))

                # 3. Pengecekan Kolom Tabel 'chat_keluhan'
                cols_chat = [r[0] for r in conn.execute(db.text("SHOW COLUMNS FROM chat_keluhan"))]
                if 'is_pinned' not in cols_chat:
                    conn.execute(db.text("ALTER TABLE chat_keluhan ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
                if 'reaction' not in cols_chat:
                    conn.execute(db.text("ALTER TABLE chat_keluhan ADD COLUMN reaction VARCHAR(10) NULL"))

                # 4. Pengecekan Kolom Tabel 'notifikasi'
                cols_notif = [r[0] for r in conn.execute(db.text("SHOW COLUMNS FROM notifikasi"))]
                if 'is_pinned' not in cols_notif:
                    conn.execute(db.text("ALTER TABLE notifikasi ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
                if 'is_archived' not in cols_notif:
                    conn.execute(db.text("ALTER TABLE notifikasi ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))

                conn.commit()
                print("[Auto-Migration] Struktur basis data terverifikasi dan sinkron.")
    except Exception as e:
        print(f"[Auto-Migration Notice] {e}")

# ===========================================================================
# 5. MIDDLEWARE AUTENTIKASI JWT & OTORISASI PERAN (PERBAIKAN EKSTRAKSI TOKEN)
# ===========================================================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Izinkan Permintaan CORS Preflight (OPTIONS) tanpa token
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

        # 2. Ekstraksi Token dari Header Authorization
        auth_header = request.headers.get('Authorization', '').strip()
        token = None

        if auth_header.startswith('Bearer '):
            parts = auth_header.split(' ', 1)
            if len(parts) > 1:
                token = parts.strip()  # PERBAIKAN: Mengambil string token murni (indeks 1)
        elif request.args.get('token'):
            token = request.args.get('token').strip()

        # 3. Validasi Keberadaan Token
        if not token or token == 'null' or token == 'undefined':
            return jsonify({
                "status": "error",
                "message": "Token autentikasi tidak ditemukan. Silakan login kembali."
            }), 401

        # 4. Dekode dan Validasi Tanda Tangan JWT
        try:
            payload = jwt.decode(
                token, 
                app.config['SECRET_KEY'], 
                algorithms=['HS256']
            )
            user_obj = User.query.get(payload.get('user_id'))
            if not user_obj:
                return jsonify({
                    "status": "error",
                    "message": "Akun pengguna tidak terdaftar dalam basis data."
                }), 401

            # Simpan Konteks Pengguna Aktif
            request.current_user = {
                "id": user_obj.id,
                "username": user_obj.username,
                "role": user_obj.role
            }
        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "message": "Sesi autentikasi telah berakhir. Silakan login kembali."
            }), 401
        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Token autentikasi tidak valid: {str(e)}"
            }), 401

        return f(*args, **kwargs)
    return decorated


def roles_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Izinkan Permintaan CORS Preflight (OPTIONS)
            if request.method == 'OPTIONS':
                return jsonify({'status': 'ok'}), 200

            current_role = getattr(request, 'current_user', {}).get('role')
            if current_role not in allowed_roles:
                return jsonify({
                    "status": "error",
                    "message": "Akses ditolak: Hak akses akun Anda tidak mencukupi untuk tindakan ini."
                }), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ===========================================================================
# 6. ENDPOINT AUTENTIKASI, LOGIN & INISIALISASI
# ===========================================================================
@app.route('/', methods=['GET'])
def index_status():
    return jsonify({
        "status": "success",
        "app_name": "API SPK Bansos Kabupaten Sidoarjo",
        "version": "2.4.0",
        "database_connected": True,
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })


@app.route('/init-kriteria', methods=['GET', 'OPTIONS'])
def init_kriteria():
    auto_migrate_database()

    # Inisialisasi 10 Kriteria Penilaian BWM-SAW jika belum ada
    if Kriteria.query.count() == 0:
        db.session.add_all([
            Kriteria(kode='C1', nama='Kondisi Ekonomi', bobot=0.15, jenis='cost'),
            Kriteria(kode='C2', nama='Kepemilikan Aset', bobot=0.10, jenis='cost'),
            Kriteria(kode='C3', nama='Usia Kepala Keluarga', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C5', nama='Jumlah Tanggungan', bobot=0.15, jenis='benefit'),
            Kriteria(kode='C6', nama='Status Pernikahan', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C7', nama='Kepemilikan Anak Sekolah', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C8', nama='Status Tempat Tinggal', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C9', nama='Pendidikan Terakhir', bobot=0.10, jenis='cost'),
            Kriteria(kode='C10', nama='Kesehatan / Disabilitas', bobot=0.10, jenis='benefit')
        ])

    # Akun Default Super Admin
    if not User.query.filter_by(username='admin').first():
        db.session.add(User(
            username='admin',
            email='admin@sidoarjo.go.id',
            password=bcrypt.generate_password_hash('admin123').decode('utf-8'),
            role='admin'
        ))

    # Akun Default Petugas Lapangan
    if not User.query.filter_by(username='petugas').first():
        db.session.add(User(
            username='petugas',
            email='petugas@sidoarjo.go.id',
            password=bcrypt.generate_password_hash('12345').decode('utf-8'),
            role='operator'
        ))

    db.session.commit()
    return jsonify({
        "status": "success",
        "message": "Database, Akun Pengguna, dan 10 Kriteria Berhasil Disiapkan!"
    })


@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    now = datetime.utcnow()
    user_attempt = LOGIN_ATTEMPTS.get(username)
    if user_attempt and user_attempt.get('locked_until') and now < user_attempt['locked_until']:
        remaining = int((user_attempt['locked_until'] - now).total_seconds() // 60) + 1
        return jsonify({
            "status": "fail",
            "message": f"Akun terkunci sementara karena percobaan gagal berulang. Coba lagi dalam {remaining} menit."
        }), 403

    user_obj = User.query.filter_by(username=username).first()
    if user_obj and bcrypt.check_password_hash(user_obj.password, password):
        LOGIN_ATTEMPTS.pop(username, None)
        token_payload = {
            'user_id': user_obj.id,
            'username': user_obj.username,
            'role': user_obj.role,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')
        if isinstance(token, bytes):
            token = token.decode('utf-8')

        return jsonify({
            "status": "success",
            "access_token": token,
            "data": {
                "username": user_obj.username,
                "role": user_obj.role
            }
        })

    # Catat Percobaan Gagal
    if username not in LOGIN_ATTEMPTS:
        LOGIN_ATTEMPTS[username] = {'count': 1, 'locked_until': None}
    else:
        LOGIN_ATTEMPTS[username]['count'] += 1
        if LOGIN_ATTEMPTS[username]['count'] >= 5:
            LOGIN_ATTEMPTS[username]['locked_until'] = now + timedelta(minutes=15)

    return jsonify({
        "status": "fail",
        "message": "Username atau Kata Sandi tidak sesuai!"
    }), 401


@app.route('/reset-password', methods=['POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def reset_password():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    new_password = data.get('new_password', '').strip()

    user_obj = User.query.filter_by(username=username).first()
    if not user_obj:
        return jsonify({
            "status": "error",
            "message": f"Pengguna '{username}' tidak ditemukan dalam sistem."
        }), 404

    user_obj.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()
    return jsonify({
        "status": "success",
        "message": f"Kata sandi untuk pengguna {username} berhasil diperbarui."
    })

# ===========================================================================
# 7. ENDPOINT PENGELOLAAN PENGGUNA (KELOLA PENGGUNA)
# ===========================================================================
@app.route('/users', methods=['GET', 'POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def manage_users():
    if request.method == 'GET':
        users = User.query.order_by(User.id.asc()).all()
        return jsonify([u.to_dict() for u in users])

    elif request.method == 'POST':
        d = request.get_json() or {}
        username = d.get('username', '').strip()
        password = d.get('password', '').strip()
        role = d.get('role', 'operator')
        email = d.get('email', f"{username}@sidoarjo.go.id").strip()

        if not username or not password:
            return jsonify({
                "status": "error",
                "message": "Username dan kata sandi wajib diisi."
            }), 400

        if User.query.filter_by(username=username).first():
            return jsonify({
                "status": "error",
                "message": f"Username '{username}' sudah terdaftar dalam sistem."
            }), 400

        new_u = User(
            username=username,
            email=email,
            password=bcrypt.generate_password_hash(password).decode('utf-8'),
            role=role
        )
        try:
            db.session.add(new_u)
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": f"Akun pengguna {username} ({role}) berhasil dibuat!"
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/users/<int:id>', methods=['DELETE', 'PUT', 'OPTIONS'])
@token_required
@roles_required('admin')
def handle_single_user(id):
    u = User.query.get_or_404(id)

    if request.method == 'DELETE':
        if u.username == 'admin':
            return jsonify({
                "status": "error",
                "message": "Akun Super Admin utama tidak dapat dihapus demi keamanan sistem."
            }), 400
        try:
            db.session.delete(u)
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": f"Akun pengguna '{u.username}' berhasil dihapus."
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    elif request.method == 'PUT':
        d = request.get_json() or {}
        if d.get('username'):
            u.username = d['username'].strip()
        if d.get('email'):
            u.email = d['email'].strip()
        if d.get('role'):
            u.role = d['role']
        if d.get('password') and len(d['password'].strip()) > 0:
            u.password = bcrypt.generate_password_hash(d['password'].strip()).decode('utf-8')

        try:
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": "Informasi akun pengguna berhasil diperbarui."
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 8. BOBOT KRITERIA BWM & PERHITUNGAN SPK (SAW vs WEIGHTED PRODUCT)
# ===========================================================================
KRITERIA_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']

def get_mapped_value(w, k):
    """Pemetaan nilai atribut numerik warga untuk komputasi matriks keputusan."""
    mapping = {
        'C1': max(w.c1_ekonomi, 1.0),
        'C2': max(w.c2_aset, 1.0),
        'C3': max(w.c3_umur, 1.0),
        'C4': max(w.c4_jenis_kelamin, 1.0),
        'C5': max(w.c5_tanggungan, 1.0),
        'C6': max(w.c6_status_pernikahan, 1.0),
        'C7': max(w.c7_kepemilikan_anak, 1.0),
        'C8': max(w.c8_tempat_tinggal, 1.0),
        'C9': max(w.c9_pendidikan, 1.0),
        'C10': max(w.c10_kesehatan, 1.0)
    }
    return mapping.get(k, 1.0)


def hitung_saw_logic():
    """Perhitungan SPK menggunakan metode Simple Additive Weighting (SAW)."""
    warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list:
        return {'hasil_akhir': [], 'matriks_normalisasi': []}

    bobot = {k.kode: k.bobot for k in kriteria_list}
    jenis = {k.kode: k.jenis for k in kriteria_list}

    raw_data = []
    for w in warga_list:
        row = {'nama': w.nama, 'nik': w.nik}
        for k in KRITERIA_KEYS:
            row[k] = get_mapped_value(w, k)
        raw_data.append(row)

    min_max = {}
    for k in KRITERIA_KEYS:
        vals = [d[k] for d in raw_data]
        min_max[k] = {
            'min': min(vals) if vals else 1.0,
            'max': max(vals) if vals else 1.0
        }

    matriks_normalisasi = []
    hasil_akhir = []

    for w in raw_data:
        skor_total = 0.0
        norm_row = {'nama': w['nama'], 'nik': w['nik']}
        for k in KRITERIA_KEYS:
            val = w[k]
            if jenis[k] == 'cost':
                r = (min_max[k]['min'] / val) if val > 0 else 1.0
            else:
                r = (val / min_max[k]['max']) if min_max[k]['max'] > 0 else 0.0

            norm_row[k] = round(r, 4)
            skor_total += r * bobot.get(k, 0.0)

        matriks_normalisasi.append(norm_row)
        hasil_akhir.append({
            'nama': w['nama'],
            'nik': w['nik'],
            'skor_akhir': round(skor_total, 4)
        })

    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    total_warga = len(hasil_akhir)

    for idx, item in enumerate(hasil_akhir):
        desil_calc = min(10, max(1, math.ceil(((idx + 1) / total_warga) * 10))) if total_warga > 0 else 1
        item['desil'] = desil_calc
        if desil_calc <= 4:
            item['prioritas'] = "Diprioritaskan"
            item['menerima'] = "Menerima"
        else:
            item['prioritas'] = "Tidak Diprioritaskan"
            item['menerima'] = "Tidak Menerima"

    return {
        'metode': 'SAW (Dengan Bobot BWM)',
        'kriteria': [k.to_dict() for k in kriteria_list],
        'min_max': min_max,
        'matriks_keputusan': raw_data,
        'matriks_normalisasi': matriks_normalisasi,
        'hasil_akhir': hasil_akhir
    }


def hitung_wp_logic():
    """Perhitungan SPK menggunakan metode komparasi Weighted Product (WP)."""
    warga = Warga.query.all()
    kriteria = Kriteria.query.all()
    if not warga or not kriteria:
        return {'hasil_akhir': []}

    total_w = sum(k.bobot for k in kriteria) or 1.0
    w_norm = {k.kode: (k.bobot / total_w) for k in kriteria}
    jenis = {k.kode: k.jenis for k in kriteria}

    s_vector = []
    total_s = 0.0

    for w in warga:
        s = 1.0
        for k in KRITERIA_KEYS:
            val = get_mapped_value(w, k)
            pangkat = -w_norm[k] if jenis[k] == 'cost' else w_norm[k]
            s *= math.pow(val, pangkat)
        s_vector.append({'nama': w.nama, 'nik': w.nik, 's': s})
        total_s += s

    hasil_akhir = []
    for item in s_vector:
        v = (item['s'] / total_s) if total_s > 0 else 0.0
        hasil_akhir.append({
            'nama': item['nama'],
            'nik': item['nik'],
            'skor_akhir': round(v, 4)
        })

    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    return {'hasil_akhir': hasil_akhir}


@app.route('/kriteria', methods=['GET', 'POST', 'OPTIONS'])
@token_required
def manage_kriteria():
    if request.method == 'POST':
        data = request.get_json() or []
        for i in data:
            k = Kriteria.query.filter_by(kode=i.get('kode')).first()
            if k:
                k.bobot = safe_float(i.get('bobot'), k.bobot)
                if i.get('jenis'):
                    k.jenis = i['jenis']
        try:
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": "Vektor bobot kriteria BWM berhasil diperbarui!"
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    kriteria_all = Kriteria.query.all()
    return jsonify([k.to_dict() for k in kriteria_all])


@app.route('/hitung-saw', methods=['GET', 'OPTIONS'])
@token_required
def get_hitung_saw():
    return jsonify(hitung_saw_logic())


@app.route('/komparasi', methods=['GET', 'OPTIONS'])
@token_required
def komparasi_metode():
    saw_data = hitung_saw_logic()
    wp_data = hitung_wp_logic()

    data_saw = {
        x['nik']: {
            'skor': x['skor_akhir'],
            'rank': i + 1,
            'nama': x['nama'],
            'desil': x['desil'],
            'prioritas': x['prioritas'],
            'menerima': x['menerima']
        }
        for i, x in enumerate(saw_data.get('hasil_akhir', []))
    }
    data_wp = {
        x['nik']: {
            'skor': x['skor_akhir'],
            'rank': i + 1
        }
        for i, x in enumerate(wp_data.get('hasil_akhir', []))
    }

    res = []
    for nik, val in data_saw.items():
        res.append({
            'nama': val['nama'],
            'nik': nik,
            'saw_skor': val['skor'],
            'saw_rank': val['rank'],
            'wp_skor': data_wp.get(nik, {}).get('skor', 0),
            'wp_rank': data_wp.get(nik, {}).get('rank', 0),
            'desil': val['desil'],
            'prioritas': val['prioritas'],
            'menerima': val['menerima']
        })
    res.sort(key=lambda x: x['saw_rank'])
    return jsonify(res)


@app.route('/api/laporan-chat', methods=['GET', 'OPTIONS'])
@token_required
def get_laporan_chat():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.id.desc()).limit(50).all()
    return jsonify([c.to_dict() for c in chats])

# ===========================================================================
# 9. CRUD DATA WARGA, FOTO BUKTI, SENGKETA, & BULK IMPORT
# ===========================================================================
@app.route('/warga', methods=['GET', 'POST', 'OPTIONS'])
@token_required
def manage_warga():
    if request.method == 'GET':
        warga_all = Warga.query.order_by(Warga.id.desc()).all()
        return jsonify([w.to_dict() for w in warga_all])

    elif request.method == 'POST':
        d = request.get_json() or {}
        if not d.get('nik') or not d.get('nama'):
            return jsonify({"status": "error", "message": "Nama dan NIK wajib diisi."}), 400

        if Warga.query.filter_by(nik=d['nik']).first():
            return jsonify({"status": "error", "message": f"NIK {d['nik']} sudah terdaftar."}), 400

        tgl = None
        if d.get('tanggal_lahir'):
            try:
                tgl = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
            except:
                tgl = None

        new_w = Warga(
            nama=d['nama'].strip(),
            nik=d['nik'].strip(),
            no_hp=d.get('no_hp', '').strip(),
            email=d.get('email', '').strip(),
            tempat_lahir=d.get('tempat_lahir', 'Sidoarjo').strip(),
            tanggal_lahir=tgl,
            alamat=d.get('alamat', 'Sidoarjo').strip(),
            latitude=d.get('lat', '').strip(),
            longitude=d.get('lng', '').strip(),
            c1_ekonomi=safe_float(d.get('c1', d.get('c1_ekonomi'))),
            c2_aset=safe_int(d.get('c2', d.get('c2_aset'))),
            c3_umur=safe_int(d.get('c3', d.get('c3_umur'))),
            c4_jenis_kelamin=safe_int(d.get('c4', d.get('c4_jenis_kelamin', 1))),
            c5_tanggungan=safe_int(d.get('c5', d.get('c5_tanggungan'))),
            c6_status_pernikahan=safe_int(d.get('c6', d.get('c6_status_pernikahan', 1))),
            c7_kepemilikan_anak=safe_int(d.get('c7', d.get('c7_kepemilikan_anak'))),
            c8_tempat_tinggal=safe_int(d.get('c8', d.get('c8_tempat_tinggal', 1))),
            c9_pendidikan=safe_int(d.get('c9', d.get('c9_pendidikan', 1))),
            c10_kesehatan=safe_int(d.get('c10', d.get('c10_kesehatan', 1))),
            catatan=d.get('catatan', '').strip()
        )
        try:
            db.session.add(new_w)
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": f"Data warga '{new_w.nama}' berhasil ditambahkan ke arsip!"
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/<int:id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
@token_required
def action_warga(id):
    w = Warga.query.get_or_404(id)

    if request.method == 'GET':
        return jsonify(w.to_dict())

    elif request.method == 'DELETE':
        try:
            nama_terhapus = w.nama
            db.session.delete(w)
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": f"Data warga '{nama_terhapus}' berhasil dihapus dari arsip."
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    elif request.method == 'PUT':
        d = request.get_json() or {}
        w.nama = d.get('nama', w.nama).strip()
        w.nik = d.get('nik', w.nik).strip()
        w.no_hp = d.get('no_hp', w.no_hp)
        w.email = d.get('email', w.email)
        w.alamat = d.get('alamat', w.alamat)
        w.tempat_lahir = d.get('tempat_lahir', w.tempat_lahir)
        w.latitude = d.get('lat', d.get('latitude', w.latitude))
        w.longitude = d.get('lng', d.get('longitude', w.longitude))

        if d.get('tanggal_lahir'):
            try:
                w.tanggal_lahir = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
            except:
                pass

        w.c1_ekonomi = safe_float(d.get('c1', d.get('c1_ekonomi', w.c1_ekonomi)))
        w.c2_aset = safe_int(d.get('c2', d.get('c2_aset', w.c2_aset)))
        w.c3_umur = safe_int(d.get('c3', d.get('c3_umur', w.c3_umur)))
        w.c4_jenis_kelamin = safe_int(d.get('c4', d.get('c4_jenis_kelamin', w.c4_jenis_kelamin)))
        w.c5_tanggungan = safe_int(d.get('c5', d.get('c5_tanggungan', w.c5_tanggungan)))
        w.c6_status_pernikahan = safe_int(d.get('c6', d.get('c6_status_pernikahan', w.c6_status_pernikahan)))
        w.c7_kepemilikan_anak = safe_int(d.get('c7', d.get('c7_kepemilikan_anak', w.c7_kepemilikan_anak)))
        w.c8_tempat_tinggal = safe_int(d.get('c8', d.get('c8_tempat_tinggal', w.c8_tempat_tinggal)))
        w.c9_pendidikan = safe_int(d.get('c9', d.get('c9_pendidikan', w.c9_pendidikan)))
        w.c10_kesehatan = safe_int(d.get('c10', d.get('c10_kesehatan', w.c10_kesehatan)))
        w.catatan = d.get('catatan', w.catatan)

        try:
            db.session.commit()
            return jsonify({
                "status": "success",
                "message": f"Data warga '{w.nama}' berhasil diperbarui."
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/<int:id>/verify', methods=['PATCH', 'OPTIONS'])
@token_required
def verify_warga(id):
    w = Warga.query.get_or_404(id)
    w.is_verified = not w.is_verified
    w.tanggal_verifikasi = datetime.now().date() if w.is_verified else None
    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "is_verified": w.is_verified,
            "message": f"Status verifikasi warga '{w.nama}' diperbarui."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/delete-all', methods=['DELETE', 'POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def delete_all_warga():
    try:
        total_dihapus = Warga.query.count()
        Warga.query.delete()
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Seluruh data ({total_dihapus} warga) berhasil dikosongkan dari basis data."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/<int:id>/bukti-salur', methods=['POST', 'OPTIONS'])
@token_required
def upload_bukti_salur(id):
    w = Warga.query.get_or_404(id)
    file = request.files.get('file')
    if not file or file.filename == '':
        return jsonify({"status": "error", "message": "Berkas foto bukti diperlukan."}), 400

    if not allowed_file(file.filename):
        return jsonify({"status": "error", "message": "Format gambar tidak didukung."}), 400

    ext = file.filename.rsplit('.', 1).lower()
    unique_name = f"bukti_{id}_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}.{ext}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
    file.save(save_path)

    w.bukti_salur = unique_name
    w.status_salur = 'Telah Menerima'

    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Dokumentasi foto penyaluran bansos berhasil disimpan!",
            "bukti_salur": unique_name
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/<int:id>/lapor-sengketa', methods=['POST', 'OPTIONS'])
@token_required
def lapor_sengketa_salur(id):
    w = Warga.query.get_or_404(id)
    data = request.get_json() or {}
    aksi = data.get('aksi', 'sengketa')
    keterangan = data.get('keterangan', 'Warga melapor belum menerima bantuan fisik.')

    if aksi == 'sengketa':
        w.status_salur = 'Sengketa: Belum Terima'
        w.catatan = f"[⚠️ SENGKETA {datetime.now().strftime('%d/%m/%Y %H:%M')}] {keterangan} | {w.catatan or ''}"
        db.session.add(Notifikasi(
            pesan=f"🚨 SENGKETA: Warga {w.nama} (NIK: {w.nik}) melapor belum menerima bansos fisik!",
            role_target='all'
        ))
    else:
        w.status_salur = 'Telah Menerima'
        w.catatan = f"[✅ SENGKETA SELESAI] {w.catatan or ''}"

    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Status laporan sengketa warga berhasil diperbarui."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/bulk', methods=['POST', 'OPTIONS'])
@token_required
def bulk_insert():
    data_list = (request.get_json() or {}).get('data', [])
    count = 0

    for d in data_list:
        nik = str(d.get('nik', d.get('NIK', ''))).strip()
        if nik and not Warga.query.filter_by(nik=nik).first():
            tgl_lhr = None
            if d.get('tanggal_lahir') or d.get('Tanggal Lahir'):
                try:
                    tgl_str = str(d.get('tanggal_lahir', d.get('Tanggal Lahir', '')))[:10]
                    tgl_lhr = datetime.strptime(tgl_str, '%Y-%m-%d').date()
                except:
                    tgl_lhr = None

            new_w = Warga(
                nama=str(d.get('nama', d.get('Nama', d.get('Nama Lengkap', 'Tanpa Nama')))).strip(),
                nik=nik,
                no_hp=str(d.get('no_hp', d.get('No WA', d.get('No. WhatsApp / HP', '')))).strip(),
                email=str(d.get('email', d.get('Email', ''))).strip(),
                tempat_lahir=str(d.get('tempat_lahir', d.get('Tempat Lahir', 'Sidoarjo'))).strip(),
                tanggal_lahir=tgl_lhr,
                alamat=str(d.get('alamat', d.get('Alamat Lengkap', 'Sidoarjo'))).strip(),
                latitude=str(d.get('lat', d.get('latitude', d.get('Latitude', '')))).strip(),
                longitude=str(d.get('lng', d.get('longitude', d.get('Longitude', '')))).strip(),
                c1_ekonomi=safe_float(d.get('C1', d.get('c1', d.get('c1_ekonomi', d.get('C1 (Penghasilan Bulanan Rp)', 0))))),
                c2_aset=safe_int(d.get('C2', d.get('c2', d.get('c2_aset', d.get('C2 (Nilai Aset Rp)', 0))))),
                c3_umur=safe_int(d.get('C3', d.get('c3', d.get('c3_umur', d.get('C3 (Usia / Umur Tahun)', 0))))),
                c4_jenis_kelamin=safe_int(d.get('C4', d.get('c4', d.get('c4_jenis_kelamin', d.get('C4 (Jenis Kelamin: 1=L, 2=P)', 1))))),
                c5_tanggungan=safe_int(d.get('C5', d.get('c5', d.get('c5_tanggungan', d.get('C5 (Jumlah Tanggungan)', 0))))),
                c6_status_pernikahan=safe_int(d.get('C6', d.get('c6', d.get('c6_status_pernikahan', d.get('C6 (Status Pernikahan: 1=Belum, 2=Menikah, 3=Cerai)', 1))))),
                c7_kepemilikan_anak=safe_int(d.get('C7', d.get('c7', d.get('c7_kepemilikan_anak', d.get('C7 (Kepemilikan Anak Sekolah)', 0))))),
                c8_tempat_tinggal=safe_int(d.get('C8', d.get('c8', d.get('c8_tempat_tinggal', d.get('C8 (Tempat Tinggal: 1=Milik, 2=Sewa, 3=Numpang)', 1))))),
                c9_pendidikan=safe_int(d.get('C9', d.get('c9', d.get('c9_pendidikan', d.get('C9 (Pendidikan: 1=SD, 2=SMP, 3=SMA, 4=PT)', 1))))),
                c10_kesehatan=safe_int(d.get('C10', d.get('c10', d.get('c10_kesehatan', d.get('C10 (Kesehatan: 1=Sehat, 2=Sakit/Disabilitas)', 1))))),
                catatan=str(d.get('catatan', d.get('Catatan Lapangan Tambahan', 'Import Excel'))),
                status_salur=str(d.get('status_salur', 'Pending')),
                is_verified=(str(d.get('status_validasi', '')).lower() == 'disetujui')
            )
            db.session.add(new_w)
            count += 1

    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"{count} baris data warga berhasil diimpor ke basis data!"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/bulk/delete', methods=['POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def bulk_delete():
    ids = (request.get_json() or {}).get('ids', [])
    try:
        Warga.query.filter(Warga.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"{len(ids)} data warga terpilih berhasil dihapus."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/warga/bulk/verify', methods=['POST', 'OPTIONS'])
@token_required
def bulk_verify():
    ids = (request.get_json() or {}).get('ids', [])
    try:
        wargas = Warga.query.filter(Warga.id.in_(ids)).all()
        for w in wargas:
            w.is_verified = True
            w.tanggal_verifikasi = datetime.now().date()
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"{len(wargas)} data warga terpilih berhasil diverifikasi."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 10. ENDPOINT PUBLIC, DUKCAPIL, & SINKRONISASI BPS TERPADU
# ===========================================================================
@app.route('/api/dukcapil/<nik>', methods=['GET', 'OPTIONS'])
def check_dukcapil(nik):
    if len(nik) != 16 or not nik.isdigit():
        return jsonify({"status": "error", "message": "Format NIK harus 16 digit angka."}), 400
    try:
        tgl = int(nik[6:8])
        bln = int(nik[8:10])
        thn = int(nik[10:12])
        jk = "Perempuan" if tgl > 40 else "Laki-laki"
        if tgl > 40:
            tgl -= 40

        current_year_two_digit = datetime.now().year % 100
        thn_full = (2000 + thn) if thn <= current_year_two_digit else (1900 + thn)

        return jsonify({
            "status": "success",
            "data": {
                "nik": nik,
                "nama": f"Warga Dukcapil {nik[-4:]}",
                "tempat_lahir": "Sidoarjo",
                "tanggal_lahir": f"{thn_full}-{bln:02d}-{tgl:02d}",
                "jenis_kelamin": jk,
                "alamat": "Dsn. Sukamaju RT.01 RW.02, Waru, Sidoarjo"
            }
        })
    except Exception:
        return jsonify({"status": "error", "message": "Gagal membaca struktur NIK."}), 400


@app.route('/api/public/cek-bansos/<nik>', methods=['GET', 'OPTIONS'])
def public_cek_bansos(nik):
    w = Warga.query.filter_by(nik=nik).first()
    if not w:
        return jsonify({
            "status": "error",
            "message": "NIK Anda belum terdaftar dalam sistem penerima bansos."
        }), 404

    status_text = "Disetujui (Layak Menerima Bansos)" if w.is_verified else "Menunggu Diproses / Verifikasi Lapangan"
    status_level = 2 if w.is_verified else 1

    return jsonify({
        "status": "success",
        "data": {
            "nama": w.nama,
            "nik": w.nik,
            "alamat": w.alamat,
            "status": status_text,
            "level": status_level,
            "status_salur": w.status_salur
        }
    })


@app.route('/api/public/daftar', methods=['POST', 'OPTIONS'])
def public_daftar():
    d = request.get_json() or {}
    if not d.get('nik') or not d.get('nama'):
        return jsonify({"status": "error", "message": "NIK dan Nama wajib diisi."}), 400

    if Warga.query.filter_by(nik=d['nik']).first():
        return jsonify({"status": "error", "message": "NIK ini sudah terdaftar di sistem."}), 400

    is_in_bps = str(d['nik']).startswith('351501') or str(d['nik']).startswith('351502')
    catatan_public = f"[PENDAFTARAN MANDIRI] {d.get('catatan', '')}"
    if is_in_bps:
        catatan_public = "[✅ VALID BPS] " + catatan_public

    tgl_lhr = None
    if d.get('tanggal_lahir'):
        try:
            tgl_lhr = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
        except:
            tgl_lhr = None

    new_w = Warga(
        nama=d['nama'].strip(),
        nik=d['nik'].strip(),
        no_hp=d.get('no_hp', ''),
        email=d.get('email', ''),
        tempat_lahir=d.get('tempat_lahir', 'Sidoarjo'),
        tanggal_lahir=tgl_lhr,
        alamat=d.get('alamat', 'Sidoarjo'),
        c1_ekonomi=0.0,
        c2_aset=0,
        c3_umur=0,
        c4_jenis_kelamin=1,
        c5_tanggungan=0,
        c6_status_pernikahan=1,
        c7_kepemilikan_anak=0,
        c8_tempat_tinggal=1,
        c9_pendidikan=1,
        c10_kesehatan=1,
        catatan=catatan_public,
        is_verified=False
    )
    try:
        db.session.add(new_w)
        db.session.add(Notifikasi(
            pesan=f"Pendaftaran Mandiri: {d['nama']} (NIK: {d['nik']}) telah mendaftar secara online.",
            role_target='all'
        ))
        db.session.commit()
        if d.get('email'):
            send_email_notification(
                d.get('email'),
                "Pendaftaran Bansos Masuk Antrean",
                f"<h3>Halo, {d['nama']}</h3><p>Pendaftaran Bansos Mandiri Anda berhasil masuk antrean verifikasi Dinsos Sidoarjo.</p>"
            )
        return jsonify({
            "status": "success",
            "message": "Pendaftaran berhasil dikirim dan masuk antrean verifikasi."
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/bps/sync', methods=['POST', 'OPTIONS'])
@token_required
def sync_bps():
    import random
    dummy_bps_data = [
        {"nama": "Warga BPS Sidoarjo 1", "nik": f"351501{random.randint(1000000000, 9999999999)}", "c1": 850000, "alamat": "Waru, Sidoarjo"},
        {"nama": "Warga BPS Sidoarjo 2", "nik": f"351502{random.randint(1000000000, 9999999999)}", "c1": 700000, "alamat": "Candi, Sidoarjo"},
        {"nama": "Warga BPS Sidoarjo 3", "nik": f"351503{random.randint(1000000000, 9999999999)}", "c1": 600000, "alamat": "Porong, Sidoarjo"}
    ]
    for d in dummy_bps_data:
        if not Warga.query.filter_by(nik=d['nik']).first():
            db.session.add(Warga(
                nama=d['nama'],
                nik=d['nik'],
                alamat=d['alamat'],
                c1_ekonomi=d['c1'],
                c2_aset=5000000,
                c3_umur=45,
                c4_jenis_kelamin=1,
                c5_tanggungan=3,
                c6_status_pernikahan=2,
                c7_kepemilikan_anak=2,
                c8_tempat_tinggal=3,
                c9_pendidikan=2,
                c10_kesehatan=1,
                is_verified=False,
                catatan="Sinkronisasi Terpadu BPS Sidoarjo"
            ))
    try:
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Sinkronisasi data terpadu BPS Sidoarjo berhasil!"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 11. ENDPOINT LIVE CHAT & NOTIFIKASI REALTIME
# ===========================================================================
@app.route('/uploads/<path:filename>', methods=['GET', 'OPTIONS'])
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/chat/list', methods=['GET', 'OPTIONS'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.waktu.asc()).all()
    rooms = {}
    for c in chats:
        rooms[c.nik_warga] = {
            "nik": c.nik_warga,
            "nama": c.nama_warga,
            "last_msg": c.pesan if c.pesan else ("📷 Mengirim Foto" if c.file_type == 'image' else "🎥 Mengirim Video"),
            "waktu": c.waktu.strftime("%H:%M | %d/%m")
        }
    return jsonify(list(rooms.values())[::-1])


@app.route('/api/chat/<nik>', methods=['GET', 'POST', 'OPTIONS'])
def handle_chat_nik(nik):
    if request.method == 'GET':
        chats = ChatKeluhan.query.filter_by(nik_warga=nik).order_by(ChatKeluhan.waktu.asc()).all()
        return jsonify([c.to_dict() for c in chats])

    elif request.method == 'POST':
        sender = request.form.get('sender', 'warga')
        nama = request.form.get('nama', 'Warga')
        pesan = request.form.get('pesan', '')

        file = request.files.get('file')
        file_path = None
        file_type = None

        if file and file.filename != '':
            if not allowed_file(file.filename):
                return jsonify({"status": "error", "message": "Format berkas tidak diizinkan."}), 400

            ext = file.filename.rsplit('.', 1).lower()
            if ext in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
                file_type = 'image'
            elif ext in {'mp4', 'mov', 'avi', 'mkv', 'webm'}:
                file_type = 'video'
            elif ext in {'wav', 'mp3', 'ogg'}:
                file_type = 'audio'
            else:
                file_type = 'document'

            unique_name = f"{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.{ext}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(save_path)
            file_path = unique_name

        new_chat = ChatKeluhan(
            nik_warga=nik,
            nama_warga=nama,
            sender=sender,
            pesan=pesan,
            file_path=file_path,
            file_type=file_type
        )
        try:
            db.session.add(new_chat)
            if sender == 'warga':
                db.session.add(Notifikasi(
                    pesan=f"Laporan Chat Baru: {nama} ({nik}) mengirim pesan/lampiran.",
                    role_target='all'
                ))
            db.session.commit()
            return jsonify({"status": "success", "message": "Pesan berhasil terkirim."})
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/public/keluhan', methods=['POST', 'OPTIONS'])
def submit_keluhan():
    d = request.get_json() or {}
    pesan_keluhan = d.get('pesan', '').strip()
    nik = d.get('nik', 'Warga Umum')
    nama = d.get('nama', 'Anonim')

    if pesan_keluhan:
        new_k = ChatKeluhan(
            nik_warga=nik,
            nama_warga=nama,
            sender='warga',
            pesan=pesan_keluhan
        )
        try:
            db.session.add(new_k)
            db.session.add(Notifikasi(
                pesan=f"Pengaduan Baru dari {nama}: {pesan_keluhan[:40]}...",
                role_target='all'
            ))
            db.session.commit()
            return jsonify({"status": "success", "message": "Pengaduan berhasil disampaikan."})
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500
    return jsonify({"status": "error", "message": "Pesan pengaduan tidak boleh kosong."}), 400


@app.route('/api/notifikasi', methods=['GET', 'OPTIONS'])
@token_required
def get_notifikasi():
    role = request.current_user['role']
    query = Notifikasi.query.filter(Notifikasi.role_target.in_([role, 'all']))
    notifs = query.order_by(Notifikasi.is_pinned.desc(), Notifikasi.id.desc()).limit(30).all()
    return jsonify([n.to_dict() for n in notifs])


@app.route('/api/notifikasi/<int:id>/read', methods=['PATCH', 'OPTIONS'])
@token_required
def update_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_read = not notif.is_read
    try:
        db.session.commit()
        return jsonify({"status": "success", "is_read": notif.is_read})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 12. RUN SERVER FLASK (DENGAN AUTO-MIGRATION SAAT STARTUP)
# ===========================================================================
if __name__ == '__main__':
    auto_migrate_database()
    app.run(host='0.0.0.0', port=5000, debug=True)