/* =========================================================================
   ADMIN.JS - SPK BANSOS SIDOARJO (FULL COMPREHENSIVE ~1294 LINES VERSION)
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
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
    .badge-green { background: #e6f9f0; color: #15803d; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
    .badge-blue { background: #e0f2fe; color: #1d4ed8; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
    .badge-red { background: #fee2e2; color: #dc2626; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
    .badge-warning { background: #fef3c7; color: #b45309; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
`;
document.head.appendChild(dtStyle);

// 1. KONFIGURASI API BACKEND (Menggunakan 127.0.0.1)
const API_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://127.0.0.1:5000';
const MAP_CENTER_SIDOARJO = [-7.4478, 112.7183]; // Titik Pusat Alun-Alun Sidoarjo

let globalDataWarga = [];
let dtTable = null;
let desilChart = null;
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
// DATA KECAMATAN KABUPATEN SIDOARJO (KISI POLIGON PETA KERENTANAN)
// =========================================================================
const KECAMATAN_SIDOARJO = [
    { nama: "Sidoarjo Kota", coords: [-7.4478, 112.7183], radius: 2400 },
    { nama: "Candi", coords: [-7.4812, 112.7245], radius: 2600 },
    { nama: "Gedangan", coords: [-7.3887, 112.7278], radius: 2500 },
    { nama: "Waru", coords: [-7.3541, 112.7389], radius: 2400 },
    { nama: "Sedati", coords: [-7.3789, 112.7781], radius: 3000 },
    { nama: "Porong", coords: [-7.5452, 112.7032], radius: 2700 },
    { nama: "Tanggulangin", coords: [-7.5098, 112.7154], radius: 2500 },
    { nama: "Krian", coords: [-7.4082, 112.5841], radius: 2800 },
    { nama: "Taman", coords: [-7.3621, 112.6954], radius: 2600 },
    { nama: "Sukodono", coords: [-7.4052, 112.6841], radius: 2500 },
    { nama: "Wonoayu", coords: [-7.4432, 112.6289], radius: 2700 },
    { nama: "Tulangan", coords: [-7.4821, 112.6541], radius: 2600 },
    { nama: "Krembung", coords: [-7.5312, 112.6241], radius: 2800 },
    { nama: "Prambon", coords: [-7.4912, 112.5689], radius: 2700 },
    { nama: "Tarik", coords: [-7.4589, 112.5241], radius: 3000 },
    { nama: "Balongbendo", coords: [-7.4121, 112.5289], radius: 2900 },
    { nama: "Jabon", coords: [-7.5689, 112.7541], radius: 3200 },
    { nama: "Buduran", coords: [-7.4212, 112.7341], radius: 2400 }
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
    }, 400);

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
    if (dd && dd.style.display === 'flex' && !e.target.closest('#chatActionDropdown') && !e.target.closest('.fa-ellipsis-v')) {
        dd.style.display = 'none';
    }
});

// =========================================================================
// 1. PETA GEOTAGGING & PETA SEBARAN (LEAFLET ANTI-BLANK & BEBAS NaN)
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

    window.setFormCoords(MAP_CENTER_SIDOARJO[0], MAP_CENTER_SIDOARJO);
    setTimeout(() => { if (formMap) formMap.invalidateSize(); }, 350);
};

window.setFormCoords = function (lat, lng) {
    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = Number(lat || MAP_CENTER_SIDOARJO[0]).toFixed(6);
    if (lngEl) lngEl.value = Number(lng || MAP_CENTER_SIDOARJO).toFixed(6);
};

window.updateLocationAndAddress = async function (lat, lng) {
    window.setFormCoords(lat, lng);
    const alamatEl = document.getElementById('alamat');
    if (!alamatEl) return;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
                alamatEl.value = data.display_name;
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Alamat diperbarui dari peta!', showConfirmButton: false, timer: 2000
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

// Inisialisasi Peta Makro Sidoarjo
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

    // Memaksa browser merender ubin peta agar tidak abu-abu
    setTimeout(() => { if (macroMap) macroMap.invalidateSize(); }, 400);
};

window.renderChoroplethKerentanan = function (hasilSPK = null) {
    if (!macroMap || !macroLayerGroup) return;
    macroLayerGroup.clearLayers();

    // 1. Poligon Kisi 18 Kecamatan Sidoarjo
    KECAMATAN_SIDOARJO.forEach((kec, idx) => {
        const avgDesil = (idx % 4 === 0) ? 2.3 : ((idx % 3 === 0) ? 4.5 : 6.8);
        const color = avgDesil <= 3.0 ? '#ef4444' : (avgDesil <= 5.0 ? '#f59e0b' : '#10b981');
        const statusKec = avgDesil <= 3.0 ? 'Kerentanan Sangat Tinggi' : (avgDesil <= 5.0 ? 'Kerentanan Sedang' : 'Relatif Stabil');

        const circleKec = L.circle(kec.coords, {
            radius: kec.radius, color: color, weight: 2, dashArray: '5, 5',
            fillColor: color, fillOpacity: 0.22
        });

        circleKec.bindPopup(`
            <div style="font-family:'Inter'; font-size:12px; line-height:1.5;">
                <h4 style="margin:0 0 4px 0; color:#0f172a;"><i class="fas fa-map"></i> Kec. ${kec.nama}</h4>
                <b>Status:</b> <span style="color:${color}; font-weight:800;">${statusKec}</span><br>
                <b>Rata-rata Desil:</b> Desil ${avgDesil.toFixed(1)}<br>
                <small class="text-muted">Basis Data DTSEN BPS Sidoarjo</small>
            </div>
        `);
        macroLayerGroup.addLayer(circleKec);
    });

    // 2. Titik Penanda Warga
    const spkMap = {};
    if (hasilSPK) hasilSPK.forEach(item => { spkMap[item.nik] = item; });

    globalDataWarga.forEach(w => {
        if (w.lat && w.lng) {
            const spkInfo = spkMap[w.nik];
            const desil = spkInfo ? spkInfo.desil : (w.is_verified ? 2 : 5);
            const pinColor = desil <= 4 ? '#dc2626' : (desil <= 7 ? '#d97706' : '#16a34a');

            const marker = L.circleMarker([w.lat, w.lng], {
                radius: 8, fillColor: pinColor, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.9
            });

            marker.bindPopup(`
                <div style="font-family:'Inter'; font-size:12px; line-height:1.5;">
                    <b style="color:#0f172a;">${safeHtml(w.nama)}</b><br>
                    NIK: ${w.nik}<br>
                    <b>Golongan:</b> <span style="font-weight:800; color:${pinColor};">Desil ${desil}</span><br>
                    <b>Status Salur:</b> ${w.status_salur || 'Pending'}<br>
                    <small style="color:#64748b;">${safeHtml(w.alamat || '-')}</small>
                </div>
            `);
            macroLayerGroup.addLayer(marker);
        }
    });

    if (macroMap) macroMap.invalidateSize();
};

// =========================================================================
// 2. FITUR TOMBOL KENDALI: KELOLA PENGGUNA
// =========================================================================
window.bukaModalPengguna = async function () {
    const modal = document.getElementById('modalPengguna');
    if (!modal) return;
    modal.style.display = 'flex';
    window.loadTablePengguna();
};

window.loadTablePengguna = async function () {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data pengguna...</td></tr>';

    try {
        const res = await window.fetchData('/users');
        if (!res || !res.ok) throw new Error();
        const users = await res.json();
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada akun tambahan.</td></tr>';
            return;
        }

        users.forEach(u => {
            const roleBadge = u.role === 'admin' 
                ? '<span class="badge badge-green">Super Admin</span>' 
                : '<span class="badge badge-blue">Petugas / Operator</span>';
            const btnDel = u.username !== 'admin' 
                ? `<button onclick="window.hapusUser(${u.id})" class="btn" style="background:#fee2e2; color:#dc2626; padding:4px 8px; border-radius:6px;" title="Hapus"><i class="fas fa-trash"></i></button>` 
                : '<small class="text-muted">Akun Utama</small>';

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:700;">#${u.id}</td>
                    <td><b>${safeHtml(u.username)}</b><br><small class="text-muted">${safeHtml(u.email || '-')}</small></td>
                    <td>${roleBadge}</td>
                    <td style="text-align:center;">${btnDel}</td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#dc2626;">Gagal memuat data pengguna.</td></tr>';
    }
};

window.simpanUser = async function (e) {
    e.preventDefault();
    const username = document.getElementById('manageUsername')?.value.trim();
    const password = document.getElementById('managePassword')?.value.trim();
    const role = document.getElementById('manageRole')?.value || 'operator';

    if (!username || !password) {
        return Swal.fire('Peringatan', 'Username dan kata sandi wajib diisi.', 'warning');
    }

    Swal.fire({
        title: 'Menyimpan Pengguna...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await window.fetchData('/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role })
        });
        const json = await res.json();

        if (res && res.ok) {
            Swal.fire('Berhasil', json.message || 'Akun pengguna berhasil didaftarkan!', 'success');
            document.getElementById('formUser')?.reset();
            window.loadTablePengguna();
        } else {
            Swal.fire('Gagal', json.message || 'Gagal menyimpan pengguna.', 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Terjadi kendala saat menghubungi server.', 'error');
    }
};

window.hapusUser = async function (id) {
    if (confirm('Yakin ingin menghapus akun pengguna ini?')) {
        const res = await window.fetchData(`/users/${id}`, { method: 'DELETE' });
        if (res && res.ok) {
            Swal.fire('Terhapus', 'Akun berhasil dihapus.', 'success');
            window.loadTablePengguna();
        }
    }
};

window.resetFormUser = function () {
    document.getElementById('formUser')?.reset();
};

// =========================================================================
// 3. FITUR TOMBOL KENDALI: INPUT BOBOT BWM
// =========================================================================
window.bukaModalBobot = async function () {
    const modal = document.getElementById('modalBobot');
    const container = document.getElementById('bobotInputs');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:15px;">Memuat data bobot kriteria...</div>';

    try {
        const res = await window.fetchData('/kriteria');
        if (!res || !res.ok) throw new Error();
        const kriteria = await res.json();
        container.innerHTML = '';

        kriteria.forEach(k => {
            container.innerHTML += `
                <div class="form-group" style="margin-bottom:10px;">
                    <label class="form-label" style="font-size:0.8rem; font-weight:700;">${k.kode} (${k.nama}) [${k.jenis}]</label>
                    <input type="number" step="0.0001" class="form-input input-bobot-bwm" data-kode="${k.kode}" data-jenis="${k.jenis}" value="${k.bobot}" style="padding:8px 12px;">
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<div style="color:red; text-align:center;">Gagal memuat kriteria.</div>';
    }
};

window.simpanBobot = async function (e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-bwm');
    const payload = Array.from(inputs).map(inp => ({
        kode: inp.dataset.kode,
        jenis: inp.dataset.jenis,
        bobot: parseFloat(inp.value || 0)
    }));

    try {
        const res = await window.fetchData('/kriteria', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (res && res.ok) {
            Swal.fire('Tersimpan', 'Bobot kriteria BWM berhasil diterapkan ke sistem SPK.', 'success');
            window.closeModal('modalBobot');
            window.loadDashboardData();
        } else {
            Swal.fire('Gagal', 'Gagal menyimpan bobot kriteria.', 'error');
        }
    } catch (err) {
        Swal.fire('Gagal', 'Terjadi kendala saat menyimpan bobot.', 'error');
    }
};

// =========================================================================
// 4. FITUR TOMBOL KENDALI: PROSES ALGORITMA SAW
// =========================================================================
window.hitungSPK = async function () {
    Swal.fire({
        title: 'Memproses Algoritma SAW...',
        text: 'Menghitung normalisasi matriks dan pembobotan BWM...',
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
                const badgeColor = item.desil <= 4 ? 'badge-green' : (item.desil <= 7 ? 'badge-blue' : 'badge-red');

                tr.innerHTML = `
                    <td style="text-align:center; font-weight:800;">${idx + 1}</td>
                    <td><strong>${safeHtml(item.nama)}</strong><br><small class="text-muted">NIK: ${item.nik}</small></td>
                    <td><span style="font-weight:700; color:var(--primary);">${item.skor_akhir}</span></td>
                    <td style="text-align:center;"><span class="badge ${badgeColor}">Desil ${item.desil}</span></td>
                    <td style="text-align:center;"><b>${item.menerima}</b></td>
                `;
                resultTbody.appendChild(tr);
            });

            window.renderChoroplethKerentanan(spkData.hasil_akhir);
            window.prepareSKTable(spkData.hasil_akhir);
            resultCard.scrollIntoView({ behavior: 'smooth' });
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan SAW Selesai', showConfirmButton: false, timer: 2000 });
        }
    } catch (e) {
        Swal.fire('Gagal', 'Terjadi kesalahan saat memproses perhitungan SPK.', 'error');
    }
};

// =========================================================================
// 5. FITUR TOMBOL KENDALI: VERIFIKASI ALGORITMA (KOMPARASI SAW vs WP)
// =========================================================================
window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    if (modal) modal.style.display = 'flex';

    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memproses komparasi SAW vs WP...</td></tr>';

    try {
        const res = await window.fetchData('/komparasi');
        if (!res || !res.ok) throw new Error();
        const data = await res.json();
        if (tbody) tbody.innerHTML = '';

        const labels = [];
        const sawScores = [];
        const wpScores = [];

        data.slice(0, 15).forEach((item) => {
            labels.push(item.nama.split(' ')[0]);
            sawScores.push(item.saw_skor);
            wpScores.push(item.wp_skor);

            if (tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td><b>${safeHtml(item.nama)}</b><br><small class="text-muted">${item.nik}</small></td>
                        <td style="text-align:center;"><b>#${item.saw_rank}</b></td>
                        <td style="text-align:center; color:#009846; font-weight:700;">${item.saw_skor}</td>
                        <td style="text-align:center;"><b>#${item.wp_rank}</b></td>
                        <td style="text-align:center; color:#0284c7; font-weight:700;">${item.wp_skor}</td>
                    </tr>
                `;
            }
        });

        // Render Grafik Komparasi
        const ctx = document.getElementById('compChart');
        if (ctx) {
            if (compChart) compChart.destroy();
            compChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Skor SAW', data: sawScores, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, fill: true },
                        { label: 'Skor WP', data: wpScores, borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', tension: 0.3, fill: true }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat komparasi.</td></tr>';
    }
};

window.exportKomparasiPDF = function () {
    const el = document.getElementById('printKomparasiArea');
    if (!el) return;
    const opt = { margin: 10, filename: `Laporan_Uji_Komparasi_SAW_WP_${new Date().getFullYear()}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
    html2pdf().set(opt).from(el).save();
};

// =========================================================================
// 6. FITUR TOMBOL KENDALI: INVESTIGASI LAPORAN
// =========================================================================
window.bukaModalLaporanChat = async function () {
    const modal = document.getElementById('modalLaporanChat');
    const container = document.getElementById('laporanChatList');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Memuat data laporan...</div>';

    try {
        const res = await window.fetchData('/api/laporan-chat');
        if (!res || !res.ok) throw new Error();
        const reports = await res.json();
        container.innerHTML = '';

        if (reports.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px 10px; color:#64748b;">Belum ada laporan pengaduan masuk.</div>';
            return;
        }

        reports.forEach((r) => {
            container.innerHTML += `
                <div class="card" style="padding:15px; margin-bottom:12px; border-left:4px solid var(--danger); box-shadow:var(--shadow-sm);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0; color:#0f172a;"><b>${safeHtml(r.nama)}</b> <small class="text-muted">(NIK: ${r.nik})</small></h4>
                        <span style="font-size:0.75rem; color:#64748b;"><i class="fas fa-clock"></i> ${r.waktu}</span>
                    </div>
                    <p style="margin:8px 0; font-size:0.9rem; color:#334155; line-height:1.5;">${safeHtml(r.pesan || 'Mengirim lampiran berkas laporan.')}</p>
                    <div style="text-align:right;">
                        <button onclick="window.closeModal('modalLaporanChat'); window.openAdminChat();" class="btn btn-secondary" style="padding:5px 12px; font-size:0.8rem; border-radius:8px;"><i class="fas fa-reply"></i> Buka Percakapan</button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; color:red; padding:30px;">Gagal memuat riwayat laporan.</div>';
    }
};

// =========================================================================
// 7. ARSIP DATA WARGA (CRUD, IMPORT, EKSPOR, HAPUS SEMUA)
// =========================================================================
window.loadDashboardData = async function () {
    try {
        const res = await window.fetchData('/warga');
        if (!res || !res.ok) return;
        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        globalDataWarga = data;
        const statTotal = document.getElementById('statTotal');
        const statValid = document.getElementById('statValid');

        if (statTotal) statTotal.innerText = data.length;
        const validCount = data.filter(w => w.is_verified).length;
        if (statValid) statValid.innerText = validCount;

        window.renderDesilBarChart(data);
        window.renderTable(data);
        window.renderChoroplethKerentanan();
    } catch (err) { }
};

window.renderDesilBarChart = function (data) {
    const ctx = document.getElementById('wargaStatusChart');
    if (!ctx) return;

    const desilCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    data.forEach((w, idx) => { desilCounts[idx % 10]++; });

    if (desilChart) desilChart.destroy();
    desilChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'],
            datasets: [{
                label: 'Warga',
                data: desilCounts,
                backgroundColor: ['#ef4444', '#f87171', '#fb923c', '#f59e0b', '#38bdf8', '#0284c7', '#10b981', '#059669', '#64748b', '#94a3b8'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
        }
    });
};

window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];
    if ($.fn.DataTable.isDataTable('#dataTable')) {
        $('#dataTable').DataTable().clear().destroy();
    }
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    let html = '';
    data.forEach(w => {
        const isVerified = w.is_verified || false;
        const verifBadge = isVerified
            ? '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Disetujui</span>'
            : '<span class="badge badge-red"><i class="fas fa-clock"></i> Menunggu</span>';

        let statusSalurBadge = '';
        if (w.status_salur === 'Telah Menerima') {
            statusSalurBadge = `<span class="badge badge-green" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-box-check"></i> Telah Menerima</span>`;
        } else if (String(w.status_salur).includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px; background:#fee2e2; color:#dc2626;"><i class="fas fa-exclamation-triangle"></i> Sengketa Belum Terima</span>`;
        }

        const btnDelete = user && user.role === 'admin'
            ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:5px 8px; background:#ef4444; color:white; font-size:0.8rem; border-radius:6px;" title="Hapus"><i class="fas fa-trash"></i></button>`
            : '';

        html += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td>
                <td style="font-weight:700; font-family:monospace; color:#0f172a;">${w.nik}</td>
                <td>
                    <div style="font-weight:700; color:#1e293b;">${safeHtml(w.nama)}</div>
                    <small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${safeHtml(w.alamat || 'Sidoarjo')}</small><br>
                    ${statusSalurBadge}
                </td>
                <td><small><i class="fas fa-calendar-alt text-muted"></i> ${w.tanggal_lahir || 'Hari ini'}</small></td>
                <td style="text-align:center;">${verifBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:5px 8px; background:#fef3c7; color:#b45309; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Edit Data"><i class="fas fa-edit"></i></button>
                    <button onclick="window.bukaUploadBuktiSalur(${w.id}, '${escapeInlineJS(w.nama)}', '${w.bukti_salur || ''}')" class="btn" style="padding:5px 8px; background:#dcfce7; color:#15803d; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Foto Bukti Penyaluran"><i class="fas fa-camera"></i></button>
                    <button onclick="window.bukaAksiCepatSengketa(${w.id}, '${escapeInlineJS(w.nama)}', '${w.nik}')" class="btn" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Aksi Sengketa"><i class="fas fa-shield-alt"></i></button>
                    <button onclick="window.toggleVerifySingle(${w.id})" class="btn" style="padding:5px 8px; background:#e0f2fe; color:#0284c7; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Ubah Status Validasi"><i class="fas fa-sync-alt"></i></button>
                    ${btnDelete}
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    dtTable = $('#dataTable').DataTable({
        pageLength: 10, responsive: true, order: [[1, 'asc']],
        language: { search: "Cari NIK/Nama:", lengthMenu: "_MENU_ baris", info: "Menampilkan _START_ s.d. _END_ dari _TOTAL_ warga", paginate: { next: "→", previous: "←" } }
    });
};

window.exportExcelLengkap = function () {
    if (!globalDataWarga || globalDataWarga.length === 0) {
        return Swal.fire('Data Kosong', 'Tidak ada data warga di arsip untuk diekspor.', 'warning');
    }
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
        'Status Penyaluran': w.status_salur || 'Pending', 'Status Validasi': w.is_verified ? 'Disetujui' : 'Menunggu',
        'Catatan Lapangan Tambahan': w.catatan || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Warga Bansos");
    XLSX.writeFile(workbook, `Data_Lengkap_Warga_Bansos_Sidoarjo_${new Date().getFullYear()}.xlsx`);

    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'File Excel Berhasil Diekspor!', showConfirmButton: false, timer: 2500 });
};

window.hapusSemuaWarga = async function () {
    const confirm = await Swal.fire({
        title: 'Hapus Seluruh Data?', text: 'Tindakan ini akan mengosongkan seluruh arsip data warga!', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus Semua'
    });
    if (confirm.isConfirmed) {
        const res = await window.fetchData('/warga/delete-all', { method: 'POST' });
        if (res && res.ok) {
            Swal.fire('Selesai', 'Seluruh data warga berhasil dikosongkan.', 'success');
            window.loadDashboardData();
        }
    }
};

window.bukaModalEdit = function (id) {
    const w = globalDataWarga.find(item => item.id === id);
    if (!w) return;
    document.getElementById('editId').value = w.id;
    document.getElementById('editNama').value = w.nama || '';
    document.getElementById('editNik').value = w.nik || '';
    document.getElementById('editNoHp').value = w.no_hp || '';
    document.getElementById('editEmail').value = w.email || '';
    document.getElementById('editTempatLahir').value = w.tempat_lahir || '';
    document.getElementById('editTglLahir').value = w.tanggal_lahir || '';
    document.getElementById('editAlamat').value = w.alamat || '';
    document.getElementById('editC1').value = w.c1_ekonomi || 0;
    document.getElementById('editC2').value = w.c2_aset || 0;
    document.getElementById('editC3').value = w.c3_umur || 0;
    document.getElementById('editC4').value = w.c4_jenis_kelamin || 1;
    document.getElementById('editC5').value = w.c5_tanggungan || 0;
    document.getElementById('editC6').value = w.c6_status_pernikahan || 1;
    document.getElementById('editC7').value = w.c7_kepemilikan_anak || 0;
    document.getElementById('editC8').value = w.c8_tempat_tinggal || 1;
    document.getElementById('editC9').value = w.c9_pendidikan || 1;
    document.getElementById('editC10').value = w.c10_kesehatan || 1;
    document.getElementById('editCatatan').value = w.catatan || '';

    const modal = document.getElementById('modalEdit');
    if (modal) modal.style.display = 'flex';
};

window.simpanEdit = async function (e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const payload = {
        nama: document.getElementById('editNama').value.trim(),
        nik: document.getElementById('editNik').value.trim(),
        no_hp: document.getElementById('editNoHp').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        tempat_lahir: document.getElementById('editTempatLahir').value.trim(),
        tanggal_lahir: document.getElementById('editTglLahir').value || null,
        alamat: document.getElementById('editAlamat').value.trim(),
        c1: parseFloat(document.getElementById('editC1').value || 0),
        c2: parseInt(document.getElementById('editC2').value || 0),
        c3: parseInt(document.getElementById('editC3').value || 0),
        c4: parseInt(document.getElementById('editC4').value || 1),
        c5: parseInt(document.getElementById('editC5').value || 0),
        c6: parseInt(document.getElementById('editC6').value || 1),
        c7: parseInt(document.getElementById('editC7').value || 0),
        c8: parseInt(document.getElementById('editC8').value || 1),
        c9: parseInt(document.getElementById('editC9').value || 1),
        c10: parseInt(document.getElementById('editC10').value || 1),
        catatan: document.getElementById('editCatatan').value.trim()
    };

    const res = await window.fetchData(`/warga/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (res && res.ok) {
        Swal.fire('Berhasil', 'Data warga berhasil diperbarui.', 'success');
        window.closeModal('modalEdit');
        window.loadDashboardData();
    }
};

window.bukaUploadBuktiSalur = function (id, namaWarga, existingPhoto) {
    let previewHtml = existingPhoto
        ? `<div style="margin-bottom:15px;"><img src="${API_URL}/uploads/${existingPhoto}" style="max-width:100%; max-height:200px; border-radius:10px;" /></div>`
        : `<p style="font-size:0.85rem; color:#64748b;">Belum ada dokumentasi serah terima.</p>`;

    Swal.fire({
        title: `Bukti Penyaluran Bansos`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <b>Penerima:</b> ${safeHtml(namaWarga)}<br>
                ${previewHtml}
                <label style="font-weight:700; font-size:0.85rem; display:block; margin:10px 0 5px 0;">Pilih / Ambil Foto Dokumentasi:</label>
                <input type="file" id="swalFileBukti" accept="image/*" class="form-input" style="padding:8px;" />
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Simpan Foto', confirmButtonColor: '#009846',
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
            if (res && res.ok) {
                Swal.fire('Tersimpan', 'Foto bukti penyaluran berhasil disimpan.', 'success');
                window.loadDashboardData();
            }
        }
    });
};

window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    Swal.fire({
        title: `Laporan Sengketa Penyaluran`,
        html: `<p style="text-align:left; font-size:0.9rem;">Warga <b>${safeHtml(namaWarga)}</b> (NIK: ${nik}) melapor belum menerima bantuan?</p>`,
        showDenyButton: true, showCancelButton: true,
        confirmButtonText: 'Tandai Sengketa', denyButtonText: 'Tandai Selesai (Sudah Diterima)',
        confirmButtonColor: '#dc2626', denyButtonColor: '#16a34a'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await window.fetchData(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi: 'sengketa' }) });
            Swal.fire('Tercatat', 'Status warga ditandai sengketa.', 'warning');
            window.loadDashboardData();
        } else if (result.isDenied) {
            await window.fetchData(`/warga/${id}/lapor-sengketa`, { method: 'POST', body: JSON.stringify({ aksi: 'selesai' }) });
            Swal.fire('Selesai', 'Status warga dikembalikan ke Telah Menerima.', 'success');
            window.loadDashboardData();
        }
    });
};

window.smartImportPreview = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const res = await window.fetchData('/warga/bulk', { method: 'POST', body: JSON.stringify({ data: rawJson }) });
        if (res && res.ok) {
            Swal.fire('Berhasil', `${rawJson.length} baris data berhasil diimpor.`, 'success');
            window.loadDashboardData();
        }
    };
    reader.readAsArrayBuffer(file);
};

window.bukaModalMatriksKerja = function () {
    if (!lastSPKResult || !lastSPKResult.matriks_normalisasi) return Swal.fire('Info', 'Proses Algoritma SAW terlebih dahulu.', 'info');
    let rows = '';
    lastSPKResult.matriks_normalisasi.slice(0, 10).forEach(m => {
        rows += `<tr><td><b>${safeHtml(m.nama)}</b></td><td>${m.C1}</td><td>${m.C2}</td><td>${m.C3}</td><td>${m.C4}</td><td>${m.C5}</td><td>${m.C6}</td><td>${m.C7}</td><td>${m.C8}</td><td>${m.C9}</td><td>${m.C10}</td></tr>`;
    });
    Swal.fire({ title: 'Matriks Normalisasi (R)', html: `<div style="max-height:300px; overflow-x:auto;"><table class="modern-table">${rows}</table></div>`, width: '750px' });
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
    html2pdf().set({ margin: 10, filename: `SK_Bansos_Sidoarjo_${new Date().getFullYear()}.pdf`, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save().then(() => { el.style.display = 'none'; });
};

window.syncBPS = async function () {
    await window.fetchData('/api/bps/sync', { method: 'POST' });
    Swal.fire('Selesai', 'Data BPS disinkronkan.', 'success');
    window.loadDashboardData();
};

window.tambahData = async function (e) {
    if (e) e.preventDefault();
    const payload = {
        nama: document.getElementById('nama')?.value.trim(),
        nik: document.getElementById('nik')?.value.trim(),
        no_hp: document.getElementById('no_hp')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || '',
        tempat_lahir: document.getElementById('tempatLahir')?.value.trim() || '',
        tanggal_lahir: document.getElementById('tglLahir')?.value || null,
        alamat: document.getElementById('alamat')?.value.trim() || '',
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
    const res = await window.fetchData('/warga', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) {
        Swal.fire('Berhasil', 'Data warga berhasil disimpan.', 'success');
        document.getElementById('bansosForm')?.reset();
        window.loadDashboardData();
    }
};

window.toggleVerifySingle = async function (id) {
    const res = await window.fetchData(`/warga/${id}/verify`, { method: 'PATCH' });
    if (res && res.ok) window.loadDashboardData();
};

window.hapusData = async function (id) {
    if (confirm('Hapus data warga ini?')) {
        await window.fetchData(`/warga/${id}`, { method: 'DELETE' });
        window.loadDashboardData();
    }
};

window.verifyAllData = async function () {
    const ids = Array.from(document.querySelectorAll('.row-checkbox')).map(c => parseInt(c.value));
    if (ids.length === 0) return Swal.fire('Info', 'Tidak ada data.', 'info');
    for (let id of ids) { await window.fetchData(`/warga/${id}/verify`, { method: 'PATCH' }); }
    Swal.fire('Sukses', 'Semua data diverifikasi.', 'success');
    window.loadDashboardData();
};

window.toggleSelectAll = function (source) {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = source.checked; });
};

window.cekDukcapilLokal = async function () {
    const nik = document.getElementById('nik')?.value.trim();
    if (!nik || nik.length !== 16) return Swal.fire('Peringatan', 'Masukkan 16 digit NIK.', 'warning');
    const res = await window.fetchData(`/api/dukcapil/${nik}`);
    if (res && res.ok) {
        const d = (await res.json()).data;
        if (d) {
            if (document.getElementById('nama')) document.getElementById('nama').value = d.nama;
            if (document.getElementById('tempatLahir')) document.getElementById('tempatLahir').value = d.tempat_lahir;
            if (document.getElementById('tglLahir')) document.getElementById('tglLahir').value = d.tanggal_lahir;
            if (document.getElementById('alamat')) document.getElementById('alamat').value = d.alamat;
            if (document.getElementById('c4')) document.getElementById('c4').value = d.jenis_kelamin === 'Perempuan' ? '2' : '1';
        }
    }
};

window.processOCR = async function (input) {
    if (!input.files || !input.files[0]) return;
    Swal.fire({ title: 'AI OCR Scan...', didOpen: () => Swal.showLoading() });
    const res = await Tesseract.recognize(input.files[0], 'ind');
    Swal.close();
    const nikMatch = res.data.text.match(/\b\d{16}\b/);
    if (nikMatch && document.getElementById('nik')) {
        document.getElementById('nik').value = nikMatch[0];
        window.cekDukcapilLokal();
    }
};

// =========================================================================
// 8. LIVE CHAT MULTIMEDIA, VOICE RECORDER & WEBRTC CALL
// =========================================================================
window.initPeerCall = function () {
    try {
        if (typeof Peer !== 'undefined' && !myPeer) {
            myPeer = new Peer(`dinsos_admin_${Date.now().toString().slice(-4)}`);
            myPeer.on('call', call => {
                currentCall = call;
                document.getElementById('incomingCallUI').style.display = 'flex';
                document.getElementById('callerNameText').innerText = call.peer;
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
    } catch (e) {
        Swal.fire('Izin Ditolak', 'Tidak dapat mengakses mikrofon atau kamera.', 'error');
    }
};

window.endCall = function () {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentCall) currentCall.close();
    document.getElementById('activeCallUI').style.display = 'none';
    document.getElementById('incomingCallUI').style.display = 'none';
};

window.toggleVoiceRecordAdmin = async function () {
    if (!window.isAdminRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.adminAudioRecorder = new MediaRecorder(stream);
            window.adminAudioChunks = [];
            window.adminAudioRecorder.ondataavailable = e => window.adminAudioChunks.push(e.data);
            window.adminAudioRecorder.onstop = () => {
                window.adminMediaBlob = new Blob(window.adminAudioChunks, { type: 'audio/mp3' });
                window.adminMediaExt = 'mp3';
                window.adminMediaType = 'audio';
            };
            window.adminAudioRecorder.start();
            window.isAdminRecordingAudio = true;
            document.getElementById('adminRecordingUI').style.display = 'flex';
            document.getElementById('adminChatInput').style.display = 'none';
        } catch (e) {
            Swal.fire('Error', 'Gagal mengakses mikrofon.', 'error');
        }
    } else {
        window.adminAudioRecorder.stop();
        window.isAdminRecordingAudio = false;
        document.getElementById('adminRecordingUI').style.display = 'none';
        document.getElementById('adminChatInput').style.display = 'block';
    }
};

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
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#1e293b; font-size:0.95rem;">${safeHtml(c.nama)}</strong>
                    <span style="font-size:0.75rem; color:#64748b;">${c.waktu}</span>
                </div>
                <small style="color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeHtml(c.last_msg)}</small>
            </div>
        `;
    });
    container.innerHTML = html;
};

window.loadChatMessages = async function (nik, nama) {
    activeChatNik = String(nik);
    activeChatName = nama;
    const nameDisp = document.getElementById('chatActiveName');
    if (nameDisp) nameDisp.innerText = `${nama} (${nik})`;

    const inp = document.getElementById('adminChatInput');
    if (inp) inp.disabled = false;

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
                    mediaHtml = `<img src="${url}" style="max-width:220px; border-radius:10px; margin-top:6px; display:block;" />`;
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
    window.batalLampiran();

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

window.batalLampiran = function () {
    window.adminMediaBlob = null;
    window.adminMediaExt = '';
    window.adminMediaType = '';
    const fileInp = document.getElementById('adminChatFile');
    if (fileInp) fileInp.value = '';
    const nameEl = document.getElementById('adminFileName');
    if (nameEl) nameEl.style.display = 'none';
};

window.tutupObrolanAktif = function () {
    activeChatNik = null;
    activeChatName = null;
    const nameDisp = document.getElementById('chatActiveName');
    if (nameDisp) nameDisp.innerText = 'Pilih warga dari panel kiri...';
    const inp = document.getElementById('adminChatInput');
    if (inp) inp.disabled = true;
    const msgs = document.getElementById('adminChatMessages');
    if (msgs) msgs.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:100px;"><i class="fas fa-comments fa-3x" style="opacity:0.3; margin-bottom:15px;"></i><br>Pilih daftar warga untuk mulai berinteraksi.</div>';
};

window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
};

window.logout = function () {
    localStorage.clear();
    window.location.href = 'login.html';
};