import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Tablet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Wifi,
  WifiOff,
  ArrowLeft,
  Send,
  Save,
  Check,
  X,
  History,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
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
      { title: "JSGI — E-Form Line Stop (Tablet)" },
      { name: "description", content: "Fast touch-optimized E-form for floor operators to record emergency stops." },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: IpadEFormPage,
});

function IpadEFormPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const [nowMs, setNowMs] = useState(Date.now());

  // Network State (with manual simulation toggle)
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  // Form State
  const [selectedStationId, setSelectedStationId] = useState<string>(() => appState.stations[0]?.id ?? "st-1");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => appState.categories[0]?.id ?? "cat-1");
  const [isOpenStop, setIsOpenStop] = useState<boolean>(true);
  const [startTimeVal, setStartTimeVal] = useState<string>(() => toLocalInputValue(Date.now()));
  const [endTimeVal, setEndTimeVal] = useState<string>("");
  const [operatorBadge, setOperatorBadge] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jsgi_operator_badge") || "Rian Hidayat (EMP-215)";
    }
    return "Rian Hidayat (EMP-215)";
  });
  const [note, setNote] = useState<string>("");

  // Add Category Modal
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

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
          toast.success(t("form.online"), {
            description: `${count} entri yang tertunda berhasil dikirimkan ke server.`,
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
  }, [simulatedOffline, t]);

  const effectiveOnline = isOnline && !simulatedOffline;

  const currentShift = shiftOf(nowMs, appState.shifts);

  const handleToggleOfflineMode = () => {
    const next = !simulatedOffline;
    setSimulatedOffline(next);
    if (!next) {
      const count = store.syncOfflineQueue();
      if (count > 0) {
        toast.success(t("form.online"), {
          description: `${count} antrean entri offline berhasil disinkronkan.`,
        });
      } else {
        toast.info("Status jaringan: ONLINE");
      }
    } else {
      toast.warning(t("form.offline"));
    }
  };

  const handleSaveStop = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStationId || !selectedCategoryId || !operatorBadge.trim()) {
      toast.error(t("form.error.required"));
      return;
    }

    const startMs = fromLocalInputValue(startTimeVal);
    if (isNaN(startMs)) {
      toast.error("Waktu mulai tidak valid");
      return;
    }

    const now = Date.now();
    if (startMs > now + 60_000) {
      toast.error(t("form.error.startFuture"));
      return;
    }

    // 24 hours check
    if (now - startMs > 24 * 3_600_000) {
      toast.error(t("form.error.notWithin24h"));
      return;
    }

    let endMs: number | null = null;
    if (!isOpenStop) {
      endMs = endTimeVal ? fromLocalInputValue(endTimeVal) : now;
      if (endMs && endMs < startMs) {
        toast.error(t("form.error.endBeforeStart"));
        return;
      }
      if (endMs && endMs > now + 60_000) {
        toast.error(t("form.error.endFuture"));
        return;
      }
    }

    // Persist operator
    if (typeof window !== "undefined") {
      localStorage.setItem("jsgi_operator_badge", operatorBadge);
    }

    const targetStation = appState.stations.find((s) => s.id === selectedStationId);

    const stopPayload: Omit<LineStop, "id"> = {
      areaId: targetStation?.areaId ?? "area-1",
      stationId: selectedStationId,
      startMs,
      endMs,
      categoryId: selectedCategoryId,
      reportedBy: operatorBadge.trim(),
      status: isOpenStop ? "open" : "closed",
      source: "form",
      note: note.trim() || undefined,
    };

    if (effectiveOnline) {
      const created = store.addStop(stopPayload);
      if (isOpenStop) {
        toast.warning(t("form.savedOpen"));
      } else {
        const dur = stopDurationMs(created, endMs ?? now);
        toast.success(t("form.savedWithDuration", { duration: fmtDuration(dur) }));
      }
    } else {
      store.queueOfflineStop(stopPayload);
      toast.info("Tersimpan dalam Antrean Offline", {
        description: "Akan otomatis terkirim saat tersambung kembali ke jaringan.",
      });
    }

    // Reset some fields
    setNote("");
    setStartTimeVal(toLocalInputValue(Date.now()));
    setEndTimeVal("");
    setIsOpenStop(true);
  };

  const handleAddNewCategory = () => {
    if (!newCatName.trim()) {
      toast.error(t("form.error.categoryName"));
      return;
    }
    const created = store.addCategory({
      name: newCatName.trim(),
      countsAsBreakdown: false, // Operator-added category doesn't count as breakdown until admin reviews it
      countsAsDowntime: true,
      active: true,
      custom: true,
      createdBy: operatorBadge,
    });
    setSelectedCategoryId(created.id);
    toast.success(t("form.newCategorySaved", { name: created.name }));
    setNewCatName("");
    setNewCatModalOpen(false);
  };

  const handleCloseRecentStop = (stopId: string) => {
    store.closeStop(stopId, Date.now());
    toast.success("Stop berhasil ditutup (CLOSED)");
  };

  // Recent stops for this station / today
  const recentStops = useMemo(() => {
    return appState.stops.slice(0, 5);
  }, [appState.stops]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans select-none p-4 md:p-6 lg:p-8">
      {/* Top Tablet Navigation */}
      <header className="flex items-center justify-between border-b border-white/20 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/web"
            className="p-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors"
            title="Kembali ke Web"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Tablet className="h-5 w-5 text-cyan-400" />
              <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-white uppercase">
                {t("form.title")}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Mode Tablet Operator Lapangan • {currentShift.name}
            </p>
          </div>
        </div>

        {/* Network & Live Clock */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOfflineMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all ${
              effectiveOnline
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
                : "border-amber-500/40 bg-amber-950/40 text-amber-300 animate-pulse"
            }`}
            title="Klik untuk simulasi online/offline"
          >
            {effectiveOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{effectiveOnline ? "ONLINE" : "OFFLINE QUEUE"}</span>
          </button>

          <div className="hidden sm:flex flex-col text-right font-mono">
            <span className="text-sm font-bold text-white">{fmtTime(nowMs)} WIB</span>
            <span className="text-[10px] text-muted-foreground">{fmtDateTime(nowMs)}</span>
          </div>
        </div>
      </header>

      {/* Main Grid: Form on Left (60%), Recent on Right (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Form Container (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border-2 border-white/20 bg-[#0d0d10] p-6 shadow-2xl flex flex-col justify-between">
          <form onSubmit={handleSaveStop} className="space-y-6">
            {/* 1. Station Selector (Large Touch Buttons) */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
                1. Pilih Stasiun Line Stop:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {appState.stations.map((station) => {
                  const isSelected = selectedStationId === station.id;
                  const live = appState.stationLive[station.id];
                  const isStopped = live?.state === "stopped";

                  return (
                    <button
                      type="button"
                      key={station.id}
                      onClick={() => setSelectedStationId(station.id)}
                      className={`min-h-[58px] p-3 rounded-xl border-2 text-left font-mono transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "border-white bg-white text-black font-bold shadow-lg scale-[1.02]"
                          : isStopped
                          ? "border-red-500/60 bg-red-950/20 text-red-300"
                          : "border-white/10 bg-black text-white hover:border-white/30"
                      }`}
                    >
                      <span className="text-xs font-bold truncate block">{station.name.split(" ")[0]}</span>
                      <div className="flex items-center justify-between text-[10px] opacity-80 mt-1">
                        <span>#{station.sequence}</span>
                        <span className={isStopped ? "text-red-400 font-bold" : ""}>
                          {isStopped ? "STOPPED" : "RUNNING"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Stop Status & Timing */}
            <div className="rounded-xl border border-white/10 bg-black/60 p-4 space-y-4">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                2. Status & Waktu Berhenti:
              </label>

              {/* Toggle Still Stopped vs Closed */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpenStop(true)}
                  className={`p-3.5 rounded-xl border-2 font-mono text-xs font-bold text-center transition-all ${
                    isOpenStop
                      ? "border-red-500 bg-red-600 text-white shadow-lg shadow-red-600/30"
                      : "border-white/10 bg-black text-muted-foreground hover:text-white"
                  }`}
                >
                  Masih Berhenti (Simpan OPEN)
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpenStop(false)}
                  className={`p-3.5 rounded-xl border-2 font-mono text-xs font-bold text-center transition-all ${
                    !isOpenStop
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "border-white/10 bg-black text-muted-foreground hover:text-white"
                  }`}
                >
                  Sudah Selesai (CLOSED)
                </button>
              </div>

              {/* Start & End Time Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block font-mono text-[11px] text-muted-foreground mb-1">
                    {t("form.startTime")}:
                  </span>
                  <input
                    type="datetime-local"
                    value={startTimeVal}
                    onChange={(e) => setStartTimeVal(e.target.value)}
                    className="w-full h-12 rounded-lg border border-white/20 bg-black px-3 font-mono text-sm text-white focus:outline-none focus:border-white"
                  />
                </div>

                {!isOpenStop && (
                  <div>
                    <span className="block font-mono text-[11px] text-muted-foreground mb-1">
                      {t("form.endTime")}:
                    </span>
                    <input
                      type="datetime-local"
                      value={endTimeVal}
                      onChange={(e) => setEndTimeVal(e.target.value)}
                      placeholder="Waktu Selesai"
                      className="w-full h-12 rounded-lg border border-white/20 bg-black px-3 font-mono text-sm text-white focus:outline-none focus:border-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  3. Kategori Penyebab Stop:
                </label>
                <button
                  type="button"
                  onClick={() => setNewCatModalOpen(true)}
                  className="font-mono text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("form.addCategory")}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {appState.categories.map((c) => {
                  const isSelected = selectedCategoryId === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`min-h-[46px] px-3 py-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-white bg-white text-black font-bold shadow-md"
                          : "border-white/10 bg-black text-muted-foreground hover:text-white hover:border-white/30"
                      }`}
                    >
                      <span className="truncate pr-1">{c.name}</span>
                      {c.countsAsBreakdown && (
                        <span
                          className={`font-mono text-[9px] px-1 rounded uppercase ${
                            isSelected ? "bg-black text-white" : "bg-rose-500/20 text-rose-400"
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

            {/* 4. Operator & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  Operator / No. Badge:
                </label>
                <input
                  type="text"
                  value={operatorBadge}
                  onChange={(e) => setOperatorBadge(e.target.value)}
                  placeholder="Contoh: Rian Hidayat (EMP-215)"
                  className="w-full h-11 rounded-lg border border-white/20 bg-black px-3 font-mono text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Benda kerja macet di conveyor feeder"
                  className="w-full h-11 rounded-lg border border-white/20 bg-black px-3 font-sans text-xs text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>

            {/* Big Action Submit Button */}
            <button
              type="submit"
              className={`w-full h-14 rounded-xl font-display text-base font-bold tracking-wider uppercase transition-all shadow-xl flex items-center justify-center gap-2 ${
                isOpenStop
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                  : "bg-white hover:bg-white/90 text-black shadow-white/20"
              }`}
            >
              <Send className="h-5 w-5" />
              {isOpenStop ? t("form.saveOpen") : t("form.submit")}
            </button>
          </form>
        </div>

        {/* Recent Entries & Offline Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          {/* Offline Queue Strip if items waiting */}
          {appState.offlineQueue.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-amber-300 flex items-center gap-2">
                  <WifiOff className="h-4 w-4" />
                  Antrean Offline ({appState.offlineQueue.length})
                </span>
                <span className="font-mono text-[10px] text-amber-400/80">Menunggu jaringan</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {appState.offlineQueue.map((item) => (
                  <div key={item.id} className="p-2 rounded bg-black/60 border border-amber-500/20 text-white flex justify-between">
                    <span>{item.stationId}</span>
                    <span className="text-amber-300">{fmtTime(item.startMs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Entries Box */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                    {t("form.recent")}
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">5 Terakhir</span>
              </div>

              <div className="space-y-3">
                {recentStops.map((stop) => {
                  const st = appState.stations.find((x) => x.id === stop.stationId);
                  const cat = appState.categories.find((c) => c.id === stop.categoryId);
                  const isOpen = stop.status === "open";
                  const dur = stopDurationMs(stop, nowMs);

                  return (
                    <div
                      key={stop.id}
                      className={`p-3.5 rounded-xl border text-xs font-mono transition-colors ${
                        isOpen
                          ? "border-red-500/50 bg-red-950/20 shadow-md"
                          : "border-white/10 bg-black/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-white text-sm">
                          {st?.name ?? stop.stationId}
                        </span>
                        {isOpen ? (
                          <span className="px-2 py-0.5 rounded bg-red-500 text-white font-bold text-[10px] animate-pulse">
                            OPEN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-white/10 text-muted-foreground text-[10px]">
                            CLOSED
                          </span>
                        )}
                      </div>

                      <div className="text-muted-foreground text-[11px] font-sans line-clamp-1 mb-2">
                        {cat?.name ?? stop.categoryId} • {stop.reportedBy}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-white font-bold">
                          {isOpen ? `Sedang jalan: ${fmtDuration(dur)}` : `Durasi: ${fmtDuration(dur)}`}
                        </span>

                        {isOpen && (
                          <button
                            type="button"
                            onClick={() => handleCloseRecentStop(stop.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors shadow"
                          >
                            {t("form.closeStop")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-center font-mono text-[11px] text-muted-foreground">
              Entri langsung tersinkronisasi ke papan Andon TV & Dashboard Web.
            </div>
          </div>
        </div>
      </div>

      {/* Inline Modal: Add Category */}
      {newCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-white mb-2">
              {t("form.newCategoryTitle")}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Kategori baru akan langsung dapat digunakan dan ditandai untuk review oleh supervisor.
            </p>

            <div className="mb-4">
              <label className="block font-mono text-xs text-muted-foreground mb-1">
                {t("form.newCategoryName")}:
              </label>
              <input
                type="text"
                placeholder="Contoh: Sensor Jamming"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full h-12 rounded-lg border border-white/20 bg-black px-3 font-mono text-sm text-white focus:outline-none focus:border-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewCatModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddNewCategory}
                className="px-4 py-2.5 rounded-lg bg-white text-black font-bold font-mono text-xs hover:bg-white/90 shadow"
              >
                Simpan & Pilih
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
