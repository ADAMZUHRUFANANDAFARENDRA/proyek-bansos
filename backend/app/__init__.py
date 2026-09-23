import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from app.config import Config
from app.extensions import db, cors, jwt
from app.middleware import setup_security_headers, register_error_handlers

def create_app(config_class=Config):
    app = Flask(__name__, static_folder='../static')
    app.config.from_object(config_class)

    # Direktori upload berkas fisik
    os.makedirs(app.config.get("UPLOAD_FOLDER", "static/uploads"), exist_ok=True)

    # -------------------------------------------------------------
    # KONFIGURASI CORS TERPUSAT (Mencegah "Failed to fetch")
    # -------------------------------------------------------------
    ALLOWED_ORIGINS = [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5000",
        "http://localhost:5000"
    ]

    cors.init_app(
        app,
        resources={
            r"/*": {
                "origins": ALLOWED_ORIGINS,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 600
            }
        }
    )

    # Inisialisasi ekstensi database dan JWT
    db.init_app(app)
    jwt.init_app(app)

    # Middleware keamanan & error handler sistem
    setup_security_headers(app)
    register_error_handlers(app)

    # Registrasi blueprint rute
    from app.routes.auth_routes import auth_bp
    from app.routes.warga_routes import warga_bp
    from app.routes.spk_routes import spk_bp
    from app.routes.chat_routes import chat_bp

    app.register_blueprint(auth_bp, url_prefix="")
    app.register_blueprint(warga_bp, url_prefix="")
    app.register_blueprint(spk_bp, url_prefix="")
    app.register_blueprint(chat_bp, url_prefix="")

    # Rute penyajian berkas statis (bukti penyaluran, avatar, media)
    @app.route('/static/uploads/<path:filename>')
    def serve_uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # Handler otomatis untuk Preflight Request OPTIONS & Header Fallback
    @app.after_request
    def add_cors_headers(response):
        origin = response.headers.get('Access-Control-Allow-Origin')
        if not origin:
            response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, X-Requested-With'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        return response

    # Sinkronisasi tabel database
    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

    return app