import type { RefSpec } from "@/zarr-store";

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
