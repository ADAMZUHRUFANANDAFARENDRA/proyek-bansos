/**
 * Modul: admin-sync-db.js
 * Deskripsi: Pencadangan, pemulihan arsip snapshot JSON, dan integrasi MySQL localhost (Sinkronisasi Penuh Dua Arah)
 */

// 22. CADANGKAN & PULIHKAN ARSIP (SINKRON DATA ARSIP MODERN & MEMBULAT)
// =========================================================================
window.muatStatusSinkronArsip = async function () {
    const webEl = document.getElementById('syncStatWebCount');
    const srvEl = document.getElementById('syncStatServerCount');
    const sqlEl = document.getElementById('syncStatMysqlCount');
    const badgeEl = document.getElementById('syncArsipLiveBadge');
    const timeEl = document.getElementById('syncArsipLastTime');

    const localLen = (window.globalDataWarga || []).length;
    if (webEl) webEl.textContent = `${localLen} Warga`;

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/arsip/status`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const st = await res.json();
            const webCnt = st.warga_aktif_web ?? localLen;
            const srvCnt = st.cadangan_server_master ?? 0;
            const sqlCnt = st.mysql_warga_count ?? 0;

            if (webEl) webEl.textContent = `${webCnt} Warga`;
            if (srvEl) srvEl.textContent = `${srvCnt} Warga`;
            if (sqlEl) sqlEl.textContent = st.mysql_connected ? `${sqlCnt} Warga (${st.mysql_database || 'bansos'})` : 'Offline';

            const labelMasterBtn = document.getElementById('labelMasterStandarBtn');
            if (labelMasterBtn && st.master_snapshot_total) {
                labelMasterBtn.textContent = `Pulihkan Data Master Standar Resmi (${st.master_snapshot_total} Warga KPM Sidoarjo)`;
            }

            const isFull = st.mysql_connected && webCnt === sqlCnt && srvCnt === webCnt;
            if (badgeEl) {
                if (isFull) {
                    badgeEl.style.background = '#16a34a';
                    badgeEl.innerHTML = '<i class="fas fa-check-circle"></i> Tersinkronisasi Penuh (Web = Server = MySQL)';
                } else if (st.mysql_connected && webCnt === sqlCnt) {
                    badgeEl.style.background = '#0284c7';
                    badgeEl.innerHTML = '<i class="fas fa-check-circle"></i> Web & MySQL Sinkron';
                } else {
                    badgeEl.style.background = '#d97706';
                    badgeEl.innerHTML = '<i class="fas fa-sync-alt"></i> Siap Disinkronkan';
                }
            }
            if (timeEl) {
                timeEl.textContent = st.last_sync ? `Sinkron terakhir: ${st.last_sync}` : 'Siap disinkronkan';
            }
        }
    } catch (_) {}
};

window.bukaModalSinkronArsip = async function () {
    const modal = document.getElementById('modalSinkronArsip');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
    await window.muatStatusSinkronArsip();
    if (typeof window.muatDaftarSnapshotHistoris === 'function') {
        await window.muatDaftarSnapshotHistoris();
    }
};

window.eksekusiSinkronPenuhArsip = async function () {
    showAdminAlert({
        title: 'Menyinkronkan Penuh Arsip & Database...',
        text: 'Menyelaraskan data Web, Snapshot Server Master, dan Database MySQL Localhost (bansos)...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/arsip/sinkron-penuh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data: window.globalDataWarga || [] })
        });
        const json = await res.json().catch(() => ({}));
        if (Array.isArray(json.data)) {
            window.globalDataWarga = json.data;
        }
        await window.loadDashboardData(false);
        await window.muatStatusSinkronArsip();
        await window.cekStatusKoneksiMysql();
        if (typeof window.muatDataRekapTriwulan === 'function') {
            try { window.muatDataRekapTriwulan(false); } catch (_) {}
        }

        Swal.fire({
            icon: 'success',
            title: 'Sinkronisasi Penuh Berhasil!',
            html: `Seluruh basis data telah tersinkronisasi 100%:<br><br>
                   <b>Data Aktif di Web:</b> ${json.warga_aktif_web ?? (window.globalDataWarga || []).length} warga<br>
                   <b>Cadangan Server Master:</b> ${json.cadangan_server_master ?? (window.globalDataWarga || []).length} warga<br>
                   <b>Database MySQL (bansos):</b> ${json.mysql_warga_count ?? (window.globalDataWarga || []).length} warga`,
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Sinkronisasi Penuh', text: e.message || 'Kendala koneksi ke peladen.' });
    }
};

window.eksekusiCadangkanKeServer = async function () {
    showAdminAlert({
        title: 'Mencadangkan Data ke Server & MySQL...',
        text: 'Mengamankan snapshot seluruh arsip warga aktif ke Server Master & MySQL (warga_backup)...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/arsip/cadangkan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data: window.globalDataWarga || [] })
        });

        if (!res.ok) {
            res = await fetch(`${base}/arsip/cadangkan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: window.globalDataWarga || [] })
            });
        }

        const json = await res.json().catch(() => ({}));

        try {
            localStorage.setItem('cadangan_arsip_lokal_terakhir', JSON.stringify({
                waktu: new Date().toISOString(),
                total: (window.globalDataWarga || []).length,
                data: window.globalDataWarga || []
            }));
        } catch (_) {}

        await window.muatStatusSinkronArsip();
        await window.cekStatusKoneksiMysql();

        Swal.fire({
            icon: 'success',
            title: 'Cadangan Server & MySQL Tersimpan!',
            text: json.message || `Berhasil mengamankan ${(window.globalDataWarga || []).length} data warga ke Server Master dan tabel MySQL bansos.warga_backup.`,
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Mencadangkan', text: e.message || 'Kendala koneksi ke server.' });
    }
};

window.eksekusiUnduhCadanganJson = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Masih Kosong', text: 'Tidak ada data warga untuk dicadangkan saat ini.' });
    }

    try {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        
        const backupPayload = {
            sumber: "Sistem Pendukung Keputusan Bansos Pemkab Sidoarjo",
            versi_sistem: "2.5.0",
            tanggal_arsip: now.toISOString(),
            waktu_format: `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
            total_warga: dataList.length,
            data_warga: dataList,
            kriteria: window.cachedKriteria || []
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `cadangan_arsip_bansos_sidoarjo_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showAdminAlert({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Berkas cadangan JSON (${dataList.length} warga) berhasil diunduh!`,
            showConfirmButton: false,
            timer: 2500
        });
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Gagal Mengunduh', text: err.message });
    }
};

window.eksekusiPulihkanDariServer = async function () {
    showAdminAlert({
        title: 'Memulihkan dari Server Master & MySQL...',
        text: 'Mengembalikan snapshot data kependudukan dan menyinkronkan ke MySQL...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/arsip/pulihkan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            res = await fetch(`${base}/arsip/pulihkan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });
        }

        const json = await res.json().catch(() => ({}));
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            window.globalDataWarga = json.data;
            try {
                localStorage.setItem('cachedDataWarga', JSON.stringify(json.data));
            } catch (_) {}
        }

        await window.loadDashboardData(false);
        await window.muatStatusSinkronArsip();
        await window.cekStatusKoneksiMysql();
        if (typeof window.muatDaftarSnapshotHistoris === 'function') {
            await window.muatDaftarSnapshotHistoris();
        }
        if (typeof window.muatDataRekapTriwulan === 'function') {
            try { window.muatDataRekapTriwulan(false); } catch (_) {}
        }

        Swal.fire({
            icon: 'success',
            title: 'Berhasil Dipulihkan & Disinkronkan!',
            text: json.message || 'Data kependudukan berhasil dikembalikan dari arsip server dan disinkronkan ke MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (e) {
        showAdminAlert({ icon: 'error', title: 'Gagal Memulihkan', text: e.message || 'Kendala saat memulihkan arsip.' });
    }
};

window.eksekusiPulihkanDariFileJson = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();

    showAdminAlert({
        title: 'Membaca Berkas Cadangan...',
        text: `Memvalidasi integritas data dari ${file.name}...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    reader.onload = async function (e) {
        try {
            const content = e.target.result;
            const parsed = JSON.parse(content);
            const restoreList = Array.isArray(parsed) ? parsed : (parsed.data_warga || parsed.data || []);

            if (!restoreList.length) {
                throw new Error('Berkas JSON tidak memuat array data kependudukan yang sah.');
            }

            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/pulihkan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ data: restoreList })
            });

            if (!res.ok) {
                res = await fetch(`${base}/api/warga/bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.getCleanToken()}`
                    },
                    body: JSON.stringify({ data: restoreList, overwrite: true, replace_all: true })
                });
            }

            await window.loadDashboardData(false);
            await window.muatStatusSinkronArsip();
            await window.cekStatusKoneksiMysql();

            Swal.fire({
                icon: 'success',
                title: 'Pemulihan Berkas Berhasil!',
                text: `Sebanyak ${restoreList.length} data warga dari ${file.name} berhasil dipulihkan ke arsip dan disinkronkan ke MySQL.`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        } catch (err) {
            showAdminAlert({
                icon: 'error',
                title: 'Gagal Memulihkan File Cadangan',
                text: err.message || 'Format berkas cadangan JSON tidak valid atau rusak.'
            });
        } finally {
            input.value = '';
        }
    };

    reader.onerror = () => {
        showAdminAlert({ icon: 'error', title: 'Gagal Membaca File', text: 'Tidak dapat membuka berkas cadangan dari perangkat.' });
    };

    reader.readAsText(file);
};

// =========================================================================
// SISTEM PENJELAJAH & PEMULIHAN SNAPSHOT HISTORIS MULTI-PERIODE (±100 TAHUN)
// =========================================================================

function safeSnapshotEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.geserFilterTahun = function (delta) {
    const el = document.getElementById('filterSnapshotTahun');
    if (!el) return;
    let cur = parseInt(el.value, 10);
    if (isNaN(cur)) cur = 2026;
    cur += delta;
    if (cur < 1900) cur = 1900;
    if (cur > 2200) cur = 2200;
    el.value = cur;
    window.muatDaftarSnapshotHistoris();
};

window.resetFilterSnapshot = function () {
    const thnEl = document.getElementById('filterSnapshotTahun');
    const blnEl = document.getElementById('filterSnapshotBulan');
    const mggEl = document.getElementById('filterSnapshotMinggu');
    const katEl = document.getElementById('filterSnapshotKategori');
    if (thnEl) thnEl.value = '2026';
    if (blnEl) blnEl.value = '';
    if (mggEl) mggEl.value = '';
    if (katEl) katEl.value = 'semua';
    window.muatDaftarSnapshotHistoris();
};

window.tampilkanFormSimpanSnapshot = function () {
    const form = document.getElementById('formAccordionSimpanSnapshot');
    if (!form) return;
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
        const tglEl = document.getElementById('inputSnapshotTanggal');
        const lblEl = document.getElementById('inputSnapshotLabel');
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        if (tglEl) tglEl.value = `${yyyy}-${mm}-${dd}`;
        const totalWarga = (window.globalDataWarga || []).length;
        if (lblEl) lblEl.value = `Snapshot Data Arsip ${dd}/${mm}/${yyyy} (${totalWarga} Warga)`;
    } else {
        form.style.display = 'none';
    }
};

window.eksekusiSimpanSnapshotCustom = async function () {
    const lblEl = document.getElementById('inputSnapshotLabel');
    const tglEl = document.getElementById('inputSnapshotTanggal');
    const katEl = document.getElementById('inputSnapshotKategori');
    const mstrEl = document.getElementById('checkSnapshotJadikanMaster');

    const label = (lblEl?.value || '').trim() || `Snapshot Mandiri ${new Date().toLocaleDateString('id-ID')}`;
    const tanggal = tglEl?.value || new Date().toISOString().split('T')[0];
    const kategori = katEl?.value || 'manual';
    const isMaster = !!mstrEl?.checked;

    const dataList = window.globalDataWarga || [];
    if (!dataList.length) {
        return showAdminAlert({
            icon: 'warning',
            title: 'Data Masih Kosong',
            text: 'Tidak ada data warga di sistem yang dapat dijadikan snapshot cadangan.'
        });
    }

    showAdminAlert({
        title: 'Menyimpan Snapshot Baru...',
        text: `Menyimpan ${dataList.length} data warga ke arsip historis periode ${tanggal}...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/arsip/snapshots/simpan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                label,
                tanggal,
                kategori,
                is_master_standard: isMaster,
                data: dataList
            })
        });

        const json = await res.json().catch(() => ({}));
        if (res.ok && json.status === 'success') {
            const form = document.getElementById('formAccordionSimpanSnapshot');
            if (form) form.style.display = 'none';

            await window.muatDaftarSnapshotHistoris();
            await window.muatStatusSinkronArsip();
            await window.cekStatusKoneksiMysql();

            Swal.fire({
                icon: 'success',
                title: 'Snapshot Berhasil Disimpan!',
                html: `Snapshot <b>${safeSnapshotEscape(label)}</b> (${json.snapshot?.total_warga ?? dataList.length} warga) berhasil dicatat ke disk & MySQL.<br><br>
                       <b>Tahun:</b> ${json.snapshot?.tahun} &bull; <b>Bulan:</b> ${json.snapshot?.nama_bulan || json.snapshot?.bulan} &bull; <b>Minggu:</b> ${json.snapshot?.minggu_ke} &bull; <b>Hari:</b> ${json.snapshot?.hari}`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        } else {
            throw new Error(json.message || 'Gagal menyimpan snapshot ke server.');
        }
    } catch (err) {
        showAdminAlert({ icon: 'error', title: 'Gagal Menyimpan Snapshot', text: err.message });
    }
};

window.muatDaftarSnapshotHistoris = async function () {
    const container = document.getElementById('containerDaftarSnapshotHistoris');
    if (!container) return;

    const thnVal = document.getElementById('filterSnapshotTahun')?.value || '';
    const blnVal = document.getElementById('filterSnapshotBulan')?.value || '';
    const mggVal = document.getElementById('filterSnapshotMinggu')?.value || '';
    const katVal = document.getElementById('filterSnapshotKategori')?.value || '';

    const params = new URLSearchParams();
    if (thnVal) params.append('tahun', thnVal);
    if (blnVal) params.append('bulan', blnVal);
    if (mggVal) params.append('minggu_ke', mggVal);
    if (katVal && katVal !== 'semua') params.append('kategori', katVal);

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/arsip/snapshots?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });

        if (!res.ok) throw new Error('Gagal mengambil daftar snapshot dari peladen.');
        const json = await res.json();
        const list = json.snapshots || [];

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:22px 14px; background:#ffffff; border:1px dashed #cbd5e1; border-radius:14px; color:#64748b;">
                    <i class="fas fa-folder-open" style="font-size:1.8rem; color:#94a3b8; margin-bottom:8px;"></i>
                    <div style="font-weight:700; font-size:0.86rem; color:#334155;">Belum ada snapshot arsip pada filter periode ini (Tahun ${thnVal || 'Semua'}).</div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">Gunakan tombol "Simpan Snapshot Waktu Baru" untuk menyimpan checkpoint data hari ini ke tahun/tanggal ini, atau klik Reset untuk melihat seluruh arsip.</div>
                    <button type="button" onclick="window.resetFilterSnapshot()" class="btn btn-sm" style="margin-top:10px; background:#f1f5f9; border:1px solid #cbd5e1; font-weight:700; border-radius:8px;">
                        <i class="fas fa-undo"></i> Tampilkan Semua Periode
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        list.forEach(s => {
            const isMaster = !!s.is_master_standard;
            const borderCol = isMaster ? '#86efac' : '#bae6fd';
            const bgCol = isMaster ? '#f0fdf4' : '#ffffff';
            const badgeBg = isMaster ? '#16a34a' : (s.kategori === 'tahunan' ? '#9333ea' : (s.kategori === 'bulanan' ? '#0284c7' : '#0d9488'));
            const katLabel = isMaster ? '★ MASTER RESMI' : (s.kategori ? s.kategori.toUpperCase() : 'ARSIP');

            html += `
                <div style="background:${bgCol}; border:1.5px solid ${borderCol}; border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; transition:all 0.15s ease;">
                    <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:240px;">
                        <div style="width:38px; height:38px; border-radius:10px; background:${isMaster ? '#dcfce7' : '#e0f2fe'}; color:${isMaster ? '#15803d' : '#0284c7'}; display:flex; align-items:center; justify-content:center; font-size:1.15rem; flex-shrink:0;">
                            <i class="fas ${isMaster ? 'fa-award' : 'fa-history'}"></i>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-weight:800; font-size:0.88rem; color:#0f172a;">${safeSnapshotEscape(s.label || s.snapshot_id)}</span>
                                <span class="badge" style="background:${badgeBg}; color:#ffffff; font-weight:800; font-size:0.68rem; padding:2px 6px; border-radius:6px;">${katLabel}</span>
                                <span style="font-size:0.75rem; font-weight:800; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:12px;">${s.total_warga} Warga</span>
                            </div>
                            <div style="font-size:0.74rem; color:#64748b; margin-top:2px;">
                                <i class="fas fa-calendar-day"></i> <b>${s.hari || '-'}</b>, ${s.tanggal || '-'} &bull; Minggu ke-${s.minggu_ke || '-'} &bull; Bulan ${s.nama_bulan || s.bulan} ${s.tahun}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <button type="button" onclick="window.pulihkanSnapshotHistoris('${s.snapshot_id}', false)" class="btn btn-sm" style="background:#0284c7; color:#ffffff; font-weight:700; font-size:0.75rem; border-radius:8px; padding:5px 10px;" title="Gantikan data aktif saat ini dengan data dari snapshot ini">
                            <i class="fas fa-undo"></i> Pulihkan
                        </button>
                        <button type="button" onclick="window.pulihkanSnapshotHistoris('${s.snapshot_id}', true)" class="btn btn-sm" style="background:#059669; color:#ffffff; font-weight:700; font-size:0.75rem; border-radius:8px; padding:5px 10px;" title="Gabungkan snapshot ini ke data aktif tanpa menimpa data yang ada">
                            <i class="fas fa-plus-circle"></i> + Gabung
                        </button>
                        ${!isMaster ? `
                            <button type="button" onclick="window.tetapkanSnapshotSebagaiMaster('${s.snapshot_id}')" class="btn btn-sm" style="background:#ffffff; border:1px solid #16a34a; color:#16a34a; font-weight:700; font-size:0.75rem; border-radius:8px; padding:5px 8px;" title="Jadikan snapshot ini sebagai Master Standar Resmi">
                                <i class="fas fa-star"></i> Jadikan Master
                            </button>
                            <button type="button" onclick="window.hapusSnapshotHistoris('${s.snapshot_id}')" class="btn btn-sm" style="background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; font-weight:700; font-size:0.75rem; border-radius:8px; padding:5px 8px;" title="Hapus snapshot ini">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : `
                            <span style="font-size:0.72rem; font-weight:800; color:#15803d; background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:4px 8px;">
                                <i class="fas fa-check-circle"></i> Master Aktif
                            </span>
                        `}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `
            <div style="text-align:center; padding:14px; color:#dc2626; font-size:0.82rem;">
                <i class="fas fa-exclamation-triangle"></i> Gagal memuat snapshot historis: ${err.message}
            </div>
        `;
    }
};

window.pulihkanSnapshotHistoris = async function (snapshotId, isMerge) {
    const aksiText = isMerge ? 'Gabungkan (Merge)' : 'Pulihkan Penuh (Timpa)';
    const descText = isMerge
        ? 'Data warga dari snapshot ini akan digabungkan ke data aktif Anda. Data dengan NIK yang sama akan diperbarui, data baru akan ditambahkan.'
        : 'Data warga aktif saat ini akan digantikan seluruhnya dengan data warga dari snapshot yang dipilih.';

    const k = await Swal.fire({
        title: `${aksiText} Snapshot?`,
        text: descText,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Ya, ${aksiText}`,
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: `Memproses ${aksiText}...`,
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/arsip/snapshots/pulihkan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ snapshot_id: snapshotId, merge: !!isMerge })
            });

            const json = await res.json().catch(() => ({}));
            if (res.ok && json.status === 'success') {
                if (Array.isArray(json.data) && json.data.length > 0) {
                    window.globalDataWarga = json.data;
                    try {
                        localStorage.setItem('cachedDataWarga', JSON.stringify(json.data));
                    } catch (_) {}
                }
                await window.loadDashboardData(false);
                await window.muatStatusSinkronArsip();
                await window.cekStatusKoneksiMysql();
                if (typeof window.muatDaftarSnapshotHistoris === 'function') {
                    await window.muatDaftarSnapshotHistoris();
                }
                if (typeof window.muatDataRekapTriwulan === 'function') {
                    try { window.muatDataRekapTriwulan(false); } catch (_) {}
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Snapshot Berhasil Dipulihkan!',
                    text: json.message || `Sebanyak ${json.total ?? (window.globalDataWarga || []).length} data warga berhasil dipulihkan & disinkronkan ke Web dan MySQL.`,
                    buttonsStyling: false,
                    confirmButtonText: 'Oke, Mengerti',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal memulihkan snapshot.');
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Memulihkan', text: err.message });
        }
    }
};

window.pulihkanSemuaDataSerentak = async function () {
    const k = await Swal.fire({
        title: 'Pulihkan Seluruh Data Secara Serentak?',
        html: `Sistem akan menggabungkan <b>seluruh data warga dari semua snapshot historis lintas tahun, bulan, minggu, dan hari</b> menjadi satu dataset lengkap terpadu.<br><br>
               <span style="font-size:0.82rem; color:#15803d; font-weight:700;"><i class="fas fa-shield-alt"></i> Aman: Tidak ada data yang hilang. Seluruh KPM dari setiap periode akan disatukan ke Web dan MySQL.</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Pulihkan Semua Serentak',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Memulihkan Seluruh Data Lintas Waktu...',
            text: 'Mengonsolidasikan data dari seluruh snapshot historis secara serentak...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/arsip/snapshots/pulihkan-semua`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            const json = await res.json().catch(() => ({}));
            if (res.ok && json.success) {
                if (Array.isArray(json.data)) {
                    window.globalDataWarga = json.data;
                }
                await window.loadDashboardData(false);
                await window.muatStatusSinkronArsip();
                await window.cekStatusKoneksiMysql();
                if (typeof window.muatDataRekapTriwulan === 'function') {
                    try { window.muatDataRekapTriwulan(false); } catch (_) {}
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Pemulihan Serentak Berhasil!',
                    html: `Berhasil menyatukan seluruh <b>${json.total ?? (window.globalDataWarga || []).length} data warga unik</b> dari <b>${json.total_snapshots ?? 'seluruh'} snapshot historis</b> ke arsip aktif Web dan MySQL!`,
                    buttonsStyling: false,
                    confirmButtonText: 'Oke, Luar Biasa',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal memulihkan seluruh data serentak.');
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Pemulihan Serentak', text: err.message });
        }
    }
};

window.tetapkanSnapshotSebagaiMaster = async function (snapshotId) {
    const k = await Swal.fire({
        title: 'Jadikan Sebagai Master Standar?',
        text: 'Snapshot ini akan ditetapkan sebagai "Data Master Standar Resmi Sidoarjo". Saat mereset master di masa depan, dataset inilah yang akan dipulihkan.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tetapkan Master',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/arsip/snapshots/tetapkan-master`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ snapshot_id: snapshotId })
            });

            const json = await res.json().catch(() => ({}));
            if (res.ok && json.status === 'success') {
                await window.muatDaftarSnapshotHistoris();
                await window.muatStatusSinkronArsip();
                Swal.fire({
                    icon: 'success',
                    title: 'Master Standar Diperbarui!',
                    text: json.message || 'Snapshot ini telah resmi dijadikan Data Master Standar.',
                    buttonsStyling: false,
                    confirmButtonText: 'Oke',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal menetapkan master standar.');
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.hapusSnapshotHistoris = async function (snapshotId) {
    const k = await Swal.fire({
        title: 'Hapus Snapshot Ini?',
        text: 'Snapshot historis ini akan dihapus permanen dari daftar arsip (snapshot master standar terlindungi).',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/arsip/snapshots/${snapshotId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
            });

            const json = await res.json().catch(() => ({}));
            if (res.ok && json.status === 'success') {
                await window.muatDaftarSnapshotHistoris();
                showAdminAlert({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Snapshot berhasil dihapus',
                    showConfirmButton: false,
                    timer: 2000
                });
            } else {
                throw new Error(json.message || 'Gagal menghapus snapshot.');
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Menghapus', text: err.message });
        }
    }
};

window.muatTemplateBinaanContoh = async function () {
    const k = await Swal.fire({
        title: 'Muat Template Demo (12 Warga Binaan)?',
        html: `Sistem akan memuat 12 data contoh warga binaan untuk keperluan uji coba awal fitur.<br><br>
               <span style="font-size:0.82rem; color:#15803d; font-weight:700;"><i class="fas fa-shield-alt"></i> Cadangan Server Master Anda (100 Warga) TETAP AMAN dan TIDAK AKAN HAPUS.</span>`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Ya, Muat Contoh Demo',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Memuat Template Demo...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const res = await fetch(`${base}/api/arsip/template-binaan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            const json = await res.json().catch(() => ({}));
            if (res.ok && json.data) {
                window.globalDataWarga = json.data;
                await window.loadDashboardData(false);
                await window.muatStatusSinkronArsip();
                await window.cekStatusKoneksiMysql();

                Swal.fire({
                    icon: 'success',
                    title: 'Template Demo Dimuat!',
                    text: json.message || '12 data warga contoh berhasil dimuat ke web. Cadangan server master Anda tetap aman.',
                    buttonsStyling: false,
                    confirmButtonText: 'Oke',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal memuat template demo.');
            }
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal', text: err.message });
        }
    }
};

window.eksekusiResetMasterWarga = async function () {
    const k = await Swal.fire({
        title: 'Pulihkan Data Master Standar Resmi?',
        html: `Sistem akan memulihkan <b>Data Master Standar Resmi (100 Warga KPM Kabupaten Sidoarjo)</b> yang terdistribusi lengkap di 10 Desil dan menyinkronkannya secara penuh ke Web dan database MySQL.<br><br>
               <span style="font-size:0.82rem; color:#15803d; font-weight:700;"><i class="fas fa-check-circle"></i> Ini akan mengembalikan 100 data KPM benchmark resmi Sidoarjo, bukan hanya 12 data contoh.</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Pulihkan Master 100 Warga',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Memulihkan Data Master Standar Resmi...',
            text: 'Mengembalikan 100 data KPM master resmi ke memori peladen & database MySQL...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/reset-master`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/arsip/reset-master`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            const json = await res.json().catch(() => ({}));
            if (Array.isArray(json.data)) {
                window.globalDataWarga = json.data;
            }
            await window.loadDashboardData(false);
            await window.muatStatusSinkronArsip();
            await window.cekStatusKoneksiMysql();
            if (typeof window.muatDaftarSnapshotHistoris === 'function') {
                await window.muatDaftarSnapshotHistoris();
            }
            if (typeof window.muatDataRekapTriwulan === 'function') {
                try { window.muatDataRekapTriwulan(false); } catch (_) {}
            }

            Swal.fire({
                icon: 'success',
                title: 'Data Master Standar 100 Warga Aktif!',
                text: json.message || 'Dataset Master Resmi (100 Warga KPM Sidoarjo) berhasil dipulihkan dan disinkronkan ke Web dan MySQL Localhost.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        } catch (err) {
            showAdminAlert({ icon: 'error', title: 'Gagal Reset', text: err.message || 'Kendala saat mereset data.' });
        }
    }
};

window.eksekusiCadangkanArsip = () => window.eksekusiCadangkanKeServer();
window.eksekusiPulihkanArsip = () => window.eksekusiPulihkanDariServer();

// =========================================================================
// PENGHAPUSAN DATA ARSIP DARI MODAL SINKRONISASI (MODERN & MEMBULAT)
// =========================================================================
window.eksekusiHapusSemuaArsipDariModalSync = async function () {
    const k = await Swal.fire({
        title: 'Kosongkan Seluruh Data Arsip?',
        text: 'Seluruh data warga kependudukan di Web dan tabel MySQL (bansos.warga) akan dikosongkan (snapshot cadangan tetap aman).',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Semua Arsip',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Menghapus Seluruh Arsip...',
            text: 'Membersihkan data dari memori peladen & database MySQL...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/warga/delete-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/warga/delete-all`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            window.globalDataWarga = [];
            window.cachedWarga = [];
            localStorage.removeItem('bansos_warga_cache');
            localStorage.removeItem('bansos_data_warga');
            localStorage.removeItem('cachedDataWarga');
            if (typeof window.sembunyikanHasilSPK === 'function') {
                window.sembunyikanHasilSPK();
            }

            if (window.$ && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable('#dataTable')) {
                $('#dataTable').DataTable().clear().draw();
            } else {
                const tbody = document.querySelector('#dataTable tbody');
                if (tbody) tbody.innerHTML = '';
            }

            if (window.clusterWargaGroup && typeof window.clusterWargaGroup.clearLayers === 'function') {
                window.clusterWargaGroup.clearLayers();
            }

            if (typeof window.updateStatsAndCards === 'function') {
                window.updateStatsAndCards(0, 0, 0, 0, false);
            }

            if (typeof window.render3DashboardCharts === 'function') {
                try { window.render3DashboardCharts([]); } catch (_) {}
            }

            await new Promise(r => setTimeout(r, 150));
            await window.muatStatusSinkronArsip();
            await window.cekStatusKoneksiMysql();

            Swal.fire({
                icon: 'success',
                title: 'Data Arsip Telah Dihapus!',
                text: 'Seluruh arsip data kependudukan di Web dan tabel MySQL (bansos.warga) telah dikosongkan.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus Arsip',
                text: err.message || 'Terjadi gangguan saat mengosongkan arsip data warga.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

window.eksekusiHapusCadanganServer = async function () {
    const k = await Swal.fire({
        title: 'Hapus Snapshot Cadangan Server?',
        text: 'Berkas cadangan riwayat snapshot di peladen dan tabel MySQL (bansos.warga_backup) akan dibersihkan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Snapshot',
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-danger', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        showAdminAlert({
            title: 'Menghapus Snapshot...',
            customClass: { popup: 'swal-modern-rounded' },
            didOpen: () => Swal?.showLoading()
        });

        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            let res = await fetch(`${base}/api/arsip/cadangan`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                res = await fetch(`${base}/api/arsip/hapus-cadangan`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
                });
            }

            try { localStorage.removeItem('cadangan_arsip_lokal_terakhir'); } catch (_) {}
            await window.muatStatusSinkronArsip();
            await window.cekStatusKoneksiMysql();

            Swal.fire({
                icon: 'success',
                title: 'Snapshot Arsip Berhasil Dihapus',
                text: 'Seluruh berkas cadangan snapshot di Server Master dan tabel MySQL (bansos.warga_backup) telah dibersihkan.',
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus Snapshot',
                text: err.message || 'Kendala koneksi ke server saat membersihkan cadangan.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    }
};

// =========================================================================
// PENYIMPANAN BASIS DATA MYSQL LOCALHOST (INTEGRASI PENUH SELURUH SISTEM)
// =========================================================================
window.bukaModalSettingMysql = async function () {
    const modal = document.getElementById('modalSettingMysql');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/config`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const json = await res.json();
            const cfg = json.config || {};
            if (document.getElementById('mysqlHost')) document.getElementById('mysqlHost').value = cfg.host || 'localhost';
            if (document.getElementById('mysqlPort')) document.getElementById('mysqlPort').value = cfg.port || 3306;
            if (document.getElementById('mysqlUser')) document.getElementById('mysqlUser').value = cfg.user || 'root';
            const pwEl = document.getElementById('mysqlPassword');
            if (pwEl) {
                pwEl.value = '';
                pwEl.placeholder = json.hasPassword
                    ? '(Password tersimpan aman di server • Kosongkan jika tidak diubah)'
                    : '(Kosongkan jika default XAMPP)';
            }
            if (document.getElementById('mysqlDatabase')) document.getElementById('mysqlDatabase').value = cfg.database || 'bansos';
            const enabledVal = cfg.enabled !== false;
            if (document.getElementById('mysqlEnableToggle')) document.getElementById('mysqlEnableToggle').checked = enabledVal;
            
            const track = document.getElementById('mysqlToggleTrack');
            if (track) track.style.background = enabledVal ? '#16a34a' : '#cbd5e1';
        }
    } catch (_) {}

    await window.cekStatusKoneksiMysql();
};

window.cekStatusKoneksiMysql = async function () {
    const statusText = document.getElementById('mysqlConnectionStatusText');
    const badge = document.getElementById('mysqlConnectionBadge');
    const wargaCntEl = document.getElementById('mysqlWargaRowCount');
    const backupCntEl = document.getElementById('mysqlBackupRowCount');
    const lastSyncEl = document.getElementById('mysqlLastSyncLabel');

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/status`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const data = await res.json();
            const connObj = data.connection || {};
            const isConnected = Boolean(data.connected || connObj.connected || connObj.success);
            const dbName = data.database || connObj.database || data.config?.database || 'bansos';
            const ver = data.version || connObj.version || 'MySQL';
            const wCount = data.mysqlWargaCount ?? connObj.mysqlWargaCount ?? 0;
            const bCount = data.mysqlBackupCount ?? connObj.mysqlBackupCount ?? 0;

            if (wargaCntEl) wargaCntEl.textContent = String(wCount);
            if (backupCntEl) backupCntEl.textContent = String(bCount);
            if (lastSyncEl) lastSyncEl.textContent = data.last_sync || connObj.last_sync || 'Tersinkron Otomatis';

            if (isConnected) {
                if (statusText) {
                    statusText.innerHTML = `<span style="color:#15803d;"><i class="fas fa-check-circle"></i> Terhubung ke MySQL Localhost (${window.safeHtml(ver)}) &bull; DB: <b>${window.safeHtml(dbName)}</b> (${wCount} Warga Tersinkron)</span>`;
                }
                if (badge) {
                    badge.className = 'mysql-status-badge connected';
                    badge.style.background = '#dcfce7';
                    badge.style.color = '#15803d';
                    badge.style.border = '1px solid #86efac';
                    badge.innerHTML = '<i class="fas fa-link"></i> Terhubung & Sinkron';
                }
                return true;
            } else {
                if (statusText) {
                    statusText.innerHTML = `<span style="color:#64748b;"><i class="fas fa-info-circle"></i> Belum Terhubung: ${window.safeHtml(data.message || connObj.message || 'Siap dikonfigurasikan')}</span>`;
                }
                if (badge) {
                    badge.className = 'mysql-status-badge disconnected';
                    badge.innerHTML = '<i class="fas fa-unlink"></i> Standby';
                }
                return false;
            }
        }
    } catch (_) {
        if (statusText) statusText.innerText = 'Server proxy lokal aktif (Gunakan tombol Uji Koneksi)';
    }
    return false;
};

window.simpanConfigMysql = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const host = document.getElementById('mysqlHost')?.value.trim() || 'localhost';
    const port = parseInt(document.getElementById('mysqlPort')?.value) || 3306;
    const user = document.getElementById('mysqlUser')?.value.trim() || 'root';
    const password = document.getElementById('mysqlPassword')?.value || '';
    const database = document.getElementById('mysqlDatabase')?.value.trim() || 'bansos';
    const enabled = document.getElementById('mysqlEnableToggle')?.checked !== false;

    const payload = { host, port, user, password, database, enabled, auto_sync: enabled };

    showAdminAlert({
        title: 'Menyimpan & Menyinkronkan ke MySQL...',
        text: `Menyimpan konfigurasi dan menyinkronkan data ke database '${database}'...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => ({}));
        await window.cekStatusKoneksiMysql();
        await window.muatStatusSinkronArsip();

        const noticeEl = document.getElementById('mysqlConfigSaveNotice');
        if (noticeEl) {
            noticeEl.innerHTML = `<i class="fas fa-check-circle"></i> Tersinkron ke DB <b>${window.safeHtml(database)}</b> (${json.mysqlWargaCount ?? (window.globalDataWarga || []).length} warga)`;
        }

        Swal.fire({
            icon: 'success',
            title: 'Konfigurasi & Sinkronisasi Berhasil!',
            html: `${json.message || 'Pengaturan koneksi MySQL localhost berhasil disimpan.'}<br><br>
                   <b>Database Aktif:</b> ${window.safeHtml(database)}<br>
                   <b>Data Warga di MySQL:</b> ${json.mysqlWargaCount ?? (window.globalDataWarga || []).length} baris<br>
                   <b>Data Cadangan (warga_backup):</b> ${json.mysqlBackupCount ?? (window.globalDataWarga || []).length} baris`,
            buttonsStyling: false,
            confirmButtonText: 'Oke, Mengerti',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: err.message || 'Kendala saat menyimpan konfigurasi MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.ujiKoneksiMysql = async function () {
    const host = document.getElementById('mysqlHost')?.value.trim() || 'localhost';
    const port = parseInt(document.getElementById('mysqlPort')?.value) || 3306;
    const user = document.getElementById('mysqlUser')?.value.trim() || 'root';
    const password = document.getElementById('mysqlPassword')?.value || '';
    const database = document.getElementById('mysqlDatabase')?.value.trim() || 'bansos';

    showAdminAlert({
        title: 'Menguji Koneksi MySQL Localhost...',
        text: `Menghubungkan ke ${host}:${port} (${user})...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ host, port, user, password, database })
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.cekStatusKoneksiMysql();
            Swal.fire({
                icon: 'success',
                title: 'Koneksi MySQL Sukses!',
                html: `Berhasil terhubung ke server MySQL Localhost.<br><br>
                       <b>Versi:</b> ${json.version || 'MySQL'}<br>
                       <b>Database '${database}':</b> ${json.databaseExists ? `<span style="color:#15803d;">Tersedia (${json.mysqlWargaCount ?? 0} warga)</span>` : '<span style="color:#d97706;">Siap Dibuat</span>'}`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Koneksi Belum Terhubung',
                text: json.message || 'Pastikan MySQL (XAMPP / Laragon / MySQL Service) telah berjalan di komputer Anda.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menguji Koneksi',
            text: err.message || 'Kendala koneksi ke server lokal.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.migrasiTabelMysql = async function () {
    const database = document.getElementById('mysqlDatabase')?.value.trim() || 'bansos';
    showAdminAlert({
        title: 'Membuat Database & Tabel...',
        text: `Menginisialisasi skema tabel kependudukan, kriteria SPK, dan cadangan di MySQL (${database})...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/migrate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ database })
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.cekStatusKoneksiMysql();
            Swal.fire({
                icon: 'success',
                title: 'Tabel MySQL Siap!',
                html: `${json.message || 'Struktur tabel berhasil dibuat.'}<br><br><b>Tabel Terdaftar:</b> ${(json.tables || []).join(', ')}`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Membuat Tabel',
                text: json.message || 'Pastikan kredensial user MySQL memiliki izin CREATE TABLE.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Migrasi',
            text: err.message || 'Terjadi kesalahan komunikasi dengan server MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.simpanKeMysql = async function () {
    const dataList = window.globalDataWarga || [];
    showAdminAlert({
        title: 'Menyimpan Data ke MySQL...',
        text: `Menyinkronkan ${dataList.length} data warga kependudukan ke database localhost...`,
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/sync-to-mysql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data: dataList })
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            await window.cekStatusKoneksiMysql();
            await window.muatStatusSinkronArsip();
            Swal.fire({
                icon: 'success',
                title: 'Data Tersimpan di MySQL Localhost!',
                html: `Seluruh data sistem berhasil disimpan & disinkronkan ke basis data MySQL Anda:<br><br>
                       <b>Data Warga Aktif (warga):</b> ${json.syncedWarga ?? dataList.length} baris<br>
                       <b>Data Cadangan (warga_backup):</b> ${json.syncedBackup ?? dataList.length} baris<br>
                       <b>Kriteria SPK:</b> ${json.syncedKriteria || 10} kriteria`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Gagal Menyimpan ke MySQL',
                text: json.message || 'Pastikan MySQL terhubung dan Anda telah menjalankan tombol "Buat Database & Tabel".',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Ekspor MySQL',
            text: err.message || 'Tidak dapat mengirimkan data ke database MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.muatDariMysql = async function () {
    showAdminAlert({
        title: 'Memuat Data dari MySQL...',
        text: 'Mengambil data kependudukan dari database MySQL localhost...',
        customClass: { popup: 'swal-modern-rounded' },
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/mysql/sync-from-mysql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            }
        });

        const json = await res.json().catch(() => ({}));

        if (json.success) {
            if (Array.isArray(json.data)) {
                window.globalDataWarga = json.data;
            }
            await window.loadDashboardData(false);
            await window.cekStatusKoneksiMysql();
            await window.muatStatusSinkronArsip();
            if (typeof window.muatDataRekapTriwulan === 'function') {
                try { window.muatDataRekapTriwulan(false); } catch (_) {}
            }
            Swal.fire({
                icon: 'success',
                title: 'Data Berhasil Dimuat dari MySQL!',
                text: `Sebanyak ${json.count || 0} data arsip warga dari database MySQL berhasil dimuat ke sistem.`,
                buttonsStyling: false,
                confirmButtonText: 'Oke, Mengerti',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Gagal Memuat dari MySQL',
                text: json.message || 'Database MySQL belum memiliki data warga atau belum terhubung.',
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Kendala Impor MySQL',
            text: err.message || 'Tidak dapat mengambil data dari database MySQL.',
            buttonsStyling: false,
            confirmButtonText: 'Oke',
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
        });
    }
};

window.unduhXamppBridgePhp = function () {
    const a = document.createElement('a');
    a.href = '/api/mysql/bridge-script';
    a.download = 'bridge_sync.php';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    Swal.fire({
        icon: 'success',
        title: 'Skrip Jembatan XAMPP Diunduh!',
        html: `
            <div style="font-size:0.86rem; line-height:1.6; text-align:left; color:#1e293b;">
                Berkas <b>bridge_sync.php</b> telah diunduh.<br><br>
                <b>Panduan 3 Langkah Mudah Menghubungkan ke XAMPP Localhost:</b><br>
                1. Salin berkas <code>bridge_sync.php</code> ke folder <code>C:\\xampp\\htdocs\\bansos\\</code>.<br>
                2. Buka XAMPP Control Panel, pastikan <b>Apache</b> dan <b>MySQL</b> statusnya hijau (Running).<br>
                3. Buka browser: <a href="http://localhost/bansos/bridge_sync.php" target="_blank" style="color:#0284c7; font-weight:700;">http://localhost/bansos/bridge_sync.php</a> untuk melihat status sinkronisasi.<br><br>
                <i>Atau cukup unduh file <b>.SQL Lengkap</b> dan impor ke phpMyAdmin dengan 1 klik!</i>
            </div>
        `,
        confirmButtonText: 'Oke, Sangat Mengerti',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-oke' }
    });
};

// =========================================================================
