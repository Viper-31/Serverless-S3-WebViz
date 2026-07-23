import { describe, it, expect, vi } from "vitest";
import { createAppController, buildPrefetchPlan } from "./appController";
import type { RasterRenderer } from "@/rendering-layer/Renderer";
import { type EcmwfInventoryEntry } from "@/datasets/inventory_parser";
import { createEcmwfState } from "@/features/variable-selection/selection";

function makeRenderer(): RasterRenderer & { calls: unknown[] } {
  const calls: unknown[] = [];
  let layer = false;
  return {
    calls,
    replace: vi.fn(async (request) => {
      layer = true;
      calls.push(["replace", request]);
    }),
    updateSelector: vi.fn(async (selector) => {
      calls.push(["updateSelector", selector]);
    }),
    updateVariableDisplay: vi.fn(async (input) => {
      calls.push(["updateVariableDisplay", input]);
    }),
    readValidTime: vi.fn(async () => 1717286400),
    prefetchNextRef: vi.fn(async (request) => {
      calls.push(["prefetchNextRef", request]);
    }),
    prefetchNextTimeChunk: vi.fn(async (request) => {
      calls.push(["prefetchNextTimeChunk", request]);
    }),
    remove: vi.fn(() => {
      layer = false;
      calls.push(["remove"]);
    }),
    hasLayer: vi.fn(() => layer),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function twoRefCatalog(): EcmwfInventoryEntry[] {
  return [
    {
      datasetKind: "ecmwf" as const,
      sourceObject: "ECMWF/2024/01/02.nc",
      refPath: "/refs/ECMWF/2024/01/02.nc.json",
      refStartDate: "2024-01-02",
      refEndDate: "2024-01-08",
    },
    {
      datasetKind: "ecmwf" as const,
      sourceObject: "ECMWF/2024/01/09.nc",
      refPath: "/refs/ECMWF/2024/01/09.nc.json",
      refStartDate: "2024-01-09",
      refEndDate: "2024-01-15",
    },
  ];
}

function markChunksIdle(controller: ReturnType<typeof createAppController>) {
  controller.setLoadingState({
    loading: false,
    metadata: false,
    chunks: false,
    error: null,
  });
}

function clearPrefetchMocks(renderer: ReturnType<typeof makeRenderer>) {
  (renderer.prefetchNextTimeChunk as ReturnType<typeof vi.fn>).mockClear();
  (renderer.prefetchNextRef as ReturnType<typeof vi.fn>).mockClear();
}

async function attachWithTwoRefs(
  renderer: ReturnType<typeof makeRenderer>,
  deps: { prefetchWindow?: number } = {},
) {
  const controller = createAppController({
    ...deps,
    loadInventoryCatalog: async () => ({
      ecmwf: twoRefCatalog(),
      dpird: [],
    }),
  });
  await controller.init();
  await controller.attachRenderer(renderer);
  return controller;
}

async function commitGlobalTime(
  controller: ReturnType<typeof createAppController>,
  globalIndex: number,
) {
  controller.setTimeSliderActive(true);
  await controller.setGlobalTimeIndex(globalIndex);
  controller.setTimeSliderActive(false);
  await controller.commitGlobalTimeIndex();
}

describe("createAppController", () => {
  // -------------------------------------------------------------------------
  describe("time navigation", () => {
    it("same-ref time commit updates selector and refreshes valid time", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);
      (renderer.replace as ReturnType<typeof vi.fn>).mockClear();
      (renderer.updateSelector as ReturnType<typeof vi.fn>).mockClear();
      (renderer.readValidTime as ReturnType<typeof vi.fn>).mockClear();

      await commitGlobalTime(controller, 3);

      expect(renderer.updateSelector).toHaveBeenCalled();
      expect(renderer.replace).not.toHaveBeenCalled();
      expect(renderer.readValidTime).toHaveBeenCalled();
    });

    it("date change replaces layer", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);

      await controller.setDate("2024-01-16");
      expect(renderer.replace).toHaveBeenCalled();
    });

    it("setDate seeds loading label and captures selection errors", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);

      await controller.setDate("2099-01-01");
      expect(controller.getState().validTimeLabel).toBe("Loading valid time…");
      expect(controller.getState().error).toMatch(/No reference available/i);
    });

    it("slider staging clears errors and captures selection failures", async () => {
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.setDate("2099-01-01");
      expect(controller.getState().error).toMatch(/No reference available/i);

      controller.setStepIndex(1);
      expect(controller.getState().error).toBeNull();
      expect(controller.getState().validTimeLabel).toBe(
        "Release slider to update valid time…",
      );

      await controller.setGlobalTimeIndex(-2);
      expect(controller.getState().error).toMatch(/non-negative/i);
    });

    it("slider input defers valid-time refresh until commit", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);
      (renderer.readValidTime as ReturnType<typeof vi.fn>).mockClear();

      controller.setTimeSliderActive(true);
      await controller.setGlobalTimeIndex(3);
      expect(renderer.readValidTime).not.toHaveBeenCalled();

      controller.setTimeSliderActive(false);
      await controller.commitGlobalTimeIndex();
      expect(renderer.readValidTime).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("variable selection", () => {
    it("updates variable display when layer exists", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);

      await controller.setVariable("msl");
      expect(renderer.updateVariableDisplay).toHaveBeenCalledWith(
        expect.objectContaining({ variableId: "msl" }),
      );
    });

    it("keeps display overrides attached to each variable", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);

      controller.setDisplayOverride({ clim: [5, 45], colormap: "thermal" });
      await controller.setVariable("i10fg");
      expect(controller.getDisplaySettings()).toEqual({
        clim: [0, 150],
        colormap: "Reds",
      });

      controller.setDisplayOverride({ clim: [20, 120], colormap: "Reds" });
      await controller.setVariable("t2m");
      expect(controller.getDisplaySettings()).toEqual({
        clim: [5, 45],
        colormap: "thermal",
      });
    });

    it("toggles reloading state and captures renderer failures", async () => {
      const renderer = makeRenderer();
      (
        renderer.updateVariableDisplay as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("boom"));
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);

      await controller.setVariable("msl");
      expect(controller.getState().reloadingLayer).toBe(false);
      expect(controller.getState().error).toBe("boom");
    });
  });

  // -------------------------------------------------------------------------
  describe("lifecycle", () => {
    it("reload forces layer replacement", async () => {
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);
      (renderer.replace as ReturnType<typeof vi.fn>).mockClear();

      await controller.reload();
      expect(renderer.replace).toHaveBeenCalled();
    });

    it("teardown clears loading flags and invalidates in-flight work", async () => {
      const replace = deferred<void>();
      const renderer = makeRenderer();
      const controller = createAppController({
        loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
      });
      await controller.init();
      await controller.attachRenderer(renderer);
      (renderer.replace as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          await replace.promise;
        },
      );

      const reloadPromise = controller.reload();
      expect(controller.getState().reloadingLayer).toBe(true);
      controller.teardown();
      expect(controller.getState().mapReady).toBe(false);
      expect(controller.getState().layerAdded).toBe(false);
      expect(controller.getState().reloadingLayer).toBe(false);

      replace.resolve();
      await reloadPromise;
      expect(controller.getState().reloadingLayer).toBe(false);
      expect(controller.getState().layerAdded).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("prefetch", () => {
    describe("buildPrefetchPlan", () => {
      it("routes window past ref end into nextRef with step 0", () => {
        const ecmwf = {
          ...createEcmwfState("t2m", "2024-01-02", twoRefCatalog()),
          ecmwfTimeIndex: 13,
          ecmwfStepIndex: 7,
        };
        const plan = buildPrefetchPlan(ecmwf, twoRefCatalog(), 2);

        expect(plan.sameRef).toHaveLength(0);
        expect(plan.nextRef).toHaveLength(2);
        expect(plan.nextRef[0]?.selector.step?.selected).toBe(0);
        expect(plan.nextRef[0]?.selector.time?.selected).toBe(0);
        expect(plan.nextRef[1]?.selector.time?.selected).toBe(1);
      });
    });

    describe("dispatch", () => {
      it("window=2: commit at in-ref index dispatches time-chunk for i+1 and i+2", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 3);

        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(2);
        expect(renderer.prefetchNextTimeChunk).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/02.nc.json",
            selector: expect.objectContaining({
              time: { selected: 4, type: "index" },
            }),
          }),
        );
        expect(renderer.prefetchNextTimeChunk).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/02.nc.json",
            selector: expect.objectContaining({
              time: { selected: 5, type: "index" },
            }),
          }),
        );
        expect(renderer.prefetchNextRef).not.toHaveBeenCalled();
      });

      it("boundary at index 12: one same-ref (13) + one next-ref (0, step 0)", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 12);

        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(1);
        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledWith(
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/02.nc.json",
            selector: expect.objectContaining({
              time: { selected: 13, type: "index" },
            }),
          }),
        );
        expect(renderer.prefetchNextRef).toHaveBeenCalledTimes(1);
        expect(renderer.prefetchNextRef).toHaveBeenCalledWith(
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/09.nc.json",
            selector: {
              time: { selected: 0, type: "index" },
              step: { selected: 0, type: "index" },
            },
          }),
        );
      });

      it("boundary at index 13: two next-ref dispatches (0 and 1), step 0", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 13);

        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
        expect(renderer.prefetchNextRef).toHaveBeenCalledTimes(2);
        expect(renderer.prefetchNextRef).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/09.nc.json",
            selector: {
              time: { selected: 0, type: "index" },
              step: { selected: 0, type: "index" },
            },
          }),
        );
        expect(renderer.prefetchNextRef).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/09.nc.json",
            selector: {
              time: { selected: 1, type: "index" },
              step: { selected: 0, type: "index" },
            },
          }),
        );
      });

      it("catalog-end clamp: final ref index 13 → no dispatches", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        // last index of second ref: 14 + 13 = 27
        await commitGlobalTime(controller, 27);

        expect(renderer.prefetchNextRef).not.toHaveBeenCalled();
        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
      });

      it("prefetchWindow=0 disables all prefetch", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer, {
          prefetchWindow: 0,
        });
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 3);

        expect(renderer.prefetchNextRef).not.toHaveBeenCalled();
        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
      });

      it("prefetchWindow=1 dispatches only i+1", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer, {
          prefetchWindow: 1,
        });
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 3);

        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(1);
        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledWith(
          expect.objectContaining({
            selector: expect.objectContaining({
              time: { selected: 4, type: "index" },
            }),
          }),
        );
      });

      it("prefetchWindow=3: next-ref dispatch begins at index 11", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer, {
          prefetchWindow: 3,
        });
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 11);

        // 12, 13 same-ref; 0 next-ref
        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(2);
        expect(renderer.prefetchNextRef).toHaveBeenCalledTimes(1);
        expect(renderer.prefetchNextRef).toHaveBeenCalledWith(
          expect.objectContaining({
            refPath: "/refs/ECMWF/2024/01/09.nc.json",
            selector: expect.objectContaining({
              time: { selected: 0, type: "index" },
            }),
          }),
        );
      });

      it("setVariable re-triggers prefetch for the new variable", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);

        await commitGlobalTime(controller, 3);
        clearPrefetchMocks(renderer);

        await controller.setVariable("msl");

        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledWith(
          expect.objectContaining({ variableId: "msl" }),
        );
      });

      it("cache-hit fast path: chunks already false → immediate dispatch", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);
        markChunksIdle(controller);
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 5);

        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(2);
      });
    });

    describe("loading gate", () => {
      it("defers while chunks true, flushes once on chunks false", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);

        controller.setLoadingState({
          loading: true,
          metadata: false,
          chunks: true,
          error: null,
        });
        clearPrefetchMocks(renderer);

        await commitGlobalTime(controller, 3);
        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();

        controller.setLoadingState({
          loading: false,
          metadata: false,
          chunks: false,
          error: null,
        });
        expect(renderer.prefetchNextTimeChunk).toHaveBeenCalledTimes(2);
      });

      it("error drops pending without dispatch", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);

        controller.setLoadingState({
          loading: true,
          metadata: false,
          chunks: true,
          error: null,
        });
        await commitGlobalTime(controller, 3);
        clearPrefetchMocks(renderer);

        controller.setLoadingState({
          loading: false,
          metadata: false,
          chunks: false,
          error: new Error("layer failed"),
        });

        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
      });

      it("mid-drag flush is skipped", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);

        controller.setLoadingState({
          loading: true,
          metadata: false,
          chunks: true,
          error: null,
        });
        await commitGlobalTime(controller, 3);
        clearPrefetchMocks(renderer);

        // User starts dragging again before chunks finish
        controller.setTimeSliderActive(true);
        controller.setLoadingState({
          loading: false,
          metadata: false,
          chunks: false,
          error: null,
        });

        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
      });

      it("teardown invalidates pending flush", async () => {
        const renderer = makeRenderer();
        const controller = await attachWithTwoRefs(renderer);

        controller.setLoadingState({
          loading: true,
          metadata: false,
          chunks: true,
          error: null,
        });
        await commitGlobalTime(controller, 3);
        clearPrefetchMocks(renderer);

        controller.teardown();
        controller.setLoadingState({
          loading: false,
          metadata: false,
          chunks: false,
          error: null,
        });

        expect(renderer.prefetchNextTimeChunk).not.toHaveBeenCalled();
      });
    });
  });
});
