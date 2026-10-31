/**
 * =============================================================================
 * MODUL: publik-webrtc.js
 * Deskripsi: Panggilan Audio/Video Dua Arah WebRTC Real-Time
 * Mendukung panggilan dua arah:
 * - Warga -> Petugas / Admin Bansos / Super Admin
 * - Petugas / Admin Bansos / Super Admin -> Warga
 * =============================================================================
 */

(function (window) {
    'use strict';

    let peerWarga = null;
    let localStreamWarga = null;
    Object.defineProperty(window, 'localStreamWarga', {
        get() { return localStreamWarga; },
        set(v) { localStreamWarga = v; },
        configurable: true
    });
    let currentCallWarga = null;
    let remoteStreamWarga = null;
    Object.defineProperty(window, 'remoteStreamWarga', {
        get() { return remoteStreamWarga; },
        set(v) { remoteStreamWarga = v; },
        configurable: true
    });
    let isVideoSwappedWarga = false;
    let lastWargaSwapTime = 0;
    Object.defineProperty(window, 'isVideoSwappedWarga', {
        get() { return isVideoSwappedWarga; },
        set(v) { isVideoSwappedWarga = v; },
        configurable: true
    });
    let isWargaCameraOff = false;
    Object.defineProperty(window, 'isWargaCameraOff', {
        get() { return isWargaCameraOff; },
        set(v) { isWargaCameraOff = v; },
        configurable: true
    });
    let isWargaAudioMuted = false;
    Object.defineProperty(window, 'isWargaAudioMuted', {
        get() { return isWargaAudioMuted; },
        set(v) { isWargaAudioMuted = v; },
        configurable: true
    });
    let isRemoteCameraOffWarga = false;
    Object.defineProperty(window, 'isRemoteCameraOffWarga', {
        get() { return isRemoteCameraOffWarga; },
        set(v) { isRemoteCameraOffWarga = v; },
        configurable: true
    });
    let isRemoteMicMutedWarga = false;
    Object.defineProperty(window, 'isRemoteMicMutedWarga', {
        get() { return isRemoteMicMutedWarga; },
        set(v) { isRemoteMicMutedWarga = v; },
        configurable: true
    });
    let activeCallPartnerNik = null;
    let callTimerWarga = null;
    let callSecondsWarga = 0;
    let wargaDataConn = null;
    let currentCallId = null;
    let activeCallType = 'audio';
    Object.defineProperty(window, 'activeCallType', {
        get() { return activeCallType; },
        set(v) { activeCallType = v; },
        configurable: true
    });
    let myWargaPeerId = null;
    let pendingIncomingCallData = null;

    function getActiveWargaNik() {
        return (window.sesiAduanAktif && window.sesiAduanAktif.nik) || 
               localStorage.getItem('lastAduanNik') || 
               window.wargaNik || 
               '3515000000000000';
    }

    function getActiveWargaNama() {
        return (window.sesiAduanAktif && window.sesiAduanAktif.nama) || 
               localStorage.getItem('lastAduanNama') || 
               window.wargaNama || 
               'Warga Sidoarjo';
    }

    function createSilentBlackVideoTrackWarga(width = 640, height = 480) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#050b14';
                ctx.fillRect(0, 0, width, height);
            }
            const stream = canvas.captureStream ? canvas.captureStream(10) : null;
            if (stream && stream.getVideoTracks().length > 0) {
                const track = stream.getVideoTracks()[0];
                track.enabled = true;

                // Loop animasi kontinyu 10 FPS untuk menjaga pipeline WebRTC tetap hidup tanpa freeze
                let frameCount = 0;
                const timer = setInterval(() => {
                    if (track.readyState === 'ended') {
                        clearInterval(timer);
                        return;
                    }
                    if (ctx) {
                        ctx.fillStyle = '#050b14';
                        ctx.fillRect(0, 0, width, height);
                        frameCount = (frameCount + 1) % 10;
                        ctx.fillStyle = (frameCount % 2 === 0) ? '#050b15' : '#050b14';
                        ctx.fillRect(0, 0, 1, 1);
                    }
                }, 100);

                track.addEventListener('ended', () => {
                    clearInterval(timer);
                });

                return track;
            }
        } catch (e) {
            console.warn('[SILENT_TRACK_WARGA_ERR]', e);
        }
        return null;
    }

    function findVideoSenderWarga(pc) {
        if (!pc) return null;
        try {
            if (typeof pc.getTransceivers === 'function') {
                const tc = pc.getTransceivers().find(t => 
                    (t.sender && t.sender.track && t.sender.track.kind === 'video') ||
                    (t.receiver && t.receiver.track && t.receiver.track.kind === 'video') ||
                    (t.mid && String(t.mid).toLowerCase().includes('video'))
                );
                if (tc && tc.sender) return tc.sender;
            }
            if (typeof pc.getSenders === 'function') {
                const senders = pc.getSenders();
                const vs = senders.find(s => s.track && s.track.kind === 'video');
                if (vs) return vs;
                const as = senders.find(s => s.track && s.track.kind === 'audio');
                const candidate = senders.find(s => s !== as);
                if (candidate) return candidate;
            }
        } catch (e) {
            console.warn('[FIND_VIDEO_SENDER_WARGA_ERR]', e);
        }
        return null;
    }

    function findAudioSenderWarga(pc) {
        if (!pc) return null;
        try {
            if (typeof pc.getTransceivers === 'function') {
                const tc = pc.getTransceivers().find(t => 
                    (t.sender && t.sender.track && t.sender.track.kind === 'audio') ||
                    (t.receiver && t.receiver.track && t.receiver.track.kind === 'audio') ||
                    (t.mid && String(t.mid).toLowerCase().includes('audio'))
                );
                if (tc && tc.sender) return tc.sender;
            }
            if (typeof pc.getSenders === 'function') {
                const senders = pc.getSenders();
                const as = senders.find(s => s.track && s.track.kind === 'audio');
                if (as) return as;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function findAudioSenderWarga(pc) {
        if (!pc || typeof pc.getSenders !== 'function') return null;
        try {
            const senders = pc.getSenders();
            let as = senders.find(s => s.track && s.track.kind === 'audio');
            if (as) return as;
            if (typeof pc.getTransceivers === 'function') {
                const tc = pc.getTransceivers().find(t => 
                    (t.sender && t.sender.track && t.sender.track.kind === 'audio') ||
                    (t.receiver && t.receiver.track && t.receiver.track.kind === 'audio') ||
                    (t.mid && String(t.mid).toLowerCase().includes('audio'))
                );
                if (tc && tc.sender) return tc.sender;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function ensureRemoteAudioPlayingWarga() {
        if (!remoteStreamWarga) return;
        let audioEl = document.getElementById('wargaRemoteAudioPlayer');
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'wargaRemoteAudioPlayer';
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
        }
        if (audioEl.srcObject !== remoteStreamWarga) {
            audioEl.srcObject = remoteStreamWarga;
        }
        audioEl.play().catch(() => {});
    }

    /**
     * Inisialisasi PeerJS untuk Portal Warga dengan ID unik yang dipertukarkan via WebSocket
     */
    window.initPeerWarga = function (callback) {
        if (peerWarga && !peerWarga.destroyed && myWargaPeerId) {
            if (callback) callback(myWargaPeerId);
            return;
        }

        const activeNik = getActiveWargaNik();
        myWargaPeerId = `warga_${activeNik}_${Date.now().toString().slice(-6)}`;

        try {
            peerWarga = new Peer(myWargaPeerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peerWarga.on('open', (id) => {
                myWargaPeerId = id;
                if (callback) callback(id);
            });

            peerWarga.on('call', (call) => {
                if (currentCallWarga && currentCallWarga.open && currentCallWarga !== call) {
                    try { currentCallWarga.close(); } catch(e){}
                }
                currentCallWarga = call;
                if (localStreamWarga) {
                    call.answer(localStreamWarga);
                    window.handleCallConnectedWarga(call, activeCallType === 'video');
                } else {
                    const isVideo = (call.metadata && call.metadata.type === 'video') || (activeCallType === 'video');
                    if (isVideo) {
                        navigator.mediaDevices.getUserMedia({
                            audio: true,
                            video: { width: { ideal: 640 }, height: { ideal: 480 } }
                        }).then(stream => {
                            localStreamWarga = stream;
                            call.answer(localStreamWarga);
                            window.handleCallConnectedWarga(call, true);
                        }).catch(() => {
                            call.close();
                        });
                    } else {
                        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
                            localStreamWarga = stream;
                            const dummyTrack = createSilentBlackVideoTrackWarga();
                            if (dummyTrack) localStreamWarga.addTrack(dummyTrack);
                            call.answer(localStreamWarga);
                            window.handleCallConnectedWarga(call, false);
                        }).catch(() => {
                            call.close();
                        });
                    }
                }
            });

            peerWarga.on('connection', conn => {
                wargaDataConn = conn;
                conn.on('data', data => {
                    if (!data) return;
                    if (data.type === 'reaction') {
                        window.showFloatingReactionWarga(data.emoji);
                    } else if (data.type === 'CALL_MEDIA_STATE') {
                        if (typeof window.handleCallMediaStateSignalWarga === 'function') {
                            window.handleCallMediaStateSignalWarga(data);
                        }
                    } else if (data.type === 'CALL_SWITCH_MODE') {
                        if (typeof window.handleCallSwitchModeSignalWarga === 'function') {
                            window.handleCallSwitchModeSignalWarga(data);
                        }
                    } else if (data.type === 'CALL_SWITCH_REQUEST') {
                        if (typeof window.handleCallSwitchRequestSignalWarga === 'function') {
                            window.handleCallSwitchRequestSignalWarga(data);
                        }
                    } else if (data.type === 'CALL_SWITCH_RESPONSE') {
                        if (typeof window.handleCallSwitchResponseSignalWarga === 'function') {
                            window.handleCallSwitchResponseSignalWarga(data);
                        }
                    }
                });
            });

            peerWarga.on('error', (err) => {
                console.warn('[PEER_WARGA_ERROR]', err);
            });
        } catch (e) {
            console.warn('[PEER_INIT_FAIL]', e);
        }
    };

    /**
     * Warga Memulai Panggilan ke Petugas/Admin/Super Admin
     */
    window.startCallAdminFromAduan = function (type = 'audio') {
        window.startCallAdmin(type);
    };

    window.startCallAdmin = async function (type = 'audio') {
        activeCallType = type;
        const isVideo = (type === 'video');
        const activeNik = getActiveWargaNik();
        const activeNama = getActiveWargaNama();

        currentCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // 1. Dapatkan akses mikrofon dan kamera
        try {
            isWargaCameraOff = !isVideo;
            isWargaAudioMuted = false;
            if (isVideo) {
                localStreamWarga = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: { width: { ideal: 640 }, height: { ideal: 480 } }
                });
            } else {
                localStreamWarga = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const silentTrack = createSilentBlackVideoTrackWarga();
                if (silentTrack) localStreamWarga.addTrack(silentTrack);
            }
        } catch (e) {
            return Swal.fire({
                icon: 'error',
                title: 'Izin Perangkat Ditolak',
                text: 'Izinkan akses mikrofon dan kamera di peramban Anda untuk melakukan panggilan.',
                confirmButtonColor: '#dc2626'
            });
        }

        // 2. Siapkan antarmuka UI panggilan keluar warga
        const modal = document.getElementById('wargaActiveCallUI');
        const activeCard = document.getElementById('wargaActiveCallCard');
        const nameEl = document.getElementById('wargaActiveCallName');
        const chipEl = document.getElementById('wargaActiveCallTypeChip');
        const dotEl = document.getElementById('wargaCallStatusDot');
        const statusEl = document.getElementById('wargaCallStatusText');
        const vArea = document.getElementById('wargaVideoCallArea');
        const aArea = document.getElementById('wargaAudioCallArea');
        const localV = document.getElementById('wargaLocalVideo');

        if (activeCard) {
            activeCard.setAttribute('data-mode', isVideo ? 'video' : 'audio');
            activeCard.setAttribute('data-state', 'calling');
            activeCard.setAttribute('data-cam', 'on');
        }
        if (chipEl) {
            chipEl.innerHTML = isVideo ? '<i class="fas fa-video"></i> Video Call' : '<i class="fas fa-phone-alt"></i> Panggilan Suara';
        }
        if (dotEl) dotEl.className = 'status-indicator-dot dot-calling';
        if (statusEl) statusEl.innerText = 'Memanggil';

        if (modal) modal.style.display = 'flex';
        window.activeCallPartnerName = 'Petugas Dinsos Sidoarjo';
        if (nameEl) {
            nameEl.innerText = 'Petugas Dinsos Sidoarjo';
            nameEl.setAttribute('data-partner-name', 'Petugas Dinsos Sidoarjo');
        }

        remoteStreamWarga = null;
        isVideoSwappedWarga = false;
        isWargaCameraOff = false;
        isWargaAudioMuted = false;
        if (typeof window.updateVideoViewsWarga === 'function') {
            window.updateVideoViewsWarga();
        }

        // Mainkan nada sambung keluar
        if (window.RealtimeHub && typeof window.RealtimeHub.startRingtone === 'function') {
            window.RealtimeHub.startRingtone();
        }

        // 3. Inisialisasi Peer dan siarkan sinyal CALL_INVITE ke seluruh aparatur online
        window.initPeerWarga((myPeerId) => {
            const signalPayload = {
                type: 'CALL_INVITE',
                call_id: currentCallId,
                caller_role: 'warga',
                caller_name: activeNama,
                caller_nik: activeNik,
                target_role: 'aparatur',
                call_type: type,
                peer_id: myPeerId
            };

            if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
                window.RealtimeHub.send(signalPayload);
            }

            // Catat ke log chat warga
            fetch(`/api/chat/${encodeURIComponent(activeNik)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: 'warga',
                    nama: activeNama,
                    pesan: `[📞 PANGGILAN ${type.toUpperCase()}] Warga memulai panggilan langsung bersama petugas/admin.`
                })
            }).catch(() => {});
        });
    };

    /**
     * Warga Menerima Panggilan Masuk dari Aparatur (Super Admin / Admin / Petugas)
     */
    window.terimaPanggilanMasukWarga = function (event) {
        pendingIncomingCallData = event;
        activeCallType = event.call_type || 'audio';
        currentCallId = event.call_id || `call_${Date.now()}`;
        activeCallPartnerNik = event.caller_nik || event.sender_id || 'aparatur';

        const incomingModal = document.getElementById('wargaIncomingCallUI');
        const nameEl = document.getElementById('wargaCallerNameText');
        const roleBadge = document.getElementById('wargaCallerRoleBadge');
        const typeEl = document.getElementById('wargaCallerTypeText');

        const callerRole = (event.caller_role || 'Petugas').toUpperCase();
        let defaultRoleName = 'Petugas Dinsos';
        if (callerRole.includes('SUPER')) defaultRoleName = 'Super Admin';
        else if (callerRole.includes('ADMIN')) defaultRoleName = 'Admin Bansos';

        window.activeCallPartnerName = event.caller_name || defaultRoleName;
        if (nameEl) {
            nameEl.innerText = window.activeCallPartnerName;
            nameEl.setAttribute('data-partner-name', window.activeCallPartnerName);
        }
        if (roleBadge) {
            const roleTitle = (event.caller_role || 'Petugas Resmi').toUpperCase();
            roleBadge.innerText = roleTitle;
            if (roleTitle.includes('SUPER')) {
                roleBadge.style.background = '#fee2e2';
                roleBadge.style.color = '#dc2626';
                roleBadge.style.borderColor = '#fca5a5';
            } else if (roleTitle.includes('ADMIN')) {
                roleBadge.style.background = '#e0e7ff';
                roleBadge.style.color = '#4338ca';
                roleBadge.style.borderColor = '#c7d2fe';
            } else {
                roleBadge.style.background = '#dcfce7';
                roleBadge.style.color = '#15803d';
                roleBadge.style.borderColor = '#86efac';
            }
        }

        const isVideo = (event.call_type === 'video');
        const incomingCard = document.getElementById('wargaIncomingCallCard');
        const badge = document.getElementById('wargaIncomingCallBadge');
        const icon = document.getElementById('wargaIncomingCallIcon');
        const acceptIcon = document.getElementById('wargaIncomingAcceptIcon');

        if (incomingCard) incomingCard.setAttribute('data-type', isVideo ? 'video' : 'audio');
        if (badge) {
            badge.innerHTML = isVideo ? '<i class="fas fa-video"></i> Panggilan Video Masuk' : '<i class="fas fa-phone-alt"></i> Panggilan Suara Masuk';
        }
        if (icon) icon.className = isVideo ? 'fas fa-video' : 'fas fa-phone-alt';
        if (acceptIcon) acceptIcon.className = isVideo ? 'fas fa-video' : 'fas fa-phone-alt';

        if (typeEl) {
            typeEl.innerText = `Panggilan ${isVideo ? 'Video Call' : 'Suara'} Terverifikasi`;
        }

        if (incomingModal) incomingModal.style.display = 'flex';

        // Beritahu aparatur/penghubung bahwa perangkat warga online dan berdering
        if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send({
                type: 'CALL_RINGING',
                call_id: event.call_id,
                target_nik: event.caller_nik || event.target_nik
            });
        }

        // Bunyikan dering panggilan masuk
        if (window.RealtimeHub && typeof window.RealtimeHub.startRingtone === 'function') {
            window.RealtimeHub.startRingtone();
        }
    };

    /**
     * Warga Menekan Tombol Terima Panggilan
     */
    window.acceptCallWarga = async function () {
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        const incomingModal = document.getElementById('wargaIncomingCallUI');
        if (incomingModal) incomingModal.style.display = 'none';

        const event = pendingIncomingCallData;
        if (!event) return;

        currentCallId = event.call_id || currentCallId;
        activeCallPartnerNik = event.caller_nik || event.sender_id || 'aparatur';

        const isVideo = (event.call_type === 'video');
        isWargaCameraOff = !isVideo;
        isWargaAudioMuted = false;

        try {
            if (isVideo) {
                localStreamWarga = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: { width: { ideal: 640 }, height: { ideal: 480 } }
                });
            } else {
                localStreamWarga = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                const silentTrack = createSilentBlackVideoTrackWarga();
                if (silentTrack) localStreamWarga.addTrack(silentTrack);
            }
        } catch (e) {
            window.rejectCallWarga('Akses kamera/mikrofon ditolak warga');
            return;
        }

        window.initPeerWarga((myPeerId) => {
            // Kirim sinyal CALL_ACCEPT ke aparatur
            if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
                window.RealtimeHub.send({
                    type: 'CALL_ACCEPT',
                    call_id: event.call_id,
                    caller_nik: event.caller_nik,
                    target_nik: getActiveWargaNik(),
                    peer_id: myPeerId,
                    target_name: getActiveWargaNama()
                });
            }

            // Panggil balik peer aparatur jika peer_id tersedia
            if (event.peer_id && peerWarga) {
                const call = peerWarga.call(event.peer_id, localStreamWarga, {
                    metadata: { type: event.call_type, nik: getActiveWargaNik() }
                });
                if (call) {
                    window.handleCallConnectedWarga(call, isVideo);
                }
            }
        });
    };

    /**
     * Warga Menolak Panggilan
     */
    window.rejectCallWarga = function (reason = 'Ditolak oleh warga') {
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        const incomingModal = document.getElementById('wargaIncomingCallUI');
        if (incomingModal) incomingModal.style.display = 'none';

        if (pendingIncomingCallData) {
            if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
                window.RealtimeHub.send({
                    type: 'CALL_DECLINE',
                    call_id: pendingIncomingCallData.call_id,
                    target_nik: getActiveWargaNik(),
                    reason: reason
                });
            }
        }
        pendingIncomingCallData = null;
    };

    /**
     * Sinyal CALL_ACCEPT Diterima oleh Warga (Panggilan Warga ke Aparatur Diangkat)
     */
    window.handleCallAcceptedSignal = function (event) {
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        const activeCard = document.getElementById('wargaActiveCallCard');
        const dotEl = document.getElementById('wargaCallStatusDot');
        if (activeCard) activeCard.setAttribute('data-state', 'connected');
        if (dotEl) dotEl.className = 'status-indicator-dot dot-connected';

        const nameEl = document.getElementById('wargaActiveCallName');
        const statusEl = document.getElementById('wargaCallStatusText');
        const partnerName = event.caller_name || window.activeCallPartnerName || 'Petugas Dinsos Terhubung';
        window.activeCallPartnerName = partnerName;
        activeCallPartnerNik = event.caller_nik || event.sender_id || event.target_nik || 'aparatur';
        if (nameEl) {
            nameEl.innerText = partnerName;
            nameEl.setAttribute('data-partner-name', partnerName);
        }
        if (statusEl) statusEl.innerText = '00:00';

        // Callee (Aparatur) yang menekan 'Angkat' memanggil peerWarga via peer.call().
        // Caller (Warga) TIDAK melakukan peer.call() untuk menghindari Dual-Call Race Glare.
        // Fallback: Jika setelah 3.5 detik peer belum terhubung, lakukan dial balik darurat.
        setTimeout(() => {
            if (!currentCallWarga && event.peer_id && peerWarga && localStreamWarga) {
                console.log('[WEBRTC FALLBACK] Callee aparatur did not dial, dialing from Warga...');
                const call = peerWarga.call(event.peer_id, localStreamWarga, {
                    metadata: { type: activeCallType, nik: getActiveWargaNik() }
                });
                if (call) {
                    window.handleCallConnectedWarga(call, activeCallType === 'video');
                }
            }
        }, 3500);
    };

    /**
     * Sinyal CALL_DECLINE atau CALL_END Diterima dari Aparatur
     */
    window.handleCallEndedSignalWarga = function (event) {
        if (!event) return;
        if (event.sender_socket && event.sender_socket === window.mySessionSocketId) return;

        const activeModal = document.getElementById('wargaActiveCallUI');
        const isModalActive = (activeModal && activeModal.style.display !== 'none') || Boolean(currentCallWarga || localStreamWarga);
        const incomingModal = document.getElementById('wargaIncomingCallUI');
        const isIncoming = (incomingModal && incomingModal.style.display !== 'none') || Boolean(pendingIncomingCallData);

        if (!isModalActive && !isIncoming) {
            return;
        }

        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        if (incomingModal) incomingModal.style.display = 'none';
        pendingIncomingCallData = null;

        window.endCallWarga(false);
    };
    window.handleCallEndedSignal = window.handleCallEndedSignalWarga;

    /**
     * Penanganan saat panggilan aktif terhubung
     */
    window.handleCallConnectedWarga = function (call, isVideo) {
        currentCallWarga = call;
        const modal = document.getElementById('wargaActiveCallUI');
        const vArea = document.getElementById('wargaVideoCallArea');
        const aArea = document.getElementById('wargaAudioCallArea');
        const localV = document.getElementById('wargaLocalVideo');
        const remoteV = document.getElementById('wargaRemoteVideo');
        const timerEl = document.getElementById('wargaCallStatusText');

        if (modal) modal.style.display = 'flex';

        const activeCard = document.getElementById('wargaActiveCallCard');
        const chipEl = document.getElementById('wargaActiveCallTypeChip');
        const dotEl = document.getElementById('wargaCallStatusDot');

        if (activeCard) {
            activeCard.setAttribute('data-mode', isVideo ? 'video' : 'audio');
            activeCard.setAttribute('data-state', 'connected');
            activeCard.setAttribute('data-cam', 'on');
        }
        if (chipEl) {
            chipEl.innerHTML = isVideo ? '<i class="fas fa-video"></i> Video Call' : '<i class="fas fa-phone-alt"></i> Panggilan Suara';
        }
        if (dotEl) dotEl.className = 'status-indicator-dot dot-connected';

        if (typeof window.updateVideoViewsWarga === 'function') {
            window.updateVideoViewsWarga();
        }

        call.on('stream', remoteStream => {
            remoteStreamWarga = remoteStream;
            remoteStream.getVideoTracks().forEach(t => {
                t.onunmute = () => {
                    if (typeof window.updateVideoViewsWarga === 'function') window.updateVideoViewsWarga();
                    unfreezeVideoPlayersWarga();
                };
            });
            ensureRemoteAudioPlayingWarga();
            if (typeof window.updateVideoViewsWarga === 'function') {
                window.updateVideoViewsWarga();
            }
            unfreezeVideoPlayersWarga();
        });

        if (call.peerConnection) {
            call.peerConnection.ontrack = (ev) => {
                if (ev.streams && ev.streams[0]) {
                    remoteStreamWarga = ev.streams[0];
                } else if (ev.track && remoteStreamWarga) {
                    if (!remoteStreamWarga.getTracks().find(t => t.id === ev.track.id)) {
                        remoteStreamWarga.addTrack(ev.track);
                    }
                }
                if (ev.track) {
                    ev.track.onunmute = () => {
                        if (typeof window.updateVideoViewsWarga === 'function') window.updateVideoViewsWarga();
                        unfreezeVideoPlayersWarga();
                    };
                }
                ensureRemoteAudioPlayingWarga();
                if (typeof window.updateVideoViewsWarga === 'function') {
                    window.updateVideoViewsWarga();
                }
                unfreezeVideoPlayersWarga();
            };
        }

        call.on('close', () => {
            window.endCallWarga();
        });

        callSecondsWarga = 0;
        if (callTimerWarga) clearInterval(callTimerWarga);
        callTimerWarga = setInterval(() => {
            callSecondsWarga++;
            const m = String(Math.floor(callSecondsWarga / 60)).padStart(2, '0');
            const s = String(callSecondsWarga % 60).padStart(2, '0');
            if (timerEl) timerEl.innerText = `${m}:${s}`;
            const mAudio = document.getElementById('wargaMinimizedAudioTimer');
            if (mAudio) mAudio.innerHTML = `<span class="status-indicator-dot dot-connected"></span> ${m}:${s}`;
            const mVideo = document.getElementById('wargaMinVideoTimer');
            if (mVideo) mVideo.innerHTML = `<span class="status-indicator-dot dot-connected"></span> ${m}:${s}`;
        }, 1000);
    };

    /**
     * Kontrol Mikrofon (Mute/Unmute)
     */
    
    function broadcastCallMediaStateWarga() {
        const stateMsg = {
            type: 'CALL_MEDIA_STATE',
            call_id: currentCallId,
            sender_socket: window.mySessionSocketId,
            target_nik: activeCallPartnerNik || 'aparatur',
            is_cam_off: isWargaCameraOff,
            is_mic_muted: isWargaAudioMuted
        };
        if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send(stateMsg);
        }
        if (wargaDataConn && wargaDataConn.open) {
            try { wargaDataConn.send(stateMsg); } catch (e) {}
        }
    }

    window.unfreezeVideoPlayersWarga = function unfreezeVideoPlayersWarga() {
        const mainVid = document.getElementById('wargaRemoteVideo');
        const pipVid = document.getElementById('wargaLocalVideo');
        if (!mainVid && !pipVid) return;

        const remoteEl = isVideoSwappedWarga ? pipVid : mainVid;
        const localEl = isVideoSwappedWarga ? mainVid : pipVid;

        if (remoteEl && remoteStreamWarga) {
            try {
                if (remoteEl.srcObject !== remoteStreamWarga) {
                    remoteEl.srcObject = remoteStreamWarga;
                }
                remoteEl.muted = true;
                const p = remoteEl.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (e) {}
        }

        if (localEl && localStreamWarga) {
            try {
                if (localEl.srcObject !== localStreamWarga) {
                    localEl.srcObject = localStreamWarga;
                }
                localEl.muted = true;
                const p = localEl.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (e) {}
        }

        ensureRemoteAudioPlayingWarga();

        // Segera perbarui overlay agar overlay "Menghubungkan video..." segera tertutup saat stream hadir
        if (typeof window.updateVideoViewsWarga === 'function') {
            window.updateVideoViewsWarga();
        }

        const ensurePlay = () => {
            if (remoteEl && remoteEl.paused) remoteEl.play().catch(() => {});
            if (localEl && localEl.paused) localEl.play().catch(() => {});
        };

        setTimeout(ensurePlay, 80);
        setTimeout(ensurePlay, 250);
        setTimeout(ensurePlay, 600);
    };

    window.handleCallMediaStateSignalWarga = function (event) {
        if (!event) return;
        if (event.sender_socket && event.sender_socket === window.mySessionSocketId) return;
        if (event.is_cam_off !== undefined) {
            isRemoteCameraOffWarga = Boolean(event.is_cam_off);
        }
        if (event.is_mic_muted !== undefined) {
            isRemoteMicMutedWarga = Boolean(event.is_mic_muted);
        }

        // Ketika kamera lawan dihidupkan kembali, re-bind wrapper MediaStream segar untuk melepas buffer lock
        if (!isRemoteCameraOffWarga && remoteStreamWarga) {
            const remoteEl = isVideoSwappedWarga ? document.getElementById('wargaLocalVideo') : document.getElementById('wargaRemoteVideo');
            if (remoteEl) {
                try {
                    remoteEl.srcObject = new MediaStream(remoteStreamWarga.getTracks());
                    remoteEl.muted = true;
                    remoteEl.play().catch(() => {});
                } catch (e) {}
            }
        }

        window.updateVideoViewsWarga();
        unfreezeVideoPlayersWarga();
        if (!isRemoteCameraOffWarga) {
            setTimeout(() => {
                if (typeof window.updateVideoViewsWarga === 'function') window.updateVideoViewsWarga();
                unfreezeVideoPlayersWarga();
            }, 200);
            setTimeout(() => {
                if (typeof window.updateVideoViewsWarga === 'function') window.updateVideoViewsWarga();
                unfreezeVideoPlayersWarga();
            }, 600);
        }
    };

    window.updateVideoViewsWarga = function () {
        const vArea = document.getElementById('wargaVideoCallArea');
        const aArea = document.getElementById('wargaAudioCallArea');
        const mainVid = document.getElementById('wargaRemoteVideo');
        const pipContainer = document.getElementById('wargaVideoPipContainer');
        const pipVid = document.getElementById('wargaLocalVideo');
        const pipLabel = document.getElementById('wargaPipTagLabel');
        const mainCamOff = document.getElementById('wargaMainCameraOffOverlay');
        const pipCamOff = document.getElementById('wargaPipCameraOffOverlay');
        const card = document.getElementById('wargaActiveCallCard');
        const chip = document.getElementById('wargaActiveCallTypeChip');
        const btnVideo = document.getElementById('wargaBtnVideo');

        const setOverlay = (el, show, customText) => {
            if (!el) return;
            el.classList.toggle('is-active', !!show);
            el.style.display = show ? 'flex' : 'none';
            if (show && customText) {
                const txt = el.querySelector('.cam-off-text') || el.querySelector('span');
                if (txt) txt.innerText = customText;
            }
        };

        if (activeCallType !== 'video') {
            // MODE TELEPON (AUDIO)
            if (card) card.setAttribute('data-mode', 'audio');
            if (chip) chip.innerHTML = '<i class="fas fa-phone-alt"></i> Panggilan Suara';
            if (vArea) vArea.style.display = 'none';
            if (aArea) aArea.style.display = 'flex';
            if (btnVideo) {
                btnVideo.className = 'call-ctrl-btn call-video-only off';
                btnVideo.innerHTML = '<i class="fas fa-video-slash"></i>';
                btnVideo.title = 'Beralih ke Video Call';
            }
            setOverlay(mainCamOff, false);
            setOverlay(pipCamOff, false);

            const minMicBadgeW = document.getElementById('wargaMinMicOffBadge');
            if (minMicBadgeW) minMicBadgeW.style.display = isWargaAudioMuted ? 'inline-flex' : 'none';
            const minMicBadgeWA = document.getElementById('wargaMinMicOffBadgeA');
            if (minMicBadgeWA) minMicBadgeWA.style.display = isWargaAudioMuted ? 'inline-flex' : 'none';
            return;
        }

        // MODE VIDEO CALL
        if (card) {
            card.setAttribute('data-mode', 'video');
            card.setAttribute('data-cam', isWargaCameraOff ? 'off' : 'on');
        }
        if (chip) chip.innerHTML = '<i class="fas fa-video"></i> Video Call';
        if (vArea) vArea.style.display = 'block';
        if (aArea) aArea.style.display = 'none';
        if (btnVideo) {
            btnVideo.className = isWargaCameraOff ? 'call-ctrl-btn call-video-only off' : 'call-ctrl-btn call-video-only';
            btnVideo.innerHTML = isWargaCameraOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
            btnVideo.title = isWargaCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera';
        }

        const callNameEl = document.getElementById('wargaActiveCallName');
        const petName = window.activeCallPartnerName || (callNameEl && callNameEl.getAttribute('data-partner-name')) || 'Petugas Dinsos';
        const wargaName = getActiveWargaNama() || 'Warga';

        // MODE VIDEO: PiP Container SELALU aktif dan muncul seketika saat mode video
        if (pipContainer) pipContainer.style.display = 'block';

        if (!remoteStreamWarga) {
            // Belum terhubung dengan stream aparatur (sedang handshake atau remote stream belum tiba)
            if (pipVid) {
                if (pipVid.srcObject !== localStreamWarga) pipVid.srcObject = localStreamWarga;
                pipVid.muted = true;
                pipVid.style.transform = 'scaleX(-1)';
                pipVid.play().catch(() => {});
            }
            if (mainVid) {
                mainVid.srcObject = null;
            }
            if (callNameEl) callNameEl.innerText = petName;
            if (pipLabel) pipLabel.innerText = wargaName;
            setOverlay(mainCamOff, true, `Menghubungkan video ${petName}...`);
            setOverlay(pipCamOff, isWargaCameraOff, `Kamera ${wargaName} Dimatikan`);
        } else {
            // Sudah terhubung (ada remoteStreamWarga dan localStreamWarga)
            if (!isVideoSwappedWarga) {
                // Tampilan Normal: Layar Besar = Petugas Dinsos (Remote), PiP = Kamera Warga (Lokal)
                if (mainVid) {
                    if (mainVid.srcObject !== remoteStreamWarga) mainVid.srcObject = remoteStreamWarga;
                    mainVid.muted = true;
                    mainVid.style.transform = 'none';
                    mainVid.play().catch(() => {});
                }
                if (pipVid) {
                    if (pipVid.srcObject !== localStreamWarga) pipVid.srcObject = localStreamWarga;
                    pipVid.muted = true;
                    pipVid.style.transform = 'scaleX(-1)';
                    pipVid.play().catch(() => {});
                }
                if (callNameEl) callNameEl.innerText = petName;
                if (pipLabel) pipLabel.innerText = wargaName;
                setOverlay(mainCamOff, isRemoteCameraOffWarga, `Kamera ${petName} Dimatikan`);
                setOverlay(pipCamOff, isWargaCameraOff, `Kamera ${wargaName} Dimatikan`);
            } else {
                // Tampilan Swapped: Layar Besar = Kamera Warga (Lokal), PiP = Petugas Dinsos (Remote)
                if (mainVid) {
                    if (mainVid.srcObject !== localStreamWarga) mainVid.srcObject = localStreamWarga;
                    mainVid.muted = true;
                    mainVid.style.transform = 'scaleX(-1)';
                    mainVid.play().catch(() => {});
                }
                if (pipVid) {
                    if (pipVid.srcObject !== remoteStreamWarga) pipVid.srcObject = remoteStreamWarga;
                    pipVid.muted = true;
                    pipVid.style.transform = 'none';
                    pipVid.play().catch(() => {});
                }
                if (callNameEl) callNameEl.innerText = wargaName;
                if (pipLabel) pipLabel.innerText = petName;
                setOverlay(mainCamOff, isWargaCameraOff, `Kamera ${wargaName} Dimatikan`);
                setOverlay(pipCamOff, isRemoteCameraOffWarga, `Kamera ${petName} Dimatikan`);
            }
        }

        const minCamBadge = document.getElementById('wargaMinCamOffBadge');
        if (minCamBadge) minCamBadge.style.display = isWargaCameraOff ? 'inline-flex' : 'none';
        const minMicBadge = document.getElementById('wargaMinMicOffBadge');
        if (minMicBadge) minMicBadge.style.display = isWargaAudioMuted ? 'inline-flex' : 'none';
        const minMicBadgeA = document.getElementById('wargaMinMicOffBadgeA');
        if (minMicBadgeA) minMicBadgeA.style.display = isWargaAudioMuted ? 'inline-flex' : 'none';
    };

    // ALUR PERALIHAN TELEPON KE VIDEO CALL DENGAN AJAKAN & KONFIRMASI MULUS (WARGA)
    window.toggleVideoCallWarga = async function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const activeCard = document.getElementById('wargaActiveCallCard');
        const currentMode = (activeCard && activeCard.getAttribute('data-mode')) || (activeCallType === 'video' ? 'video' : 'audio');
        if (currentMode === 'video') {
            // Dalam mode video, tombol kamera berfungsi untuk mematikan / menyalakan hardware kamera
            return window.toggleCameraModeCallWarga(e);
        }
        // Dalam mode audio, tombol kamera kirim ajakan beralih ke Video Call
        await window.requestSwitchToVideoWarga();
    };

    window.requestSwitchToVideoWarga = async function () {
        const targetNik = activeCallPartnerNik || getActiveWargaNik();
        const myName = getActiveWargaNama();
        const reqMsg = {
            type: 'CALL_SWITCH_REQUEST',
            from_role: 'warga',
            from_name: myName,
            sender_socket: window.mySessionSocketId,
            target_nik: targetNik
        };
        if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send(reqMsg);
        }
        if (wargaDataConn && wargaDataConn.open) {
            try { wargaDataConn.send(reqMsg); } catch(e){}
        }

        window.isWaitingCallSwitchResponseWarga = true;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Mengajak ke Video Call...',
                html: 'Menunggu konfirmasi petugas untuk mengaktifkan kamera.<br><small class="text-muted">Panggilan suara tetap terhubung dengan lancar.</small>',
                icon: 'info',
                showCancelButton: true,
                cancelButtonColor: '#64748b',
                cancelButtonText: 'Batalkan Ajakan',
                showConfirmButton: false,
                allowOutsideClick: false
            }).then(r => {
                if (r.dismiss === Swal.DismissReason.cancel) {
                    window.isWaitingCallSwitchResponseWarga = false;
                }
            });
        }
    };

    window.handleCallSwitchRequestSignalWarga = async function (event) {
        if (!event) return;
        if (event.sender_socket && event.sender_socket === window.mySessionSocketId) return;

        const callerName = event.from_name || window.activeCallPartnerName || 'Petugas';
        let isAccepted = false;

        if (typeof Swal !== 'undefined') {
            const res = await Swal.fire({
                title: 'Ajakan Video Call',
                html: `<b>${callerName}</b> mengajak Anda beralih ke <b>Video Call</b>.<br>Apakah Anda bersedia mengaktifkan kamera?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i class="fas fa-video"></i> Ya, Beralih ke Video Call',
                cancelButtonText: '<i class="fas fa-phone-alt"></i> Tetap Panggilan Suara',
                reverseButtons: true,
                allowOutsideClick: false,
                timer: 20000,
                timerProgressBar: true
            });
            isAccepted = Boolean(res.isConfirmed);
        } else {
            isAccepted = window.confirm(`${callerName} mengajak beralih ke Video Call. Aktifkan kamera?`);
        }

        const respMsg = {
            type: 'CALL_SWITCH_RESPONSE',
            accepted: isAccepted,
            sender_socket: window.mySessionSocketId,
            target_nik: activeCallPartnerNik || getActiveWargaNik()
        };
        if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send(respMsg);
        }
        if (wargaDataConn && wargaDataConn.open) {
            try { wargaDataConn.send(respMsg); } catch(e){}
        }

        if (isAccepted) {
            await window.performSeamlessUpgradeToVideoWarga();
        }
    };

    window.handleCallSwitchResponseSignalWarga = async function (event) {
        if (!event) return;
        if (event.sender_socket && event.sender_socket === window.mySessionSocketId) return;

        if (window.isWaitingCallSwitchResponseWarga) {
            window.isWaitingCallSwitchResponseWarga = false;
            try { if (typeof Swal !== 'undefined') Swal.close(); } catch(e){}
        }

        if (event.accepted) {
            await window.performSeamlessUpgradeToVideoWarga();
        } else {
            const partner = window.activeCallPartnerName || 'Petugas';
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Tetap Panggilan Suara',
                    text: `${partner} memilih untuk tetap menggunakan panggilan suara.`,
                    icon: 'info',
                    timer: 2500,
                    showConfirmButton: false
                });
            }
        }
    };

    window.performSeamlessUpgradeToVideoWarga = async function () {
        activeCallType = 'video';
        isWargaCameraOff = false;
        try {
            if (localStreamWarga) {
                localStreamWarga.getVideoTracks().forEach(t => {
                    try { t.stop(); } catch(e){}
                    localStreamWarga.removeTrack(t);
                });
            }
            const camStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 30, min: 15 } },
                audio: false
            });
            const realVTrack = camStream.getVideoTracks()[0];
            if (realVTrack) realVTrack.contentHint = 'motion';

            if (localStreamWarga) {
                localStreamWarga.addTrack(realVTrack);
            } else {
                localStreamWarga = camStream;
            }

            if (currentCallWarga && currentCallWarga.peerConnection) {
                const vSender = findVideoSenderWarga(currentCallWarga.peerConnection);
                if (vSender) {
                    await vSender.replaceTrack(realVTrack);
                } else {
                    currentCallWarga.peerConnection.addTrack(realVTrack, localStreamWarga);
                }
            }
        } catch (err) {
            console.warn('[WARGA_CAM_SWITCH_FAIL]', err);
            isWargaCameraOff = true;
            const dummyTrack = createSilentBlackVideoTrackWarga();
            if (dummyTrack && localStreamWarga) localStreamWarga.addTrack(dummyTrack);
        }

        const activeCard = document.getElementById('wargaActiveCallCard');
        if (activeCard) {
            activeCard.setAttribute('data-mode', 'video');
            activeCard.setAttribute('data-cam', isWargaCameraOff ? 'off' : 'on');
        }

        window.updateVideoViewsWarga();
        broadcastCallMediaStateWarga();
        unfreezeVideoPlayersWarga();

        setTimeout(() => {
            unfreezeVideoPlayersWarga();
            broadcastCallMediaStateWarga();
        }, 300);
        setTimeout(() => {
            unfreezeVideoPlayersWarga();
        }, 800);
    };

    window.switchCallModeWarga = async function (newMode) {
        if (newMode === 'video') {
            await window.performSeamlessUpgradeToVideoWarga();
        } else {
            isWargaCameraOff = true;
            activeCallType = 'audio';
            if (localStreamWarga) {
                localStreamWarga.getVideoTracks().forEach(t => {
                    try { t.stop(); } catch(e){}
                    localStreamWarga.removeTrack(t);
                });
                const silentTrack = createSilentBlackVideoTrackWarga();
                if (silentTrack) {
                    localStreamWarga.addTrack(silentTrack);
                    if (currentCallWarga && currentCallWarga.peerConnection) {
                        const vSender = findVideoSenderWarga(currentCallWarga.peerConnection);
                        if (vSender) vSender.replaceTrack(silentTrack);
                    }
                }
            }
            const switchMsg = {
                type: 'CALL_SWITCH_MODE',
                mode: 'audio',
                sender_socket: window.mySessionSocketId,
                target_nik: activeCallPartnerNik || getActiveWargaNik()
            };
            if (window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
                window.RealtimeHub.send(switchMsg);
            }
            if (wargaDataConn && wargaDataConn.open) {
                wargaDataConn.send(switchMsg);
            }
            window.updateVideoViewsWarga();
        }
    };

    window.handleCallSwitchModeSignalWarga = async function (event) {
        if (!event || !event.mode) return;
        if (event.sender_socket && event.sender_socket === window.mySessionSocketId) return;

        if (event.mode === 'video') {
            await window.performSeamlessUpgradeToVideoWarga();
        } else {
            isWargaCameraOff = true;
            activeCallType = 'audio';
            if (localStreamWarga) {
                localStreamWarga.getVideoTracks().forEach(t => {
                    try { t.stop(); } catch(e){}
                    localStreamWarga.removeTrack(t);
                });
                const silentTrack = createSilentBlackVideoTrackWarga();
                if (silentTrack) {
                    localStreamWarga.addTrack(silentTrack);
                    if (currentCallWarga && currentCallWarga.peerConnection) {
                        const vSender = findVideoSenderWarga(currentCallWarga.peerConnection);
                        if (vSender) vSender.replaceTrack(silentTrack);
                    }
                }
            }
            window.updateVideoViewsWarga();
        }
    };

    window.toggleCameraModeCallWarga = async function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        isWargaCameraOff = !isWargaCameraOff;

        if (isWargaCameraOff) {
            // Matikan hardware kamera secara fisik (Lampu indikator webcam mati!)
            if (localStreamWarga) {
                localStreamWarga.getVideoTracks().forEach(t => {
                    try { t.enabled = false; t.stop(); } catch (err) {}
                    localStreamWarga.removeTrack(t);
                });
            }
            // Kirim dummy black canvas stream agar WebRTC tetap terkoneksi tanpa freeze frame lama
            const dummyTrack = createSilentBlackVideoTrackWarga();
            if (dummyTrack && localStreamWarga) {
                localStreamWarga.addTrack(dummyTrack);
            }
            if (currentCallWarga && currentCallWarga.peerConnection) {
                try {
                    const vSender = findVideoSenderWarga(currentCallWarga.peerConnection);
                    if (vSender && dummyTrack) {
                        await vSender.replaceTrack(dummyTrack);
                    }
                } catch (err) {}
            }
        } else {
            // Nyalakan kembali hardware kamera dengan request track baru
            try {
                const freshStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
                    audio: false
                });
                const newVTrack = freshStream.getVideoTracks()[0];
                if (newVTrack) newVTrack.contentHint = 'motion';

                if (currentCallWarga && currentCallWarga.peerConnection) {
                    try {
                        const sender = findVideoSenderWarga(currentCallWarga.peerConnection);
                        if (sender && typeof sender.replaceTrack === 'function') {
                            await sender.replaceTrack(newVTrack);
                        }
                    } catch (err) {}
                }

                if (localStreamWarga) {
                    localStreamWarga.getVideoTracks().forEach(t => {
                        try { t.stop(); } catch (err) {}
                        localStreamWarga.removeTrack(t);
                    });
                    localStreamWarga.addTrack(newVTrack);
                }
            } catch (err) {
                console.warn('[CAM WARGA] Gagal menyalakan ulang kamera:', err);
                isWargaCameraOff = true;
                const dummyTrack = createSilentBlackVideoTrackWarga();
                if (dummyTrack && localStreamWarga) localStreamWarga.addTrack(dummyTrack);
            }
        }

        const btnVid = document.getElementById('wargaBtnVideo');
        const minVidCam = document.getElementById('wargaMinVideoBtnCam');
        const iconHtml = isWargaCameraOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';

        if (btnVid) {
            btnVid.classList.toggle('off', isWargaCameraOff);
            btnVid.innerHTML = iconHtml;
            btnVid.title = isWargaCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera';
        }
        if (minVidCam) {
            minVidCam.classList.toggle('is-off', isWargaCameraOff);
            minVidCam.innerHTML = iconHtml;
            minVidCam.title = isWargaCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera';
        }
        broadcastCallMediaStateWarga();
        window.updateVideoViewsWarga();
        unfreezeVideoPlayersWarga();
        if (!isWargaCameraOff) {
            setTimeout(() => {
                broadcastCallMediaStateWarga();
                unfreezeVideoPlayersWarga();
            }, 300);
            setTimeout(() => {
                broadcastCallMediaStateWarga();
                unfreezeVideoPlayersWarga();
            }, 800);
        }
    };

    window.toggleMuteCallWarga = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        isWargaAudioMuted = !isWargaAudioMuted;
        if (localStreamWarga) {
            localStreamWarga.getAudioTracks().forEach(t => {
                t.enabled = !isWargaAudioMuted;
            });
        }
        if (currentCallWarga && currentCallWarga.peerConnection) {
            try {
                const aSender = findAudioSenderWarga(currentCallWarga.peerConnection);
                if (aSender && aSender.track) {
                    aSender.track.enabled = !isWargaAudioMuted;
                }
            } catch (err) {}
        }
        const btnMute = document.getElementById('wargaBtnMute');
        const minAudBtn = document.getElementById('wargaMinAudioBtnMute');
        const minVidBtn = document.getElementById('wargaMinVideoBtnMute');

        const iconHtml = isWargaAudioMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';

        if (btnMute) {
            btnMute.className = isWargaAudioMuted ? 'call-ctrl-btn off' : 'call-ctrl-btn';
            btnMute.innerHTML = iconHtml;
            btnMute.title = isWargaAudioMuted ? 'Nyalakan Mikrofon' : 'Bisukan Mikrofon';
        }
        [minAudBtn, minVidBtn].forEach(b => {
            if (b) {
                b.classList.toggle('is-muted', isWargaAudioMuted);
                b.innerHTML = iconHtml;
                b.title = isWargaAudioMuted ? 'Nyalakan Mikrofon' : 'Bisukan Mikrofon';
            }
        });
        broadcastCallMediaStateWarga();
        window.updateVideoViewsWarga();
        unfreezeVideoPlayersWarga();
    };

    // Stubs untuk filter
    window.toggleBeautyFilterWarga = function () {};
    window.toggleBackgroundBlurFilterWarga = function () {};
    window.toggleVideoFilterOptionsWarga = function () {};

    // TOGGLE OPSI TITIK TIGA WARGA (REAKSI & JARINGAN)
    window.toggleCallMoreMenuWarga = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const pop = document.getElementById('wargaCallMorePopover');
        const btn = document.getElementById('wargaBtnCallMoreOptions');
        if (!pop) return;
        const isHidden = (pop.style.display === 'none' || !pop.style.display);
        pop.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.classList.toggle('active-popover', isHidden);
    };

    // TUKAR TAMPILAN LAYAR BESAR & KECIL (KAMERA WARGA <-> PETUGAS)
    window.swapVideoViewsWarga = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (Date.now() - lastWargaSwapTime < 350) return;
        lastWargaSwapTime = Date.now();

        if (!remoteStreamWarga) return;
        isVideoSwappedWarga = !isVideoSwappedWarga;
        const card = document.getElementById('wargaActiveCallCard');
        if (card) {
            card.setAttribute('data-swap', isVideoSwappedWarga ? 'true' : 'false');
        }
        const pip = document.getElementById('wargaVideoPipContainer');
        if (pip) {
            pip.classList.remove('pip-swapped-anim');
            void pip.offsetWidth;
            pip.classList.add('pip-swapped-anim');
        }
        window.updateVideoViewsWarga();
        unfreezeVideoPlayersWarga();
    };

    // PINDAH SUDUT PiP (4 SUDUT DINAMIS)
    const WARGA_PIP_CORNERS = ['br', 'tr', 'tl', 'bl'];
    window.cyclePipCornerWarga = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const pip = document.getElementById('wargaVideoPipContainer');
        if (!pip) return;
        pip.style.removeProperty('left');
        pip.style.removeProperty('top');
        pip.style.removeProperty('right');
        pip.style.removeProperty('bottom');
        const current = pip.getAttribute('data-pip-pos') || 'br';
        let idx = WARGA_PIP_CORNERS.indexOf(current);
        if (idx === -1) idx = 0;
        const nextIdx = (idx + 1) % WARGA_PIP_CORNERS.length;
        pip.setAttribute('data-pip-pos', WARGA_PIP_CORNERS[nextIdx]);
    };

    // MODE MINIMIZE WARGA (MULTITASKING SAMBIL MENELPON)
    const WARGA_MIN_CORNERS = ['br', 'tr', 'tl', 'bl'];
    window.minimizeCallWindowWarga = function () {
        const modal = document.getElementById('wargaActiveCallUI');
        const card = document.getElementById('wargaActiveCallCard');
        if (modal) modal.classList.add('is-minimized');
        if (card) card.classList.add('call-minimized');

        const nameText = (document.getElementById('wargaActiveCallName') && document.getElementById('wargaActiveCallName').innerText) || 'Petugas Dinsos';
        const nameEl = document.getElementById('wargaMinimizedAudioName');
        if (nameEl) nameEl.innerText = nameText;
    };

    window.expandCallWindowWarga = function () {
        const modal = document.getElementById('wargaActiveCallUI');
        const card = document.getElementById('wargaActiveCallCard');
        if (modal) modal.classList.remove('is-minimized');
        if (card) {
            card.classList.remove('call-minimized');
            card.style.position = '';
            card.style.left = '';
            card.style.top = '';
            card.style.right = '';
            card.style.bottom = '';
            card.style.width = '';
            card.style.height = '';
        }
        window.updateVideoViewsWarga();
        unfreezeVideoPlayersWarga();
    };

    window.cycleMinimizedCornerWarga = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const card = document.getElementById('wargaActiveCallCard');
        if (!card) return;
        const current = card.getAttribute('data-min-corner') || 'br';
        const nextIdx = (WARGA_MIN_CORNERS.indexOf(current) + 1) % WARGA_MIN_CORNERS.length;
        card.setAttribute('data-min-corner', WARGA_MIN_CORNERS[nextIdx]);
    };



    function stopAllHardwareMediaTracksWarga() {
        if (localStreamWarga) {
            try {
                localStreamWarga.getTracks().forEach(t => {
                    t.enabled = false;
                    t.stop();
                });
            } catch (e) {}
            localStreamWarga = null;
        }
        if (remoteStreamWarga) {
            try {
                remoteStreamWarga.getTracks().forEach(t => {
                    t.enabled = false;
                    t.stop();
                });
            } catch (e) {}
            remoteStreamWarga = null;
        }
        document.querySelectorAll('video, audio').forEach(el => {
            if (el.srcObject && typeof el.srcObject.getTracks === 'function') {
                try {
                    el.srcObject.getTracks().forEach(t => {
                        t.enabled = false;
                        t.stop();
                    });
                } catch (e) {}
            }
            el.srcObject = null;
            el.removeAttribute('src');
            try { el.load(); } catch (e) {}
        });
        if (currentCallWarga && currentCallWarga.peerConnection) {
            try {
                currentCallWarga.peerConnection.getSenders().forEach(s => {
                    if (s.track) {
                        try {
                            s.track.enabled = false;
                            s.track.stop();
                        } catch (e) {}
                    }
                });
            } catch (e) {}
        }
        if (window.VideoFXEngine && typeof window.VideoFXEngine.stop === 'function') {
            try { window.VideoFXEngine.stop(); } catch (e) {}
        }
        isVideoSwappedWarga = false;
        const activeCard = document.getElementById('wargaActiveCallCard');
        if (activeCard) activeCard.setAttribute('data-swap', 'false');
        const callNameEl = document.getElementById('wargaActiveCallName');
        if (callNameEl && window.activeCallPartnerName) {
            callNameEl.innerText = window.activeCallPartnerName;
        }
    }

    // MENUTUP / MENGAKHIRI PANGGILAN WARGA SECARA BERSIH
    window.endCallWarga = function (shouldBroadcast = true) {
        if (shouldBroadcast && typeof shouldBroadcast === 'object') {
            shouldBroadcast = true;
        }
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        if (shouldBroadcast && window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send({
                type: 'CALL_END',
                call_id: currentCallId,
                sender_socket: window.mySessionSocketId,
                sender_role: 'warga',
                caller_nik: getActiveWargaNik(),
                target_nik: activeCallPartnerNik || getActiveWargaNik()
            });
        }

        currentCallId = null;
        activeCallPartnerNik = null;
        isRemoteCameraOffWarga = false;
        isRemoteMicMutedWarga = false;
        isVideoSwappedWarga = false;
        isWargaCameraOff = false;
        isWargaAudioMuted = false;

        stopAllHardwareMediaTracksWarga();

        if (callTimerWarga) clearInterval(callTimerWarga);
        if (currentCallWarga) {
            try {
                if (typeof currentCallWarga.removeAllListeners === 'function') {
                    currentCallWarga.removeAllListeners();
                } else if (typeof currentCallWarga.off === 'function') {
                    currentCallWarga.off('close');
                    currentCallWarga.off('stream');
                    currentCallWarga.off('error');
                }
                currentCallWarga.close();
            } catch (e) {}
            currentCallWarga = null;
        }

        const mWargaCamOff = document.getElementById('wargaMainCameraOffOverlay');
        if (mWargaCamOff) mWargaCamOff.style.display = 'none';
        const pWargaCamOff = document.getElementById('wargaPipCameraOffOverlay');
        if (pWargaCamOff) pWargaCamOff.style.display = 'none';

        const pipW = document.getElementById('wargaVideoPipContainer');
        if (pipW) {
            ['position', 'left', 'top', 'right', 'bottom', 'width', 'height'].forEach(p => pipW.style.removeProperty(p));
            pipW.setAttribute('data-pip-pos', 'br');
        }

        const pop = document.getElementById('wargaCallMorePopover');
        if (pop) pop.style.display = 'none';
        const moreBtn = document.getElementById('wargaBtnCallMoreOptions');
        if (moreBtn) moreBtn.classList.remove('active-popover');

        const btnMute = document.getElementById('wargaBtnMute');
        if (btnMute) {
            btnMute.className = 'call-ctrl-btn';
            btnMute.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        const minAudBtn = document.getElementById('wargaMinAudioBtnMute');
        const minVidBtn = document.getElementById('wargaMinVideoBtnMute');
        [minAudBtn, minVidBtn].forEach(b => {
            if (b) {
                b.classList.remove('is-muted');
                b.innerHTML = '<i class="fas fa-microphone"></i>';
                b.title = 'Bisukan Mikrofon';
            }
        });
        const btnVid = document.getElementById('wargaBtnVideo');
        if (btnVid) {
            btnVid.classList.remove('off');
            btnVid.innerHTML = '<i class="fas fa-video"></i>';
        }
        const minVidCam = document.getElementById('wargaMinVideoBtnCam');
        if (minVidCam) {
            minVidCam.classList.remove('is-off');
            minVidCam.innerHTML = '<i class="fas fa-video"></i>';
            minVidCam.title = 'Matikan Kamera';
        }

        const minCamBadge = document.getElementById('wargaMinCamOffBadge');
        if (minCamBadge) minCamBadge.style.display = 'none';
        const minMicBadge = document.getElementById('wargaMinMicOffBadge');
        if (minMicBadge) minMicBadge.style.display = 'none';

        const activeModal = document.getElementById('wargaActiveCallUI');
        if (activeModal) {
            activeModal.style.display = 'none';
            activeModal.classList.remove('is-minimized');
        }
        const incomingModal = document.getElementById('wargaIncomingCallUI');
        if (incomingModal) incomingModal.style.display = 'none';

        const cardW = document.getElementById('wargaActiveCallCard');
        if (cardW) {
            cardW.classList.remove('call-minimized');
            ['position', 'left', 'top', 'right', 'bottom', 'width', 'height'].forEach(p => cardW.style.removeProperty(p));
            cardW.removeAttribute('data-swap');
        }
        pendingIncomingCallData = null;
    };

        document.addEventListener('click', (ev) => {
        const filterPop = document.getElementById('wargaVideoFilterPopover');
        const filterBtn = document.getElementById('wargaBtnVideoFilter');
        if (filterPop && filterPop.style.display !== 'none' && !filterPop.contains(ev.target) && (!filterBtn || !filterBtn.contains(ev.target))) {
            filterPop.style.display = 'none';
            if (filterBtn) filterBtn.classList.remove('active-popover');
        }
    });

})(window);

    // Penutup Popover Titik Tiga saat klik di luar (Warga)
    document.addEventListener('click', (ev) => {
        const pop = document.getElementById('wargaCallMorePopover');
        const btn = document.getElementById('wargaBtnCallMoreOptions');
        if (pop && pop.style.display !== 'none' && !pop.contains(ev.target) && (!btn || !btn.contains(ev.target))) {
            pop.style.display = 'none';
            if (btn) btn.classList.remove('active-popover');
        }
    });
