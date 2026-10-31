export interface KriteriaItem {
  id: number;
  kode: string;
  nama: string;
  bobot: number;
  tipe: 'cost' | 'benefit';
  jenis: 'cost' | 'benefit';
}

export interface UserItem {
  id: number;
  username: string;
  password: string;
  previous_passwords?: string[];
  nama_lengkap: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface WargaItem {
  id: number;
  nik: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat: string;
  no_hp: string;
  email: string;
  lat: number;
  lng: number;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  c7: number;
  c8: number;
  c9: number;
  c10: number;
  desil: number;
  skor_saw: number;
  rank_saw: number;
  is_verified: boolean;
  status_validasi: string;
  status_salur: string;
  status_bansos: string;
  prioritas: string;
  bukti_salur: string;
  keterangan_salur?: string;
  tanggal_salur: string;
  konfirmasi_warga?: boolean;
  waktu_konfirmasi_warga?: string;
  catatan: string;
  nominal_bantuan: string;
  created_at: string;
  extra_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NotifikasiItem {
  id: number;
  pesan: string;
  kategori: string;
  role_sender: string;
  waktu: string;
  is_read: boolean;
  is_pinned: boolean;
  is_archived: boolean;
}

export interface PengaduanItem {
  id: number;
  nik: string;
  nama: string;
  nama_pelapor: string;
  kategori: string;
  uraian: string;
  deskripsi: string;
  isi_laporan: string;
  status: string;
  status_step: number;
  status_text: string;
  catatan_petugas: string;
  waktu: string;
  eskalasi_ke_superadmin?: boolean;
  alasan_eskalasi?: string;
  urgensi_eskalasi?: string;
  diteruskan_oleh?: string;
  waktu_eskalasi?: string;
  status_superadmin?: string;
  putusan_superadmin?: string;
  audit_kode_terkait?: string;
  waktu_putusan_superadmin?: string;
  created_at?: string;
  riwayat_penanganan?: any[];
}

export interface ChatItem {
  id: number;
  nik: string;
  sender: string;
  nama: string;
  pesan: string | null;
  text: string | null;
  file_path: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type: string | null;
  reply_sender: string | null;
  reply_text: string | null;
  reply_to_id: number | null;
  reaction: string;
  is_pinned: boolean;
  is_starred?: boolean;
  is_deleted_all: boolean;
  deleted_for: string | null;
  waktu: string;
  created_at: string;
  is_read?: boolean;
  read_at?: string | null;
  delivered_at?: string | null;
  is_handover?: boolean;
  [key: string]: unknown;
}

export interface LaporanPelanggaranItem {
  id: number;
  kode_laporan: string;
  msg_id: number;
  nik: string;
  nama_terlapor: string;
  sender_terlapor: string;
  pesan_kutipan: string;
  alasan: string;
  kategori: string;
  deskripsi: string;
  tipe_laporan?: 'pesan_tunggal' | 'keseluruhan_obrolan';
  transkrip?: any[];
  total_pesan?: number;
  pelapor_role: 'warga' | 'petugas' | 'admin';
  pelapor_nama: string;
  pelapor_nik: string;
  status: 'Menunggu Peninjauan' | 'Dalam Investigasi' | 'Terbukti Melanggar' | 'Ditolak/Bukan Pelanggaran' | 'Selesai Ditangani';
  tindakan_petugas?: string;
  petugas_penindak?: string;
  waktu_tindakan?: string;
  waktu: string;
  created_at: string;
}

export type MasterSeedTuple = [
  string, string, string, string, string, string, string, string, string,
  number, number, number, number, number, number, number, number, number, number,
  boolean, string, string, string
];


export type MutasiKategori =
  | 'pindah_tempat_tinggal'
  | 'pindah_alamat'
  | 'pindah_kota'
  | 'meninggal'
  | 'ekonomi_memburuk'
  | 'ekonomi_membaik'
  | 'warga_baru'
  | 'dihapus'
  | 'tetap';

export interface KriteriaDinamisItemDef {
  nomor: number;
  kode: string;
  key: string;
  nama: string;
  kelompok: string;
  satuan: string;
  arah_kerentanan: 'turun_memburuk' | 'naik_memburuk';
  nilai_default: number;
  tipe_input: 'number' | 'select';
  opsi?: Array<{ value: number; label: string }>;
}

export interface RekapKriteriaSnapshot {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  c7: number;
  c8: number;
  c9: number;
  c10: number;
  [key: string]: number | undefined;
}

export interface RincianPenyaluranTahapItem {
  tahap_ke: 1 | 2 | 3 | 4;
  kode_tahap: string;
  nama_tahap: string;
  periode_bulan: string;
  tanggal_salur: string;
  nominal: number;
  nominal_label: string;
  bentuk_bantuan: string;
  status_salur: string;
}

export interface RekapMutasiItem {
  id_rekap_item: string;
  nik: string;
  nama: string;
  email_warga?: string;
  kecamatan?: string;
  kelurahan_desa?: string;
  kategori_utama: MutasiKategori;
  kategori_list: MutasiKategori[];
  label_perubahan: string[];
  alamat_lama: string;
  alamat_baru: string;
  tempat_tinggal_lama: string;
  tempat_tinggal_baru: string;
  kota_lama: string;
  kota_baru: string;
  status_kependudukan: 'Aktif' | 'Pindah Alamat' | 'Pindah Tempat Tinggal' | 'Pindah Kota' | 'Meninggal Dunia' | 'Warga Baru';
  kondisi_ekonomi_status: 'Memburuk' | 'Membaik' | 'Tetap' | 'Baru' | 'Non-Aktif';
  kriteria_lama: RekapKriteriaSnapshot | null;
  kriteria_baru: RekapKriteriaSnapshot;
  rincian_perubahan_kriteria: string[];
  skor_saw_lama: number;
  skor_saw_baru: number;
  desil_lama: number;
  desil_baru: number;
  arah_desil: 'turun_prioritas_naik' | 'naik_graduasi' | 'nonaktif_mutasi' | 'tetap' | 'baru';
  keterangan_desil_otomatis: string;
  status_bansos_lama: string;
  status_bansos_baru: string;
  status_salur_baru: string;
  catatan_perubahan: string;
  waktu_rekap: string;
  penyaluran_awal_periode?: string;
  nominal_penyaluran_awal?: number;
  nominal_penyaluran_awal_label?: string;
  bentuk_bantuan_awal?: string;
  penyaluran_akhir_periode?: string;
  nominal_penyaluran_akhir?: number;
  nominal_penyaluran_akhir_label?: string;
  bentuk_bantuan_akhir?: string;
  total_nominal_awal_sampai_akhir?: number;
  total_nominal_awal_sampai_akhir_label?: string;
  rincian_tahap_penyaluran?: RincianPenyaluranTahapItem[];
}

export interface JadwalInputStatus {
  tanggal_aktif: string;
  hari_ke: number;
  bulan_angka: number;
  nama_bulan: string;
  tahun: number;
  triwulan_ke: 1 | 2 | 3 | 4;
  kode_triwulan: string;
  nama_triwulan: string;
  rentang_triwulan: string;
  jadwal_penyaluran: string;
  kode_jendela: 'UTAMA_1_10' | 'SEBELUM_26' | 'TUTUP_26_PLUS';
  nama_jendela: string;
  status_buka: boolean;
  is_override: boolean;
  mode_simulasi: 'realtime' | 'tgl_1_10' | 'tgl_11_25' | 'tgl_26_plus';
  pesan_jadwal: string;
  aturan_resmi: string;
}

export interface RekapPeriodeReport {
  id: string;
  kode_periode: string;
  nama_periode: string;
  triwulan_ke: 1 | 2 | 3 | 4;
  nama_triwulan: string;
  rentang_bulan: string;
  jadwal_penyaluran: string;
  tahun: number;
  sumber_pembaruan: string;
  waktu_rekap: string;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  jadwal_status: JadwalInputStatus;
  total_data_lama: number;
  total_data_baru: number;
  ringkasan: {
    total_berubah: number;
    pindah_tempat_tinggal: number;
    pindah_alamat: number;
    pindah_kota: number;
    meninggal: number;
    ekonomi_memburuk: number;
    ekonomi_membaik: number;
    warga_baru: number;
    tetap: number;
    desil_diturunkan_prioritas: number;
    desil_graduasi_mandiri: number;
    desil_dihentikan_mutasi: number;
    layak_penyaluran_triwulan: number;
    total_nominal_penyaluran_awal?: number;
    total_nominal_penyaluran_akhir?: number;
    total_akumulasi_penyaluran_awal_akhir?: number;
  };
  items: RekapMutasiItem[];
}


export interface LogPanggilanItem {
  id: number;
  caller_id: string;
  caller_name: string;
  caller_role: 'warga' | 'petugas' | 'admin' | 'superadmin' | 'sistem';
  callee_id: string;
  callee_name: string;
  callee_role: 'warga' | 'petugas' | 'admin' | 'superadmin';
  nik_warga?: string;
  tipe_panggilan: 'audio' | 'video';
  status: 'selesai' | 'tidak_terjawab' | 'ditolak' | 'berlangsung';
  durasi_detik: number;
  waktu_mulai: string;
  waktu_selesai?: string;
  catatan?: string;
  created_at: string;
}

export interface SpkMetrikPerhitunganItem {
  id: number;
  kode_perhitungan: string;
  tahun: number;
  triwulan_ke: number;
  metode: string;
  total_warga: number;
  total_layak: number;
  is_published: boolean;
  published_at?: string | null;
  published_by?: string | null;
  bobot_kriteria: any[];
  skor_dan_ranking: any[];
  created_at: string;
  updated_at?: string;
}

export interface SkBupatiItem {
  id: number;
  nomor_sk: string;
  tahun: number;
  judul_sk: string;
  tentang: string;
  tanggal_penetapan: string;
  nama_bupati: string;
  nama_kadinsos: string;
  total_kpm: number;
  total_anggaran: string;
  is_published: boolean;
  published_at?: string | null;
  published_by?: string | null;
  daftar_penerima?: any[];
  created_at: string;
  updated_at?: string;
}
