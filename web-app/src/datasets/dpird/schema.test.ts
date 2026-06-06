import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RefSpec } from "@/zarr-store";
import { decodeBase64FixedUTFLE } from "@/domain/dpird/decodeBase64FixedUTFLE";
import {
  parseZarray,
  parseZattrs,
  SchemaError,
  type DatasetArraySchema,
} from "@/datasets/parser";
import {
  DPIRD_ARRAYS,
  dpirdDisplayVariableKeys,
  type DpirdInlineNumericPath,
  type DpirdStringPath,
} from "@/datasets/dpird/schema";

async function loadDpirdSpec(): Promise<RefSpec> {
  return JSON.parse(
    await readFile(
      new URL(
        "../../../public/refs/DPIRD/dpird_wa_stations.nc.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as RefSpec;
}

function replaceJsonEntry(
  spec: RefSpec,
  key: string,
  patch: Record<string, unknown>,
): RefSpec {
  const refs = { ...(spec.refs ?? {}) };
  refs[key] = JSON.stringify({
    ...JSON.parse(String(refs[key])),
    ...patch,
  });
  return { ...spec, refs };
}

function expectEqual(path: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new SchemaError(
      `${path} expected ${String(expected)} but found ${String(actual)}`,
    );
  }
}

function expectArray<T>(path: string, actual: unknown, expected: readonly T[]) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new SchemaError(`${path} expected [${expected.join(",")}]`);
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new SchemaError(
        `${path} expected [${expected.join(",")}] but found [${actual.join(",")}]`,
      );
    }
  }
}

function expectArrayMetadata(
  spec: RefSpec,
  path: string,
  schema: DatasetArraySchema,
): true {
  const zarray = parseZarray(spec, path);
  const zattrs = parseZattrs(spec, path);

  if (schema.zarrV2Dtype !== undefined) {
    expectEqual(`${path}/.zarray dtype`, zarray.dtype, schema.zarrV2Dtype);
  }

  if (schema.zarrV2DtypePrefix !== undefined) {
    if (
      typeof zarray.dtype !== "string" ||
      !zarray.dtype.startsWith(schema.zarrV2DtypePrefix)
    ) {
      throw new SchemaError(
        `${path}/.zarray dtype expected prefix ${schema.zarrV2DtypePrefix}`,
      );
    }
  }

  expectArray(`${path}/.zarray shape`, zarray.shape, schema.shape);
  expectArray(
    `${path}/.zattrs _ARRAY_DIMENSIONS`,
    zattrs._ARRAY_DIMENSIONS,
    schema.dimensions,
  );

  if (schema.units !== undefined) {
    expectEqual(`${path}/.zattrs units`, zattrs.units, schema.units);
  }

  return true;
}

function validateDpirdRefSpecSchema(spec: RefSpec): true {
  for (const variableKey of dpirdDisplayVariableKeys) {
    expectArrayMetadata(spec, variableKey, DPIRD_ARRAYS.display);
  }

  expectArrayMetadata(spec, "time", DPIRD_ARRAYS.time);
  expectArrayMetadata(spec, "lat", DPIRD_ARRAYS.lat);
  expectArrayMetadata(spec, "lon", DPIRD_ARRAYS.lon);
  expectArrayMetadata(spec, "station", DPIRD_ARRAYS.station);
  expectArrayMetadata(spec, "code", DPIRD_ARRAYS.code);

  expectInlineBase64NumericArray(spec, "lat");
  expectInlineBase64NumericArray(spec, "lon");
  decodeDpirdInlineStringArray(spec, "station");
  decodeDpirdInlineStringArray(spec, "code");

  return true;
}

function decodeDpirdInlineStringArray(
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

describe("DPIRD metadata schema", () => {
  it("accepts the fixture schema before any live range reads", async () => {
    const spec = await loadDpirdSpec();
    expect(validateDpirdRefSpecSchema(spec)).toBe(true);
  });

  it("decodes enriched inline station and code coordinates", async () => {
    const spec = await loadDpirdSpec();

    const stations = decodeDpirdInlineStringArray(spec, "station");
    const codes = decodeDpirdInlineStringArray(spec, "code");

    expect(stations).toHaveLength(192);
    expect(codes).toHaveLength(192);
    expect(stations[0]).toBe("Floreat Park");
    expect(codes[0]).toBe("FL");
  });

  it("raises SchemaError when measurement dimensions drift", async () => {
    const spec = replaceJsonEntry(
      await loadDpirdSpec(),
      "airTemperature/.zattrs",
      {
        _ARRAY_DIMENSIONS: ["time", "station"],
      },
    );

    expect(() => validateDpirdRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when time units drift", async () => {
    const spec = replaceJsonEntry(await loadDpirdSpec(), "time/.zattrs", {
      units: "seconds since 1970-01-01",
    });

    expect(() => validateDpirdRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when enriched string payload is not inline base64", async () => {
    const spec = await loadDpirdSpec();
    const refs = {
      ...(spec.refs ?? {}),
      "code/0": ["s3://webviz/DPIRD/dpird_wa_stations.nc", 0, 10],
    };

    expect(() => validateDpirdRefSpecSchema({ ...spec, refs })).toThrow(
      SchemaError,
    );
  });

  it("raises SchemaError when display variable dtype drifts", async () => {
    const spec = replaceJsonEntry(
      await loadDpirdSpec(),
      "airTemperature/.zarray",
      {
        dtype: "<f4",
      },
    );

    expect(() => validateDpirdRefSpecSchema(spec)).toThrow(SchemaError);
  });
});
