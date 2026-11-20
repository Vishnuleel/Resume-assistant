export type Provider = {
  name: string;
  needs_key: boolean;
  has_env_key: boolean;
  models: string[];
  key_url: string;
  note: string;
};

export type KeywordRow = {
  keyword: string;
  found: boolean;
  job_count: number;
  resume_count: number;
};

export type KeywordResult = {
  score: number;
  matched: string[];
  missing: string[];
  keywords: KeywordRow[];
  spans: [number, number][];
};

export type Analysis = {
  ats_score: number;
  verdict: string;
  matched_keywords: string[];
  missing_keywords: string[];
  strengths: string[];
  improvements: string[];
  bullet_rewrites: { original: string; improved: string }[];
  suggested_summary: string;
};

export type Tone = "professional" | "enthusiastic" | "concise";

export type AtsCheck = {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
};

export type CompareResult = {
  title: string;
  score: number;
  matched: string[];
  missing: string[];
  total: number;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AISettings = {
  provider: string;
  model: string;
  temperature: number;
  apiKey: string;
};

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit, as: "json" | "text" = "json"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("Can't reach the app server. Is it running (uvicorn server.main:app --port 8787)?");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail))
        message = body.detail.some((d: { type?: string }) => d.type === "string_too_long")
          ? "That text is too long. Keep the resume and job description under 50,000 characters each."
          : "Please fill in both your resume and the job description.";
    } catch {
      // No JSON body: the dev proxy couldn't reach the Python server.
      if (res.status >= 500) message = "Can't reach the app server. Is it running (uvicorn server.main:app --port 8787)?";
    }
    throw new ApiError(message);
  }
  return (as === "json" ? res.json() : res.text()) as Promise<T>;
}

function post<T>(path: string, body: unknown, apiKey?: string, as: "json" | "text" = "json") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  return request<T>(path, { method: "POST", headers, body: JSON.stringify(body) }, as);
}

function aiBody(resume: string, job: string, s: AISettings) {
  return { resume, job, provider: s.provider, model: s.model || null, temperature: s.temperature };
}

export const api = {
  providers: () => request<{ default: string; providers: Provider[] }>("/api/providers", {}),

  parse: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ text: string; words: number; filename: string; checks: AtsCheck[] }>("/api/parse", {
      method: "POST",
      body: form,
    });
  },

  keywords: (resume: string, job: string, top_n: number) =>
    post<KeywordResult>("/api/keywords", { resume, job, top_n }),

  analyze: (resume: string, job: string, s: AISettings) =>
    post<Analysis>("/api/analyze", aiBody(resume, job, s), s.apiKey),

  coverLetter: (resume: string, job: string, s: AISettings, tone: Tone) =>
    post<{ text: string }>("/api/cover-letter", { ...aiBody(resume, job, s), tone }, s.apiKey),

  interview: (resume: string, job: string, s: AISettings) =>
    post<{ text: string }>("/api/interview", aiBody(resume, job, s), s.apiKey),

  atsText: (resume: string) => post<{ checks: AtsCheck[] }>("/api/ats-text", { resume }),

  compare: (resume: string, jobs: { title: string; text: string }[], top_n: number) =>
    post<{ results: CompareResult[] }>("/api/compare", { resume, jobs, top_n }),

  chat: (resume: string, job: string, s: AISettings, messages: ChatMessage[], analysis: Analysis | null) =>
    post<{ text: string }>("/api/chat", { ...aiBody(resume, job, s), messages, analysis }, s.apiKey),

  exportTex: async (resume: string) => {
    let res: Response;
    try {
      res = await fetch("/api/export-tex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
    } catch {
      throw new ApiError("Can't reach the app server.");
    }
    if (!res.ok) throw new ApiError("Couldn't create the LaTeX file.");
    return res.text();
  },
  exportDocx: async (resume: string) => {
    let res: Response;
    try {
      res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
    } catch {
      throw new ApiError("Can't reach the app server.");
    }
    if (!res.ok) throw new ApiError("Couldn't create the Word file.");
    return res.blob();
  },

  report: (body: {
    resume: string;
    job: string;
    top_n: number;
    analysis: Analysis | null;
    cover_letter: string | null;
    interview: string | null;
  }) => post<string>("/api/report", body, undefined, "text"),
};

/** Open the LaTeX in a new Overleaf project (Overleaf's official "open in Overleaf" form). */
export function openInOverleaf(tex: string, name = "resume.tex") {
  const form = Object.assign(document.createElement("form"), {
    action: "https://www.overleaf.com/docs",
    method: "post",
    target: "_blank",
  });
  for (const [key, value] of Object.entries({ snip: tex, snip_name: name, engine: "pdflatex" })) {
    const field = Object.assign(document.createElement("textarea"), { name: key, value });
    form.appendChild(field);
  }
  form.style.display = "none";
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
