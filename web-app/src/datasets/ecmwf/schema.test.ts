import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RefSpec } from "@/zarr-store";
import {
  parseZarray,
  parseZattrs,
  SchemaError,
  type DatasetArraySchema,
} from "@/datasets/parser";
import {
  ECMWF_ARRAYS,
  ecmwfDisplayVariableKeys,
} from "@/datasets/ecmwf/schema";

async function loadEcmwfSpec(): Promise<RefSpec> {
  return JSON.parse(
    await readFile(
      new URL("../../../public/refs/ECMWF/2024/01/02.nc.json", import.meta.url),
      "utf-8",
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

function validateEcmwfRefSpecSchema(spec: RefSpec): true {
  for (const variableKey of ecmwfDisplayVariableKeys) {
    expectArrayMetadata(spec, variableKey, ECMWF_ARRAYS.display);
  }

  expectArrayMetadata(spec, "time", ECMWF_ARRAYS.time);
  expectArrayMetadata(spec, "step", ECMWF_ARRAYS.step);
  expectArrayMetadata(spec, "latitude", ECMWF_ARRAYS.latitude);
  expectArrayMetadata(spec, "longitude", ECMWF_ARRAYS.longitude);
  expectArrayMetadata(spec, "valid_time", ECMWF_ARRAYS.valid_time);

  return true;
}

describe("ECMWF metadata schema", () => {
  it("accepts the fixture schema before any live range reads", async () => {
    const spec = await loadEcmwfSpec();
    expect(validateEcmwfRefSpecSchema(spec)).toBe(true);
  });

  it("raises SchemaError when display variable dtype drifts", async () => {
    const spec = replaceJsonEntry(await loadEcmwfSpec(), "t2m/.zarray", {
      dtype: "<f8",
    });

    expect(() => validateEcmwfRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when grid shape drifts", async () => {
    const spec = replaceJsonEntry(await loadEcmwfSpec(), "t2m/.zarray", {
      shape: [14, 113, 110, 151],
    });

    expect(() => validateEcmwfRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when valid_time semantics drift", async () => {
    const spec = replaceJsonEntry(await loadEcmwfSpec(), "valid_time/.zattrs", {
      units: "nanoseconds since 1970-01-01",
    });

    expect(() => validateEcmwfRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when dimension order drifts", async () => {
    const spec = replaceJsonEntry(await loadEcmwfSpec(), "valid_time/.zattrs", {
      _ARRAY_DIMENSIONS: ["step", "time"],
    });

    expect(() => validateEcmwfRefSpecSchema(spec)).toThrow(SchemaError);
  });
});
