import type { StyleSpecification } from "maplibre-gl";

/**
 * Editorial dark basemap.
 *
 * We use OSM raster tiles (reliable, no CDN auth, no rate-limit surprises)
 * and tune them to a deep, desaturated palette via MapLibre's built-in
 * raster paint properties — saturation strips colour, contrast deepens
 * shadows, brightness-max pulls highlights down so the basemap recedes
 * behind the data choropleths.
 */
export const basemapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0e1418" },
    },
    {
      id: "basemap",
      type: "raster",
      source: "osm",
      paint: {
        "raster-opacity": 0.55,
        "raster-saturation": -0.95,
        "raster-contrast": 0.05,
        "raster-brightness-min": 0.05,
        "raster-brightness-max": 0.45,
      },
    },
  ],
};

/** No separate labels source — OSM tiles already carry labels. */
export const labelsLayer = null;
