"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { Panel, PanelHeader, PanelBody } from "@/components/atlas/Panel";
import { Chip } from "@/components/atlas/Chip";
import { KpiCell, KpiRow } from "@/components/atlas/KpiCell";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardStore } from "@/lib/store/dashboard";
import { fetchDistributions, fetchQuartile, type QuartileRow } from "@/lib/duckdb/queries";

const NUM_BINS = 40;

function binPair(
  gt: number[], model: number[], bins = NUM_BINS, lo = 0, hi = 1,
): Array<{ x: number; gt: number; model: number }> {
  const out: Array<{ x: number; gt: number; model: number }> = [];
  const step = (hi - lo) / bins;
  for (let i = 0; i < bins; i++) out.push({ x: lo + (i + 0.5) * step, gt: 0, model: 0 });
  const tally = (vals: number[], key: "gt" | "model") => {
    for (const v of vals) {
      if (!Number.isFinite(v)) continue;
      let idx = Math.floor((v - lo) / step);
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      out[idx][key] += 1;
    }
  };
  tally(gt, "gt");
  tally(model, "model");
  return out;
}

export function QuartileTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);

  const [rows, setRows] = useState<QuartileRow[] | null>(null);
  const [dist, setDist] = useState<{ gt: number[]; model: number[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setDist(null);
    Promise.all([
      fetchQuartile(selectedModel, clusterType),
      fetchDistributions(selectedModel, clusterType),
    ]).then(([q, d]) => {
      if (cancelled) return;
      setRows(q);
      setDist(d);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType]);

  const distBins = useMemo(() => (dist ? binPair(dist.gt, dist.model) : []), [dist]);

  const ksStat = rows?.[0]?.ks_stat ?? 0;
  const ksP = rows?.[0]?.ks_pvalue ?? 0;
  const iqrRatio = rows?.[0]?.iqr_ratio ?? 0;

  if (!rows || !dist) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[140px] w-full" />
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <KpiRow columns={3}>
        <KpiCell
          label="IQR ratio"
          value={iqrRatio.toFixed(3)}
          caption="min(IQR) / max(IQR) · 1.0 = identical spread"
          bar={iqrRatio}
          tone="amber"
        />
        <KpiCell
          label="KS statistic"
          value={ksStat.toFixed(3)}
          caption="Kolmogorov–Smirnov · smaller = closer distributions"
          bar={1 - ksStat}
          tone="tidal"
        />
        <KpiCell
          label="KS p-value"
          value={ksP.toExponential(2)}
          caption="High p ⇒ statistically similar to GT"
          bar={Math.min(1, ksP * 10)}
          tone="evergreen"
        />
      </KpiRow>

      <Panel>
        <PanelHeader
          sectionNo="§ 02"
          eyebrow="Quartile Jaccard"
          title="Where the tails agree"
          description="At each percentile, treat the tracts above (high) and below (low) the threshold as sets, then measure how much they overlap with ground truth. The reference lines mark common stability bands."
          trailing={<Chip tone="tidal" dot>P25 · P50 · P75</Chip>}
        />
        <PanelBody>
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 4" />
                <XAxis
                  dataKey="percentile"
                  stroke="var(--atlas-ink-subtle)"
                  tickLine={false}
                  axisLine={{ stroke: "var(--atlas-rule-strong)" }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  stroke="var(--atlas-ink-subtle)"
                  tickLine={false}
                  axisLine={{ stroke: "var(--atlas-rule-strong)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--atlas-rule-strong)", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "var(--atlas-surface)",
                    border: "1px solid var(--atlas-rule-strong)",
                    borderRadius: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                  formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                />
                <Legend
                  iconType="plainline"
                  formatter={(v) => (
                    <span style={{ color: "var(--atlas-ink-dim)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {v}
                    </span>
                  )}
                />
                <ReferenceLine y={0.85} stroke="var(--atlas-evergreen)" strokeDasharray="2 4" label={{ value: "0.85 · stable", position: "right", fill: "var(--atlas-evergreen)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
                <ReferenceLine y={0.60} stroke="var(--atlas-amber)"    strokeDasharray="2 4" label={{ value: "0.60 · moderate", position: "right", fill: "var(--atlas-amber)",    fontSize: 10, fontFamily: "var(--font-mono)" }} />
                <Line type="monotone" dataKey="high_jaccard" stroke="var(--atlas-salmon)" strokeWidth={2} name="High concentration" />
                <Line type="monotone" dataKey="low_jaccard"  stroke="var(--atlas-tidal)"  strokeWidth={2} name="Low concentration" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          sectionNo="§ 03"
          eyebrow="Distribution overlay"
          title="Per-tract telework rate"
          description="The histogram for ground truth and the selected model, plotted on the same axis. Tail divergence and modal shift are visible at a glance."
        />
        <PanelBody>
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <BarChart data={distBins} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  stroke="var(--atlas-ink-subtle)"
                  tickLine={false}
                  axisLine={{ stroke: "var(--atlas-rule-strong)" }}
                />
                <YAxis
                  stroke="var(--atlas-ink-subtle)"
                  tickLine={false}
                  axisLine={{ stroke: "var(--atlas-rule-strong)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--atlas-surface-2)" }}
                  contentStyle={{
                    background: "var(--atlas-surface)",
                    border: "1px solid var(--atlas-rule-strong)",
                    borderRadius: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                  formatter={(v) => Number(v).toFixed(0)}
                  labelFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                />
                <Legend
                  iconType="square"
                  formatter={(v) => (
                    <span style={{ color: "var(--atlas-ink-dim)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {v}
                    </span>
                  )}
                />
                <Bar dataKey="gt"    fill="var(--atlas-evergreen)" fillOpacity={0.55} name="Ground truth" />
                <Bar dataKey="model" fill="var(--atlas-salmon)"   fillOpacity={0.65} name="Model" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          sectionNo="§ 04"
          eyebrow="Threshold ledger"
          title="Numerical detail per percentile"
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--atlas-rule)]">
                <Th>Percentile</Th>
                <Th align="right">GT threshold</Th>
                <Th align="right">Model threshold</Th>
                <Th align="right">High Jaccard</Th>
                <Th align="right">Low Jaccard</Th>
                <Th align="right">High ∩</Th>
                <Th align="right">GT only</Th>
                <Th align="right">Model only</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.percentile} className="border-b border-[var(--atlas-rule)] last:border-b-0 transition-colors hover:bg-[var(--atlas-surface-2)]">
                  <td className="px-5 py-3 font-display text-[13px] font-medium text-[var(--atlas-ink)]">{r.percentile}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-evergreen)]">{(r.gt_threshold * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-salmon)]">{(r.model_threshold * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-ink)]">{(r.high_jaccard * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-ink)]">{(r.low_jaccard * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-ink-dim)]">{r.high_intersection}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-ink-dim)]">{r.gt_only_high}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-[12px] text-[var(--atlas-ink-dim)]">{r.model_only_high}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`atlas-eyebrow px-5 py-3 font-normal ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
