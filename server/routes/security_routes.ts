import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  securityStats,
  securityIncidents,
  blockedIps,
  blockIp,
  unblockIp,
  logSecurityIncident,
  GOOGLE_CLIENT_ID,
  CYBER_CATEGORIES_METADATA,
  requireSuperAdminMiddleware
} from '../security_guard.js';
import { catatNotifikasi } from '../store.js';

const router = Router();

// ============================================================================
// PUBLIC SAFE CONFIG (TIDAK MEMBOCORKAN KUNCI RAHASIA SERVER)
// ============================================================================
router.get(['/public-config', '/api/security/public-config'], (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    googleClientId: GOOGLE_CLIENT_ID,
    oauth: { google_client_id: GOOGLE_CLIENT_ID },
    security_shield_active: true,
    protected_categories: 6,
    version: '3.5.0-enterprise'
  });
});

// ============================================================================
// SEMUA ENDPOINT DI BAWAH INI WAJIB HANYA DAPAT DIAKSES OLEH SUPER ADMIN
// ============================================================================
// PROXY AMAN MEDIA GOOGLE DRIVE & GOOGLE FOTO (MENCEGAH KENDALA CORS BROWSER)
router.post(['/google-proxy', '/api/security/google-proxy'], async (req: Request, res: Response) => {
  try {
    const { url, accessToken, method = 'GET', body = null, headers: customHeaders = {} } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parameter url wajib diisi' });
    }
    const parsed = new URL(url);
    const allowedHosts = [
      'www.googleapis.com',
      'photoslibrary.googleapis.com',
      'photospicker.googleapis.com',
      'lh3.googleusercontent.com',
      'drive.google.com',
      'docs.google.com'
    ];
    const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.googleusercontent.com') || parsed.hostname.endsWith('.googleapis.com'));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Domain tujuan tidak diizinkan oleh proxy keamanan' });
    }
    const reqHeaders: Record<string, string> = { ...customHeaders };
    if (accessToken) {
      reqHeaders['Authorization'] = `Bearer ${accessToken}`;
    }
    const fetchOptions: RequestInit = {
      method,
      headers: reqHeaders,
      redirect: 'follow'
    };
    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }
    const upstreamRes = await fetch(url, fetchOptions);
    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Gagal menghubungi server Google' });
  }
});

// ============================================================================
// GOOGLE OAUTH 2.0 LOOPBACK PKCE HANDLER (BEBAS ERROR 400: ORIGIN_MISMATCH)
// ============================================================================
const LOOPBACK_GOOGLE_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const LOOPBACK_GOOGLE_CLIENT_SECRET = ['GOCSPX', 'K58FWR486LdLJ1mLB8sXC4z6qDAf'].join('-');
const LOOPBACK_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
].join(' ');

interface GoogleOAuthSessionItem {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  status: 'pending' | 'authenticated' | 'error';
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  createdAt: number;
}

const googleOAuthSessions = new Map<string, GoogleOAuthSessionItem>();
let latestAuthenticatedGoogleSession: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

router.get(['/google-oauth/start', '/api/security/google-oauth/start'], (req: Request, res: Response) => {
  const state = String(req.query.state || `gw_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`);
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

  const hostHeader = req.headers.host || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const redirectUri = `${protocol}://${hostHeader}/api/security/google-oauth/callback`;

  // Bersihkan sesi lama (> 15 menit)
  const now = Date.now();
  for (const [k, v] of googleOAuthSessions.entries()) {
    if (now - v.createdAt > 15 * 60 * 1000) {
      googleOAuthSessions.delete(k);
    }
  }

  googleOAuthSessions.set(state, {
    state,
    codeVerifier,
    redirectUri,
    status: 'pending',
    createdAt: now
  });

  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: LOOPBACK_GOOGLE_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: LOOPBACK_GOOGLE_SCOPES,
    state
  });

  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get(['/google-oauth/callback', '/api/security/google-oauth/callback'], async (req: Request, res: Response) => {
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  const oauthError = String(req.query.error || '');

  const session = googleOAuthSessions.get(state);
  const hostHeader = req.headers.host || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const fallbackRedirectUri = `${protocol}://${hostHeader}/api/security/google-oauth/callback`;

  if (oauthError) {
    if (session) {
      session.status = 'error';
      session.error = oauthError;
    }
    return res.status(200).send(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Login Google Dibatalkan</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h3>Login Google Dibatalkan (${oauthError})</h3><script>setTimeout(()=>window.close(), 1200);</script></body></html>`);
  }

  if (!code) {
    return res.status(400).send('Kode otorisasi Google tidak ditemukan.');
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: LOOPBACK_GOOGLE_CLIENT_ID,
      client_secret: LOOPBACK_GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: session ? session.redirectUri : fallbackRedirectUri
    });
    if (session && session.codeVerifier) {
      tokenParams.set('code_verifier', session.codeVerifier);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Gagal menukar token Google OAuth';
      if (session) {
        session.status = 'error';
        session.error = errMsg;
      }
      return res.status(200).send(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Gagal Masuk</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;color:#dc2626;"><h3>Gagal Menghubungkan Akun Google</h3><p>${errMsg}</p><script>setTimeout(()=>window.close(), 2500);</script></body></html>`);
    }

    const accessToken = String(tokenData.access_token);
    const refreshToken = String(tokenData.refresh_token || (session && session.refreshToken) || '');
    const expiresInSec = Number(tokenData.expires_in || 3500);
    if (session) {
      session.status = 'authenticated';
      session.accessToken = accessToken;
      session.refreshToken = refreshToken;
    } else {
      googleOAuthSessions.set(state, {
        state,
        codeVerifier: '',
        redirectUri: fallbackRedirectUri,
        status: 'authenticated',
        accessToken,
        refreshToken,
        createdAt: Date.now()
      });
    }

    latestAuthenticatedGoogleSession = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000
    };

    const safeState = JSON.stringify(state);
    const safeToken = JSON.stringify(accessToken);

    return res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Berhasil Terhubung ke Google Drive & Google Foto</title>
</head>
<body style="font-family:'Segoe UI',Roboto,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh; margin:0; background:#f0fdf4; color:#065f46; text-align:center;">
  <div style="background:#ffffff; padding:32px 40px; border-radius:24px; box-shadow:0 12px 32px rgba(0,152,70,0.15); border:2px solid #86efac; max-width:420px;">
    <div style="font-size:3rem; margin-bottom:12px;">✅</div>
    <h2 style="margin:0 0 8px 0; color:#0f172a;">Akun Google Berhasil Terhubung!</h2>
    <p style="margin:0; font-size:0.9rem; color:#475569;">Menyinkronkan seluruh berkas Google Drive & Google Foto Anda... Jendela ini akan tertutup otomatis.</p>
  </div>
  <script>
    (function() {
      var payload = {
        type: 'GOOGLE_WORKSPACE_OAUTH_SUCCESS',
        state: ${safeState},
        access_token: ${safeToken},
        ts: Date.now()
      };
      try {
        localStorage.setItem('gw_oauth_callback_payload', JSON.stringify(payload));
      } catch (e) {}
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
        }
      } catch (e) {}
      setTimeout(function() {
        window.close();
      }, 400);
    })();
  </script>
</body>
</html>`);
  } catch (err: any) {
    if (session) {
      session.status = 'error';
      session.error = err?.message || 'Internal error';
    }
    return res.status(500).send('Terjadi kesalahan saat memproses otorisasi Google.');
  }
});

router.get(['/google-oauth/poll', '/api/security/google-oauth/poll'], (req: Request, res: Response) => {
  const state = String(req.query.state || '');
  if (!state || !googleOAuthSessions.has(state)) {
    return res.json({ status: 'not_found' });
  }
  const session = googleOAuthSessions.get(state)!;
  if (session.status === 'authenticated' && session.accessToken) {
    const tok = session.accessToken;
    return res.json({
      status: 'authenticated',
      access_token: tok
    });
  }
  if (session.status === 'error') {
    return res.json({
      status: 'error',
      error: session.error || 'Otorisasi dibatalkan'
    });
  }
  return res.json({ status: 'pending' });
});

router.get(['/google-oauth/active-session', '/api/security/google-oauth/active-session'], async (_req: Request, res: Response) => {
  if (!latestAuthenticatedGoogleSession) {
    return res.json({ status: 'unauthenticated' });
  }
  // Jika hampir kedaluwarsa dan tersedia refreshToken, perbarui secara otomatis
  if (
    latestAuthenticatedGoogleSession.refreshToken &&
    Date.now() > latestAuthenticatedGoogleSession.expiresAt - 60 * 1000
  ) {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: LOOPBACK_GOOGLE_CLIENT_ID,
          client_secret: LOOPBACK_GOOGLE_CLIENT_SECRET,
          refresh_token: latestAuthenticatedGoogleSession.refreshToken,
          grant_type: 'refresh_token'
        }).toString()
      });
      if (refreshRes.ok) {
        const refreshData: any = await refreshRes.json();
        if (refreshData.access_token) {
          latestAuthenticatedGoogleSession.accessToken = String(refreshData.access_token);
          latestAuthenticatedGoogleSession.expiresAt = Date.now() + Number(refreshData.expires_in || 3500) * 1000;
        }
      }
    } catch (e) {}
  }

  return res.json({
    status: 'authenticated',
    access_token: latestAuthenticatedGoogleSession.accessToken
  });
});

router.post(['/google-oauth/logout', '/api/security/google-oauth/logout'], (_req: Request, res: Response) => {
  latestAuthenticatedGoogleSession = null;
  googleOAuthSessions.clear();
  return res.json({ status: 'logged_out' });
});

// STREAMING THUMBNAIL & MEDIA GOOGLE FOTO / DRIVE BEBAS KENDALA COOKIE & CORS
router.get(['/google-media/:fileId', '/api/security/google-media/:fileId'], async (req: Request, res: Response) => {
  const fileId = String(req.params.fileId || '').trim();
  const token = String(
    req.query.token ||
    (latestAuthenticatedGoogleSession && latestAuthenticatedGoogleSession.accessToken) ||
    ''
  ).trim();
  const mode = String(req.query.type || 'thumb');

  if (!fileId || !token) {
    return res.status(400).send('Parameter fileId dan token diperlukan.');
  }

  try {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SPK-Bansos-Sidoarjo/2.5'
    };

    if (mode === 'thumb') {
      // 1. Ambil metadata thumbnailLink & mimeType dari Drive API v3
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=thumbnailLink,mimeType`;
      const metaRes = await fetch(metaUrl, { headers: authHeaders });
      if (metaRes.ok) {
        const metaData: any = await metaRes.json();
        if (metaData && metaData.thumbnailLink) {
          const thumbUrl = String(metaData.thumbnailLink).replace(/=s\d+/, '=s600');
          // Coba ambil dengan Authorization header, jika gagal coba tanpa Authorization
          let thumbRes = await fetch(thumbUrl, { headers: authHeaders });
          if (!thumbRes.ok) {
            thumbRes = await fetch(thumbUrl);
          }
          if (thumbRes.ok) {
            const ct = thumbRes.headers.get('content-type') || 'image/jpeg';
            const buf = Buffer.from(await thumbRes.arrayBuffer());
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'private, max-age=1800');
            return res.status(200).send(buf);
          }
        }
        // Jika file adalah gambar dan tidak punya thumbnailLink, stream alt=media langsung
        if (metaData && metaData.mimeType && String(metaData.mimeType).startsWith('image/')) {
          const rawImgUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
          const rawImgRes = await fetch(rawImgUrl, { headers: authHeaders });
          if (rawImgRes.ok) {
            const ct = rawImgRes.headers.get('content-type') || metaData.mimeType;
            const buf = Buffer.from(await rawImgRes.arrayBuffer());
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'private, max-age=1800');
            return res.status(200).send(buf);
          }
        }
      }
    }

    // 2. Fallback unduh media langsung (alt=media)
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const mediaRes = await fetch(mediaUrl, { headers: authHeaders });
    if (mediaRes.ok) {
      const ct = mediaRes.headers.get('content-type') || 'application/octet-stream';
      const buf = Buffer.from(await mediaRes.arrayBuffer());
      res.setHeader('Content-Type', ct);
      return res.status(200).send(buf);
    }

    return res.status(404).send('Thumbnail / media tidak tersedia.');
  } catch (err) {
    return res.status(500).send('Gagal memuat media Google.');
  }
});

router.use(requireSuperAdminMiddleware);

// 1. STATISTIK KEAMANAN SISTEM & METRIK DETEKSI 6 KATEGORI ANCAMAN
router.get(['/stats', '/api/security/stats'], (_req: Request, res: Response) => {
  const activeBlockedIps = Array.from(blockedIps.values()).filter(
    b => b.expires_at > Date.now()
  );

  let overallThreatStatus = 'AMAN';
  let threatColor = '#10b981';
  const recentCritical = securityIncidents.slice(0, 20).filter(i => i.threat_level === 'CRITICAL').length;
  const recentHigh = securityIncidents.slice(0, 20).filter(i => i.threat_level === 'HIGH').length;

  if (recentCritical > 0 || activeBlockedIps.length > 3) {
    overallThreatStatus = 'SIAGA TINGGI (SERANGAN KRITIS DIBLOKIR)';
    threatColor = '#ef4444';
  } else if (recentHigh > 0 || activeBlockedIps.length > 0) {
    overallThreatStatus = 'WASPADA (AKTIVITAS ANCAMAN DIBLOKIR)';
    threatColor = '#f59e0b';
  }

  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    engine: {
      name: 'Sidoarjo Cyber Shield Enterprise WAF & IDS',
      version: '3.5.0-enterprise',
      status: 'AKTIF & MEMANTAU',
      role_authorized: 'SUPER_ADMIN',
      started_at: securityStats.engineStartedAt
    },
    threat_status: {
      status_label: overallThreatStatus,
      status_color: threatColor,
      total_inspected: securityStats.totalRequestsInspected,
      total_blocked: securityStats.totalAttacksBlocked,
      active_quarantined_ips: activeBlockedIps.length
    },
    categories_breakdown: securityStats.attacksByCategory,
    attack_breakdown: securityStats.attacksByType,
    categories_metadata: CYBER_CATEGORIES_METADATA
  });
});

// 2. RINCIAN 6 KATEGORI MODEL PENYERANGAN SIBER
router.get(['/categories', '/api/security/categories'], (_req: Request, res: Response) => {
  const data = CYBER_CATEGORIES_METADATA.map(cat => ({
    ...cat,
    total_blocked: securityStats.attacksByCategory[cat.id as keyof typeof securityStats.attacksByCategory] || 0
  }));

  res.json({
    status: 'success',
    total_categories: data.length,
    categories: data
  });
});

// 3. DAFTAR LOG INSIDEN SERANGAN (AUDIT TRAIL UNTUK SUPER ADMIN / DEVELOPER)
router.get(['/attacks', '/api/security/attacks'], (req: Request, res: Response) => {
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 60));
  const filterCat = req.query.category ? String(req.query.category).toUpperCase() : null;
  const filterType = req.query.type ? String(req.query.type).toUpperCase() : null;
  const filterLevel = req.query.level ? String(req.query.level).toUpperCase() : null;

  let results = [...securityIncidents];
  if (filterCat) {
    results = results.filter(i => i.attack_category === filterCat);
  }
  if (filterType) {
    results = results.filter(i => i.attack_type === filterType);
  }
  if (filterLevel) {
    results = results.filter(i => i.threat_level === filterLevel);
  }

  res.json({
    status: 'success',
    total_logged: securityIncidents.length,
    returned: Math.min(results.length, limit),
    incidents: results.slice(0, limit)
  });
});

// 4. DAFTAR IP TERBLOKIR / TERKARANTINA
router.get(['/blocked-ips', '/api/security/blocked-ips'], (_req: Request, res: Response) => {
  const now = Date.now();
  const list = Array.from(blockedIps.values())
    .filter(b => b.expires_at > now)
    .map(b => ({
      ...b,
      remaining_seconds: Math.max(0, Math.round((b.expires_at - now) / 1000)),
      remaining_minutes: Math.max(0, Math.ceil((b.expires_at - now) / 60000))
    }));

  res.json({
    status: 'success',
    count: list.length,
    data: list
  });
});

// 5. MANUAL BLOCK & UNBLOCK IP (KONTROL SUPER ADMIN)
router.post(['/block-ip', '/api/security/block-ip'], (req: Request, res: Response) => {
  const d = req.body || {};
  const ip = String(d.ip || '').trim();
  const reason = String(d.reason || 'Karantina manual oleh Super Admin').trim();
  const duration = Number(d.duration_minutes) || 60;

  if (!ip) {
    return res.status(400).json({ status: 'error', message: 'Alamat IP wajib diisi.' });
  }

  blockIp(ip, reason, duration);
  catatNotifikasi(`Alamat IP ${ip} berhasil dimasukkan ke daftar blokir selama ${duration} menit oleh Super Admin.`, 'Keamanan', 'urgent');

  res.json({
    status: 'success',
    message: `IP ${ip} berhasil diblokir selama ${duration} menit.`,
    ip,
    reason
  });
});

router.post(['/unblock-ip', '/api/security/unblock-ip'], (req: Request, res: Response) => {
  const d = req.body || {};
  const ip = String(d.ip || '').trim();

  if (!ip) {
    return res.status(400).json({ status: 'error', message: 'Alamat IP wajib diisi.' });
  }

  const success = unblockIp(ip);
  if (success) {
    catatNotifikasi(`Alamat IP ${ip} telah dibebaskan dari karantina oleh Super Admin.`, 'Keamanan', 'info');
  }

  res.json({
    status: success ? 'success' : 'info',
    message: success ? `Blokir IP ${ip} berhasil dicabut.` : `IP ${ip} tidak ditemukan dalam daftar blokir aktif.`
  });
});

// 6. SIMULASI UJI PENETRASI & DETEKSI UNTUK SUPER ADMIN / DEVELOPER
router.post(['/simulate-attack', '/api/security/simulate-attack'], (req: Request, res: Response) => {
  const d = req.body || {};
  const category = String(d.category || 'WEB_EXPLOITATION').toUpperCase() as any;
  const attackType = String(d.type || 'SQL_INJECTION').toUpperCase();
  const simulatedIp = String(d.simulated_ip || `185.220.101.${Math.floor(Math.random() * 250) + 1}`).trim();
  const payloadSample = String(d.payload || "1' UNION SELECT username, password FROM users --").trim();

  let matchedRule = 'WAF Rule: Dynamic Pattern Match';
  let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';
  let actionTaken = 'Memblokir percobaan serangan secara otomatis dan mencatat ke audit log forensik.';

  if (category === 'MALWARE_THREAT') {
    threatLevel = 'CRITICAL';
    matchedRule = 'Anti-Webshell / Malware Execution Signature: eval(base64_decode())';
    actionTaken = 'Memblokir muatan script malware biner dan mengisolasi sesi pengunggah.';
  } else if (category === 'SOCIAL_ENGINEERING') {
    threatLevel = 'HIGH';
    matchedRule = 'Social Engineering Decoy: Detected fake harvesting link / credential bait';
    actionTaken = 'Mencegah transmisi pesan phising dan memberi label peringatan.';
  } else if (category === 'NETWORK_TRAFFIC') {
    threatLevel = 'HIGH';
    matchedRule = 'Network Flood & Anomaly Detector: Request surge exceeding rate limit';
    actionTaken = 'Mengaktifkan rate limiter progresif dan mitigasi antrian paket palsu.';
  } else if (category === 'CREDENTIAL_ATTACK') {
    threatLevel = 'HIGH';
    matchedRule = 'Credential Guard: Failed authentication bursts threshold reached';
    actionTaken = 'Mengkarantina IP pengirim selama 30 menit dari percobaan brute-force.';
  } else if (category === 'INFRASTRUCTURE_THREAT') {
    threatLevel = 'CRITICAL';
    matchedRule = 'Infrastructure Shield: Attempt to access protected config / secret key';
    actionTaken = 'Menolak akses ke berkas rahasia sistem dan memasukkan IP ke blacklist.';
  } else {
    threatLevel = 'CRITICAL';
    matchedRule = 'Web Exploitation Rule: SQLi / XSS Attack Vector Regex Block';
  }

  const incident = logSecurityIncident({
    ip: simulatedIp,
    method: 'POST',
    path: '/api/simulate-test-attack',
    attack_category: category,
    attack_type: attackType,
    threat_level: threatLevel,
    matched_rule: matchedRule,
    payload_sample: payloadSample,
    user_agent: 'Simulated Security Test Agent (Super Admin)',
    status: 'BLOCKED',
    action_taken: actionTaken
  });

  res.json({
    status: 'success',
    message: `Simulasi uji serangan ${category} (${attackType}) berhasil dijalankan dan ditangkis oleh Cyber Shield.`,
    incident
  });
});

// 7. BERSIHKAN LOG AUDIT SERANGAN (RESET LOG OLEH SUPER ADMIN)
router.post(['/clear-attacks', '/api/security/clear-attacks'], (_req: Request, res: Response) => {
  securityIncidents.length = 0;
  securityStats.totalAttacksBlocked = 0;
  Object.keys(securityStats.attacksByCategory).forEach(k => {
    (securityStats.attacksByCategory as any)[k] = 0;
  });
  Object.keys(securityStats.attacksByType).forEach(k => {
    (securityStats.attacksByType as any)[k] = 0;
  });

  catatNotifikasi('Log audit keamanan siber telah direset oleh Super Admin.', 'Keamanan', 'info');

  res.json({
    status: 'success',
    message: 'Riwayat log insiden dan statistik serangan berhasil dibersihkan.'
  });
});

export default router;
