"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  MODELS, CLUSTER_TYPES, PERCENTILE_METHODS,
  type ClusterType, type PercentileMethod,
} from "@/lib/data";

/**
 * The editorial control deck.
 *
 * Section 1: model selector with the model name displayed in a
 *   character-set-feeling header (Fraunces) so it reads as the
 *   primary object of study.
 * Section 2: outcome — segmented Yes / No telework.
 * Section 3: threshold method — 4-way segmented.
 * Section 4: a tiny machine-readable summary "stamp" at the bottom.
 */
export function Sidebar() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const setSelectedModel = useDashboardStore((s) => s.setSelectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const setClusterType = useDashboardStore((s) => s.setClusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);
  const setPercentileMethod = useDashboardStore((s) => s.setPercentileMethod);

  const modelChoices = MODELS.filter((m) => m.key !== "gt");
  const currentModelName = MODELS.find((m) => m.key === selectedModel)?.name ?? selectedModel;

  return (
    <aside className="sticky top-6 flex h-fit flex-col gap-5 rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-surface)] p-5">
      <div className="space-y-1.5">
        <span className="atlas-section-no">§ Control deck</span>
        <h3 className="font-display text-[16px] font-medium leading-tight text-[var(--atlas-ink)]">
          Comparison parameters
        </h3>
      </div>

      <Field
        label="Model"
        secondary={selectedModel.toUpperCase()}
      >
        <Select value={selectedModel} onValueChange={(v) => v && setSelectedModel(v)}>
          <SelectTrigger
            className="h-auto w-full rounded-[6px] border-[var(--atlas-rule)] bg-[var(--atlas-paper)] px-3 py-2.5 text-[12.5px] hover:border-[var(--atlas-rule-strong)] focus:ring-1 focus:ring-[var(--atlas-tidal)]"
          >
            <SelectValue>
              <span className="font-display text-[14px] leading-tight text-[var(--atlas-salmon)]">
                {currentModelName}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="border-[var(--atlas-rule-strong)] bg-[var(--atlas-surface)]">
            {modelChoices.map((m) => (
              <SelectItem key={m.key} value={m.key} className="font-display text-[13.5px]">
                <span className="font-mono mr-3 text-[10px] uppercase tracking-[0.15em] text-[var(--atlas-ink-subtle)]">
                  {m.key}
                </span>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Outcome" secondary="binary" >
        <Segmented<ClusterType>
          value={clusterType}
          onChange={setClusterType}
          options={[
            { value: "yes", label: "Any telework", caption: "≥ 1 remote day" },
            { value: "no",  label: "No telework",  caption: "0 remote days" },
          ]}
        />
      </Field>

      <Field label="Threshold" secondary="percentile">
        <Segmented<PercentileMethod>
          value={percentileMethod}
          onChange={setPercentileMethod}
          layout="grid"
          options={PERCENTILE_METHODS.map((p) => ({
            value: p,
            label: p,
            caption: PCT_CAPTION[p],
          }))}
        />
      </Field>

      <div className="atlas-rule" />

      {/* Machine-readable stamp at the bottom — feels like a research footer. */}
      <div className="space-y-1.5">
        <span className="atlas-eyebrow">Selection stamp</span>
        <pre className="font-mono text-[10.5px] leading-relaxed text-[var(--atlas-ink-dim)]">
{`model    : ${selectedModel}
outcome  : ${clusterType}
method   : ${percentileMethod}
region   : 42660
tracts   : 890`}
        </pre>
      </div>
    </aside>
  );
}

const PCT_CAPTION: Record<PercentileMethod, string> = {
  "70th": "top 30%",
  "75th": "top 25%",
  "25th": "top 75%",
  "IQR":  "middle 50%",
};

function Field({
  label, secondary, children,
}: {
  label: string;
  secondary?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="atlas-eyebrow">{label}</span>
        {secondary && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--atlas-ink-subtle)]">
            {secondary}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
