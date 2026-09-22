from datetime import datetime
from app.extensions import db

class Warga(db.Model):
    __tablename__ = "warga"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nik = db.Column(db.String(16), unique=True, nullable=False, index=True)
    nama = db.Column(db.String(150), nullable=False)
    tempat_lahir = db.Column(db.String(100), default="Sidoarjo")
    tanggal_lahir = db.Column(db.Date, nullable=True)
    alamat = db.Column(db.Text, nullable=True)
    email = db.Column(db.String(100), nullable=True)
    no_hp = db.Column(db.String(25), nullable=True)
    
    # Koordinat Peta Geotagging
    lat = db.Column(db.String(50), default="-7.4478")
    lng = db.Column(db.String(50), default="112.7183")

    # 10 Indikator Kriteria Multivariat SPK BWM-SAW
    c1 = db.Column(db.Float, default=1500000.0)    # Kondisi Ekonomi / Penghasilan (Cost)
    c2 = db.Column(db.Float, default=5000000.0)    # Nilai Aset Rumah Tangga (Cost)
    c3 = db.Column(db.Integer, default=45)          # Usia Kepala Keluarga (Benefit)
    c4 = db.Column(db.Integer, default=1)           # Jenis Kelamin Kepala Keluarga (Benefit)
    c5 = db.Column(db.Integer, default=3)           # Jumlah Tanggungan Keluarga (Benefit)
    c6 = db.Column(db.Integer, default=2)           # Status Pernikahan (Benefit)
    c7 = db.Column(db.Integer, default=2)           # Kepemilikan Anak Usia Sekolah (Benefit)
    c8 = db.Column(db.Integer, default=2)           # Status Kepemilikan Rumah (Cost)
    c9 = db.Column(db.Integer, default=1)           # Tingkat Pendidikan (Cost)
    c10 = db.Column(db.Integer, default=1)          # Kondisi Kesehatan Fisik (Benefit)

    # Status Validasi & Evaluasi Bantuan Sosial
    is_verified = db.Column(db.Boolean, default=False, index=True)
    status_validasi = db.Column(db.String(50), default="Menunggu")  # 'Menunggu', 'Disetujui', 'Ditolak'
    status_bansos = db.Column(db.String(50), default="Diproses")    # 'Menerima Bansos', 'Tidak Menerima', 'Diproses'
    status_salur = db.Column(db.String(100), default="Pending")     # 'Pending', 'Menunggu Konfirmasi Warga', 'Telah Menerima', 'Sengketa'
    nominal_bantuan = db.Column(db.String(50), default="BLT Rp 600.000")
    desil = db.Column(db.Integer, default=5)
    prioritas = db.Column(db.String(100), default="Ekonomi Cukup")
    skor_saw = db.Column(db.Float, default=0.0)
    catatan = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nik": self.nik,
            "nama": self.nama,
            "nama_lengkap": self.nama,
            "tempat_lahir": self.tempat_lahir,
            "tanggal_lahir": self.tanggal_lahir.strftime("%Y-%m-%d") if self.tanggal_lahir else None,
            "alamat": self.alamat or "Kabupaten Sidoarjo",
            "email": self.email or "-",
            "no_hp": self.no_hp or "-",
            "lat": self.lat,
            "lng": self.lng,
            "c1": self.c1,
            "c2": self.c2,
            "c3": self.c3,
            "c4": self.c4,
            "c5": self.c5,
            "c6": self.c6,
            "c7": self.c7,
            "c8": self.c8,
            "c9": self.c9,
            "c10": self.c10,
            "is_verified": self.is_verified,
            "status_validasi": self.status_validasi,
            "status_bansos": self.status_bansos,
            "status_salur": self.status_salur,
            "nominal_bantuan": self.nominal_bantuan,
            "desil": self.desil,
            "prioritas": self.prioritas,
            "skor_akhir": round(self.skor_saw, 4),
            "skor_saw": round(self.skor_saw, 4),
            "catatan": self.catatan or "",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else "-"
        }