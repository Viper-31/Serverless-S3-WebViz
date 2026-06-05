export type ZarrKind = "array" | "group";

export type RefSpec = {
  version?: number;
  refs?: Record<string, unknown>;
};

export type ByteCacheOptions = {
  maxBytes: number;
  maxEntries: number;
};

export type ZarritaCompatibleByteCache = {
  has(key: string): boolean;
  get(key: string): Uint8Array | undefined;
  set(key: string, value: Uint8Array | undefined): void;
};

export type ReferencedZarrStoreDependencies = {
  zarr: {
    root(store: unknown): { resolve?: (path: string) => unknown } | unknown;
    open: {
      v2(
        location: unknown,
        options: { kind: ZarrKind },
      ): Promise<unknown> | unknown;
    };
    extendStore(
      store: unknown,
      ...wrappers: Array<(store: unknown) => unknown>
    ): unknown;
    withRangeCoalescing(
      store: unknown,
      options?: { coalesceSize?: number },
    ): unknown;
    withByteCaching(
      store: unknown,
      options: { cache: ZarritaCompatibleByteCache },
    ): unknown;
  };
  ReferenceStore: {
    fromSpec(spec: unknown): unknown;
  };
};

export type ReferencedZarrStore = {
  store: unknown;
  root: unknown;
  node: unknown;
  preparedRefSpec: RefSpec;
  getArray(path: string): Promise<unknown>;
  openNode(path: string, kind?: ZarrKind): Promise<unknown>;
};
