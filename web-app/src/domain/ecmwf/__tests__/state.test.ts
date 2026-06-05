import { describe, expect, it } from "vitest";
import {
  createEcmwfState,
  ecmwfDisplaySettings,
  updateEcmwfStateForDate,
  updateEcmwfStateForGlobalTimeIndex,
  updateEcmwfStateForVariable,
} from "@/domain/ecmwf/state";

describe("ecmwfState contract", () => {
  it("creates canonical ref-local state from selected dates", () => {
    expect(createEcmwfState("t2m", "2024-01-06")).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      ecmwfTimeIndex: 8,
      ecmwfStepIndex: 0,
      variableKey: "t2m",
    });
  });

  it("preserves variable selection and resets step on ref/time changes", () => {
    const next = updateEcmwfStateForVariable(
      createEcmwfState("t2m", "2024-01-06"),
      "msl",
    );
    expect(updateEcmwfStateForDate(next, "2024-01-09")).toMatchObject({
      variableKey: "msl",
      ecmwfStepIndex: 0,
      refPath: "/refs/ECMWF/2024/01/09.nc.json",
      ecmwfTimeIndex: 0,
    });
    expect(updateEcmwfStateForGlobalTimeIndex(next, 14)).toMatchObject({
      variableKey: "msl",
      ecmwfStepIndex: 0,
      refStartDate: "2024-01-09",
      ecmwfTimeIndex: 0,
    });
  });

  it("preserves step when time changes within the same reference", () => {
    const state = {
      ...createEcmwfState("t2m", "2024-01-06"),
      ecmwfStepIndex: 7,
    };
    expect(updateEcmwfStateForGlobalTimeIndex(state, 9)).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      ecmwfTimeIndex: 9,
      ecmwfStepIndex: 7,
    });
  });

  it("uses variable overrides for display settings", () => {
    const state = createEcmwfState("t2m", "2024-01-06");
    state.overrideByVar = { t2m: { clim: [-1, 1], colormap: "coolwarm" } };
    expect(ecmwfDisplaySettings(state)).toEqual({
      clim: [-1, 1],
      colormap: "coolwarm",
    });
  });
});
