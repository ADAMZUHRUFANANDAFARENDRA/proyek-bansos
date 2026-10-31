import { Router, Request, Response } from 'express';
import {
  isSpkCriterionKey,
  wargaStore,
  setWargaStore,
  wargaBackupStore,
  setWargaBackupStore,
  kriteriaStore,
  usersStore,
  pengaduanStore,
  chatStore,
  notifikasiStore,
  catatNotifikasi,
  formatWarga,
  formatWargaSafe,
  nowTimeStr,
  upload
} from '../store.js';
import {
  syncAllDataToMysql,
  saveArsipBackupToDisk,
  loadArsipBackupFromDisk
} from '../../mysql_storage.js';

function triggerAutoSyncMysql(syncBackupToo = false) {
  setTimeout(async () => {
    try {
      if (syncBackupToo) {
        saveArsipBackupToDisk(wargaBackupStore);
      }
      await syncAllDataToMysql(
        wargaStore,
        kriteriaStore,
        usersStore,
        pengaduanStore,
        chatStore,
        notifikasiStore,
        syncBackupToo ? wargaBackupStore : undefined
      );
    } catch (_) {}
  }, 50);
}
import {
  parseFloatSafe,
  parseIntSafe,
  hitungDanSinkronkanSawBwm,
  seedInitialWarga
} from '../spk_engine.js';
import {
  getJadwalInputStatus,
  wargaBaselineStore,
  setWargaBaselineStore,
  initBaselineDanRekapTriwulan,
  jalankanRekapitulasiPerubahanData
} from '../rekap_engine.js';
import { broadcastRealtimeEvent, realtimeAduanUpdate } from '../realtime.js';
import { verifySecureJwt } from '../security_guard.js';
import type { WargaItem } from '../types.js';

const router = Router();

function isStaffAuthenticated(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const ver = verifySecureJwt(token);
    if (ver.valid && ver.payload && ver.payload.role) {
      const r = String(ver.payload.role).toLowerCase().replace(/[\s-]/g, '_');
      if (['super_admin', 'superadmin', 'admin', 'developer', 'petugas'].includes(r)) {
        return true;
      }
    }
  }
  if (req.query.token) {
    const ver = verifySecureJwt(String(req.query.token).trim());
    if (ver.valid && ver.payload && ver.payload.role) {
      const r = String(ver.payload.role).toLowerCase().replace(/[\s-]/g, '_');
      if (['super_admin', 'superadmin', 'admin', 'developer', 'petugas'].includes(r)) {
        return true;
      }
    }
  }
  return false;
}

router.get(['/', '/warga', '/api/warga'], (req: Request, res: Response) => {
  seedInitialWarga();
  sinkronkanDanBersihkanDataWarga();
  const searchQuery = String(req.query.search || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || '').trim().toLowerCase();
  const sortMode = String(req.query.sort || 'terbaru').trim().toLowerCase();

  let list = [...wargaStore];

  if (searchQuery) {
    list = list.filter(
      w => w.nama.toLowerCase().includes(searchQuery) || w.nik.toLowerCase().includes(searchQuery)
    );
  }

  if (statusFilter === 'layak') {
    list = list.filter(w => w.desil <= 4);
  } else if (statusFilter === 'proses' || statusFilter === 'sedang_proses' || statusFilter === 'disalurkan') {
    list = list.filter(w => {
      const isMenerimaBansos = (w.desil <= 4 || w.status_bansos === 'Menerima Bansos' || w.status_bansos === 'Layak Bansos') &&
                              w.status_bansos !== 'Tidak Menerima';
      if (!isMenerimaBansos) return false;
      const sudahDiterima = w.status_salur === 'Telah Menerima' || w.status_salur === 'Sudah Diterima' || Boolean(w.konfirmasi_warga);
      if (sudahDiterima) return false;
      if (String(w.status_salur || '').toLowerCase().includes('sengketa')) return false;
      return true;
    });
  } else if (statusFilter === 'menerima') {
    list = list.filter(w => w.status_salur === 'Telah Menerima' || w.status_salur === 'Sudah Diterima' || Boolean(w.konfirmasi_warga));
  } else if (statusFilter === 'bermasalah') {
    list = list.filter(w => w.status_salur.toLowerCase().includes('sengketa') || !w.is_verified);
  }

  if (sortMode === 'terlama') {
    list.sort((a, b) => a.id - b.id);
  } else if (sortMode === 'az') {
    list.sort((a, b) => a.nama.localeCompare(b.nama));
  } else if (sortMode === 'za') {
    list.sort((a, b) => b.nama.localeCompare(a.nama));
  } else {
    list.sort((a, b) => b.id - a.id);
  }

  const isAuth = isStaffAuthenticated(req);
  if (!isAuth) {
    return res.json(list.map(w => formatWargaSafe(w, true)));
  }
  res.json(list.map(w => formatWarga(w)));
});

router.post(['/', '/warga', '/api/warga', '/api/publik/daftar'], upload.any(), (req: Request, res: Response) => {
  const d = req.body || {};
  const nik = String(d.nik || '').trim();
  const nama = String(d.nama || d.nama_lengkap || '').trim();

  if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
    return res.status(400).json({ status: 'error', message: 'NIK wajib 16 digit angka valid.' });
  }
  if (!nama) {
    return res.status(400).json({ status: 'error', message: 'Nama lengkap pemohon wajib diisi.' });
  }

  const jadwalStatus = getJadwalInputStatus();
  if (!jadwalStatus.status_buka && !d.force_override) {
    return res.status(403).json({
      status: 'error',
      code: 'JENDELA_INPUT_TERTUTUP',
      message: `Penginputan ditutup karena telah melewati tanggal 26 (${jadwalStatus.tanggal_aktif}). Penginputan dibuka setiap bulan Tanggal 1–10 atau sebelum Tanggal 26.`
    });
  }

  // Jika NIK sudah terdaftar di data lama, perbarui dengan data baru dan jalankan rekapitulasi mutasi & penyesuaian desil otomatis
  const existingIdx = wargaStore.findIndex(w => w.nik === nik);
  if (existingIdx !== -1 && d.strict_new !== true) {
    const oldSnap = JSON.parse(JSON.stringify(wargaStore[existingIdx]));
    const baseIdx = wargaBaselineStore.findIndex(w => w.nik === nik);
    if (baseIdx === -1) {
      wargaBaselineStore.push(oldSnap);
    } else {
      wargaBaselineStore[baseIdx] = oldSnap;
    }

    const w = wargaStore[existingIdx];
    w.nama = nama;
    if (d.tempat_lahir) w.tempat_lahir = String(d.tempat_lahir);
    if (d.tanggal_lahir || d.tglLahir) w.tanggal_lahir = String(d.tanggal_lahir || d.tglLahir).slice(0, 10);
    if (d.alamat) w.alamat = String(d.alamat);
    if (d.no_hp !== undefined) w.no_hp = String(d.no_hp);
    if (d.email !== undefined) w.email = String(d.email);
    if (d.lat !== undefined && d.lat !== '') w.lat = parseFloatSafe(d.lat ?? d.latitude, w.lat);
    if (d.lng !== undefined && d.lng !== '') w.lng = parseFloatSafe(d.lng ?? d.longitude, w.lng);
    w.c1 = parseFloatSafe(d.c1 ?? d.c1_ekonomi, w.c1);
    w.c2 = parseFloatSafe(d.c2 ?? d.c2_aset, w.c2);
    w.c3 = parseIntSafe(d.c3 ?? d.c3_umur, w.c3);
    w.c4 = parseIntSafe(d.inputC4 ?? d.c4 ?? d.c4_jenis_kelamin, w.c4);
    w.c5 = parseIntSafe(d.c5 ?? d.c5_tanggungan, w.c5);
    w.c6 = parseIntSafe(d.inputC6 ?? d.c6 ?? d.c6_status_pernikahan, w.c6);
    w.c7 = parseIntSafe(d.c7 ?? d.c7_kepemilikan_anak, w.c7);
    w.c8 = parseIntSafe(d.inputC8 ?? d.c8 ?? d.c8_tempat_tinggal, w.c8);
    w.c9 = parseIntSafe(d.inputC9 ?? d.c9 ?? d.c9_pendidikan, w.c9);
    w.c10 = parseIntSafe(d.inputC10 ?? d.c10 ?? d.c10_kesehatan, w.c10);
    if (d.catatan !== undefined && String(d.catatan).trim() !== '') w.catatan = String(d.catatan);
    if (d.status_mutasi !== undefined) (w as any).status_mutasi = String(d.status_mutasi);
    if (d.kota_tujuan !== undefined) (w as any).kota_tujuan = String(d.kota_tujuan);

    const rekap = jalankanRekapitulasiPerubahanData(
      wargaBaselineStore,
      wargaStore,
      `Pemutakhiran Data Baru atas Data Lama NIK ${nik} (${nama})`
    );
    const rekapItem = rekap.items.find(it => it.nik === nik) || null;

    catatNotifikasi(
      `Pemutakhiran Data Baru warga NIK ${nik} (${nama}): ${rekapItem?.keterangan_desil_otomatis || `Desil disesuaikan menjadi Desil ${w.desil}`}`,
      'Petugas',
      'rekap'
    );

    broadcastRealtimeEvent({
      type: 'WARGA_REKAP_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      ringkasan: rekap.ringkasan,
      data: formatWarga(w)
    });
    triggerAutoSyncMysql();

    return res.status(200).json({
      status: 'success',
      updated: true,
      message: `Data baru untuk NIK ${nik} (${nama}) berhasil memperbarui data lama! ${rekapItem?.keterangan_desil_otomatis || ''}`.trim(),
      data: formatWarga(w),
      rekap_item: rekapItem,
      rekap_ringkasan: rekap.ringkasan
    });
  }

  const nextId = wargaStore.length > 0 ? Math.max(...wargaStore.map(w => w.id)) + 1 : 1;
  const isVerif = Boolean(d.is_verified === true || d.is_verified === 'true' || d.is_verified === '1' || d.is_verified === undefined);

  const newWarga: WargaItem = {
    id: nextId,
    nik,
    nama,
    tempat_lahir: String(d.tempat_lahir || 'Sidoarjo'),
    tanggal_lahir: String(d.tanggal_lahir || d.tglLahir || '1985-01-01').slice(0, 10),
    alamat: String(d.alamat || 'Kabupaten Sidoarjo'),
    no_hp: String(d.no_hp || ''),
    email: String(d.email || ''),
    lat: parseFloatSafe(d.lat ?? d.latitude, -7.4478),
    lng: parseFloatSafe(d.lng ?? d.longitude, 112.7183),
    c1: parseFloatSafe(d.c1 ?? d.c1_ekonomi, 1500000),
    c2: parseFloatSafe(d.c2 ?? d.c2_aset, 5000000),
    c3: parseIntSafe(d.c3 ?? d.c3_umur, 45),
    c4: parseIntSafe(d.inputC4 ?? d.c4 ?? d.c4_jenis_kelamin, 1),
    c5: parseIntSafe(d.c5 ?? d.c5_tanggungan, 3),
    c6: parseIntSafe(d.inputC6 ?? d.c6 ?? d.c6_status_pernikahan, 2),
    c7: parseIntSafe(d.c7 ?? d.c7_kepemilikan_anak, 2),
    c8: parseIntSafe(d.inputC8 ?? d.c8 ?? d.c8_tempat_tinggal, 2),
    c9: parseIntSafe(d.inputC9 ?? d.c9 ?? d.c9_pendidikan, 1),
    c10: parseIntSafe(d.inputC10 ?? d.c10 ?? d.c10_kesehatan, 1),
    desil: 5,
    skor_saw: 0,
    rank_saw: 0,
    is_verified: isVerif,
    status_validasi: isVerif ? 'Disetujui' : 'Menunggu',
    status_salur: String(d.status_salur || 'Belum Salur'),
    status_bansos: 'Menunggu Verifikasi',
    prioritas: 'Menunggu',
    bukti_salur: '',
    catatan: String(d.catatan || 'Pendaftaran Baru'),
    nominal_bantuan: String(d.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg'),
    tanggal_salur: '-',
    created_at: nowTimeStr(),
    ...(d.status_mutasi ? { status_mutasi: String(d.status_mutasi) } : {}),
    ...(d.kota_tujuan ? { kota_tujuan: String(d.kota_tujuan) } : {})
  };

  wargaStore.push(newWarga);
  const rekap = jalankanRekapitulasiPerubahanData(
    wargaBaselineStore,
    wargaStore,
    `Penambahan Data Warga Baru NIK ${nik} (${nama})`
  );
  const rekapItem = rekap.items.find(it => it.nik === nik) || null;
  catatNotifikasi(`Pendaftaran baru warga NIK ${nik} (${nama}) berhasil disimpan dan direkap pada Desil ${newWarga.desil}.`, 'Petugas', 'warga');

  broadcastRealtimeEvent({
    type: 'WARGA_REKAP_UPDATED',
    warga_id: newWarga.id,
    nik: newWarga.nik,
    ringkasan: rekap.ringkasan,
    data: formatWarga(newWarga)
  });
  triggerAutoSyncMysql();

  return res.status(201).json({
    status: 'success',
    message: `Data warga berhasil disimpan dan ditetapkan pada Desil ${newWarga.desil}!`,
    data: formatWarga(newWarga),
    rekap_item: rekapItem,
    rekap_ringkasan: rekap.ringkasan
  });
});

router.post(['/verify-all', '/bulk/verify'], (_req: Request, res: Response) => {
  wargaStore.forEach(w => {
    w.is_verified = true;
    w.status_validasi = 'Disetujui';
  });
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql();
  catatNotifikasi('Persetujuan massal: Seluruh berkas pendaftaran warga aktif telah disetujui bersamaan.', 'Admin', 'verifikasi');
  res.json({ status: 'success', message: 'Seluruh data warga berhasil disetujui.' });
});

router.post(['/unverify-all', '/bulk/unverify'], (_req: Request, res: Response) => {
  wargaStore.forEach(w => {
    w.is_verified = false;
    w.status_validasi = 'Menunggu';
  });
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql();
  catatNotifikasi('Pembatalan massal: Seluruh verifikasi warga dikembalikan ke status Menunggu.', 'Admin', 'verifikasi');
  res.json({ status: 'success', message: 'Seluruh persetujuan berhasil dibatalkan.' });
});

router.all(['/delete-all'], (_req: Request, res: Response) => {
  if (wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  }
  setWargaStore([]);
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql(true);
  catatNotifikasi('Seluruh data kependudukan telah berhasil dihapus dari arsip warga.', 'Admin', 'urgent');
  res.json({ status: 'success', message: 'Tabel arsip warga berhasil dikosongkan seluruhnya.' });
});

function resolveField(r: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(r);
  // 1. Pencocokan tepat (Exact Match)
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanAlias) {
        const val = r[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  // 2. Pencocokan substring dengan aturan ketat (Alamat tidak boleh memuat email/surel)
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAlias.includes('alamat') && (cleanK.includes('email') || cleanK.includes('surel') || cleanK.includes('mail'))) {
        continue;
      }
      if (cleanAlias.length >= 4 && cleanK.includes(cleanAlias)) {
        const val = r[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function resolveNik(r: Record<string, unknown>, rowIdx = 0): string {
  const direct = resolveField(r, [
    'nik', 'nomorindukkependudukan', 'noktp', 'ktp', 'nonik', 'noidentitas', 
    'nik16digit', 'nomorktp', 'no_ktp', 'nomor_nik', 'nomor_identitas', 'identitas_kependudukan'
  ]);
  if (direct) {
    let clean = String(direct).trim();
    if (/e\+/i.test(clean)) {
      const num = Number(clean);
      if (!isNaN(num)) clean = BigInt(Math.round(num)).toString();
    }
    clean = clean.replace(/\.0$/, '');
    const digits = clean.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return digits.slice(0, 16);
  }
  for (const [k, v] of Object.entries(r)) {
    const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kLow.includes('nik') || kLow.includes('ktp') || kLow.includes('identitas')) {
      let s = String(v || '').trim();
      if (/e\+/i.test(s)) {
        const num = Number(s);
        if (!isNaN(num)) s = BigInt(Math.round(num)).toString();
      }
      s = s.replace(/\.0$/, '');
      const digits = s.replace(/[^0-9]/g, '');
      if (digits.length >= 8) return digits.slice(0, 16);
    }
  }
  for (const val of Object.values(r)) {
    const s = String(val || '').trim().replace(/[^0-9]/g, '');
    if (s.length === 16 && (s.startsWith('35') || s.startsWith('31') || s.startsWith('32') || s.startsWith('33') || s.startsWith('34') || s.startsWith('36'))) {
      return s;
    }
  }
  const randDigits = String(Date.now()).slice(-8) + String(rowIdx).padStart(4, '0');
  return `3515${randDigits}`;
}

function resolveNama(r: Record<string, unknown>): string {
  const direct = resolveField(r, [
    'nama_lengkap', 'namalengkap', 'nama', 'namawarga', 'namapenduduk', 'namapenerima', 
    'namakpm', 'namakk', 'namakrt', 'nama_warga', 'nama_penduduk', 'nama_pemohon', 'fullname', 'name'
  ]);
  const cleanNameString = (s: string): string => {
    let res = s.trim();
    res = res.replace(/^\d+[\.\)\-\s]+/, '').trim();
    // Bersihkan jika nama warga ketempelan nilai kriteria kolom sebelah (misal Ada (...), Tidak Ada, dll.)
    res = res.replace(/\s+(Ada\s*\([^)]*\)|Ada\s*\(.*|Tidak Ada\b.*)$/i, '').trim();
    res = res.replace(/[,;:_-]+$/, '').trim();
    return res;
  };

  if (direct && !/^\d+$/.test(direct)) {
    const cleaned = cleanNameString(direct);
    if (cleaned.length >= 2) return cleaned;
  }

  for (const [k, v] of Object.entries(r)) {
    const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kLow.includes('nama') && !kLow.includes('ayah') && !kLow.includes('ibu') && !kLow.includes('petugas') && !kLow.includes('operator')) {
      const s = String(v || '').trim();
      if (s.length >= 2 && !/^\d+$/.test(s)) {
        const cleaned = cleanNameString(s);
        if (cleaned.length >= 2) return cleaned;
      }
    }
  }
  return '';
}

function parseDateToYmd(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  let s = String(val).trim();
  if (!s || s === '-' || s === 'null' || s === 'undefined') return '';

  // Tangani serial number Excel (contoh: 25914 atau 31182)
  const numVal = Number(s);
  if (!isNaN(numVal) && numVal > 10000 && numVal < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const dateObj = new Date(excelEpoch.getTime() + numVal * 86400000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().slice(0, 10);
    }
  }

  // Format YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // Format DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // Bulan bahasa Indonesia
  const bulanMap: Record<string, string> = {
    'januari': '01', 'jan': '01', 'februari': '02', 'feb': '02', 'maret': '03', 'mar': '03',
    'april': '04', 'apr': '04', 'mei': '05', 'may': '05', 'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07', 'agustus': '08', 'ags': '08', 'agt': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'oktober': '10', 'okt': '10', 'oct': '10',
    'november': '11', 'nov': '11', 'desember': '12', 'des': '12', 'dec': '12'
  };

  const textDateMatch = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const monthKey = textDateMatch[2].toLowerCase();
    const year = textDateMatch[3];
    const month = bulanMap[monthKey] || '01';
    return `${year}-${month}-${day}`;
  }

  return s.slice(0, 10);
}

function resolveTtl(r: Record<string, unknown>): { tempatLahir: string; tanggalLahir: string } {
  // 1. Cek jika ada kolom TTL gabungan (contoh: "Malang, 12 Desember 1970" atau "Sidoarjo, 15/05/1985")
  const ttlField = resolveField(r, [
    'ttl', 'tempattanggallahir', 'tempat_tanggal_lahir', 'tempat_tgl_lahir', 
    'tempattgllahir', 'kelahiran', 'tempat_tgl'
  ]);

  if (ttlField && ttlField.includes(',')) {
    const parts = ttlField.split(',');
    const tmp = parts[0].trim();
    const tglRaw = parts.slice(1).join(',').trim();
    const tgl = parseDateToYmd(tglRaw);
    return {
      tempatLahir: tmp || 'Sidoarjo',
      tanggalLahir: tgl || '1985-05-15'
    };
  } else if (ttlField && ttlField.includes('/')) {
    const parts = ttlField.split('/');
    if (parts.length >= 2 && /[a-zA-Z]/.test(parts[0])) {
      const tmp = parts[0].trim();
      const tglRaw = parts.slice(1).join('/').trim();
      const tgl = parseDateToYmd(tglRaw);
      return {
        tempatLahir: tmp || 'Sidoarjo',
        tanggalLahir: tgl || '1985-05-15'
      };
    }
  }

  // 2. Jika kolom Tempat Lahir dan Tanggal Lahir terpisah
  const tmp = resolveField(r, [
    'tempatlahir', 'tempat_lahir', 'tmplahir', 'kotalahir', 'kota_lahir', 
    'tempatkelahiran', 'asalkota', 'tempat'
  ]) || 'Sidoarjo';

  const tglRaw = resolveField(r, [
    'tanggallahir', 'tanggal_lahir', 'tgllahir', 'tgl_lahir', 'tgl', 
    'tanggal', 'dob', 'dateofbirth', 'birthdate'
  ]);
  const tgl = parseDateToYmd(tglRaw) || '1985-05-15';

  return { tempatLahir: tmp, tanggalLahir: tgl };
}

function resolveAlamat(r: Record<string, unknown>): string {
  // 1. Cek jika ada kolom alamat lengkap langsung
  const directAlamat = resolveField(r, [
    'alamat_lengkap', 'alamatlengkap', 'alamat', 'alamatdomisili', 'alamat_domisili', 
    'alamatktp', 'alamat_ktp', 'domisili', 'tempattinggal', 'tempat_tinggal', 'lokasi'
  ]);

  if (directAlamat && directAlamat.length >= 5 && !directAlamat.includes('@') && !directAlamat.includes('.com') && !directAlamat.includes('.id') && directAlamat.toLowerCase() !== 'kabupaten sidoarjo' && directAlamat.toLowerCase() !== 'sidoarjo') {
    return directAlamat;
  }

  // 2. Rekonstruksi cerdas dari komponen geografis
  const jalan = resolveField(r, ['jalan', 'jl', 'dusun', 'dsn', 'gang', 'blok', 'alamat_jalan', 'nama_jalan']);
  const rtRw = resolveField(r, ['rtrw', 'rt_rw', 'rt', 'rw']);
  const desa = resolveField(r, ['desa_kelurahan', 'desakelurahan', 'desa', 'kelurahan', 'desakel', 'kel', 'ds']);
  const kec = resolveField(r, ['kecamatan', 'kec', 'distrik', 'wilayah_kecamatan']);

  const parts: string[] = [];
  if (jalan) parts.push(jalan);
  if (rtRw) {
    parts.push(rtRw.toLowerCase().includes('rt') ? rtRw : `RT/RW ${rtRw}`);
  }
  if (desa) {
    parts.push(desa.toLowerCase().includes('desa') || desa.toLowerCase().includes('kel') ? desa : `Desa ${desa}`);
  }
  if (kec) {
    parts.push(kec.toLowerCase().includes('kec') ? kec : `Kec. ${kec}`);
  }

  if (parts.length > 0) {
    parts.push('Kabupaten Sidoarjo');
    return parts.join(', ');
  }

  if (directAlamat) return directAlamat;
  return 'Kabupaten Sidoarjo';
}

function resolveNoHp(r: Record<string, unknown>): string {
  const raw = resolveField(r, [
    'nowhatsapp', 'no_whatsapp', 'nowa', 'no_wa', 'whatsapp', 'wa', 
    'nohp', 'no_hp', 'hp', 'telepon', 'phone', 'telp', 'ponsel', 'kontak', 'handphone'
  ]);
  if (!raw) return '';
  let clean = String(raw).trim().replace(/[^0-9]/g, '');
  if (!clean) return '';

  if (clean.startsWith('8') && clean.length >= 9 && clean.length <= 13) {
    clean = '0' + clean;
  } else if (clean.startsWith('628')) {
    clean = '0' + clean.slice(2);
  }
  return clean;
}

function resolveEmail(r: Record<string, unknown>): string {
  const direct = resolveField(r, ['email', 'surel', 'e_mail', 'alamatemail', 'alamat_email', 'mail']);
  if (direct && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(direct)) return direct;
  for (const v of Object.values(r)) {
    const s = String(v || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return '';
}

function resolveCoords(r: Record<string, unknown>): { lat: number; lng: number } {
  const latRaw = resolveField(r, ['garis_lintang', 'garislintang', 'latitude', 'lat', 'lintang', 'y']);
  const lngRaw = resolveField(r, ['garis_bujur', 'garisbujur', 'longitude', 'long', 'lng', 'bujur', 'x']);

  const lat = parseFloatSafe(latRaw, -7.4478);
  const lng = parseFloatSafe(lngRaw, 112.7183);
  return { lat, lng };
}


export function extractSpkCriteria(r: Record<string, unknown>, fallbackWarga?: Partial<WargaItem>) {
  const normMap: Record<string, unknown> = {};
  for (const k of Object.keys(r || {})) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    normMap[norm] = r[k];
  }

  function getVal(patterns: string[]): unknown {
    for (const p of patterns) {
      const pNorm = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (pNorm in normMap && normMap[pNorm] !== undefined && normMap[pNorm] !== null && String(normMap[pNorm]).trim() !== '') {
        return normMap[pNorm];
      }
    }
    return undefined;
  }

  // C1: Kondisi Ekonomi / Penghasilan
  const c1Raw = getVal([
    'c1_ekonomi', 'c1ekonomi', 'c1', 'penghasilankk', 'penghasilan_kk', 'penghasilan', 
    'gajikk', 'gaji', 'pendapatan', 'c01_ekonomi', 'c01ekonomi', 'c01', 'k01_penghasilan'
  ]);
  const c1 = c1Raw !== undefined ? parseFloatSafe(c1Raw, 1500000) : (fallbackWarga?.c1 ?? 1500000);

  // C2: Kepemilikan Aset
  const c2Raw = getVal([
    'c2_aset', 'c2aset', 'c2', 'nilaiaset', 'nilai_aset', 'aset', 'kepemilikanaset', 
    'kepemilikan_aset', 'c02_aset', 'c02aset', 'c02', 'k02_aset'
  ]);
  const c2 = c2Raw !== undefined ? parseFloatSafe(c2Raw, 5000000) : (fallbackWarga?.c2 ?? 5000000);

  // C3: Umur Kepala Keluarga
  const c3Raw = getVal([
    'c3_umur_kk', 'c3umurkk', 'c3_umur', 'c3umur', 'c3_usia', 'c3usia', 'c3', 
    'usiakk', 'usia_kk', 'umur_kk', 'umurkk', 'umur', 'usia', 'c03_umur', 'c03', 'k03_umur'
  ]);
  const c3 = c3Raw !== undefined ? parseIntSafe(c3Raw, 45) : (fallbackWarga?.c3 ?? 45);

  // C4: Jenis Kelamin (1: Laki-laki, 2: Perempuan)
  const c4Raw = getVal([
    'c4_jenis_kelamin', 'c4jeniskelamin', 'c4_kelamin', 'c4kelamin', 'c4_gender', 
    'c4gender', 'c4', 'jenis_kelamin', 'jeniskelamin', 'gender', 'kelamin', 'jk', 'c04', 'k04_jk'
  ]);
  let c4 = fallbackWarga?.c4 ?? 1;
  if (c4Raw !== undefined) {
    const s = String(c4Raw).toLowerCase().trim();
    if (s === '2' || s === 'perempuan' || s === 'wanita' || s === 'p' || s.includes('perempuan') || s.includes('wanita')) {
      c4 = 2;
    } else if (s === '1' || s === 'laki' || s === 'pria' || s === 'l' || s.includes('laki') || s.includes('pria')) {
      c4 = 1;
    } else {
      c4 = parseIntSafe(c4Raw, 1);
    }
  }

  // C5: Jumlah Tanggungan
  const c5Raw = getVal([
    'c5_tanggungan', 'c5tanggungan', 'c5_jml_tanggungan', 'c5', 'jumlahtanggungan', 
    'jumlah_tanggungan', 'tanggungan', 'jml_tanggungan', 'jmltanggungan', 'c05', 'k05_tanggungan'
  ]);
  const c5 = c5Raw !== undefined ? parseIntSafe(c5Raw, 3) : (fallbackWarga?.c5 ?? 3);

  // C6: Status Pernikahan (1: Belum Kawin, 2: Kawin, 3: Cerai)
  const c6Raw = getVal([
    'c6_status_kawin', 'c6statuskawin', 'c6_status_pernikahan', 'c6statuspernikahan', 
    'c6', 'status_kawin', 'statuskawin', 'status_pernikahan', 'statuspernikahan', 'pernikahan', 'c06', 'k06_status'
  ]);
  let c6 = fallbackWarga?.c6 ?? 2;
  if (c6Raw !== undefined) {
    const s = String(c6Raw).toLowerCase().trim();
    if (s === '1' || s.includes('belum') || s.includes('lajang') || s.includes('single')) {
      c6 = 1;
    } else if (s === '3' || s.includes('cerai') || s.includes('duda') || s.includes('janda') || s.includes('mati')) {
      c6 = 3;
    } else if (s === '2' || s.includes('kawin') || s.includes('nikah')) {
      c6 = 2;
    } else {
      c6 = parseIntSafe(c6Raw, 2);
    }
  }

  // C7: Kepemilikan Anak / Balita
  const c7Raw = getVal([
    'c7_kepemilikan_anak', 'c7kepemilikananak', 'c7_anak', 'c7anak', 'c7_balita', 
    'c7balita', 'c7_kondisi_rumah', 'c7', 'kepemilikan_anak', 'anak', 'balita', 'c07', 'k07_anak'
  ]);
  const c7 = c7Raw !== undefined ? parseIntSafe(c7Raw, 2) : (fallbackWarga?.c7 ?? 2);

  // C8: Kelayakan Tempat Tinggal / Status Rumah (1: Milik Sendiri, 2: Menumpang/Kontrak, 3: Sewa/Tidak Layak)
  const c8Raw = getVal([
    'c8_status_rumah', 'c8statusrumah', 'c8_tempat_tinggal', 'c8tempattinggal', 
    'c8_kelayakan_rumah', 'c8', 'k10_status_rumah', 'k10statusrumah', 'statusrumah', 
    'status_rumah', 'tempat_tinggal', 'tempattinggal', 'kelayakan_rumah', 'c08', 'k08_rumah'
  ]);
  let c8 = fallbackWarga?.c8 ?? 2;
  if (c8Raw !== undefined) {
    const s = String(c8Raw).toLowerCase().trim();
    if (s === '1' || s.includes('sendiri') || s.includes('milik')) {
      c8 = 1;
    } else if (s === '3' || s.includes('sewa') || s.includes('rusak') || s.includes('tidak layak') || s.includes('bebas sewa')) {
      c8 = 3;
    } else if (s === '2' || s.includes('numpang') || s.includes('kontrak') || s.includes('dinas')) {
      c8 = 2;
    } else {
      c8 = parseIntSafe(c8Raw, 2);
    }
  }

  // C9: Tingkat Pendidikan Terakhir (1: SD/Tidak Sekolah, 2: SMP, 3: SMA/SMK, 4: PT/Sarjana)
  const c9Raw = getVal([
    'c9_pendidikan_kk', 'c9pendidikankk', 'c9_pendidikan', 'c9pendidikan', 'c9', 
    'pendidikankk', 'pendidikan_kk', 'pendidikan', 'pendidikan_terakhir', 'pendidikanterakhir', 'c09', 'k09_pendidikan'
  ]);
  let c9 = fallbackWarga?.c9 ?? 1;
  if (c9Raw !== undefined) {
    const s = String(c9Raw).toLowerCase().trim();
    if (s === '4' || s.includes('sarjana') || s.includes('diploma') || s.includes('perguruan') || s.includes('s1') || s.includes('s2') || s.includes('s3') || s.includes('pt')) {
      c9 = 4;
    } else if (s === '3' || s.includes('sma') || s.includes('smk') || s.includes('sltp') || s.includes('aliyah') || s.includes('ma')) {
      c9 = 3;
    } else if (s === '2' || s.includes('smp') || s.includes('mts')) {
      c9 = 2;
    } else if (s === '1' || s.includes('sd') || s.includes('tidak') || s.includes('belum sekolah') || s.includes('mi')) {
      c9 = 1;
    } else {
      c9 = parseIntSafe(c9Raw, 1);
    }
  }

  // C10: Kondisi Kesehatan / Disabilitas (1: Sehat, 2: Penyakit Menahun/Kronis, 3: Disabilitas Berat)
  const c10Raw = getVal([
    'c10_kesehatan', 'c10kesehatan', 'c10_disabilitas', 'c10disabilitas', 'c10', 
    'kesehatan', 'kondisi_kesehatan', 'kondisikesehatan', 'disabilitas', 'penyakit_kronis', 'c010', 'k10_kesehatan'
  ]);
  let c10 = fallbackWarga?.c10 ?? 1;
  if (c10Raw !== undefined) {
    const s = String(c10Raw).toLowerCase().trim();
    if (s === '3' || s.includes('disabilitas') || s.includes('cacat') || s.includes('lumpuh')) {
      c10 = 3;
    } else if (s === '2' || s.includes('kronis') || s.includes('menahun') || s.includes('sakit') || s.includes('komplikasi')) {
      c10 = 2;
    } else if (s === '1' || s.includes('sehat') || s.includes('normal')) {
      c10 = 1;
    } else {
      c10 = parseIntSafe(c10Raw, 1);
    }
  }

  return { c1, c2, c3, c4, c5, c6, c7, c8, c9, c10 };
}

export function sinkronkanDanBersihkanDataWarga() {
  wargaStore.forEach(w => {
    // Bersihkan nama jika tidak sengaja ketempelan nilai kriteria dari kolom berikutnya
    if (w.nama && /\s+(Ada\s*\([^)]*\)|Ada\s*\(.*|Tidak Ada\b.*)$/i.test(w.nama)) {
      w.nama = w.nama.replace(/\s+(Ada\s*\([^)]*\)|Ada\s*\(.*|Tidak Ada\b.*)$/i, '').trim();
    }
    const combined = { ...(w.extra_data || {}), ...(w as any) };
    const spk = extractSpkCriteria(combined, w);

    // Cek apakah ada key kriteria spesifik di combined
    const hasSpecC1 = Object.keys(combined).some(k => /^c0?1(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c1');
    if (hasSpecC1) w.c1 = spk.c1;
    const hasSpecC2 = Object.keys(combined).some(k => /^c0?2(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c2');
    if (hasSpecC2) w.c2 = spk.c2;
    const hasSpecC3 = Object.keys(combined).some(k => /^c0?3(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c3');
    if (hasSpecC3) w.c3 = spk.c3;
    const hasSpecC4 = Object.keys(combined).some(k => /^c0?4(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c4');
    if (hasSpecC4) w.c4 = spk.c4;
    const hasSpecC5 = Object.keys(combined).some(k => /^c0?5(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c5');
    if (hasSpecC5) w.c5 = spk.c5;
    const hasSpecC6 = Object.keys(combined).some(k => /^c0?6(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c6');
    if (hasSpecC6) w.c6 = spk.c6;
    const hasSpecC7 = Object.keys(combined).some(k => /^c0?7(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c7');
    if (hasSpecC7) w.c7 = spk.c7;
    const hasSpecC8 = Object.keys(combined).some(k => /^c0?8(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c8');
    if (hasSpecC8) w.c8 = spk.c8;
    const hasSpecC9 = Object.keys(combined).some(k => /^c0?9(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c9');
    if (hasSpecC9) w.c9 = spk.c9;
    const hasSpecC10 = Object.keys(combined).some(k => /^c0?10(?:$|[^0-9])/i.test(k) && k.toLowerCase() !== 'c10');
    if (hasSpecC10) w.c10 = spk.c10;

    // Bersihkan kunci kriteria C1-C10 dari extra_data dan properti root w
    if (w.extra_data && typeof w.extra_data === 'object') {
      Object.keys(w.extra_data).forEach(k => {
        if (isSpkCriterionKey(k)) {
          delete (w.extra_data as any)[k];
        }
      });
    }
    Object.keys(w).forEach(k => {
      if (!['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].includes(k)) {
        if (isSpkCriterionKey(k)) {
          delete (w as any)[k];
        }
      }
    });
  });

  hitungDanSinkronkanSawBwm();
}

let bulkSessionBaselineCaptured = false;

router.post(['/bulk', '/bulk-import'], (req: Request, res: Response) => {
  const payload = req.body;
  const items: Record<string, unknown>[] = Array.isArray(payload) ? payload : payload?.data || [];
  const overwrite = payload?.overwrite !== false; // Default izinkan pemutakhiran data lama oleh data baru
  let berhasil = 0;
  let diperbarui = 0;

  const jadwalStatus = getJadwalInputStatus();
  if (!jadwalStatus.status_buka && !payload?.force_override) {
    return res.status(403).json({
      status: 'error',
      code: 'JENDELA_INPUT_TERTUTUP',
      message: `Impor data ditutup karena telah melewati tanggal 26 (${jadwalStatus.tanggal_aktif}). Penginputan dibuka setiap bulan Tanggal 1–10 atau sebelum Tanggal 26.`
    });
  }

  // Simpan snapshot Data Lama sebelum impor dimulai agar rekap dapat membandingkan Data Lama vs Data Baru
  if (!bulkSessionBaselineCaptured && wargaStore.length > 0) {
    setWargaBaselineStore(JSON.parse(JSON.stringify(wargaStore)));
    bulkSessionBaselineCaptured = true;
  }

  // Jika opsi timpa seluruh arsip dipilih, bersihkan data lama agar tidak tercampur sampah impor
  if ((payload?.replace_all === true || payload?.clear_existing === true) && wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
    setWargaStore([]);
  }

  const standardKeys = new Set([
    'nik', 'nama', 'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'alamat', 
    'no_hp', 'no_wa', 'email', 'lat', 'lng', 'c1', 'c2', 'c3', 'c4', 'c5', 
    'c6', 'c7', 'c8', 'c9', 'c10', 'catatan', 'extra_data', 'status_salur',
    'keterangan_salur', 'bukti_salur', 'tanggal_salur', 'nominal_bantuan'
  ]);

  items.forEach((r, rIdx) => {
    let nik = resolveNik(r, rIdx);
    const nama = resolveNama(r) || `Warga (${nik.slice(-4)})`;

    const { tempatLahir, tanggalLahir } = resolveTtl(r);
    const alamat = resolveAlamat(r);
    const noHp = resolveNoHp(r);
    const email = resolveEmail(r);
    const coords = resolveCoords(r);

    const extraData: Record<string, unknown> = {};
    Object.keys(r).forEach(k => {
      const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!standardKeys.has(lower) && !standardKeys.has(k) && !isSpkCriterionKey(k)) {
        extraData[k] = r[k];
      }
    });

    const spk = extractSpkCriteria(r);
    const c1Val = spk.c1;
    const c2Val = spk.c2;
    const c3Val = spk.c3;
    const c4Val = spk.c4;
    const c5Val = spk.c5;
    const c6Val = spk.c6;
    const c7Val = spk.c7;
    const c8Val = spk.c8;
    const c9Val = spk.c9;
    const c10Val = spk.c10;

    const catatanBaru = String(r['Catatan'] || r['catatan'] || r['Keterangan'] || r['keterangan'] || '');
    const statusMutasiBaru = String(r['Status Mutasi'] || r['status_mutasi'] || r['Status Kependudukan'] || r['status_kependudukan'] || '');
    const kotaTujuanBaru = String(r['Kota Tujuan'] || r['kota_tujuan'] || r['Kota Domisili'] || r['kota_domisili'] || '');

    const existingIdx = wargaStore.findIndex(w => w.nik === nik);
    if (existingIdx !== -1) {
      if (overwrite) {
        wargaStore[existingIdx] = {
          ...wargaStore[existingIdx],
          nama,
          tempat_lahir: tempatLahir || wargaStore[existingIdx].tempat_lahir,
          tanggal_lahir: tanggalLahir ? tanggalLahir.slice(0, 10) : wargaStore[existingIdx].tanggal_lahir,
          alamat: alamat || wargaStore[existingIdx].alamat,
          no_hp: noHp || wargaStore[existingIdx].no_hp,
          email: email || wargaStore[existingIdx].email,
          c1: c1Val,
          c2: c2Val,
          c3: c3Val,
          c4: c4Val,
          c5: c5Val,
          c6: c6Val,
          c7: c7Val,
          c8: c8Val,
          c9: c9Val,
          c10: c10Val,
          catatan: catatanBaru || wargaStore[existingIdx].catatan,
          ...(statusMutasiBaru ? { status_mutasi: statusMutasiBaru } : {}),
          ...(kotaTujuanBaru ? { kota_tujuan: kotaTujuanBaru } : {}),
          extra_data: { ...(wargaStore[existingIdx].extra_data || {}), ...extraData },
          ...extraData
        };
        diperbarui++;
      }
      return;
    }

    const wasInBaseline = wargaBaselineStore.some(w => w.nik === nik);
    if (wasInBaseline) {
      diperbarui++;
    } else {
      berhasil++;
    }

    const nextId = wargaStore.length > 0 ? Math.max(...wargaStore.map(w => w.id)) + 1 : 1;
    const newWarga: WargaItem = {
      id: nextId,
      nik,
      nama,
      tempat_lahir: tempatLahir,
      tanggal_lahir: tanggalLahir.slice(0, 10),
      alamat: alamat,
      no_hp: noHp,
      email: email,
      lat: coords.lat,
      lng: coords.lng,
      c1: c1Val,
      c2: c2Val,
      c3: c3Val,
      c4: c4Val,
      c5: c5Val,
      c6: c6Val,
      c7: c7Val,
      c8: c8Val,
      c9: c9Val,
      c10: c10Val,
      desil: 5,
      skor_saw: 0,
      rank_saw: 0,
      is_verified: true,
      status_validasi: 'Disetujui',
      status_salur: 'Belum Salur',
      status_bansos: 'Layak Bansos',
      prioritas: 'Prioritas Utama',
      bukti_salur: '',
      keterangan_salur: '',
      tanggal_salur: '-',
      konfirmasi_warga: false,
      waktu_konfirmasi_warga: '',
      catatan: catatanBaru || 'Impor Arsip Data Baru',
      nominal_bantuan: 'Rp 600.000 / Beras 10 Kg',
      created_at: nowTimeStr(),
      ...(statusMutasiBaru ? { status_mutasi: statusMutasiBaru } : {}),
      ...(kotaTujuanBaru ? { kota_tujuan: kotaTujuanBaru } : {}),
      extra_data: extraData,
      ...extraData
    };
    wargaStore.push(newWarga);
  });

  const isSilentBatch = req.body?.silent === true || req.body?.is_final === false;
  let rekapReport = null;
  if (!isSilentBatch) {
    rekapReport = jalankanRekapitulasiPerubahanData(
      wargaBaselineStore,
      wargaStore,
      'Impor Data Baru & Evaluasi Mutasi Penyaluran 3 Bulan Sekali'
    );
    bulkSessionBaselineCaptured = false;
    catatNotifikasi(
      `Impor & Rekap Triwulan selesai: ${berhasil} warga baru, ${diperbarui} diperbarui, ${rekapReport.ringkasan.total_berubah} perubahan kondisi/domisili terdeteksi (${rekapReport.ringkasan.desil_diturunkan_prioritas} desil diturunkan ke prioritas).`,
      'Admin',
      'import'
    );
    broadcastRealtimeEvent({
      type: 'WARGA_REKAP_UPDATED',
      kode_periode: rekapReport.kode_periode,
      ringkasan: rekapReport.ringkasan,
      waktu: nowTimeStr()
    });
    triggerAutoSyncMysql();
  }
  res.json({ 
    status: 'success', 
    message: `Berhasil mengimpor ${berhasil} data warga baru${diperbarui > 0 ? ` dan memperbarui ${diperbarui} data lama` : ''}. Rekapitulasi triwulan & penyesuaian desil otomatis telah diperbarui.`,
    berhasil,
    diperbarui,
    rekap_ringkasan: rekapReport ? rekapReport.ringkasan : null,
    kode_periode: rekapReport ? rekapReport.kode_periode : null
  });
});

router.post(['/bulk-delete', '/api/warga/bulk-delete'], (req: Request, res: Response) => {
  const rawList = Array.isArray(req.body) ? req.body : (req.body?.ids || req.body?.data || []);
  const rawIds: string[] = rawList.map((x: unknown) => String(x).trim());
  const numIds: number[] = rawIds.map(x => parseIntSafe(x, -1)).filter(n => n > 0);
  if (!rawIds.length) {
    return res.status(400).json({ status: 'error', message: 'Pilih data terlebih dahulu.' });
  }
  const beforeCount = wargaStore.length;
  setWargaStore(wargaStore.filter(w => !numIds.includes(w.id) && !rawIds.includes(String(w.id)) && !rawIds.includes(w.nik)));
  const deletedCount = beforeCount - wargaStore.length;
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql();
  catatNotifikasi(`Penghapusan massal: ${deletedCount || rawIds.length} data warga berhasil dihapus dari arsip.`, 'Admin', 'hapus');
  return res.json({ status: 'success', message: `${deletedCount || rawIds.length} data terpilih berhasil dihapus.`, deleted: deletedCount });
});

router.post(['/:warga_id/delete'], (req: Request, res: Response) => {
  const param = String(req.params.warga_id).trim();
  const idx = wargaStore.findIndex(x => String(x.id) === param || x.nik === param);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Warga tidak ditemukan.' });
  const w = wargaStore[idx];
  wargaStore.splice(idx, 1);
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql();
  catatNotifikasi(`Data kependudukan ${w.nama} (NIK: ${w.nik}) telah dihapus dari sistem.`, 'Admin', 'hapus');
  return res.json({ status: 'success', message: 'Data warga berhasil dihapus.' });
});

router.post(['/:warga_id/bukti-salur'], upload.any(), (req: Request, res: Response) => {
  const param = String(req.params.warga_id).trim();
  const w = wargaStore.find(x => String(x.id) === param || x.nik === param);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  const files = (req.files as Express.Multer.File[]) || [];
  const file = files[0];
  const fname = file ? file.filename : (req.body?.existing_file || w.bukti_salur || `bukti_${w.nik}_${Date.now()}.jpg`);

  const keterangan = String(req.body?.keterangan_salur || req.body?.keterangan || '').trim() || 'Bantuan telah diserahkan langsung kepada penerima bansos.';
  const tglSalur = String(req.body?.tanggal_salur || '').trim() || nowTimeStr();
  const nominal = String(req.body?.nominal_bantuan || req.body?.nominal || '').trim();

  w.bukti_salur = fname;
  w.keterangan_salur = keterangan;
  w.tanggal_salur = tglSalur;
  w.status_salur = 'Disalurkan';
  w.catatan = keterangan;
  w.konfirmasi_warga = false;
  if (nominal) {
    w.nominal_bantuan = nominal;
  }

  catatNotifikasi(`Penyaluran bansos sukses: Bukti serah terima dan keterangan penyaluran untuk ${w.nama} (NIK: ${w.nik}) telah disimpan. Status: Disalurkan (Menunggu Konfirmasi Warga).`, 'Petugas', 'penyaluran');

  const formatted = formatWarga(w);
  broadcastRealtimeEvent({
    type: 'WARGA_SALUR_UPDATED',
    warga_id: w.id,
    nik: w.nik,
    status_salur: w.status_salur,
    nominal_bantuan: w.nominal_bantuan,
    keterangan_salur: w.keterangan_salur,
    tanggal_salur: w.tanggal_salur,
    data: formatted
  });

  return res.json({
    status: 'success',
    message: 'Bukti penyaluran dan keterangan berhasil disimpan. Status menjadi Disalurkan.',
    bukti_salur: fname,
    keterangan_salur: keterangan,
    status_salur: w.status_salur,
    nominal_bantuan: w.nominal_bantuan,
    data: formatted
  });
});

router.post(['/:warga_id/lapor-sengketa'], (req: Request, res: Response) => {
  const param = String(req.params.warga_id).trim();
  const w = wargaStore.find(x => String(x.id) === param || x.nik === param);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  const d = req.body || {};
  const aksi = String(d.aksi || 'selesai').trim().toLowerCase();

  if (aksi === 'selesai') {
    w.status_salur = 'Telah Menerima';
    w.konfirmasi_warga = true;
    w.waktu_konfirmasi_warga = nowTimeStr();
    w.catatan = `Sengketa selesai dimediasi pada ${nowTimeStr()}.`;

    const aduan = pengaduanStore.find(a => a.nik === w.nik && a.status !== 'Selesai');
    if (aduan) {
      aduan.status = 'Selesai';
      aduan.status_step = 5;
      aduan.status_text = 'Putusan Akhir & Selesai';
      aduan.catatan_petugas = `Sengketa diselesaikan dan disahkan via Mediasi Kilat.`;
      try { realtimeAduanUpdate(aduan, 'selesai'); } catch (e) {}
    }

    const formatted = formatWarga(w);
    (formatted as any).aduan_aktif = aduan || null;
    broadcastRealtimeEvent({
      type: 'WARGA_SALUR_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      nominal_bantuan: w.nominal_bantuan,
      data: formatted
    });
  } else if (aksi === 'sanggah') {
    w.status_salur = 'Laporan Sengketa (Peninjauan)';
    w.is_verified = false;
    w.status_validasi = 'Menunggu';
    const formatted = formatWarga(w);
    broadcastRealtimeEvent({
      type: 'WARGA_SALUR_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      data: formatted
    });
  } else {
    w.status_salur = 'Laporan Sengketa';
    if (d.catatan) w.catatan = String(d.catatan);
    const formatted = formatWarga(w);
    broadcastRealtimeEvent({
      type: 'WARGA_SALUR_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      data: formatted
    });
  }

  return res.json({
    status: 'success',
    message: 'Status penanganan sengketa berhasil diperbarui.',
    status_salur: w.status_salur
  });
});

router.all(['/:warga_id/verify'], (req: Request, res: Response) => {
  const param = String(req.params.warga_id).trim();
  const w = wargaStore.find(x => String(x.id) === param || x.nik === param);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  w.is_verified = !w.is_verified;
  w.status_validasi = w.is_verified ? 'Disetujui' : 'Menunggu';
  hitungDanSinkronkanSawBwm();
  triggerAutoSyncMysql();
  return res.json({
    status: 'success',
    message: `Status verifikasi ${w.nama} diperbarui.`,
    data: formatWarga(w)
  });
});

router.all(['/:warga_id', '/nik/:warga_id'], (req: Request, res: Response) => {
  if (wargaStore.length === 0) seedInitialWarga();
  const param = String(req.params.warga_id).trim();
  const idx = wargaStore.findIndex(x => String(x.id) === param || x.nik === param);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Warga tidak ditemukan.' });
  const w = wargaStore[idx];

  if (req.method === 'GET') {
    const isAuth = isStaffAuthenticated(req);
    return res.json({ status: 'success', data: isAuth ? formatWarga(w) : formatWargaSafe(w, true) });
  }

  if (req.method === 'DELETE') {
    if (!isStaffAuthenticated(req)) {
      return res.status(401).json({ status: 'error', message: 'Akses ditolak: Hanya petugas berwenang yang dapat menghapus data kependudukan.' });
    }
    wargaStore.splice(idx, 1);
    hitungDanSinkronkanSawBwm();
    triggerAutoSyncMysql();
    catatNotifikasi(`Data kependudukan ${w.nama} (NIK: ${w.nik}) telah dihapus dari sistem.`, 'Admin', 'hapus');
    return res.json({ status: 'success', message: 'Data warga berhasil dihapus.' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!isStaffAuthenticated(req)) {
      return res.status(401).json({ status: 'error', message: 'Akses ditolak: Pembaharuan data warga memerlukan hak akses petugas.' });
    }
    const d = req.body || {};
    const oldVerif = w.is_verified;

    // Simpan kondisi sebelum perubahan ke wargaBaselineStore bila belum ada agar rekap mencatat perbandingan Data Lama vs Data Baru
    const baseIdx = wargaBaselineStore.findIndex(bItem => bItem.nik === w.nik);
    if (baseIdx === -1) {
      wargaBaselineStore.push(JSON.parse(JSON.stringify(w)));
    }

    if (d.nama !== undefined) w.nama = String(d.nama).trim();
    if (d.nik !== undefined) w.nik = String(d.nik).trim();
    if (d.no_hp !== undefined) w.no_hp = String(d.no_hp).trim();
    if (d.email !== undefined) w.email = String(d.email).trim();
    if (d.alamat !== undefined) w.alamat = String(d.alamat).trim();
    if (d.tempat_lahir !== undefined) w.tempat_lahir = String(d.tempat_lahir).trim();
    if (d.tanggal_lahir || d.tglLahir) w.tanggal_lahir = String(d.tanggal_lahir || d.tglLahir).slice(0, 10);
    if (d.lat !== undefined) w.lat = parseFloatSafe(d.lat, w.lat);
    if (d.lng !== undefined) w.lng = parseFloatSafe(d.lng, w.lng);
    if (d.status_mutasi !== undefined) (w as any).status_mutasi = String(d.status_mutasi);
    if (d.kota_tujuan !== undefined) (w as any).kota_tujuan = String(d.kota_tujuan);

    const spkPut = extractSpkCriteria(d, w);
    w.c1 = spkPut.c1;
    w.c2 = spkPut.c2;
    w.c3 = spkPut.c3;
    w.c4 = spkPut.c4;
    w.c5 = spkPut.c5;
    w.c6 = spkPut.c6;
    w.c7 = spkPut.c7;
    w.c8 = spkPut.c8;
    w.c9 = spkPut.c9;
    w.c10 = spkPut.c10;

    if (d.is_verified !== undefined) {
      w.is_verified = Boolean(d.is_verified);
      w.status_validasi = w.is_verified ? 'Disetujui' : 'Menunggu';
    }
    if (d.status_validasi !== undefined) {
      w.status_validasi = String(d.status_validasi);
      if (w.status_validasi === 'Disetujui') w.is_verified = true;
      else if (w.status_validasi === 'Menunggu' || w.status_validasi === 'Ditolak') w.is_verified = false;
    }
    if (d.status_salur !== undefined) {
      w.status_salur = String(d.status_salur);
      if (w.status_salur === 'Telah Menerima' || w.status_salur === 'Sudah Diterima') {
        w.konfirmasi_warga = true;
        if (!w.waktu_konfirmasi_warga) w.waktu_konfirmasi_warga = nowTimeStr();
      } else if (w.status_salur === 'Disalurkan' || w.status_salur === 'Sudah Disalurkan') {
        w.konfirmasi_warga = false;
      }
    }
    if (d.catatan !== undefined) {
      w.catatan = String(d.catatan);
      if (d.keterangan_salur === undefined) w.keterangan_salur = String(d.catatan);
    }
    if (d.keterangan_salur !== undefined) w.keterangan_salur = String(d.keterangan_salur);
    if (d.nominal_bantuan !== undefined) w.nominal_bantuan = String(d.nominal_bantuan);
    if (d.tanggal_salur !== undefined) w.tanggal_salur = String(d.tanggal_salur);

    if (!w.extra_data) w.extra_data = {};
    if (d.extra_data && typeof d.extra_data === 'object') {
      w.extra_data = { ...w.extra_data, ...d.extra_data };
    }
    if (d.custom_fields && typeof d.custom_fields === 'object') {
      w.extra_data = { ...w.extra_data, ...d.custom_fields };
    }
    if (Array.isArray(d.removed_custom_fields)) {
      d.removed_custom_fields.forEach((k: string) => {
        delete (w.extra_data as any)[k];
        delete (w as any)[k];
      });
    }

    const stdFieldKeys = new Set([
      'id', 'nama', 'nik', 'no_hp', 'email', 'alamat', 'tempat_lahir', 'tanggal_lahir', 'tglLahir',
      'lat', 'lng', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
      'c1_ekonomi', 'c2_aset', 'c3_umur', 'c4_jenis_kelamin', 'c5_tanggungan',
      'c6_status_pernikahan', 'c7_kepemilikan_anak', 'c8_tempat_tinggal', 'c9_pendidikan',
      'c10_kesehatan', 'is_verified', 'status_validasi', 'status_salur', 'catatan',
      'nominal_bantuan', 'tanggal_salur', 'extra_data', 'custom_fields', 'removed_custom_fields',
      'desil', 'skor_saw', 'rank_saw', 'status_bansos', 'prioritas', 'bukti_salur'
    ]);
    Object.keys(d).forEach(k => {
      if (!stdFieldKeys.has(k) && !k.startsWith('_') && !isSpkCriterionKey(k)) {
        (w.extra_data as any)[k] = d[k];
        (w as any)[k] = d[k];
      }
    });
    // Bersihkan kunci C1-C10 dari extra_data jika ada
    if (w.extra_data && typeof w.extra_data === 'object') {
      Object.keys(w.extra_data).forEach(k => {
        if (isSpkCriterionKey(k)) {
          delete (w.extra_data as any)[k];
        }
      });
    }

    const rekap = jalankanRekapitulasiPerubahanData(
      wargaBaselineStore,
      wargaStore,
      `Pemutakhiran Data Warga ${w.nama} (NIK: ${w.nik})`
    );
    const rekapItem = rekap.items.find(it => it.nik === w.nik) || null;

    if (d.is_verified !== undefined && oldVerif !== w.is_verified) {
      const st = w.is_verified ? 'Disetujui' : 'Menunggu Verifikasi';
      catatNotifikasi(`Status verifikasi kelayakan ${w.nama} (NIK: ${w.nik}) diubah menjadi ${st}.`, 'Petugas', 'verifikasi');
    } else {
      catatNotifikasi(`Pembaruan data indikator kelayakan kependudukan warga ${w.nama} → Desil ${w.desil}.`, 'Petugas', 'edit');
    }

    const formattedWarga = formatWarga(w);
    broadcastRealtimeEvent({
      type: 'WARGA_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      nominal_bantuan: w.nominal_bantuan,
      data: formattedWarga,
      rekap_ringkasan: rekap.ringkasan
    });
    triggerAutoSyncMysql();

    return res.json({
      status: 'success',
      message: rekapItem?.keterangan_desil_otomatis || 'Data berhasil diperbarui.',
      data: formattedWarga,
      rekap_item: rekapItem,
      rekap_ringkasan: rekap.ringkasan
    });
  }

  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
});

export default router;

// Sinkronkan dan bersihkan data warga saat inisialisasi modul + sinkronkan ke MySQL Localhost
setTimeout(async () => {
  try {
    seedInitialWarga();
    sinkronkanDanBersihkanDataWarga();
    initBaselineDanRekapTriwulan();
    const diskBackup = loadArsipBackupFromDisk();
    if (diskBackup.data.length > 0) {
      setWargaBackupStore(diskBackup.data);
    } else if (wargaBackupStore.length === 0 && wargaStore.length > 0) {
      setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
      saveArsipBackupToDisk(wargaBackupStore);
    }
    await syncAllDataToMysql(
      wargaStore,
      kriteriaStore,
      usersStore,
      pengaduanStore,
      chatStore,
      notifikasiStore,
      wargaBackupStore
    );
    console.log("[WARGA_INIT] Data kriteria SPK, Rekap Triwulanan, Cadangan Arsip & MySQL Localhost berhasil disinkronkan.");
  } catch (e) {}
}, 1000);
