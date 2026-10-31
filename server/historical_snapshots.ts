import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { loadMysqlConfig, getMysqlPool } from '../mysql_storage.js';
import type { WargaItem } from './types.js';

export interface ArsipSnapshot {
  snapshot_id: string;
  label: string;
  tahun: number;
  bulan: number;
  bulan_nama: string;
  minggu_ke: number;
  hari: string;
  tanggal: string;
  jam: string;
  waktu_iso: string;
  total_warga: number;
  is_master_standard: boolean;
  kategori: 'master_standar' | 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'manual';
  catatan?: string;
  data_warga: any[];
}

const SNAPSHOTS_DISK_PATH = path.resolve(process.cwd(), 'arsip-historis-snapshots.json');
const MYSQL_AWAL_BACKUP_PATH = path.resolve(process.cwd(), 'arsip-cadangan-mysql-awal.json');

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

export let historicalSnapshotsStore: ArsipSnapshot[] = [];

export function getNamaBulan(b: number): string {
  const idx = Math.max(1, Math.min(12, b)) - 1;
  return NAMA_BULAN[idx] || 'Bulan';
}

export function getHariFromDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return NAMA_HARI[d.getDay()] || 'Senin';
    }
  } catch (_) {}
  return 'Senin';
}

export function getMingguKe(dateStr: string): number {
  try {
    const d = new Date(dateStr);
    const dayOfMonth = d.getDate();
    return Math.min(5, Math.max(1, Math.ceil(dayOfMonth / 7)));
  } catch (_) {}
  return 1;
}

export function loadMaster100Dataset(): any[] {
  try {
    if (fs.existsSync(MYSQL_AWAL_BACKUP_PATH)) {
      const raw = JSON.parse(fs.readFileSync(MYSQL_AWAL_BACKUP_PATH, 'utf-8'));
      if (Array.isArray(raw) && raw.length > 0) {
        return raw;
      }
    }
  } catch (_) {}
  return [];
}

export async function ensureSnapshotTableInMysql(): Promise<boolean> {
  let conn: mysql.Connection | null = null;
  try {
    const cfg = loadMysqlConfig();
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password || '',
      connectTimeout: 4000
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${cfg.database}\`;`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`arsip_snapshot_historis\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`snapshot_id\` VARCHAR(64) NOT NULL UNIQUE,
        \`label\` VARCHAR(255) NOT NULL,
        \`tahun\` INT NOT NULL,
        \`bulan\` INT NOT NULL,
        \`bulan_nama\` VARCHAR(30) NOT NULL,
        \`minggu_ke\` INT NOT NULL,
        \`hari\` VARCHAR(20) NOT NULL,
        \`tanggal\` DATE NOT NULL,
        \`jam\` VARCHAR(30) NOT NULL,
        \`waktu_iso\` VARCHAR(50) NOT NULL,
        \`total_warga\` INT NOT NULL,
        \`is_master_standard\` TINYINT(1) DEFAULT 0,
        \`kategori\` VARCHAR(50) DEFAULT 'manual',
        \`catatan\` TEXT NULL,
        \`data_json\` LONGTEXT NOT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_tahun_bulan\` (\`tahun\`, \`bulan\`),
        INDEX \`idx_tanggal\` (\`tanggal\`),
        INDEX \`idx_is_master\` (\`is_master_standard\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await conn.end();
    return true;
  } catch (err) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
    return false;
  }
}

export function saveSnapshotsToDisk(): void {
  try {
    const payload = {
      updated_at: new Date().toISOString(),
      total_snapshots: historicalSnapshotsStore.length,
      snapshots: historicalSnapshotsStore
    };
    fs.writeFileSync(SNAPSHOTS_DISK_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SnapshotDisk] Gagal menyimpan arsip-historis-snapshots.json:', err);
  }
}

export async function syncSingleSnapshotToMysql(snap: ArsipSnapshot): Promise<void> {
  let conn: mysql.Connection | null = null;
  try {
    const cfg = loadMysqlConfig();
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database,
      connectTimeout: 4000
    });
    const jsonStr = JSON.stringify(snap.data_warga);
    await conn.query(
      `INSERT INTO \`arsip_snapshot_historis\` (
        snapshot_id, label, tahun, bulan, bulan_nama, minggu_ke, hari, tanggal, jam,
        waktu_iso, total_warga, is_master_standard, kategori, catatan, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        tahun = VALUES(tahun),
        bulan = VALUES(bulan),
        bulan_nama = VALUES(bulan_nama),
        minggu_ke = VALUES(minggu_ke),
        hari = VALUES(hari),
        tanggal = VALUES(tanggal),
        jam = VALUES(jam),
        waktu_iso = VALUES(waktu_iso),
        total_warga = VALUES(total_warga),
        is_master_standard = VALUES(is_master_standard),
        kategori = VALUES(kategori),
        catatan = VALUES(catatan),
        data_json = VALUES(data_json)`,
      [
        snap.snapshot_id,
        snap.label,
        snap.tahun,
        snap.bulan,
        snap.bulan_nama,
        snap.minggu_ke,
        snap.hari,
        snap.tanggal,
        snap.jam,
        snap.waktu_iso,
        snap.total_warga,
        snap.is_master_standard ? 1 : 0,
        snap.kategori,
        snap.catatan || '',
        jsonStr
      ]
    );
    await conn.end();
  } catch (_) {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
  }
}

export function initHistoricalSnapshots(): ArsipSnapshot[] {
  let loadedFromDisk = false;
  if (fs.existsSync(SNAPSHOTS_DISK_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SNAPSHOTS_DISK_PATH, 'utf-8'));
      const list = Array.isArray(parsed) ? parsed : (parsed.snapshots || []);
      if (Array.isArray(list) && list.length > 0) {
        historicalSnapshotsStore = list;
        loadedFromDisk = true;
      }
    } catch (_) {}
  }

  // Jika belum ada snapshot atau belum memuat Data Master 100 Warga, inisialisasi default
  const master100Data = loadMaster100Dataset();
  const hasMaster100 = historicalSnapshotsStore.some(s => s.is_master_standard && s.total_warga >= 100);

  if (!hasMaster100 && master100Data.length >= 100) {
    const master100Snap: ArsipSnapshot = {
      snapshot_id: 'SNAP-2026-10-W4-D31-MASTER100',
      label: 'Data Master Standar Resmi Sidoarjo (100 Warga KPM Berbagai Wilayah)',
      tahun: 2026,
      bulan: 10,
      bulan_nama: 'Oktober',
      minggu_ke: 4,
      hari: 'Sabtu',
      tanggal: '2026-10-31',
      jam: '09:00 WIB',
      waktu_iso: '2026-10-31T09:00:00.000Z',
      total_warga: master100Data.length,
      is_master_standard: true,
      kategori: 'master_standar',
      catatan: 'Dataset Master Standar Resmi 100 Warga terdistribusi di 10 Desil se-Kabupaten Sidoarjo.',
      data_warga: master100Data
    };
    // Pasang di posisi terdepan
    historicalSnapshotsStore.unshift(master100Snap);
  }

  // Tambahkan snapshot triwulan / bulanan jika belum ada
  if (!historicalSnapshotsStore.some(s => s.snapshot_id === 'SNAP-2026-10-W4-D31-REKAP14')) {
    historicalSnapshotsStore.push({
      snapshot_id: 'SNAP-2026-10-W4-D31-REKAP14',
      label: 'Snapshot Penyaluran Triwulan IV & Evaluasi Mutasi KPM (14 Warga Terpadu)',
      tahun: 2026,
      bulan: 10,
      bulan_nama: 'Oktober',
      minggu_ke: 4,
      hari: 'Sabtu',
      tanggal: '2026-10-31',
      jam: '08:30 WIB',
      waktu_iso: '2026-10-31T08:30:00.000Z',
      total_warga: 14,
      is_master_standard: false,
      kategori: 'mingguan',
      catatan: 'Memuat data pemutakhiran mutasi domisili, meninggal dunia, dan penyesuaian desil triwulanan.',
      data_warga: master100Data.slice(0, 14)
    });
  }

  if (!historicalSnapshotsStore.some(s => s.snapshot_id === 'SNAP-2026-09-W4-D30-BULANAN')) {
    historicalSnapshotsStore.push({
      snapshot_id: 'SNAP-2026-09-W4-D30-BULANAN',
      label: 'Arsip Penutupan Bulanan September 2026 (100 Warga Terverifikasi)',
      tahun: 2026,
      bulan: 9,
      bulan_nama: 'September',
      minggu_ke: 4,
      hari: 'Rabu',
      tanggal: '2026-09-30',
      jam: '23:59 WIB',
      waktu_iso: '2026-09-30T23:59:00.000Z',
      total_warga: master100Data.length || 100,
      is_master_standard: false,
      kategori: 'bulanan',
      catatan: 'Rekapitulasi penetapan bansos akhir bulan September 2026.',
      data_warga: master100Data
    });
  }

  if (!historicalSnapshotsStore.some(s => s.snapshot_id === 'SNAP-2025-12-W4-D31-TAHUNAN')) {
    historicalSnapshotsStore.push({
      snapshot_id: 'SNAP-2025-12-W4-D31-TAHUNAN',
      label: 'Arsip Tahunan Realisasi Bantuan Sosial Kabupaten Sidoarjo Tahun 2025',
      tahun: 2025,
      bulan: 12,
      bulan_nama: 'Desember',
      minggu_ke: 4,
      hari: 'Rabu',
      tanggal: '2025-12-31',
      jam: '23:59 WIB',
      waktu_iso: '2025-12-31T23:59:00.000Z',
      total_warga: master100Data.length || 100,
      is_master_standard: false,
      kategori: 'tahunan',
      catatan: 'Arsip historis tahun 2025 untuk komparasi multi-tahun.',
      data_warga: master100Data
    });
  }

  saveSnapshotsToDisk();
  setTimeout(async () => {
    await ensureSnapshotTableInMysql();
    for (const snap of historicalSnapshotsStore) {
      await syncSingleSnapshotToMysql(snap);
    }
  }, 100);

  return historicalSnapshotsStore;
}

export function listSnapshots(filter?: {
  tahun?: number;
  bulan?: number;
  minggu_ke?: number;
  tanggal?: string;
  query?: string;
  kategori?: string;
}): {
  snapshots: ArsipSnapshot[];
  total_snapshots: number;
  available_years: number[];
  current_year: number;
  master_snapshot: ArsipSnapshot | null;
} {
  initHistoricalSnapshots();
  let list = [...historicalSnapshotsStore];

  if (filter?.tahun !== undefined && !isNaN(filter.tahun) && filter.tahun > 0) {
    list = list.filter(s => s.tahun === Number(filter.tahun));
  }
  if (filter?.bulan !== undefined && !isNaN(filter.bulan) && filter.bulan > 0) {
    list = list.filter(s => s.bulan === Number(filter.bulan));
  }
  if (filter?.minggu_ke !== undefined && !isNaN(filter.minggu_ke) && filter.minggu_ke > 0) {
    list = list.filter(s => s.minggu_ke === Number(filter.minggu_ke));
  }
  if (filter?.tanggal) {
    const tClean = String(filter.tanggal).trim().slice(0, 10);
    list = list.filter(s => s.tanggal === tClean);
  }
  if (filter?.kategori && filter.kategori !== 'semua') {
    list = list.filter(s => s.kategori === filter.kategori);
  }
  if (filter?.query) {
    const q = filter.query.toLowerCase().trim();
    list = list.filter(s => s.label.toLowerCase().includes(q) || s.snapshot_id.toLowerCase().includes(q) || (s.catatan && s.catatan.toLowerCase().includes(q)));
  }

  // Urutkan snapshot terbaru ke terlama
  list.sort((a, b) => {
    const dateComp = b.tanggal.localeCompare(a.tanggal);
    if (dateComp !== 0) return dateComp;
    return b.jam.localeCompare(a.jam);
  });

  const yearSet = new Set<number>();
  historicalSnapshotsStore.forEach(s => yearSet.add(s.tahun));
  // Dukung rentang adaptif 100 tahun ke belakang hingga 100 tahun ke depan (1926 s/d 2126+)
  const thisYear = new Date().getFullYear();
  yearSet.add(thisYear);
  yearSet.add(thisYear - 1);
  yearSet.add(thisYear - 2);
  yearSet.add(thisYear + 1);

  const availableYears = Array.from(yearSet).sort((a, b) => b - a);
  const masterSnap = historicalSnapshotsStore.find(s => s.is_master_standard) || historicalSnapshotsStore[0] || null;

  return {
    snapshots: list,
    total_snapshots: historicalSnapshotsStore.length,
    available_years: availableYears,
    current_year: thisYear,
    master_snapshot: masterSnap
  };
}

export function saveNewSnapshot(params: {
  label: string;
  data_warga: any[];
  tahun?: number;
  bulan?: number;
  minggu_ke?: number;
  tanggal?: string;
  hari?: string;
  jam?: string;
  kategori?: ArsipSnapshot['kategori'];
  catatan?: string;
  is_master_standard?: boolean;
}): ArsipSnapshot {
  initHistoricalSnapshots();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  const tglStr = params.tanggal ? String(params.tanggal).slice(0, 10) : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dObj = new Date(tglStr);

  const tahun = params.tahun || (isNaN(dObj.getFullYear()) ? now.getFullYear() : dObj.getFullYear());
  const bulan = params.bulan || (isNaN(dObj.getMonth()) ? (now.getMonth() + 1) : (dObj.getMonth() + 1));
  const mingguKe = params.minggu_ke || getMingguKe(tglStr);
  const hari = params.hari || getHariFromDate(tglStr);
  const jam = params.jam || `${pad(now.getHours())}:${pad(now.getMinutes())} WIB`;

  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const snapId = `SNAP-${tahun}-${pad(bulan)}-W${mingguKe}-D${pad(dObj.getDate() || now.getDate())}-${randSuffix}`;

  const isMaster = Boolean(params.is_master_standard);

  if (isMaster) {
    historicalSnapshotsStore.forEach(s => s.is_master_standard = false);
  }

  const newSnap: ArsipSnapshot = {
    snapshot_id: snapId,
    label: params.label.trim() || `Cadangan Arsip (${params.data_warga.length} Warga)`,
    tahun,
    bulan,
    bulan_nama: getNamaBulan(bulan),
    minggu_ke: mingguKe,
    hari,
    tanggal: tglStr,
    jam,
    waktu_iso: now.toISOString(),
    total_warga: params.data_warga.length,
    is_master_standard: isMaster,
    kategori: params.kategori || (isMaster ? 'master_standar' : 'manual'),
    catatan: params.catatan || '',
    data_warga: JSON.parse(JSON.stringify(params.data_warga))
  };

  historicalSnapshotsStore.unshift(newSnap);
  saveSnapshotsToDisk();
  syncSingleSnapshotToMysql(newSnap).catch(() => {});

  return newSnap;
}

export function setSnapshotAsMaster(snapshotId: string): ArsipSnapshot | null {
  initHistoricalSnapshots();
  const snap = historicalSnapshotsStore.find(s => s.snapshot_id === snapshotId);
  if (!snap) return null;

  historicalSnapshotsStore.forEach(s => {
    s.is_master_standard = (s.snapshot_id === snapshotId);
  });

  saveSnapshotsToDisk();
  ensureSnapshotTableInMysql().then(async () => {
    for (const s of historicalSnapshotsStore) {
      await syncSingleSnapshotToMysql(s);
    }
  }).catch(() => {});

  return snap;
}

export function deleteSnapshotById(snapshotId: string): boolean {
  initHistoricalSnapshots();
  const idx = historicalSnapshotsStore.findIndex(s => s.snapshot_id === snapshotId);
  if (idx === -1) return false;

  const wasMaster = historicalSnapshotsStore[idx].is_master_standard;
  historicalSnapshotsStore.splice(idx, 1);

  if (wasMaster && historicalSnapshotsStore.length > 0) {
    historicalSnapshotsStore[0].is_master_standard = true;
  }

  saveSnapshotsToDisk();

  // Hapus dari MySQL
  (async () => {
    let conn: mysql.Connection | null = null;
    try {
      const cfg = loadMysqlConfig();
      conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password || '',
        database: cfg.database
      });
      await conn.query('DELETE FROM `arsip_snapshot_historis` WHERE `snapshot_id` = ?', [snapshotId]);
      await conn.end();
    } catch (_) {
      if (conn) try { await conn.end(); } catch (_) {}
    }
  })().catch(() => {});

  return true;
}

// Penggabungan Seluruh Data Lintas Snapshot Secara Serentak (Unified Multi-Period Restore)
export function mergeAllSnapshotsData(): { combined: any[]; total_snapshots: number; distinct_warga_count: number } {
  initHistoricalSnapshots();
  const citizenMap = new Map<string, any>();

  // Mulai dari snapshot terlama ke terbaru agar data paling mutakhir menimpa data historis jika ada NIK kembar
  const chronological = [...historicalSnapshotsStore].reverse();

  for (const snap of chronological) {
    const list = Array.isArray(snap.data_warga) ? snap.data_warga : [];
    for (const w of list) {
      const nik = String(w.nik || '').trim();
      if (!nik) continue;
      if (!citizenMap.has(nik)) {
        citizenMap.set(nik, { ...w });
      } else {
        const existing = citizenMap.get(nik);
        citizenMap.set(nik, {
          ...existing,
          ...w,
          extra_data: { ...(existing.extra_data || {}), ...(w.extra_data || {}) }
        });
      }
    }
  }

  const combined = Array.from(citizenMap.values());
  return {
    combined,
    total_snapshots: historicalSnapshotsStore.length,
    distinct_warga_count: combined.length
  };
}
