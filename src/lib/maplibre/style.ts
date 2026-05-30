import type { StyleSpecification } from "maplibre-gl";

/**
 * Editorial dark basemap.
 *
 * We render the Seattle CBSA against a very subdued OpenStreetMap raster
 * with a heavy invert + sepia filter applied to it (via the layer's
 * `raster-saturation` and a CSS filter on the canvas — see globals.css).
 *
 * The goal is to make the basemap fade into the background so the
 * data-driven choropleths can be the foreground figure. Free to use,
 * no API key.
 */
export const basemapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "carto-dark": {
      type: "raster",
      // CARTO Voyager / DarkMatter — free for non-commercial use.
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> · &copy; <a href='https://carto.com/attributions'>CARTO</a>",
      maxzoom: 19,
    },
    "carto-labels": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "carto-dark",
      paint: {
        "raster-opacity": 0.62,
        "raster-saturation": -0.35,
        "raster-brightness-min": 0.05,
        "raster-brightness-max": 0.55,
      },
    },
  ],
};

/**
 * A separate top label layer, added AFTER the choropleth so place names
 * sit cleanly above the data. The map component appends this on load.
 */
export const labelsLayer = {
  id: "basemap-labels",
  type: "raster" as const,
  source: "carto-labels",
  paint: {
    "raster-opacity": 0.85,
  },
};
