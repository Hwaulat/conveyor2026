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

function IpadEFormPage() {
  const { theme, toggleTheme } = useTheme();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());

  // Network State (with manual simulation toggle)
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  // Form Type: "linestop" (Linestop) | "mtc" (Linestop Maintenance)
  const [formType, setFormType] = useState<"linestop" | "mtc">("linestop");

  // Tablist Area Configuration for iPad:
  // - Linestop: 8 Areas (Sanding, Sealing, Topcoat, Touch Up, Drop Cabin CED, Cooling Tunnel, Oven CED, Mezzanine)
  // - Linestop Maintenance: 2 Areas (Oven CED, Mezzanine)
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
            { key: "area-oven-ced", name: "Oven CED", code: "OVEN-CED" },
            { key: "area-mezzanine", name: "Mezzanine", code: "MEZZANINE" },
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
      if (firstArea.id === "area-oven-ced" || firstArea.id === "area-mezzanine") {
        setSelectedStationId("");
      } else {
        const st = (appState?.stations || []).filter((s) => s && s.areaId === firstArea.id);
        if (st.length > 0) setSelectedStationId(st[0]!.id);
      }
    }
  }, [ipadAreaConfigs, selectedAreaId, appState?.stations]);

  const currentAreaConfig = useMemo(() => {
    return ipadAreaConfigs.find((a) => a.id === selectedAreaId) ?? ipadAreaConfigs[0] ?? { id: "area-sanding", name: "Sanding Area", code: "SANDING" };
  }, [ipadAreaConfigs, selectedAreaId]);

  // Stations associated with the selected area (Oven CED and Mezzanine have no stations for now)
  const areaStations = useMemo(() => {
    if (selectedAreaId === "area-oven-ced" || selectedAreaId === "area-mezzanine") {
      return [];
    }
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
    } else if (areaStations.length === 0) {
      setSelectedStationId("");
    }
  }, [areaStations, selectedStationId]);

  const targetStation = useMemo(() => {
    return (appState?.stations || []).find((s) => s && s.id === selectedStationId);
  }, [appState?.stations, selectedStationId]);

  // Available categories based on Form Type and Category configuration:
  // - Linestop: categories with forLinestop !== false
  // - Linestop Maintenance: categories with forLinestopMaintenance === true
  const availableCategories = useMemo(() => {
    const all = appState?.categories || [];
    if (formType === "linestop") {
      const filtered = all.filter((c) => c && c.active && c.forLinestop !== false);
      if (filtered.length > 0) return filtered;
      return LINESTOP_CATEGORIES;
    } else {
      const filtered = all.filter((c) => c && c.active && c.forLinestopMaintenance === true);
      if (filtered.length > 0) return filtered;
      return LINESTOP_MAINTENANCE_CATEGORIES;
    }
  }, [formType, appState?.categories]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => "cat-full-cabin");
  const [startTimeVal, setStartTimeVal] = useState<string>(() => toLocalInputValue(Date.now()));
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

  // Select Area & automatically pick first station
  const handleSelectArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    if (areaId === "area-oven-ced" || areaId === "area-mezzanine") {
      setSelectedStationId("");
      return;
    }
    const stationsInArea = (appState?.stations || []).filter((s) => s && s.areaId === areaId);
    if (stationsInArea.length > 0) {
      setSelectedStationId(stationsInArea[0]!.id);
    } else {
      setSelectedStationId("");
    }
  };

  // Change Form Type (Linestop vs Linestop Maintenance)
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
            { key: "area-oven-ced", name: "Oven CED", code: "OVEN-CED" },
            { key: "area-mezzanine", name: "Mezzanine", code: "MEZZANINE" },
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

    if (targetAreaId === "area-oven-ced" || targetAreaId === "area-mezzanine") {
      setSelectedStationId("");
    } else {
      const st = (appState?.stations || []).filter((s) => s && s.areaId === targetAreaId);
      if (st.length > 0) {
        setSelectedStationId(st[0]!.id);
      } else {
        setSelectedStationId("");
      }
    }

    if (type === "linestop") {
      setSelectedCategoryId("cat-full-cabin");
    } else {
      setSelectedCategoryId("cat-dock-pin");
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

    if ((areaStations.length > 0 && !selectedStationId) || !selectedCategoryId || !operatorBadge.trim()) {
      toast.error("Please fill in all required fields (Station, Category, Technician/Operator).");
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
      reportedBy: operatorBadge.trim(),
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
                {formType === "mtc" ? "Linestop Maintenance E-Form" : "Linestop E-Form"}
              </h1>
            </div>
          </div>
        </div>

        {/* Live Clock */}
        <div className="flex items-center">
          <div className="flex flex-col text-right font-mono">
            <span className="text-sm font-bold text-foreground">{fmtTime(nowMs)} WIB</span>
            <span className="text-[10px] text-muted-foreground">{fmtDateTime(nowMs)}</span>
          </div>
        </div>
      </header>

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

        {/* Form Container */}
        <div className="rounded-2xl border-2 border-border bg-card p-6 md:p-8 shadow-md">
          <form onSubmit={handleSaveStop} className="space-y-6">
            {/* 0. Form Type Selector (Linestop vs Linestop Maintenance) */}
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
                    <span className="block leading-none text-base font-bold">Linestop</span>
                    <span className="text-[10px] font-sans font-normal opacity-85">Operational & Production Stops (8 Areas)</span>
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
                    <span className="block leading-none text-base font-bold">Linestop Maintenance</span>
                    <span className="text-[10px] font-sans font-normal opacity-85">Oven CED & Mezzanine Maintenance (2 Areas)</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 1. Tablist Area (Linestop: 8 Areas, Linestop Maintenance: 2 Areas) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  1. Work Area Tablist ({formType === "mtc" ? "Oven CED & Mezzanine" : "8 Production Areas"}):
                </label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {currentAreaConfig?.name} • {areaStations.length} Station(s)
                </span>
              </div>

              <div
                className={`grid gap-2 ${
                  formType === "mtc"
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8"
                }`}
              >
                {ipadAreaConfigs.map((area) => {
                  const isAreaSelected = selectedAreaId === area.id;
                  const isAreaWithoutStations = area.id === "area-oven-ced" || area.id === "area-mezzanine";
                  const count = isAreaWithoutStations
                    ? 0
                    : (appState?.stations || []).filter((s) => s && s.areaId === area.id).length;
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
                  {targetStation
                    ? `${targetStation.name} (${targetStation.code || `#${targetStation.sequence}`})`
                    : areaStations.length === 0
                    ? "No stations for now"
                    : ""}
                </span>
              </div>

              {areaStations.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground font-mono">
                  No stations registered in this area for now.
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

            {/* 3. Stop Status & Timing (No Tablist, pure Incident Start Time & Incident End Time) */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5 space-y-4">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                3. Incident Timing:
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

            {/* 4. Incident Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  {formType === "mtc"
                    ? "4. Incident Category (Linestop Maintenance):"
                    : "4. Incident Category (Linestop):"}
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

            {/* 5. Technician Dropdown & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                  Technician / Operator:
                </label>
                <select
                  value={operatorBadge}
                  onChange={(e) => setOperatorBadge(e.target.value)}
                  className="w-full h-12 rounded-xl border border-input bg-background px-3 font-mono text-xs font-semibold text-foreground focus:outline-none focus:border-primary shadow-2xs cursor-pointer"
                >
                  {technicianList.map((tech) => (
                    <option key={tech.badge} value={`${tech.name} (${tech.badge})`}>
                      {tech.name} ({tech.badge}) — {tech.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                  Additional Notes / Corrective Actions:
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    formType === "mtc"
                      ? "e.g. Cleared dock pin blockage, inspected skid lifter sensor..."
                      : "e.g. Workpiece cleared from line, reset conveyor drive..."
                  }
                  className="w-full h-12 rounded-xl border border-input bg-background px-3 font-sans text-xs text-foreground focus:outline-none focus:border-primary shadow-2xs"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full h-14 rounded-xl font-display text-base font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                formType === "mtc"
                  ? endTimeVal.trim()
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                    : "bg-blue-700 hover:bg-blue-600 text-white shadow-blue-700/30"
                  : endTimeVal.trim()
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                    : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
              }`}
            >
              {formType === "mtc" ? <Wrench className="h-5 w-5" /> : <Send className="h-5 w-5" />}
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
                  placeholder={formType === "mtc" ? "e.g. Dock pin stuck" : "e.g. Sensor Jamming"}
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
