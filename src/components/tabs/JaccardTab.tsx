"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (!rows) {
    return <Skeleton className="h-[420px] w-full" />;
  }

  const peak = rows.reduce(
    (best, r) => (r.jaccard > best.jaccard ? r : best),
    rows[0] ?? { threshold: 0, jaccard: 0, dice: 0 } as JaccardRow,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jaccard / Dice sweep</CardTitle>
        <CardDescription>
          Set-overlap between ground-truth and model tracts at each rate threshold from 10% to 95%.
          Peak Jaccard {(peak.jaccard * 100).toFixed(1)}% at threshold {Math.round(peak.threshold * 100)}%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[360px] w-full">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis
                dataKey="threshold"
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={{ fontSize: 12 }}
                label={{ value: "Telework rate threshold", position: "insideBottom", offset: -2, fontSize: 12 }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                labelFormatter={(v) => `Threshold ${Math.round(Number(v) * 100)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="jaccard" stroke="#7c3aed" strokeWidth={2} dot={false} name="Jaccard" />
              <Line type="monotone" dataKey="dice"    stroke="#f97316" strokeWidth={2} dot={false} name="Dice" />
              <ReferenceDot x={peak.threshold} y={peak.jaccard} r={4} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
