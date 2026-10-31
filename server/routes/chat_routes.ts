import { savePengaduanRealtimeToMysql, saveChatMessageRealtimeToMysql } from '../../mysql_storage.js';
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  chatStore,
  pengaduanStore,
  wargaStore,
  laporanPelanggaranStore,
  kriteriaStore,
  DATA_MASTER_SIDOARJO,
  catatNotifikasi,
  nowTimeStr,
  upload,
  UPLOAD_DIR,
  formatWarga,
  chatOfficerMap
} from '../store.js';
import { parseIntSafe, hitungDanSinkronkanSawBwm } from '../spk_engine.js';
import type { ChatItem, PengaduanItem, LaporanPelanggaranItem } from '../types.js';
import {
  realtimeAduanNew,
  realtimeAduanUpdate,
  realtimeEskalasiSuperAdmin,
  realtimePutusanSuperAdmin,
  realtimeLaporanPelanggaranNew,
  realtimeLaporanPelanggaranUpdate,
  realtimeChatMessage,
  broadcastRealtimeEvent
} from '../realtime.js';

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
  const list = [...pengaduanStore].sort((a, b) => b.id - a.id).map(a => {
    const rawTxt = (String(a.kategori || '') + ' ' + String(a.uraian || '') + ' ' + String(a.deskripsi || '') + ' ' + String(a.isi_laporan || '')).toLowerCase();
    const isSistem = rawTxt.includes('eror') || rawTxt.includes('error') || rawTxt.includes('sistem') || 
                     rawTxt.includes('teknis') || rawTxt.includes('bug') || rawTxt.includes('crash') || 
                     rawTxt.includes('glitch') || rawTxt.includes('gagal') || rawTxt.includes('server') || 
                     rawTxt.includes('database') || rawTxt.includes('koneksi') || rawTxt.includes('macet') ||
                     rawTxt.includes('freeze') || rawTxt.includes('blank') || rawTxt.includes('rusak');
    const isUrgent = rawTxt.includes('urgent') || rawTxt.includes('darurat') || rawTxt.includes('mendesak') || 
                     isSistem || a.urgensi_eskalasi === 'Kritis' || a.urgensi_eskalasi === 'Tinggi' ||
                     (a as any).urgensi === 'urgent';
    const isWargaTerdaftar = !String(a.kategori || '').toLowerCase().includes('belum') && wargaStore.some(w => w.nik === a.nik);

    return {
      ...a,
      id: `ADUAN-${String(a.id).padStart(3, '0')}`,
      nik: a.nik,
      nama: a.nama,
      kategori: a.kategori,
      uraian: a.uraian || a.deskripsi || a.isi_laporan,
      status_text: a.status_text || a.status,
      status_step: a.status_step,
      catatan_petugas: a.catatan_petugas,
      waktu: a.waktu,
      is_terdaftar: isWargaTerdaftar,
      is_sistem: isSistem,
      is_urgent: isUrgent
    };
  });
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
  savePengaduanRealtimeToMysql(newAduan).catch(() => {});
  catatNotifikasi(`🚨 Pengaduan warga baru diterima: ${nama} (NIK: ${nik}) melaporkan kendala.`, 'Warga', 'urgent');
  realtimeAduanNew(newAduan);

  // Buat pesan resmi pengaduan di riwayat percakapan mediasi chat
  const nextMsgId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const chatMsg: ChatItem = {
    id: nextMsgId,
    nik: nik,
    sender: 'warga',
    nama: nama,
    pesan: `🚨 [LAPORAN ADUAN RESMI]\nKategori: ${kategori}\nUraian: ${isi}`,
    text: `🚨 [LAPORAN ADUAN RESMI]\nKategori: ${kategori}\nUraian: ${isi}`,
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
  saveChatMessageRealtimeToMysql(chatMsg).catch(() => {});
  try { realtimeChatMessage(chatMsg); } catch (e) {}

  // Jika pengaduan berkaitan dengan bansos belum diterima atau sengketa, perbarui status_salur warga
  const isBansosIssue = kategori.toLowerCase().includes('belum') || kategori.toLowerCase().includes('sengketa') || kategori.toLowerCase().includes('bansos');
  if (isBansosIssue) {
    const w = wargaStore.find(x => x.nik === nik);
    if (w) {
      w.status_salur = 'Belum Diterima';
      w.konfirmasi_warga = false;
      w.waktu_konfirmasi_warga = '';
      w.catatan = `Sanggahan Warga (${nowTimeStr()}): ${isi}`;
      try {
        broadcastRealtimeEvent({
          type: 'WARGA_SALUR_UPDATED',
          warga_id: w.id,
          nik: w.nik,
          status_salur: w.status_salur,
          nominal_bantuan: w.nominal_bantuan,
          data: formatWarga(w)
        });
      } catch (e) {}
    }
  }

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

router.post(['/action', '/api/chat/action', '/investigasi/tindak-lanjut', '/api/investigasi/tindak-lanjut', '/tindak-lanjut', '/api/tindak-lanjut'], (req: Request, res: Response) => {
  const d = req.body || {};
  const nik = String(d.nik || '').trim();
  const idStr = String(d.id || '').replace(/\D/g, '').trim();
  const idNum = parseIntSafe(idStr, 0);
  const rawAksi = String(d.aksi || '').trim();
  const rawTahap = String(d.tahap || '').trim();
  const aksi = (rawTahap && rawTahap.startsWith('step')) ? rawTahap : (rawAksi || 'tanggapi');
  const tanggapan = String(d.tanggapan || d.catatan || '').trim();
  const petugas = String(d.petugas || 'Petugas Dinsos Sidoarjo').trim();

  let aduan = pengaduanStore.find(a => idNum > 0 && a.id === idNum);
  if (!aduan && d.id) {
    aduan = pengaduanStore.find(a => String(a.id) === String(d.id));
  }
  if (!aduan && nik) {
    aduan = [...pengaduanStore].reverse().find(a => a.nik === nik && a.status !== 'Selesai') || [...pengaduanStore].reverse().find(a => a.nik === nik);
  }

  if (!aduan) {
    return res.status(404).json({ status: 'error', message: 'Pengaduan tidak ditemukan.' });
  }

  if (aksi === 'step1') {
    aduan.status_step = 1;
    aduan.status_text = 'Laporan Diterima & Masuk Antrean';
    aduan.status = 'Diterima';
  } else if (aksi === 'terima' || aksi === 'step2') {
    aduan.status_step = 2;
    aduan.status_text = 'Peninjauan Bukti & Dokumen';
    aduan.status = 'Peninjauan';
  } else if (aksi === 'tanggapi' || aksi === 'step3') {
    aduan.status_step = 3;
    aduan.status_text = 'Investigasi Lapangan & Klarifikasi';
    aduan.status = 'Investigasi';
  } else if (aksi === 'mediasi' || aksi === 'step4') {
    aduan.status_step = 4;
    aduan.status_text = 'Mediasi & Musyawarah Dinsos';
    aduan.status = 'Mediasi';
  } else if (aksi === 'selesai' || aksi === 'step5') {
    aduan.status_step = 5;
    aduan.status_text = 'Putusan Akhir & Selesai';
    aduan.status = 'Selesai';
  }

  if (tanggapan) aduan.catatan_petugas = tanggapan;

  // Jika tahap selesai atau step 5, tandai seluruh aduan NIK ini selesai dan update status_salur warga
  const targetNik = aduan.nik || nik;
  const w = wargaStore.find(x => x.nik === targetNik);
  if (w && (aksi === 'selesai' || aksi === 'step5')) {
    w.status_salur = 'Telah Menerima';
    w.konfirmasi_warga = true;
    w.waktu_konfirmasi_warga = nowTimeStr();
    w.catatan = `Sengketa diselesaikan oleh ${petugas}: ${tanggapan || 'Bantuan fisik telah diterima secara sah.'}`;

    // Tandai semua tiket aduan lain dari NIK ini menjadi selesai
    pengaduanStore.forEach(otherA => {
      if (otherA.nik === targetNik && otherA.status !== 'Selesai') {
        otherA.status = 'Selesai';
        otherA.status_step = 5;
        otherA.status_text = 'Putusan Akhir & Selesai';
        otherA.catatan_petugas = tanggapan || otherA.catatan_petugas;
      }
    });

    const formatted = formatWarga(w);
    (formatted as any).aduan_aktif = aduan;
    broadcastRealtimeEvent({
      type: 'WARGA_SALUR_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      nominal_bantuan: w.nominal_bantuan,
      data: formatted
    });
  } else if (w) {
    const formatted = formatWarga(w);
    (formatted as any).aduan_aktif = aduan;
    broadcastRealtimeEvent({
      type: 'WARGA_SALUR_UPDATED',
      warga_id: w.id,
      nik: w.nik,
      status_salur: w.status_salur,
      nominal_bantuan: w.nominal_bantuan,
      data: formatted
    });
  }

  const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const msgText = `📢 [PEMBARUAN TAHAPAN INVESTIGASI]\nStatus laporan kini berada pada: ${aduan.status_text}.\nCatatan Petugas (${petugas}): ${tanggapan || 'Sedang dalam tindak lanjut investigasi.'}`;
  chatStore.push({
    id: nextChatId,
    nik: targetNik,
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

  const newestChat = chatStore[chatStore.length - 1];
  if (newestChat) realtimeChatMessage(newestChat);
  realtimeAduanUpdate(aduan, aksi);

  return res.json({
    status: 'success',
    message: `Status investigasi berhasil diperbarui ke ${aduan.status_text}.`,
    data: aduan
  });
});

export function isOfficerName(name: string): boolean {
  if (!name) return false;
  const n = String(name).toLowerCase().trim();
  return (
    n.startsWith('petugas') ||
    n.startsWith('admin') ||
    n.startsWith('super admin') ||
    n.startsWith('superadmin') ||
    n.startsWith('dinsos') ||
    n.includes('admin_bansos') ||
    n.includes('investigasi dinsos') ||
    n.includes('petugas dinsos') ||
    n.includes('super administrator') ||
    n.includes('(petugas') ||
    n.includes('(admin') ||
    n === 'operator' ||
    n === 'penyalur'
  );
}

export function resolveRealCitizenName(nik: string, fallback?: string): string {
  const cleanNik = String(nik || '').trim();
  if (!cleanNik) return fallback || 'Warga';

  // 1. Cek wargaStore (arsip resmi kependudukan)
  const w = wargaStore.find(x => String(x.nik) === cleanNik);
  if (w?.nama && !isOfficerName(w.nama)) return w.nama;

  // 2. Cek pengaduanStore (data warga pelapor resmi)
  const a = [...pengaduanStore].reverse().find(x => String(x.nik) === cleanNik);
  if (a?.nama && !isOfficerName(a.nama)) return a.nama;
  if (a?.nama_pelapor && !isOfficerName(a.nama_pelapor)) return a.nama_pelapor;

  // 3. Cek pesan warga di chatStore (yang dikirim oleh warga sendiri)
  const citizenMsg = [...chatStore].reverse().find(x => String(x.nik) === cleanNik && x.sender === 'warga' && x.nama && !isOfficerName(x.nama));
  if (citizenMsg?.nama) return citizenMsg.nama;

  // 4. Periksa fallback jika bukan nama petugas
  if (fallback && !isOfficerName(fallback) && !fallback.startsWith('Warga (')) {
    return fallback;
  }

  // 5. Default konsisten warga
  return `Warga Konsultasi (${cleanNik.slice(-4)})`;
}

router.get(['/list', '/inbox', '/conversations'], (_req: Request, res: Response) => {
  const seen = new Set<string>();
  const daftar: Record<string, unknown>[] = [];

  // 1. Kumpulkan seluruh percakapan aktif dari chatStore (warga terdaftar maupun non-arsip/tamu)
  [...chatStore].reverse().forEach(c => {
    if (!c.nik) return;
    if (!seen.has(c.nik)) {
      seen.add(c.nik);
      const w = wargaStore.find(x => x.nik === c.nik);
      const a = [...pengaduanStore].reverse().find(x => x.nik === c.nik);
      const unreadCount = chatStore.filter(x => x.nik === c.nik && x.sender === 'warga' && !x.is_read).length;
      
      const desilVal = w ? (Number(w.desil) || 1) : null;
      const namaWarga = resolveRealCitizenName(c.nik, c.sender === 'warga' ? c.nama : undefined);

      daftar.push({
        nik: c.nik,
        nama: namaWarga,
        last_msg: c.pesan || c.text || 'Media terlampir',
        pesan_terakhir: c.pesan || c.text || 'Media terlampir',
        waktu: c.waktu || 'Baru saja',
        created_at: c.created_at || new Date().toISOString(),
        unread_count: unreadCount,
        desil: desilVal !== null ? desilVal : 'Umum',
        is_prioritas: desilVal !== null ? (desilVal >= 1 && desilVal <= 4) : false,
        is_registered: Boolean(w),
        has_aduan: Boolean(a),
        aduan_id: a ? `ADUAN-${String(a.id).padStart(3, '0')}` : null,
        aduan_status: a?.status_text || a?.status || null
      });
    }
  });

  // 2. Kumpulkan warga yang telah melapor di pengaduanStore meskipun belum pernah mengirim teks obrolan
  [...pengaduanStore].reverse().forEach(a => {
    if (!a.nik) return;
    if (!seen.has(a.nik)) {
      seen.add(a.nik);
      const w = wargaStore.find(x => x.nik === a.nik);
      const desilVal = w ? (Number(w.desil) || 1) : null;
      const namaWarga = resolveRealCitizenName(a.nik, a.nama || a.nama_pelapor);
      const pesanLaporan = `[Laporan Aduan: ${a.kategori || 'Sengketa'}] ${a.uraian || a.deskripsi || 'Sanggahan belum menerima bansos'}`;

      daftar.push({
        nik: a.nik,
        nama: namaWarga,
        last_msg: pesanLaporan,
        pesan_terakhir: pesanLaporan,
        waktu: a.waktu || 'Hari ini',
        created_at: new Date().toISOString(),
        unread_count: 1,
        desil: desilVal !== null ? desilVal : 'Umum',
        is_prioritas: desilVal !== null ? (desilVal >= 1 && desilVal <= 4) : false,
        is_registered: Boolean(w),
        has_aduan: true,
        aduan_id: `ADUAN-${String(a.id).padStart(3, '0')}`,
        aduan_status: a.status_text || a.status
      });
    }
  });

  // Catatan: Hanya warga yang memiliki riwayat pesan masuk atau laporan yang tampil di Pesan Masuk.
  // Warga terdaftar lainnya tetap dapat dihubungi melalui tab "Buku Kontak".
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

const RESERVED_CHAT_ROUTES = new Set([
  'code-files', 'code-content', 'code-save', 'eskalasi-list', 'inspeksi-kode',
  'list', 'inbox', 'conversations', 'messages', 'info', 'download',
  'laporan-chat', 'investigasi', 'laporan-pelanggaran', 'share-geotag',
  'geotag', 'publik', 'pengaduan', 'action', 'react', 'mark-read', 'pin', 'star',
  'handover', 'active-officer', 'assign-officer'
]);

// ENDPOINT INFORMASI PETUGAS RESMI AKTIF PENANGAN WARGA
router.get(['/:nik/active-officer', '/active-officer/:nik'], (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  let officer = chatOfficerMap[nik] || null;

  if (!officer) {
    const lastOfficer = [...chatStore].reverse().find(c => c.nik === nik && (c.sender === 'petugas' || c.sender === 'admin' || c.is_handover));
    if (lastOfficer) {
      officer = {
        name: lastOfficer.nama || '🛡️ Admin 1 / Petugas Dinsos',
        role: (lastOfficer as any).officer_role || (lastOfficer.sender === 'admin' ? 'Super Admin' : 'Petugas Dinsos'),
        updated_at: lastOfficer.created_at || new Date().toISOString()
      };
      chatOfficerMap[nik] = officer;
    }
  }

  const defaultOff = {
    name: '🛡️ Admin 1 / Petugas Dinsos',
    role: 'Petugas Dinsos',
    updated_at: new Date().toISOString()
  };

  const finalOfficer = officer || defaultOff;
  return res.json({
    status: 'success',
    officer: finalOfficer,
    data: finalOfficer
  });
});

// ENDPOINT PENGALIHAN RESMI PETUGAS (HANDOVER RESMI OLEH ADMIN / PETUGAS)
router.post(['/:nik/handover', '/:nik/assign-officer', '/handover/:nik'], (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  const d = req.body || {};
  const officerName = String(d.officer_name || d.nama || 'Petugas Dinsos Sidoarjo').trim();
  const officerRole = String(d.officer_role || d.role || 'Petugas Layanan').trim();
  const prevOfficer = chatOfficerMap[nik]?.name || 'Petugas Sebelumnya';

  const nowIso = new Date().toISOString();
  const nowClock = nowTimeStr().slice(-5);

  chatOfficerMap[nik] = {
    name: officerName,
    role: officerRole,
    username: String(d.username || ''),
    updated_at: nowIso
  };

  const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const handoverMsg = `🔄 [PENGALIHAN RESMI] Pelayanan percakapan resmi telah dialihkan. Sekarang ditangani oleh: ${officerName} (${officerRole}).`;

  const handoverChat: ChatItem = {
    id: nextId,
    nik,
    sender: 'system',
    nama: officerName,
    pesan: handoverMsg,
    text: handoverMsg,
    file_path: null,
    file_name: null,
    file_size: null,
    file_type: 'system',
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '',
    is_pinned: false,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowClock,
    created_at: nowIso,
    is_read: true,
    read_at: nowIso,
    delivered_at: nowIso,
    is_handover: true
  };

  chatStore.push(handoverChat);

  try { realtimeChatMessage(handoverChat); } catch(e) {}

  broadcastRealtimeEvent({
    type: 'CHAT_OFFICER_CHANGED',
    nik,
    officer_name: officerName,
    officer_role: officerRole, officer: { name: officerName, role: officerRole }, chat: handoverChat
  });

  return res.json({
    status: 'success',
    message: `Petugas penangan resmi berhasil dialihkan ke ${officerName}.`,
    officer: chatOfficerMap[nik],
    chat: handoverChat
  });
});

router.get('/:nik', (req: Request, res: Response, next: any) => {
  const nik = String(req.params.nik || '').trim();
  if (!/^\d{10,18}$/.test(nik)) {
    return next();
  }
  const messages = chatStore.filter(c => c.nik === nik);
  res.json(messages);
});

function parseTimestampSafe(str?: string | null): number {
  if (!str) return 0;
  const t = new Date(str).getTime();
  if (!isNaN(t)) return t;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
  }
  return 0;
}

router.post('/:nik', (req: Request, res: Response, next: any) => {
  const nik = String(req.params.nik || '').trim();
  if (!/^\d{10,18}$/.test(nik)) {
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

    const nowIso = new Date().toISOString();
    const msgWaktu = String(d.waktu || '').trim() || nowTimeStr().slice(-5);
    const msgCreatedAt = d.created_at && !isNaN(new Date(d.created_at).getTime()) ? String(d.created_at) : nowIso;

    // OTOMATIS: Deteksi jika petugas yang membalas berbeda dari petugas sebelumnya
    if (isOfficer) {
      const currentOfficerName = nama;
      const currentOfficerRole = String(d.officer_role || (sender === 'admin' ? 'Super Admin' : 'Petugas Dinsos'));
      const prevOfficer = chatOfficerMap[nik]?.name;

      if (prevOfficer && prevOfficer.trim() !== '' && prevOfficer !== currentOfficerName) {
        // Terdapat petugas lain yang membalas tanpa peralihan manual -> catat pesan sistem dan beritahukan warga
        const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
        const handoverText = `🔄 [PETUGAS BERUBAH] Petugas respon resmi telah beralih. Percakapan ini sekarang ditangani oleh: ${currentOfficerName} (${currentOfficerRole}).`;
        const handoverChat: ChatItem = {
          id: nextId,
          nik,
          sender: 'system',
          nama: currentOfficerName,
          pesan: handoverText,
          text: handoverText,
          file_path: null,
          file_name: null,
          file_size: null,
          file_type: 'system',
          reply_sender: null,
          reply_text: null,
          reply_to_id: null,
          reaction: '',
          is_pinned: false,
          is_deleted_all: false,
          deleted_for: null,
          waktu: msgWaktu,
          created_at: msgCreatedAt,
          is_read: true,
          read_at: msgCreatedAt,
          delivered_at: msgCreatedAt,
          is_handover: true
        };
        chatStore.push(handoverChat);
        try { realtimeChatMessage(handoverChat); } catch(e) {}
        broadcastRealtimeEvent({
          type: 'CHAT_OFFICER_CHANGED',
          nik,
          officer_name: currentOfficerName,
          officer_role: currentOfficerRole,
          chat: handoverChat
        });
      }

      // Perbarui peta petugas aktif untuk NIK warga ini
      chatOfficerMap[nik] = {
        name: currentOfficerName,
        role: currentOfficerRole,
        username: String(d.username || ''),
        updated_at: nowIso
      };
    }

    const resolveFileType = (f: Express.Multer.File, pText: string): string => {
      const ext = path.extname(f.originalname || f.filename).toLowerCase().replace('.', '');
      if (f.filename.startsWith('voice_') || (f.originalname && f.originalname.startsWith('voice_')) || (f.mimetype && f.mimetype.startsWith('audio/'))) {
        return 'audio';
      }
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext) || (f.mimetype && f.mimetype.startsWith('image/'))) return 'image';
      if (['mp4', 'mov', 'avi', 'mkv', '3gp', 'wmv', 'flv'].includes(ext) || (f.mimetype && f.mimetype.startsWith('video/'))) return 'video';
      if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba', 'flac'].includes(ext)) return 'audio';
      if (ext === 'webm') return ((f.mimetype && f.mimetype.startsWith('audio/')) || (f.originalname && f.originalname.includes('voice')) || (f.filename && f.filename.includes('voice')) || pText.toLowerCase().includes('suara') || pText.toLowerCase().includes('voice')) ? 'audio' : 'video';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'json', 'zip', 'rar', '7z', 'tar', 'gz', 'xml'].includes(ext)) return 'document';
      return customType || 'document';
    };

    if (files.length > 0) {
      files.forEach((f, idx) => {
        const fileType = resolveFileType(f, pesan);
        const nowTime = Date.now();

        // Pencegahan duplikasi berkas & pesan suara akibat double-click instan (dalam kurun waktu 1.5 detik)
        const isDuplicate = chatStore.some(c => {
          if (c.nik !== nik || c.sender !== sender) return false;
          if (createdChats.some(created => created.id === c.id)) return false;
          const diffMs = Math.abs(nowTime - parseTimestampSafe(c.created_at));
          if (diffMs > 1500) return false;

          // Jika ukuran berkas sama persis dan nama mirip dalam 1.5 detik
          if (c.file_size === f.size && f.size > 0 && c.file_name === (f.originalname || f.filename)) {
            return true;
          }
          if (fileType === 'audio' && c.file_type === 'audio' && diffMs < 1200 && c.file_size === f.size && c.file_name === (f.originalname || f.filename)) {
            return true;
          }

          return false;
        });

        if (isDuplicate) {
          // Cari pesan yang sudah ada untuk dikembalikan
          const existingItem = [...chatStore].reverse().find(c => c.nik === nik && c.sender === sender);
          if (existingItem) {
            createdChats.push(existingItem);
          }
          return;
        }

        const filePath = `/uploads/${f.filename}`;
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
    }

    // Tangani berkas cloud link dari Google Drive atau Google Foto jika dilampirkan
    Object.keys(d).forEach(k => {
      if (k.startsWith('cloud_link_') && d[k]) {
        const link = String(d[k]).trim();
        const suffix = k.replace('cloud_link_', '');
        const cName = String(d['cloud_name_' + suffix] || 'Berkas Google Workspace').trim();
        const cType = String(d['cloud_type_' + suffix] || 'document').trim();
        if (link) {
          const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
          const chatItem: ChatItem = {
            id: nextId,
            nik,
            sender,
            nama,
            pesan: `📎 [GOOGLE_WORKSPACE] ${cName}`,
            text: `📎 [GOOGLE_WORKSPACE] ${cName}`,
            file_path: link,
            file_name: cName,
            file_size: null,
            file_type: cType,
            reply_sender: null,
            reply_text: null,
            reply_to_id: null,
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
      }
    });

    if (files.length === 0 && createdChats.length === 0) {
      const nextId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
      const fileUrl = (d.file_url || d.file_path) ? String(d.file_url || d.file_path).trim() : null;
      const fileName = d.file_name ? String(d.file_name).trim() : (fileUrl ? 'Berkas Google Workspace' : null);
      let fileType = d.file_type ? String(d.file_type).trim() : (customType || null);
      if (!fileType && fileUrl) {
        if (fileUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || (fileName && fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i))) fileType = 'image';
        else if (fileUrl.match(/\.(mp4|webm|mov|mkv)($|\?)/i) || (fileName && fileName.match(/\.(mp4|webm|mov|mkv)$/i))) fileType = 'video';
        else if (fileUrl.match(/\.(mp3|wav|ogg|m4a)($|\?)/i) || (fileName && fileName.match(/\.(mp3|wav|ogg|m4a)$/i))) fileType = 'audio';
        else fileType = 'document';
      }

      const chatItem: ChatItem = {
        id: nextId,
        nik,
        sender,
        nama,
        pesan: pesan || null,
        text: pesan || null,
        file_path: fileUrl,
        file_name: fileName,
        file_size: d.file_size ? (typeof d.file_size === 'number' ? d.file_size : parseIntSafe(d.file_size, 0)) : null,
        file_type: fileType,
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

    // Broadcast pesan ke penerima secara realtime dengan latency 0ms
    createdChats.forEach(c => {
      try { realtimeChatMessage(c); } catch(e) {}
    });

    return res.status(201).json({
      status: 'success',
      message: `${createdChats.length} pesan berhasil dikirim.`,
      data: createdChats.length === 1 ? createdChats[0] : createdChats,
      items: createdChats
    });
  });
});

router.post(['/investigasi/selesaikan', '/api/investigasi/selesaikan', '/pengaduan/selesaikan', '/api/pengaduan/selesaikan', '/selesaikan', '/api/selesaikan'], (req: Request, res: Response) => {
  const d = req.body || {};
  const idStr = String(d.id || '').replace(/\D/g, '').trim();
  const idNum = parseIntSafe(idStr, 0);
  const nik = String(d.nik || '').trim();
  const catatan = String(d.catatan || d.catatan_penyelesaian || 'Laporan telah diverifikasi dan diselesaikan oleh tim Dinsos.').trim();
  const petugas = String(d.petugas || 'Admin 1 (Dinas Sosial Sidoarjo)').trim();

  let aduan = pengaduanStore.find(a => idNum > 0 && a.id === idNum);
  if (!aduan && d.id) {
    aduan = pengaduanStore.find(a => String(a.id) === String(d.id));
  }
  if (!aduan && nik) {
    aduan = [...pengaduanStore].reverse().find(a => a.nik === nik && a.status !== 'Selesai') || [...pengaduanStore].reverse().find(a => a.nik === nik);
  }
  if (!aduan && pengaduanStore.length > 0) {
    aduan = pengaduanStore.find(a => a.status !== 'Selesai') || pengaduanStore[0];
  }

  if (aduan) {
    const targetNik = aduan.nik || nik;

    // Tandai semua tiket aduan aktif milik warga ini menjadi Selesai (Step 5)
    pengaduanStore.forEach(a => {
      if ((targetNik && a.nik === targetNik) || a.id === aduan.id) {
        a.status = 'Selesai';
        a.status_step = 5;
        a.status_text = 'Laporan Selesai & Ditutup';
        a.catatan_petugas = catatan;
      }
    });

    const w = wargaStore.find(x => x.nik === targetNik);
    if (w) {
      w.status_salur = 'Telah Menerima';
      w.konfirmasi_warga = true;
      w.waktu_konfirmasi_warga = nowTimeStr();
      w.catatan = `Selesai dimediasi oleh ${petugas}: ${catatan}`;
      const formatted = formatWarga(w);
      (formatted as any).aduan_aktif = aduan;
      broadcastRealtimeEvent({
        type: 'WARGA_SALUR_UPDATED',
        warga_id: w.id,
        nik: w.nik,
        status_salur: w.status_salur,
        nominal_bantuan: w.nominal_bantuan,
        data: formatted
      });
    }

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

    const newestChat = chatStore[chatStore.length - 1];
    if (newestChat) realtimeChatMessage(newestChat);
    realtimeAduanUpdate(aduan, 'selesai');

    return res.json({ status: 'success', message: 'Laporan pengaduan berhasil diselesaikan.', data: aduan });
  }

  return res.status(404).json({ status: 'error', message: 'Pengaduan tidak ditemukan.' });
});

// =========================================================================
// MEKANISME TERHUBUNG: ADMIN BANSOS <-> SUPER ADMIN (ESKALASI & INVESTIGASI)
// =========================================================================

// 1. Admin Bansos meneruskan / mengeskalasikan aduan ke Super Admin (Developer)
router.post(['/investigasi/eskalasikan', '/api/investigasi/eskalasikan', '/pengaduan/eskalasikan', '/api/pengaduan/eskalasikan', '/eskalasikan', '/api/eskalasikan'], (req: Request, res: Response) => {
  const d = req.body || {};
  const idStr = String(d.id || '').replace('ADUAN-', '').trim();
  const idNum = parseIntSafe(idStr, 0);
  const nik = String(d.nik || '').trim();
  const alasan = String(d.alasan_eskalasi || d.alasan || 'Pemeriksaan integritas algoritma SPK & audit keabsahan data').trim();
  const urgensi = String(d.urgensi_eskalasi || d.urgensi || 'Tinggi').trim();
  const catatanAdmin = String(d.catatan_admin || d.catatan || 'Mohon bantuan Super Admin untuk penelusuran kode dan log database.').trim();
  const petugas = String(d.petugas || 'Admin Bansos Sidoarjo').trim();

  let aduan = pengaduanStore.find(a => (idNum > 0 && a.id === idNum) || (nik && a.nik === nik));
  if (!aduan && pengaduanStore.length > 0) {
    aduan = pengaduanStore.find(a => a.status !== 'Selesai') || pengaduanStore[0];
  }

  if (!aduan) {
    return res.status(404).json({ status: 'error', message: 'Laporan aduan tidak ditemukan.' });
  }

  aduan.eskalasi_ke_superadmin = true;
  aduan.alasan_eskalasi = alasan;
  aduan.urgensi_eskalasi = urgensi;
  aduan.diteruskan_oleh = petugas;
  aduan.waktu_eskalasi = nowTimeStr();
  aduan.status_superadmin = 'Menunggu Review Super Admin';
  aduan.status_text = 'Diteruskan ke Super Admin (Investigasi Teknis)';
  aduan.catatan_petugas = `[Diteruskan ke Super Admin] ${alasan}. Catatan Admin: ${catatanAdmin}`;

  catatNotifikasi(
    `🚨 [ESKALASI ADUAN KE SUPER ADMIN] ${aduan.nama} (NIK: ${aduan.nik}) diteruskan oleh ${petugas}. Alasan: ${alasan} (Urgensi: ${urgensi})`,
    'Admin Bansos',
    'urgent'
  );

  const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const msgText = `🛡️ [ESKALASI KEDINASAN] Laporan Anda telah diteruskan oleh ${petugas} ke tim Super Admin (Developer) untuk audit kode dan verifikasi basis data teknis.\n\nAlasan: ${alasan}\nUrgensi: ${urgensi}`;
  chatStore.push({
    id: nextChatId,
    nik: aduan.nik,
    sender: 'petugas',
    nama: 'Sistem Terpadu Dinsos',
    pesan: msgText,
    text: msgText,
    file_path: null,
    file_type: null,
    reply_sender: null,
    reply_text: null,
    reply_to_id: null,
    reaction: '🛡️',
    is_pinned: true,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: nowTimeStr()
  });

  const newestChat = chatStore[chatStore.length - 1];
  if (newestChat) realtimeChatMessage(newestChat);
  realtimeEskalasiSuperAdmin(aduan);

  return res.json({
    status: 'success',
    message: 'Laporan aduan berhasil dieskalasikan ke Super Admin.',
    data: aduan
  });
});

// 2. Super Admin memberikan putusan teknis & instruksi perbaikan kepada Admin Bansos
router.post(['/investigasi/putusan-superadmin', '/api/investigasi/putusan-superadmin', '/pengaduan/putusan-superadmin', '/api/pengaduan/putusan-superadmin', '/putusan-superadmin', '/api/putusan-superadmin'], (req: Request, res: Response) => {
  const d = req.body || {};
  const idStr = String(d.id || '').replace('ADUAN-', '').trim();
  const idNum = parseIntSafe(idStr, 0);
  const nik = String(d.nik || '').trim();
  const tindakan = String(d.tindakan || 'selesai').trim(); // 'selesai' | 'perbaiki_data' | 'kembalikan'
  const putusan = String(d.putusan || d.rekomendasi || 'Telah dilakukan verifikasi algoritma dan perbaikan kode data.').trim();
  const auditKode = String(d.audit_kode || 'Inspeksi SPK SAW BWM, Bobot 10 Kriteria, dan Cyber Shield WAF Selesai').trim();
  const petugas = String(d.petugas || 'Super Admin (Developer)').trim();

  let aduan = pengaduanStore.find(a => (idNum > 0 && a.id === idNum) || (nik && a.nik === nik));
  if (!aduan && pengaduanStore.length > 0) {
    aduan = pengaduanStore.find(a => a.eskalasi_ke_superadmin) || pengaduanStore[0];
  }

  if (!aduan) {
    return res.status(404).json({ status: 'error', message: 'Laporan aduan tidak ditemukan.' });
  }

  aduan.putusan_superadmin = putusan;
  aduan.audit_kode_terkait = auditKode;
  aduan.waktu_putusan_superadmin = nowTimeStr();

  if (tindakan === 'selesai' || tindakan === 'perbaiki_data') {
    aduan.status = 'Selesai';
    aduan.status_step = 4;
    aduan.status_text = 'Selesai & Ditutup (Putusan Super Admin)';
    aduan.status_superadmin = 'Selesai - Rekomendasi Diterapkan';
    aduan.catatan_petugas = `[Selesai oleh Super Admin] Putusan: ${putusan} | Audit: ${auditKode}`;

    // Jika ada instruksi perbaikan data warga, sesuaikan status warga dan hitung ulang SPK
    const warga = wargaStore.find(w => w.nik === aduan?.nik);
    if (warga && tindakan === 'perbaiki_data') {
      warga.status_salur = 'Disetujui (Koreksi Super Admin)';
      warga.status_validasi = 'Disetujui';
      warga.is_verified = true;
      warga.status_bansos = 'Layak Bansos';
      hitungDanSinkronkanSawBwm();
    }
  } else {
    // Dikembalikan ke Admin Bansos untuk tindak lanjut verifikasi lapangan lanjutan
    aduan.status_superadmin = 'Dikembalikan ke Admin Bansos';
    aduan.status_text = 'Dikembalikan oleh Super Admin (Perlu Tindak Lanjut Admin)';
    aduan.catatan_petugas = `[Instruksi Super Admin untuk Admin Bansos] ${putusan}`;
  }

  catatNotifikasi(
    `🛡️ [PUTUSAN RESMI SUPER ADMIN] Tiket ${aduan.nama} (NIK: ${aduan.nik}) telah diputuskan oleh ${petugas}: "${putusan}". Admin Bansos dapat menindaklanjuti.`,
    'Super Admin',
    'success'
  );

  const nextChatId = chatStore.length > 0 ? Math.max(...chatStore.map(c => c.id)) + 1 : 1;
  const msgText = `🏛️ [KEPUTUSAN AKHIR SUPER ADMIN]\nHasil Investigasi Kode & Data:\n${putusan}\n\nAudit Teknis: ${auditKode}\nStatus: ${aduan.status_text}`;
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
    reaction: '⚖️',
    is_pinned: true,
    is_deleted_all: false,
    deleted_for: null,
    waktu: nowTimeStr().slice(-5),
    created_at: nowTimeStr()
  });

  const newestChat = chatStore[chatStore.length - 1];
  if (newestChat) realtimeChatMessage(newestChat);
  realtimePutusanSuperAdmin(aduan);

  return res.json({
    status: 'success',
    message: 'Putusan Super Admin berhasil disimpan dan diteruskan kembali ke Admin Bansos.',
    data: aduan
  });
});

// 3. Daftar seluruh tiket eskalasi aduan untuk Super Admin
router.get(['/investigasi/eskalasi-list', '/api/investigasi/eskalasi-list'], (_req: Request, res: Response) => {
  const list = pengaduanStore.filter(a => a.eskalasi_ke_superadmin);
  return res.json({
    status: 'success',
    total_eskalasi: list.length,
    menunggu_review: list.filter(a => a.status !== 'Selesai').length,
    data: list
  });
});

// 4. API Akses Keseluruhan Kode & Inspeksi Sistem bagi Super Admin
router.get(['/investigasi/inspeksi-kode', '/api/investigasi/inspeksi-kode'], (req: Request, res: Response) => {
  const nik = String(req.query.nik || '').trim();
  const wargaTerkait = nik ? wargaStore.find(w => w.nik === nik) : null;

  return res.json({
    status: 'success',
    system_version: 'SIP-BANSOS v3.5.0 Enterprise Multi-Role',
    engine_spk: {
      metode_utama: 'Best-Worst Method (BWM) & Simple Additive Weighting (SAW)',
      rumus_benefit: 'r_ij = x_ij / max(x_j)',
      rumus_cost: 'r_ij = min(x_j) / x_ij',
      rumus_skor_akhir: 'V_i = SUM(w_j * r_ij) untuk j=1..10',
      total_kriteria: kriteriaStore.length,
      daftar_kriteria: kriteriaStore.map(k => ({
        kode: k.kode,
        nama: k.nama,
        tipe: k.tipe,
        bobot: k.bobot,
        bobot_persen: `${(k.bobot * 100).toFixed(1)}%`
      }))
    },
    cyber_shield: {
      status: 'Active Real-Time Monitoring',
      kategori_serangan_diawasi: [
        'SQL Injection (SQLi)',
        'Cross-Site Scripting (XSS)',
        'Path Traversal & LFI',
        'Command Injection (RCE)',
        'Server-Side Template Injection (SSTI)',
        'Tamper & DevTools Injection'
      ],
      waf_active: true
    },
    warga_terkait: wargaTerkait || null,
    database_status: {
      total_penerima_terdata: wargaStore.length,
      total_pengaduan_masuk: pengaduanStore.length,
      total_eskalasi_aktif: pengaduanStore.filter(a => a.eskalasi_ke_superadmin && a.status !== 'Selesai').length
    }
  });
});

// =========================================================================
// API CODE EDITOR KESELURUHAN SISTEM (SUPER ADMIN DEVELOPER)
// =========================================================================

// Helper list all project editable files
function getProjectEditableFiles(dir: string, baseDir: string = dir): Array<{ path: string; name: string; folder: string; size: number; lines: number; ext: string; modified: string }> {
  let results: Array<{ path: string; name: string; folder: string; size: number; lines: number; ext: string; modified: string }> = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (['node_modules', '.git', '.gemini', '.aistudio', 'uploads', 'scratch', 'tmp', 'dist', 'build', '.vscode'].includes(item)) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getProjectEditableFiles(fullPath, baseDir));
      } else {
        const ext = path.extname(item).toLowerCase().replace('.', '');
        if (['ts', 'js', 'json', 'html', 'css', 'md', 'cjs', 'mjs', 'txt'].includes(ext)) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
          const folder = path.dirname(relPath).replace(/\\/g, '/');
          results.push({
            path: relPath,
            name: item,
            folder: folder === '.' ? 'root' : folder,
            size: stat.size,
            lines,
            ext,
            modified: stat.mtime.toISOString()
          });
        }
      }
    }
  } catch (e) {}
  return results;
}

// 1. Get Code Files Tree / List
router.get(['/investigasi/code-files', '/api/investigasi/code-files', '/code-files', '/api/chat/code-files'], (_req: Request, res: Response) => {
  const rootDir = process.cwd();
  const files = getProjectEditableFiles(rootDir);
  // Sort files nicely by folder then name
  files.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  return res.json({
    status: 'success',
    total_files: files.length,
    root: rootDir,
    files
  });
});

// 2. Get Code File Content
router.get(['/investigasi/code-content', '/api/investigasi/code-content', '/code-content', '/api/chat/code-content'], (req: Request, res: Response) => {
  const relFile = String(req.query.file || '').trim();
  if (!relFile) {
    return res.status(400).json({ status: 'error', message: 'Parameter file wajib disertakan.' });
  }

  const rootDir = process.cwd();
  const safeRelPath = path.normalize(relFile).replace(/^(..(\/|\\|$))+/, '');
  const fullPath = path.resolve(rootDir, safeRelPath);

  if (!fullPath.startsWith(rootDir)) {
    return res.status(403).json({ status: 'error', message: 'Akses path tidak diizinkan.' });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ status: 'error', message: `Berkas ${safeRelPath} tidak ditemukan.` });
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(fullPath).toLowerCase().replace('.', '');
    const lines = content.split('\n').length;
    let language = 'plaintext';
    if (ext === 'ts') language = 'typescript';
    else if (['js', 'cjs', 'mjs'].includes(ext)) language = 'javascript';
    else if (ext === 'html') language = 'html';
    else if (ext === 'css') language = 'css';
    else if (ext === 'json') language = 'json';
    else if (ext === 'md') language = 'markdown';

    return res.json({
      status: 'success',
      file: safeRelPath.replace(/\\/g, '/'),
      name: path.basename(fullPath),
      content,
      lines,
      size: Buffer.byteLength(content, 'utf8'),
      language,
      ext
    });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message || 'Gagal membaca berkas.' });
  }
});

// 3. Save Code File Content
router.post(['/investigasi/code-save', '/api/investigasi/code-save', '/code-save', '/api/chat/code-save'], (req: Request, res: Response) => {
  const relFile = String(req.body?.file || '').trim();
  const newContent = typeof req.body?.content === 'string' ? req.body.content : null;

  if (!relFile || newContent === null) {
    return res.status(400).json({ status: 'error', message: 'Parameter file dan content wajib disertakan.' });
  }

  const rootDir = process.cwd();
  const safeRelPath = path.normalize(relFile).replace(/^(..(\/|\\|$))+/, '');
  const fullPath = path.resolve(rootDir, safeRelPath);

  if (!fullPath.startsWith(rootDir)) {
    return res.status(403).json({ status: 'error', message: 'Akses path tidak diizinkan.' });
  }

  try {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    const lines = newContent.split('\n').length;
    
    // Broadcast live code update event
    broadcastRealtimeEvent({
      type: 'CODE_UPDATED_LIVE',
      file: safeRelPath.replace(/\\/g, '/'),
      lines,
      updated_at: new Date().toISOString()
    });

    return res.json({
      status: 'success',
      message: `Berkas ${safeRelPath.replace(/\\/g, '/')} berhasil disimpan dan langsung aktif di sistem!`,
      file: safeRelPath.replace(/\\/g, '/'),
      lines,
      saved_at: new Date().toISOString()
    });
  } catch (e: any) {
    return res.status(500).json({ status: 'error', message: e.message || 'Gagal menyimpan perubahan berkas.' });
  }
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
  try {
    broadcastRealtimeEvent({
      type: 'CHAT_MESSAGE_PINNED',
      msg_id: chat.id,
      is_pinned: chat.is_pinned,
      data: chat
    });
  } catch (e) {}
  return res.json({ status: 'success', is_pinned: chat.is_pinned, id: chat.id, pesan: chat.pesan, text: chat.text });
});

router.all(['/star/:msg_id', '/api/chat/star/:msg_id'], (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const chat = chatStore.find(c => c.id === id);
  if (!chat) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });
  if (req.body && typeof req.body.is_starred !== 'undefined') {
    chat.is_starred = Boolean(req.body.is_starred);
  } else {
    chat.is_starred = !chat.is_starred;
  }
  try {
    broadcastRealtimeEvent({
      type: 'CHAT_MESSAGE_STARRED',
      msg_id: chat.id,
      is_starred: chat.is_starred,
      data: chat
    });
  } catch (e) {}
  return res.json({ status: 'success', is_starred: chat.is_starred, id: chat.id, pesan: chat.pesan, text: chat.text });
});

router.delete('/action/:msg_id', (req: Request, res: Response) => {
  const id = parseIntSafe(req.params.msg_id, 0);
  const idx = chatStore.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Pesan tidak ditemukan.' });

  const tipe = String(req.body?.type || 'everyone');
  const requester = String(req.body?.requester || '').trim().toLowerCase();

  // VALIDASI KETAT: "Hapus untuk Semua Orang" HANYA diizinkan jika pemohon adalah pengirim asli pesan
  if (tipe === 'everyone') {
    const isWargaRequester = requester === 'warga' || /^\d{16}$/.test(requester);
    const msgSender = String(chatStore[idx].sender || '').toLowerCase();
    const isMessageFromWarga = msgSender === 'warga';

    if (isWargaRequester && !isMessageFromWarga) {
      return res.status(403).json({
        status: 'error',
        message: 'Opsi Hapus untuk Semua Orang hanya berlaku untuk pesan yang Anda kirimkan sendiri.'
      });
    }

    chatStore[idx].is_deleted_all = true;
    chatStore[idx].pesan = '🚫 Pesan telah dihapus';
    chatStore[idx].text = '🚫 Pesan telah dihapus';
    chatStore[idx].file_path = null;
    chatStore[idx].file_name = null;
    chatStore[idx].file_size = null;
    chatStore[idx].file_type = null;
    chatStore[idx].reaction = '';
    try {
      broadcastRealtimeEvent({
        type: 'CHAT_MESSAGE_DELETED',
        msg_id: id,
        delete_type: 'everyone',
        data: chatStore[idx]
      });
    } catch (e) {}
  } else {
    chatStore[idx].deleted_for = `me_${req.body?.requester || 'warga'}`;
    try {
      broadcastRealtimeEvent({
        type: 'CHAT_MESSAGE_DELETED',
        msg_id: id,
        delete_type: 'me',
        requester: req.body?.requester || 'warga'
      });
    } catch (e) {}
  }
  return res.json({ status: 'success', message: 'Pesan berhasil dihapus.', data: chatStore[idx] });
});

// Endpoint untuk membersihkan seluruh percakapan warga di Dasbor Pribadi Anda
router.delete(['/clear-warga/:nik', '/api/chat/clear-warga/:nik', '/clear/:nik'], (req: Request, res: Response) => {
  const nik = String(req.params.nik || '').trim();
  if (!nik) return res.status(400).json({ status: 'error', message: 'NIK tidak valid.' });

  let clearedCount = 0;
  chatStore.forEach(c => {
    if (c.nik === nik) {
      c.deleted_for = 'me_warga';
      clearedCount++;
    }
  });

  try {
    broadcastRealtimeEvent({
      type: 'CHAT_CLEARED',
      nik: nik,
      requester: 'warga'
    });
  } catch (e) {}

  return res.json({
    status: 'success',
    message: `Riwayat obrolan warga (${nik}) berhasil dibersihkan (${clearedCount} pesan disembunyikan).`,
    cleared_count: clearedCount
  });
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
  const tipeLaporan = (d.tipe_laporan === 'keseluruhan_obrolan' || !msgId) ? 'keseluruhan_obrolan' : 'pesan_tunggal';
  const transkrip = Array.isArray(d.transkrip) ? d.transkrip : [];
  const totalPesan = transkrip.length || parseIntSafe(d.total_pesan, 0);

  let pesanKutipan = String(d.pesan || d.pesan_kutipan || '').trim();
  if (tipeLaporan === 'keseluruhan_obrolan') {
    pesanKutipan = `📋 [KESELURUHAN OBROLAN] Transkrip obrolan terlampir (${totalPesan} pesan). ${pesanKutipan ? `Ringkasan: "${pesanKutipan.slice(0, 150)}"` : ''}`;
  }

  const namaTerlapor = String(d.nama_terlapor || (tipeLaporan === 'keseluruhan_obrolan' ? 'Pihak Terkait (Seluruh Obrolan)' : (d.sender_terlapor === 'warga' ? 'Warga' : 'Petugas Dinsos'))).trim();
  const senderTerlapor = String(d.sender_terlapor || (d.pelapor_role === 'warga' ? 'petugas' : 'warga')).trim();
  const alasan = String(d.alasan || (tipeLaporan === 'keseluruhan_obrolan' ? 'Pelaporan Keseluruhan Percakapan' : 'Pelanggaran Norma Komunikasi')).trim();
  const kategori = String(d.kategori || 'Pelanggaran Etika / Ujaran Kebencian').trim();
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
    tipe_laporan: tipeLaporan,
    transkrip,
    total_pesan: totalPesan,
    pelapor_role: pelaporRole,
    pelapor_nama: pelaporNama,
    pelapor_nik: pelaporNik,
    status: 'Menunggu Peninjauan',
    waktu: nowTimeStr(),
    created_at: nowTimeStr()
  };

  laporanPelanggaranStore.unshift(newReport);
  const notifLabel = tipeLaporan === 'keseluruhan_obrolan' ? 'Laporan Keseluruhan Obrolan' : 'Laporan Pelanggaran Chat';
  catatNotifikasi(`🚩 ${notifLabel} Baru (${kodeLaporan}) diajukan oleh ${pelaporNama} terkait "${alasan}".`, 'Pengawas', 'urgent');
  realtimeLaporanPelanggaranNew(newReport);

  // SINKRONISASI OTOMATIS KE pengaduanStore AGAR LANGSUNG MUNCUL DI PUSAT INVESTIGASI ADUAN ADMIN & PETUGAS
  const nextPengaduanId = pengaduanStore.length > 0 ? Math.max(...pengaduanStore.map(p => p.id)) + 1 : 1;
  const newPengaduan: PengaduanItem = {
    id: nextPengaduanId,
    nik: pelaporNik || nik || '3515990000000010',
    nama: pelaporNama,
    nama_pelapor: pelaporNama,
    kategori: `Pelanggaran Chat: ${kategori}`,
    uraian: tipeLaporan === 'keseluruhan_obrolan'
      ? `[LAPORAN KESELURUHAN OBROLAN - ${kodeLaporan}] Dilaporkan oleh ${pelaporNama} (NIK: ${pelaporNik || nik}). Total ${totalPesan} pesan riwayat dilampirkan. Kategori: ${kategori}. Kronologi/Alasan: ${deskripsi}`
      : `[LAPORAN PELANGGARAN PESAN - ${kodeLaporan}] Pesan terlapor: "${pesanKutipan}". Kategori: ${kategori}. Kronologi/Alasan: ${deskripsi}`,
    deskripsi: deskripsi,
    isi_laporan: deskripsi,
    status: 'Tahap Mediasi',
    status_step: 2,
    status_text: 'Tahap Mediasi',
    catatan_petugas: `Laporan masuk dari portal warga (${kodeLaporan}). Menunggu investigasi etik dan moderasi tim pengawas.`,
    waktu: nowTimeStr(),
    created_at: nowTimeStr(),
    riwayat_penanganan: [
      {
        tahap: 'Laporan Diterima',
        oleh: pelaporNama,
        waktu: nowTimeStr(),
        catatan: `Laporan ${notifLabel} (${kodeLaporan}) diajukan ke Tim Investigasi & Pengawas Dinas Sosial.`
      }
    ]
  };
  pengaduanStore.unshift(newPengaduan);
  realtimeAduanNew(newPengaduan);

  return res.status(201).json({
    status: 'success',
    message: tipeLaporan === 'keseluruhan_obrolan' 
      ? 'Seluruh rekaman percakapan berhasil dilaporkan ke Pengawas Dinsos.'
      : 'Laporan pelanggaran berhasil dicatat dan masuk ke antrean moderasi.',
    data: newReport,
    aduan: newPengaduan
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
  realtimeLaporanPelanggaranUpdate(report);

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

  const lat = (d.lat !== undefined && d.lat !== null && !isNaN(Number(d.lat))) ? Number(d.lat) : (w ? Number(w.lat) : -7.4478);
  const lng = (d.lng !== undefined && d.lng !== null && !isNaN(Number(d.lng))) ? Number(d.lng) : (w ? Number(w.lng) : 112.7183);
  const namaWarga = w ? w.nama : nama;
  const alamat = d.alamat ? String(d.alamat).trim() : (w ? w.alamat : 'Kabupaten Sidoarjo');
  const tipe = d.tipe || (d.is_realtime ? 'realtime' : 'arsip');
  const accuracy = d.accuracy ? Number(d.accuracy) : null;

  const geotagPayload = {
    nik,
    nama: namaWarga,
    alamat,
    lat,
    lng,
    maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
    terverifikasi: true,
    pengirim: sender,
    tipe,
    accuracy,
    label: tipe === 'realtime' ? '📍 Lokasi Perangkat Real-time' : '🏠 Lokasi Rumah Arsip Warga'
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
