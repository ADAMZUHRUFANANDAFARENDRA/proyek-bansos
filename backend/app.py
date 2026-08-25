import os
import json
import secrets
import smtplib
import math
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)

# ====================================================
# KONFIGURASI DATABASE & APLIKASI
# ====================================================
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'mysql+mysqlconnector://root:@localhost/bansos'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'kunci_rahasia_pemkab_sidoarjo')

# Batas Maksimal Upload (100 MB)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/*": {"origins": "*"}})

ACTIVE_SESSIONS = {}
LOGIN_ATTEMPTS = {}

def safe_float(val, default=0.0):
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    try:
        return int(val) if val is not None else default
    except (ValueError, TypeError):
        return default

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500

EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "emailkamu@gmail.com")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "password_app_gmail_kamu")

def send_email_notification(to_email, subject, body_text):
    if not to_email or "@" not in to_email:
        return False
    try:
        msg = MIMEMultipart()
        msg['From'] = f"Layanan Bansos Sidoarjo <{EMAIL_SENDER}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_text, 'html'))
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception:
        return False

# ====================================================
# DATABASE MODELS
# ====================================================
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
    catatan = db.Column(db.Text, nullable=True)
    status_salur = db.Column(db.String(20), default='Pending')
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator')

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
    waktu = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)

class ChatKeluhan(db.Model):
    __tablename__ = 'chat_keluhan'
    id = db.Column(db.Integer, primary_key=True)
    nik_warga = db.Column(db.String(20), nullable=False)
    nama_warga = db.Column(db.String(100), nullable=False)
    sender = db.Column(db.String(20), nullable=False)  # 'warga' atau 'admin'
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)  # 'image' atau 'video'
    waktu = db.Column(db.DateTime, default=datetime.now)

# ====================================================
# MIDDLEWARE AUTH
# ====================================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip() if auth_header else request.args.get('token')
        if not token or token not in ACTIVE_SESSIONS:
            return jsonify({"status": "error", "message": "Akses Ditolak. Token tidak valid atau kedaluwarsa."}), 401
        request.current_user = ACTIVE_SESSIONS[token]
        return f(*args, **kwargs)
    return decorated

# ====================================================
# ROUTES / API ENDPOINTS
# ====================================================
@app.route('/init-kriteria', methods=['GET'])
def init_kriteria():
    db.create_all()
    if Kriteria.query.count() == 0:
        db.session.add_all([
            Kriteria(kode='C1', nama='Ekonomi', bobot=0.15, jenis='cost'),
            Kriteria(kode='C2', nama='Aset', bobot=0.10, jenis='cost'),
            Kriteria(kode='C3', nama='Umur', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C5', nama='Tanggungan', bobot=0.15, jenis='benefit'),
            Kriteria(kode='C6', nama='Status Nikah', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C7', nama='Anak', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C8', nama='Tempat Tinggal', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C9', nama='Pendidikan', bobot=0.10, jenis='cost'),
            Kriteria(kode='C10', nama='Kesehatan', bobot=0.10, jenis='benefit')
        ])
    if not User.query.filter_by(username='admin').first():
        db.session.add(User(username='admin', password=bcrypt.generate_password_hash('admin123').decode('utf-8'), role='admin'))
    if not User.query.filter_by(username='petugas').first():
        db.session.add(User(username='petugas', password=bcrypt.generate_password_hash('12345').decode('utf-8'), role='operator'))
    db.session.commit()
    return jsonify({"status": "success", "message": "Database dan data inisial siap!"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username_input = data.get('username')
    password_input = data.get('password')

    if username_input in LOGIN_ATTEMPTS and LOGIN_ATTEMPTS[username_input] >= 5:
        return jsonify({"status": "fail", "message": "Akun dikunci sementara karena terlalu banyak percobaan."}), 403

    user = User.query.filter_by(username=username_input).first()
    if user and bcrypt.check_password_hash(user.password, password_input):
        LOGIN_ATTEMPTS[username_input] = 0
        token = secrets.token_hex(32)
        ACTIVE_SESSIONS[token] = {"username": user.username, "role": user.role}
        return jsonify({"status": "success", "access_token": token, "data": {"username": user.username, "role": user.role}})

    LOGIN_ATTEMPTS[username_input] = LOGIN_ATTEMPTS.get(username_input, 0) + 1
    return jsonify({"status": "fail", "message": "Username atau Password salah!"}), 401

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json or {}
    username = data.get('username')
    recovery_code = data.get('recovery_code')
    new_password = data.get('new_password')
    if recovery_code != "SIDOARJO-BANSOS-2026":
        return jsonify({"status": "error", "message": "Kode Pemulihan Instansi Tidak Valid!"}), 403
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"status": "error", "message": "Username tidak ditemukan di database."}), 404
    user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()
    return jsonify({"status": "success", "message": "Sandi berhasil direset. Silakan login kembali."})

@app.route('/api/dukcapil/<nik>', methods=['GET'])
def check_dukcapil(nik):
    if len(nik) != 16 or not nik.isdigit():
        return jsonify({"status": "error", "message": "Format NIK tidak valid (harus 16 digit angka)."}), 400
    try:
        tgl = int(nik[6:8])
        bln = int(nik[8:10])
        thn = int(nik[10:12])
        jk = "Perempuan" if tgl > 40 else "Laki-laki"
        if tgl > 40:
            tgl -= 40
        thn_full = 1900 + thn if thn >= 30 else 2000 + thn
        return jsonify({
            "status": "success",
            "data": {
                "nik": nik,
                "nama": f"Warga Dukcapil {nik[-4:]}",
                "tempat_lahir": "Sidoarjo",
                "tanggal_lahir": f"{thn_full}-{bln:02d}-{tgl:02d}",
                "jenis_kelamin": jk,
                "alamat": "Dsn. Sukamaju RT.01 RW.02, Kecamatan Waru, Sidoarjo"
            }
        })
    except Exception:
        return jsonify({"status": "error", "message": "Gagal membaca format NIK."}), 400

@app.route('/api/public/cek-bansos/<nik>', methods=['GET'])
def public_cek_bansos(nik):
    w = Warga.query.filter_by(nik=nik).first()
    if not w:
        return jsonify({"status": "error", "message": "NIK Anda belum terdaftar dalam sistem."}), 404
    status_text, status_level = "Menunggu Diproses", 1
    if w.is_verified:
        status_text, status_level = "Disetujui (Layak Menerima)", 2
    return jsonify({
        "status": "success",
        "data": {
            "nama": w.nama,
            "nik": w.nik,
            "alamat": w.alamat,
            "status": status_text,
            "level": status_level
        }
    })

@app.route('/api/public/daftar', methods=['POST'])
def public_daftar():
    d = request.json or {}
    if not d.get('nik') or not d.get('nama'):
        return jsonify({"status": "error", "message": "NIK dan Nama wajib diisi."}), 400
    if Warga.query.filter_by(nik=d['nik']).first():
        return jsonify({"status": "error", "message": "NIK ini sudah terdaftar."}), 400

    is_in_bps = str(d['nik']).startswith('351501') or str(d['nik']).startswith('351502')
    catatan_public = f"[PENDAFTARAN MANDIRI] {d.get('catatan', '')}"
    if is_in_bps:
        catatan_public = "[✅ VALID BPS] " + catatan_public

    tgl_lhr = None
    if d.get('tanggal_lahir'):
        try:
            tgl_lhr = datetime.strptime(d['tanggal_lahir'], '%Y-%m-%d').date()
        except ValueError:
            pass

    new_w = Warga(
        nama=d['nama'],
        nik=d['nik'],
        no_hp=d.get('no_hp', ''),
        email=d.get('email', ''),
        tempat_lahir=d.get('tempat_lahir', ''),
        tanggal_lahir=tgl_lhr,
        alamat=d.get('alamat', ''),
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
    db.session.add(new_w)
    db.session.add(Notifikasi(pesan=f"Pendaftaran Mandiri: Warga baru bernama {d['nama']} (NIK: {d['nik']}) telah mengisi formulir secara online.", role_target='all'))
    db.session.commit()

    if d.get('email'):
        send_email_notification(
            d.get('email'),
            "Pendaftaran Bansos Diterima",
            f"<h3>Halo, {d['nama']}</h3><p>Pendaftaran Bansos Mandiri Anda berhasil masuk antrean verifikasi.</p>"
        )
    return jsonify({"status": "success", "message": "Pendaftaran berhasil."})

# ====================================================
# LIVE CHAT MULTIMEDIA (MAX 100MB)
# ====================================================
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/chat/list', methods=['GET'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.order_by(ChatKeluhan.waktu.asc()).all()
    rooms = {}
    for c in chats:
        last_msg = c.pesan
        if not last_msg:
            last_msg = "📷 Mengirim Foto" if c.file_type == 'image' else ("🎥 Mengirim Video" if c.file_type == 'video' else "📎 Mengirim Berkas")
        rooms[c.nik_warga] = {
            "nik": c.nik_warga,
            "nama": c.nama_warga,
            "last_msg": last_msg,
            "waktu": c.waktu.strftime("%H:%M | %d/%m")
        }
    return jsonify(list(rooms.values())[::-1])

@app.route('/api/chat/<nik>', methods=['GET'])
def get_chat(nik):
    chats = ChatKeluhan.query.filter_by(nik_warga=nik).order_by(ChatKeluhan.waktu.asc()).all()
    res = []
    for c in chats:
        res.append({
            "id": c.id,
            "sender": c.sender,
            "pesan": c.pesan,
            "file_path": f"/uploads/{c.file_path}" if c.file_path else None,
            "file_type": c.file_type,
            "waktu": c.waktu.strftime("%H:%M")
        })
    return jsonify(res)

@app.route('/api/chat/<nik>', methods=['POST'])
def post_chat(nik):
    sender = request.form.get('sender', 'warga')
    nama = request.form.get('nama', 'Warga')
    pesan = request.form.get('pesan', '')
    file = request.files.get('file')
    file_path = None
    file_type = None

    if file and file.filename:
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1).lower() if '.' in filename else ''
        if ext in ['jpg', 'jpeg', 'png', 'gif']:
            file_type = 'image'
        elif ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']:
            file_type = 'video'
        else:
            file_type = 'other'

        unique_name = f"{int(datetime.now().timestamp())}_{filename}"
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
    db.session.add(new_chat)

    if sender == 'warga':
        notif_pesan = f"Pesan Live Baru: {nama} mengirim teks/berkas multimedia."
        db.session.add(Notifikasi(pesan=notif_pesan, role_target='all'))

    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/public/keluhan', methods=['POST'])
def submit_keluhan():
    d = request.json or {}
    pesan_keluhan = d.get('pesan', '')
    nik = d.get('nik', 'Warga Umum')
    nama = d.get('nama', 'Anonim Publik')

    if pesan_keluhan:
        new_k = ChatKeluhan(nik_warga=nik, nama_warga=nama, sender='warga', pesan=pesan_keluhan)
        db.session.add(new_k)
        db.session.add(Notifikasi(pesan="LAPORAN LIVE: Warga mengirim pesan ke pusat.", role_target='all'))
        db.session.commit()
        return jsonify({"status": "success", "message": "Keluhan terkirim"})
    return jsonify({"status": "error", "message": "Pesan keluhan tidak boleh kosong."}), 400

# ====================================================
# CRUD DATA WARGA
# ====================================================
@app.route('/warga', methods=['GET', 'POST'])
@token_required
def manage_warga():
    if request.method == 'GET':
        warga = Warga.query.order_by(Warga.id.desc()).all()
        return jsonify([{
            'id': w.id,
            'nama': w.nama,
            'nik': w.nik,
            'no_hp': w.no_hp,
            'email': w.email,
            'c1_ekonomi': w.c1_ekonomi,
            'c2_aset': w.c2_aset,
            'c3_umur': w.c3_umur,
            'c4_jenis_kelamin': w.c4_jenis_kelamin,
            'c5_tanggungan': w.c5_tanggungan,
            'c6_status_pernikahan': w.c6_status_pernikahan,
            'c7_kepemilikan_anak': w.c7_kepemilikan_anak,
            'c8_tempat_tinggal': w.c8_tempat_tinggal,
            'c9_pendidikan': w.c9_pendidikan,
            'c10_kesehatan': w.c10_kesehatan,
            'is_verified': w.is_verified,
            'alamat': w.alamat,
            'tempat_lahir': w.tempat_lahir,
            'tanggal_lahir': str(w.tanggal_lahir) if w.tanggal_lahir else "",
            'catatan': w.catatan,
            'lat': w.latitude,
            'lng': w.longitude
        } for w in warga])
    elif request.method == 'POST':
        d = request.json or {}
        tgl = None
        if d.get('tanggal_lahir'):
            try:
                tgl = datetime.strptime(d['tanggal_lahir'], '%Y-%m-%d').date()
            except ValueError:
                pass

        new_w = Warga(
            nama=d.get('nama', ''),
            nik=d.get('nik', ''),
            no_hp=d.get('no_hp'),
            email=d.get('email'),
            tempat_lahir=d.get('tempat_lahir'),
            tanggal_lahir=tgl,
            alamat=d.get('alamat'),
            latitude=d.get('lat'),
            longitude=d.get('lng'),
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
            catatan=d.get('catatan')
        )
        db.session.add(new_w)
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/warga/<int:id>', methods=['DELETE', 'PUT'])
@token_required
def action_warga(id):
    w = Warga.query.get_or_404(id)
    if request.method == 'DELETE':
        db.session.delete(w)
        db.session.commit()
        return jsonify({"status": "deleted"})
    elif request.method == 'PUT':
        d = request.json or {}
        w.nama = d.get('nama', w.nama)
        w.nik = d.get('nik', w.nik)
        w.no_hp = d.get('no_hp', w.no_hp)
        w.email = d.get('email', w.email)
        w.alamat = d.get('alamat', w.alamat)
        w.tempat_lahir = d.get('tempat_lahir', w.tempat_lahir)
        if d.get('tanggal_lahir'):
            try:
                w.tanggal_lahir = datetime.strptime(d['tanggal_lahir'], '%Y-%m-%d').date()
            except ValueError:
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
        db.session.commit()
        return jsonify({"status": "success"})

@app.route('/warga/<int:id>/verify', methods=['PATCH'])
@token_required
def verify_warga(id):
    w = Warga.query.get_or_404(id)
    w.is_verified = not w.is_verified
    w.tanggal_verifikasi = datetime.now().date() if w.is_verified else None
    db.session.commit()
    return jsonify({"status": "success", "is_verified": w.is_verified})

@app.route('/warga/bulk', methods=['POST'])
@token_required
def bulk_insert():
    data_list = request.json.get('data', []) if request.json else []
    count = 0
    for d in data_list:
        nik_str = str(d.get('nik', '')).strip()
        if not nik_str:
            continue
        if not Warga.query.filter_by(nik=nik_str).first():
            new_w = Warga(
                nama=d.get('nama', 'Tanpa Nama'),
                nik=nik_str,
                no_hp=str(d.get('no_hp', '')),
                email=str(d.get('email', '')),
                alamat=str(d.get('alamat', '')),
                c1_ekonomi=safe_float(d.get('C1', d.get('c1_ekonomi', 0))),
                c2_aset=safe_int(d.get('C2', d.get('c2_aset', 0))),
                c3_umur=safe_int(d.get('C3', d.get('c3_umur', 0))),
                c4_jenis_kelamin=safe_int(d.get('C4', d.get('c4_jenis_kelamin', 1))),
                c5_tanggungan=safe_int(d.get('C5', d.get('c5_tanggungan', 0))),
                c6_status_pernikahan=safe_int(d.get('C6', d.get('c6_status_pernikahan', 1))),
                c7_kepemilikan_anak=safe_int(d.get('C7', d.get('c7_kepemilikan_anak', 0))),
                c8_tempat_tinggal=safe_int(d.get('C8', d.get('c8_tempat_tinggal', 1))),
                c9_pendidikan=safe_int(d.get('C9', d.get('c9_pendidikan', 1))),
                c10_kesehatan=safe_int(d.get('C10', d.get('c10_kesehatan', 1))),
                catatan="Diimpor dari File Excel"
            )
            db.session.add(new_w)
            count += 1
    db.session.commit()
    return jsonify({"status": "success", "message": f"{count} baris data berhasil diimpor!"})

@app.route('/warga/bulk/delete', methods=['POST'])
@token_required
def bulk_delete():
    ids = request.json.get('ids', []) if request.json else []
    if ids:
        Warga.query.filter(Warga.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
    return jsonify({"status": "success"})

@app.route('/warga/bulk/verify', methods=['POST'])
@token_required
def bulk_verify():
    ids = request.json.get('ids', []) if request.json else []
    if ids:
        wargas = Warga.query.filter(Warga.id.in_(ids)).all()
        for w in wargas:
            w.is_verified = True
            w.tanggal_verifikasi = datetime.now().date()
        db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/bps/sync', methods=['POST'])
@token_required
def sync_bps():
    import random
    dummy_bps_data = [{"nama": "Warga BPS Sidoarjo", "nik": f"351501{random.randint(1000000000, 9999999999)}", "c1": 850000, "alamat": "Sidoarjo"}]
    for d in dummy_bps_data:
        if not Warga.query.filter_by(nik=d['nik']).first():
            new_w = Warga(
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
                catatan="Sinkronisasi BPS"
            )
            db.session.add(new_w)
    db.session.commit()
    return jsonify({"status": "success", "message": "Data BPS disinkronkan."})

# ====================================================
# KRITERIA & SPK METODE (SAW & WP)
# ====================================================
@app.route('/kriteria', methods=['GET', 'POST'])
@token_required
def manage_kriteria():
    if request.method == 'POST':
        for i in request.json or []:
            k = Kriteria.query.filter_by(kode=i.get('kode')).first()
            if k and 'bobot' in i:
                k.bobot = float(i['bobot'])
        db.session.commit()
    return jsonify([{'kode': k.kode, 'nama': k.nama, 'bobot': k.bobot, 'jenis': k.jenis} for k in Kriteria.query.all()])

def hitung_saw_logic():
    warga_list = Warga.query.filter_by(is_verified=True).all()
    if not warga_list:
        warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list:
        return {'hasil_akhir': []}

    raw_data = [{
        'nama': w.nama, 'nik': w.nik,
        'C1': w.c1_ekonomi, 'C2': w.c2_aset, 'C3': w.c3_umur,
        'C4': w.c4_jenis_kelamin, 'C5': w.c5_tanggungan,
        'C6': w.c6_status_pernikahan, 'C7': w.c7_kepemilikan_anak,
        'C8': w.c8_tempat_tinggal, 'C9': w.c9_pendidikan, 'C10': w.c10_kesehatan
    } for w in warga_list]

    bobot = {k.kode: k.bobot for k in kriteria_list}
    jenis = {k.kode: k.jenis.lower() for k in kriteria_list}
    KRITERIA_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']

    vals = {k: [d[k] for d in raw_data] for k in KRITERIA_KEYS}
    min_max = {k: {'min': min(v) if v else 1, 'max': max(v) if v else 1} for k, v in vals.items()}

    matriks_normalisasi, hasil_akhir = [], []
    for w in raw_data:
        skor_total = 0
        norm_row = {'nama': w['nama'], 'nik': w['nik']}
        for k in KRITERIA_KEYS:
            val = w[k]
            if jenis.get(k) == 'cost':
                r = (min_max[k]['min'] / val) if val > 0 else 0
            else:
                r = (val / min_max[k]['max']) if min_max[k]['max'] > 0 else 0
            norm_row[k] = round(r, 4)
            skor_total += r * bobot.get(k, 0)
        matriks_normalisasi.append(norm_row)
        hasil_akhir.append({'nama': w['nama'], 'nik': w['nik'], 'skor_akhir': round(skor_total, 4)})

    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    total_warga = len(hasil_akhir)
    for idx, item in enumerate(hasil_akhir):
        desil_calc = int((idx / total_warga) * 10) + 1 if total_warga > 0 else 1
        if desil_calc > 10:
            desil_calc = 10
        item['desil'] = desil_calc
        if desil_calc <= 4:
            item['prioritas'] = "Diprioritaskan"
            item['menerima'] = "Menerima"
        else:
            item['prioritas'] = "Tidak Diprioritaskan"
            item['menerima'] = "Tidak Menerima"

    return {
        'metode': 'SAW (Dengan Bobot BWM)',
        'kriteria': [{'kode': k.kode, 'nama': k.nama, 'jenis': k.jenis, 'bobot': k.bobot} for k in kriteria_list],
        'min_max': min_max,
        'matriks_keputusan': raw_data,
        'matriks_normalisasi': matriks_normalisasi,
        'hasil_akhir': hasil_akhir
    }

def hitung_wp_logic():
    warga = Warga.query.filter_by(is_verified=True).all()
    if not warga:
        warga = Warga.query.all()
    kriteria = Kriteria.query.all()
    if not warga or not kriteria:
        return {'hasil_akhir': []}

    total_w = sum(k.bobot for k in kriteria) or 1.0
    w_norm = {k.kode: (k.bobot / total_w) for k in kriteria}
    jenis = {k.kode: k.jenis.lower() for k in kriteria}
    KRITERIA_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']

    s_vector, total_s = [], 0.0
    for w in warga:
        row = {
            'C1': w.c1_ekonomi, 'C2': w.c2_aset, 'C3': w.c3_umur,
            'C4': w.c4_jenis_kelamin, 'C5': w.c5_tanggungan,
            'C6': w.c6_status_pernikahan, 'C7': w.c7_kepemilikan_anak,
            'C8': w.c8_tempat_tinggal, 'C9': w.c9_pendidikan, 'C10': w.c10_kesehatan
        }
        s = 1.0
        for k in KRITERIA_KEYS:
            val = row[k] if row[k] > 0 else 1.0
            pangkat = -w_norm[k] if jenis.get(k) == 'cost' else w_norm[k]
            s *= math.pow(val, pangkat)
        s_vector.append({'nama': w.nama, 'nik': w.nik, 's': s})
        total_s += s

    hasil_akhir = []
    for item in s_vector:
        v = (item['s'] / total_s) if total_s > 0 else 0
        hasil_akhir.append({'nama': item['nama'], 'nik': item['nik'], 'skor_akhir': round(v, 4)})
    hasil_akhir.sort(key=lambda x: x['skor_akhir'], reverse=True)
    return {'hasil_akhir': hasil_akhir}

@app.route('/komparasi', methods=['GET'])
@token_required
def komparasi_metode():
    saw_data, wp_data = hitung_saw_logic(), hitung_wp_logic()
    data_saw = {
        x['nik']: {
            'skor': x['skor_akhir'],
            'rank': i + 1,
            'nama': x['nama'],
            'desil': x['desil'],
            'prioritas': x['prioritas'],
            'menerima': x['menerima']
        } for i, x in enumerate(saw_data.get('hasil_akhir', []))
    }
    data_wp = {
        x['nik']: {
            'skor': x['skor_akhir'],
            'rank': i + 1
        } for i, x in enumerate(wp_data.get('hasil_akhir', []))
    }
    res = [{
        'nama': val['nama'],
        'nik': nik,
        'saw_skor': val['skor'],
        'saw_rank': val['rank'],
        'wp_skor': data_wp.get(nik, {}).get('skor', 0),
        'wp_rank': data_wp.get(nik, {}).get('rank', 0),
        'desil': val['desil'],
        'prioritas': val['prioritas'],
        'menerima': val['menerima']
    } for nik, val in data_saw.items()]
    res.sort(key=lambda x: x['saw_rank'])
    return jsonify(res)

@app.route('/hitung-saw', methods=['GET'])
@token_required
def get_hitung_saw():
    return jsonify(hitung_saw_logic())

# ====================================================
# NOTIFIKASI
# ====================================================
@app.route('/api/notifikasi', methods=['GET'])
@token_required
def get_notifikasi():
    role = request.current_user.get('role', 'operator')
    query = Notifikasi.query.filter(Notifikasi.role_target.in_([role, 'all']))
    notifs = query.order_by(Notifikasi.is_pinned.desc(), Notifikasi.id.desc()).limit(30).all()
    hasil = [{
        "id": n.id,
        "pesan": n.pesan,
        "waktu": n.waktu.strftime("%H:%M | %d/%m"),
        "is_read": n.is_read,
        "is_pinned": n.is_pinned
    } for n in notifs]
    return jsonify(hasil)

@app.route('/api/notifikasi/<int:id>/read', methods=['PATCH'])
@token_required
def update_notifikasi(id):
    notif = Notifikasi.query.get_or_404(id)
    notif.is_read = not notif.is_read
    db.session.commit()
    return jsonify({"status": "success", "is_read": notif.is_read})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)