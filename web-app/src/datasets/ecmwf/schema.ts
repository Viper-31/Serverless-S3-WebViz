import { ecmwfDisplayVariableKeys } from "@/domain/ecmwf/display";
import type { RefSpec } from "@/zarr-store";
import { validateArrayMetadata, SchemaError } from "@/datasets/metadata";

export const ECMWF_TIME_INDEX_COUNT_PER_REF = 14;
export const ECMWF_STEP_INDEX_COUNT = 113;

export const ECMWF_ARRAYS = {
  display: {
    zarrV2Dtype: "<f4",
    zarritaDtype: "float32",
    dimensions: ["time", "step", "latitude", "longitude"],
    shape: [14, 113, 111, 151],
  },
  time: {
    zarrV2Dtype: "<i8",
    zarritaDtype: "int64",
    dimensions: ["time"],
    shape: [14],
    units: "seconds since 1970-01-01",
  },
  step: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["step"],
    shape: [113],
  },
  latitude: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["latitude"],
    shape: [111],
  },
  longitude: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["longitude"],
    shape: [151],
  },
  valid_time: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["time", "step"],
    shape: [14, 113],
    units: "seconds since 1970-01-01",
  },
} as const;

type ZarritaArrayLike = {
  is(dtype: string): boolean;
};

export type EcmwfOpenArray = (path: string) => Promise<ZarritaArrayLike>;

export function validateEcmwfRefSpecSchema(spec: RefSpec): true {
  for (const variableKey of ecmwfDisplayVariableKeys) {
    validateArrayMetadata(spec, variableKey, ECMWF_ARRAYS.display);
  }

  validateArrayMetadata(spec, "time", ECMWF_ARRAYS.time);
  validateArrayMetadata(spec, "step", ECMWF_ARRAYS.step);
  validateArrayMetadata(spec, "latitude", ECMWF_ARRAYS.latitude);
  validateArrayMetadata(spec, "longitude", ECMWF_ARRAYS.longitude);
  validateArrayMetadata(spec, "valid_time", ECMWF_ARRAYS.valid_time);

  return true;
}
export async function validateEcmwfStoreDtypes(
  openArray: EcmwfOpenArray,
): Promise<true> {
  for (const variableKey of ecmwfDisplayVariableKeys) {
    const array = await openArray(variableKey);
    if (!array.is(ECMWF_ARRAYS.display.zarritaDtype)) {
      throw new SchemaError(`dtype mismatch for ${variableKey}`);
    }
  }

  const checks = [
    ["time", ECMWF_ARRAYS.time.zarritaDtype],
    ["step", ECMWF_ARRAYS.step.zarritaDtype],
    ["latitude", ECMWF_ARRAYS.latitude.zarritaDtype],
    ["longitude", ECMWF_ARRAYS.longitude.zarritaDtype],
    ["valid_time", ECMWF_ARRAYS.valid_time.zarritaDtype],
  ] as const;

  for (const [path, dtype] of checks) {
    const array = await openArray(path);
    if (!array.is(dtype)) throw new SchemaError(`dtype mismatch for ${path}`);
  }

  return true;
}
