from datetime import datetime
from app.extensions import db

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nik = db.Column(db.String(16), nullable=False, index=True)
    sender = db.Column(db.String(20), nullable=False)  # 'warga', 'admin', 'petugas'
    nama = db.Column(db.String(100), nullable=False)
    pesan = db.Column(db.Text, nullable=True)
    
    # Berkas Multimedia & Pesan Suara
    file_path = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)  # 'image', 'video', 'audio', 'document'
    
    # Interaksi Balasan & Reaksi
    reply_to_id = db.Column(db.Integer, nullable=True)
    reply_to_text = db.Column(db.Text, nullable=True)
    reply_to_sender = db.Column(db.String(100), nullable=True)
    reaction = db.Column(db.String(10), nullable=True)
    
    is_pinned = db.Column(db.Boolean, default=False)
    deleted_for = db.Column(db.String(20), nullable=True)  # 'me_warga', 'me_admin', 'everyone'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nik": self.nik,
            "sender": self.sender,
            "nama": self.nama,
            "pesan": self.pesan or "",
            "file_path": self.file_path,
            "file_type": self.file_type,
            "reply_to_id": self.reply_to_id,
            "reply_text": self.reply_to_text,
            "reply_sender": self.reply_to_sender,
            "reaction": self.reaction or "",
            "is_pinned": self.is_pinned,
            "deleted_for": self.deleted_for,
            "waktu": self.created_at.strftime("%H:%M") if self.created_at else ""
        }