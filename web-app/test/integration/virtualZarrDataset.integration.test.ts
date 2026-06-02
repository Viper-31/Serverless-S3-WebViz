import { describe, expect, it } from 'vitest'

const runOnline = process.env.RUN_ONLINE_INTEGRATION === '1' || process.env.RUN_LIVE_PAWSEY_TESTS === '1'
const onlineDescribe = runOnline ? describe : describe.skip

type Region = { data: ArrayLike<number | bigint>; shape: number[] }

async function loadRefSpec(path: string) {
  const { readFile } = await import('node:fs/promises')
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
}

async function loadRealZarrStack() {
  try {
    const zarrPackage = 'zarrita'
    const storagePackage = '@zarrita/storage'
    const [zarr, storage] = await Promise.all([
      import(/* @vite-ignore */ zarrPackage),
      import(/* @vite-ignore */ storagePackage),
    ])
    return { zarr, ReferenceStore: storage.ReferenceStore }
  } catch (error) {
    throw new Error('Install zarrita and @zarrita/storage before enabling online integration tests.')
  }
}

function values(region: Region) {
  return Array.from(region.data)
}

function asNumber(value: number | bigint) {
  return typeof value === 'bigint' ? Number(value) : value
}

function expectDecodedRegion(region: Region, shape: number[]) {
  expect(region.shape).toEqual(shape)
  expect(values(region)).toHaveLength(shape.reduce((total, size) => total * size, 1))
  expect(values(region).every((value) => typeof value === 'bigint' || Number.isFinite(value))).toBe(true)
}

onlineDescribe('virtualZarrDataset integration smoke', () => {
  it('can be wired to the real zarrita stack when optional deps are available', async () => {
    const { zarr, ReferenceStore } = await loadRealZarrStack()
    const { createVirtualZarrDataset } = await import('../../src/lib/virtualZarrDataset')

    const dataset = await createVirtualZarrDataset({
      refSpec: {
        version: 1,
        refs: {
          '.zgroup': '{"zarr_format":2}',
          '.zattrs': '{}',
        },
      },
      dependencies: { zarr, ReferenceStore },
    })

    expect(dataset.preparedRefSpec).toEqual({
      version: 1,
      refs: {
        '.zgroup': '{"zarr_format":2}',
        '.zattrs': '{}',
      },
    })
    expect(dataset.store).toBeTruthy()
    expect(dataset.root).toBeTruthy()
  })

  it('decodes DPIRD lat, lon, and time with select/get', async () => {
    const { zarr, ReferenceStore } = await loadRealZarrStack()
    const { createVirtualZarrDataset } = await import('../../src/lib/virtualZarrDataset')
    const refSpec = await loadRefSpec('../../public/refs/DPIRD/dpird_wa_stations.nc.json')

    const dataset = await createVirtualZarrDataset({ refSpec, dependencies: { zarr, ReferenceStore } })

    const lat = await dataset.getArray('lat')
    const latSelection = zarr.select(lat, { station: zarr.slice(0, 3) })
    const latRegion = await zarr.get(lat, latSelection) as Region
    expect(latSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(latRegion, [3])
    expect(values(latRegion).map(asNumber).every((value) => value < 0 && value > -40)).toBe(true)

    const lon = await dataset.getArray('lon')
    const lonSelection = zarr.select(lon, { station: zarr.slice(0, 3) })
    const lonRegion = await zarr.get(lon, lonSelection) as Region
    expect(lonSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(lonRegion, [3])
    expect(values(lonRegion).map(asNumber).every((value) => value > 110 && value < 130)).toBe(true)

    const time = await dataset.getArray('time')
    const timeSelection = zarr.select(time, { time: zarr.slice(0, 3) })
    const timeRegion = await zarr.get(time, timeSelection) as Region
    expect(timeSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(timeRegion, [3])
    expect(values(timeRegion).map(asNumber).every((value) => value >= 0)).toBe(true)
  })

  it('decodes ECMWF time, step, latitude, longitude, and valid_time with select/get', async () => {
    const { zarr, ReferenceStore } = await loadRealZarrStack()
    const { createVirtualZarrDataset } = await import('../../src/lib/virtualZarrDataset')
    const refSpec = await loadRefSpec('../../public/refs/ECMWF/2024/01/02.nc.json')

    const dataset = await createVirtualZarrDataset({ refSpec, dependencies: { zarr, ReferenceStore } })

    const time = await dataset.getArray('time')
    const timeSelection = zarr.select(time, { time: zarr.slice(0, 3) })
    const timeRegion = await zarr.get(time, timeSelection) as Region
    expect(timeSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(timeRegion, [3])
    expect(values(timeRegion).map(asNumber).every((value) => value > 0)).toBe(true)

    const step = await dataset.getArray('step')
    const stepSelection = zarr.select(step, { step: zarr.slice(0, 3) })
    const stepRegion = await zarr.get(step, stepSelection) as Region
    expect(stepSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(stepRegion, [3])
    expect(values(stepRegion).map(asNumber).every((value) => value >= 0)).toBe(true)

    const latitude = await dataset.getArray('latitude')
    const latitudeSelection = zarr.select(latitude, { latitude: zarr.slice(0, 3) })
    const latitudeRegion = await zarr.get(latitude, latitudeSelection) as Region
    expect(latitudeSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(latitudeRegion, [3])
    expect(values(latitudeRegion).map(asNumber).every((value) => value < 0 && value > -40)).toBe(true)

    const longitude = await dataset.getArray('longitude')
    const longitudeSelection = zarr.select(longitude, { longitude: zarr.slice(0, 3) })
    const longitudeRegion = await zarr.get(longitude, longitudeSelection) as Region
    expect(longitudeSelection).toEqual([zarr.slice(0, 3)])
    expectDecodedRegion(longitudeRegion, [3])
    expect(values(longitudeRegion).map(asNumber).every((value) => value > 110 && value < 130)).toBe(true)

    const validTime = await dataset.getArray('valid_time')
    const validTimeSelection = zarr.select(validTime, { time: 0, step: zarr.slice(0, 3) })
    const validTimeRegion = await zarr.get(validTime, validTimeSelection) as Region
    expect(validTimeSelection).toEqual([0, zarr.slice(0, 3)])
    expectDecodedRegion(validTimeRegion, [3])
    expect(values(validTimeRegion).map(asNumber).every((value) => value > 0)).toBe(true)
  })
})
