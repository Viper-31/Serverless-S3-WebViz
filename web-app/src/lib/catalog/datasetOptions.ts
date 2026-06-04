import { ecmwfRefCatalog } from "../datasets/ecmwfCatalog";

export const dpirdDatasetOptions = [
  {
    id: "dpird-wa-stations",
    family: "DPIRD" as const,
    label: "DPIRD WA Stations",
    ref: "/refs/DPIRD/dpird_wa_stations.nc.json",
    sourceObject: "DPIRD/dpird_wa_stations.nc",
  },
];

export const ecmwfDatasetOptions = [
  ...ecmwfRefCatalog.map((entry) => ({
    id: `ecmwf-${entry.refStartDate}`,
    family: "ECMWF" as const,
    label: `ECMWF ${entry.refStartDate}`,
    ref: entry.refPath,
    sourceObject: entry.sourceObject,
    runDateIso: entry.refStartDate,
  })),
];
