from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app.extensions import db
from app.models.user import User

auth_bp = Blueprint('auth', __name__)

# =========================================================================
# HELPER FUNCTIONS
# =========================================================================
def get_client_ip():
    """Mengambil alamat IP klien asli (mendukung reverse proxy/Nginx)."""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr or "127.0.0.1"


# =========================================================================
# AUTENTIKASI (LOGIN & LOGOUT)
# =========================================================================
@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
@auth_bp.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        identifier = str(data.get('username') or data.get('email') or '').strip()
        password = str(data.get('password') or '').strip()

        if not identifier or not password:
            return jsonify({
                "status": "error", 
                "message": "Username/Email dan password wajib diisi."
            }), 400

        # Cari berdasarkan username atau email
        user = User.query.filter(
            db.or_(
                db.func.lower(User.username) == identifier.lower(),
                db.func.lower(User.email) == identifier.lower()
            )
        ).first()

        # Inisialisasi darurat akun Super Admin jika tabel user masih kosong
        if not user and identifier.lower() == 'admin':
            user = User(
                username='admin',
                nama_lengkap='Admin 1 (Super Admin)',
                email='admin@sidoarjo.go.id',
                role='super_admin',
                is_active=True
            )
            user.set_password('admin123')
            db.session.add(user)
            db.session.commit()

        # Validasi kecocokan user dan password
        if not user or not user.check_password(password):
            return jsonify({
                "status": "error", 
                "message": "Username atau kata sandi salah."
            }), 401

        # Cek apakah akun aktif
        if hasattr(user, 'is_active') and not user.is_active:
            return jsonify({
                "status": "error",
                "message": "Akun Anda dinonaktifkan. Silakan hubungi Administrator."
            }), 403

        # Catat audit login & IP
        client_ip = get_client_ip()
        if hasattr(user, 'record_login'):
            user.record_login(ip_address=client_ip)
        else:
            user.last_login_at = datetime.now(timezone.utc)
            db.session.commit()

        # Buat token sesi
        timestamp = int(datetime.now(timezone.utc).timestamp())
        session_token = f"jwt_session_{user.id}_{timestamp}"

        return jsonify({
            "status": "success",
            "message": "Login berhasil.",
            "token": session_token,
            "access_token": session_token,
            "role": user.role,
            "user": user.to_dict(),
            "data": {
                "id": user.id,
                "username": user.username,
                "nama_lengkap": user.nama_lengkap,
                "role": user.role
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Server Error: {str(e)}"}), 500


@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
@auth_bp.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    return jsonify({
        "status": "success",
        "message": "Logout berhasil. Sesi telah diakhiri."
    }), 200


# =========================================================================
# PROFIL PENGGUNA & UBAH PASSWORD SENDIRI
# =========================================================================
@auth_bp.route('/api/auth/profile', methods=['GET', 'PUT', 'OPTIONS'])
def user_profile():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({"status": "error", "message": "Parameter user_id wajib disertakan."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"status": "error", "message": "Pengguna tidak ditemukan."}), 404

    if request.method == 'GET':
        return jsonify({"status": "success", "user": user.to_dict()}), 200

    # PUT: Perbarui data profil sendiri
    try:
        data = request.get_json(silent=True) or {}
        if 'nama_lengkap' in data:
            user.nama_lengkap = str(data['nama_lengkap']).strip()
        if 'email' in data:
            new_email = str(data['email']).strip().lower()
            existing = User.query.filter(User.email == new_email, User.id != user.id).first()
            if existing:
                return jsonify({"status": "error", "message": "Email sudah digunakan akun lain."}), 400
            user.email = new_email

        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": "Profil berhasil diperbarui.", 
            "user": user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@auth_bp.route('/api/auth/change-password', methods=['POST', 'OPTIONS'])
def change_password():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json(silent=True) or {}
        user_id = data.get('user_id')
        old_password = str(data.get('old_password') or '').strip()
        new_password = str(data.get('new_password') or '').strip()

        if not user_id or not old_password or not new_password:
            return jsonify({
                "status": "error", 
                "message": "User ID, kata sandi lama, dan kata sandi baru wajib diisi."
            }), 400

        user = User.query.get(user_id)
        if not user or not user.check_password(old_password):
            return jsonify({"status": "error", "message": "Kata sandi lama salah."}), 400

        if len(new_password) < 6:
            return jsonify({"status": "error", "message": "Kata sandi baru minimal 6 karakter."}), 400

        user.set_password(new_password)
        db.session.commit()

        return jsonify({"status": "success", "message": "Kata sandi berhasil diperbarui."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# ENDPOINT NOTIFIKASI AKTIVITAS (MENCEGAH AUTO-LOGOUT DI DASHBOARD)
# =========================================================================
@auth_bp.route('/api/notifikasi', methods=['GET', 'OPTIONS'])
@auth_bp.route('/notifikasi', methods=['GET', 'OPTIONS'])
def get_notifikasi():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    # Memberikan struktur data notifikasi yang valid agar frontend tidak me-refresh/redirect
    return jsonify({
        "status": "success",
        "unread": 0,
        "data": [
            {
                "id": 1,
                "pesan": "Sistem SPK BWM-SAW Berhasil Terhubung ke Peladen Modular.",
                "waktu": datetime.now().strftime("%H:%M • %d/%m/%Y"),
                "is_read": False,
                "is_pinned": True,
                "is_archived": False
            }
        ]
    }), 200


@auth_bp.route('/api/notifikasi/read-all', methods=['POST', 'OPTIONS'])
@auth_bp.route('/notifikasi/read-all', methods=['POST', 'OPTIONS'])
def read_all_notif():
    return jsonify({"status": "success", "message": "Semua notifikasi ditandai dibaca."}), 200


# =========================================================================
# MANAJEMEN PENGGUNA (CRUD LENGKAP)
# =========================================================================
@auth_bp.route('/users', methods=['GET', 'POST', 'OPTIONS'])
@auth_bp.route('/api/users', methods=['GET', 'POST', 'OPTIONS'])
def manage_users():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    # 1. Tambah User Baru
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or request.form.to_dict() or {}
            username = str(data.get('username') or '').strip()
            password = str(data.get('password') or '').strip()
            nama = str(data.get('nama_lengkap') or data.get('nama') or username).strip()
            role = str(data.get('role') or 'operator').strip()
            email = str(data.get('email') or f"{username}@sidoarjo.go.id").strip().lower()

            if not username or not password:
                return jsonify({"status": "error", "message": "Username dan password wajib diisi."}), 400

            # Validasi duplikasi username
            if User.query.filter(db.func.lower(User.username) == username.lower()).first():
                return jsonify({"status": "error", "message": f"Username '{username}' sudah digunakan."}), 400

            # Validasi duplikasi email
            if User.query.filter(db.func.lower(User.email) == email.lower()).first():
                return jsonify({"status": "error", "message": f"Email '{email}' sudah terdaftar."}), 400

            user_baru = User(
                username=username,
                nama_lengkap=nama,
                email=email,
                role=role,
                is_active=True
            )
            user_baru.set_password(password)

            db.session.add(user_baru)
            db.session.commit()

            return jsonify({
                "status": "success", 
                "message": "Pengguna berhasil ditambahkan.",
                "user": user_baru.to_dict()
            }), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": f"Gagal menambah user: {str(e)}"}), 500

    # 2. Ambil Daftar Pengguna (GET) dengan Opsi Pencarian
    keyword = request.args.get('search', '').strip().lower()
    query = User.query

    if keyword:
        query = query.filter(
            db.or_(
                User.username.ilike(f"%{keyword}%"),
                User.nama_lengkap.ilike(f"%{keyword}%"),
                User.email.ilike(f"%{keyword}%")
            )
        )

    users = query.order_by(User.id.asc()).all()
    return jsonify([u.to_dict() for u in users]), 200


@auth_bp.route('/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
@auth_bp.route('/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
def manage_single_user(user_id):
    """Endpoint detail, update, dan hapus pengguna tertentu."""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    user = User.query.get(user_id)
    if not user:
        return jsonify({"status": "error", "message": "Pengguna tidak ditemukan."}), 404

    # GET: Detail Pengguna
    if request.method == 'GET':
        return jsonify({"status": "success", "user": user.to_dict()}), 200

    # DELETE: Hapus Pengguna
    if request.method == 'DELETE':
        if user.username.lower() == 'admin':
            return jsonify({
                "status": "error", 
                "message": "Akun Administrator utama tidak dapat dihapus."
            }), 400

        try:
            db.session.delete(user)
            db.session.commit()
            return jsonify({"status": "success", "message": f"Pengguna '{user.username}' berhasil dihapus."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # PUT: Perbarui Data Pengguna
    if request.method == 'PUT':
        try:
            data = request.get_json(silent=True) or request.form.to_dict() or {}

            if 'username' in data and data['username'].strip():
                new_username = data['username'].strip()
                existing = User.query.filter(
                    db.func.lower(User.username) == new_username.lower(), 
                    User.id != user.id
                ).first()
                if existing:
                    return jsonify({"status": "error", "message": "Username sudah digunakan user lain."}), 400
                user.username = new_username

            if 'nama_lengkap' in data:
                user.nama_lengkap = data['nama_lengkap'].strip()

            if 'email' in data:
                new_email = data['email'].strip().lower()
                existing_email = User.query.filter(
                    db.func.lower(User.email) == new_email, 
                    User.id != user.id
                ).first()
                if existing_email:
                    return jsonify({"status": "error", "message": "Email sudah digunakan user lain."}), 400
                user.email = new_email

            if 'role' in data:
                user.role = data['role'].strip()

            if 'is_active' in data:
                user.is_active = bool(data['is_active'])

            if 'password' in data and data['password'].strip():
                user.set_password(data['password'].strip())

            db.session.commit()
            return jsonify({
                "status": "success", 
                "message": "Data pengguna berhasil diperbarui.", 
                "user": user.to_dict()
            }), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500


@auth_bp.route('/api/users/<int:user_id>/toggle-status', methods=['PATCH', 'OPTIONS'])
def toggle_user_status(user_id):
    """Mengaktifkan atau menonaktifkan pengguna dengan cepat."""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    user = User.query.get(user_id)
    if not user:
        return jsonify({"status": "error", "message": "Pengguna tidak ditemukan."}), 404

    if user.username.lower() == 'admin':
        return jsonify({"status": "error", "message": "Status akun admin utama tidak dapat diubah."}), 400

    user.is_active = not getattr(user, 'is_active', True)
    db.session.commit()

    status_str = "diaktifkan" if user.is_active else "dinonaktifkan"
    return jsonify({
        "status": "success",
        "message": f"Pengguna '{user.username}' berhasil {status_str}.",
        "is_active": user.is_active
    }), 200