/* =========================================================================
   PUBLIK.JS - PORTAL WARGA SPK BANSOS PEMKAB SIDOARJO (FULL ACTIONS)
   MENGELOLA: OTENTIKASI, DASHBOARD PRIBADI, LACAK BANSOS REAL-TIME,
              LIVE CHAT, WEBRTC DUA ARAH, DYNAMIC AUDIO WAVE VISUALIZER,
              AUDIO PREVIEW SEBELUM KIRIM, TUR INTERAKTIF, CHATBOT &
              DASHBOARD PENGADUAN LENGKAP
   Lokasi: frontend/static/js/publik.js
   ========================================================================= */

// =========================================================================
// 1. STATE & KONFIGURASI GLOBAL PORTAL WARGA
// =========================================================================
const API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:5000');

const BASE_URL = API_URL;

let wargaNik = localStorage.getItem('wargaNik') || '';
let wargaNama = localStorage.getItem('wargaNama') || '';
let wargaDataCache = null;

let sesiWargaAktif = null;
let sesiAduanAktif = null;
window.lastLacakData = null;

window.editedMediaBlob = null;
window.editedMediaExt = '';
window.editedMediaType = '';

let replyToDataWarga = null;
let lastChatHashWarga = '';
let chatIntervalWarga = null;
let aduanChatInterval = null;
let lastAduanChatHash = '';

// Voice Recording & Preview State (Ruang Warga Terdaftar)
let mediaRecorderWarga = null;
let audioChunksWarga = [];
let voiceTimerIntervalWarga = null;
let voiceSecondsWarga = 0;
let recordAudioCtxWarga = null;
let recordAnalyserWarga = null;
let recordAnimFrameWarga = null;
let tempPreviewWargaBlob = null;
let tempPreviewWargaAudio = null;
let tempPreviewWargaPCM = null;
let tempPreviewWargaAnim = null;

// Voice Recording & Preview State (Ruang Pengaduan Khusus)
let mediaRecorderAduan = null;
let audioChunksAduan = [];
let voiceTimerIntervalAduan = null;
let voiceSecondsAduan = 0;
let isVoicePausedAduan = false;
let recordAudioCtxAduan = null;
let recordAnalyserAduan = null;
let recordSourceAduan = null;
let recordAnimFrameAduan = null;
let tempPreviewAduanBlob = null;
let tempPreviewAduanAudio = null;
let tempPreviewAduanPCM = null;
let tempPreviewAduanAnim = null;

// State Playback Voice Note PCM Waveform Data
const audioWaveformDataMap = {};
const activeAudioAnimators = {};
const audioWavePhases = {};

// WebRTC Call State
let peerWarga = null;
let currentCallWarga = null;
let localStreamWarga = null;
let callTimerWarga = null;
let callSecondsWarga = 0;

// Media & Chat State (Ruang Pengaduan)
window.editedAduanMediaBlob = null;
window.editedAduanMediaExt = '';
window.editedAduanMediaType = '';
let replyToDataAduan = null;

// Peta Geotagging Mandiri
let mapGeotaggingInstance = null;
let markerGeotaggingInstance = null;

// Captcha State
let captchaAnswerPendaftaran = 0;

// Tour State
let activeTourIndex = 0;

// Injeksi CSS Dinamis untuk Animasi Tur, Popover Titik Tiga, Modal Lapor Membulat, & Voice Card
const portalStyle = document.createElement('style');
portalStyle.innerHTML = `
    .highlight-focus {
        outline: 4px solid #009846 !important;
        box-shadow: 0 0 25px rgba(0, 152, 70, 0.45) !important;
        border-radius: 20px !important;
        transition: all 0.3s ease-in-out !important;
    }
    @keyframes slideUpTourBar {
        from { opacity: 0; transform: translate(-50%, 30px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
    
    /* Popover Menu Titik Tiga Melengkung & Elegan */
    .aduan-dropdown-menu {
        position: absolute;
        top: 34px;
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 20px;
        box-shadow: 0 16px 35px rgba(15, 23, 42, 0.22);
        padding: 8px;
        min-width: 195px;
        z-index: 999999 !important;
        display: flex;
        flex-direction: column;
        gap: 3px;
        animation: fadeInDownMenu 0.18s ease-out;
    }
    @keyframes fadeInDownMenu {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .aduan-dropdown-menu.menu-right {
        right: 0;
        left: auto;
    }
    .aduan-dropdown-menu.menu-left {
        left: 0;
        right: auto;
    }
    .aduan-dropdown-menu button {
        background: none;
        border: none;
        padding: 9px 14px;
        font-size: 0.82rem;
        font-weight: 700;
        text-align: left;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.15s ease;
    }
    .aduan-dropdown-menu button:hover {
        background: #f8fafc;
        transform: translateX(2px);
    }
    .btn-msg-dots {
        background: rgba(0,0,0,0.04);
        border: none;
        color: #64748b;
        cursor: pointer;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        border-radius: 50%;
        transition: all 0.15s;
    }
    .btn-msg-dots:hover {
        color: #0f172a;
        background: rgba(0,0,0,0.1);
    }

    /* Modal Swal Serba Membulat & Modern */
    .swal2-popup.swal-rounded-popup {
        border-radius: 26px !important;
        padding: 24px 28px !important;
        border: 1.5px solid #e2e8f0 !important;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22) !important;
        font-family: 'Inter', sans-serif !important;
    }
    .swal2-popup.swal-rounded-popup .swal2-title {
        font-size: 1.3rem !important;
        font-weight: 800 !important;
        color: #0f172a !important;
        padding: 10px 0 0 0 !important;
    }
    .swal-btn-pill {
        border-radius: 25px !important;
        padding: 11px 26px !important;
        font-weight: 800 !important;
        font-size: 0.9rem !important;
        letter-spacing: 0.3px !important;
    }

    /* Dropdown Kustom Khusus Modal Pelaporan */
    .swal-custom-select-wrapper {
        position: relative;
        user-select: none;
        width: 100%;
        margin-bottom: 14px;
    }
    .swal-custom-select-trigger {
        width: 100%;
        padding: 12px 18px;
        border-radius: 18px;
        border: 1.5px solid #cbd5e1;
        font-size: 0.9rem;
        font-weight: 700;
        background: #ffffff;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #0f172a;
        transition: all 0.2s ease-in-out;
    }
    .swal-custom-select-trigger:hover {
        border-color: #dc2626;
    }
    .swal-custom-select-wrapper.open .swal-custom-select-trigger {
        border-color: #dc2626;
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.12);
    }
    .swal-chevron {
        font-size: 0.8rem;
        color: #64748b;
        transition: transform 0.25s ease;
    }
    .swal-custom-select-wrapper.open .swal-chevron {
        transform: rotate(180deg);
        color: #dc2626;
    }
    .swal-custom-select-options {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 20px;
        box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
        display: none;
        z-index: 999999;
        padding: 8px;
        animation: fadeInDownMenu 0.18s ease-out;
    }
    .swal-custom-select-wrapper.open .swal-custom-select-options {
        display: block;
    }
    .swal-custom-option {
        padding: 11px 16px;
        font-size: 0.88rem;
        font-weight: 700;
        color: #334155;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-bottom: 3px;
        display: flex;
        align-items: center;
    }
    .swal-custom-option:hover {
        background: #fee2e2;
        color: #dc2626;
    }
    .swal-custom-option.selected {
        background: #dc2626;
        color: #ffffff !important;
    }
    .swal-custom-option.selected i {
        color: #ffffff !important;
    }

    /* Pemutar Audio Modern dengan Wave Visualizer Interaktif & Pengatur Kecepatan */
    .modern-voice-card {
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 20px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        max-width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        margin: 4px 0 6px 0;
    }
    .audio-play-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #009846;
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1rem;
        flex-shrink: 0;
        transition: transform 0.15s, background 0.15s;
    }
    .audio-play-btn:hover {
        background: #007a37;
        transform: scale(1.06);
    }
    .voice-track-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    .voice-info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: #475569;
    }
    .voice-title {
        color: #009846;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .voice-seek-wrapper {
        position: relative;
        width: 100%;
        height: 26px;
        display: flex;
        align-items: center;
    }
    .voice-wave-canvas {
        width: 100%;
        height: 26px;
        display: block;
        pointer-events: none;
    }
    .voice-seek-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        margin: 0;
        z-index: 5;
    }
    .audio-speed-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        padding: 4px 9px;
        font-size: 0.75rem;
        font-weight: 800;
        color: #334155;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.15s;
    }
    .audio-speed-btn:hover {
        background: #e2e8f0;
        color: #009846;
    }
`;
document.head.appendChild(portalStyle);

// =========================================================================
// 2. HELPER SANITASI & ENCODING
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

function enc(str) {
    return encodeURIComponent(str || '');
}

function formatAudioTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showPortalAlert(options) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire(options);
    }
    alert(options.text || options.title || 'Pemberitahuan');
    return Promise.resolve({ isConfirmed: true, value: true });
}

// =========================================================================
// 3. NAVIGASI TAB PORTAL & SINKRONISASI VIEW
// =========================================================================
window.switchTabPublik = window.switchTab = function (targetSectionId, btnEl) {
    const landingView = document.getElementById('landingView') || document.querySelector('.container-public');
    const shell = document.getElementById('portalTabsShell') || document.querySelector('.card-portal-shell');
    const tabsBar = document.getElementById('portalTabsBar');
    const dashboardView = document.getElementById('dashboardWargaSection');
    const aduanView = document.getElementById('sectionDashboardPengaduan');
    const chatbotBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');

    if (landingView) {
        landingView.style.display = 'block';
        landingView.style.opacity = '1';
        landingView.style.visibility = 'visible';
    }

    if (targetSectionId === 'dashboardWargaSection') {
        if (shell && dashboardView && shell.contains(dashboardView)) {
            shell.style.display = 'block';
            if (tabsBar) tabsBar.style.display = 'none';
            ['loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (shell) {
            shell.style.display = 'none';
        }

        if (aduanView) aduanView.style.display = 'none';
        if (dashboardView) {
            dashboardView.style.display = 'block';
            dashboardView.style.opacity = '1';
            dashboardView.style.visibility = 'visible';
            dashboardView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    if (targetSectionId === 'sectionDashboardPengaduan') {
        if (shell && aduanView && shell.contains(aduanView)) {
            shell.style.display = 'block';
            if (tabsBar) tabsBar.style.display = 'none';
            ['loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        } else if (shell) {
            shell.style.display = 'none';
        }

        if (dashboardView) dashboardView.style.display = 'none';
        if (aduanView) {
            aduanView.style.display = 'block';
            aduanView.style.opacity = '1';
            aduanView.style.visibility = 'visible';
            aduanView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (chatbotBtn) chatbotBtn.style.display = 'none';
        return;
    }

    if (shell) shell.style.display = 'block';
    if (tabsBar) tabsBar.style.display = 'grid';
    if (dashboardView) dashboardView.style.display = 'none';
    if (aduanView) aduanView.style.display = 'none';
    if (chatbotBtn) chatbotBtn.style.display = 'flex';

    document.querySelectorAll('.tab-btn-portal, .tab-btn').forEach(b => b.classList.remove('active'));
    const allSections = [
        'loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'pantauAduanSection', 'bantuanSection',
        'panelMasukDashboard', 'panelCekStatus', 'panelDaftarMandiri', 'panelPantauAduan', 'panelFAQ'
    ];
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    const mapIds = {
        'loginWargaSection': ['loginWargaSection', 'panelMasukDashboard'],
        'panelMasukDashboard': ['loginWargaSection', 'panelMasukDashboard'],
        'cekStatusSection': ['cekStatusSection', 'panelCekStatus'],
        'panelCekStatus': ['cekStatusSection', 'panelCekStatus'],
        'daftarMandiriSection': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'panelDaftarMandiri': ['daftarMandiriSection', 'panelDaftarMandiri'],
        'pantauAduanSection': ['pantauAduanSection', 'panelPantauAduan'],
        'panelPantauAduan': ['pantauAduanSection', 'panelPantauAduan'],
        'bantuanSection': ['bantuanSection', 'panelFAQ'],
        'panelFAQ': ['bantuanSection', 'panelFAQ']
    };

    const targets = mapIds[targetSectionId] || [targetSectionId];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'block';
            el.classList.add('active');
        }
    });

    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const mapBtn = {
            'loginWargaSection': ['btn-login', 'tabBtnMasuk'],
            'panelMasukDashboard': ['btn-login', 'tabBtnMasuk'],
            'cekStatusSection': ['btn-cek', 'tabBtnCek'],
            'panelCekStatus': ['btn-cek', 'tabBtnCek'],
            'daftarMandiriSection': ['btn-daftar', 'tabBtnDaftar'],
            'panelDaftarMandiri': ['btn-daftar', 'tabBtnDaftar'],
            'pantauAduanSection': ['btn-aduan', 'tabBtnAduan'],
            'panelPantauAduan': ['btn-aduan', 'tabBtnAduan'],
            'bantuanSection': ['btn-panduan', 'tabBtnFAQ'],
            'panelFAQ': ['btn-panduan', 'tabBtnFAQ']
        };
        const btnKeys = mapBtn[targetSectionId] || [];
        btnKeys.forEach(bk => {
            const b = document.getElementById(bk);
            if (b) b.classList.add('active');
        });
    }

    if (targetSectionId === 'daftarMandiriSection' || targetSectionId === 'panelDaftarMandiri') {
        setTimeout(() => {
            if (typeof initGeotaggingMap === 'function') initGeotaggingMap();
        }, 250);
    }
};

window.gantiTabPortal = function (tab) {
    const map = {
        'masuk': 'loginWargaSection',
        'cek': 'cekStatusSection',
        'daftar': 'daftarMandiriSection',
        'aduan': 'pantauAduanSection',
        'faq': 'bantuanSection'
    };
    window.switchTabPublik(map[tab] || tab);
};

window.toggleFaqCard = function (cardEl) {
    if (!cardEl) return;
    const body = cardEl.querySelector('.faq-card-body');
    const isOpen = cardEl.classList.contains('open');

    document.querySelectorAll('.faq-modern-card').forEach(c => {
        c.classList.remove('open');
        const b = c.querySelector('.faq-card-body');
        if (b) b.style.display = 'none';
    });

    if (!isOpen && body) {
        cardEl.classList.add('open');
        body.style.display = 'block';
    }
};

// =========================================================================
// 4. INISIALISASI HALAMAN & EVENT LISTENER
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedNik = localStorage.getItem('wargaNik');
    const savedNama = localStorage.getItem('wargaNama');

    if (savedNik && savedNama) {
        wargaNik = savedNik;
        wargaNama = savedNama;
        sesiWargaAktif = { nik: savedNik, nama_lengkap: savedNama };
        window.switchTabPublik('dashboardWargaSection');
        window.loadDashboardWarga();
    } else {
        window.switchTabPublik('loginWargaSection');
    }

    const wFile = document.getElementById('wargaChatFile');
    if (wFile) {
        wFile.addEventListener('change', function () {
            window.handleWargaFileSelected(this);
        });
    }

    window.acakCaptchaPendaftaran();
    if (typeof cekResumeAduanLokal === 'function') cekResumeAduanLokal();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="aduan-menu-"]') && !e.target.closest('.btn-msg-dots')) {
        document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    }
    if (!e.target.closest('[id^="menu-warga-"]') && !e.target.closest('.btn-msg-dots')) {
        document.querySelectorAll('[id^="menu-warga-"]').forEach(m => m.style.display = 'none');
    }
    const emojiPicker = document.getElementById('emojiPickerWarga');
    if (emojiPicker && !e.target.closest('#emojiPickerWarga') && !e.target.closest('.emoji-toggle-btn')) {
        emojiPicker.style.display = 'none';
    }
    const emojiPickerAduan = document.getElementById('emojiPickerAduan');
    if (emojiPickerAduan && !e.target.closest('#emojiPickerAduan') && !e.target.closest('.emoji-toggle-btn')) {
        emojiPickerAduan.style.display = 'none';
    }
    const laporWrapper = document.getElementById('swalLaporSelectWrapper');
    if (laporWrapper && laporWrapper.classList.contains('open') && !laporWrapper.contains(e.target)) {
        laporWrapper.classList.remove('open');
    }
});

// =========================================================================
// 5. LOGIN DASHBOARD WARGA TERDAFTAR
// =========================================================================
window.masukKePortal = function (nik, nama, email = '') {
    localStorage.setItem('wargaNik', nik);
    localStorage.setItem('wargaNama', nama);
    wargaNik = nik;
    wargaNama = nama;
    sesiWargaAktif = { nik, nama_lengkap: nama, email_login: email };
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

window.loginWarga = window.prosesMasukDashboard = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = document.getElementById('loginNik')?.value.trim();
    const nama = document.getElementById('loginNama')?.value.trim();
    const email = document.getElementById('loginEmail')?.value.trim() || '';

    if (!nik || !nama) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Format NIK Salah', text: 'NIK wajib terdiri dari 16 digit angka.' });
    }

    showPortalAlert({ title: 'Memeriksa Akses...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok && json.data) {
            const w = json.data;
            const dbNama = (w.nama_lengkap || w.nama || '').toLowerCase();
            const inputNama = nama.toLowerCase();

            if (dbNama.includes(inputNama) || inputNama.includes(dbNama)) {
                sesiWargaAktif = { ...w, email_login: email };
                window.masukKePortal(w.nik, w.nama_lengkap || w.nama, email);
                showPortalAlert({ 
                    icon: 'success', 
                    title: 'Selamat Datang!', 
                    text: `Akses berhasil dibuka untuk ${w.nama_lengkap || w.nama}.`, 
                    timer: 1400, 
                    showConfirmButton: false 
                });
            } else {
                showPortalAlert({ 
                    icon: 'error', 
                    title: 'Data Tidak Cocok', 
                    text: 'Nama lengkap yang dimasukkan tidak cocok dengan NIK terdaftar di sistem.' 
                });
            }
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Belum Terdaftar',
                text: json.message || 'NIK Anda belum terdaftar dalam pangkalan data penetapan bantuan sosial.',
                showCancelButton: true,
                confirmButtonText: 'Daftar Mandiri Sekarang',
                cancelButtonText: 'Buka Dashboard Pengaduan',
                confirmButtonColor: '#009846',
                cancelButtonColor: '#dc2626'
            }).then(r => {
                if (r.isConfirmed) {
                    window.switchTabPublik('daftarMandiriSection');
                    if (document.getElementById('regNik')) document.getElementById('regNik').value = nik;
                    if (document.getElementById('regNama')) document.getElementById('regNama').value = nama;
                    if (document.getElementById('regEmail')) document.getElementById('regEmail').value = email;
                } else if (r.dismiss === Swal.DismissReason.cancel) {
                    window.masukDashboardPengaduan(nik, nama, 'Kendala Akses: Belum Terdaftar di Basis Data Penetapan Bansos');
                }
            });
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ 
            icon: 'error', 
            title: 'Koneksi Peladen Terputus', 
            html: '<p style="font-size:0.9rem;">Gagal menghubungi backend di <b>http://127.0.0.1:5000</b>.<br>Pastikan backend Flask (<code>python app.py</code>) dan servis <b>MySQL</b> telah dijalankan.</p>' 
        });
    }
};

window.logoutWarga = function () {
    if (chatIntervalWarga) {
        clearInterval(chatIntervalWarga);
        chatIntervalWarga = null;
    }
    if (currentCallWarga) {
        window.endCallWarga();
    }
    localStorage.removeItem('wargaNik');
    localStorage.removeItem('wargaNama');
    wargaNik = '';
    wargaNama = '';
    wargaDataCache = null;
    sesiWargaAktif = null;
    window.location.reload();
};

// =========================================================================
// 6. LACAK STATUS BANSOS REAL-TIME
// =========================================================================
window.cekStatusAwal = window.prosesLacakBansos = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = (document.getElementById('cekNik') || document.getElementById('lacakNik'))?.value.trim();

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit NIK.' });
    }

    showPortalAlert({ title: 'Melacak Status Bansos...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        const pInput = document.getElementById('panelInputLacak') || document.getElementById('panel-input-nik');
        const pHasil = document.getElementById('panel-hasil-cek') || document.getElementById('wadahHasilLacak');
        const kartu = document.getElementById('kartuStatus') || document.getElementById('wadahHasilLacak');

        if (!res.ok || !json.data) {
            if (pHasil) pHasil.style.display = 'none';
            return showPortalAlert({ icon: 'info', title: 'Tidak Ditemukan', text: json.message || 'Data NIK tidak ditemukan dalam pangkalan data penetapan bansos.' });
        }

        const d = json.data;
        window.lastLacakData = d;
        const desil = parseInt(d.desil || '5', 10);
        const isLayak = desil <= 4;
        const badgeBg = isLayak ? '#e6f9f0' : '#fef3c7';
        const badgeCol = isLayak ? '#15803d' : '#b45309';

        const resultHtml = `
            <div class="result-box-complete" style="border:1.5px solid #cbd5e1; border-radius:18px; overflow:hidden; background:#ffffff; box-shadow:0 6px 25px rgba(0,0,0,0.06); width:100%;">
                <div style="background:#f8fafc; padding:16px 24px; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:800; font-size:1rem; color:#0f172a;"><i class="fas fa-id-badge" style="color:#009846;"></i> Rincian Penerima Manfaat Terdaftar</span>
                    <span style="background:${badgeBg}; color:${badgeCol}; padding:5px 14px; border-radius:20px; font-weight:800; font-size:0.82rem;">
                        ${isLayak ? '<i class="fas fa-check-circle"></i> LAYAK MENERIMA' : '<i class="fas fa-info-circle"></i> TIDAK DIPRIORITASKAN'}
                    </span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:24px; font-size:0.92rem;">
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">NAMA LENGKAP</small>
                        <span style="font-weight:800; color:#0f172a;">${safeHtml(d.nama_lengkap || d.nama || '-')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">NOMOR INDUK KEPENDUDUKAN (NIK)</small>
                        <span class="font-mono" style="font-weight:800; color:#0f172a;">${safeHtml(d.nik)}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">ALAMAT LENGKAP TERDAFTAR</small>
                        <span style="font-weight:700; color:#334155;">${safeHtml(d.alamat || 'Kabupaten Sidoarjo')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">ALAMAT EMAIL</small>
                        <span style="font-weight:700; color:#334155;">${safeHtml(d.email || '-')}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">KLASIFIKASI DESIL KELAYAKAN</small>
                        <span style="font-weight:800; color:#0284c7;"><i class="fas fa-layer-group"></i> Desil ${desil} (${d.prioritas || (isLayak ? 'Prioritas Bansos' : 'Ekonomi Cukup')})</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
                        <small style="display:block; color:#64748b; font-size:0.75rem; font-weight:700; margin-bottom:3px;">KEPUTUSAN BANTUAN SOSIAL</small>
                        <span style="font-weight:800; color:${isLayak ? '#059669' : '#dc2626'};">${d.status_bansos}</span>
                    </div>
                    <div style="grid-column: span 2; background:#f0fdf4; padding:14px 18px; border-radius:12px; border:1px solid #bbf7d0;">
                        <small style="display:block; color:#166534; font-size:0.75rem; font-weight:700; margin-bottom:3px;">STATUS PENYALURAN FISIK LAPANGAN</small>
                        <span style="font-weight:800; color:#15803d; font-size:1rem;"><i class="fas fa-truck"></i> ${d.status_salur || 'Pending'} — (${d.nominal_bantuan || 'BLT Rp 300.000'})</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:20px; justify-content:center;">
                <button type="button" onclick="window.resetCekStatus()" class="btn btn-secondary" style="padding:12px 24px; border-radius:30px; font-weight:700; cursor:pointer; background:#f1f5f9; border:1px solid #cbd5e1; color:#475569;">
                    <i class="fas fa-arrow-left"></i> Cek NIK Lain
                </button>
                <button type="button" onclick="window.lanjutKeDashboardDariCek()" class="btn btn-primary" style="padding:12px 24px; border-radius:30px; font-weight:800; cursor:pointer; background:#009846; border:none; color:white; box-shadow:0 4px 12px rgba(0,152,70,0.25);">
                    <i class="fas fa-sign-in-alt"></i> Lanjut ke Dashboard Pribadi
                </button>
            </div>
        `;

        if (kartu) kartu.innerHTML = resultHtml;
        if (pInput) pInput.style.display = 'none';
        if (pHasil) pHasil.style.display = 'block';
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Error', text: 'Gagal memuat informasi status warga.' });
    }
};

window.resetCekStatus = function () {
    const pHasil = document.getElementById('panel-hasil-cek') || document.getElementById('wadahHasilLacak');
    const pInput = document.getElementById('panelInputLacak') || document.getElementById('panel-input-nik');
    const input = document.getElementById('cekNik') || document.getElementById('lacakNik');

    if (pHasil) pHasil.style.display = 'none';
    if (pInput) pInput.style.display = 'block';
    if (input) {
        input.value = '';
        input.focus();
    }
};

window.lanjutKeDashboardDariCek = function () {
    if (window.lastLacakData) {
        const d = window.lastLacakData;
        const nikInp = document.getElementById('loginNik');
        const namaInp = document.getElementById('loginNama');
        const emailInp = document.getElementById('loginEmail');

        if (nikInp) nikInp.value = d.nik || '';
        if (namaInp) namaInp.value = d.nama_lengkap || d.nama || '';
        if (emailInp) emailInp.value = (d.email && d.email !== '-') ? d.email : 'warga@gmail.com';
    }
    window.switchTabPublik('loginWargaSection');
    const target = document.getElementById('panelMasukDashboard') || document.getElementById('loginWargaSection');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// =========================================================================
// 7. DASHBOARD PRIBADI WARGA TERDAFTAR (MONITORING & CHAT)
// =========================================================================
window.bukaDashboardWargaTerdaftar = function () {
    if (!sesiWargaAktif) return;
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

window.loadDashboardWarga = async function () {
    const activeNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!activeNik) return;

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(activeNik)}`);
        const json = await res.json().catch(() => ({}));

        if (json.data) {
            const w = json.data;
            wargaDataCache = w;

            const elNama = document.getElementById('wNama') || document.getElementById('dashWargaNama');
            const elNik = document.getElementById('wNik') || document.getElementById('dashWargaNik');
            const elAlamat = document.getElementById('wAlamat') || document.getElementById('dashWargaAlamat');
            const elStatus = document.getElementById('wStatus') || document.getElementById('dashWargaStatusBansos');
            const elDesil = document.getElementById('dashWargaDesilBadge') || document.getElementById('wDesil');
            const elSalur = document.getElementById('dashWargaStatusSalur');

            if (elNama) elNama.innerText = w.nama_lengkap || w.nama || wargaNama;
            if (elNik) elNik.innerText = w.nik || activeNik;
            if (elAlamat) elAlamat.innerText = w.alamat || 'Kabupaten Sidoarjo';
            if (elStatus) elStatus.innerText = w.status_bansos || 'Diproses';
            if (elDesil && w.desil) elDesil.innerText = `Desil ${w.desil}`;
            if (elSalur) elSalur.innerText = `${w.status_salur || 'Pending'} (${w.nominal_bantuan || 'BLT Rp 300.000'})`;

            let progressHtml = '';
            const statusSalur = w.status_salur || 'Pending';

            if (statusSalur === 'Menunggu Konfirmasi Warga') {
                progressHtml = `
                    <div style="background:#fffbeb; border:1px solid #fcd34d; padding:15px; border-radius:12px; margin-top:10px;">
                        <b style="color:#b45309;"><i class="fas fa-check-double"></i> Konfirmasi Penerimaan Fisik:</b>
                        <p style="font-size:0.9rem; color:#475569; margin:8px 0;">Pihak Dinas Sosial menyatakan bantuan Anda telah disalurkan. Apakah Anda sudah menerima bantuan fisik tersebut?</p>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.konfirmasiLaporSelesaiWarga()" class="btn btn-primary" style="font-size:0.85rem; padding:8px 14px;"><i class="fas fa-check-circle"></i> Ya, Sudah Diterima</button>
                            <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 14px; color:#ef4444; border-color:#ef4444;"><i class="fas fa-times"></i> Belum Diterima</button>
                        </div>
                    </div>
                `;
            } else if (statusSalur.includes('Sengketa')) {
                progressHtml = `
                    <div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#dc2626; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Laporan Sengketa Sedang Diinvestigasi</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Petugas Dinsos sedang meninjau sanggahan Anda. Silakan hubungi petugas via Live Chat di samping.</p>
                    </div>
                `;
            } else if (statusSalur === 'Telah Menerima' || statusSalur === 'Selesai') {
                progressHtml = `
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#059669; font-weight:bold;"><i class="fas fa-check-circle"></i> Bantuan Sosial Selesai Disalurkan</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Bantuan fisik tervalidasi telah diserahterimakan kepada keluarga bersangkutan.</p>
                    </div>
                `;
            } else if (w.desil <= 4 || w.status_bansos === 'Menerima Bansos') {
                progressHtml = `
                    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="font-size:0.88rem; padding:9px 16px;"><i class="fas fa-check"></i> Konfirmasi Sudah Terima</button>
                        <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border-color:#ef4444; color:#ef4444; font-size:0.88rem; padding:9px 16px;"><i class="fas fa-exclamation-circle"></i> Belum Menerima Bantuan</button>
                    </div>
                `;
            }

            const actCont = document.getElementById('actionContainer');
            if (actCont) actCont.innerHTML = progressHtml;

            window.loadChatMessagesWarga(true);
            if (!chatIntervalWarga) {
                chatIntervalWarga = setInterval(() => {
                    window.loadChatMessagesWarga(true);
                }, 3500);
            }
        }
    } catch (err) {
        console.error('[Dashboard Error]', err);
    }
};

window.konfirmasiTerimaBansos = function () {
    showPortalAlert({
        title: 'Konfirmasi Penerimaan',
        text: 'Apakah Anda yakin telah menerima paket bantuan sosial dari petugas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Sudah Terima',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/konfirmasi-terima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Terima Kasih', text: 'Konfirmasi penerimaan bantuan berhasil dicatat.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan jaringan saat konfirmasi.' });
            }
        }
    });
};

window.laporBansosBelumDiterima = function () {
    showPortalAlert({
        title: 'Laporkan Kendala Penyaluran',
        text: 'Nama Anda tercatat sebagai penerima namun belum menerima bantuan fisik?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Buat Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/publik/pengaduan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: wargaNik,
                        nama_pelapor: wargaNama,
                        kategori: 'Bansos Belum Diterima',
                        isi_laporan: 'Warga melapor belum menerima alokasi bantuan sosial di lapangan.'
                    })
                }).catch(() => null);

                showPortalAlert({ icon: 'info', title: 'Laporan Diterima', text: 'Sanggahan Anda telah diteruskan ke meja investigasi Dinas Sosial.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal mengirimkan laporan sengketa.' });
            }
        }
    });
};

window.konfirmasiLaporSelesaiWarga = function () {
    showPortalAlert({
        title: 'Konfirmasi Akhir',
        text: 'Apakah bantuan sosial sudah Anda terima secara lengkap?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Selesaikan Laporan',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/lapor-selesai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Selesai', text: 'Kasus pengaduan telah ditutup secara sukses.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui status pengaduan.' });
            }
        }
    });
};

// =========================================================================
// 8. STATE, RESUME & PANTAU PENGADUAN MANDIRI (TANPA LAPOR ULANG)
// =========================================================================
function cekResumeAduanLokal() {
    const lastNik = localStorage.getItem('lastAduanNik');
    const lastNama = localStorage.getItem('lastAduanNama');
    const cardResume = document.getElementById('cardResumeAduanCepat');
    if (lastNik && lastNama && cardResume) {
        const rNama = document.getElementById('resumeAduanNama');
        const rNik = document.getElementById('resumeAduanNik');
        if (rNama) rNama.innerText = lastNama;
        if (rNik) rNik.innerText = lastNik;
        cardResume.style.display = 'block';
    }
}

window.bukaAduanTersimpan = function () {
    const lastNik = localStorage.getItem('lastAduanNik');
    if (lastNik) {
        const inp = document.getElementById('inputNikPantauAduan');
        if (inp) inp.value = lastNik;
        window.lacakAduanWarga();
    }
};

window.lacakAduanWarga = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = document.getElementById('inputNikPantauAduan')?.value.trim();

    if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'Masukkan tepat 16 digit NIK pelapor.' });
    }

    showPortalAlert({ title: 'Mencari Berkas Aduan...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        const res = await fetch(`${API_URL}/api/publik/cek-aduan?nik=${encodeURIComponent(nik)}`);
        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok && json.data) {
            const d = json.data;
            window.masukDashboardPengaduan(d.nik, d.nama, d.uraian, false);
            showPortalAlert({ icon: 'success', title: 'Aduan Ditemukan', text: `Selamat datang kembali, ${d.nama}.`, timer: 1200, showConfirmButton: false });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Belum Ada Aduan',
                text: 'NIK ini belum memiliki riwayat pengaduan. Ingin membuat aduan baru?',
                showCancelButton: true,
                confirmButtonText: 'Buat Aduan via Asisten Bot',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#dc2626'
            }).then(r => {
                if (r.isConfirmed) {
                    window.botBukaFormLapor();
                }
            });
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ icon: 'error', title: 'Gangguan Jaringan', text: 'Gagal menghubungi server basis data.' });
    }
};

window.masukDashboardPengaduan = function (nik, nama, uraian, isNewReport = false) {
    sesiAduanAktif = { nik, nama, uraian };
    localStorage.setItem('lastAduanNik', nik);
    localStorage.setItem('lastAduanNama', nama);

    window.switchTabPublik('sectionDashboardPengaduan');

    const dispNama = document.getElementById('aduanNamaDisplay');
    const dispNik = document.getElementById('aduanNikDisplay');
    const dispUraian = document.getElementById('aduanUraianDisplay');

    if (dispNama) dispNama.innerText = nama;
    if (dispNik) dispNik.innerText = nik;
    if (dispUraian) dispUraian.innerText = uraian;

    window.initPeerWarga();

    if (isNewReport) {
        fetch(`${API_URL}/api/publik/pengaduan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nik: nik,
                nama_pelapor: nama,
                kategori: 'Aduan Belum Terdaftar',
                isi_laporan: uraian
            })
        }).catch(() => {});
    }

    lastAduanChatHash = '';
    window.sinkronStatusStepperAduan();
    window.muatPesanAduan(true);

    if (!aduanChatInterval) {
        aduanChatInterval = setInterval(() => {
            window.muatPesanAduan(false);
            window.sinkronStatusStepperAduan();
        }, 3500);
    }
};

window.keluarDashboardPengaduan = function () {
    if (aduanChatInterval) {
        clearInterval(aduanChatInterval);
        aduanChatInterval = null;
    }
    sesiAduanAktif = null;
    window.switchTabPublik('pantauAduanSection');
};

// =========================================================================
// SINKRONISASI STEPPER ADUAN (STEP 4 HIJAU DENGAN CENTANG GANDA)
// =========================================================================
window.sinkronStatusStepperAduan = async function () {
    if (!sesiAduanAktif) return;
    try {
        const res = await fetch(`${API_URL}/api/publik/cek-aduan?nik=${encodeURIComponent(sesiAduanAktif.nik)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
            const d = json.data;
            const step = parseInt(d.status_step || 2, 10);
            
            const badge = document.getElementById('aduanStatusTextBadge');
            if (badge) {
                badge.innerText = d.status_text || 'Ditinjau Petugas';
                badge.style.background = (step === 4) ? '#e6f9f0' : '#fee2e2';
                badge.style.color = (step === 4) ? '#009846' : '#dc2626';
            }
            
            const catatan = document.getElementById('aduanCatatanPetugasDisplay');
            if (catatan) catatan.innerText = d.catatan_petugas || 'Petugas sedang meninjau berkas Anda.';

            for (let i = 1; i <= 4; i++) {
                const node = document.getElementById(`stepNode${i}`);
                const circle = document.getElementById(`stepCircle${i}`) || node?.querySelector('.step-circle');
                if (!node || !circle) continue;

                node.classList.remove('done', 'active');

                if (step === 4) {
                    node.classList.add('done');
                    circle.style.background = '#009846';
                    circle.style.boxShadow = '0 0 14px rgba(0, 152, 70, 0.4)';
                    circle.innerHTML = (i === 4) ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>';
                } else if (i < step) {
                    node.classList.add('done');
                    circle.style.background = '#009846';
                    circle.style.boxShadow = 'none';
                    circle.innerHTML = '<i class="fas fa-check"></i>';
                } else if (i === step) {
                    node.classList.add('active');
                    circle.style.background = '#dc2626';
                    circle.style.boxShadow = '0 0 14px rgba(220, 38, 38, 0.45)';
                    circle.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
                } else {
                    circle.style.background = '#cbd5e1';
                    circle.style.boxShadow = 'none';
                    circle.innerText = i;
                }
            }
        }
    } catch (e) {}
};

// =========================================================================
// VOICE RECORDER & PRATINJAU DENGAN DYNAMIC LIVE AUDIO VISUALIZER (PENGADUAN)
// =========================================================================
function drawLiveRecordWaveAduan() {
    const canvas = document.getElementById('aduanRecordWaveCanvas');
    if (!canvas || !recordAnalyserAduan) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    const bufferLength = recordAnalyserAduan.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserAduan.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += Math.abs(val);
    }
    const avgVolume = sum / bufferLength;

    ctx.clearRect(0, 0, width, height);

    if (isVoicePausedAduan || avgVolume < 0.015) {
        // BATANG LURUS DATAR (KETIKA DIAM / TIDAK ADA DESIBEL SUARA NYATA)
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fca5a5';
        ctx.lineCap = 'round';
        ctx.stroke();
    } else {
        // GELOMBANG LIUK DINAMIS (SAAT DESIBEL SUARA TERDETEKSI)
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#e11d48';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    recordAnimFrameAduan = requestAnimationFrame(drawLiveRecordWaveAduan);
}

window.toggleVoiceRecordAduan = async function () {
    const ui = document.getElementById('aduanRecordingUI');
    const btnRecord = document.getElementById('btnRecordAduan');

    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksAduan = [];
        isVoicePausedAduan = false;
        mediaRecorderAduan = new MediaRecorder(stream);

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxAduan = new AudioCtx();
            recordAnalyserAduan = recordAudioCtxAduan.createAnalyser();
            recordAnalyserAduan.fftSize = 256;
            recordSourceAduan = recordAudioCtxAduan.createMediaStreamSource(stream);
            recordSourceAduan.connect(recordAnalyserAduan);
        } catch (e) {
            console.warn('[AudioContext Mic Warning]', e);
        }

        mediaRecorderAduan.ondataavailable = e => {
            if (e.data.size > 0) audioChunksAduan.push(e.data);
        };

        mediaRecorderAduan.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (recordAnimFrameAduan) cancelAnimationFrame(recordAnimFrameAduan);
            if (recordAudioCtxAduan && recordAudioCtxAduan.state !== 'closed') {
                recordAudioCtxAduan.close().catch(() => {});
            }
            if (audioChunksAduan.length > 0) {
                tempPreviewAduanBlob = new Blob(audioChunksAduan, { type: 'audio/webm' });
                window.renderPreviewVoiceAduan(tempPreviewAduanBlob);
            }
        };

        mediaRecorderAduan.start();
        voiceSecondsAduan = 0;
        if (ui) {
            ui.style.display = 'flex';
            ui.innerHTML = `
                <span id="aduanRecordTime" style="font-weight:800; font-family:monospace; color:#e11d48; font-size:0.85rem;">00:00</span>
                <canvas id="aduanRecordWaveCanvas" width="160" height="24" style="flex:1; height:24px; display:block;"></canvas>
                <button type="button" onclick="window.pauseResumeVoiceRecordAduan()" id="btnPauseVoiceAduan" style="background:none; border:none; color:#e11d48; cursor:pointer;" title="Jeda / Lanjut"><i class="fas fa-pause"></i></button>
                <button type="button" onclick="window.cancelVoiceRecordAduan()" style="background:none; border:none; color:#e11d48; cursor:pointer;" title="Batalkan"><i class="fas fa-trash-alt"></i></button>
                <button type="button" onclick="window.stopAndPreviewVoiceAduan()" style="background:#009846; color:white; border:none; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Selesai & Pratinjau"><i class="fas fa-check" style="font-size:0.75rem;"></i></button>
            `;
        }
        if (btnRecord) btnRecord.style.color = '#dc2626';

        drawLiveRecordWaveAduan();

        if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
        voiceTimerIntervalAduan = setInterval(() => {
            if (!isVoicePausedAduan) {
                voiceSecondsAduan++;
                const m = String(Math.floor(voiceSecondsAduan / 60)).padStart(2, '0');
                const s = String(voiceSecondsAduan % 60).padStart(2, '0');
                const timeEl = document.getElementById('aduanRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Akses Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.pauseResumeVoiceRecordAduan = function () {
    if (!mediaRecorderAduan) return;
    const btn = document.getElementById('btnPauseVoiceAduan');
    if (mediaRecorderAduan.state === 'recording') {
        mediaRecorderAduan.pause();
        isVoicePausedAduan = true;
        if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
    } else if (mediaRecorderAduan.state === 'paused') {
        mediaRecorderAduan.resume();
        isVoicePausedAduan = false;
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    }
};

window.stopAndPreviewVoiceAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        mediaRecorderAduan.stop();
    }
    const btnRecord = document.getElementById('btnRecordAduan');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.renderPreviewVoiceAduan = function (blob) {
    const ui = document.getElementById('aduanRecordingUI');
    if (!ui) return;
    const previewUrl = URL.createObjectURL(blob);
    tempPreviewAduanAudio = new Audio(previewUrl);

    // Ambil sampel audio PCM untuk mendeteksi suara vs hening saat pemutaran pratinjau
    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewAduanPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate
            };
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewAduanPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    ui.style.display = 'flex';
    ui.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%; background:#ffffff; border:1.5px solid #009846; border-radius:24px; padding:6px 14px; box-shadow:0 4px 12px rgba(0,152,70,0.15);">
            <button type="button" onclick="window.togglePlayPreviewAduan(this)" style="background:#009846; color:white; border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                <i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>
            </button>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:800; color:#0f172a;">
                    <span style="color:#009846;"><i class="fas fa-headphones"></i> Pratinjau Suara</span>
                    <span id="aduanPreviewTimer">00:00 / ${formatAudioTime(voiceSecondsAduan)}</span>
                </div>
                <div style="position:relative; width:100%; height:18px; display:flex; align-items:center;">
                    <canvas id="aduanPreviewCanvas" width="160" height="18" style="width:100%; height:18px; display:block;"></canvas>
                    <input type="range" id="aduanPreviewSeek" min="0" max="100" value="0" step="0.1" oninput="window.seekPreviewAduan(this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; z-index:5;">
                </div>
            </div>
            <button type="button" class="audio-speed-btn" onclick="window.changePreviewAudioSpeedAduan(this)" title="Atur Kecepatan Suara">1x</button>
            <button type="button" onclick="window.cancelVoiceRecordAduan()" style="background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="Hapus / Rekam Ulang">
                <i class="fas fa-trash-alt" style="font-size:0.8rem;"></i>
            </button>
        </div>
    `;

    tempPreviewAduanAudio.onloadedmetadata = () => {
        const t = document.getElementById('aduanPreviewTimer');
        if (t) t.innerText = `00:00 / ${formatAudioTime(tempPreviewAduanAudio.duration)}`;
        window.drawPreviewWaveAduan(false);
    };

    tempPreviewAduanAudio.ontimeupdate = () => {
        const t = document.getElementById('aduanPreviewTimer');
        const s = document.getElementById('aduanPreviewSeek');
        if (t) t.innerText = `${formatAudioTime(tempPreviewAduanAudio.currentTime)} / ${formatAudioTime(tempPreviewAduanAudio.duration || voiceSecondsAduan)}`;
        if (s && tempPreviewAduanAudio.duration) {
            s.value = (tempPreviewAduanAudio.currentTime / tempPreviewAduanAudio.duration) * 100;
        }
    };

    tempPreviewAduanAudio.onended = () => {
        const btn = ui.querySelector('button[onclick*="togglePlayPreviewAduan"]');
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        const s = document.getElementById('aduanPreviewSeek');
        if (s) s.value = 0;
        if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
        window.drawPreviewWaveAduan(false);
    };

    window.drawPreviewWaveAduan(false);
};

function checkPreviewAduanHasSound() {
    if (!tempPreviewAduanAudio || tempPreviewAduanAudio.paused) return false;
    if (!tempPreviewAduanPCM) return true;
    const curTime = tempPreviewAduanAudio.currentTime;
    const idx = Math.floor(curTime * tempPreviewAduanPCM.sampleRate);
    const win = Math.floor(tempPreviewAduanPCM.sampleRate * 0.05);
    let sum = 0;
    const start = Math.max(0, idx - win);
    const end = Math.min(tempPreviewAduanPCM.data.length, idx + win);
    for (let i = start; i < end; i += 4) {
        sum += Math.abs(tempPreviewAduanPCM.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015;
}

window.drawPreviewWaveAduan = function (isWavy) {
    const canvas = document.getElementById('aduanPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const progress = (tempPreviewAduanAudio && tempPreviewAduanAudio.duration) ? (tempPreviewAduanAudio.currentTime / tempPreviewAduanAudio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        // BATANG LURUS JIKA HENING / DIAM / PAUSED
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(progressX, centerY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    } else {
        // GELOMBANG BERLIUK DINAMIS KETIKA ADA SUARA
        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 6;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 4;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    }
};

window.togglePlayPreviewAduan = function (btn) {
    if (!tempPreviewAduanAudio) return;
    if (tempPreviewAduanAudio.paused) {
        tempPreviewAduanAudio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause" style="font-size:0.85rem;"></i>';
            const loop = () => {
                if (tempPreviewAduanAudio && !tempPreviewAduanAudio.paused && !tempPreviewAduanAudio.ended) {
                    const hasSound = checkPreviewAduanHasSound();
                    window.drawPreviewWaveAduan(hasSound);
                    tempPreviewAduanAnim = requestAnimationFrame(loop);
                } else {
                    window.drawPreviewWaveAduan(false);
                }
            };
            tempPreviewAduanAnim = requestAnimationFrame(loop);
        }).catch(() => {});
    } else {
        tempPreviewAduanAudio.pause();
        btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
        window.drawPreviewWaveAduan(false);
    }
};

window.seekPreviewAduan = function (val) {
    if (!tempPreviewAduanAudio || !tempPreviewAduanAudio.duration) return;
    tempPreviewAduanAudio.currentTime = (parseFloat(val) / 100) * tempPreviewAduanAudio.duration;
    window.drawPreviewWaveAduan(!tempPreviewAduanAudio.paused && checkPreviewAduanHasSound());
};

window.changePreviewAudioSpeedAduan = function (btn) {
    if (!tempPreviewAduanAudio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = tempPreviewAduanAudio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    tempPreviewAduanAudio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.sendConfirmedVoiceAduan = function () {
    if (!tempPreviewAduanBlob) return;
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);

    window.editedAduanMediaBlob = tempPreviewAduanBlob;
    window.editedAduanMediaExt = 'webm';
    window.editedAduanMediaType = 'audio';

    const ui = document.getElementById('aduanRecordingUI');
    if (ui) ui.style.display = 'none';

    tempPreviewAduanBlob = null;
    window.kirimPesanAduan();
};

window.cancelVoiceRecordAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (recordAnimFrameAduan) cancelAnimationFrame(recordAnimFrameAduan);
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (recordAudioCtxAduan && recordAudioCtxAduan.state !== 'closed') {
        recordAudioCtxAduan.close().catch(() => {});
    }
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        mediaRecorderAduan.ondataavailable = null;
        mediaRecorderAduan.onstop = null;
        mediaRecorderAduan.stop();
    }
    audioChunksAduan = [];
    tempPreviewAduanBlob = null;
    tempPreviewAduanPCM = null;
    const ui = document.getElementById('aduanRecordingUI');
    const btnRecord = document.getElementById('btnRecordAduan');
    if (ui) ui.style.display = 'none';
    if (btnRecord) btnRecord.style.color = '#64748b';
};

// =========================================================================
// WEBRTC CALL DUA ARAH (WARGA PENGADUAN <-> ADMIN/PETUGAS)
// =========================================================================
window.initPeerWarga = function () {
    if (peerWarga && !peerWarga.destroyed) return;
    const activeNik = wargaNik || (sesiAduanAktif && sesiAduanAktif.nik) || 'guest';
    const peerId = `warga_${activeNik}`;

    peerWarga = new Peer(peerId, {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peerWarga.on('call', call => {
        Swal.fire({
            title: '<i class="fas fa-phone-volume text-success"></i> Panggilan Masuk',
            text: 'Petugas Dinas Sosial Sidoarjo sedang menghubungi Anda.',
            showCancelButton: true,
            confirmButtonText: 'Terima',
            cancelButtonText: 'Tolak',
            confirmButtonColor: '#009846',
            cancelButtonColor: '#dc2626'
        }).then(async r => {
            if (r.isConfirmed) {
                const isVideo = (call.metadata && call.metadata.type === 'video');
                try {
                    localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
                    call.answer(localStreamWarga);
                    window.handleCallConnectedWarga(call, isVideo);
                } catch (e) {
                    showPortalAlert({ icon: 'error', title: 'Gagal Menjawab', text: 'Tidak dapat mengakses kamera atau mikrofon gawai.' });
                }
            } else {
                call.close();
            }
        });
    });
};

window.startCallAdminFromAduan = function (type = 'audio') {
    if (!sesiAduanAktif) return;
    wargaNik = sesiAduanAktif.nik;
    wargaNama = sesiAduanAktif.nama;
    window.initPeerWarga();
    window.startCallAdmin(type);
};

window.startCallAdmin = async function (type = 'audio') {
    if (typeof Peer === 'undefined') {
        return showPortalAlert({ icon: 'warning', title: 'Fitur Belum Siap', text: 'Pustaka WebRTC PeerJS belum termuat pada halaman.' });
    }

    window.initPeerWarga();
    const isVideo = (type === 'video');

    try {
        localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        const callTargetId = 'petugas_dinsos_sidoarjo';
        const call = peerWarga.call(callTargetId, localStreamWarga, {
            metadata: { type, nik: (wargaNik || sesiAduanAktif?.nik), nama: (wargaNama || sesiAduanAktif?.nama) }
        });

        if (!call) {
            return showPortalAlert({ icon: 'info', title: 'Petugas Sibuk', text: 'Petugas Dinsos sedang tidak dalam antrean panggilan langsung.' });
        }

        const activeNik = wargaNik || sesiAduanAktif?.nik;
        const activeNama = wargaNama || sesiAduanAktif?.nama;
        fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: 'warga',
                nama: activeNama,
                pesan: `[📞 PANGGILAN ${type.toUpperCase()}] Warga memulai panggilan langsung bersama petugas.`
            })
        }).catch(() => {});

        window.handleCallConnectedWarga(call, isVideo);
    } catch (e) {
        showPortalAlert({ icon: 'error', title: 'Izin Ditolak', text: 'Izinkan akses kamera dan mikrofon pada peramban Anda.' });
    }
};

window.handleCallConnectedWarga = function (call, isVideo) {
    currentCallWarga = call;
    const modal = document.getElementById('wargaActiveCallUI');
    const vArea = document.getElementById('wargaVideoCallArea');
    const aArea = document.getElementById('wargaAudioCallArea');
    const localV = document.getElementById('wargaLocalVideo');
    const remoteV = document.getElementById('wargaRemoteVideo');
    const timerEl = document.getElementById('wargaCallStatusText');

    if (modal) modal.style.display = 'flex';

    if (isVideo) {
        if (vArea) vArea.style.display = 'block';
        if (aArea) aArea.style.display = 'none';
        if (localV && localStreamWarga) localV.srcObject = localStreamWarga;
    } else {
        if (vArea) vArea.style.display = 'none';
        if (aArea) aArea.style.display = 'flex';
    }

    call.on('stream', remoteStream => {
        if (remoteV) {
            remoteV.srcObject = remoteStream;
            remoteV.play().catch(() => {});
        }
    });

    call.on('close', () => {
        window.endCallWarga();
    });

    callSecondsWarga = 0;
    if (callTimerWarga) clearInterval(callTimerWarga);
    callTimerWarga = setInterval(() => {
        callSecondsWarga++;
        const m = String(Math.floor(callSecondsWarga / 60)).padStart(2, '0');
        const s = String(callSecondsWarga % 60).padStart(2, '0');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);
};

window.toggleMuteCallWarga = function () {
    if (!localStreamWarga) return;
    const aTrack = localStreamWarga.getAudioTracks()[0];
    if (!aTrack) return;
    aTrack.enabled = !aTrack.enabled;
    const btn = document.getElementById('wargaBtnMute');
    if (btn) btn.style.background = aTrack.enabled ? '#334155' : '#dc2626';
};

window.endCallWarga = function () {
    if (callTimerWarga) clearInterval(callTimerWarga);
    if (currentCallWarga) currentCallWarga.close();
    if (localStreamWarga) {
        localStreamWarga.getTracks().forEach(t => t.stop());
        localStreamWarga = null;
    }
    currentCallWarga = null;
    const modal = document.getElementById('wargaActiveCallUI');
    if (modal) modal.style.display = 'none';
};

// =========================================================================
// 9. CHAT MULTIMEDIA (TITIK TIGA POJOK KIRI/KANAN, EMOJI FLOAT, LAPORAN MEMBULAT)
// =========================================================================
window.toggleAduanMsgMenu = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => {
        if (m.id !== `aduan-menu-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`aduan-menu-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
};

window.setReplyAduan = function (id, sender, text) {
    replyToDataAduan = { id, sender, text };
    const cont = document.getElementById('replyPreviewContainerAduan');
    const sEl = document.getElementById('replyPreviewSenderAduan');
    const tEl = document.getElementById('replyPreviewTextAduan');
    if (cont && sEl && tEl) {
        sEl.innerText = sender;
        tEl.innerText = text.length > 50 ? text.substring(0, 50) + '...' : text;
        cont.style.display = 'flex';
    }
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    document.getElementById('aduanChatInput')?.focus();
};

window.batalReplyAduan = function () {
    replyToDataAduan = null;
    const cont = document.getElementById('replyPreviewContainerAduan');
    if (cont) cont.style.display = 'none';
};

window.salinTeksAduan = function (teks) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    if (!teks) return;
    navigator.clipboard.writeText(teks).then(() => {
        showPortalAlert({ icon: 'success', title: 'Tersalin', text: 'Teks pesan berhasil disalin ke papan klip.', timer: 1000, showConfirmButton: false });
    });
};

window.reactToMessageAduan = async function (msgId) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨', '👏', '😮', '😢', '💯'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionAduan(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({
        title: 'Beri Reaksi Emoji',
        html,
        showConfirmButton: false,
        customClass: { popup: 'swal-rounded-popup' }
    });
};

window.submitReactionAduan = async function (msgId, emoji) {
    Swal?.close();
    try {
        await fetch(`${API_URL}/api/chat/react/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
        });
        window.muatPesanAduan(false);
    } catch (e) {}
};

window.hapusPesanAduan = async function (id, tipe) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    const konfirmasi = confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini untuk semua' : 'menghapus pesan dari layar Anda'}?`);
    if (konfirmasi) {
        try {
            await fetch(`${API_URL}/api/chat/action/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tipe, requester: 'warga' })
            });
            window.muatPesanAduan(false);
        } catch (e) {}
    }
};

window.toggleLaporSelect = function () {
    const wrapper = document.getElementById('swalLaporSelectWrapper');
    if (wrapper) wrapper.classList.toggle('open');
};

window.selectLaporOption = function (val, text, iconClass) {
    const hidden = document.getElementById('inputAlasanLapor');
    const label = document.getElementById('swalLaporSelectedLabel');
    const wrapper = document.getElementById('swalLaporSelectWrapper');
    const manualCont = document.getElementById('swalLaporManualContainer');
    const manualInput = document.getElementById('inputLaporManual');

    if (hidden) hidden.value = val;
    if (label) label.innerHTML = `<i class="fas ${iconClass}" style="margin-right:8px;"></i> ${text}`;

    if (wrapper) {
        wrapper.querySelectorAll('.swal-custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        wrapper.classList.remove('open');
    }
    if (event?.currentTarget) {
        event.currentTarget.classList.add('selected');
    }

    if (val === 'Lainnya') {
        if (manualCont) {
            manualCont.style.display = 'block';
            setTimeout(() => { if (manualInput) manualInput.focus(); }, 100);
        }
    } else {
        if (manualCont) manualCont.style.display = 'none';
    }
};

window.laporPesanAdmin = async function (msgId) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');

    const { value: alasan } = await Swal.fire({
        title: '<i class="fas fa-flag text-danger"></i> Laporkan Pesan Petugas',
        html: `
            <div style="text-align:left; font-size:0.88rem; margin-top:10px;">
                <label style="font-weight:700; display:block; margin-bottom:8px; color:#334155;">Pilih Alasan Pelaporan:</label>
                
                <div class="swal-custom-select-wrapper" id="swalLaporSelectWrapper" onclick="event.stopPropagation()">
                    <div class="swal-custom-select-trigger" onclick="window.toggleLaporSelect()">
                        <span id="swalLaporSelectedLabel"><i class="fas fa-comment-slash text-danger" style="margin-right:8px;"></i> Kata-kata Kasar / Pelecehan</span>
                        <i class="fas fa-chevron-down swal-chevron"></i>
                    </div>
                    <div class="swal-custom-select-options" id="swalLaporSelectOptions">
                        <div class="swal-custom-option selected" onclick="window.selectLaporOption('Kata-kata Kasar / Pelecehan', 'Kata-kata Kasar / Pelecehan', 'fa-comment-slash text-danger')">
                            <i class="fas fa-comment-slash text-danger" style="margin-right:8px;"></i> Kata-kata Kasar / Pelecehan
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Permintaan Uang / Pungutan Liar (Pungli)', 'Permintaan Uang / Pungutan Liar (Pungli)', 'fa-hand-holding-usd text-warning')">
                            <i class="fas fa-hand-holding-usd text-warning" style="margin-right:8px;"></i> Permintaan Uang / Pungutan Liar (Pungli)
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Informasi Penyaluran Tidak Sesuai Realita', 'Informasi Penyaluran Tidak Sesuai Realita', 'fa-exclamation-triangle text-info')">
                            <i class="fas fa-exclamation-triangle text-info" style="margin-right:8px;"></i> Informasi Penyaluran Tidak Sesuai Realita
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Pelayanan Tidak Ramah / Mengabaikan', 'Pelayanan Tidak Ramah / Mengabaikan', 'fa-user-times text-secondary')">
                            <i class="fas fa-user-times text-secondary" style="margin-right:8px;"></i> Pelayanan Tidak Ramah / Mengabaikan
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Lainnya', 'Lainnya', 'fa-ellipsis-h text-muted')">
                            <i class="fas fa-ellipsis-h text-muted" style="margin-right:8px;"></i> Lainnya
                        </div>
                    </div>
                    <input type="hidden" id="inputAlasanLapor" value="Kata-kata Kasar / Pelecehan">
                </div>

                <div id="swalLaporManualContainer" style="display:none; margin-top:12px;">
                    <label style="font-weight:700; display:block; margin-bottom:6px; color:#334155;">Tuliskan Rincian Laporan Anda:</label>
                    <textarea id="inputLaporManual" class="form-input" rows="3" placeholder="Jelaskan secara detail pelanggaran atau kendala yang dialami..." style="width:100%; padding:12px 16px; border-radius:18px; border:1.5px solid #cbd5e1; font-family:'Inter'; font-size:0.88rem; outline:none; resize:vertical;"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan Resmi',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        cancelButtonColor: '#64748b',
        customClass: {
            popup: 'swal-rounded-popup',
            confirmButton: 'swal-btn-pill',
            cancelButton: 'swal-btn-pill'
        },
        preConfirm: () => {
            const val = document.getElementById('inputAlasanLapor')?.value || 'Kata-kata Kasar / Pelecehan';
            if (val === 'Lainnya') {
                const manualText = document.getElementById('inputLaporManual')?.value.trim();
                if (!manualText) {
                    Swal.showValidationMessage('Tuliskan rincian kendala/laporan Anda secara manual!');
                    return false;
                }
                return `Lainnya: ${manualText}`;
            }
            return val;
        }
    });

    if (alasan) {
        try {
            const pelaporNik = wargaNik || sesiAduanAktif?.nik || '-';
            const pelaporNama = wargaNama || sesiAduanAktif?.nama || 'Warga';

            await fetch(`${API_URL}/api/publik/pengaduan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nik: pelaporNik,
                    nama_pelapor: pelaporNama,
                    kategori: 'Pelanggaran Komunikasi Chat Petugas',
                    isi_laporan: `[LAPORAN PESAN ID #${msgId}] Alasan: ${alasan}. Dilaporkan oleh warga ${pelaporNama} (NIK: ${pelaporNik}).`
                })
            });

            showPortalAlert({
                icon: 'success',
                title: 'Laporan Diterima',
                text: 'Laporan Anda telah diteruskan ke meja Pengawas Utama Dinas Sosial Sidoarjo untuk ditindaklanjuti.',
                customClass: { popup: 'swal-rounded-popup', confirmButton: 'swal-btn-pill' }
            });
        } catch (e) {
            showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan saat mengirim laporan.' });
        }
    }
};

// =========================================================================
// FITUR AUDIO MURNI (TANPA CORS BLOCK), PCM ANALYSER & PROGRESS SCRUBBER
// =========================================================================
async function loadAudioPCMData(audioId, url) {
    if (audioWaveformDataMap[audioId]) return;
    try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);
        audioWaveformDataMap[audioId] = {
            data: audioBuffer.getChannelData(0),
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration
        };
        tempCtx.close().catch(() => {});
    } catch (e) {
        audioWaveformDataMap[audioId] = { fallback: true };
    }
}

function checkAudioHasSoundAtCurrentTime(audioId) {
    const pcm = audioWaveformDataMap[audioId];
    const audio = document.getElementById(audioId);
    if (!audio || audio.paused) return false;
    if (!pcm || pcm.fallback) return true;

    const curTime = audio.currentTime;
    const index = Math.floor(curTime * pcm.sampleRate);
    const windowSize = Math.floor(pcm.sampleRate * 0.05); // 50ms window
    let sum = 0;
    const start = Math.max(0, index - windowSize);
    const end = Math.min(pcm.data.length, index + windowSize);

    for (let i = start; i < end; i += 4) {
        sum += Math.abs(pcm.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015; // Ambang batas suara vokal nyata
}

window.initAudioMetadata = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    loadAudioPCMData(audioId, audio.src);
    window.drawAudioWave(audioId, false);
};

window.updateAudioTime = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const timeEl = document.getElementById(`time_${audioId}`);
    const seekEl = document.getElementById(`seek_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    if (seekEl && audio.duration) {
        seekEl.value = (audio.currentTime / audio.duration) * 100;
    }
};

window.onAudioEnded = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const btn = document.querySelector(`button[onclick*="'${audioId}'"]`);
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
    const seekEl = document.getElementById(`seek_${audioId}`);
    if (seekEl) seekEl.value = 0;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `00:00 / ${formatAudioTime(audio.duration)}`;
    }
    if (activeAudioAnimators[audioId]) {
        cancelAnimationFrame(activeAudioAnimators[audioId]);
        delete activeAudioAnimators[audioId];
    }
    window.drawAudioWave(audioId, false);
};

window.drawAudioWave = function (audioId, isWavy) {
    const canvas = document.getElementById(`canvas_${audioId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const audio = document.getElementById(audioId);
    const progress = (audio && audio.duration) ? (audio.currentTime / audio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        // BATANG LURUS (TIDAK ADA SUARA / JEDA DIAM / SEDANG DIHENTIKAN)
        if (progressX > 0) {
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(progressX, centerY);
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#009846';
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(4, Math.min(width - 4, progressX)), centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    } else {
        // GELOMBANG BERGERAK (HANYA KETIKA ADA SUARA NYATA YANG KELUAR)
        audioWavePhases[audioId] = (audioWavePhases[audioId] || 0) + 0.22;
        const phase = audioWavePhases[audioId];

        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 7.5;
            const y = centerY + Math.sin(x * 0.12 + phase) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#009846';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 5;
            const y = centerY + Math.sin(x * 0.12 + phase) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        const curEnvelope = Math.sin((progressX / width) * Math.PI) * 7.5;
        const curY = centerY + Math.sin(progressX * 0.12 + phase) * curEnvelope;
        ctx.beginPath();
        ctx.arc(Math.max(4, Math.min(width - 4, progressX)), curY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }
};

window.playAudioModern = function (audioId, btn) {
    const audio = document.getElementById(audioId);
    if (!audio) return;

    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => {
            if (a.id !== audioId && !a.paused) {
                a.pause();
                const otherBtn = document.querySelector(`button[onclick*="'${a.id}'"]`);
                if (otherBtn) otherBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (activeAudioAnimators[a.id]) {
                    cancelAnimationFrame(activeAudioAnimators[a.id]);
                    delete activeAudioAnimators[a.id];
                }
                window.drawAudioWave(a.id, false);
            }
        });

        // Putar audio secara langsung tanpa dibajak MediaElementSource (menghindari bisu akibat CORS)
        audio.muted = false;
        audio.volume = 1.0;
        audio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            const loop = () => {
                if (!audio.paused && !audio.ended) {
                    const hasSound = checkAudioHasSoundAtCurrentTime(audioId);
                    window.drawAudioWave(audioId, hasSound);
                    activeAudioAnimators[audioId] = requestAnimationFrame(loop);
                } else {
                    window.drawAudioWave(audioId, false);
                }
            };
            activeAudioAnimators[audioId] = requestAnimationFrame(loop);
        }).catch((err) => {
            console.error('[Audio Playback Error]', err);
        });
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
        if (activeAudioAnimators[audioId]) {
            cancelAnimationFrame(activeAudioAnimators[audioId]);
            delete activeAudioAnimators[audioId];
        }
        window.drawAudioWave(audioId, false);
    }
};

window.seekAudioModern = function (audioId, value) {
    const audio = document.getElementById(audioId);
    if (!audio || !audio.duration) return;
    audio.currentTime = (parseFloat(value) / 100) * audio.duration;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    const hasSound = (!audio.paused) && checkAudioHasSoundAtCurrentTime(audioId);
    window.drawAudioWave(audioId, hasSound);
};

window.changeAudioSpeed = function (audioId, btn) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = audio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    audio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.handleAduanFileSelected = function (input) {
    const file = input.files[0];
    if (!file) return;
    window.editedAduanMediaBlob = file;
    window.editedAduanMediaExt = file.name.split('.').pop().toLowerCase();

    if (file.type.startsWith('image/')) window.editedAduanMediaType = 'image';
    else if (file.type.startsWith('video/')) window.editedAduanMediaType = 'video';
    else if (file.type.startsWith('audio/')) window.editedAduanMediaType = 'audio';
    else window.editedAduanMediaType = 'document';

    const previewContainer = document.getElementById('previewMediaContainerAduan');
    const previewArea = document.getElementById('preSendPreviewAduan');
    if (previewArea && previewContainer) {
        if (window.editedAduanMediaType === 'image') {
            previewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-height:60px; border-radius:8px;"> <small style="font-weight:700;">${file.name}</small>`;
        } else if (window.editedAduanMediaType === 'video') {
            previewContainer.innerHTML = `<i class="fas fa-film fa-2x" style="color:#0284c7;"></i> <small style="font-weight:700;">${file.name}</small>`;
        } else {
            let icon = 'fa-file-alt text-info';
            if (['ppt', 'pptx'].includes(window.editedAduanMediaExt)) icon = 'fa-file-powerpoint text-danger';
            else if (['xls', 'xlsx', 'csv'].includes(window.editedAduanMediaExt)) icon = 'fa-file-excel text-success';
            previewContainer.innerHTML = `<i class="fas ${icon} fa-2x"></i> <small style="font-weight:700;">${file.name}</small>`;
        }
        previewArea.style.display = 'flex';
    }
};

window.batalLampiranAduan = function () {
    window.editedAduanMediaBlob = null;
    window.editedAduanMediaExt = '';
    window.editedAduanMediaType = '';
    const fileInput = document.getElementById('aduanChatFile');
    if (fileInput) fileInput.value = '';
    const previewArea = document.getElementById('preSendPreviewAduan');
    if (previewArea) previewArea.style.display = 'none';
};

// =========================================================================
// KATALOG EMOJI LENGKAP & TIDAK TERPOTONG
// =========================================================================
window.toggleEmojiPickerAduan = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerAduan');
    if (el) {
        const emojisList = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🥺', '😢', '😭',
            '😤', '😠', '😡', '🤯', '😳', '😱', '😨', '😰', '🤔', '🤫',
            '👍', '👎', '👏', '🙌', '🫶', '🤝', '🙏', '💪', '❤️', '🧡',
            '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '🔥', '✨', '🌟',
            '🚨', '⚠️', '🚩', '📌', '📍', '💯', '✅', '❌', '❓', '❗',
            '📄', '📊', '📈', '📁', '💼', '📦', '🏠', '🏢', '🏛️', '🤝'
        ];
        let html = '';
        emojisList.forEach(e => {
            html += `<div style="cursor:pointer; font-size:1.3rem; text-align:center; padding:4px; transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">${e}</div>`;
        });
        el.innerHTML = html;
        el.style.cssText = `
            display: ${el.style.display === 'none' || el.style.display === '' ? 'grid' : 'none'};
            position: absolute;
            bottom: 66px;
            left: 12px;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 20px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 12px;
            grid-template-columns: repeat(8, 1fr);
            gap: 6px;
            max-height: 220px;
            overflow-y: auto;
            width: 320px;
            max-width: calc(100vw - 40px);
            z-index: 999999 !important;
        `;
    }
};

window.addEmojiAduan = function (emoji) {
    const input = document.getElementById('aduanChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.kirimPesanAduan = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // Jika sedang dalam mode pratinjau suara, kirim suara tersebut via tombol merah ini
    if (tempPreviewAduanBlob) {
        window.sendConfirmedVoiceAduan();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    const inp = document.getElementById('aduanChatInput');
    const msg = inp ? inp.value.trim() : '';
    if (!msg && !window.editedAduanMediaBlob) return;
    if (!sesiAduanAktif) return;
    if (inp) inp.value = '';

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', sesiAduanAktif.nama);
    formData.append('pesan', msg);

    if (window.editedAduanMediaBlob) {
        formData.append('file', window.editedAduanMediaBlob, `berkas_${Date.now()}.${window.editedAduanMediaExt || 'bin'}`);
    }

    if (replyToDataAduan) {
        formData.append('reply_sender', replyToDataAduan.sender);
        formData.append('reply_text', replyToDataAduan.text);
    }

    window.batalLampiranAduan();
    window.batalReplyAduan();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`, {
            method: 'POST',
            body: formData
        });
        window.muatPesanAduan(true);
    } catch (err) {}
};

// =========================================================================
// RENDER BUBBLE OBROLAN PENGADUAN LENGKAP & STABIL
// =========================================================================
window.muatPesanAduan = async function (forceScroll = false) {
    if (!sesiAduanAktif) return;
    const box = document.getElementById('aduanChatMessages');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`);
        const chats = await res.json();
        if (!Array.isArray(chats)) return;

        const currentHash = JSON.stringify(chats);
        if (!forceScroll && currentHash === lastAduanChatHash) {
            return;
        }
        lastAduanChatHash = currentHash;

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan mediasi. Anda dapat bertanya, melampirkan berkas (PPT, Excel, Foto), atau merekam suara di sini.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';
            let mediaHtml = '';
            if (c.file_path) {
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:240px; border-radius:14px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:14px; margin-bottom:6px; background:#000;"></video>`;
                } else if (c.file_type === 'audio') {
                    const audioId = `aduan_audio_${c.id}_${idx}`;
                    mediaHtml = `
                        <div class="modern-voice-card">
                            <audio id="${audioId}" src="${url}" preload="metadata" onloadedmetadata="window.initAudioMetadata('${audioId}')" ontimeupdate="window.updateAudioTime('${audioId}')" onended="window.onAudioEnded('${audioId}')"></audio>
                            <button type="button" class="audio-play-btn" onclick="window.playAudioModern('${audioId}', this)">
                                <i class="fas fa-play"></i>
                            </button>
                            <div class="voice-track-col">
                                <div class="voice-info-row">
                                    <span class="voice-title"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                    <span class="voice-timer" id="time_${audioId}">00:00 / --:--</span>
                                </div>
                                <div class="voice-seek-wrapper">
                                    <canvas id="canvas_${audioId}" class="voice-wave-canvas" width="180" height="26"></canvas>
                                    <input type="range" id="seek_${audioId}" class="voice-seek-input" min="0" max="100" value="0" step="0.1" oninput="window.seekAudioModern('${audioId}', this.value)">
                                </div>
                            </div>
                            <button type="button" class="audio-speed-btn" onclick="window.changeAudioSpeed('${audioId}', this)">1x</button>
                        </div>
                    `;
                } else {
                    let iconClass = 'fa-file-alt';
                    let iconColor = '#0284c7';
                    if (['ppt', 'pptx'].includes(ext)) { iconClass = 'fa-file-powerpoint'; iconColor = '#ea580c'; }
                    else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconClass = 'fa-file-excel'; iconColor = '#16a34a'; }
                    else if (['pdf'].includes(ext)) { iconClass = 'fa-file-pdf'; iconColor = '#dc2626'; }

                    mediaHtml = `
                        <a href="${url}" target="_blank" style="display:flex; align-items:center; gap:12px; background:#ffffff; border:1.5px solid #e2e8f0; padding:10px 14px; border-radius:14px; text-decoration:none; margin-bottom:6px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                            <i class="fas ${iconClass} fa-2x" style="color:${iconColor};"></i>
                            <div>
                                <span style="font-weight:800; font-size:0.85rem; color:#0f172a; display:block;">Unduh Berkas Lampiran</span>
                                <small style="color:#64748b; text-transform:uppercase; font-weight:700;">Format .${ext}</small>
                            </div>
                        </a>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:10px; border-left:4px solid ${isMe ? '#dc2626' : '#0284c7'}; margin-bottom:6px; font-size:0.8rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-6px' : 'right:-6px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 8px; box-shadow:0 3px 8px rgba(0,0,0,0.18); font-size:0.95rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');

            return `
                <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:80%; background:${isMe ? '#fee2e2' : '#ffffff'}; color:${isMe ? '#991b1b' : '#0f172a'}; padding:12px 16px; border-radius:20px; font-size:0.9rem; border:1.5px solid ${isMe ? '#fecdd3' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                            <!-- Titik Tiga di Pojok Kiri Atas untuk Petugas -->
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="position:relative; z-index:20;">
                                    <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Tindakan Pesan">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-left" style="display:none;" onclick="event.stopPropagation()">
                                        <button type="button" onclick="window.setReplyAduan(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                        <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                        <button type="button" onclick="window.reactToMessageAduan(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                        <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                        <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>
                                    </div>
                                </div>
                                <span style="background:#e0f2fe; color:#0284c7; padding:4px 12px; border-radius:14px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                    <i class="fas fa-user-shield"></i> ${safeHtml(handlerName)}
                                </span>
                            </div>
                        </div>
                    ` : `
                        <!-- Titik Tiga di Pojok Kanan Atas untuk Warga -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(220,38,38,0.08);">
                            <span style="font-size:0.75rem; font-weight:800; color:#dc2626; opacity:0.85;">
                                <i class="fas fa-user"></i> Anda (Pelapor)
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Tindakan Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <button type="button" onclick="window.setReplyAduan(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.reactToMessageAduan(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                    <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                    <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik untuk Semua</button>
                                </div>
                            </div>
                        </div>
                    `}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan ? `<div style="word-break:break-word; line-height:1.5; margin-top:2px;">${safeHtml(c.pesan)}</div>` : ''}
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:6px; font-size:0.7rem; color:#94a3b8;">
                        <span>${c.waktu || ''}</span>
                    </div>
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.modern-voice-card audio').forEach(a => {
                window.initAudioMetadata(a.id);
            });
        }, 100);

        if (forceScroll || isNearBottom) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (e) {}
};

// =========================================================================
// 10. CHAT MULTIMEDIA RUANG WARGA TERDAFTAR (KOMPLET)
// =========================================================================
window.loadChatMessagesWarga = async function (forceScroll = false) {
    const activeNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!activeNik) return;
    const box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga') || document.getElementById('chatBoxWarga');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`);
        const chats = await res.json();
        if (!Array.isArray(chats)) return;

        const currentHash = JSON.stringify(chats);
        if (!forceScroll && currentHash === lastChatHashWarga) {
            return;
        }
        lastChatHashWarga = currentHash;

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan percakapan. Hubungi petugas jika ada pertanyaan.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';
            let mediaHtml = '';
            if (c.file_path) {
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:240px; border-radius:14px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:14px; margin-bottom:6px; background:#000;"></video>`;
                } else if (c.file_type === 'audio') {
                    const audioId = `warga_audio_${c.id}_${idx}`;
                    mediaHtml = `
                        <div class="modern-voice-card">
                            <audio id="${audioId}" src="${url}" preload="metadata" onloadedmetadata="window.initAudioMetadata('${audioId}')" ontimeupdate="window.updateAudioTime('${audioId}')" onended="window.onAudioEnded('${audioId}')"></audio>
                            <button type="button" class="audio-play-btn" onclick="window.playAudioModern('${audioId}', this)">
                                <i class="fas fa-play"></i>
                            </button>
                            <div class="voice-track-col">
                                <div class="voice-info-row">
                                    <span class="voice-title"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                    <span class="voice-timer" id="time_${audioId}">00:00 / --:--</span>
                                </div>
                                <div class="voice-seek-wrapper">
                                    <canvas id="canvas_${audioId}" class="voice-wave-canvas" width="180" height="26"></canvas>
                                    <input type="range" id="seek_${audioId}" class="voice-seek-input" min="0" max="100" value="0" step="0.1" oninput="window.seekAudioModern('${audioId}', this.value)">
                                </div>
                            </div>
                            <button type="button" class="audio-speed-btn" onclick="window.changeAudioSpeed('${audioId}', this)">1x</button>
                        </div>
                    `;
                } else {
                    let iconClass = 'fa-file-alt';
                    let iconColor = '#0284c7';
                    if (['ppt', 'pptx'].includes(ext)) { iconClass = 'fa-file-powerpoint'; iconColor = '#ea580c'; }
                    else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconClass = 'fa-file-excel'; iconColor = '#16a34a'; }
                    else if (['pdf'].includes(ext)) { iconClass = 'fa-file-pdf'; iconColor = '#dc2626'; }

                    mediaHtml = `
                        <a href="${url}" target="_blank" style="display:flex; align-items:center; gap:12px; background:#ffffff; border:1.5px solid #e2e8f0; padding:10px 14px; border-radius:14px; text-decoration:none; margin-bottom:6px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                            <i class="fas ${iconClass} fa-2x" style="color:${iconColor};"></i>
                            <div>
                                <span style="font-weight:800; font-size:0.85rem; color:#0f172a; display:block;">Unduh Berkas Lampiran</span>
                                <small style="color:#64748b; text-transform:uppercase; font-weight:700;">Format .${ext}</small>
                            </div>
                        </a>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:10px; border-left:4px solid ${isMe ? '#009846' : '#0284c7'}; margin-bottom:6px; font-size:0.8rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-6px' : 'right:-6px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 8px; box-shadow:0 3px 8px rgba(0,0,0,0.18); font-size:0.95rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');

            return `
                <div id="msg-warga-${c.id}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:80%; background:${isMe ? '#e6f9f0' : '#ffffff'}; color:${isMe ? '#065f46' : '#0f172a'}; padding:12px 16px; border-radius:20px; font-size:0.9rem; border:1.5px solid ${isMe ? '#bbf7d0' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="position:relative; z-index:20;">
                                    <button type="button" class="btn-msg-dots" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Tindakan Pesan">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-left" style="display:none;" onclick="event.stopPropagation()">
                                        <button type="button" onclick="window.setReplyWarga(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                        <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                        <button type="button" onclick="window.reactToMessageWarga(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                        <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                        <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>
                                    </div>
                                </div>
                                <span style="background:#e0f2fe; color:#0284c7; padding:4px 12px; border-radius:14px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                    <i class="fas fa-user-shield"></i> ${safeHtml(handlerName)}
                                </span>
                            </div>
                        </div>
                    ` : `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(0,152,70,0.12);">
                            <span style="font-size:0.75rem; font-weight:800; color:#009846; opacity:0.85;">
                                <i class="fas fa-user"></i> Anda (Warga)
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Tindakan Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <button type="button" onclick="window.setReplyWarga(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.reactToMessageWarga(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik untuk Semua</button>
                                </div>
                            </div>
                        </div>
                    `}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan ? `<div style="word-break:break-word; line-height:1.5; margin-top:2px;">${safeHtml(c.pesan)}</div>` : ''}
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:6px; font-size:0.7rem; color:#94a3b8;">
                        <span>${c.waktu || ''}</span>
                    </div>
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.modern-voice-card audio').forEach(a => {
                window.initAudioMetadata(a.id);
            });
        }, 100);

        if (forceScroll || isNearBottom) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (e) {}
};

window.handleWargaFileSelected = function (input) {
    const file = input.files[0];
    if (!file) return;
    window.editedMediaBlob = file;
    window.editedMediaExt = file.name.split('.').pop().toLowerCase();
    window.editedMediaType = file.type.startsWith('image/')
        ? 'image'
        : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'document'));

    window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
    document.getElementById('wargaChatInput')?.focus();
};

window.sendWargaChat = window.kirimPesanWarga = async function () {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    const currentNama = wargaNama || (sesiWargaAktif && sesiWargaAktif.nama_lengkap) || 'Warga';
    if (!currentNik) return;

    // Jika sedang dalam mode pratinjau suara warga, kirim langsung menggunakan tombol kirim utama
    if (tempPreviewWargaBlob) {
        window.sendConfirmedVoiceWarga();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    const input = document.getElementById('wargaChatInput');
    const pesan = input ? input.value.trim() : '';

    if (!pesan && !window.editedMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', currentNama);
    formData.append('pesan', pesan);

    if (window.editedMediaBlob) {
        const finalName = `media_${Date.now()}.${window.editedMediaExt || 'jpg'}`;
        formData.append('file', window.editedMediaBlob, finalName);
        if (window.editedMediaType) {
            formData.append('custom_file_type', window.editedMediaType);
        }
    }

    if (replyToDataWarga) {
        formData.append('reply_to_id', replyToDataWarga.id);
        formData.append('reply_to_text', replyToDataWarga.text);
        formData.append('reply_to_sender', replyToDataWarga.sender);
    }

    if (input) input.value = '';
    window.batalLampiranWarga();
    window.batalReplyWarga();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
            method: 'POST',
            body: formData
        });
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {
        console.error('[Send Chat Error]', e);
    }
};

window.setReplyWarga = function (id, sender, text, file_type) {
    let displayTxt = text;
    if (file_type === 'image') displayTxt = '📷 Gambar';
    else if (file_type === 'video') displayTxt = '🎥 Video';
    else if (file_type === 'audio') displayTxt = '🎤 Pesan Suara';

    replyToDataWarga = { id, sender, text: displayTxt };
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) {
        const sEl = document.getElementById('replyPreviewSenderWarga');
        const tEl = document.getElementById('replyPreviewTextWarga');
        if (sEl) sEl.innerText = safeHtml(sender);
        if (tEl) tEl.innerText = displayTxt;
        cont.style.display = 'flex';
    }
    document.getElementById('wargaChatInput')?.focus();
};

window.batalReplyWarga = function () {
    replyToDataWarga = null;
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) cont.style.display = 'none';
};

window.reactToMessageWarga = async function (msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionWarga(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({ title: 'Beri Reaksi Emoji', html, showConfirmButton: false });
};

window.submitReactionWarga = async function (msgId, emoji) {
    Swal?.close();
    try {
        await fetch(`${API_URL}/api/chat/react/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
        }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.togglePinMessageWarga = async function (msgId) {
    try {
        await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.hapusPesanWarga = async function (id, tipe) {
    const konfirmasi = confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini' : 'menghapus pesan dari layar Anda'}?`);
    if (konfirmasi) {
        try {
            await fetch(`${API_URL}/api/chat/action/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tipe, requester: 'warga' })
            }).catch(() => null);
            lastChatHashWarga = '';
            window.loadChatMessagesWarga(false);
        } catch (e) {}
    }
};

window.toggleChatMenuWarga = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('[id^="menu-warga-"]').forEach(m => {
        if (m.id !== `menu-warga-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`menu-warga-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
};

window.scrollToMessageWarga = function (id) {
    const el = document.getElementById(`msg-warga-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 15px #009846';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
};

window.toggleEmojiPickerWarga = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerWarga');
    if (el) {
        const emojisList = ['😀', '😂', '🥰', '😎', '😭', '😡', '👍', '🙏', '❤️', '🔥', '✅', '❌', '💡', '🎉', '😢', '🤔', '👏', '🚨'];
        let html = '';
        emojisList.forEach(e => {
            html += `<div style="cursor:pointer; font-size:1.4rem; text-align:center; user-select:none; padding:4px;" onclick="window.addEmojiWarga('${e}')">${e}</div>`;
        });
        el.innerHTML = html;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'grid' : 'none';
    }
};

window.addEmojiWarga = function (emoji) {
    const input = document.getElementById('wargaChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.showPreviewWarga = function (srcUrl, type, fname = '') {
    const previewContainer = document.getElementById('previewMediaContainerWarga');
    const previewArea = document.getElementById('preSendPreviewWarga');
    if (previewArea && previewContainer) {
        if (type === 'image') {
            previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height:100px; border-radius:8px; object-fit:contain;">`;
        } else if (type === 'video') {
            previewContainer.innerHTML = `<video src="${srcUrl}" style="max-height:100px; border-radius:8px;" controls></video>`;
        } else {
            previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info, #0284c7); text-align:center;"><i class="fas fa-file-alt fa-2x"></i><br><small>${safeHtml(fname)}</small></div>`;
        }
        previewArea.style.display = 'block';
    }
};

window.batalLampiranWarga = function () {
    window.editedMediaBlob = null;
    window.editedMediaExt = '';
    window.editedMediaType = '';
    const fileInput = document.getElementById('wargaChatFile');
    if (fileInput) fileInput.value = '';
    const preArea = document.getElementById('preSendPreviewWarga');
    if (preArea) preArea.style.display = 'none';
    const preContainer = document.getElementById('previewMediaContainerWarga');
    if (preContainer) preContainer.innerHTML = '';
};

window.openLightbox = function (type, src) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            imageUrl: src,
            imageAlt: 'Lampiran Berkas',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'rgba(0,0,0,0.85)'
        });
    } else {
        window.open(src, '_blank');
    }
};

// =========================================================================
// 11. VOICE RECORDER WARGA DENGAN LIVE VISUALIZER & PRATINJAU (DASBOR UTAMA)
// =========================================================================
function drawLiveRecordWaveWarga() {
    const canvas = document.getElementById('wargaRecordWaveCanvas');
    if (!canvas || !recordAnalyserWarga) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    const bufferLength = recordAnalyserWarga.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserWarga.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += Math.abs(val);
    }
    const avgVolume = sum / bufferLength;

    ctx.clearRect(0, 0, width, height);

    if (avgVolume < 0.015) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#86efac';
        ctx.lineCap = 'round';
        ctx.stroke();
    } else {
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    recordAnimFrameWarga = requestAnimationFrame(drawLiveRecordWaveWarga);
}

window.toggleVoiceRecordWarga = async function () {
    const ui = document.getElementById('wargaRecordingUI');
    const btnRecord = document.getElementById('btnRecordWarga');

    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksWarga = [];
        mediaRecorderWarga = new MediaRecorder(stream);

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxWarga = new AudioCtx();
            recordAnalyserWarga = recordAudioCtxWarga.createAnalyser();
            recordAnalyserWarga.fftSize = 256;
            const src = recordAudioCtxWarga.createMediaStreamSource(stream);
            src.connect(recordAnalyserWarga);
        } catch (e) {}

        mediaRecorderWarga.ondataavailable = e => {
            if (e.data.size > 0) audioChunksWarga.push(e.data);
        };

        mediaRecorderWarga.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (recordAnimFrameWarga) cancelAnimationFrame(recordAnimFrameWarga);
            if (recordAudioCtxWarga && recordAudioCtxWarga.state !== 'closed') {
                recordAudioCtxWarga.close().catch(() => {});
            }
            if (audioChunksWarga.length > 0) {
                tempPreviewWargaBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
                window.renderPreviewVoiceWarga(tempPreviewWargaBlob);
            }
        };

        mediaRecorderWarga.start();
        voiceSecondsWarga = 0;
        if (ui) {
            ui.style.display = 'flex';
            ui.innerHTML = `
                <span id="wargaRecordTime" style="font-weight:800; font-family:monospace; color:#009846; font-size:0.85rem;">00:00</span>
                <canvas id="wargaRecordWaveCanvas" width="160" height="24" style="flex:1; height:24px; display:block;"></canvas>
                <button type="button" onclick="window.cancelVoiceRecordWarga()" style="background:none; border:none; color:#dc2626; cursor:pointer;" title="Batalkan"><i class="fas fa-trash-alt"></i></button>
                <button type="button" onclick="window.stopAndPreviewVoiceWarga()" style="background:#009846; color:white; border:none; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Selesai & Pratinjau"><i class="fas fa-check" style="font-size:0.75rem;"></i></button>
            `;
        }
        if (btnRecord) btnRecord.style.color = '#009846';

        drawLiveRecordWaveWarga();

        voiceTimerIntervalWarga = setInterval(() => {
            voiceSecondsWarga++;
            const m = String(Math.floor(voiceSecondsWarga / 60)).padStart(2, '0');
            const s = String(voiceSecondsWarga % 60).padStart(2, '0');
            const timeEl = document.getElementById('wargaRecordTime');
            if (timeEl) timeEl.innerText = `${m}:${s}`;
        }, 1000);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.stopAndPreviewVoiceWarga = function () {
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    if (mediaRecorderWarga && mediaRecorderWarga.state !== 'inactive') {
        mediaRecorderWarga.stop();
    }
    const btnRecord = document.getElementById('btnRecordWarga');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.renderPreviewVoiceWarga = function (blob) {
    const ui = document.getElementById('wargaRecordingUI');
    if (!ui) return;
    const previewUrl = URL.createObjectURL(blob);
    tempPreviewWargaAudio = new Audio(previewUrl);

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewWargaPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate
            };
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewWargaPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    ui.style.display = 'flex';
    ui.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%; background:#ffffff; border:1.5px solid #009846; border-radius:24px; padding:6px 14px; box-shadow:0 4px 12px rgba(0,152,70,0.15);">
            <button type="button" onclick="window.togglePlayPreviewWarga(this)" style="background:#009846; color:white; border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                <i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>
            </button>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:800; color:#0f172a;">
                    <span style="color:#009846;"><i class="fas fa-headphones"></i> Pratinjau Suara</span>
                    <span id="wargaPreviewTimer">00:00 / ${formatAudioTime(voiceSecondsWarga)}</span>
                </div>
                <div style="position:relative; width:100%; height:18px; display:flex; align-items:center;">
                    <canvas id="wargaPreviewCanvas" width="160" height="18" style="width:100%; height:18px; display:block;"></canvas>
                    <input type="range" id="wargaPreviewSeek" min="0" max="100" value="0" step="0.1" oninput="window.seekPreviewWarga(this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; z-index:5;">
                </div>
            </div>
            <button type="button" class="audio-speed-btn" onclick="window.changePreviewAudioSpeedWarga(this)" title="Atur Kecepatan Suara">1x</button>
            <button type="button" onclick="window.cancelVoiceRecordWarga()" style="background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="Hapus / Rekam Ulang">
                <i class="fas fa-trash-alt" style="font-size:0.8rem;"></i>
            </button>
        </div>
    `;

    tempPreviewWargaAudio.onloadedmetadata = () => {
        const t = document.getElementById('wargaPreviewTimer');
        if (t) t.innerText = `00:00 / ${formatAudioTime(tempPreviewWargaAudio.duration)}`;
        window.drawPreviewWaveWarga(false);
    };

    tempPreviewWargaAudio.ontimeupdate = () => {
        const t = document.getElementById('wargaPreviewTimer');
        const s = document.getElementById('wargaPreviewSeek');
        if (t) t.innerText = `${formatAudioTime(tempPreviewWargaAudio.currentTime)} / ${formatAudioTime(tempPreviewWargaAudio.duration || voiceSecondsWarga)}`;
        if (s && tempPreviewWargaAudio.duration) {
            s.value = (tempPreviewWargaAudio.currentTime / tempPreviewWargaAudio.duration) * 100;
        }
    };

    tempPreviewWargaAudio.onended = () => {
        const btn = ui.querySelector('button[onclick*="togglePlayPreviewWarga"]');
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        const s = document.getElementById('wargaPreviewSeek');
        if (s) s.value = 0;
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        window.drawPreviewWaveWarga(false);
    };

    window.drawPreviewWaveWarga(false);
};

function checkPreviewWargaHasSound() {
    if (!tempPreviewWargaAudio || tempPreviewWargaAudio.paused) return false;
    if (!tempPreviewWargaPCM) return true;
    const curTime = tempPreviewWargaAudio.currentTime;
    const idx = Math.floor(curTime * tempPreviewWargaPCM.sampleRate);
    const win = Math.floor(tempPreviewWargaPCM.sampleRate * 0.05);
    let sum = 0;
    const start = Math.max(0, idx - win);
    const end = Math.min(tempPreviewWargaPCM.data.length, idx + win);
    for (let i = start; i < end; i += 4) {
        sum += Math.abs(tempPreviewWargaPCM.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015;
}

window.drawPreviewWaveWarga = function (isWavy) {
    const canvas = document.getElementById('wargaPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const progress = (tempPreviewWargaAudio && tempPreviewWargaAudio.duration) ? (tempPreviewWargaAudio.currentTime / tempPreviewWargaAudio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(progressX, centerY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    } else {
        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 6;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 4;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    }
};

window.togglePlayPreviewWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    if (tempPreviewWargaAudio.paused) {
        tempPreviewWargaAudio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause" style="font-size:0.85rem;"></i>';
            const loop = () => {
                if (tempPreviewWargaAudio && !tempPreviewWargaAudio.paused && !tempPreviewWargaAudio.ended) {
                    const hasSound = checkPreviewWargaHasSound();
                    window.drawPreviewWaveWarga(hasSound);
                    tempPreviewWargaAnim = requestAnimationFrame(loop);
                } else {
                    window.drawPreviewWaveWarga(false);
                }
            };
            tempPreviewWargaAnim = requestAnimationFrame(loop);
        }).catch(() => {});
    } else {
        tempPreviewWargaAudio.pause();
        btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        window.drawPreviewWaveWarga(false);
    }
};

window.seekPreviewWarga = function (val) {
    if (!tempPreviewWargaAudio || !tempPreviewWargaAudio.duration) return;
    tempPreviewWargaAudio.currentTime = (parseFloat(val) / 100) * tempPreviewWargaAudio.duration;
    window.drawPreviewWaveWarga(!tempPreviewWargaAudio.paused && checkPreviewWargaHasSound());
};

window.changePreviewAudioSpeedWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = tempPreviewWargaAudio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    tempPreviewWargaAudio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.sendConfirmedVoiceWarga = function () {
    if (!tempPreviewWargaBlob) return;
    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);

    window.editedMediaBlob = tempPreviewWargaBlob;
    window.editedMediaExt = 'webm';
    window.editedMediaType = 'audio';

    const ui = document.getElementById('wargaRecordingUI');
    if (ui) ui.style.display = 'none';

    tempPreviewWargaBlob = null;
    window.sendWargaChat();
};

// =========================================================================
// 12. PENDAFTARAN MANDIRI & GEOTAGGING MAP LEAFLET
// =========================================================================
function initGeotaggingMap() {
    const box = document.getElementById('mapPublik') || document.getElementById('formCoordMapPublik');
    if (!box || typeof L === 'undefined') return;

    const defaultCoord = [-7.4478, 112.7183];
    if (mapGeotaggingInstance) {
        setTimeout(() => mapGeotaggingInstance.invalidateSize(), 200);
        return;
    }

    mapGeotaggingInstance = L.map(box, {
        center: defaultCoord,
        zoom: 13,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(mapGeotaggingInstance);

    markerGeotaggingInstance = L.marker(defaultCoord, { draggable: true }).addTo(mapGeotaggingInstance);

    markerGeotaggingInstance.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        window.updateAlamatPublikFromCoords(pos.lat, pos.lng);
    });

    mapGeotaggingInstance.on('click', function (e) {
        markerGeotaggingInstance.setLatLng(e.latlng);
        window.updateAlamatPublikFromCoords(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => mapGeotaggingInstance.invalidateSize(), 300);
}

window.updateAlamatPublikFromCoords = async function (lat, lng) {
    const latEl = document.getElementById('latPublik');
    const lngEl = document.getElementById('lngPublik');
    const alamatEl = document.getElementById('regAlamat');

    if (latEl) latEl.value = Number(lat).toFixed(6);
    if (lngEl) lngEl.value = Number(lng).toFixed(6);

    if (!alamatEl) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
                alamatEl.value = data.display_name;
            }
        }
    } catch (e) {}
};

window.ambilLokasiGPSPublik = function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (mapGeotaggingInstance && markerGeotaggingInstance) {
                mapGeotaggingInstance.setView([lat, lng], 16);
                markerGeotaggingInstance.setLatLng([lat, lng]);
            }
            window.updateAlamatPublikFromCoords(lat, lng);
        }, () => {
            showPortalAlert({ icon: 'warning', title: 'GPS Gagal', text: 'Izinkan akses geolokasi pada peramban gawai Anda.' });
        });
    }
};

window.cariAlamatPublik = async function (query) {
    if (!query || query.trim().length < 4) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Sidoarjo, Jawa Timur')}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (mapGeotaggingInstance && markerGeotaggingInstance) {
                    mapGeotaggingInstance.setView([lat, lng], 16);
                    markerGeotaggingInstance.setLatLng([lat, lng]);
                }
                const latEl = document.getElementById('latPublik');
                const lngEl = document.getElementById('lngPublik');
                if (latEl) latEl.value = lat.toFixed(6);
                if (lngEl) lngEl.value = lng.toFixed(6);
            }
        }
    } catch (e) {}
};

window.acakCaptchaPendaftaran = function () {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 1;
    captchaAnswerPendaftaran = a + b;
    const el = document.getElementById('wargaCaptchaQ');
    if (el) el.innerText = `${a} + ${b} = ?`;
    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp) ansInp.value = '';
};

window.daftarMandiri = window.kirimPendaftaranMandiri = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const ansInp = document.getElementById('wargaCaptchaA');
    if (ansInp && parseInt(ansInp.value.trim(), 10) !== captchaAnswerPendaftaran) {
        window.acakCaptchaPendaftaran();
        return showPortalAlert({ icon: 'warning', title: 'Verifikasi Gagal', text: 'Jawaban hitungan anti-bot salah! Silakan coba lagi.' });
    }

    const payload = {
        nik: document.getElementById('regNik')?.value.trim(),
        nama: document.getElementById('regNama')?.value.trim(),
        tempat_lahir: document.getElementById('regTempatLahir')?.value.trim() || 'Sidoarjo',
        tanggal_lahir: document.getElementById('regTglLahir')?.value || null,
        alamat: document.getElementById('regAlamat')?.value.trim(),
        lat: document.getElementById('latPublik')?.value.trim() || '-7.4478',
        lng: document.getElementById('lngPublik')?.value.trim() || '112.7183',
        no_hp: document.getElementById('regNoHp')?.value.trim() || '',
        email: document.getElementById('regEmail')?.value.trim() || '',
        c1: parseFloat(document.getElementById('regC1')?.value || 1200000),
        c2: parseInt(document.getElementById('regC2')?.value || 3000000),
        c3: parseInt(document.getElementById('regC3')?.value || 45),
        c4: parseInt(document.getElementById('regC4')?.value || 1),
        c5: parseInt(document.getElementById('regC5')?.value || 3),
        c6: parseInt(document.getElementById('regC6')?.value || 1),
        c7: parseInt(document.getElementById('regC7')?.value || 2),
        c8: parseInt(document.getElementById('regC8')?.value || 1),
        c9: parseInt(document.getElementById('regC9')?.value || 1),
        c10: parseInt(document.getElementById('regC10')?.value || 1),
        catatan: document.getElementById('regCatatan')?.value.trim() || 'Pendaftaran Mandiri Portal Warga'
    };

    if (!payload.nik || !payload.nama || payload.nik.length !== 16) {
        return showPortalAlert({ icon: 'warning', title: 'Data Belum Lengkap', text: 'NIK (16 digit) dan Nama Lengkap wajib diisi.' });
    }

    showPortalAlert({ title: 'Menyimpan Berkas...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        let res = await fetch(`${API_URL}/warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            res = await fetch(`${API_URL}/api/warga`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const json = await res.json().catch(() => ({}));
        Swal?.close();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Terdaftar!',
                text: 'Berkas Anda berhasil dicatat dan masuk status menunggu validasi petugas.',
                confirmButtonColor: '#009846'
            });
            document.getElementById('formPendaftaranWarga')?.reset();
            window.acakCaptchaPendaftaran();
            window.switchTabPublik('cekStatusSection');
            const cekInput = document.getElementById('cekNik') || document.getElementById('lacakNik');
            if (cekInput) cekInput.value = payload.nik;
        } else {
            showPortalAlert({ 
                icon: 'error', 
                title: 'Gagal Mendaftar', 
                text: json.message || 'Terjadi kesalahan saat memproses berkas pendaftaran.' 
            });
            window.acakCaptchaPendaftaran();
        }
    } catch (err) {
        Swal?.close();
        showPortalAlert({ 
            icon: 'error', 
            title: 'Koneksi Peladen Terputus', 
            html: '<p style="font-size:0.9rem;">Gagal mengirim berkas ke peladen. Pastikan backend Flask (<code>python app.py</code>) telah dijalankan.</p>' 
        });
        window.acakCaptchaPendaftaran();
    }
};

// =========================================================================
// 13. TUR INTERAKTIF NON-BLOCKING & FAQ ACCORDION
// =========================================================================
window.toggleFaq = function (el) {
    const answer = el.nextElementSibling;
    const icon = el.querySelector('i');
    const isOpen = answer.style.display === 'block';
    document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
    document.querySelectorAll('.faq-question i').forEach(i => i.className = 'fas fa-chevron-down');
    if (!isOpen) {
        answer.style.display = 'block';
        if (icon) icon.className = 'fas fa-chevron-up';
    }
};

const daftarLangkahTur = [
    {
        targetId: 'loginWargaSection',
        badge: 'Kanal Akses',
        title: 'Masuk Dashboard Pribadi',
        desc: 'Masukkan NIK, Nama KTP, dan Email untuk membuka Dashboard Personal, memantau riwayat penetapan, serta berkoordinasi via Live Chat & Panggilan WebRTC bersama petugas Dinsos.'
    },
    {
        targetId: 'cekStatusSection',
        badge: 'Transparansi',
        title: 'Cek Status Bansos Terpadu',
        desc: 'Cukup masukkan 16 digit NIK untuk mengetahui klasifikasi desil (1-10), status kelayakan bansos, dan status penyaluran fisik secara seketika dan transparan.'
    },
    {
        targetId: 'daftarMandiriSection',
        badge: 'Pendaftaran',
        title: 'Pendaftaran Mandiri & Geotagging GPS',
        desc: 'Bagi keluarga yang belum terdata, ajukan data survei mandiri dengan mengisi 10 indikator kelayakan SPK BWM-SAW dan mengunci koordinat titik GPS rumah Anda.'
    },
    {
        targetId: 'pantauAduanSection',
        badge: 'Pengaduan',
        title: 'Pantau Progres Penanganan Aduan',
        desc: 'Akses cepat berbasis NIK untuk langsung melihat tahapan investigasi kendala pendaftaran atau sengketa penyaluran tanpa membuat laporan baru.'
    },
    {
        targetId: 'bantuanSection',
        badge: 'Edukasi',
        title: 'Pusat Edukasi & Bantuan (FAQ)',
        desc: 'Panduan lengkap mengenai regulasi desil 1–4, prosedur sanggah desil faktual, dan tindakan penyelesaian jika fisik bantuan belum diterima.'
    },
    {
        targetId: 'chatbotFabBtn',
        badge: 'Asisten Virtual',
        title: 'Asisten Cerdas & Jalur Pengaduan',
        desc: 'Jika Anda belum terdaftar atau terkendala teknis saat mendaftar, klik ikon robot di pojok kanan bawah untuk diarahkan langsung ke Dashboard Khusus Pengaduan.'
    }
];

window.mulaiTurInteraktif = function () {
    window.tutupModalPanduan();
    if (typeof Swal !== 'undefined') Swal.close();

    activeTourIndex = 0;
    window.jalankanLangkahTur(activeTourIndex);
};

window.jalankanLangkahTur = function (index) {
    if (index < 0 || index >= daftarLangkahTur.length) {
        window.tutupTurInteraktif();
        return;
    }

    activeTourIndex = index;
    const step = daftarLangkahTur[index];

    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));

    if (step.targetId === 'chatbotFabBtn') {
        const botBtn = document.getElementById('chatbotFabBtn') || document.getElementById('chatbotTriggerBtn');
        if (botBtn) {
            botBtn.classList.add('highlight-focus');
            botBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        window.switchTabPublik(step.targetId);
        const cardTarget = document.getElementById(step.targetId);
        if (cardTarget) {
            cardTarget.classList.add('highlight-focus');
            cardTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    let tourBox = document.getElementById('floatingTourGuideBar');
    if (!tourBox) {
        tourBox = document.createElement('div');
        tourBox.id = 'floatingTourGuideBar';
        tourBox.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            width: 92%;
            max-width: 660px;
            background: #ffffff;
            border-radius: 20px;
            border: 2px solid #009846;
            box-shadow: 0 16px 45px rgba(15, 23, 42, 0.25);
            padding: 18px 24px;
            z-index: 999999;
            animation: slideUpTourBar 0.3s ease;
        `;
        document.body.appendChild(tourBox);
    }

    const isLast = (index === daftarLangkahTur.length - 1);
    tourBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#e6f9f0; color:#009846; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; letter-spacing:0.3px;">
                <i class="fas fa-compass"></i> LANGKAH ${index + 1} DARI ${daftarLangkahTur.length}: ${step.badge.toUpperCase()}
            </span>
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer; line-height:1;" title="Tutup Tur">&times;</button>
        </div>
        <h4 style="font-size:1.05rem; font-weight:800; color:#0f172a; margin:4px 0 6px 0;">${step.title}</h4>
        <p style="font-size:0.88rem; color:#475569; line-height:1.55; margin:0 0 16px 0;">${step.desc}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" onclick="window.tutupTurInteraktif()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#64748b; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:pointer;">
                Lewati Tur
            </button>
            <div style="display:flex; gap:8px;">
                <button type="button" onclick="window.jalankanLangkahTur(${index - 1})" ${index === 0 ? 'disabled' : ''} style="background:${index === 0 ? '#f1f5f9' : '#ffffff'}; border:1px solid #cbd5e1; color:${index === 0 ? '#cbd5e1' : '#0f172a'}; padding:8px 16px; border-radius:20px; font-weight:700; font-size:0.82rem; cursor:${index === 0 ? 'not-allowed' : 'pointer'};">
                    &larr; Sebelumnya
                </button>
                <button type="button" onclick="window.jalankanLangkahTur(${index + 1})" style="background:#009846; border:none; color:#ffffff; padding:8px 20px; border-radius:20px; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 3px 10px rgba(0,152,70,0.25);">
                    ${isLast ? '<i class="fas fa-check"></i> Selesai Tur' : 'Lanjut &rarr;'}
                </button>
            </div>
        </div>
    `;
};

window.tutupTurInteraktif = function () {
    document.querySelectorAll('.highlight-focus').forEach(el => el.classList.remove('highlight-focus'));
    const tourBox = document.getElementById('floatingTourGuideBar');
    if (tourBox) tourBox.remove();
};

window.bukaModalPanduanPortal = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'flex';
};

window.tutupModalPanduan = function () {
    const m = document.getElementById('modalPanduanPortal');
    if (m) m.style.display = 'none';
};

window.navigasiPanduan = function (targetId) {
    window.tutupModalPanduan();

    if (targetId === 'chatbot') {
        window.toggleChatbotWindow();
        return;
    }

    window.switchTabPublik(targetId);

    const card = document.getElementById(targetId);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('highlight-focus');
        void card.offsetWidth;
        card.classList.add('highlight-focus');
        setTimeout(() => card.classList.remove('highlight-focus'), 3000);
    }
};

// =========================================================================
// 14. CHATBOT ASISTEN VIRTUAL & INVESTIGASI SENGKETA
// =========================================================================
window.toggleChatbotWindow = window.toggleModernChatbot = function () {
    const win = document.getElementById('chatbotWindow') || document.getElementById('chatbotBox');
    if (!win) return;
    win.style.display = (win.style.display === 'flex' || win.style.display === 'block') ? 'none' : 'flex';
};

window.botReplyFAQ = function (topic) {
    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;

    let qText = topic === 'kriteria' ? 'Siapa yang berhak menerima bansos?' : 'Kapan bantuan fisik dicairkan?';
    let aText = topic === 'kriteria'
        ? 'Bansos diprioritaskan bagi keluarga yang masuk dalam <b>Desil 1–4</b> hasil kalkulasi kriteria BWM-SAW yang akuntabel.'
        : 'Penyaluran fisik dilaksanakan terjadwal di kantor kelurahan/desa setempat membawa KTP dan KK asli.';

    body.innerHTML += `<div class="user-bubble" style="background:#009846; color:white; padding:10px 14px; border-radius:14px; align-self:flex-end; max-width:80%; margin-bottom:6px;">${qText}</div>`;
    setTimeout(() => {
        body.innerHTML += `<div class="bot-bubble" style="background:white; padding:12px 16px; border-radius:14px; border:1px solid #e2e8f0; font-size:0.88rem; line-height:1.5; margin-bottom:6px;">${aText}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 300);
};

window.kirimPilihanBot = function (teks) {
    const body = document.getElementById('chatbotMessages') || document.getElementById('chatbotMsgBody');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${teks}</div>`;

    setTimeout(() => {
        let balasan = "Petugas kami siap membantu penanganan aduan Anda.";
        if (teks.toLowerCase().includes('berhak')) {
            balasan = "Berdasarkan regulasi resmi, keluarga pada <b>Desil 1 sampai dengan 4</b> merupakan prioritas mutlak penerima bantuan sosial reguler.";
        } else if (teks.toLowerCase().includes('kapan')) {
            balasan = "Pencairan bantuan fisik dilakukan bertahap di kantor desa/kelurahan setempat dan divalidasi langsung oleh pendamping lapangan.";
        }
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">${balasan}</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botSendMessage = window.kirimTeksBot = function () {
    const inp = document.getElementById('botInputText') || document.getElementById('chatbotInput');
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    inp.value = '';

    const body = document.getElementById('chatbotMsgBody') || document.getElementById('chatbotMessages');
    if (!body) return;
    body.innerHTML += `<div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 14px; align-self: flex-end; font-size: 0.88rem; max-width: 80%; margin-bottom:6px;">${safeHtml(txt)}</div>`;

    setTimeout(() => {
        body.innerHTML += `<div style="background: white; padding: 12px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 0.88rem; line-height: 1.5; margin-bottom:6px;">Terima kasih atas pertanyaan Anda. Jika menemui kendala spesifik saat mendaftar, silakan gunakan tombol <b>Laporkan Masalah / Gagal Daftar</b> di atas.</div>`;
        body.scrollTop = body.scrollHeight;
    }, 350);
};

window.botBukaFormLapor = window.bukaFormLaporKendalaBot = async function () {
    window.toggleChatbotWindow();

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-shield-virus text-danger"></i> Laporkan Masalah / Gagal Daftar',
        html: `
            <div style="text-align:left; font-size:0.88rem;">
                <p style="margin-bottom:12px; color:#64748b;">Gunakan jalur ini jika Anda belum terdaftar atau terkendala teknis saat proses pendaftaran bansos.</p>
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nomor Induk Kependudukan (NIK)</label>
                <input type="number" id="botSwalNik" class="form-input" placeholder="16 digit NIK KTP" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Nama Lengkap</label>
                <input type="text" id="botSwalNama" class="form-input" placeholder="Nama Anda" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <label class="form-label" style="font-weight:700; display:block; margin-bottom:4px;">Uraian Kendala yang Dialami</label>
                <textarea id="botSwalPesan" class="form-input" rows="3" placeholder="Contoh: NIK tidak terbaca, gagal kirim formulir, dll..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Buka Dashboard Pengaduan',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            const nik = document.getElementById('botSwalNik')?.value.trim();
            const nama = document.getElementById('botSwalNama')?.value.trim();
            const pesan = document.getElementById('botSwalPesan')?.value.trim();
            if (!nik || nik.length !== 16) {
                Swal.showValidationMessage('Masukkan tepat 16 digit NIK!');
                return false;
            }
            if (!nama || !pesan) {
                Swal.showValidationMessage('Nama dan uraian kendala wajib ditulis!');
                return false;
            }
            return { nik, nama, pesan };
        }
    });

    if (formValues) {
        window.masukDashboardPengaduan(formValues.nik, formValues.nama, formValues.pesan, true);
    }
};

// =========================================================================
// 15. CETAK BUKTI BANSOS & DOKUMEN PENETAPAN WARGA
// =========================================================================
window.cetakBuktiPendaftaran = function () {
    const data = wargaDataCache || window.lastLacakData || sesiWargaAktif;
    if (!data) {
        return showPortalAlert({ icon: 'warning', title: 'Data Kosong', text: 'Silakan masuk atau lacak NIK Anda terlebih dahulu.' });
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Tanda Bukti Terdaftar - Pemkab Sidoarjo</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; line-height: 1.6; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 25px; }
                .header h2 { margin: 0; font-size: 16pt; }
                .header h3 { margin: 4px 0; font-size: 14pt; }
                .content table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .content td { padding: 8px 12px; border: 1px solid #333; font-size: 11pt; }
                .content td.label { width: 35%; font-weight: bold; background: #f2f2f2; }
                .footer { margin-top: 40px; display: flex; justify-content: flex-end; text-align: center; }
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <h2>PEMERINTAH KABUPATEN SIDOARJO</h2>
                <h3>DINAS SOSIAL</h3>
                <p style="margin:0; font-size:10pt;">Jl. Pahlawan No. 1 Sidoarjo, Jawa Timur | Telp (031) 8921000</p>
            </div>
            <div class="content">
                <h4 style="text-align:center; text-decoration:underline; margin-bottom:15px;">BUKTI PENDAFTARAN & STATUS VERIFIKASI BANSOS</h4>
                <table>
                    <tr><td class="label">Nomor Induk Kependudukan (NIK)</td><td>${safeHtml(data.nik || '-')}</td></tr>
                    <tr><td class="label">Nama Lengkap</td><td>${safeHtml(data.nama_lengkap || data.nama || '-')}</td></tr>
                    <tr><td class="label">Alamat Domisili</td><td>${safeHtml(data.alamat || 'Kabupaten Sidoarjo')}</td></tr>
                    <tr><td class="label">Klasifikasi Desil</td><td>Desil ${safeHtml(data.desil || '5')}</td></tr>
                    <tr><td class="label">Status Penetapan Bansos</td><td>${safeHtml(data.status_bansos || 'Diproses')}</td></tr>
                    <tr><td class="label">Realisasi Penyaluran</td><td>${safeHtml(data.status_salur || 'Pending')}</td></tr>
                </table>
            </div>
            <div class="footer">
                <div>
                    <p>Sidoarjo, ${new Date().toLocaleDateString('id-ID')}</p>
                    <br><br><br>
                    <p><b>Petugas Verifikator Dinsos</b></p>
                </div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};