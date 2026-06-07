import type { RefSpec } from "@/zarr-store";

type JsonObject = Record<string, unknown>;

export type DatasetArraySchema = {
  zarrV2Dtype?: string;
  zarrV2DtypePrefix?: string;
  zarritaDtype: string;
  dimensions: readonly string[];
  shape: readonly number[];
  units?: string;
};

type InventoryLedgerObjectMap = Record<string, unknown>;

type InventoryLedger = {
  objects?: InventoryLedgerObjectMap;
};

const ECMWF_REFERENCE_UNAVAILABLE_MESSAGE =
  "No reference available for ${dateIso}: Selected calander date is outside of range of avaialble references.";

const ECMWF_CATALOG_START = "2024-01-02";
const ECMWF_CATALOG_END = "2024-12-31";

export type EcmwfInventoryEntry = {
  datasetKind: "ecmwf";
  sourceObject: string;
  refPath: string;
  refStartDate: string;
  refEndDate: string;
};

export type DpirdInventoryEntry = {
  datasetKind: "dpird";
  sourceObject: string;
  refPath: string;
};

export type InventoryCatalog = {
  ecmwf: EcmwfInventoryEntry[];
  dpird: DpirdInventoryEntry[];
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toUtcDate(dateIso: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const date = toUtcDate(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function publicAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

function ecmwfDateFromSourceObject(sourceObject: string): string | null {
  const match = /^ECMWF\/(\d{4})\/(\d{2})\/(\d{2})\.nc$/.exec(sourceObject);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function sourceObjectFromDate(refStartDate: string): string {
  return `ECMWF/${refStartDate.slice(0, 4)}/${refStartDate.slice(5, 7)}/${refStartDate.slice(8, 10)}.nc`;
}

function ecmwfRefPathFromSourceObject(sourceObject: string): string {
  return publicAssetPath(`/refs/${sourceObject}.json`);
}

function catalogEntryFromSourceObject(
  sourceObject: string,
  refStartDate: string,
): EcmwfInventoryEntry {
  return {
    datasetKind: "ecmwf",
    refPath: ecmwfRefPathFromSourceObject(sourceObject),
    refStartDate,
    refEndDate: addDays(refStartDate, 6),
    sourceObject,
  };
}

function dpirdEntryFromSourceObject(sourceObject: string): DpirdInventoryEntry {
  return {
    datasetKind: "dpird",
    refPath: publicAssetPath(`/refs/${sourceObject}.json`),
    sourceObject,
  };
}

function parseInventoryLedger(input: unknown): InventoryLedger {
  if (!isObject(input)) return {};
  return { objects: isObject(input.objects) ? input.objects : undefined };
}

export class SchemaError extends Error {
  override name = "SchemaError";
}

function parseJsonObjectRef(spec: RefSpec, key: string): JsonObject {
  const value = spec.refs?.[key];
  if (value === undefined) {
    throw new SchemaError(`${key} is missing`);
  }
  if (typeof value !== "string") {
    throw new SchemaError(`${key} must be a JSON string`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new SchemaError(`${key} must contain a valid JSON`);
  }

  if (!isObject(parsed)) {
    throw new SchemaError(`${key} must be a JSON object`);
  }

  return parsed;
}

export function parseZarray(spec: RefSpec, path: string): JsonObject {
  return parseJsonObjectRef(spec, `${path}/.zarray`);
}

export function parseZattrs(spec: RefSpec, path: string): JsonObject {
  return parseJsonObjectRef(spec, `${path}/.zattrs`);
}

export function buildEcmwfRefCatalog(
  startDate = ECMWF_CATALOG_START,
  endDate = ECMWF_CATALOG_END,
): EcmwfInventoryEntry[] {
  const entries: EcmwfInventoryEntry[] = [];
  for (
    let refStartDate = startDate;
    refStartDate <= endDate;
    refStartDate = addDays(refStartDate, 7)
  ) {
    entries.push(
      catalogEntryFromSourceObject(
        sourceObjectFromDate(refStartDate),
        refStartDate,
      ),
    );
  }
  return entries;
}

export function buildEcmwfRefCatalogFromInventoryLedger(
  input: unknown,
): EcmwfInventoryEntry[] {
  const ledger = parseInventoryLedger(input);
  return Object.keys(ledger.objects ?? {})
    .map((sourceObject) => ({
      sourceObject,
      refStartDate: ecmwfDateFromSourceObject(sourceObject),
    }))
    .filter(
      (entry): entry is { sourceObject: string; refStartDate: string } =>
        entry.refStartDate !== null,
    )
    .sort((a, b) => a.refStartDate.localeCompare(b.refStartDate))
    .map(({ sourceObject, refStartDate }) =>
      catalogEntryFromSourceObject(sourceObject, refStartDate),
    );
}

export const ecmwfRefCatalog = buildEcmwfRefCatalog();

export function findEcmwfRefForDate(
  dateIso: string,
  catalog: EcmwfInventoryEntry[] = ecmwfRefCatalog,
): EcmwfInventoryEntry {
  const ref = catalog.find(
    (entry) => entry.refStartDate <= dateIso && dateIso <= entry.refEndDate,
  );
  if (!ref)
    throw new Error(
      ECMWF_REFERENCE_UNAVAILABLE_MESSAGE.replace("${dateIso}", dateIso),
    );
  return ref;
}

export function buildInventoryCatalog(input: unknown): InventoryCatalog {
  const ledger = parseInventoryLedger(input);
  const objects = Object.keys(ledger.objects ?? {});

  const ecmwf = objects
    .filter((sourceObject) => ecmwfDateFromSourceObject(sourceObject) !== null)
    .map((sourceObject) => {
      const refStartDate = ecmwfDateFromSourceObject(sourceObject);
      if (refStartDate === null) {
        throw new Error("Unreachable ECMWF parse state");
      }
      return catalogEntryFromSourceObject(sourceObject, refStartDate);
    })
    .sort((a, b) => a.refStartDate.localeCompare(b.refStartDate));

  const dpird = objects
    .filter((sourceObject) => sourceObject.startsWith("DPIRD/"))
    .map((sourceObject) => dpirdEntryFromSourceObject(sourceObject));

  return { ecmwf, dpird };
}

export async function loadInventoryCatalog(
  fetchInventory: typeof fetch = fetch,
): Promise<InventoryCatalog> {
  const response = await fetchInventory(
    publicAssetPath("_state/inventory_ledger.json"),
    {
      credentials: "omit",
    },
  );
  if (!response.ok)
    throw new Error(`Failed to load inventory catalog: ${response.status}`);
  return buildInventoryCatalog(await response.json());
}
