import { Router, Request, Response } from 'express';
import {
  wargaStore,
  setWargaStore,
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
  loadMysqlConfig,
  saveMysqlConfig,
  testMysqlConnection,
  migrateMysqlSchema,
  syncAllDataToMysql,
  loadWargaFromMysql,
  generateMysqlSqlDump,
  generateXamppBridgePhp
} from '../../mysql_storage.js';

const router = Router();

router.get(['/status', '/api/mysql/status'], async (_req: Request, res: Response) => {
  const cfg = loadMysqlConfig();
  const safeCfg = { ...cfg, password: cfg.password ? '******' : '' };
  const testRes = await testMysqlConnection();
  res.json({
    status: 'success',
    config: safeCfg,
    connection: testRes,
    wargaCountLocal: wargaStore.length
  });
});

router.post(['/config', '/api/mysql/config'], (req: Request, res: Response) => {
  const body = req.body || {};
  const updated = saveMysqlConfig({
    host: body.host !== undefined ? String(body.host).trim() : undefined,
    port: body.port !== undefined ? Number(body.port) : undefined,
    user: body.user !== undefined ? String(body.user).trim() : undefined,
    password: body.password !== undefined ? String(body.password) : undefined,
    database: body.database !== undefined ? String(body.database).trim() : undefined,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
    auto_sync: body.auto_sync !== undefined ? Boolean(body.auto_sync) : undefined
  });
  const safeCfg = { ...updated, password: updated.password ? '******' : '' };
  catatNotifikasi('Konfigurasi koneksi MySQL localhost diperbarui oleh Admin.', 'Admin', 'sistem');
  res.json({
    status: 'success',
    message: 'Konfigurasi database MySQL localhost berhasil disimpan.',
    config: safeCfg
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

router.post(['/export', '/api/mysql/export', '/sync-to-mysql', '/api/mysql/sync-to-mysql'], async (_req: Request, res: Response) => {
  const result = await syncAllDataToMysql(
    wargaStore,
    kriteriaStore,
    usersStore,
    pengaduanStore,
    chatStore,
    notifikasiStore
  );
  if (result.success) {
    catatNotifikasi(`Penyimpanan basis data: ${wargaStore.length} arsip warga disinkronkan ke MySQL localhost.`, 'Admin', 'sistem');
  }
  res.json({
    ...result,
    syncedWarga: result.counts?.warga || wargaStore.length,
    count: result.counts?.warga || wargaStore.length
  });
});

router.post(['/import', '/api/mysql/import', '/sync-from-mysql', '/api/mysql/sync-from-mysql'], async (_req: Request, res: Response) => {
  const result = await loadWargaFromMysql();
  if (result.success && result.data.length > 0) {
    setWargaStore(result.data);
    hitungDanSinkronkanSawBwm();
    catatNotifikasi(`Impor data: ${wargaStore.length} arsip warga dimuat dari MySQL localhost.`, 'Admin', 'sistem');
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
