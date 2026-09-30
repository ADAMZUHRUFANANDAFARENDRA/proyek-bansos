import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';

import { UPLOAD_DIR } from './server/store.js';
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

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Disable caching on dynamic API routes
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

// Health check
app.get(['/api/health', '/api/ping', '/health', '/ping'], (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    database: 'in-memory-mock',
    timestamp: new Date().toISOString()
  });
});

// Modular Routes
app.use('/api/auth', authRoutes);
app.use('/', authRoutes);

app.use('/api/warga', wargaRoutes);
app.use('/warga', wargaRoutes);

app.use('/api/spk', spkRoutes);
app.use('/', spkRoutes);

app.use('/api', dukcapilRoutes);
app.use('/', dukcapilRoutes);

app.use('/api/mysql', mysqlRoutes);
app.use('/mysql', mysqlRoutes);

app.use('/api/notifikasi', notifRoutes);
app.use('/notifikasi', notifRoutes);

app.use('/api/chat', chatRoutes);
app.use('/chat', chatRoutes);
app.use('/', chatRoutes);

app.use('/api/publik', publicRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', publicRoutes);
app.use('/', publicRoutes);

// Static uploads & frontend
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/static/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.resolve(process.cwd(), 'frontend')));

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'frontend', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server SPK Bansos Kabupaten Sidoarjo aktif di http://0.0.0.0:${PORT}`);
});
