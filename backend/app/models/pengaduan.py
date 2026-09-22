from datetime import datetime
from app.extensions import db

class Pengaduan(db.Model):
    __tablename__ = "pengaduan"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nik = db.Column(db.String(16), nullable=False, index=True)
    nama_pelapor = db.Column(db.String(150), nullable=False)
    kategori = db.Column(db.String(100), nullable=False)
    isi_laporan = db.Column(db.Text, nullable=False)
    
    # Status Alur Penanganan (Stepper 1 s.d. 4)
    status_step = db.Column(db.Integer, default=2)
    status_text = db.Column(db.String(100), default="Ditinjau Petugas")
    catatan_petugas = db.Column(db.Text, default="Petugas sedang meninjau berkas Anda.")
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nik": self.nik,
            "nama": self.nama_pelapor,
            "nama_pelapor": self.nama_pelapor,
            "kategori": self.kategori,
            "uraian": self.isi_laporan,
            "isi_laporan": self.isi_laporan,
            "status_step": self.status_step,
            "status_text": self.status_text,
            "catatan_petugas": self.catatan_petugas,
            "tanggal": self.created_at.strftime("%d %b %Y %H:%M") if self.created_at else "-"
        }