import json
from types import SimpleNamespace

import pytest

from resume_assistant.keywords import match_keywords
from resume_assistant.llm import AnalysisError, AnalysisResult, ResumeAI
from resume_assistant.report import build_markdown_report


class FakeCompletions:
    def __init__(self, content):
        self.content = content
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self.content)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def fake_client(content):
    completions = FakeCompletions(content)
    return SimpleNamespace(chat=SimpleNamespace(completions=completions)), completions


SAMPLE = {
    "ats_score": 82.6,
    "verdict": "Strong fit.",
    "matched_keywords": ["Python", "AWS"],
    "missing_keywords": "Kubernetes",
    "strengths": ["Clear impact"],
    "improvements": ["Add metrics"],
    "bullet_rewrites": [{"original": "Did stuff", "improved": "Cut costs 20%"}, "bad item"],
    "suggested_summary": "Engineer with 5 years...",
}


def test_analyze_parses_json_and_uses_json_mode():
    client, completions = fake_client(json.dumps(SAMPLE))
    result = ResumeAI(client=client, model="test-model").analyze("resume", "job")

    assert result.ats_score == 83
    assert result.missing_keywords == ["Kubernetes"]
    assert len(result.bullet_rewrites) == 1
    call = completions.calls[0]
    assert call["model"] == "test-model"
    assert call["response_format"] == {"type": "json_object"}


def test_analyze_handles_code_fences():
    client, _ = fake_client("```json\n" + json.dumps(SAMPLE) + "\n```")
    assert ResumeAI(client=client).analyze("r", "j").ats_score == 83


def test_analyze_invalid_json_raises():
    client, _ = fake_client("not json")
    with pytest.raises(AnalysisError):
        ResumeAI(client=client).analyze("r", "j")


def test_from_dict_clamps_and_defaults():
    result = AnalysisResult.from_dict({"ats_score": "150"})
    assert result.ats_score == 100
    assert result.strengths == []
    assert AnalysisResult.from_dict({"ats_score": "n/a"}).ats_score == 0


def test_cover_letter_returns_text():
    client, completions = fake_client("Dear team,")
    assert ResumeAI(client=client).cover_letter("r", "j", tone="concise") == "Dear team,"
    assert "concise" in completions.calls[0]["messages"][1]["content"]


def test_report_contains_sections():
    kw = match_keywords("python developer", "python python aws aws", top_n=5)
    md = build_markdown_report(kw, AnalysisResult.from_dict(SAMPLE), cover_letter="Dear team,")
    assert "AI ATS score:** 83/100" in md
    assert "Cut costs 20%" in md
    assert "## Cover Letter" in md
    # Works without AI results too.
    assert "Keyword match" in build_markdown_report(kw)
