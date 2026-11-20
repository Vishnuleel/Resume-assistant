"""ATS formatting checks.

Applicant tracking systems read resumes as plain text. Layout tricks that look good to a
human (columns, tables, text boxes, icons, contact details in the page header) often come
out scrambled or missing. These checks flag the common problems.

Two levels:
- ``check_text``: content checks that work on any resume text (pasted or extracted).
- ``check_file``: adds layout checks for the original PDF or DOCX file.
"""

from __future__ import annotations

import io
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

Status = Literal["pass", "warn", "fail", "info"]

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d[\s().-]?){7,15}\d")
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?\s?(?:%|percent|x\b|k\b|m\b)|\$\s?\d|\b\d{2,}\b", re.I)
BULLET_LINE_RE = re.compile(r"^\s*[-•*–▪●◦]\s+")
ODD_BULLETS = "➢➤►▶✓✔☐☑❖◆◇■□⦿"

SECTIONS = {
    "Experience": ("experience", "employment", "work history", "professional background"),
    "Education": ("education", "academic", "qualifications"),
    "Skills": ("skills", "technical skills", "competencies", "technologies", "tools"),
}
GENERIC_NAMES = {"resume", "cv", "my resume", "my cv", "document", "untitled", "final"}


@dataclass
class Check:
    id: str
    title: str
    status: Status
    detail: str

    def to_dict(self) -> dict:
        return asdict(self)


def _has_heading(text: str, words: tuple[str, ...]) -> bool:
    for line in text.splitlines():
        clean = line.strip().strip(":").lower()
        if clean and len(clean) <= 40 and any(clean == w or clean.startswith(w) for w in words):
            return True
    return False


def check_text(text: str) -> list[Check]:
    """Content checks that work on any resume text."""
    checks: list[Check] = []
    words = len(text.split())

    checks.append(
        Check("email", "Email address", "pass", "Found an email address.")
        if EMAIL_RE.search(text)
        else Check(
            "email", "Email address", "fail", "Add an email address so recruiters can reach you."
        )
    )
    checks.append(
        Check("phone", "Phone number", "pass", "Found a phone number.")
        if PHONE_RE.search(text)
        else Check("phone", "Phone number", "warn", "Most recruiters expect a phone number.")
    )

    missing = [name for name, words_ in SECTIONS.items() if not _has_heading(text, words_)]
    checks.append(
        Check(
            "sections",
            "Standard section headings",
            "pass",
            "Experience, Education and Skills are all labelled.",
        )
        if not missing
        else Check(
            "sections",
            "Standard section headings",
            "warn",
            f"Couldn't find a clear {', '.join(missing)} heading. ATS software looks for these exact words.",
        )
    )

    if words < 200:
        checks.append(
            Check("length", "Length", "warn", f"{words} words is short. Most resumes have 400–800.")
        )
    elif words > 1100:
        checks.append(
            Check(
                "length",
                "Length",
                "warn",
                f"{words} words is long. Aim for 1–2 pages (400–800 words).",
            )
        )
    else:
        checks.append(Check("length", "Length", "pass", f"{words} words: a good length."))

    checks.append(
        Check("dates", "Dates on roles", "pass", "Roles include dates.")
        if YEAR_RE.search(text)
        else Check(
            "dates",
            "Dates on roles",
            "warn",
            "Add start and end dates (e.g. 2022 – Present) to each role.",
        )
    )

    bullets = [line for line in text.splitlines() if BULLET_LINE_RE.match(line)]
    quantified = sum(1 for line in bullets if NUMBER_RE.search(line))
    if bullets and quantified < max(2, len(bullets) // 4):
        checks.append(
            Check(
                "metrics",
                "Measurable results",
                "warn",
                f"Only {quantified} of {len(bullets)} bullet points include a number. "
                "Add results like time saved, % improved or users served.",
            )
        )
    elif bullets:
        checks.append(
            Check(
                "metrics",
                "Measurable results",
                "pass",
                f"{quantified} bullet points include numbers.",
            )
        )

    odd = sorted({ch for ch in text if ch in ODD_BULLETS})
    if odd:
        checks.append(
            Check(
                "symbols",
                "Bullet symbols",
                "warn",
                f"Decorative symbols ({' '.join(odd)}) can turn into garbage characters. Use plain • or -.",
            )
        )
    return checks


# ---------------------------------------------------------------- file checks
def check_file(data: bytes, filename: str, text: str) -> list[Check]:
    """Layout checks on the original file, followed by the text checks."""
    ext = Path(filename).suffix.lower().lstrip(".")
    checks: list[Check] = []
    if ext == "pdf":
        checks += _check_pdf(data, text)
    elif ext == "docx":
        checks += _check_docx(data)
    else:
        checks.append(
            Check(
                "layout",
                "Layout",
                "info",
                "Plain text has no layout to check. Upload your PDF or DOCX to check columns, tables and images.",
            )
        )
    checks += _check_filename(filename)
    return checks + check_text(text)


def _check_filename(filename: str) -> list[Check]:
    stem = Path(filename).stem.lower().replace("_", " ").replace("-", " ").strip()
    if stem in GENERIC_NAMES or re.fullmatch(r"(resume|cv)\s*\d*( final)?", stem):
        return [
            Check(
                "filename",
                "File name",
                "info",
                f"'{filename}' is generic. Recruiters see it: try FirstName_LastName_Resume{Path(filename).suffix}.",
            )
        ]
    return []


def _check_pdf(data: bytes, text: str) -> list[Check]:
    import fitz  # PyMuPDF

    checks: list[Check] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        pages = doc.page_count
        chars_per_page = len(text) / max(pages, 1)
        if chars_per_page < 200:
            checks.append(
                Check(
                    "text_layer",
                    "Readable text",
                    "fail",
                    "Very little text could be read. It may be a scanned image, which ATS software can't read. "
                    "Export it from Word or Google Docs instead.",
                )
            )
        else:
            checks.append(
                Check(
                    "text_layer", "Readable text", "pass", "The PDF contains real, selectable text."
                )
            )

        if pages > 2:
            checks.append(
                Check("pages", "Page count", "warn", f"{pages} pages. Keep it to 1–2 pages.")
            )
        else:
            checks.append(
                Check("pages", "Page count", "pass", f"{pages} page{'s' if pages > 1 else ''}.")
            )

        columns = tables = images = 0
        header_contact = False
        fonts: set[str] = set()
        for page in doc:
            width, height = page.rect.width, page.rect.height
            blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]
            if _looks_multi_column(blocks, width):
                columns += 1
            try:
                tables += len(page.find_tables().tables)
            except Exception:  # table finder can fail on unusual PDFs
                pass
            images += len(page.get_images(full=False))
            for _x0, y0, _x1, y1, block_text, *_ in blocks:
                in_margin = y1 < height * 0.07 or y0 > height * 0.93
                if in_margin and (EMAIL_RE.search(block_text) or PHONE_RE.search(block_text)):
                    header_contact = True
            for font in page.get_fonts():
                name = font[3].split("+")[-1].split("-")[0].split(",")[0]
                if name:
                    fonts.add(name)

        checks.append(
            Check(
                "columns",
                "Single column",
                "warn",
                "Text is laid out in columns. Many ATS read straight across the page and mix the columns up.",
            )
            if columns
            else Check("columns", "Single column", "pass", "Single-column layout.")
        )
        checks.append(
            Check(
                "tables",
                "Tables",
                "warn",
                "Tables were found. Their contents are often skipped or jumbled.",
            )
            if tables
            else Check("tables", "Tables", "pass", "No tables.")
        )
        checks.append(
            Check(
                "images",
                "Images and icons",
                "warn",
                f"{images} image{'s' if images > 1 else ''} found. ATS ignores images, so make sure no "
                "information (like skill ratings or contact icons) only exists as a picture.",
            )
            if images
            else Check("images", "Images and icons", "pass", "No images.")
        )
        if header_contact:
            checks.append(
                Check(
                    "header",
                    "Contact details placement",
                    "warn",
                    "Contact details sit in the page header or footer area, which some ATS skip. "
                    "Move them into the main body.",
                )
            )
        if len(fonts) > 4:
            checks.append(
                Check(
                    "fonts", "Fonts", "warn", f"{len(fonts)} different fonts. Stick to one or two."
                )
            )
    return checks


def _looks_multi_column(blocks: list, width: float) -> bool:
    """Two or more narrow blocks on each side of the page that overlap vertically."""
    left = [b for b in blocks if b[2] < width * 0.55 and (b[2] - b[0]) < width * 0.5]
    right = [b for b in blocks if b[0] > width * 0.4 and (b[2] - b[0]) < width * 0.5]
    if len(left) < 2 or len(right) < 2:
        return False
    overlaps = sum(1 for lb in left for rb in right if lb[1] < rb[3] and rb[1] < lb[3])
    return overlaps >= 2


def _check_docx(data: bytes) -> list[Check]:
    import docx

    document = docx.Document(io.BytesIO(data))
    xml = document.element.xml
    checks: list[Check] = []

    tables = len(document.tables)
    checks.append(
        Check(
            "tables",
            "Tables",
            "warn",
            f"{tables} table{'s' if tables > 1 else ''} found. Their contents are often skipped or jumbled.",
        )
        if tables
        else Check("tables", "Tables", "pass", "No tables.")
    )
    checks.append(
        Check(
            "textboxes",
            "Text boxes",
            "warn",
            "Text boxes found. Most ATS can't read text inside them.",
        )
        if "txbxContent" in xml
        else Check("textboxes", "Text boxes", "pass", "No text boxes.")
    )
    images = len(document.inline_shapes) + xml.count("<wp:anchor")
    checks.append(
        Check(
            "images",
            "Images and icons",
            "warn",
            "Images found. ATS ignores them, so don't put information only in pictures.",
        )
        if images
        else Check("images", "Images and icons", "pass", "No images.")
    )
    multi_col = any(
        (
            cols := s._sectPr.find(
                "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cols"
            )
        )
        is not None
        and int(cols.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}num", "1"))
        > 1
        for s in document.sections
    )
    checks.append(
        Check(
            "columns",
            "Single column",
            "warn",
            "The document uses columns, which ATS often reads in the wrong order.",
        )
        if multi_col
        else Check("columns", "Single column", "pass", "Single-column layout.")
    )
    header_text = " ".join(
        p.text for s in document.sections for part in (s.header, s.footer) for p in part.paragraphs
    )
    if EMAIL_RE.search(header_text) or PHONE_RE.search(header_text):
        checks.append(
            Check(
                "header",
                "Contact details placement",
                "warn",
                "Contact details are in the Word header or footer, which some ATS skip. Move them into the body.",
            )
        )
    checks.append(Check("format", "File type", "pass", "Word documents parse reliably."))
    return checks


def summarize(checks: list[Check]) -> dict:
    scored = [c for c in checks if c.status != "info"]
    passed = sum(1 for c in scored if c.status == "pass")
    return {"passed": passed, "total": len(scored)}
