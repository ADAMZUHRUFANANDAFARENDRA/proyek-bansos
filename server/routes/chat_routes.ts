import { Router, Request, Response } from 'express';
import path from 'path';
import {
  chatStore,
  pengaduanStore,
  wargaStore,
  catatNotifikasi,
  nowTimeStr,
  upload
} from '../store.js';
import { parseIntSafe } from '../spk_engine.js';
import type { ChatItem, PengaduanItem } from '../types.js';

const router = Router();

router.get(['/laporan-chat', '/api/laporan-chat', '/api/chat/laporan', '/pengaduan', '/api/pengaduan'], (_req: Request, res: Response) => {
  const list = [...pengaduanStore].sort((a, b) => b.id - a.id).map(a => ({
    id: `ADUAN-${String(a.id).padStart(3, '0')}`,
    nik: a.nik,
    nama: a.nama,
    kategori: a.kategori,
    uraian: a.uraian || a.deskripsi || a.isi_laporan,
    status_text: a.status_text || a.status,
    status_step: a.status_step,
    catatan_petugas: a.catatan_petugas,
    waktu: a.waktu
  }));
  res.json(list);
});

export function createPengaduanHandler(req: Request, res: Response) {
  const d = req.body || {};
  const nik = String(d.nik || '').trim();
  const nama = String(d.nama_pelapor || d.nama || 'Warga Sidoarjo').trim();
  const kategori = String(d.kategori || 'Sengketa Penyaluran Bansos').trim();
  const isi = String(d.isi_laporan || d.uraian || d.deskripsi || '').trim();

  if (!nik || !isi) {
    return res.status(400).json({ status: 'error', message: 'NIK dan isi laporan pengaduan wajib diisi.' });
  }

  const nextId = pengaduanStore.length > 0 ? Math.max(...pengaduanStore.map(p => p.id)) + 1 : 1;
  const newAduan: PengaduanItem = {
    id: nextId,
    nik,
    nama,
    nama_pelapor: nama,
    kategori,
    uraian: isi,
    deskripsi: isi,
    isi_laporan: isi,
    status: 'Tahap Mediasi',
    status_step: 2,
    status_text: 'Ditinjau Petugas',
    catatan_petugas: 'Laporan Anda telah masuk ke sistem dan sedang diverifikasi.',
    waktu: nowTimeStr()
  };

  pengaduanStore.push(newAduan);
  catatNotifikasi(`🚨 Pengaduan warga baru diterima: ${nama} (NIK: ${nik}) melaporkan kendala.`, 'Warga', 'urgent');

  return res.status(201).json({
    status: 'success',
    message: 'Laporan pengaduan berhasil tercatat.',
    data: newAduan
  });
}

router.post(['/laporan-chat', '/api/laporan-chat', '/pengaduan', '/api/pengaduan', '/api/publik/pengaduan'], createPengaduanHandler);

router.get('/publik/cek-aduan', (req: Request, res: Response) => {
  const nik = String(req.query.nik || '').trim();
  const found = [...pengaduanStore].reverse().find(a => a.nik === nik);
  if (!found) {
    return res.status(404).json({
      status: 'error',
      message: 'Belum ada riwayat pengaduan aktif untuk NIK tersebut.'
    });
  }
  return res.json({ status: 'success', data: found });
});

router.post('/investigasi/tindak-lanjut', (req: Request, res: Response) => {
  const d = req.body || {};
  const nik = String(d.nik || '').trim();
  const aksi = String(d.aksi || 'tanggapi').trim();
  const tanggapan = String(d.tanggapan || '').trim();
  const petugas = String(d.petugas || 'Petugas Dinsos Sidoarjo').trim();

  const aduan = [...pengaduanStore].reverse().find(a => a.nik === nik);
  if (!aduan) {
    return res.status(404).json({ status: 'error', message: 'Pengaduan tidak ditemukan.' });
  }

  if (aksi === 'terima') {
    aduan.status_step = 2;
    aduan.status_text = 'Peninjauan Bukti (Step 2)';
    aduan.status = 'Peninjauan';
  } else if (aksi === 'tanggapi') {
    aduan.status_step = 3;
    aduan.status_text = 'Investigasi Lapangan (Step 3)';
    aduan.status = 'Investigasi';
  } else if (aksi === 'selesai') {
    aduan.status_step = 4;
    aduan.status_text = 'Selesai & Ditutup (Step 4)';
    aduan.status = 'Selesai';
  }

  if (tanggapan) aduan.catatan_petugas = tanggapan;

  const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const msgText = `📢 [PEMBARUAN INVESTIGASI] Status laporan: ${aduan.status_text}. Catatan Petugas (${petugas}): ${tanggapan || 'Sedang dalam tindak lanjut.'}`;
  chatStore.push({
    id: nextChatId,
    nik,
    sender: 'petugas',
    nama: petugas,
    pesan: msgText,
    text: msgText,
    file_path: null,
    file_type: null,
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: nowTimeStr()
  });

  return res.json({
    status: 'success',
    message: `Status investigasi berhasil diperbarui ke ${aduan.status_text}.`,
    data: aduan
  });
});

router.get(['/list', '/inbox', '/conversations'], (_req: Request, res: Response) => {
  const seen = new Set<string>();
  const daftar: Record<string, unknown>[] = [];

  [...chatStore].reverse().forEach(c => {
    if (!seen.has(c.nik)) {
      seen.add(c.nik);
      const w = wargaStore.find(x => x.nik === c.nik);
      daftar.push({
        nik: c.nik,
        nama: w?.nama || c.nama || `Warga ${c.nik.slice(-4)}`,
        last_msg: c.pesan || 'Media terlampir',
        pesan_terakhir: c.pesan || 'Media terlampir',
        waktu: c.waktu || 'Baru saja',
        unread_count: 0
      });
    }
  });

  wargaStore.slice(0, 10).forEach(w => {
    if (!seen.has(w.nik)) {
      seen.add(w.nik);
      daftar.push({
        nik: w.nik,
        nama: w.nama,
        last_msg: 'Ruang percakapan mediasi siap...',
        pesan_terakhir: 'Ruang percakapan mediasi siap...',
        waktu: 'Hari ini',
        unread_count: 0
      });
    }
  });

  res.json(daftar);
});

router.get('/messages', (req: Request, res: Response) => {
  const nik = String(req.query.nik || '').trim();
  if (!nik) return res.status(400).json({ status: 'error', messages: [] });
  const messages = chatStore.filter(c => c.nik === nik);
  return res.json({ status: 'success', messages });
});

router.get('/:nik', (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  const messages = chatStore.filter(c => c.nik === nik);
  res.json(messages);
});

router.post('/:nik', upload.any(), (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  const d = req.body || {};
  const sender = String(d.sender || 'warga');
  const nama = String(d.nama || (sender === 'warga' ? 'Warga' : 'Petugas Dinsos'));
  const pesan = String(d.pesan || d.text || '').trim();
  const customType = d.custom_file_type ? String(d.custom_file_type) : null;

  let filePath: string | null = null;
  let fileType: string | null = customType;

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length > 0) {
    const f = files[0];
    filePath = `/uploads/${f.filename}`;
    const ext = path.extname(f.filename).toLowerCase().replace('.', '');
    if (!fileType) {
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) fileType = 'image';
      else if (['mp4', 'webm', 'mov'].includes(ext)) fileType = 'video';
      else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) fileType = 'audio';
      else fileType = 'document';
    }
  }

  const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const newChat: ChatItem = {
    id: nextId,
    nik,
    sender,
    nama,
    pesan: pesan || null,
    text: pesan || null,
    file_path: filePath,
    file_type: fileType,
    reply_sender: d.reply_to_sender || d.reply_sender || null,
    reply_text: d.reply_to_text || d.reply_text || null,
    reply_to_id: d.reply_to_id ? parseIntSafe(d.reply_to_id, 0) : null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: nowTimeStr()
  };

  chatStore.push(newChat);

  if (sender === 'warga') {
    catatNotifikasi(`Pesan mediasi baru diterima dari ${nama} (NIK: ${nik}).`, 'Warga', 'chat');
  }

  return res.status(201).json({ status: 'success', message: 'Pesan berhasil dikirim.', data: newChat });
});

router.post('/react/:msg_id', (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const chat = chatStore.find(c => c.id === id);
  if (!chat) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });
  chat.reaction = String(req.body?.reaction || '');
  return res.json({ status: 'success', reaction: chat.reaction });
});

router.patch('/pin/:msg_id', (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const chat = chatStore.find(c => c.id === id);
  if (!chat) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });
  chat.is_pinned = !chat.is_pinned;
  return res.json({ status: 'success', is_pinned: chat.is_pinned });
});

router.delete('/action/:msg_id', (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const idx = chatStore.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });

  const tipe = String(req.body?.type || 'everyone');
  if (tipe === 'everyone') {
    chatStore.splice(idx, 1);
  } else {
    chatStore[idx].deleted_for = `me_${req.body?.requester || 'warga'}`;
  }
  return res.json({ status: 'success', message: 'Pesan berhasil dihapus.' });
});

export default router;
