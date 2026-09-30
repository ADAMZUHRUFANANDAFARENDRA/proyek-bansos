/**
 * Modul: admin-export.js
 * Deskripsi: Ekspor terpadu data warga (Excel XLSX kustom, PDF resmi, Microsoft Word)
 */

// 17. EKSPOR TERPADU (EXCEL, PDF, WORD) SELURUH ARSIP DATA WARGA
// =========================================================================
window.activeExportTab = 'standar';
window.currentExportFormat = 'excel';

window.pilihFormatEksporAktif = function (format) {
    window.currentExportFormat = format;
    const cards = {
        'excel': document.getElementById('cardChoiceExportExcel'),
        'pdf': document.getElementById('cardChoiceExportPdf'),
        'word': document.getElementById('cardChoiceExportWord')
    };

    Object.keys(cards).forEach(k => {
        if (cards[k]) {
            if (k === format) cards[k].classList.add('active');
            else cards[k].classList.remove('active');
        }
    });

    const btn = document.getElementById('btnEksekusiUnduhDokumen');
    const icon = document.getElementById('iconBtnUnduhEkspor');
    const text = document.getElementById('textBtnUnduhEkspor');

    if (btn && icon && text) {
        if (format === 'excel') {
            btn.style.background = '#059669';
            btn.style.borderColor = '#059669';
            btn.style.boxShadow = '0 4px 12px rgba(5,150,105,0.25)';
            icon.className = 'fas fa-file-excel';
            text.innerText = 'Unduh Berkas Excel (.xlsx)';
        } else if (format === 'pdf') {
            btn.style.background = '#dc2626';
            btn.style.borderColor = '#dc2626';
            btn.style.boxShadow = '0 4px 12px rgba(220,38,38,0.25)';
            icon.className = 'fas fa-file-pdf';
            text.innerText = 'Cetak / Unduh Dokumen PDF (.pdf)';
        } else if (format === 'word') {
            btn.style.background = '#2563eb';
            btn.style.borderColor = '#2563eb';
            btn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)';
            icon.className = 'fas fa-file-word';
            text.innerText = 'Unduh Dokumen Word (.docx)';
        }
    }
};

window.bukaModalExportExcel = window.bukaModalExportArsip = function () {
    const dataList = window.globalDataWarga || [];
    const totalEl = document.getElementById('exportStandarTotalRows');
    if (totalEl) totalEl.innerText = `${dataList.length} Baris`;

    window.switchExportTab('standar');
    window.pilihFormatEksporAktif(window.currentExportFormat || 'excel');
    window.renderExportVariableCheckboxes();

    const modal = document.getElementById('modalExportExcel');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.switchExportTab = function (mode) {
    window.activeExportTab = mode;
    const btnStandar = document.getElementById('tabExportStandarBtn');
    const btnKustom = document.getElementById('tabExportKustomBtn');
    const panelStandar = document.getElementById('panelExportStandar');
    const panelKustom = document.getElementById('panelExportKustom');

    if (mode === 'standar') {
        if (btnStandar) { btnStandar.className = 'btn btn-sm btn-primary'; btnStandar.style.background = ''; btnStandar.style.color = ''; }
        if (btnKustom) { btnKustom.className = 'btn btn-sm btn-secondary'; btnKustom.style.background = '#ffffff'; btnKustom.style.color = '#0f172a'; }
        if (panelStandar) panelStandar.style.display = 'block';
        if (panelKustom) panelKustom.style.display = 'none';
    } else {
        if (btnStandar) { btnStandar.className = 'btn btn-sm btn-secondary'; btnStandar.style.background = '#ffffff'; btnStandar.style.color = '#0f172a'; }
        if (btnKustom) { btnKustom.className = 'btn btn-sm btn-primary'; btnKustom.style.background = '#059669'; btnKustom.style.borderColor = '#059669'; btnKustom.style.color = '#ffffff'; }
        if (panelStandar) panelStandar.style.display = 'none';
        if (panelKustom) panelKustom.style.display = 'block';
    }
    window.updateExportSelectedCount();
};

window.renderExportVariableCheckboxes = function () {
    const container = document.getElementById('exportVariableCheckboxesContainer');
    if (!container) return;

    const dataList = window.globalDataWarga || [];
    const detectedKeys = new Set([
        'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'no_hp', 'email',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
        'desil', 'skor_saw', 'rank_saw', 'status_validasi', 'status_salur',
        'nominal_bantuan', 'tanggal_salur', 'lat', 'lng', 'catatan'
    ]);

    // Pindai setiap variabel kustom tambahan yang ada di dataset warga aktif
    dataList.forEach(w => {
        Object.keys(w).forEach(k => {
            if (!['id', 'is_verified', 'is_layak', 'created_at', 'bukti_salur'].includes(k) && !k.startsWith('_')) {
                detectedKeys.add(k);
            }
        });
        if (w.extra_data && typeof w.extra_data === 'object') {
            Object.keys(w.extra_data).forEach(ek => detectedKeys.add(ek));
        }
    });

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
        'catatan': 'Catatan Verifikator'
    };

    container.innerHTML = Array.from(detectedKeys).map(k => {
        const prettyLabel = labelMap[k] || k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
            <label class="export-var-pill" style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:0.8rem; font-weight:600; cursor:pointer; user-select:none;">
                <input type="checkbox" class="export-var-cb" value="${k}" checked onchange="window.updateExportSelectedCount()" style="width:16px; height:16px; accent-color:#059669;">
                <span class="export-var-name" style="color:#1e293b;">${prettyLabel}</span>
            </label>
        `;
    }).join('');

    window.updateExportSelectedCount();
};

window.toggleAllExportVars = function (checked) {
    const cbs = document.querySelectorAll('.export-var-cb');
    cbs.forEach(cb => { cb.checked = Boolean(checked); });
    window.updateExportSelectedCount();
};

window.filterExportVarCheckboxes = function (query) {
    const q = String(query || '').toLowerCase().trim();
    const pills = document.querySelectorAll('.export-var-pill');
    pills.forEach(p => {
        const text = p.innerText.toLowerCase();
        p.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
    });
};

window.updateExportSelectedCount = function () {
    const isStandar = window.activeExportTab === 'standar';
    const countEl = document.getElementById('exportSelectedVarsCount');
    if (isStandar) {
        if (countEl) countEl.innerText = 'Seluruh';
    } else {
        const cbs = document.querySelectorAll('.export-var-cb:checked');
        const totalCbs = document.querySelectorAll('.export-var-cb');
        if (countEl) countEl.innerText = `${cbs.length} dari ${totalCbs.length}`;
    }
};

// Orchestrator utama pengeksporan berdasarkan format aktif (Excel, PDF, Word)
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

// 1. EKSPOR EXCEL (.XLSX) - MENCAKUP SELURUH DATA ARSIP & SELURUH VARIABEL
window.eksekusiUnduhExcelKustom = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga di dalam arsip untuk diekspor.' });
    }

    if (typeof XLSX === 'undefined') {
        return showAdminAlert({ icon: 'error', title: 'Pustaka SheetJS Belum Siap', text: 'Mohon tunggu beberapa detik hingga pustaka Excel selesai dimuat.' });
    }

    const isStandar = window.activeExportTab === 'standar';
    const statusFilter = isStandar
        ? (document.getElementById('exportFilterStatusStandar')?.value || 'all')
        : (document.getElementById('exportFilterStatusKustom')?.value || 'all');

    // Terapkan filter baris
    let filtered = [...dataList];
    if (statusFilter === 'layak') {
        filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    } else if (statusFilter === 'menerima') {
        filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    } else if (statusFilter === 'menunggu') {
        filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    } else if (statusFilter === 'sengketa') {
        filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));
    }

    if (filtered.length === 0) {
        return showAdminAlert({ icon: 'info', title: 'Hasil Filter Kosong', text: 'Tidak ada data warga yang sesuai dengan kriteria filter status yang dipilih.' });
    }

    // Ambil seluruh nama variabel yang ada di arsip
    const allCustomKeys = new Set();
    filtered.forEach(w => {
        if (w.extra_data && typeof w.extra_data === 'object') {
            Object.keys(w.extra_data).forEach(k => allCustomKeys.add(k));
        }
        Object.keys(w).forEach(k => {
            if (!['id', 'is_verified', 'is_layak', 'created_at', 'bukti_salur', 'extra_data', 'custom_fields'].includes(k) && !k.startsWith('_')) {
                allCustomKeys.add(k);
            }
        });
    });

    let rowsToExport = [];
    if (isStandar) {
        // Ekspor seluruh data arsip warga dengan SEMUA variabel (baik 20, 39, 50, atau 100 variabel!)
        rowsToExport = filtered.map((w, idx) => {
            const row = {
                'No': idx + 1,
                'Nomor NIK': String(w.nik),
                'Nama Lengkap Warga': w.nama || '',
                'Tempat Lahir': w.tempat_lahir || 'Sidoarjo',
                'Tanggal Lahir': w.tanggal_lahir || '',
                'Alamat Domisili Lengkap': w.alamat || '',
                'No. WhatsApp / HP': w.no_hp || '',
                'Email': w.email || '',
                'C1 Ekonomi (Penghasilan)': w.c1 || 0,
                'C2 Aset / Rumah': w.c2 || 0,
                'C3 Usia KK': w.c3 || 0,
                'C4 Jenis Kelamin': w.c4 || 1,
                'C5 Tanggungan': w.c5 || 0,
                'C6 Status Kawin': w.c6 || 1,
                'C7 Anak Sekolah': w.c7 || 0,
                'C8 Tempat Tinggal': w.c8 || 1,
                'C9 Pendidikan': w.c9 || 1,
                'C10 Kesehatan': w.c10 || 1,
                'Desil Kemiskinan': w.desil || 5,
                'Skor SPK SAW': typeof w.skor_saw === 'number' ? Number(w.skor_saw.toFixed(4)) : (w.skor_saw || 0),
                'Peringkat Prioritas': w.rank_saw || idx + 1,
                'Status Validasi': w.status_validasi || (w.is_verified ? 'Disetujui' : 'Menunggu'),
                'Status Penyaluran': w.status_salur || 'Belum Salur',
                'Bantuan Ditetapkan': w.nominal_bantuan || 'Beras 10 Kg / Rp 600.000',
                'Waktu Penyaluran': w.tanggal_salur || '-',
                'Garis Lintang': w.lat || '',
                'Garis Bujur': w.lng || '',
                'Catatan Khusus': w.catatan || ''
            };

            // Sertakan seluruh variabel tambahan / dinamis arsip
            allCustomKeys.forEach(ck => {
                const headerName = ck.replace(/_/g, ' ').toUpperCase();
                if (!(headerName in row)) {
                    let val = (w.extra_data && w.extra_data[ck] !== undefined) ? w.extra_data[ck] : w[ck];
                    row[headerName] = val !== undefined && val !== null ? val : '';
                }
            });

            return row;
        });
    } else {
        const selectedCols = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
        if (!selectedCols.length) {
            return showAdminAlert({ icon: 'warning', title: 'Pilih Minimal 1 Kolom', text: 'Silakan centang minimal satu variabel untuk diekspor.' });
        }

        const labelMap = {
            'nik': 'Nomor NIK',
            'nama': 'Nama Lengkap',
            'tempat_lahir': 'Tempat Lahir',
            'tanggal_lahir': 'Tanggal Lahir',
            'alamat': 'Alamat Domisili',
            'no_hp': 'No. WhatsApp/HP',
            'email': 'Email',
            'c1': 'C1 Ekonomi',
            'c2': 'C2 Aset',
            'c3': 'C3 Usia KK',
            'c4': 'C4 Jenis Kelamin',
            'c5': 'C5 Tanggungan',
            'c6': 'C6 Status Kawin',
            'c7': 'C7 Anak Sekolah',
            'c8': 'C8 Tempat Tinggal',
            'c9': 'C9 Pendidikan',
            'c10': 'C10 Kesehatan',
            'desil': 'Desil Kemiskinan',
            'skor_saw': 'Skor SAW',
            'rank_saw': 'Peringkat',
            'status_validasi': 'Status Validasi',
            'status_salur': 'Status Penyaluran',
            'nominal_bantuan': 'Jenis Bantuan',
            'tanggal_salur': 'Waktu Salur',
            'lat': 'Garis Lintang',
            'lng': 'Garis Bujur',
            'catatan': 'Catatan Petugas'
        };

        rowsToExport = filtered.map((w, idx) => {
            const row = { 'No': idx + 1 };
            selectedCols.forEach(col => {
                const headerName = labelMap[col] || col.replace(/_/g, ' ').toUpperCase();
                let val = w[col];
                if (val === undefined && w.extra_data && w.extra_data[col] !== undefined) {
                    val = w.extra_data[col];
                }
                if (col === 'nik') val = String(w.nik);
                row[headerName] = val !== undefined && val !== null ? val : '';
            });
            return row;
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Arsip Warga Bansos");

    const tgl = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `Arsip_Data_Warga_Sidoarjo_${isStandar ? 'Lengkap' : 'Kustom'}_${tgl}.xlsx`;

    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
    window.closeModal('modalExportExcel');
    showAdminAlert({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Berhasil mengekspor ${rowsToExport.length} data arsip ke Excel!`,
        showConfirmButton: false,
        timer: 2200
    });
};

// 2. EKSPOR DOKUMEN PDF RESMI (.PDF)
window.eksekusiUnduhPdfArsip = function () {
    const dataList = window.globalDataWarga || [];
    if (!dataList || dataList.length === 0) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data warga di dalam arsip untuk diekspor.' });
    }

    const isStandar = window.activeExportTab === 'standar';
    const statusFilter = isStandar
        ? (document.getElementById('exportFilterStatusStandar')?.value || 'all')
        : (document.getElementById('exportFilterStatusKustom')?.value || 'all');

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    if (!filtered.length) {
        return showAdminAlert({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada baris data warga yang memenuhi kriteria filter.' });
    }

    const now = new Date();
    const tglResmi = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const noSurat = `460/${String(now.getMonth() + 1).padStart(3, '0')}/DINSOS.SDA/${now.getFullYear()}`;

    const logoHtml = (typeof window.LOGO_SIDOARJO_BASE64 !== 'undefined' && window.LOGO_SIDOARJO_BASE64)
        ? `<img src="${window.LOGO_SIDOARJO_BASE64}" style="width:75px; height:auto; margin-right:16px;">`
        : `<div style="font-size:2.5rem; color:#009846; margin-right:16px;"><i class="fas fa-landmark"></i></div>`;

    // Tentukan Kolom yang Diekspor (Standar vs Kustom Variabel Pilihan)
    let columns = [];
    if (isStandar) {
        columns = [
            { key: 'nik', title: 'Nomor NIK', width: '135px', align: 'left', format: (w) => `<b>${window.safeHtml(String(w.nik))}</b>` },
            { key: 'nama', title: 'Nama Lengkap Warga', align: 'left', format: (w) => `<b>${window.safeHtml(w.nama || '')}</b>` },
            { key: 'alamat', title: 'Alamat Domisili', align: 'left', format: (w) => window.safeHtml(w.alamat || 'Sidoarjo') },
            { key: 'desil', title: 'Desil', width: '60px', align: 'center', format: (w) => `Desil ${w.desil || 5}` },
            { key: 'skor_saw', title: 'Skor SAW', width: '75px', align: 'center', format: (w) => `<span style="color:#009846; font-weight:bold;">${typeof w.skor_saw === 'number' ? w.skor_saw.toFixed(4) : (w.skor_saw || '-')}</span>` },
            { key: 'rank_saw', title: 'Rank', width: '50px', align: 'center', format: (w, idx) => `<b>${w.rank_saw || idx + 1}</b>` },
            { key: 'status_validasi', title: 'Validasi', width: '90px', align: 'center', format: (w) => window.safeHtml(w.status_validasi || (w.is_verified ? 'Disetujui' : 'Menunggu')) },
            { key: 'nominal_bantuan', title: 'Bantuan Ditetapkan', width: '135px', align: 'left', format: (w) => window.safeHtml(w.nominal_bantuan || 'Beras 10 Kg') }
        ];
    } else {
        const selectedCols = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
        if (!selectedCols.length) {
            return showAdminAlert({ icon: 'warning', title: 'Pilih Kolom', text: 'Silakan centang minimal satu kolom untuk diekspor ke PDF.' });
        }
        const labelMap = {
            'nik': 'Nomor NIK', 'nama': 'Nama Lengkap', 'tempat_lahir': 'Tempat Lahir', 'tanggal_lahir': 'Tgl Lahir',
            'alamat': 'Alamat', 'no_hp': 'No. HP', 'email': 'Email', 'c1': 'C1 Ekonomi', 'c2': 'C2 Aset',
            'c3': 'C3 Usia', 'c4': 'C4 JK', 'c5': 'C5 Tanggungan', 'c6': 'C6 Kawin', 'c7': 'C7 Sekolah',
            'c8': 'C8 Rumah', 'c9': 'C9 Pddk', 'c10': 'C10 Sehat', 'desil': 'Desil', 'skor_saw': 'Skor SAW',
            'rank_saw': 'Rank', 'status_validasi': 'Validasi', 'status_salur': 'Status Salur',
            'nominal_bantuan': 'Bantuan', 'catatan': 'Catatan'
        };
        columns = selectedCols.map(c => ({
            key: c,
            title: labelMap[c] || c.replace(/_/g, ' ').toUpperCase(),
            align: ['nik', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'desil', 'skor_saw', 'rank_saw'].includes(c) ? 'center' : 'left',
            format: (w) => {
                let v = w[c];
                if (v === undefined && w.extra_data && w.extra_data[c] !== undefined) v = w.extra_data[c];
                if (c === 'skor_saw' && typeof v === 'number') return v.toFixed(4);
                return window.safeHtml(String(v !== undefined && v !== null ? v : '-'));
            }
        }));
    }

    const tableHeadersHtml = `
        <tr>
            <th style="width: 32px; text-align: center; border: 1px solid #000; padding: 6px; background-color: #f1f5f9; font-size: 10px;">No</th>
            ${columns.map(c => `<th style="${c.width ? `width:${c.width};` : ''} text-align:${c.align}; border: 1px solid #000; padding: 6px; background-color: #f1f5f9; font-size: 10px;">${window.safeHtml(c.title)}</th>`).join('')}
        </tr>
    `;

    const tableRowsHtml = filtered.map((w, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
            <td style="padding: 5px 6px; text-align: center; font-size: 10px; border: 1px solid #94a3b8;">${idx + 1}</td>
            ${columns.map(c => `<td style="padding: 5px 6px; text-align: ${c.align}; font-size: 10px; border: 1px solid #94a3b8;">${c.format(w, idx)}</td>`).join('')}
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return showAdminAlert({ icon: 'warning', title: 'Pop up Terblokir', text: 'Izinkan jendela pop up pada peramban untuk mencetak dokumen PDF resmi.' });
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Resmi Arsip Data Warga - Pemkab Sidoarjo</title>
            <style>
                @page { size: A4 landscape; margin: 10mm 12mm; }
                body { font-family: 'Times New Roman', serif; color: #000; margin: 0; padding: 12px; }
                .kop-header { display: flex; align-items: center; justify-content: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
                .kop-text { text-align: center; }
                .kop-text h2 { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
                .kop-text h3 { margin: 2px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
                .kop-text p { margin: 2px 0 0 0; font-size: 9.5pt; font-family: Arial, sans-serif; }
                .report-title { text-align: center; margin: 12px 0 8px 0; }
                .report-title h4 { margin: 0; font-size: 12pt; text-decoration: underline; text-transform: uppercase; font-weight: bold; }
                .report-title p { margin: 3px 0 0 0; font-size: 9.5pt; font-family: Arial, sans-serif; }
                table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-family: Arial, sans-serif; }
                table.data-table th { font-weight: bold; }
                .ttd-container { display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid; font-family: Arial, sans-serif; }
                @media print {
                    .no-print { display: none !important; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="background:#f1f5f9; padding:10px 16px; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-radius:10px; font-family:Arial, sans-serif;">
                <span style="font-weight:700; color:#334155; font-size:13px;"><i class="fas fa-file-pdf text-danger"></i> Pratinjau Dokumen PDF Resmi (${filtered.length} Data Warga &bull; ${columns.length} Kolom)</span>
                <div>
                    <button onclick="window.print()" style="background:#009846; color:#fff; border:none; padding:8px 20px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">
                        Cetak / Simpan PDF
                    </button>
                    <button onclick="window.close()" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; margin-left:8px;">
                        Tutup
                    </button>
                </div>
            </div>

            <div class="kop-header">
                ${logoHtml}
                <div class="kop-text">
                    <h2>Pemerintah Kabupaten Sidoarjo</h2>
                    <h3>Dinas Sosial</h3>
                    <p>Jl. Pahlawan No. 56, Telp. (031) 8921855, Faks. (031) 8941162 Sidoarjo - 61213<br>Laman Resmi: dinsos.sidoarjokab.go.id | Pos-el: dinsos@sidoarjokab.go.id</p>
                </div>
            </div>

            <div class="report-title">
                <h4>Laporan Rekapitulasi Terpadu Arsip Data Warga</h4>
                <p>Nomor Registrasi Dinas: <b>${noSurat}</b> &bull; Tanggal Ekstraksi: <b>${tglResmi}</b> &bull; Total: <b>${filtered.length} Warga</b></p>
            </div>

            <table class="data-table">
                <thead>
                    ${tableHeadersHtml}
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div class="ttd-container">
                <div style="font-size: 9.5pt; color: #475569;">
                    <p style="margin: 0; font-weight: bold;">Catatan Validasi Sistem:</p>
                    <p style="margin: 2px 0 0 0;">1. Dokumen ini diekspor dari Basis Data Terpadu Pemkab Sidoarjo.</p>
                    <p style="margin: 2px 0 0 0;">2. Keabsahan data terverifikasi sertifikasi elektronik BSrE BSSN.</p>
                </div>
                <div style="text-align: center; width: 260px; font-size: 10.5pt;">
                    <p style="margin: 0;">Sidoarjo, ${tglResmi}</p>
                    <p style="margin: 3px 0 50px 0; font-weight: bold;">Kepala Dinas Sosial Kabupaten Sidoarjo</p>
                    <p style="margin: 0; font-weight: bold; text-decoration: underline;">Dr. Drs. H. Ahmad Misbahul Munir, M.Si</p>
                    <p style="margin: 2px 0 0 0; font-size: 8.5pt;">Pembina Utama Muda &bull; NIP. 19710815 199603 1 003</p>
                </div>
            </div>
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

    const isStandar = window.activeExportTab === 'standar';
    const statusFilter = isStandar
        ? (document.getElementById('exportFilterStatusStandar')?.value || 'all')
        : (document.getElementById('exportFilterStatusKustom')?.value || 'all');

    let filtered = [...dataList];
    if (statusFilter === 'layak') filtered = filtered.filter(w => (w.desil || 5) <= 4 || w.is_verified);
    else if (statusFilter === 'menerima') filtered = filtered.filter(w => w.status_salur === 'Telah Menerima');
    else if (statusFilter === 'menunggu') filtered = filtered.filter(w => !w.is_verified || w.status_validasi === 'Menunggu');
    else if (statusFilter === 'sengketa') filtered = filtered.filter(w => String(w.status_salur || '').toLowerCase().includes('sengketa'));

    if (!filtered.length) {
        return showAdminAlert({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada baris data warga yang memenuhi kriteria filter.' });
    }

    const now = new Date();
    const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const noSurat = `460/${String(now.getMonth() + 1).padStart(3, '0')}/DINSOS.SDA/${now.getFullYear()}`;

    // Tentukan Kolom yang Diekspor
    let columns = [];
    if (isStandar) {
        columns = [
            { key: 'nik', title: 'Nomor NIK', format: (w) => `<b>${window.safeHtml(String(w.nik))}</b>` },
            { key: 'nama', title: 'Nama Lengkap Warga', format: (w) => `<b>${window.safeHtml(w.nama || '')}</b>` },
            { key: 'alamat', title: 'Alamat Domisili', format: (w) => window.safeHtml(w.alamat || 'Sidoarjo') },
            { key: 'desil', title: 'Desil', format: (w) => `Desil ${w.desil || 5}` },
            { key: 'skor_saw', title: 'Skor SAW', format: (w) => `<span style="color:#009846; font-weight:bold;">${typeof w.skor_saw === 'number' ? w.skor_saw.toFixed(4) : (w.skor_saw || '-')}</span>` },
            { key: 'rank_saw', title: 'Rank', format: (w, idx) => `<b>${w.rank_saw || idx + 1}</b>` },
            { key: 'status_validasi', title: 'Validasi', format: (w) => window.safeHtml(w.status_validasi || (w.is_verified ? 'Disetujui' : 'Menunggu')) },
            { key: 'nominal_bantuan', title: 'Bantuan Ditetapkan', format: (w) => window.safeHtml(w.nominal_bantuan || 'Beras 10 Kg') }
        ];
    } else {
        const selectedCols = Array.from(document.querySelectorAll('.export-var-cb:checked')).map(cb => cb.value);
        if (!selectedCols.length) {
            return showAdminAlert({ icon: 'warning', title: 'Pilih Kolom', text: 'Silakan centang minimal satu kolom untuk diekspor ke Word.' });
        }
        const labelMap = {
            'nik': 'Nomor NIK', 'nama': 'Nama Lengkap', 'tempat_lahir': 'Tempat Lahir', 'tanggal_lahir': 'Tgl Lahir',
            'alamat': 'Alamat', 'no_hp': 'No. HP', 'email': 'Email', 'c1': 'C1 Ekonomi', 'c2': 'C2 Aset',
            'c3': 'C3 Usia', 'c4': 'C4 JK', 'c5': 'C5 Tanggungan', 'c6': 'C6 Kawin', 'c7': 'C7 Sekolah',
            'c8': 'C8 Rumah', 'c9': 'C9 Pddk', 'c10': 'C10 Sehat', 'desil': 'Desil', 'skor_saw': 'Skor SAW',
            'rank_saw': 'Rank', 'status_validasi': 'Validasi', 'status_salur': 'Status Salur',
            'nominal_bantuan': 'Bantuan', 'catatan': 'Catatan'
        };
        columns = selectedCols.map(c => ({
            key: c,
            title: labelMap[c] || c.replace(/_/g, ' ').toUpperCase(),
            format: (w) => {
                let v = w[c];
                if (v === undefined && w.extra_data && w.extra_data[c] !== undefined) v = w.extra_data[c];
                if (c === 'skor_saw' && typeof v === 'number') return v.toFixed(4);
                return window.safeHtml(String(v !== undefined && v !== null ? v : '-'));
            }
        }));
    }

    const tableHeaders = `
        <tr>
            <th style="width:30px; background:#009846; color:#ffffff; border:1px solid #000; padding:6px; font-size:10pt;">No</th>
            ${columns.map(c => `<th style="background:#009846; color:#ffffff; border:1px solid #000; padding:6px; font-size:10pt;">${window.safeHtml(c.title)}</th>`).join('')}
        </tr>
    `;

    const tableRows = filtered.map((w, idx) => `
        <tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
            <td style="border:1px solid #94a3b8; padding:6px; text-align:center; font-size:10pt;">${idx + 1}</td>
            ${columns.map(c => `<td style="border:1px solid #94a3b8; padding:6px; font-size:10pt;">${c.format(w, idx)}</td>`).join('')}
        </tr>
    `).join('');

    const wordContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Laporan Arsip Data Warga Pemkab Sidoarjo</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11pt; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #009846; color: #ffffff; border: 1px solid #000; padding: 8px; font-size: 10pt; }
                td { border: 1px solid #94a3b8; padding: 6px; font-size: 10pt; }
            </style>
        </head>
        <body>
            <div style="text-align:center; border-bottom:3px double #000; padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0; font-size:16pt; text-transform:uppercase;">Pemerintah Kabupaten Sidoarjo</h2>
                <h3 style="margin:2px 0; font-size:14pt; text-transform:uppercase;">Dinas Sosial</h3>
                <p style="margin:2px 0 0 0; font-size:9pt;">Jl. Pahlawan No. 56, Sidoarjo - 61213 &bull; Telp. (031) 8921855 &bull; dinsos.sidoarjokab.go.id</p>
            </div>
            <div style="text-align:center; margin-bottom:15px;">
                <h4 style="margin:0; font-size:13pt; text-decoration:underline; text-transform:uppercase;">Rekapitulasi Lengkap Arsip Data Warga</h4>
                <p style="margin:4px 0 0 0; font-size:10pt;">Nomor: ${noSurat} &bull; Tanggal: ${tglStr} &bull; Total: ${filtered.length} Warga Terdaftar &bull; ${columns.length} Variabel</p>
            </div>
            <table>
                <thead>
                    ${tableHeaders}
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <br><br>
            <table style="border:none; width:100%;">
                <tr style="border:none;">
                    <td style="border:none; width:60%;"></td>
                    <td style="border:none; width:40%; text-align:center;">
                        <p style="margin:0;">Sidoarjo, ${tglStr}</p>
                        <p style="margin:4px 0 60px 0; font-weight:bold;">Kepala Dinas Sosial Kabupaten Sidoarjo</p>
                        <p style="margin:0; font-weight:bold; text-decoration:underline;">Dr. Drs. H. Ahmad Misbahul Munir, M.Si</p>
                        <p style="margin:2px 0 0 0; font-size:9pt;">NIP. 19710815 199603 1 003</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arsip_Data_Warga_Sidoarjo_Resmi_${now.toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.closeModal('modalExportExcel');
    showAdminAlert({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Berhasil mengekspor ${filtered.length} data arsip ke dokumen Word!`,
        showConfirmButton: false,
        timer: 2200
    });
};

// =========================================================================
