import { describe, expect, it } from "vitest";
import {
  ecmwfDateToTimeIndex,
  ecmwfTimeIndexToDate,
  formatEcmwfValidTimeSeconds,
  mapEcmwfGlobalTimeIndex,
  mapEcmwfTimeToGlobalIndex,
} from "@/features/time_navigation";

describe("features/time_navigation", () => {
  it("maps dates and indices across refs", () => {
    expect(ecmwfDateToTimeIndex("2024-01-06", "2024-01-02")).toBe(8);
    expect(ecmwfTimeIndexToDate("2024-01-02", 8)).toBe("2024-01-06");
    expect(mapEcmwfGlobalTimeIndex(14)).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/09.nc.json",
      refStartDate: "2024-01-09",
      ecmwfTimeIndex: 0,
    });
    expect(mapEcmwfTimeToGlobalIndex("2024-01-09", 0)).toBe(14);
  });
  it("formats valid times", () => {
    expect(formatEcmwfValidTimeSeconds(1708387200)).toBe("20-02-2024 12:00 AM");
    expect(formatEcmwfValidTimeSeconds("not-a-valid-time")).toBe(
      "not-a-valid-time",
    );
  });
});
