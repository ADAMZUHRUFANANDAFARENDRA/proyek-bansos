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

# --- MEMATIKAN CACHE FLASK SECARA PAKSA ---
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True 

UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

ACTIVE_SESSIONS = {}

# --- FUNGSI WAKTU REAL-TIME WIB (UTC+7) ---
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
    status_salur = db.Column(db.String(20), default='Pending') 
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

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
        if not token: token = request.args.get('token')
        if not token or token not in ACTIVE_SESSIONS: return jsonify({"status": "error", "message": "Akses Ditolak."}), 401
        request.current_user = ACTIVE_SESSIONS[token]
        return f(*args, **kwargs)
    return decorated

@app.route('/init-kriteria', methods=['GET'])
def init_kriteria():
    db.create_all()
    with db.engine.connect() as connection:
        # 1. Suntik Paksa Kolom Warga yang Hilang
        kolom_warga = [
            "created_by VARCHAR(100)", "verified_by VARCHAR(100)", "waktu_masuk DATETIME DEFAULT CURRENT_TIMESTAMP", 
            "tahap_penyaluran INT DEFAULT 0", "is_lapor_curang BOOLEAN DEFAULT FALSE", "foto_penyaluran VARCHAR(255)", 
            "status_salur VARCHAR(50)", "desil INT"
        ]
        for col in kolom_warga:
            try: connection.execute(text(f"ALTER TABLE warga ADD COLUMN {col}"))
            except: pass
        
        # 2. Suntik Paksa Kolom Media & Pelaporan Chat
        kolom_chat = [
            "nama_admin VARCHAR(100)", "file_path VARCHAR(255)", "file_type VARCHAR(20)", 
            "reply_to_id INT", "reply_to_text VARCHAR(255)", "reply_to_sender VARCHAR(100)", "reaction VARCHAR(10)"
        ]
        for col in kolom_chat:
            try: connection.execute(text(f"ALTER TABLE chat_keluhan ADD COLUMN {col}"))
            except: pass
            
        # 3. Suntik Paksa Kolom Pengguna
        try: connection.execute(text("ALTER TABLE notifikasi ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
        except: pass
        try: connection.execute(text("ALTER TABLE user ADD COLUMN nama_lengkap VARCHAR(100)"))
        except: pass
        try: connection.execute(text("ALTER TABLE user ADD COLUMN plain_password VARCHAR(255)"))
        except: pass
        connection.commit()
        
    if Kriteria.query.count() == 0:
        db.session.add_all([
            Kriteria(kode='C1', nama='Ekonomi', bobot=0.15, jenis='cost'), Kriteria(kode='C2', nama='Aset', bobot=0.10, jenis='cost'),
            Kriteria(kode='C3', nama='Umur', bobot=0.10, jenis='benefit'), Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C5', nama='Tanggungan', bobot=0.15, jenis='benefit'), Kriteria(kode='C6', nama='Status Nikah', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C7', nama='Anak', bobot=0.10, jenis='benefit'), Kriteria(kode='C8', nama='Tempat Tinggal', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C9', nama='Pendidikan', bobot=0.10, jenis='cost'), Kriteria(kode='C10', nama='Kesehatan', bobot=0.10, jenis='benefit')
        ])
    db.session.commit()
    return jsonify({"status": "success", "message": "Database Berhasil Direnovasi & Siap Digunakan!"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and bcrypt.check_password_hash(user.password, data.get('password')):
        token = secrets.token_hex(32)
        nama_pengguna = user.nama_lengkap if user.nama_lengkap else user.username
        ACTIVE_SESSIONS[token] = {"username": user.username, "nama_lengkap": nama_pengguna, "role": user.role}
        db.session.add(Notifikasi(pesan=f"🔐 SISTEM: {nama_pengguna} ({user.role.capitalize()}) baru saja berhasil Login.", role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success", "access_token": token, "data": {"username": user.username, "nama_lengkap": nama_pengguna, "role": user.role}})
    return jsonify({"status": "fail", "message": "Username atau Password Salah!"}), 401

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
        db.session.add(Notifikasi(pesan=f"👥 AKUN BARU: Admin telah mendaftarkan pengguna baru dengan nama '{data.get('nama_lengkap')}'.", role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/api/users/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def update_delete_user(id):
    if request.current_user['role'] != 'admin': return jsonify({"status": "error", "message": "Akses Ditolak."}), 403
    user = User.query.get_or_404(id)
    if request.method == 'DELETE':
        db.session.delete(user)
        db.session.add(Notifikasi(pesan=f"🗑️ AKUN DIHAPUS: Admin telah menghapus akses untuk pengguna '{user.nama_lengkap}'.", role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success"})
    if request.method == 'PUT':
        data = request.json
        user.username = data.get('username', user.username)
        user.nama_lengkap = data.get('nama_lengkap', user.nama_lengkap)
        user.role = data.get('role', user.role)
        if data.get('password'):
            user.password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
            user.plain_password = data['password']
        db.session.add(Notifikasi(pesan=f"✏️ AKUN DIEDIT: Data atau hak akses untuk '{user.nama_lengkap}' telah diubah oleh Admin.", role_target='admin'))
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/api/dukcapil/<nik>', methods=['GET'])
def check_dukcapil(nik):
    if len(nik) != 16 or not nik.isdigit(): return jsonify({"status": "error"}), 400
    try:
        tgl = int(nik[6:8]); bln = int(nik[8:10]); thn = int(nik[10:12])
        jk = "Perempuan" if tgl > 40 else "Laki-laki"
        if tgl > 40: tgl -= 40
        thn_full = 1900 + thn if thn >= 30 else 2000 + thn
        return jsonify({"status": "success", "data": {"nik": nik, "nama": f"Warga Desa {nik[-4:]}", "tempat_lahir": "Sidoarjo", "tanggal_lahir": f"{thn_full}-{bln:02d}-{tgl:02d}", "jenis_kelamin": jk, "alamat": "Desa Cemandi, Kecamatan Sedati, Kabupaten Sidoarjo"}})
    except Exception: return jsonify({"status": "error"}), 400

@app.route('/api/public/login-warga', methods=['POST'])
def login_warga():
    data = request.json
    w = Warga.query.filter_by(nik=data.get('nik', '').strip()).first()
    if not w: return jsonify({"status": "error", "message": "Data NIK tidak ditemukan. Silakan daftar mandiri terlebih dahulu."}), 404
    if w.nama.lower() != data.get('nama', '').strip().lower() or (w.email and w.email.lower() != data.get('email', '').strip().lower()):
        return jsonify({"status": "error", "message": "Identitas tidak cocok. Pastikan Nama dan Email sesuai dengan saat mendaftar."}), 401

    status_text = "Menunggu Proses Validasi Lapangan"; level = 1
    if w.is_verified:
        if w.desil:
            if w.desil <= 4:
                status_text = f"Disetujui (Masuk Prioritas Desil {w.desil})"; level = 2
                if w.tahap_penyaluran > 0: status_text = "Tahap Penyaluran Aktif"; level = 3
                if w.status_salur == 'Menunggu Konfirmasi Warga': status_text = "Tanggapan Admin (Menunggu Warga)"
                elif w.status_salur == 'Menunggu Konfirmasi Akhir Admin': status_text = "Warga Konfirmasi (Menunggu Admin)"
            else: status_text = f"Ditangguhkan (Termasuk Golongan Mampu - Desil {w.desil})"; level = 4
        else: status_text = "Menunggu Komputasi Algoritma SPK Pusat"; level = 1
        
    return jsonify({"status": "success", "data": {"nama": w.nama, "nik": w.nik, "alamat": w.alamat, "status": status_text, "level": level, "desil": w.desil, "foto_penyaluran": w.foto_penyaluran, "is_lapor_curang": w.is_lapor_curang, "tahap_penyaluran": w.tahap_penyaluran, "status_salur": w.status_salur}})

@app.route('/api/public/cek-bansos/<nik>', methods=['GET'])
def public_cek_bansos(nik):
    w = Warga.query.filter_by(nik=nik).first()
    if not w: return jsonify({"status": "error", "message": "NIK Anda belum terdaftar dalam sistem."}), 404
    status_text = "Menunggu Proses Validasi Lapangan"; level = 1
    if w.is_verified:
        if w.desil:
            if w.desil <= 4:
                status_text = f"Disetujui (Masuk Prioritas Desil {w.desil})"; level = 2
                if w.tahap_penyaluran > 0: status_text = "Tahap Penyaluran Aktif"; level = 3
                if w.status_salur == 'Menunggu Konfirmasi Warga': status_text = "Tanggapan Admin (Menunggu Warga)"
                elif w.status_salur == 'Menunggu Konfirmasi Akhir Admin': status_text = "Warga Konfirmasi (Menunggu Admin)"
            else: status_text = f"Ditangguhkan (Termasuk Golongan Mampu - Desil {w.desil})"; level = 4
        else: status_text = "Menunggu Komputasi Algoritma SPK Pusat"; level = 1
    return jsonify({"status": "success", "data": {"nama": w.nama, "nik": w.nik, "alamat": w.alamat, "status": status_text, "level": level, "desil": w.desil, "foto_penyaluran": w.foto_penyaluran, "is_lapor_curang": w.is_lapor_curang, "tahap_penyaluran": w.tahap_penyaluran, "status_salur": w.status_salur}})

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
    db.session.add(Notifikasi(pesan=f"📝 ENTRI BARU: Warga {d['nama']} mendaftar secara mandiri via Portal Publik.", role_target='all'))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/uploads/<path:filename>')
def serve_uploads(filename): 
    response = make_response(send_from_directory(app.config['UPLOAD_FOLDER'], filename))
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Accept-Ranges'] = 'bytes' 
    return response

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
    db.session.add(Notifikasi(pesan=f"📸 BUKTI TAHAP 1: Petugas {petugas} mengunggah bukti penyerahan bansos untuk {w.nama}.", role_target='all'))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/public/konfirmasi-terima', methods=['POST'])
def warga_konfirmasi():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w and w.tahap_penyaluran == 1:
        w.tahap_penyaluran = 2 
        db.session.add(Notifikasi(pesan=f"✅ KONFIRMASI WARGA: {w.nama} menyatakan TELAH MENERIMA bansos.", role_target='admin'))
        db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/admin/final-salur', methods=['POST'])
@token_required
def admin_final():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w and w.tahap_penyaluran == 2:
        w.tahap_penyaluran = 3; w.status_salur = 'Selesai'; w.is_lapor_curang = False 
        petugas = request.current_user.get('nama_lengkap')
        db.session.add(Notifikasi(pesan=f"🎉 FINALISASI: Verifikasi 3 Tahap selesai untuk {w.nama} oleh {petugas}.", role_target='all'))
        db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/public/lapor-kecurangan', methods=['POST'])
def lapor_curang():
    nik = request.json.get('nik'); w = Warga.query.filter_by(nik=nik).first()
    if w:
        w.is_lapor_curang = True; w.desil = 1; w.tahap_penyaluran = 0; w.status_salur = 'Diinvestigasi'
        db.session.add(Notifikasi(pesan=f"🚨 LAPORAN DARURAT: {w.nama} ({nik}) melaporkan BELUM MENERIMA BANSOS!", role_target='admin'))
        db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 404

# --- PERBAIKAN FITUR TANGGAPI (TANPA SYARAT KETAT) ---
@app.route('/api/admin/lapor-tanggapi', methods=['POST'])
@token_required
def admin_lapor_tanggapi():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w:
        w.status_salur = 'Menunggu Konfirmasi Warga'
        db.session.add(Notifikasi(pesan=f"📋 TANGGAPAN INVESTIGASI: Petugas {request.current_user.get('nama_lengkap')} menindaklanjuti laporan {w.nama}.", role_target='all'))
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/public/lapor-selesai', methods=['POST'])
def warga_lapor_selesai():
    nik = request.json.get('nik'); w = Warga.query.filter_by(nik=nik).first()
    if w and w.is_lapor_curang:
        w.status_salur = 'Menunggu Konfirmasi Akhir Admin'
        db.session.add(Notifikasi(pesan=f"✅ KONFIRMASI WARGA: Warga {w.nama} menyatakan masalah teratasi. Menunggu klik selesai Admin.", role_target='admin'))
        db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

@app.route('/api/admin/lapor-selesai', methods=['POST'])
@token_required
def admin_lapor_selesai():
    w = Warga.query.filter_by(nik=request.json.get('nik')).first()
    if w and w.is_lapor_curang:
        w.is_lapor_curang = False; w.tahap_penyaluran = 3; w.status_salur = 'Selesai'
        db.session.add(Notifikasi(pesan=f"🎉 KASUS DITUTUP: Investigasi selesai untuk {w.nama}.", role_target='all'))
        db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

# ==========================================
# CHAT SYSTEM 
# ==========================================
@app.route('/api/chat/list', methods=['GET'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.waktu.asc()).all(); rooms = {}
    for c in chats: rooms[c.nik_warga] = { "nik": c.nik_warga, "nama": c.nama_warga, "last_msg": "Pesan Dihapus" if c.is_deleted_for_everyone else (c.pesan if c.pesan else "Berkas Multimedia"), "waktu": c.waktu.strftime("%H:%M") }
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
                "waktu": c.waktu.strftime("%H:%M"), "reply_to_text": c.reply_to_text, "reply_to_sender": c.reply_to_sender, "reply_to_id": c.reply_to_id, "reaction": c.reaction 
            })
        return jsonify(result)
    else:
        try:
            sender = request.form.get('sender', 'warga')
            nama = request.form.get('nama', 'Warga')
            nama_admin = request.form.get('nama_admin', None) 
            pesan = request.form.get('pesan', '')
            file = request.files.get('file')
            file_path = None; file_type = None
            
            if file:
                filename = secure_filename(file.filename)
                explicit_type = request.form.get('custom_file_type')
                ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
                
                if not ext or ext == 'bin' or ext == 'blob':
                    if explicit_type == 'video': ext = 'mp4'
                    elif explicit_type == 'audio': ext = 'webm'
                    elif explicit_type == 'image': ext = 'jpg'
                    elif 'video' in file.mimetype: ext = 'mp4'
                    elif 'audio' in file.mimetype: ext = 'webm'
                    elif 'image' in file.mimetype: ext = 'jpg'
                    else: ext = 'bin'
                
                if explicit_type in ['audio', 'image', 'video']: file_type = explicit_type
                else:
                    if ext in ['webm', 'mp3', 'wav', 'ogg', 'm4a'] or 'audio' in file.mimetype: file_type = 'audio'
                    elif ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] or 'image' in file.mimetype: file_type = 'image'
                    elif ext in ['mp4', 'mkv', 'avi', 'mov'] or 'video' in file.mimetype: file_type = 'video'
                    else: file_type = 'document'
                
                unique_name = f"{int(waktu_wib().timestamp())}_{secrets.token_hex(4)}.{ext}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
                file_path = unique_name
            
            db.session.add(ChatKeluhan(nik_warga=nik, nama_warga=nama, sender=sender, nama_admin=nama_admin, pesan=pesan, file_path=file_path, file_type=file_type, reply_to_id=request.form.get('reply_to_id'), reply_to_text=request.form.get('reply_to_text'), reply_to_sender=request.form.get('reply_to_sender')))
            
            if sender == 'warga': db.session.add(Notifikasi(pesan=f"💬 Pesan Baru: Warga {nama} mengirim pesan obrolan.", role_target='admin'))
            db.session.commit()
            return jsonify({"status": "success"})
        except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat/action/<int:msg_id>', methods=['PUT', 'DELETE'])
def chat_actions(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    if request.method == 'PUT':
        if chat.is_deleted_for_everyone: return jsonify({"status": "error"}), 400
        chat.pesan = request.form.get('pesan', chat.pesan); chat.is_edited = True
        file = request.files.get('file')
        if file:
            filename = secure_filename(file.filename)
            explicit_type = request.form.get('custom_file_type')
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            
            if not ext or ext == 'bin' or ext == 'blob':
                if explicit_type == 'video': ext = 'mp4'
                elif explicit_type == 'audio': ext = 'webm'
                elif explicit_type == 'image': ext = 'jpg'
                else: ext = 'bin'
                
            file_type = explicit_type if explicit_type in ['audio', 'image', 'video'] else 'document'
            unique_name = f"{int(waktu_wib().timestamp())}_{secrets.token_hex(4)}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
            chat.file_path = unique_name; chat.file_type = file_type
        db.session.commit(); return jsonify({"status": "success"})
    
    elif request.method == 'DELETE':
        data = request.json
        if data.get('type') == 'everyone': chat.is_deleted_for_everyone = True
        elif data.get('type') == 'me': chat.deleted_by = data.get('requester', 'warga')
        db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/chat/react/<int:msg_id>', methods=['POST'])
def react_chat(msg_id):
    ChatKeluhan.query.get_or_404(msg_id).reaction = request.json.get('reaction')
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/chat/report/<int:msg_id>', methods=['POST'])
def report_chat(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    chat.is_reported = True; chat.report_reason = request.json.get('reason', 'Konten Tidak Pantas')
    db.session.add(Notifikasi(pesan=f"⛔ LAPORAN KONTEN: Pesan dari '{chat.nama_admin or chat.sender}' dilaporkan oleh {request.json.get('reporter', 'Sistem')}.", role_target='admin'))
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/admin/reported-chats', methods=['GET'])
@token_required
def get_reported_chats():
    if request.current_user['role'] != 'admin': return jsonify([]), 403
    return jsonify([{ "id": r.id, "nik_warga": r.nik_warga, "nama_warga": r.nama_warga, "sender": r.sender, "pengirim_asli": f"Admin ({r.nama_admin})" if r.sender == 'admin' and r.nama_admin else ("Administrator" if r.sender == 'admin' else "Warga"), "pesan": r.pesan, "waktu": r.waktu.strftime("%d/%m %H:%M"), "report_reason": r.report_reason, "file_path": r.file_path, "file_type": r.file_type } for r in ChatKeluhan.query.filter_by(is_reported=True).all()])

@app.route('/api/admin/resolve-report/<int:msg_id>', methods=['POST'])
@token_required
def resolve_report(msg_id):
    chat = ChatKeluhan.query.get_or_404(msg_id)
    if request.json.get('action') == 'delete': chat.is_deleted_for_everyone = True; chat.is_reported = False
    else: chat.is_reported = False
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/public/keluhan', methods=['POST'])
def submit_keluhan():
    d = request.json
    db.session.add(ChatKeluhan(nik_warga=d.get('nik', 'Warga Umum'), nama_warga=d.get('nama', 'Anonim'), sender='warga', pesan=d.get('pesan', '')))
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/warga', methods=['GET', 'POST'])
@token_required
def manage_warga():
    if request.method == 'GET':
        return jsonify([{ 'id': w.id, 'nama': w.nama, 'nik': w.nik, 'no_hp': w.no_hp, 'email': w.email, 'c1_ekonomi': w.c1_ekonomi, 'c2_aset': w.c2_aset, 'c3_umur': w.c3_umur, 'c4_jenis_kelamin': w.c4_jenis_kelamin, 'c5_tanggungan': w.c5_tanggungan, 'c6_status_pernikahan': w.c6_status_pernikahan, 'c7_kepemilikan_anak': w.c7_kepemilikan_anak, 'c8_tempat_tinggal': w.c8_tempat_tinggal, 'c9_pendidikan': w.c9_pendidikan, 'c10_kesehatan': w.c10_kesehatan, 'is_verified': w.is_verified, 'alamat': w.alamat, 'tempat_lahir': w.tempat_lahir, 'tanggal_lahir': str(w.tanggal_lahir) if w.tanggal_lahir else "", 'catatan': w.catatan, 'lat': w.latitude, 'lng': w.longitude, 'desil': w.desil, 'is_lapor_curang': w.is_lapor_curang, 'tahap_penyaluran': w.tahap_penyaluran, 'status_salur': w.status_salur, 'waktu_masuk': str(w.waktu_masuk) if w.waktu_masuk else "", 'created_by': w.created_by, 'verified_by': w.verified_by } for w in Warga.query.order_by(Warga.is_lapor_curang.desc(), Warga.id.desc()).all()])
    elif request.method == 'POST':
        d = request.json
        tgl_str = d.get('tanggal_lahir')
        tgl = datetime.strptime(tgl_str, '%Y-%m-%d').date() if tgl_str and str(tgl_str).strip() else None
        new_warga = Warga(nama=d['nama'], nik=d['nik'], no_hp=d.get('no_hp'), email=d.get('email'), tempat_lahir=d.get('tempat_lahir'), tanggal_lahir=tgl, alamat=d.get('alamat'), latitude=d.get('lat'), longitude=d.get('lng'), c1_ekonomi=safe_float(d.get('c1')), c2_aset=safe_int(d.get('c2')), c3_umur=safe_int(d.get('c3')), c4_jenis_kelamin=safe_int(d.get('c4', 1)), c5_tanggungan=safe_int(d.get('c5')), c6_status_pernikahan=safe_int(d.get('c6', 1)), c7_kepemilikan_anak=safe_int(d.get('c7')), c8_tempat_tinggal=safe_int(d.get('c8', 1)), c9_pendidikan=safe_int(d.get('c9', 1)), c10_kesehatan=safe_int(d.get('c10', 1)), catatan=d.get('catatan', ''), is_verified=False, waktu_masuk=waktu_wib(), created_by=request.current_user.get('nama_lengkap'))
        db.session.add(new_warga); db.session.commit(); return jsonify({"status": "success"})

@app.route('/warga/<int:id>', methods=['DELETE', 'PUT'])
@token_required
def action_warga(id):
    w = Warga.query.get_or_404(id)
    if request.method == 'DELETE': db.session.delete(w); db.session.commit(); return jsonify({"status": "deleted"})
    elif request.method == 'PUT':
        d = request.json
        w.nama = d['nama']; w.nik = d['nik']; w.no_hp = d.get('no_hp'); w.email = d.get('email'); w.alamat = d.get('alamat'); w.tempat_lahir = d.get('tempat_lahir')
        tgl_str = d.get('tanggal_lahir')
        if tgl_str and str(tgl_str).strip(): w.tanggal_lahir = datetime.strptime(tgl_str, '%Y-%m-%d').date()
        w.c1_ekonomi = safe_float(d.get('c1')); w.c2_aset = safe_int(d.get('c2')); w.c3_umur = safe_int(d.get('c3')); w.c4_jenis_kelamin = safe_int(d.get('c4', 1)); w.c5_tanggungan = safe_int(d.get('c5')); w.c6_status_pernikahan = safe_int(d.get('c6', 1)); w.c7_kepemilikan_anak = safe_int(d.get('c7')); w.c8_tempat_tinggal = safe_int(d.get('c8', 1)); w.c9_pendidikan = safe_int(d.get('c9', 1)); w.c10_kesehatan = safe_int(d.get('c10', 1))
        if 'catatan' in d: w.catatan = d['catatan']
        db.session.commit(); return jsonify({"status": "success"})

@app.route('/warga/<int:id>/verify', methods=['PATCH'])
@token_required
def verify_warga(id):
    w = Warga.query.get_or_404(id); w.is_verified = not w.is_verified
    if w.is_verified: w.tanggal_verifikasi = waktu_wib().date(); w.verified_by = request.current_user.get('nama_lengkap')
    else: w.tanggal_verifikasi = None; w.verified_by = None
    db.session.commit(); return jsonify({"status": "success"})

@app.route('/warga/bulk', methods=['POST'])
@token_required
def bulk_insert():
    data_list = request.json.get('data', []); count = 0; petugas = request.current_user.get('nama_lengkap')
    for d in data_list:
        nik_val = str(d.get('nik', d.get('NIK', ''))).strip()
        if not nik_val or nik_val == '0': continue 
        if not Warga.query.filter_by(nik=nik_val).first():
            tgl_str = d.get('tanggal_lahir', d.get('Tanggal Lahir')); tgl = None
            try:
                if tgl_str and str(tgl_str).strip(): tgl = datetime.strptime(str(tgl_str)[:10], '%Y-%m-%d').date()
            except: pass
            db.session.add(Warga(nama=str(d.get('nama', d.get('Nama', 'Tanpa Nama'))), nik=nik_val, no_hp=str(d.get('no_hp', d.get('No. WA', ''))), email=str(d.get('email', d.get('Email', ''))), tempat_lahir=str(d.get('tempat_lahir', d.get('Tempat Lahir', ''))), tanggal_lahir=tgl, alamat=str(d.get('alamat', d.get('Alamat Lengkap', ''))), latitude=str(d.get('lat', d.get('Garis Lintang', ''))), longitude=str(d.get('lng', d.get('Garis Bujur', ''))), c1_ekonomi=safe_float(d.get('c1_ekonomi', d.get('C1', 0))), c2_aset=safe_int(d.get('c2_aset', d.get('C2', 0))), c3_umur=safe_int(d.get('c3_umur', d.get('C3', 0))), c4_jenis_kelamin=safe_int(d.get('c4_jenis_kelamin', d.get('C4', 1))), c5_tanggungan=safe_int(d.get('c5_tanggungan', d.get('C5', 0))), c6_status_pernikahan=safe_int(d.get('c6_status_pernikahan', d.get('C6', 1))), c7_kepemilikan_anak=safe_int(d.get('c7_kepemilikan_anak', d.get('C7', 0))), c8_tempat_tinggal=safe_int(d.get('c8_tempat_tinggal', d.get('C8', 1))), c9_pendidikan=safe_int(d.get('c9_pendidikan', d.get('C9', 1))), c10_kesehatan=safe_int(d.get('c10_kesehatan', d.get('C10', 1))), catatan=str(d.get('catatan', d.get('Catatan', ''))), is_verified=False, status_salur='Pending', is_lapor_curang=False, tahap_penyaluran=0, waktu_masuk=waktu_wib(), created_by=f"Import by {petugas}"))
            count += 1
    db.session.add(Notifikasi(pesan=f"📥 IMPORT DATA: {petugas} mengimpor {count} data warga.", role_target='all'))
    db.session.commit(); return jsonify({"status": "success", "message": f"{count} data berhasil diimpor!"})

@app.route('/warga/bulk/delete', methods=['POST'])
@token_required
def bulk_delete(): 
    Warga.query.filter(Warga.id.in_(request.json.get('ids', []))).delete(synchronize_session=False); db.session.commit(); return jsonify({"status": "success"})

@app.route('/warga/bulk/verify', methods=['POST'])
@token_required
def bulk_verify():
    for w in Warga.query.filter(Warga.id.in_(request.json.get('ids', []))).all(): w.is_verified = True; w.tanggal_verifikasi = waktu_wib().date(); w.verified_by = request.current_user.get('nama_lengkap')
    db.session.commit(); return jsonify({"status": "success"})

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
    db.session.add(Notifikasi(pesan=f"⚙️ ALGORITMA SPK: {request.current_user.get('nama_lengkap')} memproses perhitungan BWM-SAW.", role_target='all'))
    db.session.commit(); return jsonify(data)

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
    return jsonify(res)

@app.route('/api/map/regional-desil', methods=['GET'])
@token_required
def regional_desil():
    grid = {}
    for w in Warga.query.filter(Warga.desil.isnot(None)).all():
        if not w.latitude or not w.longitude or w.latitude.strip() == "" or w.longitude.strip() == "": continue
        try:
            lat_grid = round(float(w.latitude), 3); lng_grid = round(float(w.longitude), 3); key = f"{lat_grid},{lng_grid}"
            if key not in grid: grid[key] = {'lat': lat_grid, 'lng': lng_grid, 'total_desil': 0, 'count': 0, 'warga': []}
            grid[key]['total_desil'] += w.desil; grid[key]['count'] += 1; grid[key]['warga'].append(w.nama)
        except: pass
    return jsonify([{'lat': v['lat'], 'lng': v['lng'], 'avg_desil': round(v['total_desil'] / v['count'], 1), 'count': v['count'], 'sample_warga': v['warga'][:3]} for v in grid.values()])

@app.route('/api/kriteria', methods=['GET', 'POST'])
@token_required
def manage_kriteria():
    if request.method == 'POST':
        for i in request.json: Kriteria.query.filter_by(kode=i['kode']).first().bobot = float(i['bobot'])
        db.session.commit()
    return jsonify([{'kode': k.kode, 'nama': k.nama, 'bobot': k.bobot, 'jenis': k.jenis} for k in Kriteria.query.all()])

@app.route('/api/notifikasi', methods=['GET'])
@token_required
def get_notifikasi():
    return jsonify([{ "id": n.id, "pesan": n.pesan, "waktu": n.waktu.strftime("%H:%M | %d/%m"), "is_read": n.is_read, "is_pinned": n.is_pinned, "is_archived": n.is_archived } for n in Notifikasi.query.filter(Notifikasi.role_target.in_([request.current_user['role'], 'all'])).order_by(Notifikasi.id.desc()).limit(500).all()])

@app.route('/api/notifikasi/<int:id>/read', methods=['PATCH'])
@token_required
def update_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id); notif.is_read = True; db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/notifikasi/<int:id>/pin', methods=['PATCH'])
@token_required
def pin_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id); notif.is_pinned = not notif.is_pinned; db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/notifikasi/<int:id>/archive', methods=['PATCH'])
@token_required
def archive_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id); notif.is_archived = True; db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/notifikasi/<int:id>', methods=['DELETE'])
@token_required
def delete_notifikasi(id):
    db.session.delete(Notifikasi.query.get_or_404(id)); db.session.commit(); return jsonify({"status": "success"})

@app.route('/api/notifikasi/send', methods=['POST'])
def send_custom_notif():
    pesan = request.json.get('pesan'); role_target = request.json.get('role_target', 'all')
    if pesan: db.session.add(Notifikasi(pesan=pesan, role_target=role_target)); db.session.commit(); return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 400

# --- HOOK ANTI-CACHE GLOBAL ---
@app.after_request
def add_header(response):
    # Memaksa browser tidak menyimpan cache sama sekali
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()
            admin_user = User.query.filter_by(username='admin').first()
            hashed_pw = bcrypt.generate_password_hash('admin').decode('utf-8')
            
            if not admin_user:
                db.session.add(User(username='admin', nama_lengkap='Administrator Utama', plain_password='admin', password=hashed_pw, role='admin'))
            else:
                admin_user.password = hashed_pw
                admin_user.plain_password = 'admin'
            
            db.session.commit()
            print(">>> Sistem Akun Abadi Berhasil Dinyalakan! <<<")
        except Exception as e:
            print(f">>> Menunggu Database Siap... ({e}) <<<")
            
    app.run(host='0.0.0.0', debug=True, port=5000)