import { describe, expect, it } from "vitest";
import {
  createByteCache,
  createZarritaByteCache,
} from "@/zarr-store/byteCache";

describe("byte cache", () => {
  it("rejects writes that exceed the memory budget", () => {
    const maxBytes = 24 * 1024 * 1024;
    const cache = createByteCache({ maxBytes, maxEntries: 256 });

    cache.set("a", new Uint8Array(10));
    cache.set("b", new Uint8Array(10));
    cache.get("a");

    expect(cache.set("c", new Uint8Array(maxBytes + 1))).toBe(false);
    expect(cache.has("c")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(true);
  });

  it("evicts the least recently used entry when maxEntries is exceeded", () => {
    const cache = createByteCache({ maxBytes: 24, maxEntries: 2 });
    cache.set("a", new Uint8Array(8));
    cache.set("b", new Uint8Array(8));
    cache.get("a");
    cache.set("c", new Uint8Array(8));

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("evicts the least recently used entry when maxBytes is exceeded", () => {
    const cache = createByteCache({ maxBytes: 16, maxEntries: 256 });
    cache.set("a", new Uint8Array(8));
    cache.set("b", new Uint8Array(8));
    cache.get("a");
    cache.set("c", new Uint8Array(8));

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("updates byte accounting when an existing key is overwritten", () => {
    const cache = createByteCache({ maxBytes: 16, maxEntries: 256 });
    cache.set("a", new Uint8Array(12));
    cache.set("a", new Uint8Array(4));
    cache.set("b", new Uint8Array(12));

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(true);
  });

  it("adapts to zarrita cache semantics and ignores undefined deletes", () => {
    const cache = createZarritaByteCache({ maxBytes: 16, maxEntries: 2 });

    expect(() => cache.set("missing", undefined)).not.toThrow();

    cache.set("a", new Uint8Array([1, 2, 3]));

    expect(cache.has("a")).toBe(true);
    expect(cache.get("a")).toEqual(new Uint8Array([1, 2, 3]));
  });
});
