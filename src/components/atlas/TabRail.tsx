"use client";

import { cn } from "@/lib/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * An editorial-feeling tab nav. Numbered sections, a thin underline
 * to mark the active page, generous tracking. Wraps shadcn Tabs so
 * the rest of the page's TabsContent contracts are unchanged.
 */
const SECTIONS = [
  { value: "overview",  number: "01", label: "Overview" },
  { value: "quartile",  number: "02", label: "Quartiles" },
  { value: "jaccard",   number: "03", label: "Jaccard sweep" },
  { value: "spatial",   number: "04", label: "Spatial autocorrelation" },
  { value: "composite", number: "05", label: "Composite score" },
  { value: "highlow",   number: "06", label: "High / low" },
] as const;

export function TabRail() {
  return (
    <div className="border-y border-[var(--atlas-rule)]">
      <TabsList
        className={cn(
          "flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0",
        )}
      >
        {SECTIONS.map((s) => (
          <TabsTrigger
            key={s.value}
            value={s.value}
            className={cn(
              "group relative shrink-0 rounded-none border-r border-[var(--atlas-rule)] bg-transparent",
              "px-5 py-3.5 text-left",
              "data-[state=active]:bg-[var(--atlas-surface)]",
              "data-[state=active]:shadow-none",
              "transition-colors hover:bg-[var(--atlas-surface)]",
            )}
          >
            <span className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--atlas-ink-subtle)] group-data-[state=active]:text-[var(--atlas-tidal)]">
                {s.number}
              </span>
              <span className="font-display text-[14.5px] tracking-tight text-[var(--atlas-ink-dim)] group-data-[state=active]:text-[var(--atlas-ink)]">
                {s.label}
              </span>
            </span>
            <span
              className={cn(
                "pointer-events-none absolute bottom-[-1px] left-0 right-0 h-[2px]",
                "bg-[var(--atlas-tidal)] opacity-0 transition-opacity",
                "group-data-[state=active]:opacity-100",
              )}
            />
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
