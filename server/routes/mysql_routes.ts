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
  catatNotifikasi,
  formatWarga
} from '../store.js';
import { hitungDanSinkronkanSawBwm } from '../spk_engine.js';
import {
  wargaBaselineStore,
  jalankanRekapitulasiPerubahanData
} from '../rekap_engine.js';
import {
  loadMysqlConfig,
  saveMysqlConfig,
  testMysqlConnection,
  migrateMysqlSchema,
  syncAllDataToMysql,
  loadWargaFromMysql,
  saveArsipBackupToDisk,
  generateMysqlSqlDump,
  generateXamppBridgePhp
} from '../../mysql_storage.js';

const router = Router();

router.get(['/config', '/api/mysql/config'], (_req: Request, res: Response) => {
  const cfg = loadMysqlConfig();
  res.json({
    status: 'success',
    hasPassword: Boolean(cfg.password),
    config: {
      host: cfg.host || 'localhost',
      port: cfg.port || 3306,
      user: cfg.user || 'root',
      password: '',
      database: cfg.database || 'bansos',
      enabled: cfg.enabled !== false,
      auto_sync: cfg.auto_sync !== false,
      last_sync: cfg.last_sync || null
    }
  });
});

router.get(['/status', '/api/mysql/status'], async (_req: Request, res: Response) => {
  const cfg = loadMysqlConfig();
  const safeCfg = { ...cfg, password: '' };
  const testRes = await testMysqlConnection();
  res.json({
    status: 'success',
    connected: Boolean(testRes.connected),
    version: testRes.version || 'MySQL',
    host: testRes.host || cfg.host || 'localhost',
    port: testRes.port || cfg.port || 3306,
    user: testRes.user || cfg.user || 'root',
    database: testRes.database || cfg.database || 'bansos',
    databaseExists: Boolean(testRes.databaseExists),
    mysqlWargaCount: testRes.mysqlWargaCount ?? 0,
    mysqlBackupCount: testRes.mysqlBackupCount ?? 0,
    wargaCountLocal: wargaStore.length,
    backupCountLocal: wargaBackupStore.length,
    last_sync: testRes.last_sync || cfg.last_sync || null,
    message: testRes.message,
    config: safeCfg,
    connection: testRes
  });
});

router.post(['/config', '/api/mysql/config'], async (req: Request, res: Response) => {
  const body = req.body || {};
  const updated = saveMysqlConfig({
    host: body.host !== undefined ? String(body.host).trim() : undefined,
    port: body.port !== undefined ? Number(body.port) : undefined,
    user: body.user !== undefined ? String(body.user).trim() : undefined,
    password: body.password !== undefined ? String(body.password) : undefined,
    database: body.database !== undefined ? String(body.database).trim() : 'bansos',
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
    auto_sync: body.auto_sync !== undefined ? Boolean(body.auto_sync) : true
  });

  // Otomatis uji koneksi, migrasi skema, dan sinkronkan seluruh data aktif ke database MySQL
  const syncRes = await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore.length > 0 ? wargaBackupStore : wargaStore
  );
  const testRes = await testMysqlConnection();

  const safeCfg = { ...updated, password: '' };
  catatNotifikasi(
    syncRes.success
      ? `Konfigurasi MySQL localhost (${updated.database}) disimpan & ${wargaStore.length} data warga berhasil disinkronkan.`
      : 'Konfigurasi koneksi MySQL localhost diperbarui oleh Admin.',
    'Admin',
    'sistem'
  );
  res.json({
    status: 'success',
    connected: Boolean(testRes.connected),
    synced: Boolean(syncRes.success),
    syncedWarga: syncRes.counts?.warga ?? wargaStore.length,
    mysqlWargaCount: testRes.mysqlWargaCount ?? syncRes.counts?.warga ?? 0,
    mysqlBackupCount: testRes.mysqlBackupCount ?? syncRes.counts?.warga_backup ?? 0,
    last_sync: syncRes.last_sync || updated.last_sync || null,
    message: syncRes.success
      ? `Konfigurasi tersimpan & ${syncRes.counts?.warga ?? wargaStore.length} data warga berhasil disinkronkan ke database MySQL '${updated.database}'.`
      : testRes.message || 'Konfigurasi database MySQL localhost berhasil disimpan.',
    config: safeCfg,
    connection: testRes
  });
});

router.post(['/test', '/api/mysql/test'], async (req: Request, res: Response) => {
  const testCfg = req.body || {};
  const result = await testMysqlConnection(testCfg);
  res.json(result);
});

router.post(['/migrate', '/api/mysql/migrate'], async (req: Request, res: Response) => {
  const customCfg = req.body || {};
  const result = await migrateMysqlSchema(customCfg);
  if (result.success) {
    catatNotifikasi('Migrasi skema basis data MySQL localhost berhasil dibuat.', 'Admin', 'sistem');
  }
  res.json(result);
});

router.post(['/export', '/api/mysql/export', '/sync-to-mysql', '/api/mysql/sync-to-mysql'], async (req: Request, res: Response) => {
  // Jika frontend mengirimkan daftar warga terkini pada body, sinkronkan ke wargaStore terlebih dahulu
  if (Array.isArray(req.body?.data) && req.body.data.length > 0 && wargaStore.length === 0) {
    setWargaStore(req.body.data);
    hitungDanSinkronkanSawBwm();
  }
  if (wargaBackupStore.length === 0 && wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
    saveArsipBackupToDisk(wargaBackupStore);
  }

  const result = await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore,
    wargaBackupStore
  );
  if (result.success) {
    catatNotifikasi(`Penyimpanan basis data: ${wargaStore.length} arsip warga & ${wargaBackupStore.length} cadangan disinkronkan ke MySQL localhost.`, 'Admin', 'sistem');
  }
  res.json({
    ...result,
    syncedWarga: result.counts?.warga ?? wargaStore.length,
    syncedBackup: result.counts?.warga_backup ?? wargaBackupStore.length,
    syncedKriteria: result.counts?.kriteria ?? kriteriaStore.length,
    count: result.counts?.warga ?? wargaStore.length
  });
});

router.post(['/import', '/api/mysql/import', '/sync-from-mysql', '/api/mysql/sync-from-mysql'], async (req: Request, res: Response) => {
  const sourceTable = req.body?.source === 'warga_backup' ? 'warga_backup' : 'warga';
  const result = await loadWargaFromMysql(sourceTable);
  if (result.success) {
    setWargaStore(result.data);
    hitungDanSinkronkanSawBwm();
    try {
      jalankanRekapitulasiPerubahanData(
        wargaBaselineStore.length > 0 ? wargaBaselineStore : wargaStore,
        wargaStore,
        `Sinkronisasi Impor Data dari MySQL Localhost (${sourceTable})`
      );
    } catch (_) {}
    catatNotifikasi(`Impor data: ${wargaStore.length} arsip warga dimuat dari MySQL localhost (${sourceTable}).`, 'Admin', 'sistem');
    return res.json({
      status: 'success',
      success: true,
      message: result.message,
      count: wargaStore.length,
      total: wargaStore.length,
      data: wargaStore.map(formatWarga)
    });
  }
  res.json(result);
});

router.get(['/download-sql', '/api/mysql/download-sql'], (_req: Request, res: Response) => {
  const dumpSql = generateMysqlSqlDump(wargaStore, kriteriaStore, usersStore);
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', 'attachment; filename="skema_mysql_bansos_sidoarjo.sql"');
  res.send(dumpSql);
});

router.get(['/bridge-script', '/api/mysql/bridge-script'], (_req: Request, res: Response) => {
  const phpScript = generateXamppBridgePhp();
  res.setHeader('Content-Type', 'application/x-httpd-php');
  res.setHeader('Content-Disposition', 'attachment; filename="bridge_sync.php"');
  res.send(phpScript);
});

export default router;
