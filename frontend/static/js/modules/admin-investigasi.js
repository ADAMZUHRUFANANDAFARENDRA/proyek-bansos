/**
 * Modul: admin-investigasi.js
 * Deskripsi: Pusat Investigasi Terpadu, Mediasi Sengketa, & Penyelesaian Aduan Bansos Warga
 */

// 21. INVESTIGASI & SENGKETA ADUAN
// =========================================================================
window.allLaporanChatData = [];
window.activeInvestigasiFilter = 'all';

window.loadLaporanChatData = async function () {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    try {
        const token = window.getCleanToken();
        const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

        const laporanEndpoints = [
            `${window.BASE_URL}/api/laporan-chat`,
            `${window.BASE_URL}/api/chat/laporan`,
            `${window.BASE_URL}/api/pengaduan`,
            `${window.BASE_URL}/laporan-chat`
        ];

        let res = null;
        for (const url of laporanEndpoints) {
            try {
                let testRes = await fetch(url, { headers });
                if (testRes.status === 401 || testRes.status === 422) {
                    testRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
                }
                if (testRes && testRes.ok) {
                    res = testRes;
                    break;
                }
            } catch (e) {}
        }

        if (res && res.ok) {
            const resJson = await res.json();
            window.allLaporanChatData = Array.isArray(resJson) ? resJson : (resJson.data || []);
            
            // Update KPI Counter Metrik
            window.updateInvestigasiKPIMetrics(window.allLaporanChatData);
            window.renderLaporanChat(window.allLaporanChatData);
        } else {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;">Belum ada laporan sengketa atau aduan warga yang masuk.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">Gagal mengambil data laporan investigasi.</div>';
    }
};

window.updateInvestigasiKPIMetrics = function (data) {
    if (!Array.isArray(data)) return;
    const total = data.length;
    const selesai = data.filter(x => (x.status === 'Selesai' || x.status_step === 4 || String(x.status_text || '').toLowerCase().includes('selesai'))).length;
    const urgent = data.filter(x => (String(x.kategori || '').toLowerCase().includes('urgent') || String(x.uraian || '').toLowerCase().includes('urgent')) && x.status !== 'Selesai').length;
    const proses = total - selesai;

    const elTotal = document.getElementById('kpiInvestigasiTotal');
    const elProses = document.getElementById('kpiInvestigasiProses');
    const elUrgent = document.getElementById('kpiInvestigasiUrgent');
    const elSelesai = document.getElementById('kpiInvestigasiSelesai');

    if (elTotal) elTotal.innerText = total;
    if (elProses) elProses.innerText = proses;
    if (elUrgent) elUrgent.innerText = urgent;
    if (elSelesai) elSelesai.innerText = selesai;
};

window.bukaChatDariAduan = function (nik) {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        const search = document.getElementById('searchChatInput');
        if (search) {
            search.value = nik;
            if (typeof window.filterChatList === 'function') window.filterChatList();
        }
        if (typeof window.selectWargaChat === 'function') {
            window.selectWargaChat(nik);
        } else if (typeof window.loadChatMessages === 'function') {
            window.loadChatMessages(nik);
        }
    }, 300);
};

window.panggilWargaDariAduan = function (nik, type = 'audio') {
    window.closeModal('modalLaporanChat');
    if (typeof window.openAdminChat === 'function') window.openAdminChat();
    setTimeout(() => {
        if (typeof window.loadChatMessages === 'function') window.loadChatMessages(nik);
        setTimeout(() => {
            if (typeof window.startCallWarga === 'function') window.startCallWarga(type);
        }, 400);
    }, 300);
};

window.selesaikanLaporanAduan = async function (id, nik, nama) {
    const { value: catatan } = await Swal.fire({
        title: '<i class="fas fa-check-circle text-success"></i> Selesaikan Laporan Pengaduan',
        html: `
            <div style="text-align:left; font-size:0.88rem; color:#475569; margin-bottom:12px;">
                Anda akan menyelesaikan aduan resmi untuk warga:
                <div style="font-weight:800; color:#0f172a; margin-top:4px;">${window.safeHtml(nama)} (${nik})</div>
                <div style="font-size:0.75rem; color:#dc2626; margin-top:2px;">ID: ${id}</div>
            </div>
        `,
        input: 'textarea',
        inputLabel: 'Catatan Hasil Penyelesaian / Rekomendasi Petugas:',
        inputValue: 'Laporan telah diverifikasi keabsahan datanya oleh petugas Dinsos dan bantuan disalurkan sesuai regulasi.',
        showCancelButton: true,
        confirmButtonText: 'Tandai Laporan Selesai',
        confirmButtonColor: '#009846',
        cancelButtonText: 'Batal'
    });

    if (catatan) {
        try {
            const currentHandler = (localStorage.getItem('username') || 'Admin 1').toUpperCase();
            const res = await fetch(`${window.BASE_URL}/api/investigasi/selesaikan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    nik: nik,
                    catatan: catatan,
                    petugas: `Dinsos Sidoarjo (${currentHandler})`
                })
            });

            if (res.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Laporan Ditutup & Selesai!',
                    text: 'Status aduan telah berhasil diperbarui menjadi SELESAI dan warga telah ternotifikasi.',
                    confirmButtonColor: '#009846'
                });
                window.loadLaporanChatData();
            } else {
                Swal.fire('Informasi', 'Status laporan telah disimpan.', 'info');
                window.loadLaporanChatData();
            }
        } catch (e) {
            Swal.fire('Error', 'Gagal memproses penyelesaian laporan.', 'error');
        }
    }
};

window.ubahTahapAduan = async function (id, nik) {
    const { value: tahap } = await Swal.fire({
        title: 'Ubah Tahapan Investigasi',
        input: 'select',
        inputOptions: {
            'terima': 'Step 2: Peninjauan Bukti & Dokumen',
            'tanggapi': 'Step 3: Investigasi Lapangan / Musyawarah',
            'selesai': 'Step 4: Selesai & Ditutup'
        },
        inputPlaceholder: 'Pilih tahapan baru...',
        showCancelButton: true,
        confirmButtonText: 'Perbarui Tahap',
        confirmButtonColor: '#009846'
    });

    if (tahap) {
        try {
            const currentHandler = (localStorage.getItem('username') || 'Petugas Lapangan').toUpperCase();
            await fetch(`${window.BASE_URL}/api/investigasi/tindak-lanjut`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    nik,
                    aksi: tahap,
                    tanggapan: `Tahapan investigasi diperbarui oleh ${currentHandler}.`,
                    petugas: `Dinsos (${currentHandler})`
                })
            });
            Swal.fire('Berhasil', 'Tahapan investigasi berhasil diperbarui.', 'success');
            window.loadLaporanChatData();
        } catch (e) {}
    }
};

function renderLaporanChat(data) {
    const container = document.getElementById('laporanChatList');
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:0.9rem;"><i class="fas fa-clipboard-check fa-3x" style="opacity:0.3; margin-bottom:10px; display:block;"></i>Tidak ada laporan yang sesuai kriteria pencarian.</div>';
        return;
    }

    container.innerHTML = data.map(item => {
        const isSelesai = item.status === 'Selesai' || item.status_step === 4 || String(item.status_text || '').toLowerCase().includes('selesai');
        const isUrgent = String(item.kategori || '').toLowerCase().includes('urgent') || String(item.uraian || '').toLowerCase().includes('urgent');
        
        let statusBadge = '';
        if (isSelesai) {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-check-circle"></i> SELESAI & DITUTUP</span>`;
        } else if (item.status_step === 3 || String(item.status_text || '').toLowerCase().includes('lapangan')) {
            statusBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-walking"></i> INVESTIGASI LAPANGAN</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-weight:800; padding:4px 12px; border-radius:14px;"><i class="fas fa-hourglass-half"></i> TAHAP MEDIASI</span>`;
        }

        return `
            <div class="card" style="padding:18px 22px; margin-bottom:16px; border:1.5px solid ${isSelesai ? '#bbf7d0' : (isUrgent ? '#fca5a5' : '#e2e8f0')}; border-radius:20px; background:${isSelesai ? '#ffffff' : '#ffffff'}; box-shadow:0 4px 16px rgba(15,23,42,0.04); transition:transform 0.15s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:800; font-size:0.85rem; color:#dc2626;"><i class="fas fa-shield-virus"></i> ${item.id}</span>
                        <span style="background:#f1f5f9; color:#475569; padding:2px 10px; border-radius:10px; font-weight:700; font-size:0.75rem;">${item.kategori || 'Sengketa Penyaluran'}</span>
                        ${isUrgent ? '<span style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; font-weight:800; font-size:0.68rem; padding:1px 6px; border-radius:6px;">URGENT</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${statusBadge}
                        <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;"><i class="far fa-clock"></i> ${item.waktu || 'Hari ini'}</span>
                    </div>
                </div>

                <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span><i class="fas fa-user text-muted" style="font-size:0.85rem;"></i> Pelapor: <b>${window.safeHtml(item.nama)}</b></span>
                    <span style="color:#cbd5e1;">&bull;</span>
                    <span class="font-mono" style="font-size:0.85rem; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:8px;"><i class="fas fa-id-card"></i> ${item.nik}</span>
                </div>

                <div style="background:#f8fafc; padding:12px 16px; border-radius:14px; font-size:0.88rem; color:#334155; margin-bottom:12px; border:1px solid #e2e8f0; line-height:1.5;">
                    <i class="fas fa-quote-left text-muted" style="margin-right:6px; opacity:0.6;"></i>${window.safeHtml(item.uraian || item.deskripsi || '-')}
                </div>

                ${item.catatan_petugas ? `
                    <div style="background:#eff6ff; padding:10px 14px; border-radius:12px; font-size:0.82rem; color:#1e40af; margin-bottom:14px; border-left:4px solid #3b82f6;">
                        <b><i class="fas fa-user-shield"></i> Tindak Lanjut Petugas:</b> ${window.safeHtml(item.catatan_petugas)}
                    </div>
                ` : ''}

                <!-- ACTIONS DOCK RESMI -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="window.ubahTahapAduan('${item.id}', '${item.nik}')" class="btn btn-sm btn-secondary" style="border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;" title="Ubah Tahapan Penanganan">
                            <i class="fas fa-tasks text-primary"></i> Ubah Tahapan
                        </button>
                        <button type="button" onclick="window.panggilWargaDariAduan('${item.nik}', 'audio')" class="btn btn-sm" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;">
                            <i class="fas fa-phone-alt"></i> Telepon
                        </button>
                        <button type="button" onclick="window.panggilWargaDariAduan('${item.nik}', 'video')" class="btn btn-sm" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; border-radius:14px; font-weight:700; font-size:0.75rem; padding:6px 12px;">
                            <i class="fas fa-video"></i> Video Call
                        </button>
                    </div>

                    <div style="display:flex; gap:8px;">
                        ${!isSelesai ? `
                            <button type="button" onclick="window.selesaikanLaporanAduan('${item.id}', '${item.nik}', '${window.escapeInlineJS(item.nama)}')" class="btn btn-sm" style="background:linear-gradient(135deg, #009846, #047857); color:white; border:none; border-radius:20px; font-weight:800; font-size:0.8rem; padding:7px 18px; box-shadow:0 3px 8px rgba(0,152,70,0.25);">
                                <i class="fas fa-check-circle"></i> Selesaikan Laporan
                            </button>
                        ` : `
                            <span style="color:#16a34a; font-weight:800; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
                                <i class="fas fa-check-double"></i> Telah Diselesaikan
                            </span>
                        `}
                        <button onclick="window.bukaChatDariAduan('${item.nik}')" class="btn btn-primary btn-sm" style="border-radius:20px; padding:7px 16px; font-weight:700; font-size:0.8rem;">
                            <i class="fas fa-comments"></i> Buka Chat Mediasi
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.filterInvestigasi = function (filterType, btn) {
    window.activeInvestigasiFilter = filterType;
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('button').forEach(b => {
            b.className = 'btn btn-secondary btn-sm';
            b.style.color = '';
            b.style.borderColor = '';
            b.style.borderRadius = '20px';
        });
        btn.className = 'btn btn-primary btn-sm';
        btn.style.borderRadius = '20px';
    }

    let filtered = window.allLaporanChatData || [];
    if (filterType === 'urgent') {
        filtered = filtered.filter(x => (String(x.kategori || '').toLowerCase().includes('urgent')) || (String(x.uraian || '').toLowerCase().includes('urgent')));
    } else if (filterType === 'sengketa') {
        filtered = filtered.filter(x => (String(x.kategori || '').toLowerCase().includes('sengketa')) || (String(x.kategori || '').toLowerCase().includes('salur')));
    } else if (filterType === 'selesai') {
        filtered = filtered.filter(x => x.status === 'Selesai' || x.status_step === 4 || String(x.status_text || '').toLowerCase().includes('selesai'));
    } else if (filterType === 'proses') {
        filtered = filtered.filter(x => x.status !== 'Selesai' && x.status_step !== 4 && !String(x.status_text || '').toLowerCase().includes('selesai'));
    }
    renderLaporanChat(filtered);
};

window.filterInvestigasiSearch = function (query) {
    const q = (query || '').toLowerCase().trim();
    let list = window.allLaporanChatData || [];
    if (q) {
        list = list.filter(item => 
            String(item.nik || '').includes(q) ||
            String(item.nama || '').toLowerCase().includes(q) ||
            String(item.uraian || '').toLowerCase().includes(q) ||
            String(item.kategori || '').toLowerCase().includes(q) ||
            String(item.id || '').toLowerCase().includes(q)
        );
    }
    renderLaporanChat(list);
};

window.bukaMediaLightbox = function (url) {
    const modal = document.getElementById('mediaLightbox');
    const container = document.getElementById('lightboxContent');
    if (!modal || !container) return;
    container.innerHTML = `<img src="${url}" style="max-width:90vw; max-height:80vh; border-radius:12px; object-fit:contain;" />`;
    modal.style.display = 'flex';
};

window.closeLightbox = function (e) {
    if (!e || e.target.id === 'mediaLightbox' || e.target.classList.contains('close-lightbox-btn')) {
        const modal = document.getElementById('mediaLightbox');
        const container = document.getElementById('lightboxContent');
        if (container) container.innerHTML = '';
        if (modal) modal.style.display = 'none';
    }
};

window.bukaWilayahDetail = function (kecamatanNama) {
    const modal = document.getElementById('modalWilayahDetail');
    const titleEl = document.getElementById('modalWilayahTitle');
    const tbody = document.getElementById('wilayahDetailTbody');
    if (!modal || !tbody) return;

    if (titleEl) titleEl.innerText = kecamatanNama || 'Kabupaten Sidoarjo';
    const dataList = window.globalDataWarga || [];
    const filtered = dataList.filter(w => String(w.alamat || '').toLowerCase().includes(String(kecamatanNama || '').toLowerCase()));

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada data warga terdaftar di wilayah ini.</td></tr>';
    } else {
        tbody.innerHTML = filtered.map((w, idx) => `
            <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${window.safeHtml(w.nama)}</b><br><small class="text-muted font-mono">${w.nik}</small></td>
                <td>${window.safeHtml(w.alamat || '-')}</td>
                <td style="text-align:center;"><span class="badge badge-blue">Desil ${w.desil || 5}</span></td>
                <td>${w.status_salur === 'Telah Menerima' ? 'Telah Menerima' : 'Belum Salur'}</td>
                <td>Rp 600.000,-</td>
                <td style="text-align:center;">${w.bukti_salur ? '<i class="fas fa-check text-success"></i>' : '-'}</td>
                <td style="text-align:center;">${w.lat && w.lng ? `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}` : '-'}</td>
            </tr>
        `).join('');
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// =========================================================================
