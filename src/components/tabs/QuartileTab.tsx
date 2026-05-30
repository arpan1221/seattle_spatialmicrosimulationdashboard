"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  fetchDistributions, fetchQuartile, type QuartileRow,
} from "@/lib/duckdb/queries";

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
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IQR ratio</CardTitle>
            <CardDescription>min(IQR) / max(IQR), 1.0 = identical spread</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-semibold">{iqrRatio.toFixed(3)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KS statistic</CardTitle>
            <CardDescription>Kolmogorov–Smirnov, smaller is closer</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-semibold">{ksStat.toFixed(3)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KS p-value</CardTitle>
            <CardDescription>High p means the distributions are statistically similar</CardDescription>
          </CardHeader>
          <CardContent><p className="text-3xl font-semibold">{ksP.toExponential(2)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quartile Jaccard similarity</CardTitle>
          <CardDescription>
            How well the high (≥ percentile) and low (≤ percentile) tract sets match ground truth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="percentile" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0.85} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "0.85 highly stable", fontSize: 11, position: "right" }} />
                <ReferenceLine y={0.60} stroke="#ea580c" strokeDasharray="4 4" label={{ value: "0.60 moderate", fontSize: 11, position: "right" }} />
                <Line type="monotone" dataKey="high_jaccard" stroke="#dc2626" strokeWidth={2} name="High concentration" />
                <Line type="monotone" dataKey="low_jaccard"  stroke="#2563eb" strokeWidth={2} name="Low concentration" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution overlay</CardTitle>
          <CardDescription>Per-tract telework rate, ground truth vs selected model.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <BarChart data={distBins} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => Number(v).toFixed(0)}
                  labelFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gt"    fill="#2563eb" fillOpacity={0.55} name="Ground truth" />
                <Bar dataKey="model" fill="#dc2626" fillOpacity={0.55} name="Model" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Percentile thresholds</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Percentile</TableHead>
                <TableHead className="text-right">GT thr.</TableHead>
                <TableHead className="text-right">Model thr.</TableHead>
                <TableHead className="text-right">High Jaccard</TableHead>
                <TableHead className="text-right">Low Jaccard</TableHead>
                <TableHead className="text-right">High ∩</TableHead>
                <TableHead className="text-right">GT only</TableHead>
                <TableHead className="text-right">Model only</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.percentile}>
                  <TableCell className="font-medium">{r.percentile}</TableCell>
                  <TableCell className="text-right">{`${(r.gt_threshold * 100).toFixed(1)}%`}</TableCell>
                  <TableCell className="text-right">{`${(r.model_threshold * 100).toFixed(1)}%`}</TableCell>
                  <TableCell className="text-right">{`${(r.high_jaccard * 100).toFixed(1)}%`}</TableCell>
                  <TableCell className="text-right">{`${(r.low_jaccard * 100).toFixed(1)}%`}</TableCell>
                  <TableCell className="text-right">{r.high_intersection}</TableCell>
                  <TableCell className="text-right">{r.gt_only_high}</TableCell>
                  <TableCell className="text-right">{r.model_only_high}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
