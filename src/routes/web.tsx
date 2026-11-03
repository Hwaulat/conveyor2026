import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  History,
  BarChart3,
  FileSpreadsheet,
  Database,
  Tv,
  Tablet,
  Play,
  Square,
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  Clock,
  ExternalLink,
  PanelLeft,
  Bell,
  ChevronDown,
  ChevronUp,
  Radio,
  Layers,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useAppStore, store } from "../lib/store";
import { fmtTime, fmtDateHuman, shiftOf } from "../lib/format";
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
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Line Monitoring & OEE" },
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
  badgeVariant?: "destructive" | "default" | "pill" | undefined;
  hasChevron?: boolean | undefined;
  isMasterData?: boolean | undefined;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function WebLayout() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [masterDataExpanded, setMasterDataExpanded] = useState(true);

  // Live clock WIB ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentShift = shiftOf(nowMs, appState.shifts);
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

  const navGroups: NavGroup[] = [
    {
      label: "CORE FUNCTIONS",
      items: [
        {
          label: t("nav.dashboard"),
          to: "/web",
          exact: true,
          icon: LayoutDashboard,
          hasChevron: true,
        },
        {
          label: t("nav.stationLive"),
          to: "/web/station-live",
          icon: Radio,
          badge: stoppedStationsCount > 0 ? `${stoppedStationsCount} STOP` : undefined,
          badgeVariant: "destructive",
        },
        {
          label: t("nav.logs"),
          to: "/web/logs",
          icon: History,
          badge: `${appState.stops.length > 99 ? "99+" : appState.stops.length}`,
          badgeVariant: "pill",
        },
      ],
    },
    {
      label: "REPORT & DOCUMENTATION",
      items: [
        {
          label: t("nav.production"),
          to: "/web/production",
          icon: BarChart3,
          hasChevron: true,
        },
        {
          label: t("nav.reports"),
          to: "/web/reports",
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      label: "SETUP SYSTEM",
      items: [
        {
          label: t("nav.masterData"),
          to: "/web/master-data",
          icon: Layers,
          isMasterData: true,
        },
      ],
    },
  ];

  const isActive = (to: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === to || location.pathname === `${to}/`;
    }
    return location.pathname.startsWith(to);
  };

  const handleSimulateRandomStop = () => {
    const runningStations = appState.stations.filter((s) => appState.stationLive[s.id]?.state === "running");
    if (runningStations.length === 0) {
      toast.info("Semua stasiun sudah dalam keadaan berhenti");
      return;
    }
    const target = runningStations[Math.floor(Math.random() * runningStations.length)]!;
    store.simulateStopTrigger(target.id, "cat-2", "form");
    toast.error(`Stop disimulasikan pada ${target.name}`, {
      description: "Sensor jam terdeteksi. Papan Andon & iPad otomatis diperbarui.",
    });
  };

  const handleResumeAll = () => {
    for (const station of appState.stations) {
      if (appState.stationLive[station.id]?.state === "stopped") {
        store.simulateResumeStation(station.id);
      }
    }
    toast.success("Semua stasiun kembali beroperasi normal (RUNNING)");
  };

  const handleResetData = () => {
    if (confirm("Reset ulang seluruh data demo ke kondisi bawaan awal?")) {
      store.resetToSeed();
      toast.success("Data simulasi di-reset ke kondisi awal");
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased transition-colors">
      {/* Sidebar Desktop */}
      <aside
        className={`${
          sidebarCollapsed ? "hidden" : "hidden lg:flex"
        } w-60 flex-col border-r border-[#152a47] bg-[#0d1b2e] text-white sticky top-0 h-screen select-none transition-all duration-200 z-40`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center px-4 gap-3 border-b border-[#152a47] bg-[#0d1b2e] shrink-0">
          <img
            src="/brand-orb.png"
            alt="JSGI"
            className="h-8 w-8 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(31,90,166,0.6)]"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-white tracking-tight leading-tight truncate">
              JSGI - Maintenance
            </span>
            <span className="text-[10px] text-sky-400 font-medium leading-tight truncate">
              Management System
            </span>
          </div>
        </div>

        {/* Navigation Links Scroll Container */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {/* Section Header with Horizontal Rule */}
              <div className="flex items-center gap-2 px-2 pt-2 pb-1 select-none">
                <span className="text-[10px] font-bold tracking-widest text-[#4d6c8f] uppercase whitespace-nowrap">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-[#152a47]" />
              </div>

              {/* Section Nav Items */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  const Icon = item.icon;

                  // If item is Master Data (expandable parent with tree submenu)
                  if (item.isMasterData) {
                    return (
                      <div key={item.label} className="space-y-1">
                        <button
                          onClick={() => setMasterDataExpanded(!masterDataExpanded)}
                          className={`group relative w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? "bg-[#102846] text-white font-semibold shadow-xs"
                              : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                          }`}
                        >
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#2b7fff] rounded-r" />
                          )}
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                active ? "text-white" : "text-[#6582a6] group-hover:text-sky-300"
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {masterDataExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-sky-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-[#527299] group-hover:text-[#8ea3be] transition-colors" />
                          )}
                        </button>

                        {/* Tree Guide Line & Child Submenu Items */}
                        {masterDataExpanded && (
                          <div className="ml-5 pl-2.5 my-1 space-y-1 border-l border-[#1d3554]">
                            <Link
                              to="/web/master-data"
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? "bg-[#1f5aa6] text-white shadow-xs font-medium"
                                  : "text-[#8ea3be] hover:bg-white/[0.04] hover:text-white"
                              }`}
                            >
                              <Settings className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-[#6582a6]"}`} />
                              <span>Stasiun & Area</span>
                            </Link>
                            <Link
                              to="/web/master-data"
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#8ea3be] hover:bg-white/[0.04] hover:text-white transition-colors"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[#6582a6]" />
                              <span>Line Conveyor</span>
                            </Link>
                            <Link
                              to="/web/master-data"
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#8ea3be] hover:bg-white/[0.04] hover:text-white transition-colors"
                            >
                              <Radio className="h-3.5 w-3.5 shrink-0 text-[#6582a6]" />
                              <span>Maintenance Setup</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Normal Nav Item
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "bg-[#102846] text-white font-semibold shadow-xs"
                          : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#2b7fff] rounded-r" />
                      )}
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active ? "text-white" : "text-[#6582a6] group-hover:text-sky-300"
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${
                              item.badgeVariant === "destructive"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30 font-bold"
                                : "bg-[#1f66b0] text-white font-bold shadow-xs"
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
          ))}

          {/* Quick Dedicated External Routes Launchers */}
          <div className="pt-2 border-t border-[#152a47] space-y-2">
            <div className="flex items-center gap-2 px-2 pt-1 pb-1 select-none">
              <span className="text-[10px] font-bold tracking-widest text-[#4d6c8f] uppercase whitespace-nowrap">
                DEDICATED DISPLAYS
              </span>
              <div className="h-px flex-1 bg-[#152a47]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/andon"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-lg border border-[#152a47] bg-[#091524] p-2 text-center transition-all hover:border-blue-500/40 hover:bg-[#0e2138] shadow-xs"
              >
                <Tv className="h-4 w-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium text-slate-200 flex items-center gap-1">
                  Andon TV <ExternalLink className="h-2.5 w-2.5 text-[#527299]" />
                </span>
                <span className="text-[9px] font-mono text-[#4d6c8f]">Fullscreen</span>
              </Link>

              <Link
                to="/ipad"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-lg border border-[#152a47] bg-[#091524] p-2 text-center transition-all hover:border-blue-500/40 hover:bg-[#0e2138] shadow-xs"
              >
                <Tablet className="h-4 w-4 text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium text-slate-200 flex items-center gap-1">
                  E-form <ExternalLink className="h-2.5 w-2.5 text-[#527299]" />
                </span>
                <span className="text-[9px] font-mono text-[#4d6c8f]">Tablet Mode</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="border-t border-[#122744] p-3 bg-[#091524] space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-[#4d7ca8]">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Simulasi PLC Live
            </span>
            <button
              onClick={handleResetData}
              title="Reset data demo ke awal"
              className="text-[#6582a6] hover:text-white p-1 rounded hover:bg-[#132742] transition-colors"
            >
              <RotateCcwIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleSimulateRandomStop}
              className="flex items-center justify-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 font-mono text-[10px] text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              Sim Stop
            </button>
            <button
              onClick={handleResumeAll}
              className="flex items-center justify-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 font-mono text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              Resume All
            </button>
          </div>
        </div>

        {/* Sidenav Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#122744] bg-[#0a172a] shrink-0 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[#4d7ca8]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-medium">System Online</span>
          </div>
          <span className="text-[11px] font-mono text-[#385577] font-semibold">v2.4.1</span>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur">
          {/* Left: Sidebar Collapse Icon Button & Vertical Divider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title={sidebarCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
              aria-label="Toggle Sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <div className="h-5 w-px bg-border" />
          </div>

          {/* Right: Moon (Theme), Date & Time, Divider, Bell with Badge, User Profile */}
          <div className="flex items-center gap-3 sm:gap-3.5">
            {/* Theme Switcher Toggle (Moon/Sun) */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title={theme === "dark" ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Live Clock & Full Date */}
            <div className="hidden sm:flex flex-col items-end text-right select-none leading-none gap-1">
              <span className="font-mono text-sm font-bold text-foreground tracking-wide">
                {fmtTime(nowMs)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formattedDateFull}
              </span>
            </div>

            {/* Thin vertical separator line */}
            <div className="hidden sm:block h-6 w-px bg-border" />

            {/* Notification Bell with Red Badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer focus:outline-none"
                  title="Notifikasi Sistem"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-xs">
                    {stoppedStationsCount > 0 ? stoppedStationsCount : 3}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <div className="flex items-center justify-between pb-2 border-b border-border px-2">
                  <span className="text-xs font-semibold text-foreground">
                    Notifikasi Sistem
                  </span>
                  <span className="text-[10px] bg-red-500/10 text-red-500 font-medium px-1.5 py-0.5 rounded">
                    {stoppedStationsCount > 0 ? `${stoppedStationsCount} Line Stop` : "3 Baru"}
                  </span>
                </div>
                <div className="py-2 space-y-1.5 text-xs">
                  {stoppedStationsCount > 0 ? (
                    Object.entries(appState.stationLive)
                      .filter(([, s]) => s.state === "stopped")
                      .slice(0, 3)
                      .map(([id, s]) => (
                        <div key={id} className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
                          <span className="font-semibold">{id}</span> sedang mengalami kendala (STOP)
                        </div>
                      ))
                  ) : (
                    <>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-primary">Sistem Normal</span>
                        Seluruh stasiun aktif dan sinkronisasi conveyor berjalan lancar.
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-emerald-600 dark:text-emerald-400">Shift 1 Berjalan</span>
                        Monitoring OEE dan line-stop aktif tercatat di database.
                      </div>
                      <div className="p-2 rounded bg-muted/60 text-[11px] text-foreground">
                        <span className="font-semibold block text-amber-600 dark:text-amber-400">Pemeriksaan Rutin</span>
                        Jadwal inspeksi pencegahan terjadwal pukul 16:30 WIB.
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-1.5 border-t border-border">
                  <Link
                    to="/web/logs"
                    className="block text-center text-[11px] text-primary hover:underline py-1"
                  >
                    Lihat Semua Riwayat Line Stop &rarr;
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer text-left focus:outline-none"
                  title="Profil & Pengaturan"
                >
                  <img
                    src="/admin-avatar.png"
                    alt="admin"
                    className="h-7 w-7 rounded-full object-cover border border-border shadow-2xs"
                  />
                  <div className="flex flex-col text-left leading-none">
                    <span className="text-xs font-bold text-foreground">
                      admin
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      Super Admin
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none text-foreground">admin</p>
                    <p className="text-[11px] leading-none text-muted-foreground">superadmin@kyrm.co.id</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const nextLang = lang === "id" ? "en" : "id";
                    setLang(nextLang);
                    toast.success(nextLang === "id" ? "Bahasa diubah ke Indonesia" : "Language changed to English");
                  }}
                  className="cursor-pointer text-xs"
                >
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Bahasa: <strong>{lang.toUpperCase()}</strong> ({lang === "id" ? "Indonesia" : "English"})</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer text-xs">
                  {theme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4 text-amber-500" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span>Mode: <strong>{theme === "dark" ? "Dark Mode" : "Light Mode"}</strong></span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => toast.success("Sesi admin aktif (Super Admin)")}
                  className="cursor-pointer text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <Radio className="mr-2 h-3.5 w-3.5" />
                  <span>Status: <strong>Online</strong></span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-[#152a47] bg-[#0d1b2e] text-white px-4 py-4 space-y-4">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="flex items-center gap-2 pb-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#4d6c8f] font-bold">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-[#152a47]" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {group.items.map((item) => {
                    const active = isActive(item.to, item.exact);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                          active
                            ? "bg-[#1f5aa6] text-white font-semibold"
                            : "text-[#8ea3be] hover:bg-[#132742] hover:text-white"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t border-[#152a47]">
              <Link
                to="/andon"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-lg bg-[#091524] border border-[#152a47] text-emerald-400 text-xs font-mono font-bold hover:bg-[#0e2138]"
              >
                Buka Andon (TV)
              </Link>
              <Link
                to="/ipad"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-lg bg-[#091524] border border-[#152a47] text-cyan-400 text-xs font-mono font-bold hover:bg-[#0e2138]"
              >
                Buka Tablet (E-form)
              </Link>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
