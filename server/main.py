"""FastAPI backend for AI Resume Assistant.

Dev:   uvicorn server.main:app --reload --port 8787   (frontend: cd web && npm run dev)
Prod:  cd web && npm run build, then uvicorn server.main:app --port 8787  -> http://localhost:8787

API keys arrive per request in the ``X-API-Key`` header. They are used for that one call
and never stored or logged.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from resume_assistant import __version__
from resume_assistant.ats import check_file, check_text, summarize
from resume_assistant.docx_export import build_docx
from resume_assistant.keywords import count_occurrences, find_spans, match_keywords
from resume_assistant.latex_export import build_tex
from resume_assistant.llm import AnalysisError, AnalysisResult, ResumeAI
from resume_assistant.parser import ResumeParseError, extract_text
from resume_assistant.providers import available_providers, default_provider, public_mode
from resume_assistant.report import build_markdown_report
from server.ratelimit import RateLimiter

load_dotenv()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_TEXT = 50_000  # characters per resume / job description
WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
AI_PATHS = {"/api/analyze", "/api/cover-letter", "/api/interview", "/api/chat"}
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
}

app = FastAPI(title="AI Resume Assistant", version=__version__)
limiter = RateLimiter({"ai": 20, "api": 120})


def _client_ip(request: Request) -> str:
    # Hosts like Render put the real visitor first in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if public_mode() and path.startswith("/api/") and path != "/api/health":
        bucket = "ai" if path in AI_PATHS else "api"
        wait = limiter.hit(_client_ip(request), bucket)
        if wait is not None:
            return JSONResponse(
                {"detail": f"Too many requests. Try again in {int(wait) + 1} seconds."},
                status_code=429,
                headers={"Retry-After": str(int(wait) + 1), **SECURITY_HEADERS},
            )
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    return response


# ---------------------------------------------------------------- models
Text = Annotated[str, Field(min_length=1, max_length=MAX_TEXT)]


class TextInputs(BaseModel):
    resume: Text
    job: Text


class KeywordRequest(TextInputs):
    top_n: int = Field(25, ge=5, le=60)


class AIRequest(TextInputs):
    provider: str
    model: str | None = None
    temperature: float = Field(0.3, ge=0, le=1)


class CoverLetterRequest(AIRequest):
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"


class ResumeOnly(BaseModel):
    resume: Text


class CompareJob(BaseModel):
    title: str = Field("", max_length=200)
    text: Text


class CompareRequest(BaseModel):
    resume: Text
    jobs: list[CompareJob] = Field(min_length=1, max_length=6)
    top_n: int = Field(25, ge=5, le=60)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(AIRequest):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    analysis: dict | None = None


class ReportRequest(KeywordRequest):
    analysis: dict | None = None
    cover_letter: str | None = None
    interview: str | None = None


# ---------------------------------------------------------------- helpers
def _ai(req: AIRequest, api_key: str | None) -> ResumeAI:
    provider = available_providers().get(req.provider)
    if provider is None:
        raise HTTPException(400, f"Unknown provider '{req.provider}'.")
    key = api_key or provider.env_key()
    if provider.needs_key and not key:
        raise HTTPException(
            401, f"Add a {provider.name.split(' (')[0]} API key to use AI features."
        )
    try:
        return ResumeAI(
            api_key=key,
            model=req.model or provider.models[0],
            temperature=req.temperature,
            base_url=provider.base_url,
        )
    except AnalysisError as exc:
        raise HTTPException(400, str(exc)) from exc


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except AnalysisError as exc:
        raise HTTPException(502, str(exc)) from exc


# ---------------------------------------------------------------- routes
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/api/providers")
def providers() -> dict:
    return {
        "default": default_provider(),
        "providers": [
            {
                "name": p.name,
                "needs_key": p.needs_key,
                "has_env_key": bool(p.env_key()),
                "models": list(p.models),
                "key_url": p.key_url,
                "note": p.note,
            }
            for p in available_providers().values()
        ],
    }


@app.post("/api/parse")
async def parse(file: UploadFile = File(...)) -> dict:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 10 MB.")
    try:
        text = extract_text(data, file.filename or "resume.txt")
    except ResumeParseError as exc:
        raise HTTPException(422, str(exc)) from exc
    checks = [c.to_dict() for c in check_file(data, file.filename or "resume.txt", text)]
    return {
        "text": text,
        "words": len(text.split()),
        "filename": file.filename,
        "checks": checks,
    }


def job_title(text: str) -> str:
    """First meaningful line of a job posting, used as its title."""
    for line in text.splitlines():
        line = line.strip(" 	-•*#:")
        if 3 <= len(line) <= 90:
            return line
    return text.strip()[:60] or "Untitled job"


@app.post("/api/ats-text")
def ats_text(req: ResumeOnly) -> dict:
    """Content checks for a pasted resume (no file, so no layout checks)."""
    checks = check_text(req.resume)
    return {"checks": [c.to_dict() for c in checks], **summarize(checks)}


@app.post("/api/keywords")
def keywords(req: KeywordRequest) -> dict:
    report = match_keywords(req.resume, req.job, top_n=req.top_n)
    found = set(report.matched)
    return {
        "score": report.score,
        "matched": report.matched,
        "missing": report.missing,
        "keywords": [
            {
                "keyword": kw,
                "found": kw in found,
                "job_count": count_occurrences(req.job, kw),
                "resume_count": count_occurrences(req.resume, kw),
            }
            for kw in report.keywords
        ],
        "spans": find_spans(req.resume, report.matched),
    }


@app.post("/api/compare")
def compare(req: CompareRequest) -> dict:
    results = []
    for job in req.jobs:
        report = match_keywords(req.resume, job.text, top_n=req.top_n)
        results.append(
            {
                "title": job.title.strip() or job_title(job.text),
                "score": report.score,
                "matched": report.matched,
                "missing": report.missing,
                "total": len(report.keywords),
            }
        )
    return {"results": results}


@app.post("/api/analyze")
def analyze(req: AIRequest, x_api_key: str | None = Header(None)) -> dict:
    return _run(_ai(req, x_api_key).analyze, req.resume, req.job).to_dict()


@app.post("/api/cover-letter")
def cover_letter(req: CoverLetterRequest, x_api_key: str | None = Header(None)) -> dict:
    return {"text": _run(_ai(req, x_api_key).cover_letter, req.resume, req.job, tone=req.tone)}


@app.post("/api/interview")
def interview(req: AIRequest, x_api_key: str | None = Header(None)) -> dict:
    return {"text": _run(_ai(req, x_api_key).interview_questions, req.resume, req.job)}


@app.post("/api/chat")
def chat(req: ChatRequest, x_api_key: str | None = Header(None)) -> dict:
    analysis = AnalysisResult.from_dict(req.analysis) if req.analysis else None
    messages = [m.model_dump() for m in req.messages]
    return {"text": _run(_ai(req, x_api_key).chat, req.resume, req.job, messages, analysis)}


DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@app.post("/api/export-docx")
def export_docx(req: ResumeOnly) -> Response:
    return Response(
        build_docx(req.resume),
        media_type=DOCX_TYPE,
        headers={"Content-Disposition": 'attachment; filename="tailored_resume.docx"'},
    )


@app.post("/api/export-tex", response_class=PlainTextResponse)
def export_tex(req: ResumeOnly) -> str:
    return build_tex(req.resume)


@app.post("/api/report", response_class=PlainTextResponse)
def report(req: ReportRequest) -> str:
    analysis = AnalysisResult.from_dict(req.analysis) if req.analysis else None
    return build_markdown_report(
        match_keywords(req.resume, req.job, top_n=req.top_n),
        analysis,
        cover_letter=req.cover_letter,
        interview_prep=req.interview,
    )


# ---------------------------------------------------------------- frontend
if WEB_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = (WEB_DIST / path).resolve()
        if path and file.is_file() and WEB_DIST in file.parents:
            return FileResponse(file)
        return FileResponse(WEB_DIST / "index.html")
