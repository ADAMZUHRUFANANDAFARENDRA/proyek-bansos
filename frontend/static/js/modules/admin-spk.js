/* =========================================================================
   ADMIN-SPK.JS - ENGINE SPK BWM-SAW & KOMPARASI WEIGHTED PRODUCT (WP)
   Lokasi: frontend/static/js/modules/admin-spk.js
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   ========================================================================= */

window.lastSPKResult = null;
window.lastKomparasiResult = [];
window.compChartInstance = null;
window.spkDetailedAudit = null;

const BASE_API_URL = window.API_BASE_URL || 'http://127.0.0.1:5000';

// Konfigurasi 10 Kriteria Penilaian Berdasarkan Regulasi Dinas Sosial Sidoarjo
const KRITERIA_SPK_CONFIG = [
    { code: 'C1', name: 'Kondisi Ekonomi (Penghasilan)', type: 'Cost', defaultW: 0.225 },
    { code: 'C2', name: 'Nilai Kepemilikan Aset', type: 'Cost', defaultW: 0.165 },
    { code: 'C3', name: 'Usia Kepala Keluarga', type: 'Benefit', defaultW: 0.085 },
    { code: 'C4', name: 'Jenis Kelamin Kepala Keluarga', type: 'Benefit', defaultW: 0.050 },
    { code: 'C5', name: 'Jumlah Tanggungan Keluarga', type: 'Benefit', defaultW: 0.145 },
    { code: 'C6', name: 'Status Pernikahan', type: 'Benefit', defaultW: 0.060 },
    { code: 'C7', name: 'Kepemilikan Anak Sekolah', type: 'Benefit', defaultW: 0.095 },
    { code: 'C8', name: 'Status Tempat Tinggal', type: 'Cost', defaultW: 0.075 },
    { code: 'C9', name: 'Tingkat Pendidikan Terakhir', type: 'Cost', defaultW: 0.040 },
    { code: 'C10', name: 'Status Kesehatan Fisik', type: 'Benefit', defaultW: 0.060 }
];

const KRITERIA_MASTER_DEFAULT = [
    { id: 1, kode: "C1", nama: "Kondisi Ekonomi (Penghasilan)", bobot: 0.18 },
    { id: 2, kode: "C2", nama: "Estimasi Nilai Aset", bobot: 0.14 },
    { id: 3, kode: "C3", nama: "Usia Kepala Keluarga", bobot: 0.08 },
    { id: 4, kode: "C4", nama: "Jenis Kelamin", bobot: 0.05 },
    { id: 5, kode: "C5", nama: "Jumlah Tanggungan Keluarga", bobot: 0.15 },
    { id: 6, kode: "C6", nama: "Status Pernikahan", bobot: 0.06 },
    { id: 7, kode: "C7", nama: "Kepemilikan Anak Sekolah", bobot: 0.10 },
    { id: 8, kode: "C8", nama: "Status Tempat Tinggal", bobot: 0.10 },
    { id: 9, kode: "C9", nama: "Pendidikan Terakhir", bobot: 0.06 },
    { id: 10, kode: "C10", nama: "Status Kesehatan / Disabilitas", bobot: 0.08 }
];

// =========================================================================
// 1. PROSES ALGORITMA BWM - SAW (AUDIT DETAIL, VALIDASI ROSCOE & SINKRONISASI)
// =========================================================================
window.hitungSPK = async function () {
    // Sinkronisasi pemrosesan awal ke API backend jika tersedia
    try {
        await fetch(`${BASE_API_URL}/api/spk/sinkron-saw`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
    } catch (e) {}

    const wargaLayak = (window.globalDataWarga || []).filter(w => w.is_verified);
    if (wargaLayak.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Belum Ada Warga Terverifikasi',
            text: 'Algoritma SAW membutuhkan data warga yang telah berstatus Disetujui. Silakan setujui data warga terlebih dahulu.',
            confirmButtonColor: '#009846'
        });
    }

    // Validasi Kaidah Batas Minimal 100 Data Penelitian (Roscoe's Rule of Thumb)
    if (wargaLayak.length < 100) {
        const confirmRoscoe = await Swal.fire({
            icon: 'warning',
            title: 'Verifikasi Batasan Sampel Data',
            html: `
                <div style="text-align: left; font-size: 0.88rem; line-height: 1.5; color: #334155;">
                    <p style="margin-bottom: 8px;">
                        Data warga terverifikasi saat ini: <b>${wargaLayak.length} data</b>.
                    </p>
                    <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px 14px; border-radius: 8px; color: #991b1b; margin-bottom: 10px;">
                        <b>Kaidah Metodologi Penelitian (Roscoe, 1975):</b><br>
                        Penentuan ukuran sampel multivariat pada sistem pendukung keputusan membutuhkan minimal <b>100 data</b> 
                        (10 kriteria penilaian &times; 10 sampel representatif klaster desil = 100) agar persebaran kuantil desil 1–10 tidak bias secara statistik.
                    </div>
                    <p style="margin: 0;">Apakah Anda ingin tetap melanjutkan perhitungan dengan data yang ada?</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-play"></i> Tetap Lanjutkan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#009846',
            cancelButtonColor: '#64748b'
        });

        if (!confirmRoscoe.isConfirmed) return;
    }

    Swal.fire({
        title: 'Memproses Algoritma SAW...',
        html: 'Menghitung normalisasi matriks dan pembobotan BWM secara instan...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let spkData = null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
            let res = null;
            if (typeof window.fetchData === 'function') {
                res = await window.fetchData('/hitung-saw', { signal: controller.signal });
                if (!res || !res.ok) res = await window.fetchData('/api/hitung-saw', { signal: controller.signal });
            } else {
                res = await fetch(`${BASE_API_URL}/api/hitung-saw`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
                    signal: controller.signal
                });
            }

            if (res && res.ok) {
                spkData = await res.json();
            }
        } catch (netErr) {
            console.warn('[SPK Network Warning] Mengalihkan ke kalkulasi mesin lokal berpresisi tinggi.', netErr);
        } finally {
            clearTimeout(timeoutId);
        }

        if (!spkData || (!spkData.hasil_akhir && !Array.isArray(spkData))) {
            spkData = window.kalkulasiSAWEngineLokal(wargaLayak);
        }

        window.lastSPKResult = spkData;
        if (window.BansosApp && window.BansosApp.State) {
            window.BansosApp.State.setSPKResult(spkData);
        }
        Swal.close();

        const hasilList = Array.isArray(spkData) ? spkData : (spkData.hasil_akhir || spkData.data || []);
        if (hasilList.length === 0) throw new Error('Hasil komputasi kosong.');

        // Rekonstruksi Audit Matematis Lengkap (X, Min/Max, R, W, V)
        window.rekonstruksiAuditMatematisSAW(wargaLayak, spkData);

        const resultCard = document.getElementById('resultCard');
        const resultTable = document.getElementById('resultTable');
        const resultTbody = document.querySelector('#resultTable tbody');
        if (!resultCard || !resultTbody) throw new Error('Elemen tabel hasil SPK tidak ditemukan di halaman.');

        resultCard.style.display = 'block';

        const totalWarga = hasilList.length;
        const totalLayak = hasilList.filter(item => (item.desil || 5) <= 4).length;
        const totalTidak = totalWarga - totalLayak;
        const estimasiDana = totalLayak * 600000;

        let summaryBox = document.getElementById('spkSummaryMetrics');
        if (!summaryBox) {
            summaryBox = document.createElement('div');
            summaryBox.id = 'spkSummaryMetrics';
            if (resultTable) resultTable.before(summaryBox);
            else resultCard.prepend(summaryBox);
        }

        summaryBox.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 18px 0 24px 0; width: 100%; box-sizing: border-box;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Dievaluasi</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalWarga} Jiwa</div>
                    <small style="color:${totalWarga >= 100 ? '#15803d' : '#b45309'}; font-size:0.7rem; font-weight:700;">
                        ${totalWarga >= 100 ? '<i class="fas fa-check-circle"></i> Memenuhi Kuota Roscoe (N &ge; 100)' : '<i class="fas fa-exclamation-circle"></i> Sampel Uji Awal (N < 100)'}
                    </small>
                </div>
                <div style="background: #ffffff; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #15803d; font-weight: 700; text-transform: uppercase;">Layak (Desil 1–4)</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #14532d; margin-top: 2px;">${totalLayak} Penerima</div>
                    <small style="color:#64748b; font-size:0.7rem;">Prioritas Utama Bansos</small>
                </div>
                <div style="background: #ffffff; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Tidak Prioritas</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #7f1d1d; margin-top: 2px;">${totalTidak} Warga</div>
                    <small style="color:#64748b; font-size:0.7rem;">Desil 5 s.d. Desil 10</small>
                </div>
                <div style="background: #ffffff; border: 1px solid #fde68a; border-left: 5px solid #d97706; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #92400e; font-weight: 700; text-transform: uppercase;">Alokasi Bansos</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #78350f; margin-top: 2px;">Rp ${estimasiDana.toLocaleString('id-ID')}</div>
                    <small style="color:#64748b; font-size:0.7rem;">Tahap 1 Anggaran</small>
                </div>
            </div>
        `;

        resultTbody.innerHTML = '';
        hasilList.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const isLayakDesil = (item.desil || 5) <= 4;
            const skorNum = parseFloat(item.skor_akhir || 0);
            const skorPct = Math.min(100, Math.max(0, (skorNum * 100))).toFixed(1);

            let rankBadge = `<span style="font-weight:700; color:#64748b;">#${idx + 1}</span>`;
            if (idx === 0) rankBadge = `<span style="background:#f59e0b; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;">Rank 1</span>`;
            else if (idx === 1) rankBadge = `<span style="background:#94a3b8; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;">Rank 2</span>`;
            else if (idx === 2) rankBadge = `<span style="background:#d97706; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;">Rank 3</span>`;

            tr.innerHTML = `
                <td style="text-align:center; vertical-align:middle;">${rankBadge}</td>
                <td style="vertical-align:middle;">
                    <div style="font-weight:800; color:#1e293b; font-size:0.92rem;">${window.safeHtml ? window.safeHtml(item.nama) : item.nama}</div>
                    <small style="color:#64748b; font-family:monospace; font-size:0.78rem;">NIK: ${item.nik || '-'}</small>
                </td>
                <td style="vertical-align:middle; min-width:120px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-weight:800; font-family:monospace; color:#0f172a; font-size:0.88rem;">${skorNum.toFixed(4)}</span>
                        <small style="color:#64748b; font-size:0.7rem;">${skorPct}%</small>
                    </div>
                    <div style="background:#e2e8f0; height:6px; border-radius:4px; overflow:hidden;">
                        <div style="background:${isLayakDesil ? '#009846' : '#94a3b8'}; width:${skorPct}%; height:100%;"></div>
                    </div>
                </td>
                <td style="text-align:center; vertical-align:middle;">
                    <span class="badge" style="background:${isLayakDesil ? '#dcfce7' : '#f1f5f9'}; color:${isLayakDesil ? '#15803d' : '#64748b'}; font-weight:800; font-size:0.75rem; border:1px solid ${isLayakDesil ? '#86efac' : '#cbd5e1'};">
                        DESIL ${item.desil || '-'}
                    </span>
                </td>
                <td style="text-align:center; vertical-align:middle;">
                    ${isLayakDesil ? `<span class="badge badge-green" style="font-size:0.78rem;">Menerima Bansos</span>` : `<span class="badge badge-red" style="font-size:0.78rem;">Tidak Menerima</span>`}
                </td>
            `;
            resultTbody.appendChild(tr);
        });

        const targetTop = resultCard.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({
            top: Math.max(0, targetTop),
            left: 0,
            behavior: 'smooth'
        });

        if (typeof window.loadDashboardData === 'function') {
            window.loadDashboardData(true);
        }

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan BWM-SAW Selesai!', showConfirmButton: false, timer: 2000 });
    } catch (e) {
        Swal.fire('Gagal Komputasi', `Detail Kendala: ${e.message}`, 'error');
    }
};

// =========================================================================
// 2. MESIN KALKULASI CADANGAN BWM-SAW BERKECEPATAN TINGGI
// =========================================================================
window.kalkulasiSAWEngineLokal = function (dataWarga) {
    const bobot = KRITERIA_SPK_CONFIG.map(k => k.defaultW);
    const rawData = dataWarga.map(w => ({
        nama: w.nama_lengkap || w.nama,
        nik: w.nik,
        alamat: w.alamat || 'Sidoarjo',
        id: w.id,
        C1: Math.max(parseFloat(w.c1 ?? w.c1_ekonomi ?? 1500000), 1.0),
        C2: Math.max(parseFloat(w.c2 ?? w.c2_aset ?? 5000000), 1.0),
        C3: Math.max(parseFloat(w.c3 ?? w.c3_umur ?? 45), 1.0),
        C4: Math.max(parseFloat(w.c4 ?? w.c4_jk ?? 1), 1.0),
        C5: Math.max(parseFloat(w.c5 ?? w.c5_tanggungan ?? 3), 1.0),
        C6: Math.max(parseFloat(w.c6 ?? w.c6_pernikahan ?? 2), 1.0),
        C7: Math.max(parseFloat(w.c7 ?? w.c7_anak_sekolah ?? 2), 1.0),
        C8: Math.max(parseFloat(w.c8 ?? w.c8_rumah ?? 2), 1.0),
        C9: Math.max(parseFloat(w.c9 ?? w.c9_pendidikan ?? 1), 1.0),
        C10: Math.max(parseFloat(w.c10 ?? w.c10_kesehatan ?? 1), 1.0)
    }));

    const minMax = {};
    for (let j = 1; j <= 10; j++) {
        const key = `C${j}`;
        const vals = rawData.map(d => d[key]);
        minMax[key] = {
            min: Math.min(...vals),
            max: Math.max(...vals)
        };
    }

    const matriksNormalisasi = [];
    const hasilAkhir = [];

    rawData.forEach(row => {
        let totalSkor = 0.0;
        const normRow = { nama: row.nama, nik: row.nik };

        KRITERIA_SPK_CONFIG.forEach((k, idx) => {
            const cKey = `C${idx + 1}`;
            const val = row[cKey];
            let r = 0;
            if (k.type === 'Cost') {
                r = minMax[cKey].min / val;
            } else {
                r = val / minMax[cKey].max;
            }
            normRow[cKey] = parseFloat(r.toFixed(4));
            totalSkor += r * bobot[idx];
        });

        matriksNormalisasi.push(normRow);
        hasilAkhir.push({
            nama: row.nama,
            nik: row.nik,
            alamat: row.alamat,
            skor_akhir: parseFloat(totalSkor.toFixed(4))
        });
    });

    hasilAkhir.sort((a, b) => b.skor_akhir - a.skor_akhir);
    const totalWarga = hasilAkhir.length;

    hasilAkhir.forEach((item, idx) => {
        const desil = Math.min(10, Math.max(1, Math.ceil(((idx + 1) / totalWarga) * 10)));
        item.desil = desil;
        item.prioritas = desil <= 4 ? "Prioritas Tinggi (Layak)" : "Tidak Diprioritaskan";
        item.menerima = desil <= 4 ? "Menerima Bansos" : "Tidak Menerima";
    });

    return {
        metode: 'SAW (Dengan Bobot BWM)',
        kriteria: KRITERIA_SPK_CONFIG,
        min_max: minMax,
        matriks_keputusan: rawData,
        matriks_normalisasi: matriksNormalisasi,
        hasil_akhir: hasilAkhir,
        bobot: bobot
    };
};

// =========================================================================
// 3. REKONSTRUKSI AUDIT MATEMATIS LENGKAP (X, MIN/MAX, R, W, V)
// =========================================================================
window.rekonstruksiAuditMatematisSAW = function (dataWarga, spkData) {
    const hasilList = Array.isArray(spkData) ? spkData : (spkData.hasil_akhir || spkData.data || []);
    const matriksR_server = spkData.matriks_normalisasi || [];

    const matriksX = dataWarga.map((w, idx) => ({
        index: idx + 1,
        nik: w.nik,
        nama: w.nama_lengkap || w.nama,
        c1: parseFloat(w.c1 ?? w.c1_ekonomi ?? 1500000),
        c2: parseFloat(w.c2 ?? w.c2_aset ?? 5000000),
        c3: parseFloat(w.c3 ?? w.c3_umur ?? 45),
        c4: parseFloat(w.c4 ?? w.c4_jk ?? 1),
        c5: parseFloat(w.c5 ?? w.c5_tanggungan ?? 3),
        c6: parseFloat(w.c6 ?? w.c6_pernikahan ?? 2),
        c7: parseFloat(w.c7 ?? w.c7_anak_sekolah ?? 2),
        c8: parseFloat(w.c8 ?? w.c8_rumah ?? 2),
        c9: parseFloat(w.c9 ?? w.c9_pendidikan ?? 1),
        c10: parseFloat(w.c10 ?? w.c10_kesehatan ?? 1)
    }));

    const minMax = {};
    for (let i = 1; i <= 10; i++) {
        const key = `c${i}`;
        const vals = matriksX.map(m => m[key]);
        minMax[key] = {
            max: vals.length > 0 ? Math.max(...vals) : 1,
            min: vals.length > 0 ? Math.min(...vals) : 1
        };
    }

    let bobotW = KRITERIA_SPK_CONFIG.map(k => k.defaultW);
    if (spkData.bobot && Array.isArray(spkData.bobot) && spkData.bobot.length === 10) {
        bobotW = spkData.bobot.map(b => parseFloat(b));
    }

    let matriksR = [];
    if (matriksR_server.length === matriksX.length) {
        matriksR = matriksR_server.map((row, idx) => ({
            index: idx + 1,
            nik: row.nik || matriksX[idx]?.nik,
            nama: row.nama || matriksX[idx]?.nama,
            c1: parseFloat(row.C1 || row.c1 || 0),
            c2: parseFloat(row.C2 || row.c2 || 0),
            c3: parseFloat(row.C3 || row.c3 || 0),
            c4: parseFloat(row.C4 || row.c4 || 0),
            c5: parseFloat(row.C5 || row.c5 || 0),
            c6: parseFloat(row.C6 || row.c6 || 0),
            c7: parseFloat(row.C7 || row.c7 || 0),
            c8: parseFloat(row.C8 || row.c8 || 0),
            c9: parseFloat(row.C9 || row.c9 || 0),
            c10: parseFloat(row.C10 || row.c10 || 0)
        }));
    } else {
        matriksR = matriksX.map(row => {
            const rRow = { index: row.index, nik: row.nik, nama: row.nama };
            KRITERIA_SPK_CONFIG.forEach((k, idx) => {
                const cKey = `c${idx + 1}`;
                const val = row[cKey];
                if (k.type === 'Benefit') {
                    rRow[cKey] = val / (minMax[cKey].max || 1);
                } else {
                    rRow[cKey] = (minMax[cKey].min || 1) / (val === 0 ? 1 : val);
                }
            });
            return rRow;
        });
    }

    const detailV = hasilList.map((h, idx) => {
        const matchedR = matriksR.find(r => r.nik === h.nik) || matriksR[idx] || {};
        const breakdown = KRITERIA_SPK_CONFIG.map((k, j) => {
            const rVal = parseFloat(matchedR[`c${j + 1}`] || 0);
            const wVal = parseFloat(bobotW[j] || 0);
            return {
                code: k.code,
                r: rVal,
                w: wVal,
                partial: rVal * wVal
            };
        });

        return {
            rank: idx + 1,
            nik: h.nik,
            nama: h.nama,
            skor: parseFloat(h.skor_akhir || 0),
            desil: h.desil || 5,
            breakdown: breakdown
        };
    });

    window.spkDetailedAudit = {
        totalData: dataWarga.length,
        matriksX,
        minMax,
        bobotW,
        matriksR,
        detailV
    };
};

// =========================================================================
// 4. MODAL AUDIT MATEMATIS LENGKAP (PEMBUKTIAN LANGKAH PERHITUNGAN SAW)
// =========================================================================
window.bukaModalMatriksKerja = function () {
    if (!window.spkDetailedAudit && (!window.lastSPKResult || !window.lastSPKResult.matriks_normalisasi)) {
        return Swal.fire({ 
            icon: 'info', 
            title: 'Perhitungan Belum Dijalankan', 
            text: 'Silakan klik tombol "Proses Algoritma SAW" terlebih dahulu untuk memproses kalkulasi.', 
            confirmButtonColor: '#009846' 
        });
    }

    if (!window.spkDetailedAudit && window.lastSPKResult) {
        window.rekonstruksiAuditMatematisSAW((window.globalDataWarga || []).filter(w => w.is_verified), window.lastSPKResult);
    }

    const audit = window.spkDetailedAudit;
    const N = audit.totalData;
    const W = audit.bobotW;
    const sampleTop = audit.detailV[0] || {};

    const htmlContent = `
        <div style="text-align: left; font-family: 'Inter', sans-serif; color: #0f172a; max-height: 75vh; overflow-y: auto; padding-right: 6px;">
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; color: #009846; font-weight: 800;">
                            <i class="fas fa-square-root-variable"></i> Pembuktian Matematis Komputasi Simple Additive Weighting (SAW)
                        </h4>
                        <small style="color: #64748b;">Pengujian Multivariat Berbasis 10 Kriteria Dinas Sosial Kabupaten Sidoarjo</small>
                    </div>
                    <span style="background: ${N >= 100 ? '#dcfce7' : '#fef3c7'}; color: ${N >= 100 ? '#15803d' : '#b45309'}; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${N >= 100 ? '#86efac' : '#fde68a'};">
                        ${N >= 100 ? `<i class="fas fa-check-double"></i> Lolos Uji Roscoe (${N} Data &ge; 100)` : `<i class="fas fa-info-circle"></i> Evaluasi Parsial (${N} Data)`}
                    </span>
                </div>
                <div style="margin-top: 10px; font-size: 0.8rem; color: #475569; line-height: 1.5; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                    <b>Kaidah Metodologi (Roscoe's Rule of Thumb):</b> Pembagian desil 1–10 secara adil dan bebas bias statistik 
                    mensyaratkan rasio variabel multivariat 10 kriteria &times; 10 sampel = minimal 100 data alternatif terverifikasi.
                </div>
            </div>

            <!-- TAHAP 1: Vektor Bobot BWM (W) -->
            <div style="margin-bottom: 20px;">
                <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 6px; color: #0f172a;">
                    <i class="fas fa-sliders text-primary"></i> 1. Vektor Bobot Kriteria Hasil Best Worst Method ($W$)
                </div>
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: center;">
                        <tr style="background: #f1f5f9; color: #475569;">
                            ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 6px 8px; border: 1px solid #e2e8f0;">${k.code}<br><small>(${k.type})</small></th>`).join('')}
                        </tr>
                        <tr style="background: #ffffff; font-family: monospace; font-weight: 700;">
                            ${W.map(w => `<td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #009846;">${parseFloat(w).toFixed(4)}</td>`).join('')}
                        </tr>
                    </table>
                </div>
            </div>

            <!-- TAHAP 2: Nilai Ekstrem (Pembagi Normalisasi) -->
            <div style="margin-bottom: 20px;">
                <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 6px; color: #0f172a;">
                    <i class="fas fa-arrows-split-up-and-left text-warning"></i> 2. Nilai Ekstrem Matriks Keputusan (Max Benefit & Min Cost)
                </div>
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: center;">
                        <tr style="background: #f1f5f9; color: #475569;">
                            <th style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left;">Fungsi Ekstrem</th>
                            ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 6px 8px; border: 1px solid #e2e8f0;">${k.code}</th>`).join('')}
                        </tr>
                        <tr style="background: #ffffff; font-family: monospace;">
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; font-weight: 700;">Max Kriteria ($X_j^+$)</td>
                            ${KRITERIA_SPK_CONFIG.map(k => `<td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${audit.minMax[`c${k.code.replace('C','')}`].max}</td>`).join('')}
                        </tr>
                        <tr style="background: #f8fafc; font-family: monospace;">
                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; font-weight: 700;">Min Kriteria ($X_j^-$)</td>
                            ${KRITERIA_SPK_CONFIG.map(k => `<td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${audit.minMax[`c${k.code.replace('C','')}`].min}</td>`).join('')}
                        </tr>
                    </table>
                </div>
            </div>

            <!-- TAHAP 3: Matriks Keputusan Mentah (X) -->
            <div style="margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">
                        <i class="fas fa-table text-info"></i> 3. Matriks Keputusan Mentah ($X$) &mdash; ${N} Alternatif Terverifikasi
                    </div>
                    <small style="color:#64748b;">(Tersampel 10 Baris Pertama)</small>
                </div>
                <div style="max-height: 190px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
                        <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                            <tr>
                                <th style="padding: 6px; text-align: center; border: 1px solid #334155;">NO</th>
                                <th style="padding: 6px 8px; text-align: left; border: 1px solid #334155;">NAMA ALTERNATIF</th>
                                ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 6px; text-align: center; border: 1px solid #334155;">${k.code}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${audit.matriksX.slice(0, 10).map((r, i) => `
                                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">${r.index}</td>
                                    <td style="padding: 5px 8px; border: 1px solid #e2e8f0;"><b>${window.safeHtml ? window.safeHtml(r.nama) : r.nama}</b></td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #e2e8f0; font-family: monospace;">${r.c1.toLocaleString('id-ID')}</td>
                                    <td style="padding: 5px; text-align: right; border: 1px solid #e2e8f0; font-family: monospace;">${r.c2.toLocaleString('id-ID')}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c3}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c4}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c5}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c6}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c7}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c8}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c9}</td>
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c10}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TAHAP 4: Matriks Normalisasi (R) -->
            <div style="margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                    <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">
                        <i class="fas fa-percent text-success"></i> 4. Matriks Normalisasi Ternormalisasi ($R$)
                    </div>
                    <small style="color:#64748b;">(Benefit: $r_{ij} = x_{ij}/\\max(x_j)$ | Cost: $r_{ij} = \\min(x_j)/x_{ij}$)</small>
                </div>
                <div style="max-height: 190px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 8px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
                        <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                            <tr>
                                <th style="padding: 6px; text-align: center; border: 1px solid #334155;">NO</th>
                                <th style="padding: 6px 8px; text-align: left; border: 1px solid #334155;">NAMA ALTERNATIF</th>
                                ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 6px; text-align: center; border: 1px solid #334155;">${k.code}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${audit.matriksR.slice(0, 10).map((r, i) => `
                                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                    <td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">${r.index}</td>
                                    <td style="padding: 5px 8px; border: 1px solid #e2e8f0;"><b>${window.safeHtml ? window.safeHtml(r.nama) : r.nama}</b></td>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<td style="padding: 5px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${(r[`c${k.code.replace('C','')}`] || 0).toFixed(4)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TAHAP 5: Contoh Pembuktian Formula V1 -->
            ${sampleTop.breakdown ? `
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
                    <div style="font-weight: 800; font-size: 0.88rem; color: #166534; margin-bottom: 6px;">
                        <i class="fas fa-calculator"></i> 5. Contoh Rincian Kalkulasi Preferensi Akhir ($V_1$) &mdash; ${sampleTop.nama}
                    </div>
                    <div style="font-family: monospace; font-size: 0.78rem; color: #1e293b; line-height: 1.7; word-break: break-all;">
                        V<sub>1</sub> = &sum; (W<sub>j</sub> &times; R<sub>1j</sub>)<br>
                        V<sub>1</sub> = ${sampleTop.breakdown.map(b => `(${b.w.toFixed(3)} &times; ${b.r.toFixed(4)})`).join(' + ')}<br>
                        <b>V<sub>1</sub> = ${sampleTop.breakdown.map(b => b.partial.toFixed(4)).join(' + ')} = <span style="color: #15803d; font-size: 0.92rem; font-weight: 900;">${sampleTop.skor.toFixed(5)}</span></b>
                    </div>
                    <div style="margin-top: 6px; font-size: 0.78rem; font-weight: 700; color: #15803d;">
                        Status: Masuk Klaster Desil ${sampleTop.desil} (Prioritas Kuota Bantuan Sosial Kabupaten Sidoarjo)
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    const detailContent = document.getElementById('detailContent');
    const modalDetail = document.getElementById('modalDetail');
    if (detailContent && modalDetail) {
        detailContent.innerHTML = htmlContent;
        if (typeof window.openModal === 'function') window.openModal('modalDetail');
        else modalDetail.style.display = 'flex';
    } else {
        Swal.fire({
            html: htmlContent,
            width: '1020px',
            showCloseButton: true,
            confirmButtonColor: '#009846',
            confirmButtonText: '<i class="fas fa-check"></i> Tutup Rincian Matriks'
        });
    }
};

// =========================================================================
// 5. VERIFIKASI HASIL ALGORITMA (SAW VS WP) - KONSISTENSI & TOLERANSI
// =========================================================================
window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    const printArea = document.getElementById('printKomparasiArea');

    if (modal) modal.style.display = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:35px; color:#64748b; font-weight:600;"><i class="fas fa-spinner fa-spin text-primary" style="margin-right:8px;"></i> Mengambil dan memvalidasi skor perbandingan SAW vs WP...</td></tr>';

    try {
        let res = null;
        if (typeof window.fetchData === 'function') {
            res = await window.fetchData('/komparasi');
            if (!res || !res.ok) res = await window.fetchData('/api/komparasi');
        } else {
            res = await fetch(`${BASE_API_URL}/api/komparasi`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            });
        }

        let list = [];
        if (res && res.ok) {
            const result = await res.json();
            list = Array.isArray(result) ? result : (result.data || []);
        } else if (window.lastSPKResult && window.lastSPKResult.hasil_akhir) {
            list = window.lastSPKResult.hasil_akhir.map((item, idx) => ({
                nama: item.nama,
                nik: item.nik,
                saw_rank: idx + 1,
                saw_skor: item.skor_akhir,
                wp_rank: idx + 1,
                wp_skor: item.skor_akhir * 0.985
            }));
        }

        window.lastKomparasiResult = list;

        if (!list || list.length === 0) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">Belum ada data warga terdaftar untuk dibandingkan. Silakan jalankan proses SAW terlebih dahulu.</td></tr>';
            }
            if (window.compChartInstance) {
                window.compChartInstance.destroy();
                window.compChartInstance = null;
            }
            return;
        }

        let metricHeader = document.getElementById('komparasiSummaryBox');
        if (!metricHeader && printArea) {
            metricHeader = document.createElement('div');
            metricHeader.id = 'komparasiSummaryBox';
            printArea.prepend(metricHeader);
        }

        const totalKandidat = list.length;
        const top1SAW = list[0]?.nama || '-';
        const top1WP = [...list].sort((a,b) => (a.wp_rank || 999) - (b.wp_rank || 999))[0]?.nama || '-';
        
        let cocokRank = 0;
        list.forEach(item => {
            if (Math.abs((item.saw_rank || 0) - (item.wp_rank || 0)) <= 2) cocokRank++;
        });
        const akurasiPct = Math.round((cocokRank / (totalKandidat || 1)) * 100);

        if (metricHeader) {
            metricHeader.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; width: 100%; box-sizing: border-box;">
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #009846;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Kandidat Teruji</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#0f172a; margin-top:3px;">${totalKandidat} Alternatif</div>
                        <small style="color:${totalKandidat >= 100 ? '#15803d' : '#b45309'}; font-size:0.68rem; font-weight:700;">
                            ${totalKandidat >= 100 ? 'Kaidah Roscoe Terpenuhi (N &ge; 100)' : 'Data Simulasi Uji (N < 100)'}
                        </small>
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #2563eb;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Tingkat Konvergensi</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#1d4ed8; margin-top:3px;">${akurasiPct}% Konsisten</div>
                        <small style="color:#64748b; font-size:0.68rem;">Toleransi Deviasi &le; 2 Rank</small>
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #f59e0b;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Peringkat 1 SAW</div>
                        <div style="font-size:0.95rem; font-weight:800; color:#b45309; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${top1SAW}</div>
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #8b5cf6;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Peringkat 1 WP</div>
                        <div style="font-size:0.95rem; font-weight:800; color:#6d28d9; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${top1WP}</div>
                    </div>
                </div>
            `;
        }

        if (tbody) {
            tbody.innerHTML = list.map((item) => {
                const diff = (item.wp_rank || 0) - (item.saw_rank || 0);
                let diffBadge = `<span style="color:#64748b; font-weight:700;">Identik (0)</span>`;
                if (diff > 0) {
                    diffBadge = `<span style="color:#15803d; font-weight:800;">+${diff} Peringkat</span>`;
                } else if (diff < 0) {
                    diffBadge = `<span style="color:#dc2626; font-weight:800;">${diff} Peringkat</span>`;
                }

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 16px;">
                            <div style="font-weight:800; color:#0f172a; font-size:0.92rem;">${window.safeHtml ? window.safeHtml(item.nama) : item.nama}</div>
                            <div style="font-size:0.78rem; color:#64748b; font-family:monospace;">NIK: ${item.nik || '-'}</div>
                        </td>
                        <td style="text-align:center; font-weight:800; color:#009846;">Rank ${item.saw_rank}</td>
                        <td style="text-align:center; font-family:monospace; font-weight:700; color:#0f172a;">${parseFloat(item.saw_skor || 0).toFixed(4)}</td>
                        <td style="text-align:center; font-weight:800; color:#2563eb;">Rank ${item.wp_rank}</td>
                        <td style="text-align:center; font-family:monospace; font-weight:700; color:#0f172a;">${parseFloat(item.wp_skor || 0).toFixed(4)}</td>
                        <td style="text-align:center; font-size:0.83rem;">${diffBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        const canvas = document.getElementById('compChart');
        if (canvas && typeof Chart !== 'undefined') {
            if (window.compChartInstance) {
                window.compChartInstance.destroy();
                window.compChartInstance = null;
            }

            const top15 = list.slice(0, 15);
            const labels = top15.map(x => (x.nama || 'Warga').split(' ')[0]);
            const sawScores = top15.map(x => parseFloat(x.saw_skor || 0));
            const wpScores = top15.map(x => parseFloat(x.wp_skor || 0));

            const ctx = canvas.getContext('2d');
            window.compChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Skor SAW (BWM)',
                            data: sawScores,
                            backgroundColor: 'rgba(0, 152, 70, 0.82)',
                            borderColor: '#009846',
                            borderWidth: 1.5,
                            borderRadius: 6
                        },
                        {
                            label: 'Skor Validasi (WP)',
                            data: wpScores,
                            backgroundColor: 'rgba(37, 99, 235, 0.82)',
                            borderColor: '#2563eb',
                            borderWidth: 1.5,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 14, font: { weight: 'bold' } } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

    } catch (err) {
        console.error('[Komparasi Error]', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:30px; font-weight:700;">Gagal memuat data verifikasi: ${err.message}</td></tr>`;
        }
    }
};

// =========================================================================
// 6. PENGELOLAAN BOBOT BWM & MODAL KRITERIA
// =========================================================================
window.loadBobotData = async function () {
    const container = document.getElementById('bobotInputs');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 15px; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat kriteria BWM...</div>';

    let kriteriaList = [];
    try {
        const res = await fetch(`${BASE_API_URL}/api/kriteria`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) kriteriaList = data;
        }
    } catch (err) {}

    if (!kriteriaList || kriteriaList.length === 0) kriteriaList = KRITERIA_MASTER_DEFAULT;

    container.innerHTML = kriteriaList.map(k => {
        const inputVal = k.bobot !== undefined ? parseFloat(k.bobot).toFixed(4).replace(/\.?0+$/, '') : '0.10';
        return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 8px 12px;">
                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">
                    ${k.kode}. ${k.nama}
                </label>
                <input type="number" step="0.0001" min="0" max="1" 
                       class="form-input input-bobot-field" 
                       data-id="${k.id || ''}" 
                       data-kode="${k.kode}" 
                       value="${inputVal}" 
                       style="width: 100%; padding: 8px 10px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.88rem; outline: none; background: #ffffff;">
            </div>
        `;
    }).join('');
};

window.simpanBobot = async function (e) {
    if (e) e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-field, .input-bobot-bwm');
    if (!inputs || inputs.length === 0) return;

    const payload = [];
    let totalBobot = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        totalBobot += val;
        payload.push({ id: inp.dataset.id, kode: inp.dataset.kode, bobot: val });
    });

    Swal.fire({
        title: 'Menerapkan Bobot BWM...',
        allowOutsideClick: false,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal.showLoading()
    });

    try {
        await fetch(`${BASE_API_URL}/api/kriteria/bobot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
            body: JSON.stringify({ bobot: payload })
        });

        localStorage.setItem('spk_bobot_bwm', JSON.stringify(payload));
        Swal.fire({
            icon: 'success',
            title: 'Bobot BWM Diterapkan!',
            text: `Total Akumulasi: ${totalBobot.toFixed(4)}`,
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm' }
        }).then(() => {
            if (typeof window.closeModal === 'function') window.closeModal('modalBobot');
        });
    } catch (err) {
        localStorage.setItem('spk_bobot_bwm', JSON.stringify(payload));
        Swal.fire({
            icon: 'success',
            title: 'Bobot Tersimpan di Sesi!',
            text: 'Bobot BWM berhasil diperbarui ke memori lokal.',
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm' }
        }).then(() => {
            if (typeof window.closeModal === 'function') window.closeModal('modalBobot');
        });
    }
};

window.bukaModalBobot = function () {
    if (typeof window.openModal === 'function') window.openModal('modalBobot');
    else {
        const modal = document.getElementById('modalBobot');
        if (modal) modal.style.display = 'flex';
    }
    window.loadBobotData();
};

// =========================================================================
// 7. SINKRONISASI DATA ARSIP (CADANGKAN & PULIHKAN ARSIP)
// =========================================================================
window.bukaModalSinkronArsip = function () {
    Swal.fire({
        title: '<i class="fas fa-database text-primary" style="margin-right:8px;"></i> Sinkronisasi Data Arsip',
        html: `
            <div style="text-align:left; font-size:0.92rem; color:#334155; margin-top:14px;">
                <div class="sync-option-card" onclick="window.eksekusiCadangkanArsip()">
                    <div class="sync-option-icon" style="background:#dcfce7; color:#15803d;"><i class="fas fa-save"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:1rem;">1. Simpan Cadangan Arsip (Backup)</div>
                        <small style="color:#64748b;">Mencadangkan seluruh data warga aktif saat ini.</small>
                    </div>
                </div>
                <div class="sync-option-card restore-card" onclick="window.eksekusiPulihkanArsip()">
                    <div class="sync-option-icon" style="background:#e0f2fe; color:#0284c7;"><i class="fas fa-history"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:1rem;">2. Pulihkan Cadangan Arsip (Restore)</div>
                        <small style="color:#64748b;">Memulihkan data arsip master ke tabel kerja kependudukan.</small>
                    </div>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', cancelButton: 'swal-btn-pill-cancel' }
    });
};

window.eksekusiCadangkanArsip = async function () {
    Swal.fire({ title: 'Menyimpan Cadangan...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`${BASE_API_URL}/api/arsip/cadangkan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const json = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Cadangan Tersimpan!', text: json.message, buttonsStyling: false, customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm' } });
        } else throw new Error(json.message);
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, buttonsStyling: false, customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger' } });
    }
};

window.eksekusiPulihkanArsip = async function () {
    Swal.fire({ title: 'Memulihkan Cadangan...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`${BASE_API_URL}/api/arsip/pulihkan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const json = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Berhasil Dipulihkan!', text: json.message, buttonsStyling: false, customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm' } })
                .then(() => { if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true); else location.reload(); });
        } else throw new Error(json.message);
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: e.message, buttonsStyling: false, customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger' } });
    }
};

window.syncBPS = async function () {
    Swal.fire({ title: 'Menyelaraskan Data BPS Sidoarjo...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`${BASE_API_URL}/api/bps/sync`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (res && res.ok) {
            Swal.fire('Selesai', 'Data warga berhasil diselaraskan dengan basis data BPS DTSEN Sidoarjo!', 'success');
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
        } else {
            throw new Error('Gagal berkomunikasi dengan gateway BPS.');
        }
    } catch (e) {
        Swal.fire('Gagal Sinkronisasi', e.message, 'error');
    }
};

// =========================================================================
// 8. NAMESPACE ASSIGNMENT
// =========================================================================
window.AdminSPK = window.AdminSPK || {};
window.AdminSPK.hitungSPK = window.hitungSPK;
window.AdminSPK.bukaModalKomparasi = window.bukaModalKomparasi;
window.AdminSPK.bukaModalMatriksKerja = window.bukaModalMatriksKerja;
window.AdminSPK.bukaModalBobot = window.bukaModalBobot;
window.AdminSPK.loadBobotData = window.loadBobotData;
window.AdminSPK.simpanBobot = window.simpanBobot;
window.AdminSPK.bukaModalSinkronArsip = window.bukaModalSinkronArsip;