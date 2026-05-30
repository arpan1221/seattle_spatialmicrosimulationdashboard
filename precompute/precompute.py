"""
Pre-compute synthetic-population validation metrics for the Seattle CBSA dashboard.

Reads the 11 model CSVs + HTS ground truth + TIGER shapefiles, runs OPTICS
clustering and cluster matching, and writes results to Parquet + GeoJSON
for the Next.js frontend to consume.

Run locally on data changes:
    python precompute/precompute.py --data-root /path/to/SPATIAL-MICROSIMULATION_DOWNLOADS

Outputs (written to precompute/out/):
    - tracts.geojson         Simplified WGS84 tract polygons (input to Tippecanoe)
    - counties.geojson       Three Seattle CBSA counties as raw GeoJSON
    - models.parquet         Per (model, geoid) the prop_yes/no + cluster id per
                             (cluster_type, percentile_method)
    - cluster_stats.parquet  Per (source, model, cluster_type, percentile_method, cluster)
                             centroid + mean rate + tract count
    - analysis.parquet       Per (model, cluster_type, percentile_method)
                             precision/recall/F1/Spearman/mean_distance

Phase 3 will add: Moran's I, LISA, Jaccard sweep, KS, composite radar.

Tippecanoe step:
    tippecanoe -o precompute/out/tracts.pmtiles -Z8 -z14 \\
        --coalesce-densest-as-needed --extend-zooms-if-still-dropping \\
        --no-tile-compression \\
        precompute/out/tracts.geojson
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

CBSA_CODE = "42660"
STATE_FIPS = "53"
TARGET_COUNTY_FPS = ["033", "053", "061"]

MODELS: dict[str, dict] = {
    "df2":  {"name": "Baseline Unweighted",                          "path": "Output_CSVs/Seattle_synthetic_population_baseline_unweighted.csv"},
    "df3":  {"name": "Baseline Weighted",                            "path": "Output_CSVs/Seattle_synthetic_population_baseline_weighted.csv"},
    "df4":  {"name": "ACM Weighted",                                 "path": "Output_CSVs/Seattle_synthetic_population_ACM_weighted.csv"},
    "df5":  {"name": "ACM Unweighted",                               "path": "Output_CSVs/Seattle_synthetic_population_ACM_unweighted.csv"},
    "df6":  {"name": "Geographic Nested",                            "path": "IPF/Seattle_synthetic_population_geographic_nested_corrected.csv"},
    "df7":  {"name": "Geographic Nested ACM Unweighted",             "path": "IPF/Seattle_synthetic_population_geographic_nested_ACM_unweighted.csv"},
    "df8":  {"name": "P-MEDM IPF",                                   "path": "R_code_IPF/ipf_results_washington/synthetic_population.csv",            "remap_remote": True},
    "df9":  {"name": "ACM nested with firm size",                    "path": "IPF/Seattle_synthetic_population_withNOEMP.csv"},
    "df10": {"name": "IP with uncertainty with firm size",           "path": "R_code_IPF/ipf_results_washington/synthetic_population_withNOEMP.csv", "remap_remote": True},
    "df11": {"name": "Nested IPF with firm size + Seattle subsample","path": "IPF/Seattle_synthetic_population_withNOEMP_subsample.csv"},
}

PERCENTILE_METHODS = ["70th", "75th", "25th", "IQR"]
CLUSTER_TYPES = ["yes", "no"]

# OPTICS hyperparameters mirror the streamlit app
OPTICS_MIN_SAMPLES = 3
OPTICS_MAX_EPS = 0.02           # radians; ~ 2.2 km on Earth's surface
OPTICS_XI = 0.05
MATCH_THRESHOLD_KM = 5.0


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
    p.add_argument("--data-root", type=Path, required=True)
    p.add_argument("--shapefiles-dir", type=Path, default=Path.home() / "Downloads")
    p.add_argument("--out-dir", type=Path, default=Path(__file__).parent / "out")
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

    tracts["centroid_3857"] = tracts.geometry.centroid
    tracts_wgs84 = tracts.to_crs(4326)
    centroids_wgs84 = gpd.GeoSeries(tracts["centroid_3857"].values, crs=3857).to_crs(4326)
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
    import pandas as pd

    hts = pd.read_csv(paths.hts_csv).dropna()
    if "tract" in hts.columns:
        hts = hts.rename(columns={"tract": "GEOID"})
    hts["GEOID"] = hts["GEOID"].astype(int).astype(str).str.zfill(11)
    hts["prop_no_telework"] = hts["prop_wt_t0"]
    hts["prop_yes_telework"] = hts["prop_wt_t1"] + hts["prop_wt_t2"] + hts["prop_wt_t3"]
    return hts[["GEOID", "prop_no_telework", "prop_yes_telework"]]


def aggregate_model_to_tract(model_csv: Path, remap_remote: bool):
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


def percentile_filter(values, method: str):
    """Return a boolean mask of rows to keep for clustering, per streamlit logic."""
    import numpy as np

    if method == "75th":
        return values >= np.quantile(values, 0.75)
    if method == "25th":
        return values >= np.quantile(values, 0.25)
    if method == "IQR":
        q25, q75 = np.quantile(values, [0.25, 0.75])
        return (values >= q25) & (values <= q75)
    # default: 70th
    return values >= np.quantile(values, 0.70)


def run_optics(coords_df, value_col: str):
    """OPTICS cluster on (lat, lon) rows, returns (labels, stats_df).

    coords_df must contain GEOID, longitude, latitude, <value_col>.
    """
    import numpy as np
    import pandas as pd
    from sklearn.cluster import OPTICS

    if len(coords_df) < 5:
        labels = np.full(len(coords_df), -1, dtype=int)
        return labels, pd.DataFrame(columns=["cluster", "center_lat", "center_lon", "mean_rate", "n_tracts"])

    coords_rad = np.radians(coords_df[["latitude", "longitude"]].values)
    clusterer = OPTICS(
        min_samples=OPTICS_MIN_SAMPLES,
        max_eps=OPTICS_MAX_EPS,
        metric="haversine",
        cluster_method="xi",
        xi=OPTICS_XI,
    )
    labels = clusterer.fit_predict(coords_rad)

    stats_rows = []
    for cid in sorted(set(labels) - {-1}):
        mask = labels == cid
        sub = coords_df.loc[mask]
        stats_rows.append({
            "cluster": int(cid),
            "center_lat": float(sub["latitude"].mean()),
            "center_lon": float(sub["longitude"].mean()),
            "mean_rate": float(sub[value_col].mean()),
            "n_tracts": int(mask.sum()),
        })
    return labels, pd.DataFrame(stats_rows)


def haversine_km(lat1, lon1, lat2, lon2):
    import numpy as np
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * np.arcsin(np.sqrt(a)) * 6371.0


def match_clusters(gt_stats, model_stats, threshold_km: float = MATCH_THRESHOLD_KM):
    """Streamlit-style nearest-centroid match. Returns (matches_df, metrics)."""
    from math import inf
    import pandas as pd
    from scipy.stats import spearmanr

    if len(gt_stats) == 0 or len(model_stats) == 0:
        return pd.DataFrame(), {
            "n_gt_clusters": int(len(gt_stats)),
            "n_model_clusters": int(len(model_stats)),
            "n_matches": 0,
            "precision": 0.0, "recall": 0.0, "f1": 0.0,
            "spearman": 0.0, "mean_distance_km": 0.0,
        }

    matches = []
    for _, g in gt_stats.iterrows():
        best_j, best_d = None, inf
        for j, m in model_stats.iterrows():
            d = haversine_km(g["center_lat"], g["center_lon"], m["center_lat"], m["center_lon"])
            if d < best_d and d < threshold_km:
                best_d, best_j = d, j
        if best_j is not None:
            m = model_stats.loc[best_j]
            matches.append({
                "gt_cluster": int(g["cluster"]),
                "model_cluster": int(m["cluster"]),
                "distance_km": float(best_d),
                "gt_rate": float(g["mean_rate"]),
                "model_rate": float(m["mean_rate"]),
                "rate_diff": abs(float(g["mean_rate"]) - float(m["mean_rate"])),
                "gt_size": int(g["n_tracts"]),
                "model_size": int(m["n_tracts"]),
            })

    matches_df = pd.DataFrame(matches)
    n_matches = len(matches_df)
    precision = n_matches / len(model_stats) if len(model_stats) else 0.0
    recall = n_matches / len(gt_stats) if len(gt_stats) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    if n_matches >= 3:
        rho, _ = spearmanr(matches_df["gt_rate"], matches_df["model_rate"])
        spearman = 0.0 if (rho is None or rho != rho) else float(rho)
    else:
        spearman = 0.0

    return matches_df, {
        "n_gt_clusters": int(len(gt_stats)),
        "n_model_clusters": int(len(model_stats)),
        "n_matches": int(n_matches),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "spearman": spearman,
        "mean_distance_km": float(matches_df["distance_km"].mean()) if n_matches else 0.0,
    }


def write_geojson(gdf, path: Path, id_col: str | None) -> None:
    gj = json.loads(gdf.to_json())
    if id_col:
        for feat in gj["features"]:
            feat["id"] = feat["properties"].get(id_col, feat.get("id"))
    path.write_text(json.dumps(gj))


def main() -> None:
    import numpy as np
    import pandas as pd

    paths = parse_args()
    paths.out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[precompute] data root: {paths.data_root}")
    print(f"[precompute] output:    {paths.out_dir}")

    print("[precompute] loading geometry...")
    tracts, counties = load_geometry(paths)
    print(f"[precompute]   {len(tracts)} tracts, {len(counties)} counties")

    print("[precompute] writing tracts.geojson + counties.geojson")
    write_geojson(
        tracts[["GEOID", "longitude", "latitude", "geometry"]],
        paths.out_dir / "tracts.geojson",
        "GEOID",
    )
    write_geojson(
        counties[["COUNTYFP", "NAME", "geometry"]],
        paths.out_dir / "counties.geojson",
        "COUNTYFP",
    )

    coord_lookup = tracts[["GEOID", "longitude", "latitude"]].copy()

    print("[precompute] loading HTS ground truth...")
    hts = load_hts(paths)

    print("[precompute] loading 11 model CSVs and aggregating to tract...")
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

    long_models = pd.concat(model_rows, ignore_index=True)
    long_models = long_models.merge(coord_lookup, on="GEOID", how="inner")
    print(f"[precompute] long_models: {len(long_models)} rows across {long_models['model'].nunique()} models")

    # Ground truth as a pseudo-model named "gt" so the cluster sweep is uniform.
    gt_block = hts.merge(coord_lookup, on="GEOID", how="inner").rename(
        columns={"prop_yes_telework": "prop_yes", "prop_no_telework": "prop_no"}
    )
    gt_block["model"] = "gt"
    gt_block["model_name"] = "Ground Truth"

    base = pd.concat(
        [long_models[["GEOID", "longitude", "latitude", "model", "model_name", "prop_yes", "prop_no"]],
         gt_block[["GEOID", "longitude", "latitude", "model", "model_name", "prop_yes", "prop_no"]]],
        ignore_index=True,
    )

    print("[precompute] running OPTICS clustering sweep...")
    cluster_label_frames = []
    stats_frames = []
    for model_key in base["model"].unique():
        for cluster_type in CLUSTER_TYPES:
            value_col = "prop_yes" if cluster_type == "yes" else "prop_no"
            for method in PERCENTILE_METHODS:
                sub = base[base["model"] == model_key].copy()
                mask = percentile_filter(sub[value_col].values, method)
                clustered_sub = sub.loc[mask, ["GEOID", "longitude", "latitude", value_col]].reset_index(drop=True)
                labels, stats = run_optics(clustered_sub, value_col)
                clustered_sub["cluster"] = labels

                # Per-tract label frame (only tracts with cluster != -1)
                kept = clustered_sub[clustered_sub["cluster"] != -1].copy()
                kept["model"] = model_key
                kept["cluster_type"] = cluster_type
                kept["percentile_method"] = method
                cluster_label_frames.append(kept[["GEOID", "model", "cluster_type", "percentile_method", "cluster"]])

                if len(stats):
                    stats = stats.copy()
                    stats["model"] = model_key
                    stats["cluster_type"] = cluster_type
                    stats["percentile_method"] = method
                    stats_frames.append(stats)

    cluster_labels = pd.concat(cluster_label_frames, ignore_index=True) if cluster_label_frames else pd.DataFrame(
        columns=["GEOID", "model", "cluster_type", "percentile_method", "cluster"]
    )
    cluster_stats = pd.concat(stats_frames, ignore_index=True) if stats_frames else pd.DataFrame(
        columns=["cluster", "center_lat", "center_lon", "mean_rate", "n_tracts", "model", "cluster_type", "percentile_method"]
    )

    print(f"[precompute]   cluster_labels: {len(cluster_labels)} rows")
    print(f"[precompute]   cluster_stats:  {len(cluster_stats)} rows")

    print("[precompute] matching every (model, cluster_type, method) against ground truth...")
    analysis_rows = []
    matches_frames = []
    for (ct, method), gt_grp in cluster_stats[cluster_stats["model"] == "gt"].groupby(["cluster_type", "percentile_method"]):
        for model_key in [k for k in base["model"].unique() if k != "gt"]:
            model_grp = cluster_stats[
                (cluster_stats["model"] == model_key)
                & (cluster_stats["cluster_type"] == ct)
                & (cluster_stats["percentile_method"] == method)
            ]
            matches_df, metrics = match_clusters(gt_grp, model_grp)
            if len(matches_df):
                matches_df["model"] = model_key
                matches_df["cluster_type"] = ct
                matches_df["percentile_method"] = method
                matches_frames.append(matches_df)
            analysis_rows.append({
                "model": model_key,
                "cluster_type": ct,
                "percentile_method": method,
                **metrics,
            })

    analysis = pd.DataFrame(analysis_rows)
    matches = pd.concat(matches_frames, ignore_index=True) if matches_frames else pd.DataFrame()
    print(f"[precompute]   analysis: {len(analysis)} rows")
    print(f"[precompute]   matches:  {len(matches)} rows")

    print("[precompute] writing parquet artifacts...")
    # models.parquet: wide-ish — proportions per (model, geoid). Cluster labels live separately.
    models_out = base[["model", "model_name", "GEOID", "longitude", "latitude", "prop_yes", "prop_no"]].copy()
    models_out.to_parquet(paths.out_dir / "models.parquet", index=False)
    cluster_labels.to_parquet(paths.out_dir / "cluster_labels.parquet", index=False)
    cluster_stats.to_parquet(paths.out_dir / "cluster_stats.parquet", index=False)
    analysis.to_parquet(paths.out_dir / "analysis.parquet", index=False)
    if len(matches):
        matches.to_parquet(paths.out_dir / "cluster_matches.parquet", index=False)

    # ------------------------------------------------------------------
    # Phase 2: per-tract distributions, Jaccard/Dice sweep, quartile stats.
    # All keyed on (model, cluster_type). Ground truth is referenced as gt.
    # ------------------------------------------------------------------
    print("[precompute] Phase 2: Jaccard/Dice sweep + quartile analysis...")

    from scipy.stats import ks_2samp

    # Wide table: GEOID × (gt_yes, gt_no, df2_yes, df2_no, ...)
    pivot = base.pivot_table(
        index="GEOID", columns="model", values=["prop_yes", "prop_no"]
    )

    jaccard_rows: list[dict] = []
    for model_key in [k for k in base["model"].unique() if k != "gt"]:
        for cluster_type in CLUSTER_TYPES:
            col = "prop_yes" if cluster_type == "yes" else "prop_no"
            try:
                gt_series = pivot[col]["gt"].dropna()
                model_series = pivot[col][model_key].dropna()
            except KeyError:
                continue
            common = gt_series.index.intersection(model_series.index)
            gt_vals = gt_series.loc[common]
            md_vals = model_series.loc[common]
            for thr in [round(0.10 + 0.05 * i, 2) for i in range(18)]:
                gt_set = set(gt_vals[gt_vals >= thr].index)
                md_set = set(md_vals[md_vals >= thr].index)
                inter = len(gt_set & md_set)
                union = len(gt_set | md_set)
                jaccard = inter / union if union else 0.0
                denom = len(gt_set) + len(md_set)
                dice = 2 * inter / denom if denom else 0.0
                jaccard_rows.append({
                    "model": model_key,
                    "cluster_type": cluster_type,
                    "threshold": thr,
                    "jaccard": jaccard,
                    "dice": dice,
                    "gt_count": len(gt_set),
                    "model_count": len(md_set),
                    "intersection": inter,
                    "union": union,
                })
    jaccard_df = pd.DataFrame(jaccard_rows)
    jaccard_df.to_parquet(paths.out_dir / "jaccard_sweep.parquet", index=False)
    print(f"[precompute]   jaccard_sweep: {len(jaccard_df)} rows")

    # Quartile analysis at P25 / P50 / P75. For each:
    #   - high concentration = tracts >= percentile
    #   - low  concentration = tracts <= percentile
    #   - Jaccard between gt and model for each side
    # Plus IQR ratio (min/max of IQRs) and KS statistic per (model, cluster_type).
    quartile_rows: list[dict] = []
    for model_key in [k for k in base["model"].unique() if k != "gt"]:
        for cluster_type in CLUSTER_TYPES:
            col = "prop_yes" if cluster_type == "yes" else "prop_no"
            try:
                gt_series = pivot[col]["gt"].dropna()
                model_series = pivot[col][model_key].dropna()
            except KeyError:
                continue
            common = gt_series.index.intersection(model_series.index)
            gt_vals = gt_series.loc[common]
            md_vals = model_series.loc[common]

            gt_q25, gt_q50, gt_q75 = np.quantile(gt_vals, [0.25, 0.50, 0.75])
            md_q25, md_q50, md_q75 = np.quantile(md_vals, [0.25, 0.50, 0.75])
            gt_iqr = gt_q75 - gt_q25
            md_iqr = md_q75 - md_q25
            iqr_ratio = (
                min(gt_iqr, md_iqr) / max(gt_iqr, md_iqr) if max(gt_iqr, md_iqr) > 0 else 0.0
            )
            ks_stat, ks_p = ks_2samp(gt_vals, md_vals)

            for pct_label, gt_thr, md_thr in [
                ("P25", gt_q25, md_q25), ("P50", gt_q50, md_q50), ("P75", gt_q75, md_q75),
            ]:
                gt_high = set(gt_vals[gt_vals >= gt_thr].index)
                md_high = set(md_vals[md_vals >= md_thr].index)
                gt_low  = set(gt_vals[gt_vals <= gt_thr].index)
                md_low  = set(md_vals[md_vals <= md_thr].index)

                def jacc(a: set, b: set) -> float:
                    u = len(a | b)
                    return (len(a & b) / u) if u else 0.0

                quartile_rows.append({
                    "model": model_key,
                    "cluster_type": cluster_type,
                    "percentile": pct_label,
                    "gt_threshold": float(gt_thr),
                    "model_threshold": float(md_thr),
                    "high_jaccard": jacc(gt_high, md_high),
                    "low_jaccard":  jacc(gt_low, md_low),
                    "high_intersection": len(gt_high & md_high),
                    "gt_only_high": len(gt_high - md_high),
                    "model_only_high": len(md_high - gt_high),
                    "gt_iqr": float(gt_iqr),
                    "model_iqr": float(md_iqr),
                    "iqr_ratio": float(iqr_ratio),
                    "ks_stat": float(ks_stat),
                    "ks_pvalue": float(ks_p),
                })
    quartile_df = pd.DataFrame(quartile_rows)
    quartile_df.to_parquet(paths.out_dir / "quartile.parquet", index=False)
    print(f"[precompute]   quartile: {len(quartile_df)} rows")

    # Per-tract distribution rows for histograms (rebuilt fresh; small).
    dist_rows = (
        base[["model", "GEOID", "prop_yes", "prop_no"]]
        .rename(columns={"model": "model"})
    )
    dist_rows.to_parquet(paths.out_dir / "distributions.parquet", index=False)
    print(f"[precompute]   distributions: {len(dist_rows)} rows")

    print("[precompute] Phase 2 complete.")

    # ------------------------------------------------------------------
    # Phase 3: Moran's I, LISA, composite radar, high/low classification.
    # ------------------------------------------------------------------
    print("[precompute] Phase 3: spatial autocorrelation + composite + high/low...")

    from libpysal.weights import Queen
    from esda.moran import Moran, Moran_Local

    # Build a Queen contiguity weight matrix once from the tract polygons,
    # restricted to GEOIDs that appear in `base` (i.e. all that we have data for).
    tracts_for_w = tracts.copy()
    tracts_for_w["GEOID"] = tracts_for_w["GEOID"].astype(str).str.zfill(11)
    tracts_for_w = tracts_for_w[tracts_for_w["GEOID"].isin(set(base["GEOID"]))].reset_index(drop=True)
    w = Queen.from_dataframe(tracts_for_w, use_index=False)
    w.transform = "r"
    geoid_order = tracts_for_w["GEOID"].tolist()

    moran_rows: list[dict] = []
    lisa_rows: list[dict] = []
    lisa_lookup: dict[tuple[str, str], dict[str, dict]] = {}

    def value_series(model_key: str, value_col: str) -> "pd.Series | None":
        sub = base[base["model"] == model_key].set_index("GEOID")[value_col]
        sub = sub.reindex(geoid_order)
        if sub.isna().any():
            sub = sub.fillna(sub.mean())
        return sub

    for model_key in base["model"].unique():
        for cluster_type in CLUSTER_TYPES:
            value_col = "prop_yes" if cluster_type == "yes" else "prop_no"
            series = value_series(model_key, value_col)
            if series is None:
                continue
            arr = series.values.astype(float)
            mi = Moran(arr, w, permutations=199)
            mi_local = Moran_Local(arr, w, permutations=199)
            moran_rows.append({
                "model": model_key,
                "cluster_type": cluster_type,
                "moran_i": float(mi.I),
                "moran_p": float(mi.p_sim),
                "moran_z": float(mi.z_sim),
                "expected_i": float(mi.EI),
            })
            sigs = mi_local.p_sim < 0.05
            quads = mi_local.q
            # quadrants: 1=HH, 2=LH, 3=LL, 4=HL
            row_lookup: dict[str, dict] = {}
            for geo, sig, quad in zip(geoid_order, sigs, quads):
                row_lookup[geo] = {"significant": bool(sig), "quadrant": int(quad)}
            lisa_lookup[(model_key, cluster_type)] = row_lookup

    moran_df = pd.DataFrame(moran_rows)
    moran_df.to_parquet(paths.out_dir / "moran.parquet", index=False)
    print(f"[precompute]   moran: {len(moran_df)} rows")

    # LISA agreement = % tracts where (gt significant) matches (model significant)
    lisa_agreement_rows: list[dict] = []
    for cluster_type in CLUSTER_TYPES:
        gt = lisa_lookup.get(("gt", cluster_type))
        if gt is None:
            continue
        for model_key in [k for k in base["model"].unique() if k != "gt"]:
            md = lisa_lookup.get((model_key, cluster_type))
            if md is None:
                continue
            same_sig = sum(1 for g in geoid_order if gt[g]["significant"] == md[g]["significant"])
            same_quad = sum(1 for g in geoid_order if gt[g]["quadrant"] == md[g]["quadrant"])
            lisa_agreement_rows.append({
                "model": model_key,
                "cluster_type": cluster_type,
                "lisa_significance_agreement": same_sig / len(geoid_order),
                "lisa_regime_agreement": same_quad / len(geoid_order),
                "n_tracts": len(geoid_order),
            })

            # Per-tract LISA rows (only for selected model; gt always)
            for g in geoid_order:
                lisa_rows.append({
                    "GEOID": g,
                    "model": model_key,
                    "cluster_type": cluster_type,
                    "gt_significant": gt[g]["significant"],
                    "gt_quadrant": gt[g]["quadrant"],
                    "model_significant": md[g]["significant"],
                    "model_quadrant": md[g]["quadrant"],
                })
    lisa_agreement_df = pd.DataFrame(lisa_agreement_rows)
    lisa_agreement_df.to_parquet(paths.out_dir / "lisa_agreement.parquet", index=False)
    lisa_per_tract_df = pd.DataFrame(lisa_rows)
    lisa_per_tract_df.to_parquet(paths.out_dir / "lisa_per_tract.parquet", index=False)
    print(f"[precompute]   lisa_agreement: {len(lisa_agreement_df)} rows")
    print(f"[precompute]   lisa_per_tract: {len(lisa_per_tract_df)} rows")

    # Composite radar = weighted blend (matches streamlit_comprehensive_app.py)
    composite_rows: list[dict] = []
    quart_lookup = {
        (r["model"], r["cluster_type"], r["percentile"]): r for r in quartile_rows
    }
    moran_lookup = {(r["model"], r["cluster_type"]): r for r in moran_rows if r["model"] != "gt"}
    moran_gt = {r["cluster_type"]: r for r in moran_rows if r["model"] == "gt"}
    lisa_lookup_df = {
        (r["model"], r["cluster_type"]): r for r in lisa_agreement_rows
    }
    for model_key in [k for k in base["model"].unique() if k != "gt"]:
        for ct in CLUSTER_TYPES:
            hi_q = quart_lookup.get((model_key, ct, "P75"))
            lo_q = quart_lookup.get((model_key, ct, "P25"))
            mi = moran_lookup.get((model_key, ct))
            mi_gt = moran_gt.get(ct)
            la = lisa_lookup_df.get((model_key, ct))
            if not (hi_q and lo_q and mi and mi_gt and la):
                continue
            high_jacc = hi_q["high_jaccard"]
            low_jacc = lo_q["low_jaccard"]
            moran_sim = max(0.0, 1.0 - abs(mi["moran_i"] - mi_gt["moran_i"]))
            lisa_agree = la["lisa_significance_agreement"]
            iqr_ratio = hi_q["iqr_ratio"]
            composite = (
                0.30 * high_jacc
                + 0.20 * low_jacc
                + 0.20 * moran_sim
                + 0.15 * lisa_agree
                + 0.15 * iqr_ratio
            )
            composite_rows.append({
                "model": model_key,
                "cluster_type": ct,
                "high_jaccard": float(high_jacc),
                "low_jaccard": float(low_jacc),
                "moran_similarity": float(moran_sim),
                "lisa_agreement": float(lisa_agree),
                "iqr_ratio": float(iqr_ratio),
                "composite": float(composite),
            })
    composite_df = pd.DataFrame(composite_rows)
    composite_df.to_parquet(paths.out_dir / "composite.parquet", index=False)
    print(f"[precompute]   composite: {len(composite_df)} rows")

    # High/Low classification.
    # For each model + cluster_type, classify every tract using a fixed bank of
    # threshold methods (the same set streamlit offered). Compare against the
    # ground-truth classification with the same method.
    HIGHLOW_METHODS = ["absolute_50", "median_split", "mean_split", "tercile", "quartile", "stddev"]

    def classify(values: np.ndarray, method: str) -> np.ndarray:
        if method == "absolute_50":
            out = np.where(values >= 0.50, "HIGH", "LOW")
        elif method == "median_split":
            m = float(np.median(values))
            out = np.where(values >= m, "HIGH", "LOW")
        elif method == "mean_split":
            m = float(np.mean(values))
            out = np.where(values >= m, "HIGH", "LOW")
        elif method == "tercile":
            t1, t2 = np.quantile(values, [1 / 3, 2 / 3])
            out = np.where(values >= t2, "HIGH", np.where(values >= t1, "MID", "LOW"))
        elif method == "quartile":
            q1, q2, q3 = np.quantile(values, [0.25, 0.50, 0.75])
            out = np.where(values >= q3, "Q4",
                  np.where(values >= q2, "Q3",
                  np.where(values >= q1, "Q2", "Q1")))
        elif method == "stddev":
            mu = float(np.mean(values))
            sd = float(np.std(values))
            out = np.where(values >= mu + sd, "HIGH",
                  np.where(values <= mu - sd, "LOW", "MID"))
        else:
            raise ValueError(f"unknown method {method}")
        return out

    highlow_class_rows: list[dict] = []
    highlow_summary_rows: list[dict] = []
    for ct in CLUSTER_TYPES:
        value_col = "prop_yes" if ct == "yes" else "prop_no"
        gt_series = value_series("gt", value_col)
        if gt_series is None:
            continue
        for method in HIGHLOW_METHODS:
            gt_cls = classify(gt_series.values, method)
            gt_by_id = dict(zip(geoid_order, gt_cls))
            for model_key in [k for k in base["model"].unique() if k != "gt"]:
                md_series = value_series(model_key, value_col)
                if md_series is None:
                    continue
                md_cls = classify(md_series.values, method)
                agreement = sum(1 for g, mv in zip(geoid_order, md_cls) if gt_by_id[g] == mv) / len(geoid_order)
                gt_counts = pd.Series(gt_cls).value_counts().to_dict()
                md_counts = pd.Series(md_cls).value_counts().to_dict()
                highlow_summary_rows.append({
                    "model": model_key,
                    "cluster_type": ct,
                    "method": method,
                    "accuracy": float(agreement),
                    "gt_counts": json.dumps(gt_counts),
                    "model_counts": json.dumps(md_counts),
                    "n_tracts": len(geoid_order),
                })
                for g, gc, mc in zip(geoid_order, gt_cls, md_cls):
                    highlow_class_rows.append({
                        "GEOID": g, "model": model_key, "cluster_type": ct, "method": method,
                        "gt_class": str(gc), "model_class": str(mc),
                    })

    highlow_summary_df = pd.DataFrame(highlow_summary_rows)
    highlow_summary_df.to_parquet(paths.out_dir / "highlow_summary.parquet", index=False)
    highlow_class_df = pd.DataFrame(highlow_class_rows)
    highlow_class_df.to_parquet(paths.out_dir / "highlow_class.parquet", index=False)
    print(f"[precompute]   highlow_summary: {len(highlow_summary_df)} rows")
    print(f"[precompute]   highlow_class:   {len(highlow_class_df)} rows")

    print("[precompute] Phase 3 complete.")
    print(f"[precompute]   {paths.out_dir / 'models.parquet'}")
    print(f"[precompute]   {paths.out_dir / 'cluster_labels.parquet'}")
    print(f"[precompute]   {paths.out_dir / 'cluster_stats.parquet'}")
    print(f"[precompute]   {paths.out_dir / 'analysis.parquet'}")
    print(f"[precompute]   {paths.out_dir / 'cluster_matches.parquet'}")


if __name__ == "__main__":
    main()
