/**
 * =============================================================================
 * CORE REAL-TIME CLIENT (ANTI-DELAY & ANTI-GLITCH ENGINE)
 * SISTEM PENGADUAN & NOTIFIKASI PEMKAB SIDOARJO
 * Protokol: WebSocket Bi-Directional dengan Failover Server-Sent Events (SSE)
 * =============================================================================
 */

(function (window) {
    'use strict';

    window.mySessionSocketId = window.mySessionSocketId || ('sock_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));

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

            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData(false);
            }

            if (typeof window.sinkronisasiPesanMasukRealtime === 'function') {
                window.sinkronisasiPesanMasukRealtime();
            }
        }

        // 4. PEMBARUAN STATUS ADUAN (STEPPER 1->2->3->4->5) SECARA REALTIME
        if (event.type === 'ADUAN_UPDATE') {
            const aduan = event.data;
            const nik = event.nik;
            const cleanTarget = String(nik || '').replace(/\D/g, '');
            const cleanAduan = String((window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik') || '').replace(/\D/g, '');

            // Di portal warga publik: Jika warga sedang membuka dashboard pelaporan
            if (cleanTarget && cleanAduan && cleanTarget === cleanAduan) {
                if (typeof window.sinkronStatusStepperAduan === 'function') {
                    window.sinkronStatusStepperAduan();
                }
                if (typeof window.muatPesanAduan === 'function') {
                    window.muatPesanAduan(true);
                }
                showRealtimeToast('Status Aduan Diperbarui', `Laporan Anda kini berada pada: ${aduan.status_text || 'Tahap Lanjutan'}`, 'success');
                playChime('info');
            }

            // Di portal warga publik (Dashboard Pribadi Warga Terdaftar):
            const curWargaNik = (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) || localStorage.getItem('wargaNik') || window.wargaNik;
            if (curWargaNik && String(curWargaNik).replace(/\D/g, '') === cleanTarget) {
                if (window.wargaDataCache) {
                    window.wargaDataCache.aduan_aktif = aduan;
                    if (aduan.status === 'Selesai' || aduan.status_step === 5) {
                        window.wargaDataCache.status_salur = 'Telah Menerima';
                        window.wargaDataCache.konfirmasi_warga = true;
                    }
                }
                if (window.sesiWargaAktif) {
                    window.sesiWargaAktif.aduan_aktif = aduan;
                    if (aduan.status === 'Selesai' || aduan.status_step === 5) {
                        window.sesiWargaAktif.status_salur = 'Telah Menerima';
                        window.sesiWargaAktif.konfirmasi_warga = true;
                    }
                }
                if (typeof window.renderDashboardWarga === 'function') {
                    window.renderDashboardWarga(window.wargaDataCache || window.sesiWargaAktif);
                }
                if (typeof window.loadDashboardWarga === 'function') {
                    window.loadDashboardWarga();
                }
            }

            // Di portal aparatur: Sinkronkan daftar tabel investigasi & metrik dasbor
            if (window.allLaporanChatData) {
                const target = window.allLaporanChatData.find(a => String(a.nik || '').replace(/\D/g, '') === cleanTarget);
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

            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData(false);
            }

            if (typeof window.sinkronisasiPesanMasukRealtime === 'function') {
                window.sinkronisasiPesanMasukRealtime();
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
            const cleanTarget = String(nik || '').replace(/\D/g, '');
            const cleanAduan = String((window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik') || '').replace(/\D/g, '');

            // Di portal warga:
            if (cleanTarget && cleanAduan && cleanTarget === cleanAduan) {
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
                const target = window.allLaporanChatData.find(a => String(a.nik || '').replace(/\D/g, '') === cleanTarget);
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

        // 6.1 PERGANTIAN PETUGAS RESPON RESMI REALTIME (CHAT_OFFICER_CHANGED)
        if (event.type === 'CHAT_OFFICER_CHANGED') {
            const nik = event.nik;
            const officerName = event.officer_name || (event.officer && event.officer.name);
            const officerRole = event.officer_role || (event.officer && event.officer.role);

            const curWargaNik = (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) || localStorage.getItem('wargaNik') || window.wargaNik;
            const curAduanNik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik');
            const cleanTarget = String(nik || '').replace(/\D/g, '');
            const cleanCur = String(curWargaNik || '').replace(/\D/g, '');
            const cleanAduan = String(curAduanNik || '').replace(/\D/g, '');

            if (cleanTarget && cleanCur && cleanTarget === cleanCur) {
                if (typeof window.handleChatOfficerChanged === 'function') {
                    window.handleChatOfficerChanged(officerName, officerRole);
                }
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
            }

            if (cleanTarget && cleanAduan && cleanTarget === cleanAduan) {
                if (typeof window.handleChatOfficerChangedAduan === 'function') {
                    window.handleChatOfficerChangedAduan(officerName, officerRole);
                }
                if (typeof window.muatPesanAduan === 'function') {
                    window.muatPesanAduan(true);
                }
            }
        }

        // 7. PESAN CHAT MEDIASI BARU (CHAT_MESSAGE)
        if (event.type === 'CHAT_MESSAGE') {
            const msg = event.data;
            const nik = event.nik;
            const cleanTarget = String(nik || '').replace(/\D/g, '');

            if (typeof window.sinkronisasiPesanMasukRealtime === 'function') {
                window.sinkronisasiPesanMasukRealtime();
            }

            // Jika warga sedang di dashboard aduan & chat nik cocok:
            const curAduanNik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik');
            const cleanAduan = String(curAduanNik || '').replace(/\D/g, '');
            if (cleanTarget && cleanAduan && cleanTarget === cleanAduan) {
                if (typeof window.muatPesanAduan === 'function') {
                    window.muatPesanAduan(true);
                }
                if (typeof window.sinkronStatusStepperAduan === 'function') {
                    window.sinkronStatusStepperAduan();
                }
            }

            // Jika warga sedang di tab Live Chat portal publik:
            const currentWargaNik = (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) || window.wargaNik || localStorage.getItem('wargaNik');
            const cleanWarga = String(currentWargaNik || '').replace(/\D/g, '');
            if (cleanTarget && cleanWarga && cleanTarget === cleanWarga) {
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
            }

            // Jika admin sedang membuka chat dengan warga ini:
            const cleanAdminActive = String(window.activeChatNik || '').replace(/\D/g, '');
            if (cleanTarget && cleanAdminActive && cleanTarget === cleanAdminActive) {
                if (typeof window.loadChatMessages === 'function') {
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                }
            }
        }

        // 8. SINYAL PANGGILAN AUDIO & VIDEO WEBRTC REAL-TIME
        if (event.type === 'CALL_INVITE') {
            // Validasi apakah sinyal panggilan masih aktif (< 20 detik)
            if (event.timestamp) {
                const diffMs = Math.abs(Date.now() - new Date(event.timestamp).getTime());
                if (diffMs > 20000) {
                    console.log('[REALTIME] Mengabaikan panggilan masuk usang/stale:', diffMs, 'ms');
                    return;
                }
            }

            const isWargaPortal = Boolean(document.getElementById('wargaIncomingCallUI') || window.sesiAduanAktif || window.wargaNik);
            const myNik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || 
                          localStorage.getItem('lastAduanNik') || 
                          localStorage.getItem('wargaNik') || 
                          window.wargaNik || 
                          (window.sesiWargaAktif && window.sesiWargaAktif.nik) || 
                          null;

            const cleanMyNik = String(myNik || '').replace(/\D/g, '');
            const cleanCallerNik = String(event.caller_nik || '').replace(/\D/g, '');
            const cleanTargetNik = String(event.target_nik || '').replace(/\D/g, '');

            if (isWargaPortal) {
                // Sisi Warga: HANYA terima panggilan masuk jika berasal dari Aparatur
                // 1. Jika ini panggilan yang diinisiasi oleh warga ini sendiri, ABAIKAN! (Cegah loopback echo)
                if (cleanCallerNik && cleanMyNik && cleanCallerNik === cleanMyNik) {
                    return;
                }
                // 2. Warga tidak menerima panggilan masuk dari sesama warga atau jika targetnya aparatur
                if (event.caller_role === 'warga' || event.target_role === 'aparatur') {
                    return;
                }
                // 3. Jika ditujukan ke NIK tertentu, pastikan cocok dengan NIK warga saat ini
                if (cleanTargetNik && cleanMyNik && cleanTargetNik !== cleanMyNik) {
                    return;
                }
                if (typeof window.terimaPanggilanMasukWarga === 'function') {
                    window.terimaPanggilanMasukWarga(event);
                }
            } else {
                // Sisi Aparatur (Super Admin / Admin / Petugas): Terima panggilan masuk dari Warga
                // Cegah loopback jika aparatur itu sendiri yang memanggil
                if (event.caller_id && window.currentUserId && String(event.caller_id) === String(window.currentUserId)) {
                    return;
                }
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
            if (event.sender_socket && event.sender_socket === window.mySessionSocketId) {
                // Echo dari socket peramban/tab sendiri, abaikan
                return;
            }
            if (typeof window.handleCallEndedSignal === 'function') {
                window.handleCallEndedSignal(event);
            }
            if (typeof window.handleCallEndedSignalWarga === 'function') {
                window.handleCallEndedSignalWarga(event);
            }
        }

        if (event.type === 'CALL_MEDIA_STATE') {
            if (event.sender_socket && event.sender_socket === window.mySessionSocketId) {
                return;
            }
            if (typeof window.handleCallMediaStateSignal === 'function') {
                window.handleCallMediaStateSignal(event);
            }
            if (typeof window.handleCallMediaStateSignalWarga === 'function') {
                window.handleCallMediaStateSignalWarga(event);
            }
        }

        if (event.type === 'CALL_SWITCH_MODE') {
            if (event.sender_socket && event.sender_socket === window.mySessionSocketId) {
                return;
            }
            if (typeof window.handleCallSwitchModeSignal === 'function') {
                window.handleCallSwitchModeSignal(event);
            }
            if (typeof window.handleCallSwitchModeSignalWarga === 'function') {
                window.handleCallSwitchModeSignalWarga(event);
            }
        }

        if (event.type === 'CALL_SWITCH_REQUEST') {
            if (event.sender_socket && event.sender_socket === window.mySessionSocketId) {
                return;
            }
            if (typeof window.handleCallSwitchRequestSignal === 'function') {
                window.handleCallSwitchRequestSignal(event);
            }
            if (typeof window.handleCallSwitchRequestSignalWarga === 'function') {
                window.handleCallSwitchRequestSignalWarga(event);
            }
        }

        if (event.type === 'CALL_SWITCH_RESPONSE') {
            if (event.sender_socket && event.sender_socket === window.mySessionSocketId) {
                return;
            }
            if (typeof window.handleCallSwitchResponseSignal === 'function') {
                window.handleCallSwitchResponseSignal(event);
            }
            if (typeof window.handleCallSwitchResponseSignalWarga === 'function') {
                window.handleCallSwitchResponseSignalWarga(event);
            }
        }

        // 9. PEMBARUAN REAL-TIME PENYALURAN BANSOS & DATA ARSIP WARGA (WARGA_SALUR_UPDATED & WARGA_UPDATED)
        if (event.type === 'WARGA_SALUR_UPDATED' || event.type === 'WARGA_UPDATED') {
            const wData = event.data?.warga || event.warga || event.data;
            const targetNik = event.nik || (wData && wData.nik);
            const cleanTargetNik = String(targetNik || '').replace(/\D/g, '');

            // Sisi Portal Warga Publik: Sinkronkan seketika jika NIK yang sedang login cocok
            const myNik = (window.sesiWargaAktif && window.sesiWargaAktif.nik) ||
                          localStorage.getItem('wargaNik') ||
                          window.wargaNik;
            const cleanMyNik = String(myNik || '').replace(/\D/g, '');

            if ((cleanTargetNik && cleanMyNik && cleanTargetNik === cleanMyNik) || (targetNik && myNik && String(targetNik).trim() === String(myNik).trim())) {
                if (wData) {
                    window.wargaDataCache = { ...(window.wargaDataCache || {}), ...wData };
                    if (window.sesiWargaAktif) {
                        window.sesiWargaAktif = { ...window.sesiWargaAktif, ...wData };
                    }
                    if (typeof window.renderDashboardWarga === 'function') {
                        window.renderDashboardWarga(window.wargaDataCache);
                    }
                }
                if (typeof window.loadDashboardWarga === 'function') {
                    window.loadDashboardWarga();
                }
            }

            // Sisi Portal Aparatur / Admin: Sinkronkan tabel arsip warga tanpa delay
            if (window.globalDataWarga && Array.isArray(window.globalDataWarga) && (targetNik || wData?.id)) {
                const idx = window.globalDataWarga.findIndex(item => (targetNik && String(item.nik) === String(targetNik)) || (wData?.id && Number(item.id) === Number(wData.id)));
                if (idx !== -1 && wData) {
                    window.globalDataWarga[idx] = { ...window.globalDataWarga[idx], ...wData };
                    try {
                        localStorage.setItem('cachedDataWarga', JSON.stringify(window.globalDataWarga));
                    } catch (e) {}
                    if (typeof window.renderTable === 'function') {
                        window.renderTable(window.globalDataWarga);
                    }
                }
            }

            // Sinkronkan seketika ke modal edit jika sedang terbuka untuk warga ini
            const curEditId = document.getElementById('editId')?.value;
            const curEditNik = document.getElementById('editNik')?.value;
            if (wData && (String(curEditId) === String(wData.id) || (targetNik && String(curEditNik) === String(targetNik)))) {
                const stSal = document.getElementById('editStatusSalur');
                if (stSal && (wData.status_salur || event.status_salur)) {
                    const salurVal = String(wData.status_salur || event.status_salur).toLowerCase();
                    let matched = false;
                    for (let i = 0; i < stSal.options.length; i++) {
                        const optVal = String(stSal.options[i].value || '').toLowerCase();
                        if (optVal === salurVal || 
                           (salurVal.includes('disalur') && optVal.includes('disalur')) ||
                           (salurVal.includes('terima') && optVal.includes('terima')) ||
                           (salurVal.includes('belum') && optVal.includes('belum'))) {
                            stSal.selectedIndex = i;
                            stSal.value = stSal.options[i].value;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        const realVal = String(wData.status_salur || event.status_salur);
                        const opt = document.createElement('option');
                        opt.value = realVal;
                        opt.text = realVal;
                        stSal.add(opt);
                        stSal.value = realVal;
                    }
                }
                const nomInp = document.getElementById('editNominalBantuan');
                if (nomInp && (wData.nominal_bantuan || event.nominal_bantuan)) {
                    nomInp.value = wData.nominal_bantuan || event.nominal_bantuan;
                }
                const tglInp = document.getElementById('editTanggalSalur');
                if (tglInp && (wData.tanggal_salur || event.tanggal_salur)) {
                    tglInp.value = wData.tanggal_salur || event.tanggal_salur;
                }
                const catInp = document.getElementById('editCatatan');
                if (catInp && (wData.catatan || wData.keterangan_salur || event.keterangan_salur)) {
                    catInp.value = wData.catatan || wData.keterangan_salur || event.keterangan_salur;
                }
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
                list.forEach(evt => {
                    // Jangan pernah replay sinyal panggilan suara/video dari riwayat koneksi
                    if (evt && (String(evt.type).startsWith('CALL_') || String(evt.type).startsWith('WEBRTC_'))) return;
                    handleIncomingEvent(evt);
                });
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

    // 10. JALUR GANDA: BROADCAST CHANNEL & STORAGE EVENT (SINKRONISASI ANTAR-TAB TANPA JEDA)
    try {
        const bc = new BroadcastChannel('bansos_realtime');
        bc.onmessage = function (ev) {
            if (ev.data && ev.data.type) {
                handleIncomingEvent(ev.data);
            }
        };
    } catch (e) {}

    window.addEventListener('storage', function (ev) {
        if (ev.key === 'bansos_realtime_signal' && ev.newValue) {
            try {
                const signal = JSON.parse(ev.newValue);
                if (signal && signal.type) {
                    handleIncomingEvent(signal);
                }
            } catch (err) {}
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
            if (!payload.sender_socket) {
                payload.sender_socket = window.mySessionSocketId;
            }
            if (!payload.id) {
                payload.id = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            }
            if (!payload.timestamp) {
                payload.timestamp = new Date().toISOString();
            }

            // Jalur 1: BroadcastChannel (Sinkronisasi antar-tab seketika 0ms di browser yang sama)
            try {
                if (typeof BroadcastChannel !== 'undefined') {
                    const bc = new BroadcastChannel('bansos_realtime');
                    bc.postMessage(payload);
                    bc.close();
                }
            } catch (e) {}

            // Jalur 2: Storage Event Fallback
            try {
                localStorage.setItem('bansos_realtime_signal', JSON.stringify(payload));
                localStorage.removeItem('bansos_realtime_signal');
            } catch (e) {}

            // Jalur 3: WebSocket Server
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(payload));
                    return true;
                } catch (e) {}
            }
            // Jalur 4: HTTP POST API Fallback
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
