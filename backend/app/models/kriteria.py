from datetime import datetime
from app.extensions import db

class Kriteria(db.Model):
    __tablename__ = "kriteria"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    kode = db.Column(db.String(10), unique=True, nullable=False, index=True)  # 'C1' - 'C10'
    nama = db.Column(db.String(100), nullable=False)
    jenis = db.Column(db.String(20), nullable=False)  # 'cost' atau 'benefit'
    bobot = db.Column(db.Float, nullable=False, default=0.1)
    keterangan = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "kode": self.kode,
            "nama": self.nama,
            "jenis": self.jenis.lower(),
            "bobot": round(float(self.bobot), 4),
            "keterangan": self.keterangan or ""
        }