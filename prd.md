# Serverless S3 Weather WebViz PRD

## Problem Statement

The old FlaskApp depends on Flask, server-side S3 credentials, xarray/dask, full-file or backend-mediated NetCDF access, Leaflet rendering, and upload flows. The target product should instead be a serverless Svelte-Vite web app that reads public Acacia/Pawsey-hosted weather datasets directly from the browser using Kerchunk JSON references, HTTP byte ranges, WebWorkers, zarrita.js, and MapLibre rendering.

The existing architectures clash in three ways:

- The `dwer-csi-streamer` reference implementation proves the target browser-first architecture: Kerchunk JSON references, zarrita.js `ReferenceStore.fromSpec()`, MapLibre GL, `@carbonplan/zarr-layer`, and no backend proxy.
- This repository's current Acacia references are Kerchunk JSONs under `acacia_refs_staging/refs/**/*.json`.
- The legacy FlaskApp provides useful UI and domain behavior, but its backend-mediated data model should be retired.

## Solution

Build a Svelte-Vite client that preserves the useful FlaskApp UX concepts while replacing backend data access with browser-safe virtual Zarr reads.

The main architectural adjustment is to follow the `dwer-csi-streamer` pattern: load Kerchunk JSON references in the client, rewrite any embedded `s3://` object URIs to the Pawsey public HTTPS endpoint, then pass the rewritten spec into `ReferenceStore.fromSpec()`.

The intended runtime architecture is:

```text
Acacia public bucket
  |
  | GET/HEAD/Range, anonymous, CORS-enabled
  v
Served or bundled Kerchunk JSON references
  |
  | rewrite s3:// refs to https://projects.pawsey.org.au/...
  v
Svelte-Vite app
  |
  | zarrita + @zarrita/storage/ref + withByteCaching LRU + worker-managed reads
  v
MapLibre GL
  |
  | ECMWF grid via ZarrLayer
  | DPIRD stations via custom MapLibre layers
  v
Interactive map, sliders, overlays, graph views
```

## User Stories

1. As a weather portal user, I want to select DPIRD or ECMWF datasets or both at the same time with option to overlay 1 or dual datasets on the map render

2. As a user, I want to choose a variable, so that I can inspect temperature, rainfall, wind, pressure, or other weather fields.  

3. As a user, I want a time slider seperate for DPIRD/ECMWF respectively, so that I can scrub through available forecast or observation times.

4. As a user, I want an ECMWF step slider, so that I can inspect forecast lead times independently from base time.

5. As a user, I want DPIRD station markers on a map, so that I can inspect station-based observations.

6. As a user, I want ECMWF gridded fields rendered as a map layer, so that I can visualize spatial forecasts.

7. As a user, I want a play button, that will increment DPIRD 'time' dimension by 1hr, and equivalent +1hr for ECMWF forecast 'step' dimension. Play until end of 'step' timedelta dimension.

8.  As a user, I want wind speed and direction handled cleanly, so that wind arrows or vectors are meaningful.

9.  As a user, I want colorbars and units, so that rendered values are interpretable.

10. As a user, I want responsive loading states, so that I know when byte-range reads are in progress.

11. As a user, I want browser-side LRU byte caching, so that repeated slider movement does not refetch identical byte ranges or decoded chunks unnecessarily.

12. As a user, I want the app to work without Acacia credentials, so that public-read datasets can be viewed securely.

13. As a maintainer, I want no backend proxy, so that deployment remains static and serverless.

14. As a maintainer, I want the data-reading code isolated behind a lean interface, so that Kerchunk JSON loading, URI rewriting, caching, and worker reads remain replaceable.

15. As a maintainer, I want all `s3://` references normalized before `ReferenceStore.fromSpec()`, so that browser range requests target Pawsey Ceph instead of AWS S3 defaults.

16. As a maintainer, I want WebWorker data access, so that decoding, coordinate parsing, and array slicing do not block the UI.

17. As a maintainer, I want MapLibre layer controllers separated from Svelte UI state, so that map rendering remains testable and replaceable.

18. As a maintainer, I want generated catalog metadata, so that the frontend does not discover huge object trees at runtime.

19. As a maintainer, I want the UI model to preserve the legacy FlaskApp's proven domain controls, so that migration does not discard useful weather-analysis workflows.

20. As a maintainer, I want fixed-width base64 string coordinates such as `station` and `code` decoded consistently in TypeScript, so that DPIRD station labels and codes can be displayed without backend preprocessing.

21. As a maintainer, I want clear separation between DPIRD station rendering and ECMWF grid rendering, so that each data shape is handled by the right rendering strategy.

## Implementation Decisions

- Use Svelte-Vite as the main app shell.

- Use MapLibre GL as the only map engine; retire Leaflet from the migrated app.

- Use `@carbonplan/zarr-layer` for ECMWF-style gridded arrays with dimensions like `(time, step, latitude, longitude)`.

- Use custom MapLibre circle/symbol layers for DPIRD station arrays with dimensions like `(station, time)`; `ZarrLayer` is not the right primary renderer for station-major point data.

- Keep Acacia access anonymous; do not place S3 keys in frontend code.

- Treat `acacia_refs_staging/_state/inventory_ledger.json` as the dataset catalog seed.

- Treat Kerchunk JSON references as the runtime source of truth for `ReferenceStore.fromSpec()`.

- Recommended MVP path: serve or bundle Kerchunk JSON reference specs and load them directly in the frontend, following the `dwer-csi-streamer` pattern.

- Before constructing a `ReferenceStore`, rewrite every embedded `s3://` URI to the Pawsey public HTTPS endpoint. For this project, references pointing at the public `webviz` bucket should resolve to `https://projects.pawsey.org.au/webviz/...` rather than AWS S3.

- Put all low-level virtual data access behind a deep module like `VirtualDatasetClient`, including Kerchunk JSON loading, Pawsey URI rewriting, cache wrapping, and worker communication.

- Put worker messaging behind a stable API such as `initDataset`, `getMetadata`, `getGridSlice`, `getStationFrame`, `getStationSeries`, and `getDecodedCoordinates`.

- Preserve FlaskApp concepts: dataset mode, variable selection, time controls, step controls, overlay mode, opacity, wind handling, colorbars, playback, and station graph mode.

- Retire FlaskApp concepts: upload-to-server workflows, server-side S3 credentials, backend xarray endpoints, full-file download assumptions, and Leaflet-specific rendering code.

- Validate codec support early for the Kerchunk JSON metadata, especially `shuffle` and `zlib` compression filters.

- Use zarrita v0.7 APIs and extensions where appropriate: `zarr.open`, `zarr.select`, `withConsolidatedMetadata`, `withRangeCoalescing`, and `withByteCaching`.

- Wrap remote reference/data access with a simple bounded LRU byte cache using zarrita's `withByteCaching` extension. The cache should cap entries or bytes rather than using an unbounded `Map`.

- Keep the `dwer-csi-streamer` flow as the reference pattern for gridded map layers: Kerchunk JSON spec, `s3://` URI rewrite, `ReferenceStore.fromSpec()`, Zarr array selection, `ZarrLayer`, and MapLibre custom layer integration.

- Implement a TypeScript helper conceptually named `decodeBase64FixedUTFLE` for fixed-width Unicode coordinate arrays embedded in Kerchunk refs. The helper should strip the `base64:` prefix, decode the bytes, read little-endian 32-bit code points, stop each string at the first zero code point, and return an array of JavaScript strings.

- Hardcode the fixed-width coordinate decoding for known DPIRD coordinates: decode `station/0` with 22 characters per item and `code/0` with 5 characters per item. The PRD should describe this behavior but should not inline implementation code.

## Testing Decisions

- First tests should target the Kerchunk JSON loader and Pawsey URI rewrite because incorrect `s3://` resolution would silently send browser range requests to AWS instead of Pawsey Ceph.

- Worker tests should verify request/response behaviour, not implementation details.

- Dataset catalog tests should verify that DPIRD and ECMWF metadata become stable UI options.

- Map controller tests should verify layer creation/update/removal contracts without requiring real Acacia data.

- Add one small browser-readable Kerchunk JSON fixture before wiring the full Acacia/Pawsey `webviz` bucket.

- Test DPIRD and ECMWF separately because their array shapes and rendering paths differ.

- Test anonymous HTTP range behavior against a small public Pawsey fixture before relying on the full `webviz` bucket.

- Add unit tests for `decodeBase64FixedUTFLE` using representative base64 fixed-width Unicode strings for `station` and `code`.

- Add cache tests proving the custom `withByteCaching` cache evicts least-recently-used entries and does not grow unbounded.

## Out of Scope

- No Flask backend migration.

- No user-uploaded NetCDF files in the serverless MVP.

- No private Acacia credentials in browser code.

- No full replacement of VirtualiZarr/Kerchunk generation pipelines; upstream Kerchunk JSON generation is assumed to exist.

## Further Notes

The current `web-app` is still the starter Svelte scaffold and has no MapLibre, zarrita, zarr-layer, or worker data-access implementation yet.

When implementation starts, package installs and checks should be run from the Windows environment because the WSL agent cannot use `.exe` tools like `pnpm`, `uv`, or `python`.

## Target Reference Implementation

The primary reference implementation is now `charles-turner-1/dwer-csi-streamer`. The relevant design pattern is a static/serverless client that loads Kerchunk JSON, rewrites `s3://` object references to Pawsey HTTPS URLs, constructs a zarrita `ReferenceStore`, renders gridded data through `@carbonplan/zarr-layer`, and exposes a compact map-first UI with time, opacity, color scale, loading, and error controls.

## Relevant Links

- Charles Turner's `dwer-csi-streamer` live client: https://charles-turner-1.github.io/dwer-csi-streamer/#/view-data

- Charles Turner's `dwer-csi-streamer` repository: https://github.com/charles-turner-1/dwer-csi-streamer/tree/main

- `dwer-csi-streamer` zarr-map implementation notes: https://github.com/charles-turner-1/dwer-csi-streamer/blob/main/zarr-map.readme.md

- zarrita documentation: https://zarrita.dev/

- zarrita v0.7 migration guide: https://zarrita.dev/migration/v0.7.html#migrating-to-zarrita-v0-7-0

- zarrita storage package docs, including `ReferenceStore`: https://zarrita.dev/packages/storage.html

- zarrita store extensions docs, including `withByteCaching`, range coalescing, and extension patterns: https://zarrita.dev/store-extensions.html

- zarrita cookbook, including consolidated metadata, range coalescing, and byte caching: https://zarrita.dev/cookbook.html

- Kerchunk reference specification, especially JSON `refs` entries and `[url, offset, length]` byte-range references: https://fsspec.github.io/kerchunk/spec

- VirtualiZarr usage docs, including Kerchunk JSON generation and reference handling in Python: https://virtualizarr.readthedocs.io/en/stable/usage.html

- VirtualiZarr API docs: https://virtualizarr.readthedocs.io/en/stable/api/virtualizarr.html

- `@carbonplan/zarr-layer` demo: https://zarr-layer.demo.carbonplan.org/

- MapLibre GL JS documentation: https://maplibre.org/maplibre-gl-js/docs/
