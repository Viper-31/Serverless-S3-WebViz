from __future__ import annotations

from typing import Any

import boto3
import s3fs
from botocore.config import Config


def build_storage_clients(cfg: dict[str, Any], access_key: str | None, secret_key: str | None):
    s3_cfg = cfg["s3"]

    client_kwargs = {
        "endpoint_url": s3_cfg["endpoint_url"],
        "region_name": s3_cfg.get("region_name", "us-east-1"),
    }
    config_kwargs = {
        "signature_version": "s3v4",
        "s3": {"addressing_style": "path"},
    }

    auth_mode = s3_cfg.get("auth_mode", "credentials")
    if auth_mode == "anonymous":
        fs = s3fs.S3FileSystem(anon=True, client_kwargs=client_kwargs, config_kwargs=config_kwargs)
        s3_client = boto3.client("s3", config=Config(**config_kwargs), **client_kwargs)
        return fs, s3_client

    if not access_key or not secret_key:
        raise ValueError("Credentials auth_mode requires access_key and secret_key")

    fs = s3fs.S3FileSystem(
        key=access_key,
        secret=secret_key,
        client_kwargs=client_kwargs,
        config_kwargs=config_kwargs,
    )

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(**config_kwargs),
        **client_kwargs,
    )

    return fs, s3_client
