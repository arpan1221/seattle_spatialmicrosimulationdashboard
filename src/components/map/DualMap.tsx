"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { MODELS } from "@/lib/data";
import { TractMap } from "./TractMap";

/**
 * The two-map "spread" — ground truth on the left, the selected model
 * on the right. Always exactly 50/50; height fixed so the page rhythm
 * stays consistent. Each map carries its own palette so divergence reads
 * instantly: evergreen vs salmon.
 */
export function DualMap() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const modelName = MODELS.find((m) => m.key === selectedModel)?.name ?? selectedModel;

  return (
    <div
      className="relative grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-rule)] lg:grid-cols-2"
      style={{ height: "640px" }}
    >
      <TractMap source="gt"            title="Household Travel Survey" variant="evergreen" />
      <TractMap source={selectedModel} title={modelName}                variant="salmon"    modelKey={selectedModel} />
    </div>
  );
}
