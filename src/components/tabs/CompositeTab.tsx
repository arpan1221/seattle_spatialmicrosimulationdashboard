"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from "recharts";

import { Panel, PanelHeader, PanelBody } from "@/components/atlas/Panel";
import { Chip } from "@/components/atlas/Chip";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardStore } from "@/lib/store/dashboard";
import { fetchComposite, fetchCompositeLeaderboard, type CompositeRow } from "@/lib/duckdb/queries";
import { MODELS } from "@/lib/data";

const MODEL_NAME = new Map(MODELS.map((m) => [m.key, m.name]));

const WEIGHTS = [
  { axis: "High Jaccard",     key: "high_jaccard",     weight: 0.30 },
  { axis: "Low Jaccard",      key: "low_jaccard",      weight: 0.20 },
  { axis: "Moran similarity", key: "moran_similarity", weight: 0.20 },
  { axis: "LISA agreement",   key: "lisa_agreement",   weight: 0.15 },
  { axis: "IQR ratio",        key: "iqr_ratio",        weight: 0.15 },
] as const;

function interpret(score: number) {
  if (score >= 0.85) return { label: "Excellent", tone: "evergreen" as const };
  if (score >= 0.70) return { label: "Good",      tone: "tidal" as const };
  if (score >= 0.55) return { label: "Moderate",  tone: "amber" as const };
  return                    { label: "Poor",      tone: "crimson" as const };
}

export function CompositeTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const [row, setRow] = useState<CompositeRow | null>(null);
  const [board, setBoard] = useState<CompositeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRow(null);
    Promise.all([
      fetchComposite(selectedModel, clusterType),
      fetchCompositeLeaderboard(clusterType),
    ]).then(([r, b]) => {
      if (cancelled) return;
      setRow(r);
      setBoard(b);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType]);

  if (!row) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[420px] w-full" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    );
  }

  const radarData = WEIGHTS.map((w) => ({
    axis: w.axis,
    value: row[w.key as keyof CompositeRow] as number,
  }));
  const verdict = interpret(row.composite);

  return (
    <div className="space-y-8">
      <Panel>
        <PanelHeader
          sectionNo="§ 05"
          eyebrow="Composite score"
          title="One number, five axes"
          description={
            <>
              A weighted blend of <span className="text-[var(--atlas-tidal)]">high Jaccard</span> (30%),
              <span className="text-[var(--atlas-tidal)]"> low Jaccard</span> (20%),
              <span className="text-[var(--atlas-tidal)]"> Moran similarity</span> (20%),
              <span className="text-[var(--atlas-tidal)]"> LISA agreement</span> (15%), and
              <span className="text-[var(--atlas-tidal)]"> IQR ratio</span> (15%). Higher is closer to ground truth.
            </>
          }
        />
        <PanelBody>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="relative flex flex-col items-center justify-center rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-paper)] px-6 py-8">
              <span className="atlas-eyebrow mb-3">Composite</span>
              <div className="relative">
                <p
                  className="atlas-numeric font-mono text-[88px] leading-none"
                  style={{ color: "var(--atlas-ink)" }}
                >
                  {row.composite.toFixed(2)}
                </p>
                <span className="absolute -right-6 bottom-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--atlas-ink-subtle)]">
                  /1.00
                </span>
              </div>
              <div className="mt-5">
                <Chip tone={verdict.tone} dot>{verdict.label}</Chip>
              </div>

              {/* Score band — a horizontal scale showing where this score sits */}
              <div className="mt-6 w-full space-y-2">
                <div className="relative h-1.5 w-full overflow-hidden rounded-[1px] bg-[var(--atlas-rule)]">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${row.composite * 100}%`,
                      background: `linear-gradient(90deg,
                        var(--atlas-crimson) 0%,
                        var(--atlas-amber) 55%,
                        var(--atlas-evergreen) 100%)`,
                    }}
                  />
                  {[0.55, 0.70, 0.85].map((t) => (
                    <div
                      key={t}
                      className="absolute top-0 h-full w-px bg-[var(--atlas-paper)]"
                      style={{ left: `${t * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--atlas-ink-subtle)]">
                  <span>Poor</span>
                  <span>Mod.</span>
                  <span>Good</span>
                  <span>Excellent</span>
                </div>
              </div>
            </div>

            <div className="h-[320px] w-full rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-paper)] p-4">
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius="78%">
                  <PolarGrid stroke="var(--atlas-rule)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: "var(--atlas-ink-dim)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 1]}
                    angle={45}
                    tick={{ fill: "var(--atlas-ink-subtle)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--atlas-surface)",
                      border: "1px solid var(--atlas-rule-strong)",
                      borderRadius: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                    formatter={(v) => Number(v).toFixed(3)}
                  />
                  <Radar
                    dataKey="value"
                    stroke="var(--atlas-tidal)"
                    fill="var(--atlas-tidal)"
                    fillOpacity={0.28}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          sectionNo="§ 06"
          eyebrow="Leaderboard"
          title="All ten models, ranked"
          description="Sorted by composite score for the current outcome. The current selection is highlighted."
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--atlas-rule)]">
                <Th align="right">Rank</Th>
                <Th>Model</Th>
                <Th align="right">High J</Th>
                <Th align="right">Low J</Th>
                <Th align="right">Moran sim</Th>
                <Th align="right">LISA</Th>
                <Th align="right">IQR</Th>
                <Th align="right">Composite</Th>
              </tr>
            </thead>
            <tbody>
              {board.map((b, i) => {
                const active = b.model === selectedModel;
                return (
                  <tr
                    key={b.model}
                    className={`border-b border-[var(--atlas-rule)] last:border-b-0 transition-colors ${
                      active ? "bg-[var(--atlas-surface-2)]" : "hover:bg-[var(--atlas-surface-2)]"
                    }`}
                  >
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-[12px] tabular-nums text-[var(--atlas-ink-subtle)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ background: active ? "var(--atlas-tidal)" : "var(--atlas-rule-strong)" }}
                        />
                        <div>
                          <p className="font-display text-[14px] font-medium leading-tight text-[var(--atlas-ink)]">
                            {MODEL_NAME.get(b.model) ?? b.model}
                          </p>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--atlas-ink-subtle)]">
                            {b.model}
                          </p>
                        </div>
                      </div>
                    </td>
                    <NumCell value={b.high_jaccard} />
                    <NumCell value={b.low_jaccard} />
                    <NumCell value={b.moran_similarity} />
                    <NumCell value={b.lisa_agreement} />
                    <NumCell value={b.iqr_ratio} />
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="relative h-[2px] w-16 overflow-hidden bg-[var(--atlas-rule)]">
                          <div
                            className="h-full"
                            style={{ width: `${b.composite * 100}%`, background: "var(--atlas-tidal)" }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-[13.5px] font-medium tabular-nums text-[var(--atlas-ink)]">
                          {b.composite.toFixed(3)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

function NumCell({ value }: { value: number }) {
  return (
    <td className="px-5 py-3.5 text-right font-mono text-[12px] tabular-nums text-[var(--atlas-ink-dim)]">
      {value.toFixed(3)}
    </td>
  );
}
