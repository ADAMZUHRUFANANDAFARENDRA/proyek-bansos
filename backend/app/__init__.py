"""
=========================================================================
APP/__INIT__.PY - INISIALISASI UTAMA & ARSITEKTUR APLIKASI FLASK MODULAR
Lokasi: backend/app/__init__.py
PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (BWM-SAW)
=========================================================================
"""

import os
from flask import Flask, send_from_directory, request, jsonify, make_response
from flask_cors import CORS
from app.config import Config
from app.extensions import db, cors, jwt
from app.middleware import setup_security_headers, register_error_handlers


def create_app(config_class=Config):
    """
    Application Factory Pattern untuk Sistem SPK Bansos Kabupaten Sidoarjo.
    Menginisialisasi konfigurasi, ekstensi, sistem keamanan CORS,
    penanganan JWT token, routing modular (Blueprints), dan database engine.
    """
    app = Flask(
        __name__,
        static_folder='../static',
        static_url_path='/static'
    )
    app.config.from_object(config_class)

    # ---------------------------------------------------------------------
    # 1. DIREKTORI PENYIMPANAN UNGGAHAN FISIK (UPLOADS)
    # ---------------------------------------------------------------------
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    upload_folder = app.config.get(
        "UPLOAD_FOLDER",
        os.path.join(base_dir, "static", "uploads")
    )
    app.config["UPLOAD_FOLDER"] = upload_folder
    os.makedirs(upload_folder, exist_ok=True)

    # ---------------------------------------------------------------------
    # 2. INISIALISASI BASIS DATA & EKSTENSI UTAMA
    # ---------------------------------------------------------------------
    db.init_app(app)
    jwt.init_app(app)

    # ---------------------------------------------------------------------
    # 3. KONFIGURASI CORS MULTI-ORIGIN & UNIVERSAL COMPATIBILITY
    # Mencegah galat 'Failed to fetch' dari Live Server (port 5500, 5501, 5000)
    # ---------------------------------------------------------------------
    ALLOWED_ORIGINS = [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5000",
        "http://localhost:5000",
        "http://0.0.0.0:5000",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ]

    CORS(
        app,
        resources={
            r"/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "X-Requested-With",
                    "Origin",
                    "Access-Control-Request-Method",
                    "Access-Control-Request-Headers"
                ],
                "expose_headers": [
                    "Content-Type",
                    "Authorization",
                    "Content-Disposition"
                ],
                "supports_credentials": True,
                "max_age": 86400
            }
        }
    )

    cors.init_app(
        app,
        resources={
            r"/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "X-Requested-With",
                    "Origin"
                ],
                "expose_headers": [
                    "Content-Type",
                    "Authorization"
                ],
                "supports_credentials": True,
                "max_age": 86400
            }
        }
    )

    # ---------------------------------------------------------------------
    # 4. HANDLER RESMI JWT TOKENS (SISTEM KEAMANAN OTENTIKASI)
    # Menjamin bila token expired/invalid, sistem merespons JSON bersih
    # ---------------------------------------------------------------------
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "status": "error",
            "code": "TOKEN_EXPIRED",
            "message": "Sesi autentikasi telah kedaluwarsa. Silakan masuk kembali."
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        return jsonify({
            "status": "error",
            "code": "TOKEN_INVALID",
            "message": f"Token autentikasi tidak valid: {error_string}"
        }), 422

    @jwt.unauthorized_loader
    def missing_token_callback(error_string):
        return jsonify({
            "status": "error",
            "code": "TOKEN_MISSING",
            "message": "Permintaan otorisasi ditolak: Token tidak ditemukan."
        }), 401

    # ---------------------------------------------------------------------
    # 5. MIDDLEWARE KEAMANAN & ERROR HANDLERS
    # ---------------------------------------------------------------------
    try:
        setup_security_headers(app)
        register_error_handlers(app)
    except Exception as err_mid:
        print(f"[!] Catatan inisialisasi middleware keamanan: {err_mid}")

    # ---------------------------------------------------------------------
    # 6. REGISTRASI SELURUH BLUEPRINT RUTE MODULAR SISTEM
    # ---------------------------------------------------------------------
    from app.routes.warga_routes import warga_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.spk_routes import spk_bp
    from app.routes.chat_routes import chat_bp

    app.register_blueprint(warga_bp, url_prefix="")
    app.register_blueprint(auth_bp, url_prefix="")
    app.register_blueprint(spk_bp, url_prefix="")
    app.register_blueprint(chat_bp, url_prefix="")

    # ---------------------------------------------------------------------
    # 7. RUTE PENYAJIAN BERKAS STATIS (FOTO BUKTI SALUR & AVATAR)
    # ---------------------------------------------------------------------
    @app.route('/static/uploads/<path:filename>')
    @app.route('/uploads/<path:filename>')
    def serve_uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # ---------------------------------------------------------------------
    # 8. HANDLER PREFLIGHT OPTIONS & DYNAMIC HEADER RESPONSES
    # Menghilangkan kegagalan 'Failed to fetch' saat frontend memanggil API
    # ---------------------------------------------------------------------
    @app.before_request
    def handle_preflight_options():
        if request.method == "OPTIONS":
            response = make_response()
            origin = request.headers.get("Origin")
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
            else:
                response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization, Accept, X-Requested-With, Origin, "
                "Access-Control-Request-Method, Access-Control-Request-Headers"
            )
            response.headers["Access-Control-Max-Age"] = "86400"
            return response

    @app.after_request
    def add_cors_and_cache_headers(response):
        origin = request.headers.get("Origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, Accept, X-Requested-With, Origin, "
            "Access-Control-Request-Method, Access-Control-Request-Headers"
        )
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"

        # Mencegah peramban menyimpan cache respons API agar metrik data selalu mutakhir
        if request.path.startswith("/api/") or request.path.startswith("/warga") or request.path.startswith("/users"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

    # ---------------------------------------------------------------------
    # 9. SINKRONISASI STRUKTUR TABEL DATABASE ENGINE
    # ---------------------------------------------------------------------
    with app.app_context():
        try:
            from app import models  # noqa: F401
            db.create_all()
        except Exception as err_db:
            print(f"[!] Catatan sinkronisasi skema tabel database: {err_db}")

    return app