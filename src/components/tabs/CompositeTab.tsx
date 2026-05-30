"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  fetchComposite, fetchCompositeLeaderboard,
  type CompositeRow,
} from "@/lib/duckdb/queries";
import { MODELS } from "@/lib/data";

const MODEL_NAME = new Map(MODELS.map((m) => [m.key, m.name]));

const WEIGHTS = [
  { axis: "High Jaccard",    key: "high_jaccard",     weight: 0.30 },
  { axis: "Low Jaccard",     key: "low_jaccard",      weight: 0.20 },
  { axis: "Moran similarity", key: "moran_similarity", weight: 0.20 },
  { axis: "LISA agreement",  key: "lisa_agreement",   weight: 0.15 },
  { axis: "IQR ratio",       key: "iqr_ratio",        weight: 0.15 },
] as const;

function interpret(score: number) {
  if (score >= 0.85) return { label: "Excellent", tone: "positive" as const };
  if (score >= 0.70) return { label: "Good", tone: "positive" as const };
  if (score >= 0.55) return { label: "Moderate", tone: "neutral" as const };
  return { label: "Poor", tone: "warning" as const };
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
      <div className="space-y-4">
        <Skeleton className="h-[360px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const radarData = WEIGHTS.map((w) => ({
    axis: w.axis,
    value: row[w.key as keyof CompositeRow] as number,
  }));
  const verdict = interpret(row.composite);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composite validation score</CardTitle>
          <CardDescription>
            Weighted blend of high&nbsp;Jaccard (30%), low&nbsp;Jaccard (20%), Moran similarity (20%),
            LISA agreement (15%), and IQR ratio (15%).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-md border p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Composite</p>
              <p className="text-5xl font-semibold">{row.composite.toFixed(3)}</p>
              <Badge className="mt-3" variant={verdict.tone === "warning" ? "destructive" : "secondary"}>
                {verdict.label}
              </Badge>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} angle={45} />
                  <Tooltip formatter={(v) => Number(v).toFixed(3)} />
                  <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
          <CardDescription>All 10 models for this cluster type, ranked by composite.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">High&nbsp;J</TableHead>
                <TableHead className="text-right">Low&nbsp;J</TableHead>
                <TableHead className="text-right">Moran sim</TableHead>
                <TableHead className="text-right">LISA</TableHead>
                <TableHead className="text-right">IQR</TableHead>
                <TableHead className="text-right">Composite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {board.map((b, i) => (
                <TableRow key={b.model} className={b.model === selectedModel ? "bg-muted/40" : undefined}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{MODEL_NAME.get(b.model) ?? b.model}</TableCell>
                  <TableCell className="text-right">{b.high_jaccard.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{b.low_jaccard.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{b.moran_similarity.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{b.lisa_agreement.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{b.iqr_ratio.toFixed(3)}</TableCell>
                  <TableCell className="text-right font-semibold">{b.composite.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
