import os
from flask import Flask, send_from_directory
from app.config import Config
from app.extensions import db, cors, jwt
from app.middleware import setup_security_headers, register_error_handlers

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Direktori upload berkas
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Inisialisasi library
    db.init_app(app)
    cors.init_app(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    jwt.init_app(app)

    # Middleware keamanan & error handler
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

    @app.route('/static/uploads/<path:filename>')
    def serve_uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # Sinkronisasi tabel database
    with app.app_context():
        from app import models  # noqa: F401
        db.create_all()

    return app