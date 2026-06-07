import maplibregl from "maplibre-gl";

import type {
  MapLibreLayerHost,
  MapLibreLayerId,
  MapLibreRenderableLayer,
} from "./types";

export type MapViewHandle = {
  map: MapLibreLayerHost;
  whenReady: Promise<void>;
  remove(): void;
};

type MapViewOptions = {
  container: HTMLDivElement;
  onReady?: () => void;
};

const BASE_MAP_ID = "https://tiles.openfreemap.org/styles/dark";

const DATA_LAYER_BEFORE_LAYER_IDS = [
  "boundary_state",
  "place_other",
  "water_name",
] as const;

function findDataLayerInsertionPoint(
  map: maplibregl.Map,
): MapLibreLayerId | undefined {
  const layers = map.getStyle().layers ?? [];

  for (const layerId of DATA_LAYER_BEFORE_LAYER_IDS) {
    if (layers.some((layer) => layer.id === layerId)) {
      return layerId;
    }
  }

  return layers.find((layer) => layer.type === "symbol")?.id;
}

function createLayerHost(map: maplibregl.Map): MapLibreLayerHost {
  return {
    addDataLayer(layer: MapLibreRenderableLayer) {
      map.addLayer(
        layer as
          | maplibregl.LayerSpecification
          | maplibregl.CustomLayerInterface,
        findDataLayerInsertionPoint(map),
      );
    },

    removeLayer(id: MapLibreLayerId) {
      map.removeLayer(id);
    },

    getLayer(id: MapLibreLayerId) {
      return map.getLayer(id);
    },
  };
}

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
    map: createLayerHost(map),
    whenReady,
    remove() {
      removed = true;
      map.remove();
    },
  };
}
