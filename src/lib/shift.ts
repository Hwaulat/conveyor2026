// Shift definition & resolution utilities for PT. Krama Yudha Ratu Motor Indonesia
// Operational model:
// Shift Pagi: 07:00 — 16:20 WIB (9 hours 20 minutes)
// Shift Malam: 22:00 — 06:00 WIB (8 hours)

export interface ShiftDefinition {
  id: "shift-pagi" | "shift-malam" | "other";
  name: string;
  shortName: string;
  code: string;
  timeRange: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  badgeClass: string;
  dotClass: string;
}

export const SHIFT_PAGI: ShiftDefinition = {
  id: "shift-pagi",
  name: "Shift Pagi (Morning)",
  shortName: "Morning",
  code: "MORNING",
  timeRange: "07:00 — 16:20",
  startHour: 7,
  startMinute: 0,
  endHour: 16,
  endMinute: 20,
  badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  dotClass: "bg-sky-500",
};

export const SHIFT_MALAM: ShiftDefinition = {
  id: "shift-malam",
  name: "Shift Malam (Night)",
  shortName: "Night",
  code: "NIGHT",
  timeRange: "22:00 — 06:00",
  startHour: 22,
  startMinute: 0,
  endHour: 6,
  endMinute: 0,
  badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  dotClass: "bg-indigo-500",
};

export const SHIFT_OTHER: ShiftDefinition = {
  id: "other",
  name: "Overtime / Off Shift",
  shortName: "Morning",
  code: "MORNING",
  timeRange: "Non-Shift",
  startHour: 0,
  startMinute: 0,
  endHour: 0,
  endMinute: 0,
  badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  dotClass: "bg-sky-500",
};

export const FACTORY_SHIFTS: ShiftDefinition[] = [SHIFT_PAGI, SHIFT_MALAM];

/**
 * Determine the active shift for any timestamp in plant time zone (Asia/Jakarta, WIB, UTC+7).
 * Strictly maps into ONLY 2 operational shifts:
 * - Morning: Day operational hours (including Shift Pagi & OT, 06:00 - 20:00)
 * - Night: Night operational hours (Shift Malam, 20:00 - 06:00)
 *
 * Uses deterministic UTC+7 arithmetic — 100% resilient across SSR, Node, and browser environments.
 */
export function getShiftForTimestamp(ms?: number | null): ShiftDefinition {
  try {
    const validMs = typeof ms === "number" && !isNaN(ms) && isFinite(ms) ? ms : Date.now();
    // WIB is UTC+7 with no daylight saving time (offset +7 hours = +25,200,000 ms)
    const wibDate = new Date(validMs + 25_200_000);
    const h = wibDate.getUTCHours();
    const m = wibDate.getUTCMinutes();
    const totalMin = h * 60 + m;

    // Day/Morning operational window: 06:00 (360) to 20:00 (1200) -> Morning (Shift Pagi & OT)
    if (totalMin >= 360 && totalMin < 1200) {
      return SHIFT_PAGI;
    }

    // Night operational window: 20:00 to 06:00 -> Night (Shift Malam)
    return SHIFT_MALAM;
  } catch {
    return SHIFT_PAGI;
  }
}

/**
 * Resolve shift for a LineStop (checks stop.shiftId first, then falls back to stop.startMs)
 * Always resolves strictly to either Morning or Night.
 */
export function getShiftForStop(
  stop?: { shiftId?: string | undefined; startMs?: number | undefined } | null
): ShiftDefinition {
  try {
    if (!stop || typeof stop !== "object") {
      return SHIFT_PAGI;
    }
    if (stop.shiftId === "shift-pagi" || stop.shiftId === "shift-1" || stop.shiftId === "shift-2") {
      return SHIFT_PAGI;
    }
    if (stop.shiftId === "shift-malam" || stop.shiftId === "shift-3") {
      return SHIFT_MALAM;
    }
    const ms = typeof stop.startMs === "number" && !isNaN(stop.startMs) ? stop.startMs : Date.now();
    return getShiftForTimestamp(ms);
  } catch {
    return SHIFT_PAGI;
  }
}
