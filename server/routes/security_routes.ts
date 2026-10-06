import { Router, Request, Response } from 'express';
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
    security_shield_active: true,
    protected_categories: 6,
    version: '3.5.0-enterprise'
  });
});

// ============================================================================
// SEMUA ENDPOINT DI BAWAH INI WAJIB HANYA DAPAT DIAKSES OLEH SUPER ADMIN
// ============================================================================
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
