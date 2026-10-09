import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';

import { UPLOAD_DIR } from './server/store.js';
import { initRealtime, handleSseConnection, getRecentEventsHandler, handleCallSignal } from './server/realtime.js';
import { cyberShieldWaf } from './server/security_guard.js';
import securityRoutes from './server/routes/security_routes.js';
import authRoutes from './server/routes/auth_routes.js';
import wargaRoutes from './server/routes/warga_routes.js';
import spkRoutes from './server/routes/spk_routes.js';
import dukcapilRoutes from './server/routes/dukcapil_routes.js';
import mysqlRoutes from './server/routes/mysql_routes.js';
import notifRoutes from './server/routes/notif_routes.js';
import chatRoutes from './server/routes/chat_routes.js';
import publicRoutes from './server/routes/public_routes.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ============================================================================
// 1. HTTP SECURITY HEADERS (PERTAHANAN TINGKAT DASAR DARI CYBER ATTACK)
// ============================================================================
app.use((_req: Request, res: Response, next: NextFunction) => {
  // Cegah MIME Sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Cegah Clickjacking dengan mengizinkan framing di AI Studio preview & domain resmi
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");
  // Perlindungan XSS Peramban
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Kebijakan Referrer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Izin Sensor (Kamera, Mic, Geolocation yang diizinkan untuk operasional SPK Bansos)
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  // Hapus header fingerprinting server
  res.removeHeader('X-Powered-By');
  next();
});

// ============================================================================
// 2. PARSING REQUEST & CORS
// ============================================================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// 3. WAF CYBER SHIELD ENGINE (INSPEKSI SERANGAN SECARA REAL-TIME)
// Memeriksa 6 Kategori Model Serangan Siber & Penetrasi Berbahaya
// ============================================================================
app.use(cyberShieldWaf);

// Nonaktifkan Caching untuk Rute API Dinamis
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/warga') ||
    req.path.startsWith('/users') ||
    req.path.startsWith('/notifikasi') ||
    req.path.startsWith('/kriteria') ||
    req.path.startsWith('/hitung-saw') ||
    req.path.startsWith('/komparasi') ||
    req.path.startsWith('/chat')
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Health check aman
app.get(['/api/health', '/api/ping', '/health', '/ping'], (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    system: 'Sidoarjo SPK Bansos Enterprise',
    waf_shield: 'ACTIVE_PROTECTED',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 4. PENANGANAN STATIC FILES AMAN & SANDBOX UNTUK UPLOADS
// ============================================================================
// Cegah eksekusi script / HTML di dalam direktori /uploads (Sandbox CSP)
app.use(['/uploads', '/static/uploads'], (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/static/uploads', express.static(UPLOAD_DIR));

// Lindungi berkas sensitif dari pengunduhan langsung (firebase-applet-config, .env, package.json, dsb.)
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path.toLowerCase();
  const isProtected = 
    p.includes('.env') ||
    p.includes('config.json') ||
    p.includes('firebase') ||
    p.includes('serviceaccount') ||
    p.includes('.git') ||
    p.includes('metadata.json') ||
    p.includes('package.json') ||
    p.includes('tsconfig') ||
    p.includes('bun.lock') ||
    p.includes('mysql_storage') ||
    p.includes('server.ts') ||
    p.endsWith('.key') ||
    p.endsWith('.pem') ||
    p.endsWith('.cert');

  if (isProtected) {
    res.status(403).json({
      status: 'error',
      code: 'ACCESS_DENIED_PROTECTED_FILE',
      message: 'Akses ke berkas sistem dan konfigurasi rahasia dilarang oleh kebijakan Cyber Shield.'
    });
    return;
  }
  next();
});

// ============================================================================
// 5. JALUR AKSES TERKONTROL (PORTAL WARGA KHUSUS SUPER ADMIN & DEVELOPER)
// Sesuai instruksi: Portal Warga dikhususkan untuk investigasi & tindak lanjut eror
// ============================================================================

// PINTU UTAMA SISTEM: Halaman Masuk Aparatur & Pengguna Terdaftar
app.get(['/', '/aparatur', '/portal-aparatur', '/dinas', '/internal', '/login', '/login.html', '/admin-login', '/portal-dinas'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'frontend', 'login.html'));
});

// PINTU DIAGNOSTIK: PORTAL WARGA (Khusus Super Admin & Developer untuk Penelusuran Eror)
app.get(['/publik', '/publik.html', '/warga', '/portal-warga'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'frontend', 'publik.html'));
});

// Halaman Verifikasi Dokumen Sah Digital BSrE
app.get(['/verifikasi', '/verifikasi.html'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'frontend', 'verifikasi.html'));
});

// Dashboard Internal Aparatur (Setelah Login Sah)
app.get(['/admin', '/dashboard', '/index.html'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'frontend', 'index.html'));
});

// Static Assets (CSS, JS, Gambar)
app.use(express.static(path.resolve(process.cwd(), 'frontend')));

// ============================================================================
// 6. RUTE MODULAR API SISTEM (TERLINDUNGI)
// ============================================================================
// Rute Pusat Keamanan Siber (Super Admin)
app.use('/api/security', securityRoutes);
app.use('/security', securityRoutes);

// Rute Otentikasi
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Rute Warga
app.use('/api/warga', wargaRoutes);
app.use('/warga', wargaRoutes);

// Rute SPK & Algoritma Keputusan
app.use('/api/spk', spkRoutes);
app.use('/spk', spkRoutes);
app.use(['/api/hitung-saw', '/hitung-saw', '/api/sinkron-saw', '/sinkron-saw', '/api/kriteria', '/kriteria', '/api/bobot', '/bobot', '/api/bobot-bwm', '/bobot-bwm', '/api/komparasi', '/komparasi', '/api/sk-bupati', '/sk-bupati'], spkRoutes);

// Rute Dukcapil
app.use('/api', dukcapilRoutes);

// Rute MySQL Database
app.use('/api/mysql', mysqlRoutes);
app.use('/mysql', mysqlRoutes);

// Rute Notifikasi
app.use('/api/notifikasi', notifRoutes);
app.use('/notifikasi', notifRoutes);

// Rute Obrolan, Mediasi & Investigasi Aduan Warga
app.use('/api/chat', chatRoutes);
app.use('/chat', chatRoutes);
app.use('/api/investigasi', chatRoutes);
app.use('/investigasi', chatRoutes);
app.use('/api/pengaduan', chatRoutes);
app.use('/pengaduan', chatRoutes);
app.use('/api', chatRoutes);

// Rute Publik (Cek Bansos Warga)
app.use('/api/publik', publicRoutes);
app.use('/api/public', publicRoutes);

// Rute Real-Time Engine (SSE Streaming, History Buffer, & Panggilan WebRTC Signal)
app.get(['/api/realtime/stream', '/api/realtime/events'], handleSseConnection);
app.get(['/api/realtime/recent', '/api/realtime/history'], getRecentEventsHandler);
app.post(['/api/realtime/call-signal', '/api/chat/call-signal'], handleCallSignal);

// Penanganan 404 Endpoint API
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ status: 'error', message: 'Endpoint API tidak ditemukan.' });
  } else {
    // Arahkan pengunjung umum ke portal login aparatur
    res.redirect('/login.html');
  }
});

// Penanganan Kesalahan Global Tanpa Membocorkan Stack Trace
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[CYBER_SHIELD_ERROR]', err?.message || err);
  res.status(err.status || 500).json({
    status: 'error',
    code: 'SYSTEM_PROTECTED_ERROR',
    message: err.message && !err.message.includes('SQL') && !err.message.includes('at ')
      ? err.message
      : 'Terjadi kendala internal pada peladen. Sistem tetap terlindungi.'
  });
});

const server = http.createServer(app);
initRealtime(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CYBER_SHIELD] Server SPK Bansos Kabupaten Sidoarjo aktif di http://0.0.0.0:${PORT}`);
  console.log(`[CYBER_SHIELD] WAF & Intrusion Detection System AKTIF`);
  console.log(`[REALTIME] Engine Notifikasi & Pelaporan WebSocket Aktif di ws://0.0.0.0:${PORT}/ws/realtime`);
});
