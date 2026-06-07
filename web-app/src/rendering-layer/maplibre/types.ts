// Keep separate so future maplibre/stationLayer.ts can import without circular dependency on rasterLayer.
export type MapLibreLayerId = string;

export type MapLibreRenderableLayer = {
  id: MapLibreLayerId;
};

export type MapLibreRasterMap = {
  addLayer(layer: MapLibreRenderableLayer): void;
  removeLayer(id: MapLibreLayerId): void;
  getLayer(id: MapLibreLayerId): unknown;
};
