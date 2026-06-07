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

const BASE_MAP_ID = "https://tiles.openfreemap.org/styles/dark";

export function createMapView(options: MapViewOptions): MapViewHandle {
  let removed = false;
  let resolveReady!: () => void;

  const whenReady = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const map = new maplibregl.Map({
    container: options.container,
    style: BASE_MAP_ID,
    center: [115, -31],
    zoom: 4.7,
    pitch: 0,
    bearing: 0,
    attributionControl: {
      compact: true,
    } as maplibregl.AttributionControlOptions,
  });

  map.on("load", () => {
    if (removed) return;
    map.setProjection?.({
      type: "mercator",
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
