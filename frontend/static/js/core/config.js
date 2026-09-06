/**
 * =============================================================================
 * SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANSOS SIDOARJO
 * File: frontend/static/js/core/config.js
 * Master Configuration: Endpoint, 10 Kriteria BWM-SAW, Map, PWA & WebRTC
 * =============================================================================
 */

// 1. Deteksi Lingkungan Server (Localhost Dev vs Production Server)
const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

const BACKEND_PORT = 5000;
const DEV_BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;

// Gunakan URL Flask port 5000 jika berjalan via Live Server (5500/8080)
const BASE_ORIGIN = (isLocalhost && window.location.port !== String(BACKEND_PORT))
    ? DEV_BACKEND_URL
    : window.location.origin;

// 2. Objek Konfigurasi Global
const CONFIG = {
    // Alamat Server Layanan
    BASE_URL: BASE_ORIGIN,
    API_BASE_URL: `${BASE_ORIGIN}/api`,
    MEDIA_BASE_URL: `${BASE_ORIGIN}/uploads`,

    // Kamus Rute Endpoint RESTful API Backend
    ENDPOINTS: {
        // Autentikasi & Akun
        LOGIN: '/auth/login',
        INIT_KRITERIA: '/init-kriteria',
        USERS: '/users',
        
        // Pengelolaan Data Warga & Penyaluran
        WARGA: '/warga',
        WARGA_BULK: '/warga/bulk',
        WARGA_DELETE_ALL: '/warga/delete-all',
        BULK_VERIFY: '/warga/bulk/verify',
        BULK_UNVERIFY: '/warga/bulk/unverify',
        BUKTI_SALUR: (id) => `/warga/${id}/bukti-salur`,
        LAPOR_SENGKETA: (id) => `/warga/${id}/lapor-sengketa`,
        VERIFY_SINGLE: (id) => `/warga/${id}/verify`,
        
        // Engine SPK & Analisis Komparasi
        KRITERIA: '/kriteria',
        HITUNG_SAW: '/hitung-saw',
        HITUNG_SPK_POST: '/spk/hitung',
        KOMPARASI: '/komparasi',
        
        // Integrasi Eksternal
        DUKCAPIL: (nik) => `/dukcapil/${nik}`,
        BPS_SYNC: '/bps/sync',
        
        // Layanan Publik & Warga
        CEK_BANSOS_PUBLIK: '/publik/cek-bansos',
        PENGADUAN_PUBLIK: '/publik/pengaduan',
        
        // Media, Live Chat & Notifikasi
        CHAT_LIST: '/chat/list',
        CHAT_ROOM: (nik) => `/chat/${nik}`,
        LAPORAN_CHAT: '/laporan-chat',
        NOTIFIKASI: '/notifikasi',
        NOTIFIKASI_READ: (id) => `/notifikasi/${id}/read`
    },

    // Manajemen Kunci Penyimpanan Lokal (Local Storage)
    AUTH: {
        TOKEN_KEY: 'bansos_jwt_token',
        ROLE_KEY: 'bansos_user_role',
        USER_DATA_KEY: 'bansos_user_data',
        LOGIN_REDIRECT_URL: 'login.html',
        DASHBOARD_REDIRECT_URL: 'index.html',
        PUBLIC_REDIRECT_URL: 'publik.html'
    },

    // Metadata Standar 10 Kriteria Penilaian BWM-SAW
    KRITERIA: [
        {
            kode: 'C1',
            nama: 'Kondisi Ekonomi (Penghasilan)',
            tipe: 'cost',
            bobotDefault: 0.23,
            satuan: 'Rupiah / Bulan',
            keterangan: 'Semakin rendah penghasilan, semakin tinggi prioritas penerima bansos'
        },
        {
            kode: 'C2',
            nama: 'Kepemilikan Nilai Aset',
            tipe: 'cost',
            bobotDefault: 0.16,
            satuan: 'Estimasi Nilai Rupiah',
            keterangan: 'Akumulasi nilai aset tidak bergerak dan barang berharga'
        },
        {
            kode: 'C3',
            nama: 'Usia Kepala Keluarga',
            tipe: 'benefit',
            bobotDefault: 0.11,
            satuan: 'Tahun',
            keterangan: 'Kelompok usia rentan / lansia diprioritaskan'
        },
        {
            kode: 'C4',
            nama: 'Jenis Kelamin Kepala Keluarga',
            tipe: 'benefit',
            bobotDefault: 0.05,
            options: [
                { value: 1, label: 'Laki-laki' },
                { value: 2, label: 'Perempuan (Kepala Keluarga Tunggal / Janda)' }
            ]
        },
        {
            kode: 'C5',
            nama: 'Jumlah Tanggungan Keluarga',
            tipe: 'benefit',
            bobotDefault: 0.14,
            satuan: 'Jiwa',
            keterangan: 'Jumlah anggota keluarga yang belum memiliki penghasilan mandiri'
        },
        {
            kode: 'C6',
            nama: 'Status Pernikahan',
            tipe: 'benefit',
            bobotDefault: 0.07,
            options: [
                { value: 1, label: 'Belum Menikah' },
                { value: 2, label: 'Menikah' },
                { value: 3, label: 'Cerai Hidup / Cerai Mati' }
            ]
        },
        {
            kode: 'C7',
            nama: 'Kepemilikan Anak Usia Sekolah',
            tipe: 'benefit',
            bobotDefault: 0.09,
            satuan: 'Anak',
            keterangan: 'Jumlah anak yang sedang menempuh jenjang pendidikan formal'
        },
        {
            kode: 'C8',
            nama: 'Status Kelayakan Tempat Tinggal',
            tipe: 'benefit',
            bobotDefault: 0.10,
            options: [
                { value: 1, label: 'Milik Sendiri (Permanen)' },
                { value: 2, label: 'Sewa / Kontrak' },
                { value: 3, label: 'Numpang / Tidak Layak Huni / Bebas Sewa' }
            ]
        },
        {
            kode: 'C9',
            nama: 'Tingkat Pendidikan Terakhir',
            tipe: 'cost',
            bobotDefault: 0.03,
            options: [
                { value: 1, label: 'SD / Sederajat / Tidak Sekolah' },
                { value: 2, label: 'SMP / Sederajat' },
                { value: 3, label: 'SMA / SMK / Sederajat' },
                { value: 4, label: 'Perguruan Tinggi (Diploma / Sarjana)' }
            ]
        },
        {
            kode: 'C10',
            nama: 'Kondisi Kesehatan / Disabilitas',
            tipe: 'benefit',
            bobotDefault: 0.02,
            options: [
                { value: 1, label: 'Sehat / Produktif' },
                { value: 2, label: 'Mengidap Penyakit Kronis / Penyandang Disabilitas' }
            ]
        }
    ],

    // Klasifikasi Kelayakan & Parameter Bansos
    BANSOS: {
        DESIL_LAYAK_MAX: 4,            // Desil 1-4: Kategori berhak menerima bantuan
        DESIL_RENTAN_MAX: 7,           // Desil 5-7: Kategori pantauan kerentanan sosial
        THRESHOLD_SKOR_SAW: 0.50,      // Ambang batas nilai preferensi kelayakan
        NOMINAL_DEFAULT: 'Rp 600.000 / Beras 10 Kg',
        STATUS_SALUR: {
            PENDING: 'Pending',
            DITERIMA: 'Telah Menerima',
            SENGKETA_BELUM: 'Sengketa: Belum Terima',
            SENGKETA_INVESTIGASI: 'Sengketa: Dalam Investigasi'
        }
    },

    // Pengaturan Geospasial Kabupaten Sidoarjo (Leaflet Map)
    MAP: {
        DEFAULT_CENTER: [-7.4478, 112.7183], // Titik Pusat Kabupaten Sidoarjo
        DEFAULT_ZOOM: 12,
        MIN_ZOOM: 10,
        MAX_ZOOM: 18,
        TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        TILE_ATTRIBUTION: '&copy; OpenStreetMap contributors | Pemkab Sidoarjo Dinsos',
        // Batas Wilayah 18 Kecamatan di Kabupaten Sidoarjo
        KECAMATAN: [
            'Sidoarjo', 'Buduran', 'Candi', 'Porong', 'Krembung',
            'Tulangan', 'Tanggulangin', 'Jabon', 'Krian', 'Balongbendo',
            'Prambon', 'Tarik', 'Wonoayu', 'Sukodono', 'Gedangan',
            'Waru', 'Sedati', 'Taman'
        ]
    },

    // Ketentuan Media & Berkas Survei Lapangan
    UPLOAD: {
        MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB (Selaras dengan Flask app.py)
        ALLOWED_IMAGE_EXT: ['jpg', 'jpeg', 'png', 'webp'],
        ALLOWED_VIDEO_EXT: ['mp4', 'webm', 'mov', 'mkv'],
        ALLOWED_DOC_EXT: ['pdf', 'xlsx', 'xls', 'csv'],
        MIN_VIDEO_DURATION_SEC: 3
    },

    // Konfigurasi WebRTC / PeerJS (Survei Lapangan Live Streaming)
    WEBRTC: {
        PEER_CONFIG: {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        },
        RECORDING_MIME_TYPE: 'video/webm;codecs=vp8,opus'
    },

    // Pengaturan Progressive Web App (PWA)
    PWA: {
        CACHE_NAME: 'bansos-sidoarjo-pwa-v1',
        OFFLINE_URL: 'offline.html',
        SYNC_TAG: 'sync-survei-bansos'
    }
};

// Bekukan seluruh tingkatan objek konfigurasi agar aman dari mutasi data di browser
window.CONFIG = Object.freeze(CONFIG);