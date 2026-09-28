"""
=========================================================================
MODELS/WARGA.PY - MODEL ENTITAS DATA WARGA BANSOS SIDOARJO
Lokasi: backend/app/models/warga.py
=========================================================================
"""

from datetime import datetime
from app.extensions import db


class Warga(db.Model):
    __tablename__ = 'warga'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nik = db.Column(db.String(20), unique=True, nullable=False, index=True)
    nama = db.Column(db.String(150), nullable=False)
    tempat_lahir = db.Column(db.String(100), default='Sidoarjo')
    tanggal_lahir = db.Column(db.Date, nullable=True)
    alamat = db.Column(db.Text, nullable=True)
    no_hp = db.Column(db.String(25), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    lat = db.Column(db.String(50), default='-7.4478')
    lng = db.Column(db.String(50), default='112.7183')

    # 10 Kriteria BWM-SAW
    c1 = db.Column(db.Float, default=0.0)      # Kondisi Ekonomi (Cost)
    c2 = db.Column(db.Float, default=0.0)      # Nilai Aset (Cost)
    c3 = db.Column(db.Integer, default=0)     # Usia KK (Benefit)
    c4 = db.Column(db.Integer, default=1)     # Jenis Kelamin (Benefit)
    c5 = db.Column(db.Integer, default=0)     # Tanggungan (Benefit)
    c6 = db.Column(db.Integer, default=1)     # Pernikahan (Benefit)
    c7 = db.Column(db.Integer, default=0)     # Anak Sekolah (Benefit)
    c8 = db.Column(db.Integer, default=1)     # Status Rumah (Benefit)
    c9 = db.Column(db.Integer, default=1)     # Pendidikan (Cost)
    c10 = db.Column(db.Integer, default=1)    # Kesehatan/Disabilitas (Benefit)

    # Hasil Kalkulasi Algoritma SPK
    desil = db.Column(db.Integer, default=5, index=True)
    skor_saw = db.Column(db.Float, default=0.0)
    rank_saw = db.Column(db.Integer, default=0)

    # Status Validasi & Penyaluran
    is_verified = db.Column(db.Boolean, default=False, index=True)
    status_validasi = db.Column(db.String(50), default='Menunggu')
    status_salur = db.Column(db.String(50), default='Belum Salur')
    status_bansos = db.Column(db.String(50), default='Menunggu Verifikasi')
    prioritas = db.Column(db.String(50), default='Menunggu')
    bukti_salur = db.Column(db.String(255), nullable=True)
    catatan = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        tgl = ''
        if self.tanggal_lahir:
            try:
                tgl = self.tanggal_lahir.strftime('%Y-%m-%d')
            except Exception:
                tgl = str(self.tanggal_lahir)[:10]

        wkt = 'Hari ini'
        if self.created_at:
            try:
                wkt = self.created_at.strftime('%Y-%m-%d %H:%M')
            except Exception:
                wkt = str(self.created_at)[:16]

        return {
            "id": self.id,
            "nik": str(self.nik or ''),
            "nama": self.nama or 'Warga Sidoarjo',
            "tempat_lahir": self.tempat_lahir or 'Sidoarjo',
            "tanggal_lahir": tgl,
            "alamat": self.alamat or 'Kabupaten Sidoarjo',
            "no_hp": self.no_hp or '',
            "email": self.email or '',
            "lat": float(self.lat) if self.lat else -7.4478,
            "lng": float(self.lng) if self.lng else 112.7183,
            "c1": float(self.c1 or 0),
            "c2": float(self.c2 or 0),
            "c3": int(self.c3 or 0),
            "c4": int(self.c4 or 1),
            "c5": int(self.c5 or 0),
            "c6": int(self.c6 or 1),
            "c7": int(self.c7 or 0),
            "c8": int(self.c8 or 1),
            "c9": int(self.c9 or 1),
            "c10": int(self.c10 or 1),
            "desil": int(self.desil or 5),
            "skor_saw": float(self.skor_saw or 0.0),
            "is_verified": bool(self.is_verified),
            "status_validasi": self.status_validasi or ('Disetujui' if self.is_verified else 'Menunggu'),
            "status_salur": self.status_salur or 'Belum Salur',
            "bukti_salur": self.bukti_salur or '',
            "catatan": self.catatan or '',
            "created_at": wkt
        }