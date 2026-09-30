/**
 * Modul: admin-notif.js
 * Deskripsi: Pusat notifikasi aktivitas real-time dan panel lonceng
 */

// 20. PUSAT NOTIFIKASI REAL-TIME
// =========================================================================
window.currentNotifTab = 'all';
window.cachedNotifList = [];

window.toggleNotifPanel = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const panel = document.getElementById('notifPanel');
    if (!panel) return;

    const isVisible = (panel.style.display === 'block' || panel.style.display === 'flex');
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        window.loadNotifikasiAktivitas(window.currentNotifTab);
    }
};

document.addEventListener('click', function (e) {
    const panel = document.getElementById('notifPanel');
    const wrapper = document.querySelector('.notif-wrapper');

    if (e.target.closest('.swal2-container') || e.target.closest('.swal2-popup') || document.body.classList.contains('swal2-shown')) return;

    if (panel && (panel.style.display === 'block' || panel.style.display === 'flex')) {
        if (!panel.contains(e.target) && !wrapper?.contains(e.target)) {
            panel.style.display = 'none';
        }
    }
});

window.renderNotifikasiListDOM = function () {
    const container = document.getElementById('notifList');
    if (!container) return;

    const prevScrollTop = container.scrollTop;
    const filterTab = window.currentNotifTab;
    const list = window.cachedNotifList || [];

    let filtered = [];
    if (filterTab === 'arsip') {
        filtered = list.filter(n => Boolean(n.is_archived));
    } else if (filterTab === 'urgent') {
        filtered = list.filter(n => !n.is_archived && (
            (n.pesan && n.pesan.includes('🚨')) || 
            (n.pesan && n.pesan.toLowerCase().includes('sengketa')) || 
            (n.pesan && n.pesan.toLowerCase().includes('urgent'))
        ));
    } else {
        filtered = list.filter(n => !Boolean(n.is_archived));
    }

    filtered.sort((a, b) => {
        const pinA = a.is_pinned ? 1 : 0;
        const pinB = b.is_pinned ? 1 : 0;
        if (pinB !== pinA) return pinB - pinA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding:36px 16px; text-align:center; color:#94a3b8; font-size:0.83rem;">
                <i class="fas fa-inbox" style="font-size:1.8rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                Tidak ada notifikasi pada kategori ini.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        let cleanMsg = (item.pesan || '')
            .replace(/👑|📌|🔒|🚨|⚠️/g, '')
            .replace(/^\[(Admin|Petugas|Operator|Warga|Sistem|Urgent)\]\s*/i, '')
            .trim();

        let roleBadge = '<span style="background:#f1f5f9; color:#475569; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #cbd5e1;">SISTEM</span>';
        if (item.pesan && item.pesan.match(/^\[Admin\]/i)) {
            roleBadge = '<span style="background:#e0e7ff; color:#4338ca; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #c7d2fe;">ADMIN</span>';
        } else if (item.pesan && item.pesan.match(/^\[(Petugas|Operator)\]/i)) {
            roleBadge = '<span style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #bae6fd;">PETUGAS</span>';
        } else if (item.pesan && item.pesan.match(/^\[Warga\]/i)) {
            roleBadge = '<span style="background:#fef3c7; color:#b45309; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fde68a;">WARGA</span>';
        } else if (item.pesan && (item.pesan.includes('🚨') || item.pesan.match(/^\[Urgent\]/i))) {
            roleBadge = '<span style="background:#fee2e2; color:#dc2626; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fecaca;">URGENT</span>';
        }

        const isPinned = Boolean(item.is_pinned);
        const isArchived = Boolean(item.is_archived);
        const cardBg = isPinned ? '#fffdf7' : (item.is_read ? '#ffffff' : '#f0fdf4');
        const pinAccent = isPinned ? 'border-left: 4px solid #f59e0b;' : 'border-left: 4px solid transparent;';
        const pinIconColor = isPinned ? '#f59e0b' : '#94a3b8';

        return `
            <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${cardBg}; ${pinAccent} display:flex; gap:10px; align-items:flex-start; cursor:pointer; transition:background 0.15s ease;" 
                 onclick="window.lihatDetailNotifikasi(event, ${item.id})" 
                 onmouseover="this.style.background='#f8fafc'" 
                 onmouseout="this.style.background='${cardBg}'">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        ${roleBadge}
                        ${isPinned ? '<span style="font-size:0.68rem; font-weight:800; color:#d97706; background:#fef3c7; padding:1px 6px; border-radius:4px;"><i class="fas fa-thumbtack"></i> SEMATAN</span>' : ''}
                        <span style="font-size:0.7rem; color:#94a3b8; margin-left:auto;">${item.waktu || ''}</span>
                    </div>
                    <div style="color:#0f172a; font-size:0.83rem; font-weight:${item.is_read ? '500' : '700'}; line-height:1.45;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>
                <div style="display:flex; gap:3px; margin-left:4px;" onclick="event.stopPropagation()">
                    <button type="button" onclick="window.togglePinNotif(${item.id})" title="Sematkan" style="background:none; border:none; color:${pinIconColor}; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <button type="button" onclick="window.toggleArsipNotif(${item.id})" title="Arsipkan" style="background:none; border:none; color:#64748b; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas ${isArchived ? 'fa-box-open' : 'fa-archive'}"></i>
                    </button>
                    <button type="button" onclick="window.hapusNotif(${item.id})" title="Hapus" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:5px 6px; font-size:0.85rem; border-radius:6px;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = prevScrollTop;
};

window.loadNotifikasiAktivitas = async function (filterTab = window.currentNotifTab, forceRender = false) {
    window.currentNotifTab = filterTab;
    const badge = document.getElementById('notifBadge');
    const panel = document.getElementById('notifPanel');
    const isPanelOpen = panel && (panel.style.display === 'block' || panel.style.display === 'flex');

    if (window.isNotifUpdating) return;
    window.isNotifUpdating = true;

    try {
        const res = await (window.fetchWithAuth ? window.fetchWithAuth('/api/notifikasi') : fetch(`${window.BASE_URL}/api/notifikasi`));
        if (!res || !res.ok) return;

        const result = await res.json();
        window.cachedNotifList = result.data || [];
        const unreadCount = result.unread || 0;

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (forceRender || isPanelOpen) {
            window.renderNotifikasiListDOM();
        }
    } catch (err) {
        console.warn('Gagal memuat notifikasi:', err);
    } finally {
        window.isNotifUpdating = false;
    }
};

window.cekNotifikasiRealtime = async function () {
    try {
        const res = await fetch(`${window.BASE_API_URL}/api/notifikasi`);
        if (!res.ok) return;
        const json = await res.json();
        const badge = document.getElementById('notifBadge');
        if (badge && json.total_unread !== undefined) {
            badge.textContent = json.total_unread;
            badge.style.display = json.total_unread > 0 ? 'inline-block' : 'none';
        }
    } catch (e) {}
};

window.lihatDetailNotifikasi = function (e, id) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (!item) return;

    if (!item.is_read) {
        item.is_read = true;
        window.renderNotifikasiListDOM();
        fetch(`${window.BASE_URL}/api/notifikasi/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        }).catch(() => {});
    }

    const cleanMsg = (item.pesan || '').replace(/👑|📌|🔒|🚨|⚠️/g, '').trim();

    Swal.fire({
        title: 'Detail Aktivitas Sistem',
        html: `
            <div style="text-align:left; font-size:0.88rem; line-height:1.6; color:#1e293b;">
                <div style="padding:14px; background:#f8fafc; border-radius:14px; border:1px solid #e2e8f0; margin-bottom:14px;">
                    <div style="margin-bottom:6px;"><b>Waktu Eksekusi:</b> ${item.waktu || '-'}</div>
                    <div style="font-size:0.92rem; font-weight:600; color:#0f172a; margin-top:4px; padding:10px; background:#ffffff; border-radius:8px; border:1px solid #cbd5e1; word-break:break-word;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: item.is_pinned ? 'Lepas Pin' : 'Sematkan (Pin)',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#f59e0b'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await window.togglePinNotif(id);
        }
        const panel = document.getElementById('notifPanel');
        if (panel) panel.style.display = 'block';
    });
};

window.switchNotifTab = function (tab) {
    window.currentNotifTab = tab;
    document.querySelectorAll('.ntf-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#475569';
    });
    const activeBtn = document.getElementById(
        tab === 'urgent' ? 'tabNotifUrgent' : (tab === 'arsip' ? 'tabNotifArsip' : 'tabNotifAll')
    );
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = tab === 'urgent' ? '#dc2626' : '#ffffff';
        activeBtn.style.color = tab === 'urgent' ? '#ffffff' : '#0f172a';
    }
    window.renderNotifikasiListDOM();
};

window.togglePinNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_pinned = !item.is_pinned;
        window.renderNotifikasiListDOM();
    }
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}/pin`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.toggleArsipNotif = async function (id) {
    const item = (window.cachedNotifList || []).find(n => Number(n.id) === Number(id));
    if (item) {
        item.is_archived = !item.is_archived;
        window.renderNotifikasiListDOM();
    }
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}/archive`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.hapusNotif = async function (id) {
    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Number(n.id) !== Number(id));
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.hapusSemuaNotif = async function () {
    const konfirmasi = confirm('Bersihkan seluruh riwayat notifikasi yang tidak disematkan?');
    if (!konfirmasi) return;
    window.cachedNotifList = (window.cachedNotifList || []).filter(n => Boolean(n.is_pinned));
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/clear-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

window.tandaiSemuaNotifDibaca = async function () {
    (window.cachedNotifList || []).forEach(n => { n.is_read = true; });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
    window.renderNotifikasiListDOM();
    try {
        await fetch(`${window.BASE_URL}/api/notifikasi/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
    } catch (e) {}
};

// =========================================================================
