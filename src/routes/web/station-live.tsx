import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  History,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import { fmtDuration, dayStartMs, fmtTimeShort } from "../../lib/format";
import { IpadEFormPage } from "../ipad";

export interface ConveyorAccordion {
  id: string;
  name: string;
  code: string;
  conveyorName: string;
  stationIds: string[];
}

export const CONVEYOR_ACCORDIONS: ConveyorAccordion[] = [
  {
    id: "acc-pted",
    name: "PTED -(Motrain Station)",
    code: "PTED",
    conveyorName: "Conveyor PTED Motrain Station",
    stationIds: ["st-pted-1", "st-pted-2", "st-pted-3", "st-pted-4", "st-pted-5", "st-pted-6"],
  },
  {
    id: "acc-pc14",
    name: "PC-14 (Oven CED)",
    code: "PC-14",
    conveyorName: "Conveyor PC-14 Oven CED",
    stationIds: ["st-pc14-1", "st-pc14-2", "st-pc14-3", "st-pc14-4", "st-pc14-5"],
  },
  {
    id: "acc-pc15",
    name: "PC-15 (Mezzanine)",
    code: "PC-15",
    conveyorName: "Conveyor PC-15 Mezzanine",
    stationIds: ["st-pc15-1", "st-pc15-2", "st-pc15-3", "st-pc15-4", "st-pc15-5"],
  },
  {
    id: "acc-pc13",
    name: "PC-13 (Sanding)",
    code: "PC-13",
    conveyorName: "Conveyor PC-13 Sanding",
    stationIds: ["st-sand-1", "st-sand-2", "st-seal-1", "st-seal-2", "st-seal-3"],
  },
  {
    id: "acc-pc10",
    name: "PC-10 (Sealing)",
    code: "PC-10",
    conveyorName: "Conveyor PC-10 Sealing Line",
    stationIds: ["st-seal-4", "st-seal-5", "st-seal-6"],
  },
  {
    id: "acc-pc11",
    name: "PC-11 (Cooling Both)",
    code: "PC-11",
    conveyorName: "Conveyor PC-11 Cooling Both",
    stationIds: ["st-cool-1", "st-tc-1"],
  },
  {
    id: "acc-pc12",
    name: "PC-12 (Topcoat 1 Both)",
    code: "PC-12",
    conveyorName: "Conveyor PC-12 Topcoat 1 Both",
    stationIds: ["st-tc-2", "st-tc-4", "st-tc-3", "st-tc-7", "st-tc-6", "st-tc-5"],
  },
  {
    id: "acc-pc12a",
    name: "PC-12A (Topcoat Branch A)",
    code: "PC-12A",
    conveyorName: "Conveyor PC-12A Topcoat Branch A",
    stationIds: ["st-tu-1"],
  },
  {
    id: "acc-pc12b",
    name: "PC-12B (Topcoat Branch B)",
    code: "PC-12B",
    conveyorName: "Conveyor PC-12B Topcoat Branch B",
    stationIds: ["st-tu-2"],
  },
];

const AREA_TO_LINE_MAP: Record<string, string> = {
  "area-pted": "acc-pted",
  "area-drop-ced": "acc-pted",
  "area-oven-ced": "acc-pc14",
  "area-mezzanine": "acc-pc15",
  "area-sanding": "acc-pc13",
  "area-sealing": "acc-pc10",
  "area-cooling-tunnel": "acc-pc11",
  "area-topcoat": "acc-pc12",
  "area-topcoat-branch-a": "acc-pc12a",
  "area-topcoat-branch-b": "acc-pc12b",
  "area-touch-up": "acc-pc12a",
};

export const Route = createFileRoute("/web/station-live")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string; lineId?: string } => {
    const res: { stationId?: string; areaId?: string; lineId?: string } = {};
    if (typeof search["stationId"] === "string" && search["stationId"]) res.stationId = search["stationId"];
    if (typeof search["areaId"] === "string" && search["areaId"]) res.areaId = search["areaId"];
    if (typeof search["lineId"] === "string" && search["lineId"]) res.lineId = search["lineId"];
    return res;
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Station Live Monitoring" },
      { name: "description", content: "Real-time Conveyor line station telemetry, speeds, and live status." },
    ],
  }),
  component: StationLivePage,
});

function StationLivePage() {
  const location = useLocation();
  const search = Route.useSearch();
  const isEForm =
    location.pathname.endsWith("/e-form") ||
    location.pathname.includes("/station-live/e-form") ||
    (typeof window !== "undefined" && window.location.pathname.includes("/e-form"));

  if (isEForm) {
    return <IpadEFormPage />;
  }

  const { t } = useI18n();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Realtime ticker every second for duration timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial accordion state: PC-10 (Sealing) open by default or matching search params
  const initialOpenLineId = useMemo(() => {
    if (search.lineId && CONVEYOR_ACCORDIONS.some((a) => a.id === search.lineId)) {
      return search.lineId;
    }
    if (search.stationId) {
      const match = CONVEYOR_ACCORDIONS.find((a) => a.stationIds.includes(search.stationId!));
      if (match) return match.id;
    }
    if (search.areaId && AREA_TO_LINE_MAP[search.areaId]) {
      return AREA_TO_LINE_MAP[search.areaId]!;
    }
    return "acc-pc13";
  }, [search.lineId, search.stationId, search.areaId]);

  // Accordion open/close state: PC-13 (has active stop) and PC-10 open by default
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => ({
    [initialOpenLineId]: true,
    "acc-pc13": true,
    "acc-pc10": true,
  }));

  const toggleAccordion = (id: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Status Panel : ON / OFF state per accordion
  const [panelStatuses, setPanelStatuses] = useState<Record<string, "ON" | "OFF">>({
    "acc-pted": "ON",
    "acc-pc14": "ON",
    "acc-pc15": "ON",
    "acc-pc13": "ON",
    "acc-pc10": "ON",
    "acc-pc11": "ON",
    "acc-pc12": "ON",
    "acc-pc12a": "ON",
    "acc-pc12b": "OFF",
  });

  const togglePanelStatus = (accId: string) => {
    setPanelStatuses((prev) => {
      const current = prev[accId] ?? "ON";
      return {
        ...prev,
        [accId]: current === "ON" ? "OFF" : "ON",
      };
    });
  };

  const activeStations = appState.stations;

  const runningCount = activeStations.filter(
    (s) => appState.stationLive[s.id]?.state === "running",
  ).length;

  const stoppedCount = activeStations.filter(
    (s) => appState.stationLive[s.id]?.state === "stopped",
  ).length;

  const stopsToday = useMemo(() => {
    const todayStart = dayStartMs(nowMs);
    return appState.stops.filter((s) => s.startMs >= todayStart);
  }, [appState.stops, nowMs]);

  const longestCurrentStopMs = useMemo(() => {
    let maxDur = 0;
    for (const s of activeStations) {
      const live = appState.stationLive[s.id];
      if (live?.state === "stopped" && live.stoppedSinceMs) {
        const dur = nowMs - live.stoppedSinceMs;
        if (dur > maxDur) maxDur = dur;
      }
    }
    return maxDur;
  }, [activeStations, appState.stationLive, nowMs]);

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          Station Live
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Real-time Conveyor line station telemetry, speeds, and live status.
        </p>
      </div>

      {/* Summary KPI Strip (4 Cards - Compact & Space-Saving) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. Stations Running */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 block">
              Stations Running
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {runningCount}
              </span>
              <span className="font-mono text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                / {activeStations.length}
              </span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        {/* 2. Stations Stopped */}
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${
            stoppedCount > 0
              ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-1 ring-red-500/50"
              : "border-border bg-card"
          }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Stations Stopped
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`font-mono text-xl sm:text-2xl font-black ${
                  stoppedCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                }`}
              >
                {stoppedCount}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {stoppedCount > 0 ? "EMERGENCY" : "Normal"}
              </span>
            </div>
          </div>
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              stoppedCount > 0
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <AlertTriangle className={`h-4 w-4 ${stoppedCount > 0 ? "animate-bounce" : ""}`} />
          </div>
        </div>

        {/* 3. Stops Today */}
        <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Line Stops Today
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-foreground">
                {stopsToday.length}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Occurrences</span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0">
            <AlertOctagon className="h-4 w-4" />
          </div>
        </div>

        {/* 4. Longest Current Stop */}
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${
            longestCurrentStopMs > 0
              ? "border-red-500/60 bg-red-500/10 dark:bg-red-950/30"
              : "border-border bg-card"
          }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Longest Active Stop
            </span>
            <div className="mt-0.5">
              <span
                className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${
                  longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                }`}
              >
                {longestCurrentStopMs > 0 ? fmtDuration(longestCurrentStopMs) : "—"}
              </span>
            </div>
          </div>
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              longestCurrentStopMs > 0
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Conveyor Line Accordions (9 Accordions matching plant specification) */}
      <div className="space-y-4">
        {CONVEYOR_ACCORDIONS.map((acc) => {
          const stationsInLine = appState.stations
            .filter((s) => acc.stationIds.includes(s.id))
            .sort((a, b) => a.sequence - b.sequence);

          const lineRunning = stationsInLine.filter(
            (s) => appState.stationLive[s.id]?.state === "running",
          ).length;
          const lineStopped = stationsInLine.filter(
            (s) => appState.stationLive[s.id]?.state === "stopped",
          ).length;
          const isOpen = Boolean(openAccordions[acc.id]);
          const panelStatus = panelStatuses[acc.id] ?? "ON";
          const isPanelOff = panelStatus === "OFF";

          return (
            <div
              key={acc.id}
              className={`rounded-2xl border-2 transition-all shadow-xs overflow-hidden ${
                lineStopped > 0
                  ? "border-red-600 dark:border-red-500 bg-red-500/5 dark:bg-red-950/25 ring-2 ring-red-500/30 shadow-md shadow-red-500/10"
                  : isPanelOff
                  ? "border-slate-400/80 dark:border-slate-800 bg-slate-200/60 dark:bg-slate-950/90"
                  : "border-slate-300 dark:border-slate-700 bg-card"
              }`}
            >
              {/* Accordion Trigger Header */}
              <button
                type="button"
                onClick={() => toggleAccordion(acc.id)}
                className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono transition-colors cursor-pointer select-none text-left ${
                  lineStopped > 0
                    ? "bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700 text-white"
                    : isPanelOff
                    ? "bg-slate-300/85 dark:bg-slate-900/95 hover:bg-slate-350 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-300"
                    : "bg-slate-200/90 dark:bg-slate-800/90 hover:bg-slate-300/80 dark:hover:bg-slate-700/80 text-foreground"
                }`}
                aria-expanded={isOpen}
                title={`Click to ${isOpen ? "collapse" : "expand"} ${acc.name}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`p-1 rounded-md border shadow-2xs ${
                      lineStopped > 0
                        ? "bg-white/20 border-white/30 text-white"
                        : isPanelOff
                        ? "bg-slate-200 dark:bg-slate-950 border-slate-400/80 dark:border-slate-800 text-muted-foreground"
                        : "bg-background/90 border-border text-foreground"
                    }`}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>

                  <span
                    className={`font-bold text-sm tracking-tight font-display ${
                      lineStopped > 0
                        ? "text-white"
                        : isPanelOff
                        ? "text-slate-800 dark:text-slate-300"
                        : "text-foreground"
                    }`}
                  >
                    {acc.name}
                  </span>

                  <span
                    className={`text-[11px] ${
                      lineStopped > 0 ? "text-red-100" : "text-muted-foreground"
                    }`}
                  >
                    ({stationsInLine.length} Stations)
                  </span>
                </div>

                {/* Realtime Status Counter & Panel Status */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Status Panel: ON / OFF Badge & Toggle */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePanelStatus(acc.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        togglePanelStatus(acc.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer select-none shadow-2xs ${
                      lineStopped > 0
                        ? isPanelOff
                          ? "bg-slate-900 text-slate-100 border-slate-700 shadow-sm hover:bg-slate-800"
                          : "bg-white text-slate-800 border-white/90 shadow-sm hover:bg-white/90"
                        : isPanelOff
                        ? "bg-slate-700 text-slate-100 dark:bg-slate-800 dark:text-slate-200 border-slate-600 dark:border-slate-700 hover:bg-slate-600"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                    }`}
                    title={`Klik untuk ubah status Panel ${acc.name} (Sekarang: ${panelStatus})`}
                  >
                    <span
                      className={`text-[10px] font-medium ${
                        lineStopped > 0
                          ? isPanelOff
                            ? "text-slate-400"
                            : "text-slate-600"
                          : "opacity-85"
                      }`}
                    >
                      Panel :
                    </span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        isPanelOff
                          ? "bg-slate-400"
                          : lineStopped > 0
                          ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                          : "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                      }`}
                    />
                    <span
                      className={`font-black ${
                        lineStopped > 0
                          ? isPanelOff
                            ? "text-amber-400"
                            : "text-emerald-700"
                          : ""
                      }`}
                    >
                      {panelStatus}
                    </span>
                  </span>

                  {/* Running Count */}
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[11px] border flex items-center gap-1.5 shadow-2xs ${
                      lineStopped > 0
                        ? "bg-white text-emerald-700 border-white/90 shadow-sm"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        lineStopped > 0 ? "bg-emerald-600" : "bg-emerald-400"
                      }`}
                    />
                    <span className={lineStopped > 0 ? "font-black" : ""}>
                      {lineRunning} Running
                    </span>
                  </span>

                  {/* Stopped Count */}
                  {lineStopped > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-white text-red-600 font-extrabold text-[11px] shadow-sm animate-pulse flex items-center gap-1 border border-white/90">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                      {lineStopped} Stopped
                    </span>
                  )}
                </div>
              </button>

              {/* Accordion Content: Long Room Floor Plan with Stations */}
              {isOpen && (
                <div
                  className={`border-t ${
                    lineStopped > 0
                      ? "border-red-500/40"
                      : isPanelOff
                      ? "border-slate-300 dark:border-slate-800"
                      : "border-slate-300 dark:border-slate-700/80"
                  }`}
                >
                  <div
                    className={`relative p-3.5 sm:p-4 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px] ${
                      lineStopped > 0
                        ? "bg-red-500/5 dark:bg-red-950/25"
                        : isPanelOff
                        ? "bg-slate-200/50 dark:bg-slate-950/70"
                        : ""
                    }`}
                  >
                    {/* Conveyor Track Container */}
                    <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                      {/* Station Workcell Bays inside the room */}
                        {stationsInLine.map((station) => {
                          const live = appState.stationLive[station.id];
                          const isStopped = live?.state === "stopped";
                          const isNoSignal = live?.state === "nosignal";
                          const stoppedDuration =
                            isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

                          const activeStop = isStopped
                            ? appState.stops.find((s) => s.stationId === station.id && s.status === "open")
                            : null;
                          const isFormFilled = Boolean(
                            activeStop &&
                              activeStop.source === "form" &&
                              Boolean(activeStop.reportedBy?.trim()) &&
                              Boolean(activeStop.categoryId?.trim()),
                          );
                          const activeCat =
                            isFormFilled && activeStop?.categoryId
                              ? appState.categories.find((c) => c.id === activeStop.categoryId)
                              : null;

                          const stopTimestamp =
                            live?.lastStopMs ?? live?.stoppedSinceMs ?? activeStop?.startMs;
                          const stopTimeStr =
                            isStopped && stopTimestamp ? fmtTimeShort(stopTimestamp) : null;

                          return (
                            <div
                              key={station.id}
                              className={`shrink-0 flex-1 min-w-[210px] max-w-[290px] rounded-xl border-2 flex flex-col justify-between p-3 transition-all relative ${
                                isStopped
                                  ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-2 ring-red-500/40 shadow-md shadow-red-500/15"
                                  : isNoSignal
                                  ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                                  : isPanelOff
                                  ? "border-slate-300 dark:border-slate-800 bg-card/60"
                                  : "border-slate-200 dark:border-slate-700/80 bg-card hover:border-emerald-500/60 hover:shadow-xs"
                              }`}
                            >
                              {/* Station Cell Header: Name & Status */}
                              <div>
                                <h4
                                  className="font-bold text-foreground text-sm tracking-tight truncate mb-2"
                                  title={station.name}
                                >
                                  {station.name}
                                </h4>

                                {/* Status Badge */}
                                <div
                                  className={`rounded-lg px-2 py-1.5 text-center font-mono text-xs font-bold flex items-center justify-center gap-1.5 ${
                                    isStopped
                                      ? "bg-red-600 text-white shadow-sm shadow-red-600/30 animate-pulse"
                                      : isNoSignal
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  }`}
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      isStopped
                                        ? "bg-white"
                                        : isNoSignal
                                        ? "bg-amber-500"
                                        : "bg-emerald-500 animate-pulse"
                                    }`}
                                  />
                                  <span>
                                    {isStopped ? "STOPPED" : isNoSignal ? "NO SIGNAL" : "RUNNING"}
                                  </span>
                                  {isStopped && stopTimeStr && <span>({stopTimeStr})</span>}
                                </div>

                                {/* Stop duration ticker if stopped */}
                                {isStopped && (
                                  <div className="mt-1 text-center">
                                    <span className="text-[11px] font-mono font-bold text-red-600 dark:text-red-400 block">
                                      ⏱ {fmtDuration(stoppedDuration)}
                                    </span>
                                    {isFormFilled && activeCat && (
                                      <span className="text-[10px] text-muted-foreground block truncate">
                                        Reason: {activeCat.name}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Telemetry: Speed & Total Run Time */}
                              <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1 font-mono text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground text-[11px]">Speed:</span>
                                  <span className="font-bold text-foreground">
                                    {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"}{" "}
                                    {station.speedUnit}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground text-[11px]">Total Run:</span>
                                  <span className="font-semibold text-foreground">
                                    {live ? fmtDuration(live.totalRunMs) : "0s"}
                                  </span>
                                </div>
                              </div>

                              {/* Quick Action Buttons: E-Form & History */}
                              <div className="mt-2.5 pt-2 border-t border-border/60 grid grid-cols-2 gap-1.5">
                                {isStopped && !isFormFilled ? (
                                  <Link
                                    to="/web/station-live/e-form"
                                    search={{ areaId: station.areaId, stationId: station.id }}
                                    onClick={(e) => {
                                      if (typeof window !== "undefined") {
                                        window.location.href = `/web/station-live/e-form?areaId=${station.areaId}&stationId=${station.id}`;
                                        e.preventDefault();
                                      }
                                    }}
                                    className="inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer text-center"
                                    title="Open E-Form Line Stop"
                                  >
                                    <ClipboardList className="h-3 w-3 shrink-0" />
                                    <span className="truncate">E-Form</span>
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground/60 border border-border/40 cursor-not-allowed text-center select-none"
                                    title={
                                      isStopped && isFormFilled
                                        ? "E-Form sudah diisi"
                                        : "E-Form hanya aktif saat STOPPED"
                                    }
                                  >
                                    <ClipboardList className="h-3 w-3 shrink-0 opacity-40" />
                                    <span className="truncate">
                                      {isStopped && isFormFilled ? "Filled" : "E-Form"}
                                    </span>
                                  </button>
                                )}

                                <Link
                                  to="/web/station-history"
                                  search={{ areaId: station.areaId, stationId: station.id }}
                                  className="inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-semibold border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer text-center"
                                  title={`View Line Stop History for ${station.name}`}
                                >
                                  <History className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">History</span>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

