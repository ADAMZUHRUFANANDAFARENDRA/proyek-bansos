-- =========================================================================
-- STRUKTUR SKEMA BASIS DATA SISTEM SPK BANSOS SIDOARJO (BWM-SAW)
-- Database Name: bansos
-- Server Version: MariaDB / MySQL 5.7+ / 8.0+
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `bansos` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `bansos`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- 1. TABEL PENGGUNA SISTEM (USER)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `nama_lengkap` VARCHAR(150) DEFAULT NULL,
  `email` VARCHAR(120) DEFAULT NULL,
  `role` VARCHAR(30) DEFAULT 'operator',
  `is_active` TINYINT(1) DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `last_login_ip` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 2. TABEL DATA WARGA (WARGA)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `warga` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nik` VARCHAR(20) NOT NULL UNIQUE,
  `nama` VARCHAR(150) NOT NULL,
  `tempat_lahir` VARCHAR(100) DEFAULT 'Sidoarjo',
  `tanggal_lahir` DATE DEFAULT NULL,
  `alamat` TEXT DEFAULT NULL,
  `no_hp` VARCHAR(25) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `lat` VARCHAR(50) DEFAULT '-7.4478',
  `lng` VARCHAR(50) DEFAULT '112.7183',
  `c1` DOUBLE DEFAULT 0,
  `c2` DOUBLE DEFAULT 0,
  `c3` INT DEFAULT 0,
  `c4` INT DEFAULT 1,
  `c5` INT DEFAULT 0,
  `c6` INT DEFAULT 1,
  `c7` INT DEFAULT 0,
  `c8` INT DEFAULT 1,
  `c9` INT DEFAULT 1,
  `c10` INT DEFAULT 1,
  `desil` INT DEFAULT 5,
  `skor_saw` DOUBLE DEFAULT 0,
  `rank_saw` INT DEFAULT 0,
  `is_verified` TINYINT(1) DEFAULT 0,
  `status_validasi` VARCHAR(50) DEFAULT 'Menunggu',
  `status_salur` VARCHAR(50) DEFAULT 'Belum Salur',
  `status_bansos` VARCHAR(50) DEFAULT 'Menunggu Verifikasi',
  `prioritas` VARCHAR(50) DEFAULT 'Menunggu',
  `bukti_salur` VARCHAR(255) DEFAULT NULL,
  `catatan` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (`nik`),
  INDEX (`desil`),
  INDEX (`is_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 3. TABEL CADANGAN ARSIP WARGA (WARGA_BACKUP)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `warga_backup` LIKE `warga`;

-- --------------------------------------------------------
-- 4. TABEL KRITERIA BWM (KRITERIA)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kriteria` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode` VARCHAR(10) NOT NULL UNIQUE,
  `nama` VARCHAR(150) NOT NULL,
  `bobot` DOUBLE DEFAULT 0.1,
  `tipe` VARCHAR(20) DEFAULT 'benefit'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 5. TABEL PENGADUAN & SENGKETA WARGA
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pengaduan` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `warga_id` INT DEFAULT NULL,
  `nik` VARCHAR(20) DEFAULT NULL,
  `nama` VARCHAR(150) DEFAULT NULL,
  `nama_pelapor` VARCHAR(150) DEFAULT NULL,
  `kategori` VARCHAR(100) DEFAULT 'Sengketa Penyaluran Bansos',
  `deskripsi` TEXT DEFAULT NULL,
  `isi_laporan` TEXT DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Tahap Mediasi',
  `status_step` INT DEFAULT 2,
  `status_text` VARCHAR(100) DEFAULT 'Ditinjau Petugas',
  `catatan_petugas` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `aduan_warga` LIKE `pengaduan`;
CREATE TABLE IF NOT EXISTS `keluhan` LIKE `pengaduan`;

-- --------------------------------------------------------
-- 6. TABEL PERCAKAPAN CHAT & KELUHAN
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nik` VARCHAR(20) NOT NULL,
  `sender` VARCHAR(20) NOT NULL DEFAULT 'warga',
  `nama` VARCHAR(150) DEFAULT NULL,
  `pesan` TEXT DEFAULT NULL,
  `file_path` VARCHAR(255) DEFAULT NULL,
  `file_type` VARCHAR(50) DEFAULT NULL,
  `reaction` VARCHAR(20) DEFAULT NULL,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `deleted_for` VARCHAR(50) DEFAULT NULL,
  `reply_to_id` INT DEFAULT NULL,
  `reply_to_text` TEXT DEFAULT NULL,
  `reply_to_sender` VARCHAR(50) DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pesan_chat` LIKE `chat_messages`;
CREATE TABLE IF NOT EXISTS `chat_keluhan` LIKE `chat_messages`;

-- --------------------------------------------------------
-- 7. TABEL LOG AKTIVITAS & NOTIFIKASI
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifikasi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pesan` TEXT NOT NULL,
  `waktu` VARCHAR(100) DEFAULT 'Hari ini',
  `is_read` TINYINT(1) DEFAULT 0,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `is_archived` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `aktivitas` VARCHAR(255) NOT NULL,
  `keterangan` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- SEEDER DATA KRITERIA SESUAI LAPORAN SKRIPSI (TOTAL BOBOT = 1.00)
-- --------------------------------------------------------
INSERT INTO `kriteria` (`kode`, `nama`, `bobot`, `tipe`) VALUES
('C1', 'Kondisi Ekonomi / Penghasilan', 0.22, 'cost'),
('C2', 'Kepemilikan Aset', 0.15, 'cost'),
('C3', 'Umur Kepala Keluarga', 0.08, 'benefit'),
('C4', 'Jenis Kelamin', 0.05, 'benefit'),
('C5', 'Jumlah Tanggungan', 0.18, 'benefit'),
('C6', 'Status Pernikahan', 0.06, 'benefit'),
('C7', 'Kepemilikan Anak / Balita', 0.08, 'benefit'),
('C8', 'Kelayakan Tempat Tinggal', 0.10, 'cost'),
('C9', 'Tingkat Pendidikan Terakhir', 0.04, 'cost'),
('C10', 'Kondisi Kesehatan / Disabilitas', 0.04, 'cost')
ON DUPLICATE KEY UPDATE
  `nama` = VALUES(`nama`),
  `bobot` = VALUES(`bobot`),
  `tipe` = VALUES(`tipe`);

SET FOREIGN_KEY_CHECKS = 1;