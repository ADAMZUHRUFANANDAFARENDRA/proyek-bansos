/* =========================================================================
   API.JS - CLIENT HTTP & AUTHENTICATION MANAGER
   ========================================================================= */

window.BansosApp = window.BansosApp || {};

window.BansosApp.API = {
    baseUrl: (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://127.0.0.1:5000',

    getToken() {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken') || '';
        return token.replace(/^["']+|["']+$/g, '').trim();
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (options.body instanceof FormData) delete headers['Content-Type'];

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'login.html';
                return null;
            }
            return response;
        } catch (error) {
            console.error(`[API ERROR] Gagal request ke ${url}:`, error);
            throw error;
        }
    }
};

// Expose fungsi global untuk kompatibilitas fungsi lama
window.fetchData = (endpoint, options) => window.BansosApp.API.request(endpoint, options);
window.getCleanToken = () => window.BansosApp.API.getToken();