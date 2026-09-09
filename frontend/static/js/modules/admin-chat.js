/* =========================================================================
   ADMIN-CHAT.JS - PUSAT MEDIASI OBROLAN, STUDIO MEDIA, AUDIO & WEBRTC
   LOKASI: frontend/static/js/modules/admin-chat.js
   DINAS SOSIAL - PEMERINTAH KABUPATEN SIDOARJO
   ========================================================================= */

(function (window) {
    'use strict';

    // =========================================================================
    // 1. STATE GLOBAL & STRUKTUR PENYIMPANAN SESI
    // =========================================================================
    window.activeChatNik = null;
    window.activeChatName = null;
    window.rawChatListData = [];
    window.activeChatTab = 'inbox';
    window.chatHandlersMap = JSON.parse(localStorage.getItem('chatHandlersMap') || '{}');
    window.cachedWargaNamesMap = JSON.parse(localStorage.getItem('cachedWargaNamesMap') || '{}');
    let chatInterval = null;

    // State Aksi Pesan Interaktif (Balasan, Sematan & Penarikan)
    window.activeReplyMessage = null;
    window.pinnedMessages = JSON.parse(localStorage.getItem('chatPinnedMap') || '{}');
    window.deletedForMeIds = JSON.parse(localStorage.getItem('chatDeletedForMe') || '[]');
    window.deletedForAllIds = JSON.parse(localStorage.getItem('chatDeletedForAll') || '[]');

    // State Perekaman Suara Berjeda (Pause/Resume) & Web Audio Visualizer
    window.mediaRecorderObj = null;
    window.audioChunks = [];
    window.isRecordingVoice = false;
    window.isVoicePaused = false;
    window.voiceDurationSecs = 0;
    window.voiceTimerInterval = null;
    let micStreamRef = null;
    let audioCtx = null;
    let analyserNode = null;
    let visualizerAnimId = null;

    // State Studio Editor Media (Gambar, Video & Dokumen)
    let currentEditingFile = null;
    let currentEditingVideoFile = null;
    let vRotationAngle = 0;

    // State Panggilan Audio & Video WebRTC P2P
    let peerInstance = null;
    let activeCallObj = null;
    let callLocalStream = null;
    let isCallAudioMuted = false;
    let isCallVideoMuted = true;
    let isCallPortraitFx = false;
    let callDurationTimer = null;
    let callDurationSecs = 0;

    // State Pusat Investigasi Aduan & Notifikasi Terpadu
    window.activeNotifTab = 'all';
    window.globalNotificationsData = JSON.parse(localStorage.getItem('adminNotificationsData') || '[]');

    const BASE_URL = (typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
        ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
        : 'http://127.0.0.1:5000';

    const EMOJI_DATABASE = [
        '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','🙃','😉','😌',
        '😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸',
        '🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢',
        '😭','😮‍💨','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫣',
        '🤗','🫡','🤔','🫢','🤭','🤫','🤥','😶','😐','😑','😬','🫠','🙄','😯','😦','😧',
        '😮','😲','🥱','😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕',
        '🤑','🤠','😈','👿','👹','👺','👻','💀','☠️','👽','🤖','🎃','😺','😸','😹','😻',
        '🤝','👍','👎','👏','🙌','👐','🫶','🙏','✊','👊','✌️','🫰','🤞','🤟','🤘','👌',
        '🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','❤️','🧡',
        '💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💖','💗','💓','💞','💕','💌',
        '💟','❣️','✨','🎉','🎊','🔥','⭐','🌟','⚡','💥','🚩','⚠️','✅','❌','💯'
    ];

    document.addEventListener('DOMContentLoaded', () => {
        window.initAdminPeer();
        window.initGlobalNotifications();
        window.renderEmojiPickerGrid();
    });

    // =========================================================================
    // 2. INBOX OBROLAN, PENGUNCIAN IDENTITAS WARGA & PENCARIAN SUARA
    // =========================================================================
    window.openAdminChat = function (nik = null, nama = null) {
        const modal = document.getElementById('modalAdminChat');
        if (modal) modal.style.display = 'flex';
        window.loadChatList();
        window.initAdminPeer();

        if (nik) {
            window.loadChatMessages(nik, nama || window.getWargaNameByNik(nik));
        } else {
            window.tutupObrolanAktif();
        }
    };

    window.closeModal = window.closeModal || function (id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    };

    // Fungsi Penguncian Nama Warga Konsisten
    window.getWargaNameByNik = function (nik, fallbackName = '') {
        if (fallbackName && fallbackName !== 'Warga' && !fallbackName.startsWith('Warga (')) {
            window.cachedWargaNamesMap[nik] = fallbackName;
            localStorage.setItem('cachedWargaNamesMap', JSON.stringify(window.cachedWargaNamesMap));
            return fallbackName;
        }
        if (window.cachedWargaNamesMap && window.cachedWargaNamesMap[nik]) {
            return window.cachedWargaNamesMap[nik];
        }
        const match = (window.globalDataWarga || []).find(w => String(w.nik) === String(nik));
        if (match && match.nama) {
            window.cachedWargaNamesMap[nik] = match.nama;
            localStorage.setItem('cachedWargaNamesMap', JSON.stringify(window.cachedWargaNamesMap));
            return match.nama;
        }
        return fallbackName || window.activeChatName || `Warga (${String(nik).slice(-4)})`;
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
            list = list.filter(c => {
                const checkedName = (window.getWargaNameByNik(c.nik, c.nama) || '').toLowerCase();
                return checkedName.includes(q) || String(c.nik || '').includes(query);
            });
        }

        if (!list.length) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:0.85rem;">Tidak ada pesan masuk.</div>';
            return;
        }

        container.innerHTML = list.map(c => {
            const realName = window.getWargaNameByNik(c.nik, c.nama);
            const isActive = String(c.nik) === String(window.activeChatNik);
            return `
                <div class="chat-contact-item ${isActive ? 'active' : ''}" onclick="window.loadChatMessages('${c.nik}', '${window.escapeInlineJS(realName)}')">
                    <div class="contact-avatar" style="background:${isActive ? '#009846' : '#64748b'};">${(realName || 'W').charAt(0).toUpperCase()}</div>
                    <div class="contact-info">
                        <div class="contact-top">
                            <span class="contact-name-txt">${window.safeHtml(realName)}</span>
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

    window.startVoiceSearchChat = function () {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return Swal.fire('Peringatan', 'Peramban tidak mendukung pengenalan suara otomatis.', 'warning');

        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        const btn = document.getElementById('btnVoiceSearchChat');
        if (btn) btn.style.color = '#ef4444';

        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            const input = document.getElementById('searchChatInput');
            if (input) {
                input.value = text;
                window.filterChatList();
            }
            if (btn) btn.style.color = '';
        };

        recognition.onerror = () => {
            if (btn) btn.style.color = '';
        };

        recognition.start();
    };

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
            title: 'Pilih Petugas Penangan',
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
    // 3. RENDER PESAN BERSIH, KARTU MEDIA & MENU TINDAKAN VERTIKAL
    // =========================================================================
    window.loadChatMessages = async function (nik, nama) {
        window.activeChatNik = String(nik);
        window.activeChatName = window.getWargaNameByNik(nik, nama);

        document.getElementById('chatActiveNameDisplay').innerText = window.activeChatName;
        document.getElementById('chatActiveNikDisplay').innerText = nik;
        document.getElementById('chatActiveInfoDisplay').style.display = 'flex';
        document.getElementById('chatHeaderAvatar').style.display = 'flex';
        document.getElementById('chatHeaderAvatar').innerText = (window.activeChatName || 'W').charAt(0).toUpperCase();
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

            box.innerHTML = '';

            messages.forEach((m, idx) => {
                const msgIdentifier = m.id || `msg_${idx}`;
                if (window.deletedForMeIds.includes(msgIdentifier)) return;

                const isAdmin = m.sender !== 'warga';
                const isDeletedAll = window.deletedForAllIds.includes(msgIdentifier) || Boolean(m.is_deleted_all);

                let contentHtml = '';
                if (isDeletedAll) {
                    contentHtml = `<span style="font-style:italic; opacity:0.6;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</span>`;
                } else {
                    if (m.reply_text) {
                        contentHtml += `<div style="border-left:3px solid #009846; padding:3px 8px; margin-bottom:6px; font-size:0.75rem; background:rgba(0,0,0,0.04); border-radius:4px;"><b>${window.safeHtml(m.reply_sender || 'Balasan')}</b>: ${window.safeHtml(m.reply_text)}</div>`;
                    }

                    if (m.file_path) {
                        const url = m.file_path.startsWith('http') ? m.file_path : `${BASE_URL}${m.file_path}`;

                        if (m.file_type === 'image') {
                            contentHtml += `
                                <div style="max-width:280px; border-radius:12px; overflow:hidden; margin-bottom:4px; box-shadow:0 2px 6px rgba(0,0,0,0.1); cursor:pointer;" onclick="window.openLightbox('${url}','image')">
                                    <img src="${url}" style="width:100%; max-height:220px; object-fit:cover; display:block;" />
                                </div>
                            `;
                        } else if (m.file_type === 'video') {
                            contentHtml += `
                                <div style="max-width:320px; border-radius:12px; overflow:hidden; margin-bottom:4px; background:#000; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                                    <video src="${url}" controls playsinline preload="metadata" style="width:100%; max-height:240px; display:block;"></video>
                                </div>
                            `;
                        } else if (m.file_type === 'audio') {
                            contentHtml += `
                                <div style="min-width:230px; padding:6px 4px; display:flex; align-items:center; gap:8px;">
                                    <i class="fas fa-microphone" style="color:#009846; font-size:1.15rem;"></i>
                                    <audio src="${url}" controls style="flex:1; height:32px; outline:none;"></audio>
                                </div>
                            `;
                        } else if (m.file_type === 'document') {
                            const fileName = m.file_path.split('/').pop();
                            const isPdf = fileName.toLowerCase().endsWith('.pdf');
                            contentHtml += `
                                <div onclick="window.open('${url}', '_blank')" 
                                     style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:${isAdmin ? '#ffffff' : '#f8fafc'}; border:1px solid #cbd5e1; border-radius:10px; margin-bottom:4px; cursor:pointer; min-width:220px;">
                                    <i class="fas ${isPdf ? 'fa-file-pdf text-danger' : 'fa-file-alt text-primary'}" style="font-size:1.8rem;"></i>
                                    <div style="flex:1; overflow:hidden;">
                                        <div style="font-weight:700; font-size:0.83rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${fileName}</div>
                                        <small style="color:#64748b; font-size:0.7rem;">Unduh Dokumen</small>
                                    </div>
                                    <i class="fas fa-arrow-down" style="color:#009846;"></i>
                                </div>
                            `;
                        }
                    }

                    // Pembersihan teks default agar tidak redundan
                    let cleanText = (m.pesan || '')
                        .replace(/foto\s*terlampir/gi, '')
                        .replace(/video\s*terlampir/gi, '')
                        .replace(/^voice\s*note$/gi, '')
                        .trim();

                    if (cleanText) {
                        contentHtml += `<div style="font-size:0.9rem; line-height:1.45; word-break:break-word;">${window.safeHtml(cleanText)}</div>`;
                    }
                }

                const reactionHtml = m.reaction ? `<div class="msg-reaction-display">${m.reaction}</div>` : '';

                const bubbleHtml = `
                    <div class="msg-wrapper-bubble ${isAdmin ? 'admin-side' : 'warga-side'}" id="bubble_wrap_${msgIdentifier}">
                        ${!isDeletedAll ? `
                        <button type="button" class="msg-trigger-btn" onclick="window.toggleMsgActionMenu(event, '${msgIdentifier}')" title="Tindakan">
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
                            <button type="button" class="msg-action-btn-item" onclick="window.salinTeksPesan('${window.escapeInlineJS(m.pesan || '')}')">
                                <i class="fas fa-copy text-info"></i> Salin Teks
                            </button>
                            <button type="button" class="msg-action-btn-item" onclick="window.deleteMessageAction('${msgIdentifier}', ${isAdmin})">
                                <i class="fas fa-trash text-muted"></i> Hapus Pesan
                            </button>
                            <div style="height:1px; background:#f1f5f9; margin:2px 0;"></div>
                            <button type="button" class="msg-action-btn-item danger-item" onclick="window.reportSpecificMessage('${window.escapeInlineJS(m.pesan || '')}')">
                                <i class="fas fa-flag"></i> Laporkan ke Investigasi
                            </button>
                        </div>
                        ` : ''}

                        <div class="${isAdmin ? 'msg-bubble-admin' : 'msg-bubble-warga'}">
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

        if (chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(() => {
            if (window.activeChatNik) window.silentRefreshMessages(window.activeChatNik);
        }, 4000);
    };

    window.silentRefreshMessages = async function (nik) {
        if (!nik || nik !== window.activeChatNik) return;
        try {
            const res = await window.fetchData(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            if (messages.length !== box.querySelectorAll('.msg-wrapper-bubble').length) {
                window.loadChatMessages(nik, window.activeChatName);
            }
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

    window.salinTeksPesan = function (text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Teks disalin ke papan klip', timer: 1500, showConfirmButton: false });
        });
    };

    window.deleteMessageAction = async function (msgId, isSender) {
        document.querySelectorAll('.msg-action-card').forEach(el => el.classList.remove('show'));
        const { value: opt } = await Swal.fire({
            title: 'Hapus Pesan?',
            text: 'Tentukan cakupan penghapusan pesan ini.',
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
            text: `Kirimkan rincian pesan "${pesanContent.slice(0, 45)}..." ke Pusat Investigasi Bansos?`,
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
    // 4. PEREKAM SUARA TERISOLASI DENGAN JEDA, RESUME & GELOMBANG NYATA
    // =========================================================================
    window.startVoiceRecording = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');

        try {
            micStreamRef = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        } catch (err) {
            return Swal.fire({
                icon: 'warning',
                title: 'Akses Mikrofon Diperlukan',
                text: 'Silakan klik ikon gembok pada bilah peramban Anda dan pastikan Mikrofon disetel ke "Izinkan".'
            });
        }

        try {
            window.audioChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            window.mediaRecorderObj = mimeType ? new MediaRecorder(micStreamRef, { mimeType }) : new MediaRecorder(micStreamRef);

            window.mediaRecorderObj.ondataavailable = e => {
                if (e.data && e.data.size > 0) window.audioChunks.push(e.data);
            };

            window.mediaRecorderObj.onstop = () => {
                if (micStreamRef) {
                    micStreamRef.getTracks().forEach(t => t.stop());
                }
            };

            window.mediaRecorderObj.start(250);
            window.isRecordingVoice = true;
            window.isVoicePaused = false;
            window.voiceDurationSecs = 0;

            window.startWaveformVisualizer(micStreamRef);

            document.getElementById('adminChatInput').style.display = 'none';
            document.getElementById('btnMicAdmin').style.display = 'none';
            document.getElementById('adminVoiceControlUI').style.display = 'flex';
            document.getElementById('btnPauseResumeVoice').innerHTML = '<i class="fas fa-pause"></i>';

            clearInterval(window.voiceTimerInterval);
            window.voiceTimerInterval = setInterval(() => {
                if (!window.isVoicePaused) {
                    window.voiceDurationSecs++;
                    const m = String(Math.floor(window.voiceDurationSecs / 60)).padStart(2, '0');
                    const s = String(window.voiceDurationSecs % 60).padStart(2, '0');
                    const timerEl = document.getElementById('adminVoiceTimer');
                    if (timerEl) timerEl.innerText = `${m}:${s}`;
                }
            }, 1000);
        } catch (err) {
            console.error('[Voice Error]', err);
            window.cleanupVoiceRecordingState();
            Swal.fire('Kendala Audio', 'Gagal memproses inisialisasi perekaman suara perangkat.', 'error');
        }
    };

    window.startWaveformVisualizer = function (stream) {
        const canvas = document.getElementById('voiceWaveCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 64;
            source.connect(analyserNode);

            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function drawWave() {
                visualizerAnimId = requestAnimationFrame(drawWave);
                if (window.isVoicePaused) return;

                analyserNode.getByteFrequencyData(dataArray);
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const barWidth = (canvas.width / bufferLength) * 1.8;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = Math.max(3, (dataArray[i] / 255) * canvas.height);
                    ctx.fillStyle = '#e11d48';
                    ctx.beginPath();
                    if (typeof ctx.roundRect === 'function') {
                        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 1, barHeight, 2);
                    } else {
                        ctx.rect(x, (canvas.height - barHeight) / 2, barWidth - 1, barHeight);
                    }
                    ctx.fill();
                    x += barWidth;
                }
            }
            drawWave();
        } catch (e) {}
    };

    window.togglePauseResumeVoice = function () {
        if (!window.mediaRecorderObj) return;
        const btn = document.getElementById('btnPauseResumeVoice');
        if (!window.isVoicePaused) {
            window.mediaRecorderObj.pause();
            window.isVoicePaused = true;
            btn.innerHTML = '<i class="fas fa-play"></i>';
            btn.title = 'Lanjutkan Rekaman Suara';
        } else {
            window.mediaRecorderObj.resume();
            window.isVoicePaused = false;
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            btn.title = 'Jeda Rekaman Suara';
        }
    };

    window.cancelVoiceRecording = function () {
        if (window.mediaRecorderObj && window.mediaRecorderObj.state !== 'inactive') {
            window.mediaRecorderObj.stop();
        }
        window.cleanupVoiceRecordingState();
    };

    window.stopAndSendVoiceRecording = function () {
        if (!window.mediaRecorderObj || window.mediaRecorderObj.state === 'inactive') return;

        window.mediaRecorderObj.onstop = async () => {
            const blob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.cleanupVoiceRecordingState();

            if (!window.activeChatNik) return;

            const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
            const formData = new FormData();
            formData.append('sender', 'petugas');
            formData.append('nama', `Dinsos Sidoarjo (${handler})`);
            formData.append('pesan', '');
            formData.append('file', blob, `voice_${Date.now()}.webm`);

            try {
                await fetch(`${BASE_URL}/api/chat/${window.activeChatNik}`, {
                    method: 'POST',
                    body: formData
                });
                window.loadChatMessages(window.activeChatNik, window.activeChatName);
                window.loadChatList();
            } catch (err) {
                Swal.fire('Gagal', 'Pesan suara gagal dikirim.', 'error');
            }
        };

        window.mediaRecorderObj.stop();
    };

    window.cleanupVoiceRecordingState = function () {
        window.isRecordingVoice = false;
        window.isVoicePaused = false;
        if (window.voiceTimerInterval) clearInterval(window.voiceTimerInterval);
        if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();

        document.getElementById('adminVoiceControlUI').style.display = 'none';
        document.getElementById('adminChatInput').style.display = 'block';
        document.getElementById('btnMicAdmin').style.display = 'block';
        window.audioChunks = [];
    };

    // =========================================================================
    // 5. PREVIEW & PENGIRIMAN MEDIA TANPA RELOAD / KELUAR DASHBOARD
    // =========================================================================
    window.handleAdminMediaSelection = function (input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const fileType = file.type;

        if (fileType.startsWith('image/')) {
            window.launchFilerobotEditor(file);
        } else if (fileType.startsWith('video/')) {
            window.launchVideoEditor(file);
        } else {
            window.confirmSendDocument(file);
        }

        input.value = '';
    };

    window.launchFilerobotEditor = function (file) {
        currentEditingFile = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            const imgSrc = e.target.result;
            const editorModal = document.getElementById('imageEditorModal');
            if (editorModal) editorModal.style.display = 'flex';

            if (typeof FilerobotImageEditor !== 'undefined') {
                const ImageEditor = new FilerobotImageEditor(
                    document.querySelector('#filerobotContainer'),
                    {
                        source: imgSrc,
                        onSave: (editedImageData) => {
                            window.batalImageEditor();
                            fetch(editedImageData.imageBase64)
                                .then(res => res.blob())
                                .then(blob => window.uploadDirectBlob(blob, `edited_${file.name}`));
                        },
                        annotationsCommon: { fill: '#009846' },
                        Text: { text: 'Dinas Sosial Sidoarjo' },
                        Rotate: { angle: 90, componentType: 'buttons' },
                        Crop: {
                            presetsItems: [
                                { titleKey: 'classicTv', descriptionKey: '4:3', ratio: 4 / 3 },
                                { titleKey: 'cinemascope', descriptionKey: '16:9', ratio: 16 / 9 },
                                { titleKey: 'square', descriptionKey: '1:1', ratio: 1 }
                            ]
                        }
                    }
                );
                ImageEditor.render();
            } else {
                Swal.fire({
                    title: 'Kirim Foto Terpilih?',
                    imageUrl: imgSrc,
                    imageAlt: file.name,
                    imageHeight: 200,
                    showCancelButton: true,
                    confirmButtonText: 'Kirim Sekarang',
                    confirmButtonColor: '#009846'
                }).then(res => {
                    if (res.isConfirmed) {
                        window.uploadDirectBlob(file, file.name);
                    }
                    window.batalImageEditor();
                });
            }
        };
        reader.readAsDataURL(file);
    };

    window.batalImageEditor = function () {
        const modal = document.getElementById('imageEditorModal');
        if (modal) modal.style.display = 'none';
        const container = document.getElementById('filerobotContainer');
        if (container) container.innerHTML = '';
        currentEditingFile = null;
    };

    window.launchVideoEditor = function (file) {
        currentEditingVideoFile = file;
        vRotationAngle = 0;

        const videoModal = document.getElementById('videoEditorModal');
        const player = document.getElementById('vEditorPlayer');
        if (!videoModal || !player) return;

        player.src = URL.createObjectURL(file);
        player.style.transform = 'rotate(0deg)';
        videoModal.style.display = 'flex';

        player.onloadedmetadata = function () {
            const startSlider = document.getElementById('vTrimStart');
            const endSlider = document.getElementById('vTrimEnd');
            if (startSlider) startSlider.value = 0;
            if (endSlider) endSlider.value = 100;
            window.vUpdateTrimDisplay();
        };
    };

    window.batalVideoEditor = function () {
        const videoModal = document.getElementById('videoEditorModal');
        const player = document.getElementById('vEditorPlayer');
        if (player) {
            player.pause();
            player.src = '';
        }
        if (videoModal) videoModal.style.display = 'none';
        currentEditingVideoFile = null;
    };

    window.vTogglePlay = function () {
        const player = document.getElementById('vEditorPlayer');
        const btn = document.getElementById('vPlayBtn');
        if (!player) return;
        if (player.paused) {
            player.play();
            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            player.pause();
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
        }
    };

    window.vRotate = function () {
        const player = document.getElementById('vEditorPlayer');
        if (!player) return;
        vRotationAngle = (vRotationAngle + 90) % 360;
        player.style.transform = `rotate(${vRotationAngle}deg)`;
    };

    window.vUpdateTrim = function (type) {
        const player = document.getElementById('vEditorPlayer');
        const startSlider = document.getElementById('vTrimStart');
        const endSlider = document.getElementById('vTrimEnd');
        if (!player || !startSlider || !endSlider) return;

        let startVal = parseFloat(startSlider.value);
        let endVal = parseFloat(endSlider.value);

        if (startVal >= endVal) {
            if (type === 'start') startSlider.value = endVal - 1;
            else endSlider.value = startVal + 1;
        }

        window.vUpdateTrimDisplay();
    };

    window.vUpdateTrimDisplay = function () {
        const player = document.getElementById('vEditorPlayer');
        const startSlider = document.getElementById('vTrimStart');
        const endSlider = document.getElementById('vTrimEnd');
        const timeDisplay = document.getElementById('vTimeDisplay');
        const activeBar = document.getElementById('vTrimActive');
        if (!player || !player.duration || isNaN(player.duration)) return;

        const dur = player.duration;
        const sTime = (parseFloat(startSlider.value) / 100) * dur;
        const eTime = (parseFloat(endSlider.value) / 100) * dur;

        if (timeDisplay) timeDisplay.innerText = `${sTime.toFixed(1)}s - ${eTime.toFixed(1)}s / ${dur.toFixed(1)}s`;
        if (activeBar) {
            activeBar.style.left = `${startSlider.value}%`;
            activeBar.style.width = `${parseFloat(endSlider.value) - parseFloat(startSlider.value)}%`;
        }
    };

    window.vProcessAndSave = function () {
        if (!currentEditingVideoFile) return;
        const overlay = document.getElementById('vProcessingOverlay');
        if (overlay) overlay.style.display = 'flex';

        setTimeout(() => {
            if (overlay) overlay.style.display = 'none';
            window.batalVideoEditor();
            window.uploadDirectBlob(currentEditingVideoFile, currentEditingVideoFile.name);
        }, 1200);
    };

    window.confirmSendDocument = function (file) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        Swal.fire({
            title: 'Kirim Dokumen Lampiran?',
            html: `
                <div style="text-align:center; padding:15px 0;">
                    <i class="fas fa-file-pdf text-danger" style="font-size:3.5rem; margin-bottom:12px;"></i>
                    <div style="font-weight:700; font-size:1rem; color:#0f172a;">${file.name}</div>
                    <div style="color:#64748b; font-size:0.8rem; margin-top:4px;">Ukuran Berkas: ${sizeMb} MB</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim Dokumen',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#009846'
        }).then((result) => {
            if (result.isConfirmed) {
                window.uploadDirectBlob(file, file.name);
            }
        });
    };

    window.uploadDirectBlob = async function (blob, fileName) {
        if (!window.activeChatNik) return;
        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', '');

        try {
            await fetch(`${BASE_URL}/api/chat/${window.activeChatNik}`, {
                method: 'POST',
                body: formData
            });
            window.loadChatMessages(window.activeChatNik, window.activeChatName);
            window.loadChatList();
        } catch (e) {
            Swal.fire('Gagal', 'Berkas gagal dikirim.', 'error');
        }
    };

    window.sendAdminChat = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
        const inp = document.getElementById('adminChatInput');
        const text = inp ? inp.value.trim() : '';
        if (!text) return;

        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', text);

        if (window.activeReplyMessage) {
            formData.append('reply_sender', window.activeReplyMessage.sender);
            formData.append('reply_text', window.activeReplyMessage.text);
            window.cancelReplyMessage();
        }

        inp.value = '';
        try {
            await fetch(`${BASE_URL}/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
            window.loadChatMessages(window.activeChatNik, window.activeChatName);
            window.loadChatList();
        } catch (e) {}
    };

    window.renderEmojiPickerGrid = function () {
        const grid = document.getElementById('emojiGridList');
        if (!grid) return;
        grid.innerHTML = EMOJI_DATABASE.map(e => `
            <button type="button" class="emoji-cell-btn" onclick="window.insertEmojiToChat('${e}')">${e}</button>
        `).join('');
    };

    window.toggleEmojiPicker = function (e) {
        if (e) e.stopPropagation();
        const ep = document.getElementById('emojiPickerAdmin');
        if (!ep) return;
        ep.style.display = (ep.style.display === 'block') ? 'none' : 'block';
    };

    window.insertEmojiToChat = function (emoji) {
        const inp = document.getElementById('adminChatInput');
        if (inp) {
            inp.value += emoji;
            inp.focus();
        }
    };

    // =========================================================================
    // 6. WEBRTC CALL DUA ARAH, PORTRAIT FX & KONTROL PANGGILAN
    // =========================================================================
    window.initAdminPeer = function () {
        if (peerInstance && !peerInstance.destroyed) return;

        const myPeerId = 'dinsos_admin_sidoarjo';

        try {
            peerInstance = new Peer(myPeerId, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peerInstance.on('call', call => {
                activeCallObj = call;
                document.getElementById('incomingCallUI').style.display = 'flex';
                document.getElementById('callerNameText').innerText = call.peer.replace('warga_', '').replace('bansos_warga_', 'Warga NIK: ');
                document.getElementById('ringtoneAudio')?.play().catch(() => {});
            });

            peerInstance.on('error', err => {
                if (err.type === 'unavailable-id') {
                    peerInstance = new Peer(`dinsos_staff_${Math.floor(Math.random() * 1000)}`);
                }
            });
        } catch (e) {}
    };

    window.startCallWarga = async function (type = 'audio') {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');

        try {
            isCallVideoMuted = (type === 'audio');
            callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            callLocalStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);

            document.getElementById('activeCallUI').style.display = 'flex';
            document.getElementById('activeCallName').innerText = `${window.activeChatName} (${window.activeChatNik})`;

            window.updateCallInterfaceView();

            if (peerInstance) {
                const targetPeerId = `warga_${window.activeChatNik}`;
                activeCallObj = peerInstance.call(targetPeerId, callLocalStream);

                if (!activeCallObj) {
                    activeCallObj = peerInstance.call(`bansos_warga_${window.activeChatNik}`, callLocalStream);
                }

                if (activeCallObj) {
                    activeCallObj.on('stream', remoteStream => {
                        const rVid = document.getElementById('remoteVideo');
                        if (rVid) rVid.srcObject = remoteStream;
                    });
                    activeCallObj.on('close', () => window.endCall());
                    activeCallObj.on('error', () => {
                        Swal.fire('Warga Belum Aktif', 'Warga sedang tidak membuka portal verifikasi.', 'info');
                        window.endCall();
                    });
                }
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
        isCallPortraitFx = !isCallPortraitFx;
        const localVid = document.getElementById('localVideo');
        const btnBlur = document.getElementById('btnBlur');
        if (localVid) {
            localVid.classList.toggle('portrait-fx', isCallPortraitFx);
        }
        if (btnBlur) {
            btnBlur.classList.toggle('active-fx', isCallPortraitFx);
        }
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

    window.acceptCall = async function () {
        document.getElementById('incomingCallUI').style.display = 'none';
        document.getElementById('ringtoneAudio')?.pause();
        try {
            callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            if (activeCallObj) {
                activeCallObj.answer(callLocalStream);
                activeCallObj.on('stream', remoteStream => {
                    const rVid = document.getElementById('remoteVideo');
                    if (rVid) rVid.srcObject = remoteStream;
                });
            }
            window.updateCallInterfaceView();
            document.getElementById('activeCallUI').style.display = 'flex';
        } catch (e) {
            window.endCall();
        }
    };

    window.rejectCall = function () {
        document.getElementById('incomingCallUI').style.display = 'none';
        document.getElementById('ringtoneAudio')?.pause();
        if (activeCallObj) activeCallObj.close();
    };

    window.endCall = function () {
        if (callLocalStream) {
            callLocalStream.getTracks().forEach(t => t.stop());
            callLocalStream = null;
        }
        if (activeCallObj) activeCallObj.close();
        clearInterval(callDurationTimer);
        document.getElementById('activeCallUI').style.display = 'none';
        document.getElementById('incomingCallUI').style.display = 'none';
        document.getElementById('ringtoneAudio')?.pause();
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

    // =========================================================================
    // 7. PUSAT INVESTIGASI ADUAN CHATBOT DARI BACKEND
    // =========================================================================
    window.filterInvestigasi = async function (filterType, btnEl) {
        if (btnEl) {
            btnEl.parentElement.querySelectorAll('button').forEach(b => {
                b.className = 'btn btn-secondary btn-sm';
            });
            btnEl.className = 'btn btn-primary btn-sm';
        }

        const container = document.getElementById('laporanChatList');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Memuat data investigasi...</div>';

        try {
            const res = await window.fetchData('/api/laporan-chat');
            let list = (res && res.ok) ? await res.json() : [];

            if (filterType !== 'all') {
                list = list.filter(r => r.urgensi === filterType || r.tipe === filterType);
            }

            if (!list.length) {
                container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Tidak ada aduan aktif dalam kategori ini.</div>';
                return;
            }

            container.innerHTML = list.map(r => `
                <div class="investigasi-card-modern urgent-level">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.75rem; font-weight:800; color:#dc2626; text-transform:uppercase;">🚨 PRIORITAS TINGGI</span>
                            <h4 style="margin:4px 0 2px 0; font-size:1.05rem; color:#0f172a; font-weight:800;">${window.safeHtml(r.kategori)}</h4>
                            <div style="font-size:0.82rem; color:#64748b;">
                                Pelapor: <b style="color:#0f172a;">${window.safeHtml(r.nama)}</b> • NIK: <span style="font-family:monospace; color:#009846; font-weight:700;">${r.nik}</span>
                            </div>
                        </div>
                        <span class="badge" style="background:#f1f5f9; font-size:0.75rem; color:#475569;"><i class="fas fa-clock"></i> ${r.waktu}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:10px 14px; border-radius:10px; margin:12px 0; font-size:0.86rem; color:#334155;">
                        ${window.safeHtml(r.uraian)}
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button onclick="window.closeModal('modalLaporanChat'); window.openAdminChat('${r.nik}', '${window.escapeInlineJS(r.nama)}');" class="btn btn-primary btn-sm">
                            <i class="fas fa-comments"></i> Buka Chat Mediasi Warga
                        </button>
                        <button onclick="Swal.fire('Selesai', 'Status aduan berhasil diperbarui.', 'success')" class="btn btn-sm" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-weight:700;">
                            <i class="fas fa-check"></i> Selesaikan
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444;">Gagal mengambil data investigasi.</div>';
        }
    };

    // =========================================================================
    // 8. NOTIFIKASI AKTIVITAS SISTEM TERPADU & LIGHTBOX
    // =========================================================================
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

    window.toggleChatActionDropdown = function (event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        const dropdown = document.getElementById('chatActionDropdown');
        if (dropdown) dropdown.classList.toggle('show');
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

})(window);