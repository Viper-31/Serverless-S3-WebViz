import { validateZarrayCodecMetadata, type RefSpec } from "../zarr-store";

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export type DatasetArraySchema = {
  zarrV2Dtype?: string;
  zarrV2DtypePrefix?: string;
  zarritaDtype: string;
  dimensions: readonly string[];
  shape: readonly number[];
  units?: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(value: unknown, key: string): JsonObject {
  if (typeof value !== "string") {
    throw new SchemaError(`${key} must be a JSON string`);
  }

  try {
    const parsed = JSON.parse(value);
    if (!isObject(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw new SchemaError(`${key} must contain a JSON object`);
  }
}

export function parseZarray(spec: RefSpec, path: string): JsonObject {
  const key = `${path}/.zarray`;
  const value = spec.refs?.[key];
  if (value === undefined) throw new SchemaError(`${key} missing`);
  return parseJsonObject(value, key);
}

export function parseZattrs(spec: RefSpec, path: string): JsonObject {
  const key = `${path}/.zattrs`;
  const value = spec.refs?.[key];
  if (value === undefined) throw new SchemaError(`${key} missing`);
  return parseJsonObject(value, key);
}

function expectEqual(path: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new SchemaError(
      `${path} expected ${String(expected)} but found ${String(actual)}`,
    );
  }
}

function expectNumberArray(
  path: string,
  actual: unknown,
  expected: readonly number[],
) {
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

function expectStringArray(
  path: string,
  actual: unknown,
  expected: readonly string[],
) {
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

export function validateArrayMetadata(
  spec: RefSpec,
  path: string,
  schema: DatasetArraySchema,
): true {
  const zarray = parseZarray(spec, path);
  const zattrs = parseZattrs(spec, path);

  validateZarrayCodecMetadata(zarray);

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

  expectNumberArray(`${path}/.zarray shape`, zarray.shape, schema.shape);
  expectStringArray(
    `${path}/.zattrs _ARRAY_DIMENSIONS`,
    zattrs._ARRAY_DIMENSIONS,
    schema.dimensions,
  );

  if (schema.units !== undefined) {
    expectEqual(`${path}/.zattrs units`, zattrs.units, schema.units);
  }

  return true;
}
