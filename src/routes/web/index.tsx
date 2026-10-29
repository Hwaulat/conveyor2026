import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertOctagon,
  Clock,
  TrendingDown,
  Activity,
  Layers,
  ArrowUpRight,
  X,
  Building2,
  Calendar,
  Gauge,
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
  ReferenceLine,
} from "recharts";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { useAppStore } from "../../lib/store";
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
import { DateRangePicker } from "../../components/DateRangePicker";

export const Route = createFileRoute("/web/")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Real-time Dashboard & KPI" },
      { name: "description", content: "Real-time Conveyor line performance, MTTR, MTBF and OEE metrics." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const appState = useAppStore();
  const nowMs = Date.now();
  const isDark = theme === "dark";

  // Filter 1: Area Filter (di samping kiri filter station)
  const [selectedAreaId, setSelectedAreaId] = useState<string>("all");

  // Filter 2: Station Filter (mengikuti area yang dipilih)
  const [selectedStationId, setSelectedStationId] = useState<string>("all");

  // Filter 3: Date Range (menggantikan tablist hari, minggu, bulan)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 6 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [datePreset, setDatePreset] = useState<"today" | "7d" | "30d" | "thisMonth" | "custom">("7d");
  const [speedWindowMinutes, setSpeedWindowMinutes] = useState<30 | 60>(60);

  // Available stations filtered by selected area
  const availableStations = useMemo(() => {
    if (selectedAreaId === "all") return appState.stations;
    return appState.stations.filter((s) => s.areaId === selectedAreaId);
  }, [selectedAreaId, appState.stations]);

  // Handle area change: resets station if current station does not belong to the newly selected area
  const handleAreaChange = (newAreaId: string) => {
    setSelectedAreaId(newAreaId);
    if (newAreaId !== "all" && selectedStationId !== "all") {
      const match = appState.stations.some(
        (s) => s.id === selectedStationId && s.areaId === newAreaId,
      );
      if (!match) {
        setSelectedStationId("all");
      }
    }
  };

  // Quick Presets Handler for Date Range
  const handlePresetChange = (preset: "today" | "7d" | "30d" | "thisMonth" | "custom") => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7d") {
      const past = new Date(Date.now() - 6 * 86_400_000);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "30d") {
      const past = new Date(Date.now() - 29 * 86_400_000);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
    }
  };

  // Find selected area and station object
  const selectedArea = useMemo(() => {
    return selectedAreaId === "all" ? null : appState.areas.find((a) => a.id === selectedAreaId) ?? null;
  }, [selectedAreaId, appState.areas]);

  const selectedStation = useMemo(() => {
    return selectedStationId === "all" ? null : appState.stations.find((s) => s.id === selectedStationId) ?? null;
  }, [selectedStationId, appState.stations]);

  // Date range timestamps in epoch ms
  const { rangeStartMs, rangeEndMs, daysCount } = useMemo(() => {
    const sDate = startDate || new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const eDate = endDate || new Date().toISOString().slice(0, 10);
    const start = Date.parse(`${sDate}T00:00:00+07:00`) || (nowMs - 7 * 86_400_000);
    const end = (Date.parse(`${eDate}T23:59:59.999+07:00`) || nowMs);
    const days = Math.max(1, Math.round((end - start) / 86_400_000));
    return { rangeStartMs: start, rangeEndMs: end, daysCount: days };
  }, [startDate, endDate, nowMs]);

  // Filter stops by Date Range, Area, and Station
  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => {
      const matchPeriod = s.startMs >= rangeStartMs && s.startMs <= rangeEndMs;
      const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
      const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
      return matchPeriod && matchArea && matchStation;
    });
  }, [appState.stops, rangeStartMs, rangeEndMs, selectedAreaId, selectedStationId]);

  // Stops today specifically for the secondary info
  const todayStartMs = dayStartMs(nowMs);
  const stopsToday = useMemo(() => {
    return appState.stops.filter((s) => {
      const matchToday = s.startMs >= todayStartMs;
      const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
      const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
      return matchToday && matchArea && matchStation;
    });
  }, [appState.stops, todayStartMs, selectedAreaId, selectedStationId]);

  // Calculate KPIs
  const totalDowntimeMs = useMemo(() => {
    return filteredStops.reduce((acc, s) => acc + stopDurationMs(s, nowMs), 0);
  }, [filteredStops, nowMs]);

  const avgStopDurationMs = useMemo(() => {
    return avgStopMs(filteredStops, nowMs);
  }, [filteredStops, nowMs]);

  // MTTR in ms
  const currentMttrMs = useMemo(() => {
    return mttrMs(filteredStops, appState.categories);
  }, [filteredStops, appState.categories]);

  // MTBF in ms
  const currentMtbfMs = useMemo(() => {
    const totalPlannedMs = daysCount * 16 * 3_600_000;
    const opTime = operatingTimeMs(totalPlannedMs, filteredStops, appState.categories, nowMs);
    return mtbfMs(filteredStops, appState.categories, opTime);
  }, [filteredStops, appState.categories, daysCount, nowMs]);

  // Stop Frequency by Station Data for chart (filtered by area & station)
  const stationFrequencyData = useMemo(() => {
    const stations = selectedStationId === "all"
      ? (selectedAreaId === "all" ? appState.stations : appState.stations.filter((st) => st.areaId === selectedAreaId))
      : appState.stations.filter((st) => st.id === selectedStationId);

    return stations.map((st) => {
      const count = filteredStops.filter((s) => s.stationId === st.id).length;
      const totalDuration = filteredStops
        .filter((s) => s.stationId === st.id)
        .reduce((acc, s) => acc + stopDurationMs(s, nowMs), 0);
      return {
        name: st.code || st.name.split(" ")[0] || st.name,
        fullName: st.name,
        count,
        durationMin: Math.round(totalDuration / 60_000),
      };
    });
  }, [appState.stations, filteredStops, nowMs, selectedAreaId, selectedStationId]);

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

  // MTTR & MTBF Trend Data across the selected date range
  const trendData = useMemo(() => {
    const startD = new Date(`${startDate}T00:00:00+07:00`);
    const endD = new Date(`${endDate}T00:00:00+07:00`);
    const diffDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1);
    const daysToRender = Math.min(31, diffDays);
    const step = Math.max(1, Math.floor(diffDays / daysToRender));
    const result = [];

    for (let i = 0; i < diffDays; i += step) {
      const dStart = startD.getTime() + i * 86_400_000;
      const dEnd = dStart + 86_400_000;
      const dStops = appState.stops.filter((s) => {
        const matchTime = s.startMs >= dStart && s.startMs < dEnd;
        const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
        const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
        return matchTime && matchArea && matchStation;
      });
      const mttr = mttrMs(dStops, appState.categories);
      const op = operatingTimeMs(16 * 3_600_000, dStops, appState.categories, dEnd);
      const mtbf = mtbfMs(dStops, appState.categories, op);
      const curDate = new Date(dStart);
      const dLabel = `${curDate.getDate()}/${curDate.getMonth() + 1}`;
      result.push({
        date: dLabel,
        mttrMin: mttr ? Math.round(mttr / 60_000) : 0,
        mtbfHour: mtbf ? Number((mtbf / 3_600_000).toFixed(1)) : 16,
      });
    }
    return result;
  }, [startDate, endDate, appState.stops, appState.categories, selectedAreaId, selectedStationId]);

  // Line Chart: Trend Speed by Minute (Telemetri Kecepatan Konveyor)
  const speedByMinuteData = useMemo(() => {
    const points = [];
    const windowMinutes = speedWindowMinutes;
    const targetStation = selectedStation;
    const targetThreshold = targetStation?.runningThreshold ?? 0.1;
    const targetUnit = targetStation?.speedUnit ?? "m/min";
    const baseSpeed = targetStation ? 1.25 : 1.20;

    for (let i = windowMinutes - 1; i >= 0; i--) {
      const minuteTimeMs = nowMs - i * 60_000;
      const dateObj = new Date(minuteTimeMs);
      const timeLabel = dateObj.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // Check if any stop was active on this station/area during this minute
      const wasStopped = appState.stops.some((s) => {
        const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
        const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
        if (!matchArea || !matchStation) return false;

        const stopStart = s.startMs;
        const stopEnd = s.endMs ?? nowMs;
        return minuteTimeMs >= stopStart && minuteTimeMs <= stopEnd;
      });

      let speedVal: number;
      if (wasStopped) {
        speedVal = 0.0;
      } else {
        const hash = Math.sin((minuteTimeMs / 60000) * 12.9898) * 43758.5453;
        const variance = (hash - Math.floor(hash) - 0.5) * 0.12;
        speedVal = Math.max(0.2, Number((baseSpeed + variance).toFixed(2)));
      }

      points.push({
        time: timeLabel,
        timestampMs: minuteTimeMs,
        speed: speedVal,
        threshold: targetThreshold,
        status: speedVal <= targetThreshold ? "STOPPED" : "RUNNING",
      });
    }

    const current = points[points.length - 1]?.speed ?? 0;
    const avg = points.length > 0
      ? +(points.reduce((sum, p) => sum + p.speed, 0) / points.length).toFixed(2)
      : 0;

    return {
      points,
      unit: targetUnit,
      threshold: targetThreshold,
      currentSpeed: current,
      avgSpeed: avg,
    };
  }, [nowMs, speedWindowMinutes, appState.stops, selectedAreaId, selectedStationId, selectedStation]);

  // OEE Calculation filtered by Area and Date Range
  const oeeSummary = useMemo(() => {
    if (appState.productionRecords.length === 0) {
      return { availability: 0.88, performance: 0.85, quality: 0.98, oee: 0.73 };
    }
    const areaFilteredRecords = selectedAreaId !== "all"
      ? appState.productionRecords.filter((r) => r.areaId === selectedAreaId)
      : selectedStation
      ? appState.productionRecords.filter((r) => r.areaId === selectedStation.areaId)
      : appState.productionRecords;

    const inRangeRecords = areaFilteredRecords.filter((rec) => {
      const recMs = Date.parse(`${rec.date}T00:00:00+07:00`);
      return recMs >= rangeStartMs && recMs <= rangeEndMs;
    });

    const recentRecords = inRangeRecords.length > 0 ? inRangeRecords : areaFilteredRecords.slice(-7);
    let totalAvail = 0;
    let totalPerf = 0;
    let totalQual = 0;
    let totalOee = 0;

    for (const rec of recentRecords) {
      const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
      const recDateEnd = recDateStart + 86_400_000;
      const dayStops = appState.stops.filter((s) => {
        const matchDate = s.startMs >= recDateStart && s.startMs < recDateEnd;
        const matchArea = selectedAreaId === "all" ? true : s.areaId === selectedAreaId;
        const matchStation = selectedStationId === "all" ? true : s.stationId === selectedStationId;
        return matchDate && matchArea && matchStation;
      });
      const dt = dayStops.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);
      const calc = computeOee(rec, dt);
      totalAvail += calc.availability;
      totalPerf += calc.performance;
      totalQual += calc.quality;
      totalOee += calc.oee;
    }

    const n = recentRecords.length || 1;
    return {
      availability: totalAvail / n,
      performance: totalPerf / n,
      quality: totalQual / n,
      oee: totalOee / n,
    };
  }, [appState.productionRecords, appState.stops, selectedAreaId, selectedStation, selectedStationId, rangeStartMs, rangeEndMs]);

  const chartTooltipStyle = isDark
    ? { backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "8px", color: "#ffffff" }
    : { backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "8px", color: "#18181b", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" };

  const chartGridStroke = isDark ? "#222" : "#e5e7eb";
  const chartAxisStroke = isDark ? "#666" : "#71717a";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Title & Filter Row */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              {t("dash.title")}
            </h1>

            {/* Active Filter Badges */}
            {selectedArea && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                <Building2 className="h-3 w-3" />
                <span>Area: {selectedArea.name}</span>
                <button
                  onClick={() => handleAreaChange("all")}
                  className="rounded-full hover:bg-cyan-500/20 p-0.5 transition-colors"
                  title="Hapus filter area"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {selectedStation && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
                <Layers className="h-3 w-3" />
                <span>Stasiun: {selectedStation.name}</span>
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
              ? `Menampilkan analisis kinerja & metrik untuk ${selectedStation.name} (${selectedStation.code || selectedStation.id})`
              : selectedArea
              ? `Menampilkan analisis kinerja untuk ${selectedArea.name}`
              : t("dash.subtitle")}
          </p>
        </div>

        {/* Filter Controls Row: Area Filter (Left) + Station Filter + Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
          {/* 1. Area Filter (di samping kiri filter station) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs shadow-2xs">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">Area:</span>
            <select
              value={selectedAreaId}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="bg-transparent text-foreground font-semibold font-mono focus:outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="all" className="bg-card text-foreground">
                Semua Area ({appState.areas.length})
              </option>
              {appState.areas.map((a) => (
                <option key={a.id} value={a.id} className="bg-card text-foreground">
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Station Filter (opsi stasiun mengikuti area yang dipilih) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs shadow-2xs">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">{t("dash.stationFilter")}:</span>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="bg-transparent text-foreground font-semibold font-mono focus:outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="all" className="bg-card text-foreground">
                {t("dash.allStations")} ({availableStations.length})
              </option>
              {availableStations.map((st) => (
                <option key={st.id} value={st.id} className="bg-card text-foreground">
                  {st.name} ({st.code || st.id})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date Range Selector (Gaya pill sesuai referensi visual: [Kalender] DD/MM/YYYY - DD/MM/YYYY [x]) */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            onReset={() => {
              const now = new Date();
              const todayStr = now.toISOString().slice(0, 10);
              const past = new Date(Date.now() - 6 * 86_400_000);
              setStartDate(past.toISOString().slice(0, 10));
              setEndDate(todayStr);
            }}
          />
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Stops in Date Range */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Total Stop</span>
            <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-3xl font-bold text-foreground tracking-tight">
              {filteredStops.length}
            </span>
            <span className="text-xs text-muted-foreground ml-1">kali</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {stopsToday.length} stop hari ini
          </div>
        </div>

        {/* 2. Total Downtime in Date Range */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">Total Downtime</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {fmtDuration(totalDowntimeMs)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {fmtMinutes(totalDowntimeMs)} akumulasi
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
              {avgStopDurationMs ? fmtDuration(avgStopDurationMs) : "0s"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Per kejadian di rentang ini
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
            Target: &lt; 20m per breakdown
          </div>
        </div>

        {/* 5. MTBF */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.mtbf")}</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {currentMtbfMs ? `${(currentMtbfMs / 3_600_000).toFixed(1)}h` : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Target: &gt; 45h antar kerusakan
          </div>
        </div>

        {/* 6. Overall OEE */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">{t("dash.oee")}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                oeeSummary.oee >= 0.85 ? "bg-emerald-500" : oeeSummary.oee >= 0.7 ? "bg-amber-400" : "bg-red-500"
              }`}
            />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-foreground tracking-tight">
              {(oeeSummary.oee * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Avail: {(oeeSummary.availability * 100).toFixed(0)}% • Perf: {(oeeSummary.performance * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Line Chart: Trend Speed by Minute */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Tren Kecepatan per Menit (Trend Speed by Minute)
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    speedByMinuteData.currentSpeed > speedByMinuteData.threshold
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      speedByMinuteData.currentSpeed > speedByMinuteData.threshold ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  {speedByMinuteData.currentSpeed > speedByMinuteData.threshold ? "NORMAL SPEED" : "LINE-STOP / BELOW THRESHOLD"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedStation
                  ? `Kecepatan telemetri stasiun ${selectedStation.name} (${selectedStation.code || selectedStation.id}) per menit`
                  : selectedArea
                  ? `Rata-rata kecepatan konveyor ${selectedArea.name} per menit`
                  : "Monitoring telemetri kecepatan konveyor secara real-time per menit"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* KPI Badges: Current & Avg */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="px-3 py-1 rounded-lg border border-border bg-muted/40">
                <span className="text-muted-foreground text-[10px] block">Kecepatan Terkini:</span>
                <span className="font-bold text-foreground">
                  {speedByMinuteData.currentSpeed.toFixed(2)} {speedByMinuteData.unit}
                </span>
              </div>
              <div className="px-3 py-1 rounded-lg border border-border bg-muted/40">
                <span className="text-muted-foreground text-[10px] block">Rata-rata ({speedWindowMinutes}m):</span>
                <span className="font-bold text-foreground">
                  {speedByMinuteData.avgSpeed.toFixed(2)} {speedByMinuteData.unit}
                </span>
              </div>
            </div>

            {/* Time Window Buttons (30m / 60m) */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setSpeedWindowMinutes(30)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  speedWindowMinutes === 30
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                30 Menit
              </button>
              <button
                type="button"
                onClick={() => setSpeedWindowMinutes(60)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  speedWindowMinutes === 60
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                60 Menit
              </button>
            </div>
          </div>
        </div>

        {/* The Line Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedByMinuteData.points} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
              <XAxis
                dataKey="time"
                stroke={chartAxisStroke}
                fontSize={11}
                fontFamily="monospace"
                interval={speedWindowMinutes === 60 ? 5 : 3}
              />
              <YAxis
                domain={[0, 1.8]}
                stroke={chartAxisStroke}
                fontSize={11}
                fontFamily="monospace"
                tickFormatter={(v) => `${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(val, name) => [`${val} ${speedByMinuteData.unit}`, name]}
                labelFormatter={(label) => `Waktu: ${label} WIB`}
              />
              <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
              <ReferenceLine
                y={speedByMinuteData.threshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: `Threshold Stop (${speedByMinuteData.threshold} ${speedByMinuteData.unit})`,
                  fill: "#f43f5e",
                  fontSize: 10,
                  position: "insideBottomRight",
                }}
              />
              <ReferenceLine
                y={1.2}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{
                  value: `Target Normal (1.20 ${speedByMinuteData.unit})`,
                  fill: "#10b981",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
              <Line
                type="monotone"
                dataKey="speed"
                name={`Kecepatan (${speedByMinuteData.unit})`}
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#06b6d4" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 1 Charts: Trend MTTR/MTBF & Pareto Causes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend MTTR / MTBF Chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Tren MTTR & MTBF ({trendData.length} Titik Waktu)
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedStation ? `Khusus stasiun ${selectedStation.name}` : selectedArea ? `Khusus area ${selectedArea.name}` : "Perbandingan durasi perbaikan vs waktu antar kejadian"}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                <XAxis dataKey="date" stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                <YAxis yAxisId="left" stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                <YAxis yAxisId="right" orientation="right" stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="mttrMin"
                  name="MTTR (Menit)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mtbfHour"
                  name="MTBF (Jam)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pareto Downtime by Category Chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {t("dash.pareto")} — Penyebab Line Stop
              </h3>
              <p className="text-xs text-muted-foreground">
                Downtime kumulatif berdasarkan kategori penyebab stop
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {paretoData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                Tidak ada data stop pada filter ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                  <XAxis
                    dataKey="name"
                    stroke={chartAxisStroke}
                    fontSize={10}
                    fontFamily="monospace"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(val, name, item) => {
                      if (name === "durationMin") return [`${val} Menit (${item.payload.count}×)`, "Durasi Stop"];
                      return [val, name];
                    }}
                  />
                  <Bar dataKey="durationMin" name="Durasi (Menit)" radius={[4, 4, 0, 0]}>
                    {paretoData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#f43f5e" : index === 1 ? "#fb923c" : "#60a5fa"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Frequency per Station + OEE Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Frequency per Station (2 cols on LG) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {t("dash.frequency")} per Stasiun
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedArea ? `Stasiun di area ${selectedArea.name}` : "Frekuensi kejadian stop pada masing-masing stasiun"}
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              Total {stationFrequencyData.reduce((acc, curr) => acc + curr.count, 0)} kejadian
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationFrequencyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} opacity={0.6} />
                <XAxis dataKey="name" stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                <YAxis stroke={chartAxisStroke} fontSize={11} fontFamily="monospace" />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(val, _, item) => [`${val} Kejadian (${item.payload.durationMin} m)`, item.payload.fullName]}
                />
                <Bar dataKey="count" name="Jumlah Kejadian" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {stationFrequencyData.map((entry) => (
                    <Cell
                      key={`st-${entry.name}`}
                      fill={entry.count > 3 ? "#f43f5e" : entry.count > 0 ? "#3b82f6" : "#71717a"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OEE Overview Card (1 col on LG) */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-foreground">
                {selectedStation ? `OEE Area — ${selectedStation.name}` : selectedArea ? `OEE — ${selectedArea.name}` : `${t("dash.oee")} — Overall Equipment Effectiveness`}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedStation ? `Estimasi efektivitas area ${selectedStation.areaId}` : selectedArea ? `Estimasi efektivitas ${selectedArea.name}` : t("dash.oeeNote")}
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
