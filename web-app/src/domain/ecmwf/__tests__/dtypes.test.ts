import { describe, expect, it } from "vitest";
import { ecmwfExpectedDtypes, validateEcmwfDtypes } from "../dtypes";

const dtype = (ok: boolean) => ({ is: () => ok });

describe("ecmwfDtypes contract", () => {
  it("validates the expected zarrita-style dtypes", () => {
    expect(ecmwfExpectedDtypes).toMatchObject({
      display: "float32",
      time: "int64",
      step: "float64",
      latitude: "float64",
      longitude: "float64",
      valid_time: "float64",
    });
    expect(
      validateEcmwfDtypes({
        display: dtype(true),
        time: dtype(true),
        step: dtype(true),
        latitude: dtype(true),
        longitude: dtype(true),
        valid_time: dtype(true),
      }),
    ).toBe(true);
  });

  it("rejects a mismatched dtype", () => {
    expect(() =>
      validateEcmwfDtypes({
        display: dtype(false),
        time: dtype(true),
        step: dtype(true),
        latitude: dtype(true),
        longitude: dtype(true),
        valid_time: dtype(true),
      }),
    ).toThrow(/display/i);
  });
});
