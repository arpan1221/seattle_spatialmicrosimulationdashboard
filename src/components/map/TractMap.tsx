"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { ensurePmtilesProtocol } from "@/lib/maplibre/pmtiles";
import { basemapStyle, labelsLayer } from "@/lib/maplibre/style";
import { COUNTIES_GEOJSON, SEATTLE_BBOX, TRACTS_PMTILES } from "@/lib/data";
import { fetchTracts, type TractRow } from "@/lib/duckdb/queries";
import { useDashboardStore } from "@/lib/store/dashboard";
import { cn } from "@/lib/utils";

interface TractMapProps {
  source: string;            // "gt" or a model key
  title: string;
  /** Visual variant — controls the choropleth color ramp. */
  variant: "evergreen" | "salmon";
  modelKey?: string;
}

const TRACT_SOURCE_ID = "tracts";
const TRACT_LAYER_ID = "tracts-fill";
const TRACT_OUTLINE_LAYER_ID = "tracts-outline";
const TRACT_HOVER_LAYER_ID = "tracts-hover";
const COUNTIES_SOURCE_ID = "counties";
const COUNTIES_LAYER_ID = "counties-outline";

/**
 * Choropleth ramps tuned for our dark editorial basemap.
 *
 * Each ramp is a 6-stop sequential that rises from a near-transparent
 * dark tone (matches the basemap, so low-rate tracts disappear into the
 * background) up to a luminous accent (so high-rate tracts visually
 * glow). This makes the dual-map comparison instantly readable —
 * the eye is drawn to the bright concentrations.
 */
const RAMPS = {
  evergreen: [
    [0.00, "oklch(0.32 0.04 165 / 0.55)"],
    [0.10, "oklch(0.42 0.06 165 / 0.75)"],
    [0.30, "oklch(0.55 0.10 165 / 0.85)"],
    [0.50, "oklch(0.68 0.13 165 / 0.92)"],
    [0.75, "oklch(0.80 0.15 165 / 0.96)"],
    [1.00, "oklch(0.92 0.16 160 / 1.00)"],
  ],
  salmon: [
    [0.00, "oklch(0.30 0.04 30 / 0.55)"],
    [0.10, "oklch(0.42 0.06 30 / 0.75)"],
    [0.30, "oklch(0.55 0.11 30 / 0.85)"],
    [0.50, "oklch(0.70 0.14 30 / 0.92)"],
    [0.75, "oklch(0.82 0.16 30 / 0.96)"],
    [1.00, "oklch(0.92 0.17 35 / 1.00)"],
  ],
} as const;

function rampPaintExpr(variant: "evergreen" | "salmon"): unknown[] {
  const stops = RAMPS[variant];
  const out: unknown[] = ["interpolate", ["linear"], ["feature-state", "value"]];
  for (const [pos, color] of stops) out.push(pos, color);
  return [
    "case",
    ["==", ["feature-state", "value"], null],
    "oklch(0.22 0.013 240 / 0.4)",
    out,
  ];
}

export function TractMap({ source, title, variant, modelKey }: TractMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [tractCount, setTractCount] = useState(0);
  const [meanValue, setMeanValue] = useState<number | null>(null);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);
  const setHoveredGeoid = useDashboardStore((s) => s.setHoveredGeoid);

  // Boot the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle,
      bounds: SEATTLE_BBOX,
      fitBoundsOptions: { padding: 30 },
      attributionControl: { compact: true },
      maxZoom: 12,
      minZoom: 7,
    });
    mapRef.current = map;

    map.on("load", async () => {
      map.addSource(TRACT_SOURCE_ID, {
        type: "vector",
        url: `pmtiles://${new URL(TRACTS_PMTILES, window.location.origin).toString()}`,
        promoteId: "GEOID",
      });

      map.addLayer({
        id: TRACT_LAYER_ID,
        type: "fill",
        source: TRACT_SOURCE_ID,
        "source-layer": "tracts",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paint: { "fill-color": rampPaintExpr(variant) as any },
      });

      map.addLayer({
        id: TRACT_OUTLINE_LAYER_ID,
        type: "line",
        source: TRACT_SOURCE_ID,
        "source-layer": "tracts",
        paint: {
          "line-color": "oklch(0.92 0.012 80 / 0.10)",
          "line-width": 0.4,
        },
      });

      // Hover halo
      map.addLayer({
        id: TRACT_HOVER_LAYER_ID,
        type: "line",
        source: TRACT_SOURCE_ID,
        "source-layer": "tracts",
        paint: {
          "line-color": "oklch(0.94 0.012 80 / 0.95)",
          "line-width": [
            "case", ["boolean", ["feature-state", "hover"], false], 1.4, 0,
          ],
        },
      });

      // Counties on top of the choropleth so boundaries read clearly.
      try {
        const counties = await fetch(COUNTIES_GEOJSON).then((r) => r.json());
        map.addSource(COUNTIES_SOURCE_ID, { type: "geojson", data: counties });
        map.addLayer({
          id: COUNTIES_LAYER_ID,
          type: "line",
          source: COUNTIES_SOURCE_ID,
          paint: {
            "line-color": "oklch(0.94 0.012 80 / 0.55)",
            "line-width": 0.9,
            "line-dasharray": [3, 2],
          },
        });
      } catch (e) {
        console.warn("counties overlay failed", e);
      }

      // Place labels appear above everything.
      map.addSource("carto-labels", {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
          "https://d.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        maxzoom: 19,
      });
      map.addLayer({
        ...labelsLayer,
        source: "carto-labels",
      });

      // Hover interaction.
      let lastHoverId: string | null = null;
      map.on("mousemove", TRACT_LAYER_ID, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.id ?? f.properties?.GEOID ?? "");
        if (lastHoverId && lastHoverId !== id) {
          map.setFeatureState(
            { source: TRACT_SOURCE_ID, sourceLayer: "tracts", id: lastHoverId },
            { hover: false },
          );
        }
        lastHoverId = id;
        map.setFeatureState(
          { source: TRACT_SOURCE_ID, sourceLayer: "tracts", id },
          { hover: true },
        );
        setHoveredGeoid(id);
        map.getCanvas().style.cursor = "crosshair";
      });
      map.on("mouseleave", TRACT_LAYER_ID, () => {
        if (lastHoverId) {
          map.setFeatureState(
            { source: TRACT_SOURCE_ID, sourceLayer: "tracts", id: lastHoverId },
            { hover: false },
          );
          lastHoverId = null;
        }
        setHoveredGeoid(null);
        map.getCanvas().style.cursor = "";
      });

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recolor when data changes.
  useEffect(() => {
    if (!styleReady) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const rows: TractRow[] = await fetchTracts(source, clusterType, percentileMethod);
      if (cancelled) return;
      const valueKey = clusterType === "yes" ? "prop_yes" : "prop_no";
      let sum = 0;
      let n = 0;
      for (const r of rows) {
        const value = (r as unknown as Record<string, number>)[valueKey];
        if (typeof value === "number" && Number.isFinite(value)) {
          sum += value;
          n += 1;
        }
        map.setFeatureState(
          { source: TRACT_SOURCE_ID, sourceLayer: "tracts", id: r.GEOID },
          { value, cluster: r.cluster },
        );
      }
      setTractCount(n);
      setMeanValue(n ? sum / n : null);
    })().catch((e) => console.error("fetchTracts failed", e));

    return () => { cancelled = true; };
  }, [styleReady, source, clusterType, percentileMethod]);

  const accent = variant === "evergreen" ? "var(--atlas-evergreen)" : "var(--atlas-salmon)";

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-surface)]">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--atlas-rule)] px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-[7px] rounded-full"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
            <span className="atlas-eyebrow">
              {variant === "evergreen" ? "Ground truth" : "Selected model"}
            </span>
            {modelKey && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--atlas-ink-subtle)]">
                · {modelKey}
              </span>
            )}
          </div>
          <p className="truncate font-display text-[14.5px] font-medium leading-tight text-[var(--atlas-ink)]">
            {title}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="atlas-eyebrow leading-tight">Mean rate</p>
          <p className="font-mono text-[14px] tabular text-[var(--atlas-ink)]">
            {meanValue == null ? "—" : `${(meanValue * 100).toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Map canvas */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {/* Footer: ramp legend */}
      <div className="flex items-center gap-3 border-t border-[var(--atlas-rule)] px-4 py-3">
        <span className="atlas-eyebrow">0%</span>
        <div
          className={cn("h-2 flex-1 rounded-[2px]")}
          style={{
            background: `linear-gradient(90deg, ${RAMPS[variant].map(([p, c]) => `${c} ${(p as number) * 100}%`).join(", ")})`,
            boxShadow: "inset 0 0 0 1px var(--atlas-rule)",
          }}
        />
        <span className="atlas-eyebrow">100%</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--atlas-ink-subtle)]">
          · n = {tractCount || "—"}
        </span>
      </div>
    </div>
  );
}
