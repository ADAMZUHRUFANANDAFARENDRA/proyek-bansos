"""
=============================================================================
SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANSOS SIDOARJO
METODE: BEST-WORST METHOD (BWM) & SIMPLE ADDITIVE WEIGHTING (SAW)
KOMPARASI: WEIGHTED PRODUCT (WP)
=============================================================================
"""

import math
import os
import smtplib
import uuid
import traceback
from datetime import datetime, timedelta
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
# 1. KONFIGURASI ENVIRONMENT & APLIKASI
# ===========================================================================
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'kunci_rahasia_pemkab_sidoarjo_2026')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 'mysql+mysqlconnector://root:@127.0.0.1:3306/bansos'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg', 'png', 'webp', 'gif',
    'mp4', 'mov', 'avi', 'mkv', 'webm',
    'pdf', 'xlsx', 'xls', 'wav', 'mp3', 'ogg'
}

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# KONFIGURASI CORS LENGKAP
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
)

# INTERCEPTOR GLOBAL KHUSUS PREFLIGHT OPTIONS
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,Accept")
        response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH,OPTIONS")
        return response, 200

EMAIL_SENDER = os.getenv('EMAIL_SENDER', '')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD', '')
LOGIN_ATTEMPTS = {}

# ===========================================================================
# 2. HELPER FUNCTIONS
# ===========================================================================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1).lower() in ALLOWED_EXTENSIONS

def safe_float(val, default=0.0):
    try:
        if val is None or val == '': return default
        return float(val)
    except:
        return default

def safe_int(val, default=0):
    try:
        if val is None or val == '': return default
        return int(float(val))
    except:
        return default

@app.errorhandler(HTTPException)
def handle_http_exception(e):
    return jsonify({"status": "error", "message": e.description}), e.code

@app.errorhandler(Exception)
def handle_generic_exception(e):
    traceback.print_exc()
    return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500

# ===========================================================================
# 3. DATABASE MODELS
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
    c1_ekonomi = db.Column(db.Float, nullable=False, default=0.0)
    c2_aset = db.Column(db.Integer, nullable=False, default=0)
    c3_umur = db.Column(db.Integer, nullable=False, default=0)
    c4_jenis_kelamin = db.Column(db.Integer, nullable=False, default=1)
    c5_tanggungan = db.Column(db.Integer, nullable=False, default=0)
    c6_status_pernikahan = db.Column(db.Integer, nullable=False, default=1)
    c7_kepemilikan_anak = db.Column(db.Integer, nullable=False, default=0)
    c8_tempat_tinggal = db.Column(db.Integer, nullable=False, default=1)
    c9_pendidikan = db.Column(db.Integer, nullable=False, default=1)
    c10_kesehatan = db.Column(db.Integer, nullable=False, default=1)
    is_verified = db.Column(db.Boolean, default=False)
    tanggal_verifikasi = db.Column(db.Date, nullable=True)
    foto_rumah = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)
    catatan = db.Column(db.Text, nullable=True)
    status_salur = db.Column(db.String(50), default='Pending')
    bukti_salur = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Kriteria(db.Model):
    __tablename__ = 'kriteria'
    id = db.Column(db.Integer, primary_key=True)
    kode = db.Column(db.String(5), unique=True, nullable=False)
    nama = db.Column(db.String(50), nullable=False)
    bobot = db.Column(db.Float, nullable=False)
    jenis = db.Column(db.String(10), nullable=False)

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
    sender = db.Column(db.String(20), nullable=False)
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)
    is_pinned = db.Column(db.Boolean, default=False)
    reaction = db.Column(db.String(10), nullable=True)
    waktu = db.Column(db.DateTime, default=datetime.now)

# ===========================================================================
# 4. MIDDLEWARE AUTENTIKASI JWT (BEBAS DARI ERROR LIST STRIP)
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
# 5. ENDPOINT AUTH, LOGIN & INISIALISASI
# ===========================================================================
@app.route('/init-kriteria', methods=['GET', 'OPTIONS'])
def init_kriteria():
    try:
        db.create_all()
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
        return jsonify({"status": "success", "message": "Database & Akun Siap Digunakan!"})
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
        elif request.method == 'PUT':
            d = request.get_json(silent=True) or {}
            if d.get('username'): u.username = d['username'].strip()
            if d.get('email'): u.email = d['email'].strip()
            if d.get('role'): u.role = d['role']
            if d.get('password') and len(d['password'].strip()) > 0:
                u.password = bcrypt.generate_password_hash(d['password'].strip()).decode('utf-8')
            db.session.commit()
            return jsonify({"status": "success", "message": "Akun berhasil diperbarui."})
    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ===========================================================================
# 6. PERHITUNGAN SPK (SAW vs WP) & BOBOT BWM
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
    warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list:
        return {'hasil_akhir': [], 'matriks_normalisasi': []}

    bobot = {k.kode: k.bobot for k in kriteria_list}
    jenis = {k.kode: k.jenis for k in kriteria_list}

    raw_data = []
    for w in warga_list:
        row = {'nama': w.nama, 'nik': w.nik}
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
        hasil_akhir.append({'nama': w['nama'], 'nik': w['nik'], 'skor_akhir': round(skor_total, 4)})

    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    total_warga = len(hasil_akhir)
    for idx, item in enumerate(hasil_akhir):
        desil_calc = min(10, max(1, math.ceil(((idx + 1) / total_warga) * 10))) if total_warga > 0 else 1
        item['desil'] = desil_calc
        item['prioritas'] = "Diprioritaskan" if desil_calc <= 4 else "Tidak Diprioritaskan"
        item['menerima'] = "Menerima" if desil_calc <= 4 else "Tidak Menerima"

    return {
        'metode': 'SAW (Dengan Bobot BWM)',
        'kriteria': [{'kode': k.kode, 'nama': k.nama, 'jenis': k.jenis, 'bobot': k.bobot} for k in kriteria_list],
        'min_max': min_max, 'matriks_keputusan': raw_data,
        'matriks_normalisasi': matriks_normalisasi, 'hasil_akhir': hasil_akhir
    }

def hitung_wp_logic():
    warga = Warga.query.all()
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
        traceback.print_exc()
        return jsonify([]), 200

# ===========================================================================
# 7. CRUD DATA WARGA, ARSIP & IMPORT EXCEL (SAFE NULL-CHECK)
# ===========================================================================
@app.route('/warga', methods=['GET', 'POST', 'OPTIONS'])
@token_required
def manage_warga():
    try:
        if request.method == 'GET':
            warga_list = Warga.query.order_by(Warga.id.desc()).all()
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
                'alamat': w.alamat or 'Sidoarjo',
                'tempat_lahir': w.tempat_lahir or 'Sidoarjo',
                'tanggal_lahir': str(w.tanggal_lahir) if w.tanggal_lahir else "",
                'catatan': w.catatan or '',
                'lat': w.latitude or '',
                'lng': w.longitude or '',
                'status_salur': w.status_salur or 'Pending',
                'bukti_salur': w.bukti_salur or ''
            } for w in warga_list])

        elif request.method == 'POST':
            d = request.get_json(silent=True) or {}
            if not d.get('nik') or not d.get('nama'):
                return jsonify({"status": "error", "message": "Nama dan NIK wajib diisi."}), 400
            if Warga.query.filter_by(nik=d['nik']).first():
                return jsonify({"status": "error", "message": "NIK sudah terdaftar di sistem."}), 400
            tgl = None
            if d.get('tanggal_lahir'):
                try: tgl = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
                except: pass
            new_w = Warga(
                nama=d['nama'].strip(),
                nik=d['nik'].strip(),
                no_hp=d.get('no_hp', ''),
                email=d.get('email', ''),
                tempat_lahir=d.get('tempat_lahir', 'Sidoarjo'),
                tanggal_lahir=tgl,
                alamat=d.get('alamat', 'Sidoarjo'),
                latitude=d.get('lat', ''),
                longitude=d.get('lng', ''),
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
                catatan=d.get('catatan', '')
            )
            db.session.add(new_w)
            db.session.commit()
            return jsonify({"status": "success", "message": "Data warga berhasil disimpan."})
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
            w.latitude = d.get('lat', d.get('latitude', w.latitude))
            w.longitude = d.get('lng', d.get('longitude', w.longitude))
            if d.get('tanggal_lahir'):
                try: w.tanggal_lahir = datetime.strptime(d['tanggal_lahir'][:10], '%Y-%m-%d').date()
                except: pass
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
            db.session.commit()
            return jsonify({"status": "success", "message": "Data berhasil diperbarui."})
    except Exception as e:
        traceback.print_exc()
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
    Warga.query.delete()
    db.session.commit()
    return jsonify({"status": "success", "message": "Seluruh data arsip warga berhasil dikosongkan."})

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
    else:
        w.status_salur = 'Telah Menerima'
    db.session.commit()
    return jsonify({"status": "success", "message": "Status sengketa diperbarui."})

@app.route('/warga/bulk', methods=['POST', 'OPTIONS'])
@token_required
def bulk_insert():
    data_list = (request.get_json(silent=True) or {}).get('data', [])
    count = 0
    for d in data_list:
        nik = str(d.get('nik', d.get('NIK', ''))).strip()
        if nik and not Warga.query.filter_by(nik=nik).first():
            tgl_lhr = None
            if d.get('tanggal_lahir') or d.get('Tanggal Lahir'):
                try: tgl_lhr = datetime.strptime(str(d.get('tanggal_lahir', d.get('Tanggal Lahir', '')))[:10], '%Y-%m-%d').date()
                except: pass
            new_w = Warga(
                nama=str(d.get('nama', d.get('Nama', d.get('Nama Lengkap', 'Tanpa Nama')))).strip(),
                nik=nik, no_hp=str(d.get('no_hp', d.get('No WA', d.get('No. WhatsApp / HP', '')))).strip(),
                email=str(d.get('email', d.get('Email', ''))).strip(),
                tempat_lahir=str(d.get('tempat_lahir', d.get('Tempat Lahir', 'Sidoarjo'))).strip(),
                tanggal_lahir=tgl_lhr, alamat=str(d.get('alamat', d.get('Alamat Lengkap', 'Sidoarjo'))).strip(),
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
    db.session.commit()
    return jsonify({"status": "success", "message": f"{count} baris data warga berhasil diimpor!"})

# ===========================================================================
# 8. ENDPOINT PUBLIC, DUKCAPIL, SINKRONISASI BPS & CHAT
# ===========================================================================
@app.route('/api/dukcapil/<nik>', methods=['GET'])
def check_dukcapil(nik):
    if len(nik) != 16 or not nik.isdigit():
        return jsonify({"status": "error", "message": "Format NIK harus 16 digit angka."}), 400
    try:
        tgl, bln, thn = int(nik[6:8]), int(nik[8:10]), int(nik[10:12])
        jk = "Perempuan" if tgl > 40 else "Laki-laki"
        if tgl > 40: tgl -= 40
        thn_full = (2000 + thn) if thn <= (datetime.now().year % 100) else (1900 + thn)
        return jsonify({
            "status": "success",
            "data": {
                "nik": nik, "nama": f"Warga Dukcapil {nik[-4:]}", "tempat_lahir": "Sidoarjo",
                "tanggal_lahir": f"{thn_full}-{bln:02d}-{tgl:02d}", "jenis_kelamin": jk,
                "alamat": "Dsn. Sukamaju RT.01 RW.02, Waru, Sidoarjo"
            }
        })
    except:
        return jsonify({"status": "error", "message": "Gagal membaca struktur NIK."}), 400

@app.route('/api/public/cek-bansos/<nik>', methods=['GET'])
def public_cek_bansos(nik):
    w = Warga.query.filter_by(nik=nik).first()
    if not w: return jsonify({"status": "error", "message": "NIK belum terdaftar dalam sistem."}), 404
    status_text = "Disetujui (Layak Menerima Bansos)" if w.is_verified else "Menunggu Diproses / Verifikasi"
    return jsonify({
        "status": "success",
        "data": {
            "nama": w.nama, "nik": w.nik, "alamat": w.alamat,
            "status": status_text, "level": 2 if w.is_verified else 1, "status_salur": w.status_salur
        }
    })

@app.route('/api/bps/sync', methods=['POST', 'OPTIONS'])
@token_required
def sync_bps():
    import random
    dummy_bps_data = [
        {"nama": "Warga BPS Waru", "nik": f"351501{random.randint(1000000000, 9999999999)}", "c1": 850000, "alamat": "Waru, Sidoarjo"},
        {"nama": "Warga BPS Candi", "nik": f"351502{random.randint(1000000000, 9999999999)}", "c1": 700000, "alamat": "Candi, Sidoarjo"},
        {"nama": "Warga BPS Porong", "nik": f"351503{random.randint(1000000000, 9999999999)}", "c1": 600000, "alamat": "Porong, Sidoarjo"}
    ]
    for d in dummy_bps_data:
        if not Warga.query.filter_by(nik=d['nik']).first():
            db.session.add(Warga(
                nama=d['nama'], nik=d['nik'], alamat=d['alamat'], c1_ekonomi=d['c1'],
                c2_aset=5000000, c3_umur=45, c4_jenis_kelamin=1, c5_tanggungan=3,
                c6_status_pernikahan=2, c7_kepemilikan_anak=2, c8_tempat_tinggal=3,
                c9_pendidikan=2, c10_kesehatan=1, is_verified=False, catatan="Sinkronisasi Terpadu BPS Sidoarjo"
            ))
    db.session.commit()
    return jsonify({"status": "success", "message": "Sinkronisasi data terpadu BPS Sidoarjo berhasil!"})

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
            file_type = 'image' if ext in {'jpg', 'jpeg', 'png', 'webp'} else 'video'
            unique_name = f"{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
            file_path = unique_name
        new_chat = ChatKeluhan(nik_warga=nik, nama_warga=nama, sender=sender, pesan=pesan, file_path=file_path, file_type=file_type)
        db.session.add(new_chat)
        db.session.commit()
        return jsonify({"status": "success", "message": "Pesan terkirim."})

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
# 9. RUN SERVER FLASK (EKSEKUSI UTAMA)
# ===========================================================================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)