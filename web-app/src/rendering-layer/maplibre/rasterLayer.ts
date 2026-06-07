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
  let disposed = false;
  let operationQueue: Promise<void> = Promise.resolve();

  function mapHasRasterLayer() {
    return Boolean(options.map.getLayer(ECMWF_LAYER_ID));
  }

  function removeActive() {
    if (mapHasRasterLayer()) {
      options.map.removeLayer(ECMWF_LAYER_ID);
    }
    active = undefined;
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = operationQueue.then(operation, operation);
    operationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    replace(request) {
      return enqueue(async () => {
        if (disposed) return;

        removeActive();
        currentSelector = request.selector;

        const next = await createEcmwfLayer({
          ...request,
          localRangeCoalescing: options.localRangeCoalescing(),
          onLoadingStateChange: options.onLoadingStateChange,
        });

        if (disposed) return;

        if (mapHasRasterLayer()) {
          options.map.removeLayer(ECMWF_LAYER_ID);
        }

        options.map.addLayer(next.layer as { id: string });
        active = next;
      });
    },

    updateSelector(selector) {
      return enqueue(async () => {
        if (disposed) return;

        currentSelector = selector;

        if (active && mapHasRasterLayer()) {
          await updateEcmwfLayerSelector(active.layer, selector);
        }
      });
    },

    updateVariableDisplay(input) {
      return enqueue(async () => {
        if (disposed) return;

        if (active && mapHasRasterLayer()) {
          await updateEcmwfLayerDisplay(active.layer, input);
        }
      });
    },

    async readValidTime(selector) {
      await operationQueue;

      const selected = selector ?? currentSelector;
      if (!active || !selected || !mapHasRasterLayer()) return undefined;

      return readEcmwfValidTimeValue(active.store, selected);
    },

    remove() {
      disposed = true;
      removeActive();
    },

    hasLayer() {
      return Boolean(active && mapHasRasterLayer());
    },
  };
}
