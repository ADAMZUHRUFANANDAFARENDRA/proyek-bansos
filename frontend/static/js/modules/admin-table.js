/**
 * Modul: admin-table.js
 * Deskripsi: Render tabel data warga, pagination, filter tanggal, dan pemilihan baris massal
 */

// 11. FILTER WAKTU & SORTING DATA
// =========================================================================
window.activeDateFilter = { mode: 'tanggal', val: '' };

function parseWaktuPendaftaran(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        return { day: parseInt(dmy[1], 10), month: parseInt(dmy[2], 10), year: parseInt(dmy[3], 10) };
    }

    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
        return { day: parseInt(ymd[3], 10), month: parseInt(ymd[2], 10), year: parseInt(ymd[1], 10) };
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
    }
    return null;
}

window.changeDateFilterMode = function (mode) {
    window.activeDateFilter.mode = mode;
    window.activeDateFilter.val = '';
    const container = document.getElementById('dateFilterInputContainer');
    if (!container) return;

    if (mode === 'tanggal') {
        container.innerHTML = `<input type="date" id="filterTglPicker" onchange="window.applyDateFilter()" style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Tanggal Tertentu">`;
    } else if (mode === 'bulan') {
        container.innerHTML = `<input type="month" id="filterBulanPicker" onchange="window.applyDateFilter()" style="border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; cursor:pointer; background:#f8fafc;" title="Pilih Bulan Tertentu">`;
    } else if (mode === 'tahun') {
        container.innerHTML = `<input type="number" id="filterTahunPicker" min="1900" max="2100" placeholder="Ketik Tahun (contoh: 2026)" oninput="window.applyDateFilter()" style="width:160px; border:1px solid #e2e8f0; border-radius:8px; padding:3px 8px; font-family:'Inter'; font-size:0.8rem; outline:none; color:#0f172a; background:#f8fafc;" title="Ketik tahun pendaftaran bebas">`;
    }

    window.filterAndRenderData();
};

window.applyDateFilter = function () {
    const mode = window.activeDateFilter.mode;
    if (mode === 'tanggal') {
        window.activeDateFilter.val = document.getElementById('filterTglPicker')?.value || '';
    } else if (mode === 'bulan') {
        window.activeDateFilter.val = document.getElementById('filterBulanPicker')?.value || '';
    } else if (mode === 'tahun') {
        window.activeDateFilter.val = document.getElementById('filterTahunPicker')?.value.trim() || '';
    }
    window.filterAndRenderData();
};

window.resetDateFilter = function () {
    window.activeDateFilter = { mode: 'tanggal', val: '' };
    const modeEl = document.getElementById('dateFilterMode');
    if (modeEl) modeEl.value = 'tanggal';
    window.changeDateFilterMode('tanggal');
};

window.filterAndRenderData = function () {
    let dataList = Array.isArray(window.globalDataWarga) ? window.globalDataWarga : [];
    let filtered = [...dataList];

    if (window.currentFilter === 'layak') {
        filtered = filtered.filter(w => w.is_verified && ((w.desil || 5) <= 4));
    } else if (window.currentFilter === 'menerima') {
        filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    } else if (window.currentFilter === 'bermasalah') {
        filtered = filtered.filter(w => String(w.status_salur || '').includes('Sengketa') || !w.is_verified);
    }

    const { mode, val } = window.activeDateFilter;
    if (val) {
        if (mode === 'tanggal') {
            const [targetY, targetM, targetD] = val.split('-').map(Number);
            filtered = filtered.filter(w => {
                const parsed = parseWaktuPendaftaran(w.created_at);
                return parsed && parsed.year === targetY && parsed.month === targetM && parsed.day === targetD;
            });
        } else if (mode === 'bulan') {
            const [targetY, targetM] = val.split('-').map(Number);
            filtered = filtered.filter(w => {
                const parsed = parseWaktuPendaftaran(w.created_at);
                return parsed && parsed.year === targetY && parsed.month === targetM;
            });
        } else if (mode === 'tahun') {
            const targetY = parseInt(val, 10);
            if (!isNaN(targetY)) {
                filtered = filtered.filter(w => {
                    const parsed = parseWaktuPendaftaran(w.created_at);
                    return parsed && parsed.year === targetY;
                });
            }
        }
    }

    if (window.currentSort === 'nik_asc') {
        filtered.sort((a, b) => BigInt(String(a.nik).replace(/\D/g, '') || 0) < BigInt(String(b.nik).replace(/\D/g, '') || 0) ? -1 : 1);
    } else if (window.currentSort === 'nik_desc') {
        filtered.sort((a, b) => BigInt(String(a.nik).replace(/\D/g, '') || 0) > BigInt(String(b.nik).replace(/\D/g, '') || 0) ? -1 : 1);
    } else if (window.currentSort === 'terbaru') {
        filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (window.currentSort === 'terlama') {
        filtered.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (window.currentSort === 'az') {
        filtered.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || '')));
    } else if (window.currentSort === 'za') {
        filtered.sort((a, b) => String(b.nama || '').localeCompare(String(a.nama || '')));
    }

    try {
        window.renderTable(filtered);
    } catch (e) {
        console.warn('Gagal memproses render tabel kependudukan:', e);
    }
};

// =========================================================================


// 13. RENDER TABEL DATA WARGA
// =========================================================================
window.renderTable = function (data) {
    if (!Array.isArray(data)) data = [];

    if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
        $.fn.dataTable.ext.errMode = 'none';
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            try {
                $('#dataTable').DataTable().clear().destroy();
            } catch (e) {}
        }
    }

    const tbody = document.querySelector('#dataTable tbody') || 
                  document.querySelector('#tableWarga tbody') || 
                  document.querySelector('#tabelWarga tbody') || 
                  document.querySelector('.arsip-table tbody') || 
                  document.querySelector('#panelDataWarga table tbody') || 
                  document.querySelector('table tbody');

    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:36px 16px; color:#64748b; font-weight:600;">
                    <i class="fas fa-inbox" style="font-size:2.2rem; opacity:0.35; margin-bottom:10px; display:block;"></i>
                    Belum ada data warga terdaftar.<br>
                    <div style="margin-top:10px;">
                        <button type="button" class="btn btn-sm" onclick="window.bukaModalSinkronArsip()" style="background:#f0f9ff; color:#0284c7; border:1px solid #7dd3fc; border-radius:20px; font-weight:700; padding:6px 16px;">
                            <i class="fas fa-database"></i> Pulihkan Dari Cadangan Arsip (Restore)
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    data.forEach(w => {
        const isVerified = Boolean(w.is_verified);
        const desil = w.desil || 5;
        const isEligible = isVerified && desil <= 4;

        let verifBadge = isVerified
            ? `<span class="badge badge-green"><i class="fas fa-check-circle"></i> DISETUJUI</span>`
            : `<span class="badge badge-red"><i class="fas fa-clock"></i> MENUNGGU</span>`;

        let desilBadge = isVerified
            ? (desil <= 4
                ? `<span class="badge badge-green" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-award"></i> Layak Bansos (Desil ${desil})</span>`
                : `<span class="badge badge-warning" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-info-circle"></i> Tidak Prioritas (Desil ${desil})</span>`)
            : '';

        let statusSalurBadge = '';
        const isDisalurkan = w.status_salur === 'Disalurkan' || w.status_salur === 'Telah Menerima' || Boolean(w.bukti_salur);
        if (w.status_salur === 'Telah Menerima') {
            statusSalurBadge = `<span class="badge badge-blue" style="font-size:0.7rem; margin-top:3px; font-weight:800;"><i class="fas fa-check-double"></i> Telah Menerima (Dikonfirmasi Warga)</span>`;
        } else if (w.status_salur === 'Disalurkan' || Boolean(w.bukti_salur)) {
            statusSalurBadge = `<span class="badge" style="background:#ecfdf5; color:#065f46; border:1px solid #6ee7b7; font-size:0.7rem; margin-top:3px; font-weight:800;"><i class="fas fa-truck text-emerald-600"></i> Disalurkan (Menunggu Konfirmasi Warga)</span>`;
        } else if (String(w.status_salur || '').includes('Sengketa')) {
            statusSalurBadge = `<span class="badge badge-red" style="font-size:0.7rem; margin-top:3px;"><i class="fas fa-exclamation-triangle"></i> Sengketa</span>`;
        }

        const isSengketa = String(w.status_salur || '').toLowerCase().includes('sengketa') || 
                           String(w.catatan || '').toLowerCase().includes('sengketa') ||
                           String(w.catatan || '').toLowerCase().includes('sanggah');

        const btnSengketa = isSengketa
            ? `<button type="button" onclick="window.bukaAksiCepatSengketa(${w.id}, '${window.escapeInlineJS(w.nama)}', '${w.nik}')" class="btn btn-sm" style="padding:5px 8px; background:#fee2e2; color:#dc2626; font-size:0.8rem; border-radius:6px; margin-right:3px; border:1px solid #fca5a5;" title="Mediasi Sengketa Aktif"><i class="fas fa-shield-alt"></i></button>`
            : '';

        const btnToggleVerif = isVerified
            ? `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, false)" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, true)" class="btn btn-primary btn-sm" style="border-radius:8px; font-weight:700; padding:5px 10px; margin-right:4px;"><i class="fas fa-check"></i> Setujui</button>`;

        // Tombol kamera otomatis berubah menjadi tombol ceklis jika bukti sudah diunggah / disalurkan
        let btnKamera = '';
        if (isDisalurkan) {
            btnKamera = `<button onclick="window.bukaUploadBuktiSalur(${w.id})" class="btn btn-sm" style="padding:5px 9px; background:#10b981; color:white; border-radius:6px; margin-right:3px; border:none; box-shadow:0 2px 6px rgba(16,185,129,0.3);" title="Bukti Penyaluran Terunggah (Sudah Disalurkan - Klik untuk Lihat/Ubah)"><i class="fas fa-check-circle"></i></button>`;
        } else {
            btnKamera = `<button onclick="window.bukaUploadBuktiSalur(${w.id})" class="btn btn-sm" style="padding:5px 9px; background:#dcfce7; color:#15803d; border-radius:6px; margin-right:3px; border:1px solid #86efac;" title="Unggah Bukti & Keterangan Penyaluran"><i class="fas fa-camera"></i></button>`;
        }

        const currentRole = (localStorage.getItem('role') || user?.role || 'operator').toLowerCase();
        const btnDelete = currentRole === 'admin'
            ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:5px 8px; background:#ef4444; color:white; font-size:0.8rem; border-radius:6px;" title="Hapus Data"><i class="fas fa-trash"></i></button>`
            : '';

        const ttlText = (w.tempat_lahir || w.tanggal_lahir) ? `${w.tempat_lahir || 'Sidoarjo'}, ${w.tanggal_lahir || '-'}` : '-';
        const totalVars = window.hitungTotalVariabelWarga ? window.hitungTotalVariabelWarga(w) : 20;

        html += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" value="${w.id}"></td>
                <td style="font-weight:700; font-family:monospace; color:#0f172a;">${w.nik}</td>
                <td>
                    <div style="font-weight:800; color:#1e293b; font-size:0.95rem;">${window.safeHtml(w.nama)}</div>
                    <small style="color:#475569;"><i class="fas fa-birthday-cake text-muted"></i> ${window.safeHtml(ttlText)}</small><br>
                    <small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${window.safeHtml(w.alamat || 'Sidoarjo')}</small><br>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-top:2px;">
                        ${desilBadge}
                        ${statusSalurBadge}
                        <button type="button" onclick="window.bukaDetailSemuaVariabelWarga(${w.id})" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:0.7rem; font-weight:700; color:#475569; padding:2px 7px; cursor:pointer; margin-top:3px;" title="Lihat & sesuaikan ${totalVars} variabel kependudukan warga ini">
                            <i class="fas fa-sliders-h text-primary"></i> ${totalVars} Variabel
                        </button>
                    </div>
                </td>
                <td><small><i class="fas fa-clock text-primary"></i> ${w.created_at || 'Hari ini'}</small></td>
                <td style="text-align:center;">${verifBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    ${btnToggleVerif}
                    <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:5px 8px; background:#fef3c7; color:#b45309; font-size:0.8rem; border-radius:6px; margin-right:3px;" title="Edit Data & Seluruh Variabel"><i class="fas fa-edit"></i></button>
                    ${btnKamera}
                    ${btnSengketa}
                    ${btnDelete}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Render juga tampilan Layout Card Warga
    if (typeof window.renderWargaCards === 'function') {
        window.renderWargaCards(data);
    }

    if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
        try {
            dtTable = $('#dataTable').DataTable({
                destroy: true,
                retrieve: true,
                pageLength: 10,
                responsive: true,
                order: [],
                language: {
                    search: "Cari NIK/Nama:",
                    lengthMenu: "_MENU_ baris",
                    info: "Menampilkan _START_ s.d. _END_ dari _TOTAL_ warga",
                    infoEmpty: "Menampilkan 0 warga",
                    zeroRecords: "Data warga tidak ditemukan",
                    emptyTable: "Belum ada arsip data warga",
                    paginate: { next: "→", previous: "←" }
                }
            });
        } catch (e) {
            console.warn('[DataTable] Gagal inisialisasi tabel:', e);
        }
    }
};

window.currentWargaViewMode = 'table';
window.toggleWargaViewMode = function (mode) {
    window.currentWargaViewMode = mode;
    const tableWrap = document.getElementById('wargaTableWrapper');
    const cardWrap = document.getElementById('wargaCardGridWrapper');
    const btnTable = document.getElementById('btnViewModeTable');
    const btnCard = document.getElementById('btnViewModeCard');

    if (mode === 'card') {
        if (tableWrap) tableWrap.style.display = 'none';
        if (cardWrap) {
            cardWrap.style.display = 'block';
            window.renderWargaCards(window.globalDataWarga || []);
        }
        if (btnCard) {
            btnCard.style.setProperty('background', '#009846', 'important');
            btnCard.style.setProperty('color', '#ffffff', 'important');
            btnCard.style.setProperty('box-shadow', '0 2px 8px rgba(0, 152, 70, 0.35)', 'important');
            btnCard.classList.add('active');
        }
        if (btnTable) {
            btnTable.style.setProperty('background', 'transparent', 'important');
            btnTable.style.setProperty('color', '#64748b', 'important');
            btnTable.style.setProperty('box-shadow', 'none', 'important');
            btnTable.classList.remove('active');
        }
    } else {
        if (tableWrap) tableWrap.style.display = 'block';
        if (cardWrap) cardWrap.style.display = 'none';
        if (btnTable) {
            btnTable.style.setProperty('background', '#009846', 'important');
            btnTable.style.setProperty('color', '#ffffff', 'important');
            btnTable.style.setProperty('box-shadow', '0 2px 8px rgba(0, 152, 70, 0.35)', 'important');
            btnTable.classList.add('active');
        }
        if (btnCard) {
            btnCard.style.setProperty('background', 'transparent', 'important');
            btnCard.style.setProperty('color', '#64748b', 'important');
            btnCard.style.setProperty('box-shadow', 'none', 'important');
            btnCard.classList.remove('active');
        }
    }
};

window.renderWargaCards = function (data) {
    const cardContainer = document.getElementById('wargaCardsContainer');
    if (!cardContainer) return;

    if (!data || data.length === 0) {
        cardContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:40px; background:#f8fafc; border-radius:18px; border:1.5px dashed #cbd5e1;">
                <i class="fas fa-folder-open text-muted" style="font-size:2.5rem; margin-bottom:10px;"></i>
                <div style="font-weight:700; color:#475569;">Belum Ada Data Arsip Warga</div>
            </div>
        `;
        return;
    }

    const currentRole = (localStorage.getItem('role') || 'operator').toLowerCase();

    cardContainer.innerHTML = data.map(w => {
        const isVerified = Boolean(w.is_verified);
        const desil = w.desil || 5;
        const isEligible = isVerified && desil <= 4;
        const isDisalurkan = w.status_salur === 'Disalurkan' || w.status_salur === 'Telah Menerima' || Boolean(w.bukti_salur);

        let statusSalurCard = '';
        if (w.status_salur === 'Telah Menerima') {
            statusSalurCard = `
                <div style="background:#eff6ff; border:1.5px solid #93c5fd; border-radius:12px; padding:10px 14px; margin:10px 0; color:#1e40af; font-size:0.82rem; font-weight:800; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-check-double text-blue-600" style="font-size:1.1rem;"></i>
                    <div>
                        <div>Keterangan: Sudah Disalurkan & Dikonfirmasi Warga</div>
                        <small style="font-size:0.72rem; color:#3b82f6;">${w.tanggal_salur && w.tanggal_salur !== '-' ? w.tanggal_salur : 'Telah serah terima'}</small>
                    </div>
                </div>
            `;
        } else if (isDisalurkan) {
            statusSalurCard = `
                <div style="background:#ecfdf5; border:1.5px solid #6ee7b7; border-radius:12px; padding:10px 14px; margin:10px 0; color:#065f46; font-size:0.82rem; font-weight:800; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-truck text-emerald-600" style="font-size:1.1rem;"></i>
                    <div>
                        <div>Keterangan: Sudah Disalurkan (Menunggu Konfirmasi Warga)</div>
                        <small style="font-size:0.72rem; color:#059669;">${window.safeHtml(w.keterangan_salur || 'Dokumentasi bukti penyaluran telah tercatat')}</small>
                    </div>
                </div>
            `;
        } else {
            statusSalurCard = `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:8px 12px; margin:10px 0; color:#64748b; font-size:0.8rem; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-clock text-amber-500"></i>
                    <div>Status Bansos: Belum Disalurkan</div>
                </div>
            `;
        }

        // Checklist button vs camera button
        let btnSalur = '';
        if (isDisalurkan) {
            btnSalur = `
                <button type="button" onclick="window.bukaUploadBuktiSalur(${w.id})" class="btn" style="background:#10b981; color:white; border-radius:10px; font-weight:700; font-size:0.8rem; padding:7px 12px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(16,185,129,0.3);" title="Bukti Penyaluran Tersimpan (Klik untuk Lihat / Ubah)">
                    <i class="fas fa-check-circle"></i> Sudah Disalurkan
                </button>
            `;
        } else {
            btnSalur = `
                <button type="button" onclick="window.bukaUploadBuktiSalur(${w.id})" class="btn" style="background:#ecfdf5; color:#15803d; border:1.5px solid #86efac; border-radius:10px; font-weight:700; font-size:0.8rem; padding:7px 12px; display:inline-flex; align-items:center; gap:6px;" title="Unggah Bukti Penyaluran">
                    <i class="fas fa-camera"></i> Salurkan
                </button>
            `;
        }

        const btnToggleVerif = isVerified
            ? `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, false)" class="btn btn-secondary btn-sm" style="border:1px solid #cbd5e1; border-radius:10px; font-weight:700; padding:6px 12px;"><i class="fas fa-undo"></i> Batal</button>`
            : `<button onclick="window.ubahStatusVerifikasiWarga(${w.id}, true)" class="btn btn-primary btn-sm" style="border-radius:10px; font-weight:700; padding:6px 12px;"><i class="fas fa-check"></i> Setujui</button>`;

        const ttlText = (w.tempat_lahir || w.tanggal_lahir) ? `${w.tempat_lahir || 'Sidoarjo'}, ${w.tanggal_lahir || '-'}` : '-';

        return `
            <div class="card warga-single-card" style="border-radius:20px; border:1.5px solid #e2e8f0; background:#ffffff; box-shadow:0 4px 15px rgba(0,0,0,0.03); display:flex; flex-direction:column; overflow:hidden; transition:all 0.2s ease;">
                <div style="padding:16px 18px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:42px; height:42px; border-radius:14px; background:#f0fdf4; color:#16a34a; font-weight:900; font-size:1.15rem; display:flex; align-items:center; justify-content:center; border:1.5px solid #bbf7d0;">
                            ${(w.nama || 'W').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:900; font-size:0.98rem; color:#0f172a;">${window.safeHtml(w.nama)}</div>
                            <div style="font-family:monospace; font-size:0.8rem; font-weight:700; color:#475569;">NIK: ${w.nik}</div>
                        </div>
                    </div>
                    <span class="badge ${isVerified ? 'badge-green' : 'badge-red'}" style="font-size:0.7rem;">
                        ${isVerified ? '<i class="fas fa-check-circle"></i> Disetujui' : '<i class="fas fa-clock"></i> Menunggu'}
                    </span>
                </div>

                <div style="padding:14px 18px; flex:1;">
                    <div style="font-size:0.82rem; color:#475569; margin-bottom:4px;"><i class="fas fa-map-marker-alt text-danger"></i> ${window.safeHtml(w.alamat || 'Kabupaten Sidoarjo')}</div>
                    <div style="font-size:0.8rem; color:#64748b; margin-bottom:8px;"><i class="fas fa-birthday-cake text-muted"></i> ${window.safeHtml(ttlText)}</div>
                    
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; align-items:center;">
                        <span class="badge ${desil <= 4 ? 'badge-green' : 'badge-warning'}" style="font-size:0.72rem;">
                            <i class="fas fa-award"></i> Desil ${desil} ${desil <= 4 ? '(Layak)' : ''}
                        </span>
                        <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.72rem; font-weight:700;">
                            <i class="fas fa-box"></i> ${w.nominal_bantuan || 'Beras 10 Kg'}
                        </span>
                        <button type="button" onclick="window.bukaDetailSemuaVariabelWarga(${w.id})" class="badge" style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; cursor:pointer; font-size:0.72rem; padding:4px 9px; border-radius:8px; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;" title="Lihat & telusuri seluruh ${window.hitungTotalVariabelWarga ? window.hitungTotalVariabelWarga(w) : 20} variabel warga">
                            <i class="fas fa-layer-group text-emerald-600"></i> ${window.hitungTotalVariabelWarga ? window.hitungTotalVariabelWarga(w) : 20} Variabel
                        </button>
                    </div>

                    ${statusSalurCard}
                </div>

                <div style="padding:12px 18px; background:#f8fafc; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div>
                        ${btnToggleVerif}
                    </div>
                    <div style="display:flex; gap:6px;">
                        ${btnSalur}
                        <button onclick="window.bukaModalEdit(${w.id})" class="btn" style="padding:7px 10px; background:#fef3c7; color:#b45309; border-radius:10px; font-weight:700; font-size:0.8rem;" title="Edit Seluruh Data & Variabel"><i class="fas fa-edit"></i></button>
                        ${currentRole === 'admin' ? `<button onclick="window.hapusData(${w.id})" class="btn" style="padding:7px 10px; background:#fee2e2; color:#dc2626; border-radius:10px; font-size:0.8rem;" title="Hapus Data"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

window.hitungTotalVariabelWarga = function (w) {
    if (!w) return 0;
    const baseKeys = [
        'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'no_hp', 'email',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
        'desil', 'skor_saw', 'rank_saw', 'status_validasi', 'status_salur',
        'nominal_bantuan', 'tanggal_salur', 'lat', 'lng', 'catatan'
    ];
    let count = baseKeys.filter(k => w[k] !== undefined && w[k] !== null && String(w[k]).trim() !== '').length;
    if (count < 10) count = 10;
    if (w.extra_data && typeof w.extra_data === 'object') {
        count += Object.keys(w.extra_data).length;
    }
    return count;
};

window.bukaDetailSemuaVariabelWarga = function (id) {
    const dataList = window.globalDataWarga || [];
    const w = dataList.find(x => String(x.id) === String(id));
    if (!w) return;

    const modal = document.getElementById('modalDetailSemuaVariabel');
    const titleEl = document.getElementById('detailVarWargaNama');
    const nikEl = document.getElementById('detailVarWargaNik');
    const countBadge = document.getElementById('detailVarTotalCountBadge');
    const container = document.getElementById('detailVarListContainer');
    if (!modal || !container) return;

    if (titleEl) titleEl.innerText = w.nama || 'Warga';
    if (nikEl) nikEl.innerText = `NIK: ${w.nik || '-'}`;

    const labelMap = {
        'nik': 'Nomor NIK (KTP)',
        'nama': 'Nama Lengkap Warga',
        'tempat_lahir': 'Tempat Lahir',
        'tanggal_lahir': 'Tanggal Lahir',
        'alamat': 'Alamat Domisili Lengkap',
        'no_hp': 'No. WhatsApp / HP',
        'email': 'Alamat Email',
        'c1': 'C1 - Penghasilan (Ekonomi)',
        'c2': 'C2 - Kondisi Rumah / Aset',
        'c3': 'C3 - Usia Kepala Keluarga',
        'c4': 'C4 - Jenis Kelamin',
        'c5': 'C5 - Jumlah Tanggungan',
        'c6': 'C6 - Status Pernikahan',
        'c7': 'C7 - Kepemilikan Anak Sekolah',
        'c8': 'C8 - Status Tempat Tinggal',
        'c9': 'C9 - Tingkat Pendidikan Terakhir',
        'c10': 'C10 - Riwayat Kesehatan',
        'desil': 'Desil Kemiskinan',
        'skor_saw': 'Skor Akhir SPK SAW',
        'rank_saw': 'Peringkat Prioritas',
        'status_validasi': 'Status Validasi Dinas',
        'status_salur': 'Status Penyaluran Bansos',
        'nominal_bantuan': 'Jenis / Nominal Bansos',
        'tanggal_salur': 'Waktu Penyaluran',
        'lat': 'Garis Lintang (Lat)',
        'lng': 'Garis Bujur (Lng)',
        'catatan': 'Catatan Khusus Petugas'
    };

    const allEntries = [];
    const standardKeys = [
        'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'no_hp', 'email',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
        'desil', 'skor_saw', 'rank_saw', 'status_validasi', 'status_salur',
        'nominal_bantuan', 'tanggal_salur', 'lat', 'lng', 'catatan'
    ];

    standardKeys.forEach(k => {
        let val = w[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            allEntries.push({
                key: k,
                label: labelMap[k] || k,
                value: String(val),
                category: k.startsWith('c') ? 'Kriteria SPK' : (['desil', 'skor_saw', 'rank_saw', 'status_validasi', 'status_salur', 'nominal_bantuan'].includes(k) ? 'Hasil SPK & Status' : 'Identitas')
            });
        }
    });

    if (w.extra_data && typeof w.extra_data === 'object') {
        Object.keys(w.extra_data).forEach(ek => {
            const val = w.extra_data[ek];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                allEntries.push({
                    key: ek,
                    label: ek.replace(/_/g, ' ').toUpperCase(),
                    value: String(val),
                    category: 'Variabel Kustom / Hasil Impor'
                });
            }
        });
    }

    if (countBadge) countBadge.innerText = `${allEntries.length} Variabel`;

    window._activeWargaDetailEntries = allEntries;
    window._activeWargaDetailId = w.id;

    window.filterDetailVarList('');

    const btnEdit = document.getElementById('btnEditFromDetailVarModal');
    if (btnEdit) {
        btnEdit.onclick = function () {
            window.closeModal('modalDetailSemuaVariabel');
            window.bukaModalEdit(w.id);
        };
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

window.filterDetailVarList = function (q) {
    const container = document.getElementById('detailVarListContainer');
    if (!container) return;
    const entries = window._activeWargaDetailEntries || [];
    const query = String(q || '').toLowerCase().trim();

    const filtered = entries.filter(e => 
        !query || e.label.toLowerCase().includes(query) || e.value.toLowerCase().includes(query) || e.key.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:24px; color:#64748b;">Tidak ada variabel yang sesuai dengan pencarian "${window.safeHtml(query)}".</div>`;
        return;
    }

    container.innerHTML = filtered.map(e => {
        let badgeColor = '#475569';
        let badgeBg = '#f1f5f9';
        if (e.category === 'Identitas') { badgeBg = '#ecfdf5'; badgeColor = '#065f46'; }
        else if (e.category === 'Kriteria SPK') { badgeBg = '#eff6ff'; badgeColor = '#1d4ed8'; }
        else if (e.category === 'Hasil SPK & Status') { badgeBg = '#fef3c7'; badgeColor = '#92400e'; }
        else { badgeBg = '#faf5ff'; badgeColor = '#7c3aed'; }

        return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:10px 14px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; gap:12px;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                        <span style="font-size:0.7rem; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:6px;">
                            ${e.category}
                        </span>
                        <span style="font-weight:800; font-size:0.85rem; color:#1e293b;">
                            ${window.safeHtml(e.label)}
                        </span>
                    </div>
                    <small style="font-family:monospace; color:#64748b; font-size:0.72rem;">key: ${window.safeHtml(e.key)}</small>
                </div>
                <div style="font-weight:700; font-size:0.88rem; color:#0f172a; text-align:right; max-width:55%; word-break:break-word;">
                    ${window.safeHtml(e.value)}
                </div>
            </div>
        `;
    }).join('');
};

document.addEventListener('change', function (e) {
    if (e.target.classList.contains('row-checkbox') || e.target.id === 'selectAll') {
        const checked = document.querySelectorAll('.row-checkbox:checked').length;
        const fab = document.getElementById('fabBulk');
        const countEl = document.getElementById('bulkCount');
        if (countEl) countEl.innerText = checked;
        if (fab) fab.style.display = checked > 0 ? 'flex' : 'none';
    }
});

// =========================================================================


// 24. EVENT LISTENERS FORM & LOGOUT
// =========================================================================
window.toggleSelectAll = function (source) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = source.checked;
    });
    const checked = document.querySelectorAll('.row-checkbox:checked').length;
    const fab = document.getElementById('fabBulk');
    const countEl = document.getElementById('bulkCount');
    if (countEl) countEl.innerText = checked;
    if (fab) fab.style.display = checked > 0 ? 'flex' : 'none';
};

window.logout = function () {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
};

window.exportSPKPDF = () => window.AdminPrint ? window.AdminPrint.cetakSKBupati() : (window.cetakSKBupati ? window.cetakSKBupati() : null);
window.exportKomparasiPDF = () => window.AdminPrint ? window.AdminPrint.cetakLaporanKomparasi() : (window.cetakLaporanKomparasi ? window.cetakLaporanKomparasi() : null);

document.addEventListener('DOMContentLoaded', () => {
    const modalPengguna = document.getElementById('modalPengguna');
    if (modalPengguna) {
        const formUser = modalPengguna.querySelector('form');
        if (formUser) {
            formUser.onsubmit = function (e) {
                e.preventDefault();
                window.simpanUser(e);
                return false;
            };
        }
        
        const btnSimpan = modalPengguna.querySelector('.btn-success') || modalPengguna.querySelector('button[onclick*="simpan"]');
        if (btnSimpan && !btnSimpan.getAttribute('onclick')) {
            btnSimpan.onclick = (e) => window.simpanUser(e);
        }

        const btnBatal = modalPengguna.querySelector('button[onclick*="reset"]') || modalPengguna.querySelector('.btn-secondary');
        if (btnBatal && !btnBatal.getAttribute('onclick')) {
            btnBatal.onclick = () => window.resetFormUser();
        }
    }

    document.querySelectorAll('.modal-blur-overlay').forEach(overlay => {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) {
                this.style.setProperty('display', 'none', 'important');
            }
        });
    });
});

// =========================================================================
