/* =========================================================================
   API.JS - CLIENT HTTP, AUTHENTICATION MANAGER & REQUEST WRAPPER
   Lokasi: frontend/static/js/core/api.js
   PEMERINTAH KABUPATEN SIDOARJO - DINAS SOSIAL
   ========================================================================= */

window.BansosApp = window.BansosApp || {};

(function (window) {
    'use strict';

    /**
     * Resolusi Base URL Backend Dinamis
     * Mendukung multi-port Live Server (5500, 5501), Vite (3000), dan Node/Proxy (8080)
     * @returns {string}
     */
    function getBaseUrl() {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL) {
            return window.CONFIG.BASE_URL.replace(/\/+$/, '');
        }
        if (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) {
            return window.API_BASE_URL.replace(/\/+$/, '');
        }

        const currentPort = window.location.port;
        const localDevPorts = ['5500', '5501', '3000', '8080'];

        if (localDevPorts.includes(currentPort)) {
            return 'http://127.0.0.1:5000';
        }

        // Fallback default peladen Flask backend
        return 'http://127.0.0.1:5000';
    }

    /**
     * Mengambil dan membersihkan token otentikasi dari seluruh variasi kunci
     * Menghapus karakter kutip ganda/tunggal yang terbawa dari format JSON
     * @returns {string}
     */
    function getCleanToken() {
        if (window.Auth && typeof window.Auth.getToken === 'function') {
            const authTk = window.Auth.getToken();
            if (authTk) return authTk.replace(/^["']+|["']+$/g, '').trim();
        }

        const keys = [
            'token', 
            'access_token', 
            'jwt_token', 
            'acces_token', 
            'bansos_jwt_token', 
            'bansosToken'
        ];

        for (const k of keys) {
            try {
                const val = localStorage.getItem(k);
                if (val && val !== 'null' && val !== 'undefined' && val.trim() !== '') {
                    return val.replace(/^["']+|["']+$/g, '').trim();
                }
            } catch (e) {
                console.warn('[Storage Read Warning]', e);
            }
        }
        return '';
    }

    window.BansosApp.API = {
        getBaseUrl,
        getToken: getCleanToken,

        /**
         * Permintaan HTTP Utama Terpadu
         * @param {string} endpoint - Rute API tujuan
         * @param {Object} options - Konfigurasi fetch (method, headers, body, dll)
         * @returns {Promise<Response>}
         */
        async request(endpoint, options = {}) {
            const baseUrl = getBaseUrl();
            let url = endpoint;

            if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
                url = `${baseUrl}${cleanEndpoint}`;
            }

            // Normalisasi Headers dari berbagai format masukan
            const headers = {};
            if (options.headers) {
                if (options.headers instanceof Headers) {
                    options.headers.forEach((val, key) => { headers[key] = val; });
                } else if (Array.isArray(options.headers)) {
                    options.headers.forEach(([key, val]) => { headers[key] = val; });
                } else {
                    Object.assign(headers, options.headers);
                }
            }

            // Sisipkan Token Bearer secara otomatis ke header jika tersedia
            const token = getCleanToken();
            if (token && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Tangani serialisasi body & Content-Type secara adaptif
            let requestBody = options.body;
            if (requestBody instanceof FormData) {
                // Biarkan peramban menyusun boundary multipart otomatis untuk unggahan berkas
                delete headers['Content-Type'];
            } else if (requestBody && typeof requestBody === 'object') {
                requestBody = JSON.stringify(requestBody);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }

            if (!headers['Accept']) {
                headers['Accept'] = 'application/json';
            }

            const fetchOptions = {
                ...options,
                headers,
                body: requestBody
            };

            try {
                const response = await fetch(url, fetchOptions);

                // Interceptor 401 Unauthorized (DILINDUNGI AGAR TIDAK TERPENTAL)
                if (response.status === 401) {
                    console.warn('[API 401] Panggilan API belum terotorisasi, sesi dashboard tetap dipertahankan:', url);
                    // Nonaktifkan pemanggilan clearSession otomatis di sini:
                    // window.Auth.clearSession(true);
                    return response;
                }

                return response;
            } catch (error) {
                console.warn(`[API Fetch Warning] Permintaan ke ${url} gagal dihubungi:`, error);
                throw error;
            }
        },

        async get(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'GET' });
        },

        async post(endpoint, body = {}, options = {}) {
            return this.request(endpoint, { ...options, method: 'POST', body });
        },

        async put(endpoint, body = {}, options = {}) {
            return this.request(endpoint, { ...options, method: 'PUT', body });
        },

        async patch(endpoint, body = {}, options = {}) {
            return this.request(endpoint, { ...options, method: 'PATCH', body });
        },

        async delete(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'DELETE' });
        },

        /**
         * Penangan unduhan file biner (Excel, PDF, CSV, dsb)
         * @param {string} endpoint
         * @param {string} filenameDefault
         */
        async download(endpoint, filenameDefault = 'unduhan_dokumen.xlsx') {
            const res = await this.get(endpoint, {
                headers: { 'Accept': '*/*' }
            });

            if (!res.ok) {
                throw new Error(`Gagal mengunduh berkas (Status: ${res.status})`);
            }

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = filenameDefault;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(downloadUrl);
        }
    };

    /**
     * =========================================================================
     * SHORTCUT GLOBAL KONSISTENSI LINTAS MODUL FRONTEND
     * =========================================================================
     */
    window.fetchData = (endpoint, options) => window.BansosApp.API.request(endpoint, options);
    window.getCleanToken = getCleanToken;

    window.apiFetch = async function (endpoint, options = {}) {
        const res = await window.BansosApp.API.request(endpoint, options);
        if (!res) {
            throw new Error('Tidak ada respon yang diterima dari peladen.');
        }

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            data = { message: 'Format data bukan JSON atau respons kosong.' };
        }

        if (!res.ok) {
            console.warn(`[API Notice] Respon ${res.status}:`, data.message || res.statusText);
        }
        return data;
    };

})(window);