/* =========================================================
   ADMIN.JS - SPK BANSOS SIDOARJO (FULL WORKING FILE & STICKER)
========================================================= */
const dtStyle = document.createElement('style');
dtStyle.innerHTML = `.dataTables_length { margin-bottom: 15px; margin-top: 5px; font-weight: 600; color: var(--text-muted); } .dataTables_length select { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); outline: none; margin: 0 8px; cursor:pointer; background: white;} .dataTables_length select:focus { border-color: var(--info); box-shadow: 0 0 0 3px #bfdbfe; } .dataTables_filter { margin-bottom: 15px; margin-top: 5px; } .dataTables_filter input { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); outline: none; margin-left: 8px; width: 250px; background: white;} .dataTables_filter input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }`;
document.head.appendChild(dtStyle);

const MAP_CENTER_FALLBACK = (typeof window.COORDS_SIDOARJO_CENTER !== 'undefined') ? window.COORDS_SIDOARJO_CENTER : [-7.4478, 112.7183];
let globalDataWarga = [], detailData = null, dtTable = null, compChart = null, formMap = null, formMarker = null, macroMap = null, macroLayerGroup = null;
let user = null; try { user = JSON.parse(localStorage.getItem('bansosUser')); } catch(e) {}
let replyToDataAdmin = null, peer = null, activeCall = null, dataConnection = null, localStream = null, activeChatNik = null, activeChatName = null, callTimerAdmin = null, callSecondsAdmin = 0, isMutedAdmin = false, isVideoOffAdmin = false, isBlurred = false; 

// VARIABEL MEDIA ADMIN
window.adminMediaBlob = null; 
window.adminMediaExt = ''; 
window.adminMediaType = ''; 
let adminAudioRecorder, adminAudioChunks = [], isAdminRecordingAudio = false, adminRecordTimer, adminRecordSecs = 0, audioContextAdmin, analyserAdmin, dataArrayAdmin, reqFrameAdmin; 
let importQueue = [], isNotifPanelOpen = false, lastChatListHash = "", lastChatHashAdmin = "", currentFilter = 'all', currentDateFilter = '';

function safeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function enc(str) { return encodeURIComponent(str || ''); }
function escapeInlineJS(str) { if (!str) return ''; return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, ''); }

document.addEventListener('DOMContentLoaded', async () => {
    // SENSOR FILE UPLOAD LANGSUNG KE ELEMEN
    const fileInput = document.getElementById('adminChatFile');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0]; 
            if(!file) return;
            window.adminMediaBlob = file; 
            window.adminMediaExt = file.name.split('.').pop() || 'jpg'; 
            window.adminMediaType = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'document');
            window.showPreviewAdmin(URL.createObjectURL(file), window.adminMediaType, file.name);
            const inp = document.getElementById('adminChatInput');
            if(inp) inp.focus();
        });
    }

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
            try { window.initFormMapPicker(); } catch(e) {}
            try { window.initMacroDistributionMap(); } catch(e) {}
            try { window.loadDashboardData(); } catch(e) {}
            setInterval(() => { 
                let spanTxt = document.querySelector('#notifPanel > div:first-child span'); 
                if(spanTxt) window.fetchNotifikasiRealtime(spanTxt.innerText.includes('Arsip') ? 'arsip' : 'baru'); 
            }, 5000);
            window.fetchNotifikasiRealtime('baru');

            if ($.fn.dataTable) {
                $.fn.dataTable.ext.search.push(function(settings, data, dataIndex, rowData, counter) {
                    let tr = $(settings.aoData[dataIndex].nTr); if (!tr) return true;
                    let bermasalah = tr.attr('data-bermasalah') === '1', layak = tr.attr('data-layak') === '1', menerima = tr.attr('data-menerima') === '1', rowDate = tr.attr('data-tanggal'); 
                    if (window.currentFilter === 'bermasalah' && !bermasalah) return false;
                    if (window.currentFilter === 'layak' && !layak) return false;
                    if (window.currentFilter === 'menerima' && !menerima) return false;
                    if (window.currentDateFilter && window.currentDateFilter !== '') { if (!rowDate || rowDate !== window.currentDateFilter) return false; }
                    return true;
                });
            }
            setTimeout(() => { window.tutupObrolanAktif(); }, 300);
        }
    } catch (criticalError) { }
});

// LISTENER KLIK LUAR UNTUK MENUTUP POPUP
document.addEventListener('click', (e) => {
    if (e.target.closest('#emojiPickerAdmin') || e.target.closest('.fa-smile')) return;
    const epA = document.getElementById('emojiPickerAdmin');
    if(epA) epA.style.display = 'none';

    const np = document.getElementById('notifPanel');
    if (window.isNotifPanelOpen && !e.target.closest('.notif-wrapper')) { 
        window.isNotifPanelOpen = false; 
        if(np) np.style.display = 'none'; 
    }
    const dd = document.getElementById('chatActionDropdown');
    if (dd && dd.style.display === 'block' && !e.target.closest('.chat-action-menu')) { 
        dd.style.display = 'none'; 
    }
});

window.initFormMapPicker = function() { 
    const mapContainer = document.getElementById('formCoordMap'); if(!mapContainer) return; 
    if(formMap) { formMap.off(); formMap.remove(); }
    formMap = L.map('formCoordMap', {scrollWheelZoom: false}).setView(MAP_CENTER_FALLBACK, 12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(formMap); 
    formMarker = L.marker(MAP_CENTER_FALLBACK, { draggable: true }).addTo(formMap); 
    formMap.on('click', function(e) { formMarker.setLatLng(e.latlng); window.setFormCoordinatesFields(e.latlng.lat, e.latlng.lng); });
    formMarker.on('dragend', function(e) { let position = formMarker.getLatLng(); window.setFormCoordinatesFields(position.lat, position.lng); }); 
    setTimeout(() => { if(formMap) formMap.invalidateSize(); }, 800); 
};

window.initMacroDistributionMap = function() { 
    const mapContainer = document.getElementById('bigMapContainer'); if(!mapContainer) return; 
    if(macroMap) { macroMap.off(); macroMap.remove(); }
    macroMap = L.map('bigMapContainer', {scrollWheelZoom: false}).setView(MAP_CENTER_FALLBACK, 11); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(macroMap); 
    macroLayerGroup = L.layerGroup().addTo(macroMap); 
    setTimeout(() => { if(macroMap) macroMap.invalidateSize(); }, 800); 
};

window.updateMacroMapDistributionPoints = async function() { 
    if(!macroLayerGroup) return; macroLayerGroup.clearLayers(); 
    try { 
        const res = await window.fetchData(`/api/map/regional-desil`); if(!res.ok) return; 
        let regionalData = await res.json(); if(!Array.isArray(regionalData)) return; 
        regionalData.forEach(region => { 
            if(!region.lat || !region.lng || isNaN(region.lat) || isNaN(region.lng)) return;
            let markerColor = '#10b981'; if(region.avg_desil <= 2.5) markerColor = '#ef4444'; else if(region.avg_desil <= 4.0) markerColor = '#ea580c'; 
            L.circle([region.lat, region.lng], { color: markerColor, fillColor: markerColor, fillOpacity: 0.5, radius: 600 }).addTo(macroLayerGroup);
        }); 
    } catch(err) {} 
};

window.loadDashboardData = async function() { 
    try {
        const res = await window.fetchData('/warga'); 
        if(!res || !res.ok) { if(res && res.status === 401) window.logout(); return; }
        let data = await res.json(); if(!Array.isArray(data)) { data = []; } 
        globalDataWarga = data; document.getElementById('statTotal').innerText = data.length; 
        let sumValid = 0, sumBermasalah = 0, sumDitolak = 0;
        data.forEach(w => { if (w.is_lapor_curang) { sumBermasalah++; } else if (w.is_verified) { if (w.desil && w.desil <= 4) sumValid++; else sumDitolak++; } }); 
        document.getElementById('statValid').innerText = sumValid; 
        let sumMenunggu = data.length - sumValid - sumDitolak - sumBermasalah; if(sumMenunggu < 0) sumMenunggu = 0;
        window.renderWargaChart(sumValid, sumDitolak, sumBermasalah, sumMenunggu); window.renderTable(data); 
        try { window.updateMacroMapDistributionPoints(); } catch(e) {}
    } catch(err) { }
};

window.renderWargaChart = function(valid, ditolak, bermasalah, menunggu) { 
    const ctx = document.getElementById('wargaStatusChart').getContext('2d'); 
    if (window.wargaChartInstance) { window.wargaChartInstance.destroy(); } 
    window.wargaChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Menerima Bansos', 'Ditolak/Mampu', 'Bermasalah', 'Menunggu Validasi'], datasets: [{ data: [valid, ditolak, bermasalah, menunggu], backgroundColor: ['#10b981', '#64748b', '#ef4444', '#f59e0b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%' } }); 
};

window.renderTable = function(data) { 
    if(!Array.isArray(data)) data = [];
    let dtObj = $('#dataTable'); if ($.fn.DataTable.isDataTable(dtObj)) { dtObj.DataTable().clear().destroy(); } 
    let tbody = document.querySelector('#dataTable tbody'); if(tbody) tbody.innerHTML = ''; 
    let html = ''; 
    data.forEach(w => { 
        try {
            let isVerified = w.is_verified || false, desil = w.desil || null, isLaporCurang = w.is_lapor_curang || false, statusSalur = w.status_salur || '', tahapPenyaluran = w.tahap_penyaluran || 0;
            let encNik = enc(w.nik), encNama = enc(w.nama || 'Tanpa Nama');
            const verifBadge = isVerified ? '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Disetujui</span>' : '<span class="badge badge-red"><i class="fas fa-clock"></i> Menunggu</span>'; 
            let btnVerif = '', btnDelete = '', btnSalur = ''; 
            if(isVerified && desil && desil <= 4) { 
                if (tahapPenyaluran === 0) { btnSalur = `<button onclick="window.bukaModalSalur(decodeURIComponent('${encNik}'), decodeURIComponent('${encNama}'))" class="btn" style="padding:4px 8px; background:var(--info); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;" title="Unggah Bukti Penyaluran"><i class="fas fa-camera"></i></button>`; } 
                else if (tahapPenyaluran === 1) { btnSalur = `<span class="badge badge-blue" style="font-size:0.7rem; margin-right:4px;">Menunggu Warga</span>`; } 
                else if (tahapPenyaluran === 2) { btnSalur = `<button onclick="window.finalisasiAdmin(decodeURIComponent('${encNik}'))" class="btn" style="padding:4px 8px; background:var(--primary-dark); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;" title="Verifikasi Akhir"><i class="fas fa-check-double"></i></button>`; } 
                else if (tahapPenyaluran === 3) { btnSalur = `<span class="badge badge-green" style="font-size:0.7rem; margin-right:4px;">Selesai</span>`; } 
            }
            let isLayakVal = '0', isMenerimaVal = '0';
            if(isVerified && desil && desil <= 4) isLayakVal = '1'; if(tahapPenyaluran >= 2 || statusSalur === 'Selesai') isMenerimaVal = '1';
            let warningText = '', isBermasalahVal = '0';
            if(isLaporCurang) {
                if (statusSalur === 'Diinvestigasi') { btnSalur = `<button onclick="window.tanggapiLaporan(decodeURIComponent('${encNik}'), decodeURIComponent('${encNama}'))" class="btn" style="padding:4px 8px; background:var(--accent); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;" title="Tanggapi Laporan Warga"><i class="fas fa-reply"></i> Tanggapi</button>`; warningText = `<br><span class="badge badge-red" style="margin-top:4px;"><i class="fas fa-exclamation-triangle"></i> Laporan Baru!</span>`; } 
                else if (statusSalur === 'Menunggu Konfirmasi Warga') { btnSalur = `<span class="badge badge-accent" style="font-size:0.7rem; margin-right:4px;">Menunggu Warga</span>`; warningText = `<br><span class="badge badge-accent" style="margin-top:4px;"><i class="fas fa-clock"></i> Tanggapan Terkirim</span>`; } 
                else if (statusSalur === 'Menunggu Konfirmasi Akhir Admin') { btnSalur = `<button onclick="window.konfirmasiLaporSelesaiAdmin(decodeURIComponent('${encNik}'), decodeURIComponent('${encNama}'))" class="btn" style="padding:4px 8px; background:var(--info); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;" title="Verifikasi Laporan Selesai"><i class="fas fa-check-double"></i> Tutup Kasus</button>`; warningText = `<br><span class="badge badge-blue" style="margin-top:4px;"><i class="fas fa-check"></i> Warga Mengonfirmasi</span>`; }
            }
            if(user && user.role === 'admin') { 
                btnVerif = isVerified ? `<button onclick="window.toggleVerif(${w.id})" class="btn btn-secondary" style="padding:4px 10px; margin-right:4px; font-size:0.8rem;"><i class="fas fa-undo"></i> Batal</button>` : `<button onclick="window.toggleVerif(${w.id})" class="btn btn-primary" style="padding:4px 10px; margin-right:4px; font-size:0.8rem;"><i class="fas fa-check"></i> Setujui</button>`; 
                btnDelete = `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:4px 8px; background:var(--danger); color:white; font-size:0.8rem; border-radius:6px;"><i class="fas fa-trash"></i></button>`; 
            } 
            if(isLaporCurang && statusSalur !== 'Menunggu Konfirmasi Akhir Admin') { isBermasalahVal = '1'; btnSalur += `<button onclick="window.openAdminChatFor(decodeURIComponent('${encNik}'), decodeURIComponent('${encNama}'))" class="btn" style="padding:4px 8px; background:var(--danger); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;" title="Live Chat Darurat"><i class="fas fa-headset"></i></button>`; }
            let tglMasukStr = w.waktu_masuk ? String(w.waktu_masuk) : ""; let tglMasukDateOnly = tglMasukStr.split(' ')[0] || ""; 
            html += `<tr data-nik="${safeHtml(w.nik)}" data-nama="${safeHtml(w.nama)}" data-bermasalah="${isBermasalahVal}" data-layak="${isLayakVal}" data-menerima="${isMenerimaVal}" data-tanggal="${tglMasukDateOnly}"> 
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td> 
                <td style="font-weight:700; font-family:monospace; color:var(--admin-color); font-size:1.05rem; letter-spacing: 0.5px;" data-sort="${safeHtml(w.nik)}">${safeHtml(w.nik)}</td>
                <td data-sort="${safeHtml(w.nama)}"> <div style="font-weight:600; font-size:0.95rem;">${safeHtml(w.nama)}</div> <small style="color:var(--text-muted);"><i class="fas fa-phone"></i> ${safeHtml(w.no_hp || '-')}</small> ${warningText} </td> 
                <td data-sort="${tglMasukStr}">Data Tersimpan</td> <td style="text-align:center;">${verifBadge}</td> 
                <td style="text-align:center;"> <div style="display:flex; justify-content:center; align-items:center;"> ${btnVerif} ${btnSalur} <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:4px 8px; background:var(--accent); color:white; margin-right:4px; font-size:0.8rem; border-radius:6px;"><i class="fas fa-edit"></i></button> ${btnDelete} </div> </td> 
            </tr>`; 
        } catch(err) { }
    }); 
    if(tbody) { tbody.innerHTML = html; } else { document.getElementById('dataTable').innerHTML += `<tbody>${html}</tbody>`; }
    dtTable = $('#dataTable').DataTable({ deferRender: true, pageLength: 10, lengthMenu: [[10, 20, 30, 50, 100], [10, 20, 30, 50, 100]], lengthChange: true, responsive: true, order: [[3, 'desc']], columnDefs: [ { orderable: false, targets: [0, 4, 5] } ]}); document.getElementById('selectAll').checked = false; window.checkBulkAction(); 
};

window.applyFilter = function(type, btnElement) { document.querySelectorAll('.filter-kategori').forEach(b => b.classList.remove('active')); if(btnElement) btnElement.classList.add('active'); window.currentFilter = type; dtTable.draw(); };
window.applyDateFilter = function(val) { window.currentDateFilter = val; dtTable.draw(); };

window.switchChatTab = function(tab) {
    const btnInbox = document.getElementById('tabInboxBtn'), btnKontak = document.getElementById('tabKontakBtn'), listInbox = document.getElementById('chatContactList'), listKontak = document.getElementById('chatBukuKontakList');
    document.getElementById('searchChatInput').value = ''; 
    if(tab === 'inbox') { btnInbox.className = 'btn btn-primary'; btnInbox.style.background = ''; btnInbox.style.color = ''; btnKontak.className = 'btn btn-secondary'; btnKontak.style.background = 'transparent'; btnKontak.style.border = 'none'; listInbox.style.display = 'block'; listKontak.style.display = 'none'; window.loadChatList(); } 
    else { btnKontak.className = 'btn btn-primary'; btnKontak.style.background = ''; btnKontak.style.color = ''; btnInbox.className = 'btn btn-secondary'; btnInbox.style.background = 'transparent'; btnInbox.style.border = 'none'; listInbox.style.display = 'none'; listKontak.style.display = 'block'; window.renderBukuKontak(); }
    window.filterChatList();
};

window.renderBukuKontak = function() {
    let html = ''; let sortedData = [...globalDataWarga].sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || '')));
    sortedData.forEach(w => {
        let namaAsli = w.nama || 'Anonim';
        html += `<div class="chat-contact-item kontak-item" onclick="window.pilihKontakBuku(decodeURIComponent('${enc(w.nik)}'), decodeURIComponent('${enc(namaAsli)}'))"><div class="contact-avatar" style="background: linear-gradient(135deg, #94a3b8, #64748b);">${namaAsli.charAt(0).toUpperCase()}</div><div class="contact-info"><div class="contact-name">${safeHtml(namaAsli)}</div><div class="contact-nik">NIK: ${safeHtml(w.nik)}</div></div></div>`;
    });
    document.getElementById('chatBukuKontakList').innerHTML = html || '<div style="padding:20px; text-align:center;">Kosong.</div>';
};

window.pilihKontakBuku = function(nik, nama) { window.switchChatTab('inbox'); window.loadChatMessages(nik, nama, false); };

window.updateHeaderButtons = function(isActive) {
    const nameDisp = document.getElementById('chatActiveNameDisplay');
    if(!nameDisp) return;
    const infoDisp = document.getElementById('chatActiveInfoDisplay');
    if(infoDisp) infoDisp.style.display = isActive ? 'flex' : 'none';
    const avatarDisp = document.getElementById('chatHeaderAvatar');
    if(avatarDisp) avatarDisp.style.display = isActive ? 'flex' : 'none';
    
    let headerActions = document.getElementById('chatHeaderActions');
    if(headerActions) headerActions.style.display = isActive ? 'flex' : 'none';
};

window.tutupObrolanAktif = function() {
    activeChatNik = null; activeChatName = null;
    try {
        const nameDisp = document.getElementById('chatActiveNameDisplay'); 
        if(nameDisp) nameDisp.innerText = "Pilih Warga di Kotak Masuk..."; 
        window.updateHeaderButtons(false);
        const inp = document.getElementById('adminChatInput'); if(inp) inp.disabled = true; 
        const btnSend = document.getElementById('btnSendAdmin'); if(btnSend) btnSend.disabled = true;
        const msgs = document.getElementById('adminChatMessages'); if(msgs) msgs.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:100px;"><i class="fas fa-comments fa-3x" style="opacity:0.3; margin-bottom:15px;"></i><br>Pilih daftar warga.</div>'; 
        document.querySelectorAll('.chat-contact-item').forEach(el => el.classList.remove('active'));
    } catch(e){}
};

window.openAdminChatFor = function(nik, nama) {
    window.openAdminChat(); 
    setTimeout(() => {
        window.switchChatTab('inbox'); window.loadChatMessages(nik, nama, false);
        const inputChat = document.getElementById('adminChatInput');
        if(inputChat) { inputChat.value = `Halo Bapak/Ibu ${nama}, kami dari Dinas Sosial menindaklanjuti laporan Anda. Bisa dibantu konfirmasi detail permasalahannya?`; inputChat.focus(); }
    }, 500);
};

window.filterChatList = function() {
    let input = document.getElementById('searchChatInput').value.toLowerCase();
    let activeListId = document.getElementById('tabInboxBtn').classList.contains('btn-primary') ? 'chatContactList' : 'chatBukuKontakList';
    document.querySelectorAll(`#${activeListId} .chat-contact-item`).forEach(item => { item.style.display = item.innerText.toLowerCase().includes(input) ? 'flex' : 'none'; });
};

window.openAdminChat = function() { 
    window.openModalUniversal('modalAdminChat'); window.switchChatTab('inbox'); window.tutupObrolanAktif();
    if(!window.chatInterval) { window.chatInterval = setInterval(() => { if(document.getElementById('modalAdminChat').style.display === 'flex') { window.loadChatList(true); if(activeChatNik) window.loadChatMessages(activeChatNik, activeChatName, true); } }, 3000); } 
};

window.loadChatList = async function(isSilent = false) { 
    try { 
        const res = await window.fetchData('/api/chat/list'); if(!res.ok) return;
        let data = await res.json(); if(!Array.isArray(data)) { data = []; } 
        const dataHash = JSON.stringify(data); if (isSilent && lastChatListHash === dataHash) return; lastChatListHash = dataHash; 
        let pinned = []; try { pinned = JSON.parse(localStorage.getItem('pinnedChatsAdmin')) || []; } catch(e){}
        data.sort((a, b) => { let aPin = pinned.includes(a.nik) ? 1 : 0; let bPin = pinned.includes(b.nik) ? 1 : 0; return bPin - aPin; });
        let html = ''; 
        data.forEach(c => { 
            let isActive = c.nik === activeChatNik ? 'active' : ''; let isPinned = pinned.includes(c.nik) ? 'pinned' : '';
            let namaKontak = c.nama || 'Anonim';
            html += `<div class="chat-contact-item ${isActive} ${isPinned}" onclick="window.loadChatMessages(decodeURIComponent('${enc(c.nik)}'), decodeURIComponent('${enc(namaKontak)}'))"><div class="contact-avatar">${namaKontak.charAt(0).toUpperCase()}</div><div class="contact-info"><div class="contact-name">${safeHtml(namaKontak)} ${isPinned ? '<i class="fas fa-thumbtack text-accent" style="font-size:0.8rem;"></i>' : ''}</div><div class="contact-nik">NIK: ${safeHtml(c.nik)}</div><div class="contact-last-msg">${safeHtml(c.last_msg)}</div></div></div>`; 
        }); 
        document.getElementById('chatContactList').innerHTML = html || '<div style="padding:20px; text-align:center;">Kosong.</div>'; window.filterChatList(); 
    } catch(e) {} 
};

window.loadChatMessages = async function(nik, nama, isSilent = false) {
    activeChatNik = nik; activeChatName = nama; 
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

        const dataHash = JSON.stringify(data); 
        if (isSilent && lastChatHashAdmin === dataHash) return; 
        lastChatHashAdmin = dataHash; 
        
        let html = '';
        data.forEach(msg => {
            let isAdmin = msg.sender === 'admin'; 
            let align = isAdmin ? 'flex-end' : 'flex-start'; 
            let bg = isAdmin ? '#dcf8c6' : '#ffffff'; 
            let color = '#303030'; 
            let borderRadius = isAdmin ? '12px 0px 12px 12px' : '0px 12px 12px 12px'; 
            let shadow = '0 1px 2px rgba(0,0,0,0.15)';
            
            let replyHtml = ''; 
            if(msg.reply_to_text) { replyHtml = `<div onclick="window.scrollToMessage(${msg.reply_to_id})" style="cursor:pointer; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; border-left: 4px solid ${isAdmin ? '#25d366' : '#3b82f6'}; margin-bottom: 8px; font-size: 0.85rem; color: #555;"><b>${safeHtml(msg.reply_to_sender)}</b><br><i>${safeHtml(msg.reply_to_text)}</i></div>`; }
            let reactionHtml = ''; 
            if(msg.reaction) { reactionHtml = `<div style="position:absolute; ${isAdmin ? 'left:-10px' : 'right:-10px'}; bottom:-10px; background:white; border-radius:20px; padding:2px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.2); font-size:1rem; z-index:5;">${msg.reaction}</div>`; }
            
            let mediaHtml = ''; let cleanFileUrl = 'null';
            if(msg.file_path) {
                cleanFileUrl = `${API_URL}/uploads/${msg.file_path.replace('/uploads/', '')}`;
                if(msg.file_type === 'audio') { mediaHtml = `<div style="margin-bottom:8px;"><audio controls src="${cleanFileUrl}" style="max-width:220px; height:35px;"></audio></div>`; } 
                else if(msg.file_type === 'image') { mediaHtml = `<img src="${cleanFileUrl}" style="max-width:250px; border-radius:8px; margin-bottom:8px; cursor:pointer; object-fit:cover;" onclick="window.openLightbox('image', '${cleanFileUrl}')">`; } 
                else if(msg.file_type === 'video') { mediaHtml = `<video src="${cleanFileUrl}" controls style="max-width:250px; border-radius:8px; margin-bottom:8px; background:black;"></video>`; }
            }
            
            let trackAdminName = '';
            if(isAdmin && msg.nama_admin) { trackAdminName = `<span style="font-size:0.65rem; color:#888; font-weight:600;">${safeHtml(msg.nama_admin)}</span>`; }
            
            let actionMenu = '';
            if(isAdmin && !msg.is_deleted) { 
                actionMenu = `<div style="position: absolute; left: -25px; top: 10px; cursor: pointer; color: var(--text-muted); font-size:1rem; padding: 0 5px;" onclick="window.toggleChatMenuAdmin(${msg.id}, event)"><i class="fas fa-ellipsis-v hover-action"></i><div id="menu-${msg.id}" style="display:none; position:absolute; right:15px; top:0; background:white; box-shadow:var(--shadow-md); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:150px; border:1px solid var(--border-color);"><button onclick="window.hapusPesanAdmin(${msg.id}, 'everyone')" class="text-danger"><i class="fas fa-trash-alt"></i> Hapus Semua</button></div></div>`; 
            } else if(!isAdmin && !msg.is_deleted) { 
                actionMenu = `<div style="position: absolute; right: -25px; top: 10px; cursor: pointer; color: var(--text-muted); font-size:1rem; padding: 0 5px;" onclick="window.toggleChatMenuAdmin(${msg.id}, event)"><i class="fas fa-ellipsis-v hover-action"></i><div id="menu-${msg.id}" style="display:none; position:absolute; left:15px; top:0; background:white; box-shadow:var(--shadow-md); border-radius:8px; padding:6px; z-index:1000; flex-direction:column; min-width:150px; border:1px solid var(--border-color);"><button onclick="window.setReplyAdmin(${msg.id}, decodeURIComponent('${enc(msg.nama_warga || 'Warga')}'), decodeURIComponent('${enc(msg.pesan)}'), decodeURIComponent('${enc(msg.file_type)}'))"><i class="fas fa-reply" style="color:var(--info);"></i> Balas Pesan</button><button onclick="window.reactToMessageAdmin(${msg.id})"><i class="fas fa-smile" style="color:#f59e0b;"></i> Reaksi Emoji</button></div></div>`; 
            }

            html += `<article id="msg-${msg.id}" style="align-self: ${align}; max-width: 75%; margin-bottom: 15px; position:relative; display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'}; font-family: 'Inter', sans-serif;">
                <section style="background:${bg}; color:${color}; padding:8px 12px; border-radius:${borderRadius}; box-shadow:${shadow}; font-size:0.95rem; line-height:1.4; min-width: 160px; text-align: left;">
                    ${replyHtml}${mediaHtml}
                    ${msg.pesan ? `<span style="display:block; margin-bottom: 8px; word-break: break-word;">${safeHtml(msg.pesan)}</span>` : ''}
                    <footer style="display:flex; justify-content:flex-end; align-items:center; gap:6px; border-top:1px solid rgba(0,0,0,0.06); padding-top:4px; margin-top:4px;">
                        ${trackAdminName}
                        <span style="font-size:0.7rem; color:#64748b; font-weight:700;">${msg.waktu}</span>
                        ${isAdmin ? '<i class="fas fa-check-double" style="font-size:0.7rem; color:#34b7f1;"></i>' : ''}
                    </footer>
                </section>
                ${reactionHtml}
                ${actionMenu}
            </article>`;
        });
        
        if (data.length === 0) { html = `<div style="text-align:center; color:var(--text-muted); margin-top:50px; font-size:0.9rem;">Belum ada pesan. Ketik pesan di bawah untuk memulai obrolan.</div>`; }
        const container = document.getElementById('adminChatMessages'); 
        let isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 80; 
        container.innerHTML = html; 
        if(!isSilent || isAtBottom || data.length === 0) { container.scrollTop = container.scrollHeight; }
    } catch(e) {}
};

// PRATINJAU MEDIA ADMIN SEBELUM DIKIRIM
window.showPreviewAdmin = function(srcUrl, type, fname = '') { 
    let previewContainer = document.getElementById('previewMediaContainerAdmin'); 
    let previewArea = document.getElementById('preSendPreviewAdmin'); 
    
    if(!previewArea) {
        let inputContainer = document.getElementById('adminChatInput');
        if(inputContainer) {
            let parent = inputContainer.parentElement;
            previewArea = document.createElement('div');
            previewArea.id = 'preSendPreviewAdmin';
            previewArea.style = "display:none; position:absolute; bottom:60px; left:10px; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:10px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); z-index:100; min-width:150px;";
            previewArea.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:5px;"><b style="font-size:0.85rem; color:#64748b;" id="adminFileStatusTxt">Lampiran</b><i class="fas fa-times" style="cursor:pointer; color:#ef4444;" onclick="window.batalLampiranAdmin()"></i></div><div id="previewMediaContainerAdmin" style="display:flex; justify-content:center;"></div>`;
            parent.style.position = 'relative'; 
            parent.appendChild(previewArea);
            previewContainer = document.getElementById('previewMediaContainerAdmin');
        }
    }
    
    if(previewArea && previewContainer) {
        document.getElementById('adminFileStatusTxt').innerText = 'Berkas Siap Dikirim'; 
        if(type === 'image') { previewContainer.innerHTML = `<img src="${srcUrl}" style="max-height: 120px; border-radius: 8px; object-fit: contain;">`; } 
        else if(type === 'video') { previewContainer.innerHTML = `<video src="${srcUrl}" controls style="max-height: 120px; border-radius: 8px;"></video>`; } 
        else if (type === 'audio') { previewContainer.innerHTML = `<audio src="${srcUrl}" controls style="height: 40px; border-radius:20px;"></audio>`; } 
        else { previewContainer.innerHTML = `<div style="font-weight:700; color:var(--info); text-align:center;"><i class="fas fa-file-alt fa-3x"></i><br><small>${fname}</small></div>`; } 
        previewArea.style.display = 'block'; 
    }
};

window.batalLampiranAdmin = function() { 
    window.adminMediaBlob = null; 
    window.adminMediaExt = ''; 
    window.adminMediaType = ''; 
    const fileInput = document.getElementById('adminChatFile'); if(fileInput) fileInput.value = ''; 
    const preArea = document.getElementById('preSendPreviewAdmin'); if(preArea) preArea.style.display = 'none'; 
    const preContainer = document.getElementById('previewMediaContainerAdmin'); if(preContainer) preContainer.innerHTML = ''; 
};

window.sendAdminChat = async function() { 
    if(isAdminRecordingAudio) { 
        window.isAutoSendAudio = true; 
        adminAudioRecorder.stop(); 
        adminAudioRecorder.stream.getTracks().forEach(t => t.stop()); 
        return; 
    } 
    window.executeSendAdminChat(); 
};

// EKSEKUSI PENGIRIMAN DATA CHAT/FILE OLEH ADMIN
window.executeSendAdminChat = async function() { 
    if(!activeChatNik) return Swal.fire('Peringatan', 'Pilih warga terlebih dahulu.', 'warning'); 
    const input = document.getElementById('adminChatInput'); 
    const pesan = input ? input.value.trim() : ''; 
    
    // Jangan kirim jika teks dan file sama-sama kosong
    if(!pesan && !window.adminMediaBlob) return; 
    
    const formData = new FormData(); 
    formData.append('sender', 'admin'); 
    formData.append('nama', 'Petugas Dinas'); 
    formData.append('nama_admin', user ? (user.nama_lengkap || user.username) : 'Admin'); 
    formData.append('pesan', pesan); 
    
    if(window.adminMediaBlob) { 
        const finalName = `media_${Date.now()}.${window.adminMediaExt}`; 
        formData.append('file', window.adminMediaBlob, finalName); 
        if(window.adminMediaType) formData.append('custom_file_type', window.adminMediaType); 
    } 
    if(replyToDataAdmin) { 
        formData.append('reply_to_id', replyToDataAdmin.id); 
        formData.append('reply_to_text', replyToDataAdmin.text); 
        formData.append('reply_to_sender', replyToDataAdmin.sender); 
    } 
    
    // Bersihkan form input dan preview di layar
    if(input) input.value = ''; 
    const ep = document.getElementById('emojiPickerAdmin'); 
    if(ep) ep.style.display = 'none'; 
    
    window.batalLampiranAdmin(); 
    window.batalReplyAdmin();
    
    try { 
        // Menggunakan fetch native agar stream multipart form file terkirim sempurna
        const res = await fetch(`${API_URL}/api/chat/${activeChatNik}`, { 
            method: 'POST', 
            body: formData 
        }); 
        if(res.ok) {
            window.loadChatMessages(activeChatNik, activeChatName, true); 
        } else {
            Swal.fire('Gagal', 'Server menolak pengiriman file', 'error');
        }
    } catch(e) { 
        Swal.fire('Error', 'Gagal terhubung ke server', 'error'); 
    } 
};

window.toggleVoiceRecordAdmin = async function() {
    if (!isAdminRecordingAudio) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let recUI = document.getElementById('adminRecordingUI'); let waveBox = document.getElementById('waveContainerAdmin');
            if(!waveBox) {
                waveBox = document.createElement('div'); waveBox.id = 'waveContainerAdmin'; waveBox.style = 'display:flex; align-items:center; gap:4px; margin-left:15px; height:30px; flex:1;';
                for(let i=0; i<15; i++) { waveBox.innerHTML += `<div class="wave-bar" style="width:4px; height:4px; background:#ef4444; border-radius:4px; transition:height 0.05s ease;"></div>`; }
                if(recUI) recUI.appendChild(waveBox); 
            }
            if(waveBox) waveBox.style.display = 'flex';
            
            audioContextAdmin = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextAdmin.createMediaStreamSource(stream);
            analyserAdmin = audioContextAdmin.createAnalyser(); analyserAdmin.fftSize = 64; source.connect(analyserAdmin);
            dataArrayAdmin = new Uint8Array(analyserAdmin.frequencyBinCount);
            
            function animateBars() {
                reqFrameAdmin = requestAnimationFrame(animateBars); analyserAdmin.getByteFrequencyData(dataArrayAdmin);
                if(waveBox) {
                    let bars = waveBox.querySelectorAll('.wave-bar'); let step = Math.floor(dataArrayAdmin.length / bars.length);
                    bars.forEach((bar, index) => { let value = dataArrayAdmin[index * step]; let height = Math.max(4, (value / 255) * 30); bar.style.height = `${height}px`; bar.style.background = value > 150 ? '#991b1b' : '#ef4444'; });
                }
            }
            animateBars();
            
            adminAudioRecorder = new MediaRecorder(stream); 
            adminAudioChunks = [];
            adminAudioRecorder.ondataavailable = e => { if(e.data.size > 0) adminAudioChunks.push(e.data); };
            adminAudioRecorder.onstop = () => {
                const audioBlob = new Blob(adminAudioChunks, { type: 'audio/webm' });
                window.adminMediaBlob = audioBlob; 
                window.adminMediaExt = 'webm'; 
                window.adminMediaType = 'audio';
                isAdminRecordingAudio = false; 
                clearInterval(adminRecordTimer);
                
                if(audioContextAdmin) { audioContextAdmin.close(); cancelAnimationFrame(reqFrameAdmin); }
                if(waveBox) waveBox.style.display = 'none';
                
                if(recUI) recUI.style.display = 'none'; 
                const inp = document.getElementById('adminChatInput'); if(inp) inp.style.display = 'block'; 
                const btnRec = document.getElementById('btnRecordAdmin'); if(btnRec) btnRec.style.color = 'var(--text-muted)';
                
                if(window.isAutoSendAudio) { 
                    window.isAutoSendAudio = false; 
                    window.executeSendAdminChat(); 
                } else { 
                    window.showPreviewAdmin(URL.createObjectURL(audioBlob), 'audio', 'Pesan Suara.webm'); 
                }
            };
            adminAudioRecorder.start(); 
            isAdminRecordingAudio = true;
            if(recUI) recUI.style.display = 'flex'; 
            const inp = document.getElementById('adminChatInput'); if(inp) inp.style.display = 'none'; 
            const btnRec = document.getElementById('btnRecordAdmin'); if(btnRec) btnRec.style.color = 'var(--danger)';
            adminRecordSecs = 0;
            adminRecordTimer = setInterval(() => { adminRecordSecs++; const m = String(Math.floor(adminRecordSecs/60)).padStart(2,'0'); const s = String(adminRecordSecs%60).padStart(2,'0'); const timerEl = document.getElementById('adminRecordTime'); if(timerEl) timerEl.innerText = `${m}:${s}`; }, 1000);
        } catch(err) { Swal.fire('Akses Mikrofon Gagal', 'Pastikan Microphone diizinkan.', 'error'); }
    } else { 
        adminAudioRecorder.stop(); 
        adminAudioRecorder.stream.getTracks().forEach(t => t.stop()); 
    }
};

// SUNTIKAN STIKER/EMOJI ADMIN (ANTI-CEGAT & LANGSUNG MUNCUL)
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

window.initEmojis = function() { };

window.handleChatEnter = function(e, type) { 
    if(e.key === 'Enter') { 
        if(type === 'admin') window.sendAdminChat(); 
    } 
};

window.editPesanAdmin = async function(id, pesanLama, fileUrl, fileType) { const { value: pesanBaru, isConfirmed } = await Swal.fire({ title: 'Edit Balasan', html: `<textarea id="swal-edit-msg" class="swal2-textarea" style="margin: 10px 0; width: 90%; font-family:Inter; font-size:1rem; padding:10px;">${pesanLama}</textarea>`, showCancelButton: true, confirmButtonText: 'Simpan Teks', cancelButtonText: 'Batal', preConfirm: () => document.getElementById('swal-edit-msg').value }); if (isConfirmed && pesanBaru !== undefined && pesanBaru !== pesanLama) { const formData = new FormData(); formData.append('pesan', pesanBaru); await window.fetchData(`/api/chat/action/${id}`, { method: 'PUT', body: formData }); window.loadChatMessages(activeChatNik, activeChatName, true); } };
window.setReplyAdmin = function(id, sender, text, file_type) { let displayTxt = text; if(file_type === 'image') displayTxt = '📷 Gambar'; else if(file_type === 'video') displayTxt = '🎥 Video'; else if(file_type === 'audio') displayTxt = '🎤 Pesan Suara'; replyToDataAdmin = {id: id, sender: sender, text: displayTxt}; document.getElementById('replyPreviewSenderAdmin').innerText = safeHtml(sender); document.getElementById('replyPreviewTextAdmin').innerText = displayTxt.length > 60 ? displayTxt.substring(0,60)+'...' : displayTxt; document.getElementById('replyPreviewContainerAdmin').style.display = 'flex'; const inp = document.getElementById('adminChatInput'); if(inp) inp.focus(); };
window.batalReplyAdmin = function() { replyToDataAdmin = null; const cont = document.getElementById('replyPreviewContainerAdmin'); if(cont) cont.style.display = 'none'; };
window.reactToMessageAdmin = async function(msgId) { const { value: emoji } = await Swal.fire({ title: 'Pilih Reaksi', input: 'select', inputOptions: { '👍': '👍 Jempol', '❤️': '❤️ Hati', '😂': '😂 Tertawa', '🙏': '🙏 Terima Kasih', '🔥': '🔥 Mantap' }, showCancelButton: true }); if(emoji) { await window.fetchData(`/api/chat/react/${msgId}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({reaction: emoji}) }); window.loadChatMessages(activeChatNik, activeChatName, true); } };
window.toggleChatMenuAdmin = function(id, event) { event.stopPropagation(); const allMenus = document.querySelectorAll('[id^="menu-"]'); allMenus.forEach(m => { if(m.id !== `menu-${id}`) m.style.display = 'none'; }); const menu = document.getElementById(`menu-${id}`); if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
window.hapusPesanAdmin = async function(id, tipe) { if(confirm(`Yakin ingin ${tipe === 'everyone' ? 'menarik pesan ini' : 'menghapus pesan dari layar Anda'}?`)) { await window.fetchData(`/api/chat/action/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: tipe, requester: 'admin'}) }); window.loadChatMessages(activeChatNik, activeChatName, true); } };
window.scrollToMessage = function(id) { const el = document.getElementById(`msg-${id}`); if(el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('highlight-msg'); setTimeout(() => el.classList.remove('highlight-msg'), 2500); } };

window.toggleChatActionDropdown = function(e) { e.stopPropagation(); let dd = document.getElementById('chatActionDropdown'); if(dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block'; };
window.pinChatActive = function() { if(!activeChatNik) return; let pinnedChats = []; try { pinnedChats = JSON.parse(localStorage.getItem('pinnedChatsAdmin')) || []; } catch(e){} if(pinnedChats.includes(activeChatNik)) { pinnedChats = pinnedChats.filter(n => n !== activeChatNik); Swal.fire({toast:true, position:'top-end', icon:'info', title:'Semat dilepas', showConfirmButton:false, timer:2000}); } else { pinnedChats.push(activeChatNik); Swal.fire({toast:true, position:'top-end', icon:'success', title:'Obrolan disematkan', showConfirmButton:false, timer:2000}); } localStorage.setItem('pinnedChatsAdmin', JSON.stringify(pinnedChats)); const dd = document.getElementById('chatActionDropdown'); if(dd) dd.style.display = 'none'; window.loadChatList(true); };
window.bukaModalAlihkanAdmin = function() { if(!activeChatNik) return; const twn = document.getElementById('transferWargaName'); if(twn) twn.innerText = activeChatName; window.fetchData('/api/users').then(r => r.json()).then(data => { let opts = '<option value="">-- Pilih Petugas / Admin Lain --</option>'; data.forEach(u => { if(u.username !== user.username) opts += `<option value="${safeHtml(u.nama_lengkap)}">${safeHtml(u.nama_lengkap)} (${safeHtml(u.role).toUpperCase()})</option>`; }); const st = document.getElementById('selectAdminTransfer'); if(st) st.innerHTML = opts; }); window.openModalUniversal('modalAlihkanAdmin'); const dd = document.getElementById('chatActionDropdown'); if(dd) dd.style.display = 'none'; };
window.eksekusiAlihkanAdmin = async function() { const st = document.getElementById('selectAdminTransfer'); let target = st ? st.value : ''; if(!target) return Swal.fire('Error', 'Pilih petugas tujuan', 'error'); Swal.fire({title:'Mengalihkan...', didOpen:()=>Swal.showLoading()}); await window.fetchData('/api/notifikasi/send', { method: 'POST', body: JSON.stringify({pesan: `🔄 TRANSFER CHAT: ${user.nama_lengkap} mengalihkan penanganan warga ${activeChatName} (${activeChatNik}) kepada Anda.`, role_target: 'admin'}) }); window.closeModal('modalAlihkanAdmin'); Swal.fire('Dialihkan', `Obrolan berhasil dilimpahkan ke ${target}`, 'success'); };
window.bukaModalLaporRiwayat = function() { if(!activeChatNik) return; const inp = document.getElementById('inputAlasanLaporChat'); if(inp) inp.value = ''; window.openModalUniversal('modalLaporRiwayat'); const dd = document.getElementById('chatActionDropdown'); if(dd) dd.style.display = 'none'; };
window.eksekusiLaporRiwayat = async function() { const inp = document.getElementById('inputAlasanLaporChat'); let alasan = inp ? inp.value : ''; if(!alasan) return Swal.fire('Error', 'Alasan investigasi wajib diisi', 'error'); Swal.fire({title:'Melaporkan...', didOpen:()=>Swal.showLoading()}); await window.fetchData('/api/notifikasi/send', { method: 'POST', body: JSON.stringify({pesan: `🚨 LAPORAN INVESTIGASI: ${user.nama_lengkap} melaporkan riwayat chat ${activeChatName} (${activeChatNik}). Alasan: ${alasan}`, role_target: 'admin'}) }); window.closeModal('modalLaporRiwayat'); Swal.fire('Terkirim', 'Riwayat chat telah dilaporkan ke pusat investigasi.', 'success'); };
window.hapusRiwayatLokal = async function() { if(!activeChatNik) return; if(!confirm('Yakin ingin membersihkan layar chat ini untuk Anda secara lokal?')) return; const dd = document.getElementById('chatActionDropdown'); if(dd) dd.style.display = 'none'; const msgs = document.getElementById('adminChatMessages'); if(msgs) msgs.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:100px;">Riwayat dibersihkan dari layar Anda.</div>'; Swal.fire({toast:true, position:'top-end', icon:'success', title:'Riwayat layar dibersihkan', showConfirmButton:false, timer:2000}); };

// ==========================================
// 8. WEBRTC PANGGILAN VIDEO, SUARA, BLUR & EMOJI
// ==========================================
window.callType = 'audio';
window.initPeerJS = function() { 
    if(peer) peer.destroy(); peer = new Peer('dinsos-admin-sidoarjo-01'); 
    peer.on('connection', (conn) => { conn.on('data', (data) => { if(data.type === 'emoji') window.showCallReaction(data.emoji); }); });
    peer.on('call', (call) => { 
        activeCall = call; window.callType = call.metadata ? call.metadata.callType : 'audio';
        let callerId = call.peer.replace('dinsos-warga-', 'Warga NIK: '); 
        const cnt = document.getElementById('callerNameText'); if(cnt) cnt.innerText = callerId; 
        const ctt = document.getElementById('callerTypeText'); if(ctt) ctt.innerText = window.callType === 'video' ? 'Panggilan Video Masuk' : 'Panggilan Suara Masuk';
        const inc = document.getElementById('incomingCallUI'); if(inc) inc.style.display = 'flex'; 
        const audio = document.getElementById('ringtoneAudio'); if(audio) audio.play().catch(()=>{});
        window.fetchData('/api/notifikasi/send', { method: 'POST', body: JSON.stringify({pesan: `📞 PANGGILAN MASUK: ${callerId} memanggil Anda.`, role_target: 'admin'}) }); 
    }); 
};
window.startCallWarga = async function(type) { 
    if(!activeChatNik) return Swal.fire('Error', 'Pilih warga terlebih dahulu.', 'warning'); 
    window.callType = type; 
    const acn = document.getElementById('activeCallName'); if(acn) acn.innerText = activeChatName; 
    const acUI = document.getElementById('activeCallUI'); if(acUI) acUI.style.display = 'flex'; 
    const cst = document.getElementById('callStatusText'); if(cst) cst.innerText = "Memanggil Warga... (Menunggu diangkat)"; 
    if(type === 'video') { const vca = document.getElementById('videoCallArea'); if(vca) vca.style.display = 'block'; const aca = document.getElementById('audioCallArea'); if(aca) aca.style.display = 'none'; const bv = document.getElementById('btnVideo'); if(bv) bv.style.display = 'flex'; const bb = document.getElementById('btnBlur'); if(bb) bb.style.display = 'flex'; } else { const vca = document.getElementById('videoCallArea'); if(vca) vca.style.display = 'none'; const aca = document.getElementById('audioCallArea'); if(aca) aca.style.display = 'flex'; const bv = document.getElementById('btnVideo'); if(bv) bv.style.display = 'none'; const bb = document.getElementById('btnBlur'); if(bb) bb.style.display = 'none'; }
    window.fetchData('/api/notifikasi/send', { method: 'POST', body: JSON.stringify({pesan: `📞 PANGGILAN KELUAR: Anda memanggil warga ${activeChatName}.`, role_target: 'admin'}) }); 
    const constraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: type === 'video' ? { facingMode: "user" } : false };
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints); 
        if(type === 'video') { const lv = document.getElementById('localVideo'); if(lv) lv.srcObject = localStream; }
        activeCall = peer.call('dinsos-warga-' + activeChatNik, localStream, { metadata: { callType: type } }); dataConnection = peer.connect('dinsos-warga-' + activeChatNik); 
        activeCall.on('stream', (remoteStream) => { const cst2 = document.getElementById('callStatusText'); if(cst2) cst2.innerText = "Terhubung"; if(remoteStream.getVideoTracks().length > 0) { const rv = document.getElementById('remoteVideo'); if(rv) rv.srcObject = remoteStream; } window.startCallTimerAdmin('callDuration'); }); 
        activeCall.on('close', () => window.endCallUI()); activeCall.on('error', () => { Swal.fire('Gagal', 'Warga sedang offline atau menolak panggilan.', 'error'); window.endCallUI(); }); 
    } catch(err) { Swal.fire('Akses Ditolak / Error', 'Kamera/Mikrofon tidak diizinkan atau tidak ditemukan.', 'error'); window.endCallUI(); } 
};
window.acceptCall = async function() { 
    const audio = document.getElementById('ringtoneAudio'); if(audio) { audio.pause(); audio.currentTime = 0; }
    const constraints = { audio: { echoCancellation: true, noiseSuppression: true }, video: window.callType === 'video' ? { facingMode: "user" } : false };
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if(window.callType === 'video') { const vca = document.getElementById('videoCallArea'); if(vca) vca.style.display = 'block'; const aca = document.getElementById('audioCallArea'); if(aca) aca.style.display = 'none'; const bv = document.getElementById('btnVideo'); if(bv) bv.style.display = 'flex'; const bb = document.getElementById('btnBlur'); if(bb) bb.style.display = 'flex'; const lv = document.getElementById('localVideo'); if(lv) lv.srcObject = localStream; } else { const vca = document.getElementById('videoCallArea'); if(vca) vca.style.display = 'none'; const aca = document.getElementById('audioCallArea'); if(aca) aca.style.display = 'flex'; const bv = document.getElementById('btnVideo'); if(bv) bv.style.display = 'none'; const bb = document.getElementById('btnBlur'); if(bb) bb.style.display = 'none'; }
        activeCall.answer(localStream); let callerId = activeCall.peer; dataConnection = peer.connect(callerId); 
        const inc = document.getElementById('incomingCallUI'); if(inc) inc.style.display = 'none'; const acUI = document.getElementById('activeCallUI'); if(acUI) acUI.style.display = 'flex'; const acn = document.getElementById('activeCallName'); if(acn) acn.innerText = "Panggilan Masuk"; const cst = document.getElementById('callStatusText'); if(cst) cst.innerText = "Terhubung"; 
        activeCall.on('stream', (remoteStream) => { if(remoteStream.getVideoTracks().length > 0) { const rv = document.getElementById('remoteVideo'); if(rv) rv.srcObject = remoteStream; } window.startCallTimerAdmin('callDuration'); }); 
        activeCall.on('close', () => window.endCallUI()); 
    } catch(err) { Swal.fire('Error', 'Kamera/Mikrofon tidak ditemukan. Beri Izin Browser.', 'error'); window.rejectCall(); } 
};
window.toggleMuteCall = function() { if(!localStream) return; let audioTrack = localStream.getAudioTracks()[0]; audioTrack.enabled = !audioTrack.enabled; const btn = document.getElementById('btnMute'); if(btn) { if(!audioTrack.enabled) { btn.innerHTML = '<i class="fas fa-microphone-slash"></i>'; btn.classList.add('off'); } else { btn.innerHTML = '<i class="fas fa-microphone"></i>'; btn.classList.remove('off'); } } };
window.toggleVideoCall = function() { if(!localStream) return; let videoTrack = localStream.getVideoTracks()[0]; if(!videoTrack) return; videoTrack.enabled = !videoTrack.enabled; const btn = document.getElementById('btnVideo'); if(btn) { if(!videoTrack.enabled) { btn.innerHTML = '<i class="fas fa-video-slash"></i>'; btn.classList.add('off'); } else { btn.innerHTML = '<i class="fas fa-video"></i>'; btn.classList.remove('off'); } } };
window.toggleBlur = function() { isBlurred = !isBlurred; const lv = document.getElementById('localVideo'); const btn = document.getElementById('btnBlur'); if(lv && btn) { if(isBlurred) { lv.classList.add('blurred'); btn.classList.add('active-blur'); } else { lv.classList.remove('blurred'); btn.classList.remove('active-blur'); } } };
window.sendCallEmoji = function(emoji) { window.showCallReaction(emoji); if(dataConnection && dataConnection.open) { dataConnection.send({ type: 'emoji', emoji: emoji }); } };
window.showCallReaction = function(emoji) { const display = document.getElementById('callReactionDisplay'); if(display) { display.innerText = emoji; display.classList.remove('show'); void display.offsetWidth; display.classList.add('show'); } };
window.startCallTimerAdmin = function(elId) { const el = document.getElementById(elId); if(el) { el.style.display = 'block'; callSecondsAdmin = 0; if(callTimerAdmin) clearInterval(callTimerAdmin); callTimerAdmin = setInterval(() => { callSecondsAdmin++; const m = String(Math.floor(callSecondsAdmin / 60)).padStart(2, '0'); const s = String(callSecondsAdmin % 60).padStart(2, '0'); el.innerText = `${m}:${s}`; }, 1000); } };
window.rejectCall = function() { const audio = document.getElementById('ringtoneAudio'); if(audio) { audio.pause(); audio.currentTime = 0; } if(activeCall) activeCall.close(); window.endCallUI(); };
window.endCall = function() { if(activeCall) activeCall.close(); if(localStream) localStream.getTracks().forEach(t => t.stop()); window.endCallUI(); };
window.endCallUI = function() { const inc = document.getElementById('incomingCallUI'); if(inc) inc.style.display = 'none'; const acUI = document.getElementById('activeCallUI'); if(acUI) acUI.style.display = 'none'; activeCall = null; if(callTimerAdmin) clearInterval(callTimerAdmin); const cd = document.getElementById('callDuration'); if(cd) cd.style.display = 'none'; const rv = document.getElementById('remoteVideo'); if(rv) rv.srcObject = null; const lv = document.getElementById('localVideo'); if(lv) lv.srcObject = null; };

window.tanggapiLaporan = async function(nik, nama) { Swal.fire({ title: 'Tanggapi Laporan', text: `Kirim pemberitahuan ke warga (${nama}) bahwa masalah sedang ditangani?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Tanggapi' }).then(async (res) => { if(res.isConfirmed) { Swal.fire({title: 'Memproses...', didOpen: ()=>Swal.showLoading()}); try { const response = await window.fetchData('/api/admin/lapor-tanggapi', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: nik}) }); if(response.ok) { Swal.fire('Terkirim', 'Tanggapan diteruskan ke warga.', 'success'); window.loadDashboardData(); } else { Swal.fire('Gagal', 'Sistem menolak permintaan ini.', 'error'); } } catch(e){ Swal.fire('Error Jaringan', 'Gagal tersambung ke server.', 'error'); } } }).catch(() => Swal.close()); };
window.konfirmasiLaporSelesaiAdmin = async function(nik, nama) { Swal.fire({ title: 'Tutup Kasus Investigasi?', text: `Tutup dan selesaikan kasus pelaporan warga (${nama}) secara permanen?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Tutup Kasus', confirmButtonColor: '#3b82f6' }).then(async (res) => { if(res.isConfirmed) { Swal.fire({title: 'Memproses...', didOpen: ()=>Swal.showLoading()}); try { const response = await window.fetchData('/api/admin/lapor-selesai', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nik: nik}) }); if(response.ok) { Swal.fire('Selesai', 'Kasus ditutup secara permanen.', 'success'); window.loadDashboardData(); } } catch(e){} } }); };
window.bukaModalSalur = async function(nik, nama) { const { value: file } = await Swal.fire({ title: 'Unggah Bukti Penyaluran', text: `Kirim foto bukti bansos untuk ${nama} (Tahap 1)`, input: 'file', inputAttributes: { accept: 'image/*', 'aria-label': 'Upload foto bukti' }, showCancelButton: true, confirmButtonText: 'Unggah', cancelButtonText: 'Batal' }); if (file) { Swal.fire({title: 'Mengunggah...', didOpen: () => Swal.showLoading()}); const formData = new FormData(); formData.append('nik', nik); formData.append('foto', file); try { const res = await fetch(`${API_URL}/api/admin/salur?token=${window.getCleanToken()}`, { method: 'POST', body: formData }); if(res.ok) { Swal.fire('Berhasil!', 'Bukti tahap 1 terunggah. Menunggu konfirmasi warga.', 'success'); window.loadDashboardData(); } else { Swal.fire('Gagal', 'Terjadi kesalahan sistem.', 'error'); } } catch(e) { Swal.fire('Error', 'Koneksi terputus.', 'error'); } } };
window.finalisasiAdmin = async function(nik) { Swal.fire({ title: 'Verifikasi Akhir', text: "Warga telah mengonfirmasi penerimaan bansos. Lanjutkan verifikasi akhir untuk menutup siklus?", icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Verifikasi Akhir' }).then(async (result) => { if (result.isConfirmed) { Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()}); try { const res = await fetch(`${API_URL}/api/admin/final-salur?token=${window.getCleanToken()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nik: nik }) }); if(res.ok) { Swal.fire('Sukses!', 'Siklus penyaluran telah ditutup dengan aman.', 'success'); window.loadDashboardData(); } } catch(e) {} } }); };
window.verifyAllData = async function() { const unverifiedIds = globalDataWarga.filter(w => !w.is_verified).map(w => w.id); if(unverifiedIds.length === 0) { return Swal.fire('Info', 'Semua data sudah disetujui.', 'info'); } if(!confirm(`Yakin MENYETUJUI SEMUANYA?`)) return; Swal.fire({title: 'Memverifikasi...', didOpen: () => Swal.showLoading()}); try { const res = await window.fetchData(`/warga/bulk/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ids: unverifiedIds}) }); if(res.ok) { window.loadDashboardData(); Swal.fire('Berhasil!', `Data disetujui sekaligus.`, 'success'); } } catch(e) { } };
window.toggleSelectAll = function(cb) { if(dtTable) { dtTable.$('.row-checkbox').prop('checked', cb.checked); } window.checkBulkAction(); };
window.checkBulkAction = function() { let count = 0; if(dtTable) { count = dtTable.$('.row-checkbox:checked').length; } const fab = document.getElementById('fabBulk'); const bct = document.getElementById('bulkCount'); if(bct) bct.innerText = count; if(fab) { if(count > 0) { fab.classList.add('active'); } else { fab.classList.remove('active'); } } };
window.bulkProcess = async function(actionType) { if(!dtTable) return; const checked = dtTable.$('.row-checkbox:checked'); if(checked.length === 0) return; let ids = Array.from(checked).map(cb => cb.value); if(actionType === 'delete') { if(!confirm(`Yakin MENGHAPUS massal?`)) return; Swal.fire({title: 'Menghapus...', didOpen: () => Swal.showLoading()}); await window.fetchData(`/warga/bulk/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ids: ids}) }); } else if (actionType === 'verify') { Swal.fire({title: 'Memverifikasi...', didOpen: () => Swal.showLoading()}); await window.fetchData(`/warga/bulk/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ids: ids}) }); } window.loadDashboardData(); Swal.close(); };
window.tambahData = function(e) { e.preventDefault(); const p = { nik: document.getElementById('nik').value, nama: document.getElementById('nama').value, no_hp: document.getElementById('no_hp').value || "", email: document.getElementById('email').value || "", tempat_lahir: document.getElementById('tempatLahir').value || "", tanggal_lahir: document.getElementById('tglLahir').value || "", alamat: document.getElementById('alamat').value || "", catatan: document.getElementById('catatan').value || "", c1: parseFloat(document.getElementById('c1').value) || 0, c2: parseInt(document.getElementById('c2').value) || 0, c3: parseInt(document.getElementById('c3').value) || 0, c4: parseInt(document.getElementById('c4').value) || 1, c5: parseInt(document.getElementById('c5').value) || 0, c6: parseInt(document.getElementById('c6').value) || 1, c7: parseInt(document.getElementById('c7').value) || 0, c8: parseInt(document.getElementById('c8').value) || 1, c9: parseInt(document.getElementById('c9').value) || 1, c10: parseInt(document.getElementById('c10').value) || 1, lat: document.getElementById('lat').value || "", lng: document.getElementById('lng').value || "" }; window.fetchData(`/warga`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(res => { if(res.ok) { window.loadDashboardData(); Swal.fire('Berhasil', 'Data terekam', 'success'); const bf = document.getElementById('bansosForm'); if(bf) bf.reset(); } }); };
window.simpanEdit = function(e) { e.preventDefault(); const p = { nik: document.getElementById('editNik').value, nama: document.getElementById('editNama').value, no_hp: document.getElementById('editNoHp').value || "", email: document.getElementById('editEmail').value || "", tempat_lahir: document.getElementById('editTempatLahir').value || "", tanggal_lahir: document.getElementById('editTglLahir').value || "", alamat: document.getElementById('editAlamat').value || "", catatan: document.getElementById('editCatatan').value || "", c1: parseFloat(document.getElementById('editC1').value) || 0, c2: parseInt(document.getElementById('editC2').value) || 0, c3: parseInt(document.getElementById('editC3').value) || 0, c4: parseInt(document.getElementById('editC4').value) || 1, c5: parseInt(document.getElementById('editC5').value) || 0, c6: parseInt(document.getElementById('editC6').value) || 1, c7: parseInt(document.getElementById('editC7').value) || 0, c8: parseInt(document.getElementById('editC8').value) || 1, c9: parseInt(document.getElementById('editC9').value) || 1, c10: parseInt(document.getElementById('editC10').value) || 1 }; window.fetchData(`/warga/${document.getElementById('editId').value}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(res => { if(res.ok) { window.loadDashboardData(); window.closeModal('modalEdit'); Swal.fire('Sukses', 'Data diperbarui', 'success'); } }); };
window.bukaModalEdit = function(id) { const w=globalDataWarga.find(x=>x.id==id); if(!w)return; document.getElementById('editId').value=w.id; document.getElementById('editNama').value=w.nama; document.getElementById('editNik').value=w.nik; document.getElementById('editNoHp').value=w.no_hp||''; document.getElementById('editEmail').value=w.email||''; document.getElementById('editTempatLahir').value=w.tempat_lahir||''; document.getElementById('editTglLahir').value=w.tanggal_lahir||''; document.getElementById('editAlamat').value=w.alamat||''; document.getElementById('editCatatan').value=w.catatan||''; document.getElementById('editC1').value=w.c1_ekonomi; document.getElementById('editC2').value=w.c2_aset; document.getElementById('editC3').value=w.c3_umur; document.getElementById('editC4').value=w.c4_jenis_kelamin; document.getElementById('editC5').value=w.c5_tanggungan; document.getElementById('editC6').value=w.c6_status_pernikahan; document.getElementById('editC7').value=w.c7_kepemilikan_anak; document.getElementById('editC8').value=w.c8_tempat_tinggal; document.getElementById('editC9').value=w.c9_pendidikan; document.getElementById('editC10').value=w.c10_kesehatan; window.openModalUniversal('modalEdit'); };
window.hapusData = async function(id) { if(confirm('Hapus permanen?')) { await window.fetchData(`/warga/${id}`, { method: 'DELETE' }); window.loadDashboardData(); } };
window.toggleVerif = async function(id) { Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()}); const res = await window.fetchData(`/warga/${id}/verify`, { method: 'PATCH' }); if(res && res.ok) { window.loadDashboardData(); Swal.fire('Terkirim!', 'Status diupdate.', 'success'); } };
window.bukaModalBobot = function() { window.openModalUniversal('modalBobot'); window.fetchBobotLogic(); };
window.fetchBobotLogic = async function() { const res = await window.fetchData('/kriteria'); if(!res) return; const d = await res.json(); let h=''; d.forEach(k=>h+=`<div><label class="form-label">${k.kode} (${k.jenis})</label><input type="number" class="bobot-val form-input" data-kode="${k.kode}" value="${k.bobot}" step="0.001"></div>`); const bi = document.getElementById('bobotInputs'); if(bi) bi.innerHTML=h; };
window.simpanBobot = async function(e) { e.preventDefault(); const i=document.querySelectorAll('.bobot-val'); let u=[]; i.forEach(x=>u.push({kode:x.dataset.kode,bobot:x.value})); await window.fetchData(`/kriteria`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) }); window.closeModal('modalBobot'); Swal.fire('Tersimpan', 'Bobot BWM berhasil disuntikkan', 'success'); };
window.bukaModalDetail = function() { if(!detailData) return; const d = detailData; const container = document.getElementById('detailContent'); if(!container) return; container.innerHTML = ''; let htmlKrit = `<div class="card" style="box-shadow:var(--shadow-sm); border:1px solid var(--border-color); margin-bottom: 20px;"><div class="card-header" style="background:#f8fafc; padding: 1rem;"><div class="card-title" style="font-size:1rem;"><i class="fas fa-weight-hanging text-accent"></i> Vektor Bobot Kriteria (W)</div></div><div class="table-container" style="padding:0;"><table class="modern-table" style="border:none; border-radius:0;"><thead><tr><th>Kode Kriteria</th><th>Nama Indikator</th><th>Bobot Tersuntik</th><th>Nilai Max (Benefit)</th><th>Nilai Min (Cost)</th></tr></thead><tbody>`; d.kriteria.forEach(k => { htmlKrit += `<tr><td><span class="badge badge-blue">${k.kode}</span></td><td style="font-weight:600;">${k.nama}</td><td><span class="matriks-val">${k.bobot}</span></td><td><span class="minmax-val val-max">${d.min_max[k.kode].max}</span></td><td><span class="minmax-val val-min">${d.min_max[k.kode].min}</span></td></tr>`; }); htmlKrit += `</tbody></table></div></div>`; let htmlNorm = `<div class="card" style="box-shadow:var(--shadow-sm); border:1px solid var(--border-color);"><div class="card-header" style="background:#f8fafc; padding: 1rem;"><div class="card-title" style="font-size:1rem;"><i class="fas fa-table text-info"></i> Matriks Keputusan Ternormalisasi (R)</div></div><div class="table-container" style="padding:0; max-height: 400px; overflow-y:auto;"><table class="modern-table" style="border:none; border-radius:0;"><thead><tr><th>Alternatif (Warga)</th><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th><th>C6</th><th>C7</th><th>C8</th><th>C9</th><th>C10</th></tr></thead><tbody>`; d.matriks_normalisasi.forEach(row => { htmlNorm += `<tr><td style="font-weight:600; font-size:0.85rem;">${row.nama}</td><td>${row.C1}</td><td>${row.C2}</td><td>${row.C3}</td><td>${row.C4}</td><td>${row.C5}</td><td>${row.C6}</td><td>${row.C7}</td><td>${row.C8}</td><td>${row.C9}</td><td>${row.C10}</td></tr>`; }); htmlNorm += `</tbody></table></div></div>`; container.innerHTML = htmlKrit + htmlNorm; window.openModalUniversal('modalDetail'); };

window.bukaModalLaporanChat = async function() { window.openModalUniversal('modalLaporanChat'); window.loadLaporanChat(); };
window.loadLaporanChat = async function() {
    const lcl = document.getElementById('laporanChatList'); if(!lcl) return; lcl.innerHTML = '<div style="text-align:center; padding: 20px;">Memuat data forensik chat...</div>';
    try {
        const res = await window.fetchData('/api/admin/reported-chats'); let data = await res.json(); if(!Array.isArray(data)) data = [];
        let html = '';
        if(data.length === 0) { html = '<div style="text-align:center; padding:50px; color:var(--text-muted); font-size:1.2rem;"><i class="fas fa-check-circle fa-3x" style="color:var(--primary); opacity:0.5; margin-bottom:15px; display:block;"></i>Tidak ada laporan pelanggaran aktif dari warga. Lingkungan aman.</div>'; } 
        else {
            data.forEach(item => {
                let mediaTxt = item.file_path ? `<br><br><a href="${API_URL}/uploads/${item.file_path}" target="_blank" class="btn btn-secondary" style="font-size:0.8rem;"><i class="fas fa-paperclip"></i> Bukti Lampiran File</a>` : '';
                html += `<div class="card" style="padding:20px; margin-bottom:20px; border-left: 5px solid var(--danger); box-shadow:var(--shadow-md);"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 20px;"><div style="flex: 1;"><h4 style="margin:0 0 5px 0; color:var(--text-main); font-size: 1.15rem;"><i class="fas fa-user-tag text-info"></i> Pelapor: ${safeHtml(item.nama_warga)} (NIK: ${safeHtml(item.nik_warga)})</h4><div style="font-size:0.9rem; color:var(--danger); font-weight:800; margin-bottom:15px; background:#fef2f2; display:inline-block; padding: 4px 10px; border-radius: 20px; border:1px solid #fecaca;"><i class="fas fa-flag"></i> Alasan Laporan: ${safeHtml(item.report_reason)}</div><div style="background:#f1f5f9; padding:15px; border-radius:12px; font-style:italic; border: 1px dashed var(--border-color);"><b style="color:var(--text-main);">Tersangka / Pengirim Asli: ${safeHtml(item.pengirim_asli).toUpperCase()}</b><br><div style="margin-top:5px; color:#334155; font-size:1.05rem;">"${safeHtml(item.pesan)}" ${mediaTxt}</div></div><div style="font-size:0.85rem; color:var(--text-muted); margin-top:10px;"><i class="fas fa-clock"></i> Waktu Kejadian: ${item.waktu}</div></div><div style="display:flex; flex-direction:column; gap:10px; width: 220px; flex-shrink: 0;"><button onclick="window.prosesLaporanChat(${item.id}, 'delete')" class="btn btn-primary" style="background:linear-gradient(135deg, var(--danger), #991b1b);"><i class="fas fa-gavel"></i> Valid (Hapus Pesan)</button><button onclick="window.prosesLaporanChat(${item.id}, 'ignore')" class="btn btn-secondary"><i class="fas fa-times"></i> Laporan Palsu (Abaikan)</button></div></div></div>`;
            });
        }
        lcl.innerHTML = html;
    } catch(e) {}
};
window.prosesLaporanChat = async function(id, action) { Swal.fire({title: 'Menetapkan Hukuman...', didOpen: () => Swal.showLoading()}); try { await window.fetchData(`/api/admin/resolve-report/${id}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: action}) }); Swal.fire('Keputusan Ditetapkan', action === 'delete' ? 'Pesan yang melanggar telah divonis dan ditarik dari seluruh sistem.' : 'Laporan warga ditolak (Aman).', 'success'); window.loadLaporanChat(); } catch(e) { Swal.fire('Error', 'Gagal menetapkan keputusan server', 'error'); } };

window.bukaModalPengguna = function() { if(user && user.role !== 'admin') { return Swal.fire('Akses Ditolak', 'Hanya Administrator yang dapat mengakses menu ini.', 'error'); } window.openModalUniversal('modalPengguna'); window.resetFormUser(); window.loadUsers(); };
window.loadUsers = async function() { try { const res = await window.fetchData('/api/users'); let data = await res.json(); if(!Array.isArray(data)) data = []; let html = ''; data.forEach(u => { let roleBadge = u.role === 'admin' ? '<span class="badge badge-blue"><i class="fas fa-crown"></i> Admin</span>' : '<span class="badge badge-gray"><i class="fas fa-user"></i> Operator</span>'; html += `<tr><td>${u.id}</td><td style="font-weight:600;">${safeHtml(u.username)}</td><td>${roleBadge}</td><td style="text-align:center;"><button onclick="window.editUser(${u.id}, '${escapeInlineJS(u.username)}', '${escapeInlineJS(u.role)}')" class="btn" style="padding:4px 8px; background:var(--accent); color:white; border-radius:6px; margin-right:4px;"><i class="fas fa-edit"></i></button><button onclick="window.hapusUser(${u.id})" class="btn" style="padding:4px 8px; background:var(--danger); color:white; border-radius:6px;"><i class="fas fa-trash"></i></button></td></tr>`; }); const utb = document.getElementById('userTableBody'); if(utb) utb.innerHTML = html; } catch(e) { } };
window.resetFormUser = function() { const fu = document.getElementById('formUser'); if(fu) fu.reset(); const ui = document.getElementById('userId'); if(ui) ui.value = ''; const fut = document.getElementById('formUserTitle'); if(fut) fut.innerText = 'Tambah Akun Baru'; const ph = document.getElementById('pwHelp'); if(ph) ph.innerText = '(Wajib)'; const mp = document.getElementById('managePassword'); if(mp) mp.required = true; };
window.editUser = function(id, username, role) { const ui = document.getElementById('userId'); if(ui) ui.value = id; const mu = document.getElementById('manageUsername'); if(mu) mu.value = decodeURIComponent(username); const mr = document.getElementById('manageRole'); if(mr) mr.value = decodeURIComponent(role); const fut = document.getElementById('formUserTitle'); if(fut) fut.innerText = 'Edit Akun'; const ph = document.getElementById('pwHelp'); if(ph) ph.innerText = '(Kosongkan jika tidak diubah)'; const mp = document.getElementById('managePassword'); if(mp) mp.required = false; };
window.simpanUser = async function(e) { e.preventDefault(); const ui = document.getElementById('userId'); const id = ui ? ui.value : ''; const mu = document.getElementById('manageUsername'); const mr = document.getElementById('manageRole'); const payload = { username: mu ? mu.value : '', role: mr ? mr.value : '' }; const mp = document.getElementById('managePassword'); const pwd = mp ? mp.value : ''; if(pwd) payload.password = pwd; const url = id ? `/api/users/${id}` : '/api/users'; const method = id ? 'PUT' : 'POST'; Swal.fire({title: 'Menyimpan...', didOpen: () => Swal.showLoading()}); try { const res = await window.fetchData(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if(res.ok) { Swal.fire('Sukses', 'Data pengguna berhasil disimpan.', 'success'); window.resetFormUser(); window.loadUsers(); } else { Swal.fire('Gagal', data.message || 'Terjadi kesalahan.', 'error'); } } catch(e) { Swal.fire('Error', 'Gagal menghubungi server.', 'error'); } };
window.hapusUser = async function(id) { if(confirm('Yakin ingin menghapus akun pengguna ini?')) { Swal.fire({title: 'Menghapus...', didOpen: () => Swal.showLoading()}); try { const res = await window.fetchData(`/api/users/${id}`, { method: 'DELETE' }); if(res.ok) { Swal.fire('Terhapus', 'Akun berhasil dihapus.', 'success'); window.loadUsers(); } } catch(e) { Swal.fire('Error', 'Gagal menghapus.', 'error'); } } };