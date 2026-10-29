import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with a max visible window (e.g. up to 5 buttons)
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-card border-t border-border font-sans text-xs text-muted-foreground select-none",
        className
      )}
    >
      {/* Left side: Rows per page & range */}
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-8 px-2 rounded-lg border border-border bg-background text-foreground font-medium text-xs focus:outline-none focus:border-ring cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="font-medium text-slate-600 dark:text-zinc-300">
          {startItem}-{endItem} of {totalItems}
        </span>
      </div>

      {/* Right side: Pagination controls */}
      <div className="flex items-center gap-1">
        {/* First Page << */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="Halaman Pertama"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-slate-500 dark:text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Prev Page < */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Halaman Sebelumnya"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-slate-500 dark:text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-[32px] px-2 inline-flex items-center justify-center rounded-lg font-medium text-xs transition-colors",
                isActive
                  ? "bg-blue-600 text-white shadow-2xs hover:bg-blue-700"
                  : "border border-transparent hover:border-border hover:bg-muted text-slate-600 dark:text-zinc-300"
              )}
            >
              {p}
            </button>
          );
        })}

        {/* Next Page > */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Halaman Berikutnya"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-slate-500 dark:text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last Page >> */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Halaman Terakhir"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-slate-500 dark:text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
