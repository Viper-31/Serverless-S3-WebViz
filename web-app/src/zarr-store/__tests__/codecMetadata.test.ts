import { describe, expect, it } from "vitest";
import {
  validateRefSpecZarrayMetadata,
  validateZarrayCodecMetadata,
} from "../codecMetadata";

function validFilters(elementsize: number) {
  return [
    { id: "shuffle", elementsize },
    { id: "zlib", level: 7 },
  ];
}

describe("codec metadata", () => {
  it("accepts missing, null, or empty filters", () => {
    expect(validateZarrayCodecMetadata({ dtype: "<f4" })).toBe(true);
    expect(validateZarrayCodecMetadata({ dtype: "<f4", filters: null })).toBe(
      true,
    );
    expect(validateZarrayCodecMetadata({ dtype: "<f4", filters: [] })).toBe(
      true,
    );
  });

  it("accepts shuffle then zlib regardless of compressor metadata", () => {
    expect(
      validateZarrayCodecMetadata({
        dtype: "<f4",
        compressor: null,
        filters: validFilters(4),
      }),
    ).toBe(true);

    expect(
      validateZarrayCodecMetadata({
        dtype: "<f4",
        compressor: { id: "blosc" },
        filters: validFilters(4),
      }),
    ).toBe(true);
  });

  it("rejects non-array filters metadata", () => {
    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: "shuffle,zlib" as unknown as Array<unknown>,
      }),
    ).toThrow(/array or null/i);
  });

  it("rejects invalid shuffle metadata", () => {
    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [{ id: "shuffle" }],
      }),
    ).toThrow(/elementsize/i);

    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f8",
        filters: validFilters(4),
      }),
    ).toThrow(/dtype/i);

    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [
          { id: "shuffle", elementsize: 4 },
          { id: "shuffle", elementsize: 4 },
          { id: "zlib", level: 7 },
        ],
      }),
    ).toThrow(/duplicate shuffle/i);
  });

  it("rejects invalid zlib ordering and duplicate zlib filters", () => {
    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [{ id: "zlib" }, { id: "shuffle", elementsize: 4 }],
      }),
    ).toThrow(/order/i);

    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [
          { id: "shuffle", elementsize: 4 },
          { id: "zlib", level: 7 },
          { id: "zlib", level: 9 },
        ],
      }),
    ).toThrow(/duplicate zlib/i);
  });

  it("rejects unknown filters and incomplete filter pipelines", () => {
    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [{ id: "unknown", elementsize: 4 }],
      }),
    ).toThrow(/unknown filter/i);

    expect(() =>
      validateZarrayCodecMetadata({
        dtype: "<f4",
        filters: [{ id: "shuffle", elementsize: 4 }],
      }),
    ).toThrow(/include shuffle then zlib/i);
  });

  it("validates only string .zarray entries within a ref spec", () => {
    expect(
      validateRefSpecZarrayMetadata({
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
    ).toBe(true);
  });

  it("throws when a string .zarray entry contains invalid codec metadata", () => {
    expect(() =>
      validateRefSpecZarrayMetadata({
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
