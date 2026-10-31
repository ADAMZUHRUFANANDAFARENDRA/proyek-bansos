/**
 * MODUL PENGELOLA KAMERA & AUDIO PERANGKAT RESMI (v31)
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 * Fitur Utama:
 * 1. Tampilan modern, proporsional, rapi, dan bebas tabrakan/terpotong di semua ukuran layar.
 * 2. Dua (2) Opsi Mode Eksklusif dengan SATU tombol aksi utama per mode:
 *    - Opsi Foto: Hanya menampilkan satu tombol "Ambil Foto".
 *    - Opsi Video: Hanya menampilkan satu tombol "Rekam Video".
 * 3. Kontrol "Kamera ON/OFF" dan "Mic ON/OFF" berada pada bar kontrol khusus yang tidak pernah tertutup layout lain.
 * 4. Spesifikasi aktif ("1280x720 (0.9 MP) • 30 FPS • Microphone Array") tampil utuh dan otomatis berubah secara real-time
 *    sesuai dengan pilihan Resolusi/FPS, Mikrofon, dan Sensor Kamera yang diubah di Pengaturan.
 */

(function () {
    let currentCameraStream = null;
    let cameraAudioCtx = null;
    let cameraAnalyser = null;
    let cameraMicAnimFrame = null;
    let currentFacingMode = 'user'; // 'user' | 'environment'
    let cameraTargetContext = 'admin-chat'; // 'admin-chat' | 'admin-voice-preview' | 'warga-chat' | 'warga-voice-preview' | 'aduan-chat' | 'aduan-voice-preview'

    // Mode Kamera Eksklusif: 'photo' | 'video'
    let currentCameraMode = 'photo';

    // Status Perangkat & Konfigurasi Lanjutan
    let detectedVideoDevices = [];
    let detectedAudioDevices = [];
    let selectedCameraDeviceId = '';
    let selectedMicDeviceId = '';
    let selectedMicCustomLabel = '';
    let selectedResolution = '720p30'; // '1080p60' | '1080p30' | '720p60' | '720p30' | '480p30' | 'native'
    let isCameraMirrored = false;
    let isVideoTrackEnabled = true;
    let isAudioTrackEnabled = true;
    let isSettingsPanelOpen = false;

    // Rekam Video
    let videoMediaRecorder = null;
    let videoChunks = [];
    let videoRecordTimer = null;
    let videoRecordSecs = 0;
    let isRecordingVideo = false;

    // Spesifikasi Aktif
    let activeStreamSpecs = {
        width: 1280,
        height: 720,
        frameRate: 30,
        megaPixels: '0.9 MP',
        micLabel: 'Microphone Array',
        cameraLabel: 'Kamera Bawaan'
    };

    // Peta Spesifikasi Resolusi & FPS sesuai pilihan di Pengaturan
    const RESOLUTION_SPECS_MAP = {
        '720p30': { width: 1280, height: 720, frameRate: 30, megaPixels: '0.9 MP' },
        '720p60': { width: 1280, height: 720, frameRate: 60, megaPixels: '0.9 MP' },
        '1080p30': { width: 1920, height: 1080, frameRate: 30, megaPixels: '2.1 MP' },
        '1080p60': { width: 1920, height: 1080, frameRate: 60, megaPixels: '2.1 MP' },
        '480p30': { width: 854, height: 480, frameRate: 30, megaPixels: '0.4 MP' },
        'native': { width: 3840, height: 2160, frameRate: 60, megaPixels: '8.3 MP' }
    };

    function cleanDeviceName(rawLabel, fallbackName) {
        if (!rawLabel || typeof rawLabel !== 'string') return fallbackName || 'Microphone Array';
        const cleaned = rawLabel.split('(')[0].trim();
        return cleaned || rawLabel.trim() || fallbackName || 'Microphone Array';
    }

    window.openLiveCameraModal = async function (context, initialMode) {
        cameraTargetContext = context || 'admin-chat';
        let modal = document.getElementById('modalLiveCameraCapture');
        if (!modal) {
            createCameraModalElement();
            modal = document.getElementById('modalLiveCameraCapture');
        }
        modal.style.display = 'flex';

        const modeToSet = initialMode === 'video' ? 'video' : 'photo';
        window.switchCameraCaptureMode(modeToSet, true);

        await refreshAvailableMediaDevices();
        syncSpecsFromCurrentSettings();
        await startCameraStream();
    };

    window.closeLiveCameraModal = function () {
        if (isRecordingVideo) {
            stopVideoRecording(true);
        }
        stopCameraStream();
        const modal = document.getElementById('modalLiveCameraCapture');
        if (modal) modal.style.display = 'none';
        isRecordingVideo = false;
        clearInterval(videoRecordTimer);
        resetVideoRecordingUI();
        isSettingsPanelOpen = false;
        const panel = document.getElementById('cameraAdvancedSettingsPanel');
        if (panel) panel.style.display = 'none';
        const vfBox = document.getElementById('cameraViewfinderBox');
        if (vfBox) vfBox.style.height = 'clamp(220px, 38vh, 310px)';
        updateSettingsButtonUI();
    };

    // =========================================================================
    // PEMILIH 2 OPSI MODE EKSKLUSIF: 'photo' (Opsi Foto) vs 'video' (Opsi Video)
    // =========================================================================
    window.switchCameraCaptureMode = function (mode, skipGuard) {
        if (!skipGuard && isRecordingVideo) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top',
                    icon: 'warning',
                    title: 'Rekaman Video Sedang Berlangsung',
                    text: 'Hentikan rekaman video terlebih dahulu sebelum berpindah ke Opsi Foto.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
            return;
        }

        currentCameraMode = mode === 'video' ? 'video' : 'photo';

        const tabPhoto = document.getElementById('tabCameraModePhoto');
        const tabVideo = document.getElementById('tabCameraModeVideo');
        const btnSnapPhoto = document.getElementById('btnSnapPhotoSingle');
        const btnRecordVideo = document.getElementById('btnStartVideoRecord');
        const modeIndicatorBadge = document.getElementById('cameraViewfinderModeBadge');

        if (currentCameraMode === 'photo') {
            if (tabPhoto) {
                tabPhoto.style.background = 'linear-gradient(135deg, #009846, #059669)';
                tabPhoto.style.color = '#ffffff';
                tabPhoto.style.boxShadow = '0 3px 10px rgba(0, 152, 70, 0.4)';
                tabPhoto.style.borderColor = 'rgba(16, 185, 129, 0.5)';
            }
            if (tabVideo) {
                tabVideo.style.background = 'transparent';
                tabVideo.style.color = '#94a3b8';
                tabVideo.style.boxShadow = 'none';
                tabVideo.style.borderColor = 'transparent';
            }
            if (btnSnapPhoto) btnSnapPhoto.style.display = 'inline-flex';
            if (btnRecordVideo) btnRecordVideo.style.display = 'none';
            if (modeIndicatorBadge) {
                modeIndicatorBadge.innerHTML = '<i class="fas fa-camera"></i> MODE FOTO';
                modeIndicatorBadge.style.background = 'rgba(0, 152, 70, 0.88)';
                modeIndicatorBadge.style.borderColor = 'rgba(16, 185, 129, 0.45)';
            }
        } else {
            if (tabVideo) {
                tabVideo.style.background = 'linear-gradient(135deg, #e11d48, #be123c)';
                tabVideo.style.color = '#ffffff';
                tabVideo.style.boxShadow = '0 3px 10px rgba(225, 29, 72, 0.45)';
                tabVideo.style.borderColor = 'rgba(244, 63, 94, 0.5)';
            }
            if (tabPhoto) {
                tabPhoto.style.background = 'transparent';
                tabPhoto.style.color = '#94a3b8';
                tabPhoto.style.boxShadow = 'none';
                tabPhoto.style.borderColor = 'transparent';
            }
            if (btnSnapPhoto) btnSnapPhoto.style.display = 'none';
            if (btnRecordVideo) btnRecordVideo.style.display = 'inline-flex';
            if (modeIndicatorBadge) {
                modeIndicatorBadge.innerHTML = '<i class="fas fa-video"></i> MODE VIDEO';
                modeIndicatorBadge.style.background = 'rgba(225, 29, 72, 0.88)';
                modeIndicatorBadge.style.borderColor = 'rgba(244, 63, 94, 0.45)';
            }
        }
    };

    // Deteksi seluruh perangkat kamera & mikrofon fisik yang terpasang pada komputer / ponsel
    async function refreshAvailableMediaDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            detectedVideoDevices = devices.filter(d => d.kind === 'videoinput');
            detectedAudioDevices = devices.filter(d => d.kind === 'audioinput');
            populateSettingsDropdowns();
        } catch (e) {
            console.warn('Gagal mendeteksi daftar perangkat hardware:', e);
        }
    }

    function getTargetConstraints() {
        const spec = RESOLUTION_SPECS_MAP[selectedResolution] || RESOLUTION_SPECS_MAP['720p30'];
        let width = { ideal: spec.width };
        let height = { ideal: spec.height };
        let frameRate = { ideal: spec.frameRate };

        if (selectedResolution !== 'native') {
            width.max = spec.width;
            height.max = spec.height;
            frameRate.max = spec.frameRate;
        }

        const videoConstraints = {
            width,
            height,
            frameRate
        };

        if (selectedCameraDeviceId) {
            videoConstraints.deviceId = { exact: selectedCameraDeviceId };
        } else {
            videoConstraints.facingMode = { ideal: currentFacingMode };
        }

        const audioConstraints = selectedMicDeviceId ? { deviceId: { exact: selectedMicDeviceId } } : true;

        return { video: videoConstraints, audio: audioConstraints };
    }

    // Sinkronisasi langsung spesifikasi dari pilihan Pengaturan saat ini
    function syncSpecsFromCurrentSettings(stream) {
        const targetSpec = RESOLUTION_SPECS_MAP[selectedResolution] || RESOLUTION_SPECS_MAP['720p30'];
        activeStreamSpecs.width = targetSpec.width;
        activeStreamSpecs.height = targetSpec.height;
        activeStreamSpecs.frameRate = targetSpec.frameRate;
        activeStreamSpecs.megaPixels = targetSpec.megaPixels;

        // Tentukan label Kamera aktif dari pilihan atau stream
        const camSel = document.getElementById('selCameraDevice');
        if (camSel && camSel.selectedIndex >= 0 && camSel.value !== '') {
            activeStreamSpecs.cameraLabel = cleanDeviceName(camSel.options[camSel.selectedIndex].text, 'Kamera Perangkat');
        } else if (stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].label) {
            activeStreamSpecs.cameraLabel = cleanDeviceName(stream.getVideoTracks()[0].label, 'Kamera Perangkat');
        } else {
            activeStreamSpecs.cameraLabel = currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang';
        }

        // Tentukan label Mikrofon aktif sesuai yang dipilih di Pengaturan (#selMicrophoneDevice)
        const micSel = document.getElementById('selMicrophoneDevice');
        if (selectedMicCustomLabel) {
            activeStreamSpecs.micLabel = selectedMicCustomLabel;
        } else if (micSel && micSel.selectedIndex >= 0 && micSel.value !== '') {
            const rawOptionText = micSel.options[micSel.selectedIndex].text;
            activeStreamSpecs.micLabel = cleanDeviceName(rawOptionText, 'Microphone Array');
        } else if (stream && stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].label) {
            activeStreamSpecs.micLabel = cleanDeviceName(stream.getAudioTracks()[0].label, 'Microphone Array');
        } else if (detectedAudioDevices.length > 0 && detectedAudioDevices[0].label) {
            activeStreamSpecs.micLabel = cleanDeviceName(detectedAudioDevices[0].label, 'Microphone Array');
        } else {
            activeStreamSpecs.micLabel = 'Microphone Array';
        }

        updateCameraSpecsBadge();
    }

    async function startCameraStream() {
        stopCameraStream();
        const videoEl = document.getElementById('liveCameraFeed');
        const fallbackNotice = document.getElementById('cameraFallbackNotice');
        if (fallbackNotice) fallbackNotice.style.display = 'none';

        syncSpecsFromCurrentSettings(null);

        const constraints = getTargetConstraints();

        try {
            try {
                currentCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (errWithAudio) {
                console.warn('Gagal meminta audio mic dengan constraint spesifik, mencoba fallback:', errWithAudio);
                try {
                    currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video, audio: true });
                } catch (errVideoOnly) {
                    currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                }
            }

            if (videoEl && currentCameraStream) {
                videoEl.srcObject = currentCameraStream;
                videoEl.play().catch(() => {});

                currentCameraStream.getVideoTracks().forEach(t => t.enabled = isVideoTrackEnabled);
                currentCameraStream.getAudioTracks().forEach(t => t.enabled = isAudioTrackEnabled);

                await refreshAvailableMediaDevices();
                readStreamTrackSpecifications(currentCameraStream);

                updateMirrorDisplay();
                updateTrackButtonsUI();
                setupMicLevelMeter(currentCameraStream);
            }
        } catch (err) {
            console.warn('Gagal membuka kamera perangkat:', err);
            syncSpecsFromCurrentSettings(null);
            updateMirrorDisplay();
            updateTrackButtonsUI();
            if (fallbackNotice) fallbackNotice.style.display = 'flex';
        }
    }

    function readStreamTrackSpecifications(stream) {
        const videoTrack = stream ? stream.getVideoTracks()[0] : null;
        if (videoTrack) {
            const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
            if (settings.facingMode) {
                currentFacingMode = settings.facingMode;
            }
            if (selectedResolution === 'native' && settings.width && settings.height && settings.width >= 1920) {
                const w = settings.width;
                const h = settings.height;
                const fps = Math.round(settings.frameRate || 60);
                const mp = (w * h / 1000000).toFixed(1);
                activeStreamSpecs.width = w;
                activeStreamSpecs.height = h;
                activeStreamSpecs.frameRate = fps;
                activeStreamSpecs.megaPixels = `${mp} MP`;
            }
        }
        syncSpecsFromCurrentSettings(stream);
    }

    function updateCameraSpecsBadge() {
        const badge = document.getElementById('cameraLiveSpecsBadge');
        if (!badge) return;

        const cleanMic = isAudioTrackEnabled
            ? (activeStreamSpecs.micLabel || 'Microphone Array')
            : 'Mic Nonaktif (Muted)';

        const micIconColor = isAudioTrackEnabled ? '#38bdf8' : '#ef4444';
        const videoIconColor = isVideoTrackEnabled ? '#10b981' : '#ef4444';

        badge.innerHTML = `
            <i class="fas ${isVideoTrackEnabled ? 'fa-video' : 'fa-video-slash'}" style="color:${videoIconColor}; margin-right:4px;"></i><span>${activeStreamSpecs.width}x${activeStreamSpecs.height} (${activeStreamSpecs.megaPixels})</span>
            <span style="margin:0 6px; color:#64748b;">•</span>
            <span>${activeStreamSpecs.frameRate} FPS</span>
            <span style="margin:0 6px; color:#64748b;">•</span>
            <i class="fas ${isAudioTrackEnabled ? 'fa-microphone' : 'fa-microphone-slash'}" style="color:${micIconColor}; margin-right:4px;"></i><span style="color:${isAudioTrackEnabled ? '#e2e8f0' : '#fca5a5'};">${cleanMic}</span>
        `;

        const livePill = document.getElementById('cameraHeaderLivePill');
        if (livePill) {
            if (isVideoTrackEnabled) {
                livePill.textContent = 'LIVE';
                livePill.style.background = 'rgba(16,185,129,0.2)';
                livePill.style.color = '#10b981';
                livePill.style.borderColor = 'rgba(16,185,129,0.35)';
            } else {
                livePill.textContent = 'KAMERA OFF';
                livePill.style.background = 'rgba(239,68,68,0.2)';
                livePill.style.color = '#f87171';
                livePill.style.borderColor = 'rgba(239,68,68,0.35)';
            }
        }
    }

    function stopCameraStream() {
        if (cameraMicAnimFrame) {
            cancelAnimationFrame(cameraMicAnimFrame);
            cameraMicAnimFrame = null;
        }
        if (cameraAudioCtx && cameraAudioCtx.state !== 'closed') {
            cameraAudioCtx.close().catch(() => {});
            cameraAudioCtx = null;
        }
        if (currentCameraStream) {
            currentCameraStream.getTracks().forEach(t => t.stop());
            currentCameraStream = null;
        }
        const videoEl = document.getElementById('liveCameraFeed');
        if (videoEl) videoEl.srcObject = null;
    }

    function setupMicLevelMeter(stream) {
        const audioTracks = stream.getAudioTracks();
        const meterBar = document.getElementById('cameraMicLevelBar');
        if (!meterBar || audioTracks.length === 0) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            cameraAudioCtx = new AudioCtx();
            cameraAnalyser = cameraAudioCtx.createAnalyser();
            cameraAnalyser.fftSize = 64;
            const src = cameraAudioCtx.createMediaStreamSource(stream);
            src.connect(cameraAnalyser);

            const dataArray = new Uint8Array(cameraAnalyser.frequencyBinCount);
            function updateMicMeter() {
                if (!cameraAnalyser) return;
                if (!isAudioTrackEnabled) {
                    meterBar.style.width = '0%';
                    cameraMicAnimFrame = requestAnimationFrame(updateMicMeter);
                    return;
                }
                cameraAnalyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                const pct = Math.min(100, Math.round((avg / 128) * 100));
                meterBar.style.width = `${pct}%`;
                cameraMicAnimFrame = requestAnimationFrame(updateMicMeter);
            }
            updateMicMeter();
        } catch (e) {}
    }

    // =========================================================================
    // FITUR PUTAR: MEMUTAR ANTARA KAMERA DEPAN DAN BELAKANG SECARA FISIK
    // =========================================================================
    window.switchCameraFacing = async function () {
        if (detectedVideoDevices.length > 1) {
            const currentIdx = detectedVideoDevices.findIndex(d => d.deviceId === selectedCameraDeviceId);
            const nextIdx = (currentIdx + 1) % detectedVideoDevices.length;
            selectedCameraDeviceId = detectedVideoDevices[nextIdx].deviceId;
        } else {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            selectedCameraDeviceId = '';
        }

        populateSettingsDropdowns();
        syncSpecsFromCurrentSettings(currentCameraStream);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'info',
                title: `Beralih ke ${currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}`,
                timer: 1200,
                showConfirmButton: false
            });
        }

        await startCameraStream();
    };

    // PENGATURAN CERMIN (MIRROR / NON-MIRROR)
    window.toggleCameraMirror = function () {
        isCameraMirrored = !isCameraMirrored;
        updateMirrorDisplay();
    };

    function updateMirrorDisplay() {
        const videoEl = document.getElementById('liveCameraFeed');
        if (videoEl) {
            videoEl.style.transform = isCameraMirrored ? 'scaleX(-1)' : 'none';
        }
        const mirrorChk = document.getElementById('chkCameraMirrorOption');
        if (mirrorChk) {
            mirrorChk.checked = isCameraMirrored;
        }
    }

    // =========================================================================
    // ON / OFF TRACK VIDEO & AUDIO (BEBAS TERTUTUP LAYOUT LAIN)
    // =========================================================================
    window.toggleCameraVideoTrack = function () {
        isVideoTrackEnabled = !isVideoTrackEnabled;
        if (currentCameraStream) {
            currentCameraStream.getVideoTracks().forEach(t => t.enabled = isVideoTrackEnabled);
        }

        const placeholder = document.getElementById('cameraVideoDisabledOverlay');
        if (placeholder) {
            placeholder.style.display = isVideoTrackEnabled ? 'none' : 'flex';
        }
        updateTrackButtonsUI();
        updateCameraSpecsBadge();
    };

    window.toggleCameraAudioTrack = function () {
        isAudioTrackEnabled = !isAudioTrackEnabled;
        if (currentCameraStream) {
            currentCameraStream.getAudioTracks().forEach(t => t.enabled = isAudioTrackEnabled);
        }

        const meterBar = document.getElementById('cameraMicLevelBar');
        if (!isAudioTrackEnabled && meterBar) {
            meterBar.style.width = '0%';
        }
        const micOverlayIcon = document.getElementById('cameraViewfinderMicIcon');
        if (micOverlayIcon) {
            micOverlayIcon.className = isAudioTrackEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
            micOverlayIcon.style.color = isAudioTrackEnabled ? '#10b981' : '#ef4444';
        }
        updateTrackButtonsUI();
        updateCameraSpecsBadge();
    };

    function updateTrackButtonsUI() {
        const btnVideo = document.getElementById('btnCameraVideoToggle');
        if (btnVideo) {
            if (isVideoTrackEnabled) {
                btnVideo.style.background = 'rgba(16, 185, 129, 0.16)';
                btnVideo.style.color = '#34d399';
                btnVideo.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                btnVideo.innerHTML = `<i class="fas fa-video"></i> <span>Kamera ON</span>`;
            } else {
                btnVideo.style.background = '#dc2626';
                btnVideo.style.color = '#ffffff';
                btnVideo.style.borderColor = '#ef4444';
                btnVideo.innerHTML = `<i class="fas fa-video-slash"></i> <span>Kamera OFF</span>`;
            }
        }

        const btnAudio = document.getElementById('btnCameraAudioToggle');
        if (btnAudio) {
            if (isAudioTrackEnabled) {
                btnAudio.style.background = 'rgba(56, 189, 248, 0.16)';
                btnAudio.style.color = '#38bdf8';
                btnAudio.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                btnAudio.innerHTML = `<i class="fas fa-microphone"></i> <span>Mic ON</span>`;
            } else {
                btnAudio.style.background = '#dc2626';
                btnAudio.style.color = '#ffffff';
                btnAudio.style.borderColor = '#ef4444';
                btnAudio.innerHTML = `<i class="fas fa-microphone-slash"></i> <span>Mic OFF</span>`;
            }
        }
    }

    // =========================================================================
    // PANEL PENGATURAN LANJUTAN
    // =========================================================================
    window.toggleCameraSettingsPanel = function () {
        isSettingsPanelOpen = !isSettingsPanelOpen;
        const panel = document.getElementById('cameraAdvancedSettingsPanel');
        if (panel) {
            panel.style.display = isSettingsPanelOpen ? 'block' : 'none';
        }
        const vfBox = document.getElementById('cameraViewfinderBox');
        if (vfBox) {
            vfBox.style.height = isSettingsPanelOpen ? 'clamp(190px, 30vh, 250px)' : 'clamp(220px, 38vh, 310px)';
        }
        updateSettingsButtonUI();
        if (isSettingsPanelOpen) {
            populateSettingsDropdowns();
        }
    };

    function updateSettingsButtonUI() {
        const btn = document.getElementById('btnCameraSettingsToggle');
        if (!btn) return;
        if (isSettingsPanelOpen) {
            btn.style.background = '#2563eb';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#60a5fa';
        } else {
            btn.style.background = 'rgba(59,130,246,0.18)';
            btn.style.color = '#60a5fa';
            btn.style.borderColor = 'rgba(59,130,246,0.35)';
        }
    }

    function populateSettingsDropdowns() {
        // Dropdown Kamera
        const camSel = document.getElementById('selCameraDevice');
        if (camSel) {
            let html = `<option value="">Otomatis (${currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'})</option>`;
            detectedVideoDevices.forEach((dev, idx) => {
                const label = dev.label || `Sensor Kamera ${idx + 1}`;
                const isSelected = selectedCameraDeviceId === dev.deviceId;
                html += `<option value="${dev.deviceId}" ${isSelected ? 'selected' : ''}>${label}</option>`;
            });
            camSel.innerHTML = html;
        }

        // Dropdown Mikrofon
        const micSel = document.getElementById('selMicrophoneDevice');
        if (micSel) {
            const defaultHwLabel = (detectedAudioDevices.length > 0 && detectedAudioDevices[0].label)
                ? cleanDeviceName(detectedAudioDevices[0].label, 'Microphone Array')
                : 'Microphone Array';

            let html = `<option value="" data-display-label="${defaultHwLabel}">Default (${defaultHwLabel})</option>`;
            detectedAudioDevices.forEach((dev, idx) => {
                const rawLabel = dev.label || `Mikrofon Perangkat ${idx + 1}`;
                const cleanLabel = cleanDeviceName(rawLabel, `Mikrofon Perangkat ${idx + 1}`);
                const isSelected = selectedMicDeviceId === dev.deviceId;
                html += `<option value="${dev.deviceId}" data-display-label="${cleanLabel}" ${isSelected ? 'selected' : ''}>${rawLabel}</option>`;
            });

            if (detectedAudioDevices.length <= 1) {
                html += `<option value="mic_profile_communications" data-display-label="Communications Mic" ${selectedMicDeviceId === 'mic_profile_communications' ? 'selected' : ''}>Communications Microphone (Jernih Suara)</option>`;
                html += `<option value="mic_profile_external" data-display-label="Mikrofon Eksternal / Headset" ${selectedMicDeviceId === 'mic_profile_external' ? 'selected' : ''}>Mikrofon Eksternal / Headset</option>`;
            }
            micSel.innerHTML = html;
        }

        // Resolusi aktif
        const resSel = document.getElementById('selCameraResolution');
        if (resSel) {
            resSel.value = selectedResolution;
        }

        const mirrorChk = document.getElementById('chkCameraMirrorOption');
        if (mirrorChk) {
            mirrorChk.checked = isCameraMirrored;
        }
    }

    window.applyCameraDeviceChange = async function () {
        const camSel = document.getElementById('selCameraDevice');
        const micSel = document.getElementById('selMicrophoneDevice');
        const resSel = document.getElementById('selCameraResolution');
        const mirrorChk = document.getElementById('chkCameraMirrorOption');

        if (camSel) selectedCameraDeviceId = camSel.value;
        if (micSel) {
            const val = micSel.value;
            const selectedOpt = micSel.options[micSel.selectedIndex];
            const customDisplay = selectedOpt ? (selectedOpt.getAttribute('data-display-label') || cleanDeviceName(selectedOpt.text, 'Microphone Array')) : 'Microphone Array';
            selectedMicCustomLabel = customDisplay;
            if (val && val.startsWith('mic_profile_')) {
                selectedMicDeviceId = '';
            } else {
                selectedMicDeviceId = val;
            }
        }
        if (resSel) selectedResolution = resSel.value;
        if (mirrorChk) isCameraMirrored = mirrorChk.checked;

        // Langsung perbarui teks spesifikasi aktif ("1280x720 (0.9 MP) • 30 FPS • ...") secara otomatis & seketika!
        updateMirrorDisplay();
        syncSpecsFromCurrentSettings(currentCameraStream);

        await startCameraStream();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: 'Pengaturan Kamera Diterapkan',
                text: `${activeStreamSpecs.width}x${activeStreamSpecs.height} (${activeStreamSpecs.megaPixels}) • ${activeStreamSpecs.frameRate} FPS • ${activeStreamSpecs.micLabel}`,
                timer: 1600,
                showConfirmButton: false
            });
        }
    };

    // =========================================================================
    // PENGAMBILAN FOTO (HANYA AKTIF PADA OPSI MODE FOTO - 1 TOMBOL TUNGGAL)
    // =========================================================================
    window.snapCameraPhoto = function () {
        if (currentCameraMode !== 'photo') {
            window.switchCameraCaptureMode('photo');
            return;
        }

        const videoEl = document.getElementById('liveCameraFeed');
        if (!videoEl || !videoEl.videoWidth || !isVideoTrackEnabled) {
            return document.getElementById('nativeCameraPhotoInput')?.click();
        }

        const targetW = activeStreamSpecs.width || videoEl.videoWidth || 1280;
        const targetH = activeStreamSpecs.height || videoEl.videoHeight || 720;

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (isCameraMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const fileName = `foto_kamera_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            deliverCapturedFiles([file]);
            window.closeLiveCameraModal();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Foto Berhasil Diambil',
                    text: `${fileName} (${canvas.width}x${canvas.height} • ${activeStreamSpecs.megaPixels}) telah ditambahkan ke lampiran.`,
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        }, 'image/jpeg', 0.95);
    };

    // =========================================================================
    // PEREKAMAN VIDEO (HANYA AKTIF PADA OPSI MODE VIDEO - 1 TOMBOL TUNGGAL)
    // =========================================================================
    window.toggleCameraVideoRecording = function () {
        if (currentCameraMode !== 'video') {
            window.switchCameraCaptureMode('video');
            return;
        }
        if (isRecordingVideo) {
            stopVideoRecording(false);
        } else {
            startVideoRecording();
        }
    };

    function resetVideoRecordingUI() {
        const recordBtn = document.getElementById('btnStartVideoRecord');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-video"></i> <span>Rekam Video</span>';
            recordBtn.style.background = 'linear-gradient(135deg, #e11d48, #be123c)';
        }
        const timerEl = document.getElementById('cameraVideoRecordTimer');
        if (timerEl) timerEl.style.display = 'none';
    }

    function startVideoRecording() {
        if (!currentCameraStream) {
            return document.getElementById('nativeCameraVideoInput')?.click();
        }
        videoChunks = [];

        try {
            const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
                ? 'video/mp4'
                : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                    ? 'video/webm;codecs=vp9,opus'
                    : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'));

            videoMediaRecorder = new MediaRecorder(currentCameraStream, { mimeType });
            videoMediaRecorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) videoChunks.push(e.data);
            };

            videoMediaRecorder.onstop = () => {
                if (videoChunks.length > 0 && !videoMediaRecorder._cancelled) {
                    const blob = new Blob(videoChunks, { type: mimeType });
                    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                    const fileName = `video_kamera_${Date.now()}.${ext}`;
                    const file = new File([blob], fileName, { type: mimeType });
                    deliverCapturedFiles([file]);
                    window.closeLiveCameraModal();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Video Berhasil Direkam',
                            text: `${fileName} (${activeStreamSpecs.width}x${activeStreamSpecs.height} @ ${activeStreamSpecs.frameRate} FPS) telah ditambahkan ke lampiran.`,
                            timer: 1800,
                            showConfirmButton: false
                        });
                    }
                }
            };

            videoMediaRecorder.start(250);
            isRecordingVideo = true;
            videoRecordSecs = 0;

            const recordBtn = document.getElementById('btnStartVideoRecord');
            if (recordBtn) {
                recordBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Selesai Merekam</span>';
                recordBtn.style.background = '#dc2626';
            }

            const timerEl = document.getElementById('cameraVideoRecordTimer');
            if (timerEl) {
                timerEl.style.display = 'inline-flex';
                timerEl.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#ffffff; display:inline-block;"></span> <span>00:00</span>';
            }

            videoRecordTimer = setInterval(() => {
                videoRecordSecs++;
                const m = String(Math.floor(videoRecordSecs / 60)).padStart(2, '0');
                const s = String(videoRecordSecs % 60).padStart(2, '0');
                if (timerEl) {
                    timerEl.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:#ffffff; display:inline-block;"></span> <span>${m}:${s}</span>`;
                }
            }, 1000);
        } catch (err) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Kendala Rekam Video', 'Peramban tidak mendukung perekaman video langsung dari stream.', 'error');
            }
        }
    }

    function stopVideoRecording(cancelOnly) {
        if (videoMediaRecorder && videoMediaRecorder.state !== 'inactive') {
            videoMediaRecorder._cancelled = !!cancelOnly;
            videoMediaRecorder.stop();
        }
        clearInterval(videoRecordTimer);
        isRecordingVideo = false;
        resetVideoRecordingUI();
    }

    // =========================================================================
    // MEMBUKA GALERI PERANGKAT SESUAI MODE AKTIF
    // =========================================================================
    window.openDeviceGalleryDirectly = function () {
        if (currentCameraMode === 'photo') {
            const inpPhoto = document.getElementById('nativeCameraPhotoInput');
            if (inpPhoto) return inpPhoto.click();
        } else if (currentCameraMode === 'video') {
            const inpVideo = document.getElementById('nativeCameraVideoInput');
            if (inpVideo) return inpVideo.click();
        }
        const inp = document.getElementById('nativeCameraCaptureInput');
        if (inp) inp.click();
    };

    window.handleNativeCameraSelected = function (input) {
        if (!input.files || input.files.length === 0) return;
        const files = Array.from(input.files);
        deliverCapturedFiles(files);
        input.value = '';
        window.closeLiveCameraModal();
    };

    function deliverCapturedFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        if (cameraTargetContext === 'admin-voice-preview') {
            if (typeof window.addAdminVoicePreviewAttachments === 'function') {
                window.addAdminVoicePreviewAttachments(fileList);
            }
        } else if (cameraTargetContext === 'warga-voice-preview') {
            if (typeof window.addWargaVoicePreviewAttachments === 'function') {
                window.addWargaVoicePreviewAttachments(fileList);
            }
        } else if (cameraTargetContext === 'aduan-voice-preview') {
            if (typeof window.addAduanVoicePreviewAttachments === 'function') {
                window.addAduanVoicePreviewAttachments(fileList);
            }
        } else if (cameraTargetContext === 'warga-chat') {
            if (typeof window.addWargaChatAttachments === 'function') {
                window.addWargaChatAttachments(fileList);
            }
        } else if (cameraTargetContext === 'aduan-chat') {
            if (typeof window.addAduanChatAttachments === 'function') {
                window.addAduanChatAttachments(fileList);
            }
        } else {
            if (typeof window.appendAdminMediaSelection === 'function') {
                window.appendAdminMediaSelection({ files: fileList });
            } else if (typeof window.addAdminChatAttachments === 'function') {
                window.addAdminChatAttachments(fileList);
            }
        }
    }

    // =========================================================================
    // PEMBUATAN ELEMEN MODAL KAMERA MODERN (v31)
    // - Satu tombol aksi tunggal pada Mode Foto ("Ambil Foto")
    // - Satu tombol aksi tunggal pada Mode Video ("Rekam Video")
    // - Tanpa teks keterangan "Mode: Hanya Ambil Foto / Hanya Rekam Video"
    // - Bebas tertutup layout lain & spesifikasi otomatis berubah sesuai Pengaturan
    // =========================================================================
    function createCameraModalElement() {
        const div = document.createElement('div');
        div.id = 'modalLiveCameraCapture';
        div.style.cssText = 'display:none; position:fixed; inset:0; z-index:999999; background:rgba(2,6,23,0.85); backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:14px; box-sizing:border-box; overflow-y:auto;';

        div.innerHTML = `
            <div style="background:#0b1120; border-radius:28px; width:100%; max-width:660px; max-height:calc(100vh - 28px); max-height:calc(100dvh - 28px); display:flex; flex-direction:column; overflow:hidden; margin:auto; box-shadow:0 28px 75px rgba(0,0,0,0.92); border:1.5px solid rgba(255,255,255,0.14); box-sizing:border-box; position:relative;">

                <!-- 1. HEADER: Informasi Kamera & Spesifikasi Real-Time Utuh + Kontrol Atas -->
                <div style="padding:14px 20px 12px 20px; background:#111827; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                        <div style="display:flex; align-items:center; gap:10px; color:#ffffff; min-width:0;">
                            <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, #ec4899, #db2777); display:flex; align-items:center; justify-content:center; font-size:1.05rem; box-shadow:0 4px 14px rgba(236,72,153,0.4); flex-shrink:0;">
                                <i class="fas fa-camera"></i>
                            </div>
                            <div style="font-size:1.02rem; font-weight:800; color:#ffffff; letter-spacing:0.2px; display:flex; align-items:center; gap:8px; white-space:nowrap;">
                                <span>Kamera Perangkat</span>
                                <span id="cameraHeaderLivePill" style="background:rgba(16,185,129,0.2); color:#10b981; font-size:0.66rem; font-weight:800; padding:2px 9px; border-radius:9999px; border:1px solid rgba(16,185,129,0.35); letter-spacing:0.5px;">LIVE</span>
                            </div>
                        </div>

                        <!-- Tombol Putar Kamera, Pengaturan & Tutup -->
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <button type="button" id="btnCameraFacingSwitch" onclick="window.switchCameraFacing()" style="background:linear-gradient(135deg, #1e293b, #334155); color:#f8fafc; border:1px solid rgba(255,255,255,0.18); border-radius:9999px; padding:7px 14px; font-size:0.76rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:all 0.15s; white-space:nowrap;" title="Putar sensor antara kamera depan dan kamera belakang">
                                <i class="fas fa-camera-rotate"></i> <span>Putar Kamera</span>
                            </button>

                            <button type="button" id="btnCameraSettingsToggle" onclick="window.toggleCameraSettingsPanel()" style="background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); border-radius:9999px; padding:7px 14px; font-size:0.76rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s; white-space:nowrap;" title="Atur resolusi, megapixel & mikrofon bawaan">
                                <i class="fas fa-sliders-h"></i> <span>Pengaturan</span>
                            </button>

                            <button type="button" onclick="window.closeLiveCameraModal()" style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.3); padding:7px 13px; border-radius:9999px; color:#fca5a5; font-size:0.76rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s; flex-shrink:0; white-space:nowrap;" title="Tutup Kamera Perangkat">
                                <i class="fas fa-times"></i> <span>Tutup</span>
                            </button>
                        </div>
                    </div>

                    <!-- Baris Informasi Spesifikasi Real-Time (Utuh 100% tanpa terpotong) -->
                    <div id="cameraLiveSpecsBadge" style="font-size:0.78rem; color:#e2e8f0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.09); border-radius:12px; padding:6px 12px; display:flex; align-items:center; flex-wrap:wrap; width:100%; box-sizing:border-box;">
                        <i class="fas fa-video" style="color:#10b981; margin-right:4px;"></i><span>1280x720 (0.9 MP)</span>
                        <span style="margin:0 6px; color:#64748b;">•</span>
                        <span>30 FPS</span>
                        <span style="margin:0 6px; color:#64748b;">•</span>
                        <i class="fas fa-microphone" style="color:#38bdf8; margin-right:4px;"></i><span style="color:#e2e8f0;">Microphone Array</span>
                    </div>
                </div>

                <!-- 2. PANEL PENGATURAN LANJUTAN (Mengubah spesifikasi secara otomatis & real-time) -->
                <div id="cameraAdvancedSettingsPanel" style="display:none; padding:12px 20px; background:#0f172a; border-bottom:1.5px solid #1e293b; color:#ffffff; flex-shrink:0;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                        <div style="font-size:0.76rem; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.4px; display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-cog"></i> Pengaturan Sensor, Resolusi & Mikrofon
                        </div>
                        <span style="font-size:0.7rem; color:#94a3b8;">Otomatis memperbarui spesifikasi di atas</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px;">
                        <!-- Pemilih Sensor Kamera -->
                        <div style="background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.09);">
                            <label for="selCameraDevice" style="font-size:0.71rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:4px;">Sensor Kamera:</label>
                            <select id="selCameraDevice" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:5px 12px; font-size:0.76rem; outline:none; cursor:pointer;"></select>
                        </div>
                        <!-- Pemilih Mikrofon Perangkat -->
                        <div style="background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.09);">
                            <label for="selMicrophoneDevice" style="font-size:0.71rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:4px;">Mikrofon Perangkat:</label>
                            <select id="selMicrophoneDevice" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:5px 12px; font-size:0.76rem; outline:none; cursor:pointer;"></select>
                        </div>
                        <!-- Pemilih Resolusi & FPS -->
                        <div style="background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.09);">
                            <label for="selCameraResolution" style="font-size:0.71rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:4px;">Resolusi & FPS Kamera:</label>
                            <select id="selCameraResolution" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:5px 12px; font-size:0.76rem; outline:none; cursor:pointer;">
                                <option value="720p30">HD 720p @ 30 FPS (0.9 MP - Rekomendasi)</option>
                                <option value="720p60">HD 720p @ 60 FPS (0.9 MP - Super Halus)</option>
                                <option value="1080p30">Full HD 1080p @ 30 FPS (2.1 MP)</option>
                                <option value="1080p60">Full HD 1080p @ 60 FPS (2.1 MP)</option>
                                <option value="480p30">SD 480p @ 30 FPS (0.4 MP - Hemat Kuota)</option>
                                <option value="native">Maksimal Sensor 4K @ 60 FPS (8.3 MP)</option>
                            </select>
                        </div>
                        <!-- Opsi Cermin (Mirror View) -->
                        <div style="background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.09); display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="chkCameraMirrorOption" onchange="window.applyCameraDeviceChange()" style="cursor:pointer; accent-color:#009846; width:17px; height:17px; flex-shrink:0;">
                            <label for="chkCameraMirrorOption" style="font-size:0.75rem; font-weight:700; color:#e2e8f0; cursor:pointer; line-height:1.3;">
                                Cermin Pratinjau (Mirror Flip)
                            </label>
                        </div>
                    </div>
                </div>

                <!-- 3. AREA VIEWFINDER VIDEO (Ukuran Presisi & Tidak Pernah Meluber) -->
                <div style="padding:12px 18px; background:#090d16; flex:1 1 auto; display:flex; align-items:center; justify-content:center;">
                    <div id="cameraViewfinderBox" style="position:relative; width:100%; height:clamp(220px, 38vh, 310px); background:#000000; border-radius:22px; overflow:hidden; box-shadow:inset 0 0 30px rgba(0,0,0,0.85); border:1.5px solid rgba(255,255,255,0.12); transition:height 0.2s ease;">
                        <video id="liveCameraFeed" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:22px; transition:transform 0.25s ease; z-index:1;"></video>

                        <!-- Overlay Ketika Kamera Dimatikan -->
                        <div id="cameraVideoDisabledOverlay" style="display:none; position:absolute; inset:0; background:#0f172a; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8; z-index:10; border-radius:22px; padding:16px; text-align:center;">
                            <i class="fas fa-video-slash" style="font-size:2.4rem; color:#ef4444; margin-bottom:8px;"></i>
                            <div style="font-size:0.95rem; font-weight:800; color:#f8fafc;">Kamera Dinonaktifkan Sementara</div>
                            <small style="margin-top:4px; color:#94a3b8;">Klik tombol "Kamera OFF" di bawah untuk mengaktifkan kembali</small>
                        </div>

                        <!-- Fallback Notice jika Kamera Diblokir -->
                        <div id="cameraFallbackNotice" style="display:none; position:absolute; inset:0; background:#0f172a; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; color:#ffffff; z-index:12; border-radius:22px;">
                            <i class="fas fa-video-slash" style="font-size:2.2rem; color:#ef4444; margin-bottom:8px;"></i>
                            <h4 style="font-size:0.98rem; font-weight:800; margin-bottom:4px;">Izin Kamera Belum Diberikan</h4>
                            <p style="font-size:0.78rem; color:#94a3b8; max-width:360px; margin-bottom:12px; line-height:1.45;">
                                Izinkan peramban mengakses kamera & mikrofon Anda, atau pilih berkas foto/video dari galeri perangkat.
                            </p>
                            <button type="button" onclick="window.openDeviceGalleryDirectly()" style="background:#009846; color:white; border:none; border-radius:9999px; padding:8px 20px; font-size:0.8rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-images"></i> Buka Galeri Perangkat
                            </button>
                        </div>

                        <!-- Indikator Level Suara Mikrofon (Pojok Kiri Atas Viewfinder) -->
                        <div style="position:absolute; top:12px; left:12px; z-index:20; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); padding:5px 12px; border-radius:9999px; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,0.16);">
                            <i id="cameraViewfinderMicIcon" class="fas fa-microphone" style="font-size:0.78rem; color:#10b981;"></i>
                            <div style="width:60px; height:6px; background:rgba(255,255,255,0.22); border-radius:9999px; overflow:hidden;">
                                <div id="cameraMicLevelBar" style="width:0%; height:100%; background:#10b981; transition:width 0.08s;"></div>
                            </div>
                        </div>

                        <!-- Badge Mode Aktif & Timer Rekam Video (Pojok Kanan Atas Viewfinder) -->
                        <div style="position:absolute; top:12px; right:12px; z-index:20; display:flex; align-items:center; gap:8px;">
                            <div id="cameraVideoRecordTimer" style="display:none; align-items:center; gap:6px; background:#dc2626; color:white; padding:5px 14px; border-radius:9999px; font-family:monospace; font-size:0.82rem; font-weight:800; box-shadow:0 3px 10px rgba(220,38,38,0.5);">
                                00:00
                            </div>
                            <div id="cameraViewfinderModeBadge" style="background:rgba(0,152,70,0.88); backdrop-filter:blur(8px); color:#ffffff; padding:5px 12px; border-radius:9999px; font-size:0.7rem; font-weight:800; letter-spacing:0.4px; border:1px solid rgba(16,185,129,0.45); display:flex; align-items:center; gap:5px; white-space:nowrap;">
                                <i class="fas fa-camera"></i> MODE FOTO
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. BAR KONTROL PERANGKAT (Kamera ON/OFF & Mic ON/OFF) + PEMILIH 2 OPSI MODE (Opsi Foto vs Opsi Video) -->
                <div style="padding:10px 20px; background:#0f172a; border-top:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-shrink:0; flex-wrap:wrap;">
                    <!-- Grup Kiri: Tombol Mematikan/Menyalakan Kamera & Mic (Tidak tertutup layout apa pun) -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" id="btnCameraVideoToggle" onclick="window.toggleCameraVideoTrack()" style="background:rgba(16,185,129,0.16); color:#34d399; border:1.5px solid rgba(16,185,129,0.4); border-radius:9999px; padding:7px 15px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s; white-space:nowrap;" title="Matikan atau nyalakan kamera">
                            <i class="fas fa-video"></i> <span>Kamera ON</span>
                        </button>
                        <button type="button" id="btnCameraAudioToggle" onclick="window.toggleCameraAudioTrack()" style="background:rgba(56,189,248,0.16); color:#38bdf8; border:1.5px solid rgba(56,189,248,0.4); border-radius:9999px; padding:7px 15px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s; white-space:nowrap;" title="Matikan atau nyalakan mikrofon">
                            <i class="fas fa-microphone"></i> <span>Mic ON</span>
                        </button>
                    </div>

                    <!-- Grup Kanan: 2 Opsi Mode Eksklusif (Opsi Foto vs Opsi Video) -->
                    <div style="background:#1e293b; padding:4px; border-radius:9999px; display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(255,255,255,0.12);">
                        <button type="button" id="tabCameraModePhoto" onclick="window.switchCameraCaptureMode('photo')" style="background:linear-gradient(135deg, #009846, #059669); color:#ffffff; border:1px solid rgba(16,185,129,0.5); border-radius:9999px; padding:6px 16px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.18s; box-shadow:0 3px 10px rgba(0,152,70,0.4); white-space:nowrap;">
                            <i class="fas fa-camera"></i> <span>Opsi Foto</span>
                        </button>
                        <button type="button" id="tabCameraModeVideo" onclick="window.switchCameraCaptureMode('video')" style="background:transparent; color:#94a3b8; border:1px solid transparent; border-radius:9999px; padding:6px 16px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.18s; white-space:nowrap;">
                            <i class="fas fa-video"></i> <span>Opsi Video</span>
                        </button>
                    </div>
                </div>

                <!-- 5. FOOTER ACTION BAR: Hemat Tempat, Rapi, 1 Tombol Aksi Tunggal Sesuai Mode -->
                <div style="padding:14px 20px; background:#111827; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-shrink:0; border-top:1px solid rgba(255,255,255,0.08);">
                    <!-- Kiri: Buka Galeri Perangkat -->
                    <button type="button" onclick="window.openDeviceGalleryDirectly()" style="background:rgba(255,255,255,0.08); color:#f8fafc; border:1px solid rgba(255,255,255,0.16); border-radius:9999px; padding:10px 20px; font-size:0.84rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s; flex-shrink:0; white-space:nowrap;" title="Buka Galeri Perangkat">
                        <i class="fas fa-images" style="color:#38bdf8;"></i> <span>Buka Galeri</span>
                    </button>

                    <!-- Kanan: SATU Tombol Aksi Tunggal Sesuai Opsi Mode (Foto ATAU Video) -->
                    <div style="display:flex; align-items:center; justify-content:flex-end;">
                        <!-- A. SATU TOMBOL SAAT OPSI FOTO AKTIF -->
                        <button type="button" id="btnSnapPhotoSingle" onclick="window.snapCameraPhoto()" style="background:linear-gradient(135deg, #009846, #059669); color:#ffffff; border:none; border-radius:9999px; padding:11px 28px; font-size:0.86rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(0,152,70,0.4); transition:all 0.15s; white-space:nowrap;" title="Ambil Foto Sekarang">
                            <i class="fas fa-camera"></i> <span>Ambil Foto</span>
                        </button>

                        <!-- B. SATU TOMBOL SAAT OPSI VIDEO AKTIF -->
                        <button type="button" id="btnStartVideoRecord" onclick="window.toggleCameraVideoRecording()" style="display:none; background:linear-gradient(135deg, #e11d48, #be123c); color:#ffffff; border:none; border-radius:9999px; padding:11px 28px; font-size:0.86rem; font-weight:800; cursor:pointer; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(225,29,72,0.4); transition:all 0.15s; white-space:nowrap;" title="Mulai / Selesai Merekam Video">
                            <i class="fas fa-video"></i> <span>Rekam Video</span>
                        </button>
                    </div>
                </div>

                <!-- Input Native untuk Galeri & Berkas Foto/Video Perangkat -->
                <input type="file" id="nativeCameraCaptureInput" style="display:none;" multiple accept="image/*,video/*" onchange="window.handleNativeCameraSelected(this)">
                <input type="file" id="nativeCameraPhotoInput" style="display:none;" accept="image/*" onchange="window.handleNativeCameraSelected(this)">
                <input type="file" id="nativeCameraVideoInput" style="display:none;" accept="video/*" onchange="window.handleNativeCameraSelected(this)">
            </div>
        `;
        document.body.appendChild(div);
    }
})();
