import { useState, useMemo } from "react";
import { Clock } from "lucide-react";
import { useAppStore } from "../lib/store";
import { getShiftForTimestamp } from "../lib/shift";
import { Switch } from "./ui/switch";

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
  const currentShift = useMemo(() => getShiftForTimestamp(Date.now()), []);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>("pagi-ev-1");
  const [activeShift, setActiveShift] = useState<"pagi" | "malam">(() => {
    return currentShift?.id === "shift-malam" ? "malam" : "pagi";
  });

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
        startMinutes: 42,
        durationMin: 13,
        category: SHIFT_CATEGORIES[0]!,
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
        startMinutes: 90,
        durationMin: 15,
        category: SHIFT_CATEGORIES[2]!,
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
        startMinutes: 270,
        durationMin: 15,
        category: SHIFT_CATEGORIES[3]!,
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
        startMinutes: 430,
        durationMin: 12,
        category: SHIFT_CATEGORIES[5]!,
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
        startMinutes: 550,
        durationMin: 10,
        category: SHIFT_CATEGORIES[0]!,
        isOpen: true,
        note: "Clamp release sensor check",
      },
    ];

    const filteredEvents = rawEvents.filter((ev) => {
      const matchArea = selectedAreaId === "all" ? true : ev.areaId === selectedAreaId;
      const matchStation = selectedStationId === "all" ? true : ev.stationId === selectedStationId;
      return matchArea && matchStation;
    });

    if (selectedAreaId === "all") {
      const laneCodes = ["PC-13", "PC-15", "PC-12", "PC-14"];
      return laneCodes.map((code) => ({
        code,
        name: rawEvents.find((e) => e.stationCode === code)?.stationName || code,
        events: filteredEvents.filter((e) => e.stationCode === code),
      }));
    }

    const areaStations = appState.stations.filter((s) => s.areaId === selectedAreaId);
    const targetStations = selectedStationId === "all"
      ? areaStations
      : areaStations.filter((s) => s.id === selectedStationId);

    const STATION_CODE_MAP: Record<string, string> = {
      "st-sand-1": "PC-10",
      "st-sand-2": "PC-13",
      "st-seal-1": "PC-12",
      "st-seal-2": "PC-15",
      "st-seal-3": "PC-14",
      "st-tc-1": "PC-11",
    };

    return targetStations.map((st) => {
      const displayCode = STATION_CODE_MAP[st.id] ?? st.code ?? st.id;
      return {
        code: displayCode,
        name: st.name,
        events: filteredEvents.filter((e) => e.stationId === st.id || e.stationCode === displayCode),
      };
    });
  }, [selectedAreaId, selectedStationId, appState.stations]);

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
        startMinutes: 80,
        durationMin: 8,
        category: SHIFT_CATEGORIES[4]!,
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
        startMinutes: 160,
        durationMin: 12,
        category: SHIFT_CATEGORIES[1]!,
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
        startMinutes: 270,
        durationMin: 10,
        category: SHIFT_CATEGORIES[0]!,
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
        startMinutes: 435,
        durationMin: 6,
        category: SHIFT_CATEGORIES[5]!,
        note: "Line handover cleaning procedure",
      },
    ];

    const filteredEvents = rawEvents.filter((ev) => {
      const matchArea = selectedAreaId === "all" ? true : ev.areaId === selectedAreaId;
      const matchStation = selectedStationId === "all" ? true : ev.stationId === selectedStationId;
      return matchArea && matchStation;
    });

    if (selectedAreaId === "all") {
      const laneCodes = ["PC-11", "PC-12", "PC-10", "PC-14"];
      return laneCodes.map((code) => ({
        code,
        name: rawEvents.find((e) => e.stationCode === code)?.stationName || code,
        events: filteredEvents.filter((e) => e.stationCode === code),
      }));
    }

    const areaStations = appState.stations.filter((s) => s.areaId === selectedAreaId);
    const targetStations = selectedStationId === "all"
      ? areaStations
      : areaStations.filter((s) => s.id === selectedStationId);

    const STATION_CODE_MAP: Record<string, string> = {
      "st-sand-1": "PC-10",
      "st-sand-2": "PC-13",
      "st-seal-1": "PC-12",
      "st-seal-2": "PC-15",
      "st-seal-3": "PC-14",
      "st-tc-1": "PC-11",
    };

    return targetStations.map((st) => {
      const displayCode = STATION_CODE_MAP[st.id] ?? st.code ?? st.id;
      return {
        code: displayCode,
        name: st.name,
        events: filteredEvents.filter((e) => e.stationId === st.id || e.stationCode === displayCode),
      };
    });
  }, [selectedAreaId, selectedStationId, appState.stations]);

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

  const currentStations = activeShift === "pagi" ? pagiStations : malamStations;
  const currentTotalMinutes = activeShift === "pagi" ? pagiTotalMinutes : malamTotalMinutes;
  const currentTotalEvents = activeShift === "pagi" ? pagiTotalEvents : malamTotalEvents;
  const currentTicks = activeShift === "pagi" ? PAGI_TICKS : MALAM_TICKS;
  const currentSpanMin = activeShift === "pagi" ? PAGI_SPAN_MIN : MALAM_SPAN_MIN;

  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 shadow-xs space-y-4 ${className}`}
    >
      {/* 1. Header Row (Sejajar dengan Title & Total Downtime) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wide">
              Downtime Shift Timeline
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click downtime block or log to complete the line-stop form
            </p>
          </div>
        </div>

        {/* Right: Active Shift Total Downtime (Sejajar dengan Title, tanpa events) */}
        <div className="flex items-center gap-2 font-mono text-xs shrink-0 self-start sm:self-center">
          <div className="px-3.5 py-1.5 rounded-lg border border-border bg-muted/40 flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] font-medium uppercase">
              Total Downtime:
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-500 text-sm">
              {currentTotalMinutes}m
            </span>
          </div>
        </div>
      </div>

      {/* 2. Control Bar Row: Switch Toggle Morning / Night */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        {/* Switch Toggle (Morning <-> Night) */}
        <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl border border-border bg-muted/30 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveShift("pagi")}
            className={`text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeShift === "pagi"
                ? "text-sky-600 dark:text-sky-400 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-transform ${
                activeShift === "pagi" ? "bg-sky-500 ring-2 ring-sky-500/20" : "bg-muted-foreground/30"
              }`}
            />
            <span>Morning</span>
            <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">(07:00–16:20)</span>
          </button>

          <Switch
            checked={activeShift === "malam"}
            onCheckedChange={(checked) => setActiveShift(checked ? "malam" : "pagi")}
            aria-label="Toggle Morning / Night"
            className="cursor-pointer data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-sky-500"
          />

          <button
            type="button"
            onClick={() => setActiveShift("malam")}
            className={`text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeShift === "malam"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-transform ${
                activeShift === "malam" ? "bg-indigo-500 ring-2 ring-indigo-500/20" : "bg-muted-foreground/30"
              }`}
            />
            <span>Night</span>
            <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">(22:00–06:00)</span>
          </button>
        </div>
      </div>

      {/* 3. Single Shift Panel (Hanya 1 shift ditampilkan sesuai switch toggle) */}
      <div className="space-y-3 pt-1">
        {/* Timeline Chart Container */}
        <div className="space-y-1.5">
          {/* Time Ticks */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-12 sm:w-14 shrink-0" />
            <div className="flex-1 relative h-3.5">
              {currentTicks.map((tick, idx, arr) => (
                <span
                  key={tick.label}
                  style={{ left: `${tick.pct}%` }}
                  className={`absolute top-0 text-[10px] font-mono text-muted-foreground whitespace-nowrap ${
                    idx === 0
                      ? "translate-x-0"
                      : idx === arr.length - 1
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
          <div className="space-y-1.5">
            {currentStations.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-muted-foreground rounded border border-dashed border-border">
                No station line-stops in this area during {activeShift === "pagi" ? "Morning" : "Night"}
              </div>
            ) : (
              currentStations.map((station) => (
                <div key={station.code} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className="w-12 sm:w-14 shrink-0 text-xs font-mono font-medium text-foreground truncate"
                    title={station.name}
                  >
                    {station.code}
                  </span>

                  <div className="flex-1 h-7 sm:h-8 bg-muted/30 rounded border border-border/70 relative">
                    {currentTicks.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute top-0 bottom-0 border-l border-border/40 pointer-events-none"
                        style={{ left: `${tick.pct}%` }}
                      />
                    ))}

                    {station.events.map((ev) => {
                      const left = Math.max(0, Math.min(98.5, (ev.startMinutes / currentSpanMin) * 100));
                      const width = Math.max(2.2, Math.min(100 - left, (ev.durationMin / currentSpanMin) * 100));
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
                          ></button>

                          {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 px-2.5 py-1.5 rounded bg-popover text-popover-foreground text-[11px] font-mono shadow-xl border border-border whitespace-nowrap pointer-events-none">
                              <span>{ev.startTimeStr}–{ev.endTimeStr}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span className="font-semibold">{ev.category.name}</span>
                              <span className="mx-1.5 opacity-60">·</span>
                              <span>{ev.durationMin} min</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
