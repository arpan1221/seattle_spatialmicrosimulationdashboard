"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { Panel, PanelHeader, PanelBody } from "@/components/atlas/Panel";
import { Chip } from "@/components/atlas/Chip";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCell, KpiRow } from "@/components/atlas/KpiCell";

import { useDashboardStore } from "@/lib/store/dashboard";
import { fetchJaccardSweep, type JaccardRow } from "@/lib/duckdb/queries";

export function JaccardTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const [rows, setRows] = useState<JaccardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    fetchJaccardSweep(selectedModel, clusterType).then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType]);

  if (!rows) return <Skeleton className="h-[480px] w-full" />;

  const peakJ = rows.reduce((b, r) => (r.jaccard > b.jaccard ? r : b), rows[0]);
  const peakD = rows.reduce((b, r) => (r.dice > b.dice ? r : b), rows[0]);
  const mid = rows.find((r) => Math.abs(r.threshold - 0.5) < 0.001) ?? rows[Math.floor(rows.length / 2)];

  return (
    <div className="space-y-8">
      <KpiRow columns={3}>
        <KpiCell
          label="Peak Jaccard"
          value={`${(peakJ.jaccard * 100).toFixed(1)}%`}
          caption={`at threshold ${Math.round(peakJ.threshold * 100)}%`}
          tone="tidal"
          bar={peakJ.jaccard}
        />
        <KpiCell
          label="Peak Dice"
          value={`${(peakD.dice * 100).toFixed(1)}%`}
          caption={`at threshold ${Math.round(peakD.threshold * 100)}%`}
          tone="amber"
          bar={peakD.dice}
        />
        <KpiCell
          label="At 50% threshold"
          value={`${(mid.jaccard * 100).toFixed(1)}%`}
          caption={`J · ${mid.intersection} of ${mid.union} tracts overlap`}
          tone="evergreen"
          bar={mid.jaccard}
        />
      </KpiRow>

      <Panel>
        <PanelHeader
          sectionNo="§ 03"
          eyebrow="Set overlap sweep"
          title="Jaccard &amp; Dice across thresholds"
          description="For each rate threshold from 10% to 95%, count the tracts that exceed it under both ground truth and the model, then compute the agreement coefficients. The peak shows the threshold where the two universes agree most."
        />
        <PanelBody>
          <div className="h-[380px] w-full">
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 16, right: 24, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="2 4" />
                <XAxis
                  dataKey="threshold"
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
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
                    color: "var(--atlas-ink)",
                  }}
                  labelStyle={{ color: "var(--atlas-ink-subtle)", letterSpacing: "0.08em", fontSize: 10 }}
                  formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                  labelFormatter={(v) => `THRESHOLD · ${Math.round(Number(v) * 100)}%`}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 8 }}
                  iconType="plainline"
                  formatter={(v) => (
                    <span style={{ color: "var(--atlas-ink-dim)", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {v}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="jaccard"
                  stroke="var(--atlas-tidal)"
                  strokeWidth={2}
                  dot={false}
                  name="Jaccard"
                />
                <Line
                  type="monotone"
                  dataKey="dice"
                  stroke="var(--atlas-amber)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Dice"
                />
                <ReferenceDot
                  x={peakJ.threshold}
                  y={peakJ.jaccard}
                  r={5}
                  fill="var(--atlas-tidal)"
                  stroke="var(--atlas-paper)"
                  strokeWidth={2}
                  label={{
                    value: `peak ${(peakJ.jaccard * 100).toFixed(0)}%`,
                    position: "top",
                    fill: "var(--atlas-tidal)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="tidal" dot>Jaccard = |A ∩ B| / |A ∪ B|</Chip>
            <Chip tone="amber" dot>Dice = 2|A ∩ B| / (|A| + |B|)</Chip>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
