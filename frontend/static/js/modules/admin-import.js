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

if (typeof window.safeHtml !== 'function') {
    window.safeHtml = function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}

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
// =========================================================================
// NORMALIZER CERDAS UNIVERSAL DATA WARGA (EXCEL, WORD, PDF)
// =========================================================================
window.normalizeImportCitizenRow = function (r, rowIdx = 0) {
    if (!r || typeof r !== 'object') return null;
    const keys = Object.keys(r);
    if (keys.length === 0) return null;

    // Helper pencarian nilai berdasarkan sinonim / alias
    function getVal(aliases) {
        // 1. Pencocokan tepat (Exact Match)
        for (const alias of aliases) {
            const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const k of keys) {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanK === cleanAlias) {
                    const val = r[k];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return val;
                    }
                }
            }
        }
        // 2. Pencocokan substring dengan aturan pengecualian ketat
        for (const alias of aliases) {
            const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const k of keys) {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Alamat tidak boleh mengambil nilai dari kolom email / surel
                if (cleanAlias.includes('alamat') && (cleanK.includes('email') || cleanK.includes('surel') || cleanK.includes('mail'))) {
                    continue;
                }
                if (cleanAlias.length >= 4 && cleanK.includes(cleanAlias)) {
                    const val = r[k];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return val;
                    }
                }
            }
        }
        return undefined;
    }

    // 1. Ekstraksi NIK (16 Digit Monospace)
    let nik = '';
    const nikVal = getVal(['nik', 'nomorindukkependudukan', 'noktp', 'ktp', 'nonik', 'noidentitas', 'identitas', 'nomor_nik', 'nik16digit', 'no_ktp', 'nomor_identitas']);
    if (nikVal !== undefined) {
        let s = String(nikVal).trim();
        const num = Number(s);
        if (!isNaN(num) && /e\+/i.test(s)) {
            s = BigInt(Math.round(num)).toString();
        }
        const digits = s.replace(/[^0-9]/g, '');
        if (digits.length >= 8) nik = digits;
    }
    if (!nik) {
        for (const [k, v] of Object.entries(r)) {
            const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (kLow.includes('nik') || kLow.includes('ktp') || kLow.includes('identitas')) {
                const s = String(v || '').trim();
                const digits = s.replace(/[^0-9]/g, '');
                if (digits.length >= 8) { nik = digits; break; }
            }
        }
    }
    if (!nik) {
        for (const v of Object.values(r)) {
            const s = String(v || '').trim();
            const digits = s.replace(/[^0-9]/g, '');
            if (digits.length === 16) { nik = digits; break; }
        }
    }
    if (!nik) {
        const randPart = String(Date.now()).slice(-8) + String(rowIdx).padStart(4, '0');
        nik = `3515${randPart}`;
    }

    // 2. Ekstraksi Nama Lengkap (Menjaga Gelar Akademik & Kehormatan)
    let nama = '';
    const namaVal = getVal(['nama', 'namalengkap', 'namawarga', 'namapenduduk', 'namapenerima', 'namakk', 'namakrt', 'name', 'nama_lengkap', 'nama_warga', 'nama_penduduk']);
    if (namaVal !== undefined) {
        nama = String(namaVal).trim().replace(/^[\d\.\)\s_-]+/, '').trim();
        nama = nama.replace(/\s+(Ada\s*\([^)]*\)|Ada\s*\(.*|Tidak Ada\b.*)$/i, '').trim();
    }
    if (!nama) {
        for (const [k, v] of Object.entries(r)) {
            const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (kLow.includes('nama') && !kLow.includes('ayah') && !kLow.includes('ibu') && !kLow.includes('petugas') && !kLow.includes('operator') && !kLow.includes('desa') && !kLow.includes('kecamatan') && !kLow.includes('kelurahan') && !kLow.includes('bank')) {
                const s = String(v || '').trim().replace(/^[\d\.\)\s_-]+/, '').trim();
                if (s.length >= 2 && !/^\d+$/.test(s)) { nama = s; break; }
            }
        }
    }
    if (!nama) {
        nama = `Warga (${nik.slice(-4)})`;
    }

    // 3. Ekstraksi Tempat & Tanggal Lahir (TTL)
    let tempatLahir = '';
    let tanggalLahir = '';

    const ttlVal = getVal(['ttl', 'tempattanggallahir', 'tempat_tanggal_lahir', 'tempat_tgl_lahir', 'tempat/tgl lahir', 'tempat / tanggal lahir']);
    if (ttlVal !== undefined) {
        const s = String(ttlVal).trim();
        const parts = s.split(/[,/]/);
        if (parts.length >= 2) {
            tempatLahir = parts[0].trim();
            tanggalLahir = parts.slice(1).join(',').trim();
        } else {
            tempatLahir = s;
        }
    }

    if (!tempatLahir) {
        const tVal = getVal(['tempatlahir', 'tempat_lahir', 'tmplahir', 'kotalahir', 'tempat', 'kota_lahir']);
        if (tVal !== undefined) tempatLahir = String(tVal).trim();
    }
    if (!tanggalLahir) {
        const dVal = getVal(['tanggallahir', 'tanggal_lahir', 'tgllahir', 'tgl_lahir', 'tgl', 'birthdate', 'dob']);
        if (dVal !== undefined) tanggalLahir = String(dVal).trim();
    }

    function parseDateToIso(rawDate) {
        if (!rawDate) return '';
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            return rawDate.toISOString().slice(0, 10);
        }
        let s = String(rawDate).trim();
        const num = Number(s);
        if (!isNaN(num) && num > 1000 && num < 60000) {
            const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
        }
        const isoMatch = s.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        const dmyMatch = s.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/);
        if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
        const indMonthMatch = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (indMonthMatch) {
            const day = indMonthMatch[1].padStart(2, '0');
            const mStr = indMonthMatch[2].toLowerCase();
            const year = indMonthMatch[3];
            const mIdx = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']
                .findIndex(m => mStr.startsWith(m));
            if (mIdx !== -1) {
                return `${year}-${String(mIdx + 1).padStart(2, '0')}-${day}`;
            }
        }
        return s.slice(0, 10);
    }

    tanggalLahir = parseDateToIso(tanggalLahir);

    // Deduksi otomatis dari NIK jika tanggal lahir belum tertera
    if (!tanggalLahir && nik && nik.length === 16 && /^\d{16}$/.test(nik)) {
        let day = parseInt(nik.slice(6, 8), 10);
        if (day > 40) day -= 40;
        const month = parseInt(nik.slice(8, 10), 10);
        let yearPart = parseInt(nik.slice(10, 12), 10);
        const year = yearPart > 26 ? (1900 + yearPart) : (2000 + yearPart);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            tanggalLahir = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    if (!tanggalLahir) tanggalLahir = '1985-05-15';
    if (!tempatLahir) tempatLahir = 'Sidoarjo';

    // 4. Rekonstruksi Alamat Lengkap Cerdas (Menyatukan Komponen Wilayah)
    let alamat = '';
    const directAlamat = getVal(['alamatlengkap', 'alamat_lengkap', 'alamatdomisili', 'alamat_domisili', 'alamatktp', 'alamat_ktp', 'alamat', 'domisili']);
    if (directAlamat !== undefined && String(directAlamat).trim().length >= 5 && !String(directAlamat).includes('@') && !String(directAlamat).includes('.com') && !String(directAlamat).includes('.id')) {
        alamat = String(directAlamat).trim();
    }
    if (!alamat || alamat.toLowerCase() === 'kabupaten sidoarjo') {
        const jalan = getVal(['jalan', 'jl', 'nama_jalan', 'namajalan']) || '';
        const rtRw = getVal(['rt_rw', 'rtrw', 'rt', 'rw']) || '';
        const desa = getVal(['desa', 'kelurahan', 'desakelurahan', 'desa_kelurahan']) || '';
        const kec = getVal(['kecamatan', 'kec']) || '';
        const kab = getVal(['kabupaten', 'kota', 'kab']) || 'Kabupaten Sidoarjo';

        const parts = [];
        if (jalan) parts.push(String(jalan).trim());
        if (rtRw) parts.push(`RT/RW ${String(rtRw).trim()}`);
        if (desa) parts.push(`Desa/Kel. ${String(desa).trim()}`);
        if (kec) parts.push(`Kec. ${String(kec).trim()}`);
        if (kab) parts.push(String(kab).trim());

        if (parts.length >= 2) {
            alamat = parts.join(', ');
        } else if (desa || kec) {
            alamat = `Wilayah ${desa ? 'Desa ' + desa : ''} ${kec ? 'Kec. ' + kec : ''}, Kabupaten Sidoarjo`.trim();
        }
    }
    if (!alamat) alamat = 'Kabupaten Sidoarjo';

    // 5. Normalisasi No. WhatsApp / HP (Auto-Prefix 0 & Anti Exponential)
    let noHp = '';
    const hpVal = getVal(['nowhatsapp', 'no_whatsapp', 'nowa', 'no_wa', 'nohp', 'no_hp', 'telepon', 'notelepon', 'whatsapp', 'phone', 'hp', 'handphone']);
    if (hpVal !== undefined) {
        let s = String(hpVal).trim();
        const num = Number(s);
        if (!isNaN(num) && /e\+/i.test(s)) {
            s = BigInt(Math.round(num)).toString();
        }
        let digits = s.replace(/[^0-9]/g, '');
        if (digits.startsWith('62')) {
            digits = '0' + digits.slice(2);
        } else if (digits.length >= 8 && !digits.startsWith('0')) {
            digits = '0' + digits;
        }
        if (digits.length >= 9) noHp = digits;
    }

    // 6. Normalisasi Email
    let email = '';
    const emVal = getVal(['email', 'surel', 'e_mail', 'alamat_email']);
    if (emVal !== undefined) {
        email = String(emVal).trim();
    } else {
        for (const v of Object.values(r)) {
            const s = String(v || '').trim();
            if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(s)) {
                email = s;
                break;
            }
        }
    }

    // 7. Normalisasi Koordinat GPS
    let lat = -7.4478;
    let lng = 112.7183;
    const latVal = getVal(['garislintang', 'garis_lintang', 'latitude', 'lat', 'lintang']);
    const lngVal = getVal(['garisbujur', 'garis_bujur', 'longitude', 'long', 'lng', 'bujur']);
    if (latVal !== undefined) {
        const p = parseFloat(String(latVal).replace(',', '.'));
        if (!isNaN(p) && p !== 0) lat = p;
    }
    if (lngVal !== undefined) {
        const p = parseFloat(String(lngVal).replace(',', '.'));
        if (!isNaN(p) && p !== 0) lng = p;
    }

    // 8. Normalisasi Nilai Numerik Kriteria SPK (Dukungan Mata Uang Rp & Koma Desimal)
    function parseNumSafe(val, def = 0) {
        if (val === null || val === undefined) return def;
        if (typeof val === 'number') return isFinite(val) ? val : def;
        let s = String(val).trim();
        if (!s) return def;
        s = s.replace(/^(?:rp\.?|idr)\s*/i, '').replace(/[a-zA-Z%]/g, '').trim();
        if (!s) return def;
        if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (/^\d+(?:,\d+)$/.test(s)) {
            s = s.replace(',', '.');
        } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) {
            s = s.replace(/,/g, '');
        }
        const num = Number(s);
        return isFinite(num) ? num : def;
    }

    const c1Raw = getVal(['c1_ekonomi', 'c1ekonomi', 'c1_penghasilan_kk', 'c1penghasilankk', 'c1', 'penghasilankk', 'penghasilan_kk', 'penghasilan', 'pendapatan', 'gaji', 'c01', 'k01_penghasilan']);
    const c1 = c1Raw !== undefined ? parseNumSafe(c1Raw, 1500000) : 1500000;

    const c2Raw = getVal(['c2_aset', 'c2aset', 'c2_luas_lantai', 'c2luaslantai', 'c2_pengeluaran_total', 'c2pengeluarantotal', 'c2', 'aset', 'luas_lantai', 'luaslantai', 'pengeluaran', 'pengeluaran_total', 'c02', 'k01_luas_lantai_kapita', 'k01luaslantaikapita']);
    const c2 = c2Raw !== undefined ? parseNumSafe(c2Raw, 5000000) : 5000000;

    const c3Raw = getVal(['c3_umur_kk', 'c3umurkk', 'c3_umur', 'c3umur', 'c3_usia_kk', 'c3usiakk', 'c3', 'usia_kk', 'usiakk', 'umur_kk', 'umurkk', 'usia', 'umur', 'c03', 'k03_usia']);
    const c3 = c3Raw !== undefined ? Math.round(parseNumSafe(c3Raw, 45)) : 45;

    const c4Raw = getVal(['c4_jenis_kelamin', 'c4jeniskelamin', 'c4_kelamin', 'c4_jumlah_tanggungan', 'c4jumlahtanggungan', 'c4_tanggungan', 'c4tanggungan', 'c4', 'jenis_kelamin', 'jumlah_tanggungan', 'jumlahtanggungan', 'tanggungan', 'c04', 'k04_tanggungan']);
    let c4 = 1;
    if (c4Raw !== undefined) {
        const s = String(c4Raw).toLowerCase().trim();
        if (s === '2' || s.includes('perempuan') || s.includes('wanita') || s === 'p') c4 = 2;
        else if (s === '1' || s.includes('laki') || s.includes('pria') || s === 'l') c4 = 1;
        else c4 = Math.round(parseNumSafe(c4Raw, 1));
    }

    const c5Raw = getVal(['c5_tanggungan', 'c5tanggungan', 'c5_jml_tanggungan', 'c5_daya_listrik', 'c5dayalistrik', 'c5_listrik', 'c5listrik', 'c5', 'tanggungan', 'daya_listrik', 'dayalistrik', 'listrik', 'c05', 'k05_listrik']);
    let c5 = 3;
    if (c5Raw !== undefined) {
        const s = String(c5Raw).toLowerCase().trim();
        if (s.includes('450')) c5 = 1;
        else if (s.includes('900')) c5 = 2;
        else if (s.includes('1300')) c5 = 3;
        else if (s.includes('2200') || s.includes('>')) c5 = 4;
        else c5 = Math.round(parseNumSafe(c5Raw, 3));
    }

    const c6Raw = getVal(['c6_status_kawin', 'c6statuskawin', 'c6_sumber_air', 'c6sumberair', 'c6_air', 'c6air', 'c6', 'status_kawin', 'sumber_air', 'sumberair', 'air', 'c06', 'k06_air']);
    let c6 = 2;
    if (c6Raw !== undefined) {
        const s = String(c6Raw).toLowerCase().trim();
        if (s.includes('cerai') || s.includes('mati') || s.includes('duda') || s.includes('janda')) c6 = 3;
        else if (s.includes('kawin') || s.includes('nikah')) c6 = 2;
        else if (s.includes('belum')) c6 = 1;
        else c6 = Math.round(parseNumSafe(c6Raw, 2));
    }

    const c7Raw = getVal(['c7_jml_anak', 'c7jmlanak', 'c7_jumlah_anak', 'c7_kepemilikan_tabungan', 'c7kepemilikantabungan', 'c7_tabungan', 'c7tabungan', 'c7', 'anak', 'tabungan', 'aset', 'c07', 'k07_aset']);
    const c7 = c7Raw !== undefined ? Math.round(parseNumSafe(c7Raw, 2)) : 2;

    const c8Raw = getVal(['c8_tempat_tinggal', 'c8tempattinggal', 'c8_status_rumah', 'c8statusrumah', 'c8', 'k10_status_rumah', 'k10statusrumah', 'statusrumah', 'status_rumah', 'tempat_tinggal', 'c08']);
    let c8 = 2;
    if (c8Raw !== undefined) {
        const s = String(c8Raw).toLowerCase().trim();
        if (s === '1' || s.includes('sendiri') || s.includes('milik sendiri') || s.includes('shm')) c8 = 1;
        else if (s === '3' || s.includes('sewa') || s.includes('rusak') || s.includes('tidak layak') || s.includes('gubuk') || s.includes('bantaran') || s.includes('bukan milik')) c8 = 3;
        else if (s === '2' || s.includes('numpang') || s.includes('kontrak') || s.includes('dinas')) c8 = 2;
        else c8 = Math.round(parseNumSafe(c8Raw, 2));
    }

    const c9Raw = getVal(['c9_pendidikan_kk', 'c9pendidikankk', 'c9', 'pendidikan_kk', 'pendidikankk', 'pendidikan', 'c09']);
    let c9 = 1;
    if (c9Raw !== undefined) {
        const s = String(c9Raw).toLowerCase().trim();
        if (s.includes('sarjana') || s.includes('diploma') || s.includes('s1') || s.includes('s2') || s.includes('s3') || s.includes('pt') || s.includes('doktor')) c9 = 4;
        else if (s.includes('sma') || s.includes('smk') || s.includes('aliyah')) c9 = 3;
        else if (s.includes('smp') || s.includes('mts')) c9 = 2;
        else if (s.includes('sd') || s.includes('tidak') || s.includes('belum sekolah')) c9 = 1;
        else c9 = Math.round(parseNumSafe(c9Raw, 1));
    }

    const c10Raw = getVal(['c10_kesehatan', 'c10kesehatan', 'c10_disabilitas', 'c10disabilitas', 'c10', 'kesehatan', 'disabilitas', 'c010']);
    let c10 = 1;
    if (c10Raw !== undefined) {
        const s = String(c10Raw).toLowerCase().trim();
        if (s.includes('disabilitas') || s.includes('cacat') || s.includes('lumpuh')) c10 = 3;
        else if (s.includes('kronis') || s.includes('menahun') || s.includes('sakit')) c10 = 2;
        else if (s.includes('sehat') || s.includes('normal')) c10 = 1;
        else c10 = Math.round(parseNumSafe(c10Raw, 1));
    }

    // Terapkan standardisasi lengkap pada r tanpa menghapus variabel asli
    r['NIK'] = nik;
    r['nik'] = nik;
    r['Nama Lengkap'] = nama;
    r['Nama'] = nama;
    r['nama'] = nama;
    r['Tempat Lahir'] = tempatLahir;
    r['tempat_lahir'] = tempatLahir;
    r['Tanggal Lahir'] = tanggalLahir;
    r['tanggal_lahir'] = tanggalLahir;
    r['TTL'] = `${tempatLahir}, ${tanggalLahir}`;
    r['Alamat Lengkap'] = alamat;
    r['Alamat'] = alamat;
    r['alamat'] = alamat;
    r['No WhatsApp'] = noHp;
    r['No. WA'] = noHp;
    r['No HP'] = noHp;
    r['no_hp'] = noHp;
    r['Email'] = email;
    r['email'] = email;
    r['Garis Lintang'] = lat;
    r['lat'] = lat;
    r['Garis Bujur'] = lng;
    r['lng'] = lng;
    r['C1'] = c1;
    r['C2'] = c2;
    r['C3'] = c3;
    r['C4'] = c4;
    r['C5'] = c5;
    r['C6'] = c6;
    r['C7'] = c7;
    r['C8'] = c8;
    r['C9'] = c9;
    r['C10'] = c10;

    return r;
};

// =========================================================================
// 1. PARSER BERKAS EXCEL (.xlsx, .xls, .csv) DENGAN MULTI-SHEET & FORMAT TANGGAL
// =========================================================================
window.parseExcelFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
                
                // Cari lembar kerja yang memiliki baris data kependudukan
                let activeSheet = null;
                let rawAoA = null;

                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, dateNF: 'yyyy-mm-dd' });
                    if (aoa && aoa.length >= 2) {
                        const sampleText = aoa.slice(0, 10).map(r => Array.isArray(r) ? r.join(' ') : '').join(' ').toLowerCase();
                        if (sampleText.includes('nik') || sampleText.includes('nama') || sampleText.includes('ktp') || sampleText.includes('alamat')) {
                            activeSheet = sheet;
                            rawAoA = aoa;
                            break;
                        }
                    }
                }

                if (!rawAoA) {
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    rawAoA = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false, dateNF: 'yyyy-mm-dd' });
                }

                if (!rawAoA || rawAoA.length === 0) {
                    throw new Error('Lembar kerja Excel kosong.');
                }

                // Cari baris header tabel kependudukan sebenarnya
                let headerRowIdx = -1;
                for (let r = 0; r < Math.min(rawAoA.length, 20); r++) {
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

                        const norm = window.normalizeImportCitizenRow(obj, rows.length);
                        if (norm) rows.push(norm);
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

// =========================================================================
// 2. PARSER BERKAS WORD (.docx, .doc) DENGAN NORMALISASI KATEGORI LENGKAP
// =========================================================================
window.parseWordFile = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                let rows = [];

                if (window.mammoth && typeof window.mammoth.convertToHtml === 'function') {
                    const result = await window.mammoth.convertToHtml({ arrayBuffer, buffer: typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : undefined });
                    const html = result.value || '';
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const tables = doc.querySelectorAll('table');

                    if (tables.length > 0) {
                        const parsedTables = [];
                        for (let tIdx = 0; tIdx < tables.length; tIdx++) {
                            const table = tables[tIdx];
                            const trs = Array.from(table.querySelectorAll('tr'));
                            if (trs.length >= 2) {
                                let headerIdx = 0;
                                for (let r = 0; r < Math.min(trs.length, 5); r++) {
                                    const text = (trs[r].textContent || trs[r].innerText || "").toLowerCase();
                                    if (text.includes('nik') || text.includes('nama') || text.includes('alamat') || text.includes('kriteria') || text.includes('kecamatan') || text.includes('c1_') || text.includes('no')) {
                                        headerIdx = r;
                                        break;
                                    }
                                }

                                const headerCells = Array.from(trs[headerIdx].querySelectorAll('th, td')).map((c, i) => (c.textContent || c.innerText || "").trim() || `Kolom_${i + 1}`);
                                const tableRows = [];
                                for (let i = headerIdx + 1; i < trs.length; i++) {
                                    const cells = Array.from(trs[i].querySelectorAll('td')).map(c => (c.textContent || c.innerText || "").trim());
                                    if (cells.some(c => c.length > 0)) {
                                        const rowObj = {};
                                        headerCells.forEach((h, hIdx) => {
                                            rowObj[h] = cells[hIdx] !== undefined ? cells[hIdx] : '';
                                        });
                                        tableRows.push(rowObj);
                                    }
                                }
                                if (tableRows.length > 0) {
                                    parsedTables.push(tableRows);
                                }
                            }
                        }

                        if (parsedTables.length === 1) {
                            rows = parsedTables[0];
                        } else if (parsedTables.length > 1) {
                            // Cek apakah tabel multi-block dari warga yang sama (misal Blok I s/d VII DTSEN)
                            const isMultiBlock = parsedTables.every(tbl => {
                                if (tbl.length !== parsedTables[0].length) return false;
                                const firstRow = tbl[0];
                                return firstRow['No'] !== undefined || firstRow['Nama Lengkap'] !== undefined || firstRow['Nama'] !== undefined;
                            });

                            if (isMultiBlock) {
                                const mergedMap = new Map();
                                parsedTables.forEach(tbl => {
                                    tbl.forEach((row, rIdx) => {
                                        const noVal = row['No'] !== undefined ? String(row['No']).trim() : '';
                                        const key = /^\d+$/.test(noVal)
                                            ? `no_${noVal}`
                                            : (row['Nomor NIK'] || row['NIK'] || row['Nama Lengkap'] || row['Nama'] || `idx_${rIdx}`);
                                        if (!mergedMap.has(key)) {
                                            mergedMap.set(key, { ...row });
                                        } else {
                                            Object.assign(mergedMap.get(key), row);
                                        }
                                    });
                                });
                                rows = Array.from(mergedMap.values());
                            } else {
                                parsedTables.forEach(tbl => rows.push(...tbl));
                            }
                        }
                    }

                    // 2. Jika tidak ada tabel multi-kolom, parsing paragraf teks terstruktur
                    if (rows.length === 0) {
                        const paragraphs = Array.from(doc.querySelectorAll('p, li')).map(p => (p.textContent || p.innerText || "").trim()).filter(Boolean);
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
                                if (nikMatch) currentWarga['NIK'] = nikMatch[1];
                                if (namaMatch) currentWarga['Nama Lengkap'] = namaMatch[1].trim();
                                if (alamatMatch) currentWarga['Alamat'] = alamatMatch[1].trim();
                            }
                        });
                        if (currentWarga && (currentWarga['NIK'] || currentWarga['Nama'])) {
                            rows.push(currentWarga);
                        }
                    }
                }

                if (rows.length === 0) {
                    throw new Error('Tidak ditemukan tabel atau data kependudukan yang valid di dalam dokumen Word.');
                }

                // Urutkan warga jika ada kolom No
                rows.sort((a, b) => {
                    const noA = parseInt(String(a['No'] || '9999'), 10);
                    const noB = parseInt(String(b['No'] || '9999'), 10);
                    return noA - noB;
                });

                const normalizedRows = rows.map((r, i) => window.normalizeImportCitizenRow(r, i)).filter(Boolean);
                resolve(normalizedRows);
            } catch (err) {
                reject(new Error('Gagal mengekstrak data dari dokumen Word: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas Word.'));
        reader.readAsArrayBuffer(file);
    });
};

// =========================================================================
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

                const allPagesLines = [];
                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    const lineMap = new Map();
                    textContent.items.forEach(item => {
                        const str = (item.str || '').trim();
                        if (!str && str !== '0') return;
                        
                        const y = Math.round(item.transform[5] * 10) / 10;
                        let matchedY = null;
                        for (const key of lineMap.keys()) {
                            if (Math.abs(key - y) <= 6.5) {
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

                    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
                    sortedY.forEach(y => {
                        const rawItems = lineMap.get(y).sort((a, b) => a.x - b.x);
                        
                        const mergedItems = [];
                        let cur = null;
                        rawItems.forEach(it => {
                            if (!cur) {
                                cur = { ...it, str: it.str.trim() };
                            } else {
                                const gap = it.x - (cur.x + cur.width);
                                if (gap < 4 && gap > -5) {
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

                let currentBlockColumns = null;
                const citizenMap = new Map();
                const unkeyedRows = [];

                if (allPagesLines.length > 0) {
                    for (let i = 0; i < allPagesLines.length; i++) {
                        const line = allPagesLines[i];
                        const txt = line.lineText.toLowerCase().trim();
                        if (!txt) continue;

                        // Abaikan teks judul dokumen / header instansi / footer halaman
                        if (/^(pemerintah|rekapitulasi|total data|halaman|page|\d+\s*\/\s*\d+)/i.test(txt)) {
                            continue;
                        }
                        if (/^blok\s+[ivx]+\s*:/i.test(txt)) {
                            continue;
                        }

                        // Deteksi Baris Header Tabel (Dinamis per Blok & per Halaman)
                        const hasHeaderKeywords = /(^|\b)(no|nik|nomor\s*nik|nama|nama\s*lengkap|alamat|whatsapp|telepon|hp|email|surel|kecamatan|desa|kelurahan|ttl|tempat|tanggal|latitude|longitude|c\d+|c0\d+|kriteria|ekonomi|aset|umur|usia|kelamin|tanggungan|kawin|pendidikan|kesehatan|disabilitas|pangan|dinding|atap|penerangan|daya|air|sanitasi|tabungan|motor)($|\b)/i.test(txt);
                        const isDataRow = /\b(35\d{14}|\d{16})\b/.test(txt) || /\S+@\S+\.\S+/.test(txt) || /rp\.?\s*\d+/i.test(txt) || /^\d+\s+[A-Za-z\s\.\,\']{3,}/.test(line.lineText.trim());

                        if (hasHeaderKeywords && !isDataRow && line.items.length >= 2) {
                            // Update batas-batas kolom aktif ke header blok baru ini
                            const detectedCols = line.items.map(it => ({
                                name: it.str.trim(),
                                x: it.x,
                                width: it.width,
                                rightX: it.x + it.width
                            }));
                            for (let c = 0; c < detectedCols.length; c++) {
                                const col = detectedCols[c];
                                const prev = detectedCols[c - 1];
                                const next = detectedCols[c + 1];
                                col.leftBound = prev ? (prev.rightX + col.x) / 2 : -Infinity;
                                col.rightBound = next ? (col.rightX + next.x) / 2 : Infinity;
                            }
                            currentBlockColumns = detectedCols;
                            continue;
                        }

                        // Ekstraksi data baris jika kolom tabel aktif sudah terdeteksi
                        if (currentBlockColumns && currentBlockColumns.length >= 2) {
                            const rowObj = {};
                            currentBlockColumns.forEach(col => {
                                const matchingItems = line.items.filter(it => {
                                    const centerX = it.x + (it.width / 2);
                                    return centerX >= col.leftBound && centerX < col.rightBound;
                                });
                                if (matchingItems.length > 0) {
                                    const val = matchingItems.map(m => m.str).join(' ').trim();
                                    if (val) rowObj[col.name] = val;
                                }
                            });

                            // Penanganan pemisahan sel bersebelahan ReportLab (misal: kolom mata uang + teks/status yang menyatu)
                            for (let c = 0; c < currentBlockColumns.length - 1; c++) {
                                const colLeft = currentBlockColumns[c].name;
                                const colRight = currentBlockColumns[c + 1].name;
                                
                                // Kasus 1: colLeft kosong, colRight menyerap nilai mata uang colLeft (misal C20 & C21, C47 & C48)
                                if (!rowObj[colLeft] && rowObj[colRight]) {
                                    const m = rowObj[colRight].match(/^(Rp\.?\s*[\d\.,]+)\s+(.+)$/);
                                    if (m) {
                                        rowObj[colLeft] = m[1].trim();
                                        rowObj[colRight] = m[2].trim();
                                    }
                                }
                                // Kasus 2: colRight kosong, colLeft menyerap nilai colRight (misal C17 & C18 "Rp 0 0")
                                else if (rowObj[colLeft] && !rowObj[colRight]) {
                                    const m = rowObj[colLeft].match(/^(Rp\.?\s*[\d\.,]+)\s+(.+)$/);
                                    if (m) {
                                        rowObj[colLeft] = m[1].trim();
                                        rowObj[colRight] = m[2].trim();
                                    }
                                }
                            }

                            if (Object.keys(rowObj).length >= 1) {
                                const noVal = (rowObj['No'] || '').trim();
                                let key = '';
                                if (/^\d{1,4}$/.test(noVal)) {
                                    key = 'no_' + noVal;
                                } else {
                                    const nikRaw = rowObj['Nomor NIK'] || rowObj['NIK'];
                                    if (nikRaw) {
                                        const digits = String(nikRaw).replace(/[^0-9]/g, '');
                                        if (digits.length >= 8) key = 'nik_' + digits;
                                    }
                                    if (!key) {
                                        const nameRaw = rowObj['Nama Lengkap'] || rowObj['Nama'];
                                        if (nameRaw) {
                                            const clean = String(nameRaw).toLowerCase().replace(/[^a-z0-9]/g, '');
                                            if (clean.length >= 3) key = 'name_' + clean;
                                        }
                                    }
                                }

                                if (key) {
                                    if (citizenMap.has(key)) {
                                        const existing = citizenMap.get(key);
                                        // Jangan pernah menimpa identitas pokok (Nama Lengkap, NIK) resmi yang sudah lengkap dari Blok I
                                        if (existing['Nama Lengkap'] && !/^Warga \(/i.test(existing['Nama Lengkap'])) {
                                            delete rowObj['Nama Lengkap'];
                                            delete rowObj['Nama'];
                                        }
                                        if (existing['Nomor NIK'] || existing['NIK']) {
                                            delete rowObj['Nomor NIK'];
                                            delete rowObj['NIK'];
                                        }
                                        Object.assign(existing, rowObj);
                                    } else {
                                        citizenMap.set(key, { ...rowObj });
                                    }
                                } else if (rowObj['Nomor NIK'] || rowObj['Nama Lengkap'] || rowObj['Nama']) {
                                    unkeyedRows.push(rowObj);
                                }
                            }
                        }
                    }
                }

                let mergedRows = Array.from(citizenMap.values());
                if (unkeyedRows.length > 0) {
                    mergedRows.push(...unkeyedRows);
                }

                // Fallback pencarian teks jika PDF tidak berbentuk tabel
                if (mergedRows.length === 0) {
                    for (let i = 0; i < allPagesLines.length; i++) {
                        const line = allPagesLines[i];
                        const txt = line.lineText;
                        if (!txt || txt.length < 5) continue;
                        const nikMatch = txt.match(/\b(35\d{14}|\d{16})\b/) || txt.match(/\b\d{12,18}\b/);
                        if (nikMatch) {
                            const rowObj = { lineText: txt };
                            rowObj['NIK'] = nikMatch[0];
                            
                            const pMatch = txt.match(/\b(08\d{8,12}|628\d{8,12})\b/);
                            if (pMatch) rowObj['No WhatsApp'] = pMatch[0];

                            const eMatch = txt.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
                            if (eMatch) rowObj['Email'] = eMatch[0];

                            const beforeNik = txt.substring(0, txt.indexOf(nikMatch[0])).trim().replace(/^[\d\.\)\s_-]+/, '').trim();
                            const afterNik = txt.substring(txt.indexOf(nikMatch[0]) + nikMatch[0].length).trim();
                            
                            if (beforeNik && beforeNik.length >= 3 && !/^\d+$/.test(beforeNik)) {
                                rowObj['Nama Lengkap'] = beforeNik;
                            } else {
                                const words = afterNik.split(/\s+/).filter(w => !/^\d+$/.test(w));
                                rowObj['Nama Lengkap'] = words.slice(0, 3).join(' ') || `Warga (${nikMatch[0].slice(-4)})`;
                            }

                            mergedRows.push(rowObj);
                        }
                    }
                }

                // Urutkan warga berdasarkan nomor urut (jika ada kolom No)
                mergedRows.sort((a, b) => {
                    const noA = parseInt(String(a['No'] || '9999'), 10);
                    const noB = parseInt(String(b['No'] || '9999'), 10);
                    return noA - noB;
                });

                if (mergedRows.length === 0) {
                    throw new Error('Dokumen PDF tidak memiliki teks kependudukan yang dapat dikenali. Pastikan berkas PDF bukan hasil pemindaian/scan foto tanpa lapisan teks OCR.');
                }

                const rows = mergedRows.map((r, i) => window.normalizeImportCitizenRow(r, i)).filter(Boolean);
                resolve(rows);
            } catch (err) {
                reject(new Error('Gagal mengekstrak data dari dokumen PDF: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca berkas PDF.'));
        reader.readAsArrayBuffer(file);
    });
};

// =========================================================================
window.currentImportView = 'table';
window.customImportSearchQuery = '';
window._customImportRowLimitVal = '100';
window._customImportCurrentPage = 1;
window.customImportStickyName = true;
window.customImportWrapText = true;

window.switchCustomImportView = function (view) {
    window.currentImportView = view;
    const btnTable = document.getElementById('btnImportViewTable');
    const btnCards = document.getElementById('btnImportViewCards');
    if (btnTable && btnCards) {
        if (view === 'cards') {
            btnCards.className = 'btn-import-view active';
            btnTable.className = 'btn-import-view';
        } else {
            btnTable.className = 'btn-import-view active';
            btnCards.className = 'btn-import-view';
        }
    }
    window.renderCustomImportData();
};

window.filterCustomImportPreviewRows = function (query) {
    window.customImportSearchQuery = query || '';
    window._customImportCurrentPage = 1;
    window.renderCustomImportData();
};

window.changeCustomImportRowLimit = function (val) {
    window._customImportRowLimitVal = val;
    window._customImportCurrentPage = 1;
    window.renderCustomImportData();
};

window.nextCustomImportPage = function () {
    const rawRows = window.stagedUnifiedImportData || [];
    const q = (window.customImportSearchQuery || '').toLowerCase().trim();
    const filteredRows = rawRows.filter((r) => {
        if (!q) return true;
        return Object.values(r).map(v => String(v || '')).join(' ').toLowerCase().includes(q);
    });
    const limitVal = window._customImportRowLimitVal || '100';
    if (limitVal === 'all') return;
    const limit = parseInt(limitVal, 10) || 100;
    const totalPages = Math.ceil(filteredRows.length / limit) || 1;
    if ((window._customImportCurrentPage || 1) < totalPages) {
        window._customImportCurrentPage = (window._customImportCurrentPage || 1) + 1;
        window.renderCustomImportData();
    }
};

window.prevCustomImportPage = function () {
    if ((window._customImportCurrentPage || 1) > 1) {
        window._customImportCurrentPage = (window._customImportCurrentPage || 1) - 1;
        window.renderCustomImportData();
    }
};

window.scrollCustomImportTable = function (delta) {
    const tableContainer = document.getElementById('customImportTableWrapper') || 
                           document.querySelector('#modalCustomImport .table-container') || 
                           document.getElementById('customImportPreviewTable')?.parentElement;
    if (tableContainer) {
        tableContainer.scrollBy({ left: delta, behavior: 'smooth' });
    }
};

window.toggleCustomImportStickyName = function () {
    window.customImportStickyName = !window.customImportStickyName;
    const btn = document.getElementById('btnToggleImportSticky');
    if (btn) btn.innerHTML = `<i class="fas fa-thumbtack"></i> Kunci Nama: ${window.customImportStickyName ? 'ON' : 'OFF'}`;
    window.renderCustomImportData();
};

window.toggleCustomImportWrapText = function () {
    window.customImportWrapText = !window.customImportWrapText;
    const btn = document.getElementById('btnToggleImportWrap');
    if (btn) btn.innerHTML = `<i class="fas fa-align-left"></i> Bungkus Teks: ${window.customImportWrapText ? 'ON' : 'OFF'}`;
    window.renderCustomImportData();
};

window.openCustomImportPreviewModal = function (rows, fileName, formatType) {
    if (!rows || !rows.length) return;

    // Normalisasi menyeluruh data kependudukan (identitas, alamat, TTL, No WA, email, kriteria SPK)
    rows = rows.map((r, i) => window.normalizeImportCitizenRow ? window.normalizeImportCitizenRow(r, i) : r);
    window.stagedUnifiedImportData = rows;

    // 1. Kumpulkan seluruh nama kolom unik dari berkas data
    const rawKeysSet = new Set();
    rows.forEach(r => {
        Object.keys(r).forEach(k => {
            const kTrim = String(k || '').trim();
            if (kTrim) rawKeysSet.add(kTrim);
        });
    });
    const allRawKeys = Array.from(rawKeysSet);

    // 2. Susun kolom standar teratur di bagian depan (Nama, NIK, TTL, Alamat, No WA, Email, Kriteria SPK)
    const canonicalHeaders = [];
    const usedRawKeys = new Set();

    // Kolom 1: Nama Lengkap
    canonicalHeaders.push('Nama Lengkap');
    usedRawKeys.add('Nama Lengkap'); usedRawKeys.add('Nama'); usedRawKeys.add('nama'); usedRawKeys.add('namalengkap'); usedRawKeys.add('name');

    // Kolom 2: NIK
    canonicalHeaders.push('NIK');
    usedRawKeys.add('NIK'); usedRawKeys.add('nik'); usedRawKeys.add('noktp'); usedRawKeys.add('ktp'); usedRawKeys.add('no_ktp');

    // Kolom 3: Tempat & Tanggal Lahir (TTL)
    canonicalHeaders.push('TTL');
    usedRawKeys.add('TTL'); usedRawKeys.add('ttl'); usedRawKeys.add('Tempat Lahir'); usedRawKeys.add('tempat_lahir');
    usedRawKeys.add('Tanggal Lahir'); usedRawKeys.add('tanggal_lahir');

    // Kolom 4: Alamat Lengkap
    canonicalHeaders.push('Alamat Lengkap');
    usedRawKeys.add('Alamat Lengkap'); usedRawKeys.add('Alamat'); usedRawKeys.add('alamat'); usedRawKeys.add('alamatlengkap');
    usedRawKeys.add('alamat_lengkap');

    // Kolom 5: No. WhatsApp / HP
    canonicalHeaders.push('No. WA');
    usedRawKeys.add('No. WA'); usedRawKeys.add('No WhatsApp'); usedRawKeys.add('No WA'); usedRawKeys.add('nowa');
    usedRawKeys.add('no_wa'); usedRawKeys.add('No HP'); usedRawKeys.add('no_hp'); usedRawKeys.add('telepon');

    // Kolom 6: Email (jika ada nilai terisi)
    const hasEmailVal = rows.some(r => r.email || r.Email);
    if (hasEmailVal) {
        canonicalHeaders.push('Email');
        usedRawKeys.add('Email'); usedRawKeys.add('email');
    }

    // Kolom Geografis / Wilayah (jika ada pada berkas pengguna)
    const geoCandidates = ['Kecamatan', 'Desa / Kelurahan', 'Latitude', 'Longitude'];
    geoCandidates.forEach(gk => {
        const found = allRawKeys.find(k => {
            const clean = k.toLowerCase().replace(/[\s\._\/-]+/g, '');
            const target = gk.toLowerCase().replace(/[\s\._\/-]+/g, '');
            return clean === target || (gk === 'Latitude' && clean === 'garislintang') || (gk === 'Longitude' && clean === 'garisbujur');
        });
        if (found) {
            canonicalHeaders.push(found);
            usedRawKeys.add(found);
            if (gk === 'Latitude') { usedRawKeys.add('Latitude'); usedRawKeys.add('latitude'); usedRawKeys.add('lat'); usedRawKeys.add('Garis Lintang'); }
            if (gk === 'Longitude') { usedRawKeys.add('Longitude'); usedRawKeys.add('longitude'); usedRawKeys.add('lng'); usedRawKeys.add('Garis Bujur'); }
        }
    });

    // Kolom Kriteria C (C1 s/d C50 atau lebih) - DIURUTKAN SECARA NUMERIK SEMPURNA TANPA DUPLIKASI
    const criteriaMap = new Map();
    allRawKeys.forEach(k => {
        const m = k.match(/^c0?(\d+)(?:[\s_-]+(.*))?$/i);
        if (m) {
            const num = parseInt(m[1], 10);
            const desc = (m[2] || '').trim();
            if (!criteriaMap.has(num)) {
                criteriaMap.set(num, k);
            } else {
                // Utamakan nama deskriptif (misal: C1_Ekonomi lebih dipilih dibanding C1 polos)
                const existing = criteriaMap.get(num);
                if (/^c0?\d+$/i.test(existing) && desc) {
                    criteriaMap.set(num, k);
                }
            }
            usedRawKeys.add(k);
            usedRawKeys.add(`C${num}`);
            usedRawKeys.add(`c${num}`);
            usedRawKeys.add(`c0${num}`);
        }
    });

    // Urutkan nomor kriteria 1, 2, 3, ... 50 secara ketat
    const sortedCritNumbers = Array.from(criteriaMap.keys()).sort((a, b) => a - b);
    sortedCritNumbers.forEach(num => {
        canonicalHeaders.push(criteriaMap.get(num));
    });

    // Singkirkan sinonim duplikat kolom standar
    allRawKeys.forEach(k => {
        const kLow = k.toLowerCase().replace(/[\s\._\/-]+/g, '');
        if (/^(no|nik|nomornik|nama|namalengkap|alamat|alamatlengkap|nowa|nowhatsapp|nohp|email|alamatemail|surel|ttl|tempatlahir|tanggallahir|garislintang|garisbujur|lat|lng|latitude|longitude)$/i.test(kLow)) {
            usedRawKeys.add(k);
        }
    });

    // Tambahkan sisa variabel kustom dari berkas pengguna
    allRawKeys.forEach(k => {
        if (!usedRawKeys.has(k) && !/^(No|NIK|Nama|Nama Lengkap|TTL|Alamat|Alamat Lengkap|No\. WA|Email)$/i.test(k)) {
            canonicalHeaders.push(k);
            usedRawKeys.add(k);
        }
    });

    window.stagedUnifiedHeaders = canonicalHeaders;
    window.stagedUnifiedPrimaryNameKey = 'Nama Lengkap';

    // Klasifikasi Variabel & Deteksi Tipe Data
    const coreKeys = ['nik', 'nama', 'nama_lengkap', 'alamat', 'alamat_lengkap', 'no_hp', 'no_wa', 'email', 'ttl', 'tempat_lahir', 'tanggal_lahir'];
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
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(sampleVal) || /\d{4}/.test(sampleVal)) {
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

    // Reset filter pencarian & inisialisasi batas baris serta paginasi
    const searchInp = document.getElementById('customImportSearchInput');
    if (searchInp) searchInp.value = '';
    window.customImportSearchQuery = '';
    window._customImportCurrentPage = 1;
    window._customImportRowLimitVal = '100';
    const limitSelect = document.getElementById('customImportRowLimit');
    if (limitSelect) limitSelect.value = '100';

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

    const selectEl = document.getElementById('customImportRowLimit');
    const limitVal = window._customImportRowLimitVal || (selectEl ? selectEl.value : '100');
    const isAll = limitVal === 'all';
    const limit = isAll ? filteredRows.length : (parseInt(limitVal, 10) || 100);
    const totalPages = isAll ? 1 : (Math.ceil(filteredRows.length / limit) || 1);

    if (!window._customImportCurrentPage || window._customImportCurrentPage < 1) {
        window._customImportCurrentPage = 1;
    }
    if (window._customImportCurrentPage > totalPages) {
        window._customImportCurrentPage = totalPages;
    }
    const curPage = window._customImportCurrentPage;
    const startIndex = isAll ? 0 : (curPage - 1) * limit;
    const endIndex = isAll ? filteredRows.length : Math.min(startIndex + limit, filteredRows.length);
    const displayRows = filteredRows.slice(startIndex, endIndex);

    const rowCountNotice = document.getElementById('customImportRowCountNotice');
    if (rowCountNotice) {
        if (q) {
            rowCountNotice.innerHTML = `Ditemukan <b>${filteredRows.length}</b> baris (Menampilkan ${displayRows.length > 0 ? (startIndex + 1) : 0}-${endIndex}, Hal ${curPage}/${totalPages})`;
        } else {
            rowCountNotice.innerHTML = `Menampilkan <b>${displayRows.length > 0 ? (startIndex + 1) : 0} - ${endIndex}</b> dari <b>${rawRows.length}</b> baris data${!isAll ? ` (Hal ${curPage}/${totalPages})` : ''}`;
        }
    }

    // Perbarui Tombol & Status Paginasi
    const pageLabel = document.getElementById('customImportPageLabel');
    if (pageLabel) pageLabel.textContent = `${curPage} / ${totalPages}`;
    const btnPrev = document.getElementById('btnCustomImportPrevPage');
    if (btnPrev) {
        btnPrev.disabled = curPage <= 1 || isAll;
        btnPrev.style.opacity = (curPage <= 1 || isAll) ? '0.45' : '1';
        btnPrev.style.cursor = (curPage <= 1 || isAll) ? 'not-allowed' : 'pointer';
    }
    const btnNext = document.getElementById('btnCustomImportNextPage');
    if (btnNext) {
        btnNext.disabled = curPage >= totalPages || isAll;
        btnNext.style.opacity = (curPage >= totalPages || isAll) ? '0.45' : '1';
        btnNext.style.cursor = (curPage >= totalPages || isAll) ? 'not-allowed' : 'pointer';
    }

    const tableEl = document.getElementById('customImportPreviewTable');
    const cardsGrid = document.getElementById('customImportCardsGrid');
    const scrollNavGroup = document.getElementById('customImportScrollNavGroup');

    if (window.currentImportView === 'cards') {
        if (tableEl) tableEl.style.display = 'none';
        if (scrollNavGroup) scrollNavGroup.style.display = 'none';
        if (cardsGrid) {
            cardsGrid.style.display = 'grid';
            if (displayRows.length === 0) {
                cardsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 16px; border: 1.5px dashed #cbd5e1;">
                        <i class="fas fa-search" style="font-size: 2.2rem; margin-bottom: 10px; display: block; color: #cbd5e1;"></i>
                        <div style="font-weight: 800; font-size: 1rem; color: #475569;">Tidak ada baris data yang cocok dengan pencarian</div>
                    </div>
                `;
                return;
            }

            cardsGrid.innerHTML = displayRows.map((r, i) => {
                const origIndex = rawRows.indexOf(r);
                const namaVal = r['Nama Lengkap'] || r['Nama'] || r['nama'] || 'Warga Terdata';
                const nikVal = r['NIK'] || r['nik'] || '-';
                const alamatVal = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || '-';
                const ttlVal = r['TTL'] || `${r['Tempat Lahir'] || 'Sidoarjo'}, ${r['Tanggal Lahir'] || '-'}`;
                const noWaVal = r['No. WA'] || r['No WhatsApp'] || r['no_hp'] || '-';
                const initials = (namaVal || 'W').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'W';

                const avatarColors = [
                    ['#ede9fe', '#6d28d9'], ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'],
                    ['#fef3c7', '#b45309'], ['#e0f2fe', '#0369a1'], ['#fce7f3', '#be185d']
                ];
                const colorPair = avatarColors[i % avatarColors.length];

                const extraVariables = headers.filter(h => !/nama|nik|ktp|alamat|ttl/i.test(h) && r[h] !== undefined && r[h] !== null && String(r[h]).trim() !== '');

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
                                        <span style="font-size:0.72rem; color:#94a3b8; font-weight:700;">#${startIndex + i + 1}</span>
                                    </div>
                                </div>
                            </div>

                            <div style="font-size:0.78rem; color:#475569; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-calendar-alt text-warning"></i> <span>${window.safeHtml(ttlVal)}</span>
                                <span style="margin:0 4px; color:#cbd5e1;">•</span>
                                <i class="fab fa-whatsapp text-success"></i> <span>${window.safeHtml(noWaVal)}</span>
                            </div>

                            <div style="font-size:0.8rem; color:#475569; margin-bottom:12px; display:flex; align-items:flex-start; gap:6px; background:#f8fafc; padding:8px 10px; border-radius:10px; border:1px solid #f1f5f9;">
                                <i class="fas fa-map-marker-alt text-danger" style="margin-top:2px; flex-shrink:0;"></i>
                                <span style="word-break:break-word;">${window.safeHtml(alamatVal)}</span>
                            </div>

                            ${extraVariables.length > 0 ? `
                                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:6px; margin-bottom:12px;">
                                    ${varsHtml}
                                </div>
                            ` : '<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:10px;">Tidak ada kolom kustom tambahan</div>'}
                            ${moreCount > 0 ? `<div style="font-size:0.72rem; color:#6d28d9; font-weight:700; margin-bottom:10px;">+${moreCount} variabel lainnya tersimpan</div>` : ''}
                        </div>

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

    // MODE 1: TABEL DINAMIS (SCROLLABLE TABLE)
    if (cardsGrid) cardsGrid.style.display = 'none';
    if (tableEl) tableEl.style.display = 'table';
    if (scrollNavGroup) scrollNavGroup.style.display = 'inline-flex';

    const useSticky = window.customImportStickyName;
    const useWrap = window.customImportWrapText;

    const thead = document.getElementById('customImportTableHead');
    if (thead) {
        let thHtml = '<tr>';

        const noStickyClass = useSticky ? 'import-sticky-no' : '';
        thHtml += `
            <th class="${noStickyClass}" style="top: 0; background: #e2e8f0; width: 58px; min-width: 58px; max-width: 58px; text-align: center; border-bottom: 2.5px solid #94a3b8; border-right: 1.5px solid #cbd5e1; padding: 12px 6px; font-weight: 800; color: #1e293b; box-sizing: border-box;">
                No
            </th>
        `;

        headers.forEach((h, idx) => {
            const isNameCol = idx === 0;
            if (isNameCol) {
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
            } else if (/ttl|lahir/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 185px; white-space: nowrap; font-weight: 800; color: #1e293b; text-align: left;">
                        <i class="fas fa-calendar-alt text-warning" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else if (/alamat|domisili/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 260px; white-space: nowrap; font-weight: 800; color: #1e293b; text-align: left;">
                        <i class="fas fa-map-marker-alt text-danger" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else if (/wa|hp|telepon/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 155px; white-space: nowrap; font-weight: 800; color: #047857; text-align: left;">
                        <i class="fab fa-whatsapp text-success" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else if (/email|surel/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 16px; min-width: 190px; white-space: nowrap; font-weight: 800; color: #0369a1; text-align: left;">
                        <i class="fas fa-envelope text-info" style="margin-right:6px;"></i> ${window.safeHtml(h)}
                    </th>
                `;
            } else if (/^c0?\d+/i.test(h)) {
                thHtml += `
                    <th style="position: sticky; top: 0; z-index: 10; background: #f8fafc; border-bottom: 2.5px solid #94a3b8; border-right: 1px solid #e2e8f0; padding: 12px 14px; min-width: 110px; white-space: nowrap; font-weight: 800; color: #1d4ed8; text-align: left;">
                        <i class="fas fa-chart-bar" style="margin-right:4px;"></i> ${window.safeHtml(h)}
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

            const noStickyClass = useSticky ? 'import-sticky-no' : '';
            tdHtml += `
                <td class="${noStickyClass}" style="background: ${rowBg}; width: 58px; min-width: 58px; max-width: 58px; text-align: center; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; border-right: 1.5px solid #cbd5e1; padding: 10px 6px; box-sizing: border-box;">
                    ${startIndex + i + 1}
                </td>
            `;

            headers.forEach((h, idx) => {
                const isNameCol = idx === 0;
                let cellVal = r[h];

                if (isNameCol && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['Nama Lengkap'] || r['Nama'] || r['nama'] || r['namalengkap'] || '-';
                } else if (/nik|ktp/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['NIK'] || r['nik'] || r['No KTP'] || r['noktp'] || '-';
                } else if (/ttl|lahir/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['TTL'] || `${r['Tempat Lahir'] || 'Sidoarjo'}, ${r['Tanggal Lahir'] || '-'}`;
                } else if (/alamat|domisili/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || '-';
                } else if (/wa|hp|telepon/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['No. WA'] || r['No WhatsApp'] || r['no_hp'] || '-';
                } else if (/email|surel/i.test(h) && (cellVal === undefined || cellVal === '')) {
                    cellVal = r['Email'] || r['email'] || '-';
                } else if ((cellVal === undefined || cellVal === null || cellVal === '') && /^c0?\d+/i.test(h)) {
                    const mCrit = h.match(/^c0?(\d+)/i);
                    if (mCrit) {
                        const num = mCrit[1];
                        cellVal = r[`C${num}`] ?? r[`c${num}`] ?? r[`c0${num}`];
                        if (cellVal === undefined || cellVal === null || cellVal === '') {
                            const foundKey = Object.keys(r).find(k => new RegExp(`^c0?${num}(\\b|_|\\s)`, 'i').test(k));
                            if (foundKey) cellVal = r[foundKey];
                        }
                    }
                }

                const strVal = String(cellVal !== undefined && cellVal !== null ? cellVal : '');

                if (isNameCol) {
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
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; font-family: monospace; font-weight: 800; font-size: 0.88rem; color: #1e293b; white-space: nowrap;">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/ttl|lahir/i.test(h)) {
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #1e293b; white-space: nowrap; font-size: 0.88rem;">
                            <i class="fas fa-calendar-alt text-warning" style="margin-right:5px;"></i> ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/alamat|domisili/i.test(h)) {
                    const wrapStyle = useWrap ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;';
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #334155; min-width: 240px; ${wrapStyle}">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/wa|hp|telepon/i.test(h)) {
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; font-family: monospace; font-weight: 700; color: #047857; white-space: nowrap; font-size: 0.88rem;">
                            <i class="fab fa-whatsapp text-success" style="margin-right:5px;"></i> ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/email|surel/i.test(h)) {
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #0369a1; white-space: nowrap; font-size: 0.88rem;">
                            <i class="fas fa-envelope text-info" style="margin-right:5px;"></i> ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else if (/^c0?\d+/i.test(h)) {
                    tdHtml += `
                        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; font-weight: 700; color: #1d4ed8; text-align: right; white-space: nowrap; font-size: 0.88rem;">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                } else {
                    const wrapStyle = useWrap ? 'white-space: normal; word-break: break-word;' : 'white-space: nowrap;';
                    tdHtml += `
                        <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #334155; min-width: 130px; ${wrapStyle}">
                            ${window.safeHtml(strVal || '-')}
                        </td>
                    `;
                }
            });

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

// =========================================================================
// MODAL RINCIAN DETAIL VARIABEL SATU WARGA (POPUP INSPECTOR)
// =========================================================================
window.viewCustomImportRowDetail = function (index) {
    const safeHtml = typeof window.safeHtml === 'function' ? window.safeHtml : (s => String(s !== undefined && s !== null ? s : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    const rows = window.stagedUnifiedImportData || [];
    const r = rows[index];
    if (!r) {
        showAdminAlert({ icon: 'warning', title: 'Data Tidak Ditemukan', text: 'Baris data warga ini tidak tersedia.' });
        return;
    }

    const modal = document.getElementById('modalCustomImportRowDetail');
    const body = document.getElementById('modalCustomImportRowDetailBody');
    if (!modal || !body) return;

    const nama = r['Nama Lengkap'] || r['Nama'] || r['nama'] || 'Warga Terdata';
    const nik = r['Nomor NIK'] || r['NIK'] || r['nik'] || '-';
    const noWa = r['No. WhatsApp'] || r['No WhatsApp'] || r['No. WA'] || r['no_hp'] || '-';
    const email = r['Alamat Email'] || r['Email'] || r['email'] || '-';
    const alamat = r['Alamat Lengkap'] || r['Alamat'] || r['alamat'] || '-';
    const ttl = r['TTL'] || `${r['Tempat Lahir'] || r['tempat_lahir'] || 'Sidoarjo'}, ${r['Tanggal Lahir'] || r['tanggal_lahir'] || '-'}`;
    const lat = r['Latitude'] || r['lat'] || '-';
    const lng = r['Longitude'] || r['lng'] || '-';

    // 10 Kriteria SPK Utama
    const spkCriteria = [
        { key: 'C1', label: 'C1 - Kondisi Ekonomi / Penghasilan', val: r['C1_Ekonomi'] !== undefined ? r['C1_Ekonomi'] : (r['C1'] !== undefined ? `Rp ${Number(r['C1']).toLocaleString('id-ID')}` : '-') },
        { key: 'C2', label: 'C2 - Kepemilikan Aset / Pengeluaran', val: r['C2_Aset'] !== undefined ? r['C2_Aset'] : (r['C2'] !== undefined ? `Rp ${Number(r['C2']).toLocaleString('id-ID')}` : '-') },
        { key: 'C3', label: 'C3 - Umur / Usia Kepala Keluarga', val: r['C3_Umur KK'] !== undefined ? `${r['C3_Umur KK']} Tahun` : (r['C3'] !== undefined ? `${r['C3']} Tahun` : '-') },
        { key: 'C4', label: 'C4 - Demografi / Jenis Kelamin', val: r['C4_Jenis Kelamin'] !== undefined ? r['C4_Jenis Kelamin'] : (r['C4'] !== undefined ? (r['C4'] == 2 ? 'Perempuan' : 'Laki-laki') : '-') },
        { key: 'C5', label: 'C5 - Jumlah Tanggungan / Listrik', val: r['C5_Tanggungan'] !== undefined ? `${r['C5_Tanggungan']} Jiwa` : (r['C5'] !== undefined ? `${r['C5']} Jiwa` : '-') },
        { key: 'C6', label: 'C6 - Status Pernikahan / Air', val: r['C6_Status Kawin'] !== undefined ? r['C6_Status Kawin'] : (r['C6'] !== undefined ? r['C6'] : '-') },
        { key: 'C7', label: 'C7 - Kepemilikan Anak / Aset', val: r['C7_Jml Anak'] !== undefined ? `${r['C7_Jml Anak']} Anak` : (r['C7'] !== undefined ? r['C7'] : '-') },
        { key: 'C8', label: 'C8 - Kelayakan Rumah / Tempat Tinggal', val: r['C8_Tempat Tinggal'] !== undefined ? r['C8_Tempat Tinggal'] : (r['C8_Status Rumah'] !== undefined ? r['C8_Status Rumah'] : (r['C8'] !== undefined ? r['C8'] : '-')) },
        { key: 'C9', label: 'C9 - Pendidikan Terakhir KK', val: r['C9_Pendidikan KK'] !== undefined ? r['C9_Pendidikan KK'] : (r['C9'] !== undefined ? r['C9'] : '-') },
        { key: 'C10', label: 'C10 - Kondisi Kesehatan / Disabilitas', val: r['C10_Kesehatan'] !== undefined ? r['C10_Kesehatan'] : (r['C10'] !== undefined ? r['C10'] : '-') }
    ];

    // Filter daftar variabel kustom / impor di luar standar
    const standardKeys = new Set([
        'no', 'nik', 'nomor nik', 'nomor_nik', 'nama', 'nama lengkap', 'nama_lengkap',
        'tempat lahir', 'tempat_lahir', 'tanggal lahir', 'tanggal_lahir', 'ttl',
        'alamat lengkap', 'alamat', 'alamat_lengkap', 'no whatsapp', 'no. whatsapp',
        'no wa', 'no. wa', 'no hp', 'no_hp', 'email', 'alamat email', 'alamat_email',
        'latitude', 'longitude', 'lat', 'lng', 'garis lintang', 'garis bujur',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
        'desil', 'is_layak', 'skor_saw', 'rank_saw', 'is_verified', 'status_validasi',
        'status_salur', 'status_bansos', 'prioritas', 'keterangan_salur', 'catatan',
        'extra_data'
    ]);

    const customVars = [];
    Object.keys(r).forEach(k => {
        const cleanKey = k.toLowerCase().trim();
        if (!standardKeys.has(cleanKey)) {
            customVars.push({ key: k, val: r[k] });
        }
    });

    // Urutkan variabel kustom secara numerik teratur (C11, C12, ... C50)
    customVars.sort((a, b) => {
        const mA = a.key.match(/^c0?(\d+)/i);
        const mB = b.key.match(/^c0?(\d+)/i);
        if (mA && mB) return parseInt(mA[1], 10) - parseInt(mB[1], 10);
        if (mA) return -1;
        if (mB) return 1;
        return a.key.localeCompare(b.key);
    });

    let html = `
        <!-- Identitas Utama Warga -->
        <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1.5px solid #e2e8f0; border-radius: 18px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Identitas Calon Penerima</div>
                    <div style="font-size:1.18rem; font-weight:900; color:#0f172a; margin-top:2px;">${safeHtml(nama)}</div>
                    <div style="font-family:monospace; font-size:0.86rem; font-weight:800; color:#475569; margin-top:3px;">
                        <i class="fas fa-id-card text-primary" style="margin-right:6px;"></i>NIK: <span style="background:#ffffff; border:1px solid #cbd5e1; padding:2px 8px; border-radius:6px; letter-spacing:1px;">${safeHtml(nik)}</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-size:0.75rem; font-weight:800; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fas fa-check-circle text-success"></i> Baris #${(index + 1)}
                    </span>
                </div>
            </div>
            <div style="margin-top:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:10px; font-size:0.82rem; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <div><b style="color:#64748b;"><i class="fas fa-map-marker-alt text-danger"></i> Alamat:</b><br><span style="color:#1e293b; font-weight:600;">${safeHtml(alamat)}</span></div>
                <div><b style="color:#64748b;"><i class="fas fa-calendar-alt text-warning"></i> TTL:</b><br><span style="color:#1e293b; font-weight:600;">${safeHtml(ttl)}</span></div>
                <div><b style="color:#64748b;"><i class="fab fa-whatsapp text-success"></i> WhatsApp:</b><br><span style="color:#1e293b; font-weight:600;">${safeHtml(noWa)}</span></div>
                <div><b style="color:#64748b;"><i class="fas fa-envelope text-info"></i> Email:</b><br><span style="color:#1e293b; font-weight:600;">${safeHtml(email)}</span></div>
            </div>
        </div>

        <!-- Tab Navigasi Mini: Kriteria SPK vs Variabel Impor / Kustom -->
        <div style="margin-bottom: 14px;">
            <div style="display:flex; gap:8px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">
                <button type="button" id="btnDetailTabSpk" onclick="window.switchDetailTab('spk')" style="background:#ede9fe; color:#6d28d9; border:none; padding:6px 14px; border-radius:10px; font-weight:800; font-size:0.8rem; cursor:pointer;">
                    <i class="fas fa-calculator"></i> Kriteria SPK (C1 - C10)
                </button>
                <button type="button" id="btnDetailTabCustom" onclick="window.switchDetailTab('custom')" style="background:transparent; color:#64748b; border:none; padding:6px 14px; border-radius:10px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                    <i class="fas fa-list-alt"></i> Variabel Impor / Kustom
                </button>
            </div>
        </div>

        <!-- Konten 1: Kriteria SPK (C1 - C10) -->
        <div id="panelDetailTabSpk" style="display:block;">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:10px;">
                ${spkCriteria.map(c => `
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                        <div style="font-size:0.75rem; font-weight:800; color:#7c3aed; text-transform:uppercase;">${c.key}</div>
                        <div style="font-size:0.78rem; font-weight:600; color:#64748b; margin-top:1px;">${c.label}</div>
                        <div style="font-size:0.95rem; font-weight:900; color:#0f172a; margin-top:4px;">${safeHtml(String(c.val || '-'))}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Konten 2: Variabel Impor / Kustom (C11 - C39 dll) -->
        <div id="panelDetailTabCustom" style="display:none;">
            ${customVars.length > 0 ? `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:10px;">
                    ${customVars.map(v => `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                            <div style="font-size:0.75rem; font-weight:800; color:#0284c7; text-transform:uppercase;">${safeHtml(v.key)}</div>
                            <div style="font-size:0.9rem; font-weight:700; color:#0f172a; margin-top:4px;">${safeHtml(v.val !== undefined && v.val !== null && String(v.val).trim() !== '' ? String(v.val) : '-')}</div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align:center; padding:30px 20px; color:#94a3b8; font-weight:600;">
                    <i class="fas fa-info-circle" style="font-size:2rem; margin-bottom:8px; display:block;"></i>
                    Tidak ada variabel tambahan di luar variabel standar kependudukan.
                </div>
            `}
        </div>

        <!-- Aksi Cepat Simpan Per Warga -->
        <div style="margin-top:20px; padding-top:14px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">
                <i class="fas fa-database text-primary"></i> Data siap disimpan ke basis data arsip
            </div>
            <button type="button" onclick="window.saveSingleCustomImportRow(${index})" class="btn btn-sm" style="background: linear-gradient(135deg, #10b981, #059669); color:#ffffff; font-weight:800; border:none; padding:7px 16px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                <i class="fas fa-save"></i> Simpan Warga Ini ke Arsip
            </button>
        </div>
    `;

    body.innerHTML = html;
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.zIndex = '100005';
};

window.switchDetailTab = function (tab) {
    const btnSpk = document.getElementById('btnDetailTabSpk');
    const btnCustom = document.getElementById('btnDetailTabCustom');
    const pnlSpk = document.getElementById('panelDetailTabSpk');
    const pnlCustom = document.getElementById('panelDetailTabCustom');
    if (!btnSpk || !btnCustom || !pnlSpk || !pnlCustom) return;

    if (tab === 'custom') {
        btnCustom.style.background = '#ede9fe';
        btnCustom.style.color = '#6d28d9';
        btnCustom.style.fontWeight = '800';
        btnSpk.style.background = 'transparent';
        btnSpk.style.color = '#64748b';
        btnSpk.style.fontWeight = '700';
        pnlCustom.style.display = 'block';
        pnlSpk.style.display = 'none';
    } else {
        btnSpk.style.background = '#ede9fe';
        btnSpk.style.color = '#6d28d9';
        btnSpk.style.fontWeight = '800';
        btnCustom.style.background = 'transparent';
        btnCustom.style.color = '#64748b';
        btnCustom.style.fontWeight = '700';
        pnlSpk.style.display = 'block';
        pnlCustom.style.display = 'none';
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
        window._lastLocalActionTime = Date.now();
        await window.loadDashboardData(false);

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

    window._isImportProcessing = true;
    try {
        const base = (window.BASE_API_URL || window.API_BASE_URL || window.BASE_URL || window.location.origin).replace(/\/+$/, '');
        
        // Atur ukuran batch agar progress bar bertambah secara riil dan interaktif
        const BATCH_SIZE = totalCount > 100 ? 50 : (totalCount > 30 ? 20 : totalCount);
        const totalBatches = Math.ceil(totalCount / BATCH_SIZE);
        if (overwrite && typeof window.sembunyikanHasilSPK === 'function') {
            window.sembunyikanHasilSPK();
        }

        for (let b = 0; b < totalBatches; b++) {
            if (isCancelled || loader.isCancelled()) {
                break;
            }

            const start = b * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, totalCount);
            const chunk = rawData.slice(start, end);
            const isLastBatch = (b === totalBatches - 1);

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
                    replace_all: (overwrite && b === 0),
                    keep_all_vars: keepAllVars,
                    silent: !isLastBatch,
                    is_final: isLastBatch
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
                        keep_all_vars: keepAllVars,
                        silent: !isLastBatch,
                        is_final: isLastBatch
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
            await window.loadDashboardData(false);
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
        window._lastLocalActionTime = Date.now();

        // Refresh data dasbor, tabel arsip, dan rekapitulasi triwulan
        await window.loadDashboardData(false);
        if (typeof window.loadRekapTriwulanData === 'function') {
            try { await window.loadRekapTriwulanData(); } catch (_) {}
        }

        // Pastikan filter aktif adalah "Semua" agar data baru langsung tampak di tabel arsip
        const filterSemuaBtn = document.querySelector('.filter-btn.filter-kategori');
        if (filterSemuaBtn && window.applyFilter) {
            window.applyFilter('all', filterSemuaBtn);
        }

        Swal.fire({
            _isRaw: true,
            icon: 'success',
            title: 'Data Berhasil Disimpan & Direkap ke Triwulan!',
            html: `
                <div style="font-size:0.95rem; color:#334155; margin-bottom:12px;">
                    Berhasil memasukkan <b>${totalCount} data kependudukan</b> ke dalam Arsip Data Warga.
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px 16px; font-size:0.84rem; color:#334155; text-align:left;">
                    <div style="font-weight:700; margin-bottom:6px; color:#1e293b;">
                        Informasi Pembaruan Arsip &amp; Rekap Triwulanan:
                    </div>
                    <div style="margin-bottom:4px;">&bull; Perbandingan <b>Data Lama vs Data Baru</b> (tempat tinggal, alamat, pindah kota, meninggal, kondisi ekonomi) telah direkap otomatis.</div>
                    <div>&bull; Skor SPK BWM-SAW &amp; <b>Penurunan/Penyesuaian Desil Otomatis</b> telah disinkronkan sesuai kondisi terbaru.</div>
                </div>
            `,
            showCloseButton: true,
            allowOutsideClick: true,
            allowEscapeKey: true,
            confirmButtonText: '<i class="fas fa-folder-open" style="margin-right:8px; pointer-events:none;"></i> Lihat Arsip Data Warga',
            buttonsStyling: false,
            customClass: {
                popup: 'swal-modern-rounded',
                confirmButton: 'swal-btn-pill-primary',
                closeButton: 'swal-close-modern'
            },
            didOpen: (popup) => {
                const confirmBtn = popup.querySelector('.swal2-confirm, .swal-btn-pill-primary');
                if (confirmBtn) {
                    confirmBtn.style.setProperty('cursor', 'pointer', 'important');
                    confirmBtn.style.setProperty('pointer-events', 'auto', 'important');
                    confirmBtn.style.setProperty('z-index', '99999999', 'important');
                    confirmBtn.removeAttribute('disabled');
                    confirmBtn.onclick = (e) => {
                        if (e) {
                            try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
                        }
                        try {
                            if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
                                Swal.close();
                            }
                        } catch (_) {}
                        const tableCard = document.querySelector('.table-column .card') || document.getElementById('wargaTable');
                        if (tableCard) {
                            tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    };
                }

                const closeBtn = popup.querySelector('.swal2-close, .swal-close-modern');
                if (closeBtn) {
                    closeBtn.style.setProperty('cursor', 'pointer', 'important');
                    closeBtn.style.setProperty('pointer-events', 'auto', 'important');
                    closeBtn.style.setProperty('z-index', '99999999', 'important');
                    closeBtn.removeAttribute('disabled');
                    closeBtn.onclick = (e) => {
                        if (e) {
                            try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
                        }
                        try {
                            if (typeof Swal !== 'undefined' && typeof Swal.close === 'function') {
                                Swal.close();
                            }
                        } catch (_) {}
                    };
                }
            },
            preConfirm: () => {
                const tableCard = document.querySelector('.table-column .card') || document.getElementById('wargaTable');
                if (tableCard) {
                    tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return true;
            }
        }).then((result) => {
            const tableCard = document.querySelector('.table-column .card') || document.getElementById('wargaTable');
            if (tableCard) {
                tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

    } catch (err) {
        if (err.name === 'AbortError' || isCancelled || loader.isCancelled()) {
            await window.loadDashboardData(false);
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
    } finally {
        window._isImportProcessing = false;
    }
};

// =========================================================================
