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
        return `
            <div class="chat-geotag-card">
                <div class="chat-geotag-header">
                    <i class="fas fa-map-marked-alt" style="font-size:1.1rem; color:#009846;"></i>
                    <span>Lokasi Arsip Kependudukan</span>
                </div>
                <div class="chat-geotag-badge">
                    <i class="fas fa-check-circle"></i> Terverifikasi Geotag Dinsos
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
                    📍 Lat: ${latVal.toFixed(4)}, Lng: ${lngVal.toFixed(4)}
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

    try {
        const res = await fetch(`${API_URL}/api/chat/geotag/${nik}`);
        const json = await res.json();
        if (!json || json.status !== 'success' || !json.data) {
            showPortalAlert({ icon: 'info', title: 'Data Belum Tersedia', text: 'Data arsip geotagging belum ditemukan untuk NIK ini.' });
            return;
        }

        const geo = json.data;
        const lat = Number(geo.lat) || -7.4478;
        const lng = Number(geo.lng) || 112.7183;

        const { isConfirmed } = await Swal.fire({
            title: '<i class="fas fa-map-marked-alt text-success"></i> Bagikan Lokasi Arsip Terdaftar',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155;">
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px 14px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#15803d; font-size:0.92rem;">${safeHtml(geo.nama)}</span>
                            <span style="background:#dcfce7; color:#15803d; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:12px;">
                                <i class="fas fa-check-circle"></i> Terverifikasi
                            </span>
                        </div>
                        <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-bottom:4px;">NIK: ${geo.nik}</div>
                        <div style="font-size:0.8rem; color:#334155; margin-bottom:8px;">
                            <i class="fas fa-home text-success"></i> ${safeHtml(geo.alamat)}
                        </div>
                        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:6px 10px; font-family:monospace; font-size:0.76rem; color:#009846; font-weight:700;">
                            📍 Koordinat: Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}
                        </div>
                    </div>
                    <p style="margin:0; font-size:0.8rem; color:#64748b;">
                        Titik lokasi rumah resmi Anda dari arsip Dinsos akan dikirim ke petugas dalam ruang chat ini agar petugas lapangan dapat langsung bernavigasi ke rumah Anda.
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Bagikan Sekarang',
            confirmButtonColor: '#009846',
            cancelButtonText: 'Batal',
            cancelButtonColor: '#64748b',
            customClass: { popup: 'swal-rounded-popup', confirmButton: 'swal-btn-pill', cancelButton: 'swal-btn-pill' }
        });

        if (isConfirmed) {
            const sendRes = await fetch(`${API_URL}/api/chat/share-geotag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nik,
                    sender: 'warga',
                    nama
                })
            });

            if (sendRes.ok) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: '📍 Lokasi terdaftar Anda berhasil dikirim ke petugas!',
                    timer: 3000,
                    showConfirmButton: false
                });

                if (typeof window.loadChatMessagesWarga === 'function') {
                    window.loadChatMessagesWarga(true);
                }
                if (typeof window.muatPesanAduan === 'function' && sesiAduanAktif) {
                    window.muatPesanAduan();
                }
            } else {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal membagikan lokasi.' });
            }
        }
    } catch (e) {
        showPortalAlert({ icon: 'error', title: 'Error', text: 'Terjadi gangguan saat mengambil data lokasi geotagging.' });
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
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

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
            let mediaHtml = '';
            if (c.file_path) {
                const url = `${API_URL}${c.file_path}`;
                const ext = c.file_path.split('.').pop().toLowerCase();

                if (c.file_type === 'image') {
                    mediaHtml = `<img src="${url}" style="max-width:200px; max-height:160px; border-radius:10px; margin:2px 0 4px 0; cursor:pointer; object-fit:cover; display:block;" onclick="window.openLightbox('image', '${url}')">`;
                } else if (c.file_type === 'video') {
                    mediaHtml = `<video src="${url}" controls style="max-width:210px; max-height:160px; border-radius:10px; margin:2px 0 4px 0; background:#000; display:block;"></video>`;
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
                    <div style="background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px; border-left:3px solid ${isMe ? '#009846' : '#0284c7'}; margin-bottom:4px; font-size:0.75rem; color:#475569;">
                        <b>${safeHtml(c.reply_sender || 'Pesan')}:</b> <i>${safeHtml(c.reply_text)}</i>
                    </div>
                `;
            }

            let reactionBadge = c.reaction ? `<div style="position:absolute; ${isMe ? 'left:-4px' : 'right:-4px'}; bottom:-8px; background:#ffffff; border-radius:14px; padding:1px 6px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:0.85rem;">${c.reaction}</div>` : '';

            const handlerName = c.nama || c.nama_warga || c.sender_name || (c.sender === 'admin' ? '🛡️ Admin 1' : '👮 Petugas');

            return `
                <div id="msg-warga-${c.id}" style="align-self:${isMe ? 'flex-end' : 'flex-start'}; width:fit-content; max-width:min(68%, 380px); background:${isMe ? '#e6f9f0' : '#ffffff'}; color:${isMe ? '#065f46' : '#0f172a'}; padding:7px 11px 5px 11px; border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'}; font-size:0.88rem; border:1px solid ${isMe ? '#bbf7d0' : '#e2e8f0'}; box-shadow:0 1px 4px rgba(0,0,0,0.04); position:relative;">
                    ${!isMe ? `
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
                                    <button type="button" onclick="window.setReplyWarga(${c.id}, '${safeHtml(handlerName)}', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                    <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                    <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                    <button type="button" onclick="window.laporPesanAdmin(${c.id})" style="color:#dc2626;"><i class="fas fa-flag"></i> Laporkan</button>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="position:absolute; top:4px; right:4px; z-index:20;">
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
                                <button type="button" onclick="window.setReplyWarga(${c.id}, 'Anda', decodeURIComponent('${enc(c.pesan || 'Lampiran')}'), '${c.file_type || ''}')" style="color:#0284c7;"><i class="fas fa-reply"></i> Balas</button>
                                <button type="button" onclick="window.salinTeksAduan(decodeURIComponent('${enc(c.pesan)}'))" style="color:#475569;"><i class="fas fa-copy"></i> Salin Teks</button>
                                <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'me')" style="color:#64748b;"><i class="fas fa-trash-alt"></i> Hapus</button>
                                <button type="button" onclick="window.hapusPesanWarga(${c.id}, 'everyone')" style="color:#dc2626;"><i class="fas fa-undo"></i> Tarik Semua</button>
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

window.showPreviewWarga = function (url, type, fileName) {
    const bar = document.getElementById('attachmentPreviewContainerWarga');
    const nameEl = document.getElementById('attachmentFileNameWarga');
    if (bar && nameEl) {
        nameEl.innerText = fileName || 'Berkas Lampiran';
        bar.style.display = 'flex';
    }
};

window.batalLampiranWarga = function () {
    window.editedMediaBlob = null;
    const bar = document.getElementById('attachmentPreviewContainerWarga');
    if (bar) bar.style.display = 'none';
    const fileInp = document.getElementById('wargaChatFile');
    if (fileInp) fileInp.value = '';
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

window.wargaAudioChunks = [];
window.wargaVoiceStream = null;
window.wargaMediaRecorder = null;
window.wargaVoiceTimerInterval = null;
window.wargaVoiceSeconds = 0;

window.toggleVoiceRecordWarga = async function () {
    const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
    if (!currentNik) return;

    if (window.wargaMediaRecorder && window.wargaMediaRecorder.state === 'recording') {
        window.sendVoiceRecordWarga();
        return;
    }

    try {
        window.wargaVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        return alert('Izin mikrofon diperlukan untuk merekam pesan suara.');
    }

    try {
        window.wargaAudioChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        window.wargaMediaRecorder = mimeType ? new MediaRecorder(window.wargaVoiceStream, { mimeType }) : new MediaRecorder(window.wargaVoiceStream);

        window.wargaMediaRecorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) window.wargaAudioChunks.push(e.data);
        };

        window.wargaMediaRecorder.start(250);
        window.wargaVoiceSeconds = 0;

        const recUI = document.getElementById('wargaRecordingUI');
        const inputEl = document.getElementById('wargaChatInput');
        const btnRec = document.getElementById('btnRecordWarga');
        if (recUI) recUI.style.display = 'flex';
        if (inputEl) inputEl.style.display = 'none';
        if (btnRec) {
            btnRec.innerHTML = '<i class="fas fa-stop text-danger"></i>';
            btnRec.title = 'Kirim Pesan Suara';
        }

        clearInterval(window.wargaVoiceTimerInterval);
        window.wargaVoiceTimerInterval = setInterval(() => {
            window.wargaVoiceSeconds++;
            const m = String(Math.floor(window.wargaVoiceSeconds / 60)).padStart(2, '0');
            const s = String(window.wargaVoiceSeconds % 60).padStart(2, '0');
            const timerEl = document.getElementById('wargaRecordTime');
            if (timerEl) timerEl.innerText = `${m}:${s}`;
        }, 1000);
    } catch (err) {
        alert('Gagal menginisialisasi mikrofon.');
    }
};

window.cancelVoiceRecordWarga = function () {
    if (window.wargaMediaRecorder && window.wargaMediaRecorder.state !== 'inactive') {
        window.wargaMediaRecorder.stop();
    }
    if (window.wargaVoiceStream) {
        window.wargaVoiceStream.getTracks().forEach(t => t.stop());
    }
    clearInterval(window.wargaVoiceTimerInterval);

    const recUI = document.getElementById('wargaRecordingUI');
    const inputEl = document.getElementById('wargaChatInput');
    const btnRec = document.getElementById('btnRecordWarga');
    if (recUI) recUI.style.display = 'none';
    if (inputEl) inputEl.style.display = 'block';
    if (btnRec) {
        btnRec.innerHTML = '<i class="fas fa-microphone"></i>';
        btnRec.title = 'Rekam Pesan Suara';
    }
    window.wargaAudioChunks = [];
};

window.sendVoiceRecordWarga = function () {
    if (!window.wargaMediaRecorder || window.wargaAudioChunks.length === 0) {
        return window.cancelVoiceRecordWarga();
    }

    window.wargaMediaRecorder.onstop = async () => {
        if (window.wargaVoiceStream) {
            window.wargaVoiceStream.getTracks().forEach(t => t.stop());
        }
        clearInterval(window.wargaVoiceTimerInterval);

        const recUI = document.getElementById('wargaRecordingUI');
        const inputEl = document.getElementById('wargaChatInput');
        const btnRec = document.getElementById('btnRecordWarga');
        if (recUI) recUI.style.display = 'none';
        if (inputEl) inputEl.style.display = 'block';
        if (btnRec) {
            btnRec.innerHTML = '<i class="fas fa-microphone"></i>';
            btnRec.title = 'Rekam Pesan Suara';
        }

        const audioBlob = new Blob(window.wargaAudioChunks, { type: 'audio/webm' });
        window.wargaAudioChunks = [];

        const currentNik = wargaNik || (sesiWargaAktif && sesiWargaAktif.nik);
        const currentNama = wargaNama || (sesiWargaAktif && sesiWargaAktif.nama_lengkap) || 'Warga';
        if (!currentNik) return;

        const formData = new FormData();
        formData.append('sender', 'warga');
        formData.append('nama', currentNama);
        formData.append('pesan', '🎤 Pesan Suara (Voice Note)');
        formData.append('custom_file_type', 'audio');
        formData.append('file', audioBlob, `voice_warga_${Date.now()}.webm`);

        if (replyToDataWarga) {
            formData.append('reply_to_id', replyToDataWarga.id);
            formData.append('reply_to_text', replyToDataWarga.text);
            formData.append('reply_to_sender', replyToDataWarga.sender);
            window.batalReplyWarga();
        }

        try {
            await fetch(`${API_URL}/api/chat/${encodeURIComponent(currentNik)}`, {
                method: 'POST',
                body: formData
            });
            lastChatHashWarga = '';
            window.loadChatMessagesWarga(false);
        } catch (e) {
            console.error('[Send Voice Error]', e);
        }
    };

    window.wargaMediaRecorder.stop();
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
