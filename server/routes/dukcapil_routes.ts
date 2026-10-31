import { Router, Request, Response } from 'express';
import {
  wargaStore,
  setWargaStore,
  wargaBackupStore,
  setWargaBackupStore,
  kriteriaStore,
  usersStore,
  pengaduanStore,
  chatStore,
  notifikasiStore,
  KECAMATAN_SIDOARJO,
  catatNotifikasi,
  formatWarga,
  formatWargaSafe
} from '../store.js';
import {
  hitungDanSinkronkanSawBwm,
  seedInitialWarga
} from '../spk_engine.js';
import {
  wargaBaselineStore,
  setWargaBaselineStore,
  initBaselineDanRekapTriwulan,
  jalankanRekapitulasiPerubahanData
} from '../rekap_engine.js';
import {
  testMysqlConnection,
  syncAllDataToMysql,
  syncWargaBackupToMysql,
  clearWargaBackupInMysql,
  loadWargaFromMysql,
  saveArsipBackupToDisk,
  loadArsipBackupFromDisk
} from '../../mysql_storage.js';
import {
  historicalSnapshotsStore,
  initHistoricalSnapshots,
  listSnapshots,
  saveNewSnapshot,
  setSnapshotAsMaster,
  deleteSnapshotById,
  mergeAllSnapshotsData,
  loadMaster100Dataset,
  getNamaBulan,
  getHariFromDate,
  getMingguKe,
  ArsipSnapshot
} from '../historical_snapshots.js';
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

// Inisialisasi snapshot historis saat startup
initHistoricalSnapshots();

router.get(['/dukcapil/:nik', '/api/dukcapil/:nik'], (req: Request, res: Response) => {
  seedInitialWarga();
  const cleanNik = String(req.params.nik || '').trim();
  if (!cleanNik || cleanNik.length !== 16 || !/^\d+$/.test(cleanNik)) {
    return res.status(400).json({ status: 'error', message: 'Format NIK wajib 16 digit angka valid.' });
  }

  const w = wargaStore.find(x => String(x.nik).trim() === cleanNik) ||
            wargaBackupStore.find(x => String(x.nik).trim() === cleanNik);
  if (w) {
    const isAuth = isStaffAuthenticated(req);
    const formatted = isAuth ? formatWarga(w) : formatWargaSafe(w, true);
    return res.json({
      status: 'success',
      message: 'Data NIK ditemukan pada arsip data warga.',
      data: {
        ...formatted,
        jenis_kelamin: w.c4 === 2 ? 'Perempuan' : 'Laki-laki'
      }
    });
  }

  return res.status(404).json({
    status: 'error',
    message: 'Data NIK tidak ditemukan didalam arsip data warga.',
    data: null
  });
});

router.all(['/bps/sync', '/api/bps/sync'], (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.',
    data: KECAMATAN_SIDOARJO
  });
});

// ============================================================================
// STATUS ARSIP & PEMANTAU HISTORIS LINTAS WAKTU
// ============================================================================
router.get(['/arsip/status', '/api/arsip/status'], async (_req: Request, res: Response) => {
  const diskBackup = loadArsipBackupFromDisk();
  if (wargaBackupStore.length === 0 && diskBackup.data.length > 0) {
    setWargaBackupStore(diskBackup.data);
  }
  const snapshotInfo = listSnapshots();
  const mysqlRes = await testMysqlConnection();
  const isSyncedWithMysql = mysqlRes.connected && mysqlRes.mysqlWargaCount === wargaStore.length;
  const isBackupSynced = wargaBackupStore.length > 0 && (!mysqlRes.connected || mysqlRes.mysqlBackupCount === wargaBackupStore.length);

  res.json({
    status: 'success',
    warga_aktif_web: wargaStore.length,
    cadangan_server_master: wargaBackupStore.length,
    cadangan_disk_count: diskBackup.data.length,
    cadangan_disk_updated_at: diskBackup.updated_at,
    total_snapshots_historis: snapshotInfo.total_snapshots,
    available_years: snapshotInfo.available_years,
    current_year: snapshotInfo.current_year,
    master_snapshot_label: snapshotInfo.master_snapshot?.label || 'Data Master Standar Resmi',
    master_snapshot_total: snapshotInfo.master_snapshot?.total_warga || 100,
    mysql_connected: mysqlRes.connected,
    mysql_database: mysqlRes.database || 'bansos',
    mysql_warga_count: mysqlRes.mysqlWargaCount ?? 0,
    mysql_backup_count: mysqlRes.mysqlBackupCount ?? 0,
    last_sync: mysqlRes.last_sync || diskBackup.updated_at || null,
    is_fully_synced: Boolean(isSyncedWithMysql && isBackupSynced),
    message: isSyncedWithMysql
      ? `Tersinkronisasi Penuh: ${wargaStore.length} warga di Web = ${mysqlRes.mysqlWargaCount} warga di MySQL (${mysqlRes.database}) & ${snapshotInfo.total_snapshots} snapshot historis.`
      : `Data Web (${wargaStore.length} warga) siap disinkronkan dengan Server Master (${wargaBackupStore.length} cadangan) & MySQL (${mysqlRes.mysqlWargaCount ?? 0} warga).`
  });
});

// ============================================================================
// PENJELAJAH ARSIP HISTORIS LINTAS WAKTU (100 TAHUN KE BELAKANG S/D KE DEPAN)
// ============================================================================
router.get(['/arsip/snapshots', '/api/arsip/snapshots'], (req: Request, res: Response) => {
  const tahun = req.query.tahun ? Number(req.query.tahun) : undefined;
  const bulan = req.query.bulan ? Number(req.query.bulan) : undefined;
  const minggu_ke = req.query.minggu_ke ? Number(req.query.minggu_ke) : undefined;
  const tanggal = req.query.tanggal ? String(req.query.tanggal) : undefined;
  const query = req.query.q ? String(req.query.q) : undefined;
  const kategori = req.query.kategori ? String(req.query.kategori) : undefined;

  const result = listSnapshots({ tahun, bulan, minggu_ke, tanggal, query, kategori });
  res.json({
    status: 'success',
    ...result,
    snapshots: result.snapshots.map(s => ({
      ...s,
      data_warga: s.data_warga.length // Kirimkan count untuk daftar ringan
    }))
  });
});

// Ambil detail data warga dari snapshot tertentu
router.get(['/arsip/snapshots/:snapshot_id', '/api/arsip/snapshots/:snapshot_id'], (req: Request, res: Response) => {
  const sid = String(req.params.snapshot_id).trim();
  const snap = historicalSnapshotsStore.find(s => s.snapshot_id === sid);
  if (!snap) {
    return res.status(404).json({ status: 'error', message: 'Snapshot historis tidak ditemukan.' });
  }
  res.json({
    status: 'success',
    snapshot: snap
  });
});

// Simpan Snapshot Baru (Bisa pilih Tahun, Bulan, Minggu, Hari, Tanggal, Jam)
router.post(['/arsip/snapshots/simpan', '/api/arsip/snapshots/simpan'], async (req: Request, res: Response) => {
  const body = req.body || {};
  let dataToSave = wargaStore;
  if (Array.isArray(body.data) && body.data.length > 0) {
    dataToSave = body.data;
  }

  const newSnap = saveNewSnapshot({
    label: body.label || `Cadangan Arsip (${dataToSave.length} Warga)`,
    data_warga: dataToSave,
    tahun: body.tahun ? Number(body.tahun) : undefined,
    bulan: body.bulan ? Number(body.bulan) : undefined,
    minggu_ke: body.minggu_ke ? Number(body.minggu_ke) : undefined,
    tanggal: body.tanggal ? String(body.tanggal) : undefined,
    hari: body.hari ? String(body.hari) : undefined,
    jam: body.jam ? String(body.jam) : undefined,
    kategori: body.kategori || 'manual',
    catatan: body.catatan || '',
    is_master_standard: Boolean(body.is_master_standard)
  });

  if (body.is_master_standard) {
    setWargaBackupStore(JSON.parse(JSON.stringify(dataToSave)));
    saveArsipBackupToDisk(wargaBackupStore);
  }

  catatNotifikasi(`Snapshot historis disimpan: ${newSnap.label} (${newSnap.total_warga} warga, ${newSnap.hari}, ${newSnap.tanggal}).`, 'Admin', 'backup');

  res.json({
    status: 'success',
    success: true,
    message: `Snapshot '${newSnap.label}' berhasil disimpan (${newSnap.total_warga} warga) pada periode ${newSnap.hari}, ${newSnap.tanggal}!`,
    snapshot: {
      ...newSnap,
      data_warga: newSnap.data_warga.length
    }
  });
});

// Pulihkan Snapshot Tertentu (Bisa timpa atau gabungkan)
router.post(['/arsip/snapshots/pulihkan', '/api/arsip/snapshots/pulihkan'], async (req: Request, res: Response) => {
  const body = req.body || {};
  const sid = String(body.snapshot_id || '').trim();
  const snap = historicalSnapshotsStore.find(s => s.snapshot_id === sid);

  if (!snap) {
    return res.status(404).json({ status: 'error', message: 'Snapshot yang dipilih tidak ditemukan.' });
  }

  const isMerge = Boolean(body.merge);
  let finalData: any[] = [];

  if (isMerge) {
    const map = new Map<string, any>();
    wargaStore.forEach(w => map.set(w.nik, { ...w }));
    (snap.data_warga || []).forEach(w => {
      const nik = String(w.nik || '').trim();
      if (!nik) return;
      if (map.has(nik)) {
        map.set(nik, { ...map.get(nik), ...w });
      } else {
        map.set(nik, { ...w });
      }
    });
    finalData = Array.from(map.values());
  } else {
    finalData = JSON.parse(JSON.stringify(snap.data_warga || []));
  }

  setWargaStore(finalData);
  hitungDanSinkronkanSawBwm();

  // Sinkronkan juga memori cadangan server master dengan data yang baru dipulihkan
  setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  saveArsipBackupToDisk(wargaBackupStore);

  try {
    jalankanRekapitulasiPerubahanData(
      wargaBaselineStore.length > 0 ? wargaBaselineStore : wargaStore,
      wargaStore,
      `Pemulihan Snapshot: ${snap.label}`
    );
  } catch (_) {}

  await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );

  const total = wargaStore.length;
  catatNotifikasi(`Pemulihan snapshot berhasil: ${snap.label} (${total} warga aktif di sistem).`, 'Admin', 'restore');

  res.json({
    status: 'success',
    success: true,
    message: `Data berhasil ${isMerge ? 'digabungkan' : 'dipulihkan'} dari snapshot '${snap.label}' (${total} warga aktif).`,
    total,
    data: wargaStore.map(formatWarga)
  });
});

// Pulihkan Semua Data Serentak (Unified Multi-Period Restore Across All Snapshots)
router.post(['/arsip/snapshots/pulihkan-semua', '/api/arsip/snapshots/pulihkan-semua'], async (_req: Request, res: Response) => {
  const merged = mergeAllSnapshotsData();
  if (merged.combined.length === 0) {
    const master100 = loadMaster100Dataset();
    if (master100.length > 0) {
      setWargaStore(master100);
    }
  } else {
    setWargaStore(merged.combined);
  }

  hitungDanSinkronkanSawBwm();
  setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  saveArsipBackupToDisk(wargaBackupStore);

  try {
    jalankanRekapitulasiPerubahanData(
      wargaBaselineStore.length > 0 ? wargaBaselineStore : wargaStore,
      wargaStore,
      'Pemulihan Serentak Seluruh Snapshot Historis'
    );
  } catch (_) {}

  await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );

  const total = wargaStore.length;
  catatNotifikasi(`Pemulihan serentak: Seluruh data dari ${merged.total_snapshots} snapshot (${total} warga unik) berhasil dipulihkan bersamaan.`, 'Admin', 'restore');

  res.json({
    status: 'success',
    success: true,
    total,
    total_snapshots: merged.total_snapshots,
    message: `Berhasil memulihkan & menyatukan seluruh ${total} data warga dari ${merged.total_snapshots} snapshot historis secara serentak ke Web dan MySQL!`,
    data: wargaStore.map(formatWarga)
  });
});

// Tetapkan Snapshot Terpilih sebagai Data Master Standar Baru
router.post(['/arsip/snapshots/tetapkan-master', '/api/arsip/snapshots/tetapkan-master'], async (req: Request, res: Response) => {
  const sid = String(req.body?.snapshot_id || '').trim();
  const updated = setSnapshotAsMaster(sid);
  if (!updated) {
    return res.status(404).json({ status: 'error', message: 'Snapshot tidak ditemukan.' });
  }

  setWargaBackupStore(JSON.parse(JSON.stringify(updated.data_warga)));
  saveArsipBackupToDisk(wargaBackupStore);
  await syncWargaBackupToMysql(wargaBackupStore, wargaStore);

  catatNotifikasi(`Data Master Standar Resmi ditetapkan: ${updated.label} (${updated.total_warga} warga).`, 'Admin', 'sistem');

  res.json({
    status: 'success',
    success: true,
    message: `Snapshot '${updated.label}' (${updated.total_warga} warga) berhasil dikukuhkan sebagai Data Master Standar Resmi!`,
    snapshot: updated
  });
});

// Hapus Snapshot Tertentu
router.delete(['/arsip/snapshots/:snapshot_id', '/api/arsip/snapshots/:snapshot_id'], (req: Request, res: Response) => {
  const sid = String(req.params.snapshot_id).trim();
  const ok = deleteSnapshotById(sid);
  if (!ok) {
    return res.status(404).json({ status: 'error', message: 'Snapshot tidak ditemukan.' });
  }
  res.json({
    status: 'success',
    success: true,
    message: `Snapshot '${sid}' berhasil dihapus dari arsip historis.`
  });
});

// ============================================================================
// OPERASI SINKRONISASI, CADANGAN MASTER & TEMPLATE CONTOH
// ============================================================================
// Sinkronisasi Penuh 1-Klik: Web ⇄ Server Master Disk ⇄ MySQL (warga & warga_backup)
router.post(['/arsip/sinkron-penuh', '/api/arsip/sinkron-penuh', '/arsip/sync', '/api/arsip/sync'], async (req: Request, res: Response) => {
  if (Array.isArray(req.body?.data) && req.body.data.length > 0) {
    setWargaStore(JSON.parse(JSON.stringify(req.body.data)));
  }
  hitungDanSinkronkanSawBwm();
  setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  saveArsipBackupToDisk(wargaBackupStore);

  // Simpan juga sebagai snapshot harian resmi
  saveNewSnapshot({
    label: `Sinkronisasi Penuh Web & MySQL (${wargaStore.length} Warga)`,
    data_warga: wargaStore,
    kategori: 'manual'
  });

  try {
    jalankanRekapitulasiPerubahanData(
      wargaBaselineStore.length > 0 ? wargaBaselineStore : wargaStore,
      wargaStore,
      'Sinkronisasi Penuh Arsip Data Warga & Database MySQL'
    );
  } catch (_) {}

  const syncRes = await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );

  const total = wargaStore.length;
  catatNotifikasi(
    `Sinkronisasi penuh arsip warga selesai: ${total} warga aktif tersinkronisasi di Web, Server Master, dan MySQL Localhost.`,
    'Admin',
    'backup'
  );

  res.json({
    status: 'success',
    success: true,
    total,
    warga_aktif_web: total,
    cadangan_server_master: wargaBackupStore.length,
    mysql_synced: syncRes.success,
    mysql_warga_count: syncRes.counts?.warga ?? total,
    mysql_backup_count: syncRes.counts?.warga_backup ?? wargaBackupStore.length,
    last_sync: syncRes.last_sync || new Date().toLocaleString('id-ID'),
    message: `Berhasil menyinkronkan penuh ${total} data warga ke Arsip Web, Snapshot Server Master, dan Database MySQL Localhost (bansos.warga & bansos.warga_backup)!`,
    data: wargaStore.map(formatWarga)
  });
});

router.all(['/arsip/cadangkan', '/api/arsip/cadangkan'], async (req: Request, res: Response) => {
  if (req.method === 'POST' && Array.isArray(req.body?.data) && req.body.data.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(req.body.data)));
    if (wargaStore.length === 0) {
      setWargaStore(JSON.parse(JSON.stringify(req.body.data)));
      hitungDanSinkronkanSawBwm();
    }
  } else if (wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  }

  // Simpan juga ke histori snapshot
  const customLabel = req.body?.label || `Cadangan Server Master (${wargaBackupStore.length} Warga)`;
  saveNewSnapshot({
    label: customLabel,
    data_warga: wargaBackupStore,
    is_master_standard: true,
    kategori: 'master_standar'
  });

  const total = wargaBackupStore.length;
  const mysqlSync = await syncWargaBackupToMysql(wargaBackupStore, wargaStore);

  catatNotifikasi(`Pencadangan berhasil: ${total} data kependudukan aktif diamankan ke Server Master, Histori Snapshot & MySQL warga_backup.`, 'Admin', 'backup');
  res.json({
    status: 'success',
    success: true,
    message: mysqlSync.message || `Berhasil mencadangkan ${total} data kependudukan ke Server Master & MySQL.`,
    total,
    backupCount: mysqlSync.backupCount,
    activeCount: mysqlSync.activeCount,
    timestamp: new Date().toISOString(),
    data: wargaBackupStore.map(formatWarga)
  });
});

router.all(['/arsip/pulihkan', '/api/arsip/pulihkan'], async (req: Request, res: Response) => {
  let restoreData: WargaItem[] = [];
  let sourceLabel = 'Snapshot Server Master Aktif';

  // 1. Inisialisasi snapshot historis & pastikan snapshot master aktif termuat
  initHistoricalSnapshots();
  const activeMasterSnap = historicalSnapshotsStore.find(s => s.is_master_standard && Array.isArray(s.data_warga) && s.data_warga.length > 0);
  const master100 = loadMaster100Dataset();

  if (req.method === 'POST' && Array.isArray(req.body?.data) && req.body.data.length > 0) {
    restoreData = req.body.data;
    sourceLabel = 'Berkas Cadangan (.JSON)';
  } else if (activeMasterSnap && Array.isArray(activeMasterSnap.data_warga) && activeMasterSnap.data_warga.length > 0) {
    // 2. Prioritas utama: Pulihkan dari Snapshot Master Aktif resmi (100 Warga) dari Penjelajah Lintas Waktu
    restoreData = JSON.parse(JSON.stringify(activeMasterSnap.data_warga));
    sourceLabel = activeMasterSnap.label || `Server Master Aktif (${restoreData.length} Warga)`;
  } else if (master100.length > 0) {
    // 3. Jika belum ada snapshot aktif, gunakan Data Master Standar Resmi 100 Warga KPM Sidoarjo
    restoreData = JSON.parse(JSON.stringify(master100));
    sourceLabel = 'Data Master Standar Resmi (100 Warga KPM Sidoarjo)';
  } else if (wargaBackupStore.length > 0) {
    // 4. Cadangan memori server master
    restoreData = JSON.parse(JSON.stringify(wargaBackupStore));
    sourceLabel = `Memori Cadangan Server Master (${restoreData.length} Warga)`;
  } else {
    const diskBackup = loadArsipBackupFromDisk();
    if (diskBackup.data.length > 0) {
      restoreData = diskBackup.data;
      sourceLabel = `Berkas Cadangan Master Server (${restoreData.length} Warga)`;
    } else {
      const mysqlBackup = await loadWargaFromMysql('warga_backup');
      if (mysqlBackup.success && mysqlBackup.data.length > 0) {
        restoreData = mysqlBackup.data;
        sourceLabel = `Tabel MySQL (bansos.warga_backup: ${restoreData.length} Warga)`;
      }
    }
  }

  if (restoreData.length > 0) {
    setWargaStore(JSON.parse(JSON.stringify(restoreData)));
    setWargaBackupStore(JSON.parse(JSON.stringify(restoreData)));
    saveArsipBackupToDisk(wargaBackupStore);
    if (activeMasterSnap && activeMasterSnap.data_warga.length !== restoreData.length) {
      activeMasterSnap.data_warga = JSON.parse(JSON.stringify(restoreData));
      activeMasterSnap.total_warga = restoreData.length;
    }
  } else {
    seedInitialWarga(true);
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
    saveArsipBackupToDisk(wargaBackupStore);
    sourceLabel = 'Data Awal Standar Sidoarjo';
  }

  hitungDanSinkronkanSawBwm();
  try {
    jalankanRekapitulasiPerubahanData(
      wargaBaselineStore.length > 0 ? wargaBaselineStore : wargaStore,
      wargaStore,
      `Pemulihan Arsip Data Warga dari ${sourceLabel}`
    );
  } catch (_) {}

  await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );

  const total = wargaStore.length;
  catatNotifikasi(`Pemulihan berhasil: ${total} data kependudukan aktif dikembalikan dari ${sourceLabel} & disinkronkan ke MySQL.`, 'Admin', 'restore');
  res.json({
    status: 'success',
    success: true,
    source: sourceLabel,
    message: `Data arsip (${total} warga) berhasil dipulihkan dari ${sourceLabel} dan disinkronkan ke MySQL Localhost!`,
    total,
    data: wargaStore.map(formatWarga)
  });
});

// Pulihkan Data Master Standar (Default 100 Warga Resmi atau Master Pilihan User)
router.post(['/arsip/reset-master', '/api/arsip/reset-master'], async (_req: Request, res: Response) => {
  // Ambil data master standar dari histori snapshot atau dataset 100 warga
  initHistoricalSnapshots();
  const masterSnap = historicalSnapshotsStore.find(s => s.is_master_standard && s.data_warga.length > 0);
  let masterData: any[] = [];

  if (masterSnap && masterSnap.data_warga.length > 0) {
    masterData = JSON.parse(JSON.stringify(masterSnap.data_warga));
  } else {
    masterData = loadMaster100Dataset();
  }

  if (masterData.length === 0) {
    seedInitialWarga(true);
    masterData = wargaStore;
  }

  setWargaStore(masterData);
  setWargaBackupStore(JSON.parse(JSON.stringify(masterData)));
  saveArsipBackupToDisk(wargaBackupStore);
  hitungDanSinkronkanSawBwm();
  initBaselineDanRekapTriwulan();

  await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );

  const total = wargaStore.length;
  catatNotifikasi(`Pulihkan master standar: ${total} data kependudukan master resmi berhasil dimuat & disinkronkan ke MySQL.`, 'Admin', 'restore');
  res.json({
    status: 'success',
    success: true,
    total,
    message: `Data Master Standar Resmi (${total} warga) berhasil dipulihkan dan disinkronkan ke MySQL Localhost!`,
    data: wargaStore.map(formatWarga)
  });
});

// Muat Contoh Template Bawaan (12 Warga Binaan Demo) - TIDAK MENGHAPUS CADANGAN MASTER 100 WARGA
router.post(['/arsip/template-binaan', '/api/arsip/template-binaan'], async (_req: Request, res: Response) => {
  seedInitialWarga(true);
  hitungDanSinkronkanSawBwm();
  initBaselineDanRekapTriwulan();

  await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore // wargaBackupStore (100 warga) tetap aman!
  );

  const total = wargaStore.length;
  catatNotifikasi(`Template demo dimuat: 12 data warga binaan aktif di web (Snapshot master tetap aman tersimpan).`, 'Admin', 'restore');
  res.json({
    status: 'success',
    success: true,
    total,
    masterBackupRetained: wargaBackupStore.length,
    message: `Contoh data binaan (${total} warga) berhasil dimuat. Data Master Cadangan Anda (${wargaBackupStore.length} warga) tetap aman tersimpan di Server Master.`,
    data: wargaStore.map(formatWarga)
  });
});

router.all(['/arsip/cadangan', '/api/arsip/cadangan', '/arsip/hapus-cadangan', '/api/arsip/hapus-cadangan'], async (_req: Request, res: Response) => {
  const count = wargaBackupStore.length;
  setWargaBackupStore([]);
  await clearWargaBackupInMysql();
  catatNotifikasi(`Pembersihan snapshot: ${count} riwayat cadangan arsip server & tabel MySQL warga_backup berhasil dihapus.`, 'Admin', 'hapus');
  res.json({
    status: 'success',
    success: true,
    message: `Snapshot cadangan arsip server (${count} data) dan tabel MySQL warga_backup berhasil dikosongkan.`,
    total: 0
  });
});

export default router;
