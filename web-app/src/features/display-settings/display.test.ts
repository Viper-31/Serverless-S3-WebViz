import { describe, expect, it } from "vitest";
import {
  ecmwfColorMaps,
  ecmwfDefaultVar_CMAPS,
  ecmwfDisplayConfigForVariable,
  ecmwfDisplayVariables,
  ecmwfLayerDisplayForVariable,
  ecmwfVarClim,
} from "@/features/display-settings/display";

describe("features/display-settings/display", () => {
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
    expect(ecmwfDefaultVar_CMAPS.tcc).toBe("Clouds_dark");
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

  it("keeps display overrides scoped to the selected variable", () => {
    const overrideByVar = {
      t2m: { clim: [5, 45] as [number, number], colormap: "thermal" as const },
      i10fg: { clim: [20, 120] as [number, number], colormap: "Reds" as const },
    };

    expect(ecmwfDisplayConfigForVariable("t2m", overrideByVar)).toEqual({
      clim: [5, 45],
      colormap: "thermal",
    });
    expect(ecmwfDisplayConfigForVariable("i10fg", overrideByVar)).toEqual({
      clim: [20, 120],
      colormap: "Reds",
    });
    expect(ecmwfDisplayConfigForVariable("tcc", overrideByVar)).toEqual({
      clim: [0, 1],
      colormap: "Clouds_dark",
    });
  });
});
