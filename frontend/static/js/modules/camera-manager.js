/**
 * MODUL PENGELOLA KAMERA & AUDIO PERANGKAT RESMI
 * Pemerintah Kabupaten Sidoarjo - Dinas Sosial
 * Fitur Utama:
 * 1. Tampilan lebih membulat (radius 32px), modern glassmorphism, dan viewfinder presisi proporsional.
 * 2. Layout adaptif yang presisi: tidak menabrak atas & bawah, dan tidak menabrak kiri & kanan di semua layar.
 * 3. Seluruh elemen input, dropdown pilihan mikrofon/kamera/resolusi dan tombol berbentuk membulat (rounded pill & rounded cards).
 * 4. Fitur "Putar" secara fisik memutar antara kamera depan & belakang perangkat (bukan membalik mirror).
 * 5. Pengaturan Lanjutan Perangkat Bawaan:
 *    - Deteksi spesifikasi kamera & estimasi megapixel (MP), resolusi & FPS aktif (misal 720p30fps, 1080p30fps, 480p, dll).
 *    - Pemilih mikrofon perangkat bawaan (misal Intel Smart Sound, Realtek, Headset, Mic Eksternal).
 *    - Pemilih fisik kamera perangkat jika terdapat lebih dari satu sensor (depan/belakang/eksternal).
 *    - Pengaturan terpisah untuk mode Cermin (Mirror/Non-Mirror).
 * 6. Perekaman video dengan audio jernih dari mikrofon yang dipilih & pemotretan foto beresolusi tinggi.
 */

(function () {
    let currentCameraStream = null;
    let cameraAudioCtx = null;
    let cameraAnalyser = null;
    let cameraMicAnimFrame = null;
    let currentFacingMode = 'environment'; // 'user' | 'environment'
    let cameraTargetContext = 'admin-chat'; // 'admin-chat' | 'admin-voice-preview' | 'warga-chat' | 'warga-voice-preview'

    // Status Perangkat & Konfigurasi Lanjutan
    let detectedVideoDevices = [];
    let detectedAudioDevices = [];
    let selectedCameraDeviceId = '';
    let selectedMicDeviceId = '';
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
        micLabel: 'Mikrofon Bawaan',
        cameraLabel: 'Kamera Bawaan'
    };

    window.openLiveCameraModal = async function (context) {
        cameraTargetContext = context || 'admin-chat';
        let modal = document.getElementById('modalLiveCameraCapture');
        if (!modal) {
            createCameraModalElement();
            modal = document.getElementById('modalLiveCameraCapture');
        }
        modal.style.display = 'flex';
        await refreshAvailableMediaDevices();
        await startCameraStream();
    };

    window.closeLiveCameraModal = function () {
        stopCameraStream();
        const modal = document.getElementById('modalLiveCameraCapture');
        if (modal) modal.style.display = 'none';
        isRecordingVideo = false;
        clearInterval(videoRecordTimer);
        const recordBtn = document.getElementById('btnStartVideoRecord');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-video"></i> Rekam Video';
            recordBtn.style.background = '#e11d48';
        }
        const timerEl = document.getElementById('cameraVideoRecordTimer');
        if (timerEl) timerEl.style.display = 'none';
        isSettingsPanelOpen = false;
        const panel = document.getElementById('cameraAdvancedSettingsPanel');
        if (panel) panel.style.display = 'none';
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
        let width = { ideal: 1280 };
        let height = { ideal: 720 };
        let frameRate = { ideal: 30 };

        if (selectedResolution === '1080p60') {
            width = { ideal: 1920, max: 1920 };
            height = { ideal: 1080, max: 1080 };
            frameRate = { ideal: 60, max: 60 };
        } else if (selectedResolution === '1080p30') {
            width = { ideal: 1920, max: 1920 };
            height = { ideal: 1080, max: 1080 };
            frameRate = { ideal: 30, max: 30 };
        } else if (selectedResolution === '720p60') {
            width = { ideal: 1280, max: 1280 };
            height = { ideal: 720, max: 720 };
            frameRate = { ideal: 60, max: 60 };
        } else if (selectedResolution === '720p30') {
            width = { ideal: 1280, max: 1280 };
            height = { ideal: 720, max: 720 };
            frameRate = { ideal: 30, max: 30 };
        } else if (selectedResolution === '480p30') {
            width = { ideal: 854, max: 854 };
            height = { ideal: 480, max: 480 };
            frameRate = { ideal: 30, max: 30 };
        } else if (selectedResolution === 'native') {
            width = { ideal: 3840 };
            height = { ideal: 2160 };
            frameRate = { ideal: 60 };
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

    async function startCameraStream() {
        stopCameraStream();
        const videoEl = document.getElementById('liveCameraFeed');
        const fallbackNotice = document.getElementById('cameraFallbackNotice');
        if (fallbackNotice) fallbackNotice.style.display = 'none';

        const constraints = getTargetConstraints();

        try {
            try {
                currentCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (errWithAudio) {
                console.warn('Gagal meminta audio mic, mencoba video saja:', errWithAudio);
                currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video, audio: false });
            }

            if (videoEl && currentCameraStream) {
                videoEl.srcObject = currentCameraStream;
                videoEl.play().catch(() => {});

                // Terapkan pengaturan track aktif
                currentCameraStream.getVideoTracks().forEach(t => t.enabled = isVideoTrackEnabled);
                currentCameraStream.getAudioTracks().forEach(t => t.enabled = isAudioTrackEnabled);

                // Baca spesifikasi nyata dari track
                readStreamTrackSpecifications(currentCameraStream);

                updateMirrorDisplay();
                updateTrackButtonsUI();
                setupMicLevelMeter(currentCameraStream);
                await refreshAvailableMediaDevices();
            }
        } catch (err) {
            console.warn('Gagal membuka kamera perangkat:', err);
            if (fallbackNotice) fallbackNotice.style.display = 'flex';
        }
    }

    function readStreamTrackSpecifications(stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
            const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
            const w = settings.width || 1280;
            const h = settings.height || 720;
            const fps = Math.round(settings.frameRate || 30);
            const mp = (w * h / 1000000).toFixed(1);

            activeStreamSpecs.width = w;
            activeStreamSpecs.height = h;
            activeStreamSpecs.frameRate = fps;
            activeStreamSpecs.megaPixels = `${mp} MP`;
            activeStreamSpecs.cameraLabel = videoTrack.label || (currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang');

            if (settings.facingMode) {
                currentFacingMode = settings.facingMode;
            }
        }

        if (audioTrack) {
            activeStreamSpecs.micLabel = audioTrack.label || 'Mikrofon Bawaan Sistem';
        } else {
            activeStreamSpecs.micLabel = 'Tanpa Mikrofon';
        }

        updateCameraSpecsBadge();
    }

    function updateCameraSpecsBadge() {
        const badge = document.getElementById('cameraLiveSpecsBadge');
        if (badge) {
            const cleanMic = (activeStreamSpecs.micLabel || 'Mic Aktif').split('(')[0].trim();
            badge.innerHTML = `
                <i class="fas fa-video text-emerald-400"></i> ${activeStreamSpecs.width}x${activeStreamSpecs.height} (${activeStreamSpecs.megaPixels}) • ${activeStreamSpecs.frameRate} FPS • <i class="fas fa-microphone text-sky-400"></i> ${cleanMic}
            `;
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
    // (Bukan sekadar membalik tampilan/mirror!)
    // =========================================================================
    window.switchCameraFacing = async function () {
        // Jika ada beberapa kamera fisik terdeteksi dalam detectedVideoDevices, ganti ke sensor berikutnya
        if (detectedVideoDevices.length > 1) {
            const currentIdx = detectedVideoDevices.findIndex(d => d.deviceId === selectedCameraDeviceId);
            const nextIdx = (currentIdx + 1) % detectedVideoDevices.length;
            selectedCameraDeviceId = detectedVideoDevices[nextIdx].deviceId;
        } else {
            // Toggle kamera depan dan belakang via facingMode ideal
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            selectedCameraDeviceId = '';
        }

        // Update indikator teks pada tombol putar
        const btn = document.getElementById('btnCameraFacingSwitch');
        if (btn) {
            btn.innerHTML = `<i class="fas fa-camera-rotate"></i> Putar Kamera`;
        }

        // Tampilkan feedback toast singkat
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'info',
                title: `Beralih ke Sensor Kamera Lain (${currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'})`,
                timer: 1200,
                showConfirmButton: false
            });
        }

        await startCameraStream();
    };

    // PENGATURAN CERMIN (MIRROR / NON-MIRROR) TERSENDIRI
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

    // ON / OFF TRACK VIDEO & AUDIO
    window.toggleCameraVideoTrack = function () {
        if (!currentCameraStream) return;
        const tracks = currentCameraStream.getVideoTracks();
        if (tracks.length === 0) return;

        isVideoTrackEnabled = !isVideoTrackEnabled;
        tracks.forEach(t => t.enabled = isVideoTrackEnabled);

        const placeholder = document.getElementById('cameraVideoDisabledOverlay');
        if (placeholder) {
            placeholder.style.display = isVideoTrackEnabled ? 'none' : 'flex';
        }
        updateTrackButtonsUI();
    };

    window.toggleCameraAudioTrack = function () {
        if (!currentCameraStream) return;
        const tracks = currentCameraStream.getAudioTracks();
        if (tracks.length === 0) return;

        isAudioTrackEnabled = !isAudioTrackEnabled;
        tracks.forEach(t => t.enabled = isAudioTrackEnabled);

        const meterBar = document.getElementById('cameraMicLevelBar');
        if (!isAudioTrackEnabled && meterBar) {
            meterBar.style.width = '0%';
        }
        updateTrackButtonsUI();
    };

    function updateTrackButtonsUI() {
        const btnVideo = document.getElementById('btnCameraVideoToggle');
        if (btnVideo) {
            btnVideo.style.background = isVideoTrackEnabled ? 'rgba(51,65,85,0.85)' : '#dc2626';
            btnVideo.innerHTML = `<i class="fas ${isVideoTrackEnabled ? 'fa-video' : 'fa-video-slash'}"></i> ${isVideoTrackEnabled ? 'Kamera ON' : 'Kamera OFF'}`;
        }

        const btnAudio = document.getElementById('btnCameraAudioToggle');
        if (btnAudio) {
            btnAudio.style.background = isAudioTrackEnabled ? 'rgba(51,65,85,0.85)' : '#dc2626';
            btnAudio.innerHTML = `<i class="fas ${isAudioTrackEnabled ? 'fa-microphone' : 'fa-microphone-slash'}"></i> ${isAudioTrackEnabled ? 'Mic ON' : 'Mic OFF'}`;
        }
    }

    // =========================================================================
    // PANEL PENGATURAN LANJUTAN (RESOLUSI 720P30, 1080P, PEMILIH MIC INTEL/BAWAAN)
    // TAMPILAN LEBIH MEMBULAT (ROUNDED CARDS & ROUNDED SELECTS)
    // =========================================================================
    window.toggleCameraSettingsPanel = function () {
        isSettingsPanelOpen = !isSettingsPanelOpen;
        const panel = document.getElementById('cameraAdvancedSettingsPanel');
        if (panel) {
            panel.style.display = isSettingsPanelOpen ? 'block' : 'none';
        }
        if (isSettingsPanelOpen) {
            populateSettingsDropdowns();
        }
    };

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

        // Dropdown Mikrofon (Intel Smart Sound, Realtek, Headset, Mic Eksternal)
        const micSel = document.getElementById('selMicrophoneDevice');
        if (micSel) {
            let html = `<option value="">Mikrofon Default Sistem</option>`;
            detectedAudioDevices.forEach((dev, idx) => {
                const label = dev.label || `Mikrofon Perangkat ${idx + 1}`;
                const isSelected = selectedMicDeviceId === dev.deviceId;
                html += `<option value="${dev.deviceId}" ${isSelected ? 'selected' : ''}>${label}</option>`;
            });
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
        if (micSel) selectedMicDeviceId = micSel.value;
        if (resSel) selectedResolution = resSel.value;
        if (mirrorChk) isCameraMirrored = mirrorChk.checked;

        updateMirrorDisplay();
        await startCameraStream();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top',
                icon: 'success',
                title: 'Pengaturan Kamera Diterapkan',
                text: `${activeStreamSpecs.width}x${activeStreamSpecs.height} @ ${activeStreamSpecs.frameRate}fps • ${activeStreamSpecs.micLabel.split('(')[0]}`,
                timer: 1600,
                showConfirmButton: false
            });
        }
    };

    // =========================================================================
    // PENGAMBILAN FOTO
    // =========================================================================
    window.snapCameraPhoto = function () {
        const videoEl = document.getElementById('liveCameraFeed');
        if (!videoEl || !videoEl.videoWidth || !isVideoTrackEnabled) {
            return document.getElementById('nativeCameraCaptureInput')?.click();
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');

        // Terapkan mirror pada hasil foto jika opsi cermin diaktifkan
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
                    text: `${fileName} (${activeStreamSpecs.width}x${activeStreamSpecs.height}) telah ditambahkan ke lampiran.`,
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        }, 'image/jpeg', 0.95);
    };

    // =========================================================================
    // PEREKAMAN VIDEO
    // =========================================================================
    window.toggleCameraVideoRecording = function () {
        if (isRecordingVideo) {
            stopVideoRecording();
        } else {
            startVideoRecording();
        }
    };

    function startVideoRecording() {
        if (!currentCameraStream) return;
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
                if (videoChunks.length > 0) {
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
                            text: `${fileName} telah ditambahkan ke lampiran pesan.`,
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
                recordBtn.innerHTML = '<i class="fas fa-stop"></i> Selesai Merekam';
                recordBtn.style.background = '#dc2626';
            }

            const timerEl = document.getElementById('cameraVideoRecordTimer');
            if (timerEl) {
                timerEl.style.display = 'inline-block';
                timerEl.innerText = '00:00';
            }

            videoRecordTimer = setInterval(() => {
                videoRecordSecs++;
                const m = String(Math.floor(videoRecordSecs / 60)).padStart(2, '0');
                const s = String(videoRecordSecs % 60).padStart(2, '0');
                if (timerEl) timerEl.innerText = `${m}:${s}`;
            }, 1000);
        } catch (err) {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Kendala Rekam Video', 'Peramban tidak mendukung perekaman video langsung dari stream.', 'error');
            }
        }
    }

    function stopVideoRecording() {
        if (videoMediaRecorder && videoMediaRecorder.state !== 'inactive') {
            videoMediaRecorder.stop();
        }
        clearInterval(videoRecordTimer);
        isRecordingVideo = false;
    }

    // =========================================================================
    // MEMBUKA GALERI FOTO & VIDEO PERANGKAT SECARA LANGSUNG
    // =========================================================================
    window.openDeviceGalleryDirectly = function () {
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
        } else if (cameraTargetContext === 'warga-chat') {
            if (typeof window.addWargaChatAttachments === 'function') {
                window.addWargaChatAttachments(fileList);
            }
        } else {
            // Default: admin-chat
            if (typeof window.appendAdminMediaSelection === 'function') {
                window.appendAdminMediaSelection({ files: fileList });
            } else if (typeof window.addAdminChatAttachments === 'function') {
                window.addAdminChatAttachments(fileList);
            }
        }
    }

    // =========================================================================
    // PEMBUATAN ELEMEN MODAL KAMERA MODERN, SANGAT MEMBULAT & ADAPTIF
    // Desain Khusus: Bebas benturan atas-bawah dan kanan-kiri, semua komponen rounded
    // =========================================================================
    function createCameraModalElement() {
        const div = document.createElement('div');
        div.id = 'modalLiveCameraCapture';
        // Padding 16px sekeliling, overflow auto agar tidak terpotong di layar kecil
        div.style.cssText = 'display:none; position:fixed; inset:0; z-index:999999; background:rgba(0,0,0,0.85); backdrop-filter:blur(12px); align-items:center; justify-content:center; padding:16px; box-sizing:border-box; overflow-y:auto;';
        
        div.innerHTML = `
            <div style="background:#090d16; border-radius:32px; width:100%; max-width:680px; max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; overflow:hidden; margin:auto; box-shadow:0 30px 80px rgba(0,0,0,0.9); border:1.5px solid rgba(255,255,255,0.14); box-sizing:border-box; position:relative;">
                
                <!-- Header Modern Membulat (Flex Shrink 0) -->
                <div style="padding:14px 20px; display:flex; justify-content:space-between; align-items:center; background:#111827; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; gap:10px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:12px; color:#ffffff;">
                        <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, #ec4899, #db2777); display:flex; align-items:center; justify-content:center; font-size:1.15rem; box-shadow:0 4px 14px rgba(236,72,153,0.4); flex-shrink:0;">
                            <i class="fas fa-camera"></i>
                        </div>
                        <div>
                            <div style="font-size:1.05rem; font-weight:800; color:#ffffff; letter-spacing:0.3px; display:flex; align-items:center; gap:8px;">
                                Kamera Perangkat
                                <span style="background:rgba(16,185,129,0.2); color:#10b981; font-size:0.68rem; font-weight:800; padding:2px 10px; border-radius:9999px; border:1px solid rgba(16,185,129,0.3);">LIVE</span>
                            </div>
                            <div id="cameraLiveSpecsBadge" style="font-size:0.75rem; color:#94a3b8; font-family:monospace; margin-top:2px;">
                                Memuat konfigurasi sensor...
                            </div>
                        </div>
                    </div>
                    
                    <!-- Toolbar Kontrol Cepat Membulat -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <!-- Tombol Putar Kamera Depan / Belakang Fisik -->
                        <button type="button" id="btnCameraFacingSwitch" onclick="window.switchCameraFacing()" style="background:linear-gradient(135deg, #1e293b, #334155); color:#f8fafc; border:1px solid rgba(255,255,255,0.18); border-radius:9999px; padding:7px 16px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:all 0.15s;" onmouseover="this.style.transform='scale(1.04)';" onmouseout="this.style.transform='scale(1)';" title="Putar sensor antara kamera depan (selfie) dan kamera belakang">
                            <i class="fas fa-camera-rotate"></i> Putar Kamera
                        </button>

                        <!-- Tombol Pengaturan Lanjutan -->
                        <button type="button" onclick="window.toggleCameraSettingsPanel()" style="background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); border-radius:9999px; padding:7px 16px; font-size:0.78rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s;" title="Atur resolusi, megapixel & mikrofon bawaan">
                            <i class="fas fa-sliders-h"></i> Pengaturan
                        </button>

                        <button type="button" onclick="window.closeLiveCameraModal()" style="background:rgba(255,255,255,0.08); border:none; width:36px; height:36px; border-radius:50%; color:#94a3b8; font-size:1.3rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; flex-shrink:0;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'" title="Tutup">&times;</button>
                    </div>
                </div>

                <!-- PANEL PENGATURAN LANJUTAN: SEMUA DROPDOWN & KOTAK LEBIH MEMBULAT (ROUNDED PILL) -->
                <div id="cameraAdvancedSettingsPanel" style="display:none; padding:16px 20px; background:#0f172a; border-bottom:1.5px solid #1e293b; color:#ffffff; max-height:220px; overflow-y:auto; flex-shrink:0;">
                    <div style="font-size:0.82rem; font-weight:800; color:#38bdf8; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-cog"></i> Pengaturan Sensor & Mikrofon Bawaan
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px;">
                        <!-- Pemilih Sensor Kamera Membulat -->
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);">
                            <label style="font-size:0.74rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:6px;">Sensor Kamera:</label>
                            <select id="selCameraDevice" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:8px 14px; font-size:0.8rem; outline:none; cursor:pointer;"></select>
                        </div>
                        <!-- Pemilih Mikrofon (Intel/Realtek/dll) Membulat -->
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);">
                            <label style="font-size:0.74rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:6px;">Mikrofon Perangkat:</label>
                            <select id="selMicrophoneDevice" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:8px 14px; font-size:0.8rem; outline:none; cursor:pointer;"></select>
                        </div>
                        <!-- Pemilih Resolusi & FPS Membulat -->
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);">
                            <label style="font-size:0.74rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:6px;">Resolusi & FPS Kamera:</label>
                            <select id="selCameraResolution" onchange="window.applyCameraDeviceChange()" style="width:100%; background:#1e293b; color:#ffffff; border:1.5px solid #475569; border-radius:9999px; padding:8px 14px; font-size:0.8rem; outline:none; cursor:pointer;">
                                <option value="720p30">HD 720p @ 30 FPS (~0.9 MP - Rekomendasi)</option>
                                <option value="720p60">HD 720p @ 60 FPS (Super Halus)</option>
                                <option value="1080p30">Full HD 1080p @ 30 FPS (~2.1 MP)</option>
                                <option value="1080p60">Full HD 1080p @ 60 FPS (~2.1 MP)</option>
                                <option value="480p30">SD 480p @ 30 FPS (Hemat Kuota)</option>
                                <option value="native">Maksimal Sensor Bawaan (4K / Tertinggi)</option>
                            </select>
                        </div>
                        <!-- Opsi Cermin (Mirror View) Membulat -->
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="chkCameraMirrorOption" onchange="window.applyCameraDeviceChange()" style="cursor:pointer; accent-color:#009846; width:18px; height:18px;">
                            <label for="chkCameraMirrorOption" style="font-size:0.78rem; font-weight:700; color:#e2e8f0; cursor:pointer;">
                                Cermin Pratinjau (Mirror Flip)
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Video Viewfinder Feed (Proporsional & Bebas Menabrak Atas/Bawah) -->
                <div style="padding:12px 16px 0 16px; background:#090d16; flex:1 1 auto; min-height:180px; max-height:min(44vh, 380px); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <div style="position:relative; width:100%; height:100%; background:#000000; border-radius:26px; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 0 30px rgba(0,0,0,0.85); border:1px solid rgba(255,255,255,0.1);">
                        <video id="liveCameraFeed" autoplay playsinline muted style="width:100%; height:100%; object-fit:contain; max-height:100%; border-radius:26px; transition:transform 0.25s ease;"></video>
                        
                        <!-- Overlay Ketika Kamera Dimatikan -->
                        <div id="cameraVideoDisabledOverlay" style="display:none; position:absolute; inset:0; background:#0f172a; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8; z-index:10; border-radius:26px;">
                            <i class="fas fa-video-slash" style="font-size:3rem; color:#ef4444; margin-bottom:10px;"></i>
                            <div style="font-size:0.95rem; font-weight:800; color:#f8fafc;">Kamera Dinonaktifkan</div>
                            <small style="margin-top:4px;">Klik tombol di bawah untuk mengaktifkan kembali</small>
                            <button type="button" onclick="window.toggleCameraVideoTrack()" style="margin-top:14px; background:#009846; color:white; border:none; border-radius:9999px; padding:9px 24px; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(0,152,70,0.35);">
                                <i class="fas fa-video"></i> Aktifkan Kamera
                            </button>
                        </div>

                        <!-- Fallback Notice if Camera Blocked -->
                        <div id="cameraFallbackNotice" style="display:none; position:absolute; inset:0; background:#0f172a; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; color:#ffffff; z-index:10; border-radius:26px;">
                            <i class="fas fa-video-slash" style="font-size:2.6rem; color:#ef4444; margin-bottom:10px;"></i>
                            <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:6px;">Izin Kamera Belum Diberikan</h4>
                            <p style="font-size:0.82rem; color:#94a3b8; max-width:380px; margin-bottom:16px; line-height:1.5;">
                                Izinkan peramban mengakses kamera & mikrofon Anda, atau pilih langsung berkas dari galeri perangkat Anda.
                            </p>
                            <button type="button" onclick="window.openDeviceGalleryDirectly()" style="background:#009846; color:white; border:none; border-radius:9999px; padding:10px 24px; font-size:0.86rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-images"></i> Buka Galeri Perangkat
                            </button>
                        </div>

                        <!-- Indikator Mikrofon & Audio Level Meter Membulat -->
                        <div style="position:absolute; top:12px; left:12px; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); padding:6px 14px; border-radius:9999px; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,0.15);">
                            <i class="fas fa-microphone" style="font-size:0.8rem; color:#10b981;"></i>
                            <div style="width:65px; height:6px; background:rgba(255,255,255,0.25); border-radius:9999px; overflow:hidden;">
                                <div id="cameraMicLevelBar" style="width:0%; height:100%; background:#10b981; transition:width 0.08s;"></div>
                            </div>
                        </div>

                        <!-- Timer Rekam Video Membulat -->
                        <div id="cameraVideoRecordTimer" style="display:none; position:absolute; top:12px; right:12px; background:#dc2626; color:white; padding:5px 16px; border-radius:9999px; font-family:monospace; font-size:0.88rem; font-weight:800; box-shadow:0 3px 10px rgba(220,38,38,0.5);">
                            00:00
                        </div>

                        <!-- Tombol Pintas Video/Audio ON/OFF Membulat di Viewfinder -->
                        <div style="position:absolute; bottom:12px; left:12px; display:flex; gap:8px;">
                            <button type="button" id="btnCameraVideoToggle" onclick="window.toggleCameraVideoTrack()" style="background:rgba(51,65,85,0.85); backdrop-filter:blur(6px); color:#f8fafc; border:1px solid rgba(255,255,255,0.2); border-radius:9999px; padding:6px 14px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-video"></i> Kamera ON
                            </button>
                            <button type="button" id="btnCameraAudioToggle" onclick="window.toggleCameraAudioTrack()" style="background:rgba(51,65,85,0.85); backdrop-filter:blur(6px); color:#f8fafc; border:1px solid rgba(255,255,255,0.2); border-radius:9999px; padding:6px 14px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-microphone"></i> Mic ON
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Footer Shutter & Action Bar Membulat Sempurna (Flex Shrink 0) -->
                <div style="padding:14px 20px; background:#111827; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-shrink:0; border-top:1px solid rgba(255,255,255,0.06); flex-wrap:wrap;">
                    <!-- Tombol Masuk Galeri Foto/Video Bawaan Membulat -->
                    <button type="button" onclick="window.openDeviceGalleryDirectly()" style="background:rgba(255,255,255,0.08); color:#f8fafc; border:1px solid rgba(255,255,255,0.14); border-radius:9999px; padding:10px 20px; font-size:0.84rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.18)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'" title="Buka Galeri Foto & Video Perangkat">
                        <i class="fas fa-images text-sky-400"></i> Buka Galeri
                    </button>

                    <!-- Tombol Shutter Utama: Jepret Foto (Lingkaran Ganda Modern Membulat) -->
                    <div style="display:flex; align-items:center; justify-content:center;">
                        <button type="button" onclick="window.snapCameraPhoto()" style="width:66px; height:66px; border-radius:50%; background:transparent; border:4px solid #ffffff; padding:4px; cursor:pointer; transition:transform 0.15s; outline:none; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,0.4);" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'" title="Jepret Foto Sekarang">
                            <div style="width:100%; height:100%; border-radius:50%; background:linear-gradient(135deg, #009846, #059669); box-shadow:0 4px 14px rgba(0,152,70,0.5);"></div>
                        </button>
                    </div>

                    <!-- Tombol Rekam Video Membulat -->
                    <button type="button" id="btnStartVideoRecord" onclick="window.toggleCameraVideoRecording()" style="background:#e11d48; color:white; border:none; border-radius:9999px; padding:11px 22px; font-size:0.85rem; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(225,29,72,0.4); transition:all 0.15s;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'" title="Mulai / Selesai Merekam Video">
                        <i class="fas fa-video"></i> Rekam Video
                    </button>
                </div>

                <!-- Input Native untuk Galeri & Berkas Foto/Video Perangkat -->
                <input type="file" id="nativeCameraCaptureInput" style="display:none;" multiple accept="image/*,video/*" onchange="window.handleNativeCameraSelected(this)">
            </div>
        `;
        document.body.appendChild(div);
    }
})();
