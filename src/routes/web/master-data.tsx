import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
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

interface ConveyorMasterRow {
  conveyorId: string;
  conveyorName: string;
  areaId: string;
  areaName: string;
  stations: Station[];
  isActive: boolean;
}

function MasterDataPage() {
  const { t } = useI18n();
  const appState = useAppStore();

  const location = useLocation();

  // Active View: "stations" | "categories" (driven by URL search param ?view=)
  const activeView = useMemo(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("view") === "categories") return "categories";
    }
    return "stations";
  }, [location.search]);

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
  const [viewingConveyorRow, setViewingConveyorRow] = useState<ConveyorMasterRow | null>(null);

  // Modal: Batch Add Stations under Area & Conveyor
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [areaInput, setAreaInput] = useState("PTED");
  const [conveyorInput, setConveyorInput] = useState("");
  const [stationRows, setStationRows] = useState<StationDraftRow[]>([
    { id: "row-1", code: "", name: "" },
    { id: "row-2", code: "", name: "" },
  ]);

  // Modal: Edit Conveyor & Stations (Requirement 1: Sama dengan pop up Tambah Data)
  const [editConveyorModalOpen, setEditConveyorModalOpen] = useState(false);
  const [editConveyorTarget, setEditConveyorTarget] = useState<ConveyorMasterRow | null>(null);
  const [editAreaInput, setEditAreaInput] = useState("");
  const [editConveyorInput, setEditConveyorInput] = useState("");
  const [editStationRows, setEditStationRows] = useState<StationDraftRow[]>([]);

  // Modal: Delete Conveyor Confirmation
  const [deleteConveyorTarget, setDeleteConveyorTarget] = useState<ConveyorMasterRow | null>(null);

  // Group stations by conveyor for table view
  const conveyorRows = useMemo<ConveyorMasterRow[]>(() => {
    const rows: ConveyorMasterRow[] = appState.conveyors.map((c) => {
      const area = appState.areas.find((a) => a.id === c.areaId);
      const stList = appState.stations
        .filter((s) => s.conveyorId === c.id)
        .sort((a, b) => a.sequence - b.sequence);
      const isActive = c.active !== false && (stList.length === 0 || stList.some((s) => s.active !== false));
      return {
        conveyorId: c.id,
        conveyorName: c.name,
        areaId: c.areaId,
        areaName: area?.name ?? c.areaId,
        stations: stList,
        isActive,
      };
    });

    // Also include any orphan stations whose conveyorId is not in conveyors list
    const registeredCvIds = new Set(appState.conveyors.map((c) => c.id));
    const orphanMap = new Map<string, Station[]>();
    for (const st of appState.stations) {
      if (!registeredCvIds.has(st.conveyorId)) {
        const list = orphanMap.get(st.conveyorId) || [];
        list.push(st);
        orphanMap.set(st.conveyorId, list);
      }
    }

    for (const [cvId, stList] of orphanMap.entries()) {
      const first = stList[0]!;
      const area = appState.areas.find((a) => a.id === first.areaId);
      stList.sort((a, b) => a.sequence - b.sequence);
      rows.push({
        conveyorId: cvId,
        conveyorName: cvId,
        areaId: first.areaId,
        areaName: area?.name ?? first.areaId,
        stations: stList,
        isActive: stList.some((s) => s.active !== false),
      });
    }

    return rows;
  }, [appState.conveyors, appState.areas, appState.stations]);

  // Filtered conveyor rows for display
  const filteredConveyorRows = useMemo(() => {
    return conveyorRows.filter((row) => {
      const matchArea = selectedAreaFilter === "all" || row.areaId === selectedAreaFilter;
      if (!stationSearchQuery.trim()) return matchArea;

      const q = stationSearchQuery.toLowerCase();
      const matchSearch =
        row.conveyorName.toLowerCase().includes(q) ||
        row.areaName.toLowerCase().includes(q) ||
        row.stations.some(
          (st) =>
            (st.code && st.code.toLowerCase().includes(q)) ||
            st.name.toLowerCase().includes(q)
        );

      return matchArea && matchSearch;
    });
  }, [conveyorRows, selectedAreaFilter, stationSearchQuery]);

  const paginatedConveyorRows = useMemo(() => {
    const start = (stationPage - 1) * stationPageSize;
    return filteredConveyorRows.slice(start, start + stationPageSize);
  }, [filteredConveyorRows, stationPage, stationPageSize]);

  // Batch Add Station Handlers
  const handleOpenBatchModal = () => {
    const defaultArea = appState.areas[0]?.name ?? "PTED";
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
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, code: nextCode, name: "" },
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
      active: true,
    }));

    store.addStationsBatch(stationsToAdd);
    toast.success(`Berhasil menambahkan ${stationsToAdd.length} stasiun baru pada ${conveyor.name}`);
    setBatchModalOpen(false);
  };

  // Edit Conveyor & Stations Handlers (Requirement 1: Sama dengan pop up Tambah Data)
  const handleOpenEditConveyor = (row: ConveyorMasterRow) => {
    setEditConveyorTarget(row);
    setEditAreaInput(row.areaName);
    setEditConveyorInput(row.conveyorName);
    const mappedRows: StationDraftRow[] =
      row.stations.length > 0
        ? row.stations.map((st) => ({
            id: st.id,
            code: st.code || `ST-${String(st.sequence).padStart(2, "0")}`,
            name: st.name,
          }))
        : [{ id: `row-${Date.now()}-1`, code: "ST-01", name: "" }];
    setEditStationRows(mappedRows);
    setEditConveyorModalOpen(true);
  };

  const handleAddEditStationRow = () => {
    const nextNum = editStationRows.length + 1;
    const nextCode = `ST-${String(nextNum).padStart(2, "0")}`;
    setEditStationRows((prev) => [
      ...prev,
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, code: nextCode, name: "" },
    ]);
  };

  const handleRemoveEditStationRow = (rowId: string) => {
    if (editStationRows.length <= 1) {
      toast.warning("Minimal harus ada satu stasiun");
      return;
    }
    setEditStationRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleUpdateEditRow = (rowId: string, field: "code" | "name", val: string) => {
    setEditStationRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)),
    );
  };

  const handleSaveEditConveyor = () => {
    if (!editConveyorTarget) return;
    if (!editAreaInput.trim()) {
      toast.error("Nama Area wajib diisi");
      return;
    }
    if (!editConveyorInput.trim()) {
      toast.error("Nama Konveyor wajib diisi");
      return;
    }

    const validRows = editStationRows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      toast.error("Minimal satu baris nama stasiun harus diisi");
      return;
    }

    const area = store.ensureArea(editAreaInput);
    store.updateConveyor(editConveyorTarget.conveyorId, {
      name: editConveyorInput.trim(),
      areaId: area.id,
    });

    store.syncConveyorStations(editConveyorTarget.conveyorId, area.id, validRows);

    toast.success(`Berhasil memperbarui data stasiun dan jalur konveyor pada ${editConveyorInput.trim()}`);
    setEditConveyorModalOpen(false);
    setEditConveyorTarget(null);
  };

  const handleConfirmDeleteConveyor = () => {
    if (!deleteConveyorTarget) return;
    store.deleteConveyor(deleteConveyorTarget.conveyorId);
    toast.success(`Jalur konveyor "${deleteConveyorTarget.conveyorName}" beserta stasiunnya berhasil dihapus`);
    setDeleteConveyorTarget(null);
  };

  // ==========================================
  // CATEGORY STATE & HANDLERS
  // ==========================================
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "breakdown" | "non-breakdown">("all");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  // Modal: Add Category Problem
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);
  const [catCodeInput, setCatCodeInput] = useState("");
  const [catNameInput, setCatNameInput] = useState("");
  const [catForLinestop, setCatForLinestop] = useState(true);
  const [catForLinestopMtc, setCatForLinestopMtc] = useState(false);
  const [catBreakdownInput, setCatBreakdownInput] = useState(false);
  const [catDowntimeInput, setCatDowntimeInput] = useState(true);
  const [catActiveInput, setCatActiveInput] = useState(true);

  // Modal: Edit Category Problem
  const [editCatModalOpen, setEditCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatCode, setEditCatCode] = useState("");
  const [editCatName, setEditCatName] = useState("");
  const [editCatForLinestop, setEditCatForLinestop] = useState(true);
  const [editCatForLinestopMtc, setEditCatForLinestopMtc] = useState(false);
  const [editCatBreakdown, setEditCatBreakdown] = useState(false);
  const [editCatDowntime, setEditCatDowntime] = useState(true);
  const [editCatActive, setEditCatActive] = useState(true);

  // Filter for Category Problem
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<"all" | "linestop" | "mtc" | "both">("all");

  // Modal: Delete Category
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return appState.categories.filter((cat) => {
      if (categoryTypeFilter === "linestop" && cat.forLinestop === false) return false;
      if (categoryTypeFilter === "mtc" && !cat.forLinestopMaintenance) return false;
      if (categoryTypeFilter === "both" && (cat.forLinestop === false || !cat.forLinestopMaintenance)) return false;

      if (categoryFilter === "breakdown" && !cat.countsAsBreakdown) return false;
      if (categoryFilter === "non-breakdown" && cat.countsAsBreakdown) return false;

      if (!categorySearchQuery.trim()) return true;

      const q = categorySearchQuery.toLowerCase();
      const codeMatch = cat.code ? cat.code.toLowerCase().includes(q) : false;
      const nameMatch = cat.name.toLowerCase().includes(q);
      const idMatch = cat.id.toLowerCase().includes(q);

      return codeMatch || nameMatch || idMatch;
    });
  }, [appState.categories, categoryTypeFilter, categoryFilter, categorySearchQuery]);

  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return filteredCategories.slice(start, start + categoryPageSize);
  }, [filteredCategories, categoryPage, categoryPageSize]);

  // Open Add Category Modal
  const handleOpenAddCategory = () => {
    const nextNum = appState.categories.length + 1;
    setCatCodeInput(`LS-${String(nextNum).padStart(2, "0")}`);
    setCatNameInput("");
    setCatForLinestop(true);
    setCatForLinestopMtc(false);
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
      toast.error("Nama category problem wajib diisi");
      return;
    }
    if (!catForLinestop && !catForLinestopMtc) {
      toast.error("Pilih minimal satu tipe E-Form (Linestop atau Linestop Maintenance)");
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
      forLinestop: catForLinestop,
      forLinestopMaintenance: catForLinestopMtc,
    });

    toast.success(`Category Problem "${catNameInput.trim()}" (${code}) berhasil ditambahkan`);
    setAddCatModalOpen(false);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatCode(cat.code || `CAT-${cat.name.slice(0, 4).toUpperCase().replace(/\s/g, "")}`);
    setEditCatName(cat.name);
    setEditCatForLinestop(cat.forLinestop !== false);
    setEditCatForLinestopMtc(cat.forLinestopMaintenance === true);
    setEditCatBreakdown(cat.countsAsBreakdown);
    setEditCatDowntime(cat.countsAsDowntime);
    setEditCatActive(cat.active);
    setEditCatModalOpen(true);
  };

  const handleSaveEditCategory = () => {
    if (!editingCategory) return;
    if (!editCatName.trim()) {
      toast.error("Nama category problem wajib diisi");
      return;
    }
    if (!editCatForLinestop && !editCatForLinestopMtc) {
      toast.error("Pilih minimal satu tipe E-Form (Linestop atau Linestop Maintenance)");
      return;
    }

    store.updateCategory(editingCategory.id, {
      code: editCatCode.trim().toUpperCase(),
      name: editCatName.trim(),
      countsAsBreakdown: editCatBreakdown,
      countsAsDowntime: editCatDowntime,
      active: editCatActive,
      forLinestop: editCatForLinestop,
      forLinestopMaintenance: editCatForLinestopMtc,
    });

    toast.success(`Category Problem "${editCatName.trim()}" berhasil diperbarui`);
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
    <div className="space-y-6 w-full">
      {/* Page Title & Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {activeView === "categories" ? "Master Data — Category Problem" : "Master Data — Stasiun & Area"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeView === "categories"
              ? "Konfigurasi Kode Kategori Masalah dan Relasi Tipe E-Form (Linestop & Linestop Maintenance)."
              : "Konfigurasi Area, Jalur Konveyor, dan Stasiun Produksi Pabrik."}
          </p>
        </div>

        {/* Action Button depending on Active View */}
        {activeView === "stations" ? (
          <button
            onClick={handleOpenBatchModal}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Data Stasiun</span>
          </button>
        ) : (
          <button
            onClick={handleOpenAddCategory}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Category Problem</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: MASTER DATA STATIONS & AREA                      */}
      {/* ======================================================== */}
      {activeView === "stations" && (
        <div className="space-y-6">
          {/* Main Station Master Table Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs space-y-0">
            {/* Toolbar: Search & Area Filter */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Menampilkan {filteredConveyorRows.length} dari {conveyorRows.length} jalur konveyor ({appState.stations.length} total stasiun)
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
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={stationSearchQuery}
                    onChange={(e) => setStationSearchQuery(e.target.value)}
                    placeholder="Cari kode, nama stasiun, konveyor..."
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 dark:border-zinc-700/80 bg-background text-foreground placeholder:text-slate-400 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                  {stationSearchQuery && (
                    <button
                      onClick={() => setStationSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table: ACTION, NAMA AREA, NAMA KONVEYOR, NAMA STASIUN, STATUS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800/80 bg-[#f8fafc] dark:bg-[#121c2d] font-sans text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3 px-4 w-28 whitespace-nowrap">ACTION</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA AREA
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA KONVEYOR
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA STASIUN
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center w-36 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        STATUS
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {paginatedConveyorRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground font-mono">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">Tidak ada data stasiun atau konveyor ditemukan</p>
                        <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter area Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedConveyorRows.map((row) => {
                      const stationText =
                        row.stations.length === 0
                          ? "-"
                          : row.stations
                              .map(
                                (st) =>
                                  `(${st.code || `ST-${String(st.sequence).padStart(2, "0")}`} - ${st.name})`,
                              )
                              .join(", ");

                      return (
                        <tr
                          key={row.conveyorId}
                          className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          {/* Action Column on Left */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* View Button [ 👁 ] */}
                              <button
                                type="button"
                                onClick={() => setViewingConveyorRow(row)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600 shadow-2xs transition-colors"
                                title="Lihat Detail Jalur Konveyor & Stasiun"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Button [ ✏ ] */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditConveyor(row)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 shadow-2xs transition-colors"
                                title="Ubah Stasiun & Jalur Konveyor"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button [ 🗑 ] */}
                              <button
                                type="button"
                                onClick={() => setDeleteConveyorTarget(row)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 shadow-2xs transition-colors"
                                title="Hapus Jalur Konveyor & Stasiun"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Nama Area */}
                          <td className="py-3.5 px-4 text-foreground font-semibold whitespace-nowrap">
                            {row.areaName}
                          </td>

                          {/* Nama Konveyor */}
                          <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                              <Workflow className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                              {row.conveyorName}
                            </span>
                          </td>

                          {/* Nama Stasiun (Format: (ST-001 - Station Name), koma jika > 1) */}
                          <td className="py-3.5 px-4 text-foreground">
                            <div className="font-mono text-xs leading-relaxed max-w-xl">
                              {stationText}
                            </div>
                          </td>

                          {/* Status Live diganti jadi Toggle Switch Active & Inactive */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={row.isActive}
                                onClick={() => {
                                  store.toggleConveyorActive(row.conveyorId);
                                  toast.success(
                                    `Status konveyor "${row.conveyorName}" diubah menjadi ${!row.isActive ? "Aktif" : "Nonaktif"}`,
                                  );
                                }}
                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                  row.isActive ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                                }`}
                                title={row.isActive ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
                              >
                                <span className="sr-only">Toggle status konveyor</span>
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    row.isActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-bold font-mono ${
                                  row.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                }`}
                              >
                                {row.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
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
              totalItems={filteredConveyorRows.length}
              onPageChange={setStationPage}
              onPageSizeChange={setStationPageSize}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: MASTER DATA CATEGORY PROBLEM                     */}
      {/* ======================================================== */}
      {activeView === "categories" && (
        <div className="space-y-6">
          {/* Main Category Table Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#0b1320] overflow-hidden shadow-xs space-y-0">
            {/* Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0b1320]">
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Menampilkan {filteredCategories.length} dari {appState.categories.length} category problem
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Tipe E-form Filter */}
                <div className="w-52 sm:w-60">
                  <SelectInput
                    hideClear
                    value={categoryTypeFilter}
                    onChange={(val) => setCategoryTypeFilter((val as any) ?? "all")}
                    datalist={[
                      { value: "all", label: "Semua Tipe E-Form" },
                      { value: "linestop", label: "Hanya Linestop" },
                      { value: "mtc", label: "Hanya Linestop Maintenance" },
                      { value: "both", label: "Kedua Tipe E-Form" },
                    ]}
                    placeholder="Filter Tipe E-Form"
                  />
                </div>

                {/* Breakdown Filter */}
                <div className="w-48 sm:w-56">
                  <SelectInput
                    hideClear
                    value={categoryFilter}
                    onChange={(val) => setCategoryFilter((val as any) ?? "all")}
                    datalist={[
                      { value: "all", label: "Semua Kategori" },
                      { value: "breakdown", label: "Breakdown (MTTR/MTBF)" },
                      { value: "non-breakdown", label: "Non-Breakdown" },
                    ]}
                    placeholder="Filter Breakdown"
                  />
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Cari kode atau nama category problem..."
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 dark:border-zinc-700/80 bg-background text-foreground placeholder:text-slate-400 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                  {categorySearchQuery && (
                    <button
                      onClick={() => setCategorySearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground"
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
                  <tr className="border-b border-slate-100 dark:border-zinc-800/80 bg-[#f8fafc] dark:bg-[#121c2d] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3 px-4 w-24 whitespace-nowrap">ACTION</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        KODE KATEGORI
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        NAMA CATEGORY PROBLEM
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        TIPE E-FORM
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        PERHITUNGAN MTTR & MTBF
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        STATUS
                        <ArrowUpDown className="h-3 w-3 text-slate-400/80" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                  {paginatedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground font-mono">
                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">Tidak ada category problem ditemukan</p>
                        <p className="text-xs mt-1">Gunakan tombol &quot;Tambah Category Problem&quot; untuk menambahkan data baru.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((cat) => {
                      const catCode = cat.code || `CAT-${cat.name.slice(0, 4).toUpperCase().replace(/\s/g, "")}`;
                      return (
                        <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                          {/* Action Column on Left */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Edit Button [ ✏ ] */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditCategory(cat)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 shadow-2xs transition-colors cursor-pointer"
                                title="Ubah Category Problem"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button [ 🗑 ] */}
                              <button
                                type="button"
                                onClick={() => setDeleteCatTarget(cat)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 shadow-2xs transition-colors cursor-pointer"
                                title="Hapus Category Problem"
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

                          {/* Nama Category Problem */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground text-[13px]">
                              {cat.name}
                            </div>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              ID: {cat.id}
                            </span>
                          </td>

                          {/* Tipe E-Form */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {cat.forLinestop !== false && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Linestop
                                </span>
                              )}
                              {cat.forLinestopMaintenance === true && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60">
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                                  Linestop Maintenance
                                </span>
                              )}
                              {cat.forLinestop === false && !cat.forLinestopMaintenance && (
                                <span className="text-muted-foreground text-xs italic">-</span>
                              )}
                            </div>
                          </td>

                          {/* MTTR / MTBF Breakdown */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {cat.countsAsBreakdown ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>Breakdown</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                <CheckCircle2 className="h-3 w-3 shrink-0 text-slate-400" />
                                <span>Non-Breakdown</span>
                              </span>
                            )}
                          </td>

                          {/* Status Live diganti jadi Toggle Switch Active & Inactive */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={cat.active}
                                onClick={() => {
                                  store.updateCategory(cat.id, { active: !cat.active });
                                  toast.success(
                                    `Status "${cat.name}" diubah menjadi ${!cat.active ? "Aktif" : "Nonaktif"}`,
                                  );
                                }}
                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
                                  cat.active ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                                }`}
                                title={cat.active ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
                              >
                                <span className="sr-only">Toggle status kategori</span>
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    cat.active ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-bold font-mono ${
                                  cat.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                }`}
                              >
                                {cat.active ? "Active" : "Inactive"}
                              </span>
                            </div>
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
      {/* MODAL: EDIT CONVEYOR & STATIONS (SAMA DENGAN TAMBAH DATA) */}
      {/* ======================================================== */}
      {editConveyorModalOpen && editConveyorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  Ubah Data Stasiun & Jalur Konveyor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditConveyorModalOpen(false);
                  setEditConveyorTarget(null);
                }}
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
                  list="edit-area-suggestions"
                  placeholder="Contoh: Main Assembly Line"
                  value={editAreaInput}
                  onChange={(e) => setEditAreaInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
                <datalist id="edit-area-suggestions">
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
                  list="edit-conveyor-suggestions"
                  placeholder="Contoh: Conveyor CV-01"
                  value={editConveyorInput}
                  onChange={(e) => setEditConveyorInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
                <datalist id="edit-conveyor-suggestions">
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
                      3. Daftar Stasiun ({editStationRows.length} baris):
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Tambah, edit, atau hapus stasiun dalam jalur konveyor ini.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEditStationRow}
                    className="flex items-center gap-1 rounded bg-muted hover:bg-muted/80 text-foreground px-2.5 py-1 text-[11px] font-semibold border border-border transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editStationRows.map((row, index) => (
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
                          onChange={(e) => handleUpdateEditRow(row.id, "code", e.target.value)}
                          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-foreground font-bold uppercase focus:outline-none focus:border-ring"
                        />
                      </div>
                      {/* Station Name */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Nama Stasiun"
                          value={row.name}
                          onChange={(e) => handleUpdateEditRow(row.id, "name", e.target.value)}
                          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:border-ring"
                        />
                      </div>
                      {/* Delete Row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveEditStationRow(row.id)}
                        disabled={editStationRows.length <= 1}
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
                onClick={() => {
                  setEditConveyorModalOpen(false);
                  setEditConveyorTarget(null);
                }}
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditConveyor}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs transition-colors"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION (CONVEYOR)                    */}
      {/* ======================================================== */}
      {deleteConveyorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">
                Hapus Jalur Konveyor?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Apakah Anda yakin ingin menghapus jalur konveyor <strong className="text-foreground">{deleteConveyorTarget.conveyorName}</strong> di area <strong className="text-foreground">{deleteConveyorTarget.areaName}</strong> beserta <strong className="text-foreground">{deleteConveyorTarget.stations.length} stasiun</strong> di dalamnya?
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteConveyorTarget(null)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConveyor}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500 shadow-2xs"
              >
                Ya, Hapus Konveyor & Stasiun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD CATEGORY PROBLEM                              */}
      {/* ======================================================== */}
      {addCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">
                  Tambah Category Problem
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
                  placeholder="Contoh: LS-05, LM-02, CAT-BRK"
                  value={catCodeInput}
                  onChange={(e) => handleCatCodeChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground font-bold uppercase placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* Category Name */}
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Nama Category Problem:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Full cabin in line, Dock pin stuck, Sensor jam"
                  value={catNameInput}
                  onChange={(e) => handleCatNameChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* Type E-Form Checkbox Buttons (Linestop, Linestop Maintenance, or Both) */}
              <div>
                <label className="block text-foreground font-semibold mb-2">
                  Tipe Formulir E-Form:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                  {/* Button 1: Linestop */}
                  <button
                    type="button"
                    onClick={() => setCatForLinestop(!catForLinestop)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      catForLinestop
                        ? "border-amber-500 bg-amber-500/10 shadow-2xs"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        catForLinestop
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "border-muted-foreground"
                      }`}
                    >
                      {catForLinestop && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${catForLinestop ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                        Linestop
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Tersedia pada form Line Stop produksi
                      </span>
                    </div>
                  </button>

                  {/* Button 2: Linestop Maintenance */}
                  <button
                    type="button"
                    onClick={() => setCatForLinestopMtc(!catForLinestopMtc)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      catForLinestopMtc
                        ? "border-cyan-500 bg-cyan-500/10 shadow-2xs"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        catForLinestopMtc
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-muted-foreground"
                      }`}
                    >
                      {catForLinestopMtc && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${catForLinestopMtc ? "text-cyan-600 dark:text-cyan-400" : "text-foreground"}`}>
                        Linestop Maintenance
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Tersedia pada form teknisi Maintenance
                      </span>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 font-sans">
                  * Bisa pilih salah satu tipe E-Form, atau centang kedua-duanya sekaligus.
                </p>
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
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5 font-sans">
                      {t("md.breakdownHint")}
                    </span>
                  </div>
                </label>
              </div>

              {/* Active Flag */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catActiveInput}
                  onChange={(e) => setCatActiveInput(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground">
                  Kategori Aktif (Dapat dipilih pada formulir iPad)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setAddCatModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNewCategory}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs transition-colors cursor-pointer"
              >
                Simpan Category Problem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT CATEGORY PROBLEM                             */}
      {/* ======================================================== */}
      {editCatModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="font-display text-base font-semibold text-foreground">
                Ubah Category Problem ({editingCategory.name})
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
                  placeholder="Contoh: LS-01, LM-01"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground font-bold uppercase focus:outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Nama Category Problem:</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  placeholder="Contoh: Full cabin in line"
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground focus:outline-none focus:border-ring"
                />
              </div>

              {/* Type E-Form Checkbox Buttons (Linestop, Linestop Maintenance, or Both) */}
              <div>
                <label className="block text-foreground font-semibold mb-2">
                  Tipe Formulir E-Form:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                  {/* Button 1: Linestop */}
                  <button
                    type="button"
                    onClick={() => setEditCatForLinestop(!editCatForLinestop)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editCatForLinestop
                        ? "border-amber-500 bg-amber-500/10 shadow-2xs"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        editCatForLinestop
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "border-muted-foreground"
                      }`}
                    >
                      {editCatForLinestop && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${editCatForLinestop ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                        Linestop
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Tersedia pada form Line Stop produksi
                      </span>
                    </div>
                  </button>

                  {/* Button 2: Linestop Maintenance */}
                  <button
                    type="button"
                    onClick={() => setEditCatForLinestopMtc(!editCatForLinestopMtc)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      editCatForLinestopMtc
                        ? "border-cyan-500 bg-cyan-500/10 shadow-2xs"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        editCatForLinestopMtc
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-muted-foreground"
                      }`}
                    >
                      {editCatForLinestopMtc && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${editCatForLinestopMtc ? "text-cyan-600 dark:text-cyan-400" : "text-foreground"}`}>
                        Linestop Maintenance
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        Tersedia pada form teknisi Maintenance
                      </span>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 font-sans">
                  * Bisa pilih salah satu tipe E-Form, atau centang kedua-duanya sekaligus.
                </p>
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
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5 font-sans">
                      {t("md.breakdownHint")}
                    </span>
                  </div>
                </label>
              </div>

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
                className="px-4 py-2 rounded-lg border border-border font-mono text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditCategory}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CATEGORY PROBLEM CONFIRMATION              */}
      {/* ======================================================== */}
      {deleteCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-base font-bold text-foreground">
                Hapus Category Problem?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Apakah Anda yakin ingin menghapus category problem <strong className="text-foreground">{deleteCatTarget.name} ({deleteCatTarget.code || deleteCatTarget.id})</strong>?
            </p>

            {linkedStopsCount > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs mb-3">
                <strong>Perhatian:</strong> Kategori ini sedang digunakan oleh <strong>{linkedStopsCount}</strong> catatan line stop. Riwayat kejadian stop sebelumnya akan tetap tersimpan, namun kategori ini tidak dapat dipilih lagi di masa mendatang.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setDeleteCatTarget(null)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 rounded bg-rose-600 text-white font-semibold font-mono text-xs hover:bg-rose-500 shadow-2xs cursor-pointer"
              >
                Ya, Hapus Category Problem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Detail Konveyor & Stasiun [ 👁 ] */}
      {viewingConveyorRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Detail Jalur Konveyor & Stasiun</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {viewingConveyorRow.conveyorId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingConveyorRow(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Nama Area</span>
                <span className="text-foreground font-bold text-xs">{viewingConveyorRow.areaName}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Nama Konveyor</span>
                <span className="text-foreground font-bold text-xs">{viewingConveyorRow.conveyorName}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Status Konveyor</span>
                <span className={`font-bold text-xs ${viewingConveyorRow.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {viewingConveyorRow.isActive ? "Aktif (Active)" : "Nonaktif (Inactive)"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Stasiun</span>
                <span className="text-foreground font-bold text-xs">{viewingConveyorRow.stations.length} Stasiun</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-foreground font-semibold mb-2 font-mono text-xs">
                Daftar Stasiun ({viewingConveyorRow.stations.length}):
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {viewingConveyorRow.stations.length === 0 ? (
                  <p className="text-muted-foreground italic font-mono text-[11px]">Belum ada stasiun terdaftar pada konveyor ini.</p>
                ) : (
                  viewingConveyorRow.stations.map((st, idx) => (
                    <div key={st.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60 font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-semibold">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground font-bold border border-border">
                          {st.code || `ST-${String(st.sequence).padStart(2, "0")}`}
                        </span>
                        <span className="text-foreground font-semibold">{st.name}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${st.active !== false ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {st.active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setViewingConveyorRow(null)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs font-mono text-xs"
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
