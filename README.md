# Seattle Spatial Microsimulation Dashboard

Production rebuild of the streamlit `streamlit_comprehensive_app.py` validation
dashboard. Compares 11 synthetic-population microsimulation models (baseline
IPF, ACM IPF, geographic-nested, P-MEDM, ±firm-size, subsample) against HTS
ground truth across ~890 Seattle CBSA census tracts.

## Stack

- **Next.js 16** (App Router, Cache Components) on **Vercel**
- **MapLibre GL JS** via `react-map-gl` v8 + **PMTiles** on Vercel Blob — geometry shipped once, recolored on model swap via `setFeatureState`
- **DuckDB-WASM** + a single `models.parquet` — SQL in the browser for threshold/percentile recomputes
- **shadcn/ui + Tailwind + Zustand** — controls, tables, sidebar, state
- **OpenFreeMap** PMTiles for the basemap — no Mapbox token, no per-load billing
- **`precompute/`** — Python CI step that runs OPTICS, Moran's I / LISA, cluster matching once per data release and writes Parquet + PMTiles. No Python in production.

## Repository layout

```
precompute/         Python pre-compute pipeline (run in CI on data changes)
src/
  app/              Next.js App Router pages
  components/
    map/            MapLibre map + layers
    sidebar/        Model / cluster type / percentile controls
    metrics/        KPI cards + tables for each analysis tab
  lib/
    duckdb/         DuckDB-WASM bootstrap + query helpers
    maplibre/       PMTiles protocol setup, feature-state helpers
    store/          Zustand global state
public/tiles/       (gitignored) local PMTiles for dev; prod reads from Blob
```

## Development

```sh
npm install
npm run dev
```

## Status

Phase 0 — scaffold + precompute skeleton.

## Phases

1. **Phase 0** (now): scaffold, precompute skeleton, env wiring.
2. **Phase 1**: Tab 1 dual map + cluster table + KPI cards.
3. **Phase 2**: Quartile + Jaccard sweep + cluster matching tabs.
4. **Phase 3**: Moran's I / LISA + composite radar + high/low classification.
5. **Phase 4**: Polish (dark mode, mobile drawer, `cacheTag` invalidation).
