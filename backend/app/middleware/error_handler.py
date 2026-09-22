from flask import jsonify
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from app.extensions import db

def register_error_handlers(app):
    """Mendaftarkan penangan galat kustom untuk seluruh aplikasi."""

    @app.errorhandler(400)
    def bad_request_handler(e):
        return jsonify({
            "status": "error",
            "message": getattr(e, 'description', 'Permintaan data tidak valid (Bad Request).')
        }), 400

    @app.errorhandler(401)
    def unauthorized_handler(e):
        return jsonify({
            "status": "error",
            "message": getattr(e, 'description', 'Otentikasi diperlukan untuk mengakses sumber daya ini.')
        }), 401

    @app.errorhandler(403)
    def forbidden_handler(e):
        return jsonify({
            "status": "error",
            "message": getattr(e, 'description', 'Anda tidak memiliki hak akses ke fitur ini.')
        }), 403

    @app.errorhandler(404)
    def not_found_handler(e):
        return jsonify({
            "status": "error",
            "message": "Endpoint API atau sumber daya yang diminta tidak ditemukan."
        }), 404

    @app.errorhandler(405)
    def method_not_allowed_handler(e):
        return jsonify({
            "status": "error",
            "message": "Metode HTTP tidak diizinkan untuk endpoint ini."
        }), 405

    @app.errorhandler(OperationalError)
    @app.errorhandler(SQLAlchemyError)
    def database_error_handler(e):
        """Menangani pemutusan MySQL (Error 2003 / 10061) dan rollback otomatis agar pool tidak deadlock."""
        db.session.rollback()
        err_msg = str(e)
        
        is_connection_error = (
            "2003" in err_msg or 
            "Can't connect" in err_msg or 
            "10061" in err_msg or 
            "Connection refused" in err_msg
        )

        if is_connection_error:
            return jsonify({
                "status": "error",
                "code": "DB_CONNECTION_LOST",
                "message": "Gagal terhubung ke peladen database MySQL (Port 3306). Pastikan modul MySQL di XAMPP Control Panel dalam keadaan Start/Berjalan."
            }), 503

        return jsonify({
            "status": "error",
            "code": "DATABASE_ERROR",
            "message": "Terjadi kesalahan operasi pada basis data. Silakan coba kembali."
        }), 500

    @app.errorhandler(Exception)
    def internal_server_error_handler(e):
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "INTERNAL_SERVER_ERROR",
            "message": f"Terjadi gangguan pada peladen backend: {str(e)}"
        }), 500