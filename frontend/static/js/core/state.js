/* =========================================================================
   STATE.JS - SINGLE SOURCE OF TRUTH & EVENT BUS SISTEM BANSOS
   ========================================================================= */

window.BansosApp = window.BansosApp || {};

window.BansosApp.State = {
    // Data Utama
    wargaList: [],
    selectedWarga: null,
    
    // Status SPK
    spkResult: null,
    komparasiResult: [],
    
    // Status Chat & Komunikasi
    activeChat: {
        nik: null,
        nama: null
    },

    // Filter & Tampilan
    currentFilter: 'all',
    currentSort: 'terbaru',
    petaMode: 'kecamatan', // 'kecamatan' | 'kelurahan' | 'desa'

    // Setter Data Terpusat dengan Event Dispatcher Otomatis
    setWargaList(data) {
        this.wargaList = Array.isArray(data) ? data : [];
        window.globalDataWarga = this.wargaList; // Kompatibilitas mundur
        window.BansosApp.Events.emit('warga:updated', this.wargaList);
    },

    setSPKResult(result) {
        this.spkResult = result;
        window.lastSPKResult = result;
        window.BansosApp.Events.emit('spk:computed', result);
    },

    setActiveChat(nik, nama) {
        this.activeChat.nik = String(nik);
        this.activeChat.nama = nama;
        window.activeChatNik = String(nik);
        window.activeChatName = nama;
        window.BansosApp.Events.emit('chat:selected', { nik, nama });
    }
};

// Sistem Event Bus untuk Menghilangkan Ketergantungan Silang (Loose Coupling)
window.BansosApp.Events = {
    events: {},
    on(eventName, callback) {
        if (!this.events[eventName]) this.events[eventName] = [];
        this.events[eventName].push(callback);
    },
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(fn => fn(data));
        }
    }
};