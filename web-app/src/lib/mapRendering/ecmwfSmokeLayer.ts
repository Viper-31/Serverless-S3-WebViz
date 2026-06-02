import { ZarrLayer, type LoadingState } from '@carbonplan/zarr-layer'
import { ReferenceStore } from '@zarrita/storage'
import type { AsyncReadable } from '@zarrita/storage'
import * as zarr from 'zarrita'
import { createByteCache } from '../byteCache'
import { prepareRefSpec } from '../refRewrite'

// Smoke-only direct ZarrLayer adapter. This intentionally proves the MapLibre
// render path before introducing a worker-backed store or broader data-engine API.
export const ECMWF_SMOKE_REF_PATH = '/refs/ECMWF/2024/01/02.nc.json'
export const ECMWF_SMOKE_LAYER_ID = 'ecmwf-smoke-t2m'
export const ECMWF_SMOKE_VARIABLE = 't2m'
export const ECMWF_SMOKE_TIME_INDEX = 0
export const ECMWF_SMOKE_STEP_INDEX = 0
export const ECMWF_SMOKE_UNITS = '°C'
export const ECMWF_SMOKE_CLIM: [number, number] = [-10, 50]
export const ECMWF_THERMAL_COLORMAP = [
  '#053061',
  '#2166ac',
  '#4393c3',
  '#92c5de',
  '#f4a582',
  '#d6604d',
  '#b2182b',
  '#67001f',
]

export type EcmwfSmokeLoadingState = LoadingState

type RefSpec = {
  version?: number
  refs?: Record<string, unknown>
}

type ZarritaByteCache = {
  has(key: string): boolean
  get(key: string): Uint8Array | undefined
  set(key: string, value: Uint8Array | undefined): void
}

// This bounds raw byte response cache only. ZarrLayer also keeps decoded chunks;
export const ECMWF_RAW_BYTE_CACHE_MAX_BYTES = 24 * 1024 * 1024
export const ECMWF_RAW_BYTE_CACHE_MAX_ENTRIES = 128
const RANGE_COALESCE_SIZE_BYTES = 32_768

function createZarritaByteCache(): ZarritaByteCache {
  const cache = createByteCache({
    maxBytes: ECMWF_RAW_BYTE_CACHE_MAX_BYTES,
    maxEntries: ECMWF_RAW_BYTE_CACHE_MAX_ENTRIES,
  })

  return {
    has: (key) => cache.has(key),
    get: (key) => cache.get(key),
    set(key, value) {
      if (value === undefined) return
      cache.set(key, value)
    },
  }
}

async function loadRefSpec(refPath: string): Promise<RefSpec> {
  const response = await fetch(refPath, { credentials: 'omit' })
  if (!response.ok) throw new Error(`Failed to load ${refPath}: HTTP ${response.status}`)
  return response.json() as Promise<RefSpec>
}

async function createEcmwfReadableStore(refPath: string, options: { localRangeCoalescing: boolean }) {
  const refSpec = await loadRefSpec(refPath)
  const preparedSpec = prepareRefSpec(refSpec)
  const baseStore = await ReferenceStore.fromSpec(preparedSpec) as AsyncReadable

  if (!options.localRangeCoalescing) {
    return zarr.extendStore(
      baseStore,
      (store) => zarr.withByteCaching(store, { cache: createZarritaByteCache() })
    )
  }

  return zarr.extendStore(
    baseStore,
    (store) => zarr.withRangeCoalescing(store, { coalesceSize: RANGE_COALESCE_SIZE_BYTES }),
    (store) => zarr.withByteCaching(store, { cache: createZarritaByteCache() })
  )
}

export async function createEcmwfSmokeLayer(options: {
  localRangeCoalescing: boolean
  onLoadingStateChange?: (state: LoadingState) => void
}) {
  const store = await createEcmwfReadableStore(ECMWF_SMOKE_REF_PATH, {
    localRangeCoalescing: options.localRangeCoalescing,
  })

  return new ZarrLayer({
    id: ECMWF_SMOKE_LAYER_ID,
    store: store as zarr.Readable,
    variable: ECMWF_SMOKE_VARIABLE,
    selector: {
      time: { selected: ECMWF_SMOKE_TIME_INDEX, type: 'index' },
      step: { selected: ECMWF_SMOKE_STEP_INDEX, type: 'index' },
    },
    colormap: ECMWF_THERMAL_COLORMAP,
    clim: ECMWF_SMOKE_CLIM,
    opacity: 0.92,
    zarrVersion: 2,
    spatialDimensions: { lat: 'latitude', lon: 'longitude' },
    onLoadingStateChange: options.onLoadingStateChange,
  })
}
