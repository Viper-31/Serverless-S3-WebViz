import { describe, expect, it, vi } from "vitest";
import { loadRefSpec, openReferencedZarrStore } from "../referencedStore";

const validZarrayMetadata = JSON.stringify({
  dtype: "<f4",
  compressor: { id: "ignored" },
  filters: [
    { id: "shuffle", elementsize: 4 },
    { id: "zlib", level: 7 },
  ],
});

function mockFetchResponse(response: Partial<Response>): Response {
  return response as unknown as Response;
}

function createDependencies() {
  const referenceStore = {
    fromSpec: vi.fn((spec) => ({ base: true, spec })),
  };

  const rootGroup = {
    resolve: vi.fn((path: string) => ({ resolved: path })),
  };

  let rootOpened = false;
  let byteCacheAdapter:
    | {
        has(key: string): boolean;
        get(key: string): Uint8Array | undefined;
        set(key: string, value: Uint8Array | undefined): void;
      }
    | undefined;

  const zarr = {
    root: vi.fn((store) => ({ rootStore: store })),
    open: {
      v2: vi.fn((location, options) => {
        if (!rootOpened && options.kind === "group") {
          rootOpened = true;
          return rootGroup;
        }
        return { location, options };
      }),
    },
    extendStore: vi.fn((store, ...wrappers) =>
      wrappers.reduce((next, wrapper) => wrapper(next), store),
    ),
    withRangeCoalescing: vi.fn((store, options) => ({
      store,
      coalesced: options?.coalesceSize,
    })),
    withByteCaching: vi.fn((store, options) => {
      byteCacheAdapter = options.cache;
      return { store, cached: true };
    }),
  };

  return {
    referenceStore,
    rootGroup,
    zarr,
    getByteCacheAdapter: () => byteCacheAdapter,
  };
}

describe("referenced store", () => {
  it("fetches ref specs with credentials omitted", async () => {
    const refSpec = { version: 1, refs: { ".zgroup": '{"zarr_format":2}' } };
    const fetchRef = vi.fn(async () =>
      mockFetchResponse({
        ok: true,
        json: async () => refSpec,
      }),
    );

    await expect(
      loadRefSpec("/refs/sample.json", fetchRef as unknown as typeof fetch),
    ).resolves.toEqual(refSpec);
    expect(fetchRef).toHaveBeenCalledWith("/refs/sample.json", {
      credentials: "omit",
    });
  });

  it("throws when fetching a ref spec fails", async () => {
    const fetchRef = vi.fn(async () =>
      mockFetchResponse({ ok: false, status: 404 }),
    );

    await expect(
      loadRefSpec("/refs/missing.json", fetchRef as unknown as typeof fetch),
    ).rejects.toThrow(/404/);
  });

  it("fetches, rewrites, wraps, and opens the root group by default", async () => {
    const refSpec = {
      version: 1,
      refs: {
        ".zgroup": '{"zarr_format":2}',
        ".zarray": validZarrayMetadata,
        "airTemperature/0.0": [
          "s3://webviz/DPIRD/dpird_wa_stations.nc",
          394727937,
          11823953,
        ],
      },
    };
    const fetchRef = vi.fn(async () =>
      mockFetchResponse({
        ok: true,
        json: async () => refSpec,
      }),
    );
    const { referenceStore, zarr, getByteCacheAdapter } = createDependencies();

    const dataset = await openReferencedZarrStore({
      refUrl: "/refs/DPIRD/sample.json",
      fetchRef: fetchRef as unknown as typeof fetch,
      dependencies: { zarr, ReferenceStore: referenceStore },
    });

    expect(referenceStore.fromSpec).toHaveBeenCalledWith({
      version: 1,
      refs: {
        ".zgroup": '{"zarr_format":2}',
        ".zarray": validZarrayMetadata,
        "airTemperature/0.0": [
          "https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc",
          394727937,
          11823953,
        ],
      },
    });
    expect(zarr.withRangeCoalescing).toHaveBeenCalledTimes(1);
    expect(zarr.withRangeCoalescing).toHaveBeenCalledWith(
      expect.objectContaining({ base: true }),
      { coalesceSize: 32768 },
    );
    expect(zarr.withByteCaching).toHaveBeenCalledTimes(1);
    expect(getByteCacheAdapter()).toBeDefined();
    expect(() => getByteCacheAdapter()?.set("skip", undefined)).not.toThrow();
    getByteCacheAdapter()?.set("present", new Uint8Array([1, 2, 3]));
    expect(getByteCacheAdapter()?.has("present")).toBe(true);
    expect(getByteCacheAdapter()?.get("present")).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(zarr.root).toHaveBeenCalledWith({
      store: {
        store: expect.objectContaining({ base: true }),
        coalesced: 32768,
      },
      cached: true,
    });
    expect(zarr.open.v2).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        rootStore: {
          store: {
            store: expect.objectContaining({ base: true }),
            coalesced: 32768,
          },
          cached: true,
        },
      }),
      { kind: "group" },
    );
    expect(dataset.root).toBe(dataset.node);
  });

  it("can skip metadata validation and optional wrappers while opening child arrays", async () => {
    const { referenceStore, rootGroup, zarr } = createDependencies();

    const dataset = await openReferencedZarrStore({
      refSpec: {
        version: 1,
        refs: {
          ".zgroup": '{"zarr_format":2}',
          ".zarray": JSON.stringify({
            dtype: "<f4",
            filters: [{ id: "unknown", elementsize: 4 }],
          }),
        },
      },
      arrayPath: "airTemperature",
      rangeCoalescing: false,
      byteCache: false,
      validateMetadata: false,
      dependencies: { zarr, ReferenceStore: referenceStore },
    });

    expect(referenceStore.fromSpec).toHaveBeenCalledTimes(1);
    expect(zarr.withRangeCoalescing).not.toHaveBeenCalled();
    expect(zarr.withByteCaching).not.toHaveBeenCalled();
    expect(zarr.root).toHaveBeenCalledWith(
      expect.objectContaining({ base: true }),
    );
    expect(rootGroup.resolve).toHaveBeenCalledWith("airTemperature");
    expect(zarr.open.v2).toHaveBeenNthCalledWith(
      2,
      { resolved: "airTemperature" },
      { kind: "array" },
    );
    await expect(dataset.getArray("temperature")).resolves.toEqual({
      location: { resolved: "temperature" },
      options: { kind: "array" },
    });
    await expect(dataset.openNode("stations", "group")).resolves.toEqual({
      location: { resolved: "stations" },
      options: { kind: "group" },
    });
  });
});
