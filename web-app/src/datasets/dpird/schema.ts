import { decodeBase64FixedUTFLE } from "../../domain/dpird/decodeBase64FixedUTFLE";
import type { RefSpec } from "../../zarr-store";
import { validateArrayMetadata, SchemaError, parseZarray } from "../metadata";

// Temporary dpird display list
// Future: move this beside DPIRD display metadata, similar to ecmwfDisplayVariableKeys
export const dpirdDisplayVariableKeys = ["airTemperature"] as const;
export type DpirdDisplayVariableKey = (typeof dpirdDisplayVariableKeys)[number];

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

type DpirdStringPath = "station" | "code";
type DpirdInlineNumericPath = "lat" | "lon";

export function validateDpirdRefSpecSchema(spec: RefSpec): true {
  for (const variableKey of dpirdDisplayVariableKeys) {
    validateArrayMetadata(spec, variableKey, DPIRD_ARRAYS.display);
  }

  validateArrayMetadata(spec, "time", DPIRD_ARRAYS.time);
  validateArrayMetadata(spec, "lat", DPIRD_ARRAYS.lat);
  validateArrayMetadata(spec, "lon", DPIRD_ARRAYS.lon);
  validateArrayMetadata(spec, "station", DPIRD_ARRAYS.station);
  validateArrayMetadata(spec, "code", DPIRD_ARRAYS.code);

  expectInlineBase64NumericArray(spec, "lat");
  expectInlineBase64NumericArray(spec, "lon");
  decodeDpirdInlineStringArray(spec, "station");
  decodeDpirdInlineStringArray(spec, "code");

  return true;
}

export function decodeDpirdInlineStringArray(
  spec: RefSpec,
  path: DpirdStringPath,
): string[] {
  const schema = DPIRD_ARRAYS[path];
  const zarray = parseZarray(spec, path);

  if (zarray.dtype !== schema.zarrV2Dtype) {
    throw new SchemaError(`${path}/.zarray dtype mismatch`);
  }

  const encoded = spec.refs?.[`${path}/0`];
  if (typeof encoded !== "string") {
    throw new SchemaError(`${path}/0 must be an inline base64 string`);
  }

  const values = decodeBase64FixedUTFLE(encoded, schema.fixedUtf32CodePoints);

  if (values.length !== 192) {
    throw new SchemaError(
      `${path}/0 decoded ${values.length} strings, expected 192`,
    );
  }

  return values;
}

function expectInlineBase64NumericArray(
  spec: RefSpec,
  path: DpirdInlineNumericPath,
) {
  const encoded = spec.refs?.[`${path}/0`];

  if (typeof encoded !== "string" || !encoded.startsWith("base64:")) {
    throw new SchemaError(`${path}/0 must be an inline base64 numeric payload`);
  }

  const binary = atob(encoded.slice("base64:".length));
  const expectedBytes = 192 * 8; // 192 values * 8 bytes per float64

  if (binary.length !== expectedBytes) {
    throw new SchemaError(
      `${path}/0 decoded ${binary.length} bytes, expected ${expectedBytes}`,
    );
  }
  return true;
}
