import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { QuartileTab } from "@/components/tabs/QuartileTab";
import { JaccardTab } from "@/components/tabs/JaccardTab";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Phase 2 — validation tabs</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Seattle Spatial Microsimulation Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare any of 10 synthetic-population models against HTS ground truth across 890 Seattle CBSA census tracts.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quartile">Quartile</TabsTrigger>
            <TabsTrigger value="jaccard">Jaccard sweep</TabsTrigger>
            <TabsTrigger value="spatial" disabled>Spatial autocorr.</TabsTrigger>
            <TabsTrigger value="composite" disabled>Composite</TabsTrigger>
            <TabsTrigger value="highlow" disabled>High / low</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6"><OverviewTab /></TabsContent>
          <TabsContent value="quartile" className="space-y-6"><QuartileTab /></TabsContent>
          <TabsContent value="jaccard" className="space-y-6"><JaccardTab /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
