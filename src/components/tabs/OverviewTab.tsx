"use client";

import { DualMap } from "@/components/map/DualMap";
import { Metrics } from "@/components/metrics/Metrics";

export function OverviewTab() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div className="space-y-1.5">
          <span className="atlas-section-no">§ 00 — Cartographic spread</span>
          <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight text-[var(--atlas-ink)]">
            Two readings of the same geography
          </h2>
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-[var(--atlas-ink-dim)]">
            On the left, the household-travel survey&apos;s estimate of telework
            prevalence in each tract. On the right, the selected synthetic-population
            model&apos;s reproduction of the same field. Concentrations of activity
            glow against the dark basemap; thresholds are visible at a glance.
          </p>
        </div>
        <DualMap />
      </section>
      <Metrics />
    </div>
  );
}
