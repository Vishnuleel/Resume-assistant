# 📄 AI Resume Assistant

Check how well your resume matches a job posting — and get concrete, AI-powered fixes.

Upload your resume, paste a job description, and get an ATS-style score, missing keywords,
rewritten bullet points, a tailored cover letter and interview prep. Run it on your own computer or
use the hosted version.

**Live demo:** _coming soon_ <!-- replace with your https://<name>.onrender.com link -->

![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![React](https://img.shields.io/badge/React%20%2B%20Vite-Tailwind-0f766e)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688)
![AI](https://img.shields.io/badge/AI-Groq%20%7C%20Gemini%20%7C%20OpenAI%20%7C%20Ollama-412991)
![Free](https://img.shields.io/badge/free%20to%20use-yes-22c55e)

<!-- Add a screenshot at docs/screenshot.png, then uncomment:
![App screenshot](docs/screenshot.png)
-->

## ✨ Features

| Feature | Needs API key? |
| --- | --- |
| Upload resumes as **PDF, DOCX, TXT** or paste the text | No |
| **Keyword match**: score plus a table of job keywords (found / missing, counts in job vs resume) | No |
| Your resume with **matched keywords highlighted** | No |
| **ATS format check**: flags columns, tables, text boxes, images, contact details in headers, missing sections, scanned PDFs and more | No |
| **Edit and re-score live**: edit your resume in the app and watch the match score update as you type | No |
| **Tailored resume as Word (.docx)**: clean, single-column, ATS-friendly export of your edited resume | No |
| **Open in Overleaf**: send your edited resume to a new Overleaf project (LaTeX resumes go as-is, others are converted to simple LaTeX) | No |
| **Compare jobs**: one resume against up to 4 postings, ranked side by side | No (AI scores optional) |
| **Application history**: every job you analyze is saved in your browser with scores and a status (Saved → Applied → Interviewing → Offer), with CSV export | No |
| **AI ATS score** (0–100) with a short verdict | Yes |
| Strengths and a prioritized list of improvements | Yes |
| **Bullet point rewrites** you can apply to your resume in one click | Yes |
| Tailored **professional summary**, also one click to apply | Yes |
| **Ask AI**: follow-up chat about your results ("why is my score low?", "rewrite my summary") | Yes |
| **Cover letter generator** (professional / enthusiastic / concise tone) | Yes |
| **Interview prep**: likely questions with answer pointers based on your resume | Yes |
| **Download a full report** as Markdown | No |
| **Choose your AI provider**: Groq & Gemini (free), OpenAI, or Ollama (local, no key) | — |
| **5 themes** (Brutalist by default, plus Midnight, Corporate, Sage and Terminal), each in light and dark; works on phones and with the keyboard | — |

### Why not just ask Claude or Gemini?

You can, and for deep back-and-forth on one application a chat is great. This app adds what a chat can't:
the same checks every time so scores are comparable across jobs, a keyword match that doesn't depend on
an AI, real file-format checks on your PDF or DOCX, a live editor that re-scores as you type, a Word
export, side-by-side job comparison, and a history of where you've applied. It can also run fully
offline with Ollama.

## 🔑 Do I need to pay for an API key?

**No.** You have three free options, and the keyword match works with no key at all.

| Provider | Cost | Key needed? | Get started |
| --- | --- | --- | --- |
| **Groq** | Free tier, no credit card | Yes, free | [console.groq.com/keys](https://console.groq.com/keys) |
| **Google Gemini** | Free tier | Yes, free | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Ollama** | Free, runs on your computer | **No** | [ollama.com/download](https://ollama.com/download) |
| OpenAI | Paid (cents per analysis) | Yes | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Pick the provider in the app's **AI settings** (top right). Free tiers have per-minute limits; if you hit one,
wait a minute or switch provider.

### Why should I trust this app with my API key?

You shouldn't have to, and you don't need to:

- **Run it on your own computer** (see [Quick start](#-quick-start)). Your key lives in your own
  `.env` file and never leaves your machine except to call the provider you chose.
- **Use a free key.** A free Groq or Gemini key has no billing attached, so there is nothing to lose
  even in the worst case. You can revoke it anytime from the provider's dashboard.
- **Use Ollama** to run the AI fully locally. No key, no account, and your resume never leaves your
  computer.
- **Read the code.** It's short and open source. The key is only passed to the provider's client in
  [`resume_assistant/llm.py`](resume_assistant/llm.py); it is never logged or saved, and a key typed
  into AI settings only lives in that browser tab's memory.

If you try a hosted copy of this app, prefer a free key over a paid one, and never paste a key with
billing attached into an app you don't control.

## 🚀 Quick start

You need **Python 3.10+** and **Node.js 20+**.

```bash
git clone https://github.com/<your-username>/ai-resume-assistant.git
cd ai-resume-assistant

python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # optional: add ONE key, e.g. a free GROQ_API_KEY

cd web && npm install && npm run build && cd ..
uvicorn server.main:app --port 8787
```

Open <http://localhost:8787>. You can also paste a key into **AI settings** instead of using `.env`.
No resume handy? Click **Try a sample** on both panels.

### Run fully offline with Ollama (no key)

```bash
# 1. Install Ollama from https://ollama.com/download, then:
ollama pull llama3.2
# 2. Start the app and choose "Ollama (local)" in AI settings
```

Bigger models give better feedback but need more RAM; `llama3.2` (3B) runs on most laptops.

### Run with Docker

```bash
docker build -t resume-assistant .
docker run -p 8787:8787 --env-file .env resume-assistant
```

Then open <http://localhost:8787>.

## ☁️ Deploy your own (free)

The repo includes a [`render.yaml`](render.yaml) Blueprint and a [`Dockerfile`](Dockerfile).

1. Push the repo to GitHub.
2. On [Render](https://render.com), choose **New → Blueprint**, pick the repo and click **Apply**.
3. Wait for the build to finish, then open the `https://<name>.onrender.com` link.

Render redeploys automatically on every push to `main`. On the free plan the app sleeps after 15
minutes without visitors, so the first visit afterwards takes about 30 seconds to load.

The Blueprint sets `PUBLIC_MODE=1`, which makes a hosted copy safe to share:

- **Visitors use their own key.** Server keys in the environment are ignored, so strangers can never spend yours.
- **Ollama is hidden**, since it would point at the server, not the visitor's computer.
- **Rate limits** per visitor: 20 AI calls and 120 other calls a minute.
- **Size limits** on resume and job text (50,000 characters each) and uploads (10 MB).

Don't add API keys to a public deployment.

### Configuration

All settings go in `.env` (see [`.env.example`](.env.example)). You only need one key.

| Variable | Description |
| --- | --- |
| `GROQ_API_KEY` | Free Groq key |
| `GEMINI_API_KEY` | Free Google Gemini key |
| `OPENAI_API_KEY` | OpenAI key (paid) |
| `LLM_PROVIDER` | Provider AI settings starts on: `groq`, `gemini`, `openai` or `ollama` |
| `OPENAI_BASE_URL` | Use any other OpenAI-compatible API (e.g. OpenRouter) under "OpenAI" |
| `OLLAMA_BASE_URL` | Ollama server address (default `http://localhost:11434/v1`) |
| `PUBLIC_MODE` | Set to `1` when hosting for other people: ignores server keys, hides Ollama, adds rate limits |

## 🗂️ Project structure

```
├── web/                       # Frontend: React + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── App.tsx            # Page layout and state
│       ├── api.ts             # Calls to the Python API
│       └── components/        # Inputs, score rings, result tabs, settings drawer
├── server/
│   ├── main.py                # FastAPI: JSON API + serves the built frontend
│   └── ratelimit.py           # Per-visitor rate limits for public hosting
├── resume_assistant/          # The engine (plain Python, no web code)
│   ├── parser.py              # PDF / DOCX / TXT text extraction
│   ├── keywords.py            # Offline keyword extraction, matching, highlighting
│   ├── ats.py                 # ATS formatting checks for PDF / DOCX / text
│   ├── latex_export.py        # LaTeX version of the resume for "Open in Overleaf"
│   ├── docx_export.py         # Clean Word export of the edited resume
│   ├── llm.py                 # AI client, structured JSON analysis
│   ├── providers.py           # Groq / Gemini / OpenAI / Ollama presets
│   ├── prompts.py             # Prompt templates
│   └── report.py              # Markdown report builder
├── tests/                     # pytest suite (no API key needed)
├── examples/                  # Sample resume & job description
├── Dockerfile                 # One image: builds the frontend, runs the API
├── render.yaml                # One-click Render deployment
└── .github/workflows/ci.yml   # Lint, tests, frontend build and Docker build on every push
```

## 🧪 Development

Run the API and the frontend dev server side by side; the frontend reloads as you edit.

```bash
pip install -r requirements-dev.txt
uvicorn server.main:app --reload --port 8787     # terminal 1
cd web && npm run dev                            # terminal 2 → http://localhost:5173
```

```bash
pytest                    # backend tests
ruff check . && ruff format .
cd web && npm run build   # type-check + production build
```

API docs are at <http://localhost:8787/docs> while the server runs.

## 🔒 Privacy

Your resume is processed in memory and is only sent to the AI provider you choose (or nowhere,
with Ollama or the offline keyword match). Nothing is saved to disk. `.gitignore` keeps `.env` and PDF/DOCX files out of the repo, so you
don't commit your API key or personal resume by accident.

**On a hosted copy**, your resume text passes through that server only to compute the result. It
isn't saved or logged, and a key you type into AI settings stays in your browser tab's memory and is
sent with each AI request only. Your application history is stored in your own browser.

## 📜 License

[MIT](LICENSE)

## 🛣️ Roadmap ideas

- Export the report as PDF
- Multi-language resumes
