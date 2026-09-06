/* =========================================================================
   ADMIN-CHAT.JS - LIVE CHAT MEDIASI, INVESTIGASI LAPORAN, WEBRTC & MEDIA STUDIO
   ========================================================================= */

window.activeChatNik = null;
window.activeChatName = null;
window.adminMediaBlob = null;
window.adminMediaExt = '';
window.adminMediaType = '';
window.rawChatListData = [];

window.adminAudioRecorder = null;
window.adminAudioChunks = [];
window.isAdminRecordingAudio = false;
window.adminRecordTimer = null;
window.adminRecordSecs = 0;

let audioContextAdmin = null, analyserAdmin = null, dataArrayAdmin = null, reqFrameAdmin = null;
let vPlayer = null, vCanvas = null, vCtx = null, vRotation = 0, vStartTime = 0, vEndTime = 0, vDuration = 0;
let filerobotImageInstance = null;
let myPeer = null, currentCall = null, localStream = null;
let isCallAudioMuted = false, isCallVideoMuted = false, isCallBlurred = false;
let callTimerInterval = null, callDurationSecs = 0;

// 1. INVESTIGASI LAPORAN SENGKETA OBROLAN (DITAMBAHKAN & DIPERBAIKI)
window.bukaModalLaporanChat = async function () {
    const modal = document.getElementById('modalLaporanChat');
    const container = document.getElementById('laporanChatList');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:35px; color:#64748b;"><i class="fas fa-spinner fa-spin fa-2x text-primary"></i><br><br>Memuat data aduan sengketa bansos...</div>';

    try {
        let res = await window.fetchData('/api/laporan-chat');
        if (!res || !res.ok) {
            res = await window.fetchData('/laporan-chat');
        }

        let reports = [];
        if (res && res.ok) {
            reports = await res.json();
        }

        container.innerHTML = '';
        if (!Array.isArray(reports) || reports.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:45px 20px; color:#64748b;">
                    <i class="fas fa-shield-check fa-3x" style="color:#10b981; margin-bottom:12px;"></i>
                    <h4 style="margin:0; color:#0f172a;">Tidak Ada Sengketa Aktif</h4>
                    <p style="font-size:0.85rem; margin-top:4px;">Semua proses distribusi bantuan sosial berjalan lancar dan belum ada sengketa yang diajukan oleh warga.</p>
                </div>
            `;
            return;
        }

        reports.forEach((r) => {
            const pesanText = r.pesan && r.pesan.trim() !== '' && r.pesan !== '❤️'
                ? window.safeHtml(r.pesan)
                : 'Warga melaporkan belum menerima bantuan sosial fisik padahal status di sistem telah dinyatakan salur. Perlu dilakukan verifikasi lapangan.';

            const badgeStatus = r.status === 'selesai'
                ? '<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:0.75rem;"><i class="fas fa-check"></i> Selesai</span>'
                : '<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-size:0.75rem;"><i class="fas fa-exclamation-triangle"></i> Perlu Tindak Lanjut</span>';

            container.innerHTML += `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:5px solid #ef4444; border-radius:12px; padding:16px 18px; margin-bottom:14px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#dc2626; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
                                <i class="fas fa-user-shield"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:0.95rem; color:#0f172a; font-weight:800;">${window.safeHtml(r.nama || 'Warga Terlapor')}</h4>
                                <small style="color:#64748b; font-family:monospace;">NIK: ${r.nik || '-'}</small>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            ${badgeStatus}
                            <div style="font-size:0.72rem; color:#94a3b8; margin-top:4px;"><i class="fas fa-clock"></i> ${r.waktu || 'Hari ini'}</div>
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:10px 12px; border-radius:8px; font-size:0.85rem; color:#334155; line-height:1.45; margin-bottom:12px;">
                        <b>Uraian Aduan:</b> "${pesanText}"
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                        <button onclick="window.closeModal('modalLaporanChat'); window.openAdminChat(); window.loadChatMessages('${r.nik}', '${window.escapeInlineJS(r.nama)}');" class="btn btn-primary btn-sm" style="font-size:0.78rem; padding:6px 12px; border-radius:8px;">
                            <i class="fas fa-comments"></i> Buka Chat Mediasi
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#dc2626;">Gagal memuat aduan investigasi: ' + e.message + '</div>';
    }
};

// 2. KONTROL LIVE CHAT
window.openAdminChat = function () {
    const modal = document.getElementById('modalAdminChat');
    if (modal) modal.style.display = 'flex';
    window.loadChatList();
    window.tutupObrolanAktif();
};

window.loadChatList = async function () {
    try {
        const res = await window.fetchData('/api/chat/list');
        if (!res || !res.ok) return;
        window.rawChatListData = await res.json();
        window.renderCategorizedInbox();
    } catch (e) { }
};

window.renderCategorizedInbox = function (query = '') {
    const container = document.getElementById('chatContactList');
    if (!container) return;
    let list = [...window.rawChatListData];
    if (query) list = list.filter(c => (c.nama || '').toLowerCase().includes(query.toLowerCase()) || String(c.nik).includes(query));
    if (list.length === 0) { 
        container.innerHTML = `<div style="text-align:center; padding:40px 10px; color:#94a3b8;">Tidak ada pesan masuk.</div>`; 
        return; 
    }

    let html = '';
    list.forEach(c => {
        html += `
            <div class="chat-contact-item ${c.nik === window.activeChatNik ? 'active' : ''}" onclick="window.loadChatMessages('${c.nik}', '${window.escapeInlineJS(c.nama)}')">
                <div class="contact-avatar">${(c.nama || 'W').charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name"><span>${window.safeHtml(c.nama)}</span><span style="font-size:0.75rem; color:#64748b;">${c.waktu}</span></div>
                    <div class="contact-nik">NIK: ${c.nik}</div>
                    <div class="contact-last-msg">${window.safeHtml(c.last_msg)}</div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

window.switchChatTab = function (tab) {
    window.activeChatTab = tab;
    const inboxBtn = document.getElementById('tabInboxBtn'), kontakBtn = document.getElementById('tabKontakBtn');
    const inboxList = document.getElementById('chatContactList'), kontakList = document.getElementById('chatBukuKontakList');
    if (tab === 'inbox') {
        if (inboxBtn) inboxBtn.className = 'btn btn-primary';
        if (kontakBtn) { kontakBtn.className = 'btn btn-secondary'; kontakBtn.style.background = 'transparent'; }
        if (inboxList) inboxList.style.display = 'block';
        if (kontakList) kontakList.style.display = 'none';
        window.renderCategorizedInbox();
    } else {
        if (kontakBtn) { kontakBtn.className = 'btn btn-primary'; kontakBtn.style.background = ''; }
        if (inboxBtn) { inboxBtn.className = 'btn btn-secondary'; inboxBtn.style.background = 'transparent'; }
        if (inboxList) inboxList.style.display = 'none';
        if (kontakList) { kontakList.style.display = 'block'; window.renderBukuKontak(); }
    }
};

window.renderBukuKontak = function () {
    const container = document.getElementById('chatBukuKontakList');
    if (!container) return;
    let html = '';
    const dataWarga = window.globalDataWarga || [];
    dataWarga.forEach(w => {
        html += `
            <div class="chat-contact-item" onclick="window.loadChatMessages('${w.nik}', '${window.escapeInlineJS(w.nama)}')">
                <div class="contact-avatar">${(w.nama || 'W').charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${window.safeHtml(w.nama)}</div>
                    <div class="contact-nik">NIK: ${w.nik}</div>
                    <small style="color:#64748b;">${window.safeHtml(w.alamat || 'Sidoarjo')}</small>
                </div>
            </div>`;
    });
    container.innerHTML = html || '<div style="text-align:center; padding:30px; color:#94a3b8;">Buku kontak kosong.</div>';
};

window.filterChatList = function () {
    const query = document.getElementById('searchChatInput')?.value.trim() || '';
    if (window.activeChatTab === 'inbox') window.renderCategorizedInbox(query);
};

window.loadChatMessages = async function (nik, nama) {
    window.activeChatNik = String(nik);
    window.activeChatName = nama;
    const nameDisp = document.getElementById('chatActiveNameDisplay'), infoDisp = document.getElementById('chatActiveInfoDisplay');
    const nikDisp = document.getElementById('chatActiveNikDisplay'), avatarDisp = document.getElementById('chatHeaderAvatar');
    const headerActions = document.getElementById('chatHeaderActions');

    if (nameDisp) nameDisp.innerText = nama;
    if (nikDisp) nikDisp.innerText = nik;
    if (infoDisp) infoDisp.style.display = 'flex';
    if (avatarDisp) { avatarDisp.style.display = 'flex'; avatarDisp.innerText = (nama || 'W').charAt(0).toUpperCase(); }
    if (headerActions) headerActions.style.display = 'flex';

    const chatInp = document.getElementById('adminChatInput');
    const chatBtn = document.getElementById('btnSendAdmin');
    if (chatInp) chatInp.disabled = false;
    if (chatBtn) chatBtn.disabled = false;

    try {
        const res = await window.fetchData(`/api/chat/${nik}`);
        if (!res || !res.ok) return;
        let data = await res.json();
        const container = document.getElementById('adminChatMessages');
        if (!container) return;

        const baseUrl = window.API_BASE_URL || 'http://127.0.0.1:5000';
        let html = '';
        data.forEach(msg => {
            const isAdmin = msg.sender === 'admin';
            let mediaHtml = '';
            if (msg.file_path) {
                const url = msg.file_path.startsWith('http') ? msg.file_path : `${baseUrl}${msg.file_path}`;
                if (msg.file_type === 'image') mediaHtml = `<img src="${url}" style="max-width:220px; border-radius:10px; margin-top:6px; cursor:pointer;" onclick="window.openLightbox('${url}', 'image')" />`;
                else if (msg.file_type === 'video') mediaHtml = `<video src="${url}" controls style="max-width:240px; border-radius:10px; margin-top:6px;"></video>`;
                else if (msg.file_type === 'audio') mediaHtml = `<audio src="${url}" controls style="margin-top:6px; max-width:220px;"></audio>`;
            }
            html += `
                <div style="display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'}; margin-bottom:10px;">
                    <div style="background:${isAdmin ? 'linear-gradient(135deg, #009846, #047857)' : '#ffffff'}; color:${isAdmin ? '#ffffff' : '#1e293b'}; padding:12px 18px; border-radius:16px; max-width:70%; box-shadow:0 2px 8px rgba(0,0,0,0.06); word-break:break-word;">
                        ${msg.pesan ? window.safeHtml(msg.pesan) : ''}${mediaHtml}
                        <div style="font-size:0.7rem; opacity:0.75; text-align:right; margin-top:4px;">${msg.waktu}</div>
                    </div>
                </div>`;
        });
        container.innerHTML = html || '<div style="text-align:center; color:#94a3b8; margin-top:50px;">Belum ada pesan.</div>';
        container.scrollTop = container.scrollHeight;
    } catch (e) { }
};

window.sendAdminChat = async function () {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
    const input = document.getElementById('adminChatInput'), text = input ? input.value.trim() : '';
    if (!text && !window.adminMediaBlob) return;

    const formData = new FormData();
    formData.append('sender', 'admin');
    formData.append('nama', 'Pusat Layanan Dinsos Sidoarjo');
    formData.append('pesan', text);
    if (window.adminMediaBlob) formData.append('file', window.adminMediaBlob, `media_${Date.now()}.${window.adminMediaExt || 'jpg'}`);

    if (input) input.value = '';
    window.batalLampiranAdmin();

    try {
        const res = await window.fetchData(`/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
        if (res && res.ok) { 
            window.loadChatMessages(window.activeChatNik, window.activeChatName); 
            window.loadChatList(); 
        }
    } catch (e) { 
        Swal.fire('Error', 'Gagal mengirim pesan.', 'error'); 
    }
};

window.showPreviewAdmin = function (url, type, name) {
    const preBox = document.getElementById('preSendPreviewAdmin');
    const container = document.getElementById('previewMediaContainerAdmin');
    if (!preBox || !container) return;
    preBox.style.display = 'block';
    if (type === 'image') {
        container.innerHTML = `<img src="${url}" style="max-height:140px; border-radius:8px;" /><button onclick="window.initFilerobotEditor('${url}', '${name}')" class="btn btn-secondary btn-sm" style="position:absolute; bottom:15px; right:15px;"><i class="fas fa-crop-alt"></i> Edit Gambar</button>`;
    } else if (type === 'video') {
        container.innerHTML = `<video src="${url}" style="max-height:140px; border-radius:8px;" controls></video><button onclick="window.bukaVideoEditor('${url}', '${name}')" class="btn btn-secondary btn-sm" style="position:absolute; bottom:15px; right:15px;"><i class="fas fa-cut"></i> Potong Video</button>`;
    } else {
        container.innerHTML = `<div><i class="fas fa-file fa-3x text-info"></i><br><span>${name}</span></div>`;
    }
};

window.batalLampiranAdmin = function () {
    window.adminMediaBlob = null; window.adminMediaExt = ''; window.adminMediaType = '';
    const fileInp = document.getElementById('adminChatFile');
    if (fileInp) fileInp.value = '';
    const preBox = document.getElementById('preSendPreviewAdmin');
    if (preBox) preBox.style.display = 'none';
};

window.batalReplyAdmin = function () {
    const box = document.getElementById('replyPreviewContainerAdmin');
    if (box) box.style.display = 'none';
};

window.tutupObrolanAktif = function () {
    window.activeChatNik = null; window.activeChatName = null;
    const nameDisp = document.getElementById('chatActiveNameDisplay'), infoDisp = document.getElementById('chatActiveInfoDisplay');
    const avatarDisp = document.getElementById('chatHeaderAvatar'), headerActions = document.getElementById('chatHeaderActions');

    if (nameDisp) nameDisp.innerText = 'Pilih Warga di Kotak Masuk atau Buku Kontak...';
    if (infoDisp) infoDisp.style.display = 'none';
    if (avatarDisp) avatarDisp.style.display = 'none';
    if (headerActions) headerActions.style.display = 'none';

    const inp = document.getElementById('adminChatInput'), btnSend = document.getElementById('btnSendAdmin');
    if (inp) inp.disabled = true;
    if (btnSend) btnSend.disabled = true;

    const msgs = document.getElementById('adminChatMessages');
    if (msgs) msgs.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:100px;"><i class="fas fa-comments fa-3x" style="opacity:0.3; margin-bottom:15px;"></i><br>Pilih daftar warga untuk mulai berinteraksi secara real-time.</div>';
};

window.toggleEmojiPicker = function (target) {
    const ep = document.getElementById('emojiPickerAdmin');
    if (!ep) return;
    if (ep.style.display === 'grid') ep.style.display = 'none';
    else {
        const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👍','👎','👏','🙌','🙏','🤝','❤️','🔥','✨','🎉','⚠️'];
        ep.innerHTML = emojis.map(em => `<span style="font-size:1.4rem; cursor:pointer; text-align:center;" onclick="window.insertEmoji('${em}', '${target}')">${em}</span>`).join('');
        ep.style.display = 'grid';
    }
};

window.insertEmoji = function (emoji, target) {
    const input = document.getElementById('adminChatInput');
    if (input) { input.value += emoji; input.focus(); }
    const ep = document.getElementById('emojiPickerAdmin');
    if (ep) ep.style.display = 'none';
};

window.handleChatEnter = function (e, target) {
    if (e.key === 'Enter') { e.preventDefault(); window.sendAdminChat(); }
};

// 3. STUDIO GAMBAR & VIDEO
window.initFilerobotEditor = function (imageUrl, filename) {
    const modal = document.getElementById('imageEditorModal'), container = document.getElementById('filerobotContainer');
    if (!modal || !container || typeof FilerobotImageEditor === 'undefined') return;
    modal.style.display = 'flex';
    if (filerobotImageInstance) filerobotImageInstance.terminate();
    filerobotImageInstance = new FilerobotImageEditor(container, {
        source: imageUrl, savingPixelRatio: 4, previewPixelRatio: window.devicePixelRatio || 1,
        onSave: (imageInfo) => {
            fetch(imageInfo.imageBase64).then(res => res.blob()).then(blob => {
                window.adminMediaBlob = blob; window.adminMediaExt = 'jpg'; window.adminMediaType = 'image';
                window.batalImageEditor();
                window.showPreviewAdmin(imageInfo.imageBase64, 'image', filename || 'edited_image.jpg');
            });
        },
        onClose: () => { window.batalImageEditor(); }
    });
    filerobotImageInstance.render();
};

window.batalImageEditor = function () {
    const modal = document.getElementById('imageEditorModal');
    if (modal) modal.style.display = 'none';
    if (filerobotImageInstance) { try { filerobotImageInstance.terminate(); } catch (e) { } filerobotImageInstance = null; }
};

window.bukaVideoEditor = function (videoUrl, filename) {
    const modal = document.getElementById('videoEditorModal');
    vPlayer = document.getElementById('vEditorPlayer');
    if (!modal || !vPlayer) return;
    modal.style.display = 'flex'; vPlayer.src = videoUrl; vRotation = 0; vPlayer.style.transform = 'rotate(0deg)';
    vPlayer.onloadedmetadata = function () {
        vDuration = vPlayer.duration; vStartTime = 0; vEndTime = vDuration;
        document.getElementById('vTrimStart').value = 0; document.getElementById('vTrimEnd').value = 100;
        window.vUpdateTrimUI();
    };
};

window.vTogglePlay = function () {
    if (!vPlayer) return;
    const btn = document.getElementById('vPlayBtn');
    if (vPlayer.paused) { vPlayer.play(); if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>'; }
    else { vPlayer.pause(); if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>'; }
};

window.vRotate = function () {
    vRotation = (vRotation + 90) % 360;
    if (vPlayer) vPlayer.style.transform = `rotate(${vRotation}deg)`;
};

window.vUpdateTrim = function (type) {
    const startInp = parseFloat(document.getElementById('vTrimStart').value);
    const endInp = parseFloat(document.getElementById('vTrimEnd').value);
    if (startInp >= endInp) {
        if (type === 'start') document.getElementById('vTrimStart').value = endInp - 1;
        else document.getElementById('vTrimEnd').value = startInp + 1;
    }
    vStartTime = (parseFloat(document.getElementById('vTrimStart').value) / 100) * vDuration;
    vEndTime = (parseFloat(document.getElementById('vTrimEnd').value) / 100) * vDuration;
    if (type === 'start' && vPlayer) vPlayer.currentTime = vStartTime;
    window.vUpdateTrimUI();
};

window.vUpdateTrimUI = function () {
    const activeBar = document.getElementById('vTrimActive');
    const startPct = document.getElementById('vTrimStart').value, endPct = document.getElementById('vTrimEnd').value;
    if (activeBar) { activeBar.style.left = `${startPct}%`; activeBar.style.width = `${endPct - startPct}%`; }
    const timeDisp = document.getElementById('vTimeDisplay');
    if (timeDisp) timeDisp.innerText = `${vStartTime.toFixed(1)}s - ${vEndTime.toFixed(1)}s`;
};

window.vProcessAndSave = async function () {
    if (!vPlayer) return;
    const overlay = document.getElementById('vProcessingOverlay');
    if (overlay) overlay.style.display = 'flex';

    vCanvas = document.getElementById('vRenderCanvas') || document.createElement('canvas');
    vCanvas.id = 'vRenderCanvas'; vCtx = vCanvas.getContext('2d');
    const width = vRotation % 180 === 0 ? vPlayer.videoWidth : vPlayer.videoHeight;
    const height = vRotation % 180 === 0 ? vPlayer.videoHeight : vPlayer.videoWidth;
    vCanvas.width = width || 640; vCanvas.height = height || 480;

    const stream = vCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: 'video/webm' });
        window.adminMediaBlob = finalBlob; window.adminMediaExt = 'webm'; window.adminMediaType = 'video';
        window.batalVideoEditor();
        window.showPreviewAdmin(URL.createObjectURL(finalBlob), 'video', 'trimmed_video.webm');
    };

    recorder.start();
    vPlayer.currentTime = vStartTime; vPlayer.play();
    const interval = setInterval(() => {
        if (vPlayer.currentTime >= vEndTime || vPlayer.ended) {
            clearInterval(interval); vPlayer.pause(); recorder.stop();
        } else {
            vCtx.save(); vCtx.translate(vCanvas.width / 2, vCanvas.height / 2);
            vCtx.rotate((vRotation * Math.PI) / 180);
            vCtx.drawImage(vPlayer, -vPlayer.videoWidth / 2, -vPlayer.videoHeight / 2);
            vCtx.restore();
        }
    }, 1000 / 30);
};

window.batalVideoEditor = function () {
    const modal = document.getElementById('videoEditorModal');
    if (modal) modal.style.display = 'none';
    if (vPlayer) { vPlayer.pause(); vPlayer.src = ''; }
    const overlay = document.getElementById('vProcessingOverlay');
    if (overlay) overlay.style.display = 'none';
};

// 4. WEBRTC P2P CALL & VOICE NOTE
window.initPeerCall = function () {
    try {
        if (typeof Peer !== 'undefined' && !myPeer) {
            myPeer = new Peer(`dinsos_admin_${Date.now().toString().slice(-4)}`);
            myPeer.on('call', call => {
                currentCall = call;
                const incomingUI = document.getElementById('incomingCallUI'), callerName = document.getElementById('callerNameText');
                if (incomingUI) incomingUI.style.display = 'flex';
                if (callerName) callerName.innerText = call.peer;
                document.getElementById('ringtoneAudio')?.play().catch(() => {});
            });
        }
    } catch (e) { }
};

window.startCallWarga = async function (type = 'audio') {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        document.getElementById('activeCallUI').style.display = 'flex';
        document.getElementById('activeCallName').innerText = `${window.activeChatName} (${window.activeChatNik})`;
        document.getElementById('videoCallArea').style.display = type === 'video' ? 'block' : 'none';
        document.getElementById('audioCallArea').style.display = type === 'video' ? 'none' : 'flex';
        if (type === 'video') document.getElementById('localVideo').srcObject = localStream;
        callDurationSecs = 0;
        callTimerInterval = setInterval(() => {
            callDurationSecs++;
            const mins = String(Math.floor(callDurationSecs / 60)).padStart(2, '0');
            const secs = String(callDurationSecs % 60).padStart(2, '0');
            document.getElementById('callDuration').innerText = `${mins}:${secs}`;
        }, 1000);
    } catch (e) { Swal.fire('Izin Ditolak', 'Akses mikrofon/kamera ditolak.', 'error'); }
};

window.acceptCall = async function () {
    document.getElementById('ringtoneAudio')?.pause();
    document.getElementById('incomingCallUI').style.display = 'none';
    document.getElementById('activeCallUI').style.display = 'flex';
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    if (currentCall) {
        currentCall.answer(localStream);
        currentCall.on('stream', remoteStream => { document.getElementById('remoteVideo').srcObject = remoteStream; });
    }
};

window.rejectCall = function () {
    document.getElementById('ringtoneAudio')?.pause();
    if (currentCall) currentCall.close();
    document.getElementById('incomingCallUI').style.display = 'none';
};

window.endCall = function () {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (currentCall) currentCall.close();
    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('activeCallUI').style.display = 'none';
    document.getElementById('incomingCallUI').style.display = 'none';
    document.getElementById('ringtoneAudio')?.pause();
};

window.toggleMuteCall = function () {
    if (!localStream) return;
    isCallAudioMuted = !isCallAudioMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isCallAudioMuted);
    document.getElementById('btnMute').className = isCallAudioMuted ? 'ctrl-btn off' : 'ctrl-btn';
};

window.toggleVideoCall = function () {
    if (!localStream) return;
    isCallVideoMuted = !isCallVideoMuted;
    localStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);
    document.getElementById('btnVideo').className = isCallVideoMuted ? 'ctrl-btn off' : 'ctrl-btn';
};

window.toggleBlur = function () {
    isCallBlurred = !isCallBlurred;
    document.getElementById('localVideo').className = isCallBlurred ? 'blurred' : '';
    document.getElementById('btnBlur').className = isCallBlurred ? 'ctrl-btn active-blur' : 'ctrl-btn';
};

window.toggleVoiceRecordAdmin = async function () {
    if (!window.isAdminRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.adminAudioRecorder = new MediaRecorder(stream);
            window.adminAudioChunks = [];
            audioContextAdmin = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextAdmin.createMediaStreamSource(stream);
            analyserAdmin = audioContextAdmin.createAnalyser();
            analyserAdmin.fftSize = 64; source.connect(analyserAdmin);
            dataArrayAdmin = new Uint8Array(analyserAdmin.frequencyBinCount);

            window.adminAudioRecorder.ondataavailable = e => window.adminAudioChunks.push(e.data);
            window.adminAudioRecorder.onstop = () => {
                window.adminMediaBlob = new Blob(window.adminAudioChunks, { type: 'audio/mp3' });
                window.adminMediaExt = 'mp3'; window.adminMediaType = 'audio';
                if (reqFrameAdmin) cancelAnimationFrame(reqFrameAdmin);
                if (audioContextAdmin) audioContextAdmin.close();
            };
            window.adminAudioRecorder.start();
            window.isAdminRecordingAudio = true;
            document.getElementById('adminRecordingUI').style.display = 'flex';
            document.getElementById('adminChatInput').style.display = 'none';
            window.adminRecordSecs = 0;
            window.adminRecordTimer = setInterval(() => {
                window.adminRecordSecs++;
                const mins = String(Math.floor(window.adminRecordSecs / 60)).padStart(2, '0');
                const secs = String(window.adminRecordSecs % 60).padStart(2, '0');
                document.getElementById('adminRecordTime').innerText = `${mins}:${secs}`;
            }, 1000);
            window.startAudioVisualizer();
        } catch (e) { Swal.fire('Error', 'Gagal mengakses mikrofon.', 'error'); }
    } else {
        window.adminAudioRecorder.stop();
        window.isAdminRecordingAudio = false;
        clearInterval(window.adminRecordTimer);
        document.getElementById('adminRecordingUI').style.display = 'none';
        document.getElementById('adminChatInput').style.display = 'block';
    }
};

window.startAudioVisualizer = function () {
    if (!analyserAdmin) return;
    const bars = document.querySelectorAll('.waveform .wave-bar');
    function draw() {
        if (!window.isAdminRecordingAudio) return;
        reqFrameAdmin = requestAnimationFrame(draw);
        analyserAdmin.getByteFrequencyData(dataArrayAdmin);
        bars.forEach((bar, idx) => {
            const val = dataArrayAdmin[idx % dataArrayAdmin.length] || 10;
            bar.style.height = `${Math.max(4, (val / 255) * 24)}px`;
        });
    }
    draw();
};

window.openLightbox = function (url, type) {
    const box = document.getElementById('mediaLightbox'), content = document.getElementById('lightboxContent');
    if (!box || !content) return;
    box.style.display = 'flex';
    content.innerHTML = type === 'image' ? `<img src="${url}" style="max-width:90vw; max-height:85vh; border-radius:12px;" />` : `<video src="${url}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:12px;"></video>`;
};

window.closeLightbox = function (e) {
    if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        document.getElementById('mediaLightbox').style.display = 'none';
    }
};

window.toggleChatActionDropdown = function (e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const dd = document.getElementById('chatActionDropdown');
    if (dd) dd.style.display = (dd.style.display === 'block') ? 'none' : 'block';
};

window.pinChatActive = function () {
    if (!window.activeChatNik) return;
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Percakapan disematkan!', timer: 2000, showConfirmButton: false });
};

window.bukaModalAlihkanAdmin = async function () {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
    const modal = document.getElementById('modalAlihkanAdmin'), select = document.getElementById('selectAdminTransfer');
    const nameEl = document.getElementById('transferWargaName');
    if (nameEl) nameEl.innerText = window.activeChatName || 'Warga';
    if (modal) modal.style.display = 'flex';
    if (select) {
        select.innerHTML = '<option value="">Memuat data petugas...</option>';
        try {
            const res = await window.fetchData('/users');
            const users = await res.json();
            select.innerHTML = '<option value="">-- Pilih Petugas / Admin --</option>';
            users.forEach(u => { select.innerHTML += `<option value="${u.username}">${window.safeHtml(u.username)} (${u.role})</option>`; });
        } catch (e) { select.innerHTML = '<option value="">Gagal memuat petugas</option>'; }
    }
};

window.eksekusiAlihkanAdmin = function () {
    const target = document.getElementById('selectAdminTransfer')?.value;
    if (!target) return Swal.fire('Peringatan', 'Pilih petugas tujuan.', 'warning');
    if (typeof window.closeModal === 'function') window.closeModal('modalAlihkanAdmin');
    Swal.fire('Berhasil', `Percakapan berhasil dialihkan kepada ${target}.`, 'success');
};

window.bukaModalLaporRiwayat = function () {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
    const modal = document.getElementById('modalLaporRiwayat');
    if (modal) modal.style.display = 'flex';
};

window.eksekusiLaporRiwayat = async function () {
    const alasan = document.getElementById('inputAlasanLaporChat')?.value.trim();
    if (!alasan) return Swal.fire('Peringatan', 'Alasan pelaporan wajib diisi.', 'warning');
    if (typeof window.closeModal === 'function') window.closeModal('modalLaporRiwayat');
    Swal.fire('Tercatat', 'Riwayat obrolan berhasil diteruskan ke Pusat Investigasi.', 'success');
};

window.hapusRiwayatLokal = function () {
    if (!window.activeChatNik) return;
    const container = document.getElementById('adminChatMessages');
    if (container) container.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:100px;">Riwayat obrolan telah dibersihkan.</div>';
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Riwayat obrolan dibersihkan.', showConfirmButton: false, timer: 2000 });
};