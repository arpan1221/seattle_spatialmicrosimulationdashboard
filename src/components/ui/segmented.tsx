"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A segmented toggle group. Lightweight; no radix dependency.
 * Used for cluster type, percentile method, classification method —
 * places where the option set is small and segmented feels more
 * deliberate than a dropdown.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  caption?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (v: T) => void;
  /** Single-line vs wrapped grid layout. */
  layout?: "row" | "grid";
  className?: string;
}

export function Segmented<T extends string>({
  value, options, onChange, layout = "row", className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "relative isolate",
        layout === "grid"
          ? "grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-[var(--atlas-rule)]"
          : "inline-flex w-full overflow-hidden rounded-[6px] border border-[var(--atlas-rule)]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "group relative flex-1 px-3 py-2 text-left transition-colors",
              "font-mono text-[11px] uppercase tracking-[0.14em]",
              "before:absolute before:right-0 before:top-1 before:bottom-1 before:w-px before:bg-[var(--atlas-rule)]",
              "last:before:hidden",
              layout === "grid" && "before:hidden",
              active
                ? "bg-[var(--atlas-ink)] text-[var(--atlas-paper)]"
                : "bg-[var(--atlas-surface)] text-[var(--atlas-ink-dim)] hover:bg-[var(--atlas-surface-2)] hover:text-[var(--atlas-ink)]",
            )}
          >
            <span className="block leading-none">{o.label}</span>
            {o.caption && (
              <span className={cn(
                "mt-1 block text-[9px] normal-case tracking-normal",
                active ? "text-[var(--atlas-paper)]/70" : "text-[var(--atlas-ink-subtle)]",
              )}>
                {o.caption}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
