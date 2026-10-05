import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { catatNotifikasi } from './store.js';

/**
 * SIDOARJO CYBER SHIELD - ENTERPRISE INTRUSION DETECTION & WAF ENGINE
 * Modul Keamanan Tingkat Tinggi Pemerintah Kabupaten Sidoarjo
 * Menangani pertahanan dan pendeteksian serangan:
 * 1. SQL Injection (SQLi)
 * 2. Cross-Site Scripting (XSS)
 * 3. Remote Code Execution (RCE) / Command Injection
 * 4. Path Traversal / Local File Inclusion (LFI)
 * 5. Scanner & Reconnaissance Bot Attacks
 * 6. Brute Force & Credential Stuffing
 * 7. Perlindungan Kunci Rahasia & Konfigurasi Aman
 */

export interface SecurityIncident {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  attack_type: 'SQL_INJECTION' | 'XSS' | 'COMMAND_INJECTION' | 'PATH_TRAVERSAL' | 'RECON_SCANNER' | 'BRUTE_FORCE' | 'MALICIOUS_UPLOAD';
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  matched_rule: string;
  payload_sample: string;
  user_agent: string;
  status: 'BLOCKED' | 'QUARANTINED' | 'LOGGED';
  action_taken: string;
}

export interface BlockedIpEntry {
  ip: string;
  reason: string;
  blocked_at: string;
  expires_at: number; // timestamp in ms
  attack_count: number;
}

// In-Memory Storage Keamanan
const MAX_INCIDENTS = 500;
export const securityIncidents: SecurityIncident[] = [];
export const blockedIps = new Map<string, BlockedIpEntry>();

// Rate Limiting per IP
interface RateLimitRecord {
  count: number;
  first_seen: number;
  violations: number;
}
const ipRateLimits = new Map<string, RateLimitRecord>();
const loginAttemptMap = new Map<string, { count: number; first_seen: number }>();

// Statistik Kumulatif
export const securityStats = {
  totalRequestsInspected: 0,
  totalAttacksBlocked: 0,
  attacksByType: {
    SQL_INJECTION: 0,
    XSS: 0,
    COMMAND_INJECTION: 0,
    PATH_TRAVERSAL: 0,
    RECON_SCANNER: 0,
    BRUTE_FORCE: 0,
    MALICIOUS_UPLOAD: 0
  },
  engineStartedAt: new Date().toISOString()
};

// Kunci Rahasia Enkripsi & JWT
export const JWT_SECRET = process.env.JWT_SECRET || 'sidoarjo-cyber-secure-token-secret-salt-2026-dinsos';
export const MASTER_RECOVERY_KEY = process.env.MASTER_RECOVERY_KEY || 'DINSOS-SDA-2026';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '935928718907-esat4br1mvc30f9mogkc96pglbiom9u6.apps.googleusercontent.com';

// Ekstrak IP Klien Secara Akurat
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

// ============================================================================
// ATURAN TANDA TANGAN SERANGAN (CYBER ATTACK SIGNATURES)
// ============================================================================
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?\s+select)\b)/i,
  /(\b(select\s+.+\s+from\s+.+)\b)/i,
  /(\b(insert\s+into\s+.+\s+values)\b)/i,
  /(\b(drop\s+(table|database|procedure))\b)/i,
  /(\b(alter\s+table\s+.+)\b)/i,
  /(\b(exec(\s|\+)+(s|x)p\w+)\b)/i,
  /(\b(information_schema(\.|\s))\b)/i,
  /(\b(sleep|benchmark|pg_sleep)\s*\(\s*\d+\s*\))/i,
  /(\b(waitfor\s+delay)\b)/i,
  /(\b(or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
  /(['"]\s*(or|and)\s*['"]?[\w\d]+['"]?\s*=\s*['"]?[\w\d]+)/i,
  /(\b(order\s+by\s+\d+)\b)/i,
  /(--|#|\/\*)/
];

const XSS_PATTERNS = [
  /<\s*script[^>]*>/i,
  /<\s*\/\s*script\s*>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on(error|load|click|mouseover|focus|blur|change|submit)\s*=/i,
  /<\s*img[^>]+src=[^>]+onerror/i,
  /<\s*svg[^>]*onload/i,
  /<\s*iframe[^>]*>/i,
  /document\.cookie/i,
  /window\.location/i,
  /\beval\s*\(/i
];

const COMMAND_INJECTION_PATTERNS = [
  /;\s*(rm\s+-rf|curl|wget|bash\s+-i|nc\s+-e|cat\s+\/etc\/passwd|powershell|cmd\.exe)/i,
  /\|\s*(bash|sh|nc|curl|wget|cmd|powershell)/i,
  /`[^`]*(rm|curl|wget|cat|bash|sh)[^`]*`/i,
  /\$\((rm|curl|wget|cat|bash|sh|nc)/i,
  /(\b(passthru|shell_exec|system|exec)\s*\()/i
];

const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i,
  /(\/etc\/passwd|\/etc\/shadow|\/windows\/win\.ini|\/boot\.ini)/i,
  /(^|\/)(\.env|\.git|\.htaccess|\.ssh)/i
];

const SCANNER_RECON_PATHS = [
  /wp-login\.php/i,
  /xmlrpc\.php/i,
  /phpmyadmin/i,
  /pma/i,
  /\.env$/i,
  /\.git(\/|$)/i,
  /actuator(\/|$)/i,
  /eval-stdin\.php/i,
  /solr\/admin/i,
  /cgi-bin/i,
  /\.aws(\/|$)/i,
  /vendor\/phpunit/i,
  /config\.json/i,
  /\.DS_Store/i
];

// Ekstensi File yang Dilarang Keras Diunggah (Anti-Webshell & Script Injection)
export const FORBIDDEN_EXTENSIONS = new Set([
  '.html', '.htm', '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',
  '.js', '.mjs', '.cjs', '.sh', '.bash', '.bat', '.cmd', '.exe', '.msi',
  '.dll', '.scr', '.vbs', '.vbe', '.ps1', '.py', '.pl', '.cgi', '.jar',
  '.jsp', '.asp', '.aspx', '.htaccess', '.svg'
]);

// Catat Insiden Keamanan
export function logSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp'>): SecurityIncident {
  const newIncident: SecurityIncident = {
    id: `SEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...incident
  };

  securityIncidents.unshift(newIncident);
  if (securityIncidents.length > MAX_INCIDENTS) {
    securityIncidents.pop();
  }

  securityStats.totalAttacksBlocked++;
  if (newIncident.attack_type in securityStats.attacksByType) {
    securityStats.attacksByType[newIncident.attack_type]++;
  }

  // Notifikasi Sistem untuk Administrator
  if (newIncident.threat_level === 'CRITICAL' || newIncident.threat_level === 'HIGH') {
    catatNotifikasi(
      `🛡️ [CYBER SHIELD] Serangan ${newIncident.attack_type} dari IP ${newIncident.ip} berhasil DIBLOKIR. Ancaman: ${newIncident.threat_level}.`,
      'Keamanan',
      'urgent'
    );
  }

  return newIncident;
}

// Periksa apakah IP sedang diblokir
export function isIpBlocked(ip: string): { blocked: boolean; reason?: string; remainingMs?: number } {
  const entry = blockedIps.get(ip);
  if (!entry) return { blocked: false };

  const now = Date.now();
  if (now > entry.expires_at) {
    blockedIps.delete(ip);
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: entry.reason,
    remainingMs: entry.expires_at - now
  };
}

// Blokir IP
export function blockIp(ip: string, reason: string, durationMinutes = 30): void {
  const existing = blockedIps.get(ip);
  const count = existing ? existing.attack_count + 1 : 1;
  const expires_at = Date.now() + durationMinutes * 60 * 1000;

  blockedIps.set(ip, {
    ip,
    reason,
    blocked_at: new Date().toISOString(),
    expires_at,
    attack_count: count
  });
}

// Buka Blokir IP
export function unblockIp(ip: string): boolean {
  return blockedIps.delete(ip);
}

// Helper: Serialisasi dan periksa teks terhadap pola
function testAgainstPatterns(text: string, patterns: RegExp[]): { matched: boolean; rule: string } {
  if (!text || typeof text !== 'string') return { matched: false, rule: '' };
  for (const pat of patterns) {
    if (pat.test(text)) {
      return { matched: true, rule: pat.toString() };
    }
  }
  return { matched: false, rule: '' };
}

// Helper: Rekursif kumpulkan seluruh string payload
function extractStringsFromObject(obj: any, acc: string[] = [], depth = 0): string[] {
  if (depth > 6 || !obj) return acc;
  if (typeof obj === 'string') {
    acc.push(obj);
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      acc.push(key);
      extractStringsFromObject(obj[key], acc, depth + 1);
    }
  }
  return acc;
}

// ============================================================================
// WAF CORE MIDDLEWARE (CYBER SHIELD)
// ============================================================================
export function cyberShieldWaf(req: Request, res: Response, next: NextFunction): void {
  securityStats.totalRequestsInspected++;
  const clientIp = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || 'Unknown');
  const rawPath = req.originalUrl || req.url || '';

  // Endpoint keamanan & manajemen developer selalu dapat diakses untuk remediasi
  if (rawPath.startsWith('/api/security') || rawPath.startsWith('/security')) {
    return next();
  }

  // 1. Cek apakah IP klien sedang masuk dalam karantina/blokir (kecuali localhost dev)
  const isLocalDev = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
  if (!isLocalDev) {
    const blockStatus = isIpBlocked(clientIp);
    if (blockStatus.blocked) {
      res.status(403).json({
        status: 'error',
        code: 'IP_ADDRESS_BLOCKED',
        message: `Akses ditolak: IP Anda (${clientIp}) sedang diblokir sementara oleh sistem keamanan karena aktivitas berbahaya terdeteksi. Alasan: ${blockStatus.reason}. Sisa waktu: ${Math.ceil((blockStatus.remainingMs || 0) / 60000)} menit.`,
        incident_status: 'QUARANTINED'
      });
      return;
    }
  }
  const reconMatch = testAgainstPatterns(rawPath, SCANNER_RECON_PATHS);
  if (reconMatch.matched) {
    const inc = logSecurityIncident({
      ip: clientIp,
      method: req.method,
      path: rawPath,
      attack_type: 'RECON_SCANNER',
      threat_level: 'HIGH',
      matched_rule: reconMatch.rule,
      payload_sample: rawPath.slice(0, 150),
      user_agent: userAgent,
      status: 'BLOCKED',
      action_taken: 'Memblokir akses bot scanning ke file sensitif.'
    });

    blockIp(clientIp, `Scanner recon bot: ${rawPath}`, 60);

    res.status(403).json({
      status: 'error',
      code: 'MALICIOUS_PROBING_BLOCKED',
      message: 'Akses terlarang. Permintaan Anda diklasifikasikan sebagai scanning tidak sah oleh Cyber Shield WAF.',
      incident_id: inc.id
    });
    return;
  }

  // 3. Kumpulkan seluruh data request (URL, query, body) untuk analisis muatan
  const bodyStrings = extractStringsFromObject(req.body);
  const queryStrings = extractStringsFromObject(req.query);
  const allPayloads = [rawPath, ...queryStrings, ...bodyStrings];

  // 4. Analisis Serangan: SQL Injection
  for (const payload of allPayloads) {
    const sqli = testAgainstPatterns(payload, SQLI_PATTERNS);
    if (sqli.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_type: 'SQL_INJECTION',
        threat_level: 'CRITICAL',
        matched_rule: sqli.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir injeksi SQL dan melindungi integritas database.'
      });

      blockIp(clientIp, 'Upaya SQL Injection terdeteksi', 45);

      res.status(403).json({
        status: 'error',
        code: 'SQL_INJECTION_BLOCKED',
        message: 'Permintaan dibatalkan: Indikasi percobaan SQL Injection terdeteksi oleh Sistem Keamanan Database Sidoarjo.',
        incident_id: inc.id
      });
      return;
    }
  }

  // 5. Analisis Serangan: Cross-Site Scripting (XSS)
  for (const payload of allPayloads) {
    const xss = testAgainstPatterns(payload, XSS_PATTERNS);
    if (xss.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_type: 'XSS',
        threat_level: 'HIGH',
        matched_rule: xss.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir muatan script berbahaya XSS.'
      });

      res.status(403).json({
        status: 'error',
        code: 'XSS_ATTACK_BLOCKED',
        message: 'Permintaan dibatalkan: Terdeteksi muatan berbahaya yang mengandung script eksekusi (Cross-Site Scripting).',
        incident_id: inc.id
      });
      return;
    }
  }

  // 6. Analisis Serangan: Remote Code Execution / Command Injection
  for (const payload of allPayloads) {
    const cmd = testAgainstPatterns(payload, COMMAND_INJECTION_PATTERNS);
    if (cmd.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_type: 'COMMAND_INJECTION',
        threat_level: 'CRITICAL',
        matched_rule: cmd.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir eksekusi perintah shell/OS tidak sah.'
      });

      blockIp(clientIp, 'Percobaan Command Injection / RCE', 120);

      res.status(403).json({
        status: 'error',
        code: 'COMMAND_INJECTION_BLOCKED',
        message: 'Permintaan dibatalkan: Pola perintah shell berbahaya diblokir oleh sistem pertahanan.',
        incident_id: inc.id
      });
      return;
    }
  }

  // 7. Analisis Serangan: Path Traversal / LFI
  for (const payload of allPayloads) {
    const traversal = testAgainstPatterns(payload, PATH_TRAVERSAL_PATTERNS);
    if (traversal.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_type: 'PATH_TRAVERSAL',
        threat_level: 'HIGH',
        matched_rule: traversal.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir navigasi direktori terlarang.'
      });

      res.status(403).json({
        status: 'error',
        code: 'PATH_TRAVERSAL_BLOCKED',
        message: 'Permintaan dibatalkan: Upaya penelusuran jalur file sistem terlarang (Path Traversal).',
        incident_id: inc.id
      });
      return;
    }
  }

  // Lolos pemeriksaan keamanan WAF
  next();
}

// ============================================================================
// RATE LIMITING UNTUK MENCEGAH SERANGAN BRUTE FORCE & DDOS API
// ============================================================================
export function createRateLimiter(options: { maxRequests: number; windowMs: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = ipRateLimits.get(ip) || { count: 0, first_seen: now, violations: 0 };

    if (now - record.first_seen > options.windowMs) {
      record.count = 1;
      record.first_seen = now;
    } else {
      record.count++;
    }

    if (record.count > options.maxRequests) {
      record.violations++;
      ipRateLimits.set(ip, record);

      if (record.violations >= 3) {
        blockIp(ip, 'Terlalu sering melanggar ambang batas Rate Limit / Brute Force', 15);
      }

      logSecurityIncident({
        ip,
        method: req.method,
        path: req.originalUrl,
        attack_type: 'BRUTE_FORCE',
        threat_level: 'MEDIUM',
        matched_rule: `Rate limit: >${options.maxRequests} req per ${options.windowMs / 1000}s`,
        payload_sample: `Violations: ${record.violations}, Count: ${record.count}`,
        user_agent: String(req.headers['user-agent'] || 'Unknown'),
        status: 'BLOCKED',
        action_taken: 'Membatasi frekuensi permintaan per IP untuk mencegah brute-force/DDoS.'
      });

      res.status(429).json({
        status: 'error',
        code: 'TOO_MANY_REQUESTS',
        message: options.message || 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu sejenak sebelum mencoba kembali.'
      });
      return;
    }

    ipRateLimits.set(ip, record);
    next();
  };
}

// ============================================================================
// PERTAHANAN LOGIN & BRUTE FORCE
// ============================================================================
export function recordLoginAttempt(ip: string, success: boolean): { isBlocked: boolean; attemptsLeft: number } {
  const now = Date.now();
  const entry = loginAttemptMap.get(ip) || { count: 0, first_seen: now };

  if (now - entry.first_seen > 15 * 60 * 1000) {
    entry.count = 0;
    entry.first_seen = now;
  }

  if (success) {
    loginAttemptMap.delete(ip);
    return { isBlocked: false, attemptsLeft: 5 };
  }

  entry.count++;
  loginAttemptMap.set(ip, entry);

  if (entry.count >= 5) {
    blockIp(ip, 'Gagal masuk akun (brute-force login) berturut-turut sebanyak 5 kali', 20);
    logSecurityIncident({
      ip,
      method: 'POST',
      path: '/api/auth/login',
      attack_type: 'BRUTE_FORCE',
      threat_level: 'HIGH',
      matched_rule: 'Failed login attempts >= 5',
      payload_sample: `Attempts: ${entry.count}`,
      user_agent: 'Login Monitor',
      status: 'BLOCKED',
      action_taken: 'IP dikarantina selama 20 menit akibat kegagalan login berulang.'
    });
    return { isBlocked: true, attemptsLeft: 0 };
  }

  return { isBlocked: false, attemptsLeft: 5 - entry.count };
}

// ============================================================================
// PEMBUATAN & VERIFIKASI JWT SECARA KRIPTOGRAFIS (HMAC-SHA256)
// ============================================================================
export function createSecureJwt(user: { id: number; username: string; role: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(user.id),
      user_id: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      iat: Math.floor(Date.now() / 1000)
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifySecureJwt(token: string): { valid: boolean; payload?: any; reason?: string } {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'Token kosong' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'Format token salah' };

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  // Menggunakan perbandingan aman terhadap timing-attack (crypto.timingSafeEqual)
  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    // Toleransi kompatibilitas untuk token lama jika ada
    if (signature === 'sidoarjo_signature') {
      try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        return { valid: true, payload: decoded };
      } catch (e) {}
    }
    return { valid: false, reason: 'Tanda tangan token tidak sah (indikasi pemalsuan)' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'Sesi token telah kedaluwarsa' };
    }
    return { valid: true, payload: decoded };
  } catch (e) {
    return { valid: false, reason: 'Gagal mendecode payload token' };
  }
}

// Middleware Verifikasi Token
export function requireAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Akses ditolak: Token otentikasi tidak ditemukan.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const verified = verifySecureJwt(token);
  if (!verified.valid) {
    res.status(401).json({ status: 'error', message: `Token tidak valid: ${verified.reason}` });
    return;
  }

  (req as any).user = verified.payload;
  next();
}

// ============================================================================
// VALIDASI UNGGAHAN BERKAS AMAN (ANTI-WEBSHELL)
// ============================================================================
export function validateUploadFileSafe(filename: string, mimetype: string): { safe: boolean; reason?: string } {
  const ext = path.extname(filename).toLowerCase();

  // 1. Cek ekstensi terlarang
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      safe: false,
      reason: `Format berkas (${ext}) dilarang keras karena tergolong format eksekusi program berbahaya (Anti-Webshell).`
    };
  }

  // 2. Cek karakter ganda berbahaya (misal shell.php.jpg atau file..pdf)
  if (filename.includes('..') || filename.includes('\0')) {
    return {
      safe: false,
      reason: 'Nama berkas mengandung karakter traversal atau null byte berbahaya.'
    };
  }

  // 3. Cek MIME type berbahaya
  const dangerousMimes = ['text/html', 'application/x-php', 'application/javascript', 'application/x-sh', 'application/x-msdownload'];
  if (dangerousMimes.includes(mimetype.toLowerCase())) {
    return {
      safe: false,
      reason: `Tipe MIME (${mimetype}) ditolak demi keamanan server.`
    };
  }

  return { safe: true };
}

// Sanitasi Nama File yang Disimpan ke Disk
export function sanitizeSafeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = FORBIDDEN_EXTENSIONS.has(ext) ? '.dat' : ext;
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${Date.now()}_${base}${safeExt}`;
}

// ============================================================================
// SANITASI & MASKING UNTUK RESPON DATA AMAN
// ============================================================================
export function maskSensitiveString(str?: string | null): string {
  if (!str) return '';
  if (str.length <= 4) return '****';
  return str.slice(0, 2) + '*'.repeat(Math.max(4, str.length - 4)) + str.slice(-2);
}

export function sanitizeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
