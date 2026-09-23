from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Inisialisasi instance ekstensi utama aplikasi
db = SQLAlchemy()
cors = CORS()
jwt = JWTManager()