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

const DEFAULT_CONFIG: MysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'bansos',
  enabled: false,
  auto_sync: false
};

let currentConfig: MysqlConfig = { ...DEFAULT_CONFIG };
let currentPool: Pool | null = null;

// Muat konfigurasi dari berkas jika tersedia
export function loadMysqlConfig(): MysqlConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      currentConfig = { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('[MySQL] Gagal membaca mysql-config.json, menggunakan konfigurasi default:', err);
  }
  return currentConfig;
}

export function saveMysqlConfig(newCfg: Partial<MysqlConfig>): MysqlConfig {
  currentConfig = { ...currentConfig, ...newCfg };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[MySQL] Gagal menyimpan mysql-config.json:', err);
  }
  // Reset pool agar koneksi baru terpakai
  if (currentPool) {
    currentPool.end().catch(() => {});
    currentPool = null;
  }
  return currentConfig;
}

export function getMysqlPool(customCfg?: Partial<MysqlConfig>): Pool {
  const cfg = customCfg ? { ...currentConfig, ...customCfg } : currentConfig;
  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password || '',
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000
  });
}

// Uji koneksi ke peladen MySQL localhost
export async function testMysqlConnection(testCfg?: Partial<MysqlConfig>): Promise<{ success: boolean; message: string; version?: string }> {
  const cfg = testCfg ? { ...currentConfig, ...testCfg } : currentConfig;
  let connection;
  try {
    // Pertama coba connect tanpa nama database agar bisa membuat database jika belum ada
    connection = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password || '',
      connectTimeout: 4000
    });

    const [rows]: any = await connection.query('SELECT VERSION() as version');
    const version = rows && rows[0]?.version ? rows[0].version : 'MySQL';

    // Periksa apakah database sudah ada
    const [dbRows]: any = await connection.query(
      'SHOW DATABASES LIKE ?',
      [cfg.database]
    );
    const dbExists = dbRows && dbRows.length > 0;

    await connection.end();
    return {
      success: true,
      message: `Terhubung ke MySQL (${version}) pada ${cfg.host}:${cfg.port}. Database '${cfg.database}': ${dbExists ? 'Tersedia' : 'Belum dibuat (klik Migrasi)'}.`,
      version
    };
  } catch (err: any) {
    if (connection) {
      try { await connection.end(); } catch (_) {}
    }
    return {
      success: false,
      message: `Gagal terhubung ke MySQL localhost (${cfg.host}:${cfg.port}): ${err.message || 'Pastikan MySQL (XAMPP/Laragon/Service) sedang berjalan.'}`
    };
  }
}

// Migrasi skema: Buat database dan seluruh tabel secara otomatis
export async function migrateMysqlSchema(targetCfg?: Partial<MysqlConfig>): Promise<{ success: boolean; message: string; tables: string[] }> {
  const cfg = targetCfg ? { ...currentConfig, ...targetCfg } : currentConfig;
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password || '',
      connectTimeout: 5000,
      multipleStatements: true
    });

    // 1. Buat Database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${cfg.database}\`;`);

    // 2. Buat Tabel warga (Lengkap dengan kolom standar + extra_data LONGTEXT JSON fleksibel 50+ variabel)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`warga\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL UNIQUE,
        \`nama\` VARCHAR(150) NOT NULL,
        \`tempat_lahir\` VARCHAR(100) DEFAULT 'Sidoarjo',
        \`tanggal_lahir\` DATE NULL,
        \`alamat\` TEXT NULL,
        \`no_hp\` VARCHAR(30) NULL,
        \`email\` VARCHAR(100) NULL,
        \`lat\` DECIMAL(10, 7) DEFAULT -7.4478,
        \`lng\` DECIMAL(10, 7) DEFAULT 112.7183,
        \`c1\` DECIMAL(15, 2) DEFAULT 1500000.00,
        \`c2\` DECIMAL(15, 2) DEFAULT 5000000.00,
        \`c3\` INT DEFAULT 45,
        \`c4\` INT DEFAULT 1,
        \`c5\` INT DEFAULT 3,
        \`c6\` INT DEFAULT 2,
        \`c7\` INT DEFAULT 2,
        \`c8\` INT DEFAULT 2,
        \`c9\` INT DEFAULT 1,
        \`c10\` INT DEFAULT 1,
        \`desil\` INT DEFAULT 5,
        \`skor_saw\` DECIMAL(8, 4) DEFAULT 0.0000,
        \`rank_saw\` INT DEFAULT 0,
        \`is_verified\` TINYINT(1) DEFAULT 0,
        \`status_validasi\` VARCHAR(50) DEFAULT 'Menunggu',
        \`status_salur\` VARCHAR(50) DEFAULT 'Belum Salur',
        \`status_bansos\` VARCHAR(100) DEFAULT 'Menunggu Verifikasi',
        \`prioritas\` VARCHAR(50) DEFAULT 'Menunggu',
        \`bukti_salur\` VARCHAR(255) DEFAULT '',
        \`keterangan_salur\` TEXT NULL,
        \`tanggal_salur\` VARCHAR(50) DEFAULT '-',
        \`konfirmasi_warga\` TINYINT(1) DEFAULT 0,
        \`waktu_konfirmasi_warga\` VARCHAR(50) NULL,
        \`catatan\` TEXT NULL,
        \`nominal_bantuan\` VARCHAR(100) DEFAULT 'Rp 600.000 / Beras 10 Kg',
        \`extra_data\` LONGTEXT NULL,
        \`created_at\` VARCHAR(50) NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_nik\` (\`nik\`),
        INDEX \`idx_desil\` (\`desil\`),
        INDEX \`idx_status_salur\` (\`status_salur\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Buat Tabel kriteria
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`kriteria\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`kode\` VARCHAR(10) NOT NULL UNIQUE,
        \`nama\` VARCHAR(150) NOT NULL,
        \`bobot\` DECIMAL(6, 4) NOT NULL,
        \`tipe\` VARCHAR(20) NOT NULL,
        \`jenis\` VARCHAR(20) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Buat Tabel users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`nama_lengkap\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(100) NOT NULL,
        \`role\` VARCHAR(30) NOT NULL DEFAULT 'operator',
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`created_at\` VARCHAR(50) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Buat Tabel pengaduan
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`pengaduan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL,
        \`nama\` VARCHAR(150) NOT NULL,
        \`nama_pelapor\` VARCHAR(150) NULL,
        \`kategori\` VARCHAR(100) NOT NULL,
        \`uraian\` TEXT NOT NULL,
        \`deskripsi\` TEXT NULL,
        \`isi_laporan\` TEXT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Masuk',
        \`status_step\` INT DEFAULT 1,
        \`status_text\` VARCHAR(100) DEFAULT 'Laporan Diterima',
        \`catatan_petugas\` TEXT NULL,
        \`waktu\` VARCHAR(50) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Buat Tabel chat
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`chat\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nik\` VARCHAR(20) NOT NULL,
        \`sender\` VARCHAR(50) NOT NULL,
        \`nama\` VARCHAR(150) NOT NULL,
        \`pesan\` TEXT NULL,
        \`text\` TEXT NULL,
        \`file_path\` VARCHAR(255) NULL,
        \`file_type\` VARCHAR(50) NULL,
        \`reply_sender\` VARCHAR(150) NULL,
        \`reply_text\` TEXT NULL,
        \`reply_to_id\` INT NULL,
        \`reaction\` VARCHAR(20) DEFAULT '',
        \`is_pinned\` TINYINT(1) DEFAULT 0,
        \`is_deleted_all\` TINYINT(1) DEFAULT 0,
        \`deleted_for\` VARCHAR(50) NULL,
        \`waktu\` VARCHAR(50) NULL,
        \`created_at\` VARCHAR(50) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Buat Tabel notifikasi
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`notifikasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`pesan\` TEXT NOT NULL,
        \`kategori\` VARCHAR(50) NOT NULL,
        \`role_sender\` VARCHAR(50) NOT NULL,
        \`waktu\` VARCHAR(50) NOT NULL,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`is_pinned\` TINYINT(1) DEFAULT 0,
        \`is_archived\` TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [tables]: any = await conn.query('SHOW TABLES;');
    const tableNames = (tables || []).map((t: any) => Object.values(t)[0] as string);

    await conn.end();
    return {
      success: true,
      message: `Migrasi tabel MySQL berhasil! Database '${cfg.database}' siap menampung data warga & SPK.`,
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

// Ekspor seluruh data arsip web ke MySQL localhost
export async function syncAllDataToMysql(
  warga: any[],
  kriteria: any[],
  users: any[],
  pengaduan: any[],
  chat: any[],
  notifikasi: any[]
): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  const pool = getMysqlPool();
  const counts = { warga: 0, kriteria: 0, users: 0, pengaduan: 0, chat: 0, notifikasi: 0 };

  try {
    // 1. Simpan Warga (Upsert berdasarkan NIK)
    for (const w of warga) {
      // Ekstraksi custom fields atau variabel dinamis ke JSON extra_data
      const coreKeys = new Set([
        'id', 'nik', 'nama', 'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'alamat',
        'no_hp', 'email', 'lat', 'lng', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
        'c8', 'c9', 'c10', 'desil', 'skor_saw', 'rank_saw', 'is_verified', 'status_validasi',
        'status_salur', 'status_bansos', 'prioritas', 'bukti_salur', 'catatan',
        'nominal_bantuan', 'tanggal_salur', 'created_at', 'extra_data'
      ]);

      const extra: Record<string, any> = { ...(w.extra_data || {}) };
      Object.keys(w).forEach(k => {
        if (!coreKeys.has(k) && !k.startsWith('_')) {
          extra[k] = w[k];
        }
      });

      const extraJson = JSON.stringify(extra);

      await pool.query(
        `INSERT INTO \`warga\` (
          nik, nama, tempat_lahir, tanggal_lahir, alamat, no_hp, email, lat, lng,
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, desil, skor_saw, rank_saw,
          is_verified, status_validasi, status_salur, status_bansos, prioritas,
          bukti_salur, catatan, nominal_bantuan, tanggal_salur, extra_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          catatan = VALUES(catatan),
          nominal_bantuan = VALUES(nominal_bantuan),
          tanggal_salur = VALUES(tanggal_salur),
          extra_data = VALUES(extra_data)`,
        [
          String(w.nik),
          String(w.nama || w.nama_lengkap || 'Warga Sidoarjo'),
          String(w.tempat_lahir || 'Sidoarjo'),
          w.tanggal_lahir ? String(w.tanggal_lahir).slice(0, 10) : null,
          String(w.alamat || 'Kabupaten Sidoarjo'),
          String(w.no_hp || ''),
          String(w.email || ''),
          Number(w.lat || -7.4478),
          Number(w.lng || 112.7183),
          Number(w.c1 || 1500000),
          Number(w.c2 || 5000000),
          Number(w.c3 || 45),
          Number(w.c4 || 1),
          Number(w.c5 || 3),
          Number(w.c6 || 2),
          Number(w.c7 || 2),
          Number(w.c8 || 2),
          Number(w.c9 || 1),
          Number(w.c10 || 1),
          Number(w.desil || 5),
          Number(w.skor_saw || 0),
          Number(w.rank_saw || 0),
          w.is_verified ? 1 : 0,
          String(w.status_validasi || 'Menunggu'),
          String(w.status_salur || 'Belum Salur'),
          String(w.status_bansos || 'Menunggu Verifikasi'),
          String(w.prioritas || 'Menunggu'),
          String(w.bukti_salur || ''),
          String(w.catatan || ''),
          String(w.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg'),
          String(w.tanggal_salur || '-'),
          extraJson,
          String(w.created_at || 'Hari ini')
        ]
      );
      counts.warga++;
    }

    // 2. Simpan Kriteria
    for (const k of kriteria) {
      await pool.query(
        `INSERT INTO \`kriteria\` (kode, nama, bobot, tipe, jenis) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama = VALUES(nama), bobot = VALUES(bobot), tipe = VALUES(tipe), jenis = VALUES(jenis)`,
        [k.kode, k.nama, Number(k.bobot), k.tipe, k.jenis]
      );
      counts.kriteria++;
    }

    // 3. Simpan Users
    for (const u of users) {
      await pool.query(
        `INSERT INTO \`users\` (username, password, nama_lengkap, email, role, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama_lengkap = VALUES(nama_lengkap), email = VALUES(email), role = VALUES(role), is_active = VALUES(is_active)`,
        [u.username, u.password, u.nama_lengkap, u.email, u.role, u.is_active ? 1 : 0, u.created_at]
      );
      counts.users++;
    }

    currentConfig.last_sync = new Date().toLocaleString('id-ID');
    saveMysqlConfig({ last_sync: currentConfig.last_sync });

    return {
      success: true,
      message: `Berhasil mengekspor seluruh data ke database MySQL localhost (${counts.warga} warga, ${counts.kriteria} kriteria, ${counts.users} pengguna)!`,
      counts
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Kendala saat menyimpan ke MySQL: ${err.message || err}`,
      counts
    };
  }
}

// Muat data dari MySQL ke memori sistem
export async function loadWargaFromMysql(): Promise<{ success: boolean; data: any[]; message: string }> {
  try {
    const pool = getMysqlPool();
    const [rows]: any = await pool.query('SELECT * FROM `warga` ORDER BY id ASC');

    const formatted = (rows || []).map((r: any) => {
      let extra: Record<string, any> = {};
      if (r.extra_data) {
        try {
          extra = typeof r.extra_data === 'string' ? JSON.parse(r.extra_data) : r.extra_data;
        } catch (_) {}
      }

      return {
        id: r.id,
        nik: String(r.nik),
        nama: r.nama,
        nama_lengkap: r.nama,
        tempat_lahir: r.tempat_lahir || 'Sidoarjo',
        tanggal_lahir: r.tanggal_lahir ? String(r.tanggal_lahir).slice(0, 10) : '',
        alamat: r.alamat || 'Kabupaten Sidoarjo',
        no_hp: r.no_hp || '',
        email: r.email || '',
        lat: Number(r.lat || -7.4478),
        lng: Number(r.lng || 112.7183),
        c1: Number(r.c1 || 1500000),
        c2: Number(r.c2 || 5000000),
        c3: Number(r.c3 || 45),
        c4: Number(r.c4 || 1),
        c5: Number(r.c5 || 3),
        c6: Number(r.c6 || 2),
        c7: Number(r.c7 || 2),
        c8: Number(r.c8 || 2),
        c9: Number(r.c9 || 1),
        c10: Number(r.c10 || 1),
        desil: Number(r.desil || 5),
        skor_saw: Number(r.skor_saw || 0),
        rank_saw: Number(r.rank_saw || 0),
        is_verified: Boolean(r.is_verified),
        status_validasi: r.status_validasi || 'Menunggu',
        status_salur: r.status_salur || 'Belum Salur',
        status_bansos: r.status_bansos || 'Menunggu Verifikasi',
        prioritas: r.prioritas || 'Menunggu',
        bukti_salur: r.bukti_salur || '',
        catatan: r.catatan || '',
        nominal_bantuan: r.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg',
        tanggal_salur: r.tanggal_salur || '-',
        created_at: r.created_at || 'Dari MySQL',
        extra_data: extra,
        ...extra
      };
    });

    return {
      success: true,
      data: formatted,
      message: `Berhasil membaca ${formatted.length} data warga dari database MySQL localhost.`
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      message: `Gagal membaca data dari MySQL: ${err.message || err}`
    };
  }
}

// Generate DDL SQL lengkap yang bisa di-import langsung di phpMyAdmin / MySQL CLI
export function generateMysqlSqlDump(warga: any[], kriteria: any[], users: any[]): string {
  const dbName = currentConfig.database || 'db_bansos_sidoarjo';
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
  \`nominal_bantuan\` varchar(100) DEFAULT 'Rp 600.000 / Beras 10 Kg',
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
    sql += `-- Data Awal Tabel \`users\`\n`;
    sql += `INSERT INTO \`users\` (\`id\`, \`username\`, \`password\`, \`nama_lengkap\`, \`email\`, \`role\`, \`is_active\`, \`created_at\`) VALUES\n`;
    const uRows = users.map(u => `(${u.id}, '${u.username}', '${u.password}', '${u.nama_lengkap.replace(/'/g, "''")}', '${u.email}', '${u.role}', ${u.is_active ? 1 : 0}, '${u.created_at || '2026-01-01'}')`).join(',\n');
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
    \`nominal_bantuan\` varchar(100) DEFAULT 'Rp 600.000 / Beras 10 Kg',
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

