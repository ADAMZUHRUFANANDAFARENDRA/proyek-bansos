from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app.extensions import db


class User(UserMixin, db.Model):
    """
    Model User yang menangani autentikasi, otorisasi role,
    dan pencatatan audit pengguna.
    """
    __tablename__ = "user"

    # ==========================================
    # Kolom Identitas & Kredensial
    # ==========================================
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    _password = db.Column("password", db.String(255), nullable=False)
    nama_lengkap = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(100), unique=True, nullable=True, index=True)
    role = db.Column(db.String(20), nullable=False, default="operator")  # 'super_admin', 'admin', 'operator'

    # ==========================================
    # Status & Audit Trail
    # ==========================================
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_login_ip = db.Column(db.String(45), nullable=True)  # Mendukung IPv4 dan IPv6
    created_at = db.Column(
        db.DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # ==========================================
    # Password Management (Property & Hashing)
    # ==========================================
    @property
    def password(self) -> str:
        """Mencegah pembacaan langsung field hash password."""
        raise AttributeError("Password tidak dapat dibaca secara langsung!")

    @password.setter
    def password(self, password_str: str) -> None:
        """Setter otomatis untuk menghash password baru."""
        self.set_password(password_str)

    @property
    def password_hash(self) -> str:
        """Alias kompatibilitas pustaka autentikasi."""
        return self._password

    def set_password(self, password_str: str) -> None:
        """Menghasilkan hash password standar PBKDF2."""
        if not password_str:
            raise ValueError("Password tidak boleh kosong.")
        self._password = generate_password_hash(password_str, method='pbkdf2:sha256')

    def check_password(self, password_str: str) -> bool:
        """
        Verifikasi kecocokan password.
        Mendukung verifikasi hash dan migrasi otomatis jika ada teks polos warisan.
        """
        if not self._password or not password_str:
            return False

        try:
            return check_password_hash(self._password, password_str)
        except ValueError:
            # Kompatibilitas mundur jika password tersimpan belum ter-hash
            if self._password == password_str:
                self.set_password(password_str)
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                return True
            return False

    # ==========================================
    # Role & Permission Helpers
    # ==========================================
    def has_role(self, *roles: str) -> bool:
        """Memeriksa apakah pengguna memiliki salah satu role yang ditentukan."""
        user_role = (self.role or "").lower()
        return user_role in [r.lower() for r in roles]

    @property
    def is_super_admin(self) -> bool:
        return self.has_role("super_admin")

    @property
    def is_admin(self) -> bool:
        return self.has_role("admin", "super_admin")

    @property
    def is_operator(self) -> bool:
        return self.has_role("operator", "petugas")

    # ==========================================
    # Manajemen Akun & Audit
    # ==========================================
    def activate(self) -> None:
        """Mengaktifkan akun pengguna."""
        self.is_active = True
        db.session.commit()

    def deactivate(self) -> None:
        """Menonaktifkan akun pengguna."""
        self.is_active = False
        db.session.commit()

    def record_login(self, ip_address: Optional[str] = None) -> None:
        """Mencatat waktu dan alamat IP saat pengguna berhasil login."""
        self.last_login_at = datetime.now(timezone.utc)
        if ip_address:
            self.last_login_ip = ip_address
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    # ==========================================
    # Static & Class Query Helpers
    # ==========================================
    @classmethod
    def find_by_id(cls, user_id: int) -> Optional["User"]:
        """Mencari user berdasarkan primary key."""
        return cls.query.get(user_id)

    @classmethod
    def find_by_username(cls, username: str) -> Optional["User"]:
        """Mencari user berdasarkan username (case-insensitive)."""
        return cls.query.filter(db.func.lower(cls.username) == username.lower().strip()).first()

    @classmethod
    def find_by_email(cls, email: str) -> Optional["User"]:
        """Mencari user berdasarkan alamat email."""
        if not email:
            return None
        return cls.query.filter(db.func.lower(cls.email) == email.lower().strip()).first()

    @classmethod
    def find_by_identifier(cls, identifier: str) -> Optional["User"]:
        """
        Mencari user melalui Username ATAU Email.
        Praktis untuk form login (Input: Username / Email).
        """
        clean_id = identifier.strip().lower()
        return cls.query.filter(
            db.or_(
                db.func.lower(cls.username) == clean_id,
                db.func.lower(cls.email) == clean_id
            )
        ).first()

    @classmethod
    def get_all_active(cls) -> List["User"]:
        """Mengambil seluruh user yang berstatus aktif."""
        return cls.query.filter_by(is_active=True).all()

    # ==========================================
    # Serialisasi Data (API / JSON)
    # ==========================================
    def to_dict(self, include_audit: bool = True) -> Dict[str, Any]:
        """
        Mengonversi objek User menjadi dictionary JSON-safe.
        Menyertakan sensor proteksi pada current_password untuk frontend admin.
        """
        data = {
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap or self.username,
            "email": self.email or "-",
            "role": self.role or "operator",
            "is_active": self.is_active,
            "current_password": "••••••••"
        }

        if include_audit:
            data.update({
                "last_login_at": self.last_login_at.strftime("%Y-%m-%d %H:%M:%S") if self.last_login_at else "-",
                "last_login_ip": self.last_login_ip or "-",
                "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "-",
                "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S") if self.updated_at else "-"
            })

        return data

    def __repr__(self) -> str:
        return f"<User id={self.id} username='{self.username}' role='{self.role}'>"