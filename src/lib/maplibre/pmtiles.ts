"use client";

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

/** Register the `pmtiles://` URL scheme on the global maplibregl runtime. Idempotent. */
export function ensurePmtilesProtocol() {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
