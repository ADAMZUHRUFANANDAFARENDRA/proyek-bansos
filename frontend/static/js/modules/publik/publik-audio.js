/**
 * Modul: publik-audio.js
 * Deskripsi: Perekam suara, analisis frekuensi visualizer gelombang suara, dan pemutar audio interaktif
 */

function formatAudioTime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
        return '00:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
window.formatAudioTime = formatAudioTime;
window.formatTimeDuration = formatAudioTime;

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
    const audio = document.getElementById(audioId);
    const progress = (audio && audio.duration && isFinite(audio.duration)) ? Math.max(0, Math.min(1, audio.currentTime / audio.duration)) : 0;
    const isOutgoing = canvas.closest('.outgoing') !== null;
    const pcm = audioWaveformDataMap[audioId];

    ctx.clearRect(0, 0, width, height);

    const barCount = 34;
    const barWidth = 3;
    const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

    for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + barGap);
        let barHeight = 5;

        if (pcm && pcm.data && pcm.data.length > 0) {
            const sampleIdx = Math.floor((i / barCount) * pcm.data.length);
            const step = Math.max(1, Math.floor(pcm.data.length / (barCount * 8)));
            let sum = 0;
            let count = 0;
            for (let k = sampleIdx; k < Math.min(pcm.data.length, sampleIdx + step); k += 2) {
                sum += Math.abs(pcm.data[k]);
                count++;
            }
            const amp = count > 0 ? (sum / count) : 0;
            barHeight = Math.max(3.5, Math.min(height - 2, Math.pow(amp, 0.7) * (height * 3.4)));
        } else {
            const norm = i / barCount;
            const pattern = Math.sin(norm * Math.PI) * 0.7 + Math.sin(norm * Math.PI * 4) * 0.3;
            barHeight = Math.max(4, Math.min(height - 4, (0.35 + 0.65 * Math.abs(pattern)) * (height - 4)));
        }

        const y = (height - barHeight) / 2;
        const barProgress = (i + 0.5) / barCount;
        const isPlayed = barProgress <= progress;

        ctx.fillStyle = isPlayed ? (isOutgoing ? '#ffffff' : '#009846') : (isOutgoing ? 'rgba(255,255,255,0.45)' : '#cbd5e1');
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        if (isWavy && Math.abs(barProgress - progress) < (1 / barCount)) {
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = isOutgoing ? '#ffffff' : '#007a37';
            ctx.fill();
        }
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

let isWargaVoicePaused = false;
let exactVoiceSecondsWarga = 0;
let wargaVoiceRecordStartTime = 0;
let wargaVoicePausedTotalMs = 0;
let wargaVoicePauseStart = 0;
let wargaWhileRecordingAudio = null;
window.wargaVoicePreviewFiles = [];
window.wargaVoiceExtraFile = null;
window.wargaVoiceExtraLocation = null;

// Menggambar gelombang frekuensi batang (Bar Frequency) secara live saat merekam suara warga
function drawLiveRecordWaveWarga() {
    const canvas = document.getElementById('wargaRecordWaveCanvas');
    if (!canvas || !recordAnalyserWarga) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const bufferLength = recordAnalyserWarga.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserWarga.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const barCount = 20;
    const barWidth = 3;
    const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

    for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + barGap);
        const val = isWargaVoicePaused ? 0 : (dataArray[i % bufferLength] || 0);
        const pct = val / 255;
        const barHeight = Math.max(3, pct * (height - 4));
        const y = (height - barHeight) / 2;

        ctx.fillStyle = val > 40 ? '#009846' : '#86efac';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
    }

    recordAnimFrameWarga = requestAnimationFrame(drawLiveRecordWaveWarga);
}

// =========================================================================
// FITUR PEMERIKSAAN SUARA WARGA SAAT JEDA (PAUSED AUDIO REVIEW, SEEK & SPEED)
// =========================================================================
window.wargaVoicePauseSpeed = 1.0;

window.changeWargaVoicePauseSpeed = function () {
    const speeds = [0.5, 1.0, 1.5, 2.0];
    let cur = window.wargaVoicePauseSpeed || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    window.wargaVoicePauseSpeed = speeds[nextIdx];
    if (wargaWhileRecordingAudio) {
        wargaWhileRecordingAudio.playbackRate = window.wargaVoicePauseSpeed;
    }
    const btn = document.getElementById('btnWargaVoicePauseSpeed');
    if (btn) btn.innerText = `${window.wargaVoicePauseSpeed}x`;
};

window.seekWargaVoicePause = function (val) {
    if (!wargaWhileRecordingAudio) return;
    const total = wargaWhileRecordingAudio.duration || exactVoiceSecondsWarga || voiceSecondsWarga || 1;
    const target = (parseFloat(val) / 100) * total;
    try {
        wargaWhileRecordingAudio.currentTime = target;
    } catch (e) {}
    const curMins = String(Math.floor(target / 60)).padStart(2, '0');
    const curSecs = String(Math.floor(target % 60)).padStart(2, '0');
    const totMins = String(Math.floor(total / 60)).padStart(2, '0');
    const totSecs = String(Math.floor(total % 60)).padStart(2, '0');
    const timeEl = document.getElementById('wargaVoicePauseTimer');
    if (timeEl) timeEl.innerText = `${curMins}:${curSecs} / ${totMins}:${totSecs}`;
};

// Tombol Putar Ulang Rekaman Sementara Saat Sedang Merekam Suara Warga
window.togglePlayWhileRecordingWarga = function () {
    if (!mediaRecorderWarga) return;
    const btn = document.getElementById('btnPlayWhileRecordingWarga');
    const timeEl = document.getElementById('wargaVoicePauseTimer');
    const seekEl = document.getElementById('wargaVoicePauseSeek');

    if (mediaRecorderWarga.state === 'recording') {
        window.togglePauseVoiceWarga();
        return;
    }

    if (wargaWhileRecordingAudio && !wargaWhileRecordingAudio.paused) {
        wargaWhileRecordingAudio.pause();
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
        return;
    }

    if (wargaWhileRecordingAudio) {
        wargaWhileRecordingAudio.playbackRate = window.wargaVoicePauseSpeed || 1.0;
        wargaWhileRecordingAudio.play().catch(() => {});
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        return;
    }

    try {
        if (mediaRecorderWarga.state !== 'inactive') {
            mediaRecorderWarga.requestData();
        }
    } catch (e) {}

    setTimeout(() => {
        if (!audioChunksWarga || audioChunksWarga.length === 0) return;
        const currentBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
        wargaWhileRecordingAudio = new Audio(URL.createObjectURL(currentBlob));
        wargaWhileRecordingAudio.playbackRate = window.wargaVoicePauseSpeed || 1.0;

        const total = exactVoiceSecondsWarga || voiceSecondsWarga || 1;
        const totMins = String(Math.floor(total / 60)).padStart(2, '0');
        const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

        wargaWhileRecordingAudio.ontimeupdate = () => {
            if (!wargaWhileRecordingAudio) return;
            const cur = wargaWhileRecordingAudio.currentTime || 0;
            const curTot = wargaWhileRecordingAudio.duration || total;
            const pct = curTot > 0 ? (cur / curTot) * 100 : 0;
            if (seekEl) seekEl.value = pct;
            const cm = String(Math.floor(cur / 60)).padStart(2, '0');
            const cs = String(Math.floor(cur % 60)).padStart(2, '0');
            if (timeEl) timeEl.innerText = `${cm}:${cs} / ${totMins}:${totSecs}`;
        };

        wargaWhileRecordingAudio.onended = () => {
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
            if (seekEl) seekEl.value = 0;
            if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
        };

        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        wargaWhileRecordingAudio.play().catch(() => {
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
        });
    }, 80);
};

window.togglePauseVoiceWarga = function () {
    if (!mediaRecorderWarga) return;
    const pauseBtn = document.getElementById('btnPauseResumeWarga');
    const statusEl = document.getElementById('wargaRecordStatus');
    const pulseDot = document.getElementById('wargaVoicePulseDot');
    const activeRow = document.getElementById('wargaVoiceActiveRow');
    const pausedReviewRow = document.getElementById('wargaVoicePausedReviewRow');
    const timeEl = document.getElementById('wargaVoicePauseTimer');
    const seekEl = document.getElementById('wargaVoicePauseSeek');
    const playBtn = document.getElementById('btnPlayWhileRecordingWarga');

    if (mediaRecorderWarga.state === 'recording') {
        try {
            mediaRecorderWarga.requestData();
            mediaRecorderWarga.pause();
        } catch (e) {}

        isWargaVoicePaused = true;
        wargaVoicePauseStart = Date.now();
        clearInterval(voiceTimerIntervalWarga);

        const elapsedMs = (Date.now() - wargaVoiceRecordStartTime) - wargaVoicePausedTotalMs;
        exactVoiceSecondsWarga = Math.max(1, Math.floor(elapsedMs / 1000));
        const total = exactVoiceSecondsWarga;
        const totMins = String(Math.floor(total / 60)).padStart(2, '0');
        const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

        if (activeRow) activeRow.style.display = 'none';
        if (pausedReviewRow) pausedReviewRow.style.display = 'flex';
        if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
        if (seekEl) seekEl.value = 0;
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';

        setTimeout(() => {
            if (audioChunksWarga && audioChunksWarga.length > 0) {
                const currentBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
                if (wargaWhileRecordingAudio) {
                    wargaWhileRecordingAudio.pause();
                    wargaWhileRecordingAudio = null;
                }
                wargaWhileRecordingAudio = new Audio(URL.createObjectURL(currentBlob));
                wargaWhileRecordingAudio.playbackRate = window.wargaVoicePauseSpeed || 1.0;

                wargaWhileRecordingAudio.ontimeupdate = () => {
                    if (!wargaWhileRecordingAudio) return;
                    const cur = wargaWhileRecordingAudio.currentTime || 0;
                    const curTot = wargaWhileRecordingAudio.duration || total;
                    const pct = curTot > 0 ? (cur / curTot) * 100 : 0;
                    if (seekEl) seekEl.value = pct;
                    const cm = String(Math.floor(cur / 60)).padStart(2, '0');
                    const cs = String(Math.floor(cur % 60)).padStart(2, '0');
                    if (timeEl) timeEl.innerText = `${cm}:${cs} / ${totMins}:${totSecs}`;
                };

                wargaWhileRecordingAudio.onended = () => {
                    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
                    if (seekEl) seekEl.value = 0;
                    if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
                };
            }
        }, 60);

        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            pauseBtn.title = 'Lanjutkan Rekaman';
        }
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-pause-circle"></i> Dijeda';
        if (pulseDot) pulseDot.classList.add('paused');
    } else if (mediaRecorderWarga.state === 'paused') {
        if (wargaWhileRecordingAudio) {
            wargaWhileRecordingAudio.pause();
            wargaWhileRecordingAudio = null;
        }

        try { mediaRecorderWarga.resume(); } catch (e) {}
        isWargaVoicePaused = false;
        if (wargaVoicePauseStart > 0) {
            wargaVoicePausedTotalMs += (Date.now() - wargaVoicePauseStart);
            wargaVoicePauseStart = 0;
        }

        if (pausedReviewRow) pausedReviewRow.style.display = 'none';
        if (activeRow) activeRow.style.display = 'flex';

        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            pauseBtn.title = 'Jeda Rekaman';
        }
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-wave-square"></i> Merekam...';
        if (pulseDot) pulseDot.classList.remove('paused');

        clearInterval(voiceTimerIntervalWarga);
        voiceTimerIntervalWarga = setInterval(() => {
            if (!isWargaVoicePaused) {
                const elapsedMs = (Date.now() - wargaVoiceRecordStartTime) - wargaVoicePausedTotalMs;
                voiceSecondsWarga = Math.floor(elapsedMs / 1000);
                const m = String(Math.floor(voiceSecondsWarga / 60)).padStart(2, '0');
                const s = String(voiceSecondsWarga % 60).padStart(2, '0');
                const timeEl = document.getElementById('wargaRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 500);
    }
};

window.toggleVoiceRecordWarga = async function () {
    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');

    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksWarga = [];
        mediaRecorderWarga = new MediaRecorder(stream);
        isWargaVoicePaused = false;
        wargaVoiceRecordStartTime = Date.now();
        wargaVoicePausedTotalMs = 0;
        wargaVoicePauseStart = 0;
        exactVoiceSecondsWarga = 0;
        if (wargaWhileRecordingAudio) {
            wargaWhileRecordingAudio.pause();
            wargaWhileRecordingAudio = null;
        }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxWarga = new AudioCtx();
            recordAnalyserWarga = recordAudioCtxWarga.createAnalyser();
            recordAnalyserWarga.fftSize = 64;
            const src = recordAudioCtxWarga.createMediaStreamSource(stream);
            src.connect(recordAnalyserWarga);
        } catch (e) {}

        mediaRecorderWarga.ondataavailable = e => {
            if (e.data && e.data.size > 0) audioChunksWarga.push(e.data);
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

        mediaRecorderWarga.start(250);
        voiceSecondsWarga = 0;

        if (chatInput) chatInput.style.display = 'none';
        if (btnSend) btnSend.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';

        if (ui) {
            ui.style.display = 'flex';
            const pauseBtn = document.getElementById('btnPauseResumeWarga');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Jeda Rekaman';
            }
            const pausePlayBtn = document.getElementById('btnPlayWhileRecordingWarga');
            if (pausePlayBtn) {
                pausePlayBtn.style.display = 'inline-flex';
                pausePlayBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
            }
            const statusEl = document.getElementById('wargaRecordStatus');
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-wave-square"></i> Merekam...';
            const pulseDot = document.getElementById('wargaVoicePulseDot');
            if (pulseDot) pulseDot.classList.remove('paused');
            const timeEl = document.getElementById('wargaRecordTime');
            if (timeEl) timeEl.innerText = '00:00';
        }
        if (btnRecord) btnRecord.style.color = '#009846';

        drawLiveRecordWaveWarga();

        clearInterval(voiceTimerIntervalWarga);
        voiceTimerIntervalWarga = setInterval(() => {
            if (!isWargaVoicePaused) {
                const elapsedMs = (Date.now() - wargaVoiceRecordStartTime) - wargaVoicePausedTotalMs;
                voiceSecondsWarga = Math.floor(elapsedMs / 1000);
                const m = String(Math.floor(voiceSecondsWarga / 60)).padStart(2, '0');
                const s = String(voiceSecondsWarga % 60).padStart(2, '0');
                const timeEl = document.getElementById('wargaRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 500);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.stopAndPreviewVoiceWarga = function () {
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    if (wargaWhileRecordingAudio) {
        wargaWhileRecordingAudio.pause();
        wargaWhileRecordingAudio = null;
    }

    const activeRow = document.getElementById('wargaVoiceActiveRow');
    const pausedReviewRow = document.getElementById('wargaVoicePausedReviewRow');
    if (activeRow) activeRow.style.display = 'flex';
    if (pausedReviewRow) pausedReviewRow.style.display = 'none';

    if (wargaVoicePauseStart > 0) {
        wargaVoicePausedTotalMs += (Date.now() - wargaVoicePauseStart);
        wargaVoicePauseStart = 0;
    }
    const totalElapsedMs = Math.max(500, (Date.now() - wargaVoiceRecordStartTime) - wargaVoicePausedTotalMs);
    exactVoiceSecondsWarga = totalElapsedMs / 1000;

    if (mediaRecorderWarga && mediaRecorderWarga.state !== 'inactive') {
        mediaRecorderWarga.stop();
    }
    const btnRecord = document.getElementById('btnRecordWarga');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.cancelVoiceRecordWarga = function () {
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    if (mediaRecorderWarga && mediaRecorderWarga.state !== 'inactive') {
        try { mediaRecorderWarga.stop(); } catch (e) {}
    }
    if (recordAnimFrameWarga) cancelAnimationFrame(recordAnimFrameWarga);
    if (recordAudioCtxWarga && recordAudioCtxWarga.state !== 'closed') {
        recordAudioCtxWarga.close().catch(() => {});
    }
    if (wargaWhileRecordingAudio) {
        wargaWhileRecordingAudio.pause();
        wargaWhileRecordingAudio = null;
    }
    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
    tempPreviewWargaBlob = null;
    isWargaVoicePaused = false;
    exactVoiceSecondsWarga = 0;
    window.clearWargaVoicePreviewAttachment();

    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');
    const activeRow = document.getElementById('wargaVoiceActiveRow');
    const pausedReviewRow = document.getElementById('wargaVoicePausedReviewRow');
    if (activeRow) activeRow.style.display = 'flex';
    if (pausedReviewRow) pausedReviewRow.style.display = 'none';

    if (ui) ui.style.display = 'none';
    if (previewBar) previewBar.style.display = 'none';
    if (chatInput) chatInput.style.display = 'block';
    if (btnSend) btnSend.style.display = 'flex';
    if (btnRecord) btnRecord.style.color = '#64748b';

    const captionInp = document.getElementById('wargaVoiceCaptionInput');
    if (captionInp) captionInp.value = '';
};

// =========================================================================
// KONTROL PRATINJAU SUARA WARGA DENGAN BATANG FREKUENSI MULUS & AKURAT
// =========================================================================
window.renderPreviewVoiceWarga = function (blob) {
    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');

    if (ui) ui.style.display = 'none';
    if (chatInput) chatInput.style.display = 'none';
    if (btnRecord) btnRecord.style.color = '#64748b';
    if (btnSend) btnSend.style.display = 'none';
    if (previewBar) previewBar.style.display = 'flex';

    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);

    const previewUrl = URL.createObjectURL(blob);
    tempPreviewWargaAudio = new Audio(previewUrl);

    // Tampilkan langsung durasi waktu pasti dari rekaman (Mencegah 00:00 / 00:00)
    const durSec = Math.max(0.8, exactVoiceSecondsWarga || voiceSecondsWarga || 1);
    exactVoiceSecondsWarga = durSec;
    const timerEl = document.getElementById('wargaPreviewTimer');
    if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(durSec)}`;

    const playBtn = document.getElementById('btnPlayWargaVoicePreview');
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.82rem;"></i>';

    const seekInp = document.getElementById('wargaPreviewSeek');
    if (seekInp) seekInp.value = 0;

    const speedBtn = document.getElementById('btnWargaPreviewSpeed');
    if (speedBtn) speedBtn.innerText = '1x';

    // Dekode PCM buffer dengan AudioContext untuk durasi pasti & amplitudo batang frekuensi
    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewWargaPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate,
                duration: buffer.duration
            };
            if (buffer.duration && isFinite(buffer.duration) && buffer.duration > 0) {
                exactVoiceSecondsWarga = buffer.duration;
                if (timerEl) {
                    const cur = tempPreviewWargaAudio ? tempPreviewWargaAudio.currentTime : 0;
                    timerEl.innerText = `${formatAudioTime(cur)} / ${formatAudioTime(buffer.duration)}`;
                }
                window.drawPreviewWaveWarga(false);
            }
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewWargaPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    tempPreviewWargaAudio.onloadedmetadata = () => {
        const total = exactVoiceSecondsWarga || durSec;
        if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(total)}`;
        window.drawPreviewWaveWarga(false);
    };

    tempPreviewWargaAudio.onended = () => {
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.82rem;"></i>';
        if (seekInp) seekInp.value = 0;
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        const total = exactVoiceSecondsWarga || durSec;
        if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(total)}`;
        window.drawPreviewWaveWarga(false);
    };

    window.drawPreviewWaveWarga(false);
    document.getElementById('wargaVoiceCaptionInput')?.focus();
};

// VISUALISASI GELOMBANG FREKUENSI BATANG (BAR FREQUENCY) PREVIEW WARGA ULTRA-MULUS
window.drawPreviewWaveWarga = function (isPlaying) {
    const canvas = document.getElementById('wargaPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const total = exactVoiceSecondsWarga > 0 ? exactVoiceSecondsWarga : 1;
    const curTime = (tempPreviewWargaAudio) ? tempPreviewWargaAudio.currentTime : 0;
    const progress = Math.max(0, Math.min(1, curTime / total));

    // Update timer dan seek input secara mulus
    const timerEl = document.getElementById('wargaPreviewTimer');
    if (timerEl) {
        timerEl.innerText = `${formatAudioTime(curTime)} / ${formatAudioTime(total)}`;
    }
    const seekInp = document.getElementById('wargaPreviewSeek');
    if (seekInp && !document.activeElement?.isSameNode(seekInp)) {
        seekInp.value = progress * 100;
    }

    ctx.clearRect(0, 0, width, height);

    const barCount = 38;
    const barWidth = 3;
    const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

    for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + barGap);
        let barHeight = 5;

        if (tempPreviewWargaPCM && tempPreviewWargaPCM.data && tempPreviewWargaPCM.data.length > 0) {
            const sampleIdx = Math.floor((i / barCount) * tempPreviewWargaPCM.data.length);
            const step = Math.max(1, Math.floor(tempPreviewWargaPCM.data.length / (barCount * 12)));
            let sum = 0;
            let count = 0;
            for (let k = sampleIdx; k < Math.min(tempPreviewWargaPCM.data.length, sampleIdx + step); k += 2) {
                sum += Math.abs(tempPreviewWargaPCM.data[k]);
                count++;
            }
            const amp = count > 0 ? (sum / count) : 0;
            barHeight = Math.max(3.5, Math.min(height - 2, Math.pow(amp, 0.65) * (height * 3.4)));
        } else {
            const norm = i / barCount;
            const pattern = Math.sin(norm * Math.PI) * 0.75 + Math.sin(norm * Math.PI * 3.5) * 0.25;
            barHeight = Math.max(4, Math.min(height - 4, (0.35 + 0.65 * Math.abs(pattern)) * (height - 4)));
        }

        const barProgress = (i + 0.5) / barCount;
        const isPlayed = barProgress <= progress;

        // Dinamika gelombang halus saat dimainkan
        let dynamicH = barHeight;
        if (isPlaying && Math.abs(barProgress - progress) < (2 / barCount)) {
            dynamicH = Math.min(height - 1, barHeight + Math.sin(Date.now() / 90) * 2.5);
        }

        const y = (height - dynamicH) / 2;

        ctx.fillStyle = isPlayed ? '#009846' : '#cbd5e1';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, dynamicH, 2);
        } else {
            ctx.rect(x, y, barWidth, dynamicH);
        }
        ctx.fill();
    }

    // Indikator Titik Pemutar (Playhead Cursor Glow)
    const playheadX = Math.max(2, Math.min(width - 2, progress * width));
    ctx.fillStyle = '#009846';
    ctx.beginPath();
    ctx.arc(playheadX, height / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
};

window.togglePlayPreviewWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    const playBtn = btn || document.getElementById('btnPlayWargaVoicePreview');

    if (tempPreviewWargaAudio.paused) {
        tempPreviewWargaAudio.play().then(() => {
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause" style="font-size:0.82rem;"></i>';
            const loop = () => {
                if (tempPreviewWargaAudio && !tempPreviewWargaAudio.paused && !tempPreviewWargaAudio.ended) {
                    window.drawPreviewWaveWarga(true);
                    tempPreviewWargaAnim = requestAnimationFrame(loop);
                } else {
                    window.drawPreviewWaveWarga(false);
                }
            };
            tempPreviewWargaAnim = requestAnimationFrame(loop);
        }).catch(() => {});
    } else {
        tempPreviewWargaAudio.pause();
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.82rem;"></i>';
        if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
        window.drawPreviewWaveWarga(false);
    }
};

window.seekPreviewWarga = function (val) {
    if (!tempPreviewWargaAudio) return;
    const total = exactVoiceSecondsWarga > 0 ? exactVoiceSecondsWarga : 1;
    const target = (parseFloat(val) / 100) * total;
    try {
        tempPreviewWargaAudio.currentTime = target;
    } catch (e) {}
    window.drawPreviewWaveWarga(!tempPreviewWargaAudio.paused);
};

window.changePreviewAudioSpeedWarga = function (btn) {
    if (!tempPreviewWargaAudio) return;
    const speeds = [0.5, 1.0, 1.5, 2.0];
    let cur = tempPreviewWargaAudio.playbackRate || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    let nextSpeed = speeds[nextIdx];
    tempPreviewWargaAudio.playbackRate = nextSpeed;
    if (btn) btn.innerText = `${nextSpeed}x`;
};

// =========================================================================
// LAMPIRAN MEDIA (FOTO, VIDEO, DOKUMEN, DRIVE, FOTO, LOKASI) HINGGA 100 BERKAS UNTUK WARGA
// =========================================================================
window.toggleWargaVoicePreviewAttachMenu = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('wargaVoicePreviewAttachMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};

window.triggerWargaVoicePreviewAttach = function (type) {
    const menu = document.getElementById('wargaVoicePreviewAttachMenu');
    if (menu) menu.style.display = 'none';

    if (type === 'gallery') {
        document.getElementById('wargaVoicePreviewGalleryInput')?.click();
    } else if (type === 'camera') {
        if (typeof window.openLiveCameraModal === 'function') {
            window.openLiveCameraModal('warga-voice-preview');
        } else {
            document.getElementById('wargaVoicePreviewCameraInput')?.click();
        }
    } else if (type === 'doc') {
        document.getElementById('wargaVoicePreviewDocInput')?.click();
    } else if (type === 'gdrive') {
        if (typeof window.openGoogleDrivePicker === 'function') {
            window.openGoogleDrivePicker('warga-voice-preview');
        }
    } else if (type === 'gphotos') {
        if (typeof window.openGooglePhotosPicker === 'function') {
            window.openGooglePhotosPicker('warga-voice-preview');
        }
    } else if (type === 'location') {
        window.attachLocationToWargaVoicePreview();
    }
};

window.attachLocationToWargaVoicePreview = function () {
    const nik = window.wargaNik || (window.sesiWargaAktif && window.sesiWargaAktif.nik) || '';
    const nama = window.wargaNama || (window.sesiWargaAktif && window.sesiWargaAktif.nama_lengkap) || 'Warga';
    let lat = -7.4478;
    let lng = 112.7183;
    let alamat = (window.sesiWargaAktif && window.sesiWargaAktif.alamat) || 'Kabupaten Sidoarjo';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            applyLocationPayload();
        }, () => {
            applyLocationPayload();
        }, { timeout: 4000 });
    } else {
        applyLocationPayload();
    }

    function applyLocationPayload() {
        window.wargaVoiceExtraLocation = {
            nik,
            nama,
            alamat,
            lat,
            lng,
            maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
            terverifikasi: true,
            pengirim: 'warga'
        };

        window.renderWargaVoicePreviewAttachmentChips();
    }
};

// Tambah Multi-Berkas ke Pratinjau Suara Warga (Hingga 100 Berkas)
window.addWargaVoicePreviewAttachments = function (files) {
    if (!files || files.length === 0) return;
    const MAX_FILES = 100;
    const incoming = Array.isArray(files) ? files : Array.from(files);

    if (window.wargaVoicePreviewFiles.length + incoming.length > MAX_FILES) {
        Swal.fire('Batas Maksimal', `Maksimal lampiran adalah ${MAX_FILES} berkas. Berkas selebihnya diabaikan.`, 'warning');
    }

    const allowed = incoming.slice(0, MAX_FILES - window.wargaVoicePreviewFiles.length);
    for (const item of allowed) {
        const fileObj = item.file || item;
        const name = item.name || fileObj.name || 'Berkas';
        const size = item.size || fileObj.size || 0;
        const type = item.type || (fileObj.type ? (fileObj.type.startsWith('image/') ? 'image' : (fileObj.type.startsWith('video/') ? 'video' : 'document')) : 'document');
        let previewThumb = null;
        if (type === 'image' && fileObj instanceof Blob) {
            previewThumb = URL.createObjectURL(fileObj);
        }

        window.wargaVoicePreviewFiles.push({
            id: `w_voice_att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            file: fileObj,
            name: name,
            size: size,
            type: type,
            previewThumb: previewThumb,
            isGoogleDrive: Boolean(item.isGoogleDrive),
            isCloudLink: Boolean(item.isCloudLink),
            webViewLink: item.webViewLink
        });
    }

    window.renderWargaVoicePreviewAttachmentChips();
};

window.handleWargaVoicePreviewFileSelected = function (input, type) {
    if (!input.files || input.files.length === 0) return;
    window.addWargaVoicePreviewAttachments(input.files);
    input.value = '';
};

window.removeWargaVoicePreviewFile = function (index) {
    if (index >= 0 && index < window.wargaVoicePreviewFiles.length) {
        const removed = window.wargaVoicePreviewFiles.splice(index, 1)[0];
        if (removed && removed.previewThumb) {
            URL.revokeObjectURL(removed.previewThumb);
        }
        window.renderWargaVoicePreviewAttachmentChips();
    }
};

window.clearAllWargaVoicePreviewAttachments = function () {
    (window.wargaVoicePreviewFiles || []).forEach(f => {
        if (f.previewThumb) URL.revokeObjectURL(f.previewThumb);
    });
    window.wargaVoicePreviewFiles = [];
    window.wargaVoiceExtraFile = null;
    window.wargaVoiceExtraLocation = null;
    window.renderWargaVoicePreviewAttachmentChips();

    const galleryInput = document.getElementById('wargaVoicePreviewGalleryInput');
    const cameraInput = document.getElementById('wargaVoicePreviewCameraInput');
    const docInput = document.getElementById('wargaVoicePreviewDocInput');
    if (galleryInput) galleryInput.value = '';
    if (cameraInput) cameraInput.value = '';
    if (docInput) docInput.value = '';
};

window.clearWargaVoicePreviewAttachment = window.clearAllWargaVoicePreviewAttachments;

window.renderWargaVoicePreviewAttachmentChips = function () {
    const listContainer = document.getElementById('wargaVoicePreviewAttachmentList');
    const chipsContainer = document.getElementById('wargaVoicePreviewAttachmentChipsContainer');
    const countLabel = document.getElementById('wargaVoiceAttachmentCountLabel');

    const totalItems = (window.wargaVoicePreviewFiles ? window.wargaVoicePreviewFiles.length : 0) + (window.wargaVoiceExtraLocation ? 1 : 0);

    if (totalItems === 0) {
        if (listContainer) listContainer.style.display = 'none';
        if (chipsContainer) chipsContainer.innerHTML = '';
        return;
    }

    if (listContainer) listContainer.style.display = 'flex';
    if (countLabel) {
        countLabel.innerHTML = `<i class="fas fa-paperclip"></i> Lampiran Berkas (${totalItems})`;
    }

    if (!chipsContainer) return;
    let html = '';

    // Tampilkan Chip Lokasi Geotag jika ada
    if (window.wargaVoiceExtraLocation) {
        const loc = window.wargaVoiceExtraLocation;
        html += `
            <div style="display:flex; align-items:center; gap:8px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:5px 9px; font-size:0.72rem; white-space:nowrap; flex-shrink:0;">
                <i class="fas fa-map-marked-alt text-emerald-600" style="font-size:0.9rem;"></i>
                <span style="font-weight:700; color:#065f46;">Lokasi: ${loc.alamat}</span>
                <button type="button" onclick="window.wargaVoiceExtraLocation=null; window.renderWargaVoicePreviewAttachmentChips();" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.8rem; padding:0 3px;" title="Hapus Lokasi">&times;</button>
            </div>
        `;
    }

    // Tampilkan Semua Berkas Lampiran (Hingga 100)
    window.wargaVoicePreviewFiles.forEach((item, idx) => {
        let icon = '<i class="fas fa-file-alt" style="color:#7c3aed;"></i>';
        if (item.type === 'image') icon = '<i class="fas fa-image" style="color:#0284c7;"></i>';
        else if (item.type === 'video') icon = '<i class="fas fa-video" style="color:#e11d48;"></i>';
        if (item.isGoogleDrive) icon = '<i class="fab fa-google-drive" style="color:#f59e0b;"></i>';

        const sizeStr = item.size ? `${(item.size / (1024 * 1024)).toFixed(1)}MB` : '';
        const thumbHtml = item.previewThumb
            ? `<img src="${item.previewThumb}" style="width:22px; height:22px; border-radius:4px; object-fit:cover;">`
            : icon;

        html += `
            <div style="display:flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:4px 7px; font-size:0.72rem; white-space:nowrap; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                ${thumbHtml}
                <span style="font-weight:700; color:#1e293b; max-width:120px; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</span>
                <span style="color:#94a3b8; font-size:0.65rem;">${sizeStr}</span>
                <button type="button" onclick="window.removeWargaVoicePreviewFile(${idx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.8rem; padding:0 3px;" title="Hapus Berkas">&times;</button>
            </div>
        `;
    });

    chipsContainer.innerHTML = html;
};

// KIRIM PESAN SUARA WARGA RESMI (DENGAN MULTI-BERKAS HINGGA 100, TEKS OPSIONAL)
window.sendConfirmedVoiceWarga = async function () {
    if (window.isSendingVoiceWarga || window.isSendingWargaChat) return;
    if (!tempPreviewWargaBlob) return;

    const currentNik = window.wargaNik || (window.sesiWargaAktif && window.sesiWargaAktif.nik);
    const currentNama = window.wargaNama || (window.sesiWargaAktif && window.sesiWargaAktif.nama_lengkap) || 'Warga';
    if (!currentNik) return;

    window.isSendingVoiceWarga = true;
    const sendBtn = document.getElementById('btnSendConfirmedVoiceWarga');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';
    }

    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);

    const voiceBlobToSend = tempPreviewWargaBlob;
    tempPreviewWargaBlob = null;

    const filesToSend = [...(window.wargaVoicePreviewFiles || [])];
    const extraLocationToSend = window.wargaVoiceExtraLocation;

    // Ambil teks keterangan pesan suara jika diketik warga (opsional, JIKA KOSONG JANGAN DIISI EMOJI MIC!)
    const captionInp = document.getElementById('wargaVoiceCaptionInput');
    const captionText = captionInp ? captionInp.value.trim() : '';
    if (captionInp) captionInp.value = '';

    window.clearAllWargaVoicePreviewAttachments();

    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');

    if (ui) ui.style.display = 'none';
    if (previewBar) previewBar.style.display = 'none';
    if (chatInput) chatInput.style.display = 'block';
    if (btnSend) btnSend.style.display = 'flex';
    if (btnRecord) btnRecord.style.color = '#64748b';

    const nowDevice = new Date();
    const deviceTime = nowDevice.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', currentNama);
    formData.append('pesan', captionText);
    formData.append('custom_file_type', 'audio');
    formData.append('file_voice', voiceBlobToSend, `voice_warga_${Date.now()}.webm`);
    formData.append('waktu', deviceTime);
    formData.append('created_at', nowDevice.toISOString());

    // Lampirkan semua berkas lampiran (hingga 100 berkas)
    filesToSend.forEach((item, idx) => {
        if (item.file && item.file instanceof Blob) {
            formData.append(`file_extra_${idx}`, item.file, item.name || item.file.name);
        } else if (item.isCloudLink) {
            formData.append(`cloud_link_${idx}`, item.webViewLink || '');
        }
    });

    if (window.replyToDataWarga) {
        formData.append('reply_to_id', window.replyToDataWarga.id);
        formData.append('reply_to_text', window.replyToDataWarga.text);
        formData.append('reply_to_sender', window.replyToDataWarga.sender);
        if (typeof window.batalReplyWarga === 'function') window.batalReplyWarga();
    }

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
            method: 'POST',
            body: formData
        });

        // Jika ada lokasi geotagging yang dilampirkan warga, kirimkan juga
        if (extraLocationToSend) {
            try {
                await fetch(`${API_URL}/api/chat/share-geotag`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(extraLocationToSend)
                });
            } catch (e) {}
        }

        if (typeof window.loadChatMessagesWarga === 'function') {
            window.loadChatMessagesWarga(false);
        }
    } catch (e) {
        console.error('[Send Voice Note Error]', e);
    } finally {
        window.isSendingVoiceWarga = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }
    }
};

// =========================================================================
