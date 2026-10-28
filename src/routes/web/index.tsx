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
      { title: "JSGI — Real-time Dashboard & KPI" },
      { name: "description", content: "Real-time Conveyor line performance, MTTR, MTBF and OEE metrics." },
    ],
  }),
  component: DashboardPage,
});

type Granularity = "day" | "week" | "month";

function DashboardPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const nowMs = Date.now();

  // Filter stops by granularity period
  const periodStartMs = useMemo(() => {
    if (granularity === "day") return dayStartMs(nowMs);
    if (granularity === "week") return nowMs - 7 * 86_400_000;
    return nowMs - 30 * 86_400_000;
  }, [granularity, nowMs]);

  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= periodStartMs);
  }, [appState.stops, periodStartMs]);

  // Stops today specifically for the today KPI card
  const todayStartMs = dayStartMs(nowMs);
  const stopsToday = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= todayStartMs);
  }, [appState.stops, todayStartMs]);

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
    // Operating time = total planned runtime across the stations or calculated
    const totalPlannedMs = (granularity === "day" ? 1 : granularity === "week" ? 7 : 30) * 16 * 3_600_000;
    const opTime = operatingTimeMs(totalPlannedMs, filteredStops, appState.categories, nowMs);
    return mtbfMs(filteredStops, appState.categories, opTime);
  }, [filteredStops, appState.categories, granularity, nowMs]);

  const stoppedStations = useMemo(() => {
    return appState.stations.filter((s) => appState.stationLive[s.id]?.state === "stopped");
  }, [appState.stations, appState.stationLive]);

  // Stop Frequency by Station Data for chart
  const stationFrequencyData = useMemo(() => {
    return appState.stations.map((st) => {
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
  }, [appState.stations, filteredStops, nowMs]);

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

  // MTTR & MTBF Trend Data (7 recent days)
  const trendData = useMemo(() => {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const dStart = dayStartMs(nowMs - i * 86_400_000);
      const dEnd = dStart + 86_400_000;
      const dStops = appState.stops.filter((s) => s.startMs >= dStart && s.startMs < dEnd);
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
  }, [appState.stops, appState.categories, nowMs]);

  // OEE Calculation from recent production records
  const oeeSummary = useMemo(() => {
    if (appState.productionRecords.length === 0) {
      return { availability: 0.88, performance: 0.85, quality: 0.98, oee: 0.73 };
    }
    const recentRecords = appState.productionRecords.slice(-7);
    let totalAvail = 0;
    let totalPerf = 0;
    let totalQual = 0;
    let totalOee = 0;

    for (const rec of recentRecords) {
      // Find downtime on that date
      const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
      const recDateEnd = recDateStart + 86_400_000;
      const dayStops = appState.stops.filter((s) => s.startMs >= recDateStart && s.startMs < recDateEnd);
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
  }, [appState.productionRecords, appState.stops]);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Title & Granularity Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            {t("dash.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("dash.subtitle")}
          </p>
        </div>

        {/* Granularity Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-white/10 bg-[#121215] p-1 font-mono text-xs">
          <span className="text-muted-foreground px-2">{t("dash.granularity")}:</span>
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 rounded transition-colors ${
                granularity === g
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {g === "day" ? t("dash.gran.day") : g === "week" ? t("dash.gran.week") : t("dash.gran.month")}
            </button>
          ))}
        </div>
      </div>

      {/* Live Station Telemetry Strip */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-white font-semibold">
              {t("dash.liveNow")}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              (Klik stasiun untuk simulasi stop/resume)
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {stoppedStations.length > 0 ? (
              <span className="text-red-400 font-bold">{stoppedStations.length} BERHENTI</span>
            ) : (
              <span className="text-emerald-400 font-medium">SEMUA RUNNING</span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {appState.stations.map((station) => {
            const live = appState.stationLive[station.id];
            const isStopped = live?.state === "stopped";
            const isNoSignal = live?.state === "nosignal";
            const stoppedDuration = isStopped && live?.stoppedSinceMs ? nowMs - live.stoppedSinceMs : 0;

            return (
              <button
                key={station.id}
                onClick={() => handleStationClick(station.id)}
                className={`relative flex flex-col justify-between p-3 rounded-lg border text-left transition-all hover:scale-[1.02] cursor-pointer ${
                  isStopped
                    ? "border-red-500/50 bg-red-950/20 text-white shadow-lg shadow-red-950/30 ring-1 ring-red-500/30"
                    : isNoSignal
                    ? "border-amber-500/30 bg-amber-950/20 text-white"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20 text-white"
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <span className="font-mono text-[11px] font-bold tracking-tight text-white truncate">
                    {station.name.split(" ")[0]}
                  </span>
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
                        isStopped ? "text-red-400" : isNoSignal ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {isStopped ? "STOP" : isNoSignal ? "NO SIG" : "RUN"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Speed:</span>
                    <span className="text-white">
                      {isStopped ? "0.00" : live ? live.speed.toFixed(2) : "0.00"} {station.speedUnit}
                    </span>
                  </div>

                  {isStopped && (
                    <div className="pt-1 mt-1 border-t border-red-500/20 text-[10px] font-mono text-red-400 font-bold flex items-center justify-between">
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
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.stopsToday")}</span>
            <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-3xl font-bold text-white tracking-tight">
              {stopsToday.length}
            </span>
            <span className="text-xs text-muted-foreground ml-1">kali</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {filteredStops.length} dalam {granularity}
          </div>
        </div>

        {/* 2. Total Downtime Today */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.downtimeToday")}</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-amber-400 tracking-tight">
              {fmtDuration(totalDowntimeTodayMs)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {fmtMinutes(totalDowntimeTodayMs)} akumulasi
          </div>
        </div>

        {/* 3. Average Stop Duration */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.avgStop")}</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight">
              {averageStopTodayMs ? fmtDuration(averageStopTodayMs) : "0s"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Per kejadian hari ini
          </div>
        </div>

        {/* 4. MTTR */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.mttr")}</span>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-rose-400 tracking-tight">
              {currentMttrMs ? `${Math.round(currentMttrMs / 60_000)}m` : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Mean Time to Repair
          </div>
        </div>

        {/* 5. MTBF */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.mtbf")}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-emerald-400 tracking-tight">
              {currentMtbfMs ? `${(currentMtbfMs / 3_600_000).toFixed(1)}h` : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Mean Time Between Failures
          </div>
        </div>

        {/* 6. Stations Stopped Currently */}
        <div
          className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
            stoppedStations.length > 0
              ? "border-red-500/40 bg-red-950/20"
              : "border-white/10 bg-[#0d0d10]"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("dash.stationsStopped")}</span>
            <AlertTriangle className={`h-4 w-4 ${stoppedStations.length > 0 ? "text-red-400" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-2">
            <span className={`font-mono text-3xl font-bold tracking-tight ${stoppedStations.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {stoppedStations.length}
            </span>
            <span className="text-xs text-muted-foreground ml-1">/ {appState.stations.length}</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            {stoppedStations.length > 0 ? "Perlu tindakan segera" : "Semua stasiun aktif"}
          </div>
        </div>
      </div>

      {/* Charts Grid: MTTR/MTBF Trend & Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: MTTR & MTBF Trend */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Tren MTTR & MTBF (7 Hari Terakhir)
              </h3>
              <p className="text-xs text-muted-foreground">
                MTTR (Menit) vs MTBF (Jam operasional antar breakdown)
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#000", border: "1px solid #333", borderRadius: "6px" }}
                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
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
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                {t("dash.frequency")}
              </h3>
              <p className="text-xs text-muted-foreground">
                Jumlah kejadian line-stop per stasiun
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationFrequencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#000", border: "1px solid #333", borderRadius: "6px" }}
                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                  formatter={(val, name, item) => [`${val} kali (${item.payload.durationMin} min)`, "Frekuensi"]}
                />
                <Bar dataKey="count" fill="#fff" radius={[4, 4, 0, 0]}>
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
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#0d0d10] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                {t("dash.pareto")}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis type="number" stroke="#666" fontSize={11} tickLine={false} unit="m" />
                  <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} tickLine={false} width={130} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#000", border: "1px solid #333", borderRadius: "6px" }}
                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
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
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-white">
                {t("dash.oee")} — Overall Equipment Effectiveness
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dash.oeeNote")}
            </p>

            {/* Big OEE Number */}
            <div className="my-5 p-4 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                  Overall OEE Score
                </span>
                <span className="text-4xl font-bold font-mono tracking-tight text-white">
                  {(oeeSummary.oee * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs font-mono font-bold ${
                    oeeSummary.oee >= 0.85
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : oeeSummary.oee >= 0.7
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
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
                  <span className="text-white font-bold">{(oeeSummary.availability * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.availability * 100)}%` }}
                  />
                </div>
              </div>

              {/* Performance */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">{t("dash.performance")} (P):</span>
                  <span className="text-white font-bold">{(oeeSummary.performance * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.performance * 100)}%` }}
                  />
                </div>
              </div>

              {/* Quality */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">{t("dash.quality")} (Q):</span>
                  <span className="text-white font-bold">{(oeeSummary.quality * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${Math.min(100, oeeSummary.quality * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-mono">Rumus: A × P × Q</span>
            <a
              href="/web/production"
              className="text-white hover:underline font-medium inline-flex items-center gap-1 font-mono text-[11px]"
            >
              Kelola Produksi <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
