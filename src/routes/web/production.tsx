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

export const Route = createFileRoute("/web/production")({
  head: () => ({
    meta: [
      { title: "JSGI — Production Data & OEE Calculation" },
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
    XLSX.writeFile(wb, "Template_Produksi_JSGI.xlsx");
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
          const rowNum = idx + 2; // header is row 1
          const rawDate = String(row["Date"] || row["Tanggal"] || "").trim();
          const rawShift = String(row["Shift"] || "").trim().toLowerCase();
          const rawArea = String(row["Area"] || "").trim().toLowerCase();
          const plannedMin = Number(row["PlannedMin"] || row["WaktuTerencana"] || 0);
          const totalCount = Number(row["TotalCount"] || row["TotalProduksi"] || 0);
          const goodCount = Number(row["GoodCount"] || row["GoodProduksi"] || 0);
          const idealCycleSec = Number(row["IdealCycleSec"] || row["IdealCycle"] || 18);

          // Validation
          let errorReason: string | undefined;
          let status: "valid" | "updated" | "rejected" = "valid";

          // Date format YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            errorReason = t("prod.error.date");
            status = "rejected";
          }

          // Match Shift
          const matchedShift = appState.shifts.find(
            (s) => s.id.toLowerCase() === rawShift || s.name.toLowerCase().includes(rawShift)
          );
          if (!matchedShift && !errorReason) {
            errorReason = t("prod.error.shift");
            status = "rejected";
          }

          // Match Area
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

          // Check if existing record will be updated
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

  // Production records sorted by date desc
  const sortedRecords = useMemo(() => {
    return [...appState.productionRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [appState.productionRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            {t("prod.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("prod.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white hover:bg-white/10 transition-colors"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            {t("prod.downloadTemplate")}
          </button>

          <button
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold text-black hover:bg-white/90 shadow transition-colors"
          >
            <Plus className="h-4 w-4" />
            Input Manual
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-6">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 rounded-lg p-8 text-center bg-white/[0.01] hover:border-white/30 transition-colors">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-display text-sm font-semibold text-white">
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
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 font-mono text-xs text-white hover:bg-white/20 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {fileName ? `File terpilih: ${fileName}` : "Pilih Berkas Excel"}
          </label>
        </div>

        {/* Upload Preview Table */}
        {previewRows && (
          <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-white">
                  {t("prod.preview")} — {fileName}
                </h4>
                <div className="flex items-center gap-3 font-mono text-xs mt-1">
                  <span className="text-emerald-400 font-bold">{validCount} Valid</span>
                  <span className="text-white/20">•</span>
                  <span className="text-red-400 font-bold">{rejectedCount} Ditolak</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewRows(null)}
                  className="px-3 py-1.5 rounded border border-white/10 text-xs font-mono text-muted-foreground hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  onClick={handleCommitPreview}
                  disabled={validCount === 0}
                  className="px-4 py-1.5 rounded bg-emerald-500 text-black font-semibold text-xs font-mono hover:bg-emerald-400 disabled:opacity-40 transition-colors shadow"
                >
                  {t("prod.commit", { valid: validCount })}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase text-muted-foreground sticky top-0">
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
                <tbody className="divide-y divide-white/5">
                  {previewRows.map((r) => (
                    <tr key={r.rowNum} className={r.status === "rejected" ? "bg-red-950/20" : ""}>
                      <td className="py-2 px-3 text-muted-foreground">#{r.rowNum}</td>
                      <td className="py-2 px-3">
                        {r.status === "valid" ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            VALID
                          </span>
                        ) : r.status === "updated" ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                            UPDATE
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                            REJECT
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-white">{r.date}</td>
                      <td className="py-2 px-3 text-muted-foreground">{r.shiftName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{r.areaName}</td>
                      <td className="py-2 px-3 text-white">{r.plannedMin} min</td>
                      <td className="py-2 px-3 text-white">{r.totalCount}</td>
                      <td className="py-2 px-3 text-white">{r.goodCount}</td>
                      <td className="py-2 px-3 text-red-400 font-sans text-[11px]">{r.errorReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Production Records & OEE Calculation Table */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-5 space-y-4">
        <div>
          <h3 className="font-display text-sm font-semibold text-white">
            {t("prod.oeeResults")} & Data Produksi
          </h3>
          <p className="text-xs text-muted-foreground">
            Downtime stop otomatis diambil dari log stop pada tanggal & shift terkait untuk menghitung Availability, Performance, Quality, dan OEE.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-3 px-3">{t("common.date")}</th>
                <th className="py-3 px-3">Shift & Area</th>
                <th className="py-3 px-3">Waktu Terencana</th>
                <th className="py-3 px-3">Downtime Stop</th>
                <th className="py-3 px-3">Total / Good</th>
                <th className="py-3 px-3">Avail. (A)</th>
                <th className="py-3 px-3">Perf. (P)</th>
                <th className="py-3 px-3">Qual. (Q)</th>
                <th className="py-3 px-3 font-bold text-white">OEE Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : (
                sortedRecords.map((rec) => {
                  const shift = appState.shifts.find((s) => s.id === rec.shiftId);
                  const area = appState.areas.find((a) => a.id === rec.areaId);

                  // Calculate stop downtime for this record date
                  const recDateStart = Date.parse(`${rec.date}T00:00:00+07:00`);
                  const recDateEnd = recDateStart + 86_400_000;
                  const stopsOnDate = appState.stops.filter((s) => s.startMs >= recDateStart && s.startMs < recDateEnd);
                  const dtMs = stopsOnDate.reduce((sum, s) => sum + stopDurationMs(s, recDateEnd), 0);

                  const oee = computeOee(rec, dtMs);

                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 text-white font-bold">{rec.date}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        <div className="text-white">{shift?.name ?? rec.shiftId}</div>
                        <div className="text-[10px]">{area?.name ?? rec.areaId}</div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{rec.plannedMin} min</td>
                      <td className="py-3 px-3 text-amber-400">
                        {Math.round(dtMs / 60_000)} min ({stopsOnDate.length} stops)
                      </td>
                      <td className="py-3 px-3 text-white">
                        {rec.goodCount} / {rec.totalCount} pcs
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">
                        {(oee.availability * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-cyan-400 font-bold">
                        {(oee.performance * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-purple-400 font-bold">
                        {(oee.quality * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-xs ${
                            oee.oee >= 0.85
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : oee.oee >= 0.7
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
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
      </div>

      {/* Manual Input Dialog */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#121215] p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-white mb-4">
              Input Data Produksi Manual
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-muted-foreground mb-1">Tanggal (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded border border-white/10 bg-black p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Shift:</label>
                  <select
                    value={formShiftId}
                    onChange={(e) => setFormShiftId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  >
                    {appState.shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Area:</label>
                  <select
                    value={formAreaId}
                    onChange={(e) => setFormAreaId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  >
                    {appState.areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Waktu Terencana (menit):</label>
                  <input
                    type="number"
                    value={formPlannedMin}
                    onChange={(e) => setFormPlannedMin(+e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Ideal Cycle (detik):</label>
                  <input
                    type="number"
                    value={formIdealSec}
                    onChange={(e) => setFormIdealSec(+e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
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
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Good Count (pcs):</label>
                  <input
                    type="number"
                    value={formGoodCount}
                    onChange={(e) => setFormGoodCount(+e.target.value)}
                    className="w-full rounded border border-white/10 bg-black p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setManualModalOpen(false)}
                className="px-4 py-2 rounded border border-white/10 font-mono text-xs text-muted-foreground hover:bg-white/5"
              >
                Batal
              </button>
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 rounded bg-white text-black font-semibold font-mono text-xs hover:bg-white/90"
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
