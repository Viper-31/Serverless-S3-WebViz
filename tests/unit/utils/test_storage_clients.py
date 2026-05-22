from __future__ import annotations

import pytest

from utils.storage_clients import build_storage_clients


def test_build_storage_clients_rejects_missing_credentials():
    cfg = {
        "s3": {
            "endpoint_url": "https://example.org",
            "bucket": "weather",
            "region_name": "us-east-1",
            "auth_mode": "credentials",
        }
    }

    with pytest.raises(ValueError, match="Credentials auth_mode requires"):
        build_storage_clients(cfg, None, None)
