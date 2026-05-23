from __future__ import annotations

from pathlib import Path

import pytest

from utils.config_utils import load_pipeline_config
from utils.ledger_utils import filter_ledger_keys_by_flow_id, load_inventory_ledger
from utils.ref_loader import ref_path_for_ledger_key

@pytest.mark.integration
def test_integration_ecmwf_ref_paths_exist():
    cfg = load_pipeline_config("utils/config.yaml")
    ledger = load_inventory_ledger(cfg["paths"]["ledger_path"])
    flow_id = cfg["datasets"]["ecmwf"]["flow_id"]

    keys = filter_ledger_keys_by_flow_id(ledger, flow_id)
    assert keys, "No ECMWF keys found in ledger"

    ref_path = ref_path_for_ledger_key(cfg, keys[0])
    assert Path(ref_path).exists()

@pytest.mark.integration
def test_integration_dpird_ref_paths_exist():
    cfg = load_pipeline_config("utils/config.yaml")
    ledger = load_inventory_ledger(cfg["paths"]["ledger_path"])
    flow_id = cfg["datasets"]["dpird"]["flow_id"]

    keys = filter_ledger_keys_by_flow_id(ledger, flow_id)
    assert keys, "No DPIRD keys found in ledger"

    ref_path = ref_path_for_ledger_key(cfg, keys[0])
    assert Path(ref_path).exists()
