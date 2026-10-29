import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Gauge,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAppStore, store } from "../../lib/store";
import type { ProductionRecord } from "../../lib/types";
import { computeOee, stopDurationMs, neutralizeExcelCell } from "../../lib/calc";
import { toast } from "sonner";
import { SelectInput } from "../../components/ui/select-input";
import { TablePagination } from "../../components/TablePagination";
import { ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/web/production")({
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Production Data & OEE Calculation" },
      { name: "description", content: "Upload factory production records and calculate automated OEE." },
    ],
  }),
  component: ProductionPage,
});

interface ParsedRow {
  rowNum: number;
  date: string;
  shiftId: string;
  shiftName: string;
  areaId: string;
  areaName: string;
  plannedMin: number;
  totalCount: number;
  goodCount: number;
  idealCycleSec: number;
  status: "valid" | "updated" | "rejected";
  errorReason?: string | undefined;
}

function ProductionPage() {
  const { t } = useI18n();
  const appState = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewRows, setPreviewRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(10);

  // Manual Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formShiftId, setFormShiftId] = useState(appState.shifts[0]?.id ?? "shift-1");
  const [formAreaId, setFormAreaId] = useState(appState.areas[0]?.id ?? "area-1");
  const [formPlannedMin, setFormPlannedMin] = useState(480);
  const [formTotalCount, setFormTotalCount] = useState(1300);
  const [formGoodCount, setFormGoodCount] = useState(1280);
  const [formIdealSec, setFormIdealSec] = useState(18);

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const headers = [
      ["Date", "Shift", "Area", "PlannedMin", "TotalCount", "GoodCount", "IdealCycleSec"],
      ["2026-10-28", "Shift 1 (Pagi)", "Main Assembly Line", 480, 1350, 1320, 18],
      ["2026-10-28", "Shift 2 (Siang)", "Main Assembly Line", 450, 1220, 1195, 18],
      ["2026-10-27", "Shift 1 (Pagi)", "Main Assembly Line", 480, 1330, 1310, 18],
    ];

    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production_Template");
    XLSX.writeFile(wb, "Template_Produksi_KRM.xlsx");
    toast.success("Template Excel berhasil diunduh");
  };

  // Upload & Parse Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        if (!wsName) {
          toast.error("File Excel tidak memiliki sheet yang valid");
          return;
        }
        const ws = wb.Sheets[wsName];
        if (!ws) return;
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawJson.length === 0) {
          toast.error("File Excel kosong");
          return;
        }

        const parsed: ParsedRow[] = [];

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2;
          const rawDate = String(row["Date"] || row["Tanggal"] || "").trim();
          const rawShift = String(row["Shift"] || "").trim().toLowerCase();
          const rawArea = String(row["Area"] || "").trim().toLowerCase();
          const plannedMin = Number(row["PlannedMin"] || row["WaktuTerencana"] || 0);
          const totalCount = Number(row["TotalCount"] || row["TotalProduksi"] || 0);
          const goodCount = Number(row["GoodCount"] || row["GoodProduksi"] || 0);
          const idealCycleSec = Number(row["IdealCycleSec"] || row["IdealCycle"] || 18);

          let errorReason: string | undefined;
          let status: "valid" | "updated" | "rejected" = "valid";

          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            errorReason = t("prod.error.date");
            status = "rejected";
          }

          const matchedShift = appState.shifts.find(
            (s) => s.id.toLowerCase() === rawShift || s.name.toLowerCase().includes(rawShift)
          );
          if (!matchedShift && !errorReason) {
            errorReason = t("prod.error.shift");
            status = "rejected";
          }

          const matchedArea = appState.areas.find(
            (a) => a.id.toLowerCase() === rawArea || a.name.toLowerCase().includes(rawArea)
          );
          if (!matchedArea && !errorReason) {
            errorReason = t("prod.error.area");
            status = "rejected";
          }

          if (isNaN(plannedMin) || isNaN(totalCount) || isNaN(goodCount)) {
            errorReason = t("prod.error.number");
            status = "rejected";
          } else if (plannedMin <= 0 || totalCount < 0 || goodCount < 0) {
            errorReason = t("prod.error.negative");
            status = "rejected";
          } else if (goodCount > totalCount) {
            errorReason = t("prod.error.goodGT");
            status = "rejected";
          }

          if (status === "valid" && matchedShift && matchedArea) {
            const exists = appState.productionRecords.some(
              (r) => r.date === rawDate && r.shiftId === matchedShift.id && r.areaId === matchedArea.id
            );
            if (exists) status = "updated";
          }

          parsed.push({
            rowNum,
            date: rawDate,
            shiftId: matchedShift?.id ?? rawShift,
            shiftName: matchedShift?.name ?? rawShift,
            areaId: matchedArea?.id ?? rawArea,
            areaName: matchedArea?.name ?? rawArea,
            plannedMin,
            totalCount,
            goodCount,
            idealCycleSec: idealCycleSec || 18,
            status,
            errorReason,
          });
        });

        setPreviewRows(parsed);
      } catch (err) {
        console.error(err);
        toast.error("Gagal membaca file Excel. Pastikan format file sesuai.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const validCount = previewRows?.filter((r) => r.status === "valid" || r.status === "updated").length ?? 0;
  const rejectedCount = previewRows?.filter((r) => r.status === "rejected").length ?? 0;

  const handleCommitPreview = () => {
    if (!previewRows) return;
    const toCommit = previewRows
      .filter((r) => r.status === "valid" || r.status === "updated")
      .map((r) => ({
        date: r.date,
        shiftId: r.shiftId,
        areaId: r.areaId,
        plannedMin: r.plannedMin,
        totalCount: r.totalCount,
        goodCount: r.goodCount,
        idealCycleSec: r.idealCycleSec,
      }));

    if (toCommit.length === 0) {
      toast.error("Tidak ada baris valid untuk disimpan");
      return;
    }

    store.commitProductionRecords(toCommit);
    toast.success(t("prod.committed"), {
      description: `${toCommit.length} baris data produksi berhasil diperbarui.`,
    });
    setPreviewRows(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleManualSubmit = () => {
    if (formGoodCount > formTotalCount) {
      toast.error(t("prod.error.goodGT"));
      return;
    }
    store.commitProductionRecords([
      {
        date: formDate,
        shiftId: formShiftId,
        areaId: formAreaId,
        plannedMin: formPlannedMin,
        totalCount: formTotalCount,
        goodCount: formGoodCount,
        idealCycleSec: formIdealSec,
      },
    ]);
    toast.success(t("prod.committed"));
    setManualModalOpen(false);
  };

  const sortedRecords = useMemo(() => {
    return [...appState.productionRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [appState.productionRecords]);

  const paginatedRecords = useMemo(() => {
    const s = (prodPage - 1) * prodPageSize;
    return sortedRecords.slice(s, s + prodPageSize);
  }, [sortedRecords, prodPage, prodPageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            {t("prod.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("prod.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            {t("prod.downloadTemplate")}
          </button>

          <button
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow transition-colors"
          >
            <Plus className="h-4 w-4" />
            Input Manual
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/20 hover:border-primary/40 transition-colors">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            {t("prod.upload")} (.xlsx, .xls, .csv)
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
            {t("prod.uploadHint")}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-file-input"
          />
          <label
            htmlFor="excel-file-input"
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Upload className="h-4 w-4" />
            {fileName ? `File terpilih: ${fileName}` : "Pilih Berkas Excel"}
          </label>
        </div>

        {/* Upload Preview Table */}
        {previewRows && (
          <div className="mt-6 border-t border-border pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {t("prod.preview")} — {fileName}
                </h4>
                <div className="flex items-center gap-3 font-mono text-xs mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{validCount} Valid</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">{rejectedCount} Ditolak</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewRows(null)}
                  className="px-3 py-1.5 rounded border border-border text-xs font-mono text-muted-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  onClick={handleCommitPreview}
                  disabled={validCount === 0}
                  className="px-4 py-1.5 rounded bg-emerald-600 text-white font-semibold text-xs font-mono hover:bg-emerald-500 disabled:opacity-40 transition-colors shadow-2xs"
                >
                  {t("prod.commit", { valid: validCount })}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground sticky top-0">
                  <tr>
                    <th className="py-2 px-3">{t("prod.rowNumber")}</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">{t("common.date")}</th>
                    <th className="py-2 px-3">Shift</th>
                    <th className="py-2 px-3">Area</th>
                    <th className="py-2 px-3">{t("prod.planned")}</th>
                    <th className="py-2 px-3">{t("prod.totalCount")}</th>
                    <th className="py-2 px-3">{t("prod.goodCount")}</th>
                    <th className="py-2 px-3">Catatan / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((r) => (
                    <tr key={r.rowNum} className={r.status === "rejected" ? "bg-red-500/10" : ""}>
                      <td className="py-2 px-3 text-muted-foreground">#{r.rowNum}</td>
                      <td className="py-2 px-3">
                        {r.status === "valid" ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            VALID
                          </span>
                        ) : r.status === "updated" ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                            UPDATE
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold">
                            REJECT
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-foreground font-semibold">{r.date}</td>
                      <td className="py-2 px-3 text-muted-foreground">{r.shiftName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{r.areaName}</td>
                      <td className="py-2 px-3 text-foreground">{r.plannedMin} min</td>
                      <td className="py-2 px-3 text-foreground">{r.totalCount}</td>
                      <td className="py-2 px-3 text-foreground">{r.goodCount}</td>
                      <td className="py-2 px-3 text-red-600 dark:text-red-400 font-sans text-[11px]">{r.errorReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Production Records & OEE Calculation Table */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            {t("prod.oeeResults")} & Data Produksi
          </h3>
          <p className="text-xs text-muted-foreground">
            Downtime stop otomatis diambil dari log stop pada tanggal & shift terkait untuk menghitung Availability, Performance, Quality, dan OEE.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border bg-slate-50/80 dark:bg-zinc-800/60 font-sans text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {t("common.date")} <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      SHIFT & AREA <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      WAKTU TERENCANA <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      DOWNTIME STOP <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      TOTAL / GOOD <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      AVAIL. (A) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      PERF. (P) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      QUAL. (Q) <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      OEE FINAL <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground font-mono">
                      {t("common.empty")}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => {
                    const shift = appState.shifts.find((s) => s.id === rec.shiftId);
                    const area = appState.areas.find((a) => a.id === rec.areaId);

                    const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
                    const recDateEnd = recDateStart + 86_400_000;
                    const stopsOnDate = appState.stops.filter((s) => s.startMs >= recDateStart && s.startMs < recDateEnd);
                    const dtMs = stopsOnDate.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);

                    const oee = computeOee(rec, dtMs);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-foreground font-bold font-mono whitespace-nowrap">{rec.date}</td>
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                          <div className="text-foreground font-medium">{shift?.name ?? rec.shiftId}</div>
                          <div className="text-[11px] text-muted-foreground">{area?.name ?? rec.areaId}</div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{rec.plannedMin} min</td>
                        <td className="py-3.5 px-4 text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
                          {Math.round(dtMs / 60_000)} min ({stopsOnDate.length} stops)
                        </td>
                        <td className="py-3.5 px-4 text-foreground text-center whitespace-nowrap font-mono">
                          {rec.goodCount} / {rec.totalCount} pcs
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                          {(oee.availability * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right text-cyan-600 dark:text-cyan-400 font-bold whitespace-nowrap">
                          {(oee.performance * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right text-purple-600 dark:text-purple-400 font-bold whitespace-nowrap">
                          {(oee.quality * 100).toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              oee.oee >= 0.85
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : oee.oee >= 0.7
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
                            }`}
                          >
                            {(oee.oee * 100).toFixed(1)}%
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
            page={prodPage}
            pageSize={prodPageSize}
            totalItems={sortedRecords.length}
            onPageChange={setProdPage}
            onPageSizeChange={setProdPageSize}
          />
        </div>
      </div>

      {/* Manual Input Dialog */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">
              Input Data Produksi Manual
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">Tanggal (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SelectInput
                    label="Shift:"
                    value={formShiftId}
                    onChange={(val) => setFormShiftId(val ?? "")}
                    datalist={appState.shifts.map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                    hideClear
                    placeholder="Pilih Shift"
                  />
                </div>
                <div>
                  <SelectInput
                    label="Area:"
                    value={formAreaId}
                    onChange={(val) => setFormAreaId(val ?? "")}
                    datalist={appState.areas.map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
                    hideClear
                    placeholder="Pilih Area"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Waktu Terencana (menit):</label>
                  <input
                    type="number"
                    value={formPlannedMin}
                    onChange={(e) => setFormPlannedMin(+e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Ideal Cycle (detik):</label>
                  <input
                    type="number"
                    value={formIdealSec}
                    onChange={(e) => setFormIdealSec(+e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Total Count (pcs):</label>
                  <input
                    type="number"
                    value={formTotalCount}
                    onChange={(e) => setFormTotalCount(+e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Good Count (pcs):</label>
                  <input
                    type="number"
                    value={formGoodCount}
                    onChange={(e) => setFormGoodCount(+e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
              <button
                onClick={() => setManualModalOpen(false)}
                className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold font-mono text-xs hover:bg-primary/90 shadow-2xs"
              >
                Simpan Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
