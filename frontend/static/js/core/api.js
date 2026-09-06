/* =========================================================================
   API.JS - CLIENT HTTP, AUTHENTICATION MANAGER & REQUEST WRAPPER
   Lokasi: frontend/static/js/core/api.js
   ========================================================================= */

window.BansosApp = window.BansosApp || {};

window.BansosApp.API = {
    // Penentuan Base URL otomatis dari config.js atau variabel global lingkungan
    baseUrl: (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
        ? window.CONFIG.BASE_URL
        : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://127.0.0.1:5000'),

    /**
     * Mengambil dan membersihkan token JWT dari berbagai alternatif kunci penyimpanan
     * @returns {string}
     */
    getToken() {
        const tokenKey = window.CONFIG?.AUTH?.TOKEN_KEY || 'bansos_jwt_token';
        const token = localStorage.getItem(tokenKey) ||
                      localStorage.getItem('token') ||
                      localStorage.getItem('access_token') ||
                      localStorage.getItem('bansosToken') ||
                      '';
        // Membersihkan karakter kutip berlebih atau spasi tidak disengaja
        return token.replace(/^["']+|["']+$/g, '').trim();
    },

    /**
     * Request HTTP Inti (Mengembalikan Objek Response mentah)
     * @param {string} endpoint 
     * @param {Object} options 
     * @returns {Promise<Response|null>}
     */
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { ...(options.headers || {}) };

        // Sisipkan token otentikasi jika tersedia
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Otomatis set JSON header jika body bukan FormData
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        } else if (options.body instanceof FormData) {
            // Browser akan otomatis menyusun boundary multipart/form-data
            delete headers['Content-Type'];
        }

        // Resolusi URL: jika sudah absolut (http/https), pakai langsung
        let url = endpoint;
        if (!endpoint.startsWith('http')) {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            url = `${this.baseUrl}${cleanEndpoint}`;
        }

        try {
            const response = await fetch(url, { ...options, headers });
            
            // Interceptor 401: Token kedaluwarsa atau tidak valid
            if (response.status === 401) {
                console.warn('[API 401] Sesi kedaluwarsa, menghapus sesi kredensial...');
                if (window.Auth && typeof window.Auth.clearSession === 'function') {
                    window.Auth.clearSession(true);
                } else {
                    localStorage.clear();
                    window.location.href = 'login.html';
                }
                return null;
            }

            return response;
        } catch (error) {
            console.error(`[API ERROR] Gagal request ke ${url}:`, error);
            throw error;
        }
    },

    // Shortcut Helper RESTful API (Langsung mengurai JSON)
    async get(endpoint, options = {}) {
        const res = await this.request(endpoint, { ...options, method: 'GET' });
        return res ? res.json() : null;
    },

    async post(endpoint, body = {}, options = {}) {
        const isFormData = body instanceof FormData;
        const res = await this.request(endpoint, {
            ...options,
            method: 'POST',
            body: isFormData ? body : JSON.stringify(body)
        });
        return res ? res.json() : null;
    },

    async put(endpoint, body = {}, options = {}) {
        const isFormData = body instanceof FormData;
        const res = await this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: isFormData ? body : JSON.stringify(body)
        });
        return res ? res.json() : null;
    },

    async patch(endpoint, body = {}, options = {}) {
        const isFormData = body instanceof FormData;
        const res = await this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: isFormData ? body : JSON.stringify(body)
        });
        return res ? res.json() : null;
    },

    async delete(endpoint, options = {}) {
        const res = await this.request(endpoint, { ...options, method: 'DELETE' });
        return res ? res.json() : null;
    }
};

/**
 * =========================================================================
 * BRIDGE / WRAPPER GLOBAL UNTUK KOMPATIBILITAS KODE
 * =========================================================================
 */

// 1. Kompatibilitas fungsi bawaan lama
window.fetchData = (endpoint, options) => window.BansosApp.API.request(endpoint, options);
window.getCleanToken = () => window.BansosApp.API.getToken();

// 2. Kompatibilitas modul modern (apiFetch langsung mengembalikan objek JSON data)
window.apiFetch = async function (endpoint, options = {}) {
    const res = await window.BansosApp.API.request(endpoint, options);
    if (!res) {
        throw new Error('Sesi autentikasi telah berakhir.');
    }

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Terjadi kesalahan pada server (Status: ${res.status})`);
    }
    return data;
};