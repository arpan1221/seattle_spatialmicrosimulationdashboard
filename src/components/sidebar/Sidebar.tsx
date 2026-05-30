"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useDashboardStore } from "@/lib/store/dashboard";
import {
  MODELS, CLUSTER_TYPES, PERCENTILE_METHODS, type ClusterType, type PercentileMethod,
} from "@/lib/data";

export function Sidebar() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const setSelectedModel = useDashboardStore((s) => s.setSelectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const setClusterType = useDashboardStore((s) => s.setClusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);
  const setPercentileMethod = useDashboardStore((s) => s.setPercentileMethod);

  const modelChoices = MODELS.filter((m) => m.key !== "gt");

  return (
    <Card className="sticky top-4 h-fit">
      <CardHeader>
        <CardTitle className="text-base">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">IPF Model</label>
          <Select value={selectedModel} onValueChange={(v) => v && setSelectedModel(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {modelChoices.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Cluster Type</label>
          <Select value={clusterType} onValueChange={(v) => v && setClusterType(v as ClusterType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLUSTER_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "yes" ? "Telework (any days)" : "No telework"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Percentile Method</label>
          <Select value={percentileMethod} onValueChange={(v) => v && setPercentileMethod(v as PercentileMethod)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERCENTILE_METHODS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
