"""
=============================================================================
SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANSOS SIDOARJO
DINAS SOSIAL - PEMERINTAH KABUPATEN SIDOARJO
METODE: BEST-WORST METHOD (BWM) & SIMPLE ADDITIVE WEIGHTING (SAW)
KOMPARASI: WEIGHTED PRODUCT (WP) & INTEGRASI DUKCAPIL / BPS SIDOARJO
=============================================================================
"""

import os
import re
import math
import smtplib
import uuid
import random
import traceback
from datetime import datetime, timedelta, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, make_response
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import jwt
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

# ===========================================================================
# 1. KONFIGURASI APLIKASI & DATABASE FLASK
# ===========================================================================
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'kunci_rahasia_pemkab_sidoarjo_2026_spk_saw_bwm')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 'mysql+mysqlconnector://root:@127.0.0.1:3306/bansos'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB Max Upload

# Folder Penyimpanan Berkas Statis Uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg', 'png', 'webp', 'gif',
    'mp4', 'mov', 'avi', 'mkv', 'webm',
    'pdf', 'xlsx', 'xls', 'csv', 'wav', 'mp3', 'ogg'
}

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Konfigurasi Cross-Origin Resource Sharing (CORS) Penuh
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,Accept")
        response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH,OPTIONS")
        return response, 200

# ===========================================================================
# 2. HELPER UTILITY & SANITASI DATA
# ===========================================================================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1).lower() in ALLOWED_EXTENSIONS

def safe_float(val, default=0.0):
    try:
        if val is None or val == '': return float(default)
        if isinstance(val, (int, float)): return float(val)
        s = str(val).strip()
        s = re.sub(r'[^\d.,-]', '', s)
        if s.count('.') > 1: s = s.replace('.', '')
        elif s.count('.') == 1 and s.count(',') == 1: s = s.replace('.', '').replace(',', '.')
        elif s.count('.') == 1 and len(s.split('.')) == 3: s = s.replace('.', '')
        elif s.count('.') == 1 and len(s.split(',')) == 3: s = s.replace(',', '')
        elif s.count('.') == 1: s = s.replace(',', '.')
        return float(s)
    except:
        return float(default)

def safe_int(val, default=0):
    try:
        if val is None or val == '': return int(default)
        if isinstance(val, int): return val
        if isinstance(val, float): return int(val)
        f = safe_float(val, default)
        return int(f)
    except:
        return int(default)

@app.errorhandler(HTTPException)
def handle_http_exception(e):
    return jsonify({"status": "error", "message": e.description}), e.code

@app.errorhandler(Exception)
def handle_generic_exception(e):
    traceback.print_exc()
    return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500

# ===========================================================================
# 3. STRUKTUR MODEL DATABASE MYSQL (SQLAlchemy)
# ===========================================================================
class Warga(db.Model):
    __tablename__ = 'warga'
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    nik = db.Column(db.String(20), unique=True, nullable=False)
    no_hp = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    tempat_lahir = db.Column(db.String(50), nullable=True, default='Sidoarjo')
    tanggal_lahir = db.Column(db.Date, nullable=True)
    alamat = db.Column(db.String(255), nullable=True, default='Sidoarjo')
    
    # 10 Kriteria BWM-SAW
    c1_ekonomi = db.Column(db.Float, nullable=False, default=0.0)          # Cost
    c2_aset = db.Column(db.Integer, nullable=False, default=0)              # Cost
    c3_umur = db.Column(db.Integer, nullable=False, default=0)              # Benefit
    c4_jenis_kelamin = db.Column(db.Integer, nullable=False, default=1)     # Benefit (1=L, 2=P)
    c5_tanggungan = db.Column(db.Integer, nullable=False, default=0)        # Benefit
    c6_status_pernikahan = db.Column(db.Integer, nullable=False, default=1) # Benefit (1=Belum, 2=Nikah, 3=Cerai)
    c7_kepemilikan_anak = db.Column(db.Integer, nullable=False, default=0)  # Benefit
    c8_tempat_tinggal = db.Column(db.Integer, nullable=False, default=1)    # Benefit (1=Milik, 2=Sewa, 3=Numpang)
    c9_pendidikan = db.Column(db.Integer, nullable=False, default=1)        # Cost (1=SD, 2=SMP, 3=SMA, 4=PT)
    c10_kesehatan = db.Column(db.Integer, nullable=False, default=1)        # Benefit (1=Sehat, 2=Sakit/Disabilitas)
    
    # Status Validasi & Lapangan
    is_verified = db.Column(db.Boolean, default=False)
    tanggal_verifikasi = db.Column(db.Date, nullable=True)
    foto_rumah = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)
    catatan = db.Column(db.Text, nullable=True)
    
    # Penyaluran & Sengketa
    status_salur = db.Column(db.String(50), default='Pending')
    bukti_salur = db.Column(db.String(255), nullable=True)
    nominal_bantuan = db.Column(db.String(100), nullable=True, default='Rp 600.000 / Beras 10 Kg')
    tanggal_salur = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator')  # 'admin' atau 'operator'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Kriteria(db.Model):
    __tablename__ = 'kriteria'
    id = db.Column(db.Integer, primary_key=True)
    kode = db.Column(db.String(5), unique=True, nullable=False)
    nama = db.Column(db.String(50), nullable=False)
    bobot = db.Column(db.Float, nullable=False)
    jenis = db.Column(db.String(10), nullable=False)  # 'benefit' atau 'cost'

class Notifikasi(db.Model):
    __tablename__ = 'notifikasi'
    id = db.Column(db.Integer, primary_key=True)
    pesan = db.Column(db.Text, nullable=False)
    role_target = db.Column(db.String(20), nullable=False, default='all')
    waktu = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)

class ChatKeluhan(db.Model):
    __tablename__ = 'chat_keluhan'
    id = db.Column(db.Integer, primary_key=True)
    nik_warga = db.Column(db.String(20), nullable=False)
    nama_warga = db.Column(db.String(100), nullable=False)
    sender = db.Column(db.String(20), nullable=False)  # 'admin' atau 'warga'
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)  # 'image', 'video', 'document', 'audio'
    is_pinned = db.Column(db.Boolean, default=False)
    reaction = db.Column(db.String(10), nullable=True)
    waktu = db.Column(db.DateTime, default=datetime.now)

# ===========================================================================
# 4. AUTO-MIGRASI STRUKTUR DATABASE MYSQL (MENCEGAH ERROR 1054 SECARA OTOMATIS)
# ===========================================================================
def auto_migrate_database():
    """Memeriksa dan otomatis menambahkan kolom yang kurang di MySQL tanpa merusak data yang ada."""
    try:
        with app.app_context():
            db.create_all()
            with db.engine.connect() as conn:
                result = conn.execute(db.text("SHOW COLUMNS FROM warga"))
                existing_cols = [row[0] for row in result.fetchall()]
                
                required_cols = {
                    'nominal_bantuan': "VARCHAR(100) DEFAULT 'Rp 600.000 / Beras 10 Kg'",
                    'status_salur': "VARCHAR(50) DEFAULT 'Pending'",
                    'bukti_salur': "VARCHAR(255) NULL",
                    'tanggal_salur': "DATETIME NULL",
                    'is_verified': "TINYINT(1) DEFAULT 0",
                    'tanggal_verifikasi': "DATE NULL",
                    'foto_rumah': "VARCHAR(255) NULL",
                    'latitude': "VARCHAR(50) NULL",
                    'longitude': "VARCHAR(50) NULL",
                    'catatan': "TEXT NULL",
                    'tempat_lahir': "VARCHAR(50) DEFAULT 'Sidoarjo'",
                    'tanggal_lahir': "DATE NULL",
                    'no_hp': "VARCHAR(20) NULL",
                    'email': "VARCHAR(100) NULL",
                    'c1_ekonomi': "FLOAT DEFAULT 0.0",
                    'c2_aset': "INT DEFAULT 0",
                    'c3_umur': "INT DEFAULT 0",
                    'c4_jenis_kelamin': "INT DEFAULT 1",
                    'c5_tanggungan': "INT DEFAULT 0",
                    'c6_status_pernikahan': "INT DEFAULT 1",
                    'c7_kepemilikan_anak': "INT DEFAULT 0",
                    'c8_tempat_tinggal': "INT DEFAULT 1",
                    'c9_pendidikan': "INT DEFAULT 1",
                    'c10_kesehatan': "INT DEFAULT 1",
                    'created_at': "DATETIME DEFAULT CURRENT_TIMESTAMP"
                }

                for col_name, col_def in required_cols.items():
                    if col_name not in existing_cols:
                        try:
                            conn.execute(db.text(f"ALTER TABLE warga ADD COLUMN {col_name} {col_def}"))
                            conn.commit()
                            print(f"[MIGRATION] Berhasil menambahkan kolom '{col_name}' ke tabel warga.")
                        except Exception as ex:
                            print(f"[MIGRATION] Kolom '{col_name}': {ex}")
    except Exception as e:
        print(f"[MIGRATION ERROR] {e}")

# ===========================================================================
# 5. DEKORATOR KEAMANAN & AUTENTIKASI JWT
# ===========================================================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

        auth_header = request.headers.get('Authorization', '').strip()
        token = None

        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif request.args.get('token'):
            token = request.args.get('token').strip()

        if not token or token == 'null' or token == 'undefined':
            return jsonify({"status": "error", "message": "Token autentikasi tidak ditemukan."}), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload.get('user_id')
            user_obj = User.query.filter_by(id=user_id).first() if user_id else None
            
            if not user_obj and payload.get('username'):
                user_obj = User.query.filter_by(username=payload.get('username')).first()

            if not user_obj:
                return jsonify({"status": "error", "message": "Pengguna tidak terdaftar."}), 401
                
            request.current_user = {
                "id": user_obj.id,
                "username": user_obj.username,
                "role": user_obj.role or 'operator'
            }
        except Exception as e:
            return jsonify({"status": "error", "message": f"Token tidak valid: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated

def roles_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if request.method == 'OPTIONS':
                return jsonify({'status': 'ok'}), 200
            current_role = getattr(request, 'current_user', {}).get('role')
            if current_role not in allowed_roles:
                return jsonify({"status": "error", "message": "Akses ditolak: Hanya untuk Administrator."}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ===========================================================================
# 6. INITIALIZATION & AUTENTIKASI LOGIN
# ===========================================================================
@app.route('/init-kriteria', methods=['GET', 'OPTIONS'])
def init_kriteria():
    try:
        auto_migrate_database()
        if Kriteria.query.count() == 0:
            db.session.add_all([
                Kriteria(kode='C1', nama='Kondisi Ekonomi', bobot=0.23, jenis='cost'),
                Kriteria(kode='C2', nama='Kepemilikan Aset', bobot=0.16, jenis='cost'),
                Kriteria(kode='C3', nama='Usia Kepala Keluarga', bobot=0.11, jenis='benefit'),
                Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
                Kriteria(kode='C5', nama='Jumlah Tanggungan', bobot=0.14, jenis='benefit'),
                Kriteria(kode='C6', nama='Status Pernikahan', bobot=0.07, jenis='benefit'),
                Kriteria(kode='C7', nama='Kepemilikan Anak Sekolah', bobot=0.09, jenis='benefit'),
                Kriteria(kode='C8', nama='Status Tempat Tinggal', bobot=0.10, jenis='benefit'),
                Kriteria(kode='C9', nama='Pendidikan Terakhir', bobot=0.03, jenis='cost'),
                Kriteria(kode='C10', nama='Kesehatan / Disabilitas', bobot=0.02, jenis='benefit')
            ])
        if not User.query.filter_by(username='admin').first():
            db.session.add(User(
                username='admin', email='admin@sidoarjo.go.id',
                password=bcrypt.generate_password_hash('admin123').decode('utf-8'),
                role='admin'
            ))
        if not User.query.filter_by(username='petugas').first():
            db.session.add(User(
                username='petugas', email='petugas@sidoarjo.go.id',
                password=bcrypt.generate_password_hash('12345').decode('utf-8'),
                role='operator'
            ))
        db.session.commit()
        return jsonify({"status": "success", "message": "Basis data & Akun bawaan siap digunakan!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password, password):
        token_payload = {
            'user_id': user.id, 'username': user.username, 'role': user.role,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm='HS256')
        if isinstance(token, bytes): token = token.decode('utf-8')
        return jsonify({
            "status": "success", "access_token": token,
            "data": {"username": user.username, "role": user.role}
        })
    return jsonify({"status": "fail", "message": "Username atau Password Salah!"}), 401

@app.route('/users', methods=['GET', 'POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def manage_users():
    try:
        if request.method == 'GET':
            users = User.query.order_by(User.id.asc()).all()
            return jsonify([{
                'id': u.id,
                'username': u.username,
                'email': u.email or f"{u.username}@sidoarjo.go.id",
                'role': u.role or 'operator',
                'created_at': u.created_at.strftime("%d/%m/%Y") if u.created_at else "-"
            } for u in users])
        elif request.method == 'POST':
            d = request.get_json(silent=True) or {}
            username = d.get('username', '').strip()
            password = d.get('password', '').strip()
            role = d.get('role', 'operator')
            if not username or not password:
                return jsonify({"status": "error", "message": "Username dan password wajib diisi."}), 400
            if User.query.filter_by(username=username).first():
                return jsonify({"status": "error", "message": "Username sudah terdaftar."}), 400
            new_u = User(
                username=username, email=d.get('email', f"{username}@sidoarjo.go.id"),
                password=bcrypt.generate_password_hash(password).decode('utf-8'),
                role=role
            )
            db.session.add(new_u)
            db.session.commit()
            return jsonify({"status": "success", "message": f"Akun {username} ({role}) berhasil dibuat!"})
    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/users/<int:id>', methods=['DELETE', 'PUT', 'OPTIONS'])
@token_required
@roles_required('admin')
def handle_single_user(id):
    try:
        u = User.query.get_or_404(id)
        if request.method == 'DELETE':
            if u.username == 'admin':
                return jsonify({"status": "error", "message": "Akun Super Admin utama tidak boleh dihapus."}), 400
            db.session.delete(u)
            db.session.commit()
            return jsonify({"status": "success", "message": "Akun berhasil dihapus."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 7. LOGIKA PERHITUNGAN SPK BWM-SAW & KOMPARASI WEIGHTED PRODUCT (WP)
# ===========================================================================
KRITERIA_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']

def get_mapped_value(w, k):
    mapping = {
        'C1': max(safe_float(w.c1_ekonomi), 1.0),
        'C2': max(safe_int(w.c2_aset), 1.0),
        'C3': max(safe_int(w.c3_umur), 1.0),
        'C4': max(safe_int(w.c4_jenis_kelamin, 1), 1.0),
        'C5': max(safe_int(w.c5_tanggungan), 1.0),
        'C6': max(safe_int(w.c6_status_pernikahan, 1), 1.0),
        'C7': max(safe_int(w.c7_kepemilikan_anak), 1.0),
        'C8': max(safe_int(w.c8_tempat_tinggal, 1), 1.0),
        'C9': max(safe_int(w.c9_pendidikan, 1), 1.0),
        'C10': max(safe_int(w.c10_kesehatan, 1), 1.0)
    }
    return mapping.get(k, 1.0)

def hitung_saw_logic():
    warga_list = Warga.query.filter_by(is_verified=True).all()
    if not warga_list:
        warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list:
        return {'hasil_akhir': [], 'matriks_normalisasi': []}

    bobot = {k.kode: k.bobot for k in kriteria_list}
    jenis = {k.kode: k.jenis for k in kriteria_list}

    raw_data = []
    for w in warga_list:
        row = {'nama': w.nama, 'nik': w.nik, 'alamat': w.alamat, 'id': w.id}
        for k in KRITERIA_KEYS: row[k] = get_mapped_value(w, k)
        raw_data.append(row)

    min_max = {}
    for k in KRITERIA_KEYS:
        vals = [d[k] for d in raw_data]
        min_max[k] = {'min': min(vals) if vals else 1.0, 'max': max(vals) if vals else 1.0}

    matriks_normalisasi, hasil_akhir = [], []
    for w in raw_data:
        skor_total = 0.0
        norm_row = {'nama': w['nama'], 'nik': w['nik']}
        for k in KRITERIA_KEYS:
            val = w[k]
            r = (min_max[k]['min'] / val) if jenis[k] == 'cost' and val > 0 else ((val / min_max[k]['max']) if min_max[k]['max'] > 0 else 0.0)
            norm_row[k] = round(r, 4)
            skor_total += r * bobot.get(k, 0.0)
        matriks_normalisasi.append(norm_row)
        hasil_akhir.append({'nama': w['nama'], 'nik': w['nik'], 'alamat': w['alamat'], 'skor_akhir': round(skor_total, 4)})

    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    total_warga = len(hasil_akhir)
    for idx, item in enumerate(hasil_akhir):
        desil_calc = min(10, max(1, math.ceil(((idx + 1) / total_warga) * 10))) if total_warga > 0 else 1
        item['desil'] = desil_calc
        
        if desil_calc <= 4:
            item['prioritas'] = "Prioritas Tinggi (Layak)"
            item['menerima'] = "Menerima Bansos"
        else:
            item['prioritas'] = "Tidak Diprioritaskan"
            item['menerima'] = "Tidak Menerima"

    return {
        'metode': 'SAW (Dengan Bobot BWM)',
        'kriteria': [{'kode': k.kode, 'nama': k.nama, 'jenis': k.jenis, 'bobot': k.bobot} for k in kriteria_list],
        'min_max': min_max, 'matriks_keputusan': raw_data,
        'matriks_normalisasi': matriks_normalisasi, 'hasil_akhir': hasil_akhir
    }

def hitung_wp_logic():
    warga = Warga.query.filter_by(is_verified=True).all()
    if not warga: warga = Warga.query.all()
    kriteria = Kriteria.query.all()
    if not warga or not kriteria: return {'hasil_akhir': []}
    total_w = sum(k.bobot for k in kriteria) or 1.0
    w_norm = {k.kode: (k.bobot / total_w) for k in kriteria}
    jenis = {k.kode: k.jenis for k in kriteria}

    s_vector, total_s = [], 0.0
    for w in warga:
        s = 1.0
        for k in KRITERIA_KEYS:
            val = get_mapped_value(w, k)
            pangkat = -w_norm[k] if jenis[k] == 'cost' else w_norm[k]
            s *= math.pow(val, pangkat)
        s_vector.append({'nama': w.nama, 'nik': w.nik, 's': s})
        total_s += s

    hasil_akhir = [{'nama': item['nama'], 'nik': item['nik'], 'skor_akhir': round((item['s'] / total_s), 4) if total_s > 0 else 0.0} for item in s_vector]
    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    return {'hasil_akhir': hasil_akhir}

@app.route('/kriteria', methods=['GET', 'POST', 'OPTIONS'])
@token_required
def manage_kriteria():
    if request.method == 'POST':
        data = request.get_json(silent=True) or []
        for i in data:
            k = Kriteria.query.filter_by(kode=i.get('kode')).first()
            if k:
                k.bobot = safe_float(i.get('bobot'), k.bobot)
                if i.get('jenis'): k.jenis = i['jenis']
        db.session.commit()
        return jsonify({"status": "success", "message": "Bobot kriteria berhasil disimpan!"})
    return jsonify([{'kode': k.kode, 'nama': k.nama, 'bobot': k.bobot, 'jenis': k.jenis} for k in Kriteria.query.all()])

@app.route('/hitung-saw', methods=['GET', 'OPTIONS'])
@token_required
def get_hitung_saw():
    return jsonify(hitung_saw_logic())

@app.route('/komparasi', methods=['GET', 'OPTIONS'])
@token_required
def komparasi_metode():
    saw_data = hitung_saw_logic()
    wp_data = hitung_wp_logic()
    data_saw = {x['nik']: {'skor': x['skor_akhir'], 'rank': i + 1, 'nama': x['nama'], 'desil': x['desil'], 'prioritas': x['prioritas'], 'menerima': x['menerima']} for i, x in enumerate(saw_data.get('hasil_akhir', []))}
    data_wp = {x['nik']: {'skor': x['skor_akhir'], 'rank': i + 1} for i, x in enumerate(wp_data.get('hasil_akhir', []))}

    res = []
    for nik, val in data_saw.items():
        res.append({
            'nama': val['nama'], 'nik': nik, 'saw_skor': val['skor'], 'saw_rank': val['rank'],
            'wp_skor': data_wp.get(nik, {}).get('skor', 0), 'wp_rank': data_wp.get(nik, {}).get('rank', 0),
            'desil': val['desil'], 'prioritas': val['prioritas'], 'menerima': val['menerima']
        })
    res.sort(key=lambda x: x['saw_rank'])
    return jsonify(res)

# ===========================================================================
# 8. CRUD DATA WARGA, ARSIP & PERSETUJUAN MASSAL
# ===========================================================================
@app.route('/warga', methods=['GET', 'POST', 'OPTIONS'])
@token_required
def manage_warga():
    try:
        if request.method == 'GET':
            warga_list = Warga.query.order_by(Warga.id.desc()).all()
            
            # Hitung perankingan SAW dan desil secara dinamis
            kriteria_list = Kriteria.query.all()
            total_warga = len(warga_list)
            desil_map = {}

            if warga_list and kriteria_list:
                bobot = {k.kode: k.bobot for k in kriteria_list}
                jenis = {k.kode: k.jenis for k in kriteria_list}
                
                raw_data = []
                for w in warga_list:
                    row = {'id': w.id}
                    for k in KRITERIA_KEYS:
                        row[k] = get_mapped_value(w, k)
                    raw_data.append(row)

                min_max = {}
                for k in KRITERIA_KEYS:
                    vals = [d[k] for d in raw_data]
                    min_max[k] = {'min': min(vals) if vals else 1.0, 'max': max(vals) if vals else 1.0}

                scores = []
                for w_item in raw_data:
                    skor = 0.0
                    for k in KRITERIA_KEYS:
                        val = w_item[k]
                        r = (min_max[k]['min'] / val) if jenis[k] == 'cost' and val > 0 else ((val / min_max[k]['max']) if min_max[k]['max'] > 0 else 0.0)
                        skor += r * bobot.get(k, 0.0)
                    scores.append({'id': w_item['id'], 'skor': skor})

                scores.sort(key=lambda x: x['skor'], reverse=True)
                for rank_idx, s in enumerate(scores):
                    desil_val = min(10, max(1, math.ceil(((rank_idx + 1) / total_warga) * 10))) if total_warga > 0 else 1
                    desil_map[s['id']] = desil_val

            return jsonify([{
                'id': w.id,
                'nama': w.nama or '',
                'nik': w.nik or '',
                'no_hp': w.no_hp or '',
                'email': w.email or '',
                'c1_ekonomi': safe_float(w.c1_ekonomi, 0.0),
                'c2_aset': safe_int(w.c2_aset, 0),
                'c3_umur': safe_int(w.c3_umur, 0),
                'c4_jenis_kelamin': safe_int(w.c4_jenis_kelamin, 1),
                'c5_tanggungan': safe_int(w.c5_tanggungan, 0),
                'c6_status_pernikahan': safe_int(w.c6_status_pernikahan, 1),
                'c7_kepemilikan_anak': safe_int(w.c7_kepemilikan_anak, 0),
                'c8_tempat_tinggal': safe_int(w.c8_tempat_tinggal, 1),
                'c9_pendidikan': safe_int(w.c9_pendidikan, 1),
                'c10_kesehatan': safe_int(w.c10_kesehatan, 1),
                'is_verified': bool(w.is_verified),
                'desil': desil_map.get(w.id, 5),
                'is_layak': (desil_map.get(w.id, 5) <= 4),
                'alamat': w.alamat or 'Sidoarjo',
                'tempat_lahir': w.tempat_lahir or 'Sidoarjo',
                'tanggal_lahir': str(w.tanggal_lahir) if w.tanggal_lahir else "",
                'catatan': w.catatan or '',
                'lat': w.latitude or '',
                'lng': w.longitude or '',
                'status_salur': w.status_salur or 'Pending',
                'bukti_salur': w.bukti_salur or '',
                'nominal_bantuan': w.nominal_bantuan or 'Rp 600.000 / Beras 10 Kg',
                'tanggal_salur': w.tanggal_salur.strftime("%d/%m/%Y %H:%M") if w.tanggal_salur else "-",
                'created_at': w.created_at.strftime("%d/%m/%Y %H:%M WIB") if w.created_at else datetime.now().strftime("%d/%m/%Y %H:%M WIB")
            } for w in warga_list])

        elif request.method == 'POST':
            d = request.get_json(silent=True) or {}
            nik = str(d.get('nik', '')).strip()
            nama = str(d.get('nama', '')).strip()
            if not nik or not nama:
                return jsonify({"status": "error", "message": "Nama dan NIK wajib diisi."}), 400
            if Warga.query.filter_by(nik=nik).first():
                return jsonify({"status": "error", "message": "NIK sudah terdaftar di sistem."}), 400
            
            tgl = None
            if d.get('tanggal_lahir'):
                try: tgl = datetime.strptime(str(d['tanggal_lahir'])[:10], '%Y-%m-%d').date()
                except: pass

            new_w = Warga(
                nama=nama,
                nik=nik,
                no_hp=str(d.get('no_hp', '')),
                email=str(d.get('email', '')),
                tempat_lahir=str(d.get('tempat_lahir', 'Sidoarjo')),
                tanggal_lahir=tgl,
                alamat=str(d.get('alamat', 'Sidoarjo')),
                latitude=str(d.get('lat', '')),
                longitude=str(d.get('lng', '')),
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
                catatan=str(d.get('catatan', ''))
            )
            db.session.add(new_w)
            db.session.commit()
            return jsonify({"status": "success", "message": "Data warga berhasil disimpan!"})
    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/warga/<int:id>', methods=['DELETE', 'PUT', 'OPTIONS'])
@token_required
def action_warga(id):
    try:
        w = Warga.query.get_or_404(id)
        if request.method == 'DELETE':
            db.session.delete(w)
            db.session.commit()
            return jsonify({"status": "success", "message": "Data berhasil dihapus."})
        elif request.method == 'PUT':
            d = request.get_json(silent=True) or {}
            w.nama = d.get('nama', w.nama).strip()
            w.nik = d.get('nik', w.nik).strip()
            w.no_hp = d.get('no_hp', w.no_hp)
            w.email = d.get('email', w.email)
            w.alamat = d.get('alamat', w.alamat)
            w.tempat_lahir = d.get('tempat_lahir', w.tempat_lahir)
            if d.get('tanggal_lahir'):
                try: w.tanggal_lahir = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
                except: pass
            db.session.commit()
            return jsonify({"status": "success", "message": "Data berhasil diperbarui."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/warga/<int:id>/verify', methods=['PATCH', 'OPTIONS'])
@token_required
def verify_warga(id):
    w = Warga.query.get_or_404(id)
    w.is_verified = not w.is_verified
    w.tanggal_verifikasi = datetime.now().date() if w.is_verified else None
    db.session.commit()
    return jsonify({"status": "success", "is_verified": w.is_verified})

@app.route('/warga/delete-all', methods=['DELETE', 'POST', 'OPTIONS'])
@token_required
@roles_required('admin')
def delete_all_warga():
    try:
        db.session.query(Warga).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Seluruh data arsip warga berhasil dikosongkan."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/warga/bulk/verify', methods=['POST', 'OPTIONS'])
@token_required
def bulk_verify():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.get_json(silent=True) or {}
        ids = data.get('ids', [])
        today_val = date.today()
        
        if ids and len(ids) > 0:
            wargas = Warga.query.filter(Warga.id.in_(ids)).all()
        else:
            wargas = Warga.query.all()
            
        for w in wargas:
            w.is_verified = True
            w.tanggal_verifikasi = today_val
            
        db.session.commit()
        return jsonify({
            "status": "success",
            "count": len(wargas),
            "message": f"Sebanyak {len(wargas)} data warga berhasil disetujui (Layak Bansos)!"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal persetujuan massal: {str(e)}"}), 500

@app.route('/warga/bulk/unverify', methods=['POST', 'OPTIONS'])
@token_required
def bulk_unverify():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.get_json(silent=True) or {}
        ids = data.get('ids', [])
        
        if ids and len(ids) > 0:
            wargas = Warga.query.filter(Warga.id.in_(ids)).all()
        else:
            wargas = Warga.query.all()
            
        for w in wargas:
            w.is_verified = False
            w.tanggal_verifikasi = None
            
        db.session.commit()
        return jsonify({
            "status": "success",
            "count": len(wargas),
            "message": f"Sebanyak {len(wargas)} data warga berhasil dikembalikan ke status Menunggu Validasi."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal membatalkan persetujuan: {str(e)}"}), 500

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
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
    w.bukti_salur = unique_name
    w.status_salur = 'Telah Menerima'
    w.tanggal_salur = datetime.now()
    db.session.commit()
    return jsonify({"status": "success", "message": "Foto bukti penyaluran berhasil disimpan!"})

@app.route('/warga/<int:id>/lapor-sengketa', methods=['POST', 'OPTIONS'])
@token_required
def lapor_sengketa_salur(id):
    w = Warga.query.get_or_404(id)
    data = request.get_json(silent=True) or {}
    aksi = data.get('aksi', 'sengketa')
    keterangan = data.get('keterangan', 'Warga melapor belum menerima bantuan fisik.')
    
    if aksi == 'sengketa':
        w.status_salur = 'Sengketa: Belum Terima'
        w.catatan = f"[⚠️ SENGKETA {datetime.now().strftime('%d/%m/%Y %H:%M')}] {keterangan} | {w.catatan or ''}"
    elif aksi == 'selesai':
        w.status_salur = 'Telah Menerima'
        w.tanggal_salur = datetime.now()
    elif aksi == 'investigasi':
        w.status_salur = 'Sengketa: Dalam Investigasi'
        
    db.session.commit()
    return jsonify({"status": "success", "message": f"Status sengketa berhasil diperbarui: {w.status_salur}"})

# ===========================================================================
# 9. SMART EXCEL IMPORTER (ROBUST MULTI-HEADER & UPSERT)
# ===========================================================================
def parse_excel_row(d):
    """Mendeteksi dan mengekstrak field warga dari baris JSON Excel secara fleksibel."""
    def get_val(*keys, default=''):
        for k in keys:
            for dk in d.keys():
                if str(dk).strip().lower() == k.lower():
                    if d[dk] is not None and str(d[dk]).strip() != '':
                        return d[dk]
        for k in keys:
            clean_k = re.sub(r'[^a-zA-Z0-9]', '', k.lower())
            for dk in d.keys():
                clean_dk = re.sub(r'[^a-zA-Z0-9]', '', str(dk).lower())
                if clean_dk == clean_k:
                    if d[dk] is not None and str(d[dk]).strip() != '':
                        return d[dk]
        for k in keys:
            clean_k = re.sub(r'[^a-zA-Z0-9]', '', k.lower())
            if len(clean_k) < 3: continue
            for dk in d.keys():
                clean_dk = re.sub(r'[^a-zA-Z0-9]', '', str(dk).lower())
                if clean_k in clean_dk or clean_dk in clean_k:
                    if d[dk] is not None and str(d[dk]).strip() != '':
                        return d[dk]
        return default

    raw_nik = get_val('nik', 'nomor induk', 'no ktp', 'nomor nik', default='')
    s_nik = str(raw_nik).strip()
    if s_nik.endswith('.0'): s_nik = s_nik[:-2]
    if 'e+' in s_nik.lower():
        try: s_nik = f"{int(float(s_nik))}"
        except: pass
    nik = re.sub(r'\D', '', s_nik)
    if not nik:
        return None

    nama = str(get_val('nama lengkap', 'nama pemohon', 'nama warga', 'nama', default=f'Warga {nik[-4:]}')).strip()
    no_hp = str(get_val('no. whatsapp / hp', 'no whatsapp', 'no hp', 'no wa', 'telepon', 'phone', default='')).strip()
    email = str(get_val('alamat email', 'email', default='')).strip()
    tempat_lahir = str(get_val('tempat lahir', 'tempat', default='Sidoarjo')).strip()
    tanggal_lahir = str(get_val('tanggal lahir', 'tgl lahir', default='')).strip()
    alamat = str(get_val('alamat lengkap', 'alamat', default='Sidoarjo')).strip()
    lat = str(get_val('latitude', 'lat', default='-7.4478')).strip()
    lng = str(get_val('longitude', 'lng', default='112.7183')).strip()

    c1 = safe_float(get_val('c1 (penghasilan bulanan rp)', 'c1', 'penghasilan', 'ekonomi', 'gaji', default=1500000))
    c2 = safe_int(get_val('c2 (nilai aset rp)', 'c2', 'aset', default=5000000))
    c3 = safe_int(get_val('c3 (usia / umur tahun)', 'c3', 'umur', 'usia', default=45))
    
    raw_c4 = str(get_val('c4 (jenis kelamin: 1=l, 2=p)', 'c4', 'jenis kelamin', 'gender', 'jk', default=1))
    c4 = 2 if ('p' in raw_c4.lower() or 'perempuan' in raw_c4.lower() or '2' in raw_c4) else 1
    
    c5 = safe_int(get_val('c5 (jumlah tanggungan)', 'c5', 'tanggungan', default=3))
    
    raw_c6 = str(get_val('c6 (status pernikahan: 1=belum, 2=menikah, 3=cerai)', 'c6', 'status pernikahan', 'pernikahan', 'kawin', default=2))
    c6 = 3 if ('cerai' in raw_c6.lower() or '3' in raw_c6) else (1 if ('belum' in raw_c6.lower() or '1' in raw_c6) else 2)

    c7 = safe_int(get_val('c7 (kepemilikan anak sekolah)', 'c7', 'anak sekolah', 'anak', default=2))

    raw_c8 = str(get_val('c8 (tempat tinggal: 1=milik, 2=sewa, 3=numpang)', 'c8', 'tempat tinggal', 'rumah', default=3))
    c8 = 1 if ('milik' in raw_c8.lower() or '1' in raw_c8) else (2 if ('sewa' in raw_c8.lower() or 'kontrak' in raw_c8.lower() or '2' in raw_c8) else 3)

    raw_c9 = str(get_val('c9 (pendidikan: 1=sd, 2=smp, 3=sma, 4=pt)', 'c9', 'pendidikan', default=1))
    c9 = 4 if ('sarjana' in raw_c9.lower() or 'diploma' in raw_c9.lower() or 'pt' in raw_c9.lower() or '4' in raw_c9) else (3 if ('sma' in raw_c9.lower() or 'smk' in raw_c9.lower() or '3' in raw_c9) else (2 if ('smp' in raw_c9.lower() or '2' in raw_c9) else 1))

    raw_c10 = str(get_val('c10 (kesehatan: 1=sehat, 2=sakit/disabilitas)', 'c10', 'kesehatan', 'penyakit', default=1))
    c10 = 2 if ('sakit' in raw_c10.lower() or 'disabilitas' in raw_c10.lower() or '2' in raw_c10) else 1

    raw_verif = str(get_val('status validasi', 'is_verified', 'validasi', 'status', default=''))
    is_verified = True if (raw_verif.lower() in ['disetujui', 'layak', 'true', '1', 'ya']) else False

    status_salur = str(get_val('status penyaluran', 'status salur', 'statussalur', default='Pending')).strip()
    nominal = str(get_val('nominal bantuan', 'nominal', default='Rp 600.000')).strip()

    return {
        'nik': nik, 'nama': nama, 'no_hp': no_hp, 'email': email,
        'tempat_lahir': tempat_lahir, 'tanggal_lahir': tanggal_lahir,
        'alamat': alamat, 'lat': lat, 'lng': lng,
        'c1': c1, 'c2': c2, 'c3': c3, 'c4': c4, 'c5': c5,
        'c6': c6, 'c7': c7, 'c8': c8, 'c9': c9, 'c10': c10,
        'is_verified': is_verified, 'status_salur': status_salur,
        'nominal_bantuan': nominal
    }

@app.route('/warga/bulk', methods=['POST', 'OPTIONS'])
@token_required
def import_bulk_warga():
    try:
        data_body = request.get_json(silent=True) or {}
        data_list = data_body.get('data', [])
        if not data_list or not isinstance(data_list, list):
            return jsonify({'status': 'error', 'message': 'Data Excel kosong atau tidak valid'}), 400

        count = 0
        for d in data_list:
            if not isinstance(d, dict): continue
            parsed = parse_excel_row(d)
            if not parsed or not parsed.get('nik'): continue
            
            nik = parsed['nik']
            w = Warga.query.filter_by(nik=nik).first()
            if not w:
                w = Warga(nik=nik)
                db.session.add(w)

            # Update seluruh atribut (UPSERT)
            w.nama = parsed['nama']
            w.no_hp = parsed['no_hp']
            w.email = parsed['email']
            w.tempat_lahir = parsed['tempat_lahir']
            if parsed['tanggal_lahir']:
                try: w.tanggal_lahir = datetime.strptime(str(parsed['tanggal_lahir'])[:10], '%Y-%m-%d').date()
                except: pass
            w.alamat = parsed['alamat']
            w.latitude = parsed['lat']
            w.longitude = parsed['lng']
            w.c1_ekonomi = parsed['c1']
            w.c2_aset = parsed['c2']
            w.c3_umur = parsed['c3']
            w.c4_jenis_kelamin = parsed['c4']
            w.c5_tanggungan = parsed['c5']
            w.c6_status_pernikahan = parsed['c6']
            w.c7_kepemilikan_anak = parsed['c7']
            w.c8_tempat_tinggal = parsed['c8']
            w.c9_pendidikan = parsed['c9']
            w.c10_kesehatan = parsed['c10']
            w.is_verified = parsed['is_verified']
            w.status_salur = parsed['status_salur']
            w.nominal_bantuan = parsed['nominal_bantuan']
            count += 1

        db.session.commit()
        return jsonify({
            'status': 'success',
            'count': count,
            'message': f'{count} baris data warga berhasil diselaraskan ke database'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': f'Gagal impor data: {str(e)}'}), 500

# ===========================================================================
# 10. DUKCAPIL VALIDATOR & SINKRONISASI BPS SIDOARJO (18 KECAMATAN)
# ===========================================================================
@app.route('/api/dukcapil/<nik>', methods=['GET'])
def check_dukcapil(nik):
    if len(nik) != 16 or not nik.isdigit():
        return jsonify({"status": "error", "message": "Format NIK harus 16 digit angka."}), 400
    try:
        tgl_raw = int(nik[6:8])
        bln_raw = int(nik[8:10])
        thn_raw = int(nik[10:12])
        
        jk = "Perempuan" if tgl_raw > 40 else "Laki-laki"
        tgl = tgl_raw - 40 if tgl_raw > 40 else tgl_raw
        
        tgl = min(31, max(1, tgl))
        bln = min(12, max(1, bln_raw))
        thn_full = (2000 + thn_raw) if thn_raw <= 26 else (1900 + thn_raw)

        return jsonify({
            "status": "success",
            "data": {
                "nik": nik,
                "nama": f"Warga Sidoarjo {nik[-4:]}",
                "tempat_lahir": "Sidoarjo",
                "tanggal_lahir": f"{thn_full}-{bln:02d}-{tgl:02d}",
                "jenis_kelamin": jk,
                "alamat": f"Dsn. Sukamaju RT.0{int(nik[-2:])%5 + 1}/RW.0{int(nik[-1])%3 + 1}, Sedati, Sidoarjo"
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/bps/sync', methods=['POST', 'OPTIONS'])
@token_required
def sync_bps():
    bps_seed = [
        {"nama": "Farendra Hidayah", "nik": "3515105010249415", "alamat": "Jl. Garuda No.73, RT 19/RW 4, Desa Sedati Agung, Kec. Sedati, Sidoarjo", "c1": 850000, "lat": "-7.3789", "lng": "112.7781", "tgl": "1983-02-04"},
        {"nama": "Ahmad Sari", "nik": "3515118279929946", "alamat": "Jl. Brawijaya No.49, RT 9/RW 7, Desa Betro, Kec. Sedati, Sidoarjo", "c1": 700000, "lat": "-7.3887", "lng": "112.7745", "tgl": "1954-07-07"},
        {"nama": "Dwi Kusuma", "nik": "3515127015975520", "alamat": "Jl. Pahlawan No.7, RT 23/RW 4, Desa Cemandi, Kec. Sedati, Sidoarjo", "c1": 950000, "lat": "-7.3929", "lng": "112.7808", "tgl": "1981-04-03"},
        {"nama": "Putri Saputra", "nik": "3515131001109262", "alamat": "Jl. Kenari No.45, RT 25/RW 9, Desa Buncitan, Kec. Sedati, Sidoarjo", "c1": 600000, "lat": "-7.3989", "lng": "112.7845", "tgl": "1980-06-01"},
        {"nama": "Dewi Pratama", "nik": "3515153714883134", "alamat": "Jl. Merpati No.99, RT 13/RW 4, Desa Pabean, Kec. Sedati, Sidoarjo", "c1": 800000, "lat": "-7.3689", "lng": "112.7681", "tgl": "1966-05-02"},
        {"nama": "Dimas Lestari", "nik": "3515162648401347", "alamat": "Jl. Raya Candi No.12, RT 05/RW 02, Kec. Candi, Sidoarjo", "c1": 750000, "lat": "-7.4812", "lng": "112.7245", "tgl": "1959-04-20"},
        {"nama": "Joko Pratama", "nik": "3515166028208811", "alamat": "Jl. Brigjend Katamso No.88, Kec. Waru, Sidoarjo", "c1": 900000, "lat": "-7.3541", "lng": "112.7389", "tgl": "1965-05-07"},
        {"nama": "Dewi Sari", "nik": "3515176754015572", "alamat": "Jl. Raya Krian No.40, Kec. Krian, Sidoarjo", "c1": 650000, "lat": "-7.4082", "lng": "112.5841", "tgl": "1987-11-09"},
        {"nama": "Dimas Kusuma", "nik": "3515177072480725", "alamat": "Jl. Raya Porong No.15, Kec. Porong, Sidoarjo", "c1": 550000, "lat": "-7.5452", "lng": "112.7032", "tgl": "1973-12-11"},
        {"nama": "Adam Lestari", "nik": "3515181784323688", "alamat": "Jl. Raya Gedangan No.24, Kec. Gedangan, Sidoarjo", "c1": 1100000, "lat": "-7.3887", "lng": "112.7278", "tgl": "2000-08-07"}
    ]
    for d in bps_seed:
        if not Warga.query.filter_by(nik=d['nik']).first():
            db.session.add(Warga(
                nama=d['nama'], nik=d['nik'], alamat=d['alamat'], c1_ekonomi=d['c1'],
                tempat_lahir='Sidoarjo', tanggal_lahir=datetime.strptime(d['tgl'], '%Y-%m-%d').date(),
                latitude=d['lat'], longitude=d['lng'],
                c2_aset=random.randint(2000000, 6000000), c3_umur=random.randint(35, 68),
                c4_jenis_kelamin=random.randint(1, 2), c5_tanggungan=random.randint(2, 5),
                c6_status_pernikahan=2, c7_kepemilikan_anak=random.randint(1, 3), c8_tempat_tinggal=3,
                c9_pendidikan=random.randint(1, 2), c10_kesehatan=1, is_verified=True,
                status_salur='Telah Menerima' if random.random() > 0.5 else 'Pending',
                catatan="Data Sinkronisasi BPS Sidoarjo (DTSEN Terpadu)"
            ))
    db.session.commit()
    return jsonify({"status": "success", "message": "10 data terpadu BPS Sidoarjo berhasil disinkronkan!"})

# ===========================================================================
# 11. MEDIA SERVER, REAL-TIME CHAT & NOTIFIKASI
# ===========================================================================
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/chat/list', methods=['GET', 'OPTIONS'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.waktu.asc()).all()
    rooms = {}
    for c in chats:
        rooms[c.nik_warga] = {
            "nik": c.nik_warga, "nama": c.nama_warga,
            "last_msg": c.pesan if c.pesan else ("📷 Foto" if c.file_type == 'image' else "🎥 Video"),
            "waktu": c.waktu.strftime("%H:%M | %d/%m") if c.waktu else "-"
        }
    return jsonify(list(rooms.values())[::-1])

@app.route('/api/chat/<nik>', methods=['GET', 'POST', 'OPTIONS'])
def handle_chat_nik(nik):
    if request.method == 'GET':
        chats = ChatKeluhan.query.filter_by(nik_warga=nik).order_by(ChatKeluhan.waktu.asc()).all()
        return jsonify([{
            "id": c.id, "sender": c.sender, "pesan": c.pesan,
            "file_path": f"/uploads/{c.file_path}" if c.file_path else None,
            "file_type": c.file_type, "waktu": c.waktu.strftime("%H:%M") if c.waktu else "-"
        } for c in chats])
    elif request.method == 'POST':
        sender = request.form.get('sender', 'warga')
        nama = request.form.get('nama', 'Warga')
        pesan = request.form.get('pesan', '')
        file = request.files.get('file')
        file_path, file_type = None, None
        if file and file.filename != '':
            ext = file.filename.rsplit('.', 1).lower()
            file_type = 'image' if ext in {'jpg', 'jpeg', 'png', 'webp'} else ('video' if ext in {'mp4', 'mov', 'webm'} else 'document')
            unique_name = f"{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
            file_path = unique_name
        new_chat = ChatKeluhan(nik_warga=nik, nama_warga=nama, sender=sender, pesan=pesan, file_path=file_path, file_type=file_type)
        db.session.add(new_chat)
        db.session.commit()
        return jsonify({"status": "success", "message": "Pesan terkirim."})

@app.route('/api/laporan-chat', methods=['GET', 'OPTIONS'])
@token_required
def get_laporan_chat():
    try:
        chats = ChatKeluhan.query.order_by(ChatKeluhan.id.desc()).limit(50).all()
        return jsonify([{
            'id': c.id,
            'nik': c.nik_warga or '',
            'nama': c.nama_warga or 'Warga',
            'pesan': c.pesan or '',
            'file_path': f"/uploads/{c.file_path}" if c.file_path else None,
            'file_type': c.file_type or 'text',
            'waktu': c.waktu.strftime("%H:%M | %d/%m/%Y") if c.waktu else "-",
            'sender': c.sender or 'warga'
        } for c in chats])
    except Exception as e:
        return jsonify([]), 200

@app.route('/api/notifikasi', methods=['GET', 'OPTIONS'])
@token_required
def get_notifikasi():
    role = request.current_user['role']
    notifs = Notifikasi.query.filter(Notifikasi.role_target.in_([role, 'all'])).order_by(Notifikasi.is_pinned.desc(), Notifikasi.id.desc()).limit(30).all()
    return jsonify([{"id": n.id, "pesan": n.pesan, "waktu": n.waktu.strftime("%H:%M | %d/%m"), "is_read": n.is_read, "is_pinned": n.is_pinned} for n in notifs])

@app.route('/api/notifikasi/<int:id>/read', methods=['PATCH', 'OPTIONS'])
@token_required
def update_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_read = not notif.is_read
    db.session.commit()
    return jsonify({"status": "success"})

# ===========================================================================
# 12. ENTRY POINT UTAMA
# ===========================================================================
if __name__ == '__main__':
    auto_migrate_database()
    app.run(host='0.0.0.0', port=5000, debug=True)