"""
=========================================================================
APP/__INIT__.PY - ARSITEKTUR APPLICATION FACTORY SISTEM SPK BANSOS SIDOARJO
Lokasi: backend/app/__init__.py
Pemerintah Kabupaten Sidoarjo - Dinas Sosial
Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (Metode BWM-SAW)
=========================================================================
"""

import os
import sys
import logging
from flask import Flask, send_from_directory, request, jsonify, make_response
from flask_cors import CORS
from app.config import Config
from app.extensions import db, jwt, cors
from app.middleware import setup_security_headers, register_error_handlers


def create_app(config_class=Config):
    """
    Menginisialisasi dan mengonfigurasi instance aplikasi Flask secara modular.
    Mencakup konfigurasi basis data adaptif, CORS multi-origin terbuka,
    manajemen sesi JWT lengkap, middleware keamanan, dan blueprint rute.
    """
    app = Flask(
        __name__,
        static_folder='../static',
        static_url_path='/static'
    )
    app.config.from_object(config_class)

    # ---------------------------------------------------------------------
    # 1. DIREKTORI PENYIMPANAN FISIK UNGGAHAN BERKAS (UPLOADS)
    # ---------------------------------------------------------------------
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    upload_folder = app.config.get(
        "UPLOAD_FOLDER",
        os.path.join(base_dir, "static", "uploads")
    )
    app.config["UPLOAD_FOLDER"] = upload_folder
    try:
        os.makedirs(upload_folder, exist_ok=True)
    except Exception as err_dir:
        print(f"[!] Gagal memverifikasi direktori upload: {err_dir}")

    # ---------------------------------------------------------------------
    # 2. INISIALISASI BASIS DATA & EKSTENSI UTAMA
    # ---------------------------------------------------------------------
    db.init_app(app)
    jwt.init_app(app)

    # ---------------------------------------------------------------------
    # 3. KONFIGURASI UNIVERSAL CORS (MULTI-ORIGIN LIVE SERVER 5500 / 5501)
    # Mencegah pemblokiran permintaan silang (Cross-Origin Request Blocked)
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
    # 4. HANDLER RESMI JWT TOKENS (KEAMANAN & MANAJEMEN SESI PENGGUNA)
    # Menjamin bila token expired/invalid, backend mengirim JSON terstruktur
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
            "message": f"Format token otentikasi tidak valid: {error_string}"
        }), 422

    @jwt.unauthorized_loader
    def missing_token_callback(error_string):
        return jsonify({
            "status": "error",
            "code": "TOKEN_MISSING",
            "message": "Permintaan otorisasi ditolak: Token autentikasi tidak disertakan."
        }), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "status": "error",
            "code": "TOKEN_REVOKED",
            "message": "Token autentikasi telah dicabut atau dinonaktifkan."
        }), 401

    @jwt.needs_fresh_token_loader
    def token_not_fresh_callback(jwt_header, jwt_payload):
        return jsonify({
            "status": "error",
            "code": "FRESH_TOKEN_REQUIRED",
            "message": "Operasi sensitif membutuhkan pembaruan token login."
        }), 401

    # ---------------------------------------------------------------------
    # 5. PENANGAN KESALAHAN HTTP GLOBAL (JSON ERROR RESPONSES)
    # ---------------------------------------------------------------------
    @app.errorhandler(400)
    def bad_request_error(e):
        return jsonify({"status": "error", "code": 400, "message": "Permintaan data tidak valid atau parameter salah."}), 400

    @app.errorhandler(404)
    def not_found_error(e):
        return jsonify({"status": "error", "code": 404, "message": "Endpoint rute API atau data yang diminta tidak ditemukan."}), 404

    @app.errorhandler(405)
    def method_not_allowed_error(e):
        return jsonify({"status": "error", "code": 405, "message": "Metode HTTP pada endpoint ini tidak diizinkan."}), 405

    @app.errorhandler(413)
    def file_too_large_error(e):
        return jsonify({"status": "error", "code": 413, "message": "Ukuran berkas unggahan melebihi batas kapasitas maksimum (16MB)."}), 413

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({"status": "error", "code": 500, "message": "Terjadi kendala internal pada pemrosesan peladen."}), 500

    # ---------------------------------------------------------------------
    # 6. MIDDLEWARE KEAMANAN & ERROR HANDLERS MODULAR
    # ---------------------------------------------------------------------
    try:
        setup_security_headers(app)
        register_error_handlers(app)
    except Exception as err_mid:
        print(f"[i] Info inisialisasi middleware sistem: {err_mid}")

    # ---------------------------------------------------------------------
    # 7. REGISTRASI BLUEPRINT RUTE MODULAR
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
    # 8. RUTE STATUS KESEHATAN SISTEM & ROOT PING
    # ---------------------------------------------------------------------
    @app.route('/')
    def root_endpoint():
        return jsonify({
            "service": "Sistem Pendukung Keputusan Bansos Pemkab Sidoarjo",
            "version": "2.5.0-Enterprise",
            "status": "online",
            "engine": "BWM-SAW Hybrid"
        }), 200

    @app.route('/api/health')
    @app.route('/api/ping')
    def health_check():
        return jsonify({
            "status": "healthy",
            "database": str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).split(":")[0],
            "timestamp": os.getenv("CURRENT_TIME", "2026-09-24")
        }), 200

    # ---------------------------------------------------------------------
    # 9. RUTE PENYAJIAN BERKAS STATIS (FOTO BUKTI SALUR & AVATAR)
    # ---------------------------------------------------------------------
    @app.route('/static/uploads/<path:filename>')
    @app.route('/uploads/<path:filename>')
    def serve_uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # ---------------------------------------------------------------------
    # 10. HOOK REQUEST: PREFLIGHT OPTIONS & HEADER INJECTION
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

        # Mencegah caching respons dinamis kependudukan pada peramban
        if request.path.startswith(('/api/', '/warga', '/users', '/notifikasi')):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

    # ---------------------------------------------------------------------
    # 11. SINKRONISASI STRUKTUR TABEL DATABASE ENGINE
    # ---------------------------------------------------------------------
    with app.app_context():
        try:
            from app import models  # noqa: F401
            db.create_all()
        except Exception as err_db:
            print(f"[i] Info sinkronisasi skema basis data: {err_db}")

    return app