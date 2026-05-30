"use client";

import { useEffect, useState } from "react";

import { Panel, PanelHeader, PanelBody } from "@/components/atlas/Panel";
import { Chip } from "@/components/atlas/Chip";
import { KpiCell, KpiRow } from "@/components/atlas/KpiCell";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardStore } from "@/lib/store/dashboard";
import { fetchSpatial, type SpatialRow } from "@/lib/duckdb/queries";

export function SpatialTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const [row, setRow] = useState<SpatialRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSpatial(selectedModel, clusterType).then((r) => {
      if (cancelled) return;
      setRow(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType]);

  if (loading || !row) return <Skeleton className="h-[420px] w-full" />;

  const moranDiff = Math.abs(row.moran_i - row.gt_moran_i);
  const moranSimilarity = Math.max(0, 1 - moranDiff);
  const verdict =
    row.moran_i > 0 && row.gt_moran_i > 0
      ? { label: "Both clustered", tone: "evergreen" as const }
      : row.moran_i < 0 && row.gt_moran_i < 0
        ? { label: "Both dispersed", tone: "tidal" as const }
        : { label: "Diverging patterns", tone: "crimson" as const };

  return (
    <div className="space-y-8">
      <Panel>
        <PanelHeader
          sectionNo="§ 04"
          eyebrow="Global Moran's I"
          title="Does the model preserve clustering?"
          description={
            <>
              Global Moran&apos;s I quantifies whether high-rate tracts neighbour
              other high-rate tracts. Values above zero indicate spatial
              clustering; below zero, dispersion. We compare the GT signal to
              the model under Queen contiguity weights.
            </>
          }
          trailing={<Chip tone={verdict.tone} dot>{verdict.label}</Chip>}
        />
        <PanelBody>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-[var(--atlas-rule)] sm:grid-cols-3">
            <MoranBlock
              eyebrow="Ground truth · HTS"
              value={row.gt_moran_i.toFixed(3)}
              caption={`p_sim = ${row.gt_moran_p.toExponential(2)}`}
              color="var(--atlas-evergreen)"
            />
            <MoranBlock
              eyebrow="Selected model"
              value={row.moran_i.toFixed(3)}
              caption={`p_sim = ${row.moran_p.toExponential(2)} · z = ${row.moran_z.toFixed(2)}`}
              color="var(--atlas-salmon)"
            />
            <MoranBlock
              eyebrow="Similarity"
              value={moranSimilarity.toFixed(3)}
              caption={`|Δ| = ${moranDiff.toFixed(3)} · 1.0 perfect`}
              color="var(--atlas-tidal)"
              bar={moranSimilarity}
            />
          </div>

          {/* A visual diff bar */}
          <div className="mt-6 space-y-3">
            <p className="atlas-eyebrow">Moran I distance — visual diff</p>
            <MoranDiffBar gt={row.gt_moran_i} model={row.moran_i} />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          sectionNo="§ 05"
          eyebrow="Local Moran's I (LISA)"
          title="Where the regimes match"
          description="LISA labels every tract as part of a high-high, low-low, high-low, or low-high regime. Agreement here means the model not only reproduces global clustering but also gets the local hot-spots right."
        />
        <PanelBody>
          <KpiRow columns={2}>
            <KpiCell
              label="Significance agreement"
              value={`${(row.lisa_significance_agreement * 100).toFixed(1)}%`}
              caption="% tracts with matching significance status"
              bar={row.lisa_significance_agreement}
              tone="tidal"
            />
            <KpiCell
              label="Regime agreement"
              value={`${(row.lisa_regime_agreement * 100).toFixed(1)}%`}
              caption="% tracts in the same HH / LL / HL / LH quadrant"
              bar={row.lisa_regime_agreement}
              tone="amber"
            />
          </KpiRow>
        </PanelBody>
      </Panel>
    </div>
  );
}

function MoranBlock({
  eyebrow, value, caption, color, bar,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  color: string;
  bar?: number;
}) {
  return (
    <div className="bg-[var(--atlas-surface)] px-5 py-5">
      <p className="atlas-eyebrow mb-3">{eyebrow}</p>
      <p className="atlas-numeric font-mono text-[40px] leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--atlas-ink-subtle)]">
        {caption}
      </p>
      {typeof bar === "number" && (
        <div className="mt-3 h-[3px] w-full overflow-hidden bg-[var(--atlas-rule)]">
          <div
            className="h-full"
            style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * A two-marker number line from -1 to +1 showing where GT and model
 * sit relative to each other on the Moran's I scale.
 */
function MoranDiffBar({ gt, model }: { gt: number; model: number }) {
  const toPct = (v: number) => ((v + 1) / 2) * 100;
  return (
    <div className="relative h-12 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--atlas-rule-strong)]" />
      <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-[var(--atlas-rule-strong)]" />
      <span className="absolute left-0 top-full mt-1 font-mono text-[10px] tracking-wider text-[var(--atlas-ink-subtle)]">−1 dispersed</span>
      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 font-mono text-[10px] tracking-wider text-[var(--atlas-ink-subtle)]">0</span>
      <span className="absolute right-0 top-full mt-1 font-mono text-[10px] tracking-wider text-[var(--atlas-ink-subtle)]">+1 clustered</span>

      <Marker pct={toPct(gt)}    color="var(--atlas-evergreen)" label={`GT ${gt.toFixed(2)}`}    above />
      <Marker pct={toPct(model)} color="var(--atlas-salmon)"    label={`MD ${model.toFixed(2)}`} below />
    </div>
  );
}

function Marker({ pct, color, label, above, below }: {
  pct: number;
  color: string;
  label: string;
  above?: boolean;
  below?: boolean;
}) {
  return (
    <>
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <span
        className="absolute font-mono text-[10px] uppercase tracking-[0.1em]"
        style={{
          left: `${pct}%`,
          transform: "translateX(-50%)",
          top: above ? "-8px" : undefined,
          bottom: below ? "26px" : undefined,
          color,
        }}
      >
        {label}
      </span>
    </>
  );
}
