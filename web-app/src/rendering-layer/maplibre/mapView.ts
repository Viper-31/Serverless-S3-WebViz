import maplibregl from "maplibre-gl";

import type { MapLibreRasterMap } from "./types";

export type MapViewHandle = {
  map: MapLibreRasterMap;
  whenReady: Promise<void>;
  remove(): void;
};

type MapViewOptions = {
  container: HTMLDivElement;
  onReady?: () => void;
};

const BASE_SOURCE_ID = "osm";

export function createMapView(options: MapViewOptions): MapViewHandle {
  let removed = false;
  let resolveReady!: () => void;

  const whenReady = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const map = new maplibregl.Map({
    container: options.container,
    style: {
      version: 8,
      sources: {
        [BASE_SOURCE_ID]: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "bg",
          type: "background",
          paint: { "background-color": "#07111f" },
        },
        {
          id: "osm-boundaries",
          type: "raster",
          source: BASE_SOURCE_ID,
          paint: { "raster-opacity": 0.82 },
        },
      ],
    },
    center: [121, -24],
    zoom: 3,
    pitch: 0,
    bearing: 0,
    attributionControl: {
      compact: true,
    } as maplibregl.AttributionControlOptions,
  });

  map.on("load", () => {
    if (removed) return;
    map.setProjection?.({
      type: "globe",
    } as maplibregl.ProjectionSpecification);
    options.onReady?.();
    resolveReady();
  });

  return {
    map,
    whenReady,
    remove() {
      removed = true;
      map.remove();
    },
  };
}
