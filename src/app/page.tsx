import { Badge } from "@/components/ui/badge";
import { DualMap } from "@/components/map/DualMap";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Metrics } from "@/components/metrics/Metrics";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Phase 1 — Dual Map</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Seattle Spatial Microsimulation Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare any of the 10 synthetic-population models against HTS ground truth across 890 Seattle CBSA census tracts.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />
        <div className="space-y-6">
          <DualMap />
          <Metrics />
        </div>
      </div>
    </main>
  );
}
