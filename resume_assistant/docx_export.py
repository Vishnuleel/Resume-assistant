"""Turn plain resume text into a clean, ATS-friendly Word document.

Single column, no tables or text boxes, standard fonts and real heading/bullet styles.
"""

from __future__ import annotations

import io
import re

from .ats import EMAIL_RE, PHONE_RE, SECTIONS

BULLET_RE = re.compile(r"^\s*[-•*–▪●◦➢➤►✓✔]\s*")
EXTRA_HEADINGS = (
    "summary",
    "profile",
    "objective",
    "projects",
    "certifications",
    "awards",
    "publications",
    "languages",
    "interests",
    "volunteering",
    "achievements",
)


def _is_heading(line: str) -> bool:
    clean = line.strip().rstrip(":")
    if not clean or len(clean) > 40:
        return False
    lower = clean.lower()
    known = [w for words in SECTIONS.values() for w in words] + list(EXTRA_HEADINGS)
    if any(lower == w or lower.startswith(w + " ") for w in known):
        return True
    letters = [c for c in clean if c.isalpha()]
    return len(letters) >= 3 and all(c.isupper() for c in letters)


def classify_lines(text: str) -> list[tuple[str, str]]:
    """Label each non-empty line as name, contact, heading, bullet or text."""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)

    out: list[tuple[str, str]] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if not out:
            out.append(("name", stripped))
        elif i <= 3 and (EMAIL_RE.search(stripped) or PHONE_RE.search(stripped) or "|" in stripped):
            out.append(("contact", stripped))
        elif _is_heading(stripped):
            out.append(("heading", stripped.rstrip(":").upper()))
        elif BULLET_RE.match(stripped):
            out.append(("bullet", BULLET_RE.sub("", stripped)))
        else:
            out.append(("text", stripped))
    return out


def build_docx(text: str) -> bytes:
    import docx
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor

    document = docx.Document()
    for section in document.sections:
        section.top_margin = section.bottom_margin = Inches(0.7)
        section.left_margin = section.right_margin = Inches(0.8)

    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(2)
    for style_name, size in (("Title", 20), ("Heading 1", 12)):
        style = document.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0x11, 0x11, 0x11)
    document.styles["Heading 1"].paragraph_format.space_before = Pt(10)
    document.styles["Heading 1"].paragraph_format.space_after = Pt(3)

    for kind, line in classify_lines(text):
        if kind == "name":
            document.add_paragraph(line, style="Title").alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif kind == "contact":
            document.add_paragraph(line).alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif kind == "heading":
            document.add_paragraph(line, style="Heading 1")
        elif kind == "bullet":
            document.add_paragraph(line, style="List Bullet")
        else:
            document.add_paragraph(line)

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
