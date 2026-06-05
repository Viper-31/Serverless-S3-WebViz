import { ReferenceStore } from "@zarrita/storage";
import * as zarr from "zarrita";
import { createZarritaByteCache } from "@/zarr-store/byteCache";
import { validateRefSpecZarrayMetadata } from "@/zarr-store/codecMetadata";
import { prepareWebvizRefSpec } from "@/zarr-store/webvizRefs";
import type {
  ByteCacheOptions,
  ReferencedZarrStore,
  ReferencedZarrStoreDependencies,
  RefSpec,
  ZarrKind,
} from "@/zarr-store/types";

const DEFAULT_BYTE_CACHE: ByteCacheOptions = {
  maxBytes: 24 * 1024 * 1024,
  maxEntries: 128,
};

const DEFAULT_RANGE_COALESCE_SIZE = 32768;

function defaultDependencies(): ReferencedZarrStoreDependencies {
  return { zarr, ReferenceStore };
}

function resolvePath(root: unknown, path: string) {
  const resolver = (root as { resolve?: (path: string) => unknown })?.resolve;
  if (typeof resolver !== "function")
    throw new Error("Opened Zarr root cannot resolve child paths");
  return resolver.call(root, path);
}

function openOptions(kind: ZarrKind) {
  return { kind };
}

export async function loadRefSpec(
  refUrl: string,
  fetchRef: typeof fetch = fetch,
): Promise<RefSpec> {
  const response = await fetchRef(refUrl, { credentials: "omit" });

  if (!response.ok) {
    throw new Error(`Failed to load ${refUrl}: HTTP ${response.status}`);
  }
  return response.json() as Promise<RefSpec>;
}

export async function openReferencedZarrStore(input: {
  refUrl?: string;
  refSpec?: RefSpec;
  path?: string;
  arrayPath?: string;
  kind?: ZarrKind;
  rangeCoalescing?: boolean;
  byteCache?: false | ByteCacheOptions;
  validateMetadata?: boolean;
  fetchRef?: typeof fetch;
  dependencies?: ReferencedZarrStoreDependencies;
}): Promise<ReferencedZarrStore> {
  const dependencies = input.dependencies ?? defaultDependencies();
  const sourceSpec =
    input.refSpec ?? (await loadRefSpec(input.refUrl ?? "", input.fetchRef));

  if (!input.refSpec && !input.refUrl) {
    throw new Error("refUrl or refSpec is required");
  }

  const preparedRefSpec = prepareWebvizRefSpec(sourceSpec);

  if (input.validateMetadata ?? true) {
    validateRefSpecZarrayMetadata(preparedRefSpec);
  }

  const baseStore = await dependencies.ReferenceStore.fromSpec(preparedRefSpec);
  const wrappers: Array<(store: unknown) => unknown> = [];

  if (input.rangeCoalescing ?? true) {
    wrappers.push((store) =>
      dependencies.zarr.withRangeCoalescing(store, {
        coalesceSize: DEFAULT_RANGE_COALESCE_SIZE,
      }),
    );
  }

  if (input.byteCache !== false) {
    const byteCache = input.byteCache ?? DEFAULT_BYTE_CACHE;
    wrappers.push((store) =>
      dependencies.zarr.withByteCaching(store, {
        cache: createZarritaByteCache(byteCache),
      }),
    );
  }

  const store = await dependencies.zarr.extendStore(baseStore, ...wrappers);

  const openPath = input.arrayPath ?? input.path;
  const requestedKind = input.kind ?? (input.arrayPath ? "array" : "group");

  const rootLocation = dependencies.zarr.root(store);
  const root = await dependencies.zarr.open.v2(
    rootLocation,
    openOptions("group"),
  );

  const node =
    openPath === undefined
      ? root
      : await dependencies.zarr.open.v2(
          resolvePath(root, openPath),
          openOptions(requestedKind),
        );

  return {
    store,
    root,
    node,
    preparedRefSpec,

    async getArray(path: string) {
      return dependencies.zarr.open.v2(
        resolvePath(root, path),
        openOptions("array"),
      );
    },

    async openNode(path: string, kind: ZarrKind = "group") {
      return dependencies.zarr.open.v2(
        resolvePath(root, path),
        openOptions(kind),
      );
    },
  };
}
