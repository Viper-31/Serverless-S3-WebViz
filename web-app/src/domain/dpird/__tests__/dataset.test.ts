import { describe, expect, it } from "vitest";
import {
  dpirdDatasetFrame,
  dpirdDatasetSeries,
  dpirdDatasetDimensions,
} from "../dataset";

describe("dpirdDataset* boundaries", () => {
  it("uses time/station dimensions and point features", () => {
    expect(dpirdDatasetDimensions).toEqual(
      expect.arrayContaining(["time", "station"]),
    );
    expect(dpirdDatasetFrame({ time: "2024-01-01T00:00:00Z" })).toMatchObject({
      keyedBy: "time",
    });
    expect(
      dpirdDatasetSeries({ station: "dpird-1", variable: "rain" }),
    ).toMatchObject({ keyedBy: "station+variable" });
  });
});
