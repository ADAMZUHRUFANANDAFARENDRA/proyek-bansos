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
     */
    function getBaseUrl() {
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL) {
            return window.CONFIG.BASE_URL.replace(/\/+$/, '');
        }
        if (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) {
            return window.API_BASE_URL.replace(/\/+$/, '');
        }
        // Port default Live Server/Vite ke Flask
        const currentPort = window.location.port;
        if (currentPort === '5500' || currentPort === '3000' || currentPort === '8080') {
            return 'http://127.0.0.1:5000';
        }
        return '';
    }

    /**
     * Ambil token yang bersih dari karakter kutip
     */
    function getCleanToken() {
        if (window.Auth && typeof window.Auth.getToken === 'function') {
            const authTk = window.Auth.getToken();
            if (authTk) return authTk.replace(/^["']+|["']+$/g, '').trim();
        }

        const keys = ['token', 'access_token', 'bansos_jwt_token', 'bansosToken'];
        for (const k of keys) {
            try {
                const val = localStorage.getItem(k);
                if (val && val !== 'null' && val !== 'undefined' && val.trim() !== '') {
                    return val.replace(/^["']+|["']+$/g, '').trim();
                }
            } catch (e) {}
        }
        return '';
    }

    window.BansosApp.API = {
        getBaseUrl,
        getToken: getCleanToken,

        /**
         * Permintaan HTTP Utama Terpadu
         * @param {string} endpoint
         * @param {Object} options
         * @returns {Promise<Response|null>}
         */
        async request(endpoint, options = {}) {
            const baseUrl = getBaseUrl();
            let url = endpoint;

            if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
                url = `${baseUrl}${cleanEndpoint}`;
            }

            // Normalisasi Headers dari berbagai format (Plain Object, Headers instance, dsb)
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

            // Sisipkan Token Bearer jika tersedia
            const token = getCleanToken();
            if (token && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Tangani serialisasi body & Content-Type otomatis
            let requestBody = options.body;
            if (requestBody instanceof FormData) {
                // Biarkan peramban mengelola header boundary multipart secara otomatis
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

                // Interceptor 401 Unauthorized
                if (response.status === 401) {
                    const isAuthRoute = url.includes('/login') || url.includes('/auth');
                    
                    if (!isAuthRoute) {
                        console.warn('[API 401] Sesi kedaluwarsa atau token tidak sah:', url);
                        // Jangan langsung redirect jika halaman baru saja terbuka (memberi jeda pembacaan token)
                        if (window.Auth && typeof window.Auth.clearSession === 'function') {
                            window.Auth.clearSession(true);
                        } else {
                            localStorage.clear();
                            window.location.replace('login.html');
                        }
                    }
                    return null;
                }

                return response;
            } catch (error) {
                console.error(`[API Fetch Error] Endpoint ${url} gagal dihubungi:`, error);
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
        }
    };

    /**
     * =========================================================================
     * SHORTCUT GLOBAL KONSISTENSI LINTAS MODUL
     * =========================================================================
     */
    window.fetchData = (endpoint, options) => window.BansosApp.API.request(endpoint, options);
    window.getCleanToken = getCleanToken;

    window.apiFetch = async function (endpoint, options = {}) {
        const res = await window.BansosApp.API.request(endpoint, options);
        if (!res) {
            throw new Error('Sesi autentikasi telah berakhir.');
        }

        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            data = { message: 'Respons peladen bukan format JSON yang valid.' };
        }

        if (!res.ok) {
            throw new Error(data.message || `Galat peladen (Status: ${res.status})`);
        }
        return data;
    };

})(window);