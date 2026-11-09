// Time & duration formatting helpers. Plant time zone is WIB (Asia/Jakarta).
import type { LineStop, Shift } from "./types";

export const PLANT_TZ = "Asia/Jakarta";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const timeShortFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLANT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateHumanFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateFullHumanFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const dateShortFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  day: "2-digit",
  month: "short",
});

function isValidMs(ms: unknown): ms is number {
  return typeof ms === "number" && !isNaN(ms) && isFinite(ms);
}

export function fmtTime(ms: number): string {
  if (!isValidMs(ms)) return "00:00:00";
  try {
    return timeFmt.format(new Date(ms));
  } catch {
    return "00:00:00";
  }
}

export function fmtTimeShort(ms: number): string {
  if (!isValidMs(ms)) return "00:00";
  try {
    return timeShortFmt.format(new Date(ms));
  } catch {
    return "00:00";
  }
}

export function fmtDateKey(ms: number): string {
  if (!isValidMs(ms)) return "1970-01-01";
  try {
    return dateFmt.format(new Date(ms));
  } catch {
    return "1970-01-01";
  }
}

export function fmtDateHuman(ms: number): string {
  if (!isValidMs(ms)) return "—";
  try {
    return dateHumanFmt.format(new Date(ms));
  } catch {
    return "—";
  }
}

export function fmtDateFullHuman(ms: number): string {
  if (!isValidMs(ms)) return "—";
  try {
    return dateFullHumanFmt.format(new Date(ms));
  } catch {
    return "—";
  }
}

export function fmtDateShort(ms: number): string {
  if (!isValidMs(ms)) return "—";
  try {
    return dateShortFmt.format(new Date(ms));
  } catch {
    return "—";
  }
}

export function fmtDateTime(ms: number): string {
  if (!isValidMs(ms)) return "—";
  return `${fmtDateShort(ms)} ${fmtTimeShort(ms)}`;
}

export function fmtDateTimeFull(ms: number): string {
  if (!isValidMs(ms)) return "—";
  return `${fmtDateFullHuman(ms)}, ${fmtTimeShort(ms)}`;
}

/** "1h 05m" / "45m 12s" style compact duration, locale-neutral. */
export function fmtDuration(ms: number): string {
  if (!isValidMs(ms)) return "0s";
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function fmtMinutes(ms: number): string {
  if (!isValidMs(ms)) return "0 min";
  return `${Math.round(ms / 60_000)} min`;
}

/** Local datetime value for <input type="datetime-local"> in plant time. */
export function toLocalInputValue(ms: number): string {
  if (!isValidMs(ms)) return "";
  try {
    const d = new Date(ms);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: PLANT_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

/** Parse a datetime-local string as WIB wall time → epoch ms. */
export function fromLocalInputValue(value: string): number {
  if (!value || typeof value !== "string") return NaN;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m;
  if (!y || !mo || !d || !h || !mi) return NaN;
  // WIB is UTC+7, no DST.
  return Date.UTC(+y, +mo - 1, +d, +h - 7, +mi);
}

export function dayStartMs(ms: number): number {
  const key = fmtDateKey(ms);
  return Date.parse(`${key}T00:00:00+07:00`);
}

export function shiftOf(ms: number, shifts?: Shift[]): Shift {
  try {
    const validMs = isValidMs(ms) ? ms : Date.now();
    const wibDate = new Date(validMs + 25_200_000);
    const minutes = wibDate.getUTCHours() * 60 + wibDate.getUTCMinutes();
    const list = Array.isArray(shifts) ? shifts : [];
    const sorted = [...list].sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute));
    if (sorted.length === 0) {
      return { id: "shift-default", name: "Shift 1", startHour: 7, startMinute: 0 };
    }
    let current: Shift | undefined = sorted[sorted.length - 1];
    for (const s of sorted) {
      if (s.startHour * 60 + s.startMinute <= minutes) current = s;
    }
    return current ?? sorted[0]!;
  } catch {
    return { id: "shift-default", name: "Shift 1", startHour: 7, startMinute: 0 };
  }
}

export function sortStops(stops: LineStop[]): LineStop[] {
  return [...stops].sort((a, b) => b.startMs - a.startMs);
}
