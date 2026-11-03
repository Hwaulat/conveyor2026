import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Tablet,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowLeft,
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

// Built-in MTC Work Categories with official Category Codes
const DEFAULT_MTC_CATEGORIES = [
  { id: "mtc-01", code: "MTC-01", name: "Mechanical Maintenance", countsAsBreakdown: true },
  { id: "mtc-02", code: "MTC-02", name: "Electrical & Power Supply", countsAsBreakdown: true },
  { id: "mtc-03", code: "MTC-03", name: "Sensor, Limit Switch & PLC", countsAsBreakdown: false },
  { id: "mtc-04", code: "MTC-04", name: "Conveyor Drive & Roller Chain", countsAsBreakdown: true },
  { id: "mtc-05", code: "MTC-05", name: "Process Piping & Fluid Leak", countsAsBreakdown: false },
  { id: "mtc-06", code: "MTC-06", name: "Emergency Stop & Safety Gate", countsAsBreakdown: false },
];

function IpadEFormPage() {
  const { theme, toggleTheme } = useTheme();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());

  // Network State (with manual simulation toggle)
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  // Form Type: "linestop" | "mtc"
  const [formType, setFormType] = useState<"linestop" | "mtc">("linestop");

  // Tablist Area Configuration for iPad:
  // - Linestop: 6 Areas (Sanding, Sealing, Topcoat, Touch Up, Drop Cabin CED, Cooling Tunnel)
  // - MTC Maintenance: 2 Areas (Oven CED, Mezzanine)
  const ipadAreaConfigs = useMemo(() => {
    const list =
      formType === "mtc"
        ? [
            { key: "area-oven-ced", name: "Oven CED", code: "OVEN-CED" },
            { key: "area-mezzanine", name: "Mezzanine", code: "MEZZANINE" },
          ]
        : [
            { key: "area-sanding", name: "Sanding Area", code: "SANDING" },
            { key: "area-sealing", name: "Sealing Area", code: "SEALING" },
            { key: "area-topcoat", name: "Topcoat Area", code: "TOPCOAT" },
            { key: "area-touch-up", name: "Touch Up Area", code: "TOUCH-UP" },
            { key: "area-drop-ced", name: "Drop Cabin CED", code: "DROP-CED" },
            { key: "area-cooling-tunnel", name: "Cooling Tunnel", code: "COOLING-TUNNEL" },
          ];
    const areas = appState?.areas || [];
    return list.map((item) => {
      const found = areas.find(
        (a) =>
          a &&
          (a.id === item.key ||
            a.code?.toUpperCase() === item.code ||
            (typeof a.name === "string" && a.name.toLowerCase().includes(item.code.toLowerCase().slice(0, 4))))
      );
      return {
        id: found?.id ?? item.key,
        name: item.name,
        code: found?.code ?? item.code,
      };
    });
  }, [formType, appState?.areas]);

  const [selectedAreaId, setSelectedAreaId] = useState<string>(() => ipadAreaConfigs[0]?.id ?? "area-sanding");

  // Ensure selected area is valid for the current form type
  useEffect(() => {
    if (ipadAreaConfigs.length > 0 && !ipadAreaConfigs.some((a) => a.id === selectedAreaId)) {
      const firstArea = ipadAreaConfigs[0]!;
      setSelectedAreaId(firstArea.id);
      const st = (appState?.stations || []).filter((s) => s && s.areaId === firstArea.id);
      if (st.length > 0) setSelectedStationId(st[0]!.id);
    }
  }, [ipadAreaConfigs, selectedAreaId, appState?.stations]);

  const currentAreaConfig = useMemo(() => {
    return ipadAreaConfigs.find((a) => a.id === selectedAreaId) ?? ipadAreaConfigs[0] ?? { id: "area-sanding", name: "Sanding Area", code: "SANDING" };
  }, [ipadAreaConfigs, selectedAreaId]);

  // Stations associated with the selected area
  const areaStations = useMemo(() => {
    const stations = appState?.stations || [];
    return stations.filter((s) => s && s.areaId === selectedAreaId);
  }, [appState?.stations, selectedAreaId]);

  const [selectedStationId, setSelectedStationId] = useState<string>(() => {
    const stations = appState?.stations || [];
    const initialStations = stations.filter((s) => s && s.areaId === (ipadAreaConfigs[0]?.id ?? "area-sanding"));
    return initialStations[0]?.id ?? stations[0]?.id ?? "st-sand-1";
  });

  // Ensure selected station belongs to the active area
  useEffect(() => {
    if (areaStations.length > 0 && !areaStations.some((s) => s.id === selectedStationId)) {
      setSelectedStationId(areaStations[0]!.id);
    }
  }, [areaStations, selectedStationId]);

  const targetStation = useMemo(() => {
    return (appState?.stations || []).find((s) => s && s.id === selectedStationId);
  }, [appState?.stations, selectedStationId]);

  // Available categories based on Form Type:
  // - Linestop Maintenance: temporarily only 1 category -> "Dock pin stuck" (code: "LS-01")
  // - MTC Work: categories with Category Codes (MTC-01, MTC-02, etc.)
  const availableCategories = useMemo(() => {
    if (formType === "linestop") {
      const dockPinCat = (appState?.categories || []).find(
        (c) => c && (c.id === "cat-dock-pin" || c.name.toLowerCase().includes("dock pin"))
      ) || {
        id: "cat-dock-pin",
        code: "LS-01",
        name: "Dock pin stuck",
        countsAsBreakdown: true,
      };
      const customCats = (appState?.categories || []).filter((c) => c && c.custom);
      return [dockPinCat, ...customCats];
    } else {
      const customCats = (appState?.categories || []).filter((c) => c && c.custom);
      return [...DEFAULT_MTC_CATEGORIES, ...customCats];
    }
  }, [formType, appState?.categories]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => "cat-dock-pin");
  const [isOpenStop, setIsOpenStop] = useState<boolean>(true);
  const [startTimeVal, setStartTimeVal] = useState<string>(() => toLocalInputValue(Date.now()));
  const [endTimeVal, setEndTimeVal] = useState<string>("");
  const [operatorBadge, setOperatorBadge] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jsgi_operator_badge") || "Floor Operator (EMP-215)";
    }
    return "Floor Operator (EMP-215)";
  });
  const [note, setNote] = useState<string>("");

  // Add Category Modal
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatCode, setNewCatCode] = useState("");

  // Select Area & automatically pick first station
  const handleSelectArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    const stationsInArea = (appState?.stations || []).filter((s) => s && s.areaId === areaId);
    if (stationsInArea.length > 0) {
      setSelectedStationId(stationsInArea[0]!.id);
    }
  };

  // Change Form Type (Linestop vs MTC Maintenance)
  const handleFormTypeChange = (type: "linestop" | "mtc") => {
    setFormType(type);
    const targetConfigs =
      type === "mtc"
        ? [
            { key: "area-oven-ced", name: "Oven CED", code: "OVEN-CED" },
            { key: "area-mezzanine", name: "Mezzanine", code: "MEZZANINE" },
          ]
        : [
            { key: "area-sanding", name: "Sanding Area", code: "SANDING" },
            { key: "area-sealing", name: "Sealing Area", code: "SEALING" },
            { key: "area-topcoat", name: "Topcoat Area", code: "TOPCOAT" },
            { key: "area-touch-up", name: "Touch Up Area", code: "TOUCH-UP" },
            { key: "area-drop-ced", name: "Drop Cabin CED", code: "DROP-CED" },
            { key: "area-cooling-tunnel", name: "Cooling Tunnel", code: "COOLING-TUNNEL" },
          ];

    const areas = appState?.areas || [];
    const firstTarget = targetConfigs[0]!;
    const foundFirstArea = areas.find(
      (a) =>
        a &&
        (a.id === firstTarget.key ||
          a.code?.toUpperCase() === firstTarget.code ||
          (typeof a.name === "string" && a.name.toLowerCase().includes(firstTarget.code.toLowerCase().slice(0, 4))))
    );
    const targetAreaId = foundFirstArea?.id ?? firstTarget.key;
    setSelectedAreaId(targetAreaId);

    const st = (appState?.stations || []).filter((s) => s && s.areaId === targetAreaId);
    if (st.length > 0) {
      setSelectedStationId(st[0]!.id);
    }

    if (type === "linestop") {
      setSelectedCategoryId("cat-dock-pin");
    } else {
      setSelectedCategoryId("mtc-01");
    }
  };

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

    if (!selectedStationId || !selectedCategoryId || !operatorBadge.trim()) {
      toast.error("Please fill in all required fields (Station, Category, Operator Badge).");
      return;
    }

    const startMs = fromLocalInputValue(startTimeVal);
    if (isNaN(startMs)) {
      toast.error("Invalid start time format.");
      return;
    }

    const now = Date.now();
    if (startMs > now + 60_000) {
      toast.error("Start time cannot be in the future.");
      return;
    }

    if (now - startMs > 24 * 3_600_000) {
      toast.error("Start time cannot be more than 24 hours ago.");
      return;
    }

    let endMs: number | null = null;
    if (!isOpenStop) {
      endMs = endTimeVal ? fromLocalInputValue(endTimeVal) : now;
      if (endMs && endMs < startMs) {
        toast.error("End time cannot be earlier than start time.");
        return;
      }
      if (endMs && endMs > now + 60_000) {
        toast.error("End time cannot be in the future.");
        return;
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("jsgi_operator_badge", operatorBadge);
    }

    const targetStationObj = appState.stations.find((s) => s.id === selectedStationId);

    const stopPayload: Omit<LineStop, "id"> = {
      areaId: targetStationObj?.areaId ?? selectedAreaId,
      stationId: selectedStationId,
      startMs,
      endMs,
      categoryId: selectedCategoryId,
      reportedBy: operatorBadge.trim(),
      status: isOpenStop ? "open" : "closed",
      source: "form",
      note: note.trim() || undefined,
      formType,
    };

    if (effectiveOnline) {
      const created = store.addStop(stopPayload);
      if (isOpenStop) {
        toast.warning(
          formType === "mtc" ? "Line Start Linestop recorded as OPEN" : "Line-Stop incident recorded as OPEN"
        );
      } else {
        const dur = stopDurationMs(created, endMs ?? now);
        toast.success(
          formType === "mtc"
            ? `Finish Linestop saved. Duration: ${fmtDuration(dur)}`
            : `Line-Stop incident resolved. Duration: ${fmtDuration(dur)}`
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
    setIsOpenStop(true);
  };

  const handleAddNewCategory = () => {
    if (!newCatName.trim()) {
      toast.error("Please enter a category name.");
      return;
    }
    const created = store.addCategory({
      name: newCatName.trim(),
      code: newCatCode.trim() || `CAT-${Date.now().toString().slice(-4)}`,
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: true,
      createdBy: operatorBadge,
    });
    setSelectedCategoryId(created.id);
    toast.success(`New category saved: ${created.name}`);
    setNewCatName("");
    setNewCatCode("");
    setNewCatModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none p-4 md:p-6 lg:p-8 transition-colors">
      {/* Top Tablet Navigation */}
      <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/web"
            className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs"
            title="Back to Web Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {formType === "mtc" ? (
                <Wrench className="h-5 w-5 text-blue-500" />
              ) : (
                <Tablet className="h-5 w-5 text-cyan-500" />
              )}
              <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-foreground uppercase">
                {formType === "mtc" ? "MTC Maintenance E-Form" : "Linestop Maintenance E-Form"}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Floor Operator Tablet Mode • {currentShift.name}
            </p>
          </div>
        </div>

        {/* Network & Theme & Live Clock */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>

          {/* Network Simulator Button */}
          <button
            onClick={handleToggleOfflineMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs font-bold transition-all shadow-2xs cursor-pointer ${
              effectiveOnline
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 animate-pulse"
            }`}
            title="Click to toggle simulated online/offline"
          >
            {effectiveOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{effectiveOnline ? "ONLINE" : "OFFLINE QUEUE"}</span>
          </button>

          <div className="hidden sm:flex flex-col text-right font-mono border-l border-border pl-3">
            <span className="text-sm font-bold text-foreground">{fmtTime(nowMs)} WIB</span>
            <span className="text-[10px] text-muted-foreground">{fmtDateTime(nowMs)}</span>
          </div>
        </div>
      </header>

      {/* Main Container - Centered without Recent Entries Section */}
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-start">
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

        {/* Form Container */}
        <div className="rounded-2xl border-2 border-border bg-card p-6 md:p-8 shadow-md">
          <form onSubmit={handleSaveStop} className="space-y-6">
            {/* 0. Form Type Selector (Linestop vs MTC) */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
                E-Form Type:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleFormTypeChange("linestop")}
                  className={`p-3.5 rounded-xl border-2 font-display text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                    formType === "linestop"
                      ? "border-red-500 bg-red-600 text-white shadow-md shadow-red-600/30 scale-[1.01]"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div className="text-left">
                    <span className="block leading-none">Linestop Maintenance E-Form</span>
                    <span className="text-[10px] font-sans font-normal opacity-85">Operational & Process Stops (6 Areas)</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFormTypeChange("mtc")}
                  className={`p-3.5 rounded-xl border-2 font-display text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                    formType === "mtc"
                      ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.01]"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Wrench className="h-5 w-5 shrink-0" />
                  <div className="text-left">
                    <span className="block leading-none">MTC Maintenance E-Form</span>
                    <span className="text-[10px] font-sans font-normal opacity-85">Oven CED & Mezzanine Maintenance (2 Areas)</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 1. Tablist Area (Linestop: 6 Areas, MTC: 2 Areas) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  1. Work Area Tablist ({formType === "mtc" ? "Oven CED & Mezzanine" : "6 Production Areas"}):
                </label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {currentAreaConfig?.name} • {areaStations.length} Station(s)
                </span>
              </div>

              <div
                className={`grid gap-2 ${
                  formType === "mtc"
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-6"
                }`}
              >
                {ipadAreaConfigs.map((area) => {
                  const isAreaSelected = selectedAreaId === area.id;
                  const count = (appState?.stations || []).filter((s) => s && s.areaId === area.id).length;
                  return (
                    <button
                      type="button"
                      key={area.id}
                      onClick={() => handleSelectArea(area.id)}
                      className={`px-3 py-2.5 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        isAreaSelected
                          ? formType === "mtc"
                            ? "border-blue-500 bg-blue-600 text-white font-bold shadow-sm"
                            : "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                          : "border-border bg-card hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-xs font-bold truncate block">{area.name}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          isAreaSelected ? "text-white/80" : "text-muted-foreground"
                        }`}
                      >
                        {count} Station{count !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Stations in Selected Area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  2. Select Affected Station ({currentAreaConfig?.name}):
                </label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {targetStation ? `${targetStation.name} (${targetStation.code || `#${targetStation.sequence}`})` : ""}
                </span>
              </div>

              {areaStations.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground font-mono">
                  No stations registered in this area.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {areaStations.map((station) => {
                    const isSelected = selectedStationId === station.id;
                    const live = appState?.stationLive?.[station.id];
                    const isStopped = live?.state === "stopped";

                    return (
                      <button
                        type="button"
                        key={station.id}
                        onClick={() => setSelectedStationId(station.id)}
                        className={`p-3.5 rounded-xl border-2 text-left font-mono transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? formType === "mtc"
                              ? "border-blue-500 bg-blue-600 text-white font-bold shadow-md scale-[1.01]"
                              : "border-primary bg-primary text-primary-foreground font-bold shadow-md scale-[1.01]"
                            : isStopped
                              ? "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400 hover:border-red-500"
                              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight block truncate pr-1">
                          {station.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {station.code || `#${station.sequence}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Stop / MTC Status & Timing */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                {formType === "mtc"
                  ? "3. Line Start Linestop & Finish Linestop:"
                  : "3. Stop Status & Timing:"}
              </label>

              {/* Toggle Still Stopped vs Closed */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpenStop(true)}
                  className={`p-3.5 rounded-xl border-2 font-mono text-xs font-bold text-center transition-all cursor-pointer ${
                    isOpenStop
                      ? formType === "mtc"
                        ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "border-red-500 bg-red-600 text-white shadow-md shadow-red-600/30"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {formType === "mtc"
                    ? "Line Start Linestop (OPEN)"
                    : "Still Stopped (Save as OPEN)"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpenStop(false)}
                  className={`p-3.5 rounded-xl border-2 font-mono text-xs font-bold text-center transition-all cursor-pointer ${
                    !isOpenStop
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {formType === "mtc"
                    ? "Finish Linestop (CLOSED)"
                    : "Resolved / Completed (CLOSED)"}
                </button>
              </div>

              {/* Start & End Time Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block font-mono text-[11px] text-muted-foreground mb-1">
                    {formType === "mtc" ? "Line Start Linestop:" : "Incident Start Time:"}
                  </span>
                  <input
                    type="datetime-local"
                    value={startTimeVal}
                    onChange={(e) => setStartTimeVal(e.target.value)}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {!isOpenStop && (
                  <div>
                    <span className="block font-mono text-[11px] text-muted-foreground mb-1">
                      {formType === "mtc" ? "Finish Linestop:" : "Incident End Time:"}
                    </span>
                    <input
                      type="datetime-local"
                      value={endTimeVal}
                      onChange={(e) => setEndTimeVal(e.target.value)}
                      placeholder="Completion Time"
                      className="w-full h-12 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  {formType === "mtc"
                    ? "4. MTC Work Category (with Category Code):"
                    : "4. Incident Category (Linestop Maintenance):"}
                </label>
                <button
                  type="button"
                  onClick={() => setNewCatModalOpen(true)}
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
                          ? formType === "mtc"
                            ? "border-blue-500 bg-blue-600 text-white font-bold shadow-xs scale-[1.01]"
                            : "border-primary bg-primary text-primary-foreground font-bold shadow-xs scale-[1.01]"
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

            {/* 5. Operator / Technician & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  {formType === "mtc" ? "Technician / Badge No.:" : "Operator / Badge No.:"}
                </label>
                <input
                  type="text"
                  value={operatorBadge}
                  onChange={(e) => setOperatorBadge(e.target.value)}
                  placeholder={formType === "mtc" ? "e.g. Maintenance Tech (EMP-108)" : "e.g. Floor Operator (EMP-215)"}
                  className="w-full h-11 rounded-lg border border-input bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  {formType === "mtc" ? "MTC Work Description (Optional):" : "Additional Notes / Actions (Optional):"}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    formType === "mtc"
                      ? "e.g. Replaced conveyor roller bearing, overhauled motor drive..."
                      : "e.g. Workpiece jammed on feeder conveyor, safety gate sensor tripped..."
                  }
                  className="w-full h-11 rounded-lg border border-input bg-background px-3 font-sans text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full h-14 rounded-xl font-display text-base font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                formType === "mtc"
                  ? isOpenStop
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                  : isOpenStop
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              }`}
            >
              {formType === "mtc" ? <Wrench className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              {formType === "mtc"
                ? isOpenStop
                  ? "Save Line Start Linestop (OPEN)"
                  : "Save Finish Linestop (CLOSED)"
                : isOpenStop
                  ? "Save Line-Stop as OPEN (Still Stopped)"
                  : "Submit Line-Stop Incident Report (CLOSED)"}
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
              <div>
                <label className="block font-mono text-xs text-muted-foreground mb-1">
                  Category Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sensor Jamming"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full h-12 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-muted-foreground mb-1">
                  Category Code (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. MTC-07 or LS-02"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
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
