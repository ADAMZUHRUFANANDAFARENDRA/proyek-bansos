/**
 * =========================================================================
 * GLOBAL.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS PEMKAB SIDOARJO
 * Lokasi: frontend/static/js/global.js
 * =========================================================================
 * Utilitas global: Konfigurasi API, autentikasi JWT, proteksi rute,
 * interceptor fetch, integrasi SweetAlert2, dan helper formatting.
 */

// 1. KONFIGURASI BASE URL API BACKEND
const API_BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL
    : 'http://127.0.0.1:5000';
window.API_BASE_URL = API_BASE_URL;

// 2. HELPER TOKEN & DECODER JWT
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const payload = JSON.parse(jsonPayload);
        if (!payload.exp) return false;
        return payload.exp <= Math.floor(Date.now() / 1000);
    } catch (e) {
        return true;
    }
}

function getAuthToken() {
    if (window.Auth && typeof window.Auth.getToken === 'function') {
        return window.Auth.getToken();
    }
    const tokenKey = window.CONFIG?.AUTH?.TOKEN_KEY || 'bansos_jwt_token';
    const raw = localStorage.getItem(tokenKey) ||
                localStorage.getItem('token') ||
                localStorage.getItem('bansosToken') ||
                localStorage.getItem('access_token') || '';
    if (!raw || raw === 'undefined' || raw === 'null') return '';
    return raw.replace(/^["']+|["']+$/g, '').trim();
}

function getAuthUser() {
    if (window.Auth && typeof window.Auth.getUser === 'function') {
        return window.Auth.getUser();
    }
    try {
        const userKey = window.CONFIG?.AUTH?.USER_DATA_KEY || 'bansos_user_data';
        const user = localStorage.getItem(userKey) ||
                     localStorage.getItem('user') ||
                     localStorage.getItem('bansosUser');
        return user ? JSON.parse(user) : null;
    } catch (e) {
        return null;
    }
}

function setAuthSession(token, userData) {
    if (window.Auth && typeof window.Auth.setSession === 'function') {
        window.Auth.setSession(token, userData?.role || 'operator', userData);
        return;
    }
    const tokenKey = window.CONFIG?.AUTH?.TOKEN_KEY || 'bansos_jwt_token';
    const userKey = window.CONFIG?.AUTH?.USER_DATA_KEY || 'bansos_user_data';
    const roleKey = window.CONFIG?.AUTH?.ROLE_KEY || 'bansos_user_role';

    if (token) {
        localStorage.setItem(tokenKey, token);
        localStorage.setItem('token', token);
    }
    if (userData) {
        localStorage.setItem(userKey, JSON.stringify(userData));
        if (userData.role) {
            localStorage.setItem(roleKey, userData.role.toLowerCase());
        }
    }
}

function logoutUser() {
    if (window.Auth && typeof window.Auth.clearSession === 'function') {
        window.Auth.clearSession(true);
        return;
    }
    const keys = [
        'bansos_jwt_token', 'token', 'access_token', 'bansosToken',
        'bansos_user_data', 'user', 'bansosUser', 'bansos_user_role'
    ];
    keys.forEach(k => localStorage.removeItem(k));
    const target = window.CONFIG?.AUTH?.LOGIN_REDIRECT_URL || 'login.html';
    window.location.href = target;
}

// 3. RESOLUSI URL & INTERCEPTOR FETCH
function resolveApiUrl(endpoint) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const base = (window.CONFIG?.BASE_URL || API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
    return `${base}${cleanEndpoint}`;
}

async function fetchWithAuth(endpoint, options = {}) {
    const token = getAuthToken();
    const config = { ...options };
    config.headers = { ...(config.headers || {}) };

    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(config.body);
    } else if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const url = resolveApiUrl(endpoint);

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            logoutUser();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sesi Telah Berakhir',
                    text: 'Sesi autentikasi Anda telah habis. Silakan masuk kembali.',
                    confirmButtonColor: '#009846'
                }).then(() => {
                    window.location.href = window.CONFIG?.AUTH?.LOGIN_REDIRECT_URL || 'login.html';
                });
            } else {
                alert('Sesi telah berakhir, silakan login kembali.');
                window.location.href = window.CONFIG?.AUTH?.LOGIN_REDIRECT_URL || 'login.html';
            }
            return null;
        }

        if (response.status === 403) {
            const errData = await response.clone().json().catch(() => ({}));
            const msg = errData.message || 'Anda tidak memiliki hak akses untuk tindakan ini.';
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Akses Ditolak',
                    text: msg,
                    confirmButtonColor: '#ef4444'
                });
            } else {
                alert(`[AKSES DITOLAK] ${msg}`);
            }
        }

        return response;
    } catch (error) {
        console.error('Fetch API Error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Koneksi Terputus',
                text: 'Gagal terhubung ke server backend. Pastikan server aktif.',
                confirmButtonColor: '#ef4444'
            });
        } else {
            alert('Gagal terhubung ke server backend.');
        }
        throw error;
    }
}

// 4. GUARD / PROTEKSI RUTE
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.toLowerCase();
    const token = getAuthToken();
    const tokenValid = token && !isTokenExpired(token);
    const user = getAuthUser();

    const isDashboard = currentPath.includes('index.html') || 
                        (currentPath.endsWith('/') && !currentPath.includes('login') && !currentPath.includes('publik'));

    if (isDashboard) {
        if (!tokenValid) {
            logoutUser();
            return;
        }

        const userNameEl = document.querySelector('.user-name') || document.getElementById('userProfileLabel');
        const roleBadgeEl = document.querySelector('.role-badge') || document.getElementById('userRoleBadge');

        if (user && userNameEl) {
            userNameEl.textContent = (user.nama_lengkap || user.username || 'PETUGAS').toUpperCase();
        }
        if (user && roleBadgeEl) {
            const role = (user.role || 'operator').toLowerCase();
            const isAdmin = role === 'admin';
            roleBadgeEl.textContent = isAdmin ? 'Super Admin' : 'Operator Wilayah';
            roleBadgeEl.className = `role-badge ${isAdmin ? 'role-admin' : 'role-petugas'}`;
        }
    }

    if (currentPath.includes('login.html') && tokenValid) {
        window.location.href = window.CONFIG?.AUTH?.DASHBOARD_REDIRECT_URL || 'index.html';
    }

    const logoutButtons = document.querySelectorAll('#logoutBtn, .btn-logout');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Konfirmasi Keluar',
                    text: 'Apakah Anda yakin ingin keluar dari sistem?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Ya, Logout',
                    cancelButtonText: 'Batal'
                }).then((res) => {
                    if (res.isConfirmed) logoutUser();
                });
            } else {
                if (confirm('Keluar dari sistem?')) logoutUser();
            }
        });
    });
});

// 5. FUNGSI FORMATTING, SANITASI & UI
function formatRupiah(angka) {
    if (angka === null || angka === undefined || angka === '') return 'Rp 0';
    let num = angka;
    if (typeof angka === 'string') {
        const clean = angka.replace(/[^0-9,-]/g, '').replace(',', '.');
        num = parseFloat(clean);
    }
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function formatDateIndo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function safeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(icon = 'success', title = 'Berhasil!') {
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        Toast.fire({ icon, title });
    } else {
        alert(`[${icon.toUpperCase()}] ${title}`);
    }
}

// 6. EXPORT OBJECT
const Global = {
    formatRupiah,
    formatTanggal: formatDateIndo,
    formatDateIndo,
    safeHtml,
    toast: (pesan, tipe = 'info') => showToast(tipe, pesan),
    showToast,
    fetchWithAuth,
    getAuthToken,
    getAuthUser,
    setAuthSession,
    logoutUser,
    isTokenExpired
};

window.Global = Global;
window.getAuthToken = getAuthToken;
window.getAuthUser = getAuthUser;
window.setAuthSession = setAuthSession;
window.logoutUser = logoutUser;
window.fetchWithAuth = fetchWithAuth;
window.formatRupiah = formatRupiah;
window.formatDateIndo = formatDateIndo;
window.showToast = showToast;
window.safeHtml = safeHtml;