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

    // State Aksi Pesan Interaktif (Balasan, Sematan, Salin & Penarikan)
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

    // State Studio Editor Media (Gambar, Video Trimmer & Dokumen)
    let currentEditingFile = null;
    let currentEditingVideoFile = null;
    let vRotationAngle = 0;
    let vTrimStartVal = 0;
    let vTrimEndVal = 100;
    let filerobotImageEditorInstance = null;

    // State Panggilan Audio & Video WebRTC P2P
    let peerInstance = null;
    let activeCallObj = null;
    let callLocalStream = null;
    let isCallAudioMuted = false;
    let isCallVideoMuted = true;
    let isCallPortraitFx = false;
    let callDurationTimer = null;
    let callDurationSecs = 0;

    // State Notifikasi Terpadu (Single Engine & Anti-Glitch Cache)
    window.activeNotifTab = 'all';
    window.globalNotificationsData = [];
    let lastRenderedNotifState = '';

    const BASE_API_URL = window.API_BASE_URL || 
        ((typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
            ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
            : 'http://127.0.0.1:5000');

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
        sinkronisasiPesanMasukRealtime();
        setInterval(sinkronisasiPesanMasukRealtime, 3000);
    });

    async function apiCall(endpoint, options = {}) {
        if (typeof window.fetchData === 'function') {
            try {
                return await window.fetchData(endpoint, options);
            } catch (e) {}
        }
        const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('bansosToken');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };
        return await fetch(`${BASE_API_URL}${endpoint}`, { ...options, headers });
    }

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
            const res = await apiCall('/api/chat/list');
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
        const btnInbox = document.getElementById('tabInboxBtn');
        const btnKontak = document.getElementById('tabKontakBtn');
        const listInbox = document.getElementById('chatContactList');
        const listKontak = document.getElementById('chatBukuKontakList');

        if (tab === 'inbox') {
            if (btnInbox) btnInbox.className = 'chat-tab-btn active';
            if (btnKontak) btnKontak.className = 'chat-tab-btn';
            if (listInbox) listInbox.style.display = 'block';
            if (listKontak) listKontak.style.display = 'none';
            sinkronisasiPesanMasukRealtime();
        } else {
            if (btnKontak) btnKontak.className = 'chat-tab-btn active';
            if (btnInbox) btnInbox.className = 'chat-tab-btn';
            if (listInbox) listInbox.style.display = 'none';
            if (listKontak) {
                listKontak.style.display = 'block';
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
            const res = await apiCall('/users');
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

    window.bukaModalAlihkanAdmin = async function () {
        if (!window.activeChatNik) {
            return Swal.fire('Peringatan', 'Pilih salah satu obrolan warga terlebih dahulu.', 'warning');
        }
        const modal = document.getElementById('modalAlihkanAdmin');
        const nameEl = document.getElementById('transferWargaName');
        const select = document.getElementById('selectAdminTransfer');
        if (nameEl) nameEl.innerText = window.activeChatName || 'Warga';

        if (select) {
            select.innerHTML = '<option value="">Memuat daftar petugas...</option>';
            try {
                const res = await apiCall('/users');
                const users = (res && res.ok) ? await res.json() : [];
                select.innerHTML = users.map(u => 
                    `<option value="${u.username}">${u.username.toUpperCase()} (${u.role === 'admin' ? 'Super Admin' : 'Petugas Lapangan'})</option>`
                ).join('');
                const current = window.chatHandlersMap[window.activeChatNik] || 'petugas';
                select.value = current;
            } catch (e) {
                select.innerHTML = '<option value="admin">ADMIN (Super Admin)</option><option value="petugas">PETUGAS (Petugas Lapangan)</option>';
            }
        }
        if (modal) modal.style.display = 'flex';
    };

    window.eksekusiAlihkanAdmin = function () {
        const select = document.getElementById('selectAdminTransfer');
        const targetPetugas = select ? select.value : '';
        if (!targetPetugas) {
            return Swal.fire('Peringatan', 'Pilih petugas tujuan pengalihan.', 'warning');
        }
        if (window.activeChatNik) {
            window.chatHandlersMap[window.activeChatNik] = targetPetugas;
            localStorage.setItem('chatHandlersMap', JSON.stringify(window.chatHandlersMap));
            const handlerDisplay = document.getElementById('chatActiveHandlerDisplay');
            if (handlerDisplay) handlerDisplay.innerText = targetPetugas.toUpperCase();
        }
        window.closeModal('modalAlihkanAdmin');
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Obrolan berhasil dialihkan ke ${targetPetugas.toUpperCase()}`,
            timer: 2000,
            showConfirmButton: false
        });
    };

    window.selectWargaChat = function (nik) {
        const realName = window.getWargaNameByNik(nik);
        window.loadChatMessages(nik, realName);
    };

    // =========================================================================
    // 3. LOGIKA GELEMBUNG CHAT MODERN, MENU TITIK TIGA & TINDAKAN INTERAKTIF
    // =========================================================================
    window.toggleChatActionDropdown = function (e) {
        if (e) e.stopPropagation();
        const dropdown = document.getElementById('chatActionDropdown');
        if (!dropdown) return;
        const isOpen = dropdown.classList.contains('show');
        document.querySelectorAll('.chat-dropdown-content, .bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        if (!isOpen) dropdown.classList.add('show');
    };

    document.addEventListener('click', function () {
        document.querySelectorAll('.chat-dropdown-content, .bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        const ep = document.getElementById('emojiPickerAdmin');
        if (ep) ep.style.display = 'none';
    });

    window.toggleBubbleDropdown = function (btn, e) {
        if (e) e.stopPropagation();
        const parentBubble = btn.closest('.chat-msg-bubble');
        if (!parentBubble) return;
        const dropdown = parentBubble.querySelector('.bubble-action-dropdown');
        if (!dropdown) return;

        const isShown = dropdown.classList.contains('show');
        document.querySelectorAll('.bubble-action-dropdown, .chat-dropdown-content').forEach(d => d.classList.remove('show'));
        if (!isShown) dropdown.classList.add('show');
    };

    window.formatModernBubbleHtml = function (pesan, isSenderAdmin) {
        const rowClass = isSenderAdmin ? 'outgoing' : 'incoming';
        const rawText = pesan.text || pesan.pesan || '';
        const escapedText = $('<div>').text(rawText).html();
        const waktu = pesan.waktu || pesan.time || 'Baru saja';
        const msgId = pesan.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        if (window.deletedForMeIds.includes(String(msgId))) return '';
        const isDeletedAll = window.deletedForAllIds.includes(String(msgId)) || Boolean(pesan.is_deleted_all);

        let contentHtml = '';
        if (isDeletedAll) {
            contentHtml = `<span style="font-style:italic; opacity:0.65;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</span>`;
        } else {
            if (pesan.reply_text) {
                contentHtml += `<div style="border-left:3px solid #009846; padding:3px 8px; margin-bottom:6px; font-size:0.75rem; background:rgba(0,0,0,0.05); border-radius:4px;"><b>${window.safeHtml(pesan.reply_sender || 'Balasan')}</b>: ${window.safeHtml(pesan.reply_text)}</div>`;
            }

            if (pesan.file_path) {
                const url = pesan.file_path.startsWith('http') ? pesan.file_path : `${BASE_API_URL}${pesan.file_path}`;
                if (pesan.file_type === 'image') {
                    contentHtml += `
                        <div style="max-width:280px; border-radius:12px; overflow:hidden; margin-bottom:6px; cursor:pointer;" onclick="window.openLightbox('${url}','image')">
                            <img src="${url}" style="width:100%; max-height:220px; object-fit:cover; display:block;" />
                        </div>`;
                } else if (pesan.file_type === 'video') {
                    contentHtml += `
                        <div style="max-width:320px; border-radius:12px; overflow:hidden; margin-bottom:6px; background:#000;">
                            <video src="${url}" controls playsinline preload="metadata" style="width:100%; max-height:240px; display:block;"></video>
                        </div>`;
                } else if (pesan.file_type === 'audio') {
                    contentHtml += `
                        <div style="min-width:230px; padding:6px 0; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-microphone" style="color:#009846; font-size:1.1rem;"></i>
                            <audio src="${url}" controls style="flex:1; height:32px; outline:none;"></audio>
                        </div>`;
                } else if (pesan.file_type === 'document') {
                    const fileName = pesan.file_path.split('/').pop();
                    contentHtml += `
                        <div onclick="window.open('${url}', '_blank')" style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(0,0,0,0.04); border-radius:8px; margin-bottom:6px; cursor:pointer;">
                            <i class="fas fa-file-alt text-primary" style="font-size:1.5rem;"></i>
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:700; font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${fileName}</div>
                                <small style="opacity:0.75; font-size:0.7rem;">Unduh Dokumen</small>
                            </div>
                        </div>`;
                }
            }

            let cleanText = (rawText || '')
                .replace(/foto\s*terlampir/gi, '')
                .replace(/video\s*terlampir/gi, '')
                .replace(/^voice\s*note$/gi, '')
                .trim();

            if (cleanText) {
                contentHtml += `<div class="chat-msg-text">${window.safeHtml(cleanText)}</div>`;
            }
        }

        const reactionHtml = pesan.reaction ? `<div class="msg-reaction-display">${pesan.reaction}</div>` : '';

        return `
            <div class="chat-msg-row ${rowClass}" id="bubble_wrap_${msgId}" data-id="${msgId}">
                <div class="chat-msg-bubble">
                    ${!isDeletedAll ? `
                    <button type="button" class="bubble-corner-btn" onclick="window.toggleBubbleDropdown(this, event)" title="Opsi Pesan">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <div class="bubble-action-dropdown" onclick="event.stopPropagation()">
                        <div class="emoji-react-row">
                            <span onclick="window.addReactionToMessage('${msgId}', '❤️')">❤️</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '👍')">👍</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '😂')">😂</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '😮')">😮</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '🙏')">🙏</span>
                        </div>
                        <button type="button" onclick="window.prepareReplyMessage('${msgId}', '${isSenderAdmin ? 'Petugas' : window.escapeInlineJS(window.activeChatName)}', '${window.escapeInlineJS(rawText || 'Media')}')">
                            <i class="fas fa-reply text-primary"></i> Balas Pesan
                        </button>
                        <button type="button" onclick="window.pinMessageDirect('${window.escapeInlineJS(rawText || 'Media')}')">
                            <i class="fas fa-thumbtack text-accent"></i> Sematkan Pesan
                        </button>
                        <button type="button" onclick="window.salinTeksPesan('${window.escapeInlineJS(rawText || '')}')">
                            <i class="fas fa-copy text-info"></i> Salin Pesan
                        </button>
                        <button type="button" class="text-danger" onclick="window.deleteMessageAction('${msgId}', ${isSenderAdmin})">
                            <i class="fas fa-trash-alt text-danger"></i> Hapus Pesan
                        </button>
                    </div>
                    ` : ''}

                    ${contentHtml}
                    <span class="chat-time-stamp">${waktu}</span>
                    ${reactionHtml}
                </div>
            </div>
        `;
    };

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
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            box.innerHTML = '';

            messages.forEach((m) => {
                const isAdmin = m.sender !== 'warga';
                box.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isAdmin));
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
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            if (messages.length !== box.querySelectorAll('.chat-msg-row').length) {
                window.loadChatMessages(nik, window.activeChatName);
            }
        } catch (e) {}
    };

    async function sinkronisasiPesanMasukRealtime() {
        try {
            const token = localStorage.getItem('token') || '';
            const resInbox = await fetch(`${BASE_API_URL}/api/chat/inbox`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resInbox.ok) {
                const jsonInbox = await resInbox.json();
                const inboxContainer = document.getElementById('chatContactList');
                const tabInboxBtn = document.getElementById('tabInboxBtn');

                if (inboxContainer && Array.isArray(jsonInbox.data) && jsonInbox.data.length > 0) {
                    const totalUnread = jsonInbox.data.reduce((acc, cur) => acc + (cur.unread_count || 0), 0);
                    if (tabInboxBtn) {
                        tabInboxBtn.innerHTML = `<i class="fas fa-inbox"></i> Pesan Masuk ${totalUnread > 0 ? `<span style="background:#dc2626; color:white; border-radius:12px; padding:1px 7px; font-size:0.7rem; margin-left:4px;">${totalUnread}</span>` : ''}`;
                    }

                    if (tabInboxBtn && tabInboxBtn.classList.contains('active')) {
                        inboxContainer.innerHTML = jsonInbox.data.map(item => `
                            <div onclick="window.selectWargaChat ? window.selectWargaChat('${item.nik}') : window.loadChatMessages('${item.nik}', '${window.escapeInlineJS(item.nama)}') " class="contact-item" style="padding:14px; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; gap:12px; align-items:center; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                                <div style="width:42px; height:42px; border-radius:50%; background:#009846; color:white; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    ${(item.nama || 'W').charAt(0).toUpperCase()}
                                </div>
                                <div style="flex:1; overflow:hidden;">
                                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                        <div style="font-weight:800; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.nama}</div>
                                        <small style="font-size:0.7rem; color:#94a3b8;">${item.waktu || ''}</small>
                                    </div>
                                    <div style="font-size:0.78rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.pesan_terakhir || 'Membuka pesan baru...'}</div>
                                </div>
                                ${item.unread_count > 0 ? `<span style="background:#009846; color:white; border-radius:50%; width:18px; height:18px; font-size:0.68rem; font-weight:800; display:flex; align-items:center; justify-content:center;">${item.unread_count}</span>` : ''}
                            </div>
                        `).join('');
                    }
                }
            }

            const activeNikEl = document.getElementById('chatActiveNikDisplay');
            const chatBox = document.getElementById('adminChatMessages');
            if (activeNikEl && chatBox && activeNikEl.innerText && activeNikEl.innerText !== '-') {
                const currentNik = activeNikEl.innerText.trim();
                const resMsg = await fetch(`${BASE_API_URL}/api/chat/messages?nik=${currentNik}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (resMsg.ok) {
                    const jsonMsg = await resMsg.json();
                    const messages = jsonMsg.messages || jsonMsg.data || [];
                    const currentCount = chatBox.querySelectorAll('.chat-msg-row').length;

                    if (messages.length > currentCount) {
                        const newMessages = messages.slice(currentCount);
                        newMessages.forEach(m => {
                            const isSenderAdmin = m.pengirim === 'admin' || m.sender === 'admin' || m.is_admin === true;
                            chatBox.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isSenderAdmin));
                        });
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                }
            }
        } catch (err) {}
    }

    window.addReactionToMessage = function (msgId, emojiChar) {
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        const wrap = document.getElementById(`bubble_wrap_${msgId}`);
        if (!wrap) return;
        let reactEl = wrap.querySelector('.msg-reaction-display');
        if (!reactEl) {
            reactEl = document.createElement('div');
            reactEl.className = 'msg-reaction-display';
            wrap.querySelector('.chat-msg-bubble')?.appendChild(reactEl);
        }
        reactEl.innerText = emojiChar;
    };

    window.prepareReplyMessage = function (id, sender, text) {
        window.activeReplyMessage = { id, sender, text };
        document.getElementById('replyTargetSender').innerText = sender;
        document.getElementById('replyTargetText').innerText = text;
        document.getElementById('replyMessageBanner').style.display = 'flex';
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
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
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
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
            window.deletedForMeIds.push(String(msgId));
            localStorage.setItem('chatDeletedForMe', JSON.stringify(window.deletedForMeIds));
            document.getElementById(`bubble_wrap_${msgId}`)?.remove();
        } else if (opt === false) {
            window.deletedForAllIds.push(String(msgId));
            localStorage.setItem('chatDeletedForAll', JSON.stringify(window.deletedForAllIds));
            const wrap = document.getElementById(`bubble_wrap_${msgId}`);
            if (wrap) {
                wrap.querySelector('.chat-msg-bubble').innerHTML = `<span style="font-style:italic; opacity:0.65;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</span>`;
            }
        }
    };

    // =========================================================================
    // 4. AUDIO, RECORDING & STUDIO MEDIA (GAMBAR FILEROBOT & VIDEO CANVAS)
    // =========================================================================
    window.startVoiceRecording = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');

        try {
            micStreamRef = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
        } catch (err) {
            return Swal.fire({
                icon: 'warning',
                title: 'Akses Mikrofon Diperlukan',
                text: 'Silakan izinkan akses mikrofon pada peramban Anda.'
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
                if (micStreamRef) micStreamRef.getTracks().forEach(t => t.stop());
            };

            window.mediaRecorderObj.start(250);
            window.isRecordingVoice = true;
            window.isVoicePaused = false;
            window.voiceDurationSecs = 0;

            window.startWaveformVisualizer(micStreamRef);

            document.getElementById('adminChatInput').style.display = 'none';
            document.getElementById('btnMicAdmin').style.display = 'none';
            document.getElementById('adminVoiceControlUI').style.display = 'flex';

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
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            window.mediaRecorderObj.resume();
            window.isVoicePaused = false;
            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
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
                await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
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

    window.handleAdminMediaSelection = function (input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const fileType = file.type;

        if (fileType.startsWith('image/')) {
            window.openImageEditor(file);
        } else if (fileType.startsWith('video/')) {
            window.openVideoEditor(file);
        } else {
            window.confirmSendDocument(file);
        }
        input.value = '';
    };

    // STUDIO GAMBAR: FILEROBOT IMAGE EDITOR
    window.openImageEditor = function (file) {
        currentEditingFile = file;
        const modal = document.getElementById('imageEditorModal');
        const container = document.getElementById('filerobotContainer');
        if (!modal || !container) {
            window.uploadDirectBlob(file, file.name);
            return;
        }
        modal.style.display = 'flex';
        container.innerHTML = '';

        const imgUrl = URL.createObjectURL(file);
        if (typeof window.FilerobotImageEditor !== 'undefined') {
            try {
                filerobotImageEditorInstance = new window.FilerobotImageEditor(container, {
                    source: imgUrl,
                    onSave: (editedImageObject) => {
                        const base64Data = editedImageObject.imageBase64;
                        fetch(base64Data)
                            .then(res => res.blob())
                            .then(blob => {
                                window.uploadDirectBlob(blob, file.name.replace(/\.[^/.]+$/, "") + "_edited.jpg");
                                window.batalImageEditor();
                            });
                    },
                    onClose: () => {
                        window.batalImageEditor();
                    }
                });
                filerobotImageEditorInstance.render();
            } catch (err) {
                window.uploadDirectBlob(file, file.name);
                window.batalImageEditor();
            }
        } else {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px;">
                    <img src="${imgUrl}" style="max-height:70vh; max-width:90%; border-radius:12px; object-fit:contain;" />
                    <button type="button" class="btn btn-primary" onclick="window.uploadDirectBlob(currentEditingFile, currentEditingFile.name); window.batalImageEditor();">
                        <i class="fas fa-paper-plane"></i> Kirim Gambar Ini
                    </button>
                </div>
            `;
        }
    };

    window.batalImageEditor = function () {
        const modal = document.getElementById('imageEditorModal');
        if (modal) modal.style.display = 'none';
        if (filerobotImageEditorInstance && typeof filerobotImageEditorInstance.terminate === 'function') {
            try { filerobotImageEditorInstance.terminate(); } catch (e) {}
            filerobotImageEditorInstance = null;
        }
        const container = document.getElementById('filerobotContainer');
        if (container) container.innerHTML = '';
        currentEditingFile = null;
    };

    // STUDIO VIDEO: HTML5 CANVAS TRIMMER & ROTATOR
    window.openVideoEditor = function (file) {
        currentEditingVideoFile = file;
        const modal = document.getElementById('videoEditorModal');
        const player = document.getElementById('vEditorPlayer');
        if (!modal || !player) {
            window.uploadDirectBlob(file, file.name);
            return;
        }
        modal.style.display = 'flex';
        vRotationAngle = 0;
        vTrimStartVal = 0;
        vTrimEndVal = 100;

        const vidUrl = URL.createObjectURL(file);
        player.src = vidUrl;
        player.style.transform = 'rotate(0deg)';
        player.load();

        player.onloadedmetadata = function () {
            const duration = player.duration || 0;
            window.updateVideoTimeDisplay(0, duration);
            const startSlider = document.getElementById('vTrimStart');
            const endSlider = document.getElementById('vTrimEnd');
            const activeTrack = document.getElementById('vTrimActive');
            if (startSlider) startSlider.value = 0;
            if (endSlider) endSlider.value = 100;
            if (activeTrack) {
                activeTrack.style.left = '0%';
                activeTrack.style.width = '100%';
            }
        };

        player.ontimeupdate = function () {
            const duration = player.duration || 1;
            const current = player.currentTime || 0;
            window.updateVideoTimeDisplay(current, duration);

            const endLimit = (vTrimEndVal / 100) * duration;
            if (current >= endLimit) {
                player.pause();
                const startLimit = (vTrimStartVal / 100) * duration;
                player.currentTime = startLimit;
                const playBtn = document.getElementById('vPlayBtn');
                if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
            }
        };
    };

    window.batalVideoEditor = function () {
        const modal = document.getElementById('videoEditorModal');
        const player = document.getElementById('vEditorPlayer');
        if (player) {
            player.pause();
            player.src = '';
        }
        if (modal) modal.style.display = 'none';
        currentEditingVideoFile = null;
        vRotationAngle = 0;
    };

    window.vTogglePlay = function () {
        const player = document.getElementById('vEditorPlayer');
        const playBtn = document.getElementById('vPlayBtn');
        if (!player) return;
        if (player.paused) {
            player.play();
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            player.pause();
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
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
        const activeTrack = document.getElementById('vTrimActive');
        if (!player || !startSlider || !endSlider) return;

        let sVal = parseFloat(startSlider.value);
        let eVal = parseFloat(endSlider.value);

        if (sVal >= eVal) {
            if (type === 'start') {
                sVal = Math.max(0, eVal - 1);
                startSlider.value = sVal;
            } else {
                eVal = Math.min(100, sVal + 1);
                endSlider.value = eVal;
            }
        }

        vTrimStartVal = sVal;
        vTrimEndVal = eVal;

        if (activeTrack) {
            activeTrack.style.left = `${sVal}%`;
            activeTrack.style.width = `${eVal - sVal}%`;
        }

        const duration = player.duration || 0;
        if (type === 'start') {
            player.currentTime = (sVal / 100) * duration;
        } else {
            player.currentTime = (eVal / 100) * duration;
        }
    };

    window.updateVideoTimeDisplay = function (curr, total) {
        const display = document.getElementById('vTimeDisplay');
        if (!display) return;
        const format = sec => {
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(Math.floor(sec % 60)).padStart(2, '0');
            return `${m}:${s}`;
        };
        display.innerText = `${format(curr)} / ${format(total)}`;
    };

    window.vProcessAndSave = async function () {
        if (!currentEditingVideoFile) return;
        const player = document.getElementById('vEditorPlayer');
        const overlay = document.getElementById('vProcessingOverlay');
        const processText = document.getElementById('vProcessingText');
        const canvas = document.getElementById('vRenderCanvas');
        const isMuted = document.getElementById('vidMuteAdmin')?.checked || false;

        if (vTrimStartVal === 0 && vTrimEndVal === 100 && vRotationAngle === 0 && !isMuted) {
            window.uploadDirectBlob(currentEditingVideoFile, currentEditingVideoFile.name);
            window.batalVideoEditor();
            return;
        }

        if (overlay) overlay.style.display = 'flex';
        if (processText) processText.innerText = 'Menyiapkan render video...';

        try {
            const duration = player.duration || 1;
            const startTime = (vTrimStartVal / 100) * duration;
            const endTime = (vTrimEndVal / 100) * duration;
            const targetDuration = endTime - startTime;

            player.pause();
            player.currentTime = startTime;

            const stream = canvas.captureStream ? canvas.captureStream(30) : player.captureStream();

            if (!isMuted && player.captureStream) {
                try {
                    const playerStream = player.captureStream();
                    const audioTracks = playerStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        stream.addTrack(audioTracks[0]);
                    }
                } catch (e) {}
            }

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks = [];

            recorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const resultBlob = new Blob(chunks, { type: 'video/webm' });
                if (overlay) overlay.style.display = 'none';
                window.uploadDirectBlob(resultBlob, `video_${Date.now()}.webm`);
                window.batalVideoEditor();
            };

            const ctx = canvas.getContext('2d');
            const vWidth = player.videoWidth || 640;
            const vHeight = player.videoHeight || 360;

            if (vRotationAngle === 90 || vRotationAngle === 270) {
                canvas.width = vHeight;
                canvas.height = vWidth;
            } else {
                canvas.width = vWidth;
                canvas.height = vHeight;
            }

            recorder.start(100);
            player.muted = isMuted;
            player.play();

            const renderInterval = setInterval(() => {
                if (player.currentTime >= endTime || player.ended) {
                    clearInterval(renderInterval);
                    player.pause();
                    recorder.stop();
                    return;
                }

                const currentRenderSec = Math.max(0, player.currentTime - startTime);
                if (processText) {
                    processText.innerText = `Merender: ${currentRenderSec.toFixed(1)}s / ${targetDuration.toFixed(1)}s`;
                }

                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((vRotationAngle * Math.PI) / 180);
                if (vRotationAngle === 90 || vRotationAngle === 270) {
                    ctx.drawImage(player, -vWidth / 2, -vHeight / 2, vWidth, vHeight);
                } else {
                    ctx.drawImage(player, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
                }
                ctx.restore();
            }, 1000 / 30);

        } catch (err) {
            if (overlay) overlay.style.display = 'none';
            window.uploadDirectBlob(currentEditingVideoFile, currentEditingVideoFile.name);
            window.batalVideoEditor();
        }
    };

    window.confirmSendDocument = function (file) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        Swal.fire({
            title: 'Kirim Dokumen Lampiran?',
            html: `<div style="font-weight:700;">${file.name} (${sizeMb} MB)</div>`,
            showCancelButton: true,
            confirmButtonText: 'Kirim Dokumen',
            confirmButtonColor: '#009846'
        }).then((result) => {
            if (result.isConfirmed) {
                window.uploadDirectBlob(file, file.name);
            }
        });
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
            await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
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
    // 5. WEBRTC CALL DUA ARAH
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

        if (!isCallVideoMuted) {
            if (vArea) vArea.style.display = 'block';
            if (aArea) aArea.style.display = 'none';
            if (localVid) localVid.srcObject = callLocalStream;
            if (btnVideo) btnVideo.className = 'ctrl-btn';
        } else {
            if (vArea) vArea.style.display = 'none';
            if (aArea) aArea.style.display = 'flex';
            if (btnVideo) btnVideo.className = 'ctrl-btn off';
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
        if (btnMute) btnMute.className = isCallAudioMuted ? 'ctrl-btn off' : 'ctrl-btn';
    };

    window.toggleBlur = function () {
        isCallPortraitFx = !isCallPortraitFx;
        document.getElementById('localVideo')?.classList.toggle('portrait-fx', isCallPortraitFx);
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
    // 6. PUSAT INVESTIGASI ADUAN & PENGALIHAN PENANGANAN
    // =========================================================================
    window.bukaModalLaporRiwayat = function () {
        if (!window.activeChatNik) {
            return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
        }
        const modal = document.getElementById('modalLaporRiwayat');
        if (modal) modal.style.display = 'flex';
    };

    window.eksekusiLaporRiwayat = async function () {
        if (!window.activeChatNik) return;
        const alasanInp = document.getElementById('inputAlasanLaporChat');
        const alasan = alasanInp ? alasanInp.value.trim() : '';

        if (!alasan) {
            return Swal.fire('Wajib Diisi', 'Silakan masukkan alasan pelaporan riwayat chat.', 'warning');
        }

        Swal.fire({
            title: 'Mengirim Laporan...',
            allowOutsideClick: false,
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal.showLoading()
        });

        try {
            const payload = {
                nik: window.activeChatNik,
                nama: window.activeChatName,
                kategori: 'Pelanggaran / Sengketa Chat',
                urgensi: 'urgent',
                uraian: alasan,
                waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            };

            const res = await apiCall('/api/laporan-chat', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res && res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Laporan Terkirim!',
                    text: 'Riwayat percakapan telah diteruskan ke Pusat Investigasi Terpadu.',
                    buttonsStyling: false,
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-confirm' }
                });
                window.closeModal('modalLaporRiwayat');
                if (alasanInp) alasanInp.value = '';
            } else {
                throw new Error('Gagal mengirim ke server investigasi.');
            }
        } catch (e) {
            Swal.fire('Gagal', e.message, 'error');
        }
    };

    window.hapusRiwayatLokal = async function () {
        if (!window.activeChatNik) return;
        const confirm = await Swal.fire({
            title: 'Bersihkan Obrolan?',
            text: `Hapus seluruh tampilan obrolan lokal dengan ${window.activeChatName}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Bersihkan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626'
        });

        if (confirm.isConfirmed) {
            document.getElementById('adminChatMessages').innerHTML = '';
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Obrolan lokal telah dibersihkan', timer: 1500, showConfirmButton: false });
        }
    };

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
            const res = await apiCall('/api/laporan-chat');
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

    window.loadLaporanChatData = async function () {
        if (typeof window.filterInvestigasi === 'function') {
            window.filterInvestigasi('all', null);
        }
    };

    // =========================================================================
    // 7. SATU SISTEM TAMPILAN NOTIFIKASI TUNGGAL (ANTI-GLITCH, STABLE CHRONOLOGICAL)
    // =========================================================================
    window.initGlobalNotifications = function () {
        if (window._notifPollTimer) clearInterval(window._notifPollTimer);
        window.fetchNotifications();
        window._notifPollTimer = setInterval(() => {
            window.fetchNotifications();
        }, 3000);
    };

    window.fetchNotifications = async function () {
        try {
            const res = await apiCall('/api/notifikasi');
            if (!res || !res.ok) return;
            const resJson = await res.json();
            const serverData = resJson.data || [];

            window.globalNotificationsData = serverData.map(n => {
                const pesan = n.pesan || '';
                const lower = pesan.toLowerCase();

                let isUrgent = Boolean(
                    pesan.includes('🚨') ||
                    lower.includes('sengketa') ||
                    lower.includes('aduan') ||
                    lower.includes('urgent') ||
                    lower.includes('investigasi') ||
                    lower.includes('anomali')
                );

                const nikMatch = pesan.match(/\b\d{16}\b/);
                const nik = nikMatch ? nikMatch[0] : null;

                let action = null;
                if (nik || lower.includes('[warga]') || lower.includes('aduan')) {
                    action = 'chat';
                } else if (lower.includes('spk') || lower.includes('kriteria') || lower.includes('saw') || lower.includes('bwm')) {
                    action = 'spk';
                }

                return {
                    id: n.id,
                    isUrgent: isUrgent,
                    text: pesan,
                    time: n.waktu,
                    action: action,
                    nik: nik,
                    pinned: Boolean(n.is_pinned),
                    archived: Boolean(n.is_archived),
                    is_read: Boolean(n.is_read)
                };
            });

            window.updateNotificationBadgeCount(resJson.unread);

            const panel = document.getElementById('notifPanel');
            if (panel && (panel.style.display === 'flex' || panel.style.display === 'block')) {
                window.renderNotificationList();
            }
        } catch (e) {}
    };

    window.toggleNotifPanel = function (e) {
        if (e) e.stopPropagation();
        const panel = document.getElementById('notifPanel');
        if (!panel) return;
        const isShow = panel.style.display === 'flex' || panel.style.display === 'block';
        panel.style.display = isShow ? 'none' : 'flex';
        if (!isShow) {
            lastRenderedNotifState = '';
            window.fetchNotifications();
            window.renderNotificationList();
        }
    };

    window.switchNotifTab = function (tab) {
        window.activeNotifTab = tab;
        document.querySelectorAll('.ntf-tab-btn').forEach(b => b.classList.remove('active'));
        if (tab === 'all') document.getElementById('tabNotifAll')?.classList.add('active');
        else if (tab === 'urgent') document.getElementById('tabNotifUrgent')?.classList.add('active');
        else if (tab === 'arsip') document.getElementById('tabNotifArsip')?.classList.add('active');
        lastRenderedNotifState = '';
        window.renderNotificationList();
    };

    window.renderNotificationList = function () {
        const listContainer = document.getElementById('notifList');
        if (!listContainer) return;

        let items = [...(window.globalNotificationsData || [])];
        if (window.activeNotifTab === 'urgent') items = items.filter(n => n.isUrgent && !n.archived);
        else if (window.activeNotifTab === 'arsip') items = items.filter(n => n.archived);
        else items = items.filter(n => !n.archived);

        items.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return b.id - a.id;
        });

        const currentStateKey = JSON.stringify(items.map(i => ({ id: i.id, p: i.pinned, a: i.archived, r: i.is_read }))) + '_' + window.activeNotifTab;
        if (currentStateKey === lastRenderedNotifState && listContainer.children.length > 0) {
            return;
        }
        lastRenderedNotifState = currentStateKey;

        if (!items.length) {
            listContainer.innerHTML = '<div style="text-align:center; padding:35px 20px; color:#94a3b8;"><i class="fas fa-bell-slash fa-2x"></i><p style="margin-top:8px; font-size:0.85rem;">Tidak ada notifikasi baru.</p></div>';
            return;
        }

        const prevScroll = listContainer.scrollTop;

        listContainer.innerHTML = items.map(n => {
            const rawPesan = n.text || '';
            let roleBadgeText = 'SISTEM';
            let badgeStyle = 'background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;';
            let cleanText = rawPesan;

            // Ekstraksi Tag Peran Bersih dengan Regex Pipa Murni
            const tagMatch = rawPesan.match(/^\[(Admin\vert{}Petugas\vert{}Operator\vert{}Warga\vert{}Sistem)\]\s*/i);
            if (tagMatch) {
                const tag = tagMatch[1].toUpperCase();
                cleanText = rawPesan.replace(/^\[(Admin\vert{}Petugas\vert{}Operator\vert{}Warga\vert{}Sistem)\]\s*/i, '').trim();
                if (tag === 'ADMIN') {
                    roleBadgeText = 'ADMIN';
                    badgeStyle = 'background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;';
                } else if (tag === 'PETUGAS' || tag === 'OPERATOR') {
                    roleBadgeText = 'PETUGAS';
                    badgeStyle = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;';
                } else if (tag === 'WARGA') {
                    roleBadgeText = 'WARGA';
                    badgeStyle = 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;';
                }
            } else {
                const lower = rawPesan.toLowerCase();
                if (lower.includes('admin') || lower.includes('super admin')) {
                    roleBadgeText = 'ADMIN';
                    badgeStyle = 'background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;';
                } else if (lower.includes('petugas') || lower.includes('operator') || lower.includes('persetujuan massal') || lower.includes('verifikasi')) {
                    roleBadgeText = 'PETUGAS';
                    badgeStyle = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;';
                } else if (lower.includes('warga') || lower.includes('pengaduan') || lower.includes('aduan')) {
                    roleBadgeText = 'WARGA';
                    badgeStyle = 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;';
                }
            }

            return `
                <div class="ntf-item-row" onclick="window.handleNotificationClick(${n.id})" 
                     style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; background: ${n.is_read ? '#ffffff' : '#f8fafc'};" 
                     onmouseenter="this.style.background='#f1f5f9'" 
                     onmouseleave="this.style.background='${n.is_read ? '#ffffff' : '#f8fafc'}'">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="padding: 2px 8px; border-radius: 6px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; ${badgeStyle}">
                            ${roleBadgeText}
                        </span>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${n.time}</span>
                            <button type="button" onclick="window.togglePinNotification(${n.id}, event)" style="background: none; border: none; color: ${n.pinned ? '#d97706' : '#94a3b8'}; cursor: pointer; padding: 2px 4px;" title="${n.pinned ? 'Lepas Sematan' : 'Sematkan'}">
                                <i class="fas fa-thumbtack"></i>
                            </button>
                            <button type="button" onclick="window.toggleArchiveNotification(${n.id}, event)" style="background: none; border: none; color: ${n.archived ? '#0284c7' : '#94a3b8'}; cursor: pointer; padding: 2px 4px;" title="${n.archived ? 'Pulihkan' : 'Arsipkan'}">
                                <i class="fas fa-archive"></i>
                            </button>
                            <button type="button" onclick="window.hapusNotifikasi(${n.id}, event)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 4px;" title="Hapus">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>

                    <div style="font-size: 0.85rem; color: #1e293b; font-weight: ${n.is_read ? '500' : '700'}; line-height: 1.45; word-break: break-word;">
                        ${window.safeHtml(cleanText)}
                    </div>
                </div>
            `;
        }).join('');

        listContainer.scrollTop = prevScroll;
    };

    window.renderNotifikasi = window.renderNotificationList;
    window.loadNotifikasi = window.fetchNotifications;
    window.loadNotifications = window.fetchNotifications;
    window.checkNotifications = window.fetchNotifications;

    window.handleNotificationClick = async function (id) {
        const item = (window.globalNotificationsData || []).find(n => n.id === id);
        if (!item) return;

        try {
            await apiCall(`/api/notifikasi/${id}/read`, { method: 'PATCH' });
        } catch (e) {}

        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'none';

        if (item.action === 'chat' && item.nik) {
            window.openAdminChat(item.nik, window.getWargaNameByNik(item.nik));
        } else if (item.action === 'spk') {
            if (typeof window.hitungSPK === 'function') window.hitungSPK();
        }

        lastRenderedNotifState = '';
        window.fetchNotifications();
    };

    window.togglePinNotification = async function (id, event) {
        if (event) event.stopPropagation();
        try {
            await apiCall(`/api/notifikasi/${id}/pin`, { method: 'PATCH' });
            lastRenderedNotifState = '';
            await window.fetchNotifications();
        } catch (e) {}
    };

    window.toggleArchiveNotification = async function (id, event) {
        if (event) event.stopPropagation();
        try {
            await apiCall(`/api/notifikasi/${id}/archive`, { method: 'PATCH' });
            lastRenderedNotifState = '';
            await window.fetchNotifications();
        } catch (e) {}
    };

    window.tandaiSemuaNotifDibaca = async function () {
        try {
            await apiCall('/api/notifikasi/read-all', { method: 'POST' });
            lastRenderedNotifState = '';
            await window.fetchNotifications();
            if (typeof Swal !== 'undefined') {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Semua notifikasi dibaca', timer: 1500, showConfirmButton: false });
            }
        } catch (e) {}
    };

    window.hapusSemuaNotif = async function () {
        try {
            await apiCall('/api/notifikasi/clear-all', { method: 'DELETE' });
            lastRenderedNotifState = '';
            await window.fetchNotifications();
            if (typeof Swal !== 'undefined') {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Notifikasi dibersihkan', timer: 1500, showConfirmButton: false });
            }
        } catch (e) {}
    };
    window.bersihkanSemuaNotifikasi = window.hapusSemuaNotif;

    window.hapusNotifikasi = async function (id, event) {
        if (event) event.stopPropagation();
        try {
            await apiCall(`/api/notifikasi/${id}`, { method: 'DELETE' });
            lastRenderedNotifState = '';
            await window.fetchNotifications();
        } catch (e) {}
    };

    window.updateNotificationBadgeCount = function (count) {
        const unread = count !== undefined ? count : (window.globalNotificationsData || []).filter(n => !n.is_read && !n.archived).length;
        const badge1 = document.getElementById('notifBadge');
        const badge2 = document.querySelector('.notif-badge');
        const badge3 = document.querySelector('.ntf-badge-number');

        [badge1, badge2, badge3].forEach(b => {
            if (b) {
                b.innerText = unread;
                b.style.display = unread > 0 ? 'inline-block' : 'none';
            }
        });
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