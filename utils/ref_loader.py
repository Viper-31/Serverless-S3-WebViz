from __future__ import annotations

from pathlib import Path
from typing import Any

import xarray as xr

from utils.ledger_utils import filter_ledger_keys_by_flow_id, load_inventory_ledger, ref_store_path_for_key


def build_kerchunk_storage_options(cfg: dict[str, Any], fs) -> dict[str, Any]:
    s3_opts = fs.storage_options.copy()
    s3_opts["asynchronous"] = False
    return {"remote_protocol": "s3", "remote_options": s3_opts}


def load_dataset_from_ledger(
    *,
    cfg: dict[str, Any],
    fs,
    flow_id: str,
    key: str | None = None,
) -> xr.Dataset:
    ledger = load_inventory_ledger(cfg["paths"]["ledger_path"])
    keys = filter_ledger_keys_by_flow_id(ledger, flow_id)
    if key is None:
        key = keys[-1]
    if key not in keys:
        raise ValueError(f"Ledger key not found for flow_id={flow_id}: {key}")

    refs_root = cfg["paths"]["refs_root"]
    ref_path = ref_store_path_for_key(refs_root, key)
    if not ref_path.exists():
        raise FileNotFoundError(f"Ref store missing: {ref_path}")

    storage_options = build_kerchunk_storage_options(cfg, fs)
    return xr.open_dataset(str(ref_path), engine="kerchunk", storage_options=storage_options)


def list_ledger_keys_for_flow(cfg: dict[str, Any], flow_id: str) -> list[str]:
    ledger = load_inventory_ledger(cfg["paths"]["ledger_path"])
    return filter_ledger_keys_by_flow_id(ledger, flow_id)


def ref_path_for_ledger_key(cfg: dict[str, Any], key: str) -> Path:
    ref_path = ref_store_path_for_key(cfg["paths"]["refs_root"], key)
    if not ref_path.exists():
        raise FileNotFoundError(f"Ref store missing: {ref_path}")
    return ref_path
