"use client";

import * as React from "react";
import { Chip } from "./Chip";
import { useDashboardStore } from "@/lib/store/dashboard";
import { MODELS } from "@/lib/data";

/**
 * The editorial hero. Large serif headline, deck below, metadata strip across
 * the bottom. The deck functions as the lead paragraph in a feature story.
 *
 * Side: the current selected-model + cluster-type are surfaced in a
 * stacked summary on the right — gives the user a constant readout of
 * what they're looking at without scrolling to the sidebar.
 */
export function Hero() {
  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);
  const modelName = MODELS.find((m) => m.key === selectedModel)?.name ?? selectedModel;

  return (
    <section className="relative">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip dot tone="evergreen">Volume I</Chip>
              <Chip>Issue 04 — Telework</Chip>
              <Chip tone="tidal">{new Date().toISOString().slice(0, 10)}</Chip>
            </div>
            <h1 className="font-display text-[44px] leading-[1.02] font-medium tracking-[-0.012em] text-[var(--atlas-ink)] sm:text-[56px] md:text-[64px]">
              An atlas of
              <br />
              <span className="italic text-[var(--atlas-tidal)]">synthetic Seattle.</span>
            </h1>
            <p className="max-w-[58ch] font-display text-[18px] leading-[1.5] text-[var(--atlas-ink-dim)] sm:text-[20px]">
              Ten microsimulation models, eight hundred and ninety census tracts, one
              ground truth. Where do the simulated households agree with the surveyed
              ones — and where do they diverge?
            </p>
          </div>

          <div className="atlas-rule" />

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[12px] sm:grid-cols-4">
            <MetaPair label="Region" value="Seattle-Tacoma-Bellevue" />
            <MetaPair label="Tracts" value="890" mono />
            <MetaPair label="Models" value="10" mono />
            <MetaPair label="Ground truth" value="HTS" />
            <MetaPair label="Geometry" value="TIGER 2024" />
            <MetaPair label="Compute" value="DuckDB-WASM" />
            <MetaPair label="Tiles" value="PMTiles · 2.3MB" mono />
            <MetaPair label="Edition" value="§ 04.2025" mono />
          </dl>
        </div>

        {/* Right column: a "what you're looking at" reading card */}
        <aside className="relative hidden self-start rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-surface)] p-5 lg:block">
          <div className="atlas-eyebrow mb-3">Now reading</div>
          <div className="space-y-4">
            <div>
              <p className="atlas-eyebrow mb-1.5">Model</p>
              <p className="font-display text-[17px] font-medium leading-tight text-[var(--atlas-salmon)]">
                {modelName}
              </p>
            </div>
            <div>
              <p className="atlas-eyebrow mb-1.5">Compared against</p>
              <p className="font-display text-[14px] leading-tight text-[var(--atlas-evergreen)]">
                Ground truth · Household Travel Survey
              </p>
            </div>
            <div className="atlas-rule" />
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="atlas-eyebrow mb-1">Outcome</p>
                <p className="font-mono uppercase tracking-[0.1em] text-[var(--atlas-ink)]">
                  {clusterType === "yes" ? "Any telework" : "No telework"}
                </p>
              </div>
              <div>
                <p className="atlas-eyebrow mb-1">Threshold</p>
                <p className="font-mono uppercase tracking-[0.1em] text-[var(--atlas-ink)]">
                  {percentileMethod}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MetaPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="atlas-eyebrow">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-[12.5px] text-[var(--atlas-ink)]"
            : "text-[12.5px] text-[var(--atlas-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
