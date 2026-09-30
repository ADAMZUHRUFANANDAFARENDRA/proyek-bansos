/**
 * Modul: publik-audio.js
 * Deskripsi: Perekam suara, analisis frekuensi visualizer gelombang suara, dan pemutar audio interaktif
 */

// VOICE RECORDER & PRATINJAU DENGAN DYNAMIC LIVE AUDIO VISUALIZER (PENGADUAN)
// =========================================================================
function drawLiveRecordWaveAduan() {
    const canvas = document.getElementById('aduanRecordWaveCanvas');
    if (!canvas || !recordAnalyserAduan) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    const bufferLength = recordAnalyserAduan.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserAduan.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += Math.abs(val);
    }
    const avgVolume = sum / bufferLength;

    ctx.clearRect(0, 0, width, height);

    if (isVoicePausedAduan || avgVolume < 0.015) {
        // BATANG LURUS DATAR (KETIKA DIAM / TIDAK ADA DESIBEL SUARA NYATA)
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fca5a5';
        ctx.lineCap = 'round';
        ctx.stroke();
    } else {
        // GELOMBANG LIUK DINAMIS (SAAT DESIBEL SUARA TERDETEKSI)
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#e11d48';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    recordAnimFrameAduan = requestAnimationFrame(drawLiveRecordWaveAduan);
}

window.toggleVoiceRecordAduan = async function () {
    const ui = document.getElementById('aduanRecordingUI');
    const btnRecord = document.getElementById('btnRecordAduan');

    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksAduan = [];
        isVoicePausedAduan = false;
        mediaRecorderAduan = new MediaRecorder(stream);

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxAduan = new AudioCtx();
            recordAnalyserAduan = recordAudioCtxAduan.createAnalyser();
            recordAnalyserAduan.fftSize = 256;
            recordSourceAduan = recordAudioCtxAduan.createMediaStreamSource(stream);
            recordSourceAduan.connect(recordAnalyserAduan);
        } catch (e) {
            console.warn('[AudioContext Mic Warning]', e);
        }

        mediaRecorderAduan.ondataavailable = e => {
            if (e.data.size > 0) audioChunksAduan.push(e.data);
        };

        mediaRecorderAduan.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (recordAnimFrameAduan) cancelAnimationFrame(recordAnimFrameAduan);
            if (recordAudioCtxAduan && recordAudioCtxAduan.state !== 'closed') {
                recordAudioCtxAduan.close().catch(() => {});
            }
            if (audioChunksAduan.length > 0) {
                tempPreviewAduanBlob = new Blob(audioChunksAduan, { type: 'audio/webm' });
                window.renderPreviewVoiceAduan(tempPreviewAduanBlob);
            }
        };

        mediaRecorderAduan.start();
        voiceSecondsAduan = 0;
        if (ui) {
            ui.style.display = 'flex';
            ui.innerHTML = `
                <span id="aduanRecordTime" style="font-weight:800; font-family:monospace; color:#e11d48; font-size:0.85rem;">00:00</span>
                <canvas id="aduanRecordWaveCanvas" width="160" height="24" style="flex:1; height:24px; display:block;"></canvas>
                <button type="button" onclick="window.pauseResumeVoiceRecordAduan()" id="btnPauseVoiceAduan" style="background:none; border:none; color:#e11d48; cursor:pointer;" title="Jeda / Lanjut"><i class="fas fa-pause"></i></button>
                <button type="button" onclick="window.cancelVoiceRecordAduan()" style="background:none; border:none; color:#e11d48; cursor:pointer;" title="Batalkan"><i class="fas fa-trash-alt"></i></button>
                <button type="button" onclick="window.stopAndPreviewVoiceAduan()" style="background:#009846; color:white; border:none; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Selesai & Pratinjau"><i class="fas fa-check" style="font-size:0.75rem;"></i></button>
            `;
        }
        if (btnRecord) btnRecord.style.color = '#dc2626';

        drawLiveRecordWaveAduan();

        if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
        voiceTimerIntervalAduan = setInterval(() => {
            if (!isVoicePausedAduan) {
                voiceSecondsAduan++;
                const m = String(Math.floor(voiceSecondsAduan / 60)).padStart(2, '0');
                const s = String(voiceSecondsAduan % 60).padStart(2, '0');
                const timeEl = document.getElementById('aduanRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 1000);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Akses Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.pauseResumeVoiceRecordAduan = function () {
    if (!mediaRecorderAduan) return;
    const btn = document.getElementById('btnPauseVoiceAduan');
    if (mediaRecorderAduan.state === 'recording') {
        mediaRecorderAduan.pause();
        isVoicePausedAduan = true;
        if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
    } else if (mediaRecorderAduan.state === 'paused') {
        mediaRecorderAduan.resume();
        isVoicePausedAduan = false;
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    }
};

window.stopAndPreviewVoiceAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        mediaRecorderAduan.stop();
    }
    const btnRecord = document.getElementById('btnRecordAduan');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.renderPreviewVoiceAduan = function (blob) {
    const ui = document.getElementById('aduanRecordingUI');
    if (!ui) return;
    const previewUrl = URL.createObjectURL(blob);
    tempPreviewAduanAudio = new Audio(previewUrl);

    // Ambil sampel audio PCM untuk mendeteksi suara vs hening saat pemutaran pratinjau
    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewAduanPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate
            };
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewAduanPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    ui.style.display = 'flex';
    ui.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%; background:#ffffff; border:1.5px solid #009846; border-radius:24px; padding:6px 14px; box-shadow:0 4px 12px rgba(0,152,70,0.15);">
            <button type="button" onclick="window.togglePlayPreviewAduan(this)" style="background:#009846; color:white; border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                <i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>
            </button>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:800; color:#0f172a;">
                    <span style="color:#009846;"><i class="fas fa-headphones"></i> Pratinjau Suara</span>
                    <span id="aduanPreviewTimer">00:00 / ${formatAudioTime(voiceSecondsAduan)}</span>
                </div>
                <div style="position:relative; width:100%; height:18px; display:flex; align-items:center;">
                    <canvas id="aduanPreviewCanvas" width="160" height="18" style="width:100%; height:18px; display:block;"></canvas>
                    <input type="range" id="aduanPreviewSeek" min="0" max="100" value="0" step="0.1" oninput="window.seekPreviewAduan(this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; z-index:5;">
                </div>
            </div>
            <button type="button" class="audio-speed-btn" onclick="window.changePreviewAudioSpeedAduan(this)" title="Atur Kecepatan Suara">1x</button>
            <button type="button" onclick="window.cancelVoiceRecordAduan()" style="background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="Hapus / Rekam Ulang">
                <i class="fas fa-trash-alt" style="font-size:0.8rem;"></i>
            </button>
        </div>
    `;

    tempPreviewAduanAudio.onloadedmetadata = () => {
        const t = document.getElementById('aduanPreviewTimer');
        if (t) t.innerText = `00:00 / ${formatAudioTime(tempPreviewAduanAudio.duration)}`;
        window.drawPreviewWaveAduan(false);
    };

    tempPreviewAduanAudio.ontimeupdate = () => {
        const t = document.getElementById('aduanPreviewTimer');
        const s = document.getElementById('aduanPreviewSeek');
        if (t) t.innerText = `${formatAudioTime(tempPreviewAduanAudio.currentTime)} / ${formatAudioTime(tempPreviewAduanAudio.duration || voiceSecondsAduan)}`;
        if (s && tempPreviewAduanAudio.duration) {
            s.value = (tempPreviewAduanAudio.currentTime / tempPreviewAduanAudio.duration) * 100;
        }
    };

    tempPreviewAduanAudio.onended = () => {
        const btn = ui.querySelector('button[onclick*="togglePlayPreviewAduan"]');
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        const s = document.getElementById('aduanPreviewSeek');
        if (s) s.value = 0;
        if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
        window.drawPreviewWaveAduan(false);
    };

    window.drawPreviewWaveAduan(false);
};

function checkPreviewAduanHasSound() {
    if (!tempPreviewAduanAudio || tempPreviewAduanAudio.paused) return false;
    if (!tempPreviewAduanPCM) return true;
    const curTime = tempPreviewAduanAudio.currentTime;
    const idx = Math.floor(curTime * tempPreviewAduanPCM.sampleRate);
    const win = Math.floor(tempPreviewAduanPCM.sampleRate * 0.05);
    let sum = 0;
    const start = Math.max(0, idx - win);
    const end = Math.min(tempPreviewAduanPCM.data.length, idx + win);
    for (let i = start; i < end; i += 4) {
        sum += Math.abs(tempPreviewAduanPCM.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015;
}

window.drawPreviewWaveAduan = function (isWavy) {
    const canvas = document.getElementById('aduanPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const progress = (tempPreviewAduanAudio && tempPreviewAduanAudio.duration) ? (tempPreviewAduanAudio.currentTime / tempPreviewAduanAudio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        // BATANG LURUS JIKA HENING / DIAM / PAUSED
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(progressX, centerY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    } else {
        // GELOMBANG BERLIUK DINAMIS KETIKA ADA SUARA
        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 6;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 4;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    }
};

window.togglePlayPreviewAduan = function (btn) {
    if (!tempPreviewAduanAudio) return;
    if (tempPreviewAduanAudio.paused) {
        tempPreviewAduanAudio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause" style="font-size:0.85rem;"></i>';
            const loop = () => {
                if (tempPreviewAduanAudio && !tempPreviewAduanAudio.paused && !tempPreviewAduanAudio.ended) {
                    const hasSound = checkPreviewAduanHasSound();
                    window.drawPreviewWaveAduan(hasSound);
                    tempPreviewAduanAnim = requestAnimationFrame(loop);
                } else {
                    window.drawPreviewWaveAduan(false);
                }
            };
            tempPreviewAduanAnim = requestAnimationFrame(loop);
        }).catch(() => {});
    } else {
        tempPreviewAduanAudio.pause();
        btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
        window.drawPreviewWaveAduan(false);
    }
};

window.seekPreviewAduan = function (val) {
    if (!tempPreviewAduanAudio || !tempPreviewAduanAudio.duration) return;
    tempPreviewAduanAudio.currentTime = (parseFloat(val) / 100) * tempPreviewAduanAudio.duration;
    window.drawPreviewWaveAduan(!tempPreviewAduanAudio.paused && checkPreviewAduanHasSound());
};

window.changePreviewAudioSpeedAduan = function (btn) {
    if (!tempPreviewAduanAudio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = tempPreviewAduanAudio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    tempPreviewAduanAudio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.sendConfirmedVoiceAduan = function () {
    if (!tempPreviewAduanBlob) return;
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);

    window.editedAduanMediaBlob = tempPreviewAduanBlob;
    window.editedAduanMediaExt = 'webm';
    window.editedAduanMediaType = 'audio';

    const ui = document.getElementById('aduanRecordingUI');
    if (ui) ui.style.display = 'none';

    tempPreviewAduanBlob = null;
    window.kirimPesanAduan();
};

window.cancelVoiceRecordAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (recordAnimFrameAduan) cancelAnimationFrame(recordAnimFrameAduan);
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (recordAudioCtxAduan && recordAudioCtxAduan.state !== 'closed') {
        recordAudioCtxAduan.close().catch(() => {});
    }
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        mediaRecorderAduan.ondataavailable = null;
        mediaRecorderAduan.onstop = null;
        mediaRecorderAduan.stop();
    }
    audioChunksAduan = [];
    tempPreviewAduanBlob = null;
    tempPreviewAduanPCM = null;
    const ui = document.getElementById('aduanRecordingUI');
    const btnRecord = document.getElementById('btnRecordAduan');
    if (ui) ui.style.display = 'none';
    if (btnRecord) btnRecord.style.color = '#64748b';
};

// =========================================================================


// FITUR AUDIO MURNI (TANPA CORS BLOCK), PCM ANALYSER & PROGRESS SCRUBBER
// =========================================================================
async function loadAudioPCMData(audioId, url) {
    if (audioWaveformDataMap[audioId]) return;
    try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);
        audioWaveformDataMap[audioId] = {
            data: audioBuffer.getChannelData(0),
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration
        };
        tempCtx.close().catch(() => {});
    } catch (e) {
        audioWaveformDataMap[audioId] = { fallback: true };
    }
}

function checkAudioHasSoundAtCurrentTime(audioId) {
    const pcm = audioWaveformDataMap[audioId];
    const audio = document.getElementById(audioId);
    if (!audio || audio.paused) return false;
    if (!pcm || pcm.fallback) return true;

    const curTime = audio.currentTime;
    const index = Math.floor(curTime * pcm.sampleRate);
    const windowSize = Math.floor(pcm.sampleRate * 0.05); // 50ms window
    let sum = 0;
    const start = Math.max(0, index - windowSize);
    const end = Math.min(pcm.data.length, index + windowSize);

    for (let i = start; i < end; i += 4) {
        sum += Math.abs(pcm.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015; // Ambang batas suara vokal nyata
}

window.initAudioMetadata = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    loadAudioPCMData(audioId, audio.src);
    window.drawAudioWave(audioId, false);
};

window.updateAudioTime = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const timeEl = document.getElementById(`time_${audioId}`);
    const seekEl = document.getElementById(`seek_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    if (seekEl && audio.duration) {
        seekEl.value = (audio.currentTime / audio.duration) * 100;
    }
};

window.onAudioEnded = function (audioId) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const btn = document.querySelector(`button[onclick*="'${audioId}'"]`);
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
    const seekEl = document.getElementById(`seek_${audioId}`);
    if (seekEl) seekEl.value = 0;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `00:00 / ${formatAudioTime(audio.duration)}`;
    }
    if (activeAudioAnimators[audioId]) {
        cancelAnimationFrame(activeAudioAnimators[audioId]);
        delete activeAudioAnimators[audioId];
    }
    window.drawAudioWave(audioId, false);
};

window.drawAudioWave = function (audioId, isWavy) {
    const canvas = document.getElementById(`canvas_${audioId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const audio = document.getElementById(audioId);
    const progress = (audio && audio.duration) ? (audio.currentTime / audio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        // BATANG LURUS (TIDAK ADA SUARA / JEDA DIAM / SEDANG DIHENTIKAN)
        if (progressX > 0) {
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(progressX, centerY);
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#009846';
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(4, Math.min(width - 4, progressX)), centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    } else {
        // GELOMBANG BERGERAK (HANYA KETIKA ADA SUARA NYATA YANG KELUAR)
        audioWavePhases[audioId] = (audioWavePhases[audioId] || 0) + 0.22;
        const phase = audioWavePhases[audioId];

        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 7.5;
            const y = centerY + Math.sin(x * 0.12 + phase) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#009846';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 5;
            const y = centerY + Math.sin(x * 0.12 + phase) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        const curEnvelope = Math.sin((progressX / width) * Math.PI) * 7.5;
        const curY = centerY + Math.sin(progressX * 0.12 + phase) * curEnvelope;
        ctx.beginPath();
        ctx.arc(Math.max(4, Math.min(width - 4, progressX)), curY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }
};

window.playAudioModern = function (audioId, btn) {
    const audio = document.getElementById(audioId);
    if (!audio) return;

    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => {
            if (a.id !== audioId && !a.paused) {
                a.pause();
                const otherBtn = document.querySelector(`button[onclick*="'${a.id}'"]`);
                if (otherBtn) otherBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (activeAudioAnimators[a.id]) {
                    cancelAnimationFrame(activeAudioAnimators[a.id]);
                    delete activeAudioAnimators[a.id];
                }
                window.drawAudioWave(a.id, false);
            }
        });

        // Putar audio secara langsung tanpa dibajak MediaElementSource (menghindari bisu akibat CORS)
        audio.muted = false;
        audio.volume = 1.0;
        audio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            const loop = () => {
                if (!audio.paused && !audio.ended) {
                    const hasSound = checkAudioHasSoundAtCurrentTime(audioId);
                    window.drawAudioWave(audioId, hasSound);
                    activeAudioAnimators[audioId] = requestAnimationFrame(loop);
                } else {
                    window.drawAudioWave(audioId, false);
                }
            };
            activeAudioAnimators[audioId] = requestAnimationFrame(loop);
        }).catch((err) => {
            console.error('[Audio Playback Error]', err);
        });
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fas fa-play"></i>';
        if (activeAudioAnimators[audioId]) {
            cancelAnimationFrame(activeAudioAnimators[audioId]);
            delete activeAudioAnimators[audioId];
        }
        window.drawAudioWave(audioId, false);
    }
};

window.seekAudioModern = function (audioId, value) {
    const audio = document.getElementById(audioId);
    if (!audio || !audio.duration) return;
    audio.currentTime = (parseFloat(value) / 100) * audio.duration;
    const timeEl = document.getElementById(`time_${audioId}`);
    if (timeEl) {
        timeEl.innerText = `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }
    const hasSound = (!audio.paused) && checkAudioHasSoundAtCurrentTime(audioId);
    window.drawAudioWave(audioId, hasSound);
};

window.changeAudioSpeed = function (audioId, btn) {
    const audio = document.getElementById(audioId);
    if (!audio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = audio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    audio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.handleAduanFileSelected = function (input) {
    const file = input.files[0];
    if (!file) return;
    window.editedAduanMediaBlob = file;
    window.editedAduanMediaExt = file.name.split('.').pop().toLowerCase();

    if (file.type.startsWith('image/')) window.editedAduanMediaType = 'image';
    else if (file.type.startsWith('video/')) window.editedAduanMediaType = 'video';
    else if (file.type.startsWith('audio/')) window.editedAduanMediaType = 'audio';
    else window.editedAduanMediaType = 'document';

    const previewContainer = document.getElementById('previewMediaContainerAduan');
    const previewArea = document.getElementById('preSendPreviewAduan');
    if (previewArea && previewContainer) {
        if (window.editedAduanMediaType === 'image') {
            previewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-height:60px; border-radius:8px;"> <small style="font-weight:700;">${file.name}</small>`;
        } else if (window.editedAduanMediaType === 'video') {
            previewContainer.innerHTML = `<i class="fas fa-film fa-2x" style="color:#0284c7;"></i> <small style="font-weight:700;">${file.name}</small>`;
        } else {
            let icon = 'fa-file-alt text-info';
            if (['ppt', 'pptx'].includes(window.editedAduanMediaExt)) icon = 'fa-file-powerpoint text-danger';
            else if (['xls', 'xlsx', 'csv'].includes(window.editedAduanMediaExt)) icon = 'fa-file-excel text-success';
            previewContainer.innerHTML = `<i class="fas ${icon} fa-2x"></i> <small style="font-weight:700;">${file.name}</small>`;
        }
        previewArea.style.display = 'flex';
    }
};

window.batalLampiranAduan = function () {
    window.editedAduanMediaBlob = null;
    window.editedAduanMediaExt = '';
    window.editedAduanMediaType = '';
    const fileInput = document.getElementById('aduanChatFile');
    if (fileInput) fileInput.value = '';
    const previewArea = document.getElementById('preSendPreviewAduan');
    if (previewArea) previewArea.style.display = 'none';
};

// =========================================================================


// 11. VOICE RECORDER WARGA DENGAN LIVE VISUALIZER & PRATINJAU (DASBOR UTAMA)
// =========================================================================
function drawLiveRecordWaveWarga() {
    const canvas = document.getElementById('wargaRecordWaveCanvas');
    if (!canvas || !recordAnalyserWarga) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    const bufferLength = recordAnalyserWarga.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserWarga.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += Math.abs(val);
    }
    const avgVolume = sum / bufferLength;

    ctx.clearRect(0, 0, width, height);

    if (avgVolume < 0.015) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#86efac';
        ctx.lineCap = 'round';
        ctx.stroke();
    } else {
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    recordAnimFrameWarga = requestAnimationFrame(drawLiveRecordWaveWarga);
}

window.toggleVoiceRecordWarga = async function () {
    const ui = document.getElementById('wargaRecordingUI');
    const btnRecord = document.getElementById('btnRecordWarga');

    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksWarga = [];
        mediaRecorderWarga = new MediaRecorder(stream);

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxWarga = new AudioCtx();
            recordAnalyserWarga = recordAudioCtxWarga.createAnalyser();
            recordAnalyserWarga.fftSize = 256;
            const src = recordAudioCtxWarga.createMediaStreamSource(stream);
            src.connect(recordAnalyserWarga);
        } catch (e) {}

        mediaRecorderWarga.ondataavailable = e => {
            if (e.data.size > 0) audioChunksWarga.push(e.data);
        };

        mediaRecorderWarga.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            if (recordAnimFrameWarga) cancelAnimationFrame(recordAnimFrameWarga);
            if (recordAudioCtxWarga && recordAudioCtxWarga.state !== 'closed') {
                recordAudioCtxWarga.close().catch(() => {});
            }
            if (audioChunksWarga.length > 0) {
                tempPreviewWargaBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
                window.renderPreviewVoiceWarga(tempPreviewWargaBlob);
            }
        };

        mediaRecorderWarga.start();
        voiceSecondsWarga = 0;
        if (ui) {
            ui.style.display = 'flex';
            ui.innerHTML = `
                <span id="wargaRecordTime" style="font-weight:800; font-family:monospace; color:#009846; font-size:0.85rem;">00:00</span>
                <canvas id="wargaRecordWaveCanvas" width="160" height="24" style="flex:1; height:24px; display:block;"></canvas>
                <button type="button" onclick="window.cancelVoiceRecordWarga()" style="background:none; border:none; color:#dc2626; cursor:pointer;" title="Batalkan"><i class="fas fa-trash-alt"></i></button>
                <button type="button" onclick="window.stopAndPreviewVoiceWarga()" style="background:#009846; color:white; border:none; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Selesai & Pratinjau"><i class="fas fa-check" style="font-size:0.75rem;"></i></button>
            `;
        }
        if (btnRecord) btnRecord.style.color = '#009846';

        drawLiveRecordWaveWarga();

        voiceTimerIntervalWarga = setInterval(() => {
            voiceSecondsWarga++;
            const m = String(Math.floor(voiceSecondsWarga / 60)).padStart(2, '0');
            const s = String(voiceSecondsWarga % 60).padStart(2, '0');
            const timeEl = document.getElementById('wargaRecordTime');
            if (timeEl) timeEl.innerText = `${m}:${s}`;
        }, 1000);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.stopAndPreviewVoiceWarga = function () {
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    if (mediaRecorderWarga && mediaRecorderWarga.state !== 'inactive') {
        mediaRecorderWarga.stop();
    }
    const btnRecord = document.getElementById('btnRecordWarga');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.renderPreviewVoiceWarga = function (blob) {
    const ui = document.getElementById('wargaRecordingUI');
    if (!ui) return;
    const previewUrl = URL.createObjectURL(blob);
    tempPreviewWargaAudio = new Audio(previewUrl);

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewWargaPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate
            };
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewWargaPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    ui.style.display = 'flex';
    ui.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%; background:#ffffff; border:1.5px solid #009846; border-radius:24px; padding:6px 14px; box-shadow:0 4px 12px rgba(0,152,70,0.15);">
            <button type="button" onclick="window.togglePlayPreviewWarga(this)" style="background:#009846; color:white; border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                <i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>
            </button>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:800; color:#0f172a;">
                    <span style="color:#009846;"><i class="fas fa-headphones"></i> Pratinjau Suara</span>
                    <span id="wargaPreviewTimer">00:00 / ${formatAudioTime(voiceSecondsWarga)}</span>
                </div>
                <div style="position:relative; width:100%; height:18px; display:flex; align-items:center;">
                    <canvas id="wargaPreviewCanvas" width="160" height="18" style="width:100%; height:18px; display:block;"></canvas>
                    <input type="range" id="wargaPreviewSeek" min="0" max="100" value="0" step="0.1" oninput="window.seekPreviewWarga(this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; z-index:5;">
                </div>
            </div>
            <button type="button" class="audio-speed-btn" onclick="window.changePreviewAudioSpeedWarga(this)" title="Atur Kecepatan Suara">1x</button>
            <button type="button" onclick="window.cancelVoiceRecordWarga()" style="background:#fee2e2; color:#dc2626; border:none; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="Hapus / Rekam Ulang">
                <i class="fas fa-trash-alt" style="font-size:0.8rem;"></i>
            </button>
        </div>
    `;

    tempPreviewWargaAudio.onloadedmetadata = () => {
        const t = document.getElementById('wargaPreviewTimer');
        if (t) t.innerText = `00:00 / ${formatAudioTime(tempPreviewWargaAudio.duration)}`;
        window.drawPreviewWaveWarga(false);
    };

    tempPreviewWargaAudio.ontimeupdate = () => {
        const t = document.getElementById('wargaPreviewTimer');
        const s = document.getElementById('wargaPreviewSeek');
        if (t) t.innerText = `${formatAudioTime(tempPreviewWargaAudio.currentTime)} / ${formatAudioTime(tempPreviewWargaAudio.duration || voiceSecondsWarga)}`;
        if (s && tempPreviewWargaAudio.duration) {
            s.value = (tempPreviewWargaAudio.currentTime / tempPreviewWargaAudio.duration) * 100;
        }
    };

    tempPreviewWargaAudio.onended = () => {
        const btn = ui.querySelector('button[onclick*="togglePlayPreviewWarga"]');
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        const s = document.getElementById('wargaPreviewSeek');
        if (s) s.value = 0;
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        window.drawPreviewWaveWarga(false);
    };

    window.drawPreviewWaveWarga(false);
};

function checkPreviewWargaHasSound() {
    if (!tempPreviewWargaAudio || tempPreviewWargaAudio.paused) return false;
    if (!tempPreviewWargaPCM) return true;
    const curTime = tempPreviewWargaAudio.currentTime;
    const idx = Math.floor(curTime * tempPreviewWargaPCM.sampleRate);
    const win = Math.floor(tempPreviewWargaPCM.sampleRate * 0.05);
    let sum = 0;
    const start = Math.max(0, idx - win);
    const end = Math.min(tempPreviewWargaPCM.data.length, idx + win);
    for (let i = start; i < end; i += 4) {
        sum += Math.abs(tempPreviewWargaPCM.data[i]);
    }
    const avg = sum / ((end - start) / 4 || 1);
    return avg > 0.015;
}

window.drawPreviewWaveWarga = function (isWavy) {
    const canvas = document.getElementById('wargaPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const progress = (tempPreviewWargaAudio && tempPreviewWargaAudio.duration) ? (tempPreviewWargaAudio.currentTime / tempPreviewWargaAudio.duration) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

    if (!isWavy) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(progressX, centerY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(progressX, centerY);
        ctx.lineTo(width, centerY);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    } else {
        ctx.beginPath();
        for (let x = 0; x <= progressX; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 6;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#009846';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        for (let x = progressX; x <= width; x++) {
            const envelope = Math.sin((x / width) * Math.PI) * 4;
            const y = centerY + Math.sin(x * 0.18 + Date.now() * 0.015) * envelope;
            if (x === progressX) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(Math.max(3, Math.min(width - 3, progressX)), centerY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#009846';
        ctx.fill();
    }
};

window.togglePlayPreviewWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    if (tempPreviewWargaAudio.paused) {
        tempPreviewWargaAudio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause" style="font-size:0.85rem;"></i>';
            const loop = () => {
                if (tempPreviewWargaAudio && !tempPreviewWargaAudio.paused && !tempPreviewWargaAudio.ended) {
                    const hasSound = checkPreviewWargaHasSound();
                    window.drawPreviewWaveWarga(hasSound);
                    tempPreviewWargaAnim = requestAnimationFrame(loop);
                } else {
                    window.drawPreviewWaveWarga(false);
                }
            };
            tempPreviewWargaAnim = requestAnimationFrame(loop);
        }).catch(() => {});
    } else {
        tempPreviewWargaAudio.pause();
        btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.85rem;"></i>';
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        window.drawPreviewWaveWarga(false);
    }
};

window.seekPreviewWarga = function (val) {
    if (!tempPreviewWargaAudio || !tempPreviewWargaAudio.duration) return;
    tempPreviewWargaAudio.currentTime = (parseFloat(val) / 100) * tempPreviewWargaAudio.duration;
    window.drawPreviewWaveWarga(!tempPreviewWargaAudio.paused && checkPreviewWargaHasSound());
};

window.changePreviewAudioSpeedWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = tempPreviewWargaAudio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    tempPreviewWargaAudio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

window.sendConfirmedVoiceWarga = function () {
    if (!tempPreviewWargaBlob) return;
    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);

    window.editedMediaBlob = tempPreviewWargaBlob;
    window.editedMediaExt = 'webm';
    window.editedMediaType = 'audio';

    const ui = document.getElementById('wargaRecordingUI');
    if (ui) ui.style.display = 'none';

    tempPreviewWargaBlob = null;
    window.sendWargaChat();
};

// =========================================================================
