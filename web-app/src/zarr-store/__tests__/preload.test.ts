import { describe, expect, it, vi } from "vitest";

vi.mock("zarrita", () => ({
  root: vi.fn(),
  open: { v2: vi.fn() },
}));

import * as zarr from "zarrita";
import { preloadEcmwfChunks } from "@/zarr-store/preload";

describe("preloadEcmwfChunks", () => {
  it("fetches all spatial chunks for the computed time/step chunk coordinates", async () => {
    const getChunk = vi.fn().mockResolvedValue(new Uint8Array(4));
    const mockArray = {
      chunks: [8, 4, 16, 32],
      shape: [100, 20, 64, 96],
      getChunk,
    };
    const mockRoot = {
      resolve: vi.fn().mockReturnValue({ __resolved: true }),
    };

    vi.mocked(zarr.root).mockReturnValue(mockRoot as any);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as any);

    await preloadEcmwfChunks({} as any, "airTemperature", 5, 2);

    // Opens the correct variable
    expect(mockRoot.resolve).toHaveBeenCalledWith("airTemperature");
    expect(zarr.open.v2).toHaveBeenCalledWith(
      { __resolved: true },
      { kind: "array" },
    );

    // timeC = floor(5/8) = 0, stepC = floor(2/4) = 0
    // latChunkCount = ceil(64/16) = 4, lonChunkCount = ceil(96/32) = 3
    // 4 × 3 = 12 chunk fetches
    expect(getChunk).toHaveBeenCalledTimes(12);

    for (let latC = 0; latC < 4; latC++) {
      for (let lonC = 0; lonC < 3; lonC++) {
        expect(getChunk).toHaveBeenCalledWith([0, 0, latC, lonC], {
          signal: undefined,
        });
      }
    }
  });

  it("computes correct chunk indices when time/step span across boundaries", async () => {
    const getChunk = vi.fn().mockResolvedValue(new Uint8Array(4));
    const mockArray = {
      chunks: [4, 3, 10, 10],
      shape: [16, 9, 20, 20],
      getChunk,
    };
    const mockRoot = {
      resolve: vi.fn().mockReturnValue({ __resolved: true }),
    };

    vi.mocked(zarr.root).mockReturnValue(mockRoot as any);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as any);

    // timeIndex=6 → timeC = floor(6/4) = 1
    // stepIndex=5 → stepC = floor(5/3) = 1
    await preloadEcmwfChunks({} as any, "var", 6, 5);

    // latChunkCount = ceil(20/10) = 2, lonChunkCount = ceil(20/10) = 2
    // 2 × 2 = 4 chunks, all at chunk coordinate [1, 1, *, *]
    expect(getChunk).toHaveBeenCalledTimes(4);

    const expectedCoords: [number, number, number, number][] = [];
    for (let latC = 0; latC < 2; latC++) {
      for (let lonC = 0; lonC < 2; lonC++) {
        expectedCoords.push([1, 1, latC, lonC]);
      }
    }
    for (const coords of expectedCoords) {
      expect(getChunk).toHaveBeenCalledWith(coords, { signal: undefined });
    }
  });

  it("passes the abort signal through to getChunk", async () => {
    const getChunk = vi.fn().mockResolvedValue(new Uint8Array(4));
    const mockArray = {
      chunks: [1, 1, 10, 10],
      shape: [1, 1, 10, 10],
      getChunk,
    };
    const mockRoot = {
      resolve: vi.fn().mockReturnValue({ __resolved: true }),
    };

    vi.mocked(zarr.root).mockReturnValue(mockRoot as any);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as any);

    const controller = new AbortController();
    await preloadEcmwfChunks({} as any, "var", 0, 0, controller.signal);

    // Single chunk: timeC=0, stepC=0, latC=0, lonC=0
    expect(getChunk).toHaveBeenCalledWith([0, 0, 0, 0], {
      signal: controller.signal,
    });
  });

  it("dedupes concurrent warms for the same chunk coordinates", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const getChunk = vi.fn().mockImplementation(async () => {
      await gate;
      return new Uint8Array(4);
    });
    const mockArray = {
      chunks: [2, 113, 111, 151],
      shape: [14, 113, 111, 151],
      getChunk,
    };
    const mockRoot = { resolve: vi.fn().mockReturnValue({}) };
    vi.mocked(zarr.root).mockReturnValue(mockRoot as never);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as never);

    const store = {} as never;
    // time 0 and 1 → same timeC=0 with chunk size 2
    const p1 = preloadEcmwfChunks(store, "t2m", 0, 0);
    const p2 = preloadEcmwfChunks(store, "t2m", 1, 0);

    // Allow both to register and open array before release
    await Promise.resolve();
    await Promise.resolve();

    // Still one spatial getChunk set in flight (1 lat × 1 lon)
    expect(getChunk).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([p1, p2]);
    expect(getChunk).toHaveBeenCalledTimes(1);
  });

  it("fetches independently for different time-chunk coordinates", async () => {
    const getChunk = vi.fn().mockResolvedValue(new Uint8Array(4));
    const mockArray = {
      chunks: [2, 113, 111, 151],
      shape: [14, 113, 111, 151],
      getChunk,
    };
    const mockRoot = { resolve: vi.fn().mockReturnValue({}) };
    vi.mocked(zarr.root).mockReturnValue(mockRoot as never);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as never);

    const store = {} as never;
    await Promise.all([
      preloadEcmwfChunks(store, "t2m", 0, 0), // timeC 0
      preloadEcmwfChunks(store, "t2m", 2, 0), // timeC 1
    ]);

    expect(getChunk).toHaveBeenCalledTimes(2);
    expect(getChunk).toHaveBeenCalledWith([0, 0, 0, 0], expect.any(Object));
    expect(getChunk).toHaveBeenCalledWith([1, 0, 0, 0], expect.any(Object));
  });

  it("clears in-flight entry after settle so a later warm can run again", async () => {
    const getChunk = vi.fn().mockResolvedValue(new Uint8Array(4));
    const mockArray = {
      chunks: [2, 1, 10, 10],
      shape: [4, 1, 10, 10],
      getChunk,
    };
    const mockRoot = { resolve: vi.fn().mockReturnValue({}) };
    vi.mocked(zarr.root).mockReturnValue(mockRoot as never);
    vi.mocked(zarr.open.v2).mockResolvedValue(mockArray as never);

    const store = {} as never;
    await preloadEcmwfChunks(store, "t2m", 0, 0);
    await preloadEcmwfChunks(store, "t2m", 0, 0);

    // Second call is a new op (byte-cache would hit in prod; here getChunk runs again)
    expect(getChunk).toHaveBeenCalledTimes(2);
  });
});
