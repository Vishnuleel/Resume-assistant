"""Offline keyword matching between a resume and a job description.

This works without an API key and gives an instant, transparent baseline score
alongside the AI evaluation.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

# Common English words plus words that show up in nearly every job posting.
STOPWORDS = frozenset(
    """
    a about above across after again against all also am an and any are as at be because been
    before being below between both but by can could did do does doing down during each either
    etc few for from further get had has have having he her here hers him his how i if in into
    is it its itself just like may me might more most must my no nor not now of off on once
    only or other our ours out over own per same she should so some such than that the their
    them then there these they this those through to too under until up upon us very via was
    we well were what when where which while who whom why will with within without would you
    your yours

    ability able across additional applicant applicants apply benefits best candidate
    candidates closely company work working works environment etc excellent experience
    experienced including job join looking new opportunity plus preferred position related
    required requirement requirements responsibilities role skills strong team teams things
    understanding using want year years knowledge great good help day days high level make
    ensure based highly equal employer status please field fields etc ideal ideally
    build building built develop developing deploy deploying design designing create
    creating monitor monitoring maintain manage managing support supporting collaborate
    collaborating define run set use used own drive deliver implement implementing improve
    junior senior mid lead degree bachelor master familiarity familiar proficiency
    proficient nice hands-on fast-paced passionate motivated self-starter
    hiring hire hires seeking join us our we're re ll ve offer apply today  don doesn isn
    """.split()
)

# Tokens may contain + # . / - so tech terms like c++, c#, node.js, ci/cd survive.
_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]")


@dataclass
class KeywordReport:
    keywords: list[str]
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)

    @property
    def score(self) -> int:
        if not self.keywords:
            return 0
        return round(100 * len(self.matched) / len(self.keywords))


# Contractions like "we're" / "company's" would otherwise leave "re" / "s" behind.
_CONTRACTION_RE = re.compile(r"[’']\w+")


def tokenize(text: str) -> list[str]:
    text = _CONTRACTION_RE.sub("", text.lower())
    return [t.strip(".-/") for t in _TOKEN_RE.findall(text) if t.strip(".-/")]


def _is_candidate(token: str) -> bool:
    return token not in STOPWORDS and len(token) > 1 and not token.isdigit()


def _stem(word: str) -> str:
    """Very light plural folding so 'models' and 'model' count as one keyword."""
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def extract_keywords(job_description: str, top_n: int = 25) -> list[str]:
    """Pick the most relevant keywords and two-word phrases from a job description."""
    tokens = tokenize(job_description)

    # Count single words by stem, remembering the most common surface form for display.
    stem_counts: Counter[str] = Counter()
    surface: dict[str, Counter[str]] = {}
    for t in tokens:
        if _is_candidate(t):
            stem = _stem(t)
            stem_counts[stem] += 1
            surface.setdefault(stem, Counter())[t] += 1

    bigrams = Counter(
        f"{a} {b}"
        for a, b in zip(tokens, tokens[1:], strict=False)
        if a != b and _is_candidate(a) and _is_candidate(b)
    )
    # Phrases that repeat are usually real concepts ("machine learning", "data pipelines").
    phrases = [p for p, c in bigrams.most_common() if c >= 2]

    # Words inside a chosen phrase only count when they also appear on their own.
    standalone = stem_counts.copy()
    for phrase in phrases:
        for word in phrase.split():
            standalone[_stem(word)] -= bigrams[phrase]

    scored: list[tuple[str, int]] = [(p, bigrams[p] * 2) for p in phrases]
    for stem, count in standalone.items():
        if count > 0:
            scored.append((surface[stem].most_common(1)[0][0], count))

    lowered = job_description.lower()

    def position(keyword: str) -> int:
        idx = lowered.find(keyword)
        return idx if idx >= 0 else len(lowered)

    scored.sort(key=lambda kc: (-kc[1], position(kc[0])))
    return [kw for kw, _ in scored[:top_n]]


def _pattern(keyword: str) -> re.Pattern[str]:
    words = [re.escape(_stem(w)) for w in keyword.lower().split()]
    # Allow hyphens between phrase words and an optional plural ending on each word.
    body = r"(?:e?s)?[\s-]+".join(words) + r"(?:e?s)?"
    return re.compile(r"(?<![a-z0-9])" + body + r"(?![a-z0-9+#])", re.IGNORECASE)


def _contains(text: str, keyword: str) -> bool:
    return _pattern(keyword).search(text) is not None


def count_occurrences(text: str, keyword: str) -> int:
    """How many times a keyword (or its plural / hyphenated form) appears in text."""
    return len(_pattern(keyword).findall(text))


def find_spans(text: str, keywords: list[str]) -> list[tuple[int, int]]:
    """Character ranges in ``text`` where any keyword appears, merged and sorted.

    Used to highlight matched keywords in the resume.
    """
    spans = sorted((m.start(), m.end()) for kw in keywords for m in _pattern(kw).finditer(text))
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


def match_keywords(resume_text: str, job_description: str, top_n: int = 25) -> KeywordReport:
    keywords = extract_keywords(job_description, top_n=top_n)
    report = KeywordReport(keywords=keywords)
    for kw in keywords:
        (report.matched if _contains(resume_text, kw) else report.missing).append(kw)
    return report
