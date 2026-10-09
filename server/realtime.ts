import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Request, Response } from 'express';
import { notifikasiStore, pengaduanStore, onNotifCreated } from './store.js';

export interface RealtimeEvent {
  id: string;
  type: string;
  timestamp: string;
  data?: any;
  item_id?: number | string;
  [key: string]: any;
}

interface ClientMeta {
  ws: WebSocket;
  isAlive: boolean;
  role: string;
  nik?: string;
  connectedAt: string;
}

// Koleksi koneksi WebSocket aktif
const wsClients = new Set<ClientMeta>();

// Koleksi koneksi SSE (Server-Sent Events) aktif sebagai failover zero-delay
const sseClients = new Set<Response>();

// Circular buffer untuk 50 riwayat event terakhir (mencegah event hilang saat reconnect singkat)
const recentEvents: RealtimeEvent[] = [];
const MAX_BUFFER = 50;

let wssInstance: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Inisialisasi WebSocket Server & Hub Real-Time
 */
export function initRealtime(server: http.Server) {
  wssInstance = new WebSocketServer({ server, path: '/ws/realtime' });

  wssInstance.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const meta: ClientMeta = {
      ws,
      isAlive: true,
      role: 'guest',
      connectedAt: new Date().toISOString()
    };
    wsClients.add(meta);

    // Kirim pesan selamat datang & sinkronisasi awal
    try {
      const unreadCount = notifikasiStore.filter(n => !n.is_read && !n.is_archived).length;
      const initialPayload: RealtimeEvent = {
        id: generateEventId(),
        type: 'SYSTEM_CONNECTED',
        timestamp: new Date().toISOString(),
        data: {
          server_time: new Date().toISOString(),
          active_connections: wsClients.size,
          unread_notif: unreadCount,
          total_aduan: pengaduanStore.length
        }
      };
      ws.send(JSON.stringify(initialPayload));
    } catch (e) {}

    ws.on('pong', () => {
      meta.isAlive = true;
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          meta.isAlive = true;
        } else if (parsed.type === 'IDENTIFY') {
          if (parsed.role) meta.role = String(parsed.role).trim();
          if (parsed.nik) meta.nik = String(parsed.nik).trim();
        } else if (['CALL_INVITE', 'CALL_ACCEPT', 'CALL_DECLINE', 'CALL_END', 'CALL_SIGNAL', 'CALL_RINGING'].includes(parsed.type)) {
          // Siarkan sinyal panggilan audio/video secara real-time
          broadcastRealtimeEvent({
            ...parsed,
            sender_id: meta.nik || meta.role
          });
        }
      } catch (err) {}
    });

    ws.on('close', () => {
      wsClients.delete(meta);
    });

    ws.on('error', () => {
      wsClients.delete(meta);
      try {
        ws.terminate();
      } catch (e) {}
    });
  });

  // Heartbeat monitoring setiap 25 detik
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    wsClients.forEach((client) => {
      if (!client.isAlive) {
        wsClients.delete(client);
        try {
          client.ws.terminate();
        } catch (e) {}
        return;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (e) {
        wsClients.delete(client);
      }
    });

    // Kirim komentar keepalive ke semua klien SSE
    sseClients.forEach((res) => {
      try {
        res.write(`:keepalive ${Date.now()}\n\n`);
      } catch (e) {
        sseClients.delete(res);
      }
    });
  }, 25000);

  console.log('[REALTIME] Engine WebSocket & SSE Real-Time Berhasil Diinisialisasi di /ws/realtime');
}

// Pasang pendengar otomatis ke pembuatan notifikasi
onNotifCreated((newNotif) => {
  realtimeNotifyNew(newNotif);
});

/**
 * Broadcast event ke seluruh koneksi aktif (WebSocket & SSE) dengan zero delay & deduplikasi
 */
export function broadcastRealtimeEvent(event: { type: string; id?: string; timestamp?: string; [key: string]: any }) {
  const fullEvent: RealtimeEvent = {
    id: event.id || generateEventId(),
    timestamp: event.timestamp || new Date().toISOString(),
    type: event.type,
    ...event
  };

  // Simpan ke circular buffer
  recentEvents.unshift(fullEvent);
  if (recentEvents.length > MAX_BUFFER) recentEvents.pop();

  const serialized = JSON.stringify(fullEvent);

  // 1. Kirim via WebSocket
  wsClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(serialized);
      } catch (e) {
        wsClients.delete(client);
      }
    }
  });

  // 2. Kirim via SSE
  sseClients.forEach((res) => {
    try {
      res.write(`data: ${serialized}\n\n`);
    } catch (e) {
      sseClients.delete(res);
    }
  });
}

/**
 * Handler endpoint SSE untuk fallback browser
 */
export function handleSseConnection(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  // Kirim initial connection event
  const unreadCount = notifikasiStore.filter(n => !n.is_read && !n.is_archived).length;
  res.write(`data: ${JSON.stringify({
    id: generateEventId(),
    type: 'SSE_CONNECTED',
    timestamp: new Date().toISOString(),
    unread_notif: unreadCount
  })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

/**
 * Endpoint mengambil riwayat event terbaru (misal setelah tab aktif kembali)
 */
export function getRecentEventsHandler(_req: Request, res: Response) {
  res.json({
    status: 'success',
    total: recentEvents.length,
    events: recentEvents
  });
}

// ============================================================================
// HELPER BROADCAST SPESIFIK UNTUK NOTIFIKASI & PELAPORAN
// ============================================================================

export function realtimeNotifyNew(notif: any) {
  const unreadCount = notifikasiStore.filter(n => !n.is_read && !n.is_archived).length;
  broadcastRealtimeEvent({
    type: 'NOTIF_NEW',
    data: notif,
    unread: unreadCount,
    total_unread: unreadCount
  });
}

export function realtimeNotifyUpdate(action: string, id?: number) {
  const unreadCount = notifikasiStore.filter(n => !n.is_read && !n.is_archived).length;
  broadcastRealtimeEvent({
    type: 'NOTIF_UPDATE',
    action,
    item_id: id,
    unread: unreadCount,
    total_unread: unreadCount
  });
}

export function realtimeAduanNew(aduan: any) {
  broadcastRealtimeEvent({
    type: 'ADUAN_NEW',
    nik: aduan.nik,
    item_id: aduan.id,
    data: aduan,
    total_aduan: pengaduanStore.length
  });
}

export function realtimeAduanUpdate(aduan: any, statusType: string) {
  broadcastRealtimeEvent({
    type: 'ADUAN_UPDATE',
    status_type: statusType,
    nik: aduan.nik,
    item_id: aduan.id,
    data: aduan
  });
}

export function realtimeEskalasiSuperAdmin(aduan: any) {
  broadcastRealtimeEvent({
    type: 'ESKALASI_NEW',
    nik: aduan.nik,
    item_id: aduan.id,
    data: aduan
  });
}

export function realtimePutusanSuperAdmin(aduan: any) {
  broadcastRealtimeEvent({
    type: 'PUTUSAN_SUPERADMIN',
    nik: aduan.nik,
    item_id: aduan.id,
    data: aduan
  });
}

export function realtimeLaporanPelanggaranNew(report: any) {
  broadcastRealtimeEvent({
    type: 'LAPORAN_PELANGGARAN_NEW',
    item_id: report.id,
    data: report
  });
}

export function realtimeLaporanPelanggaranUpdate(report: any) {
  broadcastRealtimeEvent({
    type: 'LAPORAN_PELANGGARAN_UPDATE',
    item_id: report.id,
    data: report
  });
}

export function realtimeChatMessage(chat: any) {
  broadcastRealtimeEvent({
    type: 'CHAT_MESSAGE',
    nik: chat.nik,
    data: chat
  });
}

export function handleCallSignal(req: Request, res: Response) {
  const body = req.body || {};
  if (body.type) {
    broadcastRealtimeEvent(body);
  }
  res.json({ status: 'success' });
}
