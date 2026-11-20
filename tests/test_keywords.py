from resume_assistant.keywords import extract_keywords, match_keywords, tokenize

JOB = """
We are looking for a Python developer with experience in machine learning.
You will build machine learning pipelines using Python, PyTorch and AWS.
Knowledge of C++ and CI/CD is a plus. Experience with Node.js preferred.
"""


def test_tokenize_keeps_tech_terms():
    tokens = tokenize("C++, C#, Node.js and CI/CD.")
    assert {"c++", "c#", "node.js", "ci/cd"} <= set(tokens)


def test_extract_keywords_ranks_repeated_terms_and_phrases():
    keywords = extract_keywords(JOB, top_n=10)
    assert "python" in keywords
    assert "machine learning" in keywords
    # Stopwords and generic job-posting words are filtered out.
    assert "experience" not in keywords
    assert "the" not in keywords


def test_match_keywords_scores_resume():
    resume = "Senior Python engineer. Built machine-learning models in PyTorch on AWS."
    report = match_keywords(resume, JOB, top_n=10)
    assert "python" in report.matched
    assert "machine learning" in report.matched  # hyphenated form still matches
    assert "c++" in report.missing
    assert 0 < report.score < 100


def test_match_requires_whole_words():
    report = match_keywords("I like javascript", "java java java", top_n=5)
    assert report.missing == ["java"]
    assert report.score == 0


def test_empty_job_description():
    report = match_keywords("anything", "", top_n=5)
    assert report.keywords == []
    assert report.score == 0


def test_plural_and_phrase_folding():
    job = "Train models. Deploy models. Machine learning and machine learning ops."
    keywords = extract_keywords(job, top_n=10)
    assert "machine learning" in keywords
    assert "machine" not in keywords  # covered by the phrase
    report = match_keywords("Built a churn model.", job, top_n=10)
    assert "models" in report.matched


def test_count_occurrences_handles_case_plural_and_hyphen():
    from resume_assistant.keywords import count_occurrences

    text = "Machine-learning models. Another MODEL. machine learning."
    assert count_occurrences(text, "models") == 2
    assert count_occurrences(text, "machine learning") == 2


def test_find_spans_merges_overlaps():
    from resume_assistant.keywords import find_spans

    text = "Python and machine learning in Python"
    spans = find_spans(text, ["python", "machine learning", "learning"])
    assert [text[a:b] for a, b in spans] == ["Python", "machine learning", "Python"]


def test_contractions_and_hiring_words_are_ignored():
    keywords = extract_keywords(
        "We're hiring! We're hiring a Python dev. Python, SQL. Company's SQL stack."
    )
    assert "re" not in keywords
    assert "s" not in keywords
    assert "hiring" not in keywords
    assert {"python", "sql"} <= set(keywords)
