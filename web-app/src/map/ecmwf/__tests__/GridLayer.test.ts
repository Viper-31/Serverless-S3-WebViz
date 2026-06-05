import { describe, expect, it } from "vitest";
import { createEcmwfZarrSelector } from "@/map/ecmwf/createGridLayer";

describe("ecmwfLayer contract", () => {
  it("passes ref-local time and step indexes to zarr-layer selectors", () => {
    expect(
      createEcmwfZarrSelector({ ecmwfTimeIndex: 8, ecmwfStepIndex: 12 }),
    ).toEqual({
      time: { selected: 8, type: "index" },
      step: { selected: 12, type: "index" },
    });
  });
});
