/**
 * Modul: admin-panggilan-sk-spk.js
 * Deskripsi: Manajemen Riwayat Log Panggilan Aparatur & Warga, Publikasi Metrik Perhitungan SPK, dan SK Bupati Resmi
 */

// =========================================================================
// 1. RIWAYAT LOG PANGGILAN RESMI (SUARA & VIDEO WEBRTC)
// =========================================================================

window.bukaModalLogPanggilan = async function () {
    const modal = document.getElementById('modalLogPanggilan');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
    await window.muatDaftarLogPanggilan();
};

window.currentLogPanggilanFilter = 'semua';

window.setFilterLogPanggilan = function (fil, btn) {
    window.currentLogPanggilanFilter = fil;
    document.querySelectorAll('.btn-filter-call-log').forEach(b => {
        b.style.background = '#ffffff';
        b.style.color = '#475569';
        b.style.borderColor = '#cbd5e1';
    });
    if (btn) {
        btn.style.background = '#0284c7';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#0284c7';
    }
    window.muatDaftarLogPanggilan();
};

window.muatDaftarLogPanggilan = async function () {
    const container = document.getElementById('containerDaftarLogPanggilan');
    const statTotalEl = document.getElementById('statCallTotalCount');
    const statAudioEl = document.getElementById('statCallAudioCount');
    const statVideoEl = document.getElementById('statCallVideoCount');
    const statDurasiEl = document.getElementById('statCallDurasiAvg');

    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding:32px; color:#64748b;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:1.8rem; color:#0284c7;"></i>
            <div style="margin-top:10px; font-weight:700; font-size:0.88rem;">Memuat riwayat log panggilan resmi...</div>
        </div>
    `;

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/panggilan/logs`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });

        if (!res.ok) throw new Error('Gagal mengambil data log panggilan dari server.');
        const json = await res.json();
        const rawList = json.data || [];

        // Hitung statistik
        const total = rawList.length;
        const totalAudio = rawList.filter(c => c.tipe_panggilan === 'audio').length;
        const totalVideo = rawList.filter(c => c.tipe_panggilan === 'video').length;
        const totalSecs = rawList.reduce((acc, c) => acc + (Number(c.durasi_detik) || 0), 0);
        const avgSecs = total > 0 ? Math.round(totalSecs / total) : 0;

        if (statTotalEl) statTotalEl.textContent = `${total} Panggilan`;
        if (statAudioEl) statAudioEl.textContent = `${totalAudio} Panggilan`;
        if (statVideoEl) statVideoEl.textContent = `${totalVideo} Panggilan`;
        if (statDurasiEl) statDurasiEl.textContent = `${Math.floor(avgSecs / 60)}m ${avgSecs % 60}s`;

        // Filter list
        const fil = window.currentLogPanggilanFilter;
        const searchKeyword = (document.getElementById('inputCariLogPanggilan')?.value || '').toLowerCase().trim();

        let filtered = rawList;
        if (fil === 'warga') {
            filtered = filtered.filter(c => c.caller_role === 'warga' || c.callee_role === 'warga');
        } else if (fil === 'petugas') {
            filtered = filtered.filter(c => c.caller_role === 'petugas' || c.callee_role === 'petugas');
        } else if (fil === 'admin') {
            filtered = filtered.filter(c => c.caller_role === 'admin' || c.callee_role === 'admin' || c.caller_role === 'superadmin' || c.callee_role === 'superadmin');
        } else if (fil === 'audio') {
            filtered = filtered.filter(c => c.tipe_panggilan === 'audio');
        } else if (fil === 'video') {
            filtered = filtered.filter(c => c.tipe_panggilan === 'video');
        }

        if (searchKeyword) {
            filtered = filtered.filter(c =>
                String(c.caller_name || '').toLowerCase().includes(searchKeyword) ||
                String(c.callee_name || '').toLowerCase().includes(searchKeyword) ||
                String(c.nik_warga || '').toLowerCase().includes(searchKeyword) ||
                String(c.catatan || '').toLowerCase().includes(searchKeyword)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:36px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:16px; color:#64748b;">
                    <i class="fas fa-phone-slash" style="font-size:2rem; color:#94a3b8; margin-bottom:10px;"></i>
                    <div style="font-weight:700; font-size:0.9rem; color:#334155;">Tidak ada riwayat panggilan yang sesuai dengan filter.</div>
                    <div style="font-size:0.78rem; margin-top:4px;">Seluruh panggilan telepon dan video call yang berlangsung via WebRTC otomatis tercatat dan tersimpan ke database MySQL.</div>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(c => {
            const isVideo = c.tipe_panggilan === 'video';
            const iconCall = isVideo ? 'fa-video' : 'fa-phone-alt';
            const iconBg = isVideo ? '#f3e8ff' : '#e0f2fe';
            const iconCol = isVideo ? '#7e22ce' : '#0284c7';

            const durMin = Math.floor((Number(c.durasi_detik) || 0) / 60);
            const durSec = (Number(c.durasi_detik) || 0) % 60;
            const durStr = durMin > 0 ? `${durMin}m ${durSec}s` : `${durSec} detik`;

            const statusBg = c.status === 'selesai' ? '#dcfce7' : (c.status === 'ditolak' ? '#fee2e2' : '#fef3c7');
            const statusCol = c.status === 'selesai' ? '#15803d' : (c.status === 'ditolak' ? '#b91c1c' : '#b45309');
            const statusLabel = c.status === 'selesai' ? 'Selesai Terhubung' : (c.status === 'ditolak' ? 'Panggilan Ditolak' : 'Tidak Terjawab');

            html += `
                <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:16px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; transition:all 0.15s ease; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                    <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:280px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:${iconBg}; color:${iconCol}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                            <i class="fas ${iconCall}"></i>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-weight:800; font-size:0.92rem; color:#0f172a;">${c.caller_name || 'Pemanggil'}</span>
                                <span style="font-size:0.7rem; font-weight:800; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:6px; text-transform:uppercase;">${c.caller_role}</span>
                                <i class="fas fa-arrow-right" style="font-size:0.75rem; color:#94a3b8;"></i>
                                <span style="font-weight:800; font-size:0.92rem; color:#0f172a;">${c.callee_name || 'Penerima'}</span>
                                <span style="font-size:0.7rem; font-weight:800; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:6px; text-transform:uppercase;">${c.callee_role}</span>
                            </div>
                            <div style="font-size:0.77rem; color:#64748b; margin-top:3px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                <span><i class="fas fa-clock"></i> ${c.waktu_mulai || c.created_at || '-'}</span>
                                ${c.nik_warga ? `<span><i class="fas fa-id-card"></i> NIK: <b>${c.nik_warga}</b></span>` : ''}
                                <span><i class="fas fa-stopwatch"></i> Durasi: <b>${durStr}</b></span>
                            </div>
                            ${c.catatan ? `<div style="font-size:0.76rem; color:#334155; margin-top:4px; background:#f8fafc; padding:4px 8px; border-radius:6px; display:inline-block;"><i class="fas fa-info-circle text-primary"></i> ${c.catatan}</div>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge" style="background:${statusBg}; color:${statusCol}; font-weight:800; font-size:0.75rem; padding:5px 10px; border-radius:8px;">
                            ${statusLabel}
                        </span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `
            <div style="text-align:center; padding:24px; color:#dc2626; font-size:0.85rem;">
                <i class="fas fa-exclamation-triangle"></i> Terjadi kesalahan memuat log panggilan: ${err.message}
            </div>
        `;
    }
};

// =========================================================================
// 2. KONTROL PUBLIKASI METRIK PERHITUNGAN SPK (ADMIN & SUPERADMIN)
// =========================================================================

window.cekStatusPublikasiSPK = async function () {
    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/spk/status-publikasi`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const json = await res.json();
            const isPub = Boolean(json.spk?.is_published);
            window.updateUIPublishSPK(isPub, json.spk);
        }
    } catch (_) {}
};

window.updateUIPublishSPK = function (isPublished, info) {
    const btn = document.getElementById('btnTogglePublishSPK');
    const lbl = document.getElementById('labelPublishSPK');
    const badge = document.getElementById('badgeStatusPublishSPK');

    if (btn && lbl) {
        if (isPublished) {
            btn.style.background = '#16a34a';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#16a34a';
            lbl.innerHTML = '<i class="fas fa-check-circle"></i> Sudah Dipublish ke Warga (Klik Tarik)';
        } else {
            btn.style.background = '#ffffff';
            btn.style.color = '#16a34a';
            btn.style.borderColor = '#16a34a';
            lbl.innerHTML = '<i class="fas fa-bullhorn"></i> Terbitkan Metrik SPK ke Portal Warga';
        }
    }

    if (badge) {
        badge.style.display = 'inline-flex';
        badge.style.background = isPublished ? '#dcfce7' : '#fef3c7';
        badge.style.color = isPublished ? '#15803d' : '#b45309';
        badge.style.borderColor = isPublished ? '#86efac' : '#fde68a';
        badge.innerHTML = isPublished
            ? `<i class="fas fa-globe"></i> Diterbitkan Realtime ke Warga (${info?.published_at || 'Aktif'})`
            : `<i class="fas fa-lock"></i> Draft Internal (Hanya Admin)`;
    }
};

window.togglePublishMetrikSPK = async function () {
    const btn = document.getElementById('btnTogglePublishSPK');
    const isCurrentlyPublished = btn && btn.style.background.includes('16a34a') && btn.style.color === 'rgb(255, 255, 255)';
    const nextState = !isCurrentlyPublished;

    const actionText = nextState ? 'Terbitkan Metrik SPK ke Portal Warga' : 'Tarik Publikasi Metrik SPK';
    const descText = nextState
        ? 'Seluruh warga akan dapat memeriksa secara transparan hasil perhitungan BWM-SAW (variabel kriteria, skor, desil & perankingan kelayakan) dengan memasukkan NIK, Nama KTP, dan Email mereka.'
        : 'Metrik perhitungan SPK akan ditarik menjadi Draft Internal dan tidak dapat diakses lagi oleh warga di Portal Publik.';

    const k = await Swal.fire({
        title: `${actionText}?`,
        text: descText,
        icon: nextState ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: `Ya, ${actionText}`,
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const actor = (window.currentUser && window.currentUser.nama_lengkap) || 'Administrator Utama';
            const res = await fetch(`${base}/api/spk/publish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_published: nextState, actor })
            });

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                window.updateUIPublishSPK(nextState, json.data);
                Swal.fire({
                    icon: 'success',
                    title: nextState ? 'Metrik SPK Berhasil Diterbitkan!' : 'Publikasi Metrik SPK Ditarik',
                    text: json.message,
                    buttonsStyling: false,
                    confirmButtonText: 'Oke',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal mengubah status publikasi metrik.');
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: err.message,
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        }
    }
};

// =========================================================================
// 3. KONTROL PUBLIKASI SK BUPATI RESMI (ADMIN & SUPERADMIN)
// =========================================================================

window.cekStatusPublikasiSKBupati = async function () {
    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${base}/api/sk-bupati/status-publikasi`, {
            headers: { 'Authorization': `Bearer ${window.getCleanToken()}` }
        });
        if (res.ok) {
            const json = await res.json();
            const isPub = Boolean(json.is_published);
            window.updateUIPublishSKBupati(isPub, json);
        }
    } catch (_) {}
};

window._isSkBupatiPublished = false;

window.updateUIPublishSKBupati = function (isPublished, info) {
    window._isSkBupatiPublished = Boolean(isPublished);
    const btn = document.getElementById('btnTogglePublishSKBupati');
    const lbl = document.getElementById('labelPublishSKBupati');
    const badge = document.getElementById('badgeStatusPublishSKBupati');

    if (btn && lbl) {
        if (isPublished) {
            btn.style.background = '#e11d48';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#e11d48';
            lbl.innerHTML = '<i class="fas fa-check-circle"></i> SK Diterbitkan Resmi (Klik Tarik)';
        } else {
            btn.style.background = '#ffffff';
            btn.style.color = '#e11d48';
            btn.style.borderColor = '#e11d48';
            lbl.innerHTML = '<i class="fas fa-bullhorn"></i> Terbitkan SK Bupati ke Portal Warga';
        }
    }

    // Hilangkan ikon bintang (*) agar rapi, gunakan label rapi dan elegan
    if (badge) {
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '6px';
        badge.style.background = isPublished ? '#ffe4e6' : '#fef3c7';
        badge.style.color = isPublished ? '#be123c' : '#b45309';
        badge.style.borderColor = isPublished ? '#fecdd3' : '#fde68a';
        badge.innerHTML = isPublished
            ? `<i class="fas fa-file-signature"></i> SK Bupati Diterbitkan Resmi (${info?.published_at || 'Aktif'})`
            : `<i class="fas fa-lock"></i> Draft Internal Pengesahan`;
    }
};

window.togglePublishSKBupati = async function () {
    const nextState = !window._isSkBupatiPublished;

    const actionText = nextState ? 'Terbitkan SK Bupati ke Portal Warga' : 'Tarik Publikasi SK Bupati';
    const descText = nextState
        ? 'Dokumen resmi Keputusan Bupati Sidoarjo beserta daftar penetapan KPM Desil 1–4 akan dapat diakses dan diverifikasi oleh warga di Portal Publik menggunakan NIK, Nama KTP, dan Email.'
        : 'Dokumen SK Bupati akan ditarik menjadi berkas internal aparatur dan ditutup dari portal publik warga.';

    const k = await Swal.fire({
        title: `${actionText}?`,
        text: descText,
        icon: nextState ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonText: `Ya, ${actionText}`,
        cancelButtonText: 'Batal',
        buttonsStyling: false,
        customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary', cancelButton: 'swal-btn-pill-cancel' }
    });

    if (k.isConfirmed) {
        try {
            const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
            const actor = (window.currentUser && window.currentUser.nama_lengkap) || 'Super Administrator';
            const res = await fetch(`${base}/api/sk-bupati/publish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_published: nextState, actor })
            });

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                window.updateUIPublishSKBupati(nextState, json.data);
                if (typeof window.renderSKBupatiPreview === 'function') {
                    window.renderSKBupatiPreview();
                }
                Swal.fire({
                    icon: 'success',
                    title: nextState ? 'SK Bupati Berhasil Diterbitkan!' : 'Publikasi SK Bupati Ditarik',
                    text: json.message,
                    buttonsStyling: false,
                    confirmButtonText: 'Oke',
                    customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
                });
            } else {
                throw new Error(json.message || 'Gagal mengubah status publikasi SK Bupati.');
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: err.message,
                buttonsStyling: false,
                confirmButtonText: 'Oke',
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        }
    }
};

// Inisialisasi pendengar awal saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.cekStatusPublikasiSPK();
        window.cekStatusPublikasiSKBupati();
    }, 1200);
});
