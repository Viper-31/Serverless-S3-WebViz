from __future__ import annotations

import json

import pytest

from utils.ledger_utils import (
    filter_ledger_keys_by_flow_id,
    load_inventory_ledger,
    ref_store_path_for_key,
)


def _write_ledger(tmp_path, payload: dict):
    path = tmp_path / "ledger.json"
    path.write_text(json.dumps(payload))
    return path


def test_load_inventory_ledger_requires_objects(tmp_path):
    path = _write_ledger(tmp_path, {"objects": {}})
    with pytest.raises(ValueError, match="Ledger objects must be a non-empty mapping"):
        load_inventory_ledger(path)


def test_filter_ledger_keys_by_flow_id_filters_and_sorts(tmp_path):
    payload = {
        "objects": {
            "vz_kerchunk/ECMWF/2024/01/02.nc": {"flow_id": "ecmwf_weekly_nc"},
            "vz_kerchunk/ECMWF/2024/01/09.nc": {"flow_id": "ecmwf_weekly_nc"},
            "vz_kerchunk/DPIRD/DPIRD.nc": {"flow_id": "dpird_final_singleton"},
        }
    }
    path = _write_ledger(tmp_path, payload)
    ledger = load_inventory_ledger(path)

    keys = filter_ledger_keys_by_flow_id(ledger, "ecmwf_weekly_nc")
    assert keys == [
        "vz_kerchunk/ECMWF/2024/01/02.nc",
        "vz_kerchunk/ECMWF/2024/01/09.nc",
    ]


def test_filter_ledger_keys_by_flow_id_raises_when_empty(tmp_path):
    payload = {"objects": {"vz_kerchunk/ECMWF/2024/01/02.nc": {"flow_id": "x"}}}
    path = _write_ledger(tmp_path, payload)
    ledger = load_inventory_ledger(path)

    with pytest.raises(ValueError, match="flow_id"):
        filter_ledger_keys_by_flow_id(ledger, "ecmwf_weekly_nc")


def test_ref_store_path_for_key_maps_nc_to_parq(tmp_path):
    refs_root = tmp_path / "refs"
    key = "vz_kerchunk/ECMWF/2024/01/02.nc"
    path = ref_store_path_for_key(refs_root, key)
    assert str(path).endswith("vz_kerchunk/ECMWF/2024/01/02.nc.parq")


def test_ref_store_path_for_key_rejects_non_nc(tmp_path):
    refs_root = tmp_path / "refs"
    with pytest.raises(ValueError, match="NetCDF"):
        ref_store_path_for_key(refs_root, "vz_kerchunk/ECMWF/2024/01/02.grib")
