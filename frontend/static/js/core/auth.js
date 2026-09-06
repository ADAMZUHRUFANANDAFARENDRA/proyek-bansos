/**
 * =============================================================================
 * SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANSOS SIDOARJO
 * File: frontend/static/js/core/auth.js
 * Comprehensive JWT Authentication, Session Guard, RBAC & State Manager
 * =============================================================================
 */

(function (window) {
    'use strict';

    // Timer internal untuk penjadwalan logout otomatis saat token kedaluwarsa
    let logoutTimer = null;

    // Utilitas penyimpanan aman (mencegah crash pada mode privat / incognito)
    const Storage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn('[Storage Error] Gagal membaca localStorage:', e);
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn('[Storage Error] Gagal menyimpan ke localStorage:', e);
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn('[Storage Error] Gagal menghapus dari localStorage:', e);
            }
        }
    };

    const Auth = {
        /**
         * Mengambil token JWT aktif dari penyimpanan lokal
         * @returns {string|null}
         */
        getToken() {
            const key = window.CONFIG?.AUTH?.TOKEN_KEY || 'bansos_jwt_token';
            const token = Storage.get(key);
            if (!token || token === 'null' || token === 'undefined') {
                return null;
            }
            return token;
        },

        /**
         * Mengambil hak akses (role) pengguna aktif ('admin' atau 'operator')
         * @returns {string}
         */
        getRole() {
            const key = window.CONFIG?.AUTH?.ROLE_KEY || 'bansos_user_role';
            const role = Storage.get(key);
            if (role) return role.toLowerCase();
            
            // Fallback: Ekstrak role langsung dari payload JWT jika localStorage kosong
            const payload = this.getPayload();
            return (payload?.role || 'operator').toLowerCase();
        },

        /**
         * Mengambil objek data profil pengguna aktif
         * @returns {Object|null}
         */
        getUser() {
            const key = window.CONFIG?.AUTH?.USER_DATA_KEY || 'bansos_user_data';
            const raw = Storage.get(key);
            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    console.error('[Auth Error] Format data pengguna korup:', e);
                }
            }

            // Fallback: Bentuk profil minimal dari klaim token JWT
            const payload = this.getPayload();
            if (payload) {
                return {
                    id: payload.user_id,
                    username: payload.username,
                    nama_lengkap: payload.nama_lengkap || payload.username,
                    role: payload.role || 'operator'
                };
            }
            return null;
        },

        /**
         * Membaca dan mendekode muatan (payload) token JWT tanpa pustaka eksternal
         * @returns {Object|null}
         */
        getPayload() {
            const token = this.getToken();
            if (!token) return null;

            try {
                const parts = token.split('.');
                if (parts.length !== 3) return null;

                // Decode Base64URL ke format string UTF-8 standar
                const base64Url = parts[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );
                return JSON.parse(jsonPayload);
            } catch (err) {
                console.error('[Auth Error] Gagal membedah token JWT:', err);
                return null;
            }
        },

        /**
         * Memeriksa apakah token telah melewati batas kedaluwarsa (exp)
         * @returns {boolean}
         */
        isTokenExpired() {
            const payload = this.getPayload();
            if (!payload || !payload.exp) {
                return true;
            }
            const currentTimeSec = Math.floor(Date.now() / 1000);
            return payload.exp <= currentTimeSec;
        },

        /**
         * Memvalidasi status autentikasi aktif pengguna
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
         * Pengecekan cepat hak akses Administrator
         * @returns {boolean}
         */
        isAdmin() {
            return this.isAuthenticated() && this.getRole() === 'admin';
        },

        /**
         * Pengecekan hak akses Petugas Lapangan / Operator
         * @returns {boolean}
         */
        isOperator() {
            const role = this.getRole();
            return this.isAuthenticated() && (role === 'operator' || role === 'petugas');
        },

        /**
         * Memverifikasi apakah pengguna memiliki salah satu dari daftar peran yang ditentukan
         * @param {string|string[]} roles 
         * @returns {boolean}
         */
        hasRole(roles) {
            if (!this.isAuthenticated()) return false;
            const currentRole = this.getRole();
            if (Array.isArray(roles)) {
                return roles.map(r => r.toLowerCase()).includes(currentRole);
            }
            return currentRole === String(roles).toLowerCase();
        },

        /**
         * Menghasilkan header Authorization Bearer untuk komunikasi API
         * @returns {Object}
         */
        getAuthHeaders() {
            const token = this.getToken();
            return token ? { 'Authorization': `Bearer ${token}` } : {};
        },

        /**
         * Menyimpan sesi baru setelah login berhasil dan mengatur jadwal kedaluwarsa
         * @param {string} token 
         * @param {string} role 
         * @param {Object} user 
         */
        setSession(token, role, user) {
            const authCfg = window.CONFIG?.AUTH || {};
            Storage.set(authCfg.TOKEN_KEY || 'bansos_jwt_token', token);
            Storage.set(authCfg.ROLE_KEY || 'bansos_user_role', (role || 'operator').toLowerCase());
            
            const userData = user || {
                username: 'Aparatur',
                nama_lengkap: 'Petugas Dinsos',
                role: role || 'operator'
            };
            Storage.set(authCfg.USER_DATA_KEY || 'bansos_user_data', JSON.stringify(userData));

            // Jadwalkan logout otomatis berdasarkan sisa masa berlaku token
            this.scheduleAutoLogout();

            // Emit event kustom ke jendela browser untuk reaktivitas UI
            window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: userData, role } }));
        },

        /**
         * Menjadwalkan penghentian sesi otomatis ketika masa berlaku token habis
         */
        scheduleAutoLogout() {
            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            const payload = this.getPayload();
            if (!payload || !payload.exp) return;

            const timeRemainingMs = (payload.exp * 1000) - Date.now();
            if (timeRemainingMs <= 0) {
                this.clearSession(true);
                return;
            }

            // Pasang timer (maksimal ~24 jam untuk presisi setTimeout JS)
            const safeTimeout = Math.min(timeRemainingMs, 2147483647);
            logoutTimer = setTimeout(() => {
                alert('Sesi masuk Anda telah kedaluwarsa demi keamanan. Silakan login kembali.');
                this.clearSession(true);
            }, safeTimeout);
        },

        /**
         * Menghapus sesi kredensial dan mengarahkan pengguna ke pintu masuk otentikasi
         * @param {boolean} redirect 
         */
        clearSession(redirect = true) {
            if (logoutTimer) {
                clearTimeout(logoutTimer);
                logoutTimer = null;
            }

            const authCfg = window.CONFIG?.AUTH || {};
            Storage.remove(authCfg.TOKEN_KEY || 'bansos_jwt_token');
            Storage.remove(authCfg.ROLE_KEY || 'bansos_user_role');
            Storage.remove(authCfg.USER_DATA_KEY || 'bansos_user_data');

            window.dispatchEvent(new CustomEvent('auth:logout'));

            if (redirect) {
                const redirectTarget = authCfg.LOGIN_REDIRECT_URL || 'login.html';
                if (!window.location.pathname.endsWith(redirectTarget)) {
                    window.location.replace(redirectTarget);
                }
            }
        },

        /**
         * Penjaga Rute Masuk: Mencegah akses ke halaman internal bagi pengguna anonim
         * @param {string[]} allowedRoles Daftar role yang diizinkan (opsional)
         * @returns {boolean}
         */
        requireAuth(allowedRoles = []) {
            const authCfg = window.CONFIG?.AUTH || {};

            if (!this.isAuthenticated()) {
                this.clearSession(false);
                window.location.replace(authCfg.LOGIN_REDIRECT_URL || 'login.html');
                return false;
            }

            // Normalisasi alias hak akses ('operator' dan 'petugas' setara)
            const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().replace('petugas', 'operator'));
            const currentRole = this.getRole().replace('petugas', 'operator');

            if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(currentRole)) {
                alert('Akses Dibatasi: Anda tidak memiliki otoritas kedinasan untuk mengakses panel ini.');
                window.location.replace(authCfg.DASHBOARD_REDIRECT_URL || 'index.html');
                return false;
            }

            this.applyRBACRules();
            return true;
        },

        /**
         * Penjaga Halaman Login: Mencegah aparatur yang sudah memiliki sesi mengakses halaman login lagi
         */
        requireGuest() {
            if (this.isAuthenticated()) {
                const target = window.CONFIG?.AUTH?.DASHBOARD_REDIRECT_URL || 'index.html';
                window.location.replace(target);
            }
        },

        /**
         * Penerapan Aturan Visibilitas Elemen DOM Berdasarkan Atribut Data Role
         * Contoh di HTML: <button data-role="admin">Hitung SPK</button>
         */
        applyRBACRules() {
            const currentRole = this.getRole().replace('petugas', 'operator');

            // Render label profil pengguna di navbar/header jika elemen tersedia
            const user = this.getUser();
            const labelProfile = document.getElementById('userProfileLabel');
            const badgeRole = document.getElementById('userRoleBadge');

            if (labelProfile && user) {
                labelProfile.textContent = user.nama_lengkap || user.username;
            }
            if (badgeRole) {
                badgeRole.textContent = currentRole.toUpperCase();
            }

            // Sembunyikan atau tampilkan elemen berdasarkan izin data-role
            document.querySelectorAll('[data-role]').forEach(el => {
                const targetRoles = el.getAttribute('data-role')
                    .toLowerCase()
                    .split(',')
                    .map(r => r.trim().replace('petugas', 'operator'));

                if (!targetRoles.includes(currentRole)) {
                    el.style.display = 'none';
                    el.setAttribute('aria-hidden', 'true');
                } else {
                    el.style.removeProperty('display');
                    el.removeAttribute('aria-hidden');
                }
            });
        },

        /**
         * Inisialisasi Otomatis Modul Autentikasi
         */
        init() {
            if (this.isAuthenticated()) {
                this.scheduleAutoLogout();
                document.addEventListener('DOMContentLoaded', () => {
                    this.applyRBACRules();
                });
            }
        }
    };

    // Jalankan siklus hidup awal otentikasi
    Auth.init();

    // Daftarkan modul ke objek global browser
    window.Auth = Auth;

})(window);