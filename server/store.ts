import path from 'path';
import fs from 'fs';
import multer from 'multer';
import type {
  KriteriaItem,
  UserItem,
  WargaItem,
  NotifikasiItem,
  PengaduanItem,
  ChatItem,
  LaporanPelanggaranItem,
  MasterSeedTuple
} from './types.js';
import {
  validateUploadFileSafe,
  sanitizeSafeFilename,
  createSecureJwt,
  logSecurityIncident,
  getClientIp
} from './security_guard.js';

export const MASTER_RECOVERY_KEY = process.env.MASTER_RECOVERY_KEY || 'DINSOS-SDA-2026';

// Uploads directory config
export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_FOLDER || 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, sanitizeSafeFilename(file.originalname));
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 500 },
  fileFilter: (req, file, cb) => {
    const check = validateUploadFileSafe(file.originalname, file.mimetype);
    if (!check.safe) {
      logSecurityIncident({
        ip: getClientIp(req as any),
        method: 'POST',
        path: req.originalUrl || '/upload',
        attack_type: 'MALICIOUS_UPLOAD',
        threat_level: 'HIGH',
        matched_rule: `Forbidden File: ${path.extname(file.originalname)}`,
        payload_sample: `Filename: ${file.originalname}, MIME: ${file.mimetype}`,
        user_agent: String(req.headers['user-agent'] || 'Unknown'),
        status: 'BLOCKED',
        action_taken: 'Memblokir unggahan file berbahaya yang dilarang (Anti-Webshell).'
      });
      return cb(new Error(check.reason || 'Berkas ditolak oleh sistem keamanan.'));
    }
    cb(null, true);
  }
});

export const KECAMATAN_SIDOARJO = [
  { nama: 'Sidoarjo', lat: -7.4478, lng: 112.7183, desil_avg: 2 },
  { nama: 'Buduran', lat: -7.4245, lng: 112.7231, desil_avg: 3 },
  { nama: 'Candi', lat: -7.4812, lng: 112.7135, desil_avg: 2 },
  { nama: 'Porong', lat: -7.5451, lng: 112.6987, desil_avg: 1 },
  { nama: 'Krembung', lat: -7.5256, lng: 112.6124, desil_avg: 2 },
  { nama: 'Tulangan', lat: -7.4795, lng: 112.6453, desil_avg: 3 },
  { nama: 'Tanggulangin', lat: -7.5112, lng: 112.7124, desil_avg: 2 },
  { nama: 'Jabon', lat: -7.5678, lng: 112.7654, desil_avg: 1 },
  { nama: 'Waru', lat: -7.3541, lng: 112.7356, desil_avg: 4 },
  { nama: 'Gedangan', lat: -7.3878, lng: 112.7245, desil_avg: 3 },
  { nama: 'Sedati', lat: -7.3812, lng: 112.7845, desil_avg: 3 },
  { nama: 'Taman', lat: -7.3512, lng: 112.6987, desil_avg: 4 },
  { nama: 'Krian', lat: -7.4087, lng: 112.5834, desil_avg: 3 },
  { nama: 'Balongbendo', lat: -7.4124, lng: 112.5213, desil_avg: 2 },
  { nama: 'Prambon', lat: -7.4712, lng: 112.5745, desil_avg: 2 },
  { nama: 'Tarik', lat: -7.4512, lng: 112.5124, desil_avg: 2 },
  { nama: 'Sukodono', lat: -7.4145, lng: 112.6789, desil_avg: 3 },
  { nama: 'Wonoayu', lat: -7.4387, lng: 112.6345, desil_avg: 3 }
];

export const kriteriaStore: KriteriaItem[] = [
  { id: 1, kode: 'C1', nama: 'Kondisi Ekonomi / Penghasilan', bobot: 0.22, tipe: 'cost', jenis: 'cost' },
  { id: 2, kode: 'C2', nama: 'Kepemilikan Aset', bobot: 0.15, tipe: 'cost', jenis: 'cost' },
  { id: 3, kode: 'C3', nama: 'Umur Kepala Keluarga', bobot: 0.08, tipe: 'benefit', jenis: 'benefit' },
  { id: 4, kode: 'C4', nama: 'Jenis Kelamin', bobot: 0.05, tipe: 'benefit', jenis: 'benefit' },
  { id: 5, kode: 'C5', nama: 'Jumlah Tanggungan', bobot: 0.18, tipe: 'benefit', jenis: 'benefit' },
  { id: 6, kode: 'C6', nama: 'Status Pernikahan', bobot: 0.06, tipe: 'benefit', jenis: 'benefit' },
  { id: 7, kode: 'C7', nama: 'Kepemilikan Anak / Balita', bobot: 0.08, tipe: 'benefit', jenis: 'benefit' },
  { id: 8, kode: 'C8', nama: 'Kelayakan Tempat Tinggal', bobot: 0.10, tipe: 'cost', jenis: 'cost' },
  { id: 9, kode: 'C9', nama: 'Tingkat Pendidikan Terakhir', bobot: 0.04, tipe: 'cost', jenis: 'cost' },
  { id: 10, kode: 'C10', nama: 'Kondisi Kesehatan / Disabilitas', bobot: 0.04, tipe: 'cost', jenis: 'cost' }
];

export const usersStore: UserItem[] = [
  { id: 1, username: 'admin', password: 'admin', nama_lengkap: 'Administrator Utama (Super Admin)', email: 'admin@sidoarjo.go.id', role: 'admin', is_active: true, created_at: '2026-01-01' },
  { id: 2, username: 'petugas', password: '123', nama_lengkap: 'Petugas Lapangan Dinsos', email: 'petugas@sidoarjo.go.id', role: 'operator', is_active: true, created_at: '2026-01-01' },
  { id: 3, username: 'verifikator', password: '123', nama_lengkap: 'Tim Verifikator Wilayah', email: 'verifikator@sidoarjo.go.id', role: 'operator', is_active: true, created_at: '2026-01-01' },
  { id: 4, username: 'operator', password: '123', nama_lengkap: 'Operator Data Terpadu', email: 'operator@sidoarjo.go.id', role: 'operator', is_active: true, created_at: '2026-01-01' },
  { id: 5, username: 'kepala_dinsos', password: '123', nama_lengkap: 'Kepala Dinas Sosial Sidoarjo', email: 'kadinsos@sidoarjo.go.id', role: 'admin', is_active: true, created_at: '2026-01-01' }
];

export const DATA_MASTER_SIDOARJO: MasterSeedTuple[] = [
  ['3515011002850001', 'SUTRISNO HADI', 'Sidoarjo', '1985-02-10', 'Jl. Raya Waru No. 14, RT 02/RW 01, Kec. Waru', '081234567001', 'sutrisno@mail.com', '-7.3524', '112.7245', 950000.0, 2500000.0, 54, 1, 4, 2, 2, 3, 1, 2, true, 'Disetujui', 'Belum Salur', 'Keluarga rentan prasejahtera'],
  ['3515022507900002', 'SITI AMINAH', 'Sidoarjo', '1983-02-01', 'Dusun Badas, RT 04/RW 02, Barengkrajan, Kec. Krian', '081234567002', 'siti@mail.com', '-7.4082', '112.5831', 800000.0, 1500000.0, 48, 2, 3, 3, 2, 3, 1, 1, true, 'Disetujui', 'Telah Menerima', 'Lansia tunggal tanggungan anak'],
  ['3515031505880003', 'BAMBANG PAMUNGKAS', 'Sidoarjo', '1988-05-15', 'Desa Cemandi, RT 08/RW 03, Kec. Sedati', '081234567003', 'bambang@mail.com', '-7.3821', '112.7756', 1100000.0, 3200000.0, 42, 1, 5, 2, 3, 2, 2, 1, true, 'Disetujui', 'Belum Salur', 'Pekerja serabutan pesisir'],
  ['3515040909770004', 'RUDI HERMAWAN', 'Sidoarjo', '1977-09-09', 'Jl. Gajah Mada No. 45, RT 01/RW 05, Kec. Sidoarjo', '081234567004', 'rudi@mail.com', '-7.4478', '112.7183', 1300000.0, 4000000.0, 49, 1, 3, 2, 1, 2, 2, 1, true, 'Disetujui', 'Telah Menerima', 'Buruh pabrik harian lepas'],
  ['3515051812830005', 'KARTINI WULANDARI', 'Sidoarjo', '1983-12-18', 'Desa Kebonagung, RT 03/RW 01, Kec. Porong', '081234567005', 'kartini@mail.com', '-7.5451', '112.6987', 700000.0, 1200000.0, 58, 2, 2, 3, 0, 3, 1, 2, true, 'Disetujui', 'Telah Menerima', 'Warga terdampak tanggul'],
  ['3515060403920006', 'ACHMAD FAUZI', 'Sidoarjo', '1992-03-04', 'Kelurahan Geluran, RT 05/RW 02, Kec. Taman', '081234567006', 'fauzi@mail.com', '-7.3621', '112.6954', 1400000.0, 4500000.0, 39, 1, 4, 2, 2, 2, 3, 1, false, 'Menunggu', 'Belum Salur', 'Pekerja sektor informal'],
  ['3515072010860007', 'ENDANG SUNARMI', 'Sidoarjo', '1986-10-20', 'Desa Sepande, RT 02/RW 04, Kec. Candi', '081234567007', 'endang@mail.com', '-7.4721', '112.7142', 850000.0, 2000000.0, 51, 2, 3, 3, 1, 3, 1, 1, true, 'Disetujui', 'Belum Salur', 'Pedagang keliling skala mikro'],
  ['3515081111810008', 'JOKO PRASETYO', 'Sidoarjo', '1981-11-11', 'Desa Pekarungan, RT 06/RW 02, Kec. Sukodono', '081234567008', 'joko@mail.com', '-7.4112', '112.6789', 1250000.0, 3800000.0, 44, 1, 4, 2, 2, 2, 2, 1, false, 'Menunggu', 'Belum Salur', 'Keluarga anak usia sekolah'],
  ['3515090101750009', 'SUHARTONO', 'Sidoarjo', '1975-01-01', 'Desa Kalitengah, RT 03/RW 03, Kec. Tanggulangin', '081234567009', 'suhartono@mail.com', '-7.5089', '112.7121', 900000.0, 2200000.0, 56, 1, 3, 2, 1, 3, 1, 2, true, 'Disetujui', 'Telah Menerima', 'Pengrajin rumahan musiman'],
  ['3515101408890010', 'NURUL HIDAYATI', 'Sidoarjo', '1989-08-14', 'Desa Kraton, RT 02/RW 01, Kec. Krian', '081234567010', 'nurul@mail.com', '-7.3995', '112.5921', 750000.0, 1800000.0, 47, 2, 4, 3, 3, 3, 1, 1, true, 'Disetujui', 'Laporan Sengketa', 'Bansos sembako belum diterima padahal status layak.'],
  ['3515112204930011', 'ARIF BUDIMAN', 'Sidoarjo', '1993-04-22', 'Desa Tambaksumur, RT 05/RW 02, Kec. Waru', '081234567011', 'arif@mail.com', '-7.3456', '112.7612', 1500000.0, 5200000.0, 36, 1, 2, 2, 1, 2, 3, 1, false, 'Menunggu', 'Belum Salur', 'Verifikasi mandiri bansos'],
  ['3515121606820012', 'SRI WAHYUNI', 'Sidoarjo', '1982-06-16', 'Desa Urangagung, RT 04/RW 03, Kec. Sidoarjo', '081234567012', 'sri@mail.com', '-7.4567', '112.6934', 820000.0, 1900000.0, 52, 2, 3, 2, 1, 3, 1, 2, true, 'Disetujui', 'Telah Menerima', 'Keluarga rentan penyakit kronis']
];

export let wargaStore: WargaItem[] = [];
export let wargaBackupStore: WargaItem[] = [];

export function setWargaStore(newList: WargaItem[]) {
  wargaStore = newList;
}

export function setWargaBackupStore(newList: WargaItem[]) {
  wargaBackupStore = newList;
}

export let notifikasiStore: NotifikasiItem[] = [
  {
    id: 1,
    pesan: '[Sistem] Sinkronisasi basis data kependudukan Kabupaten Sidoarjo aktif.',
    kategori: 'sistem',
    role_sender: 'Sistem',
    waktu: 'Hari ini',
    is_read: true,
    is_pinned: true,
    is_archived: false
  },
  {
    id: 2,
    pesan: '🚨 [Keamanan] Audit algoritma BWM-SAW selesai diverifikasi.',
    kategori: 'info',
    role_sender: 'Sistem',
    waktu: 'Hari ini',
    is_read: false,
    is_pinned: false,
    is_archived: false
  }
];

export function setNotifikasiStore(newList: NotifikasiItem[]) {
  notifikasiStore = newList;
}

export const pengaduanStore: PengaduanItem[] = [
  {
    id: 1,
    nik: '3515101408890010',
    nama: 'NURUL HIDAYATI',
    nama_pelapor: 'NURUL HIDAYATI',
    kategori: 'Sengketa Penyaluran Bansos',
    uraian: 'Bansos sembako belum diterima padahal status verifikasi dinyatakan layak pada desil 1.',
    deskripsi: 'Bansos sembako belum diterima padahal status verifikasi dinyatakan layak pada desil 1.',
    isi_laporan: 'Bansos sembako belum diterima padahal status verifikasi dinyatakan layak pada desil 1.',
    status: 'Tahap Mediasi',
    status_step: 2,
    status_text: 'Tahap Mediasi',
    catatan_petugas: 'Sedang dalam proses verifikasi oleh tim mediasi Dinas Sosial Kabupaten Sidoarjo.',
    waktu: 'Hari ini'
  }
];

export const chatStore: ChatItem[] = [
  {
    id: 1,
    nik: '3515101408890010',
    sender: 'warga',
    nama: 'NURUL HIDAYATI',
    pesan: 'Selamat pagi petugas Dinsos, saya ingin menanyakan status bantuan sembako saya yang belum disalurkan.',
    text: 'Selamat pagi petugas Dinsos, saya ingin menanyakan status bantuan sembako saya yang belum disalurkan.',
    file_path: null,
    file_type: null,
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: '08:30',
    created_at: '2026-09-27 08:30'
  },
  {
    id: 2,
    nik: '3515101408890010',
    sender: 'petugas',
    nama: 'Petugas Dinsos Sidoarjo',
    pesan: 'Selamat pagi Ibu Nurul, laporan Anda telah kami terima dan sedang kami koordinasikan dengan koordinator penyalur Kecamatan Krian.',
    text: 'Selamat pagi Ibu Nurul, laporan Anda telah kami terima dan sedang kami koordinasikan dengan koordinator penyalur Kecamatan Krian.',
    file_path: null,
    file_type: null,
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: '08:35',
    created_at: '2026-09-27 08:35'
  },
  {
    id: 3,
    nik: '3515101408890010',
    sender: 'petugas',
    nama: 'Petugas Dinsos Sidoarjo',
    pesan: 'Berikut kami lampirkan dokumen Surat Keputusan Verifikasi Penerima Bantuan Sosial Kabupaten Sidoarjo tahun 2026.',
    text: 'Berikut kami lampirkan dokumen Surat Keputusan Verifikasi Penerima Bantuan Sosial Kabupaten Sidoarjo tahun 2026.',
    file_path: '/uploads/1790940052691_data_hasil_saw.pdf',
    file_name: 'Surat_Keputusan_Verifikasi_Bansos_2026.pdf',
    file_size: 245760,
    file_type: 'document',
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '👍',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: '08:40',
    created_at: '2026-09-27 08:40'
  },
  {
    id: 4,
    nik: '3515101408890010',
    sender: 'petugas',
    nama: 'Petugas Dinsos Sidoarjo',
    pesan: 'Ini berkas lembar kerja spreadsheet data rekapitulasi penyaluran sembako per desa di Kecamatan Krian.',
    text: 'Ini berkas lembar kerja spreadsheet data rekapitulasi penyaluran sembako per desa di Kecamatan Krian.',
    file_path: '/uploads/1790940052706_data_100_warga_sidoarjo.xlsx',
    file_name: 'Rekapitulasi_Salur_Bansos_Kecamatan_Krian.xlsx',
    file_size: 512000,
    file_type: 'document',
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: '08:42',
    created_at: '2026-09-27 08:42'
  },
  {
    id: 5,
    nik: '3515101408890010',
    sender: 'petugas',
    nama: 'Petugas Dinsos Sidoarjo',
    pesan: 'Dan ini formulir berkas panduan persyaratan administrasi pencairan bantuan sosial format Microsoft Word.',
    text: 'Dan ini formulir berkas panduan persyaratan administrasi pencairan bantuan sosial format Microsoft Word.',
    file_path: '/uploads/1790940052707_Data_Dummy_20_Kriteria.docx',
    file_name: 'Panduan_Administrasi_Pencairan_Bansos.docx',
    file_size: 184320,
    file_type: 'document',
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: '08:45',
    created_at: '2026-09-27 08:45'
  }
];

export const laporanPelanggaranStore: LaporanPelanggaranItem[] = [
  {
    id: 1,
    kode_laporan: 'VIO-2026-001',
    msg_id: 101,
    nik: '3515101408890010',
    nama_terlapor: 'Oknum Penyalur Lapangan',
    sender_terlapor: 'petugas',
    pesan_kutipan: 'Kalau mau proses bantuan sembako Anda cepat keluar, ada biaya administrasi lapangan Rp 50.000.',
    alasan: 'Pungutan Liar / Indikasi Gratifikasi',
    kategori: 'Pungutan Liar (Pungli)',
    deskripsi: 'Warga dimintai biaya administrasi ilegal untuk pencairan bansos sembako.',
    pelapor_role: 'warga',
    pelapor_nama: 'NURUL HIDAYATI',
    pelapor_nik: '3515101408890010',
    status: 'Dalam Investigasi',
    tindakan_petugas: 'Pemanggilan petugas lapangan terkait oleh tim pengawas Dinsos Kab. Sidoarjo.',
    petugas_penindak: 'Administrator Utama (Super Admin)',
    waktu_tindakan: '28/09/2026 10:15',
    waktu: '28/09/2026 09:40',
    created_at: '2026-09-28 09:40'
  },
  {
    id: 2,
    kode_laporan: 'VIO-2026-002',
    msg_id: 102,
    nik: '3515081111810008',
    nama_terlapor: 'JOKO PRASETYO',
    sender_terlapor: 'warga',
    pesan_kutipan: 'Dasar petugas tidak becus, saya tahu kantor kalian di mana awas saja kalau tidak cair hari ini!',
    alasan: 'Kata-kata Kasar & Ancaman Intimidasi',
    kategori: 'Kata-kata Kasar / Pelecehan',
    deskripsi: 'Pesan bernada intimidasi dan ancaman terhadap petugas piket verifikasi.',
    pelapor_role: 'petugas',
    pelapor_nama: 'Petugas Lapangan Dinsos',
    pelapor_nik: 'PETUGAS-02',
    status: 'Terbukti Melanggar',
    tindakan_petugas: 'Peringatan tingkat 1 disampaikan ke akun warga; pesan dinonaktifkan dari ruang obrolan.',
    petugas_penindak: 'Administrator Utama (Super Admin)',
    waktu_tindakan: '29/09/2026 14:20',
    waktu: '29/09/2026 13:50',
    created_at: '2026-09-29 13:50'
  }
];

export function nowTimeStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function catatNotifikasi(pesan: string, roleSender = 'Sistem', kategori = 'info') {
  const nextId = notifikasiStore.length > 0 ? Math.max(...notifikasiStore.map(n => n.id)) + 1 : 1;
  const formattedMsg = pesan.startsWith('[') ? pesan : `[${roleSender}] ${pesan}`;
  notifikasiStore.unshift({
    id: nextId,
    pesan: formattedMsg,
    kategori,
    role_sender: roleSender,
    waktu: nowTimeStr(),
    is_read: false,
    is_pinned: false,
    is_archived: false
  });
}

export function formatWarga(w: WargaItem) {
  const result: Record<string, unknown> = {
    id: w.id,
    nik: w.nik,
    nama: w.nama,
    nama_lengkap: w.nama,
    tempat_lahir: w.tempat_lahir || 'Sidoarjo',
    tanggal_lahir: w.tanggal_lahir || '',
    alamat: w.alamat || 'Kabupaten Sidoarjo',
    no_hp: w.no_hp || '',
    email: w.email || '',
    lat: w.lat,
    lng: w.lng,
    c1: w.c1,
    c2: w.c2,
    c3: w.c3,
    c4: w.c4,
    c5: w.c5,
    c6: w.c6,
    c7: w.c7,
    c8: w.c8,
    c9: w.c9,
    c10: w.c10,
    c1_ekonomi: w.c1,
    c2_aset: w.c2,
    c3_umur: w.c3,
    c4_jenis_kelamin: w.c4,
    c5_tanggungan: w.c5,
    c6_status_pernikahan: w.c6,
    c7_kepemilikan_anak: w.c7,
    c8_tempat_tinggal: w.c8,
    c9_pendidikan: w.c9,
    c10_kesehatan: w.c10,
    desil: w.desil,
    is_layak: w.desil <= 4,
    skor_saw: Number(w.skor_saw.toFixed(4)),
    rank_saw: w.rank_saw,
    is_verified: Boolean(w.is_verified),
    status_validasi: w.status_validasi || (w.is_verified ? 'Disetujui' : 'Menunggu'),
    status_salur: w.status_salur || 'Belum Salur',
    status_bansos: w.status_bansos || (w.desil <= 4 ? 'Layak Bansos' : 'Tidak Menerima'),
    prioritas: w.prioritas || (w.desil <= 4 ? 'Prioritas Utama' : 'Tidak Prioritas'),
    bukti_salur: w.bukti_salur || '',
    keterangan_salur: w.keterangan_salur || '',
    konfirmasi_warga: Boolean(w.konfirmasi_warga),
    waktu_konfirmasi_warga: w.waktu_konfirmasi_warga || '',
    catatan: w.catatan || '',
    nominal_bantuan: w.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg',
    tanggal_salur: w.tanggal_salur || '-',
    created_at: w.created_at || 'Hari ini',
    extra_data: w.extra_data || {}
  };

  if (w.extra_data && typeof w.extra_data === 'object') {
    Object.keys(w.extra_data).forEach(k => {
      if (!(k in result)) {
        result[k] = (w.extra_data as any)[k];
      }
    });
  }

  const standardKeySet = new Set(Object.keys(result));
  Object.keys(w).forEach(k => {
    if (!standardKeySet.has(k) && !k.startsWith('_')) {
      result[k] = (w as any)[k];
    }
  });

  return result;
}

export function makeJwtToken(user: { id: number; username: string; role: string }) {
  return createSecureJwt(user);
}
