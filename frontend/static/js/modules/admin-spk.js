/* =========================================================================
   ADMIN-SPK.JS - ENGINE ALGORITMA BWM, SAW, VALIDASI WP & MATRIKS NORMALISASI
   ========================================================================= */

window.lastSPKResult = null;
window.lastKomparasiResult = [];

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
        const res = await window.fetchData('/hitung-saw');
        if (!res.ok) {
            let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
            try {
                const errJson = await res.json();
                if (errJson.message) errorDetail = errJson.message;
            } catch (_) {}
            throw new Error(errorDetail);
        }

        const spkData = await res.json();
        window.lastSPKResult = spkData;
        Swal.close();

        const hasilList = Array.isArray(spkData) ? spkData : (spkData.hasil_akhir || spkData.data || []);
        if (hasilList.length === 0) throw new Error('Hasil komputasi kosong dari server backend.');

        const resultCard = document.getElementById('resultCard');
        const resultTable = document.getElementById('resultTable');
        const resultTbody = document.querySelector('#resultTable tbody');
        if (!resultCard || !resultTbody) throw new Error('Elemen #resultCard atau #resultTable tidak ditemukan.');

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
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin: 24px 0 28px 0; padding: 2px; box-sizing: border-box;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-users"></i></div>
                    <div><div style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Dievaluasi</div><div style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-top: 2px;">${totalWarga} Jiwa</div></div>
                </div>
                <div style="background: #ffffff; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(22,163,74,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-check-circle"></i></div>
                    <div><div style="font-size: 0.72rem; color: #15803d; font-weight: 700; text-transform: uppercase;">Layak (Desil 1–4)</div><div style="font-size: 1.3rem; font-weight: 800; color: #14532d; margin-top: 2px;">${totalLayak} Penerima</div></div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(220,38,38,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-times-circle"></i></div>
                    <div><div style="font-size: 0.72rem; color: #b91c1c; font-weight: 700; text-transform: uppercase;">Tidak Prioritas</div><div style="font-size: 1.3rem; font-weight: 800; color: #7f1d1d; margin-top: 2px;">${totalTidak} Warga</div></div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fde68a; border-left: 5px solid #d97706; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(217,119,6,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-money-bill-wave"></i></div>
                    <div><div style="font-size: 0.72rem; color: #92400e; font-weight: 700; text-transform: uppercase;">Alokasi Bansos</div><div style="font-size: 1.25rem; font-weight: 800; color: #78350f; margin-top: 2px;">Rp ${estimasiDana.toLocaleString('id-ID')}</div></div>
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
            if (idx === 0) rankBadge = `<span style="background:#f59e0b; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-medal"></i> #1</span>`;
            else if (idx === 1) rankBadge = `<span style="background:#94a3b8; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-medal"></i> #2</span>`;
            else if (idx === 2) rankBadge = `<span style="background:#d97706; color:white; padding:3px 9px; border-radius:12px; font-weight:800; font-size:0.75rem;"><i class="fas fa-medal"></i> #3</span>`;

            tr.innerHTML = `
                <td style="text-align:center; vertical-align:middle;">${rankBadge}</td>
                <td style="vertical-align:middle;"><div style="font-weight:800; color:#1e293b; font-size:0.92rem;">${window.safeHtml(item.nama)}</div><small style="color:#64748b; font-family:monospace; font-size:0.78rem;">NIK: ${item.nik || '-'}</small></td>
                <td style="vertical-align:middle; min-width:120px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                        <span style="font-weight:800; font-family:monospace; color:#0f172a; font-size:0.88rem;">${skorNum.toFixed(4)}</span>
                        <small style="color:#64748b; font-size:0.7rem;">${skorPct}%</small>
                    </div>
                    <div style="background:#e2e8f0; height:6px; border-radius:4px; overflow:hidden;"><div style="background:${isLayakDesil ? '#009846' : '#94a3b8'}; width:${skorPct}%; height:100%;"></div></div>
                </td>
                <td style="text-align:center; vertical-align:middle;"><span class="badge" style="background:${isLayakDesil ? '#dcfce7' : '#f1f5f9'}; color:${isLayakDesil ? '#15803d' : '#64748b'}; font-weight:800; font-size:0.75rem; border:1px solid ${isLayakDesil ? '#86efac' : '#cbd5e1'};">DESIL ${item.desil || '-'}</span></td>
                <td style="text-align:center; vertical-align:middle;">${isLayakDesil ? `<span class="badge badge-green" style="font-size:0.78rem;"><i class="fas fa-check-circle"></i> Menerima Bansos</span>` : `<span class="badge badge-red" style="font-size:0.78rem;"><i class="fas fa-times-circle"></i> Tidak Menerima</span>`}</td>
            `;
            resultTbody.appendChild(tr);
        });

        resultCard.scrollIntoView({ behavior: 'smooth' });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan BWM-SAW Berhasil!', showConfirmButton: false, timer: 2000 });
    } catch (e) {
        Swal.fire('Gagal Komputasi', `Detail Kendala: ${e.message}`, 'error');
    }
};

window.bukaModalMatriksKerja = function () {
    if (!window.lastSPKResult || !window.lastSPKResult.matriks_normalisasi || window.lastSPKResult.matriks_normalisasi.length === 0) {
        return Swal.fire({ icon: 'info', title: 'Data Belum Tersedia', text: 'Silakan jalankan "Proses Algoritma SAW" terlebih dahulu.', confirmButtonColor: '#009846' });
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
        tbodyHtml += `<tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding: 8px 6px; text-align: center; font-weight: 700; border: 1px solid #e2e8f0; font-size: 0.8rem;">${idx + 1}</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;"><div style="font-weight: 700; font-size: 0.85rem;">${window.safeHtml(row.nama)}</div><small style="color: #64748b; font-family: monospace;">NIK: ${row.nik || '-'}</small></td>`;
        for (let i = 1; i <= 10; i++) {
            const val = parseFloat(row[`C${i}`]);
            tbodyHtml += `<td style="padding: 8px 6px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.82rem; font-weight: 600;"><span style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${isNaN(val) ? '0.0000' : val.toFixed(4)}</span></td>`;
        }
        tbodyHtml += `</tr>`;
    });
    tbodyHtml += '</tbody>';

    Swal.fire({
        html: `<div style="text-align: left; font-family: 'Inter', sans-serif;"><h3 style="margin: 0 0 10px 0; font-size: 1.15rem; color: #0f172a; font-weight: 800;"><i class="fas fa-table-cells text-primary"></i> Matriks Normalisasi Ternormalisasi (R)</h3><div style="max-height: 380px; overflow: auto; border: 1px solid #cbd5e1; border-radius: 8px;"><table style="width: 100%; border-collapse: collapse;">${theadHtml}${tbodyHtml}</table></div></div>`,
        width: '940px', showCloseButton: true, confirmButtonColor: '#009846', confirmButtonText: '<i class="fas fa-check"></i> Tutup Matriks'
    });
};

window.bukaModalBobot = async function () {
    const modal = document.getElementById('modalBobot'), container = document.getElementById('bobotInputs');
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
    } catch (e) { }
};

window.simpanBobot = async function (e) {
    if (e) e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-bwm');
    const payload = Array.from(inputs).map(inp => ({ kode: inp.dataset.kode, jenis: inp.dataset.jenis, bobot: parseFloat(inp.value || 0) }));
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

window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    if (modal) modal.style.display = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Memproses komparasi preferensi SAW vs WP...</td></tr>';
    
    try {
        const res = await window.fetchData('/komparasi');
        const data = await res.json();
        window.lastKomparasiResult = Array.isArray(data) ? data : [];

        if (tbody) tbody.innerHTML = '';
        const labels = [], sawScores = [], wpScores = [];

        const maxWpRaw = Math.max(...window.lastKomparasiResult.map(d => parseFloat(d.wp_skor || 0))) || 1;
        const maxSawRaw = Math.max(...window.lastKomparasiResult.map(d => parseFloat(d.saw_skor || 0))) || 1;

        window.lastKomparasiResult.slice(0, 15).forEach((item) => {
            labels.push(item.nama.split(' ')[0]);
            const sVal = parseFloat(item.saw_skor || 0);
            const wVal = parseFloat(item.wp_skor || 0);
            sawScores.push(sVal);

            const wScaled = (wVal < 0.1 && maxWpRaw > 0) ? (wVal / maxWpRaw * maxSawRaw) : wVal;
            wpScores.push(parseFloat(wScaled.toFixed(4)));

            if (tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td><b>${window.safeHtml(item.nama)}</b><br><small class="text-muted">NIK: ${item.nik || '-'}</small></td>
                        <td style="text-align:center;"><span class="badge badge-green">#${item.saw_rank}</span></td>
                        <td style="text-align:center; color:#15803d; font-weight:800; font-family:monospace;">${sVal.toFixed(4)}</td>
                        <td style="text-align:center;"><span class="badge badge-blue">#${item.wp_rank}</span></td>
                        <td style="text-align:center; color:#0369a1; font-weight:800; font-family:monospace;">${wVal.toFixed(4)}</td>
                    </tr>
                `;
            }
        });

        const ctx = document.getElementById('compChart');
        if (ctx) {
            if (window.compChart) window.compChart.destroy();
            window.compChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Skor SAW', data: sawScores, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, fill: true },
                        { label: 'Skor WP (Validasi)', data: wpScores, borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', tension: 0.3, borderDash: [5, 5], fill: true }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: false } }
                }
            });
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#dc2626;">Gagal memuat data komparasi.</td></tr>';
    }
};