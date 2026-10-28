import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Tv,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ExternalLink,
  Layers,
  ArrowLeft,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAppStore, store } from "../lib/store";
import { fmtTime, fmtDateHuman, fmtDuration, dayStartMs, shiftOf } from "../lib/format";
import { stopDurationMs } from "../lib/calc";

export const Route = createFileRoute("/andon")({
  head: () => ({
    meta: [
      { title: "JSGI — Andon Board TV Display" },
      { name: "description", content: "Fullscreen high-contrast TV Andon display for factory conveyor line-stop monitoring." },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: AndonPage,
});

function AndonPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Tick every second for live timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentShift = shiftOf(nowMs, appState.shifts);
  const todayStart = dayStartMs(nowMs);
  const stopsToday = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= todayStart);
  }, [appState.stops, todayStart]);

  const runningCount = Object.values(appState.stationLive).filter((s) => s.state === "running").length;
  const stoppedCount = Object.values(appState.stationLive).filter((s) => s.state === "stopped").length;

  // Find longest current open stop
  const longestCurrentStopMs = useMemo(() => {
    const openStops = appState.stops.filter((s) => s.status === "open");
    if (openStops.length === 0) return 0;
    return Math.max(...openStops.map((s) => nowMs - s.startMs));
  }, [appState.stops, nowMs]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans select-none overflow-x-hidden p-4 md:p-6 lg:p-8">
      {/* Top TV Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/20 pb-4 mb-6 gap-4">
        {/* Plant Identity */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg border-2 border-white/30 bg-white/10 flex items-center justify-center font-mono text-xl font-black text-white tracking-widest shadow-lg">
            JSGI
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-white uppercase">
                {t("andon.title")}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                ONLINE
              </span>
            </div>
            <p className="font-mono text-xs md:text-sm text-muted-foreground mt-0.5">
              PT. JSGI Manufacturing Indonesia • Assembly & Conveyor Line Monitoring
            </p>
          </div>
        </div>

        {/* Live Clock & Shift Controls */}
        <div className="flex items-center gap-4 self-end sm:self-center font-mono">
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black tracking-wider text-white flex items-center justify-end gap-2">
              <Clock className="h-6 w-6 text-muted-foreground" />
              <span>{fmtTime(nowMs)}</span>
              <span className="text-sm font-normal text-muted-foreground">WIB</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtDateHuman(nowMs)} • <span className="text-emerald-400 font-bold">{currentShift.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-colors"
              title="Fullscreen Mode"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <Link
              to="/web"
              className="p-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-colors flex items-center gap-1.5 text-xs font-mono font-medium"
              title="Ke Portal Web"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">Web Console</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Summary KPI Strip (4 Large Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. Stations Running */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.running")}
            </span>
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-5xl md:text-6xl font-black text-emerald-400">
              {runningCount}
            </span>
            <span className="font-mono text-sm text-emerald-400/80">/ {appState.stations.length} Stasiun</span>
          </div>
        </div>

        {/* 2. Stations Stopped */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between shadow-lg transition-colors ${
            stoppedCount > 0
              ? "border-red-500 bg-red-950/40 ring-2 ring-red-500/50"
              : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center justify-between text-red-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.stopped")}
            </span>
            <AlertTriangle className={`h-6 w-6 ${stoppedCount > 0 ? "animate-bounce" : ""}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span
              className={`font-mono text-5xl md:text-6xl font-black ${
                stoppedCount > 0 ? "text-red-400" : "text-white"
              }`}
            >
              {stoppedCount}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              {stoppedCount > 0 ? "STOP DARURAT" : "Normal"}
            </span>
          </div>
        </div>

        {/* 3. Stops Today */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.stopsToday")}
            </span>
            <Square className="h-5 w-5" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-5xl md:text-6xl font-black text-white">
              {stopsToday.length}
            </span>
            <span className="font-mono text-sm text-muted-foreground">Kejadian</span>
          </div>
        </div>

        {/* 4. Longest Current Stop */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between shadow-lg transition-colors ${
            longestCurrentStopMs > 0
              ? "border-red-500/60 bg-red-950/30"
              : "border-white/10 bg-[#0d0d10]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {t("andon.summary.longest")}
            </span>
            <Clock className={`h-5 w-5 ${longestCurrentStopMs > 0 ? "text-red-400" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-4">
            <span
              className={`font-mono text-4xl md:text-5xl font-black tracking-tight ${
                longestCurrentStopMs > 0 ? "text-red-400" : "text-muted-foreground"
              }`}
            >
              {longestCurrentStopMs > 0 ? fmtDuration(longestCurrentStopMs) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Stations Grid (High Impact TV Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1">
        {appState.stations.map((station) => {
          const live = appState.stationLive[station.id];
          const isStopped = live?.state === "stopped";
          const isNoSignal = live?.state === "nosignal";
          const stoppedDuration = isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

          // Find active open stop details if stopped
          const activeStop = isStopped
            ? appState.stops.find((s) => s.stationId === station.id && s.status === "open")
            : null;
          const activeCat = activeStop ? appState.categories.find((c) => c.id === activeStop.categoryId) : null;

          return (
            <div
              key={station.id}
              className={`rounded-2xl border-2 flex flex-col justify-between p-6 transition-all shadow-xl relative overflow-hidden ${
                isStopped
                  ? "border-red-500 bg-red-950/40 ring-4 ring-red-500/40 animate-pulse-none shadow-red-950/60"
                  : isNoSignal
                  ? "border-amber-500/50 bg-amber-950/20"
                  : "border-emerald-500/30 bg-[#0a0f0d] hover:border-emerald-500/60"
              }`}
            >
              {/* Card Top: Station Name & Sequence */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block">
                      STASIUN #{station.sequence}
                    </span>
                    <h2 className="font-display text-2xl font-black text-white tracking-tight">
                      {station.name}
                    </h2>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-white/10 text-white font-bold border border-white/20">
                    {station.conveyorId.toUpperCase()}
                  </span>
                </div>

                {/* Big Giant State Banner */}
                <div
                  className={`rounded-xl p-4 my-3 text-center border-2 font-mono ${
                    isStopped
                      ? "bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40"
                      : isNoSignal
                      ? "bg-amber-600/30 border-amber-400 text-amber-300"
                      : "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  }`}
                >
                  <div className="text-3xl md:text-4xl font-black tracking-widest">
                    {isStopped ? "STOPPED" : isNoSignal ? "NO SIGNAL" : "RUNNING"}
                  </div>

                  {/* Running stop timer */}
                  {isStopped && (
                    <div className="mt-2 pt-2 border-t border-white/30">
                      <span className="text-xs uppercase tracking-wider block font-sans opacity-90">
                        Durasi Berhenti:
                      </span>
                      <span className="text-3xl md:text-4xl font-black tracking-wider text-white">
                        {fmtDuration(stoppedDuration)}
                      </span>
                      {activeCat && (
                        <div className="mt-1 font-sans text-xs bg-black/40 py-1 px-2 rounded inline-block">
                          Alasan: <span className="font-bold">{activeCat.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Bottom: Telemetry */}
              <div className="pt-4 border-t border-white/10 space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("andon.speed")}:</span>
                  <span className="text-lg font-bold text-white">
                    {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{t("andon.runTime")}:</span>
                  <span className="text-white font-bold">
                    {live ? fmtDuration(live.totalRunMs) : "0s"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                  <span>
                    {t("andon.lastStop")}: {live ? fmtTime(live.lastStopMs) : "—"}
                  </span>
                  <span>
                    {t("andon.lastStart")}: {live ? fmtTime(live.lastStartMs) : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TV Footer */}
      <footer className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-muted-foreground gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{t("andon.updated")}: {fmtTime(nowMs)} WIB (Auto-refresh realtime)</span>
        </div>
        <div>
          <span>Mode Siaran TV Layar Penuh • PT JSGI Line Control System</span>
        </div>
      </footer>
    </div>
  );
}
