import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Tv,
  Building2,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import { fmtDuration, dayStartMs, fmtTime } from "../../lib/format";
import { SelectInput } from "../../components/ui/select-input";

export const Route = createFileRoute("/web/station-live")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Station Live Monitoring" },
      { name: "description", content: "Real-time Conveyor line station telemetry, speeds, and live Andon status." },
    ],
  }),
  component: StationLivePage,
});

function StationLivePage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Realtime ticker every second for duration timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter by Area
  const [selectedAreaId, setSelectedAreaId] = useState<string>("all");

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
    { value: "all", label: `Semua Area (${appState.areas.length})` },
    ...appState.areas.map((a) => ({
      value: a.id,
      label: `${a.name} (${a.code})`,
    })),
  ], [appState.areas]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Radio className="h-3 w-3 animate-pulse" />
              LIVE TELEMETRY
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Station Live
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pantauan langsung kondisi setiap stasiun conveyor, status running/stopped, kecepatan aktual, dan durasi stop secara real-time.
          </p>
        </div>

        {/* Action Bar: Filter Area + Link Andon TV */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56 sm:w-64">
            <SelectInput
              hideClear
              datalist={areaOptions}
              value={selectedAreaId}
              onChange={(val) => setSelectedAreaId(val ?? "all")}
              placeholder="Filter Area Stasiun"
            />
          </div>

          <a
            href="/andon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-xs"
            title="Buka tampilan siaran Andon TV di tab baru"
          >
            <Tv className="h-3.5 w-3.5 text-primary" />
            <span>Buka Andon TV</span>
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Summary KPI Strip (4 Cards matching Andon) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Stations Running */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              Stasiun Running
            </span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
              {runningCount}
            </span>
            <span className="font-mono text-xs sm:text-sm text-emerald-600/80 dark:text-emerald-400/80">
              / {filteredStations.length} Stasiun
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
              Stasiun Stopped
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
              {stoppedCount > 0 ? "STOP DARURAT" : "Normal"}
            </span>
          </div>
        </div>

        {/* 3. Stops Today */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              Line Stop Hari Ini
            </span>
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-black text-foreground">
              {stopsToday.length}
            </span>
            <span className="font-mono text-xs sm:text-sm text-muted-foreground">Kejadian</span>
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
              Stop Terlama Aktif
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
          <h4 className="font-semibold text-foreground">Tidak Ada Stasiun Ditemukan</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Tidak ada stasiun yang terdaftar dalam area yang dipilih. Silakan pilih area lain atau kembali ke "Semua Area".
          </p>
          <button
            onClick={() => setSelectedAreaId("all")}
            className="mt-4 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Reset ke Semua Area
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
            const activeCat = activeStop
              ? appState.categories.find((c) => c.id === activeStop.categoryId)
              : null;
            const stationArea = appState.areas.find((a) => a.id === station.areaId);

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
                        STASIUN #{station.sequence}
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

                  {/* Big State Banner matching Andon */}
                  <div
                    className={`rounded-xl p-4 my-3 text-center border-2 font-mono ${
                      isStopped
                        ? "bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40"
                        : isNoSignal
                        ? "bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <div className="text-2xl md:text-3xl font-black tracking-widest">
                      {isStopped ? "STOPPED" : isNoSignal ? "NO SIGNAL" : "RUNNING"}
                    </div>

                    {/* Running stop timer & details */}
                    {isStopped && (
                      <div className="mt-2 pt-2 border-t border-white/30 space-y-1">
                        <span className="text-xs uppercase tracking-wider block font-sans opacity-90">
                          Durasi Berhenti:
                        </span>
                        <span className="text-2xl md:text-3xl font-black tracking-wider text-white block">
                          {fmtDuration(stoppedDuration)}
                        </span>
                        {activeCat && (
                          <div className="mt-1 font-sans text-xs bg-black/40 text-white py-1 px-2.5 rounded inline-block">
                            Alasan: <span className="font-bold">{activeCat.name}</span>
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Telemetry */}
                <div className="pt-3 border-t border-border space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Kecepatan:</span>
                    <div className="text-right">
                      <span className="text-base font-bold text-foreground">
                        {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Nominal: {station.nominalSpeed} {station.speedUnit}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

