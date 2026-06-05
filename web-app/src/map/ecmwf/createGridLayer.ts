import {
  ZarrLayer,
  type LoadingState,
  type Selector,
} from "@carbonplan/zarr-layer";

import * as zarr from "zarrita";

import { openReferencedZarrStore } from "@/zarr-store";

import {
  ecmwfColorMapStopsForZarrLayer,
  type EcmwfColorMapKey,
  type EcmwfVariableKey,
} from "@/domain/ecmwf/display";
import { formatEcmwfValidTimeSeconds } from "@/domain/ecmwf/validTime";

export const ECMWF_LAYER_ID = "ecmwf-raster";
const ECMWF_DEFAULT_OPACITY = 0.75;

export type EcmwfDisplaySettings = {
  clim: [number, number];
  colormap: EcmwfColorMapKey;
};

export type EcmwfLayerBundle = {
  layer: ZarrLayer;
  store: zarr.Readable;
  refPath: string;
};

export function createEcmwfZarrSelector(input: {
  ecmwfTimeIndex: number;
  ecmwfStepIndex: number;
}): Selector {
  return {
    time: { selected: input.ecmwfTimeIndex, type: "index" },
    step: { selected: input.ecmwfStepIndex, type: "index" },
  };
}

async function openEcmwfArray(store: zarr.Readable, path: string) {
  return zarr.open.v2(zarr.root(store).resolve(path), { kind: "array" });
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
  return formatEcmwfValidTimeSeconds(value);
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
  const referencedStore = await openReferencedZarrStore({
    refUrl: options.refPath,
    rangeCoalescing: options.localRangeCoalescing,
  });
  const store = referencedStore.store as zarr.Readable;

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
