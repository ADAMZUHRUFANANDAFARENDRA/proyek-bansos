/* =========================================================
   PUBLIK.JS - PORTAL WARGA SPK BANSOS SIDOARJO
   FIX: FUNGSI KLIK STIKER & PENGIRIMAN MEDIA WARGA
========================================================= */

let wargaNik = localStorage.getItem('wargaNik') || '';
let wargaNama = localStorage.getItem('wargaNama') || '';
window.editedMediaBlob = null; window.editedMediaExt = ''; window.editedMediaType = '';
let audioContextWarga, analyserWarga, dataArrayWarga, reqFrameWarga;
window.isWargaRecordingAudio = false; window.wargaAudioRecorder = null; window.wargaAudioChunks = []; window.wargaRecordTimer = null; window.wargaRecordSecs = 0; window.isAutoSendAudioWarga = false;
let replyToDataWarga = null, lastChatHashWarga = "", chatIntervalWarga = null, peerWarga = null, activeCallWarga = null, localStreamWarga = null;

function safeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function enc(str) { return encodeURIComponent(str || ''); }

// =========================================================
// LOGIKA UTAMA: PEMISAHAN HALAMAN DEPAN & DASHBOARD
// =========================================================
window.switchTabPublik = window.switchTab = window.pindahTab = function(targetSectionId, clickedElement = null) {
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

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (clickedElement) {
            const tabBtn = clickedElement.closest('.tab-btn');
            if (tabBtn) tabBtn.classList.add('active');
        } else {
            if(targetSectionId === 'loginWargaSection') document.getElementById('btn-login')?.classList.add('active');
            if(targetSectionId === 'cekStatusSection') document.getElementById('btn-cek')?.classList.add('active');
            if(targetSectionId === 'daftarMandiriSection') document.getElementById('btn-daftar')?.classList.add('active');
            if(targetSectionId === 'bantuanSection') document.getElementById('btn-panduan')?.classList.add('active');
        }
    }
};

window.toggleChat = function() {
    Swal.fire({ title: '🤖 Asisten Robot AI', text: 'Layanan Chatbot otomatis sedang dalam tahap penyesuaian. Untuk bantuan langsung, silakan Masuk Dashboard dan gunakan fitur Live Chat.', icon: 'info', confirmButtonColor: '#10b981' });
};

window.mulaiTurPanduan = function() {
    Swal.fire({ title: '🎬 Tur Interaktif', text: 'Fitur video panduan visual sedang dioptimalkan. Silakan gunakan menu tab putih di bawah untuk bernavigasi.', icon: 'info', confirmButtonColor: '#10b981' });
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); 
            const targetHtml = this.innerHTML.toLowerCase();
            if(targetHtml.includes('tempat lahir') || targetHtml.includes('daftar mandiri')) {
                window.daftarMandiri(e);
            } else {
                window.loginWarga(e);
            }
        });
    });

    if (wargaNik && wargaNama) {
        window.switchTabPublik('dashboardWargaSection');
        window.loadDashboardWarga(); window.initPeerJSWarga();
    } else {
        window.switchTabPublik('loginWargaSection');
    }

    try { window.initFormMapPickerPublik(); } catch(e) {}

    const wFile = document.getElementById('wargaChatFile');
    if(wFile) {
        wFile.addEventListener('change', function() {
            const file = this.files[0]; if(!file) return;
            window.editedMediaBlob = file; window.editedMediaExt = file.name.split('.').pop(); window.editedMediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document');
            window.showPreviewWarga(URL.createObjectURL(file), window.editedMediaType, file.name);
            const inp = document.getElementById('wargaChatInput');
            if(inp) inp.focus();
        });
    }
});

document.addEventListener('click', (e) => {
    if (e.target.closest('[onclick*="toggleEmojiPicker"]')) return; 
    const ep = document.getElementById('emojiPickerWarga');
    if(ep && ep.style.display !== 'none' && !e.target.closest('#emojiPickerWarga')) { ep.style.display = 'none'; }
});

window.loginWarga = async function(e) {
    if(e && typeof e.preventDefault === 'function') e.preventDefault(); 
    
    const nikEl = document.getElementById('loginNik') || document.querySelector('input[placeholder*="NIK"]');
    const namaEl = document.getElementById('loginNama') || document.querySelector('input[placeholder*="KTP"]');
    const emailEl = document.getElementById('loginEmail') || document.querySelector('input[type="email"]');

    const nik = nikEl ? nikEl.value.trim() : '';
    const nama = namaEl ? namaEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';

    if(!nik || !nama) return Swal.fire('Peringatan', 'Nomor Induk Kependudukan (NIK) dan Nama Lengkap wajib diisi.', 'warning');

    Swal.fire({title: 'Memeriksa Data...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${API_URL}/api/public/login-warga`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: nik, nama: nama, email: email}) });
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('wargaNik', data.data.nik); localStorage.setItem('wargaNama', data.data.nama); wargaNik = data.data.nik; wargaNama = data.data.nama;
            Swal.fire('Berhasil', 'Akses Diberikan', 'success');
            window.switchTabPublik('dashboardWargaSection');
            window.loadDashboardWarga(); window.initPeerJSWarga();
        } else { Swal.fire('Akses Ditolak', data.message || 'Identitas tidak ditemukan dalam sistem.', 'error'); }
    } catch(err) { Swal.fire('Gangguan Koneksi', 'Sistem server sedang mengalami kendala jaringan. Mohon coba lagi.', 'error'); }
};

window.logoutWarga = function() { localStorage.removeItem('wargaNik'); localStorage.removeItem('wargaNama'); wargaNik = ''; wargaNama = ''; window.location.reload(); };

window.loadDashboardWarga = async function() {
    if(!wargaNik) return;
    try {
        const res = await fetch(`${API_URL}/api/public/cek-bansos/${wargaNik}`); const data = await res.json();
        if(res.ok) {
            const w = data.data; 
            const wn = document.getElementById('wNama'); if(wn) wn.innerText = w.nama; 
            const wnik = document.getElementById('wNik'); if(wnik) wnik.innerText = w.nik; 
            const wal = document.getElementById('wAlamat'); if(wal) wal.innerText = w.alamat; 
            const wstat = document.getElementById('wStatus'); if(wstat) wstat.innerText = w.status;
            
            let progressHtml = '', progressPercent = 25;
            if(w.is_lapor_curang) { progressHtml = `<div style="color:var(--danger); font-weight:bold;"><i class="fas fa-exclamation-triangle"></i> Laporan Sedang Diusut Admin</div><p style="font-size:0.9rem; color:var(--text-muted);">Anda melaporkan bansos belum diterima. Admin sedang menelusuri laporan Anda. Mohon pantau Live Chat.</p>`; progressPercent = 100; const pf = document.getElementById('progressFill'); if(pf) pf.style.background = 'var(--danger)'; } 
            else if(w.level === 1) { progressHtml = `<div style="color:var(--info); font-weight:bold;"><i class="fas fa-search"></i> Sedang Dalam Antrean Verifikasi</div><p style="font-size:0.9rem; color:var(--text-muted);">Data Anda sedang dianalisis oleh algoritma BWM-SAW dan menunggu persetujuan Dinas Sosial.</p>`; } 
            else if(w.level === 2 && w.tahap_penyaluran === 0) { progressHtml = `<div style="color:var(--primary); font-weight:bold;"><i class="fas fa-check-circle"></i> Lulus Verifikasi (Menunggu Penyaluran)</div><p style="font-size:0.9rem; color:var(--text-muted);">Selamat! Anda terpilih sebagai penerima bansos. Menunggu petugas mengirimkan jadwal penyaluran.</p>`; progressPercent = 50; } 
            else if(w.level === 3 && w.tahap_penyaluran === 1) { progressHtml = `<div style="color:var(--accent); font-weight:bold;"><i class="fas fa-truck"></i> Bansos Telah Disalurkan!</div><p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:15px;">Petugas menyatakan bansos telah dikirim/diberikan kepada Anda. Silakan konfirmasi jika sudah menerima.</p><button onclick="window.konfirmasiTerimaBansos()" class="btn btn-primary"><i class="fas fa-check"></i> Ya, Saya Sudah Terima</button><button onclick="window.laporBansosBelumDiterima()" class="btn btn-secondary" style="border:1px solid var(--danger); color:var(--danger);"><i class="fas fa-times"></i> Belum Menerima</button>`; progressPercent = 75; } 
            else if(w.level === 3 && w.tahap_penyaluran >= 2) { progressHtml = `<div style="color:#10b981; font-weight:bold;"><i class="fas fa-hands-helping"></i> Selesai</div><p style="font-size:0.9rem; color:var(--text-muted);">Proses penyaluran bantuan sosial telah selesai dan terkonfirmasi.</p>`; progressPercent = 100; const pf = document.getElementById('progressFill'); if(pf) pf.style.background = '#10b981'; } 
            else if(w.level === 4) { progressHtml = `<div style="color:var(--text-muted); font-weight:bold;"><i class="fas fa-archive"></i> Ditangguhkan</div><p style="font-size:0.9rem; color:var(--text-muted);">Berdasarkan analisis sistem, Anda tergolong keluarga mampu sehingga bantuan dialihkan ke yang lebih membutuhkan.</p>`; progressPercent = 100; const pf = document.getElementById('progressFill'); if(pf) pf.style.background = 'var(--text-muted)'; }
            
            const pFill = document.getElementById('progressFill'); if(pFill) pFill.style.width = progressPercent + '%'; 
            const actCont = document.getElementById('actionContainer'); if(actCont) actCont.innerHTML = progressHtml;
            
            window.loadChatMessagesWarga(true); if(!chatIntervalWarga) { chatIntervalWarga = setInterval(() => { window.loadChatMessagesWarga(true); }, 3000); }
        }
    } catch(err) { }
};

window.konfirmasiTerimaBansos = function() { Swal.fire({ title: 'Konfirmasi', text: 'Anda yakin sudah menerima bantuan sosial tersebut dengan kondisi baik?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Selesai' }).then(async (res) => { if(res.isConfirmed) { Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()}); try { const response = await fetch(`${API_URL}/api/public/konfirmasi-terima`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); if(response.ok) { Swal.fire('Terima Kasih', 'Konfirmasi Anda telah masuk ke sistem kami.', 'success'); window.loadDashboardWarga(); } else { Swal.fire('Gagal', 'Terjadi kesalahan sistem.', 'error'); } } catch(e) { Swal.fire('Error', 'Gangguan jaringan.', 'error'); } } }).catch(() => Swal.close()); };
window.laporBansosBelumDiterima = function() { Swal.fire({ title: 'Laporkan Kendala', text: 'Anda akan melaporkan bahwa bansos BELUM Anda terima meskipun statusnya sudah dikirim. Lanjutkan?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Laporkan', confirmButtonColor: '#ef4444' }).then(async (res) => { if(res.isConfirmed) { Swal.fire({title: 'Memproses Laporan...', didOpen: () => Swal.showLoading()}); try { const response = await fetch(`${API_URL}/api/public/lapor-kecurangan`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); if(response.ok) { Swal.fire('Laporan Masuk', 'Investigasi akan segera dilakukan oleh Dinas Sosial. Mohon sampaikan detailnya di menu Chat.', 'success'); window.loadDashboardWarga(); } else { Swal.fire('Gagal', 'Sistem menolak laporan ini.', 'error'); } } catch(e) { Swal.fire('Error', 'Gangguan jaringan.', 'error'); } } }).catch(() => Swal.close()); };
window.konfirmasiLaporSelesaiWarga = function() { Swal.fire({ title: 'Kasus Selesai?', text: 'Apakah kendala/laporan Anda sudah diselesaikan oleh pihak Dinas Sosial?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Sudah Selesai', confirmButtonColor: '#10b981' }).then(async (res) => { if(res.isConfirmed) { Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()}); try { const response = await fetch(`${API_URL}/api/public/lapor-selesai`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: wargaNik}) }); if(response.ok) { Swal.fire('Selesai', 'Terima kasih atas konfirmasi Anda. Menunggu penutupan akhir dari Admin.', 'success'); window.loadDashboardWarga(); } else { Swal.fire('Gagal', 'Sistem menolak laporan ini.', 'error'); } } catch(e) { Swal.fire('Error', 'Gangguan jaringan.', 'error'); } } }).catch(() => Swal.close()); };

window.initFormMapPickerPublik = function() { const mapContainer = document.getElementById('mapPublik'); if(!mapContainer) return; let formMapP = L.map('mapPublik', {scrollWheelZoom: false}).setView([-7.4478, 112.7183], 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(formMapP); let formMarkerP = L.marker([-7.4478, 112.7183], { draggable: true }).addTo(formMapP); formMapP.on('click', function(e) { formMarkerP.setLatLng(e.latlng); const lt = document.getElementById('latPublik'); if(lt) lt.value = e.latlng.lat; const lg = document.getElementById('lngPublik'); if(lg) lg.value = e.latlng.lng; }); formMarkerP.on('dragend', function(e) { let position = formMarkerP.getLatLng(); const lt = document.getElementById('latPublik'); if(lt) lt.value = position.lat; const lg = document.getElementById('lngPublik'); if(lg) lg.value = position.lng; }); setTimeout(() => { formMapP.invalidateSize(); }, 800); };
window.daftarMandiri = async function(e) { if(e && typeof e.preventDefault === 'function') e.preventDefault(); const payload = { nik: document.getElementById('regNik').value, nama: document.getElementById('regNama').value, no_hp: document.getElementById('regNoHp').value, email: document.getElementById('regEmail').value, tempat_lahir: document.getElementById('regTempatLahir').value, tanggal_lahir: document.getElementById('regTglLahir').value, alamat: document.getElementById('regAlamat').value, c1: parseFloat(document.getElementById('regC1').value) || 0, c2: parseInt(document.getElementById('regC2').value) || 0, c3: parseInt(document.getElementById('regC3').value) || 0, c4: parseInt(document.getElementById('regC4').value) || 1, c5: parseInt(document.getElementById('regC5').value) || 0, c6: parseInt(document.getElementById('regC6').value) || 1, c7: parseInt(document.getElementById('regC7').value) || 0, c8: parseInt(document.getElementById('regC8').value) || 1, c9: parseInt(document.getElementById('regC9').value) || 1, c10: parseInt(document.getElementById('regC10').value) || 1, lat: document.getElementById('latPublik')?document.getElementById('latPublik').value:"", lng: document.getElementById('lngPublik')?document.getElementById('lngPublik').value:"", catatan: document.getElementById('regCatatan')?document.getElementById('regCatatan').value:"" }; Swal.fire({title: 'Mengirim Data Pendaftaran...', didOpen: () => Swal.showLoading()}); try { const res = await fetch(`${API_URL}/api/public/daftar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if(res.ok) { Swal.fire('Pendaftaran Berhasil', 'Data Anda telah masuk ke antrean validasi Dinas Sosial Sidoarjo. Silakan Login menggunakan NIK dan Nama Anda untuk memantau status.', 'success'); const fm = document.getElementById('formDaftarMandiri'); if(fm) fm.reset(); window.location.hash = '#'; window.switchTabPublik('loginWargaSection', document.getElementById('btn-login')); } else { Swal.fire('Pendaftaran Gagal', data.message || 'Periksa kembali data Anda.', 'error'); } } catch(err) { Swal.fire('Gangguan Jaringan', 'Gagal menyambung ke server. Coba beberapa saat lagi.', 'error'); } };

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
        data.forEach(msg => {
            try {
                let isWarga = msg.sender === 'warga';
                let align = isWarga ? 'flex-end' : 'flex-start';
                let bg = isWarga ? '#dcf8c6' : '#ffffff';
                let color = '#303030';
                let borderRadius = isWarga ? '12px 0px 12px 12px' : '0px 12px 12px 12px';
                let shadow = '0 1px 2px rgba(0,0,0,0.15)';
                
                let replyHtml = '';
                if(msg.reply_to_text) { replyHtml = `<div onclick="window.scrollToMessageWarga(${msg.reply_to_id})" style="cursor:pointer; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; border-left: 4px solid ${isWarga ? '#25d366' : '#3b82f6'}; margin-bottom: 8px; font-size: 0.85rem; color: #555;"><b>${safeHtml(msg.reply_to_sender)}</b><br><i>${safeHtml(msg.reply_to_text)}</i></div>`; }
                let reactionHtml = '';
                if(msg.reaction) { reactionHtml = `<div style="position:absolute; ${isWarga ? 'left:-10px' : 'right:-10px'}; bottom:-10px; background:white; border-radius:20px; padding:2px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.2); font-size:1rem; z-index:5;">${msg.reaction}</div>`; }
                
                let mediaHtml = ''; let cleanFileUrl = 'null';
                if(msg.file_path) {
                    cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '')}`;
                    if(msg.file_type === 'audio') { mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:35px;"></audio></div>`; } 
                    else if(msg.file_type === 'image') { mediaHtml = `<img src="${cleanFileUrl}" style="width:250px; border-radius:8px; margin-bottom:8px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`; } 
                    else if(msg.file_type === 'video') { mediaHtml = `<video src="${cleanFileUrl}" controls style="width:250px; border-radius:8px; margin-bottom:8px; background:black;"></video>`; }
                }
                
                let actionMenu = '';
                if(isWarga && !msg.is_deleted) { 
                    actionMenu = `<div style="position: absolute; left: -25px; top: 10px; cursor: pointer; color: var(--text-muted); font-size:1rem; padding: 0 5px;" onclick="window.toggleChatMenuWarga(${msg.id}, event)"><i class="fas fa-ellipsis-v hover-action"></i><div id="menu-warga-${msg.id}" style="display:none; position:absolute; right:15px; top:0; background:white; box-shadow:var(--shadow-md); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:150px; border:1px solid var(--border-color);"><button onclick="window.hapusPesanWarga(${msg.id}, 'everyone')" class="text-danger"><i class="fas fa-trash-alt"></i> Hapus Pesan</button></div></div>`; 
                } else if(!isWarga && !msg.is_deleted) { 
                    actionMenu = `<div style="position: absolute; right: -25px; top: 10px; cursor: pointer; color: var(--text-muted); font-size:1rem; padding: 0 5px;" onclick="window.toggleChatMenuWarga(${msg.id}, event)"><i class="fas fa-ellipsis-v hover-action"></i><div id="menu-warga-${msg.id}" style="display:none; position:absolute; left:15px; top:0; background:white; box-shadow:var(--shadow-md); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:150px; border:1px solid var(--border-color);"><button onclick="window.setReplyWarga(${msg.id}, decodeURIComponent('${enc(msg.sender === 'admin' ? 'Dinas Sosial' : msg.sender)}'), decodeURIComponent('${enc(msg.pesan)}'), decodeURIComponent('${enc(msg.file_type)}'))"><i class="fas fa-reply" style="color:var(--info);"></i> Balas Pesan</button><button onclick="window.laporPesanAdmin(${msg.id})"><i class="fas fa-flag" style="color:var(--danger);"></i> Laporkan Pesan</button></div></div>`; 
                }
                
                let trackAdminName = '';
                if(!isWarga && msg.nama_admin) { trackAdminName = `<span style="font-size:0.65rem; color:#888; margin-right:5px; font-weight:600;">${safeHtml(msg.nama_admin)}</span>`; }

                html += `<article id="msg-warga-${msg.id}" style="align-self: ${align}; max-width: 75%; position:relative; margin-bottom: 15px; display:flex; flex-direction:column; align-items:${isWarga ? 'flex-end' : 'flex-start'}; font-family: 'Inter', sans-serif;">
                    <section style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.95rem; line-height:1.4; min-width: 160px; text-align: left;">
                        ${replyHtml}${mediaHtml}
                        <span style="display:block; margin-bottom: 8px; word-break: break-word;">${safeHtml(msg.pesan)}</span>
                        <footer style="display:flex; justify-content:flex-end; align-items:center; gap:6px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                            ${trackAdminName}
                            <span style="font-size:0.7rem; color:#64748b; font-weight:700;">${msg.waktu}</span>
                            ${isWarga ? '<i class="fas fa-check-double" style="font-size:0.7rem; color:#34b7f1;"></i>' : ''}
                        </footer>
                    </section>
                    ${reactionHtml}
                    ${actionMenu}
                </article>`;
            } catch(e) {}
        });
        
        if (data.length === 0) { html = `<div style="text-align:center; color:var(--text-muted); margin-top:50px; font-size:0.9rem;">Belum ada pesan. Ketik pesan di bawah untuk memulai obrolan dengan Dinas Sosial.</div>`; }
        const container = document.getElementById('wargaChatMessages'); 
        let isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 80; 
        container.innerHTML = html; 
        if(!isSilent || isAtBottom || data.length === 0) { container.scrollTop = container.scrollHeight; }
    } catch(e) {}
};

window.showPreviewWarga = function(srcUrl, type, fname = '') {
    let previewContainer = document.getElementById('previewMediaContainerWarga'); 
    let previewArea = document.getElementById('preSendPreviewWarga'); 
    
    if(!previewArea) {
        let inputContainer = document.getElementById('wargaChatInput');
        if(inputContainer) {
            let parent = inputContainer.parentElement;
            previewArea = document.createElement('div'); previewArea.id = 'preSendPreviewWarga'; previewArea.style = "display:none; position:absolute; bottom:60px; left:10px; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:10px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); z-index:100; min-width:150px;";
            previewArea.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;"><b style="font-size:0.85rem; color:#64748b;" id="wargaFileStatusTxt">Lampiran</b><i class="fas fa-times" style="cursor:pointer; color:#ef4444;" onclick="window.batalLampiranWarga()"></i></div><div id="previewMediaContainerWarga" style="display:flex; justify-content:center;"></div>`;
            parent.style.position = 'relative'; parent.appendChild(previewArea);
            previewContainer = document.getElementById('previewMediaContainerWarga');
        }
    }
    
    if(previewArea && previewContainer) {
        const wt = document.getElementById('wargaFileStatusTxt'); if(wt) wt.innerText = 'Lampiran Siap Kirim';
        if(type === 'image') { previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height: 100px; border-radius: 8px; object-fit: contain;">`; } 
        else if(type === 'video') { previewContainer.innerHTML = `<video src="${srcUrl}" style="max-height: 100px; border-radius: 8px;"></video>`; } 
        else if (type === 'audio') { previewContainer.innerHTML = `<audio src="${srcUrl}" controls style="height: 40px; border-radius:20px;"></audio>`; } 
        else { previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info); text-align:center;"><i class="fas fa-file-alt fa-3x"></i><br><small>${fname}</small></div>`; } 
        previewArea.style.display = 'block'; 
    }
};

window.batalLampiranWarga = function() { 
    window.editedMediaBlob = null; window.editedMediaExt = ''; window.editedMediaType = ''; 
    const fileInput = document.getElementById('wargaChatFile'); if(fileInput) fileInput.value = ''; 
    const preArea = document.getElementById('preSendPreviewWarga'); if(preArea) preArea.style.display = 'none'; 
    const preContainer = document.getElementById('previewMediaContainerWarga'); if(preContainer) preContainer.innerHTML = ''; 
};

window.toggleVoiceRecordWarga = async function() {
    if (!window.isWargaRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let recUI = document.getElementById('wargaRecordingUI'); let waveBox = document.getElementById('waveContainerWarga');
            if(!waveBox) {
                waveBox = document.createElement('div'); waveBox.id = 'waveContainerWarga'; waveBox.style = 'display:flex; align-items:center; gap:4px; margin-left:15px; height:30px; flex:1;';
                for(let i=0; i<15; i++) { waveBox.innerHTML += `<div class="wave-bar" style="width:4px; height:4px; background:#10b981; border-radius:4px; transition:height 0.05s ease;"></div>`; }
                if(recUI) recUI.appendChild(waveBox); 
            }
            if(waveBox) waveBox.style.display = 'flex';
            
            audioContextWarga = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextWarga.createMediaStreamSource(stream);
            analyserWarga = audioContextWarga.createAnalyser(); analyserWarga.fftSize = 64; source.connect(analyserWarga);
            dataArrayWarga = new Uint8Array(analyserWarga.frequencyBinCount);
            
            function animateBarsWarga() {
                reqFrameWarga = requestAnimationFrame(animateBarsWarga); analyserWarga.getByteFrequencyData(dataArrayWarga);
                if(waveBox) {
                    let bars = waveBox.querySelectorAll('.wave-bar'); let step = Math.floor(dataArrayWarga.length / bars.length);
                    bars.forEach((bar, index) => { let value = dataArrayWarga[index * step]; let height = Math.max(4, (value / 255) * 30); bar.style.height = `${height}px`; bar.style.background = value > 150 ? '#047857' : '#10b981'; });
                }
            }
            animateBarsWarga();
            
            window.wargaAudioRecorder = new MediaRecorder(stream); window.wargaAudioChunks = [];
            window.wargaAudioRecorder.ondataavailable = e => { if(e.data.size > 0) window.wargaAudioChunks.push(e.data); };
            window.wargaAudioRecorder.onstop = () => {
                const audioBlob = new Blob(window.wargaAudioChunks, { type: 'audio/webm' });
                window.editedMediaBlob = audioBlob; window.editedMediaExt = 'webm'; window.editedMediaType = 'audio';
                window.isWargaRecordingAudio = false; clearInterval(window.wargaRecordTimer);
                
                if(audioContextWarga) { audioContextWarga.close(); cancelAnimationFrame(reqFrameWarga); }
                if(waveBox) waveBox.style.display = 'none';

                if(recUI) recUI.style.display = 'none'; 
                const inp = document.getElementById('wargaChatInput'); if(inp) inp.style.display = 'block'; 
                const btnRec = document.getElementById('btnRecordWarga'); if(btnRec) btnRec.style.color = 'var(--text-muted)';
                
                if(window.isAutoSendAudioWarga) { window.isAutoSendAudioWarga = false; window.executeSendWargaChat(); } 
                else { window.showPreviewWarga(URL.createObjectURL(audioBlob), 'audio', 'Pesan Suara.webm'); }
            };
            window.wargaAudioRecorder.start(); window.isWargaRecordingAudio = true;
            if(recUI) recUI.style.display = 'flex'; 
            const inp = document.getElementById('wargaChatInput'); if(inp) inp.style.display = 'none'; 
            const btnRec = document.getElementById('btnRecordWarga'); if(btnRec) btnRec.style.color = 'var(--danger)';
            window.wargaRecordSecs = 0;
            window.wargaRecordTimer = setInterval(() => { window.wargaRecordSecs++; const m = String(Math.floor(window.wargaRecordSecs/60)).padStart(2,'0'); const s = String(window.wargaRecordSecs%60).padStart(2,'0'); const tim = document.getElementById('wargaRecordTime'); if(tim) tim.innerText = `${m}:${s}`; }, 1000);
        } catch(err) { Swal.fire('Akses Ditolak', 'Gagal memanggil mikrofon perangkat Anda.', 'error'); }
    } else { window.wargaAudioRecorder.stop(); window.wargaAudioRecorder.stream.getTracks().forEach(t => t.stop()); }
};

window.sendWargaChat = async function() { 
    if(window.isWargaRecordingAudio) { window.isAutoSendAudioWarga = true; window.wargaAudioRecorder.stop(); window.wargaAudioRecorder.stream.getTracks().forEach(t => t.stop()); return; } 
    window.executeSendWargaChat(); 
};

window.executeSendWargaChat = async function() {
    if(!wargaNik) return;
    const input = document.getElementById('wargaChatInput'); const pesan = input ? input.value.trim() : '';
    if(!pesan && !window.editedMediaBlob) return;
    
    const formData = new FormData();
    formData.append('sender', 'warga'); formData.append('nama', wargaNama); formData.append('pesan', pesan);
    
    if(window.editedMediaBlob) { 
        const finalName = `media_${Date.now()}.${window.editedMediaExt}`; 
        formData.append('file', window.editedMediaBlob, finalName); 
        if(window.editedMediaType) formData.append('custom_file_type', window.editedMediaType); 
    } 
    if(replyToDataWarga) { formData.append('reply_to_id', replyToDataWarga.id); formData.append('reply_to_text', replyToDataWarga.text); formData.append('reply_to_sender', replyToDataWarga.sender); } 
    
    if(input) input.value = ''; 
    const ep = document.getElementById('emojiPickerWarga'); if(ep) ep.style.display = 'none'; 
    window.batalLampiranWarga(); window.batalReplyWarga(); 
    
    try { await fetch(`${API_URL}/api/chat/${wargaNik}`, { method: 'POST', body: formData }); window.loadChatMessagesWarga(true); } 
    catch(e) {}
};

// MENCEGAH KLIK EMOJI TERCEGAT OLEH FUNGSI LAIN
window.toggleEmojiPickerWarga = function(event) { 
    if(event) event.stopPropagation();
    let el = document.getElementById('emojiPickerWarga'); 
    
    if(!el) {
        el = document.createElement('div'); el.id = 'emojiPickerWarga';
        el.style = "display:none; position:absolute; bottom:60px; left:10px; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:10px; width:280px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); grid-template-columns:repeat(6, 1fr); gap:8px; z-index:1000;";
        let inputContainer = document.getElementById('wargaChatInput');
        if(inputContainer) {
            inputContainer.parentElement.style.position = 'relative'; inputContainer.parentElement.appendChild(el);
            const emojisList = ['😀','😂','🥰','😎','😭','😡','👍','🙏','❤️','🔥','✅','❌','💡','🎉','😢','🤔','👏','🚨']; 
            let html = ''; 
            // PENAMBAHAN EVENT STOP PROPAGATION PADA MASING-MASING STIKER
            emojisList.forEach(e => { html += `<div style="cursor:pointer; font-size:1.5rem; text-align:center; user-select:none; transition:0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="event.stopPropagation(); window.addEmojiWarga('${e}')">${e}</div>`; });
            el.innerHTML = html;
        }
    }
    if(el) el.style.display = el.style.display === 'none' ? 'grid' : 'none'; 
};

window.addEmojiWarga = function(emoji) { const input = document.getElementById('wargaChatInput'); if(input) { input.value += emoji; input.focus(); } };
window.handleChatEnterWarga = function(e) { if(e.key === 'Enter') { window.sendWargaChat(); } };

window.setReplyWarga = function(id, sender, text, file_type) { let displayTxt = text; if(file_type === 'image') displayTxt = '📷 Gambar'; else if(file_type === 'video') displayTxt = '🎥 Video'; else if(file_type === 'audio') displayTxt = '🎤 Pesan Suara'; replyToDataWarga = {id: id, sender: sender, text: displayTxt}; document.getElementById('replyPreviewSenderWarga').innerText = safeHtml(sender); document.getElementById('replyPreviewTextWarga').innerText = displayTxt.length > 60 ? displayTxt.substring(0,60)+'...' : displayTxt; document.getElementById('replyPreviewContainerWarga').style.display = 'flex'; const inp = document.getElementById('wargaChatInput'); if(inp) inp.focus(); };
window.batalReplyWarga = function() { replyToDataWarga = null; const cont = document.getElementById('replyPreviewContainerWarga'); if(cont) cont.style.display = 'none'; };
window.toggleChatMenuWarga = function(id, event) { event.stopPropagation(); const allMenus = document.querySelectorAll('[id^="menu-warga-"]'); allMenus.forEach(m => { if(m.id !== `menu-warga-${id}`) m.style.display = 'none'; }); const menu = document.getElementById(`menu-warga-${id}`); if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
window.hapusPesanWarga = async function(id, tipe) { if(confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini dari obrolan' : 'menghapus pesan dari layar Anda'}?`)) { await fetch(`${API_URL}/api/chat/action/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: tipe, requester: 'warga'}) }); window.loadChatMessagesWarga(true); } };
window.scrollToMessageWarga = function(id) { const el = document.getElementById(`msg-warga-${id}`); if(el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('highlight-msg'); setTimeout(() => el.classList.remove('highlight-msg'), 2500); } };
window.laporPesanAdmin = async function(msgId) { const { value: alasan } = await Swal.fire({ title: 'Laporkan Pesan', input: 'select', inputOptions: { 'Kata-kata Kasar': 'Kata-kata Kasar / Pelecehan', 'Permintaan Ilegal': 'Permintaan Uang / Pungli', 'Penipuan': 'Penipuan / Misinformasi', 'Lainnya': 'Lainnya' }, showCancelButton: true, confirmButtonText: 'Laporkan', confirmButtonColor: '#ef4444' }); if (alasan) { Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()}); try { await fetch(`${API_URL}/api/chat/report/${msgId}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({reason: alasan, reporter: wargaNama}) }); Swal.fire('Terlapor', 'Pesan ini telah diteruskan ke Pusat Investigasi Keamanan untuk ditindaklanjuti.', 'success'); } catch(e) { Swal.fire('Error', 'Gagal melaporkan', 'error'); } } };
window.openLightbox = function(type, src) { const content = document.getElementById('lightboxContent'); if (type === 'image') { content.innerHTML = `<img src="${src}" style="max-width:100%; max-height:85vh; object-fit:contain; border-radius:8px;">`; } else { content.innerHTML = `<video src="${src}" controls autoplay style="max-width:100%; max-height:85vh; border-radius:8px; outline:none; background:black;"></video>`; } const ml = document.getElementById('mediaLightbox'); if(ml) ml.style.display = 'flex'; };
window.closeLightbox = function(e) { if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) { const mediaElements = document.querySelectorAll('#lightboxContent video, #lightboxContent audio'); mediaElements.forEach(media => { media.pause(); media.removeAttribute('src'); media.load(); }); const ml = document.getElementById('mediaLightbox'); if(ml) ml.style.display = 'none'; const lc = document.getElementById('lightboxContent'); if(lc) lc.innerHTML = ''; } };

// ==========================================
// 4. WEBRTC PANGGILAN (WARGA SIDE)
// ==========================================
window.initPeerJSWarga = function() { if(!wargaNik) return; if(peerWarga) peerWarga.destroy(); peerWarga = new Peer('dinsos-warga-' + wargaNik); peerWarga.on('connection', (conn) => { conn.on('data', (data) => { if(data.type === 'emoji') window.showCallReaction(data.emoji); }); }); peerWarga.on('call', (call) => { activeCallWarga = call; let callType = call.metadata ? call.metadata.callType : 'audio'; const inc = document.getElementById('wargaIncomingCallUI'); if(inc) inc.style.display = 'flex'; const audio = document.getElementById('wargaRingtoneAudio'); if(audio) audio.play().catch(()=>{}); }); };
window.acceptCallWarga = async function() { const audio = document.getElementById('wargaRingtoneAudio'); if(audio) { audio.pause(); audio.currentTime = 0; } let callType = activeCallWarga.metadata ? activeCallWarga.metadata.callType : 'audio'; const constraints = { audio: { echoCancellation: true, noiseSuppression: true }, video: callType === 'video' ? { facingMode: "user" } : false }; try { localStreamWarga = await navigator.mediaDevices.getUserMedia(constraints); if(callType === 'video') { const vca = document.getElementById('wargaVideoCallArea'); if(vca) vca.style.display = 'block'; const lv = document.getElementById('wargaLocalVideo'); if(lv) lv.srcObject = localStreamWarga; } else { const vca = document.getElementById('wargaVideoCallArea'); if(vca) vca.style.display = 'none'; } activeCallWarga.answer(localStreamWarga); const inc = document.getElementById('wargaIncomingCallUI'); if(inc) inc.style.display = 'none'; const acUI = document.getElementById('wargaActiveCallUI'); if(acUI) acUI.style.display = 'flex'; const cst = document.getElementById('wargaCallStatusText'); if(cst) cst.innerText = "Terhubung"; activeCallWarga.on('stream', (remoteStream) => { if(remoteStream.getVideoTracks().length > 0) { const rv = document.getElementById('wargaRemoteVideo'); if(rv) rv.srcObject = remoteStream; } }); activeCallWarga.on('close', () => window.endCallUIWarga()); } catch(err) { Swal.fire('Error', 'Kamera/Mikrofon tidak diizinkan.', 'error'); window.rejectCallWarga(); } };
window.rejectCallWarga = function() { const audio = document.getElementById('wargaRingtoneAudio'); if(audio) { audio.pause(); audio.currentTime = 0; } if(activeCallWarga) activeCallWarga.close(); window.endCallUIWarga(); };
window.endCallWarga = function() { if(activeCallWarga) activeCallWarga.close(); if(localStreamWarga) localStreamWarga.getTracks().forEach(t => t.stop()); window.endCallUIWarga(); };
window.endCallUIWarga = function() { const inc = document.getElementById('wargaIncomingCallUI'); if(inc) inc.style.display = 'none'; const acUI = document.getElementById('wargaActiveCallUI'); if(acUI) acUI.style.display = 'none'; activeCallWarga = null; const rv = document.getElementById('wargaRemoteVideo'); if(rv) rv.srcObject = null; const lv = document.getElementById('wargaLocalVideo'); if(lv) lv.srcObject = null; };
window.toggleMuteCallWarga = function() { if(!localStreamWarga) return; let audioTrack = localStreamWarga.getAudioTracks()[0]; audioTrack.enabled = !audioTrack.enabled; const btn = document.getElementById('wargaBtnMute'); if(btn) { if(!audioTrack.enabled) { btn.innerHTML = '<i class="fas fa-microphone-slash"></i>'; btn.classList.add('off'); } else { btn.innerHTML = '<i class="fas fa-microphone"></i>'; btn.classList.remove('off'); } } };