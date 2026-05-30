import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PHASES = [
  { label: "Phase 0", title: "Scaffold + precompute skeleton", status: "in progress" },
  { label: "Phase 1", title: "Tab 1 dual map + KPI cards", status: "pending" },
  { label: "Phase 2", title: "Quartile / Jaccard / cluster matching", status: "pending" },
  { label: "Phase 3", title: "Moran's I / LISA + composite + high-low", status: "pending" },
  { label: "Phase 4", title: "Polish, dark mode, cacheTag invalidation", status: "pending" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <Badge variant="secondary">Phase 0 scaffold</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Seattle Spatial Microsimulation Dashboard
        </h1>
        <p className="text-muted-foreground">
          Production rebuild of the streamlit validation app. Next.js 16 + MapLibre +
          PMTiles + DuckDB-WASM, with all heavy Python pre-computed in CI.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Build plan</CardTitle>
          <CardDescription>Five short phases, ~2 weeks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PHASES.map((p) => (
            <div key={p.label} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-sm text-muted-foreground">{p.title}</p>
              </div>
              <Badge variant={p.status === "in progress" ? "default" : "outline"}>
                {p.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
