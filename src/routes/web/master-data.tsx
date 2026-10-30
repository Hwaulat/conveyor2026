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
  Tag,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import type { Station, Category } from "../../lib/types";
import { toast } from "sonner";
import { SelectInput } from "../../components/ui/select-input";
import { TablePagination } from "../../components/TablePagination";
import { Eye, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/web/master-data")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Master Data Configuration" },
      { name: "description", content: "Konfigurasi Master Data Stasiun dan Kategori Stop (MTTR & MTBF)." },
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

  // Active Tab: "stations" | "categories"
  const [activeTab, setActiveTab] = useState<"stations" | "categories">("stations");

  // ==========================================
  // STATION STATE & HANDLERS
  // ==========================================
  const defaultAreaId = useMemo(() => {
    return (
      appState.areas.find(
        (a) => a.name.toLowerCase() === "pted" || a.code?.toLowerCase() === "pted",
      )?.id ?? appState.areas[0]?.id ?? "area-pted"
    );
  }, [appState.areas]);

  const [stationSearchQuery, setStationSearchQuery] = useState("");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>(() => defaultAreaId);

  useEffect(() => {
    if (selectedAreaFilter === "all" || appState.areas.some((a) => a.id === selectedAreaFilter)) {
      return;
    }
    setSelectedAreaFilter(defaultAreaId);
  }, [defaultAreaId, selectedAreaFilter, appState.areas]);

  const [stationPage, setStationPage] = useState(1);
  const [stationPageSize, setStationPageSize] = useState(10);
  const [viewingStation, setViewingStation] = useState<Station | null>(null);

  // Modal: Batch Add Stations under Area & Conveyor
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [areaInput, setAreaInput] = useState("PTED");
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

  // Modal: Delete Station Confirmation
  const [deleteStationTarget, setDeleteStationTarget] = useState<Station | null>(null);

  // Filtered stations for display
  const filteredStations = useMemo(() => {
    return appState.stations.filter((st) => {
      const area = appState.areas.find((a) => a.id === st.areaId);
      const cv = appState.conveyors.find((c) => c.id === st.conveyorId);

      const matchArea = selectedAreaFilter === "all" || st.areaId === selectedAreaFilter;

      if (!stationSearchQuery.trim()) return matchArea;

      const q = stationSearchQuery.toLowerCase();
      const matchSearch =
        (st.code && st.code.toLowerCase().includes(q)) ||
        st.name.toLowerCase().includes(q) ||
        (area && area.name.toLowerCase().includes(q)) ||
        (cv && cv.name.toLowerCase().includes(q)) ||
        st.id.toLowerCase().includes(q);

      return matchArea && matchSearch;
    });
  }, [appState.stations, appState.areas, appState.conveyors, selectedAreaFilter, stationSearchQuery]);

  const paginatedStations = useMemo(() => {
    const start = (stationPage - 1) * stationPageSize;
    return filteredStations.slice(start, start + stationPageSize);
  }, [filteredStations, stationPage, stationPageSize]);

  // Batch Add Station Handlers
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

  const handleUpdateRow = (rowId: string, field: "code" | "name", val: string) => {
    setStationRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)),
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

    const validRows = stationRows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      toast.error("Minimal satu baris nama stasiun harus diisi");
      return;
    }

    const area = store.ensureArea(areaInput);
    const conveyor = store.ensureConveyor(conveyorInput, area.id);

    const stationsToAdd = validRows.map((r, idx) => ({
      code: r.code.trim().toUpperCase() || `ST-${appState.stations.length + idx + 1}`,
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

  // Edit Single Station Handlers
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

  const handleConfirmDeleteStation = () => {
    if (!deleteStationTarget) return;
    store.deleteStation(deleteStationTarget.id);
    toast.success(`Stasiun ${deleteStationTarget.name} berhasil dihapus`);
    setDeleteStationTarget(null);
  };

  // ==========================================
  // CATEGORY STATE & HANDLERS
  // ==========================================
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "breakdown" | "non-breakdown">("all");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  // Modal: Add Category
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);
  const [catCodeInput, setCatCodeInput] = useState("");
  const [catNameInput, setCatNameInput] = useState("");
  const [catBreakdownInput, setCatBreakdownInput] = useState(false);
  const [catDowntimeInput, setCatDowntimeInput] = useState(true);
  const [catActiveInput, setCatActiveInput] = useState(true);

  // Modal: Edit Category
  const [editCatModalOpen, setEditCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatCode, setEditCatCode] = useState("");
  const [editCatName, setEditCatName] = useState("");
  const [editCatBreakdown, setEditCatBreakdown] = useState(false);
  const [editCatDowntime, setEditCatDowntime] = useState(true);
  const [editCatActive, setEditCatActive] = useState(true);

  // Modal: Delete Category
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return appState.categories.filter((cat) => {
      if (categoryFilter === "breakdown" && !cat.countsAsBreakdown) return false;
      if (categoryFilter === "non-breakdown" && cat.countsAsBreakdown) return false;

      if (!categorySearchQuery.trim()) return true;

      const q = categorySearchQuery.toLowerCase();
      const codeMatch = cat.code ? cat.code.toLowerCase().includes(q) : false;
      const nameMatch = cat.name.toLowerCase().includes(q);
      const idMatch = cat.id.toLowerCase().includes(q);

      return codeMatch || nameMatch || idMatch;
    });
  }, [appState.categories, categoryFilter, categorySearchQuery]);

  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return filteredCategories.slice(start, start + categoryPageSize);
  }, [filteredCategories, categoryPage, categoryPageSize]);

  // Open Add Category Modal
  const handleOpenAddCategory = () => {
    const nextNum = appState.categories.length + 1;
    setCatCodeInput(`CAT-${String(nextNum).padStart(2, "0")}`);
    setCatNameInput("");
    setCatBreakdownInput(false);
    setCatDowntimeInput(true);
    setCatActiveInput(true);
    setAddCatModalOpen(true);
  };

  const handleCatNameChange = (val: string) => {
    setCatNameInput(val);
    if (val.toLowerCase().includes("breakdown") || val.toLowerCase().includes("rusak")) {
      setCatBreakdownInput(true);
    }
  };

  const handleCatCodeChange = (val: string) => {
    setCatCodeInput(val.toUpperCase());
    if (val.toLowerCase().includes("brk") || val.toLowerCase().includes("breakdown")) {
      setCatBreakdownInput(true);
    }
  };

  const handleSaveNewCategory = () => {
    if (!catNameInput.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    const code = catCodeInput.trim().toUpperCase() || `CAT-${catNameInput.slice(0, 4).toUpperCase()}`;

    store.addCategory({
      code,
      name: catNameInput.trim(),
      countsAsBreakdown: catBreakdownInput,
      countsAsDowntime: catDowntimeInput,
      active: catActiveInput,
      custom: true,
    });

    toast.success(`Kategori "${catNameInput.trim()}" (${code}) berhasil ditambahkan`);
    setAddCatModalOpen(false);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatCode(cat.code || `CAT-${cat.name.slice(0, 4).toUpperCase().replace(/\s/g, "")}`);
    setEditCatName(cat.name);
    setEditCatBreakdown(cat.countsAsBreakdown);
    setEditCatDowntime(cat.countsAsDowntime);
    setEditCatActive(cat.active);
    setEditCatModalOpen(true);
  };

  const handleSaveEditCategory = () => {
    if (!editingCategory) return;
    if (!editCatName.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    store.updateCategory(editingCategory.id, {
      code: editCatCode.trim().toUpperCase(),
      name: editCatName.trim(),
      countsAsBreakdown: editCatBreakdown,
      countsAsDowntime: editCatDowntime,
      active: editCatActive,
    });

    toast.success(`Kategori "${editCatName.trim()}" berhasil diperbarui`);
    setEditCatModalOpen(false);
    setEditingCategory(null);
  };

  const handleConfirmDeleteCategory = () => {
    if (!deleteCatTarget) return;
    store.deleteCategory(deleteCatTarget.id);
    toast.success(`Kategori "${deleteCatTarget.name}" berhasil dihapus`);
    setDeleteCatTarget(null);
  };

  const linkedStopsCount = deleteCatTarget
    ? appState.stops.filter((s) => s.categoryId === deleteCatTarget.id).length
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("md.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Konfigurasi Area, Jalur Konveyor, Stasiun Produksi, dan Kategori Stop (MTTR & MTBF).
          </p>
        </div>

        {/* Action Button depending on Active Tab */}
        {activeTab === "stations" ? (
          <button
            onClick={handleOpenBatchModal}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Data Stasiun</span>
          </button>
        ) : (
          <button
            onClick={handleOpenAddCategory}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t("md.addCategory")}</span>
          </button>
        )}
      </div>

      {/* Navigation Tab Bar: Stations vs Categories */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("stations")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-bold transition-all shadow-2xs ${
            activeTab === "stations"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Workflow className="h-4 w-4" />
          <span>{t("md.tab.stations")} ({appState.stations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-bold transition-all shadow-2xs ${
            activeTab === "categories"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Tag className="h-4 w-4" />
          <span>{t("md.tab.categories")} ({appState.categories.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MASTER DATA STATIONS                              */}
      {/* ======================================================== */}
      {activeTab === "stations" && (
        <div className="space-y-6">
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

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Area Filter */}
                <div className="w-48 sm:w-56">
                  <SelectInput
                    hideClear
                    value={selectedAreaFilter}
                    onChange={(val) => setSelectedAreaFilter(val ?? "all")}
                    datalist={[
                      { value: "all", label: `Semua Area (${appState.areas.length})` },
                      ...appState.areas.map((a) => ({
                        value: a.id,
                        label: a.name,
                      })),
                    ]}
                    placeholder="Pilih Area"
                  />
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={stationSearchQuery}
                    onChange={(e) => setStationSearchQuery(e.target.value)}
                    placeholder="Cari kode, nama stasiun, konveyor..."
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs font-mono focus:outline-none focus:border-ring"
                  />
                  {stationSearchQuery && (
                    <button
                      onClick={() => setStationSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3.5 px-4 w-28 whitespace-nowrap">ACTION</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        KODE STASIUN
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA STASIUN
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA AREA
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        KONVEYOR
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        THRESHOLD
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-center w-28 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        STATUS LIVE
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {paginatedStations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">Tidak ada data stasiun ditemukan</p>
                        <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter area Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedStations.map((st) => {
                      const area = appState.areas.find((a) => a.id === st.areaId);
                      const cv = appState.conveyors.find((c) => c.id === st.conveyorId);
                      const live = appState.stationLive[st.id];
                      const isRunning = live?.state === "running";
                      const stationCode = st.code || st.name.split(" ")[0] || `ST-${st.sequence}`;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          {/* Action Column on Left (Sesuai Referensi Visual) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* View Button [ 👁 ] */}
                              <button
                                type="button"
                                onClick={() => setViewingStation(st)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 shadow-2xs transition-colors"
                                title="Lihat Detail Stasiun"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Button [ ✏ ] */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditStation(st)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 shadow-2xs transition-colors"
                                title="Ubah Stasiun"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button [ 🗑 ] */}
                              <button
                                type="button"
                                onClick={() => setDeleteStationTarget(st)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-red-600 hover:border-red-400 dark:hover:text-red-400 shadow-2xs transition-colors"
                                title="Hapus Stasiun"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Kode Stasiun */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 rounded font-mono font-bold bg-muted text-foreground border border-border text-xs">
                              {stationCode}
                            </span>
                          </td>

                          {/* Nama Stasiun */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground text-[13px]">
                              {st.name}
                            </div>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              ID: {st.id} • Urutan: {st.sequence}
                            </span>
                          </td>

                          {/* Nama Area */}
                          <td className="py-3.5 px-4 text-foreground font-medium whitespace-nowrap">
                            {area?.name ?? st.areaId}
                          </td>

                          {/* Nama Konveyor */}
                          <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Workflow className="h-3.5 w-3.5 text-cyan-500" />
                              {cv?.name ?? st.conveyorId}
                            </span>
                          </td>

                          {/* Threshold */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="text-foreground font-semibold font-mono">
                              {st.runningThreshold} {st.speedUnit}
                            </span>
                          </td>

                          {/* Status Live */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isRunning
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isRunning ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              {isRunning ? "RUNNING" : "STOPPED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <TablePagination
              page={stationPage}
              pageSize={stationPageSize}
              totalItems={filteredStations.length}
              onPageChange={setStationPage}
              onPageSizeChange={setStationPageSize}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MASTER DATA CATEGORIES (MTTR & MTBF)              */}
      {/* ======================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          {/* Summary KPI Strip for Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Card 1: Total Kategori */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                    Total Kategori
                  </span>
                  <span className="font-mono text-2xl font-black text-foreground">
                    {appState.categories.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Breakdown (MTTR & MTBF) */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-xs text-rose-600 dark:text-rose-400 block uppercase font-bold">
                    Breakdown (MTTR & MTBF)
                  </span>
                  <span className="font-mono text-2xl font-black text-rose-600 dark:text-rose-400">
                    {appState.categories.filter((c) => c.countsAsBreakdown).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Non-Breakdown (Normal Stops) */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                    Non-Breakdown (Normal)
                  </span>
                  <span className="font-mono text-2xl font-black text-foreground">
                    {appState.categories.filter((c) => !c.countsAsBreakdown).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Kategori Aktif */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-xs text-muted-foreground block uppercase font-bold">
                    Kategori Aktif
                  </span>
                  <span className="font-mono text-2xl font-black text-foreground">
                    {appState.categories.filter((c) => c.active).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Category Table Card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs space-y-0">
            {/* Toolbar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground font-semibold">
                  Menampilkan {filteredCategories.length} dari {appState.categories.length} kategori stop
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Breakdown Filter */}
                <div className="w-56 sm:w-64">
                  <SelectInput
                    hideClear
                    value={categoryFilter}
                    onChange={(val) => setCategoryFilter((val as any) ?? "all")}
                    datalist={[
                      { value: "all", label: "Semua Kategori" },
                      { value: "breakdown", label: "Hanya Breakdown (MTTR/MTBF)" },
                      { value: "non-breakdown", label: "Hanya Non-Breakdown" },
                    ]}
                    placeholder="Filter Kategori"
                  />
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Cari kode atau nama kategori..."
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs font-mono focus:outline-none focus:border-ring"
                  />
                  {categorySearchQuery && (
                    <button
                      onClick={() => setCategorySearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3.5 px-4 w-24 whitespace-nowrap">ACTION</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        KODE KATEGORI
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA KATEGORI
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        PERHITUNGAN MTTR & MTBF
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        DOWNTIME
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        STATUS
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {paginatedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground font-mono">
                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">Tidak ada kategori ditemukan</p>
                        <p className="text-xs mt-1">Gunakan tombol &quot;Tambah Kategori&quot; untuk menambahkan kategori stop baru.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((cat) => {
                      const catCode = cat.code || `CAT-${cat.name.slice(0, 4).toUpperCase().replace(/\s/g, "")}`;
                      return (
                        <tr key={cat.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          {/* Action Column on Left */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Edit Button [ ✏ ] */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditCategory(cat)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-400 dark:hover:text-blue-400 shadow-2xs transition-colors"
                                title="Ubah Kategori"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button [ 🗑 ] */}
                              <button
                                type="button"
                                onClick={() => setDeleteCatTarget(cat)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-red-600 hover:border-red-400 dark:hover:text-red-400 shadow-2xs transition-colors"
                                title="Hapus Kategori"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Kode Kategori */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded font-mono font-bold bg-muted text-foreground border border-border text-xs">
                              {catCode}
                            </span>
                          </td>

                          {/* Nama Kategori */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground text-[13px]">
                              {cat.name}
                            </div>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              ID: {cat.id}
                            </span>
                          </td>

                          {/* MTTR / MTBF Breakdown */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {cat.countsAsBreakdown ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>Dihitung (Breakdown MTTR/MTBF)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span>Non-Breakdown (Normal Stop)</span>
                              </span>
                            )}
                          </td>

                          {/* Downtime */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {cat.countsAsDowntime ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Kurangi Run Time
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground">
                                Terencana (Planned)
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                cat.active
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  cat.active ? "bg-emerald-500" : "bg-muted-foreground"
                                }`}
                              />
                              {cat.active ? "AKTIF" : "NONAKTIF"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <TablePagination
              page={categoryPage}
              pageSize={categoryPageSize}
              totalItems={filteredCategories.length}
              onPageChange={setCategoryPage}
              onPageSizeChange={setCategoryPageSize}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: BATCH ADD STATIONS UNDER AREA & CONVEYOR          */}
      {/* ======================================================== */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  Tambah Data Stasiun & Jalur Konveyor
                </h3>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
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

      {/* ======================================================== */}
      {/* MODAL: EDIT SINGLE STATION                               */}
      {/* ======================================================== */}
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
                  <SelectInput
                    label="Nama Area:"
                    value={editAreaId}
                    onChange={(val) => setEditAreaId(val ?? "")}
                    datalist={appState.areas.map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
                    hideClear
                    placeholder="Pilih Area"
                  />
                </div>

                <div>
                  <SelectInput
                    label="Nama Konveyor:"
                    value={editConveyorId}
                    onChange={(val) => setEditConveyorId(val ?? "")}
                    datalist={appState.conveyors.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    hideClear
                    placeholder="Pilih Konveyor"
                  />
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

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION (STATION)                     */}
      {/* ======================================================== */}
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
                onClick={handleConfirmDeleteStation}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500 shadow-2xs"
              >
                Ya, Hapus Stasiun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD CATEGORY (WITH MTTR & MTBF BREAKDOWN FLAG)    */}
      {/* ======================================================== */}
      {addCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  {t("md.addCategory")}
                </h3>
              </div>
              <button
                onClick={() => setAddCatModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Category Code */}
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Kode Kategori (Category Code):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: CAT-BRK, CAT-PROC, CAT-MAINT, CAT-PART"
                  value={catCodeInput}
                  onChange={(e) => handleCatCodeChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground font-bold uppercase placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* Category Name */}
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Nama Kategori (Category Name):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Breakdown, Process, Maintenance, Part Issue"
                  value={catNameInput}
                  onChange={(e) => handleCatNameChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* MTTR & MTBF Breakdown Flag Box */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catBreakdownInput}
                    onChange={(e) => setCatBreakdownInput(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="block font-bold text-rose-600 dark:text-rose-400">
                      Dihitung dalam MTTR & MTBF (Breakdown Category)
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                      {t("md.breakdownHint")}
                    </span>
                  </div>
                </label>
              </div>

              {/* Downtime Flag */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={catDowntimeInput}
                  onChange={(e) => setCatDowntimeInput(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">
                  Dihitung sebagai Downtime Produksi (Mengurangi Running Time)
                </span>
              </label>

              {/* Active Flag */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catActiveInput}
                  onChange={(e) => setCatActiveInput(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">
                  Kategori Aktif (Dapat dipilih oleh operator)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setAddCatModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNewCategory}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs transition-colors"
              >
                Simpan Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT CATEGORY                                     */}
      {/* ======================================================== */}
      {editCatModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="font-display text-base font-semibold text-foreground">
                Ubah Kategori Stop ({editingCategory.name})
              </h3>
              <button
                onClick={() => setEditCatModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">Kode Kategori:</label>
                <input
                  type="text"
                  value={editCatCode}
                  onChange={(e) => setEditCatCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: CAT-BRK"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground font-bold uppercase focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Nama Kategori:</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  placeholder="Contoh: Breakdown"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* MTTR & MTBF Breakdown Flag Box */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCatBreakdown}
                    onChange={(e) => setEditCatBreakdown(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="block font-bold text-rose-600 dark:text-rose-400">
                      Dihitung dalam MTTR & MTBF (Breakdown Category)
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                      {t("md.breakdownHint")}
                    </span>
                  </div>
                </label>
              </div>

              {/* Downtime Flag */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editCatDowntime}
                  onChange={(e) => setEditCatDowntime(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">
                  Dihitung sebagai Downtime Produksi (Mengurangi Running Time)
                </span>
              </label>

              {/* Active Flag */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editCatActive}
                  onChange={(e) => setEditCatActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">
                  Kategori Aktif
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setEditCatModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditCategory}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CATEGORY CONFIRMATION                      */}
      {/* ======================================================== */}
      {deleteCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">
                Hapus Kategori?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Apakah Anda yakin ingin menghapus kategori <strong className="text-foreground">{deleteCatTarget.name} ({deleteCatTarget.code || deleteCatTarget.id})</strong>?
            </p>

            {linkedStopsCount > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs mb-3">
                <strong>Perhatian:</strong> Kategori ini sedang digunakan oleh <strong>{linkedStopsCount}</strong> catatan line stop. Riwayat kejadian stop sebelumnya akan tetap tersimpan, namun kategori ini tidak dapat dipilih lagi di masa mendatang.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setDeleteCatTarget(null)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500 shadow-2xs"
              >
                Ya, Hapus Kategori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Detail Stasiun [ 👁 ] */}
      {viewingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Detail Data Stasiun</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {viewingStation.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStation(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Kode Stasiun</span>
                <span className="text-foreground font-bold text-xs">{viewingStation.code || viewingStation.id}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Nama Stasiun</span>
                <span className="text-foreground font-bold text-xs">{viewingStation.name}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Area</span>
                <span className="text-foreground font-semibold">
                  {appState.areas.find((a) => a.id === viewingStation.areaId)?.name ?? viewingStation.areaId}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Konveyor</span>
                <span className="text-foreground font-semibold">
                  {appState.conveyors.find((c) => c.id === viewingStation.conveyorId)?.name ?? viewingStation.conveyorId}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Ambang Kecepatan</span>
                <span className="text-foreground font-bold text-xs">
                  {viewingStation.runningThreshold} {viewingStation.speedUnit}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Urutan Konveyor</span>
                <span className="text-foreground font-semibold">#{viewingStation.sequence}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setViewingStation(null)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
