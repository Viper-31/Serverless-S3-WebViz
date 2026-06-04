import { describe, expect, it } from "vitest";
import {
  ecmwfColorMapStopsForZarrLayer,
  ecmwfColorMaps,
  ecmwfDefaultVar_CMAPS,
  ecmwfDisplayConfigForVariable,
  ecmwfDisplayVariables,
  ecmwfVarClim,
} from "../display";

describe("ecmwfDisplay contract", () => {
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

  it("provides defaults and preserves overrides", () => {
    expect(ecmwfDefaultVar_CMAPS.t2m).toBe("thermal");
    expect(ecmwfVarClim.msl).toEqual([994, 1036]);
    expect(ecmwfDisplayConfigForVariable("tp")).toEqual({
      clim: [0, 200],
      colormap: "Blues",
    });
    expect(ecmwfDisplayConfigForVariable("u10")).toEqual({
      clim: [-100, 100],
      colormap: "viridis",
    });
    expect(
      ecmwfDisplayConfigForVariable("t2m", {
        t2m: { clim: [-5, 5], colormap: "coolwarm" },
      }),
    ).toEqual({ clim: [-5, 5], colormap: "coolwarm" });
  });

  it("exposes the expected color maps", () => {
    expect(Object.keys(ecmwfColorMaps).sort()).toEqual(
      [
        "Blues",
        "GnBu",
        "Greys_trunc",
        "Purples",
        "RdBu_r",
        "Reds",
        "YlGnBu",
        "coolwarm",
        "thermal",
        "viridis",
      ].sort(),
    );
    expect(ecmwfColorMaps.thermal.gradient).toBe(
      "linear-gradient(to right, #053061, #2166ac, #4393c3, #92c5de, #f4a582, #d6604d, #b2182b, #67001f)",
    );
    expect(ecmwfColorMaps.thermal.stops[0]).toEqual({
      pos: 0,
      color: [5, 48, 97],
    });
    expect(ecmwfColorMapStopsForZarrLayer("thermal")[0]).toEqual([5, 48, 97]);
  });
});
