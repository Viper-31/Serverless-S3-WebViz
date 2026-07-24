import type {
  LoadingState,
  LoadingStateCallback,
} from "@carbonplan/zarr-layer";

import type { RasterLayerRequest } from "@/lib/shared/contracts";
import {
  ECMWF_LAYER_ID,
  createEcmwfLayer,
  updateEcmwfLayerDisplay,
  updateEcmwfLayerSelector,
  readEcmwfValidTimeValue,
  type EcmwfLayerBundle,
} from "@/rendering-layer/raster/ZarrGridLayer";

import { preloadEcmwfChunks } from "@/zarr-store";

import type { MapLibreLayerHost } from "./types";

export type RasterLayerHandle = {
  replace(request: RasterLayerRequest): Promise<void>;
  updateSelector(selector: RasterLayerRequest["selector"]): Promise<void>;
  updateVariableDisplay(input: {
    variableId: string;
    display: RasterLayerRequest["display"];
  }): Promise<void>;
  readValidTime(selector: RasterLayerRequest["selector"]): Promise<unknown>;
  remove(): Promise<void>;
  hasLayer(): boolean;
  prefetchNextRef(request: RasterLayerRequest): Promise<void>;
  prefetchNextTimeChunk(request: RasterLayerRequest): Promise<void>;
};

type RasterLayerState = {
  active: EcmwfLayerBundle | undefined;
  currentSelector: RasterLayerRequest["selector"] | undefined;
  disposed: boolean;
  prefetched: EcmwfLayerBundle | undefined;
  prefetchedRefPath: string | undefined;
  prefetchedVariableId: string | undefined;
  prefetchToken: number;
  prefetchAbort: AbortController | undefined; // Reference bundle prefetch abort
  chunkWarmAbort: AbortController | undefined; // Chunk prefetch abort
  prefetchedLoadingSink: ((cb: LoadingStateCallback) => void) | undefined;
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

type ReadySignal = {
  callback: LoadingStateCallback;
  ready: Promise<void>;
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

function abortChunkWarm(state: RasterLayerState): void {
  state.chunkWarmAbort?.abort();
  state.chunkWarmAbort = undefined;
}

function removeMapLayer(state: RasterLayerState, map: MapLibreLayerHost) {
  if (hasMapLayer(map)) {
    map.removeLayer(ECMWF_LAYER_ID);
  }
  state.active = undefined;
}

function buildReadySignal(userCallback?: LoadingStateCallback): ReadySignal {
  let resolveReady!: () => void;
  let rejectReady!: (err: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const callback: LoadingStateCallback = (state) => {
    userCallback?.(state);
    if (state.error) {
      rejectReady(state.error);
      return;
    }
    if (!state.metadata) {
      resolveReady();
    }
  };
  return { callback, ready };
}

function selectedIndex(
  selector: RasterLayerRequest["selector"],
  key: "time" | "step",
): number {
  return Number(selector[key]!.selected);
}

async function prefetchRasterMap(
  state: RasterLayerState,
  options: RasterLayerOptions,
  request: RasterLayerRequest,
): Promise<void> {
  if (
    state.prefetchedRefPath === request.refPath &&
    state.prefetchedVariableId === request.variableId
  ) {
    return;
  }

  const token = ++state.prefetchToken;

  state.prefetchAbort?.abort();
  const abort = new AbortController();
  state.prefetchAbort = abort;

  state.prefetchedRefPath = request.refPath;
  state.prefetchedVariableId = request.variableId;

  try {
    let loadingCb: LoadingStateCallback | undefined =
      options.onLoadingStateChange;
    state.prefetchedLoadingSink = (next) => {
      loadingCb = next;
    };

    const bundle = await createEcmwfLayer({
      ...request,
      localRangeCoalescing: options.localRangeCoalescing(),
      onLoadingStateChange: (s) => loadingCb?.(s),
    });

    if (token !== state.prefetchToken) return;

    await preloadEcmwfChunks(
      bundle.store,
      request.variableId,
      selectedIndex(request.selector, "time"),
      selectedIndex(request.selector, "step"),
      abort.signal,
    );
    // Check token again after preload, since it may have been invalidated during the async operation
    if (token !== state.prefetchToken) return;

    state.prefetched = bundle;
    state.prefetchAbort = undefined;
  } catch {
    state.prefetchedRefPath = undefined;
    state.prefetchedVariableId = undefined;
    state.prefetchAbort = undefined;
    state.prefetchedLoadingSink = undefined;
    // Silently discard failed prefetch, consumer falls back to
    // createEcmwfLayer (cold-path) on normal replace
  }
}

async function prefetchTimeChunk(
  state: RasterLayerState,
  request: RasterLayerRequest,
): Promise<void> {
  if (state.disposed) return;
  if (!state.active || state.active.refPath !== request.refPath) return;

  if (!state.chunkWarmAbort) {
    state.chunkWarmAbort = new AbortController();
  }
  const { signal } = state.chunkWarmAbort;

  try {
    await preloadEcmwfChunks(
      state.active.store,
      request.variableId,
      selectedIndex(request.selector, "time"),
      selectedIndex(request.selector, "step"),
      signal,
    );
  } catch {
    // Silently discard failed prefetch, consumer falls back to
    // createEcmwfLayer (cold-path) on normal replace
  }
}

function consumePrefetch(
  state: RasterLayerState,
  request: RasterLayerRequest,
  onLoadingStateChange: LoadingStateCallback,
): EcmwfLayerBundle | undefined {
  if (
    !state.prefetched ||
    state.prefetchedRefPath !== request.refPath ||
    state.prefetchedVariableId !== request.variableId
  ) {
    return undefined;
  }

  const prefetchHit = state.prefetched;
  state.prefetched = undefined;
  state.prefetchedRefPath = undefined;
  state.prefetchedVariableId = undefined;

  prefetchHit.layer.setClim?.(request.display.clim);
  prefetchHit.layer.setColormap?.(request.display.rgbStops);
  state.prefetchedLoadingSink?.(onLoadingStateChange);
  state.prefetchedLoadingSink = undefined;

  onLoadingStateChange({ loading: false, metadata: false, chunks: false });
  return prefetchHit;
}

async function createRasterMap(
  state: RasterLayerState,
  options: RasterLayerOptions,
  request: RasterLayerRequest,
): Promise<void> {
  if (state.disposed) return;

  abortChunkWarm(state);
  state.currentSelector = request.selector;

  const { callback: onLoadingStateChange, ready } = buildReadySignal(
    options.onLoadingStateChange,
  );

  const next =
    consumePrefetch(state, request, onLoadingStateChange) ??
    (await createEcmwfLayer({
      ...request,
      localRangeCoalescing: options.localRangeCoalescing(),
      onLoadingStateChange,
    }));

  if (state.disposed) return;
  next.ready = ready;

  if (hasMapLayer(options.map)) {
    options.map.removeLayer(ECMWF_LAYER_ID);
  }
  options.map.addDataLayer(next.layer);
  // Resolves race condition issue #37
  // Block until new layer is fully initialised.
  // Queue will not run next enqueued replace until this promise resolves
  await ready;
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

  // Display clim/colourmap must not cancel chunk prefetch
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
  abortChunkWarm(state);
  state.prefetchAbort?.abort();
  state.prefetchAbort = undefined;
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
    prefetched: undefined,
    prefetchedRefPath: undefined,
    prefetchedVariableId: undefined,
    prefetchToken: 0,
    prefetchAbort: undefined,
    chunkWarmAbort: undefined,
    prefetchedLoadingSink: undefined,
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
    prefetchNextRef: (request) => prefetchRasterMap(state, options, request),
    prefetchNextTimeChunk: (request) => prefetchTimeChunk(state, request),
  };
}
