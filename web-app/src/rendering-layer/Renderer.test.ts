import { describe, expect, it, vi } from "vitest";

import {
  createRasterRenderer,
  createRendererForContainer,
} from "@/rendering-layer/Renderer";

const setSelector = vi.fn();
const setVariable = vi.fn();
const setClim = vi.fn();
const setColormap = vi.fn();

const mapRemove = vi.fn();
const mapOn = vi.fn();
const mapSetProjection = vi.fn();
const mapAddControl = vi.fn();

vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn(() => ({
      on: mapOn,
      setProjection: mapSetProjection,
      remove: mapRemove,
      addControl: mapAddControl,
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getLayer: vi.fn(),
    })),
    AttributionControl: vi.fn(),
  },
}));

vi.mock("@/rendering-layer/raster/ZarrGridLayer", () => ({
  ECMWF_LAYER_ID: "ecmwf-raster",
  createEcmwfLayer: vi.fn(async () => ({
    layer: {
      id: "ecmwf-raster",
      setSelector,
      setVariable,
      setClim,
      setColormap,
    },
    store: {},
    refPath: "/ref",
  })),
  readEcmwfValidTimeValue: vi.fn(async () => "valid-time"),
  updateEcmwfLayerSelector: vi.fn(async (layer, selector) => {
    await layer.setSelector?.(selector);
  }),
  updateEcmwfLayerDisplay: vi.fn(async (layer, input) => {
    await layer.setVariable?.(input.variableId);
    await layer.setClim?.(input.display.clim);
    await layer.setColormap?.(input.display.rgbStops);
  }),
}));

function createFakeMap() {
  const layers = new Map<string, { id: string }>();
  const calls: string[] = [];
  return {
    addLayer(layer: { id: string }) {
      calls.push(`add:${layer.id}`);
      layers.set(layer.id, layer);
    },
    removeLayer(id: string) {
      calls.push(`remove:${id}`);
      layers.delete(id);
    },
    getLayer(id: string) {
      return layers.get(id);
    },
    calls,
  };
}

describe("RasterRenderer", () => {
  it("tracks layer presence and forwards lifecycle calls", async () => {
    const map = createFakeMap();
    const renderer = createRasterRenderer({
      map,
      localRangeCoalescing: () => true,
    });

    await renderer.replace({
      kind: "raster",
      datasetKind: "ecmwf",
      refPath: "/ref",
      variableId: "t2m",
      selector: {
        time: { selected: 1, type: "index" },
        step: { selected: 2, type: "index" },
      },
      display: { clim: [0, 1], rgbStops: [[0, 0, 0]] },
    });

    expect(renderer.hasLayer()).toBe(true);

    await renderer.updateSelector({
      time: { selected: 3, type: "index" },
      step: { selected: 4, type: "index" },
    });
    await renderer.updateVariableDisplay({
      variableId: "t2m",
      display: { clim: [1, 2], rgbStops: [[1, 1, 1]] },
    });

    expect(
      await renderer.readValidTime({
        time: { selected: 3, type: "index" },
        step: { selected: 4, type: "index" },
      }),
    ).toBe("valid-time");

    renderer.remove();
    expect(renderer.hasLayer()).toBe(false);
  });

  it("replaces by removing an existing map layer first", async () => {
    const map = createFakeMap();
    const renderer = createRasterRenderer({
      map,
      localRangeCoalescing: () => true,
    });

    await renderer.replace({
      kind: "raster",
      datasetKind: "ecmwf",
      refPath: "/ref1",
      variableId: "t2m",
      selector: {
        time: { selected: 1, type: "index" },
        step: { selected: 2, type: "index" },
      },
      display: { clim: [0, 1], rgbStops: [[0, 0, 0]] },
    });

    await renderer.replace({
      kind: "raster",
      datasetKind: "ecmwf",
      refPath: "/ref2",
      variableId: "t2m",
      selector: {
        time: { selected: 3, type: "index" },
        step: { selected: 4, type: "index" },
      },
      display: { clim: [1, 2], rgbStops: [[1, 1, 1]] },
    });

    expect(map.calls).toEqual([
      "add:ecmwf-raster",
      "remove:ecmwf-raster",
      "add:ecmwf-raster",
    ]);
  });

  it("forwards selector and display updates", async () => {
    const map = createFakeMap();
    const renderer = createRasterRenderer({
      map,
      localRangeCoalescing: () => true,
    });

    await renderer.replace({
      kind: "raster",
      datasetKind: "ecmwf",
      refPath: "/ref",
      variableId: "t2m",
      selector: {
        time: { selected: 1, type: "index" },
        step: { selected: 2, type: "index" },
      },
      display: { clim: [0, 1], rgbStops: [[0, 0, 0]] },
    });

    await renderer.updateSelector({
      time: { selected: 5, type: "index" },
      step: { selected: 6, type: "index" },
    });
    await renderer.updateVariableDisplay({
      variableId: "rh",
      display: { clim: [2, 3], rgbStops: [[2, 2, 2]] },
    });

    expect(setSelector).toHaveBeenCalledWith({
      time: { selected: 5, type: "index" },
      step: { selected: 6, type: "index" },
    });
    expect(setVariable).toHaveBeenCalledWith("rh");
    expect(setClim).toHaveBeenCalledWith([2, 3]);
    expect(setColormap).toHaveBeenCalledWith([[2, 2, 2]]);
  });

  it("creates map view from a container and exposes readiness", async () => {
    const container = {} as HTMLDivElement;
    const { renderer, whenReady, remove } = createRendererForContainer({
      container,
      localRangeCoalescing: () => true,
    });

    expect(renderer.hasLayer()).toBe(false);
    expect(mapOn).toHaveBeenCalledWith("load", expect.any(Function));

    const mapOptions = (vi.mocked((await import("maplibre-gl")).default.Map)
      .mock.calls[0]?.[0] ?? {}) as {
      container?: HTMLDivElement;
      style?: {
        layers?: Array<{ id: string; paint?: Record<string, unknown> }>;
      };
    };

    expect(mapOptions.container).toBe(container);
    expect(mapOptions.style?.layers?.map((layer) => layer.id)).toEqual([
      "bg",
      "osm-boundaries",
    ]);

    const loadHandler = mapOn.mock.calls.find(
      ([event]) => event === "load",
    )?.[1] as () => void;
    loadHandler();

    await whenReady;
    expect(mapSetProjection).toHaveBeenCalled();

    remove();
    expect(mapRemove).toHaveBeenCalled();
  });
});
