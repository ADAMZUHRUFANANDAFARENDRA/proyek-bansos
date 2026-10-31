/**
 * Modul: admin-notif.js
 * Deskripsi: Pusat notifikasi aktivitas real-time, panel lonceng, dan panel khusus panggilan aparatur & warga
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

    // PANEL KHUSUS PANGGILAN APARATUR (MASUK / KELUAR / TAK TERJAWAB)
    if (filterTab === 'panggilan') {
        let rawCallList = window._cachedCallLogsInChat || [];
        if (!rawCallList.length && window.cachedCallLogs) {
            rawCallList = window.cachedCallLogs;
        }

        // Jika belum ada di memori, coba sinkronkan via API
        if (!rawCallList.length && !window._fetchingCallLogsNotif) {
            window._fetchingCallLogsNotif = true;
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            fetch(`${base}/api/panggilan/logs`, {
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            }).then(r => r.json()).then(j => {
                window._cachedCallLogsInChat = j.data || [];
                window._fetchingCallLogsNotif = false;
                window.renderNotifikasiListDOM();
            }).catch(() => { window._fetchingCallLogsNotif = false; });
        }

        // PANGGILAN HANYA DENGAN WARGA: Admin, Petugas, dan Super Admin TIDAK BISA menelepon sesama aparatur
        const aparaturRoles = ['admin', 'superadmin', 'super_admin', 'petugas'];
        let callList = rawCallList.filter(call => {
            const isCallerAparatur = aparaturRoles.includes((call.caller_role || '').toLowerCase());
            const isCalleeAparatur = aparaturRoles.includes((call.callee_role || '').toLowerCase());
            if (isCallerAparatur && isCalleeAparatur) return false; // Buang panggilan sesama aparatur
            return true;
        });

        if (callList.length === 0) {
            container.innerHTML = `
                <div style="padding:36px 16px; text-align:center; color:#94a3b8; font-size:0.83rem;">
                    <i class="fas fa-phone-slash" style="font-size:1.8rem; opacity:0.35; margin-bottom:8px; display:block;"></i>
                    Belum ada riwayat aktivitas panggilan dengan warga binaan.
                </div>
            `;
            return;
        }

        // Langsung tampilkan daftar kartu log panggilan tanpa tulisan/panel bar biru 'LOG PANGGILAN APARATUR & WARGA'
        container.innerHTML = callList.map(call => {
            const isVideo = call.tipe_panggilan === 'video';
            const isMissed = call.status === 'tidak_terjawab' || call.status === 'missed';
            const isCallerAparatur = ['admin', 'superadmin', 'petugas'].includes((call.caller_role || '').toLowerCase());
            const isCalleeAparatur = ['admin', 'superadmin', 'petugas'].includes((call.callee_role || '').toLowerCase());

            let arahBadge = '';
            if (isMissed) {
                arahBadge = '<span style="background:#fee2e2; color:#dc2626; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px;"><i class="fas fa-phone-slash"></i> TAK TERJAWAB</span>';
            } else if (isCallerAparatur && !isCalleeAparatur) {
                arahBadge = '<span style="background:#f3e8ff; color:#7e22ce; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px;"><i class="fas fa-arrow-up"></i> KELUAR</span>';
            } else if (!isCallerAparatur && isCalleeAparatur) {
                arahBadge = '<span style="background:#e0f2fe; color:#0284c7; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px;"><i class="fas fa-arrow-down"></i> MASUK</span>';
            } else {
                arahBadge = '<span style="background:#f1f5f9; color:#475569; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px;"><i class="fas fa-sync-alt"></i> INTERNAL</span>';
            }

            const durSec = Number(call.durasi_detik) || 0;
            const durStr = durSec >= 60 ? `${Math.floor(durSec/60)}m ${durSec%60}s` : `${durSec} dtk`;
            const timeStr = call.waktu_mulai ? (call.waktu_mulai.includes('T') ? call.waktu_mulai.replace('T', ' ').slice(0, 16) : call.waktu_mulai.slice(0, 16)) : '-';

            return `
                <div style="padding:12px 14px; border-bottom:1px solid #f1f5f9; background:#ffffff; display:flex; gap:10px; align-items:flex-start; cursor:pointer; transition:all 0.15s ease;"
                     onclick="window.bukaDetailLogPanggilanModal ? window.bukaDetailLogPanggilanModal('${call.id}') : null"
                     onmouseover="this.style.background='#f0f9ff'; this.style.borderLeft='4px solid #0284c7';"
                     onmouseout="this.style.background='#ffffff'; this.style.borderLeft='4px solid transparent';">
                    <div style="width:34px; height:34px; border-radius:8px; background:${isVideo ? '#f3e8ff' : '#e0f2fe'}; color:${isVideo ? '#7e22ce' : '#0284c7'}; display:flex; align-items:center; justify-content:center; font-size:0.9rem; flex-shrink:0; margin-top:2px;">
                        <i class="fas ${isVideo ? 'fa-video' : 'fa-phone-alt'}"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px; flex-wrap:wrap;">
                            ${arahBadge}
                            <span style="font-size:0.68rem; color:#64748b; font-weight:600;"><i class="far fa-clock"></i> ${timeStr}</span>
                            <span style="font-size:0.68rem; color:#15803d; font-weight:800; margin-left:auto;">${durStr}</span>
                        </div>
                        <div style="font-size:0.82rem; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${call.caller_name || 'Pemanggil'} <span style="color:#94a3b8; font-weight:400;">&rarr;</span> ${call.callee_name || 'Penerima'}
                        </div>
                        <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">
                            ${call.catatan || (isVideo ? 'Panggilan Video Interaktif WebRTC' : 'Panggilan Suara Aparatur & Warga')}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation()">
                        <button type="button" onclick="window.bukaDetailLogPanggilanModal ? window.bukaDetailLogPanggilanModal('${call.id}') : null" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; padding:5px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;" title="Buka Detail">
                            <i class="fas fa-eye"></i> Detail
                        </button>
                        <button type="button" onclick="window.hapusLogPanggilanDariNotif ? window.hapusLogPanggilanDariNotif('${call.id}') : null" style="background:#fff1f2; border:1px solid #fecdd3; color:#dc2626; padding:5px 7px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;" title="Hapus Riwayat Panggilan Ini">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        container.scrollTop = prevScrollTop;
        return;
    }

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
            .replace(/^\[(Admin|Petugas|Operator|Warga|Sistem|Urgent|SUPER_ADMIN)\]\s*/i, '')
            .trim();

        let roleBadge = '<span style="background:#f1f5f9; color:#475569; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #cbd5e1;">SISTEM</span>';
        if (item.pesan && (item.pesan.match(/^\[(Admin|SUPER_ADMIN)\]/i) || item.role_sender === 'SUPER_ADMIN')) {
            roleBadge = '<span style="background:#e0e7ff; color:#4338ca; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #c7d2fe;">ADMIN</span>';
        } else if (item.pesan && item.pesan.match(/^\[(Petugas|Operator)\]/i)) {
            roleBadge = '<span style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #bae6fd;">PETUGAS</span>';
        } else if (item.pesan && item.pesan.match(/^\[Warga\]/i)) {
            roleBadge = '<span style="background:#fef3c7; color:#b45309; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fde68a;">WARGA</span>';
        } else if (item.pesan && (item.pesan.includes('🚨') || item.pesan.match(/^\[Urgent\]/i))) {
            roleBadge = '<span style="background:#fee2e2; color:#dc2626; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fecaca;">URGENT</span>';
        } else if (item.kategori === 'panggilan' || (item.pesan && item.pesan.includes('Panggilan'))) {
            roleBadge = '<span style="background:#e0f2fe; color:#0284c7; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #bae6fd;"><i class="fas fa-phone-alt"></i> PANGGILAN</span>';
        }

        const isPinned = Boolean(item.is_pinned);
        const isArchived = Boolean(item.is_archived);
        const cardBg = isPinned ? '#fffdf7' : (item.is_read ? '#ffffff' : '#f0fdf4');
        const pinAccent = isPinned ? 'border-left: 4px solid #f59e0b;' : 'border-left: 4px solid transparent;';
        const pinIconColor = isPinned ? '#f59e0b' : '#94a3b8';

        return `
            <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; background:${cardBg}; ${pinAccent} display:flex; gap:10px; align-items:flex-start; cursor:pointer; transition:all 0.15s ease;" 
                 onclick="window.lihatDetailNotifikasi(event, ${item.id})" 
                 onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#38bdf8';" 
                 onmouseout="this.style.background='${cardBg}'; this.style.borderColor='#f1f5f9';">
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

// DETAIL LENGKAP NOTIFIKASI DENGAN TINDAKAN AKSI INTERAKTIF
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

    const rawMsg = item.pesan || '';
    const cleanMsg = rawMsg.replace(/👑|📌|🔒|🚨|⚠️/g, '').trim();

    // Deteksi Tipe & Konteks Aksi Cepat
    let actionBtnHtml = '';
    let categoryTitle = 'Aktivitas Sistem';
    let iconHeader = 'fa-bell';
    let iconBg = '#f1f5f9';
    let iconColor = '#475569';

    if (rawMsg.includes('SK Bupati') || item.kategori === 'sk_bupati') {
        categoryTitle = 'Dokumen Keputusan Bupati Sidoarjo';
        iconHeader = 'fa-file-signature';
        iconBg = '#fef2f2';
        iconColor = '#dc2626';
        actionBtnHtml = `<button type="button" class="swal2-confirm swal2-styled" onclick="Swal.close(); if(window.bukaModalSKBupatiPreview) window.bukaModalSKBupatiPreview();" style="background:#0284c7;"><i class="fas fa-file-signature"></i> Buka Naskah SK Bupati</button>`;
    } else if (rawMsg.includes('Panggilan') || item.kategori === 'panggilan') {
        categoryTitle = 'Riwayat Panggilan Aparatur';
        iconHeader = 'fa-phone-volume';
        iconBg = '#e0f2fe';
        iconColor = '#0284c7';
        actionBtnHtml = `<button type="button" class="swal2-confirm swal2-styled" onclick="Swal.close(); window.switchNotifTab('panggilan');" style="background:#0284c7;"><i class="fas fa-phone-alt"></i> Lihat Daftar Panggilan</button>`;
    } else if (rawMsg.includes('Pengaduan') || rawMsg.includes('sengketa') || rawMsg.includes('🚨') || item.kategori === 'urgent') {
        categoryTitle = 'Pengaduan & Sengketa Bansos';
        iconHeader = 'fa-shield-virus';
        iconBg = '#fee2e2';
        iconColor = '#dc2626';
        actionBtnHtml = `<button type="button" class="swal2-confirm swal2-styled" onclick="Swal.close(); if(window.bukaModalInvestigasi) window.bukaModalInvestigasi();" style="background:#dc2626;"><i class="fas fa-search-location"></i> Buka Investigasi Aduan</button>`;
    } else if (rawMsg.includes('kependudukan') || rawMsg.includes('warga') || item.kategori === 'warga') {
        categoryTitle = 'Pembaruan Data Kependudukan';
        iconHeader = 'fa-users';
        iconBg = '#f0fdf4';
        iconColor = '#16a34a';
        actionBtnHtml = `<button type="button" class="swal2-confirm swal2-styled" onclick="Swal.close(); const el = document.getElementById('sectionArsipDataWarga'); if(el) el.scrollIntoView({behavior:'smooth'});" style="background:#16a34a;"><i class="fas fa-folder-open"></i> Buka Arsip Warga</button>`;
    }

    Swal.fire({
        title: `<div style="display:flex; align-items:center; gap:8px; font-size:1.05rem; color:#0f172a;">
                    <span style="width:34px; height:34px; border-radius:8px; background:${iconBg}; color:${iconColor}; display:flex; align-items:center; justify-content:center;">
                        <i class="fas ${iconHeader}"></i>
                    </span>
                    <span>${categoryTitle}</span>
                </div>`,
        html: `
            <div style="text-align:left; font-size:0.86rem; line-height:1.6; color:#1e293b;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; margin-bottom:12px;">
                    <div style="font-size:0.75rem; color:#64748b;">
                        <i class="far fa-clock"></i> <b>Waktu Penerimaan:</b> ${item.waktu || '-'}
                    </div>
                    <div>
                        <span style="font-size:0.68rem; font-weight:800; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; padding:2px 6px; border-radius:4px;">
                            <i class="fas fa-check-circle"></i> Telah Dibaca
                        </span>
                    </div>
                </div>

                <div style="padding:14px; background:#ffffff; border-radius:12px; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.03); margin-bottom:14px; word-break:break-word;">
                    <div style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">
                        <i class="fas fa-info-circle text-primary"></i> Isi Pesan Notifikasi:
                    </div>
                    <div style="font-size:0.9rem; font-weight:600; color:#0f172a; line-height:1.5;">
                        ${window.safeHtml(cleanMsg)}
                    </div>
                </div>

                <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                    <button type="button" onclick="window.togglePinNotif(${id}); Swal.close();" style="background:#fef3c7; border:1px solid #fde68a; color:#b45309; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-thumbtack"></i> ${item.is_pinned ? 'Lepas Sematan' : 'Sematkan Notifikasi'}
                    </button>
                    <button type="button" onclick="window.toggleArsipNotif(${id}); Swal.close();" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-archive"></i> ${item.is_archived ? 'Keluarkan dari Arsip' : 'Arsipkan'}
                    </button>
                    <button type="button" onclick="window.hapusNotif(${id}); Swal.close();" style="background:#fee2e2; border:1px solid #fecaca; color:#dc2626; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">
                        <i class="fas fa-trash-alt"></i> Hapus
                    </button>
                </div>
            </div>
        `,
        showCancelButton: true,
        showConfirmButton: Boolean(actionBtnHtml),
        confirmButtonText: actionBtnHtml ? (rawMsg.includes('SK Bupati') ? '📜 Buka SK Bupati' : (rawMsg.includes('Panggilan') ? '📞 Log Panggilan' : '🔍 Lihat Detail')) : 'OK',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#0284c7'
    }).then((result) => {
        if (result.isConfirmed) {
            if (rawMsg.includes('SK Bupati') && typeof window.bukaModalSKBupatiPreview === 'function') {
                window.bukaModalSKBupatiPreview();
            } else if (rawMsg.includes('Panggilan')) {
                window.switchNotifTab('panggilan');
            } else if ((rawMsg.includes('Pengaduan') || rawMsg.includes('sengketa')) && typeof window.bukaModalInvestigasi === 'function') {
                window.bukaModalInvestigasi();
            }
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

    let activeBtnId = 'tabNotifAll';
    if (tab === 'urgent') activeBtnId = 'tabNotifUrgent';
    else if (tab === 'arsip') activeBtnId = 'tabNotifArsip';
    else if (tab === 'panggilan') activeBtnId = 'tabNotifPanggilan';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = tab === 'urgent' ? '#dc2626' : (tab === 'panggilan' ? '#0284c7' : '#ffffff');
        activeBtn.style.color = (tab === 'urgent' || tab === 'panggilan') ? '#ffffff' : '#0f172a';
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
    // Jika sedang di tab panggilan, gunakan tombol Bersihkan atas ini untuk membersihkan riwayat panggilan
    if (window.currentNotifTab === 'panggilan') {
        return window.bersihkanSemuaLogPanggilanDariNotif();
    }
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

// Hapus satu riwayat log panggilan dari tab notifikasi
window.hapusLogPanggilanDariNotif = async function (callId) {
    if (typeof Swal !== 'undefined') {
        const confirmRes = await Swal.fire({
            title: 'Hapus Log Panggilan?',
            text: `Rekaman riwayat panggilan ID #${callId} akan dihapus secara permanen.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        });
        if (!confirmRes.isConfirmed) return;
    } else {
        if (!confirm(`Hapus rekaman panggilan ID #${callId}?`)) return;
    }

    // Update state cache lokal
    window._cachedCallLogsInChat = (window._cachedCallLogsInChat || []).filter(c => String(c.id) !== String(callId));
    window.cachedCallLogs = (window.cachedCallLogs || []).filter(c => String(c.id) !== String(callId));
    window.renderNotifikasiListDOM();
    if (typeof window.renderCallLogsInChat === 'function') window.renderCallLogsInChat();

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        await fetch(`${base}/api/panggilan/logs/${callId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Log panggilan dihapus',
                showConfirmButton: false,
                timer: 2000
            });
        }
    } catch (err) {
        console.warn('[LogPanggilan] Gagal hapus via API:', err);
    }
};

// Bersihkan seluruh riwayat log panggilan dari tab notifikasi
window.bersihkanSemuaLogPanggilanDariNotif = async function () {
    if (typeof Swal !== 'undefined') {
        const confirmRes = await Swal.fire({
            title: 'Bersihkan Seluruh Riwayat Panggilan?',
            text: 'Seluruh rekaman log panggilan masuk dan keluar akan dibersihkan dari server dan database.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Bersihkan Semua',
            cancelButtonText: 'Batal'
        });
        if (!confirmRes.isConfirmed) return;
    } else {
        if (!confirm('Bersihkan seluruh riwayat panggilan?')) return;
    }

    window._cachedCallLogsInChat = [];
    window.cachedCallLogs = [];
    window.renderNotifikasiListDOM();
    if (typeof window.renderCallLogsInChat === 'function') window.renderCallLogsInChat();

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        await fetch(`${base}/api/panggilan/logs/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Seluruh log panggilan dibersihkan',
                showConfirmButton: false,
                timer: 2000
            });
        }
    } catch (err) {
        console.warn('[LogPanggilan] Gagal clear via API:', err);
    }
};

// =========================================================================
