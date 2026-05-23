from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_inventory_ledger(path: str | Path) -> dict[str, Any]:
    ledger_path = Path(path)
    if not ledger_path.exists():
        raise FileNotFoundError(f"Ledger not found: {ledger_path}")

    with ledger_path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise ValueError("Ledger file must contain a JSON object at the root")

    objects = payload.get("objects")
    if not isinstance(objects, dict) or not objects:
        raise ValueError("Ledger objects must be a non-empty mapping")

    return payload


def ref_store_path_for_key(refs_root: str | Path, key: str) -> Path:
    if not key.endswith(".nc"):
        raise ValueError(f"Ledger key does not look like NetCDF: {key}")
    refs_root = Path(refs_root)
    return refs_root / f"{key}.parq"


def filter_ledger_keys_by_flow_id(ledger: dict[str, Any], flow_id: str) -> list[str]:
    objects = ledger.get("objects", {})
    keys: list[str] = []
    for key, meta in objects.items():
        if meta.get("flow_id") == flow_id:
            keys.append(key)
    if not keys:
        raise ValueError(f"No ledger keys found for flow_id: {flow_id}")
    return sorted(keys)
