import { describe, expect, it } from "vitest";
import * as zarr from "zarrita";
import type { Array as ZarrArray, DataType, Readable } from "zarrita";

import { openZarrStore } from "../../src/zarr-store";

const onlineDescribe =
  process.env.RUN_ONLINE_INTEGRATION === "1" ? describe : describe.skip;

type Region = { data: ArrayLike<number | bigint>; shape: number[] };

function asZarrArray(value: unknown): ZarrArray<DataType, Readable> {
  return value as ZarrArray<DataType, Readable>;
}

async function loadRefSpec(path: string) {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

function values(region: Region) {
  return Array.from(region.data);
}

function asNumber(value: number | bigint) {
  return typeof value === "bigint" ? Number(value) : value;
}

function expectDecodedRegion(region: Region, shape: number[]) {
  expect(region.shape).toEqual(shape);
  expect(values(region)).toHaveLength(
    shape.reduce((total, size) => total * size, 1),
  );
  expect(
    values(region).every(
      (value) => typeof value === "bigint" || Number.isFinite(value),
    ),
  ).toBe(true);
}

onlineDescribe("referencedZarrStore integration", () => {
  it("opens a DPIRD ref spec and rewrites webviz chunk URLs", async () => {
    const refSpec = await loadRefSpec(
      "../../public/refs/DPIRD/dpird_wa_stations.nc.json",
    );

    const dataset = await openZarrStore({
      refSpec,
      arrayPath: "lat",
    });
    const chunkRef = dataset.preparedRefSpec.refs?.["airTemperature/0.0"] as
      | [string, number, number]
      | undefined;

    expect(dataset.store).toBeTruthy();
    expect(dataset.root).toBeTruthy();
    expect(dataset.node).toBeTruthy();
    expect(chunkRef?.[0]).toBe(
      "https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc",
    );
    await expect(dataset.openNode("lon", "array")).resolves.toBeTruthy();
  });

  it("decodes DPIRD lat, lon, and time with select/get", async () => {
    const refSpec = await loadRefSpec(
      "../../public/refs/DPIRD/dpird_wa_stations.nc.json",
    );

    const dataset = await openZarrStore({ refSpec });

    const lat = asZarrArray(await dataset.getArray("lat"));
    const latSelection = zarr.select(lat, { station: zarr.slice(0, 3) });
    const latRegion = (await zarr.get(lat, latSelection)) as Region;
    expect(latSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(latRegion, [3]);
    expect(
      values(latRegion)
        .map(asNumber)
        .every((value) => value < 0 && value > -40),
    ).toBe(true);

    const lon = asZarrArray(await dataset.getArray("lon"));
    const lonSelection = zarr.select(lon, { station: zarr.slice(0, 3) });
    const lonRegion = (await zarr.get(lon, lonSelection)) as Region;
    expect(lonSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(lonRegion, [3]);
    expect(
      values(lonRegion)
        .map(asNumber)
        .every((value) => value > 110 && value < 130),
    ).toBe(true);

    const time = asZarrArray(await dataset.getArray("time"));
    const timeSelection = zarr.select(time, { time: zarr.slice(0, 3) });
    const timeRegion = (await zarr.get(time, timeSelection)) as Region;
    expect(timeSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(timeRegion, [3]);
    expect(
      values(timeRegion)
        .map(asNumber)
        .every((value) => value >= 0),
    ).toBe(true);

    const airTemperature = asZarrArray(
      await dataset.getArray("airTemperature"),
    );
    const airTemperatureSelection = zarr.select(airTemperature, {
      station: zarr.slice(0, 3),
      time: 0,
    });
    const airTemperatureRegion = (await zarr.get(
      airTemperature,
      airTemperatureSelection,
    )) as Region;
    expect(airTemperatureSelection).toEqual([zarr.slice(0, 3), 0]);
    expectDecodedRegion(airTemperatureRegion, [3]);
    expect(
      values(airTemperatureRegion)
        .map(asNumber)
        .every((value) => Number.isFinite(value)),
    ).toBe(true);
  });

  it("decodes ECMWF time, step, latitude, longitude, and valid_time with select/get", async () => {
    const refSpec = await loadRefSpec(
      "../../public/refs/ECMWF/2024/01/02.nc.json",
    );

    const dataset = await openZarrStore({ refSpec });

    const time = asZarrArray(await dataset.getArray("time"));
    const timeSelection = zarr.select(time, { time: zarr.slice(0, 3) });
    const timeRegion = (await zarr.get(time, timeSelection)) as Region;
    expect(timeSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(timeRegion, [3]);
    expect(
      values(timeRegion)
        .map(asNumber)
        .every((value) => value > 0),
    ).toBe(true);

    const step = asZarrArray(await dataset.getArray("step"));
    const stepSelection = zarr.select(step, { step: zarr.slice(0, 3) });
    const stepRegion = (await zarr.get(step, stepSelection)) as Region;
    expect(stepSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(stepRegion, [3]);
    expect(
      values(stepRegion)
        .map(asNumber)
        .every((value) => value >= 0),
    ).toBe(true);

    const latitude = asZarrArray(await dataset.getArray("latitude"));
    const latitudeSelection = zarr.select(latitude, {
      latitude: zarr.slice(0, 3),
    });
    const latitudeRegion = (await zarr.get(
      latitude,
      latitudeSelection,
    )) as Region;
    expect(latitudeSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(latitudeRegion, [3]);
    expect(
      values(latitudeRegion)
        .map(asNumber)
        .every((value) => value < 0 && value > -40),
    ).toBe(true);

    const longitude = asZarrArray(await dataset.getArray("longitude"));
    const longitudeSelection = zarr.select(longitude, {
      longitude: zarr.slice(0, 3),
    });
    const longitudeRegion = (await zarr.get(
      longitude,
      longitudeSelection,
    )) as Region;
    expect(longitudeSelection).toEqual([zarr.slice(0, 3)]);
    expectDecodedRegion(longitudeRegion, [3]);
    expect(
      values(longitudeRegion)
        .map(asNumber)
        .every((value) => value > 110 && value < 130),
    ).toBe(true);

    const validTime = asZarrArray(await dataset.getArray("valid_time"));
    const validTimeSelection = zarr.select(validTime, {
      time: 0,
      step: zarr.slice(0, 3),
    });
    const validTimeRegion = (await zarr.get(
      validTime,
      validTimeSelection,
    )) as Region;
    expect(validTimeSelection).toEqual([0, zarr.slice(0, 3)]);
    expectDecodedRegion(validTimeRegion, [3]);
    expect(
      values(validTimeRegion)
        .map(asNumber)
        .every((value) => value > 0),
    ).toBe(true);

    const t2m = asZarrArray(await dataset.getArray("t2m"));
    const t2mSelection = zarr.select(t2m, {
      time: 0,
      step: 0,
      latitude: zarr.slice(0, 2),
      longitude: zarr.slice(0, 2),
    });
    const t2mRegion = (await zarr.get(t2m, t2mSelection)) as Region;
    expect(t2mSelection).toEqual([0, 0, zarr.slice(0, 2), zarr.slice(0, 2)]);
    expectDecodedRegion(t2mRegion, [2, 2]);
    expect(
      values(t2mRegion)
        .map(asNumber)
        .every((value) => Number.isFinite(value)),
    ).toBe(true);
  });
});
