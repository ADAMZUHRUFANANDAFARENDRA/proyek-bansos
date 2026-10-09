/**
 * =============================================================================
 * CORE REAL-TIME CLIENT (ANTI-DELAY & ANTI-GLITCH ENGINE)
 * SISTEM PENGADUAN & NOTIFIKASI PEMKAB SIDOARJO
 * Protokol: WebSocket Bi-Directional dengan Failover Server-Sent Events (SSE)
 * =============================================================================
 */

(function (window) {
    'use strict';

    const processedEventIds = new Set();
    const eventListeners = new Map();
    let ws = null;
    let sseSource = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let reconnectTimeout = null;
    let pingInterval = null;

    // Audio pemberitahuan lembut untuk notifikasi penting (Web Audio API sintetis, tanpa dependensi file eksternal)
    function playChime(type = 'info') {
        // Heningkan suara saat data sedang diproses (impor arsip, kalkulasi, atau loading aktif)
        if (window._isImportProcessing || window._isProcessingData || document.querySelector('.swal-modern-loading-card') || document.querySelector('.swal2-loading')) {
            return;
        }
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            if (type === 'urgent') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {}
    }

    // Audio Dering Panggilan Telepon / Video Call (Dual-Tone Standard Ringtone)
    let ringtoneTimer = null;
    let ringtoneAudioCtx = null;

    function startRingtone() {
        stopRingtone();
        try {
            ringtoneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            function ring() {
                if (!ringtoneAudioCtx) return;
                const now = ringtoneAudioCtx.currentTime;
                const osc1 = ringtoneAudioCtx.createOscillator();
                const osc2 = ringtoneAudioCtx.createOscillator();
                const gainNode = ringtoneAudioCtx.createGain();

                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(440, now);
                osc2.frequency.setValueAtTime(480, now);

                osc1.connect(gainNode);
                osc2.connect(gainNode);
                gainNode.connect(ringtoneAudioCtx.destination);

                gainNode.gain.setValueAtTime(0.09, now);
                gainNode.gain.setValueAtTime(0.09, now + 1.2);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 1.25);
                osc2.stop(now + 1.25);
            }
            ring();
            ringtoneTimer = setInterval(ring, 2800);
        } catch(e) {}
    }

    function stopRingtone() {
        if (ringtoneTimer) {
            clearInterval(ringtoneTimer);
            ringtoneTimer = null;
        }
        if (ringtoneAudioCtx) {
            try { ringtoneAudioCtx.close(); } catch(e) {}
            ringtoneAudioCtx = null;
        }
    }

    // Helper Toast tidak mengganggu (Non-intrusive, tidak menimpa popup SweetAlert2)
    function showRealtimeToast(title, message, icon = 'info') {
        if (typeof window.showModernToast === 'function') {
            window.showModernToast(title, message, { icon, type: icon, duration: 4000 });
            return;
        }
        if (typeof Swal !== 'undefined' && Swal.mixin && (!Swal.isVisible() || Swal.isLoading())) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });
            Toast.fire({
                icon: icon,
                title: `<span style="font-size:0.85rem; font-weight:700;">${title}</span>`,
                html: `<span style="font-size:0.78rem; color:#475569;">${message}</span>`
            });
        }
    }

    /**
     * Memproses event yang masuk secara idempotensial (mencegah glitch & duplikasi)
     */
    function handleIncomingEvent(event) {
        if (!event || !event.type) return;

        // Cegah eksekusi ganda jika ID event sudah pernah diproses dalam sesi ini
        if (event.id) {
            if (processedEventIds.has(event.id)) return;
            processedEventIds.add(event.id);
            if (processedEventIds.size > 200) {
                // Bersihkan buffer set tertua
                const arr = Array.from(processedEventIds);
                arr.slice(0, 50).forEach(id => processedEventIds.delete(id));
            }
        }

        // Panggil listener yang terdaftar untuk tipe event ini
        const listeners = eventListeners.get(event.type) || [];
        listeners.forEach(fn => {
            try { fn(event); } catch (e) { console.warn('[REALTIME_LISTENER_ERR]', e); }
        });

        // Panggil juga wildcard listener '*'
        const wildcards = eventListeners.get('*') || [];
        wildcards.forEach(fn => {
            try { fn(event); } catch (e) {}
        });

        // =====================================================================
        // INTEGRASI OTOMATIS KE MODUL NOTIFIKASI & PELAPORAN TERPADU
        // =====================================================================

        // 1. NOTIFIKASI BARU
        if (event.type === 'NOTIF_NEW') {
            const item = event.data;
            if (item) {
                if (!window.cachedNotifList) window.cachedNotifList = [];
                // Cek duplikasi di cachedNotifList
                const existingIdx = window.cachedNotifList.findIndex(n => Number(n.id) === Number(item.id));
                if (existingIdx === -1) {
                    window.cachedNotifList.unshift(item);
                } else {
                    window.cachedNotifList[existingIdx] = { ...window.cachedNotifList[existingIdx], ...item };
                }

                // Perbarui badge lonceng seketika (0 delay)
                const badge = document.getElementById('notifBadge');
                const unreadCount = event.unread !== undefined ? event.unread : window.cachedNotifList.filter(n => !n.is_read && !n.is_archived).length;
                if (badge) {
                    badge.textContent = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
                    // Animasi getar lembut pada lonceng
                    const bell = badge.closest('.notif-wrapper')?.querySelector('i');
                    if (bell) {
                        bell.classList.add('animate-bounce');
                        setTimeout(() => bell.classList.remove('animate-bounce'), 1000);
                    }
                }

                // Render ulang jika panel notifikasi sedang terbuka
                const panel = document.getElementById('notifPanel');
                if (panel && (panel.style.display === 'block' || panel.style.display === 'flex')) {
                    if (typeof window.renderNotifikasiListDOM === 'function') {
                        window.renderNotifikasiListDOM();
                    }
                }

                // Bunyikan chime & tampilkan toast jika notifikasi urgent atau laporan baru (selain impor data)
                const isImportOrProcessing = item.kategori === 'import' || window._isImportProcessing || window._isProcessingData || document.querySelector('.swal-modern-loading-card') || document.querySelector('.swal2-loading');
                if (!isImportOrProcessing) {
                    const isUrgent = item.kategori === 'urgent' || (item.pesan && (item.pesan.includes('🚨') || item.pesan.includes('🚩')));
                    playChime(isUrgent ? 'urgent' : 'info');
                }

                // Tampilkan notifikasi melayang pada halaman aparatur jika bukan aksi lokal yang baru saja selesai
                const isRecentLocalAction = (Date.now() - (window._lastLocalActionTime || 0)) < 5000;
                if (document.getElementById('notifPanel') && !isRecentLocalAction) {
                    const clean = (item.pesan || '').replace(/👑|📌|🔒|🚨|⚠️/g, '').replace(/^\[.*?\]\s*/, '').trim();
                    showRealtimeToast('Notifikasi Baru', clean.substring(0, 70) + (clean.length > 70 ? '...' : ''), isUrgent ? 'warning' : 'info');
                }
            }
        }

        // 2. PEMBARUAN STATUS NOTIFIKASI (READ / PIN / ARCHIVE / DELETE / CLEAR / READ_ALL)
        if (event.type === 'NOTIF_UPDATE') {
            const action = event.action;
            const id = Number(event.id);
            if (window.cachedNotifList) {
                if (action === 'read' && id) {
                    const itm = window.cachedNotifList.find(n => Number(n.id) === id);
                    if (itm) itm.is_read = true;
                } else if (action === 'pin' && id) {
                    const itm = window.cachedNotifList.find(n => Number(n.id) === id);
                    if (itm) itm.is_pinned = !itm.is_pinned;
                } else if (action === 'archive' && id) {
                    const itm = window.cachedNotifList.find(n => Number(n.id) === id);
                    if (itm) itm.is_archived = !itm.is_archived;
                } else if (action === 'delete' && id) {
                    window.cachedNotifList = window.cachedNotifList.filter(n => Number(n.id) !== id);
                } else if (action === 'read_all') {
                    window.cachedNotifList.forEach(n => { n.is_read = true; });
                } else if (action === 'clear_all') {
                    window.cachedNotifList = window.cachedNotifList.filter(n => Boolean(n.is_pinned));
                }

                // Perbarui badge
                const badge = document.getElementById('notifBadge');
                const unreadCount = event.unread !== undefined ? event.unread : window.cachedNotifList.filter(n => !n.is_read && !n.is_archived).length;
                if (badge) {
                    badge.textContent = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
                }

                if (typeof window.renderNotifikasiListDOM === 'function') {
                    window.renderNotifikasiListDOM();
                }
            }
        }

        // 3. ADUAN / PELAPORAN WARGA BARU DITERIMA (ADUAN_NEW)
        if (event.type === 'ADUAN_NEW') {
            const aduan = event.data;
            if (aduan) {
                // Di portal aparatur:
                if (window.allLaporanChatData) {
                    const formatted = {
                        id: `ADUAN-${String(aduan.id).padStart(3, '0')}`,
                        nik: aduan.nik,
                        nama: aduan.nama || aduan.nama_pelapor,
                        kategori: aduan.kategori,
                        uraian: aduan.uraian || aduan.isi_laporan,
                        status_text: aduan.status_text || 'Ditinjau Petugas',
                        status_step: aduan.status_step || 2,
                        catatan_petugas: aduan.catatan_petugas,
                        waktu: aduan.waktu
                    };
                    const exists = window.allLaporanChatData.some(a => a.nik === aduan.nik && a.id === formatted.id);
                    if (!exists) {
                        window.allLaporanChatData.unshift(formatted);
                    }
                    if (typeof window.updateInvestigasiKPIMetrics === 'function') {
                        window.updateInvestigasiKPIMetrics(window.allLaporanChatData);
                    }
                    if (typeof window.renderLaporanChat === 'function') {
                        window.renderLaporanChat(window.allLaporanChatData);
                    }
                }
            }

            if (window.activeChatNik && typeof window.updateSelesaikanLaporanVisibility === 'function') {
                window.updateSelesaikanLaporanVisibility(window.activeChatNik);
            }
        }

        // 4. PEMBARUAN STATUS ADUAN (STEPPER 1->2->3->4) SECARA REALTIME
        if (event.type === 'ADUAN_UPDATE') {
            const aduan = event.data;
            const nik = event.nik;

            // Di portal warga publik: Jika warga sedang membuka dashboard pelaporan
            if (window.sesiAduanAktif && window.sesiAduanAktif.nik === nik) {
                if (typeof window.sinkronStatusStepperAduan === 'function') {
                    window.sinkronStatusStepperAduan();
                }
                showRealtimeToast('Status Aduan Diperbarui', `Laporan Anda kini berada pada: ${aduan.status_text || 'Tahap Lanjutan'}`, 'success');
                playChime('info');
            }

            // Di portal aparatur: Sinkronkan daftar tabel investigasi
            if (window.allLaporanChatData) {
                const target = window.allLaporanChatData.find(a => a.nik === nik);
                if (target) {
                    target.status_text = aduan.status_text;
                    target.status_step = aduan.status_step;
                    target.catatan_petugas = aduan.catatan_petugas;
                    target.status = aduan.status;
                }
                if (typeof window.updateInvestigasiKPIMetrics === 'function') {
                    window.updateInvestigasiKPIMetrics(window.allLaporanChatData);
                }
                if (typeof window.renderLaporanChat === 'function') {
                    window.renderLaporanChat(window.allLaporanChatData);
                }
            }

            if (window.activeChatNik && typeof window.updateSelesaikanLaporanVisibility === 'function') {
                window.updateSelesaikanLaporanVisibility(window.activeChatNik);
            }
        }

        // 5. ESKALASI KE SUPER ADMIN DITERIMA (MEKANISME TERHUBUNG INSTAN)
        if (event.type === 'ESKALASI_NEW') {
            const aduan = event.data;
            // Di portal Super Admin:
            if (window.eskalasiListData) {
                const exists = window.eskalasiListData.some(e => e.id === aduan.id);
                if (!exists) window.eskalasiListData.unshift(aduan);
                if (typeof window.updateCounterEskalasi === 'function') {
                    window.updateCounterEskalasi(window.eskalasiListData);
                }
                if (typeof window.renderTiketEskalasi === 'function') {
                    window.renderTiketEskalasi(window.eskalasiListData);
                }
            }

            // Tampilkan alert khusus bagi Super Admin jika sedang login
            const role = (localStorage.getItem('role') || localStorage.getItem('user_role') || '').toLowerCase();
            if (role.includes('super')) {
                showRealtimeToast('🛡️ Eskalasi Baru Masuk', `Admin Bansos meneruskan aduan ${aduan.nama} (NIK: ${aduan.nik})`, 'warning');
                playChime('urgent');
            }
        }

        // 6. PUTUSAN SUPER ADMIN DIKELUARKAN (KEMBALI KE ADMIN BANSOS & WARGA)
        if (event.type === 'PUTUSAN_SUPERADMIN') {
            const aduan = event.data;
            const nik = event.nik;

            // Di portal warga:
            if (window.sesiAduanAktif && window.sesiAduanAktif.nik === nik) {
                if (typeof window.sinkronStatusStepperAduan === 'function') {
                    window.sinkronStatusStepperAduan();
                }
                if (typeof window.muatPesanAduan === 'function') {
                    window.muatPesanAduan(true);
                }
                showRealtimeToast('Putusan Resmi Diterbitkan', `Super Admin telah menuntaskan investigasi tiket Anda.`, 'success');
                playChime('urgent');
            }

            // Di portal aparatur / Admin Bansos:
            if (window.allLaporanChatData) {
                const target = window.allLaporanChatData.find(a => a.nik === nik);
                if (target) {
                    target.status_text = aduan.status_text;
                    target.status_step = aduan.status_step;
                    target.catatan_petugas = aduan.catatan_petugas;
                }
                if (typeof window.renderLaporanChat === 'function') {
                    window.renderLaporanChat(window.allLaporanChatData);
                }
            }
            if (window.eskalasiListData) {
                if (typeof window.muatDataEskalasiSuperAdmin === 'function') {
                    window.muatDataEskalasiSuperAdmin();
                }
            }
            showRealtimeToast('⚖️ Putusan Super Admin', `Aduan ${aduan.nama} telah diputuskan dan selesai.`, 'info');
        }

        // 7. PESAN CHAT MEDIASI BARU (CHAT_MESSAGE)
        if (event.type === 'CHAT_MESSAGE') {
            const msg = event.data;
            const nik = event.nik;

            // Jika warga sedang di dashboard aduan & chat nik cocok:
            if (window.sesiAduanAktif && window.sesiAduanAktif.nik === nik) {
                if (typeof window.muatPesanAduan === 'function') {
                    window.muatPesanAduan(false);
                }
            }

            // Jika warga sedang di tab Live Chat portal publik:
            const currentWargaNik = window.wargaNik || localStorage.getItem('wargaNik') || localStorage.getItem('lastAduanNik');
            if (currentWargaNik === nik) {
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
            }

            // Jika admin sedang membuka chat dengan warga ini:
            if (window.activeChatNik === nik) {
                if (typeof window.loadChatMessages === 'function') {
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                }
            }
        }

        // 8. SINYAL PANGGILAN AUDIO & VIDEO WEBRTC REAL-TIME
        if (event.type === 'CALL_INVITE') {
            const isWargaPortal = Boolean(document.getElementById('wargaIncomingCallUI') || window.sesiAduanAktif || window.wargaNik);
            const myNik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || 
                          localStorage.getItem('lastAduanNik') || 
                          localStorage.getItem('wargaNik') || 
                          window.wargaNik || 
                          (window.sesiWargaAktif && window.sesiWargaAktif.nik) || 
                          null;

            if (isWargaPortal) {
                // Sisi Warga: Terima panggilan dari Aparatur (Super Admin / Admin Bansos / Petugas)
                if (event.target_nik && myNik && String(event.target_nik) !== String(myNik)) {
                    return; // Bukan ditujukan untuk NIK warga ini
                }
                if (typeof window.terimaPanggilanMasukWarga === 'function') {
                    window.terimaPanggilanMasukWarga(event);
                }
            } else {
                // Sisi Aparatur (Super Admin / Admin / Petugas): Terima panggilan masuk dari Warga
                if (event.caller_role === 'warga' || event.target_role === 'aparatur') {
                    if (typeof window.terimaPanggilanMasukAparatur === 'function') {
                        window.terimaPanggilanMasukAparatur(event);
                    }
                }
            }
        }

        if (event.type === 'CALL_RINGING') {
            if (typeof window.handleCallRingingSignal === 'function') {
                window.handleCallRingingSignal(event);
            }
        }

        if (event.type === 'CALL_ACCEPT') {
            if (typeof window.handleCallAcceptedSignal === 'function') {
                window.handleCallAcceptedSignal(event);
            }
        }

        if (event.type === 'CALL_DECLINE' || event.type === 'CALL_END') {
            if (typeof window.handleCallEndedSignal === 'function') {
                window.handleCallEndedSignal(event);
            }
        }
    }

    /**
     * Memulai koneksi WebSocket
     */
    function connectWebSocket() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = function () {
                isConnected = true;
                reconnectAttempts = 0;
                console.log('[REALTIME] Terhubung ke WebSocket Peladen Pemkab Sidoarjo');

                // Kirim identifikasi peran jika tersedia di local storage
                try {
                    const role = localStorage.getItem('role') || localStorage.getItem('user_role') || 'guest';
                    const nik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik') || null;
                    ws.send(JSON.stringify({ type: 'IDENTIFY', role, nik }));
                } catch (e) {}

                // Inisialisasi Ping berkala tiap 20 detik untuk menjaga jalur koneksi terbuka
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        try { ws.send(JSON.stringify({ type: 'PING' })); } catch (e) {}
                    }
                }, 20000);

                // Sinkronkan event yang mungkin tertinggal saat terputus
                syncMissedEvents();
            };

            ws.onmessage = function (eventMsg) {
                try {
                    const data = JSON.parse(eventMsg.data);
                    if (data.type === 'PONG') return;
                    handleIncomingEvent(data);
                } catch (err) {}
            };

            ws.onclose = function () {
                isConnected = false;
                if (pingInterval) clearInterval(pingInterval);
                scheduleReconnect();
            };

            ws.onerror = function () {
                isConnected = false;
                try { ws.close(); } catch (e) {}
            };
        } catch (e) {
            connectSSEFallback();
        }
    }

    /**
     * Fallback menggunakan Server-Sent Events (SSE) jika WebSocket diblokir
     */
    function connectSSEFallback() {
        if (sseSource) {
            try { sseSource.close(); } catch (e) {}
        }
        try {
            sseSource = new EventSource('/api/realtime/stream');
            sseSource.onopen = function () {
                isConnected = true;
                console.log('[REALTIME] Jalur Failover SSE Aktif');
            };
            sseSource.onmessage = function (e) {
                try {
                    const data = JSON.parse(e.data);
                    handleIncomingEvent(data);
                } catch (err) {}
            };
            sseSource.onerror = function () {
                isConnected = false;
            };
        } catch (e) {}
    }

    /**
     * Reconnect otomatis dengan exponential backoff teratur
     */
    function scheduleReconnect() {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 8000);

        reconnectTimeout = setTimeout(() => {
            connectWebSocket();
            // Jika sudah 3x gagal WS, aktifkan juga jalur SSE sebagai cadangan paralel
            if (reconnectAttempts >= 3 && !sseSource) {
                connectSSEFallback();
            }
        }, delay);
    }

    /**
     * Sinkronkan event yang terlewat setelah tab kembali fokus atau reconnect
     */
    async function syncMissedEvents() {
        try {
            const res = await fetch('/api/realtime/recent');
            if (res.ok) {
                const json = await res.json();
                const list = (json.events || []).reverse();
                list.forEach(evt => handleIncomingEvent(evt));
            }
        } catch (e) {}
    }

    // Tangani saat tab peramban kembali aktif / kelihatan (visibilitychange)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
                connectWebSocket();
            } else {
                syncMissedEvents();
            }
        }
    });

    // Mulai koneksi realtime segera setelah DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connectWebSocket);
    } else {
        connectWebSocket();
    }

    // Ekspor API Publik RealtimeHub
    window.RealtimeHub = {
        on: function (type, callback) {
            if (!eventListeners.has(type)) eventListeners.set(type, []);
            eventListeners.get(type).push(callback);
        },
        off: function (type, callback) {
            if (!eventListeners.has(type)) return;
            const arr = eventListeners.get(type).filter(fn => fn !== callback);
            eventListeners.set(type, arr);
        },
        send: function (payload) {
            if (!payload || !payload.type) return false;
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(payload));
                    return true;
                } catch (e) {}
            }
            try {
                fetch('/api/realtime/call-signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});
                return true;
            } catch (e) {}
            return false;
        },
        startRingtone: startRingtone,
        stopRingtone: stopRingtone,
        isConnected: function () {
            return isConnected;
        },
        reconnect: function () {
            if (ws) try { ws.close(); } catch (e) {}
            connectWebSocket();
        }
    };

})(window);
