from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml


def load_yaml(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as fh:
        payload = yaml.safe_load(fh)
    if not isinstance(payload, dict):
        raise ValueError("Top-level YAML must be a mapping.")
    return payload


def _validate_minimal_schema(cfg: dict[str, Any]) -> None:
    required_top = ["s3", "paths", "datasets"]
    missing_top = [k for k in required_top if k not in cfg]
    if missing_top:
        raise ValueError(f"Missing config sections: {missing_top}")

    s3 = cfg["s3"]
    for k in ["endpoint_url", "bucket", "region_name", "auth_mode"]:
        if not s3.get(k):
            raise ValueError(f"Missing s3.{k}")

    auth_mode = s3.get("auth_mode")
    if auth_mode not in {"credentials", "anonymous"}:
        raise ValueError("s3.auth_mode must be 'credentials' or 'anonymous'")

    paths = cfg["paths"]
    for k in ["ledger_path", "refs_root"]:
        if not paths.get(k):
            raise ValueError(f"Missing paths.{k}")

    datasets = cfg["datasets"]
    if not isinstance(datasets, dict) or not datasets:
        raise ValueError("datasets must be a non-empty mapping")

    for name, ds in datasets.items():
        if not isinstance(ds, dict):
            raise ValueError(f"datasets.{name} must be a mapping")
        if not ds.get("flow_id"):
            raise ValueError(f"datasets.{name}.flow_id is required")
        time_mode = ds.get("time_mode")
        if time_mode and time_mode not in {"force_utc", "metadata"}:
            raise ValueError(
                f"datasets.{name}.time_mode must be 'force_utc' or 'metadata'"
            )


def load_pipeline_config(config_path: str | Path) -> dict[str, Any]:
    cfg = load_yaml(config_path)
    _validate_minimal_schema(cfg)
    return cfg


def find_env_file(filename: str = "s3_connect.txt", env_dir: str = ".env") -> Path:
    """Search upwards from current file to find the .env/filename"""
    curr_path = Path(__file__).resolve().parent

    for parent in [curr_path, *curr_path.parents]:
        env_path = parent / env_dir / filename
        if env_path.exists():
            return env_path
    raise FileNotFoundError(f"Could not find {env_dir}/{filename} in any parent folder")


def resolve_secrets(cfg: dict[str, Any]) -> tuple[str, str] | tuple[None, None]:
    auth_mode = cfg.get("s3", {}).get("auth_mode", "credentials")
    if auth_mode == "anonymous":
        return None, None

    access_key = os.environ.get("ACACIA_ACCESS_KEY")
    secret_key = os.environ.get("ACACIA_SECRET_KEY")

    if access_key and secret_key:
        return access_key, secret_key

    secret_path = find_env_file()
    secrets: dict[str, str] = {}
    with secret_path.open("r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                key, value = line.strip().split("=", 1)
                secrets[key.strip()] = value.strip()

    access_key = secrets.get("ACCESS_KEY")
    secret_key = secrets.get("SECRET_KEY")

    if not access_key or not secret_key:
        raise ValueError(f"Secrets file at {secret_path} is missing required keys.")

    return access_key, secret_key
