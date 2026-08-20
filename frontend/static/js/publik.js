/* =========================================================
   PUBLIK.JS - PORTAL WARGA SPK BANSOS SIDOARJO (FULL ACTIONS)
========================================================= */

let wargaNik = localStorage.getItem('wargaNik') || '';
let wargaNama = localStorage.getItem('wargaNama') || '';
window.editedMediaBlob = null; window.editedMediaExt = ''; window.editedMediaType = '';
let replyToDataWarga = null, lastChatHashWarga = "", chatIntervalWarga = null;

function safeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function enc(str) { return encodeURIComponent(str || ''); }

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

        ['loginWargaSection', 'cekStatusSection', 'daftarMandiriSection', 'bantuanSection'].forEach(id => {
            const sec = document.getElementById(id);
            if(sec) sec.style.display = 'none';
        });
        const target = document.getElementById(targetSectionId);
        if(target) target.style.display = 'block';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (wargaNik && wargaNama) {
        window.switchTabPublik('dashboardWargaSection');
        window.loadDashboardWarga();
    } else {
        window.switchTabPublik('loginWargaSection');
    }

    const wFile = document.getElementById('wargaChatFile');
    if(wFile) {
        wFile.addEventListener('change', function() {
            const file = this.files[0]; if(!file) return;
            window.editedMediaBlob = file; 
            window.editedMediaExt = file.name.split('.').pop(); 
            window.editedMediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document');
            window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
            document.getElementById('wargaChatInput')?.focus();
        });
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="menu-warga-"]')) {
        document.querySelectorAll('[id^="menu-warga-"]').forEach(m => m.style.display = 'none');
    }
});

window.loginWarga = async function(e) {
    if(e && typeof e.preventDefault === 'function') e.preventDefault(); 
    const nik = document.getElementById('loginNik')?.value.trim();
    const nama = document.getElementById('loginNama')?.value.trim();
    const email = document.getElementById('loginEmail')?.value.trim();

    if(!nik || !nama) return Swal.fire('Peringatan', 'NIK dan Nama Lengkap wajib diisi.', 'warning');

    Swal.fire({title: 'Memeriksa Data...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${API_URL}/api/public/login-warga`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: nik, nama: nama, email: email}) });
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('wargaNik', data.data.nik); 
            localStorage.setItem('wargaNama', data.data.nama); 
            wargaNik = data.data.nik; wargaNama = data.data.nama;
            Swal.fire('Berhasil', 'Akses Diberikan', 'success');
            window.switchTabPublik('dashboardWargaSection');
            window.loadDashboardWarga();
        } else { 
            Swal.fire('Akses Ditolak', data.message || 'Data tidak ditemukan.', 'error'); 
        }
    } catch(err) { Swal.fire('Error', 'Gagal menyambung ke server.', 'error'); }
};

window.logoutWarga = function() { localStorage.removeItem('wargaNik'); localStorage.removeItem('wargaNama'); wargaNik = ''; wargaNama = ''; window.location.reload(); };

window.loadDashboardWarga = async function() {
    if(!wargaNik) return;
    try {
        const res = await fetch(`${API_URL}/api/public/cek-bansos/${wargaNik}`); 
        const data = await res.json();
        if(res.ok) {
            const w = data.data; 
            document.getElementById('wNama').innerText = w.nama; 
            document.getElementById('wNik').innerText = w.nik; 
            document.getElementById('wAlamat').innerText = w.alamat; 
            document.getElementById('wStatus').innerText = w.status;
            
            let progressHtml = '';
            // KARTU DOUBLE CONFIRMATION JIKA ADMIN TELAH MENANGGAPI LAPORAN MASALAH
            if(w.is_lapor_curang && w.status_salur === 'Menunggu Konfirmasi Warga') {
                progressHtml = `
                    <div style="background:#fffbeb; border:1px solid #fcd34d; padding:15px; border-radius:12px;">
                        <b style="color:#b45309;"><i class="fas fa-check-double"></i> Konfirmasi Penerimaan (Double-Check):</b>
                        <p style="font-size:0.9rem; color:#475569; margin:8px 0;">Pihak Dinas Sosial menyatakan bantuan Anda telah diselesaikan/dikirimkan kembali. Apakah Anda sudah menerima bansos tersebut secara utuh?</p>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.konfirmasiLaporSelesaiWarga()" class="btn btn-primary" style="font-size:0.85rem;"><i class="fas fa-check-circle"></i> Ya, Sudah Saya Terima</button>
                            <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="font-size:0.85rem; color:#ef4444; border-color:#ef4444;"><i class="fas fa-times"></i> Masih Belum</button>
                        </div>
                    </div>
                `;
            } else if(w.is_lapor_curang && w.status_salur === 'Menunggu Konfirmasi Akhir Admin') {
                progressHtml = `<div style="color:var(--info); font-weight:bold;"><i class="fas fa-clock"></i> Anda Telah Mengonfirmasi Penerimaan</div><p style="font-size:0.9rem; color:var(--text-muted);">Menunggu penutupan final dari Admin Dinas Sosial.</p>`;
            } else if(w.is_lapor_curang) {
                progressHtml = `<div style="color:var(--danger); font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Laporan Dalam Investigasi</div><p style="font-size:0.9rem; color:var(--text-muted);">Admin sedang menelusuri laporan bansos Anda. Pantau kolom obrolan.</p>`;
            } else if(w.level === 3 && w.tahap_penyaluran === 1) {
                progressHtml = `<button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary"><i class="fas fa-check"></i> Ya, Saya Sudah Terima</button> <button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border-color:var(--danger); color:var(--danger);"><i class="fas fa-times"></i> Belum Menerima</button>`;
            } else if(w.status_salur === 'Selesai') {
                progressHtml = `<div style="color:#10b981; font-weight:bold;"><i class="fas fa-check-circle"></i> Bantuan Sosial Selesai Disalurkan & Divalidasi</div>`;
            }

            const actCont = document.getElementById('actionContainer'); 
            if(actCont) actCont.innerHTML = progressHtml;
            
            window.loadChatMessagesWarga(true); 
            if(!chatIntervalWarga) { 
                chatIntervalWarga = setInterval(() => { window.loadChatMessagesWarga(true); }, 3000); 
            }
        }
    } catch(err) { }
};

window.konfirmasiTerimaBansos = function() { 
    Swal.fire({ title: 'Konfirmasi', text: 'Anda yakin sudah menerima bantuan sosial?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Selesai' }).then(async (res) => { 
        if(res.isConfirmed) { 
            await fetch(`${API_URL}/api/public/konfirmasi-terima`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); 
            window.loadDashboardWarga(); 
        } 
    }); 
};

window.laporBansosBelumDiterima = function() { 
    Swal.fire({ title: 'Laporkan Kendala', text: 'Laporkan bahwa bansos belum diterima?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Laporkan', confirmButtonColor: '#ef4444' }).then(async (res) => { 
        if(res.isConfirmed) { 
            await fetch(`${API_URL}/api/public/lapor-kecurangan`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); 
            window.loadDashboardWarga(); 
        } 
    }); 
};

window.konfirmasiLaporSelesaiWarga = function() { 
    Swal.fire({ title: 'Konfirmasi Akhir', text: 'Apakah bantuan sosial sudah Anda terima secara nyata?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Konfirmasi', confirmButtonColor: '#10b981' }).then(async (res) => { 
        if(res.isConfirmed) { 
            await fetch(`${API_URL}/api/public/lapor-selesai`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); 
            Swal.fire('Tervalidasi', 'Konfirmasi penerimaan Anda telah dikirim ke Admin.', 'success');
            window.loadDashboardWarga(); 
        } 
    }); 
};

// CHAT WARGA
window.sendWargaChat = async function() {
    if(!wargaNik) return;
    const input = document.getElementById('wargaChatInput'); const pesan = input ? input.value.trim() : '';
    if(!pesan && !window.editedMediaBlob) return;
    
    const formData = new FormData();
    formData.append('sender', 'warga'); 
    formData.append('nama', wargaNama); 
    formData.append('pesan', pesan);
    
    if(window.editedMediaBlob) { 
        const finalName = `media_${Date.now()}.${window.editedMediaExt || 'jpg'}`; 
        formData.append('file', window.editedMediaBlob, finalName); 
        if(window.editedMediaType) formData.append('custom_file_type', window.editedMediaType); 
    } 
    if(replyToDataWarga) { 
        formData.append('reply_to_id', replyToDataWarga.id); 
        formData.append('reply_to_text', replyToDataWarga.text); 
        formData.append('reply_to_sender', replyToDataWarga.sender); 
    } 
    
    if(input) input.value = ''; 
    window.batalLampiranWarga(); 
    window.batalReplyWarga(); 
    
    try { 
        await fetch(`${API_URL}/api/chat/${wargaNik}`, { method: 'POST', body: formData }); 
        lastChatHashWarga = "";
        window.loadChatMessagesWarga(false); 
    } catch(e) {}
};

window.setReplyWarga = function(id, sender, text, file_type) { 
    let displayTxt = text; 
    if(file_type === 'image') displayTxt = '📷 Gambar'; 
    else if(file_type === 'video') displayTxt = '🎥 Video'; 
    else if(file_type === 'audio') displayTxt = '🎤 Pesan Suara'; 
    
    replyToDataWarga = {id: id, sender: sender, text: displayTxt}; 
    const cont = document.getElementById('replyPreviewContainerWarga');
    if(cont) {
        document.getElementById('replyPreviewSenderWarga').innerText = safeHtml(sender); 
        document.getElementById('replyPreviewTextWarga').innerText = displayTxt; 
        cont.style.display = 'flex'; 
    }
    document.getElementById('wargaChatInput')?.focus(); 
};

window.batalReplyWarga = function() { 
    replyToDataWarga = null; 
    const cont = document.getElementById('replyPreviewContainerWarga'); 
    if(cont) cont.style.display = 'none'; 
};

window.reactToMessageWarga = async function(msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:2rem; cursor:pointer;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionWarga(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    Swal.fire({ title: 'Beri Reaksi Emoji', html: html, showConfirmButton: false });
};

window.submitReactionWarga = async function(msgId, emoji) {
    Swal.close();
    await fetch(`${API_URL}/api/chat/react/${msgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji })
    });
    lastChatHashWarga = "";
    window.loadChatMessagesWarga(false);
};

window.togglePinMessageWarga = async function(msgId) {
    await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' });
    lastChatHashWarga = "";
    window.loadChatMessagesWarga(false);
};

window.hapusPesanWarga = async function(id, tipe) { 
    if(confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini' : 'menghapus pesan dari layar Anda'}?`)) { 
        await fetch(`${API_URL}/api/chat/action/${id}`, { 
            method: 'DELETE', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({type: tipe, requester: 'warga'}) 
        }); 
        lastChatHashWarga = "";
        window.loadChatMessagesWarga(false); 
    } 
};

window.laporPesanAdmin = async function(msgId) { 
    const { value: alasan } = await Swal.fire({ 
        title: 'Laporkan Pesan Petugas', 
        input: 'select', 
        inputOptions: { 
            'Kata-kata Kasar': 'Kata-kata Kasar / Pelecehan', 
            'Permintaan Ilegal': 'Permintaan Uang / Pungli', 
            'Lainnya': 'Lainnya' 
        }, 
        showCancelButton: true, 
        confirmButtonText: 'Laporkan', 
        confirmButtonColor: '#ef4444' 
    }); 
    if (alasan) { 
        await fetch(`${API_URL}/api/chat/report/${msgId}`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({reason: alasan, reporter: wargaNama}) 
        }); 
        Swal.fire('Terlapor', 'Laporan Anda telah dikirim ke Pengawas Dinsos.', 'success'); 
    } 
};

window.toggleChatMenuWarga = function(id, event) { 
    event.stopPropagation(); 
    document.querySelectorAll('[id^="menu-warga-"]').forEach(m => { if(m.id !== `menu-warga-${id}`) m.style.display = 'none'; }); 
    const menu = document.getElementById(`menu-warga-${id}`); 
    if(menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; 
};

window.scrollToMessageWarga = function(id) { 
    const el = document.getElementById(`msg-warga-${id}`); 
    if(el) { 
        el.scrollIntoView({behavior: 'smooth', block: 'center'}); 
        el.style.boxShadow = "0 0 15px #10b981";
        setTimeout(() => el.style.boxShadow = "", 2000);
    } 
};

window.toggleEmojiPickerWarga = function(event) { 
    if(event) event.stopPropagation();
    let el = document.getElementById('emojiPickerWarga'); 
    if(el) {
        const emojisList = ['😀','😂','🥰','😎','😭','😡','👍','🙏','❤️','🔥','✅','❌','💡','🎉','😢','🤔','👏','🚨']; 
        let html = ''; 
        emojisList.forEach(e => { 
            html += `<div style="cursor:pointer; font-size:1.5rem; text-align:center; user-select:none; padding:4px;" onclick="window.addEmojiWarga('${e}')">${e}</div>`; 
        });
        el.innerHTML = html;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'grid' : 'none'; 
    }
};

window.addEmojiWarga = function(emoji) { 
    const input = document.getElementById('wargaChatInput'); 
    if(input) { input.value += emoji; input.focus(); } 
};

window.handleChatEnterWarga = function(e) { 
    if(e.key === 'Enter') { 
        e.preventDefault(); 
        window.sendWargaChat(); 
    } 
};

window.showPreviewWarga = function(srcUrl, type, fname = '') {
    let previewContainer = document.getElementById('previewMediaContainerWarga'); 
    let previewArea = document.getElementById('preSendPreviewWarga'); 
    if(previewArea && previewContainer) {
        if(type === 'image') previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height: 100px; border-radius: 8px; object-fit: contain;">`;
        else if(type === 'video') previewContainer.innerHTML = `<video src="${srcUrl}" style="max-height: 100px; border-radius: 8px;"></video>`;
        else previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info); text-align:center;"><i class="fas fa-file-alt fa-2x"></i><br><small>${fname}</small></div>`;
        previewArea.style.display = 'block';
    }
};

window.batalLampiranWarga = function() { 
    window.editedMediaBlob = null; window.editedMediaExt = ''; window.editedMediaType = ''; 
    const fileInput = document.getElementById('wargaChatFile'); if(fileInput) fileInput.value = ''; 
    const preArea = document.getElementById('preSendPreviewWarga'); if(preArea) preArea.style.display = 'none'; 
    const preContainer = document.getElementById('previewMediaContainerWarga'); if(preContainer) preContainer.innerHTML = ''; 
};

window.loadChatMessagesWarga = async function(isSilent = false) {
    if(!wargaNik) return;
    try {
        const res = await fetch(`${API_URL}/api/chat/${wargaNik}?viewer=warga`);
        if(!res.ok) throw new Error("Gagal");
        let data = await res.json();
        if(!Array.isArray(data)) data = [];

        const dataHash = JSON.stringify(data);
        if (isSilent && lastChatHashWarga === dataHash) return;
        lastChatHashWarga = dataHash;
        
        let html = '';
        let pinnedHtml = '';

        data.forEach(msg => {
            let isWarga = msg.sender === 'warga';
            let align = isWarga ? 'flex-end' : 'flex-start';
            let bg = isWarga ? '#dcf8c6' : '#ffffff';
            let color = '#303030';
            let borderRadius = isWarga ? '12px 0px 12px 12px' : '0px 12px 12px 12px';
            let shadow = '0 1px 2px rgba(0,0,0,0.15)';
            
            if(msg.is_pinned && !msg.is_deleted) {
                pinnedHtml += `
                    <div onclick="window.scrollToMessageWarga(${msg.id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:#fffbeb; border-left:4px solid #f59e0b; padding:6px 12px; margin-bottom:8px; border-radius:6px; font-size:0.8rem;">
                        <div><i class="fas fa-thumbtack" style="color:#f59e0b; margin-right:6px;"></i><b>${isWarga ? 'Anda' : 'Dinas Sosial'}:</b> ${safeHtml(msg.pesan || 'Lampiran')}</div>
                        <i class="fas fa-times" onclick="event.stopPropagation(); window.togglePinMessageWarga(${msg.id});"></i>
                    </div>
                `;
            }

            let replyHtml = '';
            if(msg.reply_to_text) { 
                replyHtml = `<div onclick="window.scrollToMessageWarga(${msg.reply_to_id})" style="cursor:pointer; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; border-left: 4px solid ${isWarga ? '#25d366' : '#3b82f6'}; margin-bottom: 8px; font-size: 0.85rem; color: #555;"><b>${safeHtml(msg.reply_to_sender)}</b><br><i>${safeHtml(msg.reply_to_text)}</i></div>`; 
            }
            
            let reactionHtml = '';
            if(msg.reaction) { 
                reactionHtml = `<div style="position:absolute; ${isWarga ? 'left:-10px' : 'right:-10px'}; bottom:-10px; background:white; border-radius:20px; padding:2px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.2); font-size:1rem; z-index:5;">${msg.reaction}</div>`; 
            }
            
            let mediaHtml = ''; 
            if(msg.file_path) {
                let cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '')}`;
                if(msg.file_type === 'audio') mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:35px;"></audio></div>`;
                else if(msg.file_type === 'image') mediaHtml = `<img src="${cleanFileUrl}" style="width:250px; border-radius:8px; margin-bottom:8px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`;
                else if(msg.file_type === 'video') mediaHtml = `<video src="${cleanFileUrl}" controls style="width:250px; border-radius:8px; margin-bottom:8px; background:black;"></video>`;
            }
            
            let actionMenu = '';
            if(!msg.is_deleted) {
                actionMenu = `
                    <div style="position: absolute; ${isWarga ? 'left:-28px' : 'right:-28px'}; top: 8px; cursor: pointer; color: #94a3b8;" onclick="window.toggleChatMenuWarga(${msg.id}, event)">
                        <i class="fas fa-ellipsis-v hover-action"></i>
                        <div id="menu-warga-${msg.id}" style="display:none; position:absolute; ${isWarga ? 'right:15px' : 'left:15px'}; top:0; background:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:160px; border:1px solid #e2e8f0; font-size:0.85rem;">
                            <button type="button" onclick="window.reactToMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-smile" style="color:#f59e0b;"></i> Reaksi Emoji</button>
                            <button type="button" onclick="window.setReplyWarga(${msg.id}, '${isWarga ? 'Anda' : 'Dinas Sosial'}', decodeURIComponent('${enc(msg.pesan)}'), '${msg.file_type}')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-reply" style="color:#3b82f6;"></i> Balas Pesan</button>
                            <button type="button" onclick="window.togglePinMessageWarga(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-thumbtack" style="color:#10b981;"></i> ${msg.is_pinned ? 'Lepas Pin' : 'Sematkan Pesan'}</button>
                            <button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'me')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#64748b;"><i class="fas fa-eye-slash"></i> Hapus untuk Saya</button>
                            ${isWarga ? `<button type="button" onclick="window.hapusPesanWarga(${msg.id}, 'everyone')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#ef4444;"><i class="fas fa-trash-alt"></i> Tarik Pesan</button>` : ''}
                            ${!isWarga ? `<button type="button" onclick="window.laporPesanAdmin(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Petugas</button>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `<article id="msg-warga-${msg.id}" style="align-self: ${align}; max-width: 75%; position:relative; margin-bottom: 15px; display:flex; flex-direction:column; align-items:${isWarga ? 'flex-end' : 'flex-start'}; font-family: 'Inter', sans-serif;">
                <section style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.95rem; line-height:1.4; min-width: 160px; text-align: left;">
                    ${msg.is_pinned ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:700; margin-bottom:4px;"><i class="fas fa-thumbtack"></i> Disematkan</div>` : ''}
                    ${replyHtml}${mediaHtml}
                    ${msg.pesan ? `<span style="display:block; margin-bottom: 8px; word-break: break-word;">${safeHtml(msg.pesan)}</span>` : ''}
                    <footer style="display:flex; justify-content:flex-end; align-items:center; gap:6px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                        <span style="font-size:0.7rem; color:#64748b; font-weight:700;">${msg.waktu}</span>
                        ${isWarga ? '<i class="fas fa-check-double" style="font-size:0.7rem; color:#34b7f1;"></i>' : ''}
                    </footer>
                </section>
                ${reactionHtml}
                ${actionMenu}
            </article>`;
        });
        
        const container = document.getElementById('wargaChatMessages'); 
        container.innerHTML = (pinnedHtml ? `<div id="pinnedHeaderAreaWarga" style="position:sticky; top:0; z-index:10;">${pinnedHtml}</div>` : '') + (html || `<div style="text-align:center; color:var(--text-muted); margin-top:50px; font-size:0.9rem;">Belum ada pesan.</div>`);
        container.scrollTop = container.scrollHeight;
    } catch(e) {}
};