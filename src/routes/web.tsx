import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useAppStore, store } from "../lib/store";
import { fmtTime, fmtDateHuman, shiftOf } from "../lib/format";
import { toast } from "sonner";

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
  badgeVariant?: "destructive" | "default" | undefined;
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

  // Live clock WIB ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentShift = shiftOf(nowMs, appState.shifts);
  const stoppedStationsCount = Object.values(appState.stationLive).filter((s) => s.state === "stopped").length;

  const navGroups: NavGroup[] = [
    {
      label: t("nav.group.core"),
      items: [
        {
          label: t("nav.dashboard"),
          to: "/web",
          exact: true,
          icon: LayoutDashboard,
          badge: stoppedStationsCount > 0 ? `${stoppedStationsCount} STOP` : undefined,
          badgeVariant: "destructive",
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
          badge: `${appState.stops.length}`,
        },
      ],
    },
    {
      label: t("nav.group.production"),
      items: [
        {
          label: t("nav.production"),
          to: "/web/production",
          icon: BarChart3,
        },
        {
          label: t("nav.reports"),
          to: "/web/reports",
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      label: t("nav.group.setup"),
      items: [
        {
          label: t("nav.masterData"),
          to: "/web/master-data",
          icon: Database,
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
        } w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen select-none transition-all duration-200`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/web" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-sidebar-border bg-sidebar-accent font-mono text-xs font-black tracking-wider text-sidebar-foreground">
              KRM
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display text-xs font-bold tracking-tight text-sidebar-foreground truncate" title="PT. Krama Yudha Ratu Motor Indonesia">
                PT. KRAMA YUDHA RATU MOTOR
              </span>
              <span className="font-mono text-[9px] text-muted-foreground truncate">
                LINE-STOP & OEE MONITOR
              </span>
            </div>
          </Link>
          <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            v2.6
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">
                {group.label}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
                            item.badgeVariant === "destructive"
                              ? active
                                ? "bg-destructive text-destructive-foreground font-bold"
                                : "bg-destructive/15 text-destructive border border-destructive/30"
                              : active
                              ? "bg-primary-foreground/20 text-primary-foreground font-medium"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Dedicated External Routes Launchers */}
          <div className="pt-2 border-t border-sidebar-border space-y-2">
            <p className="px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">
              Dedicated Displays
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/andon"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-lg border border-sidebar-border bg-card p-2.5 text-center transition-all hover:border-primary/30 hover:bg-muted/50 shadow-xs"
              >
                <Tv className="h-4 w-4 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  Andon TV <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">Fullscreen</span>
              </Link>

              <Link
                to="/ipad"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center justify-center rounded-lg border border-sidebar-border bg-card p-2.5 text-center transition-all hover:border-primary/30 hover:bg-muted/50 shadow-xs"
              >
                <Tablet className="h-4 w-4 text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  E-form <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">Tablet Mode</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Footer — Simulation Controls */}
        <div className="border-t border-sidebar-border p-3 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Simulasi PLC Live
            </span>
            <button
              onClick={handleResetData}
              title="Reset data demo ke awal"
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
            >
              <RotateCcwIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleSimulateRandomStop}
              className="flex items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 font-mono text-[10px] text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Square className="h-3 w-3 fill-current" />
              Sim Stop
            </button>
            <button
              onClick={handleResumeAll}
              className="flex items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <Play className="h-3 w-3 fill-current" />
              Resume All
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 md:px-6 backdrop-blur">
          {/* Left: Sidebar Collapse Icon Button (Replaces online status & shift) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              title={sidebarCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
              aria-label="Toggle Sidebar"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Right: Clock WIB, Theme Switch, Language Switch, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock WIB */}
            <div className="hidden sm:flex flex-col items-end border-r border-border pr-3">
              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tracking-wider text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{fmtTime(nowMs)}</span>
                <span className="text-[10px] text-muted-foreground font-normal">WIB</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-sans">
                {fmtDateHuman(nowMs)}
              </span>
            </div>

            {/* Theme Switcher Toggle (Icon Only) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              title={theme === "dark" ? "Ganti ke Mode Terang (Light Mode)" : "Ganti ke Mode Gelap (Dark Mode)"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground hover:bg-muted transition-colors shadow-2xs"
              title="Ganti Bahasa / Switch Language"
            >
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold uppercase">{lang}</span>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs font-semibold text-foreground">
                SA
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-medium text-foreground leading-tight">
                  {t("header.superAdmin")}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t("header.admin")}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-border bg-card px-4 py-4 space-y-4">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {group.items.map((item) => {
                    const active = isActive(item.to, item.exact);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 rounded px-2.5 py-2 text-xs font-medium ${
                          active ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <div className="flex gap-2 pt-2 border-t border-border">
              <Link
                to="/andon"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold"
              >
                Buka Andon (TV)
              </Link>
              <Link
                to="/ipad"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold"
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
