import {
  ZarrLayer,
  type LoadingState,
  type Selector,
} from "@carbonplan/zarr-layer";

import * as zarr from "zarrita";

import type {
  LayerDisplay,
  LayerSelector,
  RasterLayerRequest,
} from "@/lib/shared/contracts";
import { openReferencedZarrStore } from "@/zarr-store";

export const ECMWF_LAYER_ID = "ecmwf-raster";
const ECMWF_DEFAULT_OPACITY = 0.6;

type SelectorKey = keyof LayerSelector;

function selectedIndex(selector: LayerSelector, key: SelectorKey): number {
  return selector[key].selected;
}

export type EcmwfLayerBundle = {
  layer: ZarrLayer;
  store: zarr.Readable;
  refPath: string;
};

type ZarrLayerLike = Pick<
  ZarrLayer,
  "setSelector" | "setVariable" | "setClim" | "setColormap"
>;

export function toZarrLayerSelector(selector: LayerSelector): Selector {
  return selector as Selector;
}

async function openEcmwfArray(store: zarr.Readable, path: string) {
  return zarr.open.v2(zarr.root(store).resolve(path), { kind: "array" });
}

export async function readEcmwfValidTimeValue(
  store: zarr.Readable,
  selector: LayerSelector,
): Promise<unknown> {
  const validTime = await openEcmwfArray(store, "valid_time");
  return zarr.get(validTime, [
    selectedIndex(selector, "time"),
    selectedIndex(selector, "step"),
  ]);
}

export type CreateEcmwfLayerOptions = RasterLayerRequest & {
  localRangeCoalescing: boolean;
  onLoadingStateChange?: (state: LoadingState) => void;
};

export async function createEcmwfLayer(
  options: CreateEcmwfLayerOptions,
): Promise<EcmwfLayerBundle> {
  const referencedStore = await openReferencedZarrStore({
    refUrl: options.refPath,
    rangeCoalescing: options.localRangeCoalescing,
  });
  const store = referencedStore.store as zarr.Readable;

  const layer = new ZarrLayer({
    id: ECMWF_LAYER_ID,
    store,
    variable: options.variableId,
    selector: toZarrLayerSelector(options.selector),
    colormap: options.display.rgbStops,
    clim: options.display.clim,
    opacity: ECMWF_DEFAULT_OPACITY,
    zarrVersion: 2,
    spatialDimensions: { lat: "latitude", lon: "longitude" },
    onLoadingStateChange: options.onLoadingStateChange,
  });

  return { layer, store, refPath: options.refPath };
}

export async function updateEcmwfLayerSelector(
  layer: ZarrLayerLike,
  selector: LayerSelector,
) {
  await layer.setSelector?.(toZarrLayerSelector(selector));
}

export async function updateEcmwfLayerDisplay(
  layer: ZarrLayerLike,
  input: { variableId: string; display: LayerDisplay },
) {
  await layer.setVariable?.(input.variableId);
  await layer.setClim?.(input.display.clim);
  await layer.setColormap?.(input.display.rgbStops);
}
