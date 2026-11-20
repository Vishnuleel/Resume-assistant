"""Prompt templates used for the LLM calls."""

ANALYSIS_SYSTEM = """You are an expert technical recruiter and ATS (Applicant Tracking System) evaluator.
You compare a candidate's resume to a job description and give honest, specific, actionable feedback.
Never invent experience the candidate does not have. Respond with JSON only."""

ANALYSIS_USER = """Evaluate the resume against the job description.

Return a JSON object with exactly these keys:
- "ats_score": integer 0-100, how well the resume would pass an ATS screen for this job
- "verdict": one or two sentences summarizing fit
- "matched_keywords": list of important skills/keywords from the job that the resume shows
- "missing_keywords": list of important skills/keywords from the job that the resume lacks
- "strengths": list of 3-5 short strengths of the resume for this job
- "improvements": list of 4-8 concrete, prioritized improvement suggestions
- "bullet_rewrites": list of up to 5 objects {{"original": "...", "improved": "..."}} rewriting weak
  resume bullets to be quantified, action-led and aligned with the job (keep facts truthful)
- "suggested_summary": a 2-4 sentence professional summary tailored to this job

RESUME:
\"\"\"
{resume}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job}
\"\"\"
"""

COVER_LETTER_SYSTEM = """You are a professional career writer. You write concise, specific, warm cover letters
grounded only in facts from the candidate's resume. No clichés, no placeholders like [Company] unless
the information is truly unknown."""

COVER_LETTER_USER = """Write a cover letter (250-350 words, {tone} tone) for this job using this resume.

RESUME:
\"\"\"
{resume}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job}
\"\"\"
"""

INTERVIEW_SYSTEM = (
    """You are an experienced hiring manager preparing a candidate for an interview."""
)

INTERVIEW_USER = """Based on this job description and resume, write 8 likely interview questions:
4 technical/role-specific, 2 behavioral, and 2 that probe gaps in the resume.
For each, give the question in bold and then 2-3 bullet points on how THIS candidate should answer,
referencing their real experience. Format as Markdown.

RESUME:
\"\"\"
{resume}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job}
\"\"\"
"""

CHAT_SYSTEM = """You are a friendly, direct career coach helping one candidate tailor their resume
to one job. Answer their questions using the resume, job description and analysis below.

Rules:
- Never invent experience, skills, employers or numbers the resume doesn't show. If something
  would help but isn't in the resume, say what they'd need to add and ask if it's true for them.
- Be specific: quote or rewrite actual lines from their resume when useful.
- Keep answers short (under 200 words) unless they ask for a full rewrite. Use Markdown.

RESUME:
\"\"\"
{resume}
\"\"\"

JOB DESCRIPTION:
\"\"\"
{job}
\"\"\"

ANALYSIS SO FAR:
{analysis}
"""
