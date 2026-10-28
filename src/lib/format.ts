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

const dateShortFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLANT_TZ,
  day: "2-digit",
  month: "short",
});

export function fmtTime(ms: number): string {
  return timeFmt.format(new Date(ms));
}

export function fmtTimeShort(ms: number): string {
  return timeShortFmt.format(new Date(ms));
}

export function fmtDateKey(ms: number): string {
  return dateFmt.format(new Date(ms));
}

export function fmtDateHuman(ms: number): string {
  return dateHumanFmt.format(new Date(ms));
}

export function fmtDateShort(ms: number): string {
  return dateShortFmt.format(new Date(ms));
}

export function fmtDateTime(ms: number): string {
  return `${fmtDateShort(ms)} ${fmtTimeShort(ms)}`;
}

/** "1h 05m" / "45m 12s" style compact duration, locale-neutral. */
export function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function fmtMinutes(ms: number): string {
  return `${Math.round(ms / 60_000)} min`;
}

/** Local datetime value for <input type="datetime-local"> in plant time. */
export function toLocalInputValue(ms: number): string {
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
}

/** Parse a datetime-local string as WIB wall time → epoch ms. */
export function fromLocalInputValue(value: string): number {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m;
  // WIB is UTC+7, no DST.
  return Date.UTC(+y, +mo - 1, +d, +h - 7, +mi);
}

export function dayStartMs(ms: number): number {
  const key = fmtDateKey(ms);
  return Date.parse(`${key}T00:00:00+07:00`);
}

export function shiftOf(ms: number, shifts: Shift[]): Shift {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PLANT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? "0");
  const minutes = get("hour") * 60 + get("minute");
  const sorted = [...shifts].sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute));
  let current = sorted[sorted.length - 1];
  for (const s of sorted) {
    if (s.startHour * 60 + s.startMinute <= minutes) current = s;
  }
  return current;
}

export function sortStops(stops: LineStop[]): LineStop[] {
  return [...stops].sort((a, b) => b.startMs - a.startMs);
}
