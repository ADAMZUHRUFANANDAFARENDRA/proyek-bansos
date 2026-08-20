import os
import json
import secrets
import math
from functools import wraps
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+mysqlconnector://root:root@db/bansos'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'kunci_rahasia_pemkab_sidoarjo'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True 

UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

ACTIVE_SESSIONS = {}

def waktu_wib():
    return datetime.utcnow() + timedelta(hours=7)

def safe_float(val):
    try: return float(val) if val else 0.0
    except: return 0.0

def safe_int(val, default=0):
    try: return int(float(val)) if val else default
    except: return default

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500

# ==========================================
# MODEL DATABASE
# ==========================================
class Warga(db.Model):
    __tablename__ = 'warga'
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    nik = db.Column(db.String(20), unique=True, nullable=False)
    no_hp = db.Column(db.String(20), nullable=True) 
    email = db.Column(db.String(100), nullable=True) 
    tempat_lahir = db.Column(db.String(50), nullable=True)
    tanggal_lahir = db.Column(db.Date, nullable=True)
    alamat = db.Column(db.String(255), nullable=True)
    c1_ekonomi = db.Column(db.Float, nullable=False, default=0)
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
    catatan = db.Column(db.Text, nullable=True)
    status_salur = db.Column(db.String(50), default='Pending') 
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)
    desil = db.Column(db.Integer, nullable=True) 
    foto_penyaluran = db.Column(db.String(255), nullable=True) 
    is_lapor_curang = db.Column(db.Boolean, default=False)
    tahap_penyaluran = db.Column(db.Integer, default=0)
    waktu_masuk = db.Column(db.DateTime, default=waktu_wib) 
    created_by = db.Column(db.String(100), nullable=True)
    verified_by = db.Column(db.String(100), nullable=True)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator') 
    nama_lengkap = db.Column(db.String(100), nullable=True)
    plain_password = db.Column(db.String(255), nullable=True)

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
    role_target = db.Column(db.String(20), nullable=False) 
    waktu = db.Column(db.DateTime, default=waktu_wib)
    is_read = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False) 

class ChatKeluhan(db.Model):
    __tablename__ = 'chat_keluhan'
    id = db.Column(db.Integer, primary_key=True)
    nik_warga = db.Column(db.String(20), index=True, nullable=False)
    nama_warga = db.Column(db.String(100), nullable=False)
    sender = db.Column(db.String(20), nullable=False) 
    nama_admin = db.Column(db.String(100), nullable=True) 
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True) 
    file_type = db.Column(db.String(20), nullable=True)  
    waktu = db.Column(db.DateTime, index=True, default=waktu_wib)
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted_for_everyone = db.Column(db.Boolean, default=False)
    deleted_by = db.Column(db.String(20), nullable=True)
    is_reported = db.Column(db.Boolean, default=False)
    report_reason = db.Column(db.String(100), nullable=True)
    reply_to_id = db.Column(db.Integer, nullable=True)
    reply_to_text = db.Column(db.String(255), nullable=True)
    reply_to_sender = db.Column(db.String(100), nullable=True)
    reaction = db.Column(db.String(10), nullable=True)
    is_pinned = db.Column(db.Boolean, default=False)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
        if not token: token = request.args.get('token')
        if not token or token not in ACTIVE_SESSIONS: return jsonify({"status": "error", "message": "Akses Ditolak."}), 401
        request.current_user = ACTIVE_SESSIONS[token]
        return f(*args, **kwargs)
    return decorated

def sinkronisasi_skema():
    with app.app_context():
        try:
            db.create_all()
            with db.engine.connect() as connection:
                kolom_chat = [
                    "nama_admin VARCHAR(100)", "file_path VARCHAR(255)", "file_type VARCHAR(20)",
                    "reply_to_id INT", "reply_to_text VARCHAR(255)", "reply_to_sender VARCHAR(100)", 
                    "reaction VARCHAR(10)", "is_pinned BOOLEAN DEFAULT FALSE"
                ]
                for col in kolom_chat:
                    try: connection.execute(text(f"ALTER TABLE chat_keluhan ADD COLUMN {col}"))
                    except Exception: pass

                kolom_warga = [
                    "created_by VARCHAR(100)", "verified_by VARCHAR(100)", "waktu_masuk DATETIME DEFAULT CURRENT_TIMESTAMP", 
                    "tahap_penyaluran INT DEFAULT 0", "is_lapor_curang BOOLEAN DEFAULT FALSE", "foto_penyaluran VARCHAR(255)", 
                    "status_salur VARCHAR(50)", "desil INT"
                ]
                for col in kolom_warga:
                    try: connection.execute(text(f"ALTER TABLE warga ADD COLUMN {col}"))
                    except Exception: pass

                try: connection.execute(text("ALTER TABLE notifikasi ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
                except Exception: pass
                try: connection.execute(text("ALTER TABLE notifikasi ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
                except Exception: pass
                try: connection.execute(text("ALTER TABLE user ADD COLUMN nama_lengkap VARCHAR(100)"))
                except Exception: pass
                try: connection.execute(text("ALTER TABLE user ADD COLUMN plain_password VARCHAR(255)"))
                except Exception: pass
                connection.commit()
        except Exception as e:
            print("Auto migration:", e)

try:
    sinkronisasi_skema()
except Exception:
    pass

@app.route('/init-kriteria', methods=['GET'])
def init_kriteria():
    sinkronisasi_skema()
    if Kriteria.query.count() == 0:
        db.session.add_all([
            Kriteria(kode='C1', nama='Ekonomi', bobot=0.15, jenis='cost'), Kriteria(kode='C2', nama='Aset', bobot=0.10, jenis='cost'),
            Kriteria(kode='C3', nama='Umur', bobot=0.10, jenis='benefit'), Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C5', nama='Tanggungan', bobot=0.15, jenis='benefit'), Kriteria(kode='C6', nama='Status Nikah', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C7', nama='Anak', bobot=0.10, jenis='benefit'), Kriteria(kode='C8', nama='Tempat Tinggal', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C9', nama='Pendidikan', bobot=0.10, jenis='cost'), Kriteria(kode='C10', nama='Kesehatan', bobot=0.10, jenis='benefit')
        ])
    db.session.commit()
    return jsonify({"status": "success", "message": "Database Siap Digunakan!"})

# 1. NOTIFIKASI LOGIN
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and bcrypt.check_password_hash(user.password, data.get('password')):
        token = secrets.token_hex(32)
        nama_pengguna = user.nama_lengkap if user.nama_lengkap else user.username
        role_nama = 'Administrator' if user.role == 'admin' else 'Petugas'
        ACTIVE_SESSIONS[token] = {"username": user.username, "nama_lengkap": nama_pengguna, "role": user.role}
        
        db.session.add(Notifikasi(
            pesan=f"🔐 LOGIN SISTEM: {nama_pengguna} ({role_nama}) berhasil masuk ke sistem dasbor.",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "success", "access_token": token, "data": {"username": user.username, "nama_lengkap": nama_pengguna, "role": user.role}})
    return jsonify({"status": "fail", "message": "Username atau Password Salah!"}), 401

# 2. NOTIFIKASI ENTRI MANUAL & HAPUS ARSIP DATA WARGA
@app.route('/warga', methods=['GET', 'POST'])
@token_required
def manage_warga():
    if request.method == 'GET':
        return jsonify([{ 'id': w.id, 'nama': w.nama, 'nik': w.nik, 'no_hp': w.no_hp, 'email': w.email, 'c1_ekonomi': w.c1_ekonomi, 'c2_aset': w.c2_aset, 'c3_umur': w.c3_umur, 'c4_jenis_kelamin': w.c4_jenis_kelamin, 'c5_tanggungan': w.c5_tanggungan, 'c6_status_pernikahan': w.c6_status_pernikahan, 'c7_kepemilikan_anak': w.c7_kepemilikan_anak, 'c8_tempat_tinggal': w.c8_tempat_tinggal, 'c9_pendidikan': w.c9_pendidikan, 'c10_kesehatan': w.c10_kesehatan, 'is_verified': w.is_verified, 'alamat': w.alamat, 'tempat_lahir': w.tempat_lahir, 'tanggal_lahir': str(w.tanggal_lahir) if w.tanggal_lahir else "", 'catatan': w.catatan, 'lat': w.latitude, 'lng': w.longitude, 'desil': w.desil, 'is_lapor_curang': w.is_lapor_curang, 'tahap_penyaluran': w.tahap_penyaluran, 'status_salur': w.status_salur, 'waktu_masuk': str(w.waktu_masuk) if w.waktu_masuk else "", 'created_by': w.created_by, 'verified_by': w.verified_by } for w in Warga.query.order_by(Warga.is_lapor_curang.desc(), Warga.id.desc()).all()])
    elif request.method == 'POST':
        d = request.json
        tgl_str = d.get('tanggal_lahir')
        tgl = datetime.strptime(tgl_str, '%Y-%m-%d').date() if tgl_str and str(tgl_str).strip() else None
        petugas = request.current_user.get('nama_lengkap', 'Petugas Dinas')
        new_warga = Warga(nama=d['nama'], nik=d['nik'], no_hp=d.get('no_hp'), email=d.get('email'), tempat_lahir=d.get('tempat_lahir'), tanggal_lahir=tgl, alamat=d.get('alamat'), latitude=d.get('lat'), longitude=d.get('lng'), c1_ekonomi=safe_float(d.get('c1')), c2_aset=safe_int(d.get('c2')), c3_umur=safe_int(d.get('c3')), c4_jenis_kelamin=safe_int(d.get('c4', 1)), c5_tanggungan=safe_int(d.get('c5')), c6_status_pernikahan=safe_int(d.get('c6', 1)), c7_kepemilikan_anak=safe_int(d.get('c7')), c8_tempat_tinggal=safe_int(d.get('c8', 1)), c9_pendidikan=safe_int(d.get('c9', 1)), c10_kesehatan=safe_int(d.get('c10', 1)), catatan=d.get('catatan', ''), is_verified=False, waktu_masuk=waktu_wib(), created_by=petugas)
        db.session.add(new_warga)
        
        db.session.add(Notifikasi(
            pesan=f"📋 ENTRI MANUAL: {petugas} menginput data warga baru: {d['nama']} (NIK: {d['nik']}).",
            role_target='all'
        ))
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/warga/<int:id>', methods=['DELETE', 'PUT'])
@token_required
def action_warga(id):
    w = Warga.query.get_or_404(id)
    petugas = request.current_user.get('nama_lengkap', 'Petugas Dinas')
    if request.method == 'DELETE':
        nama_warga = w.nama
        nik_warga = w.nik
        db.session.delete(w)
        db.session.add(Notifikasi(
            pesan=f"🗑️ PENGHAPUSAN ARSIP: {petugas} telah menghapus data warga '{nama_warga}' (NIK: {nik_warga}) dari arsip data warga.",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "deleted"})
    elif request.method == 'PUT':
        d = request.json
        w.nama = d['nama']; w.nik = d['nik']; w.no_hp = d.get('no_hp'); w.email = d.get('email'); w.alamat = d.get('alamat'); w.tempat_lahir = d.get('tempat_lahir')
        tgl_str = d.get('tanggal_lahir')
        if tgl_str and str(tgl_str).strip(): w.tanggal_lahir = datetime.strptime(tgl_str, '%Y-%m-%d').date()
        w.c1_ekonomi = safe_float(d.get('c1')); w.c2_aset = safe_int(d.get('c2')); w.c3_umur = safe_int(d.get('c3')); w.c4_jenis_kelamin = safe_int(d.get('c4', 1)); w.c5_tanggungan = safe_int(d.get('c5')); w.c6_status_pernikahan = safe_int(d.get('c6', 1)); w.c7_kepemilikan_anak = safe_int(d.get('c7')); w.c8_tempat_tinggal = safe_int(d.get('c8', 1)); w.c9_pendidikan = safe_int(d.get('c9', 1)); w.c10_kesehatan = safe_int(d.get('c10', 1))
        if 'catatan' in d: w.catatan = d['catatan']
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/warga/bulk/delete', methods=['POST'])
@token_required
def bulk_delete_warga():
    ids = request.json.get('ids', [])
    petugas = request.current_user.get('nama_lengkap', 'Petugas Dinas')
    Warga.query.filter(Warga.id.in_(ids)).delete(synchronize_session=False)
    db.session.add(Notifikasi(
        pesan=f"🗑️ HAPUS MASSAL ARSIP: {petugas} menghapus {len(ids)} data warga dari arsip data warga sekaligus.",
        role_target='admin'
    ))
    db.session.commit()
    return jsonify({"status": "success"})

# 3. NOTIFIKASI PENDAFTARAN MANDIRI
@app.route('/api/public/daftar', methods=['POST'])
def public_daftar():
    d = request.json
    if Warga.query.filter_by(nik=d['nik']).first(): return jsonify({"status": "error", "message": "NIK ini sudah terdaftar."}), 400
    tgl_str = d.get('tanggal_lahir')
    tgl = datetime.strptime(tgl_str, '%Y-%m-%d').date() if tgl_str and str(tgl_str).strip() else None
    
    new_w = Warga(
        nama=d['nama'], nik=d['nik'], no_hp=d.get('no_hp', ''), email=d.get('email', ''), 
        tempat_lahir=d.get('tempat_lahir', ''), tanggal_lahir=tgl, alamat=d.get('alamat', ''), 
        latitude=d.get('lat', ''), longitude=d.get('lng', ''), 
        c1_ekonomi=safe_float(d.get('c1')), c2_aset=safe_int(d.get('c2')), c3_umur=safe_int(d.get('c3')), 
        c4_jenis_kelamin=safe_int(d.get('c4', 1)), c5_tanggungan=safe_int(d.get('c5')), 
        c6_status_pernikahan=safe_int(d.get('c6', 1)), c7_kepemilikan_anak=safe_int(d.get('c7')), 
        c8_tempat_tinggal=safe_int(d.get('c8', 1)), c9_pendidikan=safe_int(d.get('c9', 1)), 
        c10_kesehatan=safe_int(d.get('c10', 1)), catatan=f"[PENDAFTARAN MANDIRI] {d.get('catatan', '')}", 
        is_verified=False, waktu_masuk=waktu_wib(), created_by="Warga Mandiri"
    )
    db.session.add(new_w)
    db.session.add(Notifikasi(
        pesan=f"📝 PENDAFTARAN MANDIRI: Warga baru {d['nama']} (NIK: {d['nik']}) mendaftar mandiri via Portal Warga.",
        role_target='all'
    ))
    db.session.commit()
    return jsonify({"status": "success"})

# 4. NOTIFIKASI LAPORAN BANSOS BELUM TERSALURKAN & SENGKETA
@app.route('/api/public/lapor-kecurangan', methods=['POST'])
def lapor_curang():
    nik = request.json.get('nik')
    w = Warga.query.filter_by(nik=nik).first()
    if w:
        w.is_lapor_curang = True
        w.desil = 1
        w.tahap_penyaluran = 0
        w.status_salur = 'Diinvestigasi'
        db.session.add(Notifikasi(
            pesan=f"🚨 DARURAT BANSOS: Warga {w.nama} (NIK: {nik}) melaporkan BELUM menerima bantuan sosial!",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 404

# 5. NOTIFIKASI PELECEHAN / KATA KASAR DI CHAT
@app.route('/api/chat/report/<int:msg_id>', methods=['POST'])
def report_chat(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    chat.is_reported = True
    chat.report_reason = request.json.get('reason', 'Konten Tidak Pantas / Pelecehan / Kasar')
    pelapor = request.json.get('reporter', 'Pengguna')
    
    db.session.add(Notifikasi(
        pesan=f"⛔ LAPORAN PELECEHAN CHAT: Pesan dari '{chat.nama_admin or chat.sender}' dilaporkan oleh {pelapor}. Alasan: {chat.report_reason}.",
        role_target='admin'
    ))
    db.session.commit()
    return jsonify({"status": "success"})

# 6. NOTIFIKASI BANSOS DITERIMA & PENYALURAN SELESAI
@app.route('/api/public/konfirmasi-terima', methods=['POST'])
def warga_konfirmasi():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w and w.tahap_penyaluran == 1:
        w.tahap_penyaluran = 2 
        db.session.add(Notifikasi(
            pesan=f"📦 BANSOS DITERIMA: Warga {w.nama} (NIK: {w.nik}) mengonfirmasi telah menerima bantuan fisik.",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/admin/salur', methods=['POST'])
@token_required
def admin_salur():
    nik = request.form.get('nik'); file = request.files.get('foto')
    w = Warga.query.filter_by(nik=nik).first()
    if not w or not file: return jsonify({"status": "error"}), 400
    filename = secure_filename(file.filename); unique_name = f"bukti_{nik}_{int(waktu_wib().timestamp())}.jpg"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
    w.foto_penyaluran = unique_name; w.tahap_penyaluran = 1; w.status_salur = 'Menunggu Konfirmasi'
    petugas = request.current_user.get('nama_lengkap')
    db.session.add(Notifikasi(pesan=f"📸 BUKTI PENYALURAN: Petugas {petugas} mengunggah bukti penyerahan untuk {w.nama}.", role_target='all'))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/admin/final-salur', methods=['POST'])
@token_required
def admin_final():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w and w.tahap_penyaluran == 2:
        w.tahap_penyaluran = 3; w.status_salur = 'Selesai'; w.is_lapor_curang = False 
        petugas = request.current_user.get('nama_lengkap')
        db.session.add(Notifikasi(pesan=f"🎉 PENYALURAN TUNTAS: Bansos untuk {w.nama} (NIK: {w.nik}) telah selesai divalidasi oleh {petugas}.", role_target='all'))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

# 7. NOTIFIKASI PROSES ALGORITMA SAW & VERIFIKASI ALGORITMA
def hitung_saw_logic():
    warga_list = Warga.query.filter_by(is_verified=True).all()
    if not warga_list: warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list: return {'hasil_akhir': []}
    raw_data = [{'nama': w.nama, 'nik': w.nik, 'C1': w.c1_ekonomi, 'C2': w.c2_aset, 'C3': w.c3_umur, 'C4': w.c4_jenis_kelamin, 'C5': w.c5_tanggungan, 'C6': w.c6_status_pernikahan, 'C7': w.c7_kepemilikan_anak, 'C8': w.c8_tempat_tinggal, 'C9': w.c9_pendidikan, 'C10': w.c10_kesehatan} for w in warga_list]
    bobot = {k.kode: k.bobot for k in kriteria_list}; jenis = {k.kode: k.jenis for k in kriteria_list}
    vals = {k: [d[k] for d in raw_data] for k in ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']}
    min_max = {k: {'min': min(v) if v else 1, 'max': max(v) if v else 1} for k, v in vals.items()}
    matriks_normalisasi, hasil_akhir = [], []
    for w in raw_data:
        skor_total = 0; norm_row = {'nama': w['nama']}
        for k in ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']:
            r = min_max[k]['min'] / w[k] if jenis[k] == 'cost' and w[k] > 0 else (w[k] / min_max[k]['max'] if min_max[k]['max'] > 0 else 0)
            norm_row[k] = round(r, 4); skor_total += r * bobot[k]
        matriks_normalisasi.append(norm_row); hasil_akhir.append({'nama': w['nama'], 'nik': w['nik'], 'skor_akhir': round(skor_total, 4)})
    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    
    total_warga = len(hasil_akhir)
    for idx, item in enumerate(hasil_akhir):
        desil_calc = int((idx / total_warga) * 10) + 1 if total_warga > 0 else 1
        if desil_calc > 10: desil_calc = 10
        item['desil'] = desil_calc; item['prioritas'] = "Diperioritaskan" if desil_calc <= 4 else "Tidak Diperioritaskan"
        item['menerima'] = "Menerima Bansos" if desil_calc <= 4 else "Tidak Menerima Bansos"
        
    return {'metode': 'BWM-SAW', 'kriteria': [{'kode': k.kode, 'nama': k.nama, 'jenis': k.jenis, 'bobot': k.bobot} for k in kriteria_list], 'min_max': min_max, 'matriks_keputusan': raw_data, 'matriks_normalisasi': matriks_normalisasi, 'hasil_akhir': hasil_akhir}

@app.route('/hitung-saw', methods=['GET'])
@token_required
def get_hitung_saw(): 
    data = hitung_saw_logic()
    for w_data in data['hasil_akhir']:
        w_db = Warga.query.filter_by(nik=w_data['nik']).first()
        if w_db and not w_db.is_lapor_curang: w_db.desil = w_data['desil']
    
    petugas = request.current_user.get('nama_lengkap', 'Administrator')
    db.session.add(Notifikasi(
        pesan=f"⚙️ PROSES ALGORITMA SAW: {petugas} telah menjalankan proses komputasi perangkingan algoritma BWM-SAW.",
        role_target='all'
    ))
    db.session.commit()
    return jsonify(data)

def hitung_wp_logic():
    warga = Warga.query.filter_by(is_verified=True).all()
    if not warga: warga = Warga.query.all()
    kriteria = Kriteria.query.all()
    if not warga or not kriteria: return {'hasil_akhir': []}
    total_w = sum(k.bobot for k in kriteria) or 1
    w_norm = {k.kode: (k.bobot / total_w) for k in kriteria}; jenis = {k.kode: k.jenis for k in kriteria}
    s_vector, total_s = [], 0
    for w in warga:
        row = {'C1': w.c1_ekonomi, 'C2': w.c2_aset, 'C3': w.c3_umur, 'C4': w.c4_jenis_kelamin, 'C5': w.c5_tanggungan, 'C6': w.c6_status_pernikahan, 'C7': w.c7_kepemilikan_anak, 'C8': w.c8_tempat_tinggal, 'C9': w.c9_pendidikan, 'C10': w.c10_kesehatan}
        s = 1.0
        for k in ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']:
            val = row[k] if row[k] > 0 else 1
            pangkat = -w_norm[k] if jenis[k] == 'cost' else w_norm[k]
            s *= math.pow(val, pangkat)
        s_vector.append({'nama': w.nama, 'nik': w.nik, 's': s}); total_s += s
    hasil_akhir = [{'nama': i['nama'], 'nik': i['nik'], 'skor_akhir': round((i['s'] / total_s) if total_s > 0 else 0, 4)} for i in s_vector]
    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True); return {'hasil_akhir': hasil_akhir}

@app.route('/komparasi', methods=['GET'])
@token_required
def komparasi_metode():
    saw_data, wp_data = hitung_saw_logic(), hitung_wp_logic()
    data_saw = {x['nik']: {'skor': x['skor_akhir'], 'rank': i+1, 'nama': x['nama'], 'desil': x['desil'], 'prioritas': x['prioritas'], 'menerima': x['menerima']} for i, x in enumerate(saw_data['hasil_akhir'])}
    data_wp = {x['nik']: {'skor': x['skor_akhir'], 'rank': i+1} for i, x in enumerate(wp_data['hasil_akhir'])}
    res = [{'nama': val['nama'], 'nik': nik, 'saw_skor': val['skor'], 'saw_rank': val['rank'], 'wp_skor': data_wp.get(nik, {'skor':0})['skor'], 'wp_rank': data_wp.get(nik, {'rank':0})['rank'], 'desil': val['desil'], 'prioritas': val['prioritas'], 'menerima': val['menerima']} for nik, val in data_saw.items()]
    res.sort(key=lambda x: x['saw_rank'])
    
    petugas = request.current_user.get('nama_lengkap', 'Administrator')
    db.session.add(Notifikasi(
        pesan=f"⚖️ VERIFIKASI ALGORITMA: {petugas} telah melakukan verifikasi komparasi metode SAW vs WP.",
        role_target='all'
    ))
    db.session.commit()
    return jsonify(res)

# 8. NOTIFIKASI PENYELESAIAN MASALAH
@app.route('/api/admin/lapor-tanggapi', methods=['POST'])
@token_required
def admin_lapor_tanggapi():
    nik = request.json.get('nik')
    w = Warga.query.filter_by(nik=nik).first()
    if w:
        w.status_salur = 'Menunggu Konfirmasi Warga'
        petugas = request.current_user.get('nama_lengkap')
        db.session.add(Notifikasi(pesan=f"📋 INVESTIGASI DIPROSES: Petugas {petugas} menindaklanjuti laporan sengketa bansos {w.nama}.", role_target='all'))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/public/lapor-selesai', methods=['POST'])
def warga_lapor_selesai():
    nik = request.json.get('nik')
    w = Warga.query.filter_by(nik=nik).first()
    if w and w.is_lapor_curang:
        w.status_salur = 'Menunggu Konfirmasi Akhir Admin'
        db.session.add(Notifikasi(pesan=f"✅ KONFIRMASI PENYELESAIAN: Warga {w.nama} menyatakan masalah bansos telah teratasi.", role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/admin/lapor-selesai', methods=['POST'])
@token_required
def admin_lapor_selesai():
    nik = request.json.get('nik')
    w = Warga.query.filter_by(nik=nik).first()
    if w:
        w.is_lapor_curang = False
        w.tahap_penyaluran = 3
        w.status_salur = 'Selesai'
        petugas = request.current_user.get('nama_lengkap')
        db.session.add(Notifikasi(pesan=f"✅ KASUS DITUTUP PERMANEN: Investigasi bansos {w.nama} telah ditutup resmi oleh {petugas}.", role_target='all'))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

# 9. NOTIFIKASI AKUN, HAPUS AKUN & RESET SANDI
@app.route('/api/users', methods=['GET', 'POST'])
@token_required
def manage_users():
    if request.current_user['role'] != 'admin': return jsonify({"status": "error", "message": "Akses Ditolak."}), 403
    if request.method == 'GET':
        users = User.query.all()
        return jsonify([{"id": u.id, "username": u.username, "nama_lengkap": u.nama_lengkap, "role": u.role, "plain_password": u.plain_password} for u in users])
    if request.method == 'POST':
        data = request.json
        if User.query.filter_by(username=data['username']).first(): return jsonify({"status": "error", "message": "Username tersebut sudah digunakan."}), 400
        hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        new_user = User(username=data['username'], nama_lengkap=data.get('nama_lengkap', data['username']), password=hashed_pw, plain_password=data['password'], role=data.get('role', 'operator'))
        db.session.add(new_user)
        
        db.session.add(Notifikasi(
            pesan=f"👥 AKUN BARU DIBUAT: Admin mendaftarkan akun '{data.get('nama_lengkap')}' sebagai {data.get('role', 'operator').upper()}.",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/api/users/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def update_delete_user(id):
    if request.current_user['role'] != 'admin': return jsonify({"status": "error", "message": "Akses Ditolak."}), 403
    user = User.query.get_or_404(id)
    if request.method == 'DELETE':
        nama_dihapus = user.nama_lengkap
        role_dihapus = user.role.upper()
        db.session.delete(user)
        db.session.add(Notifikasi(
            pesan=f"🗑️ AKUN DIHAPUS: Akses akun '{nama_dihapus}' ({role_dihapus}) telah dihapus oleh Admin.",
            role_target='admin'
        ))
        db.session.commit()
        return jsonify({"status": "success"})
    if request.method == 'PUT':
        data = request.json
        user.username = data.get('username', user.username)
        user.nama_lengkap = data.get('nama_lengkap', user.nama_lengkap)
        user.role = data.get('role', user.role)
        is_pw_change = False
        if data.get('password'):
            user.password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
            user.plain_password = data['password']
            is_pw_change = True
        
        pesan_notif = f"🔑 KATA SANDI DIUBAH: Kata sandi untuk akun '{user.nama_lengkap}' telah direset." if is_pw_change else f"✏️ PROFIL DIPERBARUI: Data akun '{user.nama_lengkap}' telah diubah."
        db.session.add(Notifikasi(pesan=pesan_notif, role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success"})

# 10. NOTIFIKASI CUSTOM (UNDUH SK & UNDUH LAPORAN VERIFIKASI)
@app.route('/api/notifikasi/send', methods=['POST'])
@token_required
def send_custom_notif():
    pesan = request.json.get('pesan')
    role_target = request.json.get('role_target', 'all')
    if pesan:
        db.session.add(Notifikasi(pesan=pesan, role_target=role_target))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

# ==========================================
# MANAJEMEN NOTIFIKASI (PIN, ARSIP, HAPUS)
# ==========================================
@app.route('/api/notifikasi', methods=['GET'])
@token_required
def get_notifikasi():
    notifs = Notifikasi.query.filter(
        Notifikasi.role_target.in_([request.current_user['role'], 'all'])
    ).order_by(Notifikasi.is_pinned.desc(), Notifikasi.id.desc()).limit(300).all()
    
    return jsonify([{
        "id": n.id,
        "pesan": n.pesan,
        "waktu": n.waktu.strftime("%H:%M | %d/%m") if n.waktu else "",
        "is_read": n.is_read,
        "is_pinned": n.is_pinned,
        "is_archived": n.is_archived
    } for n in notifs])

@app.route('/api/notifikasi/<int:id>/read', methods=['PATCH'])
@token_required
def mark_notif_read(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_read = True
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/notifikasi/<int:id>/pin', methods=['PATCH'])
@token_required
def pin_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_pinned = not notif.is_pinned
    db.session.commit()
    return jsonify({"status": "success", "is_pinned": notif.is_pinned})

@app.route('/api/notifikasi/<int:id>/archive', methods=['PATCH'])
@token_required
def archive_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_archived = not notif.is_archived
    db.session.commit()
    return jsonify({"status": "success", "is_archived": notif.is_archived})

@app.route('/api/notifikasi/<int:id>', methods=['DELETE'])
@token_required
def delete_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    db.session.delete(notif)
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/notifikasi/clear', methods=['POST'])
@token_required
def clear_all_notifikasi():
    Notifikasi.query.filter_by(is_archived=False).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"status": "success"})

# ==========================================
# CHAT SYSTEM LENGKAP
# ==========================================
@app.route('/api/chat/list', methods=['GET'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.waktu.asc()).all(); rooms = {}
    for c in chats: 
        rooms[c.nik_warga] = { 
            "nik": c.nik_warga, 
            "nama": c.nama_warga, 
            "last_msg": "Pesan Dihapus" if c.is_deleted_for_everyone else (c.pesan if c.pesan else "Berkas Multimedia"), 
            "waktu": c.waktu.strftime("%H:%M") if c.waktu else "" 
        }
    return jsonify(list(rooms.values())[::-1])

@app.route('/api/chat/<nik>', methods=['GET', 'POST'])
def handle_chat(nik):
    if request.method == 'GET':
        request_sender = request.args.get('viewer', 'warga') 
        chats = ChatKeluhan.query.filter_by(nik_warga=nik).order_by(ChatKeluhan.waktu.desc()).limit(100).all()
        result = []
        for c in chats[::-1]:
            if c.deleted_by == request_sender: continue
            pesan_teks = c.pesan; f_path = f"/uploads/{c.file_path}" if c.file_path else None; f_type = c.file_type
            if c.is_deleted_for_everyone: pesan_teks = "🚫 <i>Pesan ini telah ditarik</i>"; f_path = None; f_type = None
            result.append({ 
                "id": c.id, "sender": c.sender, "nama_admin": c.nama_admin, "pesan": pesan_teks, "file_path": f_path, "file_type": f_type, 
                "is_edited": c.is_edited, "is_deleted": c.is_deleted_for_everyone, "is_reported": c.is_reported, 
                "waktu": c.waktu.strftime("%H:%M") if c.waktu else "", "reply_to_text": c.reply_to_text, "reply_to_sender": c.reply_to_sender, "reply_to_id": c.reply_to_id, "reaction": c.reaction,
                "is_pinned": c.is_pinned
            })
        return jsonify(result)
    else:
        try:
            sender = request.form.get('sender', 'warga')
            nama_admin = request.form.get('nama_admin', None) 
            pesan = request.form.get('pesan', '')
            file = request.files.get('file')
            file_path = None; file_type = None
            
            w_curr = Warga.query.filter_by(nik=nik).first()
            nama_warga = request.form.get('nama') or (w_curr.nama if w_curr else 'Warga')
            
            if file:
                filename = secure_filename(file.filename)
                explicit_type = request.form.get('custom_file_type')
                ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
                
                if not ext or ext in ['bin', 'blob']:
                    if explicit_type == 'video': ext = 'mp4'
                    elif explicit_type == 'audio': ext = 'webm'
                    elif explicit_type == 'image': ext = 'jpg'
                    else: ext = 'webm' if 'audio' in file.mimetype else ('mp4' if 'video' in file.mimetype else 'jpg')
                
                if explicit_type in ['audio', 'image', 'video']: file_type = explicit_type
                else:
                    if ext in ['webm', 'mp3', 'wav', 'ogg', 'm4a'] or 'audio' in file.mimetype: file_type = 'audio'
                    elif ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] or 'image' in file.mimetype: file_type = 'image'
                    elif ext in ['mp4', 'mkv', 'avi', 'mov'] or 'video' in file.mimetype: file_type = 'video'
                    else: file_type = 'document'
                
                unique_name = f"{int(waktu_wib().timestamp())}_{secrets.token_hex(4)}.{ext}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
                file_path = unique_name
            
            new_chat = ChatKeluhan(
                nik_warga=nik, 
                nama_warga=nama_warga, 
                sender=sender, 
                nama_admin=nama_admin, 
                pesan=pesan, 
                file_path=file_path, 
                file_type=file_type, 
                reply_to_id=request.form.get('reply_to_id'), 
                reply_to_text=request.form.get('reply_to_text'), 
                reply_to_sender=request.form.get('reply_to_sender')
            )
            db.session.add(new_chat)
            
            # NOTIFIKASI JIKA WARGA MENGIRIM CHAT
            if sender == 'warga': 
                db.session.add(Notifikasi(
                    pesan=f"💬 PESAN MASUK: Warga {nama_warga} (NIK: {nik}) mengirimkan pesan di Live Chat.",
                    role_target='all'
                ))
            db.session.commit()
            return jsonify({"status": "success"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat/clear/<nik>', methods=['POST', 'DELETE'])
def clear_chat_room(nik):
    try:
        ChatKeluhan.query.filter_by(nik_warga=nik).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"status": "success", "message": "Semua riwayat chat berhasil dibersihkan."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat/report-room/<nik>', methods=['POST'])
def report_chat_room(nik):
    data = request.json or {}
    reason = data.get('reason', 'Pelecehan / Kata-kata Kasar / Pelanggaran Massal')
    reporter = data.get('reporter', 'Admin')
    w_curr = Warga.query.filter_by(nik=nik).first()
    nama = w_curr.nama if w_curr else nik
    
    db.session.add(Notifikasi(
        pesan=f"🚨 LAPORAN INVESTIGASI MASSAL: Seluruh obrolan warga {nama} ({nik}) dilaporkan oleh {reporter}. Alasan: {reason}.",
        role_target='admin'
    ))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/chat/action/<int:msg_id>', methods=['PUT', 'DELETE'])
def chat_actions(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    if request.method == 'PUT':
        if chat.is_deleted_for_everyone: return jsonify({"status": "error"}), 400
        chat.pesan = request.form.get('pesan', chat.pesan); chat.is_edited = True
        db.session.commit(); return jsonify({"status": "success"})
    elif request.method == 'DELETE':
        data = request.json
        if data.get('type') == 'everyone': chat.is_deleted_for_everyone = True
        elif data.get('type') == 'me': chat.deleted_by = data.get('requester', 'warga')
        db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/chat/react/<int:msg_id>', methods=['POST'])
def react_chat(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    chat.reaction = request.json.get('reaction')
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/chat/pin/<int:msg_id>', methods=['PATCH'])
def pin_chat_message(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    chat.is_pinned = not chat.is_pinned
    db.session.commit()
    return jsonify({"status": "success", "is_pinned": chat.is_pinned})

@app.route('/api/kriteria', methods=['GET', 'POST'])
@token_required
def manage_kriteria():
    if request.method == 'POST':
        for i in request.json: Kriteria.query.filter_by(kode=i['kode']).first().bobot = float(i['bobot'])
        db.session.commit()
    return jsonify([{'kode': k.kode, 'nama': k.nama, 'bobot': k.bobot, 'jenis': k.jenis} for k in Kriteria.query.all()])

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)