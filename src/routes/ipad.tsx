import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Tablet,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowLeft,
  ChevronLeft,
  Eye,
  Send,
  Sun,
  Moon,
  Wrench,
  Plus,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { useAppStore, store } from "../lib/store";
import type { LineStop } from "../lib/types";
import {
  fmtDateTime,
  fmtTime,
  fmtDuration,
  toLocalInputValue,
  fromLocalInputValue,
  shiftOf,
} from "../lib/format";
import { stopDurationMs } from "../lib/calc";
import { toast } from "sonner";

export const Route = createFileRoute("/ipad")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string } => {
    return {
      stationId: typeof search["stationId"] === "string" ? search["stationId"] : undefined,
      areaId: typeof search["areaId"] === "string" ? search["areaId"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Line-Stop E-Form (Tablet)" },
      { name: "description", content: "Fast touch-optimized E-form for floor operators to record emergency line stops." },
    ],
  }),
  errorComponent: IpadErrorFallback,
  component: IpadEFormPage,
});

function IpadErrorFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border-2 border-border bg-card p-6 shadow-xl text-center space-y-4 font-mono">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Unable to Load Tablet E-Form</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          An error occurred while loading form data on this device. You can try reloading the page or resetting local cached data.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-xs"
          >
            Reload Page
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.removeItem("krm_conveyor_state_v5");
                } catch {
                  // ignore
                }
                window.location.reload();
              }
            }}
            className="w-full py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground font-bold text-xs transition-colors"
          >
            Clear Cache & Restore Defaults
          </button>
          <Link
            to="/web"
            className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs text-center block"
          >
            Back to Web Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// 1. Linestop Categories: Full cabin in line, Maintenance / machine problem, Incident, Breakdown
const LINESTOP_CATEGORIES = [
  { id: "cat-full-cabin", code: "LS-01", name: "Full cabin in line", countsAsBreakdown: false },
  { id: "cat-mtc-prob", code: "LS-02", name: "Maintenance / machine problem", countsAsBreakdown: true },
  { id: "cat-incident", code: "LS-03", name: "Incident", countsAsBreakdown: false },
  { id: "cat-2", code: "LS-04", name: "Breakdown", countsAsBreakdown: true },
];

// 2. Linestop Maintenance Category: Dock pin stuck
const LINESTOP_MAINTENANCE_CATEGORIES = [
  { id: "cat-dock-pin", code: "LM-01", name: "Dock pin stuck", countsAsBreakdown: true },
];

// Standard Maintenance & Operator Technicians for Dropdown
const TECHNICIANS_PRESETS = [
  { name: "Rian Hidayat", badge: "EMP-215", role: "Floor Operator" },
  { name: "Agus Pratama", badge: "EMP-108", role: "Maintenance Supervisor" },
  { name: "Budi Santoso", badge: "EMP-001", role: "Lead MTC Engineer" },
  { name: "Hendra Wijaya", badge: "MTC-115", role: "Mechanical Technician" },
  { name: "Ahmad Fauzi", badge: "MTC-202", role: "Electrical & PLC Tech" },
  { name: "Dedi Kurniawan", badge: "MTC-304", role: "Conveyor Specialist" },
  { name: "Siti Rahma", badge: "EMP-042", role: "Shift Manager" },
  { name: "Dewi Lestari", badge: "EMP-304", role: "Quality Gate Operator" },
];

export function IpadEFormPage() {
  const { theme, toggleTheme } = useTheme();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());

  // Network State (with manual simulation toggle)
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

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

  // Target Station pre-obtained directly from clicked card in Station Live
  const targetStation = useMemo(() => {
    const stations = appState?.stations || [];
    if (search.stationId) {
      const found = stations.find((s) => s.id === search.stationId);
      if (found) return found;
    }
    if (search.areaId) {
      const found = stations.find((s) => s.areaId === search.areaId);
      if (found) return found;
    }
    // Fallback: Find currently stopped station
    const stoppedLive = Object.values(appState?.stationLive || {}).find((l) => l.state === "stopped");
    if (stoppedLive) {
      const found = stations.find((s) => s.id === stoppedLive.stationId);
      if (found) return found;
    }
    return stations[0] || null;
  }, [appState?.stations, appState?.stationLive, search.stationId, search.areaId]);

  const targetArea = useMemo(() => {
    if (!targetStation) return appState?.areas?.[0] || null;
    return (appState?.areas || []).find((a) => a.id === targetStation.areaId) || null;
  }, [appState?.areas, targetStation]);

  const targetConveyor = useMemo(() => {
    if (!targetStation?.conveyorId) return null;
    return (appState?.conveyors || []).find((c) => c.id === targetStation.conveyorId) || null;
  }, [appState?.conveyors, targetStation?.conveyorId]);

  const targetLive = useMemo(() => {
    if (!targetStation?.id) return null;
    return appState?.stationLive?.[targetStation.id] || null;
  }, [appState?.stationLive, targetStation?.id]);

  const isOvenOrMezzanine = useMemo(() => {
    const aId = targetStation?.areaId || targetArea?.id || search.areaId || "";
    const aCode = (targetArea?.code || "").toUpperCase();
    return (
      aId === "area-oven-ced" ||
      aId === "area-mezzanine" ||
      aCode === "OVEN-CED" ||
      aCode === "MEZZANINE"
    );
  }, [targetStation?.areaId, targetArea?.id, targetArea?.code, search.areaId]);

  const formType: "linestop" | "mtc" = isOvenOrMezzanine ? "mtc" : "linestop";
  const selectedStationId = targetStation?.id || "st-seal-3";
  const selectedAreaId = targetStation?.areaId || targetArea?.id || "area-sealing";

  // Active open stop for pre-obtained station
  const activeStopForStation = useMemo(() => {
    if (!targetStation?.id) return null;
    return (appState?.stops || []).find(
      (s) => s && s.stationId === targetStation.id && s.status === "open"
    ) || null;
  }, [appState?.stops, targetStation?.id]);

  // Available categories: for Oven CED & Mezzanine, starts with "Dock pin stuck" and includes any newly added maintenance categories
  const availableCategories = useMemo(() => {
    if (isOvenOrMezzanine) {
      const all = appState?.categories || [];
      const mtcList = all.filter(
        (c) => c && c.active && (c.forLinestopMaintenance === true || c.id === "cat-dock-pin" || c.name.toLowerCase().includes("dock pin"))
      );
      if (mtcList.length > 0) return mtcList;
      return LINESTOP_MAINTENANCE_CATEGORIES;
    }
    const all = appState?.categories || [];
    const filtered = all.filter((c) => c && c.active && c.forLinestop !== false);
    if (filtered.length > 0) return filtered;
    return LINESTOP_CATEGORIES;
  }, [appState?.categories, isOvenOrMezzanine]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    if (
      search.areaId === "area-oven-ced" ||
      search.areaId === "area-mezzanine" ||
      targetStation?.areaId === "area-oven-ced" ||
      targetStation?.areaId === "area-mezzanine"
    ) {
      return "cat-dock-pin";
    }
    return "cat-full-cabin";
  });

  useEffect(() => {
    if (isOvenOrMezzanine) {
      if (!availableCategories.some((c) => c.id === selectedCategoryId)) {
        setSelectedCategoryId(availableCategories[0]?.id || "cat-dock-pin");
      }
    } else if (selectedCategoryId === "cat-dock-pin") {
      setSelectedCategoryId("cat-full-cabin");
    }
  }, [isOvenOrMezzanine, availableCategories]);

  const [startTimeVal, setStartTimeVal] = useState<string>(() => {
    if (activeStopForStation?.startMs) {
      return toLocalInputValue(activeStopForStation.startMs);
    }
    const live = targetStation?.id ? appState?.stationLive?.[targetStation.id] : null;
    if (live?.lastStopMs) {
      return toLocalInputValue(live.lastStopMs);
    }
    return toLocalInputValue(Date.now());
  });

  useEffect(() => {
    if (activeStopForStation?.startMs) {
      setStartTimeVal(toLocalInputValue(activeStopForStation.startMs));
    } else if (targetStation?.id) {
      const live = appState?.stationLive?.[targetStation.id];
      if (live?.lastStopMs) {
        setStartTimeVal(toLocalInputValue(live.lastStopMs));
      }
    }
  }, [activeStopForStation, targetStation?.id, appState?.stationLive]);

  const [endTimeVal, setEndTimeVal] = useState<string>("");

  // Technician / Operator Dropdown list
  const technicianList = useMemo(() => {
    const list = [...TECHNICIANS_PRESETS];
    (appState?.users || []).forEach((u) => {
      if (u && u.badge && !list.some((t) => t.badge === u.badge)) {
        list.push({
          name: u.name,
          badge: u.badge,
          role: u.role ? u.role.toUpperCase() : "Operator",
        });
      }
    });
    return list;
  }, [appState?.users]);

  const [operatorBadge, setOperatorBadge] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jsgi_operator_badge");
      if (saved) return saved;
    }
    return `${TECHNICIANS_PRESETS[0]!.name} (${TECHNICIANS_PRESETS[0]!.badge})`;
  });

  const [note, setNote] = useState<string>("");

  // Add Category Modal
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatCode, setNewCatCode] = useState("");

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Browser online listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!simulatedOffline) {
        const count = store.syncOfflineQueue();
        if (count > 0) {
          toast.success("Network Online", {
            description: `${count} queued offline report(s) successfully synchronized to server.`,
          });
        }
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [simulatedOffline]);

  const effectiveOnline = isOnline && !simulatedOffline;
  const currentShift = shiftOf(nowMs, appState.shifts);

  const handleToggleOfflineMode = () => {
    const next = !simulatedOffline;
    setSimulatedOffline(next);
    if (!next) {
      const count = store.syncOfflineQueue();
      if (count > 0) {
        toast.success("Network Online", {
          description: `${count} queued offline report(s) synchronized to server.`,
        });
      } else {
        toast.info("Network status: ONLINE");
      }
    } else {
      toast.warning("Network status: OFFLINE QUEUE MODE");
    }
  };

  const handleSaveStop = (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveOperator = operatorBadge.trim() || `${TECHNICIANS_PRESETS[0]!.name} (${TECHNICIANS_PRESETS[0]!.badge})`;
    if (!selectedStationId || !selectedCategoryId) {
      toast.error("Please select a problem category.");
      return;
    }

    const startMs = fromLocalInputValue(startTimeVal);
    if (isNaN(startMs)) {
      toast.error("Invalid incident start time.");
      return;
    }

    const now = Date.now();
    if (startMs > now + 60_000) {
      toast.error("Incident start time cannot be in the future.");
      return;
    }

    if (now - startMs > 24 * 3_600_000) {
      toast.error("Incident start time cannot be more than 24 hours ago.");
      return;
    }

    const hasEndTime = !!endTimeVal.trim();
    let endMs: number | null = null;
    if (hasEndTime) {
      endMs = fromLocalInputValue(endTimeVal);
      if (isNaN(endMs)) {
        toast.error("Invalid incident end time.");
        return;
      }
      if (endMs < startMs) {
        toast.error("Incident end time cannot be earlier than start time.");
        return;
      }
      if (endMs > now + 60_000) {
        toast.error("Incident end time cannot be in the future.");
        return;
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("jsgi_operator_badge", operatorBadge);
    }

    const targetStationObj = appState.stations.find((s) => s.id === selectedStationId);

    const stopPayload: Omit<LineStop, "id"> = {
      areaId: targetStationObj?.areaId ?? selectedAreaId,
      stationId: selectedStationId || `${selectedAreaId}-main`,
      startMs,
      endMs,
      categoryId: selectedCategoryId,
      reportedBy: effectiveOperator,
      status: hasEndTime ? "closed" : "open",
      source: "form",
      note: note.trim() || undefined,
      formType,
    };

    if (effectiveOnline) {
      const created = store.addStop(stopPayload);
      if (!hasEndTime) {
        toast.warning(
          formType === "mtc" ? "Linestop Maintenance recorded as OPEN" : "Linestop incident recorded as OPEN"
        );
      } else {
        const dur = stopDurationMs(created, endMs ?? now);
        toast.success(
          formType === "mtc"
            ? `Linestop Maintenance closed. Duration: ${fmtDuration(dur)}`
            : `Linestop incident resolved. Duration: ${fmtDuration(dur)}`
        );
      }
    } else {
      store.queueOfflineStop(stopPayload);
      toast.info("Saved to Offline Queue", {
        description: "Will automatically sync when network connection is restored.",
      });
    }

    setNote("");
    setStartTimeVal(toLocalInputValue(Date.now()));
    setEndTimeVal("");

    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.href = `/web/station-live?areaId=${selectedAreaId}`;
      }
    }, 700);
  };

  const handleAddNewCategory = () => {
    if (!newCatName.trim()) {
      toast.error("Please enter a category name.");
      return;
    }
    const code = newCatCode.trim()
      ? newCatCode.trim().toUpperCase()
      : formType === "mtc"
      ? `LM-${Date.now().toString().slice(-4)}`
      : `LS-${Date.now().toString().slice(-4)}`;

    const created = store.addCategory({
      name: newCatName.trim(),
      code,
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: true,
      createdBy: operatorBadge,
      forLinestop: formType === "linestop",
      forLinestopMaintenance: formType === "mtc",
    });
    setSelectedCategoryId(created.id);
    toast.success(`New category saved: [${created.code || code}] ${created.name}`);
    setNewCatName("");
    setNewCatCode("");
    setNewCatModalOpen(false);
  };

  const isWebEmbedded = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname.startsWith("/web");
    }
    return typeof location?.pathname === "string" && location.pathname.startsWith("/web");
  }, [location?.pathname]);

  return (
    <div
      className={
        isWebEmbedded
          ? "space-y-5 w-full font-sans select-none"
          : "min-h-screen bg-background text-foreground flex flex-col font-sans select-none p-4 md:p-6 lg:p-8 space-y-5 transition-colors"
      }
    >
      {/* Top Header: Back button & Title matching Details Line Stop History */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          {/* Back Button matching Details Line Stop History */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = `/web/station-live?areaId=${selectedAreaId}`;
                }
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Back to Station Live"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Back</span>
          </button>

          {/* Title with Eye Icon matching Details Line Stop History */}
          <div className="flex items-center gap-2 flex-wrap">
            <Eye className="h-4 w-4 text-[#001f3f] dark:text-sky-400 stroke-[2.2]" />
            <h1 className="text-base sm:text-lg font-bold text-[#001f3f] dark:text-white tracking-tight">
              Line-Stop E-Form
            </h1>
            {targetStation && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                {targetStation.name} ({targetStation.code || `#${targetStation.sequence}`})
              </span>
            )}
          </div>
        </div>

        {/* Right side: Live Status indicator if stopped (Clock removed per user request) */}
        {targetLive?.state === "stopped" && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-mono font-bold">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>Currently STOPPED</span>
          </div>
        )}
      </div>

      {/* Main Container - Fill Screen Width */}
      <div className="w-full flex-1 flex flex-col justify-start">
        {/* Offline Queue Strip if items waiting */}
        {effectiveOnline === false && (appState?.offlineQueue || []).length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/30 p-3.5 flex items-center justify-between text-xs font-mono text-amber-600 dark:text-amber-300 shadow-sm">
            <div className="flex items-center gap-2 font-bold">
              <WifiOff className="h-4 w-4" />
              <span>Offline Queue: {(appState?.offlineQueue || []).length} report(s) pending synchronization</span>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400">Will automatically sync upon reconnection</span>
          </div>
        )}

        {/* Form Container (Fill Container Card matching Details Line Stop History) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#0b1320] p-6 sm:p-8 shadow-xs w-full">
          <form onSubmit={handleSaveStop} className="space-y-6">
            {/* Station & Area Information (Work Area, Station Conveyor Line, Station Name) */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 dark:bg-red-950/20 p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Work Area */}
                <div className="p-3 rounded-lg border border-border bg-card/80">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Work Area
                  </div>
                  <div className="text-sm font-bold text-foreground mt-1 truncate">
                    {targetArea?.name || "Production Area"}
                  </div>
                </div>

                {/* 2. Station Conveyor Line */}
                <div className="p-3 rounded-lg border border-border bg-card/80">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Station Conveyor Line
                  </div>
                  <div className="text-sm font-bold text-foreground mt-1 truncate">
                    {targetConveyor?.name || "Main Conveyor Line"}
                  </div>
                </div>

                {/* 3. Station Name */}
                <div className="p-3 rounded-lg border border-border bg-card/80">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    Station Name
                  </div>
                  <div className="text-sm font-bold text-foreground mt-1 flex items-center gap-2">
                    <span className="truncate">{targetStation?.name || "Station"}</span>
                    {targetStation?.code && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold border border-border shrink-0">
                        {targetStation.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 1. Stop Status & Timing (pure Incident Start Time & Incident End Time) */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                1. Incident Timing:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                    Incident Start Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={startTimeVal}
                    onChange={(e) => setStartTimeVal(e.target.value)}
                    className="w-full h-12 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                    Incident End Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={endTimeVal}
                    onChange={(e) => setEndTimeVal(e.target.value)}
                    placeholder="Optional (leave blank if ongoing)"
                    className="w-full h-12 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary shadow-2xs"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
                    {endTimeVal.trim() ? "● Status: CLOSED (Resolved)" : "○ Status: OPEN (Ongoing stop)"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Incident Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  2. Category Problem:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = appState.categories.length + 1;
                    const defaultPrefix = formType === "mtc" ? "LM" : "LS";
                    setNewCatCode(`${defaultPrefix}-${String(nextNum).padStart(2, "0")}`);
                    setNewCatName("");
                    setNewCatModalOpen(true);
                  }}
                  className="font-mono text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Category
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableCategories.map((c) => {
                  if (!c) return null;
                  const isSelected = selectedCategoryId === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "border-red-500 bg-red-600 text-white font-bold shadow-xs scale-[1.01]"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        {c.code && (
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {c.code}
                          </span>
                        )}
                        <span className="truncate font-semibold">{c.name}</span>
                      </div>
                      {c.countsAsBreakdown && (
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          Breakdown
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Reasons (Textarea) */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                3. Reasons:
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Workpiece cleared from line, reset conveyor drive, inspected sensor jamming..."
                className="w-full rounded-xl border border-input bg-background p-3.5 font-sans text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary shadow-2xs resize-y leading-relaxed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full h-14 rounded-xl font-display text-base font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                endTimeVal.trim()
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
              }`}
            >
              <Send className="h-5 w-5" />
              {endTimeVal.trim()
                ? "Submit Incident Report (CLOSED)"
                : "Save Incident Report (OPEN)"}
            </button>
          </form>
        </div>
      </div>

      {/* Inline Modal: Add Category */}
      {newCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-foreground mb-2">
              Add New Category
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              New categories will be immediately available and flagged for supervisor review.
            </p>

            <div className="space-y-3 mb-4">
              {/* 1. Category Code First */}
              <div>
                <label className="block font-mono text-xs text-muted-foreground mb-1">
                  Category Code:
                </label>
                <input
                  type="text"
                  placeholder={formType === "mtc" ? "e.g. LM-02" : "e.g. LS-05"}
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 font-mono text-sm font-bold uppercase text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* 2. Category Name Second */}
              <div>
                <label className="block font-mono text-xs text-muted-foreground mb-1">
                  Category Name:
                </label>
                <input
                  type="text"
                  placeholder={formType === "mtc" ? "e.g. Dock pin stuck / Lifter error" : "e.g. Sensor Jamming"}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewCatModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewCategory}
                className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold font-mono text-xs hover:bg-primary/90 shadow-xs cursor-pointer"
              >
                Save & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
