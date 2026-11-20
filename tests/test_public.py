"""Behaviour of a public deployment (PUBLIC_MODE=1)."""

import pytest
from fastapi.testclient import TestClient

from server import main
from server.ratelimit import RateLimiter

client = TestClient(main.app)
TEXT = {"resume": "Python developer", "job": "Python developer needed"}


@pytest.fixture
def public(monkeypatch):
    monkeypatch.setenv("PUBLIC_MODE", "1")
    main.limiter.reset()
    yield
    main.limiter.reset()


def test_public_mode_hides_ollama_and_env_keys(public, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "host-secret")
    body = client.get("/api/providers").json()
    names = [p["name"] for p in body["providers"]]
    assert not any("Ollama" in n for n in names)
    assert all(p["has_env_key"] is False for p in body["providers"])


def test_public_mode_never_uses_host_key(public, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "host-secret")
    res = client.post("/api/analyze", json={**TEXT, "provider": "Groq (free)"})
    assert res.status_code == 401


def test_public_mode_rejects_ollama(public):
    res = client.post("/api/analyze", json={**TEXT, "provider": "Ollama (local)"})
    assert res.status_code == 400


def test_local_mode_still_offers_ollama(monkeypatch):
    monkeypatch.delenv("PUBLIC_MODE", raising=False)
    names = [p["name"] for p in client.get("/api/providers").json()["providers"]]
    assert "Ollama (local)" in names


def test_rate_limit_returns_429(public, monkeypatch):
    monkeypatch.setattr(main, "limiter", RateLimiter({"ai": 2, "api": 3}))
    codes = [client.post("/api/keywords", json=TEXT).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    res = client.post("/api/keywords", json=TEXT)
    assert "Too many requests" in res.json()["detail"]
    assert int(res.headers["Retry-After"]) > 0
    # Health checks from the host are never limited.
    assert client.get("/api/health").status_code == 200


def test_rate_limiter_window_expires():
    limiter = RateLimiter({"ai": 1}, window=60)
    assert limiter.hit("a", "ai", now=0) is None
    assert limiter.hit("a", "ai", now=10) == pytest.approx(50)
    assert limiter.hit("b", "ai", now=10) is None  # other visitors unaffected
    assert limiter.hit("a", "ai", now=61) is None


def test_oversized_text_rejected():
    res = client.post("/api/keywords", json={"resume": "x" * 50_001, "job": "python"})
    assert res.status_code == 422
    assert res.json()["detail"][0]["type"] == "string_too_long"


def test_security_headers():
    res = client.get("/api/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
