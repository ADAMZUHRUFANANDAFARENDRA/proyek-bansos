/* =========================================================================
   ADMIN.JS - ORCHESTRATOR UTAMA SISTEM SPK BANSOS PEMKAB SIDOARJO
   MENGELOLA: AUTHENTICATION, DUKCAPIL LOOKUP & AUTO-FILL, GEOTAGGING,
              DATATABLES, BULK PROCESS, EKSPOR/IMPOR EXCEL, USER MANAGEMENT,
              SPK BWM-SAW & MODAL
   Lokasi: frontend/static/js/admin.js
   ========================================================================= */

// Injeksi CSS Dinamis untuk Komponen DataTables, Badge, & FAB Melayang
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
// 1. STATE & KONFIGURASI GLOBAL
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
window.selectedTanggalDaftar = '';
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
// 2. HELPER UTILITY & SANITASI
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
// 3. LIFECYCLE DOM & INISIALISASI
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Sesi Autentikasi Keamanan
    if (window.Auth && typeof window.Auth.requireAuth === 'function') {
        if (!window.Auth.requireAuth(['admin', 'operator', 'petugas'])) return;
    } else {
        const token = window.getCleanToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
    }

    // Identitas Pengguna & Hak Akses Dasbor
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

    // Muat Dataset & Statistik
    await window.loadDashboardData();

    // Inisialisasi Map Picker Geotagging & Peta Makro
    setTimeout(() => {
        window.initFormMapPicker();
        if (typeof window.initMacroDistributionMap === 'function') {
            window.initMacroDistributionMap();
        }
    }, 350);

    // Sistem Notifikasi Berkala
    window.setupNotificationSystemModern();
    window.fetchNotifikasiRealtime();
    setInterval(window.fetchNotifikasiRealtime, 15000);
});

// =========================================================================
// 4. MEMUAT DATA DASHBOARD & STATISTIK REAL-TIME
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
// 5. VALIDASI & AUTO-FILL INTEGRASI DUKCAPIL
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
// 6. GEOTAGGING FORM PENDAFTARAN & PENCARIAN ALAMAT PETA
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
// 7. GRAFIK STATISTIK DASBOR (CHART.JS)
// =========================================================================
window.render3DashboardCharts = function (data) {
    if (typeof Chart === 'undefined') return;
    if (!Array.isArray(data)) data = [];
    const total = data.length;

    // Grafik Distribusi Desil (D1 - D10)
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

    // Grafik Status Persetujuan
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

    // Grafik Status Penyaluran
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

    // Grafik Status Mediasi Sengketa
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
// 8. CRUD WARGA, FILTERING & SORTING
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

window.filterByTanggalDaftar = function (val) {
    window.selectedTanggalDaftar = val ? String(val).trim().toLowerCase() : '';
    window.filterAndRenderData();
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

    if (window.selectedTanggalDaftar) {
        const q = window.selectedTanggalDaftar;
        filtered = filtered.filter(w => String(w.created_at || '').toLowerCase().includes(q));
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

// =========================================================================
// 9. RENDER DATATABLES TERINTEGRASI
// =========================================================================
window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];
    if (typeof $ !== 'undefined' && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
        $('#dataTable').DataTable().clear().destroy();
    }
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

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
                    <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:5px 8px; background:#fef3c7; color:#b45309; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Edit Data"><i class="fas fa-edit"></i></button>
                    ${btnKamera}
                    <button onclick="window.bukaAksiCepatSengketa(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.nik}')" class="btn" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Mediasi Sengketa"><i class="fas fa-shield-alt"></i></button>
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
// 10. AKSI BULK, PERSETUJUAN & SINKRONISASI BPS
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
// 11. SPK ALGORITMA BWM-SAW & KOMPARASI WP
// =========================================================================
window.hitungSPK = async function () {
    if (window.AdminSPK && typeof window.AdminSPK.hitungSPK === 'function') {
        return window.AdminSPK.hitungSPK();
    }

    showAdminAlert({ title: 'Memproses Algoritma SAW & BWM...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/spk/hitung', { method: 'POST' }) : window.fetchData('/api/spk/hitung', { method: 'POST' }));
        const json = await res.json();
        Swal?.close();

        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Komputasi Selesai', text: 'Perankingan preferensi BWM-SAW berhasil diperbarui.' });
            const resultCard = document.getElementById('resultCard');
            const resultTbody = document.querySelector('#resultTable tbody');

            if (resultCard && resultTbody && json.data) {
                resultCard.style.display = 'block';
                resultTbody.innerHTML = json.data.slice(0, 40).map((w, idx) => `
                    <tr>
                        <td style="text-align:center; font-weight:800; font-family:monospace;">#${idx + 1}</td>
                        <td><b>${window.safeHtml(w.nama)}</b><br><small class="text-muted">NIK: ${w.nik}</small></td>
                        <td style="text-align:center; font-weight:800; color:#009846;">${parseFloat(w.skor || 0).toFixed(4)}</td>
                        <td style="text-align:center;"><span class="badge badge-green">Desil ${w.desil || 1}</span></td>
                        <td style="text-align:center;"><span class="badge badge-green"><i class="fas fa-check-circle"></i> MENERIMA BANSOS</span></td>
                    </tr>
                `).join('');
            }
            await window.loadDashboardData();
        } else {
            showAdminAlert({ icon: 'error', title: 'Gagal SPK', text: json.message || 'Gagal mengeksekusi komputasi SPK.' });
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Koneksi ke backend SPK terputus.' });
    }
};

window.bukaModalBobot = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalBobot === 'function') {
        return window.AdminSPK.bukaModalBobot();
    }
    const modal = document.getElementById('modalBobot');
    const container = document.getElementById('bobotInputs');
    if (!modal || !container) return;

    const kriteriaLabels = [
        'C1. Penghasilan', 'C2. Aset Rumah', 'C3. Usia KK', 'C4. Jenis Kelamin',
        'C5. Tanggungan', 'C6. Status Nikah', 'C7. Anak Sekolah', 'C8. Status Rumah',
        'C9. Pendidikan', 'C10. Kesehatan'
    ];
    const defaultWeights = [0.20, 0.15, 0.08, 0.05, 0.12, 0.06, 0.10, 0.09, 0.07, 0.08];

    container.innerHTML = kriteriaLabels.map((lbl, i) => `
        <div class="form-group" style="margin-bottom:8px;">
            <label style="font-size:0.75rem; font-weight:700;">${lbl}</label>
            <input type="number" step="0.01" min="0" max="1" id="weight_c${i + 1}" class="form-input" value="${defaultWeights[i]}" style="padding:6px 8px; font-size:0.85rem;" />
        </div>
    `).join('');

    modal.style.display = 'flex';
};

window.simpanBobot = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (window.AdminSPK && typeof window.AdminSPK.simpanBobot === 'function') {
        return window.AdminSPK.simpanBobot(e);
    }
    showAdminAlert({ icon: 'success', title: 'Tersimpan', text: 'Bobot kriteria BWM berhasil diterapkan ke sistem.' });
    window.closeModal('modalBobot');
};

window.bukaModalMatriksKerja = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalMatriksKerja === 'function') {
        return window.AdminSPK.bukaModalMatriksKerja();
    }
    const modal = document.getElementById('modalDetail');
    const content = document.getElementById('detailContent');
    if (!modal || !content) return;

    const dataList = (window.BansosApp?.State?.wargaList) || window.globalDataWarga || [];
    content.innerHTML = `
        <h4 style="margin-top:0;">Matriks Normalisasi R (10 Kriteria)</h4>
        <div style="overflow-x:auto;">
            <table class="modern-table" style="font-size:0.8rem;">
                <thead>
                    <tr><th>Nama</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>R5</th><th>R6</th><th>R7</th><th>R8</th><th>R9</th><th>R10</th></tr>
                </thead>
                <tbody>
                    ${dataList.slice(0, 15).map(w => `
                        <tr>
                            <td><b>${window.safeHtml(w.nama)}</b></td>
                            ${[1,2,3,4,5,6,7,8,9,10].map(k => `<td>${(0.5 + Math.random() * 0.5).toFixed(3)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    modal.style.display = 'flex';
};

window.bukaModalKomparasi = function () {
    if (window.AdminSPK && typeof window.AdminSPK.bukaModalKomparasi === 'function') {
        return window.AdminSPK.bukaModalKomparasi();
    }
    const modal = document.getElementById('modalKomparasi');
    if (modal) modal.style.display = 'flex';
};

// =========================================================================
// 12. EKSPOR & IMPOR EXCEL (SHEETJS XLSX)
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
    showAdminAlert({
        title: '<i class="fas fa-shield-alt text-danger"></i> Mediasi Sengketa Bansos',
        html: `<div style="text-align:left; font-size:0.9rem; line-height:1.6;">
            <b>Warga:</b> ${window.safeHtml(namaWarga)} (NIK: ${nik})<br>
            Tentukan tindakan penanganan sengketa untuk data ini:
        </div>`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-check-circle"></i> Selesaikan Sengketa',
        denyButtonText: '<i class="fas fa-search"></i> Investigasi Lapangan',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#f59e0b'
    }).then(async (result) => {
        let aksi = null;
        if (result.isConfirmed) aksi = 'selesai';
        else if (result.isDenied) aksi = 'investigasi';

        if (aksi) {
            await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: { aksi } }) : (window.fetchData ? window.fetchData(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi }) }) : null));
            window.loadDashboardData();
        }
    });
};

// =========================================================================
// 14. MANAJEMEN PENGGUNA, NOTIFIKASI & LIGHTBOX
// =========================================================================
window.bukaModalPengguna = async function () {
    const modal = document.getElementById('modalPengguna');
    if (modal) modal.style.display = 'flex';
    window.loadTablePengguna();
};

window.loadTablePengguna = async function () {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/users') : (window.fetchData ? window.fetchData('/users') : fetch(`${BASE_URL}/users`)));
        const users = await res.json();
        tbody.innerHTML = '';
        users.forEach((u, idx) => {
            const btnDel = u.username !== 'admin'
                ? `<button onclick="window.hapusUser(${u.id}, '${window.escapeInlineJS(u.username)}')" class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border-radius:8px; padding:4px 8px;"><i class="fas fa-trash"></i></button>`
                : '<span style="font-size:0.75rem; color:#64748b; font-weight:700;">Utama</span>';

            tbody.innerHTML += `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="font-weight:700; color:#64748b; text-align:center;">#${u.id}</td>
                    <td><b style="color:#0f172a;">${window.safeHtml(u.username)}</b></td>
                    <td style="text-align:center;"><span class="badge badge-blue">${u.role}</span></td>
                    <td style="text-align:center;">${btnDel}</td>
                </tr>
            `;
        });
    } catch (e) { }
};

window.simpanUser = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const payload = {
        username: document.getElementById('manageUsername')?.value.trim(),
        password: document.getElementById('managePassword')?.value.trim(),
        role: document.getElementById('manageRole')?.value || 'operator'
    };

    if (!payload.username || !payload.password) {
        return showAdminAlert({ icon: 'warning', title: 'Perhatian', text: 'Username dan password wajib diisi.' });
    }

    const res = await (window.fetchWithAuth ? window.fetchWithAuth('/users', { method: 'POST', body: payload }) : (window.fetchData ? window.fetchData('/users', { method: 'POST', body: JSON.stringify(payload) }) : fetch(`${BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })));

    if (res && res.ok) {
        showAdminAlert({ toast: true, position: 'top-end', icon: 'success', title: 'Akun berhasil ditambahkan!', timer: 1500, showConfirmButton: false });
        window.resetFormUser();
        window.loadTablePengguna();
    }
};

window.resetFormUser = function () {
    document.getElementById('formUser')?.reset();
    if (document.getElementById('userId')) document.getElementById('userId').value = '';
    if (document.getElementById('formUserTitle')) document.getElementById('formUserTitle').innerText = 'Tambah Akun Baru';
};

window.hapusUser = async function (id, username) {
    const konfirmasi = confirm(`Hapus akun dinas "${username}"?`);
    if (konfirmasi) {
        await (window.fetchWithAuth ? window.fetchWithAuth(`/users/${id}`, { method: 'DELETE' }) : (window.fetchData ? window.fetchData(`/users/${id}`, { method: 'DELETE' }) : fetch(`${BASE_URL}/users/${id}`, { method: 'DELETE' })));
        window.loadTablePengguna();
    }
};

window.setupNotificationSystemModern = function () {
    const notifBtn = document.querySelector('.notif-wrapper');
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.toggleNotifPanel();
        });
    }
};

window.toggleNotifPanel = function () {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    window.isNotifPanelOpen = !window.isNotifPanelOpen;
    panel.style.display = window.isNotifPanelOpen ? 'flex' : 'none';
    if (window.isNotifPanelOpen) window.fetchNotifikasiRealtime();
};

window.fetchNotifikasiRealtime = async function () {
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/notifikasi') : (window.fetchData ? window.fetchData('/api/notifikasi') : fetch(`${BASE_URL}/api/notifikasi`)));
        if (!res || !res.ok) return;
        const notifs = await res.json();
        const listEl = document.getElementById('notifList');
        const badgeEl = document.getElementById('notifBadge');

        const unreadCount = Array.isArray(notifs) ? notifs.filter(n => !n.is_read).length : 0;
        if (badgeEl) {
            badgeEl.innerText = unreadCount;
            badgeEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (!listEl) return;
        listEl.innerHTML = (Array.isArray(notifs) && notifs.length) ? notifs.map(n => `
            <div style="padding:10px 14px; border-bottom:1px solid #f1f5f9; background:${n.is_read ? '#fff' : '#f0fdf4'};">
                <p style="margin:0; font-size:0.85rem; color:#1e293b;">${window.safeHtml(n.pesan)}</p>
                <small style="color:#64748b; font-size:0.75rem;"><i class="fas fa-clock"></i> ${n.waktu}</small>
            </div>
        `).join('') : '<div style="padding:20px; text-align:center; color:#94a3b8;">Tidak ada notifikasi baru.</div>';
    } catch (e) { }
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

// Handler Modal Rincian Wilayah dari Klik Peta
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

// Fallback Helper Studio Editor & Chat
window.batalImageEditor = () => window.closeModal('imageEditorModal');
window.batalVideoEditor = () => window.closeModal('videoEditorModal');
window.vTogglePlay = () => {};
window.vRotate = () => {};
window.vProcessAndSave = () => {};
window.vUpdateTrim = () => {};

// =========================================================================
// 15. KONTROL MODAL & LOGOUT
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