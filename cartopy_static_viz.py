"""
Cartopy viewer for ECMWF + DPIRD using kerchunk ref stores.
Ledger drives dataset discovery; ref paths are derived by mapping
<ledger key>.nc -> <refs_root>/<ledger key>.nc.parq
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import tkinter as tk
from tkinter import ttk
import xarray as xr

import cartopy.crs as ccrs
import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

from utils.config_utils import load_pipeline_config, resolve_secrets
from utils.ledger_utils import (
    filter_ledger_keys_by_flow_id,
    load_inventory_ledger,
    ref_store_path_for_key,
)
from utils.storage_clients import build_storage_clients


CONFIG_PATH = Path("utils/config.yaml")


VAR_CMAPS = {
    "t2m": "coolwarm",
    "d2m": "coolwarm",
    "msl": "Spectral_r",
    "sh2": "GnBu",
    "swvl1": "YlGnBu",
    "cp": "Purples",
    "tp": "Blues",
    "lsp": "GnBu",
    "i10fg": "Reds",
}

PREFIX_CMAPS = {
    "z": "copper",
    "t": "coolwarm",
    "r": "YlGnBu",
    "q": "GnBu",
    "w": "RdBu_r",
}


def truncated_cmap(minval, maxval=0.75, name="Greys", n=256):
    base = plt.get_cmap(name, n)
    return mcolors.LinearSegmentedColormap.from_list(
        f"{name}_trunc", base(np.linspace(minval, maxval, n))
    )


CLOUD_CMAP = truncated_cmap(0, 0.75, "Greys")


def cmap_for(var: str) -> str:
    if var in VAR_CMAPS:
        return VAR_CMAPS[var]
    for prefix, cmap in PREFIX_CMAPS.items():
        if var.startswith(prefix):
            return cmap
    return "viridis"


def get_display_vars(ds, merge_var=True):
    raw_vars = [
        v
        for v in ds.data_vars
        if "latitude" in ds[v].dims and "longitude" in ds[v].dims
    ]
    if not merge_var:
        return raw_vars

    display_list = []
    processed_vs = set()

    u_vars = [v for v in raw_vars if v.startswith("u")]
    for u in u_vars:
        suffix = u[1:]
        v = "v" + suffix
        if v in raw_vars:
            display_list.append(f"wind{suffix}")
            processed_vs.add(v)
        else:
            display_list.append(u)

    for v in raw_vars:
        if not v.startswith("u") and v not in processed_vs:
            display_list.append(v)

    return display_list


def build_kerchunk_storage_options(fs) -> dict[str, object]:
    s3_opts = fs.storage_options.copy()
    s3_opts["asynchronous"] = False
    return {"remote_protocol": "s3", "remote_options": s3_opts}


def ledger_key_to_ref_path(refs_root: str | Path, key: str) -> Path:
    ref_path = ref_store_path_for_key(refs_root, key)
    if not ref_path.exists():
        raise FileNotFoundError(f"Ref store missing: {ref_path}")
    return ref_path


def list_keys_for_flow(ledger: dict[str, object], flow_id: str) -> list[str]:
    return filter_ledger_keys_by_flow_id(ledger, flow_id)


def ledger_key_to_date_str(key: str) -> str:
    parts = key.split("/")
    try:
        yyyy, mm, dd_nc = parts[-3], parts[-2], parts[-1]
        dd = dd_nc.split(".")[0]
        return f"{yyyy}-{mm}-{dd}"
    except (IndexError, ValueError) as exc:
        raise ValueError(f"Unable to parse date from ledger key: {key}") from exc


@dataclass
class DatasetSpec:
    name: str
    flow_id: str
    time_mode: str


class CartopyViewer(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ECMWF + DPIRD Cartopy Viewer")
        self.geometry("1400x1000")
        self.cbar = None
        self.is_playing = False
        self._ds_cache: dict[tuple[str, str], xr.Dataset] = {}
        self._cache_order: list[tuple[str, str]] = []
        self._max_cache_size = 2

        self.cfg = load_pipeline_config(CONFIG_PATH)
        access, secret = resolve_secrets(self.cfg)
        self.fs, _ = build_storage_clients(self.cfg, access, secret)
        self.storage_options = build_kerchunk_storage_options(self.fs)

        ledger_path = self.cfg["paths"]["ledger_path"]
        self.ledger = load_inventory_ledger(ledger_path)

        self.datasets = self._load_dataset_specs()
        self.dataset_names = [ds.name for ds in self.datasets]

        self._init_ui()

    def _load_dataset_specs(self) -> list[DatasetSpec]:
        ds_cfg = self.cfg.get("datasets", {})
        specs: list[DatasetSpec] = []
        for name, payload in ds_cfg.items():
            flow_id = payload.get("flow_id")
            time_mode = payload.get("time_mode", "metadata")
            if not flow_id:
                continue
            specs.append(DatasetSpec(name=name, flow_id=flow_id, time_mode=time_mode))
        if not specs:
            raise ValueError("No dataset specs found in config")
        return specs

    def _init_ui(self):
        top_control = ttk.Frame(self)
        top_control.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        ttk.Label(top_control, text="Dataset:").pack(side=tk.LEFT)
        self.dataset_var = tk.StringVar()
        self.dataset_cb = ttk.Combobox(
            top_control,
            textvariable=self.dataset_var,
            values=self.dataset_names,
            width=12,
            state="readonly",
        )
        self.dataset_cb.pack(side=tk.LEFT, padx=5)
        self.dataset_cb.bind("<<ComboboxSelected>>", self.on_dataset_change)

        ttk.Label(top_control, text="Date:").pack(side=tk.LEFT)
        self.date_var = tk.StringVar()
        self.date_cb = ttk.Combobox(
            top_control,
            textvariable=self.date_var,
            values=[],
            width=12,
            state="readonly",
        )
        self.date_cb.pack(side=tk.LEFT, padx=5)
        self.date_cb.bind("<<ComboboxSelected>>", self.on_date_change)

        ttk.Label(top_control, text="Variable").pack(side=tk.LEFT)
        self.var_var = tk.StringVar()
        self.var_cb = ttk.Combobox(top_control, textvariable=self.var_var, width=20)
        self.var_cb.pack(side=tk.LEFT, padx=5)
        self.var_cb.bind("<<ComboboxSelected>>", self.on_var_change)

        ttk.Label(top_control, text="Time:").pack(side=tk.LEFT, padx=(10, 0))
        self.time_slider = ttk.Scale(
            top_control,
            from_=0,
            to=0,
            orient=tk.HORIZONTAL,
            length=150,
            command=lambda e: self.update_plot(),
        )
        self.time_slider.pack(side=tk.LEFT, padx=5)
        self.time_label = ttk.Label(top_control, text="T=0", width=10)
        self.time_label.pack(side=tk.LEFT)

        ttk.Label(top_control, text="Step (+hr):").pack(side=tk.LEFT, padx=(10, 0))
        self.step_slider = ttk.Scale(
            top_control,
            from_=0,
            to=0,
            orient=tk.HORIZONTAL,
            length=150,
            command=lambda e: self.update_plot(),
        )
        self.step_slider.pack(side=tk.LEFT, padx=5)
        self.step_label = ttk.Label(top_control, text="S=0", width=8)
        self.step_label.pack(side=tk.LEFT)

        bottom_control = ttk.Frame(self)
        bottom_control.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=10)

        self.play_btn = ttk.Button(
            bottom_control, text="Play", command=self.toggle_play, width=10
        )
        self.play_btn.pack(side=tk.LEFT, padx=10)

        self.fig = plt.Figure(figsize=(12, 9), dpi=100)
        self.ax = self.fig.add_subplot(111, projection=ccrs.PlateCarree())
        self.canvas = FigureCanvasTkAgg(self.fig, master=self)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        if self.dataset_names:
            self.dataset_var.set(self.dataset_names[0])
            self.on_dataset_change()

        self.bind("<Left>", lambda e: self.change_step(-1))
        self.bind("<Right>", lambda e: self.change_step(1))

    def _get_dataset_spec(self) -> DatasetSpec:
        name = self.dataset_var.get()
        for ds in self.datasets:
            if ds.name == name:
                return ds
        raise ValueError(f"Dataset not found: {name}")

    def _get_ref_path_for_selected_date(self) -> Path:
        key = self._get_selected_ledger_key()
        return ledger_key_to_ref_path(self.cfg["paths"]["refs_root"], key)

    def _get_selected_ledger_key(self) -> str:
        ds = self._get_dataset_spec()
        keys = list_keys_for_flow(self.ledger, ds.flow_id)
        if ds.name == "ecmwf":
            date_str = self.date_var.get()
            if not date_str:
                raise ValueError("No ECMWF date selected")
            key_by_date = {ledger_key_to_date_str(k): k for k in keys}
            if date_str not in key_by_date:
                raise ValueError(f"Date not found in ledger: {date_str}")
            return key_by_date[date_str]
        return keys[-1]

    def _load_dataset(self):
        ds_spec = self._get_dataset_spec()
        key = self._get_selected_ledger_key()
        cache_key = (ds_spec.name, key)
        if cache_key in self._ds_cache:
            return self._ds_cache[cache_key]

        ref_path = self._get_ref_path_for_selected_date()
        ds = xr.open_dataset(
            str(ref_path),
            engine="kerchunk",
            storage_options=self.storage_options,
        )

        if cache_key in self._cache_order:
            self._cache_order.remove(cache_key)
        self._cache_order.append(cache_key)
        self._ds_cache[cache_key] = ds

        if len(self._cache_order) > self._max_cache_size:
            oldest = self._cache_order.pop(0)
            old_ds = self._ds_cache.pop(oldest, None)
            if old_ds is not None:
                old_ds.close()
        return ds

    def _apply_time_mode(self, ds, ds_spec: DatasetSpec):
        if ds_spec.time_mode == "force_utc" and "time" in ds:
            ds = ds.assign_coords(time=pd.to_datetime(ds.time.values, utc=True))
        return ds

    def on_dataset_change(self, event=None):
        ds_spec = self._get_dataset_spec()
        keys = list_keys_for_flow(self.ledger, ds_spec.flow_id)
        if ds_spec.name == "ecmwf":
            dates = [ledger_key_to_date_str(k) for k in keys]
            self.date_cb["values"] = dates
            if dates:
                self.date_var.set(dates[0])
            self.date_cb.configure(state="readonly")
        else:
            self.date_cb["values"] = []
            self.date_var.set("")
            self.date_cb.configure(state="disabled")
            self.step_label.config(text="")

        self._refresh_controls()

    def on_date_change(self, event=None):
        self._refresh_controls()

    def on_var_change(self, event=None):
        self.update_limits()
        self.update_plot()

    def _refresh_controls(self):
        ds_spec = self._get_dataset_spec()
        ds = self._load_dataset()
        ds = self._apply_time_mode(ds, ds_spec)

        if ds_spec.name == "ecmwf":
            vars_list = get_display_vars(ds)
        else:
            vars_list = list(ds.data_vars)

        self.var_cb["values"] = vars_list
        if vars_list:
            current_var = self.var_var.get()
            if current_var not in vars_list:
                self.var_var.set(vars_list[0])

        n_times = ds.sizes.get("time", 1)
        self.time_slider.configure(to=max(0, n_times - 1), value=0)

        if ds_spec.name == "ecmwf":
            n_steps = ds.sizes.get("step", 1)
            self.step_slider.configure(to=max(0, n_steps - 1), value=0)
            self.step_slider.configure(state="normal")
        else:
            self.step_slider.configure(to=0, value=0)
            self.step_slider.configure(state="disabled")

        self.update_limits()
        self.update_plot()

    def toggle_play(self):
        self.is_playing = not self.is_playing
        self.play_btn.config(text="Stop" if self.is_playing else "Play")
        if self.is_playing:
            self.play_sequence()

    def play_sequence(self):
        if not self.is_playing:
            return
        curr = float(self.step_slider.get())
        max_val = float(self.step_slider.cget("to"))
        if curr >= max_val:
            self.step_slider.set(0)
        else:
            self.step_slider.set(curr + 1)

        self.update_plot()
        self.after(350, self.play_sequence)

    def update_limits(self):
        ds_spec = self._get_dataset_spec()
        var = self.var_var.get()
        if not var:
            return

        ds = self._load_dataset()
        ds = self._apply_time_mode(ds, ds_spec)

        if ds_spec.name == "ecmwf" and var.startswith("wind"):
            suffix = var[4:]
            try:
                u = ds[f"u{suffix}"]
                v = ds[f"v{suffix}"]
                self.vmax = float(np.sqrt(u ** 2 + v ** 2).max().compute())
                self.vmin = 0
            except KeyError:
                self.vmin, self.vmax = 0, 200
        else:
            da = ds[var]
            self.vmin = float(da.min().compute())
            self.vmax = float(da.max().compute())
            if self.vmin == self.vmax:
                self.vmax += 1.0

    def change_step(self, delta):
        current = float(self.step_slider.get())
        max_val = float(self.step_slider.cget("to"))
        new_val = max(0, min(max_val, current + delta))
        self.step_slider.set(new_val)
        self.update_plot()

    def update_plot(self):
        if self.cbar is not None:
            self.cbar.remove()
            self.cbar = None
        self.ax.clear()

        ds_spec = self._get_dataset_spec()
        var = self.var_var.get()
        if not var:
            return

        ds = self._load_dataset()
        ds = self._apply_time_mode(ds, ds_spec)

        t_index = int(round(float(self.time_slider.get())))
        t_index = min(t_index, ds.sizes.get("time", 1) - 1)

        if ds_spec.name == "ecmwf":
            s_index = int(round(float(self.step_slider.get())))
            s_index = min(s_index, ds.sizes.get("step", 1) - 1)

            run_time_val = pd.to_datetime(ds.time.values[t_index])
            self.time_label.config(text=f"{run_time_val.hour:02d}Z")

            step_hours = int(ds.step.values[s_index]) if "step" in ds else 0
            self.step_label.config(text=f"+{step_hours}h")

            try:
                valid_dt = pd.to_datetime(
                    ds.valid_time.isel(time=t_index, step=s_index).values
                )
            except Exception:
                valid_dt = run_time_val + pd.Timedelta(hours=step_hours)

            u_name, v_name = None, None
            if var.startswith("wind"):
                suffix = var[4:]
                u_name, v_name = f"u{suffix}", f"v{suffix}"

            if u_name and v_name:
                u = ds[u_name].isel(time=t_index, step=s_index)
                v = ds[v_name].isel(time=t_index, step=s_index)
                unit_str = u.attrs.get("units", "GRIB_units")
                speed = np.sqrt(u.values ** 2 + v.values ** 2)
                step = max(1, u.shape[0] // 30)
                norm = mcolors.Normalize(vmin=self.vmin, vmax=self.vmax)
                q = self.ax.quiver(
                    u.longitude[::step],
                    u.latitude[::step],
                    u.values[::step, ::step],
                    v.values[::step, ::step],
                    speed[::step, ::step],
                    transform=ccrs.PlateCarree(),
                    scale=1000,
                    cmap="plasma",
                    pivot="middle",
                    norm=norm,
                )
                self.cbar = self.fig.colorbar(
                    q, ax=self.ax, orientation="vertical", shrink=0.8, pad=0.05
                )
                self.cbar.set_label(f"Wind speed ({unit_str})", labelpad=20)
                self.ax.set_title(
                    "Wind vectors (u/v)\n"
                    f"Forecast reference time: {run_time_val} | "
                    f"Valid time: {valid_dt} (+{step_hours}h)"
                )
                self.ax.coastlines()
                self.canvas.draw_idle()
                return

            da = ds[var].isel(time=t_index, step=s_index)
            long_name = da.attrs.get("long_name", var)
            unit_str = da.attrs.get("units", "GRIB_units")
            levels = np.linspace(self.vmin, self.vmax, 21)
            plot_kwargs = {
                "ax": self.ax,
                "transform": ccrs.PlateCarree(),
                "cmap": cmap_for(var),
                "add_colorbar": False,
                "vmin": self.vmin,
                "vmax": self.vmax,
                "levels": levels,
                "extend": "both",
            }
            if var in {"tcc", "lcc", "mcc", "hcc"}:
                plot_kwargs["cmap"] = CLOUD_CMAP
            mappable = da.plot.contourf(**plot_kwargs)
            self.cbar = self.fig.colorbar(
                mappable, ax=self.ax, orientation="vertical", shrink=0.8, pad=0.05
            )
            self.cbar.set_label(f"{long_name} ({unit_str})", labelpad=20)
            self.ax.coastlines()
            self.ax.set_title(
                f"{long_name}\nForecast reference time: {run_time_val} | "
                f"Valid time: {valid_dt} (+{step_hours}h)"
            )
            self.fig.subplots_adjust(left=0.05, right=0.88, top=0.92, bottom=0.05)
            self.canvas.draw_idle()
            return

        da = ds[var].isel(time=t_index)
        long_name = da.attrs.get("long_name", var)
        unit_str = da.attrs.get("units", "")

        self.time_label.config(text=str(pd.to_datetime(ds.time.values[t_index])))
        self.step_label.config(text="")

        lons = ds["lon"].values if "lon" in ds else ds["longitude"].values
        lats = ds["lat"].values if "lat" in ds else ds["latitude"].values

        if da.ndim == 1:
            values = da.values
        else:
            values = da.values.squeeze()

        sc = self.ax.scatter(
            lons,
            lats,
            c=values,
            cmap=cmap_for(var),
            s=16,
            transform=ccrs.PlateCarree(),
        )
        self.cbar = self.fig.colorbar(
            sc, ax=self.ax, orientation="vertical", shrink=0.8, pad=0.05
        )
        self.cbar.set_label(f"{long_name} ({unit_str})", labelpad=20)
        self.ax.coastlines()
        self.ax.set_title(f"{long_name} (DPIRD stations)")
        self.canvas.draw_idle()


if __name__ == "__main__":
    app = CartopyViewer()
    app.mainloop()
