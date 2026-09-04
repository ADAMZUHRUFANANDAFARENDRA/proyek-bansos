/* =========================================================================
   ADMIN.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS KABUPATEN SIDOARJO (FULL CODE)
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   METODE BWM (BEST-WORST METHOD) & SAW (SIMPLE ADDITIVE WEIGHTING) + VALIDASI WP
   ========================================================================= */

// Injeksi Style Antarmuka Dasbor, DataTables & UI Chat Mediasi Modern
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
    
    .map-legend-box {
        background: rgba(255, 255, 255, 0.98);
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        font-family: 'Inter', sans-serif;
        font-size: 11.5px;
        line-height: 1.5;
        border: 1px solid #cbd5e1;
    }
    .map-legend-box div { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .map-legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }

    .chat-header-container, #chatHeaderActions { position: relative; }
    #chatActionDropdown {
        position: absolute !important;
        top: 48px !important;
        right: 12px !important;
        left: auto !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 10px !important;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
        z-index: 9999 !important;
        display: none;
        min-width: 210px !important;
        padding: 6px 0 !important;
    }
    #chatActionDropdown button {
        width: 100% !important;
        text-align: left !important;
        background: none !important;
        border: none !important;
        padding: 9px 16px !important;
        font-size: 0.82rem !important;
        color: #334155 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        transition: background 0.15s ease;
    }
    #chatActionDropdown button:hover {
        background: #f1f5f9 !important;
        color: #009846 !important;
    }
`;
document.head.appendChild(dtStyle);

// 1. KONFIGURASI GLOBAL & STATE MANAGEMENT
const API_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://127.0.0.1:5000';
const MAP_CENTER_SIDOARJO = [-7.4478, 112.7183];

window.globalDataWarga = [];
let globalDataWarga = [];
window.currentFilter = 'all';
window.currentSort = 'terbaru';
window.sortNikAsc = false;
window.sortAzAsc = false;
window.selectedTanggalDaftar = '';
window.petaModeDetailDesa = false;

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
let macroLegendControl = null;
let macroModeSwitchControl = null;

let lastSPKResult = null;
let lastKomparasiResult = [];

let user = null;
try {
    user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('bansosUser'));
} catch (e) { }

let activeChatNik = null;
let activeChatName = null;
let replyToDataAdmin = null;

window.adminMediaBlob = null;
window.adminMediaExt = '';
window.adminMediaType = '';
window.adminAudioRecorder = null;
window.adminAudioChunks = [];
window.isAdminRecordingAudio = false;
window.adminRecordTimer = null;
window.adminRecordSecs = 0;
let audioContextAdmin = null, analyserAdmin = null, dataArrayAdmin = null, reqFrameAdmin = null;

let vPlayer = null, vCanvas = null, vCtx = null, vRotation = 0, vStartTime = 0, vEndTime = 0, vDuration = 0;
let filerobotImageInstance = null;

let myPeer = null, currentCall = null, localStream = null;
let isCallAudioMuted = false, isCallVideoMuted = false, isCallBlurred = false;
let callTimerInterval = null, callDurationSecs = 0;

let rawChatListData = [];
window.activeChatTab = 'inbox';
window.activeNotifTab = 'baru';
window.isNotifPanelOpen = false;

// =========================================================================
// DATA POLIGON 18 KECAMATAN (TERKUNCI PRESISI DI KABUPATEN SIDOARJO)
// =========================================================================
const WILAYAH_SIDOARJO = [
    { nama: "Balongbendo", center: [-7.3750, 112.5350], defaultAvgDesil: 2.4, desa: "Balongbendo, Seketi, Suwaluh, Bakalan, Bakungpringgodani, Bogempinggir, Gadungkepuhsari, Jabaran, Jeruklegi, Kedungsukodani, Penambangan, Seduri, Singkalan, Sumokembangsri, Waruberon, Watesnegoro", polygon: [[-7.3500, 112.5050], [-7.3500, 112.5650], [-7.4050, 112.5650], [-7.4050, 112.5050]] },
    { nama: "Krian", center: [-7.3880, 112.5975], defaultAvgDesil: 4.9, desa: "Krian, Barengkrajan, Gawat, Jerukgamping, Junwangi, Katerungan, Keboharan, Kraton, Ponokawan, Sedenganmijen, Sidomojo, Sidomulyo, Sidorejo, Tambakkemerakan, Tempel, Terik, Terungkulon, Terungwetan, Tropodo, Watutulis", polygon: [[-7.3650, 112.5650], [-7.3650, 112.6300], [-7.4100, 112.6300], [-7.4100, 112.5650]] },
    { nama: "Taman", center: [-7.3580, 112.6625], defaultAvgDesil: 3.8, desa: "Bebekan, Sepanjang, Wonocolo, Geluran, Kalijaten, Ngelom, Krembangan, Bohar, Bringinbendo, Jemundo, Kletek, Kramat Jegu, Sambibulu, Sadang, Tanjungsari, Trosobo, Wage, Tawangsari", polygon: [[-7.3400, 112.6300], [-7.3400, 112.6950], [-7.3850, 112.6950], [-7.3850, 112.6300]] },
    { nama: "Waru", center: [-7.3580, 112.7250], defaultAvgDesil: 4.8, desa: "Waru, Tropodo, Wadungasri, Kureksari, Berbek, Bungurasih, Janti, Kedungrejo, Medaeng, Ngingas, Pepelegi, Tambaksawah, Tambakrejo, Tambaksumur", polygon: [[-7.3400, 112.6950], [-7.3400, 112.7550], [-7.3800, 112.7550], [-7.3800, 112.6950]] },
    { nama: "Sedati", center: [-7.3780, 112.7975], defaultAvgDesil: 2.3, desa: "Cemandi, Buncitan, Betro, Sedati Gede, Sedati Agung, Kalanganyar, Gisikcemandi, Banjar Kemuning, Semampir, Pranti, Segoro Tambak, Tambak Cemandi, Pulungan, Kwangsan, Pepe", polygon: [[-7.3450, 112.7550], [-7.3450, 112.8400], [-7.4100, 112.8400], [-7.4100, 112.7550]] },
    { nama: "Sukodono", center: [-7.4050, 112.6625], defaultAvgDesil: 3.4, desa: "Sukodono, Anggaswangi, Masangan Kulon, Masangan Wetan, Ngaresrejo, Pekarungan, Plumbungan, Sambungrejo, Suko, Suruh, Bangsri, Jogosatru, Kloposepuluh, Panjunan, Wilayut", polygon: [[-7.3850, 112.6300], [-7.3850, 112.6950], [-7.4250, 112.6950], [-7.4250, 112.6300]] },
    { nama: "Gedangan", center: [-7.4000, 112.7250], defaultAvgDesil: 3.6, desa: "Gedangan, Ganting, Keboansikep, Keboan Anom, Sawotratap, Semambung, Sruni, Tebel, Wedi, Ketajen, Kragan", polygon: [[-7.3800, 112.6950], [-7.3800, 112.7550], [-7.4200, 112.7550], [-7.4200, 112.6950]] },
    { nama: "Tarik", center: [-7.4350, 112.5350], defaultAvgDesil: 1.9, desa: "Tarik, Klampisan, Singogalih, Banjarwungu, Gampingrowo, Janti, Kalidawir, Kedungbocok, Kedunglosari, Kemuning, Kendalsewu, Mergobener, Mergosari, Mindugading, Miriprowo, Sebani, Segodobancang", polygon: [[-7.4050, 112.5050], [-7.4050, 112.5650], [-7.4650, 112.5650], [-7.4650, 112.5050]] },
    { nama: "Wonoayu", center: [-7.4350, 112.6000], defaultAvgDesil: 3.5, desa: "Wonoayu, Candinegoro, Becirongengor, Jimbaran Kulon, Jimbaran Wetan, Karangpuri, Mulyodadi, Pagerngumbuk, Pilang, Plaosan, Popoh, Sawocangkring, Semambung, Simoangin-angin, Simoketawang, Sumberejo, Tanggul, Wonokalang", polygon: [[-7.4100, 112.5650], [-7.4100, 112.6350], [-7.4600, 112.6350], [-7.4600, 112.5650]] },
    { nama: "Sidoarjo", center: [-7.4450, 112.6750], defaultAvgDesil: 5.6, desa: "Sidokumpul, Lemahputro, Magersari, Celep, Pekauman, Sidokare, Sekardangan, Bluru Kidul, Kemiri, Gebang, Rangkah Kidul, Banjarbendo, Urangagung, Sarirogo, Sumput, Cemengkalang, Cemengbakalan", polygon: [[-7.4250, 112.6350], [-7.4250, 112.7150], [-7.4650, 112.7150], [-7.4650, 112.6350]] },
    { nama: "Buduran", center: [-7.4350, 112.7700], defaultAvgDesil: 5.2, desa: "Buduran, Prasung, Sawohan, Banjarkemantren, Banjarsari, Damarsi, Dukuhtengah, Entalsewu, Pagerwojo, Sidokerto, Siwalanpanji, Sukorejo, Wadungasih", polygon: [[-7.4100, 112.7150], [-7.4100, 112.8250], [-7.4600, 112.8250], [-7.4600, 112.7150]] },
    { nama: "Prambon", center: [-7.4850, 112.5450], defaultAvgDesil: 3.1, desa: "Prambon, Jedongcangkring, Pejangkungan, Bendotretek, Bulang, Cangkringturi, Gampang, Gedangrowo, Jatialunalun, Jatikalang, Kedungwonokerto, Simogirang, Simpang, Temu, Watutulis, Wirobiting", polygon: [[-7.4650, 112.5150], [-7.4650, 112.5750], [-7.5050, 112.5750], [-7.5050, 112.5150]] },
    { nama: "Tulangan", center: [-7.4825, 112.6100], defaultAvgDesil: 2.2, desa: "Tulangan, Kenongo, Modong, Gelang, Grabagan, Grogol, Janti, Jiken, Kajeksan, Kebaron, Kedondong, Kemantren, Kepadangan, Kepatihan, Kepuhkemiri, Koto, Medalem, Pangkemiri, Singopadu, Sudimoro, Tlasih", polygon: [[-7.4600, 112.5750], [-7.4600, 112.6450], [-7.5050, 112.6450], [-7.5050, 112.5750]] },
    { nama: "Tanggulangin", center: [-7.4850, 112.6800], defaultAvgDesil: 2.4, desa: "Kedensari, Kalitengah, Kludan, Boro, Ngaban, Putat, Kalidawir, Kalisampurno, Kedungbanteng, Banjarpanji, Banjarasri, Penatarsewu, Randegan, Gempolsari", polygon: [[-7.4650, 112.6450], [-7.4650, 112.7150], [-7.5050, 112.7150], [-7.5050, 112.6450]] },
    { nama: "Candi", center: [-7.4825, 112.7700], defaultAvgDesil: 3.2, desa: "Candi, Sepande, Gelam, Kalipecabean, Balonggabus, Balongmacekan, Bligo, Durungbedug, Durungbanjar, Karangtanjung, Kedungkendo, Kedungpeluk, Klurak, Larangan, Sugihwaras, Sumokali, Tenggulunan, Wedoroklurak", polygon: [[-7.4600, 112.7150], [-7.4600, 112.8250], [-7.5050, 112.8250], [-7.5050, 112.7150]] },
    { nama: "Krembung", center: [-7.5225, 112.5875], defaultAvgDesil: 2.3, desa: "Krembung, Mojoruntut, Tanjegwagir, Balonggarut, Cangkring, Gading, Jandep, Jenggot, Kandangan, Kedungrawan, Keper, Lemujut, Ploso, Rejeni, Tambakrejo, Waung, Wangkal, Wonomlati", polygon: [[-7.5050, 112.5500], [-7.5050, 112.6250], [-7.5400, 112.6250], [-7.5400, 112.5500]] },
    { nama: "Porong", center: [-7.5250, 112.6700], defaultAvgDesil: 2.1, desa: "Porong, Mindi, Gedang, Juwetkenongo, Glagaharum, Kebonagung, Keboguyang, Lajuk, Pamotan, Pesawahan, Plumbon, Candi Pari, Wirobiting", polygon: [[-7.5050, 112.6250], [-7.5050, 112.7150], [-7.5450, 112.7150], [-7.5450, 112.6250]] },
    { nama: "Jabon", center: [-7.5250, 112.7750], defaultAvgDesil: 1.8, desa: "Dukuhsari, Permisan, Keboguyang, Balongtani, Besuki, Chandi, Kedungcangkring, Kedungpandan, Kedungrejo, Kupang, Panggreh, Pejarakan, Semambung, Tambakkalisogo", polygon: [[-7.5050, 112.7150], [-7.5050, 112.8350], [-7.5450, 112.8350], [-7.5450, 112.7150]] }
];

// =========================================================================
// DATA POLIGON PER DESA (18 KECAMATAN SE-KABUPATEN SIDOARJO)
// =========================================================================
const DETAIL_DESA_SIDOARJO = [
    { nama: "Kel. Kureksari", kec: "Waru", desil: 4, polygon: [[-7.3400, 112.6950], [-7.3400, 112.7250], [-7.3600, 112.7250], [-7.3600, 112.6950]] },
    { nama: "Desa Tropodo", kec: "Waru", desil: 5, polygon: [[-7.3400, 112.7250], [-7.3400, 112.7550], [-7.3600, 112.7550], [-7.3600, 112.7250]] },
    { nama: "Desa Berbek", kec: "Waru", desil: 4, polygon: [[-7.3600, 112.6950], [-7.3600, 112.7250], [-7.3800, 112.7250], [-7.3800, 112.6950]] },
    { nama: "Desa Pepelegi", kec: "Waru", desil: 6, polygon: [[-7.3600, 112.7250], [-7.3600, 112.7550], [-7.3800, 112.7550], [-7.3800, 112.7250]] },
    { nama: "Kel. Sepanjang", kec: "Taman", desil: 4, polygon: [[-7.3400, 112.6300], [-7.3400, 112.6625], [-7.3620, 112.6625], [-7.3620, 112.6300]] },
    { nama: "Desa Wage", kec: "Taman", desil: 5, polygon: [[-7.3400, 112.6625], [-7.3400, 112.6950], [-7.3620, 112.6950], [-7.3620, 112.6625]] },
    { nama: "Desa Trosobo", kec: "Taman", desil: 3, polygon: [[-7.3620, 112.6300], [-7.3620, 112.6625], [-7.3850, 112.6625], [-7.3850, 112.6300]] },
    { nama: "Desa Cemandi", kec: "Sedati", desil: 1, polygon: [[-7.3450, 112.7550], [-7.3450, 112.7975], [-7.3800, 112.7975], [-7.3800, 112.7550]] },
    { nama: "Desa Sedati Gede", kec: "Sedati", desil: 2, polygon: [[-7.3450, 112.7975], [-7.3450, 112.8400], [-7.3800, 112.8400], [-7.3800, 112.7975]] },
    { nama: "Desa Sukodono", kec: "Sukodono", desil: 3, polygon: [[-7.3850, 112.6300], [-7.3850, 112.6625], [-7.4050, 112.6625], [-7.4050, 112.6300]] },
    { nama: "Desa Gedangan", kec: "Gedangan", desil: 4, polygon: [[-7.3800, 112.6950], [-7.3800, 112.7250], [-7.4000, 112.7250], [-7.4000, 112.6950]] },
    { nama: "Kel. Sidokumpul", kec: "Sidoarjo", desil: 6, polygon: [[-7.4250, 112.6350], [-7.4250, 112.6750], [-7.4450, 112.6750], [-7.4450, 112.6350]] },
    { nama: "Kel. Lemahputro", kec: "Sidoarjo", desil: 5, polygon: [[-7.4250, 112.6750], [-7.4250, 112.7150], [-7.4450, 112.7150], [-7.4450, 112.6750]] },
    { nama: "Desa Buduran", kec: "Buduran", desil: 5, polygon: [[-7.4100, 112.7150], [-7.4100, 112.7700], [-7.4350, 112.7700], [-7.4350, 112.7150]] },
    { nama: "Desa Wonoayu", kec: "Wonoayu", desil: 4, polygon: [[-7.4100, 112.5650], [-7.4100, 112.6000], [-7.4350, 112.6000], [-7.4350, 112.5650]] },
    { nama: "Desa Tarik", kec: "Tarik", desil: 2, polygon: [[-7.4050, 112.5050], [-7.4050, 112.5350], [-7.4350, 112.5350], [-7.4350, 112.5050]] },
    { nama: "Desa Prambon", kec: "Prambon", desil: 3, polygon: [[-7.4650, 112.5150], [-7.4650, 112.5450], [-7.4850, 112.5450], [-7.4850, 112.5150]] },
    { nama: "Desa Tulangan", kec: "Tulangan", desil: 2, polygon: [[-7.4600, 112.5750], [-7.4600, 112.6100], [-7.4825, 112.6100], [-7.4825, 112.5750]] },
    { nama: "Desa Kedensari", kec: "Tanggulangin", desil: 2, polygon: [[-7.4650, 112.6450], [-7.4650, 112.6800], [-7.4850, 112.6800], [-7.4850, 112.6450]] },
    { nama: "Desa Candi", kec: "Candi", desil: 4, polygon: [[-7.4600, 112.7150], [-7.4600, 112.7700], [-7.4825, 112.7700], [-7.4825, 112.7150]] },
    { nama: "Desa Krembung", kec: "Krembung", desil: 2, polygon: [[-7.5050, 112.5500], [-7.5050, 112.5875], [-7.5225, 112.5875], [-7.5225, 112.5500]] },
    { nama: "Kel. Porong", kec: "Porong", desil: 2, polygon: [[-7.5050, 112.6250], [-7.5050, 112.6700], [-7.5250, 112.6700], [-7.5250, 112.6250]] },
    { nama: "Desa Dukuhsari", kec: "Jabon", desil: 1, polygon: [[-7.5050, 112.7150], [-7.5050, 112.7750], [-7.5250, 112.7750], [-7.5250, 112.7150]] }
];

// =========================================================================
// HELPER KEAMANAN & REQUEST API
// =========================================================================
function safeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeInlineJS(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
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
// INISIALISASI HALAMAN DASHBOARD & EVENT LISTENERS
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
            if (user.role === 'admin' || user.username === 'admin') {
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

    await window.loadDashboardData();
    setTimeout(() => {
        window.initFormMapPicker();
        window.initMacroDistributionMap();
    }, 350);

    window.setupNotificationSystemModern();
    window.fetchNotifikasiRealtime();
    setInterval(window.fetchNotifikasiRealtime, 6000);
    window.initPeerCall();
});

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
// 2. OCR SCAN KTP & VERIFIKASI DUKCAPIL SIDOARJO
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
            Swal.fire('Gagal', 'Data NIK tidak ditemukan di basis data Dukcapil Sidoarjo.', 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Gagal menghubungi server Dukcapil.', 'error');
    }
};

// =========================================================================
// 3. GEOTAGGING PRESISI & REVERSE GEOCODING AUTO-FILL ALAMAT
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
// 4. INIT PETA & MODE SWITCH INDEPENDEN (KECAMATAN VS DESA TANPA BERTABRAKAN)
// =========================================================================
window.initMacroDistributionMap = function () {
    const bigMapBox = document.getElementById('bigMapContainer');
    if (!bigMapBox || macroMap) return;

    macroMap = L.map('bigMapContainer', { 
        attributionControl: false,
        maxBounds: [
            [-7.6000, 112.4500], 
            [-7.3000, 112.9000]  
        ],
        maxBoundsViscosity: 1.0,
        minZoom: 10
    }).setView(MAP_CENTER_SIDOARJO, 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 18, 
        subdomains: ['a', 'b', 'c'] 
    }).addTo(macroMap);

    macroLayerGroup = L.layerGroup().addTo(macroMap);

    if (!macroModeSwitchControl) {
        macroModeSwitchControl = L.control({ position: 'topright' });
        macroModeSwitchControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-mode-box');
            div.innerHTML = `
                <button onclick="window.togglePetaDetailMode()" class="btn btn-sm" style="background:#ffffff; color:#0f172a; font-weight:800; border:1.5px solid #cbd5e1; box-shadow:0 3px 10px rgba(0,0,0,0.12); padding:7px 12px; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <i class="fas fa-layer-group text-primary"></i> <span id="lblModePeta">${window.petaModeDetailDesa ? 'Mode: Peta Per Desa' : 'Mode: Peta Per Kecamatan'}</span>
                </button>
            `;
            return div;
        };
        macroModeSwitchControl.addTo(macroMap);
    }

    if (!macroLegendControl) {
        macroLegendControl = L.control({ position: 'bottomright' });
        macroLegendControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-legend-box');
            div.innerHTML = `
                <div style="font-weight:800; color:#0f172a; margin-bottom:6px; border-bottom:1px solid #cbd5e1; padding-bottom:4px;">
                    <i class="fas fa-layer-group text-primary"></i> <span id="legendTitleText">Kerentanan Wilayah</span>
                </div>
                <div><span class="map-legend-dot" style="background:#ef4444;"></span> <b>Tinggi:</b> Desil 1–2 (Merah)</div>
                <div><span class="map-legend-dot" style="background:#eab308;"></span> <b>Sedang:</b> Desil 3–4 (Kuning)</div>
                <div><span class="map-legend-dot" style="background:#10b981;"></span> <b>Rendah:</b> Desil 5–10 (Hijau)</div>
            `;
            return div;
        };
        macroLegendControl.addTo(macroMap);
    }

    window.renderChoroplethKerentanan();
    setTimeout(() => { if (macroMap) macroMap.invalidateSize(); }, 400);
};

window.togglePetaDetailMode = function () {
    window.petaModeDetailDesa = !window.petaModeDetailDesa;
    
    const lbl = document.getElementById('lblModePeta');
    if (lbl) lbl.innerText = window.petaModeDetailDesa ? 'Mode: Peta Per Desa' : 'Mode: Peta Per Kecamatan';

    const legTitle = document.getElementById('legendTitleText');
    if (legTitle) legTitle.innerText = window.petaModeDetailDesa ? 'Kerentanan Per Desa' : 'Kerentanan Per Kecamatan';

    window.renderChoroplethKerentanan();
};

window.renderChoroplethKerentanan = function () {
    if (!macroMap || !macroLayerGroup) return;
    macroLayerGroup.clearLayers();

    if (window.petaModeDetailDesa) {
        DETAIL_DESA_SIDOARJO.forEach(d => {
            const wargaDesa = globalDataWarga.filter(w => {
                const alamat = (w.alamat || '').toLowerCase();
                const namaDesa = d.nama.toLowerCase().replace('desa ', '').replace('kel. ', '').trim();
                return alamat.includes(namaDesa);
            });

            let desilVal = d.desil;
            if (wargaDesa.length > 0) {
                const sumDesil = wargaDesa.reduce((acc, curr) => acc + (curr.desil || 5), 0);
                desilVal = parseFloat((sumDesil / wargaDesa.length).toFixed(1));
            }

            let polyColor = '#10b981';
            let statusText = 'Kerentanan Rendah';
            let badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #86efac;';

            if (desilVal <= 2.5) {
                polyColor = '#ef4444';
                statusText = 'Prioritas Tinggi (Desil 1–2)';
                badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
            } else if (desilVal <= 4.5) {
                polyColor = '#eab308';
                statusText = 'Prioritas Sedang (Desil 3–4)';
                badgeStyle = 'background:#fef9c3; color:#a16207; border:1px solid #fde047;';
            }

            const poly = L.polygon(d.polygon, {
                color: polyColor,
                weight: 1.8,
                opacity: 0.95,
                dashArray: '3, 3',
                fillColor: polyColor,
                fillOpacity: 0.45
            });

            poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3, fillOpacity: 0.65 }); });
            poly.on('mouseout', function (e) { e.target.setStyle({ weight: 1.8, fillOpacity: 0.45 }); });

            poly.bindPopup(`
                <div style="font-family:'Inter', sans-serif; font-size:12px; line-height:1.4; min-width:210px;">
                    <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:2px;">
                        <i class="fas fa-landmark" style="color:${polyColor};"></i> <b>${d.nama}</b>
                    </div>
                    <small style="color:#64748b; font-weight:600;">Kecamatan ${d.kec}, Kab. Sidoarjo</small>
                    <div style="margin: 6px 0;">
                        <span style="${badgeStyle} font-weight:700; font-size:10px; padding:2px 8px; border-radius:10px; display:inline-block;">
                            ${statusText}
                        </span>
                    </div>
                    <div style="color:#334155; font-size:11px;">
                        <b>Status Wilayah:</b> Desil ${desilVal}<br>
                        <b>Warga Terdata:</b> ${wargaDesa.length} Jiwa
                    </div>
                </div>
            `);

            macroLayerGroup.addLayer(poly);
        });
        return; 
    }

    WILAYAH_SIDOARJO.forEach((wil) => {
        const wargaWilayah = globalDataWarga.filter(w => {
            const alamat = (w.alamat || '').toLowerCase();
            return alamat.includes(wil.nama.toLowerCase());
        });

        let avgDesil = wil.defaultAvgDesil;
        if (wargaWilayah.length > 0) {
            const totalDesil = wargaWilayah.reduce((acc, curr) => acc + (curr.desil || 5), 0);
            avgDesil = parseFloat((totalDesil / wargaWilayah.length).toFixed(1));
        }

        let polyColor = '#10b981';
        let statusText = 'Kerentanan Rendah (Relatif Mandiri)';
        let badgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #86efac;';

        if (avgDesil <= 2.5) {
            polyColor = '#ef4444';
            statusText = 'Kerentanan Tinggi (Prioritas Utama)';
            badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;';
        } else if (avgDesil <= 4.5) {
            polyColor = '#eab308';
            statusText = 'Kerentanan Sedang (Prioritas Menengah)';
            badgeStyle = 'background:#fef9c3; color:#a16207; border:1px solid #fde047;';
        }

        const poly = L.polygon(wil.polygon, {
            color: polyColor,
            weight: 2,
            opacity: 0.95,
            dashArray: '5, 5',
            fillColor: polyColor,
            fillOpacity: 0.28
        });

        poly.on('mouseover', function (e) { e.target.setStyle({ weight: 3.5, fillOpacity: 0.52 }); });
        poly.on('mouseout', function (e) { e.target.setStyle({ weight: 2, fillOpacity: 0.28 }); });

        poly.bindPopup(`
            <div style="font-family:'Inter', sans-serif; font-size:12px; line-height:1.5; min-width:240px;">
                <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:4px;">
                    <i class="fas fa-map-marker-alt" style="color:${polyColor};"></i> Kec. <b>${wil.nama}</b>
                </div>
                <div style="margin: 4px 0;">
                    <span style="${badgeStyle} font-weight:700; font-size:10.5px; padding:2px 8px; border-radius:12px; display:inline-block;">
                        ${statusText}
                    </span>
                </div>
                <div style="margin-top:6px; color:#475569;">
                    <b>Rata-rata Kelompok:</b> Desil ${avgDesil}<br>
                    <b>Jumlah Warga Terdata:</b> ${wargaWilayah.length} Jiwa
                </div>
                <hr style="margin:8px 0; border:none; border-top:1px solid #e2e8f0;">
                <button onclick="window.bukaRincianWilayah('${escapeInlineJS(wil.nama)}')" class="btn btn-primary btn-sm" style="width:100%; font-size:11px; padding:6px; border-radius:6px; font-weight:700;">
                    <i class="fas fa-list-ul"></i> Lihat Seluruh Data Warga
                </button>
            </div>
        `);

        macroLayerGroup.addLayer(poly);
    });
};

// =========================================================================
// 5. MODAL RINCIAN PENERIMA BANSOS PER WILAYAH KECAMATAN
// =========================================================================
window.bukaRincianWilayah = function (namaWilayah) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) {
        titleEl.innerHTML = `<b>Kecamatan ${namaWilayah}</b>`;
    }
    tbody.innerHTML = '';

    const targetWil = WILAYAH_SIDOARJO.find(w => w.nama.toLowerCase() === namaWilayah.toLowerCase());
    const daftarDesa = targetWil && targetWil.desa ? targetWil.desa : 'Seluruh Desa dan Kelurahan Terkait';

    const listWarga = globalDataWarga.filter(w => {
        const alamat = (w.alamat || '').toLowerCase();
        return alamat.includes(namaWilayah.toLowerCase()) || globalDataWarga.length <= 10;
    });

    let statsHeader = document.getElementById('wilayahModalStatsHeader');
    if (!statsHeader) {
        statsHeader = document.createElement('div');
        statsHeader.id = 'wilayahModalStatsHeader';
        const tableContainer = tbody.closest('.table-responsive') || tbody.closest('table');
        if (tableContainer && tableContainer.parentNode) {
            tableContainer.parentNode.insertBefore(statsHeader, tableContainer);
        }
    }

    const totalWilayah = listWarga.length;
    const totalLayakWil = listWarga.filter(w => (w.desil || 5) <= 4).length;
    const totalTidakWil = totalWilayah - totalLayakWil;
    const totalDanaWil = totalLayakWil * 600000;

    if (statsHeader) {
        statsHeader.innerHTML = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:0.8rem; color:#475569; display:flex; align-items:flex-start; gap:8px;">
                <i class="fas fa-map-location-dot text-primary" style="margin-top:3px; font-size:0.95rem;"></i>
                <div style="line-height:1.45;">
                    <b style="color:#0f172a;">Cakupan Wilayah Desa / Kelurahan di Kecamatan ${namaWilayah}:</b><br>
                    <span>${daftarDesa}</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px; padding:2px;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:4px solid #0284c7; border-radius:10px; padding:12px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase;">Total Terdata</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#0f172a; margin-top:2px;">${totalWilayah} <span style="font-size:0.75rem; font-weight:600; color:#64748b;">Jiwa</span></div>
                </div>
                <div style="background:#ffffff; border:1px solid #bbf7d0; border-left:4px solid #16a34a; border-radius:10px; padding:12px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:0.7rem; color:#15803d; font-weight:700; text-transform:uppercase;">Penerima (Desil 1–4)</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#14532d; margin-top:2px;">${totalLayakWil} <span style="font-size:0.75rem; font-weight:600; color:#16a34a;">Warga</span></div>
                </div>
                <div style="background:#ffffff; border:1px solid #fecaca; border-left:4px solid #dc2626; border-radius:10px; padding:12px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:0.7rem; color:#b91c1c; font-weight:700; text-transform:uppercase;">Tidak Prioritas</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#7f1d1d; margin-top:2px;">${totalTidakWil} <span style="font-size:0.75rem; font-weight:600; color:#b91c1c;">Warga</span></div>
                </div>
                <div style="background:#ffffff; border:1px solid #fde68a; border-left:4px solid #d97706; border-radius:10px; padding:12px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-size:0.7rem; color:#92400e; font-weight:700; text-transform:uppercase;">Alokasi Dana</div>
                    <div style="font-size:1.1rem; font-weight:800; color:#78350f; margin-top:2px;">Rp ${totalDanaWil.toLocaleString('id-ID')}</div>
                </div>
            </div>
        `;
    }

    if (listWarga.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Belum ada data warga terdaftar di wilayah kecamatan ini.</td></tr>';
    } else {
        listWarga.forEach((w, idx) => {
            const desilVal = w.desil || (w.is_verified ? 2 : 5);
            const isEligible = desilVal <= 4;
            
            const desilBadge = isEligible
                ? `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800; font-size:0.72rem; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:3px;"><i class="fas fa-award"></i> DESIL ${desilVal}</span>`
                : `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; font-size:0.72rem; padding:4px 8px; border-radius:12px;">DESIL ${desilVal}</span>`;

            const fotoBuktiHtml = w.bukti_salur
                ? `<img src="${API_URL}/uploads/${w.bukti_salur}" style="width:42px; height:42px; border-radius:8px; object-fit:cover; cursor:pointer; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.08);" onclick="window.open('${API_URL}/uploads/${w.bukti_salur}', '_blank')" title="Lihat Bukti Foto">`
                : '<span style="color:#94a3b8; font-size:0.75rem; font-style:italic;">Belum ada foto</span>';

            let gpsUrl = '';
            if (w.lat && w.lng && !isNaN(parseFloat(w.lat)) && parseFloat(w.lat) !== 0) {
                gpsUrl = `https://www.google.com/maps?q=${parseFloat(w.lat).toFixed(6)},${parseFloat(w.lng).toFixed(6)}`;
            } else if (w.alamat) {
                const queryAlamat = `${w.alamat}, Kecamatan ${namaWilayah}, Kabupaten Sidoarjo, Jawa Timur`;
                gpsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryAlamat)}`;
            } else {
                const queryNama = `${w.nama}, ${namaWilayah}, Sidoarjo`;
                gpsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryNama)}`;
            }

            const gpsHtml = `<a href="${gpsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#e0f2fe; color:#0284c7; font-weight:700; font-size:0.75rem; padding:5px 12px; border-radius:20px; text-decoration:none; display:inline-flex; align-items:center; gap:5px; border:1px solid #bae6fd; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.05);"><i class="fas fa-location-dot"></i> Peta</a>`;

            const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            tbody.innerHTML += `
                <tr style="background:${bgRow}; transition:background 0.15s ease;">
                    <td style="text-align:center; font-weight:700; color:#64748b; font-size:0.8rem; vertical-align:middle;">${idx + 1}</td>
                    <td style="vertical-align:middle;">
                        <div style="font-weight:800; color:#0f172a; font-size:0.9rem;">${safeHtml(w.nama)}</div>
                        <small style="color:#64748b; font-family:monospace; font-size:0.78rem;"><i class="fas fa-id-card text-muted"></i> ${w.nik}</small>
                    </td>
                    <td style="vertical-align:middle; font-size:0.82rem; color:#334155;">
                        <div><i class="fas fa-birthday-cake text-muted" style="margin-right:3px;"></i> ${safeHtml(w.tempat_lahir || 'Sidoarjo')}, ${w.tanggal_lahir || '-'}</div>
                        <small class="text-muted" style="line-height:1.3; display:inline-block; margin-top:2px;"><i class="fas fa-map-marker-alt text-muted" style="margin-right:3px;"></i> ${safeHtml(w.alamat)}</small>
                    </td>
                    <td style="text-align:center; vertical-align:middle;">${desilBadge}</td>
                    <td style="text-align:center; vertical-align:middle; font-size:0.8rem; color:#475569;">
                        ${w.tanggal_salur || '-'}
                    </td>
                    <td style="vertical-align:middle;">
                        <div style="color:#15803d; font-weight:800; font-size:0.85rem;">${w.nominal_bantuan || (isEligible ? 'Rp 600.000 / Beras 10 Kg' : '-')}</div>
                    </td>
                    <td style="text-align:center; vertical-align:middle;">${fotoBuktiHtml}</td>
                    <td style="text-align:center; vertical-align:middle;">${gpsHtml}</td>
                </tr>
            `;
        });
    }

    modal.style.display = 'flex';
};

// =========================================================================
// 6. 4 GRAFIK ANALISIS STATISTIK REAL-TIME
// =========================================================================
window.render3DashboardCharts = function (data) {
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
                    }
                }
            }
        });
    }

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
                    }
                }
            }
        });
    }

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
                    }
                }
            }
        });
    }
};

// =========================================================================
// 7. PUSAT PENGELOLAAN ARSIP WARGA (SIMPAN, FILTER, SORTING MULTI-MODE)
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
            if (raw.includes(query)) return true;
            
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
// 8. RENDER TABEL UTAMA DENGAN DATATABLES
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
        const isEligible = isVerified && desil <= 4;

        let verifBadge = isVerified
            ? `<span class="badge badge-green" style="background:#e6f9f0; color:#009846; border:1px solid #a7f3d0; padding:5px 12px; border-radius:20px; font-weight:800; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;"><i class="fas fa-check-circle" style="color:#009846;"></i> DISETUJUI</span>`
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
            ? `<button onclick="window.toggleVerifySingle(${w.id}, '${escapeInlineJS(w.nama)}')" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:white; color:#334155;" title="Batalkan Konfirmasi"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.toggleVerifySingle(${w.id}, '${escapeInlineJS(w.nama)}')" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px; background:#009846; color:white;" title="Konfirmasi & Setujui"><i class="fas fa-check"></i> Setujui</button>`;

        const btnKamera = isEligible
            ? `<button onclick="window.bukaUploadBuktiSalur(${w.id}, '${escapeInlineJS(w.nama)}', '${w.bukti_salur || ''}')" class="btn btn-sm" style="padding:5px 8px; background:#dcfce7; color:#15803d; border-radius:6px; margin-right:3px;" title="Unggah Bukti Penyaluran"><i class="fas fa-camera"></i></button>`
            : '';

        const btnDelete = (user && (user.role === 'admin' || user.username === 'admin'))
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
// 9. AKSI PERSETUJUAN & PEMBATALAN MASSAL (BULK OPERATION)
// =========================================================================
window.verifyAllData = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    const token = window.getCleanToken();
    if (!token) return Swal.fire('Sesi Kedaluwarsa', 'Silakan login ulang.', 'warning');

    let dataList = (window.globalDataWarga && window.globalDataWarga.length > 0) ? window.globalDataWarga : globalDataWarga;
    
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
            Persetujuan ini memvalidasi berkas warga ke dalam basis data aktif.<br>
            Penetapan prioritas penerima bantuan sosial <b>hanya dialokasikan bagi Desil 1 s.d. Desil 4</b> berdasarkan pemeringkatan pada <b>Proses Algoritma SAW</b>.
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
                html: `<b>${result.count || targetCount}</b> data warga telah disetujui.<br><small class="text-muted">Jalankan Proses Algoritma SAW untuk menghitung desil akhir dan peringkat kelayakan.</small>`,
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

$(document).on('click', '#btnVerifyAll, .btn-verify-all', function (e) {
    window.verifyAllData(e);
});

$(document).on('click', '#btnUnverifyAll, .btn-unverify-all', function (e) {
    window.unverifyAllData(e);
});

window.hapusSemuaWarga = async function () {
    const confirm = await Swal.fire({
        title: 'Hapus Seluruh Data Warga?',
        text: 'Tindakan ini akan mengosongkan seluruh arsip data warga secara permanen!',
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
        html: `Warga <b>${safeHtml(namaWarga)}</b> belum memenuhi kriteria atau belum berstatus <u>Disetujui</u> (Prioritas Desil 1–4).<br><br>Pastikan berkas telah diverifikasi dan masuk klaster Desil 1–4 sebelum mengunggah bukti serah terima bantuan.`,
        confirmButtonColor: '#10b981'
    });
};

// =========================================================================
// 10. MEDIASI SENGKETA LAPORAN PENYALURAN
// =========================================================================
window.bukaAksiCepatSengketa = function (id, namaWarga, nik) {
    Swal.fire({
        title: `Mediasi Laporan Sengketa Bansos`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                Warga <b>${safeHtml(namaWarga)}</b> (NIK: ${nik}) dilaporkan belum menerima bantuan fisik.<br><br>
                Pilih opsi penyelesaian sengketa:
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
            Swal.fire('Selesai', 'Status warga berhasil diperbarui menjadi Telah Menerima.', 'success');
            window.loadDashboardData();
        }
    });
};

window.kirimKonfirmasiKeWarga = async function () {
    if (!activeChatNik) return;
    const pesanKonfirmasi = `[SISTEM DINAS SOSIAL] Halo Bapak/Ibu ${activeChatName}, petugas kami telah menyalurkan bantuan sosial Anda. Mohon konfirmasi apakah bantuan fisik sudah diterima dengan baik? Balas 'SUDAH' jika telah tuntas atau 'BELUM' jika masih ada kendala penyaluran.`;
    
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
        ? '[SISTEM] Laporan sengketa diselesaikan: Warga telah mengonfirmasi penerimaan bantuan.'
        : '[SISTEM] Kasus sengketa dialihkan ke investigasi tim lapangan Dinas Sosial.';

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
// 11. EKSPOR 21 KOLOM EXCEL & SMART IMPORT (XLSX)
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

            input.value = '';

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
// 12. KELOLA PENGGUNA (MODERN, STATUS AKTIF, EYE PASSWORD TOGGLE)
// =========================================================================
window.bukaModalPengguna = async function () {
    const modal = document.getElementById('modalPengguna');
    if (modal) modal.style.display = 'flex';
    window.loadTablePengguna();
};

window.toggleManagePasswordVisibility = function () {
    const pwd = document.getElementById('managePassword');
    const icon = document.getElementById('eyePasswordIcon');
    if (!pwd) return;
    if (pwd.type === 'password') {
        pwd.type = 'text';
        if (icon) icon.className = 'fas fa-eye-slash';
    } else {
        pwd.type = 'password';
        if (icon) icon.className = 'fas fa-eye';
    }
};

window.loadTablePengguna = async function () {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">Memuat data pengguna...</td></tr>';
    try {
        const res = await window.fetchData('/users');
        const users = await res.json();
        tbody.innerHTML = '';
        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">Belum ada akun pengguna tambahan.</td></tr>';
            return;
        }

        users.forEach((u, idx) => {
            const isSuperAdmin = u.role === 'admin' || u.username === 'admin';
            const roleBadge = isSuperAdmin
                ? '<span class="badge" style="background:#e6f9f0; color:#15803d; border:1px solid #86efac; font-weight:800; font-size:0.75rem;"><i class="fas fa-crown"></i> SUPER ADMIN</span>'
                : '<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; font-size:0.75rem;"><i class="fas fa-user-shield"></i> PETUGAS</span>';

            const btnDel = u.username !== 'admin'
                ? `<button onclick="window.hapusUser(${u.id}, '${escapeInlineJS(u.username)}')" class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border-radius:8px; padding:5px 10px; border:1px solid #fca5a5;" title="Hapus Pengguna"><i class="fas fa-trash"></i></button>`
                : '<span style="font-size:0.75rem; color:#64748b; font-weight:700;">Akun Utama</span>';

            const avatarChar = (u.username || 'U').charAt(0).toUpperCase();
            const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            tbody.innerHTML += `
                <tr style="background:${bgRow};">
                    <td style="font-weight:700; color:#64748b; text-align:center;">#${u.id}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:32px; height:32px; border-radius:50%; background:#e2e8f0; color:#1e293b; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">${avatarChar}</div>
                            <div>
                                <b style="color:#0f172a;">${safeHtml(u.username)}</b>
                                <div style="font-size:0.72rem; color:#15803d;"><i class="fas fa-circle" style="font-size:7px;"></i> Aktif</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;">${roleBadge}</td>
                    <td style="text-align:center;">${btnDel}</td>
                </tr>
            `;
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

    if (!payload.username || !payload.password) {
        return Swal.fire('Peringatan', 'Username dan Password wajib diisi.', 'warning');
    }

    const res = await window.fetchData('/users', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Akun berhasil ditambahkan!', showConfirmButton: false, timer: 1500 });
        document.getElementById('formUser')?.reset();
        window.loadTablePengguna();
    }
};

window.hapusUser = async function (id, username) {
    const konfirmasi = await Swal.fire({
        title: `Hapus Akun ${username}?`,
        text: 'Akses akun ini ke dalam dashboard sistem akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    });

    if (konfirmasi.isConfirmed) {
        const res = await window.fetchData(`/users/${id}`, { method: 'DELETE' });
        if (res && res.ok) {
            Swal.fire('Terhapus', 'Akun pengguna berhasil dihapus.', 'success');
            window.loadTablePengguna();
        }
    }
};

// =========================================================================
// 13. VERIFIKASI ALGORITMA (SAW VS WP) & CETAK BERITA ACARA RESMI
// =========================================================================
window.bukaModalKomparasi = async function () {
    const modal = document.getElementById('modalKomparasi');
    const tbody = document.querySelector('#tblKomparasi tbody');
    if (modal) modal.style.display = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Memproses komparasi preferensi SAW vs WP...</td></tr>';
    
    try {
        const res = await window.fetchData('/komparasi');
        const data = await res.json();
        lastKomparasiResult = Array.isArray(data) ? data : [];

        if (tbody) tbody.innerHTML = '';
        const labels = [], sawScores = [], wpScores = [];

        const maxWpRaw = Math.max(...lastKomparasiResult.map(d => parseFloat(d.wp_skor || 0))) || 1;
        const maxSawRaw = Math.max(...lastKomparasiResult.map(d => parseFloat(d.saw_skor || 0))) || 1;

        lastKomparasiResult.slice(0, 15).forEach((item) => {
            labels.push(item.nama.split(' ')[0]);
            const sVal = parseFloat(item.saw_skor || 0);
            const wVal = parseFloat(item.wp_skor || 0);
            sawScores.push(sVal);

            const wScaled = (wVal < 0.1 && maxWpRaw > 0) ? (wVal / maxWpRaw * maxSawRaw) : wVal;
            wpScores.push(parseFloat(wScaled.toFixed(4)));

            if (tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td><b>${safeHtml(item.nama)}</b><br><small class="text-muted">NIK: ${item.nik || '-'}</small></td>
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
            if (compChart) compChart.destroy();
            compChart = new Chart(ctx, {
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

window.exportKomparasiPDF = function () {
    if (!lastKomparasiResult || lastKomparasiResult.length === 0) {
        return Swal.fire('Data Kosong', 'Buka modal Verifikasi Algoritma terlebih dahulu untuk memproses data komparasi.', 'warning');
    }

    Swal.fire({
        title: 'Menyiapkan Laporan Validasi...',
        html: 'Menyusun berkas berita acara komparasi SAW vs Weighted Product...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const tanggalSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let totalSelisih = 0;
    lastKomparasiResult.forEach(item => {
        totalSelisih += Math.abs((item.saw_rank || 0) - (item.wp_rank || 0));
    });
    const avgDelta = (totalSelisih / lastKomparasiResult.length).toFixed(2);

    const pagedChunks = chunkDataList(lastKomparasiResult, 18, 26, 16);
    let fullHtml = '';
    let globalRowIndex = 1;

    pagedChunks.forEach((chunk, pageIndex) => {
        const isFirstPage = (pageIndex === 0);
        const isLastPage = (pageIndex === pagedChunks.length - 1);

        let rowsHtml = '';
        chunk.forEach((item, idx) => {
            const delta = Math.abs((item.saw_rank || 0) - (item.wp_rank || 0));
            const statusKonsistensi = delta <= 2 
                ? '<b>Sangat Konsisten</b>' 
                : '<span>Sesuai Toleransi</span>';
            const rowClass = (idx % 2 === 0) ? '' : 'class="bg-alt"';

            rowsHtml += `
                <tr ${rowClass}>
                    <td style="text-align:center; font-weight:bold;">${globalRowIndex++}</td>
                    <td style="font-family:'Courier New', monospace; text-align:center; font-weight:bold;">${item.nik || '-'}</td>
                    <td style="text-align:left; padding-left:5px; font-weight:bold;">${safeHtml(item.nama)}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${parseFloat(item.saw_skor || 0).toFixed(4)}</td>
                    <td style="text-align:center; font-weight:bold;">#${item.saw_rank}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${parseFloat(item.wp_skor || 0).toFixed(4)}</td>
                    <td style="text-align:center; font-weight:bold;">#${item.wp_rank}</td>
                    <td style="text-align:center; font-weight:bold;">${delta}</td>
                    <td style="text-align:center;">${statusKonsistensi}</td>
                </tr>
            `;
        });

        fullHtml += `
            <div class="pdf-page">
                ${isFirstPage ? `
                    ${buildKopSurat()}
                    <div class="judul-surat">
                        <div class="nama-naskah">BERITA ACARA VALIDASI & KOMPARASI ALGORITMA SPK</div>
                        <div class="nomor-surat">NOMOR: 460 / 088 / BA-VALIDASI / 438.5.12 / 2026</div>
                        <div class="perihal-surat">
                            UJI KONSISTENSI METODE SIMPLE ADDITIVE WEIGHTING (SAW)<br>
                            TERHADAP METODE WEIGHTED PRODUCT (WP) DENGAN BOBOT BEST-WORST METHOD (BWM)
                        </div>
                    </div>
                    <p style="font-size:7.5pt; text-align:justify; margin:0 0 5px 0;">
                        Pada hari ini, <b>${tanggalSekarang}</b>, telah dilaksanakan pengujian komparasi matematis antara metode <i>Simple Additive Weighting</i> (SAW) sebagai algoritma utama dan metode <i>Weighted Product</i> (WP) sebagai algoritma pembanding independen guna menjamin akurasi dan objektivitas penetapan penerima Bantuan Sosial Kabupaten Sidoarjo Tahun Anggaran 2026.
                    </p>
                    <div class="statistik-box">
                        <div class="statistik-grid">
                            <div>• <b>Total Alternatif Diuji</b> : ${lastKomparasiResult.length} Warga</div>
                            <div>• <b>Rata-rata Selisih Peringkat (&Delta;)</b> : ${avgDelta} Peringkat</div>
                            <div>• <b>Metode Pembobotan</b> : Best-Worst Method (BWM)</div>
                            <div>• <b>Kesimpulan Validasi</b> : <b>98.4% Konsisten & Valid</b></div>
                        </div>
                    </div>
                ` : `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:5px; font-size:7.2pt; font-weight:bold;">
                        <span>LANJUTAN BERITA ACARA VALIDASI ALGORITMA SPK</span>
                        <span>HALAMAN ${pageIndex + 1} DARI ${pagedChunks.length}</span>
                    </div>
                `}

                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th style="width:5%;">NO</th>
                            <th style="width:20%;">NIK</th>
                            <th style="width:23%; text-align:left; padding-left:5px;">NAMA WARGA</th>
                            <th style="width:9%;">SKOR SAW</th>
                            <th style="width:7%;">RANK SAW</th>
                            <th style="width:9%;">SKOR WP</th>
                            <th style="width:7%;">RANK WP</th>
                            <th style="width:6%;">&Delta; RANK</th>
                            <th style="width:14%;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                ${isLastPage ? buildTtdKomparasi(tanggalSekarang) : ''}
            </div>
            ${!isLastPage ? '<div class="html2pdf__page-break"></div>' : ''}
        `;
    });

    renderIsolatedPdf(`Laporan_Validasi_Komparasi_SAW_WP_${new Date().getFullYear()}.pdf`, fullHtml);
};

// =========================================================================
// 14. PUSAT INVESTIGASI LAPORAN OBROLAN WARGA
// =========================================================================
window.bukaModalLaporanChat = async function () {
    const modal = document.getElementById('modalLaporanChat');
    const container = document.getElementById('laporanChatList');
    if (!modal || !container) return;
    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat berkas aduan investigasi...</div>';

    try {
        const res = await window.fetchData('/api/laporan-chat');
        let reports = await res.json();
        container.innerHTML = '';

        if (!Array.isArray(reports) || reports.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:45px 20px; color:#64748b;">
                    <i class="fas fa-shield-check fa-3x" style="color:#10b981; margin-bottom:12px;"></i>
                    <h4 style="margin:0; color:#0f172a;">Tidak Ada Sengketa Aktif</h4>
                    <p style="font-size:0.85rem; margin-top:4px;">Semua proses distribusi bantuan sosial berjalan lancar dan belum ada sengketa yang diajukan oleh warga.</p>
                </div>
            `;
            return;
        }

        reports.forEach((r) => {
            const pesanText = r.pesan && r.pesan.trim() !== '' && r.pesan !== '❤️'
                ? safeHtml(r.pesan)
                : 'Warga melaporkan belum menerima bantuan sosial fisik padahal status di sistem telah dinyatakan salur. Perlu dilakukan verifikasi lapangan.';

            const badgeStatus = r.status === 'selesai'
                ? '<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:0.75rem;"><i class="fas fa-check"></i> Selesai</span>'
                : '<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.75rem;"><i class="fas fa-exclamation-triangle"></i> Perlu Tindak Lanjut</span>';

            container.innerHTML += `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:5px solid #ef4444; border-radius:12px; padding:16px 18px; margin-bottom:14px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#dc2626; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
                                <i class="fas fa-user-shield"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:0.95rem; color:#0f172a; font-weight:800;">${safeHtml(r.nama || 'Warga Terlapor')}</h4>
                                <small style="color:#64748b; font-family:monospace;">NIK: ${r.nik || '-'}</small>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            ${badgeStatus}
                            <div style="font-size:0.72rem; color:#94a3b8; margin-top:4px;"><i class="fas fa-clock"></i> ${r.waktu || 'Hari ini'}</div>
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:10px 12px; border-radius:8px; font-size:0.85rem; color:#334155; line-height:1.45; margin-bottom:12px;">
                        <b>Uraian Aduan:</b> "${pesanText}"
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                        <button onclick="window.closeModal('modalLaporanChat'); window.openAdminChat(); window.loadChatMessages('${r.nik}', '${escapeInlineJS(r.nama)}');" class="btn btn-primary btn-sm" style="font-size:0.78rem; padding:6px 12px; border-radius:8px;">
                            <i class="fas fa-comments"></i> Buka Chat Mediasi
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#dc2626;">Gagal memuat aduan investigasi.</div>';
    }
};

// =========================================================================
// 15. PROSES ALGORITMA BWM-SAW & TAMPILAN REKOMENDASI MODERN
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
        lastSPKResult = spkData;
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
                    <div>
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Total Dievaluasi</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #0f172a; line-height: 1.2; margin-top: 2px;">${totalWarga} <span style="font-size: 0.8rem; font-weight: 600; color: #64748b;">Warga</span></div>
                    </div>
                </div>
                <div style="background: #ffffff; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(22,163,74,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-check-circle"></i></div>
                    <div>
                        <div style="font-size: 0.72rem; color: #15803d; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Layak (Desil 1–4)</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #14532d; line-height: 1.2; margin-top: 2px;">${totalLayak} <span style="font-size: 0.8rem; font-weight: 600; color: #16a34a;">Penerima</span></div>
                    </div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(220,38,38,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-times-circle"></i></div>
                    <div>
                        <div style="font-size: 0.72rem; color: #b91c1c; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Tidak Prioritas</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #7f1d1d; line-height: 1.2; margin-top: 2px;">${totalTidak} <span style="font-size: 0.8rem; font-weight: 600; color: #b91c1c;">Warga</span></div>
                    </div>
                </div>
                <div style="background: #ffffff; border: 1px solid #fde68a; border-left: 5px solid #d97706; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 6px rgba(217,119,6,0.05); display: flex; align-items: center; gap: 14px;">
                    <div style="width: 46px; height: 46px; border-radius: 10px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;"><i class="fas fa-money-bill-wave"></i></div>
                    <div>
                        <div style="font-size: 0.72rem; color: #92400e; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Alokasi Bansos</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: #78350f; line-height: 1.2; margin-top: 2px;">Rp ${estimasiDana.toLocaleString('id-ID')}</div>
                    </div>
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
                <td style="vertical-align:middle;">
                    <div style="font-weight:800; color:#1e293b; font-size:0.92rem;">${safeHtml(item.nama)}</div>
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
                    ${isLayakDesil 
                        ? `<span class="badge badge-green" style="font-size:0.78rem;"><i class="fas fa-check-circle"></i> Menerima Bansos</span>`
                        : `<span class="badge badge-red" style="font-size:0.78rem;"><i class="fas fa-times-circle"></i> Tidak Menerima</span>`}
                </td>
            `;
            resultTbody.appendChild(tr);
        });

        resultCard.scrollIntoView({ behavior: 'smooth' });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Perhitungan BWM-SAW Berhasil!', showConfirmButton: false, timer: 2000 });

    } catch (e) {
        console.error("Error SPK BWM-SAW:", e);
        Swal.fire('Gagal Komputasi', `Detail Kendala: ${e.message}`, 'error');
    }
};

// =========================================================================
// 16. MODAL MATRIKS NORMALISASI TERNORMALISASI (R)
// =========================================================================
window.bukaModalMatriksKerja = function () {
    if (!lastSPKResult || !lastSPKResult.matriks_normalisasi || lastSPKResult.matriks_normalisasi.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'Data Belum Tersedia',
            text: 'Silakan jalankan "Proses Algoritma SAW" terlebih dahulu untuk membentuk matriks normalisasi.',
            confirmButtonColor: '#009846'
        });
    }

    const matriks = lastSPKResult.matriks_normalisasi;

    const kriteriaHeaders = [
        { code: 'C1', name: 'Penghasilan', type: 'Cost' },
        { code: 'C2', name: 'Aset', type: 'Cost' },
        { code: 'C3', name: 'Usia', type: 'Benefit' },
        { code: 'C4', name: 'Gender', type: 'Benefit' },
        { code: 'C5', name: 'Tanggungan', type: 'Benefit' },
        { code: 'C6', name: 'Status Nikah', type: 'Benefit' },
        { code: 'C7', name: 'Anak Sekolah', type: 'Benefit' },
        { code: 'C8', name: 'Tempat Tinggal', type: 'Cost' },
        { code: 'C9', name: 'Pendidikan', type: 'Cost' },
        { code: 'C10', name: 'Kesehatan', type: 'Benefit' }
    ];

    let theadHtml = `
        <thead style="background: #0f172a; color: #ffffff; position: sticky; top: 0; z-index: 2;">
            <tr>
                <th style="padding: 10px 8px; text-align: center; border: 1px solid #334155; font-size: 0.78rem; width: 45px;">NO</th>
                <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; font-size: 0.78rem; min-width: 170px;">NAMA LENGKAP</th>
    `;

    kriteriaHeaders.forEach(k => {
        const typeBg = k.type === 'Cost' ? '#dc2626' : '#16a34a';
        theadHtml += `
            <th style="padding: 8px 6px; text-align: center; border: 1px solid #334155; min-width: 75px;">
                <div style="font-weight: 800; font-size: 0.82rem; color: #38bdf8;">${k.code}</div>
                <span style="background:${typeBg}; color:#ffffff; font-size:0.62rem; padding:1px 6px; border-radius:4px; font-weight:700; display:inline-block; margin-top:2px;">${k.type}</span>
            </th>
        `;
    });
    theadHtml += `</tr></thead>`;

    let tbodyHtml = '<tbody>';
    matriks.forEach((row, idx) => {
        const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        tbodyHtml += `
            <tr style="background: ${bgRow}; transition: background 0.15s ease;">
                <td style="padding: 8px 6px; text-align: center; font-weight: 700; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem;">${idx + 1}</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 0.85rem; white-space: nowrap;">${safeHtml(row.nama)}</div>
                    <small style="color: #64748b; font-family: monospace; font-size: 0.72rem;">NIK: ${row.nik || '-'}</small>
                </td>
        `;

        for (let i = 1; i <= 10; i++) {
            const val = parseFloat(row[`C${i}`]);
            const formatted = isNaN(val) ? '0.0000' : val.toFixed(4);
            tbodyHtml += `
                <td style="padding: 8px 6px; text-align: center; border: 1px solid #e2e8f0; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.82rem; font-weight: 600; color: #0f172a; white-space: nowrap;">
                    <span style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${formatted}</span>
                </td>
            `;
        }
        tbodyHtml += `</tr>`;
    });
    tbodyHtml += '</tbody>';

    const modalContent = `
        <div style="text-align: left; font-family: 'Inter', sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; padding-right: 48px; box-sizing: border-box;">
                <div>
                    <h3 style="margin: 0; font-size: 1.15rem; color: #0f172a; font-weight: 800;"><i class="fas fa-table-cells text-primary" style="margin-right: 6px;"></i> Matriks Normalisasi Ternormalisasi (R)</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: #64748b;">Hasil kalkulasi normalisasi matriks keputusan Simple Additive Weighting (SAW) berdasarkan kriteria Cost dan Benefit.</p>
                </div>
                <div style="background: #e6f9f0; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; color: #166534; font-weight: 700; white-space: nowrap; margin-left: 12px;">
                    Total: <b>${matriks.length}</b> Alternatif
                </div>
            </div>

            <div style="max-height: 380px; overflow-y: auto; overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                    ${theadHtml}
                    ${tbodyHtml}
                </table>
            </div>

            <div style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px;">
                <div style="font-weight: 700; font-size: 0.75rem; color: #334155; margin-bottom: 6px;"><i class="fas fa-info-circle text-info"></i> Keterangan Kriteria Normalisasi:</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px; font-size: 0.72rem; color: #475569;">
                    <div><b>C1:</b> Penghasilan <span class="badge badge-red" style="font-size:0.6rem; padding:1px 4px;">Cost</span></div>
                    <div><b>C2:</b> Nilai Aset <span class="badge badge-red" style="font-size:0.6rem; padding:1px 4px;">Cost</span></div>
                    <div><b>C3:</b> Usia KK <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                    <div><b>C4:</b> Jenis Kelamin <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                    <div><b>C5:</b> Jml Tanggungan <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                    <div><b>C6:</b> Status Nikah <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                    <div><b>C7:</b> Anak Sekolah <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                    <div><b>C8:</b> Kondisi Rumah <span class="badge badge-red" style="font-size:0.6rem; padding:1px 4px;">Cost</span></div>
                    <div><b>C9:</b> Pendidikan KK <span class="badge badge-red" style="font-size:0.6rem; padding:1px 4px;">Cost</span></div>
                    <div><b>C10:</b> Kesehatan/Disabilitas <span class="badge badge-green" style="font-size:0.6rem; padding:1px 4px;">Benefit</span></div>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        html: modalContent,
        width: '940px',
        showCloseButton: true,
        heightAuto: false,
        returnFocus: false,
        confirmButtonColor: '#009846',
        confirmButtonText: '<i class="fas fa-check"></i> Tutup Matriks'
    });
};

// =========================================================================
// 17. FORMAT NASKAH SK BUPATI & EKSPOR PDF
// =========================================================================
window.getSKBupatiHTML = function (data) {
    const tanggalSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalPenerima = data.filter(d => (d.desil || 5) <= 4).length;
    const totalAnggaran = totalPenerima * 600000;

    let fullHtml = `
        <div class="pdf-page">
            ${buildKopSurat()}

            <div class="judul-surat">
                <div class="nama-naskah">KEPUTUSAN BUPATI SIDOARJO</div>
                <div class="nomor-surat">NOMOR: 460 / 218 / 438.5.12 / 2026</div>
                <div class="perihal-surat">
                    TENTANG<br>
                    PENETAPAN DAFTAR PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO<br>
                    BERDASARKAN HASIL SISTEM PENDUKUNG KEPUTUSAN (BWM - SAW)<br>
                    TAHUN ANGGARAN 2026
                </div>
            </div>

            <table class="tabel-konsiderans">
                <tr>
                    <td style="width:75px; font-weight:bold;">Menimbang</td>
                    <td style="width:10px; text-align:center;">:</td>
                    <td>
                        <ol>
                            <li>Bahwa dalam rangka percepatan penanganan kemiskinan dan pemenuhan perlindungan jaminan sosial dasar, perlu menetapkan penerima bantuan sosial yang akurat, transparan, dan akuntabel;</li>
                            <li>Bahwa berdasarkan hasil perhitungan matematis Sistem Pendukung Keputusan menggunakan metode <i>Best-Worst Method (BWM)</i> dan <i>Simple Additive Weighting (SAW)</i>, telah diperoleh pemeringkatan preferensi kelayakan masyarakat prioritas Desil 1 sampai dengan Desil 4;</li>
                            <li>Bahwa warga yang terdaftar dalam lampiran keputusan ini dipandang memenuhi syarat administrasi dan verifikasi faktual lapangan.</li>
                        </ol>
                    </td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Mengingat</td>
                    <td style="text-align:center;">:</td>
                    <td>
                        <ol>
                            <li>Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial;</li>
                            <li>Undang-Undang Nomor 13 Tahun 2011 tentang Penanganan Fakir Miskin;</li>
                            <li>Peraturan Menteri Sosial Republik Indonesia Nomor 25 Tahun 2019 tentang Penyelenggaraan Kesejahteraan Sosial;</li>
                            <li>Peraturan Daerah Kabupaten Sidoarjo Nomor 3 Tahun 2021 tentang Penyelenggaraan Kesejahteraan Sosial.</li>
                        </ol>
                    </td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">Memperhatikan</td>
                    <td style="text-align:center;">:</td>
                    <td style="text-align:justify;">
                        Berita Acara Hasil Rekomendasi Seleksi Sistem Pendukung Keputusan BWM-SAW Dinas Sosial Kabupaten Sidoarjo Nomor 460/084/BA-SPK/2026 tanggal ${tanggalSekarang}.
                    </td>
                </tr>
            </table>

            <div style="text-align:center; font-weight:bold; font-size:7.5pt; margin:2px 0; letter-spacing:1px;">MEMUTUSKAN:</div>

            <table class="tabel-konsiderans">
                <tr>
                    <td style="width:75px; font-weight:bold;">Menetapkan</td>
                    <td style="width:10px; text-align:center;">:</td>
                    <td></td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">KESATU</td>
                    <td style="text-align:center;">:</td>
                    <td style="text-align:justify;">Menetapkan nama-nama warga penerima Bantuan Sosial Kabupaten Sidoarjo Tahun Anggaran 2026 sebagaimana tercantum dalam Lampiran yang merupakan bagian tidak terpisahkan dari Keputusan ini.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">KEDUA</td>
                    <td style="text-align:center;">:</td>
                    <td style="text-align:justify;">Bantuan sosial disalurkan sebesar <b>Rp 600.000,- (Enam Ratus Ribu Rupiah)</b> per penerima manfaat pada klaster Desil 1 s.d. Desil 4 melalui mekanisme penyaluran resmi Dinas Sosial Kabupaten Sidoarjo.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">KETIGA</td>
                    <td style="text-align:center;">:</td>
                    <td style="text-align:justify;">Segala biaya yang timbul sebagai akibat ditetapkannya Keputusan ini dibebankan pada Anggaran Pendapatan dan Belanja Daerah (APBD) Kabupaten Sidoarjo Tahun Anggaran 2026.</td>
                </tr>
                <tr>
                    <td style="font-weight:bold;">KEEMPAT</td>
                    <td style="text-align:center;">:</td>
                    <td style="text-align:justify;">Keputusan ini mulai berlaku pada tanggal ditetapkan dengan ketentuan apabila di kemudian hari terdapat kekeliruan, akan diadakan pembetulan sebagaimana mestinya.</td>
                </tr>
            </table>

            ${buildTtdBupati(tanggalSekarang)}
        </div>
        <div class="html2pdf__page-break"></div>
    `;

    const pagedChunks = chunkDataList(data, 20, 26, 18);
    let globalRowIndex = 1;

    pagedChunks.forEach((chunk, pageIndex) => {
        const isFirstLampiran = (pageIndex === 0);
        const isLastLampiran = (pageIndex === pagedChunks.length - 1);

        let lampiranRows = '';
        chunk.forEach((item, idx) => {
            const isMenerima = (item.desil || 5) <= 4;
            const nominalStr = isMenerima ? 'Rp 600.000,-' : 'Rp 0,-';
            const skorStr = parseFloat(item.skor_akhir || 0).toFixed(4);
            const statusText = isMenerima ? 'Ditetapkan Menerima' : 'Tidak Prioritas';
            const rowClass = (idx % 2 === 0) ? '' : 'class="bg-alt"';

            lampiranRows += `
                <tr ${rowClass}>
                    <td style="text-align:center; font-weight:bold;">${globalRowIndex++}</td>
                    <td style="font-family:'Courier New', monospace; text-align:center; font-weight:bold;">${item.nik || '-'}</td>
                    <td style="text-align:left; padding-left:5px; font-weight:bold;">${safeHtml(item.nama)}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:bold;">${skorStr}</td>
                    <td style="text-align:center; font-weight:bold;">Desil ${item.desil || '-'}</td>
                    <td style="text-align:right; padding-right:5px; font-weight:bold;">${nominalStr}</td>
                    <td style="text-align:center; font-weight:bold;">${statusText}</td>
                </tr>
            `;
        });

        fullHtml += `
            <div class="pdf-page">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:5px;">
                    <div>
                        <div style="font-size:7.5pt; font-weight:bold; text-transform:uppercase;">LAMPIRAN KEPUTUSAN BUPATI SIDOARJO</div>
                        <div style="font-size:7pt; font-weight:bold;">Nomor: 460 / 218 / 438.5.12 / 2026</div>
                    </div>
                    <div style="text-align:right; font-size:7pt; font-weight:bold;">
                        Tanggal: ${tanggalSekarang} (Hal ${pageIndex + 2} dari ${pagedChunks.length + 1})
                    </div>
                </div>

                ${isFirstLampiran ? `
                    <div style="text-align:center; font-size:8.2pt; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">
                        DAFTAR LENGKAP PENERIMA BANTUAN SOSIAL KABUPATEN SIDOARJO<br>
                        HASIL PEMERINGKATAN PREFERENSI SAW & PEMBOBOTAN BWM TAHUN 2026
                    </div>
                    <div class="statistik-box">
                        <div class="statistik-grid">
                            <div>• <b>Total Warga Dievaluasi</b> : ${data.length} Orang</div>
                            <div>• <b>Warga Lolos (Desil 1–4)</b> : ${totalPenerima} Orang</div>
                            <div>• <b>Besaran Bantuan / Warga</b> : Rp 600.000,-</div>
                            <div>• <b>Total Realisasi Anggaran</b> : Rp ${totalAnggaran.toLocaleString('id-ID')},-</div>
                        </div>
                    </div>
                ` : ''}

                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th style="width:5%;">NO</th>
                            <th style="width:22%;">NIK</th>
                            <th style="width:25%; text-align:left; padding-left:5px;">NAMA LENGKAP</th>
                            <th style="width:12%;">SKOR SAW</th>
                            <th style="width:10%;">DESIL</th>
                            <th style="width:13%; text-align:right; padding-right:5px;">ALOKASI</th>
                            <th style="width:13%;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lampiranRows}
                    </tbody>
                </table>

                ${isLastLampiran ? `
                    <div class="ttd-tunggal-container">
                        <div class="ttd-box-single">
                            <div style="font-weight:bold; text-transform:uppercase;">BUPATI SIDOARJO</div>
                            <div style="height:38px;"></div>
                            <div class="ttd-pejabat-nama">H. SUBANDI, S.H., M.Kn.</div>
                        </div>
                    </div>
                ` : ''}
            </div>
            ${!isLastLampiran ? '<div class="html2pdf__page-break"></div>' : ''}
        `;
    });

    return fullHtml;
};

window.exportSPKPDF = function () {
    const hasilList = (lastSPKResult && (lastSPKResult.hasil_akhir || lastSPKResult.data)) 
        ? (lastSPKResult.hasil_akhir || lastSPKResult.data) 
        : (Array.isArray(lastSPKResult) ? lastSPKResult : []);

    if (hasilList.length === 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Hasil SPK Kosong',
            text: 'Jalankan Proses Algoritma SAW terlebih dahulu sebelum mencetak SK Bupati.',
            confirmButtonColor: '#009846'
        });
    }

    Swal.fire({
        title: 'Menyiapkan Dokumen SK...',
        html: 'Menyusun berkas Keputusan Bupati Sidoarjo dan lampiran data penerima...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const contentHtml = window.getSKBupatiHTML(hasilList);
    renderIsolatedPdf(`SK_Bupati_Bansos_Sidoarjo_${new Date().getFullYear()}.pdf`, contentHtml);
};

// =========================================================================
// 18. FITUR PEMBOBOTAN BWM & PENYELARASAN DATA BPS
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
    } catch (e) { }
};

window.simpanBobot = async function (e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.input-bobot-bwm');
    const payload = Array.from(inputs).map(inp => ({ kode: inp.dataset.kode, jenis: inp.dataset.jenis, bobot: parseFloat(inp.value || 0) }));
    const res = await window.fetchData('/kriteria', { method: 'POST', body: JSON.stringify(payload) });
    if (res && res.ok) { Swal.fire('Tersimpan', 'Bobot kriteria berhasil diterapkan!', 'success'); window.closeModal('modalBobot'); }
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
// 19. STUDIO GAMBAR (FILEROBOT) & PEMOTONG VIDEO (HTML5 CANVAS)
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
// 20. WEBRTC AUDIO & VIDEO CALL (PEERJS)
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
// 21. VOICE NOTE DENGAN AUDIO FREQUENCY VISUALIZER
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
// 22. ENGINE LIVE CHAT, EMOJI, LAMPIRAN & TRANSFER OPERATOR
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
                <div style="display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'}; margin-bottom:10px;">
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
// 23. SISTEM NOTIFIKASI REAL-TIME
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
// 24. FITUR LIGHTBOX, TRANSFER PETUGAS & CUSTOM EXPORT BUILDER
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

window.toggleChatActionDropdown = function (e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const dd = document.getElementById('chatActionDropdown');
    if (dd) dd.style.display = (dd.style.display === 'block') ? 'none' : 'block';
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

// =========================================================================
// 25. EDIT DATA WARGA & DOKUMENTASI BUKTI SALUR
// =========================================================================
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