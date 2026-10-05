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
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const parentBubble = btn.closest('.chat-msg-bubble');
        if (!parentBubble) return;
        const dropdown = parentBubble.querySelector('.bubble-action-dropdown');
        if (!dropdown) return;

        const isShown = dropdown.classList.contains('show');
        document.querySelectorAll('.bubble-action-dropdown, .chat-dropdown-content').forEach(d => {
            d.classList.remove('show');
            d.closest('.chat-msg-bubble')?.querySelector('.bubble-corner-btn')?.classList.remove('active');
        });

        if (!isShown) {
            // Cek apakah posisi dekat dengan batas bawah container agar dropdown membuka ke atas
            const bubbleRect = parentBubble.getBoundingClientRect();
            const container = document.getElementById('adminChatMessages');
            if (container) {
                const contRect = container.getBoundingClientRect();
                if (bubbleRect.bottom + 185 > contRect.bottom && bubbleRect.top - 185 > contRect.top) {
                    dropdown.style.top = 'auto';
                    dropdown.style.bottom = '26px';
                } else {
                    dropdown.style.top = '26px';
                    dropdown.style.bottom = 'auto';
                }
            }
            dropdown.classList.add('show');
            btn.classList.add('active');
        }
    };

    // =========================================================================
    // =========================================================================
    // HELPER DOWNLOAD LANGSUNG BERKAS DOKUMEN & UKURAN BERKAS
    // =========================================================================
    window.downloadDocumentDirect = async function (url, fileName, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const safeName = fileName || (url ? url.split('/').pop() : 'dokumen') || 'dokumen_bansos';
        const fileParam = url ? url.split('/').pop() : safeName;
        const serverDlUrl = `${BASE_API_URL}/api/chat/download/${fileParam}?name=${encodeURIComponent(safeName)}`;

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
            // Gunakan Blob fetch agar browser langsung mengunduh berkas (terutama PDF/Word/Excel) ke folder Downloads komputer/HP
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Fetch status ' + resp.status);
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
            // Fallback via server download header attachment atau direct link
            const a = document.createElement('a');
            a.href = serverDlUrl;
            a.download = safeName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    window.formatBytes = function (bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    window.clearAdminAttachment = function () {
        window.selectedAdminAttachmentFile = null;
        const bar = document.getElementById('adminAttachmentPreviewBar');
        if (bar) bar.style.display = 'none';
    };

    window.setAdminAttachmentFile = function (file) {
        if (!file) return;
        window.selectedAdminAttachmentFile = file;
        const bar = document.getElementById('adminAttachmentPreviewBar');
        const nameEl = document.getElementById('adminAttachmentFileName');
        const sizeEl = document.getElementById('adminAttachmentFileSize');
        if (nameEl) nameEl.innerText = file.name;
        if (sizeEl) sizeEl.innerText = `(${window.formatBytes(file.size)})`;
        if (bar) bar.style.display = 'flex';
    };

    // =========================================================================
    // KONTROL PEMUTAR SUARA MODERN (VOICE NOTE SPEED 0.5x, 1x, 1.5x, 2x & FREKUENSI)
    // =========================================================================
    const VOICE_SPEED_PRESETS = [1, 1.5, 2, 0.5];

    function formatTimeSeconds(seconds) {
        if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    window.initVoiceBubbleMeta = function (audioId) {
        const aud = document.getElementById(audioId);
        const durEl = document.getElementById(`dur_${audioId}`);
        if (!aud) return;

        // Fix untuk rekaman WebM yang duration-nya bernilai Infinity
        if (aud.duration === Infinity || !isFinite(aud.duration)) {
            aud.currentTime = 1e101;
            aud.ontimeupdate = function () {
                this.ontimeupdate = () => window.updateVoiceBubbleTime(audioId);
                aud.currentTime = 0;
                if (durEl && isFinite(aud.duration) && aud.duration > 0) {
                    durEl.innerText = formatTimeSeconds(aud.duration);
                }
            };
        } else if (durEl && aud.duration && isFinite(aud.duration) && aud.duration > 0) {
            durEl.innerText = formatTimeSeconds(aud.duration);
        }
    };

    window.updateVoiceBubbleTime = function (audioId) {
        const aud = document.getElementById(audioId);
        const durEl = document.getElementById(`dur_${audioId}`);
        const freqBox = document.getElementById(`freq_box_${audioId}`);
        if (!aud) return;

        let dur = aud.duration;
        if (!dur || !isFinite(dur) || isNaN(dur)) {
            dur = aud.currentTime > 0 ? aud.currentTime : 0;
        }
        const cur = aud.currentTime || 0;
        if (durEl) {
            if (dur > 0) {
                durEl.innerText = `${formatTimeSeconds(cur)} / ${formatTimeSeconds(dur)}`;
            } else {
                durEl.innerText = formatTimeSeconds(cur);
            }
        }

        if (freqBox && dur > 0) {
            const ratio = Math.min(1, Math.max(0, cur / dur));
            const bars = freqBox.querySelectorAll('.voice-freq-bar');
            const activeIndex = Math.floor(ratio * bars.length);
            const isOutgoing = freqBox.closest('.outgoing') !== null;
            bars.forEach((bar, idx) => {
                if (idx <= activeIndex) {
                    bar.classList.add('played');
                    bar.style.opacity = '1';
                    bar.style.background = isOutgoing ? '#ffffff' : '#009846';
                } else {
                    bar.classList.remove('played');
                    bar.style.opacity = isOutgoing ? '0.5' : '0.45';
                    bar.style.background = isOutgoing ? 'rgba(255, 255, 255, 0.45)' : '#94a3b8';
                }
            });
        }
    };

    window.toggleVoiceBubblePlay = function (audioId, btn) {
        const aud = document.getElementById(audioId);
        if (!aud) return;

        const iconEl = btn ? btn.querySelector('i') : document.querySelector(`#btn_play_${audioId} i`);
        const freqBox = document.getElementById(`freq_box_${audioId}`);

        // Jika audio sedang berputar -> jeda
        if (!aud.paused) {
            aud.pause();
            if (iconEl) iconEl.className = 'fas fa-play';
            if (btn) btn.classList.remove('playing');
            if (freqBox) freqBox.classList.remove('playing');
            return;
        }

        // Hentikan audio dan video lain yang sedang memutar di chat
        document.querySelectorAll('audio, video').forEach(media => {
            if (media.id !== audioId && !media.paused) {
                media.pause();
                const otherBtn = document.getElementById(`btn_play_${media.id}`);
                if (otherBtn) {
                    otherBtn.classList.remove('playing');
                    const icon = otherBtn.querySelector('i');
                    if (icon) icon.className = 'fas fa-play';
                }
                const otherFreq = document.getElementById(`freq_box_${media.id}`);
                if (otherFreq) otherFreq.classList.remove('playing');
            }
        });

        aud.play().then(() => {
            if (iconEl) iconEl.className = 'fas fa-pause';
            if (btn) btn.classList.add('playing');
            if (freqBox) freqBox.classList.add('playing');
        }).catch(() => {});
    };

    window.resetVoiceBubblePlay = function (audioId) {
        const aud = document.getElementById(audioId);
        const btn = document.getElementById(`btn_play_${audioId}`);
        const iconEl = btn ? btn.querySelector('i') : null;
        const freqBox = document.getElementById(`freq_box_${audioId}`);
        const durEl = document.getElementById(`dur_${audioId}`);

        if (aud) {
            aud.currentTime = 0;
            if (durEl && aud.duration && isFinite(aud.duration)) {
                durEl.innerText = formatTimeSeconds(aud.duration);
            }
        }
        if (iconEl) iconEl.className = 'fas fa-play';
        if (btn) btn.classList.remove('playing');
        if (freqBox) {
            freqBox.classList.remove('playing');
            const isOutgoing = freqBox.closest('.outgoing') !== null;
            freqBox.querySelectorAll('.voice-freq-bar').forEach(b => {
                b.classList.remove('played');
                b.style.opacity = isOutgoing ? '0.5' : '0.45';
                b.style.background = isOutgoing ? 'rgba(255, 255, 255, 0.45)' : '#94a3b8';
            });
        }
    };

    window.toggleVoiceSpeed = function (audioId, btn) {
        const aud = document.getElementById(audioId);
        if (!aud || !btn) return;

        let currentRate = aud.playbackRate || 1;
        let currentIdx = VOICE_SPEED_PRESETS.indexOf(currentRate);
        if (currentIdx === -1) currentIdx = 0;
        const nextIdx = (currentIdx + 1) % VOICE_SPEED_PRESETS.length;
        const nextRate = VOICE_SPEED_PRESETS[nextIdx];

        aud.playbackRate = nextRate;
        btn.innerText = `${nextRate}x`;
        btn.classList.add('speed-active');
    };

    // Majukan & Mundurkan posisi audio melalui klik pada grafik frekuensi
    window.seekVoiceBubbleByClick = function (audioId, event) {
        const aud = document.getElementById(audioId);
        const freqBox = document.getElementById(`freq_box_${audioId}`);
        if (!aud || !freqBox) return;

        const dur = (aud.duration && isFinite(aud.duration)) ? aud.duration : (aud.currentTime > 0 ? aud.currentTime : 10);
        const rect = freqBox.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        aud.currentTime = pct * dur;
        window.updateVoiceBubbleTime(audioId);
    };

    // Majukan & Mundurkan posisi audio melalui penggeseran/drag (scrubbing) pada grafik frekuensi
    window.startVoiceBubbleScrub = function (audioId, event) {
        const aud = document.getElementById(audioId);
        const freqBox = document.getElementById(`freq_box_${audioId}`);
        if (!aud || !freqBox) return;

        const applySeek = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = freqBox.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const dur = (aud.duration && isFinite(aud.duration)) ? aud.duration : (aud.currentTime > 0 ? aud.currentTime : 10);
            aud.currentTime = pct * dur;
            window.updateVoiceBubbleTime(audioId);
        };

        const onMove = (e) => {
            applySeek(e);
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);

        applySeek(event);
    };

    // =========================================================================
    // KONTROL PEMUTAR VIDEO BUBBLE MODERN (HOVER BAR, PLAY/PAUSE, SUARA, DOWNLOAD)
    // =========================================================================
    window.toggleVideoBubblePlay = function (videoId, event) {
        if (event) event.stopPropagation();
        const vid = document.getElementById(videoId);
        if (!vid) return;

        const centerIcon = document.getElementById(`vid_center_icon_${videoId}`);
        const overlay = document.getElementById(`vid_overlay_${videoId}`);
        const hoverPlayBtn = document.getElementById(`vid_btn_play_${videoId}`);

        if (!vid.paused) {
            vid.pause();
            if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
            if (overlay) overlay.style.opacity = '1';
            if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            return;
        }

        // Hentikan video dan audio lain
        document.querySelectorAll('audio, video').forEach(media => {
            if (media.id !== videoId && !media.paused) {
                media.pause();
            }
        });

        vid.play().then(() => {
            if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-pause"></i>';
            if (overlay) overlay.style.opacity = '0';
            if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }).catch(() => {});
    };

    window.toggleVideoBubbleMute = function (videoId, event) {
        if (event) event.stopPropagation();
        const vid = document.getElementById(videoId);
        const btn = document.getElementById(`vid_btn_mute_${videoId}`);
        if (!vid) return;

        vid.muted = !vid.muted;
        if (btn) {
            btn.innerHTML = vid.muted
                ? '<i class="fas fa-volume-mute" style="color:#ef4444;"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
    };

    window.updateVideoBubbleProgress = function (videoId) {
        const vid = document.getElementById(videoId);
        const timeEl = document.getElementById(`vid_time_${videoId}`);
        if (!vid || !timeEl) return;
        const cur = vid.currentTime || 0;
        const dur = vid.duration || 0;
        timeEl.innerText = `${formatTimeSeconds(cur)} / ${formatTimeSeconds(dur)}`;
    };

    window.resetVideoBubble = function (videoId) {
        const vid = document.getElementById(videoId);
        const centerIcon = document.getElementById(`vid_center_icon_${videoId}`);
        const overlay = document.getElementById(`vid_overlay_${videoId}`);
        const hoverPlayBtn = document.getElementById(`vid_btn_play_${videoId}`);

        if (vid) vid.currentTime = 0;
        if (centerIcon) centerIcon.innerHTML = '<i class="fas fa-play" style="margin-left:3px;"></i>';
        if (overlay) overlay.style.opacity = '1';
        if (hoverPlayBtn) hoverPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    };

    window.formatModernBubbleHtml = function (pesan, isSenderAdmin) {
        const senderVal = String(pesan.sender || pesan.pengirim || '').toLowerCase().trim();
        const namaVal = String(pesan.nama || '').toLowerCase().trim();

        // Pesan yang dikirim oleh Admin / Petugas HARUS SELALU di sisi kanan (outgoing)
        // Cek eksplisit identitas pengirim apakah Admin / Petugas
        const hasOfficerClue = Boolean(
            isSenderAdmin === true ||
            pesan.is_admin === true ||
            pesan.is_officer === true ||
            senderVal === 'petugas' ||
            senderVal === 'admin' ||
            senderVal === 'operator' ||
            senderVal === 'penyalur' ||
            senderVal.includes('petugas') ||
            senderVal.includes('admin') ||
            senderVal.includes('dinsos') ||
            namaVal.includes('petugas') ||
            namaVal.includes('dinsos') ||
            namaVal.includes('admin') ||
            namaVal.includes('operator') ||
            namaVal.includes('penyalur')
        );

        // Jika bukan dari warga aktif atau memiliki atribut admin/petugas, MAKA SELALU DI SISI KANAN (outgoing)
        const isTrueWarga = !hasOfficerClue && (
            senderVal === 'warga' || 
            (window.activeChatNik && pesan.sender === window.activeChatNik && !hasOfficerClue)
        );

        const isOfficer = !isTrueWarga;
        const rowClass = isOfficer ? 'outgoing' : 'incoming';
        const rawText = pesan.text || pesan.pesan || '';
        let waktu = pesan.waktu || pesan.time || '';
        if (pesan.created_at) {
            try {
                const dObj = new Date(pesan.created_at);
                if (!isNaN(dObj.getTime())) {
                    waktu = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                }
            } catch (e) {}
        }
        if (!waktu || waktu === 'Baru saja' || waktu === 'Hari ini') {
            waktu = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        const isRead = Boolean(pesan.is_read);
        const checkIcon = isRead
            ? `<i class="fas fa-check-double chat-check-read" style="margin-left:3px;" title="Dibaca ${pesan.read_at ? ('(' + pesan.read_at + ')') : ''}"></i>`
            : `<i class="fas fa-check-double chat-check-delivered" style="margin-left:3px;" title="Tersampaikan"></i>`;

        const msgId = pesan.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        if (window.deletedForMeIds.includes(String(msgId))) return '';
        const isDeletedAll = window.deletedForAllIds.includes(String(msgId)) || Boolean(pesan.is_deleted_all);

        let contentHtml = '';
        let cleanText = (rawText || '')
            .replace(/pesan\s*suara\s*(\(voice\s*note\))?/gi, '')
            .replace(/^voice\s*note$/gi, '')
            .replace(/foto\s*terlampir/gi, '')
            .replace(/video\s*terlampir/gi, '')
            .replace(/^foto$/gi, '')
            .replace(/^image$/gi, '')
            .replace(/berkas\s*terlampir/gi, '')
            .trim();

        // Deteksi jika pesan HANYA berisi 1–3 emoji tanpa lampiran berkas
        let isEmojiOnly = false;
        try {
            isEmojiOnly = Boolean(
                cleanText && 
                !pesan.file_path && 
                !pesan.reply_text && 
                /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u.test(cleanText) && 
                cleanText.trim().length <= 8
            );
        } catch (err) {
            isEmojiOnly = false;
        }

        if (isDeletedAll) {
            contentHtml = `<span style="font-style:italic; opacity:0.65; font-size:0.82rem;"><i class="fas fa-ban"></i> Pesan ini telah ditarik.</span>`;
        } else {
            if (pesan.reply_text) {
                contentHtml += `<div style="border-left:3px solid #009846; padding:3px 8px; margin-bottom:6px; font-size:0.75rem; background:rgba(0,0,0,0.05); border-radius:4px;"><b>${window.safeHtml(pesan.reply_sender || 'Balasan')}</b>: ${window.safeHtml(pesan.reply_text)}</div>`;
            }

            if (pesan.file_path) {
                const url = pesan.file_path.startsWith('http') ? pesan.file_path : `${BASE_API_URL}${pesan.file_path}`;
                const ext = (pesan.file_path.split('.').pop() || '').toLowerCase();
                const isAudio = pesan.file_type === 'audio' ||
                                (pesan.file_path && pesan.file_path.includes('voice_')) ||
                                (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].some(e => pesan.file_path.toLowerCase().endsWith('.' + e))) ||
                                (pesan.file_path.toLowerCase().endsWith('.webm') && (rawText.toLowerCase().includes('suara') || rawText.toLowerCase().includes('voice')));

                const isImageOnly = Boolean(
                    (pesan.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) &&
                    (!cleanText || ['foto terlampir', 'image', 'foto', 'berkas terlampir'].includes(cleanText.toLowerCase())) &&
                    !pesan.reply_text
                );

                if (isAudio) {
                    const audioId = `adm_aud_${String(msgId).replace(/[^a-zA-Z0-9_]/g, '_')}`;
                    contentHtml += `
                        <div class="voice-note-bubble-card" id="card_${audioId}">
                            <audio id="${audioId}" src="${url}" preload="metadata" 
                                   onloadedmetadata="window.initVoiceBubbleMeta ? window.initVoiceBubbleMeta('${audioId}') : null"
                                   ontimeupdate="window.updateVoiceBubbleTime ? window.updateVoiceBubbleTime('${audioId}') : null" 
                                   onended="window.resetVoiceBubblePlay ? window.resetVoiceBubblePlay('${audioId}') : null"></audio>
                            <button type="button" class="voice-play-circle-btn" id="btn_play_${audioId}" onclick="window.toggleVoiceBubblePlay ? window.toggleVoiceBubblePlay('${audioId}', this) : null" title="Putar Pesan Suara">
                                <i class="fas fa-play" style="margin-left:2px;"></i>
                            </button>
                            <div class="voice-track-info">
                                <div class="voice-meta-row">
                                    <span class="voice-title-label"><i class="fas fa-microphone"></i> Pesan Suara</span>
                                </div>
                                <div class="voice-waveform-row">
                                    <div class="voice-freq-visualizer" id="freq_box_${audioId}" 
                                          onclick="window.seekVoiceBubbleByClick ? window.seekVoiceBubbleByClick('${audioId}', event) : null"
                                         onmousedown="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         ontouchstart="window.startVoiceBubbleScrub ? window.startVoiceBubbleScrub('${audioId}', event) : null"
                                         title="Klik atau geser pada grafik suara">
                                        ${Array.from({length: 22}, (_, i) => {
                                            const heights = [35, 50, 75, 90, 45, 65, 100, 85, 55, 70, 95, 80, 60, 45, 75, 95, 65, 45, 80, 90, 65, 40];
                                            const h = heights[i % heights.length];
                                            const delay = (i * 0.04).toFixed(2);
                                            return `<div class="voice-freq-bar" id="bar_${audioId}_${i}" style="height:${h}%; animation-delay:${delay}s;"></div>`;
                                        }).join('')}
                                    </div>
                                    <span class="voice-timer-badge" id="dur_${audioId}">00:00</span>
                                </div>
                            </div>
                            <button type="button" class="btn-voice-speed-pill" id="speed_${audioId}" onclick="window.toggleVoiceSpeed ? window.toggleVoiceSpeed('${audioId}', this) : null" title="Atur Kecepatan Suara (1x, 1.5x, 2x, 0.5x)">
                                1x
                            </button>
                        </div>`;
                } else if (pesan.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
                    const imgName = pesan.file_name || pesan.file_path.split('/').pop() || 'Foto_Terlampir.jpg';
                    contentHtml += `
                        <div class="chat-media-img-wrap" onclick="window.openLightbox('${url}','image','${window.escapeInlineJS(imgName)}')" title="Klik untuk memperbesar foto">
                            <img src="${url}" class="chat-media-img" alt="Foto Terlampir" loading="lazy" />
                            ${isImageOnly ? `
                            <span class="chat-time-stamp-overlay">
                                ${waktu}
                                ${isOfficer ? checkIcon : ''}
                            </span>` : ''}
                            <button type="button" class="chat-media-dl-btn" onclick="window.downloadDocumentDirect('${url}', '${window.escapeInlineJS(imgName)}', event)" title="Unduh Foto">
                                <i class="fas fa-arrow-down"></i>
                            </button>
                        </div>`;
                } else if (pesan.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
                    const vidName = pesan.file_name || pesan.file_path.split('/').pop() || 'Video_Terlampir.mp4';
                    const videoId = `vid_${msgId}_${Date.now()}`;
                    const isVideoOnly = Boolean(
                        (!cleanText || ['video terlampir', 'video'].includes(cleanText.toLowerCase())) &&
                        !pesan.reply_text
                    );
                    contentHtml += `
                        <div class="chat-media-video-wrap" id="vid_wrap_${videoId}">
                            <video id="${videoId}" src="${url}" playsinline preload="metadata" class="chat-media-video" 
                                   onclick="window.toggleVideoBubblePlay('${videoId}', event)"
                                   ontimeupdate="window.updateVideoBubbleProgress ? window.updateVideoBubbleProgress('${videoId}') : null"
                                   onended="window.resetVideoBubble ? window.resetVideoBubble('${videoId}') : null"></video>
                            
                            <!-- Tombol Putar Tengah Video Elegan -->
                            <div class="video-center-play-overlay" id="vid_overlay_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Klik untuk Memutar Video Langsung">
                                <div class="center-play-circle" id="vid_center_icon_${videoId}">
                                    <i class="fas fa-play" style="margin-left:3px;"></i>
                                </div>
                            </div>

                            <!-- Bilah Kontrol Mengambang (Hanya Muncul Ketika Kursor Mengarahkan ke Video / Hover) -->
                            <div class="video-floating-hover-bar">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="btn-video-hover-ctrl" id="vid_btn_play_${videoId}" onclick="window.toggleVideoBubblePlay('${videoId}', event)" title="Putar / Jeda Video">
                                        <i class="fas fa-play"></i>
                                    </button>
                                    <button type="button" class="btn-video-hover-ctrl" id="vid_btn_mute_${videoId}" onclick="window.toggleVideoBubbleMute('${videoId}', event)" title="Bisukan / Nyalakan Suara Video">
                                        <i class="fas fa-volume-up"></i>
                                    </button>
                                    <span class="video-hover-timer" id="vid_time_${videoId}">00:00</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="btn-video-hover-ctrl" onclick="window.openLightbox('${url}','video','${window.escapeInlineJS(vidName)}')" title="Buka Layar Penuh">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                    <a href="${url}" download="${window.safeHtml(vidName)}" onclick="window.downloadDocumentDirect('${url}', '${window.escapeInlineJS(vidName)}', event)" class="btn-video-hover-ctrl" title="Unduh Video" style="color:white; text-decoration:none;">
                                        <i class="fas fa-download"></i>
                                    </a>
                                </div>
                            </div>

                            ${isVideoOnly ? `
                            <span class="chat-time-stamp-overlay">
                                ${waktu}
                                ${isOfficer ? checkIcon : ''}
                            </span>` : ''}
                        </div>`;
                } else {
                    // DOKUMEN: PDF, WORD, EXCEL, PPT DLL (PANEL UNDUHAN DI SAMPING, ISI DOKUMEN TERLIHAT DARI LUAR)
                    const rawFileName = pesan.file_name || (pesan.file_path || '').split('/').pop() || 'Dokumen';
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
                        else baseTitle = 'Berkas Dokumen Resmi Lampiran';
                    }

                    let docTypeClass = 'chat-doc-other';
                    let iconClass = 'fas fa-file-alt';
                    let badgeText = docExt.toUpperCase();
                    let labelText = 'Berkas Dokumen';
                    let accentColor = '#0284c7';

                    if (['pdf'].includes(docExt)) {
                        docTypeClass = 'chat-doc-pdf';
                        iconClass = 'fas fa-file-pdf';
                        badgeText = 'PDF';
                        labelText = 'Dokumen PDF Resmi';
                        accentColor = '#dc2626';
                    } else if (['doc', 'docx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-word';
                        iconClass = 'fas fa-file-word';
                        badgeText = 'WORD';
                        labelText = 'Microsoft Word (.docx)';
                        accentColor = '#2563eb';
                    } else if (['xls', 'xlsx', 'csv'].includes(docExt)) {
                        docTypeClass = 'chat-doc-excel';
                        iconClass = 'fas fa-file-excel';
                        badgeText = 'EXCEL';
                        labelText = 'Spreadsheet Excel (.xlsx)';
                        accentColor = '#16a34a';
                    } else if (['ppt', 'pptx'].includes(docExt)) {
                        docTypeClass = 'chat-doc-ppt';
                        iconClass = 'fas fa-file-powerpoint';
                        badgeText = 'PPT';
                        labelText = 'Presentasi PowerPoint';
                        accentColor = '#ea580c';
                    } else if (['json'].includes(docExt)) {
                        docTypeClass = 'chat-doc-json';
                        iconClass = 'fas fa-file-code';
                        badgeText = 'JSON';
                        labelText = 'Berkas Konfigurasi Data (JSON)';
                        accentColor = '#d97706';
                    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(docExt)) {
                        docTypeClass = 'chat-doc-zip';
                        iconClass = 'fas fa-file-archive';
                        badgeText = docExt.toUpperCase();
                        labelText = 'Berkas Arsip Terkompresi';
                        accentColor = '#7c3aed';
                    }

                    const fileSizeText = pesan.file_size ? window.formatBytes(pesan.file_size) : '';

                    contentHtml += `
                        <div class="chat-doc-card ${docTypeClass}" title="${window.safeHtml(cleanFileName)}">
                            <div class="chat-doc-accent-bar" style="background:${accentColor}; height:3.5px; width:100%;"></div>
                            <!-- Kartu Lampiran Dokumen Bersih & Rapi Tanpa Pratinjau Isi Dokumen -->
                            <div class="chat-doc-bottom-strip" onclick="window.open('${url}', '_blank')">
                                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0; overflow:hidden;">
                                    <div class="chat-doc-icon-box" style="width:40px; height:40px; font-size:1.35rem;">
                                        <i class="${iconClass}"></i>
                                    </div>
                                    <div class="chat-doc-info">
                                        <div class="chat-doc-title" style="font-size:0.85rem;" title="${window.safeHtml(cleanFileName)}">${window.safeHtml(cleanFileName)}</div>
                                        <div class="chat-doc-sub">
                                            <span class="chat-doc-badge">${badgeText}</span>
                                            <span class="chat-doc-label">${labelText}</span>
                                            ${fileSizeText ? `<span class="chat-doc-dot">•</span><span class="chat-doc-size">${fileSizeText}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="chat-doc-side-panel">
                                    <button type="button" class="chat-doc-side-dl-btn" onclick="window.downloadDocumentDirect('${url}', '${window.escapeInlineJS(cleanFileName)}', event)" title="Unduh Berkas ${badgeText}">
                                        <i class="fas fa-download"></i>
                                        <span>Unduh</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                }
            }

            const isPlaceholderOnly = !cleanText || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran', 'video terlampir', 'video', '🎤 pesan suara (voice note)', '🎤 pesan suara', 'pesan suara'].includes(cleanText.toLowerCase());
            if (cleanText && !isPlaceholderOnly) {
                if (cleanText.startsWith('[GEOTAG_LOKASI]')) {
                    try {
                        const jsonStr = cleanText.replace('[GEOTAG_LOKASI]', '').trim();
                        const loc = JSON.parse(jsonStr);
                        const latVal = Number(loc.lat) || -7.4478;
                        const lngVal = Number(loc.lng) || 112.7183;
                        const isRealtime = loc.tipe === 'realtime';
                        const headerTitle = isRealtime ? 'Lokasi Perangkat Real-time (GPS)' : 'Lokasi Rumah Arsip Kependudukan';
                        const badgeHtml = isRealtime 
                            ? `<span style="background:#ecfdf5; color:#047857; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #a7f3d0;"><i class="fas fa-crosshairs text-emerald-500"></i> GPS Perangkat Real-time</span>`
                            : `<span style="background:#eff6ff; color:#1d4ed8; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px; border:1px solid #bfdbfe;"><i class="fas fa-check-circle text-blue-500"></i> Arsip Data Warga Terverifikasi</span>`;

                        contentHtml += `
                            <div class="chat-geotag-card">
                                <div class="chat-geotag-header">
                                    <i class="fas ${isRealtime ? 'fa-location-arrow text-emerald-600' : 'fa-map-marked-alt text-primary'}" style="font-size:1.15rem;"></i>
                                    <span>${headerTitle}</span>
                                </div>
                                <div style="margin:4px 0 6px 0;">
                                    ${badgeHtml}
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
                                    📍 Lat: ${latVal.toFixed(4)}, Lng: ${lngVal.toFixed(4)} ${loc.accuracy ? `(±${loc.accuracy}m)` : ''}
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
                    contentHtml += `<div class="chat-msg-text" style="${isEmojiOnly ? '' : 'font-size:0.88rem; line-height:1.45;'}">${window.safeHtml(cleanText)}</div>`;
                }
            }
        }

        const reactionHtml = pesan.reaction ? `<div class="msg-reaction-display">${pesan.reaction}</div>` : '';
        const senderName = pesan.nama || (isOfficer ? 'Petugas Dinsos' : window.activeChatName);
        const snippetSummary = cleanText || (pesan.file_path ? pesan.file_path.split('/').pop() : 'Media Terlampir');
        const isShortText = Boolean(
            cleanText &&
            !pesan.file_path &&
            !pesan.reply_text &&
            cleanText.length <= 15 &&
            !cleanText.includes('\n')
        );
        const isImageBubbleOnly = Boolean(
            pesan.file_path &&
            (!cleanText || ['foto terlampir', 'image', 'foto', 'berkas terlampir', 'lampiran'].includes(cleanText.toLowerCase())) &&
            !pesan.reply_text &&
            (pesan.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].some(e => (pesan.file_path || '').toLowerCase().endsWith('.' + e)))
        );
        const isVideoBubbleOnly = Boolean(
            pesan.file_path &&
            (!cleanText || ['video terlampir', 'video'].includes(cleanText.toLowerCase())) &&
            !pesan.reply_text &&
            (pesan.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].some(e => (pesan.file_path || '').toLowerCase().endsWith('.' + e)))
        );
        const isMediaBubbleOnly = isImageBubbleOnly || isVideoBubbleOnly;

        return `
            <div class="chat-msg-row ${rowClass}" id="bubble_wrap_${msgId}" data-id="${msgId}" style="width:100% !important; display:flex !important; flex-direction:row !important; justify-content:${isOfficer ? 'flex-end' : 'flex-start'} !important; align-items:${isOfficer ? 'flex-end' : 'flex-start'} !important; margin-left:${isOfficer ? 'auto' : '0'} !important; margin-right:${isOfficer ? '0' : 'auto'} !important; padding:2px 0 !important; box-sizing:border-box !important;">
                <div class="chat-msg-bubble ${isOfficer ? 'outgoing-bubble' : 'incoming-bubble'} ${isEmojiOnly ? 'is-emoji-only' : ''} ${isShortText ? 'is-short-text' : ''} ${isImageBubbleOnly ? 'is-image-only' : ''} ${isVideoBubbleOnly ? 'is-video-only' : ''} ${isMediaBubbleOnly ? 'is-media-only' : ''}" style="${isOfficer ? 'margin-left:auto !important; margin-right:0 !important; align-self:flex-end !important; text-align:left !important;' : 'margin-right:auto !important; margin-left:0 !important; align-self:flex-start !important; text-align:left !important;'}">
                    ${!isDeletedAll ? `
                    <button type="button" class="bubble-corner-btn" onclick="window.toggleBubbleDropdown(this, event)" title="Opsi Pesan">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <div class="bubble-action-dropdown" onclick="event.stopPropagation()">
                        <div class="emoji-react-row">
                            <span onclick="window.addReactionToMessage('${msgId}', '❤️')" title="Suka">❤️</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '👍')" title="Setuju">👍</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '😂')" title="Tertawa">😂</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '😮')" title="Kaget">😮</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '😢')" title="Sedih">😢</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '🙏')" title="Terima Kasih">🙏</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '🔥')" title="Semangat">🔥</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '👏')" title="Tepuk Tangan">👏</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '🎉')" title="Hebat">🎉</span>
                            <span onclick="window.addReactionToMessage('${msgId}', '💯')" title="Sempurna">💯</span>
                        </div>
                        <button type="button" onclick="window.bukaInfoPesanChat('${msgId}')">
                            <i class="fas fa-info-circle text-primary"></i> Info Pesan
                        </button>
                        <button type="button" onclick="window.prepareReplyMessage('${msgId}', '${isOfficer ? 'Petugas Dinsos' : window.escapeInlineJS(window.activeChatName)}', '${window.escapeInlineJS(snippetSummary)}', '${pesan.file_type || ''}')">
                            <i class="fas fa-reply text-primary"></i> Balas
                        </button>
                        <button type="button" onclick="window.pinMessageDirect('${msgId}', '${window.escapeInlineJS(snippetSummary)}')">
                            <i class="fas fa-thumbtack text-warning"></i> Sematkan
                        </button>
                        <button type="button" onclick="window.salinTeksPesan('${window.escapeInlineJS(snippetSummary)}')">
                            <i class="fas fa-copy text-info"></i> Salin Teks
                        </button>
                        <button type="button" class="text-warning" onclick="window.laporkanPesanChat('${msgId}', '${window.escapeInlineJS(senderName)}', '${window.escapeInlineJS(snippetSummary)}')">
                            <i class="fas fa-flag text-danger"></i> Laporkan
                        </button>
                        <button type="button" class="text-danger" onclick="window.deleteMessageAction('${msgId}', ${isOfficer})">
                            <i class="fas fa-trash-alt text-danger"></i> Hapus Pesan
                        </button>
                    </div>
                    ` : ''}

                    ${!isOfficer && !isEmojiOnly && !isMediaBubbleOnly ? `
                    <div style="font-size:0.68rem; font-weight:800; margin-bottom:3px; opacity:0.85; display:flex; align-items:center; gap:4px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <i class="fas fa-user"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${window.safeHtml(senderName)}</span>
                    </div>
                    ` : ''}

                    ${contentHtml}
                    ${!isMediaBubbleOnly ? `
                    <span class="chat-time-stamp">
                        ${waktu}
                        ${isOfficer ? checkIcon : ''}
                    </span>` : ''}
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
        window.isLoadingChatMessages = true;
        try {
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box) return;

            window.currentActiveChatMessages = messages;

            // Tandai pesan dari warga sebagai terbaca oleh petugas
            fetch(`${BASE_API_URL}/api/chat/${nik}/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reader: 'petugas', read_time: window.getDeviceRealtimeClock() })
            }).catch(() => {});

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
        } catch (e) {
        } finally {
            window.isLoadingChatMessages = false;
        }

        if (chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(() => {
            if (window.activeChatNik) window.silentRefreshMessages(window.activeChatNik);
        }, 3500);
    };

    window.silentRefreshMessages = async function (nik) {
        if (!nik || nik !== window.activeChatNik || window.isLoadingChatMessages) return;
        try {
            const res = await apiCall(`/api/chat/${nik}`);
            if (!res || !res.ok) return;
            const messages = await res.json();
            const box = document.getElementById('adminChatMessages');
            if (!box || nik !== window.activeChatNik) return;

            // Jika ada pesan baru dari warga yang belum dibaca, langsung tandai sebagai terbaca oleh petugas
            const hasUnreadFromWarga = messages.some(m => m.sender === 'warga' && !m.is_read);
            if (hasUnreadFromWarga) {
                fetch(`${BASE_API_URL}/api/chat/${nik}/mark-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reader: 'petugas', read_time: new Date().toISOString() })
                }).catch(() => {});
            }

            const domRows = Array.from(box.querySelectorAll('.chat-msg-row[data-id]'));
            const existingIdMap = new Map();
            domRows.forEach(row => {
                const id = String(row.getAttribute('data-id'));
                existingIdMap.set(id, row);
            });

            const serverMsgIds = new Set(messages.map(m => String(m.id)));

            // 1. Hapus hanya pesan yang ditarik / dihapus dari server
            domRows.forEach(row => {
                const id = String(row.getAttribute('data-id'));
                if (!serverMsgIds.has(id)) {
                    row.remove();
                }
            });

            // 2. Tambahkan pesan baru yang belum ada di DOM (mencegah duplikasi pesan secara mutlak)
            let hasAppended = false;
            messages.forEach((m) => {
                const strId = String(m.id);
                if (!existingIdMap.has(strId)) {
                    const isAdmin = m.sender !== 'warga';
                    box.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isAdmin));
                    hasAppended = true;
                } else {
                    // Update status baca in-place tanpa mereset pemutar audio atau audio ID
                    const row = existingIdMap.get(strId);
                    if (row && m.sender !== 'warga') {
                        const checkEl = row.querySelector('.chat-check-delivered');
                        if (checkEl && m.is_read) {
                            checkEl.className = 'fas fa-check-double chat-check-read';
                        }
                    }
                }
            });

            window.currentActiveChatMessages = messages;
            if (hasAppended) {
                box.scrollTop = box.scrollHeight;
            }
        } catch (e) {}
    };

    window.getDeviceRealtimeClock = function () {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // Helper format tanggal & jam perangkat realtime
    window.formatFullDeviceDateTime = function (val) {
        if (!val || val === '—' || val === '-') return '—';
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const jam = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                return `${tgl}, ${jam}`;
            }
        } catch (e) {}
        return String(val);
    };

    // =========================================================================
    // PANEL INFO PESAN (MELIHAT STATUS TERKIRIM, TERSAMPAIKAN, DAN WAKTU DIBACA)
    // =========================================================================
    window.bukaInfoPesanChat = async function (msgId) {
        document.querySelectorAll('.bubble-action-dropdown, .aduan-dropdown-menu').forEach(el => el.style.display = 'none');

        let msg = (window.currentActiveChatMessages || []).find(m => String(m.id) === String(msgId));

        const modal = document.getElementById('modalInfoPesanChat');
        if (!modal) return;
        modal.style.display = 'flex';

        const prevBox = document.getElementById('infoPesanPreviewContainer');
        const waktuDibacaEl = document.getElementById('infoWaktuDibaca');
        const deskripsiDibacaEl = document.getElementById('infoDeskripsiDibaca');
        const iconDibacaEl = document.getElementById('infoIconDibaca');
        const waktuTersampaikanEl = document.getElementById('infoWaktuTersampaikan');
        const waktuTerkirimEl = document.getElementById('infoWaktuTerkirim');
        const senderNamaEl = document.getElementById('infoSenderNama');
        const penerimaNamaEl = document.getElementById('infoPenerimaNama');

        if (prevBox) prevBox.innerHTML = '<div style="color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Memuat detail status pesan...</div>';

        try {
            const res = await fetch(`${BASE_API_URL}/api/chat/info/${msgId}`);
            if (res.ok) {
                const json = await res.json();
                if (json.data) msg = json.data;
            }
        } catch (e) {}

        if (!msg) {
            if (prevBox) prevBox.innerHTML = '<span style="color:#ef4444;">Data pesan tidak ditemukan.</span>';
            return;
        }

        const isOfficer = msg.sender === 'petugas' || msg.sender === 'admin';
        const displaySendTime = window.formatFullDeviceDateTime(msg.created_at || msg.waktu || 'Baru saja');
        const displayDeliveredTime = window.formatFullDeviceDateTime(msg.delivered_at || msg.created_at || msg.waktu || 'Baru saja');
        const displayReadTime = msg.is_read ? window.formatFullDeviceDateTime(msg.read_at || msg.created_at || msg.waktu) : '—';
        const targetReaderName = isOfficer ? (window.activeChatName || 'Warga (NIK: ' + (msg.nik || '') + ')') : 'Petugas Dinsos Sidoarjo';

        // Render pratinjau pesan di info panel
        let previewHtml = '';
        if (msg.file_path) {
            const url = msg.file_path.startsWith('http') ? msg.file_path : `${BASE_API_URL}${msg.file_path}`;
            const ext = (msg.file_path.split('.').pop() || '').toLowerCase();
            if (msg.file_type === 'image' || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
                previewHtml = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${url}" style="width:60px; height:60px; object-fit:cover; border-radius:10px; border:2px solid #009846;" />
                        <div>
                            <div style="font-weight:700; color:#0f172a;"><i class="fas fa-image text-success"></i> Berkas Foto Lampiran</div>
                            <div style="font-size:0.75rem; color:#64748b;">${window.safeHtml(msg.pesan || msg.file_name || 'Foto Terlampir')}</div>
                        </div>
                    </div>`;
            } else if (msg.file_type === 'video' || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
                previewHtml = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:60px; height:60px; border-radius:10px; background:#0f172a; color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.4rem; border:2px solid #009846;">
                            <i class="fas fa-video"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#0f172a;"><i class="fas fa-video text-primary"></i> Berkas Video Lampiran</div>
                            <div style="font-size:0.75rem; color:#64748b;">${window.safeHtml(msg.pesan || msg.file_name || 'Video Terlampir')}</div>
                        </div>
                    </div>`;
            } else {
                previewHtml = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:48px; height:48px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:1.3rem; color:#0284c7;">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#0f172a;">${window.safeHtml(msg.file_name || 'Dokumen')}</div>
                            <div style="font-size:0.75rem; color:#64748b;">${window.safeHtml(msg.pesan || 'Dokumen Terlampir')}</div>
                        </div>
                    </div>`;
            }
        } else {
            previewHtml = `<div style="font-size:0.9rem; color:#1e293b; line-height:1.45;">${window.safeHtml(msg.pesan || msg.text || '(Pesan tanpa teks)')}</div>`;
        }

        if (prevBox) prevBox.innerHTML = previewHtml;

        if (waktuTerkirimEl) waktuTerkirimEl.innerText = displaySendTime;
        if (waktuTersampaikanEl) waktuTersampaikanEl.innerText = displayDeliveredTime;

        if (msg.is_read) {
            if (waktuDibacaEl) waktuDibacaEl.innerText = displayReadTime;
            if (deskripsiDibacaEl) {
                deskripsiDibacaEl.innerHTML = `<span style="color:#0284c7; font-weight:700;"><i class="fas fa-check-double"></i> Telah dibaca pada <b>${displayReadTime}</b> oleh ${targetReaderName}</span>`;
            }
            if (iconDibacaEl) {
                iconDibacaEl.style.background = '#e0f2fe';
                iconDibacaEl.style.color = '#0284c7';
                iconDibacaEl.innerHTML = '<i class="fas fa-check-double" style="color:#0284c7;"></i>';
            }
        } else {
            if (waktuDibacaEl) waktuDibacaEl.innerText = '—';
            if (deskripsiDibacaEl) {
                deskripsiDibacaEl.innerHTML = `<span style="color:#94a3b8;"><i class="fas fa-clock"></i> Belum dibaca oleh ${targetReaderName}</span>`;
            }
            if (iconDibacaEl) {
                iconDibacaEl.style.background = '#f1f5f9';
                iconDibacaEl.style.color = '#94a3b8';
                iconDibacaEl.innerHTML = '<i class="fas fa-check-double" style="color:#94a3b8;"></i>';
            }
        }

        if (senderNamaEl) senderNamaEl.innerText = msg.nama || (isOfficer ? 'Petugas Dinsos' : 'Warga');
        if (penerimaNamaEl) penerimaNamaEl.innerText = isOfficer ? (window.activeChatName || 'Warga (NIK: ' + msg.nik + ')') : 'Petugas Dinsos Sidoarjo';
    };

    window.tutupInfoPesanChat = function () {
        const modal = document.getElementById('modalInfoPesanChat');
        if (modal) modal.style.display = 'none';
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
    // MULTI-MEDIA BATCH MANAGER & PRE-SEND EDITOR (UP TO 500 FILES / 5GB)
    // =========================================================================
    window.pendingMediaBatch = [];
    window.activeBatchIndex = 0;
    window.doodleHistory = [];
    window.currentDoodleColor = '#ef4444';
    window.currentDoodleLineWidth = 4;
    window.currentCanvasRotation = 0;
    let isDrawingOnCanvas = false;
    let lastX = 0;
    let lastY = 0;

    const MAX_FILES_LIMIT = 500;
    const MAX_SIZE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function detectFileType(file) {
        if (file.type && file.type.startsWith('image/')) return 'image';
        if (file.type && file.type.startsWith('video/')) return 'video';
        if (file.type && file.type.startsWith('audio/')) return 'audio';
        const name = (file.name || '').toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].some(ext => name.endsWith('.' + ext))) return 'image';
        if (['mp4', 'mov', 'webm', 'avi', 'mkv'].some(ext => name.endsWith('.' + ext))) return 'video';
        if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].some(ext => name.endsWith('.' + ext))) return 'audio';
        return 'document';
    }

    window.handleAdminMediaSelection = function (input) {
        if (!input.files || input.files.length === 0) return;
        window.pendingMediaBatch = [];
        window.appendAdminMediaSelection(input);
        input.value = '';
    };

    window.appendAdminMediaSelection = function (input) {
        if (!input.files || input.files.length === 0) return;
        const newFiles = Array.from(input.files);

        if (window.pendingMediaBatch.length + newFiles.length > MAX_FILES_LIMIT) {
            Swal.fire('Batas Berkas', `Maksimal pengiriman adalah ${MAX_FILES_LIMIT} berkas sekaligus. Berkas selebihnya diabaikan.`, 'warning');
        }

        const allowedFiles = newFiles.slice(0, MAX_FILES_LIMIT - window.pendingMediaBatch.length);
        let currentTotalSize = window.pendingMediaBatch.reduce((sum, item) => sum + (item.file.size || 0), 0);

        for (const file of allowedFiles) {
            if (currentTotalSize + file.size > MAX_SIZE_LIMIT) {
                Swal.fire('Kapasitas Penuh', `Total berkas melebihi batas maksimal 5 GB. Beberapa berkas tidak dapat ditambahkan.`, 'warning');
                break;
            }
            currentTotalSize += file.size;
            const type = detectFileType(file);
            const previewUrl = URL.createObjectURL(file);
            window.pendingMediaBatch.push({
                id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                file: file,
                type: type,
                name: file.name,
                size: file.size,
                url: previewUrl,
                previewUrl: previewUrl,
                editedDataUrl: null
            });
        }

        input.value = '';
        if (window.pendingMediaBatch.length > 0) {
            window.activeBatchIndex = Math.min(window.activeBatchIndex, window.pendingMediaBatch.length - 1);
            if (window.activeBatchIndex < 0) window.activeBatchIndex = 0;
            window.openMediaBatchModal();
        }
    };

    window.openMediaBatchModal = function () {
        const modal = document.getElementById('modalMediaBatchPreview');
        if (modal) modal.style.display = 'flex';
        window.renderMediaBatchModal();
    };

    window.closeMediaBatchModal = function () {
        const modal = document.getElementById('modalMediaBatchPreview');
        if (modal) modal.style.display = 'none';
        window.pendingMediaBatch.forEach(item => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        window.pendingMediaBatch = [];
        window.activeBatchIndex = 0;
        const progContainer = document.getElementById('batchUploadProgressBarContainer');
        if (progContainer) progContainer.style.display = 'none';
    };

    window.removeBatchItem = function (idx, event) {
        if (event) event.stopPropagation();
        if (idx >= 0 && idx < window.pendingMediaBatch.length) {
            const removed = window.pendingMediaBatch.splice(idx, 1)[0];
            if (removed && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        }
        if (window.pendingMediaBatch.length === 0) {
            return window.closeMediaBatchModal();
        }
        if (window.activeBatchIndex >= window.pendingMediaBatch.length) {
            window.activeBatchIndex = window.pendingMediaBatch.length - 1;
        }
        window.renderMediaBatchModal();
    };

    window.selectBatchItem = function (idx) {
        window.saveCurrentCanvasEdit();
        window.activeBatchIndex = idx;
        window.renderMediaBatchModal();
    };

    window.renderMediaBatchModal = function () {
        const queueContainer = document.getElementById('batchThumbnailQueue');
        const activeContainer = document.getElementById('mediaActiveViewerContainer');
        const counterSummary = document.getElementById('batchMediaCounterSummary');
        const listCountText = document.getElementById('batchListCountText');
        const totalSizeText = document.getElementById('batchTotalSizeText');
        const submitText = document.getElementById('btnSubmitBatchText');
        const doodleToolbar = document.getElementById('mediaDoodleToolbar');

        const totalItems = window.pendingMediaBatch.length;
        const totalBytes = window.pendingMediaBatch.reduce((sum, item) => sum + (item.file.size || 0), 0);

        if (counterSummary) counterSummary.innerText = `${totalItems} Berkas terpilih (${formatBytes(totalBytes)} / 5.0 GB)`;
        if (listCountText) listCountText.innerText = totalItems;
        if (totalSizeText) totalSizeText.innerText = formatBytes(totalBytes);
        if (submitText) submitText.innerText = `Kirim ${totalItems} Berkas`;

        if (queueContainer) {
            queueContainer.innerHTML = window.pendingMediaBatch.map((item, idx) => {
                const isActive = idx === window.activeBatchIndex;
                let thumbHtml = '';
                if (item.type === 'image') {
                    thumbHtml = `<img src="${item.editedDataUrl || item.previewUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;" />`;
                } else if (item.type === 'video') {
                    thumbHtml = `<div style="width:50px; height:50px; border-radius:8px; background:#1e293b; color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.3rem;"><i class="fas fa-video"></i></div>`;
                } else if (item.type === 'audio') {
                    thumbHtml = `<div style="width:50px; height:50px; border-radius:8px; background:#065f46; color:#a7f3d0; display:flex; align-items:center; justify-content:center; font-size:1.3rem;"><i class="fas fa-microphone"></i></div>`;
                } else {
                    const ext = (item.name || '').split('.').pop().toLowerCase();
                    let icon = 'fa-file-alt';
                    let bg = '#3b82f6';
                    if (['pdf'].includes(ext)) { icon = 'fa-file-pdf'; bg = '#ef4444'; }
                    else if (['doc', 'docx'].includes(ext)) { icon = 'fa-file-word'; bg = '#2563eb'; }
                    else if (['xls', 'xlsx', 'csv'].includes(ext)) { icon = 'fa-file-excel'; bg = '#10b981'; }
                    thumbHtml = `<div style="width:50px; height:50px; border-radius:8px; background:${bg}; color:white; display:flex; align-items:center; justify-content:center; font-size:1.3rem;"><i class="fas ${icon}"></i></div>`;
                }

                return `
                    <div onclick="window.selectBatchItem(${idx})" style="position:relative; cursor:pointer; flex-shrink:0; border:2px solid ${isActive ? '#009846' : 'transparent'}; border-radius:10px; padding:2px; background:${isActive ? '#dcfce7' : 'transparent'};">
                        ${thumbHtml}
                        <button type="button" onclick="window.removeBatchItem(${idx}, event)" style="position:absolute; top:-4px; right:-4px; width:18px; height:18px; border-radius:50%; background:#dc2626; color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.65rem;" title="Hapus berkas ini">&times;</button>
                    </div>
                `;
            }).join('');
        }

        const activeItem = window.pendingMediaBatch[window.activeBatchIndex];
        if (!activeItem || !activeContainer) return;

        if (activeItem.type === 'image') {
            if (doodleToolbar) doodleToolbar.style.display = 'flex';
            activeContainer.innerHTML = `
                <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                    <canvas id="mediaEditorCanvas" style="max-width:100%; max-height:380px; object-fit:contain; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.5); cursor:crosshair;"></canvas>
                </div>
            `;
            window.initDoodleCanvas(activeItem);
        } else {
            if (doodleToolbar) doodleToolbar.style.display = 'none';

            if (activeItem.type === 'video') {
                activeContainer.innerHTML = `
                    <div style="max-width:90%; max-height:100%; display:flex; flex-direction:column; align-items:center;">
                        <video id="batchVideoPreviewPlayer" src="${activeItem.previewUrl}" controls playsinline style="max-width:100%; max-height:360px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.5);"></video>
                        <div style="color:#94a3b8; font-size:0.75rem; margin-top:8px;">${window.safeHtml(activeItem.name)} (${formatBytes(activeItem.size)})</div>
                    </div>
                `;
            } else if (activeItem.type === 'audio') {
                activeContainer.innerHTML = `
                    <div style="background:#1e293b; padding:24px 30px; border-radius:18px; width:100%; max-width:440px; box-shadow:0 10px 30px rgba(0,0,0,0.4); text-align:center; border:1px solid rgba(255,255,255,0.1);">
                        <div style="width:64px; height:64px; border-radius:50%; background:#009846; color:white; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 14px auto; box-shadow:0 4px 14px rgba(0,152,70,0.4);">
                            <i class="fas fa-microphone"></i>
                        </div>
                        <div style="font-size:1rem; font-weight:800; color:#f8fafc; margin-bottom:4px;">${window.safeHtml(activeItem.name)}</div>
                        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:16px;">Pratinjau Pesan Suara • ${formatBytes(activeItem.size)}</div>
                        <audio src="${activeItem.previewUrl}" controls style="width:100%; outline:none; border-radius:20px;"></audio>
                    </div>
                `;
            } else {
                const ext = (activeItem.name || '').split('.').pop().toLowerCase();
                let icon = 'fas fa-file-alt';
                let themeColor = '#3b82f6';
                let docLabel = 'Dokumen Berkas';
                let badgeBg = '#2563eb';

                if (['pdf'].includes(ext)) {
                    icon = 'fas fa-file-pdf';
                    themeColor = '#ef4444';
                    docLabel = 'Dokumen PDF Resmi';
                    badgeBg = '#dc2626';
                } else if (['doc', 'docx'].includes(ext)) {
                    icon = 'fas fa-file-word';
                    themeColor = '#2563eb';
                    docLabel = 'Microsoft Word Document';
                    badgeBg = '#2563eb';
                } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                    icon = 'fas fa-file-excel';
                    themeColor = '#10b981';
                    docLabel = 'Spreadsheet Excel Data';
                    badgeBg = '#16a34a';
                }

                activeContainer.innerHTML = `
                    <div style="background:#1e293b; padding:24px 28px; border-radius:18px; width:100%; max-width:440px; box-shadow:0 10px 30px rgba(0,0,0,0.4); text-align:center; border:1.5px solid ${themeColor};">
                        <div style="width:68px; height:68px; border-radius:16px; background:${badgeBg}; color:white; display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin:0 auto 14px auto; box-shadow:0 4px 16px rgba(0,0,0,0.3);">
                            <i class="${icon}"></i>
                        </div>
                        <span style="display:inline-block; background:${badgeBg}; color:white; font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">${ext.toUpperCase()}</span>
                        <div style="font-size:0.95rem; font-weight:800; color:#f8fafc; margin-bottom:4px; word-break:break-word;">${window.safeHtml(activeItem.name)}</div>
                        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:18px;">${docLabel} • ${formatBytes(activeItem.size)}</div>
                        <button type="button" onclick="window.open('${activeItem.previewUrl}', '_blank')" class="btn" style="background:${badgeBg}; color:white; font-weight:700; font-size:0.82rem; border-radius:12px; padding:9px 20px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:8px;">
                            <i class="fas fa-external-link-alt"></i> Masuk / Buka Isi Dokumen
                        </button>
                    </div>
                `;
            }
        }
    };

    window.initDoodleCanvas = function (item) {
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;
            ctx.drawImage(img, 0, 0);
            window.doodleHistory = [canvas.toDataURL()];
        };
        img.src = item.editedDataUrl || item.previewUrl;

        const startDraw = (e) => {
            isDrawingOnCanvas = true;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
            lastX = (clientX - rect.left) * scaleX;
            lastY = (clientY - rect.top) * scaleY;
        };

        const draw = (e) => {
            if (!isDrawingOnCanvas) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            ctx.strokeStyle = window.currentDoodleColor;
            ctx.lineWidth = window.currentDoodleLineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();

            lastX = x;
            lastY = y;
        };

        const stopDraw = () => {
            if (isDrawingOnCanvas) {
                isDrawingOnCanvas = false;
                window.doodleHistory.push(canvas.toDataURL());
            }
        };

        canvas.onmousedown = startDraw;
        canvas.onmousemove = draw;
        canvas.onmouseup = stopDraw;
        canvas.onmouseleave = stopDraw;
        canvas.ontouchstart = startDraw;
        canvas.ontouchmove = draw;
        canvas.ontouchend = stopDraw;
    };

    window.saveCurrentCanvasEdit = function () {
        const canvas = document.getElementById('mediaEditorCanvas');
        const activeItem = window.pendingMediaBatch[window.activeBatchIndex];
        if (canvas && activeItem && activeItem.type === 'image') {
            activeItem.editedDataUrl = canvas.toDataURL();
        }
    };

    window.setDoodleColor = function (color) {
        window.currentDoodleColor = color;
        document.querySelectorAll('.doodle-color-btn').forEach(b => {
            b.style.borderColor = b.style.backgroundColor === color ? 'white' : 'transparent';
        });
    };

    window.undoDoodleStroke = function () {
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas || window.doodleHistory.length <= 1) return;
        window.doodleHistory.pop();
        const prevData = window.doodleHistory[window.doodleHistory.length - 1];
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = prevData;
    };

    window.clearDoodleCanvas = function () {
        const canvas = document.getElementById('mediaEditorCanvas');
        const activeItem = window.pendingMediaBatch[window.activeBatchIndex];
        if (!canvas || !activeItem) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            window.doodleHistory = [canvas.toDataURL()];
        };
        img.src = activeItem.previewUrl;
    };

    window.rotateDoodleCanvas = function () {
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const prevImg = new Image();
        prevImg.onload = () => {
            const oldW = canvas.width;
            const oldH = canvas.height;
            canvas.width = oldH;
            canvas.height = oldW;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(prevImg, -oldW / 2, -oldH / 2);
            window.doodleHistory.push(canvas.toDataURL());
        };
        prevImg.src = canvas.toDataURL();
    };

    // =========================================================================
    // FITUR EDITOR MEDIA LANJUTAN (TEKS, STIKER EMOJI, STEMPEL FOTO, RASIO & POTONG VIDEO)
    // =========================================================================
    window.promptAddTextToCanvas = async function () {
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas) return Swal.fire('Info', 'Buka foto terlebih dahulu untuk menambahkan teks.', 'info');

        const { value: formValues } = await Swal.fire({
            title: '<i class="fas fa-font text-info"></i> Tambah Teks ke Media',
            html: `
                <div style="text-align:left; font-size:0.85rem;">
                    <label style="font-weight:700; display:block; margin-bottom:4px;">Teks Tulisan:</label>
                    <input id="swalCanvasTextInput" class="form-input" placeholder="Contoh: Verifikasi Lapangan Dinsos..." style="width:100%; border-radius:10px; padding:8px 12px; margin-bottom:12px; border:1px solid #cbd5e1; font-size:0.9rem;">
                    
                    <div style="display:flex; gap:10px; margin-bottom:12px;">
                        <div style="flex:1;">
                            <label style="font-weight:700; display:block; margin-bottom:4px;">Ukuran Huruf:</label>
                            <select id="swalCanvasFontSize" class="form-select" style="width:100%; border-radius:10px; padding:6px 10px; border:1px solid #cbd5e1; font-size:0.85rem;">
                                <option value="24">Kecil (24px)</option>
                                <option value="36" selected>Sedang (36px)</option>
                                <option value="48">Besar (48px)</option>
                                <option value="64">Sangat Besar (64px)</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-weight:700; display:block; margin-bottom:4px;">Warna Teks:</label>
                            <input type="color" id="swalCanvasTextColor" value="#ffffff" style="width:100%; height:36px; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer;">
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Terapkan Teks',
            confirmButtonColor: '#009846',
            cancelButtonText: 'Batal',
            preConfirm: () => {
                const text = document.getElementById('swalCanvasTextInput')?.value.trim();
                const size = document.getElementById('swalCanvasFontSize')?.value || '36';
                const color = document.getElementById('swalCanvasTextColor')?.value || '#ffffff';
                if (!text) {
                    Swal.showValidationMessage('Tuliskan teks terlebih dahulu');
                    return false;
                }
                return { text, size, color };
            }
        });

        if (formValues) {
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.font = `bold ${formValues.size}px sans-serif`;
            ctx.fillStyle = formValues.color;
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(formValues.text, canvas.width / 2, canvas.height / 2);
            ctx.restore();
            window.doodleHistory.push(canvas.toDataURL());
            window.saveCurrentCanvasEdit();
        }
    };

    window.toggleBatchEmojiStickerPicker = function (e) {
        if (e) e.stopPropagation();
        const picker = document.getElementById('batchEmojiStickerPicker');
        if (!picker) return;
        picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    };

    window.stampEmojiOnCanvas = function (emoji) {
        const canvas = document.getElementById('mediaEditorCanvas');
        const picker = document.getElementById('batchEmojiStickerPicker');
        if (picker) picker.style.display = 'none';
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.font = '64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);
        ctx.restore();
        window.doodleHistory.push(canvas.toDataURL());
        window.saveCurrentCanvasEdit();
    };

    window.handlePhotoStampSelected = function (input) {
        const file = input?.files && input.files[0];
        if (!file) return;
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const stampImg = new Image();
            stampImg.onload = () => {
                const ctx = canvas.getContext('2d');
                const stampW = Math.min(canvas.width * 0.35, 200);
                const stampH = (stampImg.naturalHeight / stampImg.naturalWidth) * stampW;
                const stampX = (canvas.width - stampW) / 2;
                const stampY = (canvas.height - stampH) / 2;

                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.drawImage(stampImg, stampX, stampY, stampW, stampH);
                ctx.restore();

                window.doodleHistory.push(canvas.toDataURL());
                window.saveCurrentCanvasEdit();
            };
            stampImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
        input.value = '';
    };

    window.setCanvasAspectRatioPreset = function (preset) {
        const canvas = document.getElementById('mediaEditorCanvas');
        if (!canvas || preset === 'asli') return;

        let targetRatio = 1;
        if (preset === '1:1') targetRatio = 1;
        else if (preset === '4:3') targetRatio = 4 / 3;
        else if (preset === '16:9') targetRatio = 16 / 9;
        else if (preset === '9:16') targetRatio = 9 / 16;

        const currentW = canvas.width;
        const currentH = canvas.height;
        let newW = currentW;
        let newH = Math.round(currentW / targetRatio);

        if (newH > currentH) {
            newH = currentH;
            newW = Math.round(currentH * targetRatio);
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newW;
        tempCanvas.height = newH;
        const tempCtx = tempCanvas.getContext('2d');

        const sx = Math.max(0, (currentW - newW) / 2);
        const sy = Math.max(0, (currentH - newH) / 2);
        tempCtx.drawImage(canvas, sx, sy, newW, newH, 0, 0, newW, newH);

        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempCanvas, 0, 0);

        window.doodleHistory.push(canvas.toDataURL());
        window.saveCurrentCanvasEdit();
    };

    window.setPreviewMediaWidth = function (preset) {
        const viewer = document.getElementById('mediaActiveViewerContainer');
        if (!viewer) return;
        const target = viewer.querySelector('canvas, video, .chat-doc-card, > div');
        if (!target) return;

        if (preset === 'compact') {
            target.style.width = '60%';
            target.style.maxWidth = '60%';
        } else if (preset === 'standard') {
            target.style.width = '80%';
            target.style.maxWidth = '80%';
        } else if (preset === 'full') {
            target.style.width = '100%';
            target.style.maxWidth = '100%';
        } else {
            target.style.width = '';
            target.style.maxWidth = '100%';
        }
    };

    // =========================================================================
    // VIDEO TRIMMER HELPERS
    // =========================================================================
    window.batchVideoTrimState = { start: 0, end: 100, duration: 0 };

    window.updateBatchVideoTrim = function (type) {
        const vid = document.getElementById('batchVideoPreviewPlayer');
        const sInput = document.getElementById('vTrimStartInput');
        const eInput = document.getElementById('vTrimEndInput');
        const sLabel = document.getElementById('vTrimStartTimeLabel');
        const eLabel = document.getElementById('vTrimEndTimeLabel');
        const durLabel = document.getElementById('vTrimDurationLabel');

        if (!vid || !sInput || !eInput) return;
        const totalDur = vid.duration || 60;

        let sVal = parseFloat(sInput.value);
        let eVal = parseFloat(eInput.value);

        if (sVal >= eVal) {
            if (type === 'start') sVal = Math.max(0, eVal - 1);
            else eVal = Math.min(100, sVal + 1);
            sInput.value = sVal;
            eInput.value = eVal;
        }

        const startSec = (sVal / 100) * totalDur;
        const endSec = (eVal / 100) * totalDur;
        const trimDur = Math.max(0, endSec - startSec);

        window.batchVideoTrimState = { start: startSec, end: endSec, duration: trimDur };

        if (sLabel) sLabel.innerText = formatTimeSeconds(startSec);
        if (eLabel) eLabel.innerText = formatTimeSeconds(endSec);
        if (durLabel) durLabel.innerText = `Durasi: ${trimDur.toFixed(1)}s`;

        if (type === 'start') {
            vid.currentTime = startSec;
        } else {
            vid.currentTime = endSec;
        }
    };

    window.previewBatchVideoTrim = function () {
        const vid = document.getElementById('batchVideoPreviewPlayer');
        if (!vid) return;
        vid.currentTime = window.batchVideoTrimState.start || 0;
        vid.play();
        const checkEnd = () => {
            if (vid.currentTime >= (window.batchVideoTrimState.end || vid.duration)) {
                vid.pause();
                vid.removeEventListener('timeupdate', checkEnd);
            }
        };
        vid.addEventListener('timeupdate', checkEnd);
    };

    window.applyBatchVideoTrim = function () {
        const activeItem = window.pendingMediaBatch[window.activeBatchIndex];
        if (activeItem) {
            activeItem.trimmed = true;
            activeItem.trimStart = window.batchVideoTrimState.start;
            activeItem.trimEnd = window.batchVideoTrimState.end;
        }
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Durasi video dipotong: ${(window.batchVideoTrimState.duration || 0).toFixed(1)} detik`,
            timer: 2000,
            showConfirmButton: false
        });
    };

    window.sendBatchMediaNow = async function () {
        if (!window.activeChatNik) return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
        if (window.isSendingBatchMedia) return;
        if (!window.pendingMediaBatch || window.pendingMediaBatch.length === 0) return;

        window.isSendingBatchMedia = true;
        window.saveCurrentCanvasEdit();

        const captionInp = document.getElementById('batchMediaCaptionInput');
        const captionText = captionInp ? captionInp.value.trim() : '';
        const submitBtn = document.getElementById('btnSubmitBatchMedia');
        const progContainer = document.getElementById('batchUploadProgressBarContainer');
        const progBar = document.getElementById('batchUploadProgressBar');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        }
        if (progContainer) progContainer.style.display = 'block';
        if (progBar) progBar.style.width = '20%';

        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('waktu', window.getDeviceRealtimeClock());
        formData.append('created_at', new Date().toISOString());
        if (captionText) formData.append('pesan', captionText);

        if (window.activeReplyMessage) {
            formData.append('reply_sender', window.activeReplyMessage.sender);
            formData.append('reply_text', window.activeReplyMessage.text);
            formData.append('reply_to_id', window.activeReplyMessage.id);
            window.cancelAdminReply();
        }

        for (let i = 0; i < window.pendingMediaBatch.length; i++) {
            const item = window.pendingMediaBatch[i];
            if (item.editedDataUrl) {
                const res = await fetch(item.editedDataUrl);
                const blob = await res.blob();
                formData.append('files', blob, item.name);
            } else {
                formData.append('files', item.file, item.name);
            }
        }

        if (progBar) progBar.style.width = '65%';

        try {
            const uploadRes = await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                method: 'POST',
                body: formData
            });

            if (progBar) progBar.style.width = '100%';

            if (uploadRes.ok) {
                window.pendingMediaBatch = [];
                window.closeMediaBatchModal();
                if (captionInp) captionInp.value = '';
                window.loadChatMessages(window.activeChatNik, window.activeChatName);
                window.loadChatList();
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Semua berkas berhasil dikirim',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire('Gagal', 'Terjadi kesalahan saat mengunggah berkas.', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Gagal menghubungi peladen saat mengunggah.', 'error');
        } finally {
            window.isSendingBatchMedia = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Berkas';
            }
        }
    };

    // =========================================================================
    // =========================================================================
    // VOICE NOTE RECORDING ADMIN DENGAN JEDA, LANJUTKAN, PUTAR SEMENTARA,
    // BATANG FREKUENSI MULUS, DURASI AKURAT & MULTI-LAMPIRAN HINGGA 100 BERKAS
    // =========================================================================
    window.formatAudioTime = function (sec) {
        if (!sec || isNaN(sec) || !isFinite(sec) || sec < 0) return '00:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    window.formatTimeDuration = window.formatAudioTime;

    window.isSendingVoiceRecord = false;
    window.isAdminVoicePaused = false;
    window.audioChunks = [];
    window.mediaRecorderObj = null;
    window.voiceTimerInterval = null;
    window.voiceDurationSecs = 0;
    window.adminVoiceRecordStartTime = 0;
    window.adminVoicePausedTotalMs = 0;
    window.adminVoicePauseStart = 0;
    window.adminVoiceExactDuration = 0;
    window.adminVoiceBlob = null;
    window.adminPreviewAudio = null;
    window.adminPreviewAnim = null;
    window.adminPreviewPCM = null;
    window.adminWhileRecordingAudio = null;

    // Multi-lampiran pratinjau pesan suara admin hingga 100 berkas
    window.adminVoicePreviewFiles = [];
    window.adminVoicePreviewExtraFile = null;
    window.adminVoicePreviewExtraType = null;
    window.adminVoicePreviewExtraLocation = null;

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
            window.adminVoiceRecordStartTime = Date.now();
            window.adminVoicePausedTotalMs = 0;
            window.adminVoicePauseStart = 0;
            window.adminVoiceExactDuration = 0;
            window.isAdminVoicePaused = false;
            if (window.adminWhileRecordingAudio) {
                window.adminWhileRecordingAudio.pause();
                window.adminWhileRecordingAudio = null;
            }

            const recBar = document.getElementById('adminVoiceRecordingBar');
            const previewBar = document.getElementById('adminVoicePreviewBar');
            const inputBar = document.getElementById('adminChatInputBar');
            if (recBar) recBar.style.display = 'flex';
            if (previewBar) previewBar.style.display = 'none';
            if (inputBar) inputBar.style.display = 'none';

            const pauseBtn = document.getElementById('btnAdminVoicePauseResume');
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Jeda Rekaman';
            }
            const pausePlayBtn = document.getElementById('btnAdminVoicePausePlay');
            if (pausePlayBtn) {
                pausePlayBtn.style.display = 'inline-flex';
                pausePlayBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
                pausePlayBtn.title = 'Dengarkan rekaman sejauh ini';
            }
            const statusEl = document.getElementById('adminVoiceRecordStatus');
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-wave-square"></i> Merekam...';
            const pulseDot = document.getElementById('adminVoicePulseDot');
            if (pulseDot) pulseDot.classList.remove('paused');

            const timerEl = document.getElementById('adminVoiceRecordTimer');
            if (timerEl) timerEl.innerText = '00:00';

            clearInterval(window.voiceTimerInterval);
            window.voiceTimerInterval = setInterval(() => {
                window.voiceDurationSecs++;
                const m = String(Math.floor(window.voiceDurationSecs / 60)).padStart(2, '0');
                const s = String(window.voiceDurationSecs % 60).padStart(2, '0');
                if (timerEl) timerEl.innerText = `${m}:${s}`;
            }, 1000);

            // Setup Live Audio Frequency Visualizer Berbasis Analisis Frekuensi Mikrofon Nyata
            try {
                window.liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = window.liveAudioCtx.createMediaStreamSource(micStreamRef);
                window.liveAnalyser = window.liveAudioCtx.createAnalyser();
                window.liveAnalyser.fftSize = 64;
                source.connect(window.liveAnalyser);

                const vCanvas = document.getElementById('adminLiveVoiceVisualizer');
                if (vCanvas) {
                    const vCtx = vCanvas.getContext('2d');
                    const bufferLength = window.liveAnalyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    const drawLiveFreq = () => {
                        if (!window.liveAnalyser) return;
                        window.liveVisualizerAnim = requestAnimationFrame(drawLiveFreq);
                        if (window.isAdminVoicePaused) return;

                        window.liveAnalyser.getByteFrequencyData(dataArray);

                        vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);
                        const barCount = 24;
                        const barWidth = (vCanvas.width / barCount) - 2;
                        let x = 1;

                        for (let i = 0; i < barCount; i++) {
                            const val = dataArray[i % bufferLength] || 0;
                            const pct = val / 255;
                            const barHeight = Math.max(3, pct * (vCanvas.height - 4));
                            const y = (vCanvas.height - barHeight) / 2;

                            vCtx.fillStyle = val > 40 ? '#e11d48' : '#fda4af';
                            vCtx.beginPath();
                            if (vCtx.roundRect) {
                                vCtx.roundRect(x, y, barWidth, barHeight, 2);
                            } else {
                                vCtx.rect(x, y, barWidth, barHeight);
                            }
                            vCtx.fill();
                            x += barWidth + 2;
                        }
                    };
                    drawLiveFreq();
                }
            } catch (e) {}
        } catch (err) {
            Swal.fire('Kendala Audio', 'Gagal memproses perekam suara.', 'error');
        }
    };

    // =========================================================================
    // FITUR PEMERIKSAAN SUARA SAAT JEDA (PAUSED AUDIO REVIEW, SEEK & SPEED)
    // =========================================================================
    window.adminVoicePauseSpeed = 1.0;

    window.changeAdminVoicePauseSpeed = function () {
        const speeds = [0.5, 1.0, 1.5, 2.0];
        let cur = window.adminVoicePauseSpeed || 1.0;
        let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
        window.adminVoicePauseSpeed = speeds[nextIdx];
        if (window.adminWhileRecordingAudio) {
            window.adminWhileRecordingAudio.playbackRate = window.adminVoicePauseSpeed;
        }
        const btn = document.getElementById('btnAdminVoicePauseSpeed');
        if (btn) btn.innerText = `${window.adminVoicePauseSpeed}x`;
    };

    window.seekAdminVoicePause = function (val) {
        if (!window.adminWhileRecordingAudio) return;
        const total = window.adminWhileRecordingAudio.duration || window.adminVoiceExactDuration || 1;
        const target = (parseFloat(val) / 100) * total;
        try {
            window.adminWhileRecordingAudio.currentTime = target;
        } catch (e) {}
        const curMins = String(Math.floor(target / 60)).padStart(2, '0');
        const curSecs = String(Math.floor(target % 60)).padStart(2, '0');
        const totMins = String(Math.floor(total / 60)).padStart(2, '0');
        const totSecs = String(Math.floor(total % 60)).padStart(2, '0');
        const timeEl = document.getElementById('adminVoicePauseTimer');
        if (timeEl) timeEl.innerText = `${curMins}:${curSecs} / ${totMins}:${totSecs}`;
    };

    // Tombol Putar Ulang Rekaman Sementara Saat Sedang Merekam atau Saat Dijeda
    window.togglePlayWhileRecordingAdmin = function () {
        if (!window.mediaRecorderObj) return;
        const btn = document.getElementById('btnAdminVoicePausePlay');
        const timeEl = document.getElementById('adminVoicePauseTimer');
        const seekEl = document.getElementById('adminVoicePauseSeek');

        // Jika perekaman masih berjalan aktif, jeda terlebih dahulu
        if (window.mediaRecorderObj.state === 'recording') {
            window.togglePauseAdminVoiceRecord();
            return;
        }

        // Jika audio sementara sedang memutar, jeda/pause
        if (window.adminWhileRecordingAudio && !window.adminWhileRecordingAudio.paused) {
            window.adminWhileRecordingAudio.pause();
            if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
            return;
        }

        // Jika sudah ada instance audio dan tinggal melanjutkan pemutaran
        if (window.adminWhileRecordingAudio) {
            window.adminWhileRecordingAudio.playbackRate = window.adminVoicePauseSpeed || 1.0;
            window.adminWhileRecordingAudio.play().catch(() => {});
            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
            return;
        }

        // Minta data terbaru dari recorder agar audioChunks termutakhirkan
        try {
            if (window.mediaRecorderObj.state !== 'inactive') {
                window.mediaRecorderObj.requestData();
            }
        } catch (e) {}

        setTimeout(() => {
            if (!window.audioChunks || window.audioChunks.length === 0) return;
            const currentBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.adminWhileRecordingAudio = new Audio(URL.createObjectURL(currentBlob));
            window.adminWhileRecordingAudio.playbackRate = window.adminVoicePauseSpeed || 1.0;

            const total = window.adminVoiceExactDuration || window.voiceDurationSecs || 1;
            const totMins = String(Math.floor(total / 60)).padStart(2, '0');
            const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

            window.adminWhileRecordingAudio.ontimeupdate = () => {
                if (!window.adminWhileRecordingAudio) return;
                const cur = window.adminWhileRecordingAudio.currentTime || 0;
                const curTot = window.adminWhileRecordingAudio.duration || total;
                const pct = curTot > 0 ? (cur / curTot) * 100 : 0;
                if (seekEl) seekEl.value = pct;
                const cm = String(Math.floor(cur / 60)).padStart(2, '0');
                const cs = String(Math.floor(cur % 60)).padStart(2, '0');
                if (timeEl) timeEl.innerText = `${cm}:${cs} / ${totMins}:${totSecs}`;
            };

            window.adminWhileRecordingAudio.onended = () => {
                if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
                if (seekEl) seekEl.value = 0;
                if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
            };

            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
            window.adminWhileRecordingAudio.play().catch(() => {
                if (btn) btn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
            });
        }, 80);
    };

    window.togglePauseAdminVoiceRecord = function () {
        if (!window.mediaRecorderObj) return;

        const pauseBtn = document.getElementById('btnAdminVoicePauseResume');
        const statusEl = document.getElementById('adminVoiceRecordStatus');
        const pulseDot = document.getElementById('adminVoicePulseDot');
        const activeRow = document.getElementById('adminVoiceActiveRow');
        const pausedReviewRow = document.getElementById('adminVoicePausedReviewRow');
        const timeEl = document.getElementById('adminVoicePauseTimer');
        const seekEl = document.getElementById('adminVoicePauseSeek');
        const playBtn = document.getElementById('btnAdminVoicePausePlay');

        if (window.mediaRecorderObj.state === 'recording') {
            try {
                window.mediaRecorderObj.requestData();
                window.mediaRecorderObj.pause();
            } catch (e) {}

            window.isAdminVoicePaused = true;
            window.adminVoicePauseStart = Date.now();
            clearInterval(window.voiceTimerInterval);

            const elapsedMs = (Date.now() - window.adminVoiceRecordStartTime) - window.adminVoicePausedTotalMs;
            window.adminVoiceExactDuration = Math.max(1, Math.floor(elapsedMs / 1000));
            const total = window.adminVoiceExactDuration;
            const totMins = String(Math.floor(total / 60)).padStart(2, '0');
            const totSecs = String(Math.floor(total % 60)).padStart(2, '0');

            if (activeRow) activeRow.style.display = 'none';
            if (pausedReviewRow) pausedReviewRow.style.display = 'flex';
            if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
            if (seekEl) seekEl.value = 0;
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';

            // Siapkan audio sementara untuk diperiksa
            setTimeout(() => {
                if (window.audioChunks && window.audioChunks.length > 0) {
                    const currentBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
                    if (window.adminWhileRecordingAudio) {
                        window.adminWhileRecordingAudio.pause();
                        window.adminWhileRecordingAudio = null;
                    }
                    window.adminWhileRecordingAudio = new Audio(URL.createObjectURL(currentBlob));
                    window.adminWhileRecordingAudio.playbackRate = window.adminVoicePauseSpeed || 1.0;

                    window.adminWhileRecordingAudio.ontimeupdate = () => {
                        if (!window.adminWhileRecordingAudio) return;
                        const cur = window.adminWhileRecordingAudio.currentTime || 0;
                        const curTot = window.adminWhileRecordingAudio.duration || total;
                        const pct = curTot > 0 ? (cur / curTot) * 100 : 0;
                        if (seekEl) seekEl.value = pct;
                        const cm = String(Math.floor(cur / 60)).padStart(2, '0');
                        const cs = String(Math.floor(cur % 60)).padStart(2, '0');
                        if (timeEl) timeEl.innerText = `${cm}:${cs} / ${totMins}:${totSecs}`;
                    };

                    window.adminWhileRecordingAudio.onended = () => {
                        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px;"></i>';
                        if (seekEl) seekEl.value = 0;
                        if (timeEl) timeEl.innerText = `00:00 / ${totMins}:${totSecs}`;
                    };
                }
            }, 60);

            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                pauseBtn.title = 'Lanjutkan Rekaman';
            }
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-pause-circle"></i> Dijeda';
            if (pulseDot) pulseDot.classList.add('paused');
        } else if (window.mediaRecorderObj.state === 'paused') {
            // Hentikan pemutaran sementara jika sedang didengarkan
            if (window.adminWhileRecordingAudio) {
                window.adminWhileRecordingAudio.pause();
                window.adminWhileRecordingAudio = null;
            }

            try {
                window.mediaRecorderObj.resume();
            } catch (e) {}

            window.isAdminVoicePaused = false;
            if (window.adminVoicePauseStart > 0) {
                window.adminVoicePausedTotalMs += (Date.now() - window.adminVoicePauseStart);
                window.adminVoicePauseStart = 0;
            }

            if (pausedReviewRow) pausedReviewRow.style.display = 'none';
            if (activeRow) activeRow.style.display = 'flex';

            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                pauseBtn.title = 'Jeda Rekaman';
            }
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-wave-square"></i> Merekam...';
            if (pulseDot) pulseDot.classList.remove('paused');

            clearInterval(window.voiceTimerInterval);
            window.voiceTimerInterval = setInterval(() => {
                if (!window.isAdminVoicePaused) {
                    const elapsedMs = (Date.now() - window.adminVoiceRecordStartTime) - window.adminVoicePausedTotalMs;
                    window.voiceDurationSecs = Math.floor(elapsedMs / 1000);
                    const m = String(Math.floor(window.voiceDurationSecs / 60)).padStart(2, '0');
                    const s = String(window.voiceDurationSecs % 60).padStart(2, '0');
                    const timerEl = document.getElementById('adminVoiceRecordTimer');
                    if (timerEl) timerEl.innerText = `${m}:${s}`;
                }
            }, 500);
        }
    };

    function cleanupLiveAudioVisualizer() {
        if (window.liveVisualizerAnim) {
            cancelAnimationFrame(window.liveVisualizerAnim);
            window.liveVisualizerAnim = null;
        }
        if (window.liveAudioCtx && window.liveAudioCtx.state !== 'closed') {
            try { window.liveAudioCtx.close(); } catch (e) {}
            window.liveAudioCtx = null;
        }
        window.liveAnalyser = null;
        const vCanvas = document.getElementById('adminLiveVoiceVisualizer');
        if (vCanvas) {
            const ctx = vCanvas.getContext('2d');
            ctx.clearRect(0, 0, vCanvas.width, vCanvas.height);
        }
    }

    window.cancelAdminVoiceRecord = function () {
        if (window.mediaRecorderObj && window.mediaRecorderObj.state !== 'inactive') {
            try { window.mediaRecorderObj.stop(); } catch (e) {}
        }
        if (micStreamRef) micStreamRef.getTracks().forEach(t => t.stop());
        clearInterval(window.voiceTimerInterval);
        cleanupLiveAudioVisualizer();

        if (window.adminWhileRecordingAudio) {
            window.adminWhileRecordingAudio.pause();
            window.adminWhileRecordingAudio = null;
        }

        const recBar = document.getElementById('adminVoiceRecordingBar');
        const previewBar = document.getElementById('adminVoicePreviewBar');
        const inputBar = document.getElementById('adminChatInputBar');
        const activeRow = document.getElementById('adminVoiceActiveRow');
        const pausedReviewRow = document.getElementById('adminVoicePausedReviewRow');
        if (activeRow) activeRow.style.display = 'flex';
        if (pausedReviewRow) pausedReviewRow.style.display = 'none';
        if (recBar) recBar.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (inputBar) inputBar.style.display = 'flex';
        window.audioChunks = [];
        window.isSendingVoiceRecord = false;
        window.isAdminVoicePaused = false;
        window.clearAllAdminVoicePreviewAttachments();
    };

    // Selesaikan Rekaman Suara & Masuk ke Mode Pratinjau (Bisa Didengarkan Lagi Sebelum Dikirim)
    window.stopAndPreviewAdminVoiceRecord = function () {
        if (!window.mediaRecorderObj || window.mediaRecorderObj.state === 'inactive') {
            return window.cancelAdminVoiceRecord();
        }

        if (window.adminWhileRecordingAudio) {
            window.adminWhileRecordingAudio.pause();
            window.adminWhileRecordingAudio = null;
        }

        if (window.adminVoicePauseStart > 0) {
            window.adminVoicePausedTotalMs += (Date.now() - window.adminVoicePauseStart);
            window.adminVoicePauseStart = 0;
        }
        const totalElapsedMs = Math.max(500, (Date.now() - window.adminVoiceRecordStartTime) - window.adminVoicePausedTotalMs);
        window.adminVoiceExactDuration = totalElapsedMs / 1000;

        window.mediaRecorderObj.onstop = () => {
            if (micStreamRef) micStreamRef.getTracks().forEach(t => t.stop());
            clearInterval(window.voiceTimerInterval);
            cleanupLiveAudioVisualizer();

            if (window.audioChunks.length === 0) {
                return window.cancelAdminVoiceRecord();
            }

            const recBar = document.getElementById('adminVoiceRecordingBar');
            const previewBar = document.getElementById('adminVoicePreviewBar');
            const inputBar = document.getElementById('adminChatInputBar');
            const activeRow = document.getElementById('adminVoiceActiveRow');
            const pausedReviewRow = document.getElementById('adminVoicePausedReviewRow');
            if (activeRow) activeRow.style.display = 'flex';
            if (pausedReviewRow) pausedReviewRow.style.display = 'none';
            if (recBar) recBar.style.display = 'none';
            if (inputBar) inputBar.style.display = 'none';
            if (previewBar) previewBar.style.display = 'flex';

            window.adminVoiceBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            window.audioChunks = [];

            window.initAdminVoicePreview(window.adminVoiceBlob);
        };

        window.mediaRecorderObj.stop();
    };

    window.sendAdminVoiceRecord = function () {
        window.stopAndPreviewAdminVoiceRecord();
    };

    // =========================================================================
    // KONTROL PRATINJAU SUARA ADMIN SEBELUM DIKIRIM (BATANG FREKUENSI MULUS & AKURAT)
    // =========================================================================
    window.initAdminVoicePreview = function (blob) {
        if (window.adminPreviewAudio) {
            window.adminPreviewAudio.pause();
            window.adminPreviewAudio = null;
        }
        if (window.adminPreviewAnim) {
            cancelAnimationFrame(window.adminPreviewAnim);
            window.adminPreviewAnim = null;
        }

        const previewUrl = URL.createObjectURL(blob);
        window.adminPreviewAudio = new Audio(previewUrl);

        // Tampilkan langsung durasi waktu pasti dari rekaman (Mencegah tampilan 00:00 / 00:00)
        const durSec = Math.max(0.8, window.adminVoiceExactDuration || window.voiceDurationSecs || 1);
        window.adminVoiceExactDuration = durSec;
        const timerEl = document.getElementById('adminVoicePreviewTimer');
        if (timerEl) timerEl.innerText = `00:00 / ${window.formatAudioTime(durSec)}`;

        const playBtn = document.getElementById('btnPlayAdminVoicePreview');
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.88rem;"></i>';

        const seekInp = document.getElementById('adminVoicePreviewSeek');
        if (seekInp) seekInp.value = 0;

        const speedBtn = document.getElementById('btnAdminVoicePreviewSpeed');
        if (speedBtn) speedBtn.innerText = '1x';

        // Dekode data audio untuk visualisasi gelombang frekuensi batang akurat
        const reader = new FileReader();
        reader.onload = async function () {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const tempCtx = new AudioCtx();
                const buffer = await tempCtx.decodeAudioData(reader.result);
                window.adminPreviewPCM = {
                    data: buffer.getChannelData(0),
                    sampleRate: buffer.sampleRate,
                    duration: buffer.duration
                };
                if (buffer.duration && isFinite(buffer.duration) && buffer.duration > 0) {
                    window.adminVoiceExactDuration = buffer.duration;
                    if (timerEl) {
                        const cur = window.adminPreviewAudio ? window.adminPreviewAudio.currentTime : 0;
                        timerEl.innerText = `${window.formatAudioTime(cur)} / ${window.formatAudioTime(buffer.duration)}`;
                    }
                    window.drawAdminPreviewWave(false);
                }
                tempCtx.close().catch(() => {});
            } catch (e) {
                window.adminPreviewPCM = null;
            }
        };
        reader.readAsArrayBuffer(blob);

        window.adminPreviewAudio.onloadedmetadata = () => {
            const total = window.adminVoiceExactDuration || durSec;
            if (timerEl) timerEl.innerText = `00:00 / ${window.formatAudioTime(total)}`;
            window.drawAdminPreviewWave(false);
        };

        window.adminPreviewAudio.onended = () => {
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.88rem;"></i>';
            if (seekInp) seekInp.value = 0;
            if (window.adminPreviewAnim) cancelAnimationFrame(window.adminPreviewAnim);
            const total = window.adminVoiceExactDuration || durSec;
            if (timerEl) timerEl.innerText = `00:00 / ${window.formatAudioTime(total)}`;
            window.drawAdminPreviewWave(false);
        };

        window.drawAdminPreviewWave(false);
        document.getElementById('adminVoiceCaptionInput')?.focus();
    };

    window.togglePlayAdminVoicePreview = function () {
        if (!window.adminPreviewAudio) return;
        const playBtn = document.getElementById('btnPlayAdminVoicePreview');

        if (window.adminPreviewAudio.paused) {
            window.adminPreviewAudio.play().then(() => {
                if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause" style="font-size:0.88rem;"></i>';
                const loop = () => {
                    if (window.adminPreviewAudio && !window.adminPreviewAudio.paused && !window.adminPreviewAudio.ended) {
                        window.drawAdminPreviewWave(true);
                        window.adminPreviewAnim = requestAnimationFrame(loop);
                    } else {
                        window.drawAdminPreviewWave(false);
                    }
                };
                window.adminPreviewAnim = requestAnimationFrame(loop);
            }).catch(() => {});
        } else {
            window.adminPreviewAudio.pause();
            if (playBtn) playBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px; font-size:0.88rem;"></i>';
            if (window.adminPreviewAnim) cancelAnimationFrame(window.adminPreviewAnim);
            window.drawAdminPreviewWave(false);
        }
    };

    window.seekAdminVoicePreview = function (val) {
        if (!window.adminPreviewAudio) return;
        const total = window.adminVoiceExactDuration > 0 ? window.adminVoiceExactDuration : 1;
        const target = (parseFloat(val) / 100) * total;
        try {
            window.adminPreviewAudio.currentTime = target;
        } catch (e) {}
        window.drawAdminPreviewWave(!window.adminPreviewAudio.paused);
    };

    window.changeAdminVoicePreviewSpeed = function () {
        if (!window.adminPreviewAudio) return;
        const speeds = [0.5, 1.0, 1.5, 2.0];
        let cur = window.adminPreviewAudio.playbackRate || 1.0;
        let nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
        let nextSpeed = speeds[nextIdx];
        window.adminPreviewAudio.playbackRate = nextSpeed;
        const btn = document.getElementById('btnAdminVoicePreviewSpeed');
        if (btn) btn.innerText = `${nextSpeed}x`;
    };

    // VISUALISASI GELOMBANG FREKUENSI BATANG (BAR FREQUENCY) PREVIEW ADMIN ULTRA-MULUS
    window.drawAdminPreviewWave = function (isPlaying) {
        const canvas = document.getElementById('adminVoicePreviewCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const total = window.adminVoiceExactDuration > 0 ? window.adminVoiceExactDuration : 1;
        const curTime = (window.adminPreviewAudio) ? window.adminPreviewAudio.currentTime : 0;
        const progress = Math.max(0, Math.min(1, curTime / total));

        // Update timer dan seek input secara mulus
        const timerEl = document.getElementById('adminVoicePreviewTimer');
        if (timerEl) {
            timerEl.innerText = `${window.formatAudioTime(curTime)} / ${window.formatAudioTime(total)}`;
        }
        const seekInp = document.getElementById('adminVoicePreviewSeek');
        if (seekInp && !document.activeElement?.isSameNode(seekInp)) {
            seekInp.value = progress * 100;
        }

        ctx.clearRect(0, 0, width, height);

        const barCount = 40;
        const barWidth = 3;
        const barGap = (width - (barCount * barWidth)) / (barCount - 1 || 1);

        for (let i = 0; i < barCount; i++) {
            const x = i * (barWidth + barGap);
            let barHeight = 6;

            if (window.adminPreviewPCM && window.adminPreviewPCM.data && window.adminPreviewPCM.data.length > 0) {
                const sampleIdx = Math.floor((i / barCount) * window.adminPreviewPCM.data.length);
                const step = Math.max(1, Math.floor(window.adminPreviewPCM.data.length / (barCount * 12)));
                let sum = 0;
                let count = 0;
                for (let k = sampleIdx; k < Math.min(window.adminPreviewPCM.data.length, sampleIdx + step); k += 2) {
                    sum += Math.abs(window.adminPreviewPCM.data[k]);
                    count++;
                }
                const amp = count > 0 ? (sum / count) : 0;
                barHeight = Math.max(4, Math.min(height - 2, Math.pow(amp, 0.65) * (height * 3.4)));
            } else {
                const norm = i / barCount;
                const pattern = Math.sin(norm * Math.PI) * 0.75 + Math.sin(norm * Math.PI * 3.5) * 0.25;
                barHeight = Math.max(5, Math.min(height - 4, (0.35 + 0.65 * Math.abs(pattern)) * (height - 4)));
            }

            const barProgress = (i + 0.5) / barCount;
            const isPlayed = barProgress <= progress;

            // Dinamika gelombang halus saat dimainkan
            let dynamicH = barHeight;
            if (isPlaying && Math.abs(barProgress - progress) < (2 / barCount)) {
                dynamicH = Math.min(height - 1, barHeight + Math.sin(Date.now() / 90) * 3);
            }

            const y = (height - dynamicH) / 2;

            ctx.fillStyle = isPlayed ? '#009846' : '#cbd5e1';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, barWidth, dynamicH, 2);
            } else {
                ctx.rect(x, y, barWidth, dynamicH);
            }
            ctx.fill();
        }

        // Indikator Titik Pemutar (Playhead Cursor Glow)
        const playheadX = Math.max(2, Math.min(width - 2, progress * width));
        ctx.fillStyle = '#009846';
        ctx.beginPath();
        ctx.arc(playheadX, height / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    };

    // =========================================================================
    // FITUR MULTI-LAMPIRAN (FOTO, VIDEO, DOKUMEN, DRIVE, FOTO, LOKASI) HINGGA 100 BERKAS PADA PREVIEW ADMIN
    // =========================================================================
    window.toggleAdminVoicePreviewAttachMenu = function (e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('adminVoicePreviewAttachMenu');
        if (!menu) return;
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    };

    window.triggerAdminVoicePreviewAttach = function (type) {
        const menu = document.getElementById('adminVoicePreviewAttachMenu');
        if (menu) menu.style.display = 'none';

        if (type === 'gallery') {
            document.getElementById('adminVoicePreviewGalleryInput')?.click();
        } else if (type === 'camera') {
            if (typeof window.openLiveCameraModal === 'function') {
                window.openLiveCameraModal('admin-voice-preview');
            } else {
                document.getElementById('adminVoicePreviewCameraInput')?.click();
            }
        } else if (type === 'doc') {
            document.getElementById('adminVoicePreviewDocInput')?.click();
        } else if (type === 'gdrive') {
            if (typeof window.openGoogleDrivePicker === 'function') {
                window.openGoogleDrivePicker('admin-voice-preview');
            }
        } else if (type === 'gphotos') {
            if (typeof window.openGooglePhotosPicker === 'function') {
                window.openGooglePhotosPicker('admin-voice-preview');
            }
        } else if (type === 'location') {
            window.attachLocationToAdminVoicePreview();
        }
    };

    window.attachLocationToAdminVoicePreview = function () {
        const nik = window.activeChatNik;
        let w = (window.wargaMasterList || []).find(x => x.nik === nik);
        const lat = w && w.lat ? Number(w.lat) : -7.4478;
        const lng = w && w.lng ? Number(w.lng) : 112.7183;
        const alamat = w && w.alamat ? w.alamat : 'Kabupaten Sidoarjo';

        window.adminVoicePreviewExtraLocation = {
            nik,
            nama: w ? w.nama : 'Warga Sidoarjo',
            alamat,
            lat,
            lng,
            maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
            terverifikasi: true,
            pengirim: 'petugas'
        };

        window.renderAdminVoicePreviewAttachmentChips();
    };

    // Tambah Multi-Berkas ke Pratinjau Suara Admin (Hingga 100 Berkas)
    window.addAdminVoicePreviewAttachments = function (files) {
        if (!files || files.length === 0) return;
        const MAX_FILES = 100;
        const incoming = Array.isArray(files) ? files : Array.from(files);

        if (window.adminVoicePreviewFiles.length + incoming.length > MAX_FILES) {
            Swal.fire('Batas Maksimal', `Maksimal lampiran adalah ${MAX_FILES} berkas. Berkas selebihnya diabaikan.`, 'warning');
        }

        const allowed = incoming.slice(0, MAX_FILES - window.adminVoicePreviewFiles.length);
        for (const item of allowed) {
            const fileObj = item.file || item;
            const name = item.name || fileObj.name || 'Berkas';
            const size = item.size || fileObj.size || 0;
            const type = item.type || (fileObj.type ? (fileObj.type.startsWith('image/') ? 'image' : (fileObj.type.startsWith('video/') ? 'video' : 'document')) : 'document');
            let previewThumb = null;
            if (type === 'image' && fileObj instanceof Blob) {
                previewThumb = URL.createObjectURL(fileObj);
            }

            window.adminVoicePreviewFiles.push({
                id: `voice_att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                file: fileObj,
                name: name,
                size: size,
                type: type,
                previewThumb: previewThumb,
                isGoogleDrive: Boolean(item.isGoogleDrive),
                isCloudLink: Boolean(item.isCloudLink),
                webViewLink: item.webViewLink
            });
        }

        window.renderAdminVoicePreviewAttachmentChips();
    };

    window.handleAdminVoicePreviewFileSelected = function (input, type) {
        if (!input.files || input.files.length === 0) return;
        window.addAdminVoicePreviewAttachments(input.files);
        input.value = '';
    };

    window.removeAdminVoicePreviewFile = function (index) {
        if (index >= 0 && index < window.adminVoicePreviewFiles.length) {
            const removed = window.adminVoicePreviewFiles.splice(index, 1)[0];
            if (removed && removed.previewThumb) {
                URL.revokeObjectURL(removed.previewThumb);
            }
            window.renderAdminVoicePreviewAttachmentChips();
        }
    };

    window.clearAllAdminVoicePreviewAttachments = function () {
        (window.adminVoicePreviewFiles || []).forEach(f => {
            if (f.previewThumb) URL.revokeObjectURL(f.previewThumb);
        });
        window.adminVoicePreviewFiles = [];
        window.adminVoicePreviewExtraLocation = null;
        window.renderAdminVoicePreviewAttachmentChips();

        const galleryInput = document.getElementById('adminVoicePreviewGalleryInput');
        const cameraInput = document.getElementById('adminVoicePreviewCameraInput');
        const docInput = document.getElementById('adminVoicePreviewDocInput');
        if (galleryInput) galleryInput.value = '';
        if (cameraInput) cameraInput.value = '';
        if (docInput) docInput.value = '';
    };

    window.clearAdminVoicePreviewAttachment = window.clearAllAdminVoicePreviewAttachments;

    window.renderAdminVoicePreviewAttachmentChips = function () {
        const listContainer = document.getElementById('adminVoicePreviewAttachmentList');
        const chipsContainer = document.getElementById('adminVoicePreviewAttachmentChipsContainer');
        const countLabel = document.getElementById('adminVoiceAttachmentCountLabel');

        const totalItems = (window.adminVoicePreviewFiles ? window.adminVoicePreviewFiles.length : 0) + (window.adminVoicePreviewExtraLocation ? 1 : 0);

        if (totalItems === 0) {
            if (listContainer) listContainer.style.display = 'none';
            if (chipsContainer) chipsContainer.innerHTML = '';
            return;
        }

        if (listContainer) listContainer.style.display = 'flex';
        if (countLabel) {
            countLabel.innerHTML = `<i class="fas fa-paperclip"></i> Lampiran Berkas (${totalItems})`;
        }

        if (!chipsContainer) return;
        let html = '';

        // Tampilkan Chip Lokasi Geotag jika ada
        if (window.adminVoicePreviewExtraLocation) {
            const loc = window.adminVoicePreviewExtraLocation;
            html += `
                <div style="display:flex; align-items:center; gap:8px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:6px 10px; font-size:0.75rem; white-space:nowrap; flex-shrink:0;">
                    <i class="fas fa-map-marked-alt text-emerald-600" style="font-size:0.95rem;"></i>
                    <span style="font-weight:700; color:#065f46;">Lokasi: ${loc.alamat}</span>
                    <button type="button" onclick="window.adminVoicePreviewExtraLocation=null; window.renderAdminVoicePreviewAttachmentChips();" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.85rem; padding:0 4px;" title="Hapus Lokasi">&times;</button>
                </div>
            `;
        }

        // Tampilkan Semua Berkas Lampiran (Hingga 100)
        window.adminVoicePreviewFiles.forEach((item, idx) => {
            let icon = '<i class="fas fa-file-alt" style="color:#7c3aed;"></i>';
            if (item.type === 'image') icon = '<i class="fas fa-image" style="color:#0284c7;"></i>';
            else if (item.type === 'video') icon = '<i class="fas fa-video" style="color:#e11d48;"></i>';
            if (item.isGoogleDrive) icon = '<i class="fab fa-google-drive" style="color:#f59e0b;"></i>';

            const sizeStr = item.size ? `${(item.size / (1024 * 1024)).toFixed(1)}MB` : '';
            const thumbHtml = item.previewThumb
                ? `<img src="${item.previewThumb}" style="width:24px; height:24px; border-radius:4px; object-fit:cover;">`
                : icon;

            html += `
                <div style="display:flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:5px 8px; font-size:0.75rem; white-space:nowrap; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    ${thumbHtml}
                    <span style="font-weight:700; color:#1e293b; max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</span>
                    <span style="color:#94a3b8; font-size:0.68rem;">${sizeStr}</span>
                    <button type="button" onclick="window.removeAdminVoicePreviewFile(${idx})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.85rem; padding:0 4px;" title="Hapus Berkas">&times;</button>
                </div>
            `;
        });

        chipsContainer.innerHTML = html;
    };

    window.cancelAdminVoicePreview = function () {
        if (window.adminPreviewAudio) {
            window.adminPreviewAudio.pause();
            window.adminPreviewAudio = null;
        }
        if (window.adminPreviewAnim) {
            cancelAnimationFrame(window.adminPreviewAnim);
            window.adminPreviewAnim = null;
        }
        window.adminVoiceBlob = null;
        window.clearAllAdminVoicePreviewAttachments();

        const previewBar = document.getElementById('adminVoicePreviewBar');
        const inputBar = document.getElementById('adminChatInputBar');
        if (previewBar) previewBar.style.display = 'none';
        if (inputBar) inputBar.style.display = 'flex';

        const captionInp = document.getElementById('adminVoiceCaptionInput');
        if (captionInp) captionInp.value = '';
    };

    // KIRIM PESAN SUARA ADMIN RESMI (DENGAN HINGGA 100 BERKAS LAMPIRAN, TEKS OPSIONAL)
    window.sendAdminVoiceRecordConfirmed = async function () {
        if (window.isSendingVoiceRecord) return;
        if (!window.adminVoiceBlob) {
            return window.cancelAdminVoicePreview();
        }
        if (!window.activeChatNik) {
            return Swal.fire('Peringatan', 'Pilih obrolan warga terlebih dahulu.', 'warning');
        }

        window.isSendingVoiceRecord = true;
        const sendBtn = document.getElementById('btnSendAdminVoiceConfirmed');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.6';
        }

        if (window.adminPreviewAudio) {
            window.adminPreviewAudio.pause();
            window.adminPreviewAudio = null;
        }
        if (window.adminPreviewAnim) cancelAnimationFrame(window.adminPreviewAnim);

        const audioBlobToSend = window.adminVoiceBlob;
        window.adminVoiceBlob = null;

        const filesToSend = [...(window.adminVoicePreviewFiles || [])];
        const extraLocationToSend = window.adminVoicePreviewExtraLocation;

        // Ambil keterangan teks jika admin mengetik keterangan (opsional, jika kosong JANGAN isi emoji mic!)
        const captionInp = document.getElementById('adminVoiceCaptionInput');
        const captionText = captionInp ? captionInp.value.trim() : '';
        if (captionInp) captionInp.value = '';

        window.clearAllAdminVoicePreviewAttachments();

        const recBar = document.getElementById('adminVoiceRecordingBar');
        const previewBar = document.getElementById('adminVoicePreviewBar');
        const inputBar = document.getElementById('adminChatInputBar');
        if (recBar) recBar.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (inputBar) inputBar.style.display = 'flex';

        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const nowDevice = new Date();
        const deviceTime = window.getDeviceRealtimeClock();

        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('pesan', captionText);
        formData.append('custom_file_type', 'audio');
        formData.append('file_voice', audioBlobToSend, `voice_admin_${Date.now()}.webm`);
        formData.append('waktu', deviceTime);
        formData.append('created_at', nowDevice.toISOString());

        // Lampirkan semua berkas lampiran (hingga 100 berkas)
        filesToSend.forEach((item, idx) => {
            if (item.file && item.file instanceof Blob) {
                formData.append(`file_extra_${idx}`, item.file, item.name || item.file.name);
            } else if (item.isCloudLink) {
                formData.append(`cloud_link_${idx}`, item.webViewLink || '');
            }
        });

        if (window.activeReplyMessage) {
            formData.append('reply_sender', window.activeReplyMessage.sender);
            formData.append('reply_text', window.activeReplyMessage.text);
            formData.append('reply_to_id', window.activeReplyMessage.id);
            window.cancelAdminReply();
        }

        try {
            await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                method: 'POST',
                body: formData
            });

            // Jika ada lokasi geotagging yang dilampirkan, kirimkan juga titik lokasi koordinatnya
            if (extraLocationToSend) {
                try {
                    await fetch(`${BASE_API_URL}/api/chat/share-geotag`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(extraLocationToSend)
                    });
                } catch (e) {}
            }

            if (typeof window.catatAktivitasRealtime === 'function') {
                const actDesc = captionText
                    ? `Petugas mengirim rekaman suara (Voice Note): "${captionText}" ke warga NIK ${window.activeChatNik}.`
                    : `Petugas mengirim rekaman suara (Voice Note) ke warga NIK ${window.activeChatNik}.`;
                window.catatAktivitasRealtime(actDesc, 'Petugas', 'chat');
            }

            await window.silentRefreshMessages(window.activeChatNik);
            window.loadChatList();
        } catch (err) {
            Swal.fire('Gagal', 'Pesan suara gagal dikirim.', 'error');
        } finally {
            window.isSendingVoiceRecord = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
            }
        }
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
                            const isSenderAdmin = m.sender !== 'warga' || m.pengirim === 'admin' || m.sender === 'admin' || m.sender === 'petugas' || m.is_admin === true;
                            chatBox.insertAdjacentHTML('beforeend', window.formatModernBubbleHtml(m, isSenderAdmin));
                        });
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                }
            }
        } catch (err) {}
    }

    window.addReactionToMessage = async function (msgId, emojiChar) {
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        const wrap = document.getElementById(`bubble_wrap_${msgId}`);
        if (wrap) {
            let reactEl = wrap.querySelector('.msg-reaction-display');
            if (!reactEl) {
                reactEl = document.createElement('div');
                reactEl.className = 'msg-reaction-display';
                wrap.querySelector('.chat-msg-bubble')?.appendChild(reactEl);
            }
            reactEl.innerText = emojiChar;
        }
        try {
            await apiCall(`/api/chat/react/${msgId}`, {
                method: 'POST',
                body: JSON.stringify({ reaction: emojiChar })
            });
        } catch (e) {}
    };

    window.prepareReplyMessage = function (id, sender, text, fileType = '') {
        window.activeReplyMessage = { id, sender, text, fileType };
        const bar = document.getElementById('adminReplyPreviewBar');
        const sEl = document.getElementById('adminReplySenderName');
        const tEl = document.getElementById('adminReplySnippetText');
        if (bar && sEl && tEl) {
            sEl.innerText = sender;
            const iconPrefix = fileType === 'image' ? '📷 Foto: ' :
                               fileType === 'video' ? '🎬 Video: ' :
                               fileType === 'audio' ? '🎙️ Suara: ' :
                               fileType === 'document' ? '📄 Berkas: ' : '';
            const displayText = iconPrefix + text;
            tEl.innerText = displayText.length > 70 ? displayText.substring(0, 70) + '...' : displayText;
            bar.style.display = 'flex';
        }
        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        const inp = document.getElementById('adminChatInput');
        if (inp) {
            inp.placeholder = `Membalas ${sender}...`;
            inp.focus();
        }
    };

    window.cancelAdminReply = function () {
        window.activeReplyMessage = null;
        const bar = document.getElementById('adminReplyPreviewBar');
        if (bar) bar.style.display = 'none';
        const inp = document.getElementById('adminChatInput');
        if (inp) inp.placeholder = 'Ketik balasan untuk warga... (Enter untuk kirim)';
    };
    window.cancelReplyMessage = window.cancelAdminReply;

    window.pinMessageDirect = async function (msgId, text) {
        if (!window.activeChatNik) return;
        const current = window.pinnedMessages[window.activeChatNik];
        const isAlreadyPinned = current && (current.id === msgId || current === text || (typeof current === 'object' && current.text === text));

        if (isAlreadyPinned) {
            return window.unpinCurrentMessage();
        }

        window.pinnedMessages[window.activeChatNik] = { id: msgId, text: text || 'Media Terlampir' };
        localStorage.setItem('chatPinnedMap', JSON.stringify(window.pinnedMessages));
        window.refreshPinnedBanner();

        try {
            await apiCall(`/api/chat/pin/${msgId}`, {
                method: 'POST',
                body: JSON.stringify({ is_pinned: true })
            });
        } catch (e) {}

        document.querySelectorAll('.bubble-action-dropdown').forEach(el => el.classList.remove('show'));
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Pesan berhasil disematkan',
            timer: 1600,
            showConfirmButton: false
        });
    };

    window.refreshPinnedBanner = function () {
        const banner = document.getElementById('chatPinnedBanner');
        const txt = document.getElementById('pinnedBannerText');
        if (!banner) return;

        const pinned = window.pinnedMessages[window.activeChatNik];
        if (pinned) {
            const textDisplay = typeof pinned === 'object' ? pinned.text : pinned;
            if (txt) txt.innerText = textDisplay.length > 75 ? textDisplay.substring(0, 75) + '...' : textDisplay;
            banner.style.display = 'flex';
            banner.title = 'Klik untuk lompat ke pesan yang disematkan';
            banner.onclick = window.jumpToPinnedMessage;
        } else {
            banner.style.display = 'none';
        }
    };

    window.jumpToPinnedMessage = function () {
        const pinned = window.pinnedMessages[window.activeChatNik];
        if (!pinned) return;
        const targetId = typeof pinned === 'object' ? pinned.id : null;
        let targetEl = targetId ? document.getElementById(`bubble_wrap_${targetId}`) : null;
        if (!targetEl && typeof pinned === 'string') {
            const rows = document.querySelectorAll('#adminChatMessages .chat-msg-row');
            for (const r of rows) {
                if (r.innerText.includes(pinned)) { targetEl = r; break; }
            }
        }
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.classList.remove('pinned-highlight-pulse');
            void targetEl.offsetWidth;
            targetEl.classList.add('pinned-highlight-pulse');
            setTimeout(() => targetEl.classList.remove('pinned-highlight-pulse'), 3600);
        }
    };

    window.unpinCurrentMessage = async function () {
        if (!window.activeChatNik) return;
        const pinned = window.pinnedMessages[window.activeChatNik];
        const targetId = pinned && typeof pinned === 'object' ? pinned.id : null;

        delete window.pinnedMessages[window.activeChatNik];
        localStorage.setItem('chatPinnedMap', JSON.stringify(window.pinnedMessages));
        window.refreshPinnedBanner();

        if (targetId) {
            try {
                await apiCall(`/api/chat/pin/${targetId}`, {
                    method: 'POST',
                    body: JSON.stringify({ is_pinned: false })
                });
            } catch (e) {}
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Sematan pesan dilepas',
            timer: 1500,
            showConfirmButton: false
        });
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

    // Single-media compatibility alias that delegates to multi-file batch queue
    window.handleSingleAdminMediaSelection = function (input) {
        window.handleAdminMediaSelection(input);
    };

    window.uploadDirectBlob = async function (blob, fileName) {
        if (!window.activeChatNik) return;
        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
        const formData = new FormData();
        formData.append('sender', 'petugas');
        formData.append('nama', `Dinsos Sidoarjo (${handler})`);
        formData.append('waktu', window.getDeviceRealtimeClock());
        formData.append('created_at', new Date().toISOString());
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
        formData.append('waktu', window.getDeviceRealtimeClock());
        formData.append('created_at', new Date().toISOString());
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

    // =========================================================================
    // MENU LAMPIRAN TERPADU (WHATSAPP STYLE: DOKUMEN, GALERI, KAMERA, SUARA, DRIVE, FOTO, LOKASI)
    // =========================================================================
    window.toggleAdminAttachmentMenu = function (e) {
        if (e) e.stopPropagation();
        const pop = document.getElementById('adminAttachmentMenuPopover');
        const emojiPop = document.getElementById('emojiPickerAdmin');
        if (!pop) return;

        if (emojiPop) emojiPop.style.display = 'none';

        const isVisible = pop.style.display === 'block';
        pop.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            const closeOnClickOutside = function (ev) {
                if (!pop.contains(ev.target) && ev.target.id !== 'btnAdminAttachMenu' && !ev.target.closest('#btnAdminAttachMenu')) {
                    pop.style.display = 'none';
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeOnClickOutside);
            }, 50);
        }
    };

    window.triggerAttachCategory = function (category) {
        const pop = document.getElementById('adminAttachmentMenuPopover');
        if (pop) pop.style.display = 'none';

        if (category === 'doc') {
            const input = document.getElementById('adminDocFileInput');
            if (input) input.click();
        } else if (category === 'gallery') {
            const input = document.getElementById('adminGalleryFileInput');
            if (input) input.click();
        } else if (category === 'camera') {
            if (typeof window.openLiveCameraModal === 'function') {
                window.openLiveCameraModal('admin-chat');
            } else {
                const input = document.getElementById('adminCameraInput');
                if (input) input.click();
            }
        } else if (category === 'audio') {
            const input = document.getElementById('adminAudioFileInput');
            if (input) input.click();
        } else if (category === 'location') {
            window.sendAdminGeotagLocation();
        }
    };

    // Handler untuk menerima lampiran dari Google Workspace atau Kamera Live ke obrolan admin
    window.addAdminChatAttachments = function (files) {
        if (!files || files.length === 0) return;
        const fakeInput = { files: files.map(f => f.file || f) };
        window.appendAdminMediaSelection(fakeInput);
    };

    // 1. MODAL GOOGLE DRIVE PICKER
    window.openGoogleDrivePicker = function () {
        const pop = document.getElementById('adminAttachmentMenuPopover');
        if (pop) pop.style.display = 'none';
        const modal = document.getElementById('modalGoogleDrivePicker');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeGoogleDrivePicker = function () {
        const modal = document.getElementById('modalGoogleDrivePicker');
        if (modal) modal.style.display = 'none';
    };

    window.attachGoogleDriveFile = function (fileName, fileType, downloadUrl, fileSize) {
        window.closeGoogleDrivePicker();
        if (!window.activeChatNik) {
            Swal.fire('Perhatian', 'Pilih percakapan warga terlebih dahulu.', 'warning');
            return;
        }

        // Tampilkan konfirmasi lampiran berkas dari Google Drive
        Swal.fire({
            title: 'Lampirkan Berkas Google Drive?',
            html: `
                <div style="text-align:left; font-size:0.85rem; background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0;">
                    <div><b>Nama Berkas:</b> ${window.safeHtml(fileName)}</div>
                    <div><b>Format:</b> ${fileType.toUpperCase()}</div>
                    <div><b>Ukuran:</b> ${fileSize}</div>
                    <div style="margin-top:6px; color:#059669; font-weight:700;"><i class="fab fa-google-drive"></i> Terverifikasi Sinkronisasi Google Drive</div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#009846',
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim ke Obrolan',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
                const formData = new FormData();
                formData.append('sender', 'petugas');
                formData.append('nama', `Dinsos Sidoarjo (${handler})`);
                formData.append('pesan', `[BERKAS_GOOGLE_DRIVE] ${fileName}`);
                formData.append('file_url', downloadUrl);
                formData.append('file_name', fileName);
                formData.append('file_type', fileType);

                try {
                    await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                        method: 'POST',
                        body: formData
                    });
                    if (typeof window.catatAktivitasRealtime === 'function') {
                        window.catatAktivitasRealtime(`Petugas melampirkan berkas Google Drive (${fileName}) ke warga NIK ${window.activeChatNik}.`, 'Petugas', 'media');
                    }
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                    window.loadChatList();
                    Swal.fire({ icon: 'success', title: 'Terkirim', text: 'Berkas Google Drive berhasil dikirim.', timer: 1500, showConfirmButton: false });
                } catch (e) {
                    Swal.fire('Gagal', 'Pengiriman berkas Google Drive gagal.', 'error');
                }
            }
        });
    };

    window.attachGoogleDriveCustomUrl = function () {
        const inp = document.getElementById('inputGoogleDriveLink');
        if (!inp || !inp.value.trim()) {
            Swal.fire('Perhatian', 'Silakan tempel tautan (URL) berkas Google Drive terlebih dahulu.', 'warning');
            return;
        }
        const url = inp.value.trim();
        const fileName = 'Dokumen_Google_Drive.pdf';
        window.attachGoogleDriveFile(fileName, 'pdf', url, 'Google Drive Cloud');
        inp.value = '';
    };

    // 2. MODAL GOOGLE PHOTOS PICKER
    window.openGooglePhotosPicker = function () {
        const pop = document.getElementById('adminAttachmentMenuPopover');
        if (pop) pop.style.display = 'none';
        const modal = document.getElementById('modalGooglePhotosPicker');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeGooglePhotosPicker = function () {
        const modal = document.getElementById('modalGooglePhotosPicker');
        if (modal) modal.style.display = 'none';
    };

    window.attachGooglePhoto = function (photoUrl, captionText) {
        window.closeGooglePhotosPicker();
        if (!window.activeChatNik) {
            Swal.fire('Perhatian', 'Pilih obrolan warga terlebih dahulu.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Kirim Foto Dokumentasi Lapangan?',
            imageUrl: photoUrl,
            imageWidth: 260,
            imageHeight: 180,
            imageAlt: 'Google Foto',
            html: `<div style="font-size:0.85rem; color:#475569; margin-top:6px;">${captionText || 'Dokumentasi Penyaluran Bantuan Sosial'}</div>`,
            showCancelButton: true,
            confirmButtonColor: '#009846',
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Kirim Foto',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();
                const formData = new FormData();
                formData.append('sender', 'petugas');
                formData.append('nama', `Dinsos Sidoarjo (${handler})`);
                formData.append('pesan', captionText || 'Dokumentasi Lapangan');
                formData.append('file_url', photoUrl);
                formData.append('file_name', 'Dokumentasi_Google_Foto.jpg');
                formData.append('file_type', 'image');

                try {
                    await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                        method: 'POST',
                        body: formData
                    });
                    if (typeof window.catatAktivitasRealtime === 'function') {
                        window.catatAktivitasRealtime(`Petugas mengirim foto dari Google Foto ke warga NIK ${window.activeChatNik}.`, 'Petugas', 'media');
                    }
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                    window.loadChatList();
                    Swal.fire({ icon: 'success', title: 'Terkirim', text: 'Foto berhasil dikirim ke obrolan.', timer: 1500, showConfirmButton: false });
                } catch (e) {
                    Swal.fire('Gagal', 'Pengiriman foto gagal.', 'error');
                }
            }
        });
    };

    window.attachGooglePhotosCustomUrl = function () {
        const inp = document.getElementById('inputGooglePhotosLink');
        if (!inp || !inp.value.trim()) {
            Swal.fire('Perhatian', 'Silakan tempel tautan (URL) foto atau album Google Foto terlebih dahulu.', 'warning');
            return;
        }
        const url = inp.value.trim();
        window.attachGooglePhoto(url, 'Dokumentasi Terverifikasi Lapangan');
        inp.value = '';
    };

    // 3. BAGIKAN LOKASI: 2 OPSI (LOKASI PERANGKAT REAL-TIME vs LOKASI RUMAH SESUAI ARSIP DATA WARGA)
    window.sendAdminGeotagLocation = function () {
        if (!window.activeChatNik) {
            Swal.fire('Perhatian', 'Pilih percakapan warga terlebih dahulu.', 'warning');
            return;
        }

        const warga = (window.globalDataWarga || []).find(w => String(w.nik) === String(window.activeChatNik));
        const defaultLat = warga ? (warga.lat || -7.4478) : -7.4478;
        const defaultLng = warga ? (warga.lng || 112.7183) : 112.7183;
        const defaultAlamat = warga ? (warga.alamat || 'Sidoarjo, Jawa Timur') : 'Sidoarjo, Jawa Timur';

        Swal.fire({
            title: '<i class="fas fa-map-marked-alt text-primary"></i> Pilih Opsi Berbagi Lokasi',
            html: `
                <div style="text-align:left; font-size:0.86rem; color:#334155;">
                    <p style="margin-bottom:14px; color:#64748b; line-height:1.5;">
                        Pilih jenis lokasi yang ingin Anda bagikan kepada warga dalam percakapan:
                    </p>

                    <!-- Opsi 1: Lokasi Perangkat Saat Ini (GPS Real-time) -->
                    <div id="btnOptRealtimeLoc" onclick="window.confirmSendAdminLoc('realtime')" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:2px solid #bbf7d0; border-radius:14px; background:#f0fdf4; cursor:pointer; margin-bottom:12px; transition:all 0.15s;" onmouseover="this.style.borderColor='#009846'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#bbf7d0'; this.style.transform='translateY(0)';">
                        <div style="width:38px; height:38px; border-radius:10px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                            <i class="fas fa-crosshairs"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:800; color:#15803d; font-size:0.92rem;">
                                1. Lokasi Perangkat Saya Saat Ini (GPS Real-time)
                            </div>
                            <div style="font-size:0.78rem; color:#475569; margin-top:3px; line-height:1.4;">
                                Mengambil koordinat GPS fisik akurat dari perangkat yang sedang digunakan saat ini.
                            </div>
                        </div>
                    </div>

                    <!-- Opsi 2: Lokasi Rumah Warga (Berdasarkan Arsip Data Warga) -->
                    <div id="btnOptArsipLoc" onclick="window.confirmSendAdminLoc('arsip')" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:2px solid #bfdbfe; border-radius:14px; background:#eff6ff; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#bfdbfe'; this.style.transform='translateY(0)';">
                        <div style="width:38px; height:38px; border-radius:10px; background:#dbeafe; color:#1d4ed8; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                            <i class="fas fa-home"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:800; color:#1e40af; font-size:0.92rem;">
                                2. Lokasi Rumah Warga (Arsip Data Warga)
                            </div>
                            <div style="font-size:0.78rem; color:#475569; margin-top:3px; line-height:1.4;">
                                Berdasarkan data kependudukan terdaftar: <b>${window.safeHtml(defaultAlamat)}</b> (Lat: ${defaultLat}, Lng: ${defaultLng}).
                            </div>
                        </div>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Batal',
            cancelButtonColor: '#64748b'
        });
    };

    window.confirmSendAdminLoc = async function (type) {
        Swal.close();
        if (!window.activeChatNik) return;

        const warga = (window.globalDataWarga || []).find(w => String(w.nik) === String(window.activeChatNik));
        const handler = (window.chatHandlersMap[window.activeChatNik] || 'Petugas').toUpperCase();

        if (type === 'realtime') {
            if (!navigator.geolocation) {
                return Swal.fire('Perhatian', 'Peramban ini tidak mendukung geolokasi GPS.', 'warning');
            }

            Swal.fire({
                title: 'Mendeteksi Posisi GPS...',
                text: 'Mengambil titik koordinat satelit GPS perangkat Anda...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const accuracy = Math.round(pos.coords.accuracy || 10);

                const locData = {
                    lat,
                    lng,
                    accuracy,
                    nama: `Petugas Dinsos (${handler})`,
                    nik: window.activeChatNik,
                    alamat: `Lokasi Perangkat Petugas Lapangan (Akurasi: ±${accuracy}m)`,
                    tipe: 'realtime',
                    maps_url: `https://www.google.com/maps?q=${lat},${lng}`
                };

                const formData = new FormData();
                formData.append('sender', 'petugas');
                formData.append('nama', `Dinsos Sidoarjo (${handler})`);
                formData.append('pesan', `[GEOTAG_LOKASI] ${JSON.stringify(locData)}`);

                try {
                    await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                        method: 'POST',
                        body: formData
                    });
                    if (typeof window.catatAktivitasRealtime === 'function') {
                        window.catatAktivitasRealtime(`Petugas membagikan lokasi GPS real-time ke warga NIK ${window.activeChatNik}.`, 'Petugas', 'chat');
                    }
                    window.loadChatMessages(window.activeChatNik, window.activeChatName);
                    window.loadChatList();
                    Swal.fire({ icon: 'success', title: 'Terkirim', text: 'Titik lokasi GPS perangkat berhasil dibagikan.', timer: 1500, showConfirmButton: false });
                } catch (e) {
                    Swal.fire('Gagal', 'Gagal membagikan lokasi real-time.', 'error');
                }
            }, (err) => {
                Swal.fire('Gagal Mendeteksi GPS', `Tidak dapat mengambil lokasi perangkat: ${err.message}. Pastikan izin lokasi aktif.`, 'error');
            }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        } else {
            // Opsi Arsip Data Warga
            const defaultLat = warga ? (warga.lat || -7.4478) : -7.4478;
            const defaultLng = warga ? (warga.lng || 112.7183) : 112.7183;
            const defaultAlamat = warga ? (warga.alamat || 'Sidoarjo, Jawa Timur') : 'Sidoarjo, Jawa Timur';

            const locData = {
                lat: defaultLat,
                lng: defaultLng,
                nama: window.activeChatName,
                nik: window.activeChatNik,
                alamat: defaultAlamat,
                tipe: 'arsip',
                maps_url: `https://www.google.com/maps?q=${defaultLat},${defaultLng}`
            };

            const formData = new FormData();
            formData.append('sender', 'petugas');
            formData.append('nama', `Dinsos Sidoarjo (${handler})`);
            formData.append('pesan', `[GEOTAG_LOKASI] ${JSON.stringify(locData)}`);

            try {
                await fetch(`${BASE_API_URL}/api/chat/${window.activeChatNik}`, {
                    method: 'POST',
                    body: formData
                });
                if (typeof window.catatAktivitasRealtime === 'function') {
                    window.catatAktivitasRealtime(`Petugas membagikan titik lokasi arsip warga NIK ${window.activeChatNik}.`, 'Petugas', 'chat');
                }
                window.loadChatMessages(window.activeChatNik, window.activeChatName);
                window.loadChatList();
                Swal.fire({ icon: 'success', title: 'Terkirim', text: 'Titik lokasi arsip warga berhasil dibagikan.', timer: 1500, showConfirmButton: false });
            } catch (e) {
                Swal.fire('Gagal', 'Gagal membagikan lokasi arsip.', 'error');
            }
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

    // =========================================================================
    // LIGHTBOX MULTI-MEDIA DENGAN ZOOM, ROTATE, DOWNLOAD & KONTROL SUARA LENGKAP
    // =========================================================================
    window.lightboxCurrentMedia = { url: '', type: 'image', name: '', zoom: 1, rotation: 0 };

    window.openLightbox = function (url, type = 'image', name = '') {
        const box = document.getElementById('mediaLightbox');
        const content = document.getElementById('lightboxContent');
        const imgToolbar = document.getElementById('lightboxImageToolbar');
        const vidToolbar = document.getElementById('lightboxVideoToolbar');
        if (!box || !content) return;

        window.lightboxCurrentMedia = {
            url: url,
            type: type,
            name: name || (type === 'image' ? 'Foto_Lampiran.jpg' : 'Video_Lampiran.mp4'),
            zoom: 1,
            rotation: 0
        };

        box.style.display = 'flex';

        if (type === 'image') {
            if (imgToolbar) imgToolbar.style.display = 'flex';
            if (vidToolbar) vidToolbar.style.display = 'none';
            const zoomText = document.getElementById('lightboxZoomLevelText');
            if (zoomText) zoomText.innerText = '100%';

            content.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; overflow:hidden;">
                    <img id="lightboxTargetImg" src="${url}" alt="${window.safeHtml(window.lightboxCurrentMedia.name)}" style="max-width:88vw; max-height:82vh; border-radius:12px; transition:transform 0.15s ease-out; object-fit:contain; box-shadow:0 20px 50px rgba(0,0,0,0.6);" />
                </div>
            `;
        } else if (type === 'video') {
            if (imgToolbar) imgToolbar.style.display = 'none';
            if (vidToolbar) vidToolbar.style.display = 'flex';

            const slider = document.getElementById('lightboxVolumeSlider');
            const volText = document.getElementById('lightboxVolumeText');
            const muteBtn = document.getElementById('btnLightboxMute');
            if (slider) slider.value = 1;
            if (volText) volText.innerText = '100%';
            if (muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';

            content.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
                    <video id="lightboxTargetVideo" src="${url}" controls autoplay playsinline style="max-width:88vw; max-height:82vh; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.6);"></video>
                </div>
            `;

            const vidEl = document.getElementById('lightboxTargetVideo');
            if (vidEl) {
                vidEl.onvolumechange = () => {
                    if (slider) slider.value = vidEl.muted ? 0 : vidEl.volume;
                    if (volText) volText.innerText = vidEl.muted ? '0%' : `${Math.round(vidEl.volume * 100)}%`;
                    if (muteBtn) {
                        muteBtn.innerHTML = (vidEl.muted || vidEl.volume === 0)
                            ? '<i class="fas fa-volume-mute" style="color:#ef4444;"></i>'
                            : '<i class="fas fa-volume-up"></i>';
                    }
                };
            }
        } else {
            window.open(url, '_blank');
        }
    };

    window.closeLightbox = function (e) {
        const box = document.getElementById('mediaLightbox');
        const content = document.getElementById('lightboxContent');
        if (!box) return;

        // Jika e diberikan, pastikan klik bukan di dalam toolbar kontrol atau video (kecuali tombol close atau backdrop)
        if (e && e.target && e.target !== box && !e.target.closest('.close-lightbox-btn') && e.target.innerText !== '×') {
            if (e.target.closest('#lightboxContent') || e.target.closest('#lightboxImageToolbar') || e.target.closest('#lightboxVideoToolbar') || e.target.closest('#btnLightboxDownload')) {
                return;
            }
        }

        // Hentikan dan matikan total SEMUA elemen video dan audio di lightbox
        const allMedia = box.querySelectorAll('video, audio');
        allMedia.forEach(m => {
            try {
                m.pause();
                m.muted = true;
                m.currentTime = 0;
                m.removeAttribute('src');
                m.load();
            } catch (err) {}
        });

        if (content) {
            content.innerHTML = '';
        }

        box.style.display = 'none';
        window.lightboxCurrentMedia = { url: '', type: 'image', name: '', zoom: 1, rotation: 0 };
    };

    // Tambahkan listener tombol ESC untuk menutup lightbox dan mematikan video seketika
    if (!window._lightboxEscBound) {
        window._lightboxEscBound = true;
        document.addEventListener('keydown', function (evt) {
            if (evt.key === 'Escape' || evt.keyCode === 27) {
                const box = document.getElementById('mediaLightbox');
                if (box && box.style.display !== 'none') {
                    window.closeLightbox();
                }
            }
        });
    }

    window.downloadLightboxMedia = function () {
        if (!window.lightboxCurrentMedia || !window.lightboxCurrentMedia.url) return;
        const a = document.createElement('a');
        a.href = window.lightboxCurrentMedia.url;
        a.download = window.lightboxCurrentMedia.name || 'berkas_lampiran';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.toggleLightboxFullscreen = function () {
        const box = document.getElementById('mediaLightbox');
        if (!document.fullscreenElement) {
            if (box && box.requestFullscreen) {
                box.requestFullscreen();
            } else if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    window.zoomLightbox = function (delta) {
        if (!window.lightboxCurrentMedia) return;
        let newZoom = Math.min(Math.max((window.lightboxCurrentMedia.zoom || 1) + delta, 0.3), 4.0);
        window.lightboxCurrentMedia.zoom = Math.round(newZoom * 10) / 10;
        const zoomText = document.getElementById('lightboxZoomLevelText');
        if (zoomText) zoomText.innerText = `${Math.round(window.lightboxCurrentMedia.zoom * 100)}%`;

        const img = document.getElementById('lightboxTargetImg');
        if (img) {
            img.style.transform = `scale(${window.lightboxCurrentMedia.zoom}) rotate(${window.lightboxCurrentMedia.rotation || 0}deg)`;
        }
    };

    window.rotateLightbox = function () {
        if (!window.lightboxCurrentMedia) return;
        window.lightboxCurrentMedia.rotation = ((window.lightboxCurrentMedia.rotation || 0) + 90) % 360;
        const img = document.getElementById('lightboxTargetImg');
        if (img) {
            img.style.transform = `scale(${window.lightboxCurrentMedia.zoom || 1}) rotate(${window.lightboxCurrentMedia.rotation}deg)`;
        }
    };

    window.resetLightboxTransform = function () {
        if (!window.lightboxCurrentMedia) return;
        window.lightboxCurrentMedia.zoom = 1;
        window.lightboxCurrentMedia.rotation = 0;
        const zoomText = document.getElementById('lightboxZoomLevelText');
        if (zoomText) zoomText.innerText = '100%';
        const img = document.getElementById('lightboxTargetImg');
        if (img) {
            img.style.transform = 'scale(1) rotate(0deg)';
        }
    };

    window.toggleLightboxMute = function () {
        const vid = document.getElementById('lightboxTargetVideo');
        if (!vid) return;
        vid.muted = !vid.muted;
        const muteBtn = document.getElementById('btnLightboxMute');
        const slider = document.getElementById('lightboxVolumeSlider');
        const volText = document.getElementById('lightboxVolumeText');
        if (muteBtn) {
            muteBtn.innerHTML = vid.muted
                ? '<i class="fas fa-volume-mute" style="color:#ef4444;"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
        if (slider) slider.value = vid.muted ? 0 : vid.volume;
        if (volText) volText.innerText = vid.muted ? '0%' : `${Math.round(vid.volume * 100)}%`;
    };

    window.setLightboxVolume = function (val) {
        const vid = document.getElementById('lightboxTargetVideo');
        if (!vid) return;
        const volumeVal = parseFloat(val);
        vid.volume = Math.min(Math.max(volumeVal, 0), 1);
        if (vid.volume > 0 && vid.muted) vid.muted = false;
        const volText = document.getElementById('lightboxVolumeText');
        if (volText) volText.innerText = `${Math.round(vid.volume * 100)}%`;
        const muteBtn = document.getElementById('btnLightboxMute');
        if (muteBtn) {
            muteBtn.innerHTML = vid.volume === 0
                ? '<i class="fas fa-volume-mute" style="color:#ef4444;"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
    };

    window.adjustLightboxVolume = function (delta) {
        const vid = document.getElementById('lightboxTargetVideo');
        if (!vid) return;
        let current = vid.muted ? 0 : vid.volume;
        let nextVol = Math.min(Math.max(current + delta, 0), 1);
        window.setLightboxVolume(nextVol);
        const slider = document.getElementById('lightboxVolumeSlider');
        if (slider) slider.value = nextVol;
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

                let resJson = null;
                if (res) {
                    if (typeof res.json === 'function') {
                        try { resJson = await res.json(); } catch (e) { resJson = {}; }
                    } else {
                        resJson = res;
                    }
                }

                if ((res && res.ok) || (resJson && (resJson.status === 'success' || resJson.success))) {
                    const kode = (resJson && resJson.data && resJson.data.kode_laporan) || (resJson && resJson.kode_laporan) || 'LAP-MOD-' + Date.now().toString().slice(-4);
                    Swal.fire({
                        icon: 'success',
                        title: 'Laporan Diterima',
                        text: `Pesan berhasil dilaporkan ke Pusat Moderasi & Pengawasan (${kode}).`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                    if (typeof window.updateViolationBadgeCount === 'function') {
                        window.updateViolationBadgeCount();
                    }
                } else {
                    Swal.fire('Gagal', (resJson && resJson.message) || 'Gagal mengirim laporan pelanggaran.', 'error');
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