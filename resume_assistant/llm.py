"""LLM-powered analysis using the OpenAI Python SDK (v1+).

Any OpenAI-compatible endpoint works too (Groq, Gemini, Ollama, OpenRouter, LM Studio...)
by passing ``base_url``. See ``providers.py`` for the built-in presets.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

from openai import (
    APIConnectionError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAI,
    OpenAIError,
    RateLimitError,
)

from . import prompts

DEFAULT_MODEL = "gpt-4o-mini"
# Keeps requests within context limits and costs predictable.
MAX_INPUT_CHARS = 15_000
MAX_CHAT_TURNS = 12
MAX_MESSAGE_CHARS = 4_000


class AnalysisError(RuntimeError):
    """Raised when the LLM call fails or returns unusable output."""


@dataclass
class BulletRewrite:
    original: str
    improved: str


@dataclass
class AnalysisResult:
    ats_score: int
    verdict: str = ""
    matched_keywords: list[str] = field(default_factory=list)
    missing_keywords: list[str] = field(default_factory=list)
    strengths: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)
    bullet_rewrites: list[BulletRewrite] = field(default_factory=list)
    suggested_summary: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AnalysisResult:
        """Build a result from model output, tolerating missing or oddly-typed fields."""

        def str_list(key: str) -> list[str]:
            value = data.get(key) or []
            if isinstance(value, str):
                value = [value]
            return [str(v).strip() for v in value if str(v).strip()]

        try:
            score = int(round(float(data.get("ats_score", 0))))
        except (TypeError, ValueError):
            score = 0

        rewrites = []
        for item in data.get("bullet_rewrites") or []:
            if isinstance(item, dict) and item.get("improved"):
                rewrites.append(
                    BulletRewrite(
                        original=str(item.get("original", "")).strip(),
                        improved=str(item["improved"]).strip(),
                    )
                )

        return cls(
            ats_score=max(0, min(100, score)),
            verdict=str(data.get("verdict", "")).strip(),
            matched_keywords=str_list("matched_keywords"),
            missing_keywords=str_list("missing_keywords"),
            strengths=str_list("strengths"),
            improvements=str_list("improvements"),
            bullet_rewrites=rewrites,
            suggested_summary=str(data.get("suggested_summary", "")).strip(),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _truncate(text: str) -> str:
    return text if len(text) <= MAX_INPUT_CHARS else text[:MAX_INPUT_CHARS] + "\n[...truncated]"


class ResumeAI:
    """Thin wrapper around the OpenAI chat completions API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.3,
        base_url: str | None = None,
        client: OpenAI | None = None,
    ):
        self.model = model
        self.temperature = temperature
        try:
            # Local servers like Ollama ignore the key, but the SDK requires one.
            self.client = client or OpenAI(
                api_key=api_key or ("local" if base_url else None),
                base_url=base_url,
                timeout=120,
            )
        except OpenAIError as exc:
            raise AnalysisError(str(exc)) from exc

    def _create(self, kwargs: dict[str, Any]) -> Any:
        try:
            return self.client.chat.completions.create(**kwargs)
        except BadRequestError:
            # Some providers/models don't support JSON mode: retry once without it.
            if "response_format" not in kwargs:
                raise
            kwargs = {k: v for k, v in kwargs.items() if k != "response_format"}
            return self.client.chat.completions.create(**kwargs)

    def _chat(self, system: str, user: str, json_mode: bool = False) -> str:
        return self._complete(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            json_mode=json_mode,
        )

    def _complete(self, messages: list[dict[str, str]], json_mode: bool = False) -> str:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": messages,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = self._create(kwargs)
        except AuthenticationError as exc:
            raise AnalysisError("Invalid API key for the selected provider.") from exc
        except RateLimitError as exc:
            raise AnalysisError(
                "Rate limit or quota reached. Free tiers have per-minute limits: "
                "wait a minute and try again, or switch provider."
            ) from exc
        except NotFoundError as exc:
            raise AnalysisError(
                f"Model '{self.model}' was not found for this provider. Pick another model."
            ) from exc
        except APIConnectionError as exc:
            raise AnalysisError(
                "Could not connect to the AI provider. If you use Ollama, make sure it is "
                "running (`ollama serve`) and the model is pulled (`ollama pull <model>`)."
            ) from exc
        except OpenAIError as exc:
            raise AnalysisError(f"AI request failed: {exc}") from exc

        content = response.choices[0].message.content
        if not content:
            raise AnalysisError("The model returned an empty response.")
        return content.strip()

    def analyze(self, resume: str, job: str) -> AnalysisResult:
        raw = self._chat(
            prompts.ANALYSIS_SYSTEM,
            prompts.ANALYSIS_USER.format(resume=_truncate(resume), job=_truncate(job)),
            json_mode=True,
        )
        try:
            data = json.loads(_strip_code_fence(raw))
        except json.JSONDecodeError as exc:
            raise AnalysisError("The model did not return valid JSON. Try again.") from exc
        if not isinstance(data, dict):
            raise AnalysisError("Unexpected response format from the model.")
        return AnalysisResult.from_dict(data)

    def cover_letter(self, resume: str, job: str, tone: str = "professional") -> str:
        return self._chat(
            prompts.COVER_LETTER_SYSTEM,
            prompts.COVER_LETTER_USER.format(
                resume=_truncate(resume), job=_truncate(job), tone=tone
            ),
        )

    def interview_questions(self, resume: str, job: str) -> str:
        return self._chat(
            prompts.INTERVIEW_SYSTEM,
            prompts.INTERVIEW_USER.format(resume=_truncate(resume), job=_truncate(job)),
        )

    def chat(
        self,
        resume: str,
        job: str,
        messages: list[dict[str, str]],
        analysis: AnalysisResult | None = None,
    ) -> str:
        """Answer follow-up questions about this resume, job and analysis."""
        notes = "No AI review has been run yet."
        if analysis:
            notes = (
                f"ATS score: {analysis.ats_score}/100. Verdict: {analysis.verdict}\n"
                f"Missing keywords: {', '.join(analysis.missing_keywords) or 'none'}\n"
                f"Suggested improvements: {'; '.join(analysis.improvements) or 'none'}"
            )
        system = prompts.CHAT_SYSTEM.format(
            resume=_truncate(resume), job=_truncate(job), analysis=notes
        )
        history = [
            {"role": m["role"], "content": m["content"][:MAX_MESSAGE_CHARS]}
            for m in messages[-MAX_CHAT_TURNS:]
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        if not history or history[-1]["role"] != "user":
            raise AnalysisError("Ask a question first.")
        return self._complete([{"role": "system", "content": system}, *history])


def _strip_code_fence(text: str) -> str:
    """Some models wrap JSON in ```json fences even in JSON mode."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    return text.strip()
