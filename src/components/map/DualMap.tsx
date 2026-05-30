"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { MODELS } from "@/lib/data";
import { TractMap } from "./TractMap";

export function DualMap() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const modelName = MODELS.find((m) => m.key === selectedModel)?.name ?? selectedModel;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" style={{ height: "640px" }}>
      <TractMap source="gt" title="Ground Truth (HTS)" />
      <TractMap source={selectedModel} title={modelName} />
    </div>
  );
}
