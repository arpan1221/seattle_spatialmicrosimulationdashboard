"use client";

import { CompareMap } from "@/components/map/CompareMap";
import { Metrics } from "@/components/metrics/Metrics";

export function OverviewTab() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div className="space-y-1.5">
          <span className="atlas-section-no">§ 00 — Cartographic spread</span>
          <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight text-[var(--atlas-ink)]">
            One geography, two readings
          </h2>
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-[var(--atlas-ink-dim)]">
            The household-travel survey&apos;s estimate of telework prevalence is
            painted in evergreen across every census tract; the selected
            synthetic-population model is painted in salmon. Drag the curtain
            in the middle of the map to scrub from one to the other — where
            the two palettes disagree is where the model fails. Hover a
            tract to read both numbers and the percentage-point difference.
          </p>
        </div>
        <CompareMap />
      </section>
      <Metrics />
    </div>
  );
}
