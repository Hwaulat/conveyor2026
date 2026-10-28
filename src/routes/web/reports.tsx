import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  TrendingDown,
  Clock,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import {
  mttrMs,
  mtbfMs,
  avgStopMs,
  operatingTimeMs,
  downtimeByCategory,
  computeOee,
  stopDurationMs,
  neutralizeExcelCell,
} from "../../lib/calc";
import { fmtDateTime, fmtDateKey, fmtDuration, dayStartMs } from "../../lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/web/reports")({
  head: () => ({
    meta: [
      { title: "JSGI — Reports & Excel Export" },
      { name: "description", content: "Generate and export production, MTTR, MTBF and Line-Stop reports." },
    ],
  }),
  component: ReportsPage,
});

type ReportPeriod = "today" | "7d" | "30d" | "all";

function ReportsPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  const [period, setPeriod] = useState<ReportPeriod>("7d");

  const periodStartMs = useMemo(() => {
    if (period === "today") return dayStartMs(nowMs);
    if (period === "7d") return nowMs - 7 * 86_400_000;
    if (period === "30d") return nowMs - 30 * 86_400_000;
    return 0;
  }, [period, nowMs]);

  const filteredStops = useMemo(() => {
    return appState.stops.filter((s) => s.startMs >= periodStartMs);
  }, [appState.stops, periodStartMs]);

  // Export 1: Line-Stop Summary
  const exportStopSummary = () => {
    const data: any[] = [];
    for (const station of appState.stations) {
      const stStops = filteredStops.filter((s) => s.stationId === station.id);
      const totalDur = stStops.reduce((sum, s) => sum + stopDurationMs(s, nowMs), 0);
      const avgDur = stStops.length > 0 ? totalDur / stStops.length : 0;
      const breakdowns = stStops.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        return cat?.countsAsBreakdown;
      });

      data.push({
        Station_Name: neutralizeExcelCell(station.name),
        Conveyor: neutralizeExcelCell(station.conveyorId),
        Total_Stops: stStops.length,
        Breakdown_Stops: breakdowns.length,
        Total_Downtime_Min: Math.round(totalDur / 60_000),
        Average_Duration_Min: (avgDur / 60_000).toFixed(1),
        Threshold_Speed: `${station.runningThreshold} ${station.speedUnit}`,
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stop_Summary");
    XLSX.writeFile(wb, `Laporan_Ringkasan_Stop_${period}_${fmtDateKey(nowMs)}.xlsx`);
    toast.success(t("rep.exported"));
  };

  // Export 2: MTTR & MTBF Report
  const exportMttrReport = () => {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const operatingMs = days * 16 * 3_600_000;

    const data: any[] = [];
    for (const station of appState.stations) {
      const stStops = filteredStops.filter((s) => s.stationId === station.id);
      const mttr = mttrMs(stStops, appState.categories);
      const mtbf = mtbfMs(stStops, appState.categories, operatingMs);

      data.push({
        Station: neutralizeExcelCell(station.name),
        Period_Days: days,
        Breakdown_Count: stStops.filter((s) => {
          const cat = appState.categories.find((c) => c.id === s.categoryId);
          return cat?.countsAsBreakdown;
        }).length,
        MTTR_Minutes: mttr ? Math.round(mttr / 60_000) : "N/A",
        MTBF_Hours: mtbf ? (mtbf / 3_600_000).toFixed(1) : "N/A",
        Operating_Time_Hours: (operatingMs / 3_600_000).toFixed(1),
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MTTR_MTBF_Report");
    XLSX.writeFile(wb, `Laporan_MTTR_MTBF_${period}_${fmtDateKey(nowMs)}.xlsx`);
    toast.success(t("rep.exported"));
  };

  // Export 3: OEE Report
  const exportOeeReport = () => {
    const data = appState.productionRecords.map((rec) => {
      const shift = appState.shifts.find((s) => s.id === rec.shiftId);
      const area = appState.areas.find((a) => a.id === rec.areaId);

      const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
      const recDateEnd = recDateStart + 86_400_000;
      const dayStops = appState.stops.filter((s) => s.startMs >= recDateStart && s.startMs < recDateEnd);
      const dtMs = dayStops.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);
      const oee = computeOee(rec, dtMs);

      return {
        Date: rec.date,
        Shift: neutralizeExcelCell(shift?.name ?? rec.shiftId),
        Area: neutralizeExcelCell(area?.name ?? rec.areaId),
        Planned_Minutes: rec.plannedMin,
        Downtime_Minutes: Math.round(dtMs / 60_000),
        Total_Count_Units: rec.totalCount,
        Good_Count_Units: rec.goodCount,
        Availability_Pct: (oee.availability * 100).toFixed(2),
        Performance_Pct: (oee.performance * 100).toFixed(2),
        Quality_Pct: (oee.quality * 100).toFixed(2),
        OEE_Pct: (oee.oee * 100).toFixed(2),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OEE_Report");
    XLSX.writeFile(wb, `Laporan_OEE_${fmtDateKey(nowMs)}.xlsx`);
    toast.success(t("rep.exported"));
  };

  // Export 4: Stop Log Detail
  const exportLogDetail = () => {
    const data = filteredStops.map((s) => {
      const st = appState.stations.find((x) => x.id === s.stationId);
      const cat = appState.categories.find((c) => c.id === s.categoryId);
      const durationMs = stopDurationMs(s, nowMs);

      return {
        Stop_ID: s.id,
        Station_Name: neutralizeExcelCell(st?.name ?? s.stationId),
        Category_Name: neutralizeExcelCell(cat?.name ?? s.categoryId),
        Breakdown_Flag: cat?.countsAsBreakdown ? "YES" : "NO",
        Downtime_Flag: cat?.countsAsDowntime ? "YES" : "NO",
        Start_Time_WIB: fmtDateTime(s.startMs),
        End_Time_WIB: s.endMs ? fmtDateTime(s.endMs) : "OPEN",
        Duration_Minutes: (durationMs / 60_000).toFixed(1),
        Duration_Formatted: fmtDuration(durationMs),
        Status: s.status.toUpperCase(),
        Source: s.source.toUpperCase(),
        Reported_By: neutralizeExcelCell(s.reportedBy),
        Notes: neutralizeExcelCell(s.note ?? ""),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log_Detail");
    XLSX.writeFile(wb, `Laporan_Log_Detail_${period}_${fmtDateKey(nowMs)}.xlsx`);
    toast.success(t("rep.exported"));
  };

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

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Stop Summary */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("rep.stopSummary")}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              {t("rep.stopSummaryDesc")}. Dilengkapi metrik frekuensi breakdown dan rata-rata durasi.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              {appState.stations.length} Stasiun terdaftar
            </span>
            <button
              onClick={exportStopSummary}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("rep.exportExcel")}
            </button>
          </div>
        </div>

        {/* Card 2: MTTR / MTBF Report */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <TrendingDown className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("rep.mttrReport")}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              {t("rep.mttrReportDesc")}. Dihitung dari operating time dan kejadian stop dengan tanda breakdown.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              Formula Standar PRD 2.4
            </span>
            <button
              onClick={exportMttrReport}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("rep.exportExcel")}
            </button>
          </div>
        </div>

        {/* Card 3: OEE Report */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("rep.oeeReport")}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              {t("rep.oeeReportDesc")}. Rincian per shift dan tanggal dengan Availability, Performance, Quality.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              {appState.productionRecords.length} Catatan produksi
            </span>
            <button
              onClick={exportOeeReport}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("rep.exportExcel")}
            </button>
          </div>
        </div>

        {/* Card 4: Stop Log Detail */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {t("rep.logDetail")}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              {t("rep.logDetailDesc")}. Memuat waktu mulai/selesai presisi, nama operator, sumber (PLC/E-form), dan catatan.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              {filteredStops.length} Baris pada periode
            </span>
            <button
              onClick={exportLogDetail}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("rep.exportExcel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
