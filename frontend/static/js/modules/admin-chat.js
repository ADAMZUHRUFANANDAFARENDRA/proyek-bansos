/* =========================================================================
   ADMIN-CHAT.JS - LIVE CHAT MEDIASI TERPADU PEMKAB SIDOARJO
   FITUR LENGKAP:
   - Menu Opsi Pesan Vertikal Modern (Reaksi, Pin, Balas, Hapus Me/All, Lapor)
   - Audio Call <-> Video Call Dinamis (Status Mic & Kamera On/Off Realtime)
   - Floating Animated Call Reaction Emojis
   - Pusat Investigasi Multi-Aduan (Sengketa Bansos, Manipulasi Data, Chat)
   - Sistem Notifikasi Terintegrasi (Urgent Prioritas Atas, Pin, Arsip, Klik Aksi)
   - Voice Note dengan Jeda (Pause) dan Lanjut (Resume)
   ========================================================================= */

window.activeChatNik = null;
window.activeChatName = null;
window.rawChatListData = [];
window.chatHandlersMap = JSON.parse(localStorage.getItem('chatHandlersMap') || '{}');

// State Interaksi Pesan
window.activeReplyMessage = null;
window.pinnedMessages = JSON.parse(localStorage.getItem('chatPinnedMap') || '{}');
window.deletedForMeIds = JSON.parse(localStorage.getItem('chatDeletedForMe') || '[]');
window.deletedForAllIds = JSON.parse(localStorage.getItem('chatDeletedForAll') || '[]');

// State Audio Recorder Berjeda (Pause / Resume)
window.mediaRecorderObj = null;
window.audioChunks = [];
window.isRecordingVoice = false;
window.isVoicePaused = false;
window.voiceDurationSecs = 0;
window.voiceTimerInterval = null;
window.mediaStreamRef = null;

// State WebRTC P2P Call
let peerInstance = null;
let activeCallObj = null;
let callLocalStream = null;
let isCallAudioMuted = false;
let isCallVideoMuted = true;
let isCallBlurred = false;
let callDurationTimer = null;
let callDurationSecs = 0;

// Database Emoji Lengkap
const EMOJI_DATABASE = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😮‍💨','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫣','🤗','🫡','🤔','🫢','🤭','🤫','🤥','😶','😐','😑','😬','🫠','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','👻','💀','☠️','👽','🤖','🎃','😺','😸','😹','😻','🤝','👍','👎','👏','🙌','👐','🫶','🙏','✊','👊','✌️','🫰','🤞','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💖','💗','💓','💞','💕','💌','💟','❣️','✨','🎉','🎊','🔥','⭐','🌟','⚡','💥','🚩','⚠️','✅','❌','💯'
];

document.addEventListener('DOMContentLoaded', () => {
    window.initAdminPeer();
    window.initGlobalNotifications();
});

// =========================================================================
// 1. KONTROL LIVE CHAT, DAFTAR KELOMPOK & SWITCH TAB
// =========================================================================
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
    } catch (e) {}
};

window.renderCategorizedInbox = function (query = '') {
    const container = document.getElementById('chatContactList');
    if (!container) return;
    let list = [...window.rawChatListData];
    if (query) {
        const q = query.toLowerCase();
        list = list.filter(c => (c.nama || '').toLowerCase().includes(q) || String(c.nik || '').includes(query));
    }

    if (!list.length) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Tidak ada obrolan ditemukan.</div>';
        return;
    }

    container.innerHTML = list.map(c => {
        const isActive = String(c.nik) === String(window.activeChatNik);
        return `
            <div class="chat-contact-item ${isActive ? 'active' : ''}" onclick="window.loadChatMessages('${c.nik}', '${window.escapeInlineJS(c.nama)}')">
                <div class="contact-avatar">${(c.nama || 'W').charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-top">
                        <span class="contact-name-txt">${window.safeHtml(c.nama)}</span>
                        <span class="contact-time-txt">${c.waktu || ''}</span>
                    </div>
                    <div class="contact-nik-chip"><i class="fas fa-id-card"></i> ${c.nik}</div>
                    <div class="contact-last-msg-txt">${window.safeHtml(c.last_msg || 'Mulai percakapan')}</div>
                </div>
            </div>`;
    }).join('');
};

window.switchChatTab = function (tab) {
    window.activeChatTab = tab;
    const inboxBtn = document.getElementById('tabInboxBtn'), kontakBtn = document.getElementById('tabKontakBtn');
    const inboxList = document.getElementById('chatContactList'), kontakList = document.getElementById('chatBukuKontakList');
    if (tab === 'inbox') {
        if (inboxBtn) inboxBtn.className = 'chat-tab-btn active';
        if (kontakBtn) kontakBtn.className = 'chat-tab-btn';
        if (inboxList) inboxList.style.display = 'block';
        if (kontakList) kontakList.style.display = 'none';
        window.renderCategorizedInbox();
    } else {
        if (kontakBtn) kontakBtn.className = 'chat-tab-btn active';
        if (inboxBtn) inboxBtn.className = 'chat-tab-btn';
        if (inboxList) inboxList.style.display = 'none';
        if (kontakList) {
            kontakList.style.display = 'block';
            window.renderBukuKontak();
        }
    }
};

window.renderBukuKontak = function (query = '') {
    const container = document.getElementById('chatBukuKontakList');
    if (!container) return;
    let list = window.globalDataWarga || [];
    if (query) {
        const q = query.toLowerCase();
        list = list.filter(w => (w.nama || '').toLowerCase().includes(q) || String(w.nik || '').includes(query));
    }
    container.innerHTML = list.map(w => `
        <div class="chat-contact-item" onclick="window.loadChatMessages('${w.nik}', '${window.escapeInlineJS(w.nama)}')">
            <div class="contact-avatar" style="background:#0284c7;">${(w.nama || 'W').charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-top">
                    <span class="contact-name-txt">${window.safeHtml(w.nama)}</span>
                    <span class="contact-time-txt" style="color:#0ea5e9; font-weight:700;">Desil ${w.desil || 5}</span>
                </div>
                <div class="contact-nik-chip"><i class="fas fa-id-card"></i> ${w.nik}</div>
                <div class="contact-last-msg-txt"><i class="fas fa-map-marker-alt text-danger"></i> ${window.safeHtml(w.alamat || 'Sidoarjo')}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center; padding:30px; color:#94a3b8;">Buku kontak kosong.</div>';
};

window.filterChatList = function () {
    const q = document.getElementById('searchChatInput')?.value.trim() || '';
    if (window.activeChatTab === 'inbox' || !window.activeChatTab) {
        window.renderCategorizedInbox(q);
    } else {
        window.renderBukuKontak(q);
    }
};

// Quick Switch Petugas Penangan
window.quickSwitchPetugas = async function () {
    if (!window.activeChatNik) {
        return Swal.fire('Peringatan', 'Pilih salah satu obrolan warga terlebih dahulu.', 'warning');
    }
    let users = [{ username: 'admin', role: 'admin' }, { username: 'petugas', role: 'operator' }];
    try {
        const res = await window.fetchData('/users');
        if (res && res.ok) users = await res.json();
    } catch (e) {}

    let inputOptions = {};
    users.forEach(u => {
        inputOptions[u.username] = `${u.username.toUpperCase()} (${u.role === 'admin' ? 'Super Admin' : 'Petugas Lapangan'})`;
    });

    const current = window.chatHandlersMap[window.activeChatNik] || 'petugas';
    const { value: selected } = await Swal.fire({
        title: 'Pilih Petugas yang Menangani',
        input: 'select',
        inputOptions: inputOptions,
        inputValue: current,
        showCancelButton: true,
        confirmButtonText: 'Terapkan',
        confirmButtonColor: '#009846'
    });

    if (selected) {
        window.chatHandlersMap[window.activeChatNik] = selected;
        localStorage.setItem('chatHandlersMap', JSON.stringify(window.chatHandlersMap));
        document.getElementById('chatActiveHandlerDisplay').innerText = selected.toUpperCase();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Ditangani oleh ${selected.toUpperCase()}`, timer: 1500, showConfirmButton: false });
    }
};

// =========================================================================
// 2. MEMUAT PESAN, CARD TINDAKAN VERTIKAL, REAKSI, PIN, BALAS & HAPUS
// =========================================================================
window.loadChatMessages = async function (nik, nama) {
    window.activeChatNik = String(nik);
    window.activeChatName = nama;

    document.getElementById('chatActiveNameDisplay').innerText = nama;
    document.getElementById('chatActiveNikDisplay').innerText = nik;
    document.getElementById('chatActiveInfoDisplay').style.display = 'flex';
    document.getElementById('chatHeaderAvatar').style.display = 'flex';
    document.getElementById('chatHeaderAvatar').innerText = (nama || 'W').charAt(0).toUpperCase();
    document.getElementById('chatHeaderActions').style.display = 'flex';

    const activeHandler = window.chatHandlersMap[nik] || localStorage.getItem('username') || 'Petugas Lapangan';
    document.getElementById('chatActiveHandlerDisplay').innerText = activeHandler.toUpperCase();

    window.refreshPinnedBanner();

    try {
        const res = await window.fetchData(`/api/chat/${nik}`);
        if (!res || !res.ok) return;
        const messages = await res.json();
        const box = document.getElementById('adminChatMessages');
        if (!box) return;

        const baseUrl = window.API_BASE_URL || 'http://127.0.0.1:5000';
        box.innerHTML = '';

        messages.forEach((m, idx) => {
            const msgIdentifier = m.id || `msg_${idx}`;
            if (window.deletedForMeIds.includes(msgIdentifier)) return;

            const isAdmin = m.sender === 'admin';
            const isDeletedAll = window.deletedForAllIds.includes(msgIdentifier) || Boolean(m.is_deleted_all);

            let contentHtml = '';
            if (isDeletedAll) {
                contentHtml = `<span style="font-style:italic; opacity:0.6;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</span>`;
            } else {
                if (m.reply_text) {
                    contentHtml += `<div style="border-left:3px solid #cbd5e1; padding:2px 8px; margin-bottom:6px; font-size:0.75rem; background:rgba(0,0,0,0.04); border-radius:4px;"><b>${window.safeHtml(m.reply_sender || 'Balasan')}</b>: ${window.safeHtml(m.reply_text)}</div>`;
                }
                if (m.pesan && m.pesan !== 'Voice Note') {
                    contentHtml += `<div>${window.safeHtml(m.pesan)}</div>`;
                }
                if (m.file_path) {
                    const url = m.file_path.startsWith('http') ? m.file_path : `${baseUrl}${m.file_path}`;
                    if (m.file_type === 'image') contentHtml += `<img src="${url}" style="max-width:240px; border-radius:10px; margin-top:6px; cursor:pointer;" onclick="window.openLightbox('${url}','image')" />`;
                    else if (m.file_type === 'video') contentHtml += `<video src="${url}" controls style="max-width:260px; border-radius:10px; margin-top:6px;"></video>`;
                    else if (m.file_type === 'audio') contentHtml += `<audio src="${url}" controls style="margin-top:6px; max-width:240px;"></audio>`;
                }
            }

            const reactionHtml = m.reaction ? `<div class="msg-reaction-display">${m.reaction}</div>` : '';

            // Card Menu Opsi Pesan Memanjang ke Bawah (Card Style)
            const bubbleHtml = `
                <div class="msg-wrapper-bubble ${isAdmin ? 'admin-side' : 'warga-side'}" id="bubble_wrap_${msgIdentifier}">
                    ${!isDeletedAll ? `
                    <button type="button" class="msg-trigger-btn" onclick="window.toggleMsgActionMenu(event, '${msgIdentifier}')" title="Pilihan Tindakan">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="msg-action-card" id="msg_popup_${msgIdentifier}" onclick="event.stopPropagation()">
                        <div class="msg-action-reactions-row">
                            <button type="button" class="reaction-btn-pop" onclick="window.addReactionToMessage('${msgIdentifier}', '❤️')">❤️</button>
                            <button type="button" class="reaction-btn-pop" onclick="window.addReactionToMessage('${msgIdentifier}', '👍')">👍</button>
                            <button type="button" class="reaction-btn-pop" onclick="window.addReactionToMessage('${msgIdentifier}', '😂')">😂</button>
                            <button type="button" class="reaction-btn-pop" onclick="window.addReactionToMessage('${msgIdentifier}', '😮')">😮</button>
                            <button type="button" class="reaction-btn-pop" onclick="window.addReactionToMessage('${msgIdentifier}', '🙏')">🙏</button>
                        </div>
                        <button type="button" class="msg-action-btn-item" onclick="window.prepareReplyMessage('${msgIdentifier}', '${isAdmin ? 'Petugas' : window.escapeInlineJS(window.activeChatName)}', '${window.escapeInlineJS(m.pesan || 'Media')}')">
                            <i class="fas fa-reply text-primary"></i> Balas Pesan
                        </button>
                        <button type="button" class="msg-action-btn-item" onclick="window.pinMessageDirect('${window.escapeInlineJS(m.pesan || 'Media')}')">
                            <i class="fas fa-thumbtack text-accent"></i> Sematkan Pesan
                        </button>
                        <button type="button" class="msg-action-btn-item" onclick="window.deleteMessageAction('${msgIdentifier}', ${isAdmin})">
                            <i class="fas fa-trash text-muted"></i> Hapus Pesan
                        </button>
                        <div style="height:1px; background:#f1f5f9; margin:2px 0;"></div>
                        <button type="button" class="msg-action-btn-item danger-item" onclick="window.reportSpecificMessage('${window.escapeInlineJS(m.pesan || '')}')">
                            <i class="fas fa-flag"></i> Laporkan Pesan
                        </button>
                    </div>
                    ` : ''}

                    <div class="${isAdmin ? 'msg-bubble-admin' : 'msg-bubble-warga'}" style="position:relative;">
                        ${contentHtml}
                        <span class="msg-time">${m.waktu || ''}</span>
                        ${reactionHtml}
                    </div>
                </div>
            `;
            box.innerHTML += bubbleHtml;
        });

        box.scrollTop = box.scrollHeight;
    } catch (e) {}
};

window.toggleMsgActionMenu = function (e, id) {
    if (e) e.stopPropagation();
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    const popup = document.getElementById(`msg_popup_${id}`);
    if (popup) popup.classList.toggle('show');
};

document.addEventListener('click', () => {
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    const ep = document.getElementById('emojiPickerAdmin');
    if (ep) ep.style.display = 'none';
});

window.addReactionToMessage = function (msgId, emojiChar) {
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    const wrap = document.getElementById(`bubble_wrap_${msgId}`);
    if (!wrap) return;
    let reactEl = wrap.querySelector('.msg-reaction-display');
    if (!reactEl) {
        reactEl = document.createElement('div');
        reactEl.className = 'msg-reaction-display';
        wrap.querySelector('.msg-bubble-admin, .msg-bubble-warga')?.appendChild(reactEl);
    }
    reactEl.innerText = emojiChar;
};

window.prepareReplyMessage = function (id, sender, text) {
    window.activeReplyMessage = { id, sender, text };
    document.getElementById('replyTargetSender').innerText = sender;
    document.getElementById('replyTargetText').innerText = text;
    document.getElementById('replyMessageBanner').style.display = 'flex';
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    document.getElementById('adminChatInput')?.focus();
};

window.cancelReplyMessage = function () {
    window.activeReplyMessage = null;
    document.getElementById('replyMessageBanner').style.display = 'none';
};

window.pinMessageDirect = function (text) {
    if (!window.activeChatNik) return;
    window.pinnedMessages[window.activeChatNik] = text;
    localStorage.setItem('chatPinnedMap', JSON.stringify(window.pinnedMessages));
    window.refreshPinnedBanner();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pesan disematkan', timer: 1500, showConfirmButton: false });
};

window.refreshPinnedBanner = function () {
    const banner = document.getElementById('pinnedMessageBanner');
    const txt = document.getElementById('pinnedMessageText');
    if (banner && txt && window.pinnedMessages[window.activeChatNik]) {
        txt.innerText = window.pinnedMessages[window.activeChatNik];
        banner.style.display = 'flex';
    } else if (banner) {
        banner.style.display = 'none';
    }
};

window.unpinCurrentMessage = function () {
    delete window.pinnedMessages[window.activeChatNik];
    localStorage.setItem('chatPinnedMap', JSON.stringify(window.pinnedMessages));
    window.refreshPinnedBanner();
};

window.deleteMessageAction = async function (msgId, isSender) {
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    
    const { value: opt } = await Swal.fire({
        title: 'Hapus Pesan?',
        text: 'Pilih cakupan penghapusan pesan ini.',
        icon: 'question',
        showDenyButton: isSender,
        showCancelButton: true,
        confirmButtonText: 'Hapus untuk Saya',
        denyButtonText: 'Hapus untuk Semua Orang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#64748b',
        denyButtonColor: '#dc2626'
    });

    if (opt === true) {
        window.deletedForMeIds.push(msgId);
        localStorage.setItem('chatDeletedForMe', JSON.stringify(window.deletedForMeIds));
        document.getElementById(`bubble_wrap_${msgId}`)?.remove();
    } else if (opt === false) {
        window.deletedForAllIds.push(msgId);
        localStorage.setItem('chatDeletedForAll', JSON.stringify(window.deletedForAllIds));
        const wrap = document.getElementById(`bubble_wrap_${msgId}`);
        if (wrap) {
            wrap.innerHTML = `<div class="msg-bubble-admin" style="opacity:0.6; font-style:italic;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</div>`;
        }
    }
};

window.reportSpecificMessage = function (pesanContent) {
    document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
    Swal.fire({
        title: 'Laporkan Pesan ke Investigasi',
        text: `Kirimkan rincian pesan "${pesanContent.slice(0, 45)}..." ke Pusat Investigasi bansos?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Kirimkan Laporan',
        confirmButtonColor: '#dc2626'
    }).then(res => {
        if (res.isConfirmed) {
            Swal.fire('Tercatat', 'Aduan pesan berhasil didaftarkan ke Pusat Investigasi.', 'success');
        }
    });
};

// =========================================================================
// 3. VOICE RECORDING DENGAN PAUSE & RESUME
// =========================================================================
window.toggleVoiceRecording = async function () {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');

    if (!window.isRecordingVoice) {
        try {
            window.mediaStreamRef = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.mediaRecorderObj = new MediaRecorder(window.mediaStreamRef);
            window.audioChunks = [];

            window.mediaRecorderObj.ondataavailable = e => {
                if (e.data.size > 0) window.audioChunks.push(e.data);
            };

            window.mediaRecorderObj.onstop = () => {
                if (window.mediaStreamRef) {
                    window.mediaStreamRef.getTracks().forEach(t => t.stop());
                }
            };

            window.mediaRecorderObj.start(250);
            window.isRecordingVoice = true;
            window.isVoicePaused = false;
            window.voiceDurationSecs = 0;

            document.getElementById('adminChatInput').style.display = 'none';
            document.getElementById('adminVoiceControlUI').style.display = 'flex';
            document.getElementById('btnPauseResumeVoice').innerHTML = '<i class="fas fa-pause"></i>';
            document.getElementById('btnPauseResumeVoice').className = 'voice-btn-ctrl';

            clearInterval(window.voiceTimerInterval);
            window.voiceTimerInterval = setInterval(() => {
                if (!window.isVoicePaused) {
                    window.voiceDurationSecs++;
                    const m = String(Math.floor(window.voiceDurationSecs / 60)).padStart(2, '0');
                    const s = String(window.voiceDurationSecs % 60).padStart(2, '0');
                    document.getElementById('adminVoiceTimer').innerText = `${m}:${s}`;
                }
            }, 1000);
        } catch (err) {
            Swal.fire('Akses Ditolak', 'Izinkan akses mikrofon peramban untuk merekam suara.', 'error');
        }
    } else {
        window.finishAndSendVoiceRecording();
    }
};

window.togglePauseResumeVoice = function () {
    if (!window.mediaRecorderObj) return;
    const btn = document.getElementById('btnPauseResumeVoice');
    if (!window.isVoicePaused) {
        window.mediaRecorderObj.pause();
        window.isVoicePaused = true;
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.classList.add('paused');
        btn.title = 'Lanjutkan Rekaman Suara';
    } else {
        window.mediaRecorderObj.resume();
        window.isVoicePaused = false;
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.classList.remove('paused');
        btn.title = 'Jeda Rekaman Suara';
    }
};

window.cancelVoiceRecording = function () {
    if (window.mediaRecorderObj) window.mediaRecorderObj.stop();
    window.isRecordingVoice = false;
    window.isVoicePaused = false;
    clearInterval(window.voiceTimerInterval);
    document.getElementById('adminVoiceControlUI').style.display = 'none';
    document.getElementById('adminChatInput').style.display = 'block';
    window.audioChunks = [];
};

window.finishAndSendVoiceRecording = function () {
    if (!window.mediaRecorderObj) return;
    window.mediaRecorderObj.stop();
    clearInterval(window.voiceTimerInterval);

    setTimeout(async () => {
        const audioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();

        formData.append('sender', 'admin');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', 'Voice Note');
        formData.append('file', audioBlob, `voice_${Date.now()}.webm`);

        window.cancelVoiceRecording();

        try {
            await window.fetchData(`/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
            window.loadChatMessages(window.activeChatNik, window.activeChatName);
        } catch (e) {
            Swal.fire('Gagal', 'Gagal mengirim rekaman suara.', 'error');
        }
    }, 300);
};

// =========================================================================
// 4. WEBRTC P2P CALL: SWITCH AUDIO <-> VIDEO REALTIME & FLOATING EMOJI
// =========================================================================
window.initAdminPeer = function () {
    try {
        if (typeof Peer !== 'undefined' && !peerInstance) {
            peerInstance = new Peer('dinsos_admin_sidoarjo');
            peerInstance.on('call', call => {
                activeCallObj = call;
                document.getElementById('incomingCallUI').style.display = 'flex';
                document.getElementById('callerNameText').innerText = call.peer.replace('warga_', 'Warga NIK: ');
                document.getElementById('ringtoneAudio')?.play().catch(() => {});
            });
        }
    } catch (e) {}
};

window.startCallWarga = async function (initialType = 'audio') {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
    try {
        isCallVideoMuted = (initialType === 'audio');
        callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        callLocalStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);

        document.getElementById('activeCallUI').style.display = 'flex';
        document.getElementById('activeCallName').innerText = `${window.activeChatName} (${window.activeChatNik})`;
        
        window.updateCallInterfaceView();

        if (peerInstance) {
            activeCallObj = peerInstance.call(`warga_${window.activeChatNik}`, callLocalStream);
            activeCallObj.on('stream', remoteStream => {
                const rVid = document.getElementById('remoteVideo');
                if (rVid) rVid.srcObject = remoteStream;
            });
        }

        callDurationSecs = 0;
        clearInterval(callDurationTimer);
        callDurationTimer = setInterval(() => {
            callDurationSecs++;
            const mins = String(Math.floor(callDurationSecs / 60)).padStart(2, '0');
            const secs = String(callDurationSecs % 60).padStart(2, '0');
            document.getElementById('callDuration').innerText = `${mins}:${secs}`;
        }, 1000);
    } catch (e) {
        Swal.fire('Izin Ditolak', 'Akses mikrofon atau kamera ditolak oleh peramban.', 'error');
    }
};

window.updateCallInterfaceView = function () {
    const vArea = document.getElementById('videoCallArea');
    const aArea = document.getElementById('audioCallArea');
    const localVid = document.getElementById('localVideo');
    const btnVideo = document.getElementById('btnVideo');
    const badgeCam = document.getElementById('callCamStatus');

    if (!isCallVideoMuted) {
        if (vArea) vArea.style.display = 'block';
        if (aArea) aArea.style.display = 'none';
        if (localVid) localVid.srcObject = callLocalStream;
        if (btnVideo) btnVideo.className = 'ctrl-btn';
        if (badgeCam) {
            badgeCam.className = 'call-live-badge badge-cam-on';
            badgeCam.innerHTML = '<i class="fas fa-video"></i> Kamera Aktif';
        }
    } else {
        if (vArea) vArea.style.display = 'none';
        if (aArea) aArea.style.display = 'flex';
        if (btnVideo) btnVideo.className = 'ctrl-btn off';
        if (badgeCam) {
            badgeCam.className = 'call-live-badge badge-cam-off';
            badgeCam.innerHTML = '<i class="fas fa-video-slash"></i> Kamera Mati';
        }
    }
};

window.toggleVideoCall = function () {
    if (!callLocalStream) return;
    isCallVideoMuted = !isCallVideoMuted;
    callLocalStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);
    window.updateCallInterfaceView();
};

window.toggleMuteCall = function () {
    if (!callLocalStream) return;
    isCallAudioMuted = !isCallAudioMuted;
    callLocalStream.getAudioTracks().forEach(t => t.enabled = !isCallAudioMuted);
    
    const btnMute = document.getElementById('btnMute');
    const badgeMic = document.getElementById('callMicStatus');
    if (btnMute) btnMute.className = isCallAudioMuted ? 'ctrl-btn off' : 'ctrl-btn';
    if (badgeMic) {
        if (!isCallAudioMuted) {
            badgeMic.className = 'call-live-badge badge-mic-on';
            badgeMic.innerHTML = '<i class="fas fa-microphone"></i> Mikrofon Aktif';
        } else {
            badgeMic.className = 'call-live-badge badge-mic-off';
            badgeMic.innerHTML = '<i class="fas fa-microphone-slash"></i> Mikrofon Mati';
        }
    }
};

window.toggleBlur = function () {
    isCallBlurred = !isCallBlurred;
    document.getElementById('localVideo')?.classList.toggle('blurred', isCallBlurred);
    document.getElementById('btnBlur')?.classList.toggle('active-blur', isCallBlurred);
};

window.sendCallReaction = function (emoji) {
    const animArea = document.getElementById('callReactionAnimationArea');
    if (!animArea) return;
    const reactEl = document.createElement('div');
    reactEl.className = 'call-animated-reaction';
    reactEl.innerText = emoji;
    animArea.appendChild(reactEl);
    setTimeout(() => reactEl.remove(), 1900);
};

window.endCall = function () {
    if (callLocalStream) callLocalStream.getTracks().forEach(t => t.stop());
    if (activeCallObj) activeCallObj.close();
    clearInterval(callDurationTimer);
    document.getElementById('activeCallUI').style.display = 'none';
    document.getElementById('incomingCallUI').style.display = 'none';
    document.getElementById('ringtoneAudio')?.pause();
};

// =========================================================================
// 5. PUSAT INVESTIGASI TERPADU (SEMUA KASUS ADUAN)
// =========================================================================
window.investigasiReportsData = [
    {
        id: 'ADU-001',
        tipe: 'sengketa',
        urgensi: 'urgent',
        nama: 'fufufafa',
        nik: '6475839372837483',
        kategori: 'Penyaluran Fisik Tidak Diterima',
        uraian: 'Warga terdaftar status telah salur Tahap II, namun menyatakan belum menerima paket beras dan BLT fisik di balai desa.',
        waktu: '10 menit lalu',
        status: 'investigasi'
    },
    {
        id: 'ADU-002',
        tipe: 'data',
        urgensi: 'urgent',
        nama: 'Farendra Astuti',
        nik: '3515797650336843',
        kategori: 'Dugaan Manipulasi Desil Kriteria',
        uraian: 'Pelaporan ketidaksesuaian nilai kepemilikan aset C2 dengan fakta survei lapangan terduga pemalsuan slip gaji.',
        waktu: '1 jam lalu',
        status: 'verifikasi'
    },
    {
        id: 'ADU-003',
        tipe: 'chat',
        urgensi: 'normal',
        nama: 'Ananda Arifin',
        nik: '3515689516449916',
        kategori: 'Aduan Pelanggaran Kata Obrolan',
        uraian: 'Pesan chat terdeteksi melanggar etika koordinasi lapangan dan memerlukan mediasi oleh admin pengawas.',
        waktu: '2 jam lalu',
        status: 'selesai'
    }
];

window.filterInvestigasi = function (filterType, btnEl) {
    if (btnEl) {
        btnEl.parentElement.querySelectorAll('button').forEach(b => {
            b.className = 'btn btn-secondary btn-sm';
            b.style.color = '';
            b.style.borderColor = '';
        });
        btnEl.className = 'btn btn-primary btn-sm';
    }

    const container = document.getElementById('laporanChatList');
    if (!container) return;

    let list = [...window.investigasiReportsData];
    if (filterType !== 'all') {
        if (filterType === 'urgent') list = list.filter(r => r.urgensi === 'urgent');
        else list = list.filter(r => r.tipe === filterType);
    }

    if (!list.length) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#94a3b8;">Tidak ada aduan dalam kategori ini.</div>';
        return;
    }

    container.innerHTML = list.map(r => {
        const isUrgent = r.urgensi === 'urgent';
        return `
            <div class="investigasi-card-modern ${isUrgent ? 'urgent-level' : 'normal-level'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-size:0.75rem; font-weight:800; color:${isUrgent ? '#dc2626' : '#0284c7'}; text-transform:uppercase;">
                            ${isUrgent ? '🚨 PRIORITAS TINGGI' : '📋 ADUAN REGULER'}
                        </span>
                        <h4 style="margin:4px 0 2px 0; font-size:1.05rem; color:#0f172a; font-weight:800;">${window.safeHtml(r.kategori)}</h4>
                        <div style="font-size:0.82rem; color:#64748b;">
                            Pemohon: <b>${window.safeHtml(r.nama)}</b> • NIK: <span style="font-family:monospace; color:#009846; font-weight:700;">${r.nik}</span>
                        </div>
                    </div>
                    <span class="badge" style="background:#f1f5f9; font-size:0.75rem; color:#475569;"><i class="fas fa-clock"></i> ${r.waktu}</span>
                </div>
                <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:10px 14px; border-radius:10px; margin:12px 0; font-size:0.86rem; color:#334155; line-height:1.45;">
                    ${window.safeHtml(r.uraian)}
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button onclick="window.closeModal('modalLaporanChat'); window.openAdminChat(); window.loadChatMessages('${r.nik}', '${window.escapeInlineJS(r.nama)}');" class="btn btn-primary btn-sm">
                        <i class="fas fa-comments"></i> Buka Chat Mediasi Warga
                    </button>
                    <button onclick="Swal.fire('Verifikasi Data', 'Membuka lembar kriteria NIK ${r.nik}', 'info')" class="btn btn-secondary btn-sm">
                        <i class="fas fa-search"></i> Tinjau SPK
                    </button>
                    <button onclick="Swal.fire('Selesai', 'Status aduan diperbarui menjadi selesai', 'success')" class="btn btn-sm" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-weight:700;">
                        <i class="fas fa-check"></i> Selesaikan
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

// =========================================================================
// 6. SISTEM NOTIFIKASI TERPADU (URGENT MERAH ATAS, PIN, ARSIP, KLIK AKSI)
// =========================================================================
window.activeNotifTab = 'all';
window.globalNotificationsData = JSON.parse(localStorage.getItem('adminNotificationsData') || '[]');

window.initGlobalNotifications = function () {
    if (!window.globalNotificationsData.length) {
        window.globalNotificationsData = [
            { id: 1, type: 'urgent', text: 'Sengketa Mendesak: Warga fufufafa melaporkan belum menerima BLT fisik!', time: '5m lalu', action: 'chat', nik: '6475839372837483', nama: 'fufufafa', pinned: true, archived: false },
            { id: 2, type: 'urgent', text: 'Manipulasi Berkas: Anomali nilai aset C2 NIK 3515797650336843 melebihi ambang desil', time: '20m lalu', action: 'spk', pinned: false, archived: false },
            { id: 3, type: 'info', text: 'Pesan Masuk: Pertanyaan jadwal penyaluran bansos dari warga Tini', time: '1j lalu', action: 'chat', nik: '3578101008030005', nama: 'tini', pinned: false, archived: false },
            { id: 4, type: 'success', text: 'Perhitungan SPK Selesai: Matriks SAW & BWM siap dicetak ke SK Bupati', time: '2j lalu', action: 'spk', pinned: false, archived: false }
        ];
        localStorage.setItem('adminNotificationsData', JSON.stringify(window.globalNotificationsData));
    }
    window.updateNotificationBadgeCount();
};

window.toggleNotifPanel = function (e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const isShow = panel.style.display === 'flex';
    panel.style.display = isShow ? 'none' : 'flex';
    if (!isShow) window.renderNotificationList();
};

window.switchNotifTab = function (tab) {
    window.activeNotifTab = tab;
    document.querySelectorAll('.ntf-tab-btn').forEach(b => b.classList.remove('active'));
    if (tab === 'all') document.getElementById('tabNotifAll')?.classList.add('active');
    else if (tab === 'urgent') document.getElementById('tabNotifUrgent')?.classList.add('active');
    else if (tab === 'arsip') document.getElementById('tabNotifArsip')?.classList.add('active');
    window.renderNotificationList();
};

window.renderNotificationList = function () {
    const listContainer = document.getElementById('notifList');
    if (!listContainer) return;

    let items = [...window.globalNotificationsData];
    
    if (window.activeNotifTab === 'urgent') items = items.filter(n => n.type === 'urgent' && !n.archived);
    else if (window.activeNotifTab === 'arsip') items = items.filter(n => n.archived);
    else items = items.filter(n => !n.archived);

    items.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        if (a.type === 'urgent' && b.type !== 'urgent') return -1;
        if (b.type === 'urgent' && a.type !== 'urgent') return 1;
        return b.id - a.id;
    });

    if (!items.length) {
        listContainer.innerHTML = '<div style="text-align:center; padding:35px 20px; color:#94a3b8;"><i class="fas fa-bell-slash fa-2x"></i><p style="margin-top:8px;">Tidak ada notifikasi.</p></div>';
        return;
    }

    listContainer.innerHTML = items.map(n => {
        const isUrgent = n.type === 'urgent';
        return `
            <div class="ntf-item ${isUrgent ? 'urgent-notification' : ''} ${n.pinned ? 'pinned-notification' : ''}" onclick="window.handleNotificationClick(${n.id})">
                <div class="ntf-icon ${isUrgent ? 'urgent' : (n.type === 'success' ? 'success' : 'info')}">
                    <i class="fas ${isUrgent ? 'fa-exclamation-triangle' : (n.type === 'success' ? 'fa-check-circle' : 'fa-info-circle')}"></i>
                </div>
                <div class="ntf-content">
                    ${isUrgent ? '<span class="ntf-n-mini">URGENT</span>' : ''}
                    <div class="ntf-msg">${window.safeHtml(n.text)}</div>
                    <div class="ntf-time"><i class="fas fa-clock"></i> ${n.time}</div>
                </div>
                <div class="ntf-actions" onclick="event.stopPropagation()">
                    <button type="button" class="ntf-action-btn" onclick="window.togglePinNotification(${n.id})" title="${n.pinned ? 'Lepas Pin' : 'Sematkan'}">
                        <i class="fas fa-thumbtack ${n.pinned ? 'text-accent' : ''}"></i>
                    </button>
                    <button type="button" class="ntf-action-btn" onclick="window.toggleArchiveNotification(${n.id})" title="${n.archived ? 'Kembalikan' : 'Arsipkan'}">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.handleNotificationClick = function (id) {
    const item = window.globalNotificationsData.find(n => n.id === id);
    if (!item) return;
    document.getElementById('notifPanel').style.display = 'none';

    if (item.action === 'chat' && item.nik) {
        window.openAdminChat();
        window.loadChatMessages(item.nik, item.nama || 'Warga');
    } else if (item.action === 'spk') {
        if (typeof window.hitungSPK === 'function') window.hitungSPK();
    }
};

window.togglePinNotification = function (id) {
    const item = window.globalNotificationsData.find(n => n.id === id);
    if (item) {
        item.pinned = !item.pinned;
        localStorage.setItem('adminNotificationsData', JSON.stringify(window.globalNotificationsData));
        window.renderNotificationList();
    }
};

window.toggleArchiveNotification = function (id) {
    const item = window.globalNotificationsData.find(n => n.id === id);
    if (item) {
        item.archived = !item.archived;
        localStorage.setItem('adminNotificationsData', JSON.stringify(window.globalNotificationsData));
        window.renderNotificationList();
        window.updateNotificationBadgeCount();
    }
};

window.tandaiSemuaNotifDibaca = function () {
    window.globalNotificationsData.forEach(n => n.archived = true);
    localStorage.setItem('adminNotificationsData', JSON.stringify(window.globalNotificationsData));
    window.renderNotificationList();
    window.updateNotificationBadgeCount();
};

window.updateNotificationBadgeCount = function () {
    const count = window.globalNotificationsData.filter(n => !n.archived).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
};

// =========================================================================
// 7. INPUT MEDIA, PENGIRIMAN & PENUTUP OBROLAN
// =========================================================================
window.handleAdminMediaUpload = async function (input) {
    if (!input.files || !input.files[0] || !window.activeChatNik) return;
    const file = input.files[0];
    const formData = new FormData();
    const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();

    formData.append('sender', 'admin');
    formData.append('nama', `Dinsos Sidoarjo (${handler})`);
    formData.append('pesan', file.type.startsWith('image') ? 'Foto Terlampir' : 'Video Terlampir');
    formData.append('file', file);

    Swal.fire({ title: 'Mengunggah Berkas...', didOpen: () => Swal.showLoading() });
    try {
        await window.fetchData(`/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
        Swal.close();
        input.value = '';
        window.loadChatMessages(window.activeChatNik, window.activeChatName);
    } catch (e) {
        Swal.fire('Gagal', 'Berkas gagal dikirim.', 'error');
    }
};

window.sendAdminChat = async function () {
    if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
    const inp = document.getElementById('adminChatInput');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;

    const formData = new FormData();
    const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();

    formData.append('sender', 'admin');
    formData.append('nama', `Dinsos Sidoarjo (${handler})`);
    formData.append('pesan', text);

    if (window.activeReplyMessage) {
        formData.append('reply_sender', window.activeReplyMessage.sender);
        formData.append('reply_text', window.activeReplyMessage.text);
        window.cancelReplyMessage();
    }

    inp.value = '';
    try {
        await window.fetchData(`/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
        window.loadChatMessages(window.activeChatNik, window.activeChatName);
        window.loadChatList();
    } catch (e) {}
};

window.tutupObrolanAktif = function () {
    window.activeChatNik = null;
    window.activeChatName = null;
    document.getElementById('chatActiveNameDisplay').innerText = 'Pilih Warga di Kotak Masuk atau Buku Kontak';
    document.getElementById('chatActiveInfoDisplay').style.display = 'none';
    document.getElementById('chatHeaderAvatar').style.display = 'none';
    document.getElementById('chatHeaderActions').style.display = 'none';
    document.getElementById('adminChatMessages').innerHTML = '<div style="text-align:center; color:#94a3b8; margin:auto;"><i class="fas fa-comments fa-3x" style="opacity:0.25; margin-bottom:15px;"></i><p style="font-weight:600; font-size:0.95rem;">Pilih salah satu warga di sebelah kiri untuk membuka ruang percakapan.</p></div>';
};

window.toggleChatActionDropdown = function (event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const dropdown = document.getElementById('chatActionDropdown');
    if (dropdown) dropdown.classList.toggle('show');
};

document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('chatActionDropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!e.target.closest('.chat-action-menu')) dropdown.classList.remove('show');
    }
});

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
    document.getElementById('adminChatMessages').innerHTML = '<div style="text-align:center; color:#94a3b8; margin:auto;">Riwayat percakapan telah dibersihkan secara lokal.</div>';
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Obrolan dibersihkan', timer: 1500, showConfirmButton: false });
};

window.openLightbox = function (url, type) {
    const box = document.getElementById('mediaLightbox'), content = document.getElementById('lightboxContent');
    if (!box || !content) return;
    box.style.display = 'flex';
    content.innerHTML = type === 'image' 
        ? `<img src="${url}" style="max-width:90vw; max-height:85vh; border-radius:12px;" />` 
        : `<video src="${url}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:12px;"></video>`;
};

window.closeLightbox = function (e) {
    if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        document.getElementById('mediaLightbox').style.display = 'none';
    }
};