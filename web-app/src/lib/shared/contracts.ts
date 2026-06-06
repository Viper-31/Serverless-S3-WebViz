export type DatasetKind = "ecmwf" | "dpird";

export type LayerSelector = Record<string, { selected: number; type: "index" }>;

export type LayerDisplay = {
  clim: [number, number];
  rgbStops: Array<[number, number, number]>;
};

export type RasterLayerRequest = {
  kind: "raster";
  datasetKind: "ecmwf";
  refPath: string;
  variableId: string;
  selector: LayerSelector;
  display: LayerDisplay;
};

export type PointLayerRequest = {
  kind: "points";
  datasetKind: "dpird";
  refPath: string;
  variableId: string;
  selector: LayerSelector;
  display: LayerDisplay;
};

export type LayerRequest = RasterLayerRequest | PointLayerRequest;
