import type { LoadingState, ZarrLayer } from "@carbonplan/zarr-layer";

import type { RasterLayerRequest } from "@/lib/shared/contracts";
import {
  ECMWF_LAYER_ID,
  createEcmwfLayer,
  updateEcmwfLayerDisplay,
  updateEcmwfLayerSelector,
  readEcmwfValidTimeValue,
  type EcmwfLayerBundle,
} from "@/rendering-layer/raster/ZarrGridLayer";

import type { MapLibreLayerHost } from "./types";

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

type RasterLayerState = {
  active: EcmwfLayerBundle | undefined;
  currentSelector: RasterLayerRequest["selector"] | undefined;
  disposed: boolean;
};

type RasterLayerOptions = {
  map: MapLibreLayerHost;
  localRangeCoalescing: () => boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
};

type OperationQueue = {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
  drain(): Promise<void>;
};

function createOperationQueue(): OperationQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const run = tail.then(operation, operation);
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    drain() {
      return tail;
    },
  };
}

function hasMapLayer(map: MapLibreLayerHost): boolean {
  return Boolean(map.getLayer(ECMWF_LAYER_ID));
}

function removeMapLayer(state: RasterLayerState, map: MapLibreLayerHost) {
  if (hasMapLayer(map)) {
    map.removeLayer(ECMWF_LAYER_ID);
  }
  state.active = undefined;
}

function awaitLayerReady(
  layer: ZarrLayer,
  forward?: (s: LoadingState) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    layer.onLoadingStateChange = (state) => {
      forward?.(state);
      if (state.error) {
        reject(state.error);
        return;
      }
      if (!state.metadata) {
        resolve();
      }
    };
  });
}

async function createRasterMap(
  state: RasterLayerState,
  options: RasterLayerOptions,
  request: RasterLayerRequest,
): Promise<void> {
  if (state.disposed) return;

  state.currentSelector = request.selector;

  const next = await createEcmwfLayer({
    ...request,
    localRangeCoalescing: options.localRangeCoalescing(),
    onLoadingStateChange: options.onLoadingStateChange,
  });

  if (state.disposed) return;

  const userOnLoading = options.onLoadingStateChange;
  const ready = awaitLayerReady(next.layer, userOnLoading);

  if (hasMapLayer(options.map)) {
    options.map.removeLayer(ECMWF_LAYER_ID);
  }
  options.map.addDataLayer(next.layer);

  await ready;
  next.ready = ready;
  state.active = next;
}

async function updateRasterMapSelector(
  state: RasterLayerState,
  map: MapLibreLayerHost,
  selector: RasterLayerRequest["selector"],
): Promise<void> {
  if (state.disposed) return;

  state.currentSelector = selector;

  if (state.active && hasMapLayer(map)) {
    await updateEcmwfLayerSelector(state.active.layer, selector);
  }
}

async function updateRasterMapDisplay(
  state: RasterLayerState,
  map: MapLibreLayerHost,
  input: { variableId: string; display: RasterLayerRequest["display"] },
): Promise<void> {
  if (state.disposed) return;

  if (state.active && hasMapLayer(map)) {
    await updateEcmwfLayerDisplay(state.active.layer, input);
  }
}

async function readRasterMapValidTime(
  state: RasterLayerState,
  map: MapLibreLayerHost,
  queue: OperationQueue,
  selector: RasterLayerRequest["selector"] | undefined,
): Promise<unknown> {
  await queue.drain();

  const selected = selector ?? state.currentSelector;
  if (!state.active || !selected || !hasMapLayer(map)) return undefined;

  return readEcmwfValidTimeValue(state.active.store, selected);
}

async function disposeRasterMap(
  state: RasterLayerState,
  map: MapLibreLayerHost,
): Promise<void> {
  state.disposed = true;
  if (state.active?.ready) {
    try {
      await state.active.ready;
    } catch {
      // Ignore loading errors during disposal
    }
  }
  removeMapLayer(state, map);
}

function hasActiveRasterMap(
  state: RasterLayerState,
  map: MapLibreLayerHost,
): boolean {
  return Boolean(state.active && hasMapLayer(map));
}

export function createMapLibreRasterLayer(
  options: RasterLayerOptions,
): RasterLayerHandle {
  const state: RasterLayerState = {
    active: undefined,
    currentSelector: undefined,
    disposed: false,
  };
  const queue = createOperationQueue();

  return {
    replace: (request) =>
      queue.enqueue(() => createRasterMap(state, options, request)),
    updateSelector: (selector) =>
      queue.enqueue(() =>
        updateRasterMapSelector(state, options.map, selector),
      ),
    updateVariableDisplay: (input) =>
      queue.enqueue(() => updateRasterMapDisplay(state, options.map, input)),
    readValidTime: (selector) =>
      readRasterMapValidTime(state, options.map, queue, selector),
    remove: () => disposeRasterMap(state, options.map),
    hasLayer: () => hasActiveRasterMap(state, options.map),
  };
}
