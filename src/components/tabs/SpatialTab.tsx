"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useDashboardStore } from "@/lib/store/dashboard";
import { fetchSpatial, type SpatialRow } from "@/lib/duckdb/queries";

export function SpatialTab() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const [row, setRow] = useState<SpatialRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSpatial(selectedModel, clusterType).then((r) => {
      if (cancelled) return;
      setRow(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedModel, clusterType]);

  if (loading || !row) return <Skeleton className="h-[360px] w-full" />;

  const moranDiff = Math.abs(row.moran_i - row.gt_moran_i);
  const moranSimilarity = Math.max(0, 1 - moranDiff);
  const verdict =
    row.moran_i > 0 && row.gt_moran_i > 0
      ? { label: "Both clustered", tone: "positive" as const }
      : row.moran_i < 0 && row.gt_moran_i < 0
        ? { label: "Both dispersed", tone: "neutral" as const }
        : { label: "Diverging patterns", tone: "warning" as const };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Moran&apos;s I</CardTitle>
          <CardDescription>
            Measures whether high-rate tracts cluster together. I&nbsp;&gt;&nbsp;0 = clustering,
            I&nbsp;&lt;&nbsp;0 = dispersion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Stat label="Ground truth I" value={row.gt_moran_i.toFixed(3)} caption={`p = ${row.gt_moran_p.toExponential(2)}`} />
            <Stat label="Model I" value={row.moran_i.toFixed(3)} caption={`p = ${row.moran_p.toExponential(2)}`} />
            <Stat label="Similarity" value={moranSimilarity.toFixed(3)} caption={`Δ = ${moranDiff.toFixed(3)}`} />
          </div>
          <div className="mt-4">
            <Badge variant={verdict.tone === "warning" ? "destructive" : "secondary"}>{verdict.label}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local Indicators of Spatial Association (LISA)</CardTitle>
          <CardDescription>How well per-tract HH/LL/HL/LH regimes match ground truth.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Stat
              label="Significance agreement"
              value={`${(row.lisa_significance_agreement * 100).toFixed(1)}%`}
              caption="% tracts with matching significance status"
            />
            <Stat
              label="Regime agreement"
              value={`${(row.lisa_regime_agreement * 100).toFixed(1)}%`}
              caption="% tracts in the same LISA quadrant"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
