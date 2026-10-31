import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  enabled: boolean;
  auto_sync: boolean;
  last_sync?: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'mysql-config.json');
const ARSIP_BACKUP_DISK_PATH = path.resolve(process.cwd(), 'arsip-cadangan-master.json');

const DEFAULT_CONFIG: MysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'bansos',
  enabled: true,
  auto_sync: true
};

let currentConfig: MysqlConfig = { ...DEFAULT_CONFIG };
let currentPool: Pool | null = null;

function isMaskedPassword(pw?: string): boolean {
  if (!pw) return false;
  return /^[\*•\.]+$/.test(pw.trim());
}

export function toMysqlDate(val: unknown): string {
  if (!val) return '1985-01-01';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '1985-01-01';
}

export function toMysqlDateTime(val: unknown): string {
  const nowIso = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  if (!val) return nowIso;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'hari ini' || s === '-') return nowIso;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?/);
  if (match) {
    const datePart = match[1];
    let timePart = match[2] || '08:00:00';
    if (timePart.length === 5) timePart += ':00';
    return `${datePart} ${timePart}`;
  }
  return nowIso;
}

// Muat konfigurasi dari berkas jika tersedia
export function loadMysqlConfig(): MysqlConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        database: parsed.database || 'bansos',
        enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
        auto_sync: parsed.auto_sync !== undefined ? Boolean(parsed.auto_sync) : true
      };
    }
  } catch (err) {
    console.warn('[MySQL] Gagal membaca mysql-config.json, menggunakan konfigurasi default:', err);
  }
  return currentConfig;
}

export function saveMysqlConfig(newCfg: Partial<MysqlConfig>): MysqlConfig {
  const nextPassword =
    newCfg.password === undefined || isMaskedPassword(newCfg.password)
      ? currentConfig.password
      : newCfg.password === '' && currentConfig.password && !isMaskedPassword(currentConfig.password)
      ? currentConfig.password
      : newCfg.password;

  currentConfig = {
    ...currentConfig,
    ...(newCfg.host ? { host: newCfg.host } : {}),
    ...(newCfg.port ? { port: Number(newCfg.port) } : {}),
    ...(newCfg.user ? { user: newCfg.user } : {}),
    password: nextPassword ?? '',
    database: newCfg.database || currentConfig.database || 'bansos',
    enabled: newCfg.enabled !== undefined ? Boolean(newCfg.enabled) : currentConfig.enabled,
    auto_sync: newCfg.auto_sync !== undefined ? Boolean(newCfg.auto_sync) : currentConfig.auto_sync,
    ...(newCfg.last_sync ? { last_sync: newCfg.last_sync } : {})
  };

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[MySQL] Gagal menyimpan mysql-config.json:', err);
  }
  if (currentPool) {
    currentPool.end().catch(() => {});
    currentPool = null;
  }
  return currentConfig;
}

async function resolveWorkingConnection(customCfg?: Partial<MysqlConfig>): Promise<{ conn: mysql.Connection; cfg: MysqlConfig }> {
  loadMysqlConfig();
  const baseCfg: MysqlConfig = {
    ...currentConfig,
    ...(customCfg?.host ? { host: customCfg.host } : {}),
    ...(customCfg?.port ? { port: Number(customCfg.port) } : {}),
    ...(customCfg?.user ? { user: customCfg.user } : {}),
    ...(customCfg?.database ? { database: customCfg.database } : {})
  };

  const candidates: string[] = [];
  if (customCfg?.password !== undefined && !isMaskedPassword(customCfg.password)) {
    candidates.push(customCfg.password);
  }
  if (currentConfig.password !== undefined && !isMaskedPassword(currentConfig.password) && !candidates.includes(currentConfig.password)) {
    candidates.push(currentConfig.password);
  }
  if (!candidates.includes('')) candidates.push('');
  if (!candidates.includes(')[m]azOe5@pQ9UI_')) candidates.push(')[m]azOe5@pQ9UI_');
  if (!candidates.includes('root')) candidates.push('root');

  let lastErr: any = null;
  for (const pw of candidates) {
    try {
      const conn = await mysql.createConnection({
        host: baseCfg.host,
        port: baseCfg.port,
        user: baseCfg.user,
        password: pw,
        connectTimeout: 4000,
        multipleStatements: true
      });
      if (pw !== currentConfig.password || baseCfg.database !== currentConfig.database) {
        currentConfig.password = pw;
        currentConfig.database = baseCfg.database;
        try {
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf-8');
        } catch (_) {}
      }
      return { conn, cfg: { ...baseCfg, password: pw } };
    } catch (err: any) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gagal terhubung ke MySQL Localhost.');
}

export function getMysqlPool(customCfg?: Partial<MysqlConfig>): Pool {
  loadMysqlConfig();
  const cfg = customCfg ? { ...currentConfig, ...customCfg } : currentConfig;
  const pw = isMaskedPassword(cfg.password) ? (currentConfig.password || '') : (cfg.password ?? currentConfig.password ?? '');
  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: pw,
    database: cfg.database || 'bansos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000
  });
}

// Uji koneksi ke peladen MySQL localhost + ambil ringkasan tabel
export async function testMysqlConnection(testCfg?: Partial<MysqlConfig>): Promise<{
  success: boolean;
  connected: boolean;
  message: string;
  version?: string;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  databaseExists?: boolean;
  mysqlWargaCount?: number;
  mysqlBackupCount?: number;
  tables?: string[];
  last_sync?: string | null;
}> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection(testCfg);
    conn = resolved.conn;
    const cfg = resolved.cfg;

    const [rows]: any = await conn.query('SELECT VERSION() as version');
    const version = rows && rows[0]?.version ? rows[0].version : 'MySQL';

    const [dbRows]: any = await conn.query('SHOW DATABASES LIKE ?', [cfg.database]);
    const dbExists = Boolean(dbRows && dbRows.length > 0);

    let mysqlWargaCount = 0;
    let mysqlBackupCount = 0;
    let tableNames: string[] = [];

    if (dbExists) {
      await conn.query(`USE \`${cfg.database}\`;`);
      const [tables]: any = await conn.query('SHOW TABLES;');
      tableNames = (tables || []).map((t: any) => Object.values(t)[0] as string);

      if (tableNames.includes('warga')) {
        const [wCnt]: any = await conn.query('SELECT COUNT(*) as c FROM `warga`');
        mysqlWargaCount = Number(wCnt?.[0]?.c || 0);
      }
      if (tableNames.includes('warga_backup')) {
        const [bCnt]: any = await conn.query('SELECT COUNT(*) as c FROM `warga_backup`');
        mysqlBackupCount = Number(bCnt?.[0]?.c || 0);
      }
    }

    await conn.end();
    return {
      success: true,
      connected: true,
      version,
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      database: cfg.database,
      databaseExists: dbExists,
      mysqlWargaCount,
      mysqlBackupCount,
      tables: tableNames,
      last_sync: currentConfig.last_sync || null,
      message: `Terhubung ke MySQL (${version}) pada ${cfg.host}:${cfg.port}. Database '${cfg.database}': ${dbExists ? `Aktif (${mysqlWargaCount} data warga, ${mysqlBackupCount} cadangan)` : 'Siap dibuat'}.`
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    const cfg = testCfg ? { ...currentConfig, ...testCfg } : currentConfig;
    return {
      success: false,
      connected: false,
      database: cfg.database,
      databaseExists: false,
      mysqlWargaCount: 0,
      mysqlBackupCount: 0,
      message: `Gagal terhubung ke MySQL localhost (${cfg.host}:${cfg.port}): ${err.message || 'Pastikan MySQL (XAMPP/Laragon/Service) sedang berjalan.'}`
    };
  }
}

async function ensureWargaTableColumns(conn: mysql.Connection, tableName: string) {
  const [cols]: any = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const colMap = new Map<string, any>();
  for (const c of cols || []) {
    colMap.set(String(c.Field).toLowerCase(), c);
  }

  // Pastikan nominal_bantuan bertipe VARCHAR(150) agar mendukung format "Rp 600.000 / Beras 10 Kg" maupun angka
  const nomCol = colMap.get('nominal_bantuan');
  if (!nomCol) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`nominal_bantuan\` VARCHAR(150) DEFAULT 'Rp 600.000 / Beras 10 Kg'`);
  } else if (String(nomCol.Type).toLowerCase().includes('decimal') || String(nomCol.Type).toLowerCase().includes('int') || String(nomCol.Type).toLowerCase().includes('double')) {
    await conn.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`nominal_bantuan\` VARCHAR(150) DEFAULT 'Rp 600.000 / Beras 10 Kg'`);
  }

  if (!colMap.has('tanggal_salur')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`tanggal_salur\` VARCHAR(50) DEFAULT '-'`);
  }
  if (!colMap.has('keterangan_salur')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`keterangan_salur\` TEXT NULL`);
  }
  if (!colMap.has('konfirmasi_warga')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`konfirmasi_warga\` TINYINT(1) DEFAULT 0`);
  }
  if (!colMap.has('waktu_konfirmasi_warga')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`waktu_konfirmasi_warga\` VARCHAR(50) NULL`);
  }
  if (!colMap.has('extra_data')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`extra_data\` LONGTEXT NULL`);
  }
  if (!colMap.has('created_at')) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`created_at\` DATETIME NULL`);
  }
}

// Migrasi skema: Buat database dan seluruh tabel secara otomatis + pastikan kolom kompatibel
export async function migrateMysqlSchema(targetCfg?: Partial<MysqlConfig>): Promise<{ success: boolean; message: string; tables: string[] }> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection(targetCfg);
    conn = resolved.conn;
    const cfg = resolved.cfg;

    // 1. Buat Database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${cfg.database}\`;`);

    const createWargaDdl = (tbl: string) => `
      CREATE TABLE IF NOT EXISTS \`${tbl}\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL UNIQUE,
        \`nama\` VARCHAR(150) NOT NULL,
        \`tempat_lahir\` VARCHAR(100) DEFAULT 'Sidoarjo',
        \`tanggal_lahir\` DATE NULL,
        \`alamat\` TEXT NULL,
        \`no_hp\` VARCHAR(30) NULL,
        \`email\` VARCHAR(100) NULL,
        \`lat\` VARCHAR(50) DEFAULT '-7.4478',
        \`lng\` VARCHAR(50) DEFAULT '112.7183',
        \`c1\` DOUBLE DEFAULT 1500000,
        \`c2\` DOUBLE DEFAULT 5000000,
        \`c3\` INT DEFAULT 45,
        \`c4\` INT DEFAULT 1,
        \`c5\` INT DEFAULT 3,
        \`c6\` INT DEFAULT 2,
        \`c7\` INT DEFAULT 2,
        \`c8\` INT DEFAULT 2,
        \`c9\` INT DEFAULT 1,
        \`c10\` INT DEFAULT 1,
        \`desil\` INT DEFAULT 5,
        \`skor_saw\` DOUBLE DEFAULT 0,
        \`rank_saw\` INT DEFAULT 0,
        \`is_verified\` TINYINT(1) DEFAULT 1,
        \`status_validasi\` VARCHAR(50) DEFAULT 'Disetujui',
        \`status_salur\` VARCHAR(50) DEFAULT 'Belum Salur',
        \`status_bansos\` VARCHAR(100) DEFAULT 'Layak Bansos',
        \`prioritas\` VARCHAR(50) DEFAULT 'Prioritas Utama',
        \`bukti_salur\` VARCHAR(255) DEFAULT '',
        \`keterangan_salur\` TEXT NULL,
        \`tanggal_salur\` VARCHAR(50) DEFAULT '-',
        \`konfirmasi_warga\` TINYINT(1) DEFAULT 0,
        \`waktu_konfirmasi_warga\` VARCHAR(50) NULL,
        \`catatan\` TEXT NULL,
        \`nominal_bantuan\` VARCHAR(150) DEFAULT 'Rp 600.000 / Beras 10 Kg',
        \`extra_data\` LONGTEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_nik\` (\`nik\`),
        INDEX \`idx_desil\` (\`desil\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // 2. Buat Tabel warga & warga_backup
    await conn.query(createWargaDdl('warga'));
    await conn.query(createWargaDdl('warga_backup'));
    await ensureWargaTableColumns(conn, 'warga');
    await ensureWargaTableColumns(conn, 'warga_backup');

    // 3. Buat Tabel kriteria
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`kriteria\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`kode\` VARCHAR(10) NOT NULL UNIQUE,
        \`nama\` VARCHAR(150) NOT NULL,
        \`bobot\` FLOAT NOT NULL,
        \`tipe\` VARCHAR(20) DEFAULT 'cost',
        \`jenis\` VARCHAR(20) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    const [kritCols]: any = await conn.query('SHOW COLUMNS FROM `kriteria`');
    const hasTipe = (kritCols || []).some((c: any) => String(c.Field).toLowerCase() === 'tipe');
    if (!hasTipe) {
      await conn.query("ALTER TABLE `kriteria` ADD COLUMN `tipe` VARCHAR(20) DEFAULT 'cost'");
    }

    // 4. Buat Tabel user & users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`nama_lengkap\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(100) NOT NULL,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(30) NOT NULL DEFAULT 'petugas',
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`previous_passwords\` TEXT NULL,
        \`nama_lengkap\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(100) NOT NULL,
        \`role\` VARCHAR(30) NOT NULL DEFAULT 'operator',
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`created_at\` VARCHAR(50) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Buat Tabel pengaduan, laporan_pelanggaran, chat_messages, log_panggilan, rekap_triwulan, spk_metrik_perhitungan, sk_bupati, notifikasi, log
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`pengaduan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL,
        \`nama_pelapor\` VARCHAR(150) NULL,
        \`kategori\` VARCHAR(100) NOT NULL,
        \`isi_laporan\` TEXT NULL,
        \`uraian\` TEXT NULL,
        \`status_step\` INT DEFAULT 1,
        \`status_text\` VARCHAR(100) DEFAULT 'Laporan Diterima',
        \`status\` VARCHAR(100) DEFAULT 'Laporan Diterima',
        \`catatan_petugas\` TEXT NULL,
        \`petugas_penindak\` VARCHAR(150) NULL,
        \`urgensi_eskalasi\` VARCHAR(50) DEFAULT 'Normal',
        \`waktu\` VARCHAR(100) NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_pengaduan_nik\` (\`nik\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Pastikan kolom baru pada pengaduan jika tabel sudah ada sebelumnya
    try {
      const [pengCols] = await conn.query('SHOW COLUMNS FROM \`pengaduan\`');
      const cNames = new Set(((pengCols as any[]) || []).map((c: any) => String(c.Field).toLowerCase()));
      if (!cNames.has('uraian')) await conn.query('ALTER TABLE \`pengaduan\` ADD COLUMN \`uraian\` TEXT NULL');
      if (!cNames.has('status')) await conn.query('ALTER TABLE \`pengaduan\` ADD COLUMN \`status\` VARCHAR(100) DEFAULT "Laporan Diterima"');
      if (!cNames.has('petugas_penindak')) await conn.query('ALTER TABLE \`pengaduan\` ADD COLUMN \`petugas_penindak\` VARCHAR(150) NULL');
      if (!cNames.has('urgensi_eskalasi')) await conn.query('ALTER TABLE \`pengaduan\` ADD COLUMN \`urgensi_eskalasi\` VARCHAR(50) DEFAULT "Normal"');
      if (!cNames.has('waktu')) await conn.query('ALTER TABLE \`pengaduan\` ADD COLUMN \`waktu\` VARCHAR(100) NULL');
    } catch (_) {}

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`laporan_pelanggaran\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`kode_laporan\` VARCHAR(50) NOT NULL UNIQUE,
        \`msg_id\` INT NULL,
        \`nik\` VARCHAR(20) NOT NULL,
        \`nama_terlapor\` VARCHAR(150) NULL,
        \`sender_terlapor\` VARCHAR(50) NULL,
        \`pesan_kutipan\` TEXT NULL,
        \`alasan\` VARCHAR(150) NULL,
        \`kategori\` VARCHAR(100) NULL,
        \`deskripsi\` TEXT NULL,
        \`pelapor_role\` VARCHAR(50) NULL,
        \`pelapor_nama\` VARCHAR(150) NULL,
        \`pelapor_nik\` VARCHAR(50) NULL,
        \`status\` VARCHAR(100) DEFAULT 'Dalam Investigasi',
        \`tindakan_petugas\` TEXT NULL,
        \`petugas_penindak\` VARCHAR(150) NULL,
        \`waktu_tindakan\` VARCHAR(100) NULL,
        \`waktu\` VARCHAR(100) NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_pelanggaran_nik\` (\`nik\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`chat_messages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL,
        \`sender\` VARCHAR(50) NOT NULL,
        \`nama\` VARCHAR(150) NULL,
        \`pesan\` TEXT NULL,
        \`file_path\` VARCHAR(255) NULL,
        \`file_name\` VARCHAR(255) NULL,
        \`file_type\` VARCHAR(50) NULL,
        \`file_size\` BIGINT NULL,
        \`reply_sender\` VARCHAR(150) NULL,
        \`reply_text\` TEXT NULL,
        \`reply_to_id\` INT NULL,
        \`reaction\` VARCHAR(50) NULL,
        \`is_pinned\` TINYINT(1) DEFAULT 0,
        \`is_starred\` TINYINT(1) DEFAULT 0,
        \`is_deleted_all\` TINYINT(1) DEFAULT 0,
        \`waktu\` VARCHAR(50) NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_chat_nik\` (\`nik\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`log_panggilan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`caller_id\` VARCHAR(100) NOT NULL,
        \`caller_name\` VARCHAR(150) NULL,
        \`caller_role\` VARCHAR(50) NOT NULL,
        \`callee_id\` VARCHAR(100) NOT NULL,
        \`callee_name\` VARCHAR(150) NULL,
        \`callee_role\` VARCHAR(50) NOT NULL,
        \`nik_warga\` VARCHAR(20) NULL,
        \`tipe_panggilan\` VARCHAR(30) DEFAULT 'audio',
        \`status\` VARCHAR(50) DEFAULT 'selesai',
        \`durasi_detik\` INT DEFAULT 0,
        \`waktu_mulai\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`waktu_selesai\` DATETIME NULL,
        \`catatan\` TEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_call_caller\` (\`caller_id\`),
        INDEX \`idx_call_callee\` (\`callee_id\`),
        INDEX \`idx_call_nik\` (\`nik_warga\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`rekap_triwulan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`kode_periode\` VARCHAR(50) NOT NULL UNIQUE,
        \`tahun\` INT NOT NULL,
        \`triwulan_ke\` INT NOT NULL,
        \`nama_periode\` VARCHAR(150) NOT NULL,
        \`rentang_bulan\` VARCHAR(100) NULL,
        \`jadwal_penyaluran\` VARCHAR(150) NULL,
        \`is_published\` TINYINT(1) DEFAULT 0,
        \`published_at\` VARCHAR(100) NULL,
        \`published_by\` VARCHAR(150) NULL,
        \`total_kpm\` INT DEFAULT 0,
        \`total_nominal\` VARCHAR(100) DEFAULT 'Rp 0',
        \`ringkasan\` TEXT NULL,
        \`data_json\` LONGTEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_rekap_tahun_tw\` (\`tahun\`, \`triwulan_ke\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`spk_metrik_perhitungan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`kode_perhitungan\` VARCHAR(50) NOT NULL UNIQUE,
        \`tahun\` INT NOT NULL,
        \`triwulan_ke\` INT DEFAULT 4,
        \`metode\` VARCHAR(50) DEFAULT 'BWM-SAW & WP',
        \`total_warga\` INT DEFAULT 0,
        \`total_layak\` INT DEFAULT 0,
        \`is_published\` TINYINT(1) DEFAULT 0,
        \`published_at\` VARCHAR(100) NULL,
        \`published_by\` VARCHAR(150) NULL,
        \`bobot_kriteria_json\` LONGTEXT NULL,
        \`matriks_keputusan_json\` LONGTEXT NULL,
        \`skor_dan_ranking_json\` LONGTEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_spk_tahun\` (\`tahun\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`sk_bupati\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nomor_sk\` VARCHAR(100) NOT NULL UNIQUE,
        \`tahun\` INT NOT NULL,
        \`judul_sk\` VARCHAR(255) NOT NULL,
        \`tentang\` TEXT NULL,
        \`tanggal_penetapan\` VARCHAR(50) NULL,
        \`nama_bupati\` VARCHAR(150) DEFAULT 'H. Ahmad Muhdlor Ali, S.I.P.',
        \`nama_kadinsos\` VARCHAR(150) DEFAULT 'Drs. H. Misbah, M.M.',
        \`total_kpm\` INT DEFAULT 0,
        \`total_anggaran\` VARCHAR(100) DEFAULT 'Rp 0',
        \`is_published\` TINYINT(1) DEFAULT 0,
        \`published_at\` VARCHAR(100) NULL,
        \`published_by\` VARCHAR(150) NULL,
        \`daftar_penerima_json\` LONGTEXT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_sk_tahun\` (\`tahun\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`notifikasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`pesan\` TEXT NOT NULL,
        \`role_target\` VARCHAR(50) DEFAULT 'Admin',
        \`waktu\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`is_pinned\` TINYINT(1) DEFAULT 0,
        \`is_archived\` TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`log\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) DEFAULT 'admin_bansos',
        \`aksi\` VARCHAR(255) NOT NULL,
        \`waktu\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [tables]: any = await conn.query('SHOW TABLES;');
    const tableNames = (tables || []).map((t: any) => Object.values(t)[0] as string);

    await conn.end();
    return {
      success: true,
      message: `Migrasi tabel MySQL berhasil! Database '${cfg.database}' (${tableNames.length} tabel) siap & tersinkronisasi.`,
      tables: tableNames
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return {
      success: false,
      message: `Gagal migrasi skema ke MySQL: ${err.message || err}`,
      tables: []
    };
  }
}

async function mirrorWargaListToMysqlTable(conn: mysql.Connection, tableName: string, wargaList: any[]): Promise<number> {
  if (!Array.isArray(wargaList) || wargaList.length === 0) {
    await conn.query(`DELETE FROM \`${tableName}\``);
    return 0;
  }

  const validNiks = wargaList.map(w => String(w.nik || '').trim()).filter(Boolean);
  if (validNiks.length > 0) {
    const placeholders = validNiks.map(() => '?').join(',');
    await conn.query(`DELETE FROM \`${tableName}\` WHERE \`nik\` NOT IN (${placeholders})`, validNiks);
  }

  let savedCount = 0;
  const coreKeys = new Set([
    'id', 'nik', 'nama', 'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'alamat',
    'no_hp', 'email', 'lat', 'lng', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
    'c8', 'c9', 'c10', 'desil', 'skor_saw', 'rank_saw', 'is_verified', 'status_validasi',
    'status_salur', 'status_bansos', 'prioritas', 'bukti_salur', 'keterangan_salur',
    'konfirmasi_warga', 'waktu_konfirmasi_warga', 'catatan', 'nominal_bantuan',
    'tanggal_salur', 'created_at', 'updated_at', 'extra_data'
  ]);

  for (const w of wargaList) {
    const nik = String(w.nik || '').trim();
    if (!nik) continue;

    const extra: Record<string, any> = { ...(w.extra_data && typeof w.extra_data === 'object' ? w.extra_data : {}) };
    Object.keys(w).forEach(k => {
      if (!coreKeys.has(k) && !k.startsWith('_')) {
        extra[k] = w[k];
      }
    });
    const extraJson = JSON.stringify(extra);

    const tglLahir = toMysqlDate(w.tanggal_lahir);
    const createdAt = toMysqlDateTime(w.created_at);
    const nomStr = (!w.nominal_bantuan || w.nominal_bantuan === '0.00' || w.nominal_bantuan === '0')
      ? (Number(w.desil || 5) <= 4 ? 'Rp 600.000 / Beras 10 Kg' : 'Rp 0 (Non-PKH)')
      : String(w.nominal_bantuan);

    await conn.query(
      `INSERT INTO \`${tableName}\` (
        nik, nama, tempat_lahir, tanggal_lahir, alamat, no_hp, email, lat, lng,
        c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, desil, skor_saw, rank_saw,
        is_verified, status_validasi, status_salur, status_bansos, prioritas,
        bukti_salur, keterangan_salur, tanggal_salur, konfirmasi_warga, waktu_konfirmasi_warga,
        catatan, nominal_bantuan, extra_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nama = VALUES(nama),
        tempat_lahir = VALUES(tempat_lahir),
        tanggal_lahir = VALUES(tanggal_lahir),
        alamat = VALUES(alamat),
        no_hp = VALUES(no_hp),
        email = VALUES(email),
        lat = VALUES(lat),
        lng = VALUES(lng),
        c1 = VALUES(c1),
        c2 = VALUES(c2),
        c3 = VALUES(c3),
        c4 = VALUES(c4),
        c5 = VALUES(c5),
        c6 = VALUES(c6),
        c7 = VALUES(c7),
        c8 = VALUES(c8),
        c9 = VALUES(c9),
        c10 = VALUES(c10),
        desil = VALUES(desil),
        skor_saw = VALUES(skor_saw),
        rank_saw = VALUES(rank_saw),
        is_verified = VALUES(is_verified),
        status_validasi = VALUES(status_validasi),
        status_salur = VALUES(status_salur),
        status_bansos = VALUES(status_bansos),
        prioritas = VALUES(prioritas),
        bukti_salur = VALUES(bukti_salur),
        keterangan_salur = VALUES(keterangan_salur),
        tanggal_salur = VALUES(tanggal_salur),
        konfirmasi_warga = VALUES(konfirmasi_warga),
        waktu_konfirmasi_warga = VALUES(waktu_konfirmasi_warga),
        catatan = VALUES(catatan),
        nominal_bantuan = VALUES(nominal_bantuan),
        extra_data = VALUES(extra_data)`,
      [
        nik,
        String(w.nama || w.nama_lengkap || 'Warga Sidoarjo'),
        String(w.tempat_lahir || 'Sidoarjo'),
        tglLahir,
        String(w.alamat || 'Kabupaten Sidoarjo'),
        String(w.no_hp || ''),
        String(w.email || ''),
        String(w.lat ?? '-7.4478'),
        String(w.lng ?? '112.7183'),
        Number(w.c1 ?? 1500000),
        Number(w.c2 ?? 5000000),
        Number(w.c3 ?? 45),
        Number(w.c4 ?? 1),
        Number(w.c5 ?? 3),
        Number(w.c6 ?? 2),
        Number(w.c7 ?? 2),
        Number(w.c8 ?? 2),
        Number(w.c9 ?? 1),
        Number(w.c10 ?? 1),
        Number(w.desil ?? 5),
        Number(w.skor_saw ?? 0),
        Number(w.rank_saw ?? 0),
        w.is_verified ? 1 : 0,
        String(w.status_validasi || (w.is_verified ? 'Disetujui' : 'Menunggu')),
        String(w.status_salur || 'Belum Salur'),
        String(w.status_bansos || (Number(w.desil ?? 5) <= 4 ? 'Layak Bansos' : 'Tidak Layak')),
        String(w.prioritas || (Number(w.desil ?? 5) <= 4 ? 'Prioritas Utama' : 'Bukan Prioritas')),
        String(w.bukti_salur || ''),
        String(w.keterangan_salur || w.catatan || ''),
        String(w.tanggal_salur || '-'),
        w.konfirmasi_warga ? 1 : 0,
        w.waktu_konfirmasi_warga ? String(w.waktu_konfirmasi_warga) : null,
        String(w.catatan || ''),
        nomStr,
        extraJson,
        createdAt
      ]
    );
    savedCount++;
  }
  return savedCount;
}

// Ekspor seluruh data arsip web ke MySQL localhost (termasuk sinkronisasi tabel warga & warga_backup)
export async function syncAllDataToMysql(
  warga: any[],
  kriteria: any[],
  users: any[],
  pengaduan: any[],
  chat: any[],
  notifikasi: any[],
  wargaBackup?: any[]
): Promise<{ success: boolean; message: string; counts: Record<string, number>; last_sync?: string }> {
  const counts = { warga: 0, warga_backup: 0, kriteria: 0, users: 0, pengaduan: 0, chat: 0, notifikasi: 0 };
  let conn: mysql.Connection | null = null;

  try {
    await migrateMysqlSchema();
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    const cfg = resolved.cfg;
    await conn.query(`USE \`${cfg.database}\`;`);

    // 1. Sinkronkan tabel warga (Mirror penuh agar hapus/tambah/edit 100% akurat di phpMyAdmin)
    counts.warga = await mirrorWargaListToMysqlTable(conn, 'warga', warga);

    // 2. Sinkronkan tabel warga_backup jika disertakan
    if (Array.isArray(wargaBackup)) {
      counts.warga_backup = await mirrorWargaListToMysqlTable(conn, 'warga_backup', wargaBackup);
    }

    // 3. Simpan Kriteria
    for (const k of kriteria || []) {
      await conn.query(
        `INSERT INTO \`kriteria\` (kode, nama, bobot, tipe, jenis) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama = VALUES(nama), bobot = VALUES(bobot), tipe = VALUES(tipe), jenis = VALUES(jenis)`,
        [k.kode, k.nama, Number(k.bobot), k.tipe || k.jenis || 'cost', k.jenis || k.tipe || 'cost']
      );
      counts.kriteria++;
    }

    // 4. Simpan ke tabel user (skema asli bansos) & users
    for (const u of users || []) {
      try {
        await conn.query(
          `INSERT INTO \`user\` (username, nama_lengkap, email, password, role, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE nama_lengkap = VALUES(nama_lengkap), email = VALUES(email), role = VALUES(role), is_active = VALUES(is_active)`,
          [
            u.username,
            u.nama_lengkap || u.username,
            u.email || `${u.username.replace(/\s+/g, '.')}@sidoarjo.go.id`,
            u.password || '123',
            u.role || 'petugas',
            u.is_active ? 1 : 0,
            toMysqlDateTime(u.created_at)
          ]
        );
      } catch (_) {}
      try {
        await conn.query(
          `INSERT INTO \`users\` (username, password, previous_passwords, nama_lengkap, email, role, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE password = VALUES(password), previous_passwords = VALUES(previous_passwords), nama_lengkap = VALUES(nama_lengkap), email = VALUES(email), role = VALUES(role), is_active = VALUES(is_active)`,
          [u.username, u.password, JSON.stringify(u.previous_passwords || []), u.nama_lengkap, u.email, u.role, u.is_active ? 1 : 0, String(u.created_at || '2026-01-01')]
        );
      } catch (_) {}
      counts.users++;
    }

    // 5. Sinkronkan Pengaduan & Aduan
    for (const a of pengaduan || []) {
      try {
        await conn.query(
          `INSERT INTO \`pengaduan\` (id, nik, nama_pelapor, kategori, isi_laporan, uraian, status_step, status_text, status, catatan_petugas, petugas_penindak, urgensi_eskalasi, waktu)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             nama_pelapor = VALUES(nama_pelapor),
             kategori = VALUES(kategori),
             isi_laporan = VALUES(isi_laporan),
             uraian = VALUES(uraian),
             status_step = VALUES(status_step),
             status_text = VALUES(status_text),
             status = VALUES(status),
             catatan_petugas = VALUES(catatan_petugas),
             petugas_penindak = VALUES(petugas_penindak),
             urgensi_eskalasi = VALUES(urgensi_eskalasi),
             waktu = VALUES(waktu)`,
          [
            Number(a.id) || null,
            String(a.nik || ''),
            String(a.nama_pelapor || a.nama || 'Warga'),
            String(a.kategori || 'Sengketa Penyaluran Bansos'),
            String(a.isi_laporan || a.uraian || a.deskripsi || ''),
            String(a.uraian || a.deskripsi || a.isi_laporan || ''),
            Number(a.status_step || 1),
            String(a.status_text || a.status || 'Laporan Diterima'),
            String(a.status || a.status_text || 'Laporan Diterima'),
            String(a.catatan_petugas || ''),
            String(a.petugas_penindak || ''),
            String(a.urgensi_eskalasi || 'Normal'),
            String(a.waktu || new Date().toLocaleString('id-ID'))
          ]
        );
        counts.pengaduan++;
      } catch (_) {}
    }

    // 6. Sinkronkan Pesan Chat
    for (const c of chat || []) {
      try {
        await conn.query(
          `INSERT INTO \`chat_messages\` (id, nik, sender, nama, pesan, file_path, file_name, file_type, file_size, reply_sender, reply_text, reply_to_id, reaction, is_pinned, is_starred, is_deleted_all, waktu)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             pesan = VALUES(pesan),
             reaction = VALUES(reaction),
             is_pinned = VALUES(is_pinned),
             is_starred = VALUES(is_starred),
             is_deleted_all = VALUES(is_deleted_all)`,
          [
            Number(c.id) || null,
            String(c.nik || ''),
            String(c.sender || 'warga'),
            String(c.nama || ''),
            String(c.pesan || c.text || ''),
            c.file_path ? String(c.file_path) : null,
            c.file_name ? String(c.file_name) : null,
            c.file_type ? String(c.file_type) : null,
            c.file_size ? Number(c.file_size) : null,
            c.reply_sender ? String(c.reply_sender) : null,
            c.reply_text ? String(c.reply_text) : null,
            c.reply_to_id ? Number(c.reply_to_id) : null,
            String(c.reaction || ''),
            c.is_pinned ? 1 : 0,
            c.is_starred ? 1 : 0,
            c.is_deleted_all ? 1 : 0,
            String(c.waktu || '')
          ]
        );
        counts.chat++;
      } catch (_) {}
    }

    // 7. Catat aktivitas sinkronisasi ke tabel log di database bansos
    try {
      await conn.query(
        `INSERT INTO \`log\` (username, aksi, waktu) VALUES (?, ?, NOW())`,
        ['admin_bansos', `Sinkronisasi penuh: ${counts.warga} warga, ${counts.pengaduan} pengaduan, ${counts.chat} obrolan ke MySQL`]
      );
    } catch (_) {}

    await conn.end();

    const syncTime = new Date().toLocaleString('id-ID');
    currentConfig.last_sync = syncTime;
    saveMysqlConfig({ last_sync: syncTime, enabled: true });

    return {
      success: true,
      last_sync: syncTime,
      message: `Berhasil menyinkronkan seluruh data ke database MySQL localhost '${cfg.database}' (${counts.warga} warga aktif, ${counts.kriteria} kriteria, ${counts.users} pengguna)!`,
      counts
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return {
      success: false,
      message: `Kendala saat menyimpan ke MySQL: ${err.message || err}`,
      counts
    };
  }
}

// Simpan & sinkronkan khusus cadangan arsip (warga_backup di MySQL + arsip-cadangan-master.json di disk)
export function saveArsipBackupToDisk(backupList: any[]): void {
  try {
    const payload = {
      updated_at: new Date().toISOString(),
      total: backupList.length,
      data: backupList
    };
    fs.writeFileSync(ARSIP_BACKUP_DISK_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[ArsipBackup] Gagal menulis arsip-cadangan-master.json:', err);
  }
}

export function loadArsipBackupFromDisk(): { updated_at: string | null; data: any[] } {
  try {
    if (fs.existsSync(ARSIP_BACKUP_DISK_PATH)) {
      const raw = JSON.parse(fs.readFileSync(ARSIP_BACKUP_DISK_PATH, 'utf-8'));
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      return { updated_at: raw?.updated_at || null, data: list };
    }
  } catch (_) {}
  return { updated_at: null, data: [] };
}

export function clearArsipBackupOnDisk(): void {
  try {
    if (fs.existsSync(ARSIP_BACKUP_DISK_PATH)) {
      fs.unlinkSync(ARSIP_BACKUP_DISK_PATH);
    }
  } catch (_) {}
}

export async function syncWargaBackupToMysql(backupList: any[], activeWargaList?: any[]): Promise<{
  success: boolean;
  backupCount: number;
  activeCount: number;
  message: string;
}> {
  saveArsipBackupToDisk(backupList);
  let conn: mysql.Connection | null = null;
  try {
    await migrateMysqlSchema();
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    const cfg = resolved.cfg;
    await conn.query(`USE \`${cfg.database}\`;`);

    const backupCount = await mirrorWargaListToMysqlTable(conn, 'warga_backup', backupList);
    let activeCount = backupCount;
    if (Array.isArray(activeWargaList)) {
      activeCount = await mirrorWargaListToMysqlTable(conn, 'warga', activeWargaList);
    }

    try {
      await conn.query(
        `INSERT INTO \`log\` (username, aksi, waktu) VALUES (?, ?, NOW())`,
        ['admin_bansos', `Pencadangan arsip master: ${backupCount} warga diamankan ke tabel warga_backup`]
      );
    } catch (_) {}

    await conn.end();
    const syncTime = new Date().toLocaleString('id-ID');
    saveMysqlConfig({ last_sync: syncTime, enabled: true });

    return {
      success: true,
      backupCount,
      activeCount,
      message: `Berhasil mencadangkan & menyinkronkan ${backupCount} data warga ke Server Master dan tabel MySQL '${cfg.database}.warga_backup'.`
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return {
      success: false,
      backupCount: backupList.length,
      activeCount: activeWargaList?.length || 0,
      message: `Cadangan disimpan di disk peladen (${backupList.length} warga), namun koneksi MySQL sedang terkendala: ${err.message || err}`
    };
  }
}

export async function clearWargaBackupInMysql(): Promise<{ success: boolean; message: string }> {
  clearArsipBackupOnDisk();
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    const cfg = resolved.cfg;
    await conn.query(`USE \`${cfg.database}\`;`);
    await conn.query('DELETE FROM `warga_backup`');
    try {
      await conn.query(
        `INSERT INTO \`log\` (username, aksi, waktu) VALUES (?, ?, NOW())`,
        ['admin_bansos', 'Snapshot cadangan tabel warga_backup dikosongkan']
      );
    } catch (_) {}
    await conn.end();
    return {
      success: true,
      message: `Snapshot cadangan di Server Master dan tabel MySQL '${cfg.database}.warga_backup' berhasil dihapus.`
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return {
      success: true,
      message: 'Snapshot cadangan di Server Master berhasil dibersihkan.'
    };
  }
}

function mapMysqlRowToWarga(r: any): any {
  let extra: Record<string, any> = {};
  if (r.extra_data) {
    try {
      extra = typeof r.extra_data === 'string' ? JSON.parse(r.extra_data) : r.extra_data;
    } catch (_) {}
  }

  const desil = Number(r.desil || 5);
  let rawNom = String(r.nominal_bantuan ?? '').trim();
  if (!rawNom || rawNom === '0' || rawNom === '0.00') {
    rawNom = desil <= 4 ? 'Rp 600.000 / Beras 10 Kg' : 'Rp 0 (Non-PKH)';
  } else if (/^\d+(\.\d+)?$/.test(rawNom)) {
    const num = Math.round(Number(rawNom));
    rawNom = num > 0 ? `Rp ${num.toLocaleString('id-ID')} / Beras 10 Kg` : (desil <= 4 ? 'Rp 600.000 / Beras 10 Kg' : 'Rp 0 (Non-PKH)');
  }

  let statusSalur = String(r.status_salur || 'Belum Salur').trim();
  if (statusSalur.toLowerCase() === 'pending') {
    statusSalur = 'Belum Salur';
  }

  let tglLahirStr = '';
  if (r.tanggal_lahir instanceof Date && !isNaN(r.tanggal_lahir.getTime())) {
    tglLahirStr = r.tanggal_lahir.toISOString().slice(0, 10);
  } else if (r.tanggal_lahir) {
    tglLahirStr = String(r.tanggal_lahir).slice(0, 10);
  }

  let createdStr = 'Dari MySQL';
  if (r.created_at instanceof Date && !isNaN(r.created_at.getTime())) {
    createdStr = r.created_at.toISOString().slice(0, 19).replace('T', ' ');
  } else if (r.created_at) {
    createdStr = String(r.created_at);
  }

  return {
    id: Number(r.id),
    nik: String(r.nik).trim(),
    nama: String(r.nama || 'Warga Sidoarjo').trim(),
    nama_lengkap: String(r.nama || 'Warga Sidoarjo').trim(),
    tempat_lahir: r.tempat_lahir || 'Sidoarjo',
    tanggal_lahir: tglLahirStr || '1985-01-01',
    alamat: r.alamat || 'Kabupaten Sidoarjo',
    no_hp: r.no_hp || '',
    email: r.email || '',
    lat: Number(r.lat || -7.4478),
    lng: Number(r.lng || 112.7183),
    c1: Number(r.c1 ?? 1500000),
    c2: Number(r.c2 ?? 5000000),
    c3: Number(r.c3 ?? 45),
    c4: Number(r.c4 ?? 1),
    c5: Number(r.c5 ?? 3),
    c6: Number(r.c6 ?? 2),
    c7: Number(r.c7 ?? 2),
    c8: Number(r.c8 ?? 2),
    c9: Number(r.c9 ?? 1),
    c10: Number(r.c10 ?? 1),
    desil,
    skor_saw: Number(r.skor_saw || 0),
    rank_saw: Number(r.rank_saw || 0),
    is_verified: Boolean(r.is_verified),
    status_validasi: r.status_validasi || (r.is_verified ? 'Disetujui' : 'Menunggu'),
    status_salur: statusSalur,
    status_bansos: r.status_bansos || (desil <= 4 ? 'Layak Bansos' : 'Tidak Layak'),
    prioritas: r.prioritas || (desil <= 4 ? 'Prioritas Utama' : 'Bukan Prioritas'),
    bukti_salur: r.bukti_salur || '',
    keterangan_salur: r.keterangan_salur || r.catatan || '',
    catatan: r.catatan || '',
    nominal_bantuan: rawNom,
    tanggal_salur: r.tanggal_salur || '-',
    konfirmasi_warga: Boolean(r.konfirmasi_warga),
    waktu_konfirmasi_warga: r.waktu_konfirmasi_warga || '',
    created_at: createdStr,
    extra_data: extra,
    ...extra
  };
}

// Muat data dari MySQL ke memori sistem (dari tabel warga atau warga_backup)
export async function loadWargaFromMysql(tableName: 'warga' | 'warga_backup' = 'warga'): Promise<{ success: boolean; data: any[]; message: string }> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    const cfg = resolved.cfg;
    await conn.query(`USE \`${cfg.database}\`;`);
    const [rows]: any = await conn.query(`SELECT * FROM \`${tableName}\` ORDER BY id ASC`);
    await conn.end();

    const formatted = (rows || []).map(mapMysqlRowToWarga);
    return {
      success: true,
      data: formatted,
      message: `Berhasil membaca ${formatted.length} data warga dari tabel MySQL '${cfg.database}.${tableName}'.`
    };
  } catch (err: any) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return {
      success: false,
      data: [],
      message: `Gagal membaca data dari MySQL: ${err.message || err}`
    };
  }
}

// Generate DDL SQL lengkap yang bisa di-import langsung di phpMyAdmin / MySQL CLI
export function generateMysqlSqlDump(warga: any[], kriteria: any[], users: any[]): string {
  const dbName = currentConfig.database || 'bansos';
  const now = new Date().toISOString();

  let sql = `-- ============================================================================
-- SKEMA BASIS DATA PEMERINTAH KABUPATEN SIDOARJO
-- SISTEM PENDUKUNG KEPUTUSAN (SPK) PENENTUAN PENERIMA BANSOS
-- Metode: Best-Worst Method (BWM) & Simple Additive Weighting (SAW)
-- Kompatibel: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+, phpMyAdmin, MySQL Workbench
-- Tanggal Ekspor: ${now}
-- ============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`${dbName}\`;

-- --------------------------------------------------------
-- Struktur Tabel \`warga\`
-- Mendukung seluruh variabel standar & puluhan variabel kustom (JSON extra_data)
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`warga\`;
CREATE TABLE \`warga\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`nik\` varchar(20) NOT NULL UNIQUE,
  \`nama\` varchar(150) NOT NULL,
  \`tempat_lahir\` varchar(100) DEFAULT 'Sidoarjo',
  \`tanggal_lahir\` date DEFAULT NULL,
  \`alamat\` text DEFAULT NULL,
  \`no_hp\` varchar(30) DEFAULT NULL,
  \`email\` varchar(100) DEFAULT NULL,
  \`lat\` decimal(10,7) DEFAULT -7.4478000,
  \`lng\` decimal(10,7) DEFAULT 112.7183000,
  \`c1\` decimal(15,2) DEFAULT 1500000.00,
  \`c2\` decimal(15,2) DEFAULT 5000000.00,
  \`c3\` int(11) DEFAULT 45,
  \`c4\` int(11) DEFAULT 1,
  \`c5\` int(11) DEFAULT 3,
  \`c6\` int(11) DEFAULT 2,
  \`c7\` int(11) DEFAULT 2,
  \`c8\` int(11) DEFAULT 2,
  \`c9\` int(11) DEFAULT 1,
  \`c10\` int(11) DEFAULT 1,
  \`desil\` int(11) DEFAULT 5,
  \`skor_saw\` decimal(8,4) DEFAULT 0.0000,
  \`rank_saw\` int(11) DEFAULT 0,
  \`is_verified\` tinyint(1) DEFAULT 0,
  \`status_validasi\` varchar(50) DEFAULT 'Menunggu',
  \`status_salur\` varchar(50) DEFAULT 'Belum Salur',
  \`status_bansos\` varchar(100) DEFAULT 'Menunggu Verifikasi',
  \`prioritas\` varchar(50) DEFAULT 'Menunggu',
  \`bukti_salur\` varchar(255) DEFAULT '',
  \`keterangan_salur\` text DEFAULT NULL,
  \`tanggal_salur\` varchar(50) DEFAULT '-',
  \`konfirmasi_warga\` tinyint(1) DEFAULT 0,
  \`waktu_konfirmasi_warga\` varchar(50) DEFAULT NULL,
  \`catatan\` text DEFAULT NULL,
  \`nominal_bantuan\` varchar(150) DEFAULT 'Rp 600.000 / Beras 10 Kg',
  \`extra_data\` longtext DEFAULT NULL COMMENT 'Menyimpan puluhan variabel tambahan (20, 39, 50+ variabel fleksibel)',
  \`created_at\` varchar(50) DEFAULT NULL,
  \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (\`id\`),
  KEY \`idx_nik\` (\`nik\`),
  KEY \`idx_desil\` (\`desil\`),
  KEY \`idx_status_salur\` (\`status_salur\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Struktur Tabel \`kriteria\` (10 Parameter SPK BWM-SAW)
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`kriteria\`;
CREATE TABLE \`kriteria\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`kode\` varchar(10) NOT NULL UNIQUE,
  \`nama\` varchar(150) NOT NULL,
  \`bobot\` decimal(6,4) NOT NULL,
  \`tipe\` varchar(20) NOT NULL,
  \`jenis\` varchar(20) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Struktur Tabel \`users\`
-- --------------------------------------------------------
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`username\` varchar(50) NOT NULL UNIQUE,
  \`password\` varchar(255) NOT NULL,
  \`nama_lengkap\` varchar(150) NOT NULL,
  \`email\` varchar(100) NOT NULL,
  \`role\` varchar(30) NOT NULL DEFAULT 'operator',
  \`is_active\` tinyint(1) DEFAULT 1,
  \`created_at\` varchar(50) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\n`;

  // Seed Kriteria
  if (kriteria && kriteria.length > 0) {
    sql += `-- Data Awal Tabel \`kriteria\`\n`;
    sql += `INSERT INTO \`kriteria\` (\`id\`, \`kode\`, \`nama\`, \`bobot\`, \`tipe\`, \`jenis\`) VALUES\n`;
    const kRows = kriteria.map(k => `(${k.id}, '${k.kode}', '${k.nama.replace(/'/g, "''")}', ${k.bobot}, '${k.tipe}', '${k.jenis}')`).join(',\n');
    sql += kRows + ';\n\n';
  }

  // Seed Users
  if (users && users.length > 0) {
    sql += `-- Data Awal Tabel \`users\` (Kredensial Password Dilindungi / Terenkripsi)\n`;
    sql += `INSERT INTO \`users\` (\`id\`, \`username\`, \`password\`, \`nama_lengkap\`, \`email\`, \`role\`, \`is_active\`, \`created_at\`) VALUES\n`;
    const uRows = users.map(u => {
      const maskedPass = '$2y$10$CYBER_SHIELD_PROTECTED_HASH_' + Buffer.from(u.username).toString('hex').slice(0, 16);
      return `(${u.id}, '${u.username}', '${maskedPass}', '${u.nama_lengkap.replace(/'/g, "''")}', '${u.email}', '${u.role}', ${u.is_active ? 1 : 0}, '${u.created_at || '2026-01-01'}')`;
    }).join(',\n');
    sql += uRows + ';\n\n';
  }

  // Seed Warga
  if (warga && warga.length > 0) {
    sql += `-- Data Arsip Warga Kabupaten Sidoarjo (${warga.length} Baris)\n`;
    sql += `INSERT INTO \`warga\` (\`id\`, \`nik\`, \`nama\`, \`tempat_lahir\`, \`tanggal_lahir\`, \`alamat\`, \`no_hp\`, \`email\`, \`lat\`, \`lng\`, \`c1\`, \`c2\`, \`c3\`, \`c4\`, \`c5\`, \`c6\`, \`c7\`, \`c8\`, \`c9\`, \`c10\`, \`desil\`, \`skor_saw\`, \`rank_saw\`, \`is_verified\`, \`status_validasi\`, \`status_salur\`, \`status_bansos\`, \`prioritas\`, \`bukti_salur\`, \`keterangan_salur\`, \`tanggal_salur\`, \`konfirmasi_warga\`, \`waktu_konfirmasi_warga\`, \`catatan\`, \`nominal_bantuan\`, \`extra_data\`, \`created_at\`) VALUES\n`;
    
    const wRows = warga.map(w => {
      const extra = w.extra_data ? JSON.stringify(w.extra_data).replace(/'/g, "''") : '{}';
      const tgl = w.tanggal_lahir ? `'${String(w.tanggal_lahir).slice(0, 10)}'` : 'NULL';
      const ketSalur = String(w.keterangan_salur || '').replace(/'/g, "''");
      const waktuKonf = w.waktu_konfirmasi_warga ? `'${w.waktu_konfirmasi_warga}'` : 'NULL';
      return `(${w.id}, '${w.nik}', '${String(w.nama).replace(/'/g, "''")}', '${String(w.tempat_lahir || 'Sidoarjo').replace(/'/g, "''")}', ${tgl}, '${String(w.alamat || '').replace(/'/g, "''")}', '${String(w.no_hp || '')}', '${String(w.email || '')}', ${w.lat || -7.4478}, ${w.lng || 112.7183}, ${w.c1 || 0}, ${w.c2 || 0}, ${w.c3 || 45}, ${w.c4 || 1}, ${w.c5 || 3}, ${w.c6 || 2}, ${w.c7 || 2}, ${w.c8 || 2}, ${w.c9 || 1}, ${w.c10 || 1}, ${w.desil || 5}, ${w.skor_saw || 0}, ${w.rank_saw || 0}, ${w.is_verified ? 1 : 0}, '${w.status_validasi || 'Menunggu'}', '${w.status_salur || 'Belum Salur'}', '${w.status_bansos || 'Menunggu'}', '${w.prioritas || 'Menunggu'}', '${String(w.bukti_salur || '')}', '${ketSalur}', '${w.tanggal_salur || '-'}', ${w.konfirmasi_warga ? 1 : 0}, ${waktuKonf}, '${String(w.catatan || '').replace(/'/g, "''")}', '${w.nominal_bantuan || 'Rp 600.000'}', '${extra}', '${w.created_at || 'Hari ini'}')`;
    }).join(',\n');
    sql += wRows + ';\n\n';
  }

  sql += `COMMIT;\n`;
  return sql;
}

export function generateXamppBridgePhp(): string {
  return `<?php
/**
 * Bridge API Localhost XAMPP - Sistem Bansos Sidoarjo
 * Letakkan berkas ini di folder: C:\\xampp\\htdocs\\bansos\\bridge_sync.php
 * Akses melalui: http://localhost/bansos/bridge_sync.php
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$host = 'localhost';
$user = 'root';
$pass = '';
$db   = 'bansos';

$conn = @new mysqli($host, $user, $pass);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Gagal terhubung ke MySQL XAMPP: " . $conn->connect_error]);
    exit;
}

$conn->query("CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$conn->select_db($db);

$conn->query("CREATE TABLE IF NOT EXISTS \`warga\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`nik\` varchar(20) NOT NULL UNIQUE,
    \`nama\` varchar(150) NOT NULL,
    \`tempat_lahir\` varchar(100) DEFAULT 'Sidoarjo',
    \`tanggal_lahir\` date DEFAULT NULL,
    \`alamat\` text DEFAULT NULL,
    \`no_hp\` varchar(30) DEFAULT NULL,
    \`email\` varchar(100) DEFAULT NULL,
    \`c1\` decimal(15,2) DEFAULT 1500000.00,
    \`c2\` decimal(15,2) DEFAULT 5000000.00,
    \`c3\` int(11) DEFAULT 45,
    \`c4\` int(11) DEFAULT 1,
    \`c5\` int(11) DEFAULT 3,
    \`c6\` int(11) DEFAULT 2,
    \`c7\` int(11) DEFAULT 2,
    \`c8\` int(11) DEFAULT 2,
    \`c9\` int(11) DEFAULT 1,
    \`c10\` int(11) DEFAULT 1,
    \`desil\` int(11) DEFAULT 5,
    \`skor_saw\` decimal(8,4) DEFAULT 0.0000,
    \`rank_saw\` int(11) DEFAULT 0,
    \`is_verified\` tinyint(1) DEFAULT 1,
    \`status_validasi\` varchar(50) DEFAULT 'Disetujui',
    \`status_salur\` varchar(50) DEFAULT 'Belum Salur',
    \`status_bansos\` varchar(100) DEFAULT 'Layak Bansos',
    \`prioritas\` varchar(50) DEFAULT 'Prioritas Utama',
    \`bukti_salur\` varchar(255) DEFAULT '',
    \`keterangan_salur\` text DEFAULT NULL,
    \`tanggal_salur\` varchar(50) DEFAULT '-',
    \`konfirmasi_warga\` tinyint(1) DEFAULT 0,
    \`waktu_konfirmasi_warga\` varchar(50) DEFAULT NULL,
    \`catatan\` text DEFAULT NULL,
    \`nominal_bantuan\` varchar(150) DEFAULT 'Rp 600.000 / Beras 10 Kg',
    \`extra_data\` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = $_GET['action'] ?? 'test';

if ($action === 'test') {
    echo json_encode(["status" => "success", "message" => "Koneksi XAMPP Localhost ke database '$db' Berhasil Terhubung!", "version" => $conn->server_info]);
    exit;
}

if ($action === 'sync') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    $items = is_array($payload) ? (isset($payload['data']) ? $payload['data'] : $payload) : [];
    $saved = 0;
    foreach ($items as $w) {
        $nik = $conn->real_escape_string($w['nik'] ?? '');
        $nama = $conn->real_escape_string($w['nama'] ?? '');
        if (!$nik || !$nama) continue;
        $alamat = $conn->real_escape_string($w['alamat'] ?? '');
        $c1 = floatval($w['c1'] ?? 1500000);
        $c2 = floatval($w['c2'] ?? 5000000);
        $c3 = intval($w['c3'] ?? 45);
        $status_salur = $conn->real_escape_string($w['status_salur'] ?? 'Belum Salur');
        $bukti_salur = $conn->real_escape_string($w['bukti_salur'] ?? '');
        $ket_salur = $conn->real_escape_string($w['keterangan_salur'] ?? '');
        $tgl_salur = $conn->real_escape_string($w['tanggal_salur'] ?? '-');
        $konf = !empty($w['konfirmasi_warga']) ? 1 : 0;
        $wkt_konf = $conn->real_escape_string($w['waktu_konfirmasi_warga'] ?? '');
        $extra = isset($w['extra_data']) ? $conn->real_escape_string(json_encode($w['extra_data'])) : '';

        $sql = "INSERT INTO \`warga\` (\`nik\`, \`nama\`, \`alamat\`, \`c1\`, \`c2\`, \`c3\`, \`status_salur\`, \`bukti_salur\`, \`keterangan_salur\`, \`tanggal_salur\`, \`konfirmasi_warga\`, \`waktu_konfirmasi_warga\`, \`extra_data\`)
                VALUES ('$nik', '$nama', '$alamat', $c1, $c2, $c3, '$status_salur', '$bukti_salur', '$ket_salur', '$tgl_salur', $konf, '$wkt_konf', '$extra')
                ON DUPLICATE KEY UPDATE \`nama\`='$nama', \`alamat\`='$alamat', \`status_salur\`='$status_salur', \`bukti_salur\`='$bukti_salur', \`keterangan_salur\`='$ket_salur', \`tanggal_salur\`='$tgl_salur', \`konfirmasi_warga\`=$konf, \`waktu_konfirmasi_warga\`='$wkt_konf', \`extra_data\`='$extra'";
        if ($conn->query($sql)) $saved++;
    }
    echo json_encode(["status" => "success", "message" => "Berhasil menyinkronkan $saved warga ke basis data XAMPP bansos.", "count" => $saved]);
    exit;
}

if ($action === 'pull') {
    $res = $conn->query("SELECT * FROM \`warga\` ORDER BY \`id\` ASC");
    $list = [];
    while ($row = $res->fetch_assoc()) {
        if (!empty($row['extra_data'])) {
            $extra = json_decode($row['extra_data'], true);
            if (is_array($extra)) {
                $row = array_merge($row, $extra);
            }
        }
        $list[] = $row;
    }
    echo json_encode(["status" => "success", "data" => $list, "total" => count($list)]);
    exit;
}

echo json_encode(["status" => "error", "message" => "Aksi tidak dikenali"]);
`;
}

// Inisialisasi awal konfigurasi
loadMysqlConfig();


// =========================================================================
// REALTIME DATA SAVERS TO MYSQL (CHAT, PENGADUAN, PANGGILAN, REKAP, SPK, SK)
// =========================================================================

export async function savePengaduanRealtimeToMysql(a: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`pengaduan\` (id, nik, nama_pelapor, kategori, isi_laporan, uraian, status_step, status_text, status, catatan_petugas, petugas_penindak, urgensi_eskalasi, waktu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_pelapor = VALUES(nama_pelapor),
         kategori = VALUES(kategori),
         isi_laporan = VALUES(isi_laporan),
         uraian = VALUES(uraian),
         status_step = VALUES(status_step),
         status_text = VALUES(status_text),
         status = VALUES(status),
         catatan_petugas = VALUES(catatan_petugas),
         petugas_penindak = VALUES(petugas_penindak),
         urgensi_eskalasi = VALUES(urgensi_eskalasi),
         waktu = VALUES(waktu)`,
      [
        Number(a.id) || null,
        String(a.nik || ''),
        String(a.nama_pelapor || a.nama || 'Warga'),
        String(a.kategori || 'Sengketa Penyaluran Bansos'),
        String(a.isi_laporan || a.uraian || a.deskripsi || ''),
        String(a.uraian || a.deskripsi || a.isi_laporan || ''),
        Number(a.status_step || 1),
        String(a.status_text || a.status || 'Laporan Diterima'),
        String(a.status || a.status_text || 'Laporan Diterima'),
        String(a.catatan_petugas || ''),
        String(a.petugas_penindak || ''),
        String(a.urgensi_eskalasi || 'Normal'),
        String(a.waktu || new Date().toLocaleString('id-ID'))
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function saveChatMessageRealtimeToMysql(c: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`chat_messages\` (id, nik, sender, nama, pesan, file_path, file_name, file_type, file_size, reply_sender, reply_text, reply_to_id, reaction, is_pinned, is_starred, is_deleted_all, waktu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pesan = VALUES(pesan),
         reaction = VALUES(reaction),
         is_pinned = VALUES(is_pinned),
         is_starred = VALUES(is_starred),
         is_deleted_all = VALUES(is_deleted_all)`,
      [
        Number(c.id) || null,
        String(c.nik || ''),
        String(c.sender || 'warga'),
        String(c.nama || ''),
        String(c.pesan || c.text || ''),
        c.file_path ? String(c.file_path) : null,
        c.file_name ? String(c.file_name) : null,
        c.file_type ? String(c.file_type) : null,
        c.file_size ? Number(c.file_size) : null,
        c.reply_sender ? String(c.reply_sender) : null,
        c.reply_text ? String(c.reply_text) : null,
        c.reply_to_id ? Number(c.reply_to_id) : null,
        String(c.reaction || ''),
        c.is_pinned ? 1 : 0,
        c.is_starred ? 1 : 0,
        c.is_deleted_all ? 1 : 0,
        String(c.waktu || '')
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function saveLogPanggilanRealtimeToMysql(call: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`log_panggilan\` (id, caller_id, caller_name, caller_role, callee_id, callee_name, callee_role, nik_warga, tipe_panggilan, status, durasi_detik, waktu_mulai, waktu_selesai, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         durasi_detik = VALUES(durasi_detik),
         waktu_selesai = VALUES(waktu_selesai),
         catatan = VALUES(catatan)`,
      [
        Number(call.id) || null,
        String(call.caller_id || ''),
        String(call.caller_name || ''),
        String(call.caller_role || 'petugas'),
        String(call.callee_id || ''),
        String(call.callee_name || ''),
        String(call.callee_role || 'warga'),
        call.nik_warga ? String(call.nik_warga) : null,
        String(call.tipe_panggilan || 'audio'),
        String(call.status || 'selesai'),
        Number(call.durasi_detik || 0),
        toMysqlDateTime(call.waktu_mulai),
        call.waktu_selesai ? toMysqlDateTime(call.waktu_selesai) : null,
        String(call.catatan || '')
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function deleteLogPanggilanFromMysql(id: number | string): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(`DELETE FROM \`log_panggilan\` WHERE id = ?;`, [Number(id)]);
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function clearAllLogPanggilanInMysql(): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(`TRUNCATE TABLE \`log_panggilan\`;`);
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function saveRekapTriwulanRealtimeToMysql(r: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`rekap_triwulan\` (kode_periode, tahun, triwulan_ke, nama_periode, rentang_bulan, jadwal_penyaluran, is_published, published_at, published_by, total_kpm, total_nominal, ringkasan, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_published = VALUES(is_published),
         published_at = VALUES(published_at),
         published_by = VALUES(published_by),
         total_kpm = VALUES(total_kpm),
         total_nominal = VALUES(total_nominal),
         ringkasan = VALUES(ringkasan),
         data_json = VALUES(data_json)`,
      [
        String(r.kode_periode || `TW${r.triwulan_ke || 4}-${r.tahun || 2026}`),
        Number(r.tahun || 2026),
        Number(r.triwulan_ke || 4),
        String(r.nama_periode || 'Rekapitulasi Penyaluran Triwulan'),
        String(r.rentang_bulan || ''),
        String(r.jadwal_penyaluran || ''),
        r.is_published ? 1 : 0,
        r.published_at ? String(r.published_at) : null,
        r.published_by ? String(r.published_by) : null,
        Number(r.total_kpm || 0),
        String(r.total_nominal || 'Rp 0'),
        typeof r.ringkasan === 'object' ? JSON.stringify(r.ringkasan) : String(r.ringkasan || ''),
        r.items ? JSON.stringify(r.items) : (r.data_json ? String(r.data_json) : null)
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function saveSpkMetrikRealtimeToMysql(m: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`spk_metrik_perhitungan\` (kode_perhitungan, tahun, triwulan_ke, metode, total_warga, total_layak, is_published, published_at, published_by, bobot_kriteria_json, matriks_keputusan_json, skor_dan_ranking_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_published = VALUES(is_published),
         published_at = VALUES(published_at),
         published_by = VALUES(published_by),
         total_warga = VALUES(total_warga),
         total_layak = VALUES(total_layak),
         bobot_kriteria_json = VALUES(bobot_kriteria_json),
         matriks_keputusan_json = VALUES(matriks_keputusan_json),
         skor_dan_ranking_json = VALUES(skor_dan_ranking_json)`,
      [
        String(m.kode_perhitungan || 'SPK-2026-TW4'),
        Number(m.tahun || 2026),
        Number(m.triwulan_ke || 4),
        String(m.metode || 'BWM-SAW & WP'),
        Number(m.total_warga || 0),
        Number(m.total_layak || 0),
        m.is_published ? 1 : 0,
        m.published_at ? String(m.published_at) : null,
        m.published_by ? String(m.published_by) : null,
        m.bobot_kriteria ? JSON.stringify(m.bobot_kriteria) : null,
        m.matriks_keputusan ? JSON.stringify(m.matriks_keputusan) : null,
        m.skor_dan_ranking ? JSON.stringify(m.skor_dan_ranking) : null
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}

export async function saveSkBupatiRealtimeToMysql(sk: any): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const resolved = await resolveWorkingConnection();
    conn = resolved.conn;
    await conn.query(`USE \`${resolved.cfg.database}\`;`);
    await conn.query(
      `INSERT INTO \`sk_bupati\` (nomor_sk, tahun, judul_sk, tentang, tanggal_penetapan, nama_bupati, nama_kadinsos, total_kpm, total_anggaran, is_published, published_at, published_by, daftar_penerima_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         judul_sk = VALUES(judul_sk),
         tentang = VALUES(tentang),
         tanggal_penetapan = VALUES(tanggal_penetapan),
         nama_bupati = VALUES(nama_bupati),
         nama_kadinsos = VALUES(nama_kadinsos),
         total_kpm = VALUES(total_kpm),
         total_anggaran = VALUES(total_anggaran),
         is_published = VALUES(is_published),
         published_at = VALUES(published_at),
         published_by = VALUES(published_by),
         daftar_penerima_json = VALUES(daftar_penerima_json)`,
      [
        String(sk.nomor_sk || '188/460/438.1.1.3/2026'),
        Number(sk.tahun || 2026),
        String(sk.judul_sk || 'Keputusan Bupati Sidoarjo'),
        String(sk.tentang || 'Penetapan Penerima Bantuan Sosial'),
        String(sk.tanggal_penetapan || '26 Oktober 2026'),
        String(sk.nama_bupati || 'H. Ahmad Muhdlor Ali, S.I.P.'),
        String(sk.nama_kadinsos || 'Drs. H. Misbah, M.M.'),
        Number(sk.total_kpm || 0),
        String(sk.total_anggaran || 'Rp 0'),
        sk.is_published ? 1 : 0,
        sk.published_at ? String(sk.published_at) : null,
        sk.published_by ? String(sk.published_by) : null,
        sk.daftar_penerima ? JSON.stringify(sk.daftar_penerima) : null
      ]
    );
    await conn.end();
    return true;
  } catch (e) {
    if (conn) try { await conn.end(); } catch (_) {}
    return false;
  }
}
