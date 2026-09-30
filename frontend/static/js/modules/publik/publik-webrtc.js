/**
 * Modul: publik-webrtc.js
 * Deskripsi: Panggilan audio/video dua arah WebRTC Peer-to-Peer antara warga dan petugas Dinsos
 */

// WEBRTC CALL DUA ARAH (WARGA PENGADUAN <-> ADMIN/PETUGAS)
// =========================================================================
window.initPeerWarga = function () {
    if (peerWarga && !peerWarga.destroyed) return;
    const activeNik = wargaNik || (sesiAduanAktif && sesiAduanAktif.nik) || 'guest';
    const peerId = `warga_${activeNik}`;

    peerWarga = new Peer(peerId, {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peerWarga.on('call', call => {
        Swal.fire({
            title: '<i class="fas fa-phone-volume text-success"></i> Panggilan Masuk',
            text: 'Petugas Dinas Sosial Sidoarjo sedang menghubungi Anda.',
            showCancelButton: true,
            confirmButtonText: 'Terima',
            cancelButtonText: 'Tolak',
            confirmButtonColor: '#009846',
            cancelButtonColor: '#dc2626'
        }).then(async r => {
            if (r.isConfirmed) {
                const isVideo = (call.metadata && call.metadata.type === 'video');
                try {
                    localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
                    call.answer(localStreamWarga);
                    window.handleCallConnectedWarga(call, isVideo);
                } catch (e) {
                    showPortalAlert({ icon: 'error', title: 'Gagal Menjawab', text: 'Tidak dapat mengakses kamera atau mikrofon gawai.' });
                }
            } else {
                call.close();
            }
        });
    });
};

window.startCallAdminFromAduan = function (type = 'audio') {
    if (!sesiAduanAktif) return;
    wargaNik = sesiAduanAktif.nik;
    wargaNama = sesiAduanAktif.nama;
    window.initPeerWarga();
    window.startCallAdmin(type);
};

window.startCallAdmin = async function (type = 'audio') {
    if (typeof Peer === 'undefined') {
        return showPortalAlert({ icon: 'warning', title: 'Fitur Belum Siap', text: 'Pustaka WebRTC PeerJS belum termuat pada halaman.' });
    }

    window.initPeerWarga();
    const isVideo = (type === 'video');

    try {
        localStreamWarga = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        const callTargetId = 'petugas_dinsos_sidoarjo';
        const call = peerWarga.call(callTargetId, localStreamWarga, {
            metadata: { type, nik: (wargaNik || sesiAduanAktif?.nik), nama: (wargaNama || sesiAduanAktif?.nama) }
        });

        if (!call) {
            return showPortalAlert({ icon: 'info', title: 'Petugas Sibuk', text: 'Petugas Dinsos sedang tidak dalam antrean panggilan langsung.' });
        }

        const activeNik = wargaNik || sesiAduanAktif?.nik;
        const activeNama = wargaNama || sesiAduanAktif?.nama;
        fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: 'warga',
                nama: activeNama,
                pesan: `[📞 PANGGILAN ${type.toUpperCase()}] Warga memulai panggilan langsung bersama petugas.`
            })
        }).catch(() => {});

        window.handleCallConnectedWarga(call, isVideo);
    } catch (e) {
        showPortalAlert({ icon: 'error', title: 'Izin Ditolak', text: 'Izinkan akses kamera dan mikrofon pada peramban Anda.' });
    }
};

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

window.toggleMuteCallWarga = function () {
    if (!localStreamWarga) return;
    const aTrack = localStreamWarga.getAudioTracks()[0];
    if (!aTrack) return;
    aTrack.enabled = !aTrack.enabled;
    const btn = document.getElementById('wargaBtnMute');
    if (btn) btn.style.background = aTrack.enabled ? '#334155' : '#dc2626';
};

window.endCallWarga = function () {
    if (callTimerWarga) clearInterval(callTimerWarga);
    if (currentCallWarga) currentCallWarga.close();
    if (localStreamWarga) {
        localStreamWarga.getTracks().forEach(t => t.stop());
        localStreamWarga = null;
    }
    currentCallWarga = null;
    const modal = document.getElementById('wargaActiveCallUI');
    if (modal) modal.style.display = 'none';
};

// =========================================================================
