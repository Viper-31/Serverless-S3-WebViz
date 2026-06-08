import { describe, it, expect, vi } from "vitest";
import { createAppController } from "./appController";
import type { RasterRenderer } from "@/rendering-layer/Renderer";

function makeRenderer(): RasterRenderer & { calls: any[] } {
  const calls: any[] = [];
  let layer = false;
  return {
    calls,
    replace: vi.fn(async (request) => {
      layer = true;
      void calls.push(["replace", request]);
    }),
    updateSelector: vi.fn(
      async (selector) => void calls.push(["updateSelector", selector]),
    ),
    updateVariableDisplay: vi.fn(
      async (input) => void calls.push(["updateVariableDisplay", input]),
    ),
    readValidTime: vi.fn(async () => 1717286400),
    remove: vi.fn(() => {
      layer = false;
      void calls.push(["remove"]);
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

describe("createAppController", () => {
  it("same-ref time/step commit updates selector and refreshes valid time", async () => {
    const renderer = makeRenderer();
    const controller = createAppController({
      loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
    });
    await controller.init();
    await controller.attachRenderer(renderer);
    (renderer.replace as any).mockClear();
    (renderer.updateSelector as any).mockClear();
    (renderer.readValidTime as any).mockClear();
    controller.setTimeSliderActive(true);
    await controller.setGlobalTimeIndex(3);
    controller.setTimeSliderActive(false);
    await controller.commitGlobalTimeIndex();
    expect(renderer.updateSelector).toHaveBeenCalled();
    expect(renderer.replace).not.toHaveBeenCalled();
    expect(renderer.readValidTime).toHaveBeenCalled();
  });

  it("date change replaces layer and reload forces replacement", async () => {
    const renderer = makeRenderer();
    const controller = createAppController({
      loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
    });
    await controller.init();
    await controller.attachRenderer(renderer);
    await controller.setDate("2024-01-16");
    expect(renderer.replace).toHaveBeenCalled();
    (renderer.replace as any).mockClear();
    await controller.reload();
    expect(renderer.replace).toHaveBeenCalled();
  });

  it("variable change updates variable display when layer exists", async () => {
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

  it("variable changes toggle reloading state and capture renderer failures", async () => {
    const renderer = makeRenderer();
    (renderer.updateVariableDisplay as any).mockRejectedValueOnce(
      new Error("boom"),
    );
    const controller = createAppController({
      loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
    });
    await controller.init();
    await controller.attachRenderer(renderer);
    await controller.setVariable("msl");
    expect(controller.getState().reloadingLayer).toBe(false);
    expect(controller.getState().error).toBe("boom");
  });

  it("teardown clears loading flags and invalidates in-flight work", async () => {
    const replace = deferred<void>();
    const renderer = makeRenderer();
    const controller = createAppController({
      loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
    });
    await controller.init();
    await controller.attachRenderer(renderer);
    (renderer.replace as any).mockImplementation(async () => {
      await replace.promise;
    });
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

  it("slider input defers valid-time refresh until commit", async () => {
    const renderer = makeRenderer();
    const controller = createAppController({
      loadInventoryCatalog: async () => ({ ecmwf: [], dpird: [] }),
    });
    await controller.init();
    await controller.attachRenderer(renderer);
    (renderer.readValidTime as any).mockClear();
    controller.setTimeSliderActive(true);
    await controller.setGlobalTimeIndex(3);
    expect(renderer.readValidTime).not.toHaveBeenCalled();
    controller.setTimeSliderActive(false);
    await controller.commitGlobalTimeIndex();
    expect(renderer.readValidTime).toHaveBeenCalled();
  });
});
