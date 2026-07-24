import type { LoadingState } from "@carbonplan/zarr-layer";

import type {
  LayerDisplay,
  LayerSelector,
  RasterLayerRequest,
} from "@/lib/shared/contracts";
import { createMapView } from "@/rendering-layer/maplibre/mapView";
import { createMapLibreRasterLayer } from "@/rendering-layer/maplibre/rasterLayer";
import type { MapLibreLayerHost } from "@/rendering-layer/maplibre/types";

export type RasterRenderer = {
  replace(request: RasterLayerRequest): Promise<void>;
  updateSelector(selector: LayerSelector): Promise<void>;
  updateVariableDisplay(input: {
    variableId: string;
    display: LayerDisplay;
  }): Promise<void>;
  readValidTime(selector: LayerSelector): Promise<unknown>;
  remove(): void;
  hasLayer(): boolean;
  prefetchNextRef(request: RasterLayerRequest): Promise<void>;
  prefetchNextTimeChunk(request: RasterLayerRequest): Promise<void>;
};

export function createRasterRenderer(options: {
  map: MapLibreLayerHost;
  localRangeCoalescing: () => boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
}): RasterRenderer {
  const rasterLayer = createMapLibreRasterLayer(options);

  return {
    replace: (request) => rasterLayer.replace(request),
    updateSelector: (selector) => rasterLayer.updateSelector(selector),
    updateVariableDisplay: (input) => rasterLayer.updateVariableDisplay(input),
    readValidTime: (selector) => rasterLayer.readValidTime(selector),
    remove: () => rasterLayer.remove(),
    hasLayer: () => rasterLayer.hasLayer(),
    prefetchNextRef: (request) => rasterLayer.prefetchNextRef(request),
    prefetchNextTimeChunk: (request) =>
      rasterLayer.prefetchNextTimeChunk(request),
  };
}

export function createRendererForContainer(options: {
  container: HTMLDivElement;
  localRangeCoalescing: () => boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
}): {
  renderer: RasterRenderer;
  whenReady: Promise<void>;
  remove(): Promise<void>;
} {
  const mapView = createMapView({ container: options.container });
  const renderer = createRasterRenderer({
    map: mapView.map,
    localRangeCoalescing: options.localRangeCoalescing,
    onLoadingStateChange: options.onLoadingStateChange,
  });

  return {
    renderer,
    whenReady: mapView.whenReady,
    async remove() {
      await renderer.remove();
      mapView.remove();
    },
  };
}
