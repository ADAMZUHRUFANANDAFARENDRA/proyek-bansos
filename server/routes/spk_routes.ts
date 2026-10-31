import { Router, Request, Response } from 'express';
import {
  kriteriaStore,
  wargaStore,
  catatNotifikasi,
  formatWarga,
  spkMetrikStore,
  skBupatiStore,
  getStatusPublikasiSpk,
  setStatusPublikasiSpk,
  getStatusPublikasiSkBupati,
  setStatusPublikasiSkBupati
} from '../store.js';
import { saveSpkMetrikRealtimeToMysql, saveSkBupatiRealtimeToMysql } from '../../mysql_storage.js';
import { broadcastRealtimeEvent } from '../realtime.js';
import {
  parseFloatSafe,
  parseIntSafe,
  hitungDanSinkronkanSawBwm,
  buildFullSawReport
} from '../spk_engine.js';

const router = Router();

router.get(['/init-kriteria', '/api/init-kriteria'], (_req: Request, res: Response) => {
  res.json({ status: 'success', data: kriteriaStore });
});

router.get(['/', '/kriteria', '/api/kriteria', '/bobot', '/api/bobot'], (_req: Request, res: Response) => {
  res.json(kriteriaStore);
});


router.get(['/bobot-bwm', '/api/bobot-bwm'], (_req: Request, res: Response) => {
  res.json({ status: 'success', bobot: kriteriaStore.map(k => k.bobot) });
});

function updateKriteriaBobotHandler(req: Request, res: Response) {
  const data = req.body || {};
  const bobotInput = data.bobot || data;

  if (Array.isArray(bobotInput)) {
    bobotInput.forEach(item => {
      const kode = String(item.kode || item.code || '').toUpperCase();
      const id = parseIntSafe(item.id, -1);
      const found = kriteriaStore.find(k => k.id === id || k.kode.toUpperCase() === kode);
      if (found) {
        found.bobot = parseFloatSafe(item.bobot ?? item.w, found.bobot);
        if (item.jenis || item.tipe || item.type) {
          const t = String(item.jenis || item.tipe || item.type).toLowerCase() === 'cost' ? 'cost' : 'benefit';
          found.tipe = t;
          found.jenis = t;
        }
      }
    });
  } else if (typeof bobotInput === 'object' && bobotInput !== null) {
    Object.entries(bobotInput).forEach(([key, val]) => {
      const found = kriteriaStore.find(
        k => k.kode.toLowerCase() === key.toLowerCase() || String(k.id) === key
      );
      if (found) {
        found.bobot = parseFloatSafe(val, found.bobot);
      }
    });
  }

  hitungDanSinkronkanSawBwm();
  catatNotifikasi('Bobot kriteria BWM berhasil diperbarui dan diterapkan ke kalkulasi SPK.', 'Admin', 'bobot');
  return res.json({ status: 'success', message: 'Bobot kriteria BWM berhasil diterapkan ke sistem.' });
}

router.post(['/', '/kriteria', '/kriteria/bobot', '/api/kriteria/bobot', '/bobot', '/api/bobot'], updateKriteriaBobotHandler);
router.put(['/', '/kriteria/bobot', '/api/kriteria/bobot', '/bobot', '/api/bobot'], updateKriteriaBobotHandler);

router.all(
  ['/', '/hitung-saw', '/api/hitung-saw', '/sinkron-saw', '/api/sinkron-saw', '/api/spk/sinkron-saw', '/api/spk/hitung-saw', '/hitung'],
  (_req: Request, res: Response) => {
    hitungDanSinkronkanSawBwm();
    const target = wargaStore;
    const report = buildFullSawReport(target);
    const sortedWarga = [...wargaStore].sort((a, b) => b.skor_saw - a.skor_saw);

    catatNotifikasi(`Kalkulasi SPK BWM-SAW selesai: Skor kelayakan diperbarui untuk ${target.length} warga.`, 'Sistem', 'spk');

    res.json({
      status: 'success',
      message: `Perhitungan BWM-SAW berhasil disinkronkan untuk ${target.length} warga.`,
      total: target.length,
      data: sortedWarga.map(formatWarga),
      ...report
    });
  }
);

router.get(['/komparasi', '/api/komparasi'], (_req: Request, res: Response) => {
  const target = wargaStore;
  if (target.length === 0) return res.json([]);

  const sawReport = buildFullSawReport(target);
  const bobot = kriteriaStore.map(k => k.bobot);
  const totalW = bobot.reduce((acc, v) => acc + v, 0) || 1;
  const pangkat = kriteriaStore.map((k, j) => (k.tipe === 'cost' ? -(bobot[j] / totalW) : bobot[j] / totalW));

  const sList = target.map(w => {
    const vals = [
      Math.max(parseFloatSafe(w.c1, 1500000), 1),
      Math.max(parseFloatSafe(w.c2, 5000000), 1),
      Math.max(parseIntSafe(w.c3, 45), 1),
      Math.max(parseIntSafe(w.c4, 1), 1),
      Math.max(parseIntSafe(w.c5, 3), 1),
      Math.max(parseIntSafe(w.c6, 2), 1),
      Math.max(parseIntSafe(w.c7, 2), 1),
      Math.max(parseIntSafe(w.c8, 2), 1),
      Math.max(parseIntSafe(w.c9, 1), 1),
      Math.max(parseIntSafe(w.c10, 1), 1)
    ];
    let s = 1.0;
    for (let j = 0; j < 10; j++) {
      s *= Math.pow(vals[j], pangkat[j]);
    }
    return { nik: w.nik, nama: w.nama, s };
  });

  const totalS = sList.reduce((acc, item) => acc + item.s, 0) || 1;
  const wpSorted = sList
    .map(item => ({
      nik: item.nik,
      nama: item.nama,
      wp_skor: Number((item.s / totalS).toFixed(4)),
      wp_rank: 0
    }))
    .sort((a, b) => b.wp_skor - a.wp_skor);

  wpSorted.forEach((item, idx) => {
    item.wp_rank = idx + 1;
  });

  const wpMap = new Map(wpSorted.map(item => [item.nik, item]));

  const komparasi = sawReport.hasil_akhir.map((sawItem, idx) => {
    const wpItem = wpMap.get(sawItem.nik);
    return {
      nik: sawItem.nik,
      nama: sawItem.nama,
      saw_rank: sawItem.rank ?? idx + 1,
      saw_skor: sawItem.skor_akhir,
      wp_rank: wpItem?.wp_rank ?? idx + 1,
      wp_skor: wpItem?.wp_skor ?? sawItem.skor_akhir,
      desil: sawItem.desil ?? 1,
      prioritas: sawItem.prioritas ?? '-',
      menerima: sawItem.status_bansos ?? '-'
    };
  });

  return res.json(komparasi);
});

router.get(['/sk-bupati', '/api/sk-bupati', '/api/spk/sk-bupati', '/api/export/sk-bupati'], (_req: Request, res: Response) => {
  const layak = wargaStore
    .filter(w => w.is_verified && w.desil <= 4)
    .sort((a, b) => b.skor_saw - a.skor_saw);

  res.json({
    status: 'success',
    nomor_sk: `188/BANSOS-SPK/${new Date().getFullYear()}`,
    total_penetapan: layak.length,
    data: layak.map(formatWarga)
  });
});


// =========================================================================
// ROUTE KONTROL PUBLIKASI METRIK SPK & SK BUPATI RESMI
// =========================================================================

router.get(['/status-publikasi', '/api/spk/status-publikasi'], (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    spk: getStatusPublikasiSpk()
  });
});

router.post(['/publish', '/api/spk/publish'], async (req: Request, res: Response) => {
  const isPub = Boolean(req.body.is_published);
  const actor = String(req.body.actor || 'Administrator Utama');

  const updated = setStatusPublikasiSpk(isPub, actor);
  try {
    if (spkMetrikStore[0]) {
      await saveSpkMetrikRealtimeToMysql(spkMetrikStore[0]);
    }
  } catch (err: any) {
    console.error('Gagal simpan status SPK ke MySQL:', err.message);
  }

  broadcastRealtimeEvent({
    type: 'SPK_METRIK_PUBLISHED',
    is_published: isPub,
    published_by: actor,
    timestamp: new Date().toISOString()
  });

  catatNotifikasi(
    isPub ? 'success' : 'info',
    isPub ? 'Metrik SPK Diterbitkan' : 'Publikasi Metrik SPK Ditarik',
    `${actor} ${isPub ? 'menerbitkan' : 'menarik'} metrik perhitungan SPK (BWM-SAW & WP) untuk akses publik warga.`
  );

  res.json({
    status: 'success',
    message: isPub ? 'Metrik perhitungan SPK berhasil dipublikasikan ke Portal Warga secara realtime.' : 'Publikasi metrik SPK berhasil ditarik menjadi draft internal.',
    data: updated
  });
});

router.get(['/sk-bupati/status-publikasi', '/api/sk-bupati/status-publikasi', '/status-publikasi-sk'], (_req: Request, res: Response) => {
  const status = getStatusPublikasiSkBupati();
  res.json({
    status: 'success',
    ...status,
    decree: skBupatiStore[0] || null
  });
});

router.post(['/sk-bupati/publish', '/api/sk-bupati/publish', '/publish-sk'], async (req: Request, res: Response) => {
  const isPub = Boolean(req.body.is_published);
  const actor = String(req.body.actor || 'Super Administrator');

  const updated = setStatusPublikasiSkBupati(isPub, actor);
  try {
    if (skBupatiStore[0]) {
      await saveSkBupatiRealtimeToMysql(skBupatiStore[0]);
    }
  } catch (err: any) {
    console.error('Gagal simpan status SK Bupati ke MySQL:', err.message);
  }

  broadcastRealtimeEvent({
    type: 'SK_BUPATI_PUBLISHED',
    is_published: isPub,
    published_by: actor,
    nomor_sk: skBupatiStore[0]?.nomor_sk,
    timestamp: new Date().toISOString()
  });

  catatNotifikasi(
    isPub ? 'success' : 'warning',
    isPub ? 'SK Bupati Diterbitkan Resmi' : 'Publikasi SK Bupati Ditarik',
    `${actor} ${isPub ? 'menerbitkan secara resmi' : 'menarik status publikasi'} Keputusan Bupati Sidoarjo TA 2026 ke portal publik.`
  );

  res.json({
    status: 'success',
    message: isPub ? 'Surat Keputusan Bupati Sidoarjo resmi berhasil diterbitkan ke Portal Warga.' : 'Publikasi Surat Keputusan Bupati Sidoarjo berhasil ditarik menjadi arsip internal.',
    data: updated
  });
});

export default router;
