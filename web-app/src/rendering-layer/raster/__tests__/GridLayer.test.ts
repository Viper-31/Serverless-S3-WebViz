import { describe, expect, it } from "vitest";
import { toZarrLayerSelector } from "@/rendering-layer/raster/createGridLayer";

describe("ecmwfLayer contract", () => {
  it("passes structural selector indexes to zarr-layer selectors", () => {
    expect(
      toZarrLayerSelector({
        time: { selected: 8, type: "index" },
        step: { selected: 12, type: "index" },
        ensemble: { selected: 2, type: "index" },
      }),
    ).toEqual({
      time: { selected: 8, type: "index" },
      step: { selected: 12, type: "index" },
      ensemble: { selected: 2, type: "index" },
    });
  });
});
