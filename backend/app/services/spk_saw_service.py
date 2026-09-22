import numpy as np

class SPKSawService:
    # 10 Kriteria Berdasarkan Ketetapan Dinas Sosial Kabupaten Sidoarjo
    KRITERIA_METADATA = [
        {"code": "C1", "name": "Kondisi Ekonomi (Penghasilan)", "type": "cost", "default_w": 0.225},
        {"code": "C2", "name": "Nilai Kepemilikan Aset", "type": "cost", "default_w": 0.165},
        {"code": "C3", "name": "Usia Kepala Keluarga", "type": "benefit", "default_w": 0.085},
        {"code": "C4", "name": "Jenis Kelamin Kepala Keluarga", "type": "benefit", "default_w": 0.050},
        {"code": "C5", "name": "Jumlah Tanggungan Keluarga", "type": "benefit", "default_w": 0.145},
        {"code": "C6", "name": "Status Pernikahan", "type": "benefit", "default_w": 0.060},
        {"code": "C7", "name": "Kepemilikan Anak Sekolah", "type": "benefit", "default_w": 0.095},
        {"code": "C8", "name": "Status Tempat Tinggal", "type": "cost", "default_w": 0.075},
        {"code": "C9", "name": "Tingkat Pendidikan Terakhir", "type": "cost", "default_w": 0.040},
        {"code": "C10", "name": "Status Kesehatan Fisik", "type": "benefit", "default_w": 0.060}
    ]

    @staticmethod
    def get_default_weights():
        return [k["default_w"] for k in SPKSawService.KRITERIA_METADATA]

    @classmethod
    def hitung_saw(cls, list_warga, custom_weights=None):
        """
        Menjalankan kalkulasi komprehensif Simple Additive Weighting:
        1. Ekstraksi matriks keputusan mentah X berukuran N x 10
        2. Perhitungan nilai ekstrem min(X_j) untuk cost dan max(X_j) untuk benefit
        3. Normalisasi elemen matriks r_ij
        4. Akumulasi terbobot V_i = sum(w_j * r_ij)
        5. Pemetaan desil 1 - 10 proporsional
        """
        N = len(list_warga)
        if N == 0:
            return {
                "hasil_akhir": [],
                "matriks_keputusan": [],
                "matriks_normalisasi": [],
                "min_max": {},
                "bobot": cls.get_default_weights()
            }

        bobot = custom_weights if (custom_weights and len(custom_weights) == 10) else cls.get_default_weights()

        # 1. Matriks Keputusan Mentah (X)
        X = np.zeros((N, 10), dtype=float)
        matriks_keputusan_view = []

        for i, w in enumerate(list_warga):
            c_vals = [
                max(float(getattr(w, 'c1', None) or 1500000.0), 1.0),
                max(float(getattr(w, 'c2', None) or 5000000.0), 1.0),
                max(float(getattr(w, 'c3', None) or 45.0), 1.0),
                max(float(getattr(w, 'c4', None) or 1.0), 1.0),
                max(float(getattr(w, 'c5', None) or 3.0), 1.0),
                max(float(getattr(w, 'c6', None) or 2.0), 1.0),
                max(float(getattr(w, 'c7', None) or 2.0), 1.0),
                max(float(getattr(w, 'c8', None) or 2.0), 1.0),
                max(float(getattr(w, 'c9', None) or 1.0), 1.0),
                max(float(getattr(w, 'c10', None) or 1.0), 1.0)
            ]
            X[i, :] = c_vals

            row_dict = {
                "index": i + 1,
                "nik": w.nik,
                "nama": w.nama
            }
            for j in range(10):
                row_dict[f"C{j+1}"] = c_vals[j]
            matriks_keputusan_view.append(row_dict)

        # 2. Nilai Ekstrem Kriteria (Min dan Max)
        min_vals = np.min(X, axis=0)
        max_vals = np.max(X, axis=0)

        min_max_dict = {}
        for j in range(10):
            min_max_dict[f"C{j+1}"] = {
                "min": float(min_vals[j]),
                "max": float(max_vals[j])
            }

        # 3. Normalisasi Matriks (R)
        R = np.zeros_like(X)
        matriks_normalisasi = []

        for j in range(10):
            k_type = cls.KRITERIA_METADATA[j]["type"]
            if k_type == "benefit":
                denominator = max_vals[j] if max_vals[j] != 0 else 1.0
                R[:, j] = X[:, j] / denominator
            else:  # cost
                R[:, j] = min_vals[j] / np.where(X[:, j] == 0, 1.0, X[:, j])

        for i in range(N):
            norm_row = {
                "index": i + 1,
                "nik": list_warga[i].nik,
                "nama": list_warga[i].nama
            }
            for j in range(10):
                norm_row[f"C{j+1}"] = round(float(R[i, j]), 4)
            matriks_normalisasi.append(norm_row)

        # 4. Multiplikasi Preferensi Vektor V = R * W
        W = np.array(bobot, dtype=float)
        V = np.dot(R, W)

        # 5. Struktur Hasil Akhir & Peringkat
        hasil_list = []
        for i in range(N):
            hasil_list.append({
                "id": getattr(list_warga[i], 'id', i + 1),
                "nik": list_warga[i].nik,
                "nama": list_warga[i].nama,
                "skor_akhir": round(float(V[i]), 4),
                "alamat": getattr(list_warga[i], 'alamat', 'Kabupaten Sidoarjo')
            })

        # Urutkan dari nilai tertinggi ke terendah
        hasil_list.sort(key=lambda x: x["skor_akhir"], reverse=True)

        # Klasterisasi Desil 1-10 Berdasarkan Kaidah Distribusi Kuantil
        for rank, item in enumerate(hasil_list, 1):
            desil = min(10, max(1, int(np.ceil((rank / N) * 10))))
            item["rank"] = rank
            item["desil"] = desil
            item["status_bansos"] = "Menerima Bansos" if desil <= 4 else "Tidak Menerima"
            item["prioritas"] = "Prioritas Tinggi (Layak)" if desil <= 4 else "Tidak Diprioritaskan"

        return {
            "metode": "SAW (Dengan Bobot BWM)",
            "kriteria": cls.KRITERIA_METADATA,
            "min_max": min_max_dict,
            "matriks_keputusan": matriks_keputusan_view,
            "matriks_normalisasi": matriks_normalisasi,
            "hasil_akhir": hasil_list,
            "bobot": [round(float(w), 4) for w in bobot]
        }

    @classmethod
    def hitung_komparasi_wp(cls, list_warga, hasil_saw_list, custom_weights=None):
        """
        Menghitung perbandingan metode Weighted Product (WP) sebagai instrumen
        validasi konvergensi peringkat pada subbab pengujian metodologi penelitian.
        """
        N = len(list_warga)
        if N == 0:
            return []

        bobot = custom_weights if (custom_weights and len(custom_weights) == 10) else cls.get_default_weights()
        pangkat = [w if cls.KRITERIA_METADATA[j]["type"] == "benefit" else -w for j, w in enumerate(bobot)]

        vektor_S = []
        for w in list_warga:
            c_vals = [
                max(float(getattr(w, 'c1', None) or 1500000.0), 1.0),
                max(float(getattr(w, 'c2', None) or 5000000.0), 1.0),
                max(float(getattr(w, 'c3', None) or 45.0), 1.0),
                max(float(getattr(w, 'c4', None) or 1.0), 1.0),
                max(float(getattr(w, 'c5', None) or 3.0), 1.0),
                max(float(getattr(w, 'c6', None) or 2.0), 1.0),
                max(float(getattr(w, 'c7', None) or 2.0), 1.0),
                max(float(getattr(w, 'c8', None) or 2.0), 1.0),
                max(float(getattr(w, 'c9', None) or 1.0), 1.0),
                max(float(getattr(w, 'c10', None) or 1.0), 1.0)
            ]
            s_val = 1.0
            for j in range(10):
                s_val *= (c_vals[j] ** pangkat[j])
            vektor_S.append(s_val)

        total_S = sum(vektor_S) or 1.0
        vektor_V_wp = [s / total_S for s in vektor_S]

        wp_ranks = []
        for i, w in enumerate(list_warga):
            wp_ranks.append({
                "nik": w.nik,
                "nama": w.nama,
                "wp_skor": round(float(vektor_V_wp[i]), 4)
            })

        wp_ranks.sort(key=lambda x: x["wp_skor"], reverse=True)
        for rank, item in enumerate(wp_ranks, 1):
            item["wp_rank"] = rank

        saw_map = {item["nik"]: item for item in hasil_saw_list}
        komparasi_final = []

        for wp_item in wp_ranks:
            saw_data = saw_map.get(wp_item["nik"], {})
            komparasi_final.append({
                "nik": wp_item["nik"],
                "nama": wp_item["nama"],
                "saw_rank": saw_data.get("rank", "-"),
                "saw_skor": saw_data.get("skor_akhir", 0.0),
                "wp_rank": wp_item["wp_rank"],
                "wp_skor": wp_item["wp_skor"]
            })

        return komparasi_final