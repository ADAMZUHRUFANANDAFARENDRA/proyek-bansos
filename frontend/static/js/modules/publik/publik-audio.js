window.audioWaveformDataMap = window.audioWaveformDataMap || {};
var audioWaveformDataMap = window.audioWaveformDataMap;
window.activeAudioAnimators = window.activeAudioAnimators || {};
var activeAudioAnimators = window.activeAudioAnimators;
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

// VOICE RECORDER & PRATINJAU DENGAN DYNAMIC LIVE AUDIO VISUALIZER (PENGADUAN & WARGA HARMONIS)
// =========================================================================
window.mediaRecorderAduan = window.mediaRecorderAduan || null;
var mediaRecorderAduan = window.mediaRecorderAduan;
window.audioChunksAduan = window.audioChunksAduan || [];
var audioChunksAduan = window.audioChunksAduan;
window.voiceTimerIntervalAduan = window.voiceTimerIntervalAduan || null;
var voiceTimerIntervalAduan = window.voiceTimerIntervalAduan;
window.voiceSecondsAduan = window.voiceSecondsAduan || 0;
var voiceSecondsAduan = window.voiceSecondsAduan;
window.isVoicePausedAduan = window.isVoicePausedAduan || false;
var isVoicePausedAduan = window.isVoicePausedAduan;
window.aduanVoiceRecordStartTime = window.aduanVoiceRecordStartTime || 0;
var aduanVoiceRecordStartTime = window.aduanVoiceRecordStartTime;
window.aduanVoicePausedTotalMs = window.aduanVoicePausedTotalMs || 0;
var aduanVoicePausedTotalMs = window.aduanVoicePausedTotalMs;
window.aduanVoicePauseStart = window.aduanVoicePauseStart || 0;
var aduanVoicePauseStart = window.aduanVoicePauseStart;
window.exactVoiceSecondsAduan = window.exactVoiceSecondsAduan || 0;
var exactVoiceSecondsAduan = window.exactVoiceSecondsAduan;
window.recordAudioCtxAduan = window.recordAudioCtxAduan || null;
var recordAudioCtxAduan = window.recordAudioCtxAduan;
window.recordAnalyserAduan = window.recordAnalyserAduan || null;
var recordAnalyserAduan = window.recordAnalyserAduan;
window.recordSourceAduan = window.recordSourceAduan || null;
var recordSourceAduan = window.recordSourceAduan;
window.recordAnimFrameAduan = window.recordAnimFrameAduan || null;
var recordAnimFrameAduan = window.recordAnimFrameAduan;
window.tempPreviewAduanBlob = window.tempPreviewAduanBlob || null;
var tempPreviewAduanBlob = window.tempPreviewAduanBlob;
window.tempPreviewAduanAudio = window.tempPreviewAduanAudio || null;
var tempPreviewAduanAudio = window.tempPreviewAduanAudio;
window.tempPreviewAduanPCM = window.tempPreviewAduanPCM || null;
var tempPreviewAduanPCM = window.tempPreviewAduanPCM;
window.tempPreviewAduanAnim = window.tempPreviewAduanAnim || null;
var tempPreviewAduanAnim = window.tempPreviewAduanAnim;
window.aduanWhileRecordingAudio = window.aduanWhileRecordingAudio || null;
var aduanWhileRecordingAudio = window.aduanWhileRecordingAudio;
window.aduanVoicePreviewFiles = window.aduanVoicePreviewFiles || [];

// State Audio Recorder Portal Warga (Dashboard Pribadi)
window.mediaRecorderWarga = window.mediaRecorderWarga || null;
var mediaRecorderWarga = window.mediaRecorderWarga;
window.audioChunksWarga = window.audioChunksWarga || [];
var audioChunksWarga = window.audioChunksWarga;
window.voiceTimerIntervalWarga = window.voiceTimerIntervalWarga || null;
var voiceTimerIntervalWarga = window.voiceTimerIntervalWarga;
window.voiceSecondsWarga = window.voiceSecondsWarga || 0;
var voiceSecondsWarga = window.voiceSecondsWarga;
window.isWargaVoicePaused = window.isWargaVoicePaused || false;
var isWargaVoicePaused = window.isWargaVoicePaused;
window.wargaVoiceRecordStartTime = window.wargaVoiceRecordStartTime || 0;
var wargaVoiceRecordStartTime = window.wargaVoiceRecordStartTime;
window.wargaVoicePausedTotalMs = window.wargaVoicePausedTotalMs || 0;
var wargaVoicePausedTotalMs = window.wargaVoicePausedTotalMs;
window.wargaVoicePauseStart = window.wargaVoicePauseStart || 0;
var wargaVoicePauseStart = window.wargaVoicePauseStart;
window.exactVoiceSecondsWarga = window.exactVoiceSecondsWarga || 0;
var exactVoiceSecondsWarga = window.exactVoiceSecondsWarga;
window.recordAudioCtxWarga = window.recordAudioCtxWarga || null;
var recordAudioCtxWarga = window.recordAudioCtxWarga;
window.recordAnalyserWarga = window.recordAnalyserWarga || null;
var recordAnalyserWarga = window.recordAnalyserWarga;
window.recordAnimFrameWarga = window.recordAnimFrameWarga || null;
var recordAnimFrameWarga = window.recordAnimFrameWarga;
window.tempPreviewWargaBlob = window.tempPreviewWargaBlob || null;
var tempPreviewWargaBlob = window.tempPreviewWargaBlob;
window.tempPreviewWargaAudio = window.tempPreviewWargaAudio || null;
var tempPreviewWargaAudio = window.tempPreviewWargaAudio;
window.tempPreviewWargaPCM = window.tempPreviewWargaPCM || null;
var tempPreviewWargaPCM = window.tempPreviewWargaPCM;
window.tempPreviewWargaAnim = window.tempPreviewWargaAnim || null;
var tempPreviewWargaAnim = window.tempPreviewWargaAnim;
window.wargaWhileRecordingAudio = window.wargaWhileRecordingAudio || null;
var wargaWhileRecordingAudio = window.wargaWhileRecordingAudio;
window.wargaVoicePreviewFiles = window.wargaVoicePreviewFiles || [];

// Visualizer gelombang suara live (Emerald selaras dengan portal)
function drawLiveRecordWaveAduan() {
    const canvas = document.getElementById('aduanRecordWaveCanvas');
    if (!canvas || !recordAnalyserAduan) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const bufferLength = recordAnalyserAduan.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    recordAnalyserAduan.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const hasSignal = !isVoicePausedAduan && sum > 20;

    const barCount = 20;
    const barWidth = 3;
    const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

    for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + barGap);
        let barHeight = 3.5;

        if (hasSignal) {
            const binIdx = Math.floor((i / barCount) * (bufferLength * 0.75));
            const val = dataArray[binIdx] / 255.0;
            barHeight = Math.max(3.5, val * (height - 4));
        }

        const y = (height - barHeight) / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        else ctx.rect(x, y, barWidth, barHeight);
        ctx.fillStyle = hasSignal ? '#009846' : '#86efac';
        ctx.fill();
    }

    recordAnimFrameAduan = requestAnimationFrame(drawLiveRecordWaveAduan);
}

window.setAduanInputBarMode = function (mode) {
    const ui = document.getElementById('aduanRecordingUI');
    const previewBar = document.getElementById('aduanVoicePreviewBar');
    const chatInput = document.getElementById('aduanChatInput');
    const btnRecord = document.getElementById('btnRecordAduan');
    const btnSend = document.getElementById('btnSendAduan');
    const btnEmoji = document.getElementById('btnEmojiAduan') || document.querySelector('.emoji-toggle-btn');
    const btnAttach = document.getElementById('btnAttachAduan');
    const btnShareLoc = document.getElementById('btnShareLocAduan');
    const attachPop = document.getElementById('aduanAttachmentMenuPopover');
    const emojiPop = document.getElementById('emojiPickerAduan');

    if (attachPop) attachPop.style.display = 'none';
    if (emojiPop) emojiPop.style.display = 'none';

    if (mode === 'recording') {
        if (ui) ui.style.display = 'flex';
        if (previewBar) previewBar.style.display = 'none';
        if (chatInput) chatInput.style.display = 'none';
        if (btnRecord) btnRecord.style.display = 'none';
        if (btnSend) btnSend.style.display = 'none';
        if (btnEmoji) btnEmoji.style.display = 'none';
        if (btnAttach) btnAttach.style.display = 'none';
        if (btnShareLoc) btnShareLoc.style.display = 'none';
    } else if (mode === 'preview') {
        if (ui) ui.style.display = 'none';
        if (previewBar) previewBar.style.display = 'flex';
        if (chatInput) chatInput.style.display = 'none';
        if (btnRecord) btnRecord.style.display = 'none';
        if (btnSend) btnSend.style.display = 'none';
        if (btnEmoji) btnEmoji.style.display = 'none';
        if (btnAttach) btnAttach.style.display = 'none';
        if (btnShareLoc) btnShareLoc.style.display = 'none';
    } else {
        // 'normal'
        if (ui) ui.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (chatInput) chatInput.style.display = 'block';
        if (btnRecord) {
            btnRecord.style.display = 'inline-flex';
            btnRecord.style.color = '#64748b';
        }
        if (btnSend) btnSend.style.display = 'flex';
        if (btnEmoji) btnEmoji.style.display = 'inline-flex';
        if (btnAttach) btnAttach.style.display = 'inline-flex';
        if (btnShareLoc) btnShareLoc.style.display = 'none';
    }
};

window.toggleVoiceRecordAduan = async function () {
    const ui = document.getElementById('aduanRecordingUI');
    const previewBar = document.getElementById('aduanVoicePreviewBar');
    const chatInput = document.getElementById('aduanChatInput');
    const btnRecord = document.getElementById('btnRecordAduan');
    const btnSend = document.getElementById('btnSendAduan');

    if (mediaRecorderAduan && mediaRecorderAduan.state === 'recording') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksAduan = [];
        mediaRecorderAduan = new MediaRecorder(stream);
        isVoicePausedAduan = false;
        aduanVoiceRecordStartTime = Date.now();
        aduanVoicePausedTotalMs = 0;
        aduanVoicePauseStart = 0;
        exactVoiceSecondsAduan = 0;
        if (aduanWhileRecordingAudio) {
            aduanWhileRecordingAudio.pause();
            aduanWhileRecordingAudio = null;
        }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            recordAudioCtxAduan = new AudioCtx();
            recordAnalyserAduan = recordAudioCtxAduan.createAnalyser();
            recordAnalyserAduan.fftSize = 64;
            const src = recordAudioCtxAduan.createMediaStreamSource(stream);
            src.connect(recordAnalyserAduan);
        } catch (e) {}

        mediaRecorderAduan.ondataavailable = e => {
            if (e.data && e.data.size > 0) audioChunksAduan.push(e.data);
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

        mediaRecorderAduan.start(250);
        voiceSecondsAduan = 0;

        window.setAduanInputBarMode('recording');

        if (ui) {
            ui.style.display = 'flex';
            const activeRow = document.getElementById('aduanVoiceActiveRow');
            const pausedRow = document.getElementById('aduanVoicePausedReviewRow');
            if (activeRow) activeRow.style.display = 'flex';
            if (pausedRow) pausedRow.style.display = 'none';

            const pauseBtn = document.getElementById('btnPauseResumeAduan');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Jeda Rekaman';
            }
            const statusEl = document.getElementById('aduanRecordStatus');
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-wave-square"></i> Merekam...';
            const timeEl = document.getElementById('aduanRecordTime');
            if (timeEl) timeEl.innerText = '00:00';
        }
        if (btnRecord) btnRecord.style.color = '#009846';

        drawLiveRecordWaveAduan();

        clearInterval(voiceTimerIntervalAduan);
        voiceTimerIntervalAduan = setInterval(() => {
            if (!isVoicePausedAduan) {
                const elapsedMs = (Date.now() - aduanVoiceRecordStartTime) - aduanVoicePausedTotalMs;
                voiceSecondsAduan = Math.floor(elapsedMs / 1000);
                const m = String(Math.floor(voiceSecondsAduan / 60)).padStart(2, '0');
                const s = String(voiceSecondsAduan % 60).padStart(2, '0');
                const timeEl = document.getElementById('aduanRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 500);
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Akses Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.togglePauseVoiceAduan = function () {
    if (!mediaRecorderAduan) return;
    const activeRow = document.getElementById('aduanVoiceActiveRow');
    const pausedRow = document.getElementById('aduanVoicePausedReviewRow');
    const timeEl = document.getElementById('aduanVoicePauseTimer');
    const seekEl = document.getElementById('aduanVoicePauseSeek');

    if (mediaRecorderAduan.state === 'recording') {
        try {
            mediaRecorderAduan.requestData();
            mediaRecorderAduan.pause();
        } catch (e) {}

        isVoicePausedAduan = true;
        aduanVoicePauseStart = Date.now();
        clearInterval(voiceTimerIntervalAduan);

        const elapsedMs = (Date.now() - aduanVoiceRecordStartTime) - aduanVoicePausedTotalMs;
        exactVoiceSecondsAduan = Math.max(1, Math.floor(elapsedMs / 1000));
        const total = exactVoiceSecondsAduan;
        const totMins = String(Math.floor(total / 60)).padStart(2, '0');
        const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

        if (activeRow) activeRow.style.display = 'none';
        if (pausedRow) pausedRow.style.display = 'flex';
        if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
        if (seekEl) seekEl.value = 0;
    } else if (mediaRecorderAduan.state === 'paused') {
        if (aduanWhileRecordingAudio) {
            aduanWhileRecordingAudio.pause();
            aduanWhileRecordingAudio = null;
        }
        if (aduanVoicePauseStart > 0) {
            aduanVoicePausedTotalMs += (Date.now() - aduanVoicePauseStart);
            aduanVoicePauseStart = 0;
        }

        try { mediaRecorderAduan.resume(); } catch (e) {}
        isVoicePausedAduan = false;

        if (activeRow) activeRow.style.display = 'flex';
        if (pausedRow) pausedRow.style.display = 'none';

        clearInterval(voiceTimerIntervalAduan);
        voiceTimerIntervalAduan = setInterval(() => {
            if (!isVoicePausedAduan) {
                const elapsedMs = (Date.now() - aduanVoiceRecordStartTime) - aduanVoicePausedTotalMs;
                voiceSecondsAduan = Math.floor(elapsedMs / 1000);
                const m = String(Math.floor(voiceSecondsAduan / 60)).padStart(2, '0');
                const s = String(voiceSecondsAduan % 60).padStart(2, '0');
                const timeEl = document.getElementById('aduanRecordTime');
                if (timeEl) timeEl.innerText = `${m}:${s}`;
            }
        }, 500);
    }
};

window.togglePlayWhileRecordingAduan = function () {
    if (!mediaRecorderAduan) return;
    const btn = document.getElementById('btnPlayWhileRecordingAduan');
    const timeEl = document.getElementById('aduanVoicePauseTimer');
    const seekEl = document.getElementById('aduanVoicePauseSeek');

    if (mediaRecorderAduan.state === 'recording') {
        window.togglePauseVoiceAduan();
        return;
    }

    if (aduanWhileRecordingAudio && !aduanWhileRecordingAudio.paused) {
        aduanWhileRecordingAudio.pause();
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
        return;
    }

    if (aduanWhileRecordingAudio) {
        aduanWhileRecordingAudio.playbackRate = window.aduanVoicePauseSpeed || 1.0;
        aduanWhileRecordingAudio.play().catch(() => {});
        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        return;
    }

    try {
        if (mediaRecorderAduan.state !== 'inactive') {
            mediaRecorderAduan.requestData();
        }
    } catch (e) {}

    setTimeout(() => {
        if (!audioChunksAduan || audioChunksAduan.length === 0) return;
        const currentBlob = new Blob(audioChunksAduan, { type: 'audio/webm' });
        aduanWhileRecordingAudio = new Audio(URL.createObjectURL(currentBlob));
        aduanWhileRecordingAudio.playbackRate = window.aduanVoicePauseSpeed || 1.0;

        const total = exactVoiceSecondsAduan || voiceSecondsAduan || 1;
        const totMins = String(Math.floor(total / 60)).padStart(2, '0');
        const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

        aduanWhileRecordingAudio.ontimeupdate = () => {
            if (!aduanWhileRecordingAudio) return;
            const cur = aduanWhileRecordingAudio.currentTime || 0;
            const curTot = aduanWhileRecordingAudio.duration || total;
            const pct = curTot > 0 ? (cur / curTot) * 100 : 0;
            if (seekEl) seekEl.value = pct;
            const cm = String(Math.floor(cur / 60)).padStart(2, '0');
            const cs = String(Math.floor(cur % 60)).padStart(2, '0');
            if (timeEl) timeEl.innerText = `${cm}:${cs} / ${totMins}:${totSecs}`;
        };

        aduanWhileRecordingAudio.onended = () => {
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
            if (seekEl) seekEl.value = 0;
            if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
        };

        if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        aduanWhileRecordingAudio.play().catch(() => {
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
        });
    }, 80);
};

window.seekAduanVoicePause = function (val) {
    if (!aduanWhileRecordingAudio) return;
    const total = exactVoiceSecondsAduan || voiceSecondsAduan || 1;
    const dur = aduanWhileRecordingAudio.duration || total;
    aduanWhileRecordingAudio.currentTime = (parseFloat(val) / 100) * dur;
};

window.changeAduanVoicePauseSpeed = function () {
    const btn = document.getElementById('btnAduanVoicePauseSpeed');
    const speeds = [1.0, 1.5, 2.0, 0.5];
    let cur = window.aduanVoicePauseSpeed || 1.0;
    let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
    window.aduanVoicePauseSpeed = speeds[nextIdx];
    if (btn) btn.innerText = `${window.aduanVoicePauseSpeed}x`;
    if (aduanWhileRecordingAudio) aduanWhileRecordingAudio.playbackRate = window.aduanVoicePauseSpeed;
};

window.stopAndPreviewVoiceAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (aduanWhileRecordingAudio) {
        aduanWhileRecordingAudio.pause();
        aduanWhileRecordingAudio = null;
    }

    const activeRow = document.getElementById('aduanVoiceActiveRow');
    const pausedRow = document.getElementById('aduanVoicePausedReviewRow');
    if (activeRow) activeRow.style.display = 'flex';
    if (pausedRow) pausedRow.style.display = 'none';

    if (aduanVoicePauseStart > 0) {
        aduanVoicePausedTotalMs += (Date.now() - aduanVoicePauseStart);
        aduanVoicePauseStart = 0;
    }
    const totalElapsedMs = Math.max(500, (Date.now() - aduanVoiceRecordStartTime) - aduanVoicePausedTotalMs);
    exactVoiceSecondsAduan = totalElapsedMs / 1000;

    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        mediaRecorderAduan.stop();
    }
    const btnRecord = document.getElementById('btnRecordAduan');
    if (btnRecord) btnRecord.style.color = '#64748b';
};

window.renderPreviewVoiceAduan = function (blob) {
    if (typeof window.setAduanInputBarMode === 'function') {
        window.setAduanInputBarMode('preview');
    } else {
        const ui = document.getElementById('aduanRecordingUI');
        const previewBar = document.getElementById('aduanVoicePreviewBar');
        const chatInput = document.getElementById('aduanChatInput');
        const btnRecord = document.getElementById('btnRecordAduan');
        const btnSend = document.getElementById('btnSendAduan');

        if (ui) ui.style.display = 'none';
        if (chatInput) chatInput.style.display = 'none';
        if (btnRecord) btnRecord.style.color = '#64748b';
        if (btnSend) btnSend.style.display = 'none';
        if (previewBar) previewBar.style.display = 'flex';
    }

    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);

    const previewUrl = URL.createObjectURL(blob);
    tempPreviewAduanAudio = new Audio(previewUrl);

    const durSec = Math.max(0.8, exactVoiceSecondsAduan || voiceSecondsAduan || 1);
    exactVoiceSecondsAduan = durSec;
    const timerEl = document.getElementById('aduanPreviewTimer');
    if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(durSec)}`;

    const playBtn = document.getElementById('btnPlayAduanVoicePreview');
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.82rem;"></i>';

    const seekInp = document.getElementById('aduanPreviewSeek');
    if (seekInp) seekInp.value = 0;

    const speedBtn = document.getElementById('btnAduanPreviewSpeed');
    if (speedBtn) speedBtn.innerText = '1x';

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const tempCtx = new AudioCtx();
            const buffer = await tempCtx.decodeAudioData(reader.result);
            tempPreviewAduanPCM = {
                data: buffer.getChannelData(0),
                sampleRate: buffer.sampleRate,
                duration: buffer.duration
            };
            if (buffer.duration && isFinite(buffer.duration) && buffer.duration > 0) {
                exactVoiceSecondsAduan = buffer.duration;
                if (timerEl) {
                    const cur = tempPreviewAduanAudio ? tempPreviewAduanAudio.currentTime : 0;
                    timerEl.innerText = `${formatAudioTime(cur)} / ${formatAudioTime(buffer.duration)}`;
                }
                window.drawPreviewWaveAduan(false);
            }
            tempCtx.close().catch(() => {});
        } catch (e) {
            tempPreviewAduanPCM = null;
        }
    };
    reader.readAsArrayBuffer(blob);

    tempPreviewAduanAudio.onloadedmetadata = () => {
        const total = exactVoiceSecondsAduan || durSec;
        if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(total)}`;
        window.drawPreviewWaveAduan(false);
    };

    tempPreviewAduanAudio.onended = () => {
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.82rem;"></i>';
        if (seekInp) seekInp.value = 0;
        if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
        const total = exactVoiceSecondsAduan || durSec;
        if (timerEl) timerEl.innerText = `00:00 / ${formatAudioTime(total)}`;
        window.drawPreviewWaveAduan(false);
    };

    tempPreviewAduanAudio.ontimeupdate = () => {
        const total = exactVoiceSecondsAduan || (tempPreviewAduanAudio && tempPreviewAduanAudio.duration) || durSec;
        if (timerEl) {
            const cur = tempPreviewAduanAudio ? tempPreviewAduanAudio.currentTime : 0;
            timerEl.innerText = `${formatAudioTime(cur)} / ${formatAudioTime(total)}`;
        }
        if (seekInp && total > 0) {
            seekInp.value = (tempPreviewAduanAudio.currentTime / total) * 100;
        }
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
    const total = exactVoiceSecondsAduan || (tempPreviewAduanAudio && tempPreviewAduanAudio.duration) || 1;
    const progress = (tempPreviewAduanAudio && total > 0) ? (tempPreviewAduanAudio.currentTime / total) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

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
    const total = exactVoiceSecondsAduan || tempPreviewAduanAudio.duration || 1;
    tempPreviewAduanAudio.currentTime = (parseFloat(val) / 100) * total;
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

// Popover lampiran saat pratinjau rekaman suara aduan
window.toggleAduanVoicePreviewAttachMenu = function (e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const menu = document.getElementById('aduanVoicePreviewAttachMenu');
    const btn = document.getElementById('btnAduanVoicePreviewAttach');
    const emojiEl = document.getElementById('emojiPickerAduan');
    if (emojiEl) emojiEl.style.display = 'none';
    if (!menu) return;

    const isVisible = (menu.style.display === 'block' || menu.style.display === 'flex');
    if (isVisible) {
        menu.style.display = 'none';
        return;
    }

    menu.style.display = 'block';

    // Perhitungan posisi presisi: Selalu berada di dalam layout chat card dan terpusat di atas tombol pin
    if (btn) {
        const chatWrap = document.getElementById('aduanChatCardWrap') || 
                         document.getElementById('aduanChatSection') || 
                         document.getElementById('dashboardAduanWargaSection') ||
                         menu.offsetParent;
        const btnRect = btn.getBoundingClientRect();
        const parentRect = menu.offsetParent ? menu.offsetParent.getBoundingClientRect() : btnRect;
        const chatRect = chatWrap ? chatWrap.getBoundingClientRect() : parentRect;

        const menuWidth = 250;
        // Titik tengah horizontal relatif terhadap parent offset
        let leftInParent = (btnRect.left - parentRect.left) + (btnRect.width / 2) - (menuWidth / 2);

        // Jaga jarak aman minimal 8px dari batas kiri dan kanan chat card
        const minLeft = (chatRect.left - parentRect.left) + 8;
        const maxLeft = (chatRect.right - parentRect.left) - menuWidth - 8;

        leftInParent = Math.max(minLeft, Math.min(leftInParent, maxLeft));

        menu.style.setProperty('left', `${Math.round(leftInParent)}px`, 'important');
        menu.style.setProperty('right', 'auto', 'important');
        menu.style.setProperty('bottom', '48px', 'important');
        menu.style.setProperty('width', `${menuWidth}px`, 'important');
    }

    const closeOnClickOutside = function (ev) {
        if (!menu.contains(ev.target) && !ev.target.closest('#btnAduanVoicePreviewAttach')) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeOnClickOutside);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
    }, 50);
};

window.triggerAduanVoicePreviewAttach = function (type) {
    const menu = document.getElementById('aduanVoicePreviewAttachMenu');
    if (menu) menu.style.display = 'none';

    if (type === 'gallery') {
        const inp = document.getElementById('aduanVoicePreviewGalleryInput');
        if (inp) inp.click();
    } else if (type === 'camera') {
        if (typeof window.openLiveCameraModal === 'function') {
            window.openLiveCameraModal('aduan-voice-preview');
        } else {
            const inp = document.getElementById('aduanVoicePreviewCameraInput');
            if (inp) inp.click();
        }
    } else if (type === 'doc') {
        const inp = document.getElementById('aduanVoicePreviewDocInput');
        if (inp) inp.click();
    } else if (type === 'gdrive') {
        if (typeof window.openGoogleDrivePicker === 'function') {
            window.openGoogleDrivePicker('aduan-voice-preview');
        }
    } else if (type === 'gphotos') {
        if (typeof window.openGooglePhotosPicker === 'function') {
            window.openGooglePhotosPicker('aduan-voice-preview');
        }
    } else if (type === 'location') {
        window.kirimLokasiGeotagWarga();
    }
};

window.handleAduanVoicePreviewFileSelected = function (input, category) {
    if (!input || !input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    window.addAduanVoicePreviewAttachments(files);
    input.value = '';
};

window.addAduanVoicePreviewAttachments = function (files) {
    if (!files || files.length === 0) return;
    const arr = Array.isArray(files) ? files : Array.from(files);
    arr.forEach(f => {
        if (f instanceof Blob) {
            window.aduanVoicePreviewFiles.push(f);
        }
    });
    window.renderAduanVoicePreviewAttachmentChips();
};

window.renderAduanVoicePreviewAttachmentChips = function () {
    const wrap = document.getElementById('aduanVoicePreviewAttachmentList');
    const container = document.getElementById('aduanVoicePreviewAttachmentChipsContainer');
    const countLabel = document.getElementById('aduanVoiceAttachmentCountLabel');
    if (!wrap || !container) return;

    if (window.aduanVoicePreviewFiles.length === 0) {
        wrap.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    wrap.style.display = 'flex';
    if (countLabel) {
        countLabel.innerHTML = `<i class="fas fa-paperclip"></i> ${window.aduanVoicePreviewFiles.length} Berkas Terlampir`;
    }

    container.innerHTML = window.aduanVoicePreviewFiles.map((f, idx) => {
        const name = f.name || `Berkas_${idx + 1}`;
        const ext = name.split('.').pop().toLowerCase();
        let icon = 'fa-file-alt';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) icon = 'fa-image text-emerald-600';
        else if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) icon = 'fa-video text-blue-600';
        else if (['pdf'].includes(ext)) icon = 'fa-file-pdf text-red-600';
        else if (['doc', 'docx'].includes(ext)) icon = 'fa-file-word text-blue-500';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) icon = 'fa-file-excel text-green-600';

        return `
            <div style="display:inline-flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #cbd5e1; border-radius:14px; padding:3px 10px; font-size:0.75rem; color:#334155; white-space:nowrap; flex-shrink:0;">
                <i class="fas ${icon}"></i>
                <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="${name}">${name}</span>
                <button type="button" onclick="window.removeAduanVoicePreviewAttachment(${idx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.75rem; margin-left:2px;">&times;</button>
            </div>
        `;
    }).join('');
};

window.removeAduanVoicePreviewAttachment = function (idx) {
    if (idx >= 0 && idx < window.aduanVoicePreviewFiles.length) {
        window.aduanVoicePreviewFiles.splice(idx, 1);
        window.renderAduanVoicePreviewAttachmentChips();
    }
};

window.clearAllAduanVoicePreviewAttachments = function () {
    window.aduanVoicePreviewFiles = [];
    window.renderAduanVoicePreviewAttachmentChips();
};

// Kirim Suara Aduan beserta Keterangan Teks, Emoji & Berkas Tambahan
window.sendConfirmedVoiceAduan = async function () {
    if (!tempPreviewAduanBlob) return;
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);

    const activeNik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) || localStorage.getItem('lastAduanNik');
    const activeNama = (window.sesiAduanAktif && window.sesiAduanAktif.nama) || 'Warga';

    if (!activeNik) return;

    const captionInp = document.getElementById('aduanVoiceCaptionInput');
    const chatInp = document.getElementById('aduanChatInput');
    const captionText = (captionInp?.value || chatInp?.value || '').trim();

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', activeNama);
    formData.append('pesan', captionText);
    formData.append('file_type', 'audio');
    formData.append('files', tempPreviewAduanBlob, `voice_aduan_${Date.now()}.webm`);

    if (window.aduanVoicePreviewFiles && window.aduanVoicePreviewFiles.length > 0) {
        window.aduanVoicePreviewFiles.forEach((f, idx) => {
            formData.append('files', f, f.name || `berkas_aduan_${idx + 1}`);
        });
    }

    if (captionInp) captionInp.value = '';
    if (chatInp) chatInp.value = '';

    window.cancelVoiceRecordAduan();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`, {
            method: 'POST',
            body: formData
        });
        if (typeof window.muatPesanAduan === 'function') {
            window.muatPesanAduan(true);
        }
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Gagal Kirim Suara', text: 'Gagal mengunggah rekaman suara ke peladen.' });
    }
};

window.cancelVoiceRecordAduan = function () {
    if (voiceTimerIntervalAduan) clearInterval(voiceTimerIntervalAduan);
    if (recordAnimFrameAduan) cancelAnimationFrame(recordAnimFrameAduan);
    if (tempPreviewAduanAnim) cancelAnimationFrame(tempPreviewAduanAnim);
    if (tempPreviewAduanAudio) {
        tempPreviewAduanAudio.pause();
        tempPreviewAduanAudio = null;
    }
    if (aduanWhileRecordingAudio) {
        aduanWhileRecordingAudio.pause();
        aduanWhileRecordingAudio = null;
    }
    if (recordAudioCtxAduan && recordAudioCtxAduan.state !== 'closed') {
        recordAudioCtxAduan.close().catch(() => {});
    }
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        try { mediaRecorderAduan.stop(); } catch (e) {}
    }
    audioChunksAduan = [];
    tempPreviewAduanBlob = null;
    tempPreviewAduanPCM = null;
    isVoicePausedAduan = false;
    exactVoiceSecondsAduan = 0;
    window.clearAllAduanVoicePreviewAttachments();

    if (typeof window.setAduanInputBarMode === 'function') {
        window.setAduanInputBarMode('normal');
    } else {
        const ui = document.getElementById('aduanRecordingUI');
        const previewBar = document.getElementById('aduanVoicePreviewBar');
        const chatInput = document.getElementById('aduanChatInput');
        const btnRecord = document.getElementById('btnRecordAduan');
        const btnSend = document.getElementById('btnSendAduan');

        if (ui) ui.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (chatInput) chatInput.style.display = 'block';
        if (btnSend) btnSend.style.display = 'flex';
        if (btnRecord) btnRecord.style.color = '#64748b';
    }

    const captionInp = document.getElementById('aduanVoiceCaptionInput');
    if (captionInp) captionInp.value = '';
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

window.aduanChatPendingFiles = window.aduanChatPendingFiles || [];

window.addAduanChatAttachments = function (files) {
    if (!files || files.length === 0) return;
    const MAX_FILES = 50;
    const incoming = Array.isArray(files) ? files : Array.from(files);

    if (window.aduanChatPendingFiles.length + incoming.length > MAX_FILES) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Batas Maksimal Berkas',
                text: 'Maksimal lampiran adalah ' + MAX_FILES + ' berkas sekaligus. Berkas selebihnya diabaikan.',
                confirmButtonColor: '#009846'
            });
        }
    }

    const allowed = incoming.slice(0, Math.max(0, MAX_FILES - window.aduanChatPendingFiles.length));
    for (const item of allowed) {
        const fileObj = item.file || item;
        const name = item.name || fileObj.name || 'Berkas';
        const size = item.size || fileObj.size || 0;
        let type = item.type;
        if (!type && fileObj.type) {
            if (fileObj.type.startsWith('image/')) type = 'image';
            else if (fileObj.type.startsWith('video/')) type = 'video';
            else if (fileObj.type.startsWith('audio/')) type = 'audio';
            else type = 'document';
        }
        if (!type || type === 'document') {
            const ext = name.split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) type = 'image';
            else if (['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext)) type = 'video';
            else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba', 'flac'].includes(ext)) type = 'audio';
            else type = 'document';
        }
        let previewThumb = null;
        if (type === 'image' && fileObj instanceof Blob) {
            try { previewThumb = URL.createObjectURL(fileObj); } catch(e) {}
        }

        window.aduanChatPendingFiles.push({
            id: 'aduan_att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
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

    if (window.aduanChatPendingFiles.length > 0 && window.aduanChatPendingFiles[0].file instanceof Blob) {
        window.editedAduanMediaBlob = window.aduanChatPendingFiles[0].file;
        window.editedAduanMediaType = window.aduanChatPendingFiles[0].type;
        window.editedAduanMediaExt = window.aduanChatPendingFiles[0].name.split('.').pop().toLowerCase();
    }

    window.renderAduanChatAttachmentChips();
    const chatInp = document.getElementById('aduanChatInput');
    if (chatInp) chatInp.focus();
};

window.removeAduanChatAttachment = function (idx) {
    if (idx >= 0 && idx < window.aduanChatPendingFiles.length) {
        const removed = window.aduanChatPendingFiles.splice(idx, 1)[0];
        if (removed && removed.previewThumb) {
            try { URL.revokeObjectURL(removed.previewThumb); } catch(e) {}
        }
        if (window.aduanChatPendingFiles.length === 0) {
            window.editedAduanMediaBlob = null;
            window.editedAduanMediaType = '';
            window.editedAduanMediaExt = '';
        } else if (window.aduanChatPendingFiles[0].file instanceof Blob) {
            window.editedAduanMediaBlob = window.aduanChatPendingFiles[0].file;
            window.editedAduanMediaType = window.aduanChatPendingFiles[0].type;
            window.editedAduanMediaExt = window.aduanChatPendingFiles[0].name.split('.').pop().toLowerCase();
        }
        window.renderAduanChatAttachmentChips();
    }
};

window.renderAduanChatAttachmentChips = function () {
    const previewArea = document.getElementById('preSendPreviewAduan');
    const container = document.getElementById('previewMediaContainerAduan');
    if (!previewArea || !container) return;

    if (!window.aduanChatPendingFiles || window.aduanChatPendingFiles.length === 0) {
        previewArea.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    previewArea.style.display = 'flex';
    previewArea.style.flexDirection = 'column';
    previewArea.style.gap = '6px';
    previewArea.style.padding = '8px 14px';

    const count = window.aduanChatPendingFiles.length;
    let html = '<div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-size:0.75rem; font-weight:800; color:#0369a1;">' +
        '<span><i class="fas fa-paperclip text-primary"></i> Lampiran Berkas (' + count + '/50 Berkas Terpilih)</span>' +
        '<button type="button" onclick="window.batalLampiranAduan()" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.72rem; font-weight:700;"><i class="fas fa-trash-alt"></i> Hapus Semua</button>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:8px; overflow-x:auto; max-width:100%; padding-bottom:4px; scrollbar-width:thin;">';

    window.aduanChatPendingFiles.forEach((item, idx) => {
        const ext = (item.name || '').split('.').pop().toLowerCase();
        let icon = '<i class="fas fa-file-alt" style="color:#7c3aed;"></i>';
        if (['ppt', 'pptx'].includes(ext)) icon = '<i class="fas fa-file-powerpoint" style="color:#dc2626;"></i>';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) icon = '<i class="fas fa-file-excel" style="color:#16a34a;"></i>';
        else if (['doc', 'docx'].includes(ext)) icon = '<i class="fas fa-file-word" style="color:#2563eb;"></i>';
        else if (['pdf'].includes(ext)) icon = '<i class="fas fa-file-pdf" style="color:#dc2626;"></i>';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) icon = '<i class="fas fa-file-archive" style="color:#7c3aed;"></i>';
        else if (item.type === 'image') icon = '<i class="fas fa-image" style="color:#0284c7;"></i>';
        else if (item.type === 'video') icon = '<i class="fas fa-video" style="color:#e11d48;"></i>';
        else if (item.type === 'audio') icon = '<i class="fas fa-headphones" style="color:#f59e0b;"></i>';
        if (item.isGoogleDrive) icon = '<i class="fab fa-google-drive" style="color:#f59e0b;"></i>';

        const sizeStr = item.size ? (item.size > 1048576 ? (item.size / 1048576).toFixed(1) + 'MB' : Math.round(item.size / 1024) + 'KB') : '';
        const thumbHtml = item.previewThumb
            ? '<img src="' + item.previewThumb + '" style="width:24px; height:24px; border-radius:4px; object-fit:cover;">'
            : icon;

        const safeTitle = (item.name || 'Berkas').replace(/"/g, '&quot;');
        html += '<div style="display:flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #bae6fd; border-radius:10px; padding:4px 8px; font-size:0.74rem; white-space:nowrap; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            thumbHtml +
            '<span style="font-weight:700; color:#0369a1; max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="' + safeTitle + '">' + safeTitle + '</span>' +
            (sizeStr ? '<span style="color:#64748b; font-size:0.65rem;">' + sizeStr + '</span>' : '') +
            '<button type="button" onclick="window.removeAduanChatAttachment(' + idx + ')" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.85rem; padding:0 3px; line-height:1;" title="Hapus Berkas">&times;</button>' +
            '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
};

window.handleAduanFileSelected = function (input) {
    if (!input || !input.files || input.files.length === 0) return;
    window.addAduanChatAttachments(input.files);
    input.value = '';
};

window.batalLampiranAduan = function () {
    if (window.aduanChatPendingFiles) {
        window.aduanChatPendingFiles.forEach(f => {
            if (f.previewThumb) {
                try { URL.revokeObjectURL(f.previewThumb); } catch(e) {}
            }
        });
    }
    window.aduanChatPendingFiles = [];
    window.editedAduanMediaBlob = null;
    window.editedAduanMediaExt = '';
    window.editedAduanMediaType = '';
    ['aduanChatFile', 'aduanChatDocFile', 'aduanChatAudioFile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const previewArea = document.getElementById('preSendPreviewAduan');
    const container = document.getElementById('previewMediaContainerAduan');
    if (previewArea) previewArea.style.display = 'none';
    if (container) container.innerHTML = '';
};

// =========================================================================


// 11. VOICE RECORDER WARGA DENGAN LIVE VISUALIZER & PRATINJAU (DASBOR UTAMA)
// =========================================================================

isWargaVoicePaused = window.isWargaVoicePaused || false;
exactVoiceSecondsWarga = window.exactVoiceSecondsWarga || 0;
wargaVoiceRecordStartTime = window.wargaVoiceRecordStartTime || 0;
wargaVoicePausedTotalMs = window.wargaVoicePausedTotalMs || 0;
wargaVoicePauseStart = window.wargaVoicePauseStart || 0;
wargaWhileRecordingAudio = window.wargaWhileRecordingAudio || null;
window.wargaVoicePreviewFiles = window.wargaVoicePreviewFiles || [];
window.wargaVoiceExtraFile = window.wargaVoiceExtraFile || null;
window.wargaVoiceExtraLocation = window.wargaVoiceExtraLocation || null;

// Menggambar gelombang frekuensi batang (Bar Frequency) secara live saat merekam suara warga:
// - Jika hening / tidak terdeteksi suara / jeda: grafiknya lurus atau datar (3.5px)
// - Jika terdeteksi suara: bergerak dinamis sesuai frekuensi (nada tinggi = grafik tinggi, nada rendah = grafik rendah)
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

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const hasSignal = !isWargaVoicePaused && sum > 20;

    const barCount = 20;
    const barWidth = 3;
    const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

    for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + barGap);
        let barHeight = 3.5; // Datar saat hening / jeda / tidak ada suara

        if (hasSignal) {
            // Pemetaan frekuensi: kiri = nada rendah, kanan = nada tinggi
            const binIdx = Math.floor((i / barCount) * (bufferLength * 0.75));
            const val = dataArray[binIdx] || 0;
            if (val > 15) {
                const pitchWeight = 0.45 + 0.55 * (i / barCount);
                const pct = (val / 255) * pitchWeight;
                barHeight = Math.max(4, Math.min(height - 2, pct * (height * 1.5)));
            }
        }

        const y = (height - barHeight) / 2;

        ctx.fillStyle = hasSignal && barHeight > 4 ? '#009846' : '#86efac';
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

window.setWargaInputBarMode = function (mode) {
    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');
    const btnEmoji = document.getElementById('btnEmojiWarga') || document.querySelector('#wargaChatCardContainer .emoji-toggle-btn');
    const btnAttach = document.getElementById('btnWargaAttachMenu');
    const attachPop = document.getElementById('wargaAttachmentMenuPopover');
    const emojiPop = document.getElementById('emojiPickerWarga');

    if (attachPop) attachPop.style.display = 'none';
    if (emojiPop) emojiPop.style.display = 'none';

    if (mode === 'recording') {
        if (ui) ui.style.display = 'flex';
        if (previewBar) previewBar.style.display = 'none';
        if (chatInput) chatInput.style.display = 'none';
        if (btnRecord) btnRecord.style.display = 'none';
        if (btnSend) btnSend.style.display = 'none';
        if (btnEmoji) btnEmoji.style.display = 'none';
        if (btnAttach) btnAttach.style.display = 'none';
    } else if (mode === 'preview') {
        if (ui) ui.style.display = 'none';
        if (previewBar) previewBar.style.display = 'flex';
        if (chatInput) chatInput.style.display = 'none';
        if (btnRecord) btnRecord.style.display = 'none';
        if (btnSend) btnSend.style.display = 'none';
        if (btnEmoji) btnEmoji.style.display = 'none';
        if (btnAttach) btnAttach.style.display = 'none';
    } else {
        // 'normal'
        if (ui) ui.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (chatInput) chatInput.style.display = 'block';
        if (btnRecord) {
            btnRecord.style.display = 'inline-flex';
            btnRecord.style.color = '#64748b';
        }
        if (btnSend) btnSend.style.display = 'flex';
        if (btnEmoji) btnEmoji.style.display = 'inline-flex';
        if (btnAttach) btnAttach.style.display = 'inline-flex';
    }
};

window.toggleVoiceRecordWarga = async function () {
    const ui = document.getElementById('wargaRecordingUI');
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const chatInput = document.getElementById('wargaChatInput');
    const btnRecord = document.getElementById('btnRecordWarga');
    const btnSend = document.getElementById('btnSendWarga');

    if (window.mediaRecorderWarga && window.mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        window.audioChunksWarga = audioChunksWarga = [];
        window.mediaRecorderWarga = mediaRecorderWarga = new MediaRecorder(stream);
        window.isWargaVoicePaused = isWargaVoicePaused = false;
        window.wargaVoiceRecordStartTime = wargaVoiceRecordStartTime = Date.now();
        window.wargaVoicePausedTotalMs = wargaVoicePausedTotalMs = 0;
        window.wargaVoicePauseStart = wargaVoicePauseStart = 0;
        window.exactVoiceSecondsWarga = exactVoiceSecondsWarga = 0;
        if (wargaWhileRecordingAudio) {
            wargaWhileRecordingAudio.pause();
            window.wargaWhileRecordingAudio = wargaWhileRecordingAudio = null;
        }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            window.recordAudioCtxWarga = recordAudioCtxWarga = new AudioCtx();
            window.recordAnalyserWarga = recordAnalyserWarga = recordAudioCtxWarga.createAnalyser();
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
                window.tempPreviewWargaBlob = tempPreviewWargaBlob = new Blob(audioChunksWarga, { type: 'audio/webm' });
                window.renderPreviewVoiceWarga(tempPreviewWargaBlob);
            }
        };

        mediaRecorderWarga.start(250);
        voiceSecondsWarga = 0;

        window.setWargaInputBarMode('recording');

        if (ui) {
            ui.style.display = 'flex';
            const activeRow = document.getElementById('wargaVoiceActiveRow');
            const pausedReviewRow = document.getElementById('wargaVoicePausedReviewRow');
            if (activeRow) activeRow.style.display = 'flex';
            if (pausedReviewRow) pausedReviewRow.style.display = 'none';

            const pauseBtn = document.getElementById('btnPauseResumeWarga');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Jeda Rekaman';
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
        window.voiceTimerIntervalWarga = voiceTimerIntervalWarga = setInterval(() => {
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
        const alertFn = (typeof showPortalAlert === 'function' ? showPortalAlert : (window.showPortalAlert || (typeof Swal !== 'undefined' ? Swal.fire : alert)));
        alertFn({ icon: 'error', title: 'Mikrofon Ditolak', text: 'Izinkan akses mikrofon peramban untuk merekam suara.' });
    }
};

window.stopAndPreviewVoiceWarga = function () {
    if (voiceTimerIntervalWarga) clearInterval(voiceTimerIntervalWarga);
    if (wargaWhileRecordingAudio) {
        wargaWhileRecordingAudio.pause();
        window.wargaWhileRecordingAudio = wargaWhileRecordingAudio = null;
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
        window.wargaWhileRecordingAudio = wargaWhileRecordingAudio = null;
    }
    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        window.tempPreviewWargaAudio = tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);
    window.tempPreviewWargaBlob = tempPreviewWargaBlob = null;
    window.isWargaVoicePaused = isWargaVoicePaused = false;
    window.exactVoiceSecondsWarga = exactVoiceSecondsWarga = 0;
    window.clearAllWargaVoicePreviewAttachments();

    window.setWargaInputBarMode('normal');

    const captionInp = document.getElementById('wargaVoiceCaptionInput');
    if (captionInp) captionInp.value = '';
};

// =========================================================================
// KONTROL PRATINJAU SUARA WARGA DENGAN BATANG FREKUENSI MULUS & AKURAT
// =========================================================================
window.renderPreviewVoiceWarga = function (blob) {
    window.setWargaInputBarMode('preview');

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

    tempPreviewWargaAudio.ontimeupdate = () => {
        const total = exactVoiceSecondsWarga || (tempPreviewWargaAudio && tempPreviewWargaAudio.duration) || durSec;
        if (timerEl) {
            const cur = tempPreviewWargaAudio ? tempPreviewWargaAudio.currentTime : 0;
            timerEl.innerText = `${formatAudioTime(cur)} / ${formatAudioTime(total)}`;
        }
        if (seekInp && total > 0) {
            seekInp.value = (tempPreviewWargaAudio.currentTime / total) * 100;
        }
    };

    window.drawPreviewWaveWarga(false);
    document.getElementById('wargaVoiceCaptionInput')?.focus();
};

window.drawPreviewWaveWarga = function (isWavy) {
    const canvas = document.getElementById('wargaPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const total = exactVoiceSecondsWarga || (tempPreviewWargaAudio && tempPreviewWargaAudio.duration) || 1;
    const progress = (tempPreviewWargaAudio && total > 0) ? (tempPreviewWargaAudio.currentTime / total) : 0;
    const progressX = Math.max(0, Math.min(width, progress * width));

    ctx.clearRect(0, 0, width, height);

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
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const menu = document.getElementById('wargaVoicePreviewAttachMenu');
    const btn = document.getElementById('btnWargaVoicePreviewAttach');
    if (!menu) return;

    const isVisible = (menu.style.display === 'block' || menu.style.display === 'flex');
    if (isVisible) {
        menu.style.display = 'none';
        return;
    }

    menu.style.display = 'block';

    if (btn) {
        const chatWrap = document.getElementById('wargaChatCardContainer') ||
                         document.getElementById('wargaChatCardWrap') ||
                         document.getElementById('dashboardWargaSection') ||
                         menu.offsetParent;
        const btnRect = btn.getBoundingClientRect();
        const parentRect = menu.offsetParent ? menu.offsetParent.getBoundingClientRect() : btnRect;
        const chatRect = chatWrap ? chatWrap.getBoundingClientRect() : parentRect;

        const menuWidth = 250;
        let leftInParent = (btnRect.left - parentRect.left) + (btnRect.width / 2) - (menuWidth / 2);

        const minLeft = (chatRect.left - parentRect.left) + 8;
        const maxLeft = (chatRect.right - parentRect.left) - menuWidth - 8;

        leftInParent = Math.max(minLeft, Math.min(leftInParent, maxLeft));

        menu.style.setProperty('left', `${Math.round(leftInParent)}px`, 'important');
        menu.style.setProperty('right', 'auto', 'important');
        menu.style.setProperty('bottom', '48px', 'important');
        menu.style.setProperty('width', `${menuWidth}px`, 'important');
    }

    const closeOnClickOutside = function (ev) {
        if (!menu.contains(ev.target) && !ev.target.closest('#btnWargaVoicePreviewAttach')) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeOnClickOutside);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
    }, 50);
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

window.removeWargaVoicePreviewAttachment = window.removeWargaVoicePreviewFile;

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
    const blobToProcess = window.tempPreviewWargaBlob || tempPreviewWargaBlob;
    if (!blobToProcess) return;

    const currentNik = (typeof getActiveNikChat === 'function' ? getActiveNikChat() : '') ||
                       window.wargaNik ||
                       (window.sesiWargaAktif && window.sesiWargaAktif.nik) ||
                       localStorage.getItem('wargaNik') || '';
    const currentNama = (typeof getActiveNamaChat === 'function' ? getActiveNamaChat() : '') ||
                        window.wargaNama ||
                        (window.sesiWargaAktif && (window.sesiWargaAktif.nama_lengkap || window.sesiWargaAktif.nama)) ||
                        localStorage.getItem('wargaNama') || 'Warga';
    if (!currentNik) return;

    window.isSendingVoiceWarga = true;
    const sendBtn = document.getElementById('btnSendConfirmedVoiceWarga');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';
    }

    if (tempPreviewWargaAudio) {
        tempPreviewWargaAudio.pause();
        window.tempPreviewWargaAudio = tempPreviewWargaAudio = null;
    }
    if (tempPreviewWargaAnim) cancelAnimationFrame(tempPreviewWargaAnim);

    const voiceBlobToSend = blobToProcess;
    window.tempPreviewWargaBlob = tempPreviewWargaBlob = null;

    const filesToSend = [...(window.wargaVoicePreviewFiles || [])];
    const extraLocationToSend = window.wargaVoiceExtraLocation;

    // Ambil teks keterangan pesan suara jika diketik warga (opsional, JIKA KOSONG JANGAN DIISI EMOJI MIC!)
    const captionInp = document.getElementById('wargaVoiceCaptionInput');
    const captionText = captionInp ? captionInp.value.trim() : '';
    if (captionInp) captionInp.value = '';

    window.clearAllWargaVoicePreviewAttachments();

    window.setWargaInputBarMode('normal');

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
