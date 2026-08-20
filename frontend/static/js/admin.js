/* =========================================================
   ADMIN.JS - SPK BANSOS SIDOARJO (FULL NOTIFIKASI MODERN & SEARCH)
========================================================= */
const dtStyle = document.createElement('style');
dtStyle.innerHTML = `.dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: var(--text-muted); } .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); outline: none; margin: 0 8px; cursor:pointer; background: white;} .dataTables_length select:focus { border-color: var(--info); box-shadow: 0 0 0 3px #bfdbfe; } .dataTables_filter { margin-bottom: 15px; margin-top: 5px; } .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); outline: none; margin-left: 8px; width: 250px; background: white;} .dataTables_filter input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }`;
document.head.appendChild(dtStyle);

const MAP_CENTER_FALLBACK = (typeof window.COORDS_SIDOARJO_CENTER !== 'undefined') ? window.COORDS_SIDOARJO_CENTER : [-7.4478, 112.7183];
let globalDataWarga = [], detailData = null, dtTable = null, compChart = null, formMap = null, formMarker = null, macroMap = null, macroLayerGroup = null;
let user = null; try { user = JSON.parse(localStorage.getItem('bansosUser')); } catch(e) {}
let replyToDataAdmin = null, peer = null, activeCall = null, dataConnection = null, localStream = null, activeChatNik = null, activeChatName = null, callTimerAdmin = null, callSecondsAdmin = 0, isMutedAdmin = false, isVideoOffAdmin = false, isBlurred = false; 

// MEDIA & AUDIO ANALYSER GLOBAL
window.adminMediaBlob = null; 
window.adminMediaExt = ''; 
window.adminMediaType = ''; 
window.adminAudioRecorder = null;
window.adminAudioChunks = [];
window.isAdminRecordingAudio = false;
window.adminRecordTimer = null;
window.adminRecordSecs = 0;
let audioContextAdmin = null, analyserAdmin = null, dataArrayAdmin = null, reqFrameAdmin = null;

let rawChatListData = [];
let speechRecognizer = null;
window.activeChatTab = 'inbox'; 
window.activeNotifTab = 'baru'; 
window.isNotifPanelOpen = false;

function safeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function enc(str) { return encodeURIComponent(str || ''); }
function escapeInlineJS(str) { if (!str) return ''; return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, ''); }

document.addEventListener('DOMContentLoaded', async () => {
    const adminFileInput = document.getElementById('adminChatFile') || document.querySelector('input[type="file"]#chatFileAdmin');
    if (adminFileInput) {
        adminFileInput.addEventListener('change', function() {
            const file = this.files[0]; 
            if (!file) return;
            window.adminMediaBlob = file; 
            window.adminMediaExt = file.name.split('.').pop() || 'jpg'; 
            window.adminMediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document');
            window.showPreviewAdmin(URL.createObjectURL(file), window.adminMediaType, file.name);
            const inp = document.getElementById('adminChatInput');
            if (inp) inp.focus();
        });
    }

    window.setupVoiceSearchBar();
    window.setupNotificationSystemModern();

    try {
        if (typeof window.getCleanToken === "function" && window.getCleanToken()) {
            if (user) {
                document.getElementById('navUsername').innerText = user.nama_lengkap || user.username || 'Admin';
                if (user.role === 'admin') {
                    document.getElementById('navRoleBadge').className = 'role-badge role-admin'; 
                    document.getElementById('navRoleBadge').innerHTML = '<i class="fas fa-crown"></i> Admin';
                    const cmdCenter = document.getElementById('adminCommandCenter'); 
                    if(cmdCenter) cmdCenter.style.display = 'block';
                    try { window.initPeerJS(); } catch(e){}
                } else {
                    document.getElementById('navRoleBadge').className = 'role-badge role-petugas'; 
                    document.getElementById('navRoleBadge').innerHTML = '<i class="fas fa-user-edit"></i> Petugas';
                }
            } else { 
                document.getElementById('navUsername').innerText = 'Admin (Sesi Baru)'; 
            }
            try { window.loadDashboardData(); } catch(e) {}
            
            window.fetchNotifikasiRealtime(window.activeNotifTab);
            setInterval(() => { 
                window.fetchNotifikasiRealtime(window.activeNotifTab); 
            }, 4000);

            setTimeout(() => { window.tutupObrolanAktif(); }, 300);
        }
    } catch (criticalError) { }
});

// LISTENER PENCARIAN REAL-TIME
document.addEventListener('input', function(e) {
    if (e.target && (e.target.id === 'searchChatInput' || e.target.placeholder?.toLowerCase().includes('cari nama atau nik'))) {
        window.filterChatList(e.target.value);
    }
});

document.addEventListener('click', (e) => {
    if (e.target.closest('#emojiPickerAdmin') || e.target.closest('.fa-smile')) return;
    const epA = document.getElementById('emojiPickerAdmin');
    if(epA) epA.style.display = 'none';

    // TUTUP NOTIFIKASI JIKA KLIK DI LUAR
    const np = document.getElementById('ntfFloatingPanel');
    if (window.isNotifPanelOpen && !e.target.closest('#ntfFloatingPanel') && !e.target.closest('.ntf-bell-wrapper')) { 
        window.isNotifPanelOpen = false; 
        if(np) np.style.display = 'none'; 
    }

    const dd = document.getElementById('chatActionDropdown');
    if (dd && dd.style.display === 'flex' && !e.target.closest('#chatActionDropdown') && !e.target.closest('.fa-ellipsis-v')) { 
        dd.style.display = 'none'; 
    }
    if (!e.target.closest('[id^="menu-"]')) {
        document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');
    }
});

// =========================================================
// SISTEM NOTIFIKASI MODERN (UI CLEAN & RAPI)
// =========================================================
window.setupNotificationSystemModern = function() {
    let oldWrapper = document.querySelector('.notif-wrapper') || (document.querySelector('.fa-bell') ? document.querySelector('.fa-bell').closest('div') : null);
    
    // Ganti paksa struktur HTML lonceng bawaan agar bersih dari atribut click lama & teks nyasar
    if (oldWrapper && !oldWrapper.dataset.modernized) {
        let newWrapper = document.createElement('div');
        newWrapper.className = 'ntf-bell-wrapper';
        newWrapper.dataset.modernized = 'true';
        newWrapper.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.toggleNotifPanel(); };
        
        newWrapper.innerHTML = `
            <div class="ntf-bell-btn">
                <i class="fas fa-bell"></i>
            </div>
            <span id="ntfBadgeCount" class="ntf-badge-number" style="display:none;">0</span>
        `;
        oldWrapper.replaceWith(newWrapper);
    }

    // Bangun Panel Notifikasi Mengambang (Inject di body)
    let panel = document.getElementById('ntfFloatingPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'ntfFloatingPanel';
        document.body.appendChild(panel);
    }

    panel.className = 'ntf-floating-panel';
    panel.innerHTML = `
        <div class="ntf-header">
            <h4><i class="fas fa-bell" style="color:var(--primary);"></i> Notifikasi Sistem</h4>
            <div style="display:flex; gap:12px; align-items:center;">
                <button type="button" onclick="window.clearAllNotifications()" style="background:none; border:none; color:#ef4444; font-size:0.8rem; font-weight:700; cursor:pointer; transition:0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" title="Hapus Semua Non-Arsip"><i class="fas fa-trash-alt"></i> Bersihkan</button>
                <i class="fas fa-times" style="cursor:pointer; color:#94a3b8; font-size:1.2rem; padding:4px; transition:0.2s;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='#94a3b8'" onclick="window.toggleNotifPanel()"></i>
            </div>
        </div>
        <div class="ntf-tabs">
            <button type="button" id="tabNotifBaru" class="ntf-tab-btn active" onclick="window.switchNotifTab('baru')">Terbaru</button>
            <button type="button" id="tabNotifArsip" class="ntf-tab-btn" onclick="window.switchNotifTab('arsip')">Diarsipkan</button>
        </div>
        <div id="ntfBodyList" class="ntf-body">
            <div style="text-align:center; padding:40px; color:#94a3b8;">Memuat data...</div>
        </div>
    `;
};

window.toggleNotifPanel = function() {
    const panel = document.getElementById('ntfFloatingPanel');
    if (!panel) return;
    window.isNotifPanelOpen = !window.isNotifPanelOpen;
    panel.style.display = window.isNotifPanelOpen ? 'flex' : 'none';
    if (window.isNotifPanelOpen) {
        window.fetchNotifikasiRealtime(window.activeNotifTab);
    }
};

window.switchNotifTab = function(tab) {
    window.activeNotifTab = tab;
    const btnBaru = document.getElementById('tabNotifBaru');
    const btnArsip = document.getElementById('tabNotifArsip');
    if (tab === 'baru') {
        if (btnBaru) btnBaru.className = 'ntf-tab-btn active';
        if (btnArsip) btnArsip.className = 'ntf-tab-btn';
    } else {
        if (btnArsip) btnArsip.className = 'ntf-tab-btn active';
        if (btnBaru) btnBaru.className = 'ntf-tab-btn';
    }
    window.fetchNotifikasiRealtime(tab);
};

window.fetchNotifikasiRealtime = async function(tabType = 'baru') {
    try {
        const res = await window.fetchData('/api/notifikasi');
        if (!res.ok) return;
        let data = await res.json();
        if (!Array.isArray(data)) data = [];

        // Update Lencana Angka Merah di Atas Lonceng
        const unreadCount = data.filter(n => !n.is_read && !n.is_archived).length;
        const badge = document.getElementById('ntfBadgeCount');
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.title = `${unreadCount} Pemberitahuan Baru`;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        const listContainer = document.getElementById('ntfBodyList');
        if (!listContainer || !window.isNotifPanelOpen) return;

        let filtered = tabType === 'arsip' ? data.filter(n => n.is_archived) : data.filter(n => !n.is_archived);

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:60px 20px; color:#94a3b8; font-size:0.95rem;"><i class="fas fa-check-circle fa-3x" style="color:#dcfce7; margin-bottom:15px;"></i><br>Semua pesan sudah dibaca. Tidak ada notifikasi ${tabType === 'arsip' ? 'di arsip' : 'baru'}.</div>`;
            return;
        }

        // Klasifikasi
        const isUrgent = (msg) => /🚨|⛔|DARURAT|PELECEHAN|DIHAPUS|KATA SANDI|SENGKETA/i.test(msg);
        let urgentList = filtered.filter(n => isUrgent(n.pesan));
        let regularList = filtered.filter(n => !isUrgent(n.pesan));

        let html = '';

        if (urgentList.length > 0) {
            html += `
                <div class="ntf-sec-title ntf-sec-urgent">
                    <i class="fas fa-fire-alt"></i> Kategori Utama (Tindakan) - ${urgentList.length}
                </div>
            `;
            urgentList.forEach(n => { html += window.generateNotifItemHTML(n, true); });
        }

        if (regularList.length > 0) {
            html += `
                <div class="ntf-sec-title ntf-sec-regular">
                    <i class="fas fa-info-circle"></i> Kategori Reguler (Informasi) - ${regularList.length}
                </div>
            `;
            regularList.forEach(n => { html += window.generateNotifItemHTML(n, false); });
        }

        listContainer.innerHTML = html;
    } catch(e) {}
};

window.generateNotifItemHTML = function(n, isUrgentFlag) {
    let iconClass = 'info';
    let iconFa = 'fa-bell';
    
    if (/🚨|⛔|PELECEHAN|DARURAT/i.test(n.pesan)) {
        iconClass = 'urgent'; iconFa = 'fa-exclamation-triangle';
    } else if (/✅|🎉|📦|DITERIMA|TUNTAS/i.test(n.pesan)) {
        iconClass = 'success'; iconFa = 'fa-check';
    } else if (/🔑|👥|🗑️|PROFIL|AKUN/i.test(n.pesan)) {
        iconClass = 'warning'; iconFa = 'fa-user-shield';
    } else if (/📄|📊|SK|LAPORAN/i.test(n.pesan)) {
        iconClass = 'info'; iconFa = 'fa-file-download';
    }

    // Badge "N" Mini untuk notifikasi belum dibaca
    const newBadgeMini = !n.is_read ? `<span class="ntf-n-mini">N</span>` : '';

    return `
        <div class="ntf-item ${!n.is_read ? 'unread' : ''} ${isUrgentFlag ? 'urgent' : ''} ${n.is_pinned ? 'pinned' : ''}" onclick="window.handleNotifClick(${n.id}, '${escapeInlineJS(n.pesan)}')">
            <div class="ntf-icon ${iconClass}">
                <i class="fas ${iconFa}"></i>
            </div>
            <div class="ntf-content">
                <div class="ntf-msg">${newBadgeMini}${safeHtml(n.pesan)}</div>
                <div class="ntf-time"><i class="fas fa-clock"></i> ${n.waktu} ${n.is_pinned ? ' <span style="color:#f59e0b; margin-left:4px;">• 📌 Disematkan</span>' : ''}</div>
            </div>
            <div class="ntf-actions" onclick="event.stopPropagation()">
                <button type="button" class="ntf-action-btn" onclick="window.pinNotifikasiAction(${n.id})" title="${n.is_pinned ? 'Lepas Pin' : 'Sematkan'}">
                    <i class="fas fa-thumbtack ${n.is_pinned ? 'text-accent' : ''}"></i>
                </button>
                <button type="button" class="ntf-action-btn" onclick="window.archiveNotifikasiAction(${n.id})" title="${n.is_archived ? 'Buka dari Arsip' : 'Arsipkan'}">
                    <i class="fas fa-archive"></i>
                </button>
                <button type="button" class="ntf-action-btn text-danger" onclick="window.deleteNotifikasiAction(${n.id})" title="Hapus Notifikasi">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
};

window.handleNotifClick = async function(id, pesan) {
    await window.fetchData(`/api/notifikasi/${id}/read`, { method: 'PATCH' });
    window.fetchNotifikasiRealtime(window.activeNotifTab);

    if (/PELECEHAN/i.test(pesan)) {
        window.bukaModalLaporanChat();
    } else if (/DARURAT BANSOS|SENGKETA|PESAN MASUK/i.test(pesan)) {
        window.openAdminChat();
    } else if (/AKUN|KATA SANDI/i.test(pesan) && user && user.role === 'admin') {
        window.bukaModalPengguna();
    }
};

window.pinNotifikasiAction = async function(id) {
    await window.fetchData(`/api/notifikasi/${id}/pin`, { method: 'PATCH' });
    window.fetchNotifikasiRealtime(window.activeNotifTab);
};

window.archiveNotifikasiAction = async function(id) {
    await window.fetchData(`/api/notifikasi/${id}/archive`, { method: 'PATCH' });
    window.fetchNotifikasiRealtime(window.activeNotifTab);
};

window.deleteNotifikasiAction = async function(id) {
    await window.fetchData(`/api/notifikasi/${id}`, { method: 'DELETE' });
    window.fetchNotifikasiRealtime(window.activeNotifTab);
};

window.clearAllNotifications = async function() {
    if (confirm('Bersihkan semua pemberitahuan non-arsip?')) {
        await window.fetchData('/api/notifikasi/clear', { method: 'POST' });
        window.fetchNotifikasiRealtime(window.activeNotifTab);
    }
};

// =========================================================
// PEMICU NOTIFIKASI UNDUH SK & LAPORAN VERIFIKASI
// =========================================================
window.cetakSKBupati = async function() {
    const petugas = user ? (user.nama_lengkap || user.username) : 'Petugas';
    await window.fetchData('/api/notifikasi/send', {
        method: 'POST',
        body: JSON.stringify({
            pesan: `📄 PENGUNDUHAN SK BANSOS: ${petugas} mengunduh / mencetak berkas Surat Keputusan (SK) Bansos Bupati.`,
            role_target: 'all'
        })
    });
    window.print();
};

window.unduhLaporanVerifikasi = async function() {
    const petugas = user ? (user.nama_lengkap || user.username) : 'Petugas';
    await window.fetchData('/api/notifikasi/send', {
        method: 'POST',
        body: JSON.stringify({
            pesan: `📊 PENGUNDUHAN LAPORAN: ${petugas} mengunduh Laporan Hasil Verifikasi dan Komparasi Algoritma SPK.`,
            role_target: 'all'
        })
    });
    Swal.fire('Laporan Terunduh', 'Dokumen verifikasi algoritma berhasil diunduh.', 'success');
};

// =========================================================
// SPEECH-TO-TEXT DENGAN FUZZY MATCH & NUMBER PARSER
// =========================================================
window.setupVoiceSearchBar = function() {
    const inputSearch = document.getElementById('searchChatInput') || document.querySelector('input[placeholder*="Cari Nama atau NIK"]');
    if (!inputSearch) return;
    
    inputSearch.id = 'searchChatInput';
    const parent = inputSearch.parentElement;
    
    const oldIcons = parent.querySelectorAll('.fa-search, .search-icon-left, #btnVoiceSearchContact');
    oldIcons.forEach(el => el.remove());
    
    parent.className = 'search-chat-wrapper';
    
    const searchIcon = document.createElement('i');
    searchIcon.className = 'fas fa-search search-icon-left';
    parent.insertBefore(searchIcon, inputSearch);
    
    inputSearch.autocomplete = "off";
    
    const micBtn = document.createElement('button');
    micBtn.type = 'button';
    micBtn.id = 'btnVoiceSearchContact';
    micBtn.className = 'btn-voice-search';
    micBtn.title = 'Pencarian Cerdas dengan Suara';
    micBtn.innerHTML = `<i class="fas fa-microphone"></i>`;
    micBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.startVoiceSearchContact(); };
    parent.appendChild(micBtn);

    if (!document.getElementById('voiceSearchRadarModal')) {
        const modalEl = document.createElement('div');
        modalEl.id = 'voiceSearchRadarModal';
        modalEl.className = 'voice-search-modal';
        modalEl.innerHTML = `
            <div class="voice-search-card">
                <div class="voice-radar-wrapper">
                    <div class="voice-radar-ring"></div>
                    <div class="voice-radar-icon"><i class="fas fa-microphone"></i></div>
                </div>
                <h3 style="margin:0 0 6px 0; color:#0f172a; font-size:1.25rem; font-weight:800;">Mendengarkan Suara...</h3>
                <p style="margin:0 0 10px 0; color:#64748b; font-size:0.85rem;">Sebutkan Nama Warga atau Digit NIK</p>
                <div id="voiceLiveTranscript" class="voice-transcript-text">Ucapkan sekarang...</div>
                <button type="button" onclick="window.stopVoiceSearchContact()" class="btn btn-secondary" style="margin-top:15px; border-radius:25px; font-size:0.85rem; padding:8px 24px;"><i class="fas fa-times"></i> Selesai / Batal</button>
            </div>
        `;
        document.body.appendChild(modalEl);
    }
};

window.smartFuzzyVoiceMatch = function(spokenText) {
    if (!spokenText) return '';
    let raw = spokenText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();

    const numberMap = {
        'nol': '0', 'kosong': '0', 'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4',
        'lima': '5', 'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9'
    };

    let words = raw.split(/\s+/);
    let convertedWords = words.map(w => numberMap[w] !== undefined ? numberMap[w] : w);
    let digitString = convertedWords.join('');

    if (/^\d{3,}$/.test(digitString)) {
        return digitString;
    }

    let parsedSpoken = convertedWords.join(' ');
    let bestMatchName = parsedSpoken;
    let highestScore = 0;

    globalDataWarga.forEach(w => {
        let wName = (w.nama || '').toLowerCase();
        let score = 0;
        let spokenParts = parsedSpoken.split(' ');
        spokenParts.forEach(p => {
            if (p.length >= 2 && wName.includes(p)) score += p.length * 2;
        });
        if (score > highestScore && score >= 4) {
            highestScore = score;
            bestMatchName = w.nama;
        }
    });

    return bestMatchName;
};

window.startVoiceSearchContact = function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return Swal.fire('Browser Tidak Mendukung', 'Gunakan browser Google Chrome atau Microsoft Edge.', 'warning');
    }

    try {
        speechRecognizer = new SpeechRecognition();
        speechRecognizer.lang = 'id-ID';
        speechRecognizer.continuous = false;
        speechRecognizer.interimResults = true;
        speechRecognizer.maxAlternatives = 5;

        const modal = document.getElementById('voiceSearchRadarModal');
        const transcriptEl = document.getElementById('voiceLiveTranscript');
        const micBtn = document.getElementById('btnVoiceSearchContact');

        if (modal) modal.style.display = 'flex';
        if (micBtn) micBtn.classList.add('listening-active');
        if (transcriptEl) transcriptEl.innerText = 'Mendengarkan...';

        speechRecognizer.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                interimTranscript += event.results[i][0].transcript;
            }
            if (transcriptEl) transcriptEl.innerText = interimTranscript || 'Mendengarkan...';

            if (event.results[0].isFinal) {
                let spokenRaw = event.results[0][0].transcript;
                let matchedQuery = window.smartFuzzyVoiceMatch(spokenRaw);

                window.stopVoiceSearchContact();

                const searchInp = document.getElementById('searchChatInput') || document.querySelector('input[placeholder*="Cari Nama atau NIK"]');
                if (searchInp) {
                    searchInp.value = matchedQuery;
                    window.filterChatList(matchedQuery);
                }

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Mencari: "${matchedQuery}"`,
                    showConfirmButton: false,
                    timer: 2200
                });
            }
        };

        speechRecognizer.onerror = () => { window.stopVoiceSearchContact(); };
        speechRecognizer.onend = () => { window.stopVoiceSearchContact(); };

        speechRecognizer.start();
    } catch(err) {
        window.stopVoiceSearchContact();
    }
};

window.stopVoiceSearchContact = function() {
    if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch(e){}
    }
    const modal = document.getElementById('voiceSearchRadarModal');
    const micBtn = document.getElementById('btnVoiceSearchContact');
    if (modal) modal.style.display = 'none';
    if (micBtn) micBtn.classList.remove('listening-active');
};

// FILTER PENCARIAN 0 MS
window.filterChatList = function(keyword = '') {
    const rawVal = (typeof keyword === 'string' ? keyword : (document.getElementById('searchChatInput')?.value || ''));
    const searchVal = rawVal.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();

    window.renderCategorizedInbox(searchVal);
    window.renderCategorizedBukuKontak(searchVal);
};

window.renderCategorizedInbox = function(query = '') {
    const container = document.getElementById('chatContactList');
    if (!container) return;

    let pinned = [];
    try { pinned = JSON.parse(localStorage.getItem('pinnedChatsAdmin')) || []; } catch(e){}

    let list = [...rawChatListData];
    const cleanQuery = (query || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();
    
    if (cleanQuery) {
        const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
        list = list.filter(item => {
            const nameStr = (item.nama || '').toLowerCase();
            const nikStr = String(item.nik || '').toLowerCase();
            const msgStr = (item.last_msg || '').toLowerCase();
            const combined = `${nameStr} ${nikStr} ${msgStr}`;
            return terms.every(term => combined.includes(term));
        });
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="chat-empty-search"><i class="fas fa-search fa-2x" style="opacity:0.3; margin-bottom:10px;"></i><br>Tidak ditemukan obrolan yang cocok dengan "<b>${safeHtml(query)}</b>"</div>`;
        return;
    }

    let pinnedList = list.filter(c => pinned.includes(c.nik));
    let regularList = list.filter(c => !pinned.includes(c.nik));

    let html = '';

    if (pinnedList.length > 0) {
        html += `
            <div class="chat-category-header">
                <span class="category-badge"><i class="fas fa-thumbtack text-accent"></i> Pesan Disematkan</span>
                <span class="category-count">${pinnedList.length}</span>
            </div>
        `;
        pinnedList.forEach(c => {
            html += window.generateContactItemHTML(c, true, cleanQuery, false);
        });
    }

    if (regularList.length > 0) {
        let grouped = {};
        regularList.forEach(c => {
            let initial = '';
            if (cleanQuery && !isNaN(cleanQuery.charAt(0))) {
                initial = `Prefix NIK: ${(c.nik || '0000').substring(0, 4)}`;
            } else {
                initial = (c.nama || 'A').charAt(0).toUpperCase();
                if (!/[A-Z]/.test(initial)) initial = '#';
            }
            if (!grouped[initial]) grouped[initial] = [];
            grouped[initial].push(c);
        });

        const sortedKeys = Object.keys(grouped).sort();
        sortedKeys.forEach(k => {
            html += `
                <div class="chat-category-header">
                    <span class="category-badge"><i class="fas fa-folder-open text-primary"></i> ${k}</span>
                    <span class="category-count">${grouped[k].length} Kontak</span>
                </div>
            `;
            grouped[k].forEach(c => {
                html += window.generateContactItemHTML(c, false, cleanQuery, false);
            });
        });
    }

    container.innerHTML = html;
};

window.renderCategorizedBukuKontak = function(query = '') {
    const container = document.getElementById('chatBukuKontakList');
    if (!container) return;

    let list = [...globalDataWarga];
    const cleanQuery = (query || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();
    
    if (cleanQuery) {
        const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
        list = list.filter(w => {
            const nameStr = (w.nama || '').toLowerCase();
            const nikStr = String(w.nik || '').toLowerCase();
            const combined = `${nameStr} ${nikStr}`;
            return terms.every(term => combined.includes(term));
        });
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="chat-empty-search"><i class="fas fa-user-slash fa-2x" style="opacity:0.3; margin-bottom:10px;"></i><br>Tidak ada kontak yang cocok dengan "<b>${safeHtml(query)}</b>"</div>`;
        return;
    }

    let grouped = {};
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || '')).forEach(w => {
        let initial = (w.nama || 'A').charAt(0).toUpperCase();
        if (!/[A-Z]/.test(initial)) initial = '#';
        if (!grouped[initial]) grouped[initial] = [];
        grouped[initial].push(w);
    });

    let html = '';
    const sortedKeys = Object.keys(grouped).sort();
    sortedKeys.forEach(k => {
        html += `
            <div class="chat-category-header">
                <span class="category-badge"><i class="fas fa-address-book text-info"></i> Direktori ${k}</span>
                <span class="category-count">${grouped[k].length} Orang</span>
            </div>
        `;
        grouped[k].forEach(w => {
            html += window.generateContactItemHTML(w, false, cleanQuery, true);
        });
    });

    container.innerHTML = html;
};

window.generateContactItemHTML = function(c, isPinned = false, query = '', isBukuKontak = false) {
    let isActive = c.nik === activeChatNik ? 'active' : '';
    let namaKontak = c.nama || 'Anonim';
    let highlightedName = window.highlightSearchMatch(namaKontak, query);
    let highlightedNik = window.highlightSearchMatch(c.nik, query);
    let initialLetter = namaKontak.charAt(0).toUpperCase();

    let clickFn = isBukuKontak ? 
        `window.switchChatTab('inbox'); window.loadChatMessages(decodeURIComponent('${enc(c.nik)}'), decodeURIComponent('${enc(namaKontak)}'))` : 
        `window.loadChatMessages(decodeURIComponent('${enc(c.nik)}'), decodeURIComponent('${enc(namaKontak)}'))`;

    let subTextHtml = isBukuKontak ? 
        `<div class="contact-nik"><i class="fas fa-id-card" style="font-size:0.7rem;"></i> ${highlightedNik}</div>` : 
        `<div class="contact-nik"><i class="fas fa-id-card" style="font-size:0.7rem;"></i> ${highlightedNik}</div><div class="contact-last-msg">${safeHtml(c.last_msg)}</div>`;

    return `
        <div class="chat-contact-item ${isActive} ${isBukuKontak ? 'kontak-item' : ''}" onclick="${clickFn}">
            <div class="contact-avatar">${initialLetter}</div>
            <div class="contact-info">
                <div class="contact-name">
                    <span>${highlightedName}</span>
                    ${isPinned ? '<span style="background:#fef3c7; color:#b45309; font-size:0.65rem; padding:2px 6px; border-radius:10px; font-weight:700;"><i class="fas fa-thumbtack"></i> Pin</span>' : ''}
                </div>
                ${subTextHtml}
            </div>
        </div>
    `;
};

window.highlightSearchMatch = function(text, query) {
    if (!query || !text) return safeHtml(text);
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    let result = safeHtml(text);
    terms.forEach(t => {
        const cleanT = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (cleanT.length > 0) {
            const regex = new RegExp(`(${cleanT})`, 'gi');
            result = result.replace(regex, `<span class="search-match-highlight">$1</span>`);
        }
    });
    return result;
};

// =========================================================
// PEREKAM SUARA REAL-TIME 20 GELOMBANG
// =========================================================
window.toggleVoiceRecordAdmin = async function() {
    if (!window.isAdminRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.adminAudioChunks = [];
            window.adminAudioRecorder = new MediaRecorder(stream);
            
            window.adminAudioRecorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) window.adminAudioChunks.push(e.data);
            };

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContextAdmin = new AudioCtx();
            const source = audioContextAdmin.createMediaStreamSource(stream);
            analyserAdmin = audioContextAdmin.createAnalyser();
            analyserAdmin.fftSize = 64;
            analyserAdmin.smoothingTimeConstant = 0.5;
            source.connect(analyserAdmin);
            dataArrayAdmin = new Uint8Array(analyserAdmin.frequencyBinCount);

            window.adminAudioRecorder.onstop = () => {
                const audioBlob = new Blob(window.adminAudioChunks, { type: 'audio/webm' });
                window.adminMediaBlob = audioBlob;
                window.adminMediaExt = 'webm';
                window.adminMediaType = 'audio';
                window.isAdminRecordingAudio = false;
                clearInterval(window.adminRecordTimer);

                if (reqFrameAdmin) cancelAnimationFrame(reqFrameAdmin);
                if (audioContextAdmin && audioContextAdmin.state !== 'closed') audioContextAdmin.close().catch(()=>{});

                const recUI = document.getElementById('adminRecordingUI');
                if(recUI) recUI.style.display = 'none';
                const inp = document.getElementById('adminChatInput');
                if(inp) inp.style.display = 'block';
                const btnRec = document.getElementById('btnRecordAdmin') || document.querySelector('.fa-microphone')?.parentElement;
                if(btnRec) btnRec.style.color = 'var(--text-muted)';

                window.showPreviewAdmin(URL.createObjectURL(audioBlob), 'audio', 'Pesan_Suara.webm');
            };

            window.adminAudioRecorder.start();
            window.isAdminRecordingAudio = true;
            window.adminRecordSecs = 0;

            let recUI = document.getElementById('adminRecordingUI');
            const inp = document.getElementById('adminChatInput');
            if (!recUI && inp) {
                recUI = document.createElement('div');
                recUI.id = 'adminRecordingUI';
                inp.parentElement.insertBefore(recUI, inp);
            }

            if (recUI) {
                recUI.style.cssText = "display: flex; flex: 1; align-items: center; gap: 10px; padding: 8px 18px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 30px; color: #dc2626; font-weight: 700; font-size: 0.9rem;";
                
                let barsHtml = `<div id="adminWaveBarsBox" style="display:flex; align-items:center; justify-content:center; gap:3px; height:32px; flex:1; overflow:hidden;">`;
                for(let i = 0; i < 20; i++) {
                    barsHtml += `<div class="live-freq-bar" style="width:3.5px; height:4px; background:#ef4444; border-radius:3px; transition: height 0.05s ease, background 0.1s ease;"></div>`;
                }
                barsHtml += `</div>`;
                
                recUI.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-circle" style="color:#ef4444; font-size:0.7rem; animation: pulse 1s infinite;"></i>
                        <span id="adminRecordTime" style="font-family:monospace; font-size:1rem; color:#b91c1c;">00:00</span>
                    </div>
                    ${barsHtml}
                    <span style="font-size:0.75rem; color:#991b1b; white-space:nowrap; opacity:0.85;">Merekam...</span>
                `;
                recUI.style.display = 'flex';
            }

            if(inp) inp.style.display = 'none';
            const btnRec = document.getElementById('btnRecordAdmin') || document.querySelector('.fa-microphone')?.parentElement;
            if(btnRec) btnRec.style.color = 'var(--danger)';

            function renderAudioFrequency() {
                if (!window.isAdminRecordingAudio) return;
                reqFrameAdmin = requestAnimationFrame(renderAudioFrequency);
                if (!analyserAdmin) return;

                analyserAdmin.getByteFrequencyData(dataArrayAdmin);
                const bars = document.querySelectorAll('#adminWaveBarsBox .live-freq-bar');
                if (bars && bars.length > 0) {
                    const step = Math.floor(dataArrayAdmin.length / bars.length) || 1;
                    bars.forEach((bar, idx) => {
                        const val = dataArrayAdmin[idx * step] || 0;
                        const waveHeight = Math.max(4, Math.min(30, (val / 255) * 32));
                        bar.style.height = `${waveHeight}px`;
                        bar.style.background = val > 140 ? '#991b1b' : (val > 70 ? '#ef4444' : '#fca5a5');
                    });
                }
            }
            renderAudioFrequency();

            window.adminRecordTimer = setInterval(() => {
                window.adminRecordSecs++;
                const m = String(Math.floor(window.adminRecordSecs/60)).padStart(2,'0');
                const s = String(window.adminRecordSecs%60).padStart(2,'0');
                const timerEl = document.getElementById('adminRecordTime');
                if(timerEl) timerEl.innerText = `${m}:${s}`;
            }, 1000);

        } catch(err) {
            Swal.fire('Akses Mikrofon Ditolak', 'Mohon izinkan akses mikrofon di browser.', 'error');
        }
    } else {
        if(window.adminAudioRecorder && window.adminAudioRecorder.state !== 'inactive') {
            window.adminAudioRecorder.stop();
            window.adminAudioRecorder.stream.getTracks().forEach(t => t.stop());
        }
    }
};

// PRATINJAU MEDIA
window.showPreviewAdmin = function(srcUrl, type, fname = '') { 
    let previewContainer = document.getElementById('previewMediaContainerAdmin') || document.getElementById('previewMediaContainer'); 
    let previewArea = document.getElementById('preSendPreviewAdmin') || document.getElementById('preSendPreview'); 
    
    if(previewArea && previewContainer) {
        if(type === 'image') { 
            previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height: 140px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`; 
        } else if(type === 'video') { 
            previewContainer.innerHTML = `<video src="${srcUrl}" controls style="max-height: 140px; border-radius: 8px;"></video>`; 
        } else if (type === 'audio') { 
            previewContainer.innerHTML = `<audio src="${srcUrl}" controls style="height: 40px; border-radius:20px;"></audio>`; 
        } else { 
            previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info); text-align:center;"><i class="fas fa-file-alt fa-2x"></i><br><small>${fname}</small></div>`; 
        } 
        previewArea.style.display = 'block'; 
    }
};

window.batalLampiran = window.batalLampiranAdmin = function() { 
    window.adminMediaBlob = null; 
    window.adminMediaExt = ''; 
    window.adminMediaType = ''; 
    const fileInput = document.getElementById('adminChatFile'); 
    if(fileInput) fileInput.value = ''; 
    ['preSendPreviewAdmin', 'preSendPreview'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    ['previewMediaContainerAdmin', 'previewMediaContainer'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '';
    });
};

// KIRIM PESAN
window.sendAdminChat = async function() { 
    if (window.isAdminRecordingAudio) {
        if (window.adminAudioRecorder && window.adminAudioRecorder.state !== 'inactive') {
            window.adminAudioRecorder.stop();
            window.adminAudioRecorder.stream.getTracks().forEach(t => t.stop());
            setTimeout(() => { window.executeSendAdminChat(); }, 250);
            return;
        }
    }
    window.executeSendAdminChat(); 
};

window.executeSendAdminChat = async function() { 
    if(!activeChatNik) return Swal.fire('Peringatan', 'Pilih salah satu warga dari kotak masuk.', 'warning'); 
    const input = document.getElementById('adminChatInput'); 
    const pesan = input ? input.value.trim() : ''; 
    
    if(!pesan && !window.adminMediaBlob) return; 
    
    const formData = new FormData(); 
    formData.append('sender', 'admin'); 
    formData.append('nama_admin', user ? (user.nama_lengkap || user.username) : 'Admin'); 
    formData.append('pesan', pesan); 
    
    if(window.adminMediaBlob) { 
        const finalName = `media_${Date.now()}.${window.adminMediaExt || 'jpg'}`; 
        formData.append('file', window.adminMediaBlob, finalName); 
        if(window.adminMediaType) formData.append('custom_file_type', window.adminMediaType); 
    } 
    if(replyToDataAdmin) { 
        formData.append('reply_to_id', replyToDataAdmin.id); 
        formData.append('reply_to_text', replyToDataAdmin.text); 
        formData.append('reply_to_sender', replyToDataAdmin.sender); 
    } 
    
    if(input) input.value = ''; 
    const ep = document.getElementById('emojiPickerAdmin'); 
    if(ep) ep.style.display = 'none'; 
    
    window.batalLampiranAdmin(); 
    window.batalReplyAdmin(); 
    
    try { 
        const res = await fetch(`${API_URL}/api/chat/${activeChatNik}`, { 
            method: 'POST', 
            body: formData 
        }); 
        if(res.ok) {
            window.loadChatMessages(activeChatNik, activeChatName, false); 
            window.loadChatList(true);
        } else {
            const errData = await res.json().catch(() => ({}));
            Swal.fire('Gagal', errData.message || 'Peladen menolak pengiriman.', 'error');
        }
    } catch(e) { 
        Swal.fire('Error', 'Gagal menghubungi server.', 'error'); 
    } 
};

// PIN KONTAK & HAPUS/LAPOR SEMUA
window.pinChatActive = function() { 
    if(!activeChatNik) return; 
    let pinnedChats = []; 
    try { pinnedChats = JSON.parse(localStorage.getItem('pinnedChatsAdmin')) || []; } catch(e){} 
    
    if(pinnedChats.includes(activeChatNik)) { 
        pinnedChats = pinnedChats.filter(n => n !== activeChatNik); 
        Swal.fire({toast:true, position:'top-end', icon:'info', title:'Semat dilepas dari Inbox', showConfirmButton:false, timer:1800}); 
    } else { 
        pinnedChats.push(activeChatNik); 
        Swal.fire({toast:true, position:'top-end', icon:'success', title:'Kontak disematkan di paling atas', showConfirmButton:false, timer:1800}); 
    } 
    localStorage.setItem('pinnedChatsAdmin', JSON.stringify(pinnedChats)); 
    const dd = document.getElementById('chatActionDropdown'); 
    if(dd) dd.style.display = 'none'; 
    window.loadChatList(false); 
};

window.hapusSemuaChatMassalAdmin = function() {
    if(!activeChatNik) return;
    Swal.fire({
        title: 'Hapus Seluruh Riwayat Chat?',
        text: `Semua pesan dalam obrolan dengan ${activeChatName} (${activeChatNik}) akan dihapus bersih permanen.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Bersihkan Total',
        confirmButtonColor: '#ef4444'
    }).then(async (res) => {
        if(res.isConfirmed) {
            Swal.fire({title: 'Membersihkan...', didOpen: () => Swal.showLoading()});
            const response = await fetch(`${API_URL}/api/chat/clear/${activeChatNik}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            if (response.ok) {
                window.loadChatMessages(activeChatNik, activeChatName, false);
                window.loadChatList(true);
                const dd = document.getElementById('chatActionDropdown');
                if(dd) dd.style.display = 'none';
                Swal.fire('Bersih!', 'Seluruh riwayat obrolan telah dibersihkan tanpa sisa.', 'success');
            }
        }
    });
};

window.laporSemuaChatMassalAdmin = function() {
    if(!activeChatNik) return;
    Swal.fire({
        title: 'Laporkan Seluruh Obrolan Warga',
        text: `Teruskan seluruh ruang chat ${activeChatName} ke tim investigasi:`,
        input: 'select',
        inputOptions: {
            'Pelecehan / Ujaran Kebencian': 'Pelecehan / Kata-kata Kasar',
            'Penipuan / Manipulasi Data Bansos': 'Penipuan / Manipulasi Data',
            'Pungutan Liar': 'Pungutan Liar',
            'Lainnya': 'Pelanggaran Lainnya'
        },
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan',
        confirmButtonColor: '#dc2626'
    }).then(async (res) => {
        if(res.isConfirmed && res.value) {
            await fetch(`${API_URL}/api/chat/report-room/${activeChatNik}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    reason: res.value,
                    reporter: user ? (user.nama_lengkap || 'Admin') : 'Admin'
                })
            });
            const dd = document.getElementById('chatActionDropdown');
            if(dd) dd.style.display = 'none';
            Swal.fire('Laporan Terkirim', 'Seluruh ruang chat berhasil dilaporkan ke pusat pengawasan.', 'success');
        }
    });
};

window.toggleChatActionDropdown = function(e) {
    if(e) e.stopPropagation();
    let dd = document.getElementById('chatActionDropdown');
    if(!dd) {
        const header = document.querySelector('.chat-header-modern') || document.querySelector('.chat-header') || document.getElementById('chatHeaderActions')?.parentElement;
        if(header) {
            dd = document.createElement('div');
            dd.id = 'chatActionDropdown';
            dd.style = "display:none; position:absolute; right:20px; top:65px; background:white; box-shadow:0 10px 25px rgba(0,0,0,0.15); border-radius:12px; border:1px solid #e2e8f0; z-index:2000; flex-direction:column; min-width:230px; padding:8px 0;";
            header.style.position = 'relative';
            header.appendChild(dd);
        }
    }
    if(dd) {
        let pinnedChats = [];
        try { pinnedChats = JSON.parse(localStorage.getItem('pinnedChatsAdmin')) || []; } catch(e){}
        const isPinned = pinnedChats.includes(activeChatNik);
        
        dd.innerHTML = `
            <button type="button" onclick="window.pinChatActive()" style="background:none; border:none; padding:10px 18px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:600; color:#334155; width:100%;"><i class="fas fa-thumbtack" style="color:#f59e0b;"></i> ${isPinned ? 'Lepas Sematan Kontak' : 'Sematkan Kontak di Atas'}</button>
            <button type="button" onclick="window.laporSemuaChatMassalAdmin()" style="background:none; border:none; padding:10px 18px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:600; color:#dc2626; width:100%;"><i class="fas fa-flag"></i> Laporkan Seluruh Obrolan</button>
            <div style="height:1px; background:#f1f5f9; margin:4px 0;"></div>
            <button type="button" onclick="window.hapusSemuaChatMassalAdmin()" style="background:none; border:none; padding:10px 18px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:600; color:#ef4444; width:100%;"><i class="fas fa-trash-alt"></i> Hapus Semua Chat</button>
        `;
        dd.style.display = dd.style.display === 'flex' ? 'none' : 'flex';
    }
};

// LOAD INBOX
window.loadChatList = async function(isSilent = false) { 
    try { 
        const res = await window.fetchData('/api/chat/list'); if(!res.ok) return;
        let data = await res.json(); if(!Array.isArray(data)) { data = []; } 
        rawChatListData = data;
        const currentQuery = (document.getElementById('searchChatInput')?.value || '').trim();
        
        window.renderCategorizedInbox(currentQuery);
        window.renderCategorizedBukuKontak(currentQuery);
        window.setupVoiceSearchBar();
    } catch(e) {} 
};

// LOAD PESAN CHAT
window.loadChatMessages = async function(nik, nama, isSilent = false) {
    activeChatNik = String(nik); activeChatName = nama; 
    try {
        const nameDisp = document.getElementById('chatActiveNameDisplay'); if(nameDisp) nameDisp.innerText = nama; 
        const nikDisp = document.getElementById('chatActiveNikDisplay'); if(nikDisp) nikDisp.innerText = nik;
        const handlerDisp = document.getElementById('chatActiveHandlerDisplay'); if(handlerDisp) handlerDisp.innerText = user ? (user.nama_lengkap || user.username) : 'Admin';
        const avatarDisp = document.getElementById('chatHeaderAvatar'); 
        if(avatarDisp) { avatarDisp.innerText = String(nama).charAt(0).toUpperCase(); }
        
        window.updateHeaderButtons(true);
        
        const inp = document.getElementById('adminChatInput'); if(inp) inp.disabled = false; 
        const btnSend = document.getElementById('btnSendAdmin'); if(btnSend) btnSend.disabled = false;
        
        document.querySelectorAll('.chat-contact-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll(`.chat-contact-item[onclick*="${enc(nik)}"]`).forEach(el => el.classList.add('active'));

        const res = await window.fetchData(`/api/chat/${nik}?viewer=admin`); 
        if(!res.ok) throw new Error("Gagal");
        let data = await res.json(); 
        if(!Array.isArray(data)) { data = []; }

        let html = '';
        let pinnedHtml = '';

        data.forEach(msg => {
            let isAdmin = msg.sender === 'admin'; 
            let align = isAdmin ? 'flex-end' : 'flex-start'; 
            let bg = isAdmin ? '#dcf8c6' : '#ffffff'; 
            let color = '#303030'; 
            let borderRadius = isAdmin ? '12px 0px 12px 12px' : '0px 12px 12px 12px'; 
            let shadow = '0 1px 2px rgba(0,0,0,0.15)';
            
            if (msg.is_pinned && !msg.is_deleted) {
                pinnedHtml += `
                    <div onclick="window.scrollToMessage(${msg.id})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:#fffbeb; border-left:4px solid #f59e0b; padding:6px 12px; margin-bottom:8px; border-radius:6px; font-size:0.8rem;">
                        <div><i class="fas fa-thumbtack" style="color:#f59e0b; margin-right:6px;"></i><b>${isAdmin ? 'Admin' : safeHtml(msg.sender)}:</b> ${safeHtml(msg.pesan || 'Lampiran Berkas')}</div>
                        <i class="fas fa-times" onclick="event.stopPropagation(); window.togglePinMessageAdmin(${msg.id});"></i>
                    </div>
                `;
            }

            let replyHtml = ''; 
            if(msg.reply_to_text) { 
                replyHtml = `<div onclick="window.scrollToMessage(${msg.reply_to_id})" style="cursor:pointer; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; border-left: 4px solid ${isAdmin ? '#25d366' : '#3b82f6'}; margin-bottom: 8px; font-size: 0.85rem; color: #555;"><b>${safeHtml(msg.reply_to_sender)}</b><br><i>${safeHtml(msg.reply_to_text)}</i></div>`; 
            }
            
            let reactionHtml = ''; 
            if(msg.reaction) { 
                reactionHtml = `<div style="position:absolute; ${isAdmin ? 'left:-10px' : 'right:-10px'}; bottom:-10px; background:white; border-radius:20px; padding:2px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.2); font-size:1rem; z-index:5;">${msg.reaction}</div>`; 
            }
            
            let mediaHtml = ''; 
            if(msg.file_path) {
                let cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '')}`;
                if(msg.file_type === 'audio') { 
                    mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:35px;"></audio></div>`; 
                } else if(msg.file_type === 'image') { 
                    mediaHtml = `<img src="${cleanFileUrl}" style="max-width:250px; max-height:200px; border-radius:8px; margin-bottom:8px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`; 
                } else if(msg.file_type === 'video') { 
                    mediaHtml = `<video src="${cleanFileUrl}" controls style="max-width:250px; max-height:200px; border-radius:8px; margin-bottom:8px; background:black;"></video>`; 
                }
            }
            
            let actionMenu = '';
            if(!msg.is_deleted) {
                actionMenu = `
                    <div style="position: absolute; ${isAdmin ? 'left:-28px' : 'right:-28px'}; top: 8px; cursor: pointer; color: #94a3b8;" onclick="window.toggleChatMenuAdmin(${msg.id}, event)">
                        <i class="fas fa-ellipsis-v hover-action"></i>
                        <div id="menu-${msg.id}" style="display:none; position:absolute; ${isAdmin ? 'right:15px' : 'left:15px'}; top:0; background:white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:160px; border:1px solid #e2e8f0; font-size:0.85rem;">
                            <button type="button" onclick="window.reactToMessageAdmin(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-smile" style="color:#f59e0b;"></i> Reaksi Emoji</button>
                            <button type="button" onclick="window.setReplyAdmin(${msg.id}, '${isAdmin ? 'Petugas' : safeHtml(msg.sender)}', decodeURIComponent('${enc(msg.pesan)}'), '${msg.file_type}')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-reply" style="color:#3b82f6;"></i> Balas Pesan</button>
                            <button type="button" onclick="window.togglePinMessageAdmin(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-thumbtack" style="color:#10b981;"></i> ${msg.is_pinned ? 'Lepas Pin' : 'Sematkan Pesan'}</button>
                            <button type="button" onclick="window.hapusPesanAdmin(${msg.id}, 'me')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#64748b;"><i class="fas fa-eye-slash"></i> Hapus untuk Saya</button>
                            ${isAdmin ? `<button type="button" onclick="window.hapusPesanAdmin(${msg.id}, 'everyone')" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#ef4444;"><i class="fas fa-trash-alt"></i> Tarik untuk Semua</button>` : ''}
                            ${!isAdmin ? `<button type="button" onclick="window.laporPesanAdminSide(${msg.id})" style="background:none; border:none; padding:6px 10px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; color:#dc2626;"><i class="fas fa-flag"></i> Laporkan Pesan</button>` : ''}
                        </div>
                    </div>
                `;
            }

            html += `<article id="msg-${msg.id}" style="align-self: ${align}; max-width: 75%; margin-bottom: 15px; position:relative; display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'}; font-family: 'Inter', sans-serif;">
                <section style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.95rem; line-height:1.4; min-width: 160px; text-align: left;">
                    ${msg.is_pinned ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:700; margin-bottom:4px;"><i class="fas fa-thumbtack"></i> Disematkan</div>` : ''}
                    ${replyHtml}${mediaHtml}
                    ${msg.pesan ? `<span style="display:block; margin-bottom: 8px; word-break: break-word;">${safeHtml(msg.pesan)}</span>` : ''}
                    <footer style="display:flex; justify-content:flex-end; align-items:center; gap:6px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                        <span style="font-size:0.7rem; color:#64748b; font-weight:700;">${msg.waktu}</span>
                        ${isAdmin ? '<i class="fas fa-check-double" style="font-size:0.7rem; color:#34b7f1;"></i>' : ''}
                    </footer>
                </section>
                ${reactionHtml}
                ${actionMenu}
            </article>`;
        });
        
        const container = document.getElementById('adminChatMessages'); 
        container.innerHTML = (pinnedHtml ? `<div id="pinnedHeaderArea" style="position:sticky; top:0; z-index:10;">${pinnedHtml}</div>` : '') + (html || `<div style="text-align:center; color:var(--text-muted); margin-top:50px; font-size:0.9rem;">Belum ada pesan.</div>`);
        container.scrollTop = container.scrollHeight;

        const wTarget = globalDataWarga.find(w => String(w.nik) === String(nik));
        let solveBanner = document.getElementById('chatDisputeBanner');
        if (wTarget && wTarget.is_lapor_curang) {
            if (!solveBanner) {
                solveBanner = document.createElement('div');
                solveBanner.id = 'chatDisputeBanner';
                solveBanner.style = "background:#fef2f2; border-bottom:1px solid #fecaca; padding:10px 20px; display:flex; justify-content:space-between; align-items:center;";
                container.parentElement.insertBefore(solveBanner, container);
            }
            solveBanner.innerHTML = `
                <div style="font-size:0.85rem; color:#dc2626; font-weight:700;"><i class="fas fa-exclamation-triangle"></i> Status Laporan Bansos: ${safeHtml(wTarget.status_salur)}</div>
                <button type="button" onclick="window.tanggapiLaporan('${wTarget.nik}', '${wTarget.nama}')" class="btn" style="background:#ef4444; color:white; font-size:0.75rem; padding:4px 10px; border-radius:6px;"><i class="fas fa-check-circle"></i> Tanggapi / Selesaikan</button>
            `;
            solveBanner.style.display = 'flex';
        } else if (solveBanner) {
            solveBanner.style.display = 'none';
        }
    } catch(e) {}
};

// FITUR SINGLE MESSAGE ACTIONS
window.setReplyAdmin = function(id, sender, text, file_type) {
    let displayTxt = text;
    if(file_type === 'image') displayTxt = '📷 Foto';
    else if(file_type === 'video') displayTxt = '🎥 Video';
    else if(file_type === 'audio') displayTxt = '🎤 Pesan Suara';
    
    replyToDataAdmin = { id: id, sender: sender, text: displayTxt };
    
    let container = document.getElementById('replyPreviewContainerAdmin');
    if(!container) {
        const inputArea = document.getElementById('adminChatInput').parentElement;
        container = document.createElement('div');
        container.id = 'replyPreviewContainerAdmin';
        container.style = "display:flex; justify-content:space-between; align-items:center; padding:8px 15px; background:#f1f5f9; border-top:1px solid #cbd5e1; font-size:0.85rem;";
        inputArea.parentElement.insertBefore(container, inputArea);
    }
    container.innerHTML = `
        <div style="border-left:3px solid var(--primary); padding-left:8px;">
            <b style="color:var(--primary-dark);">${safeHtml(sender)}</b>: <span>${safeHtml(displayTxt)}</span>
        </div>
        <i class="fas fa-times" style="cursor:pointer; color:var(--danger);" onclick="window.batalReplyAdmin()"></i>
    `;
    container.style.display = 'flex';
    document.getElementById('adminChatInput')?.focus();
};

window.batalReplyAdmin = function() { 
    replyToDataAdmin = null; 
    const cont = document.getElementById('replyPreviewContainerAdmin'); 
    if(cont) cont.style.display = 'none'; 
};

window.reactToMessageAdmin = async function(msgId) {
    const emojis = ['👍', '❤️', '😂', '🙏', '🔥', '✅', '❌', '🚨'];
    let html = `<div style="display:flex; gap:10px; justify-content:center; font-size:2rem; cursor:pointer;">`;
    emojis.forEach(em => {
        html += `<span onclick="window.submitReactionAdmin(${msgId}, '${em}')" style="transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${em}</span>`;
    });
    html += `</div>`;
    Swal.fire({ title: 'Beri Reaksi Emoji', html: html, showConfirmButton: false });
};

window.submitReactionAdmin = async function(msgId, emoji) {
    Swal.close();
    await fetch(`${API_URL}/api/chat/react/${msgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji })
    });
    window.loadChatMessages(activeChatNik, activeChatName, false);
};

window.togglePinMessageAdmin = async function(msgId) {
    await fetch(`${API_URL}/api/chat/pin/${msgId}`, { method: 'PATCH' });
    window.loadChatMessages(activeChatNik, activeChatName, false);
};

window.hapusPesanAdmin = async function(id, tipe) {
    const txt = tipe === 'everyone' ? 'menarik pesan ini untuk semua orang' : 'menghapus pesan ini dari layar Anda';
    if(confirm(`Yakin ingin ${txt}?`)) {
        await fetch(`${API_URL}/api/chat/action/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: tipe, requester: 'admin' })
        });
        window.loadChatMessages(activeChatNik, activeChatName, false);
    }
};

window.laporPesanAdminSide = async function(msgId) {
    const { value: alasan } = await Swal.fire({
        title: 'Laporkan Pesan',
        input: 'select',
        inputOptions: {
            'Kata-kata Kasar': 'Kata-kata Kasar / Pelecehan',
            'Penipuan': 'Penipuan / Data Palsu',
            'Pungutan Liar': 'Pungutan Liar / Suap',
            'Lainnya': 'Lainnya'
        },
        showCancelButton: true,
        confirmButtonText: 'Kirim Laporan',
        confirmButtonColor: '#ef4444'
    });
    if (alasan) {
        await fetch(`${API_URL}/api/chat/report/${msgId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: alasan, reporter: user ? (user.nama_lengkap || 'Admin') : 'Admin' })
        });
        Swal.fire('Terlapor', 'Laporan telah diteruskan ke log keamanan pusat.', 'success');
    }
};

window.toggleChatMenuAdmin = function(id, event) {
    event.stopPropagation();
    document.querySelectorAll('[id^="menu-"]').forEach(m => {
        if(m.id !== `menu-${id}`) m.style.display = 'none';
    });
    const menu = document.getElementById(`menu-${id}`);
    if(menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
};

window.scrollToMessage = function(id) {
    const el = document.getElementById(`msg-${id}`);
    if(el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = "0 0 15px #f59e0b";
        setTimeout(() => el.style.boxShadow = "", 2000);
    }
};

window.toggleEmojiPicker = function(type, event) { 
    if(event) event.stopPropagation();
    let el = document.getElementById('emojiPickerAdmin'); 
    if(el) {
        const emojisList = ['😀','😂','🥰','😎','😭','😡','👍','🙏','❤️','🔥','✅','❌','💡','🎉','😢','🤔','👏','🚨']; 
        let html = ''; 
        emojisList.forEach(e => { 
            html += `<div style="cursor:pointer; font-size:1.5rem; text-align:center; user-select:none; padding:4px;" onclick="window.addEmoji('${e}', 'admin')">${e}</div>`; 
        });
        el.innerHTML = html;
        el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'grid' : 'none'; 
    }
};

window.addEmoji = function(emoji, type) { 
    const input = document.getElementById(type === 'admin' ? 'adminChatInput' : 'wargaChatInput'); 
    if(input) { 
        input.value += emoji; 
        input.focus(); 
    } 
};

window.handleChatEnter = function(e, type) { 
    if(e.key === 'Enter') { 
        e.preventDefault();
        if(type === 'admin') window.sendAdminChat(); 
    } 
};

window.openAdminChat = function() { 
    window.openModalUniversal('modalAdminChat'); 
    window.switchChatTab('inbox'); 
    window.tutupObrolanAktif();
    if(!window.chatInterval) { 
        window.chatInterval = setInterval(() => { 
            if(document.getElementById('modalAdminChat')?.style.display === 'flex') { 
                window.loadChatList(true); 
                if(activeChatNik) window.loadChatMessages(activeChatNik, activeChatName, true); 
            } 
        }, 3000); 
    } 
};

window.tutupObrolanAktif = function() {
    activeChatNik = null; activeChatName = null;
    const nameDisp = document.getElementById('chatActiveNameDisplay'); 
    if(nameDisp) nameDisp.innerText = "Pilih Warga di Kotak Masuk..."; 
    window.updateHeaderButtons(false);
    const inp = document.getElementById('adminChatInput'); if(inp) inp.disabled = true; 
    const btnSend = document.getElementById('btnSendAdmin'); if(btnSend) btnSend.disabled = true;
    const msgs = document.getElementById('adminChatMessages'); if(msgs) msgs.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:100px;"><i class="fas fa-comments fa-3x" style="opacity:0.3; margin-bottom:15px;"></i><br>Pilih daftar warga.</div>'; 
    document.querySelectorAll('.chat-contact-item').forEach(el => el.classList.remove('active'));
};

window.updateHeaderButtons = function(isActive) {
    const infoDisp = document.getElementById('chatActiveInfoDisplay'); if(infoDisp) infoDisp.style.display = isActive ? 'flex' : 'none';
    const avatarDisp = document.getElementById('chatHeaderAvatar'); if(avatarDisp) avatarDisp.style.display = isActive ? 'flex' : 'none';
    const headerActions = document.getElementById('chatHeaderActions'); if(headerActions) headerActions.style.display = isActive ? 'flex' : 'none';
};

window.switchChatTab = function(tab) {
    window.activeChatTab = tab;
    const btnInbox = document.getElementById('tabInboxBtn');
    const btnKontak = document.getElementById('tabKontakBtn');
    const listInbox = document.getElementById('chatContactList');
    const listKontak = document.getElementById('chatBukuKontakList');
    const searchInp = document.getElementById('searchChatInput');

    const currentQuery = searchInp ? searchInp.value.trim() : '';

    if (tab === 'inbox') { 
        if(btnInbox) { btnInbox.className = 'btn btn-primary'; btnInbox.style.background = ''; btnInbox.style.color = ''; }
        if(btnKontak) { btnKontak.className = 'btn btn-secondary'; btnKontak.style.background = 'transparent'; btnKontak.style.border = 'none'; }
        if(listInbox) listInbox.style.display = 'block'; 
        if(listKontak) listKontak.style.display = 'none'; 
        window.loadChatList(); 
    } else { 
        if(btnKontak) { btnKontak.className = 'btn btn-primary'; btnKontak.style.background = ''; btnKontak.style.color = ''; }
        if(btnInbox) { btnInbox.className = 'btn btn-secondary'; btnInbox.style.background = 'transparent'; btnInbox.style.border = 'none'; }
        if(listInbox) listInbox.style.display = 'none'; 
        if(listKontak) listKontak.style.display = 'block'; 
        window.renderCategorizedBukuKontak(currentQuery); 
    }
    window.setupVoiceSearchBar();
};

window.loadDashboardData = async function() { 
    try {
        const res = await window.fetchData('/warga'); 
        if(!res || !res.ok) { if(res && res.status === 401) window.logout(); return; }
        let data = await res.json(); if(!Array.isArray(data)) { data = []; } 
        globalDataWarga = data; document.getElementById('statTotal').innerText = data.length; 
        window.renderTable(data); 
    } catch(err) { } 
};

window.renderTable = function(data) { 
    if(!Array.isArray(data)) data = [];
    let dtObj = $('#dataTable'); if ($.fn.DataTable.isDataTable(dtObj)) { dtObj.DataTable().clear().destroy(); } 
    let tbody = document.querySelector('#dataTable tbody'); if(tbody) tbody.innerHTML = ''; 
    let html = ''; 
    data.forEach(w => { 
        let isVerified = w.is_verified || false;
        let encNik = enc(w.nik), encNama = enc(w.nama || 'Tanpa Nama');
        const verifBadge = isVerified ? '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Disetujui</span>' : '<span class="badge badge-red"><i class="fas fa-clock"></i> Menunggu</span>'; 
        let btnSalur = '';
        if (w.is_lapor_curang) {
            btnSalur = `<button onclick="window.tanggapiLaporan('${w.nik}', '${w.nama}')" class="btn" style="padding:4px 8px; background:var(--danger); color:white; font-size:0.8rem; border-radius:6px; margin-right:4px;" title="Tindak Lanjuti"><i class="fas fa-headset"></i> Kasus Bansos</button>`;
        }
        let btnDelete = user && user.role === 'admin' ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:4px 8px; background:var(--danger); color:white; font-size:0.8rem; border-radius:6px;"><i class="fas fa-trash"></i></button>` : ''; 
        html += `<tr data-nik="${safeHtml(w.nik)}" data-nama="${safeHtml(w.nama)}"> 
            <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td> 
            <td style="font-weight:700; font-family:monospace; font-size:1.05rem;">${safeHtml(w.nik)}</td>
            <td><div style="font-weight:600;">${safeHtml(w.nama)}</div><small style="color:var(--text-muted);">${safeHtml(w.no_hp || '-')}</small></td> 
            <td>${safeHtml(w.status_salur || 'Tersimpan')}</td> <td style="text-align:center;">${verifBadge}</td> 
            <td style="text-align:center;">${btnSalur}<button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:4px 8px; background:var(--accent); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;"><i class="fas fa-edit"></i></button>${btnDelete}</td> 
        </tr>`; 
    }); 
    if(tbody) { tbody.innerHTML = html; }
    dtTable = $('#dataTable').DataTable({ pageLength: 10, responsive: true, order: [[1, 'asc']] });
};

window.tanggapiLaporan = async function(nik, nama) { 
    Swal.fire({ 
        title: 'Tindak Lanjuti Masalah Bansos?', 
        text: `Kirim pembaruan status ke warga (${nama}) bahwa laporan sudah diproses oleh Dinas Sosial?`, 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: 'Ya, Tandai Selesai Penanganan' 
    }).then(async (res) => { 
        if(res.isConfirmed) { 
            const response = await window.fetchData('/api/admin/lapor-tanggapi', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({nik: nik}) 
            }); 
            if(response.ok) { 
                Swal.fire('Terkirim', 'Pembaruan status telah dikirim.', 'success'); 
                window.loadDashboardData(); 
                if(activeChatNik) window.loadChatMessages(activeChatNik, activeChatName, false);
            } 
        } 
    }); 
};

window.hapusData = async function(id) { 
    if(confirm('Hapus data warga ini dari arsip?')) { 
        await window.fetchData(`/warga/${id}`, { method: 'DELETE' }); 
        window.loadDashboardData(); 
    } 
};