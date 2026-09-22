"""
=========================================================================
WARGA_ROUTES.PY - MODUL MANAJEMEN DATA WARGA & SINKRONISASI BANSOS
Lokasi: app/routes/warga_routes.py
PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
=========================================================================
"""

from datetime import date, datetime
from decimal import Decimal
from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models.warga import Warga

warga_bp = Blueprint('warga', __name__)

DEFAULT_KRITERIA = [
    {"kode": "C1", "nama": "Kondisi Ekonomi (Penghasilan)", "bobot": 0.18, "tipe": "cost"},
    {"kode": "C2", "nama": "Estimasi Nilai Aset", "bobot": 0.14, "tipe": "cost"},
    {"kode": "C3", "nama": "Usia Kepala Keluarga", "bobot": 0.08, "tipe": "benefit"},
    {"kode": "C4", "nama": "Jenis Kelamin", "bobot": 0.05, "tipe": "benefit"},
    {"kode": "C5", "nama": "Jumlah Tanggungan Keluarga", "bobot": 0.15, "tipe": "benefit"},
    {"kode": "C6", "nama": "Status Pernikahan", "bobot": 0.06, "tipe": "benefit"},
    {"kode": "C7", "nama": "Kepemilikan Anak Sekolah", "bobot": 0.10, "tipe": "benefit"},
    {"kode": "C8", "nama": "Status Kepemilikan Rumah", "bobot": 0.10, "tipe": "benefit"},
    {"kode": "C9", "nama": "Pendidikan Terakhir", "bobot": 0.06, "tipe": "cost"},
    {"kode": "C10", "nama": "Status Kesehatan / Disabilitas", "bobot": 0.08, "tipe": "benefit"}
]


def ensure_backup_table():
    """Memastikan tabel cadangan arsip warga_backup tersedia di database MySQL."""
    try:
        db.session.execute(db.text("CREATE TABLE IF NOT EXISTS warga_backup LIKE warga;"))
        db.session.commit()
    except Exception as e:
        db.session.rollback()


def serialize_warga(w):
    """Mengonversi objek model SQLAlchemy ke format JSON-safe."""
    if not w:
        return {}

    if hasattr(w, 'to_dict') and callable(getattr(w, 'to_dict')):
        try:
            data = w.to_dict()
        except Exception:
            data = {col.name: getattr(w, col.name) for col in w.__table__.columns}
    elif hasattr(w, '__table__'):
        data = {col.name: getattr(w, col.name) for col in w.__table__.columns}
    elif isinstance(w, dict):
        data = dict(w)
    else:
        data = w.__dict__.copy()

    data.pop('_sa_instance_state', None)

    for key, val in list(data.items()):
        if isinstance(val, (date, datetime)):
            data[key] = val.isoformat()
        elif isinstance(val, Decimal):
            data[key] = float(val)

    return data


# =========================================================================
# MESIN SINKRONISASI ALGORITMA BWM + SAW (PERSISTEN KE DATABASE)
# =========================================================================
def hitung_dan_sinkronkan_saw_bwm():
    """
    Menghitung skor SAW dengan vektor bobot BWM untuk seluruh warga,
    menentukan peringkat, mendistribusikan desil 1-10 secara proporsional,
    dan menyimpan skor_saw, desil, prioritas, serta status_bansos ke database.
    """
    warga_list = Warga.query.all()
    if not warga_list:
        return 0

    bobot_dict = {f"c{i}": item["bobot"] for i, item in enumerate(DEFAULT_KRITERIA, start=1)}
    tipe_dict = {f"c{i}": item["tipe"] for i, item in enumerate(DEFAULT_KRITERIA, start=1)}

    try:
        kriteria_rows = db.session.execute(db.text("SELECT kode, bobot, tipe FROM kriteria")).fetchall()
        if kriteria_rows:
            for r in kriteria_rows:
                k_code = str(r[0]).strip().lower()
                if k_code in bobot_dict:
                    bobot_dict[k_code] = float(r[1])
                    tipe_dict[k_code] = str(r[2]).strip().lower()
    except Exception:
        pass

    min_vals = {}
    max_vals = {}
    for c in [f"c{i}" for i in range(1, 11)]:
        vals = [float(getattr(w, c, 0) or 0) for w in warga_list]
        positive_vals = [v for v in vals if v > 0]
        min_vals[c] = min(positive_vals) if positive_vals else 1.0
        max_vals[c] = max(vals) if vals and max(vals) > 0 else 1.0

    skor_warga = []
    for w in warga_list:
        v_i = 0.0
        for c in [f"c{i}" for i in range(1, 11)]:
            val = float(getattr(w, c, 0) or 0)
            wj = bobot_dict[c]
            tj = tipe_dict[c]

            if tj == 'cost':
                val_safe = val if val > 0 else min_vals[c]
                rij = min_vals[c] / val_safe
            else:
                rij = val / max_vals[c] if max_vals[c] > 0 else 0.0

            v_i += wj * rij

        skor_warga.append((w, round(v_i, 4)))

    # Urutkan nilai preferensi tertinggi (Rank 1 = paling layak/prioritas utama)
    skor_warga.sort(key=lambda x: x[1], reverse=True)
    total_n = len(skor_warga)

    # Pembagian Desil 1 s/d Desil 10 berdasarkan persentil peringkat
    for rank, (w, skor) in enumerate(skor_warga, start=1):
        persentil = (rank - 1) / total_n
        desil = int(persentil * 10) + 1
        if desil > 10:
            desil = 10

        w.skor_saw = skor
        w.desil = desil

        if desil <= 4:
            w.prioritas = "Prioritas Utama"
            if getattr(w, 'status_bansos', '') != "Menerima Bansos":
                w.status_bansos = "Layak Bansos"
        else:
            w.prioritas = "Tidak Prioritas"
            if getattr(w, 'status_bansos', '') != "Menerima Bansos":
                w.status_bansos = "Tidak Menerima"

    db.session.commit()
    return total_n


# =========================================================================
# ENDPOINT UTAMA CRUD WARGA
# =========================================================================
@warga_bp.route('/warga', methods=['GET', 'POST'])
@warga_bp.route('/api/warga', methods=['GET', 'POST'])
def handle_warga():
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or request.form.to_dict()
            nik = str(data.get('nik') or '').strip()
            nama = str(data.get('nama') or data.get('nama_lengkap') or '').strip()

            if not nik or len(nik) != 16 or not nik.isdigit():
                return jsonify({"status": "error", "message": "NIK wajib 16 digit angka."}), 400

            if not nama:
                return jsonify({"status": "error", "message": "Nama lengkap pemohon wajib diisi."}), 400

            if Warga.query.filter_by(nik=nik).first():
                return jsonify({"status": "error", "message": "NIK tersebut sudah terdaftar."}), 400

            tgl_lahir = None
            if data.get('tanggal_lahir') or data.get('tglLahir'):
                val_tgl = data.get('tanggal_lahir') or data.get('tglLahir')
                try:
                    tgl_lahir = datetime.strptime(str(val_tgl)[:10], '%Y-%m-%d').date()
                except ValueError:
                    tgl_lahir = None

            warga = Warga(
                nik=nik,
                nama=nama,
                tempat_lahir=data.get('tempat_lahir') or data.get('tempatLahir') or 'Sidoarjo',
                tanggal_lahir=tgl_lahir,
                alamat=data.get('alamat') or 'Kabupaten Sidoarjo',
                email=data.get('email') or '',
                no_hp=data.get('no_hp') or data.get('noHp') or '',
                lat=str(data.get('lat') or '-7.4478'),
                lng=str(data.get('lng') or '112.7183'),
                c1=float(data.get('c1') or 1500000.0),
                c2=float(data.get('c2') or 5000000.0),
                c3=int(data.get('c3') or 45),
                c4=int(data.get('c4') or 1),
                c5=int(data.get('c5') or 3),
                c6=int(data.get('c6') or 2),
                c7=int(data.get('c7') or 2),
                c8=int(data.get('c8') or 2),
                c9=int(data.get('c9') or 1),
                c10=int(data.get('c10') or 1),
                catatan=data.get('catatan') or 'Registrasi Baru',
                is_verified=bool(data.get('is_verified', False)),
                status_validasi='Disetujui' if data.get('is_verified') else 'Menunggu'
            )

            db.session.add(warga)
            db.session.commit()

            hitung_dan_sinkronkan_saw_bwm()

            return jsonify({
                "status": "success",
                "message": "Data warga berhasil disimpan dan disinkronkan dengan SPK SAW.",
                "data": serialize_warga(warga)
            }), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    # GET: Menampilkan daftar seluruh warga
    try:
        search_query = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '').strip()

        # Jalankan sinkronisasi otomatis jika masih ada data yang desilnya kosong
        ada_tanpa_desil = Warga.query.filter((Warga.desil == None) | (Warga.desil == 0) | (Warga.skor_saw == 0)).first()
        if ada_tanpa_desil:
            hitung_dan_sinkronkan_saw_bwm()

        query = Warga.query
        if search_query:
            query = query.filter((Warga.nama.ilike(f"%{search_query}%")) | (Warga.nik.like(f"%{search_query}%")))

        if status_filter == 'layak' and hasattr(Warga, 'desil'):
            query = query.filter(Warga.desil <= 4)
        elif status_filter == 'menerima':
            if hasattr(Warga, 'status_bansos'):
                query = query.filter(Warga.status_bansos == 'Menerima Bansos')
            elif hasattr(Warga, 'status_salur'):
                query = query.filter(Warga.status_salur == 'Telah Menerima')

        warga_list = query.order_by(Warga.id.desc()).all()
        return jsonify([serialize_warga(w) for w in warga_list]), 200

    except Exception as e:
        return jsonify([]), 200


# =========================================================================
# ENDPOINT DETAIL, PEMBARUAN & PENGHAPUSAN (SINKRON PERSETUJUAN DENGAN DESIL)
# =========================================================================
@warga_bp.route('/warga/<warga_id>', methods=['PUT', 'DELETE'])
@warga_bp.route('/api/warga/<warga_id>', methods=['PUT', 'DELETE'])
def detail_warga(warga_id):
    warga = Warga.query.get(warga_id)
    if not warga:
        warga = Warga.query.filter_by(nik=str(warga_id).strip()).first()

    if not warga:
        return jsonify({"status": "error", "message": "Warga tidak ditemukan."}), 404

    if request.method == 'DELETE':
        try:
            db.session.delete(warga)
            db.session.commit()
            hitung_dan_sinkronkan_saw_bwm()
            return jsonify({"status": "success", "message": "Data warga berhasil dihapus."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500

    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        fields = ['nama', 'alamat', 'email', 'no_hp', 'lat', 'lng', 'catatan', 'status_salur', 'nominal_bantuan']
        for field in fields:
            if field in data and hasattr(warga, field):
                setattr(warga, field, data[field])

        for c_idx in range(1, 11):
            key = f"c{c_idx}"
            if key in data and hasattr(warga, key):
                val = float(data[key]) if c_idx in [1, 2] else int(data[key])
                setattr(warga, key, val)

        if 'is_verified' in data:
            warga.is_verified = bool(data['is_verified'])
            warga.status_validasi = 'Disetujui' if warga.is_verified else 'Menunggu'

        db.session.commit()

        # Sinkronkan kembali seluruh ranking desil SAW & BWM secara instan
        hitung_dan_sinkronkan_saw_bwm()
        db.session.refresh(warga)

        return jsonify({
            "status": "success",
            "message": "Data warga berhasil diperbarui dan disinkronkan dengan SPK SAW.",
            "data": serialize_warga(warga)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# ENDPOINT SINKRONISASI SPK EKSPILISIT DARI DASBOR
# =========================================================================
@warga_bp.route('/api/spk/sinkron-saw', methods=['POST', 'GET'])
def sinkron_spk_endpoint():
    """Endpoint untuk menyinkronkan seluruh desil dan status bansos warga ke database."""
    try:
        total = hitung_dan_sinkronkan_saw_bwm()
        return jsonify({
            "status": "success",
            "message": f"Kalkulasi BWM-SAW selesai. {total} data warga telah diselaraskan dengan desil dan peringkat kelayakan."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# OPERASI BULK CEPAT
# =========================================================================
@warga_bp.route('/warga/verify-all', methods=['POST'])
@warga_bp.route('/api/warga/verify-all', methods=['POST'])
def verify_all():
    try:
        db.session.execute(db.text("UPDATE warga SET is_verified = 1, status_validasi = 'Disetujui'"))
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        return jsonify({"status": "success", "message": "Seluruh data warga berhasil disetujui dan disinkronkan."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@warga_bp.route('/warga/unverify-all', methods=['POST'])
@warga_bp.route('/api/warga/unverify-all', methods=['POST'])
def unverify_all():
    try:
        db.session.execute(db.text("UPDATE warga SET is_verified = 0, status_validasi = 'Menunggu'"))
        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()
        return jsonify({"status": "success", "message": "Seluruh status persetujuan berhasil dibatalkan."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@warga_bp.route('/warga/delete-all', methods=['POST', 'DELETE'])
@warga_bp.route('/api/warga/delete-all', methods=['POST', 'DELETE'])
def delete_all_warga():
    try:
        ensure_backup_table()
        db.session.execute(db.text("TRUNCATE TABLE warga;"))
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Seluruh data warga di tabel utama telah dibersihkan. Data arsip tetap aman."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# SINKRONISASI DATA ARSIP (SIMPAN CADANGAN & PULIHKAN ARSIP)
# =========================================================================
@warga_bp.route('/api/arsip/cadangkan', methods=['POST'])
def simpan_cadangan_arsip():
    try:
        ensure_backup_table()
        warga_list = Warga.query.all()
        if not warga_list:
            return jsonify({"status": "error", "message": "Tidak ada data warga untuk dicadangkan."}), 400

        db.session.execute(db.text("TRUNCATE TABLE warga_backup;"))
        db.session.execute(db.text("INSERT INTO warga_backup SELECT * FROM warga;"))
        db.session.commit()

        total = len(warga_list)
        disetujui = sum(1 for w in warga_list if w.is_verified)
        menunggu = total - disetujui
        daftar_nama = [w.nama for w in warga_list[:6]]

        return jsonify({
            "status": "success",
            "message": "Pencadangan arsip data warga berhasil disimpan.",
            "total": total,
            "disetujui": disetujui,
            "menunggu": menunggu,
            "nama_sampel": daftar_nama
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal mencadangkan arsip: {str(e)}"}), 500


@warga_bp.route('/api/arsip/pulihkan', methods=['POST'])
@warga_bp.route('/api/bps/sync', methods=['POST', 'GET'])
def pulihkan_cadangan_arsip():
    try:
        ensure_backup_table()
        result = db.session.execute(db.text("SELECT COUNT(*) FROM warga_backup;")).scalar()

        if result == 0:
            MASTER_WARGA = [
                ("3515011002850001", "SUTRISNO HADI", "Sidoarjo", "Jl. Raya Waru No. 14, RT 02/RW 01, Kec. Waru", "081234567001", "-7.3524", "112.7245", 950000.0, 2500000.0, 54, 1, 4, 2, 2, 3, 1, 2, 1, "Disetujui", "Belum Salur", "Keluarga rentan prasejahtera"),
                ("3515022507900002", "SITI AMINAH", "Sidoarjo", "Dusun Badas, RT 04/RW 02, Barengkrajan, Kec. Krian", "081234567002", "-7.4082", "112.5831", 800000.0, 1500000.0, 48, 2, 3, 3, 2, 3, 1, 1, 1, "Disetujui", "Telah Menerima", "Lansia tunggal tanggungan anak"),
                ("3515031505880003", "BAMBANG PAMUNGKAS", "Sidoarjo", "Desa Cemandi, RT 08/RW 03, Kec. Sedati", "081234567003", "-7.3821", "112.7756", 1100000.0, 3200000.0, 42, 1, 5, 2, 3, 2, 2, 1, 1, "Disetujui", "Belum Salur", "Pekerja serabutan pesisir"),
                ("3515040909770004", "RUDI HERMAWAN", "Sidoarjo", "Jl. Gajah Mada No. 45, RT 01/RW 05, Kec. Sidoarjo", "081234567004", "-7.4478", "112.7183", 1300000.0, 4000000.0, 49, 1, 3, 2, 1, 2, 2, 1, 1, "Disetujui", "Telah Menerima", "Buruh pabrik harian lepas"),
                ("3515051812830005", "KARTINI WULANDARI", "Sidoarjo", "Desa Kebonagung, RT 03/RW 01, Kec. Porong", "081234567005", "-7.5451", "112.6987", 700000.0, 1200000.0, 58, 2, 2, 3, 0, 3, 1, 2, 1, "Disetujui", "Telah Menerima", "Warga terdampak tanggul"),
                ("3515060403920006", "ACHMAD FAUZI", "Sidoarjo", "Kelurahan Geluran, RT 05/RW 02, Kec. Taman", "081234567006", "-7.3621", "112.6954", 1400000.0, 4500000.0, 39, 1, 4, 2, 2, 2, 3, 1, 0, "Menunggu", "Belum Salur", "Pekerja sektor informal"),
                ("3515072010860007", "ENDANG SUNARMI", "Sidoarjo", "Desa Sepande, RT 02/RW 04, Kec. Candi", "081234567007", "-7.4721", "112.7142", 850000.0, 2000000.0, 51, 2, 3, 3, 1, 3, 1, 1, 1, "Disetujui", "Belum Salur", "Pedagang keliling skala mikro"),
                ("3515081111810008", "JOKO PRASETYO", "Sidoarjo", "Desa Pekarungan, RT 06/RW 02, Kec. Sukodono", "081234567008", "-7.4112", "112.6789", 1250000.0, 3800000.0, 44, 1, 4, 2, 2, 2, 2, 1, 0, "Menunggu", "Belum Salur", "Keluarga anak usia sekolah"),
                ("3515090101750009", "SUHARTONO", "Sidoarjo", "Desa Kalitengah, RT 03/RW 03, Kec. Tanggulangin", "081234567009", "-7.5089", "112.7121", 900000.0, 2200000.0, 56, 1, 3, 2, 1, 3, 1, 2, 1, "Disetujui", "Telah Menerima", "Pengrajin rumahan musiman"),
                ("3515101408890010", "NURUL HIDAYATI", "Sidoarjo", "Desa Kraton, RT 02/RW 01, Kec. Krian", "081234567010", "-7.3995", "112.5921", 750000.0, 1800000.0, 47, 2, 4, 3, 3, 3, 1, 1, 1, "Disetujui", "Belum Salur", "Ibu rumah tangga prasejahtera"),
                ("3515112204930011", "ARIF BUDIMAN", "Sidoarjo", "Desa Tambaksumur, RT 05/RW 02, Kec. Waru", "081234567011", "-7.3456", "112.7612", 1500000.0, 5200000.0, 36, 1, 2, 2, 1, 2, 3, 1, 0, "Menunggu", "Belum Salur", "Verifikasi mandiri bansos"),
                ("3515121606820012", "SRI WAHYUNI", "Sidoarjo", "Desa Urangagung, RT 04/RW 03, Kec. Sidoarjo", "081234567012", "-7.4567", "112.6934", 820000.0, 1900000.0, 52, 2, 3, 2, 1, 3, 1, 2, 1, "Disetujui", "Telah Menerima", "Keluarga rentan penyakit kronis")
            ]
            for row in MASTER_WARGA:
                sql_insert = """
                    INSERT INTO warga_backup (
                        nik, nama, tempat_lahir, alamat, no_hp, lat, lng,
                        c1, c2, c3, c4, c5, c6, c7, c8, c9, c10,
                        is_verified, status_validasi, status_salur, catatan
                    ) VALUES (
                        :nik, :nama, :tempat, :alamat, :no_hp, :lat, :lng,
                        :c1, :c2, :c3, :c4, :c5, :c6, :c7, :c8, :c9, :c10,
                        :verif, :val, :salur, :catatan
                    )
                """
                params = {
                    "nik": row[0], "nama": row[1], "tempat": row[2],
                    "alamat": row[3], "no_hp": row[4], "lat": row[5],
                    "lng": row[6], "c1": row[7], "c2": row[8],
                    "c3": row[9], "c4": row[10], "c5": row[11],
                    "c6": row[12], "c7": row[13], "c8": row[14],
                    "c9": row[15], "c10": row[16], "verif": row[17],
                    "val": row[18], "salur": row[19], "catatan": row[20]
                }
                db.session.execute(db.text(sql_insert), params)
            db.session.commit()

        db.session.execute(db.text("TRUNCATE TABLE warga;"))
        db.session.execute(db.text("INSERT INTO warga SELECT * FROM warga_backup;"))
        db.session.commit()

        hitung_dan_sinkronkan_saw_bwm()

        warga_list = Warga.query.all()
        total = len(warga_list)
        disetujui = sum(1 for w in warga_list if w.is_verified)
        menunggu = total - disetujui
        daftar_nama = [w.nama for w in warga_list[:6]]

        return jsonify({
            "status": "success",
            "message": "Seluruh arsip data kependudukan warga berhasil dipulihkan dan disinkronkan dengan SPK SAW.",
            "total": total,
            "disetujui": disetujui,
            "menunggu": menunggu,
            "nama_sampel": daftar_nama
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal memulihkan arsip: {str(e)}"}), 500


# =========================================================================
# BATCH IMPORT DARI EXCEL
# =========================================================================
@warga_bp.route('/warga/bulk-import', methods=['POST'])
@warga_bp.route('/api/warga/bulk-import', methods=['POST'])
def bulk_import_warga():
    try:
        payload = request.get_json(silent=True) or {}
        items = payload if isinstance(payload, list) else payload.get('data', [])

        if not items:
            return jsonify({"status": "error", "message": "Tidak ada baris data yang dikirim."}), 400

        berhasil = 0
        lewati = 0

        for raw_row in items:
            row = {str(k).strip().lower(): v for k, v in raw_row.items()}
            val_nik = row.get('nik') or row.get('nomor nik') or row.get('no_ktp') or ''

            if isinstance(val_nik, float):
                nik = f"{int(val_nik)}"
            else:
                nik = str(val_nik).strip().split('.')[0]

            val_nama = row.get('nama') or row.get('nama lengkap') or row.get('nama_lengkap') or ''
            nama = str(val_nama).strip()

            if not nik or len(nik) != 16 or not nik.isdigit() or not nama:
                lewati += 1
                continue

            if Warga.query.filter_by(nik=nik).first():
                lewati += 1
                continue

            warga = Warga(
                nik=nik,
                nama=nama,
                tempat_lahir=str(row.get('tempat_lahir') or 'Sidoarjo'),
                tanggal_lahir=None,
                alamat=str(row.get('alamat') or 'Kabupaten Sidoarjo'),
                email=str(row.get('email') or ''),
                no_hp=str(row.get('no_hp') or ''),
                lat=str(row.get('lat') or '-7.4478'),
                lng=str(row.get('lng') or '112.7183'),
                c1=float(row.get('c1') or 1500000.0),
                c2=float(row.get('c2') or 5000000.0),
                c3=int(row.get('c3') or 45),
                c4=int(row.get('c4') or 1),
                c5=int(row.get('c5') or 3),
                c6=int(row.get('c6') or 2),
                c7=int(row.get('c7') or 2),
                c8=int(row.get('c8') or 2),
                c9=int(row.get('c9') or 1),
                c10=int(row.get('c10') or 1),
                catatan=str(row.get('catatan') or 'Import Excel'),
                is_verified=bool(row.get('is_verified', False)),
                status_validasi='Disetujui' if row.get('is_verified') else 'Menunggu'
            )
            db.session.add(warga)
            berhasil += 1

        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()

        return jsonify({
            "status": "success",
            "message": f"Impor berhasil: {berhasil} data tersimpan dan disinkronkan dengan SPK SAW, {lewati} dilewati."
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal memproses impor: {str(e)}"}), 500


# =========================================================================
# ENDPOINT PUBLIK
# =========================================================================
@warga_bp.route('/api/publik/cek-bansos', methods=['GET'])
def cek_bansos_publik():
    nik = request.args.get('nik', '').strip()
    if not nik or len(nik) != 16:
        return jsonify({"status": "error", "message": "Masukkan 16 digit NIK yang valid."}), 400

    warga = Warga.query.filter_by(nik=nik).first()
    if not warga:
        return jsonify({"status": "error", "message": "Data NIK belum terdaftar."}), 404

    return jsonify({"status": "success", "data": serialize_warga(warga)}), 200


@warga_bp.route('/api/public/konfirmasi-terima', methods=['POST'])
def konfirmasi_terima():
    data = request.get_json(silent=True) or {}
    nik = data.get('nik', '').strip()
    warga = Warga.query.filter_by(nik=nik).first()
    if not warga:
        return jsonify({"status": "error", "message": "Warga tidak ditemukan."}), 404

    if hasattr(warga, 'status_salur'):
        warga.status_salur = "Telah Menerima"
    db.session.commit()
    return jsonify({"status": "success", "message": "Konfirmasi penerimaan berhasil dicatat."}), 200


@warga_bp.route('/api/public/lapor-selesai', methods=['POST'])
def lapor_selesai():
    data = request.get_json(silent=True) or {}
    nik = data.get('nik', '').strip()
    warga = Warga.query.filter_by(nik=nik).first()
    if not warga:
        return jsonify({"status": "error", "message": "Warga tidak ditemukan."}), 404

    if hasattr(warga, 'status_salur'):
        warga.status_salur = "Selesai"
    db.session.commit()
    return jsonify({"status": "success", "message": "Kasus bantuan sosial resmi ditutup."}), 200


# =========================================================================
# NOTIFIKASI REAL-TIME
# =========================================================================
@warga_bp.route('/api/notifikasi', methods=['GET'])
def get_notifikasi_realtime():
    try:
        total_warga = Warga.query.count()
        menunggu = Warga.query.filter_by(is_verified=False).count()

        notif_list = [
            {
                "id": 1,
                "judul": "Sistem SPK Terhubung",
                "pesan": f"Database aktif dengan total {total_warga} warga terdaftar.",
                "waktu": "Baru saja",
                "tipe": "sistem",
                "urgent": False,
                "dibaca": False
            }
        ]

        if menunggu > 0:
            notif_list.append({
                "id": 2,
                "judul": "Menunggu Verifikasi",
                "pesan": f"Terdapat {menunggu} berkas warga yang belum disetujui admin.",
                "waktu": "Hari ini",
                "tipe": "urgent",
                "urgent": True,
                "dibaca": False
            })

        return jsonify({
            "status": "success",
            "total_unread": len(notif_list),
            "data": notif_list
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "data": [], "total_unread": 0}), 200


# =========================================================================
# ENDPOINT KRITERIA & BOBOT BWM (AUTO-SEED 10 KRITERIA SIDOARJO)
# =========================================================================
@warga_bp.route('/api/kriteria', methods=['GET'])
@warga_bp.route('/kriteria', methods=['GET'])
@warga_bp.route('/api/bobot', methods=['GET'])
def get_kriteria_bobot():
    try:
        db.session.execute(db.text("""
            CREATE TABLE IF NOT EXISTS kriteria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kode VARCHAR(10) NOT NULL UNIQUE,
                nama VARCHAR(150) NOT NULL,
                bobot DOUBLE DEFAULT 0.1,
                tipe VARCHAR(20) DEFAULT 'benefit'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))
        db.session.commit()

        rows = db.session.execute(db.text("SELECT id, kode, nama, bobot, tipe FROM kriteria ORDER BY id ASC")).fetchall()

        if not rows:
            for item in DEFAULT_KRITERIA:
                db.session.execute(db.text("""
                    INSERT INTO kriteria (kode, nama, bobot, tipe)
                    VALUES (:kode, :nama, :bobot, :tipe)
                """), item)
            db.session.commit()
            rows = db.session.execute(db.text("SELECT id, kode, nama, bobot, tipe FROM kriteria ORDER BY id ASC")).fetchall()

        hasil = [
            {"id": r[0], "kode": r[1], "nama": r[2], "bobot": float(r[3]), "tipe": r[4]}
            for r in rows
        ]
        return jsonify(hasil), 200

    except Exception as e:
        db.session.rollback()
        return jsonify(DEFAULT_KRITERIA), 200


@warga_bp.route('/api/kriteria/bobot', methods=['POST', 'PUT'])
@warga_bp.route('/api/bobot', methods=['POST', 'PUT'])
def simpan_kriteria_bobot():
    """Menyimpan pembaruan nilai bobot BWM ke dalam database."""
    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        bobot_map = data.get('bobot') or data

        if isinstance(bobot_map, list):
            for item in bobot_map:
                k_id = item.get('id')
                k_kode = item.get('kode')
                k_bobot = float(item.get('bobot', 0))
                if k_id:
                    db.session.execute(db.text("UPDATE kriteria SET bobot = :b WHERE id = :id"), {"b": k_bobot, "id": k_id})
                elif k_kode:
                    db.session.execute(db.text("UPDATE kriteria SET bobot = :b WHERE kode = :kode"), {"b": k_bobot, "kode": k_kode})
        elif isinstance(bobot_map, dict):
            for kode_or_id, val in bobot_map.items():
                clean_val = float(val)
                db.session.execute(db.text("UPDATE kriteria SET bobot = :b WHERE kode = :k OR id = :k"), {"b": clean_val, "k": str(kode_or_id)})

        db.session.commit()
        hitung_dan_sinkronkan_saw_bwm()

        return jsonify({"status": "success", "message": "Vektor bobot kriteria BWM berhasil diperbarui dan disinkronkan ke seluruh data warga."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# =========================================================================
# ENDPOINT SINKRONISASI KOTAK MASUK CHAT WARGA (REAL-TIME INBOX)
# =========================================================================
@warga_bp.route('/api/chat/inbox', methods=['GET'])
@warga_bp.route('/api/chat/conversations', methods=['GET'])
def get_chat_inbox_list():
    """
    Mengambil daftar seluruh warga yang memiliki riwayat pesan,
    mendeteksi pesan terakhir, waktu, dan jumlah pesan belum terbaca.
    """
    try:
        warga_dengan_pesan = []

        # 1. Periksa tabel pesan_chat atau chat_messages di database MySQL
        tabel_pesan = None
        for nama_tabel in ['pesan_chat', 'chat_messages', 'chat_keluhan']:
            try:
                cek = db.session.execute(db.text(f"SELECT COUNT(*) FROM {nama_tabel}")).scalar()
                if cek is not None:
                    tabel_pesan = nama_tabel
                    break
            except Exception:
                continue

        if tabel_pesan:
            # Tarik percakapan per NIK warga
            sql = f"""
                SELECT p.nik, MAX(p.id) as max_id, COUNT(CASE WHEN p.is_read = 0 THEN 1 END) as unread
                FROM {tabel_pesan} p
                GROUP BY p.nik
                ORDER BY max_id DESC
            """
            rows = db.session.execute(db.text(sql)).fetchall()
            for r in rows:
                nik_warga = str(r[0]).strip()
                w = Warga.query.filter_by(nik=nik_warga).first()
                if w:
                    # Ambil teks pesan terakhir
                    last_msg = db.session.execute(
                        db.text(f"SELECT pesan, created_at FROM {tabel_pesan} WHERE nik = :nik ORDER BY id DESC LIMIT 1"),
                        {"nik": nik_warga}
                    ).fetchone()

                    txt = last_msg[0] if last_msg else "Pesan baru..."
                    wkt = last_msg[1].strftime("%H:%M") if (last_msg and hasattr(last_msg[1], 'strftime')) else "Baru saja"

                    warga_dengan_pesan.append({
                        "nik": w.nik,
                        "nama": w.nama,
                        "pesan_terakhir": txt,
                        "waktu": wkt,
                        "unread_count": int(r[2] or 0)
                    })

        # 2. Fallback cerdas: Jika belum ada di tabel pesan, ambil dari data warga aktif
        if not warga_dengan_pesan:
            daftar_aktif = Warga.query.order_by(Warga.id.desc()).limit(10).all()
            for w in daftar_aktif:
                warga_dengan_pesan.append({
                    "nik": w.nik,
                    "nama": w.nama,
                    "pesan_terakhir": "Membuka ruang percakapan warga...",
                    "waktu": "Hari ini",
                    "unread_count": 0
                })

        return jsonify({"status": "success", "data": warga_dengan_pesan}), 200

    except Exception as e:
        return jsonify({"status": "error", "data": [], "message": str(e)}), 200