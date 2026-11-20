from types import SimpleNamespace

import httpx
from openai import BadRequestError

from resume_assistant import providers
from resume_assistant.llm import ResumeAI
from resume_assistant.providers import PROVIDERS, default_provider


def test_every_provider_has_models_and_a_way_in():
    for p in PROVIDERS.values():
        assert p.models
        assert p.key_url
        assert p.needs_key == (p.key_env is not None)


def test_default_provider_respects_env(monkeypatch):
    for p in PROVIDERS.values():
        if p.key_env:
            monkeypatch.delenv(p.key_env, raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    assert default_provider() == "Ollama (local)"


def test_default_provider_picks_first_configured_key(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    for p in PROVIDERS.values():
        if p.key_env:
            monkeypatch.delenv(p.key_env, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    assert default_provider() == "Google Gemini (free)"


def test_default_provider_falls_back_to_first(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    for p in PROVIDERS.values():
        if p.key_env:
            monkeypatch.delenv(p.key_env, raising=False)
    assert default_provider() == next(iter(providers.PROVIDERS))


def test_local_provider_needs_no_key():
    ai = ResumeAI(base_url="http://localhost:11434/v1", model="llama3.2")
    assert str(ai.client.base_url).startswith("http://localhost:11434")


def test_json_mode_falls_back_when_unsupported():
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        if "response_format" in kwargs:
            request = httpx.Request("POST", "http://test")
            raise BadRequestError(
                "json mode unsupported", response=httpx.Response(400, request=request), body=None
            )
        message = SimpleNamespace(content='{"ats_score": 70}')
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    result = ResumeAI(client=client).analyze("resume", "job")
    assert result.ats_score == 70
    assert len(calls) == 2
    assert "response_format" not in calls[1]
