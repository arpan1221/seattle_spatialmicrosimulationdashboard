# Seattle Spatial Microsimulation Dashboard

Production rebuild of the streamlit `streamlit_comprehensive_app.py` validation
dashboard. Compares 10 synthetic-population microsimulation models against HTS
ground truth across 890 Seattle CBSA census tracts.

Live preview: see the latest deployment on Vercel via `vercel ls`.

## Stack

- **Next.js 16** (App Router) on **Vercel**
- **MapLibre GL JS** via `react-map-gl` v8 + **PMTiles** (geometry shipped once, recolored on model swap via `setFeatureState`)
- **DuckDB-WASM** + Parquet artifacts (SQL in the browser for threshold/percentile recomputes)
- **shadcn/ui** + Tailwind + Zustand
- **OpenStreetMap** raster basemap (free, no token, no per-load billing)
- **`precompute/`** — Python CI step that runs OPTICS, Moran's I / LISA,
  cluster matching, Jaccard/Dice sweep, KS, IQR, composite, and the high/low
  classification once per data release. No Python in production.

## Repository layout

```
precompute/       Python pre-compute pipeline (one-off / CI on data changes)
src/
  app/            Next.js App Router (single page with 6 tabs)
  components/
    map/          MapLibre map + dual-map container
    sidebar/      Model / cluster type / percentile controls
    metrics/      KPI cards + cluster-match table
    tabs/         Overview, Quartile, Jaccard, Spatial, Composite, High/Low
  lib/
    duckdb/       DuckDB-WASM bootstrap + parquet query helpers
    maplibre/     PMTiles protocol + basemap style
    store/        Zustand global state
public/
  tiles/          tracts.pmtiles (2.3 MB)
  data/           parquet artifacts (~700 KB total)
```

## Phase status

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ | Scaffold + precompute skeleton |
| 1 | ✅ | Dual map + sidebar + KPI cards + cluster-match table |
| 2 | ✅ | Quartile + Jaccard sweep tabs (Recharts) |
| 3 | ✅ | Moran's I + LISA + composite radar + high/low classification |
| 4 | ✅ | Mobile sheet sidebar, footer, README, full Vercel deploy |

Future polish: move artifacts to Vercel Blob (currently committed in `public/`,
~3&nbsp;MB total — fine for the prototype).

## Development

```sh
npm install
npm run dev
```

## Re-running the precompute

```sh
cd precompute
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python precompute.py --data-root /path/to/SPATIAL-MICROSIMULATION_DOWNLOADS
# then convert tracts to PMTiles
brew install tippecanoe
tippecanoe -o out/tracts.pmtiles -Z6 -z14 --coalesce-densest-as-needed \
  --extend-zooms-if-still-dropping --layer=tracts --force out/tracts.geojson
cp out/*.parquet     ../public/data/
cp out/counties.geojson ../public/data/
cp out/tracts.pmtiles ../public/tiles/
```

## Deploy

```sh
vercel          # preview
vercel --prod   # promote
```
