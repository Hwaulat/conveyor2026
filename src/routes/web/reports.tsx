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
  Check,
  Eye,
  X,
  ArrowUpDown,
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
import { fmtDateTime, fmtDateKey, fmtDuration, dayStartMs, fmtTime } from "../../lib/format";
import { toast } from "sonner";
import { TablePagination } from "../../components/TablePagination";
import { Search } from "../../components/ui/search";
import { Tabs } from "../../components/ui/tablist";
import { DateRangePicker } from "../../components/DateRangePicker";

export const Route = createFileRoute("/web/reports")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Reports & Excel Export" },
      { name: "description", content: "Production reports, MTTR, MTBF, and Line-Stop data preview and Excel export." },
    ],
  }),
  component: ReportsPage,
});

type ReportType = "stop-summary" | "mttr-mtbf" | "oee" | "log-detail";

function ReportsPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  // Date Range state matching Dashboard
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 6 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [activeReport, setActiveReport] = useState<ReportType>("stop-summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const [viewingStationStopSummary, setViewingStationStopSummary] = useState<{
    stationId: string;
    stationName: string;
    conveyorId: string;
    totalStops: number;
    breakdownStops: number;
    totalDowntimeMs: number;
    avgDurationMs: number;
    thresholdSpeed: string;
  } | null>(null);

  const { rangeStartMs, rangeEndMs, daysCount } = useMemo(() => {
    const sDate = startDate || new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const eDate = endDate || new Date().toISOString().slice(0, 10);
    const start = Date.parse(`${sDate}T00:00:00+07:00`) || (nowMs - 7 * 86_400_000);
    const end = Date.parse(`${eDate}T23:59:59.999+07:00`) || nowMs;
    const days = Math.max(1, Math.round((end - start) / 86_400_000));
    return { rangeStartMs: start, rangeEndMs: end, daysCount: days };
  }, [startDate, endDate, nowMs]);

  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= rangeStartMs && s.startMs <= rangeEndMs);
  }, [appState.stops, rangeStartMs, rangeEndMs]);

  const stationDetailStops = useMemo(() => {
    if (!viewingStationStopSummary) return [];
    return filteredStops.filter((s) => s.stationId === viewingStationStopSummary.stationId);
  }, [viewingStationStopSummary, filteredStops]);

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
    const operatingMs = daysCount * 16 * 3_600_000;

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
        periodDays: daysCount,
        breakdownCount: breakdowns.length,
        totalDowntimeMs: totalDowntime,
        mttrMs: mttr,
        mtbfMs: mtbf,
        operatingHours: operatingMs / 3_600_000,
      };
    });
  }, [appState.stations, filteredStops, appState.categories, daysCount, nowMs]);

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
        const recMs = Date.parse(`${rec.date}T00:00:00+07:00`);
        return recMs >= rangeStartMs && recMs <= rangeEndMs;
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
  }, [appState.productionRecords, appState.shifts, appState.areas, appState.stops, rangeStartMs, rangeEndMs]);

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
    const rangeTag = `${startDate}_to_${endDate}`;

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
      XLSX.writeFile(wb, `Laporan_Ringkasan_Stop_${rangeTag}_${dateStamp}.xlsx`);
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
      XLSX.writeFile(wb, `Laporan_MTTR_MTBF_${rangeTag}_${dateStamp}.xlsx`);
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
      XLSX.writeFile(wb, `Laporan_OEE_${rangeTag}_${dateStamp}.xlsx`);
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
      XLSX.writeFile(wb, `Laporan_Log_Detail_${rangeTag}_${dateStamp}.xlsx`);
    }

    toast.success(t("rep.exported"), {
      description: "Excel file created and ready to download.",
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
    <div className="space-y-6 w-full">
      {/* Page Title & Tablist */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("rep.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("rep.subtitle")}
          </p>
        </div>

        {/* Tablist on the Right */}
        <div className="flex items-center">
          <Tabs
            variant="primary"
            value={activeReport}
            onValueChange={(val) => {
              setActiveReport(val as ReportType);
              setSearchQuery("");
              setReportPage(1);
            }}
            items={[
              { value: "stop-summary", label: "Stop Summary", badge: filteredStopSummary.length },
              { value: "mttr-mtbf", label: "MTTR & MTBF", badge: filteredMttr.length },
              { value: "oee", label: "Production OEE", badge: filteredOee.length },
              { value: "log-detail", label: "Log Detail", badge: filteredLogDetail.length },
            ]}
          />
        </div>
      </div>

      {/* Main Table Preview Section with Search & Download Button */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs">
        {/* Table Toolbar: Search (Fill Container) on Left, Date Range Picker & Download Button on Right */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#152a47] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
          {/* Search Input (Fill Container) */}
          <Search
            containerClassName="flex-1 w-full"
            placeholder={t("rep.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Right: Date Range Picker on Left of Download Report Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
                setReportPage(1);
              }}
              onReset={() => {
                const now = new Date();
                const todayStr = now.toISOString().slice(0, 10);
                const past = new Date(Date.now() - 6 * 86_400_000);
                setStartDate(past.toISOString().slice(0, 10));
                setEndDate(todayStr);
                setReportPage(1);
              }}
            />

            {/* Download Report Button (Orange Style Matching Reference) */}
            <button
              onClick={handleExportCurrentReport}
              disabled={activeRowCount === 0}
              className="flex items-center gap-2 rounded-lg bg-[#ff5a1f] hover:bg-[#e04810] text-white px-4 py-2 font-sans text-xs font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer h-10"
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
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-16 text-center whitespace-nowrap">ACTION</th>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CONVEYOR <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                      AVERAGE DURATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                    <td colSpan={9} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedStopSummary.map((row, idx) => (
                    <tr key={row.stationId} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingStationStopSummary(row)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600 shadow-2xs transition-colors cursor-pointer"
                          title="View Stop & Breakdown Detail"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        {(reportPage - 1) * reportPageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                        <div className="font-semibold">{row.stationName}</div>
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
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PERIOD <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      BREAKDOWN COUNT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL DOWNTIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      MTTR (MINUTES) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      MTBF (HOURS) <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground whitespace-nowrap">
                        {row.periodDays} Days
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
                        {row.operatingHours.toFixed(1)} Hours
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. OEE Table */}
          {activeReport === "oee" && (
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DATE & SHIFT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PRODUCTION AREA <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                      OEE SCORE <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      ID STOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      START TIME (WIB) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CATEGORY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TYPE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DURATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATUS <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SOURCE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      REPORTER <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      NOTES <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                        {row.endMs && <div className="text-[10px] text-muted-foreground/70">to {fmtDateTime(row.endMs)}</div>}
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

      {/* Detail Modal: Station Total Stop & Breakdown Details */}
      {viewingStationStopSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-border pb-3 shrink-0">
              <div>
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <span>Station Stop & Breakdown Details</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {viewingStationStopSummary.stationName}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conveyor: {viewingStationStopSummary.conveyorId} • Period: {startDate} to {endDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStationStopSummary(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <span className="text-[11px] text-muted-foreground font-medium block">Total Line Stops</span>
                <span className="text-lg font-bold font-mono text-foreground">{viewingStationStopSummary.totalStops}</span>
              </div>
              <div className="rounded-xl border border-border bg-rose-500/10 p-3 border-rose-500/20">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block">Breakdown Stops</span>
                <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">{viewingStationStopSummary.breakdownStops}</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <span className="text-[11px] text-muted-foreground font-medium block">Total Downtime</span>
                <span className="text-lg font-bold font-mono text-foreground">{fmtDuration(viewingStationStopSummary.totalDowntimeMs)}</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <span className="text-[11px] text-muted-foreground font-medium block">Average Duration</span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {viewingStationStopSummary.avgDurationMs > 0 ? (viewingStationStopSummary.avgDurationMs / 60_000).toFixed(1) + " min" : "0 min"}
                </span>
              </div>
            </div>

            {/* Occurrences list */}
            <div className="overflow-y-auto flex-1 rounded-xl border border-slate-200/80 dark:border-[#152a47]">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="sticky top-0 border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">NO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">START TIME (WIB)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">DURATION</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">PROBLEM CATEGORY</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">TYPE</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">OPERATOR</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">NOTES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {stationDetailStops.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground font-mono">
                        No stop occurrences recorded for this station in the selected period.
                      </td>
                    </tr>
                  ) : (
                    stationDetailStops.map((s, idx) => {
                      const cat = appState.categories.find((c) => c.id === s.categoryId);
                      const isBreakdown = !!cat?.countsAsBreakdown;
                      const dur = stopDurationMs(s, nowMs);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                            <div>{fmtDateTime(s.startMs)}</div>
                            {s.endMs && <div className="text-[10px] text-muted-foreground/70">to {fmtTime(s.endMs)}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-foreground whitespace-nowrap">
                            {fmtDuration(dur)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                            {cat?.name ?? s.categoryId}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isBreakdown ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                BREAKDOWN
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                LINE STOP
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                            {s.reportedBy}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-xs truncate">
                            {s.note || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-border shrink-0">
              <button
                type="button"
                onClick={() => setViewingStationStopSummary(null)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
