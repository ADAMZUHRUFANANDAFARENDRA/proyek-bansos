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
    let currentCallWarga = null;
    let callTimerWarga = null;
    let callSecondsWarga = 0;
    let wargaDataConn = null;
    let currentCallId = null;
    let activeCallType = 'audio';
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
                currentCallWarga = call;
                if (localStreamWarga) {
                    call.answer(localStreamWarga);
                    window.handleCallConnectedWarga(call, activeCallType === 'video');
                } else {
                    const isVideo = (call.metadata && call.metadata.type === 'video') || (activeCallType === 'video');
                    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true }).then(stream => {
                        localStreamWarga = stream;
                        call.answer(localStreamWarga);
                        window.handleCallConnectedWarga(call, isVideo);
                    }).catch(() => {
                        call.close();
                    });
                }
            });

            peerWarga.on('connection', conn => {
                wargaDataConn = conn;
                conn.on('data', data => {
                    if (data && data.type === 'reaction') {
                        window.showFloatingReactionWarga(data.emoji);
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

        currentCallId = `call_${Date.now()}`;

        // 1. Dapatkan akses mikrofon dan kamera
        try {
            localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
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
        const nameEl = document.getElementById('wargaActiveCallName');
        const statusEl = document.getElementById('wargaCallStatusText');
        const vArea = document.getElementById('wargaVideoCallArea');
        const aArea = document.getElementById('wargaAudioCallArea');
        const localV = document.getElementById('wargaLocalVideo');

        if (modal) modal.style.display = 'flex';
        if (nameEl) nameEl.innerText = 'Menghubungi Petugas Dinsos...';
        if (statusEl) statusEl.innerText = 'Memanggil aparat resmi dinas...';

        if (isVideo) {
            if (vArea) vArea.style.display = 'block';
            if (aArea) aArea.style.display = 'none';
            if (localV) localV.srcObject = localStreamWarga;
        } else {
            if (vArea) vArea.style.display = 'none';
            if (aArea) aArea.style.display = 'flex';
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

        const incomingModal = document.getElementById('wargaIncomingCallUI');
        const nameEl = document.getElementById('wargaCallerNameText');
        const roleBadge = document.getElementById('wargaCallerRoleBadge');
        const typeEl = document.getElementById('wargaCallerTypeText');

        if (nameEl) nameEl.innerText = event.caller_name || 'Aparatur Dinas Sosial';
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

        if (typeEl) {
            typeEl.innerText = `Panggilan ${event.call_type === 'video' ? 'Video Call' : 'Suara'} Terverifikasi`;
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

        const isVideo = (event.call_type === 'video');

        try {
            localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
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

        const nameEl = document.getElementById('wargaActiveCallName');
        const statusEl = document.getElementById('wargaCallStatusText');
        if (nameEl) nameEl.innerText = event.caller_name || 'Petugas Dinsos Terhubung';
        if (statusEl) statusEl.innerText = '00:00';

        // Hubungkan ke peer aparatur
        if (event.peer_id && peerWarga && localStreamWarga) {
            const call = peerWarga.call(event.peer_id, localStreamWarga, {
                metadata: { type: activeCallType, nik: getActiveWargaNik() }
            });
            if (call) {
                window.handleCallConnectedWarga(call, activeCallType === 'video');
            }
        }
    };

    /**
     * Sinyal CALL_DECLINE atau CALL_END Diterima
     */
    window.handleCallEndedSignal = function (event) {
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        const incomingModal = document.getElementById('wargaIncomingCallUI');
        if (incomingModal) incomingModal.style.display = 'none';

        window.endCallWarga();
    };

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

        if (isVideo) {
            if (vArea) vArea.style.display = 'block';
            if (aArea) aArea.style.display = 'none';
            if (localV && localStreamWarga) localV.srcObject = localStreamWarga;
        } else {
            if (vArea) vArea.style.display = 'none';
            if (aArea) aArea.style.display = 'flex';
        }

        call.on('stream', remoteStream => {
            if (remoteV) {
                remoteV.srcObject = remoteStream;
                remoteV.play().catch(() => {});
            }
        });

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
        }, 1000);
    };

    /**
     * Kontrol Mikrofon (Mute/Unmute)
     */
    window.toggleMuteCallWarga = function () {
        if (!localStreamWarga) return;
        const aTrack = localStreamWarga.getAudioTracks()[0];
        if (!aTrack) return;
        aTrack.enabled = !aTrack.enabled;
        const btn = document.getElementById('wargaBtnMute');
        if (btn) {
            btn.className = aTrack.enabled ? 'call-ctrl-btn' : 'call-ctrl-btn off';
            btn.innerHTML = aTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        }
    };

    /**
     * Kontrol Kamera (Hidupkan/Matikan Video)
     */
    window.toggleVideoCallWarga = function () {
        if (!localStreamWarga) return;
        const vTrack = localStreamWarga.getVideoTracks()[0];
        const vArea = document.getElementById('wargaVideoCallArea');
        const aArea = document.getElementById('wargaAudioCallArea');
        const btn = document.getElementById('wargaBtnVideo');

        if (vTrack) {
            vTrack.enabled = !vTrack.enabled;
            if (vArea) vArea.style.display = vTrack.enabled ? 'block' : 'none';
            if (aArea) aArea.style.display = vTrack.enabled ? 'none' : 'flex';
            if (btn) {
                btn.className = vTrack.enabled ? 'call-ctrl-btn' : 'call-ctrl-btn off';
                btn.innerHTML = vTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            }
        } else {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(newStream => {
                const newVTrack = newStream.getVideoTracks()[0];
                localStreamWarga.addTrack(newVTrack);
                const localV = document.getElementById('wargaLocalVideo');
                if (localV) localV.srcObject = localStreamWarga;
                if (vArea) vArea.style.display = 'block';
                if (aArea) aArea.style.display = 'none';
                if (btn) {
                    btn.className = 'call-ctrl-btn';
                    btn.innerHTML = '<i class="fas fa-video"></i>';
                }
                if (currentCallWarga && currentCallWarga.peerConnection) {
                    const sender = currentCallWarga.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(newVTrack);
                    else currentCallWarga.peerConnection.addTrack(newVTrack, localStreamWarga);
                }
            }).catch(() => {
                Swal.fire('Kamera Tidak Tersedia', 'Tidak dapat mengakses perangkat kamera video.', 'warning');
            });
        }
    };

    /**
     * Menutup / Mengakhiri Panggilan
     */
    window.endCallWarga = function () {
        if (window.RealtimeHub && typeof window.RealtimeHub.stopRingtone === 'function') {
            window.RealtimeHub.stopRingtone();
        }

        // Siarkan sinyal CALL_END
        if (currentCallId && window.RealtimeHub && typeof window.RealtimeHub.send === 'function') {
            window.RealtimeHub.send({
                type: 'CALL_END',
                call_id: currentCallId,
                target_nik: getActiveWargaNik()
            });
        }

        if (callTimerWarga) clearInterval(callTimerWarga);
        if (currentCallWarga) {
            try { currentCallWarga.close(); } catch (e) {}
            currentCallWarga = null;
        }

        if (localStreamWarga) {
            localStreamWarga.getTracks().forEach(t => t.stop());
            localStreamWarga = null;
        }

        const modal = document.getElementById('wargaActiveCallUI');
        if (modal) modal.style.display = 'none';
        const incomingModal = document.getElementById('wargaIncomingCallUI');
        if (incomingModal) incomingModal.style.display = 'none';

        currentCallId = null;
    };

    // Reaksi Emoji Real-Time
    window.showFloatingReactionWarga = function (emoji) {
        const area = document.getElementById('wargaCallReactionAnimationArea');
        if (!area) return;
        const el = document.createElement('div');
        el.className = 'call-floating-reaction';
        el.innerText = emoji;
        const offset = (Math.random() * 40 - 20);
        el.style.marginLeft = `${offset}px`;
        area.appendChild(el);
        setTimeout(() => el.remove(), 2300);
    };

    window.sendCallReactionWarga = function (emoji) {
        window.showFloatingReactionWarga(emoji);
        if (wargaDataConn && wargaDataConn.open) {
            wargaDataConn.send({ type: 'reaction', emoji });
        }
    };

    // Inisialisasi otomatis saat script dimuat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.initPeerWarga());
    } else {
        window.initPeerWarga();
    }

})(window);
