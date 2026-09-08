/* =========================================================================
   AUTH.JS - PUSAT MANAJEMEN AUTENTIKASI, SESI & RBAC TERPADU
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   Lokasi: frontend/static/js/core/auth.js
   ========================================================================= */

(function (window) {
    'use strict';

    let logoutTimer = null;

    // Seluruh variasi kunci token dan profil untuk menjamin kompatibilitas antar-modul
    const TOKEN_KEYS = ['token', 'access_token', 'bansos_jwt_token', 'bansosToken'];
    const ROLE_KEYS = ['role', 'bansos_user_role'];
    const USER_KEYS = ['username', 'bansos_user_data', 'user', 'bansosUser'];

    // Helper notifikasi dengan fallback bawaan bila SweetAlert2 belum selesai dimuat
    const Notify = {
        fire(options) {
            if (typeof Swal !== 'undefined') {
                return Swal.fire(options);
            }
            if (options.showCancelButton) {
                const confirmed = confirm(options.title ? `${options.title}\n${options.text || ''}` : (options.text || ''));
                return Promise.resolve({ isConfirmed: confirmed });
            }
            alert(options.title ? `${options.title}\n${options.text || ''}` : (options.text || ''));
            return Promise.resolve({ isConfirmed: true });
        }
    };

    const Storage = {
        get(key) {
            try {
                const val = localStorage.getItem(key);
                return (val && val !== 'null' && val !== 'undefined') ? val.trim() : null;
            } catch (e) {
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.error('[Storage Error] Gagal menyimpan:', e);
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {}
        }
    };

    const Auth = {
        /**
         * Mengambil token JWT aktif dari seluruh variasi kunci penyimpanan
         * @returns {string|null}
         */
        getToken() {
            for (const k of TOKEN_KEYS) {
                const tk = Storage.get(k);
                if (tk) return tk.replace(/^["']+|["']+$/g, '').trim();
            }
            return null;
        },

        /**
         * Membaca dan mendekode muatan (payload) token JWT secara aman (Base64URL + UTF-8 support)
         * Dilengkapi penambahan padding '=' otomatis agar tidak memicu DOMException
         * @returns {Object|null}
         */
        getPayload() {
            const token = this.getToken();
            if (!token) return null;

            try {
                const parts = token.split('.');
                if (parts.length !== 3) return null;

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
                console.warn('[Auth] Gagal membedah payload JWT, menggunakan fallback token:', err);
                return null;
            }
        },

        /**
         * Memeriksa masa aktif token JWT dengan toleransi clock skew 60 detik
         * @returns {boolean}
         */
        isTokenExpired() {
            const payload = this.getPayload();
            if (!payload || !payload.exp) return false;
            
            const currentTimeSec = Math.floor(Date.now() / 1000);
            return payload.exp < (currentTimeSec - 60);
        },

        /**
         * Memeriksa keabsahan sesi otentikasi
         * @returns {boolean}
         */
        isAuthenticated() {
            const token = this.getToken();
            if (!token) return false;
            if (this.isTokenExpired()) {
                this.clearSession(false);
                return false;
            }
            return true;
        },

        /**
         * Mengambil role akun yang sedang aktif ('admin' atau 'operator')
         * @returns {string}
         */
        getRole() {
            for (const k of ROLE_KEYS) {
                const r = Storage.get(k);
                if (r) return r.toLowerCase().replace('petugas', 'operator');
            }
            const payload = this.getPayload();
            return (payload?.role || 'operator').toLowerCase().replace('petugas', 'operator');
        },

        /**
         * Mengambil data profil pengguna aktif
         * @returns {Object}
         */
        getUser() {
            const raw = Storage.get('bansos_user_data') || Storage.get('user');
            if (raw) {
                try { return JSON.parse(raw); } catch (e) {}
            }
            const payload = this.getPayload();
            const uname = Storage.get('username') || payload?.username || 'Aparatur';
            return {
                id: payload?.user_id || null,
                username: uname,
                nama_lengkap: uname.toUpperCase(),
                role: this.getRole()
            };
        },

        /**
         * Mendapatkan header otentikasi Bearer untuk panggilan fetch API
         * @returns {Object}
         */
        getAuthHeaders() {
            const token = this.getToken();
            return token ? { 'Authorization': `Bearer ${token}` } : {};
        },

        /**
         * Pengecekan cepat hak akses Super Admin
         * @returns {boolean}
         */
        isAdmin() {
            return this.isAuthenticated() && this.getRole() === 'admin';
        },

        /**
         * Menyimpan seluruh variasi token dan profil ke localStorage serta memicu event
         */
        setSession(token, role, userObj) {
            const cleanToken = String(token || '').replace(/^["']+|["']+$/g, '').trim();
            const userRole = (role || 'operator').toLowerCase().replace('petugas', 'operator');
            const username = userObj?.username || userObj?.nama || 'Aparatur';

            // Sinkronisasi serentak ke seluruh variasi kunci penyimpanan
            TOKEN_KEYS.forEach(k => Storage.set(k, cleanToken));
            ROLE_KEYS.forEach(k => Storage.set(k, userRole));
            Storage.set('username', username);

            const userData = {
                id: userObj?.id || null,
                username: username,
                nama_lengkap: userObj?.nama_lengkap || username.toUpperCase(),
                role: userRole
            };
            Storage.set('bansos_user_data', JSON.stringify(userData));
            Storage.set('user', JSON.stringify(userData));

            this.scheduleAutoLogout();
            this.applyRBACRules();

            window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: userData, role: userRole } }));
        },

        /**
         * Menjadwalkan logout otomatis saat masa token habis
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
                this.clearSession(true);
            }, Math.min(timeRemainingMs, 2147483647));
        },

        /**
         * Proses autentikasi login ke peladen Flask
         * @param {string} username 
         * @param {string} password 
         * @returns {Promise<Object>}
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
                    baseUrl = (window.location.port === '5500' || window.location.port === '3000') 
                        ? 'http://127.0.0.1:5000' 
                        : '';
                }

                const response = await fetch(`${baseUrl}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ username: cleanUser, password: cleanPass })
                });

                const result = await response.json();

                if (response.ok && (result.status === 'success' || result.token || result.access_token)) {
                    const token = result.token || result.access_token;
                    const role = (result.user && result.user.role) || result.role || 'operator';
                    const user = result.user || { username: cleanUser, role };

                    this.setSession(token, role, user);
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
                console.error('[Auth Error] Permintaan login gagal:', err);
                Notify.fire({
                    icon: 'error',
                    title: 'Kesalahan Sistem',
                    text: 'Tidak dapat terhubung ke peladen Flask di port 5000. Pastikan backend aktif.'
                });
                return { success: false };
            }
        },

        /**
         * Menghapus seluruh residu sesi dan mengalihkan halaman
         * @param {boolean} redirect 
         */
        clearSession(redirect = true) {
            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            TOKEN_KEYS.forEach(k => Storage.remove(k));
            ROLE_KEYS.forEach(k => Storage.remove(k));
            USER_KEYS.forEach(k => Storage.remove(k));

            window.dispatchEvent(new CustomEvent('auth:logout'));

            if (redirect && !window.location.pathname.endsWith('login.html')) {
                window.location.replace('login.html');
            }
        },

        /**
         * Konfirmasi logout terpadu
         */
        logout() {
            Notify.fire({
                title: 'Konfirmasi Keluar',
                text: 'Apakah Anda yakin ingin mengakhiri sesi dinas ini?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Keluar',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#64748b'
            }).then((res) => {
                if (res.isConfirmed) {
                    Auth.clearSession(true);
                }
            });
        },

        /**
         * Pengawal rute otentikasi halaman dan modul
         */
        requireAuth(allowedRoles = []) {
            if (!this.isAuthenticated()) {
                this.clearSession(true);
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
         * Memperbarui label profil pengguna pada navbar dan mengatur visibilitas fitur berdasarkan data-role
         */
        applyRBACRules() {
            const user = this.getUser();
            const role = this.getRole();

            const navUser = document.getElementById('navUsername') || document.getElementById('userProfileLabel');
            const navRole = document.getElementById('navRoleBadge') || document.getElementById('userRoleBadge');

            if (navUser && user) {
                navUser.textContent = (user.nama_lengkap || user.username).toUpperCase();
            }
            if (navRole) {
                navRole.textContent = role === 'admin' ? 'Administrator' : 'Petugas Lapangan';
                navRole.className = `role-badge ${role === 'admin' ? 'role-admin' : 'role-petugas'}`;
            }

            const cmdCenter = document.getElementById('adminCommandCenter');
            if (cmdCenter) {
                cmdCenter.style.display = (role === 'admin') ? 'block' : 'none';
            }

            // Seleksi dan terapkan visibilitas elemen HTML yang memiliki atribut [data-role]
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
         * Inisialisasi awal saat skrip dimuat
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

    window.Auth = Auth;
    window.logout = () => Auth.logout();
    window.getCleanToken = () => Auth.getToken();

})(window);