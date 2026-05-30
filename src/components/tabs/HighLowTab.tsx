"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useDashboardStore } from "@/lib/store/dashboard";
import { HIGHLOW_METHODS } from "@/lib/data";
import {
  fetchHighLowSummary, fetchHighLowConfusion,
  type HighLowSummary, type ConfusionRow,
} from "@/lib/duckdb/queries";

const PRETTY: Record<string, string> = {
  absolute_50: "Absolute 50%",
  median_split: "Median split",
  mean_split: "Mean split",
  tercile: "Terciles (LOW / MID / HIGH)",
  quartile: "Quartiles (Q1-Q4)",
  stddev: "Standard deviation",
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
    for (const r of confusion) {
      m[r.gt_class] ??= {};
      m[r.gt_class][r.model_class] = r.count;
    }
    return m;
  }, [confusion]);

  const gtCounts = summary ? JSON.parse(summary.gt_counts) as Record<string, number> : {};
  const modelCounts = summary ? JSON.parse(summary.model_counts) as Record<string, number> : {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification method</CardTitle>
          <CardDescription>
            Bucket every tract by telework rate, then check how often the model agrees with ground truth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={method} onValueChange={(v) => v && setMethod(v)}>
            <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HIGHLOW_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{PRETTY[m] ?? m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classification accuracy</CardTitle>
            <CardDescription>% of tracts in the same class as ground truth</CardDescription>
          </CardHeader>
          <CardContent>
            {summary ? (
              <p className="text-3xl font-semibold">{`${(summary.accuracy * 100).toFixed(1)}%`}</p>
            ) : <Skeleton className="h-9 w-20" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GT distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <ul className="space-y-1 text-sm">
                {Object.entries(gtCounts).sort().map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k}</span><span className="font-medium">{v}</span></li>
                ))}
              </ul>
            ) : <Skeleton className="h-12 w-full" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <ul className="space-y-1 text-sm">
                {Object.entries(modelCounts).sort().map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k}</span><span className="font-medium">{v}</span></li>
                ))}
              </ul>
            ) : <Skeleton className="h-12 w-full" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confusion matrix</CardTitle>
          <CardDescription>Rows = ground truth class; columns = model class.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">GT \\ Model</TableHead>
                {classes.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((rg) => (
                <TableRow key={rg}>
                  <TableCell className="font-medium">{rg}</TableCell>
                  {classes.map((rm) => (
                    <TableCell key={rm} className="text-right tabular-nums">
                      {matrix[rg]?.[rm] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
