import { describe, expect, it, vi } from "vitest";
import { loadRefSpec, openZarrStore } from "@/zarr-store/zarritaStore";

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

  const defaultRefSpec = {
    version: 1,
    refs: {
      ".zgroup": '{"zarr_format":2}',
      ".zarray": validZarrayMetadata,
      "airTemperature/0.0": [
        "s3://webviz/DPIRD/DPIRD_final_stations.nc",
        487187698,
        2927801,
      ],
    },
  };

  function createFetchMock(spec: object) {
    return vi.fn(async () =>
      mockFetchResponse({ ok: true, json: async () => spec }),
    );
  }

  it("rewrites s3://webviz chunk refs to public HTTP before fromSpec", async () => {
    const fetchRef = createFetchMock(defaultRefSpec);
    const { referenceStore, zarr } = createDependencies();

    await openZarrStore({
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
          "https://projects.pawsey.org.au/webviz/DPIRD/DPIRD_final_stations.nc",
          487187698,
          2927801,
        ],
      },
    });
  });

  it("applies range coalescing by default", async () => {
    const fetchRef = createFetchMock(defaultRefSpec);
    const { referenceStore, zarr } = createDependencies();

    await openZarrStore({
      refUrl: "/refs/sample.json",
      fetchRef: fetchRef as unknown as typeof fetch,
      dependencies: { zarr, ReferenceStore: referenceStore },
    });

    expect(zarr.withRangeCoalescing).toHaveBeenCalledWith(
      expect.objectContaining({ base: true }),
      { coalesceSize: 32768 },
    );
  });

  it("applies byte caching by default", async () => {
    const fetchRef = createFetchMock(defaultRefSpec);
    const { referenceStore, zarr } = createDependencies();

    await openZarrStore({
      refUrl: "/refs/sample.json",
      fetchRef: fetchRef as unknown as typeof fetch,
      dependencies: { zarr, ReferenceStore: referenceStore },
    });

    expect(zarr.withByteCaching).toHaveBeenCalledTimes(1);
  });

  it("returns dataset where root equals node when opening root group", async () => {
    const fetchRef = createFetchMock(defaultRefSpec);
    const { referenceStore, zarr } = createDependencies();

    const dataset = await openZarrStore({
      refUrl: "/refs/sample.json",
      fetchRef: fetchRef as unknown as typeof fetch,
      dependencies: { zarr, ReferenceStore: referenceStore },
    });

    expect(dataset.root).toBe(dataset.node);
  });
});
