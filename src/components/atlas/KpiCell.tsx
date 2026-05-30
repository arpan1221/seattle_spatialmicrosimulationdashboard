import * as React from "react";
import { cn } from "@/lib/utils";

interface KpiCellProps {
  label: string;
  value: string;
  caption?: string;
  tone?: "default" | "evergreen" | "salmon" | "tidal" | "amber" | "crimson";
  trailing?: React.ReactNode;
  loading?: boolean;
  className?: string;
  /** Optional "sparkline" — a hairline bar showing position 0..1 of this metric. */
  bar?: number | null;
}

const TONE_COLOR: Record<NonNullable<KpiCellProps["tone"]>, string> = {
  default: "var(--atlas-ink)",
  evergreen: "var(--atlas-evergreen)",
  salmon: "var(--atlas-salmon)",
  tidal: "var(--atlas-tidal)",
  amber: "var(--atlas-amber)",
  crimson: "var(--atlas-crimson)",
};

/**
 * A KPI cell that looks like one.
 *
 * Layout:
 *   ── tracked label ─────────────────  [trailing chip]
 *   76.4%                                 ← oversized mono
 *   ─────────── (optional rule)
 *   ▮▮▮▮▮▮░░░░░░░░░  caption text       ← optional position bar + caption
 *
 * The whole thing breathes via vertical rhythm and uses tabular numerals
 * so values don't jitter as they change.
 */
export function KpiCell({
  label, value, caption, tone = "default", trailing, loading, className, bar,
}: KpiCellProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 px-4 py-4",
        "border-r border-b border-[var(--atlas-rule)]",
        "last:border-r-0",
        "transition-colors hover:bg-[var(--atlas-surface-2)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="atlas-eyebrow">{label}</span>
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      <div
        className="atlas-numeric font-mono text-[34px] leading-[0.95] font-medium"
        style={{ color: TONE_COLOR[tone] }}
      >
        {loading ? <span className="text-[var(--atlas-ink-subtle)]">—</span> : value}
      </div>
      {(typeof bar === "number" || caption) && (
        <div className="space-y-1.5">
          {typeof bar === "number" && (
            <div className="relative h-[3px] w-full overflow-hidden bg-[var(--atlas-rule)]">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(1, bar)) * 100}%`,
                  background: TONE_COLOR[tone],
                }}
              />
            </div>
          )}
          {caption && (
            <p className="font-mono text-[10.5px] text-[var(--atlas-ink-subtle)]">{caption}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The container for a row of KpiCells. Wraps them with the outer hairlines
 * so the cells themselves only need internal borders.
 */
export function KpiRow({
  children, columns = 4, className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const colsClass =
    columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : columns === 4 ? "grid-cols-2 sm:grid-cols-4"
    : columns === 3 ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-2";
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-surface)]",
        colsClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
