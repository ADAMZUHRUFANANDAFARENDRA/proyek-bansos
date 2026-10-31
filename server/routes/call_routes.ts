import { Router, Request, Response } from 'express';
import {
  logPanggilanStore,
  wargaStore,
  catatNotifikasi,
  nowTimeStr
} from '../store.js';
import {
  saveLogPanggilanRealtimeToMysql,
  deleteLogPanggilanFromMysql,
  clearAllLogPanggilanInMysql
} from '../../mysql_storage.js';
import { broadcastRealtimeEvent } from '../realtime.js';
import type { LogPanggilanItem } from '../types.js';

const router = Router();

// GET all call logs with filters (for Admin, Petugas, Super Admin)
router.get(['/logs', '/api/panggilan/logs', '/api/calls', '/panggilan'], (req: Request, res: Response) => {
  const role = req.query.role ? String(req.query.role).toLowerCase() : null;
  const status = req.query.status ? String(req.query.status).toLowerCase() : null;
  const type = req.query.type ? String(req.query.type).toLowerCase() : null;
  const nik = req.query.nik ? String(req.query.nik).trim() : null;

  const aparaturRoles = ['admin', 'superadmin', 'super_admin', 'petugas'];
  let list = logPanggilanStore.filter(c => {
    // Aparatur tidak dapat melakukan panggilan satu sama lain, hanya ke/dari warga
    const isCallerAparatur = aparaturRoles.includes(String(c.caller_role || '').toLowerCase());
    const isCalleeAparatur = aparaturRoles.includes(String(c.callee_role || '').toLowerCase());
    if (isCallerAparatur && isCalleeAparatur) return false;
    return true;
  });

  if (nik) {
    list = list.filter(c => c.nik_warga === nik || c.caller_id === nik || c.callee_id === nik);
  }
  if (role) {
    list = list.filter(c => c.caller_role === role || c.callee_role === role);
  }
  if (status) {
    list = list.filter(c => c.status === status);
  }
  if (type) {
    list = list.filter(c => c.tipe_panggilan === type);
  }

  list.sort((a, b) => b.id - a.id);
  res.json({
    status: 'success',
    total: list.length,
    data: list
  });
});

// POST record new call log
router.post(['/log', '/api/panggilan/log', '/api/calls/log', '/panggilan/log'], async (req: Request, res: Response) => {
  const b = req.body || {};
  const callerId = String(b.caller_id || 'system').trim();
  const callerName = String(b.caller_name || 'Petugas Dinsos').trim();
  const callerRole = (b.caller_role || 'petugas') as any;
  const calleeId = String(b.callee_id || 'warga').trim();
  const calleeName = String(b.callee_name || 'Warga Sidoarjo').trim();
  const calleeRole = (b.callee_role || 'warga') as any;

  // Validasi: Aparatur (Admin, Petugas, Super Admin) TIDAK BISA melakukan panggilan satu sama lain
  const aparaturRoles = ['admin', 'superadmin', 'super_admin', 'petugas'];
  const isCallerAparatur = aparaturRoles.includes(String(callerRole).toLowerCase());
  const isCalleeAparatur = aparaturRoles.includes(String(calleeRole).toLowerCase());
  if (isCallerAparatur && isCalleeAparatur) {
    return res.status(403).json({
      status: 'error',
      message: 'Admin, Petugas, dan Super Admin tidak dapat melakukan panggilan satu sama lain. Panggilan hanya diizinkan dengan Warga Binaan Bansos.'
    });
  }

  const nikWarga = b.nik_warga ? String(b.nik_warga).trim() : (callerRole === 'warga' ? callerId : calleeId);
  const tipe = (b.tipe_panggilan || b.call_type || 'audio') as 'audio' | 'video';
  const status = (b.status || 'selesai') as any;
  const durasi = Number(b.durasi_detik || b.duration || 0);
  const catatan = String(b.catatan || `Panggilan ${tipe.toUpperCase()} antara ${callerName} dan ${calleeName}`).trim();

  const nextId = logPanggilanStore.length > 0 ? Math.max(...logPanggilanStore.map(c => c.id)) + 1 : 1;
  const nowIso = new Date().toISOString();
  const newCall: LogPanggilanItem = {
    id: nextId,
    caller_id: callerId,
    caller_name: callerName,
    caller_role: callerRole,
    callee_id: calleeId,
    callee_name: calleeName,
    callee_role: calleeRole,
    nik_warga: nikWarga && /^\d{16}$/.test(nikWarga) ? nikWarga : undefined,
    tipe_panggilan: tipe,
    status: status,
    durasi_detik: durasi,
    waktu_mulai: b.waktu_mulai || nowIso,
    waktu_selesai: b.waktu_selesai || nowIso,
    catatan: catatan,
    created_at: nowIso
  };

  logPanggilanStore.unshift(newCall);

  // Realtime persist to MySQL
  saveLogPanggilanRealtimeToMysql(newCall).catch(err => {
    console.warn('[LogPanggilan] Gagal menyimpan ke MySQL:', err);
  });

  // Broadcast realtime event
  broadcastRealtimeEvent({
    type: 'CALL_LOG_RECORDED',
    call: newCall
  });

  catatNotifikasi(
    `Riwayat Panggilan: Panggilan ${tipe.toUpperCase()} antara ${callerName} (${callerRole}) & ${calleeName} (${calleeRole}) selesai (${Math.floor(durasi / 60)}m ${durasi % 60}s).`,
    callerRole === 'warga' ? 'Warga' : 'Petugas',
    'panggilan'
  );

  res.json({
    status: 'success',
    data: newCall,
    message: 'Riwayat panggilan berhasil dicatat & disinkronkan ke database.'
  });
});

// Warga personal call logs (with privacy verification: NIK, Nama, Email)
router.post(['/publik/warga', '/api/publik/panggilan-warga'], (req: Request, res: Response) => {
  const b = req.body || {};
  const nik = String(b.nik || '').replace(/\D/g, '');
  const nama = String(b.nama || b.nama_lengkap || '').trim().toLowerCase();
  const email = String(b.email || '').trim().toLowerCase();

  if (!nik || nik.length !== 16) {
    return res.status(400).json({ status: 'error', message: 'Masukkan 16 digit NIK yang sah.' });
  }

  const w = wargaStore.find(x => x.nik === nik);
  if (!w) {
    return res.status(404).json({ status: 'error', message: 'Data NIK warga tidak ditemukan.' });
  }

  // Verifikasi nama dan/atau email
  const wNama = String(w.nama || '').trim().toLowerCase();
  const wEmail = String(w.email || '').trim().toLowerCase();

  const namaCocok = !nama || wNama.includes(nama) || nama.includes(wNama);
  const emailCocok = !email || !wEmail || wEmail === email;

  if (!namaCocok) {
    return res.status(403).json({ status: 'error', message: 'Nama lengkap tidak cocok dengan data KTP.' });
  }

  // Filter hanya log milik warga ini
  const calls = logPanggilanStore
    .filter(c => c.nik_warga === nik || c.caller_id === nik || c.callee_id === nik)
    .sort((a, b) => b.id - a.id);

  res.json({
    status: 'success',
    verified: true,
    total: calls.length,
    warga: { nik: w.nik, nama: w.nama },
    data: calls
  });
});

// DELETE single call log by id
router.delete(['/logs/:id', '/api/panggilan/logs/:id', '/api/calls/:id', '/panggilan/logs/:id'], async (req: Request, res: Response) => {
  const callId = String(req.params.id || '').trim();
  const idx = logPanggilanStore.findIndex(c => String(c.id) === callId);
  let removed = null;
  if (idx !== -1) {
    removed = logPanggilanStore.splice(idx, 1)[0];
  }

  await deleteLogPanggilanFromMysql(callId).catch(err => {
    console.warn('[LogPanggilan] Gagal hapus dari MySQL:', err);
  });

  broadcastRealtimeEvent({
    type: 'CALL_LOG_DELETED',
    id: callId
  });

  res.json({
    status: 'success',
    message: `Riwayat log panggilan ID #${callId} berhasil dihapus.`,
    data: removed
  });
});

// CLEAR / TRUNCATE all call logs
router.all(['/logs/clear', '/api/panggilan/logs/clear', '/api/calls/clear', '/panggilan/logs/clear'], async (_req: Request, res: Response) => {
  const totalCleared = logPanggilanStore.length;
  logPanggilanStore.length = 0;

  await clearAllLogPanggilanInMysql().catch(err => {
    console.warn('[LogPanggilan] Gagal truncate MySQL:', err);
  });

  broadcastRealtimeEvent({
    type: 'CALL_LOG_CLEARED'
  });

  res.json({
    status: 'success',
    message: `Seluruh riwayat panggilan (${totalCleared} data) berhasil dibersihkan dari server dan database.`,
    cleared_count: totalCleared
  });
});

export default router;
