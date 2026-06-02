import { ZarrLayer, codecRegistry, type LoadingState } from '@carbonplan/zarr-layer'
import { ReferenceStore } from '@zarrita/storage'
import * as zarr from 'zarrita'
import { createByteCache } from '../byteCache'
import { prepareRefSpec } from '../refRewrite'

// Smoke-only direct ZarrLayer adapter. This intentionally proves the MapLibre
// render path before introducing a worker-backed store or broader data-engine API.
export const ECMWF_SMOKE_REF_PATH = '/refs/ECMWF/2024/01/02.nc.json'
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

type CodecRegistry = {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

const BYTE_CACHE_MAX_BYTES = 96 * 1024 * 1024
const BYTE_CACHE_MAX_ENTRIES = 256
const RANGE_COALESCE_SIZE_BYTES = 32_768

function createZarritaByteCache(): ZarritaByteCache {
  const cache = createByteCache({
    maxBytes: BYTE_CACHE_MAX_BYTES,
    maxEntries: BYTE_CACHE_MAX_ENTRIES,
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

function registerBareShuffleCodec() {
  const registry = codecRegistry as unknown as CodecRegistry
  if (registry.get('shuffle')) return

  const numcodecsShuffle = registry.get('numcodecs.shuffle')
  if (numcodecsShuffle) {
    registry.set('shuffle', numcodecsShuffle)
    return
  }

  registry.set('shuffle', async () => ({
    fromConfig(config: { elementsize?: number } = {}) {
      const elementsize = config.elementsize ?? 1
      if (!Number.isInteger(elementsize) || elementsize <= 0) {
        throw new Error(`Invalid shuffle elementsize: ${elementsize}`)
      }

      return {
        kind: 'bytes_to_bytes' as const,
        async decode(bytes: Uint8Array): Promise<Uint8Array> {
          if (elementsize <= 1) return bytes
          if (bytes.length % elementsize !== 0) {
            throw new Error(`Shuffle byte length ${bytes.length} is not divisible by elementsize ${elementsize}`)
          }

          const count = Math.floor(bytes.length / elementsize)
          const output = new Uint8Array(bytes.length)

          for (let element = 0; element < count; element += 1) {
            for (let byte = 0; byte < elementsize; byte += 1) {
              output[element * elementsize + byte] = bytes[byte * count + element]!
            }
          }

          for (let index = count * elementsize; index < bytes.length; index += 1) {
            output[index] = bytes[index]!
          }

          return output
        },
      }
    },
  }))
}

async function loadRefSpec(refPath: string): Promise<RefSpec> {
  const response = await fetch(refPath, { credentials: 'omit' })
  if (!response.ok) throw new Error(`Failed to load ${refPath}: HTTP ${response.status}`)
  return response.json() as Promise<RefSpec>
}

async function createEcmwfReadableStore(refPath: string) {
  const refSpec = await loadRefSpec(refPath)
  const preparedSpec = prepareRefSpec(refSpec)
  const baseStore = await ReferenceStore.fromSpec(preparedSpec)

  return zarr.extendStore(
    baseStore,
    (store) => zarr.withRangeCoalescing(store, { coalesceSize: RANGE_COALESCE_SIZE_BYTES }),
    (store) => zarr.withByteCaching(store, { cache: createZarritaByteCache() })
  )
}

export async function createEcmwfSmokeLayer(options: {
  onLoadingStateChange?: (state: LoadingState) => void
}) {
  registerBareShuffleCodec()
  const store = await createEcmwfReadableStore(ECMWF_SMOKE_REF_PATH)

  return new ZarrLayer({
    id: 'ecmwf-smoke-t2m',
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
