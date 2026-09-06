/**
 * config.js - Konfigurasi Global Frontend
 * Lokasi: frontend/static/js/core/config.js
 */

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

// Tentukan origin backend: gunakan port 5000 jika dev server frontend terpisah (misal Live Server)
const BACKEND_PORT = 5000;
const DEV_BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;

// Jika di-deploy dalam satu origin (via Nginx/Docker), gunakan relative URL atau window.location.origin
const BASE_ORIGIN = (isLocalhost && window.location.port !== String(BACKEND_PORT))
    ? DEV_BACKEND_URL
    : window.location.origin;

const CONFIG = {
    // Alamat Layanan Backend
    API_BASE_URL: `${BASE_ORIGIN}/api`,
    MEDIA_BASE_URL: `${BASE_ORIGIN}/uploads`,

    // Manajemen Kunci Sesi & Autentikasi
    AUTH: {
        TOKEN_KEY: 'bansos_jwt_token',
        ROLE_KEY: 'bansos_user_role',
        USER_DATA_KEY: 'bansos_user_data',
        LOGIN_REDIRECT_URL: 'login.html',
        DASHBOARD_REDIRECT_URL: 'index.html'
    },

    // Parameter SPK & Klasifikasi Warga
    SPK: {
        DESIL_LAYAK_MAX: 4,      // Desil 1-4 masuk kategori berhak bansos
        MIN_VIDEO_DURATION: 3,   // Durasi minimum video survei (detik)
        MAX_UPLOAD_SIZE_MB: 16   // Batas unggah file sesuai batas MAX_CONTENT_LENGTH di .env
    },

    // Identitas Cache Service Worker (PWA)
    PWA: {
        CACHE_NAME: 'bansos-pwa-v1',
        OFFLINE_FALLBACK: '/publik.html'
    }
};

// Bekukan objek agar nilai konfigurasi tidak sengaja termutasi di runtime browser
window.CONFIG = Object.freeze(CONFIG);