/* =========================================================================
   ADMIN-SPK.JS - ENGINE SPK BWM-SAW & KOMPARASI WEIGHTED PRODUCT (WP)
   Lokasi: frontend/static/js/modules/admin-spk.js
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   ========================================================================= */

window.lastSPKResult = null;
window.lastKomparasiResult = [];
window.compChartInstance = null;

// =========================================================================
// 1. PROSES ALGORITMA BWM - SAW
// =========================================================================
window.hitungSPK = async function () {
    const wargaLayak = (window.globalDataWarga || []).filter(w => w.is_verified);
    if (wargaLayak.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Belum Ada Warga Terverifikasi',
            text: 'Algoritma SAW membutuhkan data warga yang telah berstatus Disetujui. Silakan setujui minimal 1 warga terlebih dahulu.',
            confirmButtonColor: '#009846'
        });
    }

    Swal.fire({
        title: 'Memproses Algoritma SAW...',
        html: 'Menghitung normalisasi matriks dan pembobotan BWM...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let res = await window.fetchData('/hitung-saw');
        if (!res || !res.ok) res = await window.fetchData('/api/hitung-saw');

        if (!res || !res.ok) {
            let errorDetail = `HTTP ${res ? res.status : 'Error'}`;
            try {
                const errJson = await res.json();
                if (errJson.message) errorDetail = errJson.message;
            } catch (_) {}
            throw new Error(errorDetail);
        }

        const spkData = await res.json();
        window.lastSPKResult = spkData;
        if (window.BansosApp && window.BansosApp.State) {
            window.BansosApp.State.setSPKResult(spkData);
        }
        Swal.close();

        const hasilList = Array.isArray(spkData) ? spkData : (spkData.hasil_akhir || spkData.data || []);
        if (hasilList.length === 0) throw new Error('Hasil komputasi kosong dari server backend.');

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

        // Ukuran grid kartu metrik terkunci di dalam batas kontainer (box-sizing: border-box)
        summaryBox.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 18px 0 24px 0; width: 100%; box-sizing: border-box;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Dievaluasi</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalWarga} Jiwa</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #15803d; font-weight: 700; text-transform: uppercase;">Layak (Desil 1–4)</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #14532d; margin-top: 2px;">${totalLayak} Penerima</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Tidak Prioritas</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #7f1d1d; margin-top: 2px;">${totalTidak} Warga</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fde68a; border-left: 5px solid #d97706; border-radius: 12px; padding: 14px 18px;">
                    <div style="font-size: 0.72rem; color: #92400e; font-weight: 700; text-transform: uppercase;">Alokasi Bansos</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #78350f; margin-top: 2px;">Rp ${estimasiDana.toLocaleString('id-ID')}</div>
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

        // Pengguliran Vertikal Murni (left: 0) agar layar tidak tergeser horizontal
        const targetTop = resultCard.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({
            top: Math.max(0, targetTop),
            left: 0,
            behavior: 'smooth'
        });

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan BWM-SAW Selesai!', showConfirmButton: false, timer: 2000 });
    } catch (e) {
        Swal.fire('Gagal Komputasi', `Detail Kendala: ${e.message}`, 'error');
    }
};

// =========================================================================
// 2. VERIFIKASI HASIL ALGORITMA (SAW VS WP) - PROPORSI TERKUNCI
// =========================================================================
window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    const printArea = document.getElementById('printKomparasiArea');

    if (modal) modal.style.display = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:35px; color:#64748b; font-weight:600;"><i class="fas fa-spinner fa-spin text-primary" style="margin-right:8px;"></i> Mengambil dan memvalidasi skor perbandingan SAW vs WP...</td></tr>';

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        let res = await window.fetchData(`${baseUrl}/komparasi`);
        if (!res || !res.ok) res = await window.fetchData(`${baseUrl}/api/komparasi`);

        if (!res || !res.ok) throw new Error('Peladen tidak memberikan respons komparasi.');

        const result = await res.json();
        const list = Array.isArray(result) ? result : (result.data || []);
        window.lastKomparasiResult = list;

        if (!list || list.length === 0) {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">Belum ada data warga terdaftar untuk dibandingkan. Silakan tambahkan atau setujui data warga terlebih dahulu.</td></tr>';
            }
            if (window.compChartInstance) {
                window.compChartInstance.destroy();
                window.compChartInstance = null;
            }
            return;
        }

        // Ringkasan Statistik Verifikasi
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
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #2563eb;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Tingkat Konvergensi</div>
                        <div style="font-size:1.25rem; font-weight:800; color:#1d4ed8; margin-top:3px;">${akurasiPct}% Konsisten</div>
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #f59e0b;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Peringkat 1 SAW</div>
                        <div style="font-size:1rem; font-weight:800; color:#b45309; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${top1SAW}</div>
                    </div>
                    <div style="background:#ffffff; padding:14px 18px; border-radius:12px; border:1px solid #e2e8f0; border-left:4px solid #8b5cf6;">
                        <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Peringkat 1 WP</div>
                        <div style="font-size:1rem; font-weight:800; color:#6d28d9; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${top1WP}</div>
                    </div>
                </div>
            `;
        }

        // Render Tabel
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

        // Render Grafik Chart.js Tanpa Mengubah Dimensi Layar
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

window.AdminSPK = window.AdminSPK || {};
window.AdminSPK.bukaModalKomparasi = window.bukaModalKomparasi;
window.AdminSPK.hitungSPK = window.hitungSPK;

// =========================================================================
// 3. MATRIKS KERJA TERNORMALISASI (R)
// =========================================================================
window.bukaModalMatriksKerja = function () {
    if (!window.lastSPKResult || !window.lastSPKResult.matriks_normalisasi || window.lastSPKResult.matriks_normalisasi.length === 0) {
        return Swal.fire({ 
            icon: 'info', 
            title: 'Data Belum Tersedia', 
            text: 'Silakan jalankan "Proses Algoritma SAW" terlebih dahulu.', 
            confirmButtonColor: '#009846' 
        });
    }
    const matriks = window.lastSPKResult.matriks_normalisasi;
    const kriteriaHeaders = [
        { code: 'C1', name: 'Penghasilan', type: 'Cost' }, { code: 'C2', name: 'Aset', type: 'Cost' },
        { code: 'C3', name: 'Usia', type: 'Benefit' }, { code: 'C4', name: 'Gender', type: 'Benefit' },
        { code: 'C5', name: 'Tanggungan', type: 'Benefit' }, { code: 'C6', name: 'Status Nikah', type: 'Benefit' },
        { code: 'C7', name: 'Anak Sekolah', type: 'Benefit' }, { code: 'C8', name: 'Tempat Tinggal', type: 'Cost' },
        { code: 'C9', name: 'Pendidikan', type: 'Cost' }, { code: 'C10', name: 'Kesehatan', type: 'Benefit' }
    ];

    let theadHtml = `<thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;"><tr><th style="padding: 10px 8px; text-align: center; border: 1px solid #334155; font-size: 0.78rem;">NO</th><th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; font-size: 0.78rem;">NAMA WARGA</th>`;
    kriteriaHeaders.forEach(k => {
        theadHtml += `<th style="padding: 8px 6px; text-align: center; border: 1px solid #334155;"><div style="font-weight: 800; font-size: 0.82rem; color: #38bdf8;">${k.code}</div><span style="background:${k.type === 'Cost' ? '#dc2626' : '#16a34a'}; color:#ffffff; font-size:0.62rem; padding:1px 6px; border-radius:4px; font-weight:700;">${k.type}</span></th>`;
    });
    theadHtml += `</tr></thead>`;

    let tbodyHtml = '<tbody>';
    matriks.forEach((row, idx) => {
        tbodyHtml += `<tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding: 8px 6px; text-align: center; font-weight: 700; border: 1px solid #e2e8f0; font-size: 0.8rem;">${idx + 1}</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;"><div style="font-weight: 700; font-size: 0.85rem;">${window.safeHtml ? window.safeHtml(row.nama) : row.nama}</div><small style="color: #64748b; font-family: monospace;">NIK: ${row.nik || '-'}</small></td>`;
        for (let i = 1; i <= 10; i++) {
            const val = parseFloat(row[`C${i}`]);
            tbodyHtml += `<td style="padding: 8px 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.82rem; font-weight: 600;"><span style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${isNaN(val) ? '0.0000' : val.toFixed(4)}</span></td>`;
        }
        tbodyHtml += `</tr>`;
    });
    tbodyHtml += '</tbody>';

    Swal.fire({
        html: `<div style="text-align: left; font-family: 'Inter', sans-serif;"><h3 style="margin: 0 0 10px 0; font-size: 1.15rem; color: #0f172a; font-weight: 800;"><i class="fas fa-table-cells text-primary"></i> Matriks Normalisasi Ternormalisasi (R)</h3><div style="max-height: 380px; overflow: auto; border: 1px solid #cbd5e1; border-radius: 8px;"><table style="width: 100%; border-collapse: collapse;">${theadHtml}${tbodyHtml}</table></div></div>`,
        width: '940px', 
        showCloseButton: true, 
        confirmButtonColor: '#009846', 
        confirmButtonText: '<i class="fas fa-check"></i> Tutup Matriks'
    });
};

// =========================================================================
// 4. BOBOT KRITERIA BWM & SYNC BPS
// =========================================================================
window.bukaModalBobot = async function () {
    const modal = document.getElementById('modalBobot');
    const container = document.getElementById('bobotInputs');
    if (!modal || !container) return;
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:15px;">Memuat bobot kriteria...</div>';
    try {
        const res = await window.fetchData('/kriteria');
        const kriteria = await res.json();
        container.innerHTML = '';
        kriteria.forEach(k => {
            container.innerHTML += `<div class="form-group"><label class="form-label" style="font-size:0.8rem; font-weight:700;">${k.kode} (${k.nama})</label><input type="number" step="0.0001" class="form-input input-bobot-bwm" data-kode="${k.kode}" data-jenis="${k.jenis}" value="${k.bobot}" style="padding:6px;"></div>`;
        });
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; color:#ef4444; padding:15px;">Gagal memuat kriteria.</div>';
    }
};

window.simpanBobot = async function (e) {
    if (e) e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-bwm');
    const payload = Array.from(inputs).map(inp => ({ 
        kode: inp.dataset.kode, 
        jenis: inp.dataset.jenis, 
        bobot: parseFloat(inp.value || 0) 
    }));
    const res = await window.fetchData('/kriteria', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) {
        Swal.fire('Tersimpan', 'Bobot kriteria berhasil diterapkan!', 'success');
        if (typeof window.closeModal === 'function') window.closeModal('modalBobot');
    }
};

window.syncBPS = async function () {
    Swal.fire({ title: 'Menyelaraskan Data BPS Sidoarjo...', didOpen: () => Swal.showLoading() });
    const res = await window.fetchData('/api/bps/sync', { method: 'POST' });
    if (res && res.ok) {
        Swal.fire('Selesai', 'Data warga berhasil diselaraskan dengan basis data BPS DTSEN Sidoarjo!', 'success');
        if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
    }
};