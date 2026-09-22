from flask import Blueprint, request, jsonify
from datetime import datetime
from app.extensions import db
from app.models.chat import ChatMessage
from app.models.pengaduan import Pengaduan
from app.services.media_service import MediaService

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/chat/<nik>', methods=['GET', 'POST'])
@chat_bp.route('/api/chat/<nik>', methods=['GET', 'POST'])
def handle_chat(nik):
    nik = str(nik).strip()

    if request.method == 'POST':
        try:
            sender = request.form.get('sender') or 'warga'
            nama = request.form.get('nama') or ('Warga' if sender == 'warga' else 'Petugas Dinsos')
            pesan = request.form.get('pesan', '').strip()
            custom_type = request.form.get('custom_file_type')

            file_path = None
            file_type = None

            # Simpan berkas fisik jika dilampirkan (Audio/Video/Gambar/Dokumen)
            if 'file' in request.files and request.files['file'].filename != '':
                file_path, file_type = MediaService.simpan_media(request.files['file'], custom_type=custom_type)

            chat = ChatMessage(
                nik=nik,
                sender=sender,
                nama=nama,
                pesan=pesan if pesan else None,
                file_path=file_path,
                file_type=file_type,
                reply_to_id=request.form.get('reply_to_id', type=int),
                reply_to_text=request.form.get('reply_to_text') or request.form.get('reply_text'),
                reply_to_sender=request.form.get('reply_to_sender') or request.form.get('reply_sender')
            )

            db.session.add(chat)
            db.session.commit()

            return jsonify({"status": "success", "data": chat.to_dict()}), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET: Mengambil riwayat pesan
    try:
        messages = ChatMessage.query.filter_by(nik=nik).order_by(ChatMessage.created_at.asc()).all()
        return jsonify([m.to_dict() for m in messages]), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@chat_bp.route('/api/chat/react/<int:msg_id>', methods=['POST'])
def react_chat(msg_id):
    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    data = request.get_json(silent=True) or {}
    chat.reaction = data.get('reaction', '')
    db.session.commit()
    return jsonify({"status": "success", "reaction": chat.reaction}), 200

@chat_bp.route('/api/chat/pin/<int:msg_id>', methods=['PATCH'])
def pin_chat(msg_id):
    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    chat.is_pinned = not chat.is_pinned
    db.session.commit()
    return jsonify({"status": "success", "is_pinned": chat.is_pinned}), 200

@chat_bp.route('/api/chat/action/<int:msg_id>', methods=['DELETE'])
def action_chat(msg_id):
    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    data = request.get_json(silent=True) or {}
    tipe = data.get('type', 'everyone')

    if tipe == 'everyone':
        db.session.delete(chat)
    else:
        chat.deleted_for = f"me_{data.get('requester', 'warga')}"

    db.session.commit()
    return jsonify({"status": "success", "message": "Pesan berhasil dihapus."}), 200

# ==================== ENDPOINT INVESTIGASI & ADUAN ====================

@chat_bp.route('/api/publik/pengaduan', methods=['POST'])
def buat_pengaduan():
    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        nik = str(data.get('nik') or '').strip()
        nama = str(data.get('nama_pelapor') or data.get('nama') or 'Warga').strip()
        kategori = str(data.get('kategori') or 'Aduan Umum').strip()
        isi = str(data.get('isi_laporan') or data.get('uraian') or '').strip()

        if not nik or not isi:
            return jsonify({"status": "error", "message": "NIK dan isi laporan wajib diisi."}), 400

        aduan = Pengaduan(
            nik=nik,
            nama_pelapor=nama,
            kategori=kategori,
            isi_laporan=isi,
            status_step=2,
            status_text="Ditinjau Petugas",
            catatan_petugas="Laporan Anda telah masuk ke sistem dan sedang ditinjau."
        )

        db.session.add(aduan)
        db.session.commit()

        return jsonify({"status": "success", "message": "Pengaduan berhasil dicatat.", "data": aduan.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@chat_bp.route('/api/publik/cek-aduan', methods=['GET'])
def cek_aduan():
    nik = request.args.get('nik', '').strip()
    aduan = Pengaduan.query.filter_by(nik=nik).order_by(Pengaduan.created_at.desc()).first()
    if not aduan:
        return jsonify({"status": "error", "message": "Belum ada riwayat pengaduan aktif."}), 404

    return jsonify({"status": "success", "data": aduan.to_dict()}), 200

@chat_bp.route('/api/laporan-chat', methods=['GET'])
def daftar_laporan_chat():
    try:
        aduan_list = Pengaduan.query.order_by(Pengaduan.created_at.desc()).all()
        return jsonify([a.to_dict() for a in aduan_list]), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@chat_bp.route('/api/investigasi/tindak-lanjut', methods=['POST'])
def tindak_lanjut_investigasi():
    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        nik = str(data.get('nik') or '').strip()
        aksi = str(data.get('aksi') or 'tanggapi').strip()
        tanggapan = str(data.get('tanggapan') or '').strip()
        petugas = str(data.get('petugas') or 'Petugas Dinsos').strip()

        aduan = Pengaduan.query.filter_by(nik=nik).order_by(Pengaduan.created_at.desc()).first()
        if not aduan:
            return jsonify({"status": "error", "message": "Pengaduan tidak ditemukan."}), 404

        if aksi == 'terima':
            aduan.status_step = 2
            aduan.status_text = "Peninjauan Bukti (Step 2)"
        elif aksi == 'tanggapi':
            aduan.status_step = 3
            aduan.status_text = "Investigasi Lapangan (Step 3)"
        elif aksi == 'selesai':
            aduan.status_step = 4
            aduan.status_text = "Selesai & Ditutup (Step 4)"

        if tanggapan:
            aduan.catatan_petugas = tanggapan

        # Kirimkan pesan notifikasi resmi otomatis ke ruang obrolan warga
        pesan_notif = f"📢 [PEMBARUAN STATUS LAPORAN] Status laporan: {aduan.status_text}. Catatan Petugas ({petugas}): {tanggapan or '-'}"
        chat_notif = ChatMessage(
            nik=nik,
            sender="petugas",
            nama=petugas,
            pesan=pesan_notif
        )
        db.session.add(chat_notif)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Status investigasi berhasil diperbarui ke {aduan.status_text}.",
            "data": aduan.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500