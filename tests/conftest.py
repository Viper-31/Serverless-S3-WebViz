from __future__ import annotations

import os
import sys
from pathlib import Path


def pytest_sessionstart(session):
    repo_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(repo_root))
    os.environ.setdefault("PYTHONPATH", str(repo_root))
