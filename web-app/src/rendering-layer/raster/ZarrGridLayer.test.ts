import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ZarrLayerMock,
  openReferencedZarrStoreMock,
  rootMock,
  openV2Mock,
  getMock,
} = vi.hoisted(() => ({
  ZarrLayerMock: vi.fn(),
  openReferencedZarrStoreMock: vi.fn(),
  rootMock: vi.fn(),
  openV2Mock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock("@carbonplan/zarr-layer", () => ({
  ZarrLayer: ZarrLayerMock,
}));

vi.mock("zarrita", () => ({
  root: rootMock,
  open: { v2: openV2Mock },
  get: getMock,
}));

vi.mock("@/zarr-store", () => ({
  openReferencedZarrStore: openReferencedZarrStoreMock,
}));

import {
  ECMWF_LAYER_ID,
  createEcmwfLayer,
  readEcmwfValidTimeValue,
  toZarrLayerSelector,
  updateEcmwfLayerDisplay,
  updateEcmwfLayerSelector,
} from "@/rendering-layer/raster/ZarrGridLayer";

describe("ecmwfLayer contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes structural selector indexes to zarr-layer selectors", () => {
    expect(
      toZarrLayerSelector({
        time: { selected: 8, type: "index" },
        step: { selected: 12, type: "index" },
        ensemble: { selected: 2, type: "index" },
      }),
    ).toEqual({
      time: { selected: 8, type: "index" },
      step: { selected: 12, type: "index" },
      ensemble: { selected: 2, type: "index" },
    });
  });

  it("reads valid_time using time and step selector indices", async () => {
    const store = { id: "store" };
    const resolvedPath = { id: "resolved-valid-time" };
    const validTimeArray = { id: "valid-time-array" };
    const resolveMock = vi.fn().mockReturnValue(resolvedPath);
    rootMock.mockReturnValue({ resolve: resolveMock });
    openV2Mock.mockResolvedValue(validTimeArray);
    getMock.mockResolvedValue("valid-time-value");
    const selector = {
      time: { selected: 8, type: "index" as const },
      step: { selected: 12, type: "index" as const },
      ensemble: { selected: 2, type: "index" as const },
    };
    await expect(readEcmwfValidTimeValue(store as any, selector)).resolves.toBe(
      "valid-time-value",
    );
    expect(rootMock).toHaveBeenCalledWith(store);
    expect(resolveMock).toHaveBeenCalledWith("valid_time");
    expect(openV2Mock).toHaveBeenCalledWith(resolvedPath, { kind: "array" });
    expect(getMock).toHaveBeenCalledWith(validTimeArray, [8, 12]);
  });

  it("creates an ECMWF layer from the referenced store and forwards stable config", async () => {
    const store = { id: "referenced-store" };
    const layerInstance = { id: ECMWF_LAYER_ID };
    const onLoadingStateChange = vi.fn();
    openReferencedZarrStoreMock.mockResolvedValue({ store });
    ZarrLayerMock.mockImplementation(function MockZarrLayer() {
      return layerInstance;
    });

    const options = {
      kind: "raster" as const,
      datasetKind: "ecmwf" as const,
      refPath: "/refs/ecmwf.json",
      variableId: "t2m",
      selector: {
        time: { selected: 3, type: "index" as const },
        step: { selected: 9, type: "index" as const },
      },
      display: {
        clim: [270, 310] as [number, number],
        rgbStops: [
          [0, 0, 0],
          [255, 255, 255],
        ] as Array<[number, number, number]>,
      },
      localRangeCoalescing: true,
      onLoadingStateChange,
    };
    const bundle = await createEcmwfLayer(options);
    expect(openReferencedZarrStoreMock).toHaveBeenCalledWith({
      refUrl: "/refs/ecmwf.json",
      rangeCoalescing: true,
    });
    expect(ZarrLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ECMWF_LAYER_ID,
        store,
        variable: "t2m",
        selector: options.selector,
        colormap: options.display.rgbStops,
        clim: options.display.clim,
        opacity: 0.6,
        zarrVersion: 2,
        spatialDimensions: { lat: "latitude", lon: "longitude" },
        onLoadingStateChange,
      }),
    );
    expect(bundle).toEqual({
      layer: layerInstance,
      store,
      refPath: "/refs/ecmwf.json",
    });
  });

  it("forwards selector updates to the layer", async () => {
    const setSelector = vi.fn();
    const selector = {
      time: { selected: 5, type: "index" as const },
      step: { selected: 6, type: "index" as const },
    };
    await updateEcmwfLayerSelector({ setSelector } as any, selector);
    expect(setSelector).toHaveBeenCalledWith({
      time: { selected: 5, type: "index" },
      step: { selected: 6, type: "index" },
    });
  });

  it("forwards display updates to the layer", async () => {
    const setVariable = vi.fn();
    const setClim = vi.fn();
    const setColormap = vi.fn();
    await updateEcmwfLayerDisplay(
      { setVariable, setClim, setColormap } as any,
      {
        variableId: "rh",
        display: {
          clim: [0, 100],
          rgbStops: [[1, 2, 3]],
        },
      },
    );
    expect(setVariable).toHaveBeenCalledWith("rh");
    expect(setClim).toHaveBeenCalledWith([0, 100]);
    expect(setColormap).toHaveBeenCalledWith([[1, 2, 3]]);
  });
});
