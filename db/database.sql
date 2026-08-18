-- Buat Database baru jika belum ada
CREATE DATABASE IF NOT EXISTS bansos;
USE bansos;

-- 1. Tabel User (Autentikasi Login Pegawai & Rekam Jejak Nama)
CREATE TABLE IF NOT EXISTS user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    plain_password VARCHAR(255) NULL, -- Brankas Sandi (Vault)
    nama_lengkap VARCHAR(100) NOT NULL, -- Nama Asli Petugas/Admin
    role VARCHAR(20) DEFAULT 'operator'
);

-- 2. Tabel Warga (Struktur Lengkap dengan Tahap Salur, Desil Algoritma, & Rekam Jejak)
CREATE TABLE IF NOT EXISTS warga (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    nik VARCHAR(20) NOT NULL UNIQUE,
    no_hp VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    tempat_lahir VARCHAR(50) NULL,
    tanggal_lahir DATE NULL,
    alamat VARCHAR(255) NULL,
    c1_ekonomi FLOAT NOT NULL DEFAULT 0,
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
    catatan TEXT NULL,
    status_salur VARCHAR(20) DEFAULT 'Pending',
    latitude VARCHAR(50) NULL,
    longitude VARCHAR(50) NULL,
    desil INT NULL,
    foto_penyaluran VARCHAR(255) NULL,
    is_lapor_curang BOOLEAN DEFAULT FALSE,
    tahap_penyaluran INT DEFAULT 0,
    waktu_masuk DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NULL, -- Petugas yang menginput data
    verified_by VARCHAR(100) NULL -- Admin/Petugas yang memverifikasi
);

-- 3. Tabel Kriteria (Untuk Bobot BWM)
CREATE TABLE IF NOT EXISTS kriteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(5) NOT NULL UNIQUE,
    nama VARCHAR(50) NOT NULL,
    bobot FLOAT NOT NULL,
    jenis VARCHAR(10) NOT NULL
);

-- 4. Tabel Notifikasi (Manajemen Riwayat & Arsip Sistem)
CREATE TABLE IF NOT EXISTS notifikasi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pesan TEXT NOT NULL,
    role_target VARCHAR(20) NOT NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE
);

-- 5. Tabel Chat Keluhan (Untuk Live Chat, Emoji, Voice Note & Media)
CREATE TABLE IF NOT EXISTS chat_keluhan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nik_warga VARCHAR(20) NOT NULL,
    nama_warga VARCHAR(100) NOT NULL,
    sender VARCHAR(20) NOT NULL,
    pesan TEXT NULL,
    file_path VARCHAR(255) NULL,
    file_type VARCHAR(20) NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted_for_everyone BOOLEAN DEFAULT FALSE,
    deleted_by VARCHAR(20) NULL,
    is_reported BOOLEAN DEFAULT FALSE,
    report_reason VARCHAR(100) NULL,
    reply_to_id INT NULL,
    reply_to_text VARCHAR(255) NULL,
    reply_to_sender VARCHAR(100) NULL,
    reaction VARCHAR(10) NULL,
    INDEX (nik_warga),
    INDEX (waktu)
);