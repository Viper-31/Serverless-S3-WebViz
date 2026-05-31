# ZarrDataStreamer Draft
This is a rough draft of the intended direction, do not use this as docs for the current state of the project

## What this does

Renders a MapLibre GL map in `ZarrDataStreamer.vue` that streams SST data directly
from a bundled Kerchunk reference file (`src/assets/ref-01deg.json`) without any
backend. The pipeline is:

```
ref-01deg.json  (Kerchunk/VirtualiZarr reference)
      │
      ▼
ReferenceStore.fromSpec()   (@zarrita/storage/ref)
      │   maps Zarr chunk keys → HTTP Range requests
      ▼
ZarrLayer                   (@carbonplan/zarr-layer)
      │   WebGL custom layer; issues Range GETs, decodes in-browser
      ▼
maplibre-gl Map             (MapLibre GL JS)
```

## Packages used

| Package                  | Role                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `maplibre-gl`            | Map renderer                                                    |
| `@carbonplan/zarr-layer` | WebGL Zarr custom layer for MapLibre/Mapbox                     |
| `zarrita`                | Zarr v2/v3 JS implementation (peer dep of zarr-layer)           |
| `@zarrita/storage`       | Storage backends; we use the `ref` subpath for `ReferenceStore` |

## Dataset

`acacia_refs_staging/refs` are Kerchunk references catalogue for 24 months of the ECMWF 0.1° operational forecast and DPIRD weather station observations, stored on Pawsey Acacia (S3).


## Bumps in the road

### 1. Kerchunk refs contain `s3://` URIs — resolved against AWS by default

`ReferenceStore` (and the underlying `fetch_range`) resolves `s3://` URIs against
`https://s3.amazonaws.com`, but the data lives on Pawsey Ceph:

```
https://projects.pawsey.org.au/<bucket>/<key>
```

The ref JSON has `s3://01deg/output.../iceh.....nc` entries.

Fix: rewrite all `s3://` URIs before passing to `fromSpec`:

```ts
v[0].replace(/^s3:\/\//, "https://projects.pawsey.org.au/");
```

i.e. `s3:\/\/webviz\/DPIRD\/dpird_wa_stations.nc` → `https://projects.pawsey.org.au/webviz/...`.

This also means CORS must be enabled on the Pawsey Ceph bucket endpoint
(`https://projects.pawsey.org.au`), not on an AWS bucket — which is the endpoint
for which CORS headers were actually configured.

