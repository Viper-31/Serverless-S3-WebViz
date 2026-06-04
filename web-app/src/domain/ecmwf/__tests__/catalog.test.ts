import { describe, expect, it } from "vitest";
import {
  buildEcmwfRefCatalog,
  buildEcmwfRefCatalogFromInventoryLedger,
  ecmwfDateToTimeIndex,
  ecmwfRefCatalog,
  findEcmwfRefForDate,
  mapEcmwfGlobalTimeIndex,
  mapEcmwfTimeToGlobalIndex,
} from "../catalog";

describe("ecmwfCatalog contract", () => {
  it("catalogs weekly refs from inventory ledger and maps dates to covering refs", () => {
    expect(ecmwfRefCatalog[0]).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      refEndDate: "2024-01-08",
    });
    expect(buildEcmwfRefCatalog().at(-1)).toMatchObject({
      refStartDate: "2024-12-31",
      refEndDate: "2025-01-06",
    });
    expect(findEcmwfRefForDate("2024-01-06")).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
    });
    expect(ecmwfDateToTimeIndex("2024-01-06", "2024-01-02")).toBe(8);
  });

  it("builds weekly refs from inventory ledger object keys without reading ref JSON files", () => {
    const catalog = buildEcmwfRefCatalogFromInventoryLedger({
      objects: {
        "DPIRD/dpird_wa_stations.nc": {},
        "ECMWF/2024/01/09.nc": {},
        "ECMWF/2024/01/02.nc": {},
      },
    });

    expect(catalog).toEqual([
      {
        refPath: "/refs/ECMWF/2024/01/02.nc.json",
        refStartDate: "2024-01-02",
        refEndDate: "2024-01-08",
        sourceObject: "ECMWF/2024/01/02.nc",
      },
      {
        refPath: "/refs/ECMWF/2024/01/09.nc.json",
        refStartDate: "2024-01-09",
        refEndDate: "2024-01-15",
        sourceObject: "ECMWF/2024/01/09.nc",
      },
    ]);
  });

  it("maps global and local time indices across ref boundaries", () => {
    expect(mapEcmwfGlobalTimeIndex(13)).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      ecmwfTimeIndex: 13,
    });
    expect(mapEcmwfGlobalTimeIndex(14)).toMatchObject({
      refPath: "/refs/ECMWF/2024/01/09.nc.json",
      refStartDate: "2024-01-09",
      ecmwfTimeIndex: 0,
    });
    expect(mapEcmwfTimeToGlobalIndex("2024-01-09", 0)).toBe(14);
  });

  it("rejects dates outside available refs with the exact user-facing message", () => {
    expect(() => findEcmwfRefForDate("2023-12-31")).toThrow(
      "No reference available: Selected calander date is outside of range of avaialble references.",
    );
  });
});
