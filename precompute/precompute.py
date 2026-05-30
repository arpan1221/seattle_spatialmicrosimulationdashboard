"""
Pre-compute synthetic-population validation metrics for the Seattle CBSA dashboard.

Reads the 11 model CSVs + HTS ground truth + TIGER shapefiles, runs OPTICS
clustering, Moran's I / LISA, and cluster matching, and writes the results
to Parquet + PMTiles for the Next.js frontend to consume.

Run locally on data changes:
    python precompute/precompute.py --data-root /path/to/SPATIAL-MICROSIMULATION_DOWNLOADS

Outputs (written to precompute/out/):
    - tracts.geojson       Simplified WGS84 tract polygons (input to Tippecanoe)
    - counties.geojson     Three Seattle CBSA counties as raw GeoJSON
    - models.parquet       Per (model, geoid, cluster_type, percentile_method)
                           the proportion, cluster id, centroid (lat, lon)
    - analysis.parquet     Per (model, cluster_type, percentile_method)
                           precision/recall/F1/Spearman, Moran's I, LISA agreement,
                           Jaccard sweep, IQR ratio, KS, composite score
    - cluster_matches.parquet  Per matched pair: gt_cluster, model_cluster,
                               distance_km, rate diffs

Tippecanoe step (run after this script):
    tippecanoe -o precompute/out/tracts.pmtiles -Z8 -z14 \\
        --coalesce-densest-as-needed --extend-zooms-if-still-dropping \\
        precompute/out/tracts.geojson
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

# These imports are intentionally lazy — the file should import cleanly
# even if the heavy deps aren't installed yet; we only need them inside main().


CBSA_CODE = "42660"  # Seattle-Tacoma-Bellevue
STATE_FIPS = "53"
TARGET_COUNTY_FPS = ["033", "053", "061"]  # King, Pierce, Snohomish

# Friendly names mirror the streamlit `models` dict
MODELS: dict[str, dict] = {
    "df2":  {"name": "Baseline Unweighted",                        "path": "Output_CSVs/Seattle_synthetic_population_baseline_unweighted.csv"},
    "df3":  {"name": "Baseline Weighted",                          "path": "Output_CSVs/Seattle_synthetic_population_baseline_weighted.csv"},
    "df4":  {"name": "ACM Weighted",                               "path": "Output_CSVs/Seattle_synthetic_population_ACM_weighted.csv"},
    "df5":  {"name": "ACM Unweighted",                             "path": "Output_CSVs/Seattle_synthetic_population_ACM_unweighted.csv"},
    "df6":  {"name": "Geographic Nested",                          "path": "IPF/Seattle_synthetic_population_geographic_nested_corrected.csv"},
    "df7":  {"name": "Geographic Nested ACM Unweighted",           "path": "IPF/Seattle_synthetic_population_geographic_nested_ACM_unweighted.csv"},
    "df8":  {"name": "P-MEDM IPF",                                 "path": "R_code_IPF/ipf_results_washington/synthetic_population.csv",                 "remap_remote": True},
    "df9":  {"name": "ACM nested with firm size",                  "path": "IPF/Seattle_synthetic_population_withNOEMP.csv"},
    "df10": {"name": "IP with uncertainty with firm size",         "path": "R_code_IPF/ipf_results_washington/synthetic_population_withNOEMP.csv",      "remap_remote": True},
    "df11": {"name": "Nested IPF with firm size + Seattle subsample", "path": "IPF/Seattle_synthetic_population_withNOEMP_subsample.csv"},
}

PERCENTILE_METHODS = ["70th", "75th", "25th", "IQR"]
CLUSTER_TYPES = ["yes", "no"]
JACCARD_THRESHOLDS = [round(0.10 + 0.05 * i, 2) for i in range(18)]  # 0.10..0.95


@dataclass
class Paths:
    data_root: Path
    tract_zip: Path
    county_zip: Path
    cbsa_zip: Path
    hts_csv: Path
    out_dir: Path


def parse_args() -> Paths:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--data-root",
        type=Path,
        required=True,
        help="Root of SPATIAL-MICROSIMULATION_DOWNLOADS (model CSVs live here)",
    )
    p.add_argument(
        "--shapefiles-dir",
        type=Path,
        default=Path.home() / "Downloads",
        help="Directory containing tl_2024_53_tract.zip, tl_2025_us_county.zip, tl_2024_us_cbsa (1).zip",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).parent / "out",
        help="Output directory for parquet + geojson",
    )
    a = p.parse_args()
    return Paths(
        data_root=a.data_root,
        tract_zip=a.shapefiles_dir / "tl_2024_53_tract.zip",
        county_zip=a.shapefiles_dir / "tl_2025_us_county.zip",
        cbsa_zip=a.shapefiles_dir / "tl_2024_us_cbsa (1).zip",
        hts_csv=a.data_root / "propsR_RevisedNov262025.csv",
        out_dir=a.out_dir,
    )


def load_geometry(paths: Paths):
    """Load + filter + simplify the Seattle CBSA tracts and the 3 target counties."""
    import geopandas as gpd

    cbsa = gpd.read_file(paths.cbsa_zip)
    cbsa["GEOID"] = cbsa["GEOID"].astype(str)
    cbsa_sea = cbsa.loc[cbsa["GEOID"] == CBSA_CODE].to_crs(3857)
    cbsa_sea = cbsa_sea[cbsa_sea.geometry.notna() & ~cbsa_sea.geometry.is_empty & cbsa_sea.geometry.is_valid]

    tracts = gpd.read_file(paths.tract_zip).to_crs(3857)
    tracts = tracts[tracts.geometry.notna() & ~tracts.geometry.is_empty & tracts.geometry.is_valid]
    tracts = gpd.sjoin(tracts, cbsa_sea[["GEOID", "geometry"]], predicate="intersects", how="inner")
    tracts = tracts.rename(columns={"GEOID_left": "GEOID"}).drop(
        columns=["index_right", "GEOID_right"], errors="ignore"
    )
    tracts["geometry"] = tracts["geometry"].simplify(tolerance=100, preserve_topology=True)
    tracts = tracts[tracts.geometry.notna() & ~tracts.geometry.is_empty & tracts.geometry.is_valid]

    # Compute centroids in 3857, then reproject to 4326 alongside the polygons.
    tracts["centroid_3857"] = tracts.geometry.centroid
    tracts_wgs84 = tracts.to_crs(4326)
    centroids_wgs84 = gpd.GeoSeries(tracts["centroid_3857"], crs=3857).to_crs(4326)
    tracts_wgs84["longitude"] = centroids_wgs84.x.values
    tracts_wgs84["latitude"] = centroids_wgs84.y.values
    tracts_wgs84["GEOID"] = tracts_wgs84["GEOID"].astype(str).str.zfill(11)
    tracts_wgs84 = tracts_wgs84.drop(columns=["centroid_3857"], errors="ignore")

    counties = gpd.read_file(paths.county_zip)
    counties = counties[counties.geometry.notna() & ~counties.geometry.is_empty & counties.geometry.is_valid]
    counties = counties[counties["COUNTYFP"].isin(TARGET_COUNTY_FPS)].to_crs(3857)
    counties = gpd.sjoin(counties, cbsa_sea[["GEOID", "geometry"]], predicate="intersects", how="inner")
    counties = counties.drop(columns=["index_right", "GEOID_right"], errors="ignore")
    counties["geometry"] = counties["geometry"].simplify(tolerance=500, preserve_topology=True)
    counties_wgs84 = counties.to_crs(4326)

    return tracts_wgs84, counties_wgs84


def load_hts(paths: Paths):
    """Load HTS ground truth (per-tract proportions)."""
    import pandas as pd

    hts = pd.read_csv(paths.hts_csv).dropna()
    if "tract" in hts.columns:
        hts = hts.rename(columns={"tract": "GEOID"})
    hts["GEOID"] = hts["GEOID"].astype(int).astype(str).str.zfill(11)
    hts["prop_no_telework"] = hts["prop_wt_t0"]
    hts["prop_yes_telework"] = hts["prop_wt_t1"] + hts["prop_wt_t2"] + hts["prop_wt_t3"]
    return hts[["GEOID", "prop_no_telework", "prop_yes_telework"]]


def aggregate_model_to_tract(model_csv: Path, remap_remote: bool):
    """CBG-level model → tract-level binary remote proportions."""
    import pandas as pd

    df = pd.read_csv(model_csv)
    df["GEOID"] = df["GEOID"].astype(str).str.zfill(12)
    df["TRACT"] = df["GEOID"].str[:11]
    if remap_remote:
        df["remote"] = df["remote"].map({1: "No Days", 2: "1 Day", 3: ">1 day"})
    df["remote_binary"] = df["remote"].map({"No Days": 0, "1 Day": 1, ">1 day": 1}).fillna(0)
    agg = df.groupby("TRACT")["remote_binary"].mean().reset_index()
    agg.columns = ["GEOID", "prop_yes"]
    agg["prop_no"] = 1 - agg["prop_yes"]
    return agg


# ---------------------------------------------------------------------------
# TODO Phase 1: cluster() / cluster_matches() / morans()
# Stubbed signatures so the orchestrator below compiles; implementations
# come next once we wire up the data flow end-to-end.
# ---------------------------------------------------------------------------

def cluster_optics(coords_df, value_col: str, threshold: float):
    """Returns (cluster_label_series, cluster_stats_df). TODO Phase 1."""
    raise NotImplementedError

def cluster_matches(gt_stats, model_stats, threshold_km: float = 5.0):
    """Returns (matches_df, metrics_dict). TODO Phase 1."""
    raise NotImplementedError

def morans(gdf, value_col: str):
    """Returns dict with global I + LISA arrays. TODO Phase 1."""
    raise NotImplementedError


def main() -> None:
    paths = parse_args()
    paths.out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[precompute] data root: {paths.data_root}")
    print(f"[precompute] output:    {paths.out_dir}")

    print("[precompute] loading geometry...")
    tracts, counties = load_geometry(paths)
    print(f"[precompute]   {len(tracts)} tracts, {len(counties)} counties")

    print("[precompute] writing tracts.geojson + counties.geojson")
    # GeoJSON FeatureCollection with GEOID as the feature id (matches MapLibre).
    def to_geojson(gdf, id_col: str) -> dict:
        gj = json.loads(gdf.to_json())
        for feat in gj["features"]:
            feat["id"] = feat["properties"].get(id_col, feat.get("id"))
        return gj

    (paths.out_dir / "tracts.geojson").write_text(
        json.dumps(to_geojson(tracts[["GEOID", "longitude", "latitude", "geometry"]], "GEOID"))
    )
    (paths.out_dir / "counties.geojson").write_text(
        json.dumps(to_geojson(counties[["COUNTYFP", "NAME", "geometry"]].rename(columns={"COUNTYFP": "id"}), "id"))
    )

    print("[precompute] loading HTS ground truth + 11 model CSVs...")
    hts = load_hts(paths)
    model_rows = []
    for key, meta in MODELS.items():
        csv_path = paths.data_root / meta["path"]
        if not csv_path.exists():
            print(f"[precompute]   SKIP {key}: missing {csv_path}")
            continue
        print(f"[precompute]   {key}: {meta['name']}")
        agg = aggregate_model_to_tract(csv_path, remap_remote=meta.get("remap_remote", False))
        agg["model"] = key
        agg["model_name"] = meta["name"]
        model_rows.append(agg)

    if not model_rows:
        raise SystemExit("No model CSVs found — check --data-root")

    import pandas as pd
    long_models = pd.concat(model_rows, ignore_index=True)
    print(f"[precompute] long_models: {len(long_models)} rows across {long_models['model'].nunique()} models")

    # Phase 1 will replace this with the full clustering + analysis sweep.
    # For Phase 0 we just write a proportions-only parquet so the frontend
    # has something to talk to end-to-end.
    out_df = long_models.merge(
        hts.rename(columns={"prop_yes_telework": "gt_prop_yes", "prop_no_telework": "gt_prop_no"}),
        on="GEOID",
        how="left",
    )
    out_df.to_parquet(paths.out_dir / "models.parquet", index=False)
    print(f"[precompute] wrote {paths.out_dir / 'models.parquet'} ({len(out_df)} rows)")

    print("[precompute] Phase 0 complete. Next: implement cluster_optics + morans + cluster_matches.")


if __name__ == "__main__":
    main()
