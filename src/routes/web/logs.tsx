import { createFileRoute, useLocation, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  History,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
  Plus,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import type { LineStop } from "../../lib/types";
import {
  fmtDateTime,
  fmtTime,
  fmtDuration,
  toLocalInputValue,
  fromLocalInputValue,
  sortStops,
  shiftOf,
} from "../../lib/format";
import { stopDurationMs } from "../../lib/calc";
import { toast } from "sonner";
import { SelectInput } from "../../components/ui/select-input";
import { Search } from "../../components/ui/search";
import { TablePagination } from "../../components/TablePagination";
import { Tabs } from "../../components/ui/tablist";
import { DateRangePicker } from "../../components/DateRangePicker";
import { Eye, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/web/logs")({
  validateSearch: (search: Record<string, unknown> = {}) => {
    return {
      stationId: typeof search?.["stationId"] === "string" ? String(search["stationId"]) : undefined,
      areaId: typeof search?.["areaId"] === "string" ? String(search["areaId"]) : undefined,
    };
  },
  errorComponent: LogsErrorFallback,
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Log History & Audit" },
      { name: "description", content: "Complete history of conveyor line stops, PLC detections, and corrections." },
    ],
  }),
  component: LogHistoryPage,
});

function LogsErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  console.error("Logs page error:", error);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-foreground">Error Loading Logs</h3>
        <p className="text-sm text-muted-foreground">
          Terjadi kendala saat memuat filter log history stasiun. Silakan reset filter untuk memuat seluruh riwayat.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/web/logs";
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs cursor-pointer"
          >
            Reset Filters & View All
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

type ViewMode = "list" | "summary";

function LogHistoryPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Date Range state matching Dashboard
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 6 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const { rangeStartMs, rangeEndMs } = useMemo(() => {
    const sDate = startDate || new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const eDate = endDate || new Date().toISOString().slice(0, 10);
    const start = Date.parse(`${sDate}T00:00:00+07:00`) || (nowMs - 7 * 86_400_000);
    const end = Date.parse(`${eDate}T23:59:59.999+07:00`) || nowMs;
    return { rangeStartMs: start, rangeEndMs: end };
  }, [startDate, endDate, nowMs]);

  const location = useLocation();
  const search = useMemo(() => {
    const s = (location.search || {}) as Record<string, any>;
    let areaId = typeof s.areaId === "string" ? s.areaId : undefined;
    let stationId = typeof s.stationId === "string" ? s.stationId : undefined;
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        if (!areaId && sp.get("areaId")) areaId = sp.get("areaId") || undefined;
        if (!stationId && sp.get("stationId")) stationId = sp.get("stationId") || undefined;
      } catch {
        // ignore
      }
    }
    return { areaId, stationId };
  }, [location.search]);

  const searchAreaId = useMemo(() => {
    if (search.areaId) return search.areaId;
    if (search.stationId) {
      const found = (appState?.stations || []).find((s) => s && s.id === search.stationId);
      if (found) return found.areaId;
    }
    return undefined;
  }, [search.areaId, search.stationId, appState?.stations]);

  const [selectedArea, setSelectedArea] = useState<string>(() => searchAreaId || "all");
  const [selectedStation, setSelectedStation] = useState<string>(() => search.stationId || "all");

  useEffect(() => {
    if (searchAreaId) setSelectedArea(searchAreaId);
    if (search.stationId) setSelectedStation(search.stationId);
  }, [searchAreaId, search.stationId]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

  // Available stations filtered by selected area
  const availableStations = useMemo(() => {
    if (selectedArea === "all") return appState.stations;
    return appState.stations.filter((s) => s.areaId === selectedArea);
  }, [selectedArea, appState.stations]);

  const handleAreaChange = (newAreaId: string) => {
    setSelectedArea(newAreaId);
    if (newAreaId !== "all" && selectedStation !== "all") {
      const match = appState.stations.some(
        (s) => s.id === selectedStation && s.areaId === newAreaId,
      );
      if (!match) {
        setSelectedStation("all");
      }
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingStop, setViewingStop] = useState<LineStop | null>(null);

  // Correction Modal State
  const [correctingStop, setCorrectingStop] = useState<LineStop | null>(null);
  const [corrCategoryId, setCorrCategoryId] = useState("");
  const [corrStartVal, setCorrStartVal] = useState("");
  const [corrEndVal, setCorrEndVal] = useState("");
  const [corrReportedBy, setCorrReportedBy] = useState("");
  const [corrNote, setCorrNote] = useState("");
  const [corrReason, setCorrReason] = useState("");

  // Void Modal State
  const [voidingStop, setVoidingStop] = useState<LineStop | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Filtered Stops
  const filteredStops = useMemo(() => {
    let result = sortStops(appState.stops);

    result = result.filter((s) => s.startMs >= rangeStartMs && s.startMs <= rangeEndMs);

    if (selectedArea !== "all") {
      result = result.filter((s) => s.areaId === selectedArea);
    }
    if (selectedStation !== "all") {
      result = result.filter((s) => s.stationId === selectedStation);
    }
    if (selectedCategory !== "all") {
      result = result.filter((s) => s.categoryId === selectedCategory);
    }
    if (selectedStatus === "open") {
      result = result.filter((s) => s.status === "open");
    } else if (selectedStatus === "closed") {
      result = result.filter((s) => s.status === "closed");
    } else if (selectedStatus === "unrecorded") {
      result = result.filter((s) => s.source === "plc");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        const st = appState.stations.find((x) => x.id === s.stationId);
        return (
          s.reportedBy.toLowerCase().includes(q) ||
          (s.note && s.note.toLowerCase().includes(q)) ||
          (cat && cat.name.toLowerCase().includes(q)) ||
          (st && st.name.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [appState.stops, rangeStartMs, rangeEndMs, selectedArea, selectedStation, selectedCategory, selectedStatus, searchQuery, appState.categories, appState.stations]);

  // Paginated Stops for Table View
  const paginatedStops = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStops.slice(start, start + pageSize);
  }, [filteredStops, currentPage, pageSize]);

  const stationSummary = useMemo(() => {
    return appState.stations.map((station) => {
      const stStops = appState.stops.filter((s) => s.stationId === station.id && s.startMs >= rangeStartMs && s.startMs <= rangeEndMs);
      const totalDuration = stStops.reduce((sum, s) => sum + stopDurationMs(s, nowMs), 0);
      const avgDuration = stStops.length > 0 ? totalDuration / stStops.length : 0;
      return {
        station,
        count: stStops.length,
        totalDuration,
        avgDuration,
        stops: sortStops(stStops),
      };
    });
  }, [appState.stations, appState.stops, rangeStartMs, rangeEndMs, nowMs]);

  const handleOpenCorrectModal = (stop: LineStop) => {
    setCorrectingStop(stop);
    setCorrCategoryId(stop.categoryId);
    setCorrStartVal(toLocalInputValue(stop.startMs));
    setCorrEndVal(stop.endMs ? toLocalInputValue(stop.endMs) : "");
    setCorrReportedBy(stop.reportedBy);
    setCorrNote(stop.note ?? "");
    setCorrReason("");
  };

  const handleSaveCorrection = () => {
    if (!correctingStop) return;
    if (!corrReason.trim()) {
      toast.error(t("logs.reasonRequired"));
      return;
    }

    const startMs = fromLocalInputValue(corrStartVal);
    const endMs = corrEndVal ? fromLocalInputValue(corrEndVal) : null;

    if (isNaN(startMs)) {
      toast.error("Invalid start time");
      return;
    }
    if (endMs && endMs < startMs) {
      toast.error(t("form.error.endBeforeStart"));
      return;
    }

    store.correctStop(
      correctingStop.id,
      {
        categoryId: corrCategoryId,
        startMs,
        endMs,
        reportedBy: corrReportedBy.trim() || correctingStop.reportedBy,
        note: corrNote.trim() || undefined,
        source: "form",
      },
      corrReason,
      "Super Admin"
    );

    toast.success(t("logs.saved"));
    setCorrectingStop(null);
  };

  const handleCloseStop = (stop: LineStop) => {
    store.closeStop(stop.id, Date.now());
    toast.success("Stop successfully closed");
  };

  const handleConfirmVoid = () => {
    if (!voidingStop) return;
    if (!voidReason.trim()) {
      toast.error(t("logs.reasonRequired"));
      return;
    }
    store.voidStop(voidingStop.id, voidReason, "Super Admin");
    toast.success("Stop successfully voided");
    setVoidingStop(null);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Title & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("logs.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("logs.subtitle")}
          </p>
        </div>

        {/* Tablist on the Right */}
        <div className="flex items-center">
          <Tabs
            variant="primary"
            value={viewMode}
            onValueChange={(val) => {
              setViewMode(val as ViewMode);
              setCurrentPage(1);
            }}
            items={[
              { value: "list", label: "List View", badge: filteredStops.length },
              { value: "summary", label: "Summary View", badge: stationSummary.length },
            ]}
          />
        </div>
      </div>

      {/* Main View Content */}
      {viewMode === "list" ? (
        /* LIST VIEW TABLE - Unified Card matching Reference Style */
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs">
          {/* Top Filter Toolbar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
            {/* Search on Left (Fill Container) */}
            <Search
              containerClassName="flex-1 w-full"
              placeholder="Search by operator, note, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Filters on Right */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36 sm:w-44">
                <SelectInput
                  hideClear
                  value={selectedArea}
                  onChange={(val) => handleAreaChange(val ?? "all")}
                  datalist={[
                    { value: "all", label: `All Areas (${appState.areas.length})` },
                    ...appState.areas.map((a) => ({
                      value: a.id,
                      label: a.name,
                    })),
                  ]}
                  placeholder="All Areas"
                />
              </div>

              <div className="w-36 sm:w-44">
                <SelectInput
                  hideClear
                  value={selectedStation}
                  onChange={(val) => setSelectedStation(val ?? "all")}
                  datalist={[
                    { value: "all", label: `All Stations (${availableStations.length})` },
                    ...availableStations.map((st) => ({
                      value: st.id,
                      label: st.name,
                    })),
                  ]}
                  placeholder="All Stations"
                />
              </div>

              <div className="w-36 sm:w-44">
                <SelectInput
                  hideClear
                  value={selectedCategory}
                  onChange={(val) => setSelectedCategory(val ?? "all")}
                  datalist={[
                    { value: "all", label: "All Categories" },
                    ...appState.categories.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.countsAsBreakdown ? " (Breakdown)" : ""}`,
                    })),
                  ]}
                  placeholder="All Categories"
                />
              </div>

              <div className="w-32 sm:w-36">
                <SelectInput
                  hideClear
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val ?? "all")}
                  datalist={[
                    { value: "all", label: "All Status" },
                    { value: "open", label: "Open (Running)" },
                    { value: "closed", label: "Closed" },
                    { value: "unrecorded", label: "Stop PLC" },
                  ]}
                  placeholder="All Status"
                />
              </div>

              {/* Date Range Picker beside All Status Filter */}
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                  setCurrentPage(1);
                }}
                onReset={() => {
                  const now = new Date();
                  const todayStr = now.toISOString().slice(0, 10);
                  const past = new Date(Date.now() - 6 * 86_400_000);
                  setStartDate(past.toISOString().slice(0, 10));
                  setEndDate(todayStr);
                  setCurrentPage(1);
                }}
              />

              <button
                onClick={() => {
                  setSelectedArea("all");
                  setSelectedStation("all");
                  setSelectedCategory("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                  const now = new Date();
                  const todayStr = now.toISOString().slice(0, 10);
                  const past = new Date(Date.now() - 6 * 86_400_000);
                  setStartDate(past.toISOString().slice(0, 10));
                  setEndDate(todayStr);
                  setCurrentPage(1);
                }}
                className="text-xs font-sans text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 h-9 rounded-lg border border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs shrink-0 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-zinc-800/80 bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-28 whitespace-nowrap">ACTION</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      START TIME (WIB)
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      END TIME
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATION
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      CATEGORY
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DURATION
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SOURCE
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      OPERATOR
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      STATUS
                      <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedStops.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground font-mono">
                      {t("common.emptyPeriod")}
                    </td>
                  </tr>
                ) : (
                  paginatedStops.map((stop) => {
                    const st = appState.stations.find((x) => x.id === stop.stationId);
                    const cat = appState.categories.find((c) => c.id === stop.categoryId);
                    const isOpen = stop.status === "open";
                    const duration = stopDurationMs(stop, nowMs);

                    return (
                      <tr key={stop.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                        {/* Action Column on Left */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {/* View Button [ 👁 ] */}
                            <button
                              type="button"
                              onClick={() => setViewingStop(stop)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600 shadow-2xs transition-colors"
                              title="View Log Detail"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit / Correct Button [ ✏ ] */}
                            <button
                              type="button"
                              onClick={() => handleOpenCorrectModal(stop)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 shadow-2xs transition-colors"
                              title="Correct / Edit Log"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete / Void Button [ 🗑 ] */}
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingStop(stop);
                                setVoidReason("");
                              }}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 shadow-2xs transition-colors"
                              title="Cancel / Void"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            {isOpen && (
                              <button
                                type="button"
                                onClick={() => handleCloseStop(stop)}
                                className="px-2 h-7 inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-2xs transition-colors"
                                title="Close Stop Status"
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Waktu Mulai */}
                        <td className="py-3.5 px-4 font-mono text-[13px] text-foreground font-semibold whitespace-nowrap">
                          {fmtDateTime(stop.startMs)}
                        </td>

                        {/* Waktu Selesai */}
                        <td className="py-3.5 px-4 font-mono text-[13px] text-muted-foreground whitespace-nowrap">
                          {stop.endMs ? fmtTime(stop.endMs) : <span className="text-amber-500 font-semibold">— still running —</span>}
                        </td>

                        {/* Stasiun */}
                        <td className="py-3.5 px-4 font-sans font-medium text-foreground whitespace-nowrap">
                          <div>{st?.name ?? stop.stationId}</div>
                          {stop.note && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {stop.note}
                            </div>
                          )}
                        </td>

                        {/* Kategori */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-foreground font-medium">{cat?.name ?? stop.categoryId}</div>
                          <div className="flex gap-1 mt-0.5">
                            {cat?.countsAsBreakdown && (
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
                                Breakdown
                              </span>
                            )}
                            {cat?.custom && (
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Durasi */}
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <span className={isOpen ? "text-red-600 dark:text-red-400 font-bold" : "text-foreground font-semibold"}>
                            {fmtDuration(duration)}
                          </span>
                        </td>

                        {/* Sumber */}
                        <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                          {stop.source === "plc" ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                              PLC
                            </span>
                          ) : stop.formType === "mtc" ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-bold">
                              E-form (MTC)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                              E-form
                            </span>
                          )}
                        </td>

                        {/* Operator */}
                        <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                          {stop.reportedBy}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                              Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Bar (Sesuai Referensi Visual) */}
          <TablePagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={filteredStops.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
        /* SUMMARY BY STATION VIEW */
        <div className="space-y-3">
          {stationSummary.map((item) => {
            const isExpanded = expandedStationId === item.station.id;
            return (
              <div
                key={item.station.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-colors shadow-xs"
              >
                <div
                  onClick={() => setExpandedStationId(isExpanded ? null : item.station.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <h4 className="font-mono text-sm font-bold text-foreground">{item.station.name}</h4>
                      <p className="text-xs text-muted-foreground font-sans">
                        Urutan #{item.station.sequence} • Threshold {item.station.runningThreshold} {item.station.speedUnit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs">
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase">Frequency</span>
                      <span className="text-foreground font-bold">{item.count}× occurrences</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase">Total Duration</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{fmtDuration(item.totalDuration)}</span>
                    </div>
                    <div className="text-right hidden sm:block">
                      <span className="text-muted-foreground block text-[10px] uppercase">Average</span>
                      <span className="text-foreground">{fmtDuration(item.avgDuration)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Occurrences List */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <h5 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Occurrence Details ({item.stops.length})
                    </h5>
                    {item.stops.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono">No stop records for this station yet.</p>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {item.stops.map((s) => {
                          const cat = appState.categories.find((c) => c.id === s.categoryId);
                          return (
                            <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground font-sans">{cat?.name ?? s.categoryId}</span>
                                  {s.status === "open" && (
                                    <span className="font-mono text-[9px] px-1 rounded bg-red-500/20 text-red-600 dark:text-red-400 font-bold">OPEN</span>
                                  )}
                                  {s.source === "plc" && (
                                    <span className="font-mono text-[9px] px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">PLC</span>
                                  )}
                                </div>
                                <div className="font-mono text-[11px] text-muted-foreground">
                                  {fmtDateTime(s.startMs)} • Reported by: {s.reportedBy}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="font-bold text-foreground">{fmtDuration(stopDurationMs(s, nowMs))}</span>
                                <button
                                  onClick={() => handleOpenCorrectModal(s)}
                                  className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                  Correct
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL KOREKSI (Audit trail mandatory reason) */}
      {correctingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  Correct Line Stop #{correctingStop.id}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  Values before correction will be permanently saved in the audit history.
                </p>
              </div>
              <button
                onClick={() => setCorrectingStop(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Category */}
              <div>
                <SelectInput
                  label="Stop Category:"
                  value={corrCategoryId}
                  onChange={(val) => setCorrCategoryId(val ?? "")}
                  datalist={appState.categories.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.countsAsBreakdown ? " (Breakdown)" : ""}`,
                  }))}
                  hideClear
                  placeholder="Select Stop Category"
                />
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                    Start Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={corrStartVal}
                    onChange={(e) => setCorrStartVal(e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                    End Time (Optional):
                  </label>
                  <input
                    type="datetime-local"
                    value={corrEndVal}
                    onChange={(e) => setCorrEndVal(e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Reported By */}
              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  Operator / Reported By:
                </label>
                <input
                  type="text"
                  value={corrReportedBy}
                  onChange={(e) => setCorrReportedBy(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2 text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  Event Notes:
                </label>
                <textarea
                  value={corrNote}
                  onChange={(e) => setCorrNote(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-input bg-background p-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Mandatory Reason */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <label className="block font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                  * Correction Reason (Required for Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="Example: Wrong category selected during emergency stop"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  className="w-full rounded border border-amber-500/40 bg-background p-2 text-foreground font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
              <button
                onClick={() => setCorrectingStop(null)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCorrection}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VOID / BATALKAN */}
      {voidingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-red-600 dark:text-red-400 mb-1">
              Void Stop #{voidingStop.id}?
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              This stop will be removed from active calculations and recorded in the audit log.
            </p>

            <div className="mb-4">
              <label className="block font-mono text-[11px] font-bold text-foreground mb-1">
                * Cancellation Reason:
              </label>
              <input
                type="text"
                placeholder="Example: Accidental duplicate entry"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full rounded border border-input bg-background p-2 text-xs text-foreground font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setVoidingStop(null)}
                className="px-3 py-1.5 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-3 py-1.5 rounded bg-red-600 text-white font-semibold font-mono text-xs hover:bg-red-500 shadow-xs"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal [ 👁 ] */}
      {viewingStop && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Detail Line Stop Event</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {viewingStop.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStop(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Station</span>
                <span className="text-foreground font-bold text-xs">
                  {appState.stations.find((x) => x.id === viewingStop.stationId)?.name ?? viewingStop.stationId}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Category</span>
                <span className="text-foreground font-bold text-xs">
                  {appState.categories.find((c) => c.id === viewingStop.categoryId)?.name ?? viewingStop.categoryId}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Start Time</span>
                <span className="text-foreground font-semibold">{fmtDateTime(viewingStop.startMs)}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">End Time</span>
                <span className="text-foreground font-semibold">
                  {viewingStop.endMs ? fmtDateTime(viewingStop.endMs) : "Still active (OPEN)"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Duration</span>
                <span className="text-foreground font-bold text-xs">{fmtDuration(stopDurationMs(viewingStop, nowMs))}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Operator / Reporter</span>
                <span className="text-foreground font-semibold">{viewingStop.reportedBy}</span>
              </div>
            </div>

            {viewingStop.note && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-[11px]">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold mb-1">Event Notes</span>
                <p className="text-foreground font-sans">{viewingStop.note}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setViewingStop(null)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
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
