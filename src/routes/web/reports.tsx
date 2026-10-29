import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Activity,
  TrendingDown,
  Search,
  Check,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import {
  mttrMs,
  mtbfMs,
  computeOee,
  stopDurationMs,
  neutralizeExcelCell,
} from "../../lib/calc";
import { fmtDateTime, fmtDateKey, fmtDuration, dayStartMs } from "../../lib/format";
import { toast } from "sonner";
import { TablePagination } from "../../components/TablePagination";
import { ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/web/reports")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Reports & Excel Export" },
      { name: "description", content: "Pratinjau data laporan produksi, MTTR, MTBF, dan Line-Stop serta ekspor ke Excel." },
    ],
  }),
  component: ReportsPage,
});

type ReportPeriod = "today" | "7d" | "30d" | "all";
type ReportType = "stop-summary" | "mttr-mtbf" | "oee" | "log-detail";

function ReportsPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  const [period, setPeriod] = useState<ReportPeriod>("7d");
  const [activeReport, setActiveReport] = useState<ReportType>("stop-summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

  const periodStartMs = useMemo(() => {
    if (period === "today") return dayStartMs(nowMs);
    if (period === "7d") return nowMs - 7 * 86_400_000;
    if (period === "30d") return nowMs - 30 * 86_400_000;
    return 0;
  }, [period, nowMs]);

  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= periodStartMs);
  }, [appState.stops, periodStartMs]);

  // --- 1. Dataset: Stop Summary ---
  const stopSummaryData = useMemo(() => {
    return appState.stations.map((station) => {
      const stStops = filteredStops.filter((s) => s.stationId === station.id);
      const totalDur = stStops.reduce((sum, s) => sum + stopDurationMs(s, nowMs), 0);
      const avgDur = stStops.length > 0 ? totalDur / stStops.length : 0;
      const breakdowns = stStops.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        return cat?.countsAsBreakdown;
      });

      return {
        stationId: station.id,
        stationName: station.name,
        conveyorId: station.conveyorId,
        totalStops: stStops.length,
        breakdownStops: breakdowns.length,
        totalDowntimeMs: totalDur,
        avgDurationMs: avgDur,
        thresholdSpeed: `${station.runningThreshold} ${station.speedUnit}`,
      };
    });
  }, [appState.stations, filteredStops, appState.categories, nowMs]);

  const filteredStopSummary = useMemo(() => {
    if (!searchQuery.trim()) return stopSummaryData;
    const q = searchQuery.toLowerCase();
    return stopSummaryData.filter(
      (r) =>
        r.stationName.toLowerCase().includes(q) ||
        r.conveyorId.toLowerCase().includes(q) ||
        r.stationId.toLowerCase().includes(q),
    );
  }, [stopSummaryData, searchQuery]);

  // --- 2. Dataset: MTTR & MTBF ---
  const mttrData = useMemo(() => {
    const days = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const operatingMs = days * 16 * 3_600_000;

    return appState.stations.map((station) => {
      const stStops = filteredStops.filter((s) => s.stationId === station.id);
      const mttr = mttrMs(stStops, appState.categories);
      const mtbf = mtbfMs(stStops, appState.categories, operatingMs);
      const breakdowns = stStops.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        return cat?.countsAsBreakdown;
      });
      const totalDowntime = breakdowns.reduce((sum, s) => sum + stopDurationMs(s, nowMs), 0);

      return {
        stationId: station.id,
        stationName: station.name,
        periodDays: days,
        breakdownCount: breakdowns.length,
        totalDowntimeMs: totalDowntime,
        mttrMs: mttr,
        mtbfMs: mtbf,
        operatingHours: operatingMs / 3_600_000,
      };
    });
  }, [appState.stations, filteredStops, appState.categories, period, nowMs]);

  const filteredMttr = useMemo(() => {
    if (!searchQuery.trim()) return mttrData;
    const q = searchQuery.toLowerCase();
    return mttrData.filter(
      (r) =>
        r.stationName.toLowerCase().includes(q) ||
        r.stationId.toLowerCase().includes(q),
    );
  }, [mttrData, searchQuery]);

  // --- 3. Dataset: OEE ---
  const oeeData = useMemo(() => {
    return appState.productionRecords
      .filter((rec) => {
        if (period === "all") return true;
        const recMs = Date.parse(`${rec.date}T00:00:00+07:00`);
        return recMs >= periodStartMs;
      })
      .map((rec) => {
        const shift = appState.shifts.find((s) => s.id === rec.shiftId);
        const area = appState.areas.find((a) => a.id === rec.areaId);
        const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
        const recDateEnd = recDateStart + 86_400_000;
        const dayStops = appState.stops.filter((s) => s.startMs >= recDateStart && s.startMs < recDateEnd);
        const dtMs = dayStops.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);
        const oee = computeOee(rec, dtMs);

        return {
          id: rec.id,
          date: rec.date,
          shiftName: shift?.name ?? rec.shiftId,
          areaName: area?.name ?? rec.areaId,
          plannedMin: rec.plannedMin,
          downtimeMs: dtMs,
          totalCount: rec.totalCount,
          goodCount: rec.goodCount,
          oee,
        };
      });
  }, [appState.productionRecords, appState.shifts, appState.areas, appState.stops, period, periodStartMs]);

  const filteredOee = useMemo(() => {
    if (!searchQuery.trim()) return oeeData;
    const q = searchQuery.toLowerCase();
    return oeeData.filter(
      (r) =>
        r.date.toLowerCase().includes(q) ||
        r.shiftName.toLowerCase().includes(q) ||
        r.areaName.toLowerCase().includes(q),
    );
  }, [oeeData, searchQuery]);

  // --- 4. Dataset: Log Detail ---
  const logDetailData = useMemo(() => {
    return filteredStops.map((s) => {
      const st = appState.stations.find((x) => x.id === s.stationId);
      const cat = appState.categories.find((c) => c.id === s.categoryId);
      const durationMs = stopDurationMs(s, nowMs);

      return {
        id: s.id,
        stationName: st?.name ?? s.stationId,
        categoryName: cat?.name ?? s.categoryId,
        isBreakdown: !!cat?.countsAsBreakdown,
        isDowntime: cat?.countsAsDowntime !== false,
        startMs: s.startMs,
        endMs: s.endMs,
        durationMs,
        status: s.status,
        source: s.source,
        reportedBy: s.reportedBy,
        note: s.note ?? "",
      };
    });
  }, [filteredStops, appState.stations, appState.categories, nowMs]);

  const filteredLogDetail = useMemo(() => {
    if (!searchQuery.trim()) return logDetailData;
    const q = searchQuery.toLowerCase();
    return logDetailData.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.stationName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.reportedBy.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [logDetailData, searchQuery]);

  const paginatedStopSummary = useMemo(() => {
    const s = (reportPage - 1) * reportPageSize;
    return filteredStopSummary.slice(s, s + reportPageSize);
  }, [filteredStopSummary, reportPage, reportPageSize]);

  const paginatedMttr = useMemo(() => {
    const s = (reportPage - 1) * reportPageSize;
    return filteredMttr.slice(s, s + reportPageSize);
  }, [filteredMttr, reportPage, reportPageSize]);

  const paginatedOee = useMemo(() => {
    const s = (reportPage - 1) * reportPageSize;
    return filteredOee.slice(s, s + reportPageSize);
  }, [filteredOee, reportPage, reportPageSize]);

  const paginatedLogDetail = useMemo(() => {
    const s = (reportPage - 1) * reportPageSize;
    return filteredLogDetail.slice(s, s + reportPageSize);
  }, [filteredLogDetail, reportPage, reportPageSize]);

  // --- Excel Exporters ---
  const handleExportCurrentReport = () => {
    const dateStamp = fmtDateKey(nowMs);

    if (activeReport === "stop-summary") {
      const rows = filteredStopSummary.map((r) => ({
        Station_Name: neutralizeExcelCell(r.stationName),
        Conveyor: neutralizeExcelCell(r.conveyorId),
        Total_Stops: r.totalStops,
        Breakdown_Stops: r.breakdownStops,
        Total_Downtime_Min: Math.round(r.totalDowntimeMs / 60_000),
        Average_Duration_Min: (r.avgDurationMs / 60_000).toFixed(1),
        Threshold_Speed: r.thresholdSpeed,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stop_Summary");
      XLSX.writeFile(wb, `Laporan_Ringkasan_Stop_${period}_${dateStamp}.xlsx`);
    } else if (activeReport === "mttr-mtbf") {
      const rows = filteredMttr.map((r) => ({
        Station: neutralizeExcelCell(r.stationName),
        Period_Days: r.periodDays,
        Breakdown_Count: r.breakdownCount,
        MTTR_Minutes: r.mttrMs ? Math.round(r.mttrMs / 60_000) : "N/A",
        MTBF_Hours: r.mtbfMs ? (r.mtbfMs / 3_600_000).toFixed(1) : "N/A",
        Operating_Time_Hours: r.operatingHours.toFixed(1),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MTTR_MTBF_Report");
      XLSX.writeFile(wb, `Laporan_MTTR_MTBF_${period}_${dateStamp}.xlsx`);
    } else if (activeReport === "oee") {
      const rows = filteredOee.map((r) => ({
        Date: r.date,
        Shift: neutralizeExcelCell(r.shiftName),
        Area: neutralizeExcelCell(r.areaName),
        Planned_Minutes: r.plannedMin,
        Downtime_Minutes: Math.round(r.downtimeMs / 60_000),
        Total_Count_Units: r.totalCount,
        Good_Count_Units: r.goodCount,
        Availability_Pct: (r.oee.availability * 100).toFixed(2),
        Performance_Pct: (r.oee.performance * 100).toFixed(2),
        Quality_Pct: (r.oee.quality * 100).toFixed(2),
        OEE_Pct: (r.oee.oee * 100).toFixed(2),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "OEE_Report");
      XLSX.writeFile(wb, `Laporan_OEE_${dateStamp}.xlsx`);
    } else {
      const rows = filteredLogDetail.map((r) => ({
        Stop_ID: r.id,
        Station_Name: neutralizeExcelCell(r.stationName),
        Category_Name: neutralizeExcelCell(r.categoryName),
        Breakdown_Flag: r.isBreakdown ? "YES" : "NO",
        Downtime_Flag: r.isDowntime ? "YES" : "NO",
        Start_Time_WIB: fmtDateTime(r.startMs),
        End_Time_WIB: r.endMs ? fmtDateTime(r.endMs) : "OPEN",
        Duration_Minutes: (r.durationMs / 60_000).toFixed(1),
        Duration_Formatted: fmtDuration(r.durationMs),
        Status: r.status.toUpperCase(),
        Source: r.source.toUpperCase(),
        Reported_By: neutralizeExcelCell(r.reportedBy),
        Notes: neutralizeExcelCell(r.note),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Log_Detail");
      XLSX.writeFile(wb, `Laporan_Log_Detail_${period}_${dateStamp}.xlsx`);
    }

    toast.success(t("rep.exported"), {
      description: "File Excel berhasil dibuat dan siap diunduh.",
    });
  };

  // Get current active report item count
  const activeRowCount = useMemo(() => {
    switch (activeReport) {
      case "stop-summary":
        return filteredStopSummary.length;
      case "mttr-mtbf":
        return filteredMttr.length;
      case "oee":
        return filteredOee.length;
      case "log-detail":
        return filteredLogDetail.length;
    }
  }, [activeReport, filteredStopSummary.length, filteredMttr.length, filteredOee.length, filteredLogDetail.length]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("rep.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("rep.subtitle")}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1 font-mono text-xs shadow-2xs">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2" />
          <span className="text-muted-foreground pr-1">{t("rep.period")}:</span>
          {(
            [
              { id: "today", label: "Hari ini" },
              { id: "7d", label: "7 Hari" },
              { id: "30d", label: "30 Hari" },
              { id: "all", label: "Semua" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1 rounded transition-colors ${
                period === p.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Report Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stop Summary */}
        <button
          onClick={() => {
            setActiveReport("stop-summary");
            setSearchQuery("");
          }}
          className={`text-left rounded-xl border p-4 flex flex-col justify-between transition-all ${
            activeReport === "stop-summary"
              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Layers className="h-5 w-5" />
            </div>
            {activeReport === "stop-summary" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Check className="h-3 w-3" />
                Aktif
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">
                {appState.stations.length} Stasiun
              </span>
            )}
          </div>
          <div className="mt-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {t("rep.stopSummary")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              Total & rata-rata durasi per stasiun dan status breakdown.
            </p>
          </div>
        </button>

        {/* Card 2: MTTR / MTBF */}
        <button
          onClick={() => {
            setActiveReport("mttr-mtbf");
            setSearchQuery("");
          }}
          className={`text-left rounded-xl border p-4 flex flex-col justify-between transition-all ${
            activeReport === "mttr-mtbf"
              ? "border-rose-500 bg-rose-500/10 dark:bg-rose-950/20 shadow-md ring-1 ring-rose-500"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              <TrendingDown className="h-5 w-5" />
            </div>
            {activeReport === "mttr-mtbf" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <Check className="h-3 w-3" />
                Aktif
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">
                PRD 2.4
              </span>
            )}
          </div>
          <div className="mt-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {t("rep.mttrReport")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              Metrik keandalan mesin MTTR (menit) & MTBF (jam).
            </p>
          </div>
        </button>

        {/* Card 3: OEE Report */}
        <button
          onClick={() => {
            setActiveReport("oee");
            setSearchQuery("");
          }}
          className={`text-left rounded-xl border p-4 flex flex-col justify-between transition-all ${
            activeReport === "oee"
              ? "border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/20 shadow-md ring-1 ring-cyan-500"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              <Activity className="h-5 w-5" />
            </div>
            {activeReport === "oee" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                <Check className="h-3 w-3" />
                Aktif
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">
                {appState.productionRecords.length} Catatan
              </span>
            )}
          </div>
          <div className="mt-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {t("rep.oeeReport")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              Availability, Performance, Quality, dan OEE per shift.
            </p>
          </div>
        </button>

        {/* Card 4: Stop Log Detail */}
        <button
          onClick={() => {
            setActiveReport("log-detail");
            setSearchQuery("");
          }}
          className={`text-left rounded-xl border p-4 flex flex-col justify-between transition-all ${
            activeReport === "log-detail"
              ? "border-purple-500 bg-purple-500/10 dark:bg-purple-950/20 shadow-md ring-1 ring-purple-500"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            {activeReport === "log-detail" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <Check className="h-3 w-3" />
                Aktif
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">
                {filteredStops.length} Kejadian
              </span>
            )}
          </div>
          <div className="mt-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {t("rep.logDetail")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              Log kronologis per kejadian dengan sumber PLC / E-form.
            </p>
          </div>
        </button>
      </div>

      {/* Main Table Preview Section with Search & Download Button */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-foreground">
                  {activeReport === "stop-summary" && t("rep.stopSummary")}
                  {activeReport === "mttr-mtbf" && t("rep.mttrReport")}
                  {activeReport === "oee" && t("rep.oeeReport")}
                  {activeReport === "log-detail" && t("rep.logDetail")}
                </h2>
                <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {activeRowCount} baris
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Pratinjau data di bawah ini siap diekspor ke file Excel (.xlsx).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("rep.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring shadow-2xs"
              />
            </div>

            {/* Download Report Button (Orange Style Matching Reference) */}
            <button
              onClick={handleExportCurrentReport}
              disabled={activeRowCount === 0}
              className="flex items-center gap-2 rounded-lg bg-[#ff5a1f] hover:bg-[#e04810] text-white px-4 py-2 font-sans text-xs font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Report</span>
            </button>
          </div>
        </div>

        {/* Dynamic Table Preview */}
        <div className="overflow-x-auto">
          {/* 1. Stop Summary Table */}
          {activeReport === "stop-summary" && (
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STASIUN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      KONVEYOR <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL STOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      BREAKDOWN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL DOWNTIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      RATA-RATA DURASI <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      THRESHOLD SPEED <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedStopSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedStopSummary.map((row, idx) => (
                    <tr key={row.stationId} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        {(reportPage - 1) * reportPageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                        <div className="font-semibold">{row.stationName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{row.stationId}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">{row.conveyorId}</td>
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          row.totalStops > 0 ? "bg-muted text-foreground" : "text-muted-foreground"
                        }`}>
                          {row.totalStops}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          row.breakdownStops > 0
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "text-muted-foreground"
                        }`}>
                          {row.breakdownStops}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                        {fmtDuration(row.totalDowntimeMs)}
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">
                          ({Math.round(row.totalDowntimeMs / 60_000)}m)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {row.avgDurationMs > 0 ? (row.avgDurationMs / 60_000).toFixed(1) + " m" : "0 m"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground whitespace-nowrap">
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono">
                          {row.thresholdSpeed}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. MTTR & MTBF Table */}
          {activeReport === "mttr-mtbf" && (
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STASIUN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PERIODE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      JUMLAH BREAKDOWN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL DOWNTIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      MTTR (MENIT) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      MTBF (JAM) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      OPERATING TIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedMttr.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedMttr.map((row, idx) => (
                    <tr key={row.stationId} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        {(reportPage - 1) * reportPageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                        <div className="font-semibold">{row.stationName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{row.stationId}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground whitespace-nowrap">
                        {row.periodDays} Hari
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          row.breakdownCount > 0
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "text-muted-foreground"
                        }`}>
                          {row.breakdownCount}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-foreground font-semibold whitespace-nowrap">
                        {fmtDuration(row.totalDowntimeMs)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        {row.mttrMs !== null ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {Math.round(row.mttrMs / 60_000)} m
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        {row.mtbfMs !== null ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {(row.mtbfMs / 3_600_000).toFixed(1)} h
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {row.operatingHours.toFixed(1)} Jam
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. OEE Table */}
          {activeReport === "oee" && (
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TANGGAL & SHIFT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      AREA PRODUKSI <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PLANNED (MIN) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DOWNTIME (MIN) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL / GOOD UNIT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      AVAILABILITY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PERFORMANCE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      QUALITY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      NILAI OEE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedOee.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedOee.map((row, idx) => {
                    const oeePct = row.oee.oee * 100;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                          {(reportPage - 1) * reportPageSize + idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                          <div className="font-mono font-semibold">{row.date}</div>
                          <div className="text-[10px] text-muted-foreground">{row.shiftName}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-foreground font-medium whitespace-nowrap">{row.areaName}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">{row.plannedMin} m</td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                          {Math.round(row.downtimeMs / 60_000)} m
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                          <span className="text-foreground font-bold">{row.goodCount}</span>
                          <span className="text-muted-foreground"> / {row.totalCount}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-foreground whitespace-nowrap">
                          {(row.oee.availability * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-foreground whitespace-nowrap">
                          {(row.oee.performance * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-foreground whitespace-nowrap">
                          {(row.oee.quality * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${
                              oeePct >= 85
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : oeePct >= 65
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {oeePct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 4. Log Detail Table */}
          {activeReport === "log-detail" && (
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      ID STOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      WAKTU MULAI (WIB) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STASIUN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      KATEGORI <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TIPE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DURASI <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATUS <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SUMBER <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PELAPOR <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CATATAN <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedLogDetail.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedLogDetail.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        {(reportPage - 1) * reportPageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">{row.id}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground text-[11px] whitespace-nowrap">
                        <div>{fmtDateTime(row.startMs)}</div>
                        {row.endMs && <div className="text-[10px] text-muted-foreground/70">s/d {fmtDateTime(row.endMs)}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">{row.stationName}</td>
                      <td className="py-3.5 px-4 text-foreground whitespace-nowrap">{row.categoryName}</td>
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        {row.isBreakdown ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            BREAKDOWN
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                            PLANNED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {fmtDuration(row.durationMs)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                            row.status === "open"
                              ? "bg-rose-500/20 text-rose-500 border-rose-500/40 animate-pulse"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[10px] whitespace-nowrap">
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground uppercase font-semibold">
                          {row.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">{row.reportedBy}</td>
                      <td className="py-3.5 px-4 text-muted-foreground max-w-[200px] truncate" title={row.note}>
                        {row.note || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <TablePagination
          page={reportPage}
          pageSize={reportPageSize}
          totalItems={
            activeReport === "stop-summary"
              ? filteredStopSummary.length
              : activeReport === "mttr-mtbf"
              ? filteredMttr.length
              : activeReport === "oee"
              ? filteredOee.length
              : filteredLogDetail.length
          }
          onPageChange={setReportPage}
          onPageSizeChange={setReportPageSize}
        />
      </div>
    </div>
  );
}
