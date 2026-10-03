import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  chatStore,
  pengaduanStore,
  wargaStore,
  laporanPelanggaranStore,
  DATA_MASTER_SIDOARJO,
  catatNotifikasi,
  nowTimeStr,
  upload,
  UPLOAD_DIR
} from '../store.js';
import { parseIntSafe } from '../spk_engine.js';
import type { ChatItem, PengaduanItem, LaporanPelanggaranItem } from '../types.js';

const router = Router();

// =========================================================================
// ROUTE DOWNLOAD LANGSUNG BERKAS MEDIA DOKUMEN RESMI (PDF, WORD, EXCEL)
// =========================================================================
router.get(['/download/:filename', '/api/chat/download/:filename'], (req: Request, res: Response) => {
  const rawParam = req.params.filename;
  const filename = path.basename(Array.isArray(rawParam) ? (rawParam[0] || '') : (rawParam || ''));
  const safeName = String(req.query.name || filename);
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return res.download(filePath, safeName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send('Gagal mengunduh berkas');
      }
    });
  } else {
    return res.status(404).json({ status: 'error', message: 'Berkas tidak ditemukan pada direktori penyimpanan.' });
  }
});

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

router.get('/info/:id', (req: Request, res: Response) => {
  const idNum = parseIntSafe(req.params.id, 0);
  const found = chatStore.find(c => c.id === idNum);
  if (!found) {
    return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan' });
  }
  return res.json({ status: 'success', data: found });
});

router.post(['/:nik/mark-read', '/mark-read'], (req: Request, res: Response) => {
  const rawNik = req.params.nik;
  const nik = String(Array.isArray(rawNik) ? (rawNik[0] || '') : (rawNik || req.body?.nik || '')).trim();
  const reader = String(req.body?.reader || '').trim().toLowerCase(); // 'petugas' | 'warga'
  const readTime = String(req.body?.read_time || nowTimeStr());

  let updatedCount = 0;
  chatStore.forEach(c => {
    if (nik && c.nik !== nik) return;
    if ((reader === 'petugas' || reader === 'admin') && c.sender === 'warga' && !c.is_read) {
      c.is_read = true;
      c.read_at = readTime;
      updatedCount++;
    } else if (reader === 'warga' && c.sender !== 'warga' && !c.is_read) {
      c.is_read = true;
      c.read_at = readTime;
      updatedCount++;
    } else if (!reader && !c.is_read) {
      c.is_read = true;
      c.read_at = readTime;
      updatedCount++;
    }
  });

  return res.json({ status: 'success', updated: updatedCount, read_at: readTime });
});

router.get('/:nik', (req: Request, res: Response, next: any) => {
  const nik = String(req.params.nik || '').trim();
  if (['laporan-pelanggaran', 'geotag', 'share-geotag', 'messages', 'laporan-chat', 'react', 'pin', 'action', 'download', 'info', 'mark-read'].includes(nik)) {
    return next();
  }
  const messages = chatStore.filter(c => c.nik === nik);
  res.json(messages);
});

router.post('/:nik', (req: Request, res: Response, next: any) => {
  const nik = String(req.params.nik || '').trim();
  if (['laporan-pelanggaran', 'lapor-pesan', 'share-geotag', 'react', 'pin', 'action', 'investigasi', 'pengaduan', 'download'].includes(nik)) {
    return next();
  }
  upload.any()(req, res, (err) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Gagal mengunggah berkas.' });
    const d = req.body || {};
    const rawSender = String(d.sender || '').toLowerCase().trim();
    const hasAuthToken = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
    const isOfficer = rawSender === 'petugas' || rawSender === 'admin' || rawSender === 'operator' || rawSender === 'penyalur' || Boolean(d.is_admin) || hasAuthToken;
    const sender = isOfficer ? 'petugas' : (rawSender || 'warga');
    const nama = String(d.nama || (sender === 'petugas' ? 'Petugas Dinsos' : 'Warga'));
    const pesan = String(d.pesan || d.text || '').trim();
    const customType = d.custom_file_type ? String(d.custom_file_type) : null;
    const files = (req.files as Express.Multer.File[]) || [];
    const createdChats: ChatItem[] = [];

    const resolveFileType = (f: Express.Multer.File, pText: string): string => {
      const ext = path.extname(f.originalname || f.filename).toLowerCase().replace('.', '');
      if (f.filename.startsWith('voice_') || (f.mimetype && f.mimetype.startsWith('audio/')) || customType === 'audio') {
        return 'audio';
      }
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
      if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
      if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba'].includes(ext)) return 'audio';
      if (ext === 'webm') return (pText.toLowerCase().includes('suara') || pText.toLowerCase().includes('voice')) ? 'audio' : 'video';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt'].includes(ext)) return 'document';
      return 'document';
    };

    const msgWaktu = String(d.waktu || '').trim() || nowTimeStr().slice(-5);
    const msgCreatedAt = String(d.created_at || nowTimeStr());

    if (files.length > 0) {
      files.forEach((f, idx) => {
        const filePath = `/uploads/${f.filename}`;
        const fileType = customType || resolveFileType(f, pesan);
        const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
        const chatItem: ChatItem = {
          id: nextId,
          nik,
          sender,
          nama,
          pesan: idx === 0 ? (pesan || null) : null,
          text: idx === 0 ? (pesan || null) : null,
          file_path: filePath,
          file_name: f.originalname || f.filename,
          file_size: f.size || null,
          file_type: fileType,
          reply_sender: idx === 0 ? (d.reply_to_sender || d.reply_sender || null) : null,
          reply_text: idx === 0 ? (d.reply_to_text || d.reply_text || null) : null,
          reply_to_id: idx === 0 && d.reply_to_id ? parseIntSafe(d.reply_to_id, 0) : null,
          reaction: '',
          is_pinned: false,
          is_deleted_all: false,
          deleted_for: null,
          waktu: msgWaktu,
          created_at: msgCreatedAt,
          is_read: false,
          read_at: null,
          delivered_at: msgCreatedAt
        };
        chatStore.push(chatItem);
        createdChats.push(chatItem);
      });
    } else {
      const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
      const chatItem: ChatItem = {
        id: nextId,
        nik,
        sender,
        nama,
        pesan: pesan || null,
        text: pesan || null,
        file_path: null,
        file_type: null,
        reply_sender: d.reply_to_sender || d.reply_sender || null,
        reply_text: d.reply_to_text || d.reply_text || null,
        reply_to_id: d.reply_to_id ? parseIntSafe(d.reply_to_id, 0) : null,
        reaction: '',
        is_pinned: false,
        is_deleted_all: false,
        deleted_for: null,
        waktu: msgWaktu,
        created_at: msgCreatedAt,
        is_read: false,
        read_at: null,
        delivered_at: msgCreatedAt
      };
      chatStore.push(chatItem);
      createdChats.push(chatItem);
    }

    if (sender === 'warga') {
      catatNotifikasi(`Pesan mediasi baru diterima dari ${nama} (NIK: ${nik})${files.length > 1 ? ` (${files.length} berkas)` : ''}.`, 'Warga', 'chat');
    }

    return res.status(201).json({
      status: 'success',
      message: `${createdChats.length} pesan berhasil dikirim.`,
      data: createdChats.length === 1 ? createdChats[0] : createdChats,
      items: createdChats
    });
  });
});

router.post(['/investigasi/selesaikan', '/pengaduan/selesaikan'], (req: Request, res: Response) => {
  const d = req.body || {};
  const idStr = String(d.id || '').replace('ADUAN-', '').trim();
  const idNum = parseIntSafe(idStr, 0);
  const nik = String(d.nik || '').trim();
  const catatan = String(d.catatan || d.catatan_penyelesaian || 'Laporan telah diverifikasi dan diselesaikan oleh tim Dinsos.').trim();
  const petugas = String(d.petugas || 'Admin 1 (Dinas Sosial Sidoarjo)').trim();

  let aduan = pengaduanStore.find(a => (idNum > 0 && a.id === idNum) || (nik && a.nik === nik));
  if (!aduan && pengaduanStore.length > 0) {
    aduan = pengaduanStore.find(a => a.status !== 'Selesai') || pengaduanStore[0];
  }

  if (aduan) {
    aduan.status = 'Selesai';
    aduan.status_step = 4;
    aduan.status_text = 'Laporan Selesai & Ditutup';
    aduan.catatan_petugas = catatan;

    catatNotifikasi(`✅ Laporan sengketa ${aduan.nama} (NIK: ${aduan.nik}) resmi diselesaikan oleh ${petugas}.`, 'Petugas', 'success');

    const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
    const msgText = `✅ [LAPORAN RESMI DISELESAIKAN] Status pengaduan Anda telah diverifikasi dan dinyatakan SELESAI oleh ${petugas}.\n\nCatatan Tindak Lanjut: ${catatan}`;
    chatStore.push({
      id: nextChatId,
      nik: aduan.nik,
      sender: 'petugas',
      nama: petugas,
      pesan: msgText,
      text: msgText,
      file_path: null,
      file_type: null,
      reply_sender: null,
      reply_text: null,
      reply_to_id: null,
      reaction: '✅',
      is_pinned: true,
      is_deleted_all: false,
      deleted_for: null,
      waktu: nowTimeStr().slice(-5),
      created_at: nowTimeStr()
    });

    return res.json({ status: 'success', message: 'Laporan pengaduan berhasil diselesaikan.', data: aduan });
  }

  return res.status(404).json({ status: 'error', message: 'Pengaduan tidak ditemukan.' });
});

router.all(['/react/:msg_id', '/api/chat/react/:msg_id'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const chat = chatStore.find(c => c.id === id);
  if (!chat) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });
  chat.reaction = String(req.body?.reaction || '');
  return res.json({ status: 'success', reaction: chat.reaction });
});

router.all(['/pin/:msg_id', '/api/chat/pin/:msg_id'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const chat = chatStore.find(c => c.id === id);
  if (!chat) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });
  if (req.body && typeof req.body.is_pinned !== 'undefined') {
    chat.is_pinned = Boolean(req.body.is_pinned);
  } else {
    chat.is_pinned = !chat.is_pinned;
  }
  return res.json({ status: 'success', is_pinned: chat.is_pinned, id: chat.id, pesan: chat.pesan, text: chat.text });
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

// =========================================================================
// PUSAT LAPORAN PELANGGARAN & MODERASI CHAT KESELURUHAN
// =========================================================================
router.get(['/laporan-pelanggaran', '/api/chat/laporan-pelanggaran', '/api/laporan-pelanggaran'], (_req: Request, res: Response) => {
  const list = [...laporanPelanggaranStore].sort((a, b) => b.id - a.id);
  const total = list.length;
  const pending = list.filter(l => l.status === 'Menunggu Peninjauan' || l.status === 'Dalam Investigasi').length;
  const terbukti = list.filter(l => l.status === 'Terbukti Melanggar').length;
  const selesai = list.filter(l => l.status === 'Selesai Ditangani' || l.status === 'Ditolak/Bukan Pelanggaran').length;

  return res.json({
    status: 'success',
    stats: { total, pending, terbukti, selesai },
    data: list
  });
});

router.post(['/laporan-pelanggaran', '/lapor-pesan', '/api/chat/lapor-pesan', '/api/chat/laporan-pelanggaran'], (req: Request, res: Response) => {
  const d = req.body || {};
  const msgId = parseIntSafe(d.msg_id, 0);
  const nik = String(d.nik || '').trim();
  const pesanKutipan = String(d.pesan || d.pesan_kutipan || '').trim();
  const namaTerlapor = String(d.nama_terlapor || (d.sender_terlapor === 'warga' ? 'Warga' : 'Petugas Dinsos')).trim();
  const senderTerlapor = String(d.sender_terlapor || 'petugas').trim();
  const alasan = String(d.alasan || 'Pelanggaran Norma Komunikasi').trim();
  const kategori = String(d.kategori || 'Kata-kata Kasar / Pelecehan').trim();
  const deskripsi = String(d.deskripsi || d.rincian || alasan).trim();
  const pelaporRole = (String(d.pelapor_role || 'warga').toLowerCase()) as 'warga' | 'petugas' | 'admin';
  const pelaporNama = String(d.pelapor_nama || (pelaporRole === 'warga' ? 'Warga' : 'Petugas Dinsos')).trim();
  const pelaporNik = String(d.pelapor_nik || nik || '-').trim();

  const nextId = laporanPelanggaranStore.length > 0 ? Math.max(...laporanPelanggaranStore.map(l => l.id)) + 1 : 1;
  const kodeLaporan = `VIO-2026-${String(nextId).padStart(3, '0')}`;

  const newReport: LaporanPelanggaranItem = {
    id: nextId,
    kode_laporan: kodeLaporan,
    msg_id: msgId,
    nik,
    nama_terlapor: namaTerlapor,
    sender_terlapor: senderTerlapor,
    pesan_kutipan: pesanKutipan,
    alasan,
    kategori,
    deskripsi,
    pelapor_role: pelaporRole,
    pelapor_nama: pelaporNama,
    pelapor_nik: pelaporNik,
    status: 'Menunggu Peninjauan',
    waktu: nowTimeStr(),
    created_at: nowTimeStr()
  };

  laporanPelanggaranStore.unshift(newReport);
  catatNotifikasi(`🚩 Laporan Pelanggaran Chat Baru (${kodeLaporan}) diajukan oleh ${pelaporNama} terkait "${alasan}".`, 'Pengawas', 'urgent');

  return res.status(201).json({
    status: 'success',
    message: 'Laporan pelanggaran berhasil dicatat dan masuk ke antrean moderasi.',
    data: newReport
  });
});

router.post(['/laporan-pelanggaran/:id/tindak', '/api/chat/laporan-pelanggaran/:id/tindak'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.id, 0);
  const report = laporanPelanggaranStore.find(l => l.id === id);
  if (!report) {
    return res.status(404).json({ status: 'error', message: 'Laporan pelanggaran tidak ditemukan.' });
  }

  const d = req.body || {};
  const statusAksi = String(d.status || 'Terbukti Melanggar');
  const tindakan = String(d.tindakan || 'Teguran resmi dan catatan disiplin diberikan.');
  const petugas = String(d.petugas || 'Administrator Utama (Super Admin)');
  const hapusPesan = Boolean(d.hapus_pesan);

  report.status = statusAksi as any;
  report.tindakan_petugas = tindakan;
  report.petugas_penindak = petugas;
  report.waktu_tindakan = nowTimeStr();

  // If action is to delete/blank out the violating message from chatStore
  if (hapusPesan && report.msg_id > 0) {
    const targetMsg = chatStore.find(c => c.id === report.msg_id);
    if (targetMsg) {
      targetMsg.is_deleted_all = true;
      targetMsg.pesan = '🚫 Pesan ini telah dihapus oleh Tim Moderasi & Pengawas karena melanggar pedoman komunikasi.';
      targetMsg.text = targetMsg.pesan;
    }
  }

  catatNotifikasi(`⚖️ Tindak Lanjut (${report.kode_laporan}): Status diubah menjadi "${statusAksi}" oleh ${petugas}.`, 'Moderasi', 'info');

  return res.json({
    status: 'success',
    message: 'Tindak lanjut pelanggaran berhasil disimpan.',
    data: report
  });
});

// =========================================================================
// TARIK & BAGIKAN LOKASI GEOTAGGING RESMI ARSIP WARGA
// =========================================================================
router.get(['/geotag/:nik', '/api/chat/geotag/:nik'], (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  if (!nik) return res.status(400).json({ status: 'error', message: 'NIK wajib diberikan.' });

  // Cari di wargaStore terlebih dahulu
  let warga = wargaStore.find(w => w.nik === nik);

  // Jika belum di memory wargaStore, cari di DATA_MASTER_SIDOARJO
  if (!warga) {
    const master = DATA_MASTER_SIDOARJO.find(m => m[0] === nik);
    if (master) {
      warga = {
        id: 9999,
        nik: master[0],
        nama: master[1],
        tempat_lahir: master[2],
        tanggal_lahir: master[3],
        alamat: master[4],
        no_hp: master[5],
        email: master[6],
        lat: parseFloat(master[7]) || -7.4478,
        lng: parseFloat(master[8]) || 112.7183,
        c1: master[9], c2: master[10], c3: master[11], c4: master[12], c5: master[13],
        c6: master[14], c7: master[15], c8: master[16], c9: master[17], c10: master[18],
        desil: 1, skor_saw: 0.85, rank_saw: 1, is_verified: master[19],
        status_validasi: master[20], status_salur: master[21], status_bansos: master[20],
        prioritas: 'Tinggi', bukti_salur: '', tanggal_salur: '', catatan: master[22],
        nominal_bantuan: 'Rp 600.000', created_at: '2026-01-01'
      };
    }
  }

  if (!warga) {
    // Fallback koordinat pusat Sidoarjo jika warga umum belum ada di master
    return res.json({
      status: 'success',
      data: {
        nik,
        nama: `Warga (${nik.slice(-4)})`,
        alamat: 'Kabupaten Sidoarjo, Jawa Timur',
        lat: -7.4478,
        lng: 112.7183,
        kecamatan: 'Sidoarjo',
        desil: 2,
        status_bansos: 'Terdaftar',
        maps_url: `https://www.google.com/maps?q=-7.4478,112.7183`,
        geotag_terverifikasi: false
      }
    });
  }

  const lat = Number(warga.lat) || -7.4478;
  const lng = Number(warga.lng) || 112.7183;
  const alamat = warga.alamat || 'Sidoarjo, Jawa Timur';

  // Ekstrak nama kecamatan dari alamat jika ada
  let kec = 'Sidoarjo';
  const kecMatch = alamat.match(/Kec\.\s*([A-Za-z]+)/i);
  if (kecMatch && kecMatch[1]) kec = kecMatch[1];

  return res.json({
    status: 'success',
    data: {
      nik: warga.nik,
      nama: warga.nama,
      alamat,
      lat,
      lng,
      kecamatan: kec,
      desil: warga.desil || 1,
      status_bansos: warga.status_bansos || warga.status_validasi || 'Disetujui',
      status_salur: warga.status_salur || 'Belum Salur',
      maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
      geotag_terverifikasi: true
    }
  });
});

router.post(['/share-geotag', '/api/chat/share-geotag'], (req: Request, res: Response) => {
  const d = req.body || {};
  const nik = String(d.nik || '').trim();
  const sender = String(d.sender || 'petugas');
  const nama = String(d.nama || (sender === 'petugas' ? 'Petugas Dinsos' : 'Warga'));

  if (!nik) {
    return res.status(400).json({ status: 'error', message: 'NIK warga wajib disertakan.' });
  }

  // Cari data arsip warga
  let w = wargaStore.find(x => x.nik === nik);
  if (!w) {
    const m = DATA_MASTER_SIDOARJO.find(x => x[0] === nik);
    if (m) {
      w = {
        id: 9999,
        nik: m[0], nama: m[1], tempat_lahir: m[2], tanggal_lahir: m[3], alamat: m[4],
        no_hp: m[5], email: m[6], lat: parseFloat(m[7]), lng: parseFloat(m[8]),
        c1: m[9], c2: m[10], c3: m[11], c4: m[12], c5: m[13], c6: m[14], c7: m[15], c8: m[16], c9: m[17], c10: m[18],
        desil: 1, skor_saw: 0.85, rank_saw: 1, is_verified: m[19], status_validasi: m[20], status_salur: m[21],
        status_bansos: m[20], prioritas: 'Tinggi', bukti_salur: '', tanggal_salur: '', catatan: m[22],
        nominal_bantuan: 'Rp 600.000', created_at: '2026-01-01'
      };
    }
  }

  const lat = w ? Number(w.lat) : -7.4478;
  const lng = w ? Number(w.lng) : 112.7183;
  const namaWarga = w ? w.nama : nama;
  const alamat = w ? w.alamat : 'Kabupaten Sidoarjo';

  const geotagPayload = {
    nik,
    nama: namaWarga,
    alamat,
    lat,
    lng,
    maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
    terverifikasi: true,
    pengirim: sender
  };

  const pesanGeotag = `[GEOTAG_LOKASI] ${JSON.stringify(geotagPayload)}`;

  const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const newChat: ChatItem = {
    id: nextChatId,
    nik,
    sender,
    nama,
    pesan: pesanGeotag,
    text: pesanGeotag,
    file_path: null,
    file_type: 'location',
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '📍',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: nowTimeStr()
  };

  chatStore.push(newChat);

  const notifLabel = sender === 'warga' ? `Warga ${namaWarga}` : `Petugas`;
  catatNotifikasi(`📍 ${notifLabel} membagikan titik lokasi geotagging arsip kependudukan (${lat.toFixed(4)}, ${lng.toFixed(4)}).`, 'Peta', 'info');

  return res.status(201).json({
    status: 'success',
    message: 'Lokasi geotagging arsip warga berhasil dikirim ke ruang chat.',
    data: newChat,
    geotag: geotagPayload
  });
});

export default router;
