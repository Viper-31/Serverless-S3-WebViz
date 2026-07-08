import { ReferenceStore } from "@zarrita/storage";
import * as zarr from "zarrita";
import { createZarritaByteCache } from "@/zarr-store/byteCache";
import { validateAllCodecs } from "@/zarr-store/codecMetadata";
import { rewriteS3Refs } from "@/zarr-store/webvizRefs";
import type {
  ByteCacheOptions,
  ReferencedZarrStore,
  ZarrDeps,
  RefSpec,
  ZarrKind,
} from "@/zarr-store/types";

const DEFAULT_BYTE_CACHE: ByteCacheOptions = {
  maxBytes: 84 * 1024 * 1024,
  maxEntries: 128,
};

const DEFAULT_RANGE_COALESCE_SIZE = 32768;

function defaultDependencies(): ZarrDeps {
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

async function resolveSpec(input: {
  refUrl?: string;
  refSpec?: RefSpec;
  fetchRef?: typeof fetch;
  checkCodec?: boolean;
}): Promise<RefSpec> {
  const sourceSpec =
    input.refSpec ?? (await loadRefSpec(input.refUrl!, input.fetchRef));

  if (!input.refSpec && !input.refUrl) {
    throw new Error("Either refSpec or refUrl must be provided");
  }

  const preparedRefSpec = rewriteS3Refs(sourceSpec);

  if (input.checkCodec ?? true) {
    validateAllCodecs(preparedRefSpec);
  }

  return preparedRefSpec;
}

async function assembleStore(
  deps: ZarrDeps,
  preparedRefSpec: RefSpec,
  options: {
    rangeCoalescing?: boolean;
    byteCache?: false | ByteCacheOptions;
  },
): Promise<unknown> {
  const baseStore = await deps.ReferenceStore.fromSpec(preparedRefSpec);
  const wrappers: Array<(store: unknown) => unknown> = [];

  if (options.rangeCoalescing ?? true) {
    wrappers.push((store) =>
      deps.zarr.withRangeCoalescing(store, {
        coalesceSize: DEFAULT_RANGE_COALESCE_SIZE,
      }),
    );
  }

  if (options.byteCache !== false) {
    const byteCache = options.byteCache ?? DEFAULT_BYTE_CACHE;
    wrappers.push((store) =>
      deps.zarr.withByteCaching(store, {
        cache: createZarritaByteCache(byteCache),
      }),
    );
  }

  return deps.zarr.extendStore(baseStore, ...wrappers);
}

async function openTargetNode(
  deps: ZarrDeps,
  store: unknown,
  openPath: string | undefined,
  requestedKind: ZarrKind,
): Promise<{ root: unknown; node: unknown }> {
  const rootLocation = deps.zarr.root(store);
  const root = await deps.zarr.open.v2(rootLocation, openOptions("group"));

  const node =
    openPath === undefined
      ? root
      : await deps.zarr.open.v2(
          resolvePath(root, openPath),
          openOptions(requestedKind),
        );

  return { root, node };
}

// Public API ────────────────────────────────────────────────────

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

export async function openZarrStore(input: {
  refUrl?: string;
  refSpec?: RefSpec;
  path?: string;
  arrayPath?: string;
  kind?: ZarrKind;
  rangeCoalescing?: boolean;
  byteCache?: false | ByteCacheOptions;
  checkCodec?: boolean;
  fetchRef?: typeof fetch;
  dependencies?: ZarrDeps;
}): Promise<ReferencedZarrStore> {
  const preparedRefSpec = await resolveSpec(input);
  const deps = input.dependencies ?? defaultDependencies();
  const store = await assembleStore(deps, preparedRefSpec, input);

  const openPath = input.arrayPath ?? input.path;
  const requestedKind = input.kind ?? (input.arrayPath ? "array" : "group");
  const { root, node } = await openTargetNode(
    deps,
    store,
    openPath,
    requestedKind,
  );

  return {
    store,
    root,
    node,
    preparedRefSpec,

    async getArray(path: string) {
      return deps.zarr.open.v2(resolvePath(root, path), openOptions("array"));
    },

    async openNode(path: string, kind: ZarrKind = "group") {
      return deps.zarr.open.v2(resolvePath(root, path), openOptions(kind));
    },
  };
}
