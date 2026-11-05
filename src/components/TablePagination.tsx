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
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-card border-t border-slate-100 dark:border-[#152a47] font-sans text-xs text-slate-500 dark:text-zinc-400 select-none",
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
              className="h-7 px-2 rounded-md border border-slate-200 dark:border-[#152a47] bg-background text-slate-700 dark:text-zinc-200 font-medium text-xs focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="font-medium text-slate-500 dark:text-zinc-400">
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
          title="First Page"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-[#152a47] bg-background hover:bg-slate-50 dark:hover:bg-[#132742] text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>

        {/* Prev Page < */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-[#152a47] bg-background hover:bg-slate-50 dark:hover:bg-[#132742] text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
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
                "h-7 min-w-[28px] px-2 inline-flex items-center justify-center rounded-md font-semibold text-xs transition-colors shadow-2xs",
                isActive
                  ? "bg-[#1d4ed8] dark:bg-blue-600 text-white"
                  : "border border-transparent hover:border-slate-200 dark:hover:border-[#152a47] hover:bg-slate-50 dark:hover:bg-[#132742] text-slate-600 dark:text-zinc-300"
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
          title="Next Page"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-[#152a47] bg-background hover:bg-slate-50 dark:hover:bg-[#132742] text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Last Page >> */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-[#152a47] bg-background hover:bg-slate-50 dark:hover:bg-[#132742] text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

