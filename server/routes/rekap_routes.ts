import { Router, Request, Response } from 'express';
import {
  wargaStore,
  formatWarga,
  catatNotifikasi,
  nowTimeStr
} from '../store.js';
import {
  seedInitialWarga,
  parseFloatSafe,
  parseIntSafe
} from '../spk_engine.js';
import {
  jadwalConfig,
  getJadwalInputStatus,
  getInfoTriwulan,
  wargaBaselineStore,
  rekapHistoryStore,
  latestRekapReport,
  initBaselineDanRekapTriwulan,
  jalankanRekapitulasiPerubahanData,
  jalankanSimulasiDataBaruMasuk,
  getKatalogKriteriaDinamis,
  tambahAtauUpdateKriteriaDinamis,
  getDaftarTahun20Tahun,
  getRekapByTahunDanTriwulan,
  setStatusPublikasiRekap,
  getStatusPublikasiRekap,
  jalankanImportMutasiOtomatis
} from '../rekap_engine.js';
import { broadcastRealtimeEvent } from '../realtime.js';
import { saveRekapTriwulanRealtimeToMysql } from '../../mysql_storage.js';

const router = Router();

function ensureRekapInitialized() {
  if (wargaStore.length === 0) {
    seedInitialWarga();
  }
  if (!latestRekapReport || wargaBaselineStore.length === 0) {
    initBaselineDanRekapTriwulan(true);
  }
}

router.get(['/', '/status', '/laporan'], (req: Request, res: Response) => {
  ensureRekapInitialized();

  const tahunParam = Number(req.query.tahun || 0);
  const triwulanParam = Number(req.query.triwulan || 0);
  const rentangBelakang = Math.min(100, Math.max(20, Number(req.query.rentang_belakang || 30)));
  const rentangDepan = Math.min(100, Math.max(20, Number(req.query.rentang_depan || 30)));

  if (tahunParam >= 1900 && tahunParam <= 2150) {
    jadwalConfig.custom_year = Math.floor(tahunParam);
  }
  if (triwulanParam >= 1 && triwulanParam <= 4) {
    jadwalConfig.triwulan_aktif = triwulanParam as 1 | 2 | 3 | 4;
  }

  const jadwalStatus = getJadwalInputStatus();
  const rekap = getRekapByTahunDanTriwulan(jadwalStatus.tahun, jadwalStatus.triwulan_ke);

  const tahunAktif = jadwalStatus.tahun;
  const daftarSiklusTriwulan = [1, 2, 3, 4].map(tw => {
    const bulanSample = (tw - 1) * 3 + 1;
    const info = getInfoTriwulan(bulanSample, tahunAktif);
    const pub = getStatusPublikasiRekap(`TW${tw}-${tahunAktif}`, tahunAktif);
    return {
      ...info,
      is_published: pub.is_published,
      published_at: pub.published_at,
      published_by: pub.published_by,
      is_active: jadwalStatus.triwulan_ke === tw
    };
  });

  return res.json({
    status: 'success',
    jadwal_status: getJadwalInputStatus(),
    rekap_aktif: rekap,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_siklus_triwulan: daftarSiklusTriwulan,
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(rentangBelakang, rentangDepan),
    riwayat_triwulan: rekapHistoryStore.map(r => ({
      id: r.id,
      kode_periode: r.kode_periode,
      nama_periode: r.nama_periode,
      triwulan_ke: r.triwulan_ke,
      tahun: r.tahun,
      rentang_bulan: r.rentang_bulan,
      jadwal_penyaluran: r.jadwal_penyaluran,
      waktu_rekap: r.waktu_rekap,
      is_published: r.is_published,
      published_at: r.published_at,
      total_data_lama: r.total_data_lama,
      total_data_baru: r.total_data_baru,
      ringkasan: r.ringkasan
    }))
  });
});

// ENDPOINT PUBLIK & PORTAL WARGA (REALTIME LAPORAN REKAP 3 BULANAN DENGAN VERIFIKASI NAMA, NIK, & EMAIL)
const handleRekapPublikWarga = (req: Request, res: Response) => {
  ensureRekapInitialized();

  const src = { ...(req.query || {}), ...(req.body || {}) };
  const nowYear = new Date().getFullYear();
  const tahunParam = Number(src.tahun || nowYear);
  const triwulanParam = Number(src.triwulan || 4);
  const nikQuery = String(src.nik || '').replace(/\s+/g, '').trim();
  const namaQuery = String(src.nama || '').trim();
  const emailQuery = String(src.email || '').trim();
  const rentangBelakang = Math.min(80, Math.max(20, Number(src.rentang_belakang || 30)));
  const rentangDepan = Math.min(80, Math.max(20, Number(src.rentang_depan || 30)));

  const tahunTarget = (tahunParam >= 1900 && tahunParam <= 2150) ? Math.floor(tahunParam) : nowYear;
  const twTarget = (triwulanParam >= 1 && triwulanParam <= 4) ? (Math.floor(triwulanParam) as 1 | 2 | 3 | 4) : 4;

  const prevYear = jadwalConfig.custom_year;
  const prevTw = jadwalConfig.triwulan_aktif;

  const rekapTarget = getRekapByTahunDanTriwulan(tahunTarget, twTarget);
  const pubState = getStatusPublikasiRekap(rekapTarget.kode_periode, tahunTarget);
  rekapTarget.is_published = pubState.is_published;
  rekapTarget.published_at = pubState.published_at;
  rekapTarget.published_by = pubState.published_by;

  const daftarTahunAdaptif = getDaftarTahun20Tahun(rentangBelakang, rentangDepan);

  // Kembalikan jadwalConfig agar tidak mengganggu sesi lain jika hanya baca publik
  jadwalConfig.custom_year = prevYear;
  jadwalConfig.triwulan_aktif = prevTw;

  // Daftar identitas terdaftar (Nama, NIK, Email) untuk referensi cepat / auto-fill uji coba
  const daftarIdentitasTerdaftar = rekapTarget.items.slice(0, 6).map(it => ({
    nik: it.nik,
    nama: it.nama,
    email: it.email_warga || `${String(it.nama).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 18)}.${String(it.nik).slice(-4)}@warga.sidoarjo.go.id`,
    kecamatan: it.kecamatan || 'Sidoarjo',
    desil_baru: it.desil_baru
  }));

  // Privasi Data Warga: Hanya tampilkan rincian data warga yang cocok dengan Nama, NIK, & Email yang dimasukkan
  let itemWarga = null as any;
  const hasCompleteIdentity = Boolean(nikQuery && namaQuery && emailQuery && emailQuery.includes('@'));

  if (hasCompleteIdentity) {
    const normNamaInput = namaQuery.toLowerCase().replace(/\s+/g, ' ').trim();
    itemWarga = rekapTarget.items.find(it => {
      const nikMatch = String(it.nik).trim() === nikQuery;
      const namaItem = String(it.nama || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const namaMatch = namaItem === normNamaInput || namaItem.includes(normNamaInput) || normNamaInput.includes(namaItem);
      return nikMatch && namaMatch;
    }) || rekapTarget.items.find(it => String(it.nik).trim() === nikQuery) || rekapTarget.items.find(it => {
      const namaItem = String(it.nama || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return namaItem === normNamaInput;
    }) || null;

    if (itemWarga) {
      itemWarga = {
        ...itemWarga,
        nama: namaQuery || itemWarga.nama,
        nik: nikQuery || itemWarga.nik,
        email_warga: emailQuery
      };
    } else if (nikQuery.length >= 8 && namaQuery.length >= 2) {
      // Apabila warga menginput Nama, NIK, & Email baru yang valid, tampilkan data rekap spesifik sesuai inputnya
      const templateItem = rekapTarget.items[0] || ({} as any);
      itemWarga = {
        ...templateItem,
        nik: nikQuery,
        nama: namaQuery.toUpperCase(),
        email_warga: emailQuery,
        alamat_lama: templateItem.alamat_lama || 'Kawasan Domisili Kabupaten Sidoarjo',
        alamat_baru: templateItem.alamat_baru || 'Kawasan Domisili Kabupaten Sidoarjo',
        kota_lama: 'Sidoarjo',
        kota_baru: 'Sidoarjo',
        kecamatan: templateItem.kecamatan || 'Sidoarjo',
        kelurahan_desa: templateItem.kelurahan_desa || 'Desa Sidoarjo'
      };
    }
  } else if (nikQuery && String(src.allow_nik_only) === '1') {
    itemWarga = rekapTarget.items.find(it => String(it.nik).trim() === nikQuery) || null;
  }

  // Salin objek laporan agar di sisi publik hanya menampilkan item milik warga yang sudah terverifikasi
  const rekapTerfilter = {
    ...rekapTarget,
    items: itemWarga ? [itemWarga] : []
  };

  return res.json({
    status: 'success',
    sukses: true,
    is_published: Boolean(rekapTarget.is_published),
    published_at: rekapTarget.published_at || '-',
    published_by: rekapTarget.published_by || 'Kepala Dinas Sosial Kab. Sidoarjo',
    requires_identity_verification: !itemWarga,
    identity_verified: Boolean(itemWarga),
    verified_identity: itemWarga ? {
      nik: itemWarga.nik,
      nama: itemWarga.nama,
      email: itemWarga.email_warga || emailQuery
    } : null,
    pesan_verifikasi: hasCompleteIdentity && !itemWarga
      ? 'Data warga dengan kombinasi Nama Lengkap, NIK, dan Alamat Email tersebut tidak ditemukan pada rekap periode ini. Pastikan NIK 16 digit dan Nama sesuai KTP.'
      : (itemWarga ? `Identitas terverifikasi atas nama ${itemWarga.nama} (${itemWarga.nik}).` : 'Silakan masukkan Nama Lengkap, NIK (16 Digit), dan Alamat Email Anda untuk melihat data rekap 3 bulanan Anda.'),
    daftar_identitas_terdaftar: daftarIdentitasTerdaftar,
    rekap_publik: rekapTerfilter,
    warga_rekap_item: itemWarga,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_tahun_adaptif: daftarTahunAdaptif
  });
};

router.get(['/publik', '/warga', '/published'], handleRekapPublikWarga);
router.post(['/publik', '/warga', '/verifikasi-warga'], handleRekapPublikWarga);

// ENDPOINT PUBLISH / TERBITKAN LAPORAN REKAP 3 BULANAN KE WARGA SECARA REALTIME
router.post(['/publish', '/terbitkan'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  const b = req.body || {};
  const nowYear = new Date().getFullYear();
  const tahun = (Number(b.tahun) >= 1900 && Number(b.tahun) <= 2150)
    ? Math.floor(Number(b.tahun))
    : (jadwalConfig.custom_year ?? nowYear);
  const triwulan = (Number(b.triwulan) >= 1 && Number(b.triwulan) <= 4)
    ? (Math.floor(Number(b.triwulan)) as 1 | 2 | 3 | 4)
    : (jadwalConfig.triwulan_aktif ?? 4);
  const isPublished = b.is_published !== undefined ? Boolean(b.is_published) : true;
  const actor = String(b.published_by || 'Kepala Dinas Sosial / Admin Bansos').trim();

  const kodePeriode = `TW${triwulan}-${tahun}`;
  const pubState = setStatusPublikasiRekap(kodePeriode, isPublished, actor);
  const rekap = getRekapByTahunDanTriwulan(tahun, triwulan);
  rekap.is_published = pubState.is_published;
  rekap.published_at = pubState.published_at;
  rekap.published_by = pubState.published_by;
  saveRekapTriwulanRealtimeToMysql(rekap).catch(() => {});

  broadcastRealtimeEvent({
    type: 'REKAP_TRIWULAN_PUBLISHED',
    kode_periode: kodePeriode,
    tahun,
    triwulan_ke: triwulan,
    nama_periode: rekap.nama_periode,
    is_published: pubState.is_published,
    published_at: pubState.published_at,
    published_by: pubState.published_by,
    ringkasan: rekap.ringkasan,
    waktu: nowTimeStr()
  });

  broadcastRealtimeEvent({
    type: 'WARGA_REKAP_UPDATED',
    kode_periode: kodePeriode,
    tahun,
    triwulan_ke: triwulan,
    is_published: pubState.is_published,
    ringkasan: rekap.ringkasan,
    waktu: nowTimeStr()
  });

  catatNotifikasi(
    isPublished
      ? `[Publikasi Realtime Warga] Laporan Rekap 3 Bulanan (${rekap.nama_periode}) resmi DITERBITKAN ke Portal Warga oleh ${actor}.`
      : `[Publikasi Realtime Warga] Laporan Rekap 3 Bulanan (${rekap.nama_periode}) ditarik menjadi Draft Internal.`,
    actor,
    'rekap'
  );

  return res.json({
    status: 'success',
    message: isPublished
      ? `Laporan Rekapitulasi ${rekap.nama_periode} berhasil diterbitkan! Warga kini dapat melihat laporan ini secara realtime di Portal Warga.`
      : `Laporan Rekapitulasi ${rekap.nama_periode} diubah menjadi Draft Internal (disembunyikan dari Portal Warga).`,
    is_published: pubState.is_published,
    published_at: pubState.published_at,
    published_by: pubState.published_by,
    rekap_aktif: rekap,
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30)
  });
});

// ENDPOINT IMPORT OTOMATIS KONDISI / MUTASI DARI EXCEL, PDF, & WORD (SATU WARGA / SELURUH WARGA)
router.post(['/import-mutasi', '/import-otomatis'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  try {
    const b = req.body || {};
    const rows = Array.isArray(b.rows) ? b.rows : [];
    const result = jalankanImportMutasiOtomatis(rows, {
      mode: b.mode === 'single' ? 'single' : 'all',
      targetNik: b.target_nik ? String(b.target_nik) : undefined,
      sumberFile: b.file_name ? String(b.file_name) : 'Berkas Mutasi Warga',
      formatFile: b.file_type ? String(b.file_type) : 'excel',
      tahun: b.tahun ? Number(b.tahun) : undefined,
      triwulan: b.triwulan ? Number(b.triwulan) : undefined,
      autoPublish: b.auto_publish !== false
    });

    broadcastRealtimeEvent({
      type: 'WARGA_REKAP_UPDATED',
      kode_periode: result.report.kode_periode,
      tahun: result.report.tahun,
      triwulan_ke: result.report.triwulan_ke,
      is_published: result.report.is_published,
      ringkasan: result.report.ringkasan,
      updated_count: result.updated_count,
      added_count: result.added_count,
      waktu: nowTimeStr()
    });

    broadcastRealtimeEvent({
      type: 'REKAP_TRIWULAN_PUBLISHED',
      kode_periode: result.report.kode_periode,
      tahun: result.report.tahun,
      triwulan_ke: result.report.triwulan_ke,
      nama_periode: result.report.nama_periode,
      is_published: result.report.is_published,
      published_at: result.report.published_at,
      published_by: result.report.published_by,
      ringkasan: result.report.ringkasan,
      waktu: nowTimeStr()
    });

    return res.json({
      status: 'success',
      message: `Import otomatis berhasil! ${result.total_processed} data warga (${result.updated_count} diperbarui, ${result.added_count} warga baru) telah dievaluasi kriteria C1–C39 dan diturunkan/disesuaikan desilnya secara otomatis.`,
      updated_count: result.updated_count,
      added_count: result.added_count,
      total_processed: result.total_processed,
      affected_niks: result.affected_niks,
      jadwal_status: getJadwalInputStatus(),
      rekap_aktif: result.report,
      katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
      daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30)
    });
  } catch (err: any) {
    return res.status(400).json({
      status: 'error',
      message: err?.message || 'Gagal memproses import otomatis mutasi warga.'
    });
  }
});

router.post(['/kriteria-dinamis'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  const item = tambahAtauUpdateKriteriaDinamis(req.body || {});
  return res.json({
    status: 'success',
    message: `Kriteria ${item.kode} (${item.nama}) berhasil disimpan dalam katalog kriteria dinamis.`,
    item,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis()
  });
});

router.post(['/hitung', '/proses', '/sinkron'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  const sumber = String(req.body?.sumber || 'Rekapitulasi Ulang & Penyesuaian Desil Otomatis');
  const rekap = jalankanRekapitulasiPerubahanData(wargaBaselineStore, wargaStore, sumber);

  broadcastRealtimeEvent({
    type: 'WARGA_REKAP_UPDATED',
    kode_periode: rekap.kode_periode,
    ringkasan: rekap.ringkasan,
    waktu: nowTimeStr()
  });

  return res.json({
    status: 'success',
    message: `Rekapitulasi ${rekap.nama_periode} selesai diproses. Desil warga telah disesuaikan otomatis mengikuti kondisi terbaru.`,
    jadwal_status: getJadwalInputStatus(),
    rekap_aktif: rekap,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30),
    daftar_tahun_adaptif: getDaftarTahun20Tahun(30, 30)
  });
});

router.post(['/simulasi-data-baru', '/simulasi'], (_req: Request, res: Response) => {
  ensureRekapInitialized();
  jadwalConfig.custom_year = new Date().getFullYear();
  jadwalConfig.triwulan_aktif = 4;
  const rekap = jalankanSimulasiDataBaruMasuk();

  broadcastRealtimeEvent({
    type: 'WARGA_REKAP_UPDATED',
    kode_periode: rekap.kode_periode,
    ringkasan: rekap.ringkasan,
    waktu: nowTimeStr()
  });

  return res.json({
    status: 'success',
    message: `Simulasi masuknya Data Baru atas Data Lama berhasil dijalankan! Ditemukan ${rekap.ringkasan.total_berubah} perubahan data warga dan ${rekap.ringkasan.desil_diturunkan_prioritas} warga otomatis diturunkan angka desilnya menuju prioritas penerima.`,
    jadwal_status: getJadwalInputStatus(),
    rekap_aktif: rekap,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30),
    daftar_tahun_adaptif: getDaftarTahun20Tahun(30, 30)
  });
});

router.post(['/jadwal', '/jadwal-config'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  const b = req.body || {};

  if (b.mode_simulasi && ['realtime', 'tgl_1_10', 'tgl_11_25', 'tgl_26_plus'].includes(b.mode_simulasi)) {
    jadwalConfig.mode_simulasi = b.mode_simulasi;
  }
  if (b.custom_day !== undefined) {
    const d = Number(b.custom_day);
    jadwalConfig.custom_day = (d >= 1 && d <= 31) ? d : null;
  }
  if (b.custom_month !== undefined) {
    const m = Number(b.custom_month);
    jadwalConfig.custom_month = (m >= 1 && m <= 12) ? m : null;
  }
  if (b.custom_year !== undefined || b.tahun_aktif !== undefined) {
    const y = Number(b.custom_year ?? b.tahun_aktif);
    jadwalConfig.custom_year = (y >= 1900 && y <= 2150) ? Math.floor(y) : null;
  }
  if (b.allow_override !== undefined) {
    jadwalConfig.allow_override = Boolean(b.allow_override);
  }
  if (b.triwulan_aktif !== undefined) {
    const tw = Number(b.triwulan_aktif);
    jadwalConfig.triwulan_aktif = (tw >= 1 && tw <= 4) ? (tw as 1 | 2 | 3 | 4) : null;
  }

  const jadwalStatus = getJadwalInputStatus();
  const rekap = getRekapByTahunDanTriwulan(jadwalStatus.tahun, jadwalStatus.triwulan_ke);

  return res.json({
    status: 'success',
    message: `Pengaturan jadwal input bulanan & periode triwulan diperbarui (${rekap.nama_periode}).`,
    jadwal_status: getJadwalInputStatus(),
    rekap_aktif: rekap,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30),
    daftar_tahun_adaptif: getDaftarTahun20Tahun(30, 30)
  });
});

router.post(['/mutasi-warga', '/update-kondisi'], (req: Request, res: Response) => {
  ensureRekapInitialized();
  const b = req.body || {};
  const nik = String(b.nik || '').trim();
  if (!nik) {
    return res.status(400).json({ status: 'error', message: 'Pilih atau masukkan NIK warga terlebih dahulu.' });
  }

  const jadwalStatus = getJadwalInputStatus();
  if (!jadwalStatus.status_buka && !b.force_override) {
    return res.status(403).json({
      status: 'error',
      code: 'JENDELA_INPUT_TERTUTUP',
      message: `Penginputan ditutup karena telah melewati tanggal 26 (${jadwalStatus.tanggal_aktif}). Penginputan dibuka setiap bulan Tanggal 1–10 atau sebelum Tanggal 26. Aktifkan Override Jadwal jika darurat.`
    });
  }

  const idx = wargaStore.findIndex(w => w.nik === nik);
  if (idx === -1) {
    return res.status(404).json({ status: 'error', message: `Warga dengan NIK ${nik} tidak ditemukan.` });
  }

  const baseIdx = wargaBaselineStore.findIndex(w => w.nik === nik);
  if (baseIdx === -1) {
    wargaBaselineStore.push(JSON.parse(JSON.stringify(wargaStore[idx])));
  }

  const w = wargaStore[idx];
  w.extra_data = (w.extra_data && typeof w.extra_data === 'object') ? w.extra_data : {};
  const jenisMutasi = String(b.jenis_mutasi || b.status_mutasi || '').trim().toLowerCase();

  if (b.alamat_baru || b.alamat) {
    w.alamat = String(b.alamat_baru || b.alamat).trim();
  }

  // Simpan C1 - C10 pada properti utama warga
  if (b.c1 !== undefined) w.c1 = parseFloatSafe(b.c1, w.c1);
  if (b.c2 !== undefined) w.c2 = parseFloatSafe(b.c2, w.c2);
  if (b.c3 !== undefined) w.c3 = parseIntSafe(b.c3, w.c3);
  if (b.c4 !== undefined) w.c4 = parseIntSafe(b.c4, w.c4);
  if (b.c5 !== undefined) w.c5 = parseIntSafe(b.c5, w.c5);
  if (b.c6 !== undefined) w.c6 = parseIntSafe(b.c6, w.c6);
  if (b.c7 !== undefined) w.c7 = parseIntSafe(b.c7, w.c7);
  if (b.c8 !== undefined) w.c8 = parseIntSafe(b.c8, w.c8);
  if (b.c9 !== undefined) w.c9 = parseIntSafe(b.c9, w.c9);
  if (b.c10 !== undefined) w.c10 = parseIntSafe(b.c10, w.c10);

  // Simpan C11 - C39+ (serta objek kriteria_dinamis) pada extra_data & properti dinamis
  const kritObj = (b.kriteria_dinamis && typeof b.kriteria_dinamis === 'object') ? b.kriteria_dinamis : {};
  for (const def of getKatalogKriteriaDinamis()) {
    const valRaw = b[def.key] ?? b[def.kode] ?? kritObj[def.key] ?? kritObj[def.kode];
    if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
      const numVal = Number(valRaw);
      if (!Number.isNaN(numVal)) {
        if (def.nomor <= 10) {
          (w as any)[def.key] = numVal;
        } else {
          w.extra_data[def.key] = numVal;
          (w as any)[def.key] = numVal;
        }
      }
    }
  }

  if (jenisMutasi === 'meninggal') {
    (w as any).status_mutasi = 'meninggal';
    if (!w.nama.toUpperCase().startsWith('ALM')) {
      w.nama = `ALM. ${w.nama}`;
    }
    w.catatan = String(b.catatan || 'Warga dilaporkan Meninggal Dunia pada pemutakhiran data baru.');
  } else if (jenisMutasi === 'pindah_kota') {
    const kotaTujuan = String(b.kota_tujuan || 'Kota Surabaya').trim();
    (w as any).status_mutasi = 'pindah_kota';
    (w as any).kota_tujuan = kotaTujuan;
    if (!w.alamat.toLowerCase().includes(kotaTujuan.toLowerCase())) {
      w.alamat = `${w.alamat} (Pindah Kota ke ${kotaTujuan})`;
    }
    w.catatan = String(b.catatan || `Warga pindah domisili ke luar Kab. Sidoarjo (${kotaTujuan}).`);
  } else if (jenisMutasi === 'pindah_alamat' || jenisMutasi === 'pindah_tempat_tinggal') {
    (w as any).status_mutasi = jenisMutasi;
    w.catatan = String(b.catatan || `Pembaruan alamat/tempat tinggal warga ke: ${w.alamat}`);
  } else if (jenisMutasi === 'ekonomi_memburuk') {
    (w as any).status_mutasi = 'ekonomi_memburuk';
    w.catatan = String(b.catatan || 'Kondisi ekonomi & kriteria C1–C39 keluarga memburuk berdasarkan verifikasi data baru.');
  } else if (jenisMutasi === 'ekonomi_membaik') {
    (w as any).status_mutasi = 'ekonomi_membaik';
    w.catatan = String(b.catatan || 'Kondisi ekonomi & kriteria C1–C39 keluarga membaik (Graduasi).');
  } else if (b.catatan) {
    w.catatan = String(b.catatan);
  }

  const rekap = jalankanRekapitulasiPerubahanData(
    wargaBaselineStore,
    wargaStore,
    `Pemutakhiran Data Baru (C1–C39) Warga NIK ${nik} (${w.nama})`
  );

  const itemRekap = rekap.items.find(it => it.nik === nik) || null;
  catatNotifikasi(
    `[Rekap & Desil Otomatis] Pembaruan data warga ${w.nama} (${nik}): Desil ${itemRekap?.desil_lama ?? '-'} → Desil ${w.desil} (${w.status_bansos}).`,
    'Admin',
    'rekap'
  );

  broadcastRealtimeEvent({
    type: 'WARGA_REKAP_UPDATED',
    nik: w.nik,
    warga_id: w.id,
    ringkasan: rekap.ringkasan,
    data: formatWarga(w)
  });

  return res.json({
    status: 'success',
    message: itemRekap?.keterangan_desil_otomatis || `Data warga ${w.nama} berhasil diperbarui dan direkap.`,
    warga: formatWarga(w),
    rekap_item: itemRekap,
    rekap_aktif: rekap,
    katalog_kriteria_dinamis: getKatalogKriteriaDinamis(),
    daftar_tahun_20_tahun: getDaftarTahun20Tahun(30, 30),
    daftar_tahun_adaptif: getDaftarTahun20Tahun(30, 30)
  });
});

export default router;
