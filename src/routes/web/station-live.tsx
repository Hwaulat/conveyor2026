import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Building2,
  History,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import { fmtDuration, dayStartMs, fmtTime, fmtTimeShort } from "../../lib/format";
import { SelectInput } from "../../components/ui/select-input";
import { IpadEFormPage } from "../ipad";

export const Route = createFileRoute("/web/station-live")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string } => {
    const res: { stationId?: string; areaId?: string } = {};
    if (typeof search["stationId"] === "string" && search["stationId"]) res.stationId = search["stationId"];
    if (typeof search["areaId"] === "string" && search["areaId"]) res.areaId = search["areaId"];
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

  // Default Area: Sealing Area (where single active line-stop is located)
  const defaultAreaId = useMemo(() => {
    return (
      appState.areas.find(
        (a) => a.id === "area-sealing" || a.code?.toUpperCase() === "SEALING",
      )?.id ?? appState.areas[0]?.id ?? "area-sealing"
    );
  }, [appState.areas]);

  // Filter by Area (default: Sealing Area)
  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => defaultAreaId);

  useEffect(() => {
    if (selectedAreaId === "all" || appState.areas.some((a) => a.id === selectedAreaId)) {
      return;
    }
    setSelectedAreaId(defaultAreaId);
  }, [defaultAreaId, selectedAreaId, appState.areas]);

  const filteredStations = useMemo(() => {
    if (selectedAreaId === "all") return appState.stations;
    return appState.stations.filter((s) => s.areaId === selectedAreaId);
  }, [selectedAreaId, appState.stations]);

  const runningCount = filteredStations.filter(
    (s) => appState.stationLive[s.id]?.state === "running",
  ).length;

  const stoppedCount = filteredStations.filter(
    (s) => appState.stationLive[s.id]?.state === "stopped",
  ).length;

  const stopsToday = useMemo(() => {
    const todayStart = dayStartMs(nowMs);
    return appState.stops.filter((s) => {
      const isToday = s.startMs >= todayStart;
      const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
      return isToday && matchArea;
    });
  }, [appState.stops, nowMs, selectedAreaId]);

  const longestCurrentStopMs = useMemo(() => {
    let maxDur = 0;
    for (const s of filteredStations) {
      const live = appState.stationLive[s.id];
      if (live?.state === "stopped" && live.stoppedSinceMs) {
        const dur = nowMs - live.stoppedSinceMs;
        if (dur > maxDur) maxDur = dur;
      }
    }
    return maxDur;
  }, [filteredStations, appState.stationLive, nowMs]);

  const areaOptions = useMemo(() => [
    { value: "all", label: `All Areas (${appState.areas.length})` },
    ...appState.areas.map((a) => ({
      value: a.id,
      label: `${a.name} (${a.code})`,
    })),
  ], [appState.areas]);

  const areasToDisplay = useMemo(() => {
    if (selectedAreaId === "all") {
      return appState.areas.filter((area) =>
        appState.stations.some((st) => st.areaId === area.id)
      );
    }
    return appState.areas.filter((area) => area.id === selectedAreaId);
  }, [selectedAreaId, appState.areas, appState.stations]);

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Station Live
          </h1>
        </div>

        {/* Action Bar: Filter Area */}
        <div className="flex items-center gap-3">
          <div className="w-56 sm:w-64">
            <SelectInput
              hideClear
              datalist={areaOptions}
              value={selectedAreaId}
              onChange={(val) => setSelectedAreaId(val ?? "all")}
              placeholder="Filter Station Area"
            />
          </div>
        </div>
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
                / {filteredStations.length}
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

      {/* Conveyor Bay Floor Plan — Top-Down Long Room Schematic */}
      {filteredStations.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h4 className="font-semibold text-foreground">No Stations Found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            No stations registered in the selected area. Please choose another area or reset the filter.
          </p>
          <button
            onClick={() => setSelectedAreaId("all")}
            className="mt-4 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Reset to All Areas
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {areasToDisplay.map((area) => {
            const stationsInArea = filteredStations
              .filter((s) => s.areaId === area.id)
              .sort((a, b) => a.sequence - b.sequence);

            if (stationsInArea.length === 0) return null;

            const conveyor =
              appState.conveyors.find((c) => c.areaId === area.id) ?? appState.conveyors[0];
            const areaRunning = stationsInArea.filter(
              (s) => appState.stationLive[s.id]?.state === "running",
            ).length;
            const areaStopped = stationsInArea.filter(
              (s) => appState.stationLive[s.id]?.state === "stopped",
            ).length;

            return (
              <div
                key={area.id}
                className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm overflow-hidden"
              >
                {/* Architectural Building Header: Exterior Wall & Blueprint Specs */}
                <div className="bg-slate-200/90 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold tracking-wider text-[11px] uppercase border border-primary/20">
                      BAY PLAN · TOP-DOWN
                    </span>
                    <span className="font-bold text-foreground text-sm tracking-tight font-display">
                      {area.name}
                    </span>
                    <span className="text-muted-foreground text-[11px]">({area.code})</span>
                  </div>

                  {/* Center Conveyor Travel Direction Banner */}
                  <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground font-semibold">
                    <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] shadow-2xs font-mono">
                      INFEED
                    </span>
                    <span className="tracking-widest flex items-center gap-1 text-primary/80 font-mono text-[11px]">
                      ════▶ CONVEYOR FLOW DIRECTION ════▶
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] shadow-2xs font-mono">
                      OUTFEED
                    </span>
                  </div>

                  {/* Right: Conveyor Spec & Realtime Status Counter */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px] hidden sm:inline">
                      Conveyor: <strong className="text-foreground">{conveyor?.name ?? "Main Line"}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                      {areaRunning} Running
                    </span>
                    {areaStopped > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px] shadow-xs shadow-red-500/40 animate-pulse">
                        {areaStopped} Stopped
                      </span>
                    )}
                  </div>
                </div>

                {/* Long Room Interior: Conveyor Track & Workstation Bays */}
                <div className="relative p-3.5 sm:p-4 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px]">
                  {/* Conveyor Track Container */}
                  <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {/* Left Wall: Infeed Door Opening */}
                    <div className="shrink-0 w-8 sm:w-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center p-1 text-center select-none font-mono text-muted-foreground">
                      <span className="text-[10px] font-bold text-primary">IN</span>
                      <ArrowRight className="h-4 w-4 text-primary my-1" />
                      <span className="text-[8px] uppercase font-bold tracking-tighter">FEED</span>
                    </div>

                    {/* Station Workcell Bays inside the room */}
                    {stationsInArea.map((station) => {
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
                              : "border-slate-200 dark:border-slate-700/80 bg-card hover:border-emerald-500/60 hover:shadow-xs"
                          }`}
                        >
                          {/* Station Cell Header: Bay Number & Name */}
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                                BAY #{station.sequence} · {station.code}
                              </span>
                              <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[80px]">
                                {station.conveyorId.toUpperCase()}
                              </span>
                            </div>

                            <h4
                              className="font-bold text-foreground text-sm tracking-tight truncate"
                              title={station.name}
                            >
                              {station.name}
                            </h4>

                            {/* Conveyor Track Rail Graphic passing across this station bay */}
                            <div className="my-2 py-0.5 px-2 rounded bg-muted/40 border border-dashed border-border/60 flex items-center justify-between text-[9px] font-mono text-muted-foreground select-none">
                              <span>TRACK</span>
                              <span className="tracking-widest opacity-60 text-primary">══▷══</span>
                              <span>POS #{station.sequence}</span>
                            </div>

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

                    {/* Right Wall: Outfeed Door Opening */}
                    <div className="shrink-0 w-8 sm:w-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center p-1 text-center select-none font-mono text-muted-foreground">
                      <span className="text-[10px] font-bold text-primary">OUT</span>
                      <ArrowRight className="h-4 w-4 text-primary my-1" />
                      <span className="text-[8px] uppercase font-bold tracking-tighter">FEED</span>
                    </div>
                  </div>

                  {/* Floor Plan Reference Footer */}
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>LINE FLOW: WEST ➔ EAST (INFEED TO OUTFEED)</span>
                      <span>•</span>
                      <span>TOTAL WORKCELLS: {stationsInArea.length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> RUNNING
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> STOPPED
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> NO SIGNAL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

