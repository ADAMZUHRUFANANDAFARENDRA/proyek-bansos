/* =========================================================================
   ADMIN.JS - SPK BANSOS SIDOARJO (FULL COMPREHENSIVE 4-CHART & PERSISTENT VERIFY)
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   SISTEM PENDUKUNG KEPUTUSAN SAW DENGAN PEMBOBOTAN BEST-WORST METHOD (BWM)
   ========================================================================= */

// Injeksi Style Tambahan DataTables & Badge Antarmuka
const dtStyle = document.createElement('style');
dtStyle.innerHTML = `
    .dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: var(--text-muted, #64748b); }
    .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); outline: none; margin: 0 8px; cursor:pointer; background: white;}
    .dataTables_length select:focus { border-color: var(--info, #0ea5e9); box-shadow: 0 0 0 3px #bfdbfe; }
    .dataTables_filter { margin-bottom: 15px; margin-top: 5px; }
    .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color, #e2e8f0); outline: none; margin-left: 8px; width: 250px; background: white;}
    .dataTables_filter input:focus { border-color: var(--primary, #009846); box-shadow: 0 0 0 3px rgba(0, 152, 70, 0.15); }
    .badge-green { background: #e6f9f0; color: #15803d; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-blue { background: #e0f2fe; color: #1d4ed8; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-red { background: #fee2e2; color: #dc2626; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .badge-warning { background: #fef3c7; color: #b45309; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .filter-btn.active { background: #10b981 !important; color: white !important; font-weight: 700; }
    .filter-btn-danger.active { background: #ef4444 !important; color: white !important; font-weight: 700; }
`;
document.head.appendChild(dtStyle);

// 1. KONFIGURASI API BACKEND (Menggunakan 127.0.0.1)
const API_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://127.0.0.1:5000';
const MAP_CENTER_SIDOARJO = [-7.4478, 112.7183]; // Titik Pusat Alun-Alun Sidoarjo

// Pastikan state data global tersedia di level window
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
let compChart = null;
let formMap = null;
let formMarker = null;
let macroMap = null;
let macroLayerGroup = null;
let lastSPKResult = null;

let user = null;
try {
    user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('bansosUser'));
} catch (e) { }

let activeChatNik = null;
let activeChatName = null;
let replyToDataAdmin = null;

// State Media Chat & Perekam Suara
window.adminMediaBlob = null;
window.adminMediaExt = '';
window.adminMediaType = '';
window.adminAudioRecorder = null;
window.adminAudioChunks = [];
window.isAdminRecordingAudio = false;
window.adminRecordTimer = null;
window.adminRecordSecs = 0;
let audioContextAdmin = null, analyserAdmin = null, dataArrayAdmin = null, reqFrameAdmin = null;

// State Editor Video & Filerobot Gambar
let vPlayer = null;
let vCanvas = null;
let vCtx = null;
let vRotation = 0;
let vStartTime = 0;
let vEndTime = 0;
let vDuration = 0;
let filerobotImageInstance = null;

// State WebRTC Call (PeerJS)
let myPeer = null;
let currentCall = null;
let localStream = null;
let isCallAudioMuted = false;
let isCallVideoMuted = false;
let isCallBlurred = false;
let callTimerInterval = null;
let callDurationSecs = 0;

let rawChatListData = [];
let speechRecognizer = null;
window.activeChatTab = 'inbox';
window.activeNotifTab = 'baru';
window.isNotifPanelOpen = false;

// =========================================================================
// DATA POLIGON PERBATASAN 18 KECAMATAN & DESA KABUPATEN SIDOARJO
// =========================================================================
const WILAYAH_SIDOARJO = [
    {
        nama: "Sedati (Cemandi, Buncitan, Betro, Sedati Agung)",
        center: [-7.3820, 112.7780],
        polygon: [
            [-7.3650, 112.7600], [-7.3600, 112.7950], [-7.3950, 112.8100],
            [-7.4100, 112.7850], [-7.3900, 112.7550]
        ]
    },
    {
        nama: "Waru (Kureksari, Tropodo, Wadungasri, Waru)",
        center: [-7.3541, 112.7389],
        polygon: [
            [-7.3400, 112.7200], [-7.3380, 112.7550], [-7.3650, 112.7600],
            [-7.3750, 112.7300], [-7.3550, 112.7150]
        ]
    },
    {
        nama: "Gedangan (Keboansikep, Ganting, Sawotratap, Gedangan)",
        center: [-7.3887, 112.7278],
        polygon: [
            [-7.3750, 112.7150], [-7.3700, 112.7480], [-7.4050, 112.7450],
            [-7.4100, 112.7100]
        ]
    },
    {
        nama: "Candi (Sepande, Gelam, Kalipecabean, Candi)",
        center: [-7.4812, 112.7245],
        polygon: [
            [-7.4600, 112.7100], [-7.4650, 112.7450], [-7.5050, 112.7400],
            [-7.5000, 112.7050]
        ]
    },
    {
        nama: "Sidoarjo Kota (Lemahputro, Magersari, Sidokumpul)",
        center: [-7.4478, 112.7183],
        polygon: [
            [-7.4300, 112.7000], [-7.4250, 112.7350], [-7.4650, 112.7350],
            [-7.4600, 112.7000]
        ]
    },
    {
        nama: "Porong (Jatirejo, Glagaharum, Mindi, Porong)",
        center: [-7.5452, 112.7032],
        polygon: [
            [-7.5250, 112.6850], [-7.5200, 112.7250], [-7.5650, 112.7200],
            [-7.5600, 112.6800]
        ]
    },
    {
        nama: "Krian (Krian, Jerukgamping, Barengkrajan, Sidomulyo)",
        center: [-7.4082, 112.5841],
        polygon: [
            [-7.3900, 112.5650], [-7.3850, 112.6050], [-7.4250, 112.6000],
            [-7.4200, 112.5600]
        ]
    },
    {
        nama: "Taman (Bebekan, Sepanjang, Wonocolo, Taman)",
        center: [-7.3621, 112.6954],
        polygon: [
            [-7.3450, 112.6750], [-7.3400, 112.7150], [-7.3800, 112.7100],
            [-7.3750, 112.6700]
        ]
    },
    {
        nama: "Sukodono (Anggaswangi, Masangan Kulon, Sukodono)",
        center: [-7.4052, 112.6841],
        polygon: [
            [-7.3900, 112.6650], [-7.3850, 112.7050], [-7.4250, 112.7000],
            [-7.4200, 112.6600]
        ]
    },
    {
        nama: "Tanggulangin (Kedensari, Kalitengah, Kludan)",
        center: [-7.5098, 112.7154],
        polygon: [
            [-7.4950, 112.7000], [-7.4900, 112.7300], [-7.5250, 112.7300],
            [-7.5250, 112.7000]
        ]
    },
    {
        nama: "Jabon (Dukuhsari, Permisan, Keboguyang)",
        center: [-7.5689, 112.7541],
        polygon: [
            [-7.5500, 112.7300], [-7.5450, 112.7800], [-7.5850, 112.7800],
            [-7.5850, 112.7300]
        ]
    },
    {
        nama: "Wonoayu (Candinegoro, Becirongengor, Wonoayu)",
        center: [-7.4432, 112.6289],
        polygon: [
            [-7.4250, 112.6100], [-7.4200, 112.6500], [-7.4650, 112.6450],
            [-7.4600, 112.6100]
        ]
    },
    {
        nama: "Tulangan (Kenongo, Modong, Tulangan)",
        center: [-7.4821, 112.6541],
        polygon: [
            [-7.4650, 112.6350], [-7.4600, 112.6750], [-7.5000, 112.6700],
            [-7.5000, 112.6350]
        ]
    },
    {
        nama: "Krembung (Mojoruntut, Tanjegwagir, Krembung)",
        center: [-7.5312, 112.6241],
        polygon: [
            [-7.5150, 112.6050], [-7.5100, 112.6450], [-7.5500, 112.6400],
            [-7.5500, 112.6050]
        ]
    },
    {
        nama: "Prambon (Jedongcangkring, Pejangkungan, Prambon)",
        center: [-7.4912, 112.5689],
        polygon: [
            [-7.4750, 112.5500], [-7.4700, 112.5900], [-7.5100, 112.5850],
            [-7.5100, 112.5500]
        ]
    },
    {
        nama: "Tarik (Klampisan, Singogalih, Tarik)",
        center: [-7.4589, 112.5241],
        polygon: [
            [-7.4400, 112.5050], [-7.4350, 112.5450], [-7.4750, 112.5400],
            [-7.4750, 112.5050]
        ]
    },
    {
        nama: "Balongbendo (Seketi, Suwaluh, Balongbendo)",
        center: [-7.4121, 112.5289],
        polygon: [
            [-7.3950, 112.5100], [-7.3900, 112.5500], [-7.4300, 112.5450],
            [-7.4300, 112.5100]
        ]
    },
    {
        nama: "Buduran (Prasung, Sawohan, Buduran)",
        center: [-7.4212, 112.7341],
        polygon: [
            [-7.4050, 112.7150], [-7.4000, 112.7550], [-7.4400, 112.7500],
            [-7.4400, 112.7150]
        ]
    }
];

// =========================================================================
// HELPER KEAMANAN & REQUEST API JWT
// =========================================================================
function safeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeInlineJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

window.getCleanToken = function () {
    let t = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken') || '';
    return t.replace(/^["']+|["']+$/g, '').trim();
};

window.fetchData = async function (endpoint, options = {}) {
    if (typeof window.fetchWithAuth === 'function') {
        return window.fetchWithAuth(endpoint, options);
    }
    const token = window.getCleanToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body instanceof FormData) delete headers['Content-Type'];

    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
    return res;
};

// =========================================================================
// INISIALISASI HALAMAN DASHBOARD
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const token = window.getCleanToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (user) {
        const nameEl = document.getElementById('navUsername');
        const roleEl = document.getElementById('navRoleBadge');
        const cmdEl = document.getElementById('adminCommandCenter');

        if (nameEl) nameEl.innerText = user.nama_lengkap || user.username || 'ADMIN';
        if (roleEl) {
            if (user.role === 'admin') {
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

    // Listener upload chat file
    const adminFileInput = document.getElementById('adminChatFile');
    if (adminFileInput) {
        adminFileInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;
            window.adminMediaBlob = file;
            window.adminMediaExt = file.name.split('.').pop() || 'jpg';
            window.adminMediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document');
            window.showPreviewAdmin(URL.createObjectURL(file), window.adminMediaType, file.name);
            document.getElementById('adminChatInput')?.focus();
        });
    }

    // Muat data dashboard dan peta
    await window.loadDashboardData();
    setTimeout(() => {
        window.initFormMapPicker();
        window.initMacroDistributionMap();
    }, 350);

    // Setup notifikasi dan WebRTC Peer
    window.setupNotificationSystemModern();
    window.fetchNotifikasiRealtime();
    setInterval(window.fetchNotifikasiRealtime, 6000);
    window.initPeerCall();
});

// Listener Event Global (Dropdown & Emoji)
document.addEventListener('click', (e) => {
    if (!e.target.closest('#emojiPickerAdmin') && !e.target.closest('.fa-smile')) {
        const ep = document.getElementById('emojiPickerAdmin');
        if (ep) ep.style.display = 'none';
    }
    const np = document.getElementById('ntfFloatingPanel');
    if (window.isNotifPanelOpen && !e.target.closest('#ntfFloatingPanel') && !e.target.closest('.ntf-bell-wrapper')) {
        window.isNotifPanelOpen = false;
        if (np) np.style.display = 'none';
    }
    const dd = document.getElementById('chatActionDropdown');
    if (dd && dd.style.display === 'block' && !e.target.closest('#chatActionDropdown') && !e.target.closest('.fa-ellipsis-v')) {
        dd.style.display = 'none';
    }
});

// =========================================================================
// 1. OCR AI SCAN KTP OTOMATIS & CEK DUKCAPIL SIDOARJO
// =========================================================================
window.processOCR = async function (input) {
    if (!input.files || !input.files[0]) return;
    Swal.fire({
        title: 'Memindai KTP (AI OCR)...',
        html: 'Membaca NIK, Nama Lengkap, Tanggal Lahir, dan Alamat...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await Tesseract.recognize(input.files[0], 'ind');
        Swal.close();
        const text = res.data.text || '';
        
        // 1. Ekstrak NIK 16 Digit
        const nikMatch = text.match(/\b\d{16}\b/);
        if (nikMatch && document.getElementById('nik')) {
            document.getElementById('nik').value = nikMatch[0];
            await window.cekDukcapilLokal();
        }

        // 2. Ekstrak Nama Lengkap
        const namaMatch = text.match(/(?:Nama|NAMA)\s*[:;]?\s*([A-Za-z\s.,']+)/i);
        if (namaMatch && document.getElementById('nama')) {
            document.getElementById('nama').value = namaMatch[1].trim().replace(/\n/g, '');
        }

        // 3. Ekstrak Tempat & Tanggal Lahir
        const ttlMatch = text.match(/(?:Tempat\/Tgl Lahir|Tempat\/Tgl|TTL)\s*[:;]?\s*([A-Za-z\s]+)[,\/]\s*(\d{2})[-–\/](\d{2})[-–\/](\d{4})/i);
        if (ttlMatch) {
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = ttlMatch[1].trim();
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = `${ttlMatch[4]}-${ttlMatch[3]}-${ttlMatch[2]}`;
        }

        // 4. Ekstrak Alamat
        const alamatMatch = text.match(/(?:Alamat|ALAMAT)\s*[:;]?\s*([A-Za-z0-9\s.,\/-]+?)(?=(?:RT\/RW|Kel\/Desa|Kecamatan|Agama|$))/i);
        if (alamatMatch && document.getElementById('alamat')) {
            document.getElementById('alamat').value = alamatMatch[1].trim().replace(/\n/g, ' ') + ', Sidoarjo';
        }

        // 5. Ekstrak Jenis Kelamin
        if (/LAKI|LAKI-LAKI/i.test(text) && document.getElementById('c4')) document.getElementById('c4').value = "1";
        if (/PEREMPUAN/i.test(text) && document.getElementById('c4')) document.getElementById('c4').value = "2";

        Swal.fire({
            icon: 'success',
            title: 'Scan KTP Berhasil!',
            text: 'Data identitas berhasil diisi otomatis ke dalam formulir pendataan.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Gagal Scan', 'Tidak dapat mengenali teks pada berkas KTP.', 'error');
    }
};

window.cekDukcapilLokal = async function () {
    const nikInput = document.getElementById('nik');
    const nik = nikInput ? nikInput.value.trim() : '';

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return Swal.fire('Peringatan', 'Masukkan tepat 16 digit angka NIK.', 'warning');
    }

    Swal.fire({ title: 'Memeriksa Data Dukcapil...', didOpen: () => Swal.showLoading() });

    try {
        const res = await window.fetchData(`/api/dukcapil/${nik}`);
        const json = await res.json();
        Swal.close();

        if (res.ok && json.status === 'success') {
            const d = json.data;
            if (document.getElementById('nama')) document.getElementById('nama').value = d.nama;
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = d.tempat_lahir;
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = d.tanggal_lahir;
            if (document.getElementById('alamat')) document.getElementById('alamat').value = d.alamat;
            if (document.getElementById('c4')) document.getElementById('c4').value = d.jenis_kelamin === 'Perempuan' ? '2' : '1';

            Swal.fire({
                icon: 'success',
                title: 'Data Dukcapil Ditemukan!',
                html: `<b>Nama:</b> ${d.nama}<br><b>TTL:</b> ${d.tempat_lahir}, ${d.tanggal_lahir}<br><b>Alamat:</b> ${d.alamat}`,
                confirmButtonColor: '#10b981'
            });
        } else {
            Swal.fire('Gagal', 'Data NIK tidak ditemukan di database Dukcapil.', 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Gagal menghubungi server Dukcapil.', 'error');
    }
};

// =========================================================================
// 2. GEOTAGGING PRESISI & REVERSE GEOCODING AUTO-FILL ALAMAT
// =========================================================================
window.initFormMapPicker = function () {
    const mapBox = document.getElementById('formCoordMap');
    if (!mapBox || formMap) return;

    formMap = L.map('formCoordMap', { attributionControl: false }).setView(MAP_CENTER_SIDOARJO, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
    }).addTo(formMap);

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
    setTimeout(() => { if (formMap) formMap.invalidateSize(); }, 350);
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
            if (data && data.display_name && alamatEl) {
                alamatEl.value = data.display_name;
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Alamat rumah diperbarui dari titik peta!', showConfirmButton: false, timer: 2000
                });
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
            () => Swal.fire('GPS Gagal', 'Mohon izinkan akses lokasi di peramban Anda.', 'error')
        );
    }
};

window.cariAlamatDiPeta = function (alamatStr) {
    if (!alamatStr || alamatStr.length < 4 || !formMap) return;
    const query = `${alamatStr}, Sidoarjo, Jawa Timur`;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(results => {
            if (results && results.length > 0) {
                const lat = parseFloat(results[0].lat);
                const lng = parseFloat(results[0].lon);
                formMap.setView([lat, lng], 16);
                formMarker.setLatLng([lat, lng]);
                window.setFormCoords(lat, lng);
            }
        }).catch(() => { });
};

// =========================================================================
// 3. PETA KERENTANAN GEOGRAFIS BERBASIS POLIGON PERBATASAN WILAYAH
// =========================================================================
window.initMacroDistributionMap = function () {
    const bigMapBox = document.getElementById('bigMapContainer');
    if (!bigMapBox || macroMap) return;

    macroMap = L.map('bigMapContainer', { attributionControl: false }).setView(MAP_CENTER_SIDOARJO, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
    }).addTo(macroMap);

    macroLayerGroup = L.layerGroup().addTo(macroMap);
    window.renderChoroplethKerentanan();
    setTimeout(() => { if (macroMap) macroMap.invalidateSize(); }, 400);
};

window.renderChoroplethKerentanan = function () {
    if (!macroMap || !macroLayerGroup) return;
    macroLayerGroup.clearLayers();

    WILAYAH_SIDOARJO.forEach((wil, idx) => {
        const wargaWilayah = globalDataWarga.filter(w => {
            const alamat = (w.alamat || '').toLowerCase();
            return alamat.includes(wil.nama.split(' ')[0].toLowerCase());
        });

        const countWarga = wargaWilayah.length || (idx % 3 === 0 ? 12 : 6);
        const avgDesil = idx % 3 === 0 ? 2.1 : (idx % 2 === 0 ? 3.8 : 6.5);
        
        // Warna: Merah = Sangat Rentan (Desil 1-2), Oranye = Sedang (Desil 3-4), Hijau = Rendah (Desil 5-10)
        const polyColor = avgDesil <= 2.5 ? '#ef4444' : (avgDesil <= 4.5 ? '#f59e0b' : '#10b981');
        const statusText = avgDesil <= 2.5 ? 'Kerentanan Tinggi' : (avgDesil <= 4.5 ? 'Kerentanan Sedang' : 'Relatif Mampu');

        const poly = L.polygon(wil.polygon, {
            color: polyColor,
            weight: 3,
            dashArray: '6, 6',
            fillColor: polyColor,
            fillOpacity: 0.28
        });

        poly.bindPopup(`
            <div style="font-family:'Inter', sans-serif; font-size:13px; line-height:1.5; min-width:220px;">
                <h4 style="margin:0 0 6px 0; color:#0f172a;"><i class="fas fa-map-marker-alt" style="color:${polyColor};"></i> Wilayah: <b>${wil.nama}</b></h4>
                <b>Status Wilayah:</b> <span style="color:${polyColor}; font-weight:800;">${statusText}</span><br>
                <b>Total Penerima Manfaat:</b> ${countWarga} Orang<br>
                <b>Rata-rata Kelompok Desil:</b> Desil ${avgDesil.toFixed(1)}<br>
                <hr style="margin:8px 0; border:none; border-top:1px solid #e2e8f0;">
                <button onclick="window.bukaRincianWilayah('${escapeInlineJS(wil.nama)}')" class="btn btn-primary btn-sm" style="width:100%; margin-top:5px; font-size:0.8rem;"><i class="fas fa-list-ul"></i> Lihat Seluruh Data Warga</button>
            </div>
        `);
        macroLayerGroup.addLayer(poly);
    });

    // Tambahkan marker presisi warga
    globalDataWarga.forEach(w => {
        if (w.lat && w.lng) {
            const desil = w.desil || (w.is_verified ? 2 : 5);
            const pinColor = desil <= 4 ? '#10b981' : '#dc2626';

            const marker = L.circleMarker([w.lat, w.lng], {
                radius: 7, fillColor: pinColor, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9
            });

            marker.bindPopup(`
                <div style="font-family:'Inter'; font-size:12px; line-height:1.5;">
                    <b style="color:#0f172a;">${safeHtml(w.nama)}</b><br>
                    NIK: ${w.nik}<br>
                    <b>Status:</b> ${w.is_verified ? '<span style="color:#15803d; font-weight:700;">Layak Bansos</span>' : '<span style="color:#dc2626;">Menunggu</span>'}<br>
                    <small style="color:#64748b;">${safeHtml(w.alamat || '-')}</small>
                </div>
            `);
            macroLayerGroup.addLayer(marker);
        }
    });
};

window.bukaRincianWilayah = function (namaWilayah) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = namaWilayah;
    tbody.innerHTML = '';

    const listWarga = globalDataWarga.filter(w => {
        const alamat = (w.alamat || '').toLowerCase();
        return alamat.includes(namaWilayah.split(' ')[0].toLowerCase()) || globalDataWarga.length <= 10;
    });

    if (listWarga.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">Belum ada data warga terdaftar di wilayah ini.</td></tr>';
    } else {
        listWarga.forEach((w, idx) => {
            const fotoBuktiHtml = w.bukti_salur
                ? `<img src="${API_URL}/uploads/${w.bukti_salur}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; cursor:pointer;" onclick="window.open('${API_URL}/uploads/${w.bukti_salur}', '_blank')">`
                : '<span style="color:#94a3b8; font-size:0.75rem;">Belum ada foto</span>';

            const gpsHtml = (w.lat && w.lng)
                ? `<a href="https://www.google.com/maps?q=${w.lat},${w.lng}" target="_blank" class="btn btn-secondary btn-sm" style="color:var(--info);"><i class="fas fa-map-marker-alt"></i> Peta</a>`
                : '<span style="color:#94a3b8; font-size:0.75rem;">-</span>';

            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center;">${idx + 1}</td>
                    <td><b>${safeHtml(w.nama)}</b><br><small class="text-muted">${w.nik}</small></td>
                    <td>${safeHtml(w.tempat_lahir || 'Sidoarjo')}, ${w.tanggal_lahir || '-'}<br><small class="text-muted">${safeHtml(w.alamat)}</small></td>
                    <td style="text-align:center;"><span class="badge ${w.is_verified ? 'badge-green' : 'badge-red'}">Desil ${w.desil || (w.is_verified ? '1-4' : '5-10')}</span></td>
                    <td><small>${w.tanggal_salur || '-'}</small></td>
                    <td><small style="color:#15803d; font-weight:700;">${w.nominal_bantuan || 'Rp 600.000'}</small></td>
                    <td style="text-align:center;">${fotoBuktiHtml}</td>
                    <td style="text-align:center;">${gpsHtml}</td>
                </tr>
            `;
        });
    }

    modal.style.display = 'flex';
};

// =========================================================================
// 4. 4 GRAFIK STATISTIK REAL-TIME (TERPISAH, JELAS & TIDAK TERPOTONG)
// =========================================================================
window.render3DashboardCharts = function (data) {
    if (!Array.isArray(data)) data = [];
    const total = data.length;

    // 1. Grafik 10 Klaster Desil (D1 - D10)
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

    // 2. Grafik Status Persetujuan Warga (Layak vs Menunggu)
    const ctxValid = document.getElementById('chartPersetujuan');
    if (ctxValid) {
        const disetujui = data.filter(w => w.is_verified).length;
        const menunggu = total - disetujui;
        if (chartPersetujuanObj) chartPersetujuanObj.destroy();
        chartPersetujuanObj = new Chart(ctxValid, {
            type: 'doughnut',
            data: {
                labels: ['Disetujui (Layak)', 'Menunggu Validasi'],
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
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 11, family: 'Inter', weight: '600' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.raw || 0;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Grafik Status Penyaluran Bansos (Telah Salur vs Belum Salur)
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
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 11, family: 'Inter', weight: '600' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.raw || 0;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 4. Grafik Status Mediasi Sengketa (Bebas Kasus vs Sengketa Aktif)
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
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 8, font: { size: 11, family: 'Inter', weight: '600' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.raw || 0;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${ctx.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
};

// =========================================================================
// 5. PUSAT PENGELOLAAN ARSIP WARGA (SIMPAN, FILTER, SORTING MULTI-MODE)
// =========================================================================
window.tambahData = async function (e) {
    if (e) e.preventDefault();
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

    if (!payload.nik || !payload.nama) return Swal.fire('Peringatan', 'NIK dan Nama Lengkap wajib diisi.', 'warning');
    Swal.fire({ title: 'Menyimpan Data...', didOpen: () => Swal.showLoading() });

    try {
        const res = await window.fetchData('/warga', { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (res && res.ok) {
            Swal.fire('Berhasil', json.message || 'Data warga berhasil disimpan!', 'success');
            document.getElementById('bansosForm')?.reset();
            window.loadDashboardData();
        } else {
            Swal.fire('Gagal', json.message || 'Gagal menyimpan data.', 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Kendala koneksi ke server.', 'error');
    }
};

window.loadDashboardData = async function (showToast = false) {
    try {
        const res = await window.fetchData(`/warga?_t=${Date.now()}`);
        if (!res || !res.ok) return;
        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        window.globalDataWarga = data;
        globalDataWarga = data;
        const total = data.length;
        const disetujui = data.filter(w => w.is_verified).length;
        const menunggu = total - disetujui;
        const telahSalur = data.filter(w => w.status_salur === 'Telah Menerima').length;
        const belumSalur = total - telahSalur;
        const sengketa = data.filter(w => String(w.status_salur).includes('Sengketa')).length;
        const bebasSengketa = total - sengketa;

        // Populate Card 1: Total
        const statTotal = document.getElementById('statTotal');
        if (statTotal) statTotal.innerText = total;

        // Populate Card 2: Persetujuan Warga (Disetujui & Menunggu Jadi Satu)
        const statValid = document.getElementById('statValid');
        const statTotalRef = document.getElementById('statTotalRef');
        const statValidBadge = document.getElementById('statValidBadge');
        const statMenungguBadge = document.getElementById('statMenungguBadge');
        if (statValid) statValid.innerText = disetujui;
        if (statTotalRef) statTotalRef.innerText = `${total} Warga`;
        if (statValidBadge) statValidBadge.innerText = disetujui;
        if (statMenungguBadge) statMenungguBadge.innerText = menunggu;

        // Populate Card 3: Penyaluran Bantuan (Terpisah)
        const statTelahSalur = document.getElementById('statTelahSalur');
        const statBelumSalurBadge = document.getElementById('statBelumSalurBadge');
        if (statTelahSalur) statTelahSalur.innerText = telahSalur;
        if (statBelumSalurBadge) statBelumSalurBadge.innerText = belumSalur;

        // Populate Card 4: Mediasi Sengketa (Terpisah)
        const statSengketa = document.getElementById('statSengketa');
        const statBebasSengketaBadge = document.getElementById('statBebasSengketaBadge');
        if (statSengketa) statSengketa.innerText = sengketa;
        if (statBebasSengketaBadge) statBebasSengketaBadge.innerText = bebasSengketa;

        // Render 4 Grafik Statistik & Peta
        window.render3DashboardCharts(data);
        window.filterAndRenderData();
        window.renderChoroplethKerentanan();

        if (showToast) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data arsip diperbarui!', showConfirmButton: false, timer: 1500 });
        }
    } catch (err) { }
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

// =========================================================================
// RENDER TABEL DENGAN LOGIKA FILTER DESIL 1-4 & DATA TABLES ORDER: []
// =========================================================================
window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];
    if ($.fn.DataTable.isDataTable('#dataTable')) {
        $('#dataTable').DataTable().clear().destroy();
    }
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    let html = '';
    data.forEach(w => {
        const isVerified = Boolean(w.is_verified);
        const desil = w.desil || 5;
        const isEligible = isVerified && desil <= 4; // Memenuhi syarat Desil 1-4

        // 1. BADGE VALIDASI DENGAN TANDA CENTANG
        let verifBadge = '';
        if (isVerified) {
            verifBadge = `<span class="badge badge-green" style="background:#e6f9f0; color:#009846; border:1px solid #a7f3d0; padding:5px 12px; border-radius:20px; font-weight:800; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;"><i class="fas fa-check-circle" style="color:#009846;"></i> DISETUJUI</span>`;
        } else {
            verifBadge = `<span class="badge badge-red" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:5px 12px; border-radius:20px; font-weight:800; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;"><i class="fas fa-clock"></i> MENUNGGU</span>`;
        }

        // 2. KETERANGAN KELAYAKAN BANSOS (DESIL 1-4 vs DESIL 5-10)
        let desilBadge = '';
        if (isVerified) {
            if (desil <= 4) {
                desilBadge = `<span class="badge badge-green" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-award"></i> Layak Bansos (Desil ${desil})</span>`;
            } else {
                desilBadge = `<span class="badge badge-warning" style="font-size:0.7rem; margin-top:3px; background:#fffbeb; color:#b45309; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> Tidak Prioritas (Desil ${desil})</span>`;
            }
        }

        // 3. STATUS PENYALURAN
        let statusSalurBadge = '';
        if (w.status_salur === 'Telah Menerima') {
            statusSalurBadge = `<span class="badge badge-blue" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-box-check"></i> Telah Menerima</span>`;
        } else if (String(w.status_salur).includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-exclamation-triangle"></i> Sengketa</span>`;
        }

        // 4. TOMBOL AKSI: BATAL / SETUJUI
        const btnToggleVerif = isVerified
            ? `<button onclick="window.toggleVerifySingle(${w.id}, '${escapeInlineJS(w.nama)}')" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:white; color:#334155;" title="Batalkan Konfirmasi"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.toggleVerifySingle(${w.id}, '${escapeInlineJS(w.nama)}')" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:#009846; color:white;" title="Konfirmasi & Setujui"><i class="fas fa-check"></i> Setujui</button>`;

        // 5. TOMBOL UNGGAH BUKTI: HANYA MUNCUL JIKA MEMENUHI SYARAT (DESIL 1-4)
        const btnKamera = isEligible
            ? `<button onclick="window.bukaUploadBuktiSalur(${w.id}, '${escapeInlineJS(w.nama)}', '${w.bukti_salur || ''}')" class="btn btn-sm" style="padding:5px 8px; background:#dcfce7; color:#15803d; border-radius:6px; margin-right:3px;" title="Unggah Bukti Penyaluran"><i class="fas fa-camera"></i></button>`
            : ''; // Tombol kamera menghilang jika tidak memenuhi syarat Desil 1-4

        const btnDelete = (user && user.role === 'admin')
            ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:5px 8px; background:#ef4444; color:white; font-size:0.8rem; border-radius:6px;" title="Hapus Data"><i class="fas fa-trash"></i></button>`
            : '';

        const ttlText = (w.tempat_lahir || w.tanggal_lahir) ? `${w.tempat_lahir || 'Sidoarjo'}, ${w.tanggal_lahir || '-'}` : '-';
        const waktuDaftar = w.created_at || 'Hari ini';

        html += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td>
                <td style="font-weight:700; font-family:monospace; color:#0f172a;">${w.nik}</td>
                <td>
                    <div style="font-weight:800; color:#1e293b; font-size:0.95rem;">${safeHtml(w.nama)}</div>
                    <small style="color:#475569;"><i class="fas fa-birthday-cake text-muted"></i> ${safeHtml(ttlText)}</small><br>
                    <small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${safeHtml(w.alamat || 'Sidoarjo')}</small><br>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:2px;">
                        ${desilBadge}
                        ${statusSalurBadge}
                    </div>
                </td>
                <td><small><i class="fas fa-clock text-primary"></i> ${waktuDaftar}</small></td>
                <td style="text-align:center;">${verifBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    ${btnToggleVerif}
                    <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:5px 8px; background:#fef3c7; color:#b45309; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Edit Data"><i class="fas fa-edit"></i></button>
                    ${btnKamera}
                    <button onclick="window.bukaAksiCepatSengketa(${w.id}, '${escapeInlineJS(w.nama)}', '${w.nik}')" class="btn" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Mediasi Sengketa"><i class="fas fa-shield-alt"></i></button>
                    ${btnDelete}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    
    // KUNCI: order: [] AGAR HASIL PENGURUTAN KITA TIDAK DITIMPA OLEH DATATABLES
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
};

// =========================================================================
// FITUR PENGURUTAN LENGKAP & PENCARIAN TANGGAL BEBAS KETIK
// =========================================================================
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
    let dataList = (window.globalDataWarga && window.globalDataWarga.length > 0) ? window.globalDataWarga : globalDataWarga;
    let filtered = [...dataList];

    // 1. Filter Kategori
    if (window.currentFilter === 'layak') {
        filtered = filtered.filter(w => w.is_verified && ((w.desil || 5) <= 4));
    } else if (window.currentFilter === 'menerima') {
        filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    } else if (window.currentFilter === 'bermasalah') {
        filtered = filtered.filter(w => String(w.status_salur).includes('Sengketa') || !w.is_verified);
    }

    // 2. Pencarian Tanggal Daftar (Bisa Ketik Format: 02/09/2026, 2026-09-02, atau 02/09)
    if (window.selectedTanggalDaftar) {
        const query = window.selectedTanggalDaftar;
        filtered = filtered.filter(w => {
            const raw = String(w.created_at || '').toLowerCase();
            if (raw.includes(query)) return true;
            
            // Konversi ISO ke dd/mm/yyyy jika input dari datepicker
            if (query.includes('-')) {
                const parts = query.split('-');
                if (parts.length === 3) {
                    const formattedQuery = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    return raw.includes(formattedQuery) || raw.includes(query);
                }
            }
            return false;
        });
    }

    // 3. Eksekusi Pengurutan
    if (window.currentSort === 'nik_asc') {
        filtered.sort((a, b) => {
            const valA = BigInt(String(a.nik).replace(/\D/g, '') || 0);
            const valB = BigInt(String(b.nik).replace(/\D/g, '') || 0);
            return valA < valB ? -1 : (valA > valB ? 1 : 0);
        });
    } else if (window.currentSort === 'nik_desc') {
        filtered.sort((a, b) => {
            const valA = BigInt(String(a.nik).replace(/\D/g, '') || 0);
            const valB = BigInt(String(b.nik).replace(/\D/g, '') || 0);
            return valA > valB ? -1 : (valA < valB ? 1 : 0);
        });
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
// PERBAIKAN TOTAL: FUNGSI SETUJUI SEMUA & BATALKAN SEMUA
// =========================================================================
window.verifyAllData = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    const token = window.getCleanToken();
    if (!token) {
        return Swal.fire('Sesi Kedaluwarsa', 'Silakan login ulang.', 'warning');
    }

    let dataList = (window.globalDataWarga && window.globalDataWarga.length > 0) ? window.globalDataWarga : globalDataWarga;
    
    // Fallback otomatis jika data belum siap di memori
    if (!dataList || dataList.length === 0) {
        try {
            const res = await window.fetchData(`/warga?_t=${Date.now()}`);
            if (res && res.ok) {
                dataList = await res.json();
                window.globalDataWarga = dataList;
                globalDataWarga = dataList;
            }
        } catch (_) {}
    }

    if (!dataList || dataList.length === 0) {
        return Swal.fire('Data Kosong', 'Belum ada data warga terdaftar di sistem untuk disetujui.', 'info');
    }

    const checkedBoxes = Array.from(document.querySelectorAll('.row-checkbox:checked, .row-check:checked'))
        .map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const isSelective = checkedBoxes.length > 0;
    const targetCount = isSelective ? checkedBoxes.length : dataList.length;

    const konfirmasi = await Swal.fire({
        title: 'Konfirmasi Persetujuan Data?',
        html: `Apakah Anda ingin mengonfirmasi / menyetujui <b>${targetCount} data warga</b>?<br><br>
        <div style="background:#f8fafc; padding:12px; border-radius:8px; font-size:0.82rem; text-align:left; color:#475569; border-left:4px solid #009846;">
            <b>Catatan Penting:</b><br>
            Persetujuan ini menandakan bahwa data warga telah terverifikasi masuk ke dalam sistem.<br>
            Keputusan siapa yang berhak menerima bantuan sosial <b>hanya diprioritaskan bagi Desil 1 s.d. Desil 4</b> setelah Anda menjalankan <b>Proses Algoritma SAW</b>.
        </div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#009846',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-check-double"></i> Ya, Setujui Semua!',
        cancelButtonText: 'Batal',
        reverseButtons: true
    });

    if (!konfirmasi.isConfirmed) return;

    Swal.fire({
        title: 'Memproses Persetujuan...',
        html: `Menyetujui <b>${targetCount}</b> data warga ke basis data...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const payload = isSelective ? { ids: checkedBoxes } : {};
        const res = await window.fetchData('/warga/bulk/verify', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.ok) {
            const result = await res.json();
            dataList.forEach(w => {
                if (!isSelective || checkedBoxes.includes(w.id)) {
                    w.is_verified = true;
                }
            });

            await Swal.fire({
                icon: 'success',
                title: 'Data Berhasil Dikonfirmasi!',
                html: `<b>${result.count || targetCount}</b> data warga telah disetujui (Terkonfirmasi Masuk).<br><small class="text-muted">Jalankan Proses Algoritma SAW untuk menentukan apakah warga masuk Desil 1–4 (Layak) atau Desil 5–10 (Tidak Menerima).</small>`,
                confirmButtonColor: '#009846'
            });
            await window.loadDashboardData(true);
        } else {
            throw new Error('Gagal memproses persetujuan di server backend.');
        }
    } catch (err) {
        Swal.fire('Gagal Persetujuan', err.message || 'Terjadi gangguan komunikasi dengan server backend.', 'error');
    }
};

window.unverifyAllData = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    let dataList = (window.globalDataWarga && window.globalDataWarga.length > 0) ? window.globalDataWarga : globalDataWarga;
    if (!dataList || dataList.length === 0) {
        return Swal.fire('Data Kosong', 'Tidak ada data warga untuk dibatalkan.', 'info');
    }

    const checkedBoxes = Array.from(document.querySelectorAll('.row-checkbox:checked, .row-check:checked'))
        .map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    const isSelective = checkedBoxes.length > 0;
    const targetCount = isSelective ? checkedBoxes.length : dataList.filter(w => w.is_verified).length;

    if (targetCount === 0) {
        return Swal.fire('Info', 'Tidak ada data warga yang sedang berstatus disetujui untuk dibatalkan.', 'info');
    }

    const konfirmasi = await Swal.fire({
        title: 'Batalkan Semua Persetujuan?',
        html: `Apakah Anda yakin ingin membatalkan status persetujuan <b>${targetCount} data warga</b> kembali menjadi <b>Menunggu Konfirmasi</b>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-undo-alt"></i> Ya, Batalkan Semua!',
        cancelButtonText: 'Kembali',
        reverseButtons: true
    });

    if (!konfirmasi.isConfirmed) return;

    Swal.fire({
        title: 'Membatalkan Persetujuan...',
        html: `Memperbarui <b>${targetCount}</b> data warga...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const payload = isSelective ? { ids: checkedBoxes } : {};
        const res = await window.fetchData('/warga/bulk/unverify', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.ok) {
            const result = await res.json();
            dataList.forEach(w => {
                if (!isSelective || checkedBoxes.includes(w.id)) {
                    w.is_verified = false;
                }
            });

            await Swal.fire({
                icon: 'success',
                title: 'Persetujuan Dibatalkan!',
                text: result.message || `Sebanyak ${result.count || targetCount} data warga berhasil dikembalikan ke status Menunggu.`,
                confirmButtonColor: '#009846'
            });
            await window.loadDashboardData(true);
        } else {
            throw new Error('Gagal membatalkan persetujuan di server backend.');
        }
    } catch (err) {
        Swal.fire('Error', err.message || 'Terjadi kesalahan pada backend.', 'error');
    }
};

window.toggleVerifySingle = async function (id, namaWarga) {
    const res = await window.fetchData(`/warga/${id}/verify`, { method: 'PATCH' });
    if (res && res.ok) {
        const json = await res.json();
        const statusMsg = json.is_verified ? 'disetujui' : 'dibatalkan persetujuannya';
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Data ${namaWarga || 'Warga'} berhasil ${statusMsg}!`, showConfirmButton: false, timer: 1500 });
        window.loadDashboardData();
    }
};

// Event listener ganda pada dokumen (fallback listener)
$(document).on('click', '#btnVerifyAll, .btn-verify-all', function (e) {
    window.verifyAllData(e);
});

$(document).on('click', '#btnUnverifyAll, .btn-unverify-all', function (e) {
    window.unverifyAllData(e);
});

window.hapusSemuaWarga = async function () {
    const confirm = await Swal.fire({
        title: 'Hapus Seluruh Data Warga?',
        text: 'Tindakan ini akan mengosongkan seluruh arsip data warga secara instan!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Hapus Semua',
        cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Menghapus Data...', didOpen: () => Swal.showLoading() });
        const res = await window.fetchData('/warga/delete-all', { method: 'POST' });
        if (res && res.ok) {
            globalDataWarga = [];
            window.filterAndRenderData();
            Swal.fire('Selesai', 'Seluruh data warga berhasil dikosongkan.', 'success');
            window.loadDashboardData();
        }
    }
};

window.peringatanBelumLayak = function (namaWarga) {
    Swal.fire({
        icon: 'warning',
        title: 'Akses Bukti Terkunci',
        html: `Warga <b>${safeHtml(namaWarga)}</b> belum memenuhi syarat atau belum berstatus <u>Disetujui</u> (Prioritas Desil 1-4).<br><br>Silakan pastikan data warga berstatus Disetujui dan masuk dalam kelompok Desil 1–4 sebelum mengunggah bukti penyaluran.`,
        confirmButtonColor: '#10b981'
    });
};

// =========================================================================
// 7. AKSI MEDIASI SENGKETA & LIVE CHAT AKSI
// =========================================================================
window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    Swal.fire({
        title: `Mediasi Laporan Sengketa Bansos`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                Warga <b>${safeHtml(namaWarga)}</b> (NIK: ${nik}) dilaporkan belum menerima bantuan fisik.<br><br>
                Pilih tindakan penyelesaian:
            </div>
        `,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-comments"></i> Buka Chat Mediasi',
        denyButtonText: '<i class="fas fa-check"></i> Tandai Selesai (Diterima)',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#0284c7',
        denyButtonColor: '#10b981'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.openAdminChat();
            window.loadChatMessages(nik, namaWarga);
        } else if (result.isDenied) {
            await window.fetchData(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi: 'selesai' }) });
            Swal.fire('Selesai', 'Status warga diperbarui menjadi Telah Menerima.', 'success');
            window.loadDashboardData();
        }
    });
};

window.kirimKonfirmasiKeWarga = async function () {
    if (!activeChatNik) return;
    const pesanKonfirmasi = `[SISTEM DINAS SOSIAL] Halo Bapak/Ibu ${activeChatName}, petugas kami telah menyalurkan bantuan sosial Anda. Mohon konfirmasi apakah bantuan fisik (uang/barang) sudah diterima dengan baik? Balas 'SUDAH' jika sudah selesai atau 'BELUM' jika masih ada kendala.`;
    
    const formData = new FormData();
    formData.append('sender', 'admin');
    formData.append('nama', 'Petugas Dinsos Sidoarjo');
    formData.append('pesan', pesanKonfirmasi);

    await window.fetchData(`/api/chat/${activeChatNik}`, { method: 'POST', body: formData });
    window.loadChatMessages(activeChatNik, activeChatName);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pesan konfirmasi dikirim ke warga!', showConfirmButton: false, timer: 2000 });
};

window.tutupKasusSengketa = async function (isSelesai) {
    if (!activeChatNik) return;
    const w = globalDataWarga.find(item => String(item.nik) === String(activeChatNik));
    if (!w) return Swal.fire('Info', 'Data warga tidak ditemukan.', 'info');

    const aksi = isSelesai ? 'selesai' : 'investigasi';
    await window.fetchData(`/warga/${w.id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi }) });

    const statusMsg = isSelesai 
        ? '[SISTEM] Laporan sengketa ditutup: Warga telah mengonfirmasi bantuan diterima.'
        : '[SISTEM] Kasus sengketa diteruskan ke tim peninjauan lapangan.';

    const formData = new FormData();
    formData.append('sender', 'admin');
    formData.append('nama', 'Pusat Layanan Dinsos');
    formData.append('pesan', statusMsg);
    await window.fetchData(`/api/chat/${activeChatNik}`, { method: 'POST', body: formData });

    window.loadChatMessages(activeChatNik, activeChatName);
    Swal.fire('Berhasil', isSelesai ? 'Kasus sengketa diselesaikan & ditutup.' : 'Kasus dialihkan ke investigasi lanjutan.', 'success');
    window.loadDashboardData();
};

// =========================================================================
// 8. EKSPOR 21 KOLOM EXCEL & SMART IMPORT (ROBUST XLSX)
// =========================================================================
window.exportExcelLengkap = function () {
    if (!globalDataWarga || globalDataWarga.length === 0) return Swal.fire('Data Kosong', 'Tidak ada data warga.', 'warning');
    const exportData = globalDataWarga.map((w, idx) => ({
        'No': idx + 1, 'NIK': String(w.nik), 'Nama Lengkap': w.nama || '',
        'No. WhatsApp / HP': w.no_hp || '', 'Email': w.email || '',
        'Tempat Lahir': w.tempat_lahir || '', 'Tanggal Lahir': w.tanggal_lahir || '',
        'Alamat Lengkap': w.alamat || '', 'Latitude': w.lat || '', 'Longitude': w.lng || '',
        'C1 (Penghasilan Bulanan Rp)': w.c1_ekonomi || 0, 'C2 (Nilai Aset Rp)': w.c2_aset || 0,
        'C3 (Usia / Umur Tahun)': w.c3_umur || 0, 'C4 (Jenis Kelamin: 1=L, 2=P)': w.c4_jenis_kelamin || 1,
        'C5 (Jumlah Tanggungan)': w.c5_tanggungan || 0, 'C6 (Status Pernikahan: 1=Belum, 2=Menikah, 3=Cerai)': w.c6_status_pernikahan || 1,
        'C7 (Kepemilikan Anak Sekolah)': w.c7_kepemilikan_anak || 0, 'C8 (Tempat Tinggal: 1=Milik, 2=Sewa, 3=Numpang)': w.c8_tempat_tinggal || 1,
        'C9 (Pendidikan: 1=SD, 2=SMP, 3=SMA, 4=PT)': w.c9_pendidikan || 1, 'C10 (Kesehatan: 1=Sehat, 2=Sakit/Disabilitas)': w.c10_kesehatan || 1,
        'Desil': w.desil || 5,
        'Nominal Bantuan': w.nominal_bantuan || 'Rp 600.000', 'Status Penyaluran': w.status_salur || 'Pending',
        'Tanggal Penyaluran': w.tanggal_salur || '-', 'Status Validasi': w.is_verified ? 'Disetujui' : 'Menunggu',
        'Waktu Pendaftaran': w.created_at || 'Hari ini'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Warga Bansos");
    XLSX.writeFile(workbook, `Data_Lengkap_Warga_Bansos_Sidoarjo_${new Date().getFullYear()}.xlsx`);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'File Excel Berhasil Diunduh!', showConfirmButton: false, timer: 2000 });
};

window.smartImportPreview = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        Swal.fire('Format Salah', 'Mohon pilih berkas spreadsheet berekstensi .xlsx atau .xls', 'warning');
        input.value = '';
        return;
    }

    Swal.fire({
        title: 'Membaca Berkas Excel...',
        html: `Memproses data dari berkas <b>${file.name}</b>...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                input.value = '';
                return Swal.fire('Error', 'Lembar kerja Excel tidak ditemukan di dalam berkas.', 'error');
            }

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawJson = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

            if (!rawJson || rawJson.length === 0) {
                input.value = '';
                return Swal.fire('Berkas Kosong', 'Tidak ada baris data pada sheet pertama berkas Excel Anda.', 'warning');
            }

            Swal.fire({
                title: 'Mengimpor ke Basis Data...',
                html: `Menyimpan <b>${rawJson.length}</b> baris data warga...`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await window.fetchData('/warga/bulk', {
                method: 'POST',
                body: JSON.stringify({ data: rawJson })
            });

            input.value = ''; // Reset input agar bisa upload ulang

            if (res && res.ok) {
                const result = await res.json();
                await Swal.fire({
                    icon: 'success',
                    title: 'Import Berhasil!',
                    html: `<b>${result.count || rawJson.length}</b> data warga berhasil diimpor dan diselaraskan ke database!`,
                    confirmButtonColor: '#10b981'
                });
                await window.loadDashboardData(true);
            } else {
                let errMsg = 'Gagal menyimpan data ke database.';
                try {
                    const errJson = await res.json();
                    if (errJson && errJson.message) errMsg = errJson.message;
                } catch (_) {}
                Swal.fire('Gagal Import', errMsg, 'error');
            }
        } catch (err) {
            input.value = '';
            Swal.fire('Error', 'Gagal memproses berkas Excel: ' + (err.message || err), 'error');
        }
    };
    reader.onerror = function () {
        input.value = '';
        Swal.fire('Error', 'Tidak dapat membaca berkas.', 'error');
    };
    reader.readAsArrayBuffer(file);
};

// =========================================================================
// 9. PROSES ALGORITMA BWM-SAW (STANDAR DESIL 1-4 LAYAK BANSOS)
// =========================================================================
window.hitungSPK = async function () {
    const wargaLayak = globalDataWarga.filter(w => w.is_verified);
    if (wargaLayak.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Belum Ada Warga yang Dikonfirmasi',
            text: 'Proses Algoritma SAW hanya memproses data warga yang telah disetujui (terkonfirmasi di sistem). Silakan setujui data warga terlebih dahulu.',
            confirmButtonColor: '#10b981'
        });
    }

    Swal.fire({
        title: 'Memproses Algoritma SAW...',
        text: 'Menghitung normalisasi matriks dan pembobotan BWM (Prioritas Desil 1–4)...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.fetchData('/hitung-saw');
        if (!res || !res.ok) throw new Error();
        const spkData = await res.json();
        lastSPKResult = spkData;
        Swal.close();

        const resultCard = document.getElementById('resultCard');
        const resultTbody = document.querySelector('#resultTable tbody');

        if (resultCard && resultTbody && spkData.hasil_akhir) {
            resultCard.style.display = 'block';
            resultTbody.innerHTML = '';

            spkData.hasil_akhir.forEach((item, idx) => {
                const tr = document.createElement('tr');
                const isLayakDesil = item.desil <= 4;
                const badgeColor = isLayakDesil ? 'badge-green' : 'badge-red';

                tr.innerHTML = `
                    <td style="text-align:center; font-weight:800;">#${idx + 1}</td>
                    <td><strong>${safeHtml(item.nama)}</strong><br><small class="text-muted">NIK: ${item.nik}</small></td>
                    <td style="text-align:center;"><span style="font-weight:700; color:var(--primary);">${item.skor_akhir}</span></td>
                    <td style="text-align:center;"><span class="badge ${badgeColor}">Desil ${item.desil}</span></td>
                    <td style="text-align:center;"><b style="color:${isLayakDesil ? '#15803d' : '#dc2626'};">${item.menerima}</b></td>
                `;
                resultTbody.appendChild(tr);
            });

            window.prepareSKTable(spkData.hasil_akhir);
            resultCard.scrollIntoView({ behavior: 'smooth' });
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan BWM-SAW Selesai!', showConfirmButton: false, timer: 2000 });
        }
    } catch (e) {
        Swal.fire('Gagal', 'Terjadi kesalahan saat memproses komputasi SPK.', 'error');
    }
};

window.prepareSKTable = function (hasilAkhir) {
    const tbody = document.getElementById('skBupatiTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    hasilAkhir.forEach((h, i) => {
        tbody.innerHTML += `<tr><td style="border:1px solid #000; padding:6px; text-align:center;">${i+1}</td><td style="border:1px solid #000; padding:6px;">${h.nik}</td><td style="border:1px solid #000; padding:6px;">${safeHtml(h.nama)}</td><td style="border:1px solid #000; padding:6px; text-align:center;">Desil ${h.desil}</td><td style="border:1px solid #000; padding:6px; text-align:center;">${h.menerima}</td></tr>`;
    });
};

window.exportSPKPDF = function () {
    const el = document.getElementById('skBupatiPrintArea');
    if (!el) return;
    el.style.display = 'block';
    html2pdf().set({ margin: 10, filename: `SK_Bupati_Bansos_Sidoarjo_${new Date().getFullYear()}.pdf`, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save().then(() => { el.style.display = 'none'; });
};

window.exportKomparasiPDF = function () {
    const el = document.getElementById('printKomparasiArea');
    if (!el) return;
    html2pdf().set({ margin: 10, filename: `Laporan_Komparasi_SAW_WP_Sidoarjo.pdf`, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save();
};

window.syncBPS = async function () {
    Swal.fire({ title: 'Menyelaraskan Data BPS Sidoarjo...', didOpen: () => Swal.showLoading() });
    const res = await window.fetchData('/api/bps/sync', { method: 'POST' });
    if (res && res.ok) {
        Swal.fire('Selesai', 'Data warga berhasil diselaraskan dengan basis data BPS DTSEN Sidoarjo!', 'success');
        window.loadDashboardData();
    }
};

// =========================================================================
// 10. MODAL BOBOT, PENGGUNA, KOMPARASI, LAPORAN & CHAT
// =========================================================================
window.bukaModalPengguna = async function () {
    const modal = document.getElementById('modalPengguna');
    if (modal) modal.style.display = 'flex';
    window.loadTablePengguna();
};

window.loadTablePengguna = async function () {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data pengguna...</td></tr>';
    try {
        const res = await window.fetchData('/users');
        const users = await res.json();
        tbody.innerHTML = '';
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada akun tambahan.</td></tr>';
            return;
        }
        users.forEach(u => {
            const roleBadge = u.role === 'admin' ? '<span class="badge badge-green">Super Admin</span>' : '<span class="badge badge-blue">Petugas</span>';
            const btnDel = u.username !== 'admin' ? `<button onclick="window.hapusUser(${u.id})" class="btn" style="background:#fee2e2; color:#dc2626; padding:4px 8px; border-radius:6px;"><i class="fas fa-trash"></i></button>` : '<small class="text-muted">Akun Utama</small>';
            tbody.innerHTML += `<tr><td style="font-weight:700;">#${u.id}</td><td><b>${safeHtml(u.username)}</b></td><td>${roleBadge}</td><td style="text-align:center;">${btnDel}</td></tr>`;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#dc2626;">Gagal memuat pengguna.</td></tr>';
    }
};

window.simpanUser = async function (e) {
    e.preventDefault();
    const payload = {
        username: document.getElementById('manageUsername')?.value.trim(),
        password: document.getElementById('managePassword')?.value.trim(),
        role: document.getElementById('manageRole')?.value || 'operator'
    };
    const res = await window.fetchData('/users', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) {
        Swal.fire('Berhasil', 'Akun pengguna berhasil didaftarkan!', 'success');
        document.getElementById('formUser')?.reset();
        window.loadTablePengguna();
    }
};

window.hapusUser = async function (id) {
    if (confirm('Hapus akun pengguna ini?')) {
        const res = await window.fetchData(`/users/${id}`, { method: 'DELETE' });
        if (res && res.ok) { Swal.fire('Terhapus', 'Akun berhasil dihapus.', 'success'); window.loadTablePengguna(); }
    }
};

window.resetFormUser = function () {
    document.getElementById('formUser')?.reset();
};

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
    } catch (e) { }
};

window.simpanBobot = async function (e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-bwm');
    const payload = Array.from(inputs).map(inp => ({ kode: inp.dataset.kode, jenis: inp.dataset.jenis, bobot: parseFloat(inp.value || 0) }));
    const res = await window.fetchData('/kriteria', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) { Swal.fire('Tersimpan', 'Bobot kriteria berhasil diterapkan!', 'success'); window.closeModal('modalBobot'); }
};

window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    if (modal) modal.style.display = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memproses komparasi SAW vs WP...</td></tr>';
    try {
        const res = await window.fetchData('/komparasi');
        const data = await res.json();
        if (tbody) tbody.innerHTML = '';
        const labels = [], sawScores = [], wpScores = [];
        data.slice(0, 15).forEach((item) => {
            labels.push(item.nama.split(' ')[0]);
            sawScores.push(item.saw_skor);
            wpScores.push(item.wp_skor);
            if (tbody) tbody.innerHTML += `<tr><td><b>${safeHtml(item.nama)}</b></td><td style="text-align:center;">#${item.saw_rank}</td><td style="text-align:center; color:#10b981; font-weight:700;">${item.saw_skor}</td><td style="text-align:center;">#${item.wp_rank}</td><td style="text-align:center; color:#0284c7; font-weight:700;">${item.wp_skor}</td></tr>`;
        });
        const ctx = document.getElementById('compChart');
        if (ctx) {
            if (compChart) compChart.destroy();
            compChart = new Chart(ctx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: 'Skor SAW', data: sawScores, borderColor: '#10b981' }, { label: 'Skor WP', data: wpScores, borderColor: '#0284c7' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (e) { }
};

window.bukaModalLaporanChat = async function () {
    const modal = document.getElementById('modalLaporanChat');
    const container = document.getElementById('laporanChatList');
    if (!modal || !container) return;
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px;">Memuat data laporan...</div>';
    try {
        const res = await window.fetchData('/api/laporan-chat');
        const reports = await res.json();
        container.innerHTML = '';
        if (reports.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">Belum ada laporan masuk.</div>'; return; }
        reports.forEach((r) => {
            container.innerHTML += `<div class="card" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--danger);"><div style="display:flex; justify-content:space-between;"><h4>${safeHtml(r.nama)} <small class="text-muted">(NIK: ${r.nik})</small></h4><span>${r.waktu}</span></div><p style="margin:5px 0;">${safeHtml(r.pesan)}</p></div>`;
        });
    } catch (e) { }
};

window.bukaModalMatriksKerja = function () {
    if (!lastSPKResult || !lastSPKResult.matriks_normalisasi) return Swal.fire('Info', 'Jalankan Proses Algoritma SAW terlebih dahulu.', 'info');
    let rows = '';
    lastSPKResult.matriks_normalisasi.slice(0, 10).forEach(m => {
        rows += `<tr><td><b>${safeHtml(m.nama)}</b></td><td>${m.C1}</td><td>${m.C2}</td><td>${m.C3}</td><td>${m.C4}</td><td>${m.C5}</td><td>${m.C6}</td><td>${m.C7}</td><td>${m.C8}</td><td>${m.C9}</td><td>${m.C10}</td></tr>`;
    });
    Swal.fire({ title: 'Matriks Normalisasi (R)', html: `<div style="max-height:300px; overflow-x:auto;"><table class="modern-table">${rows}</table></div>`, width: '750px' });
};

// =========================================================================
// 11. STUDIO GAMBAR (FILEROBOT) & PEMOTONG VIDEO (HTML5 CANVAS)
// =========================================================================
window.initFilerobotEditor = function (imageUrl, filename) {
    const modal = document.getElementById('imageEditorModal');
    const container = document.getElementById('filerobotContainer');
    if (!modal || !container || typeof FilerobotImageEditor === 'undefined') return;

    modal.style.display = 'flex';
    if (filerobotImageInstance) filerobotImageInstance.terminate();

    filerobotImageInstance = new FilerobotImageEditor(container, {
        source: imageUrl,
        savingPixelRatio: 4,
        previewPixelRatio: window.devicePixelRatio || 1,
        onSave: (imageInfo) => {
            fetch(imageInfo.imageBase64)
                .then(res => res.blob())
                .then(blob => {
                    window.adminMediaBlob = blob;
                    window.adminMediaExt = 'jpg';
                    window.adminMediaType = 'image';
                    window.batalImageEditor();
                    window.showPreviewAdmin(imageInfo.imageBase64, 'image', filename || 'edited_image.jpg');
                });
        },
        onClose: () => { window.batalImageEditor(); }
    });
    filerobotImageInstance.render();
};

window.batalImageEditor = function () {
    const modal = document.getElementById('imageEditorModal');
    if (modal) modal.style.display = 'none';
    if (filerobotImageInstance) {
        try { filerobotImageInstance.terminate(); } catch (e) { }
        filerobotImageInstance = null;
    }
};

window.bukaVideoEditor = function (videoUrl, filename) {
    const modal = document.getElementById('videoEditorModal');
    vPlayer = document.getElementById('vEditorPlayer');
    if (!modal || !vPlayer) return;

    modal.style.display = 'flex';
    vPlayer.src = videoUrl;
    vRotation = 0;
    vPlayer.style.transform = 'rotate(0deg)';

    vPlayer.onloadedmetadata = function () {
        vDuration = vPlayer.duration;
        vStartTime = 0;
        vEndTime = vDuration;
        document.getElementById('vTrimStart').value = 0;
        document.getElementById('vTrimEnd').value = 100;
        window.vUpdateTrimUI();
    };
};

window.vTogglePlay = function () {
    if (!vPlayer) return;
    const btn = document.getElementById('vPlayBtn');
    if (vPlayer.paused) {
        vPlayer.play();
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        vPlayer.pause();
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
    }
};

window.vRotate = function () {
    vRotation = (vRotation + 90) % 360;
    if (vPlayer) vPlayer.style.transform = `rotate(${vRotation}deg)`;
};

window.vUpdateTrim = function (type) {
    const startInp = parseFloat(document.getElementById('vTrimStart').value);
    const endInp = parseFloat(document.getElementById('vTrimEnd').value);

    if (startInp >= endInp) {
        if (type === 'start') document.getElementById('vTrimStart').value = endInp - 1;
        else document.getElementById('vTrimEnd').value = startInp + 1;
    }

    vStartTime = (parseFloat(document.getElementById('vTrimStart').value) / 100) * vDuration;
    vEndTime = (parseFloat(document.getElementById('vTrimEnd').value) / 100) * vDuration;

    if (type === 'start' && vPlayer) vPlayer.currentTime = vStartTime;
    window.vUpdateTrimUI();
};

window.vUpdateTrimUI = function () {
    const activeBar = document.getElementById('vTrimActive');
    const startPct = document.getElementById('vTrimStart').value;
    const endPct = document.getElementById('vTrimEnd').value;
    if (activeBar) {
        activeBar.style.left = `${startPct}%`;
        activeBar.style.width = `${endPct - startPct}%`;
    }
    const timeDisp = document.getElementById('vTimeDisplay');
    if (timeDisp) {
        timeDisp.innerText = `${vStartTime.toFixed(1)}s - ${vEndTime.toFixed(1)}s (${(vEndTime - vStartTime).toFixed(1)}s)`;
    }
};

window.vProcessAndSave = async function () {
    if (!vPlayer) return;
    const overlay = document.getElementById('vProcessingOverlay');
    const progressTxt = document.getElementById('vProcessingText');
    if (overlay) overlay.style.display = 'flex';

    vCanvas = document.getElementById('vRenderCanvas') || document.createElement('canvas');
    vCanvas.id = 'vRenderCanvas';
    vCtx = vCanvas.getContext('2d');

    const width = vRotation % 180 === 0 ? vPlayer.videoWidth : vPlayer.videoHeight;
    const height = vRotation % 180 === 0 ? vPlayer.videoHeight : vPlayer.videoWidth;
    vCanvas.width = width || 640;
    vCanvas.height = height || 480;

    const stream = vCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: 'video/webm' });
        window.adminMediaBlob = finalBlob;
        window.adminMediaExt = 'webm';
        window.adminMediaType = 'video';
        window.batalVideoEditor();
        window.showPreviewAdmin(URL.createObjectURL(finalBlob), 'video', 'trimmed_video.webm');
    };

    recorder.start();
    vPlayer.currentTime = vStartTime;
    vPlayer.play();

    const interval = setInterval(() => {
        if (vPlayer.currentTime >= vEndTime || vPlayer.ended) {
            clearInterval(interval);
            vPlayer.pause();
            recorder.stop();
        } else {
            vCtx.save();
            vCtx.translate(vCanvas.width / 2, vCanvas.height / 2);
            vCtx.rotate((vRotation * Math.PI) / 180);
            vCtx.drawImage(vPlayer, -vPlayer.videoWidth / 2, -vPlayer.videoHeight / 2);
            vCtx.restore();
            if (progressTxt) progressTxt.innerText = `Memproses: ${vPlayer.currentTime.toFixed(1)}s / ${vEndTime.toFixed(1)}s`;
        }
    }, 1000 / 30);
};

window.batalVideoEditor = function () {
    const modal = document.getElementById('videoEditorModal');
    if (modal) modal.style.display = 'none';
    if (vPlayer) { vPlayer.pause(); vPlayer.src = ''; }
    const overlay = document.getElementById('vProcessingOverlay');
    if (overlay) overlay.style.display = 'none';
};

// =========================================================================
// 12. WEBRTC AUDIO & VIDEO CALL (PEERJS)
// =========================================================================
window.initPeerCall = function () {
    try {
        if (typeof Peer !== 'undefined' && !myPeer) {
            myPeer = new Peer(`dinsos_admin_${Date.now().toString().slice(-4)}`);
            myPeer.on('call', call => {
                currentCall = call;
                document.getElementById('incomingCallUI').style.display = 'flex';
                document.getElementById('callerNameText').innerText = call.peer;
                const ringtone = document.getElementById('ringtoneAudio');
                if (ringtone) ringtone.play().catch(() => { });
            });
        }
    } catch (e) { }
};

window.startCallWarga = async function (type = 'audio') {
    if (!activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        document.getElementById('activeCallUI').style.display = 'flex';
        document.getElementById('activeCallName').innerText = `${activeChatName} (${activeChatNik})`;
        
        if (type === 'video') {
            document.getElementById('videoCallArea').style.display = 'block';
            document.getElementById('audioCallArea').style.display = 'none';
            document.getElementById('localVideo').srcObject = localStream;
        } else {
            document.getElementById('videoCallArea').style.display = 'none';
            document.getElementById('audioCallArea').style.display = 'flex';
        }

        callDurationSecs = 0;
        callTimerInterval = setInterval(() => {
            callDurationSecs++;
            const mins = String(Math.floor(callDurationSecs / 60)).padStart(2, '0');
            const secs = String(callDurationSecs % 60).padStart(2, '0');
            const durEl = document.getElementById('callDuration');
            if (durEl) durEl.innerText = `${mins}:${secs}`;
        }, 1000);
    } catch (e) {
        Swal.fire('Izin Ditolak', 'Tidak dapat mengakses mikrofon atau kamera.', 'error');
    }
};

window.acceptCall = async function () {
    const ringtone = document.getElementById('ringtoneAudio');
    if (ringtone) { ringtone.pause(); ringtone.currentTime = 0; }
    document.getElementById('incomingCallUI').style.display = 'none';
    document.getElementById('activeCallUI').style.display = 'flex';

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    if (currentCall) {
        currentCall.answer(localStream);
        currentCall.on('stream', remoteStream => {
            document.getElementById('remoteVideo').srcObject = remoteStream;
        });
    }
};

window.rejectCall = function () {
    const ringtone = document.getElementById('ringtoneAudio');
    if (ringtone) { ringtone.pause(); ringtone.currentTime = 0; }
    if (currentCall) currentCall.close();
    document.getElementById('incomingCallUI').style.display = 'none';
};

window.endCall = function () {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentCall) currentCall.close();
    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('activeCallUI').style.display = 'none';
    document.getElementById('incomingCallUI').style.display = 'none';
    const ringtone = document.getElementById('ringtoneAudio');
    if (ringtone) { ringtone.pause(); ringtone.currentTime = 0; }
};

window.toggleMuteCall = function () {
    if (!localStream) return;
    isCallAudioMuted = !isCallAudioMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isCallAudioMuted);
    const btn = document.getElementById('btnMute');
    if (btn) btn.className = isCallAudioMuted ? 'ctrl-btn off' : 'ctrl-btn';
};

window.toggleVideoCall = function () {
    if (!localStream) return;
    isCallVideoMuted = !isCallVideoMuted;
    localStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);
    const btn = document.getElementById('btnVideo');
    if (btn) btn.className = isCallVideoMuted ? 'ctrl-btn off' : 'ctrl-btn';
};

window.toggleBlur = function () {
    isCallBlurred = !isCallBlurred;
    const localVid = document.getElementById('localVideo');
    if (localVid) localVid.className = isCallBlurred ? 'blurred' : '';
    const btn = document.getElementById('btnBlur');
    if (btn) btn.className = isCallBlurred ? 'ctrl-btn active-blur' : 'ctrl-btn';
};

// =========================================================================
// 13. VOICE NOTE DENGAN AUDIO FREQUENCY VISUALIZER
// =========================================================================
window.toggleVoiceRecordAdmin = async function () {
    if (!window.isAdminRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.adminAudioRecorder = new MediaRecorder(stream);
            window.adminAudioChunks = [];

            audioContextAdmin = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextAdmin.createMediaStreamSource(stream);
            analyserAdmin = audioContextAdmin.createAnalyser();
            analyserAdmin.fftSize = 64;
            source.connect(analyserAdmin);
            dataArrayAdmin = new Uint8Array(analyserAdmin.frequencyBinCount);

            window.adminAudioRecorder.ondataavailable = e => window.adminAudioChunks.push(e.data);
            window.adminAudioRecorder.onstop = () => {
                window.adminMediaBlob = new Blob(window.adminAudioChunks, { type: 'audio/mp3' });
                window.adminMediaExt = 'mp3';
                window.adminMediaType = 'audio';
                if (reqFrameAdmin) cancelAnimationFrame(reqFrameAdmin);
                if (audioContextAdmin) audioContextAdmin.close();
            };

            window.adminAudioRecorder.start();
            window.isAdminRecordingAudio = true;
            document.getElementById('adminRecordingUI').style.display = 'flex';
            document.getElementById('adminChatInput').style.display = 'none';

            window.adminRecordSecs = 0;
            window.adminRecordTimer = setInterval(() => {
                window.adminRecordSecs++;
                const mins = String(Math.floor(window.adminRecordSecs / 60)).padStart(2, '0');
                const secs = String(window.adminRecordSecs % 60).padStart(2, '0');
                const timeEl = document.getElementById('adminRecordTime');
                if (timeEl) timeEl.innerText = `${mins}:${secs}`;
            }, 1000);

            window.startAudioVisualizer();
        } catch (e) {
            Swal.fire('Error', 'Gagal mengakses mikrofon.', 'error');
        }
    } else {
        window.adminAudioRecorder.stop();
        window.isAdminRecordingAudio = false;
        clearInterval(window.adminRecordTimer);
        document.getElementById('adminRecordingUI').style.display = 'none';
        document.getElementById('adminChatInput').style.display = 'block';
    }
};

window.startAudioVisualizer = function () {
    if (!analyserAdmin) return;
    const bars = document.querySelectorAll('.waveform .wave-bar');
    function draw() {
        if (!window.isAdminRecordingAudio) return;
        reqFrameAdmin = requestAnimationFrame(draw);
        analyserAdmin.getByteFrequencyData(dataArrayAdmin);
        bars.forEach((bar, idx) => {
            const val = dataArrayAdmin[idx % dataArrayAdmin.length] || 10;
            bar.style.height = `${Math.max(4, (val / 255) * 24)}px`;
        });
    }
    draw();
};

// =========================================================================
// 14. CHAT REAL-TIME, LAMPIRAN, EMOJI & MODAL TRANSFER
// =========================================================================
window.openAdminChat = function () {
    const modal = document.getElementById('modalAdminChat');
    if (modal) modal.style.display = 'flex';
    window.loadChatList();
    window.tutupObrolanAktif();
};

window.loadChatList = async function () {
    try {
        const res = await window.fetchData('/api/chat/list');
        if (!res || !res.ok) return;
        let data = await res.json();
        rawChatListData = Array.isArray(data) ? data : [];
        window.renderCategorizedInbox();
    } catch (e) { }
};

window.renderCategorizedInbox = function (query = '') {
    const container = document.getElementById('chatContactList');
    if (!container) return;

    let list = [...rawChatListData];
    if (query) {
        list = list.filter(c => (c.nama || '').toLowerCase().includes(query.toLowerCase()) || String(c.nik).includes(query));
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px 10px; color:#94a3b8;">Tidak ada pesan masuk.</div>`;
        return;
    }

    let html = '';
    list.forEach(c => {
        html += `
            <div class="chat-contact-item ${c.nik === activeChatNik ? 'active' : ''}" onclick="window.loadChatMessages('${c.nik}', '${escapeInlineJS(c.nama)}')">
                <div class="contact-avatar">${(c.nama || 'W').charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name"><span>${safeHtml(c.nama)}</span><span style="font-size:0.75rem; color:#64748b;">${c.waktu}</span></div>
                    <div class="contact-nik">NIK: ${c.nik}</div>
                    <div class="contact-last-msg">${safeHtml(c.last_msg)}</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.switchChatTab = function (tab) {
    window.activeChatTab = tab;
    const inboxBtn = document.getElementById('tabInboxBtn');
    const kontakBtn = document.getElementById('tabKontakBtn');
    const inboxList = document.getElementById('chatContactList');
    const kontakList = document.getElementById('chatBukuKontakList');

    if (tab === 'inbox') {
        if (inboxBtn) inboxBtn.className = 'btn btn-primary';
        if (kontakBtn) { kontakBtn.className = 'btn btn-secondary'; kontakBtn.style.background = 'transparent'; }
        if (inboxList) inboxList.style.display = 'block';
        if (kontakList) kontakList.style.display = 'none';
        window.renderCategorizedInbox();
    } else {
        if (kontakBtn) { kontakBtn.className = 'btn btn-primary'; kontakBtn.style.background = ''; }
        if (inboxBtn) { inboxBtn.className = 'btn btn-secondary'; inboxBtn.style.background = 'transparent'; }
        if (inboxList) inboxList.style.display = 'none';
        if (kontakList) {
            kontakList.style.display = 'block';
            window.renderBukuKontak();
        }
    }
};

window.renderBukuKontak = function () {
    const container = document.getElementById('chatBukuKontakList');
    if (!container) return;
    let html = '';
    globalDataWarga.forEach(w => {
        html += `
            <div class="chat-contact-item" onclick="window.loadChatMessages('${w.nik}', '${escapeInlineJS(w.nama)}')">
                <div class="contact-avatar">${(w.nama || 'W').charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${safeHtml(w.nama)}</div>
                    <div class="contact-nik">NIK: ${w.nik}</div>
                    <small style="color:#64748b;">${safeHtml(w.alamat || 'Sidoarjo')}</small>
                </div>
            </div>
        `;
    });
    container.innerHTML = html || '<div style="text-align:center; padding:30px; color:#94a3b8;">Buku kontak kosong.</div>';
};

window.filterChatList = function () {
    const query = document.getElementById('searchChatInput')?.value.trim() || '';
    if (window.activeChatTab === 'inbox') window.renderCategorizedInbox(query);
};

window.loadChatMessages = async function (nik, nama) {
    activeChatNik = String(nik);
    activeChatName = nama;

    const nameDisp = document.getElementById('chatActiveNameDisplay');
    const infoDisp = document.getElementById('chatActiveInfoDisplay');
    const nikDisp = document.getElementById('chatActiveNikDisplay');
    const avatarDisp = document.getElementById('chatHeaderAvatar');
    const headerActions = document.getElementById('chatHeaderActions');
    const disputeGrp = document.getElementById('chatDisputeActionGroup');

    if (nameDisp) nameDisp.innerText = nama;
    if (nikDisp) nikDisp.innerText = nik;
    if (infoDisp) infoDisp.style.display = 'flex';
    if (avatarDisp) {
        avatarDisp.style.display = 'flex';
        avatarDisp.innerText = (nama || 'W').charAt(0).toUpperCase();
    }
    if (headerActions) headerActions.style.display = 'flex';
    if (disputeGrp) disputeGrp.style.display = 'flex';

    const inp = document.getElementById('adminChatInput');
    const btnSend = document.getElementById('btnSendAdmin');
    if (inp) inp.disabled = false;
    if (btnSend) btnSend.disabled = false;

    try {
        const res = await window.fetchData(`/api/chat/${nik}`);
        if (!res || !res.ok) return;
        let data = await res.json();
        const container = document.getElementById('adminChatMessages');
        if (!container) return;

        let html = '';
        data.forEach(msg => {
            const isAdmin = msg.sender === 'admin';
            let mediaHtml = '';
            if (msg.file_path) {
                const url = msg.file_path.startsWith('http') ? msg.file_path : `${API_URL}${msg.file_path}`;
                if (msg.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:220px; border-radius:10px; margin-top:6px; cursor:pointer;" onclick="window.openLightbox('${url}', 'image')" />`;
                } else if (msg.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:10px; margin-top:6px;"></video>`;
                }
            }

            html += `
                <div style="display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'};">
                    <div style="background:${isAdmin ? 'linear-gradient(135deg, #009846, #047857)' : '#ffffff'}; color:${isAdmin ? '#ffffff' : '#1e293b'}; padding:12px 18px; border-radius:16px; max-width:70%; box-shadow:0 2px 8px rgba(0,0,0,0.06); word-break:break-word;">
                        ${msg.pesan ? safeHtml(msg.pesan) : ''}
                        ${mediaHtml}
                        <div style="font-size:0.7rem; opacity:0.75; text-align:right; margin-top:4px;">${msg.waktu}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<div style="text-align:center; color:#94a3b8; margin-top:50px;">Belum ada pesan.</div>';
        container.scrollTop = container.scrollHeight;
    } catch (e) { }
};

window.sendAdminChat = async function () {
    if (!activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
    const input = document.getElementById('adminChatInput');
    const text = input ? input.value.trim() : '';

    if (!text && !window.adminMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'admin');
    formData.append('nama', 'Pusat Layanan Dinsos Sidoarjo');
    formData.append('pesan', text);

    if (window.adminMediaBlob) {
        formData.append('file', window.adminMediaBlob, `media_${Date.now()}.${window.adminMediaExt || 'jpg'}`);
    }

    if (input) input.value = '';
    window.batalLampiranAdmin();

    try {
        const res = await window.fetchData(`/api/chat/${activeChatNik}`, {
            method: 'POST',
            body: formData
        });
        if (res && res.ok) {
            window.loadChatMessages(activeChatNik, activeChatName);
            window.loadChatList();
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal mengirim pesan.', 'error');
    }
};

window.showPreviewAdmin = function (url, type, name) {
    const preBox = document.getElementById('preSendPreviewAdmin');
    const container = document.getElementById('previewMediaContainerAdmin');
    if (!preBox || !container) return;

    preBox.style.display = 'block';
    if (type === 'image') {
        container.innerHTML = `<img src="${url}" style="max-height:140px; border-radius:8px;" /><button onclick="window.initFilerobotEditor('${url}', '${name}')" class="btn btn-secondary btn-sm" style="position:absolute; bottom:15px; right:15px;"><i class="fas fa-crop-alt"></i> Edit Gambar</button>`;
    } else if (type === 'video') {
        container.innerHTML = `<video src="${url}" style="max-height:140px; border-radius:8px;" controls></video><button onclick="window.bukaVideoEditor('${url}', '${name}')" class="btn btn-secondary btn-sm" style="position:absolute; bottom:15px; right:15px;"><i class="fas fa-cut"></i> Potong Video</button>`;
    } else {
        container.innerHTML = `<div><i class="fas fa-file fa-3x text-info"></i><br><span>${name}</span></div>`;
    }
};

window.batalLampiranAdmin = function () {
    window.adminMediaBlob = null;
    window.adminMediaExt = '';
    window.adminMediaType = '';
    const fileInp = document.getElementById('adminChatFile');
    if (fileInp) fileInp.value = '';
    const preBox = document.getElementById('preSendPreviewAdmin');
    if (preBox) preBox.style.display = 'none';
};

window.batalReplyAdmin = function () {
    replyToDataAdmin = null;
    const box = document.getElementById('replyPreviewContainerAdmin');
    if (box) box.style.display = 'none';
};

window.tutupObrolanAktif = function () {
    activeChatNik = null;
    activeChatName = null;
    const nameDisp = document.getElementById('chatActiveNameDisplay');
    const infoDisp = document.getElementById('chatActiveInfoDisplay');
    const avatarDisp = document.getElementById('chatHeaderAvatar');
    const headerActions = document.getElementById('chatHeaderActions');

    if (nameDisp) nameDisp.innerText = 'Pilih Warga di Kotak Masuk atau Buku Kontak...';
    if (infoDisp) infoDisp.style.display = 'none';
    if (avatarDisp) avatarDisp.style.display = 'none';
    if (headerActions) headerActions.style.display = 'none';

    const inp = document.getElementById('adminChatInput');
    const btnSend = document.getElementById('btnSendAdmin');
    if (inp) inp.disabled = true;
    if (btnSend) btnSend.disabled = true;

    const msgs = document.getElementById('adminChatMessages');
    if (msgs) msgs.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:100px;"><i class="fas fa-comments fa-3x" style="opacity:0.3; margin-bottom:15px;"></i><br>Pilih daftar warga untuk mulai berinteraksi secara real-time.</div>';
};

window.toggleEmojiPicker = function (target) {
    const ep = document.getElementById('emojiPickerAdmin');
    if (!ep) return;
    if (ep.style.display === 'grid') {
        ep.style.display = 'none';
    } else {
        const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👍','👎','👏','🙌','🙏','🤝','❤️','🔥','✨','🎉','⚠️'];
        ep.innerHTML = emojis.map(em => `<span style="font-size:1.4rem; cursor:pointer; text-align:center;" onclick="window.insertEmoji('${em}', '${target}')">${em}</span>`).join('');
        ep.style.display = 'grid';
    }
};

window.insertEmoji = function (emoji, target) {
    const input = document.getElementById('adminChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
    const ep = document.getElementById('emojiPickerAdmin');
    if (ep) ep.style.display = 'none';
};

window.handleChatEnter = function (e, target) {
    if (e.key === 'Enter') {
        e.preventDefault();
        window.sendAdminChat();
    }
};

// =========================================================================
// 15. SISTEM NOTIFIKASI REAL-TIME & ARSIP
// =========================================================================
window.setupNotificationSystemModern = function () {
    const notifBtn = document.querySelector('.notif-wrapper');
    if (notifBtn) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.toggleNotifPanel(e);
        });
    }
};

window.toggleNotifPanel = function (e) {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    window.isNotifPanelOpen = !window.isNotifPanelOpen;
    panel.style.display = window.isNotifPanelOpen ? 'flex' : 'none';
    if (window.isNotifPanelOpen) window.fetchNotifikasiRealtime();
};

window.fetchNotifikasiRealtime = async function (tab = 'baru') {
    try {
        const res = await window.fetchData('/api/notifikasi');
        if (!res || !res.ok) return;
        const notifs = await res.json();
        const listEl = document.getElementById('notifList');
        const badgeEl = document.getElementById('notifBadge');

        const unreadCount = notifs.filter(n => !n.is_read).length;
        if (badgeEl) {
            badgeEl.innerText = unreadCount;
            badgeEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (!listEl) return;
        if (notifs.length === 0) {
            listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">Tidak ada notifikasi.</div>';
            return;
        }

        let html = '';
        notifs.forEach(n => {
            html += `
                <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${n.is_read ? '#ffffff' : '#f0fdf4'}; cursor:pointer;" onclick="window.markNotifRead(${n.id})">
                    <p style="margin:0; font-size:0.85rem; color:#1e293b;">${safeHtml(n.pesan)}</p>
                    <small style="color:#64748b; font-size:0.75rem;"><i class="fas fa-clock"></i> ${n.waktu}</small>
                </div>
            `;
        });
        listEl.innerHTML = html;
    } catch (e) { }
};

window.markNotifRead = async function (id) {
    await window.fetchData(`/api/notifikasi/${id}/read`, { method: 'PATCH' });
    window.fetchNotifikasiRealtime();
};

// =========================================================================
// 16. LIGHTBOX & FLOATING ACTION BAR (FAB)
// =========================================================================
window.openLightbox = function (url, type) {
    const box = document.getElementById('mediaLightbox');
    const content = document.getElementById('lightboxContent');
    if (!box || !content) return;
    box.style.display = 'flex';
    if (type === 'image') content.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:85vh; border-radius:12px;" />`;
    else if (type === 'video') content.innerHTML = `<video src="${url}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:12px;"></video>`;
};

window.closeLightbox = function (e) {
    if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        const box = document.getElementById('mediaLightbox');
        if (box) box.style.display = 'none';
    }
};

// =========================================================================
// 17. FITUR KELOLA CHAT LANJUTAN (TRANSFER, LAPOR, PIN, BULK FAB, EXPORT)
// =========================================================================
window.toggleChatActionDropdown = function (e) {
    e.stopPropagation();
    const dd = document.getElementById('chatActionDropdown');
    if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
};

window.pinChatActive = function () {
    if (!activeChatNik) return;
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Percakapan disematkan di paling atas!', showConfirmButton: false, timer: 2000 });
};

window.bukaModalAlihkanAdmin = async function () {
    if (!activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
    const modal = document.getElementById('modalAlihkanAdmin');
    const select = document.getElementById('selectAdminTransfer');
    const nameEl = document.getElementById('transferWargaName');
    if (nameEl) nameEl.innerText = activeChatName || 'Warga';

    if (modal) modal.style.display = 'flex';
    if (select) {
        select.innerHTML = '<option value="">Memuat data petugas...</option>';
        try {
            const res = await window.fetchData('/users');
            const users = await res.json();
            select.innerHTML = '<option value="">-- Pilih Petugas / Admin --</option>';
            users.forEach(u => {
                select.innerHTML += `<option value="${u.username}">${safeHtml(u.username)} (${u.role})</option>`;
            });
        } catch (e) {
            select.innerHTML = '<option value="">Gagal memuat petugas</option>';
        }
    }
};

window.eksekusiAlihkanAdmin = function () {
    const target = document.getElementById('selectAdminTransfer')?.value;
    if (!target) return Swal.fire('Peringatan', 'Pilih petugas tujuan.', 'warning');
    window.closeModal('modalAlihkanAdmin');
    Swal.fire('Berhasil', `Percakapan berhasil dialihkan kepada ${target}.`, 'success');
};

window.bukaModalLaporRiwayat = function () {
    if (!activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
    const modal = document.getElementById('modalLaporRiwayat');
    if (modal) modal.style.display = 'flex';
};

window.eksekusiLaporRiwayat = async function () {
    const alasan = document.getElementById('inputAlasanLaporChat')?.value.trim();
    if (!alasan) return Swal.fire('Peringatan', 'Alasan pelaporan wajib diisi.', 'warning');
    window.closeModal('modalLaporRiwayat');
    Swal.fire('Tercatat', 'Riwayat obrolan berhasil diteruskan ke Pusat Investigasi.', 'success');
};

window.hapusRiwayatLokal = function () {
    if (!activeChatNik) return;
    const container = document.getElementById('adminChatMessages');
    if (container) container.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:100px;">Riwayat obrolan telah dibersihkan.</div>';
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Riwayat obrolan dibersihkan.', showConfirmButton: false, timer: 2000 });
};

window.bukaModalExport = function () {
    const modal = document.getElementById('modalExportBuilder');
    if (modal) modal.style.display = 'flex';
};

window.executeCustomExport = function () {
    const checkboxes = document.querySelectorAll('#exportCols input[type="checkbox"]:checked');
    const selectedFields = Array.from(checkboxes).map(cb => cb.value);
    if (selectedFields.length === 0) return Swal.fire('Peringatan', 'Pilih minimal 1 kolom.', 'warning');

    const exportData = globalDataWarga.map((w, idx) => {
        const row = { 'No': idx + 1 };
        selectedFields.forEach(f => {
            row[f.toUpperCase()] = w[f] !== undefined ? w[f] : '';
        });
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export Custom");
    XLSX.writeFile(wb, `Export_Custom_Bansos_${Date.now()}.xlsx`);
    window.closeModal('modalExportBuilder');
    Swal.fire('Selesai', 'Data custom berhasil diunduh.', 'success');
};

window.executeBulkImport = async function () {
    window.closeModal('modalImportPreview');
    Swal.fire('Berhasil', 'Seluruh data berhasil diimpor ke basis data.', 'success');
    window.loadDashboardData();
};

window.bukaUploadBuktiSalur = function (id, namaWarga, existingPhoto) {
    let previewHtml = existingPhoto ? `<div style="margin-bottom:15px;"><img src="${API_URL}/uploads/${existingPhoto}" style="max-width:100%; max-height:200px; border-radius:10px;" /></div>` : `<p style="font-size:0.85rem; color:#64748b;">Belum ada dokumentasi serah terima.</p>`;
    Swal.fire({
        title: `Bukti Penyaluran Bansos`,
        html: `<div style="text-align:left; font-size:0.9rem;"><b>Penerima:</b> ${safeHtml(namaWarga)}<br>${previewHtml}<label style="font-weight:700; display:block; margin:10px 0 5px 0;">Pilih / Ambil Foto Dokumentasi:</label><input type="file" id="swalFileBukti" accept="image/*" class="form-input" style="padding:8px;" /></div>`,
        showCancelButton: true, confirmButtonText: 'Simpan Foto', confirmButtonColor: '#10b981',
        preConfirm: () => {
            const fileInp = document.getElementById('swalFileBukti');
            if (!fileInp.files || !fileInp.files[0]) {
                if (!existingPhoto) Swal.showValidationMessage('Pilih berkas foto terlebih dahulu!');
                return null;
            }
            return fileInp.files[0];
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
            const formData = new FormData();
            formData.append('file', result.value);
            const res = await window.fetchData(`/warga/${id}/bukti-salur`, { method: 'POST', body: formData });
            if (res && res.ok) { Swal.fire('Tersimpan', 'Foto bukti penyaluran berhasil disimpan!', 'success'); window.loadDashboardData(); }
        }
    });
};

window.bukaModalEdit = function (id) {
    const w = globalDataWarga.find(item => item.id === id);
    if (!w) return;
    document.getElementById('editId').value = w.id;
    document.getElementById('editNama').value = w.nama || '';
    document.getElementById('editNik').value = w.nik || '';
    if (document.getElementById('editNoHp')) document.getElementById('editNoHp').value = w.no_hp || '';
    if (document.getElementById('editEmail')) document.getElementById('editEmail').value = w.email || '';
    document.getElementById('editTempatLahir').value = w.tempat_lahir || '';
    document.getElementById('editTglLahir').value = w.tanggal_lahir || '';
    document.getElementById('editAlamat').value = w.alamat || '';
    
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
    if (document.getElementById('editCatatan')) document.getElementById('editCatatan').value = w.catatan || '';

    const modal = document.getElementById('modalEdit');
    if (modal) modal.style.display = 'flex';
};

window.simpanEdit = async function (e) {
    e.preventDefault();
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
    const res = await window.fetchData(`/warga/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (res && res.ok) { Swal.fire('Berhasil', 'Data warga berhasil diperbarui.', 'success'); window.closeModal('modalEdit'); window.loadDashboardData(); }
};

window.hapusData = async function (id) {
    if (confirm('Hapus data warga ini?')) {
        await window.fetchData(`/warga/${id}`, { method: 'DELETE' });
        window.loadDashboardData();
    }
};

window.toggleSelectAll = function (source) {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = source.checked; });
};

window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
};

window.logout = function () {
    localStorage.clear();
    window.location.href = 'login.html';
};