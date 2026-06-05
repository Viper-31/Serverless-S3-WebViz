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
  },
  lat: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["station"],
    shape: [192],
  },
  lon: {
    zarrV2Dtype: "<f8",
    zarritaDtype: "float64",
    dimensions: ["station"],
    shape: [192],
  },
  // station and code need to use decodeBase64FixedUTFLE to decode into strings
} as const;
