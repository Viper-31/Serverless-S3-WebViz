// Temporary dpird display list
// Future: move this beside DPIRD display metadata, similar to ecmwfDisplayVariableKeys
export const dpirdDisplayVariableKeys = ["airTemperature"] as const;

export const DPIRD_ARRAYS = {
  display: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["station", "time"],
    shape: [192, 105248],
  },
  time: {
    zarrV2Dtype: "<i8",
    zarritaDtype: "int64",
    dimensions: ["time"],
    shape: [105248],
    units: "minutes since 2022-01-01T00:00:00Z",
  },
  lat: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["station"],
    shape: [192],
    inlineBase64Numeric: true,
  },
  lon: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["station"],
    shape: [192],
    inlineBase64Numeric: true,
  },
  // 'station' and 'code' are not safe to treat as normal S3-backed Zarr string array
  // Upstream enrichment by laoding real NetCDF coordinate
  // decodeBase64FixedUTFLE(spec.refs["station/0"], 22) before handling values to future consumer
  station: {
    zarrV2Dtype: "<U22",
    zarritaDtype: "string",
    dimensions: ["station"],
    shape: [192],
    fixedUtf32CodePoints: 22,
  },
  // decodeBase64FixedUTFLE(spec.refs["code/0"], 5)
  code: {
    zarrV2Dtype: "<U5",
    zarritaDtype: "string",
    dimensions: ["station"],
    shape: [192],
    fixedUtf32CodePoints: 5,
  },
} as const;

export type DpirdStringPath = "station" | "code";
export type DpirdInlineNumericPath = "lat" | "lon";
