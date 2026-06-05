import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RefSpec } from "../../zarr-store";
import { SchemaError } from "../metadata";
import {
  decodeDpirdInlineStringArray,
  validateDpirdRefSpecSchema,
} from "./schema";

async function loadDpirdRefSpec(): Promise<RefSpec> {
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

describe("DPIRD metadata schema", () => {
  it("accepts the fixture schema before any live range reads", async () => {
    const spec = await loadDpirdRefSpec();
    expect(validateDpirdRefSpecSchema(spec)).toBe(true);
  });

  it("decodes enriched inline station and code coordinates", async () => {
    const spec = await loadDpirdRefSpec();

    const stations = decodeDpirdInlineStringArray(spec, "station");
    const codes = decodeDpirdInlineStringArray(spec, "code");

    expect(stations).toHaveLength(192);
    expect(codes).toHaveLength(192);
    expect(stations[0]).toBe("Floreat Park");
    expect(codes[0]).toBe("FL");
  });

  it("raises SchemaError when measurement dimensions drift", async () => {
    const spec = replaceJsonEntry(
      await loadDpirdRefSpec(),
      "airTemperature/.zattrs",
      {
        _ARRAY_DIMENSIONS: ["time", "station"],
      },
    );

    expect(() => validateDpirdRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when time units drift", async () => {
    const spec = replaceJsonEntry(await loadDpirdRefSpec(), "time/.zattrs", {
      units: "seconds since 1970-01-01",
    });

    expect(() => validateDpirdRefSpecSchema(spec)).toThrow(SchemaError);
  });

  it("raises SchemaError when enriched string payload is not inline base64", async () => {
    const spec = await loadDpirdRefSpec();
    const refs = {
      ...(spec.refs ?? {}),
      "code/0": ["s3://webviz/DPIRD/dpird_wa_stations.nc", 0, 10],
    };

    expect(() => validateDpirdRefSpecSchema({ ...spec, refs })).toThrow(
      SchemaError,
    );
  });
});
