import { useState, useMemo } from "react";
import { Clock } from "lucide-react";
import { useAppStore } from "../lib/store";
import type { LineStop } from "../lib/types";
import { getShiftForTimestamp } from "../lib/shift";

export interface ShiftCategory {
  id: string;
  name: string;
  color: string;
}

export const SHIFT_CATEGORIES: ShiftCategory[] = [
  { id: "emergency", name: "Emergency Stop", color: "#ef4444" },
  { id: "equipment", name: "Equipment Fault", color: "#f97316" },
  { id: "blocked", name: "Downstream Blocked", color: "#eab308" },
  { id: "material", name: "Material", color: "#a855f7" },
  { id: "quality", name: "Quality", color: "#06b6d4" },
  { id: "process", name: "Process", color: "#84cc16" },
];

export interface TimelineEvent {
  id: string;
  stationCode: string;
  stationName: string;
  stationId: string;
  areaId: string;
  startTimeStr: string;
  endTimeStr: string;
  startMinutes: number; // for shift pagi: minutes from 07:00 (0..560), for shift malam: minutes from 22:00 (0..480)
  durationMin: number;
  category: ShiftCategory;
  isOpen?: boolean;
  note?: string;
}

interface StationLane {
  code: string;
  name: string;
  events: TimelineEvent[];
}

const PAGI_TICKS = [
  { label: "07:00", pct: 0 },
  { label: "09:00", pct: 21.43 },
  { label: "11:00", pct: 42.86 },
  { label: "13:00", pct: 64.29 },
  { label: "15:00", pct: 85.71 },
  { label: "16:20", pct: 100 },
];

const MALAM_TICKS = [
  { label: "22:00", pct: 0 },
  { label: "00:00", pct: 25 },
  { label: "02:00", pct: 50 },
  { label: "04:00", pct: 75 },
  { label: "06:00", pct: 100 },
];

const PAGI_START_MIN = 7 * 60; // 420
const PAGI_SPAN_MIN = 16 * 60 + 20 - 420; // 560 min (07:00 - 16:20)
const MALAM_SPAN_MIN = 8 * 60; // 480 min (22:00 - 06:00)

interface DowntimeShiftTimelineProps {
  selectedAreaId?: string;
  selectedStationId?: string;
  className?: string;
}

export function DowntimeShiftTimeline({
  selectedAreaId = "all",
  selectedStationId = "all",
  className = "",
}: DowntimeShiftTimelineProps) {
  const appState = useAppStore();
  const [hoveredEventId, setHoveredEventId] = useState<string | null>("pagi-ev-1");
  const currentShift = useMemo(() => getShiftForTimestamp(Date.now()), []);

  // Handler on clicking block -> opens E-Form
  const handleEventClick = (ev: TimelineEvent) => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams({
        areaId: ev.areaId || "area-sanding",
        stationId: ev.stationId || "st-sand-2",
      });
      window.location.href = `/web/station-live/e-form?${sp.toString()}`;
    }
  };

  // 1. Shift Pagi Data: 07:00 - 16:20 (5 events, 65m)
  const pagiStations = useMemo<StationLane[]>(() => {
    const rawEvents: TimelineEvent[] = [
      {
        id: "pagi-ev-1",
        stationCode: "PC-13",
        stationName: "Sanding Roof",
        stationId: "st-sand-2",
        areaId: "area-sanding",
        startTimeStr: "07:42",
        endTimeStr: "07:55",
        startMinutes: 42, // (7*60 + 42) - 420 = 42
        durationMin: 13,
        category: SHIFT_CATEGORIES[0]!, // Emergency Stop (Red)
        note: "Emergency Stop triggered: carrier alignment alert",
      },
      {
        id: "pagi-ev-2",
        stationCode: "PC-15",
        stationName: "Undercoat",
        stationId: "st-seal-2",
        areaId: "area-sealing",
        startTimeStr: "08:30",
        endTimeStr: "08:45",
        startMinutes: 90, // (8*60 + 30) - 420 = 90
        durationMin: 15,
        category: SHIFT_CATEGORIES[2]!, // Downstream Blocked (Yellow)
        note: "Full cabin sensor trigger",
      },
      {
        id: "pagi-ev-3",
        stationCode: "PC-12",
        stationName: "Underseal",
        stationId: "st-seal-1",
        areaId: "area-sealing",
        startTimeStr: "11:30",
        endTimeStr: "11:45",
        startMinutes: 270, // (11*60 + 30) - 420 = 270
        durationMin: 15,
        category: SHIFT_CATEGORIES[3]!, // Material (Purple)
        note: "Sealing compound batch replenishment",
      },
      {
        id: "pagi-ev-4",
        stationCode: "PC-14",
        stationName: "Transfer Cabin Sealing",
        stationId: "st-seal-3",
        areaId: "area-sealing",
        startTimeStr: "14:10",
        endTimeStr: "14:22",
        startMinutes: 430, // (14*60 + 10) - 420 = 430
        durationMin: 12,
        category: SHIFT_CATEGORIES[5]!, // Process (Green)
        note: "Manual masking seam process check",
      },
      {
        id: "pagi-ev-5",
        stationCode: "PC-13",
        stationName: "Sanding Roof",
        stationId: "st-sand-2",
        areaId: "area-sanding",
        startTimeStr: "16:10",
        endTimeStr: "16:20",
        startMinutes: 550, // (16*60 + 10) - 420 = 550
        durationMin: 10,
        category: SHIFT_CATEGORIES[0]!, // Emergency Stop (Red - ongoing/end)
        isOpen: true,
        note: "Clamp release sensor check",
      },
    ];

    const laneCodes = ["PC-13", "PC-15", "PC-12", "PC-14"];
    return laneCodes.map((code) => ({
      code,
      name: rawEvents.find((e) => e.stationCode === code)?.stationName || code,
      events: rawEvents.filter((e) => e.stationCode === code),
    }));
  }, []);

  // 2. Shift Malam Data: 22:00 - 06:00 (4 events, 36m)
  const malamStations = useMemo<StationLane[]>(() => {
    const rawEvents: TimelineEvent[] = [
      {
        id: "malam-ev-1",
        stationCode: "PC-11",
        stationName: "Transfer Cabin Touch Up",
        stationId: "st-tc-1",
        areaId: "area-topcoat",
        startTimeStr: "23:20",
        endTimeStr: "23:28",
        startMinutes: 80, // 22:00 to 23:20 = 80 min
        durationMin: 8,
        category: SHIFT_CATEGORIES[4]!, // Quality (Cyan)
        note: "Surface finish inspection rework",
      },
      {
        id: "malam-ev-2",
        stationCode: "PC-12",
        stationName: "Underseal",
        stationId: "st-seal-1",
        areaId: "area-sealing",
        startTimeStr: "00:40",
        endTimeStr: "00:52",
        startMinutes: 160, // 22:00 to 00:40 = 160 min
        durationMin: 12,
        category: SHIFT_CATEGORIES[1]!, // Equipment Fault (Orange)
        note: "Drive sprocket chain tensioner adjustment",
      },
      {
        id: "malam-ev-3",
        stationCode: "PC-10",
        stationName: "Sanding Outer",
        stationId: "st-sand-1",
        areaId: "area-sanding",
        startTimeStr: "02:30",
        endTimeStr: "02:40",
        startMinutes: 270, // 22:00 to 02:30 = 270 min
        durationMin: 10,
        category: SHIFT_CATEGORIES[0]!, // Emergency Stop (Red)
        note: "Interlock safety gate switch trip",
      },
      {
        id: "malam-ev-4",
        stationCode: "PC-14",
        stationName: "Transfer Cabin Sealing",
        stationId: "st-seal-3",
        areaId: "area-sealing",
        startTimeStr: "05:15",
        endTimeStr: "05:21",
        startMinutes: 435, // 22:00 to 05:15 = 435 min
        durationMin: 6,
        category: SHIFT_CATEGORIES[5]!, // Process (Green)
        note: "Line handover cleaning procedure",
      },
    ];

    const laneCodes = ["PC-11", "PC-12", "PC-10", "PC-14"];
    return laneCodes.map((code) => ({
      code,
      name: rawEvents.find((e) => e.stationCode === code)?.stationName || code,
      events: rawEvents.filter((e) => e.stationCode === code),
    }));
  }, []);

  const pagiTotalMinutes = useMemo(() => {
    return pagiStations.reduce(
      (sum, lane) => sum + lane.events.reduce((s, ev) => s + ev.durationMin, 0),
      0
    );
  }, [pagiStations]);

  const pagiTotalEvents = useMemo(() => {
    return pagiStations.reduce((sum, lane) => sum + lane.events.length, 0);
  }, [pagiStations]);

  const malamTotalMinutes = useMemo(() => {
    return malamStations.reduce(
      (sum, lane) => sum + lane.events.reduce((s, ev) => s + ev.durationMin, 0),
      0
    );
  }, [malamStations]);

  const malamTotalEvents = useMemo(() => {
    return malamStations.reduce((sum, lane) => sum + lane.events.length, 0);
  }, [malamStations]);

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] p-4 sm:p-6 shadow-xs space-y-5 ${className}`}
    >
      {/* 1. Header Row: Yellow Clock Icon, Title & Subtitle on Left, Category Legends on Right */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#152a47]">
        {/* Left: Amber Clock Box + Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500 flex items-center justify-center text-zinc-950 font-bold shrink-0 shadow-xs">
            <Clock className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-sans tracking-wide text-slate-900 dark:text-white uppercase">
              DOWNTIME SHIFT TIMELINE
            </h2>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 dark:text-zinc-400 uppercase tracking-wider mt-0.5 font-medium">
              CLICK A DOWNTIME BLOCK OR LOG TO COMPLETE THE LINE-STOP FORM
            </p>
          </div>
        </div>

        {/* Right: Legends matching the 6 categories in screenshot */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
          {SHIFT_CATEGORIES.map((cat) => (
            <div key={cat.id} className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-[2px] shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-slate-600 dark:text-zinc-300 text-[11px] font-medium whitespace-nowrap">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Two Shift Columns: Shift Pagi (07:00 - 16:20) and Shift Malam (22:00 - 06:00) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-100 dark:divide-[#152a47] gap-6 xl:gap-8 pt-1">
        {/* Left Panel: SHIFT PAGI */}
        <div className="space-y-4">
          {/* Shift Header & KPI */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sky-500 dark:text-sky-400 font-mono text-[11px] font-bold tracking-wider uppercase block">
                  SHIFT PAGI
                </span>
                {currentShift.id === "shift-pagi" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE NOW
                  </span>
                )}
              </div>
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white block mt-0.5">
                07:00 — 16:20
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-red-600 dark:text-red-500 block leading-tight">
                {pagiTotalMinutes}m
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500 font-semibold block tracking-wider mt-0.5">
                {pagiTotalEvents} EVENTS
              </span>
            </div>
          </div>

          {/* Timeline Chart Container */}
          <div className="space-y-2 pt-1">
            {/* Time Ticks */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-12 sm:w-14 shrink-0" />
              <div className="flex-1 relative h-4">
                {PAGI_TICKS.map((tick, idx) => (
                  <span
                    key={tick.label}
                    style={{ left: `${tick.pct}%` }}
                    className={`absolute top-0 text-[10px] sm:text-[11px] font-mono text-slate-400 dark:text-zinc-400 whitespace-nowrap ${
                      idx === 0
                        ? "translate-x-0"
                        : idx === PAGI_TICKS.length - 1
                        ? "-translate-x-full"
                        : "-translate-x-1/2"
                    }`}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Station Lanes */}
            <div className="space-y-2">
              {pagiStations.map((station) => (
                <div key={station.code} className="flex items-center gap-2 sm:gap-3">
                  {/* Station Code */}
                  <span className="w-12 sm:w-14 shrink-0 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 truncate">
                    {station.code}
                  </span>

                  {/* Lane Track */}
                  <div className="flex-1 h-8 sm:h-9 bg-slate-50/80 dark:bg-[#121c2d] rounded border border-slate-100 dark:border-[#152a47] relative">
                    {/* Vertical Gridlines */}
                    {PAGI_TICKS.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute top-0 bottom-0 border-l border-slate-200/50 dark:border-[#152a47]/70 pointer-events-none"
                        style={{ left: `${tick.pct}%` }}
                      />
                    ))}

                    {/* Event Blocks */}
                    {station.events.map((ev) => {
                      const left = Math.max(0, Math.min(98.5, (ev.startMinutes / PAGI_SPAN_MIN) * 100));
                      const width = Math.max(2.2, Math.min(100 - left, (ev.durationMin / PAGI_SPAN_MIN) * 100));
                      const isHovered = hoveredEventId === ev.id;

                      return (
                        <div
                          key={ev.id}
                          className="absolute top-1 bottom-1"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <button
                            type="button"
                            onClick={() => handleEventClick(ev)}
                            onMouseEnter={() => setHoveredEventId(ev.id)}
                            onMouseLeave={() => setHoveredEventId(null)}
                            style={{ backgroundColor: ev.category.color }}
                            className={`w-full h-full rounded-[2px] cursor-pointer transition-transform hover:scale-y-110 shadow-2xs ${
                              ev.isOpen ? "opacity-75" : ""
                            }`}
                            title={`${ev.startTimeStr}–${ev.endTimeStr} · ${ev.category.name} · ${ev.durationMin} min`}
                          />

                          {/* Hover Tooltip styled exactly like screenshot */}
                          {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 px-2.5 py-1.5 rounded bg-zinc-900 dark:bg-zinc-950 text-white text-[11px] font-mono shadow-xl border border-white/10 whitespace-nowrap pointer-events-none">
                              <span>{ev.startTimeStr}–{ev.endTimeStr}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span className="font-semibold text-white">{ev.category.name}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span>{ev.durationMin} min</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-950" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: SHIFT MALAM */}
        <div className="space-y-4 xl:pl-8 pt-6 xl:pt-0">
          {/* Shift Header & KPI */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 font-mono text-[11px] font-bold tracking-wider uppercase block">
                  SHIFT MALAM
                </span>
                {currentShift.id === "shift-malam" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE NOW
                  </span>
                )}
              </div>
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white block mt-0.5">
                22:00 — 06:00
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-red-600 dark:text-red-500 block leading-tight">
                {malamTotalMinutes}m
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-zinc-500 font-semibold block tracking-wider mt-0.5">
                {malamTotalEvents} EVENTS
              </span>
            </div>
          </div>

          {/* Timeline Chart Container */}
          <div className="space-y-2 pt-1">
            {/* Time Ticks */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-12 sm:w-14 shrink-0" />
              <div className="flex-1 relative h-4">
                {MALAM_TICKS.map((tick, idx) => (
                  <span
                    key={tick.label}
                    style={{ left: `${tick.pct}%` }}
                    className={`absolute top-0 text-[10px] sm:text-[11px] font-mono text-slate-400 dark:text-zinc-400 whitespace-nowrap ${
                      idx === 0
                        ? "translate-x-0"
                        : idx === MALAM_TICKS.length - 1
                        ? "-translate-x-full"
                        : "-translate-x-1/2"
                    }`}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Station Lanes */}
            <div className="space-y-2">
              {malamStations.map((station) => (
                <div key={station.code} className="flex items-center gap-2 sm:gap-3">
                  {/* Station Code */}
                  <span className="w-12 sm:w-14 shrink-0 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 truncate">
                    {station.code}
                  </span>

                  {/* Lane Track */}
                  <div className="flex-1 h-8 sm:h-9 bg-slate-50/80 dark:bg-[#121c2d] rounded border border-slate-100 dark:border-[#152a47] relative">
                    {/* Vertical Gridlines */}
                    {MALAM_TICKS.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute top-0 bottom-0 border-l border-slate-200/50 dark:border-[#152a47]/70 pointer-events-none"
                        style={{ left: `${tick.pct}%` }}
                      />
                    ))}

                    {/* Event Blocks */}
                    {station.events.map((ev) => {
                      const left = Math.max(0, Math.min(98.5, (ev.startMinutes / MALAM_SPAN_MIN) * 100));
                      const width = Math.max(2.2, Math.min(100 - left, (ev.durationMin / MALAM_SPAN_MIN) * 100));
                      const isHovered = hoveredEventId === ev.id;

                      return (
                        <div
                          key={ev.id}
                          className="absolute top-1 bottom-1"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <button
                            type="button"
                            onClick={() => handleEventClick(ev)}
                            onMouseEnter={() => setHoveredEventId(ev.id)}
                            onMouseLeave={() => setHoveredEventId(null)}
                            style={{ backgroundColor: ev.category.color }}
                            className={`w-full h-full rounded-[2px] cursor-pointer transition-transform hover:scale-y-110 shadow-2xs ${
                              ev.isOpen ? "opacity-75" : ""
                            }`}
                            title={`${ev.startTimeStr}–${ev.endTimeStr} · ${ev.category.name} · ${ev.durationMin} min`}
                          />

                          {/* Hover Tooltip styled exactly like screenshot */}
                          {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 px-2.5 py-1.5 rounded bg-zinc-900 dark:bg-zinc-950 text-white text-[11px] font-mono shadow-xl border border-white/10 whitespace-nowrap pointer-events-none">
                              <span>{ev.startTimeStr}–{ev.endTimeStr}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span className="font-semibold text-white">{ev.category.name}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span>{ev.durationMin} min</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-950" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

