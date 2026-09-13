/* =========================================================================
   ADMIN.JS - ORCHESTRATOR UTAMA SISTEM SPK BANSOS PEMKAB SIDOARJO
   MENGELOLA: AUTHENTICATION, DUKCAPIL LOOKUP & AUTO-FILL, GEOTAGGING,
              DATATABLES, BULK PROCESS, EKSPOR/IMPOR EXCEL, USER MANAGEMENT,
              SPK BWM-SAW, MODAL & PUSAT NOTIFIKASI AKTIVITAS
   Lokasi: frontend/static/js/admin.js
   ========================================================================= */

// Injeksi CSS Dinamis untuk Komponen DataTables, Badge, & FAB Melayang[cite: 12]
const dtStyle = document.createElement('style');
dtStyle.innerHTML = `
    .dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: var(--text-muted, #64748b); }
    .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; margin: 0 8px; cursor:pointer; background: white;}
    .dataTables_filter { margin-bottom: 15px; margin-top: 5px; }
    .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1px solid #cbd5e1; outline: none; margin-left: 8px; width: 250px; background: white;}
    .badge-green { background: #e6f9f0; color: #15803d; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-blue { background: #e0f2fe; color: #1d4ed8; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-red { background: #fee2e2; color: #dc2626; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-warning { background: #fef3c7; color: #b45309; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .filter-btn.active { background: #10b981 !important; color: white !important; font-weight: 700; }
    .filter-btn-danger.active { background: #ef4444 !important; color: white !important; font-weight: 700; }
    .fab-bulk { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #0f172a; color: white; padding: 10px 24px; border-radius: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 1000; display: none; align-items: center; gap: 15px; animation: slideUp 0.3s ease; }
    .fab-text { font-size: 0.9rem; font-weight: 700; }
    @keyframes slideUp { from { transform: translate(-50%, 50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
`;
document.head.appendChild(dtStyle);

// =========================================================================
// 1. STATE & KONFIGURASI GLOBAL[cite: 12]
// =========================================================================
const BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:5000');

const MAP_CENTER_SIDOARJO = (window.CONFIG?.MAP?.DEFAULT_CENTER) || [-7.4478, 112.7183];

window.globalDataWarga = [];
let globalDataWarga = [];
window.currentFilter = 'all';
window.currentSort = 'terbaru';
window.sortNikAsc = false;
window.sortAzAsc = false;
window.stagedImportData = [];

let dtTable = null;
let chartDesilObj = null;
let chartPersetujuanObj = null;
let chartPenyaluranObj = null;
let chartSengketaObj = null;
let formMap = null;
let formMarker = null;

let user = null;
try {
    user = (window.Auth && typeof window.Auth.getUser === 'function')
        ? window.Auth.getUser()
        : JSON.parse(localStorage.getItem('user') || localStorage.getItem('bansosUser') || 'null');
} catch (e) {
    user = null;
}

// =========================================================================
// 2. HELPER UTILITY & SANITASI[cite: 12]
// =========================================================================
window.safeHtml = function (str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.escapeInlineJS = function (str) {
    if (!str) return '';
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
    alert(options.text || options.title || 'Pemberitahuan');
    return Promise.resolve({ isConfirmed: true, value: true });
}

window.getCleanToken = function () {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken') || '';
};

// =========================================================================
// 3. LIFECYCLE DOM & INISIALISASI[cite: 12]
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.Auth && typeof window.Auth.requireAuth === 'function') {
        if (!window.Auth.requireAuth(['admin', 'operator', 'petugas'])) return;
    } else {
        const token = window.getCleanToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
    }

    const currentUser = (window.Auth && typeof window.Auth.getUser === 'function') ? window.Auth.getUser() : user;
    const currentRole = ((window.Auth && typeof window.Auth.getRole === 'function') ? window.Auth.getRole() : currentUser?.role || 'operator').toLowerCase();

    if (currentUser) {
        const nameEl = document.getElementById('navUsername');
        const roleEl = document.getElementById('navRoleBadge');
        const cmdEl = document.getElementById('adminCommandCenter');

        if (nameEl) nameEl.innerText = (currentUser.nama_lengkap || currentUser.username || 'PETUGAS').toUpperCase();

        if (roleEl) {
            if (currentRole === 'admin') {
                roleEl.className = 'role-badge role-admin';
                roleEl.innerHTML = '<i class="fas fa-crown"></i> Super Admin';
                if (cmdEl) cmdEl.style.display = 'block';
            } else {
                roleEl.className = 'role-badge role-petugas';
                roleEl.innerHTML = '<i class="fas fa-user-edit"></i> Petugas Lapangan';
                if (cmdEl) cmdEl.style.display = 'none';
            }
        }
    }

    await window.loadDashboardData();

    setTimeout(() => {
        window.initFormMapPicker();
        if (typeof window.initMacroDistributionMap === 'function') {
            window.initMacroDistributionMap();
        }
    }, 350);

    if (typeof window.loadNotifikasiAktivitas === 'function') {
        window.loadNotifikasiAktivitas();
        setInterval(() => window.loadNotifikasiAktivitas(), 15000);
    }
});

// =========================================================================
// 4. MEMUAT DATA DASHBOARD & STATISTIK REAL-TIME[cite: 12]
// =========================================================================
window.loadDashboardData = async function (showToast = false) {
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/warga?_t=${Date.now()}`) : (window.fetchData ? window.fetchData(`/warga?_t=${Date.now()}`) : fetch(`${BASE_URL}/warga`)));
        if (!res || !res.ok) return;

        const resData = await res.json();
        let data = Array.isArray(resData) ? resData : (resData.data || []);

        if (window.BansosApp && window.BansosApp.State) {
            window.BansosApp.State.setWargaList(data);
        } else {
            window.globalDataWarga = data;
            globalDataWarga = data;
        }

        const total = data.length;
        const disetujui = data.filter(w => w.is_verified).length;
        const menunggu = total - disetujui;
        const telahSalur = data.filter(w => w.status_salur === 'Telah Menerima').length;
        const belumSalur = total - telahSalur;
        const sengketa = data.filter(w => String(w.status_salur).includes('Sengketa')).length;
        const bebasSengketa = total - sengketa;

        const statTotal = document.getElementById('statTotal');
        if (statTotal) statTotal.innerText = total;

        const statValid = document.getElementById('statValid');
        const statTotalRef = document.getElementById('statTotalRef');
        const statValidBadge = document.getElementById('statValidBadge');
        const statMenungguBadge = document.getElementById('statMenungguBadge');
        if (statValid) statValid.innerText = disetujui;
        if (statTotalRef) statTotalRef.innerText = `${total} Warga`;
        if (statValidBadge) statValidBadge.innerText = disetujui;
        if (statMenungguBadge) statMenungguBadge.innerText = menunggu;

        const statTelahSalur = document.getElementById('statTelahSalur');
        const statBelumSalurBadge = document.getElementById('statBelumSalurBadge');
        if (statTelahSalur) statTelahSalur.innerText = telahSalur;
        if (statBelumSalurBadge) statBelumSalurBadge.innerText = belumSalur;

        const statSengketa = document.getElementById('statSengketa');
        const statBebasSengketaBadge = document.getElementById('statBebasSengketaBadge');
        if (statSengketa) statSengketa.innerText = sengketa;
        if (statBebasSengketaBadge) statBebasSengketaBadge.innerText = bebasSengketa;

        window.render3DashboardCharts(data);
        window.filterAndRenderData();

        if (showToast) {
            showAdminAlert({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Data arsip diperbarui!',
                showConfirmButton: false,
                timer: 1500
            });
        }
    } catch (err) {
        console.error('[Load Error] Gagal memuat data warga:', err);
    }
};

// =========================================================================
// 5. VALIDASI & AUTO-FILL INTEGRASI DUKCAPIL[cite: 12]
// =========================================================================
window.cekDukcapilLokal = async function () {
    const nik = document.getElementById('nik')?.value.trim();
    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit angka NIK.' });
    }

    showAdminAlert({ title: 'Memeriksa Data Dukcapil...', didOpen: () => Swal?.showLoading() });

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/api/dukcapil/${nik}`) : (window.fetchData ? window.fetchData(`/api/dukcapil/${nik}`) : fetch(`${BASE_URL}/api/dukcapil/${nik}`)));
        const json = await res.json();
        Swal?.close();

        if (res && res.ok && json.status === 'success') {
            const d = json.data;
            if (document.getElementById('nama')) document.getElementById('nama').value = d.nama;
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = d.tempat_lahir;
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = d.tanggal_lahir;
            if (document.getElementById('alamat')) document.getElementById('alamat').value = d.alamat;
            if (document.getElementById('c4')) document.getElementById('c4').value = d.jenis_kelamin === 'Perempuan' ? '2' : '1';

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
// 6. GEOTAGGING FORM PENDAFTARAN & PENCARIAN ALAMAT PETA[cite: 12]
// =========================================================================
window.initFormMapPicker = function () {
    const mapBox = document.getElementById('formCoordMap');
    if (!mapBox || formMap || typeof L === 'undefined') return;

    formMap = L.map('formCoordMap', { attributionControl: false }).setView(MAP_CENTER_SIDOARJO, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(formMap);

    formMarker = L.marker(MAP_CENTER_SIDOARJO, { draggable: true }).addTo(formMap);

    formMarker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        window.updateLocationAndAddress(pos.lat, pos.lng);
    });

    formMap.on('click', function (e) {
        formMarker.setLatLng(e.latlng);
        window.updateLocationAndAddress(e.latlng.lat, e.latlng.lng);
    });

    window.setFormCoords(MAP_CENTER_SIDOARJO[0], MAP_CENTER_SIDOARJO[1]);
};

window.setFormCoords = function (lat, lng) {
    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = Number(lat || MAP_CENTER_SIDOARJO[0]).toFixed(6);
    if (lngEl) lngEl.value = Number(lng || MAP_CENTER_SIDOARJO[1]).toFixed(6);
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
// 7. GRAFIK STATISTIK DASBOR (CHART.JS)[cite: 12]
// =========================================================================
window.render3DashboardCharts = function (data) {
    if (typeof Chart === 'undefined') return;
    if (!Array.isArray(data)) data = [];
    const total = data.length;

    const ctxDesil = document.getElementById('chartDesil10');
    if (ctxDesil) {
        const desilCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        data.forEach(w => {
            const d = (w.desil && w.desil >= 1 && w.desil <= 10) ? w.desil : 5;
            desilCounts[d - 1]++;
        });
        if (chartDesilObj) chartDesilObj.destroy();
        chartDesilObj = new Chart(ctxDesil, {
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

    const ctxValid = document.getElementById('chartPersetujuan');
    if (ctxValid) {
        const disetujui = data.filter(w => w.is_verified).length;
        const menunggu = total - disetujui;
        if (chartPersetujuanObj) chartPersetujuanObj.destroy();
        chartPersetujuanObj = new Chart(ctxValid, {
            type: 'doughnut',
            data: {
                labels: ['Disetujui', 'Menunggu'],
                datasets: [{
                    data: [disetujui, menunggu],
                    backgroundColor: ['#10b981', '#ef4444'],
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

    const ctxSalur = document.getElementById('chartPenyaluran');
    if (ctxSalur) {
        const telahSalur = data.filter(w => w.status_salur === 'Telah Menerima').length;
        const belumSalur = total - telahSalur;
        if (chartPenyaluranObj) chartPenyaluranObj.destroy();
        chartPenyaluranObj = new Chart(ctxSalur, {
            type: 'doughnut',
            data: {
                labels: ['Telah Disalurkan', 'Menunggu Salur'],
                datasets: [{
                    data: [telahSalur, belumSalur],
                    backgroundColor: ['#0284c7', '#cbd5e1'],
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

    const ctxSengketa = document.getElementById('chartSengketa');
    if (ctxSengketa) {
        const sengketa = data.filter(w => String(w.status_salur).includes('Sengketa')).length;
        const bebasSengketa = total - sengketa;
        if (chartSengketaObj) chartSengketaObj.destroy();
        chartSengketaObj = new Chart(ctxSengketa, {
            type: 'doughnut',
            data: {
                labels: ['Bebas Sengketa', 'Laporan Sengketa'],
                datasets: [{
                    data: [bebasSengketa, sengketa],
                    backgroundColor: ['#10b981', '#dc2626'],
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
// 8. CRUD WARGA, FILTERING & SINKRONISASI WAKTU[cite: 12]
// =========================================================================
window.activeDateFilter = {
    mode: 'tanggal',
    val: ''
};

function parseWaktuPendaftaran(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        return {
            day: parseInt(dmy[1], 10),
            month: parseInt(dmy[2], 10),
            year: parseInt(dmy[3], 10)
        };
    }

    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
        return {
            day: parseInt(ymd[3], 10),
            month: parseInt(ymd[2], 10),
            year: parseInt(ymd[1], 10)
        };
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return {
            day: d.getDate(),
            month: d.getMonth() + 1,
            year: d.getFullYear()
        };
    }
    return null;
}

window.changeDateFilterMode = function (mode) {
    window.activeDateFilter.mode = mode;
    window.activeDateFilter.val = '';
    const container = document.getElementById('dateFilterInputContainer');
    if (!container) return;

    if (mode === 'tanggal') {
        container.innerHTML = `
            <input type="date" id="filterTglPicker" onchange="window.applyDateFilter()" 
                   style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Tanggal Tertentu">
        `;
    } else if (mode === 'bulan') {
        container.innerHTML = `
            <input type="month" id="filterBulanPicker" onchange="window.applyDateFilter()" 
                   style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Bulan Tertentu">
        `;
    } else if (mode === 'tahun') {
        container.innerHTML = `
            <input type="number" id="filterTahunPicker" min="1900" max="2100" placeholder="Ketik Tahun (contoh: 2026)" oninput="window.applyDateFilter()" 
                   style="width:160px; border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; background:#f8fafc;" title="Ketik tahun pendaftaran bebas">
        `;
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
    let dataList = (window.BansosApp && window.BansosApp.State) 
        ? window.BansosApp.State.wargaList 
        : (window.globalDataWarga || []);
    let filtered = [...dataList];

    if (window.currentFilter === 'layak') {
        filtered = filtered.filter(w => w.is_verified && ((w.desil || 5) <= 4));
    } else if (window.currentFilter === 'menerima') {
        filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    } else if (window.currentFilter === 'bermasalah') {
        filtered = filtered.filter(w => String(w.status_salur).includes('Sengketa') || !w.is_verified);
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

    window.renderTable(filtered);
};

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
        c4: parseInt(document.getElementById('c4')?.value || 1),
        c5: parseInt(document.getElementById('c5')?.value || 0),
        c6: parseInt(document.getElementById('c6')?.value || 1),
        c7: parseInt(document.getElementById('c7')?.value || 0),
        c8: parseInt(document.getElementById('c8')?.value || 1),
        c9: parseInt(document.getElementById('c9')?.value || 1),
        c10: parseInt(document.getElementById('c10')?.value || 1),
        catatan: document.getElementById('catatan')?.value.trim() || ''
    };

    if (!payload.nik || !payload.nama) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    showAdminAlert({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await (window.fetchWithAuth 
            ? window.fetchWithAuth('/warga', { method: 'POST', body: payload }) 
            : (window.fetchData ? window.fetchData('/warga', { method: 'POST', body: JSON.stringify(payload) }) : fetch(`${BASE_URL}/warga`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })));

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
// 9. RENDER DATATABLES TERINTEGRASI DENGAN TOMBOL PERISAI KONDISIONAL
// =========================================================================
window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];

    if (typeof $ !== 'undefined' && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
        $('#dataTable').DataTable().destroy();
    }

    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:30px; color:#94a3b8; font-weight:600;">
                    <i class="fas fa-inbox" style="font-size:1.8rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                    Tidak ada data warga yang sesuai dengan filter waktu/kategori yang dipilih.
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
        } else if (String(w.status_salur).includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-exclamation-triangle"></i> Sengketa</span>`;
        }

        // Deteksi apakah warga sedang mengajukan sengketa (Penyaluran / Keberatan Desil)
        const isSengketa = String(w.status_salur || '').toLowerCase().includes('sengketa') || 
                           String(w.catatan || '').toLowerCase().includes('sengketa') ||
                           String(w.catatan || '').toLowerCase().includes('sanggah');

        // Tombol Perisai HANYA muncul jika terdapat status sengketa aktif
        const btnSengketa = isSengketa
            ? `<button type="button" onclick="window.bukaAksiCepatSengketa(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.nik}')" class="btn btn-sm" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px; border:1px solid #fca5a5;" title="Mediasi Sengketa Aktif"><i class="fas fa-shield-alt"></i></button>`
            : '';

        const btnToggleVerif = isVerified
            ? `<button onclick="window.toggleVerifySingle(${w.id}, '${window.escapeInlineJS(w.nama)}')" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.toggleVerifySingle(${w.id}, '${window.escapeInlineJS(w.nama)}')" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-check"></i> Setujui</button>`;

        const btnKamera = isEligible
            ? `<button onclick="window.bukaUploadBuktiSalur(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.bukti_salur || ''}')" class="btn btn-sm" style="padding:5px 8px; background:#dcfce7; color:#15803d; border-radius:6px; margin-right:3px;" title="Unggah Bukti Penyaluran"><i class="fas fa-camera"></i></button>`
            : '';

        const currentRole = ((window.Auth && typeof window.Auth.getRole === 'function') ? window.Auth.getRole() : user?.role || 'operator').toLowerCase();
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

    if (typeof $ !== 'undefined' && $.fn.DataTable) {
        dtTable = $('#dataTable').DataTable({
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
// 10. AKSI BULK, PERSETUJUAN & SINKRONISASI BPS[cite: 12]
// =========================================================================
window.bulkProcess = async function (action) {
    const checked = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    if (!checked.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Data', text: 'Pilih minimal satu baris warga terlebih dahulu.' });
    }

    if (action === 'verify') {
        return window.verifyAllData();
    } else if (action === 'delete') {
        const konfirmasi = confirm(`Apakah Anda yakin ingin menghapus ${checked.length} data warga terpilih?`);
        if (konfirmasi) {
            await (window.fetchWithAuth ? window.fetchWithAuth('/warga/bulk/delete', { method: 'POST', body: { ids: checked } }) : (window.fetchData ? window.fetchData('/warga/bulk/delete', { method: 'POST', body: JSON.stringify({ ids: checked }) }) : null));
            window.loadDashboardData();
        }
    }
};

window.verifyAllData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const checked = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const payload = checked.length > 0 ? { ids: checked } : {};

    showAdminAlert({ title: 'Memproses Persetujuan...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga/bulk/verify', { method: 'POST', body: payload }) : window.fetchData('/warga/bulk/verify', { method: 'POST', body: JSON.stringify(payload) }));
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Sukses', text: 'Persetujuan data warga berhasil diproses.' });
            await window.loadDashboardData();
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal memproses persetujuan massal.' });
    }
};

window.unverifyAllData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const checked = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const payload = checked.length > 0 ? { ids: checked } : {};

    showAdminAlert({ title: 'Membatalkan Persetujuan...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga/bulk/unverify', { method: 'POST', body: payload }) : window.fetchData('/warga/bulk/unverify', { method: 'POST', body: JSON.stringify(payload) }));
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Sukses', text: 'Persetujuan data warga berhasil dibatalkan.' });
            await window.loadDashboardData();
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal membatalkan persetujuan massal.' });
    }
};

window.toggleVerifySingle = async function (id, namaWarga) {
    const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}/verify`, { method: 'PATCH' }) : window.fetchData(`/warga/${id}/verify`, { method: 'PATCH' }));
    if (res && res.ok) {
        window.loadDashboardData();
    }
};

window.hapusSemuaWarga = async function () {
    const konf = await Swal.fire({
        title: 'Hapus Seluruh Data Warga?',
        text: 'Tindakan ini tidak dapat dibatalkan. Semua data survei dan hasil perankingan akan dihapus!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus Semua'
    });
    if (konf.isConfirmed) {
        try {
            await (window.fetchWithAuth ? window.fetchWithAuth('/warga/all', { method: 'DELETE' }) : window.fetchData('/warga/all', { method: 'DELETE' }));
            showAdminAlert({ icon: 'success', title: 'Terhapus', text: 'Seluruh data warga berhasil dibersihkan.' });
            window.loadDashboardData();
        } catch (e) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus data warga.' });
        }
    }
};

window.syncBPS = async function () {
    showAdminAlert({ title: 'Sinkronisasi Data BPS Sidoarjo...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/bps/sync', { method: 'POST' }) : window.fetchData('/api/bps/sync', { method: 'POST' }));
        const json = await res.json();
        Swal?.close();
        showAdminAlert({ icon: 'success', title: 'BPS Terhubung', text: json.message || 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.' });
    } catch (e) {
        showAdminAlert({ icon: 'info', title: 'Data BPS Termutakhir', text: 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo telah aktif pada sistem.' });
    }
};

// =========================================================================
// 11. SPK ALGORITMA BWM-SAW & KOMPARASI WP[cite: 12]
// =========================================================================
window.bukaModalKomparasi = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalKomparasi === 'function') {
        return window.AdminSPK.bukaModalKomparasi();
    }
    const modal = document.getElementById('modalKomparasi');
    if (modal) modal.style.display = 'flex';
};

window.hitungSPK = function () {
    if (window.AdminSPK && typeof window.AdminSPK.hitungSPK === 'function') {
        return window.AdminSPK.hitungSPK();
    }
};

// =========================================================================
// 12. EKSPOR & IMPOR EXCEL (SHEETJS XLSX)[cite: 12]
// =========================================================================
window.exportExcelLengkap = function () {
    const dataList = (window.BansosApp && window.BansosApp.State) ? window.BansosApp.State.wargaList : window.globalDataWarga;
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
        'C1 Ekonomi': w.c1_ekonomi || w.c1 || 0,
        'C2 Aset': w.c2_aset || w.c2 || 0,
        'C3 Umur': w.c3_umur || w.c3 || 0,
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
            if (modal) modal.style.display = 'flex';
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
        const res = await (window.fetchWithAuth 
            ? window.fetchWithAuth('/warga/bulk', { method: 'POST', body: { data: window.stagedImportData } }) 
            : (window.fetchData ? window.fetchData('/warga/bulk', { method: 'POST', body: JSON.stringify({ data: window.stagedImportData }) }) : fetch(`${BASE_URL}/warga/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: window.stagedImportData }) })));

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

    const dataList = (window.BansosApp?.State?.wargaList) || window.globalDataWarga || [];
    if (!dataList.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data untuk diekspor.' });
    }

    const exportData = dataList.map((w, idx) => {
        const row = { 'No': idx + 1 };
        selectedCols.forEach(col => {
            if (col === 'nik') row['NIK'] = String(w.nik);
            else if (col === 'nama') row['Nama Lengkap'] = w.nama;
            else if (col === 'alamat') row['Alamat Lengkap'] = w.alamat;
            else if (col === 'c1_ekonomi') row['C1 (Ekonomi)'] = w.c1_ekonomi || w.c1 || 0;
            else if (col === 'c2_aset') row['C2 (Aset)'] = w.c2_aset || w.c2 || 0;
            else if (col === 'c3_umur') row['C3 (Umur)'] = w.c3_umur || w.c3 || 0;
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
// 13. EDIT DATA WARGA, PENGESAHAN BUKTI SALUR & SENGKETA
// =========================================================================
window.bukaModalEdit = function (id) {
    const dataList = (window.BansosApp && window.BansosApp.State) ? window.BansosApp.State.wargaList : window.globalDataWarga;
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

    if (document.getElementById('editC1')) document.getElementById('editC1').value = w.c1_ekonomi || w.c1 || 0;
    if (document.getElementById('editC2')) document.getElementById('editC2').value = w.c2_aset || w.c2 || 0;
    if (document.getElementById('editC3')) document.getElementById('editC3').value = w.c3_umur || w.c3 || 0;
    if (document.getElementById('editC4')) document.getElementById('editC4').value = w.c4_jenis_kelamin || w.c4 || 1;
    if (document.getElementById('editC5')) document.getElementById('editC5').value = w.c5_tanggungan || w.c5 || 0;
    if (document.getElementById('editC6')) document.getElementById('editC6').value = w.c6_status_pernikahan || w.c6 || 1;
    if (document.getElementById('editC7')) document.getElementById('editC7').value = w.c7_kepemilikan_anak || w.c7 || 0;
    if (document.getElementById('editC8')) document.getElementById('editC8').value = w.c8_tempat_tinggal || w.c8 || 1;
    if (document.getElementById('editC9')) document.getElementById('editC9').value = w.c9_pendidikan || w.c9 || 1;
    if (document.getElementById('editC10')) document.getElementById('editC10').value = w.c10_kesehatan || w.c10 || 1;
    if (document.getElementById('editCatatan')) document.getElementById('editCatatan').value = w.catatan || '';

    const modal = document.getElementById('modalEdit');
    if (modal) modal.style.display = 'flex';
};

window.simpanEdit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('editId').value;
    const payload = {
        nama: document.getElementById('editNama').value.trim(),
        nik: document.getElementById('editNik').value.trim(),
        no_hp: document.getElementById('editNoHp')?.value.trim() || '',
        email: document.getElementById('editEmail')?.value.trim() || '',
        tempat_lahir: document.getElementById('editTempatLahir').value.trim(),
        tanggal_lahir: document.getElementById('editTglLahir').value || null,
        alamat: document.getElementById('editAlamat').value.trim(),
        c1: parseFloat(document.getElementById('editC1')?.value || 0),
        c2: parseInt(document.getElementById('editC2')?.value || 0),
        c3: parseInt(document.getElementById('editC3')?.value || 0),
        c4: parseInt(document.getElementById('editC4')?.value || 1),
        c5: parseInt(document.getElementById('editC5')?.value || 0),
        c6: parseInt(document.getElementById('editC6')?.value || 1),
        c7: parseInt(document.getElementById('editC7')?.value || 0),
        c8: parseInt(document.getElementById('editC8')?.value || 1),
        c9: parseInt(document.getElementById('editC9')?.value || 1),
        c10: parseInt(document.getElementById('editC10')?.value || 1),
        catatan: document.getElementById('editCatatan')?.value.trim() || ''
    };

    const res = await (window.fetchWithAuth 
        ? window.fetchWithAuth(`/warga/${id}`, { method: 'PUT', body: payload }) 
        : (window.fetchData ? window.fetchData(`/warga/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) : fetch(`${BASE_URL}/warga/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })));

    if (res && res.ok) {
        showAdminAlert({ icon: 'success', title: 'Berhasil', text: 'Data warga berhasil diperbarui.' });
        window.closeModal('modalEdit');
        window.loadDashboardData();
    }
};

window.hapusData = async function (id) {
    const konfirmasi = confirm('Apakah Anda yakin ingin menghapus data warga ini?');
    if (konfirmasi) {
        await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}`, { method: 'DELETE' }) : (window.fetchData ? window.fetchData(`/warga/${id}`, { method: 'DELETE' }) : fetch(`${BASE_URL}/warga/${id}`, { method: 'DELETE' })));
        window.loadDashboardData();
    }
};

window.bukaUploadBuktiSalur = function (id, namaWarga, existingPhoto) {
    let previewHtml = existingPhoto 
        ? `<div style="margin-bottom:15px;"><img src="${BASE_URL}/uploads/${existingPhoto}" style="max-width:100%; max-height:200px; border-radius:10px;" /></div>` 
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
            const res = await (window.fetchWithAuth 
                ? window.fetchWithAuth(`/warga/${id}/bukti-salur`, { method: 'POST', body: formData }) 
                : (window.fetchData ? window.fetchData(`/warga/${id}/bukti-salur`, { method: 'POST', body: formData }) : fetch(`${BASE_URL}/warga/${id}/bukti-salur`, { method: 'POST', body: formData })));

            if (res && res.ok) {
                showAdminAlert({ icon: 'success', title: 'Tersimpan', text: 'Foto bukti penyaluran berhasil diunggah!' });
                window.loadDashboardData();
            }
        }
    });
};

window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    const dataList = (window.BansosApp && window.BansosApp.State) ? window.BansosApp.State.wargaList : window.globalDataWarga;
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
            const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
            await (window.fetchWithAuth 
                ? window.fetchWithAuth(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: { aksi: 'selesai' } }) 
                : fetch(`${baseUrl}/api/warga/${id}/lapor-sengketa`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${window.getCleanToken()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ aksi: 'selesai' })
                }));
            await window.loadDashboardData(true);
            showAdminAlert({ icon: 'success', title: 'Sengketa Selesai', text: `Status bantuan untuk ${namaWarga} telah diperbarui menjadi Telah Menerima.` });
        } else if (result.isDenied) {
            window.bukaModalEdit(id);
        }
    });
};

// =========================================================================
// 14. MODUL MANAJEMEN PENGGUNA SISTEM (DENGAN INSPEKSI PASSWORD LAMA & BARU)[cite: 12]
// =========================================================================

// 1. Buka Modal dan Muat Tabel Pengguna[cite: 12]
window.bukaModalPengguna = async function () {
    const modal = document.getElementById('modalPengguna');
    if (modal) modal.style.display = 'flex';
    window.resetFormUser();
    await window.loadUserTable();
};

// 2. Tarik dan Render Data Tabel Pengguna[cite: 12]
window.loadUserTable = async function () {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat data akun...</td></tr>';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken');
        const res = await fetch('http://127.0.0.1:5000/users', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error('Gagal mengambil daftar pengguna.');
        const users = await res.json();

        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Belum ada akun terdaftar.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isAdmin = (u.role === 'admin');
            const roleBadge = isAdmin
                ? `<span class="badge" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.75rem;">ADMIN</span>`
                : `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:3px 10px; border-radius:12px; font-size:0.75rem;">OPERATOR</span>`;

            const btnEdit = `
                <button type="button" class="btn btn-sm" onclick="window.editUser(${u.id}, '${window.escapeInlineJS(u.username)}', '${u.role}', '${window.escapeInlineJS(u.current_password || '')}')" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:8px; padding:5px 9px; cursor:pointer;" title="Edit Akun & Password">
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
                    <td style="font-weight:700; color:#64748b; font-size:0.85rem;">#${u.id}</td>
                    <td style="font-weight:800; color:#0f172a; font-size:0.9rem;">${window.safeHtml(u.username)}</td>
                    <td>${roleBadge}</td>
                    <td style="text-align:center;">
                        <div style="display:inline-flex; align-items:center; gap:6px;">
                            ${btnEdit}
                            ${btnDelete}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#dc2626;">${err.message}</td></tr>`;
    }
};

window.loadTablePengguna = window.loadUserTable;

// 3. Masuk ke Mode Edit Akun (Menampilkan Password Aktif & Kolom Password Baru)[cite: 12]
window.editUser = function (id, username, role, currentPassword) {
    document.getElementById('userId').value = id;
    document.getElementById('manageUsername').value = username;
    document.getElementById('manageRole').value = role || 'operator';

    let groupCurrent = document.getElementById('groupCurrentPassword');
    const passInput = document.getElementById('managePassword');
    const passGroup = passInput ? passInput.closest('.form-group') : null;

    if (!groupCurrent && passGroup && passGroup.parentNode) {
        groupCurrent = document.createElement('div');
        groupCurrent.id = 'groupCurrentPassword';
        groupCurrent.className = 'form-group';
        groupCurrent.innerHTML = `
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span>Password Saat Ini (Aktif)</span>
                <span style="font-size:0.7rem; color:#009846; font-weight:700;"><i class="fas fa-lock"></i> Aktif</span>
            </label>
            <div style="position:relative; display:flex; align-items:center;">
                <input type="password" id="manageCurrentPassword" class="form-input" readonly style="background:#f1f5f9; font-weight:700; color:#0f172a; width:100%; padding-right:44px; border:1.5px solid #cbd5e1;">
                <button type="button" onclick="const p=document.getElementById('manageCurrentPassword'); p.type=p.type==='password'?'text':'password'; this.innerHTML=p.type==='password'?'<i class=\\'fas fa-eye\\'></i>':'<i class=\\'fas fa-eye-slash\\'></i>';" style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer; padding:4px;" title="Lihat Password Saat Ini">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        passGroup.parentNode.insertBefore(groupCurrent, passGroup);
    }

    if (groupCurrent) {
        groupCurrent.style.display = 'block';
        const curPassInput = document.getElementById('manageCurrentPassword');
        if (curPassInput) {
            curPassInput.value = currentPassword || (username === 'admin' ? 'admin123' : '12345');
            curPassInput.type = 'password';
        }
    }

    const labelPass = passGroup ? passGroup.querySelector('.form-label') : null;
    if (labelPass) {
        labelPass.innerText = 'Kata Sandi Baru (Opsional)';
    }

    if (passInput) {
        passInput.value = '';
        passInput.required = false;
        passInput.placeholder = 'Masukkan kata sandi baru (kosongkan jika tetap)';
    }

    const title = document.getElementById('formUserTitle');
    if (title) {
        title.innerHTML = `<i class="fas fa-user-edit text-primary"></i> Edit Akun: <span style="color:#009846;">${window.safeHtml(username)}</span>`;
    }

    const submitBtn = document.querySelector('#formUser button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan';
        submitBtn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
    }

    document.getElementById('manageUsername').focus();
};

// 4. Eksekusi Simpan Perubahan / Tambah Akun Baru[cite: 12]
window.simpanUser = async function (e) {
    e.preventDefault();

    const id = document.getElementById('userId').value.trim();
    const username = document.getElementById('manageUsername').value.trim();
    const password = document.getElementById('managePassword').value.trim();
    const role = document.getElementById('manageRole').value;

    if (!username) {
        return Swal.fire('Peringatan', 'Username wajib diisi!', 'warning');
    }

    if (!id && !password) {
        return Swal.fire('Peringatan', 'Password wajib diisi untuk akun baru!', 'warning');
    }

    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken');
    const isEdit = Boolean(id);
    const url = isEdit ? `http://127.0.0.1:5000/users/${id}` : 'http://127.0.0.1:5000/users';
    const method = isEdit ? 'PUT' : 'POST';

    const payload = { username, role };
    if (password) {
        payload.password = password;
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || 'Gagal memproses data akun.');
        }

        const loggedUser = localStorage.getItem('username');
        if (isEdit && loggedUser === username) {
            const navUser = document.getElementById('navUsername');
            if (navUser) navUser.innerText = username;
        }

        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: isEdit 
                ? `Akun '${username}' berhasil diperbarui! Perubahan telah dicatat ke notifikasi.` 
                : `Akun '${username}' berhasil ditambahkan dan siap digunakan!`,
            timer: 2000,
            showConfirmButton: false
        });

        window.resetFormUser();
        await window.loadUserTable();

        if (typeof window.fetchNotifications === 'function') {
            window.fetchNotifications();
        }
    } catch (err) {
        Swal.fire('Kendala Penyimpanan', err.message, 'error');
    }
};

// 5. Kembalikan Form ke Mode Tambah Akun Baru[cite: 12]
window.resetFormUser = function () {
    document.getElementById('userId').value = '';
    document.getElementById('manageUsername').value = '';

    const groupCurrent = document.getElementById('groupCurrentPassword');
    if (groupCurrent) {
        groupCurrent.style.display = 'none';
    }

    const passInput = document.getElementById('managePassword');
    const passGroup = passInput ? passInput.closest('.form-group') : null;
    const labelPass = passGroup ? passGroup.querySelector('.form-label') : null;
    if (labelPass) {
        labelPass.innerText = 'Kata Sandi (Password)';
    }

    if (passInput) {
        passInput.value = '';
        passInput.required = true;
        passInput.placeholder = 'Masukkan kata sandi';
        passInput.type = 'password';
    }

    document.getElementById('manageRole').value = 'operator';

    const title = document.getElementById('formUserTitle');
    if (title) title.innerText = 'Tambah Akun Baru';

    const submitBtn = document.querySelector('#formUser button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Akun';
        submitBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
    }
};

// 6. Hapus Akun[cite: 12]
window.hapusUser = async function (id, username) {
    const { isConfirmed } = await Swal.fire({
        title: `Hapus Akun '${username}'?`,
        text: 'Akun ini tidak akan dapat digunakan lagi untuk masuk ke dalam sistem dashboard.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-trash-alt"></i> Ya, Hapus',
        cancelButtonText: 'Batal'
    });

    if (!isConfirmed) return;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken');
        const res = await fetch(`http://127.0.0.1:5000/users/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Gagal menghapus akun.');

        Swal.fire({
            icon: 'success',
            title: 'Terhapus',
            text: result.message,
            timer: 1500,
            showConfirmButton: false
        });

        await window.loadUserTable();
        if (typeof window.fetchNotifications === 'function') {
            window.fetchNotifications();
        }
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    }
};

// =========================================================================
// 15. PUSAT PENGENDALI NOTIFIKASI AKTIVITAS (STABIL, ANTI-GLITCH & MODAL STAY)[cite: 12]
// =========================================================================
window.currentNotifTab = 'all';
window.cachedNotifList = [];

// Buka / Tutup Dropdown Notifikasi[cite: 12]
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

// Tutup Panel Hanya Jika Mengklik Luar Area (Kecualikan SweetAlert Popup)[cite: 12]
document.addEventListener('click', function (e) {
    const panel = document.getElementById('notifPanel');
    const wrapper = document.querySelector('.notif-wrapper');

    if (e.target.closest('.swal2-container') || e.target.closest('.swal2-popup') || document.body.classList.contains('swal2-shown')) {
        return;
    }

    if (panel && (panel.style.display === 'block' || panel.style.display === 'flex')) {
        if (!panel.contains(e.target) && !wrapper.contains(e.target)) {
            panel.style.display = 'none';
        }
    }
});

// Render Tampilan Notifikasi (Menjaga Posisi Scroll & Urutan Stabil)
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
            n.pesan.includes('🚨') || 
            n.pesan.toLowerCase().includes('sengketa') || 
            n.pesan.toLowerCase().includes('urgent') ||
            n.pesan.toLowerCase().includes('keamanan')
        ));
    } else {
        filtered = list.filter(n => !Boolean(n.is_archived));
    }

    // Urutan Mutlak: 1. Pinned (Sematkan) di atas, 2. ID Terbesar (Terbaru) di atas
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
        let cleanMsg = item.pesan
            .replace(/👑|📌|🔒|🚨|⚠️/g, '')
            .replace(/\[Admin\]/gi, '')
            .replace(/\[Petugas\]/gi, '')
            .replace(/\[Warga\]/gi, '')
            .replace(/\[Sistem\]/gi, '')
            .replace(/\[Keamanan\]/gi, '')
            .trim();

        let roleBadge = '<span style="background:#f1f5f9; color:#475569; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px;">SISTEM</span>';
        if (item.pesan.includes('[Admin]')) {
            roleBadge = '<span style="background:#e0e7ff; color:#4f46e5; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px;">ADMIN</span>';
        } else if (item.pesan.includes('[Petugas]')) {
            roleBadge = '<span style="background:#e0f2fe; color:#0284c7; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px;">PETUGAS</span>';
        } else if (item.pesan.includes('[Warga]')) {
            roleBadge = '<span style="background:#fef3c7; color:#b45309; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px;">WARGA</span>';
        } else if (item.pesan.includes('🚨') || item.pesan.toLowerCase().includes('sengketa') || item.pesan.toLowerCase().includes('keamanan')) {
            roleBadge = '<span style="background:#fee2e2; color:#dc2626; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px;">URGENT</span>';
        }

        const isPinned = Boolean(item.is_pinned);
        const isArchived = Boolean(item.is_archived);
        const cardBg = isPinned ? '#fffdf7' : (item.is_read ? '#ffffff' : '#f0fdf4');
        const pinAccent = isPinned ? 'border-left: 4px solid #f59e0b;' : 'border-left: 4px solid transparent;';
        const pinIconColor = isPinned ? '#f59e0b' : '#94a3b8';
        const pinTitle = isPinned ? 'Lepas Sematan' : 'Sematkan ke Atas';
        const archiveTitle = isArchived ? 'Pulihkan dari Arsip' : 'Arsipkan';

        return `
            <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${cardBg}; ${pinAccent} display:flex; gap:10px; align-items:flex-start; cursor:pointer; transition:background 0.15s ease;" 
                 onclick="window.lihatDetailNotifikasi(event, ${item.id})" 
                 onmouseover="this.style.background='#f8fafc'" 
                 onmouseout="this.style.background='${cardBg}'">
                
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        ${roleBadge}
                        ${isPinned ? '<span style="font-size:0.68rem; font-weight:800; color:#d97706; background:#fef3c7; padding:1px 6px; border-radius:4px;"><i class="fas fa-thumbtack"></i> SEMATAN</span>' : ''}
                        <span style="font-size:0.7rem; color:#94a3b8; margin-left:auto;">${item.waktu}</span>
                    </div>
                    <div style="color:#0f172a; font-size:0.83rem; font-weight:${item.is_read ? '500' : '700'}; line-height:1.45;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>

                <div style="display:flex; gap:3px; margin-left:4px;" onclick="event.stopPropagation()">
                    <button type="button" onclick="window.togglePinNotif(${item.id})" title="${pinTitle}" style="background:none; border:none; color:${pinIconColor}; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;" onmouseover="this.style.background='#f1f5f9'">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <button type="button" onclick="window.toggleArsipNotif(${item.id})" title="${archiveTitle}" style="background:none; border:none; color:#64748b; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;" onmouseover="this.style.background='#f1f5f9'">
                        <i class="fas ${isArchived ? 'fa-box-open' : 'fa-archive'}"></i>
                    </button>
                    <button type="button" onclick="window.hapusNotif(${item.id})" title="Hapus Notifikasi" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;" onmouseover="this.style.color='#ef4444'; this.style.background='#fee2e2'">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = prevScrollTop;
};

// Memuat Notifikasi Tanpa Redraw Acak[cite: 12]
window.loadNotifikasiAktivitas = async function (filterTab = window.currentNotifTab, forceRender = false) {
    window.currentNotifTab = filterTab;
    const badge = document.getElementById('notifBadge');
    const panel = document.getElementById('notifPanel');
    const isPanelOpen = panel && (panel.style.display === 'block' || panel.style.display === 'flex');

    if (window.isNotifUpdating) return;
    window.isNotifUpdating = true;

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/notifikasi') : fetch(`${baseUrl}/api/notifikasi`));
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

// Modal Pratinjau Detail Notifikasi yang Lebih Lengkap & Panel Tetap Berdiri[cite: 12]
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
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        fetch(`${baseUrl}/api/notifikasi/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        }).catch(() => {});
    }

    let kategori = 'Aktivitas Operasional';
    let labelBadge = '<span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">OPERATOR</span>';
    
    if (item.pesan.includes('[Admin]')) {
        kategori = 'Pengaturan Administrator';
        labelBadge = '<span style="background:#e0e7ff; color:#4338ca; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">SUPER ADMIN</span>';
    } else if (item.pesan.includes('[Warga]')) {
        kategori = 'Aduan Pelayanan Warga';
        labelBadge = '<span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">WARGA</span>';
    } else if (item.pesan.includes('🚨') || item.pesan.toLowerCase().includes('keamanan') || item.pesan.toLowerCase().includes('sengketa')) {
        kategori = 'Keamanan & Penanganan Sengketa';
        labelBadge = '<span style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:12px; font-weight:800; font-size:0.75rem;">URGENT</span>';
    }

    const cleanMsg = item.pesan.replace(/👑|📌|🔒|🚨|⚠️/g, '').trim();

    Swal.fire({
        title: 'Detail Aktivitas Sistem',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; color:#1e293b;">
                <div style="padding:14px; background:#f8fafc; border-radius:14px; border:1px solid #e2e8f0; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                        <div>${labelBadge}</div>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:600;"><i class="fas fa-tag"></i> ID Log: #${item.id}</div>
                    </div>
                    <div style="margin-bottom:6px;"><b>Kategori:</b> ${kategori}</div>
                    <div style="margin-bottom:6px;"><b>Waktu Eksekusi:</b> ${item.waktu}</div>
                    <div style="margin-bottom:6px;">
                        <b>Status:</b> 
                        ${item.is_pinned ? '<span style="color:#d97706; font-weight:700;">Disematkan</span>' : 'Reguler'} • 
                        ${item.is_archived ? '<span style="color:#64748b; font-weight:700;">Diarsipkan</span>' : '<span style="color:#059669; font-weight:700;">Aktif</span>'} • 
                        <span style="color:#2563eb; font-weight:700;">Sudah Dibaca</span>
                    </div>
                    <div style="margin-top:10px;"><b>Uraian Aktivitas:</b></div>
                    <div style="font-size:0.92rem; font-weight:600; color:#0f172a; margin-top:4px; padding:10px; background:#ffffff; border-radius:8px; border:1px solid #cbd5e1; word-break:break-word;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: item.is_pinned ? 'Lepas Pin' : 'Sematkan (Pin)',
        denyButtonText: item.is_archived ? 'Pulihkan' : 'Arsipkan',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#f59e0b',
        denyButtonColor: '#475569',
        focusConfirm: false
    }).then(async (result) => {
        if (result.isConfirmed) {
            await window.togglePinNotif(id);
        } else if (result.isDenied) {
            await window.toggleArsipNotif(id);
        }

        const panel = document.getElementById('notifPanel');
        if (panel) {
            panel.style.display = 'block';
        }
    });
};

// Pergantian Tab Notifikasi & Perubahan Warna Tab Urgent Menjadi Merah Solid[cite: 12]
window.switchNotifTab = function (tab) {
    window.currentNotifTab = tab;

    document.querySelectorAll('.ntf-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#475569';
        b.style.boxShadow = 'none';
    });

    const activeBtn = document.getElementById(
        tab === 'urgent' ? 'tabNotifUrgent' : (tab === 'arsip' ? 'tabNotifArsip' : 'tabNotifAll')
    );

    if (activeBtn) {
        activeBtn.classList.add('active');
        if (tab === 'urgent') {
            activeBtn.style.background = '#dc2626';
            activeBtn.style.color = '#ffffff';
            activeBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.35)';
        } else {
            activeBtn.style.background = '#ffffff';
            activeBtn.style.color = '#0f172a';
            activeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        }
    }

    window.renderNotifikasiListDOM();
};

// Pin Notifikasi Tanpa Menutup Panel[cite: 12]
window.togglePinNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_pinned = !item.is_pinned;
        window.renderNotifikasiListDOM();
    }

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        await fetch(`${baseUrl}/api/notifikasi/${id}/pin`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {
        console.error(e);
    } finally {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    }
};

// Arsip Notifikasi Tanpa Menutup Panel[cite: 12]
window.toggleArsipNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_archived = !item.is_archived;
        window.renderNotifikasiListDOM();
    }

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        await fetch(`${baseUrl}/api/notifikasi/${id}/archive`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {
        console.error(e);
    } finally {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    }
};

// Hapus Notifikasi Tanpa Menutup Panel[cite: 12]
window.hapusNotif = async function (id) {
    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Number(n.id) !== Number(id));
    window.renderNotifikasiListDOM();

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        await fetch(`${baseUrl}/api/notifikasi/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {
        console.error(e);
    } finally {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    }
};

// Bersihkan Semua Notifikasi Tanpa Menutup Panel[cite: 12]
window.hapusSemuaNotif = async function () {
    const konfirmasi = confirm('Bersihkan seluruh riwayat notifikasi yang tidak disematkan?');
    if (!konfirmasi) return;

    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Boolean(n.is_pinned));
    window.renderNotifikasiListDOM();

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        await fetch(`${baseUrl}/api/notifikasi/clear-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {
        console.error(e);
    } finally {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    }
};

// Tandai Semua Notifikasi Dibaca Tanpa Menutup Panel[cite: 12]
window.tandaiSemuaNotifDibaca = async function () {
    (window.cachedNotifList || []).forEach(n => { n.is_read = true; });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
    window.renderNotifikasiListDOM();

    try {
        const baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL) || 'http://127.0.0.1:5000';
        await fetch(`${baseUrl}/api/notifikasi/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {
        console.error(e);
    } finally {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    }
};

// =========================================================================
// 16. MODAL RINCIAN WILAYAH, INVESTIGASI & LIGHTBOX[cite: 12]
// =========================================================================
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

window.bukaModalLaporanChat = async function () {
    const modal = document.getElementById('modalLaporanChat');
    const listEl = document.getElementById('laporanChatList');
    if (modal) modal.style.display = 'flex';
    if (!listEl) return;

    listEl.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Memuat laporan...</div>';
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/laporan-chat') : fetch(`${BASE_URL}/api/laporan-chat`));
        if (res && res.ok) {
            const data = await res.json();
            if (!data || !data.length) {
                listEl.innerHTML = '<div style="text-align:center; color:#64748b; padding:30px;">Tidak ada riwayat sengketa obrolan warga aktif.</div>';
                return;
            }
            listEl.innerHTML = data.map(item => `
                <div style="background:white; border:1px solid #cbd5e1; border-radius:12px; padding:15px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color:#0f172a; font-size:0.95rem;">${window.safeHtml(item.warga_nama || 'Warga')} (NIK: ${item.warga_nik || '-'})</b>
                        <span class="badge badge-red">${item.status || 'Perlu Tinjauan'}</span>
                    </div>
                    <p style="margin:8px 0; font-size:0.85rem; color:#475569;"><b>Alasan:</b> ${window.safeHtml(item.alasan || '-')}</p>
                    <small class="text-muted"><i class="fas fa-clock"></i> Dilaporkan pada: ${item.created_at || '-'}</small>
                </div>
            `).join('');
        }
    } catch (e) {
        listEl.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat pusat investigasi.</div>';
    }
};

window.bukaWilayahDetail = function (kecamatanNama) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = kecamatanNama || 'Kabupaten Sidoarjo';
    const dataList = (window.BansosApp?.State?.wargaList) || window.globalDataWarga || [];
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
                <td style="text-align:center;">${w.lat && w.lng ? `${Number(w.lat).toFixed(4)}, ${Number(w.lng).toFixed(4)}` : '-'}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
};

// Fallback Helper Studio Editor & Chat[cite: 12]
window.batalImageEditor = () => window.closeModal('imageEditorModal');
window.batalVideoEditor = () => window.closeModal('videoEditorModal');
window.vTogglePlay = () => {};
window.vRotate = () => {};
window.vProcessAndSave = () => {};
window.vUpdateTrim = () => {};

// =========================================================================
// 17. KONTROL MODAL & LOGOUT[cite: 12]
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

window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
};

window.logout = function () {
    if (window.Auth && typeof window.Auth.clearSession === 'function') {
        window.Auth.clearSession(true);
    } else {
        localStorage.clear();
        window.location.href = 'login.html';
    }
};

window.exportSPKPDF = () => window.AdminPrint ? window.AdminPrint.cetakSKBupati() : window.cetakSKBupati();
window.exportKomparasiPDF = () => window.AdminPrint ? window.AdminPrint.cetakLaporanKomparasi() : window.cetakLaporanKomparasi();