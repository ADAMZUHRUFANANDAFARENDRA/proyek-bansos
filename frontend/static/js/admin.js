/* =========================================================================
   ADMIN.JS - MODUL ORCHESTRATOR UTAMA SISTEM BANSOS KABUPATEN SIDOARJO
   PENGELOLA: AUTHENTICATION, STATE BUS, OCR KTP, DUKCAPIL, CRUD & DATATABLES
   Lokasi: frontend/static/js/admin.js
   ========================================================================= */

// Injeksi Style Antarmuka Dasbor & DataTables secara Dinamis
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
// 2. HELPER UTILITY & STATE BUS SYNC
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

// Sinkronisasi Event Bus jika arsitektur event termuat
if (window.BansosApp && window.BansosApp.Events) {
    window.BansosApp.Events.on('warga:updated', function (dataWarga) {
        if (window.macroMap && typeof window.renderChoroplethKerentanan === 'function') {
            window.renderChoroplethKerentanan();
        }
    });

    window.BansosApp.Events.on('spk:computed', function (hasilSpk) {
        console.log('[SPK Event] Pembaruan kalkulasi SPK diterima oleh orchestrator dasbor.');
    });
}

// =========================================================================
// 3. LIFECYCLE DOM & INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Verifikasi sesi autentikasi (Wajib login untuk role admin & operator/petugas)
    if (window.Auth && typeof window.Auth.requireAuth === 'function') {
        if (!window.Auth.requireAuth(['admin', 'operator', 'petugas'])) return;
    } else {
        const token = (window.BansosApp && window.BansosApp.API) ? window.BansosApp.API.getToken() : window.getCleanToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
    }

    // Perbarui identitas user aktif dan panel kendali administrator
    const currentUser = (window.Auth && typeof window.Auth.getUser === 'function') ? window.Auth.getUser() : user;
    const currentRole = ((window.Auth && typeof window.Auth.getRole === 'function') ? window.Auth.getRole() : currentUser?.role || 'operator').toLowerCase();

    if (currentUser) {
        const nameEl = document.getElementById('navUsername') || document.getElementById('userProfileLabel');
        const roleEl = document.getElementById('navRoleBadge') || document.getElementById('userRoleBadge');
        const cmdEl = document.getElementById('adminCommandCenter');

        if (nameEl) {
            nameEl.innerText = (currentUser.nama_lengkap || currentUser.username || 'PETUGAS').toUpperCase();
        }

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

    // Memuat seluruh dataset dan statistik dasbor
    await window.loadDashboardData();

    // Inisialisasi Map Picker Form & Makro Spasial Wilayah Sidoarjo
    setTimeout(() => {
        window.initFormMapPicker();
        if (typeof window.initMacroDistributionMap === 'function') {
            window.initMacroDistributionMap();
        }
    }, 350);

    // Inisialisasi Notifikasi & WebRTC
    window.setupNotificationSystemModern();
    window.fetchNotifikasiRealtime();
    setInterval(window.fetchNotifikasiRealtime, 10000);

    if (typeof window.initPeerCall === 'function') {
        window.initPeerCall();
    }
});

// =========================================================================
// 4. MEMUAT DATA DASHBOARD & KALKULASI STATISTIK
// =========================================================================
window.loadDashboardData = async function (showToast = false) {
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/warga?_t=${Date.now()}`) : window.fetchData(`/warga?_t=${Date.now()}`));
        if (!res || !res.ok) return;

        const resData = await res.json();
        let data = Array.isArray(resData) ? resData : (resData.data || []);

        // Sinkronisasi data ke State Manager Terpusat
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

        // Pembaruan Kartu Metrik Statistik
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
// 5. OCR SCAN KTP (AI TESSERACT) & VALIDASI DUKCAPIL
// =========================================================================
window.processOCR = async function (input) {
    if (!input.files || !input.files[0]) return;

    if (typeof Tesseract === 'undefined') {
        return showAdminAlert({
            icon: 'error',
            title: 'Pustaka OCR Belum Siap',
            text: 'Modul Tesseract OCR belum termuat secara sempurna di peramban.'
        });
    }

    showAdminAlert({
        title: 'Memindai KTP (AI OCR)...',
        html: 'Membaca NIK, Nama Lengkap, Tanggal Lahir, dan Alamat...',
        allowOutsideClick: false,
        didOpen: () => Swal?.showLoading()
    });

    try {
        const res = await Tesseract.recognize(input.files[0], 'ind');
        Swal?.close();
        const text = res.data.text || '';

        const nikMatch = text.match(/\b\d{16}\b/);
        if (nikMatch && document.getElementById('nik')) {
            document.getElementById('nik').value = nikMatch[0];
            await window.cekDukcapilLokal();
        }

        const namaMatch = text.match(/(?:Nama|NAMA)\s*[:;]?\s*([A-Za-z\s.,']+)/i);
        if (namaMatch && document.getElementById('nama')) {
            document.getElementById('nama').value = namaMatch[1].trim().replace(/\n/g, '');
        }

        const ttlMatch = text.match(/(?:Tempat\/Tgl Lahir|Tempat\/Tgl|TTL)\s*[:;]?\s*([A-Za-z\s]+)[,\/]\s*(\d{2})[-–\/](\d{2})[-–\/](\d{4})/i);
        if (ttlMatch) {
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = ttlMatch[1].trim();
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = `${ttlMatch[4]}-${ttlMatch[3]}-${ttlMatch[2]}`;
        }

        const alamatMatch = text.match(/(?:Alamat|ALAMAT)\s*[:;]?\s*([A-Za-z0-9\s.,\/-]+?)(?=(?:RT\/RW|Kel\/Desa|Kecamatan|Agama|$))/i);
        if (alamatMatch && document.getElementById('alamat')) {
            document.getElementById('alamat').value = alamatMatch[1].trim().replace(/\n/g, ' ') + ', Sidoarjo';
        }

        if (/LAKI|LAKI-LAKI/i.test(text) && document.getElementById('c4')) document.getElementById('c4').value = "1";
        if (/PEREMPUAN/i.test(text) && document.getElementById('c4')) document.getElementById('c4').value = "2";

        showAdminAlert({
            icon: 'success',
            title: 'Scan KTP Berhasil!',
            text: 'Data identitas berhasil diisi otomatis ke dalam formulir pendataan.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Scan', text: 'Tidak dapat mengenali teks pada berkas KTP.' });
    }
};

window.cekDukcapilLokal = async function () {
    const nikInput = document.getElementById('nik');
    const nik = nikInput ? nikInput.value.trim() : '';

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showAdminAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit angka NIK.' });
    }

    showAdminAlert({ title: 'Memeriksa Data Dukcapil...', didOpen: () => Swal?.showLoading() });

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/api/dukcapil/${nik}`) : window.fetchData(`/api/dukcapil/${nik}`));
        const json = await res.json();
        Swal?.close();

        if (res && res.ok && json.status === 'success') {
            const d = json.data;
            if (document.getElementById('nama')) document.getElementById('nama').value = d.nama;
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = d.tempat_lahir;
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = d.tanggal_lahir;
            if (document.getElementById('alamat')) document.getElementById('alamat').value = d.alamat;
            if (document.getElementById('c4')) document.getElementById('c4').value = d.jenis_kelamin === 'Perempuan' ? '2' : '1';

            showAdminAlert({
                icon: 'success',
                title: 'Data Dukcapil Ditemukan!',
                html: `<b>Nama:</b> ${d.nama}<br><b>TTL:</b> ${d.tempat_lahir}, ${d.tanggal_lahir}<br><b>Alamat:</b> ${d.alamat}`,
                confirmButtonColor: '#10b981'
            });
        } else {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: 'Data NIK tidak ditemukan di basis data Dukcapil Sidoarjo.' });
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal menghubungi peladen Dukcapil.' });
    }
};

// =========================================================================
// 6. GEOTAGGING FORM PENDAFTARAN (PICKER PETA LEAFLET)
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
            () => showAdminAlert({ icon: 'error', title: 'GPS Gagal', text: 'Mohon izinkan akses lokasi pada peramban Anda.' })
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

    // Grafik Desil 1 - 10
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

    // Grafik Persetujuan (Valid vs Menunggu)
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

    // Grafik Status Distribusi Penyaluran
    const ctxSalur = document.getElementById('chartPenyaluran');
    if (ctxSalur) {
        const telahMenerima = data.filter(w => w.status_salur === 'Telah Menerima').length;
        const belumMenerima = total - telahMenerima;
        if (chartPenyaluranObj) chartPenyaluranObj.destroy();
        chartPenyaluranObj = new Chart(ctxSalur, {
            type: 'doughnut',
            data: {
                labels: ['Telah Disalurkan', 'Menunggu Salur'],
                datasets: [{
                    data: [telahMenerima, belumMenerima],
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

    // Grafik Pemantauan Sengketa Lapangan
    const ctxSengketa = document.getElementById('chartSengketa');
    if (ctxSengketa) {
        const kasusSengketa = data.filter(w => String(w.status_salur).includes('Sengketa')).length;
        const bebasSengketa = total - kasusSengketa;
        if (chartSengketaObj) chartSengketaObj.destroy();
        chartSengketaObj = new Chart(ctxSengketa, {
            type: 'doughnut',
            data: {
                labels: ['Bebas Sengketa', 'Laporan Sengketa'],
                datasets: [{
                    data: [bebasSengketa, kasusSengketa],
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
// 8. CRUD DATA WARGA, FILTERING & SORTING
// =========================================================================
window.tambahData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const formEl = document.getElementById('bansosForm');
    const formData = new FormData(formEl);

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
        const fotoInput = document.getElementById('fotoRumah') || document.getElementById('fotoKtp');
        let res;

        if (fotoInput && fotoInput.files && fotoInput.files[0]) {
            res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga', { method: 'POST', body: formData }) : window.fetchData('/warga', { method: 'POST', body: formData }));
        } else {
            res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga', { method: 'POST', body: payload }) : window.fetchData('/warga', { method: 'POST', body: JSON.stringify(payload) }));
        }

        const json = await res.json();
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Berhasil', text: json.message || 'Data warga berhasil disimpan!' });
            formEl?.reset();
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
        const query = window.selectedTanggalDaftar;
        filtered = filtered.filter(w => {
            const raw = String(w.created_at || '').toLowerCase();
            return raw.includes(query);
        });
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
            ? `<span class="badge badge-green" style="background:#e6f9f0; color:#009846; border:1px solid #a7f3d0; padding:5px 12px; border-radius:20px; font-weight:800; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;"><i class="fas fa-check-circle"></i> DISETUJUI</span>`
            : `<span class="badge badge-red" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:5px 12px; border-radius:20px; font-weight:800; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;"><i class="fas fa-clock"></i> MENUNGGU</span>`;

        let desilBadge = '';
        if (isVerified) {
            desilBadge = desil <= 4
                ? `<span class="badge badge-green" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-award"></i> Layak Bansos (Desil ${desil})</span>`
                : `<span class="badge badge-warning" style="font-size:0.7rem; margin-top:3px; background:#fffbeb; color:#b45309; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> Tidak Prioritas (Desil ${desil})</span>`;
        }

        let statusSalurBadge = '';
        if (w.status_salur === 'Telah Menerima') {
            statusSalurBadge = `<span class="badge badge-blue" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-box-check"></i> Telah Menerima</span>`;
        } else if (String(w.status_salur).includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-exclamation-triangle"></i> Sengketa</span>`;
        }

        const btnToggleVerif = isVerified
            ? `<button onclick="window.toggleVerifySingle(${w.id}, '${window.escapeInlineJS(w.nama)}')" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:white; color:#334155;"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.toggleVerifySingle(${w.id}, '${window.escapeInlineJS(w.nama)}')" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:#009846; color:white;"><i class="fas fa-check"></i> Setujui</button>`;

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

// =========================================================================
// 10. AKSI PERSETUJUAN & PEMBATALAN MASSAL
// =========================================================================
window.verifyAllData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const checkedBoxes = Array.from(document.querySelectorAll('.row-checkbox:checked'))
        .map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const payload = checkedBoxes.length > 0 ? { ids: checkedBoxes } : {};

    showAdminAlert({ title: 'Memproses Persetujuan...', didOpen: () => Swal?.showLoading() });
    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga/bulk/verify', { method: 'POST', body: payload }) : window.fetchData('/warga/bulk/verify', { method: 'POST', body: JSON.stringify(payload) }));
        if (res && res.ok) {
            showAdminAlert({ icon: 'success', title: 'Sukses', text: 'Data warga berhasil disetujui sebagai penerima bansos.' });
            await window.loadDashboardData();
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal memproses persetujuan massal.' });
    }
};

window.unverifyAllData = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const checkedBoxes = Array.from(document.querySelectorAll('.row-checkbox:checked'))
        .map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const payload = checkedBoxes.length > 0 ? { ids: checkedBoxes } : {};

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

// =========================================================================
// 11. MODAL EDIT, HAPUS, & PENANGANAN BUKTI SALUR / SENGKETA
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

    if (document.getElementById('editC1')) document.getElementById('editC1').value = w.c1_ekonomi || 0;
    if (document.getElementById('editC2')) document.getElementById('editC2').value = w.c2_aset || 0;
    if (document.getElementById('editC3')) document.getElementById('editC3').value = w.c3_umur || 0;
    if (document.getElementById('editC4')) document.getElementById('editC4').value = w.c4_jenis_kelamin || 1;
    if (document.getElementById('editC5')) document.getElementById('editC5').value = w.c5_tanggungan || 0;
    if (document.getElementById('editC6')) document.getElementById('editC6').value = w.c6_status_pernikahan || 1;
    if (document.getElementById('editC7')) document.getElementById('editC7').value = w.c7_kepemilikan_anak || 0;
    if (document.getElementById('editC8')) document.getElementById('editC8').value = w.c8_tempat_tinggal || 1;
    if (document.getElementById('editC9')) document.getElementById('editC9').value = w.c9_pendidikan || 1;
    if (document.getElementById('editC10')) document.getElementById('editC10').value = w.c10_kesehatan || 1;

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
        c10: parseInt(document.getElementById('editC10')?.value || 1)
    };

    const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}`, { method: 'PUT', body: payload }) : window.fetchData(`/warga/${id}`, { method: 'PUT', body: JSON.stringify(payload) }));
    if (res && res.ok) {
        showAdminAlert({ icon: 'success', title: 'Berhasil', text: 'Data warga berhasil diperbarui.' });
        window.closeModal('modalEdit');
        window.loadDashboardData();
    }
};

window.hapusData = async function (id) {
    const konfirmasi = confirm('Apakah Anda yakin ingin menghapus data warga ini?');
    if (konfirmasi) {
        await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}`, { method: 'DELETE' }) : window.fetchData(`/warga/${id}`, { method: 'DELETE' }));
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
            <label style="font-weight:700; display:block; margin:10px 0 5px 0;">Pilih / Ambil Foto Dokumentasi:</label>
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
            const res = await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}/bukti-salur`, { method: 'POST', body: formData }) : window.fetchData(`/warga/${id}/bukti-salur`, { method: 'POST', body: formData }));
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
            Pilih tindakan penanganan terhadap status verifikasi/penyaluran warga ini:
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
            await (window.fetchWithAuth ? window.fetchWithAuth(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: { aksi } }) : window.fetchData(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi }) }));
            window.loadDashboardData();
        }
    });
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
        return showAdminAlert({ icon: 'error', title: 'Pustaka Tidak Tersedia', text: 'Modul SheetJS (xlsx.full.min.js) belum termuat.' });
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
        'Desil': w.desil || 5,
        'Nominal Bantuan': w.nominal_bantuan || 'Rp 600.000',
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

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

            showAdminAlert({ title: 'Mengimpor Data...', didOpen: () => Swal?.showLoading() });
            const res = await (window.fetchWithAuth ? window.fetchWithAuth('/warga/bulk', { method: 'POST', body: { data: rawJson } }) : window.fetchData('/warga/bulk', { method: 'POST', body: JSON.stringify({ data: rawJson }) }));
            input.value = '';

            if (res && res.ok) {
                showAdminAlert({ icon: 'success', title: 'Sukses', text: 'Data warga berhasil diselaraskan ke dalam basis data.' });
                await window.loadDashboardData(true);
            }
        } catch (err) {
            input.value = '';
            showAdminAlert({ icon: 'error', title: 'Error', text: 'Gagal memproses berkas Excel.' });
        }
    };
    reader.readAsArrayBuffer(file);
};

// =========================================================================
// 13. KELOLA PENGGUNA (ADMIN ONLY) & NOTIFIKASI REAL-TIME
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
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/users') : window.fetchData('/users'));
        const users = await res.json();
        tbody.innerHTML = '';
        users.forEach((u, idx) => {
            const btnDel = u.username !== 'admin'
                ? `<button onclick="window.hapusUser(${u.id}, '${window.escapeInlineJS(u.username)}')" class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border-radius:8px; padding:4px 8px;"><i class="fas fa-trash"></i></button>`
                : '<span style="font-size:0.75rem; color:#64748b; font-weight:700;">Akun Utama</span>';

            tbody.innerHTML += `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="font-weight:700; color:#64748b; text-align:center;">#${u.id}</td>
                    <td><b style="color:#0f172a;">${window.safeHtml(u.username)}</b><br><small class="text-muted">${window.safeHtml(u.email || '-')}</small></td>
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

    const res = await (window.fetchWithAuth ? window.fetchWithAuth('/users', { method: 'POST', body: payload }) : window.fetchData('/users', { method: 'POST', body: JSON.stringify(payload) }));
    if (res && res.ok) {
        showAdminAlert({ toast: true, position: 'top-end', icon: 'success', title: 'Akun berhasil ditambahkan!', timer: 1500, showConfirmButton: false });
        document.getElementById('formUser')?.reset();
        window.loadTablePengguna();
    }
};

window.hapusUser = async function (id, username) {
    const konfirmasi = confirm(`Hapus akun dinas "${username}"?`);
    if (konfirmasi) {
        await (window.fetchWithAuth ? window.fetchWithAuth(`/users/${id}`, { method: 'DELETE' }) : window.fetchData(`/users/${id}`, { method: 'DELETE' }));
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
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/notifikasi') : window.fetchData('/api/notifikasi'));
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
            <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${n.is_read ? '#fff' : '#f0fdf4'};">
                <p style="margin:0; font-size:0.85rem; color:#1e293b;">${window.safeHtml(n.pesan)}</p>
                <small style="color:#64748b; font-size:0.75rem;"><i class="fas fa-clock"></i> ${n.waktu}</small>
            </div>
        `).join('') : '<div style="padding:20px; text-align:center; color:#94a3b8;">Tidak ada notifikasi baru.</div>';
    } catch (e) { }
};

// =========================================================================
// 14. HELPER MODAL & LOGOUT
// =========================================================================
window.toggleSelectAll = function (source) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = source.checked;
    });
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

// Pasang delegasi event untuk tombol hitung SPK BWM-SAW (RBAC Admin)
document.addEventListener('click', async (e) => {
    const btnHitung = e.target.closest('#btnHitungSpk');
    if (btnHitung) {
        e.preventDefault();
        showAdminAlert({ title: 'Menjalankan SPK BWM-SAW...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });
        try {
            const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/spk/hitung', { method: 'POST' }) : window.fetchData('/api/spk/hitung', { method: 'POST' }));
            const json = await res.json();
            if (res && res.ok) {
                showAdminAlert({ icon: 'success', title: 'Perhitungan Selesai', text: json.message || 'Perankingan SPK berhasil diperbarui.' });
                await window.loadDashboardData();
            } else {
                showAdminAlert({ icon: 'error', title: 'Gagal SPK', text: json.message || 'Gagal mengeksekusi komputasi SPK.' });
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Error', text: 'Koneksi ke engine SPK backend terputus.' });
        }
    }
});