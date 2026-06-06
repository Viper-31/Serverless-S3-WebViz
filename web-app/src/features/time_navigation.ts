import {
  ecmwfRefCatalog,
  type EcmwfInventoryEntry,
} from "@/datasets/inventory_parser";
import { type LayerSelector } from "@/lib/shared/contracts";

function rawValidTime(value: unknown): string {
  return String(value);
}
function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
function utcAmPmHour(hour: number): { hour12: number; suffix: "AM" | "PM" } {
  const suffix = hour >= 12 ? "PM" : "AM";
  return { hour12: hour % 12 === 0 ? 12 : hour % 12, suffix };
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

export function formatEcmwfValidTimeSeconds(value: unknown): string {
  try {
    const seconds = typeof value === "bigint" ? Number(value) : Number(value);
    if (!Number.isFinite(seconds)) return rawValidTime(value);
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return rawValidTime(value);
    const { hour12, suffix } = utcAmPmHour(date.getUTCHours());
    return `${twoDigits(date.getUTCDate())}-${twoDigits(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${twoDigits(hour12)}:${twoDigits(date.getUTCMinutes())} ${suffix}`;
  } catch {
    return rawValidTime(value);
  }
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
  catalog: EcmwfInventoryEntry[] = ecmwfRefCatalog,
): { refPath: string; refStartDate: string; ecmwfTimeIndex: number } {
  if (globalTimeIndex < 0)
    throw new Error("globalTimeIndex must be non-negative");
  const refIndex = Math.floor(globalTimeIndex / 14);
  const ecmwfTimeIndex = globalTimeIndex % 14;
  const ref = catalog[refIndex];
  if (!ref)
    throw new Error(
      "No reference available: Selected calander date is outside of range of avaialble references.",
    );
  return {
    refPath: ref.refPath,
    refStartDate: ref.refStartDate,
    ecmwfTimeIndex,
  };
}
export function mapEcmwfTimeToGlobalIndex(
  refStartDate: string,
  ecmwfTimeIndex: number,
  catalog: EcmwfInventoryEntry[] = ecmwfRefCatalog,
): number {
  const refIndex = catalog.findIndex(
    (entry) => entry.refStartDate === refStartDate,
  );
  if (refIndex < 0) throw new Error("Unknown ECMWF ref start date");
  return refIndex * 14 + ecmwfTimeIndex;
}

export function createEcmwfLayerSelector(input: {
  ecmwfTimeIndex: number;
  ecmwfStepIndex: number;
}): LayerSelector {
  return {
    time: { selected: input.ecmwfTimeIndex, type: "index" },
    step: { selected: input.ecmwfStepIndex, type: "index" },
  };
}
