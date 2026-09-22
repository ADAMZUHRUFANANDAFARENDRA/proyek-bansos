/* =========================================================================
   AUTH.JS - PUSAT MANAJEMEN AUTENTIKASI, SESI & RBAC TERPADU
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   Lokasi: frontend/static/js/core/auth.js
   ========================================================================= */

(function (window) {
    'use strict';

    /**
     * Penanda timer internal untuk penjadwalan logout otomatis
     * Dihitung berdasarkan masa aktif timestamp exp pada payload JWT
     * @type {number|null}
     */
    let logoutTimer = null;

    /**
     * Penanda status logout manual pengguna
     * Mencegah pembersihan sesi otomatis yang dipicu oleh galat respon API
     * @type {boolean}
     */
    window.isManualLogout = false;

    /**
     * Seluruh variasi kunci token penyimpanan peramban
     * Digunakan untuk memastikan keselarasan pembacaan token antar-skrip
     * @type {string[]}
     */
    const TOKEN_KEYS = [
        'token',
        'access_token',
        'jwt_token',
        'acces_token',
        'bansos_jwt_token',
        'bansosToken'
    ];

    /**
     * Seluruh variasi kunci tingkat wewenang (role) pengguna
     * Digunakan untuk otorisasi akses menu dan tombol kendali sistem
     * @type {string[]}
     */
    const ROLE_KEYS = [
        'role',
        'user_role',
        'bansos_user_role'
    ];

    /**
     * Seluruh variasi kunci objek identitas dan data profil pengguna
     * @type {string[]}
     */
    const USER_KEYS = [
        'username',
        'bansos_user_data',
        'user',
        'current_user',
        'bansosUser'
    ];

    /**
     * Pembungkus antarmuka dialog notifikasi terpadu
     * Dilengkapi mekanisme fallback ke dialog bawaan peramban jika SweetAlert2 belum aktif
     */
    const Notify = {
        /**
         * Menampilkan kotak pesan interaktif kepada pengguna
         * @param {Object} options - Konfigurasi tampilan dialog SweetAlert2
         * @returns {Promise<Object>} Status konfirmasi aksi dari pengguna
         */
        fire(options) {
            if (typeof Swal !== 'undefined') {
                return Swal.fire(options);
            }

            if (options.showCancelButton) {
                const confirmed = confirm(
                    options.title
                        ? `${options.title}\n${options.text || ''}`
                        : (options.text || '')
                );
                return Promise.resolve({ isConfirmed: confirmed });
            }

            alert(
                options.title
                    ? `${options.title}\n${options.text || ''}`
                    : (options.text || '')
            );
            return Promise.resolve({ isConfirmed: true });
        }
    };

    /**
     * Pengelola penyimpanan lokal terisolasi dari kegagalan akses peramban
     * Mengamankan operasi baca, tulis, dan hapus pada localStorage
     */
    const Storage = {
        /**
         * Mengambil data string dari localStorage dengan sanitasi nilai null dan undefined
         * @param {string} key - Nama kunci penyimpanan
         * @returns {string|null} Nilai bersih atau null jika tidak tersedia
         */
        get(key) {
            try {
                const val = localStorage.getItem(key);
                return (val && val !== 'null' && val !== 'undefined') ? val.trim() : null;
            } catch (e) {
                console.warn(`[Storage Warning] Akses baca gagal untuk kunci: ${key}`, e);
                return null;
            }
        },

        /**
         * Menyimpan pasangan kunci dan nilai ke dalam localStorage secara aman
         * @param {string} key - Nama kunci penyimpanan
         * @param {string} value - Nilai data yang akan disimpan
         */
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.error(`[Storage Error] Gagal menulis ke kunci: ${key}`, e);
            }
        },

        /**
         * Menghapus nilai kunci tertentu dari penyimpanan localStorage
         * @param {string} key - Nama kunci yang akan dihapus
         */
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`[Storage Warning] Gagal menghapus kunci: ${key}`, e);
            }
        }
    };

    /**
     * Modul Utama Autentikasi, Pengelolaan Sesi dan Otorisasi Berbasis Peran (RBAC)
     */
    const Auth = {
        /**
         * Mengambil token otentikasi aktif dari seluruh variasi kunci penyimpanan
         * Membersihkan karakter pembungkus tanda kutip yang sering terbawa dari serialisasi JSON
         * @returns {string|null} Token bersih yang siap disisipkan ke header Authorization
         */
        getToken() {
            for (const k of TOKEN_KEYS) {
                const tk = Storage.get(k);
                if (tk) {
                    return tk.replace(/^["']+|["']+$/g, '').trim();
                }
            }
            return null;
        },

        /**
         * Membaca dan mendekode muatan payload token JWT secara aman
         * Dilengkapi penambahan padding '=' otomatis dan konversi UTF-8 untuk mencegah kesalahan DOMException
         * @returns {Object|null} Objek payload JWT atau null jika token bukan format JWT standar
         */
        getPayload() {
            const token = this.getToken();
            if (!token) {
                return null;
            }

            try {
                const parts = token.split('.');
                // Token sesi lokal peladen non-JWT (bukan 3 bagian) dilewati dengan aman
                if (parts.length !== 3) {
                    return null;
                }

                let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                while (base64.length % 4) {
                    base64 += '=';
                }

                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );
                return JSON.parse(jsonPayload);
            } catch (err) {
                console.warn('[Auth] Gagal mendekode payload token, beralih ke sesi peladen lokal:', err);
                return null;
            }
        },

        /**
         * Memeriksa apakah token JWT telah melewati batas waktu masa aktif
         * Dilengkapi toleransi pergeseran waktu sistem (clock skew) sebesar 60 detik
         * @returns {boolean} Status kedaluwarsa token
         */
        isTokenExpired() {
            const payload = this.getPayload();
            if (!payload || !payload.exp) {
                // Token sesi lokal tanpa exp diasumsikan tetap aktif selama tersimpan di peramban
                return false;
            }

            const currentTimeSec = Math.floor(Date.now() / 1000);
            return payload.exp < (currentTimeSec - 60);
        },

        /**
         * Memeriksa keabsahan status login pengguna saat ini
         * Memastikan keberadaan token aktif di media penyimpanan peramban
         * @returns {boolean} True jika pengguna memiliki token valid
         */
        isAuthenticated() {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            if (this.isTokenExpired()) {
                console.warn('[Auth] Token JWT telah melampaui masa aktif.');
                this.clearSession(false);
                return false;
            }

            return true;
        },

        /**
         * Mengambil tingkatan hak akses akun yang sedang aktif
         * Menstandarisasi penamaan peran 'petugas' menjadi 'operator'
         * @returns {string} Peran akun pengguna ('admin' atau 'operator')
         */
        getRole() {
            for (const k of ROLE_KEYS) {
                const r = Storage.get(k);
                if (r) {
                    return r.toLowerCase().replace('petugas', 'operator');
                }
            }

            const payload = this.getPayload();
            if (payload?.role) {
                return payload.role.toLowerCase().replace('petugas', 'operator');
            }

            return 'admin';
        },

        /**
         * Mengambil profil lengkap pengguna dari penyimpanan atau muatan token
         * @returns {Object} Objek data identitas pengguna
         */
        getUser() {
            const raw = Storage.get('bansos_user_data') ||
                        Storage.get('user') ||
                        Storage.get('current_user');

            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    console.warn('[Auth] Gagal membedah objek user JSON, menggunakan data cadangan.');
                }
            }

            const payload = this.getPayload();
            const uname = Storage.get('username') || payload?.username || 'ADMIN';

            return {
                id: payload?.user_id || 1,
                username: uname,
                nama_lengkap: uname.toUpperCase(),
                role: this.getRole()
            };
        },

        /**
         * Menghasilkan header otentikasi Bearer standar untuk disisipkan ke panggilan Fetch API
         * @returns {Object} Objek header otentikasi
         */
        getAuthHeaders() {
            const token = this.getToken();
            return token ? { 'Authorization': `Bearer ${token}` } : {};
        },

        /**
         * Memeriksa apakah pengguna memiliki hak akses penuh sebagai Administrator
         * @returns {boolean} True jika akun memiliki tingkatan admin
         */
        isAdmin() {
            return this.getRole() === 'admin';
        },

        /**
         * Menyimpan seluruh variasi token dan profil ke localStorage dan sessionStorage
         * Memastikan data terbaca secara redundan di semua modul dasbor
         * @param {string} token - Token otentikasi dari backend
         * @param {string} role - Tingkat hak akses akun
         * @param {Object} userObj - Objek identitas profil akun
         */
        setSession(token, role, userObj) {
            const cleanToken = String(token || '').replace(/^["']+|["']+$/g, '').trim();
            const userRole = (role || 'admin').toLowerCase().replace('petugas', 'operator');
            const username = userObj?.username || userObj?.nama || 'Aparatur';

            // Sinkronisasi menyeluruh ke seluruh daftar kunci token penyimpanan
            TOKEN_KEYS.forEach(k => Storage.set(k, cleanToken));
            ROLE_KEYS.forEach(k => Storage.set(k, userRole));
            Storage.set('username', username);

            const userData = {
                id: userObj?.id || 1,
                username: username,
                nama_lengkap: userObj?.nama_lengkap || username.toUpperCase(),
                role: userRole
            };

            USER_KEYS.forEach(k => {
                if (k === 'username') {
                    Storage.set(k, username);
                } else {
                    Storage.set(k, JSON.stringify(userData));
                }
            });

            // Cadangkan ke sessionStorage untuk stabilitas navigasi antar-tab
            try {
                sessionStorage.setItem('token', cleanToken);
                sessionStorage.setItem('access_token', cleanToken);
                sessionStorage.setItem('role', userRole);
                sessionStorage.setItem('user', JSON.stringify(userData));
            } catch (e) {
                console.warn('[Auth] Penulisan data cadangan sessionStorage dibatasi oleh peramban.');
            }

            this.scheduleAutoLogout();
            this.applyRBACRules();

            window.dispatchEvent(
                new CustomEvent('auth:login', {
                    detail: { user: userData, role: userRole }
                })
            );
        },

        /**
         * Menjadwalkan logout otomatis saat masa aktif token JWT peladen habis
         */
        scheduleAutoLogout() {
            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            const payload = this.getPayload();
            if (!payload || !payload.exp) return;

            const timeRemainingMs = (payload.exp * 1000) - Date.now();
            if (timeRemainingMs <= 0) return;

            logoutTimer = setTimeout(() => {
                alert('Sesi masuk Anda telah kedaluwarsa demi keamanan. Silakan login kembali.');
                window.isManualLogout = true;
                this.clearSession(true);
            }, Math.min(timeRemainingMs, 2147483647));
        },

        /**
         * Mengirimkan kredensial masuk ke backend peladen Flask
         * @param {string} username - Nama pengguna
         * @param {string} password - Kata sandi akun
         * @returns {Promise<Object>} Objek status keberhasilan login
         */
        async login(username, password) {
            const cleanUser = String(username || '').trim();
            const cleanPass = String(password || '').trim();

            if (!cleanUser || !cleanPass) {
                Notify.fire({
                    icon: 'warning',
                    title: 'Peringatan',
                    text: 'Username dan kata sandi wajib diisi!'
                });
                return { success: false };
            }

            try {
                let baseUrl = window.API_BASE_URL || (window.CONFIG && window.CONFIG.BASE_URL);
                if (!baseUrl) {
                    const currentPort = window.location.port;
                    const supportedPorts = ['5500', '5501', '3000', '8080'];
                    if (supportedPorts.includes(currentPort)) {
                        baseUrl = 'http://127.0.0.1:5000';
                    } else {
                        baseUrl = 'http://127.0.0.1:5000';
                    }
                }

                // 1. Percobaan pengiriman ke rute API resmi
                let response = await fetch(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ username: cleanUser, password: cleanPass })
                }).catch(() => null);

                // 2. Rute alternatif fallback
                if (!response || !response.ok) {
                    response = await fetch(`${baseUrl}/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ username: cleanUser, password: cleanPass })
                    });
                }

                const result = await response.json();

                if (response.ok && (result.status === 'success' || result.token || result.access_token || result.jwt_token || result.acces_token)) {
                    const token = result.token ||
                                  result.access_token ||
                                  result.jwt_token ||
                                  result.acces_token ||
                                  (result.data && (result.data.token || result.data.access_token));

                    const userObj = result.user ||
                                    result.current_user ||
                                    (result.data && result.data.user) ||
                                    { username: cleanUser };

                    const role = (userObj.role || result.role || result.user_role || 'admin').toLowerCase();

                    this.setSession(token, role, userObj);
                    return { success: true, user: cleanUser, role };
                } else {
                    Notify.fire({
                        icon: 'error',
                        title: 'Gagal Masuk',
                        text: result.message || 'Username atau kata sandi tidak sesuai.'
                    });
                    return { success: false };
                }
            } catch (err) {
                console.error('[Auth Error] Permintaan autentikasi gagal dihubungi:', err);
                Notify.fire({
                    icon: 'error',
                    title: 'Kesalahan Sistem',
                    text: 'Tidak dapat terhubung ke peladen Flask di port 5000. Pastikan backend aktif.'
                });
                return { success: false };
            }
        },

        /**
         * Pembersihan Sesi Terkendali
         * Hanya mengeksekusi pengalihan jika dipicu oleh logout manual resmi
         * @param {boolean} redirect - Status pengalihan otomatis ke login.html
         */
        clearSession(redirect = true) {
            // Abaikan panggilan otomatis dari galat API agar dasbor tidak terpental
            if (!window.isManualLogout) {
                console.warn('[Auth Guard] Panggilan pembersihan otomatis dicegah demi stabilitas dasbor.');
                return;
            }

            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            TOKEN_KEYS.forEach(k => Storage.remove(k));
            ROLE_KEYS.forEach(k => Storage.remove(k));
            USER_KEYS.forEach(k => Storage.remove(k));

            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {}

            window.dispatchEvent(new CustomEvent('auth:logout'));

            if (redirect) {
                window.location.replace('login.html');
            }
        },

        /**
         * Logout Resmi Sistem
         * Menghapus penyimpanan dan mengalihkan ke halaman login secara instan
         */
        logout() {
            window.isManualLogout = true;
            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            TOKEN_KEYS.forEach(k => Storage.remove(k));
            ROLE_KEYS.forEach(k => Storage.remove(k));
            USER_KEYS.forEach(k => Storage.remove(k));

            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {}

            window.location.replace('login.html');
        },

        /**
         * Pengawal rute navigasi modul dasbor berdasarkan peran pengguna
         * @param {string[]} allowedRoles - Daftar tingkatan peran yang diizinkan
         * @returns {boolean} Status perizinan akses modul
         */
        requireAuth(allowedRoles = []) {
            if (!this.isAuthenticated()) {
                window.location.replace('login.html');
                return false;
            }

            const currentRole = this.getRole();
            if (allowedRoles.length > 0) {
                const normAllowed = allowedRoles.map(r => r.toLowerCase().replace('petugas', 'operator'));
                if (!normAllowed.includes(currentRole)) {
                    Notify.fire({
                        icon: 'error',
                        title: 'Akses Ditolak',
                        text: 'Anda tidak memiliki wewenang untuk membuka modul ini.'
                    }).then(() => {
                        window.location.replace('index.html');
                    });
                    return false;
                }
            }

            this.applyRBACRules();
            return true;
        },

        /**
         * Memperbarui label profil pada navbar dan mengatur visibilitas fitur berdasarkan atribut data-role
         */
        applyRBACRules() {
            const user = this.getUser();
            const role = this.getRole();

            const navUser = document.getElementById('navUsername') ||
                            document.getElementById('userProfileLabel');
            const navRole = document.getElementById('navRoleBadge') ||
                            document.getElementById('userRoleBadge');

            if (navUser && user) {
                navUser.textContent = (user.nama_lengkap || user.username || 'ADMIN').toUpperCase();
            }
            if (navRole) {
                navRole.textContent = role === 'admin' ? 'Administrator' : 'Petugas Lapangan';
                navRole.className = `role-badge ${role === 'admin' ? 'role-admin' : 'role-petugas'}`;
            }

            const cmdCenter = document.getElementById('adminCommandCenter');
            if (cmdCenter) {
                cmdCenter.style.display = (role === 'admin') ? 'block' : 'none';
            }

            // Memeriksa seluruh elemen antarmuka yang memiliki pembatasan data-role
            document.querySelectorAll('[data-role]').forEach(el => {
                const allowed = el.getAttribute('data-role')
                    .toLowerCase()
                    .split(',')
                    .map(r => r.trim().replace('petugas', 'operator'));

                if (!allowed.includes(role)) {
                    el.style.display = 'none';
                    el.setAttribute('aria-hidden', 'true');
                } else {
                    el.style.removeProperty('display');
                    el.removeAttribute('aria-hidden');
                }
            });
        },

        /**
         * Inisialisasi awal saat skrip auth dimuat oleh peramban
         */
        init() {
            if (this.isAuthenticated()) {
                this.scheduleAutoLogout();
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.applyRBACRules());
                } else {
                    this.applyRBACRules();
                }
            }
        }
    };

    Auth.init();

    // Registrasi objek secara global untuk integrasi antar-skrip dasbor
    window.Auth = Auth;
    window.logout = function () {
        window.isManualLogout = true;
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('login.html');
    };
    window.getCleanToken = () => Auth.getToken();

})(window);