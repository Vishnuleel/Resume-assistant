from resume_assistant.latex_export import build_tex, escape, is_latex

RESUME = """Jane Doe
jane_doe@example.com | +1 555 123 4567

SUMMARY
Data analyst with 5% churn reduction & 100% on-time delivery.

EXPERIENCE
- Built C# and Python_tools for {reporting}
- Cut costs by $40k ~ 20%
"""


def test_escape_special_characters():
    assert escape(r"a & b % c $ # _ { } ~ ^ \ ") == (
        r"a \& b \% c \$ \# \_ \{ \} \textasciitilde{} \textasciicircum{} \textbackslash{} "
    )


def test_build_tex_structure():
    tex = build_tex(RESUME)
    assert tex.startswith(r"\documentclass")
    assert tex.rstrip().endswith(r"\end{document}")
    assert r"{\LARGE\bfseries Jane Doe}" in tex
    assert r"\href{mailto:jane_doe@example.com}{jane\_doe@example.com}" in tex
    assert r"\section*{SUMMARY}" in tex and r"\section*{EXPERIENCE}" in tex
    assert r"5\% churn reduction \& 100\%" in tex
    assert r"\item Built C\# and Python\_tools for \{reporting\}" in tex
    assert r"\$40k \textasciitilde{} 20\%" in tex
    assert tex.count(r"\begin{itemize}") == tex.count(r"\end{itemize}") == 1


def test_existing_latex_passes_through():
    lines = [r"\documentclass{article}", r"\begin{document}", "Hi & bye", r"\end{document}", ""]
    src = "\n".join(lines)
    assert is_latex(src)
    assert build_tex(src) == src
    assert not is_latex(RESUME)
