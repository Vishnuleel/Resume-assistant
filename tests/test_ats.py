import io

import docx
import fitz
import pytest

from resume_assistant.ats import check_file, check_text, summarize
from resume_assistant.docx_export import build_docx

GOOD = """Jane Doe
jane@example.com | +1 555 123 4567

SUMMARY
Data analyst with 3 years of experience.

EXPERIENCE
Data Analyst, Acme (2021 - Present)
- Cut report time by 40% by automating Pandas pipelines
- Built 12 dashboards used by 300 people
- Led migration to Snowflake

EDUCATION
B.Sc. Computer Science, 2020

SKILLS
Python, SQL, Tableau
""" + ("More detail about projects and impact. " * 40)


def by_id(checks):
    return {c.id: c for c in checks}


def test_good_resume_text_passes():
    checks = by_id(check_text(GOOD))
    for key in ("email", "phone", "sections", "length", "dates", "metrics"):
        assert checks[key].status == "pass", (key, checks[key].detail)


def test_problems_are_flagged():
    bad = "Jane Doe\nWork stuff\n➢ did things\n➢ more things\n- helped team"
    checks = by_id(check_text(bad))
    assert checks["email"].status == "fail"
    assert checks["sections"].status == "warn"
    assert checks["length"].status == "warn"
    assert checks["symbols"].status == "warn"
    assert checks["metrics"].status == "warn"


def make_pdf(two_columns: bool = False, image: bool = False) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if two_columns:
        for i in range(4):
            y = 80 + i * 120
            page.insert_textbox(fitz.Rect(40, y, 270, y + 100), "Left column text " * 8)
            page.insert_textbox(fitz.Rect(320, y, 560, y + 100), "Right column text " * 8)
    else:
        page.insert_textbox(fitz.Rect(40, 60, 560, 780), GOOD)
    if image:
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 10, 10), 0)
        pix.clear_with(200)
        page.insert_image(fitz.Rect(500, 20, 540, 60), pixmap=pix)
    data = doc.tobytes()
    doc.close()
    return data


def test_pdf_layout_checks():
    clean = by_id(check_file(make_pdf(), "Jane_Doe_Resume.pdf", GOOD))
    assert clean["text_layer"].status == "pass"
    assert clean["columns"].status == "pass"
    assert clean["images"].status == "pass"
    assert "filename" not in clean

    messy = by_id(check_file(make_pdf(two_columns=True, image=True), "resume.pdf", GOOD))
    assert messy["columns"].status == "warn"
    assert messy["images"].status == "warn"
    assert messy["filename"].status == "info"


def test_docx_layout_checks():
    document = docx.Document()
    document.add_paragraph("Jane Doe")
    document.add_table(rows=1, cols=2)
    document.sections[0].header.paragraphs[0].text = "jane@example.com"
    buf = io.BytesIO()
    document.save(buf)
    checks = by_id(check_file(buf.getvalue(), "cv.docx", GOOD))
    assert checks["tables"].status == "warn"
    assert checks["header"].status == "warn"
    assert checks["textboxes"].status == "pass"


def test_summary_ignores_info():
    checks = check_file(b"text", "resume.txt", GOOD)
    s = summarize(checks)
    assert s["total"] == len([c for c in checks if c.status != "info"])
    assert 0 < s["passed"] <= s["total"]


@pytest.mark.parametrize("text", [GOOD, "Name only"])
def test_build_docx_round_trip(text):
    data = build_docx(text)
    document = docx.Document(io.BytesIO(data))
    styles = [p.style.name for p in document.paragraphs]
    assert document.paragraphs[0].text.strip().startswith(text.split("\n")[0])
    assert styles[0] == "Title"
    if text is GOOD:
        assert "Heading 1" in styles
        assert "List Bullet" in styles
        assert not document.tables
