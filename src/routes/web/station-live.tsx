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
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import { fmtDuration, dayStartMs, fmtTime, fmtTimeShort } from "../../lib/format";
import { SelectInput } from "../../components/ui/select-input";
import { IpadEFormPage } from "../ipad";

export const Route = createFileRoute("/web/station-live")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string } => {
    return {
      stationId: typeof search["stationId"] === "string" ? search["stationId"] : undefined,
      areaId: typeof search["areaId"] === "string" ? search["areaId"] : undefined,
    };
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

  return (
    <div className="space-y-6 w-full">
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

      {/* Summary KPI Strip (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Stations Running */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              Stations Running
            </span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
              {runningCount}
            </span>
            <span className="font-mono text-xs sm:text-sm text-emerald-600/80 dark:text-emerald-400/80">
              / {filteredStations.length} Stations
            </span>
          </div>
        </div>

        {/* 2. Stations Stopped */}
        <div
          className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-colors ${
            stoppedCount > 0
              ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-2 ring-red-500/50"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              Stations Stopped
            </span>
            <AlertTriangle className={`h-5 w-5 ${stoppedCount > 0 ? "animate-bounce" : ""}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`font-mono text-4xl sm:text-5xl font-black ${
                stoppedCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
              }`}
            >
              {stoppedCount}
            </span>
            <span className="font-mono text-xs sm:text-sm text-muted-foreground">
              {stoppedCount > 0 ? "EMERGENCY STOP" : "Normal"}
            </span>
          </div>
        </div>

        {/* 3. Stops Today */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              Line Stops Today
            </span>
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-black text-foreground">
              {stopsToday.length}
            </span>
            <span className="font-mono text-xs sm:text-sm text-muted-foreground">Occurrences</span>
          </div>
        </div>

        {/* 4. Longest Current Stop */}
        <div
          className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-colors ${
            longestCurrentStopMs > 0
              ? "border-red-500/60 bg-red-500/10 dark:bg-red-950/30"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Longest Active Stop
            </span>
            <Clock
              className={`h-5 w-5 ${
                longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="mt-3">
            <span
              className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              }`}
            >
              {longestCurrentStopMs > 0 ? fmtDuration(longestCurrentStopMs) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Stations Grid */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStations.map((station) => {
            const live = appState.stationLive[station.id];
            const isStopped = live?.state === "stopped";
            const isNoSignal = live?.state === "nosignal";
            const stoppedDuration = isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

            const activeStop = isStopped
              ? appState.stops.find((s) => s.stationId === station.id && s.status === "open")
              : null;
            // E-Form dianggap sudah terisi jika source adalah form dan field operator & kategori telah diisi
            const isFormFilled = Boolean(
              activeStop &&
              activeStop.source === "form" &&
              Boolean(activeStop.reportedBy?.trim()) &&
              Boolean(activeStop.categoryId?.trim())
            );
            const activeCat = isFormFilled && activeStop?.categoryId
              ? appState.categories.find((c) => c.id === activeStop.categoryId)
              : null;
            const stationArea = appState.areas.find((a) => a.id === station.areaId);

            // Waktu terjadinya line stop (format 09:00)
            const stopTimestamp = live?.lastStopMs ?? live?.stoppedSinceMs ?? activeStop?.startMs;
            const stopTimeStr = isStopped && stopTimestamp ? fmtTimeShort(stopTimestamp) : null;

            return (
              <div
                key={station.id}
                className={`rounded-2xl border-2 flex flex-col justify-between p-5 transition-all shadow-md relative overflow-hidden ${
                  isStopped
                    ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-4 ring-red-500/30 shadow-red-500/20"
                    : isNoSignal
                    ? "border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/20"
                    : "border-emerald-500/30 bg-card hover:border-emerald-500/60"
                }`}
              >
                {/* Card Top: Station Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest font-bold block">
                        STATION #{station.sequence}
                      </span>
                      <h3 className="font-display text-xl font-black text-foreground tracking-tight">
                        {station.name}
                      </h3>
                      {stationArea && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Area: {stationArea.name} ({stationArea.code})
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-muted text-foreground font-bold border border-border shrink-0">
                      {station.conveyorId.toUpperCase()}
                    </span>
                  </div>

                  {/* Big State Banner */}
                  <div
                    className={`rounded-xl p-4 my-3 text-center border-2 font-mono ${
                      isStopped
                        ? "bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40"
                        : isNoSignal
                        ? "bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <div className="text-2xl md:text-3xl font-black tracking-widest flex items-center justify-center gap-2 flex-wrap">
                      <span>{isStopped ? "STOPPED" : isNoSignal ? "NO SIGNAL" : "RUNNING"}</span>
                      {isStopped && stopTimeStr && (
                        <span className="text-xl md:text-2xl font-bold opacity-90 tracking-normal font-mono">
                          ({stopTimeStr})
                        </span>
                      )}
                    </div>

                    {/* Running stop timer & details */}
                    {isStopped && (
                      <div className="mt-2 pt-2 border-t border-white/30 space-y-1">
                        <span className="text-xs uppercase tracking-wider block font-sans opacity-90">
                          Stop Duration:
                        </span>
                        <span className="text-2xl md:text-3xl font-black tracking-wider text-white block">
                          {fmtDuration(stoppedDuration)}
                        </span>
                        {/* Jika sudah terisi semuanya: tampilkan reason, operator, dan notes. Jika belum terisi: masih kosong */}
                        {isFormFilled && (
                          <>
                            {activeCat && (
                              <div className="mt-1 font-sans text-xs bg-black/40 text-white py-1 px-2.5 rounded inline-block">
                                Reason: <span className="font-bold">{activeCat.name}</span>
                              </div>
                            )}
                            {activeStop?.reportedBy && (
                              <div className="text-[11px] font-sans opacity-90 block">
                                Operator: <span className="font-semibold">{activeStop.reportedBy}</span>
                              </div>
                            )}
                            {activeStop?.note && (
                              <p className="text-[11px] italic font-sans opacity-85 truncate max-w-xs mx-auto">
                                "{activeStop.note}"
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Telemetry */}
                <div className="pt-3 border-t border-border space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Speed:</span>
                    <div className="text-right">
                      <span className="text-base font-bold text-foreground">
                        {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Threshold: &gt; {station.runningThreshold} {station.speedUnit}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Total Run Time:</span>
                    <span className="text-foreground font-bold">
                      {live ? fmtDuration(live.totalRunMs) : "0s"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span>
                      Last Stop: {live?.lastStopMs ? fmtTime(live.lastStopMs) : "—"}
                    </span>
                    <span>
                      Last Start: {live?.lastStartMs ? fmtTime(live.lastStartMs) : "—"}
                    </span>
                  </div>
                </div>

                {/* Card Actions: E-Form Line Stop & History */}
                <div className="pt-3.5 mt-3 border-t border-border grid grid-cols-2 gap-2">
                  {/* Button 1: E-Form Line Stop (Active & Red when STOPPED but NOT YET FILLED; Disabled if already filled or RUNNING) */}
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
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer text-center"
                      title="Open E-Form Line Stop"
                    >
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">E-Form Line Stop</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#132742]/50 text-slate-400 dark:text-[#527299] border border-slate-200/50 dark:border-[#152a47] cursor-not-allowed text-center select-none"
                      title={
                        isStopped && isFormFilled
                          ? "E-Form sudah diisi lengkap untuk line stop ini"
                          : "E-Form Line Stop hanya aktif saat status station STOPPED"
                      }
                    >
                      <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      <span className="truncate">E-Form Line Stop</span>
                    </button>
                  )}

                  {/* Button 2: History (Always Active) */}
                  <Link
                    to="/web/station-history"
                    search={{ areaId: station.areaId, stationId: station.id }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#152a47] bg-white dark:bg-[#132742] hover:bg-slate-50 dark:hover:bg-[#1c3860] text-foreground transition-colors cursor-pointer shadow-2xs text-center"
                    title={`View Line Stop History for ${station.name}`}
                  >
                    <History className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                    <span className="truncate">History</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

