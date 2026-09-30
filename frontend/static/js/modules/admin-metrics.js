/**
 * Modul: admin-metrics.js
 * Deskripsi: Metrik eksekutif, sinkronisasi data dasbor, dan grafik Chart.js
 */

// 7. SINKRONISASI DATA DASBOR MULTI-ROUTE & METRIK EKSEKUTIF
// =========================================================================
window.loadDashboardData = async function (showToast = false) {
    const statusPill = document.getElementById('cmdDbStatusPill');
    const statusText = document.getElementById('cmdDbStatusText');
    let rawData = [];

    try {
        const token = window.getCleanToken();
        const headers = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const endpointCandidates = [
            `${window.BASE_URL}/api/warga?_t=${Date.now()}`,
            `${window.BASE_URL}/warga?_t=${Date.now()}`,
            `${window.BASE_URL}/api/warga`
        ];

        let res = null;
        for (const url of endpointCandidates) {
            try {
                let testRes = await fetch(url, { headers });
                if (!testRes.ok && (testRes.status === 401 || testRes.status === 403 || testRes.status === 422)) {
                    localStorage.removeItem('token');
                    testRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
                }
                if (testRes && testRes.ok) {
                    res = testRes;
                    break;
                }
            } catch (err) {}
        }

        if (res && res.ok) {
            const resJson = await res.json();
            rawData = Array.isArray(resJson) ? resJson : (resJson.data || resJson.warga || resJson.items || []);
            if (rawData.length > 0) {
                localStorage.setItem('cachedDataWarga', JSON.stringify(rawData));
            }
        }
    } catch (err) {
        console.warn('[loadDashboardData] Gagal menghubungi peladen:', err);
    }

    if (!rawData || rawData.length === 0) {
        const cached = localStorage.getItem('cachedDataWarga');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    rawData = parsed;
                }
            } catch (e) {}
        }
    }

    window.globalDataWarga = rawData.map((w, idx) => ({
        id: w.id || (idx + 1),
        nama: w.nama || w.nama_lengkap || 'Warga Sidoarjo',
        nik: String(w.nik || ''),
        no_hp: w.no_hp || w.telepon || '',
        email: w.email || '',
        tempat_lahir: w.tempat_lahir || 'Sidoarjo',
        tanggal_lahir: w.tanggal_lahir || '',
        alamat: w.alamat || 'Kabupaten Sidoarjo',
        lat: parseFloat(w.lat || w.latitude || -7.4478),
        lng: parseFloat(w.lng || w.longitude || 112.7183),
        c1: parseFloat(w.c1 ?? w.c1_ekonomi ?? 1500000),
        c2: parseFloat(w.c2 ?? w.c2_aset ?? 5000000),
        c3: parseInt(w.c3 ?? w.c3_umur ?? 45),
        c4: parseInt(w.c4 ?? w.c4_jk ?? 1),
        c5: parseInt(w.c5 ?? w.c5_tanggungan ?? 3),
        c6: parseInt(w.c6 ?? w.c6_pernikahan ?? 2),
        c7: parseInt(w.c7 ?? w.c7_anak_sekolah ?? 2),
        c8: parseInt(w.c8 ?? w.c8_rumah ?? 2),
        c9: parseInt(w.c9 ?? w.c9_pendidikan ?? 1),
        c10: parseInt(w.c10 ?? w.c10_kesehatan ?? 1),
        desil: Number(w.desil) || 5,
        skor_saw: parseFloat(w.skor_saw || 0),
        is_verified: Boolean(w.is_verified == 1 || w.is_verified === true || w.status_validasi === 'Disetujui'),
        status_salur: w.status_salur || w.status_penyaluran || 'Belum Salur',
        nominal_bantuan: w.nominal_bantuan || '',
        bukti_salur: w.bukti_salur || '',
        created_at: w.created_at || w.waktu || 'Hari ini',
        catatan: w.catatan || ''
    }));

    globalDataWarga = window.globalDataWarga;

    const total = window.globalDataWarga.length;
    const disetujui = window.globalDataWarga.filter(w => w.is_verified).length;
    const menunggu = total - disetujui;
    const telahSalur = window.globalDataWarga.filter(w => w.status_salur === 'Telah Menerima').length;
    const belumSalur = total - telahSalur;
    const sengketa = window.globalDataWarga.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa')).length;
    const bebasSengketa = total - sengketa;

    if (statusText && statusPill) {
        statusText.innerText = total > 0 ? 'Sinkronisasi Aktif' : 'Database Kosong';
        statusPill.style.background = total > 0 ? '#f0fdf4' : '#fffbeb';
        statusPill.style.borderColor = total > 0 ? '#bbf7d0' : '#fde68a';
        statusPill.style.color = total > 0 ? '#15803d' : '#b45309';
    }

    document.getElementById('statTotal') && (document.getElementById('statTotal').innerText = total);
    document.getElementById('statValid') && (document.getElementById('statValid').innerText = disetujui);
    document.getElementById('statTotalRef') && (document.getElementById('statTotalRef').innerText = total);
    document.getElementById('statValidBadge') && (document.getElementById('statValidBadge').innerText = disetujui);
    document.getElementById('statMenungguBadge') && (document.getElementById('statMenungguBadge').innerText = menunggu);
    document.getElementById('statTelahSalur') && (document.getElementById('statTelahSalur').innerText = telahSalur);
    document.getElementById('statBelumSalurBadge') && (document.getElementById('statBelumSalurBadge').innerText = belumSalur);
    document.getElementById('statSengketa') && (document.getElementById('statSengketa').innerText = sengketa);
    document.getElementById('statBebasSengketaBadge') && (document.getElementById('statBebasSengketaBadge').innerText = bebasSengketa);

    try {
        window.render3DashboardCharts(window.globalDataWarga);
    } catch (e) {
        console.warn('Gagal merender grafik statistik:', e);
    }

    window.filterAndRenderData();

    if (typeof window.renderChoroplethKerentanan === 'function') {
        window.renderChoroplethKerentanan();
    }

    if (showToast) {
        showAdminAlert({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Berhasil memuat ${total} data kependudukan!`,
            showConfirmButton: false,
            timer: 1500
        });
    }
};

// =========================================================================


// 10. RENDER GRAFIK DASBOR CHART.JS
// =========================================================================
window.render3DashboardCharts = function (data) {
    if (typeof Chart === 'undefined') return;
    if (!Array.isArray(data)) data = [];
    const total = data.length;

    const canvasDesil = document.getElementById('chartDesil10');
    if (canvasDesil) {
        const desilCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        data.forEach(w => {
            const d = (w.desil && w.desil >= 1 && w.desil <= 10) ? w.desil : 5;
            desilCounts[d - 1]++;
        });
        const existing = Chart.getChart(canvasDesil);
        if (existing) existing.destroy();

        chartDesilObj = new Chart(canvasDesil, {
            type: 'bar',
            data: {
                labels: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'],
                datasets: [{
                    label: 'Jumlah Warga',
                    data: desilCounts,
                    backgroundColor: ['#ef4444', '#f87171', '#fb923c', '#f59e0b', '#38bdf8', '#0284c7', '#10b981', '#059669', '#64748b', '#94a3b8'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    const canvasValid = document.getElementById('chartPersetujuan');
    if (canvasValid) {
        const disetujui = data.filter(w => w.is_verified).length;
        const menunggu = total - disetujui;
        const existing = Chart.getChart(canvasValid);
        if (existing) existing.destroy();

        chartPersetujuanObj = new Chart(canvasValid, {
            type: 'doughnut',
            data: {
                labels: ['Disetujui', 'Menunggu'],
                datasets: [{
                    data: total > 0 ? [disetujui, menunggu] : [0, 1],
                    backgroundColor: total > 0 ? ['#10b981', '#ef4444'] : ['#e2e8f0', '#cbd5e1'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } }
            }
        });
    }

    const canvasSalur = document.getElementById('chartPenyaluran');
    if (canvasSalur) {
        const telahSalur = data.filter(w => w.status_salur === 'Telah Menerima').length;
        const belumSalur = total - telahSalur;
        const existing = Chart.getChart(canvasSalur);
        if (existing) existing.destroy();

        chartPenyaluranObj = new Chart(canvasSalur, {
            type: 'doughnut',
            data: {
                labels: ['Telah Disalurkan', 'Menunggu Salur'],
                datasets: [{
                    data: total > 0 ? [telahSalur, belumSalur] : [0, 1],
                    backgroundColor: total > 0 ? ['#0284c7', '#f8fafc'] : ['#e2e8f0', '#cbd5e1'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } }
            }
        });
    }

    const canvasSengketa = document.getElementById('chartSengketa');
    if (canvasSengketa) {
        const sengketa = data.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa')).length;
        const bebasSengketa = total - sengketa;
        const existing = Chart.getChart(canvasSengketa);
        if (existing) existing.destroy();

        chartSengketaObj = new Chart(canvasSengketa, {
            type: 'doughnut',
            data: {
                labels: ['Bebas Kasus', 'Laporan Sengketa'],
                datasets: [{
                    data: total > 0 ? [bebasSengketa, sengketa] : [1, 0],
                    backgroundColor: total > 0 ? ['#10b981', '#dc2626'] : ['#e2e8f0', '#cbd5e1'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } }
            }
        });
    }
};

// =========================================================================
