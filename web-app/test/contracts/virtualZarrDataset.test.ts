import { describe, expect, it, vi } from 'vitest'
import { createVirtualZarrDataset } from '../../src/lib/virtualZarrDataset'

describe('virtual zarr dataset adapter', () => {
  it('prepares the ref spec without mutating input and opens the root group', async () => {
    const refSpec = {
      version: 1,
      refs: {
        '.zgroup': '{"zarr_format":2}',
        'airTemperature/0.0': ['s3://webviz/DPIRD/dpird_wa_stations.nc', 394727937, 11823953],
      },
    }
    const referenceStore = { fromSpec: vi.fn(() => ({ base: true })) }
    const wrappedCache = { has: vi.fn(() => false), get: vi.fn(() => undefined), set: vi.fn() }
    let cachedAdapter: { has: (key: string) => boolean; get: (key: string) => Uint8Array | undefined; set: (key: string, value: Uint8Array | undefined) => void } | undefined
    const zarr = {
      root: vi.fn((store) => ({ rootStore: store })),
      open: {
        v2: vi.fn((location, options) => ({ location, options, resolve: (path: string) => ({ parent: location, path }) })),
      },
      extendStore: vi.fn((store, rangeWrapper, byteWrapper) => byteWrapper(rangeWrapper(store))),
      withRangeCoalescing: vi.fn((store) => ({ store, rangeCoalesced: true })),
      withByteCaching: vi.fn((store, options) => {
        cachedAdapter = options.cache
        options.cache.set('present', new Uint8Array([1, 2, 3]))
        expect(() => options.cache.set('skip', undefined)).not.toThrow()
        return { store, cached: true }
      }),
    }

    const next = await createVirtualZarrDataset({
      refSpec,
      cache: wrappedCache,
      dependencies: { zarr, ReferenceStore: referenceStore },
    })

    expect(refSpec.refs['airTemperature/0.0'][0]).toBe('s3://webviz/DPIRD/dpird_wa_stations.nc')
    expect(referenceStore.fromSpec).toHaveBeenCalledTimes(1)
    expect(referenceStore.fromSpec).toHaveBeenCalledWith({
      version: 1,
      refs: {
        '.zgroup': '{"zarr_format":2}',
        'airTemperature/0.0': ['https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc', 394727937, 11823953],
      },
    })
    expect(zarr.extendStore).toHaveBeenCalledTimes(1)
    expect(zarr.withRangeCoalescing).toHaveBeenCalledTimes(1)
    expect(zarr.withByteCaching).toHaveBeenCalledTimes(1)
    expect(cachedAdapter?.set).toBeDefined()
    cachedAdapter?.set('empty', undefined)
    expect(wrappedCache.set).toHaveBeenCalledWith('present', expect.any(Uint8Array))
    expect(wrappedCache.set).not.toHaveBeenCalledWith('skip', undefined)
    expect(zarr.root).toHaveBeenCalledWith({ store: { store: { base: true }, rangeCoalesced: true }, cached: true })
    expect(zarr.open.v2).toHaveBeenCalledWith({ rootStore: { store: { store: { base: true }, rangeCoalesced: true }, cached: true } }, { kind: 'group' })
    expect(next.root).toMatchObject({ location: { rootStore: { store: { store: { base: true }, rangeCoalesced: true }, cached: true } }, options: { kind: 'group' } })
    expect(next.node).toBe(next.root)
  })

  it('opens child arrays and nodes against the composed store', async () => {
    const referenceStore = { fromSpec: vi.fn(() => ({ base: true })) }
    const rootGroup = { resolve: vi.fn((path: string) => ({ resolved: path })) }
    const zarr = {
      root: vi.fn((store) => ({ rootStore: store })),
      open: {
        v2: vi.fn((location, options) => (location as { rootStore?: unknown }).rootStore ? rootGroup : { location, options }),
      },
      extendStore: vi.fn((store, ...wrappers) => wrappers.reduce((next, wrapper) => wrapper(next), store)),
      withRangeCoalescing: vi.fn((store) => store),
      withByteCaching: vi.fn((store) => store),
    }

    const dataset = await createVirtualZarrDataset({
      refSpec: { version: 1, refs: {} },
      kind: 'array',
      path: 'airTemperature',
      dependencies: { zarr, ReferenceStore: referenceStore },
    })

    expect(zarr.root).toHaveBeenCalledWith({ base: true })
    expect(zarr.open.v2).toHaveBeenNthCalledWith(1, { rootStore: { base: true } }, { kind: 'group' })
    expect(zarr.withRangeCoalescing).toHaveBeenCalledTimes(1)
    expect(zarr.withByteCaching).not.toHaveBeenCalled()
    expect(rootGroup.resolve).toHaveBeenCalledWith('airTemperature')
    expect(zarr.open.v2).toHaveBeenNthCalledWith(2, { resolved: 'airTemperature' }, { kind: 'array' })
    await expect(dataset.getArray('temperature')).resolves.toEqual({ location: { resolved: 'temperature' }, options: { kind: 'array' } })
    await expect(dataset.openNode('stations', 'group')).resolves.toEqual({ location: { resolved: 'stations' }, options: { kind: 'group' } })
    expect(rootGroup.resolve).toHaveBeenCalledWith('temperature')
    expect(rootGroup.resolve).toHaveBeenCalledWith('stations')
  })
})
