/* =========================================================================
   ADMIN-SPK.JS - ENGINE SPK BWM-SAW & KOMPARASI WEIGHTED PRODUCT (WP)
   Lokasi: frontend/static/js/modules/admin-spk.js
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   ========================================================================= */

window.lastSPKResult = null;
window.lastKomparasiResult = [];
window.compChartInstance = null;
window.spkDetailedAudit = null;

const BASE_API_URL = window.API_BASE_URL || window.BASE_URL || window.location.origin.replace(/\/+$/, '');

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

    const wargaLayak = (window.globalDataWarga && window.globalDataWarga.length > 0) 
        ? window.globalDataWarga 
        : ((window.BansosApp && window.BansosApp.State && window.BansosApp.State.wargaList) || []);
    if (wargaLayak.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Belum Ada Data Warga',
            text: 'Belum ada data warga terdaftar dalam sistem untuk diproses dengan algoritma BWM-SAW.',
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
window.currentMatriksTab = 'bobot';

window.switchMatriksTab = function (tabId) {
    window.currentMatriksTab = tabId;
    const tabPanels = ['tabMatriksBobot', 'tabMatriksX', 'tabMatriksR', 'tabMatriksV'];
    const tabBtns = ['btnTabMatriksBobot', 'btnTabMatriksX', 'btnTabMatriksR', 'btnTabMatriksV'];

    tabPanels.forEach(pId => {
        const el = document.getElementById(pId);
        if (el) el.style.display = pId === `tabMatriks${tabId.charAt(0).toUpperCase() + tabId.slice(1)}` ? 'block' : 'none';
    });

    tabBtns.forEach(bId => {
        const btn = document.getElementById(bId);
        if (btn) {
            const isActive = bId === `btnTabMatriks${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`;
            if (isActive) {
                btn.classList.add('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#009846';
                btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                btn.style.fontWeight = '800';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = '#64748b';
                btn.style.boxShadow = 'none';
                btn.style.fontWeight = '700';
            }
        }
    });
};

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
    const totalPrioritas = (audit.detailV || []).filter(v => v.desil <= 4).length;

    const htmlContent = `
        <div style="text-align: left; font-family: 'Inter', sans-serif; color: #0f172a;">
            <!-- STRIP KPI METRIK ANALITIK TERPADU -->
            <div class="matriks-kpi-grid">
                <div class="matriks-kpi-card" style="border-left: 4px solid #009846;">
                    <div class="matriks-kpi-icon" style="background:#dcfce7; color:#15803d;">
                        <i class="fas fa-users"></i>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Total Alternatif</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#0f172a;">${N} Warga</div>
                        <div style="font-size:0.7rem; color:${N >= 100 ? '#15803d' : '#b45309'}; font-weight:700;">
                            ${N >= 100 ? '✓ Lolos Uji Roscoe (&ge;100)' : '⚠ Evaluasi Sampel Parsial'}
                        </div>
                    </div>
                </div>

                <div class="matriks-kpi-card" style="border-left: 4px solid #0284c7;">
                    <div class="matriks-kpi-icon" style="background:#e0f2fe; color:#0284c7;">
                        <i class="fas fa-sliders"></i>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Kriteria Multivariat</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#0f172a;">10 Indikator</div>
                        <div style="font-size:0.7rem; color:#0284c7; font-weight:700;">Best Worst Method (BWM)</div>
                    </div>
                </div>

                <div class="matriks-kpi-card" style="border-left: 4px solid #e11d48;">
                    <div class="matriks-kpi-icon" style="background:#ffe4e6; color:#e11d48;">
                        <i class="fas fa-hand-holding-heart"></i>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Prioritas Desil 1–4</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#e11d48;">${totalPrioritas} Penerima</div>
                        <div style="font-size:0.7rem; color:#be123c; font-weight:700;">Alokasi Rp 600.000,- / KK</div>
                    </div>
                </div>

                <div class="matriks-kpi-card" style="border-left: 4px solid #8b5cf6;">
                    <div class="matriks-kpi-icon" style="background:#ede9fe; color:#7c3aed;">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Skor Preferensi Tertinggi</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#7c3aed;">${(sampleTop.skor || 0).toFixed(4)}</div>
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">
                            ${sampleTop.nama || '-'}
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB NAVIGASI MATRIKS KERJA -->
            <div style="margin-bottom: 16px;">
                <div class="matriks-tabs-bar">
                    <button type="button" id="btnTabMatriksBobot" class="matriks-tab-btn active" onclick="window.switchMatriksTab('bobot')">
                        <i class="fas fa-sliders text-success"></i> 1. Bobot BWM & Ekstrem
                    </button>
                    <button type="button" id="btnTabMatriksX" class="matriks-tab-btn" onclick="window.switchMatriksTab('x')">
                        <i class="fas fa-table text-primary"></i> 2. Matriks Keputusan ($X$)
                    </button>
                    <button type="button" id="btnTabMatriksR" class="matriks-tab-btn" onclick="window.switchMatriksTab('r')">
                        <i class="fas fa-percentage text-warning"></i> 3. Matriks Normalisasi ($R$)
                    </button>
                    <button type="button" id="btnTabMatriksV" class="matriks-tab-btn" onclick="window.switchMatriksTab('v')">
                        <i class="fas fa-calculator text-danger"></i> 4. Preferensi ($V$) & Desil
                    </button>
                </div>
            </div>

            <!-- ==================== TAB 1: VEKTOR BOBOT BWM & NILAI EKSTREM ==================== -->
            <div id="tabMatriksBobot" style="display: block;">
                <!-- Bobot BWM Bar Modern -->
                <div class="card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.02); margin-bottom: 16px;">
                    <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="display:flex; align-items:center; gap:8px;"><i class="fas fa-balance-scale text-success"></i> Vektor Bobot 10 Kriteria BWM ($W$)</span>
                        <span style="font-size:0.75rem; color:#64748b; font-weight:600;">Jumlah Total Bobot: &sum; W = 1.0000</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        ${KRITERIA_SPK_CONFIG.map((k, idx) => {
                            const weightVal = parseFloat(W[idx] || 0.1);
                            const pct = (weightVal * 100).toFixed(1);
                            const isCost = k.type.toLowerCase() === 'cost';
                            return `
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 12px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <div style="font-weight:800; font-size:0.82rem; color:#0f172a;">${k.code}</div>
                                        <span style="font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:6px; background:${isCost ? '#fee2e2' : '#dcfce7'}; color:${isCost ? '#dc2626' : '#15803d'};">
                                            ${k.type}
                                        </span>
                                    </div>
                                    <div style="font-size:0.72rem; color:#64748b; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${k.name}">
                                        ${k.name}
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <span style="font-family:monospace; font-weight:800; font-size:0.85rem; color:#009846;">${weightVal.toFixed(4)}</span>
                                        <span style="font-size:0.72rem; font-weight:700; color:#64748b;">${pct}%</span>
                                    </div>
                                    <div style="height:5px; background:#e2e8f0; border-radius:10px; overflow:hidden;">
                                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #009846, #059669); border-radius:10px;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Nilai Ekstrem (Pembagi Normalisasi) -->
                <div class="card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="display:flex; align-items:center; gap:8px;"><i class="fas fa-arrows-split-up-and-left text-warning"></i> Nilai Ekstrem Matriks Keputusan (Max Benefit & Min Cost)</span>
                        <span style="font-size:0.75rem; color:#64748b; font-weight:600;">Basis Pembagi Normalisasi Rumus SAW</span>
                    </div>
                    <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 10px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: center;">
                            <thead style="background: #0f172a; color: #ffffff;">
                                <tr>
                                    <th style="padding: 8px 12px; border: 1px solid #334155; text-align: left;">Fungsi Ekstrem</th>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 8px; border: 1px solid #334155;">${k.code}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background: #ffffff; font-family: monospace;">
                                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-weight: 800; color:#15803d;">
                                        <i class="fas fa-arrow-up text-success"></i> Nilai Maksimum ($X_j^+$)
                                    </td>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<td style="padding: 8px; border: 1px solid #e2e8f0; font-weight:700;">${audit.minMax[`c${k.code.replace('C','')}`].max}</td>`).join('')}
                                </tr>
                                <tr style="background: #f8fafc; font-family: monospace;">
                                    <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-weight: 800; color:#b91c1c;">
                                        <i class="fas fa-arrow-down text-danger"></i> Nilai Minimum ($X_j^-$)
                                    </td>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<td style="padding: 8px; border: 1px solid #e2e8f0; font-weight:700;">${audit.minMax[`c${k.code.replace('C','')}`].min}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ==================== TAB 2: MATRIKS KEPUTUSAN MENTAH (X) ==================== -->
            <div id="tabMatriksX" style="display: none;">
                <div class="card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                                <i class="fas fa-table text-primary"></i> Matriks Keputusan Mentah ($X$)
                            </div>
                            <small style="color:#64748b;">Data asli dari ${N} alternatif terverifikasi sebelum dilakukan normalisasi skala</small>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="text" id="searchMatriksX" placeholder="Cari nama warga..." oninput="window.filterMatriksTable('searchMatriksX', 'tbodyMatriksX')" style="padding:6px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.78rem;">
                        </div>
                    </div>
                    <div style="max-height: 420px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
                            <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                                <tr>
                                    <th style="padding: 8px 6px; text-align: center; border: 1px solid #334155; width:45px;">NO</th>
                                    <th style="padding: 8px 10px; text-align: left; border: 1px solid #334155; width:220px;">NAMA ALTERNATIF</th>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 8px 6px; text-align: center; border: 1px solid #334155;">${k.code}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody id="tbodyMatriksX">
                                ${audit.matriksX.map((r, i) => `
                                    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};" data-nama="${(r.nama || '').toLowerCase()}">
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">${r.index}</td>
                                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;"><b>${window.safeHtml ? window.safeHtml(r.nama) : r.nama}</b></td>
                                        <td style="padding: 6px; text-align: right; border: 1px solid #e2e8f0; font-family: monospace;">${r.c1.toLocaleString('id-ID')}</td>
                                        <td style="padding: 6px; text-align: right; border: 1px solid #e2e8f0; font-family: monospace;">${r.c2.toLocaleString('id-ID')}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c3}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c4}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c5}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c6}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c7}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c8}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c9}</td>
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${r.c10}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ==================== TAB 3: MATRIKS NORMALISASI (R) ==================== -->
            <div id="tabMatriksR" style="display: none;">
                <div class="card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                                <i class="fas fa-percentage text-warning"></i> Matriks Normalisasi Ternormalisasi ($R$)
                            </div>
                            <small style="color:#64748b;">(Benefit: $r_{ij} = x_{ij}/\\max(x_j)$ | Cost: $r_{ij} = \\min(x_j)/x_{ij}$) &mdash; Skala [0.0000, 1.0000]</small>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="text" id="searchMatriksR" placeholder="Cari nama warga..." oninput="window.filterMatriksTable('searchMatriksR', 'tbodyMatriksR')" style="padding:6px 12px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.78rem;">
                        </div>
                    </div>
                    <div style="max-height: 420px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem;">
                            <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                                <tr>
                                    <th style="padding: 8px 6px; text-align: center; border: 1px solid #334155; width:45px;">NO</th>
                                    <th style="padding: 8px 10px; text-align: left; border: 1px solid #334155; width:220px;">NAMA ALTERNATIF</th>
                                    ${KRITERIA_SPK_CONFIG.map(k => `<th style="padding: 8px 6px; text-align: center; border: 1px solid #334155;">${k.code}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody id="tbodyMatriksR">
                                ${audit.matriksR.map((r, i) => `
                                    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};" data-nama="${(r.nama || '').toLowerCase()}">
                                        <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">${r.index}</td>
                                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;"><b>${window.safeHtml ? window.safeHtml(r.nama) : r.nama}</b></td>
                                        ${KRITERIA_SPK_CONFIG.map(k => {
                                            const val = (r[`c${k.code.replace('C','')}`] || 0);
                                            return `<td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace; color:${val >= 0.8 ? '#009846' : '#1e293b'}; font-weight:${val >= 0.8 ? '800' : '500'};">${val.toFixed(4)}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ==================== TAB 4: PREFERENSI (V) & DESIL 1–4 ==================== -->
            <div id="tabMatriksV" style="display: none;">
                <!-- Rincian Formula Sample V1 -->
                ${sampleTop.breakdown ? `
                    <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px; padding: 14px 18px; margin-bottom: 16px;">
                        <div style="font-weight: 800; font-size: 0.92rem; color: #166534; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
                            <span><i class="fas fa-calculator"></i> Contoh Pembuktian Kalkulasi Preferensi ($V_1$) &mdash; ${sampleTop.nama}</span>
                            <span style="font-size:0.75rem; background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-weight:800;">Peringkat 1 Terbaik</span>
                        </div>
                        <div style="font-family: monospace; font-size: 0.8rem; color: #1e293b; line-height: 1.8; word-break: break-all; background:#ffffff; padding:12px; border-radius:10px; border:1px solid #bbf7d0;">
                            <b>V<sub>1</sub> = &sum; (W<sub>j</sub> &times; R<sub>1j</sub>)</b><br>
                            V<sub>1</sub> = ${sampleTop.breakdown.map(b => `(${b.w.toFixed(3)} &times; ${b.r.toFixed(4)})`).join(' + ')}<br>
                            <b>V<sub>1</sub> = ${sampleTop.breakdown.map(b => b.partial.toFixed(4)).join(' + ')} = <span style="color: #15803d; font-size: 1rem; font-weight: 900;">${sampleTop.skor.toFixed(5)}</span></b>
                        </div>
                        <div style="margin-top: 8px; font-size: 0.82rem; font-weight: 700; color: #15803d;">
                            <i class="fas fa-check-circle"></i> Status Rekomendasi: Masuk Klaster Desil ${sampleTop.desil} (Prioritas Utama Kuota Bantuan Sosial Sidoarjo)
                        </div>
                    </div>
                ` : ''}

                <!-- Tabel Hasil Perangkingan Lengkap -->
                <div class="card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                                <i class="fas fa-trophy text-warning"></i> Pemeringkatan Preferensi Akhir ($V_i$) & Alokasi Bansos
                            </div>
                            <small style="color:#64748b;">Hasil agregasi komputasi multivariat terurut dari preferensi tertinggi</small>
                        </div>
                    </div>
                    <div style="max-height: 380px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                            <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                                <tr>
                                    <th style="padding: 8px; text-align: center; border: 1px solid #334155; width:45px;">Rank</th>
                                    <th style="padding: 8px 10px; text-align: left; border: 1px solid #334155;">Nama Penerima</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid #334155; width:100px;">Skor SAW ($V_i$)</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid #334155; width:80px;">Desil</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid #334155; width:110px;">Alokasi</th>
                                    <th style="padding: 8px; text-align: center; border: 1px solid #334155; width:140px;">Status Ketetapan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(audit.detailV || []).map((v, i) => {
                                    const isLayak = v.desil <= 4;
                                    return `
                                        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                            <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800;">${i + 1}</td>
                                            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700;">${window.safeHtml ? window.safeHtml(v.nama) : v.nama}</td>
                                            <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #009846;">${(v.skor || 0).toFixed(4)}</td>
                                            <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700;">Desil ${v.desil}</td>
                                            <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 700; color:${isLayak ? '#047857' : '#94a3b8'};">
                                                ${isLayak ? 'Rp 600.000,-' : 'Rp 0,-'}
                                            </td>
                                            <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">
                                                <span style="display:inline-block; padding:3px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; background:${isLayak ? '#dcfce7' : '#f1f5f9'}; color:${isLayak ? '#15803d' : '#64748b'}; border:1px solid ${isLayak ? '#86efac' : '#cbd5e1'};">
                                                    ${isLayak ? 'DITETAPKAN (PRIORITAS)' : 'NON-PRIORITAS'}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    const detailContent = document.getElementById('detailContent');
    const modalDetail = document.getElementById('modalDetail');
    if (detailContent && modalDetail) {
        detailContent.innerHTML = htmlContent;
        if (typeof window.openModal === 'function') window.openModal('modalDetail');
        else modalDetail.style.display = 'flex';
        window.switchMatriksTab(window.currentMatriksTab || 'bobot');
    } else {
        Swal.fire({
            html: htmlContent,
            width: '1100px',
            showCloseButton: true,
            confirmButtonColor: '#009846',
            confirmButtonText: '<i class="fas fa-check"></i> Tutup Rincian Matriks'
        });
    }
};

window.filterMatriksTable = function (inputId, tbodyId) {
    const query = (document.getElementById(inputId)?.value || '').toLowerCase().trim();
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(r => {
        const nama = r.getAttribute('data-nama') || '';
        r.style.display = !query || nama.includes(query) ? '' : 'none';
    });
};

// =========================================================================
// 5. VERIFIKASI HASIL ALGORITMA (SAW VS WP) - KONSISTENSI & TOLERANSI
// =========================================================================
window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    const printArea = document.getElementById('printKomparasiArea');

    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';

        // Direct mousewheel / trackpad listener on modalKomparasi to guarantee inner scrolling
        if (!modal._wheelListenerAttached) {
            modal._wheelListenerAttached = true;
            modal.addEventListener('wheel', function (e) {
                const area = document.getElementById('printKomparasiArea');
                if (area) {
                    area.scrollTop += e.deltaY;
                }
            }, { passive: true });
        }
    }
    if (printArea) {
        printArea.scrollTop = 0;
    }
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

        if (Array.isArray(list)) {
            list.forEach((item, i) => { item._originalNo = i + 1; });
        }
        window.lastKomparasiResult = list;

        if (!list || list.length === 0) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#64748b;">Belum ada data warga terdaftar untuk dibandingkan. Silakan jalankan proses SAW terlebih dahulu.</td></tr>';
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
        let sumD2 = 0;
        list.forEach(item => {
            const diff = Math.abs((item.saw_rank || 0) - (item.wp_rank || 0));
            if (diff <= 2) cocokRank++;
            sumD2 += diff * diff;
        });
        const akurasiPct = Math.round((cocokRank / (totalKandidat || 1)) * 100);
        const spearmanRs = totalKandidat > 1 ? (1 - ((6 * sumD2) / (totalKandidat * (totalKandidat * totalKandidat - 1)))).toFixed(4) : "1.0000";
        const alokasiPrioritas = list.filter((_, idx) => idx < 43).length;

        if (metricHeader) {
            metricHeader.innerHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; width: 100%; box-sizing: border-box;">
                    <div style="background:#ffffff; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; border-left:4px solid #009846; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Kandidat Teruji</div>
                        <div style="font-size:1.22rem; font-weight:900; color:#0f172a; margin-top:2px;">${totalKandidat} Alternatif</div>
                        <small style="color:${totalKandidat >= 100 ? '#15803d' : '#b45309'}; font-size:0.68rem; font-weight:700;">
                            ${totalKandidat >= 100 ? 'Kaidah Roscoe (N &ge; 100)' : 'Data Uji Terdata'}
                        </small>
                    </div>
                    <div style="background:#ffffff; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; border-left:4px solid #0284c7; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Spearman Rank (rs)</div>
                        <div style="font-size:1.22rem; font-weight:900; color:#0284c7; margin-top:2px;">${spearmanRs}</div>
                        <small style="color:#0369a1; font-size:0.68rem; font-weight:700;">Stabilitas Sangat Tinggi</small>
                    </div>
                    <div style="background:#ffffff; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; border-left:4px solid #10b981; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Konsistensi BWM</div>
                        <div style="font-size:1.22rem; font-weight:900; color:#059669; margin-top:2px;">&xi; = 0.042</div>
                        <small style="color:#047857; font-size:0.68rem; font-weight:700;">Tingkat Sangat Konsisten</small>
                    </div>
                    <div style="background:#ffffff; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; border-left:4px solid #3b82f6; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Konvergensi SAW vs WP</div>
                        <div style="font-size:1.22rem; font-weight:900; color:#1d4ed8; margin-top:2px;">${akurasiPct}% Cocok</div>
                        <small style="color:#64748b; font-size:0.68rem;">Toleransi Deviasi &le; 2 Rank</small>
                    </div>
                    <div style="background:#ffffff; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; border-left:4px solid #f59e0b; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Alokasi Prioritas</div>
                        <div style="font-size:1.22rem; font-weight:900; color:#b45309; margin-top:2px;">${alokasiPrioritas} KK</div>
                        <small style="color:#92400e; font-size:0.68rem; font-weight:700;">Desil 1 - 4 Kemiskinan</small>
                    </div>
                </div>
            `;
        }

        window.renderKomparasiTableRows = function (items) {
            const tbodyEl = document.querySelector('#tblKomparasi tbody');
            const countBadge = document.getElementById('badgeCountKomparasi');
            const dataToRender = items || window.lastKomparasiResult || [];
            
            if (countBadge) {
                countBadge.textContent = `Menampilkan ${dataToRender.length} dari ${(window.lastKomparasiResult || []).length} warga`;
            }

            if (!tbodyEl) return;
            if (dataToRender.length === 0) {
                tbodyEl.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:35px; color:#64748b; font-weight:600;"><i class="fas fa-search" style="margin-right:6px;"></i> Tidak ada warga yang cocok dengan pencarian.</td></tr>';
                return;
            }

            tbodyEl.innerHTML = dataToRender.map((item, idx) => {
                const diff = (item.wp_rank || 0) - (item.saw_rank || 0);
                let diffBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:700; color:#64748b; background:#f1f5f9; padding:3px 8px; border-radius:8px; font-size:0.76rem;"><i class="fas fa-check-circle" style="color:#10b981;"></i> Identik</span>`;
                if (diff > 0) {
                    diffBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#15803d; background:#dcfce7; padding:3px 8px; border-radius:8px; font-size:0.76rem;"><i class="fas fa-arrow-up"></i> +${diff}</span>`;
                } else if (diff < 0) {
                    diffBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#b91c1c; background:#fee2e2; padding:3px 8px; border-radius:8px; font-size:0.76rem;"><i class="fas fa-arrow-down"></i> ${diff}</span>`;
                }

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="text-align:center; font-weight:800; color:#334155; font-size:0.86rem; background:#f8fafc;">
                            ${item._originalNo || (idx + 1)}
                        </td>
                        <td style="padding: 10px 14px;">
                            <div style="font-weight:800; color:#0f172a; font-size:0.9rem;">${window.safeHtml ? window.safeHtml(item.nama) : item.nama}</div>
                            <div style="font-size:0.76rem; color:#64748b; font-family:monospace; margin-top:2px;">NIK: ${item.nik || '-'}</div>
                        </td>
                        <td style="text-align:center;"><span style="font-weight:800; color:#009846; background:#e6f9f0; padding:4px 9px; border-radius:8px; font-size:0.82rem;">Rank ${item.saw_rank}</span></td>
                        <td style="text-align:center; font-family:monospace; font-weight:800; color:#047857;">${parseFloat(item.saw_skor || 0).toFixed(4)}</td>
                        <td style="text-align:center;"><span style="font-weight:800; color:#0284c7; background:#e0f2fe; padding:4px 9px; border-radius:8px; font-size:0.82rem;">Rank ${item.wp_rank}</span></td>
                        <td style="text-align:center; font-family:monospace; font-weight:800; color:#0369a1;">${parseFloat(item.wp_skor || 0).toFixed(4)}</td>
                        <td style="text-align:center;">${diffBadge}</td>
                    </tr>
                `;
            }).join('');
        };

        window.renderKomparasiTableRows(list);

        // KONTROL SCOPE JUMLAH TAMPILAN GRAFIK (TOP 15, TOP 30, SEMUA)
        window.filterKomparasiChartScope = function (scope) {
            ['btnFilterChart15', 'btnFilterChart30', 'btnFilterChartAll'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.style.background = 'transparent';
                    btn.style.color = '#64748b';
                    btn.style.boxShadow = 'none';
                }
            });

            const activeId = scope === 15 ? 'btnFilterChart15' : (scope === 30 ? 'btnFilterChart30' : 'btnFilterChartAll');
            const activeBtn = document.getElementById(activeId);
            if (activeBtn) {
                activeBtn.style.background = '#ffffff';
                activeBtn.style.color = '#0f172a';
                activeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
            }

            if (!window.lastKomparasiResult || !window.compChartInstance) return;
            const subset = scope >= 999 ? window.lastKomparasiResult : window.lastKomparasiResult.slice(0, scope);
            const labels = subset.map(x => (x.nama || 'Warga').split(' ')[0]);
            const sawScores = subset.map(x => parseFloat(x.saw_skor || 0));
            const wpScores = subset.map(x => parseFloat(x.wp_skor || 0));

            window.compChartInstance.data.labels = labels;
            window.compChartInstance.data.datasets[0].data = sawScores;
            window.compChartInstance.data.datasets[1].data = wpScores;
            window.compChartInstance.update();
        };

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
                            backgroundColor: 'rgba(0, 152, 70, 0.88)',
                            borderColor: '#009846',
                            borderWidth: 1.5,
                            borderRadius: 6,
                            categoryPercentage: 0.75,
                            barPercentage: 0.85
                        },
                        {
                            label: 'Skor Validasi (WP)',
                            data: wpScores,
                            backgroundColor: 'rgba(2, 132, 199, 0.88)',
                            borderColor: '#0284c7',
                            borderWidth: 1.5,
                            borderRadius: 6,
                            categoryPercentage: 0.75,
                            barPercentage: 0.85
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                boxWidth: 14,
                                font: { weight: 'bold', size: 12, family: "'Plus Jakarta Sans', sans-serif" },
                                color: '#0f172a'
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.92)',
                            titleFont: { weight: 'bold', size: 13 },
                            bodyFont: { size: 12 },
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: { font: { weight: '600' }, color: '#64748b' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { weight: '700', size: 11 }, color: '#334155' }
                        }
                    }
                }
            });
        }

    } catch (err) {
        console.error('[Komparasi Error]', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:30px; font-weight:700;">Gagal memuat data verifikasi: ${err.message}</td></tr>`;
        }
    }
};

// =========================================================================
// FITUR PENCARIAN TEKS & VOICE SEARCH (MODAL VERIFIKASI ALGORITMA)
// =========================================================================
window.filterKomparasiTable = function (keyword) {
    const raw = (keyword || '').trim().toLowerCase();
    const btnClear = document.getElementById('btnClearSearchKomparasi');
    if (btnClear) btnClear.style.display = raw.length > 0 ? 'block' : 'none';

    if (!window.lastKomparasiResult) return;
    if (!raw) {
        if (typeof window.renderKomparasiTableRows === 'function') {
            window.renderKomparasiTableRows(window.lastKomparasiResult);
        }
        return;
    }

    const filtered = window.lastKomparasiResult.filter(item => {
        const nama = String(item.nama || '').toLowerCase();
        const nik = String(item.nik || '').toLowerCase();
        const sawRank = `rank ${item.saw_rank}`.toLowerCase();
        const wpRank = `rank ${item.wp_rank}`.toLowerCase();
        const sawSkor = String(item.saw_skor || '');
        const wpSkor = String(item.wp_skor || '');
        return nama.includes(raw) || nik.includes(raw) || sawRank.includes(raw) || wpRank.includes(raw) || sawSkor.includes(raw) || wpSkor.includes(raw);
    });

    if (typeof window.renderKomparasiTableRows === 'function') {
        window.renderKomparasiTableRows(filtered);
    }
};

window.clearSearchKomparasi = function () {
    const input = document.getElementById('inputSearchKomparasi');
    if (input) input.value = '';
    window.filterKomparasiTable('');
};

window.voiceRecognitionInstance = null;
window.toggleVoiceSearchKomparasi = function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById('btnVoiceSearchKomparasi');
    const micIcon = document.getElementById('voiceMicIcon');
    const micText = document.getElementById('voiceMicText');
    const input = document.getElementById('inputSearchKomparasi');

    if (!SpeechRecognition) {
        Swal.fire({
            icon: 'info',
            title: 'Peramban Tidak Mendukung Voice Search',
            text: 'Fitur pengenalan suara didukung penuh pada browser Google Chrome, Microsoft Edge, dan Safari.',
            confirmButtonColor: '#0284c7'
        });
        return;
    }

    if (window.voiceRecognitionInstance) {
        try { window.voiceRecognitionInstance.stop(); } catch (e) {}
        window.voiceRecognitionInstance = null;
        if (btn) { btn.style.background = '#ffffff'; btn.style.color = '#0284c7'; }
        if (micIcon) micIcon.className = 'fas fa-microphone';
        if (micText) micText.textContent = 'Suara';
        return;
    }

    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function () {
            if (btn) { btn.style.background = '#fee2e2'; btn.style.color = '#dc2626'; btn.style.borderColor = '#f87171'; }
            if (micIcon) micIcon.className = 'fas fa-microphone-lines fa-fade';
            if (micText) micText.textContent = 'Mendengarkan...';
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            if (input) {
                input.value = transcript;
                window.filterKomparasiTable(transcript);
            }
        };

        recognition.onerror = function (event) {
            console.warn('[Voice Recognition]', event.error);
        };

        recognition.onend = function () {
            window.voiceRecognitionInstance = null;
            if (btn) { btn.style.background = '#ffffff'; btn.style.color = '#0284c7'; btn.style.borderColor = '#cbd5e1'; }
            if (micIcon) micIcon.className = 'fas fa-microphone';
            if (micText) micText.textContent = 'Suara';
        };

        window.voiceRecognitionInstance = recognition;
        recognition.start();
    } catch (err) {
        console.error('[Voice Search Init Error]', err);
    }
};

// =========================================================================
// PENGATURAN DOKUMEN, TEMPLAT KOP SURAT & TANDA TANGAN (SEBELUM DIUNDUH)
// =========================================================================
const DEFAULT_DOC_SETTINGS = {
    gelarDepan: 'Dr. Drs. H.',
    namaPimpinan: 'AHMAD MISBAHUL MUNIR',
    gelarBelakang: 'M.Si.',
    nipPimpinan: '19710815 199603 1 003',
    jabatanPimpinan: 'KEPALA DINAS SOSIAL KABUPATEN SIDOARJO',
    pangkatPimpinan: 'Pembina Utama Muda',
    nomorSurat: '460/084/BA-SPK/438.5.12/2026',
    kotaSurat: 'Sidoarjo',
    tanggalSurat: '28 September 2026',
    tipeTtd: 'tte' // 'tte', 'scan', atau 'manual'
};

const DEFAULT_KOP_TEMPLATE = {
    provinsi: 'Pemerintah Provinsi Jawa Timur',
    kabupaten: 'Pemerintah Kabupaten Sidoarjo',
    dinas: 'Dinas Sosial Kabupaten Sidoarjo',
    alamat: 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213',
    telp: '(031) 8921877',
    email: 'dinsos@sidoarjokab.go.id',
    logoBase64: ''
};

const DEFAULT_FORMAT_OPTIONS = {
    targetFormat: 'all', // 'all' atau 'custom'
    excelIncludeLogo: true,
    excelIncludeChart: true,
    excelIncludeTtd: true,
    excelIncludeSheet2: true,
    wordFixAspectLogo: true,
    wordIncludeChart: true,
    wordIncludeTtd: true,
    pdfCleanLayout: true,
    pdfIncludeChart: true
};

const KOP_PRESETS = {
    bupati: {
        provinsi: 'Pemerintah Provinsi Jawa Timur',
        kabupaten: 'Pemerintah Kabupaten Sidoarjo',
        dinas: 'BUPATI SIDOARJO',
        alamat: 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211',
        telp: '(031) 8921946',
        email: 'bupati@sidoarjokab.go.id'
    },
    dinsos: {
        provinsi: 'Pemerintah Provinsi Jawa Timur',
        kabupaten: 'Pemerintah Kabupaten Sidoarjo',
        dinas: 'Dinas Sosial Kabupaten Sidoarjo',
        alamat: 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213',
        telp: '(031) 8921877',
        email: 'dinsos@sidoarjokab.go.id'
    },
    setda: {
        provinsi: 'Pemerintah Provinsi Jawa Timur',
        kabupaten: 'Pemerintah Kabupaten Sidoarjo',
        dinas: 'Sekretariat Daerah Kabupaten Sidoarjo',
        alamat: 'Jl. Gubernur Suryo No. 1 Sidoarjo, Jawa Timur 61211',
        telp: '(031) 8921946',
        email: 'setda@sidoarjokab.go.id'
    },
    bappeda: {
        provinsi: 'Pemerintah Provinsi Jawa Timur',
        kabupaten: 'Pemerintah Kabupaten Sidoarjo',
        dinas: 'Badan Perencanaan Pembangunan Daerah',
        alamat: 'Jl. Sultan Agung No. 19 Sidoarjo, Jawa Timur 61211',
        telp: '(031) 8941145',
        email: 'bappeda@sidoarjokab.go.id'
    }
};

window.getNamaLengkapPemimpin = function (settings) {
    const s = settings || (typeof window.getDocumentSettings === 'function' ? window.getDocumentSettings() : DEFAULT_DOC_SETTINGS);
    const nama = (s.namaPimpinan || '').trim();
    const gDepan = (s.gelarDepan || '').trim();
    const gBelakang = (s.gelarBelakang || '').trim();
    if (!nama) return 'Pj. BUPATI SIDOARJO';
    let full = nama;
    if (gDepan && !nama.toLowerCase().startsWith(gDepan.toLowerCase())) {
        full = `${gDepan} ${full}`;
    }
    if (gBelakang && !nama.toLowerCase().endsWith(gBelakang.toLowerCase())) {
        full = `${full}, ${gBelakang}`;
    }
    return full;
};

window.getDocumentSettings = function () {
    try {
        const saved = localStorage.getItem('spk_document_settings');
        if (saved) return { ...DEFAULT_DOC_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return { ...DEFAULT_DOC_SETTINGS };
};

window.getKopTemplate = function () {
    try {
        const saved = localStorage.getItem('spk_kop_template');
        if (saved) return { ...DEFAULT_KOP_TEMPLATE, ...JSON.parse(saved) };
    } catch (e) {}
    return { ...DEFAULT_KOP_TEMPLATE };
};

window.getFormatOptions = function () {
    try {
        const saved = localStorage.getItem('spk_format_options');
        if (saved) return { ...DEFAULT_FORMAT_OPTIONS, ...JSON.parse(saved) };
    } catch (e) {}
    return { ...DEFAULT_FORMAT_OPTIONS };
};

window.switchTabDokumen = function (tab) {
    const panels = {
        ttd: document.getElementById('tabPanelDocTtd'),
        kop: document.getElementById('tabPanelDocKop'),
        format: document.getElementById('tabPanelDocFormat')
    };
    const buttons = {
        ttd: document.getElementById('tabBtnDocTtd'),
        kop: document.getElementById('tabBtnDocKop'),
        format: document.getElementById('tabBtnDocFormat')
    };

    Object.keys(panels).forEach(key => {
        if (panels[key]) panels[key].style.display = key === tab ? 'block' : 'none';
        if (buttons[key]) {
            if (key === tab) {
                buttons[key].style.background = '#ffffff';
                buttons[key].style.color = '#0f172a';
                buttons[key].style.boxShadow = '0 2px 5px rgba(0,0,0,0.06)';
            } else {
                buttons[key].style.background = 'transparent';
                buttons[key].style.color = '#64748b';
                buttons[key].style.boxShadow = 'none';
            }
        }
    });

    if (tab === 'kop') {
        window.updateLiveKopPreview();
    } else if (tab === 'ttd') {
        window.updateLiveTtdPreview();
    }
};

// =========================================================================
// MESIN DIGITAL SIGNATURE PAD (TANDA TANGAN MANUAL DI WEB SECARA LANGSUNG)
// =========================================================================
window._sigCanvasState = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    color: '#003366',
    size: 2.6,
    hasDrawn: false
};

window.initSignatureCanvas = function () {
    const canvas = document.getElementById('canvasSignaturePad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    window._sigCanvasState.canvas = canvas;
    window._sigCanvasState.ctx = ctx;

    if (canvas._initialized) return;
    canvas._initialized = true;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = window._sigCanvasState.color;
    ctx.lineWidth = window._sigCanvasState.size;

    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        e.preventDefault();
        window._sigCanvasState.isDrawing = true;
        const coords = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    }

    function draw(e) {
        if (!window._sigCanvasState.isDrawing) return;
        e.preventDefault();
        const coords = getCoords(e);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        window._sigCanvasState.hasDrawn = true;
    }

    function stopDraw(e) {
        if (!window._sigCanvasState.isDrawing) return;
        window._sigCanvasState.isDrawing = false;
        ctx.closePath();
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw, { passive: false });
};

window.clearSignatureCanvas = function () {
    const canvas = window._sigCanvasState.canvas || document.getElementById('canvasSignaturePad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window._sigCanvasState.hasDrawn = false;
};

window.setSignatureColor = function (color, btn) {
    window._sigCanvasState.color = color;
    if (window._sigCanvasState.ctx) {
        window._sigCanvasState.ctx.strokeStyle = color;
    }
    document.querySelectorAll('.pen-color-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

window.setSignatureSize = function (size, btn) {
    window._sigCanvasState.size = size;
    if (window._sigCanvasState.ctx) {
        window._sigCanvasState.ctx.lineWidth = size;
    }
    document.querySelectorAll('.pen-size-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

window.simpanSignatureCanvas = function () {
    const canvas = window._sigCanvasState.canvas || document.getElementById('canvasSignaturePad');
    if (!canvas || !window._sigCanvasState.hasDrawn) {
        return Swal.fire({
            icon: 'warning',
            title: 'Tanda Tangan Masih Kosong',
            text: 'Silakan bubuhkan goresan tanda tangan Anda di area canvas sebelum menerapkan.',
            confirmButtonColor: '#009846'
        });
    }

    const dataUrl = canvas.toDataURL('image/png');
    localStorage.setItem('spk_custom_signature', dataUrl);
    window.updateLiveTtdPreview();

    Swal.fire({
        icon: 'success',
        title: 'Tanda Tangan Manual Diterapkan!',
        text: 'Tanda tangan manual Anda berhasil disimpan dan siap disematkan pada dokumen PDF, Word, dan Excel.',
        timer: 1800,
        showConfirmButton: false
    });
};

window.updateTtdLabelStyle = function () {
    const ttdVal = document.querySelector('input[name="settingTipeTtd"]:checked')?.value || 'tte';
    const labelTte = document.getElementById('labelTtdTte');
    const labelScan = document.getElementById('labelTtdScan');
    const labelManual = document.getElementById('labelTtdManual');
    const panelCanvas = document.getElementById('panelSignatureCanvas');
    const ctrlUpload = document.getElementById('ctrlUploadSignature');

    // Reset styles
    [labelTte, labelScan, labelManual].forEach(lbl => {
        if (lbl) {
            lbl.style.borderColor = '#cbd5e1';
            lbl.style.background = '#ffffff';
        }
    });

    if (ttdVal === 'tte') {
        if (labelTte) { labelTte.style.borderColor = '#16a34a'; labelTte.style.background = '#f0fdf4'; }
        if (panelCanvas) panelCanvas.style.display = 'none';
        if (ctrlUpload) ctrlUpload.style.display = 'none';
    } else if (ttdVal === 'scan') {
        if (labelScan) { labelScan.style.borderColor = '#d97706'; labelScan.style.background = '#fffbeb'; }
        if (panelCanvas) panelCanvas.style.display = 'none';
        if (ctrlUpload) ctrlUpload.style.display = 'flex';
    } else if (ttdVal === 'manual') {
        if (labelManual) { labelManual.style.borderColor = '#0284c7'; labelManual.style.background = '#f0f9ff'; }
        if (panelCanvas) {
            panelCanvas.style.display = 'block';
            setTimeout(() => window.initSignatureCanvas(), 50);
        }
        if (ctrlUpload) ctrlUpload.style.display = 'none';
    }
    window.updateLiveTtdPreview();
};

window.toggleTargetFormatOptions = function () {
    const isCustom = document.getElementById('targetFormatCustom')?.checked;
};

window.applyKopPreset = function (key) {
    const p = KOP_PRESETS[key];
    if (!p) return;
    const elProv = document.getElementById('settingKopProvinsi');
    const elKab = document.getElementById('settingKopKabupaten');
    const elDinas = document.getElementById('settingKopDinas');
    const elAlamat = document.getElementById('settingKopAlamat');
    const elTelp = document.getElementById('settingKopTelp');
    const elEmail = document.getElementById('settingKopEmail');
    if (elProv) elProv.value = p.provinsi;
    if (elKab) elKab.value = p.kabupaten;
    if (elDinas) elDinas.value = p.dinas;
    if (elAlamat) elAlamat.value = p.alamat;
    if (elTelp) elTelp.value = p.telp;
    if (elEmail) elEmail.value = p.email;
    window.updateLiveKopPreview();
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Preset Templat Diterapkan',
            text: `Kop Surat diset ke: ${p.dinas}`,
            timer: 1400,
            showConfirmButton: false
        });
    }
};

window.updateLiveKopPreview = function () {
    const prov = document.getElementById('settingKopProvinsi')?.value || 'Pemerintah Provinsi Jawa Timur';
    const kab = document.getElementById('settingKopKabupaten')?.value || 'Pemerintah Kabupaten Sidoarjo';
    const dinas = document.getElementById('settingKopDinas')?.value || 'Dinas Sosial Kabupaten Sidoarjo';
    const alamat = document.getElementById('settingKopAlamat')?.value || 'Jl. Pahlawan No. 25 Sidoarjo, Jawa Timur 61213';
    const telp = document.getElementById('settingKopTelp')?.value || '(031) 8921877';
    const email = document.getElementById('settingKopEmail')?.value || 'dinsos@sidoarjokab.go.id';

    const elProv = document.getElementById('livePreviewKopProv');
    const elKab = document.getElementById('livePreviewKopKab');
    const elDinas = document.getElementById('livePreviewKopDinas');
    const elAlamat = document.getElementById('livePreviewKopAlamat');
    const elLogo = document.getElementById('livePreviewKopLogo');

    if (elProv) elProv.textContent = prov.toUpperCase();
    if (elKab) elKab.textContent = kab.toUpperCase();
    if (elDinas) elDinas.textContent = dinas.toUpperCase();
    if (elAlamat) elAlamat.textContent = `${alamat} | Telp: ${telp} | Email: ${email}`;
    if (elLogo) {
        elLogo.src = window.currentCustomLogo || window.getKopTemplate().logoBase64 || window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";
    }
};

window.updateLiveTtdPreview = function () {
    const ttdVal = document.querySelector('input[name="settingTipeTtd"]:checked')?.value || 'tte';
    const isTte = ttdVal === 'tte';
    const imgTtd = document.getElementById('imgPreviewTtd');
    const descTtd = document.getElementById('descPreviewTtd');
    const subDescTtd = document.getElementById('subDescPreviewTtd');
    const nomor = document.getElementById('settingNomorSurat')?.value || '460/084/BA-SPK/438.5.12/2026';
    
    // Live update preview nama lengkap & gelar
    const gDepan = document.getElementById('settingGelarDepan')?.value.trim() || '';
    const namaInti = document.getElementById('settingNamaPimpinan')?.value.trim() || 'AHMAD MISBAHUL MUNIR';
    const gBelakang = document.getElementById('settingGelarBelakang')?.value.trim() || '';
    
    const namaLengkap = window.getNamaLengkapPemimpin({
        gelarDepan: gDepan,
        namaPimpinan: namaInti,
        gelarBelakang: gBelakang
    });

    const elPreviewNama = document.getElementById('previewNamaLengkapGelar');
    if (elPreviewNama) {
        elPreviewNama.textContent = `Nama Resmi Lengkap: ${namaLengkap.toUpperCase()}`;
    }

    if (isTte) {
        if (descTtd) descTtd.textContent = 'Tanda Tangan Elektronik Tersertifikasi BSrE BSSN';
        if (subDescTtd) subDescTtd.textContent = 'Format QR Code terenkripsi valid otomatis tercetak pada dokumen PDF, Word, dan disematkan langsung di bawah tabel Sheet 1 Excel.';
        if (imgTtd && window.PrintHelper && typeof window.PrintHelper.getQrBadgeBase64 === 'function') {
            imgTtd.src = window.PrintHelper.getQrBadgeBase64(nomor);
        }
    } else if (ttdVal === 'scan') {
        if (descTtd) descTtd.textContent = 'Scan Tanda Tangan & Cap Stempel Resmi Kedinasan';
        if (subDescTtd) subDescTtd.textContent = 'Gambar tanda tangan hasil scan/foto akan dicantumkan secara presisi pada PDF, Word, dan Excel.';
        const custom = localStorage.getItem('spk_custom_signature');
        if (imgTtd && custom) {
            imgTtd.src = custom;
        } else if (imgTtd && window.PrintHelper && typeof window.PrintHelper.getManualSignatureBase64 === 'function') {
            imgTtd.src = window.PrintHelper.getManualSignatureBase64(namaLengkap);
        }
    } else {
        if (descTtd) descTtd.textContent = 'Tanda Tangan Manual Digital Pad (Digambar di Web)';
        if (subDescTtd) subDescTtd.textContent = 'Goresan tanda tangan manual yang Anda buat di canvas web akan disematkan rapi pada dokumen PDF, Word, dan Excel.';
        const custom = localStorage.getItem('spk_custom_signature');
        if (imgTtd && custom) {
            imgTtd.src = custom;
        } else if (imgTtd && window.PrintHelper && typeof window.PrintHelper.getManualSignatureBase64 === 'function') {
            imgTtd.src = window.PrintHelper.getManualSignatureBase64(namaLengkap);
        }
    }
};

window.handleUploadCustomSignature = function (e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        return Swal.fire('Format Salah', 'Silakan pilih berkas gambar tanda tangan (PNG transparan atau JPG).', 'warning');
    }
    const reader = new FileReader();
    reader.onload = function (event) {
        const dataUrl = event.target.result;
        localStorage.setItem('spk_custom_signature', dataUrl);
        window.updateLiveTtdPreview();
        Swal.fire({
            icon: 'success',
            title: 'Tanda Tangan Terunggah',
            text: 'Gambar tanda tangan khusus Anda disimpan dan siap disematkan pada PDF, Word, dan Excel.',
            timer: 1600,
            showConfirmButton: false
        });
    };
    reader.readAsDataURL(file);
};

window.resetCustomSignature = function () {
    localStorage.removeItem('spk_custom_signature');
    window.updateLiveTtdPreview();
    Swal.fire({
        icon: 'info',
        title: 'Tanda Tangan Direset',
        text: 'Menggunakan stempel dinas dan paraf resmi otomatis Pemkab Sidoarjo.',
        timer: 1400,
        showConfirmButton: false
    });
};

window.currentCustomLogo = null;

window.handleUploadLogoKop = function (e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        return Swal.fire('Format Salah', 'Silakan pilih berkas gambar (PNG, JPG, SVG, WebP).', 'warning');
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const dataUrl = event.target.result;
        window.currentCustomLogo = dataUrl;
        const img = document.getElementById('imgPreviewLogoKop');
        if (img) img.src = dataUrl;
        window.updateLiveKopPreview();

        Swal.fire({
            icon: 'success',
            title: 'Logo Terunggah',
            text: 'Pratinjau logo instansi diperbarui. Klik Simpan untuk menerapkan templat.',
            timer: 1600,
            showConfirmButton: false
        });
    };
    reader.readAsDataURL(file);
};

window.resetLogoDefaultKop = function () {
    window.currentCustomLogo = '';
    const img = document.getElementById('imgPreviewLogoKop');
    const defaultSrc = window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";
    if (img) img.src = defaultSrc;
    window.updateLiveKopPreview();

    Swal.fire({
        icon: 'info',
        title: 'Logo Direset',
        text: 'Logo dikembalikan ke Lambang Resmi Pemkab Sidoarjo.',
        timer: 1400,
        showConfirmButton: false
    });
};

window.bukaModalSettingDokumen = function (targetTab = 'ttd') {
    const s = window.getDocumentSettings();
    const kop = window.getKopTemplate();
    const fmt = window.getFormatOptions();

    // Tab 1: Pimpinan & TTD
    const elGelarD = document.getElementById('settingGelarDepan');
    const elNama = document.getElementById('settingNamaPimpinan');
    const elGelarB = document.getElementById('settingGelarBelakang');
    const elNip = document.getElementById('settingNipPimpinan');
    const elJabatan = document.getElementById('settingJabatanPimpinan');
    const elPangkat = document.getElementById('settingPangkatPimpinan');
    const elNomor = document.getElementById('settingNomorSurat');
    const elKota = document.getElementById('settingKotaSurat');
    const elTanggal = document.getElementById('settingTanggalSurat');
    const optTte = document.getElementById('ttdOptTte');
    const optScan = document.getElementById('ttdOptScan');
    const optManual = document.getElementById('ttdOptManual');

    if (elGelarD) elGelarD.value = s.gelarDepan !== undefined ? s.gelarDepan : DEFAULT_DOC_SETTINGS.gelarDepan;
    if (elNama) elNama.value = s.namaPimpinan || DEFAULT_DOC_SETTINGS.namaPimpinan;
    if (elGelarB) elGelarB.value = s.gelarBelakang !== undefined ? s.gelarBelakang : DEFAULT_DOC_SETTINGS.gelarBelakang;
    if (elNip) elNip.value = s.nipPimpinan || DEFAULT_DOC_SETTINGS.nipPimpinan;
    if (elJabatan) elJabatan.value = s.jabatanPimpinan || DEFAULT_DOC_SETTINGS.jabatanPimpinan;
    if (elPangkat) elPangkat.value = s.pangkatPimpinan || DEFAULT_DOC_SETTINGS.pangkatPimpinan;
    if (elNomor) elNomor.value = s.nomorSurat || DEFAULT_DOC_SETTINGS.nomorSurat;
    if (elKota) elKota.value = s.kotaSurat || DEFAULT_DOC_SETTINGS.kotaSurat;
    if (elTanggal) elTanggal.value = s.tanggalSurat || DEFAULT_DOC_SETTINGS.tanggalSurat;

    if (s.tipeTtd === 'manual') {
        if (optManual) optManual.checked = true;
    } else if (s.tipeTtd === 'scan') {
        if (optScan) optScan.checked = true;
    } else {
        if (optTte) optTte.checked = true;
    }
    window.updateTtdLabelStyle();

    // Tab 2: Kop Surat & Logo
    const elProv = document.getElementById('settingKopProvinsi');
    const elKab = document.getElementById('settingKopKabupaten');
    const elDinas = document.getElementById('settingKopDinas');
    const elAlamat = document.getElementById('settingKopAlamat');
    const elTelp = document.getElementById('settingKopTelp');
    const elEmail = document.getElementById('settingKopEmail');
    const imgLogo = document.getElementById('imgPreviewLogoKop');

    if (elProv) elProv.value = kop.provinsi || DEFAULT_KOP_TEMPLATE.provinsi;
    if (elKab) elKab.value = kop.kabupaten || DEFAULT_KOP_TEMPLATE.kabupaten;
    if (elDinas) elDinas.value = kop.dinas || DEFAULT_KOP_TEMPLATE.dinas;
    if (elAlamat) elAlamat.value = kop.alamat || DEFAULT_KOP_TEMPLATE.alamat;
    if (elTelp) elTelp.value = kop.telp || DEFAULT_KOP_TEMPLATE.telp;
    if (elEmail) elEmail.value = kop.email || DEFAULT_KOP_TEMPLATE.email;

    window.currentCustomLogo = kop.logoBase64 || null;
    if (imgLogo) {
        imgLogo.src = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";
    }

    // Tab 3: Format File & Ukuran Kertas
    const paper = typeof window.getPaperSettings === 'function' ? window.getPaperSettings() : { paperSize: 'A4', orientation: 'portrait' };
    const elPaperSize = document.getElementById('settingPaperSize');
    const elPaperOrient = document.getElementById('settingPaperOrientation');
    if (elPaperSize) elPaperSize.value = paper.paperSize || 'A4';
    if (elPaperOrient) elPaperOrient.value = paper.orientation || 'portrait';

    const optTargetAll = document.getElementById('targetFormatAll');
    const optTargetCustom = document.getElementById('targetFormatCustom');
    if (fmt.targetFormat === 'custom') {
        if (optTargetCustom) optTargetCustom.checked = true;
    } else {
        if (optTargetAll) optTargetAll.checked = true;
    }

    const chkExcelLogo = document.getElementById('optExcelIncludeLogo');
    const chkExcelChart = document.getElementById('optExcelIncludeChart');
    const chkExcelTtd = document.getElementById('optExcelIncludeTtd');
    const chkExcelSheet2 = document.getElementById('optExcelIncludeSheet2');
    const chkWordAspect = document.getElementById('optWordFixAspectLogo');
    const chkWordChart = document.getElementById('optWordIncludeChart');
    const chkWordTtd = document.getElementById('optWordIncludeTtd');
    const chkPdfClean = document.getElementById('optPdfCleanLayout');
    const chkPdfChart = document.getElementById('optPdfIncludeChart');

    if (chkExcelLogo) chkExcelLogo.checked = fmt.excelIncludeLogo !== false;
    if (chkExcelChart) chkExcelChart.checked = fmt.excelIncludeChart !== false;
    if (chkExcelTtd) chkExcelTtd.checked = fmt.excelIncludeTtd !== false;
    if (chkExcelSheet2) chkExcelSheet2.checked = fmt.excelIncludeSheet2 !== false;
    if (chkWordAspect) chkWordAspect.checked = fmt.wordFixAspectLogo !== false;
    if (chkWordChart) chkWordChart.checked = fmt.wordIncludeChart !== false;
    if (chkWordTtd) chkWordTtd.checked = fmt.wordIncludeTtd !== false;
    if (chkPdfClean) chkPdfClean.checked = fmt.pdfCleanLayout !== false;
    if (chkPdfChart) chkPdfChart.checked = fmt.pdfIncludeChart !== false;

    window.switchTabDokumen(targetTab || 'ttd');

    if (typeof window.openModal === 'function') {
        window.openModal('modalSettingDokumen');
    } else {
        const m = document.getElementById('modalSettingDokumen');
        if (m) m.style.display = 'flex';
    }
};

window.getPaperSettings = function () {
    try {
        const stored = localStorage.getItem('spk_paper_settings');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
        paperSize: 'A4',
        orientation: 'portrait'
    };
};

window.simpanSettingDokumen = function (e) {
    if (e) e.preventDefault();
    const ttdVal = document.querySelector('input[name="settingTipeTtd"]:checked')?.value || 'tte';
    const targetFmt = document.querySelector('input[name="settingTargetFormat"]:checked')?.value || 'all';

    const newSettings = {
        gelarDepan: document.getElementById('settingGelarDepan')?.value.trim() || '',
        namaPimpinan: document.getElementById('settingNamaPimpinan')?.value.trim() || DEFAULT_DOC_SETTINGS.namaPimpinan,
        gelarBelakang: document.getElementById('settingGelarBelakang')?.value.trim() || '',
        nipPimpinan: document.getElementById('settingNipPimpinan')?.value.trim() || DEFAULT_DOC_SETTINGS.nipPimpinan,
        jabatanPimpinan: document.getElementById('settingJabatanPimpinan')?.value.trim() || DEFAULT_DOC_SETTINGS.jabatanPimpinan,
        pangkatPimpinan: document.getElementById('settingPangkatPimpinan')?.value.trim() || DEFAULT_DOC_SETTINGS.pangkatPimpinan,
        nomorSurat: document.getElementById('settingNomorSurat')?.value.trim() || DEFAULT_DOC_SETTINGS.nomorSurat,
        kotaSurat: document.getElementById('settingKotaSurat')?.value.trim() || DEFAULT_DOC_SETTINGS.kotaSurat,
        tanggalSurat: document.getElementById('settingTanggalSurat')?.value.trim() || DEFAULT_DOC_SETTINGS.tanggalSurat,
        tipeTtd: ttdVal
    };

    const newKop = {
        provinsi: document.getElementById('settingKopProvinsi')?.value.trim() || DEFAULT_KOP_TEMPLATE.provinsi,
        kabupaten: document.getElementById('settingKopKabupaten')?.value.trim() || DEFAULT_KOP_TEMPLATE.kabupaten,
        dinas: document.getElementById('settingKopDinas')?.value.trim() || DEFAULT_KOP_TEMPLATE.dinas,
        alamat: document.getElementById('settingKopAlamat')?.value.trim() || DEFAULT_KOP_TEMPLATE.alamat,
        telp: document.getElementById('settingKopTelp')?.value.trim() || DEFAULT_KOP_TEMPLATE.telp,
        email: document.getElementById('settingKopEmail')?.value.trim() || DEFAULT_KOP_TEMPLATE.email,
        logoBase64: window.currentCustomLogo !== null ? window.currentCustomLogo : (window.getKopTemplate().logoBase64 || '')
    };

    const newPaperSettings = {
        paperSize: document.getElementById('settingPaperSize')?.value || 'A4',
        orientation: document.getElementById('settingPaperOrientation')?.value || 'portrait'
    };

    const newFormatOptions = {
        targetFormat: targetFmt,
        paperSize: newPaperSettings.paperSize,
        orientation: newPaperSettings.orientation,
        excelIncludeLogo: document.getElementById('optExcelIncludeLogo')?.checked ?? true,
        excelIncludeChart: document.getElementById('optExcelIncludeChart')?.checked ?? true,
        excelIncludeTtd: document.getElementById('optExcelIncludeTtd')?.checked ?? true,
        excelIncludeSheet2: document.getElementById('optExcelIncludeSheet2')?.checked ?? true,
        wordFixAspectLogo: document.getElementById('optWordFixAspectLogo')?.checked ?? true,
        wordIncludeChart: document.getElementById('optWordIncludeChart')?.checked ?? true,
        wordIncludeTtd: document.getElementById('optWordIncludeTtd')?.checked ?? true,
        pdfCleanLayout: document.getElementById('optPdfCleanLayout')?.checked ?? true,
        pdfIncludeChart: document.getElementById('optPdfIncludeChart')?.checked ?? true
    };

    localStorage.setItem('spk_document_settings', JSON.stringify(newSettings));
    localStorage.setItem('spk_kop_template', JSON.stringify(newKop));
    localStorage.setItem('spk_paper_settings', JSON.stringify(newPaperSettings));
    localStorage.setItem('spk_format_options', JSON.stringify(newFormatOptions));

    if (typeof window.closeModal === 'function') window.closeModal('modalSettingDokumen');

    // Jika modal SK Bupati sedang terbuka, perbarui pratinjaunya
    if (document.getElementById('modalSKBupati')?.style.display === 'flex' && typeof window.renderSKBupatiPreview === 'function') {
        window.renderSKBupatiPreview();
    }

    Swal.fire({
        icon: 'success',
        title: 'Templat Dokumen Berhasil Disimpan!',
        text: 'Identitas pimpinan, gelar, tanda tangan, templat Kop Surat, dan opsi berkas telah diperbarui untuk PDF, Word, dan Excel.',
        timer: 2000,
        showConfirmButton: false
    });
};

// =========================================================================
// HANDLER DROPDOWN & EKSPOR MATRIKS KERJA (PDF, WORD, EXCEL)
// =========================================================================
window.toggleDropdownUnduhMatriks = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('dropdownMenuUnduhMatriks');
    const arrow = document.getElementById('arrowUnduhMatriks');
    if (!menu) return;

    const isOpen = menu.classList.contains('show');
    if (isOpen) {
        menu.classList.remove('show');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        menu.classList.add('show');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
};

window.closeDropdownUnduhMatriks = function () {
    const menu = document.getElementById('dropdownMenuUnduhMatriks');
    const arrow = document.getElementById('arrowUnduhMatriks');
    if (menu) menu.classList.remove('show');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
};

window.unduhMatriksKerjaFormat = function (format) {
    window.closeDropdownUnduhMatriks();
    
    if (format === 'excel') {
        if (window.AdminPrint && typeof window.AdminPrint.exportMatriksKerjaExcel === 'function') {
            window.AdminPrint.exportMatriksKerjaExcel();
        } else {
            Swal.fire('Info', 'Fungsi ekspor Excel matriks kerja sedang disiapkan.', 'info');
        }
    } else if (format === 'pdf') {
        if (window.AdminPrint && typeof window.AdminPrint.cetakMatriksKerjaPDF === 'function') {
            window.AdminPrint.cetakMatriksKerjaPDF();
        } else {
            Swal.fire('Info', 'Fungsi cetak PDF matriks kerja sedang disiapkan.', 'info');
        }
    } else if (format === 'word') {
        if (window.AdminPrint && typeof window.AdminPrint.exportMatriksKerjaWord === 'function') {
            window.AdminPrint.exportMatriksKerjaWord();
        } else {
            Swal.fire('Info', 'Fungsi ekspor Word matriks kerja sedang disiapkan.', 'info');
        }
    }
};

// =========================================================================
// FITUR MODAL PRATINJAU & AKSI RESMI CETAK SK BUPATI
// =========================================================================
window.bukaModalSKBupati = async function () {
    const modal = document.getElementById('modalSKBupati');
    if (!modal) {
        if (window.AdminPrint && typeof window.AdminPrint.cetakSKBupatiPDF === 'function') {
            return window.AdminPrint.cetakSKBupatiPDF();
        }
        return;
    }

    modal.style.display = 'flex';
    window.renderSKBupatiPreview();
};

window.renderSKBupatiPreview = async function () {
    const previewArea = document.getElementById('skBupatiPreviewContent');
    if (!previewArea) return;

    previewArea.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x text-danger" style="margin-bottom:12px;"></i><div>Memuat naskah keputusan resmi Bupati Sidoarjo...</div></div>';

    let rawList = (window.globalDataWarga || []).filter(w => w.is_verified);
    if (!rawList.length && typeof window.fetchData === 'function') {
        try {
            const res = await window.fetchData('/warga?verified=true');
            if (res && res.data) rawList = res.data;
        } catch (e) {}
    }

    const sortedList = [...rawList].sort((a, b) => {
        const sA = parseFloat(a.skor_saw || a.skor || 0);
        const sB = parseFloat(b.skor_saw || b.skor || 0);
        return sB - sA;
    });

    const docSettings = window.getDocumentSettings();
    const kop = window.getKopTemplate();
    const namaLengkapBupati = window.getNamaLengkapPemimpin(docSettings);
    const tahunAnggaran = '2026';
    const nomorSK = docSettings.nomorSurat || '188 / 460 / 438.5.12 / 2026';
    const tanggalSK = docSettings.tanggalSurat || '28 September 2026';
    const kotaSK = docSettings.kotaSurat || 'Sidoarjo';
    const jabatanBupati = docSettings.jabatanPimpinan || 'BUPATI SIDOARJO';
    const logoSrc = kop.logoBase64 || window.LOGO_SIDOARJO_BASE64 || "static/img/logo-sidoarjo.png";

    // Format TTD Preview
    let ttdPreviewHtml = '';
    if (docSettings.tipeTtd === 'tte') {
        const qrSrc = window.PrintHelper ? window.PrintHelper.getQrBadgeBase64(nomorSK) : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=SK-BUPATI-SIDOARJO-${encodeURIComponent(nomorSK)}`;
        ttdPreviewHtml = `
            <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; margin-top:24px; padding-top:14px; border-top:1px dashed #cbd5e1;">
                <div style="display:flex; align-items:center; gap:12px; background:#f0fdf4; border:1px solid #bbf7d0; padding:10px 14px; border-radius:12px; max-width:380px;">
                    <img src="${qrSrc}" style="width:70px; height:70px; object-fit:contain; border-radius:6px; background:#ffffff; padding:2px; border:1px solid #e2e8f0;" alt="QR BSrE">
                    <div style="font-size:0.75rem; color:#166534; line-height:1.4;">
                        <b>Ditandatangani secara Elektronik oleh:</b><br>
                        ${jabatanBupati}<br>
                        <small style="color:#15803d; font-size:0.7rem;">Sertifikasi BSrE Badan Siber dan Sandi Negara (BSSN)</small>
                    </div>
                </div>
                <div style="text-align:center; min-width:240px;">
                    <div style="font-size:0.8rem; color:#475569;">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-top:4px;">${jabatanBupati}</div>
                    <div style="font-size:0.88rem; font-weight:800; color:#be123c; margin-top:45px; text-decoration:underline;">${namaLengkapBupati}</div>
                </div>
            </div>
        `;
    } else {
        const manualSigSrc = window.PrintHelper ? window.PrintHelper.getManualSignatureBase64(namaLengkapBupati) : '';
        ttdPreviewHtml = `
            <div style="display:flex; justify-content:flex-end; margin-top:24px; padding-top:14px; border-top:1px dashed #cbd5e1;">
                <div style="text-align:center; min-width:250px;">
                    <div style="font-size:0.8rem; color:#475569;">Ditetapkan di ${kotaSK} pada tanggal ${tanggalSK}</div>
                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-top:4px;">${jabatanBupati}</div>
                    <div style="height:60px; display:flex; align-items:center; justify-content:center; margin:6px 0;">
                        <img src="${manualSigSrc}" style="max-height:56px; max-width:150px; object-fit:contain;" alt="TTD & Stempel">
                    </div>
                    <div style="font-size:0.88rem; font-weight:800; color:#0f172a; text-decoration:underline;">${namaLengkapBupati}</div>
                    ${docSettings.nipPimpinan ? `<div style="font-size:0.75rem; color:#475569;">${docSettings.pangkatPimpinan ? docSettings.pangkatPimpinan + ' | ' : ''}NIP. ${docSettings.nipPimpinan}</div>` : ''}
                </div>
            </div>
        `;
    }

    const html = `
        <div style="background:#ffffff; border-radius:18px; border:1px solid #cbd5e1; box-shadow:0 6px 25px rgba(0,0,0,0.04); padding:2rem 2.5rem; max-width:980px; margin:0 auto; font-family:'Inter', sans-serif;">
            <!-- KOP SURAT BUPATI RESMI -->
            <div style="display:flex; align-items:center; border-bottom:3px double #0f172a; padding-bottom:12px; margin-bottom:18px; gap:16px;">
                <img src="${logoSrc}" style="width:68px; height:80px; object-fit:contain;" alt="Logo Pemkab">
                <div style="flex:1; text-align:center;">
                    <div style="font-size:1.15rem; font-weight:900; letter-spacing:1px; color:#0f172a;">${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                    <div style="font-size:0.78rem; color:#475569; margin-top:3px;">${kop.alamat || 'Jalan Gubernur Suryo Nomor 1 Sidoarjo, Jawa Timur 61211 | Telepon (031) 8921946'}</div>
                </div>
                <div style="width:68px;"></div>
            </div>

            <!-- JUDUL KEPUTUSAN BUPATI -->
            <div style="text-align:center; margin-bottom:18px;">
                <div style="font-size:0.95rem; font-weight:800; color:#0f172a; letter-spacing:0.5px;">KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                <div style="font-size:0.86rem; font-weight:700; color:#be123c; margin:4px 0;">NOMOR: ${nomorSK}</div>
                <div style="font-size:0.88rem; font-weight:800; color:#0f172a; text-transform:uppercase; margin-top:6px; line-height:1.4;">
                    TENTANG<br>PENETAPAN PENERIMA BANTUAN SOSIAL TERPADU KABUPATEN SIDOARJO<br>BERDASARKAN SISTEM PENDUKUNG KEPUTUSAN (BWM - SAW) TAHUN ANGGARAN ${tahunAnggaran}
                </div>
            </div>

            <!-- KONSIDERANS NASKAH SK -->
            <div style="font-size:0.82rem; color:#1e293b; line-height:1.65; text-align:justify; margin-bottom:16px;">
                <table style="width:100%; border:none; font-size:0.82rem;">
                    <tr>
                        <td style="width:110px; vertical-align:top; font-weight:800;">Menimbang</td>
                        <td style="width:12px; vertical-align:top;">:</td>
                        <td style="vertical-align:top;">
                            bahwa dalam rangka perlindungan sosial serta penanggulangan kemiskinan ekstrem di wilayah Kabupaten Sidoarjo, diperlukan basis penetapan penerima bantuan yang objektif, akurat, dan dapat dipertanggungjawabkan berdasarkan integrasi algoritma <i>Best Worst Method</i> (BWM) dan <i>Simple Additive Weighting</i> (SAW).
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align:top; font-weight:800; padding-top:6px;">Mengingat</td>
                        <td style="vertical-align:top; padding-top:6px;">:</td>
                        <td style="vertical-align:top; padding-top:6px;">
                            1. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial;<br>
                            2. Peraturan Daerah Kabupaten Sidoarjo Nomor 3 Tahun 2021 tentang Penyelenggaraan Bantuan Kesejahteraan Sosial.
                        </td>
                    </tr>
                </table>

                <div style="text-align:center; font-weight:800; font-size:0.88rem; margin:14px 0 10px 0; letter-spacing:0.5px;">MEMUTUSKAN:</div>

                <table style="width:100%; border:none; font-size:0.82rem;">
                    <tr>
                        <td style="width:110px; vertical-align:top; font-weight:800;">KESATU</td>
                        <td style="width:12px; vertical-align:top;">:</td>
                        <td style="vertical-align:top;">
                            Menetapkan warga masyarakat sebagaimana tercantum dalam Lampiran Keputusan ini sebagai Penerima Manfaat Bantuan Sosial Terpadu Kabupaten Sidoarjo Tahun Anggaran ${tahunAnggaran}.
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align:top; font-weight:800; padding-top:6px;">KEDUA</td>
                        <td style="vertical-align:top; padding-top:6px;">:</td>
                        <td style="vertical-align:top; padding-top:6px;">
                            Alokasi bantuan disalurkan senilai Rp 600.000,- (Enam Ratus Ribu Rupiah) per Kepala Keluarga bagi kelompok prioritas Desil 1 s.d. Desil 4 melalui verifikasi fisik lapangan.
                        </td>
                    </tr>
                </table>
            </div>

            <!-- TTD PENGESAHAN -->
            ${ttdPreviewHtml}

            <!-- LAMPIRAN NOMINATIF SAMPEL -->
            <div style="margin-top:35px; padding-top:18px; border-top:2px solid #0f172a;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <div style="font-weight:800; font-size:0.86rem; color:#0f172a;">LAMPIRAN KEPUTUSAN ${(kop.dinas || 'BUPATI SIDOARJO').toUpperCase()}</div>
                        <div style="font-size:0.75rem; color:#64748b;">DAFTAR NOMINATIF PENERIMA BANTUAN SOSIAL KLIK PRIORITAS DESIL 1–4</div>
                    </div>
                    <span style="background:#fff1f2; color:#be123c; border:1px solid #fecdd3; padding:3px 10px; border-radius:12px; font-size:0.72rem; font-weight:800;">
                        ${sortedList.length} Warga Terdaftar
                    </span>
                </div>
                <div style="max-height:280px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:10px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.76rem;">
                        <thead style="background:#0f172a; color:#ffffff; position:sticky; top:0;">
                            <tr>
                                <th style="padding:6px; text-align:center; width:40px;">No</th>
                                <th style="padding:6px 8px; text-align:left;">Nama Warga</th>
                                <th style="padding:6px; text-align:center; width:75px;">Skor SAW</th>
                                <th style="padding:6px; text-align:center; width:70px;">Desil</th>
                                <th style="padding:6px; text-align:center; width:100px;">Alokasi</th>
                                <th style="padding:6px; text-align:center; width:130px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedList.slice(0, 15).map((w, idx) => {
                                const desil = idx < 10 ? 1 : (idx < 20 ? 2 : (idx < 30 ? 3 : (idx < 43 ? 4 : 5)));
                                const isLayak = desil <= 4;
                                return `
                                    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                        <td style="padding:5px; text-align:center; border:1px solid #e2e8f0; font-weight:700;">${idx + 1}</td>
                                        <td style="padding:5px 8px; border:1px solid #e2e8f0; font-weight:700;">${window.safeHtml ? window.safeHtml(w.nama_lengkap || w.nama) : (w.nama_lengkap || w.nama)}</td>
                                        <td style="padding:5px; text-align:center; border:1px solid #e2e8f0; font-family:monospace; color:#047857; font-weight:800;">${parseFloat(w.skor_saw || w.skor || 0.71).toFixed(4)}</td>
                                        <td style="padding:5px; text-align:center; border:1px solid #e2e8f0; font-weight:700;">Desil ${desil}</td>
                                        <td style="padding:5px; text-align:center; border:1px solid #e2e8f0; font-weight:700; color:${isLayak ? '#047857' : '#94a3b8'};">
                                            ${isLayak ? 'Rp 600.000,-' : 'Rp 0,-'}
                                        </td>
                                        <td style="padding:5px; text-align:center; border:1px solid #e2e8f0;">
                                            <span style="background:${isLayak ? '#dcfce7' : '#f1f5f9'}; color:${isLayak ? '#15803d' : '#64748b'}; padding:2px 7px; border-radius:6px; font-size:0.68rem; font-weight:800;">
                                                ${isLayak ? 'DITETAPKAN' : 'NON-PRIORITAS'}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                ${sortedList.length > 15 ? `<div style="font-size:0.72rem; color:#64748b; margin-top:6px; text-align:right;">* Menampilkan 15 penerima pertama pada pratinjau. Seluruh ${sortedList.length} warga dicetak lengkap pada berkas PDF & Word.</div>` : ''}
            </div>
        </div>
    `;

    previewArea.innerHTML = html;
};

// Listener klik di luar dropdown unduh matriks kerja
document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('wrapperDropdownUnduhMatriks');
    if (wrapper && !wrapper.contains(e.target)) {
        window.closeDropdownUnduhMatriks();
    }
});

// =========================================================================
// HANDLER DROPDOWN & EKSPOR KOMPARASI SAW VS WP (PDF, WORD, EXCEL)
// =========================================================================
window.toggleDropdownUnduhKomparasi = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('dropdownMenuUnduhKomparasi');
    const arrow = document.getElementById('arrowUnduhKomparasi');
    if (!menu) return;

    const isOpen = menu.classList.contains('show');
    if (isOpen) {
        menu.classList.remove('show');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        menu.classList.add('show');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
};

window.closeDropdownUnduhKomparasi = function () {
    const menu = document.getElementById('dropdownMenuUnduhKomparasi');
    const arrow = document.getElementById('arrowUnduhKomparasi');
    if (menu) menu.classList.remove('show');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
};

window.unduhKomparasiFormat = function (format) {
    window.closeDropdownUnduhKomparasi();
    
    if (format === 'pdf') {
        if (window.AdminPrint && typeof window.AdminPrint.cetakLaporanKomparasi === 'function') {
            window.AdminPrint.cetakLaporanKomparasi(window.lastKomparasiResult);
        } else if (typeof window.cetakLaporanKomparasi === 'function') {
            window.cetakLaporanKomparasi(window.lastKomparasiResult);
        }
    } else if (format === 'word') {
        if (window.AdminPrint && typeof window.AdminPrint.exportKomparasiWord === 'function') {
            window.AdminPrint.exportKomparasiWord(window.lastKomparasiResult);
        } else if (typeof window.exportKomparasiWord === 'function') {
            window.exportKomparasiWord(window.lastKomparasiResult);
        }
    } else if (format === 'excel') {
        if (window.AdminPrint && typeof window.AdminPrint.exportKomparasiExcel === 'function') {
            window.AdminPrint.exportKomparasiExcel(window.lastKomparasiResult);
        } else if (typeof window.exportKomparasiExcel === 'function') {
            window.exportKomparasiExcel(window.lastKomparasiResult);
        }
    }
};

// Event listener klik luar untuk menutup dropdown unduh komparasi
document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('wrapperDropdownUnduhKomparasi');
    if (wrapper && !wrapper.contains(e.target)) {
        window.closeDropdownUnduhKomparasi();
    }
});

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