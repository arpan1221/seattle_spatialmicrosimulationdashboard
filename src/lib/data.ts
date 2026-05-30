/**
 * Static asset paths the frontend consumes. Phase 4 will swap these for
 * Vercel Blob URLs (just change `DATA_BASE`).
 */

const DATA_BASE = "/data";
const TILES_BASE = "/tiles";

export const TRACTS_PMTILES = `${TILES_BASE}/tracts.pmtiles`;
export const COUNTIES_GEOJSON = `${DATA_BASE}/counties.geojson`;
export const MODELS_PARQUET = `${DATA_BASE}/models.parquet`;
export const CLUSTER_LABELS_PARQUET = `${DATA_BASE}/cluster_labels.parquet`;
export const CLUSTER_STATS_PARQUET = `${DATA_BASE}/cluster_stats.parquet`;
export const ANALYSIS_PARQUET = `${DATA_BASE}/analysis.parquet`;
export const CLUSTER_MATCHES_PARQUET = `${DATA_BASE}/cluster_matches.parquet`;
export const JACCARD_SWEEP_PARQUET = `${DATA_BASE}/jaccard_sweep.parquet`;
export const QUARTILE_PARQUET = `${DATA_BASE}/quartile.parquet`;
export const DISTRIBUTIONS_PARQUET = `${DATA_BASE}/distributions.parquet`;

/** Bounds for `fitBounds` / initial map view (Seattle CBSA). */
export const SEATTLE_BBOX: [number, number, number, number] = [-122.95, 47.0, -121.45, 48.4];

export const MODELS: Array<{ key: string; name: string }> = [
  { key: "gt",   name: "Ground Truth (HTS)" },
  { key: "df2",  name: "Baseline Unweighted" },
  { key: "df3",  name: "Baseline Weighted" },
  { key: "df4",  name: "ACM Weighted" },
  { key: "df5",  name: "ACM Unweighted" },
  { key: "df6",  name: "Geographic Nested" },
  { key: "df7",  name: "Geographic Nested ACM Unweighted" },
  { key: "df8",  name: "P-MEDM IPF" },
  { key: "df9",  name: "ACM nested with firm size" },
  { key: "df10", name: "IP with uncertainty with firm size" },
  { key: "df11", name: "Nested IPF + firm size + Seattle subsample" },
];

export const CLUSTER_TYPES = ["yes", "no"] as const;
export type ClusterType = (typeof CLUSTER_TYPES)[number];

export const PERCENTILE_METHODS = ["70th", "75th", "25th", "IQR"] as const;
export type PercentileMethod = (typeof PERCENTILE_METHODS)[number];
