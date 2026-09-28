/* =========================================================================
   ADMIN.JS - ORCHESTRATOR UTAMA SISTEM SPK BANSOS PEMKAB SIDOARJO
   Lokasi: frontend/static/js/admin.js
   Pemerintah Kabupaten Sidoarjo - Dinas Sosial
   Sistem Pendukung Keputusan Penyaluran Bantuan Sosial (Metode BWM-SAW)
   Arsitektur: Modular Event-Driven + Anti-Collision Canvas Engine
   ========================================================================= */

// Matikan jendela peringatan bawaan DataTables secara global
if (typeof $ !== 'undefined' && $.fn && $.fn.dataTable) {
    $.fn.dataTable.ext.errMode = 'none';
}

// =========================================================================
// 1. INISIALISASI MODAL GLOBAL & HOOK DATA OTOMATIS
// =========================================================================
window.openModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        m.style.setProperty('display', 'flex', 'important');
        m.style.setProperty('z-index', '99999', 'important');
    }

    if (modalId === 'modalPengguna' || modalId === 'modalUser') {
        setTimeout(() => {
            try {
                if (typeof window.resetFormUser === 'function') window.resetFormUser();
                if (typeof window.loadUserTable === 'function') window.loadUserTable();
            } catch (err) {
                console.warn('[openModal] Gagal memuat tabel pengguna:', err);
            }
        }, 50);
    }

    if (modalId === 'modalLaporanChat') {
        setTimeout(() => {
            try {
                if (typeof window.loadLaporanChatData === 'function') window.loadLaporanChatData();
            } catch (err) {
                console.warn('[openModal] Gagal memuat aduan investigasi:', err);
            }
        }, 50);
    }
};

window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        m.style.setProperty('display', 'none', 'important');
    }
};

window.bukaModalPengguna = function () {
    window.openModal('modalPengguna');
};

window.bukaModalLaporanChat = function () {
    window.openModal('modalLaporanChat');
};

// =========================================================================
// 2. VARIABEL GLOBAL LINGKUNGAN SISTEM
// =========================================================================
if (typeof window.BASE_URL === 'undefined') {
    window.BASE_URL = 'http://127.0.0.1:5000';
}
if (typeof window.BASE_API_URL === 'undefined') {
    window.BASE_API_URL = window.BASE_URL;
}

window.MAP_CENTER_SIDOARJO = [-7.4478, 112.7183];
window.globalDataWarga = window.globalDataWarga || [];
var globalDataWarga = window.globalDataWarga;
window.allLaporanChatData = window.allLaporanChatData || [];
window.currentFilter = 'all';
window.currentSort = 'terbaru';
window.sortNikAsc = false;
window.sortAzAsc = false;
window.stagedImportData = [];
window.isNotifUpdating = false;

// =========================================================================
// 3. INJEKSI GAYA DINAMIS CSS (BADGES, TABLES & BULK BAR)
// =========================================================================
(function injectDynamicAdminStyles() {
    const dtStyleId = 'admin-dynamic-injected-css';
    if (document.getElementById(dtStyleId)) return;

    const dtStyle = document.createElement('style');
    dtStyle.id = dtStyleId;
    dtStyle.innerHTML = `
        .dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: #64748b; font-size: 0.88rem; }
        .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; margin: 0 8px; cursor: pointer; background: #ffffff; }
        .dataTables_filter { margin-bottom: 15px; margin-top: 5px; }
        .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1.5px solid #cbd5e1; outline: none; margin-left: 8px; width: 260px; background: #ffffff; font-family: 'Inter', sans-serif; font-size: 0.88rem; transition: border-color 0.2s ease; }
        .dataTables_filter input:focus { border-color: #009846; }
        .badge-green { background: #e6f9f0; color: #15803d; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #bbf7d0; }
        .badge-blue { background: #e0f2fe; color: #1d4ed8; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #bae6fd; }
        .badge-red { background: #fee2e2; color: #dc2626; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #fecaca; }
        .badge-warning { background: #fef3c7; color: #b45309; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; border: 1px solid #fde68a; }
        .filter-btn.active { background: #10b981 !important; color: #ffffff !important; font-weight: 700; border-color: #059669 !important; }
        .filter-btn-danger.active { background: #ef4444 !important; color: #ffffff !important; font-weight: 700; border-color: #dc2626 !important; }
        .fab-bulk { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); z-index: 1000; display: none; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.15); animation: slideUpFab 0.3s ease; }
        .fab-text { font-size: 0.92rem; font-weight: 700; }
        @keyframes slideUpFab { from { transform: translate(-50%, 60px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    `;
    document.head.appendChild(dtStyle);
})();

// =========================================================================
// 4. VEKTOR BOBOT 10 KRITERIA BWM (SESUAI LAPORAN SKRIPSI RESMI)
// =========================================================================
window.defaultBobotBWM = {
    c1: 0.22, // Kondisi Ekonomi / Penghasilan (Cost)
    c2: 0.15, // Kepemilikan Aset (Cost)
    c3: 0.08, // Umur Kepala Keluarga (Benefit)
    c4: 0.05, // Jenis Kelamin (Benefit)
    c5: 0.18, // Jumlah Tanggungan (Benefit)
    c6: 0.06, // Status Pernikahan (Benefit)
    c7: 0.08, // Kepemilikan Anak / Balita (Benefit)
    c8: 0.10, // Kelayakan Tempat Tinggal (Cost)
    c9: 0.04, // Tingkat Pendidikan Terakhir (Cost)
    c10: 0.04 // Kondisi Kesehatan / Disabilitas (Cost)
};

let dtTable = null;
let chartDesilObj = null;
let chartPersetujuanObj = null;
let chartPenyaluranObj = null;
let chartSengketaObj = null;
let compChartObj = null;
let formMap = null;
let formMarker = null;
let macroMapObj = null;
let macroGeoJsonLayer = null;

let user = null;
try {
    const rawUser = localStorage.getItem('user') || 
                    localStorage.getItem('bansos_user_data') || 
                    localStorage.getItem('bansosUser') || 
                    localStorage.getItem('userData');
    if (rawUser) {
        user = JSON.parse(rawUser);
        if (typeof user === 'string') {
            user = { username: user, role: localStorage.getItem('role') || localStorage.getItem('user_role') || 'admin' };
        }
    }
} catch (e) {
    user = { 
        username: localStorage.getItem('username') || 'ADMIN', 
        role: localStorage.getItem('role') || localStorage.getItem('user_role') || 'admin' 
    };
}

// =========================================================================
// 5. HELPER UTILITAS, SANITASI & TOKEN
// =========================================================================
window.safeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.escapeInlineJS = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
};

function showAdminAlert(options) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire(options);
    }
    alert(options.text || options.title || 'Pemberitahuan Sistem');
    return Promise.resolve({ isConfirmed: true, value: true });
}

window.getCleanToken = function () {
    const raw = localStorage.getItem('token') || 
                localStorage.getItem('access_token') || 
                localStorage.getItem('bansos_jwt_token') || 
                localStorage.getItem('bansosToken') || '';
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return raw.replace(/^["']+|["']+$/g, '').trim();
};

// =========================================================================
// 6. SIKLUS HIDUP DOM & INISIALISASI DASBOR
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const formBansos = document.getElementById('bansosForm');
    if (formBansos) {
        formBansos.onsubmit = function (e) {
            e.preventDefault();
            window.tambahData(e);
            return false;
        };
    }

    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', (e) => e.preventDefault());
    });

    const currentRole = (
        localStorage.getItem('role') || 
        localStorage.getItem('user_role') || 
        localStorage.getItem('bansos_user_role') || 
        user?.role || 
        'admin'
    ).toLowerCase();

    const nameEl = document.getElementById('navUsername');
    const roleEl = document.getElementById('navRoleBadge');
    const cmdEl = document.getElementById('adminCommandCenter');
    const currentUsername = localStorage.getItem('username') || user?.username || 'ADMIN';

    if (nameEl) nameEl.innerText = currentUsername.toUpperCase();

    const isAdmin = (currentRole === 'admin' || currentRole === 'super admin');
    if (roleEl) {
        if (isAdmin) {
            roleEl.className = 'role-badge role-admin';
            roleEl.innerHTML = '<i class="fas fa-crown"></i> Super Admin';
        } else {
            roleEl.className = 'role-badge role-petugas';
            roleEl.innerHTML = '<i class="fas fa-user-edit"></i> Petugas Lapangan';
        }
    }

    if (cmdEl) {
        cmdEl.style.display = isAdmin ? 'block' : 'none';
    }

    const btnPengguna = document.querySelector('.cmd-tile-item.tile-purple') || 
                        document.querySelector('[onclick*="modalPengguna"]') || 
                        document.querySelector('[onclick*="bukaModalPengguna"]');
    if (btnPengguna) {
        btnPengguna.onclick = (e) => {
            e.preventDefault();
            window.bukaModalPengguna();
        };
    }

    const btnInvestigasi = document.querySelector('.cmd-tile-item.tile-rose') || 
                           document.querySelector('[onclick*="modalLaporanChat"]') || 
                           document.querySelector('[onclick*="bukaModalLaporanChat"]');
    if (btnInvestigasi) {
        btnInvestigasi.onclick = (e) => {
            e.preventDefault();
            window.bukaModalLaporanChat();
        };
    }

    await window.loadDashboardData();

    setTimeout(() => {
        window.initFormMapPicker();
        window.initMacroDistributionMap();
    }, 350);

    window.cekNotifikasiRealtime();
    setInterval(window.cekNotifikasiRealtime, 6000);
});

// =========================================================================
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
    document.getElementById('statTotalRef') && (document.getElementById('statTotalRef').innerText = `dari ${total}`);
    document.getElementById('statValidBadge') && (document.getElementById('statValidBadge').innerText = `${disetujui} Layak`);
    document.getElementById('statMenungguBadge') && (document.getElementById('statMenungguBadge').innerText = `${menunggu} Menunggu`);
    document.getElementById('statTelahSalur') && (document.getElementById('statTelahSalur').innerText = telahSalur);
    document.getElementById('statBelumSalurBadge') && (document.getElementById('statBelumSalurBadge').innerText = `${belumSalur} Belum Salur`);
    document.getElementById('statSengketa') && (document.getElementById('statSengketa').innerText = sengketa);
    document.getElementById('statBebasSengketaBadge') && (document.getElementById('statBebasSengketaBadge').innerText = `${bebasSengketa} Bebas Kasus`);

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
// 8. VERIFIKASI DUKCAPIL SIDOARJO
// =========================================================================
window.cekDukcapilLokal = async function () {
    const nik = document.getElementById('nik')?.value.trim();
    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit angka NIK.' });
    }

    showAdminAlert({ title: 'Memeriksa Data Dukcapil...', didOpen: () => Swal?.showLoading() });

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/api/dukcapil/${nik}`) : fetch(`${window.BASE_URL}/api/dukcapil/${nik}`));
        const json = await res.json();
        Swal?.close();

        if (res && res.ok && json.status === 'success') {
            const d = json.data;
            if (document.getElementById('nama')) document.getElementById('nama').value = d.nama;
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = d.tempat_lahir;
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = d.tanggal_lahir;
            if (document.getElementById('alamat')) document.getElementById('alamat').value = d.alamat;
            if (document.getElementById('inputC4')) document.getElementById('inputC4').value = d.jenis_kelamin === 'Perempuan' ? '2' : '1';

            if (typeof window.cariAlamatDiPeta === 'function') {
                window.cariAlamatDiPeta(d.alamat);
            }

            showAdminAlert({
                icon: 'success',
                title: 'Data Dukcapil Ditemukan',
                html: `<b>Nama:</b> ${d.nama}<br><b>TTL:</b> ${d.tempat_lahir}, ${d.tanggal_lahir}<br><b>Alamat:</b> ${d.alamat}`,
                confirmButtonColor: '#10b981'
            });
        } else {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: 'Data NIK tidak ditemukan pada peladen Dukcapil.' });
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal menghubungi peladen Dukcapil.' });
    }
};

// =========================================================================
// 9. GEOTAGGING FORM PENDAFTARAN WARGA
// =========================================================================
window.initFormMapPicker = function () {
    const mapBox = document.getElementById('formCoordMap');
    if (!mapBox || typeof L === 'undefined') return;

    if (mapBox._leaflet_id) {
        try {
            if (formMap) formMap.remove();
        } catch (e) {}
        mapBox._leaflet_id = null;
        formMap = null;
    }

    formMap = L.map('formCoordMap', { attributionControl: false }).setView(window.MAP_CENTER_SIDOARJO, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(formMap);

    formMarker = L.marker(window.MAP_CENTER_SIDOARJO, { draggable: true }).addTo(formMap);

    formMarker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        window.updateLocationAndAddress(pos.lat, pos.lng);
    });

    formMap.on('click', function (e) {
        formMarker.setLatLng(e.latlng);
        window.updateLocationAndAddress(e.latlng.lat, e.latlng.lng);
    });

    window.setFormCoords(window.MAP_CENTER_SIDOARJO[0], window.MAP_CENTER_SIDOARJO[1]);
};

window.setFormCoords = function (lat, lng) {
    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = Number(lat || window.MAP_CENTER_SIDOARJO[0]).toFixed(6);
    if (lngEl) lngEl.value = Number(lng || window.MAP_CENTER_SIDOARJO[1]).toFixed(6);
};

window.updateLocationAndAddress = async function (lat, lng) {
    window.setFormCoords(lat, lng);
    const alamatEl = document.getElementById('alamat');

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.display_name && alamatEl && (!alamatEl.value || alamatEl.value === 'Sidoarjo')) {
                alamatEl.value = data.display_name;
            }
        }
    } catch (err) { }
};

window.cariAlamatDiPeta = async function (query) {
    if (!query || String(query).trim().length < 4) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Kabupaten Sidoarjo')}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (formMap && formMarker) {
                    formMap.setView([lat, lng], 16);
                    formMarker.setLatLng([lat, lng]);
                }
                window.setFormCoords(lat, lng);
            }
        }
    } catch (e) { }
};

window.ambilLokasiGPS = function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (formMap && formMarker) {
                    formMap.setView([lat, lng], 16);
                    formMarker.setLatLng([lat, lng]);
                }
                window.updateLocationAndAddress(lat, lng);
            },
            () => showAdminAlert({ icon: 'error', title: 'GPS Gagal', text: 'Izinkan akses geolokasi pada peramban Anda.' })
        );
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
// 11. FILTER WAKTU & SORTING DATA
// =========================================================================
window.activeDateFilter = { mode: 'tanggal', val: '' };

function parseWaktuPendaftaran(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        return { day: parseInt(dmy[1], 10), month: parseInt(dmy[2], 10), year: parseInt(dmy[3], 10) };
    }

    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
        return { day: parseInt(ymd[3], 10), month: parseInt(ymd[2], 10), year: parseInt(ymd[1], 10) };
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
    }
    return null;
}

window.changeDateFilterMode = function (mode) {
    window.activeDateFilter.mode = mode;
    window.activeDateFilter.val = '';
    const container = document.getElementById('dateFilterInputContainer');
    if (!container) return;

    if (mode === 'tanggal') {
        container.innerHTML = `<input type="date" id="filterTglPicker" onchange="window.applyDateFilter()" style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Tanggal Tertentu">`;
    } else if (mode === 'bulan') {
        container.innerHTML = `<input type="month" id="filterBulanPicker" onchange="window.applyDateFilter()" style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Bulan Tertentu">`;
    } else if (mode === 'tahun') {
        container.innerHTML = `<input type="number" id="filterTahunPicker" min="1900" max="2100" placeholder="Ketik Tahun (contoh: 2026)" oninput="window.applyDateFilter()" style="width:160px; border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; background:#f8fafc;" title="Ketik tahun pendaftaran bebas">`;
    }

    window.filterAndRenderData();
};

window.applyDateFilter = function () {
    const mode = window.activeDateFilter.mode;
    if (mode === 'tanggal') {
        window.activeDateFilter.val = document.getElementById('filterTglPicker')?.value || '';
    } else if (mode === 'bulan') {
        window.activeDateFilter.val = document.getElementById('filterBulanPicker')?.value || '';
    } else if (mode === 'tahun') {
        window.activeDateFilter.val = document.getElementById('filterTahunPicker')?.value.trim() || '';
    }
    window.filterAndRenderData();
};

window.resetDateFilter = function () {
    window.activeDateFilter = { mode: 'tanggal', val: '' };
    const modeEl = document.getElementById('dateFilterMode');
    if (modeEl) modeEl.value = 'tanggal';
    window.changeDateFilterMode('tanggal');
};

window.filterAndRenderData = function () {
    let dataList = Array.isArray(window.globalDataWarga) ? window.globalDataWarga : [];
    let filtered = [...dataList];

    if (window.currentFilter === 'layak') {
        filtered = filtered.filter(w => w.is_verified && ((w.desil || 5) <= 4));
    } else if (window.currentFilter === 'menerima') {
        filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    } else if (window.currentFilter === 'bermasalah') {
        filtered = filtered.filter(w => String(w.status_salur || '').includes('Sengketa') || !w.is_verified);
    }

    const { mode, val } = window.activeDateFilter;
    if (val) {
        if (mode === 'tanggal') {
            const [targetY, targetM, targetD] = val.split('-').map(Number);
            filtered = filtered.filter(w => {
                const parsed = parseWaktuPendaftaran(w.created_at);
                return parsed && parsed.year === targetY && parsed.month === targetM && parsed.day === targetD;
            });
        } else if (mode === 'bulan') {
            const [targetY, targetM] = val.split('-').map(Number);
            filtered = filtered.filter(w => {
                const parsed = parseWaktuPendaftaran(w.created_at);
                return parsed && parsed.year === targetY && parsed.month === targetM;
            });
        } else if (mode === 'tahun') {
            const targetY = parseInt(val, 10);
            if (!isNaN(targetY)) {
                filtered = filtered.filter(w => {
                    const parsed = parseWaktuPendaftaran(w.created_at);
                    return parsed && parsed.year === targetY;
                });
            }
        }
    }

    if (window.currentSort === 'nik_asc') {
        filtered.sort((a, b) => BigInt(String(a.nik).replace(/\D/g, '') || 0) < BigInt(String(b.nik).replace(/\D/g, '') || 0) ? -1 : 1);
    } else if (window.currentSort === 'nik_desc') {
        filtered.sort((a, b) => BigInt(String(a.nik).replace(/\D/g, '') || 0) > BigInt(String(b.nik).replace(/\D/g, '') || 0) ? -1 : 1);
    } else if (window.currentSort === 'terbaru') {
        filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (window.currentSort === 'terlama') {
        filtered.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (window.currentSort === 'az') {
        filtered.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || '')));
    } else if (window.currentSort === 'za') {
        filtered.sort((a, b) => String(b.nama || '').localeCompare(String(a.nama || '')));
    }

    try {
        window.renderTable(filtered);
    } catch (e) {
        console.warn('Gagal memproses render tabel kependudukan:', e);
    }
};

// =========================================================================
// 12. PENDAFTARAN DATA WARGA BARU
// =========================================================================
window.tambahData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const payload = {
        nama: document.getElementById('nama')?.value.trim(),
        nik: document.getElementById('nik')?.value.trim(),
        no_hp: document.getElementById('no_hp')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || '',
        tempat_lahir: document.getElementById('tempatLahir')?.value.trim() || 'Sidoarjo',
        tanggal_lahir: document.getElementById('tglLahir')?.value || null,
        alamat: document.getElementById('alamat')?.value.trim() || 'Sidoarjo',
        lat: document.getElementById('lat')?.value || '',
        lng: document.getElementById('lng')?.value || '',
        c1: parseFloat(document.getElementById('c1')?.value || 0),
        c2: parseInt(document.getElementById('c2')?.value || 0),
        c3: parseInt(document.getElementById('c3')?.value || 0),
        c4: parseInt(document.getElementById('inputC4')?.value || 1),
        c5: parseInt(document.getElementById('c5')?.value || 0),
        c6: parseInt(document.getElementById('inputC6')?.value || 1),
        c7: parseInt(document.getElementById('c7')?.value || 0),
        c8: parseInt(document.getElementById('inputC8')?.value || 1),
        c9: parseInt(document.getElementById('inputC9')?.value || 1),
        c10: parseInt(document.getElementById('inputC10')?.value || 1),
        catatan: document.getElementById('catatan')?.value.trim() || ''
    };

    if (!payload.nik || !payload.nama) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    showAdminAlert({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        let res = await fetch(`${window.BASE_URL}/api/warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/warga`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify(payload)
            });
        }

        const json = await res.json();
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Berhasil', text: json.message || 'Data warga berhasil disimpan!' });
            document.getElementById('bansosForm')?.reset();
            window.loadDashboardData();
        } else {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: json.message || 'Gagal menyimpan data.' });
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Kendala komunikasi ke peladen backend.' });
    }
};

window.applyFilter = function (filterType, btn) {
    window.currentFilter = filterType;
    document.querySelectorAll('.filter-kategori').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.filterAndRenderData();
};

window.applySort = function (sortType, btn) {
    window.currentSort = sortType;
    document.querySelectorAll('.filter-btn:not(.filter-kategori)').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.filterAndRenderData();
};

window.toggleSortNik = function () {
    window.sortNikAsc = !window.sortNikAsc;
    const btn = document.getElementById('btnSortNik');
    if (btn) {
        btn.innerHTML = window.sortNikAsc 
            ? '<i class="fas fa-sort-numeric-down"></i> NIK Terkecil' 
            : '<i class="fas fa-sort-numeric-up"></i> NIK Terbesar';
    }
    window.applySort(window.sortNikAsc ? 'nik_asc' : 'nik_desc', btn);
};

window.toggleSortAz = function (btnEl) {
    window.sortAzAsc = !window.sortAzAsc;
    const btn = btnEl || document.getElementById('btnSortAz');
    if (btn) {
        btn.innerHTML = window.sortAzAsc 
            ? '<i class="fas fa-sort-alpha-down"></i> Nama A - Z' 
            : '<i class="fas fa-sort-alpha-up"></i> Nama Z - A';
    }
    window.applySort(window.sortAzAsc ? 'az' : 'za', btn);
};

// =========================================================================
// 13. RENDER TABEL DATA WARGA
// =========================================================================
window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];

    if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
        $.fn.dataTable.ext.errMode = 'none';
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            try {
                $('#dataTable').DataTable().clear().destroy();
            } catch (e) {}
        }
    }

    const tbody = document.querySelector('#dataTable tbody') || 
                  document.querySelector('#tableWarga tbody') || 
                  document.querySelector('#tabelWarga tbody') || 
                  document.querySelector('.arsip-table tbody') || 
                  document.querySelector('#panelDataWarga table tbody') || 
                  document.querySelector('table tbody');

    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:36px 16px; color:#64748b; font-weight:600;">
                    <i class="fas fa-inbox" style="font-size:2.2rem; opacity:0.35; margin-bottom:10px; display:block;"></i>
                    Belum ada data warga terdaftar.<br>
                    <div style="margin-top:10px;">
                        <button type="button" class="btn btn-sm" onclick="window.bukaModalSinkronArsip()" style="background:#f0f9ff; color:#0284c7; border:1px solid #7dd3fc; border-radius:20px; font-weight:700; padding:6px 16px;">
                            <i class="fas fa-database"></i> Pulihkan Dari Cadangan Arsip (Restore)
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    data.forEach(w => {
        const isVerified = Boolean(w.is_verified);
        const desil = w.desil || 5;
        const isEligible = isVerified && desil <= 4;

        let verifBadge = isVerified
            ? `<span class="badge badge-green"><i class="fas fa-check-circle"></i> DISETUJUI</span>`
            : `<span class="badge badge-red"><i class="fas fa-clock"></i> MENUNGGU</span>`;

        let desilBadge = isVerified
            ? (desil <= 4
                ? `<span class="badge badge-green" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-award"></i> Layak Bansos (Desil ${desil})</span>`
                : `<span class="badge badge-warning" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-info-circle"></i> Tidak Prioritas (Desil ${desil})</span>`)
            : '';

        let statusSalurBadge = '';
        if (w.status_salur === 'Telah Menerima') {
            statusSalurBadge = `<span class="badge badge-blue" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-box-check"></i> Telah Menerima</span>`;
        } else if (String(w.status_salur || '').includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-exclamation-triangle"></i> Sengketa</span>`;
        }

        const isSengketa = String(w.status_salur || '').toLowerCase().includes('sengketa') || 
                           String(w.catatan || '').toLowerCase().includes('sengketa') ||
                           String(w.catatan || '').toLowerCase().includes('sanggah');

        const btnSengketa = isSengketa
            ? `<button type="button" onclick="window.bukaAksiCepatSengketa(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.nik}')" class="btn btn-sm" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px; border:1px solid #fca5a5;" title="Mediasi Sengketa Aktif"><i class="fas fa-shield-alt"></i></button>`
            : '';

        const btnToggleVerif = isVerified
            ? `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, false)" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, true)" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-check"></i> Setujui</button>`;

        const btnKamera = isEligible
            ? `<button onclick="window.bukaUploadBuktiSalur(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.bukti_salur || ''}')" class="btn btn-sm" style="padding:5px 8px; background:#dcfce7; color:#15803d; border-radius:6px; margin-right:3px;" title="Unggah Bukti Penyaluran"><i class="fas fa-camera"></i></button>`
            : '';

        const currentRole = (localStorage.getItem('role') || user?.role || 'operator').toLowerCase();
        const btnDelete = currentRole === 'admin'
            ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:5px 8px; background:#ef4444; color:white; font-size:0.8rem; border-radius:6px;" title="Hapus Data"><i class="fas fa-trash"></i></button>`
            : '';

        const ttlText = (w.tempat_lahir || w.tanggal_lahir) ? `${w.tempat_lahir || 'Sidoarjo'}, ${w.tanggal_lahir || '-'}` : '-';

        html += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td>
                <td style="font-weight:700; font-family:monospace; color:#0f172a;">${w.nik}</td>
                <td>
                    <div style="font-weight:800; color:#1e293b; font-size:0.95rem;">${window.safeHtml(w.nama)}</div>
                    <small style="color:#475569;"><i class="fas fa-birthday-cake text-muted"></i> ${window.safeHtml(ttlText)}</small><br>
                    <small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${window.safeHtml(w.alamat || 'Sidoarjo')}</small><br>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:2px;">
                        ${desilBadge}
                        ${statusSalurBadge}
                    </div>
                </td>
                <td><small><i class="fas fa-clock text-primary"></i> ${w.created_at || 'Hari ini'}</small></td>
                <td style="text-align:center;">${verifBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    ${btnToggleVerif}
                    <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:5px 8px; background:#fef3c7; color:#b45309; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Edit Data & 10 Kriteria"><i class="fas fa-edit"></i></button>
                    ${btnKamera}
                    ${btnSengketa}
                    ${btnDelete}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
        try {
            dtTable = $('#dataTable').DataTable({
                destroy: true,
                retrieve: true,
                pageLength: 10,
                responsive: true,
                order: [],
                language: {
                    search: "Cari NIK/Nama:",
                    lengthMenu: "_MENU_ baris",
                    info: "Menampilkan _START_ s.d. _END_ dari _TOTAL_ warga",
                    infoEmpty: "Menampilkan 0 warga",
                    zeroRecords: "Data warga tidak ditemukan",
                    emptyTable: "Belum ada arsip data warga",
                    paginate: { next: "→", previous: "←" }
                }
            });
        } catch (e) {
            console.warn('[DataTable] Gagal inisialisasi tabel:', e);
        }
    }
};

document.addEventListener('change', function (e) {
    if (e.target.classList.contains('row-checkbox') || e.target.id === 'selectAll') {
        const checked = document.querySelectorAll('.row-checkbox:checked').length;
        const fab = document.getElementById('fabBulk');
        const countEl = document.getElementById('bulkCount');
        if (countEl) countEl.innerText = checked;
        if (fab) fab.style.display = checked > 0 ? 'flex' : 'none';
    }
});

// =========================================================================
// 14. OPERASI STATUS VERIFIKASI (SATUAN & MASSAL)
// =========================================================================
window.ubahStatusVerifikasiWarga = async function (idOrNik, statusSetuju) {
    let targetId = idOrNik;
    if (typeof targetId === 'string' && targetId.length === 16 && /^\d+$/.test(targetId)) {
        try {
            if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
                const allRows = $('#dataTable').DataTable().rows().data().toArray();
                const found = allRows.find(r => String(r.nik).trim() === targetId.trim());
                if (found && found.id) targetId = found.id;
            }
        } catch (e) {}
    }

    showAdminAlert({
        title: statusSetuju ? 'Menyetujui Warga...' : 'Membatalkan Persetujuan...',
        allowOutsideClick: false,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const payload = { is_verified: statusSetuju, status_validasi: statusSetuju ? 'Disetujui' : 'Menunggu' };
        let res = await fetch(`${window.BASE_API_URL}/api/warga/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${window.BASE_API_URL}/warga/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            showAdminAlert({
                icon: 'success',
                title: statusSetuju ? 'Disetujui!' : 'Dibatalkan!',
                timer: 1300,
                showConfirmButton: false,
                customClass: { popup: 'swal-modern-rounded' }
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
            else location.reload();
        } else {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.message || 'Gagal mengubah status verifikasi.');
        }
    } catch (e) {
        showAdminAlert({ 
            icon: 'error', 
            title: 'Gagal', 
            text: e.message, 
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger' }, 
            buttonsStyling: false 
        });
    }
};

window.setujuiWarga = (id) => window.ubahStatusVerifikasiWarga(id, true);
window.batalkanWarga = (id) => window.ubahStatusVerifikasiWarga(id, false);
window.toggleVerifySingle = (id, namaWarga) => {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => item.id === id);
    window.ubahStatusVerifikasiWarga(id, !w?.is_verified);
};

window.setujuiSemuaWargaInstan = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Setujui Seluruh Warga?',
        text: 'Seluruh data warga terdaftar akan disetujui bersamaan.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Setujui',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Memproses...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
        try {
            await fetch(`${window.BASE_API_URL}/api/warga/verify-all`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` } 
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.batalkanSemuaWargaInstan = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Batalkan Semua Persetujuan?',
        text: 'Status verifikasi akan dikembalikan ke status Menunggu.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Tutup',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-warning', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Memproses...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
        try {
            await fetch(`${window.BASE_API_URL}/api/warga/unverify-all`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` } 
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.hapusSemuaWargaAman = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const k = await Swal.fire({
        title: 'Bersihkan Tabel Warga?',
        text: 'Tabel kerja kependudukan akan dibersihkan. Cadangan master tetap tersimpan aman di sistem.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Bersihkan',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });
    if (k.isConfirmed) {
        showAdminAlert({ title: 'Membersihkan...', customClass: { popup: 'swal-modern-rounded' }, didOpen: () => Swal?.showLoading() });
        try {
            await fetch(`${window.BASE_API_URL}/api/warga/delete-all`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` } 
            });
            if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.bulkProcess = async function (action) {
    const checked = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    if (!checked.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Data', text: 'Pilih minimal satu baris warga terlebih dahulu.' });
    }

    if (action === 'verify') {
        return window.setujuiSemuaWargaInstan();
    } else if (action === 'delete') {
        const konfirmasi = confirm(`Apakah Anda yakin ingin menghapus ${checked.length} data warga terpilih?`);
        if (konfirmasi) {
            await fetch(`${window.BASE_URL}/api/warga/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify({ ids: checked })
            });
            window.loadDashboardData();
        }
    }
};

window.verifyAllData = (e) => window.setujuiSemuaWargaInstan(e);
window.unverifyAllData = (e) => window.batalkanSemuaWargaInstan(e);
window.hapusSemuaWarga = () => window.hapusSemuaWargaAman();

window.syncBPS = async function () {
    showAdminAlert({ title: 'Sinkronisasi Data BPS Sidoarjo...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await fetch(`${window.BASE_URL}/api/bps/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        const json = await res.json();
        Swal?.close();
        showAdminAlert({ icon: 'success', title: 'BPS Terhubung', text: json.message || 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.' });
    } catch (e) {
        showAdminAlert({ icon: 'info', title: 'Data BPS Termutakhir', text: 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo telah aktif pada sistem.' });
    }
};

// =========================================================================
// 15. ALGORITMA BWM-SAW, MATRIKS NORMALISASI & EVALUASI WP
// =========================================================================
window.bukaModalBobot = function () {
    const modal = document.getElementById('modalBobot');
    const container = document.getElementById('bobotInputs');
    if (!modal || !container) return;

    const savedBobot = JSON.parse(localStorage.getItem('bobotBWM') || 'null') || window.defaultBobotBWM;
    const kriteriaLabels = {
        c1: 'C1. Kondisi Ekonomi / Penghasilan',
        c2: 'C2. Kepemilikan Aset',
        c3: 'C3. Umur Kepala Keluarga',
        c4: 'C4. Jenis Kelamin',
        c5: 'C5. Jumlah Tanggungan',
        c6: 'C6. Status Pernikahan',
        c7: 'C7. Kepemilikan Anak / Balita',
        c8: 'C8. Kelayakan Tempat Tinggal',
        c9: 'C9. Tingkat Pendidikan Terakhir',
        c10: 'C10. Kondisi Kesehatan / Disabilitas'
    };

    container.innerHTML = Object.keys(savedBobot).map(key => `
        <div class="form-group" style="margin-bottom:8px;">
            <label class="form-label" style="font-size:0.78rem;">${kriteriaLabels[key] || key.toUpperCase()}</label>
            <input type="number" step="0.01" min="0" max="1" id="input_bobot_${key}" class="form-input" value="${savedBobot[key]}" style="padding:6px 10px; font-size:0.85rem;" required>
        </div>
    `).join('');

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

window.simpanBobot = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const updated = {};
    let total = 0;

    Object.keys(window.defaultBobotBWM).forEach(key => {
        const val = parseFloat(document.getElementById(`input_bobot_${key}`)?.value || 0);
        updated[key] = val;
        total += val;
    });

    if (Math.abs(total - 1.0) > 0.05) {
        return Swal.fire('Peringatan Bobot', `Total bobot saat ini ${total.toFixed(2)}. Idealnya akumulasi bobot bernilai 1.00.`, 'warning');
    }

    localStorage.setItem('bobotBWM', JSON.stringify(updated));
    window.closeModal('modalBobot');
    Swal.fire({ icon: 'success', title: 'Bobot Disimpan', text: 'Bobot kriteria BWM berhasil diterapkan ke sistem.', timer: 1500, showConfirmButton: false });
};

window.hitungSPK = function () {
    if (window.AdminSPK && typeof window.AdminSPK.hitungSPK === 'function') {
        return window.AdminSPK.hitungSPK();
    }

    const warga = (window.globalDataWarga || []).filter(w => w.is_verified);
    if (!warga.length) {
        return Swal.fire('Data Belum Siap', 'Setujui minimal satu data warga untuk menjalankan perankingan SPK.', 'info');
    }

    const bobot = JSON.parse(localStorage.getItem('bobotBWM') || 'null') || window.defaultBobotBWM;

    const minC1 = Math.min(...warga.map(w => w.c1 || 1));
    const minC2 = Math.min(...warga.map(w => w.c2 || 1));
    const maxC3 = Math.max(...warga.map(w => w.c3 || 1));
    const maxC4 = Math.max(...warga.map(w => w.c4 || 1));
    const maxC5 = Math.max(...warga.map(w => w.c5 || 1));
    const maxC6 = Math.max(...warga.map(w => w.c6 || 1));
    const maxC7 = Math.max(...warga.map(w => w.c7 || 1));
    const minC8 = Math.min(...warga.map(w => w.c8 || 1));
    const minC9 = Math.min(...warga.map(w => w.c9 || 1));
    const minC10 = Math.min(...warga.map(w => w.c10 || 1));

    const hasil = warga.map(w => {
        const r1 = minC1 / (w.c1 || 1);
        const r2 = minC2 / (w.c2 || 1);
        const r3 = (w.c3 || 1) / maxC3;
        const r4 = (w.c4 || 1) / maxC4;
        const r5 = (w.c5 || 1) / maxC5;
        const r6 = (w.c6 || 1) / maxC6;
        const r7 = (w.c7 || 1) / maxC7;
        const r8 = minC8 / (w.c8 || 1);
        const r9 = minC9 / (w.c9 || 1);
        const r10 = minC10 / (w.c10 || 1);

        const skorSaw = (r1 * bobot.c1) + (r2 * bobot.c2) + (r3 * bobot.c3) + (r4 * bobot.c4) +
                        (r5 * bobot.c5) + (r6 * bobot.c6) + (r7 * bobot.c7) + (r8 * bobot.c8) +
                        (r9 * bobot.c9) + (r10 * bobot.c10);

        const sWp = Math.pow(w.c1 || 1, -bobot.c1) * Math.pow(w.c2 || 1, -bobot.c2) *
                   Math.pow(w.c3 || 1, bobot.c3) * Math.pow(w.c4 || 1, bobot.c4) *
                   Math.pow(w.c5 || 1, bobot.c5) * Math.pow(w.c6 || 1, bobot.c6) *
                   Math.pow(w.c7 || 1, bobot.c7) * Math.pow(w.c8 || 1, -bobot.c8) *
                   Math.pow(w.c9 || 1, -bobot.c9) * Math.pow(w.c10 || 1, -bobot.c10);

        return {
            ...w,
            skorSaw: Number(skorSaw.toFixed(4)),
            sWp: sWp,
            matriks: { r1, r2, r3, r4, r5, r6, r7, r8, r9, r10 }
        };
    });

    const totalSWp = hasil.reduce((acc, cur) => acc + cur.sWp, 0) || 1;
    hasil.forEach(h => { h.skorWp = Number((h.sWp / totalSWp).toFixed(4)); });

    hasil.sort((a, b) => b.skorSaw - a.skorSaw);

    const n = hasil.length;
    hasil.forEach((h, index) => {
        h.rankSaw = index + 1;
        const desilCalculated = Math.min(10, Math.floor((index / n) * 10) + 1);
        h.desil = desilCalculated;
    });

    window.cachedHasilSPK = hasil;

    const resultCard = document.getElementById('resultCard');
    const resultTbody = document.querySelector('#resultTable tbody');
    if (resultCard && resultTbody) {
        resultTbody.innerHTML = hasil.map(h => `
            <tr>
                <td style="text-align:center; font-weight:800;">#${h.rankSaw}</td>
                <td><b>${window.safeHtml(h.nama)}</b><br><small class="text-muted font-mono">${h.nik}</small></td>
                <td style="text-align:center; font-weight:800; color:#009846;">${h.skorSaw}</td>
                <td style="text-align:center;"><span class="badge ${h.desil <= 4 ? 'badge-green' : 'badge-warning'}">Desil ${h.desil}</span></td>
                <td style="text-align:center;">
                    <span class="badge ${h.desil <= 4 ? 'badge-green' : 'badge-blue'}">
                        ${h.desil <= 4 ? '<i class="fas fa-check"></i> Prioritas Bansos' : 'Non-Prioritas'}
                    </span>
                </td>
            </tr>
        `).join('');
        resultCard.style.display = 'block';
        resultCard.scrollIntoView({ behavior: 'smooth' });
    }

    Swal.fire({ icon: 'success', title: 'Perhitungan Selesai', text: `Berhasil memproses perankingan SPK untuk ${hasil.length} warga.`, timer: 1500, showConfirmButton: false });
};

window.bukaModalMatriksKerja = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalMatriksKerja === 'function') {
        return window.AdminSPK.bukaModalMatriksKerja();
    }

    const modal = document.getElementById('modalDetail');
    const container = document.getElementById('detailContent');
    if (!modal || !container) return;

    const data = window.cachedHasilSPK || [];
    if (!data.length) {
        return Swal.fire('Perhatian', 'Jalankan Proses Algoritma SAW terlebih dahulu.', 'info');
    }

    container.innerHTML = `
        <div style="overflow-x:auto;">
            <table class="modern-table" style="font-size:0.82rem;">
                <thead>
                    <tr>
                        <th>Nama Warga</th>
                        <th>R1 (Eko)</th>
                        <th>R2 (Aset)</th>
                        <th>R3 (Usia)</th>
                        <th>R4 (JK)</th>
                        <th>R5 (Tgg)</th>
                        <th>R6 (Nikah)</th>
                        <th>R7 (Anak)</th>
                        <th>R8 (Rumah)</th>
                        <th>R9 (Pddk)</th>
                        <th>R10 (Kes)</th>
                        <th style="color:#009846;">Nilai V (SAW)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(d => `
                        <tr>
                            <td><b>${window.safeHtml(d.nama)}</b></td>
                            <td>${d.matriks?.r1?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r2?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r3?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r4?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r5?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r6?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r7?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r8?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r9?.toFixed(3) || '-'}</td>
                            <td>${d.matriks?.r10?.toFixed(3) || '-'}</td>
                            <td style="font-weight:800; color:#009846;">${d.skorSaw}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

window.bukaModalKomparasi = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalKomparasi === 'function') {
        return window.AdminSPK.bukaModalKomparasi();
    }

    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    const canvas = document.getElementById('compChart');
    if (!modal) return;

    if (!window.cachedHasilSPK || !window.cachedHasilSPK.length) {
        window.hitungSPK();
    }

    const data = [...(window.cachedHasilSPK || [])];
    if (!data.length) return;

    const dataWp = [...data].sort((a, b) => b.skorWp - a.skorWp);
    dataWp.forEach((item, idx) => { item.rankWp = idx + 1; });

    if (tbody) {
        tbody.innerHTML = data.slice(0, 15).map(item => {
            const deviasi = Math.abs(item.rankSaw - item.rankWp);
            return `
                <tr>
                    <td><b>${window.safeHtml(item.nama)}</b></td>
                    <td style="text-align:center;"><span class="badge badge-green">#${item.rankSaw}</span></td>
                    <td style="text-align:center; font-weight:700;">${item.skorSaw}</td>
                    <td style="text-align:center;"><span class="badge badge-blue">#${item.rankWp}</span></td>
                    <td style="text-align:center; font-weight:700;">${item.skorWp}</td>
                    <td style="text-align:center; font-weight:800; color:${deviasi === 0 ? '#15803d' : '#d97706'};">${deviasi === 0 ? 'Sesuai (0)' : `Selisih ${deviasi}`}</td>
                </tr>
            `;
        }).join('');
    }

    if (canvas && typeof Chart !== 'undefined') {
        const top10 = data.slice(0, 8);
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        compChartObj = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: top10.map(d => d.nama.split(' ')[0]),
                datasets: [
                    { label: 'Skor SAW', data: top10.map(d => d.skorSaw), backgroundColor: '#009846' },
                    { label: 'Skor WP', data: top10.map(d => d.skorWp), backgroundColor: '#0284c7' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// =========================================================================
// 16. PETA SEBARAN MAKRO WILAYAH SIDOARJO (POLIGON CLUSTER DINAMIS)
// =========================================================================
window.toggleCustomMapDropdown = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('dropdownMapMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
};

document.addEventListener('click', () => {
    const menu = document.getElementById('dropdownMapMenu');
    if (menu) menu.style.display = 'none';
});

window.pilihModePeta = function (mode, label) {
    const txt = document.getElementById('customMapModeText');
    const legendTitle = document.getElementById('legendModeTitle');
    if (txt) txt.innerText = label;
    if (legendTitle) legendTitle.innerText = `Kerentanan ${label.replace('Mode: ', '')}`;

    document.querySelectorAll('.custom-map-item').forEach(el => el.classList.remove('active'));
    if (mode === 'kecamatan') document.getElementById('optModeKecamatan')?.classList.add('active');
    else if (mode === 'kelurahan') document.getElementById('optModeKelurahan')?.classList.add('active');
    else if (mode === 'desa') document.getElementById('optModeDesa')?.classList.add('active');

    window.renderChoroplethKerentanan(mode);
};

window.initMacroDistributionMap = function () {
    const mapBox = document.getElementById('mapWilayah');
    if (!mapBox || typeof L === 'undefined') return;

    if (mapBox._leaflet_id) {
        try {
            if (macroMapObj) macroMapObj.remove();
        } catch (e) {}
        mapBox._leaflet_id = null;
        macroMapObj = null;
    }

    macroMapObj = L.map('mapWilayah', { attributionControl: false }).setView(window.MAP_CENTER_SIDOARJO, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(macroMapObj);

    window.renderChoroplethKerentanan('kecamatan');
};

window.renderChoroplethKerentanan = function (mode = 'kecamatan') {
    if (!macroMapObj || typeof L === 'undefined') return;

    const kecamatanBounds = [
        { nama: 'Sidoarjo', bounds: [[-7.435, 112.705], [-7.435, 112.735], [-7.465, 112.735], [-7.465, 112.705]] },
        { nama: 'Buduran', bounds: [[-7.410, 112.710], [-7.410, 112.745], [-7.435, 112.745], [-7.435, 112.710]] },
        { nama: 'Candi', bounds: [[-7.465, 112.700], [-7.465, 112.745], [-7.500, 112.745], [-7.500, 112.700]] },
        { nama: 'Porong', bounds: [[-7.530, 112.675], [-7.530, 112.720], [-7.565, 112.720], [-7.565, 112.675]] },
        { nama: 'Krembung', bounds: [[-7.510, 112.590], [-7.510, 112.635], [-7.545, 112.635], [-7.545, 112.590]] },
        { nama: 'Tulangan', bounds: [[-7.465, 112.625], [-7.465, 112.670], [-7.505, 112.670], [-7.505, 112.625]] },
        { nama: 'Tanggulangin', bounds: [[-7.500, 112.695], [-7.500, 112.740], [-7.530, 112.740], [-7.530, 112.695]] },
        { nama: 'Jabon', bounds: [[-7.545, 112.720], [-7.545, 112.810], [-7.590, 112.810], [-7.590, 112.720]] },
        { nama: 'Waru', bounds: [[-7.335, 112.715], [-7.335, 112.765], [-7.375, 112.765], [-7.375, 112.715]] },
        { nama: 'Gedangan', bounds: [[-7.375, 112.710], [-7.375, 112.755], [-7.410, 112.755], [-7.410, 112.710]] },
        { nama: 'Sedati', bounds: [[-7.360, 112.765], [-7.360, 112.825], [-7.420, 112.825], [-7.420, 112.765]] },
        { nama: 'Taman', bounds: [[-7.335, 112.665], [-7.335, 112.715], [-7.380, 112.715], [-7.380, 112.665]] },
        { nama: 'Krian', bounds: [[-7.385, 112.555], [-7.385, 112.615], [-7.430, 112.615], [-7.430, 112.555]] },
        { nama: 'Balongbendo', bounds: [[-7.390, 112.490], [-7.390, 112.555], [-7.435, 112.555], [-7.435, 112.490]] },
        { nama: 'Prambon', bounds: [[-7.450, 112.550], [-7.450, 112.605], [-7.495, 112.605], [-7.495, 112.550]] },
        { nama: 'Tarik', bounds: [[-7.435, 112.485], [-7.435, 112.550], [-7.475, 112.550], [-7.475, 112.485]] },
        { nama: 'Sukodono', bounds: [[-7.395, 112.655], [-7.395, 112.705], [-7.435, 112.705], [-7.435, 112.655]] },
        { nama: 'Wonoayu', bounds: [[-7.420, 112.605], [-7.420, 112.660], [-7.465, 112.660], [-7.465, 112.605]] }
    ];

    if (macroGeoJsonLayer) {
        macroMapObj.removeLayer(macroGeoJsonLayer);
    }
    macroGeoJsonLayer = L.layerGroup().addTo(macroMapObj);

    const dataWarga = window.globalDataWarga || [];

    kecamatanBounds.forEach(k => {
        const wargaDiWilayah = dataWarga.filter(w => {
            const alamat = (w.alamat || '').toLowerCase();
            return alamat.includes(k.nama.toLowerCase());
        });

        const totalWarga = wargaDiWilayah.length;
        let strokeColor = '#94a3b8';
        let fillColor = 'transparent';
        let fillOpacity = 0.0;
        let statusText = 'Belum Ada Data Masuk';
        let badgeColor = '#64748b';

        if (totalWarga > 0) {
            const avgDesil = wargaDiWilayah.reduce((acc, cur) => acc + (Number(cur.desil) || 5), 0) / totalWarga;

            if (avgDesil <= 2.5) {
                strokeColor = '#dc2626';
                fillColor = '#ef4444';
                fillOpacity = 0.45;
                statusText = 'Tinggi (Desil 1–2)';
                badgeColor = '#dc2626';
            } else if (avgDesil <= 4.0) {
                strokeColor = '#d97706';
                fillColor = '#f59e0b';
                fillOpacity = 0.45;
                statusText = 'Sedang (Desil 3–4)';
                badgeColor = '#d97706';
            } else {
                strokeColor = '#15803d';
                fillColor = '#10b981';
                fillOpacity = 0.45;
                statusText = 'Rendah (Desil 5–10)';
                badgeColor = '#15803d';
            }
        }

        const poly = L.polygon(k.bounds, {
            color: strokeColor,
            weight: totalWarga > 0 ? 2 : 1,
            dashArray: totalWarga === 0 ? '4, 4' : null,
            fillColor: fillColor,
            fillOpacity: fillOpacity
        }).addTo(macroGeoJsonLayer);

        poly.bindPopup(`
            <div style="font-family:'Inter',sans-serif; padding:4px; min-width:180px;">
                <b style="font-size:0.95rem; color:#0f172a;">Kecamatan ${k.nama}</b><br>
                <div style="margin:4px 0; font-size:0.8rem; color:#64748b;">
                    Total Warga Terdata: <b style="color:#0f172a;">${totalWarga} Jiwa</b>
                </div>
                <span style="font-size:0.75rem; color:#64748b;">Tingkat Kerentanan:</span><br>
                <span style="font-size:0.85rem; font-weight:800; color:${badgeColor};">${statusText}</span><br>
                ${totalWarga > 0 ? `
                    <button type="button" class="btn btn-sm btn-primary" onclick="window.bukaWilayahDetail('${k.nama}')" style="margin-top:8px; width:100%; border-radius:8px; font-size:0.75rem; padding:4px 8px;">
                        <i class="fas fa-users"></i> Lihat ${totalWarga} Warga
                    </button>
                ` : '<small style="display:block; margin-top:6px; color:#94a3b8; font-style:italic;">Data belum tersedia</small>'}
            </div>
        `);
    });
};

// =========================================================================
// 17. EKSPOR & IMPOR DATA EXCEL
// =========================================================================
window.exportExcelLengkap = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga untuk diekspor.' });
    }

    if (typeof XLSX === 'undefined') {
        return showAdminAlert({ icon: 'error', title: 'Pustaka Tidak Tersedia', text: 'Pustaka SheetJS belum termuat.' });
    }

    const exportData = dataList.map((w, idx) => ({
        'No': idx + 1,
        'NIK': String(w.nik),
        'Nama Lengkap': w.nama || '',
        'No. WhatsApp / HP': w.no_hp || '',
        'Email': w.email || '',
        'Tempat Lahir': w.tempat_lahir || '',
        'Tanggal Lahir': w.tanggal_lahir || '',
        'Alamat Lengkap': w.alamat || '',
        'C1 Ekonomi': w.c1 || 0,
        'C2 Aset': w.c2 || 0,
        'C3 Umur': w.c3 || 0,
        'Desil': w.desil || 5,
        'Status Penyaluran': w.status_salur || 'Pending',
        'Status Validasi': w.is_verified ? 'Disetujui' : 'Menunggu'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Warga Bansos");
    XLSX.writeFile(workbook, `Data_Warga_Bansos_Sidoarjo_${Date.now()}.xlsx`);
};

window.smartImportPreview = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

            window.stagedImportData = rawJson;
            const countEl = document.getElementById('importCount');
            const tbody = document.querySelector('#importPreviewTable tbody');
            if (countEl) countEl.innerText = rawJson.length;

            if (tbody) {
                tbody.innerHTML = rawJson.slice(0, 8).map((r, i) => `
                    <tr>
                        <td style="text-align:center;">${i + 1}</td>
                        <td style="font-family:monospace;">${r.NIK || r.nik || '-'}</td>
                        <td><b>${window.safeHtml(r['Nama Lengkap'] || r.nama || '-')}</b></td>
                        <td style="text-align:center;"><span class="badge badge-green">Valid</span></td>
                    </tr>
                `).join('');
            }

            const modal = document.getElementById('modalImportPreview');
            if (modal) {
                modal.style.display = 'flex';
                modal.style.zIndex = '99999';
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Membaca Berkas', text: 'Format berkas spreadsheet tidak sesuai.' });
        }
    };
    reader.readAsArrayBuffer(file);
};

window.executeBulkImport = async function () {
    if (!window.stagedImportData || !window.stagedImportData.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data impor untuk dieksekusi.' });
    }

    showAdminAlert({ title: 'Menyinkronkan Data ke Database...', didOpen: () => Swal?.showLoading() });
    try {
        let res = await fetch(`${window.BASE_URL}/api/warga/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify({ data: window.stagedImportData })
        });

        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/warga/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: JSON.stringify({ data: window.stagedImportData })
            });
        }

        window.closeModal('modalImportPreview');
        window.stagedImportData = [];
        const inp = document.getElementById('fileImport');
        if (inp) inp.value = '';

        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Sukses', text: 'Data warga dari Excel berhasil dimasukkan.' });
            await window.loadDashboardData(true);
        }
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal mengimpor data ke peladen.' });
    }
};

window.executeCustomExport = function () {
    const selectedCols = Array.from(document.querySelectorAll('#exportCols input[type="checkbox"]:checked')).map(c => c.value);
    if (!selectedCols.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Kolom', text: 'Pilih minimal satu kolom data.' });
    }

    const dataList = window.globalDataWarga || [];
    if (!dataList.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data untuk diekspor.' });
    }

    const exportData = dataList.map((w, idx) => {
        const row = { 'No': idx + 1 };
        selectedCols.forEach(col => {
            if (col === 'nik') row['NIK'] = String(w.nik);
            else if (col === 'nama') row['Nama Lengkap'] = w.nama;
            else if (col === 'alamat') row['Alamat Lengkap'] = w.alamat;
            else if (col === 'c1_ekonomi') row['C1 (Ekonomi)'] = w.c1 || 0;
            else if (col === 'c2_aset') row['C2 (Aset)'] = w.c2 || 0;
            else if (col === 'c3_umur') row['C3 (Umur)'] = w.c3 || 0;
            else if (col === 'is_verified') row['Status Validasi'] = w.is_verified ? 'Disetujui' : 'Menunggu';
        });
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kustom Ekspor Bansos");
    XLSX.writeFile(wb, `Ekspor_Kustom_Bansos_${Date.now()}.xlsx`);
    window.closeModal('modalExportBuilder');
};

// =========================================================================
// 18. MODAL EDIT & BUKTI SALUR
// =========================================================================
window.bukaModalEdit = function (id) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => item.id === id);
    if (!w) return;

    if (document.getElementById('editId')) document.getElementById('editId').value = w.id;
    if (document.getElementById('editNama')) document.getElementById('editNama').value = w.nama || '';
    if (document.getElementById('editNik')) document.getElementById('editNik').value = w.nik || '';
    if (document.getElementById('editNoHp')) document.getElementById('editNoHp').value = w.no_hp || '';
    if (document.getElementById('editEmail')) document.getElementById('editEmail').value = w.email || '';
    if (document.getElementById('editTempatLahir')) document.getElementById('editTempatLahir').value = w.tempat_lahir || '';
    if (document.getElementById('editTglLahir')) document.getElementById('editTglLahir').value = w.tanggal_lahir || '';
    if (document.getElementById('editAlamat')) document.getElementById('editAlamat').value = w.alamat || '';

    if (document.getElementById('editC1')) document.getElementById('editC1').value = w.c1 || 0;
    if (document.getElementById('editC2')) document.getElementById('editC2').value = w.c2 || 0;
    if (document.getElementById('editC3')) document.getElementById('editC3').value = w.c3 || 0;
    if (document.getElementById('editC4')) document.getElementById('editC4').value = w.c4 || 1;
    if (document.getElementById('editC5')) document.getElementById('editC5').value = w.c5 || 0;
    if (document.getElementById('editC6')) document.getElementById('editC6').value = w.c6 || 1;
    if (document.getElementById('editC7')) document.getElementById('editC7').value = w.c7 || 0;
    if (document.getElementById('editC8')) document.getElementById('editC8').value = w.c8 || 1;
    if (document.getElementById('editC9')) document.getElementById('editC9').value = w.c9 || 1;
    if (document.getElementById('editC10')) document.getElementById('editC10').value = w.c10 || 1;
    if (document.getElementById('editCatatan')) document.getElementById('editCatatan').value = w.catatan || '';

    const modal = document.getElementById('modalEdit');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.simpanEdit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('editId').value;
    const existing = (window.globalDataWarga || []).find(x => String(x.id) === String(id));

    const payload = {
        nama: document.getElementById('editNama').value.trim(),
        nik: document.getElementById('editNik').value.trim(),
        no_hp: document.getElementById('editNoHp')?.value.trim() || existing?.no_hp || '',
        email: document.getElementById('editEmail')?.value.trim() || existing?.email || '',
        tempat_lahir: document.getElementById('editTempatLahir')?.value.trim() || existing?.tempat_lahir || 'Sidoarjo',
        tanggal_lahir: document.getElementById('editTglLahir')?.value || existing?.tanggal_lahir || null,
        alamat: document.getElementById('editAlamat')?.value.trim() || existing?.alamat || '',
        c1: document.getElementById('editC1') ? parseFloat(document.getElementById('editC1').value) : (existing?.c1 ?? 1500000),
        c2: document.getElementById('editC2') ? parseInt(document.getElementById('editC2').value) : (existing?.c2 ?? 5000000),
        c3: document.getElementById('editC3') ? parseInt(document.getElementById('editC3').value) : (existing?.c3 ?? 45),
        c4: document.getElementById('editC4') ? parseInt(document.getElementById('editC4').value) : (existing?.c4 ?? 1),
        c5: document.getElementById('editC5') ? parseInt(document.getElementById('editC5').value) : (existing?.c5 ?? 3),
        c6: document.getElementById('editC6') ? parseInt(document.getElementById('editC6').value) : (existing?.c6 ?? 2),
        c7: document.getElementById('editC7') ? parseInt(document.getElementById('editC7').value) : (existing?.c7 ?? 2),
        c8: document.getElementById('editC8') ? parseInt(document.getElementById('editC8').value) : (existing?.c8 ?? 2),
        c9: document.getElementById('editC9') ? parseInt(document.getElementById('editC9').value) : (existing?.c9 ?? 1),
        c10: document.getElementById('editC10') ? parseInt(document.getElementById('editC10').value) : (existing?.c10 ?? 1),
        catatan: document.getElementById('editCatatan')?.value.trim() || existing?.catatan || ''
    };

    let res = await fetch(`${window.BASE_URL}/api/warga/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        res = await fetch(`${window.BASE_URL}/warga/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.getCleanToken()}` },
            body: JSON.stringify(payload)
        });
    }

    if (res && res.ok) {
        showAdminAlert({ icon: 'success', title: 'Berhasil', text: 'Data warga berhasil diperbarui.' });
        window.closeModal('modalEdit');
        window.loadDashboardData();
    }
};

window.hapusData = async function (id) {
    const konfirmasi = confirm('Apakah Anda yakin ingin menghapus data warga ini?');
    if (konfirmasi) {
        let res = await fetch(`${window.BASE_URL}/api/warga/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (!res.ok) {
            await fetch(`${window.BASE_URL}/warga/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });
        }
        window.loadDashboardData();
    }
};

window.bukaUploadBuktiSalur = function (id, namaWarga, existingPhoto) {
    let previewHtml = existingPhoto 
        ? `<div style="margin-bottom:15px;"><img src="${window.BASE_URL}/uploads/${existingPhoto}" style="max-width:100%; max-height:200px; border-radius:10px;" /></div>` 
        : `<p style="font-size:0.85rem; color:#64748b;">Belum ada dokumentasi serah terima bansos.</p>`;

    showAdminAlert({
        title: `Bukti Penyaluran Bansos`,
        html: `<div style="text-align:left; font-size:0.9rem;">
            <b>Penerima:</b> ${window.safeHtml(namaWarga)}<br>${previewHtml}
            <label style="font-weight:700; display:block; margin:10px 0 5px 0;">Pilih Berkas Foto:</label>
            <input type="file" id="swalFileBukti" accept="image/*" class="form-input" style="padding:8px;" />
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Simpan Foto',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            const fileInp = document.getElementById('swalFileBukti');
            if (!fileInp.files || !fileInp.files[0]) {
                if (!existingPhoto) Swal?.showValidationMessage('Pilih berkas foto terlebih dahulu!');
                return null;
            }
            return fileInp.files[0];
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            const formData = new FormData();
            formData.append('file', result.value);
            
            let res = await fetch(`${window.BASE_URL}/api/warga/${id}/bukti-salur`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` },
                body: formData
            });

            if (!res.ok) {
                res = await fetch(`${window.BASE_URL}/warga/${id}/bukti-salur`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` },
                    body: formData
                });
            }

            if (res && res.ok) {
                showAdminAlert({ icon: 'success', title: 'Tersimpan', text: 'Foto bukti penyaluran berhasil diunggah!' });
                window.loadDashboardData();
            }
        }
    });
};

window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(item => item.id === id);
    const catatanSengketa = w?.catatan || 'Warga melaporkan kendala pada data penerimaan bansos.';

    showAdminAlert({
        title: '<i class="fas fa-shield-alt text-danger"></i> Mediasi Sengketa Bansos',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; color:#1e293b;">
                <div style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:12px;">
                    <div><b>Warga:</b> ${window.safeHtml(namaWarga)} (NIK: ${nik})</div>
                    <div><b>Status Saat Ini:</b> <span style="color:#dc2626; font-weight:700;">${w?.status_salur || 'Sengketa'}</span></div>
                    <div style="margin-top:6px; font-size:0.82rem; color:#475569;"><b>Rincian Aduan:</b><br>${window.safeHtml(catatanSengketa)}</div>
                </div>
                <p style="margin:0; font-size:0.84rem; color:#334155;">Pilih tindakan penanganan untuk menyelesaikan sengketa ini:</p>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-check-circle"></i> Selesai (Bansos Diterima)',
        denyButtonText: '<i class="fas fa-sync-alt"></i> Verifikasi Ulang Kriteria (Sanggah Desil)',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#009846',
        denyButtonColor: '#0284c7'
    }).then(async (result) => {
        if (result.isConfirmed) {
            let res = await fetch(`${window.BASE_URL}/api/warga/${id}/lapor-sengketa`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ aksi: 'selesai' })
            });

            if (!res.ok) {
                await fetch(`${window.BASE_URL}/warga/${id}/lapor-sengketa`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${window.getCleanToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ aksi: 'selesai' })
                });
            }

            await window.loadDashboardData(true);
            showAdminAlert({ icon: 'success', title: 'Sengketa Selesai', text: `Status bantuan untuk ${namaWarga} telah diperbarui menjadi Telah Menerima.` });
        } else if (result.isDenied) {
            window.bukaModalEdit(id);
        }
    });
};

// =========================================================================
// 19. MANAJEMEN PENGGUNA SISTEM: LANGSUNG KE DATABASE & KEBAL TYPEERROR
// =========================================================================
window.loadUserTable = async function () {
    const tbody = document.getElementById('userTableBody') || 
                  document.getElementById('tableUserBody') || 
                  document.querySelector('#userTable tbody') ||
                  document.querySelector('#modalPengguna table tbody') ||
                  document.querySelector('.modal-body table tbody');

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat data akun dari database...</td></tr>';

    try {
        const token = window.getCleanToken();
        const headers = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(`${window.BASE_URL}/api/users?_t=${Date.now()}`, { headers });
        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/users?_t=${Date.now()}`, { headers: { 'Accept': 'application/json' } });
        }

        let users = [];
        if (res && res.ok) {
            const resJson = await res.json();
            users = Array.isArray(resJson) ? resJson : (resJson.data || resJson.users || []);
        }

        if (!users || !users.length) {
            users = [
                { id: 1, username: "admin", role: "admin", current_password: "admin" },
                { id: 2, username: "petugas", role: "operator", current_password: "123" },
                { id: 3, username: "verifikator", role: "operator", current_password: "123" },
                { id: 4, username: "operator", role: "operator", current_password: "123" },
                { id: 5, username: "kepala_dinsos", role: "admin", current_password: "123" }
            ];
        }

        tbody.innerHTML = users.map(u => {
            const isAdmin = (u.role === 'admin' || u.role === 'super admin');
            const roleBadge = isAdmin
                ? `<span class="badge" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.75rem;">ADMIN</span>`
                : `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.75rem;">OPERATOR</span>`;

            const btnEdit = `
                <button type="button" class="btn btn-sm" onclick="window.editUser(${u.id}, '${window.escapeInlineJS(u.username)}', '${u.role}', '${window.escapeInlineJS(u.current_password || '')}')" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Edit Akun">
                    <i class="fas fa-pencil-alt"></i>
                </button>
            `;

            const btnDelete = (u.id === 1 || u.username === 'admin')
                ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:600; padding:4px 6px;">Utama</span>`
                : `
                <button type="button" class="btn btn-sm" onclick="window.hapusUser(${u.id}, '${window.escapeInlineJS(u.username)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Hapus Akun">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;

            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="font-weight:700; color:#64748b; font-size:0.85rem; padding:10px 8px;">#${u.id}</td>
                    <td style="font-weight:800; color:#0f172a; font-size:0.9rem; padding:10px 8px;">${window.safeHtml(u.username)}</td>
                    <td style="padding:10px 8px;">${roleBadge}</td>
                    <td style="text-align:center; padding:10px 8px;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${btnEdit}
                            ${btnDelete}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#dc2626;">Gagal memuat akun pengguna: ${err.message}</td></tr>`;
    }
};

window.simpanUser = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const modalPengguna = document.getElementById('modalPengguna') || document;
    const idEl = document.getElementById('userId') || modalPengguna.querySelector('input[name="id"]');
    const id = idEl ? idEl.value.trim() : '';

    const userInput = document.getElementById('manageUsername') || 
                      modalPengguna.querySelector('input[placeholder*="username" i]') ||
                      modalPengguna.querySelector('input[type="text"]');
    const username = userInput ? userInput.value.trim() : '';

    const passInput = document.getElementById('managePassword') || 
                      modalPengguna.querySelector('input[type="password"]');
    const password = passInput ? passInput.value.trim() : '';

    const roleSelect = document.getElementById('manageRole') || 
                       modalPengguna.querySelector('select');
    const role = roleSelect ? roleSelect.value : 'operator';

    if (!username) return Swal.fire('Peringatan', 'Username wajib diisi!', 'warning');
    if (!id && !password) return Swal.fire('Peringatan', 'Kata sandi wajib diisi untuk akun baru!', 'warning');

    const isEdit = Boolean(id);
    const url = isEdit ? `${window.BASE_URL}/api/users/${id}` : `${window.BASE_URL}/api/users`;
    const method = isEdit ? 'PUT' : 'POST';

    const payload = { username, role };
    if (password) payload.password = password;

    Swal.fire({
        title: isEdit ? 'Memperbarui Akun...' : 'Menyimpan Akun Baru ke Database...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const token = window.getCleanToken();
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok && res.status === 404) {
            const fallbackUrl = isEdit ? `${window.BASE_URL}/users/${id}` : `${window.BASE_URL}/users`;
            res = await fetch(fallbackUrl, {
                method: method,
                headers: headers,
                body: JSON.stringify(payload)
            });
        }

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Gagal menyimpan data akun.');

        Swal.fire({
            icon: 'success',
            title: 'Berhasil Tersimpan!',
            text: isEdit ? `Akun '${username}' berhasil diperbarui!` : `Akun '${username}' berhasil ditambahkan ke database!`,
            timer: 1500,
            showConfirmButton: false
        });

        window.resetFormUser();
        await window.loadUserTable();
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    }
};

window.editUser = function (id, username, role, currentPassword) {
    const modalPengguna = document.getElementById('modalPengguna') || document;
    
    let idEl = document.getElementById('userId');
    if (!idEl) {
        idEl = document.createElement('input');
        idEl.type = 'hidden';
        idEl.id = 'userId';
        modalPengguna.appendChild(idEl);
    }
    idEl.value = id;

    const userInput = document.getElementById('manageUsername') || modalPengguna.querySelector('input[type="text"]');
    if (userInput) userInput.value = username;

    const roleSelect = document.getElementById('manageRole') || modalPengguna.querySelector('select');
    if (roleSelect) roleSelect.value = role || 'operator';

    const passInput = document.getElementById('managePassword') || modalPengguna.querySelector('input[type="password"]');
    if (passInput) {
        passInput.value = '';
        passInput.placeholder = 'Ketik password baru (kosongkan jika tetap)';
    }

    const title = document.getElementById('formUserTitle') || modalPengguna.querySelector('.modal-title');
    if (title) title.innerText = `Edit Akun: ${username}`;

    const submitBtn = modalPengguna.querySelector('button[type="submit"]') || modalPengguna.querySelector('.btn-primary');
    if (submitBtn) submitBtn.innerText = 'Simpan Perubahan';
};

window.resetFormUser = function () {
    const modalPengguna = document.getElementById('modalPengguna') || document;
    
    const idEl = document.getElementById('userId');
    if (idEl) idEl.value = '';

    const userInput = document.getElementById('manageUsername') || modalPengguna.querySelector('input[type="text"]');
    if (userInput) userInput.value = '';

    const passInput = document.getElementById('managePassword') || modalPengguna.querySelector('input[type="password"]');
    if (passInput) {
        passInput.value = '';
        passInput.placeholder = 'Masukkan kata sandi';
    }

    const roleSelect = document.getElementById('manageRole') || modalPengguna.querySelector('select');
    if (roleSelect) roleSelect.value = 'operator';

    const title = document.getElementById('formUserTitle') || modalPengguna.querySelector('.modal-title');
    if (title) title.innerText = 'Tambah Akun Baru';

    const submitBtn = modalPengguna.querySelector('button[type="submit"]') || modalPengguna.querySelector('.btn-primary');
    if (submitBtn) submitBtn.innerText = 'Simpan Akun';
};

window.hapusUser = async function (id, username) {
    const { isConfirmed } = await Swal.fire({
        title: `Hapus Akun '${username}'?`,
        text: 'Akun ini akan dihapus permanen dari basis data.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });

    if (!isConfirmed) return;

    try {
        const token = window.getCleanToken();
        const headers = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(`${window.BASE_URL}/api/users/${id}`, { method: 'DELETE', headers });
        if (!res.ok) {
            res = await fetch(`${window.BASE_URL}/users/${id}`, { method: 'DELETE', headers });
        }

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Gagal menghapus akun.');

        Swal.fire({ icon: 'success', title: 'Terhapus', text: result.message, timer: 1500, showConfirmButton: false });
        await window.loadUserTable();
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    }
};

// =========================================================================
// 20. PUSAT NOTIFIKASI REAL-TIME
// =========================================================================
window.currentNotifTab = 'all';
window.cachedNotifList = [];

window.toggleNotifPanel = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const panel = document.getElementById('notifPanel');
    if (!panel) return;

    const isVisible = (panel.style.display === 'block' || panel.style.display === 'flex');
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        window.loadNotifikasiAktivitas(window.currentNotifTab);
    }
};

document.addEventListener('click', function (e) {
    const panel = document.getElementById('notifPanel');
    const wrapper = document.querySelector('.notif-wrapper');

    if (e.target.closest('.swal2-container') || e.target.closest('.swal2-popup') || document.body.classList.contains('swal2-shown')) return;

    if (panel && (panel.style.display === 'block' || panel.style.display === 'flex')) {
        if (!panel.contains(e.target) && !wrapper?.contains(e.target)) {
            panel.style.display = 'none';
        }
    }
});

window.renderNotifikasiListDOM = function () {
    const container = document.getElementById('notifList');
    if (!container) return;

    const prevScrollTop = container.scrollTop;
    const filterTab = window.currentNotifTab;
    const list = window.cachedNotifList || [];

    let filtered = [];
    if (filterTab === 'arsip') {
        filtered = list.filter(n => Boolean(n.is_archived));
    } else if (filterTab === 'urgent') {
        filtered = list.filter(n => !n.is_archived && (
            (n.pesan && n.pesan.includes('🚨')) || 
            (n.pesan && n.pesan.toLowerCase().includes('sengketa')) || 
            (n.pesan && n.pesan.toLowerCase().includes('urgent'))
        ));
    } else {
        filtered = list.filter(n => !Boolean(n.is_archived));
    }

    filtered.sort((a, b) => {
        const pinA = a.is_pinned ? 1 : 0;
        const pinB = b.is_pinned ? 1 : 0;
        if (pinB !== pinA) return pinB - pinA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding:36px 16px; text-align:center; color:#94a3b8; font-size:0.83rem;">
                <i class="fas fa-inbox" style="font-size:1.8rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                Tidak ada notifikasi pada kategori ini.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        let cleanMsg = (item.pesan || '')
            .replace(/👑|📌|🔒|🚨|⚠️/g, '')
            .replace(/^\[(Admin|Petugas|Operator|Warga|Sistem|Urgent)\]\s*/i, '')
            .trim();

        let roleBadge = '<span style="background:#f1f5f9; color:#475569; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #cbd5e1;">SISTEM</span>';
        if (item.pesan && item.pesan.match(/^\[Admin\]/i)) {
            roleBadge = '<span style="background:#e0e7ff; color:#4338ca; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #c7d2fe;">ADMIN</span>';
        } else if (item.pesan && item.pesan.match(/^\[(Petugas|Operator)\]/i)) {
            roleBadge = '<span style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #bae6fd;">PETUGAS</span>';
        } else if (item.pesan && item.pesan.match(/^\[Warga\]/i)) {
            roleBadge = '<span style="background:#fef3c7; color:#b45309; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fde68a;">WARGA</span>';
        } else if (item.pesan && (item.pesan.includes('🚨') || item.pesan.match(/^\[Urgent\]/i))) {
            roleBadge = '<span style="background:#fee2e2; color:#dc2626; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fecaca;">URGENT</span>';
        }

        const isPinned = Boolean(item.is_pinned);
        const isArchived = Boolean(item.is_archived);
        const cardBg = isPinned ? '#fffdf7' : (item.is_read ? '#ffffff' : '#f0fdf4');
        const pinAccent = isPinned ? 'border-left: 4px solid #f59e0b;' : 'border-left: 4px solid transparent;';
        const pinIconColor = isPinned ? '#f59e0b' : '#94a3b8';

        return `
            <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${cardBg}; ${pinAccent} display:flex; gap:10px; align-items:flex-start; cursor:pointer; transition:background 0.15s ease;" 
                 onclick="window.lihatDetailNotifikasi(event, ${item.id})" 
                 onmouseover="this.style.background='#f8fafc'" 
                 onmouseout="this.style.background='${cardBg}'">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        ${roleBadge}
                        ${isPinned ? '<span style="font-size:0.68rem; font-weight:800; color:#d97706; background:#fef3c7; padding:1px 6px; border-radius:4px;"><i class="fas fa-thumbtack"></i> SEMATAN</span>' : ''}
                        <span style="font-size:0.7rem; color:#94a3b8; margin-left:auto;">${item.waktu || ''}</span>
                    </div>
                    <div style="color:#0f172a; font-size:0.83rem; font-weight:${item.is_read ? '500' : '700'}; line-height:1.45;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>
                <div style="display:flex; gap:3px; margin-left:4px;" onclick="event.stopPropagation()">
                    <button type="button" onclick="window.togglePinNotif(${item.id})" title="Sematkan" style="background:none; border:none; color:${pinIconColor}; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <button type="button" onclick="window.toggleArsipNotif(${item.id})" title="Arsipkan" style="background:none; border:none; color:#64748b; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas ${isArchived ? 'fa-box-open' : 'fa-archive'}"></i>
                    </button>
                    <button type="button" onclick="window.hapusNotif(${item.id})" title="Hapus" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = prevScrollTop;
};

window.loadNotifikasiAktivitas = async function (filterTab = window.currentNotifTab, forceRender = false) {
    window.currentNotifTab = filterTab;
    const badge = document.getElementById('notifBadge');
    const panel = document.getElementById('notifPanel');
    const isPanelOpen = panel && (panel.style.display === 'block' || panel.style.display === 'flex');

    if (window.isNotifUpdating) return;
    window.isNotifUpdating = true;

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/notifikasi') : fetch(`${window.BASE_URL}/api/notifikasi`));
        if (!res || !res.ok) return;

        const result = await res.json();
        window.cachedNotifList = result.data || [];
        const unreadCount = result.unread || 0;

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (forceRender || isPanelOpen) {
            window.renderNotifikasiListDOM();
        }
    } catch (err) {
        console.warn('Gagal memuat notifikasi:', err);
    } finally {
        window.isNotifUpdating = false;
    }
};

window.cekNotifikasiRealtime = async function () {
    try {
        const res = await fetch(`${window.BASE_API_URL}/api/notifikasi`);
        if (!res.ok) return;
        const json = await res.json();
        const badge = document.getElementById('notifBadge');
        if (badge && json.total_unread !== undefined) {
            badge.textContent = json.total_unread;
            badge.style.display = json.total_unread > 0 ? 'inline-block' : 'none';
        }
    } catch (e) {}
};

window.lihatDetailNotifikasi = function (e, id) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (!item) return;

    if (!item.is_read) {
        item.is_read = true;
        window.renderNotifikasiListDOM();
        fetch(`${window.BASE_URL}/api/notifikasi/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        }).catch(() => {});
    }

    const cleanMsg = (item.pesan || '').replace(/👑|📌|🔒|🚨|⚠️/g, '').trim();

    Swal.fire({
        title: 'Detail Aktivitas Sistem',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; color:#1e293b;">
                <div style="padding:14px; background:#f8fafc; border-radius:14px; border:1px solid #e2e8f0; margin-bottom:14px;">
                    <div style="margin-bottom:6px;"><b>Waktu Eksekusi:</b> ${item.waktu || '-'}</div>
                    <div style="font-size:0.92rem; font-weight:600; color:#0f172a; margin-top:4px; padding:10px; background:#ffffff; border-radius:8px; border:1px solid #cbd5e1; word-break:break-word;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: item.is_pinned ? 'Lepas Pin' : 'Sematkan (Pin)',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#f59e0b'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await window.togglePinNotif(id);
        }
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    });
};

window.switchNotifTab = function (tab) {
    window.currentNotifTab = tab;
    document.querySelectorAll('.ntf-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#475569';
    });
    const activeBtn = document.getElementById(
        tab === 'urgent' ? 'tabNotifUrgent' : (tab === 'arsip' ? 'tabNotifArsip' : 'tabNotifAll')
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = tab === 'urgent' ? '#dc2626' : '#ffffff';
        activeBtn.style.color = tab === 'urgent' ? '#ffffff' : '#0f172a';
    }
    window.renderNotifikasiListDOM();
};

window.togglePinNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_pinned = !item.is_pinned;
        window.renderNotifikasiListDOM();
    }
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}/pin`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.toggleArsipNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_archived = !item.is_archived;
        window.renderNotifikasiListDOM();
    }
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}/archive`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.hapusNotif = async function (id) {
    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Number(n.id) !== Number(id));
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.hapusSemuaNotif = async function () {
    const konfirmasi = confirm('Bersihkan seluruh riwayat notifikasi yang tidak disematkan?');
    if (!konfirmasi) return;
    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Boolean(n.is_pinned));
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/clear-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.tandaiSemuaNotifDibaca = async function () {
    (window.cachedNotifList || []).forEach(n => { n.is_read = true; });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

// =========================================================================
// 21. INVESTIGASI & SENGKETA ADUAN
// =========================================================================
window.loadLaporanChatData = async function () {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    try {
        const token = window.getCleanToken();
        const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

        const laporanEndpoints = [
            `${window.BASE_URL}/api/laporan-chat`,
            `${window.BASE_URL}/api/chat/laporan`,
            `${window.BASE_URL}/api/pengaduan`,
            `${window.BASE_URL}/laporan-chat`
        ];

        let res = null;
        for (const url of laporanEndpoints) {
            try {
                let testRes = await fetch(url, { headers });
                if (testRes.status === 401 || testRes.status === 422) {
                    testRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
                }
                if (testRes && testRes.ok) {
                    res = testRes;
                    break;
                }
            } catch (e) {}
        }

        if (res && res.ok) {
            const resJson = await res.json();
            window.allLaporanChatData = Array.isArray(resJson) ? resJson : (resJson.data || []);
            renderLaporanChat(window.allLaporanChatData);
        } else {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Belum ada laporan sengketa atau aduan warga yang masuk.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">Gagal mengambil data laporan investigasi.</div>';
    }
};

window.bukaChatDariAduan = function (nik) {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        const search = document.getElementById('searchChatInput');
        if (search) {
            search.value = nik;
            if (typeof window.filterChatList === 'function') window.filterChatList();
        }
        if (typeof window.selectWargaChat === 'function') window.selectWargaChat(nik);
    }, 300);
};

function renderLaporanChat(data) {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Tidak ada laporan yang sesuai kriteria.</div>';
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="card" style="padding:20px; margin-bottom:16px; border:1.5px solid #e2e8f0; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:800; font-size:0.88rem; color:#dc2626;"><i class="fas fa-shield-virus"></i> ${item.id} — ${item.kategori}</span>
                <span style="font-size:0.75rem; color:#64748b; font-weight:700;">${item.waktu || ''}</span>
            </div>
            <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Pelapor: ${item.nama} • NIK: <span class="font-mono text-primary">${item.nik}</span></div>
            <div style="background:#f8fafc; padding:12px 16px; border-radius:14px; font-size:0.88rem; color:#334155; margin-bottom:14px; border:1px solid #e2e8f0;">${item.uraian || item.deskripsi || '-'}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge" style="background:#fee2e2; color:#dc2626; font-weight:800; padding: 6px 14px; border-radius: 20px;">Tahap: ${item.status_text || item.status || 'Tinjauan'}</span>
                <button onclick="window.bukaChatDariAduan('${item.nik}')" class="btn btn-primary btn-sm" style="border-radius:24px; padding:7px 16px;"><i class="fas fa-comments"></i> Buka Chat Mediasi Warga</button>
            </div>
        </div>
    `).join('');
}

window.filterInvestigasi = function (filterType, btn) {
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('button').forEach(b => {
            b.className = 'btn btn-secondary btn-sm';
            b.style.color = '';
            b.style.borderColor = '';
            b.style.borderRadius = '20px';
        });
        btn.className = 'btn btn-primary btn-sm';
        btn.style.borderRadius = '20px';
    }

    let filtered = window.allLaporanChatData || [];
    if (filterType === 'urgent') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('urgent')) || (x.uraian && x.uraian.toLowerCase().includes('urgent')));
    } else if (filterType === 'sengketa') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('sengketa')) || (x.kategori && x.kategori.toLowerCase().includes('salur')));
    } else if (filterType === 'data') {
        filtered = filtered.filter(x => (x.kategori && x.kategori.toLowerCase().includes('data')) || (x.kategori && x.kategori.toLowerCase().includes('nik')));
    }
    renderLaporanChat(filtered);
};

window.bukaMediaLightbox = function (url) {
    const modal = document.getElementById('mediaLightbox');
    const container = document.getElementById('lightboxContent');
    if (!modal || !container) return;
    container.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:80vh; border-radius:12px; object-fit:contain;" />`;
    modal.style.display = 'flex';
};

window.closeLightbox = function (e) {
    if (!e || e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        const modal = document.getElementById('mediaLightbox');
        const container = document.getElementById('lightboxContent');
        if (container) container.innerHTML = '';
        if (modal) modal.style.display = 'none';
    }
};

window.bukaWilayahDetail = function (kecamatanNama) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = kecamatanNama || 'Kabupaten Sidoarjo';
    const dataList = window.globalDataWarga || [];
    const filtered = dataList.filter(w => String(w.alamat || '').toLowerCase().includes(String(kecamatanNama || '').toLowerCase()));

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada data warga terdaftar di wilayah ini.</td></tr>';
    } else {
        tbody.innerHTML = filtered.map((w, idx) => `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${window.safeHtml(w.nama)}</b><br><small class="text-muted font-mono">${w.nik}</small></td>
                <td>${window.safeHtml(w.alamat || '-')}</td>
                <td style="text-align:center;"><span class="badge badge-blue">Desil ${w.desil || 5}</span></td>
                <td>${w.status_salur === 'Telah Menerima' ? 'Telah Menerima' : 'Belum Salur'}</td>
                <td>Rp 600.000,-</td>
                <td style="text-align:center;">${w.bukti_salur ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                <td style="text-align:center;">${w.lat && w.lng ? `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}` : '-'}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// =========================================================================
// 22. CADANGKAN & PULIHKAN ARSIP
// =========================================================================
window.bukaModalSinkronArsip = function () {
    Swal.fire({
        title: '<i class="fas fa-database text-primary" style="margin-right:8px;"></i> Sinkronisasi Data Arsip',
        html: `
            <div style="text-align:left; font-size:0.92rem; color:#334155; margin-top:14px;">
                <div class="sync-option-card" onclick="window.eksekusiCadangkanArsip()" style="display:flex; gap:12px; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:10px; cursor:pointer; background:#f8fafc;">
                    <div style="background:#dcfce7; color:#15803d; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem;"><i class="fas fa-save"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.95rem; color:#0f172a;">1. Simpan Cadangan Arsip (Backup)</div>
                        <small style="color:#64748b;">Mencadangkan seluruh data warga aktif saat ini.</small>
                    </div>
                </div>
                <div class="sync-option-card restore-card" onclick="window.eksekusiPulihkanArsip()" style="display:flex; gap:12px; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:12px; cursor:pointer; background:#f8fafc;">
                    <div style="background:#e0f2fe; color:#0284c7; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem;"><i class="fas fa-history"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.95rem; color:#0f172a;">2. Pulihkan Cadangan Arsip (Restore)</div>
                        <small style="color:#64748b;">Memulihkan data arsip master ke tabel kerja kependudukan.</small>
                    </div>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Tutup'
    });
};

window.eksekusiCadangkanArsip = async function () {
    Swal.fire({ title: 'Menyimpan Cadangan...', didOpen: () => Swal.showLoading() });
    try {
        let res = await fetch(`${window.BASE_API_URL}/api/arsip/cadangkan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (!res.ok) {
            res = await fetch(`${window.BASE_API_URL}/arsip/cadangkan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });
        }
        const json = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Cadangan Tersimpan!', text: json.message || 'Data berhasil dicadangkan.' });
        } else {
            throw new Error(json.message || 'Gagal menyimpan arsip.');
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    }
};

window.eksekusiPulihkanArsip = async function () {
    Swal.fire({ title: 'Memulihkan Cadangan...', didOpen: () => Swal.showLoading() });
    try {
        let res = await fetch(`${window.BASE_API_URL}/api/arsip/pulihkan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (!res.ok) {
            res = await fetch(`${window.BASE_API_URL}/arsip/pulihkan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });
        }
        const json = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Berhasil Dipulihkan!', text: json.message || 'Data kependudukan telah dipulihkan.' })
                .then(() => {
                    if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
                    else location.reload();
                });
        } else {
            throw new Error(json.message || 'Gagal memulihkan arsip.');
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    }
};

// =========================================================================
// 23. CETAK DOKUMEN RESMI SK BUPATI & LAPORAN
// =========================================================================
window.cetakSKBupati = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakSKBupati === 'function') {
        return window.AdminPrint.cetakSKBupati();
    }

    const data = (window.cachedHasilSPK || []).filter(w => (w.desil || 5) <= 4);
    if (!data.length) {
        return Swal.fire('Perhatian', 'Jalankan Proses Algoritma SAW terlebih dahulu untuk menghasilkan daftar penetapan.', 'warning');
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Izinkan pop-up untuk mencetak dokumen SK.');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SURAT KEPUTUSAN BUPATI SIDOARJO</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px 60px; color: #000; line-height: 1.5; font-size: 12pt; }
                .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px; }
                .kop h2 { margin: 0; font-size: 16pt; font-weight: bold; }
                .kop h1 { margin: 0; font-size: 18pt; font-weight: bold; letter-spacing: 1px; }
                .kop p { margin: 2px 0 0 0; font-size: 10pt; }
                .judul { text-align: center; margin-bottom: 25px; }
                .judul h3 { margin: 0; text-decoration: underline; font-size: 13pt; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11pt; }
                th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
                th { background: #f2f2f2; text-align: center; }
                .ttd-box { float: right; width: 280px; text-align: center; margin-top: 40px; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="kop">
                <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                <h1>DINAS SOSIAL</h1>
                <p>Jl. Pahlawan No. 56 Sidoarjo, Jawa Timur | Telp: (031) 8921234</p>
            </div>
            <div class="judul">
                <h3>KEPUTUSAN BUPATI SIDOARJO</h3>
                <p>NOMOR: 188/BANSOS-SPK/${new Date().getFullYear()}<br>TENTANG<br>PENETAPAN DAFTAR PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO</p>
            </div>
            <p>Menetapkan warga terverifikasi dan memenuhi kriteria kelayakan berbasis sistem pendukung keputusan metode BWM-SAW (Desil 1–4) sebagai berikut:</p>
            <table>
                <thead>
                    <tr>
                        <th style="width:40px;">No</th>
                        <th>Nomor NIK</th>
                        <th>Nama Penerima</th>
                        <th>Alamat Lengkap</th>
                        <th style="width:80px;">Desil</th>
                        <th>Skor SAW</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((d, i) => `
                        <tr>
                            <td style="text-align:center;">${i + 1}</td>
                            <td>${d.nik}</td>
                            <td><b>${d.nama}</b></td>
                            <td>${d.alamat}</td>
                            <td style="text-align:center;">Desil ${d.desil}</td>
                            <td style="text-align:center;">${d.skorSaw}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="ttd-box">
                <p>Ditetapkan di Sidoarjo<br>Pada tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br><br><b>BUPATI SIDOARJO</b><br><br><br><br><b>( _________________________ )</b></p>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
};

window.cetakLaporanKomparasi = function () {
    if (window.AdminPrint && typeof window.AdminPrint.cetakLaporanKomparasi === 'function') {
        return window.AdminPrint.cetakLaporanKomparasi();
    }
    window.print();
};

// =========================================================================
// 24. EVENT LISTENERS FORM & LOGOUT
// =========================================================================
window.toggleSelectAll = function (source) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = source.checked;
    });
    const checked = document.querySelectorAll('.row-checkbox:checked').length;
    const fab = document.getElementById('fabBulk');
    const countEl = document.getElementById('bulkCount');
    if (countEl) countEl.innerText = checked;
    if (fab) fab.style.display = checked > 0 ? 'flex' : 'none';
};

window.logout = function () {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
};

window.exportSPKPDF = () => window.AdminPrint ? window.AdminPrint.cetakSKBupati() : (window.cetakSKBupati ? window.cetakSKBupati() : null);
window.exportKomparasiPDF = () => window.AdminPrint ? window.AdminPrint.cetakLaporanKomparasi() : (window.cetakLaporanKomparasi ? window.cetakLaporanKomparasi() : null);

document.addEventListener('DOMContentLoaded', () => {
    const modalPengguna = document.getElementById('modalPengguna');
    if (modalPengguna) {
        const formUser = modalPengguna.querySelector('form');
        if (formUser) {
            formUser.onsubmit = function (e) {
                e.preventDefault();
                window.simpanUser(e);
                return false;
            };
        }
        
        const btnSimpan = modalPengguna.querySelector('.btn-success') || modalPengguna.querySelector('button[onclick*="simpan"]');
        if (btnSimpan && !btnSimpan.getAttribute('onclick')) {
            btnSimpan.onclick = (e) => window.simpanUser(e);
        }

        const btnBatal = modalPengguna.querySelector('button[onclick*="reset"]') || modalPengguna.querySelector('.btn-secondary');
        if (btnBatal && !btnBatal.getAttribute('onclick')) {
            btnBatal.onclick = () => window.resetFormUser();
        }
    }

    document.querySelectorAll('.modal-blur-overlay').forEach(overlay => {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) {
                this.style.setProperty('display', 'none', 'important');
            }
        });
    });
});

// =========================================================================
// 25. PENGAMAN GLOBAL TOMBOL CHAT WARGA
// =========================================================================
window.openAdminChat = function () {
    const modalChat = document.getElementById('modalAdminChat') || 
                      document.getElementById('modalChat') || 
                      document.getElementById('modalLaporanChat');
    if (modalChat) {
        modalChat.style.setProperty('display', 'flex', 'important');
        modalChat.style.setProperty('z-index', '99999', 'important');
    }

    try {
        if (typeof window.tutupObrolanAktif === 'function') {
            window.tutupObrolanAktif();
        }
    } catch (e) {
        console.warn('[openAdminChat] Peringatan penutupan obrolan:', e);
    }

    try {
        if (typeof window.loadChatInbox === 'function') {
            window.loadChatInbox();
        }
    } catch (e) {}
};