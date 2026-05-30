"use client";

import { useEffect, useMemo, useState } from "react";

import { Panel, PanelHeader, PanelBody } from "@/components/atlas/Panel";
import { Chip } from "@/components/atlas/Chip";
import { Segmented } from "@/components/ui/segmented";
import { KpiCell, KpiRow } from "@/components/atlas/KpiCell";
import { Skeleton } from "@/components/ui/skeleton";

import { useDashboardStore } from "@/lib/store/dashboard";
import { HIGHLOW_METHODS } from "@/lib/data";
import {
  fetchHighLowSummary, fetchHighLowConfusion,
  type HighLowSummary, type ConfusionRow,
} from "@/lib/duckdb/queries";

const PRETTY: Record<string, string> = {
  absolute_50:  "≥ 50%",
  median_split: "Median",
  mean_split:   "Mean",
  tercile:      "Tercile",
  quartile:     "Quartile",
  stddev:       "± σ",
};
const CAPTION: Record<string, string> = {
  absolute_50:  "Fixed",
  median_split: "Split",
  mean_split:   "Split",
  tercile:      "3-way",
  quartile:     "4-way",
  stddev:       "3-way",
};

export function HighLowTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const [method, setMethod] = useState<string>("absolute_50");

  const [summary, setSummary] = useState<HighLowSummary | null>(null);
  const [confusion, setConfusion] = useState<ConfusionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setConfusion([]);
    Promise.all([
      fetchHighLowSummary(selectedModel, clusterType, method),
      fetchHighLowConfusion(selectedModel, clusterType, method),
    ]).then(([s, c]) => {
      if (cancelled) return;
      setSummary(s);
      setConfusion(c);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType, method]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const r of confusion) { set.add(r.gt_class); set.add(r.model_class); }
    return Array.from(set).sort();
  }, [confusion]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    let max = 0;
    for (const r of confusion) {
      m[r.gt_class] ??= {};
      m[r.gt_class][r.model_class] = r.count;
      if (r.count > max) max = r.count;
    }
    return { m, max };
  }, [confusion]);

  const gtCounts = summary ? JSON.parse(summary.gt_counts) as Record<string, number> : {};
  const modelCounts = summary ? JSON.parse(summary.model_counts) as Record<string, number> : {};

  return (
    <div className="space-y-8">
      <Panel>
        <PanelHeader
          sectionNo="§ 06"
          eyebrow="Classification scheme"
          title="Sort every tract into a class"
          description="Choose a partitioning rule, then ask whether the model places each tract in the same class as ground truth."
          trailing={summary ? <Chip tone="tidal">accuracy {(summary.accuracy * 100).toFixed(1)}%</Chip> : null}
        />
        <PanelBody>
          <Segmented<string>
            value={method}
            onChange={setMethod}
            options={HIGHLOW_METHODS.map((m) => ({
              value: m,
              label: PRETTY[m] ?? m,
              caption: CAPTION[m],
            }))}
          />
        </PanelBody>
      </Panel>

      <KpiRow columns={3}>
        <KpiCell
          label="Classification accuracy"
          value={summary ? `${(summary.accuracy * 100).toFixed(1)}%` : "—"}
          caption="% tracts in the same class as GT"
          bar={summary?.accuracy ?? null}
          tone="tidal"
          loading={!summary}
        />
        <ClassDistroCell label="Ground truth" counts={gtCounts} color="var(--atlas-evergreen)" loading={!summary} />
        <ClassDistroCell label="Selected model"  counts={modelCounts} color="var(--atlas-salmon)" loading={!summary} />
      </KpiRow>

      <Panel>
        <PanelHeader
          sectionNo="§ 07"
          eyebrow="Confusion matrix"
          title="Where the classes disagree"
          description="Rows = ground-truth class, columns = model class. Diagonal cells are correct; off-diagonals are where the model misplaces tracts."
        />
        <PanelBody>
          {confusion.length === 0 ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left atlas-eyebrow"></th>
                    {classes.map((c) => (
                      <th key={c} className="px-3 py-3 text-center atlas-eyebrow" style={{ color: "var(--atlas-salmon)" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((rg) => (
                    <tr key={rg}>
                      <td
                        className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em]"
                        style={{ color: "var(--atlas-evergreen)" }}
                      >
                        {rg}
                      </td>
                      {classes.map((rm) => {
                        const count = matrix.m[rg]?.[rm] ?? 0;
                        const ratio = matrix.max ? count / matrix.max : 0;
                        const diag = rg === rm;
                        return (
                          <td key={rm} className="p-1">
                            <div
                              className="relative flex h-16 items-center justify-center rounded-[3px] border transition-colors"
                              style={{
                                borderColor: diag ? "var(--atlas-tidal)" : "var(--atlas-rule)",
                                background: diag
                                  ? `oklch(0.80 0.12 200 / ${0.08 + 0.32 * ratio})`
                                  : `oklch(0.68 0.18 25 / ${ratio * 0.32})`,
                              }}
                            >
                              <span
                                className="font-mono tabular-nums"
                                style={{
                                  fontSize: ratio > 0.5 ? 18 : 14,
                                  color: diag ? "var(--atlas-tidal)" : "var(--atlas-ink)",
                                  textShadow: diag ? "0 0 12px oklch(0.80 0.12 200 / 0.45)" : undefined,
                                }}
                              >
                                {count}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="evergreen" dot>Rows · ground truth</Chip>
            <Chip tone="salmon" dot>Columns · model</Chip>
            <Chip tone="tidal">Diagonal = agreement</Chip>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function ClassDistroCell({
  label, counts, color, loading,
}: {
  label: string;
  counts: Record<string, number>;
  color: string;
  loading: boolean;
}) {
  const entries = Object.entries(counts).sort();
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="flex flex-col gap-3 border-b border-r border-[var(--atlas-rule)] px-4 py-4 last:border-r-0">
      <div className="flex items-start justify-between gap-3">
        <span className="atlas-eyebrow">{label} · distribution</span>
        <span
          aria-hidden
          className="inline-block size-[7px] rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      {loading ? (
        <div className="flex h-12 items-center">
          <Skeleton className="h-3 w-full" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-[var(--atlas-rule)]">
            {entries.map(([k, v], i) => (
              <div
                key={k}
                className="h-full"
                style={{
                  width: `${(v / total) * 100}%`,
                  background: color,
                  opacity: 0.35 + (i / Math.max(1, entries.length - 1)) * 0.6,
                  borderRight: i < entries.length - 1 ? "1px solid var(--atlas-paper)" : undefined,
                }}
                title={`${k} · ${v}`}
              />
            ))}
          </div>
          <ul className="space-y-0.5">
            {entries.map(([k, v]) => (
              <li key={k} className="flex justify-between font-mono text-[10.5px]">
                <span className="text-[var(--atlas-ink-subtle)] uppercase tracking-[0.14em]">{k}</span>
                <span className="tabular-nums text-[var(--atlas-ink)]">
                  {v} <span className="text-[var(--atlas-ink-subtle)]">·</span>{" "}
                  <span className="text-[var(--atlas-ink-subtle)]">{((v / total) * 100).toFixed(0)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
