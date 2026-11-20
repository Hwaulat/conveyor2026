import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  Check,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import {
  FusoWorkingRule,
  getFusoWorkingRule,
  getFusoMinutesFromMatrix,
  getSavedWorkingHoursMatrix,
} from "../../lib/calc";
export { type FusoWorkingRule, getFusoWorkingRule };

export const Route = createFileRoute("/web/production")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Production Calendar & OEE" },
      { name: "description", content: "Production day calendar, overtime configuration, and OEE monitoring." },
    ],
  }),
  component: ProductionPage,
});

/* =========================================================================
   TYPES & DEFAULT CONSTANTS
   ========================================================================= */

export interface DayTypeConfig {
  id: string;
  name: string;
  extraMin: number;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isHoliday?: boolean;
}

export interface ProductionTimeConfig {
  baseDurationMin: number;
  dayTypes: DayTypeConfig[];
}

const DEFAULT_BASE_MIN = 485;

const DEFAULT_DAY_TYPES: DayTypeConfig[] = [
  {
    id: "normal",
    name: "Normal",
    extraMin: 0,
    color: "#3b82f6",
    badgeBg: "bg-blue-50 dark:bg-blue-950/50",
    badgeText: "text-blue-700 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "ot-1",
    name: "OT 1",
    extraMin: 60,
    color: "#f59e0b",
    badgeBg: "bg-amber-50 dark:bg-amber-950/50",
    badgeText: "text-amber-700 dark:text-amber-300",
    badgeBorder: "border-amber-200 dark:border-amber-800",
  },
  {
    id: "ot-2",
    name: "OT 2",
    extraMin: 120,
    color: "#f97316",
    badgeBg: "bg-orange-50 dark:bg-orange-950/50",
    badgeText: "text-orange-700 dark:text-orange-300",
    badgeBorder: "border-orange-200 dark:border-orange-800",
  },
  {
    id: "ot-3",
    name: "OT 3",
    extraMin: 180,
    color: "#f43f5e",
    badgeBg: "bg-rose-50 dark:bg-rose-950/50",
    badgeText: "text-rose-700 dark:text-rose-300",
    badgeBorder: "border-rose-200 dark:border-rose-800",
  },
  {
    id: "night-shift",
    name: "Night Shift",
    extraMin: 0,
    color: "#8b5cf6",
    badgeBg: "bg-purple-50 dark:bg-purple-950/50",
    badgeText: "text-purple-700 dark:text-purple-300",
    badgeBorder: "border-purple-200 dark:border-purple-800",
  },
  {
    id: "ot-8",
    name: "OT 8",
    extraMin: 0,
    color: "#0284c7",
    badgeBg: "bg-sky-50 dark:bg-sky-950/50",
    badgeText: "text-sky-700 dark:text-sky-300",
    badgeBorder: "border-sky-200 dark:border-sky-800",
  },
  {
    id: "ot-9",
    name: "OT 9",
    extraMin: 60,
    color: "#06b6d4",
    badgeBg: "bg-cyan-50 dark:bg-cyan-950/50",
    badgeText: "text-cyan-700 dark:text-cyan-300",
    badgeBorder: "border-cyan-200 dark:border-cyan-800",
  },
  {
    id: "ot-10",
    name: "OT 10",
    extraMin: 120,
    color: "#0d9488",
    badgeBg: "bg-teal-50 dark:bg-teal-950/50",
    badgeText: "text-teal-700 dark:text-teal-300",
    badgeBorder: "border-teal-200 dark:border-teal-800",
  },
  {
    id: "ot-11",
    name: "OT 11",
    extraMin: 180,
    color: "#10b981",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
  },
];

function ensureDefaultDayTypes(types?: DayTypeConfig[]): DayTypeConfig[] {
  if (!Array.isArray(types) || types.length === 0) return DEFAULT_DAY_TYPES;
  const existingIds = new Set(types.map((d) => d.id));
  const missing = DEFAULT_DAY_TYPES.filter((d) => !existingIds.has(d.id));
  if (missing.length === 0) return types;
  return [...types, ...missing];
}

// Holiday type kept for calendar logic (weekends) but not shown in config panel
const HOLIDAY_TYPE: DayTypeConfig = {
  id: "holiday",
  name: "Holiday",
  extraMin: 0,
  color: "#64748b",
  badgeBg: "bg-slate-100 dark:bg-slate-800/70",
  badgeText: "text-slate-600 dark:text-slate-400",
  badgeBorder: "border-slate-200 dark:border-slate-700",
  isHoliday: true,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMinutesToHours(minutes: number): string {
  if (minutes <= 0) return "0 m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

function ProductionPage() {
  // ================= Calendar & Month Navigation =================
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(10); // 0-indexed: 10 = November
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-18");

  // ================= Configuration State (Saved vs Draft) =================
  const [savedConfigs, setSavedConfigs] = useState<Record<string, ProductionTimeConfig>>(() => {
    try {
      const stored = localStorage.getItem("krm_production_configs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.all?.dayTypes) {
          parsed.all.dayTypes = ensureDefaultDayTypes(parsed.all.dayTypes);
          return parsed;
        }
      }
    } catch {}
    return {
      all: { baseDurationMin: DEFAULT_BASE_MIN, dayTypes: DEFAULT_DAY_TYPES },
    };
  });

  const [draftConfigs, setDraftConfigs] = useState<Record<string, ProductionTimeConfig>>(() => {
    try {
      const stored = localStorage.getItem("krm_production_configs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.all?.dayTypes) {
          parsed.all.dayTypes = ensureDefaultDayTypes(parsed.all.dayTypes);
          return parsed;
        }
      }
    } catch {}
    return {
      all: { baseDurationMin: DEFAULT_BASE_MIN, dayTypes: DEFAULT_DAY_TYPES },
    };
  });

  // Date day-type assignments: "YYYY-MM-DD" -> dayTypeId
  const [dateAssignments, setDateAssignments] = useState<Record<string, string>>(() => {
    const defaultAssignments: Record<string, string> = {
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
          return { ...defaultAssignments, ...parsed };
        }
      }
    } catch {}
    return defaultAssignments;
  });

  const [matrixVersion, setMatrixVersion] = useState(0);

  useEffect(() => {
    const onMatrixUpdate = () => {
      setMatrixVersion((v) => v + 1);
    };
    window.addEventListener("krm_working_hours_matrix_updated", onMatrixUpdate);
    return () => window.removeEventListener("krm_working_hours_matrix_updated", onMatrixUpdate);
  }, []);

  // Panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Mobile drawer state
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(true);

  // ================= Config Helpers =================
  const currentDraftConfig = useMemo<ProductionTimeConfig>(() => {
    const cfg = draftConfigs["all"] || { baseDurationMin: DEFAULT_BASE_MIN, dayTypes: DEFAULT_DAY_TYPES };
    return {
      ...cfg,
      dayTypes: ensureDefaultDayTypes(cfg.dayTypes),
    };
  }, [draftConfigs]);

  const currentSavedConfig = useMemo<ProductionTimeConfig>(() => {
    const cfg = savedConfigs["all"] || { baseDurationMin: DEFAULT_BASE_MIN, dayTypes: DEFAULT_DAY_TYPES };
    return {
      ...cfg,
      dayTypes: ensureDefaultDayTypes(cfg.dayTypes),
    };
  }, [savedConfigs]);

  // Has unsaved changes (yellow dot indicator)
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(draftConfigs) !== JSON.stringify(savedConfigs);
  }, [draftConfigs, savedConfigs]);

  // Update draft config helper
  const updateDraftConfig = (updater: (prev: ProductionTimeConfig) => ProductionTimeConfig) => {
    setDraftConfigs((prev) => {
      const current =
        prev["all"] || { baseDurationMin: DEFAULT_BASE_MIN, dayTypes: DEFAULT_DAY_TYPES };
      return { ...prev, all: updater(current) };
    });
  };

  // Save (Update) action
  const handleSaveSettings = () => {
    setSavedConfigs(draftConfigs);
    try {
      localStorage.setItem("krm_production_configs", JSON.stringify(draftConfigs));
    } catch {}
    toast.success("Production time settings updated successfully", {
      description: `${currentDraftConfig.dayTypes.length} day types saved.`,
    });
  };

  // Assign day type to date
  const handleAssignDayType = (dateStr: string, dayTypeId: string) => {
    setDateAssignments((prev) => {
      const next = { ...prev, [dateStr]: dayTypeId };
      try {
        localStorage.setItem("krm_production_calendar_assignments", JSON.stringify(next));
      } catch {}
      return next;
    });
    const dt =
      currentDraftConfig.dayTypes.find((d) => d.id === dayTypeId) ||
      (dayTypeId === "holiday" ? HOLIDAY_TYPE : null);
    toast.success(`Date ${dateStr} changed to "${dt?.name ?? dayTypeId}"`);
  };

  // ================= Calendar Logic =================
  // All available day types for the date selector (config types + holiday)
  const allDayTypesForPicker = useMemo(() => {
    return [...currentDraftConfig.dayTypes, HOLIDAY_TYPE];
  }, [currentDraftConfig]);

  const getDayTypeIdForDate = (dateStr: string): string => {
    if (dateAssignments[dateStr]) return dateAssignments[dateStr]!;
    const d = new Date(`${dateStr}T00:00:00+07:00`);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return "holiday";
    return "normal";
  };

  const resolveDayType = (typeId: string): DayTypeConfig => {
    return (
      currentDraftConfig.dayTypes.find((d) => d.id === typeId) ||
      (typeId === "holiday" ? HOLIDAY_TYPE : null) ||
      DEFAULT_DAY_TYPES[0]!
    );
  };

  const calculatePlannedMinForDate = (
    dateStr: string,
    cfg: ProductionTimeConfig,
  ): {
    minutes: number;
    dayType: DayTypeConfig;
    rule: FusoWorkingRule;
    baseMin: number;
    extraMin: number;
    otLabel?: string | undefined;
  } => {
    const typeId = getDayTypeIdForDate(dateStr);
    const dayType =
      cfg.dayTypes.find((d) => d.id === typeId) ||
      (typeId === "holiday" ? HOLIDAY_TYPE : null) ||
      DEFAULT_DAY_TYPES[0]!;

    if (dayType.isHoliday || dayType.id === "holiday") {
      return {
        minutes: 0,
        dayType,
        rule: {
          ruleName: "Holiday / Off",
          ruleCode: "senin_kamis",
          shift: "pagi",
          baseMin: 0,
        },
        baseMin: 0,
        extraMin: 0,
        otLabel: undefined,
      };
    }

    const isNightShift = dayType.id === "night-shift";
    const shift: "pagi" | "malam" = isNightShift ? "malam" : "pagi";
    let rule = getFusoWorkingRule(dateStr, shift, dateAssignments);
    
    let otTier: "normal" | "ot-1" | "ot-2" | "ot-3" | "night-shift" | "ot-8" | "ot-9" | "ot-10" | "ot-11" = "normal";
    if (dayType.id === "ot-1") otTier = "ot-1";
    else if (dayType.id === "ot-2") otTier = "ot-2";
    else if (dayType.id === "ot-3") otTier = "ot-3";
    else if (dayType.id === "night-shift") otTier = "night-shift";
    else if (dayType.id === "ot-8") otTier = "ot-8";
    else if (dayType.id === "ot-9") otTier = "ot-9";
    else if (dayType.id === "ot-10") otTier = "ot-10";
    else if (dayType.id === "ot-11") otTier = "ot-11";

    if (dayType.id === "ot-8" || dayType.id === "ot-9" || dayType.id === "ot-10" || dayType.id === "ot-11") {
      rule = {
        ruleName: "Sabtu (OT 8-11)",
        ruleCode: "sabtu",
        shift,
        baseMin: 480,
      };
    }

    const minutes = getFusoMinutesFromMatrix(
      rule.ruleCode,
      shift,
      otTier,
      rule.isFridayDeductionApplied,
    );
    const extraMin = Math.max(0, minutes - rule.baseMin);

    const d = new Date(`${dateStr}T00:00:00+07:00`);
    let otLabel: string | undefined = undefined;
    if (dayType.id === "ot-8") otLabel = "OT 8";
    else if (dayType.id === "ot-9") otLabel = "OT 9";
    else if (dayType.id === "ot-10") otLabel = "OT 10";
    else if (dayType.id === "ot-11") otLabel = "OT 11";
    else if (d.getDay() === 6) {
      if (dayType.id === "normal") otLabel = "OT 8";
      else if (dayType.id === "ot-1") otLabel = "OT 9";
      else if (dayType.id === "ot-2") otLabel = "OT 10";
      else if (dayType.id === "ot-3") otLabel = "OT 11";
    }

    return { minutes, dayType, rule, baseMin: rule.baseMin, extraMin, otLabel };
  };

  // Calendar Grid
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      draftMinutes: number;
      savedMinutes: number;
      dayType: DayTypeConfig;
      rule: FusoWorkingRule;
      baseMin: number;
      extraMin: number;
      otLabel?: string | undefined;
      isDraftPreview: boolean;
    }[] = [];

    const makeDateStr = (y: number, m: number, d: number) =>
      `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // Previous month padding
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dateStr = makeDateStr(prevYear, prevMonth, dayNum);
      const draftCalc = calculatePlannedMinForDate(dateStr, currentDraftConfig);
      const savedCalc = calculatePlannedMinForDate(dateStr, currentSavedConfig);
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        draftMinutes: draftCalc.minutes,
        savedMinutes: savedCalc.minutes,
        dayType: draftCalc.dayType,
        rule: draftCalc.rule,
        baseMin: draftCalc.baseMin,
        extraMin: draftCalc.extraMin,
        otLabel: draftCalc.otLabel,
        isDraftPreview: draftCalc.minutes !== savedCalc.minutes,
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = makeDateStr(calendarYear, calendarMonth, day);
      const draftCalc = calculatePlannedMinForDate(dateStr, currentDraftConfig);
      const savedCalc = calculatePlannedMinForDate(dateStr, currentSavedConfig);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        draftMinutes: draftCalc.minutes,
        savedMinutes: savedCalc.minutes,
        dayType: draftCalc.dayType,
        rule: draftCalc.rule,
        baseMin: draftCalc.baseMin,
        extraMin: draftCalc.extraMin,
        otLabel: draftCalc.otLabel,
        isDraftPreview: draftCalc.minutes !== savedCalc.minutes,
      });
    }

    // Next month padding
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const dateStr = makeDateStr(nextYear, nextMonth, day);
      const draftCalc = calculatePlannedMinForDate(dateStr, currentDraftConfig);
      const savedCalc = calculatePlannedMinForDate(dateStr, currentSavedConfig);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        draftMinutes: draftCalc.minutes,
        savedMinutes: savedCalc.minutes,
        dayType: draftCalc.dayType,
        rule: draftCalc.rule,
        baseMin: draftCalc.baseMin,
        extraMin: draftCalc.extraMin,
        otLabel: draftCalc.otLabel,
        isDraftPreview: draftCalc.minutes !== savedCalc.minutes,
      });
    }

    return cells;
  }, [calendarYear, calendarMonth, currentDraftConfig, currentSavedConfig, dateAssignments, matrixVersion]);

  const selectedDateDayType = useMemo(() => {
    return resolveDayType(getDayTypeIdForDate(selectedDate));
  }, [selectedDate, currentDraftConfig, dateAssignments]);

  const selectedDateCalc = useMemo(() => {
    return calculatePlannedMinForDate(selectedDate, currentDraftConfig);
  }, [selectedDate, currentDraftConfig, dateAssignments, matrixVersion]);

  // Monthly Summary & Overtime calculations
  const currentMonthCells = useMemo(() => {
    return calendarGrid.filter((c) => c.isCurrentMonth);
  }, [calendarGrid]);

  const workingDaysCount = useMemo(() => {
    return currentMonthCells.filter((c) => !c.dayType.isHoliday && c.dayType.id !== "holiday").length;
  }, [currentMonthCells]);

  const holidayDaysCount = useMemo(() => {
    return currentMonthCells.filter((c) => c.dayType.isHoliday || c.dayType.id === "holiday").length;
  }, [currentMonthCells]);

  const totalPlannedMinutes = useMemo(() => {
    return currentMonthCells.reduce((acc, c) => acc + c.draftMinutes, 0);
  }, [currentMonthCells]);

  const totalPlannedHours = useMemo(() => {
    return Math.round(totalPlannedMinutes / 60);
  }, [totalPlannedMinutes]);

  const overtimeList = useMemo(() => {
    const counts: Record<
      string,
      { id: string; name: string; count: number; badgeBg: string; badgeText: string; badgeBorder: string }
    > = {};
    for (const cell of currentMonthCells) {
      if (cell.dayType.id !== "normal" && cell.dayType.id !== "holiday" && !cell.dayType.isHoliday) {
        if (!counts[cell.dayType.id]) {
          counts[cell.dayType.id] = {
            id: cell.dayType.id,
            name: cell.dayType.name,
            count: 0,
            badgeBg: cell.dayType.badgeBg,
            badgeText: cell.dayType.badgeText,
            badgeBorder: cell.dayType.badgeBorder,
          };
        }
        counts[cell.dayType.id]!.count += 1;
      }
    }
    const ordered: { id: string; name: string; count: number; badgeBg: string; badgeText: string; badgeBorder: string }[] = [];
    for (const dt of currentDraftConfig.dayTypes) {
      if (counts[dt.id] && counts[dt.id]!.count > 0) {
        ordered.push(counts[dt.id]!);
      }
    }
    return ordered;
  }, [currentMonthCells, currentDraftConfig.dayTypes]);

  // Month navigation
  const handlePrevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1); }
    else { setCalendarMonth((m) => m - 1); }
  };
  const handleNextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1); }
    else { setCalendarMonth((m) => m + 1); }
  };
  const handleToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedDate(now.toISOString().slice(0, 10));
  };

  /* =========================================================================
     RENDER: RIGHT PANEL (CONFIG & DATE DETAILS)
     ========================================================================= */

  const renderConfigurationPanel = () => (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display text-sm font-bold text-foreground truncate flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
              <span>Production Time Settings</span>
            </h2>
          </div>
          <button
            onClick={() => setIsPanelCollapsed(true)}
            className="hidden lg:flex p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Collapse settings panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Date Details Content (Direct, no tabs) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Date Header */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
          <span className="text-[10.5px] uppercase tracking-wider font-bold text-primary block">
            Selected Date
          </span>
          <h3 className="text-base font-bold text-foreground font-display">
            {new Date(`${selectedDate}T00:00:00+07:00`).toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>

          {/* FUSO Rule & Duration Breakdown */}
          {!selectedDateCalc.dayType.isHoliday && selectedDateCalc.dayType.id !== "holiday" ? (
            <div className="pt-2 border-t border-primary/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Applied FUSO Rule:</span>
                <span className="font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                  {selectedDateCalc.rule.ruleName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Shift & Planned Time:</span>
                <span className="font-mono font-bold text-foreground">
                  {selectedDateCalc.minutes} min ({formatMinutesToHours(selectedDateCalc.minutes)})
                </span>
              </div>
              <div className="text-[10.5px] font-mono text-muted-foreground bg-background/60 p-2 rounded-lg border border-border/50">
                {selectedDateCalc.dayType.id === "night-shift"
                  ? `Perhitungan: ${selectedDateCalc.extraMin}m (OT) + ${selectedDateCalc.baseMin}m (Malam Base) = ${selectedDateCalc.minutes}m`
                  : selectedDateCalc.extraMin > 0
                  ? `Perhitungan: ${selectedDateCalc.baseMin}m (Base) + ${selectedDateCalc.extraMin}m (OT) = ${selectedDateCalc.minutes}m`
                  : `Perhitungan: ${selectedDateCalc.baseMin}m (Base) = ${selectedDateCalc.minutes}m`}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-primary/10 text-xs text-muted-foreground">
              Status: <span className="font-semibold text-foreground">Hari Libur / Off (0 menit)</span>
            </div>
          )}
        </div>

        {/* Quick Day Type Selector */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-2xs">
          <label className="text-xs font-bold text-foreground block">
            Change Day Type for This Date:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {allDayTypesForPicker.map((dt) => {
              const isSelected = selectedDateDayType.id === dt.id;
              return (
                <button
                  key={dt.id}
                  type="button"
                  onClick={() => handleAssignDayType(selectedDate, dt.id)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
                    isSelected
                      ? "ring-2 ring-primary border-primary bg-primary/10 font-bold"
                      : "border-border hover:bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dt.color }}
                  />
                  <span className="text-xs text-foreground font-medium flex-1 truncate">
                    {dt.name}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  /* =========================================================================
     MAIN RETURN — Clean Single Page Layout
     ========================================================================= */

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2.5">
            <span>Production & OEE</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              v2.6
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Production day calendar, overtime configuration, and machine effectiveness (OEE) monitoring.
          </p>
        </div>
      </div>

      {/* 4 Summary Cards (Working Days, Holidays/Off, Overtime Schedule, Total Planned Time) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Working Days */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground block mb-1">
            Working Days
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold font-display text-foreground">
              {workingDaysCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">Days</span>
          </div>
        </div>

        {/* Holidays / Off */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground block mb-1">
            Holidays / Off
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold font-display text-foreground">
              {holidayDaysCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">Days</span>
          </div>
        </div>

        {/* Overtime Schedule */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Overtime Schedule
          </span>
          <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
            {overtimeList.map((item) => (
              <span
                key={item.id}
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-2xs",
                  item.badgeBg,
                  item.badgeText,
                  item.badgeBorder,
                )}
              >
                {item.name}: {item.count}d
              </span>
            ))}
            {overtimeList.length === 0 && (
              <span className="text-xs text-muted-foreground italic font-mono">None scheduled</span>
            )}
          </div>
        </div>

        {/* Total Planned Time */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-muted-foreground block mb-1">
            Total Planned Time
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold font-display text-foreground">
              {totalPlannedHours} Hrs
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 font-mono">
              ({totalPlannedMinutes.toLocaleString("en-US")} m)
            </span>
          </div>
        </div>
      </div>

      {/* CALENDAR SECTION (Two-Column Layout) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="flex-1 w-full space-y-4 min-w-0">
          {/* Top Bar: Month Navigation & Controls */}
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-xs flex items-center justify-between gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 font-display text-base font-bold text-foreground min-w-[190px] justify-center">
                <span>{MONTH_NAMES[calendarMonth]}</span>
                <span>{calendarYear}</span>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={handleToday}
                className="ml-1 px-3 py-1.5 rounded-lg border border-border text-xs font-mono font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Today
              </button>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setMobileSettingsOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors relative"
                title="Open Production Time Settings"
              >
                <Settings className="h-4 w-4" />
                {hasUnsavedChanges && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
              {isPanelCollapsed && (
                <button
                  onClick={() => setIsPanelCollapsed(false)}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20 transition-colors shadow-2xs"
                  title="Open settings panel"
                >
                  <PanelRightOpen className="h-4 w-4" />
                  <span>Settings Panel</span>
                  {hasUnsavedChanges && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center font-display text-xs font-semibold text-muted-foreground py-2.5">
              {DAY_NAMES.map((dayName, idx) => (
                <div key={dayName} className={idx >= 5 ? "text-rose-500/80" : ""}>
                  <span className="hidden sm:inline">{dayName}</span>
                  <span className="sm:hidden">{DAY_SHORT[idx]}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-border/60 bg-background/50">
              {calendarGrid.map((cell) => {
                const isSelected = cell.dateStr === selectedDate;
                const isHoliday = cell.dayType.isHoliday || cell.dayType.id === "holiday";
                const displayDayTypeName = cell.otLabel
                  ? `${cell.dayType.name} (${cell.otLabel})`
                  : cell.dayType.name;
                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      if (isPanelCollapsed) setIsPanelCollapsed(false);
                    }}
                    title={`${cell.dateStr} — ${cell.dayType.name}: ${isHoliday ? "Holiday" : `${cell.draftMinutes} m`} (${cell.rule.ruleName})`}
                    className={cn(
                      "min-h-[96px] sm:min-h-[112px] p-2 flex flex-col justify-between cursor-pointer transition-all relative group select-none",
                      !cell.isCurrentMonth && "opacity-35 bg-muted/10",
                      cell.isCurrentMonth && isHoliday && "bg-slate-50/50 dark:bg-slate-900/20",
                      cell.isCurrentMonth && !isHoliday && "bg-card hover:bg-muted/30",
                      isSelected && "ring-2 ring-primary ring-inset bg-primary/5 dark:bg-primary/10 z-10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "font-mono text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full transition-colors",
                          cell.isToday
                            ? "bg-primary text-primary-foreground font-black shadow-xs"
                            : isSelected
                              ? "bg-foreground text-background"
                              : "text-foreground group-hover:text-primary",
                        )}
                      >
                        {cell.dayNumber}
                      </span>
                      {cell.rule.ruleCode === "tanggal_17" && cell.isCurrentMonth && !isHoliday && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold" title="Tanggal 17 Upacara">
                          Tgl 17
                        </span>
                      )}
                      {cell.rule.ruleCode === "hari_pertama" && cell.isCurrentMonth && !isHoliday && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold" title={cell.rule.ruleName}>
                          Jum 1
                        </span>
                      )}
                    </div>
                    <div className="my-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border max-w-full truncate",
                          cell.dayType.badgeBg,
                          cell.dayType.badgeText,
                          cell.dayType.badgeBorder,
                        )}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cell.dayType.color }}
                        />
                        <span className="truncate">{displayDayTypeName}</span>
                      </span>
                    </div>
                    <div className="pt-0.5 flex items-baseline justify-between gap-1">
                      <div
                        className={cn(
                          "font-mono text-[11px] font-medium leading-tight",
                          cell.isDraftPreview
                            ? "border-b-2 border-dashed border-amber-500 font-bold text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {isHoliday ? <span>Holiday</span> : <span>{cell.draftMinutes} m</span>}
                      </div>
                      {cell.isDraftPreview && (
                        <span className="text-[8.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                          preview
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Inline Accordion for Settings */}
          <div className="lg:hidden rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <button type="button" onClick={() => setAccordionOpen(!accordionOpen)}
              className="w-full flex items-center justify-between p-4 bg-muted/20 font-display text-sm font-bold text-foreground">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>Production Time Settings</span>
                {hasUnsavedChanges && <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
              </div>
              {accordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {accordionOpen && <div className="p-3 border-t border-border">{renderConfigurationPanel()}</div>}
          </div>
        </div>

        {/* RIGHT COLUMN (Desktop) */}
        {!isPanelCollapsed && (
          <div className="hidden lg:block w-80 xl:w-96 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)]">
            {renderConfigurationPanel()}
          </div>
        )}
      </div>

      {/* =========================================================================
         MODALS
         ========================================================================= */}

      {/* Mobile Settings Sheet */}
      {mobileSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/20">
              <span className="font-display font-bold text-sm text-foreground">Production Time Settings</span>
              <button onClick={() => setMobileSettingsOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderConfigurationPanel()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
