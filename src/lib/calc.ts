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

// ---- OEE (from Production records) ----

export type OeeResult = {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  oee: number; // 0..1
};

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
