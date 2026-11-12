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
import type { LineStop, Station, Category } from "../../lib/types";
import {
  fmtDateTime,
  fmtDateTimeFull,
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
import { getShiftForStop, getShiftForTimestamp, SHIFT_PAGI, SHIFT_MALAM } from "../../lib/shift";

export const Route = createFileRoute("/web/logs")({
  validateSearch: (search: Record<string, unknown> = {}): { stationId?: string; areaId?: string } => {
    const res: { stationId?: string; areaId?: string } = {};
    if (typeof search["stationId"] === "string" && search["stationId"]) res.stationId = search["stationId"];
    if (typeof search["areaId"] === "string" && search["areaId"]) res.areaId = search["areaId"];
    return res;
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

const CATEGORY_COLOR_PALETTES = [
  { bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", dot: "bg-blue-500" },
  { bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  { bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  { bg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", dot: "bg-purple-500" },
  { bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30", dot: "bg-cyan-500" },
  { bg: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30", dot: "bg-indigo-500" },
  { bg: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30", dot: "bg-teal-500" },
  { bg: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30", dot: "bg-orange-500" },
  { bg: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30", dot: "bg-violet-500" },
  { bg: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30", dot: "bg-fuchsia-500" },
];

const KNOWN_CATEGORY_COLORS: Record<string, { bg: string; dot: string }> = {
  "cat-full-cabin": { bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  "cat-mtc-prob": { bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", dot: "bg-rose-500" },
  "cat-incident": { bg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", dot: "bg-purple-500" },
  "cat-2": { bg: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", dot: "bg-red-500" },
  "cat-dock-pin": { bg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dot: "bg-sky-500" },
  "cat-1": { bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  "cat-3": { bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", dot: "bg-blue-500" },
  "cat-4": { bg: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30", dot: "bg-teal-500" },
};

function getCategoryBadgeStyle(catId?: string, catName?: string): { bg: string; dot: string } {
  if (catId && KNOWN_CATEGORY_COLORS[catId]) {
    return KNOWN_CATEGORY_COLORS[catId]!;
  }
  const str = (catName || catId || "category").toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CATEGORY_COLOR_PALETTES.length;
  return CATEGORY_COLOR_PALETTES[idx] ?? CATEGORY_COLOR_PALETTES[0]!;
}

function getRunningMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const firstDay = `${year}-${month}-01`;
  const today = now.toISOString().slice(0, 10);
  return { start: firstDay, end: today };
}

interface StationOccurrenceTableProps {
  stops: LineStop[];
  station: Station;
  categories: Category[];
  nowMs: number;
}

function StationOccurrenceTable({ stops, station, categories, nowMs }: StationOccurrenceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const filtered = useMemo(() => {
    let result = stops;

    if (selectedCategory !== "all") {
      result = result.filter((s) => s.categoryId === selectedCategory);
    }

    if (selectedShift !== "all") {
      result = result.filter((s) => getShiftForStop(s).id === selectedShift);
    }

    if (selectedStatus === "open") {
      result = result.filter((s) => s.status === "open");
    } else if (selectedStatus === "closed") {
      result = result.filter((s) => s.status === "closed");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const cat = categories.find((c) => c.id === s.categoryId);
        const catName = cat?.name?.toLowerCase() ?? "";
        const operator = s.reportedBy?.toLowerCase() ?? "";
        const note = s.note?.toLowerCase() ?? "";
        const durationStr = fmtDuration(stopDurationMs(s, nowMs)).toLowerCase();
        return (
          durationStr.includes(q) ||
          operator.includes(q) ||
          catName.includes(q) ||
          note.includes(q)
        );
      });
    }
    return result;
  }, [stops, selectedCategory, selectedShift, selectedStatus, searchQuery, categories, nowMs]);

  const paginated = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="border-t border-slate-100 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden space-y-0">
      {/* Table Toolbar with Search Bar & Category/Shift/Status Filters */}
      <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-[#152a47] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
        <Search
          containerClassName="flex-1 w-full"
          placeholder="Search by duration & operator"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {/* Shift Filter */}
          <div className="w-36 sm:w-44">
            <SelectInput
              hideClear
              value={selectedShift}
              onChange={(val) => {
                setSelectedShift(val ?? "all");
                setCurrentPage(1);
              }}
              datalist={[
                { value: "all", label: "All Shifts" },
                { value: "shift-pagi", label: "Morning" },
                { value: "shift-malam", label: "Night" },
              ]}
              placeholder="All Shifts"
            />
          </div>
          <div className="w-36 sm:w-44">
            <SelectInput
              hideClear
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val ?? "all");
                setCurrentPage(1);
              }}
              datalist={[
                { value: "all", label: "All Categories" },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
              placeholder="All Categories"
            />
          </div>
          <div className="w-32 sm:w-36">
            <SelectInput
              hideClear
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val ?? "all");
                setCurrentPage(1);
              }}
              datalist={[
                { value: "all", label: "All Status" },
                { value: "open", label: "Open (Running)" },
                { value: "closed", label: "Closed" },
              ]}
              placeholder="All Status"
            />
          </div>
        </div>
      </div>

      {/* Table matching Master Data Stations & Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
              <th className="py-3 px-4 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  START TIME
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
                  SHIFT
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground font-mono">
                  <p className="font-medium text-xs">No occurrence records found</p>
                  {searchQuery && (
                    <p className="text-[11px] mt-1 text-muted-foreground/70">
                      No occurrences matching "{searchQuery}"
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              paginated.map((stop) => {
                const cat = categories.find((c) => c.id === stop.categoryId);
                const isOpen = stop.status === "open";
                const duration = stopDurationMs(stop, nowMs);
                const badgeStyle = getCategoryBadgeStyle(stop.categoryId, cat?.name);
                const shiftInfo = getShiftForStop(stop);

                return (
                  <tr
                    key={stop.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Waktu Mulai */}
                    <td className="py-3.5 px-4 font-mono text-[13px] text-foreground font-semibold whitespace-nowrap">
                      {fmtDateTimeFull(stop.startMs)}
                    </td>

                    {/* Waktu Selesai */}
                    <td className="py-3.5 px-4 font-mono text-[13px] text-muted-foreground whitespace-nowrap">
                      {stop.endMs ? (
                        fmtDateTimeFull(stop.endMs)
                      ) : (
                        <span className="text-amber-500 font-semibold">— still running —</span>
                      )}
                    </td>

                    {/* Operational Shift */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${shiftInfo.badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${shiftInfo.dotClass}`} />
                        <span>{shiftInfo.shortName}</span>
                      </span>
                    </td>

                    {/* Kategori Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs ${badgeStyle.bg}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badgeStyle.dot}`} />
                        <span className="font-sans font-semibold">{cat?.name ?? stop.categoryId}</span>
                      </span>
                    </td>

                    {/* Durasi */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <span
                        className={
                          isOpen
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-foreground font-semibold"
                        }
                      >
                        {fmtDuration(duration)}
                      </span>
                    </td>

                    {/* Operator */}
                    <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {stop.reportedBy || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          OPEN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 text-slate-600 dark:text-slate-400 text-xs font-medium">
                          CLOSED
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

      {/* Table Pagination Bar */}
      <TablePagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        pageSizeOptions={[5, 10, 20, 50]}
      />
    </div>
  );
}

function LogHistoryPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const location = useLocation();
  const search = useMemo(() => {
    const s = (location.search || {}) as Record<string, unknown>;
    let areaId = typeof s["areaId"] === "string" ? s["areaId"] : undefined;
    let stationId = typeof s["stationId"] === "string" ? s["stationId"] : undefined;
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

  // Date Range & Area state for Summary by Station (default: Sanding Area, 1 bulan berjalan)
  const [summaryAreaId, setSummaryAreaId] = useState<string>(() => {
    return searchAreaId || "area-sanding";
  });
  const [summaryStartDate, setSummaryStartDate] = useState<string>(() => getRunningMonthRange().start);
  const [summaryEndDate, setSummaryEndDate] = useState<string>(() => getRunningMonthRange().end);

  const { summaryRangeStartMs, summaryRangeEndMs } = useMemo(() => {
    const sDate = summaryStartDate || getRunningMonthRange().start;
    const eDate = summaryEndDate || getRunningMonthRange().end;
    const start = Date.parse(`${sDate}T00:00:00+07:00`) || (nowMs - 30 * 86_400_000);
    const end = Date.parse(`${eDate}T23:59:59.999+07:00`) || nowMs;
    return { summaryRangeStartMs: start, summaryRangeEndMs: end };
  }, [summaryStartDate, summaryEndDate, nowMs]);

  const [selectedArea, setSelectedArea] = useState<string>(() => searchAreaId || "all");
  const [selectedStation, setSelectedStation] = useState<string>(() => search.stationId || "all");

  useEffect(() => {
    if (searchAreaId) {
      setSelectedArea(searchAreaId);
      setSummaryAreaId(searchAreaId);
    }
    if (search.stationId) setSelectedStation(search.stationId);
  }, [searchAreaId, search.stationId]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
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
    if (selectedShift !== "all") {
      result = result.filter((s) => getShiftForStop(s).id === selectedShift);
    }
    if (selectedCategory !== "all") {
      result = result.filter((s) => s.categoryId === selectedCategory);
    }
    if (selectedStatus === "open") {
      result = result.filter((s) => s.status === "open");
    } else if (selectedStatus === "closed") {
      result = result.filter((s) => s.status === "closed");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        const st = appState.stations.find((x) => x.id === s.stationId);
        return (
          (s.reportedBy?.toLowerCase() ?? "").includes(q) ||
          (s.note?.toLowerCase() ?? "").includes(q) ||
          (cat?.name?.toLowerCase() ?? "").includes(q) ||
          (st?.name?.toLowerCase() ?? "").includes(q)
        );
      });
    }

    return result;
  }, [appState.stops, rangeStartMs, rangeEndMs, selectedArea, selectedStation, selectedShift, selectedCategory, selectedStatus, searchQuery, appState.categories, appState.stations]);

  // Paginated Stops for Table View
  const paginatedStops = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStops.slice(start, start + pageSize);
  }, [filteredStops, currentPage, pageSize]);

  const stationSummary = useMemo(() => {
    const targetStations = summaryAreaId === "all"
      ? appState.stations
      : appState.stations.filter((st) => st.areaId === summaryAreaId);

    return targetStations.map((station) => {
      const stStops = appState.stops.filter(
        (s) => s.stationId === station.id && s.startMs >= summaryRangeStartMs && s.startMs <= summaryRangeEndMs
      );
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
  }, [appState.stations, appState.stops, summaryAreaId, summaryRangeStartMs, summaryRangeEndMs, nowMs]);

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
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("logs.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("logs.subtitle")}
          </p>
        </div>

        {/* Tablist on the Right & Summary Controls */}
        <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
          <Tabs
            variant="primary"
            value={viewMode}
            onValueChange={(val) => {
              setViewMode(val as ViewMode);
              setCurrentPage(1);
            }}
            items={[
              { value: "list", label: "List View", badge: filteredStops.length },
              { value: "summary", label: "Summary by Station", badge: stationSummary.length },
            ]}
          />

          {viewMode === "summary" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Field Select Dropdown for Area */}
              <div className="w-44 sm:w-52">
                <SelectInput
                  hideClear
                  value={summaryAreaId}
                  onChange={(val) => {
                    setSummaryAreaId(val ?? "all");
                    setExpandedStationId(null);
                  }}
                  datalist={[
                    { value: "all", label: `All Areas (${appState.areas.length})` },
                    ...appState.areas.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  placeholder="All Areas"
                />
              </div>

              {/* Date Range Picker (Default: 1 bulan berjalan) */}
              <DateRangePicker
                startDate={summaryStartDate}
                endDate={summaryEndDate}
                onChange={(start, end) => {
                  setSummaryStartDate(start);
                  setSummaryEndDate(end);
                }}
                onReset={() => {
                  const init = getRunningMonthRange();
                  setSummaryStartDate(init.start);
                  setSummaryEndDate(init.end);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main View Content */}
      {viewMode === "list" ? (
        /* LIST VIEW TABLE - Unified Card matching Reference Style */
        <div className="rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs">
          {/* Top Filter Toolbar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#152a47] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
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
                  value={selectedShift}
                  onChange={(val) => {
                    setSelectedShift(val ?? "all");
                    setCurrentPage(1);
                  }}
                  datalist={[
                    { value: "all", label: "All Shifts" },
                    { value: "shift-pagi", label: "Morning" },
                    { value: "shift-malam", label: "Night" },
                  ]}
                  placeholder="All Shifts"
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
                  ]}
                  placeholder="All Status"
                />
              </div>

              {/* Date Range Picker beside All Status Filter */}
              <DateRangePicker
                hideClear
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
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
                      SHIFT
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
                        {/* Action Column on Left - only Close button */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isOpen ? (
                            <button
                              type="button"
                              onClick={() => handleCloseStop(stop)}
                              className="px-2.5 h-7 inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-2xs transition-colors cursor-pointer"
                              title="Close Stop Status"
                            >
                              Close
                            </button>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs font-mono">—</span>
                          )}
                        </td>

                        {/* Waktu Mulai */}
                        <td className="py-3.5 px-4 font-mono text-[13px] text-foreground font-semibold whitespace-nowrap">
                          {fmtDateTime(stop.startMs)}
                        </td>

                        {/* Waktu Selesai */}
                        <td className="py-3.5 px-4 font-mono text-[13px] text-muted-foreground whitespace-nowrap">
                          {stop.endMs ? fmtTime(stop.endMs) : <span className="text-amber-500 font-semibold">— still running —</span>}
                        </td>

                        {/* Operational Shift */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {(() => {
                            const shiftInfo = getShiftForStop(stop);
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${shiftInfo.badgeClass}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${shiftInfo.dotClass}`} />
                                <span>{shiftInfo.shortName}</span>
                              </span>
                            );
                          })()}
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
                          {(() => {
                            const badgeStyle = getCategoryBadgeStyle(stop.categoryId, cat?.name);
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs ${badgeStyle.bg}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badgeStyle.dot}`} />
                                <span className="font-sans font-semibold">{cat?.name ?? stop.categoryId}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Durasi */}
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <span className={isOpen ? "text-red-600 dark:text-red-400 font-bold" : "text-foreground font-semibold"}>
                            {fmtDuration(duration)}
                          </span>
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
        stationSummary.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card text-muted-foreground font-mono">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm text-foreground">No stations found for the selected area</p>
            <p className="text-xs mt-1">Please select another area or choose "All Areas".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stationSummary.map((item) => {
              const isExpanded = expandedStationId === item.station.id;
              const stationArea = appState.areas.find((a) => a.id === item.station.areaId);

              return (
                <div
                  key={item.station.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden transition-colors shadow-xs"
                >
                  <div
                    onClick={() => setExpandedStationId(isExpanded ? null : item.station.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-zinc-800/20 select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div>
                        <h4 className="font-display text-sm font-bold text-foreground">
                          {item.station.name}
                        </h4>
                        {stationArea && (
                          <p className="text-xs text-muted-foreground font-sans mt-0.5">
                            {stationArea.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 sm:gap-7 font-mono text-xs">
                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Frequency</span>
                        <span className="text-foreground font-bold">{item.count}× occurrences</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Downtime</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">{fmtDuration(item.totalDuration)}</span>
                      </div>
                      <div className="text-right hidden sm:block">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Average</span>
                        <span className="text-foreground font-medium">{fmtDuration(item.avgDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Occurrences Table with Search matching Master Data Stations & Area */}
                  {isExpanded && (
                    <StationOccurrenceTable
                      stops={item.stops}
                      station={item.station}
                      categories={appState.categories}
                      nowMs={nowMs}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )
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
