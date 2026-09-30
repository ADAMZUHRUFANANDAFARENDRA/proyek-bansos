/**
 * Modul: publik-chat.js
 * Deskripsi: Obrolan interaktif mediasi aduan warga dan ruang warga terdaftar, picker emoji, lampiran
 */

// 9. CHAT MULTIMEDIA (TITIK TIGA POJOK KIRI/KANAN, EMOJI FLOAT, LAPORAN MEMBULAT)
// =========================================================================
window.toggleAduanMsgMenu = function (id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('[id^="aduan-menu-"]').forEach(m => {
        if (m.id !== `aduan-menu-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`aduan-menu-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
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

            await fetch(`${API_URL}/api/publik/pengaduan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nik: pelaporNik,
                    nama_pelapor: pelaporNama,
                    kategori: 'Pelanggaran Komunikasi Chat Petugas',
                    isi_laporan: `[LAPORAN PESAN ID #${msgId}] Alasan: ${alasan}. Dilaporkan oleh warga ${pelaporNama} (NIK: ${pelaporNik}).`
                })
            });

            showPortalAlert({
                icon: 'success',
                title: 'Laporan Diterima',
                text: 'Laporan Anda telah diteruskan ke meja Pengawas Utama Dinas Sosial Sidoarjo untuk ditindaklanjuti.',
                customClass: { popup: 'swal-rounded-popup', confirmButton: 'swal-btn-pill' }
            });
        } catch (e) {
            showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan saat mengirim laporan.' });
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

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan mediasi. Anda dapat bertanya, melampirkan berkas (PPT, Excel, Foto), atau merekam suara di sini.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';
            let mediaHtml = '';
            if (c.file_path) {
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:240px; border-radius:14px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:14px; margin-bottom:6px; background:#000;"></video>`;
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
                                    <span class="voice-title"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                    <span class="voice-timer" id="time_${audioId}">00:00 / --:--</span>
                                </div>
                                <div class="voice-seek-wrapper">
                                    <canvas id="canvas_${audioId}" class="voice-wave-canvas" width="180" height="26"></canvas>
                                    <input type="range" id="seek_${audioId}" class="voice-seek-input" min="0" max="100" value="0" step="0.1" oninput="window.seekAudioModern('${audioId}', this.value)">
                                </div>
                            </div>
                            <button type="button" class="audio-speed-btn" onclick="window.changeAudioSpeed('${audioId}', this)">1x</button>
                        </div>
                    `;
                } else {
                    let iconClass = 'fa-file-alt';
                    let iconColor = '#0284c7';
                    if (['ppt', 'pptx'].includes(ext)) { iconClass = 'fa-file-powerpoint'; iconColor = '#ea580c'; }
                    else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconClass = 'fa-file-excel'; iconColor = '#16a34a'; }
                    else if (['pdf'].includes(ext)) { iconClass = 'fa-file-pdf'; iconColor = '#dc2626'; }

                    mediaHtml = `
                        <a href="${url}" target="_blank" style="display:flex; align-items:center; gap:12px; background:#ffffff; border:1.5px solid #e2e8f0; padding:10px 14px; border-radius:14px; text-decoration:none; margin-bottom:6px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                            <i class="fas ${iconClass} fa-2x" style="color:${iconColor};"></i>
                            <div>
                                <span style="font-weight:800; font-size:0.85rem; color:#0f172a; display:block;">Unduh Berkas Lampiran</span>
                                <small style="color:#64748b; text-transform:uppercase; font-weight:700;">Format .${ext}</small>
                            </div>
                        </a>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:10px; border-left:4px solid ${isMe ? '#dc2626' : '#0284c7'}; margin-bottom:6px; font-size:0.8rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-6px' : 'right:-6px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 8px; box-shadow:0 3px 8px rgba(0,0,0,0.18); font-size:0.95rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');

            return `
                <div style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:80%; background:${isMe ? '#fee2e2' : '#ffffff'}; color:${isMe ? '#991b1b' : '#0f172a'}; padding:12px 16px; border-radius:20px; font-size:0.9rem; border:1.5px solid ${isMe ? '#fecdd3' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                            <!-- Titik Tiga di Pojok Kiri Atas untuk Petugas -->
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="position:relative; z-index:20;">
                                    <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Tindakan Pesan">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-left" style="display:none;" onclick="event.stopPropagation()">
                                        <button type="button" onclick="window.setReplyAduan(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                        <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                        <button type="button" onclick="window.reactToMessageAduan(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                        <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                        <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>
                                    </div>
                                </div>
                                <span style="background:#e0f2fe; color:#0284c7; padding:4px 12px; border-radius:14px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                    <i class="fas fa-user-shield"></i> ${safeHtml(handlerName)}
                                </span>
                            </div>
                        </div>
                    ` : `
                        <!-- Titik Tiga di Pojok Kanan Atas untuk Warga -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(220,38,38,0.08);">
                            <span style="font-size:0.75rem; font-weight:800; color:#dc2626; opacity:0.85;">
                                <i class="fas fa-user"></i> Anda (Pelapor)
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleAduanMsgMenu(${c.id}, event)" title="Opsi Tindakan Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="aduan-menu-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <button type="button" onclick="window.setReplyAduan(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'))" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.reactToMessageAduan(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                    <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                    <button type="button" onclick="window.hapusPesanAduan(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik untuk Semua</button>
                                </div>
                            </div>
                        </div>
                    `}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan ? `<div style="word-break:break-word; line-height:1.5; margin-top:2px;">${safeHtml(c.pesan)}</div>` : ''}
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:6px; font-size:0.7rem; color:#94a3b8;">
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

        const isNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight < 120);

        if (chats.length === 0) {
            box.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:auto; padding:20px;">Belum ada pesan percakapan. Hubungi petugas jika ada pertanyaan.</div>`;
            return;
        }

        box.innerHTML = chats.map((c, idx) => {
            const isMe = c.sender === 'warga';
            let mediaHtml = '';
            if (c.file_path) {
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:240px; border-radius:14px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:14px; margin-bottom:6px; background:#000;"></video>`;
                } else if (c.file_type === 'audio') {
                    const audioId = `warga_audio_${c.id}_${idx}`;
                    mediaHtml = `
                        <div class="modern-voice-card">
                            <audio id="${audioId}" src="${url}" preload="metadata" onloadedmetadata="window.initAudioMetadata('${audioId}')" ontimeupdate="window.updateAudioTime('${audioId}')" onended="window.onAudioEnded('${audioId}')"></audio>
                            <button type="button" class="audio-play-btn" onclick="window.playAudioModern('${audioId}', this)">
                                <i class="fas fa-play"></i>
                            </button>
                            <div class="voice-track-col">
                                <div class="voice-info-row">
                                    <span class="voice-title"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                    <span class="voice-timer" id="time_${audioId}">00:00 / --:--</span>
                                </div>
                                <div class="voice-seek-wrapper">
                                    <canvas id="canvas_${audioId}" class="voice-wave-canvas" width="180" height="26"></canvas>
                                    <input type="range" id="seek_${audioId}" class="voice-seek-input" min="0" max="100" value="0" step="0.1" oninput="window.seekAudioModern('${audioId}', this.value)">
                                </div>
                            </div>
                            <button type="button" class="audio-speed-btn" onclick="window.changeAudioSpeed('${audioId}', this)">1x</button>
                        </div>
                    `;
                } else {
                    let iconClass = 'fa-file-alt';
                    let iconColor = '#0284c7';
                    if (['ppt', 'pptx'].includes(ext)) { iconClass = 'fa-file-powerpoint'; iconColor = '#ea580c'; }
                    else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconClass = 'fa-file-excel'; iconColor = '#16a34a'; }
                    else if (['pdf'].includes(ext)) { iconClass = 'fa-file-pdf'; iconColor = '#dc2626'; }

                    mediaHtml = `
                        <a href="${url}" target="_blank" style="display:flex; align-items:center; gap:12px; background:#ffffff; border:1.5px solid #e2e8f0; padding:10px 14px; border-radius:14px; text-decoration:none; margin-bottom:6px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                            <i class="fas ${iconClass} fa-2x" style="color:${iconColor};"></i>
                            <div>
                                <span style="font-weight:800; font-size:0.85rem; color:#0f172a; display:block;">Unduh Berkas Lampiran</span>
                                <small style="color:#64748b; text-transform:uppercase; font-weight:700;">Format .${ext}</small>
                            </div>
                        </a>
                    `;
                }
            }

            let replyHtml = '';
            if (c.reply_text) {
                replyHtml = `
                    <div style="background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:10px; border-left:4px solid ${isMe ? '#009846' : '#0284c7'}; margin-bottom:6px; font-size:0.8rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-6px' : 'right:-6px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 8px; box-shadow:0 3px 8px rgba(0,0,0,0.18); font-size:0.95rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1 (Super Admin)' : '👮 Petugas Dinsos');

            return `
                <div id="msg-warga-${c.id}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; max-width:80%; background:${isMe ? '#e6f9f0' : '#ffffff'}; color:${isMe ? '#065f46' : '#0f172a'}; padding:12px 16px; border-radius:20px; font-size:0.9rem; border:1.5px solid ${isMe ? '#bbf7d0' : '#e2e8f0'}; box-shadow:0 2px 6px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="position:relative; z-index:20;">
                                    <button type="button" class="btn-msg-dots" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Tindakan Pesan">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-left" style="display:none;" onclick="event.stopPropagation()">
                                        <button type="button" onclick="window.setReplyWarga(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                        <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                        <button type="button" onclick="window.reactToMessageWarga(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                        <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                        <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>
                                    </div>
                                </div>
                                <span style="background:#e0f2fe; color:#0284c7; padding:4px 12px; border-radius:14px; font-weight:800; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;">
                                    <i class="fas fa-user-shield"></i> ${safeHtml(handlerName)}
                                </span>
                            </div>
                        </div>
                    ` : `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(0,152,70,0.12);">
                            <span style="font-size:0.75rem; font-weight:800; color:#009846; opacity:0.85;">
                                <i class="fas fa-user"></i> Anda (Warga)
                            </span>
                            <div style="position:relative; z-index:20;">
                                <button type="button" class="btn-msg-dots" onclick="window.toggleChatMenuWarga(${c.id}, event)" title="Opsi Tindakan Pesan">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="menu-warga-${c.id}" class="aduan-dropdown-menu menu-right" style="display:none;" onclick="event.stopPropagation()">
                                    <button type="button" onclick="window.setReplyWarga(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.reactToMessageWarga(${c.id})" style="color:#d97706;"><i class="fas fa-smile"></i> Reaksi Emoji</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus untuk Saya</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik untuk Semua</button>
                                </div>
                            </div>
                        </div>
                    `}
                    ${replyHtml}
                    ${mediaHtml}
                    ${c.pesan ? `<div style="word-break:break-word; line-height:1.5; margin-top:2px;">${safeHtml(c.pesan)}</div>` : ''}
                    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:6px; font-size:0.7rem; color:#94a3b8;">
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

window.handleWargaFileSelected = function (input) {
    const file = input.files[0];
    if (!file) return;
    window.editedMediaBlob = file;
    window.editedMediaExt = file.name.split('.').pop().toLowerCase();
    window.editedMediaType = file.type.startsWith('image/')
        ? 'image'
        : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'document'));

    window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
    document.getElementById('wargaChatInput')?.focus();
};

window.sendWargaChat = window.kirimPesanWarga = async function () {
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

    if (!pesan && !window.editedMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', currentNama);
    formData.append('pesan', pesan);

    if (window.editedMediaBlob) {
        const finalName = `media_${Date.now()}.${window.editedMediaExt || 'jpg'}`;
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
    document.querySelectorAll('[id^="menu-warga-"]').forEach(m => {
        if (m.id !== `menu-warga-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`menu-warga-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
};

window.scrollToMessageWarga = function (id) {
    const el = document.getElementById(`msg-warga-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 15px #009846';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
};

window.toggleEmojiPickerWarga = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const el = document.getElementById('emojiPickerWarga');
    if (el) {
        const emojisList = ['😀', '😂', '🥰', '😎', '😭', '😡', '👍', '🙏', '❤️', '🔥', '✅', '❌', '💡', '🎉', '😢', '🤔', '👏', '🚨'];
        let html = '';
        emojisList.forEach(e => {
            html += `<div style="cursor:pointer; font-size:1.4rem; text-align:center; user-select:none; padding:4px;" onclick="window.addEmojiWarga('${e}')">${e}</div>`;
        });
        el.innerHTML = html;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'grid' : 'none';
    }
};

window.addEmojiWarga = function (emoji) {
    const input = document.getElementById('wargaChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.showPreviewWarga = function (srcUrl, type, fname = '') {
    const previewContainer = document.getElementById('previewMediaContainerWarga');
    const previewArea = document.getElementById('preSendPreviewWarga');
    if (previewArea && previewContainer) {
        if (type === 'image') {
            previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height:100px; border-radius:8px; object-fit:contain;">`;
        } else if (type === 'video') {
            previewContainer.innerHTML = `<video src="${srcUrl}" style="max-height:100px; border-radius:8px;" controls></video>`;
        } else {
            previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info, #0284c7); text-align:center;"><i class="fas fa-file-alt fa-2x"></i><br><small>${safeHtml(fname)}</small></div>`;
        }
        previewArea.style.display = 'block';
    }
};

window.batalLampiranWarga = function () {
    window.editedMediaBlob = null;
    window.editedMediaExt = '';
    window.editedMediaType = '';
    const fileInput = document.getElementById('wargaChatFile');
    if (fileInput) fileInput.value = '';
    const preArea = document.getElementById('preSendPreviewWarga');
    if (preArea) preArea.style.display = 'none';
    const preContainer = document.getElementById('previewMediaContainerWarga');
    if (preContainer) preContainer.innerHTML = '';
};

window.openLightbox = function (type, src) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            imageUrl: src,
            imageAlt: 'Lampiran Berkas',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'rgba(0,0,0,0.85)'
        });
    } else {
        window.open(src, '_blank');
    }
};

// =========================================================================
