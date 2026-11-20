# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Frontend: **React + Vite + TypeScript + Tailwind CSS v4** in `web/` (owner's request: best-looking stack).
- Backend: **FastAPI** in `server/`, exposing the tested Python engine in `resume_assistant/`.
- Runs locally: `uvicorn server.main:app --port 8787` serves the API and the built frontend.

## Users

The owner, using it personally while job hunting: tailoring their resume to specific job postings
before applying. Others may clone it from GitHub and run it for themselves the same way.

## Product Purpose

Show how well a resume fits a job posting, and give concrete fixes and application materials
before applying. Success: the owner applies with a resume tailored to the job, plus a cover letter
and interview prep ready.

## Positioning

**All-in-one preparation.** One place that goes from match score to keyword gaps, bullet rewrites,
a tailored summary, a cover letter and interview prep, for free.

## Operating Context

- Inputs: a resume (PDF, DOCX, TXT or pasted text) and a job description pasted from a job board.
- Typical use: the same resume checked against several jobs in a row.
- Runs locally on the owner's computer (see README).
- AI provider of the user's choice: Groq or Google Gemini (free tiers), OpenAI (paid), or Ollama
  (local, no key).

## Capabilities and Constraints

- Resume parsing: PDF, DOCX, TXT/MD, or pasted text.
- Offline keyword match with a 0–100% score; works with no API key.
- AI ATS score (0–100) with verdict, matched/missing keywords, strengths, prioritized
  improvements, before/after bullet rewrites, suggested professional summary.
- Cover letter generator (professional / enthusiastic / concise tone).
- Interview questions with answer pointers based on the resume.
- Full report download (Markdown).
- Never invents experience the resume doesn't show (enforced in prompts).
- Nothing is stored; input text is truncated to 15,000 characters before AI calls.
- Free AI tiers have per-minute rate limits; errors must be shown plainly.

Out of scope: recruiter/HR features, accounts, teams, billing, hosting as a service.

## Brand Commitments

- Name: **AI Resume Assistant**.
- Personal tool: should look clean and pleasant to use, not corporate.

## Evidence on Hand

- Sample inputs: `examples/sample_resume.txt`, `examples/sample_job_description.txt` (fictional).
- No users, testimonials, metrics or logo exist. Don't fabricate any.

## Product Principles

1. **Honest over flattering.** Scores and suggestions reflect the real resume.
2. **Every gap comes with a fix.** The score is the start, not the end.
3. **Free to use.** Works with free providers, a local model, or no key at all.
4. **Simple.** One person, one resume, one job at a time; no extra machinery.
