import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../lib/store";
import { fmtDuration, dayStartMs } from "../../lib/format";
import { cn } from "../../lib/utils";
import { IpadEFormPage } from "../ipad";

export interface FusoButtonDef {
  number: number;
  code: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  shape?: "circle" | "square";
  stationId?: string;
}

export const FUSO_BUTTONS: FusoButtonDef[] = [
  { number: 1, code: "PB-01", name: "Drop Cabin CED", zone: "Transfer Cabin CED", x: 215, y: 400, shape: "circle", stationId: "st-pted-6" },
  { number: 2, code: "PB-02", name: "Sanding Outer", zone: "PC-13 Sanding", x: 510, y: 273, shape: "circle", stationId: "st-sand-1" },
  { number: 3, code: "PB-03", name: "Sanding Roof", zone: "PC-13 Sanding", x: 580, y: 273, shape: "circle", stationId: "st-sand-2" },
  { number: 4, code: "PB-04", name: "Underseal", zone: "PC-13 Sealing", x: 770, y: 273, shape: "circle", stationId: "st-seal-1" },
  { number: 5, code: "PB-05", name: "Undercoat", zone: "PC-13 Sealing", x: 825, y: 273, shape: "circle", stationId: "st-seal-2" },
  { number: 6, code: "PB-06", name: "Transfer Cabin Sealing", zone: "PC-13 Sealing", x: 875, y: 273, shape: "circle", stationId: "st-seal-3" },
  { number: 7, code: "PB-07", name: "Roof Sealing", zone: "PC-10 Sealing", x: 875, y: 223, shape: "circle", stationId: "st-seal-4" },
  { number: 8, code: "PB-08", name: "Finishing Sealing", zone: "PC-10 Sealing", x: 825, y: 223, shape: "circle", stationId: "st-seal-5" },
  { number: 9, code: "PB-09", name: "Quality Gate Sealing", zone: "PC-10 Sealing", x: 770, y: 223, shape: "circle", stationId: "st-seal-6" },
  { number: 10, code: "PB-10", name: "Transfer Cabin Touchup", zone: "Transfer Cabin Touchup", x: 939, y: 175, shape: "circle", stationId: "st-cool-1" },
  { number: 11, code: "PB-11", name: "Airblow Topcoat", zone: "TOPCOAT", x: 890, y: 122, shape: "circle", stationId: "st-tc-2" },
  { number: 12, code: "PB-12", name: "Topcoat Station 3", zone: "TOPCOAT", x: 840, y: 98, shape: "circle", stationId: "st-tc-4" },
  { number: 13, code: "PB-13", name: "Topcoat Station 4", zone: "TOPCOAT", x: 840, y: 134, shape: "circle", stationId: "st-tc-3" },
  { number: 14, code: "PB-14", name: "ASM", zone: "TOPCOAT", x: 792, y: 122, shape: "circle", stationId: "st-tc-7" },
  { number: 15, code: "PB-15", name: "Finishing", zone: "TOPCOAT", x: 742, y: 98, shape: "circle", stationId: "st-tc-6" },
  { number: 16, code: "PB-16", name: "Setting Room", zone: "TOPCOAT", x: 742, y: 134, shape: "circle", stationId: "st-tc-5" },
  { number: 17, code: "PB-17", name: "Touch Up Panel Conveyor", zone: "TOUCH UP", x: 440, y: 115, shape: "circle", stationId: "st-tu-1" },
  { number: 18, code: "PB-18", name: "Repair Touch Up", zone: "TOUCH UP", x: 235, y: 124, shape: "circle", stationId: "st-tu-2" },
];

export const Route = createFileRoute("/web/station-live")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string; lineId?: string } => {
    const res: { stationId?: string; areaId?: string; lineId?: string } = {};
    if (typeof search["stationId"] === "string" && search["stationId"]) res.stationId = search["stationId"];
    if (typeof search["areaId"] === "string" && search["areaId"]) res.areaId = search["areaId"];
    if (typeof search["lineId"] === "string" && search["lineId"]) res.lineId = search["lineId"];
    return res;
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Station Live Monitoring" },
      { name: "description", content: "Real-time Conveyor line station telemetry, speeds, and live status." },
    ],
  }),
  component: StationLivePage,
});

function StationLivePage() {
  const location = useLocation();
  const search = Route.useSearch();
  const isEForm =
    location.pathname.endsWith("/e-form") ||
    location.pathname.includes("/station-live/e-form") ||
    (typeof window !== "undefined" && window.location.pathname.includes("/e-form"));

  if (isEForm) {
    return <IpadEFormPage />;
  }

  const { t } = useI18n();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Realtime ticker every second for duration timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Navigation & Emergency Button Hover State
  const navigate = useNavigate();
  const [hoveredBtn, setHoveredBtn] = useState<FusoButtonDef | null>(null);

  // Collapsible Emergency Button Names Panel state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);

  const handleButtonClick = (btn: FusoButtonDef) => {
    if (btn.stationId) {
      navigate({
        to: "/web/station-history",
        search: { stationId: btn.stationId },
      });
    } else {
      navigate({
        to: "/web/station-history",
      });
    }
  };

  const fusoStationIds = useMemo(
    () => new Set(FUSO_BUTTONS.map((b) => b.stationId).filter(Boolean) as string[]),
    [],
  );

  const activeStations = useMemo(
    () => appState.stations.filter((s) => fusoStationIds.has(s.id)),
    [appState.stations, fusoStationIds],
  );

  const runningCount = activeStations.filter(
    (s) => appState.stationLive[s.id]?.state === "running",
  ).length;

  const stoppedCount = activeStations.filter(
    (s) => appState.stationLive[s.id]?.state === "stopped",
  ).length;

  const stopsToday = useMemo(() => {
    const todayStart = dayStartMs(nowMs);
    return appState.stops.filter((s) => s.startMs >= todayStart);
  }, [appState.stops, nowMs]);

  const longestCurrentStopMs = useMemo(() => {
    let maxDur = 0;
    for (const s of activeStations) {
      const live = appState.stationLive[s.id];
      if (live?.state === "stopped" && live.stoppedSinceMs) {
        const dur = nowMs - live.stoppedSinceMs;
        if (dur > maxDur) maxDur = dur;
      }
    }
    return maxDur;
  }, [activeStations, appState.stationLive, nowMs]);

  // Render table matching Image 1
  const renderEmergencyButtonsTable = () => (
    <table className="w-full text-left border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-[#104a6e] text-white font-bold select-none shadow-xs">
        <tr>
          <th className="py-2.5 px-3 w-12 text-center border-r border-[#0d3b58]">No</th>
          <th className="py-2.5 px-3">Emergency button name</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {FUSO_BUTTONS.map((btn, idx) => {
          const live = btn.stationId ? appState.stationLive[btn.stationId] : null;
          const isActivated = live?.state === "stopped";
          const isHovered = hoveredBtn?.number === btn.number;

          return (
            <tr
              key={btn.number}
              onMouseEnter={() => setHoveredBtn(btn)}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => handleButtonClick(btn)}
              className={cn(
                "cursor-pointer transition-colors group",
                idx % 2 === 0
                  ? "bg-[#dbe4ee]/60 dark:bg-slate-800/40"
                  : "bg-card dark:bg-card/70",
                isHovered && "!bg-primary/15 dark:!bg-primary/25",
              )}
            >
              <td className="py-2 px-3 text-center font-mono font-bold text-foreground/80 border-r border-border/40 group-hover:text-primary transition-colors">
                {btn.number}
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-medium truncate leading-tight group-hover:text-primary transition-colors",
                      isActivated
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : "text-foreground",
                    )}
                  >
                    {btn.name}
                  </span>
                  {/* Status Indicator */}
                  {isActivated ? (
                    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center" title="Activated / Stopped">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Normal" />
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // Render collapsible side panel matching Image 2
  const renderEmergencyButtonsPanel = () => (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs flex flex-col h-full">
      {/* Header per Image 2 */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h2 className="font-display font-bold text-sm text-foreground">
            Emergency Button Names
          </h2>
        </div>
        <button
          onClick={() => setIsPanelCollapsed(true)}
          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Tutup panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Table per Image 1 - Fill container downwards with internal vertical scroll */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {renderEmergencyButtonsTable()}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
          Station Live
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Real-time Conveyor line station telemetry, speeds, and live status.
        </p>
      </div>

      {/* Summary KPI Strip + Legenda (5 Cards Aligned in Row) */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3 items-stretch">
        {/* 1. Stations Running */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 block">
              Stations Running
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {runningCount}
              </span>
              <span className="font-mono text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                / {activeStations.length}
              </span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        {/* 2. Stations Stopped */}
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${stoppedCount > 0
              ? "border-red-500 bg-red-500/10 dark:bg-red-950/40 ring-1 ring-red-500/50"
              : "border-border bg-card"
            }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Stations Stopped
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`font-mono text-xl sm:text-2xl font-black ${stoppedCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                  }`}
              >
                {stoppedCount}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {stoppedCount > 0 ? "EMERGENCY" : "Normal"}
              </span>
            </div>
          </div>
          <div
            className={`p-1.5 rounded-lg shrink-0 ${stoppedCount > 0
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
              }`}
          >
            <AlertTriangle className={`h-4 w-4 ${stoppedCount > 0 ? "animate-bounce" : ""}`} />
          </div>
        </div>

        {/* 3. Stops Today */}
        <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Line Stops Today
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-foreground">
                {stopsToday.length}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Occurrences</span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0">
            <AlertOctagon className="h-4 w-4" />
          </div>
        </div>

        {/* 4. Longest Current Stop */}
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${longestCurrentStopMs > 0
              ? "border-red-500/60 bg-red-500/10 dark:bg-red-950/30"
              : "border-border bg-card"
            }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Longest Active Stop
            </span>
            <div className="mt-0.5">
              <span
                className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${longestCurrentStopMs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                  }`}
              >
                {longestCurrentStopMs > 0 ? fmtDuration(longestCurrentStopMs) : "—"}
              </span>
            </div>
          </div>
          <div
            className={`p-1.5 rounded-lg shrink-0 ${longestCurrentStopMs > 0
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
              }`}
          >
            <Clock className="h-4 w-4" />
          </div>
        </div>

        {/* 5. Legenda (Sejajar di sebelah kanan Longest Active Stop) */}
        <div className="col-span-2 md:col-span-2 lg:col-span-1 xl:col-span-1 rounded-xl border border-border bg-card px-3.5 py-2.5 flex flex-col justify-between shadow-2xs">
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
            Legenda
          </span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10.5px] text-muted-foreground font-medium">
            {/* 1. Emergency Button Normal (Green Circle) */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600 shrink-0" />
              <span className="truncate leading-tight">Emergency Button (Normal)</span>
            </div>

            {/* 2. Emergency Button Activated (Red Circle with pulse) */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-red-600" />
              </span>
              <span className="truncate leading-tight">Emergency Button (Activated)</span>
            </div>

            {/* 3. Pintu / Gate */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3.5 h-1.5 bg-red-600 border border-slate-700 dark:border-slate-400 shrink-0 rounded-xs" />
              <span className="truncate leading-tight">Pintu / Gate</span>
            </div>

            {/* 4. Dinding / Area */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-3.5 flex items-center justify-between shrink-0">
                <span className="w-1 h-1 rounded-full bg-slate-700 dark:bg-slate-300" />
                <span className="h-0.5 w-1.5 bg-slate-700 dark:bg-slate-300" />
                <span className="w-1 h-1 rounded-full bg-slate-700 dark:bg-slate-300" />
              </span>
              <span className="truncate leading-tight">Dinding / Area</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: Floorplan (Left) + Collapsible Emergency Buttons Panel (Right) */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch">
        {/* LEFT COLUMN: Floorplan Layout */}
        <div className="flex-1 w-full min-w-0 flex flex-col">
          <div className="rounded-2xl border border-border bg-[#eff4f8] dark:bg-[#0c1829] overflow-hidden shadow-xs relative flex-1 flex flex-col">
            {/* Top Right Action Button when Panel is Collapsed */}
            {isPanelCollapsed && (
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={() => setIsPanelCollapsed(false)}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/95 backdrop-blur-xs text-foreground font-semibold text-xs hover:bg-card shadow-xs transition-colors"
                  title="Open Emergency Button Names"
                >
                  <PanelRightOpen className="h-4 w-4 text-primary" />
                  <span>Emergency Buttons</span>
                </button>
              </div>
            )}

            {/* Main Floorplan Canvas */}
            <div className="p-3 sm:p-5 overflow-x-auto relative">
              <div className="min-w-[950px] relative">
                <svg
                  viewBox="0 0 1000 540"
                  className="w-full h-auto select-none font-sans"
                  style={{ maxHeight: "660px" }}
                >
                  <defs>
                    {/* Marker for Curved Red Arrows */}
                    <marker
                      id="red-arrow"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#dc2626" />
                    </marker>
                    {/* Marker for Cyan Arrows */}
                    <marker
                      id="cyan-arrow"
                      viewBox="0 0 10 10"
                      refX="6"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />
                    </marker>
                  </defs>

                  {/* Floorplan Background Plate */}
                  <rect
                    x="2"
                    y="2"
                    width="996"
                    height="536"
                    rx="6"
                    fill="#eaf0f6"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#0c1829] dark:stroke-[#27466f]"
                  />

                  {/* --- ROOMS & CONVEYOR ZONES --- */}

                  {/* 1. CED (Far Left Vertical Box) */}
                  <rect
                    x="12"
                    y="26"
                    width="66"
                    height="358"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text
                    x="45"
                    y="205"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#0f172a"
                    className="dark:fill-slate-100"
                  >
                    CED
                  </text>

                  {/* 2. HCF ROOM (Below CED) */}
                  <rect
                    x="18"
                    y="384"
                    width="34"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text
                    x="-421"
                    y="35"
                    transform="rotate(-90)"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#dc2626"
                  >
                    HCF ROOM
                  </text>

                  {/* Outer Chamfer Wall (Bottom Left) */}
                  <path
                    d="M 12 458 L 12 495 L 42 528 L 780 528"
                    fill="none"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:stroke-[#345887]"
                  />
                  {/* Outer Wall Red Dot Endpoint */}
                  <circle cx="36" cy="495" r="4.5" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1.5" />

                  {/* 3. Transfer Cabin CED (Contains Button 1) */}
                  <rect
                    x="78"
                    y="370"
                    width="168"
                    height="58"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="88" y="392" fontSize="11" fontWeight="bold" fill="#dc2626">
                    Transfer Cabin CED
                  </text>

                  {/* 4. PBS CAB (Top Left) */}
                  <rect
                    x="138"
                    y="8"
                    width="46"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="161" y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#dc2626">
                    PBS
                  </text>
                  <text x="161" y="44" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#dc2626">
                    CAB
                  </text>
                  {/* PBS CAB Red Gate */}
                  <rect x="184" y="44" width="5" height="24" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />

                  {/* Small Drop Box Below PBS CAB */}
                  <rect
                    x="138"
                    y="90"
                    width="32" height="48"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="-114" y="154" transform="rotate(-90)" textAnchor="middle" fontSize="7" fill="#64748b">
                    Drop cabin
                  </text>
                  {/* Red Gate in Corridor */}
                  <rect x="184" y="108" width="5" height="18" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />

                  {/* 5. Empty/Pipe Area & Baking Repair */}
                  <rect
                    x="116"
                    y="148"
                    width="32"
                    height="84"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text
                    x="-190"
                    y="132"
                    transform="rotate(-90)"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#dc2626"
                  >
                    Empty/Pipe Area
                  </text>

                  <rect
                    x="148"
                    y="148"
                    width="34"
                    height="84"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text
                    x="-190"
                    y="165"
                    transform="rotate(-90)"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#dc2626"
                  >
                    Baking Repair
                  </text>

                  {/* 6. Repair Area & Waiting Sanding */}
                  <rect
                    x="198"
                    y="152"
                    width="62"
                    height="146"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="208" y="210" fontSize="10" fontWeight="bold" fill="#dc2626">
                    Repair
                  </text>
                  <text x="208" y="224" fontSize="10" fontWeight="bold" fill="#dc2626">
                    Area
                  </text>

                  <rect
                    x="260"
                    y="152"
                    width="96"
                    height="146"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="270" y="210" fontSize="10" fontWeight="bold" fill="#dc2626">
                    Waiting
                  </text>
                  <text x="270" y="224" fontSize="10" fontWeight="bold" fill="#dc2626">
                    Sanding
                  </text>

                  {/* 7. TOP ROW: TOUCH UP | CABIN BAKE OVEN | TOPCOAT (Height: 74px, +20px) */}
                  {/* TOUCH UP (Contains Buttons 18 and 17) */}
                  <rect
                    x="198"
                    y="78"
                    width="270"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="208" y="100" fontSize="11" fontWeight="bold" fill="#dc2626">
                    TOUCH UP
                  </text>

                  {/* CABIN BAKE OVEN */}
                  <rect
                    x="468"
                    y="78"
                    width="200"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="478" y="102" fontSize="11" fontWeight="bold" fill="#dc2626">
                    CABIN BAKE OVEN
                  </text>

                  {/* TOPCOAT (Contains Buttons 15, 16, 14, 12, 13, 11) */}
                  <rect
                    x="668"
                    y="78"
                    width="248"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="678" y="102" fontSize="11" fontWeight="bold" fill="#dc2626">
                    TOPCOAT
                  </text>

                  {/* Outfeed Line Extending Right from Topcoat */}
                  <line
                    x1="916"
                    y1="78"
                    x2="955"
                    y2="78"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:stroke-[#345887]"
                  />
                  {/* Outfeed Red Gate */}
                  <rect x="930" y="75" width="22" height="5" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />
                  <circle cx="955" cy="78" r="3" fill="#1e3a5f" />

                  {/* 8. MIDDLE 3 CONVEYOR BAYS (Each Heightened +20px) */}
                  {/* Top Lane: PC-11 Cooling Booth (Height: 46px) */}
                  <rect
                    x="408"
                    y="152"
                    width="508"
                    height="46"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="418" y="179" fontSize="11" fontWeight="bold" fill="#dc2626">
                    PC-11 Cooling Booth
                  </text>

                  {/* Middle Lane: PC-10 Sealing OVEN & PC-10 Sealing (Height: 50px) */}
                  <rect
                    x="408"
                    y="198"
                    width="236"
                    height="50"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="418" y="227" fontSize="11" fontWeight="bold" fill="#dc2626">
                    PC-10 Sealing OVEN
                  </text>

                  <rect
                    x="644"
                    y="198"
                    width="272"
                    height="50"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="654" y="227" fontSize="11" fontWeight="bold" fill="#dc2626">
                    PC-10 Sealing
                  </text>

                  {/* Bottom Lane: PC-13 Sanding & PC-13 Sealing (Height: 50px) */}
                  <rect
                    x="390"
                    y="248"
                    width="254"
                    height="50"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="400" y="277" fontSize="11" fontWeight="bold" fill="#dc2626">
                    PC-13 Sanding
                  </text>

                  <rect
                    x="644"
                    y="248"
                    width="256"
                    height="50"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="654" y="277" fontSize="11" fontWeight="bold" fill="#dc2626">
                    PC-13 Sealing
                  </text>

                  {/* Transfer Cabin Touchup White Box (Contains Button 10, aligned with PC-11 Cooling Booth) */}
                  <rect
                    x="916"
                    y="152"
                    width="46"
                    height="46"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />

                  {/* 9. CURVED RED CONVEYOR FLOW ARROWS */}
                  {/* Arrow 1: Loop from PC-13 Sealing up to PC-10 Sealing */}
                  <path
                    d="M 900 273 C 938 273, 938 223, 916 223"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    markerEnd="url(#red-arrow)"
                  />

                  {/* Arrow 2: Loop from PC-10 Sealing Oven up to PC-11 Cooling Booth */}
                  <path
                    d="M 408 223 C 378 223, 378 175, 404 175"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    markerEnd="url(#red-arrow)"
                  />

                  {/* Arrow 3: Loop from Transfer Cabin Touchup up to Topcoat */}
                  <path
                    d="M 939 152 C 939 122, 930 122, 916 122"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    markerEnd="url(#red-arrow)"
                  />

                  {/* Far Right Vertical Red Gate (Next to Transfer Cabin Touchup) */}
                  <rect x="966" y="161" width="5" height="28" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />

                  {/* 10. TOPCOAT 2 & AIR SUPPLY (Bottom Middle Wide Section) */}
                  <rect
                    x="298"
                    y="298"
                    width="138"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="308" y="316" fontSize="11" fontWeight="bold" fill="#1e3a5f" className="dark:fill-slate-200">
                    TOPCOAT 2
                  </text>

                  <rect
                    x="436"
                    y="302"
                    width="90"
                    height="34"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text
                    x="481"
                    y="323"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#1e3a5f"
                    className="dark:fill-slate-200"
                  >
                    Air supply
                  </text>

                  <rect
                    x="632"
                    y="298"
                    width="324"
                    height="74"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="642" y="316" fontSize="11" fontWeight="bold" fill="#1e3a5f" className="dark:fill-slate-200">
                    TOPCOAT 2
                  </text>

                  {/* Vertical Gate Corridor Between Transfer Cabin CED and Topcoat 2 */}
                  <rect x="284" y="308" width="5" height="92" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />
                  <circle cx="286.5" cy="308" r="3" fill="#1e3a5f" />
                  <circle cx="286.5" cy="400" r="3" fill="#1e3a5f" />

                  {/* Stepped Wall Outline Between Topcoat 2 and Pre-Treatment */}
                  <path
                    d="M 306 408 L 360 408 L 360 424 L 565 424 L 565 440 L 632 440"
                    fill="none"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:stroke-[#345887]"
                  />

                  {/* 11. PRE-TREATMENT (Long Bottom Horizontal Section) */}
                  <rect
                    x="52"
                    y="434"
                    width="574"
                    height="52"
                    fill="#ffffff"
                    stroke="#1e3a5f"
                    strokeWidth="2"
                    className="dark:fill-[#122238] dark:stroke-[#345887]"
                  />
                  <text x="330" y="464" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#dc2626">
                    Pre-Treatment
                  </text>

                  {/* 3 Cyan Arrows Pointing Left (<-- <-- <--) */}
                  <line
                    x1="610"
                    y1="448"
                    x2="570"
                    y2="448"
                    stroke="#0284c7"
                    strokeWidth="2"
                    markerEnd="url(#cyan-arrow)"
                  />
                  <line
                    x1="610"
                    y1="460"
                    x2="570"
                    y2="460"
                    stroke="#0284c7"
                    strokeWidth="2"
                    markerEnd="url(#cyan-arrow)"
                  />
                  <line
                    x1="610"
                    y1="472"
                    x2="570"
                    y2="472"
                    stroke="#0284c7"
                    strokeWidth="2"
                    markerEnd="url(#cyan-arrow)"
                  />

                  {/* Pre-Treatment Vertical Red Gate at Right End */}
                  <rect x="626" y="448" width="5" height="24" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />
                  <circle cx="628.5" cy="472" r="3" fill="#1e3a5f" />

                  {/* Pre-Treatment Horizontal Red Gate on Bottom Wall */}
                  <rect x="520" y="484" width="44" height="5" fill="#dc2626" stroke="#1e3a5f" strokeWidth="1" />
                  <circle cx="520" cy="486.5" r="3" fill="#1e3a5f" />
                  <circle cx="564" cy="486.5" r="3" fill="#1e3a5f" />

                  {/* --- 12. INTERACTIVE EMERGENCY BUTTONS (1 - 18) --- */}
                  {FUSO_BUTTONS.map((btn) => {
                    const live = btn.stationId ? appState.stationLive[btn.stationId] : null;
                    const isActivated = live?.state === "stopped";
                    const isHovered = hoveredBtn?.number === btn.number;

                    return (
                      <g
                        key={btn.number}
                        onClick={() => handleButtonClick(btn)}
                        onMouseEnter={() => setHoveredBtn(btn)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        className="cursor-pointer group"
                        style={{ transition: "all 0.2s ease" }}
                      >
                        {/* Pulsing Outer Halo Ring (Shown when Activated) */}
                        {isActivated && (
                          <circle
                            cx={btn.x}
                            cy={btn.y}
                            r={18}
                            fill="rgba(239, 68, 68, 0.4)"
                            stroke="#ef4444"
                            strokeWidth="2"
                            className="animate-ping"
                            style={{ transformOrigin: `${btn.x}px ${btn.y}px` }}
                          />
                        )}

                        {/* Secondary Steady Radiant Glow when Activated */}
                        {isActivated && (
                          <circle
                            cx={btn.x}
                            cy={btn.y}
                            r={14}
                            fill="rgba(239, 68, 68, 0.35)"
                            stroke="#ef4444"
                            strokeWidth="1.5"
                          />
                        )}

                        {/* Ring highlight when Hovered from table or map */}
                        {isHovered && (
                          <circle
                            cx={btn.x}
                            cy={btn.y}
                            r={15}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            className="animate-spin"
                            style={{ transformOrigin: `${btn.x}px ${btn.y}px` }}
                          />
                        )}

                        {/* Button Body (All Circles: Green when Normal, Red when Activated) */}
                        <circle
                          cx={btn.x}
                          cy={btn.y}
                          r={11}
                          fill={isActivated ? "#ef4444" : "#22c55e"}
                          stroke={isActivated ? "#facc15" : isHovered ? "#3b82f6" : "#16a34a"}
                          strokeWidth={isHovered ? "3" : "2"}
                          className={cn(
                            "transition-transform drop-shadow-xs",
                            isHovered ? "scale-120" : "group-hover:scale-120",
                          )}
                          style={{ transformOrigin: `${btn.x}px ${btn.y}px` }}
                        />

                        {/* Button Number (White Bold Text) */}
                        <text
                          x={btn.x}
                          y={btn.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={btn.number >= 10 ? "9" : "10"}
                          fontWeight="900"
                          fill="#ffffff"
                          pointerEvents="none"
                        >
                          {btn.number}
                        </text>

                        {/* Native SVG Tooltip */}
                        <title>{`Emergency Button #${btn.number}: ${btn.name} (${btn.zone}) - Speed: ${live?.speed ?? 0
                          } m/min | Status: ${isActivated ? "STOPPED" : "NORMAL"
                          } | Klik untuk buka Details Line Stop History`}</title>
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Tooltip Card on Hover */}
                {hoveredBtn && (() => {
                  const st = appState.stations.find((s) => s.id === hoveredBtn.stationId);
                  const live = hoveredBtn.stationId ? appState.stationLive[hoveredBtn.stationId] : null;
                  const isStopped = live?.state === "stopped";
                  const leftPct = (hoveredBtn.x / 1000) * 100;
                  const topPct = (hoveredBtn.y / 540) * 100;

                  return (
                    <div
                      className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-[115%] bg-card/95 dark:bg-slate-900/95 backdrop-blur-md text-foreground border border-border rounded-xl shadow-xl p-3 text-xs min-w-[210px] animate-in fade-in zoom-in-95 duration-150"
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 mb-1.5">
                        <div className="font-bold font-display text-foreground flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: isStopped ? "#ef4444" : "#22c55e" }}
                          />
                          <span>Emergency Button #{hoveredBtn.number}</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded font-mono uppercase",
                            isStopped
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                          )}
                        >
                          {isStopped ? "STOPPED" : "NORMAL"}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground font-medium mb-2 truncate">
                        {hoveredBtn.code} — {hoveredBtn.name} ({hoveredBtn.zone})
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-muted/50 rounded-lg p-1.5 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Speed</span>
                          <span className="font-bold text-foreground">
                            {live?.speed ?? 0} {st?.speedUnit ?? "m/min"}
                          </span>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-1.5 border border-border/40">
                          <span className="text-[10px] text-muted-foreground block font-sans">Run Time</span>
                          <span className="font-bold text-foreground">
                            {live?.totalRunMs ? fmtDuration(live.totalRunMs) : "0m"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-[10px] text-primary font-medium flex items-center gap-1 justify-center pt-1.5 border-t border-border/40">
                        <span>Click to view Line Stop History</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Mobile Accordion for Emergency Button Names */}
          <div className="lg:hidden rounded-2xl border border-border bg-card overflow-hidden shadow-xs mt-4">
            <button
              type="button"
              onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-muted/20 font-display text-sm font-bold text-foreground"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Emergency Button Names</span>
                <span className="text-xs font-mono font-normal text-muted-foreground">(18 Buttons)</span>
              </div>
              {mobilePanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {mobilePanelOpen && (
              <div className="p-0 border-t border-border overflow-x-auto">
                {renderEmergencyButtonsTable()}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (Desktop): Collapsible Emergency Button Names Panel (Fill Container Downwards) */}
        {!isPanelCollapsed && (
          <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 self-stretch">
            {renderEmergencyButtonsPanel()}
          </div>
        )}
      </div>

    </div>
  );
}
