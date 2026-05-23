# Blosc-zstd NetCDF Virtual-Zarr Validation

This isolated spike validates whether a tiny HDF5/NetCDF file written with `hdf5plugin.Blosc(cname="zstd")` can be read through `hdf5-as-virtual-zarr` and `zarrita` over HTTP byte ranges.

Run from the repository root in Windows Git Bash.

1. Install the isolated JS dependencies:

```bash
cd validate_zarrita_virtual_adapter
npm install
```

2. Create the tiny DPIRD fixture. Replace the input path with your local DPIRD file path:

```bash
python create_blosc_zstd_dpird_slice.py --input "C:/Users/John/OneDrive/Desktop/ICRAR/The_work/ICRAR-Weather-Forcasting/dataset_DPIRD_utc0_clean/DPIRD_final_stations_utc0.nc"
```

3. Validate the browser-style read path through a local range-request server:

```bash
VAR_PATH=airTemperature node validate_hdf5_virtual_zarr.mjs
```

The harness prints both the raw virtual-Zarr metadata synthesized by
`hdf5-as-virtual-zarr` and the effective metadata passed to `zarrita`. By default
it patches invalid Blosc metadata like `clevel: 32` to `clevel: 5` so the next
failure point is the actual chunk decode.

To reproduce the unpatched failure:

```bash
PATCH_INVALID_BLOSC=0 VAR_PATH=airTemperature node validate_hdf5_virtual_zarr.mjs
```

To override the patched compressor settings:

```bash
BLOSC_CLEVEL=5 BLOSC_SHUFFLE=1 BLOSC_CNAME=zstd VAR_PATH=airTemperature node validate_hdf5_virtual_zarr.mjs
```

If `airTemperature` is not the correct HDF5/Zarr path, rerun with the correct variable path:

```bash
VAR_PATH=<variable_name> node validate_hdf5_virtual_zarr.mjs
```

Paste the full output back into the chat.
