import { createFileRoute, Link } from "@tanstack/react-router";
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
  getFusoWorkingRule,
  getFusoMinutesFromMatrix,
  computeAvailabilityFromMtbfMttr,
  isBreakdown,
} from "../../lib/calc";
import {
  fmtDateTime,
  fmtDateTimeFull,
  fmtDateFullHuman,
  fmtDateKey,
  fmtDuration,
  dayStartMs,
  fmtTime,
  shiftOf,
} from "../../lib/format";
import { getShiftForStop } from "../../lib/shift";
import { toast } from "sonner";
import { TablePagination } from "../../components/TablePagination";
import { Search } from "../../components/ui/search";
import { Tabs } from "../../components/ui/tablist";
import { DateRangePicker } from "../../components/DateRangePicker";
import { SelectInput } from "../../components/ui/select-input";

export const Route = createFileRoute("/web/reports")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Reports & Excel Export" },
      { name: "description", content: "Production reports, MTTR, MTBF, and Line-Stop data preview and Excel export." },
    ],
  }),
  errorComponent: ReportsErrorFallback,
  component: ReportsPage,
});

function ReportsErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("Reports page error:", error);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-foreground">Error Loading Reports</h3>
        <p className="text-sm text-muted-foreground">
          Terjadi kendala saat memuat laporan data stop. Silakan muat ulang halaman.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs cursor-pointer"
          >
            Reload Page
          </button>
          <button
            onClick={() => reset()}
            className="px-4 py-2 border border-border bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

type ReportType = "stop-summary" | "mttr-mtbf" | "oee";

function formatReportDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const yStr = parts[0];
  const mStr = parts[1];
  const dStr = parts[2];
  if (!yStr || !mStr || !dStr) return dateStr;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return dateStr;
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const monthName = monthNames[m - 1] ?? "";
  return `${d} ${monthName} ${y}`;
}

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
  const [selectedArea, setSelectedArea] = useState<string>("area-sanding");
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

  const availableStations = useMemo(() => {
    if (!selectedArea || selectedArea === "all") return appState.stations;
    return appState.stations.filter((s) => s.areaId === selectedArea);
  }, [appState.stations, selectedArea]);

  const handleAreaChange = (val: string | null) => {
    const nextArea = val ?? "";
    setSelectedArea(nextArea);
    if (selectedStation !== "all") {
      const match = appState.stations.find(
        (s) => s.id === selectedStation && (nextArea === "all" || s.areaId === nextArea),
      );
      if (!match) {
        setSelectedStation("all");
      }
    }
    setReportPage(1);
  };

  const handleStationChange = (val: string | null) => {
    setSelectedStation(val ?? "all");
    setReportPage(1);
  };

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

  // --- 1. Dataset: Stop Summary (List data Line Stop granular matching Details Line Stop History) ---
  const stopSummaryData = useMemo(() => {
    let stops = filteredStops;
    if (selectedArea && selectedArea !== "all") {
      stops = stops.filter((s) => {
        const st = appState.stations.find((x) => x.id === s.stationId);
        const areaId = s.areaId || st?.areaId;
        return areaId === selectedArea;
      });
    }
    if (selectedStation && selectedStation !== "all") {
      stops = stops.filter((s) => s.stationId === selectedStation);
    }
    return [...stops].sort((a, b) => b.startMs - a.startMs);
  }, [filteredStops, selectedArea, selectedStation, appState.stations]);

  const filteredStopSummary = useMemo(() => {
    if (!searchQuery.trim()) return stopSummaryData;
    const q = searchQuery.toLowerCase();
    return stopSummaryData.filter((s) => {
      const station = appState.stations.find((x) => x.id === s.stationId);
      const area = appState.areas.find((a) => a.id === (s.areaId || station?.areaId));
      const cat = appState.categories.find((c) => c.id === s.categoryId);
      const shift = getShiftForStop(s);
      return (
        (station?.name ?? "").toLowerCase().includes(q) ||
        (station?.code ?? "").toLowerCase().includes(q) ||
        (area?.name ?? "").toLowerCase().includes(q) ||
        (cat?.name ?? "").toLowerCase().includes(q) ||
        (s.reportedBy ?? "").toLowerCase().includes(q) ||
        (s.note ?? "").toLowerCase().includes(q) ||
        (s.stationId ?? "").toLowerCase().includes(q) ||
        shift.shortName.toLowerCase().includes(q)
      );
    });
  }, [stopSummaryData, searchQuery, appState.stations, appState.areas, appState.categories]);

  // --- 2. Dataset: MTTR & MTBF (Grouped by Station and Category) ---
  const mttrData = useMemo(() => {
    const operatingMs = daysCount * 16 * 3_600_000;
    let targetStations = selectedArea && selectedArea !== "all"
      ? appState.stations.filter((st) => st.areaId === selectedArea)
      : appState.stations;

    if (selectedStation && selectedStation !== "all") {
      targetStations = targetStations.filter((st) => st.id === selectedStation);
    }

    const rows: {
      id: string;
      date: string;
      rawDate: string;
      areaId: string;
      areaName: string;
      stationId: string;
      stationName: string;
      categoryName: string;
      reason: string;
      totalDowntimeMs: number;
      mttrMs: number | null;
      mtbfMs: number | null;
      operatingHours: number;
    }[] = [];

    const dailyOperatingMs = 16 * 3_600_000;

    for (const station of targetStations) {
      const area = appState.areas.find((a) => a.id === station.areaId);
      const stStops = filteredStops.filter((s) => s.stationId === station.id);

      if (stStops.length === 0) {
        rows.push({
          id: `mttr-${station.id}-none`,
          date: formatReportDate(endDate),
          rawDate: endDate,
          areaId: station.areaId,
          areaName: area?.name ?? station.areaId,
          stationId: station.id,
          stationName: station.name,
          categoryName: "—",
          reason: "—",
          totalDowntimeMs: 0,
          mttrMs: null,
          mtbfMs: daysCount * dailyOperatingMs > 0 ? daysCount * dailyOperatingMs : null,
          operatingHours: (daysCount * dailyOperatingMs) / 3_600_000,
        });
      } else {
        const dateCatGroupMap = new Map<string, typeof filteredStops>();
        for (const s of stStops) {
          const dKey = fmtDateKey(s.startMs);
          const cId = s.categoryId || "uncategorized";
          const groupKey = `${dKey}__${cId}`;
          const list = dateCatGroupMap.get(groupKey) || [];
          list.push(s);
          dateCatGroupMap.set(groupKey, list);
        }

        for (const [groupKey, catStops] of dateCatGroupMap.entries()) {
          const [dKey, cId] = groupKey.split("__");
          const catObj = appState.categories.find((c) => c.id === cId);
          const catName = catObj?.name ?? (cId === "uncategorized" ? "Uncategorized" : (cId ?? "—"));
          const totalDowntime = catStops.reduce((sum, s) => sum + stopDurationMs(s, nowMs), 0);

          const closedStops = catStops.filter((s) => s.status === "closed" || Boolean(s.endMs));
          const closedDowntime = closedStops.reduce((sum, s) => sum + stopDurationMs(s, s.endMs ?? nowMs), 0);
          const mttr = closedStops.length > 0
            ? closedDowntime / closedStops.length
            : totalDowntime / catStops.length;

          const mtbf = catStops.length > 0 ? dailyOperatingMs / catStops.length : dailyOperatingMs;

          const reasonsList = Array.from(
            new Set(catStops.map((s) => s.note?.trim()).filter((n): n is string => Boolean(n)))
          );
          const reasonText = reasonsList.length > 0 ? reasonsList.join(", ") : "—";

          rows.push({
            id: `mttr-${station.id}-${groupKey}`,
            date: formatReportDate(dKey ?? endDate),
            rawDate: dKey ?? endDate,
            areaId: station.areaId,
            areaName: area?.name ?? station.areaId,
            stationId: station.id,
            stationName: station.name,
            categoryName: catName,
            reason: reasonText,
            totalDowntimeMs: totalDowntime,
            mttrMs: mttr,
            mtbfMs: mtbf,
            operatingHours: dailyOperatingMs / 3_600_000,
          });
        }
      }
    }

    // Sort descending by rawDate, then station name
    rows.sort((a, b) => {
      const cmpDate = b.rawDate.localeCompare(a.rawDate);
      if (cmpDate !== 0) return cmpDate;
      return a.stationName.localeCompare(b.stationName);
    });

    return rows;
  }, [appState.stations, appState.areas, appState.categories, filteredStops, selectedArea, selectedStation, daysCount, endDate, nowMs]);

  const filteredMttr = useMemo(() => {
    if (!searchQuery.trim()) return mttrData;
    const q = searchQuery.toLowerCase();
    return mttrData.filter(
      (r) =>
        r.date.toLowerCase().includes(q) ||
        r.stationName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.areaName.toLowerCase().includes(q) ||
        r.stationId.toLowerCase().includes(q),
    );
  }, [mttrData, searchQuery]);

  // --- 3. Dataset: OEE (Synchronized with Production OEE Calendar & FUSO Matrix) ---
  const oeeData = useMemo(() => {
    let assignments: Record<string, string> = {
      "2026-11-04": "ot-1",
      "2026-11-06": "ot-1",
      "2026-11-12": "ot-2",
      "2026-11-13": "ot-1",
      "2026-11-18": "ot-2",
      "2026-11-20": "ot-3",
      "2026-11-25": "night-shift",
      "2026-11-27": "ot-1",
    };
    try {
      const stored = localStorage.getItem("krm_production_calendar_assignments");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          assignments = { ...assignments, ...parsed };
        }
      }
    } catch { }

    const rows: {
      id: string;
      date: string;
      shiftId: string;
      shiftName: string;
      shiftType: "pagi" | "malam" | "holiday";
      areaId: string;
      areaName: string;
      dayRule: string;
      dayTypeId: string;
      plannedMin: number;
      downtimeMs: number;
      breakdownCount: number;
      mttrMs: number | null;
      mtbfMs: number | null;
      availability: number;
      oee: number;
    }[] = [];

    let targetAreas = selectedArea && selectedArea !== "all"
      ? appState.areas.filter((a) => a.id === selectedArea)
      : appState.areas;

    if (selectedStation && selectedStation !== "all") {
      const st = appState.stations.find((s) => s.id === selectedStation);
      if (st) {
        targetAreas = appState.areas.filter((a) => a.id === st.areaId);
      }
    }

    const startObj = new Date(`${startDate}T00:00:00+07:00`);
    const endObj = new Date(`${endDate}T00:00:00+07:00`);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return rows;

    const cur = new Date(startObj);
    while (cur <= endObj) {
      const dateStr = cur.toISOString().slice(0, 10);
      const dow = cur.getDay(); // 0 = Sun, 6 = Sat
      const dayTypeId = assignments[dateStr] ?? (dow === 0 || dow === 6 ? "holiday" : "normal");
      const isHoliday = dayTypeId === "holiday";

      const dayStartMs = Date.parse(`${dateStr}T00:00:00+07:00`);
      const dayEndMs = dayStartMs + 86_400_000;

      const shiftsForDay: { shiftId: string; shiftName: string; shiftType: "pagi" | "malam"; extraMin: number }[] = [];

      if (!isHoliday) {
        if (dayTypeId === "night-shift") {
          shiftsForDay.push({
            shiftId: "shift-2",
            shiftName: "Shift 2 (Night Shift)",
            shiftType: "malam",
            extraMin: 0,
          });
        } else {
          let extraMin = 0;
          if (dayTypeId === "ot-1" || dayTypeId === "ot-9") extraMin = 60;
          else if (dayTypeId === "ot-2" || dayTypeId === "ot-10") extraMin = 120;
          else if (dayTypeId === "ot-3" || dayTypeId === "ot-11") extraMin = 180;

          shiftsForDay.push({
            shiftId: "shift-1",
            shiftName: "Shift 1 (Pagi)",
            shiftType: "pagi",
            extraMin,
          });

          shiftsForDay.push({
            shiftId: "shift-2",
            shiftName: "Shift 2 (Siang/Malam)",
            shiftType: "malam",
            extraMin: 0,
          });
        }
      }

      for (const area of targetAreas) {
        const dayAreaStops = appState.stops.filter((s) => {
          const inDate = s.startMs >= dayStartMs && s.startMs < dayEndMs;
          const st = appState.stations.find((st) => st.id === s.stationId);
          const stArea = s.areaId || st?.areaId;
          const inArea = stArea === area.id;
          const matchStation = selectedStation === "all" || !selectedStation || s.stationId === selectedStation;
          return inDate && inArea && matchStation;
        });

        // If it's a holiday but had actual line stops recorded
        if (isHoliday && dayAreaStops.length > 0) {
          const breakdownStops = dayAreaStops.filter((s) => isBreakdown(s, appState.categories));
          const breakdownCount = breakdownStops.length;
          const downtimeMs = dayAreaStops.reduce((sum, s) => sum + stopDurationMs(s, dayEndMs), 0);
          const breakdownDowntimeMs = breakdownStops.reduce((sum, s) => sum + stopDurationMs(s, s.endMs ?? dayEndMs), 0);
          const mttrMs = breakdownCount > 0 ? breakdownDowntimeMs / breakdownCount : null;

          rows.push({
            id: `oee-${dateStr}-holiday-${area.id}`,
            date: dateStr,
            shiftId: "holiday",
            shiftName: "Holiday / Off",
            shiftType: "holiday",
            areaId: area.id,
            areaName: area.name,
            dayRule: "Holiday / Off",
            dayTypeId: "holiday",
            plannedMin: 0,
            downtimeMs,
            breakdownCount,
            mttrMs,
            mtbfMs: null,
            availability: 0,
            oee: 0,
          });
          continue;
        }

        for (const sDef of shiftsForDay) {
          let fuso = getFusoWorkingRule(dateStr, sDef.shiftType, assignments);
          if (dayTypeId === "ot-8" || dayTypeId === "ot-9" || dayTypeId === "ot-10" || dayTypeId === "ot-11") {
            fuso = {
              ruleName: "Sabtu (OT 8-11)",
              ruleCode: "sabtu",
              shift: sDef.shiftType,
              baseMin: 480,
            };
          }

          let otTier: "normal" | "ot-1" | "ot-2" | "ot-3" | "night-shift" | "ot-8" | "ot-9" | "ot-10" | "ot-11" = "normal";
          if (dayTypeId === "ot-1") otTier = "ot-1";
          else if (dayTypeId === "ot-2") otTier = "ot-2";
          else if (dayTypeId === "ot-3") otTier = "ot-3";
          else if (dayTypeId === "night-shift") otTier = "night-shift";
          else if (dayTypeId === "ot-8") otTier = "ot-8";
          else if (dayTypeId === "ot-9") otTier = "ot-9";
          else if (dayTypeId === "ot-10") otTier = "ot-10";
          else if (dayTypeId === "ot-11") otTier = "ot-11";

          const plannedMin = getFusoMinutesFromMatrix(
            fuso.ruleCode,
            sDef.shiftType,
            otTier,
            fuso.isFridayDeductionApplied,
          );
          const plannedMs = plannedMin * 60_000;

          const shiftStops = dayAreaStops.filter((s) => {
            const shiftObj = shiftOf(s.startMs, appState.shifts);
            return shiftObj.id === sDef.shiftId;
          });

          const breakdownStops = shiftStops.filter((s) => isBreakdown(s, appState.categories));
          const breakdownCount = breakdownStops.length;
          const downtimeMs = shiftStops.reduce((sum, s) => sum + stopDurationMs(s, dayEndMs), 0);
          const breakdownDowntimeMs = breakdownStops.reduce((sum, s) => sum + stopDurationMs(s, s.endMs ?? dayEndMs), 0);

          const operatingMs = Math.max(0, plannedMs - downtimeMs);

          let mttrMs: number | null = null;
          let mtbfMs: number | null = null;

          if (breakdownCount > 0) {
            mttrMs = breakdownDowntimeMs / breakdownCount;
            mtbfMs = operatingMs / breakdownCount;
          } else {
            mttrMs = null;
            mtbfMs = operatingMs > 0 ? operatingMs : null;
          }

          // Availability = MTBF / (MTBF + MTTR)
          const availability = computeAvailabilityFromMtbfMttr(mtbfMs, mttrMs, operatingMs, plannedMs);
          const oee = availability; // OEE is strictly Availability per user request

          let ruleLabel = fuso.ruleName;
          if (sDef.extraMin > 0) {
            ruleLabel += ` (+OT ${sDef.extraMin}m)`;
          }

          rows.push({
            id: `oee-${dateStr}-${sDef.shiftId}-${area.id}`,
            date: dateStr,
            shiftId: sDef.shiftId,
            shiftName: sDef.shiftName,
            shiftType: sDef.shiftType,
            areaId: area.id,
            areaName: area.name,
            dayRule: ruleLabel,
            dayTypeId,
            plannedMin,
            downtimeMs,
            breakdownCount,
            mttrMs,
            mtbfMs,
            availability,
            oee,
          });
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    // Sort descending by date (newest first)
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [startDate, endDate, selectedArea, selectedStation, appState.areas, appState.stations, appState.stops, appState.categories, appState.shifts]);

  const filteredOee = useMemo(() => {
    if (!searchQuery.trim()) return oeeData;
    const q = searchQuery.toLowerCase();
    return oeeData.filter(
      (r) =>
        r.date.toLowerCase().includes(q) ||
        r.shiftName.toLowerCase().includes(q) ||
        r.areaName.toLowerCase().includes(q) ||
        r.dayRule.toLowerCase().includes(q),
    );
  }, [oeeData, searchQuery]);

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

  // --- Excel Exporters ---
  const handleExportCurrentReport = () => {
    if (!isAreaFilled) {
      toast.error("Silakan pilih Area terlebih dahulu untuk mengunduh laporan");
      return;
    }
    if (!isStationFilled) {
      toast.error("Silakan pilih Station terlebih dahulu untuk mengunduh laporan");
      return;
    }
    if (!isDateRangeFilled) {
      toast.error("Silakan pilih Date Range terlebih dahulu untuk mengunduh laporan");
      return;
    }
    if (activeRowCount === 0) {
      toast.error("Tidak ada data untuk diunduh sesuai filter yang dipilih");
      return;
    }

    const dateStamp = fmtDateKey(nowMs);
    const rangeTag = `${startDate}_to_${endDate}`;

    if (activeReport === "stop-summary") {
      const rows = filteredStopSummary.map((stop, idx) => {
        const station = appState.stations.find((s) => s.id === stop.stationId);
        const area = appState.areas.find((a) => a.id === (stop.areaId || station?.areaId));
        const category = appState.categories.find((c) => c.id === stop.categoryId);
        const shiftInfo = getShiftForStop(stop);
        const durationMs = stopDurationMs(stop, nowMs);
        const durationMin = Math.round(durationMs / 60_000);
        const isBdown = isBreakdown(stop, appState.categories);
        const isClosed = stop.status === "closed" || Boolean(stop.endMs);
        const speedVal = typeof stop.lastSpeed === "number" ? stop.lastSpeed : (station?.nominalSpeed ?? 12.5);
        const speedUnit = station?.speedUnit || "m/min";
        const totalRunVal = typeof stop.totalRunMs === "number" ? stop.totalRunMs : (appState.stationLive[stop.stationId]?.totalRunMs ?? 14_400_000);
        const isFormFilled = Boolean(stop.source === "form" && Boolean(stop.reportedBy?.trim()) && Boolean(stop.categoryId?.trim()));
        const submittedAt = stop.submittedAtMs ?? (isFormFilled ? stop.endMs || stop.startMs : null);

        return {
          No: idx + 1,
          Area: neutralizeExcelCell(area?.name ?? stop.areaId),
          Station: neutralizeExcelCell(station?.name ?? stop.stationId),
          Kode_Stasiun: neutralizeExcelCell(station?.code ?? stop.stationId),
          Konveyor: neutralizeExcelCell(station?.conveyorId ?? "—"),
          Start_Linestop: `${fmtDateFullHuman(stop.startMs)} (${fmtTime(stop.startMs)})`,
          Finish_Linestop: stop.endMs ? `${fmtDateFullHuman(stop.endMs)} (${fmtTime(stop.endMs)})` : "Ongoing",
          Shift: neutralizeExcelCell(shiftInfo.shortName),
          Stop_Duration_Menit: durationMin,
          Stop_Duration_Format: fmtDuration(durationMs),
          Last_Speed: `${speedVal.toFixed(1)} ${speedUnit}`,
          Total_Run_Time: fmtDuration(totalRunVal),
          Submitted_Date: isFormFilled && submittedAt ? fmtDateTimeFull(submittedAt) : "— (Pending)",
          Submitted_By: isFormFilled && stop.reportedBy ? neutralizeExcelCell(stop.reportedBy) : "—",
          Category: isFormFilled && (category || stop.categoryId) ? neutralizeExcelCell(category?.name ?? stop.categoryId) : "—",
          Reasons: isFormFilled && stop.note ? neutralizeExcelCell(stop.note) : "—",
          Status: isClosed ? "Closed" : "Open (Ongoing)",
          Breakdown: isBdown ? "Breakdown" : "Non-Breakdown",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 26 },
        { wch: 14 },
        { wch: 16 },
        { wch: 26 },
        { wch: 26 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 26 },
        { wch: 20 },
        { wch: 24 },
        { wch: 34 },
        { wch: 16 },
        { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stop_Summary");
      XLSX.writeFile(wb, `Laporan_Stop_Summary_${rangeTag}_${dateStamp}.xlsx`);
    } else if (activeReport === "mttr-mtbf") {
      const rows = filteredMttr.map((r, idx) => ({
        No: idx + 1,
        Date: r.date,
        Area: neutralizeExcelCell(r.areaName),
        Station: neutralizeExcelCell(r.stationName),
        Category_Name: neutralizeExcelCell(r.categoryName),
        Reason: neutralizeExcelCell(r.reason),
        Total_Downtime_Min: Math.round(r.totalDowntimeMs / 60_000),
        Total_Downtime_Format: fmtDuration(r.totalDowntimeMs),
        MTTR_Minutes: r.mttrMs !== null ? Math.round(r.mttrMs / 60_000) : "N/A",
        MTBF_Hours: r.mtbfMs !== null ? +(r.mtbfMs / 3_600_000).toFixed(1) : "N/A",
        Operating_Time_Hours: +r.operatingHours.toFixed(1),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 22 },
        { wch: 26 },
        { wch: 26 },
        { wch: 30 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 22 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MTTR_MTBF_Report");
      XLSX.writeFile(wb, `Laporan_MTTR_MTBF_${rangeTag}_${dateStamp}.xlsx`);
    } else if (activeReport === "oee") {
      const rows = filteredOee.map((r, idx) => ({
        No: idx + 1,
        Date: formatReportDate(r.date),
        Shift: r.shiftType === "pagi" || r.shiftId === "shift-1"
          ? "Morning"
          : r.shiftType === "malam" || r.shiftId === "shift-2"
            ? "Night"
            : r.shiftName,
        Production_Area: neutralizeExcelCell(r.areaName),
        Planned_Production_Time_Min: r.plannedMin,
        Planned_Production_Time_Format: fmtDuration(r.plannedMin * 60_000),
        Total_Downtime_Menit: Math.round(r.downtimeMs / 60_000),
        Total_Downtime_Format: fmtDuration(r.downtimeMs),
        Availability_Pct: +(r.availability * 100).toFixed(2),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },  // No
        { wch: 22 }, // Date
        { wch: 14 }, // Shift
        { wch: 24 }, // Production_Area
        { wch: 32 }, // Waktu_Kerja_Yang_Tersedia_Menit
        { wch: 32 }, // Waktu_Kerja_Yang_Tersedia_Format
        { wch: 24 }, // Total_Downtime_Menit
        { wch: 24 }, // Total_Downtime_Format
        { wch: 18 }, // Availability_Pct
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "OEE_Report");
      XLSX.writeFile(wb, `Laporan_OEE_${rangeTag}_${dateStamp}.xlsx`);
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
    }
  }, [activeReport, filteredStopSummary.length, filteredMttr.length, filteredOee.length]);

  const isAreaFilled = Boolean(selectedArea && selectedArea.trim() !== "");
  const isStationFilled = Boolean(selectedStation && selectedStation.trim() !== "");
  const isDateRangeFilled = Boolean(startDate && startDate.trim() !== "" && endDate && endDate.trim() !== "");
  const canDownload = isAreaFilled && isStationFilled && isDateRangeFilled && activeRowCount > 0;

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
            ]}
          />
        </div>
      </div>

      {/* Main Table Preview Section with Search & Download Button */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs">
        {/* Table Toolbar: Search (Fill Container) on Left, Area Dropdown, Date Range Picker & Download Button on Right */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#152a47] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
          {/* Search Input (Fill Container) */}
          <Search
            containerClassName="flex-1 w-full"
            placeholder={t("rep.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Right: Area Dropdown, Station Dropdown, Date Range Picker on Left of Download Report Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Area Select Dropdown to the left of Station Filter */}
            <div className="w-36 sm:w-44">
              <SelectInput
                hideClear
                value={selectedArea}
                onChange={handleAreaChange}
                datalist={[
                  { value: "all", label: `All Areas (${appState.areas.length})` },
                  ...appState.areas.map((a) => ({
                    value: a.id,
                    label: a.name,
                  })),
                ]}
                placeholder="Select Area"
              />
            </div>

            {/* Station Select Dropdown to the right of Area Filter */}
            <div className="w-36 sm:w-44">
              <SelectInput
                hideClear
                value={selectedStation}
                onChange={handleStationChange}
                datalist={[
                  { value: "all", label: `All Stations (${availableStations.length})` },
                  ...availableStations.map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
                placeholder="Select Station"
              />
            </div>

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

            {/* Download Report Button (Active if Area, Station, and Date Range are filled and data exists) */}
            <button
              onClick={handleExportCurrentReport}
              disabled={!canDownload}
              title={
                !isAreaFilled
                  ? "Pilih Area terlebih dahulu untuk mengunduh laporan"
                  : !isStationFilled
                    ? "Pilih Station terlebih dahulu untuk mengunduh laporan"
                    : !isDateRangeFilled
                      ? "Pilih Date Range terlebih dahulu untuk mengunduh laporan"
                      : activeRowCount === 0
                        ? "Tidak ada data untuk diunduh sesuai filter yang dipilih"
                        : "Download Report"
              }
              className="flex items-center gap-2 rounded-lg bg-[#ff5a1f] hover:bg-[#e04810] text-white px-4 py-2 font-sans text-xs font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer h-10"
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
                  <th className="py-3.5 px-4 w-12 text-center whitespace-nowrap">NO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      AREA <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      START LINESTOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      FINISH LINESTOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SHIFT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STOP DURATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      LAST SPEED <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL RUN TIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SUBMITTED DATE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SUBMITTED BY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CATEGORY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      REASONS <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedStopSummary.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedStopSummary.map((stop, idx) => {
                    const station = appState.stations.find((s) => s.id === stop.stationId);
                    const area = appState.areas.find((a) => a.id === (stop.areaId || station?.areaId));
                    const cat = appState.categories.find((c) => c.id === stop.categoryId);
                    const isOpen = stop.status === "open" || !stop.endMs;
                    const duration = stopDurationMs(stop, nowMs);

                    const isFormFilled = Boolean(
                      stop.source === "form" &&
                      Boolean(stop.reportedBy?.trim()) &&
                      Boolean(stop.categoryId?.trim())
                    );

                    const speedVal = typeof stop.lastSpeed === "number"
                      ? stop.lastSpeed
                      : (station?.nominalSpeed ?? 12.5);
                    const speedUnit = station?.speedUnit || "m/min";

                    const totalRunVal = typeof stop.totalRunMs === "number"
                      ? stop.totalRunMs
                      : (appState.stationLive[stop.stationId]?.totalRunMs ?? 14_400_000);

                    const submittedAt = stop.submittedAtMs ?? (isFormFilled ? stop.endMs || stop.startMs : null);
                    const shiftInfo = getShiftForStop(stop);

                    return (
                      <tr key={stop.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        {/* 1. NO */}
                        <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                          {(reportPage - 1) * reportPageSize + idx + 1}
                        </td>

                        {/* 2. AREA */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-zinc-300 font-medium">
                          {area?.name ?? stop.areaId}
                        </td>

                        {/* 3. STATION */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-zinc-100">{station?.name ?? stop.stationId}</div>
                          {station?.code && (
                            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">{station.code}</div>
                          )}
                        </td>

                        {/* 4. START LINESTOP */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-zinc-200 font-medium">
                          {fmtDateFullHuman(stop.startMs)}{" "}
                          <span className="text-slate-500 dark:text-zinc-400 font-normal">({fmtTime(stop.startMs)})</span>
                        </td>

                        {/* 5. FINISH LINESTOP */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                          {stop.endMs ? (
                            <span className="text-slate-800 dark:text-zinc-200 font-medium">
                              {fmtDateFullHuman(stop.endMs)}{" "}
                              <span className="text-slate-500 dark:text-zinc-400 font-normal">({fmtTime(stop.endMs)})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Ongoing
                            </span>
                          )}
                        </td>

                        {/* 6. SHIFT */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${shiftInfo.badgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${shiftInfo.dotClass}`} />
                            <span>{shiftInfo.shortName}</span>
                          </span>
                        </td>

                        {/* 7. STOP DURATION */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                          {isOpen ? (
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {fmtDuration(duration)} <span className="text-[10px] font-normal uppercase">(Ongoing)</span>
                            </span>
                          ) : (
                            <span className="text-slate-800 dark:text-zinc-200 font-medium">{fmtDuration(duration)}</span>
                          )}
                        </td>

                        {/* 8. LAST SPEED */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-zinc-200 font-medium">
                          {speedVal.toFixed(1)} {speedUnit}
                        </td>

                        {/* 9. TOTAL RUN TIME */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500 dark:text-zinc-400 font-medium">
                          {fmtDuration(totalRunVal)}
                        </td>

                        {/* 10. SUBMITTED DATE */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                          {isFormFilled && submittedAt ? (
                            <span className="text-slate-800 dark:text-zinc-200 font-medium">{fmtDateTimeFull(submittedAt)}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 italic font-mono text-[11px]">
                              — (Pending)
                            </span>
                          )}
                        </td>

                        {/* 11. SUBMITTED BY */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-zinc-300">
                          {isFormFilled && stop.reportedBy ? (
                            <span className="font-medium text-slate-900 dark:text-white">{stop.reportedBy}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 12. CATEGORY */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-zinc-300">
                          {isFormFilled && (cat || stop.categoryId) ? (
                            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200">
                              {cat?.name || stop.categoryId}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* 13. REASONS */}
                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-zinc-300 max-w-[260px]">
                          {isFormFilled && stop.note ? (
                            <span className="truncate block" title={stop.note}>
                              {stop.note}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
                      DATE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      AREA <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CATEGORY NAME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      REASON <ArrowUpDown className="h-3 w-3 text-slate-400" />
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
                    <td colSpan={10} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      {t("rep.noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedMttr.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                        {(reportPage - 1) * reportPageSize + idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-zinc-200">
                          {row.areaName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                        <div className="font-semibold">{row.stationName}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.categoryName !== "—" ? (
                          <span className="text-xs font-medium text-foreground">
                            {row.categoryName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-zinc-300 max-w-[260px]">
                        {row.reason !== "—" ? (
                          <span className="truncate block" title={row.reason}>
                            {row.reason}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                        )}
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
            <div className="flex flex-col">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">NO</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        DATE <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        SHIFT <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        PRODUCTION AREA <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        PLANNED PRODUCTION TIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        TOTAL DOWNTIME <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap" title="Availability = Operating Time / Planned Production Time">
                      <span className="inline-flex items-center gap-1">
                        AVAILABILITY <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {paginatedOee.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono text-xs">
                        {t("rep.noData")}
                      </td>
                    </tr>
                  ) : (
                    paginatedOee.map((row, idx) => {
                      const isMorning = row.shiftType === "pagi" || row.shiftId === "shift-1";
                      const isNight = row.shiftType === "malam" || row.shiftId === "shift-2";
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                            {(reportPage - 1) * reportPageSize + idx + 1}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                            {formatReportDate(row.date)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isMorning ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                <span>Morning</span>
                              </span>
                            ) : isNight ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 dark:text-indigo-300 border border-indigo-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                <span>Night</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                                <span>{row.shiftName}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-foreground font-medium whitespace-nowrap">
                            {row.areaName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-foreground font-semibold whitespace-nowrap">
                            {row.plannedMin} m
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">
                              ({fmtDuration(row.plannedMin * 60_000)})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                            <span className={row.downtimeMs > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"}>
                              {Math.round(row.downtimeMs / 60_000)} m
                            </span>
                            {row.downtimeMs > 0 && (
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                ({fmtDuration(row.downtimeMs)})
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                            {(row.availability * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
                : filteredOee.length
          }
          onPageChange={setReportPage}
          onPageSizeChange={setReportPageSize}
        />
      </div>
    </div>
  );
}
