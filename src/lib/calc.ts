// Pure calculation rules from PRD section 2.4 — kept framework-free and testable.
import type { Category, LineStop, ProductionRecord } from "./types";

/** Duration of a stop in ms; open stops use `atMs` as a provisional end. */
export function stopDurationMs(stop: LineStop, atMs: number): number {
  const end = stop.endMs ?? atMs;
  return Math.max(0, end - stop.startMs);
}

export function isBreakdown(stop: LineStop, categories: Category[]): boolean {
  const cat = categories.find((c) => c.id === stop.categoryId);
  return cat?.countsAsBreakdown === true;
}

/** MTTR = total breakdown duration / number of breakdown stops (closed only). */
export function mttrMs(stops: LineStop[], categories: Category[]): number | null {
  const breakdowns = stops.filter(
    (s) => s.status === "closed" && isBreakdown(s, categories),
  );
  if (breakdowns.length === 0) return null;
  const total = breakdowns.reduce((acc, s) => acc + stopDurationMs(s, s.endMs ?? 0), 0);
  return total / breakdowns.length;
}

/**
 * MTBF = operating time / number of breakdown stops.
 * Operating time is passed in by the caller (PLC run time when available,
 * otherwise planned production time - total stop time).
 */
export function mtbfMs(stops: LineStop[], categories: Category[], operatingTimeMs: number): number | null {
  const count = stops.filter((s) => isBreakdown(s, categories)).length;
  if (count === 0) return null;
  return operatingTimeMs / count;
}

/** Operating time when PLC run time is unavailable: planned time - total stop time. */
export function operatingTimeMs(plannedMs: number, stops: LineStop[], categories: Category[], atMs: number): number {
  const downtime = stops
    .filter((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      return cat?.countsAsDowntime !== false;
    })
    .reduce((acc, s) => acc + stopDurationMs(s, atMs), 0);
  return Math.max(0, plannedMs - downtime);
}

export function avgStopMs(stops: LineStop[], atMs: number): number | null {
  if (stops.length === 0) return null;
  const total = stops.reduce((acc, s) => acc + stopDurationMs(s, atMs), 0);
  return total / stops.length;
}

export function frequencyBy<T extends string>(
  stops: LineStop[],
  keyOf: (s: LineStop) => T,
): Map<T, number> {
  const map = new Map<T, number>();
  for (const s of stops) {
    const k = keyOf(s);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export function downtimeByCategory(stops: LineStop[], categories: Category[], atMs: number) {
  const map = new Map<string, { name: string; durationMs: number; count: number }>();
  for (const s of stops) {
    const cat = categories.find((c) => c.id === s.categoryId);
    const name = cat?.name ?? "Unknown";
    const cur = map.get(s.categoryId) ?? { name, durationMs: 0, count: 0 };
    cur.durationMs += stopDurationMs(s, atMs);
    cur.count += 1;
    map.set(s.categoryId, cur);
  }
  return [...map.values()].sort((a, b) => b.durationMs - a.durationMs);
}

// ---- OEE & Availability Rules ----

export type OeeResult = {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  oee: number; // 0..1
};

/**
 * Formula: Availability = MTBF / (MTBF + MTTR)
 * OEE is calculated strictly as Availability per user specification.
 */
export function computeAvailabilityFromMtbfMttr(
  mtbfMs: number | null,
  mttrMs: number | null,
  fallbackOperatingMs?: number,
  fallbackPlannedMs?: number,
): number {
  if (mtbfMs !== null && mttrMs !== null) {
    const total = mtbfMs + mttrMs;
    if (total <= 0) return 0;
    return clamp01(mtbfMs / total);
  }
  // When there are no breakdown stops (mttr is null)
  if (mttrMs === null) {
    if (fallbackPlannedMs && fallbackPlannedMs > 0 && fallbackOperatingMs !== undefined) {
      return clamp01(fallbackOperatingMs / fallbackPlannedMs);
    }
    return 1; // 100% available
  }
  return 0;
}

/**
 * Mitsubishi FUSO Working Hours Matrix Rules
 */
export interface MatrixShiftRow {
  normal: number; // minutes
  ot1: number;    // minutes
  ot2: number;    // minutes
  ot3: number;    // minutes
}

export interface MatrixDayRule {
  id: "senin_kamis" | "jumat" | "sabtu" | "hari_pertama" | "tanggal_17";
  name: string;
  pagi: MatrixShiftRow;
  malam: MatrixShiftRow;
  fridayDeductionMin?: number; // e.g. 25
  remarks?: string;
}

export type WorkingHoursMatrix = Record<
  "senin_kamis" | "jumat" | "sabtu" | "hari_pertama" | "tanggal_17",
  MatrixDayRule
>;

export const DEFAULT_WORKING_HOURS_MATRIX: WorkingHoursMatrix = {
  senin_kamis: {
    id: "senin_kamis",
    name: "Senin - Kamis",
    pagi: { normal: 485, ot1: 545, ot2: 605, ot3: 665 },
    malam: { normal: 420, ot1: 480, ot2: 540, ot3: 600 },
    remarks: "",
  },
  jumat: {
    id: "jumat",
    name: "Jumat",
    pagi: { normal: 460, ot1: 520, ot2: 580, ot3: 640 },
    malam: { normal: 420, ot1: 480, ot2: 540, ot3: 600 },
    fridayDeductionMin: 25,
    remarks: "",
  },
  sabtu: {
    id: "sabtu",
    name: "Sabtu",
    pagi: { normal: 480, ot1: 540, ot2: 600, ot3: 660 },
    malam: { normal: 480, ot1: 540, ot2: 600, ot3: 660 },
    remarks: "",
  },
  hari_pertama: {
    id: "hari_pertama",
    name: "Hari jumat pertama masuk tiap bulan",
    pagi: { normal: 455, ot1: 515, ot2: 575, ot3: 635 },
    malam: { normal: 390, ot1: 450, ot2: 510, ot3: 570 },
    fridayDeductionMin: 25,
    remarks: "Kalau hari pertama masuk di hari jumat, maka -25 menit",
  },
  tanggal_17: {
    id: "tanggal_17",
    name: "Tanggal 17",
    pagi: { normal: 455, ot1: 515, ot2: 575, ot3: 635 },
    malam: { normal: 420, ot1: 480, ot2: 540, ot3: 600 },
    remarks: "",
  },
};

export const WORKING_HOURS_STORAGE_KEY = "krm_working_hours_matrix";

export function getSavedWorkingHoursMatrix(): WorkingHoursMatrix {
  if (typeof window === "undefined") return DEFAULT_WORKING_HOURS_MATRIX;
  try {
    const raw = localStorage.getItem(WORKING_HOURS_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKING_HOURS_MATRIX;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.senin_kamis) {
      return {
        senin_kamis: { ...DEFAULT_WORKING_HOURS_MATRIX.senin_kamis, ...parsed.senin_kamis },
        jumat: { ...DEFAULT_WORKING_HOURS_MATRIX.jumat, ...parsed.jumat },
        sabtu: { ...DEFAULT_WORKING_HOURS_MATRIX.sabtu, ...parsed.sabtu },
        hari_pertama: {
          ...DEFAULT_WORKING_HOURS_MATRIX.hari_pertama,
          ...parsed.hari_pertama,
          name: DEFAULT_WORKING_HOURS_MATRIX.hari_pertama.name,
        },
        tanggal_17: { ...DEFAULT_WORKING_HOURS_MATRIX.tanggal_17, ...parsed.tanggal_17 },
      };
    }
  } catch {}
  return DEFAULT_WORKING_HOURS_MATRIX;
}

export function saveWorkingHoursMatrix(matrix: WorkingHoursMatrix): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKING_HOURS_STORAGE_KEY, JSON.stringify(matrix));
    window.dispatchEvent(new Event("krm_working_hours_matrix_updated"));
  } catch {}
}

export function getFusoMinutesFromMatrix(
  ruleCode: "senin_kamis" | "jumat" | "sabtu" | "hari_pertama" | "tanggal_17",
  shift: "pagi" | "malam",
  otTier: "normal" | "ot-1" | "ot-2" | "ot-3" | "night-shift" | "ot-8" | "ot-9" | "ot-10" | "ot-11",
  isFridayFirstDay?: boolean,
  matrix?: WorkingHoursMatrix,
): number {
  const m = matrix ?? getSavedWorkingHoursMatrix();
  const rule = m[ruleCode] ?? DEFAULT_WORKING_HOURS_MATRIX[ruleCode];
  const shiftRow = shift === "pagi" ? rule.pagi : rule.malam;
  let val: number;
  if (otTier === "ot-1" || otTier === "ot-9") val = shiftRow.ot1;
  else if (otTier === "ot-2" || otTier === "ot-10") val = shiftRow.ot2;
  else if (otTier === "ot-3" || otTier === "ot-11") val = shiftRow.ot3;
  else val = shiftRow.normal;

  if (ruleCode === "hari_pertama" && isFridayFirstDay && shift === "pagi") {
    const deduction = rule.fridayDeductionMin ?? 25;
    val = Math.max(0, val - deduction);
  }
  return val;
}

export interface FusoWorkingRule {
  ruleName: string;
  ruleCode: "senin_kamis" | "jumat" | "sabtu" | "hari_pertama" | "tanggal_17";
  shift: "pagi" | "malam";
  baseMin: number;
  isFridayDeductionApplied?: boolean;
}

export function getFusoWorkingRule(
  dateStr: string,
  shift: "pagi" | "malam",
  dateAssignments?: Record<string, string>,
  matrix?: WorkingHoursMatrix,
): FusoWorkingRule {
  const currentMatrix = matrix ?? getSavedWorkingHoursMatrix();
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  const year = d.getFullYear();
  const month = d.getMonth();
  const dayOfMonth = d.getDate();
  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

  // 1. Tanggal 17 (Upacara)
  if (dayOfMonth === 17) {
    const rule = currentMatrix.tanggal_17;
    return {
      ruleName: "Tanggal 17 (Upacara)",
      ruleCode: "tanggal_17",
      shift,
      baseMin: shift === "pagi" ? rule.pagi.normal : rule.malam.normal,
    };
  }

  // 2. Hari jumat pertama masuk tiap bulan
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstWorkingFridayOfMonth = -1;
  for (let day = 1; day <= daysInMonth; day++) {
    const checkDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const checkD = new Date(`${checkDateStr}T00:00:00+07:00`);
    const dow = checkD.getDay();
    const assigned = dateAssignments?.[checkDateStr];
    const isHoliday = assigned ? assigned === "holiday" : dow === 0 || dow === 6;
    if (dow === 5 && !isHoliday) {
      firstWorkingFridayOfMonth = day;
      break;
    }
  }

  if (dayOfMonth === firstWorkingFridayOfMonth) {
    const rule = currentMatrix.hari_pertama;
    const deduction = rule.fridayDeductionMin ?? 25;
    if (shift === "pagi") {
      const base = Math.max(0, rule.pagi.normal - deduction);
      return {
        ruleName: `Hari Jumat Pertama Masuk Tiap Bulan (-${deduction}m)`,
        ruleCode: "hari_pertama",
        shift,
        baseMin: base,
        isFridayDeductionApplied: true,
      };
    } else {
      return {
        ruleName: "Hari Jumat Pertama Masuk Tiap Bulan",
        ruleCode: "hari_pertama",
        shift,
        baseMin: rule.malam.normal,
      };
    }
  }

  // 3. Jumat (Break Jumatan)
  if (dayOfWeek === 5) {
    const rule = currentMatrix.jumat;
    return {
      ruleName: "Jumat (Break Jumatan)",
      ruleCode: "jumat",
      shift,
      baseMin: shift === "pagi" ? rule.pagi.normal : rule.malam.normal,
      isFridayDeductionApplied: shift === "pagi",
    };
  }

  // 4. Sabtu (OT 8-11)
  if (dayOfWeek === 6) {
    const rule = currentMatrix.sabtu;
    return {
      ruleName: "Sabtu (OT 8-11)",
      ruleCode: "sabtu",
      shift,
      baseMin: shift === "pagi" ? rule.pagi.normal : rule.malam.normal,
    };
  }

  // 5. Senin - Kamis
  const rule = currentMatrix.senin_kamis;
  return {
    ruleName: "Senin - Kamis",
    ruleCode: "senin_kamis",
    shift,
    baseMin: shift === "pagi" ? rule.pagi.normal : rule.malam.normal,
  };
}

/** OEE per PRD 2.4: Availability × Performance × Quality. */
export function computeOee(record: ProductionRecord, downtimeMs: number): OeeResult {
  const plannedMs = Math.max(1, record.plannedMin * 60_000);
  const runMs = Math.max(1, plannedMs - Math.max(0, downtimeMs));
  const availability = runMs / plannedMs;
  const idealMs = Math.max(1, record.idealCycleSec * 1000);
  const idealTimeMs = idealMs * record.totalCount;
  const performance = Math.min(1, idealTimeMs / runMs);
  const quality = record.totalCount > 0 ? record.goodCount / record.totalCount : 0;
  return {
    availability: clamp01(availability),
    performance: clamp01(performance),
    quality: clamp01(quality),
    oee: clamp01(availability * performance * quality),
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Neutralize Excel formula injection: leading =, +, -, @ becomes ' prefix. */
export function neutralizeExcelCell(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}
