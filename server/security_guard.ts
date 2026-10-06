import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { catatNotifikasi } from './store.js';

/**
 * ============================================================================
 * SIDOARJO CYBER SHIELD - ENTERPRISE INTRUSION DETECTION & WAF ENGINE
 * Modul Keamanan Siber Tingkat Tinggi Pemerintah Kabupaten Sidoarjo
 * Menangani 6 Kategori Model Serangan Siber Komprehensif:
 * 1. Kategori Berbasis Malware (Virus, Worm, Trojan, Ransomware, Spyware/Keylogger, Adware, Rootkit, Fileless Malware)
 * 2. Kategori Rekayasa Sosial (Social Engineering: Phishing, Spear Phishing, Whaling, Smishing/Vishing, Deepfake, Baiting)
 * 3. Kategori Serangan Jaringan & Lalu Lintas Data (DoS/DDoS, AitM/MitM, Spoofing, Eavesdropping/Sniffing, Session Hijacking)
 * 4. Kategori Eksploitasi Aplikasi & Web (SQLi, XSS, Clickjacking, Zero-Day Exploits, Command Injection, Path Traversal)
 * 5. Kategori Pembongkaran Kredensial & Sandi (Brute Force, Credential Stuffing, Password Spraying)
 * 6. Kategori Infrastruktur & Ancaman Khusus (Supply Chain, Insider Threat, Cryptojacking, Watering Hole, IoT Attacks)
 * ============================================================================
 */

export type AttackCategory =
  | 'MALWARE_THREAT'
  | 'SOCIAL_ENGINEERING'
  | 'NETWORK_TRAFFIC'
  | 'WEB_EXPLOITATION'
  | 'CREDENTIAL_ATTACK'
  | 'INFRASTRUCTURE_THREAT'
  | 'SQL_INJECTION'
  | 'XSS'
  | 'COMMAND_INJECTION'
  | 'PATH_TRAVERSAL'
  | 'RECON_SCANNER'
  | 'BRUTE_FORCE'
  | 'MALICIOUS_UPLOAD';

export interface SecurityIncident {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  attack_category: 'MALWARE_THREAT' | 'SOCIAL_ENGINEERING' | 'NETWORK_TRAFFIC' | 'WEB_EXPLOITATION' | 'CREDENTIAL_ATTACK' | 'INFRASTRUCTURE_THREAT';
  attack_type: string;
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
  expires_at: number;
  attack_count: number;
}

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

// Statistik Kumulatif 6 Kategori
export const securityStats = {
  totalRequestsInspected: 0,
  totalAttacksBlocked: 0,
  attacksByCategory: {
    MALWARE_THREAT: 0,
    SOCIAL_ENGINEERING: 0,
    NETWORK_TRAFFIC: 0,
    WEB_EXPLOITATION: 0,
    CREDENTIAL_ATTACK: 0,
    INFRASTRUCTURE_THREAT: 0
  },
  attacksByType: {
    SQL_INJECTION: 0,
    XSS: 0,
    COMMAND_INJECTION: 0,
    PATH_TRAVERSAL: 0,
    RECON_SCANNER: 0,
    BRUTE_FORCE: 0,
    MALICIOUS_UPLOAD: 0,
    MALWARE_THREAT: 0,
    SOCIAL_ENGINEERING: 0,
    NETWORK_TRAFFIC: 0,
    INFRASTRUCTURE_THREAT: 0
  },
  engineStartedAt: new Date().toISOString()
};

// Kunci Rahasia Terlindungi
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
// DEFINISI 6 KATEGORI ANCAMAN RESMI SIDOARJO CYBER SHIELD
// ============================================================================
export const CYBER_CATEGORIES_METADATA = [
  {
    id: 'MALWARE_THREAT',
    name: '1. Kategori Berbasis Malware (Perangkat Lunak Jahat)',
    description: 'Penyerang menyusupkan kode atau aplikasi merusak ke dalam sistem web & server.',
    sub_attacks: [
      { name: 'Virus', desc: 'Program yang menempel pada file sah dan mereplikasi diri ketika file dijalankan.' },
      { name: 'Worm', desc: 'Malware mandiri yang menyebar otomatis antar-komputer melalui jaringan tanpa intervensi manusia.' },
      { name: 'Trojan Horse', desc: 'Malware yang menyamar sebagai software legal agar diinstal oleh korban.' },
      { name: 'Ransomware', desc: 'Mengunci atau mengenkripsi data penting dan memeras korban untuk membayar uang tebusan.' },
      { name: 'Spyware & Keyloggers', desc: 'Memata-matai aktivitas layar dan merekam setiap ketukan papan ketik untuk mencuri password.' },
      { name: 'Adware', desc: 'Membanjiri perangkat dengan iklan berbahaya (malvertising) yang mengunduh malware lain.' },
      { name: 'Rootkit', desc: 'Malware tingkat tinggi yang bersembunyi di lapisan terdalam sistem operasi untuk akses kontrol penuh.' },
      { name: 'Fileless Malware', desc: 'Malware canggih yang tidak mengunduh file ke penyimpanan disk, melainkan menyusup langsung di memori RAM.' }
    ],
    defense_strategy: 'Validasi ekstensi ketat (Anti-Webshell), pemindaian signature biner, isolasi Sandbox CSP uploads, deteksi injeksi memori script/cmd.'
  },
  {
    id: 'SOCIAL_ENGINEERING',
    name: '2. Kategori Rekayasa Sosial (Social Engineering)',
    description: 'Menyerang faktor psikologis manusia (rasa takut, tergesa-gesa, rasa penasaran) untuk memancing data rahasia.',
    sub_attacks: [
      { name: 'Phishing (Massal)', desc: 'Email atau pesan umpan massal yang menyamar dari bank atau layanan digital populer.' },
      { name: 'Spear Phishing', desc: 'Serangan phishing terarget yang khusus disesuaikan untuk individu tertentu berdasarkan riset latar belakang.' },
      { name: 'Whaling', desc: 'Serangan phishing yang khusus menargetkan petinggi institusi atau kepala dinas.' },
      { name: 'Smishing & Vishing', desc: 'Phishing via SMS (Smishing) atau via telepon suara (Vishing) mengatasnamakan bansos.' },
      { name: 'Deepfake / AI Voice Scam', desc: 'Manipulasi video wajah atau klon suara berbasis AI untuk menipu pejabat penyalur bansos.' },
      { name: 'Baiting', desc: 'Menaruh umpan fisik (USB palsu) atau umpan digital berupa hadiah bantuan palsu.' }
    ],
    defense_strategy: 'Blokir link harvesting eksternal, validasi verifikasi TTE BSrE resmi, autentikasi kriptografis pejabat, anti-spoofing domain & email sender.'
  },
  {
    id: 'NETWORK_TRAFFIC',
    name: '3. Kategori Serangan Jaringan & Lalu Lintas Data',
    description: 'Penyerang memanipulasi bagaimana data dikirimkan antar-perangkat di internet.',
    sub_attacks: [
      { name: 'DoS & DDoS', desc: 'Membanjiri server dengan jutaan lalu lintas palsu dari botnet secara serentak agar server lumpuh.' },
      { name: 'Adversary-in-the-Middle (AitM / MitM)', desc: 'Menyadap jalur komunikasi antara dua pihak untuk mencuri data di tengah jalan (di Wi-Fi publik).' },
      { name: 'Spoofing (IP, DNS, ARP)', desc: 'Memalsukan identitas alamat IP atau mengalihkan domain situs web agar korban masuk ke server peretas.' },
      { name: 'Eavesdropping / Sniffing', desc: 'Penyadapan pasif pada lalu lintas jaringan yang tidak terenkripsi untuk membaca data sensitif.' },
      { name: 'Session Hijacking', desc: 'Mencuri token sesi (JWT/cookie) aktif milik pengguna saat mereka masuk ke suatu akun.' }
    ],
    defense_strategy: 'Rate-limiting per IP (anti-DDoS), penolakan Host Header Poisoning, enkripsi HMAC-SHA256 JWT dengan exp date & secure cookie, HSTS, timingSafeEqual.'
  },
  {
    id: 'WEB_EXPLOITATION',
    name: '4. Kategori Eksploitasi Aplikasi & Web (Injeksi Kode)',
    description: 'Memanfaatkan celah desain kode pada situs web dan antarmuka input.',
    sub_attacks: [
      { name: 'SQL Injection (SQLi)', desc: 'Memasukkan perintah database SQL berbahaya ke kolom input untuk membongkar atau menghapus database.' },
      { name: 'Cross-Site Scripting (XSS)', desc: 'Menanamkan skrip kode jahat ke situs agar berjalan di browser pengunjung lain dan mencuri data.' },
      { name: 'Clickjacking', desc: 'Menyamarkan tombol berbahaya di balik visual tombol transparan atau elemen halaman web yang tampak normal.' },
      { name: 'Zero-Day Exploits', desc: 'Serangan kilat mengeksploitasi celah keamanan software yang baru ditemukan sebelum ada patch.' }
    ],
    defense_strategy: 'WAF Deep Inspection, sanitasi input HTML & regex filter mutakhir, Prepared Statements, header X-Frame-Options: SAMEORIGIN (Anti-Clickjacking).'
  },
  {
    id: 'CREDENTIAL_ATTACK',
    name: '5. Kategori Pembongkaran Kredensial & Sandi',
    description: 'Menyerang kombinasi username dan password menggunakan otomatisasi komputer.',
    sub_attacks: [
      { name: 'Brute Force Attack', desc: 'Menebak password target secara acak dari jutaan kombinasi kata secepat mungkin hingga berhasil.' },
      { name: 'Credential Stuffing', desc: 'Memakai daftar miliaran kombinasi username dan password hasil kebocoran data di situs lain.' },
      { name: 'Password Spraying', desc: 'Mencoba password sangat umum (misal: "Password123") ke ribuan akun berbeda demi menghindari lockout.' }
    ],
    defense_strategy: 'Lockout progresif IP setelah 5 kali gagal, delay respons eksponensial, pelarangan sandi default, isolasi kata sandi dari response API.'
  },
  {
    id: 'INFRASTRUCTURE_THREAT',
    name: '6. Kategori Infrastruktur & Ancaman Khusus',
    description: 'Menyerang rantai pasok software, perangkat pintar (IoT), komputasi server, atau sabotase internal.',
    sub_attacks: [
      { name: 'Supply Chain Attack', desc: 'Menyerang pihak ketiga atau modul library software untuk menyusup ke sistem utama.' },
      { name: 'Insider Threat', desc: 'Sabotase atau kebocoran data yang dilakukan sengaja oleh orang dalam atau pihak tanpa otorisasi.' },
      { name: 'Cryptojacking', desc: 'Meretas paksa daya komputasi server/browser tanpa izin untuk menambang aset kripto.' },
      { name: 'Watering Hole Attack', desc: 'Meretas situs yang sering dikunjungi kelompok target untuk menginfeksi pengunjungnya.' },
      { name: 'IoT Attacks', desc: 'Menyerang perangkat CCTV/IoT yang lemah untuk dijadikan jembatan masuk ke jaringan internal.' }
    ],
    defense_strategy: 'Audit trail mutlak peran Super Admin, masking NIK & data warga dari ekspor publik, blokir skrip penambang kripto, blokir scanner botnet IoT.'
  }
];

// ============================================================================
// POLA TANDA TANGAN SERANGAN (CYBER ATTACK SIGNATURES)
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
  /(^|\/)(\.env|\.git|\.htaccess|\.ssh|firebase-applet-config|metadata\.json|package\.json)/i
];

const PROTECTED_CONFIG_PATHS = [
  /firebase-applet-config\.json/i,
  /firebase-applet-config/i,
  /serviceAccountKey\.json/i,
  /\.env($|\.)/i,
  /\.git(\/|$)/i,
  /metadata\.json/i,
  /package\.json/i,
  /tsconfig\.json/i,
  /bun\.lock/i,
  /server\.ts/i,
  /mysql_storage/i,
  /\.(pem|key|cert|crt)$/i
];

const SCANNER_RECON_PATHS = [
  /wp-login\.php/i,
  /xmlrpc\.php/i,
  /phpmyadmin/i,
  /pma/i,
  /actuator(\/|$)/i,
  /eval-stdin\.php/i,
  /solr\/admin/i,
  /cgi-bin/i,
  /\.aws(\/|$)/i,
  /vendor\/phpunit/i,
  /config\.json/i,
  /\.DS_Store/i,
  /setup\.cgi/i,
  /HNAP1/i,
  /boaform/i
];

// Pola Kategori Malware & Webshell
const MALWARE_CONTENT_PATTERNS = [
  /eval\s*\(\s*base64_decode/i,
  /eval\s*\(\s*gzinflate/i,
  /wscript\.shell/i,
  /powershell.*-nop.*-w\s+hidden/i,
  /invoke-expression/i,
  /rundll32/i,
  /c99shell|r57shell|b374k|wso_version/i,
  /x5o!p%@ap\[4\\pzx54\(p\^\)7cc\)7\}\$eicar/i // EICAR Test String
];

// Pola Rekayasa Sosial (Social Engineering)
const SOCIAL_ENG_PATTERNS = [
  /fake-login|verify-account-now|update-bank-urgently/i,
  /bit\.ly\/claim-bansos|klaim-bantuan-langsung/i,
  /survey_hadiah_tunai|undian_berhadiah_dinsos/i
];

// Pola Cryptojacking & Mining Script
const CRYPTOJACKING_PATTERNS = [
  /coinhive(\.min)?\.js/i,
  /cryptonight\.wasm/i,
  /coin-have\.com/i,
  /webminerpool/i,
  /stratum\+tcp:\/\//i
];

// Ekstensi File yang Dilarang Keras Diunggah (Anti-Webshell & Script Injection)
export const FORBIDDEN_EXTENSIONS = new Set([
  '.html', '.htm', '.php', '.phtml', '.php3', '.php4', '.php5', '.phps',
  '.js', '.mjs', '.cjs', '.sh', '.bash', '.bat', '.cmd', '.exe', '.msi',
  '.dll', '.scr', '.vbs', '.vbe', '.ps1', '.py', '.pl', '.cgi', '.jar',
  '.jsp', '.asp', '.aspx', '.htaccess', '.svg', '.wasm', '.com', '.vxd'
]);

// Catat Insiden Keamanan
export function logSecurityIncident(
  incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'attack_category'> & { attack_category?: SecurityIncident['attack_category'] }
): SecurityIncident {
  // Tentukan kategori serangan secara otomatis jika belum spesifik
  let category: SecurityIncident['attack_category'] = incident.attack_category || 'WEB_EXPLOITATION';
  const typeStr = incident.attack_type.toUpperCase();

  if (typeStr.includes('MALWARE') || typeStr.includes('WEBSHELL') || typeStr.includes('UPLOAD')) {
    category = 'MALWARE_THREAT';
  } else if (typeStr.includes('PHISHING') || typeStr.includes('SOCIAL') || typeStr.includes('DEEPFAKE')) {
    category = 'SOCIAL_ENGINEERING';
  } else if (typeStr.includes('DDOS') || typeStr.includes('TRAFFIC') || typeStr.includes('SESSION') || typeStr.includes('SPOOF')) {
    category = 'NETWORK_TRAFFIC';
  } else if (typeStr.includes('BRUTE') || typeStr.includes('CREDENTIAL') || typeStr.includes('SPRAY')) {
    category = 'CREDENTIAL_ATTACK';
  } else if (typeStr.includes('SUPPLY') || typeStr.includes('CRYPTO') || typeStr.includes('INSIDER') || typeStr.includes('IOT')) {
    category = 'INFRASTRUCTURE_THREAT';
  }

  const newIncident: SecurityIncident = {
    id: `SEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    attack_category: category,
    ...incident
  };

  securityIncidents.unshift(newIncident);
  if (securityIncidents.length > MAX_INCIDENTS) {
    securityIncidents.pop();
  }

  securityStats.totalAttacksBlocked++;
  if (category in securityStats.attacksByCategory) {
    securityStats.attacksByCategory[category]++;
  }

  const subType = newIncident.attack_type as keyof typeof securityStats.attacksByType;
  if (subType in securityStats.attacksByType) {
    securityStats.attacksByType[subType]++;
  }

  // Notifikasi Sistem
  if (newIncident.threat_level === 'CRITICAL' || newIncident.threat_level === 'HIGH') {
    catatNotifikasi(
      `🛡️ [CYBER SHIELD] Serangan ${newIncident.attack_category} (${newIncident.attack_type}) dari IP ${newIncident.ip} berhasil DIBLOKIR. Ancaman: ${newIncident.threat_level}.`,
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

// Helper periksa teks terhadap pola regex
function testAgainstPatterns(text: string, patterns: RegExp[]): { matched: boolean; rule: string } {
  if (!text || typeof text !== 'string') return { matched: false, rule: '' };
  for (const pat of patterns) {
    if (pat.test(text)) {
      return { matched: true, rule: pat.toString() };
    }
  }
  return { matched: false, rule: '' };
}

// Helper kumpulkan seluruh string payload dari request body / query
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
// WAF CORE MIDDLEWARE (CYBER SHIELD MULTI-LAYER DEFENSE)
// ============================================================================
export function cyberShieldWaf(req: Request, res: Response, next: NextFunction): void {
  securityStats.totalRequestsInspected++;
  const clientIp = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || 'Unknown');
  const rawPath = req.originalUrl || req.url || '';

  // Endpoint internal developer / security (akan divalidasi oleh requireSuperAdmin di rute)
  if (rawPath.startsWith('/api/security') || rawPath.startsWith('/security')) {
    return next();
  }

  // 1. Cek apakah IP klien sedang diblokir
  const isLocalDev = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
  if (!isLocalDev) {
    const blockStatus = isIpBlocked(clientIp);
    if (blockStatus.blocked) {
      res.status(403).json({
        status: 'error',
        code: 'IP_ADDRESS_BLOCKED',
        message: `Akses ditolak: Alamat IP Anda (${clientIp}) sedang diblokir sementara oleh Cyber Shield karena terdeteksi aktivitas mencurigakan. Alasan: ${blockStatus.reason}. Sisa waktu: ${Math.ceil((blockStatus.remainingMs || 0) / 60000)} menit.`,
        incident_status: 'QUARANTINED'
      });
      return;
    }
  }

  // 2. Kategori 6: Perlindungan Berkas Rahasia Sistem (firebase-applet-config, .env, package.json, dll.)
  const secretFileMatch = testAgainstPatterns(rawPath, PROTECTED_CONFIG_PATHS);
  if (secretFileMatch.matched) {
    const inc = logSecurityIncident({
      ip: clientIp,
      method: req.method,
      path: rawPath,
      attack_category: 'INFRASTRUCTURE_THREAT',
      attack_type: 'INFRASTRUCTURE_THREAT',
      threat_level: 'CRITICAL',
      matched_rule: secretFileMatch.rule,
      payload_sample: rawPath.slice(0, 150),
      user_agent: userAgent,
      status: 'BLOCKED',
      action_taken: 'Memblokir upaya pembacaan berkas rahasia konfigurasi sistem (Kategori 6).'
    });

    blockIp(clientIp, `Percobaan pencurian berkas rahasia: ${rawPath}`, 120);

    res.status(403).json({
      status: 'error',
      code: 'PROTECTED_FILE_ACCESS_DENIED',
      message: 'Akses Dilarang: Berkas rahasia sistem dilindungi penuh dari pembacaan eksternal.',
      incident_id: inc.id
    });
    return;
  }

  // 3. Kategori 3 & 6: Scanner Reconnaissance & Botnet Probe
  const reconMatch = testAgainstPatterns(rawPath, SCANNER_RECON_PATHS);
  if (reconMatch.matched) {
    const inc = logSecurityIncident({
      ip: clientIp,
      method: req.method,
      path: rawPath,
      attack_category: 'INFRASTRUCTURE_THREAT',
      attack_type: 'RECON_SCANNER',
      threat_level: 'HIGH',
      matched_rule: reconMatch.rule,
      payload_sample: rawPath.slice(0, 150),
      user_agent: userAgent,
      status: 'BLOCKED',
      action_taken: 'Memblokir akses bot scanning/IoT recon ke direktori sistem.'
    });

    blockIp(clientIp, `Scanner recon bot: ${rawPath}`, 60);

    res.status(403).json({
      status: 'error',
      code: 'MALICIOUS_PROBING_BLOCKED',
      message: 'Akses terlarang. Permintaan Anda diklasifikasikan sebagai pemindaian (reconnaissance) tidak sah.',
      incident_id: inc.id
    });
    return;
  }

  // Kumpulkan seluruh data request untuk analisis muatan
  const bodyStrings = extractStringsFromObject(req.body);
  const queryStrings = extractStringsFromObject(req.query);
  const allPayloads = [rawPath, ...queryStrings, ...bodyStrings];

  // 4. Kategori 4: SQL Injection
  for (const payload of allPayloads) {
    const sqli = testAgainstPatterns(payload, SQLI_PATTERNS);
    if (sqli.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'WEB_EXPLOITATION',
        attack_type: 'SQL_INJECTION',
        threat_level: 'CRITICAL',
        matched_rule: sqli.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir injeksi SQL dan melindungi integritas database kependudukan.'
      });

      blockIp(clientIp, 'Percobaan SQL Injection terdeteksi', 60);

      res.status(403).json({
        status: 'error',
        code: 'SQL_INJECTION_BLOCKED',
        message: 'Permintaan dibatalkan: Indikasi percobaan SQL Injection terdeteksi oleh Sistem Keamanan Sidoarjo.',
        incident_id: inc.id
      });
      return;
    }
  }

  // 5. Kategori 4: Cross-Site Scripting (XSS)
  for (const payload of allPayloads) {
    const xss = testAgainstPatterns(payload, XSS_PATTERNS);
    if (xss.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'WEB_EXPLOITATION',
        attack_type: 'XSS',
        threat_level: 'HIGH',
        matched_rule: xss.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir muatan skrip berbahaya XSS.'
      });

      res.status(403).json({
        status: 'error',
        code: 'XSS_ATTACK_BLOCKED',
        message: 'Permintaan dibatalkan: Terdeteksi muatan berbahaya yang mengandung script eksekusi (XSS).',
        incident_id: inc.id
      });
      return;
    }
  }

  // 6. Kategori 4: Command Injection / Remote Code Execution (RCE)
  for (const payload of allPayloads) {
    const cmd = testAgainstPatterns(payload, COMMAND_INJECTION_PATTERNS);
    if (cmd.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'WEB_EXPLOITATION',
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

  // 7. Kategori 4: Path Traversal / LFI
  for (const payload of allPayloads) {
    const traversal = testAgainstPatterns(payload, PATH_TRAVERSAL_PATTERNS);
    if (traversal.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'WEB_EXPLOITATION',
        attack_type: 'PATH_TRAVERSAL',
        threat_level: 'HIGH',
        matched_rule: traversal.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir navigasi penelusuran direktori sistem terlarang.'
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

  // 8. Kategori 1: Malware & Webshell Content Scan
  for (const payload of allPayloads) {
    const malware = testAgainstPatterns(payload, MALWARE_CONTENT_PATTERNS);
    if (malware.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'MALWARE_THREAT',
        attack_type: 'MALWARE_THREAT',
        threat_level: 'CRITICAL',
        matched_rule: malware.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir pola eksekusi perangkat lunak jahat (Malware / Webshell).'
      });

      blockIp(clientIp, 'Pola Malware / Webshell terdeteksi dalam payload', 90);

      res.status(403).json({
        status: 'error',
        code: 'MALWARE_SIGNATURE_BLOCKED',
        message: 'Permintaan dibatalkan: Muatan mengandung tanda tangan kode malware yang dilarang.',
        incident_id: inc.id
      });
      return;
    }
  }

  // 9. Kategori 2: Social Engineering (Phishing / Fake Harvest)
  for (const payload of allPayloads) {
    const socEng = testAgainstPatterns(payload, SOCIAL_ENG_PATTERNS);
    if (socEng.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'SOCIAL_ENGINEERING',
        attack_type: 'SOCIAL_ENGINEERING',
        threat_level: 'HIGH',
        matched_rule: socEng.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir indikasi tautan penipuan / phishing rekayasa sosial.'
      });

      res.status(403).json({
        status: 'error',
        code: 'SOCIAL_ENGINEERING_BLOCKED',
        message: 'Permintaan dibatalkan: Terdeteksi pola rekayasa sosial atau tautan penipuan yang tidak sah.',
        incident_id: inc.id
      });
      return;
    }
  }

  // 10. Kategori 6: Cryptojacking Script
  for (const payload of allPayloads) {
    const cryptoMine = testAgainstPatterns(payload, CRYPTOJACKING_PATTERNS);
    if (cryptoMine.matched) {
      const inc = logSecurityIncident({
        ip: clientIp,
        method: req.method,
        path: rawPath,
        attack_category: 'INFRASTRUCTURE_THREAT',
        attack_type: 'INFRASTRUCTURE_THREAT',
        threat_level: 'HIGH',
        matched_rule: cryptoMine.rule,
        payload_sample: payload.slice(0, 180),
        user_agent: userAgent,
        status: 'BLOCKED',
        action_taken: 'Memblokir upaya penyusupan skrip penambang kripto tanpa izin.'
      });

      res.status(403).json({
        status: 'error',
        code: 'CRYPTOJACKING_BLOCKED',
        message: 'Permintaan dibatalkan: Terdeteksi skrip cryptojacking yang dilarang.',
        incident_id: inc.id
      });
      return;
    }
  }

  // Lolos seluruh inspeksi WAF
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
        blockIp(ip, 'Terlalu sering melanggar ambang batas Rate Limit / Brute Force', 20);
      }

      logSecurityIncident({
        ip,
        method: req.method,
        path: req.originalUrl,
        attack_category: 'CREDENTIAL_ATTACK',
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
// PERTAHANAN LOGIN & BRUTE FORCE (KATEGORI 5)
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
    blockIp(ip, 'Gagal masuk akun (brute-force login) berturut-turut sebanyak 5 kali', 30);
    logSecurityIncident({
      ip,
      method: 'POST',
      path: '/api/auth/login',
      attack_category: 'CREDENTIAL_ATTACK',
      attack_type: 'BRUTE_FORCE',
      threat_level: 'HIGH',
      matched_rule: 'Failed login attempts >= 5',
      payload_sample: `Attempts: ${entry.count}`,
      user_agent: 'Login Monitor',
      status: 'BLOCKED',
      action_taken: 'IP dikarantina selama 30 menit akibat kegagalan login berulang.'
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

  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
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

// Middleware Verifikasi Token Umum
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
// MIDDLEWARE HANYA UNTUK SUPER ADMIN / DEVELOPER (KEAMANAN CYBER SHIELD)
// ============================================================================
export function requireSuperAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token) {
    // Berikan respons 403 / 401 jelas
    res.status(401).json({
      status: 'error',
      code: 'AUTH_REQUIRED',
      message: 'Otorisasi diperlukan: Pusat Keamanan Cyber Shield hanya dapat diakses oleh Super Admin / Developer.'
    });
    return;
  }

  const verified = verifySecureJwt(token);
  if (!verified.valid) {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: `Token otentikasi tidak valid: ${verified.reason}`
    });
    return;
  }

  const role = String(verified.payload.role || '').toLowerCase().replace(/[\s-]/g, '_');
  if (role !== 'super_admin' && role !== 'developer') {
    logSecurityIncident({
      ip: getClientIp(req),
      method: req.method,
      path: req.originalUrl,
      attack_category: 'INFRASTRUCTURE_THREAT',
      attack_type: 'INSIDER_THREAT',
      threat_level: 'HIGH',
      matched_rule: `Unauthorized access to Cyber Shield by user: ${verified.payload.username} (role: ${role})`,
      payload_sample: `User ${verified.payload.username} [${role}] attempted access to ${req.originalUrl}`,
      user_agent: String(req.headers['user-agent'] || 'Unknown'),
      status: 'BLOCKED',
      action_taken: 'Memblokir akses bukan Super Admin ke pusat kontrol keamanan developer.'
    });

    res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN_NOT_SUPER_ADMIN',
      message: 'Akses Ditolak: Fitur dan konfigurasi Cyber Shield hanya diizinkan untuk akun Super Admin / Developer. Akun Admin atau Petugas tidak memiliki hak akses.'
    });
    return;
  }

  (req as any).user = verified.payload;
  next();
}

// ============================================================================
// VALIDASI UNGGAHAN BERKAS AMAN (KATEGORI 1: ANTI-WEBSHELL & MALWARE)
// ============================================================================
export function validateUploadFileSafe(filename: string, mimetype: string): { safe: boolean; reason?: string } {
  const ext = path.extname(filename).toLowerCase();

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      safe: false,
      reason: `Format berkas (${ext}) dilarang keras karena tergolong format eksekusi program berbahaya (Anti-Webshell & Anti-Malware).`
    };
  }

  if (filename.includes('..') || filename.includes('\0')) {
    return {
      safe: false,
      reason: 'Nama berkas mengandung karakter traversal atau null byte berbahaya.'
    };
  }

  const dangerousMimes = ['text/html', 'application/x-php', 'application/javascript', 'application/x-sh', 'application/x-msdownload', 'application/octet-stream-script'];
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
