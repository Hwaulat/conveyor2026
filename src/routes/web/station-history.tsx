import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  Eye,
  ClipboardList,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import { useAppStore } from "../../lib/store";
import type { LineStop } from "../../lib/types";
import {
  fmtDateFullHuman,
  fmtDateTimeFull,
  fmtTime,
  fmtDuration,
} from "../../lib/format";
import { stopDurationMs } from "../../lib/calc";
import { TablePagination } from "../../components/TablePagination";
import { Search } from "../../components/ui/search";

export const Route = createFileRoute("/web/station-history")({
  validateSearch: (search: Record<string, unknown> = {}) => {
    return {
      stationId: typeof search?.["stationId"] === "string" ? String(search["stationId"]) : undefined,
      areaId: typeof search?.["areaId"] === "string" ? String(search["areaId"]) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Details Line Stop History" },
      { name: "description", content: "Historical telemetry and chronological records of line stops, duration, conveyor speed, and E-Form submissions." },
    ],
  }),
  component: StationHistoryPage,
});

export function StationHistoryPage() {
  const appState = useAppStore();
  const location = useLocation();
  const [nowMs, setNowMs] = useState(Date.now());

  // Tick every second for live durations
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Parse search params from route or window
  const searchParams = useMemo(() => {
    const s = (location.search || {}) as Record<string, any>;
    let stationId = typeof s.stationId === "string" ? s.stationId : undefined;
    let areaId = typeof s.areaId === "string" ? s.areaId : undefined;
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        if (!stationId && sp.get("stationId")) stationId = sp.get("stationId") || undefined;
        if (!areaId && sp.get("areaId")) areaId = sp.get("areaId") || undefined;
      } catch {
        // ignore
      }
    }
    return { stationId, areaId };
  }, [location.search]);

  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active target station & area from query parameters
  const activeStation = useMemo(() => {
    if (!searchParams.stationId) return null;
    return appState.stations.find((s) => s.id === searchParams.stationId) || null;
  }, [appState.stations, searchParams.stationId]);

  const activeLive = useMemo(() => {
    if (!activeStation) return null;
    return appState.stationLive[activeStation.id] || null;
  }, [appState.stationLive, activeStation]);

  // Filter line stops: station-scoped if stationId provided, and searched
  const filteredStops = useMemo(() => {
    let list = [...appState.stops].sort((a, b) => b.startMs - a.startMs);

    // Filter by station if navigated for a specific station
    if (searchParams.stationId) {
      list = list.filter((s) => s.stationId === searchParams.stationId);
    } else if (searchParams.areaId) {
      list = list.filter((s) => s.areaId === searchParams.areaId);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => {
        const cat = appState.categories.find((c) => c.id === s.categoryId);
        const st = appState.stations.find((x) => x.id === s.stationId);
        return (
          s.reportedBy.toLowerCase().includes(q) ||
          (s.note && s.note.toLowerCase().includes(q)) ||
          (cat && cat.name.toLowerCase().includes(q)) ||
          (cat?.code && cat.code.toLowerCase().includes(q)) ||
          (st && st.name.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [appState.stops, searchParams.stationId, searchParams.areaId, searchQuery, appState.categories, appState.stations]);

  // Paginated stops
  const paginatedStops = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStops.slice(start, start + pageSize);
  }, [filteredStops, currentPage, pageSize]);

  return (
    <div className="space-y-5 w-full">
      {/* Top Header: Back button & Title matching screenshot */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          {/* Back Button matching screenshot */}
          <Link
            to="/web/station-live"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200/90 dark:border-[#152a47] bg-white dark:bg-[#132742] hover:bg-slate-50 dark:hover:bg-[#1c3860] text-slate-800 dark:text-zinc-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Back</span>
          </Link>

          {/* Title with Eye Icon matching screenshot */}
          <div className="flex items-center gap-2 flex-wrap">
            <Eye className="h-4 w-4 text-[#001f3f] dark:text-sky-400 stroke-[2.2]" />
            <h1 className="text-base sm:text-lg font-bold text-[#001f3f] dark:text-white tracking-tight">
              Details Line Stop History
            </h1>
            {activeStation && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-[#132742] text-slate-600 dark:text-zinc-200 border border-slate-200 dark:border-[#152a47]">
                {activeStation.name} ({activeStation.code || `#${activeStation.sequence}`})
              </span>
            )}
          </div>
        </div>

        {/* Live Status indicator if stopped */}
        {activeLive?.state === "stopped" && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-mono font-bold">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>Currently STOPPED</span>
          </div>
        )}
      </div>

      {/* Main Table Card (Exact Master Data Style) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#152a47] bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs space-y-0">
        {/* Toolbar: Pure Search Bar (Matching Master Data) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-[#152a47] bg-white dark:bg-[#0b1320]">
          <Search
            containerClassName="w-full"
            placeholder="Search code, operator, reason, category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Table: Master Data exact styling */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#152a47] bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-3 px-4 whitespace-nowrap">ACTION</th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    STOPPED
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    STOP DURATION
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    LAST SPEED
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    TOTAL RUN TIME
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    SUBMITTED DATE
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    SUBMITTED BY
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
                    STAT LINESTOP
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    FINISH LINESTOP
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
                <th className="py-3 px-4 whitespace-nowrap min-w-[200px]">
                  <span className="inline-flex items-center gap-1">
                    REASONS
                    <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {paginatedStops.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground font-mono">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-sm">No line stop records found</p>
                    <p className="text-xs mt-1">Try adjusting your search keywords or station filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedStops.map((stop) => {
                  const station = appState.stations.find((x) => x.id === stop.stationId);
                  const cat = appState.categories.find((c) => c.id === stop.categoryId);
                  const isOpen = stop.status === "open";
                  const duration = stopDurationMs(stop, nowMs);

                  // E-Form is considered filled if reportedBy and categoryId are present
                  const isFormFilled = Boolean(
                    stop.source === "form" &&
                    Boolean(stop.reportedBy?.trim()) &&
                    Boolean(stop.categoryId?.trim())
                  );

                  // Speed: use stop.lastSpeed, or station nominal speed, or stationLive speed
                  const speedVal = typeof stop.lastSpeed === "number"
                    ? stop.lastSpeed
                    : (station?.nominalSpeed ?? 12.5);
                  const speedUnit = station?.speedUnit || "m/min";

                  // Total run time: use stop.totalRunMs or live totalRunMs or fallback
                  const totalRunVal = typeof stop.totalRunMs === "number"
                    ? stop.totalRunMs
                    : (appState.stationLive[stop.stationId]?.totalRunMs ?? 14_400_000);

                  // Submitted date
                  const submittedAt = stop.submittedAtMs ?? (isFormFilled ? stop.endMs || stop.startMs : null);

                  return (
                    <tr
                      key={stop.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* 1. ACTION: Button E-form line stop (aktif jika belum diisi, disabled jika sudah diisi) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {!isFormFilled ? (
                          <Link
                            to="/web/station-live/e-form"
                            search={{ areaId: stop.areaId, stationId: stop.stationId }}
                            onClick={(e) => {
                              if (typeof window !== "undefined") {
                                window.location.href = `/web/station-live/e-form?areaId=${stop.areaId}&stationId=${stop.stationId}`;
                                e.preventDefault();
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                            title="Open E-Form Line Stop"
                          >
                            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                            <span>E-Form Line Stop</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#132742]/50 text-slate-400 dark:text-[#527299] border border-slate-200 dark:border-[#152a47] cursor-not-allowed select-none whitespace-nowrap"
                            title="E-Form sudah diisi lengkap untuk incident ini"
                          >
                            <ClipboardList className="h-3.5 w-3.5 opacity-40 shrink-0" />
                            <span>E-Form Line Stop</span>
                          </button>
                        )}
                      </td>

                      {/* 2. STOPPED: (04 November 2026) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-zinc-200 font-medium">
                        {fmtDateFullHuman(stop.startMs)}
                      </td>

                      {/* 3. STOP DURATION */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                        {isOpen ? (
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {fmtDuration(duration)} <span className="text-[10px] font-normal uppercase">(Ongoing)</span>
                          </span>
                        ) : (
                          <span className="text-slate-800 dark:text-zinc-200 font-medium">{fmtDuration(duration)}</span>
                        )}
                      </td>

                      {/* 4. LAST SPEED */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-zinc-200 font-medium">
                        {speedVal.toFixed(1)} {speedUnit}
                      </td>

                      {/* 5. TOTAL RUN TIME */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500 dark:text-zinc-400 font-medium">
                        {fmtDuration(totalRunVal)}
                      </td>

                      {/* 6. SUBMITTED DATE */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                        {isFormFilled && submittedAt ? (
                          <span className="text-slate-800 dark:text-zinc-200 font-medium">{fmtDateTimeFull(submittedAt)}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 italic font-mono text-[11px]">
                            — (Pending)
                          </span>
                        )}
                      </td>

                      {/* 7. SUBMITTED BY */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-zinc-300">
                        {isFormFilled && stop.reportedBy ? (
                          <span className="font-medium text-slate-900 dark:text-white">{stop.reportedBy}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 8. CATEGORY */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-zinc-300">
                        {isFormFilled && (cat || stop.categoryId) ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            {cat?.code && <span className="text-primary font-bold">{cat.code}</span>}
                            <span>{cat?.name || stop.categoryId}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 9. STAT LINESTOP (Start Linestop) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-zinc-200 font-medium">
                        {fmtTime(stop.startMs)}
                      </td>

                      {/* 10. FINISH LINESTOP */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                        {stop.endMs ? (
                          <span className="text-slate-800 dark:text-zinc-200 font-medium">{fmtTime(stop.endMs)}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Ongoing
                          </span>
                        )}
                      </td>

                      {/* 11. REASONS */}
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
        </div>

        {/* TablePagination integrated inside the card */}
        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredStops.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </div>
  );
}
