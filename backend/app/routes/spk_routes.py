from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.warga import Warga
from app.models.kriteria import Kriteria
from app.services.spk_saw_service import SPKSawService
from app.services.bwm_service import BWMService

spk_bp = Blueprint('spk', __name__)

@spk_bp.route('/hitung-saw', methods=['GET', 'POST'])
@spk_bp.route('/api/hitung-saw', methods=['GET', 'POST'])
def proses_hitung_saw():
    try:
        # Ambil seluruh data warga yang telah disetujui (is_verified = True)
        warga_terverifikasi = Warga.query.filter(
            (Warga.is_verified == True) | (Warga.status_validasi == "Disetujui")
        ).all()

        if not warga_terverifikasi:
            return jsonify({
                "status": "error",
                "message": "Belum ada data warga terverifikasi untuk diproses algoritma SAW."
            }), 400

        # Ambil bobot kriteria aktif dari database
        kriteria_db = Kriteria.query.order_by(Kriteria.id.asc()).all()
        bobot_aktif = None
        if kriteria_db and len(kriteria_db) == 10:
            bobot_aktif = [float(k.bobot) for k in kriteria_db]

        # Eksekusi komputasi matematis SAW
        hasil_spk = SPKSawService.hitung_saw(warga_terverifikasi, custom_weights=bobot_aktif)

        # Perbarui skor preferensi akhir dan klaster desil secara presisi
        for item in hasil_spk["hasil_akhir"]:
            Warga.query.filter_by(nik=item["nik"]).update({
                "skor_saw": item["skor_akhir"],
                "desil": item["desil"],
                "status_bansos": item["status_bansos"],
                "prioritas": item["prioritas"]
            })
        db.session.commit()

        return jsonify(hasil_spk), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Komputasi Gagal: {str(e)}"}), 500

@spk_bp.route('/komparasi', methods=['GET'])
@spk_bp.route('/api/komparasi', methods=['GET'])
def komparasi_saw_wp():
    try:
        warga_terverifikasi = Warga.query.filter(
            (Warga.is_verified == True) | (Warga.status_validasi == "Disetujui")
        ).all()

        if not warga_terverifikasi:
            return jsonify([]), 200

        # Ambil bobot kriteria
        kriteria_db = Kriteria.query.order_by(Kriteria.id.asc()).all()
        bobot_aktif = [float(k.bobot) for k in kriteria_db] if (kriteria_db and len(kriteria_db) == 10) else None

        hasil_saw = SPKSawService.hitung_saw(warga_terverifikasi, custom_weights=bobot_aktif)["hasil_akhir"]
        komparasi = SPKSawService.hitung_komparasi_wp(warga_terverifikasi, hasil_saw, custom_weights=bobot_aktif)

        return jsonify(komparasi), 200

    except Exception as e:
        return jsonify({"status": "error", "message": f"Gagal Komparasi: {str(e)}"}), 500

@spk_bp.route('/kriteria', methods=['GET', 'POST'])
@spk_bp.route('/api/kriteria', methods=['GET', 'POST'])
def manage_kriteria():
    if request.method == 'POST':
        try:
            payload = request.get_json(silent=True) or []
            if not isinstance(payload, list):
                payload = [payload]

            for item in payload:
                kode = item.get('kode') or item.get('code')
                bobot = float(item.get('bobot') or item.get('w') or 0.0)
                jenis = (item.get('jenis') or item.get('type') or 'benefit').lower()

                k = Kriteria.query.filter_by(kode=kode).first()
                if k:
                    k.bobot = bobot
                    k.jenis = jenis
                else:
                    k = Kriteria(
                        kode=kode,
                        nama=item.get('nama', f"Kriteria {kode}"),
                        jenis=jenis,
                        bobot=bobot
                    )
                    db.session.add(k)

            db.session.commit()
            return jsonify({"status": "success", "message": "Bobot kriteria berhasil disimpan."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET
    try:
        kriteria = Kriteria.query.order_by(Kriteria.id.asc()).all()
        if not kriteria:
            # Seed kriteria bawaan jika tabel masih kosong
            for meta in SPKSawService.KRITERIA_METADATA:
                k = Kriteria(
                    kode=meta["code"],
                    nama=meta["name"],
                    jenis=meta["type"],
                    bobot=meta["default_w"]
                )
                db.session.add(k)
            db.session.commit()
            kriteria = Kriteria.query.order_by(Kriteria.id.asc()).all()

        return jsonify([k.to_dict() for k in kriteria]), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@spk_bp.route('/api/bobot-bwm', methods=['GET'])
def get_bobot_bwm():
    try:
        kriteria_db = Kriteria.query.order_by(Kriteria.id.asc()).all()
        if kriteria_db and len(kriteria_db) == 10:
            bobot = [float(k.bobot) for k in kriteria_db]
        else:
            bobot = SPKSawService.get_default_weights()
        return jsonify({"status": "success", "bobot": bobot}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500