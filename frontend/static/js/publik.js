/**
 * Modul Utama: publik.js
 * Deskripsi: Core Orchestrator Portal Layanan Publik Warga SPK Bansos Pemkab Sidoarjo
 * Menghubungkan seluruh modul fitur publik:
 * - publik-nav.js, publik-dashboard.js, publik-lacak.js
 * - publik-daftar.js, publik-aduan.js, publik-audio.js
 * - publik-webrtc.js, publik-chat.js, publik-chatbot.js
 */

// =========================================================================
// 1. STATE & KONFIGURASI GLOBAL PORTAL WARGA
// =========================================================================
const API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : window.location.origin.replace(/\/+$/, ''));

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
