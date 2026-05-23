from __future__ import annotations

import pytest

from utils.ref_loader import ref_path_for_ledger_key


def test_ref_path_for_ledger_key_fails_when_missing(tmp_path):
    refs_root = tmp_path / "refs"
    refs_root.mkdir()
    cfg = {"paths": {"refs_root": str(refs_root)}}

    with pytest.raises(FileNotFoundError, match="Ref store missing"):
        ref_path_for_ledger_key(cfg, "vz_kerchunk/ECMWF/2024/01/02.nc")


def test_ref_path_for_ledger_key_returns_existing(tmp_path):
    refs_root = tmp_path / "refs"
    target = refs_root / "vz_kerchunk/ECMWF/2024/01/02.nc.parq"
    target.mkdir(parents=True)
    cfg = {"paths": {"refs_root": str(refs_root)}}

    path = ref_path_for_ledger_key(cfg, "vz_kerchunk/ECMWF/2024/01/02.nc")
    assert path == target
