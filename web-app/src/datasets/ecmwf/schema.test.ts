import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RefSpec } from "../../zarr-store";
import { SchemaError } from "../metadata";
import { validateEcmwfRefSpecSchema } from "./schema";

async function loadEcmwfSpec(): Promise<RefSpec> {
  return JSON.parse(
    await readFile(
      new URL("../../../public/refs/ECMWF/01/02.json", import.meta.url),
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

  it("raises SchemaError when dimension order drifts", async () => {
    const spec = replaceJsonEntry(await loadEcmwfSpec(), "valid_time/.zattrs", {
      _ARRAY_DIMENSIONS: ["step", "time"],
    });

    expect(() => validateEcmwfRefSpecSchema(spec)).toThrow(SchemaError);
  });
});
