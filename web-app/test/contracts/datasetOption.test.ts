import { describe, expect, it } from "vitest";
import {
  ecmwfDatasetOptions,
  dpirdDatasetOptions,
} from "../../src/lib/catalog/datasetOptions";

describe("dataset option boundaries", () => {
  it("keeps DPIRD and ECMWF options stable with explicit metadata", () => {
    expect(dpirdDatasetOptions[0]).toMatchObject({
      id: expect.any(String),
      family: "DPIRD",
      label: expect.any(String),
      ref: expect.any(String),
      sourceObject: expect.any(String),
    });
    expect(ecmwfDatasetOptions[0]).toMatchObject({
      id: expect.any(String),
      family: "ECMWF",
      label: expect.any(String),
      ref: expect.any(String),
      sourceObject: expect.any(String),
      runDateIso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(typeof dpirdDatasetOptions[0].label).toBe("string");
    expect(typeof ecmwfDatasetOptions[0].runDateIso).toBe("string");
  });
});
