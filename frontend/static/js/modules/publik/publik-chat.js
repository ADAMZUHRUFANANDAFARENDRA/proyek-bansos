/**
 * Modul: publik-chat.js
 * Deskripsi: Obrolan interaktif mediasi aduan warga dan ruang warga terdaftar, picker emoji, lampiran
 */

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
    const durEl = document.getElementById(`dur_${audioId}`);
    if (!aud) return;

    if (aud.duration === Infinity || !isFinite(aud.duration)) {
        aud.currentTime = 1e101;
        aud.ontimeupdate = function () {
            this.ontimeupdate = () => window.updateVoiceBubbleTime(audioId);
            aud.currentTime = 0;
            if (durEl && isFinite(aud.duration) && durEl.duration > 0) {
                durEl.innerText = formatTimeSeconds(aud.duration);
            }
        };
    } else if (durEl && aud.duration && isFinite(aud.duration) && aud.duration > 0) {
        durEl.innerText = formatTimeSeconds(aud.duration);
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
        const isOutgoing = freqBox.closest('.outgoing') !== null || (freqBox.closest('[id^="msg-warga-"]') && freqBox.closest('[id^="msg-warga-"]').style.alignSelf === 'flex-end');
        bars.forEach((bar, idx) => {
            if (idx <= activeIndex) {
                bar.classList.add('played');
                bar.style.opacity = '1';
                bar.style.background = isOutgoing ? '#009846' : '#0284c7';
            } else {
                bar.classList.remove('played');
                bar.style.opacity = '0.45';
                bar.style.background = '#cbd5e1';
            }
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
        }
    });

    aud.play().then(() => {
        if (iconEl) iconEl.className = 'fas fa-pause';
        if (btn) btn.classList.add('playing');
        if (freqBox) freqBox.classList.add('playing');
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
    if (freqBox) {
        freqBox.classList.remove('playing');
        freqBox.querySelectorAll('.voice-freq-bar').forEach(b => {
            b.classList.remove('played');
            b.style.opacity = '0.45';
            b.style.background = '#cbd5e1';
        });
    }
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
    if (!e.target.closest('.aduan-dropdown-menu') && !e.target.closest('.btn-msg-dots')) {
        document.querySelectorAll('.aduan-dropdown-menu').forEach(m => m.style.display = 'none');
    }
    if (!e.target.closest('.emoji-picker-container') && !e.target.closest('[onclick*="toggleEmojiPicker"]')) {
        const picker = document.getElementById('emojiPickerWarga');
        if (picker) picker.style.display = 'none';
    }
});

window.toggleAduanMsgMenu = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const menu = document.getElementById(`aduan-menu-${id}`);
    const isShown = menu && (menu.style.display === 'flex' || menu.style.display === 'block');
    document.querySelectorAll('.aduan-dropdown-menu').forEach(m => m.style.display = 'none');
    if (!isShown && menu) menu.style.display = 'flex';
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
    const nik = wargaNik || sesiAduanAktif?.nik;
    const nama = wargaNama || sesiAduanAktif?.nama || 'Warga';

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
    const nik = wargaNik || sesiAduanAktif?.nik;
    const nama = wargaNama || sesiAduanAktif?.nama || 'Warga';
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


// KATALOG EMOJI LENGKAP & TIDAK TERPOTONG
// =========================================================================
window.toggleEmojiPickerAduan = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerAduan');
    if (el) {
        const emojisList = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🥺', '😢', '😭',
            '😤', '😠', '😡', '🤯', '😳', '😱', '😨', '😰', '🤔', '🤫',
            '👍', '👎', '👏', '🙌', '🫶', '🤝', '🙏', '💪', '❤️', '🧡',
            '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '🔥', '✨', '🌟',
            '🚨', '⚠️', '🚩', '📌', '📍', '💯', '✅', '❌', '❓', '❗',
            '📄', '📊', '📈', '📁', '💼', '📦', '🏠', '🏢', '🏛️', '🤝'
        ];
        let html = '';
        emojisList.forEach(e => {
            html += `<div style="cursor:pointer; font-size:1.3rem; text-align:center; padding:4px; transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">${e}</div>`;
        });
        el.innerHTML = html;
        el.style.cssText = `
            display: ${el.style.display === 'none' || el.style.display === '' ? 'grid' : 'none'};
            position: absolute;
            bottom: 66px;
            left: 12px;
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            border-radius: 20px;
            box-shadow: 0 16px 36px rgba(0,0,0,0.18);
            padding: 12px;
            grid-template-columns: repeat(8, 1fr);
            gap: 6px;
            max-height: 220px;
            overflow-y: auto;
            width: 320px;
            max-width: calc(100vw - 40px);
            z-index: 999999 !important;
        `;
    }
};

window.addEmojiAduan = function (emoji) {
    const input = document.getElementById('aduanChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.kirimPesanAduan = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // Jika sedang dalam mode pratinjau suara, kirim suara tersebut via tombol merah ini
    if (tempPreviewAduanBlob) {
        window.sendConfirmedVoiceAduan();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    if (mediaRecorderAduan && mediaRecorderAduan.state !== 'inactive') {
        window.stopAndPreviewVoiceAduan();
        return;
    }

    const inp = document.getElementById('aduanChatInput');
    const msg = inp ? inp.value.trim() : '';
    if (!msg && !window.editedAduanMediaBlob) return;
    if (!sesiAduanAktif) return;
    if (inp) inp.value = '';

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', sesiAduanAktif.nama);
    formData.append('pesan', msg);

    if (window.editedAduanMediaBlob) {
        formData.append('file', window.editedAduanMediaBlob, `berkas_${Date.now()}.${window.editedAduanMediaExt || 'bin'}`);
    }

    if (replyToDataAduan) {
        formData.append('reply_sender', replyToDataAduan.sender);
        formData.append('reply_text', replyToDataAduan.text);
    }

    window.batalLampiranAduan();
    window.batalReplyAduan();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`, {
            method: 'POST',
            body: formData
        });
        window.muatPesanAduan(true);
    } catch (err) {}
};

// =========================================================================
// RENDER BUBBLE OBROLAN PENGADUAN LENGKAP & STABIL
// =========================================================================
window.muatPesanAduan = async function (forceScroll = false) {
    if (!sesiAduanAktif) return;
    const box = document.getElementById('aduanChatMessages');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(sesiAduanAktif.nik)}`);
        const chats = await res.json();
        if (!Array.isArray(chats)) return;

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
            let mediaHtml = '';
            if (c.file_path) {
                const url = (c.file_path.startsWith('http://') || c.file_path.startsWith('https://'))
                    ? c.file_path
                    : `${API_URL}${c.file_path.startsWith('/') ? '' : '/'}${c.file_path}`;
                const ext = (c.file_path.split('.').pop() || '').toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:200px; max-height:160px; border-radius:10px; margin:2px 0 4px 0; cursor:pointer; object-fit:cover; display:block;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:210px; max-height:160px; border-radius:10px; margin:2px 0 4px 0; background:#000; display:block;"></video>`;
                } else if (c.file_type === 'audio') {
                    const audioId = `aduan_audio_${c.id}_${idx}`;
                    mediaHtml = `
                        <div class="modern-voice-card">
                            <audio id="${audioId}" src="${url}" preload="metadata" onloadedmetadata="window.initAudioMetadata('${audioId}')" ontimeupdate="window.updateAudioTime('${audioId}')" onended="window.onAudioEnded('${audioId}')"></audio>
                            <button type="button" class="audio-play-btn" onclick="window.playAudioModern('${audioId}', this)">
                                <i class="fas fa-play"></i>
                            </button>
                            <div class="voice-track-col">
                                <div class="voice-info-row">
                                    <span class="voice-title"><i class="fas fa-microphone"></i> Suara</span>
                                    <span class="voice-timer" id="time_${audioId}">00:00</span>
                                </div>
                                <div class="voice-seek-wrapper">
                                    <canvas id="canvas_${audioId}" class="voice-wave-canvas" width="130" height="20"></canvas>
                                    <input type="range" id="seek_${audioId}" class="voice-seek-input" min="0" max="100" value="0" step="0.1" oninput="window.seekAudioModern('${audioId}', this.value)">
                                </div>
                            </div>
                            <button type="button" class="audio-speed-btn" onclick="window.changeAudioSpeed('${audioId}', this)">1x</button>
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
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; border-left:3px solid ${isMe ? '#dc2626' : '#0284c7'}; margin-bottom:4px; font-size:0.75rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-4px' : 'right:-4px'}; bottom:-8px; background:#ffffff; border-radius:14px; padding:1px 6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:0.85rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama || c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1' : '👮 Petugas');

            return `
                <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; width:fit-content; max-width:min(68%, 380px); background:${isMe ? '#fee2e2' : '#ffffff'}; color:${isMe ? '#991b1b' : '#0f172a'}; padding:7px 11px 5px 11px; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.88rem; border:1px solid ${isMe ? '#fecdd3' : '#e2e8f0'}; box-shadow:0 1px 4px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:3px;">
                            <span style="font-size:0.7rem; font-weight:800; color:#0284c7; display:inline-flex; align-items:center; gap:4px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <i class="fas fa-shield-alt"></i> ${safeHtml(handlerName)}
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <div class="emoji-react-row">
                                        <span onclick="window.submitReactionAduan(${c.id}, '❤️')">❤️</span>
                                        <span onclick="window.submitReactionAduan(${c.id}, '👍')">👍</span>
                                        <span onclick="window.submitReactionAduan(${c.id}, '😂')">😂</span>
                                        <span onclick="window.submitReactionAduan(${c.id}, '😮')">😮</span>
                                        <span onclick="window.submitReactionAduan(${c.id}, '🙏')">🙏</span>
                                    </div>
                                    <button type="button" onclick="window.setReplyAduan(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                    <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan</button>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="position:absolute; top:4px; right:4px; z-index:20;">
                            <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Pesan">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                <div class="emoji-react-row">
                                    <span onclick="window.submitReactionAduan(${c.id}, '❤️')">❤️</span>
                                    <span onclick="window.submitReactionAduan(${c.id}, '👍')">👍</span>
                                    <span onclick="window.submitReactionAduan(${c.id}, '😂')">😂</span>
                                    <span onclick="window.submitReactionAduan(${c.id}, '😮')">😮</span>
                                    <span onclick="window.submitReactionAduan(${c.id}, '🙏')">🙏</span>
                                </div>
                                <button type="button" onclick="window.setReplyAduan(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik Semua</button>
                            </div>
                        </div>
                    `}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan ? (c.pesan.startsWith('[GEOTAG_LOKASI]') ? window.formatGeotagCardHtml(c.pesan) : `<div style="word-break:break-word; line-height:1.45; margin-top:2px;">${safeHtml(c.pesan)}</div>`) : ''}
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:3px; font-size:0.68rem; color:#94a3b8;">
                        <span>${c.waktu || ''}</span>
                    </div>
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.modern-voice-card audio').forEach(a => {
                window.initAudioMetadata(a.id);
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
    const activeNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!activeNik) return;
    const box = document.getElementById('wargaChatMessages') || document.getElementById('chatMessagesWarga') || document.getElementById('chatBoxWarga');
    if (!box) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(activeNik)}`);
        const chats = await res.json();
        if (!Array.isArray(chats)) return;

        const currentHash = JSON.stringify(chats);
        if (!forceScroll && currentHash === lastChatHashWarga) {
            return;
        }
        lastChatHashWarga = currentHash;

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
        const lastAdminMsg = [...chats].reverse().find(c => c.sender !== 'warga');
        const badgeEl = document.getElementById('wargaOfficerNameBadge');
        if (badgeEl) {
            if (lastAdminMsg) {
                const name = lastAdminMsg.nama || (lastAdminMsg.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');
                badgeEl.innerHTML = `<i class="fas fa-shield-alt text-primary"></i> ${safeHtml(name)}`;
            } else {
                badgeEl.innerText = '🛡️ Admin 1 / Petugas Dinsos';
            }
        }

        if (lastAdminMsg && window.lastSeenWargaOfficerMsgId && lastAdminMsg.id > window.lastSeenWargaOfficerMsgId) {
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

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

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
                            <button type="button" class="chat-media-dl-btn" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(imgName)}', event)" title="Unduh Foto">
                                <i class="fas fa-arrow-down"></i>
                            </button>
                        </div>`;
                } else if (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
                    const vidName = c.file_name || c.file_path.split('/').pop() || 'Video_Lampiran.mp4';
                    const videoId = `w_vid_${c.id || idx}_${Date.now()}`;
                    mediaHtml = `
                        <div class="chat-media-video-wrap" id="vid_wrap_${videoId}">
                            <video id="${videoId}" src="${url}" playsinline preload="metadata" class="chat-media-video"
                                   onclick="window.toggleVideoBubblePlay('${videoId}', event)"
                                   ontimeupdate="window.updateVideoBubbleProgress ? window.updateVideoBubbleProgress('${videoId}') : null"
                                   onended="window.resetVideoBubble ? window.resetVideoBubble('${videoId}') : null"></video>
                            
                            <div class="video-center-play-overlay" id="vid_overlay_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Klik untuk Memutar Video Langsung">
                                <div class="center-play-circle" id="vid_center_icon_${videoId}">
                                    <i class="fas fa-play" style="margin-left:3px;"></i>
                                </div>
                            </div>

                            <div class="video-floating-hover-bar">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="btn-video-hover-ctrl" id="vid_btn_play_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Putar / Jeda Video">
                                        <i class="fas fa-play"></i>
                                    </button>
                                    <button type="button" class="btn-video-hover-ctrl" id="vid_btn_mute_${videoId}" onclick="window.toggleVideoBubbleMute('${videoId}', event)" title="Bisukan / Nyalakan Suara Video">
                                        <i class="fas fa-volume-up"></i>
                                    </button>
                                    <span class="video-hover-timer" id="vid_time_${videoId}">00:00</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="btn-video-hover-ctrl" onclick="window.openLightbox('video', '${url}')" title="Buka Layar Penuh">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                    <a href="${url}" download="${safeHtml(vidName)}" onclick="window.downloadDocumentDirect('${url}', '${escapeInlineJS(vidName)}', event)" class="btn-video-hover-ctrl" title="Unduh Video" style="color:white; text-decoration:none;">
                                        <i class="fas fa-download"></i>
                                    </a>
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
                                            const heights = [35, 55, 80, 95, 45, 70, 100, 85, 50, 75, 90, 65, 45, 80, 95, 60, 40, 75, 90, 65, 50, 35];
                                            const h = heights[i % heights.length];
                                            return `<div class="voice-freq-bar" id="bar_${audioId}_${i}" style="height:${h}%;"></div>`;
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
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; border-left:3px solid ${isMe ? '#009846' : '#0284c7'}; margin-bottom:4px; font-size:0.75rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-4px' : 'right:-4px'}; bottom:-8px; background:#ffffff; border-radius:14px; padding:1px 6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:0.85rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama || c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1' : '👮 Petugas');
            const cleanWargaText = (c.pesan || '').trim();
            const isPlaceholderText = !cleanWargaText || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran', 'video terlampir', 'video', '🎤 pesan suara (voice note)', '🎤 pesan suara', 'pesan suara'].includes(cleanWargaText.toLowerCase());
            const isShortTextWarga = !c.file_path && !c.reply_text && cleanWargaText.length <= 15 && !cleanWargaText.includes('\n');
            const isImgOnlyWarga = (c.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))) && isPlaceholderText && !c.reply_text;
            const isVidOnlyWarga = (c.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].some(e => (c.file_path || '').toLowerCase().endsWith('.' + e))) && isPlaceholderText && !c.reply_text;
            const isMediaBubbleOnlyWarga = isImgOnlyWarga || isVidOnlyWarga;

            let bubbleStyles = isMe ? 'background:#e6f9f0; color:#065f46; border:1px solid #bbf7d0;' : 'background:#ffffff; color:#0f172a; border:1px solid #e2e8f0;';
            if (isMediaBubbleOnlyWarga) {
                if (isMe) {
                    bubbleStyles = 'padding:3px !important; background:#009846 !important; border:2px solid #009846 !important; border-radius:17px !important; box-shadow:0 3px 12px rgba(0,152,70,0.22) !important; width:fit-content !important; max-width:fit-content !important; display:inline-block !important;';
                } else {
                    bubbleStyles = 'padding:3px !important; background:#ffffff !important; border:2px solid #e2e8f0 !important; border-radius:17px !important; box-shadow:0 2px 10px rgba(0,0,0,0.08) !important; width:fit-content !important; max-width:fit-content !important; display:inline-block !important;';
                }
            } else if (isShortTextWarga) {
                bubbleStyles += ' display:inline-flex !important; flex-direction:row !important; align-items:baseline !important; gap:8px !important; padding:4px 9px 4px 10px !important; width:fit-content !important; min-width:0 !important;';
            }

            return `
                <div id="msg-warga-${c.id}" class="${isShortTextWarga ? 'is-short-text' : ''} ${isImgOnlyWarga ? 'is-image-only' : ''} ${isVidOnlyWarga ? 'is-video-only' : ''} ${isMediaBubbleOnlyWarga ? 'is-media-only' : ''}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; width:fit-content; min-width:0; max-width:min(72%, 380px); padding:7px 11px 5px 11px; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.88rem; box-shadow:0 1px 4px rgba(0,0,0,0.04); position:relative; ${bubbleStyles}">
                    ${!isMe && !isMediaBubbleOnlyWarga ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:3px;">
                            <span style="font-size:0.7rem; font-weight:800; color:#0284c7; display:inline-flex; align-items:center; gap:4px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <i class="fas fa-shield-alt"></i> ${safeHtml(handlerName)}
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <div class="emoji-react-row">
                                        <span onclick="window.submitReactionWarga(${c.id}, '❤️')">❤️</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '👍')">👍</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '😂')">😂</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '😮')">😮</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '😢')">😢</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '🙏')">🙏</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '🔥')">🔥</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '👏')">👏</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '🎉')">🎉</span>
                                        <span onclick="window.submitReactionWarga(${c.id}, '💯')">💯</span>
                                    </div>
                                    <button type="button" onclick="window.bukaInfoPesanChat(${c.id})" style="color:#0284c7;"><i class="fas fa-info-circle text-primary"></i> Info</button>
                                    <button type="button" onclick="window.setReplyWarga(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                    <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan</button>
                                </div>
                            </div>
                        </div>
                    ` : (isMe ? `
                        <div style="position:absolute; ${isMediaBubbleOnlyWarga ? 'top:8px; left:8px;' : 'top:4px; right:4px;'} z-index:20;">
                            <button type="button" class="${isMediaBubbleOnlyWarga ? 'bubble-corner-btn' : 'btn-msg-dots'}" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Pesan">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                <div class="emoji-react-row">
                                    <span onclick="window.submitReactionWarga(${c.id}, '❤️')">❤️</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '👍')">👍</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '😂')">😂</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '😮')">😮</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '😢')">😢</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '🙏')">🙏</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '🔥')">🔥</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '👏')">👏</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '🎉')">🎉</span>
                                    <span onclick="window.submitReactionWarga(${c.id}, '💯')">💯</span>
                                </div>
                                <button type="button" onclick="window.bukaInfoPesanChat(${c.id})" style="color:#0284c7;"><i class="fas fa-info-circle text-primary"></i> Info</button>
                                <button type="button" onclick="window.setReplyWarga(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik Semua</button>
                            </div>
                        </div>
                    ` : (isMediaBubbleOnlyWarga ? `
                        <div style="position:absolute; top:8px; left:8px; z-index:20;">
                            <button type="button" class="bubble-corner-btn" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Pesan">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                <button type="button" onclick="window.bukaInfoPesanChat(${c.id})" style="color:#0284c7;"><i class="fas fa-info-circle text-primary"></i> Info</button>
                                <button type="button" onclick="window.setReplyWarga(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan</button>
                            </div>
                        </div>
                    ` : ''))}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan && !isPlaceholderText ? (c.pesan.startsWith('[GEOTAG_LOKASI]') ? window.formatGeotagCardHtml(c.pesan) : `<div style="word-break:break-word; line-height:1.45; margin-top:2px;">${safeHtml(c.pesan)}</div>`) : ''}
                    ${!isMediaBubbleOnlyWarga ? `
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:3px; font-size:0.68rem; color:${isMe ? '#047857' : '#94a3b8'};">
                        <span>${msgTime}</span>
                        ${isMe ? checkIconWarga : ''}
                    </div>` : ''}
                    ${reactionBadge}
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.modern-voice-card audio').forEach(a => {
                window.initAudioMetadata(a.id);
            });
        }, 100);

        if (forceScroll || isNearBottom) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (e) {}
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

window.filterEmojiWargaCategory = function (category) {
    const grid = document.getElementById('emojiGridListWarga');
    if (!grid) return;
    let list = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😎','🤩','🥳','😏','🥺','😢','😭','😤','😠','😡','🤔','🤫'];
    if (category === 'reaksi') {
        list = ['👍','👎','👏','🙌','🫶','🤝','🙏','💪','👌','✌️','🤞','🤟','🤙','👊','✊','🫡'];
    } else if (category === 'simbol') {
        list = ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','✨','🎉','🎊','🔥','⭐','🌟','⚡','💥','🚨','⚠️','✅','❌','💯'];
    } else if (category === 'bansos') {
        list = ['📦','🏠','📄','📊','📋','💰','🍚','💳','🏛️','🛡️','👤','👥','📍','📞','✉️','🗓️','🔍','💡'];
    }
    grid.innerHTML = list.map(em => `
        <button type="button" class="emoji-cell-btn" onclick="window.insertEmojiWarga('${em}')">${em}</button>
    `).join('');
};

window.toggleEmojiPickerWarga = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const pop = document.getElementById('emojiPickerWarga');
    if (!pop) return;
    const isShown = pop.style.display === 'block';
    pop.style.display = isShown ? 'none' : 'block';
    if (!isShown) {
        pop.innerHTML = `
            <div style="padding-bottom:6px; margin-bottom:6px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.3px;">
                    <i class="far fa-smile text-primary"></i> PILIH EMOJI
                </span>
                <button type="button" onclick="document.getElementById('emojiPickerWarga').style.display='none'" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.9rem;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display:flex; gap:4px; margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:6px; overflow-x:auto;">
                <button type="button" onclick="window.filterEmojiWargaCategory('senyum')" style="background:#f1f5f9; border:none; border-radius:10px; padding:3px 8px; font-size:0.75rem; cursor:pointer; font-weight:700;">😀 Senyum</button>
                <button type="button" onclick="window.filterEmojiWargaCategory('reaksi')" style="background:#f1f5f9; border:none; border-radius:10px; padding:3px 8px; font-size:0.75rem; cursor:pointer; font-weight:700;">👍 Reaksi</button>
                <button type="button" onclick="window.filterEmojiWargaCategory('simbol')" style="background:#f1f5f9; border:none; border-radius:10px; padding:3px 8px; font-size:0.75rem; cursor:pointer; font-weight:700;">❤️ Simbol</button>
                <button type="button" onclick="window.filterEmojiWargaCategory('bansos')" style="background:#f1f5f9; border:none; border-radius:10px; padding:3px 8px; font-size:0.75rem; cursor:pointer; font-weight:700;">📦 Bansos</button>
            </div>
            <div class="emoji-grid-cells" id="emojiGridListWarga"></div>
        `;
        window.filterEmojiWargaCategory('senyum');
    }
};

window.insertEmojiWarga = function (emoji) {
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
        const type = item.type || (fileObj.type ? (fileObj.type.startsWith('image/') ? 'image' : (fileObj.type.startsWith('video/') ? 'video' : 'document')) : 'document');
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
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    const currentNama = wargaNama || (sesiWargaAktif && sesiWargaAktif.nama_lengkap) || 'Warga';
    if (!currentNik) return;

    // Jika sedang dalam mode pratinjau suara warga, kirim langsung menggunakan tombol kirim utama
    if (tempPreviewWargaBlob) {
        window.sendConfirmedVoiceWarga();
        return;
    }

    // Jika sedang merekam suara dan tombol kirim ditekan, selesaikan ke pratinjau
    if (mediaRecorderWarga && mediaRecorderWarga.state === 'recording') {
        window.stopAndPreviewVoiceWarga();
        return;
    }

    const input = document.getElementById('wargaChatInput');
    const pesan = input ? input.value.trim() : '';
    const pendingFiles = [...(window.wargaChatPendingFiles || [])];

    if (!pesan && pendingFiles.length === 0 && !window.editedMediaBlob) return;

    window.isSendingWargaChat = true;

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

    if (replyToDataWarga) {
        formData.append('reply_to_id', replyToDataWarga.id);
        formData.append('reply_to_text', replyToDataWarga.text);
        formData.append('reply_to_sender', replyToDataWarga.sender);
    }

    if (input) input.value = '';
    window.batalLampiranWarga();
    window.batalReplyWarga();

    try {
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
            method: 'POST',
            body: formData
        });
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {
        console.error('[Send Chat Error]', e);
    } finally {
        window.isSendingWargaChat = false;
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
    document.querySelectorAll('[id^="menu-warga-"], .aduan-dropdown-menu').forEach(m => m.style.display = 'none');
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
    try {
        await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.hapusPesanWarga = async function (id, tipe) {
    const konfirmasi = confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini' : 'menghapus pesan dari layar Anda'}?`);
    if (konfirmasi) {
        try {
            await fetch(`${API_URL}/api/chat/action/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tipe, requester: 'warga' })
            }).catch(() => null);
            lastChatHashWarga = '';
            window.loadChatMessagesWarga(false);
        } catch (e) {}
    }
};

window.toggleChatMenuWarga = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const menu = document.getElementById(`menu-warga-${id}`);
    const isShown = menu && (menu.style.display === 'flex' || menu.style.display === 'block');
    document.querySelectorAll('.aduan-dropdown-menu').forEach(m => m.style.display = 'none');
    if (!isShown && menu) menu.style.display = 'flex';
};

window.scrollToMessageWarga = function (id) {
    const el = document.getElementById(`msg-warga-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 15px #009846';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
};

window.openLightbox = function (type, src) {
    if (typeof Swal !== 'undefined') {
        if (type === 'video') {
            Swal.fire({
                html: `
                    <div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; padding:10px;">
                        <video id="swalLightboxVideo" src="${src}" controls autoplay playsinline style="max-width:88vw; max-height:80vh; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.7); outline:none;"></video>
                    </div>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                background: 'rgba(15,23,42,0.95)',
                didClose: () => {
                    const vid = document.getElementById('swalLightboxVideo');
                    if (vid) {
                        vid.pause();
                        vid.muted = true;
                        vid.src = '';
                    }
                }
            });
        } else {
            Swal.fire({
                imageUrl: src,
                imageAlt: 'Lampiran Berkas',
                showConfirmButton: false,
                showCloseButton: true,
                background: 'rgba(15,23,42,0.95)'
            });
        }
    } else {
        window.open(src, '_blank');
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

    let msg = null;
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
        previewHtml = `<div style="font-size:0.9rem; color:#1e293b; line-height:1.45;">${safeHtml(msg.pesan || msg.text || '(Pesan tanpa teks)')}</div>`;
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
