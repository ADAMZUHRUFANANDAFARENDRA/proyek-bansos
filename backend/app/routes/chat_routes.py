"""
=========================================================================
CHAT_ROUTES.PY - OBROLAN MEDIASI WARGA, INVESTIGASI SENGKETA & NOTIFIKASI
Lokasi: backend/app/routes/chat_routes.py
Pemerintah Kabupaten Sidoarjo - Dinas Sosial
Sistem Pendukung Keputusan Penyaluran Bantuan Sosial
=========================================================================
"""

import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models.chat import ChatMessage
from app.models.pengaduan import Pengaduan

try:
    from app.services.media_service import MediaService
except ImportError:
    MediaService = None

chat_bp = Blueprint('chat_bp', __name__)

# =========================================================================
# 1. STRUKTUR MEMORI NOTIFIKASI SISTEM REAL-TIME
# =========================================================================
NOTIFIKASI_MEMORI = [
    {
        "id": 1,
        "pesan": "[Sistem] Sinkronisasi basis data kependudukan Kabupaten Sidoarjo aktif.",
        "waktu": "Hari ini",
        "is_read": True,
        "is_pinned": True,
        "is_archived": False
    },
    {
        "id": 2,
        "pesan": "🚨 [Keamanan] Audit algoritma BWM-SAW selesai diverifikasi.",
        "waktu": "Hari ini",
        "is_read": False,
        "is_pinned": False,
        "is_archived": False
    }
]


# =========================================================================
# 2. ENDPOINT PUSAT NOTIFIKASI AKTIVITAS (DIPANGGIL ADMIN.JS)
# =========================================================================
@chat_bp.route('/api/notifikasi', methods=['GET', 'OPTIONS'])
@chat_bp.route('/notifikasi', methods=['GET', 'OPTIONS'])
def get_notif():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    unread = len([n for n in NOTIFIKASI_MEMORI if not n.get('is_read')])
    return jsonify({
        "status": "success",
        "data": NOTIFIKASI_MEMORI,
        "unread": unread,
        "total_unread": unread
    }), 200


@chat_bp.route('/api/notifikasi/<int:id>/read', methods=['PATCH', 'POST', 'OPTIONS'])
@chat_bp.route('/notifikasi/<int:id>/read', methods=['PATCH', 'POST', 'OPTIONS'])
def read_notif(id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    for n in NOTIFIKASI_MEMORI:
        if n['id'] == id:
            n['is_read'] = True
            break
    return jsonify({"status": "success", "message": f"Notifikasi #{id} ditandai telah dibaca."}), 200


@chat_bp.route('/api/notifikasi/<int:id>/pin', methods=['PATCH', 'POST', 'OPTIONS'])
@chat_bp.route('/notifikasi/<int:id>/pin', methods=['PATCH', 'POST', 'OPTIONS'])
def pin_notif(id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    for n in NOTIFIKASI_MEMORI:
        if n['id'] == id:
            n['is_pinned'] = not n.get('is_pinned', False)
            break
    return jsonify({"status": "success", "message": f"Status sematan notifikasi #{id} diperbarui."}), 200


@chat_bp.route('/api/notifikasi/<int:id>/archive', methods=['PATCH', 'POST', 'OPTIONS'])
@chat_bp.route('/notifikasi/<int:id>/archive', methods=['PATCH', 'POST', 'OPTIONS'])
def archive_notif(id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    for n in NOTIFIKASI_MEMORI:
        if n['id'] == id:
            n['is_archived'] = not n.get('is_archived', False)
            break
    return jsonify({"status": "success", "message": f"Status arsip notifikasi #{id} diperbarui."}), 200


@chat_bp.route('/api/notifikasi/<int:id>', methods=['DELETE', 'OPTIONS'])
@chat_bp.route('/notifikasi/<int:id>', methods=['DELETE', 'OPTIONS'])
def delete_notif(id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    global NOTIFIKASI_MEMORI
    NOTIFIKASI_MEMORI = [n for n in NOTIFIKASI_MEMORI if n['id'] != id]
    return jsonify({"status": "success", "message": f"Notifikasi #{id} berhasil dihapus."}), 200


@chat_bp.route('/api/notifikasi/clear-all', methods=['POST', 'OPTIONS'])
@chat_bp.route('/notifikasi/clear-all', methods=['POST', 'OPTIONS'])
def clear_all_notif():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    global NOTIFIKASI_MEMORI
    # Mempertahankan notifikasi yang sedang disematkan (pinned)
    NOTIFIKASI_MEMORI = [n for n in NOTIFIKASI_MEMORI if n.get('is_pinned')]
    return jsonify({"status": "success", "message": "Riwayat notifikasi yang tidak disematkan telah dibersihkan."}), 200


@chat_bp.route('/api/notifikasi/read-all', methods=['POST', 'OPTIONS'])
@chat_bp.route('/notifikasi/read-all', methods=['POST', 'OPTIONS'])
def read_all_notif():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    for n in NOTIFIKASI_MEMORI:
        n['is_read'] = True
    return jsonify({"status": "success", "message": "Seluruh notifikasi telah ditandai dibaca."}), 200


# =========================================================================
# 3. PUSAT INVESTIGASI ADUAN & SENGKETA BANSOS
# =========================================================================
@chat_bp.route('/api/laporan-chat', methods=['GET', 'OPTIONS'])
@chat_bp.route('/api/chat/laporan', methods=['GET', 'OPTIONS'])
@chat_bp.route('/api/pengaduan', methods=['GET', 'OPTIONS'])
def get_laporan():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        aduans = Pengaduan.query.order_by(Pengaduan.created_at.desc()).all()
        if not aduans:
            return jsonify([{
                "id": "ADUAN-001",
                "nik": "3515101408890010",
                "nama": "NURUL HIDAYATI",
                "kategori": "Sengketa Penyaluran Bansos",
                "uraian": "Bansos sembako belum diterima padahal status verifikasi dinyatakan layak pada desil 1.",
                "status_text": "Tahap Mediasi",
                "waktu": "Hari ini"
            }]), 200

        res = []
        for a in aduans:
            waktu_str = "Hari ini"
            if hasattr(a, 'created_at') and a.created_at:
                try:
                    waktu_str = a.created_at.strftime('%Y-%m-%d %H:%M')
                except Exception:
                    waktu_str = str(a.created_at)[:16]

            nama_val = getattr(a, 'nama_pelapor', None) or getattr(a, 'nama', None) or 'Warga Sidoarjo'
            uraian_val = getattr(a, 'isi_laporan', None) or getattr(a, 'deskripsi', None) or getattr(a, 'uraian', '-')
            status_val = getattr(a, 'status_text', None) or getattr(a, 'status', None) or 'Tahap Mediasi'

            res.append({
                "id": f"ADUAN-{a.id:03d}",
                "nik": getattr(a, 'nik', '3515101408890010'),
                "nama": nama_val,
                "kategori": getattr(a, 'kategori', 'Sengketa Penyaluran Bansos'),
                "uraian": uraian_val,
                "status_text": status_val,
                "waktu": waktu_str
            })
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@chat_bp.route('/api/investigasi/tindak-lanjut', methods=['POST', 'OPTIONS'])
def tindak_lanjut_investigasi():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        nik = str(data.get('nik') or '').strip()
        aksi = str(data.get('aksi') or 'tanggapi').strip()
        tanggapan = str(data.get('tanggapan') or '').strip()
        petugas = str(data.get('petugas') or 'Petugas Dinsos Sidoarjo').strip()

        aduan = Pengaduan.query.filter_by(nik=nik).order_by(Pengaduan.created_at.desc()).first()
        if not aduan:
            return jsonify({"status": "error", "message": "Pengaduan tidak ditemukan."}), 404

        if aksi == 'terima':
            if hasattr(aduan, 'status_step'): aduan.status_step = 2
            if hasattr(aduan, 'status_text'): aduan.status_text = "Peninjauan Bukti (Step 2)"
            if hasattr(aduan, 'status'): aduan.status = "Peninjauan"
        elif aksi == 'tanggapi':
            if hasattr(aduan, 'status_step'): aduan.status_step = 3
            if hasattr(aduan, 'status_text'): aduan.status_text = "Investigasi Lapangan (Step 3)"
            if hasattr(aduan, 'status'): aduan.status = "Investigasi"
        elif aksi == 'selesai':
            if hasattr(aduan, 'status_step'): aduan.status_step = 4
            if hasattr(aduan, 'status_text'): aduan.status_text = "Selesai & Ditutup (Step 4)"
            if hasattr(aduan, 'status'): aduan.status = "Selesai"

        if tanggapan and hasattr(aduan, 'catatan_petugas'):
            aduan.catatan_petugas = tanggapan

        # Kirim notifikasi konfirmasi langsung ke ruang percakapan warga
        status_aktif = getattr(aduan, 'status_text', getattr(aduan, 'status', 'Tahap Mediasi'))
        pesan_notif = f"📢 [PEMBARUAN INVESTIGASI] Status laporan: {status_aktif}. Catatan Petugas ({petugas}): {tanggapan or 'Sedang dalam tindak lanjut.'}"
        chat_notif = ChatMessage(
            nik=nik,
            sender="petugas",
            nama=petugas,
            pesan=pesan_notif
        )
        db.session.add(chat_notif)
        db.session.commit()

        aduan_dict = aduan.to_dict() if hasattr(aduan, 'to_dict') else {"id": aduan.id, "status": status_aktif}
        return jsonify({
            "status": "success",
            "message": f"Status investigasi berhasil diperbarui ke {status_aktif}.",
            "data": aduan_dict
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# 4. PENGAJUAN PENGADUAN PUBLIK
# =========================================================================
@chat_bp.route('/api/publik/pengaduan', methods=['POST', 'OPTIONS'])
def buat_pengaduan():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        nik = str(data.get('nik') or '').strip()
        nama = str(data.get('nama_pelapor') or data.get('nama') or 'Warga Sidoarjo').strip()
        kategori = str(data.get('kategori') or 'Aduan Umum Bansos').strip()
        isi = str(data.get('isi_laporan') or data.get('uraian') or data.get('deskripsi') or '').strip()

        if not nik or not isi:
            return jsonify({"status": "error", "message": "NIK dan isi laporan pengaduan wajib diisi."}), 400

        aduan = Pengaduan(
            nik=nik,
            kategori=kategori,
            status_step=2 if hasattr(Pengaduan, 'status_step') else None,
            status_text="Ditinjau Petugas" if hasattr(Pengaduan, 'status_text') else None,
            status="Ditinjau",
            catatan_petugas="Laporan Anda telah masuk ke sistem dan sedang diverifikasi." if hasattr(Pengaduan, 'catatan_petugas') else None
        )
        if hasattr(aduan, 'nama_pelapor'):
            aduan.nama_pelapor = nama
        if hasattr(aduan, 'nama'):
            aduan.nama = nama
        if hasattr(aduan, 'isi_laporan'):
            aduan.isi_laporan = isi
        if hasattr(aduan, 'deskripsi'):
            aduan.deskripsi = isi

        db.session.add(aduan)
        db.session.commit()

        aduan_dict = aduan.to_dict() if hasattr(aduan, 'to_dict') else {"id": aduan.id, "nik": nik}
        return jsonify({"status": "success", "message": "Pengaduan berhasil dicatat.", "data": aduan_dict}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@chat_bp.route('/api/publik/cek-aduan', methods=['GET', 'OPTIONS'])
def cek_aduan():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    nik = str(request.args.get('nik') or '').strip()
    aduan = Pengaduan.query.filter_by(nik=nik).order_by(Pengaduan.created_at.desc()).first()
    if not aduan:
        return jsonify({"status": "error", "message": "Belum ada riwayat pengaduan aktif untuk NIK tersebut."}), 404

    aduan_dict = aduan.to_dict() if hasattr(aduan, 'to_dict') else {
        "id": aduan.id,
        "nik": aduan.nik,
        "status": getattr(aduan, 'status_text', getattr(aduan, 'status', 'Tahap Mediasi'))
    }
    return jsonify({"status": "success", "data": aduan_dict}), 200


# =========================================================================
# 5. OBROLAN MEDIASI REAL-TIME (WARGA & PETUGAS DINSOS)
# =========================================================================
@chat_bp.route('/chat/<nik>', methods=['GET', 'POST', 'OPTIONS'])
@chat_bp.route('/api/chat/<nik>', methods=['GET', 'POST', 'OPTIONS'])
def handle_chat(nik):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    nik = str(nik).strip()

    if request.method == 'POST':
        try:
            sender = request.form.get('sender') or 'warga'
            nama = request.form.get('nama') or ('Warga' if sender == 'warga' else 'Petugas Dinsos')
            pesan = request.form.get('pesan', '').strip()
            custom_type = request.form.get('custom_file_type')

            file_path = None
            file_type = None

            # Simpan berkas lampiran jika dikirimkan (Gambar, Audio, Video, Dokumen)
            if 'file' in request.files and request.files['file'].filename != '':
                if MediaService and hasattr(MediaService, 'simpan_media'):
                    file_path, file_type = MediaService.simpan_media(request.files['file'], custom_type=custom_type)
                else:
                    uploaded = request.files['file']
                    filename = f"chat_{nik}_{int(datetime.now().timestamp())}_{uploaded.filename}"
                    dest = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                    uploaded.save(dest)
                    file_path = filename
                    file_type = custom_type or 'document'

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

            res_data = chat.to_dict() if hasattr(chat, 'to_dict') else {
                "id": chat.id,
                "nik": chat.nik,
                "pesan": chat.pesan,
                "sender": chat.sender
            }
            return jsonify({"status": "success", "data": res_data}), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET: Mengambil riwayat pesan obrolan berdasarkan NIK
    try:
        messages = ChatMessage.query.filter_by(nik=nik).order_by(ChatMessage.created_at.asc()).all()
        return jsonify([m.to_dict() if hasattr(m, 'to_dict') else {
            "id": m.id,
            "nik": m.nik,
            "sender": m.sender,
            "nama": m.nama,
            "pesan": m.pesan,
            "file_path": getattr(m, 'file_path', None),
            "file_type": getattr(m, 'file_type', None),
            "created_at": m.created_at.strftime('%Y-%m-%d %H:%M') if hasattr(m, 'created_at') and m.created_at else ''
        } for m in messages]), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@chat_bp.route('/api/chat/react/<int:msg_id>', methods=['POST', 'OPTIONS'])
def react_chat(msg_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    data = request.get_json(silent=True) or {}
    chat.reaction = data.get('reaction', '')
    db.session.commit()
    return jsonify({"status": "success", "reaction": chat.reaction}), 200


@chat_bp.route('/api/chat/pin/<int:msg_id>', methods=['PATCH', 'OPTIONS'])
def pin_chat(msg_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    if hasattr(chat, 'is_pinned'):
        chat.is_pinned = not chat.is_pinned
        db.session.commit()
        return jsonify({"status": "success", "is_pinned": chat.is_pinned}), 200

    return jsonify({"status": "success", "is_pinned": False}), 200


@chat_bp.route('/api/chat/action/<int:msg_id>', methods=['DELETE', 'OPTIONS'])
def action_chat(msg_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    chat = ChatMessage.query.get(msg_id)
    if not chat:
        return jsonify({"status": "error", "message": "Pesan tidak ditemukan."}), 404

    data = request.get_json(silent=True) or {}
    tipe = data.get('type', 'everyone')

    if tipe == 'everyone':
        db.session.delete(chat)
    else:
        if hasattr(chat, 'deleted_for'):
            chat.deleted_for = f"me_{data.get('requester', 'warga')}"

    db.session.commit()
    return jsonify({"status": "success", "message": "Pesan berhasil dihapus."}), 200