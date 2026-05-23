from __future__ import annotations

import argparse
from pathlib import Path

import h5py
import hdf5plugin
import xarray as xr


def build_blosc_zstd_encoding(ds: xr.Dataset, chunk_map: dict[str, int], complevel: int) -> dict:
    encoding = {}
    blosc_filter = hdf5plugin.Blosc(
        cname="zstd",
        clevel=complevel,
        shuffle=hdf5plugin.Blosc.SHUFFLE,
    )

    for name in ds.data_vars:
        var = ds[name]
        chunks = tuple(chunk_map.get(dim, var.sizes[dim]) for dim in var.dims)
        encoding[name] = {
            "compression": blosc_filter["compression"],
            "compression_opts": blosc_filter["compression_opts"],
            "chunksizes": chunks,
        }

    return encoding


def print_hdf5_filters(path: Path, variable_names: list[str]) -> None:
    with h5py.File(path, "r") as h5:
        for name in variable_names:
            if name not in h5:
                continue

            dataset = h5[name]
            plist = dataset.id.get_create_plist()
            print(f"{name}: chunks={dataset.chunks}")

            for index in range(plist.get_nfilters()):
                filter_id, flags, client_data, filter_name = plist.get_filter(index)
                print(
                    f"{name}: filter_id={filter_id}, flags={flags}, "
                    f"client_data={client_data}, filter_name={filter_name!r}"
                )


def parse_args() -> argparse.Namespace:
    script_dir= Path(__file__).resolve().parent
    default_output = script_dir / "blosc_zstd_dpird_slice.nc"

    parser = argparse.ArgumentParser(
        description="Create a tiny DPIRD NetCDF fixture compressed with HDF5 Blosc-zstd."
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to DPIRD_final_stations*.nc on the local machine.",
    )
    parser.add_argument(
        "--output",
        default= default_output,
        type=Path,
        help="Output fixture path.",
    )
    parser.add_argument("--station-count", type=int, default=2)
    parser.add_argument("--time-count", type=int, default=8)
    parser.add_argument("--station-chunk", type=int, default=1)
    parser.add_argument("--time-chunk", type=int, default=4)
    parser.add_argument("--complevel", type=int, default=5)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    variable_names = []

    with xr.open_dataset(args.input, engine="h5netcdf") as ds:
        selectors = {}
        if "station" in ds.dims:
            selectors["station"] = slice(0, min(args.station_count, ds.sizes["station"]))
        if "time" in ds.dims:
            selectors["time"] = slice(0, min(args.time_count, ds.sizes["time"]))

        tiny = ds.isel(selectors) if selectors else ds
        tiny = tiny.copy()
        tiny.attrs = {}

        chunk_map = {}
        if "station" in tiny.dims:
            chunk_map["station"] = min(args.station_chunk, tiny.sizes["station"])
        if "time" in tiny.dims:
            chunk_map["time"] = min(args.time_chunk, tiny.sizes["time"])

        tiny = tiny.chunk(chunk_map)
        encoding = build_blosc_zstd_encoding(tiny, chunk_map, args.complevel)
        variable_names = list(tiny.data_vars)

        tiny.to_netcdf(
            args.output,
            engine="h5netcdf",
            format="NETCDF4",
            encoding=encoding,
        )

    print(f"wrote {args.output}")
    print(f"dropped dataset attrs only; variable attrs preserved")
    print(f"chunk_map={chunk_map}, complevel={args.complevel}")
    print_hdf5_filters(args.output, variable_names[:3])


if __name__ == "__main__":
    main()
