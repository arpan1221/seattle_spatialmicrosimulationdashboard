import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { QuartileTab } from "@/components/tabs/QuartileTab";
import { JaccardTab } from "@/components/tabs/JaccardTab";
import { SpatialTab } from "@/components/tabs/SpatialTab";
import { CompositeTab } from "@/components/tabs/CompositeTab";
import { HighLowTab } from "@/components/tabs/HighLowTab";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="secondary">7 analysis tabs · 10 IPF models · 890 tracts</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">
            Seattle Spatial Microsimulation Dashboard
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Compare synthetic-population microsimulation models against HTS ground truth across the
            Seattle CBSA. Geometry shipped once via PMTiles; everything else is a SQL query against
            pre-computed Parquet artifacts running in DuckDB-WASM.
          </p>
        </div>
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
              Controls
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-4">
              <SheetHeader>
                <SheetTitle>Controls</SheetTitle>
                <SheetDescription>Model, cluster type, percentile method.</SheetDescription>
              </SheetHeader>
              <div className="mt-4"><Sidebar /></div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden lg:block"><Sidebar /></div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quartile">Quartile</TabsTrigger>
            <TabsTrigger value="jaccard">Jaccard sweep</TabsTrigger>
            <TabsTrigger value="spatial">Spatial autocorr.</TabsTrigger>
            <TabsTrigger value="composite">Composite</TabsTrigger>
            <TabsTrigger value="highlow">High / low</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"  className="space-y-6"><OverviewTab  /></TabsContent>
          <TabsContent value="quartile"  className="space-y-6"><QuartileTab  /></TabsContent>
          <TabsContent value="jaccard"   className="space-y-6"><JaccardTab   /></TabsContent>
          <TabsContent value="spatial"   className="space-y-6"><SpatialTab   /></TabsContent>
          <TabsContent value="composite" className="space-y-6"><CompositeTab /></TabsContent>
          <TabsContent value="highlow"   className="space-y-6"><HighLowTab   /></TabsContent>
        </Tabs>
      </div>

      <footer className="border-t pt-6 text-xs text-muted-foreground">
        <p>
          Data: HTS proportions · TIGER 2024 tracts/CBSA · TIGER 2025 counties · 10 IPF model
          outputs · OPTICS clustering · Queen-contiguity Moran&apos;s I + LISA · Haversine cluster matching.
          Pre-computed in CI; rendered in MapLibre + DuckDB-WASM.
        </p>
      </footer>
    </main>
  );
}
