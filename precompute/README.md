# precompute

One-off Python pipeline that turns the raw streamlit-era CSVs + TIGER shapefiles
into the static artifacts the Next.js dashboard reads at runtime.

## Inputs

- `--data-root`: directory holding the 11 model CSVs + `propsR_RevisedNov262025.csv`
  (the existing `SPATIAL-MICROSIMULATION_DOWNLOADS` folder)
- `--shapefiles-dir` (default `~/Downloads`): holds
  `tl_2024_53_tract.zip`, `tl_2025_us_county.zip`, `tl_2024_us_cbsa (1).zip`

## Outputs (written to `precompute/out/`)

| File | Phase | Purpose |
|---|---|---|
| `tracts.geojson` | 0 | Simplified WGS84 tract polygons (input to Tippecanoe) |
| `counties.geojson` | 0 | King / Pierce / Snohomish county polygons |
| `models.parquet` | 0 | `(model, geoid, prop_yes, prop_no, gt_prop_yes, gt_prop_no)` |
| `models.parquet` | 1 | + cluster labels per (cluster_type, percentile_method) |
| `analysis.parquet` | 1 | Precision/recall/F1/Spearman, Moran's I, LISA agreement, Jaccard sweep, KS, composite |
| `cluster_matches.parquet` | 1 | Per matched pair: `(gt_cluster, model_cluster, distance_km, gt_rate, model_rate)` |

## Run

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python precompute.py \
    --data-root "/Users/arpannookala/Library/Mobile Documents/com~apple~CloudDocs/SPATIAL-MICROSIMULATION_DOWNLOADS"
```

Then convert tracts to PMTiles:

```sh
brew install tippecanoe
tippecanoe -o out/tracts.pmtiles -Z8 -z14 \
    --coalesce-densest-as-needed --extend-zooms-if-still-dropping \
    out/tracts.geojson
```

Upload `tracts.pmtiles`, `counties.geojson`, `models.parquet`, `analysis.parquet`
to Vercel Blob and reference them by URL in `src/lib/data.ts`.
