import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  History,
  Filter,
  Search,
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
  ShieldAlert,
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

export const Route = createFileRoute("/web/logs")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Log History & Audit" },
      { name: "description", content: "Complete history of conveyor line stops, PLC detections, and corrections." },
    ],
  }),
  component: LogHistoryPage,
});

type ViewMode = "list" | "summary";

function LogHistoryPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const nowMs = Date.now();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);

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
  }, [appState.stops, selectedStation, selectedCategory, selectedStatus, searchQuery, appState.categories, appState.stations]);

  const unrecordedStops = useMemo(() => {
    return appState.stops.filter((s) => s.source === "plc");
  }, [appState.stops]);

  const stationSummary = useMemo(() => {
    return appState.stations.map((station) => {
      const stStops = appState.stops.filter((s) => s.stationId === station.id);
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
  }, [appState.stations, appState.stops, nowMs]);

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
      toast.error("Waktu mulai tidak valid");
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
    toast.success("Stop berhasil ditutup");
  };

  const handleConfirmVoid = () => {
    if (!voidingStop) return;
    if (!voidReason.trim()) {
      toast.error(t("logs.reasonRequired"));
      return;
    }
    store.voidStop(voidingStop.id, voidReason, "Super Admin");
    toast.success("Stop berhasil dibatalkan (void)");
    setVoidingStop(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 font-mono text-xs shadow-2xs">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded transition-colors ${
              viewMode === "list" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("logs.listView")}
          </button>
          <button
            onClick={() => setViewMode("summary")}
            className={`px-3 py-1.5 rounded transition-colors ${
              viewMode === "summary" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("logs.summaryView")}
          </button>
        </div>
      </div>

      {/* Unrecorded PLC Stops Alert Banner */}
      {unrecordedStops.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {t("logs.unrecorded")} ({unrecordedStops.length} Kejadian)
                </h4>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                  Perlu Verifikasi
                </span>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-200/80 mt-1">
                {t("logs.unrecordedHint")}
              </p>

              {/* Unrecorded list inline */}
              <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                {unrecordedStops.map((s) => {
                  const st = appState.stations.find((x) => x.id === s.stationId);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-foreground font-bold">{st?.name ?? s.stationId}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-amber-600 dark:text-amber-400">{fmtDateTime(s.startMs)}</span>
                        <span className="text-muted-foreground">({fmtDuration(stopDurationMs(s, nowMs))})</span>
                      </div>
                      <button
                        onClick={() => handleOpenCorrectModal(s)}
                        className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors font-bold"
                      >
                        {t("logs.correct")} / Catat Form
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari operator, catatan…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
          />
        </div>

        {/* Station Filter */}
        <div>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          >
            <option value="all">Semua Stasiun</option>
            {appState.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          >
            <option value="all">Semua Kategori</option>
            {appState.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.countsAsBreakdown ? "(Breakdown)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          >
            <option value="all">Semua Status</option>
            <option value="open">Sedang Berhenti (OPEN)</option>
            <option value="closed">Selesai (CLOSED)</option>
            <option value="unrecorded">Stop PLC (Unrecorded)</option>
          </select>
        </div>

        {/* Reset Filters */}
        <div className="flex items-center">
          <button
            onClick={() => {
              setSelectedStation("all");
              setSelectedCategory("all");
              setSelectedStatus("all");
              setSearchQuery("");
            }}
            className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-muted transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Main View Content */}
      {viewMode === "list" ? (
        /* LIST VIEW TABLE */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Stasiun</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Mulai / Selesai (WIB)</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4">Sumber</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-sans">
                {filteredStops.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground font-mono">
                      {t("common.emptyPeriod")}
                    </td>
                  </tr>
                ) : (
                  filteredStops.map((stop) => {
                    const st = appState.stations.find((x) => x.id === stop.stationId);
                    const cat = appState.categories.find((c) => c.id === stop.categoryId);
                    const isOpen = stop.status === "open";
                    const duration = stopDurationMs(stop, nowMs);

                    return (
                      <tr key={stop.id} className="hover:bg-muted/30 transition-colors">
                        {/* Status */}
                        <td className="py-3 px-4 font-mono">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 font-bold border border-red-500/30 text-[10px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                              OPEN
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px]">
                              CLOSED
                            </span>
                          )}
                        </td>

                        {/* Stasiun */}
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          <div>{st?.name ?? stop.stationId}</div>
                          {stop.note && (
                            <div className="text-[11px] text-muted-foreground font-sans line-clamp-1 mt-0.5">
                              {stop.note}
                            </div>
                          )}
                        </td>

                        {/* Kategori */}
                        <td className="py-3 px-4">
                          <div className="text-foreground font-medium">{cat?.name ?? stop.categoryId}</div>
                          <div className="flex gap-1 mt-0.5">
                            {cat?.countsAsBreakdown && (
                              <span className="font-mono text-[9px] px-1 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
                                Breakdown
                              </span>
                            )}
                            {cat?.custom && (
                              <span className="font-mono text-[9px] px-1 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Waktu */}
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          <div className="text-foreground font-semibold">{fmtDateTime(stop.startMs)}</div>
                          <div>{stop.endMs ? fmtTime(stop.endMs) : "— masih jalan —"}</div>
                        </td>

                        {/* Durasi */}
                        <td className="py-3 px-4 font-mono">
                          <span className={isOpen ? "text-red-600 dark:text-red-400 font-bold" : "text-foreground font-semibold"}>
                            {fmtDuration(duration)}
                          </span>
                        </td>

                        {/* Sumber */}
                        <td className="py-3 px-4 font-mono text-[10px]">
                          {stop.source === "plc" ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                              PLC
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              E-form
                            </span>
                          )}
                        </td>

                        {/* Operator */}
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {stop.reportedBy}
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-mono text-[11px]">
                            {isOpen && (
                              <button
                                onClick={() => handleCloseStop(stop)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-2xs"
                              >
                                Tutup
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenCorrectModal(stop)}
                              className="px-2.5 py-1 rounded border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs"
                            >
                              Koreksi
                            </button>
                            <button
                              onClick={() => {
                                setVoidingStop(stop);
                                setVoidReason("");
                              }}
                              className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                              title="Batalkan (Void)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
                      <span className="text-muted-foreground block text-[10px] uppercase">Frekuensi</span>
                      <span className="text-foreground font-bold">{item.count}× kejadian</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase">Total Durasi</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{fmtDuration(item.totalDuration)}</span>
                    </div>
                    <div className="text-right hidden sm:block">
                      <span className="text-muted-foreground block text-[10px] uppercase">Rata-rata</span>
                      <span className="text-foreground">{fmtDuration(item.avgDuration)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Occurrences List */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <h5 className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Rincian Kejadian ({item.stops.length})
                    </h5>
                    {item.stops.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono">Belum ada catatan stop untuk stasiun ini.</p>
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
                                  {fmtDateTime(s.startMs)} • Dilaporkan oleh: {s.reportedBy}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="font-bold text-foreground">{fmtDuration(stopDurationMs(s, nowMs))}</span>
                                <button
                                  onClick={() => handleOpenCorrectModal(s)}
                                  className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                  Koreksi
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
                  Koreksi Line Stop #{correctingStop.id}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  Nilai sebelum koreksi akan tersimpan permanen di riwayat audit.
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
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  Kategori Stop:
                </label>
                <select
                  value={corrCategoryId}
                  onChange={(e) => setCorrCategoryId(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2 text-foreground focus:outline-none focus:border-primary font-mono"
                >
                  {appState.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.countsAsBreakdown ? "(Breakdown)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                    Waktu Mulai:
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
                    Waktu Selesai (Opsional):
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
                  Operator / Dilaporkan Oleh:
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
                  Catatan Kejadian:
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
                  * Alasan Koreksi (Wajib untuk Audit Trail):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Salah pilih kategori saat emergency stop"
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
                Batal
              </button>
              <button
                onClick={handleSaveCorrection}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-xs"
              >
                Simpan Perubahan
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
              Batalkan (Void) Stop #{voidingStop.id}?
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Stop ini akan dihapus dari kalkulasi aktif dan dicatat dalam audit log.
            </p>

            <div className="mb-4">
              <label className="block font-mono text-[11px] font-bold text-foreground mb-1">
                * Alasan Pembatalan:
              </label>
              <input
                type="text"
                placeholder="Contoh: Entry ganda tidak sengaja"
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
                Batal
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-3 py-1.5 rounded bg-red-600 text-white font-semibold font-mono text-xs hover:bg-red-500 shadow-xs"
              >
                Konfirmasi Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
