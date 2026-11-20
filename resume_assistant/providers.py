"""Supported AI providers.

All of them speak the OpenAI chat-completions API, so one client works for every provider.
Free options (Groq, Google Gemini, Ollama) let people use the app without paying for OpenAI.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str | None  # None = OpenAI's default endpoint
    key_env: str | None  # None = no API key needed (local models)
    models: tuple[str, ...]
    key_url: str = ""  # where to get a key
    note: str = ""

    @property
    def needs_key(self) -> bool:
        return self.key_env is not None

    def env_key(self) -> str | None:
        # A public deployment must never spend the host's own keys on visitors.
        if public_mode() or not self.key_env:
            return None
        return os.getenv(self.key_env)


def public_mode() -> bool:
    """True when the app is hosted for strangers (PUBLIC_MODE=1)."""
    return os.getenv("PUBLIC_MODE", "").strip().lower() in {"1", "true", "yes", "on"}


PROVIDERS: dict[str, Provider] = {
    p.name: p
    for p in (
        Provider(
            name="Groq (free)",
            base_url="https://api.groq.com/openai/v1",
            key_env="GROQ_API_KEY",
            models=("llama-3.3-70b-versatile", "llama-3.1-8b-instant"),
            key_url="https://console.groq.com/keys",
            note="Free tier, no credit card. Very fast.",
        ),
        Provider(
            name="Google Gemini (free)",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            key_env="GEMINI_API_KEY",
            models=("gemini-2.5-flash", "gemini-2.0-flash"),
            key_url="https://aistudio.google.com/apikey",
            note="Free tier with a Google account.",
        ),
        Provider(
            name="OpenAI",
            base_url=os.getenv("OPENAI_BASE_URL") or None,
            key_env="OPENAI_API_KEY",
            models=("gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"),
            key_url="https://platform.openai.com/api-keys",
            note="Paid. Usually the best quality.",
        ),
        Provider(
            name="Ollama (local)",
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            key_env=None,
            models=("llama3.2", "qwen2.5", "mistral"),
            key_url="https://ollama.com/download",
            note="Runs on your own computer. Free and fully private.",
        ),
    )
}


def available_providers() -> dict[str, Provider]:
    """Providers this deployment can offer. Local-only ones (Ollama) are hidden when public."""
    if public_mode():
        return {name: p for name, p in PROVIDERS.items() if p.needs_key}
    return PROVIDERS


def default_provider() -> str:
    """Pick the provider from LLM_PROVIDER, else the first one that has a key configured."""
    providers = available_providers()
    wanted = os.getenv("LLM_PROVIDER", "").lower()
    for name in providers:
        if wanted and wanted in name.lower():  # "groq", "gemini", "openai", "ollama"...
            return name
    for name, provider in providers.items():
        if provider.needs_key and provider.env_key():
            return name
    return next(iter(providers))
