import { describe, expect, it } from "vitest";
import {
  buildEcmwfRefCatalog,
  buildEcmwfRefCatalogFromInventoryLedger,
  buildInventoryCatalog,
  ecmwfRefCatalog,
  findEcmwfRefForDate,
} from "@/datasets/inventory_parser";

describe("inventoryParser contract", () => {
  it("catalogs weekly ECMWF refs and maps dates to covering refs", () => {
    expect(ecmwfRefCatalog[0]).toMatchObject({
      datasetKind: "ecmwf",
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      refEndDate: "2024-01-08",
    });
    expect(buildEcmwfRefCatalog().at(-1)).toMatchObject({
      refStartDate: "2024-12-31",
      refEndDate: "2025-01-06",
    });
    expect(findEcmwfRefForDate("2024-01-06")).toMatchObject({
      datasetKind: "ecmwf",
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
    });
  });

  it("builds ECMWF refs from inventory ledger object keys without reading ref JSON files", () => {
    const catalog = buildEcmwfRefCatalogFromInventoryLedger({
      objects: {
        "DPIRD/dpird_wa_stations.nc": {},
        "ECMWF/2024/01/09.nc": {},
        "ECMWF/2024/01/02.nc": {},
      },
    });

    expect(catalog).toEqual([
      {
        datasetKind: "ecmwf",
        refPath: "/refs/ECMWF/2024/01/02.nc.json",
        refStartDate: "2024-01-02",
        refEndDate: "2024-01-08",
        sourceObject: "ECMWF/2024/01/02.nc",
      },
      {
        datasetKind: "ecmwf",
        refPath: "/refs/ECMWF/2024/01/09.nc.json",
        refStartDate: "2024-01-09",
        refEndDate: "2024-01-15",
        sourceObject: "ECMWF/2024/01/09.nc",
      },
    ]);
  });

  it("builds both ECMWF and DPIRD inventory entries from mixed ledger-like input", () => {
    const catalog = buildInventoryCatalog({
      objects: {
        "DPIRD/dpird_wa_stations.nc": {},
        "ECMWF/2024/01/02.nc": {},
        "ECMWF/2024/01/09.nc": {},
        "unrelated/object.nc": {},
      },
    });

    expect(catalog.ecmwf).toEqual([
      {
        datasetKind: "ecmwf",
        refPath: "/refs/ECMWF/2024/01/02.nc.json",
        refStartDate: "2024-01-02",
        refEndDate: "2024-01-08",
        sourceObject: "ECMWF/2024/01/02.nc",
      },
      {
        datasetKind: "ecmwf",
        refPath: "/refs/ECMWF/2024/01/09.nc.json",
        refStartDate: "2024-01-09",
        refEndDate: "2024-01-15",
        sourceObject: "ECMWF/2024/01/09.nc",
      },
    ]);

    expect(catalog.dpird).toEqual([
      {
        datasetKind: "dpird",
        refPath: "/refs/DPIRD/dpird_wa_stations.nc.json",
        sourceObject: "DPIRD/dpird_wa_stations.nc",
      },
    ]);
  });

  it("rejects dates outside available refs with the exact internal diagnostic message", () => {
    expect(() => findEcmwfRefForDate("2023-12-31")).toThrow(
      "No reference available for 2023-12-31: Selected calander date is outside of range of avaialble references.",
    );
  });
});
