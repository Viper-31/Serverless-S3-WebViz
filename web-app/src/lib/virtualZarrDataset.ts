import { prepareRefSpec } from './refRewrite'

export type VirtualZarrKind = 'group' | 'array'

export type VirtualZarrRefSpec = {
  version?: number
  refs?: Record<string, unknown>
}

export type VirtualZarrByteCache = {
  has(key: string): boolean
  get(key: string): Uint8Array | undefined
  set(key: string, value: Uint8Array): unknown
}

type ZarritaCompatibleByteCache = {
  has(key: string): boolean
  get(key: string): Uint8Array | undefined
  set(key: string, value: Uint8Array | undefined): void
}

export type VirtualZarrInput<TRefSpec extends VirtualZarrRefSpec = VirtualZarrRefSpec> = {
  refSpec: TRefSpec
  cache?: VirtualZarrByteCache
  path?: string
  arrayPath?: string
  kind?: VirtualZarrKind
  dependencies: {
    zarr: {
      root(store: unknown): unknown
      open: {
        v2(location: unknown, options: { kind: VirtualZarrKind }): unknown
      }
      extendStore(store: unknown, ...wrappers: Array<(store: unknown) => unknown>): unknown
      withRangeCoalescing(store: unknown): unknown
      withByteCaching(store: unknown, options: { cache: ZarritaCompatibleByteCache }): unknown
    }
    ReferenceStore: {
      fromSpec(spec: unknown): unknown
    }
  }
}

export type VirtualZarrDataset = {
  store: unknown
  root: unknown
  node: unknown
  preparedRefSpec: VirtualZarrRefSpec
  getArray(path: string): Promise<unknown>
  openNode(path: string, kind?: VirtualZarrKind): Promise<unknown>
}

function createCompatibleCache(cache: VirtualZarrByteCache): ZarritaCompatibleByteCache {
  return {
    has: (key: string) => cache.has(key),
    get: (key: string) => cache.get(key),
    set(key: string, value: Uint8Array | undefined) {
      if (value === undefined) return
      cache.set(key, value)
    },
  }
}

function openOptions(kind: VirtualZarrKind) {
  return { kind }
}

function resolvePath(root: unknown, path: string) {
  const resolver = (root as { resolve?: (path: string) => unknown })?.resolve
  if (typeof resolver !== 'function') throw new Error('Opened Zarr root cannot resolve child paths')
  return resolver.call(root, path)
}

export async function createVirtualZarrDataset(input: VirtualZarrInput): Promise<VirtualZarrDataset> {
  const preparedRefSpec = prepareRefSpec(input.refSpec)
  const baseStore = await input.dependencies.ReferenceStore.fromSpec(preparedRefSpec)
  const zarr = input.dependencies.zarr
  const wrappers: Array<(store: unknown) => unknown> = [(store) => zarr.withRangeCoalescing(store)]

  if (input.cache) {
    const cache = createCompatibleCache(input.cache)
    wrappers.push((store) => zarr.withByteCaching(store, { cache }))
  }

  const wrappedStore = await zarr.extendStore(baseStore, ...wrappers)

  const openPath = input.arrayPath ?? input.path
  const requestedKind = input.kind ?? (input.arrayPath ? 'array' : 'group')
  const rootLocation = zarr.root(wrappedStore)
  const root = await zarr.open.v2(rootLocation, openOptions('group'))
  const node = openPath === undefined
    ? root
    : await zarr.open.v2(resolvePath(root, openPath), openOptions(requestedKind))

  return {
    store: wrappedStore,
    root,
    node,
    preparedRefSpec,
    async getArray(path: string) {
      return zarr.open.v2(resolvePath(root, path), openOptions('array'))
    },
    async openNode(path: string, kind: VirtualZarrKind = 'group') {
      return zarr.open.v2(resolvePath(root, path), openOptions(kind))
    },
  }
}
