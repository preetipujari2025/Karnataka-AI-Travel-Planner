"""Smoke tests for the health endpoint and app metadata."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["dataset_size"] > 0
    assert isinstance(body["llm_configured"], bool)


def test_root_links_to_docs(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_swagger_docs_available(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
