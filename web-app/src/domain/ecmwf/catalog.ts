export type EcmwfRefCatalogEntry = {
  refPath: string;
  refStartDate: string;
  refEndDate: string;
  sourceObject: string;
};

export type EcmwfInventoryLedger = {
  objects: Record<string, unknown>;
};

export const ECMWF_REFERENCE_UNAVAILABLE_MESSAGE =
  "No reference available: Selected calander date is outside of range of avaialble references.";

const ECMWF_CATALOG_START = "2024-01-02";
const ECMWF_CATALOG_END = "2024-12-31";

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

function ecmwfDateFromSourceObject(sourceObject: string): string | null {
  const match = /^ECMWF\/(\d{4})\/(\d{2})\/(\d{2})\.nc$/.exec(sourceObject);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function sourceObjectFromDate(refStartDate: string): string {
  return `ECMWF/${refStartDate.slice(0, 4)}/${refStartDate.slice(5, 7)}/${refStartDate.slice(8, 10)}.nc`;
}

function catalogEntryFromSourceObject(
  sourceObject: string,
  refStartDate: string,
): EcmwfRefCatalogEntry {
  return {
    refPath: ecmwfRefPathFromSourceObject(sourceObject),
    refStartDate,
    refEndDate: addDays(refStartDate, 6),
    sourceObject,
  };
}

function ecmwfRefPathFromSourceObject(sourceObject: string): string {
  return `/refs/${sourceObject}.json`;
}

export function buildEcmwfRefCatalog(
  startDate = ECMWF_CATALOG_START,
  endDate = ECMWF_CATALOG_END,
): EcmwfRefCatalogEntry[] {
  const entries: EcmwfRefCatalogEntry[] = [];
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
  ledger: EcmwfInventoryLedger,
): EcmwfRefCatalogEntry[] {
  return Object.keys(ledger.objects)
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
  catalog: EcmwfRefCatalogEntry[] = ecmwfRefCatalog,
): EcmwfRefCatalogEntry {
  const ref = catalog.find(
    (entry) => entry.refStartDate <= dateIso && dateIso <= entry.refEndDate,
  );
  if (!ref) throw new Error(ECMWF_REFERENCE_UNAVAILABLE_MESSAGE);
  return ref;
}

export function ecmwfDateToTimeIndex(
  dateIso: string,
  refStartDate: string,
): number {
  const refStart = toUtcDate(refStartDate);
  const date = toUtcDate(dateIso);
  return (
    Math.floor((date.getTime() - refStart.getTime()) / (24 * 60 * 60 * 1000)) *
    2
  );
}

export function ecmwfTimeIndexToDate(
  refStartDate: string,
  ecmwfTimeIndex: number,
): string {
  return addDays(refStartDate, Math.floor(ecmwfTimeIndex / 2));
}

export function mapEcmwfGlobalTimeIndex(
  globalTimeIndex: number,
  catalog: EcmwfRefCatalogEntry[] = ecmwfRefCatalog,
): { refPath: string; refStartDate: string; ecmwfTimeIndex: number } {
  if (globalTimeIndex < 0)
    throw new Error("globalTimeIndex must be non-negative");
  const refIndex = Math.floor(globalTimeIndex / 14);
  const ecmwfTimeIndex = globalTimeIndex % 14;
  const ref = catalog[refIndex];
  if (!ref) throw new Error(ECMWF_REFERENCE_UNAVAILABLE_MESSAGE);
  return {
    refPath: ref.refPath,
    refStartDate: ref.refStartDate,
    ecmwfTimeIndex,
  };
}

export function mapEcmwfTimeToGlobalIndex(
  refStartDate: string,
  ecmwfTimeIndex: number,
  catalog: EcmwfRefCatalogEntry[] = ecmwfRefCatalog,
): number {
  const refIndex = catalog.findIndex(
    (entry) => entry.refStartDate === refStartDate,
  );
  if (refIndex < 0) throw new Error("Unknown ECMWF ref start date");
  return refIndex * 14 + ecmwfTimeIndex;
}
