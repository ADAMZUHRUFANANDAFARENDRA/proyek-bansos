/**
 * Modul: admin-export.js
 * Deskripsi: Ekspor terpadu data arsip warga (Excel XLSX dinamis, PDF resmi, Microsoft Word)
 * Fitur: Penyesuaian luas teks, kop dinas, tata letak, orientasi kertas, auto-fit tipografi,
 *        dan seleksi dinamis seluruh variabel (10, 50, atau >50 variabel otomatis menyesuaikan).
 */

window.currentExportFormat = 'excel';
window.currentExportOrientation = 'landscape';
window.activeExportCategory = 'all';

// Pilihan Format Aktif (Excel, PDF, Word)
window.pilihFormatEksporAktif = function (format) {
    window.currentExportFormat = format;
    const cards = {
        'excel': document.getElementById('cardChoiceExportExcel'),
        'pdf': document.getElementById('cardChoiceExportPdf'),
        'word': document.getElementById('cardChoiceExportWord')
    };

    const statusBadge = document.getElementById('exportFormatBadgeStatus');

    Object.keys(cards).forEach(k => {
        const el = cards[k];
        if (el) {
            if (k === format) {
                el.classList.add('active');
                if (k === 'excel') {
                    el.style.borderColor = '#10b981';
                    el.style.background = '#f0fdf4';
                    el.style.boxShadow = '0 3px 10px rgba(16,185,129,0.2)';
                    if (statusBadge) { statusBadge.className = 'badge badge-green'; statusBadge.innerText = 'Format Aktif: Excel (.xlsx)'; }
                } else if (k === 'pdf') {
                    el.style.borderColor = '#ef4444';
                    el.style.background = '#fef2f2';
                    el.style.boxShadow = '0 3px 10px rgba(239,68,68,0.2)';
                    if (statusBadge) { statusBadge.className = 'badge badge-red'; statusBadge.innerText = 'Format Aktif: Dokumen PDF'; }
                } else if (k === 'word') {
                    el.style.borderColor = '#3b82f6';
                    el.style.background = '#eff6ff';
                    el.style.boxShadow = '0 3px 10px rgba(59,130,246,0.2)';
                    if (statusBadge) { statusBadge.className = 'badge badge-blue'; statusBadge.innerText = 'Format Aktif: Word (.docx)'; }
                }
            } else {
                el.classList.remove('active');
                el.style.borderColor = '#e2e8f0';
                el.style.background = '#ffffff';
                el.style.boxShadow = 'none';
            }
        }
    });

    const btn = document.getElementById('btnEksekusiUnduhDokumen');
    const icon = document.getElementById('iconBtnUnduhEkspor');
    const text = document.getElementById('textBtnUnduhEkspor');

    if (btn && icon && text) {
        if (format === 'excel') {
            btn.style.background = '#009846';
            btn.style.borderColor = '#009846';
            btn.style.boxShadow = '0 4px 12px rgba(0,152,70,0.3)';
            icon.className = 'fas fa-file-excel';
            text.innerText = 'Unduh Berkas Excel (.xlsx)';
        } else if (format === 'pdf') {
            btn.style.background = '#dc2626';
            btn.style.borderColor = '#dc2626';
            btn.style.boxShadow = '0 4px 12px rgba(220,38,38,0.3)';
            icon.className = 'fas fa-file-pdf';
            text.innerText = 'Cetak / Unduh Dokumen PDF (.pdf)';
        } else if (format === 'word') {
            btn.style.background = '#2563eb';
            btn.style.borderColor = '#2563eb';
            btn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)';
            icon.className = 'fas fa-file-word';
            text.innerText = 'Unduh Dokumen Word (.docx)';
        }
    }

    if (document.getElementById('panelExportMainPreview')?.style.display !== 'none') {
        window.updateLivePreview();
    }
};

// Buka Modal Ekspor Data Warga
window.bukaModalExportExcel = window.bukaModalExportArsip = function () {
    const dataList = window.globalDataWarga || [];
    const totalEl = document.getElementById('exportStandarTotalRows');
    if (totalEl) totalEl.innerText = `${dataList.length} Baris`;

    // Inisialisasi tanggal jika belum diisi
    const tglInput = document.getElementById('exportTextTanggal');
    if (tglInput && !tglInput.value) {
        const now = new Date();
        tglInput.value = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    window.switchExportMainTab('variabel');
    window.pilihFormatEksporAktif(window.currentExportFormat || 'excel');
    window.renderExportVariableCheckboxes();

    const modal = document.getElementById('modalExportExcel');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

// Navigasi Antar Tab Pengaturan Ekspor Luas
window.switchExportMainTab = function (tab) {
    const panels = {
        'variabel': document.getElementById('panelExportMainVariabel'),
        'teks': document.getElementById('panelExportMainTeks'),
        'layout': document.getElementById('panelExportMainLayout'),
        'preview': document.getElementById('panelExportMainPreview')
    };
    const buttons = {
        'variabel': document.getElementById('tabExportMainVariabelBtn'),
        'teks': document.getElementById('tabExportMainTeksBtn'),
        'layout': document.getElementById('tabExportMainLayoutBtn'),
        'preview': document.getElementById('tabExportMainPreviewBtn')
    };

    Object.keys(panels).forEach(k => {
        if (panels[k]) panels[k].style.display = k === tab ? 'block' : 'none';
        if (buttons[k]) {
            if (k === tab) {
                buttons[k].style.background = '#009846';
                buttons[k].style.borderColor = '#009846';
                buttons[k].style.color = '#ffffff';
            } else {
                buttons[k].style.background = '#f8fafc';
                buttons[k].style.borderColor = '#cbd5e1';
                buttons[k].style.color = '#475569';
            }
        }
    });

    if (tab === 'preview') {
        window.updateLivePreview();
    }
};

// Pengaturan Orientasi Kertas (Landscape / Portrait)
window.setExportOrientation = function (orient) {
    window.currentExportOrientation = orient;
    const cardLand = document.getElementById('cardOrientLandscape');
    const cardPort = document.getElementById('cardOrientPortrait');

    if (orient === 'landscape') {
        if (cardLand) {
            cardLand.style.border = '1.5px solid #009846';
            cardLand.style.background = '#f0fdf4';
            const r = cardLand.querySelector('input');
            if (r) r.checked = true;
        }
        if (cardPort) {
            cardPort.style.border = '1.5px solid #cbd5e1';
            cardPort.style.background = '#ffffff';
        }
    } else {
        if (cardPort) {
            cardPort.style.border = '1.5px solid #009846';
            cardPort.style.background = '#f0fdf4';
            const r = cardPort.querySelector('input');
            if (r) r.checked = true;
        }
        if (cardLand) {
            cardLand.style.border = '1.5px solid #cbd5e1';
            cardLand.style.background = '#ffffff';
        }
    }
    window.updateLivePreview();
};

// Pindai Seluruh Variabel di Arsip (Otomatis: jika ada 10 maka 10, jika 50 maka 50, jika >50 maka >50)
window.renderExportVariableCheckboxes = function () {
    const container = document.getElementById('exportVariableCheckboxesContainer');
    if (!container) return;

    const dataList = window.globalDataWarga || [];
    
    // Kamus Variabel Standar & Label Resmi
    const labelMap = {
        'nik': { label: 'Nomor NIK (KTP)', cat: 'identitas' },
        'nama': { label: 'Nama Lengkap Warga', cat: 'identitas' },
        'tempat_lahir': { label: 'Tempat Lahir', cat: 'identitas' },
        'tanggal_lahir': { label: 'Tanggal Lahir', cat: 'identitas' },
        'alamat': { label: 'Alamat Domisili Lengkap', cat: 'identitas' },
        'no_hp': { label: 'No. WhatsApp / HP', cat: 'identitas' },
        'email': { label: 'Alamat Email', cat: 'identitas' },
        'lat': { label: 'Garis Lintang (Lat)', cat: 'identitas' },
        'lng': { label: 'Garis Bujur (Lng)', cat: 'identitas' },
        'c1': { label: 'C1 - Penghasilan (Ekonomi)', cat: 'kriteria' },
        'c2': { label: 'C2 - Kondisi Rumah / Aset', cat: 'kriteria' },
        'c3': { label: 'C3 - Usia Kepala Keluarga', cat: 'kriteria' },
        'c4': { label: 'C4 - Jenis Kelamin', cat: 'kriteria' },
        'c5': { label: 'C5 - Jumlah Tanggungan', cat: 'kriteria' },
        'c6': { label: 'C6 - Status Pernikahan', cat: 'kriteria' },
        'c7': { label: 'C7 - Kepemilikan Anak Sekolah', cat: 'kriteria' },
        'c8': { label: 'C8 - Status Tempat Tinggal', cat: 'kriteria' },
        'c9': { label: 'C9 - Tingkat Pendidikan Terakhir', cat: 'kriteria' },
        'c10': { label: 'C10 - Riwayat Kesehatan', cat: 'kriteria' },
        'desil': { label: 'Desil Kemiskinan', cat: 'status' },
        'skor_saw': { label: 'Skor Akhir SPK SAW', cat: 'status' },
        'rank_saw': { label: 'Peringkat Prioritas', cat: 'status' },
        'status_validasi': { label: 'Status Validasi Dinas', cat: 'status' },
        'status_salur': { label: 'Status Penyaluran Bansos', cat: 'status' },
        'nominal_bantuan': { label: 'Jenis / Nominal Bansos', cat: 'status' },
        'tanggal_salur': { label: 'Waktu Penyaluran', cat: 'status' },
        'catatan': { label: 'Catatan Khusus Petugas', cat: 'status' }
    };

    const detectedKeys = new Map();

    // 1. Masukkan seluruh variabel standar dasar
    Object.keys(labelMap).forEach(k => {
        detectedKeys.set(k, {
            key: k,
            label: labelMap[k].label,
            category: labelMap[k].cat,
            isCustom: false
        });
    });

    // 2. Pindai seluruh variabel kustom tambahan / dinamis dari dataset aktif warga
    dataList.forEach(w => {
        Object.keys(w).forEach(k => {
            if (!['id', 'is_verified', 'is_layak', 'created_at', 'bukti_salur', 'keterangan_salur', 'konfirmasi_warga', 'waktu_konfirmasi_warga', 'extra_data', 'custom_fields'].includes(k) && !k.startsWith('_')) {
                if (!detectedKeys.has(k)) {
                    detectedKeys.set(k, {
                        key: k,
                        label: k.replace(/_/g, ' ').toUpperCase(),
                        category: 'kustom',
                        isCustom: true
                    });
                }
            }
        });
        if (w.extra_data && typeof w.extra_data === 'object') {
            Object.keys(w.extra_data).forEach(ek => {
                if (!detectedKeys.has(ek)) {
                    detectedKeys.set(ek, {
                        key: ek,
                        label: ek.replace(/_/g, ' ').toUpperCase(),
                        category: 'kustom',
                        isCustom: true
                    });
                }
            });
        }
    });

    // 3. Masukkan juga header dari impor yang baru saja dimasukkan jika ada
    if (Array.isArray(window.stagedUnifiedHeaders)) {
        window.stagedUnifiedHeaders.forEach(h => {
            if (!h) return;
            const hClean = h.trim();
            if (!detectedKeys.has(hClean)) {
                detectedKeys.set(hClean, {
                    key: hClean,
                    label: hClean.replace(/_/g, ' ').toUpperCase(),
                    category: 'kustom',
                    isCustom: true
                });
            }
        });
    }

    // Perbarui badge jumlah total variabel terdeteksi
    const countBadge = document.getElementById('exportDetectedTotalVars');
    if (countBadge) {
        countBadge.innerText = `${detectedKeys.size} Variabel Terdeteksi`;
    }

    // Render kartu checkbox untuk setiap variabel
    const entries = Array.from(detectedKeys.values());
    container.innerHTML = entries.map((item, idx) => {
        let badgeColor = '#475569';
        let badgeBg = '#f1f5f9';
        if (item.category === 'identitas') { badgeBg = '#ecfdf5'; badgeColor = '#065f46'; }
        else if (item.category === 'kriteria') { badgeBg = '#eff6ff'; badgeColor = '#1d4ed8'; }
        else if (item.category === 'status') { badgeBg = '#fef3c7'; badgeColor = '#92400e'; }
        else { badgeBg = '#faf5ff'; badgeColor = '#7c3aed'; }

        // Cari contoh nilai dari data warga pertama yang memilikinya
        let sampleVal = '';
        for (const w of dataList) {
            let v = w[item.key];
            if (v === undefined && w.extra_data && w.extra_data[item.key] !== undefined) {
                v = w.extra_data[item.key];
            }
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                sampleVal = String(v);
                break;
            }
        }
        if (sampleVal.length > 24) sampleVal = sampleVal.slice(0, 22) + '...';

        return `
            <label class="export-var-pill" data-category="${item.category}" style="display:flex; align-items:flex-start; gap:8px; padding:8px 10px; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; font-size:0.8rem; cursor:pointer; user-select:none; transition:all 0.15s;">
                <input type="checkbox" class="export-var-cb" value="${window.escapeInlineJS(item.key)}" checked onchange="window.updateExportSelectedCount()" style="width:16px; height:16px; accent-color:#009846; margin-top:2px;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
                        <span style="font-size:0.65rem; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:1px 6px; border-radius:4px; text-transform:uppercase;">${item.category}</span>
                        <span class="export-var-name" style="font-weight:800; color:#1e293b; font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.safeHtml(item.label)}</span>
                    </div>
                    <div style="font-size:0.7rem; color:#64748b; font-family:monospace;">
                        ${sampleVal ? `Contoh: <span style="color:#0f172a;">${window.safeHtml(sampleVal)}</span>` : `key: ${window.safeHtml(item.key)}`}
                    </div>
                </div>
            </label>
        `;
    }).join('');

    window.updateExportSelectedCount();
};

// Preset Cepat Seleksi Variabel
window.pilihPresetVariabelEkspor = function (preset) {
    const cbs = document.querySelectorAll('.export-var-cb');
    const coreKeys = new Set(['nik', 'nama', 'alamat', 'c1', 'c2', 'c5', 'desil', 'skor_saw', 'status_validasi', 'nominal_bantuan']);

    cbs.forEach(cb => {
        const val = cb.value;
        const pill = cb.closest('.export-var-pill');
        const cat = pill ? pill.getAttribute('data-category') : '';

        if (preset === 'semua') {
            cb.checked = true;
        } else if (preset === 'inti') {
            cb.checked = coreKeys.has(val);
        } else if (preset === 'kustom') {
            cb.checked = (cat === 'kustom');
        } else if (preset === 'kosong') {
            cb.checked = false;
        }
    });

    window.updateExportSelectedCount();
};

// Filter Tampilan Checkbox Variabel Berdasarkan Kategori
window.filterExportVarCategory = function (cat, btn) {
    window.activeExportCategory = cat;
    document.querySelectorAll('.btn-export-cat-filter').forEach(b => {
        b.style.background = '#ffffff';
        b.style.borderColor = '#cbd5e1';
        b.style.color = '#475569';
    });
    if (btn) {
        btn.style.background = '#009846';
        btn.style.borderColor = '#009846';
        btn.style.color = '#ffffff';
    }

    const query = String(document.getElementById('searchExportVarInput')?.value || '').toLowerCase().trim();
    const pills = document.querySelectorAll('.export-var-pill');

    pills.forEach(p => {
        const pCat = p.getAttribute('data-category');
        const pText = p.innerText.toLowerCase();
        const matchesCat = (cat === 'all' || pCat === cat);
        const matchesQuery = (!query || pText.includes(query));
        p.style.display = (matchesCat && matchesQuery) ? 'flex' : 'none';
    });
};

// Filter Pencarian Teks Variabel
window.filterExportVarCheckboxes = function (query) {
    const q = String(query || '').toLowerCase().trim();
    const cat = window.activeExportCategory || 'all';
    const pills = document.querySelectorAll('.export-var-pill');

    pills.forEach(p => {
        const pCat = p.getAttribute('data-category');
        const pText = p.innerText.toLowerCase();
        const matchesCat = (cat === 'all' || pCat === cat);
        const matchesQuery = (!q || pText.includes(q));
        p.style.display = (matchesCat && matchesQuery) ? 'flex' : 'none';
    });
};

// Perbarui Ringkasan Variabel & Baris Terpilih
window.updateExportSelectedCount = function () {
    const checkedCbs = document.querySelectorAll('.export-var-cb:checked');
    const totalCbs = document.querySelectorAll('.export-var-cb');
    const varsCountEl = document.getElementById('exportSelectedVarsCount');
    const rowsCountEl = document.getElementById('exportSelectedRowsCount');
    const previewMeta = document.getElementById('exportPreviewMetaTag');

    const dataList = window.globalDataWarga || [];
    const statusFilter = document.getElementById('exportFilterStatus')?.value || 'all';

    let filteredRows = [...dataList];
    if (statusFilter === 'layak') {
        filteredRows = filteredRows.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    } else if (statusFilter === 'menerima') {
        filteredRows = filteredRows.filter(w => w.status_salur === 'Telah Menerima');
    } else if (statusFilter === 'menunggu') {
        filteredRows = filteredRows.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    } else if (statusFilter === 'sengketa') {
        filteredRows = filteredRows.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));
    }

    if (varsCountEl) varsCountEl.innerText = `${checkedCbs.length} dari ${totalCbs.length}`;
    if (rowsCountEl) rowsCountEl.innerText = `${filteredRows.length}`;
    if (previewMeta) previewMeta.innerText = `${checkedCbs.length} Kolom Terpilih &bull; ${filteredRows.length} Baris Warga`;

    if (document.getElementById('panelExportMainPreview')?.style.display !== 'none') {
        window.updateLivePreview();
    }
};

// Render Pratinjau Dokumen Langsung (Live Preview)
window.updateLivePreview = function () {
    const container = document.getElementById('exportLivePreviewContainer');
    if (!container) return;

    const dataList = window.globalDataWarga || [];
    const statusFilter = document.getElementById('exportFilterStatus')?.value || 'all';

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    const selectedKeys = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);

    const includeKop = document.getElementById('exportIncludeKop')?.checked !== false;
    const instansi = document.getElementById('exportTextInstansi')?.value || 'PEMERINTAH KABUPATEN SIDOARJO';
    const dinas = document.getElementById('exportTextDinas')?.value || 'DINAS SOSIAL';
    const alamat = document.getElementById('exportTextAlamat')?.value || 'Jl. Pahlawan No. 56, Sidoarjo';
    const judul = document.getElementById('exportTextJudul')?.value || 'LAPORAN REKAPITULASI ARSIP DATA WARGA';
    const subjudul = document.getElementById('exportTextSubjudul')?.value || 'Tahun Anggaran 2026';
    const noSurat = document.getElementById('exportTextNomorSurat')?.value || '460/094/DINSOS.SDA/2026';
    const tgl = document.getElementById('exportTextTanggal')?.value || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const kota = document.getElementById('exportTextKota')?.value || 'Sidoarjo';
    const jabatan = document.getElementById('exportTextJabatan')?.value || 'Kepala Dinas Sosial';
    const pejabat = document.getElementById('exportTextPejabat')?.value || 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si';
    const nip = document.getElementById('exportTextNip')?.value || '19710815 199603 1 003';

    const paper = document.getElementById('exportLayoutPaper')?.value || 'A4';
    const orientation = window.currentExportOrientation || 'landscape';
    const borderStyle = document.getElementById('exportLayoutBorder')?.value || 'formal';
    const watermark = document.getElementById('exportLayoutWatermark')?.checked !== false;

    // Batasi sample pratinjau maksimal 8 baris agar cepat dan mulus
    const sampleRows = filtered.slice(0, 8);

    let borderCss = 'border: 1px solid #000;';
    if (borderStyle === 'halus') borderCss = 'border: 1px solid #cbd5e1;';

    const tableHeadersHtml = `
        <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px; ${borderCss} text-align:center; font-size:9pt; width:35px;">No</th>
            ${selectedKeys.map(k => `
                <th style="padding:6px 8px; ${borderCss} text-align:left; font-size:9pt; white-space:nowrap;">
                    ${window.safeHtml(k.replace(/_/g, ' ').toUpperCase())}
                </th>
            `).join('')}
        </tr>
    `;

    const tableRowsHtml = sampleRows.map((w, idx) => `
        <tr style="${borderStyle === 'striped' && idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
            <td style="padding:5px 8px; ${borderCss} text-align:center; font-size:8.5pt;">${idx + 1}</td>
            ${selectedKeys.map(k => {
                let v = w[k];
                if (v === undefined && w.extra_data && w.extra_data[k] !== undefined) v = w.extra_data[k];
                if (k === 'skor_saw' && typeof v === 'number') v = v.toFixed(4);
                return `<td style="padding:5px 8px; ${borderCss} font-size:8.5pt;">${window.safeHtml(String(v !== undefined && v !== null ? v : '-'))}</td>`;
            }).join('')}
        </tr>
    `).join('');

    container.innerHTML = `
        ${watermark ? `<div style="position:relative;">` : ''}
        ${watermark ? `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.04; font-size:3.5rem; font-weight:900; transform:rotate(-25deg); pointer-events:none; user-select:none;">PEMKAB SIDOARJO</div>` : ''}
        
        ${includeKop ? `
            <div style="text-align:center; border-bottom:3px double #000; padding-bottom:8px; margin-bottom:12px;">
                <h3 style="margin:0; font-size:14pt; letter-spacing:0.5px; text-transform:uppercase;">${window.safeHtml(instansi)}</h3>
                <h2 style="margin:2px 0; font-size:16pt; font-weight:900; letter-spacing:0.8px; text-transform:uppercase;">${window.safeHtml(dinas)}</h2>
                <p style="margin:2px 0 0 0; font-size:8.5pt; color:#333;">${window.safeHtml(alamat)}</p>
            </div>
        ` : ''}

        <div style="text-align:center; margin-bottom:12px;">
            <h4 style="margin:0; font-size:12pt; text-decoration:underline; font-weight:800; text-transform:uppercase;">${window.safeHtml(judul)}</h4>
            <p style="margin:3px 0 0 0; font-size:9pt; color:#475569;">${window.safeHtml(subjudul)}</p>
            <p style="margin:2px 0 0 0; font-size:8pt; color:#64748b; font-family:monospace;">Nomor: ${window.safeHtml(noSurat)} &bull; Tanggal: ${window.safeHtml(tgl)} &bull; Kertas: ${paper} (${orientation})</p>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
                <thead>${tableHeadersHtml}</thead>
                <tbody>${tableRowsHtml}</tbody>
            </table>
        </div>

        ${filtered.length > 8 ? `
            <div style="text-align:center; font-size:8pt; color:#64748b; margin-bottom:14px; font-style:italic;">
                ... dan ${filtered.length - 8} baris data warga lainnya akan diekspor secara utuh ke dalam berkas resmi.
            </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <div style="text-align:center; width:260px;">
                <div style="font-size:9pt;">${window.safeHtml(kota)}, ${window.safeHtml(tgl)}</div>
                <div style="font-size:9pt; font-weight:bold; margin-top:2px;">${window.safeHtml(jabatan)}</div>
                <div style="height:45px;"></div>
                <div style="font-size:9.5pt; font-weight:bold; text-decoration:underline;">${window.safeHtml(pejabat)}</div>
                <div style="font-size:8pt; font-family:monospace; margin-top:2px;">NIP. ${window.safeHtml(nip)}</div>
            </div>
        </div>

        ${watermark ? `</div>` : ''}
    `;
};

// Eksekutor Utama Berdasarkan Format Terpilih
window.eksekusiUnduhDokumenArsip = function () {
    const format = window.currentExportFormat || 'excel';
    if (format === 'pdf') {
        return window.eksekusiUnduhPdfArsip();
    } else if (format === 'word') {
        return window.eksekusiUnduhWordArsip();
    } else {
        return window.eksekusiUnduhExcelKustom();
    }
};

// 1. EKSPOR EXCEL (.XLSX) MENCAKUP SELURUH DATA & VARIABEL TERPILIH
window.eksekusiUnduhExcelKustom = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga di dalam arsip untuk diekspor.' });
    }

    if (typeof XLSX === 'undefined') {
        return showAdminAlert({ icon: 'error', title: 'Pustaka Excel Belum Siap', text: 'Mohon tunggu beberapa detik hingga pustaka SheetJS selesai dimuat.' });
    }

    const statusFilter = document.getElementById('exportFilterStatus')?.value || 'all';

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    if (filtered.length === 0) {
        return showAdminAlert({ icon: 'info', title: 'Hasil Filter Kosong', text: 'Tidak ada data warga yang memenuhi kriteria filter status yang dipilih.' });
    }

    const selectedKeys = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
    if (!selectedKeys.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Minimal 1 Variabel', text: 'Silakan centang minimal satu kolom/variabel untuk diekspor ke Excel.' });
    }

    const rowsToExport = filtered.map((w, idx) => {
        const row = { 'No': idx + 1 };
        selectedKeys.forEach(k => {
            const headerTitle = k.replace(/_/g, ' ').toUpperCase();
            let val = w[k];
            if (val === undefined && w.extra_data && w.extra_data[k] !== undefined) {
                val = w.extra_data[k];
            }
            if (k === 'nik') val = String(w.nik);
            if (k === 'skor_saw' && typeof val === 'number') val = Number(val.toFixed(4));
            row[headerTitle] = val !== undefined && val !== null ? val : '';
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rowsToExport);

    // Hitung lebar kolom otomatis agar rapi
    const colWidths = [{ wch: 6 }];
    selectedKeys.forEach(k => {
        const headerTitle = k.replace(/_/g, ' ').toUpperCase();
        let maxLen = headerTitle.length;
        rowsToExport.slice(0, 50).forEach(r => {
            const v = String(r[headerTitle] || '');
            if (v.length > maxLen) maxLen = v.length;
        });
        colWidths.push({ wch: Math.min(45, Math.max(maxLen + 2, 10)) });
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Arsip Warga Bansos");

    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `Arsip_Data_Warga_Sidoarjo_${selectedKeys.length}Var_${tgl}.xlsx`;

    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
    window.closeModal('modalExportExcel');

    showAdminAlert({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Berhasil mengekspor ${rowsToExport.length} data dengan ${selectedKeys.length} variabel ke Excel!`,
        showConfirmButton: false,
        timer: 2400
    });
};

// 2. EKSPOR DOKUMEN PDF RESMI DENGAN AUTO-FIT TIPOGRAFI & ORIENTASI
window.eksekusiUnduhPdfArsip = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga di dalam arsip untuk diekspor.' });
    }

    const statusFilter = document.getElementById('exportFilterStatus')?.value || 'all';

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    if (!filtered.length) {
        return showAdminAlert({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada baris data warga yang memenuhi kriteria filter.' });
    }

    const selectedKeys = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
    if (!selectedKeys.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Kolom', text: 'Silakan centang minimal satu variabel untuk diekspor ke PDF.' });
    }

    const includeKop = document.getElementById('exportIncludeKop')?.checked !== false;
    const instansi = document.getElementById('exportTextInstansi')?.value || 'PEMERINTAH KABUPATEN SIDOARJO';
    const dinas = document.getElementById('exportTextDinas')?.value || 'DINAS SOSIAL';
    const alamat = document.getElementById('exportTextAlamat')?.value || 'Jl. Pahlawan No. 56, Sidoarjo - 61213';
    const judul = document.getElementById('exportTextJudul')?.value || 'LAPORAN REKAPITULASI ARSIP DATA WARGA';
    const subjudul = document.getElementById('exportTextSubjudul')?.value || 'Tahun Anggaran 2026';
    const noSurat = document.getElementById('exportTextNomorSurat')?.value || '460/094/DINSOS.SDA/2026';
    const tgl = document.getElementById('exportTextTanggal')?.value || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const kota = document.getElementById('exportTextKota')?.value || 'Sidoarjo';
    const jabatan = document.getElementById('exportTextJabatan')?.value || 'Kepala Dinas Sosial';
    const pejabat = document.getElementById('exportTextPejabat')?.value || 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si';
    const nip = document.getElementById('exportTextNip')?.value || '19710815 199603 1 003';

    const paper = document.getElementById('exportLayoutPaper')?.value || 'A4';
    const orientation = window.currentExportOrientation || 'landscape';
    const margin = document.getElementById('exportLayoutMargin')?.value || '8mm';
    const borderStyle = document.getElementById('exportLayoutBorder')?.value || 'formal';
    const watermark = document.getElementById('exportLayoutWatermark')?.checked !== false;

    // Hitung ukuran font secara otomatis berdasarkan jumlah kolom agar muat rapi tanpa terpotong
    let fontSize = document.getElementById('exportLayoutFontSize')?.value || 'auto';
    if (fontSize === 'auto') {
        const colCount = selectedKeys.length;
        if (colCount > 35) fontSize = '6.5pt';
        else if (colCount > 20) fontSize = '7.5pt';
        else if (colCount > 12) fontSize = '8.5pt';
        else if (colCount > 7) fontSize = '9.5pt';
        else fontSize = '10.5pt';
    } else {
        fontSize = `${fontSize}pt`;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return showAdminAlert({ icon: 'warning', title: 'Pop up Terblokir', text: 'Izinkan jendela pop up pada peramban untuk mencetak dokumen PDF resmi.' });
    }

    const tableHeadersHtml = `
        <tr>
            <th style="width:28px; text-align:center; padding:5px 4px; background:#f1f5f9; border:1px solid #000; font-size:${fontSize};">No</th>
            ${selectedKeys.map(k => `
                <th style="padding:5px 6px; text-align:left; background:#f1f5f9; border:1px solid #000; font-size:${fontSize}; white-space:nowrap;">
                    ${window.safeHtml(k.replace(/_/g, ' ').toUpperCase())}
                </th>
            `).join('')}
        </tr>
    `;

    const tableRowsHtml = filtered.map((w, idx) => `
        <tr style="${borderStyle === 'striped' && idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
            <td style="padding:4px 4px; text-align:center; border:1px solid ${borderStyle === 'halus' ? '#94a3b8' : '#000'}; font-size:${fontSize};">${idx + 1}</td>
            ${selectedKeys.map(k => {
                let v = w[k];
                if (v === undefined && w.extra_data && w.extra_data[k] !== undefined) v = w.extra_data[k];
                if (k === 'skor_saw' && typeof v === 'number') v = v.toFixed(4);
                return `<td style="padding:4px 6px; border:1px solid ${borderStyle === 'halus' ? '#94a3b8' : '#000'}; font-size:${fontSize};">${window.safeHtml(String(v !== undefined && v !== null ? v : '-'))}</td>`;
            }).join('')}
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Laporan Resmi Arsip Data Warga - Pemkab Sidoarjo</title>
            <style>
                @page {
                    size: ${paper} ${orientation};
                    margin: ${margin};
                }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    margin: 0;
                    padding: 0;
                    color: #000;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .kop-header {
                    text-align: center;
                    border-bottom: 3px double #000;
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                }
                .doc-title {
                    text-align: center;
                    margin-bottom: 12px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 16px;
                }
                th, td {
                    word-break: break-word;
                }
                .ttd-box {
                    float: right;
                    width: 280px;
                    text-align: center;
                    page-break-inside: avoid;
                }
                ${watermark ? `
                    .watermark {
                        position: fixed;
                        top: 40%;
                        left: 10%;
                        width: 80%;
                        text-align: center;
                        font-size: 55pt;
                        font-weight: 900;
                        color: rgba(0, 0, 0, 0.04);
                        transform: rotate(-25deg);
                        z-index: -1;
                        pointer-events: none;
                    }
                ` : ''}
            </style>
        </head>
        <body>
            ${watermark ? `<div class="watermark">PEMKAB SIDOARJO</div>` : ''}

            ${includeKop ? `
                <div class="kop-header">
                    <h3 style="margin:0; font-size:13pt; text-transform:uppercase; letter-spacing:0.5px;">${window.safeHtml(instansi)}</h3>
                    <h2 style="margin:2px 0; font-size:16pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.8px;">${window.safeHtml(dinas)}</h2>
                    <p style="margin:2px 0 0 0; font-size:9pt;">${window.safeHtml(alamat)}</p>
                </div>
            ` : ''}

            <div class="doc-title">
                <h4 style="margin:0; font-size:12pt; text-decoration:underline; font-weight:bold; text-transform:uppercase;">${window.safeHtml(judul)}</h4>
                <p style="margin:3px 0 0 0; font-size:9.5pt;">${window.safeHtml(subjudul)}</p>
                <p style="margin:2px 0 0 0; font-size:8.5pt;">Nomor: ${window.safeHtml(noSurat)} &bull; Tanggal: ${window.safeHtml(tgl)} &bull; Total: ${filtered.length} Data Warga (${selectedKeys.length} Variabel)</p>
            </div>

            <table>
                <thead>${tableHeadersHtml}</thead>
                <tbody>${tableRowsHtml}</tbody>
            </table>

            <div style="width:100%; overflow:hidden; margin-top:20px;">
                <div class="ttd-box">
                    <div style="font-size:9.5pt;">${window.safeHtml(kota)}, ${window.safeHtml(tgl)}</div>
                    <div style="font-size:9.5pt; font-weight:bold; margin-top:2px;">${window.safeHtml(jabatan)}</div>
                    <div style="height:55px;"></div>
                    <div style="font-size:10pt; font-weight:bold; text-decoration:underline;">${window.safeHtml(pejabat)}</div>
                    <div style="font-size:8.5pt; margin-top:2px;">NIP. ${window.safeHtml(nip)}</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
    window.closeModal('modalExportExcel');
};

// 3. EKSPOR DOKUMEN MICROSOFT WORD (.DOCX / .DOC)
window.eksekusiUnduhWordArsip = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga di dalam arsip untuk diekspor.' });
    }

    const statusFilter = document.getElementById('exportFilterStatus')?.value || 'all';

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    if (!filtered.length) {
        return showAdminAlert({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada baris data warga yang memenuhi kriteria filter.' });
    }

    const selectedKeys = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
    if (!selectedKeys.length) {
        return showAdminAlert({ icon: 'warning', title: 'Pilih Kolom', text: 'Silakan centang minimal satu kolom untuk diekspor ke Word.' });
    }

    const includeKop = document.getElementById('exportIncludeKop')?.checked !== false;
    const instansi = document.getElementById('exportTextInstansi')?.value || 'PEMERINTAH KABUPATEN SIDOARJO';
    const dinas = document.getElementById('exportTextDinas')?.value || 'DINAS SOSIAL';
    const alamat = document.getElementById('exportTextAlamat')?.value || 'Jl. Pahlawan No. 56, Sidoarjo - 61213';
    const judul = document.getElementById('exportTextJudul')?.value || 'LAPORAN REKAPITULASI ARSIP DATA WARGA';
    const subjudul = document.getElementById('exportTextSubjudul')?.value || 'Tahun Anggaran 2026';
    const noSurat = document.getElementById('exportTextNomorSurat')?.value || '460/094/DINSOS.SDA/2026';
    const tgl = document.getElementById('exportTextTanggal')?.value || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const kota = document.getElementById('exportTextKota')?.value || 'Sidoarjo';
    const jabatan = document.getElementById('exportTextJabatan')?.value || 'Kepala Dinas Sosial';
    const pejabat = document.getElementById('exportTextPejabat')?.value || 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si';
    const nip = document.getElementById('exportTextNip')?.value || '19710815 199603 1 003';
    const orientation = window.currentExportOrientation || 'landscape';

    const tableHeaders = `
        <tr>
            <th style="width:30px; background:#009846; color:#ffffff; border:1px solid #000; padding:6px; font-size:9.5pt;">No</th>
            ${selectedKeys.map(k => `
                <th style="background:#009846; color:#ffffff; border:1px solid #000; padding:6px; font-size:9.5pt;">
                    ${window.safeHtml(k.replace(/_/g, ' ').toUpperCase())}
                </th>
            `).join('')}
        </tr>
    `;

    const tableRows = filtered.map((w, idx) => `
        <tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
            <td style="border:1px solid #94a3b8; padding:5px; text-align:center; font-size:9.5pt;">${idx + 1}</td>
            ${selectedKeys.map(k => {
                let v = w[k];
                if (v === undefined && w.extra_data && w.extra_data[k] !== undefined) v = w.extra_data[k];
                if (k === 'skor_saw' && typeof v === 'number') v = v.toFixed(4);
                return `<td style="border:1px solid #94a3b8; padding:5px; font-size:9.5pt;">${window.safeHtml(String(v !== undefined && v !== null ? v : '-'))}</td>`;
            }).join('')}
        </tr>
    `).join('');

    const wordContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${window.safeHtml(judul)}</title>
            <style>
                @page Section1 {
                    size: 841.9pt 595.3pt;
                    mso-page-orientation: ${orientation};
                    margin: 1.5cm 1.5cm 1.5cm 1.5cm;
                    mso-header-margin: 36.0pt;
                    mso-footer-margin: 36.0pt;
                }
                div.Section1 { page: Section1; }
                body { font-family: Arial, sans-serif; font-size: 10.5pt; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #009846; color: #ffffff; border: 1px solid #000; padding: 6px; font-size: 9.5pt; }
                td { border: 1px solid #94a3b8; padding: 5px; font-size: 9.5pt; }
            </style>
        </head>
        <body>
            <div class="Section1">
                ${includeKop ? `
                    <div style="text-align:center; border-bottom:3px double #000; padding-bottom:10px; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:14pt; text-transform:uppercase;">${window.safeHtml(instansi)}</h3>
                        <h2 style="margin:2px 0; font-size:16pt; text-transform:uppercase;">${window.safeHtml(dinas)}</h2>
                        <p style="margin:2px 0 0 0; font-size:9pt;">${window.safeHtml(alamat)}</p>
                    </div>
                ` : ''}

                <div style="text-align:center; margin-bottom:14px;">
                    <h4 style="margin:0; font-size:13pt; text-decoration:underline; text-transform:uppercase;">${window.safeHtml(judul)}</h4>
                    <p style="margin:3px 0 0 0; font-size:10pt;">${window.safeHtml(subjudul)}</p>
                    <p style="margin:2px 0 0 0; font-size:9pt;">Nomor: ${window.safeHtml(noSurat)} &bull; Tanggal: ${window.safeHtml(tgl)} &bull; Total: ${filtered.length} Warga Terdaftar &bull; ${selectedKeys.length} Variabel</p>
                </div>

                <table>
                    <thead>${tableHeaders}</thead>
                    <tbody>${tableRows}</tbody>
                </table>

                <br><br>
                <table style="border:none; width:100%;">
                    <tr style="border:none;">
                        <td style="border:none; width:60%;"></td>
                        <td style="border:none; width:40%; text-align:center;">
                            <p style="margin:0; font-size:10pt;">${window.safeHtml(kota)}, ${window.safeHtml(tgl)}</p>
                            <p style="margin:3px 0 50px 0; font-weight:bold; font-size:10pt;">${window.safeHtml(jabatan)}</p>
                            <p style="margin:0; font-weight:bold; text-decoration:underline; font-size:10.5pt;">${window.safeHtml(pejabat)}</p>
                            <p style="margin:2px 0 0 0; font-size:8.5pt;">NIP. ${window.safeHtml(nip)}</p>
                        </td>
                    </tr>
                </table>
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arsip_Data_Warga_Sidoarjo_Resmi_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.closeModal('modalExportExcel');
    showAdminAlert({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Berhasil mengekspor ${filtered.length} data warga ke dokumen Word!`,
        showConfirmButton: false,
        timer: 2400
    });
};
