"use client";

import { DualMap } from "@/components/map/DualMap";
import { Metrics } from "@/components/metrics/Metrics";

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <DualMap />
      <Metrics />
    </div>
  );
}
