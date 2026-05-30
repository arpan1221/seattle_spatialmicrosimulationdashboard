"use client";

import { getDuckDB } from "./bootstrap";
import {
  MODELS_PARQUET,
  CLUSTER_LABELS_PARQUET,
  ANALYSIS_PARQUET,
  CLUSTER_MATCHES_PARQUET,
  CLUSTER_STATS_PARQUET,
  JACCARD_SWEEP_PARQUET,
  QUARTILE_PARQUET,
  DISTRIBUTIONS_PARQUET,
} from "@/lib/data";

let registered = false;

async function registerParquetFiles() {
  if (registered) return;
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    // Make the static URLs available to DuckDB's HTTP fs.
    // The parquet reader will fetch them with range requests.
    await conn.query(`INSTALL httpfs; LOAD httpfs;`).catch(() => undefined);
    registered = true;
  } finally {
    await conn.close();
  }
}

function absUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export interface TractRow {
  GEOID: string;
  prop_yes: number;
  prop_no: number;
  cluster: number | null;
}

/** All tracts for a given (model, cluster_type, method) joined with cluster labels. */
export async function fetchTracts(
  model: string,
  clusterType: "yes" | "no",
  percentileMethod: "70th" | "75th" | "25th" | "IQR",
): Promise<TractRow[]> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT
        m.GEOID,
        m.prop_yes,
        m.prop_no,
        cl.cluster AS cluster
      FROM read_parquet('${absUrl(MODELS_PARQUET)}') AS m
      LEFT JOIN (
        SELECT GEOID, cluster
        FROM read_parquet('${absUrl(CLUSTER_LABELS_PARQUET)}')
        WHERE model = '${model}'
          AND cluster_type = '${clusterType}'
          AND percentile_method = '${percentileMethod}'
      ) cl USING (GEOID)
      WHERE m.model = '${model}';
    `;
    const result = await conn.query(sql);
    return result.toArray().map((r: { toJSON: () => Record<string, unknown> }) => {
      const obj = r.toJSON() as { GEOID: string; prop_yes: number; prop_no: number; cluster: number | null };
      return obj;
    });
  } finally {
    await conn.close();
  }
}

export interface AnalysisRow {
  model: string;
  cluster_type: string;
  percentile_method: string;
  n_gt_clusters: number;
  n_model_clusters: number;
  n_matches: number;
  precision: number;
  recall: number;
  f1: number;
  spearman: number;
  mean_distance_km: number;
}

export async function fetchAnalysis(
  model: string,
  clusterType: "yes" | "no",
  percentileMethod: "70th" | "75th" | "25th" | "IQR",
): Promise<AnalysisRow | null> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT *
      FROM read_parquet('${absUrl(ANALYSIS_PARQUET)}')
      WHERE model = '${model}'
        AND cluster_type = '${clusterType}'
        AND percentile_method = '${percentileMethod}'
      LIMIT 1;
    `;
    const result = await conn.query(sql);
    const rows = result.toArray();
    if (!rows.length) return null;
    return rows[0].toJSON() as AnalysisRow;
  } finally {
    await conn.close();
  }
}

export interface MatchRow {
  gt_cluster: number;
  model_cluster: number;
  distance_km: number;
  gt_rate: number;
  model_rate: number;
  rate_diff: number;
  gt_size: number;
  model_size: number;
}

export async function fetchMatches(
  model: string,
  clusterType: "yes" | "no",
  percentileMethod: "70th" | "75th" | "25th" | "IQR",
): Promise<MatchRow[]> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT gt_cluster, model_cluster, distance_km, gt_rate, model_rate,
             rate_diff, gt_size, model_size
      FROM read_parquet('${absUrl(CLUSTER_MATCHES_PARQUET)}')
      WHERE model = '${model}'
        AND cluster_type = '${clusterType}'
        AND percentile_method = '${percentileMethod}'
      ORDER BY distance_km
      LIMIT 50;
    `;
    const result = await conn.query(sql);
    return result.toArray().map((r) => r.toJSON() as MatchRow);
  } finally {
    await conn.close();
  }
}

export interface JaccardRow {
  model: string;
  cluster_type: string;
  threshold: number;
  jaccard: number;
  dice: number;
  gt_count: number;
  model_count: number;
  intersection: number;
  union: number;
}

export async function fetchJaccardSweep(
  model: string, clusterType: "yes" | "no",
): Promise<JaccardRow[]> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT *
      FROM read_parquet('${absUrl(JACCARD_SWEEP_PARQUET)}')
      WHERE model = '${model}' AND cluster_type = '${clusterType}'
      ORDER BY threshold;
    `;
    const r = await conn.query(sql);
    return r.toArray().map((row) => row.toJSON() as JaccardRow);
  } finally {
    await conn.close();
  }
}

export interface QuartileRow {
  model: string;
  cluster_type: string;
  percentile: "P25" | "P50" | "P75";
  gt_threshold: number;
  model_threshold: number;
  high_jaccard: number;
  low_jaccard: number;
  high_intersection: number;
  gt_only_high: number;
  model_only_high: number;
  gt_iqr: number;
  model_iqr: number;
  iqr_ratio: number;
  ks_stat: number;
  ks_pvalue: number;
}

export async function fetchQuartile(
  model: string, clusterType: "yes" | "no",
): Promise<QuartileRow[]> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT *
      FROM read_parquet('${absUrl(QUARTILE_PARQUET)}')
      WHERE model = '${model}' AND cluster_type = '${clusterType}'
      ORDER BY percentile;
    `;
    const r = await conn.query(sql);
    return r.toArray().map((row) => row.toJSON() as QuartileRow);
  } finally {
    await conn.close();
  }
}

/** Per-tract proportions for histogram (gt + model). */
export async function fetchDistributions(
  model: string, clusterType: "yes" | "no",
): Promise<{ gt: number[]; model: number[] }> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const col = clusterType === "yes" ? "prop_yes" : "prop_no";
    const sql = `
      SELECT model, ${col} AS value
      FROM read_parquet('${absUrl(DISTRIBUTIONS_PARQUET)}')
      WHERE model IN ('gt', '${model}');
    `;
    const r = await conn.query(sql);
    const gt: number[] = [];
    const md: number[] = [];
    for (const row of r.toArray()) {
      const o = row.toJSON() as { model: string; value: number };
      if (o.model === "gt") gt.push(o.value);
      else md.push(o.value);
    }
    return { gt, model: md };
  } finally {
    await conn.close();
  }
}

export interface ClusterStat {
  model: string;
  cluster_type: string;
  percentile_method: string;
  cluster: number;
  center_lat: number;
  center_lon: number;
  mean_rate: number;
  n_tracts: number;
}

export async function fetchClusterStats(
  model: string,
  clusterType: "yes" | "no",
  percentileMethod: "70th" | "75th" | "25th" | "IQR",
): Promise<ClusterStat[]> {
  await registerParquetFiles();
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const sql = `
      SELECT *
      FROM read_parquet('${absUrl(CLUSTER_STATS_PARQUET)}')
      WHERE model = '${model}'
        AND cluster_type = '${clusterType}'
        AND percentile_method = '${percentileMethod}'
      ORDER BY mean_rate DESC;
    `;
    const result = await conn.query(sql);
    return result.toArray().map((r) => r.toJSON() as ClusterStat);
  } finally {
    await conn.close();
  }
}
