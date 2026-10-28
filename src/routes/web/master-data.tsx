import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Database,
  Layers,
  Tag,
  Clock,
  Tablet,
  Tv,
  Plus,
  Pencil,
  GitMerge,
  ShieldAlert,
  Check,
  X,
  KeyRound,
  Trash2,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import type { Station, Category, Shift } from "../../lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/web/master-data")({
  head: () => ({
    meta: [
      { title: "JSGI — Master Data Configuration" },
      { name: "description", content: "Manage factory areas, conveyors, stations, stop categories, shifts, and devices." },
    ],
  }),
  component: MasterDataPage,
});

type MasterTab = "stations" | "categories" | "shifts" | "devices";

function MasterDataPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const [activeTab, setActiveTab] = useState<MasterTab>("stations");

  // Station Modal
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [stName, setStName] = useState("");
  const [stAreaId, setStAreaId] = useState(appState.areas[0]?.id ?? "area-1");
  const [stConveyorId, setStConveyorId] = useState(appState.conveyors[0]?.id ?? "cv-1");
  const [stSequence, setStSequence] = useState(1);
  const [stSpeedUnit, setStSpeedUnit] = useState("m/min");
  const [stThreshold, setStThreshold] = useState(0.1);

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatBreakdown, setNewCatBreakdown] = useState(true);
  const [newCatDowntime, setNewCatDowntime] = useState(true);

  // Merge Category Modal
  const [mergingCat, setMergingCat] = useState<Category | null>(null);
  const [targetCatId, setTargetCatId] = useState<string>("");

  // Device Modal
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [devName, setDevName] = useState("");
  const [devType, setDevType] = useState<"tablet" | "tv">("tablet");

  // Open Add Station
  const handleOpenAddStation = () => {
    setEditingStation(null);
    setStName("");
    setStAreaId(appState.areas[0]?.id ?? "area-1");
    setStConveyorId(appState.conveyors[0]?.id ?? "cv-1");
    setStSequence(appState.stations.length + 1);
    setStSpeedUnit("m/min");
    setStThreshold(0.1);
    setStationModalOpen(true);
  };

  // Open Edit Station
  const handleOpenEditStation = (st: Station) => {
    setEditingStation(st);
    setStName(st.name);
    setStAreaId(st.areaId);
    setStConveyorId(st.conveyorId);
    setStSequence(st.sequence);
    setStSpeedUnit(st.speedUnit);
    setStThreshold(st.runningThreshold);
    setStationModalOpen(true);
  };

  const handleSaveStation = () => {
    if (!stName.trim()) {
      toast.error("Nama stasiun wajib diisi");
      return;
    }
    if (editingStation) {
      store.updateStation(editingStation.id, {
        name: stName.trim(),
        areaId: stAreaId,
        conveyorId: stConveyorId,
        sequence: stSequence,
        speedUnit: stSpeedUnit,
        runningThreshold: stThreshold,
      });
      toast.success("Stasiun berhasil diperbarui");
    } else {
      store.addStation({
        name: stName.trim(),
        areaId: stAreaId,
        conveyorId: stConveyorId,
        sequence: stSequence,
        speedUnit: stSpeedUnit,
        runningThreshold: stThreshold,
      });
      toast.success("Stasiun baru berhasil ditambahkan");
    }
    setStationModalOpen(false);
  };

  const handleSaveCategory = () => {
    if (!newCatName.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    store.addCategory({
      name: newCatName.trim(),
      countsAsBreakdown: newCatBreakdown,
      countsAsDowntime: newCatDowntime,
      active: true,
      custom: false,
    });
    toast.success("Kategori stop baru tersimpan");
    setNewCatName("");
    setCatModalOpen(false);
  };

  const handleExecuteMerge = () => {
    if (!mergingCat || !targetCatId || mergingCat.id === targetCatId) return;
    store.mergeCategories(mergingCat.id, targetCatId);
    toast.success("Kategori berhasil digabungkan");
    setMergingCat(null);
  };

  const handleSaveDevice = () => {
    if (!devName.trim()) {
      toast.error("Nama device wajib diisi");
      return;
    }
    store.addDevice({
      name: devName.trim(),
      type: devType,
    });
    toast.success("Device baru terdaftar dengan token akses");
    setDevName("");
    setDeviceModalOpen(false);
  };

  const handleRevokeDevice = (id: string) => {
    store.revokeDeviceToken(id);
    toast.success(t("md.revoked"));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-display">
          {t("md.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("md.subtitle")}
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-white/10 space-x-1 font-mono text-xs">
        {[
          { id: "stations", label: t("md.tab.stations"), icon: Layers },
          { id: "categories", label: t("md.tab.categories"), icon: Tag },
          { id: "shifts", label: t("md.tab.shifts"), icon: Clock },
          { id: "devices", label: t("md.tab.devices"), icon: Tablet },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MasterTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                active
                  ? "border-white text-white font-semibold"
                  : "border-transparent text-muted-foreground hover:text-white hover:border-white/20"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: AREA & STATIONS */}
      {activeTab === "stations" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {t("md.hasRecords")}
            </p>
            <button
              onClick={handleOpenAddStation}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-white/90 shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("md.addStation")}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Urutan</th>
                  <th className="py-3 px-4">Nama Stasiun</th>
                  <th className="py-3 px-4">Area & Konveyor</th>
                  <th className="py-3 px-4">Satuan Speed</th>
                  <th className="py-3 px-4">Threshold Berhenti</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {appState.stations.map((st) => {
                  const area = appState.areas.find((a) => a.id === st.areaId);
                  const cv = appState.conveyors.find((c) => c.id === st.conveyorId);
                  return (
                    <tr key={st.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-bold text-white">#{st.sequence}</td>
                      <td className="py-3 px-4 font-bold text-white font-mono">{st.name}</td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        <div>{area?.name ?? st.areaId}</div>
                        <div className="text-muted-foreground/60">{cv?.name ?? st.conveyorId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-white">{st.speedUnit}</td>
                      <td className="py-3 px-4 font-mono text-amber-400">≤ {st.runningThreshold} {st.speedUnit}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditStation(st)}
                          className="px-2.5 py-1 rounded border border-white/10 bg-white/5 font-mono text-[11px] text-white hover:bg-white/10 transition-colors"
                        >
                          Ubah
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STOP CATEGORIES */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-amber-300/80">
              {t("md.reviewHint")}
            </p>
            <button
              onClick={() => setCatModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-white/90 shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("md.addCategory")}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Breakdown?</th>
                  <th className="py-3 px-4">Downtime?</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {appState.categories.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-medium text-white">
                      <div>{c.name}</div>
                      {c.createdBy && (
                        <div className="font-mono text-[10px] text-muted-foreground">
                          Dibuat oleh operator: {c.createdBy}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <button
                        onClick={() => store.updateCategory(c.id, { countsAsBreakdown: !c.countsAsBreakdown })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          c.countsAsBreakdown
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-white/5 text-muted-foreground border-white/10"
                        }`}
                      >
                        {c.countsAsBreakdown ? "YA (Breakdown)" : "TIDAK"}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <button
                        onClick={() => store.updateCategory(c.id, { countsAsDowntime: !c.countsAsDowntime })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          c.countsAsDowntime
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-white/5 text-muted-foreground border-white/10"
                        }`}
                      >
                        {c.countsAsDowntime ? "YA (Downtime)" : "TIDAK"}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px]">
                      {c.custom ? (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Custom Operator
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Standard</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px]">
                      <span className="text-emerald-400">Aktif</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 font-mono text-[11px]">
                        <button
                          onClick={() => {
                            setMergingCat(c);
                            const other = appState.categories.find((x) => x.id !== c.id);
                            setTargetCatId(other?.id ?? "");
                          }}
                          className="px-2 py-1 rounded border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                        >
                          <GitMerge className="h-3 w-3" />
                          Gabung
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SHIFTS */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5">
            <h3 className="font-display text-sm font-semibold text-white mb-1">
              Jadwal Shift Pabrik (WIB)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Penentuan shift dihitung otomatis berdasarkan jam kejadian stop dan produksi.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {appState.shifts.map((shift) => (
                <div key={shift.id} className="rounded-lg border border-white/10 bg-black p-4 space-y-2">
                  <span className="text-xs font-mono font-bold text-white block">{shift.name}</span>
                  <div className="flex items-center gap-2 font-mono text-xl font-bold text-emerald-400">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {String(shift.startHour).padStart(2, "0")}:{String(shift.startMinute).padStart(2, "0")} WIB
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    ID: {shift.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEVICES */}
      {activeTab === "devices" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Otorisasi perangkat tablet e-form dan monitor TV Andon di lini produksi.
            </p>
            <button
              onClick={() => setDeviceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-white/90 shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("md.addDevice")}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {appState.devices.map((dev) => (
              <div
                key={dev.id}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
                  dev.revoked ? "border-red-500/20 bg-red-950/10 opacity-60" : "border-white/10 bg-[#0d0d10]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {dev.type === "tablet" ? (
                        <Tablet className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <Tv className="h-4 w-4 text-emerald-400" />
                      )}
                      <span className="font-mono text-xs uppercase tracking-wider text-white font-bold">
                        {dev.type === "tablet" ? t("md.deviceType.tablet") : t("md.deviceType.tv")}
                      </span>
                    </div>
                    {dev.revoked ? (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                        DICABUT
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        AKTIF
                      </span>
                    )}
                  </div>
                  <h4 className="font-mono text-sm font-semibold text-white">{dev.name}</h4>
                  <div className="mt-3 p-2 rounded bg-black border border-white/5 font-mono text-[10px] text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{dev.token}</span>
                    <KeyRound className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
                  {!dev.revoked && (
                    <button
                      onClick={() => handleRevokeDevice(dev.id)}
                      className="text-xs font-mono text-red-400 hover:text-red-300 hover:underline"
                    >
                      {t("md.revoke")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL STATION (Add / Edit) */}
      {stationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-4">
              {editingStation ? t("md.editStation") : t("md.addStation")}
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">Nama Stasiun:</label>
                <input
                  type="text"
                  placeholder="Contoh: ST-07 Final Inspection"
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Area:</label>
                  <select
                    value={stAreaId}
                    onChange={(e) => setStAreaId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  >
                    {appState.areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Konveyor:</label>
                  <select
                    value={stConveyorId}
                    onChange={(e) => setStConveyorId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  >
                    {appState.conveyors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Urutan:</label>
                  <input
                    type="number"
                    value={stSequence}
                    onChange={(e) => setStSequence(+e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Satuan:</label>
                  <input
                    type="text"
                    value={stSpeedUnit}
                    onChange={(e) => setStSpeedUnit(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Threshold:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stThreshold}
                    onChange={(e) => setStThreshold(+e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setStationModalOpen(false)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleSaveStation}
                className="px-4 py-2 rounded bg-white text-black font-semibold font-mono text-xs hover:bg-white/90"
              >
                Simpan Stasiun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATEGORY */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-4">
              {t("md.addCategory")}
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">{t("md.newCategoryName")}:</label>
                <input
                  type="text"
                  placeholder="Contoh: Sensor Optical Glitch"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCatBreakdown}
                    onChange={(e) => setNewCatBreakdown(e.target.checked)}
                    className="rounded border-white/20 bg-black text-rose-500"
                  />
                  <span className="text-white">{t("md.flagBreakdown")}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCatDowntime}
                    onChange={(e) => setNewCatDowntime(e.target.checked)}
                    className="rounded border-white/20 bg-black text-amber-500"
                  />
                  <span className="text-white">{t("md.flagDowntime")}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setCatModalOpen(false)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 rounded bg-white text-black font-semibold font-mono text-xs hover:bg-white/90"
              >
                Simpan Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MERGE CATEGORY */}
      {mergingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-2">
              Gabungkan Kategori "{mergingCat.name}"
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Semua stop yang memakai kategori ini akan dipindahkan ke kategori target, dan kategori ini akan dihapus.
            </p>

            <div className="space-y-3 text-xs font-mono">
              <label className="block text-muted-foreground">{t("md.mergeInto")}:</label>
              <select
                value={targetCatId}
                onChange={(e) => setTargetCatId(e.target.value)}
                className="w-full rounded border border-white/10 bg-black p-2 text-white"
              >
                {appState.categories
                  .filter((c) => c.id !== mergingCat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setMergingCat(null)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteMerge}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500"
              >
                Konfirmasi Gabung
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADD DEVICE */}
      {deviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-4">
              {t("md.addDevice")}
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">{t("md.deviceName")}:</label>
                <input
                  type="text"
                  placeholder="Contoh: iPad Pos Quality Control"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">{t("md.deviceType")}:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDevType("tablet")}
                    className={`p-3 rounded border text-center font-mono ${
                      devType === "tablet"
                        ? "border-cyan-500 bg-cyan-950/20 text-cyan-300 font-bold"
                        : "border-white/10 bg-black text-muted-foreground"
                    }`}
                  >
                    Tablet E-form
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevType("tv")}
                    className={`p-3 rounded border text-center font-mono ${
                      devType === "tv"
                        ? "border-emerald-500 bg-emerald-950/20 text-emerald-300 font-bold"
                        : "border-white/10 bg-black text-muted-foreground"
                    }`}
                  >
                    Andon TV Display
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setDeviceModalOpen(false)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleSaveDevice}
                className="px-4 py-2 rounded bg-white text-black font-semibold font-mono text-xs hover:bg-white/90"
              >
                Simpan & Buat Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
