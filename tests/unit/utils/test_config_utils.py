from __future__ import annotations

import textwrap

import pytest

from utils import config_utils


def _write_yaml(tmp_path, content: str):
    path = tmp_path / "config.yaml"
    path.write_text(textwrap.dedent(content))
    return path


def test_load_pipeline_config_accepts_minimal_schema(tmp_path):
    path = _write_yaml(
        tmp_path,
        """
        s3:
          endpoint_url: "https://example.org"
          bucket: "weather"
          region_name: "us-east-1"
          auth_mode: "credentials"
        paths:
          ledger_path: "acacia_refs_staging/_state/inventory_ledger.json"
          refs_root: "acacia_refs_staging/refs"
        datasets:
          ecmwf:
            flow_id: "ecmwf_weekly_nc"
          dpird:
            flow_id: "dpird_final_singleton"
            time_mode: "force_utc"
        """,
    )

    cfg = config_utils.load_pipeline_config(path)
    assert cfg["s3"]["bucket"] == "weather"
    assert cfg["datasets"]["dpird"]["time_mode"] == "force_utc"


def test_load_pipeline_config_rejects_missing_sections(tmp_path):
    path = _write_yaml(
        tmp_path,
        """
        s3:
          endpoint_url: "https://example.org"
          bucket: "weather"
          region_name: "us-east-1"
          auth_mode: "credentials"
        """,
    )

    with pytest.raises(ValueError, match="Missing config sections"):
        config_utils.load_pipeline_config(path)


def test_load_pipeline_config_rejects_invalid_auth_mode(tmp_path):
    path = _write_yaml(
        tmp_path,
        """
        s3:
          endpoint_url: "https://example.org"
          bucket: "weather"
          region_name: "us-east-1"
          auth_mode: "token"
        paths:
          ledger_path: "ledger.json"
          refs_root: "refs"
        datasets:
          ecmwf:
            flow_id: "ecmwf_weekly_nc"
        """,
    )

    with pytest.raises(ValueError, match="auth_mode"):
        config_utils.load_pipeline_config(path)


def test_resolve_secrets_returns_none_for_anonymous(tmp_path):
    path = _write_yaml(
        tmp_path,
        """
        s3:
          endpoint_url: "https://example.org"
          bucket: "weather"
          region_name: "us-east-1"
          auth_mode: "anonymous"
        paths:
          ledger_path: "ledger.json"
          refs_root: "refs"
        datasets:
          ecmwf:
            flow_id: "ecmwf_weekly_nc"
        """,
    )

    cfg = config_utils.load_pipeline_config(path)
    access, secret = config_utils.resolve_secrets(cfg)
    assert access is None
    assert secret is None
