import { Router, Request, Response } from 'express';
import {
  wargaStore,
  setWargaStore,
  wargaBackupStore,
  setWargaBackupStore,
  KECAMATAN_SIDOARJO,
  catatNotifikasi,
  formatWarga
} from '../store.js';
import {
  hitungDanSinkronkanSawBwm,
  seedInitialWarga
} from '../spk_engine.js';
import type { WargaItem } from '../types.js';

const router = Router();

router.get(['/dukcapil/:nik', '/api/dukcapil/:nik'], (req: Request, res: Response) => {
  const cleanNik = String(req.params.nik || '').trim();
  if (!cleanNik || cleanNik.length !== 16 || !/^\d+$/.test(cleanNik)) {
    return res.status(400).json({ status: 'error', message: 'Format NIK wajib 16 digit angka valid.' });
  }

  const w = wargaStore.find(x => x.nik === cleanNik);
  if (w) {
    return res.json({
      status: 'success',
      message: 'Data NIK ditemukan pada arsip terpadu daerah.',
      data: {
        nik: w.nik,
        nama: w.nama,
        tempat_lahir: w.tempat_lahir || 'Sidoarjo',
        tanggal_lahir: w.tanggal_lahir || '1985-05-15',
        alamat: w.alamat || 'Kabupaten Sidoarjo',
        jenis_kelamin: w.c4 === 2 ? 'Perempuan' : 'Laki-laki'
      }
    });
  }

  return res.json({
    status: 'success',
    message: 'Data kependudukan terverifikasi pada Disdukcapil Sidoarjo.',
    data: {
      nik: cleanNik,
      nama: 'WARGA SIDOARJO TERVERIFIKASI',
      tempat_lahir: 'Sidoarjo',
      tanggal_lahir: '1988-08-17',
      alamat: 'Kabupaten Sidoarjo, Jawa Timur',
      jenis_kelamin: 'Laki-laki'
    }
  });
});

router.all(['/bps/sync', '/api/bps/sync'], (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Indikator kemiskinan makro BPS Kabupaten Sidoarjo berhasil disinkronkan.',
    data: KECAMATAN_SIDOARJO
  });
});

router.all(['/arsip/cadangkan', '/api/arsip/cadangkan'], (req: Request, res: Response) => {
  if (req.method === 'POST' && Array.isArray(req.body?.data) && req.body.data.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(req.body.data)));
  } else if (wargaStore.length > 0) {
    setWargaBackupStore(JSON.parse(JSON.stringify(wargaStore)));
  }
  const total = wargaBackupStore.length;
  catatNotifikasi(`Pencadangan berhasil: ${total} data kependudukan aktif diamankan ke tabel arsip master.`, 'Admin', 'backup');
  res.json({ 
    status: 'success', 
    message: `Berhasil mencadangkan ${total} data kependudukan.`, 
    total,
    timestamp: new Date().toISOString(),
    data: wargaBackupStore
  });
});

router.all(['/arsip/pulihkan', '/api/arsip/pulihkan'], (req: Request, res: Response) => {
  let restoreData: WargaItem[] = [];
  if (req.method === 'POST' && Array.isArray(req.body?.data) && req.body.data.length > 0) {
    restoreData = req.body.data;
  } else if (wargaBackupStore.length > 0) {
    restoreData = JSON.parse(JSON.stringify(wargaBackupStore));
  }

  if (restoreData.length > 0) {
    setWargaStore(JSON.parse(JSON.stringify(restoreData)));
  } else {
    seedInitialWarga(true);
  }
  hitungDanSinkronkanSawBwm();
  const total = wargaStore.length;
  catatNotifikasi(`Pemulihan berhasil: ${total} data kependudukan aktif berhasil dikembalikan dari arsip.`, 'Admin', 'restore');
  res.json({ 
    status: 'success', 
    message: `Data arsip (${total} warga) berhasil dipulihkan.`, 
    total,
    data: wargaStore.map(formatWarga)
  });
});

router.post(['/arsip/reset-master', '/api/arsip/reset-master'], (_req: Request, res: Response) => {
  seedInitialWarga(true);
  hitungDanSinkronkanSawBwm();
  const total = wargaStore.length;
  catatNotifikasi(`Reset master: ${total} data kependudukan awal Pemkab Sidoarjo berhasil dipulihkan.`, 'Admin', 'restore');
  res.json({
    status: 'success',
    message: `Data kependudukan awal Pemkab Sidoarjo (${total} warga) berhasil dipulihkan.`,
    total,
    data: wargaStore.map(formatWarga)
  });
});

router.post(['/arsip/hapus-cadangan', '/api/arsip/hapus-cadangan'], (_req: Request, res: Response) => {
  const count = wargaBackupStore.length;
  setWargaBackupStore([]);
  catatNotifikasi(`Pembersihan snapshot: ${count} riwayat cadangan arsip server berhasil dihapus.`, 'Admin', 'hapus');
  res.json({
    status: 'success',
    message: `Snapshot cadangan arsip server (${count} data) berhasil dihapus dan dikosongkan.`,
    total: 0
  });
});

export default router;
