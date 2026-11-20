"""Build a downloadable Markdown report from analysis results."""

from __future__ import annotations

from datetime import date

from .keywords import KeywordReport
from .llm import AnalysisResult


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "_None_"


def build_markdown_report(
    keyword_report: KeywordReport,
    analysis: AnalysisResult | None = None,
    cover_letter: str | None = None,
    interview_prep: str | None = None,
) -> str:
    lines = [
        "# Resume Analysis Report",
        f"_Generated on {date.today():%B %d, %Y} by AI Resume Assistant_",
        "",
        "## Scores",
        f"- **Keyword match:** {keyword_report.score}% "
        f"({len(keyword_report.matched)}/{len(keyword_report.keywords)} keywords)",
    ]
    if analysis:
        lines.append(f"- **AI ATS score:** {analysis.ats_score}/100")
        if analysis.verdict:
            lines += ["", f"> {analysis.verdict}"]

    lines += [
        "",
        "## Keywords",
        "### Found in resume",
        _bullets(analysis.matched_keywords if analysis else keyword_report.matched),
        "",
        "### Missing from resume",
        _bullets(analysis.missing_keywords if analysis else keyword_report.missing),
    ]

    if analysis:
        lines += [
            "",
            "## Strengths",
            _bullets(analysis.strengths),
            "",
            "## Suggested Improvements",
            "\n".join(f"{i}. {s}" for i, s in enumerate(analysis.improvements, 1)) or "_None_",
        ]
        if analysis.bullet_rewrites:
            lines += ["", "## Bullet Point Rewrites"]
            for rw in analysis.bullet_rewrites:
                if rw.original:
                    lines.append(f"- ~~{rw.original}~~")
                    lines.append(f"  - **{rw.improved}**")
                else:
                    lines.append(f"- **{rw.improved}**")
        if analysis.suggested_summary:
            lines += ["", "## Suggested Professional Summary", analysis.suggested_summary]

    if cover_letter:
        lines += ["", "## Cover Letter", cover_letter]
    if interview_prep:
        lines += ["", "## Interview Preparation", interview_prep]

    return "\n".join(lines).strip() + "\n"
