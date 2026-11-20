"""Turn plain resume text into a simple, ATS-friendly LaTeX document.

Used by "Open in Overleaf". If the text is already LaTeX it is passed through untouched.
"""

from __future__ import annotations

import re

from .ats import EMAIL_RE
from .docx_export import classify_lines

_SPECIAL = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

PREAMBLE = r"""\documentclass[11pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[margin=0.7in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}

\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{2pt}
\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{10pt}{4pt}
\setlist[itemize]{leftmargin=*, nosep, topsep=2pt}

\begin{document}
"""


def is_latex(text: str) -> bool:
    return bool(re.search(r"\\documentclass|\\begin\{document\}", text))


def escape(text: str) -> str:
    return "".join(_SPECIAL.get(c, c) for c in text)


def _contact(line: str) -> str:
    out, last = [], 0
    for m in EMAIL_RE.finditer(line):
        out.append(escape(line[last : m.start()]))
        out.append(rf"\href{{mailto:{m.group()}}}{{{escape(m.group())}}}")
        last = m.end()
    out.append(escape(line[last:]))
    return "".join(out)


def build_tex(text: str) -> str:
    if is_latex(text):
        return text

    body: list[str] = []
    in_list = False
    for kind, line in classify_lines(text):
        if kind != "bullet" and in_list:
            body.append(r"\end{itemize}")
            in_list = False
        if kind == "name":
            body.append(rf"\begin{{center}}{{\LARGE\bfseries {escape(line)}}}\end{{center}}")
        elif kind == "contact":
            body.append(rf"\begin{{center}}\small {_contact(line)}\end{{center}}")
        elif kind == "heading":
            body.append(rf"\section*{{{escape(line)}}}")
        elif kind == "bullet":
            if not in_list:
                body.append(r"\begin{itemize}")
                in_list = True
            body.append(rf"  \item {escape(line)}")
        else:
            body.append(escape(line) + r"\par")
    if in_list:
        body.append(r"\end{itemize}")

    return PREAMBLE + "\n".join(body) + "\n" + r"\end{document}" + "\n"
