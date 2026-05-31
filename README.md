# Serverless-S3-WebViz

A serverless, client-side web portal for real-time visualisation of virtualised datasets on S3 using Kerchunk and direct HTTP range queries.

## Overview
- TypeScript (zarrita.js) parses the Kerchunk index to resolve byte ranges for requested chunks.
- The browser issues HTTP GET range requests using the .parq references under `acacia_refs_staging/refs/`.
- `acacia_refs_staging/_state/inventory_ledger.json` contains a global index of all the objects on the Acacia S3-compatible jchew:webviz bucket
- Chunks are decompressed client-side using numcodecs.
- No backend proxy: do not expose S3 keys on the frontend.
  - Prefer anonymous kwargs to read the Acacia S3 bucket.
  - If user credentials are required, store them in browser `sessionStorage` only.

## Dev workflow
- Use uv for Python tooling.
- Install Prettier with pnpm:
  - `pnpm add --save-dev --save-exact prettier`

## Architecture diagram
```
VirtualiZarr-Kerchunk JSON  refs
        ↓
Zarrita.js JSON ReferenceStore
        ↓
CarbonPlan ZarrLayer
        ↓
MapLibre GL JS
        ↓
interactive browser map
```

## Reference
https://charles-turner-1.github.io/personal-homepage/#/projects/zarr-data-streamer

https://zarr-layer.demo.carbonplan.org/
