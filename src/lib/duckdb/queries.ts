"use client";

import { getDuckDB } from "./bootstrap";
import {
  MODELS_PARQUET,
  CLUSTER_LABELS_PARQUET,
  ANALYSIS_PARQUET,
  CLUSTER_MATCHES_PARQUET,
  CLUSTER_STATS_PARQUET,
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
