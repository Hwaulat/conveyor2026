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
  ArrowLeft,
  Sun,
  Moon,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useAppStore } from "../lib/store";
import { fmtTime, fmtDateHuman, fmtDuration, dayStartMs, shiftOf } from "../lib/format";

export const Route = createFileRoute("/andon")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Andon Board TV Display" },
      { name: "description", content: "Fullscreen high-contrast TV Andon display for factory conveyor line-stop monitoring." },
    ],
  }),
  component: AndonPage,
});

function AndonPage() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none overflow-x-hidden p-4 md:p-6 lg:p-8 transition-colors">
      {/* Top TV Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 mb-6 gap-4">
        {/* Plant Identity */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg border-2 border-border bg-card flex items-center justify-center font-mono text-lg font-black text-foreground tracking-wider shadow-md">
            KRM
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-foreground uppercase">
                {t("andon.title")}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                ONLINE
              </span>
            </div>
            <p className="font-mono text-xs md:text-sm text-muted-foreground mt-0.5">
              PT. Krama Yudha Ratu Motor Indonesia • Assembly & Conveyor Line Monitoring
            </p>
          </div>
        </div>

        {/* Live Clock & Shift Controls */}
        <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-center font-mono">
          <div className="text-right">
            <div className="text-2xl md:text-3xl font-black tracking-wider text-foreground flex items-center justify-end gap-2">
              <Clock className="h-6 w-6 text-muted-foreground" />
              <span>{fmtTime(nowMs)}</span>
              <span className="text-sm font-normal text-muted-foreground">WIB</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtDateHuman(nowMs)} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">{currentShift.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs"
              title={theme === "dark" ? "Mode Terang (Light Mode)" : "Mode Gelap (Dark Mode)"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs"
              title="Fullscreen Mode"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>

            {/* Back to Web */}
            <Link
              to="/web"
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5 text-xs font-mono font-medium shadow-2xs"
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
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.running")}
            </span>
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-5xl md:text-6xl font-black text-emerald-600 dark:text-emerald-400">
              {runningCount}
            </span>
            <span className="font-mono text-sm text-emerald-600/80 dark:text-emerald-400/80">/ {appState.stations.length} Stasiun</span>
          </div>
        </div>

        {/* 2. Stations Stopped */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between shadow-md transition-colors ${
            stoppedCount > 0
              ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-2 ring-red-500/50"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.stopped")}
            </span>
            <AlertTriangle className={`h-6 w-6 ${stoppedCount > 0 ? "animate-bounce" : ""}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span
              className={`font-mono text-5xl md:text-6xl font-black ${
                stoppedCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
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
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold">
              {t("andon.summary.stopsToday")}
            </span>
            <Square className="h-5 w-5" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-5xl md:text-6xl font-black text-foreground">
              {stopsToday.length}
            </span>
            <span className="font-mono text-sm text-muted-foreground">Kejadian</span>
          </div>
        </div>

        {/* 4. Longest Current Stop */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between shadow-md transition-colors ${
            longestCurrentStopMs > 0
              ? "border-red-500/60 bg-red-500/10 dark:bg-red-950/30"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {t("andon.summary.longest")}
            </span>
            <Clock className={`h-5 w-5 ${longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-4">
            <span
              className={`font-mono text-4xl md:text-5xl font-black tracking-tight ${
                longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              }`}
            >
              {longestCurrentStopMs > 0 ? fmtDuration(longestCurrentStopMs) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1">
        {appState.stations.map((station) => {
          const live = appState.stationLive[station.id];
          const isStopped = live?.state === "stopped";
          const isNoSignal = live?.state === "nosignal";
          const stoppedDuration = isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

          const activeStop = isStopped
            ? appState.stops.find((s) => s.stationId === station.id && s.status === "open")
            : null;
          const activeCat = activeStop ? appState.categories.find((c) => c.id === activeStop.categoryId) : null;

          return (
            <div
              key={station.id}
              className={`rounded-2xl border-2 flex flex-col justify-between p-6 transition-all shadow-lg relative overflow-hidden ${
                isStopped
                  ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-4 ring-red-500/30 shadow-red-500/20"
                  : isNoSignal
                  ? "border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/20"
                  : "border-emerald-500/30 bg-card hover:border-emerald-500/60"
              }`}
            >
              {/* Card Top: Station Name & Sequence */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest font-bold block">
                      STASIUN #{station.sequence}
                    </span>
                    <h2 className="font-display text-2xl font-black text-foreground tracking-tight">
                      {station.name}
                    </h2>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-muted text-foreground font-bold border border-border">
                    {station.conveyorId.toUpperCase()}
                  </span>
                </div>

                {/* Big Giant State Banner */}
                <div
                  className={`rounded-xl p-4 my-3 text-center border-2 font-mono ${
                    isStopped
                      ? "bg-red-600 border-red-400 text-white shadow-lg shadow-red-600/40"
                      : isNoSignal
                      ? "bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
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
                        <div className="mt-1 font-sans text-xs bg-black/40 text-white py-1 px-2 rounded inline-block">
                          Alasan: <span className="font-bold">{activeCat.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Bottom: Telemetry */}
              <div className="pt-4 border-t border-border space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("andon.speed")}:</span>
                  <span className="text-lg font-bold text-foreground">
                    {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{t("andon.runTime")}:</span>
                  <span className="text-foreground font-bold">
                    {live ? fmtDuration(live.totalRunMs) : "0s"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border/50">
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
      <footer className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-muted-foreground gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{t("andon.updated")}: {fmtTime(nowMs)} WIB (Auto-refresh realtime)</span>
        </div>
        <div>
          <span>Mode Siaran TV Layar Penuh • PT. Krama Yudha Ratu Motor Indonesia Line Control System</span>
        </div>
      </footer>
    </div>
  );
}
