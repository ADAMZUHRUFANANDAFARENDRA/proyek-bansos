/**
 * Modul Utama: publik.js
 * Deskripsi: Core Orchestrator Portal Layanan Publik Warga SPK Bansos Pemkab Sidoarjo
 * Menghubungkan seluruh modul fitur publik:
 * - publik-nav.js, publik-dashboard.js, publik-lacak.js
 * - publik-daftar.js, publik-aduan.js, publik-audio.js
 * - publik-webrtc.js, publik-chat.js, publik-chatbot.js
 */

// =========================================================================
// 1. STATE & KONFIGURASI GLOBAL PORTAL WARGA (SAFE SYNC KE WINDOW)
// =========================================================================
var API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : window.location.origin.replace(/\/+$/, ''));
window.API_URL = API_URL;

var BASE_URL = API_URL;
window.BASE_URL = BASE_URL;

window.wargaNik = window.wargaNik || localStorage.getItem('wargaNik') || '';
var wargaNik = window.wargaNik;
window.wargaNama = window.wargaNama || localStorage.getItem('wargaNama') || '';
var wargaNama = window.wargaNama;
window.wargaDataCache = window.wargaDataCache || null;
var wargaDataCache = window.wargaDataCache;

window.sesiWargaAktif = window.sesiWargaAktif || null;
var sesiWargaAktif = window.sesiWargaAktif;
window.sesiAduanAktif = window.sesiAduanAktif || null;
var sesiAduanAktif = window.sesiAduanAktif;
window.lastLacakData = window.lastLacakData || null;
var lastLacakData = window.lastLacakData;

window.editedMediaBlob = window.editedMediaBlob || null;
window.editedMediaExt = window.editedMediaExt || '';
window.editedMediaType = window.editedMediaType || '';

window.replyToDataWarga = window.replyToDataWarga || null;
var replyToDataWarga = window.replyToDataWarga;
window.lastChatHashWarga = window.lastChatHashWarga || '';
window.chatIntervalWarga = window.chatIntervalWarga || null;
var chatIntervalWarga = window.chatIntervalWarga;
window.aduanChatInterval = window.aduanChatInterval || null;
var aduanChatInterval = window.aduanChatInterval;
window.lastAduanChatHash = window.lastAduanChatHash || '';
var lastAduanChatHash = window.lastAduanChatHash;

// Voice Recording & Preview State (Ruang Warga Terdaftar)
window.mediaRecorderWarga = window.mediaRecorderWarga || null;
var mediaRecorderWarga = window.mediaRecorderWarga;
window.audioChunksWarga = window.audioChunksWarga || [];
var audioChunksWarga = window.audioChunksWarga;
window.voiceTimerIntervalWarga = window.voiceTimerIntervalWarga || null;
var voiceTimerIntervalWarga = window.voiceTimerIntervalWarga;
window.voiceSecondsWarga = window.voiceSecondsWarga || 0;
var voiceSecondsWarga = window.voiceSecondsWarga;
window.recordAudioCtxWarga = window.recordAudioCtxWarga || null;
var recordAudioCtxWarga = window.recordAudioCtxWarga;
window.recordAnalyserWarga = window.recordAnalyserWarga || null;
var recordAnalyserWarga = window.recordAnalyserWarga;
window.recordAnimFrameWarga = window.recordAnimFrameWarga || null;
var recordAnimFrameWarga = window.recordAnimFrameWarga;
window.tempPreviewWargaBlob = window.tempPreviewWargaBlob || null;
var tempPreviewWargaBlob = window.tempPreviewWargaBlob;
window.tempPreviewWargaAudio = window.tempPreviewWargaAudio || null;
var tempPreviewWargaAudio = window.tempPreviewWargaAudio;
window.tempPreviewWargaPCM = window.tempPreviewWargaPCM || null;
var tempPreviewWargaPCM = window.tempPreviewWargaPCM;
window.tempPreviewWargaAnim = window.tempPreviewWargaAnim || null;
var tempPreviewWargaAnim = window.tempPreviewWargaAnim;

// Voice Recording & Preview State (Ruang Pengaduan Khusus)
window.mediaRecorderAduan = window.mediaRecorderAduan || null;
var mediaRecorderAduan = window.mediaRecorderAduan;
window.audioChunksAduan = window.audioChunksAduan || [];
var audioChunksAduan = window.audioChunksAduan;
window.voiceTimerIntervalAduan = window.voiceTimerIntervalAduan || null;
var voiceTimerIntervalAduan = window.voiceTimerIntervalAduan;
window.voiceSecondsAduan = window.voiceSecondsAduan || 0;
var voiceSecondsAduan = window.voiceSecondsAduan;
window.isVoicePausedAduan = window.isVoicePausedAduan || false;
var isVoicePausedAduan = window.isVoicePausedAduan;
window.recordAudioCtxAduan = window.recordAudioCtxAduan || null;
var recordAudioCtxAduan = window.recordAudioCtxAduan;
window.recordAnalyserAduan = window.recordAnalyserAduan || null;
var recordAnalyserAduan = window.recordAnalyserAduan;
window.recordSourceAduan = window.recordSourceAduan || null;
var recordSourceAduan = window.recordSourceAduan;
window.recordAnimFrameAduan = window.recordAnimFrameAduan || null;
var recordAnimFrameAduan = window.recordAnimFrameAduan;
window.tempPreviewAduanBlob = window.tempPreviewAduanBlob || null;
var tempPreviewAduanBlob = window.tempPreviewAduanBlob;
window.tempPreviewAduanAudio = window.tempPreviewAduanAudio || null;
var tempPreviewAduanAudio = window.tempPreviewAduanAudio;
window.tempPreviewAduanPCM = window.tempPreviewAduanPCM || null;
var tempPreviewAduanPCM = window.tempPreviewAduanPCM;
window.tempPreviewAduanAnim = window.tempPreviewAduanAnim || null;
var tempPreviewAduanAnim = window.tempPreviewAduanAnim;

// State Playback Voice Note PCM Waveform Data
window.audioWaveformDataMap = window.audioWaveformDataMap || {};
var audioWaveformDataMap = window.audioWaveformDataMap;
window.activeAudioAnimators = window.activeAudioAnimators || {};
var activeAudioAnimators = window.activeAudioAnimators;
window.audioWavePhases = window.audioWavePhases || {};
var audioWavePhases = window.audioWavePhases;

// WebRTC Call State
window.peerWarga = window.peerWarga || null;
var peerWarga = window.peerWarga;
window.currentCallWarga = window.currentCallWarga || null;
var currentCallWarga = window.currentCallWarga;
window.localStreamWarga = window.localStreamWarga || null;
var localStreamWarga = window.localStreamWarga;
window.callTimerWarga = window.callTimerWarga || null;
var callTimerWarga = window.callTimerWarga;
window.callSecondsWarga = window.callSecondsWarga || 0;
var callSecondsWarga = window.callSecondsWarga;

// Media & Chat State (Ruang Pengaduan)
window.editedAduanMediaBlob = window.editedAduanMediaBlob || null;
window.editedAduanMediaExt = window.editedAduanMediaExt || '';
window.editedAduanMediaType = window.editedAduanMediaType || '';
window.replyToDataAduan = window.replyToDataAduan || null;
var replyToDataAduan = window.replyToDataAduan;

// Peta Geotagging Mandiri
window.mapGeotaggingInstance = window.mapGeotaggingInstance || null;
var mapGeotaggingInstance = window.mapGeotaggingInstance;
window.markerGeotaggingInstance = window.markerGeotaggingInstance || null;
var markerGeotaggingInstance = window.markerGeotaggingInstance;

// Captcha State
window.captchaAnswerPendaftaran = window.captchaAnswerPendaftaran || 0;
var captchaAnswerPendaftaran = window.captchaAnswerPendaftaran;

// Tour State
window.activeTourIndex = window.activeTourIndex || 0;
var activeTourIndex = window.activeTourIndex;

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
window.safeHtml = safeHtml;

function enc(str) {
    return encodeURIComponent(str || '');
}
window.enc = enc;

function formatAudioTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
window.formatAudioTime = formatAudioTime;

function showPortalAlert(options) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire(options);
    }
    alert(options.text || options.title || 'Pemberitahuan');
    return Promise.resolve({ isConfirmed: true, value: true });
}
window.showPortalAlert = showPortalAlert;

// =========================================================================

// 4. INISIALISASI HALAMAN & EVENT LISTENER
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifikasi Otorisasi: Portal Warga Hanya untuk Super Admin & Developer
    if (window.PublikDiagnostic && typeof window.PublikDiagnostic.checkAccess === 'function') {
        window.PublikDiagnostic.checkAccess();
    }

    const savedNik = localStorage.getItem('wargaNik');
    const savedNama = localStorage.getItem('wargaNama');
    const savedEmail = localStorage.getItem('wargaEmail') || '';

    // Pastikan session yang dipulihkan adalah 16 digit asli (bukan NIK bertanda bintang dari bug lama)
    if (savedNik && savedNama && savedNik.length === 16 && !savedNik.includes('*') && /^\d+$/.test(savedNik)) {
        wargaNik = savedNik;
        wargaNama = savedNama;
        sesiWargaAktif = { nik: savedNik, nama_lengkap: savedNama, email_login: savedEmail };
        window.switchTabPublik('dashboardWargaSection');
        window.loadDashboardWarga();
    } else {
        if (savedNik && (savedNik.includes('*') || savedNik.length !== 16)) {
            localStorage.removeItem('wargaNik');
            localStorage.removeItem('wargaNama');
            localStorage.removeItem('wargaEmail');
        }
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
    if (!e.target.closest('[id^="aduan-menu-"]') && !e.target.closest('.aduan-dropdown-menu') && !e.target.closest('.btn-msg-dots') && !e.target.closest('.bubble-corner-btn')) {
        document.querySelectorAll('[id^="aduan-menu-"], .aduan-dropdown-menu').forEach(m => {
            m.style.display = 'none';
            m.classList.remove('show');
        });
    }
    if (!e.target.closest('[id^="menu-warga-"]') && !e.target.closest('.aduan-dropdown-menu') && !e.target.closest('.btn-msg-dots') && !e.target.closest('.bubble-corner-btn')) {
        document.querySelectorAll('[id^="menu-warga-"], .aduan-dropdown-menu').forEach(m => {
            m.style.display = 'none';
            m.classList.remove('show');
        });
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
