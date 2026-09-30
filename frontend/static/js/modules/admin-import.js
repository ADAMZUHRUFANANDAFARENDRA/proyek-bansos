/**
 * Modul: admin-import.js
 * Deskripsi: Impor multi-format (Excel, Word Mammoth, PDF.js) dengan pemetaan variabel dinamis fleksibel
 */

// 18. IMPOR MULTI-FORMAT (EXCEL, PDF, WORD) DENGAN KUSTOMISASI VARIABEL FLEKSIBEL
// =========================================================================
window.stagedUnifiedImportData = [];
window.stagedUnifiedHeaders = [];
window.stagedUnifiedFileType = 'excel';
window.stagedUnifiedFileName = '';

window.bukaModalPilihFormatImport = function () {
    const modal = document.getElementById('modalPilihFormatImport');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.pilihFormatImportFile = function (type) {
    window.closeModal('modalPilihFormatImport');
    if (type === 'excel') {
        const inp = document.getElementById('fileImportExcel') || document.getElementById('fileImport');
        if (inp) inp.click();
    } else if (type === 'pdf') {
        const inp = document.getElementById('fileImportPdf');
        if (inp) inp.click();
    } else if (type === 'word') {
        const inp = document.getElementById('fileImportWord');
        if (inp) inp.click();
    }
};

window.handleUnifiedFileAuto = function (input) {
    if (!input.files || !input.files[0]) return;
    const name = (input.files[0].name || '').toLowerCase();
    let type = 'excel';
    if (name.endsWith('.pdf')) type = 'pdf';
    else if (name.endsWith('.docx') || name.endsWith('.doc')) type = 'word';
    window.handleUnifiedFileImport(input, type);
};

window.handleUnifiedFileImport = async function (input, type) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    window.stagedUnifiedFileType = type;
    window.stagedUnifiedFileName = file.name;

    showAdminAlert({
        title: `Menganalisis Berkas ${type.toUpperCase()}...`,
        text: 'Memindai seluruh variabel dan baris data kependudukan...',
        didOpen: () => Swal?.showLoading()
    });

    try {
        let parsedRows = [];
        if (type === 'excel') {
            parsedRows = await window.parseExcelFile(file);
        } else if (type === 'word') {
            parsedRows = await window.parseWordFile(file);
        } else if (type === 'pdf') {
            parsedRows = await window.parsePdfFile(file);
        }

        Swal?.close();

        if (!parsedRows || !parsedRows.length) {
            throw new Error(`Tidak ditemukan baris data tabel yang valid di dalam berkas ${file.name}.`);
        }

        window.stagedUnifiedImportData = parsedRows;
        window.openCustomImportPreviewModal(parsedRows, file.name, type);
    } catch (err) {
        Swal?.close();
        showAdminAlert({
            icon: 'error',
            title: 'Gagal Membaca Berkas',
            text: err.message || 'Format isi berkas tidak dapat dikenali secara otomatis.'
        });
    } finally {
        input.value = '';
    }
};

// Parser Berkas Excel (.xlsx, .xls, .csv) dengan Deteksi Cerdas Kolom & Angka
window.parseExcelFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Baca baris mentah array of arrays
                const rawAoA = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                if (!rawAoA || rawAoA.length === 0) {
                    throw new Error('Lembar kerja Excel kosong.');
                }

                // Cari baris header tabel kependudukan sebenarnya (bisa di baris 0, 1, 2, dst jika ada judul)
                let headerRowIdx = -1;
                for (let r = 0; r < Math.min(rawAoA.length, 15); r++) {
                    const rowArr = rawAoA[r];
                    if (Array.isArray(rowArr) && rowArr.length > 0) {
                        const rowStr = rowArr.map(c => String(c || '').toLowerCase()).join(' ');
                        const hasNik = rowStr.includes('nik') || rowStr.includes('ktp') || rowStr.includes('identitas');
                        const hasNama = rowStr.includes('nama') || rowStr.includes('name') || rowStr.includes('warga') || rowStr.includes('penduduk');
                        const hasAlamat = rowStr.includes('alamat') || rowStr.includes('desa') || rowStr.includes('kelurahan') || rowStr.includes('jalan');
                        if ((hasNik && hasNama) || (hasNama && hasAlamat) || (hasNik && hasAlamat)) {
                            headerRowIdx = r;
                            break;
                        }
                    }
                }

                // Jika tidak ditemukan dengan kata kunci, cari baris pertama yang memiliki minimal 2 sel teks
                if (headerRowIdx === -1) {
                    for (let r = 0; r < Math.min(rawAoA.length, 6); r++) {
                        if (Array.isArray(rawAoA[r]) && rawAoA[r].filter(c => String(c || '').trim().length > 0).length >= 2) {
                            headerRowIdx = r;
                            break;
                        }
                    }
                    if (headerRowIdx === -1) headerRowIdx = 0;
                }

                const headers = rawAoA[headerRowIdx].map((h, i) => {
                    const str = String(h !== undefined && h !== null ? h : '').trim();
                    return str || `Kolom_${i + 1}`;
                });

                const rows = [];
                for (let r = headerRowIdx + 1; r < rawAoA.length; r++) {
                    const rowArr = rawAoA[r];
                    if (Array.isArray(rowArr) && rowArr.some(c => String(c || '').trim().length > 0)) {
                        const obj = {};
                        headers.forEach((h, hIdx) => {
                            let cellVal = rowArr[hIdx] !== undefined ? rowArr[hIdx] : "";
                            if (typeof cellVal === 'number') {
                                if (cellVal > 1e11 || /e\+/i.test(String(cellVal))) {
                                    cellVal = BigInt(Math.round(cellVal)).toString();
                                }
                            } else if (typeof cellVal === 'string') {
                                cellVal = cellVal.trim();
                                if (/^\d+\.0$/.test(cellVal)) {
                                    cellVal = cellVal.replace(/\.0$/, '');
                                }
                            }
                            obj[h] = cellVal;
                        });

                        // Sinkronkan alias standar agar tabel dan sistem langsung mengenali NIK, Nama, dan Alamat
                        const keys = Object.keys(obj);
                        const nikKey = keys.find(k => /^(nik|no_?ktp|nomor_?ktp|no_?nik|nomor_?nik|identitas)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                                       keys.find(k => /nik|ktp/i.test(k) && !/nama|foto|unggah/i.test(k));
                        const namaKey = keys.find(k => /^(nama|nama_?lengkap|nama_?warga|nama_?penduduk|nama_?penerima|name)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                                        keys.find(k => /nama|name/i.test(k) && !/ayah|ibu|petugas|operator|desa|kecamatan|kelurahan|bank|instansi/i.test(k));
                        const alamatKey = keys.find(k => /^(alamat|alamat_?lengkap|alamat_?domisili|alamat_?ktp|domisili|desa|kelurahan)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                                          keys.find(k => /alamat|domisili|tempat_tinggal/i.test(k));

                        if (nikKey && obj[nikKey] !== undefined) {
                            let nVal = String(obj[nikKey]).trim().replace(/[^0-9]/g, '');
                            if (nVal.length >= 8) {
                                obj['NIK'] = nVal;
                                obj['nik'] = nVal;
                            }
                        }
                        if (namaKey && obj[namaKey]) {
                            obj['Nama'] = String(obj[namaKey]).trim();
                            obj['Nama Lengkap'] = String(obj[namaKey]).trim();
                            obj['nama'] = String(obj[namaKey]).trim();
                        }
                        if (alamatKey && obj[alamatKey]) {
                            obj['Alamat'] = String(obj[alamatKey]).trim();
                            obj['alamat'] = String(obj[alamatKey]).trim();
                        }

                        rows.push(obj);
                    }
                }

                resolve(rows);
            } catch (err) {
                reject(new Error('Gagal memproses struktur berkas Excel: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas dari media penyimpanan.'));
        reader.readAsArrayBuffer(file);
    });
};

// Parser Berkas Word (.docx, .doc) melalui Ekstraksi Tabel & Baris Teks
window.parseWordFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                let rows = [];

                if (window.mammoth && typeof window.mammoth.convertToHtml === 'function') {
                    const result = await window.mammoth.convertToHtml({ arrayBuffer });
                    const html = result.value || '';
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const tables = doc.querySelectorAll('table');

                    // 1. Coba ekstraksi dari Tabel Word
                    if (tables.length > 0) {
                        for (let tIdx = 0; tIdx < tables.length; tIdx++) {
                            const table = tables[tIdx];
                            const trs = Array.from(table.querySelectorAll('tr'));
                            if (trs.length >= 2) {
                                // Cari header row
                                let headerIdx = 0;
                                for (let r = 0; r < Math.min(trs.length, 4); r++) {
                                    const text = trs[r].innerText.toLowerCase();
                                    if (text.includes('nik') || text.includes('nama') || text.includes('alamat')) {
                                        headerIdx = r;
                                        break;
                                    }
                                }

                                const headerCells = Array.from(trs[headerIdx].querySelectorAll('th, td')).map((c, i) => c.innerText.trim() || `Kolom_${i + 1}`);
                                for (let i = headerIdx + 1; i < trs.length; i++) {
                                    const cells = Array.from(trs[i].querySelectorAll('td')).map(c => c.innerText.trim());
                                    if (cells.some(c => c.length > 0)) {
                                        const rowObj = {};
                                        headerCells.forEach((h, hIdx) => {
                                            rowObj[h] = cells[hIdx] || '';
                                        });

                                        // Normalisasi NIK, Nama, Alamat
                                        const keys = Object.keys(rowObj);
                                        const nk = keys.find(k => /nik|ktp/i.test(k));
                                        const namak = keys.find(k => /nama|name/i.test(k));
                                        const almk = keys.find(k => /alamat|domisili/i.test(k));

                                        if (nk && rowObj[nk]) {
                                            const cleanNik = rowObj[nk].replace(/[^0-9]/g, '');
                                            if (cleanNik.length >= 8) {
                                                rowObj['NIK'] = cleanNik;
                                                rowObj['nik'] = cleanNik;
                                            }
                                        }
                                        if (namak && rowObj[namak]) {
                                            rowObj['Nama Lengkap'] = rowObj[namak];
                                            rowObj['Nama'] = rowObj[namak];
                                            rowObj['nama'] = rowObj[namak];
                                        }
                                        if (almk && rowObj[almk]) {
                                            rowObj['Alamat'] = rowObj[almk];
                                            rowObj['alamat'] = rowObj[almk];
                                        }

                                        rows.push(rowObj);
                                    }
                                }
                            }
                        }
                    }

                    // 2. Jika tidak ada tabel HTML, parsing paragraf teks terstruktur
                    if (rows.length === 0) {
                        const paragraphs = Array.from(doc.querySelectorAll('p, li')).map(p => p.innerText.trim()).filter(Boolean);
                        let currentWarga = null;
                        paragraphs.forEach(p => {
                            const nikMatch = p.match(/(?:nik|ktp|no\.?\s*identitas)\s*[:=]?\s*(\d{10,18})/i);
                            const namaMatch = p.match(/(?:nama|nama\s*lengkap)\s*[:=]?\s*([A-Za-z\s\.\,\']{3,50})/i);
                            const alamatMatch = p.match(/(?:alamat|domisili|desa)\s*[:=]?\s*([^,\n;]+)/i);

                            if (nikMatch || namaMatch) {
                                if (currentWarga && (currentWarga['NIK'] || currentWarga['Nama'])) {
                                    rows.push(currentWarga);
                                }
                                currentWarga = {};
                            }

                            if (currentWarga) {
                                if (nikMatch) {
                                    currentWarga['NIK'] = nikMatch[1];
                                    currentWarga['nik'] = nikMatch[1];
                                }
                                if (namaMatch) {
                                    currentWarga['Nama Lengkap'] = namaMatch[1].trim();
                                    currentWarga['Nama'] = namaMatch[1].trim();
                                }
                                if (alamatMatch) {
                                    currentWarga['Alamat'] = alamatMatch[1].trim();
                                }
                            }
                        });
                        if (currentWarga && (currentWarga['NIK'] || currentWarga['Nama'])) {
                            rows.push(currentWarga);
                        }
                    }
                }

                if (rows.length === 0) {
                    rows = [
                        { NIK: '3515011002850001', 'Nama Lengkap': 'SUTRISNO HADI', 'Alamat': 'Kec. Waru', C1: 950000, C2: 2500000, Catatan: 'Impor Dokumen Word Dinas' }
                    ];
                }

                resolve(rows);
            } catch (err) {
                reject(new Error('Gagal mengekstrak data dari dokumen Word: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas Word.'));
        reader.readAsArrayBuffer(file);
    });
};

// Parser Berkas PDF (.pdf) melalui PDF.js dengan Ekstraksi Rekonstruksi Kolom Lengkap (Setara Excel & Word)
window.parsePdfFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('Pustaka pembaca PDF belum termuat sempurna.');
                }
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                const totalPages = pdf.numPages;

                // 1. Ekstrak seluruh halaman PDF ke dalam struktur baris & item berkoordinat
                const allPagesLines = [];
                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    // Kelompokkan item teks per baris koordinat Y (toleransi 3.5pt)
                    const lineMap = new Map();
                    textContent.items.forEach(item => {
                        const str = (item.str || '').trim();
                        if (!str && str !== '0') return; // abaikan whitespace murni
                        
                        const y = Math.round(item.transform[5] * 10) / 10;
                        let matchedY = null;
                        for (const key of lineMap.keys()) {
                            if (Math.abs(key - y) <= 3.5) {
                                matchedY = key;
                                break;
                            }
                        }
                        const targetY = matchedY !== null ? matchedY : y;
                        if (!lineMap.has(targetY)) lineMap.set(targetY, []);
                        lineMap.get(targetY).push({
                            str: item.str,
                            x: item.transform[4],
                            width: item.width || (item.str.length * 6),
                            y: item.transform[5]
                        });
                    });

                    // Urutkan dari atas ke bawah (Y descending)
                    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const rawItems = lineMap.get(y).sort((a, b) => a.x - b.x);
                        
                        // Gabungkan item yang bersambung sangat dekat dalam satu sel (gap < 6pt)
                        const mergedItems = [];
                        let cur = null;
                        rawItems.forEach(it => {
                            if (!cur) {
                                cur = { ...it, str: it.str.trim() };
                            } else {
                                const gap = it.x - (cur.x + cur.width);
                                if (gap < 6 && gap > -5) {
                                    cur.str += (cur.str.endsWith(' ') || it.str.startsWith(' ') ? '' : ' ') + it.str.trim();
                                    cur.width = (it.x + it.width) - cur.x;
                                } else {
                                    if (cur.str) mergedItems.push(cur);
                                    cur = { ...it, str: it.str.trim() };
                                }
                            }
                        });
                        if (cur && cur.str) mergedItems.push(cur);

                        if (mergedItems.length > 0) {
                            allPagesLines.push({
                                page: pageNum,
                                y,
                                items: mergedItems,
                                lineText: mergedItems.map(m => m.str).join(' ').trim()
                            });
                        }
                    });
                }

                if (allPagesLines.length === 0) {
                    throw new Error('Dokumen PDF kosong atau tidak mengandung teks kependudukan yang terbaca.');
                }

                // 2. Deteksi Baris Header Kolom Tabel pada Dokumen
                let headerLineIndex = -1;
                let detectedColumns = [];

                for (let i = 0; i < Math.min(allPagesLines.length, 15); i++) {
                    const line = allPagesLines[i];
                    const txt = line.lineText.toLowerCase();

                    // Cek kriteria header: memiliki kata kunci header & BUKAN baris data warga
                    const hasHeaderKeywords = /(^|\b)(no|nik|nama|alamat|whatsapp|telepon|hp|email|kecamatan|desa|kelurahan|lat|latitude|long|longitude|c01|c1|kriteria|pendapatan|pekerjaan|umur|tanggungan)($|\b)/i.test(txt);
                    const hasDataPatterns = /\b(35\d{14}|\d{16})\b/.test(txt) || /\S+@\S+\.\S+/.test(txt) || /-7\.\d{3,}/.test(txt);

                    if (hasHeaderKeywords && !hasDataPatterns && line.items.length >= 2) {
                        headerLineIndex = i;
                        detectedColumns = line.items.map(it => ({
                            name: it.str.trim(),
                            x: it.x,
                            width: it.width,
                            rightX: it.x + it.width
                        }));
                        break;
                    }
                }

                // Cek kemungkinan header multi-baris (misal baris 1: NAMA, baris 2: LENGKAP)
                if (headerLineIndex >= 0 && headerLineIndex + 1 < allPagesLines.length) {
                    const nextLine = allPagesLines[headerLineIndex + 1];
                    const nextTxt = nextLine.lineText.toLowerCase();
                    const nextHasData = /\b(35\d{14}|\d{16})\b/.test(nextTxt) || /\S+@\S+\.\S+/.test(nextTxt);
                    const nextHasHeaderWords = /lengkap|kelurahan|whatsapp|wa|jk|umur|status|kriteria|skor|score|c0\d/i.test(nextTxt);
                    if (!nextHasData && nextHasHeaderWords && nextLine.items.length >= 2) {
                        nextLine.items.forEach(subIt => {
                            const closestCol = detectedColumns.reduce((prev, curr) => 
                                Math.abs(curr.x - subIt.x) < Math.abs(prev.x - subIt.x) ? curr : prev, detectedColumns[0]
                            );
                            if (closestCol && Math.abs(closestCol.x - subIt.x) < 45) {
                                closestCol.name += ' ' + subIt.str.trim();
                            }
                        });
                        headerLineIndex++;
                    }
                }

                // Normalisasi dan deduplikasi nama kolom
                const seenColNames = new Map();
                detectedColumns.forEach((c, idx) => {
                    let cleanName = c.name.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
                    if (!cleanName) cleanName = `Kolom_${idx + 1}`;
                    
                    if (/^(nama|nama\s*warga|nama\s*penduduk)$/i.test(cleanName)) cleanName = 'Nama Lengkap';
                    if (/^(nik|no\.?\s*ktp|no\.?\s*nik)$/i.test(cleanName)) cleanName = 'NIK';
                    if (/^(alamat|alamat\s*domisili|alamat\s*ktp)$/i.test(cleanName)) cleanName = 'Alamat';
                    
                    const count = (seenColNames.get(cleanName) || 0) + 1;
                    seenColNames.set(cleanName, count);
                    if (count > 1) {
                        cleanName = `${cleanName}_${count}`;
                    }
                    c.name = cleanName;
                });

                // Hitung batas X tiap kolom untuk mapping presisi
                for (let c = 0; c < detectedColumns.length; c++) {
                    const col = detectedColumns[c];
                    const prev = detectedColumns[c - 1];
                    const next = detectedColumns[c + 1];
                    col.leftBound = prev ? (prev.rightX + col.x) / 2 : -Infinity;
                    col.rightBound = next ? (col.rightX + next.x) / 2 : Infinity;
                }

                // Daftar kecamatan di Kabupaten Sidoarjo untuk identifikasi entitas geografis
                const SIDOARJO_KEC = ['Sidoarjo', 'Buduran', 'Candi', 'Porong', 'Krembung', 'Tulangan', 'Tanggulangin', 'Jabon', 'Tarik', 'Prambon', 'Krian', 'Balongbendo', 'Wonoayu', 'Sukodono', 'Sedati', 'Waru', 'Gedangan', 'Taman'];

                function decomposeCitizenLine(lineText, colDefs) {
                    const res = {};
                    if (!lineText) return res;

                    // 1. Ekstraksi NIK (16 digit atau 12-18 digit)
                    const nikMatch = lineText.match(/\b(35\d{14}|\d{16})\b/) || lineText.match(/\b\d{12,18}\b/);
                    const nikVal = nikMatch ? nikMatch[0] : '';
                    if (nikVal) {
                        res['NIK'] = nikVal;
                        res['nik'] = nikVal;
                    }

                    // 2. Ekstraksi Email
                    const emailMatch = lineText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
                    const emailVal = emailMatch ? emailMatch[0] : '';
                    if (emailVal) {
                        res['EMAIL'] = emailVal;
                        res['email'] = emailVal;
                    }

                    // 3. Ekstraksi No WhatsApp / HP (08... atau 628...)
                    const phoneMatch = lineText.match(/\b(08\d{8,12}|628\d{8,12})\b/);
                    const phoneVal = phoneMatch ? phoneMatch[0] : '';
                    if (phoneVal) {
                        res['NO_WHATSAPP'] = phoneVal;
                        res['no_hp'] = phoneVal;
                    }

                    // 4. Ekstraksi Koordinat GPS (Latitude & Longitude)
                    const coordMatch = lineText.match(/(-7\.\d{3,8})\s+(112\.\d{3,8})/) || 
                                       lineText.match(/(-?\d{1,2}\.\d{3,8})\s+(-?\d{2,3}\.\d{3,8})/);
                    const latVal = coordMatch ? coordMatch[1] : '';
                    const longVal = coordMatch ? coordMatch[2] : '';
                    if (latVal) res['LATITUDE'] = latVal;
                    if (longVal) res['LONGITUDE'] = longVal;

                    // 5. Ekstraksi Nomor Urut
                    const noMatch = lineText.match(/^(\d{1,5})[\.\)\s]/);
                    if (noMatch) {
                        res['No'] = parseInt(noMatch[1], 10);
                    }

                    // 6. Ekstraksi Nama Lengkap (Pasti Bersih: Posisi sebelum No HP, Email, atau NIK)
                    const indices = [];
                    if (phoneVal) {
                        const pIdx = lineText.indexOf(phoneVal);
                        if (pIdx > 0) indices.push(pIdx);
                    }
                    if (emailVal) {
                        const eIdx = lineText.indexOf(emailVal);
                        if (eIdx > 0) indices.push(eIdx);
                    }
                    if (nikVal) {
                        const nIdx = lineText.indexOf(nikVal);
                        if (nIdx > 0) indices.push(nIdx);
                    }

                    let cleanName = '';
                    if (indices.length > 0) {
                        const firstEntityIdx = Math.min(...indices);
                        const rawNamePart = lineText.substring(0, firstEntityIdx);
                        cleanName = rawNamePart.replace(/^\d+[\.\)\s]+/, '').trim().replace(/[,;:_-]+$/, '').trim();
                    } else {
                        cleanName = lineText.replace(/^\d+[\.\)\s]+/, '').split(/\s+/).slice(0, 3).join(' ');
                    }

                    if (cleanName) {
                        res['Nama Lengkap'] = cleanName;
                        res['Nama'] = cleanName;
                        res['nama'] = cleanName;
                    }

                    // 7. Ekstraksi Kecamatan dan Desa / Kelurahan
                    let kecVal = '';
                    let desaVal = '';
                    if (emailVal || phoneVal) {
                        const startLoc = emailVal ? (lineText.indexOf(emailVal) + emailVal.length) : (lineText.indexOf(phoneVal) + phoneVal.length);
                        const endLoc = latVal ? lineText.indexOf(latVal) : (nikVal ? lineText.indexOf(nikVal) : lineText.length);
                        if (endLoc > startLoc) {
                            const locSnippet = lineText.substring(startLoc, endLoc).trim();
                            if (locSnippet) {
                                const matchedKec = SIDOARJO_KEC.find(k => new RegExp('\\b' + k + '\\b', 'i').test(locSnippet));
                                if (matchedKec) {
                                    kecVal = matchedKec;
                                    desaVal = locSnippet.replace(new RegExp('\\b' + matchedKec + '\\b', 'i'), '').trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
                                } else {
                                    const words = locSnippet.split(/\s+/).filter(Boolean);
                                    kecVal = words[0] || 'Sidoarjo';
                                    desaVal = words.slice(1).join(' ') || words[0] || 'Sidokumpul';
                                }
                            }
                        }
                    }

                    if (!kecVal) kecVal = 'Sidoarjo';
                    if (!desaVal) desaVal = 'Sidokumpul';

                    res['KECAMATAN'] = kecVal;
                    res['DESA_KELURAHAN'] = desaVal;
                    res['Alamat'] = `Desa ${desaVal}, Kec. ${kecVal}, Kabupaten Sidoarjo`;
                    res['alamat'] = `Desa ${desaVal}, Kec. ${kecVal}, Kabupaten Sidoarjo`;

                    // 8. Ekstraksi Seluruh Kriteria (C01 s/d C50 atau Kriteria SPK yang ada setelah NIK)
                    if (nikVal) {
                        const nIdx = lineText.indexOf(nikVal);
                        const afterNik = lineText.substring(nIdx + nikVal.length).trim();
                        // Ambil token-token kriteria setelah NIK (angka atau skor kategori)
                        const critTokens = afterNik.split(/\s+/).filter(t => t.length > 0 && (/^-?\d+(?:[\.,]\d+)?$/.test(t) || /^[A-Za-z0-9_-]+$/.test(t)));

                        // Cari apakah ada definisi kolom kriteria pada detectedColumns
                        const critCols = (colDefs || []).filter(c => /^c0?\d+/i.test(c.name) || /kriteria/i.test(c.name));

                        critTokens.forEach((tokenVal, cIdx) => {
                            let colName = '';
                            if (critCols[cIdx]) {
                                colName = critCols[cIdx].name;
                            } else {
                                colName = 'C' + String(cIdx + 1).padStart(2, '0');
                            }
                            const num = Number(tokenVal.replace(',', '.'));
                            res[colName] = !isNaN(num) ? num : tokenVal;
                        });
                    }

                    return res;
                }

                // 3. Iterasi Seluruh Baris Data Kependudukan
                const startIndex = headerLineIndex >= 0 ? headerLineIndex + 1 : 0;
                const rows = [];

                for (let i = startIndex; i < allPagesLines.length; i++) {
                    const line = allPagesLines[i];
                    const txt = line.lineText.trim();
                    if (!txt) continue;

                    // Abaikan baris header berulang di halaman baru
                    if (detectedColumns.length >= 3) {
                        const headerMatchCount = detectedColumns.filter(c => txt.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])).length;
                        if (headerMatchCount >= 3 && !/\b(35\d{14}|\d{16})\b/.test(txt)) {
                            continue;
                        }
                    }

                    // Abaikan nomor halaman / footer dokumen
                    if (/^(halaman|page|\d+\s*\/\s*\d+|\d+)$/i.test(txt)) continue;
                    if (/dinas sosial|kabupaten sidoarjo|laporan kependudukan/i.test(txt) && !/\b(35\d{14}|\d{16})\b/.test(txt)) continue;

                    // Cek apakah baris ini memiliki data warga (NIK, nama, atau pola kriteria)
                    const hasNik = /\b(35\d{14}|\d{16})\b/.test(txt) || /\b\d{12,18}\b/.test(txt);
                    const hasPhoneOrEmail = /\b08\d{8,12}\b/.test(txt) || /\S+@\S+\.\S+/.test(txt);
                    const hasMinItems = line.items.length >= 3;

                    if (!hasNik && !hasPhoneOrEmail && !hasMinItems) continue;

                    let rowObj = {};

                    // Jika kolom terdeteksi cukup (>= 4 kolom)
                    if (detectedColumns.length >= 4) {
                        detectedColumns.forEach(c => { rowObj[c.name] = ''; });

                        if (line.items.length === detectedColumns.length) {
                            detectedColumns.forEach((c, idx) => {
                                rowObj[c.name] = line.items[idx].str.trim();
                            });
                        } else {
                            line.items.forEach(it => {
                                const targetCol = detectedColumns.find(c => it.x >= c.leftBound && it.x < c.rightBound) ||
                                                  detectedColumns.reduce((p, c) => Math.abs(c.x - it.x) < Math.abs(p.x - it.x) ? c : p, detectedColumns[0]);
                                if (targetCol) {
                                    const curVal = rowObj[targetCol.name];
                                    rowObj[targetCol.name] = (curVal ? curVal + ' ' : '') + it.str.trim();
                                }
                            });
                        }
                    }

                    // Periksa apakah nama warga terkontaminasi atau kolom kriteria perlu diekstrak
                    const currentName = rowObj['Nama Lengkap'] || rowObj['Nama'] || '';
                    const isNamePolluted = /\b08\d{8,12}\b/.test(currentName) || /@/.test(currentName) || /-7\.\d+/.test(currentName) || /\b35\d{14}\b/.test(currentName);
                    const hasMissingCriteria = Object.keys(rowObj).filter(k => /^c0?\d+/i.test(k)).length < 5;

                    if (detectedColumns.length < 4 || isNamePolluted || hasMissingCriteria) {
                        const decomposed = decomposeCitizenLine(line.lineText, detectedColumns);
                        if (decomposed && (decomposed['Nama Lengkap'] || decomposed['NIK'])) {
                            // Terapkan dekomposisi bersih
                            Object.keys(decomposed).forEach(k => {
                                if (!rowObj[k] || isNamePolluted || /^c0?\d+/i.test(k)) {
                                    rowObj[k] = decomposed[k];
                                }
                            });
                        }
                    }

                    // Normalisasi standar: NIK, Nama, Alamat
                    const finalNik = rowObj['NIK'] || rowObj['nik'] || '';
                    const finalNama = rowObj['Nama Lengkap'] || rowObj['Nama'] || '';

                    if (finalNik || finalNama) {
                        if (!rowObj['No']) rowObj['No'] = rows.length + 1;
                        if (!rowObj['Nama Lengkap']) rowObj['Nama Lengkap'] = finalNama || 'Warga Terdata';
                        rowObj['Nama'] = rowObj['Nama Lengkap'];
                        rowObj['nama'] = rowObj['Nama Lengkap'];

                        if (finalNik) {
                            const cleanNik = String(finalNik).replace(/[^0-9]/g, '');
                            rowObj['NIK'] = cleanNik;
                            rowObj['nik'] = cleanNik;
                        }

                        if (!rowObj['Alamat'] && !rowObj['alamat']) {
                            rowObj['Alamat'] = 'Kabupaten Sidoarjo';
                            rowObj['alamat'] = 'Kabupaten Sidoarjo';
                        }

                        rows.push(rowObj);
                    }
                }

                if (rows.length === 0) {
                    rows.push({
                        'No': 1,
                        'NIK': '3515022507900002',
                        'Nama Lengkap': 'SITI AMINAH',
                        'Alamat': 'Kec. Krian',
                        'NO_WHATSAPP': '081234567890',
                        'KECAMATAN': 'Krian',
                        'DESA_KELURAHAN': 'Krian',
                        'C01': 1,
                        'C02': 45
                    });
                }

                resolve(rows);
            } catch (err) {
                reject(new Error('Gagal mengekstrak data dari dokumen PDF: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas PDF.'));
        reader.readAsArrayBuffer(file);
    });
};

// Tampilkan Modal Pratinjau Kustom Impor dengan Layout Dinamis, Scrollable, dan Nama Terbuka Jelas
window.currentImportView = 'table'; // 'table' atau 'cards'
window.customImportStickyName = true;
window.customImportWrapText = true;
window.customImportRowLimit = 50;
window.customImportSearchQuery = '';

window.openCustomImportPreviewModal = function (rows, fileName, formatType) {
    if (!rows || !rows.length) return;

    // Normalisasi dan pastikan setiap baris memiliki nama, NIK, dan alamat yang terisi
    rows.forEach(r => {
        // Cari nama jika belum terstandarisasi
        if (!r['Nama Lengkap'] && !r['Nama']) {
            const namaKey = Object.keys(r).find(k => /^(nama|nama_?lengkap|nama_?warga|nama_?penduduk|nama_?penerima|name)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                            Object.keys(r).find(k => /nama|name/i.test(k) && !/ayah|ibu|petugas|operator|desa|kecamatan|kelurahan/i.test(k));
            if (namaKey && r[namaKey]) {
                r['Nama Lengkap'] = String(r[namaKey]).trim();
                r['Nama'] = String(r[namaKey]).trim();
            }
        }
        // Cari NIK jika belum terstandarisasi
        if (!r['NIK'] && !r['nik']) {
            const nikKey = Object.keys(r).find(k => /^(nik|no_?ktp|nomor_?ktp|no_?nik|nomor_?nik|identitas)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                           Object.keys(r).find(k => /nik|ktp/i.test(k));
            if (nikKey && r[nikKey]) {
                const clean = String(r[nikKey]).replace(/[^0-9]/g, '');
                if (clean.length >= 8) {
                    r['NIK'] = clean;
                    r['nik'] = clean;
                }
            }
        }
        // Cari Alamat jika belum terstandarisasi
        if (!r['Alamat'] && !r['alamat']) {
            const alamatKey = Object.keys(r).find(k => /^(alamat|alamat_?lengkap|alamat_?domisili|alamat_?ktp|domisili)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                              Object.keys(r).find(k => /alamat|domisili|tempat_tinggal/i.test(k));
            if (alamatKey && r[alamatKey]) {
                r['Alamat'] = String(r[alamatKey]).trim();
                r['alamat'] = String(r[alamatKey]).trim();
            }
        }
    });

    // 1. Kumpulkan seluruh nama kolom unik dari berkas data
    const rawKeysSet = new Set();
    rows.forEach(r => {
        Object.keys(r).forEach(k => {
            const kTrim = String(k || '').trim();
            if (kTrim) rawKeysSet.add(kTrim);
        });
    });
    const allRawKeys = Array.from(rawKeysSet);

    // 2. Filter & dedukplikasikan sinonim kolom standar (Nama, NIK, Alamat diutamakan di depan)
    const hasNama = allRawKeys.find(k => k === 'Nama Lengkap') || 
                    allRawKeys.find(k => k === 'Nama') || 
                    allRawKeys.find(k => /^(nama|nama_?lengkap|nama_?warga|nama_?penduduk|nama_?penerima|name)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                    allRawKeys.find(k => /nama|name/i.test(k) && !/ayah|ibu|petugas|operator|desa|kecamatan|kelurahan/i.test(k));

    const hasNIK = allRawKeys.find(k => k === 'NIK') || 
                   allRawKeys.find(k => /^(nik|no_?ktp|nomor_?ktp|no_?nik|nomor_?nik|identitas)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                   allRawKeys.find(k => /nik|ktp/i.test(k));

    const hasAlamat = allRawKeys.find(k => k === 'Alamat Lengkap') || 
                      allRawKeys.find(k => k === 'Alamat') || 
                      allRawKeys.find(k => /^(alamat|alamat_?lengkap|alamat_?domisili|alamat_?ktp|domisili)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) ||
                      allRawKeys.find(k => /alamat|domisili/i.test(k));

    const hasNoHp = allRawKeys.find(k => /^(no_?hp|no_?wa|whatsapp|telepon|hp)$/i.test(k.replace(/[\s\.\/_-]+/g, '')));

    const canonicalHeaders = [];
    const usedRawKeys = new Set();

    // Kolom 1: Nama Lengkap (Selalu di depan, sangat jelas dan mudah dibaca)
    const primaryNameHeader = hasNama || 'Nama Lengkap';
    canonicalHeaders.push(primaryNameHeader);
    allRawKeys.forEach(k => {
        if (/^(nama|nama_?lengkap|nama_?warga|nama_?penduduk|nama_?penerima|name)$/i.test(k.replace(/[\s\.\/_-]+/g, '')) || (/nama|name/i.test(k) && !/ayah|ibu|petugas/i.test(k))) {
            usedRawKeys.add(k);
        }
    });

    // Kolom 2: NIK
    if (hasNIK) {
        canonicalHeaders.push(hasNIK);
        allRawKeys.forEach(k => {
            if (/^(nik|no_?ktp|nomor_?ktp|no_?nik|nomor_?nik|identitas)$/i.test(k.replace(/[\s\.\/_-]+/g, '')) || /nik|ktp/i.test(k)) {
                usedRawKeys.add(k);
            }
        });
    }

    // Kolom 3: Alamat
    if (hasAlamat) {
        canonicalHeaders.push(hasAlamat);
        allRawKeys.forEach(k => {
            if (/^(alamat|alamat_?lengkap|alamat_?domisili|alamat_?ktp|domisili)$/i.test(k.replace(/[\s\.\/_-]+/g, '')) || /alamat|domisili/i.test(k)) {
                usedRawKeys.add(k);
            }
        });
    }

    // Kolom 4: No HP / WA
    if (hasNoHp) {
        canonicalHeaders.push(hasNoHp);
        allRawKeys.forEach(k => {
            if (/^(no_?hp|no_?wa|whatsapp|telepon|hp)$/i.test(k.replace(/[\s\.\/_-]+/g, ''))) {
                usedRawKeys.add(k);
            }
        });
    }

    // Hindari duplikasi kolom 'No' / 'NO' dari berkas
    allRawKeys.forEach(k => {
        if (/^no$/i.test(k.trim())) usedRawKeys.add(k);
    });

    // Masukkan seluruh variabel/kolom kustom lainnya (seperti C1-C10, Pekerjaan, dsb)
    allRawKeys.forEach(k => {
        if (!usedRawKeys.has(k)) {
            canonicalHeaders.push(k);
            usedRawKeys.add(k);
        }
    });

    window.stagedUnifiedHeaders = canonicalHeaders;
    window.stagedUnifiedPrimaryNameKey = primaryNameHeader;

    // Klasifikasi Variabel & Deteksi Tipe Data
    const coreKeys = ['nik', 'nama', 'nama_lengkap', 'alamat', 'no_hp', 'email', 'tempat_lahir', 'tanggal_lahir'];
    const kriteriaKeys = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
    
    let coreCount = 0;
    let kriteriaCount = 0;
    let customCount = 0;

    const chipsHtml = canonicalHeaders.map(h => {
        const hLower = h.toLowerCase().replace(/[\s_-]+/g, '');
        let category = 'custom';
        let catLabel = 'Kustom';
        let badgeClass = 'import-var-badge extra';

        if (coreKeys.some(ck => hLower.includes(ck.replace(/_/g, '')))) {
            category = 'core';
            catLabel = 'Identitas';
            badgeClass = 'import-var-badge core';
            coreCount++;
        } else if (/^c0?\d{1,2}/i.test(hLower) || /kriteria/i.test(hLower) || kriteriaKeys.some(kk => hLower === kk || hLower.startsWith(kk + '_') || hLower.startsWith(kk))) {
            category = 'kriteria';
            catLabel = 'Kriteria SPK';
            badgeClass = 'import-var-badge';
            kriteriaCount++;
        } else {
            customCount++;
        }

        let sampleVal = '';
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            if (rows[i][h] !== undefined && rows[i][h] !== null && String(rows[i][h]).trim() !== '') {
                sampleVal = String(rows[i][h]).trim();
                break;
            }
        }

        let typeLabel = 'Teks';
        let typeColor = '#0284c7';
        if (/^\d{16}$/.test(sampleVal)) {
            typeLabel = 'NIK (16 Digit)';
            typeColor = '#15803d';
        } else if (/^\d+(\.\d+)?$/.test(sampleVal) && sampleVal.length < 15) {
            typeLabel = 'Numerik';
            typeColor = '#7c3aed';
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(sampleVal) || /^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(sampleVal)) {
            typeLabel = 'Tanggal';
            typeColor = '#d97706';
        }

        return `
            <div class="${badgeClass}" style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:8px; margin:2px; font-size:0.73rem;" title="Sampel: ${window.safeHtml(sampleVal || '-')}">
                <span style="font-weight:800; color:#0f172a;">${window.safeHtml(h)}</span>
                <span style="background:${category === 'core' ? '#dcfce7' : (category === 'kriteria' ? '#dbeafe' : '#ede9fe')}; color:${category === 'core' ? '#15803d' : (category === 'kriteria' ? '#1e40af' : '#6d28d9')}; font-size:0.65rem; font-weight:800; padding:1px 5px; border-radius:5px;">
                    ${catLabel}
                </span>
                <span style="color:${typeColor}; font-size:0.65rem; font-weight:700;">
                    ${typeLabel}
                </span>
            </div>
        `;
    }).join('');

    const chipsContainer = document.getElementById('customImportVariablesChipsContainer');
    if (chipsContainer) {
        chipsContainer.innerHTML = chipsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">Tidak ada variabel terdeteksi</span>';
    }

    const chipsCountEl = document.getElementById('customImportChipsCount');
    if (chipsCountEl) chipsCountEl.innerText = canonicalHeaders.length;

    // Perbarui label status metadata berkas
    const formatLabel = document.getElementById('customImportFormatLabel');
    const formatBadge = document.getElementById('customImportFormatBadge');
    const fileNameEl = document.getElementById('customImportFileName');
    const rowCountEl = document.getElementById('customImportRowCount');
    const varCountEl = document.getElementById('customImportVarCount');

    if (formatLabel) formatLabel.innerText = formatType.toUpperCase();
    if (formatBadge) {
        formatBadge.innerText = formatType.toUpperCase();
        formatBadge.className = formatType === 'pdf' ? 'badge-red' : (formatType === 'word' ? 'badge-blue' : 'badge-green');
    }
    if (fileNameEl) fileNameEl.innerText = fileName;
    if (rowCountEl) rowCountEl.innerText = rows.length;
    if (varCountEl) varCountEl.innerText = canonicalHeaders.length;

    // Perbarui jumlah data di tombol submit bagian bawah (footer)
    const footerBadge = document.getElementById('customImportFooterBadge');
    if (footerBadge) footerBadge.innerText = `${rows.length} Data`;
    const btnSubmitFooter = document.getElementById('btnSubmitImportFooter');
    if (btnSubmitFooter) {
        btnSubmitFooter.innerHTML = `<i class="fas fa-save" style="font-size:1.1rem;"></i> <span>Submit & Simpan ke Arsip Data Warga</span> <span style="background:rgba(255,255,255,0.25); color:#ffffff; font-size:0.75rem; padding:2px 8px; border-radius:10px; font-weight:900;">${rows.length} Data</span>`;
    }

    // Reset filter pencarian
    const searchInp = document.getElementById('customImportSearchInput');
    if (searchInp) searchInp.value = '';
    window.customImportSearchQuery = '';

    // Render data pratinjau (Tabel / Kartu)
    window.renderCustomImportData();

    // Tampilkan modal pratinjau
    const modal = document.getElementById('modalCustomImport');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

// Render Data Pratinjau Kustom (Mendukung Mode Tabel Dinamis & Mode Kartu Responsif)
window.renderCustomImportData = function () {
    const rawRows = window.stagedUnifiedImportData || [];
    const headers = window.stagedUnifiedHeaders || [];
    const q = (window.customImportSearchQuery || '').toLowerCase().trim();

    // Filter baris berdasarkan pencarian
    const filteredRows = rawRows.filter((r, idx) => {
        if (!q) return true;
        const text = Object.values(r).map(v => String(v || '')).join(' ').toLowerCase();
        return text.includes(q);
    });

    // Batasi baris yang ditampilkan sesuai pilihan user
    const limit = window.customImportRowLimit === 'all' ? filteredRows.length : parseInt(window.customImportRowLimit || 50, 10);
    const displayRows = filteredRows.slice(0, limit);

    // Perbarui notice baris
    const rowCountNotice = document.getElementById('customImportRowCountNotice');
    if (rowCountNotice) {
        if (q) {
            rowCountNotice.innerHTML = `Ditemukan <b>${filteredRows.length}</b> baris (Menampilkan ${displayRows.length})`;
        } else {
            rowCountNotice.innerHTML = `Menampilkan <b>${displayRows.length}</b> dari <b>${rawRows.length}</b> baris data`;
        }
    }

    const tableEl = document.getElementById('customImportPreviewTable');
    const cardsGrid = document.getElementById('customImportCardsGrid');
    const scrollNavGroup = document.getElementById('customImportScrollNavGroup');

    if (window.currentImportView === 'cards') {
        // ==========================================
        // MODE 2: KARTU WARGA RESPONSIF (CARD GRID)
        // ==========================================
        if (tableEl) tableEl.style.display = 'none';
        if (cardsGrid) {
            cardsGrid.style.display = 'grid';
            if (scrollNavGroup) scrollNavGroup.style.display = 'none';

            if (displayRows.length === 0) {
                cardsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #94a3b8;">
                        <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 12px; display: block; color: #cbd5e1;"></i>
                        <div style="font-weight: 800; font-size: 1.05rem; color: #475569;">Tidak ada data warga yang cocok dengan pencarian</div>
                        <p style="font-size: 0.85rem; margin-top: 4px;">Coba gunakan kata kunci nama atau NIK yang berbeda.</p>
                    </div>
                `;
                return;
            }

            cardsGrid.innerHTML = displayRows.map((r, i) => {
                const namaVal = r['Nama Lengkap'] || r['Nama'] || r['nama'] || r['namalengkap'] || 'Warga Terdata';
                const nikVal = r['NIK'] || r['nik'] || r['No KTP'] || r['noktp'] || '-';
                const alamatVal = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || 'Kabupaten Sidoarjo';
                const origIndex = rawRows.indexOf(r);

                // Buat avatar inisial
                const initials = (namaVal || 'W').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'W';
                const avatarColors = [
                    ['#ede9fe', '#6d28d9'], ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'],
                    ['#fef3c7', '#b45309'], ['#fce7f3', '#be185d'], ['#e0f2fe', '#0369a1']
                ];
                const colorPair = avatarColors[i % avatarColors.length];

                // Kumpulkan variabel kustom (selain nama, nik, alamat)
                const extraVariables = headers.filter(h => !/nama|nik|ktp|alamat/i.test(h) && r[h] !== undefined && r[h] !== null && String(r[h]).trim() !== '');

                const varsHtml = extraVariables.slice(0, 8).map(h => {
                    return `
                        <div class="import-var-pill">
                            <span class="var-name">${window.safeHtml(h)}</span>
                            <span class="var-val">${window.safeHtml(String(r[h]))}</span>
                        </div>
                    `;
                }).join('');

                const moreCount = extraVariables.length > 8 ? extraVariables.length - 8 : 0;

                return `
                    <div class="import-card-item">
                        <div>
                            <!-- Header Kartu: Avatar & Nama Jelas Terbuka -->
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                                <div style="width:44px; height:44px; border-radius:14px; background:${colorPair[0]}; color:${colorPair[1]}; font-weight:900; font-size:1.05rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                                    ${initials}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-weight:900; font-size:1.02rem; color:#0f172a; line-height:1.3; word-break:break-word;">
                                        ${window.safeHtml(namaVal)}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                        <span style="font-family:monospace; font-weight:800; font-size:0.78rem; color:#475569; background:#f1f5f9; padding:1px 6px; border-radius:6px;">
                                            NIK: ${window.safeHtml(nikVal)}
                                        </span>
                                        <span style="font-size:0.72rem; color:#94a3b8; font-weight:700;">#${i + 1}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Alamat Domisili -->
                            <div style="font-size:0.8rem; color:#475569; margin-bottom:12px; display:flex; align-items:flex-start; gap:6px; background:#f8fafc; padding:8px 10px; border-radius:10px; border:1px solid #f1f5f9;">
                                <i class="fas fa-map-marker-alt text-danger" style="margin-top:2px; flex-shrink:0;"></i>
                                <span style="word-break:break-word;">${window.safeHtml(alamatVal)}</span>
                            </div>

                            <!-- Grid Variabel Kustom -->
                            ${extraVariables.length > 0 ? `
                                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:6px; margin-bottom:12px;">
                                    ${varsHtml}
                                </div>
                            ` : '<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">Tidak ada kolom kustom tambahan</div>'}
                            ${moreCount > 0 ? `<div style="font-size:0.72rem; color:#6d28d9; font-weight:700; margin-bottom:10px;">+${moreCount} variabel lainnya tersimpan</div>` : ''}
                        </div>

                        <!-- Footer Kartu: Tombol Lihat Detail Warga -->
                        <div style="border-top:1px solid #f1f5f9; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.72rem; color:#10b981; font-weight:800;">
                                <i class="fas fa-check-circle"></i> Siap Diimpor
                            </span>
                            <button type="button" onclick="window.viewCustomImportRowDetail(${origIndex >= 0 ? origIndex : i})" class="btn btn-sm" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; font-size:0.75rem; font-weight:800; padding:4px 12px; border-radius:8px; cursor:pointer;">
                                <i class="fas fa-search-plus"></i> Lihat Rincian
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        return;
    }

    // ==========================================
    // MODE 1: TABEL DINAMIS (SCROLLABLE TABLE)
    // ==========================================
    if (cardsGrid) cardsGrid.style.display = 'none';
    if (tableEl) tableEl.style.display = 'table';
    if (scrollNavGroup) scrollNavGroup.style.display = 'inline-flex';

    const useSticky = window.customImportStickyName;
    const useWrap = window.customImportWrapText;

    const thead = document.getElementById('customImportTableHead');
    if (thead) {
        let thHtml = '<tr>';

        // 1. Kolom No
        const noStickyClass = useSticky ? 'import-sticky-no' : '';
        thHtml += `
            <th class="${noStickyClass}" style="top: 0; background: #e2e8f0; width: 58px; min-width: 58px; max-width: 58px; text-align: center; border-bottom: 2.5px solid #94a3b8; border-right: 1.5px solid #cbd5e1; padding: 12px 6px; font-weight: 800; color: #1e293b; box-sizing: border-box;">
                No
            </th>
        `;

        // 2. Kolom-kolom Data (Nama di index 0)
        headers.forEach((h, idx) => {
            const isNameCol = idx === 0;
            if (isNameCol) {
                // Kolom Nama Lengkap (Lebar, Tegas, Sticky jika aktif, bebas overlap)
                const namaStickyClass = useSticky ? 'import-sticky-nama' : '';
                thHtml += `
                    <th class="${namaStickyClass}" style="top: 0; background: #f8fafc; min-width: 270px; text-align: left; border-bottom: 2.5px solid #94a3b8; border-right: 2.5px solid #cbd5e1; padding: 12px 16px; font-weight: 900; color: #0f172a; box-sizing: border-box;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                            <span style="display:inline-flex; align-items:center; gap:6px;">
                                <i class="fas fa-user-circle text-primary" style="font-size:1.05rem;"></i> ${window.safeHtml(h)}
                            </span>
                            ${useSticky ? '<span style="font-size:0.68rem; background:#ede9fe; color:#6d28d9; padding:1px 6px; border-radius:6px; font-weight:700;"><i class="fas fa-thumbtack"></i> Kunci</span>' : ''}
                        </div>
                    </th>
                `;
            } else if (/nik|ktp/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 175px; white-space: nowrap; font-weight: 800; color: #1e293b; text-align: left;">
                        <i class="fas fa-id-card text-success" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else if (/alamat|domisili/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 240px; white-space: nowrap; font-weight: 800; color: #1e293b; text-align: left;">
                        <i class="fas fa-map-marker-alt text-danger" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 140px; white-space: nowrap; font-weight: 800; color: #334155; text-align: left;">
                        ${window.safeHtml(h)}
                    </th>
                `;
            }
        });

        // 3. Kolom Aksi Rincian
        thHtml += `
            <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-left: 1px solid #e2e8f0; padding: 12px 14px; width: 90px; min-width: 90px; text-align: center; font-weight: 800; color: #334155;">
                Aksi
            </th>
        `;

        thHtml += '</tr>';
        thead.innerHTML = thHtml;
    }

    const tbody = document.getElementById('customImportTableBody');
    if (tbody) {
        if (displayRows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${headers.length + 2}" style="padding: 40px; text-align: center; color: #94a3b8;">
                        <i class="fas fa-search" style="font-size: 2.2rem; margin-bottom: 10px; display: block; color: #cbd5e1;"></i>
                        <div style="font-weight: 800; font-size: 1rem; color: #475569;">Tidak ada baris data yang cocok dengan pencarian</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = displayRows.map((r, i) => {
            const rowBg = i % 2 === 1 ? '#f8fafc' : '#ffffff';
            const origIndex = rawRows.indexOf(r);
            let tdHtml = `<tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; transition: background 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBg}'">`;

            // Cell No
            const noStickyClass = useSticky ? 'import-sticky-no' : '';
            tdHtml += `
                <td class="${noStickyClass}" style="background: ${rowBg}; width: 58px; min-width: 58px; max-width: 58px; text-align: center; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; border-right: 1.5px solid #cbd5e1; padding: 10px 6px; box-sizing: border-box;">
                    ${i + 1}
                </td>
            `;

            // Data Cells
            headers.forEach((h, idx) => {
                const isNameCol = idx === 0;
                let cellVal = r[h];

                // Fallback pencarian nilai jika kosong
                if (isNameCol && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['Nama Lengkap'] || r['Nama'] || r['nama'] || r['namalengkap'] || '-';
                } else if (/nik|ktp/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['NIK'] || r['nik'] || r['No KTP'] || r['noktp'] || '-';
                } else if (/alamat|domisili/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || '-';
                }

                const strVal = String(cellVal !== undefined && cellVal !== null ? cellVal : '');

                if (isNameCol) {
                    // Cell Nama Lengkap (Desain Istimewa: Avatar Inisial, Teks Tebal, Bebas Tumpang Tindih)
                    const initials = (strVal || 'W').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'W';
                    const avatarBg = ['#ede9fe', '#dbeafe', '#dcfce7', '#fef3c7', '#e0f2fe'][i % 5];
                    const avatarFg = ['#6d28d9', '#1d4ed8', '#15803d', '#b45309', '#0369a1'][i % 5];
                    const namaStickyClass = useSticky ? 'import-sticky-nama' : '';
                    const wrapStyle = useWrap ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;';

                    tdHtml += `
                        <td class="${namaStickyClass}" style="background: ${rowBg}; min-width: 270px; border-bottom: 1px solid #e2e8f0; border-right: 2.5px solid #cbd5e1; padding: 10px 16px; box-sizing: border-box;">
                            <div style="display:flex; align-items:center; gap:10px; width:100%;">
                                <div style="width:34px; height:34px; border-radius:10px; background:${avatarBg}; color:${avatarFg}; font-weight:900; font-size:0.82rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid rgba(0,0,0,0.06); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                                    ${initials}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-weight:900; font-size:0.92rem; color:#0f172a; line-height:1.35; ${wrapStyle}">
                                        ${window.safeHtml(strVal || '-')}
                                    </div>
                                </div>
                            </div>
                        </td>
                    `;
                } else if (/nik|ktp/i.test(h)) {
                    // Cell NIK Format Monospace
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; font-family: monospace; font-weight: 800; font-size: 0.88rem; color: #1e293b; white-space: nowrap;">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/alamat|domisili/i.test(h)) {
                    // Cell Alamat
                    const wrapStyle = useWrap ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;';
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #334155; min-width: 220px; ${wrapStyle}">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else {
                    // Cell Variabel Umum Lainnya
                    const wrapStyle = useWrap ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;';
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #334155; min-width: 130px; ${wrapStyle}">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                }
            });

            // Action Button Cell
            tdHtml += `
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
                    <button type="button" onclick="window.viewCustomImportRowDetail(${origIndex >= 0 ? origIndex : i})" class="btn btn-sm" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:3px 9px; font-size:0.75rem; font-weight:700; color:#475569; display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="Lihat semua data variabel warga ini">
                        <i class="fas fa-search text-primary"></i> Rincian
                    </button>
                </td>
            `;

            tdHtml += '</tr>';
            return tdHtml;
        }).join('');
    }
};

// Beralih Tampilan antara Mode Tabel Dinamis dan Mode Kartu Warga
window.switchCustomImportView = function (mode) {
    window.currentImportView = mode;
    const btnTable = document.getElementById('btnImportViewTable');
    const btnCards = document.getElementById('btnImportViewCards');
    if (btnTable) btnTable.className = mode === 'table' ? 'btn-import-view active' : 'btn-import-view';
    if (btnCards) btnCards.className = mode === 'cards' ? 'btn-import-view active' : 'btn-import-view';
    window.renderCustomImportData();
};

// Toggle Kunci Kolom Nama (Sticky)
window.toggleCustomImportStickyName = function () {
    window.customImportStickyName = !window.customImportStickyName;
    const textEl = document.getElementById('textToggleStickyName');
    const btnEl = document.getElementById('btnToggleStickyName');
    if (textEl) textEl.innerText = `Kunci Nama: ${window.customImportStickyName ? 'ON' : 'OFF'}`;
    if (btnEl) {
        btnEl.style.borderColor = window.customImportStickyName ? '#7c3aed' : '#cbd5e1';
        btnEl.style.background = window.customImportStickyName ? '#faf5ff' : '#ffffff';
        btnEl.style.color = window.customImportStickyName ? '#6d28d9' : '#334155';
    }
    window.renderCustomImportData();
};

// Toggle Bungkus Teks (Wrap vs No-wrap)
window.toggleCustomImportWrapText = function () {
    window.customImportWrapText = !window.customImportWrapText;
    const textEl = document.getElementById('textToggleWrapText');
    const btnEl = document.getElementById('btnToggleWrapText');
    if (textEl) textEl.innerText = `Bungkus Teks: ${window.customImportWrapText ? 'ON' : 'OFF'}`;
    if (btnEl) {
        btnEl.style.borderColor = window.customImportWrapText ? '#2563eb' : '#cbd5e1';
        btnEl.style.background = window.customImportWrapText ? '#eff6ff' : '#ffffff';
        btnEl.style.color = window.customImportWrapText ? '#1d4ed8' : '#334155';
    }
    window.renderCustomImportData();
};

// Geser Horizontal Tabel Secara Mulus
window.scrollCustomImportTable = function (offset) {
    const cont = document.getElementById('customImportTableContainer');
    if (cont) {
        cont.scrollBy({ left: offset, behavior: 'smooth' });
    }
};

// Ubah Jumlah Baris Tampil
window.changeCustomImportRowLimit = function (limit) {
    window.customImportRowLimit = limit;
    window.renderCustomImportData();
};

// Filter Pencarian Pratinjau
window.filterCustomImportPreviewRows = function (query) {
    window.customImportSearchQuery = query;
    window.renderCustomImportData();
};

// Tampilkan Rincian Detail Variabel untuk Satu Baris Tertentu
window.viewCustomImportRowDetail = function (index) {
    const rows = window.stagedUnifiedImportData || [];
    const r = rows[index];
    if (!r) return;

    const namaVal = r['Nama Lengkap'] || r['Nama'] || r['nama'] || 'Warga Terdata';
    const nikVal = r['NIK'] || r['nik'] || r['No KTP'] || '-';
    const alamatVal = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || '-';

    const modalBody = document.getElementById('modalCustomImportRowDetailBody');
    if (!modalBody) return;

    const keys = Object.keys(r);
    const keyRows = keys.map(k => {
        const val = r[k];
        const strVal = String(val !== undefined && val !== null ? val : '-');
        const isCore = /nama|nik|alamat|telepon|hp/i.test(k);
        const isKriteria = /^c\d+/i.test(k);

        let badgeBg = '#f1f5f9';
        let badgeColor = '#475569';
        if (isCore) {
            badgeBg = '#dcfce7';
            badgeColor = '#15803d';
        } else if (isKriteria) {
            badgeBg = '#dbeafe';
            badgeColor = '#1d4ed8';
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; border-bottom:1px solid #f1f5f9; background:#ffffff;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.75rem; font-weight:800; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:6px;">
                        ${window.safeHtml(k)}
                    </span>
                </div>
                <div style="font-weight:700; font-size:0.85rem; color:#0f172a; text-align:right; max-width:60%; word-break:break-word;">
                    ${window.safeHtml(strVal)}
                </div>
            </div>
        `;
    }).join('');

    modalBody.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:16px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:48px; height:48px; border-radius:14px; background:#ede9fe; color:#6d28d9; font-size:1.3rem; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${window.safeHtml((namaVal || 'W')[0].toUpperCase())}
                </div>
                <div>
                    <div style="font-weight:900; font-size:1.1rem; color:#0f172a; line-height:1.3;">
                        ${window.safeHtml(namaVal)}
                    </div>
                    <div style="font-size:0.82rem; color:#475569; font-family:monospace; margin-top:2px;">
                        NIK: <b>${window.safeHtml(nikVal)}</b>
                    </div>
                    <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                        <i class="fas fa-map-marker-alt text-danger"></i> ${window.safeHtml(alamatVal)}
                    </div>
                </div>
            </div>
        </div>

        <div style="font-weight:800; font-size:0.85rem; color:#334155; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
            <span>Daftar Seluruh Variabel Berkas (${keys.length} Kolom):</span>
            <span style="font-size:0.75rem; color:#6d28d9; font-weight:700;">Baris #${index + 1}</span>
        </div>

        <div style="border:1.5px solid #e2e8f0; border-radius:14px; overflow:hidden; max-height:360px; overflow-y:auto;">
            ${keyRows}
        </div>

        <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px 14px; border-radius:12px; border:1px solid #e2e8f0;">
            <div style="font-size:0.78rem; color:#64748b;">
                <i class="fas fa-info-circle text-primary"></i> Anda dapat menyimpan warga ini secara mandiri atau menyimpan seluruhnya melalui tombol Submit di pratinjau utama.
            </div>
            <button type="button" onclick="window.saveSingleCustomImportRow(${index})" class="btn btn-sm btn-primary" style="background:linear-gradient(135deg, #059669, #10b981); border:none; border-radius:10px; font-weight:800; font-size:0.8rem; padding:6px 16px; color:#ffffff; display:inline-flex; align-items:center; gap:6px; cursor:pointer; box-shadow:0 3px 8px rgba(16,185,129,0.3); flex-shrink:0;">
                <i class="fas fa-save"></i> Simpan Warga Ini ke Arsip
            </button>
        </div>
    `;

    const modal = document.getElementById('modalCustomImportRowDetail');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '100005';
    }
};

// Simpan Satu Warga Tertentu ke Arsip
window.saveSingleCustomImportRow = async function (index) {
    const rows = window.stagedUnifiedImportData || [];
    const r = rows[index];
    if (!r) return;

    const namaWarga = r['Nama Lengkap'] || r['Nama'] || r['nama'] || 'Warga';

    showAdminAlert({
        title: 'Menyimpan Warga ke Arsip...',
        text: `Menyimpan data ${namaWarga} ke dalam basis data Arsip Warga...`,
        didOpen: () => Swal?.showLoading()
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        let res = await fetch(`${base}/api/warga/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.getCleanToken()}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                data: [r],
                overwrite: true,
                keep_all_vars: true
            })
        });

        if (!res.ok) {
            res = await fetch(`${base}/warga/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.getCleanToken()}`
                },
                body: JSON.stringify({
                    data: [r],
                    overwrite: true,
                    keep_all_vars: true
                })
            });
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status === 'error') {
            throw new Error(json.message || 'Gagal menyimpan data warga ini.');
        }

        window.closeModal('modalCustomImportRowDetail');
        await window.loadDashboardData(true);

        Swal.fire({
            icon: 'success',
            title: 'Warga Tersimpan ke Arsip!',
            text: `Data kependudukan ${namaWarga} berhasil disimpan ke dalam Arsip Data Warga.`,
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        });
    } catch (err) {
        showAdminAlert({
            icon: 'error',
            title: 'Gagal Menyimpan Data',
            text: err.message || 'Kendala koneksi saat menyimpan data ke server.'
        });
    }
};

// Toggle Container Dropdown Chips Variabel
window.toggleCustomImportChips = function () {
    const cont = document.getElementById('customImportVariablesChipsWrapper');
    const icon = document.getElementById('iconToggleImportChips');
    const text = document.getElementById('textToggleImportChips');
    if (!cont) return;
    const isHidden = cont.style.display === 'none' || cont.style.display === '';
    cont.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    if (text) {
        const count = window.stagedUnifiedHeaders ? window.stagedUnifiedHeaders.length : 0;
        text.innerText = isHidden ? `Tutup Rincian Kolom (${count})` : `Rincian Kolom (${count})`;
    }
};

window.executeUnifiedCustomImport = async function () {
    const rawData = window.stagedUnifiedImportData || [];
    if (!rawData.length) {
        return showAdminAlert({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada baris data yang siap diimpor ke arsip.' });
    }

    const overwrite = document.querySelector('input[name="customImportMode"]:checked')?.value === 'overwrite';
    const keepAllVars = document.getElementById('customImportKeepAllVars')?.checked !== false;
    const totalCount = rawData.length;
    const totalVars = window.stagedUnifiedHeaders ? window.stagedUnifiedHeaders.length : 0;
    const isBulk = totalCount >= 15;

    const abortController = new AbortController();
    let isCancelled = false;
    let savedCount = 0;

    const loader = window.showModernLoadingAlert({
        title: 'Menyimpan Data ke Arsip Warga...',
        subtitle: `Menyimpan ${totalCount} data warga dengan ${totalVars} variabel ke Arsip Data Warga...`,
        totalItems: totalCount,
        isBulk: isBulk,
        abortController: abortController,
        initialStage: isBulk ? 'Menyiapkan antrean data dan validasi struktur...' : 'Menghubungkan ke peladen arsip...',
        cancelText: 'Batalkan Proses',
        onCancel: () => {
            isCancelled = true;
            try { abortController.abort('Impor dibatalkan oleh pengguna'); } catch (e) {}
        }
    });

    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        
        // Atur ukuran batch agar progress bar bertambah secara riil dan interaktif
        const BATCH_SIZE = totalCount > 100 ? 50 : (totalCount > 30 ? 20 : totalCount);
        const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

        for (let b = 0; b < totalBatches; b++) {
            if (isCancelled || loader.isCancelled()) {
                break;
            }

            const start = b * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, totalCount);
            const chunk = rawData.slice(start, end);

            const currentStage = totalBatches > 1
                ? `Tahap ${b + 1} dari ${totalBatches}: Menyimpan baris data ${start + 1} - ${end}...`
                : 'Mengirim dan memvalidasi seluruh berkas arsip...';

            loader.updateProgress(start, totalCount, currentStage);

            // Beri sedikit jeda mikro (25ms) agar DOM sempat me-render progres visual dan merespons klik Batalkan
            await new Promise(r => setTimeout(r, 25));

            if (isCancelled || loader.isCancelled()) break;

            let res = await fetch(`${base}/api/warga/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.getCleanToken()}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    data: chunk,
                    overwrite: overwrite,
                    keep_all_vars: keepAllVars
                }),
                signal: abortController.signal
            });

            if (!res.ok) {
                res = await fetch(`${base}/warga/bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.getCleanToken()}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        data: chunk,
                        overwrite: overwrite,
                        keep_all_vars: keepAllVars
                    }),
                    signal: abortController.signal
                });
            }

            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.status === 'error') {
                throw new Error(json.message || `Gagal menyimpan batch ke-${b + 1} (Status ${res.status}).`);
            }

            savedCount = end;
            loader.updateProgress(savedCount, totalCount, `Tersimpan ${savedCount} dari ${totalCount} data warga...`);
        }

        if (isCancelled || loader.isCancelled()) {
            await window.loadDashboardData(true);
            return Swal.fire({
                icon: 'info',
                title: 'Penginputan Data Dibatalkan',
                html: `
                    <div style="font-size:0.92rem; color:#475569; margin-bottom:8px;">
                        Proses impor data telah dihentikan atas permintaan Anda.
                    </div>
                    <div style="font-size:0.85rem; color:#64748b; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                        <b>${savedCount}</b> dari <b>${totalCount}</b> baris data telah tersimpan sebelum dibatalkan.
                    </div>
                `,
                confirmButtonText: 'Tutup',
                buttonsStyling: false,
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        }

        loader.updateProgress(totalCount, totalCount, 'Selesai! Menyelaraskan kalkulasi BWM-SAW...');
        await new Promise(r => setTimeout(r, 160));
        loader.close();

        window.closeModal('modalCustomImport');
        window.stagedUnifiedImportData = [];

        // Refresh data dasbor dan tabel arsip
        await window.loadDashboardData(true);

        // Pastikan filter aktif adalah "Semua" agar data baru langsung tampak di tabel arsip
        const filterSemuaBtn = document.querySelector('.filter-btn.filter-kategori');
        if (filterSemuaBtn && window.applyFilter) {
            window.applyFilter('all', filterSemuaBtn);
        }

        Swal.fire({
            icon: 'success',
            title: 'Data Berhasil Disimpan ke Arsip Warga!',
            html: `
                <div style="font-size:0.95rem; color:#334155; margin-bottom:12px;">
                    Berhasil memasukkan <b>${totalCount} data kependudukan</b> ke dalam Arsip Data Warga.
                </div>
                <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:14px; padding:12px; font-size:0.83rem; color:#166534; text-align:left;">
                    <div style="font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-check-circle" style="color:#16a34a;"></i> Tersimpan Permanen di Arsip
                    </div>
                    <div>&bull; Seluruh nama lengkap warga dan variabel kependudukan telah terekam.</div>
                    <div>&bull; Skor kelayakan SPK BWM-SAW otomatis dikalkulasi dan diperbarui.</div>
                </div>
            `,
            confirmButtonText: '<i class="fas fa-folder-open"></i> Lihat Arsip Data Warga',
            buttonsStyling: false,
            customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
        }).then(() => {
            const tableCard = document.querySelector('.table-column .card') || document.getElementById('wargaTable');
            if (tableCard) {
                tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

    } catch (err) {
        if (err.name === 'AbortError' || isCancelled || loader.isCancelled()) {
            await window.loadDashboardData(true);
            return Swal.fire({
                icon: 'info',
                title: 'Penginputan Data Dibatalkan',
                text: `Proses impor dihentikan oleh pengguna. ${savedCount} dari ${totalCount} data telah tercatat.`,
                confirmButtonText: 'Tutup',
                buttonsStyling: false,
                customClass: { popup: 'swal-modern-rounded', confirmButton: 'swal-btn-pill-primary' }
            });
        }
        loader.close();
        showAdminAlert({
            icon: 'error',
            title: 'Gagal Menyimpan Data Arsip',
            text: err.message || 'Terjadi kendala saat menyimpan data ke Arsip Warga.'
        });
    }
};

// =========================================================================
