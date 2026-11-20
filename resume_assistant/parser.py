"""Extract plain text from resume files (PDF, DOCX, TXT)."""

from __future__ import annotations

import io
import re
from pathlib import Path

SUPPORTED_EXTENSIONS = ("pdf", "docx", "txt", "md")


class ResumeParseError(ValueError):
    """Raised when a resume file cannot be read."""


def extract_text(data: bytes, filename: str) -> str:
    """Return cleaned text from the raw bytes of a resume file.

    The format is chosen from the file extension.
    """
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in SUPPORTED_EXTENSIONS:
        raise ResumeParseError(
            f"Unsupported file type '.{ext}'. Use one of: {', '.join(SUPPORTED_EXTENSIONS)}."
        )

    if ext == "pdf":
        text = _extract_pdf(data)
    elif ext == "docx":
        text = _extract_docx(data)
    else:
        text = data.decode("utf-8", errors="ignore")

    text = clean_text(text)
    if not text:
        raise ResumeParseError(
            "No text found in the file. If it's a scanned PDF, export it as a text-based PDF "
            "or paste the resume text instead."
        )
    return text


def _extract_pdf(data: bytes) -> str:
    import fitz  # PyMuPDF

    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception as exc:  # PyMuPDF raises several error types
        raise ResumeParseError(f"Could not read PDF: {exc}") from exc


def _extract_docx(data: bytes) -> str:
    import docx  # python-docx

    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:
        raise ResumeParseError(f"Could not read DOCX: {exc}") from exc

    parts = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def clean_text(text: str) -> str:
    """Normalize whitespace while keeping line breaks meaningful."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
