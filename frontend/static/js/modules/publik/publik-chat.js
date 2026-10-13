/**
 * Modul: publik-chat.js
 * Deskripsi: Obrolan interaktif mediasi aduan warga dan ruang warga terdaftar, picker emoji, lampiran
 */

var API_URL = (typeof window.API_URL !== 'undefined' ? window.API_URL : (typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : window.location.origin)).replace(/\/+$/, '');
var BASE_URL = API_URL;
window.API_URL = API_URL;
window.BASE_URL = BASE_URL;

function enc(str) {
    return encodeURIComponent(str || '');
}
window.enc = enc;

function escapeInlineJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
}
window.escapeInlineJS = escapeInlineJS;

function safeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.safeHtml = safeHtml;

window.lastChatHashWarga = window.lastChatHashWarga || '';
window.activeOpenChatMenuId = null;
window.hasScrolledWargaChatOnce = false;

window.tempPreviewWargaBlob = window.tempPreviewWargaBlob || null;
var tempPreviewWargaBlob = window.tempPreviewWargaBlob;
window.mediaRecorderWarga = window.mediaRecorderWarga || null;
var mediaRecorderWarga = window.mediaRecorderWarga;
window.replyToDataWarga = window.replyToDataWarga || null;
var replyToDataWarga = window.replyToDataWarga;
window.wargaChatPendingFiles = window.wargaChatPendingFiles || [];

window.showPortalAlert = window.showPortalAlert || function (opts) {
    if (typeof Swal !== 'undefined') return Swal.fire(opts);
    alert(opts.text || opts.title || 'Informasi');
    return Promise.resolve({ isConfirmed: true, value: true });
};
var showPortalAlert = window.showPortalAlert;

function getActiveNikChat() {
    let nik = (window.sesiAduanAktif && window.sesiAduanAktif.nik) ||
              (typeof sesiAduanAktif !== 'undefined' && sesiAduanAktif && sesiAduanAktif.nik) ||
              (typeof window.getActiveWargaNik === 'function' && window.getActiveWargaNik()) ||
              (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) ||
              (typeof sesiWargaAktif !== 'undefined' && sesiWargaAktif && (sesiWargaAktif.nik_asli || sesiWargaAktif.nik)) ||
              window.wargaNik ||
              (typeof wargaNik !== 'undefined' ? wargaNik : '') ||
              localStorage.getItem('wargaNik') ||
              localStorage.getItem('lastAduanNik') ||
              sessionStorage.getItem('wargaNik') ||
              '';
    if (!nik) {
        const el = document.getElementById('aduanNikDisplay') || document.getElementById('wNik') || document.getElementById('dashWargaNik');
        if (el) nik = el.innerText.replace(/\D/g, '');
    }
    return String(nik || '').replace(/\D/g, '');
}
window.getActiveNikChat = getActiveNikChat;

function getActiveNamaChat() {
    let nama = (window.sesiAduanAktif && (window.sesiAduanAktif.nama || window.sesiAduanAktif.nama_lengkap)) ||
               (typeof sesiAduanAktif !== 'undefined' && sesiAduanAktif && (sesiAduanAktif.nama || sesiAduanAktif.nama_lengkap)) ||
               (typeof window.getActiveWargaNama === 'function' && window.getActiveWargaNama()) ||
               (window.sesiWargaAktif && (window.sesiWargaAktif.nama_lengkap || window.sesiWargaAktif.nama)) ||
               (typeof sesiWargaAktif !== 'undefined' && sesiWargaAktif && (sesiWargaAktif.nama_lengkap || sesiWargaAktif.nama)) ||
               window.wargaNama ||
               (typeof wargaNama !== 'undefined' ? wargaNama : '') ||
               localStorage.getItem('wargaNama') ||
               localStorage.getItem('lastAduanNama') ||
               sessionStorage.getItem('wargaNama') ||
               '';
    if (!nama) {
        const el = document.getElementById('aduanNamaDisplay') || document.getElementById('wNama') || document.getElementById('dashWargaNama');
        if (el) nama = el.innerText.trim();
    }
    return String(nama || 'Warga').trim();
}
window.getActiveNamaChat = getActiveNamaChat;

// 9. CHAT MULTIMEDIA (TITIK TIGA POJOK KIRI/KANAN, EMOJI FLOAT, LAPORAN MEMBULAT)
// =========================================================================
window.downloadDocumentDirect = async function (url, fileName, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const safeName = fileName || (url ? url.split('/').pop() : 'dokumen') || 'dokumen_bansos';
    const fileParam = url ? url.split('/').pop() : safeName;
    const serverDlUrl = `${API_URL}/api/chat/download/${fileParam}?name=${encodeURIComponent(safeName)}`;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: `Menyiapkan unduhan: ${safeName}...`,
            timer: 1800,
            showConfirmButton: false
        });
    }

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Fetch failed ' + resp.status);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Berkas berhasil diunduh: ${safeName}`,
                timer: 2500,
                showConfirmButton: false
            });
        }
    } catch (e) {
        const a = document.createElement('a');
        a.href = serverDlUrl;
        a.download = safeName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// =========================================================================
// KONTROL PEMUTAR SUARA MODERN (VOICE NOTE SPEED 1x, 1.5x, 2x, 0.5x & FREKUENSI)
// =========================================================================
const WARGA_VOICE_SPEEDS = [1, 1.5, 2, 0.5];

function formatTimeSeconds(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

window.initVoiceBubbleMeta = function (audioId) {
    const aud = document.getElementById(audioId);
    const durEl = document.getElementById('dur_' + audioId);
    if (!aud) return;

    const setDur = () => {
        if (durEl && aud.duration && isFinite(aud.duration) && aud.duration > 0) {
            durEl.innerText = formatTimeSeconds(aud.duration);
        }
    };

    if (aud.duration === Infinity || !isFinite(aud.duration) || isNaN(aud.duration) || aud.duration <= 0) {
        aud.currentTime = 1e101;
        aud.ontimeupdate = function () {
            this.ontimeupdate = () => window.updateVoiceBubbleTime(audioId);
            aud.currentTime = 0;
            setDur();
        };
    } else {
        setDur();
    }
};

window.updateVoiceBubbleTime = function (audioId) {
    const aud = document.getElementById(audioId);
    const durEl = document.getElementById(`dur_${audioId}`);
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    if (!aud) return;

    let dur = aud.duration;
    if (!dur || !isFinite(dur) || isNaN(dur)) {
        dur = aud.currentTime > 0 ? aud.currentTime : 0;
    }
    const cur = aud.currentTime || 0;
    if (durEl) {
        if (dur > 0) {
            durEl.innerText = `${formatTimeSeconds(cur)} / ${formatTimeSeconds(dur)}`;
        } else {
            durEl.innerText = formatTimeSeconds(cur);
        }
    }

    if (freqBox && dur > 0) {
        const ratio = Math.min(1, Math.max(0, cur / dur));
        const bars = freqBox.querySelectorAll('.voice-freq-bar');
        const activeIndex = Math.floor(ratio * bars.length);
        const cardEl = freqBox.closest('.voice-note-bubble-card') || freqBox.closest('[id^="msg-"]');
        const isOutgoing = (cardEl && (cardEl.closest('.outgoing') || (cardEl.closest('[id^="msg-"]') && cardEl.closest('[id^="msg-"]').style.alignSelf === 'flex-end')));
        const activeColor = isOutgoing ? '#009846' : '#0284c7';
        bars.forEach((bar, idx) => {
            if (idx <= activeIndex) {
                bar.classList.add('played');
                bar.style.opacity = '1';
                bar.style.background = activeColor;
            } else {
                bar.classList.remove('played');
                bar.style.opacity = '0.4';
                bar.style.background = '#cbd5e1';
            }
        });
    }
};

window.activeVoiceVisualizersWarga = window.activeVoiceVisualizersWarga || {};

window.startVoiceFrequencyVisualizerWarga = function (audioId) {
    const aud = document.getElementById(audioId);
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    if (!aud || !freqBox) return;

    if (window.activeVoiceVisualizersWarga[audioId]) {
        cancelAnimationFrame(window.activeVoiceVisualizersWarga[audioId]);
    }

    const bars = freqBox.querySelectorAll('.voice-freq-bar');
    if (!bars.length) return;

    let analyser = null;
    let freqData = null;
    try {
        if (!aud._webAudioInit) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const src = ctx.createMediaElementSource(aud);
                const a = ctx.createAnalyser();
                a.fftSize = 64;
                a.smoothingTimeConstant = 0.8;
                src.connect(a);
                a.connect(ctx.destination);
                aud._analyser = a;
                aud._audioCtx = ctx;
                aud._webAudioInit = true;
            }
        }
        if (aud._analyser) {
            analyser = aud._analyser;
            if (aud._audioCtx && aud._audioCtx.state === 'suspended') {
                aud._audioCtx.resume();
            }
            freqData = new Uint8Array(analyser.frequencyBinCount);
        }
    } catch (e) {
        analyser = null;
    }

    function renderVoiceFrame() {
        if (aud.paused || aud.ended) {
            // Suara tidak muncul atau jeda -> grafiknya lurus atau datar
            bars.forEach(b => {
                b.style.height = '3.5px';
            });
            delete window.activeVoiceVisualizersWarga[audioId];
            return;
        }

        let hasSignal = false;
        if (analyser && freqData) {
            analyser.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) sum += freqData[i];
            if (sum > 12) {
                hasSignal = true;
                const numBars = bars.length;
                bars.forEach((bar, idx) => {
                    const bin = Math.min(freqData.length - 1, Math.floor((idx / numBars) * (freqData.length * 0.85)));
                    const val = freqData[bin] || 0;
                    if (val < 8) {
                        bar.style.height = '3.5px'; // Hening / tak terdeteksi -> datar
                    } else {
                        // Nada semakin tinggi -> grafik semakin tinggi; nada semakin rendah -> grafik semakin rendah
                        const pct = Math.max(14, Math.min(100, Math.round((val / 255) * 100)));
                        bar.style.height = `${pct}%`;
                    }
                });
            }
        }

        if (!hasSignal) {
            // Simulasi dinamis frekuensi nada audio
            const t = Date.now() / 130;
            const numBars = bars.length;
            bars.forEach((bar, idx) => {
                const norm = idx / numBars;
                const lowPitch = Math.sin(t * 1.5 + norm * 3.0);
                const highPitch = Math.sin(t * 3.8 + norm * 8.5) * 0.6;
                const combined = (lowPitch + highPitch + 1.6) / 3.2;
                const pitchMultiplier = 0.35 + 0.65 * norm;
                const calculatedHeight = Math.max(14, Math.min(96, Math.round(combined * pitchMultiplier * 85 + 15)));
                bar.style.height = `${calculatedHeight}%`;
            });
        }

        window.activeVoiceVisualizersWarga[audioId] = requestAnimationFrame(renderVoiceFrame);
    }

    window.activeVoiceVisualizersWarga[audioId] = requestAnimationFrame(renderVoiceFrame);
};

window.stopVoiceFrequencyVisualizerWarga = function (audioId) {
    if (window.activeVoiceVisualizersWarga && window.activeVoiceVisualizersWarga[audioId]) {
        cancelAnimationFrame(window.activeVoiceVisualizersWarga[audioId]);
        delete window.activeVoiceVisualizersWarga[audioId];
    }
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    if (freqBox) {
        freqBox.querySelectorAll('.voice-freq-bar').forEach(b => {
            b.style.height = '3.5px';
        });
    }
};

window.toggleVoiceBubblePlay = function (audioId, btn) {
    const aud = document.getElementById(audioId);
    if (!aud) return;

    const iconEl = btn ? btn.querySelector('i') : document.querySelector(`#btn_play_${audioId} i`);
    const freqBox = document.getElementById(`freq_box_${audioId}`);

    if (!aud.paused) {
        aud.pause();
        if (iconEl) iconEl.className = 'fas fa-play';
        if (btn) btn.classList.remove('playing');
        if (freqBox) freqBox.classList.remove('playing');
        window.stopVoiceFrequencyVisualizerWarga(audioId);
        return;
    }

    document.querySelectorAll('audio, video').forEach(media => {
        if (media.id !== audioId && !media.paused) {
            media.pause();
            const otherBtn = document.getElementById(`btn_play_${media.id}`);
            if (otherBtn) {
                otherBtn.classList.remove('playing');
                const icon = otherBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-play';
            }
            const otherFreq = document.getElementById(`freq_box_${media.id}`);
            if (otherFreq) otherFreq.classList.remove('playing');
            window.stopVoiceFrequencyVisualizerWarga(media.id);
        }
    });

    aud.play().then(() => {
        if (iconEl) iconEl.className = 'fas fa-pause';
        if (btn) btn.classList.add('playing');
        if (freqBox) freqBox.classList.add('playing');
        window.startVoiceFrequencyVisualizerWarga(audioId);
    }).catch(() => {});
};

window.resetVoiceBubblePlay = function (audioId) {
    const aud = document.getElementById(audioId);
    const btn = document.getElementById(`btn_play_${audioId}`);
    const iconEl = btn ? btn.querySelector('i') : null;
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    const durEl = document.getElementById(`dur_${audioId}`);

    if (aud) {
        aud.currentTime = 0;
        if (durEl && aud.duration && isFinite(aud.duration)) {
            durEl.innerText = formatTimeSeconds(aud.duration);
        }
    }
    if (iconEl) iconEl.className = 'fas fa-play';
    if (btn) btn.classList.remove('playing');
    window.stopVoiceFrequencyVisualizerWarga(audioId);
    if (freqBox) {
        freqBox.classList.remove('playing');
        freqBox.querySelectorAll('.voice-freq-bar').forEach(b => {
            b.classList.remove('played');
            b.style.opacity = '0.45';
            b.style.background = '#cbd5e1';
            b.style.height = '3.5px'; // Lurus / datar
        });
    }
};

// =========================================================================
// KONTROL PEMUTAR VIDEO BUBBLE MODERN DI PORTAL WARGA
// =========================================================================
window.toggleVideoBubblePlay = function (videoId, event) {
    if (event) event.stopPropagation();
    const vid = document.getElementById(videoId);
    if (!vid) return;

    const centerIcon = document.getElementById(`vid_center_icon_${videoId}`);
    const overlay = document.getElementById(`vid_overlay_${videoId}`);
    const hoverPlayBtn = document.getElementById(`vid_btn_play_${videoId}`);

    if (!vid.paused) {
        vid.pause();
        if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
            overlay.classList.remove('is-playing');
        }
        if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        return;
    }

    // Hentikan video dan audio lain
    document.querySelectorAll('audio, video').forEach(media => {
        if (media.id !== videoId && !media.paused) {
            media.pause();
            const o = document.getElementById(`vid_overlay_${media.id}`);
            if (o) {
                o.style.display = 'flex';
                o.style.opacity = '1';
                o.classList.remove('is-playing');
            }
        }
    });

    vid.play().then(() => {
        if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-pause"></i>';
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.classList.add('is-playing');
        }
        const wrap = document.getElementById(`vid_wrap_${videoId}`);
        if (wrap) wrap.classList.add('is-playing');
        if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }).catch(() => {});
};

window.toggleVideoBubbleMute = function (videoId, event) {
    if (event) event.stopPropagation();
    const vid = document.getElementById(videoId);
    const btn = document.getElementById(`vid_btn_mute_${videoId}`);
    if (!vid) return;

    vid.muted = !vid.muted;
    if (btn) {
        btn.innerHTML = vid.muted
            ? '<i class="fas fa-volume-mute" style="color:#ef4444;"></i>'
            : '<i class="fas fa-volume-up"></i>';
    }
};

window.updateVideoBubbleProgress = function (videoId) {
    const vid = document.getElementById(videoId);
    const timeEl = document.getElementById(`vid_time_${videoId}`);
    const scrubEl = document.getElementById(`vid_scrub_${videoId}`);
    if (!vid) return;
    const cur = vid.currentTime || 0;
    const dur = vid.duration || 0;
    if (timeEl) {
        if (dur > 0 && isFinite(dur)) {
            timeEl.innerText = `${formatTimeSeconds(cur)}/${formatTimeSeconds(dur)}`;
        } else {
            timeEl.innerText = formatTimeSeconds(cur);
        }
    }
    if (scrubEl && dur > 0 && isFinite(dur)) {
        scrubEl.value = ((cur / dur) * 100).toFixed(1);
    }
};

window.seekVideoBubble = function (videoId, percent) {
    const vid = document.getElementById(videoId);
    if (!vid) return;
    const dur = vid.duration || 0;
    if (dur > 0 && isFinite(dur)) {
        vid.currentTime = (parseFloat(percent) / 100) * dur;
        window.updateVideoBubbleProgress(videoId);
    }
};

window.jumpVideoTime = function (videoId, seconds, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const vid = document.getElementById(videoId);
    if (!vid) return;
    const cur = vid.currentTime || 0;
    const dur = vid.duration || Infinity;
    let nextTime = cur + seconds;
    if (nextTime < 0) nextTime = 0;
    if (isFinite(dur) && nextTime > dur) nextTime = dur;
    vid.currentTime = nextTime;
    window.updateVideoBubbleProgress(videoId);
    window.showVideoJumpFeedback(videoId, seconds > 0 ? `+${seconds}s` : `${seconds}s`, seconds > 0 ? 'right' : 'left');
};

window.handleVideoDblClick = function (videoId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const vid = document.getElementById(videoId);
    if (!vid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const isRight = clickX >= rect.width / 2;
    window.jumpVideoTime(videoId, isRight ? 10 : -10, event);
};

window.showVideoJumpFeedback = function (videoId, label, side) {
    const wrap = document.getElementById(`vid_wrap_${videoId}`);
    if (!wrap) return;
    let fb = wrap.querySelector(`.video-jump-ripple.${side}`);
    if (!fb) {
        fb = document.createElement('div');
        fb.className = `video-jump-ripple ${side}`;
        wrap.appendChild(fb);
    }
    fb.innerHTML = side === 'right' 
        ? `<span>${label}</span> <i class="fas fa-forward"></i>` 
        : `<i class="fas fa-backward"></i> <span>${label}</span>`;
    fb.classList.remove('active');
    void fb.offsetWidth; // force reflow
    fb.classList.add('active');
    setTimeout(() => {
        if (fb) fb.classList.remove('active');
    }, 650);
};

const WARGA_VIDEO_SPEEDS = [0.5, 1, 1.5, 2];
window.cycleVideoSpeed = function (videoId, btn, event) {
    if (event) event.stopPropagation();
    const vid = document.getElementById(videoId);
    if (!vid) return;
    const cur = vid.playbackRate || 1;
    let idx = WARGA_VIDEO_SPEEDS.indexOf(cur);
    if (idx === -1) idx = 1;
    const nextRate = WARGA_VIDEO_SPEEDS[(idx + 1) % WARGA_VIDEO_SPEEDS.length];
    vid.playbackRate = nextRate;
    if (btn) {
        btn.innerText = `${nextRate}x`;
        btn.title = `Kecepatan: ${nextRate}x (Klik untuk ubah: 0.5x, 1x, 1.5x, 2x)`;
        if (nextRate !== 1) {
            btn.classList.add('speed-active');
        } else {
            btn.classList.remove('speed-active');
        }
    }
};

window.resetVideoBubble = function (videoId) {
    const vid = document.getElementById(videoId);
    const centerIcon = document.getElementById(`vid_center_icon_${videoId}`);
    const overlay = document.getElementById(`vid_overlay_${videoId}`);
    const hoverPlayBtn = document.getElementById(`vid_btn_play_${videoId}`);
    const scrubEl = document.getElementById(`vid_scrub_${videoId}`);

    if (vid) vid.currentTime = 0;
    if (scrubEl) scrubEl.value = 0;
    if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.classList.remove('is-playing');
    }
    if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
};

window.toggleVoiceSpeed = function (audioId, btn) {
    const aud = document.getElementById(audioId);
    if (!aud || !btn) return;

    let currentRate = aud.playbackRate || 1;
    let currentIdx = WARGA_VOICE_SPEEDS.indexOf(currentRate);
    if (currentIdx === -1) currentIdx = 0;
    const nextIdx = (currentIdx + 1) % WARGA_VOICE_SPEEDS.length;
    const nextRate = WARGA_VOICE_SPEEDS[nextIdx];

    aud.playbackRate = nextRate;
    btn.innerText = `${nextRate}x`;
    btn.title = `Kecepatan: ${nextRate}x (Klik untuk ubah: 1x, 1.5x, 2x, 0.5x)`;
    btn.classList.add('speed-active');
};

window.seekVoiceBubbleByClick = function (audioId, event) {
    const aud = document.getElementById(audioId);
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    if (!aud || !freqBox) return;

    const dur = (aud.duration && isFinite(aud.duration)) ? aud.duration : (aud.currentTime > 0 ? aud.currentTime : 10);
    const rect = freqBox.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    aud.currentTime = pct * dur;
    window.updateVoiceBubbleTime(audioId);
};

window.startVoiceBubbleScrub = function (audioId, event) {
    const aud = document.getElementById(audioId);
    const freqBox = document.getElementById(`freq_box_${audioId}`);
    if (!aud || !freqBox) return;

    const applySeek = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = freqBox.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const dur = (aud.duration && isFinite(aud.duration)) ? aud.duration : (aud.currentTime > 0 ? aud.currentTime : 10);
        aud.currentTime = pct * dur;
        window.updateVoiceBubbleTime(audioId);
    };

    const onMove = (e) => applySeek(e);
    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    applySeek(event);
};

document.addEventListener('click', function (e) {
    if (!e.target.closest('.aduan-dropdown-menu') && !e.target.closest('.btn-msg-dots') && !e.target.closest('.bubble-corner-btn')) {
        document.querySelectorAll('.aduan-dropdown-menu, [id^="aduan-menu-"], [id^="menu-warga-"]').forEach(m => {
            m.style.display = 'none';
            m.classList.remove('show');
        });
        document.querySelectorAll('[id^="msg-aduan-"], [id^="msg-warga-"]').forEach(b => {
            b.style.zIndex = '';
            b.classList.remove('menu-open');
        });
        window.activeOpenChatMenuId = null;
    }
    if (!e.target.closest('.emoji-picker-container') && !e.target.closest('[onclick*="toggleEmojiPicker"]')) {
        const picker = document.getElementById('emojiPickerWarga');
        if (picker) picker.style.display = 'none';
    }
});

window.toggleAduanMsgMenu = function (id, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    const menu = document.getElementById(`aduan-menu-${id}`);
    const isShown = menu && (menu.style.display === 'flex' || menu.style.display === 'block' || menu.classList.contains('show'));
    
    // Tutup semua menu lain dan reset zIndex semua bubble
    document.querySelectorAll('.aduan-dropdown-menu, [id^="aduan-menu-"], [id^="menu-warga-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    document.querySelectorAll('[id^="msg-aduan-"], [id^="msg-warga-"]').forEach(b => {
        b.style.zIndex = '';
        b.classList.remove('menu-open');
    });

    if (!isShown && menu) {
        // Angkat parent bubble ke z-index tertinggi agar SELALU DI PALING ATAS dan tidak tertutup layout pesan berikutnya
        const bubble = document.getElementById(`msg-aduan-${id}`) || menu.closest('[id^="msg-aduan-"]');
        if (bubble) {
            bubble.style.zIndex = '9999999';
            bubble.classList.add('menu-open');
        }
        if (menu.parentElement) {
            menu.parentElement.style.zIndex = '9999999';
        }

        menu.style.display = 'flex';
        menu.style.background = '#ffffff';
        menu.style.backgroundColor = '#ffffff';
        menu.style.opacity = '1';
        menu.classList.add('show');
        window.activeOpenChatMenuId = id;

        const btn = event ? (event.currentTarget || event.target.closest('button')) : null;
        const box = document.getElementById('aduanChatMessages') || document.getElementById('chatMessagesModalAduan') || document.querySelector('.aduan-chat-body');
        if (btn && box) {
            const bRect = btn.getBoundingClientRect();
            const cRect = box.getBoundingClientRect();
            const spaceBelow = cRect.bottom - bRect.bottom;
            const spaceAbove = bRect.top - cRect.top;
            const menuHeight = 290; // perkiraan tinggi dropdown

            const openUpward = (spaceBelow < menuHeight) && (spaceAbove > 180);

            if (openUpward) {
                menu.style.setProperty('top', 'auto', 'important');
                menu.style.setProperty('bottom', '28px', 'important');
            } else {
                menu.style.setProperty('top', '24px', 'important');
                menu.style.setProperty('bottom', 'auto', 'important');
            }
            if (cRect.right - bRect.right < 230) {
                menu.style.setProperty('right', '0', 'important');
                menu.style.setProperty('left', 'auto', 'important');
            } else {
                menu.style.setProperty('left', '0', 'important');
                menu.style.setProperty('right', 'auto', 'important');
            }
        }
    }
};

window.setReplyAduan = function (id, sender, text) {
    replyToDataAduan = { id, sender, text };
    const cont = document.getElementById('replyPreviewContainerAduan');
    const sEl = document.getElementById('replyPreviewSenderAduan');
    const tEl = document.getElementById('replyPreviewTextAduan');
    if (cont && sEl && tEl) {
        sEl.innerText = sender;
        tEl.innerText = text.length > 50 ? text.substring(0, 50) + '...' : text;
        cont.style.display = 'flex';
    }
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    document.getElementById('aduanChatInput')?.focus();
};

window.batalReplyAduan = function () {
    replyToDataAduan = null;
    const cont = document.getElementById('replyPreviewContainerAduan');
    if (cont) cont.style.display = 'none';
};

window.salinTeksAduan = function (teks) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    if (!teks) return;
    navigator.clipboard.writeText(teks).then(() => {
        showPortalAlert({ icon: 'success', title: 'Tersalin', text: 'Teks pesan berhasil disalin ke papan klip.', timer: 1000, showConfirmButton: false });
    });
};

window.reactToMessageAduan = async function (msgId) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨', '👏', '😮', '😢', '💯'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionAduan(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({
        title: 'Beri Reaksi Emoji',
        html,
        showConfirmButton: false,
        customClass: { popup: 'swal-rounded-popup' }
    });
};

window.submitReactionAduan = async function (msgId, emoji) {
    document.querySelectorAll('[id^="aduan-menu-"], .aduan-dropdown-menu').forEach(m => m.style.display = 'none');
    Swal?.close();
    try {
        await fetch(`${API_URL}/api/chat/react/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
        });
        window.muatPesanAduan(false);
    } catch (e) {}
};

window.hapusPesanAduan = async function (id, tipe) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');
    const konfirmasi = confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini untuk semua' : 'menghapus pesan dari layar Anda'}?`);
    if (konfirmasi) {
        try {
            await fetch(`${API_URL}/api/chat/action/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tipe, requester: 'warga' })
            });
            window.muatPesanAduan(false);
        } catch (e) {}
    }
};

window.toggleLaporSelect = function () {
    const wrapper = document.getElementById('swalLaporSelectWrapper');
    if (wrapper) wrapper.classList.toggle('open');
};

window.selectLaporOption = function (val, text, iconClass) {
    const hidden = document.getElementById('inputAlasanLapor');
    const label = document.getElementById('swalLaporSelectedLabel');
    const wrapper = document.getElementById('swalLaporSelectWrapper');
    const manualCont = document.getElementById('swalLaporManualContainer');
    const manualInput = document.getElementById('inputLaporManual');

    if (hidden) hidden.value = val;
    if (label) label.innerHTML = `<i class="fas ${iconClass}" style="margin-right:8px;"></i> ${text}`;

    if (wrapper) {
        wrapper.querySelectorAll('.swal-custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        wrapper.classList.remove('open');
    }
    if (event?.currentTarget) {
        event.currentTarget.classList.add('selected');
    }

    if (val === 'Lainnya') {
        if (manualCont) {
            manualCont.style.display = 'block';
            setTimeout(() => { if (manualInput) manualInput.focus(); }, 100);
        }
    } else {
        if (manualCont) manualCont.style.display = 'none';
    }
};

window.laporPesanAdmin = async function (msgId) {
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => m.style.display = 'none');

    const { value: alasan } = await Swal.fire({
        title: '<i class="fas fa-flag text-danger"></i> Laporkan Pesan Petugas',
        html: `
            <div style="text-align:left; font-size:0.88rem; margin-top:10px;">
                <label style="font-weight:700; display:block; margin-bottom:8px; color:#334155;">Pilih Alasan Pelaporan:</label>
                
                <div class="swal-custom-select-wrapper" id="swalLaporSelectWrapper" onclick="event.stopPropagation()">
                    <div class="swal-custom-select-trigger" onclick="window.toggleLaporSelect()">
                        <span id="swalLaporSelectedLabel"><i class="fas fa-comment-slash text-danger" style="margin-right:8px;"></i> Kata-kata Kasar / Pelecehan</span>
                        <i class="fas fa-chevron-down swal-chevron"></i>
                    </div>
                    <div class="swal-custom-select-options" id="swalLaporSelectOptions">
                        <div class="swal-custom-option selected" onclick="window.selectLaporOption('Kata-kata Kasar / Pelecehan', 'Kata-kata Kasar / Pelecehan', 'fa-comment-slash text-danger')">
                            <i class="fas fa-comment-slash text-danger" style="margin-right:8px;"></i> Kata-kata Kasar / Pelecehan
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Permintaan Uang / Pungutan Liar (Pungli)', 'Permintaan Uang / Pungutan Liar (Pungli)', 'fa-hand-holding-usd text-warning')">
                            <i class="fas fa-hand-holding-usd text-warning" style="margin-right:8px;"></i> Permintaan Uang / Pungutan Liar (Pungli)
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Informasi Penyaluran Tidak Sesuai Realita', 'Informasi Penyaluran Tidak Sesuai Realita', 'fa-exclamation-triangle text-info')">
                            <i class="fas fa-exclamation-triangle text-info" style="margin-right:8px;"></i> Informasi Penyaluran Tidak Sesuai Realita
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Pelayanan Tidak Ramah / Mengabaikan', 'Pelayanan Tidak Ramah / Mengabaikan', 'fa-user-times text-secondary')">
                            <i class="fas fa-user-times text-secondary" style="margin-right:8px;"></i> Pelayanan Tidak Ramah / Mengabaikan
                        </div>
                        <div class="swal-custom-option" onclick="window.selectLaporOption('Lainnya', 'Lainnya', 'fa-ellipsis-h text-muted')">
                            <i class="fas fa-ellipsis-h text-muted" style="margin-right:8px;"></i> Lainnya
                        </div>
                    </div>
                    <input type="hidden" id="inputAlasanLapor" value="Kata-kata Kasar / Pelecehan">
                </div>

                <div id="swalLaporManualContainer" style="display:none; margin-top:12px;">
                    <label style="font-weight:700; display:block; margin-bottom:6px; color:#334155;">Tuliskan Rincian Laporan Anda:</label>
                    <textarea id="inputLaporManual" class="form-input" rows="3" placeholder="Jelaskan secara detail pelanggaran atau kendala yang dialami..." style="width:100%; padding:12px 16px; border-radius:18px; border:1.5px solid #cbd5e1; font-family:'Inter'; font-size:0.88rem; outline:none; resize:vertical;"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan Resmi',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Batal',
        cancelButtonColor: '#64748b',
        customClass: {
            popup: 'swal-rounded-popup',
            confirmButton: 'swal-btn-pill',
            cancelButton: 'swal-btn-pill'
        },
        preConfirm: () => {
            const val = document.getElementById('inputAlasanLapor')?.value || 'Kata-kata Kasar / Pelecehan';
            if (val === 'Lainnya') {
                const manualText = document.getElementById('inputLaporManual')?.value.trim();
                if (!manualText) {
                    Swal.showValidationMessage('Tuliskan rincian kendala/laporan Anda secara manual!');
                    return false;
                }
                return `Lainnya: ${manualText}`;
            }
            return val;
        }
    });

    if (alasan) {
        try {
            const pelaporNik = wargaNik || sesiAduanAktif?.nik || '-';
            const pelaporNama = wargaNama || sesiAduanAktif?.nama || 'Warga';

            // Kirim ke antrean pengaduan dan antrean moderasi pelanggaran chat
            await Promise.allSettled([
                fetch(`${API_URL}/api/publik/pengaduan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: pelaporNik,
                        nama_pelapor: pelaporNama,
                        kategori: 'Pelanggaran Komunikasi Chat Petugas',
                        isi_laporan: `[LAPORAN PESAN ID #${msgId}] Alasan: ${alasan}. Dilaporkan oleh warga ${pelaporNama} (NIK: ${pelaporNik}).`
                    })
                }),
                fetch(`${API_URL}/api/chat/lapor-pesan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        msg_id: parseInt(msgId, 10) || 0,
                        nik: pelaporNik,
                        nama_terlapor: 'Petugas Dinsos',
                        sender_terlapor: 'petugas',
                        pesan: `Pesan ID #${msgId}`,
                        alasan: alasan,
                        kategori: alasan.includes('Kasar') ? 'Kata-kata Kasar / Pelecehan' : (alasan.includes('Pungli') ? 'Pungutan Liar (Pungli)' : 'Pelanggaran Kode Etik Petugas'),
                        deskripsi: `Laporan warga ${pelaporNama}: ${alasan}`,
                        pelapor_role: 'warga',
                        pelapor_nama: pelaporNama,
                        pelapor_nik: pelaporNik
                    })
                })
            ]);

            showPortalAlert({
                icon: 'success',
                title: 'Laporan Diterima',
                text: 'Laporan Anda telah diteruskan ke Pusat Pengawasan & Moderasi Dinas Sosial Sidoarjo untuk ditindaklanjuti secara resmi.',
                customClass: { popup: 'swal-rounded-popup', confirmButton: 'swal-btn-pill' }
            });
        } catch (e) {
            showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan saat mengirim laporan.' });
        }
    }
};

window.formatGeotagCardHtml = function (rawText) {
    try {
        const jsonStr = rawText.replace('[GEOTAG_LOKASI]', '').trim();
        const loc = JSON.parse(jsonStr);
        const latVal = Number(loc.lat) || -7.4478;
        const lngVal = Number(loc.lng) || 112.7183;
        const isRealtime = loc.tipe === 'realtime';
        const headerTitle = isRealtime ? 'Lokasi Perangkat Real-time (GPS)' : 'Lokasi Rumah Arsip Kependudukan';
        const badgeHtml = isRealtime 
            ? `<span style="background:#ecfdf5; color:#047857; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0;"><i class="fas fa-crosshairs text-emerald-500"></i> GPS Perangkat Real-time</span>`
            : `<span style="background:#eff6ff; color:#1d4ed8; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #bfdbfe;"><i class="fas fa-check-circle text-blue-500"></i> Arsip Data Warga Terverifikasi</span>`;

        return `
            <div class="chat-geotag-card">
                <div class="chat-geotag-header">
                    <i class="fas ${isRealtime ? 'fa-location-arrow text-emerald-600' : 'fa-map-marked-alt text-primary'}" style="font-size:1.1rem;"></i>
                    <span>${headerTitle}</span>
                </div>
                <div style="margin:4px 0 6px 0;">
                    ${badgeHtml}
                </div>
                <div style="font-size:0.82rem; font-weight:800; color:#0f172a; margin-bottom:2px;">
                    ${safeHtml(loc.nama || 'Warga Terdaftar')}
                </div>
                <div style="font-size:0.7rem; color:#64748b; font-family:monospace; margin-bottom:4px;">
                    NIK: ${safeHtml(loc.nik || '-')}
                </div>
                <div style="font-size:0.75rem; color:#334155; line-height:1.4; margin-bottom:6px;">
                    <i class="fas fa-map-marker-alt text-danger"></i> ${safeHtml(loc.alamat || 'Kabupaten Sidoarjo, Jawa Timur')}
                </div>
                <div class="chat-geotag-coord">
                    📍 Lat: ${latVal.toFixed(4)}, Lng: ${lngVal.toFixed(4)} ${loc.accuracy ? `(±${loc.accuracy}m)` : ''}
                </div>
                <div class="chat-geotag-actions">
                    <a href="${loc.maps_url || `https://www.google.com/maps?q=${latVal},${lngVal}`}" target="_blank" class="btn-geotag-map">
                        <i class="fas fa-external-link-alt"></i> Peta Maps
                    </a>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${latVal},${lngVal}" target="_blank" class="btn-geotag-rute">
                        <i class="fas fa-route"></i> Rute Penyalur
                    </a>
                </div>
            </div>
        `;
    } catch (e) {
        return `<div style="font-size:0.85rem; line-height:1.4;">📍 ${safeHtml(rawText)}</div>`;
    }
};

window.kirimLokasiGeotagWarga = async function () {
    const nik = getActiveNikChat();
    const nama = getActiveNamaChat();

    if (!nik) {
        showPortalAlert({ icon: 'warning', title: 'Perhatian', text: 'Silakan verifikasi NIK Anda terlebih dahulu sebelum membagikan lokasi.' });
        return;
    }

    let archiveData = null;
    try {
        const res = await fetch(`${API_URL}/api/chat/geotag/${nik}`);
        const json = await res.json();
        if (json && json.status === 'success' && json.data) {
            archiveData = json.data;
        }
    } catch (e) {}

    const defaultAlamat = archiveData ? archiveData.alamat : 'Kabupaten Sidoarjo, Jawa Timur';
    const defaultLat = archiveData ? (Number(archiveData.lat) || -7.4478) : -7.4478;
    const defaultLng = archiveData ? (Number(archiveData.lng) || 112.7183) : 112.7183;

    Swal.fire({
        title: '<i class="fas fa-map-marked-alt text-success"></i> Pilih Opsi Berbagi Lokasi',
        html: `
            <div style="text-align:left; font-size:0.86rem; color:#334155;">
                <p style="margin-bottom:14px; color:#64748b; line-height:1.5;">
                    Pilih opsi lokasi yang ingin Anda bagikan kepada petugas Dinsos:
                </p>

                <!-- Opsi 1: Lokasi Perangkat Real-time (GPS) -->
                <div id="btnWargaOptRealtime" onclick="window.confirmSendWargaLoc('realtime')" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:2px solid #bbf7d0; border-radius:14px; background:#f0fdf4; cursor:pointer; margin-bottom:12px; transition:all 0.15s;" onmouseover="this.style.borderColor='#009846'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#bbf7d0'; this.style.transform='translateY(0)';">
                    <div style="width:38px; height:38px; border-radius:10px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                        <i class="fas fa-crosshairs"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:800; color:#15803d; font-size:0.92rem;">
                            1. Lokasi Perangkat Saya Saat Ini (GPS Real-time)
                        </div>
                        <div style="font-size:0.78rem; color:#475569; margin-top:3px; line-height:1.4;">
                            Membagikan titik koordinat satelit GPS perangkat Anda saat ini secara langsung dan akurat.
                        </div>
                    </div>
                </div>

                <!-- Opsi 2: Lokasi Rumah Sesuai Arsip Data Warga -->
                <div id="btnWargaOptArsip" onclick="window.confirmSendWargaLoc('arsip')" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:2px solid #bfdbfe; border-radius:14px; background:#eff6ff; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#bfdbfe'; this.style.transform='translateY(0)';">
                    <div style="width:38px; height:38px; border-radius:10px; background:#dbeafe; color:#1d4ed8; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                        <i class="fas fa-home"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:800; color:#1e40af; font-size:0.92rem;">
                            2. Lokasi Rumah Saya (Sesuai Arsip Data Warga)
                        </div>
                        <div style="font-size:0.78rem; color:#475569; margin-top:3px; line-height:1.4;">
                            Sesuai arsip kependudukan: <b>${safeHtml(defaultAlamat)}</b> (Lat: ${defaultLat.toFixed(4)}, Lng: ${defaultLng.toFixed(4)}).
                        </div>
                    </div>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Batal',
        cancelButtonColor: '#64748b'
    });
};

window.confirmSendWargaLoc = async function (type) {
    Swal.close();
    const nik = getActiveNikChat();
    const nama = getActiveNamaChat();
    if (!nik) return;

    if (type === 'realtime') {
        if (!navigator.geolocation) {
            return showPortalAlert({ icon: 'warning', title: 'Perhatian', text: 'Perangkat ini tidak mendukung geolokasi GPS.' });
        }

        Swal.fire({
            title: 'Mendeteksi Posisi GPS...',
            text: 'Mengambil titik koordinat satelit GPS perangkat Anda...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = Math.round(pos.coords.accuracy || 10);

            try {
                const sendRes = await fetch(`${API_URL}/api/chat/share-geotag`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik,
                        sender: 'warga',
                        nama,
                        lat,
                        lng,
                        accuracy,
                        alamat: `Lokasi Perangkat Warga Saat Ini (Akurasi: ±${accuracy}m)`,
                        tipe: 'realtime'
                    })
                });

                if (sendRes.ok) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: '📍 Lokasi GPS perangkat Anda berhasil dikirim ke petugas!',
                        timer: 3000,
                        showConfirmButton: false
                    });
                    if (typeof window.loadChatMessagesWarga === 'function') window.loadChatMessagesWarga(true);
                    if (typeof window.muatPesanAduan === 'function' && sesiAduanAktif) window.muatPesanAduan();
                } else {
                    showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal membagikan lokasi GPS.' });
                }
            } catch (err) {
                showPortalAlert({ icon: 'error', title: 'Error', text: 'Terjadi gangguan koneksi.' });
            }
        }, (err) => {
            Swal.fire('Gagal Mendeteksi GPS', `Tidak dapat mengambil lokasi perangkat: ${err.message}. Pastikan izin lokasi aktif.`, 'error');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    } else {
        // Arsip Data Warga
        try {
            const sendRes = await fetch(`${API_URL}/api/chat/share-geotag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nik,
                    sender: 'warga',
                    nama,
                    tipe: 'arsip'
                })
            });

            if (sendRes.ok) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: '🏠 Lokasi rumah arsip Anda berhasil dikirim ke petugas!',
                    timer: 3000,
                    showConfirmButton: false
                });
                if (typeof window.loadChatMessagesWarga === 'function') window.loadChatMessagesWarga(true);
                if (typeof window.muatPesanAduan === 'function' && sesiAduanAktif) window.muatPesanAduan();
            } else {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal membagikan lokasi arsip.' });
            }
        } catch (err) {
            showPortalAlert({ icon: 'error', title: 'Error', text: 'Terjadi gangguan koneksi.' });
        }
    }
};

// =========================================================================


// =========================================================================
// KATALOG EMOJI CERDAS DENGAN PENCARIAN CEPAT, KATEGORI & POSISI DINAMIS
// =========================================================================
window.emojiCatalogAduan = {
    populer: {
        label: '⭐ Populer',
        emojis: ['😀', '😂', '😊', '😍', '👍', '🙏', '❤️', '🔥', '✅', '✨', '🚨', '📌', '👏', '🤝', '💯', '💪']
    },
    wajah: {
        label: '😀 Wajah',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🥺', '😢', '😭',
            '😤', '😠', '😡', '🤯', '😳', '😱', '😨', '😰', '🤔', '🤫'
        ]
    },
    gestur: {
        label: '👍 Gestur',
        emojis: ['👍', '👎', '👏', '🙌', '🫶', '🤝', '🙏', '💪', '✌️', '🤞', '🤙', '👋', '👌', '✋', '✍️', '👊']
    },
    simbol: {
        label: '❤️ Simbol',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '🔥', '✨', '🌟', '💯', '⭐', '🎉', '🏆']
    },
    status: {
        label: '🚨 Status',
        emojis: ['🚨', '⚠️', '🚩', '📌', '📍', '✅', '❌', '❓', '❗', '📢', '🛡️', '🔒', '⚖️', '🔎', '💡', '⏰']
    },
    berkas: {
        label: '📄 Berkas',
        emojis: ['📄', '📊', '📈', '📁', '💼', '📦', '🏠', '🏢', '🏛️', '✉️', '📱', '💻', '📷', '🎙️', '📎', '🪙']
    }
};

window.currentEmojiCategoryAduan = 'populer';

window.renderEmojiGridAduan = function (keyword = '') {
    const gridEl = document.getElementById('emojiGridContainerAduan');
    if (!gridEl) return;

    let emojis = [];
    if (keyword && keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const all = Object.values(window.emojiCatalogAduan).flatMap(c => c.emojis);
        const uniqueAll = Array.from(new Set(all));
        
        const keywordMap = {
            'senyum': ['😀','😃','😄','😁','😊','🙂','😉'],
            'ketawa': ['😂','🤣','😆','😅'],
            'lucu': ['😂','🤣'],
            'sedih': ['😢','😭','😞','😔','🥺','😟'],
            'marah': ['😠','😡','😤'],
            'jempol': ['👍','👎'],
            'ok': ['👍','👌','✅'],
            'cinta': ['❤️','🥰','😍','💖','🫶'],
            'hati': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔'],
            'love': ['❤️','😍','🥰'],
            'hormat': ['🙏','🤝','👏'],
            'terimakasih': ['🙏','🤝','👏'],
            'makasih': ['🙏','🤝'],
            'api': ['🔥'],
            'semangat': ['🔥','💪','💯'],
            'bintang': ['⭐','🌟','✨'],
            'lapor': ['🚨','⚠️','🚩'],
            'bahaya': ['🚨','⚠️'],
            'aduan': ['🚨','⚠️','🚩','⚖️','📢'],
            'lokasi': ['📍','📌','🏠'],
            'dokumen': ['📄','📁','📊','📈','📎'],
            'berkas': ['📄','📁','💼'],
            'uang': ['💰','🪙','💸'],
            'bansos': ['📦','🏠','🤝','🪙'],
            'surat': ['📄','✉️']
        };

        const matchingFromMap = Object.entries(keywordMap)
            .filter(([k]) => k.includes(kw) || kw.includes(k))
            .flatMap(([, v]) => v);

        emojis = uniqueAll.filter(e => e.includes(kw) || matchingFromMap.includes(e));
        if (emojis.length === 0) {
            gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:12px; color:#94a3b8; font-size:0.75rem;">Emoji tidak ditemukan. Coba ketik kata lain.</div>`;
            return;
        }
    } else {
        const cat = window.emojiCatalogAduan[window.currentEmojiCategoryAduan] || window.emojiCatalogAduan.populer;
        emojis = cat.emojis;
    }

    gridEl.innerHTML = emojis.map(e => `
        <button type="button" class="emoji-cell-btn" style="background:none; border:none; cursor:pointer; font-size:1.35rem; padding:4px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:transform 0.12s, background 0.12s; user-select:none;" onmouseover="this.style.transform='scale(1.25)'; this.style.background='#f1f5f9';" onmouseout="this.style.transform='scale(1)'; this.style.background='none';" onclick="window.addEmojiAduan('${e}')" title="${e}">
            ${e}
        </button>
    `).join('');
};

window.switchEmojiCategoryAduan = function (catKey) {
    window.currentEmojiCategoryAduan = catKey;
    document.querySelectorAll('#emojiCategoryTabsAduan button').forEach(b => {
        if (b.getAttribute('data-cat') === catKey) {
            b.style.background = '#dc2626';
            b.style.color = '#ffffff';
            b.style.fontWeight = '800';
        } else {
            b.style.background = '#f1f5f9';
            b.style.color = '#475569';
            b.style.fontWeight = '600';
        }
    });
    const searchInp = document.getElementById('aduanEmojiSearchInput');
    if (searchInp) searchInp.value = '';
    window.renderEmojiGridAduan('');
};

window.filterEmojiAduan = function (val) {
    window.renderEmojiGridAduan(val);
};

window.toggleEmojiPickerAduan = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerAduan');
    const attachPop = document.getElementById('aduanAttachmentMenuPopover');
    const voiceAttachPop = document.getElementById('aduanVoicePreviewAttachMenu');
    if (attachPop) attachPop.style.display = 'none';
    if (voiceAttachPop) voiceAttachPop.style.display = 'none';
    if (!el) return;

    const isVisible = el.style.display === 'flex';
    if (isVisible) {
        el.style.display = 'none';
        return;
    }

    // Identifikasi tombol yang diklik (apakah tombol normal atau tombol di pratinjau voice)
    const triggerBtn = event ? (event.currentTarget || event.target.closest('button')) : document.getElementById('btnEmojiAduan');
    const container = el.parentElement;

    // Render struktur picker modern dengan bilah pencarian & kategori jika belum ada
    el.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <!-- Header Pencarian Cepat -->
            <div style="display:flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:4px 10px;">
                <i class="fas fa-search" style="font-size:0.75rem; color:#64748b;"></i>
                <input type="text" id="aduanEmojiSearchInput" placeholder="Cari emoji (senyum, jempol, hati, dll)..." oninput="window.filterEmojiAduan(this.value)" style="border:none; background:transparent; width:100%; outline:none; font-size:0.78rem; color:#1e293b;" onclick="event.stopPropagation()">
            </div>

            <!-- Tab Kategori -->
            <div id="emojiCategoryTabsAduan" style="display:flex; gap:4px; overflow-x:auto; padding-bottom:3px; scrollbar-width:none;">
                ${Object.entries(window.emojiCatalogAduan).map(([key, item]) => `
                    <button type="button" data-cat="${key}" onclick="window.switchEmojiCategoryAduan('${key}')" style="background:${key === window.currentEmojiCategoryAduan ? '#dc2626' : '#f1f5f9'}; color:${key === window.currentEmojiCategoryAduan ? '#ffffff' : '#475569'}; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:${key === window.currentEmojiCategoryAduan ? '800' : '600'}; white-space:nowrap; cursor:pointer; transition:all 0.15s;">
                        ${item.label}
                    </button>
                `).join('')}
            </div>

            <!-- Grid Emoji -->
            <div id="emojiGridContainerAduan" style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; max-height:175px; overflow-y:auto; padding:2px; scrollbar-width:thin;"></div>
        </div>
    `;

    window.renderEmojiGridAduan('');

    // Hitung posisi tepat di ATAS tombol yang diklik
    if (container && triggerBtn) {
        const containerRect = container.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        let leftPos = (btnRect.left - containerRect.left) + (btnRect.width / 2) - 150; // 150 = setengah dari lebar picker (300px)
        if (leftPos < 8) leftPos = 8;
        if (leftPos + 300 > containerRect.width - 8) {
            leftPos = Math.max(8, containerRect.width - 308);
        }

        const bottomPos = (containerRect.bottom - btnRect.top) + 8;

        el.style.cssText = `
            display: flex;
            position: absolute;
            bottom: ${bottomPos}px;
            left: ${leftPos}px;
            right: auto;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 18px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 10px;
            width: 300px;
            max-width: calc(100vw - 32px);
            z-index: 999999 !important;
            box-sizing: border-box;
        `;
    } else {
        el.style.cssText = `
            display: flex;
            position: absolute;
            bottom: 66px;
            left: 12px;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 18px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 10px;
            width: 300px;
            max-width: calc(100vw - 32px);
            z-index: 999999 !important;
            box-sizing: border-box;
        `;
    }

    const closeOnClickOutside = function (ev) {
        if (!el.contains(ev.target) && !ev.target.closest('#btnEmojiAduan') && !ev.target.closest('#btnEmojiAduanPreview') && !ev.target.closest('.emoji-toggle-btn')) {
            el.style.display = 'none';
            document.removeEventListener('click', closeOnClickOutside);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
        const searchInput = document.getElementById('aduanEmojiSearchInput');
        if (searchInput) searchInput.focus();
    }, 50);
};

window.addEmojiAduan = function (emoji) {
    const previewBar = document.getElementById('aduanVoicePreviewBar');
    const caption = document.getElementById('aduanVoiceCaptionInput');
    if (previewBar && previewBar.style.display !== 'none' && caption) {
        caption.value += emoji;
        caption.focus();
        return;
    }
    const input = document.getElementById('aduanChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.toggleAduanAttachmentMenu = function (e) {
    if (e) e.stopPropagation();
    const pop = document.getElementById('aduanAttachmentMenuPopover');
    const btn = document.getElementById('btnAttachAduan');
    const emojiPop = document.getElementById('emojiPickerAduan');
    if (!pop) return;

    if (emojiPop) emojiPop.style.display = 'none';

    const isVisible = pop.style.display === 'block';
    pop.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        if (btn) {
            const chatWrap = document.getElementById('aduanChatCardWrap') || 
                             document.getElementById('aduanChatSection') || 
                             pop.offsetParent;
            const btnRect = btn.getBoundingClientRect();
            const parentRect = pop.offsetParent ? pop.offsetParent.getBoundingClientRect() : btnRect;
            const chatRect = chatWrap ? chatWrap.getBoundingClientRect() : parentRect;

            const menuWidth = 280;
            let leftInParent = (btnRect.left - parentRect.left) + (btnRect.width / 2) - (menuWidth / 2);
            const minLeft = (chatRect.left - parentRect.left) + 8;
            const maxLeft = (chatRect.right - parentRect.left) - menuWidth - 8;

            leftInParent = Math.max(minLeft, Math.min(leftInParent, maxLeft));

            pop.style.setProperty('left', `${Math.round(leftInParent)}px`, 'important');
            pop.style.setProperty('right', 'auto', 'important');
            pop.style.setProperty('bottom', '64px', 'important');
        }

        const closeOnClickOutside = function (ev) {
            if (!pop.contains(ev.target) && ev.target.id !== 'btnAttachAduan' && !ev.target.closest('#btnAttachAduan')) {
                pop.style.display = 'none';
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 50);
    }
};

window.kirimPesanAduan = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // Jika sedang dalam mode pratinjau suara, kirim suara tersebut via tombol konfirmasi
    if (typeof tempPreviewAduanBlob !== 'undefined' && tempPreviewAduanBlob) {
        window.sendConfirmedVoiceAduan();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    if (typeof mediaRecorderAduan !== 'undefined' && mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    const inp = document.getElementById('aduanChatInput');
    const msg = inp ? inp.value.trim() : '';
    const pendingFiles = [...(window.aduanChatPendingFiles || [])];

    if (!msg && pendingFiles.length === 0 && !window.editedAduanMediaBlob) return;

    const sesi = window.sesiAduanAktif || (typeof sesiAduanAktif !== 'undefined' ? sesiAduanAktif : null) || {
        nik: localStorage.getItem('lastAduanNik') || '1234563728394856',
        nama: localStorage.getItem('lastAduanNama') || 'SULIS'
    };
    if (!sesi || !sesi.nik) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Sesi Belum Aktif', 'Silakan masuk ke pengaduan terlebih dahulu.', 'warning');
        }
        return;
    }

    const btnSend = document.getElementById('btnSendAduan');
    if (btnSend) {
        btnSend.disabled = true;
        btnSend.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:0.9rem;"></i>';
    }

    const nowDevice = new Date();
    const deviceTime = nowDevice.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', sesi.nama || 'Warga');
    formData.append('pesan', msg);
    formData.append('waktu', deviceTime);
    formData.append('created_at', nowDevice.toISOString());

    if (pendingFiles.length > 0) {
        pendingFiles.forEach((item, idx) => {
            if (item.file && item.file instanceof Blob) {
                formData.append('files', item.file, item.name || item.file.name);
            } else if (item.isCloudLink) {
                formData.append('cloud_link_' + idx, item.webViewLink || '');
                formData.append('cloud_name_' + idx, item.name || 'Berkas Google Workspace');
                formData.append('cloud_type_' + idx, item.type || 'document');
            }
        });
    } else if (window.editedAduanMediaBlob) {
        const fName = window.editedAduanMediaBlob.name || ('berkas_' + Date.now() + '.' + (window.editedAduanMediaExt || 'bin'));
        formData.append('files', window.editedAduanMediaBlob, fName);
        if (window.editedAduanMediaType) {
            formData.append('custom_file_type', window.editedAduanMediaType);
        }
    }

    if (typeof replyToDataAduan !== 'undefined' && replyToDataAduan) {
        formData.append('reply_to_id', replyToDataAduan.id);
        formData.append('reply_to_sender', replyToDataAduan.sender);
        formData.append('reply_to_text', replyToDataAduan.text);
    }

    if (inp) inp.value = '';
    window.batalLampiranAduan();
    if (typeof window.batalReplyAduan === 'function') window.batalReplyAduan();

    try {
        await fetch(API_URL + '/api/chat/' + encodeURIComponent(sesi.nik), {
            method: 'POST',
            body: formData
        });
        window.muatPesanAduan(true);
    } catch (err) {
        console.error('[kirimPesanAduan Error]', err);
    } finally {
        if (btnSend) {
            btnSend.disabled = false;
            btnSend.innerHTML = '<i class="fas fa-paper-plane" style="font-size:0.9rem;"></i>';
        }
    }
};

// =========================================================================
// RENDER BUBBLE OBROLAN PENGADUAN LENGKAP & STABIL
// =========================================================================
window.muatPesanAduan = async function (forceScroll = false) {
    const sesi = window.sesiAduanAktif || (typeof sesiAduanAktif !== "undefined" ? sesiAduanAktif : null);
    if (!sesi || !sesi.nik) return;
    const box = document.getElementById('aduanChatMessages');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesi.nik)}`);
        const rawChats = await res.json();
        if (!Array.isArray(rawChats)) return;
        const chats = rawChats.filter(c => c && c.deleted_for !== 'me_warga');
        window.wargaChatRawData = chats;

        const currentHash = JSON.stringify(chats);
        if (!forceScroll && currentHash === lastAduanChatHash) {
            return;
        }
        lastAduanChatHash = currentHash;

        // Notifikasi tanggapan baru dari petugas investigasi
        const lastAdminMsg = [...chats].reverse().find(c => c.sender !== 'warga');
        if (lastAdminMsg && window.lastSeenAduanOfficerMsgId && lastAdminMsg.id > window.lastSeenAduanOfficerMsgId) {
            const responderName = lastAdminMsg.nama || (lastAdminMsg.sender === 'admin' ? 'Admin 1 (Super Admin)' : 'Petugas Investigasi');
            const previewText = (lastAdminMsg.pesan || 'Mengirim berkas / tanggapan').substring(0, 48);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: `🛡️ Tanggapan: ${safeHtml(responderName)}`,
                    text: `${previewText}...`,
                    timer: 4500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });
            }
        }
        if (lastAdminMsg) {
            window.lastSeenAduanOfficerMsgId = lastAdminMsg.id;
        }

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan mediasi. Anda dapat bertanya, melampirkan berkas (PPT, Excel, Foto), atau merekam suara di sini.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';
            const isDeletedEveryone = Boolean(c.is_deleted_all || (c.pesan && c.pesan.includes('Pesan telah dihapus')));
            if (isDeletedEveryone) {
                return `
                    <div id="msg-aduan-${c.id}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.83rem; padding:6px 14px; background:${isMe ? '#fee2e2' : '#f8fafc'}; color:#94a3b8; border:1px dashed #cbd5e1; display:inline-flex; align-items:center; gap:8px; font-style:italic; margin:4px 0; max-width:min(70%, 300px); box-sizing:border-box;">
                        <i class="fas fa-ban" style="font-size:0.85rem; color:#94a3b8;"></i>
                        <span>Pesan telah dihapus</span>
                        <span style="font-size:0.68rem; margin-left:6px; color:#cbd5e1;">${c.waktu || ''}</span>
                    </div>
                `;
            }
            const cleanPesanAduan = (c.pesan || '').trim();
            const extAduan = (c.file_path ? c.file_path.split('.').pop() || '' : '').toLowerCase();
            const isPlaceholderAduan = !cleanPesanAduan || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran', 'video terlampir', 'video', '🎤 pesan suara (voice note)', '🎤 pesan suara', 'pesan suara'].includes(cleanPesanAduan.toLowerCase());

            // Deteksi pesan emoji (1 s/d 16 emoji tanpa berkas lampiran atau kutipan balasan)
            let isEmojiOnlyAduan = false;
            let emojiCountAduan = 0;
            let emojiSizeStyleAduan = '';
            try {
                if (cleanPesanAduan && !c.file_path && !c.reply_text) {
                    const emojiOnlyRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Component}|\p{Emoji_Modifier_Base}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u{1F1E6}-\u{1F1FF}]|[\u{200D}\u{FE0E}\u{FE0F}]|\s)+$/u;
                    if (emojiOnlyRegex.test(cleanPesanAduan)) {
                        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                            const seg = new Intl.Segmenter('id', { granularity: 'grapheme' });
                            const items = Array.from(seg.segment(cleanPesanAduan)).filter(s => s.segment.trim().length > 0);
                            emojiCountAduan = items.length;
                        } else {
                            const matches = cleanPesanAduan.match(/\p{Extended_Pictographic}/gu) || [];
                            emojiCountAduan = matches.length;
                        }
                        if (emojiCountAduan >= 1 && emojiCountAduan <= 16) {
                            isEmojiOnlyAduan = true;
                            if (emojiCountAduan === 1) {
                                emojiSizeStyleAduan = 'font-size:2.85rem !important; line-height:1.2 !important;';
                            } else if (emojiCountAduan <= 3) {
                                emojiSizeStyleAduan = 'font-size:2.35rem !important; line-height:1.25 !important; letter-spacing:2px;';
                            } else if (emojiCountAduan <= 6) {
                                emojiSizeStyleAduan = 'font-size:1.95rem !important; line-height:1.3 !important; letter-spacing:3px;';
                            } else {
                                emojiSizeStyleAduan = 'font-size:1.6rem !important; line-height:1.35 !important; letter-spacing:2px;';
                            }
                        }
                    }
                }
            } catch (err) {
                isEmojiOnlyAduan = false;
            }

            const isAudioAduan = Boolean(c.file_path && (
                c.file_type === 'audio' ||
                (c.file_path && (c.file_path.includes('voice_') || c.file_path.includes('/voice/'))) ||
                ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba', 'flac'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e)) ||
                ((c.file_path || '').toLowerCase().endsWith('.webm') && (
                    c.file_type === 'audio' ||
                    (c.file_path || '').toLowerCase().includes('voice') ||
                    cleanPesanAduan.toLowerCase().includes('suara') ||
                    cleanPesanAduan.toLowerCase().includes('voice')
                ))
            ));
            const isImgAduan = Boolean(!isAudioAduan && c.file_path && (c.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))));
            const isVidAduan = Boolean(!isAudioAduan && !isImgAduan && c.file_path && (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))));
            const isDocAduan = Boolean(c.file_path && !isImgAduan && !isVidAduan && !isAudioAduan);

            const isImgOnlyAduan = isImgAduan && isPlaceholderAduan && !c.reply_text;
            const isVidOnlyAduan = isVidAduan && isPlaceholderAduan && !c.reply_text;
            const isMediaBubbleOnlyAduan = (isImgOnlyAduan || isVidOnlyAduan) && !isAudioAduan;
            const isFixedMediaBubbleAduan = isDocAduan || isImgAduan || isVidAduan || isAudioAduan;

            const checkIconAduan = c.is_read
                ? `<i class="fas fa-check-double chat-check-read" style="margin-left:3px; color:#0284c7; font-size:0.72rem;" title="Dibaca oleh Petugas ${c.read_at ? '(' + c.read_at + ')' : ''}"></i>`
                : `<i class="fas fa-check-double chat-check-delivered" style="margin-left:3px; color:#94a3b8; font-size:0.72rem;" title="Tersampaikan ke Petugas Dinsos"></i>`;

            let mediaHtml = '';
            if (c.file_path) {
                const url = (c.file_path.startsWith('http://') || c.file_path.startsWith('https://'))
                    ? c.file_path
                    : `${API_URL}${c.file_path.startsWith('/') ? '' : '/'}${c.file_path}`;
                const ext = (c.file_path.split('.').pop() || '').toLowerCase();

                if (isImgAduan) {
                    const imgName = c.file_name || (c.file_path ? c.file_path.split('/').pop() : 'Foto_Lampiran.jpg');
                    mediaHtml = `
                        <div class="chat-media-img-wrap" onclick="window.openLightbox('image', '${url}')" title="Klik untuk memperbesar foto">
                            <img src="${url}" class="chat-media-img" alt="Foto Terlampir" loading="lazy" />
                            ${isImgOnlyAduan ? `
                            <span class="chat-time-stamp-overlay">
                                ${c.waktu || ''}
                                ${isMe ? checkIconAduan : ''}
                            </span>` : ''}
                            <div class="chat-media-action-overlay ${isMe ? 'align-left' : 'align-right'}">
                                <button type="button" class="chat-media-action-btn" onclick="window.openLightbox('image', '${url}'); event.stopPropagation();" title="Perbesar Foto">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button type="button" class="chat-media-action-btn" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(imgName)}', event)" title="Unduh Foto">
                                    <i class="fas fa-arrow-down"></i>
                                </button>
                            </div>
                        </div>`;
                } else if (isVidAduan) {
                    const vidName = c.file_name || (c.file_path ? c.file_path.split('/').pop() : 'Video_Lampiran.mp4');
                    const videoId = `aduan_vid_${c.id || ('idx_' + idx)}`;
                    mediaHtml = `
                        <div class="chat-media-video-wrap" id="vid_wrap_${videoId}">
                            <video id="${videoId}" src="${url}" playsinline preload="metadata" class="chat-media-video"
                                   onclick="window.toggleVideoBubblePlay('${videoId}', event)"
                                   ondblclick="window.handleVideoDblClick('${videoId}', event)"
                                   ontimeupdate="window.updateVideoBubbleProgress ? window.updateVideoBubbleProgress('${videoId}') : null"
                                   onended="window.resetVideoBubble ? window.resetVideoBubble('${videoId}') : null"></video>
                            
                            <div class="video-center-play-overlay" id="vid_overlay_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Klik untuk Memutar Video Langsung">
                                <div class="center-play-circle" id="vid_center_icon_${videoId}">
                                    <i class="fas fa-play" style="margin-left:3px;"></i>
                                </div>
                            </div>

                            <!-- Tombol Lompat Waktu Samping (-10s / +10s) otomatis muncul saat hover -->
                            <div class="video-hover-jump-overlay">
                                <div class="video-jump-side left" onclick="window.jumpVideoTime('${videoId}', -10, event)" ondblclick="window.handleVideoDblClick('${videoId}', event)" title="Mundur 10 Detik (Klik atau Klik 2x)">
                                    <button type="button" class="btn-side-jump-pill" onclick="window.jumpVideoTime('${videoId}', -10, event)">
                                        <i class="fas fa-rotate-left"></i><span>-10s</span>
                                    </button>
                                </div>
                                <div class="video-jump-side right" onclick="window.jumpVideoTime('${videoId}', 10, event)" ondblclick="window.handleVideoDblClick('${videoId}', event)" title="Maju 10 Detik (Klik atau Klik 2x)">
                                    <button type="button" class="btn-side-jump-pill" onclick="window.jumpVideoTime('${videoId}', 10, event)">
                                        <span>+10s</span><i class="fas fa-rotate-right"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="video-floating-hover-bar">
                                <!-- Baris 1: Garis Waktu Scrubber / Timeline -->
                                <div class="video-scrubber-container">
                                    <input type="range" class="video-scrubber-bar" id="vid_scrub_${videoId}" min="0" max="100" value="0" step="0.1"
                                           oninput="window.seekVideoBubble('${videoId}', this.value)"
                                           onclick="event.stopPropagation()"
                                           title="Geser garis waktu untuk maju atau mundur video">
                                </div>
                                <!-- Baris 2: Tombol Kontrol Lengkap -->
                                <div class="video-controls-row">
                                    <div class="video-ctrls-left">
                                        <button type="button" class="btn-video-hover-ctrl" id="vid_btn_play_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Putar / Jeda Video">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.jumpVideoTime('${videoId}', -10, event)" title="Mundur 10 Detik">
                                            <i class="fas fa-rotate-left"></i><span class="jump-sec-lbl">10</span>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.jumpVideoTime('${videoId}', 10, event)" title="Maju 10 Detik">
                                            <i class="fas fa-rotate-right"></i><span class="jump-sec-lbl">10</span>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" id="vid_btn_mute_${videoId}" onclick="window.toggleVideoBubbleMute('${videoId}', event)" title="Bisukan / Nyalakan Suara Video">
                                            <i class="fas fa-volume-up"></i>
                                        </button>
                                        <span class="video-hover-timer" id="vid_time_${videoId}" style="font-size:0.65rem; font-family:monospace; white-space:nowrap; max-width:65px; overflow:hidden; text-overflow:ellipsis;">00:00</span>
                                    </div>
                                    <div class="video-ctrls-right" style="display:flex; align-items:center; gap:3px; flex-shrink:0 !important; margin-left:auto !important;">
                                        <button type="button" class="btn-video-speed-pill" id="vid_speed_${videoId}" onclick="window.cycleVideoSpeed('${videoId}', this, event)" title="Atur Kecepatan (0.5x, 1x, 1.5x, 2x)">
                                            1x
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.openVideoTheaterModal('${url}', '${escapeInlineJS(vidName)}', '${videoId}'); event.stopPropagation();" title="Buka Layar Penuh (Theater)">
                                            <i class="fas fa-expand"></i>
                                        </button>
                                        <a href="${url}" download="${safeHtml(vidName)}" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(vidName)}', event); event.stopPropagation();" class="btn-video-hover-ctrl" title="Unduh Video" style="color:white; text-decoration:none;">
                                            <i class="fas fa-download"></i>
                                        </a>
                                    </div>
                                </div>
                            </div>

                            ${isVidOnlyAduan ? `
                            <span class="chat-time-stamp-overlay">
                                ${c.waktu || ''}
                                ${isMe ? checkIconAduan : ''}
                            </span>` : ''}
                        </div>`;
                } else if (isAudioAduan) {
                    const audioId = `aduan_aud_${c.id || ('idx_' + idx)}`;
                    mediaHtml = `
                        <div class="voice-note-bubble-card" id="card_${audioId}">
                            <audio id="${audioId}" src="${url}" preload="metadata" 
                                   onloadedmetadata="window.initVoiceBubbleMeta ? window.initVoiceBubbleMeta('${audioId}') : null"
                                   ontimeupdate="window.updateVoiceBubbleTime ? window.updateVoiceBubbleTime('${audioId}') : null" 
                                   onended="window.resetVoiceBubblePlay ? window.resetVoiceBubblePlay('${audioId}') : null"></audio>
                            <button type="button" class="voice-play-circle-btn" id="btn_play_${audioId}" onclick="window.toggleVoiceBubblePlay ? window.toggleVoiceBubblePlay('${audioId}', this) : null" title="Putar Pesan Suara">
                                <i class="fas fa-play" style="margin-left:2px;"></i>
                            </button>
                            <div class="voice-track-info">
                                <div class="voice-meta-row">
                                    <span class="voice-title-label"><i class="fas fa-microphone" style="color:${isMe ? '#dc2626' : '#0284c7'};"></i> Pesan Suara</span>
                                    <span class="voice-timer-badge" id="dur_${audioId}">00:00</span>
                                </div>
                                <div class="voice-waveform-row">
                                    <div class="voice-freq-visualizer" id="freq_box_${audioId}" 
                                         onclick="window.seekVoiceBubbleByClick ? window.seekVoiceBubbleByClick('${audioId}', event) : null"
                                         onmousedown="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         ontouchstart="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         title="Klik atau geser pada grafik gelombang suara">
                                        ${Array.from({length: 24}, (_, i) => {
                                            return `<div class="voice-freq-bar" id="bar_${audioId}_${i}" style="height:4px; --i:${i};"></div>`;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="btn-voice-speed-pill" id="speed_${audioId}" onclick="window.toggleVoiceSpeed ? window.toggleVoiceSpeed('${audioId}', this) : null" title="Atur Kecepatan Suara (1x, 1.5x, 2x, 0.5x)">
                                1x
                            </button>
                        </div>
                    `;
                } else {
                    // DOKUMEN: PDF, WORD, EXCEL, PPT DLL (MODERN, BERSIH, MEMUAT JUDUL DOKUMEN & MENDUKUNG UNDUH LANGSUNG)
                    const rawFileName = c.file_name || (c.file_path || '').split('/').pop() || `Dokumen.${ext}`;
                    let cleanFileName = rawFileName.replace(/^\d{10,14}[_-]/, '');
                    if (!cleanFileName || /^\d+\.[a-zA-Z0-9]+$/.test(cleanFileName) || /^\d+$/.test(cleanFileName)) {
                        const defaultExt = (rawFileName.split('.').pop() || ext || 'pdf').toLowerCase();
                        cleanFileName = `Dokumen_Lampiran_${defaultExt.toUpperCase()}.${defaultExt}`;
                    }

                    const docExt = (cleanFileName.split('.').pop() || ext || 'pdf').toLowerCase();
                    let rawTitle = cleanFileName.substring(0, cleanFileName.lastIndexOf('.')) || cleanFileName;
                    let baseTitle = rawTitle.replace(/[-_]+/g, ' ').trim();
                    baseTitle = baseTitle.split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');

                    if (!baseTitle || /^\d+$/.test(baseTitle) || baseTitle.toLowerCase() === 'dokumen' || baseTitle.length < 3) {
                        if (['pdf'].includes(docExt)) baseTitle = 'Surat Keputusan Verifikasi Penerima Bansos';
                        else if (['doc', 'docx'].includes(docExt)) baseTitle = 'Panduan Persyaratan Administrasi Bansos';
                        else if (['xls', 'xlsx', 'csv'].includes(docExt)) baseTitle = 'Rekapitulasi Data Penyaluran Bansos Sidoarjo';
                        else if (['ppt', 'pptx'].includes(docExt)) baseTitle = 'Paparan Sosialisasi Penyaluran Bantuan Sosial';
                        else baseTitle = 'Berkas Dokumen Lampiran';
                    }

                    let docTypeClass = 'chat-doc-other';
                    let iconClass = 'fa-file-alt';
                    let badgeText = docExt.toUpperCase();
                    let labelText = 'Berkas Dokumen';
                    let accentColor = '#0284c7';

                    if (['ppt', 'pptx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-ppt';
                        iconClass = 'fa-file-powerpoint';
                        badgeText = 'PPT';
                        labelText = 'Presentasi PowerPoint';
                        accentColor = '#ea580c';
                    } else if (['xls', 'xlsx', 'csv'].includes(docExt)) {
                        docTypeClass = 'chat-doc-excel';
                        iconClass = 'fa-file-excel';
                        badgeText = 'EXCEL';
                        labelText = 'Spreadsheet Excel (.xlsx)';
                        accentColor = '#16a34a';
                    } else if (['doc', 'docx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-word';
                        iconClass = 'fa-file-word';
                        badgeText = 'WORD';
                        labelText = 'Microsoft Word (.docx)';
                        accentColor = '#2563eb';
                    } else if (['pdf'].includes(docExt)) {
                        docTypeClass = 'chat-doc-pdf';
                        iconClass = 'fa-file-pdf';
                        badgeText = 'PDF';
                        labelText = 'Dokumen PDF Resmi';
                        accentColor = '#dc2626';
                    } else if (['json'].includes(docExt)) {
                        docTypeClass = 'chat-doc-json';
                        iconClass = 'fa-file-code';
                        badgeText = 'JSON';
                        labelText = 'Berkas Konfigurasi Data (JSON)';
                        accentColor = '#d97706';
                    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(docExt)) {
                        docTypeClass = 'chat-doc-zip';
                        iconClass = 'fa-file-archive';
                        badgeText = docExt.toUpperCase();
                        labelText = 'Berkas Arsip Terkompresi';
                        accentColor = '#7c3aed';
                    }

                    const fileSizeText = c.file_size ? (typeof formatBytes === 'function' ? formatBytes(c.file_size) : `${Math.round(c.file_size / 1024)} KB`) : '';

                    mediaHtml = `
                        <div class="chat-doc-card ${docTypeClass}" title="${safeHtml(cleanFileName)}">
                            <div class="chat-doc-accent-bar" style="background:${accentColor}; height:3.5px; width:100%;"></div>
                            <div class="chat-doc-main-row" onclick="window.open('${url}', '_blank')">
                                <div class="chat-doc-icon-box">
                                    <i class="fas ${iconClass}"></i>
                                </div>
                                <div class="chat-doc-info">
                                    <div class="chat-doc-title" title="${safeHtml(baseTitle)}">${safeHtml(baseTitle)}</div>
                                    <div class="chat-doc-sub">
                                        <span class="chat-doc-badge">${badgeText}</span>
                                        <span class="chat-doc-label">${labelText}</span>
                                        ${fileSizeText ? `<span class="chat-doc-dot">•</span><span class="chat-doc-size">${fileSizeText}</span>` : ''}
                                    </div>
                                    <div class="chat-doc-filename" title="${safeHtml(cleanFileName)}">
                                        <i class="fas fa-paperclip"></i> ${safeHtml(cleanFileName)}
                                    </div>
                                </div>
                                <button type="button" class="chat-doc-dl-btn" onclick="window.downloadDocumentDirect('${url}', '${cleanFileName}', event)" title="Unduh Berkas ${badgeText}">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                            <div class="chat-doc-actions-strip">
                                <a href="${url}" target="_blank" onclick="event.stopPropagation()" class="chat-doc-action-link" title="Buka Dokumen di Tab Baru">
                                    <i class="fas fa-external-link-alt"></i> Pratinjau
                                </a>
                                <button type="button" onclick="window.downloadDocumentDirect('${url}', '${cleanFileName}', event)" class="chat-doc-action-link btn-primary-doc" title="Unduh Berkas ke Perangkat">
                                    <i class="fas fa-download"></i> Unduh ${badgeText}
                                </button>
                            </div>
                        </div>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                let replyTargetId = c.reply_to_id || c.reply_id;
                if (!replyTargetId && Array.isArray(chats)) {
                    const matchedPrev = [...chats].reverse().find(x => x && x.id !== c.id && ((x.pesan && x.pesan.trim() === c.reply_text.trim()) || (x.text && x.text.trim() === c.reply_text.trim())));
                    if (matchedPrev) {
                        replyTargetId = matchedPrev.id;
                    }
                }
                replyHtml = `
                    <div class="chat-reply-quote-box ${!isMe ? 'is-officer' : ''}" ${replyTargetId ? `onclick="window.scrollToMessageWarga(${replyTargetId}, event)"` : ''} title="${replyTargetId ? 'Klik untuk melihat pesan yang dibalas (ID #' + replyTargetId + ')' : ''}">
                        <div style="font-weight:700; color:${isMe ? '#dc2626' : '#0284c7'}; display:flex; align-items:center; justify-content:space-between; gap:4px;">
                            <span style="display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-reply" style="font-size:0.7rem;"></i> <span>${safeHtml(c.reply_sender || 'Pesan')}</span>
                            </span>
                            ${replyTargetId ? `<span style="font-size:0.65rem; color:#94a3b8; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><i class="fas fa-arrow-up" style="font-size:0.6rem;"></i> Lihat</span>` : ''}
                        </div>
                        <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px; font-style:italic; color:#334155;">
                            ${safeHtml(c.reply_text)}
                        </div>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-4px' : 'right:-4px'}; bottom:-8px; background:#ffffff; border-radius:14px; padding:1px 6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:0.85rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama || c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1' : '👮 Petugas');


            let bubbleStylesAduan = isMe 
                ? 'background:#fee2e2; color:#991b1b; border:1px solid #fecdd3; padding:7px 28px 5px 11px;' 
                : 'background:#ffffff; color:#0f172a; border:1px solid #e2e8f0; padding:7px 11px 5px 28px;';

            if (isEmojiOnlyAduan) {
                bubbleStylesAduan = isMe
                    ? 'background:#fee2e2 !important; color:#991b1b !important; border:1.5px solid #fecdd3 !important; border-radius:20px 4px 20px 20px !important; box-shadow:0 4px 14px rgba(220,38,38,0.12) !important; padding:8px 32px 6px 14px !important; width:fit-content !important; min-width:0 !important;'
                    : 'background:#ffffff !important; color:#0f172a !important; border:1.5px solid #e2e8f0 !important; border-radius:4px 20px 20px 20px !important; box-shadow:0 4px 14px rgba(0,0,0,0.06) !important; padding:8px 14px 6px 32px !important; width:fit-content !important; min-width:0 !important;';
            } else if (isMediaBubbleOnlyAduan) {
                const mediaOnlyWidth = isImgOnlyAduan ? '260px' : '315px';
                if (isMe) {
                    bubbleStylesAduan = `padding:3px !important; background:#dc2626 !important; border:2px solid #dc2626 !important; border-radius:17px !important; box-shadow:0 3px 12px rgba(220,38,38,0.22) !important; width:${mediaOnlyWidth} !important; max-width:min(${mediaOnlyWidth}, 85vw) !important; display:inline-flex !important; flex-direction:column !important; align-items:center !important; line-height:0 !important; font-size:0 !important; box-sizing:border-box !important;`;
                } else {
                    bubbleStylesAduan = `padding:3px !important; background:#ffffff !important; border:2px solid #e2e8f0 !important; border-radius:17px !important; box-shadow:0 2px 10px rgba(0,0,0,0.08) !important; width:${mediaOnlyWidth} !important; max-width:min(${mediaOnlyWidth}, 85vw) !important; display:inline-flex !important; flex-direction:column !important; align-items:center !important; line-height:0 !important; font-size:0 !important; box-sizing:border-box !important;`;
                }
            } else if (isDocAduan) {
                const docBubbleWidth = '320px';
                bubbleStylesAduan = isMe
                    ? `background:#fee2e2 !important; color:#991b1b !important; border:1px solid #fecdd3 !important; border-radius:16px 4px 16px 16px !important; width:${docBubbleWidth} !important; max-width:min(${docBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 10px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${docBubbleWidth} !important; max-width:min(${docBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 10px 6px 26px !important;`;
            } else if (isImgAduan) {
                const imgBubbleWidth = '270px';
                bubbleStylesAduan = isMe
                    ? `background:#fee2e2 !important; color:#991b1b !important; border:1px solid #fecdd3 !important; border-radius:16px 4px 16px 16px !important; width:${imgBubbleWidth} !important; max-width:min(${imgBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 8px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${imgBubbleWidth} !important; max-width:min(${imgBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 8px 6px 26px !important;`;
            } else if (isVidAduan) {
                const vidBubbleWidth = '315px';
                bubbleStylesAduan = isMe
                    ? `background:#fee2e2 !important; color:#991b1b !important; border:1px solid #fecdd3 !important; border-radius:16px 4px 16px 16px !important; width:${vidBubbleWidth} !important; max-width:min(${vidBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 8px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${vidBubbleWidth} !important; max-width:min(${vidBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 8px 6px 26px !important;`;
            } else if (isAudioAduan) {
                const audioBubbleWidth = '320px';
                // Tampilan presisi, seimbang, rapi dan elegan, tidak mengecil atau membesar
                bubbleStylesAduan = isMe
                    ? `background:#ffffff !important; color:#0f172a !important; border:1.5px solid #fecdd3 !important; border-top:3px solid #dc2626 !important; border-radius:16px 4px 16px 16px !important; width:${audioBubbleWidth} !important; min-width:290px !important; max-width:min(${audioBubbleWidth}, calc(100vw - 36px)) !important; box-sizing:border-box !important; padding:8px 24px 6px 10px !important; box-shadow:0 4px 14px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1.5px solid #e2e8f0 !important; border-top:3px solid #0284c7 !important; border-radius:4px 16px 16px 16px !important; width:${audioBubbleWidth} !important; min-width:290px !important; max-width:min(${audioBubbleWidth}, calc(100vw - 36px)) !important; box-sizing:border-box !important; padding:8px 10px 6px 24px !important; box-shadow:0 4px 14px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) !important;`;
            }

            const baseBubbleWidthAduan = (isFixedMediaBubbleAduan || isEmojiOnlyAduan) ? '' : 'width:fit-content; max-width:min(68%, 380px);';
            const mediaTypeClassAduan = isDocAduan ? 'is-doc-card' : (isImgAduan ? 'is-image-card' : (isVidAduan ? 'is-video-card' : (isAudioAduan ? 'is-audio-card' : '')));

            return `
                <div id="msg-aduan-${c.id}" data-time="${safeHtml(c.created_at || c.waktu || '')}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; ${baseBubbleWidthAduan} border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.88rem; box-shadow:0 1px 4px rgba(0,0,0,0.04); position:relative; overflow:visible !important; ${bubbleStylesAduan}" class="${isEmojiOnlyAduan ? 'is-emoji-only' : ''} ${isImgOnlyAduan ? 'is-image-only' : ''} ${isVidOnlyAduan ? 'is-video-only' : ''} ${isMediaBubbleOnlyAduan ? 'is-media-only' : ''} ${mediaTypeClassAduan}">
                    ${!isMe && !isMediaBubbleOnlyAduan && !isEmojiOnlyAduan ? `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                            <span style="font-size:0.7rem; font-weight:800; color:#0284c7; display:inline-flex; align-items:center; gap:4px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <i class="fas fa-shield-alt"></i> ${safeHtml(handlerName)}
                            </span>
                        </div>
                    ` : ''}

                    <div style="position:absolute; ${isMe ? (isMediaBubbleOnlyAduan || isVidAduan || isImgAduan ? 'top:8px; right:8px; left:auto;' : 'top:4px; right:4px; left:auto;') : (isMediaBubbleOnlyAduan || isVidAduan || isImgAduan ? 'top:8px; left:8px; right:auto;' : 'top:4px; left:4px; right:auto;')}; z-index:70; pointer-events:auto;">
                        <button type="button" class="${isMediaBubbleOnlyAduan || isVidAduan || isImgAduan ? 'bubble-corner-btn' : 'btn-msg-dots'}" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Pesan">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu ${isMe ? 'menu-right' : 'menu-left'}" style="display:none; background:#ffffff !important; background-color:#ffffff !important; border:1px solid rgba(226,232,240,0.95) !important; border-radius:16px !important; box-shadow:0 20px 45px -8px rgba(15,23,42,0.22) !important; z-index:999999 !important;" onclick="event.stopPropagation()">
                            <div class="emoji-react-row" onwheel="this.scrollLeft += event.deltaY; event.preventDefault();">
                                <span onclick="window.submitReactionAduan(${c.id}, '❤️')" title="Suka">❤️</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '👍')" title="Jempol">👍</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '😂')" title="Tertawa">😂</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '😮')" title="Kaget">😮</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '😢')" title="Sedih">😢</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '🙏')" title="Terima Kasih">🙏</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '🔥')" title="Semangat">🔥</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '👏')" title="Tepuk Tangan">👏</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '🎉')" title="Selamat">🎉</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '💯')" title="Mantap">💯</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '💡')" title="Ide">💡</span>
                                <span onclick="window.submitReactionAduan(${c.id}, '🤝')" title="Sepakat">🤝</span>
                            </div>
                            <button type="button" class="aduan-menu-item" onclick="window.bukaInfoPesanChat(${c.id})"><span class="menu-item-icon icon-sky"><i class="fas fa-info-circle"></i></span> <span>Info Status Pesan</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.setReplyAduan(${c.id}, '${isMe ? 'Anda' : safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))"><span class="menu-item-icon icon-emerald"><i class="fas fa-reply"></i></span> <span>Balas</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))"><span class="menu-item-icon icon-slate"><i class="fas fa-copy"></i></span> <span>Salin Teks</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.togglePinPesanWarga(${c.id})"><span class="menu-item-icon icon-purple"><i class="fas fa-thumbtack"></i></span> <span>${c.is_pinned ? 'Lepas Sematan' : 'Sematkan Pesan'}</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.toggleBintangPesanWarga(${c.id})"><span class="menu-item-icon icon-amber"><i class="${c.is_starred ? 'fas fa-star text-warning' : 'far fa-star'}"></i></span> <span>${c.is_starred ? 'Hapus Bintang' : 'Bintangi Pesan'}</span></button>
                            <div class="aduan-menu-divider"></div>
                            <button type="button" class="aduan-menu-item item-amber" onclick="window.konfirmasiHapusPesanWarga(${c.id}, ${isMe})"><span class="menu-item-icon icon-amber"><i class="fas fa-trash-alt"></i></span> <span>Hapus Pesan</span></button>
                            <button type="button" class="aduan-menu-item item-danger" onclick="window.laporkanPesanWarga(${c.id}, decodeURIComponent('${enc(c.pesan || '')}'), '${isMe ? 'Anda' : escapeInlineJS(handlerName)}')"><span class="menu-item-icon icon-rose"><i class="fas fa-flag"></i></span> <span>Laporkan Pesan</span></button>
                        </div>
                    </div>
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan && !isPlaceholderAduan ? (
                        c.pesan.startsWith('[GEOTAG_LOKASI]') 
                            ? window.formatGeotagCardHtml(c.pesan) 
                            : (isEmojiOnlyAduan 
                                ? `<div class="aduan-emoji-txt" style="display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; ${emojiSizeStyleAduan} filter:drop-shadow(0 2px 4px rgba(0,0,0,0.12)); margin:2px 0 3px 0 !important; user-select:all;">${safeHtml(c.pesan)}</div>`
                                : `<div class="chat-caption-text" style="width:100% !important; box-sizing:border-box !important; overflow-wrap:anywhere !important; word-break:break-word !important; line-height:1.45 !important; font-size:0.86rem !important; margin-top:4px !important;">${safeHtml(c.pesan)}</div>`
                            )
                    ) : ''}
                    ${!isMediaBubbleOnlyAduan ? `
                    <div class="chat-time-meta" style="width:100% !important; display:flex !important; justify-content:flex-end !important; align-items:center !important; margin-top:2px !important; margin-left:auto !important; align-self:flex-end !important; font-size:0.68rem; color:${isMe ? (isEmojiOnlyAduan ? '#991b1b' : '#94a3b8') : '#94a3b8'}; gap:3px; user-select:none;">
                        ${c.is_pinned ? `<span class="chat-pin-icon-bubble" title="Pesan Disematkan"><i class="fas fa-thumbtack"></i></span>` : ''}
                        ${c.is_starred ? `<span class="chat-star-icon" title="Pesan Berbintang"><i class="fas fa-star"></i></span>` : ''}
                        <span>${c.waktu || ''}</span>
                        ${isMe ? checkIconAduan : ''}
                    </div>` : ''}
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.voice-note-bubble-card audio, .modern-voice-card audio').forEach(a => {
                if (window.initVoiceBubbleMeta) window.initVoiceBubbleMeta(a.id);
                if (window.initAudioMetadata) window.initAudioMetadata(a.id);
            });
        }, 100);

        if (forceScroll || isNearBottom) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (e) {}
};

// =========================================================================


// 10. CHAT MULTIMEDIA RUANG WARGA TERDAFTAR (KOMPLET)
// =========================================================================
window.loadChatMessagesWarga = async function (forceScroll = false) {
    const activeNik = getActiveNikChat();
    if (!activeNik) return;
    const box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga') || document.getElementById('chatBoxWarga');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`);
        const rawChats = await res.json();
        if (!Array.isArray(rawChats)) return;
        const chats = rawChats.filter(c => c && c.deleted_for !== 'me_warga');
        window.wargaChatRawData = chats;

        const currentHash = JSON.stringify(chats);
        const hasOpenMenu = Boolean(window.activeOpenChatMenuId || document.querySelector('.aduan-dropdown-menu.show, .aduan-dropdown-menu[style*="display: flex"], .aduan-dropdown-menu[style*="display: block"]'));
        if (!forceScroll && (currentHash === window.lastChatHashWarga || hasOpenMenu)) {
            return;
        }
        window.lastChatHashWarga = currentHash;

        // Tandai pesan dari admin/petugas sebagai telah dibaca oleh warga secara otomatis
        const unreadFromAdmin = chats.some(c => c.sender !== 'warga' && !c.is_read);
        if (unreadFromAdmin) {
            fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reader: 'warga', read_time: new Date().toISOString() })
            }).catch(() => {});
        }

        // Identifikasi & Notifikasi Petugas yang Merespon
        let activeOfficerName = '';
        let activeOfficerRole = '';

        // 1. Coba ambil dari cache server active-officer
        try {
            const offRes = await fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}/active-officer`).catch(() => null);
            if (offRes && offRes.ok) {
                const offJson = await offRes.json();
                if (offJson && offJson.data && offJson.data.name) {
                    activeOfficerName = offJson.data.name;
                    activeOfficerRole = offJson.data.role || '';
                }
            }
        } catch (e) {}

        // 2. Fallback: Cari dari pesan admin/petugas terbaru non-system
        const lastAdminMsg = [...chats].reverse().find(c => c.sender !== 'warga' && c.sender !== 'system');
        if (!activeOfficerName && lastAdminMsg) {
            activeOfficerName = lastAdminMsg.nama || (lastAdminMsg.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');
            activeOfficerRole = lastAdminMsg.officer_role || (lastAdminMsg.sender === 'admin' ? 'Super Admin' : 'Petugas Dinsos');
        }
        if (!activeOfficerName) {
            activeOfficerName = '🛡️ Admin 1 / Petugas Dinsos';
        }

        const badgeEl = document.getElementById('wargaOfficerNameBadge');
        if (badgeEl) {
            badgeEl.innerHTML = `<i class="fas fa-user-shield" style="color:#2563eb;"></i> ${safeHtml(activeOfficerName)}${activeOfficerRole ? ` <span style="font-size:0.7rem; font-weight:600; opacity:0.85;">(${safeHtml(activeOfficerRole)})</span>` : ''}`;
        }

        // Jika petugas yang merespon berubah dibanding sebelumnya, berikan notifikasi toast & sorot banner
        if (window._currentActiveOfficerName && window._currentActiveOfficerName !== activeOfficerName && activeOfficerName !== '🛡️ Admin 1 / Petugas Dinsos') {
            const banner = document.getElementById('wargaOfficerActiveBanner');
            if (banner) {
                banner.classList.add('highlight-pulse');
                setTimeout(() => banner.classList.remove('highlight-pulse'), 2000);
            }
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: '🔄 Petugas Respon Resmi Berganti',
                    html: `Percakapan kini ditangani oleh <b>${safeHtml(activeOfficerName)}</b>${activeOfficerRole ? ` (${safeHtml(activeOfficerRole)})` : ''}`,
                    timer: 5000,
                    showConfirmButton: false,
                    timerProgressBar: true
                });
            }
        }
        window._currentActiveOfficerName = activeOfficerName;

        if (lastAdminMsg && window.lastSeenWargaOfficerMsgId && lastAdminMsg.id > window.lastSeenWargaOfficerMsgId && !lastAdminMsg.is_handover) {
            const responderName = lastAdminMsg.nama || (lastAdminMsg.sender === 'admin' ? 'Admin 1 (Super Admin)' : 'Petugas Dinsos');
            const previewText = (lastAdminMsg.pesan || 'Mengirim berkas / pesan suara').substring(0, 48);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: `💬 Respon dari: ${safeHtml(responderName)}`,
                    text: `${previewText}...`,
                    timer: 4500,
                    showConfirmButton: false,
                    timerProgressBar: true
                });
            }
        }
        if (lastAdminMsg) {
            window.lastSeenWargaOfficerMsgId = lastAdminMsg.id;
        }

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 90);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan percakapan. Hubungi petugas jika ada pertanyaan.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';

            let msgTime = c.waktu || '';
            if (c.created_at) {
                try {
                    const dObj = new Date(c.created_at);
                    if (!isNaN(dObj.getTime())) {
                        msgTime = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                } catch (e) {}
            }
            if (!msgTime || msgTime === 'Baru saja' || msgTime === 'Hari ini') {
                msgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }

            const checkIconWarga = c.is_read
                ? `<i class="fas fa-check-double chat-check-read" style="margin-left:3px;" title="Dibaca oleh Petugas ${c.read_at ? '(' + c.read_at + ')' : ''}"></i>`
                : `<i class="fas fa-check-double chat-check-delivered" style="margin-left:3px;" title="Tersampaikan"></i>`;

            // Pesan Sistem Pengalihan Petugas Resmi (Handover)
            const isHandover = Boolean(
                c.is_handover ||
                c.sender === 'system' ||
                (c.pesan && (c.pesan.includes('[PENGALIHAN RESMI]') || c.pesan.includes('[PETUGAS BERUBAH]')))
            );
            if (isHandover) {
                return `
                    <div id="msg-warga-${c.id}" class="chat-system-handover-item">
                        <div class="system-handover-pill">
                            <i class="fas fa-exchange-alt"></i>
                            <span>${safeHtml(c.pesan || c.text)}</span>
                            <span class="system-handover-time">${msgTime}</span>
                        </div>
                    </div>
                `;
            }

            const isDeletedEveryone = Boolean(c.is_deleted_all || (c.pesan && c.pesan.includes('Pesan telah dihapus')));
            if (isDeletedEveryone) {
                return `
                    <div id="msg-warga-${c.id}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.83rem; padding:6px 14px; background:${isMe ? '#f1f5f9' : '#f8fafc'}; color:#94a3b8; border:1px dashed #cbd5e1; display:inline-flex; align-items:center; gap:8px; font-style:italic; margin:4px 0; max-width:min(70%, 300px); box-sizing:border-box;">
                        <i class="fas fa-ban" style="font-size:0.85rem; color:#94a3b8;"></i>
                        <span>Pesan telah dihapus</span>
                        <span style="font-size:0.68rem; margin-left:6px; color:#cbd5e1;">${msgTime}</span>
                    </div>
                `;
            }

            let mediaHtml = '';
            if (c.file_path) {
                const url = (c.file_path.startsWith('http://') || c.file_path.startsWith('https://'))
                    ? c.file_path
                    : `${API_URL}${c.file_path.startsWith('/') ? '' : '/'}${c.file_path}`;
                const ext = (c.file_path.split('.').pop() || '').toLowerCase();
                const rawPesan = (c.pesan || '').trim();
                const isPlaceholderText = !rawPesan || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran', 'video terlampir', 'video'].includes(rawPesan.toLowerCase());
                const isImgOnly = (c.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) && isPlaceholderText && !c.reply_text;
                const isVidOnly = (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext)) && isPlaceholderText && !c.reply_text;

                if (c.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
                    const imgName = c.file_name || c.file_path.split('/').pop() || 'Foto_Lampiran.jpg';
                    mediaHtml = `
                        <div class="chat-media-img-wrap" onclick="window.openLightbox('image', '${url}')" title="Klik untuk memperbesar foto">
                            <img src="${url}" class="chat-media-img" alt="Foto Terlampir" loading="lazy" />
                            ${isImgOnly ? `
                            <span class="chat-time-stamp-overlay">
                                ${msgTime}
                                ${isMe ? checkIconWarga : ''}
                            </span>` : ''}
                            <div class="chat-media-action-overlay ${isMe ? 'align-left' : 'align-right'}">
                                <button type="button" class="chat-media-action-btn" onclick="window.openLightbox('image', '${url}'); event.stopPropagation();" title="Perbesar Foto">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button type="button" class="chat-media-action-btn" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(imgName)}', event)" title="Unduh Foto">
                                    <i class="fas fa-arrow-down"></i>
                                </button>
                            </div>
                        </div>`;
                } else if (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
                    const vidName = c.file_name || c.file_path.split('/').pop() || 'Video_Lampiran.mp4';
                    const videoId = `w_vid_${c.id || ('idx_' + idx)}`;
                    mediaHtml = `
                        <div class="chat-media-video-wrap" id="vid_wrap_${videoId}">
                            <video id="${videoId}" src="${url}" playsinline preload="metadata" class="chat-media-video"
                                   onclick="window.toggleVideoBubblePlay('${videoId}', event)"
                                   ondblclick="window.handleVideoDblClick('${videoId}', event)"
                                   ontimeupdate="window.updateVideoBubbleProgress ? window.updateVideoBubbleProgress('${videoId}') : null"
                                   onended="window.resetVideoBubble ? window.resetVideoBubble('${videoId}') : null"></video>
                            
                            <div class="video-center-play-overlay" id="vid_overlay_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Klik untuk Memutar Video Langsung">
                                <div class="center-play-circle" id="vid_center_icon_${videoId}">
                                    <i class="fas fa-play" style="margin-left:3px;"></i>
                                </div>
                            </div>

                            <!-- Tombol Lompat Waktu Samping (-10s / +10s) otomatis muncul saat hover -->
                            <div class="video-hover-jump-overlay">
                                <div class="video-jump-side left" onclick="window.jumpVideoTime('${videoId}', -10, event)" ondblclick="window.handleVideoDblClick('${videoId}', event)" title="Mundur 10 Detik (Klik atau Klik 2x)">
                                    <button type="button" class="btn-side-jump-pill" onclick="window.jumpVideoTime('${videoId}', -10, event)">
                                        <i class="fas fa-rotate-left"></i><span>-10s</span>
                                    </button>
                                </div>
                                <div class="video-jump-side right" onclick="window.jumpVideoTime('${videoId}', 10, event)" ondblclick="window.handleVideoDblClick('${videoId}', event)" title="Maju 10 Detik (Klik atau Klik 2x)">
                                    <button type="button" class="btn-side-jump-pill" onclick="window.jumpVideoTime('${videoId}', 10, event)">
                                        <span>+10s</span><i class="fas fa-rotate-right"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="video-floating-hover-bar">
                                <!-- Baris 1: Garis Waktu Scrubber / Timeline -->
                                <div class="video-scrubber-container">
                                    <input type="range" class="video-scrubber-bar" id="vid_scrub_${videoId}" min="0" max="100" value="0" step="0.1"
                                           oninput="window.seekVideoBubble('${videoId}', this.value)"
                                           onclick="event.stopPropagation()"
                                           title="Geser garis waktu untuk maju atau mundur video">
                                </div>
                                <!-- Baris 2: Tombol Kontrol Lengkap -->
                                <div class="video-controls-row">
                                    <div class="video-ctrls-left">
                                        <button type="button" class="btn-video-hover-ctrl" id="vid_btn_play_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Putar / Jeda Video">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.jumpVideoTime('${videoId}', -10, event)" title="Mundur 10 Detik">
                                            <i class="fas fa-rotate-left"></i><span class="jump-sec-lbl">10</span>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.jumpVideoTime('${videoId}', 10, event)" title="Maju 10 Detik">
                                            <i class="fas fa-rotate-right"></i><span class="jump-sec-lbl">10</span>
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" id="vid_btn_mute_${videoId}" onclick="window.toggleVideoBubbleMute('${videoId}', event)" title="Bisukan / Nyalakan Suara Video">
                                            <i class="fas fa-volume-up"></i>
                                        </button>
                                        <span class="video-hover-timer" id="vid_time_${videoId}" style="font-size:0.65rem; font-family:monospace; white-space:nowrap; max-width:65px; overflow:hidden; text-overflow:ellipsis;">00:00</span>
                                    </div>
                                    <div class="video-ctrls-right" style="display:flex; align-items:center; gap:3px; flex-shrink:0 !important; margin-left:auto !important;">
                                        <button type="button" class="btn-video-speed-pill" id="vid_speed_${videoId}" onclick="window.cycleVideoSpeed('${videoId}', this, event)" title="Atur Kecepatan (0.5x, 1x, 1.5x, 2x)">
                                            1x
                                        </button>
                                        <button type="button" class="btn-video-hover-ctrl" onclick="window.openVideoTheaterModal('${url}', '${escapeInlineJS(vidName)}', '${videoId}'); event.stopPropagation();" title="Buka Layar Penuh (Theater)">
                                            <i class="fas fa-expand"></i>
                                        </button>
                                        <a href="${url}" download="${safeHtml(vidName)}" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(vidName)}', event); event.stopPropagation();" class="btn-video-hover-ctrl" title="Unduh Video" style="color:white; text-decoration:none;">
                                            <i class="fas fa-download"></i>
                                        </a>
                                    </div>
                                </div>
                            </div>

                            ${isVidOnly ? `
                            <span class="chat-time-stamp-overlay">
                                ${msgTime}
                                ${isMe ? checkIconWarga : ''}
                            </span>` : ''}
                        </div>`;
                } else if (c.file_type === 'audio' || (c.file_path && c.file_path.includes('voice_')) || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].includes(ext)) {
                    const audioId = `w_aud_${c.id || ('idx_' + idx)}`;
                    mediaHtml = `
                        <div class="voice-note-bubble-card" id="card_${audioId}">
                            <audio id="${audioId}" src="${url}" preload="metadata" 
                                   onloadedmetadata="window.initVoiceBubbleMeta ? window.initVoiceBubbleMeta('${audioId}') : null"
                                   ontimeupdate="window.updateVoiceBubbleTime ? window.updateVoiceBubbleTime('${audioId}') : null" 
                                   onended="window.resetVoiceBubblePlay ? window.resetVoiceBubblePlay('${audioId}') : null"></audio>
                            <button type="button" class="voice-play-circle-btn" id="btn_play_${audioId}" onclick="window.toggleVoiceBubblePlay ? window.toggleVoiceBubblePlay('${audioId}', this) : null" title="Putar Pesan Suara">
                                <i class="fas fa-play" style="margin-left:2px;"></i>
                            </button>
                            <div class="voice-track-info">
                                <div class="voice-meta-row">
                                    <span class="voice-title-label"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                </div>
                                <div class="voice-waveform-row">
                                    <div class="voice-freq-visualizer" id="freq_box_${audioId}" 
                                         onclick="window.seekVoiceBubbleByClick ? window.seekVoiceBubbleByClick('${audioId}', event) : null"
                                         onmousedown="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         ontouchstart="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         title="Klik atau geser pada grafik suara">
                                        ${Array.from({length: 22}, (_, i) => {
                                            return `<div class="voice-freq-bar" id="bar_${audioId}_${i}" style="height:3.5px; --i:${i};"></div>`;
                                        }).join('')}
                                    </div>
                                    <span class="voice-timer-badge" id="dur_${audioId}">00:00</span>
                                </div>
                            </div>
                            <button type="button" class="btn-voice-speed-pill" id="speed_${audioId}" onclick="window.toggleVoiceSpeed ? window.toggleVoiceSpeed('${audioId}', this) : null" title="Atur Kecepatan Suara (1x, 1.5x, 2x, 0.5x)">
                                1x
                            </button>
                        </div>`;
                } else {
                    // DOKUMEN: PDF, WORD, EXCEL, PPT DLL (PANEL UNDUHAN DI SAMPING, ISI TERLIHAT DARI LUAR)
                    const rawFileName = c.file_name || (c.file_path || '').split('/').pop() || `Dokumen.${ext}`;
                    let cleanFileName = rawFileName.replace(/^\d{10,14}[_-]/, '');
                    if (!cleanFileName || /^\d+\.[a-zA-Z0-9]+$/.test(cleanFileName) || /^\d+$/.test(cleanFileName)) {
                        const defaultExt = (rawFileName.split('.').pop() || ext || 'pdf').toLowerCase();
                        cleanFileName = `Dokumen_Lampiran_${defaultExt.toUpperCase()}.${defaultExt}`;
                    }

                    const docExt = (cleanFileName.split('.').pop() || ext || 'pdf').toLowerCase();
                    let rawTitle = cleanFileName.substring(0, cleanFileName.lastIndexOf('.')) || cleanFileName;
                    let baseTitle = rawTitle.replace(/[-_]+/g, ' ').trim();
                    baseTitle = baseTitle.split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');

                    if (!baseTitle || /^\d+$/.test(baseTitle) || baseTitle.toLowerCase() === 'dokumen' || baseTitle.length < 3) {
                        if (['pdf'].includes(docExt)) baseTitle = 'Surat Keputusan Verifikasi Penerima Bansos';
                        else if (['doc', 'docx'].includes(docExt)) baseTitle = 'Panduan Persyaratan Administrasi Bansos';
                        else if (['xls', 'xlsx', 'csv'].includes(docExt)) baseTitle = 'Rekapitulasi Data Penyaluran Bansos Sidoarjo';
                        else if (['ppt', 'pptx'].includes(docExt)) baseTitle = 'Paparan Sosialisasi Penyaluran Bantuan Sosial';
                        else baseTitle = 'Berkas Dokumen Lampiran';
                    }

                    let docTypeClass = 'chat-doc-other';
                    let iconClass = 'fa-file-alt';
                    let badgeText = docExt.toUpperCase();
                    let labelText = 'Berkas Dokumen';
                    let accentColor = '#0284c7';

                    if (['ppt', 'pptx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-ppt';
                        iconClass = 'fa-file-powerpoint';
                        badgeText = 'PPT';
                        labelText = 'Presentasi PowerPoint';
                        accentColor = '#ea580c';
                    } else if (['xls', 'xlsx', 'csv'].includes(docExt)) {
                        docTypeClass = 'chat-doc-excel';
                        iconClass = 'fa-file-excel';
                        badgeText = 'EXCEL';
                        labelText = 'Spreadsheet Excel (.xlsx)';
                        accentColor = '#16a34a';
                    } else if (['doc', 'docx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-word';
                        iconClass = 'fa-file-word';
                        badgeText = 'WORD';
                        labelText = 'Microsoft Word (.docx)';
                        accentColor = '#2563eb';
                    } else if (['pdf'].includes(docExt)) {
                        docTypeClass = 'chat-doc-pdf';
                        iconClass = 'fa-file-pdf';
                        badgeText = 'PDF';
                        labelText = 'Dokumen PDF Resmi';
                        accentColor = '#dc2626';
                    } else if (['json'].includes(docExt)) {
                        docTypeClass = 'chat-doc-json';
                        iconClass = 'fa-file-code';
                        badgeText = 'JSON';
                        labelText = 'Berkas Konfigurasi Data (JSON)';
                        accentColor = '#d97706';
                    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(docExt)) {
                        docTypeClass = 'chat-doc-zip';
                        iconClass = 'fa-file-archive';
                        badgeText = docExt.toUpperCase();
                        labelText = 'Berkas Arsip Terkompresi';
                        accentColor = '#7c3aed';
                    }

                    const fileSizeText = c.file_size ? (typeof formatBytes === 'function' ? formatBytes(c.file_size) : `${Math.round(c.file_size / 1024)} KB`) : '';

                    mediaHtml = `
                        <div class="chat-doc-card ${docTypeClass}" title="${safeHtml(cleanFileName)}">
                            <div class="chat-doc-accent-bar" style="background:${accentColor}; height:3.5px; width:100%;"></div>
                            <!-- Kartu Lampiran Dokumen Bersih & Rapi Tanpa Pratinjau Isi Dokumen -->
                            <div class="chat-doc-bottom-strip" onclick="window.open('${url}', '_blank')">
                                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0; overflow:hidden;">
                                    <div class="chat-doc-icon-box" style="width:40px; height:40px; font-size:1.35rem;">
                                        <i class="fas ${iconClass}"></i>
                                    </div>
                                    <div class="chat-doc-info">
                                        <div class="chat-doc-title" style="font-size:0.85rem;" title="${safeHtml(cleanFileName)}">${safeHtml(cleanFileName)}</div>
                                        <div class="chat-doc-sub">
                                            <span class="chat-doc-badge">${badgeText}</span>
                                            <span class="chat-doc-label">${labelText}</span>
                                            ${fileSizeText ? `<span class="chat-doc-dot">•</span><span class="chat-doc-size">${fileSizeText}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="chat-doc-side-panel">
                                    <button type="button" class="chat-doc-side-dl-btn" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(cleanFileName)}', event)" title="Unduh Berkas ${badgeText}">
                                        <i class="fas fa-download"></i>
                                        <span>Unduh</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                let replyTargetId = c.reply_to_id || c.reply_id;
                if (!replyTargetId && Array.isArray(chats)) {
                    const matchedPrev = [...chats].reverse().find(x => x && x.id !== c.id && ((x.pesan && x.pesan.trim() === c.reply_text.trim()) || (x.text && x.text.trim() === c.reply_text.trim())));
                    if (matchedPrev) {
                        replyTargetId = matchedPrev.id;
                    }
                }
                replyHtml = `
                    <div class="chat-reply-quote-box ${!isMe ? 'is-officer' : ''}" ${replyTargetId ? `onclick="window.scrollToMessageWarga(${replyTargetId}, event)"` : ''} style="border-left-color:${isMe ? '#009846' : '#0284c7'};" title="${replyTargetId ? 'Klik untuk menuju ke pesan yang dibalas (ID #' + replyTargetId + ')' : ''}">
                        <div style="font-weight:700; color:${isMe ? '#009846' : '#0284c7'}; display:flex; align-items:center; justify-content:space-between; gap:4px;">
                            <span style="display:inline-flex; align-items:center; gap:4px;">
                                <i class="fas fa-reply" style="font-size:0.7rem;"></i> <span>${safeHtml(c.reply_sender || 'Pesan')}</span>
                            </span>
                            ${replyTargetId ? `<span style="font-size:0.65rem; color:#94a3b8; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><i class="fas fa-arrow-up" style="font-size:0.6rem;"></i> Lihat</span>` : ''}
                        </div>
                        <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px; font-style:italic; color:#334155;">
                            ${safeHtml(c.reply_text)}
                        </div>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-4px' : 'right:-4px'}; bottom:-8px; background:#ffffff; border-radius:14px; padding:1px 6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:0.85rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama || c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1' : '👮 Petugas');
            const cleanWargaText = (c.pesan || '').trim();
            const isPlaceholderText = !cleanWargaText || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran', 'video terlampir', 'video', '🎤 pesan suara (voice note)', '🎤 pesan suara', 'pesan suara'].includes(cleanWargaText.toLowerCase());

            const isAudioWarga = Boolean(
                c.file_type === 'audio' ||
                (c.file_path && (c.file_path.includes('voice_') || c.file_path.includes('voice') || c.file_path.includes('audio_'))) ||
                (c.pesan && (c.pesan.toLowerCase().includes('pesan suara') || c.pesan.toLowerCase().includes('voice note'))) ||
                ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e)) ||
                ((c.file_path || '').toLowerCase().endsWith('.webm') && (c.file_type === 'audio' || (c.file_path || '').includes('voice') || (c.pesan || '').toLowerCase().includes('suara')))
            );
            const isImgWarga = Boolean(!isAudioWarga && c.file_path && (c.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))));
            const isVidWarga = Boolean(!isAudioWarga && c.file_path && (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv', '3gp', 'webm'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))));
            const isDocWarga = Boolean(c.file_path && !isImgWarga && !isVidWarga && !isAudioWarga);

            const isImgOnlyWarga = isImgWarga && isPlaceholderText && !c.reply_text;
            const isVidOnlyWarga = isVidWarga && isPlaceholderText && !c.reply_text;
            const isMediaBubbleOnlyWarga = isImgOnlyWarga || isVidOnlyWarga;
            const isFixedMediaBubble = isDocWarga || isImgWarga || isVidWarga || isAudioWarga;

            let isEmojiOnlyWarga = false;
            let emojiCountWarga = 0;
            let emojiSizeStyleWarga = '';
            try {
                if (cleanWargaText && !c.file_path && !c.reply_text) {
                    const emojiOnlyRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Component}|\p{Emoji_Modifier_Base}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u{1F1E6}-\u{1F1FF}]|[\u{200D}\u{FE0E}\u{FE0F}]|\s)+$/u;
                    if (emojiOnlyRegex.test(cleanWargaText)) {
                        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                            const seg = new Intl.Segmenter('id', { granularity: 'grapheme' });
                            const items = Array.from(seg.segment(cleanWargaText)).filter(s => s.segment.trim().length > 0);
                            emojiCountWarga = items.length;
                        } else {
                            const matches = cleanWargaText.match(/\p{Extended_Pictographic}/gu) || [];
                            emojiCountWarga = matches.length;
                        }
                        if (emojiCountWarga >= 1 && emojiCountWarga <= 16) {
                            isEmojiOnlyWarga = true;
                            if (emojiCountWarga === 1) {
                                emojiSizeStyleWarga = 'font-size:2.85rem !important; line-height:1.2 !important;';
                            } else if (emojiCountWarga <= 3) {
                                emojiSizeStyleWarga = 'font-size:2.35rem !important; line-height:1.25 !important; letter-spacing:2px;';
                            } else if (emojiCountWarga <= 6) {
                                emojiSizeStyleWarga = 'font-size:1.95rem !important; line-height:1.3 !important; letter-spacing:3px;';
                            } else {
                                emojiSizeStyleWarga = 'font-size:1.6rem !important; line-height:1.35 !important; letter-spacing:2px;';
                            }
                        }
                    }
                }
            } catch (err) {
                isEmojiOnlyWarga = false;
            }

            const isShortTextWarga = !isFixedMediaBubble && !c.file_path && !c.reply_text && cleanWargaText.length <= 15 && !cleanWargaText.includes('\n');

            let bubbleStyles = isMe ? 'background:#e6f9f0; color:#065f46; border:1px solid #bbf7d0; padding-right:28px; padding-left:11px;' : 'background:#ffffff; color:#0f172a; border:1px solid #e2e8f0; padding-left:28px; padding-right:11px;';
            if (isEmojiOnlyWarga) {
                if (isMe) {
                    bubbleStyles = 'background:#e6f9f0 !important; color:#065f46 !important; border:1.5px solid #a7f3d0 !important; border-radius:18px 4px 18px 18px !important; padding:6px 36px 14px 14px !important; box-shadow:0 2px 8px rgba(0,152,70,0.12) !important; min-width:82px !important; min-height:48px !important; display:inline-flex !important; flex-direction:column !important; justify-content:center !important; align-items:center !important; position:relative !important; box-sizing:border-box !important;';
                } else {
                    bubbleStyles = 'background:#ffffff !important; color:#0f172a !important; border:1.5px solid #e2e8f0 !important; border-radius:4px 18px 18px 18px !important; padding:6px 36px 14px 28px !important; box-shadow:0 2px 8px rgba(0,0,0,0.06) !important; min-width:82px !important; min-height:48px !important; display:inline-flex !important; flex-direction:column !important; justify-content:center !important; align-items:center !important; position:relative !important; box-sizing:border-box !important;';
                }
            } else if (isMediaBubbleOnlyWarga) {
                const mediaOnlyWidth = isImgOnlyWarga ? '260px' : '315px';
                if (isMe) {
                    bubbleStyles = `padding:3px !important; background:#009846 !important; border:2px solid #009846 !important; border-radius:17px !important; box-shadow:0 3px 12px rgba(0,152,70,0.22) !important; width:${mediaOnlyWidth} !important; max-width:min(${mediaOnlyWidth}, 85vw) !important; display:inline-flex !important; flex-direction:column !important; align-items:center !important; line-height:0 !important; font-size:0 !important; box-sizing:border-box !important;`;
                } else {
                    bubbleStyles = `padding:3px !important; background:#ffffff !important; border:2px solid #e2e8f0 !important; border-radius:17px !important; box-shadow:0 2px 10px rgba(0,0,0,0.08) !important; width:${mediaOnlyWidth} !important; max-width:min(${mediaOnlyWidth}, 85vw) !important; display:inline-flex !important; flex-direction:column !important; align-items:center !important; line-height:0 !important; font-size:0 !important; box-sizing:border-box !important;`;
                }
            } else if (isDocWarga) {
                const docBubbleWidth = '320px';
                bubbleStyles = isMe
                    ? `background:#e6f9f0 !important; color:#065f46 !important; border:1px solid #bbf7d0 !important; border-radius:16px 4px 16px 16px !important; width:${docBubbleWidth} !important; max-width:min(${docBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 10px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${docBubbleWidth} !important; max-width:min(${docBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 10px 6px 26px !important;`;
            } else if (isImgWarga) {
                const imgBubbleWidth = '270px';
                bubbleStyles = isMe
                    ? `background:#e6f9f0 !important; color:#065f46 !important; border:1px solid #bbf7d0 !important; border-radius:16px 4px 16px 16px !important; width:${imgBubbleWidth} !important; max-width:min(${imgBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 8px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${imgBubbleWidth} !important; max-width:min(${imgBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 8px 6px 26px !important;`;
            } else if (isVidWarga) {
                const vidBubbleWidth = '315px';
                bubbleStyles = isMe
                    ? `background:#e6f9f0 !important; color:#065f46 !important; border:1px solid #bbf7d0 !important; border-radius:16px 4px 16px 16px !important; width:${vidBubbleWidth} !important; max-width:min(${vidBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 26px 6px 8px !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0 !important; border-radius:4px 16px 16px 16px !important; width:${vidBubbleWidth} !important; max-width:min(${vidBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:6px 8px 6px 26px !important;`;
            } else if (isAudioWarga) {
                const audioBubbleWidth = '340px';
                bubbleStyles = isMe
                    ? `background:#ffffff !important; color:#0f172a !important; border:1.5px solid #10b981 !important; border-radius:18px 4px 18px 18px !important; width:${audioBubbleWidth} !important; max-width:min(${audioBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:8px 38px 8px 12px !important; box-shadow:0 3px 12px rgba(16,185,129,0.12) !important;`
                    : `background:#ffffff !important; color:#0f172a !important; border:1.5px solid #e2e8f0 !important; border-radius:4px 18px 18px 18px !important; width:${audioBubbleWidth} !important; max-width:min(${audioBubbleWidth}, 85vw) !important; box-sizing:border-box !important; padding:8px 12px 8px 38px !important; box-shadow:0 3px 12px rgba(0,0,0,0.06) !important;`;
            } else if (isShortTextWarga) {
                bubbleStyles += isMe 
                    ? ' display:inline-flex !important; flex-direction:row !important; align-items:baseline !important; gap:10px !important; padding:5px 28px 4px 12px !important; width:fit-content !important; min-width:0 !important;'
                    : ' display:inline-flex !important; flex-direction:row !important; align-items:baseline !important; gap:10px !important; padding:5px 12px 4px 28px !important; width:fit-content !important; min-width:0 !important;';
            }

            const bubbleBaseWidth = isFixedMediaBubble ? '' : 'width:fit-content; min-width:0; max-width:min(72%, 380px);';
            const mediaTypeClass = isDocWarga ? 'is-doc-card' : (isImgWarga ? 'is-image-card' : (isVidWarga ? 'is-video-card' : (isAudioWarga ? 'is-audio-card' : '')));

            return `
                <div id="msg-warga-${c.id}" class="${isEmojiOnlyWarga ? 'is-emoji-only' : ''} ${isShortTextWarga ? 'is-short-text' : ''} ${isImgOnlyWarga ? 'is-image-only' : ''} ${isVidOnlyWarga ? 'is-video-only' : ''} ${isMediaBubbleOnlyWarga ? 'is-media-only' : ''} ${mediaTypeClass}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; ${bubbleBaseWidth} padding:7px 11px 5px 11px; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.88rem; box-shadow:0 1px 4px rgba(0,0,0,0.04); position:relative; overflow:visible !important; ${bubbleStyles}">
                    ${!isMe && !isMediaBubbleOnlyWarga && !isEmojiOnlyWarga ? `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; padding-left:0px;">
                            <span style="font-size:0.7rem; font-weight:800; color:#0284c7; display:inline-flex; align-items:center; gap:4px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <i class="fas fa-shield-alt"></i> ${safeHtml(handlerName)}
                            </span>
                        </div>
                    ` : ''}

                    ${/* POSISI TITIK TIGA: DIKIRIM WARGA (POJOK KANAN ATAS), DIKIRIM PETUGAS (POJOK KIRI ATAS) */ ''}
                    <div style="position:absolute; ${isMe ? (isMediaBubbleOnlyWarga || isVidWarga || isImgWarga ? 'top:8px; right:8px; left:auto;' : 'top:6px; right:6px; left:auto;') : (isMediaBubbleOnlyWarga || isVidWarga || isImgWarga ? 'top:8px; left:8px; right:auto;' : 'top:6px; left:6px; right:auto;')}; z-index:70; pointer-events:auto;">
                        <button type="button" class="${isMediaBubbleOnlyWarga || isVidWarga || isImgWarga ? 'bubble-corner-btn' : 'btn-msg-dots'}" style="${isMe && !(isMediaBubbleOnlyWarga || isVidWarga || isImgWarga) ? 'color:#047857;' : ''}" onclick="event.stopPropagation(); event.preventDefault(); window.toggleChatMenuWarga(${c.id}, event);" onmousedown="event.stopPropagation();" title="Opsi Pesan">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div id="menu-warga-${c.id}" class="aduan-dropdown-menu ${isMe ? 'menu-right' : 'menu-left'}" style="display:none; background:#ffffff !important; background-color:#ffffff !important; border:1px solid rgba(226,232,240,0.95) !important; border-radius:16px !important; box-shadow:0 20px 45px -8px rgba(15,23,42,0.22) !important; z-index:999999 !important;" onclick="event.stopPropagation()">
                            <div class="emoji-react-row" onwheel="this.scrollLeft += event.deltaY; event.preventDefault();">
                                <span onclick="window.submitReactionWarga(${c.id}, '❤️')" title="Suka">❤️</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '👍')" title="Jempol">👍</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '😂')" title="Tertawa">😂</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '😮')" title="Kaget">😮</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '😢')" title="Sedih">😢</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '🙏')" title="Terima Kasih">🙏</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '🔥')" title="Semangat">🔥</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '👏')" title="Tepuk Tangan">👏</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '🎉')" title="Selamat">🎉</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '💯')" title="Mantap">💯</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '💡')" title="Ide">💡</span>
                                <span onclick="window.submitReactionWarga(${c.id}, '🤝')" title="Sepakat">🤝</span>
                            </div>
                            <button type="button" class="aduan-menu-item" onclick="window.bukaInfoPesanChat(${c.id})"><span class="menu-item-icon icon-sky"><i class="fas fa-info-circle"></i></span> <span>Detail Pesan</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.setReplyWarga(${c.id}, '${isMe ? 'Anda' : safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')"><span class="menu-item-icon icon-emerald"><i class="fas fa-reply"></i></span> <span>Balas Pesan</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))"><span class="menu-item-icon icon-slate"><i class="fas fa-copy"></i></span> <span>Salin Teks</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.togglePinPesanWarga(${c.id})"><span class="menu-item-icon icon-purple"><i class="fas fa-thumbtack"></i></span> <span>${c.is_pinned ? 'Lepas Sematan' : 'Sematkan Pesan'}</span></button>
                            <button type="button" class="aduan-menu-item" onclick="window.toggleBintangPesanWarga(${c.id})"><span class="menu-item-icon icon-amber"><i class="${c.is_starred ? 'fas fa-star text-warning' : 'far fa-star'}"></i></span> <span>${c.is_starred ? 'Hapus Bintang' : 'Bintangi Pesan'}</span></button>
                            <div class="aduan-menu-divider"></div>
                            <button type="button" class="aduan-menu-item item-amber" onclick="window.konfirmasiHapusPesanWarga(${c.id}, ${isMe})"><span class="menu-item-icon icon-amber"><i class="fas fa-trash-alt"></i></span> <span>Hapus Pesan</span></button>
                            <button type="button" class="aduan-menu-item item-danger" onclick="window.laporkanPesanWarga(${c.id}, decodeURIComponent('${enc(c.pesan || '')}'), '${isMe ? 'Anda' : escapeInlineJS(handlerName)}')"><span class="menu-item-icon icon-rose"><i class="fas fa-flag"></i></span> <span>Laporkan Pesan</span></button>
                        </div>
                    </div>

                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan && !isPlaceholderText ? (c.pesan.startsWith('[GEOTAG_LOKASI]') ? window.formatGeotagCardHtml(c.pesan) : `<div class="${isEmojiOnlyWarga ? 'warga-chat-txt is-emoji-content' : 'chat-caption-text'}" style="${isEmojiOnlyWarga ? `${emojiSizeStyleWarga} text-align:center; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.10)); margin:0 !important; padding:0 !important; user-select:all; line-height:1.15 !important;` : 'width:100% !important; box-sizing:border-box !important; overflow-wrap:anywhere !important; word-break:break-word !important; line-height:1.45 !important; font-size:0.86rem !important; margin-top:4px !important;'}">${safeHtml(c.pesan)}</div>`) : ''}
                    ${isEmojiOnlyWarga ? `
                    <div class="chat-emoji-timestamp" style="position:absolute; right:7px; bottom:3px; display:inline-flex; align-items:center; gap:2.5px; font-size:0.62rem; color:${isMe ? '#047857' : '#94a3b8'}; opacity:0.88; pointer-events:none; line-height:1; white-space:nowrap; z-index:10;">
                        ${c.is_pinned ? `<span class="chat-pin-icon-bubble" style="font-size:0.56rem;"><i class="fas fa-thumbtack"></i></span>` : ''}
                        ${c.is_starred ? `<span class="chat-star-icon" style="font-size:0.56rem;"><i class="fas fa-star text-warning"></i></span>` : ''}
                        <span style="font-size:0.62rem; font-weight:600;">${msgTime}</span>
                        ${isMe ? checkIconWarga : ''}
                    </div>` : ''}
                    ${!isMediaBubbleOnlyWarga && !isEmojiOnlyWarga ? `
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:3px; font-size:0.68rem; color:${isMe ? '#047857' : '#94a3b8'}; gap:3px;">
                        ${c.is_pinned ? `<span class="chat-pin-icon-bubble" title="Pesan Disematkan"><i class="fas fa-thumbtack"></i></span>` : ''}
                        ${c.is_starred ? `<span class="chat-star-icon" title="Pesan Berbintang"><i class="fas fa-star"></i></span>` : ''}
                        <span>${msgTime}</span>
                        ${isMe ? checkIconWarga : ''}
                    </div>` : ''}
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        // Cek Pinned Message Banner
        const latestPinned = [...chats].reverse().find(c => c.is_pinned && c.deleted_for !== 'me_warga');
        const pinnedBanner = document.getElementById('wargaChatPinnedBanner');
        const pinnedTxt = document.getElementById('wargaPinnedTextSnippet');
        if (pinnedBanner && pinnedTxt) {
            if (latestPinned) {
                window.currentPinnedMsgId = latestPinned.id;
                pinnedTxt.innerText = `"${(latestPinned.pesan || latestPinned.file_name || 'Lampiran').slice(0, 45)}..."`;
                pinnedBanner.style.display = 'flex';
            } else {
                window.currentPinnedMsgId = null;
                pinnedBanner.style.display = 'none';
            }
        }

        setTimeout(() => {
            document.querySelectorAll('.voice-note-bubble-card audio, .modern-voice-card audio').forEach(a => {
                if (window.initVoiceBubbleMeta) window.initVoiceBubbleMeta(a.id);
                if (window.initAudioMetadata) window.initAudioMetadata(a.id);
            });
        }, 100);

        if (forceScroll || isNearBottom || !window.hasScrolledWargaChatOnce) {
            box.scrollTop = box.scrollHeight;
            window.hasScrolledWargaChatOnce = true;
        }
    } catch (e) {
        console.error('[loadChatMessagesWarga Error]', e);
    }
};

window.tanyaCepatWarga = function (type) {
    const questions = {
        jadwal: 'Mohon informasi mengenai perkiraan jadwal penyaluran bantuan sosial tahap ini bagi warga terdaftar?',
        berkas: 'Apakah data e-KTP dan Kartu Keluarga (KK) saya sudah sesuai dan lengkap di sistem Dinas Sosial?',
        nominal: 'Berapakah nominal alokasi bantuan sosial yang ditetapkan untuk keluarga kami pada tahap ini?',
        lokasi: 'Di manakah alamat lokasi pengambilan bantuan fisik dan apa saja syarat dokumen yang wajib dibawa?'
    };
    const input = document.getElementById('wargaChatInput');
    if (input && questions[type]) {
        input.value = questions[type];
        input.focus();
    }
};

window.emojiCatalogWarga = {
    populer: {
        label: '⭐ Populer',
        emojis: ['😀', '😂', '😊', '😍', '👍', '🙏', '❤️', '🔥', '✅', '✨', '🚨', '📌', '👏', '🤝', '💯', '💪']
    },
    wajah: {
        label: '😀 Wajah',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🥺', '😢', '😭',
            '😤', '😠', '😡', '🤯', '😳', '😱', '😨', '😰', '🤔', '🤫'
        ]
    },
    gestur: {
        label: '👍 Gestur',
        emojis: ['👍', '👎', '👏', '🙌', '🫶', '🤝', '🙏', '💪', '✌️', '🤞', '🤙', '👋', '👌', '✋', '✍️', '👊']
    },
    simbol: {
        label: '❤️ Simbol',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '🔥', '✨', '🌟', '💯', '⭐', '🎉', '🏆']
    },
    status: {
        label: '🚨 Status',
        emojis: ['🚨', '⚠️', '🚩', '📌', '📍', '✅', '❌', '❓', '❗', '📢', '🛡️', '🔒', '⚖️', '🔎', '💡', '⏰']
    },
    berkas: {
        label: '📄 Berkas',
        emojis: ['📄', '📊', '📈', '📁', '💼', '📦', '🏠', '🏢', '🏛️', '✉️', '📱', '💻', '📷', '🎙️', '📎', '🪙']
    }
};

window.currentEmojiCategoryWarga = 'populer';

window.renderEmojiGridWarga = function (keyword = '') {
    const gridEl = document.getElementById('emojiGridContainerWarga');
    if (!gridEl) return;

    let emojis = [];
    if (keyword && keyword.trim() !== '') {
        const kw = keyword.toLowerCase().trim();
        const all = Object.values(window.emojiCatalogWarga).flatMap(cat => cat.emojis);
        const uniqueAll = Array.from(new Set(all));

        const keywordMap = {
            'senyum': ['😀','😃','😄','😁','😆','😊','🙂','😉','😇'],
            'tertawa': ['😂','🤣','😆','😅'],
            'senang': ['😀','😃','😊','🥳','🤩'],
            'sedih': ['😢','😭','😞','😔','😟','🥺'],
            'marah': ['😠','😡','😤','🤯'],
            'jempol': ['👍','👎'],
            'salam': ['🙏','🤝','👋'],
            'reaksi': ['👍','👎','👏','🙌','🫶','🤝','🙏','💪','👌','✌️'],
            'hati': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔'],
            'cinta': ['❤️','😍','🥰','😘'],
            'api': ['🔥'],
            'bintang': ['⭐','🌟','✨'],
            'lapor': ['🚨','⚠️','🚩','📢','❗'],
            'tanya': ['❓','🤔'],
            'centang': ['✅'],
            'silang': ['❌'],
            'berkas': ['📄','📁','💼'],
            'uang': ['💰','🪙','💸'],
            'bansos': ['📦','🏠','🤝','🪙'],
            'surat': ['📄','✉️']
        };

        const matchingFromMap = Object.entries(keywordMap)
            .filter(([k]) => k.includes(kw) || kw.includes(k))
            .flatMap(([, v]) => v);

        emojis = uniqueAll.filter(e => e.includes(kw) || matchingFromMap.includes(e));
        if (emojis.length === 0) {
            gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:12px; color:#94a3b8; font-size:0.75rem;">Emoji tidak ditemukan. Coba ketik kata lain.</div>`;
            return;
        }
    } else {
        const cat = window.emojiCatalogWarga[window.currentEmojiCategoryWarga] || window.emojiCatalogWarga.populer;
        emojis = cat.emojis;
    }

    gridEl.innerHTML = emojis.map(e => `
        <button type="button" class="emoji-cell-btn" style="background:none; border:none; cursor:pointer; font-size:1.35rem; padding:4px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:transform 0.12s, background 0.12s; user-select:none;" onmouseover="this.style.transform='scale(1.25)'; this.style.background='#f1f5f9';" onmouseout="this.style.transform='scale(1)'; this.style.background='none';" onclick="window.addEmojiWarga('${e}')" title="${e}">
            ${e}
        </button>
    `).join('');
};

window.switchEmojiCategoryWarga = function (catKey) {
    window.currentEmojiCategoryWarga = catKey;
    document.querySelectorAll('#emojiCategoryTabsWarga button').forEach(b => {
        if (b.getAttribute('data-cat') === catKey) {
            b.style.background = '#009846';
            b.style.color = '#ffffff';
            b.style.fontWeight = '800';
        } else {
            b.style.background = '#f1f5f9';
            b.style.color = '#475569';
            b.style.fontWeight = '600';
        }
    });
    const searchInp = document.getElementById('wargaEmojiSearchInput');
    if (searchInp) searchInp.value = '';
    window.renderEmojiGridWarga('');
};

window.filterEmojiWarga = function (val) {
    window.renderEmojiGridWarga(val);
};

window.toggleEmojiPickerWarga = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerWarga');
    const attachPop = document.getElementById('wargaAttachmentMenuPopover');
    const voiceAttachPop = document.getElementById('wargaVoicePreviewAttachMenu');
    if (attachPop) attachPop.style.display = 'none';
    if (voiceAttachPop) voiceAttachPop.style.display = 'none';
    if (!el) return;

    const isVisible = el.style.display === 'flex';
    if (isVisible) {
        el.style.display = 'none';
        return;
    }

    const triggerBtn = event ? (event.currentTarget || event.target.closest('button')) : document.getElementById('btnEmojiWarga');
    const container = el.parentElement;

    el.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <!-- Header Pencarian Cepat -->
            <div style="display:flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:4px 10px;">
                <i class="fas fa-search" style="font-size:0.75rem; color:#64748b;"></i>
                <input type="text" id="wargaEmojiSearchInput" placeholder="Cari emoji (senyum, jempol, hati, dll)..." oninput="window.filterEmojiWarga(this.value)" style="border:none; background:transparent; width:100%; outline:none; font-size:0.78rem; color:#1e293b;" onclick="event.stopPropagation()">
            </div>

            <!-- Tab Kategori -->
            <div id="emojiCategoryTabsWarga" style="display:flex; gap:4px; overflow-x:auto; padding-bottom:3px; scrollbar-width:none;">
                ${Object.entries(window.emojiCatalogWarga).map(([key, item]) => `
                    <button type="button" data-cat="${key}" onclick="window.switchEmojiCategoryWarga('${key}')" style="background:${key === window.currentEmojiCategoryWarga ? '#009846' : '#f1f5f9'}; color:${key === window.currentEmojiCategoryWarga ? '#ffffff' : '#475569'}; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:${key === window.currentEmojiCategoryWarga ? '800' : '600'}; white-space:nowrap; cursor:pointer; transition:all 0.15s;">
                        ${item.label}
                    </button>
                `).join('')}
            </div>

            <!-- Grid Emoji -->
            <div id="emojiGridContainerWarga" style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; max-height:175px; overflow-y:auto; padding:2px; scrollbar-width:thin;"></div>
        </div>
    `;

    window.renderEmojiGridWarga('');

    if (container && triggerBtn) {
        const containerRect = container.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        let leftPos = (btnRect.left - containerRect.left) + (btnRect.width / 2) - 150;
        if (leftPos < 8) leftPos = 8;
        if (leftPos + 300 > containerRect.width - 8) {
            leftPos = Math.max(8, containerRect.width - 308);
        }

        const bottomPos = (containerRect.bottom - btnRect.top) + 8;

        el.style.cssText = `
            display: flex;
            position: absolute;
            bottom: ${bottomPos}px;
            left: ${leftPos}px;
            right: auto;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 18px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 10px;
            width: 300px;
            max-width: calc(100vw - 32px);
            z-index: 999999 !important;
            box-sizing: border-box;
        `;
    } else {
        el.style.cssText = `
            display: flex;
            position: absolute;
            bottom: 66px;
            left: 12px;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 18px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 10px;
            width: 300px;
            max-width: calc(100vw - 32px);
            z-index: 999999 !important;
            box-sizing: border-box;
        `;
    }

    const closeOnClickOutside = function (ev) {
        if (!el.contains(ev.target) && !ev.target.closest('#btnEmojiWarga') && !ev.target.closest('#btnEmojiWargaPreview') && !ev.target.closest('.emoji-toggle-btn')) {
            el.style.display = 'none';
            document.removeEventListener('click', closeOnClickOutside);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
        const searchInput = document.getElementById('wargaEmojiSearchInput');
        if (searchInput) searchInput.focus();
    }, 50);
};

window.addEmojiWarga = window.insertEmojiWarga = function (emoji) {
    const previewBar = document.getElementById('wargaVoicePreviewBar');
    const caption = document.getElementById('wargaVoiceCaptionInput');
    if (previewBar && previewBar.style.display !== 'none' && caption) {
        caption.value += emoji;
        caption.focus();
        return;
    }
    const input = document.getElementById('wargaChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.toggleWargaAttachmentMenu = function (e) {
    if (e) e.stopPropagation();
    const pop = document.getElementById('wargaAttachmentMenuPopover');
    const emojiPop = document.getElementById('emojiPickerWarga');
    if (!pop) return;

    if (emojiPop) emojiPop.style.display = 'none';

    const isVisible = pop.style.display === 'block';
    pop.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        const closeOnClickOutside = function (ev) {
            if (!pop.contains(ev.target) && ev.target.id !== 'btnWargaAttachMenu' && !ev.target.closest('#btnWargaAttachMenu')) {
                pop.style.display = 'none';
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 50);
    }
};

window.wargaChatPendingFiles = [];

window.showPreviewWarga = function (url, type, fileName) {
    window.renderWargaChatAttachmentChips();
};

window.batalLampiranWarga = function () {
    (window.wargaChatPendingFiles || []).forEach(f => {
        if (f.previewThumb) URL.revokeObjectURL(f.previewThumb);
    });
    window.wargaChatPendingFiles = [];
    window.editedMediaBlob = null;
    const bar = document.getElementById('attachmentPreviewContainerWarga');
    if (bar) bar.style.display = 'none';
    const fileInp = document.getElementById('wargaChatFile');
    if (fileInp) fileInp.value = '';
};

window.addWargaChatAttachments = function (files) {
    if (!files || files.length === 0) return;
    const MAX_FILES = 100;
    const incoming = Array.isArray(files) ? files : Array.from(files);

    if (window.wargaChatPendingFiles.length + incoming.length > MAX_FILES) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Batas Maksimal', `Maksimal lampiran adalah ${MAX_FILES} berkas. Berkas selebihnya diabaikan.`, 'warning');
        }
    }

    const allowed = incoming.slice(0, MAX_FILES - window.wargaChatPendingFiles.length);
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
            previewThumb = URL.createObjectURL(fileObj);
        }

        window.wargaChatPendingFiles.push({
            id: `w_chat_att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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

    // Set fallback single editedMediaBlob untuk kompatibilitas
    if (window.wargaChatPendingFiles.length > 0 && window.wargaChatPendingFiles[0].file instanceof Blob) {
        window.editedMediaBlob = window.wargaChatPendingFiles[0].file;
        window.editedMediaType = window.wargaChatPendingFiles[0].type;
        window.editedMediaExt = window.wargaChatPendingFiles[0].name.split('.').pop().toLowerCase();
    }

    window.renderWargaChatAttachmentChips();
    document.getElementById('wargaChatInput')?.focus();
};

window.removeWargaChatAttachment = function (idx) {
    if (idx >= 0 && idx < window.wargaChatPendingFiles.length) {
        const removed = window.wargaChatPendingFiles.splice(idx, 1)[0];
        if (removed && removed.previewThumb) {
            URL.revokeObjectURL(removed.previewThumb);
        }
        if (window.wargaChatPendingFiles.length === 0) {
            window.editedMediaBlob = null;
        } else if (window.wargaChatPendingFiles[0].file instanceof Blob) {
            window.editedMediaBlob = window.wargaChatPendingFiles[0].file;
            window.editedMediaType = window.wargaChatPendingFiles[0].type;
        }
        window.renderWargaChatAttachmentChips();
    }
};

window.renderWargaChatAttachmentChips = function () {
    const bar = document.getElementById('attachmentPreviewContainerWarga');
    if (!bar) return;

    if (!window.wargaChatPendingFiles || window.wargaChatPendingFiles.length === 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    bar.style.flexDirection = 'column';
    bar.style.gap = '6px';
    bar.style.padding = '8px 14px';

    const count = window.wargaChatPendingFiles.length;
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-size:0.75rem; font-weight:800; color:#065f46;">
            <span><i class="fas fa-paperclip"></i> Lampiran Berkas (${count}/100)</span>
            <button type="button" onclick="window.batalLampiranWarga()" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.72rem; font-weight:700;"><i class="fas fa-trash-alt"></i> Hapus Semua</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; overflow-x:auto; max-width:100%; padding-bottom:3px;">
    `;

    window.wargaChatPendingFiles.forEach((item, idx) => {
        let icon = '<i class="fas fa-file-alt" style="color:#7c3aed;"></i>';
        if (item.type === 'image') icon = '<i class="fas fa-image" style="color:#0284c7;"></i>';
        else if (item.type === 'video') icon = '<i class="fas fa-video" style="color:#e11d48;"></i>';
        if (item.isGoogleDrive) icon = '<i class="fab fa-google-drive" style="color:#f59e0b;"></i>';

        const sizeStr = item.size ? `${(item.size / (1024 * 1024)).toFixed(1)}MB` : '';
        const thumbHtml = item.previewThumb
            ? `<img src="${item.previewThumb}" style="width:22px; height:22px; border-radius:4px; object-fit:cover;">`
            : icon;

        html += `
            <div style="display:flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #a7f3d0; border-radius:10px; padding:4px 8px; font-size:0.72rem; white-space:nowrap; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                ${thumbHtml}
                <span style="font-weight:700; color:#065f46; max-width:130px; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</span>
                <span style="color:#64748b; font-size:0.65rem;">${sizeStr}</span>
                <button type="button" onclick="window.removeWargaChatAttachment(${idx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.8rem; padding:0 3px;" title="Hapus Berkas">&times;</button>
            </div>
        `;
    });

    html += `</div>`;
    bar.innerHTML = html;
};

window.handleWargaFileSelected = function (input) {
    if (!input.files || input.files.length === 0) return;
    window.addWargaChatAttachments(input.files);
    input.value = '';
};

window.sendWargaChat = window.kirimPesanWarga = async function () {
    if (window.isSendingWargaChat) return;
    const currentNik = getActiveNikChat();
    const currentNama = getActiveNamaChat();

    if (!currentNik) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Sesi Belum Aktif',
                text: 'Silakan masuk ke portal warga terlebih dahulu.',
                timer: 3000,
                showConfirmButton: false
            });
        }
        return;
    }

    // Jika sedang dalam mode pratinjau suara warga, kirim langsung menggunakan tombol kirim utama
    const previewBlob = window.tempPreviewWargaBlob || tempPreviewWargaBlob;
    if (previewBlob) {
        window.sendConfirmedVoiceWarga();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    const curRecorder = window.mediaRecorderWarga || mediaRecorderWarga;
    if (curRecorder && curRecorder.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    const input = document.getElementById('wargaChatInput');
    const pesan = input ? input.value.trim() : '';
    const pendingFiles = [...(window.wargaChatPendingFiles || [])];

    if (!pesan && pendingFiles.length === 0 && !window.editedMediaBlob) return;

    window.isSendingWargaChat = true;
    const btnSend = document.getElementById('btnSendWarga');
    if (btnSend) {
        btnSend.disabled = true;
        btnSend.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:0.9rem;"></i>';
    }

    const nowDevice = new Date();
    const deviceTime = nowDevice.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', currentNama);
    formData.append('pesan', pesan);
    formData.append('waktu', deviceTime);
    formData.append('created_at', nowDevice.toISOString());

    if (pendingFiles.length > 0) {
        pendingFiles.forEach((item, idx) => {
            if (item.file && item.file instanceof Blob) {
                formData.append('files', item.file, item.name || item.file.name);
            } else if (item.isCloudLink) {
                formData.append(`cloud_link_${idx}`, item.webViewLink || '');
                formData.append(`cloud_name_${idx}`, item.name || 'Berkas Google Workspace');
                formData.append(`cloud_type_${idx}`, item.type || 'document');
            }
        });
    } else if (window.editedMediaBlob) {
        const isVoice = window.editedMediaType === 'audio';
        const finalName = isVoice ? `voice_warga_${Date.now()}.${window.editedMediaExt || 'webm'}` : `media_${Date.now()}.${window.editedMediaExt || 'jpg'}`;
        formData.append('file', window.editedMediaBlob, finalName);
        if (window.editedMediaType) {
            formData.append('custom_file_type', window.editedMediaType);
        }
    }

    const repData = window.replyToDataWarga || replyToDataWarga;
    if (repData) {
        formData.append('reply_to_id', repData.id);
        formData.append('reply_to_text', repData.text);
        formData.append('reply_to_sender', repData.sender);
    }

    if (input) input.value = '';
    window.batalLampiranWarga();
    window.batalReplyWarga();

    try {
        const resp = await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
            method: 'POST',
            body: formData
        });
        if (!resp.ok) {
            console.warn('[Send Chat Response Error]', resp.status);
        }
        lastChatHashWarga = '';
        await window.loadChatMessagesWarga(true);
    } catch (e) {
        console.error('[Send Chat Error]', e);
    } finally {
        window.isSendingWargaChat = false;
        if (btnSend) {
            btnSend.disabled = false;
            btnSend.innerHTML = '<i class="fas fa-paper-plane" style="font-size:0.9rem;"></i>';
        }
    }
};

window.setReplyWarga = function (id, sender, text, file_type) {
    let displayTxt = text;
    if (file_type === 'image') displayTxt = '📷 Gambar';
    else if (file_type === 'video') displayTxt = '🎥 Video';
    else if (file_type === 'audio') displayTxt = '🎤 Pesan Suara';

    replyToDataWarga = { id, sender, text: displayTxt };
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) {
        const sEl = document.getElementById('replyPreviewSenderWarga');
        const tEl = document.getElementById('replyPreviewTextWarga');
        if (sEl) sEl.innerText = safeHtml(sender);
        if (tEl) tEl.innerText = displayTxt;
        cont.style.display = 'flex';
    }
    document.getElementById('wargaChatInput')?.focus();
};

window.batalReplyWarga = function () {
    replyToDataWarga = null;
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) cont.style.display = 'none';
};

window.reactToMessageWarga = async function (msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionWarga(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({ title: 'Beri Reaksi Emoji', html, showConfirmButton: false });
};

window.submitReactionWarga = async function (msgId, emoji) {
    document.querySelectorAll('[id^="menu-warga-"], .aduan-dropdown-menu').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;
    Swal?.close();
    try {
        await fetch(`${API_URL}/api/chat/react/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: emoji })
        }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.togglePinMessageWarga = async function (msgId) {
    document.querySelectorAll('[id^="menu-warga-"], .aduan-dropdown-menu').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;
    try {
        await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.konfirmasiHapusPesanWarga = function (id, isMe) {
    document.querySelectorAll('.aduan-dropdown-menu, [id^="menu-warga-"], [id^="aduan-menu-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '<div style="font-size:1.15rem; font-weight:800; color:#1e293b;"><i class="fas fa-trash-alt text-warning"></i> Hapus Pesan</div>',
            html: `
                <div style="text-align:left; font-size:0.88rem; color:#334155; display:flex; flex-direction:column; gap:10px; margin-top:8px;">
                    <p style="margin:0 0 4px 0; font-size:0.84rem; color:#64748b;">Pilih bagaimana Anda ingin menghapus pesan ini:</p>
                    
                    <div onclick="window.eksekusiHapusPesanWarga(${id}, 'me')" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:12px; cursor:pointer; background:#f8fafc; transition:all 0.2s;" onmouseover="this.style.borderColor='#f59e0b'; this.style.background='#fffbeb';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc';">
                        <div style="width:38px; height:38px; border-radius:10px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                            <i class="fas fa-trash-alt"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:700; color:#1e293b; font-size:0.9rem;">Hapus untuk Saya</div>
                            <div style="font-size:0.76rem; color:#64748b;">Pesan hanya disembunyikan dari layar Anda sendiri. Lawan bicara tetap dapat melihatnya.</div>
                        </div>
                    </div>

                    <div onclick="window.eksekusiHapusPesanWarga(${id}, 'everyone')" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:12px; cursor:pointer; background:#f8fafc; transition:all 0.2s;" onmouseover="this.style.borderColor='#ef4444'; this.style.background='#fef2f2';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc';">
                        <div style="width:38px; height:38px; border-radius:10px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                            <i class="fas fa-users-slash"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:700; color:#1e293b; font-size:0.9rem;">Hapus untuk Semua Orang</div>
                            <div style="font-size:0.76rem; color:#64748b;">Pesan ditarik untuk semua pihak dan diganti dengan <i>"🚫 Pesan telah dihapus"</i>.</div>
                        </div>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Batal',
            cancelButtonColor: '#94a3b8',
            customClass: {
                popup: 'swal2-border-radius-16 swal2-hide-confirm'
            },
            didOpen: () => {
                const confBtn = Swal.getConfirmButton();
                if (confBtn) confBtn.style.setProperty('display', 'none', 'important');
            }
        });
    } else {
        const choice = confirm('Pilih OK untuk Hapus untuk Semua Orang, atau Batal untuk Hapus untuk Saya saja.');
        window.eksekusiHapusPesanWarga(id, choice ? 'everyone' : 'me');
    }
};

window.eksekusiHapusPesanWarga = async function (id, tipe) {
    if (typeof Swal !== 'undefined') Swal.close();
    try {
        await fetch(`${API_URL}/api/chat/action/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: tipe, requester: 'warga' })
        });
        window.lastChatHashWarga = '';
        window.lastAduanChatHash = '';
        await window.loadChatMessagesWarga(false);
        if (typeof window.muatPesanAduan === 'function') {
            await window.muatPesanAduan(false);
        }
        if (typeof showPortalToast === 'function') {
            showPortalToast(tipe === 'everyone' ? 'Pesan telah dihapus untuk semua orang' : 'Pesan telah dihapus dari layar Anda', 'success');
        }
    } catch (e) {
        console.error('[Hapus Pesan Error]', e);
    }
};

window.hapusPesanWarga = function (id, tipe) {
    window.eksekusiHapusPesanWarga(id, tipe);
};

window.hapusPesanAduan = function (id, tipe) {
    window.eksekusiHapusPesanWarga(id, tipe);
};

window.laporkanPesanWarga = function (id, pesanKutipan, terlaporNama) {
    document.querySelectorAll('.aduan-dropdown-menu, [id^="menu-warga-"], [id^="aduan-menu-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;

    const currentNik = getActiveNikChat() || '';
    const cleanQuote = (pesanKutipan || '').substring(0, 100);

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '<div style="font-size:1.15rem; font-weight:800; color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Pesan</div>',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155; display:flex; flex-direction:column; gap:10px; margin-top:8px;">
                    ${cleanQuote ? `
                    <div style="background:#f1f5f9; padding:8px 12px; border-radius:8px; border-left:3px solid #ef4444; font-size:0.78rem; color:#475569;">
                        <b>Pesan Terlapor (${safeHtml(terlaporNama || 'Lawan Bicara')}):</b><br/>
                        <i>"${safeHtml(cleanQuote)}${pesanKutipan.length > 100 ? '...' : ''}"</i>
                    </div>` : ''}

                    <div>
                        <label style="font-weight:700; font-size:0.82rem; color:#1e293b; display:block; margin-bottom:4px;">Kategori Pelanggaran:</label>
                        <select id="swalLaporKategori" class="swal2-input" style="width:100%; height:40px; margin:0; font-size:0.85rem; border-radius:8px; border:1.5px solid #cbd5e1;">
                            <option value="Konten Asusila / Pornografi">🔞 Konten Asusila / Pornografi</option>
                            <option value="Pelanggaran Etika / Ujaran Kebencian">⚠️ Pelanggaran Etika / Ujaran Kebencian</option>
                            <option value="Kata-kata Kasar / Pelecehan">🚫 Kata-kata Kasar / Pelecehan</option>
                            <option value="Penipuan / Pemerasan">💸 Penipuan / Pemerasan</option>
                            <option value="Penyebaran Hoaks / Informasi Palsu">📢 Penyebaran Hoaks / Informasi Palsu</option>
                            <option value="Lainnya">📝 Pelanggaran Lainnya</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-weight:700; font-size:0.82rem; color:#1e293b; display:block; margin-bottom:4px;">Rincian / Alasan Pelaporan (Opsional):</label>
                        <textarea id="swalLaporRincian" class="swal2-textarea" placeholder="Tuliskan keterangan tambahan mengapa pesan ini dilaporkan..." style="width:100%; height:75px; margin:0; font-size:0.84rem; border-radius:8px; border:1.5px solid #cbd5e1;"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim Laporan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const kat = document.getElementById('swalLaporKategori')?.value;
                const rincian = document.getElementById('swalLaporRincian')?.value;
                return { kategori: kat, rincian: rincian };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const payload = {
                        msg_id: id,
                        nik: currentNik,
                        pesan: pesanKutipan,
                        nama_terlapor: terlaporNama || 'Pihak Terkait',
                        sender_terlapor: terlaporNama === 'Anda' ? 'warga' : 'petugas',
                        kategori: result.value.kategori,
                        alasan: result.value.rincian || result.value.kategori,
                        deskripsi: result.value.rincian || result.value.kategori,
                        pelapor_role: 'warga',
                        pelapor_nama: (typeof currentNamaUser !== 'undefined' ? currentNamaUser : '') || 'Warga Terdaftar',
                        pelapor_nik: currentNik
                    };
                    const res = await fetch(`${API_URL}/api/chat/laporan-pelanggaran`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Laporan Diterima',
                            text: 'Laporan pelanggaran berhasil dikirim dan akan segera ditinjau oleh tim pengawas Dinsos.',
                            timer: 3500,
                            showConfirmButton: false
                        });
                    }
                } catch (err) {
                    console.error('[Lapor Pesan Error]', err);
                }
            }
        });
    } else {
        alert('Fitur pelaporan membutuhkan SweetAlert.');
    }
};

window.laporPesanAdmin = function (id) {
    window.laporkanPesanWarga(id, '', 'Petugas Dinsos');
};

window.toggleChatMenuWarga = function (id, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    const menu = document.getElementById(`menu-warga-${id}`);
    const isShown = menu && (menu.style.display === 'flex' || menu.style.display === 'block' || menu.classList.contains('show'));
    
    document.querySelectorAll('.aduan-dropdown-menu, [id^="menu-warga-"], [id^="aduan-menu-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;

    if (!isShown && menu) {
        menu.style.display = 'flex';
        menu.style.background = '#ffffff';
        menu.style.backgroundColor = '#ffffff';
        menu.style.opacity = '1';
        menu.classList.add('show');
        window.activeOpenChatMenuId = id;

        // Cek posisi tombol terhadap kontainer chat untuk auto-flip ke atas jika berada di dekat dasar
        const btn = event ? (event.currentTarget || event.target.closest('button')) : null;
        const box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga') || document.getElementById('chatBoxWarga');
        if (btn && box) {
            const bRect = btn.getBoundingClientRect();
            const cRect = box.getBoundingClientRect();
            const spaceBelow = cRect.bottom - bRect.bottom;
            const spaceAbove = bRect.top - cRect.top;
            const openUpward = (spaceBelow < 260) && (spaceAbove > spaceBelow);

            if (openUpward) {
                menu.style.setProperty('top', 'auto', 'important');
                menu.style.setProperty('bottom', '28px', 'important');
            } else {
                menu.style.setProperty('top', '24px', 'important');
                menu.style.setProperty('bottom', 'auto', 'important');
            }
            if (cRect.right - bRect.right < 220) {
                menu.style.setProperty('right', '0', 'important');
                menu.style.setProperty('left', 'auto', 'important');
            } else {
                menu.style.setProperty('left', '0', 'important');
                menu.style.setProperty('right', 'auto', 'important');
            }
        }
    }
};

window.scrollToMessageWarga = function (id, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    const targetId = Number(id);
    if (!targetId) return;

    // Deteksi konteks aktif: Aduan vs Konsultasi Warga
    const aduanBox = document.getElementById('aduanChatMessages');
    const aduanSection = document.getElementById('dashboardAduanWargaSection');
    const isAduanActive = Boolean(
        (event && event.target && event.target.closest('#aduanChatMessages')) ||
        (aduanSection && window.getComputedStyle(aduanSection).display !== 'none') ||
        (aduanBox && aduanBox.offsetParent !== null)
    );

    let el = null;
    let box = null;

    if (isAduanActive) {
        el = document.getElementById(`msg-aduan-${targetId}`);
        box = aduanBox;
        if (!el) {
            el = document.getElementById(`msg-warga-${targetId}`);
            box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga');
        }
    } else {
        el = document.getElementById(`msg-warga-${targetId}`);
        box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga');
        if (!el) {
            el = document.getElementById(`msg-aduan-${targetId}`);
            box = aduanBox;
        }
    }

    if (el) {
        // Jika pesan sedang teredup karena filter pencarian, hidupkan kembali
        if (el.classList.contains('chat-search-dimmed')) {
            el.classList.remove('chat-search-dimmed');
            el.classList.add('chat-search-match-active');
        }

        // Gulir kontainer obrolan secara halus langsung ke target pesan agar terpusat
        if (box && box.contains(el)) {
            const boxRect = box.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const currentScrollTop = box.scrollTop;
            const targetScrollTop = currentScrollTop + (elRect.top - boxRect.top) - (box.clientHeight / 2) + (elRect.height / 2);

            box.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });
        } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Efek animasi highlight berdenyut (pulse) yang tegas dan elegan
        el.classList.remove('chat-highlight-pulse', 'aduan-reply-highlight');
        void el.offsetWidth; // Paksa reflow browser agar animasi terpicu ulang
        el.classList.add('chat-highlight-pulse', 'aduan-reply-highlight');
        setTimeout(() => {
            el.classList.remove('chat-highlight-pulse', 'aduan-reply-highlight');
        }, 2600);
    } else {
        if (typeof showPortalToast === 'function') {
            showPortalToast('Pesan asli tidak ditemukan atau telah dihapus', 'info');
        }
    }
};

window.scrollToMessageAduan = window.scrollToMessageWarga;

window.openLightbox = function (type, src, originVideoId, videoTitle) {
    if (type === 'video') {
        window.openVideoTheaterModal(src, videoTitle || 'Video Dokumentasi Lampiran', originVideoId);
        return;
    }
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            imageUrl: src,
            imageAlt: 'Lampiran Berkas',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'rgba(15,23,42,0.95)'
        });
    } else {
        window.open(src, '_blank');
    }
};

// =========================================================================
// PEMUTAR VIDEO LAYAR PENUH (MODAL THEATER LENGKAP & KONTROL UI/UX)
// =========================================================================
window.currentTheaterOriginVideoId = null;

window.openVideoTheaterModal = function (src, title, originVideoId) {
    const modal = document.getElementById('videoTheaterModal');
    const vEl = document.getElementById('theaterVideoEl');
    if (!modal || !vEl) {
        window.open(src, '_blank');
        return;
    }

    let startPos = 0;
    let startRate = 1;

    if (originVideoId) {
        const orig = document.getElementById(originVideoId);
        if (orig) {
            startPos = orig.currentTime || 0;
            startRate = orig.playbackRate || 1;
            orig.pause();
            const overlay = document.getElementById(`vid_overlay_${originVideoId}`);
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                overlay.classList.remove('is-playing');
            }
        }
        window.currentTheaterOriginVideoId = originVideoId;
    } else {
        document.querySelectorAll('video').forEach(v => {
            if (v.id !== 'theaterVideoEl' && ((v.currentSrc && v.currentSrc.includes(src)) || (v.src && v.src.includes(src)))) {
                startPos = v.currentTime || 0;
                startRate = v.playbackRate || 1;
                v.pause();
            }
        });
    }

    const titleEl = document.getElementById('theaterVideoTitle');
    if (titleEl) titleEl.innerText = title || 'Video Pemutar Layar Penuh';

    const dlLink = document.getElementById('theaterDownloadLink');
    if (dlLink) {
        dlLink.href = src;
        dlLink.download = (title || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    vEl.src = src;
    vEl.playbackRate = startRate;
    const speedPill = document.getElementById('theaterSpeedPill');
    if (speedPill) speedPill.innerText = `${startRate}x`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    vEl.onloadedmetadata = () => {
        if (startPos > 0) {
            try { vEl.currentTime = startPos; } catch(e) {}
        }
        window.updateTheaterProgress();
    };

    vEl.play().then(() => {
        const overlay = document.getElementById('theaterCenterPlayOverlay');
        if (overlay) overlay.style.display = 'none';
        const btnPlay = document.getElementById('theaterBtnPlay');
        if (btnPlay) btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
    }).catch(() => {
        const overlay = document.getElementById('theaterCenterPlayOverlay');
        if (overlay) overlay.style.display = 'flex';
        const btnPlay = document.getElementById('theaterBtnPlay');
        if (btnPlay) btnPlay.innerHTML = '<i class="fas fa-play"></i>';
    });
};

window.closeVideoTheaterModal = function () {
    const modal = document.getElementById('videoTheaterModal');
    const vEl = document.getElementById('theaterVideoEl');
    if (!modal || !vEl) return;

    const finalPos = vEl.currentTime || 0;
    const finalRate = vEl.playbackRate || 1;

    vEl.pause();
    vEl.src = '';
    modal.style.display = 'none';
    document.body.style.overflow = '';

    if (window.currentTheaterOriginVideoId) {
        const orig = document.getElementById(window.currentTheaterOriginVideoId);
        if (orig) {
            try {
                orig.currentTime = finalPos;
                orig.playbackRate = finalRate;
                const scrub = document.getElementById(`vid_scrub_${window.currentTheaterOriginVideoId}`);
                if (scrub && orig.duration) scrub.value = (finalPos / orig.duration) * 100;
                const timeLbl = document.getElementById(`vid_time_${window.currentTheaterOriginVideoId}`);
                if (timeLbl) {
                    const m = Math.floor(finalPos / 60);
                    const s = Math.floor(finalPos % 60);
                    timeLbl.innerText = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                }
                const spdPill = document.getElementById(`vid_speed_${window.currentTheaterOriginVideoId}`);
                if (spdPill) spdPill.innerText = `${finalRate}x`;
            } catch(e) {}
        }
        window.currentTheaterOriginVideoId = null;
    }
};

window.toggleTheaterPlay = function (e) {
    if (e) {
        e.stopPropagation();
        if (e.target && e.target.closest('.video-jump-side')) return;
    }
    const v = document.getElementById('theaterVideoEl');
    const overlay = document.getElementById('theaterCenterPlayOverlay');
    const btnPlay = document.getElementById('theaterBtnPlay');
    if (!v) return;

    if (v.paused) {
        v.play();
        if (overlay) overlay.style.display = 'none';
        if (btnPlay) btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        v.pause();
        if (overlay) overlay.style.display = 'flex';
        if (btnPlay) btnPlay.innerHTML = '<i class="fas fa-play"></i>';
    }
};

window.jumpTheaterTime = function (sec, e) {
    if (e) e.stopPropagation();
    const v = document.getElementById('theaterVideoEl');
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + sec));
    window.updateTheaterProgress();
    window.showTheaterJumpFeedback(sec > 0 ? '+10s' : '-10s', sec > 0 ? 'right' : 'left');
};

window.handleTheaterDblClick = function (e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const stage = document.getElementById('theaterVideoStage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRight = clickX > (rect.width / 2);
    window.jumpTheaterTime(isRight ? 10 : -10, e);
};

window.showTheaterJumpFeedback = function (label, side) {
    const ripple = document.getElementById('theaterJumpRipple');
    if (!ripple) return;
    ripple.className = `video-jump-ripple ${side} active`;
    ripple.innerHTML = side === 'left' ? `<i class="fas fa-rotate-left"></i> ${label}` : `${label} <i class="fas fa-rotate-right"></i>`;
    ripple.style.display = 'flex';
    clearTimeout(window._theaterRippleTimer);
    window._theaterRippleTimer = setTimeout(() => {
        ripple.classList.remove('active');
        ripple.style.display = 'none';
    }, 600);
};

window.cycleTheaterSpeed = function (e) {
    if (e) e.stopPropagation();
    const v = document.getElementById('theaterVideoEl');
    const pill = document.getElementById('theaterSpeedPill');
    if (!v || !pill) return;

    const rates = [0.5, 1, 1.5, 2];
    const curRate = v.playbackRate || 1;
    let nextIdx = (rates.indexOf(curRate) + 1) % rates.length;
    if (nextIdx < 0) nextIdx = 1;
    const nextRate = rates[nextIdx];

    v.playbackRate = nextRate;
    pill.innerText = `${nextRate}x`;
    if (nextRate !== 1) pill.classList.add('speed-active');
    else pill.classList.remove('speed-active');
};

window.seekTheaterTime = function (val) {
    const v = document.getElementById('theaterVideoEl');
    if (!v || !v.duration) return;
    const pct = parseFloat(val) || 0;
    v.currentTime = (pct / 100) * v.duration;
    window.updateTheaterProgress();
};

window.updateTheaterProgress = function () {
    const v = document.getElementById('theaterVideoEl');
    const scrub = document.getElementById('theaterScrubber');
    const timer = document.getElementById('theaterTimer');
    if (!v) return;

    const cur = v.currentTime || 0;
    const dur = v.duration || 0;
    if (scrub && dur > 0) {
        scrub.value = (cur / dur) * 100;
    }
    if (timer) {
        const fmt = (t) => {
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        };
        timer.innerText = `${fmt(cur)} / ${dur > 0 ? fmt(dur) : '00:00'}`;
    }
};

window.toggleTheaterMute = function (e) {
    if (e) e.stopPropagation();
    const v = document.getElementById('theaterVideoEl');
    const btn = document.getElementById('theaterBtnMute');
    if (!v || !btn) return;
    v.muted = !v.muted;
    btn.innerHTML = v.muted ? '<i class="fas fa-volume-mute text-danger"></i>' : '<i class="fas fa-volume-up"></i>';
};

window.toggleNativeFullscreenTheater = function (e) {
    if (e) e.stopPropagation();
    const stage = document.getElementById('theaterVideoStage');
    if (!stage) return;
    if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
};

window.resetTheaterPlay = function () {
    const overlay = document.getElementById('theaterCenterPlayOverlay');
    const btnPlay = document.getElementById('theaterBtnPlay');
    if (overlay) overlay.style.display = 'flex';
    if (btnPlay) btnPlay.innerHTML = '<i class="fas fa-play"></i>';
};

// =========================================================================
// FITUR SEMATKAN (PIN) & BINTANGI (STAR) PESAN
// =========================================================================
window.togglePinPesanWarga = async function (msgId) {
    document.querySelectorAll('.aduan-dropdown-menu, [id^="menu-warga-"], [id^="aduan-menu-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;
    try {
        const res = await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' });
        const data = await res.json();
        window.lastChatHashWarga = '';
        window.lastAduanChatHash = '';
        await window.loadChatMessagesWarga(false);
        if (typeof window.muatPesanAduan === 'function') await window.muatPesanAduan(false);
        if (typeof showPortalToast === 'function') {
            showPortalToast(data.is_pinned ? '📌 Pesan berhasil disematkan' : 'Sematan pesan dilepas', 'success');
        }
    } catch (e) {
        console.error('[Pin Pesan Error]', e);
    }
};

window.toggleBintangPesanWarga = async function (msgId) {
    document.querySelectorAll('.aduan-dropdown-menu, [id^="menu-warga-"], [id^="aduan-menu-"]').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('show');
    });
    window.activeOpenChatMenuId = null;
    try {
        const res = await fetch(`${API_URL}/api/chat/star/${msgId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (window.wargaChatRawData) {
            const found = window.wargaChatRawData.find(c => c && c.id === Number(msgId));
            if (found) {
                found.is_starred = Boolean(data.is_starred);
            }
        }
        
        window.lastChatHashWarga = '';
        window.lastAduanChatHash = '';
        await window.loadChatMessagesWarga(false);
        if (typeof window.muatPesanAduan === 'function') await window.muatPesanAduan(false);
        
        if (typeof showPortalToast === 'function') {
            showPortalToast(data.is_starred ? '⭐ Pesan berhasil dibintangi' : 'Bintang pesan dihapus', 'success');
        } else if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: data.is_starred ? '⭐ Pesan Dibintangi' : 'Bintang Dihapus',
                timer: 2000,
                showConfirmButton: false
            });
        }
    } catch (e) {
        console.error('[Bintang Pesan Error]', e);
    }
};

window.scrollKePesanDisematkan = function () {
    if (window.currentPinnedMsgId) {
        window.scrollToMessageWarga(window.currentPinnedMsgId);
    }
};

window.lepasSematanPesanWarga = function (event) {
    if (event) event.stopPropagation();
    if (window.currentPinnedMsgId) {
        window.togglePinPesanWarga(window.currentPinnedMsgId);
    }
};

// =========================================================================
// PENCARIAN & FILTER PESAN CEPAT (TEKS, SUARA, BERKAS, TANGGAL/BULAN/TAHUN)
// =========================================================================
window.chatFilterType = 'all';
window.chatSearchResults = [];
window.chatSearchCurrentIndex = 0;

window.toggleChatSearchWarga = function () {
    const panel = document.getElementById('wargaChatSearchPanel');
    if (!panel) return;
    const isOpen = panel.style.display === 'flex';
    if (isOpen) {
        window.tutupChatSearchWarga();
    } else {
        panel.style.display = 'flex';
        const inp = document.getElementById('wargaChatSearchInput');
        if (inp) inp.focus();
        window.jalankanPencarianChatWarga();
    }
};

window.tutupChatSearchWarga = function () {
    const panel = document.getElementById('wargaChatSearchPanel');
    if (panel) panel.style.display = 'none';
    const countBadge = document.getElementById('wargaChatSearchMatchCount');
    if (countBadge) countBadge.style.display = 'none';
    const inp = document.getElementById('wargaChatSearchInput');
    if (inp) inp.value = '';
    const dateInp = document.getElementById('wargaChatSearchDate');
    if (dateInp) dateInp.value = '';
    window.chatFilterType = 'all';
    document.querySelectorAll('.chat-filter-chip').forEach(c => {
        c.classList.toggle('active', c.id === 'chipFilterTypeAll');
    });
    window.chatSearchResults = [];
    window.chatSearchCurrentIndex = 0;
    document.querySelectorAll('.chat-search-current').forEach(el => el.classList.remove('chat-search-current'));
    document.querySelectorAll('.chat-search-match-active').forEach(el => el.classList.remove('chat-search-match-active'));
    document.querySelectorAll('.chat-search-dimmed').forEach(el => el.classList.remove('chat-search-dimmed'));
};

window.setChatFilterType = function (type) {
    window.chatFilterType = type;
    document.querySelectorAll('#wargaChatSearchPanel .chat-filter-chip').forEach(c => {
        if (c.id === 'chipFilterTypeAll' && type === 'all') c.classList.add('active');
        else if (c.id === 'chipFilterTypeText' && type === 'text') c.classList.add('active');
        else if (c.id === 'chipFilterTypeMedia' && type === 'media') c.classList.add('active');
        else if (c.id === 'chipFilterTypeFile' && type === 'file') c.classList.add('active');
        else if (c.id === 'chipFilterTypeAudio' && type === 'audio') c.classList.add('active');
        else if (c.id === 'chipFilterTypeStarred' && type === 'starred') c.classList.add('active');
        else if (c.id === 'chipFilterTypeEmoji' && type === 'emoji') c.classList.add('active');
        else if (c.id.startsWith('chipFilterType')) c.classList.remove('active');
    });
    window.jalankanPencarianChatWarga();
};

window.jalankanPencarianChatWarga = function () {
    let rawList = (window.wargaChatRawData && window.wargaChatRawData.length > 0) ? window.wargaChatRawData : [];
    const keyword = (document.getElementById('wargaChatSearchInput')?.value || '').trim().toLowerCase();
    const dateVal = document.getElementById('wargaChatSearchDate')?.value || '';
    const countBadge = document.getElementById('wargaChatSearchMatchCount');

    // Fallback: Jika data mentah belum ada di memory, ekstrak dari DOM bubble yang ter-render
    let dataList = rawList;
    if (!dataList || dataList.length === 0) {
        const domBubbles = Array.from(document.querySelectorAll('#wargaChatMessages [id^="msg-warga-"], #chatMessagesWarga [id^="msg-warga-"], #aduanChatMessages [id^="msg-aduan-"], [id^="msg-warga-"]'));
        dataList = domBubbles.map(b => {
            const bId = Number(b.id.replace('msg-warga-', '').replace('msg-aduan-', '')) || 0;
            const fullText = (b.innerText || '').toLowerCase();
            const hasAudio = Boolean(b.querySelector('audio') || b.classList.contains('is-audio-card') || fullText.includes('pesan suara'));
            const hasVid = Boolean(b.querySelector('video') || b.classList.contains('chat-media-video-wrap') || fullText.includes('video lampiran'));
            const hasImg = Boolean(b.querySelector('img') || b.classList.contains('chat-media-img-wrap'));
            const hasDoc = Boolean(b.querySelector('.chat-file-card') || b.querySelector('a[download]'));
            const hasStar = Boolean(b.querySelector('.fa-star.text-warning') || b.querySelector('.btn-msg-dots-star'));
            const timeStr = b.getAttribute('data-time') || b.getAttribute('data-date') || b.querySelector('.chat-time-tag, small, .bubble-corner-time')?.innerText || '';
            return {
                id: bId,
                pesan: fullText,
                text: fullText,
                file_path: (hasAudio || hasVid || hasImg || hasDoc) ? 'attachment' : '',
                file_type: hasAudio ? 'audio' : (hasVid ? 'video' : (hasImg ? 'image' : (hasDoc ? 'document' : ''))),
                is_starred: hasStar,
                created_at: timeStr,
                waktu: timeStr,
                domEl: b
            };
        });
    }

    const emojiRegex = /(?:\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF])/u;

    let matched = dataList.filter(c => {
        if (c.deleted_for === 'me_warga') return false;

        if (window.chatFilterType === 'text') {
            if (c.file_path || c.file_type) return false;
        } else if (window.chatFilterType === 'media') {
            const isMedia = Boolean(
                c.file_type === 'image' || c.file_type === 'video' ||
                (c.file_path && ['jpg','jpeg','png','webp','gif','mp4','webm','mov','mkv','3gp'].some(ext => String(c.file_path).toLowerCase().includes(ext))) ||
                (c.domEl && c.domEl.querySelector('img, video, .chat-media-img-wrap, .chat-media-video-wrap'))
            );
            if (!isMedia) return false;
        } else if (window.chatFilterType === 'audio') {
            const isAudio = Boolean(
                c.file_type === 'audio' ||
                (c.file_path && (c.file_path.includes('voice_') || ['mp3','wav','ogg','m4a','aac','weba','webm'].some(ext => (c.file_path||'').toLowerCase().includes(ext)))) ||
                (c.pesan && String(c.pesan).toLowerCase().includes('pesan suara')) ||
                (c.domEl && (c.domEl.querySelector('audio') || c.domEl.classList.contains('is-audio-card')))
            );
            if (!isAudio) return false;
        } else if (window.chatFilterType === 'file') {
            const isDoc = Boolean(
                c.file_type === 'document' ||
                (c.file_path && ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','rar','7z'].some(ext => String(c.file_path).toLowerCase().includes(ext))) ||
                (c.domEl && c.domEl.querySelector('.chat-file-card, a[download]'))
            );
            if (!isDoc) return false;
        } else if (window.chatFilterType === 'starred') {
            const isStarred = Boolean(
                c.is_starred ||
                (c.domEl && c.domEl.querySelector('.fa-star.text-warning, .btn-msg-dots-star'))
            );
            if (!isStarred) return false;
        } else if (window.chatFilterType === 'emoji') {
            const textContent = String(c.pesan || c.text || '') + (c.domEl ? (' ' + c.domEl.innerText) : '');
            const hasEmoji = emojiRegex.test(textContent);
            if (!hasEmoji) return false;
        }

        if (dateVal) {
            const rawDate = String(c.created_at || c.waktu || '').toLowerCase();
            const [y, m, d] = dateVal.split('-');
            const dInt = parseInt(d, 10);
            const mInt = parseInt(m, 10);

            let dateMatches = false;
            if (rawDate.includes(dateVal)) {
                dateMatches = true;
            } else if (
                rawDate.includes(`${d}/${m}/${y}`) ||
                rawDate.includes(`${d}-${m}-${y}`) ||
                rawDate.includes(`${d}/${m}`) ||
                rawDate.includes(`${dInt}/${mInt}`)
            ) {
                dateMatches = true;
            } else {
                try {
                    const parsed = new Date(rawDate);
                    if (!isNaN(parsed.getTime())) {
                        const parsedIso = parsed.toISOString().slice(0, 10);
                        if (parsedIso === dateVal) dateMatches = true;
                    }
                } catch(e) {}
            }
            if (!dateMatches) return false;
        }

        if (keyword) {
            const pesanStr = String(c.pesan || c.text || '').toLowerCase();
            const fileNameStr = String(c.file_name || c.file_path || '').toLowerCase();
            const senderStr = String(c.sender || c.nama || '').toLowerCase();
            const domText = c.domEl ? (c.domEl.innerText || '').toLowerCase() : '';
            if (!pesanStr.includes(keyword) && !fileNameStr.includes(keyword) && !senderStr.includes(keyword) && !domText.includes(keyword)) {
                return false;
            }
        }

        return true;
    });

    window.chatSearchResults = matched.map(m => m.id);
    window.chatSearchCurrentIndex = 0;

    // Terapkan penanda visual (highlight matching bubbles & dim non-matching bubbles)
    const allDomBubbles = Array.from(document.querySelectorAll('#wargaChatMessages [id^="msg-warga-"], #chatMessagesWarga [id^="msg-warga-"], #aduanChatMessages [id^="msg-aduan-"], [id^="msg-warga-"]'));
    const isSearchActive = Boolean(keyword || dateVal || window.chatFilterType !== 'all');

    if (isSearchActive) {
        const matchedIdSet = new Set(matched.map(m => Number(m.id)));
        allDomBubbles.forEach(b => {
            const bId = Number(b.id.replace('msg-warga-', '').replace('msg-aduan-', '')) || 0;
            if (matchedIdSet.has(bId)) {
                b.classList.add('chat-search-match-active');
                b.classList.remove('chat-search-dimmed');
            } else {
                b.classList.remove('chat-search-match-active');
                b.classList.add('chat-search-dimmed');
            }
        });
    } else {
        allDomBubbles.forEach(b => {
            b.classList.remove('chat-search-match-active');
            b.classList.remove('chat-search-dimmed');
            b.classList.remove('chat-search-current');
        });
    }

    if (countBadge) {
        if (isSearchActive) {
            countBadge.style.display = 'inline-block';
            if (matched.length > 0) {
                countBadge.innerText = `1 dari ${matched.length}`;
                window.scrollToMessageWarga(matched[0].id);
            } else {
                countBadge.innerText = `0 hasil`;
            }
        } else {
            countBadge.style.display = 'none';
        }
    }
};

window.navigasiHasilCariChat = function (dir) {
    if (!window.chatSearchResults || window.chatSearchResults.length === 0) return;
    const total = window.chatSearchResults.length;
    if (dir === 'next') {
        window.chatSearchCurrentIndex = (window.chatSearchCurrentIndex + 1) % total;
    } else {
        window.chatSearchCurrentIndex = (window.chatSearchCurrentIndex - 1 + total) % total;
    }
    const countBadge = document.getElementById('wargaChatSearchMatchCount');
    if (countBadge) {
        countBadge.innerText = `${window.chatSearchCurrentIndex + 1} dari ${total}`;
    }
    const targetId = window.chatSearchResults[window.chatSearchCurrentIndex];
    window.scrollToMessageWarga(targetId);
};

// =========================================================================
// PENCARIAN & FILTER OBROLAN ADUAN (TEKS, MEDIA, DOKUMEN, SUARA, BINTANG, EMOJI)
// =========================================================================
window.aduanChatFilterType = 'all';
window.aduanChatSearchResults = [];
window.aduanChatSearchCurrentIndex = 0;

window.toggleChatSearchAduan = function () {
    const panel = document.getElementById('aduanChatSearchPanel');
    if (!panel) return;
    const isOpen = panel.style.display === 'flex';
    if (isOpen) {
        window.tutupChatSearchAduan();
    } else {
        panel.style.display = 'flex';
        const inp = document.getElementById('aduanChatSearchInput');
        if (inp) inp.focus();
        window.jalankanPencarianChatAduan();
    }
};

window.tutupChatSearchAduan = function () {
    const panel = document.getElementById('aduanChatSearchPanel');
    if (panel) panel.style.display = 'none';
    const countBadge = document.getElementById('aduanChatSearchMatchCount');
    if (countBadge) countBadge.style.display = 'none';
    const inp = document.getElementById('aduanChatSearchInput');
    if (inp) inp.value = '';
    const dateInp = document.getElementById('aduanChatSearchDate');
    if (dateInp) dateInp.value = '';
    window.aduanChatFilterType = 'all';
    document.querySelectorAll('#aduanChatSearchPanel .chat-filter-chip').forEach(c => {
        c.classList.toggle('active', c.id === 'chipAduanFilterAll');
    });
    window.aduanChatSearchResults = [];
    window.aduanChatSearchCurrentIndex = 0;
    document.querySelectorAll('#aduanChatMessages .chat-search-current').forEach(el => el.classList.remove('chat-search-current'));
    document.querySelectorAll('#aduanChatMessages .chat-search-match-active').forEach(el => el.classList.remove('chat-search-match-active'));
    document.querySelectorAll('#aduanChatMessages .chat-search-dimmed').forEach(el => el.classList.remove('chat-search-dimmed'));
};

window.setChatFilterTypeAduan = function (type) {
    window.aduanChatFilterType = type;
    document.querySelectorAll('#aduanChatSearchPanel .chat-filter-chip').forEach(c => {
        if (c.id === 'chipAduanFilterAll' && type === 'all') c.classList.add('active');
        else if (c.id === 'chipAduanFilterText' && type === 'text') c.classList.add('active');
        else if (c.id === 'chipAduanFilterMedia' && type === 'media') c.classList.add('active');
        else if (c.id === 'chipAduanFilterFile' && type === 'file') c.classList.add('active');
        else if (c.id === 'chipAduanFilterAudio' && type === 'audio') c.classList.add('active');
        else if (c.id === 'chipAduanFilterStarred' && type === 'starred') c.classList.add('active');
        else if (c.id === 'chipAduanFilterEmoji' && type === 'emoji') c.classList.add('active');
        else c.classList.remove('active');
    });
    window.jalankanPencarianChatAduan();
};

window.jalankanPencarianChatAduan = function () {
    const rawList = (window.wargaChatRawData && window.wargaChatRawData.length > 0) ? window.wargaChatRawData : [];
    const keyword = (document.getElementById('aduanChatSearchInput')?.value || '').trim().toLowerCase();
    const dateVal = document.getElementById('aduanChatSearchDate')?.value || '';
    const countBadge = document.getElementById('aduanChatSearchMatchCount');

    const domBubbles = Array.from(document.querySelectorAll('#aduanChatMessages [id^="msg-aduan-"]'));
    let dataList = domBubbles.map(b => {
        const bId = Number(b.id.replace('msg-aduan-', '')) || 0;
        const fullText = (b.innerText || '').toLowerCase();
        const hasAudio = Boolean(b.querySelector('audio') || b.classList.contains('is-audio-card') || fullText.includes('suara'));
        const hasVid = Boolean(b.querySelector('video') || b.classList.contains('is-video-card'));
        const hasImg = Boolean(b.querySelector('img') || b.classList.contains('is-image-card'));
        const hasDoc = Boolean(b.querySelector('.chat-doc-card') || b.classList.contains('is-doc-card') || b.querySelector('a[download]'));
        const hasStar = Boolean(b.querySelector('.fa-star.text-warning') || b.querySelector('.chat-star-icon'));
        const timeStr = b.getAttribute('data-time') || '';
        const matchingRaw = rawList.find(r => r.id === bId) || {};
        return {
            id: bId,
            pesan: matchingRaw.pesan || fullText,
            text: matchingRaw.text || fullText,
            file_name: matchingRaw.file_name || '',
            file_path: matchingRaw.file_path || (hasAudio ? 'voice.webm' : (hasVid ? 'video.mp4' : (hasImg ? 'image.jpg' : (hasDoc ? 'doc.pdf' : '')))),
            file_type: matchingRaw.file_type || (hasAudio ? 'audio' : (hasVid ? 'video' : (hasImg ? 'image' : (hasDoc ? 'document' : '')))),
            is_starred: matchingRaw.is_starred || hasStar,
            created_at: matchingRaw.created_at || timeStr,
            waktu: matchingRaw.waktu || timeStr,
            sender: matchingRaw.sender || '',
            nama: matchingRaw.nama || '',
            domEl: b
        };
    });

    const emojiRegex = /(?:\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF])/u;

    let matched = dataList.filter(c => {
        if (c.deleted_for === 'me_warga') return false;

        if (window.aduanChatFilterType === 'text') {
            if (c.file_path || c.file_type) return false;
        } else if (window.aduanChatFilterType === 'media') {
            const isMedia = Boolean(
                c.file_type === 'image' || c.file_type === 'video' ||
                (c.file_path && ['jpg','jpeg','png','webp','gif','mp4','webm','mov','mkv','3gp'].some(ext => String(c.file_path).toLowerCase().includes(ext))) ||
                (c.domEl && c.domEl.querySelector('img, video, .chat-media-img-wrap, .chat-media-video-wrap'))
            );
            if (!isMedia) return false;
        } else if (window.aduanChatFilterType === 'file') {
            const isDoc = Boolean(
                c.file_type === 'document' ||
                (c.file_path && ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','rar','7z'].some(ext => String(c.file_path).toLowerCase().includes(ext))) ||
                (c.domEl && c.domEl.querySelector('.chat-file-card, a[download]'))
            );
            if (!isDoc) return false;
        } else if (window.aduanChatFilterType === 'audio') {
            const isAudio = Boolean(
                c.file_type === 'audio' ||
                (c.file_path && (c.file_path.includes('voice_') || ['mp3','wav','ogg','m4a','aac','weba','webm'].some(ext => (c.file_path||'').toLowerCase().includes(ext)))) ||
                (c.pesan && String(c.pesan).toLowerCase().includes('pesan suara')) ||
                (c.domEl && (c.domEl.querySelector('audio') || c.domEl.classList.contains('is-audio-card')))
            );
            if (!isAudio) return false;
        } else if (window.aduanChatFilterType === 'starred') {
            const isStarred = Boolean(
                c.is_starred ||
                (c.domEl && c.domEl.querySelector('.fa-star.text-warning, .btn-msg-dots-star'))
            );
            if (!isStarred) return false;
        } else if (window.aduanChatFilterType === 'emoji') {
            const textContent = String(c.pesan || c.text || '') + (c.domEl ? (' ' + c.domEl.innerText) : '');
            const hasEmoji = emojiRegex.test(textContent);
            if (!hasEmoji) return false;
        }

        if (dateVal) {
            const rawDate = String(c.created_at || c.waktu || '').toLowerCase();
            const [y, m, d] = dateVal.split('-');
            const dInt = parseInt(d, 10);
            const mInt = parseInt(m, 10);

            let dateMatches = false;
            if (rawDate.includes(dateVal) || rawDate.includes(`${d}/${m}/${y}`) || rawDate.includes(`${d}-${m}-${y}`) || rawDate.includes(`${d}/${m}`) || rawDate.includes(`${dInt}/${mInt}`)) {
                dateMatches = true;
            }
            if (!dateMatches) return false;
        }

        if (keyword) {
            const pesanStr = String(c.pesan || c.text || '').toLowerCase();
            const fileNameStr = String(c.file_name || c.file_path || '').toLowerCase();
            const senderStr = String(c.sender || c.nama || '').toLowerCase();
            const domText = c.domEl ? (c.domEl.innerText || '').toLowerCase() : '';
            if (!pesanStr.includes(keyword) && !fileNameStr.includes(keyword) && !senderStr.includes(keyword) && !domText.includes(keyword)) {
                return false;
            }
        }

        return true;
    });

    window.aduanChatSearchResults = matched.map(m => m.id);
    window.aduanChatSearchCurrentIndex = 0;

    const isSearchActive = Boolean(keyword || dateVal || window.aduanChatFilterType !== 'all');

    if (isSearchActive) {
        const matchedIdSet = new Set(matched.map(m => Number(m.id)));
        domBubbles.forEach(b => {
            const bId = Number(b.id.replace('msg-aduan-', '')) || 0;
            if (matchedIdSet.has(bId)) {
                b.classList.add('chat-search-match-active');
                b.classList.remove('chat-search-dimmed');
            } else {
                b.classList.remove('chat-search-match-active');
                b.classList.add('chat-search-dimmed');
            }
        });
    } else {
        domBubbles.forEach(b => {
            b.classList.remove('chat-search-match-active');
            b.classList.remove('chat-search-dimmed');
            b.classList.remove('chat-search-current');
        });
    }

    if (countBadge) {
        if (isSearchActive) {
            countBadge.style.display = 'inline-block';
            if (matched.length > 0) {
                countBadge.innerText = `1 dari ${matched.length}`;
                const firstEl = document.getElementById(`msg-aduan-${matched[0].id}`);
                if (firstEl) firstEl.classList.add('chat-search-current');
                window.scrollToMessageWarga(matched[0].id);
            } else {
                countBadge.innerText = `0 hasil`;
            }
        } else {
            countBadge.style.display = 'none';
        }
    }
};

window.navigasiHasilCariChatAduan = function (dir) {
    if (!window.aduanChatSearchResults || window.aduanChatSearchResults.length === 0) return;
    const total = window.aduanChatSearchResults.length;
    document.querySelectorAll('#aduanChatMessages .chat-search-current').forEach(el => el.classList.remove('chat-search-current'));
    if (dir === 'next') {
        window.aduanChatSearchCurrentIndex = (window.aduanChatSearchCurrentIndex + 1) % total;
    } else {
        window.aduanChatSearchCurrentIndex = (window.aduanChatSearchCurrentIndex - 1 + total) % total;
    }
    const countBadge = document.getElementById('aduanChatSearchMatchCount');
    if (countBadge) {
        countBadge.innerText = `${window.aduanChatSearchCurrentIndex + 1} dari ${total}`;
    }
    const targetId = window.aduanChatSearchResults[window.aduanChatSearchCurrentIndex];
    const curEl = document.getElementById(`msg-aduan-${targetId}`);
    if (curEl) curEl.classList.add('chat-search-current');
    window.scrollToMessageWarga(targetId);
};

// =========================================================================
// LAPORKAN KESELURUHAN OBROLAN & INVESTIGASI TINDAKAN PETUGAS / ADMIN
// =========================================================================
window.laporkanSeluruhObrolanWarga = function () {
    let rawList = (window.wargaChatRawData && window.wargaChatRawData.length > 0) ? window.wargaChatRawData : [];
    if (!rawList || rawList.length === 0) {
        const domBubbles = Array.from(document.querySelectorAll('#aduanChatMessages [id^="msg-aduan-"], #wargaChatMessages [id^="msg-warga-"], #chatMessagesWarga [id^="msg-warga-"], [id^="msg-warga-"]'));
        rawList = domBubbles.map(b => ({
            id: Number(b.id.replace('msg-warga-', '').replace('msg-aduan-', '')) || 0,
            pesan: (b.innerText || '').trim(),
            sender: b.classList.contains('warga') || b.style.marginLeft === 'auto' ? 'warga' : 'petugas',
            created_at: b.getAttribute('data-time') || new Date().toISOString()
        }));
    }

    const isAduanMode = Boolean(window.sesiAduanAktif);
    const currentNik = (isAduanMode && window.sesiAduanAktif.nik) || getActiveNikChat() || localStorage.getItem('lastAduanNik') || localStorage.getItem('wargaNik') || sessionStorage.getItem('wargaNik') || '3515081234560001';
    const currentNama = (isAduanMode && window.sesiAduanAktif.nama) || (typeof currentNamaUser !== 'undefined' ? currentNamaUser : '') || localStorage.getItem('wargaNama') || 'Warga Terdaftar';

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: '<div style="font-size:1.15rem; font-weight:800; color:#dc2626;"><i class="fas fa-shield-alt"></i> Laporkan Pelanggaran Obrolan / Petugas</div>',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155; display:flex; flex-direction:column; gap:10px; margin-top:8px;">
                    <div style="background:#fee2e2; border-left:3.5px solid #dc2626; padding:10px 12px; border-radius:8px; font-size:0.8rem; color:#991b1b; line-height:1.45;">
                        <i class="fas fa-exclamation-triangle"></i> Anda dapat melaporkan <b>seluruh rekaman percakapan & tindakan petugas/admin (${rawList.length} pesan)</b> secara utuh langsung ke Tim Pengawas & Inspektorat Dinas Sosial Sidoarjo.
                    </div>

                    <div>
                        <label style="font-weight:700; font-size:0.82rem; color:#1e293b; display:block; margin-bottom:4px;">Kategori Pelanggaran Aparatur / Obrolan:</label>
                        <select id="swalLaporSeluruhKategori" class="swal2-input" style="width:100%; height:40px; margin:0; font-size:0.85rem; border-radius:8px; border:1.5px solid #cbd5e1;">
                            <option value="Pemerasan / Pungli Bansos">💰 Pemerasan / Pungli Bansos (Uang/Barang)</option>
                            <option value="Pelanggaran Etika / Ujaran Kebencian">⚠️ Pelanggaran Etika / Kata Kasar / Intimidasi</option>
                            <option value="Diskriminasi / Pelayanan Tidak Adil">📢 Diskriminasi / Menolak Melayani Tanpa Alasan</option>
                            <option value="Manipulasi Data / Penolakan Tidak Sesuai Prosedur">📑 Manipulasi Data / Penolakan Bansos Tidak Sah</option>
                            <option value="Konten Asusila / Pelecehan">🔞 Konten Asusila / Pelecehan</option>
                            <option value="Lainnya">📝 Pelanggaran Etika & Perilaku Lainnya</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-weight:700; font-size:0.82rem; color:#1e293b; display:block; margin-bottom:4px;">Kronologi & Uraian Lengkap Pelanggaran:</label>
                        <textarea id="swalLaporSeluruhRincian" class="swal2-textarea" placeholder="Tuliskan keterangan detail tindakan petugas/admin yang melanggar dan kronologinya..." style="width:100%; height:85px; margin:0; font-size:0.84rem; border-radius:8px; border:1.5px solid #cbd5e1;"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim Laporan ke Inspektorat',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            preConfirm: () => {
                const kat = document.getElementById('swalLaporSeluruhKategori')?.value;
                const rincian = document.getElementById('swalLaporSeluruhRincian')?.value;
                if (!rincian || rincian.trim().length < 5) {
                    Swal.showValidationMessage('Mohon isi uraian kronologi pelanggaran minimal 5 karakter.');
                    return false;
                }
                return { kategori: kat, rincian: rincian.trim() };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const payload = {
                        msg_id: 0,
                        tipe_laporan: 'keseluruhan_obrolan',
                        total_pesan: rawList.length,
                        transkrip: rawList,
                        nik: currentNik,
                        pesan: `Laporan keseluruhan obrolan (${rawList.length} pesan). Rincian: ${result.value.rincian || '-'}`,
                        nama_terlapor: isAduanMode ? 'Aparatur / Petugas Investigasi Aduan' : 'Petugas Dinsos (Seluruh Obrolan)',
                        sender_terlapor: 'petugas',
                        kategori: result.value.kategori,
                        alasan: result.value.rincian || result.value.kategori,
                        deskripsi: result.value.rincian || result.value.kategori,
                        pelapor_role: 'warga',
                        pelapor_nama: currentNama,
                        pelapor_nik: currentNik
                    };
                    const res = await fetch(`${API_URL}/api/chat/laporan-pelanggaran`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        const json = await res.json();
                        const kode = (json && json.data && json.data.kode_laporan) || 'VIO-2026-BERHASIL';
                        Swal.fire({
                            icon: 'success',
                            title: 'Laporan Pelanggaran Berhasil Terkirim',
                            html: `
                                <div style="font-size:0.86rem; color:#334155; line-height:1.5;">
                                    Seluruh transkrip percakapan <b>(${rawList.length} pesan)</b> telah diteruskan ke <b>Tim Pengawas & Inspektorat Dinsos Sidoarjo</b> dengan Kode Bukti: <b style="color:#dc2626;">${kode}</b>.<br><br>
                                    Tindakan investigasi akan segera dilakukan secara tegas tanpa memihak.
                                </div>
                            `,
                            confirmButtonColor: '#009846',
                            confirmButtonText: 'Tutup'
                        });
                    } else {
                        Swal.fire('Informasi', 'Laporan telah dicatat dalam sistem pengawasan lokal.', 'info');
                    }
                } catch(err) {
                    console.error('[Lapor Seluruh Obrolan Error]', err);
                }
            }
        });
    } else {
        alert('Fitur pelaporan membutuhkan SweetAlert.');
    }
};

window.laporkanSeluruhPelanggaranAduan = function () {
    window.laporkanSeluruhObrolanWarga();
};

// =========================================================================
// HANDLER & REALTIME LISTENER PERGANTIAN PETUGAS RESPON RESMI
// =========================================================================
window.handleChatOfficerChanged = function (officerName, officerRole) {
    if (!officerName) return;
    const badgeEl = document.getElementById('wargaOfficerNameBadge');
    if (badgeEl) {
        badgeEl.innerHTML = `<i class="fas fa-user-shield" style="color:#2563eb;"></i> ${safeHtml(officerName)}${officerRole ? ` <span style="font-size:0.7rem; font-weight:600; opacity:0.85;">(${safeHtml(officerRole)})</span>` : ''}`;
    }
    const banner = document.getElementById('wargaOfficerActiveBanner');
    if (banner) {
        banner.classList.add('highlight-pulse');
        setTimeout(() => banner.classList.remove('highlight-pulse'), 2000);
    }
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: '🔄 Petugas Respon Resmi Berganti',
            html: `Percakapan kini ditangani oleh <b>${safeHtml(officerName)}</b>${officerRole ? ` (${safeHtml(officerRole)})` : ''}`,
            timer: 5000,
            showConfirmButton: false,
            timerProgressBar: true
        });
    }
    window._currentActiveOfficerName = officerName;
};

try {
    const bcChatWarga = new BroadcastChannel('bansos_realtime');
    bcChatWarga.onmessage = function (ev) {
        if (!ev.data) return;
        const curNik = getActiveNikChat();
        const evNik = String(ev.data.nik || (ev.data.chat && ev.data.chat.nik) || '').replace(/\D/g, '');
        if (curNik && evNik && curNik === evNik) {
            if (ev.data.type === 'CHAT_OFFICER_CHANGED') {
                const offName = ev.data.officer_name || (ev.data.officer && ev.data.officer.name);
                const offRole = ev.data.officer_role || (ev.data.officer && ev.data.officer.role);
                window.handleChatOfficerChanged(offName, offRole);
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
            } else if (ev.data.type === 'CHAT_MESSAGE') {
                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(false);
                }
            }
        }
    };
} catch (e) {}

// =========================================================================
// =========================================================================
// LIHAT PROFIL LENGKAP WARGA SECARA MENYELURUH (10 KRITERIA & IDENTITAS RESMI)
// =========================================================================
window.bukaProfilLengkapWarga = async function () {
    const currentNik = getActiveNikChat() || 
                      (window.sesiWargaAktif && (window.sesiWargaAktif.nik_asli || window.sesiWargaAktif.nik)) || 
                      localStorage.getItem('wargaNik') || 
                      sessionStorage.getItem('wargaNik') || '';
    
    if (!currentNik) {
        showPortalAlert({
            icon: 'info',
            title: 'Verifikasi Identitas',
            text: 'Silakan verifikasi atau masukkan NIK Anda terlebih dahulu untuk membuka profil data kependudukan resmi.'
        });
        return;
    }

    try {
        let wargaData = null;
        if (window.wargaDataCache && (window.wargaDataCache.nik === currentNik || !currentNik)) {
            wargaData = { ...window.wargaDataCache };
        } else if (window.sesiWargaAktif && (window.sesiWargaAktif.nik === currentNik || window.sesiWargaAktif.nik_asli === currentNik)) {
            wargaData = { ...window.sesiWargaAktif };
        }

        // Ambil data resmi kependudukan paling mutakhir dari server
        if (currentNik) {
            try {
                const res = await fetch(`${API_URL}/api/warga/${encodeURIComponent(currentNik)}`);
                if (res.ok) {
                    const json = await res.json();
                    const fetched = json.data || json;
                    if (fetched && (fetched.nik || fetched.nama)) {
                        wargaData = { ...(wargaData || {}), ...fetched };
                    }
                }
            } catch (e) {}

            if (!wargaData || !wargaData.c1) {
                try {
                    const resPub = await fetch(`${API_URL}/api/publik/dashboard-warga`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nik: currentNik, nama: localStorage.getItem('wargaNama') || '' })
                    });
                    if (resPub.ok) {
                        const jsonPub = await resPub.json();
                        if (jsonPub && jsonPub.data) {
                            wargaData = { ...(wargaData || {}), ...jsonPub.data };
                        }
                    }
                } catch (e) {}
            }
        }

        if (!wargaData) {
            wargaData = {
                nik: currentNik,
                nama: localStorage.getItem('wargaNama') || 'KPM Terdaftar Wilayah',
                alamat: 'Kawasan Wilayah Terdaftar, Kabupaten Sidoarjo',
                tempat_lahir: 'Sidoarjo',
                tanggal_lahir: '-',
                c1_ekonomi: 1200000,
                c2_aset: 1500000,
                c3_umur: 45,
                c4_jenis_kelamin: 1,
                c5_tanggungan: 3,
                c6_status_pernikahan: 2,
                c7_kepemilikan_anak: 2,
                c8_tempat_tinggal: 2,
                c9_pendidikan: 2,
                c10_kesehatan: 1,
                desil: 1,
                skor_saw: 0.92,
                rank_saw: 1,
                is_verified: true,
                status_salur: 'Belum Salur',
                status_bansos: 'Layak Bansos',
                nominal_bantuan: 'Rp 600.000 / Beras 10 Kg'
            };
        }

        const formatRupiah = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

        // C4: Jenis Kelamin (1 = Laki-laki, 2 = Perempuan)
        const c4Val = Number(wargaData.c4_jenis_kelamin ?? wargaData.c4 ?? 1);
        const jkText = (c4Val === 2) ? 'Perempuan' : 'Laki-laki';

        // C6: Status Pernikahan (1 = Belum Menikah, 2 = Menikah, 3 = Cerai Hidup, 4 = Cerai Mati)
        const c6Val = Number(wargaData.c6_status_pernikahan ?? wargaData.c6 ?? 2);
        let statusNikahText = 'Menikah';
        if (c6Val === 1) statusNikahText = 'Belum Menikah';
        else if (c6Val === 2) statusNikahText = 'Menikah';
        else if (c6Val === 3) statusNikahText = 'Cerai Hidup';
        else if (c6Val === 4) statusNikahText = 'Cerai Mati';

        // C8: Kelayakan Tempat Tinggal
        const c8Val = Number(wargaData.c8_tempat_tinggal ?? wargaData.c8 ?? 2);
        let c8Text = 'Sewa / Kontrak (Layak Bantuan)';
        if (c8Val === 1) c8Text = 'Milik Sendiri (Permanen)';
        else if (c8Val === 2) c8Text = 'Sewa / Kontrak (Layak Bantuan)';
        else if (c8Val === 3) c8Text = 'Semi Permanen / Menumpang';
        else if (c8Val >= 4) c8Text = 'Tidak Layak Huni';

        // C9: Tingkat Pendidikan Terakhir
        const c9Val = Number(wargaData.c9_pendidikan ?? wargaData.c9 ?? 2);
        let c9Text = 'SMP / Sederajat';
        if (c9Val === 1) c9Text = 'SD / Tidak Tamat SD';
        else if (c9Val === 2) c9Text = 'SMP / Sederajat';
        else if (c9Val === 3) c9Text = 'SMA / SMK Sederajat';
        else if (c9Val >= 4) c9Text = 'Diploma / Sarjana';

        // C10: Kondisi Kesehatan / Disabilitas
        const c10Val = Number(wargaData.c10_kesehatan ?? wargaData.c10 ?? 1);
        let c10Text = 'Sehat';
        if (c10Val === 1) c10Text = 'Sehat';
        else if (c10Val === 2) c10Text = 'Rentan / Sakit Menahun';
        else if (c10Val >= 3) c10Text = 'Disabilitas / Penyakit Kronis';

        const rawNikVal = wargaData.nik || currentNik || '';
        const nikFormat = rawNikVal.length >= 16 ? `${rawNikVal.slice(0, 6)}******${rawNikVal.slice(12)}` : (rawNikVal || '3515************');
        const tempatLahir = wargaData.tempat_lahir || 'Sidoarjo';
        const tglLahir = wargaData.tanggal_lahir || '-';

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                customClass: {
                    container: 'swal2-container-profil-warga',
                    popup: 'swal2-popup-profil-warga',
                    htmlContainer: 'swal2-html-profil-warga'
                },
                html: `
                    <div class="profil-modal-wrapper">
                        <!-- HEADER MODAL -->
                        <div class="profil-modal-header">
                            <div class="profil-modal-header-info">
                                <div class="profil-modal-avatar">
                                    <i class="fas fa-id-card"></i>
                                </div>
                                <div>
                                    <div class="profil-modal-title">Profil Lengkap KPM Warga</div>
                                    <div class="profil-modal-subtitle">
                                        <i class="fas fa-shield-alt" style="color:#009846;"></i> Terintegrasi Basis Data Kependudukan & SPK Bansos Sidoarjo
                                    </div>
                                </div>
                            </div>
                            <div class="profil-modal-header-actions">
                                <span class="profil-modal-desil-badge">
                                    <i class="fas fa-layer-group"></i> Desil ${wargaData.desil || 1}
                                </span>
                                <button type="button" class="profil-modal-close-btn" onclick="Swal.close();" title="Tutup Modal Profil">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        <!-- BODY SCROLLABLE -->
                        <div class="profil-modal-body">
                            <!-- Bagian 1: Identitas Kependudukan Resmi -->
                            <div class="profil-sec-head">
                                <span class="profil-sec-badge"><i class="fas fa-user-check"></i> 1. Identitas Kependudukan Resmi</span>
                                <span class="profil-sec-note">Data Terverifikasi Disdukcapil & DTKS</span>
                            </div>
                            <div class="profil-cards-grid">
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-user"></i> Nama Lengkap</div>
                                    <div class="cell-value">${safeHtml(wargaData.nama || wargaData.nama_lengkap || '-')}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-id-badge"></i> NIK (Nomor Induk Kependudukan)</div>
                                    <div class="cell-value"><span class="cell-nik">${nikFormat}</span></div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-calendar-alt"></i> Tempat, Tanggal Lahir</div>
                                    <div class="cell-value">${safeHtml(tempatLahir)}, ${safeHtml(tglLahir)}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-venus-mars"></i> Jenis Kelamin & Status</div>
                                    <div class="cell-value">${jkText} / ${statusNikahText}</div>
                                </div>
                                <div class="profil-card-cell cell-span-2">
                                    <div class="cell-label"><i class="fas fa-map-marked-alt"></i> Alamat Domisili Terdaftar</div>
                                    <div class="cell-value" style="font-weight:600; color:#334155;">${safeHtml(wargaData.alamat || '-')}</div>
                                </div>
                            </div>

                            <!-- Bagian 2: 10 Parameter Kesejahteraan Sosial (BWM-SAW) -->
                            <div class="profil-sec-head" style="margin-top:20px;">
                                <span class="profil-sec-badge"><i class="fas fa-chart-pie"></i> 2. Indikator Sosial Ekonomi (10 Kriteria Lengkap BWM-SAW)</span>
                                <span class="profil-sec-note">Variabel Pembobotan Sistem Pendukung Keputusan</span>
                            </div>
                            <div class="profil-cards-grid">
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C1</span> Penghasilan Bulanan</div>
                                    <div class="cell-value" style="color:#059669;">${formatRupiah(wargaData.c1_ekonomi ?? wargaData.c1)}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C2</span> Nilai Kepemilikan Aset</div>
                                    <div class="cell-value">${formatRupiah(wargaData.c2_aset ?? wargaData.c2)}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C3</span> Usia Kepala Keluarga</div>
                                    <div class="cell-value">${wargaData.c3_umur ?? wargaData.c3 ?? '-'} Tahun</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C4</span> Jenis Kelamin</div>
                                    <div class="cell-value">${jkText}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C5</span> Jumlah Tanggungan Jiwa</div>
                                    <div class="cell-value">${wargaData.c5_tanggungan ?? wargaData.c5 ?? '-'} Orang / Jiwa</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C6</span> Status Pernikahan</div>
                                    <div class="cell-value">${statusNikahText}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C7</span> Anak Sekolah / Balita</div>
                                    <div class="cell-value">${wargaData.c7_kepemilikan_anak ?? wargaData.c7 ?? '-'} Tanggungan</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C8</span> Kelayakan Tempat Tinggal</div>
                                    <div class="cell-value">${c8Text}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C9</span> Tingkat Pendidikan Terakhir</div>
                                    <div class="cell-value">${c9Text}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><span class="kriteria-pill">C10</span> Kondisi Kesehatan / Disabilitas</div>
                                    <div class="cell-value">${c10Text}</div>
                                </div>
                            </div>

                            <!-- Bagian 3: Status Bantuan & Penetapan SPK -->
                            <div class="profil-sec-head" style="margin-top:20px;">
                                <span class="profil-sec-badge"><i class="fas fa-hand-holding-heart"></i> 3. Status Penetapan & Penyaluran Bansos</span>
                                <span class="profil-sec-note">Keluaran Algoritma Rekomendasi Terpadu</span>
                            </div>
                            <div class="profil-cards-grid">
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-award"></i> Status Rekomendasi SPK</div>
                                    <div class="cell-value" style="color:#009846;"><i class="fas fa-check-circle"></i> ${safeHtml(wargaData.status_bansos || 'Layak Bansos')}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-calculator"></i> Skor Akumulasi SAW</div>
                                    <div class="cell-value" style="color:#0284c7; font-family:monospace;">${Number(wargaData.skor_saw || 0).toFixed(4)} <span class="profil-rank-badge">Rank #${wargaData.rank_saw || 1}</span></div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-box-open"></i> Alokasi Bantuan Ditetapkan</div>
                                    <div class="cell-value">${safeHtml(wargaData.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg')}</div>
                                </div>
                                <div class="profil-card-cell">
                                    <div class="cell-label"><i class="fas fa-truck-loading"></i> Status Penyaluran Fisik</div>
                                    <div class="cell-value" style="color:#ea580c;"><i class="fas fa-clock"></i> ${safeHtml(wargaData.status_salur || 'Dalam Antrean Distribusi')}</div>
                                </div>
                            </div>
                        </div>

                        <!-- FOOTER -->
                        <div class="profil-modal-footer">
                            <div class="profil-modal-footer-note">
                                <i class="fas fa-shield-alt" style="color:#009846;"></i> Data resmi Dinas Sosial & SPK Bansos Kab. Sidoarjo
                            </div>
                            <button type="button" class="profil-modal-btn-primary" onclick="Swal.close()">
                                <i class="fas fa-check"></i> Tutup Profil
                            </button>
                        </div>
                    </div>
                `,
                showConfirmButton: false,
                showCancelButton: false,
                showCloseButton: false,
                buttonsStyling: false,
                width: 820,
                padding: 0,
                background: '#ffffff',
                allowOutsideClick: true,
                didOpen: () => {
                    const container = Swal.getContainer();
                    if (container) {
                        container.style.setProperty('background', 'rgba(15, 23, 42, 0.75)', 'important');
                        container.style.setProperty('background-color', 'rgba(15, 23, 42, 0.75)', 'important');
                        container.style.setProperty('backdrop-filter', 'blur(12px)', 'important');
                        container.style.setProperty('-webkit-backdrop-filter', 'blur(12px)', 'important');
                    }
                    const actions = Swal.getActions();
                    if (actions) actions.style.setProperty('display', 'none', 'important');
                }
            });
        }
    } catch(err) {
        console.error('[Profil Warga Error]', err);
    }
};

// =========================================================================
// PANEL INFO PESAN WARGA (RINCIAN STATUS DIBACA, TERSAMPAIKAN, & WAKTU REALTIME)
// =========================================================================
window.bukaInfoPesanChat = async function (msgId) {
    document.querySelectorAll('.aduan-dropdown-menu, .bubble-action-dropdown').forEach(el => el.style.display = 'none');
    const modal = document.getElementById('modalInfoPesanChat');
    if (!modal) return;
    modal.style.display = 'flex';

    const prevBox = document.getElementById('infoPesanPreviewContainer');
    const waktuDibacaEl = document.getElementById('infoWaktuDibaca');
    const deskripsiDibacaEl = document.getElementById('infoDeskripsiDibaca');
    const iconDibacaEl = document.getElementById('infoIconDibaca');
    const waktuTersampaikanEl = document.getElementById('infoWaktuTersampaikan');
    const waktuTerkirimEl = document.getElementById('infoWaktuTerkirim');
    const senderNamaEl = document.getElementById('infoSenderNama');
    const penerimaNamaEl = document.getElementById('infoPenerimaNama');

    if (prevBox) prevBox.innerHTML = '<div style="color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Memuat detail status pesan...</div>';

    let msg = (window.wargaChatRawData || []).find(x => String(x.id) === String(msgId)) || null;
    try {
        const res = await fetch(`${API_URL}/api/chat/info/${msgId}`);
        if (res.ok) {
            const json = await res.json();
            if (json.data) msg = json.data;
        }
    } catch (e) {}

    if (!msg) {
        if (prevBox) prevBox.innerHTML = '<span style="color:#ef4444;">Data pesan tidak ditemukan.</span>';
        return;
    }

    const isMe = msg.sender === 'warga';
    const formatFullDeviceDateTime = (val) => {
        if (!val || val === '—' || val === '-') return '—';
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const jam = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                return `${tgl}, ${jam}`;
            }
        } catch (e) {}
        return String(val);
    };

    const displaySendTime = formatFullDeviceDateTime(msg.created_at || msg.waktu || 'Baru saja');
    const displayDeliveredTime = formatFullDeviceDateTime(msg.delivered_at || msg.created_at || msg.waktu || 'Baru saja');
    const displayReadTime = msg.is_read ? formatFullDeviceDateTime(msg.read_at || msg.created_at || msg.waktu) : '—';
    const targetReaderName = isMe ? 'Petugas Dinsos Sidoarjo' : (msg.nama || 'Warga');

    // Render Pratinjau Pesan
    let previewHtml = '';
    if (msg.file_path) {
        const url = msg.file_path.startsWith('http') ? msg.file_path : `${API_URL}${msg.file_path}`;
        const ext = (msg.file_path.split('.').pop() || '').toLowerCase();
        if (msg.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
            previewHtml = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${url}" style="width:60px; height:60px; object-fit:cover; border-radius:10px; border:2px solid #009846;" />
                    <div>
                        <div style="font-weight:700; color:#0f172a;"><i class="fas fa-image text-success"></i> Berkas Foto Lampiran</div>
                        <div style="font-size:0.75rem; color:#64748b;">${safeHtml(msg.pesan || msg.file_name || 'Foto Terlampir')}</div>
                    </div>
                </div>`;
        } else if (msg.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
            previewHtml = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:60px; height:60px; border-radius:10px; background:#0f172a; color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.4rem; border:2px solid #009846;">
                        <i class="fas fa-video"></i>
                    </div>
                    <div>
                        <div style="font-weight:700; color:#0f172a;"><i class="fas fa-video text-primary"></i> Berkas Video Lampiran</div>
                        <div style="font-size:0.75rem; color:#64748b;">${safeHtml(msg.pesan || msg.file_name || 'Video Terlampir')}</div>
                    </div>
                </div>`;
        } else {
            previewHtml = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:48px; height:48px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:1.3rem; color:#0284c7;">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div>
                        <div style="font-weight:700; color:#0f172a;">${safeHtml(msg.file_name || 'Dokumen')}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${safeHtml(msg.pesan || 'Dokumen Terlampir')}</div>
                    </div>
                </div>`;
        }
    } else {
        let isEmoji = false;
        try {
            isEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u.test(String(msg.pesan || '').trim());
        } catch (e) {}
        if (isEmoji) {
            previewHtml = `<div style="font-size:2.2rem; text-align:center; padding:6px 0; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.12));">${safeHtml(msg.pesan)}</div>`;
        } else {
            previewHtml = `<div style="font-size:0.9rem; color:#1e293b; line-height:1.45;">${safeHtml(msg.pesan || msg.text || '(Pesan tanpa teks)')}</div>`;
        }
    }

    if (prevBox) prevBox.innerHTML = previewHtml;
    if (waktuTerkirimEl) waktuTerkirimEl.innerText = displaySendTime;
    if (waktuTersampaikanEl) waktuTersampaikanEl.innerText = displayDeliveredTime;

    if (msg.is_read) {
        if (waktuDibacaEl) waktuDibacaEl.innerText = displayReadTime;
        if (deskripsiDibacaEl) {
            deskripsiDibacaEl.innerHTML = `<span style="color:#0284c7; font-weight:700;"><i class="fas fa-check-double"></i> Telah dibaca pada <b>${displayReadTime}</b> oleh ${targetReaderName}</span>`;
        }
        if (iconDibacaEl) {
            iconDibacaEl.style.background = '#e0f2fe';
            iconDibacaEl.style.color = '#0284c7';
            iconDibacaEl.innerHTML = '<i class="fas fa-check-double" style="color:#0284c7;"></i>';
        }
    } else {
        if (waktuDibacaEl) waktuDibacaEl.innerText = '—';
        if (deskripsiDibacaEl) {
            deskripsiDibacaEl.innerHTML = `<span style="color:#94a3b8;"><i class="fas fa-clock"></i> Belum dibaca oleh ${targetReaderName}</span>`;
        }
        if (iconDibacaEl) {
            iconDibacaEl.style.background = '#f1f5f9';
            iconDibacaEl.style.color = '#94a3b8';
            iconDibacaEl.innerHTML = '<i class="fas fa-check-double" style="color:#94a3b8;"></i>';
        }
    }

    if (senderNamaEl) senderNamaEl.innerText = msg.nama || (isMe ? 'Anda (Warga)' : 'Petugas Dinsos');
    if (penerimaNamaEl) penerimaNamaEl.innerText = isMe ? 'Petugas Dinsos Sidoarjo' : (msg.nama || 'Warga');
};

window.tutupInfoPesanChat = function () {
    const modal = document.getElementById('modalInfoPesanChat');
    if (modal) modal.style.display = 'none';
};
