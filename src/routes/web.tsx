import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutGrid,
  Radio,
  History,
  BarChart3,
  FileSpreadsheet,
  Layers,
  Workflow,
  SlidersHorizontal,
  User,
  PanelLeft,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Square,
  Play,
  Tablet,
  ExternalLink,
  Globe,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useAppStore, store } from "../lib/store";
import { fmtTime, shiftOf } from "../lib/format";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

export const Route = createFileRoute("/web")({
  head: () => ({
    meta: [
      { title: "Conveyor System — PT. Krama Yudha Ratu Motor Indonesia" },
      { name: "description", content: "Management console for line-stop monitoring, OEE analysis, and master data." },
    ],
  }),
  component: WebLayout,
});

interface NavItem {
  label: string;
  to: string;
  exact?: boolean | undefined;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | undefined;
  badgeVariant?: "destructive" | "pill" | "default" | undefined;
  hasChevron?: boolean | undefined;
  isExternal?: boolean | undefined;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function WebLayout() {
  const { lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [masterDataExpanded, setMasterDataExpanded] = useState(true);
  const [activeSubItem, setActiveSubItem] = useState("stations");

  const currentView = useMemo(() => {
    const s = location.search as { view?: string };
    if (s?.view === "categories") return "categories";
    if (s?.view === "stations") return "stations";
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("view") === "categories") return "categories";
      if (sp.get("view") === "stations") return "stations";
    }
    return activeSubItem || "stations";
  }, [location.search, activeSubItem]);

  // Live clock WIB ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const stoppedStationsCount = Object.values(appState.stationLive).filter((s) => s.state === "stopped").length;

  const formattedDateFull = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(nowMs));
  }, [nowMs]);

  // Sidebar navigation features matching actual app features
  const coreFunctions: NavItem[] = [
    {
      label: "Monitoring Conveyor",
      to: "/web",
      exact: true,
      icon: LayoutGrid,
    },
    {
      label: "Station Live",
      to: "/web/station-live",
      icon: Radio,
      badge: stoppedStationsCount > 0 ? `${stoppedStationsCount} STOP` : undefined,
      badgeVariant: "destructive",
    },
    {
      label: "Log History",
      to: "/web/logs",
      icon: History,
      badge: `${appState.stops.length > 99 ? "99+" : appState.stops.length}`,
      badgeVariant: "pill",
    },
  ];

  const reportDocs: NavItem[] = [
    {
      label: "Production OEE",
      to: "/web/production",
      icon: BarChart3,
    },
    {
      label: "Reports",
      to: "/web/reports",
      icon: FileSpreadsheet,
    },
  ];

  const masterDataSubItems: Array<{
    name: string;
    icon: typeof Workflow;
    key: "stations" | "categories";
    view: "stations" | "categories";
  }> = [
    { name: "Stations & Area", icon: Workflow, key: "stations", view: "stations" },
    { name: "Category Problem", icon: SlidersHorizontal, key: "categories", view: "categories" },
  ];

  const isActive = (to: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === to || location.pathname === `${to}/`;
    }
    return location.pathname.startsWith(to);
  };

  const isMasterDataActive = location.pathname.startsWith("/web/master-data");

  const handleSimulateRandomStop = () => {
    const runningStations = appState.stations.filter((s) => appState.stationLive[s.id]?.state === "running");
    if (runningStations.length === 0) {
      toast.info("All stations are already stopped");
      return;
    }
    const target = runningStations[Math.floor(Math.random() * runningStations.length)]!;
    store.simulateStopTrigger(target.id, "", "plc");
    toast.error(`Stop simulated on ${target.name}`, {
      description: "Sensor stop detected. E-Form line stop is now active for operator input.",
    });
  };

  const handleResumeAll = () => {
    for (const station of appState.stations) {
      if (appState.stationLive[station.id]?.state === "stopped") {
        store.simulateResumeStation(station.id);
      }
    }
    toast.success("All stations resumed normal operation (RUNNING)");
  };

  const handleResetData = () => {
    if (confirm("Reset all demo data to initial default state?")) {
      store.resetToSeed();
      toast.success("Simulation data reset to initial state");
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased transition-colors">
      {/* Sidenav Desktop */}
      <aside
        className={`${
          sidebarCollapsed ? "hidden" : "hidden lg:flex"
        } w-[210px] flex-col border-r border-[#152a47] bg-[#0d1b2e] text-white sticky top-0 h-screen select-none transition-all duration-200 z-40 shrink-0`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center px-3.5 border-b border-[#152a47] bg-[#0d1b2e] shrink-0">
          <Link
            to="/web"
            className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity"
            title="Conveyor System"
          >
            <img
              src="/brand-orb.png"
              alt="Conveyor System"
              className="h-7 w-7 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(31,90,166,0.6)]"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold text-white tracking-tight leading-tight truncate">
                Conveyor System
              </span>
              <span className="text-[10px] text-sky-400 font-medium leading-tight truncate">
                Management System
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links Scroll Container */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3.5 scrollbar-thin scrollbar-thumb-[#152a47]">
          {/* Section 1: CORE FUNCTIONS */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 pt-1 pb-1 select-none">
              <span className="text-[9.5px] font-bold tracking-widest text-[#4d6c8f] uppercase whitespace-nowrap">
                CORE FUNCTIONS
              </span>
              <div className="h-px flex-1 bg-[#152a47]" />
            </div>

            <div className="space-y-0.5">
              {coreFunctions.map((item) => {
                const active = !item.isExternal && isActive(item.to, item.exact);
                const Icon = item.icon;

                if (item.isExternal) {
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#8ea3be] hover:bg-[#132742] hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-[#6582a6] group-hover:text-sky-300 transition-colors" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ExternalLink className="h-2.5 w-2.5 text-[#527299] opacity-60 group-hover:opacity-100" />
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#102846] text-white font-semibold"
                        : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-[#2b7fff] rounded-r" />
                    )}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-white" : "text-[#6582a6] group-hover:text-sky-300"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span
                          className={`font-mono text-[9px] px-2 py-0.5 rounded-full text-white font-bold leading-none shadow-xs ${
                            item.badgeVariant === "destructive"
                              ? "bg-rose-600 animate-pulse"
                              : "bg-[#4e8ff0]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.hasChevron && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-colors ${
                            active ? "text-sky-400" : "text-[#527299] group-hover:text-[#8ea3be]"
                          }`}
                        />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 2: REPORT & DOCUMENTATION */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 pt-1 pb-1 select-none">
              <span className="text-[9.5px] font-bold tracking-widest text-[#4d6c8f] uppercase whitespace-nowrap">
                REPORT & DOCUMENTATION
              </span>
              <div className="h-px flex-1 bg-[#152a47]" />
            </div>

            <div className="space-y-0.5">
              {reportDocs.map((item) => {
                const active = isActive(item.to, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#102846] text-white font-semibold"
                        : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-[#2b7fff] rounded-r" />
                    )}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-white" : "text-[#6582a6] group-hover:text-sky-300"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.hasChevron && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-colors ${
                          active ? "text-sky-400" : "text-[#527299] group-hover:text-[#8ea3be]"
                        }`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 3: SETUP SYSTEM */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 pt-1 pb-1 select-none">
              <span className="text-[9.5px] font-bold tracking-widest text-[#4d6c8f] uppercase whitespace-nowrap">
                SETUP SYSTEM
              </span>
              <div className="h-px flex-1 bg-[#152a47]" />
            </div>

            <div className="space-y-1">
              {/* Master Data Parent Accordion Item */}
              <div className="space-y-0.5">
                <button
                  onClick={() => setMasterDataExpanded(!masterDataExpanded)}
                  className={`group relative w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    isMasterDataActive || masterDataExpanded
                      ? "bg-[#102846] text-white shadow-xs"
                      : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                  }`}
                >
                  {(isMasterDataActive || masterDataExpanded) && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#2b7fff] rounded-r" />
                  )}
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 shrink-0 text-white" />
                    <span>Master Data</span>
                  </div>
                  {masterDataExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-[#527299] group-hover:text-[#8ea3be]" />
                  )}
                </button>

                {/* Submenu with Tree Vertical Guide Line */}
                {masterDataExpanded && (
                  <div className="ml-5 pl-2.5 my-1 space-y-0.5 border-l border-[#1d3554]">
                    {masterDataSubItems.map((sub) => {
                      const isSelected = isMasterDataActive && currentView === sub.key;
                      const SubIcon = sub.icon;

                      return (
                        <Link
                          key={sub.name}
                          to="/web/master-data"
                          search={{ view: sub.view }}
                          onClick={() => setActiveSubItem(sub.key)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                            isSelected
                              ? "bg-[#1f5aa6] text-white font-semibold shadow-xs"
                              : "text-[#8ea3be] hover:bg-white/[0.04] hover:text-white font-medium"
                          }`}
                        >
                          <SubIcon
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isSelected ? "text-white" : "text-[#6582a6]"
                            }`}
                          />
                          <span className="truncate">{sub.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Users Management hidden per user request */}
            </div>
          </div>
        </div>

        {/* Sidenav Footer */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[#122744] bg-[#0d1b2e] shrink-0 text-xs mt-auto">
          <div className="flex items-center gap-2 text-[11px] text-[#4d7ca8]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-medium">System Online</span>
          </div>
          <span className="text-[11px] font-mono text-[#385577] font-semibold">v2.4.1</span>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header matching reference screenshot */}
        <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between border-b border-slate-200 dark:border-[#152a47] bg-white dark:bg-[#0a172a] px-3 sm:px-5 backdrop-blur select-none">
          {/* Left: Sidebar Collapse Icon Button & Vertical Divider */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <PanelLeft className="h-4.5 w-4.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-[#152a47]" />
          </div>

          {/* Right: Moon (Theme), Date & Time, Divider, Bell with 99+ Badge, User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Theme Switcher Toggle (Moon/Sun) */}
            <button
              onClick={toggleTheme}
              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              )}
            </button>

            {/* Live Clock & Full Date */}
            <div className="hidden sm:flex flex-col items-end text-right select-none leading-tight">
              <span className="font-mono text-xs font-bold text-[#151c4f] dark:text-white tracking-wide">
                {fmtTime(nowMs)}
              </span>
              <span className="text-[10px] text-[#9bb3d1] dark:text-slate-400 font-medium">
                {formattedDateFull}
              </span>
            </div>

            {/* Thin vertical separator line */}
            <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-[#152a47]" />

            {/* Notification Bell with 99+ Red Badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-1 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer focus:outline-none"
                  title="System Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="h-4.5 w-4.5" />
                  <span className="absolute -top-1 -right-1 flex min-w-[17px] h-4 items-center justify-center rounded-full bg-[#fd5856] px-1 text-[9px] font-bold text-white shadow-xs leading-none">
                    99+
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <div className="flex items-center justify-between pb-2 border-b border-border px-2">
                  <span className="text-xs font-semibold text-foreground">
                    System Notifications
                  </span>
                  <span className="text-[10px] bg-red-500/10 text-red-500 font-medium px-1.5 py-0.5 rounded">
                    {stoppedStationsCount > 0 ? `${stoppedStationsCount} Line Stop` : "3 New"}
                  </span>
                </div>
                <div className="py-2 space-y-1.5 text-xs">
                  {stoppedStationsCount > 0 ? (
                    Object.entries(appState.stationLive)
                      .filter(([, s]) => s.state === "stopped")
                      .slice(0, 3)
                      .map(([id]) => (
                        <div key={id} className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
                          <span className="font-semibold">{id}</span> is experiencing an issue (STOP)
                        </div>
                      ))
                  ) : (
                    <>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-primary">System Normal</span>
                        All stations active and conveyor synchronization running smoothly.
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-emerald-600 dark:text-emerald-400">Shift 1 Running</span>
                        OEE and active line-stop monitoring recorded in database.
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-amber-600 dark:text-amber-400">Routine Inspection</span>
                        Preventive inspection scheduled at 16:30 WIB.
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-1.5 border-t border-border">
                  <Link
                    to="/web/logs"
                    className="block text-center text-[11px] text-primary hover:underline py-1"
                  >
                    View All Line Stop History &rarr;
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left focus:outline-none"
                  title="Profile & Settings"
                >
                  <img
                    src="/admin-avatar.png"
                    alt="admin"
                    className="h-7 w-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
                  />
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-xs font-bold text-[#151c4f] dark:text-white">
                      admin
                    </span>
                    <span className="text-[10px] text-[#9bb3d1] dark:text-slate-400 font-medium">
                      Super Admin
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none text-foreground">admin</p>
                    <p className="text-[11px] leading-none text-muted-foreground">superadmin@kyrm.co.id</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/ipad" target="_blank" className="flex items-center gap-2 text-xs cursor-pointer">
                    <Tablet className="h-3.5 w-3.5 text-sky-500" />
                    <span>Open Tablet E-Form (iPad)</span>
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSimulateRandomStop} className="flex items-center gap-2 text-xs text-red-500 cursor-pointer">
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Simulate Random PLC Stop</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleResumeAll} className="flex items-center gap-2 text-xs text-emerald-500 cursor-pointer">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Resume All Stations</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleResetData} className="flex items-center gap-2 text-xs text-amber-500 cursor-pointer">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Simulation Data</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const nextLang = lang === "id" ? "en" : "id";
                    setLang(nextLang);
                    toast.success(nextLang === "id" ? "Language changed to Indonesian" : "Language changed to English");
                  }}
                  className="cursor-pointer text-xs"
                >
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Language: <strong>{lang.toUpperCase()}</strong> ({lang === "id" ? "Indonesian" : "English"})</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-[#152a47] bg-[#0d1b2e] text-white px-4 py-4 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 pb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#4d6c8f] font-bold">
                  CORE FUNCTIONS
                </span>
                <div className="h-px flex-1 bg-[#152a47]" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {coreFunctions.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 pb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#4d6c8f] font-bold">
                  REPORT & DOCUMENTATION
                </span>
                <div className="h-px flex-1 bg-[#152a47]" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {reportDocs.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 pb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#4d6c8f] font-bold">
                  SETUP SYSTEM
                </span>
                <div className="h-px flex-1 bg-[#152a47]" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {masterDataSubItems.map((sub) => (
                  <Link
                    key={sub.name}
                    to="/web/master-data"
                    search={{ view: sub.view }}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                  >
                    <sub.icon className="h-4 w-4" />
                    <span className="truncate">{sub.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#152a47]">
              <Link
                to="/ipad"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center py-2 rounded-lg bg-[#091524] border border-[#152a47] text-cyan-400 text-xs font-mono font-bold hover:bg-[#0e2138]"
              >
                Open Tablet (E-form)
              </Link>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
