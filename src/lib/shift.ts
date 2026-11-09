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
  name: "Shift Pagi (07:00 - 16:20)",
  shortName: "Shift Pagi",
  code: "PAGI",
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
  name: "Shift Malam (22:00 - 06:00)",
  shortName: "Shift Malam",
  code: "MALAM",
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
  shortName: "Off Shift",
  code: "OFF",
  timeRange: "Non-Shift",
  startHour: 0,
  startMinute: 0,
  endHour: 0,
  endMinute: 0,
  badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  dotClass: "bg-slate-400",
};

export const FACTORY_SHIFTS: ShiftDefinition[] = [SHIFT_PAGI, SHIFT_MALAM];

/**
 * Determine the active shift for any timestamp in plant time zone (Asia/Jakarta, WIB, UTC+7).
 * Shift Pagi: 07:00 - 16:20 WIB (420 min to 980 min)
 * Shift Malam: 22:00 - 06:00 WIB (>= 1320 min or <= 360 min)
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

    // 07:00 (420) to 16:20 (980)
    if (totalMin >= 420 && totalMin <= 980) {
      return SHIFT_PAGI;
    }

    // 22:00 (1320) to 06:00 (360)
    if (totalMin >= 1320 || totalMin <= 360) {
      return SHIFT_MALAM;
    }

    // Overtime after Shift Pagi (up to 18:30)
    if (totalMin > 980 && totalMin < 1110) {
      return {
        ...SHIFT_PAGI,
        name: "Shift Pagi (OT)",
        shortName: "Shift Pagi (OT)",
      };
    }

    return SHIFT_OTHER;
  } catch {
    return SHIFT_PAGI;
  }
}

/**
 * Resolve shift for a LineStop (checks stop.shiftId first, then falls back to stop.startMs)
 */
export function getShiftForStop(
  stop?: { shiftId?: string | undefined; startMs?: number | undefined } | null
): ShiftDefinition {
  try {
    if (!stop || typeof stop !== "object") {
      return SHIFT_PAGI;
    }
    if (stop.shiftId === "shift-pagi" || stop.shiftId === "shift-1") {
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
