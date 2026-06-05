import { describe, expect, it } from "vitest";
import {
  createDpirdMapController,
  createEcmwfMapController,
} from "@/map/controllers/mapController";

function createFakeMap() {
  const layers = new Set<string>();
  const sources = new Set<string>();
  const calls: string[] = [];
  return {
    calls,
    addLayer(layer: { id: string }) {
      calls.push(`addLayer:${layer.id}`);
      layers.add(layer.id);
    },
    removeLayer(id: string) {
      calls.push(`removeLayer:${id}`);
      layers.delete(id);
    },
    addSource(id: string) {
      calls.push(`addSource:${id}`);
      sources.add(id);
    },
    removeSource(id: string) {
      calls.push(`removeSource:${id}`);
      sources.delete(id);
    },
    getLayer(id: string) {
      return layers.has(id) ? { id } : undefined;
    },
    getSource(id: string) {
      return sources.has(id) ? { id } : undefined;
    },
  };
}

describe("map controllers", () => {
  it("manages DPIRD point station source/layer lifecycle idempotently", () => {
    const map = createFakeMap();
    const controller = createDpirdMapController(map as never);
    controller.add({ time: "2024-01-01T00:00:00Z", stationId: "dpird-1" });
    controller.add({ time: "2024-01-01T00:00:00Z", stationId: "dpird-1" });
    controller.remove();
    controller.remove();
    expect(map.calls).toContain("addSource:dpird-stations");
    expect(map.calls).toContain("removeLayer:dpird-stations-layer");
    expect(map.calls).toContain("removeSource:dpird-stations");
  });

  it("manages ECMWF raster layer lifecycle and update calls", () => {
    const map = createFakeMap();
    const controller = createEcmwfMapController(map as never);
    controller.add({
      time: "2024-01-01T00:00:00Z",
      step: "PT1H",
      variable: "t2m",
    });
    controller.update({
      time: "2024-01-01T00:00:00Z",
      step: "PT2H",
      variable: "t2m",
    });
    controller.remove();
    expect(map.calls.join("|")).toMatch(/addLayer:ecmwf-raster/);
    expect(map.calls.join("|")).toMatch(/removeSource:ecmwf-zarr/);
  });
});
