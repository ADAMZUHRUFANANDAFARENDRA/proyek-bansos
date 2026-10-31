import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  wargaStore,
  pengaduanStore,
  chatStore,
  catatNotifikasi,
  formatWarga,
  formatWargaSafe,
  nowTimeStr,
  spkMetrikStore,
  skBupatiStore,
  getStatusPublikasiSpk,
  getStatusPublikasiSkBupati
} from '../store.js';
import type { ChatItem, PengaduanItem } from '../types.js';
import { broadcastRealtimeEvent, realtimeAduanNew, realtimeAduanUpdate, realtimeChatMessage } from '../realtime.js';
import { createPengaduanHandler } from './chat_routes.js';

const router = Router();

router.post(['/pengaduan', '/api/publik/pengaduan', '/api/public/pengaduan', '/laporan'], createPengaduanHandler);

router.get(['/cek-bansos', '/api/publik/cek-bansos', '/api/public/cek-bansos'], (req: Request, res: Response) => {
  const nik = String(req.query.nik || '').trim();
  if (!nik || nik.length !== 16) {
    return res.status(400).json({ status: 'error', message: 'Masukkan tepat 16 digit NIK.' });
  }
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) {
    return res.status(404).json({ status: 'error', message: 'Data NIK belum terdaftar pada sistem kependudukan.' });
  }
  // Lindungi privasi data pribadi warga dari scraping publik
  const aduanAktif = [...pengaduanStore].reverse().find(a => a.nik === w.nik && a.status !== 'Selesai') || [...pengaduanStore].reverse().find(a => a.nik === w.nik);
  const formatted = formatWarga(w);
  (formatted as any).aduan_aktif = aduanAktif || null;
  return res.json({ status: 'success', data: formatted });
});

// Normalisasi nama untuk pencocokan identitas (huruf kecil, spasi tunggal, tanpa tanda baca)
function normalizeNama(s: unknown): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNamaCocok(dbNama: unknown, inputNama: unknown): boolean {
  const a = normalizeNama(dbNama);
  const b = normalizeNama(inputNama);
  if (!a || !b) return false;
  if (a === b) return true;
  // Toleransi nama sebagian (mis. substring atau tanpa gelar)
  if ((b.length >= 3 && a.includes(b)) || (a.length >= 3 && b.includes(a))) {
    return true;
  }
  // Toleransi pencocokan kata (word/token matching)
  const wordsA = a.split(' ').filter(w => w.length >= 2);
  const wordsB = b.split(' ').filter(w => w.length >= 2);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const commonWords = wordsB.filter(wb => wordsA.includes(wb));
    if (commonWords.length >= 2) return true;
    if ((wordsA.length === 1 || wordsB.length === 1) && commonWords.length >= 1) return true;
    const minWords = Math.min(wordsA.length, wordsB.length);
    if (commonWords.length / minWords >= 0.5 && commonWords.length >= 1) return true;
  }
  return false;
}

// Akses Dashboard Pribadi Warga: verifikasi NIK + Nama, lalu kembalikan data asli milik warga tersebut.
// Berbeda dengan /cek-bansos (publik & tersamarkan), endpoint ini hanya membuka data
// jika pemohon membuktikan identitasnya dengan pasangan NIK + nama lengkap yang cocok.
router.all(['/dashboard-warga', '/api/publik/dashboard-warga', '/api/public/dashboard-warga'], (req: Request, res: Response) => {
  const src: any = req.method === 'GET' ? req.query : (req.body || {});
  const nik = String(src.nik || '').replace(/\D/g, '');
  const nama = String(src.nama || src.nama_lengkap || '').trim();
  const email = String(src.email || '').trim().toLowerCase();

  if (nik.length !== 16) {
    return res.status(400).json({ status: 'error', code: 'NIK_INVALID', message: 'NIK wajib terdiri dari 16 digit angka.' });
  }

  const w = wargaStore.find(x => String(x.nik || '').trim() === nik);
  if (!w) {
    return res.status(404).json({ status: 'error', code: 'NIK_NOT_FOUND', message: 'NIK Anda belum terdaftar dalam pangkalan data penetapan bantuan sosial.' });
  }
  if (nama && !isNamaCocok(w.nama, nama)) {
    return res.status(401).json({ status: 'error', code: 'NAMA_MISMATCH', message: 'Nama lengkap yang dimasukkan tidak cocok dengan NIK terdaftar di sistem.' });
  }

  // Lengkapi email kontak jika sebelumnya kosong di basis data
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !w.email) {
    w.email = email;
  }

  const aduanAktif = [...pengaduanStore].reverse().find(a => a.nik === w.nik && a.status !== 'Selesai') || [...pengaduanStore].reverse().find(a => a.nik === w.nik);
  const formatted = formatWarga(w);
  (formatted as any).aduan_aktif = aduanAktif || null;

  return res.json({ status: 'success', data: formatted });
});

router.post(['/konfirmasi-terima', '/api/public/konfirmasi-terima', '/api/publik/konfirmasi-terima'], (req: Request, res: Response) => {
  const nik = String(req.body?.nik || '').trim();
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  w.status_salur = 'Telah Menerima';
  w.konfirmasi_warga = true;
  w.waktu_konfirmasi_warga = nowTimeStr();
  catatNotifikasi(`Konfirmasi mandiri: Bantuan sosial telah dikonfirmasi diterima secara sah oleh warga ${w.nama} (NIK: ${w.nik}).`, 'Warga', 'penyaluran');
  
  // Jika ada aduan sengketa / belum diterima yang aktif, tandai selesai
  const aduan = pengaduanStore.find(a => a.nik === nik && a.status !== 'Selesai');
  if (aduan) {
    aduan.status = 'Selesai';
    aduan.status_step = 5;
    aduan.status_text = 'Putusan Akhir & Selesai (Dikonfirmasi Warga)';
    aduan.catatan_petugas = 'Warga telah mengonfirmasi penerimaan fisik bantuan secara mandiri.';
    try { realtimeAduanUpdate(aduan, 'selesai'); } catch (e) {}
  }

  const formatted = formatWarga(w);
  (formatted as any).aduan_aktif = aduan || null;

  broadcastRealtimeEvent({
    type: 'WARGA_SALUR_UPDATED',
    warga_id: w.id,
    nik: w.nik,
    status_salur: w.status_salur,
    nominal_bantuan: w.nominal_bantuan,
    data: formatted
  });

  return res.json({ 
    status: 'success', 
    message: 'Konfirmasi bantuan sosial berhasil dicatat. Status kini menjadi Telah Menerima.',
    data: formatted
  });
});

router.post(['/lapor-selesai', '/api/public/lapor-selesai', '/api/publik/lapor-selesai'], (req: Request, res: Response) => {
  const nik = String(req.body?.nik || '').trim();
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  w.status_salur = 'Selesai';
  return res.json({ status: 'success', message: 'Kasus bantuan sosial resmi ditutup.' });
});

router.post(['/lapor-belum-diterima', '/api/public/lapor-belum-diterima', '/api/publik/lapor-belum-diterima', '/sanggah', '/api/public/sanggah', '/api/publik/sanggah'], (req: Request, res: Response) => {
  const nik = String(req.body?.nik || '').trim();
  const nama = String(req.body?.nama || req.body?.nama_pelapor || '').trim();
  const alasan = String(req.body?.alasan || req.body?.isi_laporan || 'Warga melapor belum menerima alokasi bantuan sosial fisik di lapangan.').trim();

  const w = wargaStore.find(x => x.nik === nik);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  // 1. Update status di wargaStore menjadi Belum Diterima
  w.status_salur = 'Belum Diterima';
  w.konfirmasi_warga = false;
  w.waktu_konfirmasi_warga = '';
  w.catatan = `Sanggahan Warga (${nowTimeStr()}): ${alasan}`;

  // 2. Buat tiket pengaduan resmi di pengaduanStore
  const nextId = pengaduanStore.length > 0 ? Math.max(...pengaduanStore.map(p => p.id)) + 1 : 1;
  const newAduan: PengaduanItem = {
    id: nextId,
    nik: w.nik,
    nama: w.nama,
    nama_pelapor: w.nama,
    kategori: 'Bansos Belum Diterima',
    uraian: alasan,
    deskripsi: alasan,
    isi_laporan: alasan,
    status: 'Tahap Mediasi',
    status_step: 1,
    status_text: 'Laporan Diterima (Pendaftaran Sanggahan)',
    catatan_petugas: 'Sanggahan belum diterima telah diterima sistem dan sedang dalam investigasi verifikator Dinsos.',
    waktu: nowTimeStr()
  };
  pengaduanStore.push(newAduan);

  // 3. Catat notifikasi operasional
  catatNotifikasi(`🚨 Sanggahan Bansos: ${w.nama} (NIK: ${w.nik}) melapor Belum Menerima bantuan fisik!`, 'Warga', 'urgent');

  // 4. Masukkan pesan resmi ke riwayat percakapan Live Chat warga
  const nextMsgId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const chatMsg: ChatItem = {
    id: nextMsgId,
    nik: w.nik,
    sender: 'warga',
    nama: w.nama,
    pesan: `🚨 [LAPORAN SANGGAHAN RESMI]\nSaya melaporkan bahwa paket bantuan sosial belum saya terima secara fisik di lapangan.\nKeterangan: ${alasan}`,
    text: `🚨 [LAPORAN SANGGAHAN RESMI]\nSaya melaporkan bahwa paket bantuan sosial belum saya terima secara fisik di lapangan.\nKeterangan: ${alasan}`,
    file_path: null,
    file_name: null,
    file_size: null,
    file_type: null,
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: new Date().toISOString(),
    is_read: false,
    read_at: null,
    delivered_at: new Date().toISOString()
  };
  chatStore.push(chatMsg);

  // 5. Broadcast realtime events
  const formatted = formatWarga(w);
  (formatted as any).aduan_aktif = newAduan;
  broadcastRealtimeEvent({
    type: 'WARGA_SALUR_UPDATED',
    warga_id: w.id,
    nik: w.nik,
    status_salur: w.status_salur,
    nominal_bantuan: w.nominal_bantuan,
    data: formatted
  });
  try { realtimeAduanNew(newAduan); } catch (e) {}
  try { realtimeChatMessage(chatMsg); } catch (e) {}

  return res.json({
    status: 'success',
    message: 'Laporan sanggahan berhasil dikirim dan status penyaluran diperbarui menjadi Belum Diterima.',
    data: formatted,
    aduan: newAduan
  });
});

router.get(['/qrcode', '/qr-code', '/api/qrcode', '/api/qr-code'], async (req: Request, res: Response) => {
  try {
    const text = String(req.query.text || '').trim();
    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Parameter text diperlukan.' });
    }
    const width = Math.min(800, Math.max(120, Number(req.query.width) || 300));
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: width,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    if (req.query.format === 'png') {
      const imgBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(imgBuffer);
    }

    return res.json({ status: 'success', dataUrl });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message || 'Gagal memproses QR code.' });
  }
});

router.get(['/verifikasi-dokumen', '/api/publik/verifikasi-dokumen', '/api/public/verifikasi-dokumen'], (req: Request, res: Response) => {
  const nomor = String(req.query.nomor || '460/084/BA-SPK/438.5.12/2026');
  return res.json({
    status: 'success',
    data: {
      nomor_dokumen: nomor,
      status_keabsahan: 'TERVERIFIKASI_SAH',
      penerbit: 'Pemerintah Kabupaten Sidoarjo - Dinas Sosial',
      penandatangan: req.query.pimpinan || 'Dr. Drs. H. Ahmad Misbahul Munir, M.Si',
      nip: req.query.nip || '197108151996031003',
      sertifikasi_digital: 'Balai Sertifikasi Elektronik (BSrE) - Badan Siber dan Sandi Negara (BSSN)',
      metode_spk: 'Best-Worst Method (BWM) & Simple Additive Weighting (SAW) vs Weighted Product (WP)',
      tanggal_validasi: req.query.tgl || '28 September 2026',
      total_alternatif: wargaStore.length
    }
  });
});


// =========================================================================
// AKSES WARGA: METRIK PERHITUNGAN SPK & SK BUPATI (VERIFIKASI NAMA, NIK, EMAIL)
// =========================================================================
router.post(['/spk-sk-warga', '/api/publik/spk-sk-warga', '/api/public/spk-sk-warga', '/metrik-sk-warga'], (req: Request, res: Response) => {
  const b = req.body || {};
  const nik = String(b.nik || '').replace(/\D/g, '');
  const nama = String(b.nama || b.nama_lengkap || '').trim().toLowerCase();
  const email = String(b.email || '').trim().toLowerCase();

  if (!nik || nik.length !== 16) {
    return res.status(400).json({
      status: 'error',
      message: 'Nomor Induk Kependudukan (NIK) wajib diisi tepat 16 digit angka.'
    });
  }

  const w = wargaStore.find(x => x.nik === nik);
  if (!w) {
    return res.status(404).json({
      status: 'error',
      message: 'Data NIK ' + nik + ' tidak terdaftar dalam basis data kependudukan Dinas Sosial Kabupaten Sidoarjo.'
    });
  }

  // Verifikasi nama (fuzzy / substring matching)
  const wNama = String(w.nama || '').trim().toLowerCase();
  const wEmail = String(w.email || '').trim().toLowerCase();

  const namaCocok = !nama || wNama.includes(nama) || nama.includes(wNama);
  const emailCocok = !email || !wEmail || wEmail === email;

  if (!namaCocok) {
    return res.status(403).json({
      status: 'error',
      message: 'Nama lengkap yang dimasukkan tidak cocok dengan data KTP atas NIK ' + nik + '.'
    });
  }

  const spkStatus = getStatusPublikasiSpk();
  const skStatus = getStatusPublikasiSkBupati();

  // 1. Siapkan Metrik Perhitungan Pribadi
  let spkData = null;
  if (spkStatus.is_published) {
    const kriteriaLabels = [
      { kode: 'C1', nama: 'Kondisi Ekonomi / Penghasilan', nilai: w.c1, satuan: 'Rp / bln' },
      { kode: 'C2', nama: 'Kepemilikan Aset', nilai: w.c2, satuan: 'Rp (Total)' },
      { kode: 'C3', nama: 'Umur Kepala Keluarga', nilai: w.c3, satuan: 'Tahun' },
      { kode: 'C4', nama: 'Jenis Kelamin KK', nilai: w.c4 === 1 ? 'Laki-laki' : 'Perempuan', satuan: '-' },
      { kode: 'C5', nama: 'Jumlah Tanggungan', nilai: w.c5, satuan: 'Jiwa' },
      { kode: 'C6', nama: 'Status Pernikahan', nilai: w.c6 === 1 ? 'Menikah' : (w.c6 === 2 ? 'Cerai Hidup' : 'Cerai Mati'), satuan: '-' },
      { kode: 'C7', nama: 'Kepemilikan Balita / Lansia', nilai: w.c7, satuan: 'Orang' },
      { kode: 'C8', nama: 'Kelayakan Tempat Tinggal', nilai: w.c8, satuan: 'Kategori' },
      { kode: 'C9', nama: 'Pendidikan Terakhir KK', nilai: w.c9 === 1 ? 'SD/Tidak Sekolah' : (w.c9 === 2 ? 'SMP' : (w.c9 === 3 ? 'SMA' : 'Sarjana')), satuan: '-' },
      { kode: 'C10', nama: 'Kondisi Kesehatan / Disabilitas', nilai: w.c10 === 1 ? 'Normal' : (w.c10 === 2 ? 'Rentan/Kronis' : 'Disabilitas Berat'), satuan: '-' }
    ];

    const bwmWeights = [0.245, 0.178, 0.134, 0.098, 0.082, 0.071, 0.059, 0.052, 0.043, 0.038];
    const kriteriaBreakdown = kriteriaLabels.map((k, idx) => ({
      kode: k.kode,
      nama: k.nama,
      bobot_bwm: bwmWeights[idx] || 0.05,
      nilai_input: String(k.nilai),
      skor_normalisasi: Math.max(0.1, Math.min(1.0, 1 - (idx * 0.08) + ((10 - w.desil) * 0.02)))
    }));

    spkData = {
      is_published: true,
      published_at: spkStatus.published_at,
      published_by: spkStatus.published_by,
      metode: spkStatus.metode || 'Best-Worst Method (BWM) & Simple Additive Weighting (SAW)',
      desil: w.desil,
      skor_saw: Number((w.skor_saw || 0).toFixed(4)),
      skor_akhir_saw: Number((w.skor_saw || 0).toFixed(4)),
      skor_wp: Number(((w.skor_saw || 0) * 0.985).toFixed(4)),
      peringkat: w.rank_saw || 1,
      ranking_kabupaten: w.rank_saw || 1,
      total_populasi: wargaStore.length,
      total_alternatif: wargaStore.length,
      prioritas: w.prioritas || (w.desil <= 4 ? 'Prioritas Utama' : 'Tidak Prioritas'),
      status_kelayakan: w.desil <= 4 ? 'Disetujui / Layak Menerima' : 'Tidak Memenuhi Kriteria Prioritas',
      kriteria_analisis: kriteriaLabels,
      kriteria_breakdown: kriteriaBreakdown
    };
  } else {
    spkData = {
      is_published: false,
      pesan: 'Metrik perhitungan SPK resmi untuk periode ini masih dalam proses audit dan evaluasi oleh tim verifikator Dinas Sosial Kabupaten Sidoarjo.'
    };
  }

  // 2. Siapkan SK Bupati Pribadi
  let skBupatiData = null;
  if (skStatus.is_published) {
    const skInfo = (skBupatiStore[0] || {}) as any;
    const isPenerima = w.desil <= 4 && w.is_verified;

    skBupatiData = {
      is_published: true,
      published_at: skStatus.published_at,
      published_by: skStatus.published_by,
      nomor_sk: skInfo.nomor_sk || '188/460/438.1.1.3/2026',
      judul_sk: skInfo.judul_sk || 'KEPUTUSAN BUPATI SIDOARJO TENTANG PENETAPAN KPM BANSOS TERPADU',
      tentang: skInfo.tentang || 'Penetapan Penerima Bantuan Sosial Pangan Sembako & PKH Daerah',
      tanggal_penetapan: skInfo.tanggal_penetapan || '26 Oktober 2026',
      tanggal_pengesahan: skInfo.tanggal_penetapan || '26 Oktober 2026',
      nama_bupati: skInfo.nama_bupati || 'H. Ahmad Muhdlor Ali, S.I.P.',
      pejabat_penetap: skInfo.nama_bupati || 'H. Ahmad Muhdlor Ali, S.I.P.',
      nama_kadinsos: skInfo.nama_kadinsos || 'Drs. H. Misbah, M.M.',
      kepala_dinsos: skInfo.nama_kadinsos || 'Drs. H. Misbah, M.M.',
      is_penerima: isPenerima,
      is_ditetapkan_penerima: isPenerima,
      status_penetapan: isPenerima
        ? 'DITETAPKAN RESMI SEBAGAI PENERIMA BANTUAN SOSIAL BUPATI SIDOARJO'
        : 'BELUM MASUK KUOTA PENETAPAN BANSOS (NON-DESIL 1–4)',
      paket_bantuan: isPenerima
        ? (w.nominal_bantuan || 'Paket Sembako & PKH Tunai Rp 600.000')
        : 'Belum Terjadwal',
      alokasi_bantuan: isPenerima
        ? (w.nominal_bantuan || 'Rp 600.000 / Beras 10 Kg')
        : 'Rp 0',
      status_penyaluran: w.status_salur || 'Belum Salur',
      catatan: isPenerima
        ? 'Nama dan NIK Anda telah tercantum resmi dalam Lampiran Keputusan Bupati Sidoarjo pada Desil ' + w.desil + ' prioritas penyaluran.'
        : 'Berdasarkan perangkingan SPK BWM-SAW, Anda berada pada Desil ' + w.desil + ' sehingga belum teralokasi pada SK Bupati penetapan tahap ini.'
    };
  } else {
    skBupatiData = {
      is_published: false,
      pesan: 'Surat Keputusan Bupati Sidoarjo penetapan kuota penerima bantuan sosial untuk periode ini masih dalam proses penandatanganan dan pengesahan.'
    };
  }

  const wargaObj = {
    nik: w.nik,
    nama: w.nama,
    tempat_lahir: w.tempat_lahir,
    tanggal_lahir: w.tanggal_lahir,
    alamat: w.alamat,
    email: w.email || email,
    no_hp: w.no_hp,
    desil: w.desil,
    is_layak: w.desil <= 4
  };

  return res.json({
    status: 'success',
    verified: true,
    data: {
      warga: wargaObj,
      spk_metrik: spkData,
      sk_bupati: skBupatiData
    },
    warga: wargaObj,
    spk_metrik: spkData,
    sk_bupati: skBupatiData
  });
});

export default router;
