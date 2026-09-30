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
}

export interface ChatItem {
  id: number;
  nik: string;
  sender: string;
  nama: string;
  pesan: string | null;
  text: string | null;
  file_path: string | null;
  file_type: string | null;
  reply_sender: string | null;
  reply_text: string | null;
  reply_to_id: number | null;
  reaction: string;
  is_pinned: boolean;
  is_deleted_all: boolean;
  deleted_for: string | null;
  waktu: string;
  created_at: string;
}

export type MasterSeedTuple = [
  string, string, string, string, string, string, string, string, string,
  number, number, number, number, number, number, number, number, number, number,
  boolean, string, string, string
];
