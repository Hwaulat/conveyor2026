import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  Building2,
  Workflow,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import type { Station } from "../../lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/web/master-data")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Master Data Configuration" },
      { name: "description", content: "Konfigurasi Area, Konveyor, dan Daftar Stasiun Produksi." },
    ],
  }),
  component: MasterDataPage,
});

interface StationDraftRow {
  id: string;
  code: string;
  name: string;
}

function MasterDataPage() {
  const { t } = useI18n();
  const appState = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("all");

  // Modal: Batch Add Stations under Area & Conveyor
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [areaInput, setAreaInput] = useState("");
  const [conveyorInput, setConveyorInput] = useState("");
  const [stationRows, setStationRows] = useState<StationDraftRow[]>([
    { id: "row-1", code: "", name: "" },
    { id: "row-2", code: "", name: "" },
  ]);

  // Modal: Edit Single Station
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editAreaId, setEditAreaId] = useState("");
  const [editConveyorId, setEditConveyorId] = useState("");
  const [editSpeedUnit, setEditSpeedUnit] = useState("m/min");
  const [editThreshold, setEditThreshold] = useState(0.1);

  // Modal: Delete Confirmation
  const [deleteStationTarget, setDeleteStationTarget] = useState<Station | null>(null);

  // Filtered stations for display
  const filteredStations = useMemo(() => {
    return appState.stations.filter((st) => {
      const area = appState.areas.find((a) => a.id === st.areaId);
      const cv = appState.conveyors.find((c) => c.id === st.conveyorId);

      const matchArea = selectedAreaFilter === "all" || st.areaId === selectedAreaFilter;

      if (!searchQuery.trim()) return matchArea;

      const q = searchQuery.toLowerCase();
      const matchSearch =
        (st.code && st.code.toLowerCase().includes(q)) ||
        st.name.toLowerCase().includes(q) ||
        (area && area.name.toLowerCase().includes(q)) ||
        (cv && cv.name.toLowerCase().includes(q)) ||
        st.id.toLowerCase().includes(q);

      return matchArea && matchSearch;
    });
  }, [appState.stations, appState.areas, appState.conveyors, selectedAreaFilter, searchQuery]);

  // --- Handlers for Batch Add Modal ---
  const handleOpenBatchModal = () => {
    const defaultArea = appState.areas[0]?.name ?? "Main Assembly Line";
    const defaultCv = appState.conveyors[0]?.name ?? "Conveyor CV-01";
    setAreaInput(defaultArea);
    setConveyorInput(defaultCv);

    const nextSeq = appState.stations.length + 1;
    const nextCode1 = `ST-${String(nextSeq).padStart(2, "0")}`;
    const nextCode2 = `ST-${String(nextSeq + 1).padStart(2, "0")}`;

    setStationRows([
      { id: "row-1", code: nextCode1, name: "" },
      { id: "row-2", code: nextCode2, name: "" },
    ]);
    setBatchModalOpen(true);
  };

  const handleAddStationRow = () => {
    const nextNum = appState.stations.length + stationRows.length + 1;
    const nextCode = `ST-${String(nextNum).padStart(2, "0")}`;
    setStationRows((prev) => [
      ...prev,
      { id: `row-${Date.now()}-${Math.random()}`, code: nextCode, name: "" },
    ]);
  };

  const handleRemoveStationRow = (rowId: string) => {
    if (stationRows.length <= 1) {
      toast.warning("Minimal harus ada satu stasiun");
      return;
    }
    setStationRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, field: "code" | "name", value: string) => {
    setStationRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    );
  };

  const handleSaveBatchStations = () => {
    if (!areaInput.trim()) {
      toast.error("Nama Area wajib diisi");
      return;
    }
    if (!conveyorInput.trim()) {
      toast.error("Nama Konveyor wajib diisi");
      return;
    }

    const validRows = stationRows.filter((r) => r.code.trim() && r.name.trim());
    if (validRows.length === 0) {
      toast.error("Isi minimal 1 baris stasiun lengkap dengan Kode dan Nama Stasiun");
      return;
    }

    // Ensure Area and Conveyor in store
    const area = store.ensureArea(areaInput.trim());
    const conveyor = store.ensureConveyor(conveyorInput.trim(), area.id);

    // Prepare stations batch
    const stationsToAdd = validRows.map((r, idx) => ({
      code: r.code.trim().toUpperCase(),
      name: r.name.trim(),
      areaId: area.id,
      conveyorId: conveyor.id,
      sequence: appState.stations.length + idx + 1,
      speedUnit: "m/min",
      runningThreshold: 0.1,
    }));

    store.addStationsBatch(stationsToAdd);
    toast.success(`Berhasil menambahkan ${stationsToAdd.length} stasiun baru pada ${conveyor.name}`);
    setBatchModalOpen(false);
  };

  // --- Handlers for Edit Single Station ---
  const handleOpenEditStation = (st: Station) => {
    setEditingStation(st);
    setEditCode(st.code || st.name.split(" ")[0] || `ST-${st.sequence}`);
    setEditName(st.name.replace(/^ST-\d+\s*/i, ""));
    setEditAreaId(st.areaId);
    setEditConveyorId(st.conveyorId);
    setEditSpeedUnit(st.speedUnit || "m/min");
    setEditThreshold(st.runningThreshold ?? 0.1);
    setEditModalOpen(true);
  };

  const handleSaveEditStation = () => {
    if (!editingStation) return;
    if (!editName.trim()) {
      toast.error("Nama stasiun wajib diisi");
      return;
    }

    store.updateStation(editingStation.id, {
      code: editCode.trim().toUpperCase() || undefined,
      name: editName.trim(),
      areaId: editAreaId,
      conveyorId: editConveyorId,
      speedUnit: editSpeedUnit.trim() || "m/min",
      runningThreshold: editThreshold,
    });

    toast.success("Data stasiun berhasil diperbarui");
    setEditModalOpen(false);
    setEditingStation(null);
  };

  // --- Handlers for Delete Station ---
  const handleConfirmDelete = () => {
    if (!deleteStationTarget) return;
    store.deleteStation(deleteStationTarget.id);
    toast.success(`Stasiun ${deleteStationTarget.name} berhasil dihapus`);
    setDeleteStationTarget(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("md.title")} Stasiun & Konveyor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("md.subtitle")}
          </p>
        </div>

        <button
          onClick={handleOpenBatchModal}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Data Stasiun</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Areas */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                Total Area Pabrik
              </span>
              <span className="font-mono text-2xl font-black text-foreground">
                {appState.areas.length} Area
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Conveyors */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                Jalur Konveyor
              </span>
              <span className="font-mono text-2xl font-black text-foreground">
                {appState.conveyors.length} Jalur
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Stations */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                Stasiun Terdaftar
              </span>
              <span className="font-mono text-2xl font-black text-foreground">
                {appState.stations.length} Stasiun
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Station Master Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs space-y-0">
        {/* Toolbar: Search & Area Filter */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground font-semibold">
              Menampilkan {filteredStations.length} dari {appState.stations.length} stasiun
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Filter by Area */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
              <span className="text-muted-foreground">Area:</span>
              <select
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
                className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-card text-foreground">Semua Area ({appState.areas.length})</option>
                {appState.areas.map((a) => (
                  <option key={a.id} value={a.id} className="bg-card text-foreground">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari kode, stasiun, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Stations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Urutan</th>
                <th className="py-3 px-4">Kode Stasiun</th>
                <th className="py-3 px-4">Nama Stasiun</th>
                <th className="py-3 px-4">Nama Area</th>
                <th className="py-3 px-4">Nama Konveyor</th>
                <th className="py-3 px-4">Ambang Berhenti</th>
                <th className="py-3 px-4 text-center">Live Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-sans">
              {filteredStations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono text-xs">
                    Tidak ada stasiun yang cocok dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredStations.map((st) => {
                  const area = appState.areas.find((a) => a.id === st.areaId);
                  const cv = appState.conveyors.find((c) => c.id === st.conveyorId);
                  const live = appState.stationLive[st.id];
                  const isStopped = live?.state === "stopped";

                  const displayCode = st.code || st.name.split(" ")[0] || `ST-${st.sequence}`;
                  const displayName = st.code ? st.name : st.name.replace(/^ST-\d+\s*/i, "");

                  return (
                    <tr key={st.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-muted-foreground">
                        #{st.sequence}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        <span className="inline-flex px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                          {displayCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {displayName || st.name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        {area?.name ?? st.areaId}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        {cv?.name ?? st.conveyorId}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        <span className="text-foreground font-semibold">≤ {st.runningThreshold}</span> {st.speedUnit}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isStopped
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isStopped ? "bg-rose-500" : "bg-emerald-500"}`} />
                          {isStopped ? "STOPPED" : "RUNNING"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditStation(st)}
                            className="p-1.5 rounded border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-2xs"
                            title="Ubah Data Stasiun"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteStationTarget(st)}
                            className="p-1.5 rounded border border-border bg-card text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors shadow-2xs"
                            title="Hapus Stasiun"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: BATCH ADD STATIONS UNDER AREA & CONVEYOR */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Tambah Master Data Stasiun
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tentukan Nama Area, Nama Konveyor, dan daftarkan satu atau lebih stasiun sekaligus.
                </p>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Field 1: Nama Area */}
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  1. Nama Area:
                </label>
                <input
                  type="text"
                  list="area-suggestions"
                  placeholder="Contoh: Main Assembly Line"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
                <datalist id="area-suggestions">
                  {appState.areas.map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Ketik nama area baru atau pilih dari area yang sudah ada.
                </span>
              </div>

              {/* Field 2: Nama Conveyor */}
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  2. Nama Konveyor:
                </label>
                <input
                  type="text"
                  list="conveyor-suggestions"
                  placeholder="Contoh: Conveyor CV-01 (Infeed & Framing)"
                  value={conveyorInput}
                  onChange={(e) => setConveyorInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
                <datalist id="conveyor-suggestions">
                  {appState.conveyors.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Ketik nama jalur konveyor yang berada di dalam area tersebut.
                </span>
              </div>

              {/* Field 3: Dynamic Station List */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-foreground font-semibold">
                      3. Daftar Stasiun ({stationRows.length} baris):
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Bisa tambah lebih dari 1 stasiun dalam jalur konveyor ini.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStationRow}
                    className="flex items-center gap-1 rounded bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1 text-[11px] font-semibold border border-border transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {stationRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20"
                    >
                      <span className="w-6 text-center font-bold text-muted-foreground text-[11px]">
                        #{index + 1}
                      </span>
                      {/* Station Code */}
                      <div className="w-1/3">
                        <input
                          type="text"
                          placeholder="Kode (ST-01)"
                          value={row.code}
                          onChange={(e) => handleUpdateRow(row.id, "code", e.target.value)}
                          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-foreground font-bold uppercase focus:outline-none focus:border-ring"
                        />
                      </div>
                      {/* Station Name */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Nama Stasiun (contoh: Robot Welding)"
                          value={row.name}
                          onChange={(e) => handleUpdateRow(row.id, "name", e.target.value)}
                          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:border-ring"
                        />
                      </div>
                      {/* Delete Row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveStationRow(row.id)}
                        disabled={stationRows.length <= 1}
                        className="p-1.5 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Hapus Baris"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveBatchStations}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs transition-colors"
              >
                Simpan Semua Stasiun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SINGLE STATION */}
      {editModalOpen && editingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">
              Ubah Data Stasiun ({editingStation.code || editingStation.id})
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">Kode Stasiun:</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="Contoh: ST-01"
                  className="w-full rounded border border-border bg-background p-2 text-foreground font-bold uppercase focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Nama Stasiun:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Stamping & Press"
                  className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Nama Area:</label>
                  <select
                    value={editAreaId}
                    onChange={(e) => setEditAreaId(e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                  >
                    {appState.areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Nama Konveyor:</label>
                  <select
                    value={editConveyorId}
                    onChange={(e) => setEditConveyorId(e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                  >
                    {appState.conveyors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Satuan Kecepatan:</label>
                  <input
                    type="text"
                    value={editSpeedUnit}
                    onChange={(e) => setEditSpeedUnit(e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Threshold Berhenti:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(+e.target.value)}
                    className="w-full rounded border border-border bg-background p-2 text-foreground focus:outline-none focus:border-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-5 border-t border-border">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditStation}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteStationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">
                Hapus Stasiun?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus stasiun <strong className="text-foreground">{deleteStationTarget.name} ({deleteStationTarget.code || deleteStationTarget.id})</strong>? Data telemetri live untuk stasiun ini juga akan dihapus.
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setDeleteStationTarget(null)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500 shadow-2xs"
              >
                Ya, Hapus Stasiun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
