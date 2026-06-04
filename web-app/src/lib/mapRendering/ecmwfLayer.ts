import {
  ZarrLayer,
  type LoadingState,
  type Selector,
} from "@carbonplan/zarr-layer";
import { ReferenceStore } from "@zarrita/storage";
import type { AsyncReadable } from "@zarrita/storage";
import * as zarr from "zarrita";
import { createByteCache } from "../byteCache";
import {
  ecmwfColorMapStopsForZarrLayer,
  ecmwfDisplayVariableKeys,
  type EcmwfColorMapKey,
  type EcmwfVariableKey,
} from "../datasets/ecmwfDisplay";
import { validateEcmwfDtypes } from "../datasets/ecmwfDtypes";
import { formatEcmwfValidTimeNs } from "../datasets/ecmwfValidTime";
import { prepareRefSpec } from "../refRewrite";

export const ECMWF_LAYER_ID = "ecmwf-raster";
export const ECMWF_TIME_INDEX_COUNT_PER_REF = 14;
export const ECMWF_STEP_INDEX_COUNT = 113;
export const ECMWF_DEFAULT_OPACITY = 0.92;

type RefSpec = {
  version?: number;
  refs?: Record<string, unknown>;
};

type ZarritaByteCache = {
  has(key: string): boolean;
  get(key: string): Uint8Array | undefined;
  set(key: string, value: Uint8Array | undefined): void;
};

export type EcmwfDisplaySettings = {
  clim: [number, number];
  colormap: EcmwfColorMapKey;
};

export type EcmwfLayerBundle = {
  layer: ZarrLayer;
  store: zarr.Readable;
  refPath: string;
};

const rawBytesMaxCacheSize = 24 * 1024 * 1024;
const rawBytesCacheMaxEntries = 128;
const gapRangeToCoalesce = 32_768;

function createZarritaByteCache(): ZarritaByteCache {
  const cache = createByteCache({
    maxBytes: rawBytesMaxCacheSize,
    maxEntries: rawBytesCacheMaxEntries,
  });

  return {
    has: (key) => cache.has(key),
    get: (key) => cache.get(key),
    set(key, value) {
      if (value === undefined) return;
      cache.set(key, value);
    },
  };
}

async function loadRefSpec(refPath: string): Promise<RefSpec> {
  const response = await fetch(refPath, { credentials: "omit" });
  if (!response.ok)
    throw new Error(`Failed to load ${refPath}: HTTP ${response.status}`);
  return response.json() as Promise<RefSpec>;
}

export function createEcmwfZarrSelector(input: {
  ecmwfTimeIndex: number;
  ecmwfStepIndex: number;
}): Selector {
  return {
    time: { selected: input.ecmwfTimeIndex, type: "index" },
    step: { selected: input.ecmwfStepIndex, type: "index" },
  };
}

export async function createEcmwfReadableStore(
  refPath: string,
  options: { localRangeCoalescing: boolean },
): Promise<zarr.Readable> {
  const refSpec = await loadRefSpec(refPath);
  const preparedSpec = prepareRefSpec(refSpec);
  const baseStore = ReferenceStore.fromSpec(preparedSpec) as AsyncReadable;

  if (!options.localRangeCoalescing) {
    return zarr.extendStore(baseStore, (store) =>
      zarr.withByteCaching(store, { cache: createZarritaByteCache() }),
    ) as zarr.Readable;
  }

  return zarr.extendStore(
    baseStore,
    (store) =>
      zarr.withRangeCoalescing(store, { coalesceSize: gapRangeToCoalesce }),
    (store) => zarr.withByteCaching(store, { cache: createZarritaByteCache() }),
  ) as zarr.Readable;
}

async function openEcmwfArray(store: zarr.Readable, path: string) {
  return zarr.open.v2(zarr.root(store).resolve(path), { kind: "array" });
}

export async function validateEcmwfStoreDtypes(
  store: zarr.Readable,
  variableKey: EcmwfVariableKey,
): Promise<true> {
  const [dataVariables, time, step, latitude, longitude, validTime] =
    await Promise.all([
      Promise.all(
        ecmwfDisplayVariableKeys.map((key) => openEcmwfArray(store, key)),
      ),
      openEcmwfArray(store, "time"),
      openEcmwfArray(store, "step"),
      openEcmwfArray(store, "latitude"),
      openEcmwfArray(store, "longitude"),
      openEcmwfArray(store, "valid_time"),
    ]);

  for (const [index, array] of dataVariables.entries()) {
    if (!array.is("float32"))
      throw new Error(`dtype mismatch for ${ecmwfDisplayVariableKeys[index]}`);
  }

  return validateEcmwfDtypes({
    display: dataVariables[ecmwfDisplayVariableKeys.indexOf(variableKey)],
    time,
    step,
    latitude,
    longitude,
    valid_time: validTime,
  });
}

export async function readEcmwfValidTimeLabel(
  store: zarr.Readable,
  input: { ecmwfTimeIndex: number; ecmwfStepIndex: number },
): Promise<string> {
  const validTime = await openEcmwfArray(store, "valid_time");
  const value = await zarr.get(validTime, [
    input.ecmwfTimeIndex,
    input.ecmwfStepIndex,
  ]);
  return formatEcmwfValidTimeNs(value);
}

export async function createEcmwfLayer(options: {
  refPath: string;
  variableKey: EcmwfVariableKey;
  ecmwfTimeIndex: number;
  ecmwfStepIndex: number;
  display: EcmwfDisplaySettings;
  localRangeCoalescing: boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
}): Promise<EcmwfLayerBundle> {
  const store = await createEcmwfReadableStore(options.refPath, {
    localRangeCoalescing: options.localRangeCoalescing,
  });
  await validateEcmwfStoreDtypes(store, options.variableKey);

  const layer = new ZarrLayer({
    id: ECMWF_LAYER_ID,
    store,
    variable: options.variableKey,
    selector: createEcmwfZarrSelector(options),
    colormap: ecmwfColorMapStopsForZarrLayer(options.display.colormap),
    clim: options.display.clim,
    opacity: ECMWF_DEFAULT_OPACITY,
    zarrVersion: 2,
    spatialDimensions: { lat: "latitude", lon: "longitude" },
    onLoadingStateChange: options.onLoadingStateChange,
  });

  return { layer, store, refPath: options.refPath };
}
