"""Shared fixtures: FastAPI test client.

External routing/POI providers (OSRM, Overpass) are disabled for the whole
suite: CI must never hit live services, and the road-trip services degrade
to labelled local data which is exactly what the tests assert against.
"""

from __future__ import annotations

import os

os.environ.setdefault("ROUTING_ENABLED", "false")
os.environ.setdefault("EXTERNAL_PROVIDERS_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client() -> TestClient:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
