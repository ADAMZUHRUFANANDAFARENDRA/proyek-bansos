import type {
  WargaItem,
  MutasiKategori,
  KriteriaDinamisItemDef,
  RekapKriteriaSnapshot,
  RekapMutasiItem,
  RincianPenyaluranTahapItem,
  JadwalInputStatus,
  RekapPeriodeReport
} from './types.js';
import {
  wargaStore,
  catatNotifikasi,
  nowTimeStr
} from './store.js';
import {
  parseFloatSafe,
  parseIntSafe,
  hitungDanSinkronkanSawBwm
} from './spk_engine.js';

// ============================================================================
// KATALOG DINAMIS KRITERIA C1 S/D C39 (+ EKSTENSIBILITAS MASA DEPAN C40+)
// ============================================================================
export const katalogKriteriaDinamis: KriteriaDinamisItemDef[] = [
  // KELOMPOK 1: KRITERIA UTAMA SPK BWM-SAW (C1 - C10)
  {
    nomor: 1, kode: 'C1', key: 'c1', nama: 'Penghasilan Kepala Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Rp/Bulan', arah_kerentanan: 'turun_memburuk', nilai_default: 1200000, tipe_input: 'number'
  },
  {
    nomor: 2, kode: 'C2', key: 'c2', nama: 'Total Nilai Aset Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Rp', arah_kerentanan: 'turun_memburuk', nilai_default: 3500000, tipe_input: 'number'
  },
  {
    nomor: 3, kode: 'C3', key: 'c3', nama: 'Usia Kepala Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Tahun', arah_kerentanan: 'naik_memburuk', nilai_default: 45, tipe_input: 'number'
  },
  {
    nomor: 4, kode: 'C4', key: 'c4', nama: 'Kondisi Fisik / Lantai Bangunan', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Keramik / Layak' }, { value: 2, label: '2 - Plester Semen / Sedang' }, { value: 3, label: '3 - Tanah / Bambu Rusak' }]
  },
  {
    nomor: 5, kode: 'C5', key: 'c5', nama: 'Jumlah Tanggungan Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Jiwa', arah_kerentanan: 'naik_memburuk', nilai_default: 3, tipe_input: 'number'
  },
  {
    nomor: 6, kode: 'C6', key: 'c6', nama: 'Status Pernikahan Kepala Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Status', arah_kerentanan: 'naik_memburuk', nilai_default: 2, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Belum Menikah' }, { value: 2, label: '2 - Menikah' }, { value: 3, label: '3 - Cerai Hidup / Cerai Mati (Janda/Duda)' }]
  },
  {
    nomor: 7, kode: 'C7', key: 'c7', nama: 'Jumlah Anak Sekolah / Balita', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Anak', arah_kerentanan: 'naik_memburuk', nilai_default: 2, tipe_input: 'number'
  },
  {
    nomor: 8, kode: 'C8', key: 'c8', nama: 'Status Kepemilikan Tempat Tinggal', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Status Hunian', arah_kerentanan: 'naik_memburuk', nilai_default: 2, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Milik Sendiri (Layak)' }, { value: 2, label: '2 - Sewa / Kontrak' }, { value: 3, label: '3 - Menumpang / Tidak Layak' }]
  },
  {
    nomor: 9, kode: 'C9', key: 'c9', nama: 'Tingkat Pendidikan Kepala Keluarga', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Jenjang', arah_kerentanan: 'turun_memburuk', nilai_default: 2, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Tidak Sekolah / SD' }, { value: 2, label: '2 - SMP Sederajat' }, { value: 3, label: '3 - SMA / SMK' }, { value: 4, label: '4 - Diploma / Sarjana' }]
  },
  {
    nomor: 10, kode: 'C10', key: 'c10', nama: 'Kondisi Kesehatan & Disabilitas', kelompok: 'C1–C10 (Utama SPK)',
    satuan: 'Kondisi', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Sehat' }, { value: 2, label: '2 - Sakit Menahun / Disabilitas' }, { value: 3, label: '3 - Disabilitas Berat / Kritis' }]
  },

  // KELOMPOK 2: HUNIAN, ENERGI, SANITASI & PANGAN (C11 - C20)
  {
    nomor: 11, kode: 'C11', key: 'c11', nama: 'Daya Listrik Rumah Tangga', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - >= 1300 VA (Mampu)' }, { value: 2, label: '2 - 450 VA / 900 VA Subsidi' }, { value: 3, label: '3 - Menumpang Listrik / Tanpa Listrik' }]
  },
  {
    nomor: 12, kode: 'C12', key: 'c12', nama: 'Bahan Bakar Utama Memasak', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Gas LPG 12 Kg / Listrik' }, { value: 2, label: '2 - Gas LPG 3 Kg Subsidi' }, { value: 3, label: '3 - Kayu Bakar / Arang / Minyak Tanah' }]
  },
  {
    nomor: 13, kode: 'C13', key: 'c13', nama: 'Fasilitas Sanitasi / Jamban Keluarga', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Jamban Sendiri Septic Tank' }, { value: 2, label: '2 - MCK Komunal / Bersama' }, { value: 3, label: '3 - Tidak Ada / Sungai' }]
  },
  {
    nomor: 14, kode: 'C14', key: 'c14', nama: 'Jenis Dinding Bangunan Rumah', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Tembok Bata Plester Utuh' }, { value: 2, label: '2 - Setengah Tembok / Kayu Biasa' }, { value: 3, label: '3 - Bambu / Anyaman / Seng Lapuk' }]
  },
  {
    nomor: 15, kode: 'C15', key: 'c15', nama: 'Kondisi Atap Bangunan Rumah', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Genteng / Beton Layak' }, { value: 2, label: '2 - Asbes / Seng Tua' }, { value: 3, label: '3 - Bocor Parah / Rumbia / Rawan Ambruk' }]
  },
  {
    nomor: 16, kode: 'C16', key: 'c16', nama: 'Frekuensi Makan Pokok Harian', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - >= 3 Kali Sehari Terpenuhi' }, { value: 2, label: '2 - 2 Kali Sehari' }, { value: 3, label: '3 - <= 1 Kali Sehari (Rawan Pangan)' }]
  },
  {
    nomor: 17, kode: 'C17', key: 'c17', nama: 'Pemenuhan Gizi & Protein Keluarga', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Rutin Daging/Ikan/Telur Mingguan' }, { value: 2, label: '2 - Jarang (1-2x Sebulan)' }, { value: 3, label: '3 - Tidak Mampu Membeli Protein' }]
  },
  {
    nomor: 18, kode: 'C18', key: 'c18', nama: 'Kemampuan Membeli Pakaian Layak Tahunan', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Mampu >= 2 Stel/Tahun' }, { value: 2, label: '2 - Hanya 1 Stel/Tahun' }, { value: 3, label: '3 - Tidak Mampu Membeli Pakaian Baru' }]
  },
  {
    nomor: 19, kode: 'C19', key: 'c19', nama: 'Luas Lantai Hunian per Anggota KK', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'm²/Jiwa', arah_kerentanan: 'turun_memburuk', nilai_default: 12, tipe_input: 'number'
  },
  {
    nomor: 20, kode: 'C20', key: 'c20', nama: 'Akses Sumber Air Bersih & Minum', kelompok: 'C11–C20 (Hunian & Pangan)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - PDAM / Air Kemasan / Sumur Bersih' }, { value: 2, label: '2 - Sumur Bersama / Pompa Komunal' }, { value: 3, label: '3 - Air Sungai / Sumur Tercemar' }]
  },

  // KELOMPOK 3: DEMOGRAFI, KESEHATAN & EKONOMI RUMAH TANGGA (C21 - C30)
  {
    nomor: 21, kode: 'C21', key: 'c21', nama: 'Jumlah Lansia (>= 60 Tahun) dalam KK', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Jiwa', arah_kerentanan: 'naik_memburuk', nilai_default: 0, tipe_input: 'number'
  },
  {
    nomor: 22, kode: 'C22', key: 'c22', nama: 'Jumlah Ibu Hamil / Menyusui / Balita Stunting', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Jiwa', arah_kerentanan: 'naik_memburuk', nilai_default: 0, tipe_input: 'number'
  },
  {
    nomor: 23, kode: 'C23', key: 'c23', nama: 'Jumlah Anggota Disabilitas / Bedridden', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Jiwa', arah_kerentanan: 'naik_memburuk', nilai_default: 0, tipe_input: 'number'
  },
  {
    nomor: 24, kode: 'C24', key: 'c24', nama: 'Kepemilikan Jaminan Kesehatan (BPJS)', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - BPJS Mandiri Aktif' }, { value: 2, label: '2 - BPJS PBI Gratis Pemerintah' }, { value: 3, label: '3 - Tidak Punya Jaminan Kesehatan / Menunggak' }]
  },
  {
    nomor: 25, kode: 'C25', key: 'c25', nama: 'Beban Hutang Kebutuhan Pokok Rumah Tangga', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Tidak Memiliki Hutang Pokok' }, { value: 2, label: '2 - Hutang Warung / Koperasi Ringan' }, { value: 3, label: '3 - Terlilit Hutang Kebutuhan Pangan / Medis Berat' }]
  },
  {
    nomor: 26, kode: 'C26', key: 'c26', nama: 'Kepemilikan Kendaraan Bermotor', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Memiliki Mobil / >= 2 Motor Layak' }, { value: 2, label: '2 - Memiliki 1 Motor Kerja Tua' }, { value: 3, label: '3 - Tidak Punya Kendaraan Bermotor (Sepeda/Jalan)' }]
  },
  {
    nomor: 27, kode: 'C27', key: 'c27', nama: 'Kepemilikan Lahan Produktif / Ternak', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Memiliki Sawah / Tambak / Ternak Besar' }, { value: 2, label: '2 - Pekarangan Sempit / Unggas Kecil' }, { value: 3, label: '3 - Tidak Memiliki Lahan maupun Ternak' }]
  },
  {
    nomor: 28, kode: 'C28', key: 'c28', nama: 'Kepemilikan Tabungan / Dana Darurat', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Memiliki Tabungan >= Rp 2.000.000' }, { value: 2, label: '2 - Tabungan Kecil < Rp 500.000' }, { value: 3, label: '3 - Tidak Memiliki Tabungan Sama Sekali' }]
  },
  {
    nomor: 29, kode: 'C29', key: 'c29', nama: 'Rasio Pengeluaran Pangan terhadap Pendapatan', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - < 50% Penghasilan (Stabil)' }, { value: 2, label: '2 - 50% s/d 75% Penghasilan' }, { value: 3, label: '3 - > 80% Habis untuk Makan Pokok' }]
  },
  {
    nomor: 30, kode: 'C30', key: 'c30', nama: 'Keterjangkauan Fasilitas Kesehatan', kelompok: 'C21–C30 (Demografi & Ekonomi)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Mudah Diakses & Mampu Berobat' }, { value: 2, label: '2 - Terbatas Biaya Transportasi' }, { value: 3, label: '3 - Tidak Mampu Berobat ke Puskesmas/RS' }]
  },

  // KELOMPOK 4: KERENTANAN SOSIAL, LINGKUNGAN & INDIKATOR DINAMIS (C31 - C39)
  {
    nomor: 31, kode: 'C31', key: 'c31', nama: 'Kerentanan Banjir / Bencana Lingkungan Hunian', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Kawasan Aman Bebas Banjir' }, { value: 2, label: '2 - Genangan Musiman Ringan' }, { value: 3, label: '3 - Rawan Banjir Tahunan / Tanggul / Rob' }]
  },
  {
    nomor: 32, kode: 'C32', key: 'c32', nama: 'Status Kerentanan Khusus Kepala Keluarga', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - KK Produktif Normal' }, { value: 2, label: '2 - Perempuan Kepala Keluarga (PEKKA)' }, { value: 3, label: '3 - Lansia Tunggal Sebatang Kara / Sakit' }]
  },
  {
    nomor: 33, kode: 'C33', key: 'c33', nama: 'Anggota Keluarga Putus Sekolah (Usia 7–18 Thn)', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Anak', arah_kerentanan: 'naik_memburuk', nilai_default: 0, tipe_input: 'number'
  },
  {
    nomor: 34, kode: 'C34', key: 'c34', nama: 'Ketergantungan Biaya Pengobatan / Terapi Rutin', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Tidak Ada Pengobatan Rutin' }, { value: 2, label: '2 - Kontrol Bulanan Ringan' }, { value: 3, label: '3 - Cuci Darah / Terapi Kronis Rutin Biaya Tinggi' }]
  },
  {
    nomor: 35, kode: 'C35', key: 'c35', nama: 'Ketersediaan Sarana Kerja / Usaha Mandiri', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Memiliki Alat Usaha / Pekerjaan Tetap' }, { value: 2, label: '2 - Peralatan Kerja Sewa / Serabutan' }, { value: 3, label: '3 - Tidak Memiliki Alat Kerja & Menganggur' }]
  },
  {
    nomor: 36, kode: 'C36', key: 'c36', nama: 'Kepemilikan Peralatan Elektronik Dasar', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Kulkas, TV, Mesin Cuci Lengkap' }, { value: 2, label: '2 - Hanya TV / Kipas Angin Sederhana' }, { value: 3, label: '3 - Tidak Memiliki Elektronik Rumah Tangga' }]
  },
  {
    nomor: 37, kode: 'C37', key: 'c37', nama: 'Kondisi Pencahayaan & Ventilasi Rumah', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Sehat, Terang & Berventilasi Baik' }, { value: 2, label: '2 - Kurang Ventilasi / Lembab' }, { value: 3, label: '3 - Pengap, Gelap & Tidak Layak Huni' }]
  },
  {
    nomor: 38, kode: 'C38', key: 'c38', nama: 'Status Kehilangan Pekerjaan / Dampak PHK', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Pekerjaan Stabil / Tidak Terdampak' }, { value: 2, label: '2 - Jam Kerja / Omzet Turun >= 50%' }, { value: 3, label: '3 - Baru Terkena PHK / Usaha Bangkrut Total' }]
  },
  {
    nomor: 39, kode: 'C39', key: 'c39', nama: 'Indikator Kerentanan Sosial-Ekonomi Tambahan', kelompok: 'C31–C39 (Kerentanan & Dinamis)',
    satuan: 'Skala 1–3', arah_kerentanan: 'naik_memburuk', nilai_default: 1, tipe_input: 'select',
    opsi: [{ value: 1, label: '1 - Normal / Terkendali' }, { value: 2, label: '2 - Rentan Sedang (Perlu Pemantauan)' }, { value: 3, label: '3 - Sangat Rentan / Darurat Sosial' }]
  }
];

export function getKatalogKriteriaDinamis(): KriteriaDinamisItemDef[] {
  return katalogKriteriaDinamis;
}

export function tambahAtauUpdateKriteriaDinamis(payload: Partial<KriteriaDinamisItemDef>): KriteriaDinamisItemDef {
  const nomor = Number(payload.nomor) || (katalogKriteriaDinamis.length + 1);
  const kode = String(payload.kode || `C${nomor}`).toUpperCase().trim();
  const key = kode.toLowerCase();
  const existingIdx = katalogKriteriaDinamis.findIndex(k => k.kode === kode || k.nomor === nomor);

  const item: KriteriaDinamisItemDef = {
    nomor,
    kode,
    key,
    nama: String(payload.nama || `Kriteria Dinamis ${kode}`).trim(),
    kelompok: String(payload.kelompok || (nomor <= 10 ? 'C1–C10 (Utama SPK)' : nomor <= 20 ? 'C11–C20 (Hunian & Pangan)' : nomor <= 30 ? 'C21–C30 (Demografi & Ekonomi)' : 'C31–C39+ (Kerentanan & Dinamis)')).trim(),
    satuan: String(payload.satuan || 'Skala 1–3').trim(),
    arah_kerentanan: payload.arah_kerentanan === 'turun_memburuk' ? 'turun_memburuk' : 'naik_memburuk',
    nilai_default: Number(payload.nilai_default ?? 1),
    tipe_input: payload.tipe_input === 'number' ? 'number' : 'select',
    opsi: Array.isArray(payload.opsi) && payload.opsi.length > 0
      ? payload.opsi
      : (payload.tipe_input === 'number' ? undefined : [
          { value: 1, label: '1 - Baik / Mampu (Normal)' },
          { value: 2, label: '2 - Sedang / Cukup Rentan' },
          { value: 3, label: '3 - Buruk / Sangat Rentan (Prioritas)' }
        ])
  };

  if (existingIdx !== -1) {
    katalogKriteriaDinamis[existingIdx] = item;
  } else {
    katalogKriteriaDinamis.push(item);
    katalogKriteriaDinamis.sort((a, b) => a.nomor - b.nomor);
  }
  return item;
}

// ============================================================================
// KONFIGURASI JADWAL PENGINPUTAN BULANAN (TGL 1-10 / SEBELUM TGL 26)
// & SIKLUS PENYALURAN 3 BULAN SEKALI (TRIWULANAN + HISTORIS 20 TAHUN)
// ============================================================================
export interface JadwalConfigState {
  mode_simulasi: 'realtime' | 'tgl_1_10' | 'tgl_11_25' | 'tgl_26_plus';
  custom_day: number | null;
  custom_month: number | null;
  custom_year: number | null;
  allow_override: boolean;
  triwulan_aktif: 1 | 2 | 3 | 4 | null;
}

export const jadwalConfig: JadwalConfigState = {
  mode_simulasi: new Date().getDate() >= 26 ? 'tgl_1_10' : 'realtime',
  custom_day: null,
  custom_month: null,
  custom_year: null,
  allow_override: true,
  triwulan_aktif: null
};

const NAMA_BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getInfoTriwulan(bulan1Based: number, tahun: number) {
  const b = Math.min(12, Math.max(1, bulan1Based));
  if (b <= 3) {
    return {
      triwulan_ke: 1 as const,
      kode_triwulan: `TW1-${tahun}`,
      nama_triwulan: 'Triwulan I (Tahap 1)',
      rentang_triwulan: `Januari – Maret ${tahun}`,
      jadwal_penyaluran: `Maret ${tahun} (Penyaluran 3 Bulan Sekali - Tahap 1)`
    };
  }
  if (b <= 6) {
    return {
      triwulan_ke: 2 as const,
      kode_triwulan: `TW2-${tahun}`,
      nama_triwulan: 'Triwulan II (Tahap 2)',
      rentang_triwulan: `April – Juni ${tahun}`,
      jadwal_penyaluran: `Juni ${tahun} (Penyaluran 3 Bulan Sekali - Tahap 2)`
    };
  }
  if (b <= 9) {
    return {
      triwulan_ke: 3 as const,
      kode_triwulan: `TW3-${tahun}`,
      nama_triwulan: 'Triwulan III (Tahap 3)',
      rentang_triwulan: `Juli – September ${tahun}`,
      jadwal_penyaluran: `September ${tahun} (Penyaluran 3 Bulan Sekali - Tahap 3)`
    };
  }
  return {
    triwulan_ke: 4 as const,
    kode_triwulan: `TW4-${tahun}`,
    nama_triwulan: 'Triwulan IV (Tahap 4)',
    rentang_triwulan: `Oktober – Desember ${tahun}`,
    jadwal_penyaluran: `Desember ${tahun} (Penyaluran 3 Bulan Sekali - Tahap 4)`
  };
}

export function getJadwalInputStatus(): JadwalInputStatus {
  const now = new Date();
  let day = jadwalConfig.custom_day ?? now.getDate();
  let month = jadwalConfig.custom_month ?? (now.getMonth() + 1);
  const year = jadwalConfig.custom_year ?? now.getFullYear();

  if (jadwalConfig.mode_simulasi === 'tgl_1_10') {
    day = jadwalConfig.custom_day && jadwalConfig.custom_day >= 1 && jadwalConfig.custom_day <= 10 ? jadwalConfig.custom_day : 5;
  } else if (jadwalConfig.mode_simulasi === 'tgl_11_25') {
    day = jadwalConfig.custom_day && jadwalConfig.custom_day >= 11 && jadwalConfig.custom_day <= 25 ? jadwalConfig.custom_day : 18;
  } else if (jadwalConfig.mode_simulasi === 'tgl_26_plus') {
    day = jadwalConfig.custom_day && jadwalConfig.custom_day >= 26 ? jadwalConfig.custom_day : 27;
  }

  if (jadwalConfig.triwulan_aktif) {
    const targetTw = jadwalConfig.triwulan_aktif;
    const curTw = Math.ceil(month / 3);
    if (curTw !== targetTw) {
      month = (targetTw - 1) * 3 + 1;
    }
  }

  const namaBulan = NAMA_BULAN_ID[month - 1] || 'Oktober';
  const tw = getInfoTriwulan(month, year);

  let kode_jendela: 'UTAMA_1_10' | 'SEBELUM_26' | 'TUTUP_26_PLUS' = 'UTAMA_1_10';
  let nama_jendela = 'Periode Utama Penginputan (Tanggal 1 – 10)';
  let status_buka = true;
  let pesan_jadwal = `Penginputan & pemutakhiran data warga sedang dibuka pada Periode Utama (Tanggal ${day} ${namaBulan} ${year}).`;

  if (day >= 1 && day <= 10) {
    kode_jendela = 'UTAMA_1_10';
    nama_jendela = 'Periode Utama Input Bulanan (Tgl 1 – 10)';
    status_buka = true;
    pesan_jadwal = `Jendela Utama Aktif (Tanggal ${day} ${namaBulan} ${year}): Penginputan data baru & pembaruan data lama sangat direkomendasikan pada tanggal 1 s/d 10.`;
  } else if (day >= 11 && day <= 25) {
    kode_jendela = 'SEBELUM_26';
    nama_jendela = 'Periode Perpanjangan Input (Sebelum Tgl 26)';
    status_buka = true;
    pesan_jadwal = `Jendela Susulan Aktif (Tanggal ${day} ${namaBulan} ${year}): Penginputan masih dibuka sebelum batas akhir tanggal 26 (${26 - day} hari menuju tutup buku bulanan).`;
  } else {
    kode_jendela = 'TUTUP_26_PLUS';
    nama_jendela = 'Periode Rekapitulasi & Tutup Buku (Tgl 26 – Akhir Bulan)';
    status_buka = Boolean(jadwalConfig.allow_override);
    pesan_jadwal = jadwalConfig.allow_override
      ? `Melewati Tanggal 26 (Tanggal ${day} ${namaBulan} ${year}): Masa Rekapitulasi Triwulan berjalan. Akses Override Aparatur aktif sehingga input/pembaruan tetap langsung direkap.`
      : `Tutup Buku Bulanan (Tanggal ${day} ${namaBulan} ${year}): Penginputan reguler hanya dibuka tanggal 1–10 atau sebelum tanggal 26 setiap bulan.`;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    tanggal_aktif: `${pad(day)} ${namaBulan} ${year}`,
    hari_ke: day,
    bulan_angka: month,
    nama_bulan: namaBulan,
    tahun: year,
    triwulan_ke: tw.triwulan_ke,
    kode_triwulan: tw.kode_triwulan,
    nama_triwulan: tw.nama_triwulan,
    rentang_triwulan: tw.rentang_triwulan,
    jadwal_penyaluran: tw.jadwal_penyaluran,
    kode_jendela,
    nama_jendela,
    status_buka,
    is_override: kode_jendela === 'TUTUP_26_PLUS' && jadwalConfig.allow_override,
    mode_simulasi: jadwalConfig.mode_simulasi,
    pesan_jadwal,
    aturan_resmi: 'Penyaluran dilakukan 3 bulan sekali (Triwulanan). Penginputan & pemutakhiran data dibuka setiap bulan pada Tanggal 1–10 (Utama) atau maksimal sebelum Tanggal 26.'
  };
}

// ============================================================================
// PENYIMPANAN BASELINE DATA LAMA & RIWAYAT REKAPITULASI TRIWULANAN (20 TAHUN)
// ============================================================================
export let wargaBaselineStore: WargaItem[] = [];
export let rekapHistoryStore: RekapPeriodeReport[] = [];
export let latestRekapReport: RekapPeriodeReport | null = null;
export const rekapHistoricalCache = new Map<string, RekapPeriodeReport>();

export function setWargaBaselineStore(list: WargaItem[]) {
  wargaBaselineStore = JSON.parse(JSON.stringify(list));
}

export function capturePreMutationBaselineIfEmpty() {
  if (wargaBaselineStore.length === 0 && wargaStore.length > 0) {
    wargaBaselineStore = JSON.parse(JSON.stringify(wargaStore));
  }
}

export function snapshotCurrentAsBaseline() {
  if (wargaStore.length > 0) {
    wargaBaselineStore = JSON.parse(JSON.stringify(wargaStore));
  }
}

// ============================================================================
// HELPER LABEL KRITERIA C1 - C39
// ============================================================================
export function formatRupiahSingkat(val: number): string {
  const n = Math.round(Number(val) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function labelTempatTinggalC8(c8: number): string {
  const v = Number(c8) || 1;
  if (v === 1) return 'Milik Sendiri (Layak)';
  if (v === 2) return 'Sewa / Kontrak';
  return 'Menumpang / Tidak Layak';
}

export function labelKesehatanC10(c10: number): string {
  const v = Number(c10) || 1;
  if (v === 1) return 'Sehat';
  if (v === 2) return 'Sakit Menahun / Disabilitas';
  return 'Disabilitas Berat / Kritis';
}

export function labelPendidikanC9(c9: number): string {
  const v = Number(c9) || 1;
  if (v === 1) return 'Tidak Sekolah / SD';
  if (v === 2) return 'SMP Sederajat';
  if (v === 3) return 'SMA / SMK';
  return 'Diploma / Sarjana';
}

export function labelPernikahanC6(c6: number): string {
  const v = Number(c6) || 2;
  if (v === 1) return 'Belum Menikah';
  if (v === 2) return 'Menikah';
  return 'Cerai Hidup / Mati';
}

export function formatNilaiKriteriaDinamis(def: KriteriaDinamisItemDef, val: number): string {
  const n = Number(val ?? def.nilai_default);
  if (def.kode === 'C1' || def.kode === 'C2') {
    return formatRupiahSingkat(n);
  }
  if (def.opsi && def.opsi.length > 0) {
    const found = def.opsi.find(o => Number(o.value) === n);
    if (found) return found.label.replace(/^\d+\s*-\s*/, '');
  }
  return `${n} ${def.satuan}`;
}

// ============================================================================
// DETEKSI STATUS MENINGGAL DUNIA & PINDAH KOTA PADA ITEM WARGA
// ============================================================================
const KOTA_LUAR_SIDOARJO_REGEX = /\b(surabaya|gresik|mojokerto|pasuruan|malang|lamongan|jombang|probolinggo|kediri|madiun|banyuwangi|jakarta|bandung|semarang|yogyakarta|jogja|solo|surakarta|denpasar|bali|kalimantan|sumatera|sulawesi|makassar|medan|balikpapan|bekasi|tangerang|depok|bogor)\b/i;

export function inspectStatusKependudukanWarga(w: Partial<WargaItem>): {
  isMeninggal: boolean;
  isPindahKota: boolean;
  kotaTujuan: string;
  isPindahAlamatNote: boolean;
  isPindahTempatTinggalNote: boolean;
  explicitEkonomi: 'memburuk' | 'membaik' | null;
} {
  const extra = (w.extra_data && typeof w.extra_data === 'object') ? w.extra_data : {};
  const extraStr = Object.entries(extra)
    .map(([k, v]) => `${k}: ${String(v ?? '')}`)
    .join(' | ');

  const statusMutasiRaw = String(
    (w as any).status_mutasi ||
    (w as any).status_kependudukan ||
    (extra as any).status_mutasi ||
    (extra as any).status_kependudukan ||
    (extra as any).kondisi_warga ||
    ''
  ).toLowerCase().trim();

  const textGabungan = [
    w.nama || '',
    w.alamat || '',
    w.catatan || '',
    w.keterangan_salur || '',
    w.status_validasi || '',
    w.status_bansos || '',
    statusMutasiRaw,
    extraStr
  ].join(' | ');

  const isMeninggal =
    statusMutasiRaw === 'meninggal' ||
    statusMutasiRaw === 'meninggal_dunia' ||
    statusMutasiRaw === 'wafat' ||
    /\b(meninggal|meninggal dunia|wafat|almarhum|almarhumah|alm\.|almh\.|tutup usia|kematian)\b/i.test(textGabungan);

  const alamatDanCatatan = [
    w.alamat || '',
    w.catatan || '',
    w.keterangan_salur || '',
    statusMutasiRaw,
    String((w as any).kota_domisili || (extra as any).kota || (extra as any).kota_tujuan || '')
  ].join(' | ');

  const matchKota = alamatDanCatatan.match(KOTA_LUAR_SIDOARJO_REGEX);
  const isPindahKota =
    !isMeninggal && (
      statusMutasiRaw === 'pindah_kota' ||
      statusMutasiRaw === 'luar_kota' ||
      /\b(pindah kota|pindah luar kota|pindah ke luar|mutasi luar kota|domisili luar sidoarjo|pindah kab|pindah provinsi)\b/i.test(alamatDanCatatan) ||
      Boolean(matchKota)
    );

  let kotaTujuan = 'Kabupaten Sidoarjo';
  if (isPindahKota) {
    if ((w as any).kota_tujuan || (extra as any).kota_tujuan) {
      kotaTujuan = String((w as any).kota_tujuan || (extra as any).kota_tujuan);
    } else if (matchKota && matchKota[1]) {
      const kCap = matchKota[1].charAt(0).toUpperCase() + matchKota[1].slice(1).toLowerCase();
      kotaTujuan = `Kota/Kab. ${kCap} (Luar Sidoarjo)`;
    } else {
      kotaTujuan = 'Luar Kabupaten Sidoarjo';
    }
  }

  const isPindahAlamatNote =
    statusMutasiRaw === 'pindah_alamat' ||
    /\b(pindah alamat|berubah alamat|alamat baru|pindah rt|pindah rw|pindah desa|pindah kelurahan|pindah kecamatan)\b/i.test(alamatDanCatatan);

  const isPindahTempatTinggalNote =
    statusMutasiRaw === 'pindah_tempat_tinggal' ||
    /\b(pindah tempat tinggal|berubah tempat tinggal|pindah rumah|pindah kontrakan|pindah kos|menumpang)\b/i.test(alamatDanCatatan);

  let explicitEkonomi: 'memburuk' | 'membaik' | null = null;
  if (
    statusMutasiRaw === 'ekonomi_memburuk' ||
    statusMutasiRaw === 'kriteria_memburuk' ||
    /\b(ekonomi memburuk|kondisi memburuk|kriteria memburuk|kena phk|di-phk|kehilangan pekerjaan|jatuh miskin|bangkrut|penghasilan menurun|sakit kritis)\b/i.test(textGabungan)
  ) {
    explicitEkonomi = 'memburuk';
  } else if (
    statusMutasiRaw === 'ekonomi_membaik' ||
    statusMutasiRaw === 'kriteria_membaik' ||
    /\b(ekonomi membaik|kondisi membaik|kriteria membaik|graduasi mandiri|usaha berkembang|dapat pekerjaan tetap|sejahtera|mampu secara ekonomi)\b/i.test(textGabungan)
  ) {
    explicitEkonomi = 'membaik';
  }

  return {
    isMeninggal,
    isPindahKota,
    kotaTujuan,
    isPindahAlamatNote,
    isPindahTempatTinggalNote,
    explicitEkonomi
  };
}

function normalizeAlamat(a: string): string {
  return String(a || '')
    .toLowerCase()
    .replace(/kabupaten\s+sidoarjo/g, '')
    .replace(/kab\.?\s+sidoarjo/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function extractKriteriaSnapshot(w: WargaItem): RekapKriteriaSnapshot {
  const extra = (w.extra_data && typeof w.extra_data === 'object') ? w.extra_data : {};
  const snap: RekapKriteriaSnapshot = {
    c1: parseFloatSafe(w.c1, 1500000),
    c2: parseFloatSafe(w.c2, 5000000),
    c3: parseIntSafe(w.c3, 45),
    c4: parseIntSafe(w.c4, 1),
    c5: parseIntSafe(w.c5, 3),
    c6: parseIntSafe(w.c6, 2),
    c7: parseIntSafe(w.c7, 2),
    c8: parseIntSafe(w.c8, 2),
    c9: parseIntSafe(w.c9, 1),
    c10: parseIntSafe(w.c10, 1)
  };

  for (const def of katalogKriteriaDinamis) {
    if (def.nomor <= 10) continue;
    const rawVal = (w as any)[def.key] ?? (extra as any)[def.key] ?? (extra as any)[def.kode];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      snap[def.key] = Number(rawVal);
    } else {
      // Berikan nilai awal deterministik yang masuk akal berdasarkan profil C1/C8/C10
      if (def.nomor === 11) snap[def.key] = snap.c1 <= 1000000 ? 2 : 1;
      else if (def.nomor === 12) snap[def.key] = snap.c1 <= 1200000 ? 2 : 1;
      else if (def.nomor === 19) snap[def.key] = snap.c8 >= 3 ? 7 : 12;
      else if (def.nomor === 21) snap[def.key] = snap.c3 >= 60 ? 1 : 0;
      else snap[def.key] = def.nilai_default;
    }
  }
  return snap;
}

// ============================================================================
// INTI ENGINE REKAPITULASI & PENURUNAN / PENYESUAIAN DESIL OTOMATIS (C1 - C39+)
// ============================================================================
export function jalankanRekapitulasiPerubahanData(
  oldListInput?: WargaItem[],
  newListInput?: WargaItem[],
  sumberPembaruan = 'Pemutakhiran & Rekapitulasi Data Triwulan'
): RekapPeriodeReport {
  const oldList = Array.isArray(oldListInput) && oldListInput.length > 0
    ? oldListInput
    : wargaBaselineStore;
  const newList = Array.isArray(newListInput)
    ? newListInput
    : wargaStore;

  const oldMap = new Map<string, WargaItem>();
  oldList.forEach(w => {
    if (w && w.nik) oldMap.set(String(w.nik).trim(), w);
  });

  hitungDanSinkronkanSawBwm();

  const items: RekapMutasiItem[] = [];
  const waktuRekap = nowTimeStr();

  let countPindahTempatTinggal = 0;
  let countPindahAlamat = 0;
  let countPindahKota = 0;
  let countMeninggal = 0;
  let countEkonomiMemburuk = 0;
  let countEkonomiMembaik = 0;
  let countWargaBaru = 0;
  let countTetap = 0;
  let countDesilDiturunkanPrioritas = 0;
  let countDesilGraduasiMandiri = 0;
  let countDesilDihentikanMutasi = 0;

  newList.forEach((w, idx) => {
    const nik = String(w.nik || '').trim();
    const oldW = oldMap.get(nik) || null;
    const inspect = inspectStatusKependudukanWarga(w);

    const kBaru = extractKriteriaSnapshot(w);
    const kLama = oldW ? extractKriteriaSnapshot(oldW) : null;

    const alamatLama = oldW ? String(oldW.alamat || 'Kabupaten Sidoarjo') : '-';
    const alamatBaru = String(w.alamat || 'Kabupaten Sidoarjo');
    const tempatTinggalLama = kLama ? labelTempatTinggalC8(kLama.c8) : '-';
    const tempatTinggalBaru = labelTempatTinggalC8(kBaru.c8);

    const skorLama = oldW ? Number((oldW.skor_saw || 0).toFixed(4)) : 0;
    const desilLama = oldW ? (Number(oldW.desil) || 5) : 5;
    const statusBansosLama = oldW
      ? (oldW.status_bansos || (desilLama <= 4 ? 'Menerima Bansos' : 'Tidak Menerima'))
      : 'Belum Terdaftar';

    const kategoriList: MutasiKategori[] = [];
    const labelPerubahan: string[] = [];
    const rincianKriteria: string[] = [];

    let poinMemburuk = 0;
    let poinMembaik = 0;

    if (!oldW) {
      if (inspect.isMeninggal) {
        kategoriList.push('meninggal');
        labelPerubahan.push('Warga Meninggal Dunia');
      } else if (inspect.isPindahKota) {
        kategoriList.push('pindah_kota');
        labelPerubahan.push(`Pindah Kota (${inspect.kotaTujuan})`);
      } else {
        kategoriList.push('warga_baru');
        labelPerubahan.push('Warga Baru Terdaftar');
      }
      rincianKriteria.push(
        `Data awal terdaftar: Penghasilan ${formatRupiahSingkat(kBaru.c1)}, Aset ${formatRupiahSingkat(kBaru.c2)}, Tanggungan ${kBaru.c5} jiwa, Tempat Tinggal: ${tempatTinggalBaru}`
      );
    } else {
      const alamatBerubah = normalizeAlamat(alamatLama) !== normalizeAlamat(alamatBaru);
      const tempatTinggalBerubah = kLama !== null && kLama.c8 !== kBaru.c8;

      if (inspect.isMeninggal) {
        kategoriList.push('meninggal');
        labelPerubahan.push('Meninggal Dunia');
        rincianKriteria.push('Status kependudukan berubah menjadi Meninggal Dunia (Wafat).');
      }

      if (inspect.isPindahKota) {
        kategoriList.push('pindah_kota');
        labelPerubahan.push(`Pindah Kota (${inspect.kotaTujuan})`);
        rincianKriteria.push(`Domisili pindah keluar Kabupaten Sidoarjo menuju ${inspect.kotaTujuan}.`);
      }

      if (!inspect.isPindahKota && (alamatBerubah || inspect.isPindahAlamatNote)) {
        kategoriList.push('pindah_alamat');
        labelPerubahan.push('Berubah Alamat');
        rincianKriteria.push(`Alamat berubah: "${alamatLama}" → "${alamatBaru}"`);
      }

      if (tempatTinggalBerubah || inspect.isPindahTempatTinggalNote) {
        kategoriList.push('pindah_tempat_tinggal');
        labelPerubahan.push('Berubah Tempat Tinggal');
        if (tempatTinggalBerubah && kLama) {
          rincianKriteria.push(`C8 (Tempat Tinggal): ${tempatTinggalLama} → ${tempatTinggalBaru}`);
        } else {
          rincianKriteria.push(`Perubahan tempat tinggal/hunian tercatat: ${tempatTinggalBaru}`);
        }
      }

      // Evaluasi Perubahan Kriteria C1 s/d C39+ Secara Dinamis
      if (kLama) {
        if (Math.abs(kBaru.c1 - kLama.c1) >= 10000) {
          if (kBaru.c1 < kLama.c1) {
            poinMemburuk += 3;
            rincianKriteria.push(`C1 Penghasilan menurun: ${formatRupiahSingkat(kLama.c1)} → ${formatRupiahSingkat(kBaru.c1)} (Memburuk)`);
          } else {
            poinMembaik += 3;
            rincianKriteria.push(`C1 Penghasilan meningkat: ${formatRupiahSingkat(kLama.c1)} → ${formatRupiahSingkat(kBaru.c1)} (Membaik)`);
          }
        }

        if (Math.abs(kBaru.c2 - kLama.c2) >= 50000) {
          if (kBaru.c2 < kLama.c2) {
            poinMemburuk += 2;
            rincianKriteria.push(`C2 Nilai Aset berkurang: ${formatRupiahSingkat(kLama.c2)} → ${formatRupiahSingkat(kBaru.c2)} (Memburuk)`);
          } else {
            poinMembaik += 2;
            rincianKriteria.push(`C2 Nilai Aset bertambah: ${formatRupiahSingkat(kLama.c2)} → ${formatRupiahSingkat(kBaru.c2)} (Membaik)`);
          }
        }

        if (kBaru.c3 !== kLama.c3) {
          rincianKriteria.push(`C3 Usia KK: ${kLama.c3} thn → ${kBaru.c3} thn`);
        }

        if (kBaru.c4 !== kLama.c4) {
          if (kBaru.c4 > kLama.c4) {
            poinMemburuk += 1;
            rincianKriteria.push(`C4 Kondisi Lantai/Bangunan menurun: Skala ${kLama.c4} → Skala ${kBaru.c4} (Memburuk)`);
          } else {
            poinMembaik += 1;
            rincianKriteria.push(`C4 Kondisi Lantai/Bangunan membaik: Skala ${kLama.c4} → Skala ${kBaru.c4} (Membaik)`);
          }
        }

        if (kBaru.c5 !== kLama.c5) {
          if (kBaru.c5 > kLama.c5) {
            poinMemburuk += 2;
            rincianKriteria.push(`C5 Tanggungan bertambah: ${kLama.c5} jiwa → ${kBaru.c5} jiwa (Beban Meningkat)`);
          } else {
            poinMembaik += 2;
            rincianKriteria.push(`C5 Tanggungan berkurang: ${kLama.c5} jiwa → ${kBaru.c5} jiwa (Beban Berkurang)`);
          }
        }

        if (kBaru.c6 !== kLama.c6) {
          if (kBaru.c6 > kLama.c6) poinMemburuk += 1;
          rincianKriteria.push(`C6 Status Kawin: ${labelPernikahanC6(kLama.c6)} → ${labelPernikahanC6(kBaru.c6)}`);
        }

        if (kBaru.c7 !== kLama.c7) {
          if (kBaru.c7 > kLama.c7) {
            poinMemburuk += 1;
            rincianKriteria.push(`C7 Anak Sekolah/Balita naik: ${kLama.c7} → ${kBaru.c7} anak`);
          } else {
            poinMembaik += 1;
            rincianKriteria.push(`C7 Anak Sekolah/Balita turun: ${kLama.c7} → ${kBaru.c7} anak`);
          }
        }

        if (kBaru.c8 !== kLama.c8) {
          if (kBaru.c8 > kLama.c8) poinMemburuk += 2;
          else poinMembaik += 2;
        }

        if (kBaru.c9 !== kLama.c9) {
          rincianKriteria.push(`C9 Pendidikan: ${labelPendidikanC9(kLama.c9)} → ${labelPendidikanC9(kBaru.c9)}`);
        }

        if (kBaru.c10 !== kLama.c10) {
          if (kBaru.c10 > kLama.c10) {
            poinMemburuk += 2;
            rincianKriteria.push(`C10 Kesehatan menurun: ${labelKesehatanC10(kLama.c10)} → ${labelKesehatanC10(kBaru.c10)} (Memburuk)`);
          } else {
            poinMembaik += 2;
            rincianKriteria.push(`C10 Kesehatan membaik: ${labelKesehatanC10(kLama.c10)} → ${labelKesehatanC10(kBaru.c10)} (Membaik)`);
          }
        }

        // Evaluasi Kriteria C11 s/d C39+
        for (const def of katalogKriteriaDinamis) {
          if (def.nomor <= 10) continue;
          const vLama = Number(kLama[def.key] ?? def.nilai_default);
          const vBaru = Number(kBaru[def.key] ?? def.nilai_default);
          if (vLama !== vBaru) {
            const txtLama = formatNilaiKriteriaDinamis(def, vLama);
            const txtBaru = formatNilaiKriteriaDinamis(def, vBaru);
            const isWorse = def.arah_kerentanan === 'naik_memburuk' ? (vBaru > vLama) : (vBaru < vLama);
            if (isWorse) {
              poinMemburuk += 1.5;
              rincianKriteria.push(`${def.kode} (${def.nama}): ${txtLama} → ${txtBaru} (Memburuk)`);
            } else {
              poinMembaik += 1.5;
              rincianKriteria.push(`${def.kode} (${def.nama}): ${txtLama} → ${txtBaru} (Membaik)`);
            }
          }
        }
      }

      if (inspect.explicitEkonomi === 'memburuk') {
        poinMemburuk += 4;
        if (rincianKriteria.length === 0) {
          rincianKriteria.push('Laporan verifikasi lapangan menyatakan kondisi ekonomi keluarga memburuk.');
        }
      } else if (inspect.explicitEkonomi === 'membaik') {
        poinMembaik += 4;
        if (rincianKriteria.length === 0) {
          rincianKriteria.push('Laporan verifikasi lapangan menyatakan kondisi ekonomi keluarga membaik / graduasi.');
        }
      }

      if (!inspect.isMeninggal && !inspect.isPindahKota) {
        if (poinMemburuk > poinMembaik && poinMemburuk > 0) {
          kategoriList.push('ekonomi_memburuk');
          labelPerubahan.push('Kondisi Ekonomi / Kriteria Memburuk');
        } else if (poinMembaik > poinMemburuk && poinMembaik > 0) {
          kategoriList.push('ekonomi_membaik');
          labelPerubahan.push('Kondisi Ekonomi / Kriteria Membaik');
        }
      }

      if (kategoriList.length === 0) {
        kategoriList.push('tetap');
        labelPerubahan.push('Data Tetap / Tidak Berubah');
        rincianKriteria.push('Tidak ada perubahan alamat, tempat tinggal, maupun kriteria C1–C39 pada periode ini.');
      }
    }

    // PENYESUAIAN & PENURUNAN DESIL OTOMATIS SESUAI KONDISI TERBARU
    let desilBaru = Number(w.desil) || 5;
    let skorBaru = Number((w.skor_saw || 0).toFixed(4));
    let arahDesil: RekapMutasiItem['arah_desil'] = 'tetap';
    let keteranganDesilOtomatis = '';
    let kondisiEkonomiStatus: RekapMutasiItem['kondisi_ekonomi_status'] = 'Tetap';
    let statusKependudukan: RekapMutasiItem['status_kependudukan'] = 'Aktif';

    if (inspect.isMeninggal) {
      statusKependudukan = 'Meninggal Dunia';
      kondisiEkonomiStatus = 'Non-Aktif';
      desilBaru = 10;
      arahDesil = 'nonaktif_mutasi';
      w.desil = 10;
      w.prioritas = 'Dihentikan (Meninggal Dunia)';
      w.status_bansos = 'Tidak Menerima (Meninggal Dunia)';
      w.status_salur = 'Dihentikan';
      w.nominal_bantuan = '-';
      keteranganDesilOtomatis = `Warga tercatat Meninggal Dunia → Status kepesertaan dinonaktifkan otomatis (Desil ${desilLama} → Non-Aktif / Desil 10) agar kuota dialihkan ke warga layak.`;
      countMeninggal++;
      countDesilDihentikanMutasi++;
    } else if (inspect.isPindahKota) {
      statusKependudukan = 'Pindah Kota';
      kondisiEkonomiStatus = 'Non-Aktif';
      desilBaru = 10;
      arahDesil = 'nonaktif_mutasi';
      w.desil = 10;
      w.prioritas = 'Dihentikan (Pindah Kota)';
      w.status_bansos = 'Tidak Menerima (Pindah Kota)';
      w.status_salur = 'Dihentikan';
      w.nominal_bantuan = '-';
      keteranganDesilOtomatis = `Warga pindah domisili ke ${inspect.kotaTujuan} → Status penyaluran Kab. Sidoarjo dihentikan otomatis (Desil ${desilLama} → Non-Aktif / Desil 10).`;
      countPindahKota++;
      countDesilDihentikanMutasi++;
    } else if (kategoriList.includes('ekonomi_memburuk')) {
      kondisiEkonomiStatus = 'Memburuk';
      if (kategoriList.includes('pindah_tempat_tinggal')) statusKependudukan = 'Pindah Tempat Tinggal';
      else if (kategoriList.includes('pindah_alamat')) statusKependudukan = 'Pindah Alamat';

      let targetDesil = desilBaru;
      if (kBaru.c1 <= 750000 || (kBaru.c1 <= 950000 && kBaru.c8 >= 3) || poinMemburuk >= 7) {
        targetDesil = 1;
      } else if (kBaru.c1 <= 1150000 || poinMemburuk >= 4.5) {
        targetDesil = Math.min(2, desilLama > 1 ? desilLama - 1 : 1);
      } else if (kBaru.c1 <= 1400000 || poinMemburuk >= 2.5) {
        targetDesil = Math.min(3, desilLama > 1 ? desilLama - 1 : 1);
      } else {
        targetDesil = Math.max(1, Math.min(4, desilLama - 1));
      }

      if (oldW && targetDesil >= desilLama && desilLama > 1) {
        targetDesil = Math.max(1, desilLama - 1);
      }
      desilBaru = Math.max(1, Math.min(4, targetDesil));

      if (oldW && skorBaru <= skorLama) {
        skorBaru = Number(Math.min(0.995, skorLama + 0.085).toFixed(4));
        w.skor_saw = skorBaru;
      }

      w.desil = desilBaru;
      w.prioritas = 'Prioritas Utama';
      w.status_bansos = 'Menerima Bansos';
      if (!w.status_salur || w.status_salur === 'Tidak Dialokasikan' || w.status_salur === 'Dihentikan') {
        w.status_salur = 'Belum Salur';
      }
      if (!w.nominal_bantuan || w.nominal_bantuan === '-') {
        w.nominal_bantuan = 'Rp 600.000 / Beras 10 Kg';
      }

      arahDesil = 'turun_prioritas_naik';
      keteranganDesilOtomatis = `Kondisi ekonomi/kriteria memburuk → Desil otomatis diturunkan dari Desil ${desilLama} ke Desil ${desilBaru} (Prioritas Utama Penerima Bansos).`;
      countEkonomiMemburuk++;
      countDesilDiturunkanPrioritas++;
    } else if (kategoriList.includes('ekonomi_membaik')) {
      kondisiEkonomiStatus = 'Membaik';
      if (kategoriList.includes('pindah_tempat_tinggal')) statusKependudukan = 'Pindah Tempat Tinggal';
      else if (kategoriList.includes('pindah_alamat')) statusKependudukan = 'Pindah Alamat';

      let targetDesil = desilBaru;
      if (kBaru.c1 >= 3000000 || kBaru.c2 >= 15000000 || poinMembaik >= 6) {
        targetDesil = Math.max(8, desilLama + 3);
      } else if (kBaru.c1 >= 2000000 || kBaru.c2 >= 8000000 || poinMembaik >= 3.5) {
        targetDesil = Math.max(6, desilLama + 2);
      } else if (kBaru.c1 >= 1500000) {
        targetDesil = Math.max(5, desilLama + 1);
      } else {
        targetDesil = Math.min(10, Math.max(desilBaru, desilLama + 1));
      }
      desilBaru = Math.min(10, Math.max(1, targetDesil));

      if (oldW && skorBaru >= skorLama && skorLama > 0.25) {
        skorBaru = Number(Math.max(0.15, skorLama - 0.075).toFixed(4));
        w.skor_saw = skorBaru;
      }

      w.desil = desilBaru;
      if (desilBaru > 4) {
        w.prioritas = 'Tidak Prioritas (Graduasi Mandiri)';
        w.status_bansos = 'Tidak Menerima (Graduasi Sejahtera)';
        w.status_salur = 'Tidak Dialokasikan';
        w.nominal_bantuan = '-';
      } else {
        w.prioritas = 'Prioritas Utama';
        w.status_bansos = 'Menerima Bansos';
      }

      arahDesil = 'naik_graduasi';
      keteranganDesilOtomatis = desilBaru > 4
        ? `Kondisi ekonomi membaik signifikan → Desil disesuaikan dari Desil ${desilLama} ke Desil ${desilBaru} (Graduasi Mandiri / Tidak Menerima).`
        : `Kondisi ekonomi membaik → Desil disesuaikan dari Desil ${desilLama} ke Desil ${desilBaru}.`;
      countEkonomiMembaik++;
      countDesilGraduasiMandiri++;
    } else if (!oldW) {
      statusKependudukan = 'Warga Baru';
      kondisiEkonomiStatus = 'Baru';
      arahDesil = 'baru';
      if (kBaru.c1 <= 1000000 && desilBaru > 2) {
        desilBaru = 2;
        w.desil = 2;
        w.prioritas = 'Prioritas Utama';
        w.status_bansos = 'Menerima Bansos';
      }
      keteranganDesilOtomatis = `Warga baru terdaftar → Ditetapkan otomatis pada Desil ${desilBaru} berdasarkan evaluasi kriteria C1–C39.`;
      countWargaBaru++;
    } else {
      if (kategoriList.includes('pindah_tempat_tinggal')) statusKependudukan = 'Pindah Tempat Tinggal';
      else if (kategoriList.includes('pindah_alamat')) statusKependudukan = 'Pindah Alamat';

      if (desilBaru < desilLama) {
        arahDesil = 'turun_prioritas_naik';
        keteranganDesilOtomatis = `Pemutakhiran domisili/kriteria → Desil turun dari Desil ${desilLama} ke Desil ${desilBaru}.`;
        countDesilDiturunkanPrioritas++;
      } else if (desilBaru > desilLama) {
        arahDesil = 'naik_graduasi';
        keteranganDesilOtomatis = `Pemutakhiran domisili/kriteria → Desil disesuaikan dari Desil ${desilLama} ke Desil ${desilBaru}.`;
      } else {
        arahDesil = 'tetap';
        keteranganDesilOtomatis = kategoriList.includes('pindah_alamat') || kategoriList.includes('pindah_tempat_tinggal')
          ? `Mutasi alamat/tempat tinggal tercatat → Tetap pada Desil ${desilBaru} (${w.status_bansos}).`
          : `Data stabil → Tetap pada Desil ${desilBaru}.`;
      }

      if (kategoriList.includes('tetap')) {
        countTetap++;
      }
    }

    if (kategoriList.includes('pindah_tempat_tinggal')) countPindahTempatTinggal++;
    if (kategoriList.includes('pindah_alamat')) countPindahAlamat++;

    let kategoriUtama: MutasiKategori = 'tetap';
    if (kategoriList.includes('meninggal')) kategoriUtama = 'meninggal';
    else if (kategoriList.includes('pindah_kota')) kategoriUtama = 'pindah_kota';
    else if (kategoriList.includes('ekonomi_memburuk')) kategoriUtama = 'ekonomi_memburuk';
    else if (kategoriList.includes('ekonomi_membaik')) kategoriUtama = 'ekonomi_membaik';
    else if (kategoriList.includes('pindah_tempat_tinggal')) kategoriUtama = 'pindah_tempat_tinggal';
    else if (kategoriList.includes('pindah_alamat')) kategoriUtama = 'pindah_alamat';
    else if (kategoriList.includes('warga_baru')) kategoriUtama = 'warga_baru';

    const jadwalCur = getJadwalInputStatus();
    const salurInfo = buildRincianPenyaluranAwalAkhir({
      nik,
      nama: w.nama,
      alamat: alamatBaru || w.alamat,
      emailExisting: (w as any).email,
      desilLama: oldW ? desilLama : desilBaru,
      desilBaru,
      kategoriUtama,
      tahun: jadwalCur.tahun,
      triwulanAktif: jadwalCur.triwulan_ke,
      idx
    });

    (w as any).email = salurInfo.email_warga;
    (w as any).kecamatan = salurInfo.kecamatan;
    (w as any).kelurahan_desa = salurInfo.kelurahan_desa;
    (w as any).penyaluran_awal_periode = salurInfo.penyaluran_awal_periode;
    (w as any).nominal_penyaluran_awal = salurInfo.nominal_penyaluran_awal;
    (w as any).nominal_penyaluran_awal_label = salurInfo.nominal_penyaluran_awal_label;
    (w as any).bentuk_bantuan_awal = salurInfo.bentuk_bantuan_awal;
    (w as any).penyaluran_akhir_periode = salurInfo.penyaluran_akhir_periode;
    (w as any).nominal_penyaluran_akhir = salurInfo.nominal_penyaluran_akhir;
    (w as any).nominal_penyaluran_akhir_label = salurInfo.nominal_penyaluran_akhir_label;
    (w as any).bentuk_bantuan_akhir = salurInfo.bentuk_bantuan_akhir;
    (w as any).total_nominal_awal_sampai_akhir = salurInfo.total_nominal_awal_sampai_akhir;
    (w as any).total_nominal_awal_sampai_akhir_label = salurInfo.total_nominal_awal_sampai_akhir_label;
    (w as any).rincian_tahap_penyaluran = salurInfo.rincian_tahap_penyaluran;
    if (!w.tanggal_salur || w.tanggal_salur === '-') {
      w.tanggal_salur = `${salurInfo.penyaluran_awal_periode} s/d ${salurInfo.penyaluran_akhir_periode}`;
    }
    if (!w.nominal_bantuan || w.nominal_bantuan === '-') {
      w.nominal_bantuan = `${salurInfo.nominal_penyaluran_akhir_label} (${salurInfo.bentuk_bantuan_akhir})`;
    }

    (w as any).rekap_mutasi = {
      kategori_utama: kategoriUtama,
      kategori_list: kategoriList,
      label_perubahan: labelPerubahan,
      desil_lama: oldW ? desilLama : desilBaru,
      desil_baru: desilBaru,
      arah_desil: arahDesil,
      alamat_lama: alamatLama,
      alamat_baru: alamatBaru,
      kota_baru: inspect.isPindahKota ? inspect.kotaTujuan : 'Kabupaten Sidoarjo',
      status_kependudukan: statusKependudukan,
      kondisi_ekonomi_status: kondisiEkonomiStatus,
      keterangan_desil_otomatis: keteranganDesilOtomatis,
      ...salurInfo
    };

    items.push({
      id_rekap_item: `RKP-${nik}-${idx + 1}`,
      nik,
      nama: w.nama,
      email_warga: salurInfo.email_warga,
      kecamatan: salurInfo.kecamatan,
      kelurahan_desa: salurInfo.kelurahan_desa,
      kategori_utama: kategoriUtama,
      kategori_list: kategoriList,
      label_perubahan: labelPerubahan,
      alamat_lama: alamatLama,
      alamat_baru: alamatBaru,
      tempat_tinggal_lama: tempatTinggalLama,
      tempat_tinggal_baru: tempatTinggalBaru,
      kota_lama: 'Kabupaten Sidoarjo',
      kota_baru: inspect.isPindahKota ? inspect.kotaTujuan : 'Kabupaten Sidoarjo',
      status_kependudukan: statusKependudukan,
      kondisi_ekonomi_status: kondisiEkonomiStatus,
      kriteria_lama: kLama,
      kriteria_baru: kBaru,
      rincian_perubahan_kriteria: rincianKriteria,
      skor_saw_lama: skorLama,
      skor_saw_baru: skorBaru,
      desil_lama: oldW ? desilLama : desilBaru,
      desil_baru: desilBaru,
      arah_desil: arahDesil,
      keterangan_desil_otomatis: keteranganDesilOtomatis,
      status_bansos_lama: statusBansosLama,
      status_bansos_baru: w.status_bansos,
      status_salur_baru: w.status_salur,
      catatan_perubahan: w.catatan || keteranganDesilOtomatis,
      waktu_rekap: waktuRekap,
      penyaluran_awal_periode: salurInfo.penyaluran_awal_periode,
      nominal_penyaluran_awal: salurInfo.nominal_penyaluran_awal,
      nominal_penyaluran_awal_label: salurInfo.nominal_penyaluran_awal_label,
      bentuk_bantuan_awal: salurInfo.bentuk_bantuan_awal,
      penyaluran_akhir_periode: salurInfo.penyaluran_akhir_periode,
      nominal_penyaluran_akhir: salurInfo.nominal_penyaluran_akhir,
      nominal_penyaluran_akhir_label: salurInfo.nominal_penyaluran_akhir_label,
      bentuk_bantuan_akhir: salurInfo.bentuk_bantuan_akhir,
      total_nominal_awal_sampai_akhir: salurInfo.total_nominal_awal_sampai_akhir,
      total_nominal_awal_sampai_akhir_label: salurInfo.total_nominal_awal_sampai_akhir_label,
      rincian_tahap_penyaluran: salurInfo.rincian_tahap_penyaluran
    });
  });

  wargaStore.sort((a, b) => {
    if (a.desil !== b.desil) return a.desil - b.desil;
    return b.skor_saw - a.skor_saw;
  });
  wargaStore.forEach((w, i) => {
    w.rank_saw = i + 1;
  });

  const priorityOrder: Record<MutasiKategori, number> = {
    ekonomi_memburuk: 1,
    pindah_tempat_tinggal: 2,
    pindah_alamat: 3,
    pindah_kota: 4,
    meninggal: 5,
    ekonomi_membaik: 6,
    warga_baru: 7,
    dihapus: 8,
    tetap: 9
  };
  items.sort((a, b) => (priorityOrder[a.kategori_utama] || 99) - (priorityOrder[b.kategori_utama] || 99));

  const jadwalStatus = getJadwalInputStatus();
  const totalBerubah = items.filter(it => it.kategori_utama !== 'tetap').length;
  const layakSalur = wargaStore.filter(w => w.desil <= 4 && !w.status_bansos.includes('Tidak Menerima')).length;
  const totalNomAwal = items.reduce((acc, it) => acc + (it.nominal_penyaluran_awal || 0), 0);
  const totalNomAkhir = items.reduce((acc, it) => acc + (it.nominal_penyaluran_akhir || 0), 0);
  const totalAkumulasi = items.reduce((acc, it) => acc + (it.total_nominal_awal_sampai_akhir || 0), 0);

  const pubState = getStatusPublikasiRekap(jadwalStatus.kode_triwulan, jadwalStatus.tahun);

  const report: RekapPeriodeReport = {
    id: `REKAP-${jadwalStatus.kode_triwulan}-${Date.now()}`,
    kode_periode: jadwalStatus.kode_triwulan,
    nama_periode: `${jadwalStatus.nama_triwulan} — ${jadwalStatus.rentang_triwulan}`,
    triwulan_ke: jadwalStatus.triwulan_ke,
    nama_triwulan: jadwalStatus.nama_triwulan,
    rentang_bulan: jadwalStatus.rentang_triwulan,
    jadwal_penyaluran: jadwalStatus.jadwal_penyaluran,
    tahun: jadwalStatus.tahun,
    sumber_pembaruan: sumberPembaruan,
    waktu_rekap: waktuRekap,
    is_published: pubState.is_published,
    published_at: pubState.published_at,
    published_by: pubState.published_by,
    jadwal_status: jadwalStatus,
    total_data_lama: oldList.length,
    total_data_baru: newList.length,
    ringkasan: {
      total_berubah: totalBerubah,
      pindah_tempat_tinggal: countPindahTempatTinggal,
      pindah_alamat: countPindahAlamat,
      pindah_kota: countPindahKota,
      meninggal: countMeninggal,
      ekonomi_memburuk: countEkonomiMemburuk,
      ekonomi_membaik: countEkonomiMembaik,
      warga_baru: countWargaBaru,
      tetap: countTetap,
      desil_diturunkan_prioritas: countDesilDiturunkanPrioritas,
      desil_graduasi_mandiri: countDesilGraduasiMandiri,
      desil_dihentikan_mutasi: countDesilDihentikanMutasi,
      layak_penyaluran_triwulan: layakSalur,
      total_nominal_penyaluran_awal: totalNomAwal,
      total_nominal_penyaluran_akhir: totalNomAkhir,
      total_akumulasi_penyaluran_awal_akhir: totalAkumulasi
    },
    items
  };

  latestRekapReport = report;
  rekapHistoricalCache.set(report.kode_periode, JSON.parse(JSON.stringify(report)));

  const existingTwIdx = rekapHistoryStore.findIndex(r => r.kode_periode === report.kode_periode);
  if (existingTwIdx !== -1) {
    rekapHistoryStore[existingTwIdx] = report;
  } else {
    rekapHistoryStore.unshift(report);
  }
  if (rekapHistoryStore.length > 240) {
    rekapHistoryStore = rekapHistoryStore.slice(0, 240);
  }

  return report;
}

// ============================================================================
// MANAJEMEN PUBLIKASI LAPORAN REKAP 3 BULANAN KE PORTAL WARGA (REALTIME)
// ============================================================================
export const rekapPublishedMap = new Map<string, {
  is_published: boolean;
  published_at: string;
  published_by: string;
}>();

export function getStatusPublikasiRekap(kodePeriode: string, tahun?: number) {
  const existing = rekapPublishedMap.get(kodePeriode);
  if (existing) return existing;
  const nowYear = new Date().getFullYear();
  const y = tahun ?? (Number(String(kodePeriode).split('-')[1]) || nowYear);
  const defaultPublished = y <= nowYear;
  const state = {
    is_published: defaultPublished,
    published_at: defaultPublished ? `${y}-10-26 10:00` : '-',
    published_by: defaultPublished ? 'Kepala Dinas Sosial Kab. Sidoarjo' : '-'
  };
  rekapPublishedMap.set(kodePeriode, state);
  return state;
}

export function setStatusPublikasiRekap(
  kodePeriode: string,
  isPublished: boolean,
  actorName = 'Admin / Petugas Dinas Sosial'
) {
  const waktu = nowTimeStr();
  const state = {
    is_published: Boolean(isPublished),
    published_at: isPublished ? waktu : '-',
    published_by: isPublished ? actorName : '-'
  };
  rekapPublishedMap.set(kodePeriode, state);

  const cached = rekapHistoricalCache.get(kodePeriode);
  if (cached) {
    cached.is_published = state.is_published;
    cached.published_at = state.published_at;
    cached.published_by = state.published_by;
  }
  if (latestRekapReport && latestRekapReport.kode_periode === kodePeriode) {
    latestRekapReport.is_published = state.is_published;
    latestRekapReport.published_at = state.published_at;
    latestRekapReport.published_by = state.published_by;
  }
  return state;
}

// ============================================================================
// GENERATOR RINCIAN PENYALURAN AWAL S/D PENYALURAN AKHIR (NOMINAL & BENTUK BANTUAN)
// ============================================================================
export function buildRincianPenyaluranAwalAkhir(params: {
  nik: string;
  nama: string;
  alamat: string;
  emailExisting?: string;
  desilLama: number;
  desilBaru: number;
  kategoriUtama: MutasiKategori;
  tahun: number;
  triwulanAktif: 1 | 2 | 3 | 4;
  idx: number;
}) {
  const {
    nik, nama, alamat, emailExisting, desilLama, desilBaru,
    kategoriUtama, tahun, idx
  } = params;

  const cleanSlug = String(nama || 'warga')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 22) || 'warga';
  const nikTail = String(nik || '0001').slice(-4);
  const emailWarga = (emailExisting && String(emailExisting).includes('@'))
    ? String(emailExisting).trim()
    : `${cleanSlug}.${nikTail}@warga.sidoarjo.go.id`;

  // Ekstraksi Kecamatan & Kelurahan/Desa dari alamat
  const matchKec = String(alamat || '').match(/Kec(?:\.|amatan)?\s*([A-Za-z\s]+)/i);
  const kecamatan = matchKec ? matchKec[1].trim() : 'Sidoarjo';
  const matchDesa = String(alamat || '').match(/(?:Desa|Kel(?:\.|urahan)?)\s*([A-Za-z\s]+)/i);
  const kelurahanDesa = matchDesa ? matchDesa[1].trim() : `Wilayah ${kecamatan}`;

  const KATALOG_BENTUK = [
    'Uang Tunai PKH/BLT (Transfer Bank Himbara) + Pangan Sembako (Beras 10 Kg)',
    'Uang Tunai BLT Dana Desa + Paket Pangan BPNT (Beras 10 Kg & Minyak)',
    'Bantuan Tunai KKS Terpadu + Sembako Pangan Non-Tunai (BPNT)',
    'Uang Tunai PKH Prioritas (Lansia/Anak Sekolah) + Beras Cadangan Pangan 10 Kg'
  ];
  const bentukDefault = KATALOG_BENTUK[idx % KATALOG_BENTUK.length];

  // Nominal per triwulan berdasarkan Desil (Desil 1: Rp 900.000, Desil 2: Rp 750.000, Desil 3-4: Rp 600.000)
  const hitungNominalPerDesil = (d: number) => {
    if (d <= 1) return 900000;
    if (d === 2) return 750000;
    if (d <= 4) return 600000;
    return 450000; // Bantuan perlindungan dasar / graduasi bertahap
  };

  const nomAwal = kategoriUtama === 'warga_baru'
    ? hitungNominalPerDesil(desilBaru)
    : hitungNominalPerDesil(desilLama);

  let nomAkhir = hitungNominalPerDesil(desilBaru);
  let bentukAkhir = bentukDefault;
  if (kategoriUtama === 'meninggal') {
    nomAkhir = 300000; // Santunan akhir / pengalihan ahli waris sebelum nonaktif
    bentukAkhir = 'Santunan Akhir Ahli Waris & Penutupan Kepesertaan (Wafat)';
  } else if (kategoriUtama === 'pindah_kota') {
    nomAkhir = 0;
    bentukAkhir = 'Dihentikan (Mutasi Pindah Kota Luar Kab. Sidoarjo)';
  } else if (kategoriUtama === 'ekonomi_membaik' && desilBaru > 4) {
    nomAkhir = 300000;
    bentukAkhir = 'Insentif Akhir Graduasi Mandiri Sejahtera (Tunai)';
  } else if (kategoriUtama === 'ekonomi_memburuk' || desilBaru < desilLama) {
    nomAkhir = Math.max(nomAwal + 150000, hitungNominalPerDesil(desilBaru));
    bentukAkhir = 'Uang Tunai Prioritas Utama (PKH + BLT) & Paket Sembako Lengkap (Beras 10 Kg)';
  }

  const fmtRp = (n: number) => `Rp ${Math.max(0, Math.round(n)).toLocaleString('id-ID')}`;

  const tahapanDefs: Array<{
    tahap_ke: 1 | 2 | 3 | 4;
    kode_tahap: string;
    nama_tahap: string;
    periode_bulan: string;
    tanggal_salur: string;
  }> = [
    { tahap_ke: 1, kode_tahap: `TW1-${tahun}`, nama_tahap: 'Penyaluran Awal (Tahap I / Triwulan I)', periode_bulan: `Januari – Maret ${tahun}`, tanggal_salur: `14 Maret ${tahun}` },
    { tahap_ke: 2, kode_tahap: `TW2-${tahun}`, nama_tahap: 'Penyaluran Tahap II (Triwulan II)', periode_bulan: `April – Juni ${tahun}`, tanggal_salur: `15 Juni ${tahun}` },
    { tahap_ke: 3, kode_tahap: `TW3-${tahun}`, nama_tahap: 'Penyaluran Tahap III (Triwulan III)', periode_bulan: `Juli – September ${tahun}`, tanggal_salur: `16 September ${tahun}` },
    { tahap_ke: 4, kode_tahap: `TW4-${tahun}`, nama_tahap: 'Penyaluran Akhir (Tahap IV / Triwulan IV)', periode_bulan: `Oktober – Desember ${tahun}`, tanggal_salur: `18 Desember ${tahun}` }
  ];

  const rincianTahap: RincianPenyaluranTahapItem[] = tahapanDefs.map((t) => {
    const isAwal = t.tahap_ke === 1;
    const isAkhir = t.tahap_ke === 4;
    let nom = nomAwal;
    let bentuk = bentukDefault;
    let statusSalur = 'Telah Disalurkan';

    if (kategoriUtama === 'warga_baru') {
      if (t.tahap_ke < 3) {
        nom = Math.round(nomAwal * 0.75);
        bentuk = 'Penyaluran Tahap Awal Terdaftar (Uang Tunai & Beras 10 Kg)';
      } else {
        nom = nomAkhir;
        bentuk = bentukAkhir;
      }
    } else if (isAkhir) {
      nom = nomAkhir;
      bentuk = bentukAkhir;
      if (kategoriUtama === 'pindah_kota') statusSalur = 'Dihentikan (Pindah Kota)';
      else if (kategoriUtama === 'meninggal') statusSalur = 'Santunan Akhir (Wafat)';
      else if (kategoriUtama === 'ekonomi_membaik' && desilBaru > 4) statusSalur = 'Tahap Akhir Graduasi';
    } else if (t.tahap_ke === 3 && (kategoriUtama === 'ekonomi_memburuk' || desilBaru < desilLama)) {
      nom = Math.round((nomAwal + nomAkhir) / 2);
    }

    return {
      tahap_ke: t.tahap_ke,
      kode_tahap: t.kode_tahap,
      nama_tahap: t.nama_tahap,
      periode_bulan: t.periode_bulan,
      tanggal_salur: t.tanggal_salur,
      nominal: nom,
      nominal_label: fmtRp(nom),
      bentuk_bantuan: isAwal ? bentukDefault : bentuk,
      status_salur: statusSalur
    };
  });

  const totalAkumulasi = rincianTahap.reduce((acc, r) => acc + r.nominal, 0);

  return {
    email_warga: emailWarga,
    kecamatan,
    kelurahan_desa: kelurahanDesa,
    penyaluran_awal_periode: `Tahap I (Jan–Mar ${tahun}) • 14 Mar ${tahun}`,
    nominal_penyaluran_awal: rincianTahap[0].nominal,
    nominal_penyaluran_awal_label: rincianTahap[0].nominal_label,
    bentuk_bantuan_awal: rincianTahap[0].bentuk_bantuan,
    penyaluran_akhir_periode: `Tahap IV (Okt–Des ${tahun}) • 18 Des ${tahun}`,
    nominal_penyaluran_akhir: rincianTahap[3].nominal,
    nominal_penyaluran_akhir_label: rincianTahap[3].nominal_label,
    bentuk_bantuan_akhir: rincianTahap[3].bentuk_bantuan,
    total_nominal_awal_sampai_akhir: totalAkumulasi,
    total_nominal_awal_sampai_akhir_label: fmtRp(totalAkumulasi),
    rincian_tahap_penyaluran: rincianTahap
  };
}

// ============================================================================
// GENERATOR & PENJELAJAH REKAP TAHUN ADAPTIF (>20 TAHUN KE BELAKANG & >20 TAHUN KE DEPAN)
// BESERTA 4 TRIWULAN DI SETIAP TAHUNNYA
// ============================================================================
function buildHistoricalPeriodeReport(tahun: number, triwulan: 1 | 2 | 3 | 4): RekapPeriodeReport {
  const kodePeriode = `TW${triwulan}-${tahun}`;
  const pubState = getStatusPublikasiRekap(kodePeriode, tahun);
  const cached = rekapHistoricalCache.get(kodePeriode);
  if (cached) {
    cached.is_published = pubState.is_published;
    cached.published_at = pubState.published_at;
    cached.published_by = pubState.published_by;
    return cached;
  }

  if (!latestRekapReport) {
    initBaselineDanRekapTriwulan(true);
  }

  const baseReport: RekapPeriodeReport = JSON.parse(JSON.stringify(latestRekapReport));
  const bulanSample = (triwulan - 1) * 3 + 1;
  const infoTw = getInfoTriwulan(bulanSample, tahun);
  const seed = Math.abs((tahun * 13) + (triwulan * 7));
  const nowYear = new Date().getFullYear();

  // Faktor skala ekonomi adaptif: mendukung >20 tahun ke belakang maupun >20 tahun ke depan
  let factorEkonomi = 1;
  if (tahun < nowYear) {
    const yearDiffPast = nowYear - tahun;
    factorEkonomi = Number(Math.max(0.22, Math.pow(0.955, yearDiffPast)).toFixed(3));
  } else if (tahun > nowYear) {
    const yearDiffFuture = tahun - nowYear;
    factorEkonomi = Number(Math.min(4.2, Math.pow(1.032, yearDiffFuture)).toFixed(3));
  }

  const KOTA_TUJUAN_HIST = ['Kota Surabaya', 'Kab. Gresik', 'Kab. Mojokerto', 'Kota Malang', 'Kab. Pasuruan', 'Kab. Lamongan'];
  const KECAMATAN_HIST = ['Kec. Waru', 'Kec. Sidoarjo', 'Kec. Sedati', 'Kec. Porong', 'Kec. Taman', 'Kec. Krian', 'Kec. Candi', 'Kec. Buduran', 'Kec. Gedangan'];

  let countPindahTempatTinggal = 0;
  let countPindahAlamat = 0;
  let countPindahKota = 0;
  let countMeninggal = 0;
  let countEkonomiMemburuk = 0;
  let countEkonomiMembaik = 0;
  let countWargaBaru = 0;
  let countTetap = 0;
  let countDesilDiturunkanPrioritas = 0;
  let countDesilGraduasiMandiri = 0;
  let countDesilDihentikanMutasi = 0;

  baseReport.items.forEach((it, idx) => {
    const itemSeed = (seed + idx * 5) % 11;
    if (it.kriteria_lama) {
      it.kriteria_lama.c1 = Math.max(150000, Math.round((it.kriteria_lama.c1 * factorEkonomi) / 10000) * 10000);
      it.kriteria_lama.c2 = Math.max(300000, Math.round((it.kriteria_lama.c2 * factorEkonomi) / 50000) * 50000);
    }
    it.kriteria_baru.c1 = Math.max(150000, Math.round((it.kriteria_baru.c1 * factorEkonomi) / 10000) * 10000);
    it.kriteria_baru.c2 = Math.max(300000, Math.round((it.kriteria_baru.c2 * factorEkonomi) / 50000) * 50000);

    // Variasikan beberapa kriteria C11-C39 pada rekap periode
    it.kriteria_baru.c11 = ((seed + idx) % 3) + 1;
    it.kriteria_baru.c16 = ((seed + idx + 1) % 3) + 1;
    it.kriteria_baru.c25 = ((seed + idx + 2) % 3) + 1;
    it.kriteria_baru.c38 = it.kategori_utama === 'ekonomi_memburuk' ? 3 : 1;

    const labelEra = tahun > nowYear ? `Proyeksi/Periode ${tahun}` : `Arsip ${tahun}`;

    if (idx === (seed % 5)) {
      it.kategori_utama = 'ekonomi_memburuk';
      it.kategori_list = ['ekonomi_memburuk', 'pindah_tempat_tinggal'];
      it.label_perubahan = ['Kondisi Ekonomi / Kriteria Memburuk', 'Berubah Tempat Tinggal'];
      it.tempat_tinggal_lama = 'Sewa / Kontrak';
      it.tempat_tinggal_baru = 'Menumpang / Tidak Layak';
      it.desil_lama = 5;
      it.desil_baru = 1 + (itemSeed % 2);
      it.arah_desil = 'turun_prioritas_naik';
      it.status_bansos_baru = 'Menerima Bansos';
      it.rincian_perubahan_kriteria = [
        `Periode ${infoTw.nama_triwulan} ${tahun}: C1 Penghasilan turun ke ${formatRupiahSingkat(it.kriteria_baru.c1)} (Memburuk)`,
        `C8 (Tempat Tinggal): ${it.tempat_tinggal_lama} → ${it.tempat_tinggal_baru}`,
        `C25 (Beban Hutang Pokok): Ringan → Berat (Memburuk)`,
        `C38 (Status Pekerjaan): Stabil → Terdampak PHK/Omzet Turun (Memburuk)`
      ];
      it.keterangan_desil_otomatis = `[${labelEra} - TW ${triwulan}] Kondisi memburuk → Desil otomatis diturunkan dari Desil ${it.desil_lama} ke Desil ${it.desil_baru}.`;
    } else if (it.kategori_utama === 'pindah_kota') {
      const kotaHist = KOTA_TUJUAN_HIST[Math.abs(tahun + triwulan) % KOTA_TUJUAN_HIST.length];
      it.kota_baru = `${kotaHist} (Luar Sidoarjo)`;
      it.alamat_baru = `Domisili Baru Wilayah ${kotaHist} (Mutasi ${infoTw.nama_triwulan} ${tahun})`;
      it.rincian_perubahan_kriteria = [
        `Mutasi domisili keluar Kabupaten Sidoarjo menuju ${kotaHist} pada ${infoTw.rentang_triwulan}.`
      ];
    } else if (it.kategori_utama === 'pindah_alamat') {
      const kecHist = KECAMATAN_HIST[Math.abs(tahun + triwulan + idx) % KECAMATAN_HIST.length];
      it.alamat_baru = `Perumahan Warga RT 0${(triwulan % 4) + 1}/RW 02, ${kecHist}, Kabupaten Sidoarjo (${tahun})`;
    }

    if (it.kategori_list.includes('pindah_tempat_tinggal')) countPindahTempatTinggal++;
    if (it.kategori_list.includes('pindah_alamat')) countPindahAlamat++;
    if (it.kategori_list.includes('pindah_kota')) {
      countPindahKota++;
      countDesilDihentikanMutasi++;
    }
    if (it.kategori_list.includes('meninggal')) {
      countMeninggal++;
      countDesilDihentikanMutasi++;
    }
    if (it.kategori_list.includes('ekonomi_memburuk')) {
      countEkonomiMemburuk++;
      countDesilDiturunkanPrioritas++;
    }
    if (it.kategori_list.includes('ekonomi_membaik')) {
      countEkonomiMembaik++;
      countDesilGraduasiMandiri++;
    }
    if (it.kategori_list.includes('warga_baru')) countWargaBaru++;
    if (it.kategori_utama === 'tetap') countTetap++;
    it.waktu_rekap = `${tahun}-${String(bulanSample + 2).padStart(2, '0')}-26 10:00`;

    const histSalur = buildRincianPenyaluranAwalAkhir({
      nik: it.nik,
      nama: it.nama,
      alamat: it.alamat_baru || it.alamat_lama,
      emailExisting: it.email_warga,
      desilLama: it.desil_lama,
      desilBaru: it.desil_baru,
      kategoriUtama: it.kategori_utama,
      tahun,
      triwulanAktif: triwulan,
      idx
    });
    Object.assign(it, histSalur);
  });

  const totalBerubah = baseReport.items.filter(i => i.kategori_utama !== 'tetap').length;
  const layakSalur = baseReport.items.filter(i => i.desil_baru <= 4 && !String(i.status_bansos_baru).includes('Tidak Menerima')).length;
  const totalNomAwalHist = baseReport.items.reduce((acc, i) => acc + (i.nominal_penyaluran_awal || 0), 0);
  const totalNomAkhirHist = baseReport.items.reduce((acc, i) => acc + (i.nominal_penyaluran_akhir || 0), 0);
  const totalAkumulasiHist = baseReport.items.reduce((acc, i) => acc + (i.total_nominal_awal_sampai_akhir || 0), 0);

  const sumberLabel = tahun > nowYear
    ? `Jadwal & Proyeksi Rekapitulasi Penyaluran 3 Bulanan (${infoTw.nama_triwulan} Tahun ${tahun})`
    : `Arsip Rekapitulasi Penyaluran 3 Bulanan (${infoTw.nama_triwulan} Tahun ${tahun})`;

  const histReport: RekapPeriodeReport = {
    ...baseReport,
    id: `REKAP-${kodePeriode}`,
    kode_periode: kodePeriode,
    nama_periode: `${infoTw.nama_triwulan} — ${infoTw.rentang_triwulan}`,
    triwulan_ke: triwulan,
    nama_triwulan: infoTw.nama_triwulan,
    rentang_bulan: infoTw.rentang_triwulan,
    jadwal_penyaluran: infoTw.jadwal_penyaluran,
    tahun,
    sumber_pembaruan: sumberLabel,
    waktu_rekap: `${tahun}-${String(bulanSample + 2).padStart(2, '0')}-26 10:00`,
    is_published: pubState.is_published,
    published_at: pubState.published_at,
    published_by: pubState.published_by,
    jadwal_status: {
      ...baseReport.jadwal_status,
      tahun,
      triwulan_ke: triwulan,
      kode_triwulan: kodePeriode,
      nama_triwulan: infoTw.nama_triwulan,
      rentang_triwulan: infoTw.rentang_triwulan,
      jadwal_penyaluran: infoTw.jadwal_penyaluran
    },
    ringkasan: {
      total_berubah: totalBerubah,
      pindah_tempat_tinggal: countPindahTempatTinggal,
      pindah_alamat: countPindahAlamat,
      pindah_kota: countPindahKota,
      meninggal: countMeninggal,
      ekonomi_memburuk: countEkonomiMemburuk,
      ekonomi_membaik: countEkonomiMembaik,
      warga_baru: countWargaBaru,
      tetap: countTetap,
      desil_diturunkan_prioritas: countDesilDiturunkanPrioritas,
      desil_graduasi_mandiri: countDesilGraduasiMandiri,
      desil_dihentikan_mutasi: countDesilDihentikanMutasi,
      layak_penyaluran_triwulan: layakSalur,
      total_nominal_penyaluran_awal: totalNomAwalHist,
      total_nominal_penyaluran_akhir: totalNomAkhirHist,
      total_akumulasi_penyaluran_awal_akhir: totalAkumulasiHist
    }
  };

  rekapHistoricalCache.set(kodePeriode, histReport);
  return histReport;
}

export function getRekapByTahunDanTriwulan(tahunInput?: number, triwulanInput?: number): RekapPeriodeReport {
  const nowYear = new Date().getFullYear();
  const tahun = (tahunInput && tahunInput >= 1900 && tahunInput <= 2150)
    ? Math.floor(tahunInput)
    : (jadwalConfig.custom_year ?? nowYear);

  const jadwalNow = getJadwalInputStatus();
  const triwulan = (triwulanInput && triwulanInput >= 1 && triwulanInput <= 4)
    ? (Math.floor(triwulanInput) as 1 | 2 | 3 | 4)
    : jadwalNow.triwulan_ke;

  jadwalConfig.custom_year = tahun;
  jadwalConfig.triwulan_aktif = triwulan;

  if (tahun === nowYear && triwulan === 4) {
    return jalankanRekapitulasiPerubahanData(
      wargaBaselineStore,
      wargaStore,
      latestRekapReport?.sumber_pembaruan || 'Rekapitulasi Penyaluran 3 Bulan Sekali (Triwulanan)'
    );
  }

  return buildHistoricalPeriodeReport(tahun, triwulan);
}

export function getDaftarTahun20Tahun(jumlahTahunMundur = 30, jumlahTahunMaju = 30) {
  const tahunSekarang = new Date().getFullYear();
  const tahunAktif = jadwalConfig.custom_year ?? tahunSekarang;
  const twAktif = jadwalConfig.triwulan_aktif ?? getJadwalInputStatus().triwulan_ke;

  const minYear = Math.min(tahunSekarang - Math.max(20, jumlahTahunMundur), tahunAktif - 5);
  const maxYear = Math.max(tahunSekarang + Math.max(20, jumlahTahunMaju), tahunAktif + 5);

  const daftarTahun = [];
  for (let y = maxYear; y >= minYear; y--) {
    const triwulanList = ([1, 2, 3, 4] as const).map(tw => {
      const rep = (y === tahunSekarang && tw === 4 && latestRekapReport)
        ? latestRekapReport
        : buildHistoricalPeriodeReport(y, tw);
      const pubState = getStatusPublikasiRekap(rep.kode_periode, y);
      return {
        triwulan_ke: tw,
        kode_periode: rep.kode_periode,
        nama_triwulan: rep.nama_triwulan,
        rentang_bulan: rep.rentang_bulan,
        jadwal_penyaluran: rep.jadwal_penyaluran,
        total_berubah: rep.ringkasan.total_berubah,
        ekonomi_memburuk: rep.ringkasan.ekonomi_memburuk,
        ekonomi_membaik: rep.ringkasan.ekonomi_membaik,
        pindah_tempat_tinggal: rep.ringkasan.pindah_tempat_tinggal,
        pindah_alamat: rep.ringkasan.pindah_alamat,
        pindah_kota: rep.ringkasan.pindah_kota,
        meninggal: rep.ringkasan.meninggal,
        layak_penyaluran_triwulan: rep.ringkasan.layak_penyaluran_triwulan,
        is_published: pubState.is_published,
        published_at: pubState.published_at,
        published_by: pubState.published_by,
        is_active: y === tahunAktif && tw === twAktif
      };
    });

    const totalMutasiTahun = triwulanList.reduce((acc, t) => acc + t.total_berubah, 0);
    const totalDesilTurunTahun = triwulanList.reduce((acc, t) => acc + t.ekonomi_memburuk, 0);
    const selisih = y - tahunSekarang;

    let labelTahun = `${y} (Tahun Berjalan)`;
    let kategoriWaktu: 'masa_lalu' | 'tahun_berjalan' | 'masa_depan' = 'tahun_berjalan';
    if (selisih < 0) {
      labelTahun = `${y} (${Math.abs(selisih)} Thn Lalu)`;
      kategoriWaktu = 'masa_lalu';
    } else if (selisih > 0) {
      labelTahun = `${y} (+${selisih} Thn ke Depan)`;
      kategoriWaktu = 'masa_depan';
    }

    daftarTahun.push({
      tahun: y,
      label_tahun: labelTahun,
      selisih_tahun: Math.abs(selisih),
      offset_tahun: selisih,
      kategori_waktu: kategoriWaktu,
      is_active: y === tahunAktif,
      total_mutasi_tahunan: totalMutasiTahun,
      total_desil_turun_tahunan: totalDesilTurunTahun,
      triwulan: triwulanList
    });
  }
  return daftarTahun;
}

// ============================================================================
// INISIALISASI BASELINE DATA LAMA & CONTOH REKAP TRIWULAN AWAL
// ============================================================================
let hasInitializedBaselineRekap = false;

export function initBaselineDanRekapTriwulan(force = false) {
  if (hasInitializedBaselineRekap && !force) return;
  if (wargaStore.length === 0) return;

  const hasPindahKota = wargaStore.some(w => w.nik === '3515990000000014');
  if (!hasPindahKota) {
    wargaStore.push({
      id: wargaStore.length + 1,
      nik: '3515990000000014',
      nama: 'KPM WILAYAH GEDANGAN 14 (MUTASI KOTA)',
      tempat_lahir: 'Sidoarjo',
      tanggal_lahir: '1982-06-12',
      alamat: 'Jl. Wonokromo Pasar No. 18, Kota Surabaya (Pindah Kota dari Kec. Gedangan)',
      no_hp: '081234560014',
      email: 'kpm.gedangan14@dinsos-sda.id',
      lat: -7.3878,
      lng: 112.7245,
      c1: 1100000,
      c2: 2500000,
      c3: 44,
      c4: 1,
      c5: 3,
      c6: 2,
      c7: 1,
      c8: 2,
      c9: 2,
      c10: 1,
      desil: 10,
      skor_saw: 0,
      rank_saw: wargaStore.length + 1,
      is_verified: true,
      status_validasi: 'Disetujui',
      status_salur: 'Dihentikan',
      status_bansos: 'Tidak Menerima (Pindah Kota)',
      prioritas: 'Dihentikan (Pindah Kota)',
      bukti_salur: '',
      catatan: 'Pindah domisili KK ke Kota Surabaya pada pemutakhiran data baru triwulan ini.',
      nominal_bantuan: '-',
      tanggal_salur: '-',
      created_at: '2026-09-25 09:00',
      status_mutasi: 'pindah_kota',
      kota_tujuan: 'Kota Surabaya'
    });
  }

  const hasMeninggal = wargaStore.some(w => w.nik === '3515990000000015');
  if (!hasMeninggal) {
    wargaStore.push({
      id: wargaStore.length + 1,
      nik: '3515990000000015',
      nama: 'ALM. KPM WILAYAH BUDURAN 15',
      tempat_lahir: 'Sidoarjo',
      tanggal_lahir: '1958-04-03',
      alamat: 'Kawasan Domisili Wilayah Kec. Buduran',
      no_hp: '081234560015',
      email: 'kpm.buduran15@dinsos-sda.id',
      lat: -7.4245,
      lng: 112.7231,
      c1: 800000,
      c2: 1500000,
      c3: 68,
      c4: 1,
      c5: 1,
      c6: 3,
      c7: 0,
      c8: 3,
      c9: 1,
      c10: 2,
      desil: 10,
      skor_saw: 0,
      rank_saw: wargaStore.length + 1,
      is_verified: true,
      status_validasi: 'Disetujui',
      status_salur: 'Dihentikan',
      status_bansos: 'Tidak Menerima (Meninggal Dunia)',
      prioritas: 'Dihentikan (Meninggal Dunia)',
      bukti_salur: '',
      catatan: 'Warga dilaporkan Meninggal Dunia berdasarkan Akta Kematian desa setempat.',
      nominal_bantuan: '-',
      tanggal_salur: '-',
      created_at: '2026-09-25 09:00',
      status_mutasi: 'meninggal'
    });
  }

  const baselineLama: WargaItem[] = JSON.parse(JSON.stringify(wargaStore));

  baselineLama.forEach(oldW => {
    if (oldW.nik === '3515990000000001') {
      oldW.c1 = 1850000;
      oldW.c2 = 6200000;
      oldW.c5 = 2;
      oldW.c8 = 2;
      oldW.c10 = 1;
      oldW.desil = 5;
      oldW.skor_saw = 0.512;
      oldW.status_bansos = 'Tidak Menerima';
    } else if (oldW.nik === '3515990000000003') {
      oldW.alamat = 'Jl. Lama Betro RT 02 / RW 01, Desa Betro, Kec. Sedati';
      oldW.c1 = 1650000;
      oldW.c5 = 3;
      oldW.c8 = 1;
      oldW.desil = 5;
      oldW.skor_saw = 0.534;
      oldW.status_bansos = 'Tidak Menerima';
    } else if (oldW.nik === '3515990000000005') {
      oldW.alamat = 'Dusun Renokenongo Lama RT 04/RW 02, Kec. Porong';
      oldW.c1 = 1350000;
      oldW.c2 = 3500000;
      oldW.c8 = 2;
      oldW.c10 = 1;
      oldW.desil = 4;
      oldW.skor_saw = 0.625;
      oldW.status_bansos = 'Menerima Bansos';
    } else if (oldW.nik === '3515990000000006') {
      oldW.c1 = 820000;
      oldW.c2 = 1600000;
      oldW.c8 = 3;
      oldW.desil = 2;
      oldW.skor_saw = 0.782;
      oldW.status_bansos = 'Menerima Bansos';
    } else if (oldW.nik === '3515990000000008') {
      oldW.alamat = 'Jl. Raya Anggaswangi RT 01/RW 03, Kec. Sukodono';
      oldW.c8 = 1;
      oldW.desil = 6;
      oldW.skor_saw = 0.51;
    } else if (oldW.nik === '3515990000000011') {
      oldW.c1 = 850000;
      oldW.c2 = 1800000;
      oldW.c5 = 4;
      oldW.c8 = 3;
      oldW.desil = 2;
      oldW.skor_saw = 0.768;
      oldW.status_bansos = 'Menerima Bansos';
    } else if (oldW.nik === '3515990000000014') {
      oldW.alamat = 'Desa Keboansikep RT 03/RW 02, Kec. Gedangan, Kabupaten Sidoarjo';
      oldW.desil = 2;
      oldW.skor_saw = 0.745;
      oldW.status_bansos = 'Menerima Bansos';
      oldW.status_salur = 'Telah Menerima';
      delete (oldW as any).status_mutasi;
      delete (oldW as any).kota_tujuan;
    } else if (oldW.nik === '3515990000000015') {
      oldW.nama = 'KPM WILAYAH BUDURAN 15';
      oldW.desil = 1;
      oldW.skor_saw = 0.842;
      oldW.status_bansos = 'Menerima Bansos';
      oldW.status_salur = 'Telah Menerima';
      oldW.catatan = 'Lansia prasejahtera penerima aktif';
      delete (oldW as any).status_mutasi;
    }
  });

  setWargaBaselineStore(baselineLama);
  jalankanRekapitulasiPerubahanData(
    wargaBaselineStore,
    wargaStore,
    'Sinkronisasi Awal Data Lama vs Data Baru (Siklus Penyaluran 3 Bulan Sekali)'
  );
  hasInitializedBaselineRekap = true;
}

// ============================================================================
// SIMULASI MASUKNYA DATA BARU (UNTUK PENGUJIAN 1-KLIK DI DASHBOARD)
// ============================================================================
export function jalankanSimulasiDataBaruMasuk(): RekapPeriodeReport {
  if (wargaStore.length === 0) {
    initBaselineDanRekapTriwulan(true);
  }

  const snapshotLama: WargaItem[] = JSON.parse(JSON.stringify(wargaStore));
  snapshotLama.forEach(oldW => {
    if (oldW.nik === '3515990000000001') {
      oldW.c1 = 1900000;
      oldW.c2 = 6500000;
      oldW.c8 = 1;
      oldW.desil = 6;
      oldW.skor_saw = 0.495;
      oldW.status_bansos = 'Tidak Menerima';
    } else if (oldW.nik === '3515990000000003') {
      oldW.alamat = 'Jl. Raya Pulungan Lama RT 01/RW 02, Kec. Sedati, Kabupaten Sidoarjo';
      oldW.c1 = 1600000;
      oldW.c5 = 2;
      oldW.c8 = 1;
      oldW.desil = 5;
      oldW.skor_saw = 0.525;
      oldW.status_bansos = 'Tidak Menerima';
    } else if (oldW.nik === '3515990000000004') {
      oldW.alamat = 'Jl. Diponegoro No. 10 RT 02/RW 01, Kec. Sidoarjo';
      oldW.c1 = 1300000;
      oldW.c8 = 1;
      oldW.desil = 4;
      oldW.skor_saw = 0.610;
    } else if (oldW.nik === '3515990000000006') {
      oldW.c1 = 800000;
      oldW.c2 = 1500000;
      oldW.c8 = 3;
      oldW.desil = 2;
      oldW.skor_saw = 0.790;
      oldW.status_bansos = 'Menerima Bansos';
    } else if (oldW.nik === '3515990000000007') {
      oldW.c1 = 1750000;
      oldW.c2 = 5000000;
      oldW.c5 = 2;
      oldW.c8 = 2;
      oldW.c10 = 1;
      oldW.desil = 5;
      oldW.skor_saw = 0.515;
      oldW.status_bansos = 'Tidak Menerima';
    } else if (oldW.nik === '3515990000000011') {
      oldW.c1 = 780000;
      oldW.c2 = 1400000;
      oldW.c8 = 3;
      oldW.desil = 1;
      oldW.skor_saw = 0.815;
      oldW.status_bansos = 'Menerima Bansos';
    } else if (oldW.nik === '3515990000000014') {
      oldW.alamat = 'Desa Keboansikep RT 03/RW 02, Kec. Gedangan, Kabupaten Sidoarjo';
      oldW.desil = 2;
      oldW.skor_saw = 0.745;
      oldW.status_bansos = 'Menerima Bansos';
      delete (oldW as any).status_mutasi;
      delete (oldW as any).kota_tujuan;
    } else if (oldW.nik === '3515990000000015') {
      oldW.nama = 'KPM WILAYAH BUDURAN 15';
      oldW.desil = 1;
      oldW.skor_saw = 0.842;
      oldW.status_bansos = 'Menerima Bansos';
      delete (oldW as any).status_mutasi;
    }
  });
  setWargaBaselineStore(snapshotLama);

  wargaStore.forEach(w => {
    w.extra_data = w.extra_data || {};
    if (w.nik === '3515990000000001') {
      w.c1 = 650000;
      w.c2 = 1200000;
      w.c5 = 5;
      w.c8 = 3;
      w.c10 = 2;
      w.extra_data.c16 = 3;
      w.extra_data.c25 = 3;
      w.extra_data.c38 = 3;
      w.catatan = 'Data Baru: Kepala keluarga terkena PHK (C38=3) & jatuh sakit menahun, kondisi ekonomi memburuk drastis.';
      (w as any).status_mutasi = 'ekonomi_memburuk';
    } else if (w.nik === '3515990000000003') {
      w.alamat = 'Perum Pesisir Kalanganyar RT 05/RW 03, Desa Kalanganyar, Kec. Sedati, Kabupaten Sidoarjo';
      w.c1 = 900000;
      w.c5 = 5;
      w.c8 = 3;
      w.extra_data.c15 = 3;
      w.extra_data.c31 = 3;
      w.catatan = 'Data Baru: Pindah alamat & tempat tinggal ke Desa Kalanganyar (menumpang), tanggungan bertambah jadi 5 jiwa.';
      (w as any).status_mutasi = 'pindah_tempat_tinggal';
    } else if (w.nik === '3515990000000004') {
      w.alamat = 'Jl. Pahlawan Baru RT 06/RW 02, Kel. Lemahputro, Kec. Sidoarjo, Kabupaten Sidoarjo';
      w.c8 = 2;
      w.catatan = 'Data Baru: Pindah alamat kontrakan ke Kel. Lemahputro RT 06/RW 02 Kec. Sidoarjo.';
      (w as any).status_mutasi = 'pindah_alamat';
    } else if (w.nik === '3515990000000006') {
      w.c1 = 2850000;
      w.c2 = 14000000;
      w.c8 = 1;
      w.extra_data.c28 = 1;
      w.catatan = 'Data Baru: Kondisi ekonomi membaik (usaha kuliner berkembang & memiliki rumah sendiri), graduasi mandiri.';
      (w as any).status_mutasi = 'ekonomi_membaik';
    } else if (w.nik === '3515990000000007') {
      w.c1 = 780000;
      w.c2 = 1500000;
      w.c5 = 4;
      w.c8 = 3;
      w.c10 = 2;
      w.extra_data.c31 = 3;
      w.catatan = 'Data Baru: Kriteria ekonomi memburuk (usaha mikro terdampak banjir & tanggungan naik).';
      (w as any).status_mutasi = 'ekonomi_memburuk';
    } else if (w.nik === '3515990000000011') {
      w.c1 = 3400000;
      w.c2 = 18500000;
      w.c5 = 2;
      w.c8 = 1;
      w.catatan = 'Data Baru: Diangkat menjadi karyawan tetap, penghasilan Rp 3.400.000/bln (Ekonomi Membaik).';
      (w as any).status_mutasi = 'ekonomi_membaik';
    } else if (w.nik === '3515990000000014') {
      w.alamat = 'Jl. Wonokromo Pasar No. 18, Kota Surabaya (Pindah Kota dari Kec. Gedangan)';
      w.catatan = 'Data Baru: Pindah Kota domisili KK ke Kota Surabaya, bantuan Kab. Sidoarjo dihentikan.';
      (w as any).status_mutasi = 'pindah_kota';
      (w as any).kota_tujuan = 'Kota Surabaya';
    } else if (w.nik === '3515990000000015') {
      w.nama = 'ALM. KPM WILAYAH BUDURAN 15';
      w.catatan = 'Data Baru: Warga telah Meninggal Dunia sesuai laporan RT/RW dan Akta Kematian desa.';
      (w as any).status_mutasi = 'meninggal';
    }
  });

  const report = jalankanRekapitulasiPerubahanData(
    wargaBaselineStore,
    wargaStore,
    'Simulasi Masuknya Data Baru & Evaluasi Mutasi Desil Otomatis (C1–C39)'
  );

  catatNotifikasi(
    `[Rekap Triwulan] Pemutakhiran data baru selesai direkap (${report.nama_periode}): ${report.ringkasan.total_berubah} perubahan terdeteksi, ${report.ringkasan.desil_diturunkan_prioritas} warga diturunkan desilnya ke prioritas utama, ${report.ringkasan.desil_graduasi_mandiri} graduasi membaik, dan ${report.ringkasan.desil_dihentikan_mutasi} dihentikan (meninggal/pindah kota).`,
    'Sistem SPK',
    'rekap'
  );

  return report;
}

// ============================================================================
// IMPORT OTOMATIS KONDISI / MUTASI DARI EXCEL, PDF, & WORD (SATU / SEMUA WARGA)
// ============================================================================
export function jalankanImportMutasiOtomatis(
  rowsInput: any[],
  options: {
    mode?: 'all' | 'single';
    targetNik?: string;
    sumberFile?: string;
    formatFile?: string;
    tahun?: number;
    triwulan?: number;
    autoPublish?: boolean;
  } = {}
) {
  if (wargaStore.length === 0 || wargaBaselineStore.length === 0) {
    initBaselineDanRekapTriwulan(true);
  }

  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (rows.length === 0) {
    throw new Error('Tidak ada baris data warga yang dapat diproses dari berkas yang diimpor.');
  }

  if (options.tahun && options.tahun >= 1900 && options.tahun <= 2150) {
    jadwalConfig.custom_year = Math.floor(options.tahun);
  }
  if (options.triwulan && options.triwulan >= 1 && options.triwulan <= 4) {
    jadwalConfig.triwulan_aktif = Math.floor(options.triwulan) as 1 | 2 | 3 | 4;
  }

  let updatedCount = 0;
  let addedCount = 0;
  const affectedNiks: string[] = [];

  rows.forEach((rawRow, idx) => {
    if (!rawRow || typeof rawRow !== 'object') return;

    const getField = (candidates: string[]) => {
      for (const c of candidates) {
        const cleanC = c.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [k, v] of Object.entries(rawRow)) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanK === cleanC && v !== undefined && v !== null && String(v).trim() !== '') {
            return v;
          }
        }
      }
      return undefined;
    };

    let nikStr = String(
      (options.mode === 'single' && options.targetNik)
        ? options.targetNik
        : (getField(['nik', 'nomornik', 'nomorindukkependudukan', 'noktp']) || '')
    ).replace(/[^0-9]/g, '');

    const namaStr = String(getField(['nama', 'namalengkap', 'namawarga', 'namapemohon']) || '').trim();
    const alamatBaru = String(getField(['alamatbaru', 'alamat', 'alamatdomisili', 'alamatlengkap']) || '').trim();
    const jenisMutasiRaw = String(getField(['jenismutasi', 'statusmutasi', 'mutasi', 'kondisi', 'statusperubahan']) || '').toLowerCase().trim();
    const kotaTujuan = String(getField(['kotatujuan', 'kotabaru', 'pindahkota']) || '').trim();
    const catatanBaru = String(getField(['catatan', 'keterangan', 'alasan', 'catatanperubahan']) || '').trim();

    let w = wargaStore.find(item => String(item.nik).trim() === nikStr);
    if (!w && namaStr) {
      w = wargaStore.find(item => String(item.nama || '').toLowerCase().trim() === namaStr.toLowerCase());
    }

    if (!w) {
      if (!nikStr || nikStr.length < 8) {
        nikStr = `351599${String(Date.now() + idx).slice(-10)}`;
      }
      w = {
        id: wargaStore.length + 1,
        nik: nikStr,
        nama: namaStr ? namaStr.toUpperCase() : `WARGA IMPOR BARU ${idx + 1}`,
        tempat_lahir: String(getField(['tempatlahir']) || 'Sidoarjo'),
        tanggal_lahir: String(getField(['tanggallahir', 'tgllahir']) || '1980-01-01'),
        alamat: alamatBaru || 'Kawasan Domisili Kabupaten Sidoarjo',
        no_hp: String(getField(['nohp', 'nowa', 'telepon']) || '081234567890'),
        email: String(getField(['email']) || `warga.${nikStr.slice(-4)}@dinsos-sda.id`),
        lat: -7.4478,
        lng: 112.7183,
        c1: 1200000,
        c2: 3000000,
        c3: 45,
        c4: 1,
        c5: 3,
        c6: 2,
        c7: 2,
        c8: 2,
        c9: 1,
        c10: 1,
        extra_data: {},
        desil: 4,
        skor_saw: 0.62,
        rank_saw: wargaStore.length + 1,
        is_verified: true,
        status_validasi: 'Disetujui',
        status_salur: 'Sedang Proses',
        status_bansos: 'Menerima Bansos',
        prioritas: 'Prioritas (Desil 1–4)',
        bukti_salur: '',
        catatan: catatanBaru || `Data baru hasil import otomatis (${options.formatFile || 'Dokumen'})`,
        nominal_bantuan: 'Rp 600.000 / KK',
        tanggal_salur: '-',
        created_at: nowTimeStr()
      };
      wargaStore.push(w);
      addedCount++;
    } else {
      updatedCount++;
      if (namaStr) w.nama = namaStr.toUpperCase();
      if (alamatBaru) w.alamat = alamatBaru;
      if (catatanBaru) w.catatan = catatanBaru;
    }

    w.extra_data = (w.extra_data && typeof w.extra_data === 'object') ? w.extra_data : {};

    // Deteksi jenis mutasi otomatis dari teks maupun kode
    let normalizedMutasi = '';
    if (jenisMutasiRaw.includes('meninggal') || jenisMutasiRaw.includes('wafat') || jenisMutasiRaw.includes('alm')) {
      normalizedMutasi = 'meninggal';
    } else if (jenisMutasiRaw.includes('kota') || jenisMutasiRaw.includes('luar')) {
      normalizedMutasi = 'pindah_kota';
    } else if (jenisMutasiRaw.includes('tempat') || jenisMutasiRaw.includes('hunian')) {
      normalizedMutasi = 'pindah_tempat_tinggal';
    } else if (jenisMutasiRaw.includes('alamat') || jenisMutasiRaw.includes('domisili')) {
      normalizedMutasi = 'pindah_alamat';
    } else if (jenisMutasiRaw.includes('memburuk') || jenisMutasiRaw.includes('turun') || jenisMutasiRaw.includes('phk')) {
      normalizedMutasi = 'ekonomi_memburuk';
    } else if (jenisMutasiRaw.includes('membaik') || jenisMutasiRaw.includes('graduasi') || jenisMutasiRaw.includes('mampu')) {
      normalizedMutasi = 'ekonomi_membaik';
    }

    if (normalizedMutasi) {
      (w as any).status_mutasi = normalizedMutasi;
      w.extra_data.status_mutasi = normalizedMutasi;
      if (normalizedMutasi === 'meninggal' && !w.nama.toUpperCase().startsWith('ALM.')) {
        w.nama = `ALM. ${w.nama}`;
      }
      if (normalizedMutasi === 'pindah_kota') {
        const kt = kotaTujuan || 'Kota Surabaya';
        (w as any).kota_tujuan = kt;
        w.extra_data.kota_tujuan = kt;
      }
    } else if (kotaTujuan) {
      (w as any).status_mutasi = 'pindah_kota';
      (w as any).kota_tujuan = kotaTujuan;
      w.extra_data.status_mutasi = 'pindah_kota';
      w.extra_data.kota_tujuan = kotaTujuan;
    }

    // Perbarui nilai Kriteria C1 s/d C39+ secara dinamis
    for (const def of katalogKriteriaDinamis) {
      const kLower = def.key; // c1..c39
      const kUpper = def.kode; // C1..C39
      const rawVal = rawRow[kLower] ?? rawRow[kUpper] ?? getField([kLower, `kriteria${def.nomor}`, `k${def.nomor}`]);
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
        const cleaned = String(rawVal).replace(/[^0-9.-]/g, '');
        const numVal = Number(cleaned);
        if (Number.isFinite(numVal)) {
          if (def.nomor <= 10) {
            (w as any)[kLower] = def.nomor <= 2 ? Math.max(0, numVal) : Math.round(numVal);
          } else {
            (w as any)[kLower] = numVal;
            w.extra_data[kLower] = numVal;
          }
        }
      }
    }

    affectedNiks.push(w.nik);
  });

  const sumberLabel = `Import Otomatis ${String(options.formatFile || 'Berkas').toUpperCase()} (${options.sumberFile || 'Data Mutasi Warga'} — ${updatedCount} Diperbarui, ${addedCount} Baru)`;
  const report = jalankanRekapitulasiPerubahanData(
    wargaBaselineStore,
    wargaStore,
    sumberLabel
  );

  if (options.autoPublish !== false) {
    setStatusPublikasiRekap(report.kode_periode, true, 'Sistem Import Otomatis Dinsos');
    report.is_published = true;
  }

  rekapHistoricalCache.set(report.kode_periode, JSON.parse(JSON.stringify(report)));

  catatNotifikasi(
    `[Import Otomatis Rekap 3 Bulanan] Berhasil mengimpor ${rows.length} baris dari berkas ${options.sumberFile || options.formatFile || 'Dokumen'} (${updatedCount} diperbarui, ${addedCount} warga baru). Desil otomatis disesuaikan pada ${report.nama_periode}.`,
    'Admin / Petugas',
    'rekap'
  );

  return {
    report,
    updated_count: updatedCount,
    added_count: addedCount,
    total_processed: updatedCount + addedCount,
    affected_niks: affectedNiks
  };
}

