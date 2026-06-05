export { ecmwfDisplayVariableKeys } from "@/domain/ecmwf/display";

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
