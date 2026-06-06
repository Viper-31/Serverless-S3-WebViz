import { describe, expect, it } from "vitest";
import {
  createEcmwfRasterLayerRequest,
  createEcmwfState,
  ecmwfDisplaySettings,
  updateEcmwfStateForDate,
  updateEcmwfStateForGlobalTimeIndex,
  updateEcmwfStateForVariable,
} from "@/features/selection";

describe("features/selection", () => {
  it("creates and updates provider state", () => {
    const state = createEcmwfState("t2m", "2024-01-06");
    expect(state).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      ecmwfTimeIndex: 8,
      ecmwfStepIndex: 0,
      variableKey: "t2m",
    });
    const next = updateEcmwfStateForVariable(state, "msl");
    expect(updateEcmwfStateForDate(next, "2024-01-09")).toMatchObject({
      variableKey: "msl",
      ecmwfStepIndex: 0,
      refPath: "/refs/ECMWF/2024/01/09.nc.json",
      ecmwfTimeIndex: 0,
    });
    expect(
      updateEcmwfStateForGlobalTimeIndex({ ...state, ecmwfStepIndex: 7 }, 9),
    ).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      ecmwfTimeIndex: 9,
      ecmwfStepIndex: 7,
    });
  });
  it("uses overrides for display settings and request building", () => {
    const state = createEcmwfState("t2m", "2024-01-06");
    state.overrideByVar = { t2m: { clim: [-1, 1], colormap: "coolwarm" } };
    expect(ecmwfDisplaySettings(state)).toEqual({
      clim: [-1, 1],
      rgbStops: [
        [59, 76, 192],
        [188, 184, 183],
        [180, 4, 38],
      ],
    });
    expect(createEcmwfRasterLayerRequest(state)).toEqual({
      kind: "raster",
      datasetKind: "ecmwf",
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      variableId: "t2m",
      selector: {
        time: { selected: 8, type: "index" },
        step: { selected: 0, type: "index" },
      },
      display: {
        clim: [-1, 1],
        rgbStops: [
          [59, 76, 192],
          [188, 184, 183],
          [180, 4, 38],
        ],
      },
    });
  });
});
