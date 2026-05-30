"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  fetchAnalysis, fetchMatches, type AnalysisRow, type MatchRow,
} from "@/lib/duckdb/queries";

const FMT_PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
const FMT_NUM = (v: number, d = 3) => v.toFixed(d);

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Precision" value={analysis ? FMT_PCT(analysis.precision) : "—"} loading={loading} />
        <Kpi label="Recall"    value={analysis ? FMT_PCT(analysis.recall)    : "—"} loading={loading} />
        <Kpi label="F1"        value={analysis ? FMT_NUM(analysis.f1)         : "—"} loading={loading} />
        <Kpi label="Spearman"  value={analysis ? FMT_NUM(analysis.spearman)   : "—"} loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cluster Matches (≤ 5 km)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GT</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Dist (km)</TableHead>
                <TableHead className="text-right">GT rate</TableHead>
                <TableHead className="text-right">Model rate</TableHead>
                <TableHead className="text-right">GT size</TableHead>
                <TableHead className="text-right">Model size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              )}
              {!loading && matches && matches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No matches within 5&nbsp;km.
                  </TableCell>
                </TableRow>
              )}
              {!loading && matches?.map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{m.gt_cluster}</TableCell>
                  <TableCell>{m.model_cluster}</TableCell>
                  <TableCell className="text-right">{FMT_NUM(m.distance_km, 2)}</TableCell>
                  <TableCell className="text-right">{FMT_PCT(m.gt_rate)}</TableCell>
                  <TableCell className="text-right">{FMT_PCT(m.model_rate)}</TableCell>
                  <TableCell className="text-right">{m.gt_size}</TableCell>
                  <TableCell className="text-right">{m.model_size}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-semibold">{value}</p>}
      </CardContent>
    </Card>
  );
}
