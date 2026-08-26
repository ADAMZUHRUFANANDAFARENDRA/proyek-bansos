/**
 * =========================================================================
 * GLOBAL.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS PEMKAB SIDOARJO
 * =========================================================================
 * Berisi konfigurasi API, helper autentikasi JWT, proteksi rute,
 * interceptor request fetch, dan fungsi formatting umum.
 */

// 1. KONFIGURASI BASE URL API BACKEND
const API_BASE_URL = 'http://localhost:5000';

// 2. HELPER AUTENTIKASI & MANAJEMEN SESI (JWT)
// HELPER AUTENTIKASI & MANAJEMEN SESI (JWT)
function getAuthToken() {
  let token =
      localStorage.getItem('token') ||
      localStorage.getItem('bansosToken') ||
      localStorage.getItem('access_token') ||
      '';
  if (!token || token === 'undefined' || token === 'null') return '';
  return token.replace(/^["']+|["']+$/g, '').trim();
}

function getAuthUser() {
  try {
    const user =
        localStorage.getItem('user') || localStorage.getItem('bansosUser');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, userData) {
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('bansosToken', token);
  }
  if (userData) {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('bansosUser', JSON.stringify(userData));
  }
}

function logoutUser() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// 3. INTERCEPTOR FETCH DENGAN JWT (FETCH WITH AUTH)
async function fetchWithAuth(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Jika request mengirim FormData (misal upload foto/video), biarkan browser set Content-Type secara otomatis
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, { ...options, headers });

        // Token expired atau akses tidak sah (401)
        if (response.status === 401) {
            localStorage.clear();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sesi Telah Berakhir',
                    text: 'Sesi autentikasi Anda telah habis. Silakan login kembali.',
                    confirmButtonColor: '#009846'
                }).then(() => {
                    window.location.href = 'login.html';
                });
            } else {
                alert('Sesi telah berakhir, silakan login kembali.');
                window.location.href = 'login.html';
            }
            return null;
        }

        // Akses ditolak karena role tidak mencukupi (403)
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
            }
        }

        return response;
    } catch (error) {
        console.error('Fetch API Error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Koneksi Terputus',
                text: 'Gagal terhubung ke server backend. Pastikan server Flask aktif.',
                confirmButtonColor: '#ef4444'
            });
        }
        throw error;
    }
}

// 4. GUARD / PROTEKSI HALAMAN OTOMATIS
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.toLowerCase();
    const token = getAuthToken();
    const user = getAuthUser();

    // Jika berada di halaman index/dashboard admin tanpa login
    if (currentPath.includes('index.html') || (currentPath.endsWith('/') && !currentPath.includes('login') && !currentPath.includes('publik'))) {
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Tampilkan info user di navbar jika elemen tersedia
        const userNameEl = document.querySelector('.user-name');
        const roleBadgeEl = document.querySelector('.role-badge');
        if (user && userNameEl) {
            userNameEl.textContent = user.username ? user.username.toUpperCase() : 'PETUGAS';
        }
        if (user && roleBadgeEl) {
            roleBadgeEl.textContent = user.role === 'admin' ? 'Super Admin' : 'Operator Wilayah';
            roleBadgeEl.className = `role-badge ${user.role === 'admin' ? 'role-admin' : 'role-petugas'}`;
        }
    }

    // Jika sudah login dan mencoba membuka login.html
    if (currentPath.includes('login.html') && token) {
        window.location.href = 'index.html';
    }

    // Pasang event listener untuk tombol logout otomatis jika ada
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

// 5. FUNGSI UTILITAS FORMATTING & UI
function formatRupiah(angka) {
    if (angka === null || angka === undefined) return 'Rp 0';
    const number = Number(angka);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(isNaN(number) ? 0 : number);
}

function formatDateIndo(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
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
        alert(title);
    }
}