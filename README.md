# Serverless-S3-WebViz

A serverless, browser based web portal for interactive visualisation of virtualised geospatial datasets stored in object storage.

The application runs entirely on the client: it loads Kerchunk-style reference metadata, resolves byte ranges for requested chunks, fetches data directly over HTTP range requests, and renders raster layers in the browser without a backend proxy.

## Overview

This project is a Svelte-Vite application designed to explore terabyte-large remote datasets with a lightweight, serverless deployment model.

Core ideas:

- The browser loads reference metadata from `web-app/public/refs/`.
- Requested chunks are fetched directly within HTTP range requests
- Chunks decoding happens client-side
- Raster data is rendered onto interactive map
- No backend proxy required for normal operation

The current app experience is centered on interactive map exploration with:

- calendar date selection
- temporal navigation
- variable selection
- display controls for color map and value range

## How it works

```text
inventory_ledger.json
  -> reference catalog selection
  -> client-side zarrita reference store
  -> HTTP range requests for chunk bytes
  -> client-side decode through @carbonplan/zarr-layer
  -> raster layer rendering
  -> interactive map on MapLibre-gl
```

## Tech stack

- Svelte 4
- Vite
- Typescript
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)
- [@carbonplan/zarr-layer](https://github.com/carbonplan/zarr-layer/tree/main)
- [zarrita](https://github.com/manzt/zarrita.js/tree/main)
- [@zarrita/storage](https://github.com/manzt/zarrita.js/tree/c5d7a7df397f7e953cbacd1868a94519ba37e4a7/packages/%40zarrita-storage)

## Project Structure

```
.
├── package.json                # workspace-level scripts
├── web-app/
│   ├── package.json            # app-level scripts and dependencies
│   ├── public/
│   │   ├── _state/
│   │   │   └── inventory_ledger.json
│   │   └── refs/               # public reference JSON files
│   └── src/
│       ├── App.svelte          # main app shell
│       ├── app/                # state and controller orchestration logic
│       ├── datasets/           # dataset catalog and schema logic
│       ├── features/           # sidebar, dataset-specific controls
│       ├── rendering-layer/    # map rendering
│       └── zarr-store/         # reference store, caching, metadata
└── .github/workflows/          # CI and GitHub Pages deployment
```

## Development

Prerequisites:

- Node.js 20+
- pnpm 11+
- From the repo root:

```bash
pnpm install
pnpm dev
```

Useful scripts:

```bash
pnpm build
pnpm check
pnpm test
pnpm test:cov
pnpm test:online
pnpm format
pnpm format:check
```

## Deployment

The web app is deployed via GitHub Pages.

Deployment workflow:

- build the app from web-app/
- publish the generated web-app/dist output
- serve static assets, reference JSON, and frontend code directly

This architecture keeps hosting simple and avoids introducing an application server for data access.
