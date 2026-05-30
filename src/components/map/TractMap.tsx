"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { ensurePmtilesProtocol } from "@/lib/maplibre/pmtiles";
import { basemapStyle } from "@/lib/maplibre/style";
import { COUNTIES_GEOJSON, SEATTLE_BBOX, TRACTS_PMTILES } from "@/lib/data";
import { fetchTracts, type TractRow } from "@/lib/duckdb/queries";
import { useDashboardStore } from "@/lib/store/dashboard";

interface TractMapProps {
  /** "gt" for ground truth or a model key like "df2" */
  source: string;
  title: string;
}

const TRACT_SOURCE_ID = "tracts";
const TRACT_LAYER_ID = "tracts-fill";
const TRACT_OUTLINE_LAYER_ID = "tracts-outline";
const COUNTIES_SOURCE_ID = "counties";
const COUNTIES_LAYER_ID = "counties-outline";

/**
 * Single MapLibre map. Geometry is shipped via PMTiles once; on every
 * (model, clusterType, percentileMethod) change we fetch a tiny tract→value
 * table via DuckDB-WASM and push it as feature-state for a paint-expression
 * recolor. No geometry re-uploads, sub-10ms swaps.
 */
export function TractMap({ source, title }: TractMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);

  // boot map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle,
      bounds: SEATTLE_BBOX,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
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
        paint: {
          "fill-color": [
            "case",
            ["==", ["feature-state", "value"], null], "#e5e7eb",
            [
              "interpolate", ["linear"], ["feature-state", "value"],
              0, "#f7fbff",
              0.1, "#deebf7",
              0.2, "#c6dbef",
              0.3, "#9ecae1",
              0.4, "#6baed6",
              0.5, "#4292c6",
              0.6, "#2171b5",
              0.7, "#08519c",
              1, "#08306b",
            ],
          ],
          "fill-opacity": 0.75,
        },
      });
      map.addLayer({
        id: TRACT_OUTLINE_LAYER_ID,
        type: "line",
        source: TRACT_SOURCE_ID,
        "source-layer": "tracts",
        paint: { "line-color": "#cbd5e1", "line-width": 0.4 },
      });

      // counties as overlay
      try {
        const counties = await fetch(COUNTIES_GEOJSON).then((r) => r.json());
        map.addSource(COUNTIES_SOURCE_ID, { type: "geojson", data: counties });
        map.addLayer({
          id: COUNTIES_LAYER_ID,
          type: "line",
          source: COUNTIES_SOURCE_ID,
          paint: { "line-color": "#111827", "line-width": 1.5 },
        });
      } catch (e) {
        console.warn("counties overlay failed", e);
      }

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // recolor on (source, clusterType, percentileMethod) change
  useEffect(() => {
    if (!styleReady) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const rows: TractRow[] = await fetchTracts(source, clusterType, percentileMethod);
      if (cancelled) return;
      const valueKey = clusterType === "yes" ? "prop_yes" : "prop_no";
      for (const r of rows) {
        const value = (r as unknown as Record<string, number>)[valueKey];
        map.setFeatureState(
          { source: TRACT_SOURCE_ID, sourceLayer: "tracts", id: r.GEOID },
          { value, cluster: r.cluster },
        );
      }
    })().catch((e) => console.error("fetchTracts failed", e));

    return () => {
      cancelled = true;
    };
  }, [styleReady, source, clusterType, percentileMethod]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border bg-muted">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-3 py-1 text-sm font-medium shadow-sm backdrop-blur">
        {title}
      </div>
    </div>
  );
}
