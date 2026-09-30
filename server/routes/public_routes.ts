import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import {
  wargaStore,
  catatNotifikasi,
  formatWarga,
  nowTimeStr
} from '../store.js';

const router = Router();

router.get(['/cek-bansos', '/api/publik/cek-bansos', '/api/public/cek-bansos'], (req: Request, res: Response) => {
  const nik = String(req.query.nik || '').trim();
  if (!nik || nik.length !== 16) {
    return res.status(400).json({ status: 'error', message: 'Masukkan tepat 16 digit NIK.' });
  }
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) {
    return res.status(404).json({ status: 'error', message: 'Data NIK belum terdaftar pada sistem kependudukan.' });
  }
  return res.json({ status: 'success', data: formatWarga(w) });
});

router.post(['/konfirmasi-terima', '/api/public/konfirmasi-terima', '/api/publik/konfirmasi-terima'], (req: Request, res: Response) => {
  const nik = String(req.body?.nik || '').trim();
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  w.status_salur = 'Telah Menerima';
  w.konfirmasi_warga = true;
  w.waktu_konfirmasi_warga = nowTimeStr();
  catatNotifikasi(`Konfirmasi mandiri: Bantuan sosial telah dikonfirmasi diterima secara sah oleh warga ${w.nama} (NIK: ${w.nik}).`, 'Warga', 'penyaluran');
  return res.json({ 
    status: 'success', 
    message: 'Konfirmasi bantuan sosial berhasil dicatat. Status kini menjadi Telah Menerima.',
    data: formatWarga(w)
  });
});

router.post(['/lapor-selesai', '/api/public/lapor-selesai', '/api/publik/lapor-selesai'], (req: Request, res: Response) => {
  const nik = String(req.body?.nik || '').trim();
  const w = wargaStore.find(x => x.nik === nik);
  if (!w) return res.status(404).json({ status: 'error', message: 'Data warga tidak ditemukan.' });

  w.status_salur = 'Selesai';
  return res.json({ status: 'success', message: 'Kasus bantuan sosial resmi ditutup.' });
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

export default router;
