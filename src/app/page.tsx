import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

import { Brandmark } from "@/components/atlas/Brandmark";
import { Hero } from "@/components/atlas/Hero";
import { TabRail } from "@/components/atlas/TabRail";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { QuartileTab } from "@/components/tabs/QuartileTab";
import { JaccardTab } from "@/components/tabs/JaccardTab";
import { SpatialTab } from "@/components/tabs/SpatialTab";
import { CompositeTab } from "@/components/tabs/CompositeTab";
import { HighLowTab } from "@/components/tabs/HighLowTab";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-12 px-6 pb-24 pt-8 lg:px-10">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between">
        <Brandmark />
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/arpan1221/seattle_spatialmicrosimulationdashboard"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--atlas-ink-subtle)] transition-colors hover:text-[var(--atlas-ink)]"
          >
            Source ↗
          </a>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--atlas-ink-dim)] hover:text-[var(--atlas-ink)]">
                Controls ↗
              </SheetTrigger>
              <SheetContent side="left" className="w-80 border-[var(--atlas-rule)] bg-[var(--atlas-paper)] p-4">
                <SheetHeader>
                  <SheetTitle className="font-display">Controls</SheetTitle>
                  <SheetDescription className="font-mono text-[10.5px] uppercase tracking-[0.16em]">
                    Model · outcome · threshold
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5"><Sidebar /></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <Hero />

      {/* ── Main spread: sidebar + tabbed content ────────────────── */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <Tabs defaultValue="overview" className="min-w-0 space-y-8">
          <TabRail />

          <TabsContent value="overview"  className="space-y-10 outline-none"><OverviewTab  /></TabsContent>
          <TabsContent value="quartile"  className="space-y-10 outline-none"><QuartileTab  /></TabsContent>
          <TabsContent value="jaccard"   className="space-y-10 outline-none"><JaccardTab   /></TabsContent>
          <TabsContent value="spatial"   className="space-y-10 outline-none"><SpatialTab   /></TabsContent>
          <TabsContent value="composite" className="space-y-10 outline-none"><CompositeTab /></TabsContent>
          <TabsContent value="highlow"   className="space-y-10 outline-none"><HighLowTab   /></TabsContent>
        </Tabs>
      </div>

      {/* ── Editorial colophon ──────────────────────────────────── */}
      <footer className="border-t border-[var(--atlas-rule)] pt-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="atlas-eyebrow">Colophon</p>
            <p className="text-[12px] leading-relaxed text-[var(--atlas-ink-dim)]">
              Set in <span className="italic">Fraunces</span> and Geist;
              numerical readings in JetBrains Mono. Cartography by MapLibre GL JS
              against PMTiles tract geometry, with CARTO dark basemap tiles below.
            </p>
          </div>
          <div className="space-y-2">
            <p className="atlas-eyebrow">Methods</p>
            <p className="text-[12px] leading-relaxed text-[var(--atlas-ink-dim)]">
              OPTICS clustering with haversine metric · libpysal Queen contiguity
              for Moran&apos;s I &amp; LISA · scipy KS test · Jaccard &amp; Dice
              sweep · 5 km centroid match.
            </p>
          </div>
          <div className="space-y-2">
            <p className="atlas-eyebrow">Compute</p>
            <p className="text-[12px] leading-relaxed text-[var(--atlas-ink-dim)]">
              Heavy statistics pre-computed in Python; everything you see is read
              from Parquet artifacts at runtime via DuckDB-WASM. No server.
            </p>
          </div>
        </div>
        <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--atlas-ink-subtle)]">
          Seattle / Spatial Atlas — Volume I · An open research dashboard.
        </p>
      </footer>
    </main>
  );
}
