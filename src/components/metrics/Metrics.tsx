"use client";

import { useEffect, useState } from "react";

import { Panel, PanelHeader } from "@/components/atlas/Panel";
import { KpiCell, KpiRow } from "@/components/atlas/KpiCell";
import { Chip } from "@/components/atlas/Chip";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  fetchAnalysis, fetchMatches, type AnalysisRow, type MatchRow,
} from "@/lib/duckdb/queries";

const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const fmtNum = (v: number, d = 3) => v.toFixed(d);

export function Metrics() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);

  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchAnalysis(selectedModel, clusterType, percentileMethod),
      fetchMatches(selectedModel, clusterType, percentileMethod),
    ]).then(([a, m]) => {
      if (cancelled) return;
      setAnalysis(a);
      setMatches(m);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType, percentileMethod]);

  return (
    <div className="space-y-8">
      {/* Headline metrics */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <span className="atlas-section-no">§ 01 — Cluster match</span>
            <h3 className="font-display text-[22px] font-medium leading-tight tracking-tight text-[var(--atlas-ink)]">
              Headline metrics
            </h3>
            <p className="max-w-[64ch] text-[12.5px] text-[var(--atlas-ink-dim)]">
              Compute precision &amp; recall by matching ground-truth cluster centroids
              to the nearest model centroid within a 5&nbsp;km Haversine threshold.
              Spearman ranks the matched clusters by mean telework rate.
            </p>
          </div>
          <Chip tone="tidal">@ {percentileMethod} threshold</Chip>
        </div>

        <KpiRow columns={4}>
          <KpiCell
            label="Precision"
            value={analysis ? fmtPct(analysis.precision) : "—"}
            caption={analysis ? `${analysis.n_matches} of ${analysis.n_model_clusters} model clusters matched` : undefined}
            bar={analysis?.precision ?? null}
            tone="tidal"
            loading={loading}
          />
          <KpiCell
            label="Recall"
            value={analysis ? fmtPct(analysis.recall) : "—"}
            caption={analysis ? `${analysis.n_matches} of ${analysis.n_gt_clusters} GT clusters captured` : undefined}
            bar={analysis?.recall ?? null}
            tone="amber"
            loading={loading}
          />
          <KpiCell
            label="F1"
            value={analysis ? fmtNum(analysis.f1) : "—"}
            caption="Harmonic mean of precision and recall"
            bar={analysis?.f1 ?? null}
            tone="evergreen"
            loading={loading}
          />
          <KpiCell
            label="Spearman ρ"
            value={analysis ? fmtNum(analysis.spearman) : "—"}
            caption="Rank correlation across matched pairs"
            bar={analysis ? (analysis.spearman + 1) / 2 : null}
            tone="salmon"
            loading={loading}
          />
        </KpiRow>
      </section>

      {/* Matches table */}
      <Panel>
        <PanelHeader
          sectionNo="§ 02"
          eyebrow="Pairwise"
          title="Matched cluster pairs"
          description="Every GT cluster paired with its nearest model cluster under the 5 km centroid threshold, sorted by distance."
          trailing={
            analysis ? (
              <Chip tone={analysis.mean_distance_km < 2 ? "evergreen" : "amber"}>
                mean Δ {analysis.mean_distance_km.toFixed(2)} km
              </Chip>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--atlas-rule)] text-left">
                <Th>GT id</Th>
                <Th>Model id</Th>
                <Th align="right">Distance (km)</Th>
                <Th align="right">GT rate</Th>
                <Th align="right">Model rate</Th>
                <Th align="right">Δ rate</Th>
                <Th align="right">GT size</Th>
                <Th align="right">Model size</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-5 py-6"><Skeleton className="h-4 w-full" /></td></tr>
              )}
              {!loading && matches && matches.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[12.5px] text-[var(--atlas-ink-subtle)]">
                    No matches within 5&nbsp;km. The model may be producing clusters that
                    are geographically distinct from the ground-truth concentrations.
                  </td>
                </tr>
              )}
              {!loading && matches?.map((m, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--atlas-rule)] transition-colors hover:bg-[var(--atlas-surface-2)] last:border-b-0"
                >
                  <Td><Mono color="evergreen">G·{String(m.gt_cluster).padStart(2, "0")}</Mono></Td>
                  <Td><Mono color="salmon">M·{String(m.model_cluster).padStart(2, "0")}</Mono></Td>
                  <Td align="right" mono>{fmtNum(m.distance_km, 2)}</Td>
                  <Td align="right" mono>{fmtPct(m.gt_rate)}</Td>
                  <Td align="right" mono>{fmtPct(m.model_rate)}</Td>
                  <Td align="right" mono color={m.rate_diff > 0.10 ? "crimson" : "ink-dim"}>{fmtPct(m.rate_diff)}</Td>
                  <Td align="right" mono>{m.gt_size}</Td>
                  <Td align="right" mono>{m.model_size}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Th({
  children, align = "left",
}: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`atlas-eyebrow px-5 py-3 font-normal ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children, align = "left", mono, color,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  color?: "evergreen" | "salmon" | "tidal" | "crimson" | "ink" | "ink-dim";
}) {
  const colorMap: Record<NonNullable<typeof color>, string> = {
    evergreen: "var(--atlas-evergreen)",
    salmon: "var(--atlas-salmon)",
    tidal: "var(--atlas-tidal)",
    crimson: "var(--atlas-crimson)",
    ink: "var(--atlas-ink)",
    "ink-dim": "var(--atlas-ink-dim)",
  };
  return (
    <td
      className={`px-5 py-3 text-[12.5px] ${align === "right" ? "text-right" : ""} ${
        mono ? "font-mono tabular-nums" : ""
      }`}
      style={color ? { color: colorMap[color] } : undefined}
    >
      {children}
    </td>
  );
}

function Mono({
  children, color,
}: { children: React.ReactNode; color: "evergreen" | "salmon" }) {
  const c = color === "evergreen" ? "var(--atlas-evergreen)" : "var(--atlas-salmon)";
  return (
    <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: c }}>
      {children}
    </span>
  );
}
