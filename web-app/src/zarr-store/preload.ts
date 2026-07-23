import * as zarr from "zarrita";

/**
 * In-flight warm registry: store instance → (chunkKey → shared promise).
 * chunkKey = variableId + time-chunk + step-chunk indices from runtime metadata.
 */
const inflightPreloads = new WeakMap<
  zarr.Readable,
  Map<string, Promise<void>>
>();

/**
 * Pre-fetch the byte cache for all spatial chunks of an ECMWF variable
 * at a given time/step selector index.
 *
 * Each chunk is fetched via {@link zarr.Array.getChunk}, which populates
 * the store-level byte cache.  When {@link @carbonplan/zarr-layer} later
 * requests the same chunks during rendering the bytes are served from
 * cache without a network round-trip.
 */
export async function preloadEcmwfChunks(
  store: zarr.Readable,
  variableKey: string,
  timeIndex: number,
  stepIndex: number,
  signal?: AbortSignal,
): Promise<void> {
  const zarrVarLocation = zarr.root(store).resolve(variableKey);
  const array = await zarr.open.v2(zarrVarLocation, { kind: "array" });

  const chunks = array.chunks;
  const shape = array.shape;

  const timeChunkSize = chunks[0];
  const stepChunkSize = chunks[1];
  const latChunkSize = chunks[2];
  const lonChunkSize = chunks[3];

  const timeC = Math.floor(timeIndex / timeChunkSize);
  const stepC = Math.floor(stepIndex / stepChunkSize);
  const chunkKey = `${variableKey}:${timeC}:${stepC}`;

  let registry = inflightPreloads.get(store);
  if (!registry) {
    registry = new Map();
    inflightPreloads.set(store, registry);
  }

  const existing = registry.get(chunkKey);
  if (existing) return existing;

  // Will keep this logic, even if lat/lon not currently chunked (latChunkCount==lonChunkCount==1)
  // Keeps extensibility for possible upstream spatial chunks.
  const latChunkCount = Math.ceil(shape[2] / latChunkSize);
  const lonChunkCount = Math.ceil(shape[3] / lonChunkSize);

  const op = (async () => {
    const tasks: Promise<void>[] = [];
    for (let latC = 0; latC < latChunkCount; latC++) {
      for (let lonC = 0; lonC < lonChunkCount; lonC++) {
        tasks.push(
          array.getChunk([timeC, stepC, latC, lonC], { signal }).then(() => {}),
        );
      }
    }
    await Promise.all(tasks);
  })();

  registry.set(chunkKey, op);
  try {
    await op;
  } finally {
    if (registry.get(chunkKey) === op) {
      registry.delete(chunkKey);
    }
  }
}
