import { describe, expect, it } from "vitest";
import { validateAllCodecs, validateCodecs } from "@/zarr-store/codecMetadata";

type CodecMetadataInput = Parameters<typeof validateCodecs>[0];

function validFilters(elementsize: number) {
  return [
    { id: "shuffle", elementsize },
    { id: "zlib", level: 7 },
  ];
}

describe("codec metadata", () => {
  it("accepts missing, null, or empty filters", () => {
    expect(() => validateCodecs({ dtype: "<f4" })).not.toThrow();
    expect(() => validateCodecs({ dtype: "<f4", filters: null })).not.toThrow();
    expect(() => validateCodecs({ dtype: "<f4", filters: [] })).not.toThrow();
  });

  it("accepts shuffle then zlib with null compressor", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        compressor: null,
        filters: validFilters(4),
      }),
    ).not.toThrow();
  });

  it("accepts shuffle then zlib with blosc compressor", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        compressor: { id: "blosc" },
        filters: validFilters(4),
      }),
    ).not.toThrow();
  });

  it("rejects non-array filters metadata", () => {
    const invalidMetadata = {
      dtype: "<f4",
      filters: "shuffle,zlib" as unknown,
    } as CodecMetadataInput;

    expect(() => validateCodecs(invalidMetadata)).toThrow(/array or null/i);
  });

  it("rejects shuffle filter missing elementsize", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [{ id: "shuffle" }],
      }),
    ).toThrow(/elementsize/i);
  });

  it("rejects shuffle filter with mismatched dtype", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f8",
        filters: validFilters(4),
      }),
    ).toThrow(/dtype/i);
  });

  it("rejects duplicate shuffle filters", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [
          { id: "shuffle", elementsize: 4 },
          { id: "shuffle", elementsize: 4 },
          { id: "zlib", level: 7 },
        ],
      }),
    ).toThrow(/duplicate shuffle/i);
  });

  it("rejects zlib before shuffle filter ordering", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [{ id: "zlib" }, { id: "shuffle", elementsize: 4 }],
      }),
    ).toThrow(/order/i);
  });

  it("rejects duplicate zlib filters", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [
          { id: "shuffle", elementsize: 4 },
          { id: "zlib", level: 7 },
          { id: "zlib", level: 9 },
        ],
      }),
    ).toThrow(/duplicate zlib/i);
  });

  it("rejects unknown filter ids", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [{ id: "unknown", elementsize: 4 }],
      }),
    ).toThrow(/unknown filter/i);
  });

  it("rejects incomplete filter pipelines missing zlib", () => {
    expect(() =>
      validateCodecs({
        dtype: "<f4",
        filters: [{ id: "shuffle", elementsize: 4 }],
      }),
    ).toThrow(/include shuffle then zlib/i);
  });

  it("validates only string .zarray entries within a ref spec", () => {
    expect(() =>
      validateAllCodecs({
        version: 1,
        refs: {
          ".zgroup": '{"zarr_format":2}',
          ".zarray": JSON.stringify({
            dtype: "<f4",
            compressor: { id: "blosc" },
            filters: validFilters(4),
          }),
          "nested/.zarray": JSON.stringify({
            dtype: "<f8",
            filters: validFilters(8),
          }),
          "ignored/.zarray": { dtype: "<f4", filters: [{ id: "unknown" }] },
          "ignored.txt": JSON.stringify({
            dtype: "<f4",
            filters: [{ id: "unknown" }],
          }),
        },
      }),
    ).not.toThrow();
  });

  it("throws when a string .zarray entry contains invalid codec metadata", () => {
    expect(() =>
      validateAllCodecs({
        version: 1,
        refs: {
          ".zgroup": '{"zarr_format":2}',
          "airTemperature/.zarray": JSON.stringify({
            dtype: "<f4",
            filters: [{ id: "unknown", elementsize: 4 }],
          }),
        },
      }),
    ).toThrow(/unknown filter/i);
  });
});
