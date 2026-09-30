import type { WargaItem } from './types.js';
import {
  wargaStore,
  setWargaStore,
  wargaBackupStore,
  setWargaBackupStore,
  kriteriaStore,
  DATA_MASTER_SIDOARJO,
  nowTimeStr
} from './store.js';

export function parseFloatSafe(val: unknown, def = 0.0): number {
  if (val === null || val === undefined || String(val).trim() === '') return def;
  const cleaned = String(val).replace(',', '.').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : def;
}

export function parseIntSafe(val: unknown, def = 0): number {
  return Math.trunc(parseFloatSafe(val, def));
}

export function hitungDanSinkronkanSawBwm(): number {
  if (wargaStore.length === 0) return 0;

  const bobotMap: Record<string, { bobot: number; tipe: 'cost' | 'benefit' }> = {};
  kriteriaStore.forEach(k => {
    bobotMap[k.kode.toLowerCase()] = { bobot: k.bobot, tipe: k.tipe };
  });

  const c1Vals = wargaStore.map(w => Math.max(parseFloatSafe(w.c1, 1500000), 1));
  const c2Vals = wargaStore.map(w => Math.max(parseFloatSafe(w.c2, 5000000), 1));
  const c3Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c3, 40), 1));
  const c4Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c4, 1), 1));
  const c5Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c5, 2), 1));
  const c6Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c6, 1), 1));
  const c7Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c7, 1), 1));
  const c8Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c8, 1), 1));
  const c9Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c9, 1), 1));
  const c10Vals = wargaStore.map(w => Math.max(parseIntSafe(w.c10, 1), 1));

  const minC1 = Math.min(...c1Vals);
  const minC2 = Math.min(...c2Vals);
  const maxC3 = Math.max(...c3Vals);
  const maxC4 = Math.max(...c4Vals);
  const maxC5 = Math.max(...c5Vals);
  const maxC6 = Math.max(...c6Vals);
  const maxC7 = Math.max(...c7Vals);
  const minC8 = Math.min(...c8Vals);
  const minC9 = Math.min(...c9Vals);
  const minC10 = Math.min(...c10Vals);

  const scored = wargaStore.map(w => {
    const v1 = Math.max(parseFloatSafe(w.c1, minC1), 1);
    const v2 = Math.max(parseFloatSafe(w.c2, minC2), 1);
    const v3 = Math.max(parseIntSafe(w.c3, 1), 1);
    const v4 = Math.max(parseIntSafe(w.c4, 1), 1);
    const v5 = Math.max(parseIntSafe(w.c5, 1), 1);
    const v6 = Math.max(parseIntSafe(w.c6, 1), 1);
    const v7 = Math.max(parseIntSafe(w.c7, 1), 1);
    const v8 = Math.max(parseIntSafe(w.c8, 1), 1);
    const v9 = Math.max(parseIntSafe(w.c9, 1), 1);
    const v10 = Math.max(parseIntSafe(w.c10, 1), 1);

    const r1 = minC1 / v1;
    const r2 = minC2 / v2;
    const r3 = v3 / maxC3;
    const r4 = v4 / maxC4;
    const r5 = v5 / maxC5;
    const r6 = v6 / maxC6;
    const r7 = v7 / maxC7;
    const r8 = minC8 / v8;
    const r9 = minC9 / v9;
    const r10 = minC10 / v10;

    const skor =
      r1 * (bobotMap.c1?.bobot ?? 0.22) +
      r2 * (bobotMap.c2?.bobot ?? 0.15) +
      r3 * (bobotMap.c3?.bobot ?? 0.08) +
      r4 * (bobotMap.c4?.bobot ?? 0.05) +
      r5 * (bobotMap.c5?.bobot ?? 0.18) +
      r6 * (bobotMap.c6?.bobot ?? 0.06) +
      r7 * (bobotMap.c7?.bobot ?? 0.08) +
      r8 * (bobotMap.c8?.bobot ?? 0.10) +
      r9 * (bobotMap.c9?.bobot ?? 0.04) +
      r10 * (bobotMap.c10?.bobot ?? 0.04);

    return { warga: w, skor: Number(skor.toFixed(4)) };
  });

  scored.sort((a, b) => b.skor - a.skor);
  const totalN = scored.length;

  scored.forEach((item, idx) => {
    const rank = idx + 1;
    const desilVal = Math.min(10, Math.floor(((rank - 1) / totalN) * 10) + 1);
    item.warga.skor_saw = item.skor;
    item.warga.rank_saw = rank;
    item.warga.desil = desilVal;
    item.warga.prioritas = desilVal <= 4 ? 'Prioritas Utama' : 'Tidak Prioritas';
    item.warga.status_bansos = desilVal <= 4 ? 'Menerima Bansos' : 'Tidak Menerima';
  });

  return totalN;
}

export function buildFullSawReport(targetList: WargaItem[]) {
  const N = targetList.length;
  const bobot = kriteriaStore.map(k => k.bobot);
  if (N === 0) {
    return {
      metode: 'SAW (Dengan Bobot BWM)',
      kriteria: kriteriaStore,
      min_max: {},
      matriks_keputusan: [],
      matriks_normalisasi: [],
      hasil_akhir: [],
      bobot
    };
  }

  const rawRows = targetList.map((w, idx) => ({
    index: idx + 1,
    id: w.id,
    nik: w.nik,
    nama: w.nama,
    alamat: w.alamat,
    C1: Math.max(parseFloatSafe(w.c1, 1500000), 1),
    C2: Math.max(parseFloatSafe(w.c2, 5000000), 1),
    C3: Math.max(parseIntSafe(w.c3, 45), 1),
    C4: Math.max(parseIntSafe(w.c4, 1), 1),
    C5: Math.max(parseIntSafe(w.c5, 3), 1),
    C6: Math.max(parseIntSafe(w.c6, 2), 1),
    C7: Math.max(parseIntSafe(w.c7, 2), 1),
    C8: Math.max(parseIntSafe(w.c8, 2), 1),
    C9: Math.max(parseIntSafe(w.c9, 1), 1),
    C10: Math.max(parseIntSafe(w.c10, 1), 1)
  }));

  const minMax: Record<string, { min: number; max: number }> = {};
  for (let j = 1; j <= 10; j++) {
    const key = `C${j}` as keyof (typeof rawRows)[0];
    const vals = rawRows.map(r => Number(r[key]));
    minMax[`C${j}`] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  const matriksNormalisasi: Record<string, unknown>[] = [];
  const hasilAkhir: {
    id: number;
    nik: string;
    nama: string;
    alamat: string;
    skor_akhir: number;
    rank?: number;
    desil?: number;
    status_bansos?: string;
    prioritas?: string;
    menerima?: string;
  }[] = [];

  rawRows.forEach((row, i) => {
    let totalSkor = 0;
    const normRow: Record<string, unknown> = {
      index: i + 1,
      nik: row.nik,
      nama: row.nama
    };

    kriteriaStore.forEach((k, j) => {
      const cKey = `C${j + 1}`;
      const val = Number((row as Record<string, unknown>)[cKey]);
      const r = k.tipe === 'cost' ? minMax[cKey].min / val : val / minMax[cKey].max;
      normRow[cKey] = Number(r.toFixed(4));
      totalSkor += r * bobot[j];
    });

    matriksNormalisasi.push(normRow);
    hasilAkhir.push({
      id: row.id,
      nik: row.nik,
      nama: row.nama,
      alamat: row.alamat,
      skor_akhir: Number(totalSkor.toFixed(4))
    });
  });

  hasilAkhir.sort((a, b) => b.skor_akhir - a.skor_akhir);
  hasilAkhir.forEach((item, idx) => {
    const rank = idx + 1;
    const desil = Math.min(10, Math.max(1, Math.ceil((rank / N) * 10)));
    item.rank = rank;
    item.desil = desil;
    item.status_bansos = desil <= 4 ? 'Menerima Bansos' : 'Tidak Menerima';
    item.menerima = item.status_bansos;
    item.prioritas = desil <= 4 ? 'Prioritas Tinggi (Layak)' : 'Tidak Diprioritaskan';
  });

  return {
    metode: 'SAW (Dengan Bobot BWM)',
    kriteria: kriteriaStore,
    min_max: minMax,
    matriks_keputusan: rawRows,
    matriks_normalisasi: matriksNormalisasi,
    hasil_akhir: hasilAkhir,
    bobot
  };
}

let hasSeededInitial = false;

export function seedInitialWarga(force = false) {
  if (!force && hasSeededInitial) return;
  const initial = DATA_MASTER_SIDOARJO.map((r, idx) => ({
    id: idx + 1,
    nik: r[0],
    nama: r[1],
    tempat_lahir: r[2],
    tanggal_lahir: r[3],
    alamat: r[4],
    no_hp: r[5],
    email: r[6],
    lat: parseFloatSafe(r[7], -7.4478),
    lng: parseFloatSafe(r[8], 112.7183),
    c1: r[9],
    c2: r[10],
    c3: r[11],
    c4: r[12],
    c5: r[13],
    c6: r[14],
    c7: r[15],
    c8: r[16],
    c9: r[17],
    c10: r[18],
    desil: 5,
    skor_saw: 0,
    rank_saw: 0,
    is_verified: r[19],
    status_validasi: r[20],
    status_salur: r[21],
    status_bansos: r[19] ? 'Layak Bansos' : 'Menunggu Verifikasi',
    prioritas: r[19] ? 'Prioritas Utama' : 'Menunggu',
    bukti_salur: r[21] === 'Telah Menerima' ? 'bukti_3515706317586051_1786544215.jpg' : '',
    catatan: r[22],
    nominal_bantuan: 'Rp 600.000 / Beras 10 Kg',
    tanggal_salur: r[21] === 'Telah Menerima' ? '25/09/2026 10:15' : '-',
    created_at: '2026-09-25 09:00'
  }));

  setWargaStore(initial);
  hitungDanSinkronkanSawBwm();
  setWargaBackupStore(JSON.parse(JSON.stringify(initial)));
  hasSeededInitial = true;
}

// Initial seed
seedInitialWarga(true);
