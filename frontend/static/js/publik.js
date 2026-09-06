/* =========================================================================
   PUBLIK.JS - PORTAL WARGA SPK BANSOS PEMKAB SIDOARJO (FULL ACTIONS)
   Lokasi: frontend/static/js/publik.js
   ========================================================================= */

// 1. STATE & KONFIGURASI GLOBAL PORTAL WARGA
const API_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
    ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
    : ((typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL.replace(/\/+$/, '') : 'http://127.0.0.1:5000');

let wargaNik = localStorage.getItem('wargaNik') || '';
let wargaNama = localStorage.getItem('wargaNama') || '';
let wargaDataCache = null;

window.editedMediaBlob = null;
window.editedMediaExt = '';
window.editedMediaType = '';

let replyToDataWarga = null;
let lastChatHashWarga = '';
let chatIntervalWarga = null;

// 2. HELPER SANITASI & ENCODING
function safeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function enc(str) {
    return encodeURIComponent(str || '');
}

function showPortalAlert(options) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire(options);
    }
    alert(options.text || options.title || 'Pemberitahuan');
    return Promise.resolve({ isConfirmed: true, value: true });
}

// 3. NAVIGASI TAB & TAMPILAN PORTAL
window.switchTabPublik = window.switchTab = function(targetSectionId) {
    const landingView = document.getElementById('landingView');
    const dashboardView = document.getElementById('dashboardWargaSection');
    const chatbotBtn = document.getElementById('chatbotFabBtn');

    if (targetSectionId === 'dashboardWargaSection') {
        if (landingView) landingView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'block';
        if (chatbotBtn) chatbotBtn.style.display = 'none';
    } else {
        if (landingView) landingView.style.display = 'block';
        if (dashboardView) dashboardView.style.display = 'none';
        if (chatbotBtn) chatbotBtn.style.display = 'flex';

        const sections = ['loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'bantuanSection'];
        sections.forEach(id => {
            const sec = document.getElementById(id);
            if (sec) sec.style.display = 'none';
        });

        const target = document.getElementById(targetSectionId);
        if (target) target.style.display = 'block';
    }
};

// 4. INISIALISASI HALAMAN & EVENT LISTENER
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah warga sudah login sebelumnya
    if (wargaNik && wargaNama) {
        window.switchTabPublik('dashboardWargaSection');
        window.loadDashboardWarga();
    } else {
        window.switchTabPublik('loginWargaSection');
    }

    // Listener Berkas Lampiran Chat
    const wFile = document.getElementById('wargaChatFile');
    if (wFile) {
        wFile.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            window.editedMediaBlob = file;
            window.editedMediaExt = file.name.split('.').pop().toLowerCase();
            window.editedMediaType = file.type.startsWith('image/')
                ? 'image'
                : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'document'));
            
            window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
            document.getElementById('wargaChatInput')?.focus();
        });
    }

    // Listener Pencarian Cepat NIK pada Landing Page (Widget Cek Bansos)
    const btnCek = document.getElementById('btnCekNik');
    const inputNik = document.getElementById('inputNik');
    const panelHasil = document.getElementById('panelHasilBansos');

    if (btnCek && inputNik) {
        btnCek.addEventListener('click', async () => {
            const nik = inputNik.value.trim();
            if (nik.length !== 16 || !/^\d+$/.test(nik)) {
                showPortalAlert({ icon: 'warning', title: 'Perhatian', text: 'NIK harus berjumlah tepat 16 digit angka.' });
                return;
            }

            btnCek.disabled = true;
            btnCek.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';

            try {
                const res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
                const json = await res.json();

                if (res.ok && json.data) {
                    const w = json.data;
                    const desil = parseInt(w.desil || '5', 10);
                    const isLayak = desil <= 4;
                    const namaWarga = w.nama_lengkap || w.nama || 'Warga Terdata';
                    const statusBansos = w.status_bansos || (isLayak ? 'Layak Bansos' : 'Bukan Prioritas');

                    if (panelHasil) {
                        panelHasil.innerHTML = `
                            <div class="result-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05); margin-top:15px; text-align:left;">
                                <h3 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                                    <i class="fas fa-id-card" style="color:#10b981;"></i> Status Penetapan Bantuan
                                </h3>
                                <p style="margin-bottom:6px; font-size:0.92rem; color:#334155;"><strong>Nama Lengkap:</strong> ${safeHtml(namaWarga)}</p>
                                <p style="margin-bottom:6px; font-size:0.92rem; color:#334155;"><strong>NIK:</strong> ${safeHtml(w.nik)}</p>
                                <p style="margin-bottom:6px; font-size:0.92rem; color:#334155;"><strong>Alamat:</strong> ${safeHtml(w.alamat || 'Kabupaten Sidoarjo')}</p>
                                <p style="margin-bottom:6px; font-size:0.92rem; color:#334155;"><strong>Kelompok Desil:</strong> <span class="badge" style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:12px; font-weight:700;">Desil ${desil}</span></p>
                                <p style="margin-bottom:12px; font-size:0.92rem; color:#334155;"><strong>Status Bansos:</strong> <span class="badge" style="background:${isLayak ? '#dcfce7' : '#fee2e2'}; color:${isLayak ? '#15803d' : '#b91c1c'}; padding:4px 10px; border-radius:14px; font-weight:700;">${safeHtml(statusBansos)}</span></p>
                                
                                <div style="display:flex; gap:10px; margin-top:14px;">
                                    <button type="button" onclick="window.masukKePortal('${w.nik}', '${safeHtml(namaWarga)}')" class="btn btn-primary" style="padding:8px 16px; font-size:0.85rem; border-radius:8px; cursor:pointer;">
                                        Buka Dasbor Warga & Obrolan &rarr;
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    if (panelHasil) {
                        panelHasil.innerHTML = `
                            <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:15px; margin-top:15px; color:#be123c; font-size:0.9rem;">
                                <i class="fas fa-exclamation-circle"></i> ${safeHtml(json.message || 'Data NIK tidak ditemukan dalam basis data penerima bansos.')}
                            </div>
                        `;
                    }
                }
            } catch (err) {
                if (panelHasil) {
                    panelHasil.innerHTML = `
                        <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:15px; margin-top:15px; color:#be123c; font-size:0.9rem;">
                            <i class="fas fa-wifi"></i> Gagal terhubung ke peladen. Silakan periksa jaringan internet Anda.
                        </div>
                    `;
                }
            } finally {
                btnCek.disabled = false;
                btnCek.innerHTML = '<i class="fas fa-search"></i> Cek Bansos';
            }
        });
    }
});

// Tutup menu konteks obrolan saat klik di luar
document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="menu-warga-"]')) {
        document.querySelectorAll('[id^="menu-warga-"]').forEach(m => m.style.display = 'none');
    }
    const emojiPicker = document.getElementById('emojiPickerWarga');
    if (emojiPicker && !e.target.closest('#emojiPickerWarga') && !e.target.closest('.emoji-toggle-btn')) {
        emojiPicker.style.display = 'none';
    }
});

// 5. OTENTIKASI & LOGOUT WARGA
window.masukKePortal = function(nik, nama) {
    localStorage.setItem('wargaNik', nik);
    localStorage.setItem('wargaNama', nama);
    wargaNik = nik;
    wargaNama = nama;
    window.switchTabPublik('dashboardWargaSection');
    window.loadDashboardWarga();
};

window.loginWarga = async function(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const nik = document.getElementById('loginNik')?.value.trim();
    const nama = document.getElementById('loginNama')?.value.trim();
    const email = document.getElementById('loginEmail')?.value.trim();

    if (!nik || !nama) {
        return showPortalAlert({ icon: 'warning', title: 'Peringatan', text: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        return showPortalAlert({ icon: 'warning', title: 'Format NIK Salah', text: 'NIK wajib terdiri dari 16 digit angka.' });
    }

    showPortalAlert({ title: 'Memeriksa Data Warga...', allowOutsideClick: false, didOpen: () => Swal?.showLoading() });

    try {
        // Coba login khusus jika endpoint tersedia, dengan fallback ke cek-bansos terpadu
        let res = await fetch(`${API_URL}/api/public/login-warga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nik, nama, email })
        }).catch(() => null);

        let data = res ? await res.json().catch(() => ({})) : null;

        if (!res || !res.ok) {
            const fallbackRes = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(nik)}`);
            data = await fallbackRes.json().catch(() => ({}));
            res = fallbackRes;
        }

        if (res.ok && data.data) {
            const w = data.data;
            const finalNik = w.nik || nik;
            const finalNama = w.nama_lengkap || w.nama || nama;

            localStorage.setItem('wargaNik', finalNik);
            localStorage.setItem('wargaNama', finalNama);
            wargaNik = finalNik;
            wargaNama = finalNama;

            showPortalAlert({ icon: 'success', title: 'Akses Diberikan', text: `Selamat datang, ${finalNama}!`, timer: 1200, showConfirmButton: false });
            window.switchTabPublik('dashboardWargaSection');
            window.loadDashboardWarga();
        } else {
            showPortalAlert({ icon: 'error', title: 'Akses Ditolak', text: data.message || 'Data NIK tidak ditemukan dalam sistem DTKS.' });
        }
    } catch (err) {
        showPortalAlert({ icon: 'error', title: 'Gangguan Server', text: 'Gagal menyambung ke server basis data.' });
    }
};

window.logoutWarga = function() {
    if (chatIntervalWarga) {
        clearInterval(chatIntervalWarga);
        chatIntervalWarga = null;
    }
    localStorage.removeItem('wargaNik');
    localStorage.removeItem('wargaNama');
    wargaNik = '';
    wargaNama = '';
    wargaDataCache = null;
    window.location.reload();
};

// 6. DASBOR WARGA & DOUBLE-CONFIRMATION SENGKETA
window.loadDashboardWarga = async function() {
    if (!wargaNik) return;

    try {
        let res = await fetch(`${API_URL}/api/publik/cek-bansos?nik=${encodeURIComponent(wargaNik)}`);
        let json = await res.json().catch(() => ({}));

        if (!res.ok || !json.data) {
            res = await fetch(`${API_URL}/api/public/cek-bansos/${encodeURIComponent(wargaNik)}`).catch(() => null);
            json = res ? await res.json().catch(() => ({})) : {};
        }

        if (json.data) {
            const w = json.data;
            wargaDataCache = w;

            const elNama = document.getElementById('wNama');
            const elNik = document.getElementById('wNik');
            const elAlamat = document.getElementById('wAlamat');
            const elStatus = document.getElementById('wStatus');
            const elDesil = document.getElementById('wDesil');

            if (elNama) elNama.innerText = w.nama_lengkap || w.nama || wargaNama;
            if (elNik) elNik.innerText = w.nik || wargaNik;
            if (elAlamat) elAlamat.innerText = w.alamat || 'Kabupaten Sidoarjo';
            if (elStatus) elStatus.innerText = w.status_bansos || w.status || 'Dalam Peninjauan';
            if (elDesil && w.desil) elDesil.innerText = `Desil ${w.desil}`;

            let progressHtml = '';
            const statusSalur = w.status_salur || 'Pending';

            // Alur Konfirmasi Ganda Penyaluran Bantuan
            if (w.is_lapor_curang && statusSalur === 'Menunggu Konfirmasi Warga') {
                progressHtml = `
                    <div style="background:#fffbeb; border:1px solid #fcd34d; padding:15px; border-radius:12px; margin-top:10px;">
                        <b style="color:#b45309;"><i class="fas fa-check-double"></i> Konfirmasi Penerimaan Fisik (Double-Check):</b>
                        <p style="font-size:0.9rem; color:#475569; margin:8px 0;">Pihak Dinas Sosial menyatakan bantuan Anda telah disalurkan kembali. Apakah Anda sudah menerima bansos tersebut secara nyata?</p>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.konfirmasiLaporSelesaiWarga()" class="btn btn-primary" style="font-size:0.85rem; padding:8px 14px;"><i class="fas fa-check-circle"></i> Ya, Sudah Diterima</button>
                            <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; padding:8px 14px; color:#ef4444; border-color:#ef4444;"><i class="fas fa-times"></i> Belum Diterima</button>
                        </div>
                    </div>
                `;
            } else if (w.is_lapor_curang && statusSalur === 'Menunggu Konfirmasi Akhir Admin') {
                progressHtml = `
                    <div style="background:#f0f9ff; border:1px solid #bae6fd; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:var(--info); font-weight:bold;"><i class="fas fa-clock"></i> Konfirmasi Penerimaan Telah Terkirim</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Menunggu verifikasi penutupan berkas oleh Administrator Dinas Sosial.</p>
                    </div>
                `;
            } else if (w.is_lapor_curang || statusSalur.includes('Sengketa')) {
                progressHtml = `
                    <div style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#dc2626; font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Sanggahan Dalam Investigasi</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Petugas Dinsos sedang menindaklanjuti sanggahan Anda. Silakan koordinasi melalui kolom obrolan di bawah.</p>
                    </div>
                `;
            } else if (statusSalur === 'Telah Menerima' || statusSalur === 'Selesai') {
                progressHtml = `
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:12px; border-radius:10px; margin-top:10px;">
                        <div style="color:#059669; font-weight:bold;"><i class="fas fa-check-circle"></i> Bantuan Sosial Selesai Disalurkan</div>
                        <p style="font-size:0.88rem; color:#64748b; margin-top:4px;">Bantuan fisik telah tervalidasi diterima oleh Kepala Keluarga bersangkutan.</p>
                    </div>
                `;
            } else if (w.desil <= 4 || w.status_bansos === 'Menerima Bansos') {
                progressHtml = `
                    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary" style="font-size:0.88rem; padding:9px 16px;"><i class="fas fa-check"></i> Konfirmasi Sudah Terima</button>
                        <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border-color:#ef4444; color:#ef4444; font-size:0.88rem; padding:9px 16px;"><i class="fas fa-exclamation-circle"></i> Belum Menerima Bantuan</button>
                    </div>
                `;
            }

            const actCont = document.getElementById('actionContainer');
            if (actCont) actCont.innerHTML = progressHtml;

            // Muat pesan obrolan dan pasang polling interval jika belum aktif
            window.loadChatMessagesWarga(true);
            if (!chatIntervalWarga) {
                chatIntervalWarga = setInterval(() => {
                    window.loadChatMessagesWarga(true);
                }, 3500);
            }
        }
    } catch (err) {
        console.error('[Dashboard Error]', err);
    }
};

window.konfirmasiTerimaBansos = function() {
    showPortalAlert({
        title: 'Konfirmasi Penerimaan',
        text: 'Apakah Anda yakin telah menerima paket bantuan sosial dari petugas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Sudah Terima',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/konfirmasi-terima`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Terima Kasih', text: 'Konfirmasi penerimaan bantuan berhasil dicatat.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Terjadi gangguan jaringan saat konfirmasi.' });
            }
        }
    });
};

window.laporBansosBelumDiterima = function() {
    showPortalAlert({
        title: 'Laporkan Kendala Penyaluran',
        text: 'Nama Anda tercatat sebagai penerima namun belum menerima bantuan fisik?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Buat Pengaduan',
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/publik/pengaduan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: wargaNik,
                        nama_pelapor: wargaNama,
                        kategori: 'Bansos Belum Diterima',
                        isi_laporan: 'Warga melapor belum menerima alokasi bantuan sosial di lapangan.'
                    })
                }).catch(() => null);

                showPortalAlert({ icon: 'info', title: 'Laporan Diterima', text: 'Sanggahan Anda telah diteruskan ke tim investigasi Dinas Sosial.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal mengirimkan laporan sengketa.' });
            }
        }
    });
};

window.konfirmasiLaporSelesaiWarga = function() {
    showPortalAlert({
        title: 'Konfirmasi Akhir',
        text: 'Apakah bantuan sosial sudah Anda terima secara lengkap?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Selesaikan Laporan',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await fetch(`${API_URL}/api/public/lapor-selesai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nik: wargaNik })
                }).catch(() => null);

                showPortalAlert({ icon: 'success', title: 'Selesai', text: 'Kasus pengaduan telah ditutup secara sukses.' });
                window.loadDashboardWarga();
            } catch (e) {
                showPortalAlert({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui status pengaduan.' });
            }
        }
    });
};

// 7. CHAT & SENGKETA MULTIMEDIA DINSOS
window.sendWargaChat = async function() {
    if (!wargaNik) return;
    const input = document.getElementById('wargaChatInput');
    const pesan = input ? input.value.trim() : '';

    if (!pesan && !window.editedMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'warga');
    formData.append('nama', wargaNama);
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
        await fetch(`${API_URL}/api/chat/${encodeURIComponent(wargaNik)}`, {
            method: 'POST',
            body: formData
        });
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {
        console.error('[Send Chat Error]', e);
    }
};

window.setReplyWarga = function(id, sender, text, file_type) {
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

window.batalReplyWarga = function() {
    replyToDataWarga = null;
    const cont = document.getElementById('replyPreviewContainerWarga');
    if (cont) cont.style.display = 'none';
};

window.reactToMessageWarga = async function(msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:1.8rem; cursor:pointer; flex-wrap:wrap;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionWarga(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    showPortalAlert({ title: 'Beri Reaksi Emoji', html, showConfirmButton: false });
};

window.submitReactionWarga = async function(msgId, emoji) {
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

window.togglePinMessageWarga = async function(msgId) {
    try {
        await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' }).catch(() => null);
        lastChatHashWarga = '';
        window.loadChatMessagesWarga(false);
    } catch (e) {}
};

window.hapusPesanWarga = async function(id, tipe) {
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

window.laporPesanAdmin = async function(msgId) {
    if (typeof Swal === 'undefined') {
        alert('Fitur pelaporan memerlukan pustaka SweetAlert.');
        return;
    }

    const { value: alasan } = await Swal.fire({
        title: 'Laporkan Pesan Petugas',
        input: 'select',
        inputOptions: {
            'Kata-kata Kasar': 'Kata-kata Kasar / Pelecehan',
            'Permintaan Ilegal': 'Permintaan Uang / Pungutan Liar',
            'Informasi Palsu': 'Informasi Penyaluran Tidak Sesuai',
            'Lainnya': 'Lainnya'
        },
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan',
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Batal'
    });

    if (alasan) {
        try {
            await fetch(`${API_URL}/api/chat/report/${msgId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: alasan, reporter: wargaNama })
            }).catch(() => null);
            showPortalAlert({ icon: 'success', title: 'Terlapor', text: 'Laporan Anda telah diteruskan ke Pengawas Dinsos Sidoarjo.' });
        } catch (e) {}
    }
};

window.toggleChatMenuWarga = function(id, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    document.querySelectorAll('[id^="menu-warga-"]').forEach(m => {
        if (m.id !== `menu-warga-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`menu-warga-${id}`);
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
};

window.scrollToMessageWarga = function(id) {
    const el = document.getElementById(`msg-warga-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 15px #10b981';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
};

window.toggleEmojiPickerWarga = function(event) {
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

window.addEmojiWarga = function(emoji) {
    const input = document.getElementById('wargaChatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

window.handleChatEnterWarga = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        window.sendWargaChat();
    }
};

window.showPreviewWarga = function(srcUrl, type, fname = '') {
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

window.batalLampiranWarga = function() {
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

window.openLightbox = function(type, src) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            imageUrl: src,
            imageAlt: 'Lampiran Bukti Lapangan',
            showConfirmButton: false,
            showCloseButton: true,
            background: 'rgba(0,0,0,0.85)'
        });
    } else {
        window.open(src, '_blank');
    }
};

// 8. RENDER BUBBLE OBROLAN LENGKAP
window.loadChatMessagesWarga = async function(isSilent = false) {
    if (!wargaNik) return;

    try {
        const res = await fetch(`${API_URL}/api/chat/${encodeURIComponent(wargaNik)}?viewer=warga`);
        if (!res.ok) throw new Error('Gagal mengambil riwayat pesan');
        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        const dataHash = JSON.stringify(data);
        if (isSilent && lastChatHashWarga === dataHash) return;
        lastChatHashWarga = dataHash;

        let html = '';
        let pinnedHtml = '';

        data.forEach(msg => {
            const isWarga = msg.sender === 'warga';
            const align = isWarga ? 'flex-end' : 'flex-start';
            const bg = isWarga ? '#dcf8c6' : '#ffffff';
            const color = '#1e293b';
            const borderRadius = isWarga ? '14px 2px 14px 14px' : '2px 14px 14px 14px';
            const shadow = '0 1px 3px rgba(0,0,0,0.12)';

            if (msg.is_pinned && !msg.is_deleted) {
                pinnedHtml += `
                    <div onclick="window.scrollToMessageWarga(${msg.id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:#fffbeb; border-left:4px solid #f59e0b; padding:6px 12px; margin-bottom:8px; border-radius:6px; font-size:0.8rem;">
                        <div><i class="fas fa-thumbtack" style="color:#f59e0b; margin-right:6px;"></i><b>${isWarga ? 'Anda' : 'Dinas Sosial'}:</b> ${safeHtml(msg.pesan || 'Lampiran Berkas')}</div>
                        <i class="fas fa-times" onclick="event.stopPropagation(); window.togglePinMessageWarga(${msg.id});"></i>
                    </div>
                `;
            }

            let replyHtml = '';
            if (msg.reply_to_text) {
                replyHtml = `
                    <div onclick="window.scrollToMessageWarga(${msg.reply_to_id})" style="cursor:pointer; background:rgba(0,0,0,0.05); padding:6px 10px; border-radius:8px; border-left:4px solid ${isWarga ? '#10b981' : '#0284c7'}; margin-bottom:6px; font-size:0.82rem; color:#475569;">
                        <b>${safeHtml(msg.reply_to_sender)}</b><br>
                        <i>${safeHtml(msg.reply_to_text)}</i>
                    </div>
                `;
            }

            let reactionHtml = '';
            if (msg.reaction) {
                reactionHtml = `<div style="position:absolute; ${isWarga ? 'left:-8px' : 'right:-8px'}; bottom:-10px; background:#ffffff; border-radius:20px; padding:2px 6px; box-shadow:0 2px 5px rgba(0,0,0,0.2); font-size:0.95rem; z-index:5;">${msg.reaction}</div>`;
            }

            let mediaHtml = '';
            if (msg.file_path) {
                const cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '').replace(/^\/+/, '')}`;
                if (msg.file_type === 'audio') {
                    mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:36px;"></audio></div>`;
                } else if (msg.file_type === 'image') {
                    mediaHtml = `<img src="${cleanFileUrl}" alt="Lampiran" style="max-width:240px; border-radius:8px; margin-bottom:6px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`;
                } else if (msg.file_type === 'video') {
                    mediaHtml = `<video src="${cleanFileUrl}" controls style="max-width:240px; border-radius:8px; margin-bottom:6px; background:#000000;"></video>`;
                } else {
                    mediaHtml = `<div style="margin-bottom:6px;"><a href="${cleanFileUrl}" target="_blank" style="color:#0284c7; font-weight:700; font-size:0.85rem; text-decoration:none;"><i class="fas fa-file-download"></i> Unduh Lampiran Dokumen</a></div>`;
                }
            }

            let actionMenu = '';
            if (!msg.is_deleted) {
                actionMenu = `
                    <div style="position:absolute; ${isWarga ? 'left:-26px' : 'right:-26px'}; top:6px; cursor:pointer; color:#94a3b8;" onclick="window.toggleChatMenuWarga(${msg.id}, event)">
                        <i class="fas fa-ellipsis-v"></i>
                        <div id="menu-warga-${msg.id}" style="display:none; position:absolute; ${isWarga ? 'right:12px' : 'left:12px'}; top:0; background:#ffffff; box-shadow:0 10px 15px -3px rgba(0,0,0,0.15); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:160px; border:1px solid #e2e8f0; font-size:0.82rem;">
                            <button type="button" onclick="window.reactToMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-smile" style="color:#f59e0b;"></i> Reaksi Emoji</button>
                            <button type="button" onclick="window.setReplyWarga(${msg.id}, '${isWarga ? 'Anda' : 'Dinas Sosial'}', decodeURIComponent('${enc(msg.pesan)}'), '${msg.file_type}')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-reply" style="color:#0284c7;"></i> Balas Pesan</button>
                            <button type="button" onclick="window.togglePinMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-thumbtack" style="color:#10b981;"></i> ${msg.is_pinned ? 'Lepas Pin' : 'Sematkan'}</button>
                            <button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'me')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#64748b;"><i class="fas fa-eye-slash"></i> Hapus untuk Saya</button>
                            ${isWarga ? `<button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'everyone')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#ef4444;"><i class="fas fa-trash-alt"></i> Tarik Pesan</button>` : ''}
                            ${!isWarga ? `<button type="button" onclick="window.laporPesanAdmin(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `
                <div id="msg-warga-${msg.id}" style="align-self:${align}; max-width:75%; position:relative; margin-bottom:14px; display:flex; flex-direction:column; align-items:${isWarga ? 'flex-end' : 'flex-start'};">
                    <div style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.92rem; line-height:1.45; min-width:140px; text-align:left;">
                        ${msg.is_pinned ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:700; margin-bottom:4px;"><i class="fas fa-thumbtack"></i> Disematkan</div>` : ''}
                        ${replyHtml}
                        ${mediaHtml}
                        ${msg.pesan ? `<span style="display:block; word-break:break-word;">${safeHtml(msg.pesan)}</span>` : ''}
                        <div style="display:flex; justify-content:flex-end; align-items:center; gap:4px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                            <span style="font-size:0.68rem; color:#64748b; font-weight:700;">${msg.waktu || ''}</span>
                            ${isWarga ? '<i class="fas fa-check-double" style="font-size:0.68rem; color:#0284c7;"></i>' : ''}
                        </div>
                    </div>
                    ${reactionHtml}
                    ${actionMenu}
                </div>
            `;
        });

        const container = document.getElementById('wargaChatMessages');
        if (container) {
            container.innerHTML = (pinnedHtml ? `<div id="pinnedHeaderAreaWarga" style="position:sticky; top:0; z-index:10;">${pinnedHtml}</div>` : '') +
                (html || `<div style="text-align:center; color:#94a3b8; margin-top:50px; font-size:0.88rem;">Belum ada riwayat pesan percakapan.</div>`);
            container.scrollTop = container.scrollHeight;
        }
    } catch (e) {
        console.error('[Load Chat Error]', e);
    }
};