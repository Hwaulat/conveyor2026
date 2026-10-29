import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertOctagon,
  Clock,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  BarChart2,
  Layers,
  ArrowUpRight,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { useAppStore, store } from "../../lib/store";
import {
  mttrMs,
  mtbfMs,
  avgStopMs,
  operatingTimeMs,
  downtimeByCategory,
  computeOee,
  stopDurationMs,
} from "../../lib/calc";
import { fmtDuration, fmtMinutes, dayStartMs } from "../../lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/web/")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Real-time Dashboard & KPI" },
      { name: "description", content: "Real-time Conveyor line performance, MTTR, MTBF and OEE metrics." },
    ],
  }),
  component: DashboardPage,
});

type Granularity = "day" | "week" | "month";

function DashboardPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const appState = useAppStore();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [selectedStationId, setSelectedStationId] = useState<string>("all");
  const nowMs = Date.now();

  const isDark = theme === "dark";

  // Find selected station details if not "all"
  const selectedStation = useMemo(() => {
    return selectedStationId === "all" ? null : appState.stations.find((s) => s.id === selectedStationId) ?? null;
  }, [selectedStationId, appState.stations]);

  // Filter stops by granularity period AND station filter
  const periodStartMs = useMemo(() => {
    if (granularity === "day") return dayStartMs(nowMs);
    if (granularity === "week") return nowMs - 7 * 86_400_000;
    return nowMs - 30 * 86_400_000;
  }, [granularity, nowMs]);

  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => {
      const matchPeriod = s.startMs >= periodStartMs;
      const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
      return matchPeriod && matchStation;
    });
  }, [appState.stops, periodStartMs, selectedStationId]);

  // Stops today specifically for the today KPI card (with station filter)
  const todayStartMs = dayStartMs(nowMs);
  const stopsToday = useMemo(() => {
    return appState.stops.filter((s) => {
      const matchToday = s.startMs >= todayStartMs;
      const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
      return matchToday && matchStation;
    });
  }, [appState.stops, todayStartMs, selectedStationId]);

  // Calculate KPIs
  const totalDowntimeTodayMs = useMemo(() => {
    return stopsToday.reduce((acc, s) => acc + stopDurationMs(s, nowMs), 0);
  }, [stopsToday, nowMs]);

  const averageStopTodayMs = useMemo(() => {
    return avgStopMs(stopsToday, nowMs);
  }, [stopsToday, nowMs]);

  // MTTR in ms
  const currentMttrMs = useMemo(() => {
    return mttrMs(filteredStops, appState.categories);
  }, [filteredStops, appState.categories]);

  // MTBF in ms
  const currentMtbfMs = useMemo(() => {
    const totalPlannedMs = (granularity === "day" ? 1 : granularity === "week" ? 7 : 30) * 16 * 3_600_000;
    const opTime = operatingTimeMs(totalPlannedMs, filteredStops, appState.categories, nowMs);
    return mtbfMs(filteredStops, appState.categories, opTime);
  }, [filteredStops, appState.categories, granularity, nowMs]);

  const stoppedStations = useMemo(() => {
    const stationsToCheck = selectedStationId === "all"
      ? appState.stations
      : appState.stations.filter((s) => s.id === selectedStationId);
    return stationsToCheck.filter((s) => appState.stationLive[s.id]?.state === "stopped");
  }, [appState.stations, appState.stationLive, selectedStationId]);

  const liveStationStatus = useMemo(() => {
    if (selectedStationId === "all") return null;
    return appState.stationLive[selectedStationId] ?? null;
  }, [selectedStationId, appState.stationLive]);

  // Stop Frequency by Station Data for chart
  const stationFrequencyData = useMemo(() => {
    const stations = selectedStationId === "all"
      ? appState.stations
      : appState.stations.filter((st) => st.id === selectedStationId);

    return stations.map((st) => {
      const count = filteredStops.filter((s) => s.stationId === st.id).length;
      const totalDuration = filteredStops
        .filter((s) => s.stationId === st.id)
        .reduce((acc, s) => acc + stopDurationMs(s, nowMs), 0);
      return {
        name: st.name.split(" ")[0] || st.name,
        fullName: st.name,
        count,
        durationMin: Math.round(totalDuration / 60_000),
      };
    });
  }, [appState.stations, filteredStops, nowMs, selectedStationId]);

  // Pareto Downtime by Category
  const paretoData = useMemo(() => {
    const raw = downtimeByCategory(filteredStops, appState.categories, nowMs);
    const totalDowntime = raw.reduce((sum, item) => sum + item.durationMs, 0);
    let cumulative = 0;
    return raw.map((item) => {
      cumulative += item.durationMs;
      const durationMin = Math.round(item.durationMs / 60_000);
      const cumulativePct = totalDowntime > 0 ? Math.round((cumulative / totalDowntime) * 100) : 0;
      return {
        name: item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name,
        fullName: item.name,
        durationMin,
        count: item.count,
        cumulativePct,
      };
    });
  }, [filteredStops, appState.categories, nowMs]);

  // MTTR & MTBF Trend Data (7 recent days) with station filter
  const trendData = useMemo(() => {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const dStart = dayStartMs(nowMs - i * 86_400_000);
      const dEnd = dStart + 86_400_000;
      const dStops = appState.stops.filter((s) => {
        const matchTime = s.startMs >= dStart && s.startMs < dEnd;
        const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
        return matchTime && matchStation;
      });
      const mttr = mttrMs(dStops, appState.categories);
      const op = operatingTimeMs(16 * 3_600_000, dStops, appState.categories, dEnd);
      const mtbf = mtbfMs(dStops, appState.categories, op);
      const dLabel = new Date(dStart).toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
      result.push({
        date: dLabel,
        mttrMin: mttr ? Math.round(mttr / 60_000) : 0,
        mtbfHour: mtbf ? Number((mtbf / 3_600_000).toFixed(1)) : 0,
      });
    }
    return result;
  }, [appState.stops, appState.categories, nowMs, selectedStationId]);

  // OEE Calculation from recent production records (affected by station filter)
  const oeeSummary = useMemo(() => {
    if (appState.productionRecords.length === 0) {
      return { availability: 0.88, performance: 0.85, quality: 0.98, oee: 0.73 };
    }
    const recordsToUse = selectedStation
      ? appState.productionRecords.filter((r) => r.areaId === selectedStation.areaId)
      : appState.productionRecords;

    const recentRecords = (recordsToUse.length > 0 ? recordsToUse : appState.productionRecords).slice(-7);
    let totalAvail = 0;
    let totalPerf = 0;
    let totalQual = 0;
    let totalOee = 0;

    for (const rec of recentRecords) {
      const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
      const recDateEnd = recDateStart + 86_400_000;
      const dayStops = appState.stops.filter((s) => {
        const matchDate = s.startMs >= recDateStart && s.startMs < recDateEnd;
        const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
        return matchDate && matchStation;
      });
      const dt = dayStops.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);
      const calc = computeOee(rec, dt);
      totalAvail += calc.availability;
      totalPerf += calc.performance;
      totalQual += calc.quality;
      totalOee += calc.oee;
    }

    const n = recentRecords.length;
    return {
      availability: totalAvail / n,
      performance: totalPerf / n,
      quality: totalQual / n,
      oee: totalOee / n,
    };
  }, [appState.productionRecords, appState.stops, selectedStation, selectedStationId]);

  const handleStationClick = (stId: string) => {
    const live = appState.stationLive[stId];
    if (live?.state === "running") {
      store.simulateStopTrigger(stId, "cat-2", "form");
      toast.error(`Stop manual dipicu pada stasiun ${stId}`);
    } else if (live?.state === "stopped") {
      store.simulateResumeStation(stId);
      toast.success(`Stasiun ${stId} dilanjutkan kembali`);
    }
  };

  const chartTooltipStyle = isDark
    ? { backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "8px", color: "#ffffff" }
    : { backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "8px", color: "#18181b", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" };

  const chartGridStroke = isDark ? "#222" : "#e5e7eb";
  const chartAxisStroke = isDark ? "#666" : "#71717a";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Title & Granularity / Station Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              {t("dash.title")}
            </h1>
            {selectedStation && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
                <span>{selectedStation.name}</span>
                <button
                  onClick={() => setSelectedStationId("all")}
                  className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                  title="Hapus filter stasiun"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedStation
              ? `Menampilkan analisis kinerja & metrik untuk stasiun ${selectedStation.name} (${selectedStation.id})`
              : t("dash.subtitle")}
          </p>
        </div>

        {/* Filter Controls Row: Station Filter (Left) + Granularity (Right) */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Station Filter (posisi di samping kiri tablist per day, week, month) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs shadow-2xs">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">{t("dash.stationFilter")}:</span>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="bg-transparent text-foreground font-semibold font-mono focus:outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="all" className="bg-card text-foreground">
                {t("dash.allStations")} ({appState.stations.length})
              </option>
              {appState.stations.map((st) => (
                <option key={st.id} value={st.id} className="bg-card text-foreground">
                  {st.name} ({st.id})
                </option>
              ))}
            </select>
          </div>

          {/* Granularity Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1 font-mono text-xs shadow-2xs">
            <span className="text-muted-foreground px-2">{t("dash.granularity")}:</span>
            {(["day", "week", "month"] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 rounded transition-colors ${
                  granularity === g
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {g === "day" ? t("dash.gran.day") : g === "week" ? t("dash.gran.week") : t("dash.gran.month")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Station Telemetry Strip */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-foreground font-bold">
              {selectedStation ? `Telemetri Live (${selectedStation.name})` : t("dash.liveNow")}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              (Klik stasiun untuk simulasi stop/resume)
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {stoppedStations.length > 0 ? (
              <span className="text-red-600 dark:text-red-400 font-bold">{stoppedStations.length} BERHENTI</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">SEMUA RUNNING</span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {appState.stations.map((station) => {
            const live = appState.stationLive[station.id];
            const isStopped = live?.state === "stopped";
            const isNoSignal = live?.state === "nosignal";
            const isStationFiltered = selectedStationId === station.id;
            const stoppedDuration = isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

            return (
              <button
                key={station.id}
                onClick={() => handleStationClick(station.id)}
                className={`relative flex flex-col justify-between p-3 rounded-lg border text-left transition-all hover:scale-[1.02] cursor-pointer shadow-2xs ${
                  isStationFiltered
                    ? "ring-2 ring-primary border-primary bg-primary/5 dark:bg-primary/10"
                    : isStopped
                    ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/40"
                    : isNoSignal
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-muted/20 hover:border-primary/30 text-foreground"
                } ${selectedStationId !== "all" && !isStationFiltered ? "opacity-65 hover:opacity-100" : ""}`}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div className="truncate">
                    <span className="font-mono text-[11px] font-bold tracking-tight text-foreground block truncate">
                      {station.name.split(" ")[0]}
                    </span>
                    {isStationFiltered && (
                      <span className="text-[9px] font-mono text-primary font-bold">● FILTER</span>
                    )}
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isStopped
                        ? "bg-red-500 animate-ping"
                        : isNoSignal
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Status:</span>
                    <span
                      className={`font-bold uppercase ${
                        isStopped ? "text-red-600 dark:text-red-400" : isNoSignal ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isStopped ? "STOP" : isNoSignal ? "NO SIG" : "RUN"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Speed:</span>
                    <span className="text-foreground font-semibold">
                      {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                    </span>
                  </div>

                  {isStopped && (
                    <div className="pt-1 mt-1 border-t border-red-500/20 text-[10px] font-mono text-red-600 dark:text-red-400 font-bold flex items-center justify-between">
                      <span>Downtime:</span>
                      <span>{fmtDuration(stoppedDuration)}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Stops Today */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.stopsToday")}</span>
            <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-3xl font-bold text-foreground tracking-tight">
              {stopsToday.length}
            </span>
            <span className="text-xs text-muted-foreground ml-1">kali</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {filteredStops.length} dalam {granularity}
          </div>
        </div>

        {/* 2. Total Downtime Today */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.downtimeToday")}</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {fmtDuration(totalDowntimeTodayMs)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {fmtMinutes(totalDowntimeTodayMs)} akumulasi
          </div>
        </div>

        {/* 3. Average Stop Duration */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.avgStop")}</span>
            <Activity className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-foreground tracking-tight">
              {averageStopTodayMs ? fmtDuration(averageStopTodayMs) : "0s"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Per kejadian hari ini
          </div>
        </div>

        {/* 4. MTTR */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.mttr")}</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {currentMttrMs ? `${Math.round(currentMttrMs / 60_000)}m` : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Mean Time to Repair
          </div>
        </div>

        {/* 5. MTBF */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.mtbf")}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {currentMtbfMs ? `${(currentMtbfMs / 3_600_000).toFixed(1)}h` : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Mean Time Between Failures
          </div>
        </div>

        {/* 6. Stations Stopped Currently / Status of Selected Station */}
        <div
          className={`rounded-xl border p-4 flex flex-col justify-between transition-colors shadow-xs ${
            stoppedStations.length > 0
              ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
              {selectedStation ? `Status ${selectedStation.name.split(" ")[0]}` : t("dash.stationsStopped")}
            </span>
            <AlertTriangle className={`h-4 w-4 ${stoppedStations.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-2">
            {selectedStation ? (
              <span className={`font-mono text-2xl font-bold tracking-tight uppercase ${
                liveStationStatus?.state === "stopped"
                  ? "text-red-600 dark:text-red-400"
                  : liveStationStatus?.state === "nosignal"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {liveStationStatus?.state === "stopped" ? "STOP" : liveStationStatus?.state === "nosignal" ? "NO SIG" : "RUNNING"}
              </span>
            ) : (
              <>
                <span className={`font-mono text-3xl font-bold tracking-tight ${stoppedStations.length > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {stoppedStations.length}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ {appState.stations.length}</span>
              </>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
            {selectedStation
              ? `Speed: ${liveStationStatus ? liveStationStatus.speed.toFixed(2) : "0.00"} ${selectedStation.speedUnit}`
              : stoppedStations.length > 0
              ? "Perlu tindakan segera"
              : "Semua stasiun aktif"}
          </div>
        </div>
      </div>

      {/* Charts Grid: MTTR/MTBF Trend & Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: MTTR & MTBF Trend */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Tren MTTR & MTBF (7 Hari Terakhir) {selectedStation ? `— ${selectedStation.name}` : ""}
              </h3>
              <p className="text-xs text-muted-foreground">
                MTTR (Menit) vs MTBF (Jam operasional antar breakdown)
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="date" stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="mttrMin"
                  name="MTTR (menit)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f43f5e" }}
                />
                <Line
                  type="monotone"
                  dataKey="mtbfHour"
                  name="MTBF (jam)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Stop Frequency by Station */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {selectedStation ? `Kejadian Line-Stop: ${selectedStation.name}` : t("dash.frequency")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedStation ? "Frekuensi dan durasi stasiun terpilih" : "Jumlah kejadian line-stop per stasiun"}
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationFrequencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="name" stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={{ fontWeight: "bold" }}
                  formatter={(val, name, item) => [`${val} kali (${item.payload.durationMin} min)`, "Frekuensi"]}
                />
                <Bar dataKey="count" fill="currentColor" radius={[4, 4, 0, 0]}>
                  {stationFrequencyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.count >= 4 ? "#ef4444" : entry.count >= 2 ? "#f59e0b" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Pareto Downtime by Category & OEE Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pareto Downtime by Category (2 cols on LG) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {selectedStation ? `Pareto Kategori: ${selectedStation.name}` : t("dash.pareto")}
              </h3>
              <p className="text-xs text-muted-foreground">
                Kategori penyebab stop terlama (prinsip Pareto 80/20)
              </p>
            </div>
          </div>
          {paretoData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
              {t("dash.noData")}
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paretoData.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis type="number" stroke={chartAxisStroke} fontSize={11} tickLine={false} unit="m" />
                  <YAxis type="category" dataKey="name" stroke={chartAxisStroke} fontSize={11} tickLine={false} width={130} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ fontWeight: "bold" }}
                    formatter={(val, name, item) => [
                      `${val} menit (${item.payload.count}× kejadian, kumulatif: ${item.payload.cumulativePct}%)`,
                      "Durasi",
                    ]}
                  />
                  <Bar dataKey="durationMin" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* OEE Overview Card (1 col on LG) */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-foreground">
                {selectedStation ? `OEE Area — ${selectedStation.name}` : `${t("dash.oee")} — Overall Equipment Effectiveness`}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedStation ? `Estimasi efektivitas area ${selectedStation.areaId}` : t("dash.oeeNote")}
            </p>

            {/* Big OEE Number */}
            <div className="my-5 p-4 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-muted-foreground block font-bold">
                  Overall OEE Score
                </span>
                <span className="text-4xl font-bold font-mono tracking-tight text-foreground">
                  {(oeeSummary.oee * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs font-mono font-bold ${
                    oeeSummary.oee >= 0.85
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : oeeSummary.oee >= 0.7
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
                  }`}
                >
                  {oeeSummary.oee >= 0.85 ? "World Class" : oeeSummary.oee >= 0.7 ? "Moderate" : "Needs Action"}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1 font-mono">
                  Target: 85.0%
                </span>
              </div>
            </div>

            {/* Availability, Performance, Quality 3 Bars */}
            <div className="space-y-3.5">
              {/* Availability */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">{t("dash.availability")} (A):</span>
                  <span className="text-foreground font-bold">{(oeeSummary.availability * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.availability * 100)}%` }}
                  />
                </div>
              </div>

              {/* Performance */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">{t("dash.performance")} (P):</span>
                  <span className="text-foreground font-bold">{(oeeSummary.performance * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.performance * 100)}%` }}
                  />
                </div>
              </div>

              {/* Quality */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">{t("dash.quality")} (Q):</span>
                  <span className="text-foreground font-bold">{(oeeSummary.quality * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.quality * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-mono">Rumus: A × P × Q</span>
            <a
              href="/web/production"
              className="text-foreground hover:underline font-medium inline-flex items-center gap-1 font-mono text-[11px]"
            >
              Kelola Produksi <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
