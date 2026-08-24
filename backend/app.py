import os
import json
import secrets
import math
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Konfigurasi Database (Terkoneksi otomatis ke container 'db' di Docker)
DB_HOST = os.environ.get('DB_HOST', 'db')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASS = os.environ.get('DB_PASSWORD', 'password_rahasia_dinsos')
DB_NAME = os.environ.get('DB_NAME', 'bansos')

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'SQLALCHEMY_DATABASE_URI',
    f'mysql+mysqlconnector://{DB_USER}:{DB_PASS}@{DB_HOST}:3306/{DB_NAME}'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'kunci_rahasia_pemkab_sidoarjo_2026'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # Batas upload 100 MB

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/*": {"origins": "*"}})

ACTIVE_SESSIONS = {}
LOGIN_ATTEMPTS = {}

def safe_float(val, default=0.0):
    try:
        return float(val) if val is not None and str(val).strip() != '' else default
    except:
        return default

def safe_int(val, default=0):
    try:
        return int(val) if val is not None and str(val).strip() != '' else default
    except:
        return default

# ====================================================
# STRUKTUR TABEL DATABASE
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
    foto_rumah = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.String(50), nullable=True)
    longitude = db.Column(db.String(50), nullable=True)
    catatan = db.Column(db.Text, nullable=True)
    status_salur = db.Column(db.String(20), default='Pending')
    created_at = db.Column(db.DateTime, default=datetime.now)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='operator')  # 'admin' atau 'operator'
    created_at = db.Column(db.DateTime, default=datetime.now)

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
    kategori = db.Column(db.String(30), default='sistem')  # 'auth_login', 'pendataan', 'laporan_warga', 'sistem'
    urgensi = db.Column(db.String(20), default='sedang')   # 'tinggi', 'sedang', 'rendah'
    role_target = db.Column(db.String(20), default='all')
    waktu = db.Column(db.DateTime, default=datetime.now)
    is_read = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)

class ChatKeluhan(db.Model):
    __tablename__ = 'chat_keluhan'
    id = db.Column(db.Integer, primary_key=True)
    nik_warga = db.Column(db.String(20), nullable=False)
    nama_warga = db.Column(db.String(100), nullable=False)
    sender = db.Column(db.String(20), nullable=False)
    pesan = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), default='text')  # 'text', 'image', 'video', 'audio', 'sticker'
    reply_to_id = db.Column(db.Integer, nullable=True)
    reactions = db.Column(db.Text, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)
    waktu = db.Column(db.DateTime, default=datetime.now)

# ====================================================
# MIDDLEWARE ROLE & SECURITY
# ====================================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip() or request.args.get('token', '').strip()
        if not token or token not in ACTIVE_SESSIONS:
            return jsonify({"status": "error", "message": "Akses Ditolak. Sesi Anda tidak valid."}), 401
        request.current_user = ACTIVE_SESSIONS[token]
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip() or request.args.get('token', '').strip()
        if not token or token not in ACTIVE_SESSIONS:
            return jsonify({"status": "error", "message": "Sesi tidak valid."}), 401
        user_sess = ACTIVE_SESSIONS[token]
        if user_sess.get('role') != 'admin':
            return jsonify({"status": "error", "message": "Fitur ini khusus untuk Administrator Dinas."}), 403
        request.current_user = user_sess
        return f(*args, **kwargs)
    return decorated

# ====================================================
# INISIALISASI & AUTENTIKASI
# ====================================================
@app.route('/init-kriteria', methods=['GET'])
def init_kriteria():
    db.create_all()
    if Kriteria.query.count() == 0:
        db.session.add_all([
            Kriteria(kode='C1', nama='Kondisi Ekonomi', bobot=0.23, jenis='cost'),
            Kriteria(kode='C2', nama='Kepemilikan Aset', bobot=0.16, jenis='cost'),
            Kriteria(kode='C3', nama='Umur', bobot=0.11, jenis='benefit'),
            Kriteria(kode='C4', nama='Jenis Kelamin', bobot=0.05, jenis='benefit'),
            Kriteria(kode='C5', nama='Jumlah Tanggungan', bobot=0.14, jenis='benefit'),
            Kriteria(kode='C6', nama='Status Pernikahan', bobot=0.07, jenis='benefit'),
            Kriteria(kode='C7', nama='Kepemilikan Anak', bobot=0.09, jenis='benefit'),
            Kriteria(kode='C8', nama='Kondisi Tempat Tinggal', bobot=0.10, jenis='benefit'),
            Kriteria(kode='C9', nama='Pendidikan', bobot=0.03, jenis='cost'),
            Kriteria(kode='C10', nama='Kesehatan', bobot=0.02, jenis='benefit')
        ])
    if not User.query.filter_by(username='admin').first():
        db.session.add(User(username='admin', password=bcrypt.generate_password_hash('admin123').decode('utf-8'), role='admin'))
    if not User.query.filter_by(username='petugas').first():
        db.session.add(User(username='petugas', password=bcrypt.generate_password_hash('12345').decode('utf-8'), role='operator'))
    db.session.commit()
    return jsonify({"status": "success", "message": "Database, 10 Kriteria BWM, Admin, dan Petugas berhasil diinisialisasi!"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    user = User.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password, password):
        token = secrets.token_hex(32)
        ACTIVE_SESSIONS[token] = {"username": user.username, "role": user.role}
        
        # Notifikasi Aktivitas Login
        db.session.add(Notifikasi(
            pesan=f"Sistem: {user.username} ({user.role}) berhasil masuk ke Dashboard.",
            kategori='auth_login',
            urgensi='rendah',
            role_target='all'
        ))
        db.session.commit()
        return jsonify({
            "status": "success",
            "access_token": token,
            "data": {"username": user.username, "role": user.role}
        })
    return jsonify({"status": "fail", "message": "Username atau Password salah."}), 401

# ====================================================
# PORTAL PUBLIK WARGA (CEK STATUS & DAFTAR MANDIRI)
# ====================================================
@app.route('/api/public/cek-bansos/<nik>', methods=['GET'])
def public_cek_bansos(nik):
    w = Warga.query.filter_by(nik=str(nik).strip()).first()
    if not w:
        return jsonify({"status": "error", "message": "NIK Anda belum terdaftar dalam sistem."}), 404
        
    status_text = "Menunggu Verifikasi Ground Check"
    status_level = 1
    if w.is_verified:
        status_text = "Disetujui (Memenuhi Syarat Kelayakan)"
        status_level = 2
    if w.status_salur == 'Tersalurkan':
        status_text = "Bantuan Telah Disalurkan"
        status_level = 3
        
    return jsonify({
        "status": "success",
        "data": {
            "nama": w.nama,
            "nik": w.nik,
            "alamat": w.alamat,
            "status": status_text,
            "status_salur": w.status_salur,
            "level": status_level,
            "is_verified": w.is_verified,
            "catatan": w.catatan or "-"
        }
    })

@app.route('/api/public/daftar', methods=['POST'])
def public_daftar():
    d = request.json or {}
    nik = str(d.get('nik', '')).strip()
    if not nik or len(nik) != 16:
        return jsonify({"status": "error", "message": "NIK harus 16 digit angka."}), 400
    if Warga.query.filter_by(nik=nik).first():
        return jsonify({"status": "error", "message": "NIK ini sudah terdaftar sebelumnya."}), 400

    new_w = Warga(
        nama=d.get('nama', '').strip(), nik=nik,
        no_hp=d.get('no_hp', ''), email=d.get('email', ''),
        alamat=d.get('alamat', ''),
        c1_ekonomi=safe_float(d.get('c1')), c2_aset=safe_int(d.get('c2')),
        c3_umur=safe_int(d.get('c3')), c4_jenis_kelamin=safe_int(d.get('c4', 1)),
        c5_tanggungan=safe_int(d.get('c5')), c6_status_pernikahan=safe_int(d.get('c6', 1)),
        c7_kepemilikan_anak=safe_int(d.get('c7')), c8_tempat_tinggal=safe_int(d.get('c8', 1)),
        c9_pendidikan=safe_int(d.get('c9', 1)), c10_kesehatan=safe_int(d.get('c10', 1)),
        catatan=f"[DAFTAR MANDIRI] {d.get('catatan', '')}",
        is_verified=False
    )
    db.session.add(new_w)
    db.session.add(Notifikasi(
        pesan=f"Pendaftaran Mandiri: Warga baru {new_w.nama} (NIK: {new_w.nik}) telah mendaftar online.",
        kategori='pendataan',
        urgensi='sedang',
        role_target='all'
    ))
    db.session.commit()
    return jsonify({"status": "success", "message": "Pendaftaran mandiri berhasil disimpan."})

# ====================================================
# ARSIP DATA WARGA (ADMIN & PETUGAS)
# ====================================================
@app.route('/warga', methods=['GET', 'POST'])
@token_required
def manage_warga():
    if request.method == 'GET':
        wargas = Warga.query.order_by(Warga.id.desc()).all()
        return jsonify([{
            'id': w.id, 'nama': w.nama, 'nik': w.nik, 'no_hp': w.no_hp, 'email': w.email,
            'alamat': w.alamat, 'c1_ekonomi': w.c1_ekonomi, 'c2_aset': w.c2_aset,
            'c3_umur': w.c3_umur, 'c4_jenis_kelamin': w.c4_jenis_kelamin,
            'c5_tanggungan': w.c5_tanggungan, 'c6_status_pernikahan': w.c6_status_pernikahan,
            'c7_kepemilikan_anak': w.c7_kepemilikan_anak, 'c8_tempat_tinggal': w.c8_tempat_tinggal,
            'c9_pendidikan': w.c9_pendidikan, 'c10_kesehatan': w.c10_kesehatan,
            'is_verified': w.is_verified, 'status_salur': w.status_salur,
            'catatan': w.catatan, 'lat': w.latitude, 'lng': w.longitude
        } for w in wargas])
        
    elif request.method == 'POST':
        d = request.json or {}
        new_w = Warga(
            nama=d.get('nama', '').strip(), nik=str(d.get('nik', '')).strip(),
            no_hp=d.get('no_hp'), email=d.get('email'), alamat=d.get('alamat'),
            c1_ekonomi=safe_float(d.get('c1')), c2_aset=safe_int(d.get('c2')),
            c3_umur=safe_int(d.get('c3')), c4_jenis_kelamin=safe_int(d.get('c4', 1)),
            c5_tanggungan=safe_int(d.get('c5')), c6_status_pernikahan=safe_int(d.get('c6', 1)),
            c7_kepemilikan_anak=safe_int(d.get('c7')), c8_tempat_tinggal=safe_int(d.get('c8', 1)),
            c9_pendidikan=safe_int(d.get('c9', 1)), c10_kesehatan=safe_int(d.get('c10', 1)),
            catatan=d.get('catatan'), is_verified=False
        )
        db.session.add(new_w)
        db.session.add(Notifikasi(
            pesan=f"Pendataan: {request.current_user['username']} menambahkan data {new_w.nama} (NIK: {new_w.nik}).",
            kategori='pendataan',
            urgensi='sedang',
            role_target='all'
        ))
        db.session.commit()
        return jsonify({"status": "success", "id": new_w.id})

# HANYA ADMIN YANG BERHAK MEMVERIFIKASI
@app.route('/warga/<int:id>/verify', methods=['PATCH'])
@admin_required
def verify_warga(id):
    w = Warga.query.get_or_404(id)
    w.is_verified = not w.is_verified
    w.tanggal_verifikasi = datetime.now().date() if w.is_verified else None
    
    db.session.add(Notifikasi(
        pesan=f"Verifikasi: {w.nama} (NIK: {w.nik}) telah {'DISETUJUI' if w.is_verified else 'DIBATALKAN'} oleh Administrator.",
        kategori='sistem',
        urgensi='sedang',
        role_target='all'
    ))
    db.session.commit()
    return jsonify({"status": "success", "is_verified": w.is_verified})

# ====================================================
# NOTIFIKASI AKTIVITAS (URGENSI & PIN)
# ====================================================
@app.route('/api/notifikasi', methods=['GET'])
@token_required
def get_notifikasi():
    notifs = Notifikasi.query.order_by(Notifikasi.is_pinned.desc(), Notifikasi.id.desc()).limit(50).all()
    return jsonify([{
        "id": n.id,
        "pesan": n.pesan,
        "kategori": n.kategori,
        "urgensi": n.urgensi,
        "is_pinned": n.is_pinned,
        "is_read": n.is_read,
        "waktu": n.waktu.strftime("%H:%M | %d/%m/%Y")
    } for n in notifs])

@app.route('/api/notifikasi/<int:id>/pin', methods=['PATCH'])
@token_required
def pin_notifikasi(id):
    n = Notifikasi.query.get_or_404(id)
    n.is_pinned = not n.is_pinned
    db.session.commit()
    return jsonify({"status": "success", "is_pinned": n.is_pinned})

# ====================================================
# PERHITUNGAN BWM-SAW (TRANSPARANSI ANGKA LENGKAP)
# ====================================================
@app.route('/hitung-saw', methods=['GET'])
@token_required
def get_hitung_saw():
    warga_list = Warga.query.filter_by(is_verified=True).all()
    if not warga_list:
        warga_list = Warga.query.all()
    kriteria_list = Kriteria.query.all()
    if not warga_list or not kriteria_list:
        return jsonify({'hasil_akhir': [], 'matriks_keputusan': [], 'matriks_normalisasi': []})
        
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
    
    min_max = {}
    for k in KRITERIA_KEYS:
        vals = [d[k] for d in raw_data]
        valid_vals = [v for v in vals if v > 0]
        min_v = min(valid_vals) if valid_vals else 1.0
        max_v = max(vals) if vals else 1.0
        min_max[k] = {'min': min_v, 'max': max_v}
        
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
            r = min(max(r, 0.0), 1.0)
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
        desil = int((idx / total_warga) * 10) + 1 if total_warga > 0 else 1
        item['rank'] = idx + 1
        item['desil'] = min(desil, 10)
        item['prioritas'] = "Prioritas Sangat Tinggi" if desil <= 2 else ("Prioritas Tinggi" if desil <= 4 else "Tidak Prioritas")
        item['menerima'] = "Layak Menerima Bansos" if desil <= 4 else "Tidak Menerima"
        
    return jsonify({
        'metode': 'Integrasi BWM (Pembobotan) & SAW (Perangkingan)',
        'kriteria': [{'kode': k.kode, 'nama': k.nama, 'jenis': k.jenis, 'bobot': k.bobot} for k in kriteria_list],
        'min_max': min_max,
        'matriks_keputusan': raw_data,
        'matriks_normalisasi': matriks_normalisasi,
        'hasil_akhir': hasil_akhir
    })

# ====================================================
# LIVE CHAT & LAPORAN WARGA (URGENSI TINGGI)
# ====================================================
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/chat/list', methods=['GET'])
@token_required
def chat_list():
    chats = ChatKeluhan.query.filter_by(is_deleted=False).order_by(ChatKeluhan.waktu.asc()).all()
    rooms = {}
    for c in chats:
        preview = c.pesan if c.pesan else "Lampiran Berkas"
        if c.file_type == 'audio': preview = "🎤 Pesan Suara"
        elif c.file_type == 'sticker': preview = "🎭 Stiker"
        elif c.file_type == 'image': preview = "📷 Foto"
        elif c.file_type == 'video': preview = "🎥 Video"
        
        rooms[c.nik_warga] = {
            "nik": c.nik_warga, "nama": c.nama_warga,
            "last_msg": preview, "waktu": c.waktu.strftime("%H:%M | %d/%m")
        }
    return jsonify(list(rooms.values())[::-1])

@app.route('/api/chat/<nik>', methods=['GET'])
def get_chat(nik):
    chats = ChatKeluhan.query.filter_by(nik_warga=str(nik).strip()).order_by(ChatKeluhan.waktu.asc()).all()
    res = []
    for c in chats:
        reactions_dict = {}
        if c.reactions:
            try: reactions_dict = json.loads(c.reactions)
            except: pass
        res.append({
            "id": c.id, "sender": c.sender,
            "pesan": "🚫 Pesan ini telah dihapus" if c.is_deleted else c.pesan,
            "file_path": f"/uploads/{c.file_path}" if (c.file_path and not c.is_deleted) else None,
            "file_type": c.file_type, "reply_to_id": c.reply_to_id,
            "reactions": reactions_dict, "is_deleted": c.is_deleted,
            "waktu": c.waktu.strftime("%H:%M")
        })
    return jsonify(res)

@app.route('/api/chat/<nik>', methods=['POST'])
def post_chat(nik):
    sender = request.form.get('sender', 'warga')
    nama = request.form.get('nama', 'Warga')
    pesan = request.form.get('pesan', '')
    reply_to_id = request.form.get('reply_to_id')
    file_type = request.form.get('file_type', 'text')
    
    file = request.files.get('file')
    file_path = None
    if file:
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']: file_type = 'image'
        elif ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']: file_type = 'video'
        elif ext in ['mp3', 'wav', 'ogg', 'm4a']: file_type = 'audio'
        
        unique_name = f"{int(datetime.now().timestamp())}_{filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_name))
        file_path = unique_name
        
    new_c = ChatKeluhan(
        nik_warga=str(nik).strip(), nama_warga=nama, sender=sender,
        pesan=pesan, file_path=file_path, file_type=file_type,
        reply_to_id=int(reply_to_id) if reply_to_id and str(reply_to_id).isdigit() else None
    )
    db.session.add(new_c)
    
    if sender == 'warga':
        db.session.add(Notifikasi(
            pesan=f"Laporan Masuk: {nama} (NIK: {nik}) menyampaikan: \"{pesan[:35]}...\"",
            kategori='laporan_warga',
            urgensi='tinggi',
            role_target='all'
        ))
    db.session.commit()
    return jsonify({"status": "success", "chat_id": new_c.id})

@app.route('/api/chat/<int:chat_id>/reaction', methods=['POST'])
def add_reaction(chat_id):
    c = ChatKeluhan.query.get_or_404(chat_id)
    emoji = (request.json or {}).get('emoji', '👍')
    reactions_dict = {}
    if c.reactions:
        try: reactions_dict = json.loads(c.reactions)
        except: pass
    reactions_dict[emoji] = reactions_dict.get(emoji, 0) + 1
    c.reactions = json.dumps(reactions_dict)
    db.session.commit()
    return jsonify({"status": "success", "reactions": reactions_dict})

@app.route('/api/chat/<int:chat_id>', methods=['DELETE'])
def delete_chat_msg(chat_id):
    c = ChatKeluhan.query.get_or_404(chat_id)
    c.is_deleted = True
    db.session.commit()
    return jsonify({"status": "success", "message": "Pesan berhasil dihapus."})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)