import { Router, Request, Response } from 'express';
import {
  notifikasiStore,
  setNotifikasiStore,
  catatNotifikasi
} from '../store.js';
import { parseIntSafe } from '../spk_engine.js';

const router = Router();

router.get(['/', '/notifikasi', '/api/notifikasi'], (_req: Request, res: Response) => {
  const sorted = [...notifikasiStore].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.id - a.id;
  });
  const unread = sorted.filter(n => !n.is_read && !n.is_archived).length;
  res.json({
    status: 'success',
    unread,
    total_unread: unread,
    data: sorted
  });
});

router.post(['/catat', '/api/notifikasi/catat', '/api/notifikasi', '/'], (req: Request, res: Response) => {
  const d = req.body || {};
  const pesan = String(d.pesan || d.text || '').trim();
  const role = String(d.role_sender || d.role || 'Sistem').trim();
  const kategori = String(d.kategori || 'info').trim();

  if (!pesan) {
    return res.status(400).json({ status: 'error', message: 'Pesan notifikasi kosong.' });
  }
  catatNotifikasi(pesan, role, kategori);
  return res.status(201).json({ status: 'success', message: 'Aktivitas berhasil dicatat ke notifikasi.' });
});

router.all(['/:id/read', '/api/notifikasi/:id/read'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.id, 0);
  const item = notifikasiStore.find(n => n.id === id);
  if (item) item.is_read = true;
  res.json({ status: 'success', message: `Notifikasi #${id} ditandai dibaca.` });
});

router.all(['/:id/pin', '/api/notifikasi/:id/pin'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.id, 0);
  const item = notifikasiStore.find(n => n.id === id);
  if (item) item.is_pinned = !item.is_pinned;
  res.json({ status: 'success', message: `Status semat #${id} diperbarui.` });
});

router.all(['/:id/archive', '/api/notifikasi/:id/archive'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.id, 0);
  const item = notifikasiStore.find(n => n.id === id);
  if (item) item.is_archived = !item.is_archived;
  res.json({ status: 'success', message: `Status arsip #${id} diperbarui.` });
});

router.delete(['/:id', '/api/notifikasi/:id'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.id, 0);
  setNotifikasiStore(notifikasiStore.filter(n => n.id !== id));
  res.json({ status: 'success', message: `Notifikasi #${id} berhasil dihapus.` });
});

router.all(['/clear-all', '/api/notifikasi/clear-all'], (_req: Request, res: Response) => {
  setNotifikasiStore(notifikasiStore.filter(n => n.is_pinned));
  res.json({ status: 'success', message: 'Seluruh notifikasi berhasil dibersihkan.' });
});

router.post(['/read-all', '/api/notifikasi/read-all'], (_req: Request, res: Response) => {
  notifikasiStore.forEach(n => {
    n.is_read = true;
  });
  res.json({ status: 'success', message: 'Semua notifikasi ditandai dibaca.' });
});

export default router;
