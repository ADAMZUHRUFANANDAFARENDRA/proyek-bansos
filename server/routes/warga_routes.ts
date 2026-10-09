import { Router, Request, Response } from 'express';
import {
  wargaStore,
  setWargaStore,
  wargaBackupStore,
  setWargaBackupStore,
  catatNotifikasi,
  formatWarga,
  nowTimeStr,
  upload
} from '../store.js';
import {
  parseFloatSafe,
  parseIntSafe,
  hitungDanSinkronkanSawBwm,
  seedInitialWarga
} from '../spk_engine.js';
import type { WargaItem } from '../types.js';

const router = Router();

router.get(['/', '/warga', '/api/warga'], (req: Request, res: Response) => {
  seedInitialWarga();
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

  res.json(list.map(formatWarga));
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
  if (wargaStore.some(w => w.nik === nik)) {
    return res.status(400).json({ status: 'error', message: 'NIK tersebut sudah terdaftar.' });
  }

  const nextId = wargaStore.length > 0 ? Math.max(...wargaStore.map(w => w.id)) + 1 : 1;
  const isVerif = Boolean(d.is_verified === true || d.is_verified === 'true' || d.is_verified === '1');

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
    created_at: nowTimeStr()
  };

  wargaStore.push(newWarga);
  hitungDanSinkronkanSawBwm();
  catatNotifikasi(`Pendaftaran baru warga NIK ${nik} (${nama}) berhasil disimpan.`, 'Petugas', 'warga');

  return res.status(201).json({
    status: 'success',
    message: 'Data warga berhasil disimpan!',
    data: formatWarga(newWarga)
  });
});

router.post(['/verify-all', '/bulk/verify'], (_req: Request, res: Response) => {
  wargaStore.forEach(w => {
    w.is_verified = true;
    w.status_validasi = 'Disetujui';
  });
  hitungDanSinkronkanSawBwm();
  catatNotifikasi('Persetujuan massal: Seluruh berkas pendaftaran warga aktif telah disetujui bersamaan.', 'Admin', 'verifikasi');
  res.json({ status: 'success', message: 'Seluruh data warga berhasil disetujui.' });
});

router.post(['/unverify-all', '/bulk/unverify'], (_req: Request, res: Response) => {
  wargaStore.forEach(w => {
    w.is_verified = false;
    w.status_validasi = 'Menunggu';
  });
  hitungDanSinkronkanSawBwm();
  catatNotifikasi('Pembatalan massal: Seluruh verifikasi warga dikembalikan ke status Menunggu.', 'Admin', 'verifikasi');
  res.json({ status: 'success', message: 'Seluruh persetujuan berhasil dibatalkan.' });
});

router.all(['/delete-all'], (_req: Request, res: Response) => {
  if (wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  }
  setWargaStore([]);
  hitungDanSinkronkanSawBwm();
  catatNotifikasi('Seluruh data kependudukan telah berhasil dihapus dari arsip warga.', 'Admin', 'urgent');
  res.json({ status: 'success', message: 'Tabel arsip warga berhasil dikosongkan seluruhnya.' });
});

function resolveField(r: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(r);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanAlias || (cleanAlias.length >= 4 && cleanK.includes(cleanAlias))) {
        const val = r[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function resolveNik(r: Record<string, unknown>): string {
  const direct = resolveField(r, ['nik', 'nomorindukkependudukan', 'noktp', 'ktp', 'nonik', 'noidentitas', 'nik16digit', 'nomorktp', 'no_ktp', 'nomor_nik']);
  if (direct) {
    let clean = String(direct).trim();
    const num = Number(clean);
    if (!isNaN(num) && /e\+/i.test(clean)) {
      clean = BigInt(Math.round(num)).toString();
    }
    const digits = clean.replace(/[^0-9]/g, '');
    if (digits.length >= 8) return digits;
  }
  for (const [k, v] of Object.entries(r)) {
    const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kLow.includes('nik') || kLow.includes('ktp') || kLow.includes('identitas')) {
      const s = String(v || '').trim();
      const num = Number(s);
      if (!isNaN(num) && /e\+/i.test(s)) {
        return BigInt(Math.round(num)).toString();
      }
      const digits = s.replace(/[^0-9]/g, '');
      if (digits.length >= 8) return digits;
    }
  }
  for (const val of Object.values(r)) {
    const s = String(val || '').trim();
    const clean = s.replace(/[^0-9]/g, '');
    if (clean.length === 16) return clean;
  }
  return '';
}

function resolveNama(r: Record<string, unknown>): string {
  const direct = resolveField(r, ['nama', 'namalengkap', 'namawarga', 'namapenduduk', 'namapenerima', 'namakk', 'namakrt', 'nama_lengkap', 'nama_warga', 'nama_penduduk']);
  if (direct) return direct;
  for (const [k, v] of Object.entries(r)) {
    const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kLow.includes('nama') && !kLow.includes('ayah') && !kLow.includes('ibu') && !kLow.includes('petugas')) {
      const s = String(v || '').trim();
      if (s.length >= 2 && !/^\d+$/.test(s)) return s;
    }
  }
  return '';
}

function resolveAlamat(r: Record<string, unknown>): string {
  const direct = resolveField(r, ['alamat', 'alamatlengkap', 'alamatdomisili', 'alamatktp', 'alamat_lengkap', 'alamat_domisili', 'domisili', 'desa', 'kelurahan', 'kecamatan', 'jalan', 'rt_rw']);
  if (direct) return direct;
  for (const [k, v] of Object.entries(r)) {
    const kLow = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kLow.includes('alamat') || kLow.includes('domisili') || kLow.includes('kelurahan') || kLow.includes('desa')) {
      const s = String(v || '').trim();
      if (s.length >= 3) return s;
    }
  }
  return 'Kabupaten Sidoarjo';
}

router.post(['/bulk', '/bulk-import'], (req: Request, res: Response) => {
  const payload = req.body;
  const items: Record<string, unknown>[] = Array.isArray(payload) ? payload : payload?.data || [];
  const overwrite = payload?.overwrite === true;
  let berhasil = 0;
  let diperbarui = 0;

  const standardKeys = new Set([
    'nik', 'nama', 'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'alamat', 
    'no_hp', 'no_wa', 'email', 'lat', 'lng', 'c1', 'c2', 'c3', 'c4', 'c5', 
    'c6', 'c7', 'c8', 'c9', 'c10', 'catatan', 'extra_data', 'status_salur',
    'keterangan_salur', 'bukti_salur', 'tanggal_salur', 'nominal_bantuan'
  ]);

  items.forEach((r, rIdx) => {
    let nik = resolveNik(r);
    const nama = resolveNama(r) || (nik ? `Warga (${nik.slice(-4)})` : '');
    if (!nama && !nik) return;

    if (!nik || nik.length < 8) {
      const randDigits = String(Date.now()).slice(-8) + String(rIdx).padStart(4, '0');
      nik = `3515${randDigits}`;
    }

    const tempatLahir = resolveField(r, ['tempatlahir', 'tmplahir', 'kotalahir', 'tempat']) || 'Sidoarjo';
    const tanggalLahir = resolveField(r, ['tanggallahir', 'tgllahir', 'tgl', 'ttl']) || '1985-05-15';
    const alamat = resolveAlamat(r);
    const noHp = resolveField(r, ['nohp', 'nowa', 'telepon', 'whatsapp', 'phone', 'hp']) || '';
    const email = resolveField(r, ['email', 'surel']) || '';

    const extraData: Record<string, unknown> = {};
    Object.keys(r).forEach(k => {
      const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!standardKeys.has(lower) && !standardKeys.has(k)) {
        extraData[k] = r[k];
      }
    });

    const c1Val = parseFloatSafe(r['C1 Ekonomi'] || r['C1'] || r['c1'] || r['penghasilan'] || r['gaji'], 1500000);
    const c2Val = parseFloatSafe(r['C2 Aset'] || r['C2'] || r['c2'] || r['aset'], 5000000);
    const c3Val = parseIntSafe(r['C3 Umur'] || r['C3'] || r['c3'] || r['umur'] || r['usia'], 45);
    const c4Val = parseIntSafe(r['C4'] || r['c4'], 1);
    const c5Val = parseIntSafe(r['C5'] || r['c5'] || r['tanggungan'], 3);
    const c6Val = parseIntSafe(r['C6'] || r['c6'], 2);
    const c7Val = parseIntSafe(r['C7'] || r['c7'], 2);
    const c8Val = parseIntSafe(r['C8'] || r['c8'], 2);
    const c9Val = parseIntSafe(r['C9'] || r['c9'], 1);
    const c10Val = parseIntSafe(r['C10'] || r['c10'], 1);

    const existingIdx = wargaStore.findIndex(w => w.nik === nik);
    if (existingIdx !== -1) {
      if (overwrite) {
        wargaStore[existingIdx] = {
          ...wargaStore[existingIdx],
          nama,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tanggalLahir.slice(0, 10),
          alamat: alamat,
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
          extra_data: { ...(wargaStore[existingIdx].extra_data || {}), ...extraData },
          ...extraData
        };
        diperbarui++;
      }
      return;
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
      lat: parseFloatSafe(r['Garis Lintang'] || r['lat'], -7.4478),
      lng: parseFloatSafe(r['Garis Bujur'] || r['lng'], 112.7183),
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
      catatan: String(r['Catatan'] || r['catatan'] || 'Impor Arsip'),
      nominal_bantuan: 'Rp 600.000 / Beras 10 Kg',
      created_at: nowTimeStr(),
      extra_data: extraData,
      ...extraData
    };
    wargaStore.push(newWarga);
    berhasil++;
  });

  const isSilentBatch = req.body?.silent === true || req.body?.is_final === false;
  if (!isSilentBatch) {
    hitungDanSinkronkanSawBwm();
    catatNotifikasi(`Impor massal selesai: ${berhasil} warga baru ditambahkan${diperbarui > 0 ? `, ${diperbarui} data diperbarui` : ''}.`, 'Admin', 'import');
  }
  res.json({ 
    status: 'success', 
    message: `Berhasil mengimpor ${berhasil} data warga baru${diperbarui > 0 ? ` dan memperbarui ${diperbarui} data` : ''}.`,
    berhasil,
    diperbarui
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

  w.bukti_salur = fname;
  w.keterangan_salur = keterangan;
  w.tanggal_salur = tglSalur;
  w.status_salur = 'Disalurkan';
  w.konfirmasi_warga = false;
  catatNotifikasi(`Penyaluran bansos sukses: Bukti serah terima dan keterangan penyaluran untuk ${w.nama} (NIK: ${w.nik}) telah disimpan. Status: Disalurkan (Menunggu Konfirmasi Warga).`, 'Petugas', 'penyaluran');

  return res.json({
    status: 'success',
    message: 'Bukti penyaluran dan keterangan berhasil disimpan. Status menjadi Disalurkan.',
    bukti_salur: fname,
    keterangan_salur: keterangan,
    status_salur: w.status_salur
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
    w.catatan = `Sengketa selesai dimediasi pada ${nowTimeStr()}.`;
  } else if (aksi === 'sanggah') {
    w.status_salur = 'Laporan Sengketa (Peninjauan)';
    w.is_verified = false;
    w.status_validasi = 'Menunggu';
  } else {
    w.status_salur = 'Laporan Sengketa';
    if (d.catatan) w.catatan = String(d.catatan);
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
  return res.json({
    status: 'success',
    message: `Status verifikasi ${w.nama} diperbarui.`,
    data: formatWarga(w)
  });
});

router.all(['/:warga_id'], (req: Request, res: Response) => {
  const param = String(req.params.warga_id).trim();
  const idx = wargaStore.findIndex(x => String(x.id) === param || x.nik === param);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Warga tidak ditemukan.' });
  const w = wargaStore[idx];

  if (req.method === 'GET') {
    return res.json({ status: 'success', data: formatWarga(w) });
  }

  if (req.method === 'DELETE') {
    wargaStore.splice(idx, 1);
    hitungDanSinkronkanSawBwm();
    catatNotifikasi(`Data kependudukan ${w.nama} (NIK: ${w.nik}) telah dihapus dari sistem.`, 'Admin', 'hapus');
    return res.json({ status: 'success', message: 'Data warga berhasil dihapus.' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const d = req.body || {};
    const oldVerif = w.is_verified;

    if (d.nama !== undefined) w.nama = String(d.nama).trim();
    if (d.nik !== undefined) w.nik = String(d.nik).trim();
    if (d.no_hp !== undefined) w.no_hp = String(d.no_hp).trim();
    if (d.email !== undefined) w.email = String(d.email).trim();
    if (d.alamat !== undefined) w.alamat = String(d.alamat).trim();
    if (d.tempat_lahir !== undefined) w.tempat_lahir = String(d.tempat_lahir).trim();
    if (d.tanggal_lahir || d.tglLahir) w.tanggal_lahir = String(d.tanggal_lahir || d.tglLahir).slice(0, 10);
    if (d.lat !== undefined) w.lat = parseFloatSafe(d.lat, w.lat);
    if (d.lng !== undefined) w.lng = parseFloatSafe(d.lng, w.lng);

    if (d.c1 !== undefined || d.c1_ekonomi !== undefined) w.c1 = parseFloatSafe(d.c1 ?? d.c1_ekonomi, w.c1);
    if (d.c2 !== undefined || d.c2_aset !== undefined) w.c2 = parseFloatSafe(d.c2 ?? d.c2_aset, w.c2);
    if (d.c3 !== undefined || d.c3_umur !== undefined) w.c3 = parseIntSafe(d.c3 ?? d.c3_umur, w.c3);
    if (d.c4 !== undefined || d.c4_jenis_kelamin !== undefined) w.c4 = parseIntSafe(d.c4 ?? d.c4_jenis_kelamin, w.c4);
    if (d.c5 !== undefined || d.c5_tanggungan !== undefined) w.c5 = parseIntSafe(d.c5 ?? d.c5_tanggungan, w.c5);
    if (d.c6 !== undefined || d.c6_status_pernikahan !== undefined) w.c6 = parseIntSafe(d.c6 ?? d.c6_status_pernikahan, w.c6);
    if (d.c7 !== undefined || d.c7_kepemilikan_anak !== undefined) w.c7 = parseIntSafe(d.c7 ?? d.c7_kepemilikan_anak, w.c7);
    if (d.c8 !== undefined || d.c8_tempat_tinggal !== undefined) w.c8 = parseIntSafe(d.c8 ?? d.c8_tempat_tinggal, w.c8);
    if (d.c9 !== undefined || d.c9_pendidikan !== undefined) w.c9 = parseIntSafe(d.c9 ?? d.c9_pendidikan, w.c9);
    if (d.c10 !== undefined || d.c10_kesehatan !== undefined) w.c10 = parseIntSafe(d.c10 ?? d.c10_kesehatan, w.c10);

    if (d.is_verified !== undefined) {
      w.is_verified = Boolean(d.is_verified);
      w.status_validasi = w.is_verified ? 'Disetujui' : 'Menunggu';
    }
    if (d.status_validasi !== undefined) w.status_validasi = String(d.status_validasi);
    if (d.status_salur !== undefined) w.status_salur = String(d.status_salur);
    if (d.catatan !== undefined) w.catatan = String(d.catatan);
    if (d.nominal_bantuan !== undefined) w.nominal_bantuan = String(d.nominal_bantuan);

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
      if (!stdFieldKeys.has(k) && !k.startsWith('_')) {
        (w.extra_data as any)[k] = d[k];
        (w as any)[k] = d[k];
      }
    });

    hitungDanSinkronkanSawBwm();

    if (d.is_verified !== undefined && oldVerif !== w.is_verified) {
      const st = w.is_verified ? 'Disetujui' : 'Menunggu Verifikasi';
      catatNotifikasi(`Status verifikasi kelayakan ${w.nama} (NIK: ${w.nik}) diubah menjadi ${st}.`, 'Petugas', 'verifikasi');
    } else {
      catatNotifikasi(`Pembaruan data indikator kelayakan kependudukan warga ${w.nama}.`, 'Petugas', 'edit');
    }

    return res.json({
      status: 'success',
      message: 'Data berhasil diperbarui.',
      data: formatWarga(w)
    });
  }

  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
});

export default router;
