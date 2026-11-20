import io

import pytest

from resume_assistant.parser import ResumeParseError, clean_text, extract_text


def test_txt_extraction():
    assert (
        extract_text(b"Jane Doe\n\n\n\nPython   developer", "cv.txt")
        == "Jane Doe\n\nPython developer"
    )


def test_pdf_extraction():
    fitz = pytest.importorskip("fitz")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Jane Doe - Data Scientist")
    data = doc.tobytes()
    doc.close()
    assert "Jane Doe - Data Scientist" in extract_text(data, "resume.PDF")


def test_docx_extraction():
    docx = pytest.importorskip("docx")
    document = docx.Document()
    document.add_paragraph("Jane Doe")
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Skills"
    table.cell(0, 1).text = "Python"
    buffer = io.BytesIO()
    document.save(buffer)
    text = extract_text(buffer.getvalue(), "resume.docx")
    assert "Jane Doe" in text
    assert "Skills | Python" in text


def test_unsupported_extension():
    with pytest.raises(ResumeParseError, match="Unsupported"):
        extract_text(b"data", "resume.exe")


def test_empty_file():
    with pytest.raises(ResumeParseError, match="No text"):
        extract_text(b"   \n  ", "resume.txt")


def test_corrupt_pdf():
    with pytest.raises(ResumeParseError):
        extract_text(b"not a pdf", "resume.pdf")


def test_clean_text_normalizes_whitespace():
    assert clean_text("a \tb  \r\n  c") == "a b\nc"
