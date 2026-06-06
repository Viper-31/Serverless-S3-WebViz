import { describe, expect, it } from "vitest";
import {
  ecmwfColorMaps,
  ecmwfDefaultVar_CMAPS,
  ecmwfDisplayConfigForVariable,
  ecmwfDisplayVariables,
  ecmwfLayerDisplayForVariable,
  ecmwfVarClim,
} from "@/features/display";

describe("features/display", () => {
  it("curates display variables in UI-safe form", () => {
    expect(Object.keys(ecmwfDisplayVariables)).toEqual([
      "d2m",
      "i10fg",
      "lcc",
      "msl",
      "sh2",
      "swvl1",
      "t2m",
      "tcc",
      "tp",
      "u10",
      "v10",
    ]);
    expect(ecmwfDisplayVariables.t2m.label).toBe("Temperature 2m");
  });
  it("provides defaults and layer display helpers", () => {
    expect(ecmwfDefaultVar_CMAPS.t2m).toBe("thermal");
    expect(ecmwfVarClim.msl).toEqual([994, 1036]);
    expect(ecmwfDisplayConfigForVariable("tp")).toEqual({
      clim: [0, 200],
      colormap: "Blues",
    });
    expect(ecmwfLayerDisplayForVariable("tp")).toEqual({
      clim: [0, 200],
      rgbStops: ecmwfColorMaps.Blues.stops.map((stop) => stop.color),
    });
  });
});
