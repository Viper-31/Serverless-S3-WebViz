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
  "boundary_country_z0-4",
  "boundary_country_z5-",
  "place_other",
  "water_name",
] as const;

const READABLE_LABEL_LAYER_IDS = [
  "water_name",
  "highway_name_other",
  "highway_name_motorway",
  "place_other",
  "place_suburb",
  "place_village",
  "place_town",
  "place_city",
  "place_city_large",
  "place_state",
  "place_country_other",
  "place_country_minor",
  "place_country_major",
] as const;

const READABLE_BOUNDARY_LAYER_IDS = [
  "boundary_state",
  "boundary_country_z0-4",
  "boundary_country_z5-",
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

function setPaintPropertyIfLayerExists(
  map: maplibregl.Map,
  layerId: string,
  property: string,
  value: unknown,
) {
  if (!map.getLayer(layerId)) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapLibre's setPaintProperty types don't encode the property→value dependency
  map.setPaintProperty(layerId, property, value as any);
}

function improveDarkMapReadability(map: maplibregl.Map) {
  for (const layerId of READABLE_LABEL_LAYER_IDS) {
    setPaintPropertyIfLayerExists(map, layerId, "text-color", "#d1d5db");
    setPaintPropertyIfLayerExists(map, layerId, "text-halo-color", "#020617");
    setPaintPropertyIfLayerExists(map, layerId, "text-halo-width", 1.6);
    setPaintPropertyIfLayerExists(map, layerId, "text-halo-blur", 0.25);
  }

  for (const layerId of READABLE_BOUNDARY_LAYER_IDS) {
    setPaintPropertyIfLayerExists(map, layerId, "line-color", "#64748b");
    setPaintPropertyIfLayerExists(map, layerId, "line-opacity", 0.92);
  }
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
    improveDarkMapReadability(map);
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
