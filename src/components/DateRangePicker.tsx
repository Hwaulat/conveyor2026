import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "../lib/utils";

export interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  onReset?: () => void;
  hideClear?: boolean;
  className?: string;
}

/** Format YYYY-MM-DD into DD/MM/YYYY to match user reference */
export function formatToDMY(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d?.padStart(2, "0")}/${m?.padStart(2, "0")}/${y}`;
  }
  return dateStr;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onReset,
  hideClear = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  // Sync temp dates when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  const handleApply = () => {
    if (tempStart && tempEnd) {
      if (tempStart > tempEnd) {
        onChange(tempEnd, tempStart);
      } else {
        onChange(tempStart, tempEnd);
      }
    }
    setOpen(false);
  };

  const handlePreset = (preset: "today" | "7d" | "30d" | "thisMonth" | "lastMonth") => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let start = todayStr;
    let end = todayStr;

    if (preset === "today") {
      start = todayStr;
      end = todayStr;
    } else if (preset === "7d") {
      const past = new Date(Date.now() - 6 * 86_400_000);
      start = past.toISOString().slice(0, 10);
      end = todayStr;
    } else if (preset === "30d") {
      const past = new Date(Date.now() - 29 * 86_400_000);
      start = past.toISOString().slice(0, 10);
      end = todayStr;
    } else if (preset === "thisMonth") {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      start = `${year}-${month}-01`;
      end = todayStr;
    } else if (preset === "lastMonth") {
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const year = prevMonth.getFullYear();
      const month = String(prevMonth.getMonth() + 1).padStart(2, "0");
      const lastDay = String(prevMonth.getDate()).padStart(2, "0");
      start = `${year}-${month}-01`;
      end = `${year}-${month}-${lastDay}`;
    }

    setTempStart(start);
    setTempEnd(end);
    onChange(start, end);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReset) {
      onReset();
    } else {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const past = new Date(Date.now() - 6 * 86_400_000);
      onChange(past.toISOString().slice(0, 10), todayStr);
    }
  };

  const formattedRange = `${formatToDMY(startDate)} - ${formatToDMY(endDate)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((prev) => !prev);
            }
          }}
          className={cn(
            "group inline-flex items-center gap-2.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all shadow-2xs font-mono text-xs text-foreground select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
            className
          )}
          title="Click to select date range"
        >
          {/* Calendar Icon on Left */}
          <CalendarIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 group-hover:text-primary transition-colors" />

          {/* Formatted Date Range: DD/MM/YYYY - DD/MM/YYYY */}
          <span className="font-semibold tracking-tight text-foreground select-none">
            {formattedRange}
          </span>

          {/* Clear X Icon on Right (hidden if hideClear) */}
          {!hideClear && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground/80 hover:text-foreground transition-colors shrink-0 cursor-pointer -mr-0.5"
              title="Reset date range"
              aria-label="Reset date range"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-4 font-mono text-xs space-y-4 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl z-50"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="font-bold text-foreground">Select Date Range</span>
          <span className="text-[10px] text-muted-foreground">Format: DD/MM/YYYY</span>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            Quick Presets:
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handlePreset("today")}
              className="px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-left font-semibold text-foreground transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset("7d")}
              className="px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-left font-semibold text-foreground transition-colors"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset("30d")}
              className="px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-left font-semibold text-foreground transition-colors"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset("thisMonth")}
              className="px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-left font-semibold text-foreground transition-colors"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="space-y-3 pt-1 border-t border-border">
          <div>
            <label className="block text-[11px] text-muted-foreground font-semibold mb-1">
              From Date (Start):
            </label>
            <input
              type="date"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground font-mono text-xs focus:outline-none focus:border-ring cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground font-semibold mb-1">
              To Date (End):
            </label>
            <input
              type="date"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
              className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground font-mono text-xs focus:outline-none focus:border-ring cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors text-[11px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs text-[11px]"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

