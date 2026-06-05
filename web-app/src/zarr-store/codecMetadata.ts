import type { RefSpec } from "@/zarr-store/types";

type CodecFilter = {
  id?: string;
  elementsize?: number;
  level?: number;
  [key: string]: unknown;
};

const ZARR_DTYPE_BYTE_WIDTH: Record<string, number> = {
  "<f4": 4,
  "<f8": 8,
  "<i1": 1,
  "<i2": 2,
  "<i4": 4,
  "<i8": 8,
  "<u1": 1,
  "<u2": 2,
  "<u4": 4,
  "<u8": 8,
};

export function validateZarrayCodecMetadata(metadata: {
  dtype?: string;
  compressor?: unknown;
  filters?: CodecFilter[] | null;
}): true {
  const filters = metadata.filters ?? [];
  if (!Array.isArray(filters))
    throw new Error("filters must be an array or null");

  if (filters.length === 0) return true;

  let seenZlib = false;
  let seenShuffle = false;

  const validateShuffle = (
    filter: CodecFilter,
    meta: { dtype?: string },
    hasZlib: boolean,
    hasShuffle: boolean,
  ): true => {
    if (hasZlib) throw new Error("filter order invalid");
    if (hasShuffle) throw new Error("duplicate shuffle filter");
    if (filter.elementsize == null)
      throw new Error("shuffle elementsize required");

    const expected = meta.dtype ? ZARR_DTYPE_BYTE_WIDTH[meta.dtype] : undefined;
    if (expected == null || expected !== filter.elementsize)
      throw new Error("dtype mismatch");

    return true;
  };

  const validateZlib = (hasShuffle: boolean, hasZlib: boolean): true => {
    if (!hasShuffle) throw new Error("filter order invalid");
    if (hasZlib) throw new Error("duplicate zlib filter");
    return true;
  };

  for (const filter of filters) {
    switch (filter.id) {
      case "shuffle":
        seenShuffle = validateShuffle(filter, metadata, seenZlib, seenShuffle);
        break;
      case "zlib":
        seenZlib = validateZlib(seenShuffle, seenZlib);
        break;
      default:
        throw new Error("unknown filter");
    }
  }

  if (!seenShuffle || !seenZlib)
    throw new Error("filters must include shuffle then zlib");
  return true;
}

export function validateRefSpecZarrayMetadata(spec: RefSpec): true {
  for (const [key, value] of Object.entries(spec.refs ?? {})) {
    if (!key.endsWith("/.zarray") && key !== ".zarray") continue;
    if (typeof value !== "string") continue;

    validateZarrayCodecMetadata(JSON.parse(value));
  }

  return true;
}
