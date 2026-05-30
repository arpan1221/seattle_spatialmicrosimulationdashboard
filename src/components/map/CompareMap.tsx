"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { ensurePmtilesProtocol } from "@/lib/maplibre/pmtiles";
import { basemapStyle } from "@/lib/maplibre/style";
import { COUNTIES_GEOJSON, SEATTLE_BBOX, TRACTS_PMTILES, MODELS } from "@/lib/data";
import { fetchTracts } from "@/lib/duckdb/queries";
import { useDashboardStore } from "@/lib/store/dashboard";

/**
 * CompareMap — a single full-bleed map with a draggable vertical curtain
 * separating ground truth (evergreen, left) from the selected model
 * (salmon, right). Two synchronized MapLibre instances are stacked;
 * the top one is clipped by `clip-path: inset(0 0 0 N%)` so it only
 * paints to the right of the divider.
 *
 * This replaces the original DualMap. It shows both signals in the
 * same geographic frame so divergence reads directly: drag the curtain
 * and watch tracts shift between palettes.
 */

const TRACT_SOURCE = "tracts";
const TRACT_LAYER = "tracts-fill";
const TRACT_OUTLINE = "tracts-outline";
const COUNTIES_SOURCE = "counties";
const COUNTIES_LAYER = "counties-outline";
const TRACT_HOVER = "tracts-hover";

const RAMPS = {
  evergreen: [
    [0.00, "oklch(0.30 0.04 165 / 0.55)"],
    [0.10, "oklch(0.42 0.06 165 / 0.78)"],
    [0.30, "oklch(0.55 0.10 165 / 0.88)"],
    [0.50, "oklch(0.68 0.13 165 / 0.93)"],
    [0.75, "oklch(0.80 0.15 165 / 0.97)"],
    [1.00, "oklch(0.92 0.16 160 / 1.00)"],
  ],
  salmon: [
    [0.00, "oklch(0.28 0.04 30 / 0.55)"],
    [0.10, "oklch(0.42 0.06 30 / 0.78)"],
    [0.30, "oklch(0.55 0.11 30 / 0.88)"],
    [0.50, "oklch(0.70 0.14 30 / 0.93)"],
    [0.75, "oklch(0.82 0.16 30 / 0.97)"],
    [1.00, "oklch(0.92 0.17 35 / 1.00)"],
  ],
} as const;

type Variant = keyof typeof RAMPS;

function rampExpr(variant: Variant): unknown[] {
  const stops = RAMPS[variant];
  const interp: unknown[] = ["interpolate", ["linear"], ["feature-state", "value"]];
  for (const [pos, color] of stops) interp.push(pos, color);
  return [
    "case",
    ["==", ["feature-state", "value"], null],
    "oklch(0.20 0.013 240 / 0.25)",
    interp,
  ];
}

export function CompareMap() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftMap = useRef<maplibregl.Map | null>(null);
  const rightMap = useRef<maplibregl.Map | null>(null);
  const syncing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lookupRef = useRef<Record<string, { gt?: number; md?: number }>>({});

  const [divider, setDivider] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [hover, setHover] = useState<{
    geoid: string; gt: number | null; md: number | null;
    x: number; y: number;
  } | null>(null);

  const selectedModel = useDashboardStore((s) => s.selectedModel);
  const clusterType = useDashboardStore((s) => s.clusterType);
  const percentileMethod = useDashboardStore((s) => s.percentileMethod);
  const modelName = MODELS.find((m) => m.key === selectedModel)?.name ?? selectedModel;

  // Init both maps once.
  useEffect(() => {
    if (!leftRef.current || !rightRef.current || leftMap.current) return;
    ensurePmtilesProtocol();

    const buildMap = (container: HTMLDivElement, variant: Variant, withAttrib: boolean) => {
      const map = new maplibregl.Map({
        container,
        // deep-clone the style so each map can mutate its own paint expressions
        style: JSON.parse(JSON.stringify(basemapStyle)),
        bounds: SEATTLE_BBOX,
        fitBoundsOptions: { padding: 40 },
        attributionControl: withAttrib ? { compact: true } : false,
        maxZoom: 12,
        minZoom: 7,
        // Right map: don't capture pointer events when it's clipped
        // (the LEFT half is invisible but still under the cursor).
        // We rely on pointer-events on the wrapper instead.
      });

      map.on("load", () => {
        const pmUrl = `pmtiles://${new URL(TRACTS_PMTILES, window.location.origin).toString()}`;
        map.addSource(TRACT_SOURCE, {
          type: "vector",
          url: pmUrl,
          promoteId: "GEOID",
        });
        map.addLayer({
          id: TRACT_LAYER,
          type: "fill",
          source: TRACT_SOURCE,
          "source-layer": "tracts",
          paint: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "fill-color": rampExpr(variant) as any,
          },
        });
        map.addLayer({
          id: TRACT_OUTLINE,
          type: "line",
          source: TRACT_SOURCE,
          "source-layer": "tracts",
          paint: {
            "line-color": "oklch(0.92 0.012 80 / 0.10)",
            "line-width": 0.4,
          },
        });
        map.addLayer({
          id: TRACT_HOVER,
          type: "line",
          source: TRACT_SOURCE,
          "source-layer": "tracts",
          paint: {
            "line-color": "oklch(0.94 0.012 80 / 0.95)",
            "line-width": [
              "case", ["boolean", ["feature-state", "hover"], false], 1.4, 0,
            ],
          },
        });

        fetch(COUNTIES_GEOJSON)
          .then((r) => r.json())
          .then((c) => {
            if (!map.getStyle()) return;
            map.addSource(COUNTIES_SOURCE, { type: "geojson", data: c });
            map.addLayer({
              id: COUNTIES_LAYER,
              type: "line",
              source: COUNTIES_SOURCE,
              paint: {
                "line-color": "oklch(0.94 0.012 80 / 0.50)",
                "line-width": 0.9,
                "line-dasharray": [3, 2],
              },
            });
          })
          .catch(() => undefined);

        setReadyCount((n) => n + 1);
      });

      return map;
    };

    leftMap.current = buildMap(leftRef.current, "evergreen", false);
    rightMap.current = buildMap(rightRef.current, "salmon", true);

    const sync = (a: maplibregl.Map, b: maplibregl.Map) => {
      a.on("move", () => {
        if (syncing.current) return;
        syncing.current = true;
        b.jumpTo({
          center: a.getCenter(),
          zoom: a.getZoom(),
          bearing: a.getBearing(),
          pitch: a.getPitch(),
        });
        syncing.current = false;
      });
    };
    sync(leftMap.current, rightMap.current);
    sync(rightMap.current, leftMap.current);

    return () => {
      leftMap.current?.remove();
      rightMap.current?.remove();
      leftMap.current = null;
      rightMap.current = null;
    };
  }, []);

  // Push values to feature-state when data changes.
  useEffect(() => {
    if (readyCount < 2) return;
    const lm = leftMap.current!;
    const rm = rightMap.current!;
    const valueKey = clusterType === "yes" ? "prop_yes" : "prop_no";
    let cancelled = false;

    Promise.all([
      fetchTracts("gt", clusterType, percentileMethod),
      fetchTracts(selectedModel, clusterType, percentileMethod),
    ])
      .then(([gt, md]) => {
        if (cancelled) return;
        const lookup: Record<string, { gt?: number; md?: number }> = {};
        for (const r of gt) {
          const v = (r as unknown as Record<string, number>)[valueKey];
          lm.setFeatureState(
            { source: TRACT_SOURCE, sourceLayer: "tracts", id: r.GEOID },
            { value: v },
          );
          lookup[r.GEOID] = { ...lookup[r.GEOID], gt: v };
        }
        for (const r of md) {
          const v = (r as unknown as Record<string, number>)[valueKey];
          rm.setFeatureState(
            { source: TRACT_SOURCE, sourceLayer: "tracts", id: r.GEOID },
            { value: v },
          );
          lookup[r.GEOID] = { ...lookup[r.GEOID], md: v };
        }
        lookupRef.current = lookup;
      })
      .catch((e) => console.error("compare fetch failed", e));

    return () => { cancelled = true; };
  }, [readyCount, selectedModel, clusterType, percentileMethod]);

  // Hover handler — bind to the top (right) map's layer; the left map
  // also listens so hover works on the GT side. Sync the highlight on both.
  useEffect(() => {
    if (readyCount < 2) return;
    const lm = leftMap.current!;
    const rm = rightMap.current!;
    let lastId: string | null = null;
    const setHoverState = (id: string | null) => {
      if (lastId && lastId !== id) {
        lm.setFeatureState({ source: TRACT_SOURCE, sourceLayer: "tracts", id: lastId }, { hover: false });
        rm.setFeatureState({ source: TRACT_SOURCE, sourceLayer: "tracts", id: lastId }, { hover: false });
      }
      lastId = id;
      if (id) {
        lm.setFeatureState({ source: TRACT_SOURCE, sourceLayer: "tracts", id }, { hover: true });
        rm.setFeatureState({ source: TRACT_SOURCE, sourceLayer: "tracts", id }, { hover: true });
      }
    };

    const handleMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = String(f.id ?? f.properties?.GEOID ?? "");
      const rec = lookupRef.current[id] ?? {};
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHoverState(id);
      setHover({
        geoid: id,
        gt: typeof rec.gt === "number" ? rec.gt : null,
        md: typeof rec.md === "number" ? rec.md : null,
        x: e.originalEvent.clientX - rect.left,
        y: e.originalEvent.clientY - rect.top,
      });
    };
    const handleLeave = () => {
      setHoverState(null);
      setHover(null);
    };

    lm.on("mousemove", TRACT_LAYER, handleMove);
    lm.on("mouseleave", TRACT_LAYER, handleLeave);
    rm.on("mousemove", TRACT_LAYER, handleMove);
    rm.on("mouseleave", TRACT_LAYER, handleLeave);

    return () => {
      lm.off("mousemove", TRACT_LAYER, handleMove);
      lm.off("mouseleave", TRACT_LAYER, handleLeave);
      rm.off("mousemove", TRACT_LAYER, handleMove);
      rm.off("mouseleave", TRACT_LAYER, handleLeave);
    };
  }, [readyCount]);

  // Divider drag handlers.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setDivider(Math.max(0.04, Math.min(0.96, x)));
  }, [dragging]);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  const dividerPct = `${(divider * 100).toFixed(2)}%`;

  return (
    <div
      ref={containerRef}
      className="relative h-[640px] w-full overflow-hidden rounded-[6px] border border-[var(--atlas-rule)] bg-[var(--atlas-paper)] select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Left map: ground truth (evergreen). Always full-bleed. */}
      <div ref={leftRef} className="absolute inset-0" />

      {/* Right map: selected model (salmon). Clipped to right of divider. */}
      <div
        ref={rightRef}
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${dividerPct})` }}
      />

      {/* Soft gradient gutter that makes the curtain edge feel intentional */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-[44px] -translate-x-1/2"
        style={{
          left: dividerPct,
          background:
            "linear-gradient(90deg, oklch(0.78 0.13 160 / 0) 0%, oklch(0.78 0.13 160 / 0.18) 48%, oklch(0.78 0.13 30 / 0.18) 52%, oklch(0.78 0.13 30 / 0) 100%)",
        }}
      />

      {/* The divider line itself */}
      <div
        className="absolute inset-y-0 z-20 w-px"
        style={{
          left: dividerPct,
          background: "linear-gradient(180deg, transparent, var(--atlas-ink) 25%, var(--atlas-ink) 75%, transparent)",
        }}
      />

      {/* Draggable handle */}
      <button
        type="button"
        role="slider"
        aria-label="Compare ground truth and model"
        aria-valuenow={Math.round(divider * 100)}
        aria-valuemin={4}
        aria-valuemax={96}
        onPointerDown={onPointerDown}
        className="absolute top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none focus:outline-none"
        style={{ left: dividerPct }}
      >
        <span
          className="flex items-center justify-center rounded-full border bg-[var(--atlas-paper)] shadow-[0_0_0_4px_oklch(0.16_0.012_240_/_0.4),0_18px_44px_oklch(0_0_0_/_0.45)] transition-transform"
          style={{
            width: 44,
            height: 44,
            borderColor: dragging ? "var(--atlas-tidal)" : "var(--atlas-rule-strong)",
            transform: dragging ? "scale(1.08)" : "scale(1)",
          }}
        >
          <DragGlyph />
        </span>
      </button>

      {/* Corner labels — anchored to the two halves, fade as the divider passes */}
      <CornerLabel
        side="left"
        eyebrow="Ground truth · HTS"
        title="Household Travel Survey"
        accent="var(--atlas-evergreen)"
        muted={divider < 0.18}
      />
      <CornerLabel
        side="right"
        eyebrow={`Model · ${selectedModel}`}
        title={modelName}
        accent="var(--atlas-salmon)"
        muted={divider > 0.82}
      />

      {/* Combined legend at top center */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-[4px] border border-[var(--atlas-rule)] bg-[var(--atlas-paper)]/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--atlas-ink-dim)]">
          <LegendPip label="GT" ramp="evergreen" />
          <span className="text-[var(--atlas-ink-subtle)]">curtain @ {Math.round(divider * 100)}%</span>
          <LegendPip label="Model" ramp="salmon" align="right" />
        </div>
      </div>

      {/* Tooltip on hover */}
      {hover && (
        <div
          className="pointer-events-none absolute z-40 rounded-[4px] border border-[var(--atlas-rule-strong)] bg-[var(--atlas-paper)]/95 px-3 py-2 shadow-[0_18px_44px_oklch(0_0_0_/_0.5)] backdrop-blur"
          style={{
            left: hover.x + 16,
            top: hover.y + 16,
            transform:
              hover.x > (containerRef.current?.clientWidth ?? 0) - 220
                ? "translateX(-110%)"
                : undefined,
          }}
        >
          <div className="atlas-eyebrow mb-1.5">Tract</div>
          <div className="font-mono text-[11px] text-[var(--atlas-ink)]">{hover.geoid}</div>
          <div className="atlas-rule my-2" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
            <span className="text-[var(--atlas-evergreen)]">GT</span>
            <span className="text-right tabular-nums text-[var(--atlas-ink)]">
              {hover.gt == null ? "—" : `${(hover.gt * 100).toFixed(1)}%`}
            </span>
            <span className="text-[var(--atlas-salmon)]">Model</span>
            <span className="text-right tabular-nums text-[var(--atlas-ink)]">
              {hover.md == null ? "—" : `${(hover.md * 100).toFixed(1)}%`}
            </span>
            <span className="text-[var(--atlas-ink-subtle)]">Δ</span>
            <span className="text-right tabular-nums text-[var(--atlas-ink-dim)]">
              {hover.gt == null || hover.md == null ? "—" : `${((hover.md - hover.gt) * 100).toFixed(1)} pp`}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {readyCount < 2 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--atlas-paper)]/85 backdrop-blur">
          <span className="atlas-eyebrow">Loading geometry…</span>
        </div>
      )}
    </div>
  );
}

function DragGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6L4.5 12L9 18M15 6L19.5 12L15 18"
        stroke="var(--atlas-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CornerLabel({
  side, eyebrow, title, accent, muted,
}: {
  side: "left" | "right";
  eyebrow: string;
  title: string;
  accent: string;
  muted: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute bottom-4 z-20 max-w-[42%] rounded-[4px] border border-[var(--atlas-rule)] bg-[var(--atlas-paper)]/85 px-4 py-2.5 backdrop-blur transition-opacity ${
        side === "left" ? "left-4" : "right-4"
      } ${muted ? "opacity-30" : "opacity-100"}`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-[7px] rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span className="atlas-eyebrow" style={{ color: accent }}>
          {eyebrow}
        </span>
      </div>
      <p className="mt-1 font-display text-[15px] font-medium leading-tight text-[var(--atlas-ink)]">
        {title}
      </p>
    </div>
  );
}

function LegendPip({
  label, ramp, align = "left",
}: {
  label: string;
  ramp: Variant;
  align?: "left" | "right";
}) {
  const stops = RAMPS[ramp];
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <span style={{ color: ramp === "evergreen" ? "var(--atlas-evergreen)" : "var(--atlas-salmon)" }}>
        {label}
      </span>
      <span
        className="h-[6px] w-[64px] rounded-[1px]"
        style={{
          background: `linear-gradient(90deg, ${stops.map(([p, c]) => `${c} ${(p as number) * 100}%`).join(", ")})`,
          boxShadow: "inset 0 0 0 1px var(--atlas-rule)",
        }}
      />
    </div>
  );
}
