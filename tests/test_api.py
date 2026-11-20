import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from resume_assistant.llm import ResumeAI
from server import main

client = TestClient(main.app)

RESUME = "Python developer. Built machine learning models with PyTorch."
JOB = "Python python machine learning machine learning AWS AWS Docker"


def test_health_and_providers():
    assert client.get("/api/health").json()["status"] == "ok"
    data = client.get("/api/providers").json()
    names = [p["name"] for p in data["providers"]]
    assert data["default"] in names
    assert all(p["models"] for p in data["providers"])


def test_parse_txt_and_rejects_bad_type():
    ok = client.post("/api/parse", files={"file": ("cv.txt", b"Jane Doe\nPython", "text/plain")})
    assert ok.status_code == 200
    assert ok.json()["words"] == 3
    bad = client.post("/api/parse", files={"file": ("cv.exe", b"x", "application/octet-stream")})
    assert bad.status_code == 422


def test_keywords_returns_table_and_spans():
    data = client.post("/api/keywords", json={"resume": RESUME, "job": JOB, "top_n": 10}).json()
    rows = {r["keyword"]: r for r in data["keywords"]}
    assert rows["python"]["found"] is True
    assert rows["aws"]["found"] is False
    assert rows["python"]["job_count"] == 2
    assert data["spans"] and all(len(s) == 2 for s in data["spans"])


def test_analyze_requires_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    res = client.post(
        "/api/analyze", json={"resume": RESUME, "job": JOB, "provider": "Groq (free)"}
    )
    assert res.status_code == 401


def test_analyze_with_fake_model(monkeypatch):
    payload = {"ats_score": 64, "verdict": "Decent fit.", "improvements": ["Add AWS"]}

    def fake_create(**kwargs):
        msg = SimpleNamespace(content=json.dumps(payload))
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
    )
    original = ResumeAI.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["client"] = fake_client
        original(self, *args, **kwargs)

    monkeypatch.setattr(ResumeAI, "__init__", patched_init)
    res = client.post(
        "/api/analyze",
        json={"resume": RESUME, "job": JOB, "provider": "Groq (free)"},
        headers={"X-API-Key": "test-key"},
    )
    assert res.status_code == 200
    assert res.json()["ats_score"] == 64


@pytest.mark.parametrize("bad", [{"resume": "", "job": "x"}, {"resume": "x"}])
def test_validation_errors(bad):
    assert client.post("/api/keywords", json=bad).status_code == 422


def test_report_markdown():
    res = client.post("/api/report", json={"resume": RESUME, "job": JOB})
    assert res.status_code == 200
    assert res.text.startswith("# Resume Analysis Report")


def test_parse_returns_ats_checks():
    res = client.post(
        "/api/parse", files={"file": ("cv.txt", b"Jane Doe\njane@x.com", "text/plain")}
    )
    ids = {c["id"] for c in res.json()["checks"]}
    assert {"layout", "email", "sections"} <= ids


def test_ats_text_endpoint():
    data = client.post("/api/ats-text", json={"resume": RESUME}).json()
    assert data["total"] >= data["passed"] >= 0
    assert any(c["id"] == "email" for c in data["checks"])


def test_compare_ranks_jobs():
    res = client.post(
        "/api/compare",
        json={
            "resume": RESUME,
            "jobs": [
                {"title": "", "text": "Senior Python engineer\npython python pytorch pytorch"},
                {"title": "Chef", "text": "cooking cooking kitchen kitchen knives"},
            ],
            "top_n": 10,
        },
    ).json()["results"]
    assert res[0]["title"] == "Senior Python engineer"
    assert res[1]["title"] == "Chef"
    assert res[0]["score"] > res[1]["score"]


def test_chat_with_fake_model(monkeypatch):
    seen = {}

    def fake_create(**kwargs):
        seen.update(kwargs)
        msg = SimpleNamespace(content="Add Docker to a project.")
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
    )
    original = ResumeAI.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["client"] = fake_client
        original(self, *args, **kwargs)

    monkeypatch.setattr(ResumeAI, "__init__", patched_init)
    res = client.post(
        "/api/chat",
        json={
            "resume": RESUME,
            "job": JOB,
            "provider": "Ollama (local)",
            "messages": [{"role": "user", "content": "What should I add?"}],
            "analysis": {"ats_score": 50, "missing_keywords": ["Docker"]},
        },
    )
    assert res.status_code == 200
    assert res.json()["text"] == "Add Docker to a project."
    assert seen["messages"][0]["role"] == "system"
    assert "Docker" in seen["messages"][0]["content"]
    assert seen["messages"][-1] == {"role": "user", "content": "What should I add?"}


def test_export_docx():
    res = client.post("/api/export-docx", json={"resume": "Jane Doe\nSKILLS\n- Python"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert res.content[:2] == b"PK"


def test_export_tex():
    res = client.post("/api/export-tex", json={"resume": "Jane Doe\n\nSKILLS\n- SQL & Python"})
    assert res.status_code == 200
    assert r"\item SQL \& Python" in res.text
