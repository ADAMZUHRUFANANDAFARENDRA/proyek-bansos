/**
 * =========================================================================
 * GLOBAL.JS - SISTEM PENDUKUNG KEPUTUSAN BANSOS PEMKAB SIDOARJO
 * Lokasi: frontend/static/js/global.js
 * =========================================================================
 * Utilitas global: Konfigurasi API, autentikasi JWT, proteksi rute,
 * interceptor fetch aman galat 500, helper formatting, modal base,
 * dan custom select dropdown rounded.
 */

// 1. KONFIGURASI BASE URL API BACKEND
const API_BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL : window.location.origin;
window.API_BASE_URL = API_BASE_URL;
window.BASE_URL = API_BASE_URL;
window.BASE_API_URL = API_BASE_URL;

// 2. HELPER TOKEN & DECODER JWT
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
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
        return false;
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
    window.location.replace(target);
}

// 3. RESOLUSI URL & INTERCEPTOR FETCH
function resolveApiUrl(endpoint) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const base = (window.CONFIG?.BASE_URL || API_BASE_URL || window.location.origin).replace(/\/+$/, '');
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
            console.warn(`[Fetch 401] Akses belum diotorisasi untuk: ${url}. Sesi dasbor dipertahankan.`);
            return response;
        }

        if (response.status >= 500) {
            console.warn(`[Fetch Server Error ${response.status}] Endpoint ${url} mengalami kendala internal peladen.`);
            return response;
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
        return null;
    }
}

/**
 * Pemanggilan Data Warga Terpadu dengan Fallback Aman Respon Galat 500
 * @returns {Promise<Array>}
 */
async function muatDataWargaGlobal() {
    try {
        const baseUrl = (window.CONFIG?.BASE_URL || API_BASE_URL || window.location.origin).replace(/\/+$/, '');
        const token = getAuthToken();
        const headers = { 'Accept': 'application/json' };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${baseUrl}/warga?_t=${Date.now()}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            console.warn(`[Backend Warning] Endpoint /warga mengembalikan status ${response.status}. Menyiapkan array cadangan.`);
            return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
        console.warn('[Fetch Warning] Gagal memuat data warga dari backend:', error);
        return [];
    }
}

// 4. GUARD / PROTEKSI RUTE
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.toLowerCase();
    const token = getAuthToken();
    const tokenValid = !!token;
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
            userNameEl.textContent = (user.nama_lengkap || user.username || 'ADMIN').toUpperCase();
        }
        if (user && roleBadgeEl) {
            const role = (user.role || 'admin').toLowerCase();
            const isAdmin = role === 'admin';
            roleBadgeEl.textContent = isAdmin ? 'Super Admin' : 'Operator Wilayah';
            roleBadgeEl.className = `role-badge ${isAdmin ? 'role-admin' : 'role-petugas'}`;
        }
    }

    if (currentPath.includes('login.html') && tokenValid) {
        window.location.replace(window.CONFIG?.AUTH?.DASHBOARD_REDIRECT_URL || 'index.html');
    }

    const logoutButtons = document.querySelectorAll('#logoutBtn, .btn-logout, .btn-logout-nav');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
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

// 6. HELPER GLOBAL: CUSTOM SELECT DROPDOWN & MODAL BASE
window.openModal = function(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'flex';
};

window.closeModal = function(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
};

function applyCustomRoundedDropdowns() {
    document.querySelectorAll('select.custom-rounded-select').forEach(select => {
        if (select.dataset.customized === 'true') return;
        select.dataset.customized = 'true';
        select.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        const selectedOpt = select.options[select.selectedIndex] || select.options[0];
        trigger.innerHTML = `<span>${selectedOpt ? selectedOpt.text : 'Pilih opsi...'}</span><i class="fas fa-chevron-down"></i>`;
        wrapper.appendChild(trigger);

        const optionsBox = document.createElement('div');
        optionsBox.className = 'custom-select-options';

        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'custom-option' + (opt.selected ? ' selected' : '');
            item.dataset.value = opt.value;
            item.innerText = opt.text;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                select.dispatchEvent(new Event('change'));

                trigger.querySelector('span').innerText = opt.text;
                optionsBox.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                item.classList.add('selected');
                wrapper.classList.remove('open');
            });

            optionsBox.appendChild(item);
        });

        wrapper.appendChild(optionsBox);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
            if (!isOpen) wrapper.classList.add('open');
        });

        select.addEventListener('change', () => {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption && trigger.querySelector('span')) {
                trigger.querySelector('span').innerText = selectedOption.text;
            }
            optionsBox.querySelectorAll('.custom-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.value === select.value);
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
    });
}

window.applyCustomRoundedDropdowns = applyCustomRoundedDropdowns;
document.addEventListener('DOMContentLoaded', applyCustomRoundedDropdowns);

// 7. SISTEM ANIMASI LOADING MODERN & PEMBATALAN AKTIVITAS TERPADU
window.showModernLoadingAlert = function (options = {}) {
    if (typeof Swal === 'undefined') {
        const fallbackCtrl = new AbortController();
        return {
            updateProgress: () => {},
            setStage: () => {},
            isCancelled: () => false,
            abortController: fallbackCtrl,
            abortSignal: fallbackCtrl.signal,
            close: () => {}
        };
    }

    const abortController = options.abortController || new AbortController();
    let isCancelled = false;

    // Deteksi otomatis jika operasi adalah bulk (data banyak) atau single (data sedikit)
    let totalItems = options.totalItems || 0;
    if (!totalItems && Array.isArray(options.data)) {
        totalItems = options.data.length;
    }
    if (!totalItems) {
        const textToSearch = `${options.title || ''} ${options.text || ''} ${options.subtitle || ''}`;
        const match = textToSearch.match(/(\d+)\s+data/i);
        if (match) {
            totalItems = parseInt(match[1], 10);
        }
    }

    const isBulk = options.isBulk !== undefined ? options.isBulk : (totalItems >= 15);
    const subtitle = options.subtitle || options.text || '';
    const initialStage = options.initialStage || (isBulk ? 'Menyiapkan antrean data...' : 'Menghubungkan ke peladen...');
    const cancelLabel = options.cancelText || (isBulk ? 'Batalkan Proses' : 'Batalkan');

    let htmlContent = '';
    if (isBulk) {
        htmlContent = `
            <div class="modern-bulk-container" id="swalModernLoadingContent">
                ${subtitle ? `<div style="font-size:0.88rem; color:#475569; margin-bottom:12px; line-height:1.45;">${safeHtml(subtitle)}</div>` : ''}
                <div class="modern-bulk-header-stat">
                    <div class="modern-bulk-percent-wrap">
                        <span class="modern-bulk-percent-num" id="swalBulkPercent">0</span>
                        <span class="modern-bulk-percent-sign">%</span>
                    </div>
                    <div class="modern-bulk-count-badge" id="swalBulkCountBadge">
                        <i class="fas fa-list-check" style="color:#009846;"></i>
                        <span id="swalBulkProcessed">0</span> / <span id="swalBulkTotal">${totalItems || '?'}</span> Data
                    </div>
                </div>
                <div class="modern-bulk-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="modern-bulk-fill" id="swalBulkFill" style="width: 0%;"></div>
                </div>
                <div class="modern-bulk-stage-pill" id="swalBulkStage">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <span id="swalBulkStageText">${safeHtml(initialStage)}</span>
                </div>
                <div class="modern-bulk-cancel-note">
                    <i class="fas fa-info-circle mr-1"></i> Klik <b>Batalkan Proses</b> atau tombol <b>(X)</b> untuk menghentikan penginputan kapan saja.
                </div>
            </div>
        `;
    } else {
        htmlContent = `
            <div class="modern-single-container" id="swalModernLoadingContent">
                <div class="modern-single-loader">
                    <div class="loader-glow"></div>
                    <div class="loader-track"></div>
                    <div class="loader-ring"></div>
                    <div class="loader-ring-inner"></div>
                    <div class="loader-core">
                        <i class="fas fa-sync-alt fa-spin"></i>
                    </div>
                </div>
                ${subtitle ? `<div class="modern-single-subtext">${safeHtml(subtitle)}</div>` : ''}
                <div class="modern-single-stage-pill" id="swalSingleStage">
                    <i class="fas fa-shield-alt"></i>
                    <span id="swalSingleStageText">${safeHtml(initialStage)}</span>
                </div>
                <div class="modern-bulk-cancel-note" style="margin-top:10px;">
                    <i class="fas fa-info-circle mr-1"></i> Tekan <b>Batalkan</b> atau <b>(X)</b> jika ingin membatalkan aktivitas ini.
                </div>
            </div>
        `;
    }

    const swalPromise = Swal.fire({
        title: options.title || 'Sedang Memproses...',
        html: htmlContent,
        showConfirmButton: false, // MUTLAK HILANGKAN TOMBOL OKE!
        showCancelButton: options.canCancel !== false,
        cancelButtonText: `<i class="fas fa-times mr-1"></i> ${cancelLabel}`,
        showCloseButton: options.canCancel !== false,
        allowOutsideClick: false,
        allowEscapeKey: options.canCancel !== false,
        focusCancel: true,
        customClass: {
            popup: 'swal-modern-rounded swal-modern-loading-card',
            cancelButton: 'swal-btn-pill-cancel',
            closeButton: 'swal-close-btn'
        },
        didOpen: (popup) => {
            const nativeLoader = popup.querySelector('.swal2-loader');
            if (nativeLoader) nativeLoader.style.display = 'none';
            if (typeof options.didOpen === 'function') {
                try { options.didOpen(popup); } catch (e) {}
            }
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel || 
            result.dismiss === Swal.DismissReason.close || 
            result.dismiss === Swal.DismissReason.esc) {
            isCancelled = true;
            try { abortController.abort('Proses dibatalkan oleh pengguna'); } catch (e) {}
            if (typeof options.onCancel === 'function') {
                try { options.onCancel(); } catch (e) {}
            }
            if (options.showCancelNotice !== false) {
                showToast('info', 'Aktivitas berhasil dibatalkan oleh pengguna.');
            }
        }
        return result;
    });

    const handle = {
        swalPromise,
        updateProgress: (current, total, stageText) => {
            const maxTot = total || totalItems || 1;
            const pct = Math.min(100, Math.max(0, Math.round((current / maxTot) * 100)));
            const pctEl = document.getElementById('swalBulkPercent');
            const fillEl = document.getElementById('swalBulkFill');
            const procEl = document.getElementById('swalBulkProcessed');
            const totEl = document.getElementById('swalBulkTotal');
            const stageEl = document.getElementById('swalBulkStageText') || document.getElementById('swalSingleStageText');
            
            if (pctEl) pctEl.innerText = String(pct);
            if (fillEl) fillEl.style.width = `${pct}%`;
            if (procEl) procEl.innerText = String(current);
            if (totEl && total) totEl.innerText = String(total);
            if (stageEl && stageText) stageEl.innerText = stageText;
        },
        setStage: (stageText) => {
            const stageEl = document.getElementById('swalBulkStageText') || document.getElementById('swalSingleStageText');
            if (stageEl && stageText) stageEl.innerText = stageText;
        },
        isCancelled: () => isCancelled,
        abortController: abortController,
        abortSignal: abortController.signal,
        close: () => {
            if (!isCancelled && Swal.isVisible()) {
                Swal.close();
            }
        }
    };

    window._activeModernLoadingHandle = handle;
    return handle;
};

// 8. EXPORT OBJECT LINTAS MODUL
const Global = {
    formatRupiah,
    formatTanggal: formatDateIndo,
    formatDateIndo,
    safeHtml,
    toast: (pesan, tipe = 'info') => showToast(tipe, pesan),
    showToast,
    fetchWithAuth,
    muatDataWargaGlobal,
    getAuthToken,
    getAuthUser,
    setAuthSession,
    logoutUser,
    isTokenExpired,
    openModal: window.openModal,
    closeModal: window.closeModal,
    applyCustomRoundedDropdowns,
    showModernLoadingAlert: window.showModernLoadingAlert
};

window.Global = Global;
window.muatDataWargaGlobal = muatDataWargaGlobal;
window.getAuthToken = getAuthToken;
window.getAuthUser = getAuthUser;
window.setAuthSession = setAuthSession;
window.logoutUser = logoutUser;
window.fetchWithAuth = fetchWithAuth;
window.formatRupiah = formatRupiah;
window.formatDateIndo = formatDateIndo;
window.showToast = showToast;
window.safeHtml = safeHtml;