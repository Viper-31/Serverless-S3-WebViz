export function createDpirdMapController(map: {
  addLayer(layer: { id: string }): void;
  removeLayer(id: string): void;
  addSource(id: string): void;
  removeSource(id: string): void;
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
}) {
  const layerId = "dpird-stations-layer";
  const sourceId = "dpird-stations";
  return {
    add(_params: unknown) {
      if (!map.getSource(sourceId)) map.addSource(sourceId);
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId });
    },
    remove() {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    },
  };
}

export function createEcmwfMapController(map: {
  addLayer(layer: { id: string }): void;
  removeLayer(id: string): void;
  addSource(id: string): void;
  removeSource(id: string): void;
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
}) {
  const layerId = "ecmwf-raster";
  const sourceId = "ecmwf-zarr";
  let lastParams: unknown;
  return {
    add(params: unknown) {
      lastParams = params;
      if (!map.getSource(sourceId)) map.addSource(sourceId);
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId });
    },
    update(params: unknown) {
      lastParams = params;
    },
    remove() {
      void lastParams;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    },
  };
}
