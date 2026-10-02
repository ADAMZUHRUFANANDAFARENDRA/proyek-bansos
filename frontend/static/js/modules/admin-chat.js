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

    const BASE_API_URL = window.BASE_API_URL || window.API_BASE_URL || 
        ((typeof window.CONFIG !== 'undefined' && window.CONFIG.BASE_URL)
            ? window.CONFIG.BASE_URL.replace(/\/+$/, '')
            : window.location.origin.replace(/\/+$/, ''));

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
        const modal = document.getElementById('modalAdminChat') || document.getElementById('modalChat');
        if (modal) modal.style.display = 'flex';
        window.loadChatList();
        window.initAdminPeer();

        if (nik) {
            window.loadChatMessages(nik, nama || window.getWargaNameByNik(nik));
        } else {
            window.tutupObrolanAktif();
        }
    };

    window.tutupObrolanAktif = function () {
        window.activeChatNik = null;
        window.activeChatName = null;
        if (chatInterval) clearInterval(chatInterval);

        const emptyPanel = document.getElementById('chatEmptyStatePanel');
        const activePanel = document.getElementById('chatActiveConversationPanel');
        if (emptyPanel) emptyPanel.style.display = 'flex';
        if (activePanel) activePanel.style.display = 'none';

        // Update statistik ringkasan di Empty State
        const list = window.globalDataWarga || [];
        const totalWargaEl = document.getElementById('emptyStatTotalWarga');
        const desilPrioritasEl = document.getElementById('emptyStatDesilPrioritas');
        if (totalWargaEl) totalWargaEl.innerText = `${list.length || 50}+`;
        if (desilPrioritasEl) {
            const desilCount = list.filter(w => parseInt(w.desil || 5, 10) <= 4).length;
            desilPrioritasEl.innerText = desilCount || '43';
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

    window.activeChatCategoryFilter = 'semua';
    window.filterChatKategori = function (kategori) {
        window.activeChatCategoryFilter = kategori;
        ['chipFilterSemua', 'chipFilterDesil', 'chipFilterUnread'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        if (kategori === 'semua') document.getElementById('chipFilterSemua')?.classList.add('active');
        else if (kategori === 'desil1-4') document.getElementById('chipFilterDesil')?.classList.add('active');
        else if (kategori === 'unread') document.getElementById('chipFilterUnread')?.classList.add('active');

        window.filterChatList();
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

        // Terapkan filter kategori aktif
        if (window.activeChatCategoryFilter === 'desil1-4') {
            list = list.filter(c => {
                const w = (window.globalDataWarga || []).find(x => String(x.nik) === String(c.nik));
                const desil = w ? parseInt(w.desil || 5, 10) : 5;
                return desil <= 4;
            });
        } else if (window.activeChatCategoryFilter === 'unread') {
            list = list.filter(c => (c.unread_count || 0) > 0 || String(c.last_msg || '').toLowerCase().includes('lapor'));
        }

        if (query) {
            const q = query.toLowerCase();
            list = list.filter(c => {
                const checkedName = (window.getWargaNameByNik(c.nik, c.nama) || '').toLowerCase();
                const w = (window.globalDataWarga || []).find(x => String(x.nik) === String(c.nik));
                const alamat = (w?.alamat || '').toLowerCase();
                return checkedName.includes(q) || String(c.nik || '').includes(query) || alamat.includes(q);
            });
        }

        if (!list.length) {
            container.innerHTML = '<div style="text-align:center; padding:40px 16px; color:#94a3b8; font-size:0.85rem;"><i class="fas fa-inbox fa-2x" style="margin-bottom:8px; opacity:0.5; display:block;"></i>Tidak ada obrolan dalam kategori ini.</div>';
            return;
        }

        container.innerHTML = list.map(c => {
            const realName = window.getWargaNameByNik(c.nik, c.nama);
            const isActive = String(c.nik) === String(window.activeChatNik);
            const w = (window.globalDataWarga || []).find(x => String(x.nik) === String(c.nik));
            const desil = w ? (w.desil || 1) : 1;
            const isPrioritas = desil <= 4;
            const unreadCount = c.unread_count || 0;

            return `
                <div class="chat-contact-item ${isActive ? 'active' : ''}" onclick="window.loadChatMessages('${c.nik}', '${window.escapeInlineJS(realName)}')">
                    <div class="contact-avatar" style="background:${isActive ? '#009846' : (isPrioritas ? '#0284c7' : '#64748b')};">
                        ${(realName || 'W').charAt(0).toUpperCase()}
                        <span class="contact-online-badge"></span>
                    </div>
                    <div class="contact-info">
                        <div class="contact-top">
                            <span class="contact-name-txt">${window.safeHtml(realName)}</span>
                            <span class="contact-time-txt">${c.waktu || ''}</span>
                        </div>
                        <div class="contact-nik-chip">
                            <span><i class="fas fa-id-card"></i> ${c.nik}</span>
                            <span style="background:${isPrioritas ? '#dcfce7' : '#f1f5f9'}; color:${isPrioritas ? '#15803d' : '#64748b'}; padding:1px 6px; border-radius:6px; font-weight:800; font-size:0.68rem;">Desil ${desil}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="contact-last-msg-txt">${window.safeHtml(c.last_msg || 'Mulai percakapan')}</div>
                            ${unreadCount > 0 ? `<div class="contact-unread-dot"></div>` : ''}
                        </div>
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

        if (window.activeChatCategoryFilter === 'desil1-4') {
            list = list.filter(w => parseInt(w.desil || 5, 10) <= 4);
        }

        if (query) {
            const q = query.toLowerCase();
            list = list.filter(w => (w.nama || '').toLowerCase().includes(q) || String(w.nik || '').includes(query) || (w.alamat || '').toLowerCase().includes(q));
        }

        if (!list.length) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8; font-size:0.85rem;">Tidak ada warga yang sesuai pencarian.</div>';
            return;
        }

        container.innerHTML = list.map(w => {
            const desil = w.desil || 1;
            const isPrioritas = desil <= 4;
            const isActive = String(w.nik) === String(window.activeChatNik);

            return `
                <div class="chat-contact-item ${isActive ? 'active' : ''}" onclick="window.loadChatMessages('${w.nik}', '${window.escapeInlineJS(w.nama)}')">
                    <div class="contact-avatar" style="background:${isActive ? '#009846' : (isPrioritas ? '#0284c7' : '#64748b')};">
                        ${(w.nama || 'W').charAt(0).toUpperCase()}
                        <span class="contact-online-badge"></span>
                    </div>
                    <div class="contact-info">
                        <div class="contact-top">
                            <span class="contact-name-txt">${window.safeHtml(w.nama)}</span>
                            <span style="background:${isPrioritas ? '#dcfce7' : '#f1f5f9'}; color:${isPrioritas ? '#15803d' : '#64748b'}; padding:1px 6px; border-radius:6px; font-weight:800; font-size:0.68rem;">Desil ${desil}</span>
                        </div>
                        <div class="contact-nik-chip"><i class="fas fa-id-card"></i> ${w.nik}</div>
                        <div class="contact-last-msg-txt"><i class="fas fa-map-marker-alt text-danger" style="font-size:0.7rem;"></i> ${window.safeHtml(w.alamat || 'Kabupaten Sidoarjo')}</div>
                    </div>
                </div>
            `;
        }).join('');
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
            const displayEl = document.getElementById('chatActiveHandlerDisplay');
            if (displayEl) displayEl.innerText = selected.toUpperCase();
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
                const isAudio = pesan.file_type === 'audio' ||
                                (pesan.file_path && pesan.file_path.includes('voice_')) ||
                                (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].some(ext => pesan.file_path.toLowerCase().endsWith('.' + ext))) ||
                                (pesan.file_path.toLowerCase().endsWith('.webm') && (rawText.toLowerCase().includes('suara') || rawText.toLowerCase().includes('voice')));

                if (isAudio) {
                    const audioId = `adm_aud_${msgId}_${Date.now()}`;
                    contentHtml += `
                        <div class="voice-note-bubble-card">
                            <audio id="${audioId}" src="${url}" preload="metadata" ontimeupdate="window.updateVoiceBubbleTime('${audioId}')" onended="window.resetVoiceBubblePlay('${audioId}')"></audio>
                            <button type="button" class="voice-play-circle-btn" onclick="window.toggleVoiceBubblePlay('${audioId}', this)">
                                <i class="fas fa-play" style="margin-left:2px;"></i>
                            </button>
                            <div class="voice-track-info">
                                <div class="voice-meta-row">
                                    <span><i class="fas fa-microphone"></i> Pesan Suara</span>
                                    <span id="dur_${audioId}">--:--</span>
                                </div>
                                <input type="range" class="voice-wave-progress" id="seek_${audioId}" min="0" max="100" value="0" step="0.5" oninput="window.seekVoiceBubble('${audioId}', this.value)">
                            </div>
                        </div>`;
                } else if (pesan.file_type === 'image') {
                    contentHtml += `
                        <div style="max-width:210px; border-radius:10px; overflow:hidden; margin:2px 0 4px 0; cursor:pointer;" onclick="window.openLightbox('${url}','image')">
                            <img src="${url}" style="width:100%; max-height:160px; object-fit:cover; display:block; border-radius:10px;" />
                        </div>`;
                } else if (pesan.file_type === 'video') {
                    contentHtml += `
                        <div style="max-width:220px; border-radius:10px; overflow:hidden; margin:2px 0 4px 0; background:#000;">
                            <video src="${url}" controls playsinline preload="metadata" style="width:100%; max-height:160px; display:block; border-radius:10px;"></video>
                        </div>`;
                } else if (pesan.file_type === 'document') {
                    const fileName = pesan.file_path.split('/').pop();
                    contentHtml += `
                        <div onclick="window.open('${url}', '_blank')" style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:rgba(0,0,0,0.04); border-radius:8px; margin:2px 0 4px 0; max-width:210px; cursor:pointer;">
                            <i class="fas fa-file-alt text-primary" style="font-size:1.3rem;"></i>
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:700; font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${fileName}</div>
                                <small style="opacity:0.75; font-size:0.68rem;">Unduh Dokumen</small>
                            </div>
                        </div>`;
                }
            }

            let cleanText = (rawText || '')
                .replace(/pesan\s*suara\s*(\(voice\s*note\))?/gi, '')
                .replace(/^voice\s*note$/gi, '')
                .replace(/foto\s*terlampir/gi, '')
                .replace(/video\s*terlampir/gi, '')
                .trim();

            if (cleanText) {
                if (cleanText.startsWith('[GEOTAG_LOKASI]')) {
                    try {
                        const jsonStr = cleanText.replace('[GEOTAG_LOKASI]', '').trim();
                        const loc = JSON.parse(jsonStr);
                        const latVal = Number(loc.lat) || -7.4478;
                        const lngVal = Number(loc.lng) || 112.7183;
                        contentHtml += `
                            <div class="chat-geotag-card">
                                <div class="chat-geotag-header">
                                    <i class="fas fa-map-marked-alt text-primary" style="font-size:1.15rem;"></i>
                                    <span>Lokasi Arsip Kependudukan</span>
                                </div>
                                <div class="chat-geotag-badge">
                                    <i class="fas fa-check-circle"></i> Terverifikasi Geotag Dinsos
                                </div>
                                <div style="font-size:0.82rem; font-weight:800; color:#0f172a; margin-bottom:2px;">
                                    ${window.safeHtml(loc.nama || window.activeChatName)}
                                </div>
                                <div style="font-size:0.7rem; color:#64748b; font-family:monospace; margin-bottom:4px;">
                                    NIK: ${window.safeHtml(loc.nik || window.activeChatNik)}
                                </div>
                                <div style="font-size:0.75rem; color:#334155; line-height:1.4; margin-bottom:6px;">
                                    <i class="fas fa-map-marker-alt text-danger"></i> ${window.safeHtml(loc.alamat || 'Sidoarjo, Jawa Timur')}
                                </div>
                                <div class="chat-geotag-coord">
                                    📍 Lat: ${latVal.toFixed(4)}, Lng: ${lngVal.toFixed(4)}
                                </div>
                                <div class="chat-geotag-actions">
                                    <a href="${loc.maps_url || `https://www.google.com/maps?q=${latVal},${lngVal}`}" target="_blank" class="btn-geotag-map">
                                        <i class="fas fa-external-link-alt"></i> Buka Maps
                                    </a>
                                    <a href="https://www.google.com/maps/dir/?api=1&destination=${latVal},${lngVal}" target="_blank" class="btn-geotag-rute">
                                        <i class="fas fa-route"></i> Rute Penyalur
                                    </a>
                                </div>
                            </div>
                        `;
                    } catch (e) {
                        contentHtml += `<div class="chat-msg-text" style="font-size:0.88rem; line-height:1.45;">📍 ${window.safeHtml(cleanText)}</div>`;
                    }
                } else {
                    contentHtml += `<div class="chat-msg-text" style="font-size:0.88rem; line-height:1.45;">${window.safeHtml(cleanText)}</div>`;
                }
            }
        }

        const reactionHtml = pesan.reaction ? `<div class="msg-reaction-display">${pesan.reaction}</div>` : '';
        const senderName = pesan.nama || (isSenderAdmin ? 'Petugas Dinsos' : window.activeChatName);

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
                            <i class="fas fa-reply text-primary"></i> Balas
                        </button>
                        <button type="button" onclick="window.pinMessageDirect('${window.escapeInlineJS(rawText || 'Media')}')">
                            <i class="fas fa-thumbtack text-accent"></i> Sematkan
                        </button>
                        <button type="button" onclick="window.salinTeksPesan('${window.escapeInlineJS(rawText || '')}')">
                            <i class="fas fa-copy text-info"></i> Salin
                        </button>
                        <button type="button" class="text-warning" onclick="window.laporkanPesanChat('${msgId}', '${window.escapeInlineJS(senderName)}', '${window.escapeInlineJS(rawText || '')}')">
                            <i class="fas fa-flag text-danger"></i> Laporkan
                        </button>
                        <button type="button" class="text-danger" onclick="window.deleteMessageAction('${msgId}', ${isSenderAdmin})">
                            <i class="fas fa-trash-alt text-danger"></i> Hapus
                        </button>
                    </div>
                    ` : ''}

                    ${!isSenderAdmin ? `
                    <div style="font-size:0.68rem; font-weight:800; margin-bottom:3px; opacity:0.85; display:flex; align-items:center; gap:4px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <i class="fas fa-user"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${window.safeHtml(senderName)}</span>
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
        if (!nik) return window.tutupObrolanAktif();
        window.activeChatNik = String(nik);
        window.activeChatName = window.getWargaNameByNik(nik, nama);

        const warga = (window.globalDataWarga || []).find(w => String(w.nik) === String(nik));

        const emptyPanel = document.getElementById('chatEmptyStatePanel');
        const activePanel = document.getElementById('chatActiveConversationPanel');
        if (emptyPanel) emptyPanel.style.display = 'none';
        if (activePanel) activePanel.style.display = 'flex';

        const nameDisplay = document.getElementById('chatActiveNameDisplay');
        if (nameDisplay) nameDisplay.innerText = window.activeChatName;

        const nikDisplay = document.getElementById('chatActiveNikDisplay');
        if (nikDisplay) nikDisplay.innerText = nik;

        const avatarLetter = document.getElementById('chatHeaderAvatarLetter');
        if (avatarLetter) avatarLetter.innerText = (window.activeChatName || 'W').charAt(0).toUpperCase();

        const desilBadge = document.getElementById('chatActiveDesilBadge');
        if (desilBadge) {
            const desilVal = warga ? (warga.desil || 1) : 1;
            desilBadge.innerText = `Desil ${desilVal}`;
            if (desilVal <= 4) {
                desilBadge.style.background = '#dcfce7';
                desilBadge.style.color = '#15803d';
                desilBadge.style.borderColor = '#86efac';
            } else {
                desilBadge.style.background = '#f1f5f9';
                desilBadge.style.color = '#64748b';
                desilBadge.style.borderColor = '#cbd5e1';
            }
        }

        const statusBadge = document.getElementById('chatActiveStatusBadge');
        if (statusBadge) {
            const isVerified = warga ? (warga.is_verified || false) : true;
            statusBadge.innerText = isVerified ? 'DITETAPKAN' : 'DIPROSES';
            statusBadge.style.background = isVerified ? '#e0f2fe' : '#fef3c7';
            statusBadge.style.color = isVerified ? '#0369a1' : '#b45309';
            statusBadge.style.borderColor = isVerified ? '#bae6fd' : '#fde68a';
        }

        const alamatDisplay = document.getElementById('chatActiveAlamatDisplay');
        if (alamatDisplay) {
            alamatDisplay.innerText = warga?.alamat || 'Kabupaten Sidoarjo';
        }

        const activeHandler = window.chatHandlersMap[nik] || localStorage.getItem('username') || 'Petugas Lapangan';
        const handlerDisplay = document.getElementById('chatActiveHandlerDisplay');
        if (handlerDisplay) handlerDisplay.innerText = activeHandler.toUpperCase();

        // Reset inline search & reply bar
        window.cancelAdminReply();
        window.clearAdminAttachment();
        window.refreshPinnedBanner();

        // Ambil riwayat percakapan dari server
        try {
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            box.innerHTML = '';
            if (!messages.length) {
                box.innerHTML = `
                    <div style="text-align:center; padding:50px 20px; color:#94a3b8; font-size:0.85rem; margin:auto;">
                        <i class="fas fa-comment-dots fa-3x" style="opacity:0.35; margin-bottom:12px; display:block;"></i>
                        <b style="color:#475569; font-size:0.95rem;">Belum ada riwayat pesan percakapan.</b><br>
                        Kirim pesan pembuka koordinasi atau pilih dari template balasan cepat di bawah.
                    </div>
                `;
            } else {
                messages.forEach((m) => {
                    const isAdmin = m.sender !== 'warga';
                    box.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isAdmin));
                });
            }

            box.scrollTop = box.scrollHeight;
        } catch (e) {}

        if (chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(() => {
            if (window.activeChatNik) window.silentRefreshMessages(window.activeChatNik);
        }, 3500);
    };

    window.silentRefreshMessages = async function (nik) {
        if (!nik || nik !== window.activeChatNik) return;
        try {
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            const existingCount = box.querySelectorAll('.chat-msg-row').length;
            if (messages.length !== existingCount) {
                box.innerHTML = '';
                messages.forEach((m) => {
                    const isAdmin = m.sender !== 'warga';
                    box.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isAdmin));
                });
                box.scrollTop = box.scrollHeight;
            }
        } catch (e) {}
    };

    // =========================================================================
    // TEMPLATE BALASAN CEPAT RESMI PEMKAB SIDOARJO (QUICK REPLIES)
    // =========================================================================
    window.applyQuickReplyTemplate = function (type) {
        const templates = {
            verifikasi: 'Yth. Bapak/Ibu, mohon siapkan e-KTP dan Kartu Keluarga (KK) asli untuk keperluan verifikasi lapangan penetapan bantuan sosial Kabupaten Sidoarjo. Petugas akan menghubungi Anda sebelum kunjungan.',
            jadwal: 'Penyaluran bantuan sosial tahap ini dijadwalkan secara bertahap sesuai verifikasi data lapangan. Mohon pastikan nomor telepon Anda selalu aktif untuk menerima pemberitahuan resmi.',
            lokasi: 'Pengambilan bantuan fisik dapat dilakukan di Kantor Dinas Sosial Kabupaten Sidoarjo (Jl. Pahlawan No. 25 Sidoarjo) atau kantor kecamatan setempat dengan membawa KTP dan KK asli.',
            proses: 'Permohonan Anda saat ini sedang dalam evaluasi sistem pendukung keputusan multivariat SPK BWM-SAW dan verifikasi kuota desil kemiskinan ekstrem.',
            foto: 'Mohon kirimkan foto kondisi tampak depan rumah, ruang keluarga, serta nomor meteran daya listrik rumah Anda untuk sinkronisasi kelayakan bansos.',
            terimakasih: 'Terima kasih atas tanggapan dan informasi yang Anda berikan. Laporan koordinasi ini telah kami catat dalam berkas resmi mediasi Dinas Sosial Sidoarjo.'
        };

        const inp = document.getElementById('adminChatInput');
        if (inp && templates[type]) {
            inp.value = templates[type];
            inp.focus();
        }
    };

    // =========================================================================
    // MODAL DRAWER PROFIL LENGKAP WARGA & KELAYAKAN BANSOS
    // =========================================================================
    window.bukaProfilWargaChat = function () {
        if (!window.activeChatNik) return;
        const nik = window.activeChatNik;
        const warga = (window.globalDataWarga || []).find(w => String(w.nik) === String(nik));
        const bodyEl = document.getElementById('bodyProfilWargaChat');
        if (!bodyEl) return;

        const nama = warga ? (warga.nama || warga.nama_lengkap) : (window.activeChatName || 'Warga Sidoarjo');
        const desil = warga ? (warga.desil || 1) : 1;
        const isPrioritas = desil <= 4;
        const skorSaw = warga?.skor_saw || warga?.skor || 0.75;
        const skorWp = warga?.skor_wp || 0.024;
        const penghasilan = warga?.penghasilan ? parseInt(warga.penghasilan, 10).toLocaleString('id-ID') : '850.000';
        const tanggungan = warga?.tanggungan || warga?.jumlah_tanggungan || '3';
        const alamat = warga?.alamat || 'Kabupaten Sidoarjo';
        const desa = warga?.desa || warga?.kelurahan || 'Urangagung';
        const kec = warga?.kecamatan || 'Sidoarjo';
        const noKk = warga?.no_kk || warga?.kk || `3515${nik.slice(4)}`;
        const statusVerif = warga?.is_verified ? 'Terverifikasi Lapangan' : 'Menunggu Verifikasi Fisik';

        bodyEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px; padding-bottom:16px; border-bottom:1px solid #f1f5f9;">
                <div style="width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, #009846, #047857); color:white; font-size:1.6rem; font-weight:800; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,152,70,0.3);">
                    ${nama.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 style="margin:0 0 4px 0; font-size:1.15rem; font-weight:800; color:#0f172a;">${window.safeHtml(nama)}</h3>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="background:${isPrioritas ? '#dcfce7' : '#f1f5f9'}; color:${isPrioritas ? '#15803d' : '#64748b'}; border:1px solid ${isPrioritas ? '#86efac' : '#cbd5e1'}; padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.75rem;">
                            Desil ${desil} · ${isPrioritas ? 'Prioritas Kuota Bansos' : 'Non-Prioritas'}
                        </span>
                        <span style="font-size:0.75rem; color:#64748b;">NIK: <b style="font-family:monospace; color:#0f172a;">${nik}</b></span>
                    </div>
                </div>
            </div>

            <!-- KARTU STATUS PENETAPAN BANSOS SPK -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin-bottom:16px;">
                <div style="font-weight:800; font-size:0.82rem; color:#0f172a; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.4px;">
                    <i class="fas fa-calculator text-success"></i> Status Audit Komputasi SPK BWM - SAW:
                </div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; text-align:center;">
                    <div style="background:#ffffff; padding:10px; border-radius:10px; border:1px solid #cbd5e1;">
                        <div style="font-size:0.68rem; color:#64748b; font-weight:700;">Skor SAW ($V_i$)</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#009846; font-family:monospace;">${parseFloat(skorSaw).toFixed(4)}</div>
                    </div>
                    <div style="background:#ffffff; padding:10px; border-radius:10px; border:1px solid #cbd5e1;">
                        <div style="font-size:0.68rem; color:#64748b; font-weight:700;">Validasi WP ($S_i$)</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#0284c7; font-family:monospace;">${parseFloat(skorWp).toFixed(4)}</div>
                    </div>
                    <div style="background:#ffffff; padding:10px; border-radius:10px; border:1px solid #cbd5e1;">
                        <div style="font-size:0.68rem; color:#64748b; font-weight:700;">Alokasi Bansos</div>
                        <div style="font-size:0.95rem; font-weight:800; color:${isPrioritas ? '#15803d' : '#64748b'};">${isPrioritas ? 'Rp 600.000,-' : 'Rp 0,-'}</div>
                    </div>
                </div>
            </div>

            <!-- RINCIAN SOSIAL EKONOMI -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.8rem; margin-bottom:16px;">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                    <span style="color:#64748b; display:block; font-size:0.72rem;">Nomor Kartu Keluarga (KK):</span>
                    <b style="font-family:monospace; color:#0f172a;">${noKk}</b>
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                    <span style="color:#64748b; display:block; font-size:0.72rem;">Penghasilan Bulanan:</span>
                    <b style="color:#0f172a;">Rp ${penghasilan} / bulan</b>
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                    <span style="color:#64748b; display:block; font-size:0.72rem;">Jumlah Tanggungan:</span>
                    <b style="color:#0f172a;">${tanggungan} Jiwa</b>
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px;">
                    <span style="color:#64748b; display:block; font-size:0.72rem;">Status Verifikasi:</span>
                    <b style="color:#009846;">${statusVerif}</b>
                </div>
            </div>

            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; font-size:0.8rem;">
                <span style="color:#64748b; display:block; font-size:0.72rem;">Alamat Tempat Tinggal:</span>
                <b style="color:#0f172a;"><i class="fas fa-map-marker-alt text-danger"></i> ${alamat}, Desa ${desa}, Kec. ${kec}, Kabupaten Sidoarjo</b>
            </div>
        `;

        if (typeof window.openModal === 'function') {
            window.openModal('modalProfilWargaChat');
        } else {
            const m = document.getElementById('modalProfilWargaChat');
            if (m) m.style.display = 'flex';
        }
    };

    window.salinProfilWargaTxt = function () {
        if (!window.activeChatNik) return;
        const nik = window.activeChatNik;
        const warga = (window.globalDataWarga || []).find(w => String(w.nik) === String(nik));
        const nama = warga ? (warga.nama || warga.nama_lengkap) : (window.activeChatName || 'Warga');
        const desil = warga ? (warga.desil || 1) : 1;
        const text = `DATA PENERIMA BANSOS SIDOARJO:\nNama: ${nama}\nNIK: ${nik}\nDesil: ${desil}\nAlamat: ${warga?.alamat || 'Sidoarjo'}\nStatus: ${desil <= 4 ? 'Prioritas Kuota Rp 600.000,-' : 'Non-Prioritas'}`;

        navigator.clipboard.writeText(text).then(() => {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data profil berhasil disalin', timer: 1500, showConfirmButton: false });
        });
    };

    // =========================================================================
    // INLINE SEARCH CHAT & EKSPOR RIWAYAT
    // =========================================================================
    window.toggleChatInlineSearch = function () {
        const bar = document.getElementById('chatInlineSearchBar');
        if (!bar) return;
        const isHidden = bar.style.display === 'none' || bar.style.display === '';
        bar.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            const inp = document.getElementById('chatSearchMessageInput');
            if (inp) {
                inp.value = '';
                inp.focus();
            }
            window.filterInlineChatMessages();
        }
    };

    window.filterInlineChatMessages = function () {
        const query = (document.getElementById('chatSearchMessageInput')?.value || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#adminChatMessages .chat-msg-row');
        let count = 0;

        rows.forEach(r => {
            const text = (r.innerText || '').toLowerCase();
            if (!query || text.includes(query)) {
                r.style.display = 'flex';
                if (query) count++;
            } else {
                r.style.display = 'none';
            }
        });

        const countEl = document.getElementById('chatSearchCount');
        if (countEl) {
            countEl.innerText = query ? `${count} pesan cocok` : '';
        }
    };

    window.exportRiwayatChatTxt = function () {
        if (!window.activeChatNik) return;
        const rows = document.querySelectorAll('#adminChatMessages .chat-msg-row');
        let transcript = `RIWAYAT PERCAKAPAN MEDIASI BANSOS KABUPATEN SIDOARJO\n`;
        transcript += `Warga: ${window.activeChatName || 'Warga'} (NIK: ${window.activeChatNik})\n`;
        transcript += `Waktu Unduh: ${new Date().toLocaleString('id-ID')}\n`;
        transcript += `------------------------------------------------------------\n\n`;

        rows.forEach(r => {
            const isOutgoing = r.classList.contains('outgoing');
            const sender = isOutgoing ? 'Dinsos Sidoarjo' : (window.activeChatName || 'Warga');
            const time = r.querySelector('.chat-time-stamp')?.innerText || '';
            const text = r.querySelector('.chat-msg-text')?.innerText || r.innerText.replace(time, '').trim();
            transcript += `[${time}] ${sender}: ${text}\n`;
        });

        const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Riwayat_Chat_${window.activeChatNik}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // =========================================================================
    // REPLIES & ATTACHMENTS
    // =========================================================================
    window.prepareReplyMessage = function (id, sender, text) {
        window.activeReplyMessage = { id, sender, text };
        const bar = document.getElementById('adminReplyPreviewBar');
        const sEl = document.getElementById('adminReplySenderName');
        const tEl = document.getElementById('adminReplySnippetText');
        if (bar && sEl && tEl) {
            sEl.innerText = sender;
            tEl.innerText = text.length > 60 ? text.substring(0, 60) + '...' : text;
            bar.style.display = 'flex';
        }
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        document.getElementById('adminChatInput')?.focus();
    };

    window.cancelAdminReply = function () {
        window.activeReplyMessage = null;
        const bar = document.getElementById('adminReplyPreviewBar');
        if (bar) bar.style.display = 'none';
    };

    window.selectedAdminAttachmentFile = null;
    window.handleAdminMediaSelection = function (input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        window.selectedAdminAttachmentFile = file;

        const bar = document.getElementById('adminAttachmentPreviewBar');
        const nameEl = document.getElementById('adminAttachmentFileName');
        const sizeEl = document.getElementById('adminAttachmentFileSize');
        if (bar && nameEl && sizeEl) {
            nameEl.innerText = file.name;
            sizeEl.innerText = `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            bar.style.display = 'flex';
        }
    };

    window.clearAdminAttachment = function () {
        window.selectedAdminAttachmentFile = null;
        const bar = document.getElementById('adminAttachmentPreviewBar');
        if (bar) bar.style.display = 'none';
        const fileInput = document.getElementById('adminMediaFileInput');
        if (fileInput) fileInput.value = '';
    };

    // =========================================================================
    // VOICE NOTE RECORDING ADMIN DENGAN AUDIO VISUAL
    // =========================================================================
    window.toggleAdminVoiceRecord = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');

        try {
            micStreamRef = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            return Swal.fire('Izin Mikrofon', 'Silakan berikan izin mikrofon peramban untuk merekam suara.', 'warning');
        }

        try {
            window.audioChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            window.mediaRecorderObj = mimeType ? new MediaRecorder(micStreamRef, { mimeType }) : new MediaRecorder(micStreamRef);

            window.mediaRecorderObj.ondataavailable = e => {
                if (e.data && e.data.size > 0) window.audioChunks.push(e.data);
            };

            window.mediaRecorderObj.start(250);
            window.voiceDurationSecs = 0;

            const recBar = document.getElementById('adminVoiceRecordingBar');
            const inputBar = document.getElementById('adminChatInputBar');
            if (recBar) recBar.style.display = 'flex';
            if (inputBar) inputBar.style.display = 'none';

            clearInterval(window.voiceTimerInterval);
            window.voiceTimerInterval = setInterval(() => {
                window.voiceDurationSecs++;
                const m = String(Math.floor(window.voiceDurationSecs / 60)).padStart(2, '0');
                const s = String(window.voiceDurationSecs % 60).padStart(2, '0');
                const timerEl = document.getElementById('adminVoiceRecordTimer');
                if (timerEl) timerEl.innerText = `${m}:${s}`;
            }, 1000);
        } catch (err) {
            Swal.fire('Kendala Audio', 'Gagal memproses perekam suara.', 'error');
        }
    };

    window.cancelAdminVoiceRecord = function () {
        if (window.mediaRecorderObj && window.mediaRecorderObj.state !== 'inactive') {
            window.mediaRecorderObj.stop();
        }
        if (micStreamRef) micStreamRef.getTracks().forEach(t => t.stop());
        clearInterval(window.voiceTimerInterval);

        const recBar = document.getElementById('adminVoiceRecordingBar');
        const inputBar = document.getElementById('adminChatInputBar');
        if (recBar) recBar.style.display = 'none';
        if (inputBar) inputBar.style.display = 'flex';
        window.audioChunks = [];
    };

    window.sendAdminVoiceRecord = function () {
        if (!window.mediaRecorderObj || window.audioChunks.length === 0) {
            return window.cancelAdminVoiceRecord();
        }

        window.mediaRecorderObj.onstop = async () => {
            if (micStreamRef) micStreamRef.getTracks().forEach(t => t.stop());
            clearInterval(window.voiceTimerInterval);

            const recBar = document.getElementById('adminVoiceRecordingBar');
            const inputBar = document.getElementById('adminChatInputBar');
            if (recBar) recBar.style.display = 'none';
            if (inputBar) inputBar.style.display = 'flex';

            const audioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.audioChunks = [];

            const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
            const formData = new FormData();
            formData.append('sender', 'petugas');
            formData.append('nama', `Dinsos Sidoarjo (${handler})`);
            formData.append('pesan', 'Pesan Suara (Voice Note)');
            formData.append('custom_file_type', 'audio');
            formData.append('file', audioBlob, `voice_${Date.now()}.webm`);

            try {
                await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                    method: 'POST',
                    body: formData
                });
                window.loadChatMessages(window.activeChatNik, window.activeChatName);
            } catch (err) {}
        };

        window.mediaRecorderObj.stop();
    };

    // =========================================================================
    // EMOJI PICKER POPOVER
    // =========================================================================
    window.toggleAdminEmojiPicker = function (e) {
        if (e) e.stopPropagation();
        const ep = document.getElementById('emojiPickerAdmin');
        if (!ep) return;
        const isShown = ep.style.display === 'block';
        ep.style.display = isShown ? 'none' : 'block';
        if (!isShown) window.renderEmojiPickerGrid();
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
        const senderEl = document.getElementById('replyTargetSender');
        if (senderEl) senderEl.innerText = sender;
        const textEl = document.getElementById('replyTargetText');
        if (textEl) textEl.innerText = text;
        const bannerEl = document.getElementById('replyMessageBanner');
        if (bannerEl) bannerEl.style.display = 'flex';
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        document.getElementById('adminChatInput')?.focus();
    };

    window.cancelReplyMessage = function () {
        window.activeReplyMessage = null;
        const bannerEl = document.getElementById('replyMessageBanner');
        if (bannerEl) bannerEl.style.display = 'none';
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

            const inputEl = document.getElementById('adminChatInput');
            if (inputEl) inputEl.style.display = 'none';

            const micBtn = document.getElementById('btnMicAdmin');
            if (micBtn) micBtn.style.display = 'none';

            const voiceControl = document.getElementById('adminVoiceControlUI');
            if (voiceControl) voiceControl.style.display = 'flex';

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
                
                // Audit Notifikasi Real-Time Pengiriman Rekaman Suara
                if (typeof window.catatAktivitasRealtime === 'function') {
                    window.catatAktivitasRealtime(`Petugas mengirim rekaman suara (Voice Note) ke warga NIK ${window.activeChatNik}.`, 'Petugas', 'chat');
                }

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

        const voiceControl = document.getElementById('adminVoiceControlUI');
        if (voiceControl) voiceControl.style.display = 'none';

        const chatInput = document.getElementById('adminChatInput');
        if (chatInput) chatInput.style.display = 'block';

        const micBtn = document.getElementById('btnMicAdmin');
        if (micBtn) micBtn.style.display = 'block';

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

    window.uploadDirectBlob = async function (blob, fileName) {
        if (!window.activeChatNik) return;
        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', '');
        formData.append('file', blob, fileName);

        try {
            await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                method: 'POST',
                body: formData
            });

            // Audit Notifikasi Real-Time Pengiriman Berkas Media
            if (typeof window.catatAktivitasRealtime === 'function') {
                window.catatAktivitasRealtime(`Petugas mengirim berkas lampiran media (${fileName}) ke warga NIK ${window.activeChatNik}.`, 'Petugas', 'media');
            }

            window.loadChatMessages(window.activeChatNik, window.activeChatName);
            window.loadChatList();
        } catch (err) {
            Swal.fire('Gagal', 'Berkas gagal dikirim.', 'error');
        }
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
        const attachedFile = window.selectedAdminAttachmentFile;

        if (!text && !attachedFile) return;

        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', text);

        if (attachedFile) {
            formData.append('file', attachedFile, attachedFile.name);
            window.clearAdminAttachment();
        }

        if (window.activeReplyMessage) {
            formData.append('reply_sender', window.activeReplyMessage.sender);
            formData.append('reply_text', window.activeReplyMessage.text);
            formData.append('reply_to_id', window.activeReplyMessage.id);
            window.cancelAdminReply();
            window.cancelReplyMessage();
        }

        if (inp) inp.value = '';
        try {
            await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, { method: 'POST', body: formData });
            
            // Audit Notifikasi Real-Time Pengiriman Chat
            if (typeof window.catatAktivitasRealtime === 'function') {
                window.catatAktivitasRealtime(`Petugas membalas pesan obrolan warga NIK ${window.activeChatNik}.`, 'Petugas', 'chat');
            }

            window.loadChatMessages(window.activeChatNik, window.activeChatName);
            window.loadChatList();
        } catch (e) {}
    };

    // Audio Voice Bubble Controllers
    window.toggleVoiceBubblePlay = function (audioId, btn) {
        const audio = document.getElementById(audioId);
        if (!audio) return;
        if (audio.paused) {
            document.querySelectorAll('audio').forEach(a => { if (a.id !== audioId && !a.paused) a.pause(); });
            audio.play().catch(() => {});
            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audio.pause();
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
        }
    };

    window.updateVoiceBubbleTime = function (audioId) {
        const audio = document.getElementById(audioId);
        const durEl = document.getElementById(`dur_${audioId}`);
        const seekEl = document.getElementById(`seek_${audioId}`);
        if (!audio) return;
        if (audio.duration && !isNaN(audio.duration)) {
            const curM = String(Math.floor(audio.currentTime / 60)).padStart(2, '0');
            const curS = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
            const totM = String(Math.floor(audio.duration / 60)).padStart(2, '0');
            const totS = String(Math.floor(audio.duration % 60)).padStart(2, '0');
            if (durEl) durEl.innerText = `${curM}:${curS} / ${totM}:${totS}`;
            if (seekEl) seekEl.value = (audio.currentTime / audio.duration) * 100;
        }
    };

    window.resetVoiceBubblePlay = function (audioId) {
        const seekEl = document.getElementById(`seek_${audioId}`);
        if (seekEl) seekEl.value = 0;
        const btn = document.querySelector(`[onclick*="${audioId}"]`);
        if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
    };

    window.seekVoiceBubble = function (audioId, pct) {
        const audio = document.getElementById(audioId);
        if (audio && audio.duration) {
            audio.currentTime = (pct / 100) * audio.duration;
        }
    };

    window.filterEmojiCategory = function (category) {
        const grid = document.getElementById('emojiGridList');
        if (!grid) return;
        let list = EMOJI_DATABASE;
        if (category === 'senyum') {
            list = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','😎','🤩','🥳'];
        } else if (category === 'reaksi') {
            list = ['👍','👎','👏','🙌','🫶','🤝','🙏','💪','👌','✌️','🤞','🤟','🤙','👊','✊','🫡'];
        } else if (category === 'simbol') {
            list = ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','✨','🎉','🎊','🔥','⭐','🌟','⚡','💥','🚨','⚠️','✅','❌','💯'];
        } else if (category === 'bansos') {
            list = ['📦','🏠','📄','📊','📋','💰','🍚','💳','🏛️','🛡️','👤','👥','📍','📞','✉️','🗓️','🔍','💡'];
        }
        grid.innerHTML = list.map(e => `
            <button type="button" class="emoji-cell-btn" onclick="window.insertEmojiToChat('${e}')">${e}</button>
        `).join('');
    };

    window.renderEmojiPickerGrid = function () {
        const pop = document.getElementById('emojiPickerAdmin');
        if (!pop) return;
        pop.innerHTML = `
            <div style="padding-bottom:6px; margin-bottom:6px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; font-weight:800; color:#334155; text-transform:uppercase;"><i class="far fa-smile text-accent"></i> Pilih Emoji</span>
                <button type="button" onclick="document.getElementById('emojiPickerAdmin').style.display='none'" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>
            </div>
            <div style="display:flex; gap:4px; margin-bottom:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;">
                <button type="button" onclick="window.filterEmojiCategory('semua')" style="background:#f1f5f9; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:700; cursor:pointer; white-space:nowrap;">Semua</button>
                <button type="button" onclick="window.filterEmojiCategory('senyum')" style="background:#f1f5f9; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:700; cursor:pointer; white-space:nowrap;">Wajah 😀</button>
                <button type="button" onclick="window.filterEmojiCategory('reaksi')" style="background:#f1f5f9; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:700; cursor:pointer; white-space:nowrap;">Reaksi 👍</button>
                <button type="button" onclick="window.filterEmojiCategory('simbol')" style="background:#f1f5f9; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:700; cursor:pointer; white-space:nowrap;">Simbol ❤️</button>
                <button type="button" onclick="window.filterEmojiCategory('bansos')" style="background:#f1f5f9; border:none; border-radius:12px; padding:3px 8px; font-size:0.68rem; font-weight:700; cursor:pointer; white-space:nowrap;">Bansos 📦</button>
            </div>
            <div class="emoji-grid-cells" id="emojiGridList" style="max-height:175px; overflow-y:auto; padding-right:2px;"></div>
        `;
        window.filterEmojiCategory('semua');
    };

    window.toggleEmojiPicker = function (e) {
        if (e) e.stopPropagation();
        const ep = document.getElementById('emojiPickerAdmin');
        if (!ep) return;
        const isShown = (ep.style.display === 'block');
        ep.style.display = isShown ? 'none' : 'block';
        if (!isShown) window.renderEmojiPickerGrid();
    };

    window.insertEmojiToChat = function (emoji) {
        const inp = document.getElementById('adminChatInput');
        if (inp) {
            inp.value += emoji;
            inp.focus();
        }
    };

    // =========================================================================
    // 5. WEBRTC CALL DUA ARAH (DENGAN REAKSI EMOJI & AUDIT NOTIFIKASI)
    // =========================================================================
    let activeCallDataConn = null;

    window.initAdminPeer = function () {
        if (peerInstance && !peerInstance.destroyed) return;
        const myPeerId = 'petugas_dinsos_sidoarjo';

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
                const incomingUI = document.getElementById('incomingCallUI');
                if (incomingUI) incomingUI.style.display = 'flex';
                const callerText = document.getElementById('callerNameText');
                if (callerText) callerText.innerText = call.peer.replace('warga_', '').replace('bansos_warga_', 'Warga NIK: ');
                document.getElementById('ringtoneAudio')?.play().catch(() => {});
            });

            peerInstance.on('connection', conn => {
                activeCallDataConn = conn;
                conn.on('data', data => {
                    if (data && data.type === 'reaction') {
                        window.showFloatingReactionEffect(data.emoji);
                    }
                });
            });

            peerInstance.on('error', err => {
                if (err.type === 'unavailable-id') {
                    peerInstance = new Peer('dinsos_admin_sidoarjo');
                }
            });
        } catch (e) {}
    };

    window.startCallWarga = async function (type = 'audio') {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');

        try {
            const isVideo = (type === 'video');
            const nikAktif = window.activeChatNik;

            // Audit Notifikasi Real-Time Panggilan WebRTC
            if (typeof window.catatAktivitasRealtime === 'function') {
                window.catatAktivitasRealtime(`Panggilan ${isVideo ? 'Video Call' : 'Suara'} dimulai dengan warga NIK ${nikAktif}.`, 'Petugas', 'call');
            }

            isCallVideoMuted = !isVideo;
            callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            callLocalStream.getVideoTracks().forEach(t => t.enabled = !isCallVideoMuted);

            const activeUI = document.getElementById('activeCallUI');
            if (activeUI) activeUI.style.display = 'flex';
            const callNameEl = document.getElementById('activeCallName');
            if (callNameEl) callNameEl.innerText = `${window.activeChatName} (${window.activeChatNik})`;
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
                const durationEl = document.getElementById('callDuration');
                if (durationEl) durationEl.innerText = `${mins}:${secs}`;
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

    window.showFloatingReactionEffect = function (emoji) {
        const animArea = document.getElementById('callReactionAnimationArea');
        if (!animArea) return;
        const reactEl = document.createElement('div');
        reactEl.className = 'call-floating-reaction';
        reactEl.innerText = emoji;
        const offset = (Math.random() * 40 - 20);
        reactEl.style.marginLeft = `${offset}px`;
        animArea.appendChild(reactEl);
        setTimeout(() => reactEl.remove(), 2300);
    };

    window.sendCallReaction = function (emoji) {
        window.showFloatingReactionEffect(emoji);
        if (activeCallDataConn && activeCallDataConn.open) {
            activeCallDataConn.send({ type: 'reaction', emoji });
        } else if (peerInstance && window.activeChatNik) {
            try {
                const conn = peerInstance.connect(`warga_${window.activeChatNik}`);
                conn.on('open', () => {
                    conn.send({ type: 'reaction', emoji });
                });
            } catch (e) {}
        }
    };

    window.selesaikanAduanDariChat = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih kontak warga terlebih dahulu.', 'warning');
        
        const { value: catatan } = await Swal.fire({
            title: '<i class="fas fa-check-circle text-success"></i> Selesaikan Laporan Pengaduan',
            html: `
                <div style="font-size:0.88rem; color:#475569; margin-bottom:12px; text-align:left;">
                    Apakah Anda ingin menyelesaikan dan menutup status pengaduan/sengketa warga <b>${window.activeChatName}</b> (NIK: ${window.activeChatNik})?
                </div>
            `,
            input: 'textarea',
            inputPlaceholder: 'Tuliskan catatan hasil mediasi / solusi penyelesaian bagi warga...',
            inputValue: 'Laporan telah diverifikasi dan diselesaikan oleh petugas Dinas Sosial.',
            showCancelButton: true,
            confirmButtonText: 'Tandai Selesai',
            confirmButtonColor: '#009846',
            cancelButtonText: 'Batal'
        });

        if (catatan) {
            try {
                const currentHandler = (window.chatHandlersMap[window.activeChatNik] || localStorage.getItem('username') || 'Admin 1').toUpperCase();
                const res = await fetch(`${BASE_API_URL}/api/investigasi/selesaikan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nik: window.activeChatNik,
                        catatan: catatan,
                        petugas: `Dinsos Sidoarjo (${currentHandler})`
                    })
                });

                if (res.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Laporan Selesai!',
                        text: 'Status laporan berhasil ditutup dan catatan penyelesaian telah dicatat ke warga.',
                        confirmButtonColor: '#009846'
                    });
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                    if (typeof window.loadLaporanChatData === 'function') window.loadLaporanChatData();
                } else {
                    Swal.fire('Informasi', 'Catatan penyelesaian tersimpan.', 'info');
                }
            } catch (e) {
                Swal.fire('Error', 'Gagal memproses penyelesaian laporan.', 'error');
            }
        }
    };

    window.acceptCall = async function () {
        const incomingUI = document.getElementById('incomingCallUI');
        if (incomingUI) incomingUI.style.display = 'none';
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
            const activeUI = document.getElementById('activeCallUI');
            if (activeUI) activeUI.style.display = 'flex';
        } catch (e) {
            window.endCall();
        }
    };

    window.rejectCall = function () {
        const incomingUI = document.getElementById('incomingCallUI');
        if (incomingUI) incomingUI.style.display = 'none';
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
        const activeUI = document.getElementById('activeCallUI');
        if (activeUI) activeUI.style.display = 'none';
        const incomingUI = document.getElementById('incomingCallUI');
        if (incomingUI) incomingUI.style.display = 'none';
        document.getElementById('ringtoneAudio')?.pause();
    };

    window.tutupObrolanAktif = function () {
        window.activeChatNik = null;
        window.activeChatName = null;

        const nameDisplay = document.getElementById('chatActiveNameDisplay');
        if (nameDisplay) {
            nameDisplay.innerText = 'Pilih Warga di Kotak Masuk atau Buku Kontak';
        }

        const infoDisplay = document.getElementById('chatActiveInfoDisplay');
        if (infoDisplay && infoDisplay.style) {
            infoDisplay.style.display = 'none';
        }

        const avatarDisplay = document.getElementById('chatHeaderAvatar');
        if (avatarDisplay && avatarDisplay.style) {
            avatarDisplay.style.display = 'none';
        }

        const actionsDisplay = document.getElementById('chatHeaderActions');
        if (actionsDisplay && actionsDisplay.style) {
            actionsDisplay.style.display = 'none';
        }

        const chatBox = document.getElementById('adminChatMessages');
        if (chatBox) {
            chatBox.innerHTML = '<div style="text-align:center; color:#94a3b8; margin:auto;"><i class="fas fa-comments fa-3x" style="opacity:0.25; margin-bottom:15px;"></i><p style="font-weight:600; font-size:0.95rem;">Pilih salah satu warga di sebelah kiri untuk membuka ruang percakapan.</p></div>';
        }

        const emptyState = document.getElementById('chatEmptyState') || 
                           document.getElementById('emptyChatState') || 
                           document.querySelector('.chat-empty-state');
        if (emptyState && emptyState.style) {
            emptyState.style.display = 'flex';
        }

        const activeConv = document.getElementById('chatActiveConversation') || 
                           document.getElementById('activeConversation') || 
                           document.querySelector('.chat-conversation-area');
        if (activeConv && activeConv.style) {
            activeConv.style.display = 'none';
        }

        const headerEl = document.getElementById('chatConversationHeader') || document.querySelector('.chat-header-info');
        if (headerEl && headerEl.style) {
            headerEl.style.display = 'none';
        }
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
            const msgBox = document.getElementById('adminChatMessages');
            if (msgBox) msgBox.innerHTML = '';
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
                    role_sender: n.role_sender,
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
            const rawPesan = n.text || n.pesan || '';
            let roleBadgeText = (n.role_sender || 'SISTEM').toUpperCase();
            let badgeStyle = 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;';
            let cleanText = rawPesan;

            // Ekstraksi Tag Awalan Presisi Menggunakan Regex yang Telah Diperbaiki Bebas Artefak
            const tagMatch = rawPesan.match(/^\[(Admin\vert{}Petugas\vert{}Operator\vert{}Warga\vert{}Sistem\vert{}Urgent\vert{}Keamanan)\]\s*/i);
            if (tagMatch) {
                const tag = tagMatch[1].toUpperCase();
                roleBadgeText = (tag === 'OPERATOR') ? 'PETUGAS' : tag;
                cleanText = rawPesan.replace(/^\[(Admin\vert{}Petugas\vert{}Operator\vert{}Warga\vert{}Sistem\vert{}Urgent\vert{}Keamanan)\]\s*/i, '').trim();
            }

            // Terapkan Palet Warna Berdasarkan Peran Sebenarnya
            if (roleBadgeText === 'ADMIN') {
                badgeStyle = 'background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;';
            } else if (roleBadgeText === 'PETUGAS') {
                badgeStyle = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;';
            } else if (roleBadgeText === 'WARGA') {
                badgeStyle = 'background:#fef3c7; color:#b45309; border:1px solid #fde68a;';
            } else if (roleBadgeText === 'URGENT' || rawPesan.includes('🚨') || rawPesan.toLowerCase().includes('sengketa')) {
                roleBadgeText = 'URGENT';
                badgeStyle = 'background:#fee2e2; color:#dc2626; border:1px solid #fecaca;';
            } else {
                roleBadgeText = 'SISTEM';
                badgeStyle = 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;';
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
                            <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${n.time || n.waktu || 'Hari ini'}</span>
                            <button type="button" onclick="window.togglePinNotification(${n.id}, event)" style="background: none; border: none; color: ${n.pinned || n.is_pinned ? '#d97706' : '#94a3b8'}; cursor: pointer; padding: 2px 4px;" title="Sematkan">
                                <i class="fas fa-thumbtack"></i>
                            </button>
                            <button type="button" onclick="window.toggleArchiveNotification(${n.id}, event)" style="background: none; border: none; color: ${n.archived || n.is_archived ? '#0284c7' : '#94a3b8'}; cursor: pointer; padding: 2px 4px;" title="Arsipkan">
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
        const box = document.getElementById('mediaLightbox');
        const content = document.getElementById('lightboxContent');
        if (!box || !content) return;
        box.style.display = 'flex';
        content.innerHTML = type === 'image' 
            ? `<img src="${url}" style="max-width:90vw; max-height:85vh; border-radius:12px;" />` 
            : `<video src="${url}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:12px;"></video>`;
    };

    window.closeLightbox = function (e) {
        if (e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
            const box = document.getElementById('mediaLightbox');
            if (box) box.style.display = 'none';
        }
    };

    // =========================================================================
    // FITUR LAPORAN PELANGGARAN PESAN DARI PETUGAS / ADMIN
    // =========================================================================
    window.laporkanPesanChat = async function (msgId, senderName, rawText) {
        document.querySelectorAll('.bubble-action-dropdown').forEach(d => d.classList.remove('show'));

        const cleanSnippet = (rawText || 'Media lampiran').replace(/\[GEOTAG_LOKASI\].*/g, 'Lokasi Geotagging Warga');

        const { value: formValues } = await Swal.fire({
            title: '<i class="fas fa-flag text-danger"></i> Laporkan Pesan Pelanggaran',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155;">
                    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:10px 14px; margin-bottom:14px;">
                        <div style="font-size:0.75rem; font-weight:800; color:#dc2626; margin-bottom:2px;">
                            <i class="fas fa-quote-left"></i> Pihak Terlapor: <b>${window.safeHtml(senderName || 'Warga')}</b>
                        </div>
                        <div style="font-size:0.82rem; color:#1e293b; font-style:italic; max-height:80px; overflow-y:auto;">
                            "${window.safeHtml(cleanSnippet.slice(0, 150))}${cleanSnippet.length > 150 ? '...' : ''}"
                        </div>
                    </div>

                    <label style="font-weight:700; display:block; margin-bottom:6px;">Kategori Pelanggaran:</label>
                    <select id="swalLaporKategori" class="form-select" style="width:100%; border-radius:10px; padding:8px 12px; margin-bottom:12px; border:1px solid #cbd5e1; font-size:0.85rem;">
                        <option value="Kata-kata Kasar / Pelecehan">Kata-kata Kasar / Pelecehan / Hinaan</option>
                        <option value="Pungutan Liar (Pungli)">Pungutan Liar (Pungli) / Permintaan Imbalan</option>
                        <option value="Ancaman & Intimidasi">Ancaman, Intimidasi & Pemerasan</option>
                        <option value="Penyebaran Hoaks / Informasi Palsu">Penyebaran Berita Palsu / Hoaks Bansos</option>
                        <option value="Pelanggaran Kode Etik Petugas">Pelanggaran Standar Operasional / Kode Etik</option>
                        <option value="Spam / Iklan Ilegal">Spam / Penipuan Berulang</option>
                        <option value="Lainnya">Lainnya</option>
                    </select>

                    <label style="font-weight:700; display:block; margin-bottom:6px;">Uraian & Bukti Tambahan:</label>
                    <textarea id="swalLaporDeskripsi" class="form-input" rows="3" placeholder="Tuliskan catatan rinci mengapa pesan ini dilaporkan melanggar..." style="width:100%; border-radius:10px; border:1px solid #cbd5e1; padding:8px 12px; font-size:0.85rem; resize:vertical; outline:none;"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Kirim Laporan Pelanggaran',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Batal',
            cancelButtonColor: '#64748b',
            focusConfirm: false,
            preConfirm: () => {
                const kategori = document.getElementById('swalLaporKategori')?.value || 'Kata-kata Kasar / Pelecehan';
                const deskripsi = document.getElementById('swalLaporDeskripsi')?.value.trim() || kategori;
                return { kategori, deskripsi };
            }
        });

        if (formValues) {
            try {
                const res = await apiCall('/api/chat/lapor-pesan', {
                    method: 'POST',
                    body: JSON.stringify({
                        msg_id: parseInt(msgId, 10) || 0,
                        nik: window.activeChatNik || '',
                        nama_terlapor: senderName,
                        sender_terlapor: senderName.toLowerCase().includes('petugas') ? 'petugas' : 'warga',
                        pesan: cleanSnippet,
                        alasan: formValues.kategori,
                        kategori: formValues.kategori,
                        deskripsi: formValues.deskripsi,
                        pelapor_role: 'admin',
                        pelapor_nama: 'Administrator Dinsos Sidoarjo',
                        pelapor_nik: 'ADMIN-01'
                    })
                });

                if (res && res.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Laporan Diterima',
                        text: `Pesan berhasil dilaporkan ke Pusat Moderasi & Pengawasan (${res.data?.kode_laporan || 'Tercatat'}).`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                    if (typeof window.updateViolationBadgeCount === 'function') {
                        window.updateViolationBadgeCount();
                    }
                } else {
                    Swal.fire('Gagal', res?.message || 'Gagal mengirim laporan pelanggaran.', 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Terjadi kesalahan sistem saat memproses laporan.', 'error');
            }
        }
    };

    // =========================================================================
    // FITUR TARIK LOKASI GEOTAGGING RESMI ARSIP WARGA
    // =========================================================================
    window.tarikLokasiGeotagWarga = async function () {
        if (!window.activeChatNik) {
            Swal.fire('Pilih Obrolan', 'Pilih obrolan warga aktif terlebih dahulu di panel kiri.', 'warning');
            return;
        }

        try {
            const res = await apiCall(`/api/chat/geotag/${window.activeChatNik}`);
            if (!res || res.status !== 'success' || !res.data) {
                Swal.fire('Data Belum Ada', 'Data arsip geotagging belum ditemukan untuk NIK ini.', 'info');
                return;
            }

            const geo = res.data;
            const lat = Number(geo.lat) || -7.4478;
            const lng = Number(geo.lng) || 112.7183;

            const { isConfirmed } = await Swal.fire({
                title: '<i class="fas fa-map-marked-alt text-primary"></i> Tarik Lokasi Arsip Warga',
                html: `
                    <div style="text-align:left; font-size:0.86rem; color:#334155;">
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; padding:12px 14px; margin-bottom:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span style="font-weight:800; color:#0369a1; font-size:0.92rem;">${window.safeHtml(geo.nama)}</span>
                                <span style="background:#dcfce7; color:#15803d; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:12px;">
                                    <i class="fas fa-check-circle"></i> Geotag Valid
                                </span>
                            </div>
                            <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-bottom:4px;">NIK: ${geo.nik}</div>
                            <div style="font-size:0.8rem; color:#334155; margin-bottom:8px;">
                                <i class="fas fa-home text-primary"></i> ${window.safeHtml(geo.alamat)}
                            </div>
                            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:6px 10px; font-family:monospace; font-size:0.76rem; color:#0284c7; font-weight:700;">
                                📍 Koordinat: Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}
                            </div>
                        </div>
                        <p style="margin:0; font-size:0.8rem; color:#64748b;">
                            Bagikan kartu koordinat peta resmi ini langsung ke ruang percakapan dengan warga agar mempermudah navigasi peninjauan dan penyaluran lapangan.
                        </p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim ke Obrolan',
                confirmButtonColor: '#009846',
                cancelButtonText: 'Batal',
                cancelButtonColor: '#64748b'
            });

            if (isConfirmed) {
                const sendRes = await apiCall('/api/chat/share-geotag', {
                    method: 'POST',
                    body: JSON.stringify({
                        nik: window.activeChatNik,
                        sender: 'petugas',
                        nama: 'Petugas Dinsos Sidoarjo'
                    })
                });

                if (sendRes && sendRes.status === 'success') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: '📍 Lokasi geotagging arsip berhasil dikirim!',
                        timer: 2500,
                        showConfirmButton: false
                    });
                    if (typeof window.loadChatMessages === 'function') {
                        window.loadChatMessages(window.activeChatNik);
                    }
                } else {
                    Swal.fire('Gagal', 'Gagal membagikan lokasi geotagging.', 'error');
                }
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan sistem saat mengambil data geotagging.', 'error');
        }
    };

    // =========================================================================
    // FITUR REKAPITULASI LAPORAN PELANGGARAN KESELURUHAN (MODERASI DASHBOARD)
    // =========================================================================
    window.allViolationReportsCache = [];
    window.activeViolationFilter = 'semua';

    window.updateViolationBadgeCount = async function () {
        try {
            const res = await apiCall('/api/chat/laporan-pelanggaran');
            if (res && res.stats) {
                const pendingCount = res.stats.pending || 0;
                const badges = [
                    document.getElementById('headerViolationCountBadge'),
                    document.getElementById('adminViolationBadge'),
                    document.getElementById('sideViolationBadge')
                ];
                badges.forEach(b => {
                    if (b) {
                        b.innerText = pendingCount;
                        b.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                    }
                });
            }
        } catch (e) {}
    };

    window.bukaModalLaporanPelanggaranKeseluruhan = async function () {
        let modal = document.getElementById('modalLaporanPelanggaranKeseluruhan');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalLaporanPelanggaranKeseluruhan';
            modal.className = 'modal-blur-overlay';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); backdrop-filter:blur(10px); z-index:9999999; display:flex; justify-content:center; align-items:center; padding:16px; box-sizing:border-box;';
            modal.innerHTML = `
                <div class="card" style="width:96%; max-width:960px; max-height:92vh; background:#ffffff; border-radius:22px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(15,23,42,0.35); border:1.5px solid #cbd5e1;">
                    <div style="background:linear-gradient(135deg, #ffffff, #fef2f2); padding:16px 22px; border-bottom:1.5px solid #fecaca; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #dc2626, #b91c1c); color:white; display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <div style="font-size:1.15rem; font-weight:800; color:#0f172a;">Pusat Moderasi & Rekapitulasi Pelanggaran Seluruh Chat</div>
                                <div style="font-size:0.75rem; color:#dc2626; font-weight:700;">Pengawasan Etik Komunikasi Warga & Petugas Dinas Sosial Sidoarjo</div>
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('modalLaporanPelanggaranKeseluruhan').style.display='none'" style="background:#ffffff; border:1px solid #cbd5e1; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:1.1rem; color:#64748b; display:flex; align-items:center; justify-content:center;">&times;</button>
                    </div>

                    <div style="padding:16px 22px; overflow-y:auto; flex:1;">
                        <!-- METRIC SUMMARY CARDS -->
                        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:16px;" id="violationStatsContainer">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px 14px; text-align:center;">
                                <div style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase;">Total Laporan</div>
                                <div id="violStatTotal" style="font-size:1.6rem; font-weight:800; color:#0f172a;">0</div>
                            </div>
                            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:14px; padding:12px 14px; text-align:center;">
                                <div style="font-size:0.72rem; color:#dc2626; font-weight:700; text-transform:uppercase;">Menunggu Tindakan</div>
                                <div id="violStatPending" style="font-size:1.6rem; font-weight:800; color:#dc2626;">0</div>
                            </div>
                            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:14px; padding:12px 14px; text-align:center;">
                                <div style="font-size:0.72rem; color:#b45309; font-weight:700; text-transform:uppercase;">Terbukti Melanggar</div>
                                <div id="violStatTerbukti" style="font-size:1.6rem; font-weight:800; color:#b45309;">0</div>
                            </div>
                            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px; padding:12px 14px; text-align:center;">
                                <div style="font-size:0.72rem; color:#059669; font-weight:700; text-transform:uppercase;">Selesai Ditangani</div>
                                <div id="violStatSelesai" style="font-size:1.6rem; font-weight:800; color:#059669;">0</div>
                            </div>
                        </div>

                        <!-- FILTER & SEARCH BAR -->
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
                            <div style="display:flex; gap:6px;">
                                <button type="button" class="btn btn-sm btn-viol-filter active" onclick="window.filterLaporanPelanggaran('semua', this)" style="border-radius:10px; font-weight:700; font-size:0.78rem; padding:6px 12px; background:#dc2626; color:#ffffff; border:none;">Semua</button>
                                <button type="button" class="btn btn-sm btn-viol-filter" onclick="window.filterLaporanPelanggaran('menunggu', this)" style="border-radius:10px; font-weight:700; font-size:0.78rem; padding:6px 12px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1;">Menunggu</button>
                                <button type="button" class="btn btn-sm btn-viol-filter" onclick="window.filterLaporanPelanggaran('terbukti', this)" style="border-radius:10px; font-weight:700; font-size:0.78rem; padding:6px 12px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1;">Terbukti</button>
                                <button type="button" class="btn btn-sm btn-viol-filter" onclick="window.filterLaporanPelanggaran('selesai', this)" style="border-radius:10px; font-weight:700; font-size:0.78rem; padding:6px 12px; background:#f8fafc; color:#64748b; border:1px solid #cbd5e1;">Selesai</button>
                            </div>
                            <div style="flex:1; max-width:320px; position:relative;">
                                <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:0.8rem;"></i>
                                <input type="text" id="inputSearchViolations" placeholder="Cari nama, NIK, kode, atau alasan..." onkeyup="window.cariLaporanPelanggaran(this.value)" style="width:100%; border:1px solid #cbd5e1; border-radius:20px; padding:6px 12px 6px 32px; font-size:0.82rem; outline:none;">
                            </div>
                        </div>

                        <!-- TABEL LAPORAN PELANGGARAN -->
                        <div style="border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; background:#ffffff;">
                            <table class="modern-table" style="width:100%; margin:0; font-size:0.82rem;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:10px 12px;">Kode & Waktu</th>
                                        <th style="padding:10px 12px;">Pihak Terlapor</th>
                                        <th style="padding:10px 12px;">Pelapor</th>
                                        <th style="padding:10px 12px;">Kutipan Pesan Melanggar</th>
                                        <th style="padding:10px 12px;">Kategori & Status</th>
                                        <th style="padding:10px 12px; text-align:center;">Aksi Moderasi</th>
                                    </tr>
                                </thead>
                                <tbody id="tableBodyViolations">
                                    <tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Memuat berkas laporan pelanggaran...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="padding:12px 22px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.75rem; color:#64748b;">
                            <i class="fas fa-info-circle"></i> Setiap tindakan moderasi tercatat dalam audit log sistem integritas Dinsos Sidoarjo.
                        </span>
                        <button type="button" onclick="document.getElementById('modalLaporanPelanggaranKeseluruhan').style.display='none'" class="btn btn-secondary" style="border-radius:10px; font-weight:700; font-size:0.82rem;">Tutup</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';

        try {
            const res = await apiCall('/api/chat/laporan-pelanggaran');
            if (res && res.status === 'success') {
                window.allViolationReportsCache = res.data || [];
                const stats = res.stats || {};
                const tEl = document.getElementById('violStatTotal');
                const pEl = document.getElementById('violStatPending');
                const tbEl = document.getElementById('violStatTerbukti');
                const sEl = document.getElementById('violStatSelesai');
                if (tEl) tEl.innerText = stats.total || 0;
                if (pEl) pEl.innerText = stats.pending || 0;
                if (tbEl) tbEl.innerText = stats.terbukti || 0;
                if (sEl) sEl.innerText = stats.selesai || 0;

                window.renderTabelPelanggaran(window.allViolationReportsCache);
            }
        } catch (e) {
            const tbody = document.getElementById('tableBodyViolations');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">Gagal mengambil daftar pelanggaran.</td></tr>';
        }
    };

    window.renderTabelPelanggaran = function (list) {
        const tbody = document.getElementById('tableBodyViolations');
        if (!tbody) return;

        if (!list || list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Tidak ada data laporan pelanggaran yang sesuai filter.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(item => {
            let statusBadge = '';
            if (item.status === 'Menunggu Peninjauan') statusBadge = '<span class="badge bg-danger" style="font-size:0.7rem;">Menunggu</span>';
            else if (item.status === 'Dalam Investigasi') statusBadge = '<span class="badge bg-warning text-dark" style="font-size:0.7rem;">Investigasi</span>';
            else if (item.status === 'Terbukti Melanggar') statusBadge = '<span class="badge" style="background:#b91c1c; color:white; font-size:0.7rem;">Terbukti</span>';
            else if (item.status === 'Ditolak/Bukan Pelanggaran') statusBadge = '<span class="badge bg-secondary" style="font-size:0.7rem;">Ditolak</span>';
            else statusBadge = '<span class="badge bg-success" style="font-size:0.7rem;">Selesai</span>';

            const terlaporRoleBadge = item.sender_terlapor === 'petugas' ? '<span style="color:#0284c7; font-size:0.68rem; font-weight:700;"><i class="fas fa-shield-alt"></i> Petugas</span>' : '<span style="color:#059669; font-size:0.68rem; font-weight:700;"><i class="fas fa-user"></i> Warga</span>';

            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 12px;">
                        <b style="color:#0f172a; font-family:monospace;">${item.kode_laporan}</b>
                        <div style="font-size:0.7rem; color:#64748b;">${item.waktu || item.created_at || '-'}</div>
                    </td>
                    <td style="padding:10px 12px;">
                        <div style="font-weight:700; color:#0f172a;">${window.safeHtml(item.nama_terlapor || '-')}</div>
                        ${terlaporRoleBadge}
                        ${item.nik ? `<div style="font-size:0.68rem; color:#64748b; font-family:monospace;">NIK: ${item.nik}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px;">
                        <div style="font-weight:600; color:#334155;">${window.safeHtml(item.pelapor_nama || '-')}</div>
                        <small style="color:#64748b; text-transform:capitalize;">(${item.pelapor_role})</small>
                    </td>
                    <td style="padding:10px 12px; max-width:240px;">
                        <div style="font-style:italic; color:#475569; line-height:1.35; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                            "${window.safeHtml(item.pesan_kutipan || '-')}"
                        </div>
                        <div style="font-size:0.7rem; color:#dc2626; margin-top:2px;"><b>Alasan:</b> ${window.safeHtml(item.alasan || '-')}</div>
                    </td>
                    <td style="padding:10px 12px;">
                        <div style="font-weight:700; font-size:0.75rem; color:#0f172a; margin-bottom:3px;">${item.kategori || '-'}</div>
                        ${statusBadge}
                        ${item.tindakan_petugas ? `<div style="font-size:0.68rem; color:#059669; margin-top:3px;"><i class="fas fa-check"></i> ${window.safeHtml(item.tindakan_petugas)}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px; text-align:center; white-space:nowrap;">
                        <button type="button" onclick="window.tindakLanjutiPelanggaran(${item.id}, '${item.kode_laporan}')" class="btn btn-sm" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; font-weight:700; border-radius:8px; padding:4px 8px; font-size:0.74rem; margin-right:4px;" title="Ambil Tindakan Moderasi">
                            <i class="fas fa-gavel"></i> Tindak
                        </button>
                        ${item.nik ? `
                        <button type="button" onclick="document.getElementById('modalLaporanPelanggaranKeseluruhan').style.display='none'; window.loadChatMessages('${item.nik}', '${window.escapeInlineJS(item.nama_terlapor || 'Warga')}')" class="btn btn-sm" style="background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd; font-weight:700; border-radius:8px; padding:4px 8px; font-size:0.74rem;" title="Buka Ruang Obrolan">
                            <i class="fas fa-comments"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    };

    window.filterLaporanPelanggaran = function (status, btn) {
        window.activeViolationFilter = status;
        document.querySelectorAll('.btn-viol-filter').forEach(b => {
            b.style.background = '#f8fafc';
            b.style.color = '#64748b';
            b.style.border = '1px solid #cbd5e1';
        });
        if (btn) {
            btn.style.background = '#dc2626';
            btn.style.color = '#ffffff';
            btn.style.border = 'none';
        }

        let list = window.allViolationReportsCache || [];
        if (status === 'menunggu') {
            list = list.filter(l => l.status === 'Menunggu Peninjauan' || l.status === 'Dalam Investigasi');
        } else if (status === 'terbukti') {
            list = list.filter(l => l.status === 'Terbukti Melanggar');
        } else if (status === 'selesai') {
            list = list.filter(l => l.status === 'Selesai Ditangani' || l.status === 'Ditolak/Bukan Pelanggaran');
        }
        window.renderTabelPelanggaran(list);
    };

    window.cariLaporanPelanggaran = function (q) {
        const query = (q || '').toLowerCase().trim();
        let list = window.allViolationReportsCache || [];
        if (query) {
            list = list.filter(l => 
                String(l.kode_laporan || '').toLowerCase().includes(query) ||
                String(l.nama_terlapor || '').toLowerCase().includes(query) ||
                String(l.pelapor_nama || '').toLowerCase().includes(query) ||
                String(l.nik || '').includes(query) ||
                String(l.alasan || '').toLowerCase().includes(query) ||
                String(l.pesan_kutipan || '').toLowerCase().includes(query)
            );
        }
        window.renderTabelPelanggaran(list);
    };

    window.tindakLanjutiPelanggaran = async function (id, kode) {
        const item = (window.allViolationReportsCache || []).find(l => l.id === id);
        if (!item) return;

        const { value: formVals } = await Swal.fire({
            title: `<i class="fas fa-gavel text-danger"></i> Moderasi: ${kode}`,
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:12px;">
                        <div><b>Terlapor:</b> ${window.safeHtml(item.nama_terlapor)} (${item.sender_terlapor})</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;"><b>Alasan:</b> ${window.safeHtml(item.alasan)}</div>
                        <div style="font-size:0.78rem; font-style:italic; color:#475569; margin-top:4px;">"${window.safeHtml(item.pesan_kutipan || '')}"</div>
                    </div>

                    <label style="font-weight:700; display:block; margin-bottom:6px;">Putusan & Status Tindak Lanjut:</label>
                    <select id="swalTindakStatus" class="form-select" style="width:100%; border-radius:10px; padding:8px 12px; margin-bottom:12px; border:1px solid #cbd5e1; font-size:0.85rem;">
                        <option value="Terbukti Melanggar" selected>Terbukti Melanggar - Berikan Teguran & Sanksi</option>
                        <option value="Dalam Investigasi">Dalam Investigasi Lanjutan (Verifikasi Bukti)</option>
                        <option value="Selesai Ditangani">Selesai Ditangani & Ditutup</option>
                        <option value="Ditolak/Bukan Pelanggaran">Ditolak - Bukan Merupakan Pelanggaran</option>
                    </select>

                    <label style="font-weight:700; display:block; margin-bottom:6px;">Catatan Tindakan Resmi Petugas:</label>
                    <textarea id="swalTindakCatatan" class="form-input" rows="3" placeholder="Tuliskan putusan, peringatan, atau tindakan pembinaan yang diambil..." style="width:100%; border-radius:10px; border:1px solid #cbd5e1; padding:8px 12px; font-size:0.85rem; outline:none; resize:vertical;">Peringatan resmi diberikan kepada pihak terkait; catatan dimasukkan dalam berkas kepatuhan.</textarea>

                    <div style="margin-top:12px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="swalHapusPesan" style="width:16px; height:16px; cursor:pointer;" checked>
                        <label for="swalHapusPesan" style="font-size:0.82rem; font-weight:700; color:#dc2626; cursor:pointer;">
                            Hapus & Sensor pesan melanggar ini dari riwayat percakapan obrolan
                        </label>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Simpan Putusan Moderasi',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Batal',
            cancelButtonColor: '#64748b',
            preConfirm: () => {
                const status = document.getElementById('swalTindakStatus')?.value || 'Terbukti Melanggar';
                const tindakan = document.getElementById('swalTindakCatatan')?.value.trim() || 'Teguran resmi diberikan.';
                const hapus_pesan = document.getElementById('swalHapusPesan')?.checked || false;
                return { status, tindakan, hapus_pesan };
            }
        });

        if (formVals) {
            try {
                const res = await apiCall(`/api/chat/laporan-pelanggaran/${id}/tindak`, {
                    method: 'POST',
                    body: JSON.stringify({
                        status: formVals.status,
                        tindakan: formVals.tindakan,
                        hapus_pesan: formVals.hapus_pesan,
                        petugas: 'Administrator Utama (Super Admin)'
                    })
                });

                if (res && res.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Tindakan Disimpan',
                        text: `Status laporan ${kode} berhasil diperbarui menjadi "${formVals.status}".`,
                        timer: 2500,
                        showConfirmButton: false
                    });
                    await window.bukaModalLaporanPelanggaranKeseluruhan();
                    window.updateViolationBadgeCount();
                    if (window.activeChatNik && typeof window.loadChatMessages === 'function') {
                        window.loadChatMessages(window.activeChatNik);
                    }
                } else {
                    Swal.fire('Gagal', res?.message || 'Gagal menyimpan tindak lanjut.', 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Terjadi kesalahan sistem saat memproses moderasi.', 'error');
            }
        }
    };

    // Panggil penghitungan badge pelanggaran saat startup
    setTimeout(() => {
        if (typeof window.updateViolationBadgeCount === 'function') {
            window.updateViolationBadgeCount();
        }
    }, 1500);

})(window);