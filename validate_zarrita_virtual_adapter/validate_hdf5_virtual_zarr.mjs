import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

import { get, open, root } from "zarrita";
import { FetchStore } from "@zarrita/storage";
import { HdfStore } from "hdf5-as-virtual-zarr";

const fixturePath = resolve(process.env.FIXTURE_PATH ?? "./blosc_zstd_dpird_slice.nc");
const variablePath = process.env.VAR_PATH ?? "airTemperature";
const patchInvalidBlosc = process.env.PATCH_INVALID_BLOSC !== "0";
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function getContentType(filePath) {
  if (extname(filePath) === ".json") return "application/json";
  return "application/octet-stream";
}

/**
 * Serves a local file over HTTP with Range request support.
 * Why: Zarrita's FetchStore requires a standard HTTP server that supports partial byte range
 * requests to efficiently fetch specific Zarr chunks from the monolithic NetCDF/HDF5 file,
 * mimicking how it would behave in a cloud storage bucket.
 */
class LocalRangeServer {
  constructor() {
    this.server = null;
  }

  async start(filePath) {
    this.server = createServer((req, res) => {
      const fileSize = statSync(filePath).size;
      const rangeHeader = req.headers.range;

      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Type", getContentType(filePath));

      if (!rangeHeader) {
        res.writeHead(200, { "Content-Length": fileSize });
        createReadStream(filePath).pipe(res);
        return;
      }

      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
        res.end();
        return;
      }

      const startByte = Number(match[1]);
      const endByte = match[2] ? Number(match[2]) : fileSize - 1;

      if (startByte >= fileSize || endByte >= fileSize || startByte > endByte) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Length": endByte - startByte + 1,
        "Content-Range": `bytes ${startByte}-${endByte}/${fileSize}`,
      });
      createReadStream(filePath, { start: startByte, end: endByte }).pipe(res);
    });

    return new Promise((resolveServer, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        const { port } = this.server.address();
        const fileName = filePath.split(/[\\/]/).pop();
        resolveServer(`http://127.0.0.1:${port}/${fileName}`);
      });
    });
  }

  close() {
    if (this.server) {
      this.server.close();
    }
  }
}

/**
 * Intercepts and corrects the `.zarray` compressor metadata.
 * Why: `hdf5-as-virtual-zarr` maps HDF5 Blosc `client_data[3]` to `clevel`. 
 * However, `hdf5plugin` stores the uncompressed chunk size there (e.g., 32). 
 * This patches `clevel` back to a valid range to prevent decompression errors in the client.
 */
function patchZarrayMetadata(metadataKey, rawMetadataBytes) {
  if (!patchInvalidBlosc || metadataKey !== `/${variablePath}/.zarray` || !rawMetadataBytes) {
    return rawMetadataBytes;
  }

  const zarrayConfig = JSON.parse(textDecoder.decode(rawMetadataBytes));
  const compressor = zarrayConfig.compressor;

  if (compressor?.id !== "blosc" || compressor.clevel <= 9) {
    return rawMetadataBytes;
  }

  // Fix the invalid clevel and reset blocksize.
  compressor.blocksize = 0;
  compressor.clevel = Number(process.env.BLOSC_CLEVEL ?? 5);
  compressor.shuffle = Number(process.env.BLOSC_SHUFFLE ?? compressor.shuffle ?? 1);
  compressor.cname = process.env.BLOSC_CNAME ?? compressor.cname ?? "zstd";

  console.log(`patched ${metadataKey} compressor=${JSON.stringify(compressor)}`);
  return textEncoder.encode(JSON.stringify(zarrayConfig));
}

/**
 * Creates a middleware proxy over the underlying HDF store.
 * Why: We need to intercept the reading of `.zarray` metadata dynamically 
 * so we can apply our Blosc metadata patch before Zarrita attempts to parse and use it.
 */
function wrapPatchedStore(originalStore) {
  return {
    async get(metadataKey, opts) {
      const rawMetadataBytes = await originalStore.get(metadataKey, opts);
      return patchZarrayMetadata(metadataKey, rawMetadataBytes);
    },
  };
}

async function main() {
  statSync(fixturePath);

  const localServer = new LocalRangeServer();
  const serverUrl = await localServer.start(fixturePath);
  
  try {
    console.log(`fixture=${fixturePath}`);
    console.log(`url=${serverUrl}`);
    console.log(`variable=${variablePath}`);

    const internalFetchStore = new FetchStore(serverUrl);
    const hdfVirtualStore = await HdfStore.fromStore(internalFetchStore);
    const patchedVirtualStore = wrapPatchedStore(hdfVirtualStore);

    for (const metadataKey of [`/${variablePath}/.zarray`, `/${variablePath}/zarr.json`, `/${variablePath}/.zattrs`]) {
      const rawStoreBytes = await hdfVirtualStore.get(metadataKey);
      if (rawStoreBytes) {
        console.log(`raw ${metadataKey}=${textDecoder.decode(rawStoreBytes)}`);
      } else {
        console.log(`raw ${metadataKey}=<missing>`);
      }

      const effectiveBytes = await patchedVirtualStore.get(metadataKey);
      if (effectiveBytes) {
        console.log(`effective ${metadataKey}=${textDecoder.decode(effectiveBytes)}`);
      } else {
        console.log(`effective ${metadataKey}=<missing>`);
      }
    }

    const storeRoot = root(patchedVirtualStore);
    const zarrArray = await open(storeRoot.resolve(variablePath), { kind: "array" });

    console.log(`opened shape=${JSON.stringify(zarrArray.shape)} dtype=${zarrArray.dtype}`);

    const firstChunkData = await zarrArray.getChunk(zarrArray.shape.map(() => 0));
    console.log(`getChunk ok shape=${JSON.stringify(firstChunkData.shape)}`);

    const firstScalarValue = await get(zarrArray, zarrArray.shape.map(() => 0));
    console.log("scalar get ok");
    console.log(firstScalarValue);
  } finally {
    localServer.close();
  }
}

main().catch((error) => {
  console.error("validation failed");
  console.error(error);
  process.exitCode = 1;
});
