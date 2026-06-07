import type { LoadingState } from "@carbonplan/zarr-layer";

import type { RasterLayerRequest } from "@/lib/shared/contracts";
import {
  ECMWF_LAYER_ID,
  createEcmwfLayer,
  updateEcmwfLayerDisplay,
  updateEcmwfLayerSelector,
  readEcmwfValidTimeValue,
} from "@/rendering-layer/raster/ZarrGridLayer";

import type { MapLibreRasterMap } from "./types";

export type RasterLayerHandle = {
  replace(request: RasterLayerRequest): Promise<void>;
  updateSelector(selector: RasterLayerRequest["selector"]): Promise<void>;
  updateVariableDisplay(input: {
    variableId: string;
    display: RasterLayerRequest["display"];
  }): Promise<void>;
  readValidTime(selector: RasterLayerRequest["selector"]): Promise<unknown>;
  remove(): void;
  hasLayer(): boolean;
};

export function createMapLibreRasterLayer(options: {
  map: MapLibreRasterMap;
  localRangeCoalescing: () => boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
}): RasterLayerHandle {
  let active: Awaited<ReturnType<typeof createEcmwfLayer>> | undefined;
  let currentSelector: RasterLayerRequest["selector"] | undefined;

  function removeActive() {
    if (options.map.getLayer(ECMWF_LAYER_ID)) {
      options.map.removeLayer(ECMWF_LAYER_ID);
    }
    active = undefined;
  }

  return {
    async replace(request) {
      removeActive();
      currentSelector = request.selector;
      active = await createEcmwfLayer({
        ...request,
        localRangeCoalescing: options.localRangeCoalescing(),
        onLoadingStateChange: options.onLoadingStateChange,
      });
      options.map.addLayer(active.layer as { id: string });
    },
    async updateSelector(selector) {
      currentSelector = selector;
      if (active) {
        await updateEcmwfLayerSelector(active.layer, selector);
      }
    },
    async updateVariableDisplay(input) {
      if (active) {
        await updateEcmwfLayerDisplay(active.layer, input);
      }
    },
    async readValidTime(selector) {
      const selected = selector ?? currentSelector;
      if (!active || !selected) return undefined;
      return readEcmwfValidTimeValue(active.store, selected);
    },
    remove() {
      removeActive();
    },
    hasLayer() {
      return Boolean(active);
    },
  };
}
