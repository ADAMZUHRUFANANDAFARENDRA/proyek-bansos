CREATE DATABASE IF NOT EXISTS bansos;
USE bansos;

-- 1. Tabel Data Warga (10 Kriteria Penilaian BWM-SAW)
CREATE TABLE IF NOT EXISTS warga (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  nik VARCHAR(20) NOT NULL UNIQUE,
  no_hp VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  tempat_lahir VARCHAR(50) NULL,
  tanggal_lahir DATE NULL,
  alamat VARCHAR(255) NULL,
  c1_ekonomi DOUBLE NOT NULL DEFAULT 0,
  c2_aset INT NOT NULL DEFAULT 0,
  c3_umur INT NOT NULL DEFAULT 0,
  c4_jenis_kelamin INT NOT NULL DEFAULT 1,
  c5_tanggungan INT NOT NULL DEFAULT 0,
  c6_status_pernikahan INT NOT NULL DEFAULT 1,
  c7_kepemilikan_anak INT NOT NULL DEFAULT 0,
  c8_tempat_tinggal INT NOT NULL DEFAULT 1,
  c9_pendidikan INT NOT NULL DEFAULT 1,
  c10_kesehatan INT NOT NULL DEFAULT 1,
  is_verified BOOLEAN DEFAULT FALSE,
  tanggal_verifikasi DATE NULL,
  foto_rumah VARCHAR(255) NULL,
  latitude VARCHAR(50) NULL,
  longitude VARCHAR(50) NULL,
  catatan TEXT NULL,
  status_salur VARCHAR(20) DEFAULT 'Pending',
  bukti_salur VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Pengguna (Admin & Petugas/Operator)
CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'operator',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Kriteria Penilaian SPK
CREATE TABLE IF NOT EXISTS kriteria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(5) NOT NULL UNIQUE,
  nama VARCHAR(50) NOT NULL,
  bobot DOUBLE NOT NULL,
  jenis VARCHAR(10) NOT NULL -- 'benefit' atau 'cost'
);

-- 4. Tabel Notifikasi
CREATE TABLE IF NOT EXISTS notifikasi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pesan TEXT NOT NULL,
  role_target VARCHAR(20) NOT NULL DEFAULT 'all',
  waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE
);

-- 5. Tabel Live Chat & Pengaduan Multimedia
CREATE TABLE IF NOT EXISTS chat_keluhan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nik_warga VARCHAR(20) NOT NULL,
  nama_warga VARCHAR(100) NOT NULL,
  sender VARCHAR(20) NOT NULL, -- 'warga' atau 'admin'
  pesan TEXT NULL,
  file_path VARCHAR(255) NULL,
  file_type VARCHAR(20) NULL,
  waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);